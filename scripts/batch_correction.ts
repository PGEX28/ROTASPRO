
import fs from 'fs';
import path from 'path';

// Carregar variáveis de ambiente manualmente de .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const envLines = envContent.split('\n');
const env: Record<string, string> = {};
envLines.forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length > 0) env[key.trim()] = vals.join('=').trim();
});

const GOOGLE_MAPS_API_KEY = env.GOOGLE_MAPS_API_KEY;

type InputRow = { address: string; cep: string };
type Result = {
  original: string;
  cep: string;
  standardized: string;
  lat: number;
  lng: number;
  location_type: string;
  formatted_address: string;
};

async function fetchCep(cep: string) {
  const clean = cep.replace(/\D/g, '');
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  return await res.json();
}

async function geocode(address: string) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}&region=br&language=pt-BR`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results?.[0];
}

function expandAbbreviations(text: string): string {
  let clean = text.toLowerCase();
  const expansions: [RegExp, string][] = [
    [/\br[.\s]+/g, 'rua '],
    [/\bav[.\s]+/g, 'avenida '],
    [/\bsrv[.\s]+/g, 'servidão '],
    [/\brod[.\s]+/g, 'rodovia '],
    [/\bn\s+sra[.\s]+/g, 'nossa senhora '],
    [/\bns[.\s]+/g, 'nossa senhora '],
    [/\bdr[.\s]+/g, 'doutor '],
    [/\bprof[.\s]+/g, 'professor '],
  ];
  expansions.forEach(([re, rep]) => { clean = clean.replace(re, rep) });
  return clean;
}

async function main() {
  const inputPath = path.resolve(process.argv[2]);
  const data: InputRow[] = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const results: Result[] = [];

  console.log(`--- Iniciando Processamento de ${data.length} endereços ---`);

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    console.log(`[${i+1}/${data.length}] Processando: ${item.address}`);

    try {
      // 1. ViaCEP
      const cepInfo = await fetchCep(item.cep);
      const streetOfficial = cepInfo.logradouro || '';
      
      // 2. Extrair número do original
      const numMatch = item.address.match(/(\d+)/);
      const num = numMatch ? numMatch[1] : '';

      // 3. Endereço Refinado
      const standardized = streetOfficial ? `${streetOfficial}, ${num}` : expandAbbreviations(item.address);
      const query = `${standardized}, ${cepInfo.localidade || ''}, SC, Brazil`;

      // 4. Google Maps
      const gResult = await geocode(query);

      if (gResult) {
        results.push({
          original: item.address,
          cep: item.cep,
          standardized: standardized,
          lat: gResult.geometry.location.lat,
          lng: gResult.geometry.location.lng,
          location_type: gResult.geometry.location_type,
          formatted_address: gResult.formatted_address
        });
      } else {
        console.warn(`!!! Falha ao geocodificar: ${query}`);
      }
      
      // Pequeno delay para evitar Rate Limit e ser gentil com as APIs
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      console.error(`Erro no item ${i}:`, err);
    }
  }

  // Salvar resultado
  const outputPath = inputPath.replace('input_data.json', 'output_results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  
  console.log(`\n--- Processamento Concluído! ---`);
  console.log(`Resultados salvos em: ${outputPath}`);
}

main().catch(console.error);
