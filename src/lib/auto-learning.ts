import { SupabaseClient } from '@supabase/supabase-js'

export type AutoLearningConfig = {
  auto_learning_enabled: boolean
  min_confidence: number
  min_occurrences: number
  max_avg_distance_km: number
}

// 1. Pega config global (cache pode ser feito em nivel lib ou api call dps, por eqto DB query simples)
export async function getAutoLearningConfig(supabase: SupabaseClient): Promise<AutoLearningConfig> {
  const { data } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single()

  if (data) {
    return {
      auto_learning_enabled: data.auto_learning_enabled,
      min_confidence: data.min_confidence,
      min_occurrences: data.min_occurrences,
      max_avg_distance_km: data.max_avg_distance_km
    }
  }

  // fallback default safety
  return {
    auto_learning_enabled: false,
    min_confidence: 85,
    min_occurrences: 5,
    max_avg_distance_km: 0.2
  }
}

// 2. Score Adaptativo
export function computeAdaptiveScore(correction: any): number {
  const base = correction.confidence || 0;
  const success = correction.success_count || 0;
  const fail = correction.fail_count || 0;
  
  let score = base + (success * 2) - (fail * 5);
  // Penalizar se não usado recentemente poderia ser data atual - last_used > 30d, mas escopo inicial
  return score < 0 ? 0 : score;
}

// 3. Critérios de auto approve
export function shouldAutoApprove(suggestion: any, config: AutoLearningConfig, isBlacklisted: boolean = false): boolean {
  if (isBlacklisted) return false
  if (suggestion.status !== 'PENDING') return false
  if (suggestion.confidence_score < config.min_confidence) return false
  if (suggestion.occurrences < config.min_occurrences) return false
  
  // Regra de precisão espacial forte (Rooftop vs Range)
  if (suggestion.location_type === 'ROOFTOP' && suggestion.avg_distance_km <= 0.2) return true
  if (suggestion.location_type === 'RANGE_INTERPOLATED' && suggestion.avg_distance_km <= 0.1) return true
  
  // Condição mestre (caso não identifique ROOFTOP mas bata no teto dos limites estipulados de config)
  if (!suggestion.location_type && suggestion.avg_distance_km <= config.max_avg_distance_km) return true

  return false
}

// 4. Critérios de auto disable (Safety Fail-fast)
export function shouldAutoDisable(correction: any): boolean {
  const failCount = correction.fail_count || 0;
  const suspect = correction.suspect_count || 0;
  const invalid = correction.invalid_count || 0;
  
  // A distância / rate recente será baseada nos falsos. Risk > 1.5 é metrificado no invalid! 
  // Ou seja, se o failCount >= 3, ele deve matar a correção.
  if (failCount >= 3) {
    return true
  }
  
  // Se acumular mais distâncias grandes de invalid error (> 1.5km na corrida, gera Invalid).
  if (invalid >= 2) {
    return true
  }

  return false
}

// 5. Executa auto approve transacionado/RPC-like
export async function autoApproveSuggestion(suggestion: any, supabaseAdmin: SupabaseClient) {
  // 1. Marca suggestion como auto aprovada
  const updateSugg = supabaseAdmin
    .from('address_suggestions')
    .update({ status: 'AUTO_APPROVED' })
    .eq('id', suggestion.id)

  // 2. Insere na corrections table com flags
  const insertCorr = supabaseAdmin
    .from('address_corrections')
    .insert({
      normalized_address: suggestion.normalized_address,
      corrected_lat: suggestion.last_google_lat,
      corrected_lng: suggestion.last_google_lng,
      confidence: suggestion.confidence_score,
      location_type: suggestion.location_type,
      is_active: true, // Já torna operacional pro processor dict
      auto_approved: true,
      auto_approved_at: new Date().toISOString(),
      last_auto_action: 'AUTO_APPROVED'
    })

  // 3. Log
  const insertLog = supabaseAdmin
    .from('admin_logs')
    .insert({
      action: 'AUTO_APPROVE',
      address: suggestion.normalized_address,
      confidence_score: suggestion.confidence_score,
      occurrences: suggestion.occurrences,
      distance: suggestion.avg_distance_km,
      metadata: { 
        suggestion_id: suggestion.id, 
        reason: 'HIGH_CONFIDENCE_PATTERN',
        location_type: suggestion.location_type 
      }
    })

  await Promise.all([updateSugg, insertCorr, insertLog])

  console.log('[AUTO-LEARNING]', {
    distance: suggestion.avg_distance_km,
    confidence: suggestion.confidence_score,
    occurrences: suggestion.occurrences,
    location_type: suggestion.location_type
  })
}
