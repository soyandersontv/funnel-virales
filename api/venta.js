const SUPABASE_URL = 'https://tvhpckppucijwkqidoaz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_78EPH7DNHS_ngIQj3WbnOQ_bAEn58f4';
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK || '';
const TABLE = 'ventas_unicornio';
const GOAL = 90;

const MENSAJES = [
  (v, n, t, f) => `🔥 *¡${n} entró al Método Unicornio!* Vendido por *${v}*. Llevamos *${t}/${GOAL}*. Faltan *${f}*. ¡VAMOS EQUIPO!`,
  (v, n, t, f) => `💜 ¡Nueva venta de *${v}*! *${t} de ${GOAL}*. El equipo está imparable 🚀 ¡${f} más y lo cerramos!`,
  (v, n, t, f) => `⚡ *${v}* cerró otra! *${n}* adentro. Ya somos *${t}/${GOAL}*. Solo faltan *${f}* ¡nadie los para!`,
  (v, n, t, f) => `🏆 *${t}/${GOAL}* ventas. *${v}* sumó una más. Faltan *${f}* ¡a romperlo equipo!`,
  (v, n, t, f) => `🚀 *¡VENTA #${t}!* ${v} cerró con ${n}. Faltan *${f}* para la meta. ¡CERREMOS ESTO!`,
  (v, n, t, f) => `💥 *¡BOOM!* *${v}* lo hizo de nuevo. *${t} de ${GOAL}*. ¡${f} más y somos historia!`,
  (v, n, t, f) => `🎯 *${n}* dijo SÍ gracias a *${v}*. *${t}/${GOAL}*. ¡${f} más y el equipo lo logra!`,
  (v, n, t, f) => `🦄 *${v}* entregó otro Unicornio. *${t}/${GOAL}*. Faltan *${f}*. ¡El equipo no para!`,
];

function getMensajeCierre(t) {
  if (t >= GOAL) return `🦄🏆🦄 *¡META ALCANZADA! ${t}/${GOAL} VENTAS!* ¡El equipo lo logró con el Método Unicornio! ¡CELEBREMOS! 🎉🎉🎉`;
  const pct = Math.round((t / GOAL) * 100);
  if (pct >= 90) return `🔥🔥 *¡${t}/${GOAL}!* Estamos al ${pct}%. ¡A PUNTO DE CERRAR! ¡TODOS A VENDER!`;
  if (pct >= 75) return `💜 *${t}/${GOAL}* ¡${pct}% completado! El equipo está en modo bestia. ¡Empuje final!`;
  return null;
}

async function getCount() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=id`, {
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

// Canonical names — key: lowercase trimmed input, value: display name
const NAME_ALIASES = {
  'fredy': 'Fredy',
  'frey':  'Fredy',
  'yudy':  'Yudy',
};

function canonicalName(raw) {
  if (!raw) return raw;
  const key = raw.trim().toLowerCase();
  return NAME_ALIASES[key] || raw.trim();
}

async function getLeaderboard() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?select=vendedor&limit=1000`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    const rows = await r.json();
    const counts = {};
    rows.forEach(({ vendedor }) => {
      const name = canonicalName(vendedor);
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([vendedor, ventas]) => ({ vendedor, ventas }))
      .sort((a, b) => b.ventas - a.ventas);
  } catch { return []; }
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
    const [total, leaderboard] = await Promise.all([getCount(), getLeaderboard()]);
    const faltan = Math.max(0, GOAL - total);
    const pct = Math.min(100, Math.round((total / GOAL) * 100));
    return res.status(200).json({ total, goal: GOAL, faltan, pct, leaderboard });
  }

  if (req.method === 'POST') {
    const { vendedor: rawVendedor, nombre, celular } = req.body || {};
    if (!rawVendedor || !nombre || !celular) return res.status(400).json({ error: 'Faltan campos' });
    const vendedor = canonicalName(rawVendedor);

    await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ vendedor, nombre, celular }),
    });

    const total = await getCount();
    const faltan = Math.max(0, GOAL - total);
    const pct = Math.min(100, Math.round((total / GOAL) * 100));

    // Conteo personal del vendedor en este lanzamiento
    let vendedorTotal = 0;
    try {
      const vr = await fetch(
        `${SUPABASE_URL}/rest/v1/${TABLE}?vendedor=eq.${encodeURIComponent(vendedor)}&select=id`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'count=exact',
            'Range': '0-0',
          },
        }
      );
      const cr = vr.headers.get('content-range') || '0-0/0';
      vendedorTotal = parseInt(cr.split('/')[1]) || 0;
    } catch {}

    const msgFn = MENSAJES[Math.floor(Math.random() * MENSAJES.length)];
    let slack = getMensajeCierre(total) || msgFn(vendedor, nombre, total, faltan);

    const MILESTONES = { 10: '🔥', 15: '⚡', 20: '💪', 25: '🚀', 30: '💜', 35: '🏆🎁' };
    if (MILESTONES[vendedorTotal]) {
      const emoji = MILESTONES[vendedorTotal];
      const premio = vendedorTotal === 35 ? ' ¡¡GANASTE EL PREMIO!! 🎁🎁🎁' : '';
      slack = `${emoji} *¡¡${vendedor} acaba de cerrar su venta #${vendedorTotal} en el Método Unicornio!!*${premio} ¡El equipo entero lo celebra! ${emoji}`;
    }

    await sendSlack(slack);

    return res.status(200).json({ total, goal: GOAL, faltan, pct, slack, vendedorTotal, vendedor });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
