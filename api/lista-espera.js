const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tvhpckppucijwkqidoaz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_78EPH7DNHS_ngIQj3WbnOQ_bAEn58f4';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { nombre, email, telefono } = req.body || {};
  if (!nombre || !email) return res.status(400).json({ error: 'Faltan campos' });

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/lista_de_espera`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ nombre, email, telefono }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('Supabase error:', r.status, err);
      return res.status(500).json({ error: 'Error al guardar' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
