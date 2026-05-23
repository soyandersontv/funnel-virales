const SUPABASE_URL = 'https://tvhpckppucijwkqidoaz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_78EPH7DNHS_ngIQj3WbnOQ_bAEn58f4';
const AC_URL       = 'https://infoeleiallc.api-us1.com';
const AC_KEY       = '22667ecf0f430d5432bad5d574be70cb7c40115df38c2e80f3183b55646c7e4007304fa1';
const AC_LIST      = 13;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nombre, email, telefono } = req.body || {};

  if (!nombre || !email || !telefono) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  // 1. Insert lead into Supabase
  const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ nombre, email, telefono }),
  });

  // 409 = duplicate email (unique constraint), still OK — continue to AC sync
  if (!sbRes.ok && sbRes.status !== 409) {
    return res.status(500).json({ error: 'Database error' });
  }

  // 2. Sync contact to ActiveCampaign
  const acSync = await fetch(`${AC_URL}/api/3/contact/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Token': AC_KEY,
    },
    body: JSON.stringify({
      contact: { email, firstName: nombre, phone: telefono },
    }),
  });

  if (acSync.ok) {
    const acData  = await acSync.json();
    const contactId = acData.contact?.id;

    if (contactId) {
      // 3. Add contact to list "El siguiente nivel" (ID 13)
      await fetch(`${AC_URL}/api/3/contactLists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Token': AC_KEY,
        },
        body: JSON.stringify({
          contactList: { list: AC_LIST, contact: contactId, status: 1 },
        }),
      });
    }
  }

  return res.status(200).json({ ok: true });
};
