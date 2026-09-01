const COOLDOWN_MS = 12 * 60 * 60 * 1000;
function validDiscordId(id){return /^\d{15,22}$/.test(id||'')}
function sb(){
  const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!url||!key) throw new Error('SUPABASE_NOT_CONFIGURED');
  return {url,key};
}
module.exports=async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const discordId=String(req.query.discordId||'').trim();
    if(!validDiscordId(discordId)) return res.status(400).json({ok:false,error:'Discord ID غير صحيح'});
    const {url,key}=sb();
    const r=await fetch(`${url}/rest/v1/applications?discord_id=eq.${encodeURIComponent(discordId)}&select=application_id,status,created_at,decided_at,rejection_reason&order=created_at.desc&limit=25`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
    if(!r.ok) throw new Error(await r.text());
    const rows=await r.json();
    const accepted=rows.find(x=>x.status==='accepted');
    if(accepted) return res.json({ok:true,status:'accepted',applicationId:accepted.application_id,message:'تم قبولك بالفعل.'});
    const pending=rows.find(x=>x.status==='pending');
    if(pending) return res.json({ok:true,status:'pending',applicationId:pending.application_id,message:'تقديمك قيد المراجعة.'});
    const rejected=rows.find(x=>x.status==='rejected');
    if(rejected){
      const base=new Date(rejected.decided_at||rejected.created_at).getTime();
      const retryAt=base+COOLDOWN_MS;
      return res.json({ok:true,status:'rejected',applicationId:rejected.application_id,reason:rejected.rejection_reason||'لم يتم تحديد سبب',retryAt:new Date(retryAt).toISOString(),canReapply:Date.now()>=retryAt});
    }
    return res.json({ok:true,status:'none',canReapply:true});
  }catch(e){console.error(e);return res.status(500).json({ok:false,error:'تعذر تحميل حالة التقديم'});}
};
