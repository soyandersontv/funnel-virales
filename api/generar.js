const KEY  = process.env.HIGGS_API_KEY;
const BASE = 'https://api.higgsfield.ai/v1';

function buildPrompt(name) {
  return `Instagram story, vertical 9:16 format, ultra dark background near pure black (#040008), deep purple cinematic neon atmosphere.

Text layout from top to bottom, centered:
- Small text at top: "⚔ EL SIGUIENTE NIVEL" in soft glowing purple
- Thin neon purple horizontal divider line
- Large bold white glowing text: "YO"
- ENORMOUS bold neon purple gradient text (biggest element): "${name.toUpperCase()}" — gradient from bright lavender at top to deep violet at bottom, intense neon glow, like a neon sign, dominant hero element
- White underline glow beneath the name
- Bold white text: "ESTOY LISTO PARA IR AL"
- Large bold glowing purple text: "SIGUIENTE"
- MASSIVE bold neon violet/purple text: "NIVEL" — second biggest element, heavy neon glow
- Glowing purple neon horizontal divider line
- White square QR code (realistic QR code pattern) centered with soft purple glow behind it
- Small soft purple italic text below QR: "tú también puedes ser parte"
- Tiny faint text at bottom: "elsiguientenivel.com"

Background elements: faint purple circuit board line patterns with dots in all four corners, dense star field (200+ tiny stars), large partial glowing purple/violet planet with bright rim in top-right corner, two subtle radial purple glow clouds.

Aesthetic: cyberpunk neon, dark cinematic Hollywood, professional digital art, purple/violet/lavender palette, intense neon glows, photorealistic light effects, sharp typography`;
}

async function submitJob(name) {
  const r = await fetch(`${BASE}/generate/image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt_image_2',
      prompt: buildPrompt(name),
      aspect_ratio: '9:16',
      resolution: '2k',
      quality: 'medium',
    }),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Higgsfield ${r.status}: ${txt}`);
  }
  return r.json();
}

async function pollJob(jobId, timeoutMs = 50000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(ok => setTimeout(ok, 2500));
    const r = await fetch(`${BASE}/job/${jobId}`, {
      headers: { 'Authorization': `Bearer ${KEY}` },
    });
    if (!r.ok) continue;
    const d = await r.json();
    const status = d.status ?? d.generation?.status;
    if (status === 'completed') {
      return d.results?.rawUrl ?? d.generation?.results?.rawUrl ?? null;
    }
    if (status === 'failed') throw new Error('Generation failed');
  }
  throw new Error('Timeout esperando imagen');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Falta el nombre' });

  try {
    const job  = await submitJob(name.trim());
    const jobId = job.id ?? job.results?.[0]?.id ?? job.generation?.id;
    if (!jobId) throw new Error('No se recibió job ID: ' + JSON.stringify(job));

    const url = await pollJob(jobId);
    if (!url) throw new Error('No se obtuvo URL de imagen');

    return res.status(200).json({ url, jobId });
  } catch (e) {
    console.error('generar error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
