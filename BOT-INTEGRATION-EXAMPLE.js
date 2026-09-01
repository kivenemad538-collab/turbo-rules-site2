// Turbo RP Applications integration for an existing discord.js v14 + Express bot.
// 1) npm i express discord.js
// 2) registerTurboApplications(app, client) once after your client is ready.
// 3) Set the environment variables from .env.example.
const crypto = require('crypto');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');

const CHANNEL_ID = process.env.APPLICATIONS_CHANNEL_ID || '1522093061759438927';

function verifySignature(req) {
  const secret = process.env.TURBO_APPLICATION_SECRET || '';
  if (!secret) return false;
  const sent = String(req.header('X-Turbo-Signature') || '');
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body || {})).digest('hex');
  if (!sent || sent.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}
function isReviewer(interaction) {
  const ids = (process.env.TURBO_REVIEWER_ROLE_IDS || '').split(',').map(x=>x.trim()).filter(Boolean);
  if (!ids.length) return true; // اعتمد على صلاحيات الروم لو لم تحدد رولات
  return ids.some(id => interaction.member?.roles?.cache?.has(id));
}
function sb() {
  const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!url||!key) throw new Error('Supabase env missing in bot');
  return {url,key,headers:{apikey:key,Authorization:`Bearer ${key}`}};
}
async function updateApplication(applicationId, patch) {
  const {url,headers}=sb();
  const r=await fetch(`${url}/rest/v1/applications?application_id=eq.${encodeURIComponent(applicationId)}&status=eq.pending`,{
    method:'PATCH',headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(patch)
  });
  if(!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const rows=await r.json();
  if(!rows.length) throw new Error('Application is not pending anymore');
  return rows[0];
}
function buttons(a){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`turbo_accept:${a.application_id}:${a.discord_id}`).setLabel('قبول').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`turbo_reject:${a.application_id}:${a.discord_id}`).setLabel('رفض').setStyle(ButtonStyle.Danger)
  );
}
function disabledButtons(){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('turbo_done_accept').setLabel('تم اتخاذ القرار').setStyle(ButtonStyle.Secondary).setDisabled(true)
  );
}
function field(name,value,inline=false){return {name,value:String(value||'—').slice(0,1024),inline};}

function registerTurboApplications(app, client) {
  app.post('/api/turbo-application', async (req,res)=>{
    try{
      if(!verifySignature(req)) return res.status(401).send('invalid signature');
      const a=req.body;
      const channel=await client.channels.fetch(CHANNEL_ID);
      if(!channel?.isTextBased()) return res.status(500).send('application channel is not text based');
      const embed=new EmbedBuilder()
        .setColor(0x159bff)
        .setTitle(`تقديم جديد · ${a.application_id}`)
        .setDescription(`الحالة: **قيد المراجعة**\nالمتقدم: <@${a.discord_id}>`)
        .addFields(
          field('الاسم الحقيقي',a.real_name,true), field('العمر',a.age,true),
          field('Discord',`${a.discord_username}\n${a.discord_id}`,true),
          field('الشخصية',`${a.character_name} · ${a.character_age}`,true),
          field('خبرة RP',a.rp_experience), field('لماذا Turbo؟',a.why_turbo),
          field('RDM',a.rdm), field('VDM',a.vdm), field('Meta Gaming',a.metagaming), field('Power Gaming',a.powergaming),
          field('سيناريو 1',a.scenario_1), field('سيناريو 2',a.scenario_2), field('ملاحظات',a.extra||'لا يوجد')
        ).setTimestamp(new Date(a.created_at));
      await channel.send({embeds:[embed],components:[buttons(a)]});
      return res.json({ok:true});
    }catch(e){console.error('[Turbo applications webhook]',e);return res.status(500).send('bot error');}
  });

  client.on('interactionCreate', async interaction=>{
    try{
      if(interaction.isButton() && interaction.customId.startsWith('turbo_')){
        if(!isReviewer(interaction)) return interaction.reply({content:'ليس لديك صلاحية مراجعة التقديمات.',ephemeral:true});
        const [action,applicationId,userId]=interaction.customId.split(':');
        if(action==='turbo_accept'){
          await interaction.deferReply({ephemeral:true});
          await updateApplication(applicationId,{status:'accepted',decided_at:new Date().toISOString(),decided_by:interaction.user.id,rejection_reason:null});
          const user=await client.users.fetch(userId).catch(()=>null);
          if(user) await user.send(`✅ **Turbo RP**\nتم قبول تقديمك **${applicationId}**.\nتابع مواعيد المقابلات الصوتية في الموقع قبل التوجه للمقابلة.`).catch(()=>{});
          const old=interaction.message.embeds[0];
          const edited=EmbedBuilder.from(old).setColor(0x28c76f).setDescription(`الحالة: **مقبول** ✅\nالمتقدم: <@${userId}>\nتمت المراجعة بواسطة: <@${interaction.user.id}>`);
          await interaction.message.edit({embeds:[edited],components:[disabledButtons()]});
          return interaction.editReply('تم قبول التقديم وإرسال رسالة خاصة للمتقدم.');
        }
        if(action==='turbo_reject'){
          const modal=new ModalBuilder().setCustomId(`turbo_reject_modal:${applicationId}:${userId}`).setTitle('رفض تقديم Turbo RP');
          const reason=new TextInputBuilder().setCustomId('reason').setLabel('سبب الرفض').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(500).setPlaceholder('اكتب سبب الرفض بوضوح...');
          modal.addComponents(new ActionRowBuilder().addComponents(reason));
          return interaction.showModal(modal);
        }
      }
      if(interaction.isModalSubmit() && interaction.customId.startsWith('turbo_reject_modal:')){
        if(!isReviewer(interaction)) return interaction.reply({content:'ليس لديك صلاحية مراجعة التقديمات.',ephemeral:true});
        const [,applicationId,userId]=interaction.customId.split(':');
        const reason=interaction.fields.getTextInputValue('reason').trim();
        await interaction.deferReply({ephemeral:true});
        await updateApplication(applicationId,{status:'rejected',decided_at:new Date().toISOString(),decided_by:interaction.user.id,rejection_reason:reason});
        const user=await client.users.fetch(userId).catch(()=>null);
        if(user) await user.send(`❌ **Turbo RP**\nتم رفض تقديمك **${applicationId}**.\n**السبب:** ${reason}\nيمكنك التقديم مرة أخرى بعد **12 ساعة** من وقت الرفض.`).catch(()=>{});
        const old=interaction.message.embeds[0];
        const edited=EmbedBuilder.from(old).setColor(0xff4d5e).setDescription(`الحالة: **مرفوض** ❌\nالمتقدم: <@${userId}>\n**السبب:** ${reason}\nتمت المراجعة بواسطة: <@${interaction.user.id}>`);
        await interaction.message.edit({embeds:[edited],components:[disabledButtons()]});
        return interaction.editReply('تم رفض التقديم وإرسال السبب للمتقدم في الخاص.');
      }
    }catch(e){
      console.error('[Turbo applications interaction]',e);
      if(interaction.deferred||interaction.replied) await interaction.editReply('حصل خطأ أثناء تنفيذ القرار.').catch(()=>{});
      else await interaction.reply({content:'حصل خطأ أثناء تنفيذ القرار.',ephemeral:true}).catch(()=>{});
    }
  });
}

module.exports={registerTurboApplications};
