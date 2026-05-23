const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tvhpckppucijwkqidoaz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_78EPH7DNHS_ngIQj3WbnOQ_bAEn58f4';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  const record = {
    nombre: body.nombre,
    email: body.email,
    tiempo_segundos: body.tiempoSegundos,
    tiempo_formato: body.tiempoFormato,
    timeout: body.timeout || false,
    mcq_correctas: body.mcqCorrectas,
    mcq_total: body.mcqTotal,
    mcq_porcentaje: body.mcqPorcentaje,
    abiertas_completas: body.abiertasCompletas,
    abiertas_total: body.abiertasTotal,
    score_ponderado: body.scorePonderado,
    flag_ia: body.flagIA || false,
    veredicto: body.veredicto,
    respuestas: body.respuestas || {},
  };

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/prueba_trafficker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(record),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('Supabase error:', r.status, errText);
      return res.status(500).json({ error: 'Error al guardar en base de datos' });
    }

    const data = await r.json();
    return res.status(200).json({ success: true, id: Array.isArray(data) ? data[0]?.id : data?.id });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
