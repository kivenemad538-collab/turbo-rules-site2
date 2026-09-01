# Turbo RP Applications V1.4

موقع التقديم المرتبط ببوت المراجعة.

## Vercel
Framework Preset: **Other**  
Root Directory: `.`  
لا تضع Build Command أو Output Directory.

أضف Environment Variables من `.env.example`.

## Supabase
افتح SQL Editor ونفّذ `supabase.sql` مرة واحدة.

## الربط مع البوت
بعد نشر البوت على Railway وتفعيل Public Domain، ضع في Vercel:

`BOT_APPLICATION_WEBHOOK_URL=https://YOUR-DOMAIN.up.railway.app/api/turbo-application`

واجعل `BOT_APPLICATION_WEBHOOK_SECRET` في Vercel مطابقًا لـ `TURBO_APPLICATION_SECRET` في Railway.

## السلوك
- Pending: لا يمكن التقديم مرة ثانية.
- Accepted: لا يمكن التقديم مرة ثانية نهائيًا.
- Rejected: يظهر سبب الرفض، ويمكن إعادة التقديم بعد 12 ساعة.
- حالة التقديم تُعرض تلقائيًا على نفس الجهاز بعد أول تقديم، ويمكن فحصها يدويًا بـ Discord ID.
