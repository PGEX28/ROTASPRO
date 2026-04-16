import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAutoLearningConfig, shouldAutoApprove, autoApproveSuggestion } from '@/lib/auto-learning'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Função helper para consolidar a confiabilidade (10 a 100)
function calculateConfidence(occurrences: number, avgDistanceKm: number, streetMismatchCount: number): number {
  let score = 50; // Base média

  // Ocorrências valorizam muito a sugestão
  score += Math.min(occurrences * 5, 25);
  
  // Distâncias curtas (<= 0.2km) aumentam a confiança.
  if (avgDistanceKm <= 0.2) score += 15;
  else if (avgDistanceKm > 2.0) score -= 20;

  // Penaliza se há erro frequente de variante (rua diferente detectada internamente)
  if (streetMismatchCount > 0) score -= Math.min(streetMismatchCount * 10, 30);

  return Math.max(10, Math.min(score, 100)); // clamp(10, 100)
}

export async function POST(req: NextRequest) {
  try {
    const { issues } = await req.json()
    if (!issues || !Array.isArray(issues)) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const config = await getAutoLearningConfig(supabase)

    const addressHashesForSearch = issues
      .filter((i: any) => !!i.raw_address)
      .map((i: any) => Buffer.from(`${i.raw_address}_${i.city || ''}`.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).toString('base64'))

    const { data: blacklistedItems } = await supabase
       .from('address_corrections')
       .select('normalized_address')
       .in('normalized_address', addressHashesForSearch)
       .eq('blacklisted', true)

    const blacklistedSet = new Set(blacklistedItems?.map(b => b.normalized_address) || []);

    let updatedCount = 0;
    let autoApprovedCountThisRun = 0;

    for (const issue of issues) {
      if (!issue.raw_address) continue;

      const normalized = `${issue.raw_address}_${issue.city || ''}`.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const addressHash = Buffer.from(normalized).toString('base64')

      const { data: existing } = await supabase
        .from('address_suggestions')
        .select('*')
        .eq('normalized_address', addressHash)
        .single()

      if (existing) {
        // Se ela já foi aprova ou rejeitada, podemos ignorar novos erros de auditoria pra cá?
        // Sim, a menos que se queira re-abrir. Manteremos como está.
        if (existing.status !== 'PENDING') continue;

        const ocor = existing.occurrences + 1;
        
        // Recalcular avg_distance (média simples entre histórico anterior e o novo)
        const totalOldDist = existing.avg_distance_km * existing.occurrences;
        const newAvgDist = Math.round(((totalOldDist + issue.distance_km) / ocor) * 1000) / 1000;

        const st_match = existing.street_match_count + (issue.match_reason === 'MATCH_STREET_ONLY' ? 1 : 0);
        const nb_mismatch = existing.number_mismatch_count + (issue.match_reason === 'NUMBER_MISMATCH' ? 1 : 0);
        const st_mismatch = existing.street_mismatch_count + (issue.match_reason === 'STREET_MISMATCH' ? 1 : 0);

        const confidence = calculateConfidence(ocor, newAvgDist, st_mismatch)

        const isBlacklisted = blacklistedSet.has(addressHash);

        const updatedSuggestion = {
            id: existing.id,
            normalized_address: addressHash,
            status: 'PENDING',
            occurrences: ocor,
            avg_distance_km: newAvgDist,
            confidence_score: confidence,
            last_google_lat: issue.google_lat,
            last_google_lng: issue.google_lng,
            location_type: issue.location_type || 'UNKNOWN'
        }

        await supabase
          .from('address_suggestions')
          .update({
            occurrences: ocor,
            avg_distance_km: newAvgDist,
            street_match_count: st_match,
            number_mismatch_count: nb_mismatch,
            street_mismatch_count: st_mismatch,
            last_google_lat: issue.google_lat,
            last_google_lng: issue.google_lng,
            last_shopee_lat: issue.shopee_lat,
            last_shopee_lng: issue.shopee_lng,
            confidence_score: confidence,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)

        if (config.auto_learning_enabled && autoApprovedCountThisRun < 20 && shouldAutoApprove(updatedSuggestion, config, isBlacklisted)) {
          await autoApproveSuggestion(updatedSuggestion, supabase)
          autoApprovedCountThisRun++
        }

        updatedCount++;
      } else {
        // Create new
        const st_match = (issue.match_reason === 'MATCH_STREET_ONLY' ? 1 : 0);
        const nb_mismatch = (issue.match_reason === 'NUMBER_MISMATCH' ? 1 : 0);
        const st_mismatch = (issue.match_reason === 'STREET_MISMATCH' ? 1 : 0);
        const confidence = calculateConfidence(1, issue.distance_km, st_mismatch)
        
        const isBlacklisted = blacklistedSet.has(addressHash);

        const { data: newSugg } = await supabase
          .from('address_suggestions')
          .insert({
            normalized_address: addressHash,
            occurrences: 1,
            avg_distance_km: issue.distance_km,
            street_match_count: st_match,
            number_mismatch_count: nb_mismatch,
            street_mismatch_count: st_mismatch,
            last_google_lat: issue.google_lat,
            last_google_lng: issue.google_lng,
            last_shopee_lat: issue.shopee_lat,
            last_shopee_lng: issue.shopee_lng,
            confidence_score: confidence,
            status: 'PENDING'
          })
          .select()
          .single()

        if (newSugg && config.auto_learning_enabled && autoApprovedCountThisRun < 20) {
          const evalSugg = { ...newSugg, location_type: issue.location_type || 'UNKNOWN' };
          if (shouldAutoApprove(evalSugg, config, isBlacklisted)) {
            await autoApproveSuggestion(evalSugg, supabase)
            autoApprovedCountThisRun++
          }
        }

        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, updatedCount })
  } catch (err: any) {
    console.error('API Audit Suggestions Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
