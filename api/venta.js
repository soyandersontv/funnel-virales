const SUPABASE_URL = 'https://tvhpckppucijwkqidoaz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_78EPH7DNHS_ngIQj3WbnOQ_bAEn58f4';
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK || '';
const STARTING_COUNT = 9;
const GOAL = 100;

const MENSAJES = [
  (v, n, t, f) => `🔥 *¡${n} entró al Siguiente Nivel!* Vendido por *${v}*. Llevamos *${t}/${GOAL}* ventas. Faltan *${f}* para cerrar. ¡VAMOS EQUIPO!`,
  (v, n, t, f) => `💜 ¡Nueva venta de *${v}*! *${t} de ${GOAL}*. El equipo está imparable 🚀 ¡${f} más y lo cerramos!`,
  (v, n, t, f) => `⚡ *${v}* cerró otra! *${n}* adentro. Ya somos *${t}/${GOAL}*. Solo faltan *${f}* — ¡nadie los para!`,
  (v, n, t, f) => `🏆 *${t}/${GOAL}* ventas completadas. *${v}* sumó una más. Faltan *${f}* — ¡a romperlo equipo!`,
  (v, n, t, f) => `🚀 *¡VENTA #${t}!* ${v} cerró con ${n}. Faltan *${f}* para la meta. ¡CERREMOS ESTO!`,
  (v, n, t, f) => `💥 *¡BOOM!* *${v}* lo hizo de nuevo. *${t} de ${GOAL}*. ¡${f} más y somos historia!`,
  (v, n, t, f) => `🎯 *${n}* dijo SÍ gracias a *${v}*. *${t}/${GOAL}* ventas. ¡${f} más y el equipo lo logra!`,
  (v, n, t, f) => `🔑 *${v}* entregó otra llave del Siguiente Nivel. *${t}/${GOAL}*. Faltan *${f}*. ¡El equipo no para!`,
];

function getMensajeCierre(t) {
  if (t >= GOAL) return `🏆🏆🏆 *¡META ALCANZADA! ${t}/${GOAL} VENTAS!* ¡El equipo lo logró! ¡CELEBREMOS! 🎉🎉🎉`;
  const pct = Math.round((t / GOAL) * 100);
  if (pct >= 90) return `🔥🔥 *¡${t}/${GOAL}!* Estamos al ${pct}%. ¡ESTAMOS A PUNTO DE CERRAR! ¡TODOS A VENDER!`;
  if (pct >= 75) return `💜 *${t}/${GOAL}* — ¡${pct}% completado! El equipo está en modo bestia. ¡Empuje final!`;
  return null;
}

async function getCount() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/ventas?select=id`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'count=exact',
        'Range': '0-0',
      },
    });
    const cr = r.headers.get('content-range') || '0-0/0';
    return parseInt(cr.split('/')[1]) || 0;
  } catch { return 0; }
}

async function sendSlack(text) {
  if (!SLACK_WEBHOOK) return;
  try {
    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const db = await getCount();
    const total = db + STARTING_COUNT;
    const faltan = Math.max(0, GOAL - total);
    const pct = Math.min(100, Math.round((total / GOAL) * 100));
    return res.status(200).json({ total, goal: GOAL, faltan, pct });
  }

  if (req.method === 'POST') {
    const { vendedor, nombre, celular } = req.body || {};
    if (!vendedor || !nombre || !celular) return res.status(400).json({ error: 'Faltan campos' });

    await fetch(`${SUPABASE_URL}/rest/v1/ventas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ vendedor, nombre, celular }),
    });

    const db = await getCount();
    const total = db + STARTING_COUNT;
    const faltan = Math.max(0, GOAL - total);
    const pct = Math.min(100, Math.round((total / GOAL) * 100));

    const msgFn = MENSAJES[Math.floor(Math.random() * MENSAJES.length)];
    let slack = getMensajeCierre(total) || msgFn(vendedor, nombre, total, faltan);
    await sendSlack(slack);

    return res.status(200).json({ total, goal: GOAL, faltan, pct, slack });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
