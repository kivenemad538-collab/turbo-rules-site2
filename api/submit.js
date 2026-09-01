const crypto = require('crypto');

const required = [
  'realName','age','discordUsername','discordId','characterName','characterAge',
  'rpExperience','whyTurbo','rdm','vdm','metagaming','powergaming','scenario1','scenario2'
];

function clean(v, max = 3000) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function validDiscordId(id) {
  return /^\d{15,22}$/.test(id);
}

async function saveSupabase(application) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { skipped: true };

  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/applications`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(application)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return { ok: true };
}

async function notifyBot(application) {
  const endpoint = process.env.BOT_APPLICATION_WEBHOOK_URL;
  if (!endpoint) return { skipped: true };

  const secret = process.env.BOT_APPLICATION_WEBHOOK_SECRET || '';
  const body = JSON.stringify(application);
  const signature = secret
    ? crypto.createHmac('sha256', secret).update(body).digest('hex')
    : '';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature ? { 'X-Turbo-Signature': signature } : {})
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bot endpoint ${res.status}: ${text}`);
  }
  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const data = {};
    for (const key of required) data[key] = clean(body[key]);
    data.extra = clean(body.extra || '');

    for (const key of required) {
      if (!data[key]) return res.status(400).json({ ok: false, error: `الحقل ${key} مطلوب` });
    }
    if (!/^\d{1,2}$/.test(data.age) || Number(data.age) < 13 || Number(data.age) > 99) {
      return res.status(400).json({ ok: false, error: 'العمر غير صحيح' });
    }
    if (!validDiscordId(data.discordId)) {
      return res.status(400).json({ ok: false, error: 'Discord ID غير صحيح' });
    }
    if (body.acceptRules !== true) {
      return res.status(400).json({ ok: false, error: 'يجب الموافقة على قوانين السيرفر' });
    }

    const application = {
      application_id: `TR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      status: 'pending',
      created_at: new Date().toISOString(),
      real_name: data.realName,
      age: Number(data.age),
      discord_username: data.discordUsername,
      discord_id: data.discordId,
      character_name: data.characterName,
      character_age: data.characterAge,
      rp_experience: data.rpExperience,
      why_turbo: data.whyTurbo,
      rdm: data.rdm,
      vdm: data.vdm,
      metagaming: data.metagaming,
      powergaming: data.powergaming,
      scenario_1: data.scenario1,
      scenario_2: data.scenario2,
      extra: data.extra,
      source: 'turbo-rp-application-site'
    };

    let saved = false;
    let botNotified = false;
    try { const r = await saveSupabase(application); saved = !!r.ok; } catch (e) { console.error(e); }
    try { const r = await notifyBot(application); botNotified = !!r.ok; } catch (e) { console.error(e); }

    if (!saved && !botNotified && (process.env.SUPABASE_URL || process.env.BOT_APPLICATION_WEBHOOK_URL)) {
      return res.status(502).json({ ok: false, error: 'تعذر إرسال التقديم حاليًا. حاول مرة أخرى.' });
    }

    return res.status(200).json({
      ok: true,
      applicationId: application.application_id,
      message: 'تم استلام تقديمك بنجاح',
      integration: { saved, botNotified }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'حدث خطأ غير متوقع' });
  }
};
