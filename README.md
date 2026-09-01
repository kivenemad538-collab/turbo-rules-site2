# Turbo RP Applications V1

موقع تقديم مستقل وجاهز لـ Vercel.

## النشر
ارفع الملفات كما هي إلى GitHub ثم Import في Vercel.
Framework Preset: Other
Root Directory: .
لا يوجد Next.js ولا مجلد pages/app، وبالتالي لا يظهر خطأ Next السابق.

## الربط
1. لو تريد حفظ التقديمات في Supabase: نفذ supabase.sql وضع SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel Environment Variables.
2. لو تريد إرسال التقديم للبوت فورًا: شغل endpoint في البوت مثل المثال BOT-INTEGRATION-EXAMPLE.js، ثم ضع رابط endpoint في BOT_APPLICATION_WEBHOOK_URL.
3. ضع نفس secret في Vercel باسم BOT_APPLICATION_WEBHOOK_SECRET وفي البوت باسم TURBO_APPLICATION_SECRET.

## ملاحظة
لو تركت Supabase و Bot endpoint فارغين، الفورم سيعرض نجاحًا للتجربة فقط ولن يكون هناك تخزين دائم. قبل فتح التقديمات للعامة اربط واحدًا منهما على الأقل.
