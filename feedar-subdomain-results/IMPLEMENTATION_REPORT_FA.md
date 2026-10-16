# گزارش جداسازی Hostname و Login

تاریخ: ۱۶ اکتبر ۲۰۲۶. شاخه `feedar-demo`، مبنا `b873771`، تغییرات قبلی حفظ شدند. هیچ commit، push، deploy، تغییر VPS یا بازنشانی IndexedDB انجام نشد.

## انجام‌شده

- `src/app/runtime.ts`: تعیین دقیق سطح `boss`، `app`، `demo` یا `unconfigured` از Origin و تنظیمات `VITE_BOSS_ORIGIN` / `VITE_APP_ORIGIN`؛ هیچ دامنهٔ عملیاتی در کد ثابت نشده است.
- `src/features/auth.tsx`: دو عنوان ورود Boss و سازمان بر پایهٔ همان طرح ظاهری قبلی. در خروجی عملیاتی، فقط Email، Password، Sign in و خطای معتبر یکپارچه‌سازی دیده می‌شود؛ Demo Preview، نقش‌های انتخابی، حساب‌های نمونه و کد عمومی MFA در رابط نیستند.
- `src/app/App.tsx` و `src/main.tsx`: در خروجی Build فقط صفحهٔ ورود قابل دسترسی است؛ مسیرهای داخلی دمو به ورود هدایت می‌شوند. Provider مبتنی بر IndexedDB در خروجی عملیاتی mount نمی‌شود.
- `src/app/context.tsx`: هویت sessionStorage و ورود نمایشی فقط در حالت توسعهٔ localhost معتبر است. تغییر URL یا قرار دادن هویت دمو در browser storage روی Origin عملیاتی دسترسی ایجاد نمی‌کند.
- دمو در `npm run dev` روی localhost باقی مانده تا جریان‌های قبلی Robot Status، Telepresence، Notifications، Support و Boss بدون بازنویسی حفظ و تست شوند.
- `.env.example` و `docs/SUBDOMAIN_ARCHITECTURE.md`: تنظیمات Origin و مرز Backend موردنیاز ثبت شدند.

## بخش‌های انجام‌نشده به علت نبود Backend مشترک

ورود واقعی Boss/Owner/Admin/User، نشست تولیدی، دادهٔ مشترک دو ساب‌دامین، پاسخ بین دو Origin، و مجوز انتقال امنِ کوتاه‌مدت و یک‌بارمصرف Boss هنوز قابل راه‌اندازی نیستند. فرم عملیاتی عمداً گذرواژه را به جایی ارسال یا هویت نمایشی صادر نمی‌کند و خطای روشنِ نبود Provider مرکزی می‌دهد. برنامهٔ فعلی یک بستهٔ static browser-only است؛ backend ربات قدیمی در ریشهٔ مخزن پروژه‌ای جداگانه است و وارد دمو نشد. پیاده‌سازی انتقال با token قابل بازپخش در URL یا با IndexedDB مستقل انجام نشد.

برای انتشار عملیاتی باید Backend احراز هویت و دادهٔ مشترک، مجوزهای سمت سرور، handshake انتقال یک‌بارمصرف، DNS/TLS و Originهای واقعی فراهم و تست شوند. جزئیات قرارداد موردنیاز در `docs/SUBDOMAIN_ARCHITECTURE.md` آمده است.
