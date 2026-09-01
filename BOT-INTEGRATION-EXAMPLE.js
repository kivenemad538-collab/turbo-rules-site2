// مثال Express للبوت الحالي. ضعه في البوت وعدل channelId ثم اربط الراوت.
// مهم: لا تضع Bot Token داخل موقع Vercel.
const crypto = require('crypto');

function verifyTurboSignature(req, secret) {
  const sent = req.header('X-Turbo-Signature');
  if (!secret) return true;
  const raw = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return sent && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
}

function registerApplicationRoute(app, client) {
  app.post('/api/turbo-application', async (req, res) => {
    if (!verifyTurboSignature(req, process.env.TURBO_APPLICATION_SECRET)) return res.status(401).send('invalid signature');
    const a = req.body;
    const channel = await client.channels.fetch(process.env.APPLICATIONS_CHANNEL_ID);
    await channel.send({
      embeds: [{
        title: `تقديم جديد · ${a.application_id}`,
        color: 0x159bff,
        fields: [
          { name: 'الاسم الحقيقي', value: a.real_name, inline: true },
          { name: 'Discord', value: `${a.discord_username}\n<@${a.discord_id}>`, inline: true },
          { name: 'الشخصية', value: `${a.character_name} · ${a.character_age}`, inline: true },
          { name: 'خبرة RP', value: a.rp_experience.slice(0,1024) },
          { name: 'لماذا Turbo؟', value: a.why_turbo.slice(0,1024) },
          { name: 'RDM', value: a.rdm.slice(0,1024) },
          { name: 'VDM', value: a.vdm.slice(0,1024) },
          { name: 'Meta Gaming', value: a.metagaming.slice(0,1024) },
          { name: 'Power Gaming', value: a.powergaming.slice(0,1024) }
        ],
        timestamp: a.created_at
      }]
    });
    res.json({ok:true});
  });
}

module.exports = { registerApplicationRoute };
