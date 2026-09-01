const crypto = require('crypto');

const required = [
  'realName','age','discordUsername','discordId','characterName','characterAge',
  'rpExperience','whyTurbo','rdm','vdm','metagaming','powergaming','scenario1','scenario2'
];
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

function clean(v, max = 3000) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}
function validDiscordId(id) { return /^\d{15,22}$/.test(id); }
function sb() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED');
  return { url, key, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}
async function sbFetch(path, options = {}) {
  const {url, headers} = sb();
  return fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
}
async function getState(discordId) {
  const q = `applications?discord_id=eq.${encodeURIComponent(discordId)}&select=application_id,status,created_at,decided_at,rejection_reason&order=created_at.desc&limit=25`;
  const res = await sbFetch(q);
  if (!res.ok) throw new Error(`Supabase lookup ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  const accepted = rows.find(r => r.status === 'accepted');
  if (accepted) return { kind: 'accepted', row: accepted };
  const pending = rows.find(r => r.status === 'pending');
  if (pending) return { kind: 'pending', row: pending };
  const rejected = rows.find(r => r.status === 'rejected');
  if (rejected) {
    const base = new Date(rejected.decided_at || rejected.created_at).getTime();
    const retryAt = base + COOLDOWN_MS;
    if (Date.now() < retryAt) return { kind: 'cooldown', row: rejected, retryAt };
    return { kind: 'eligible', row: rejected };
  }
  return { kind: 'eligible', row: null };
}
async function insertApplication(application) {
  const res = await sbFetch('applications', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', Prefer:'return=minimal' },
    body: JSON.stringify(application)
  });
  if (!res.ok) throw new Error(`Supabase insert ${res.status}: ${await res.text()}`);
}
async function rollbackApplication(applicationId) {
  try {
    await sbFetch(`applications?application_id=eq.${encodeURIComponent(applicationId)}&status=eq.pending`, { method:'DELETE' });
  } catch (_) {}
}
async function notifyBot(application) {
  const endpoint = process.env.BOT_APPLICATION_WEBHOOK_URL;
  if (!endpoint) throw new Error('BOT_WEBHOOK_NOT_CONFIGURED');
  const secret = process.env.BOT_APPLICATION_WEBHOOK_SECRET || '';
  const body = JSON.stringify(application);
  const signature = secret ? crypto.createHmac('sha256', secret).update(body).digest('hex') : '';
  const res = await fetch(endpoint, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', ...(signature ? {'X-Turbo-Signature':signature}:{}) },
    body
  });
  if (!res.ok) throw new Error(`Bot endpoint ${res.status}: ${await res.text()}`);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Method not allowed'});
  try {
    const body = req.body || {};
    const data = {};
    for (const key of required) data[key] = clean(body[key]);
    data.extra = clean(body.extra || '');
    for (const key of required) if (!data[key]) return res.status(400).json({ok:false,error:`الحقل ${key} مطلوب`});
    if (!/^\d{1,2}$/.test(data.age) || Number(data.age) < 13 || Number(data.age) > 99) return res.status(400).json({ok:false,error:'العمر غير صحيح'});
    if (!validDiscordId(data.discordId)) return res.status(400).json({ok:false,error:'Discord ID غير صحيح'});
    if (body.acceptRules !== true) return res.status(400).json({ok:false,error:'يجب الموافقة على قوانين السيرفر'});

    const state = await getState(data.discordId);
    if (state.kind === 'pending') return res.status(409).json({ok:false,code:'PENDING',error:'لديك تقديم قيد المراجعة بالفعل.',applicationId:state.row.application_id,status:'pending'});
    if (state.kind === 'accepted') return res.status(409).json({ok:false,code:'ACCEPTED',error:'تم قبولك بالفعل ولا يمكنك تقديم طلب جديد.',applicationId:state.row.application_id,status:'accepted'});
    if (state.kind === 'cooldown') return res.status(429).json({ok:false,code:'COOLDOWN',error:'تم رفض تقديمك مؤخرًا. يمكنك التقديم مرة أخرى بعد مرور 12 ساعة.',status:'rejected',reason:state.row.rejection_reason || 'لم يتم تحديد سبب',retryAt:new Date(state.retryAt).toISOString()});

    const application = {
      application_id:`TR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      status:'pending', created_at:new Date().toISOString(),
      real_name:data.realName, age:Number(data.age), discord_username:data.discordUsername,
      discord_id:data.discordId, character_name:data.characterName, character_age:data.characterAge,
      rp_experience:data.rpExperience, why_turbo:data.whyTurbo, rdm:data.rdm, vdm:data.vdm,
      metagaming:data.metagaming, powergaming:data.powergaming, scenario_1:data.scenario1,
      scenario_2:data.scenario2, extra:data.extra, source:'turbo-rp-application-site'
    };

    try { await insertApplication(application); }
    catch (e) {
      if (String(e.message).includes('duplicate key')) return res.status(409).json({ok:false,error:'لديك تقديم مفتوح أو تم قبولك بالفعل.'});
      throw e;
    }
    try { await notifyBot(application); }
    catch (e) { await rollbackApplication(application.application_id); throw e; }

    return res.status(200).json({ok:true,applicationId:application.application_id,status:'pending',message:'تم استلام تقديمك وهو الآن قيد المراجعة'});
  } catch (err) {
    console.error(err);
    const m = String(err && err.message || err);
    if (m.includes('SUPABASE_NOT_CONFIGURED') || m.includes('BOT_WEBHOOK_NOT_CONFIGURED')) {
      return res.status(500).json({ok:false,error:'ربط الموقع غير مكتمل. راجع Environment Variables في Vercel.'});
    }
    return res.status(500).json({ok:false,error:'تعذر إرسال التقديم حاليًا. حاول مرة أخرى.'});
  }
};
