# گزارش حذف Demo Switcher و حساب‌های نمونه

تاریخ: ۱۶ اکتبر ۲۰۲۶. هیچ commit، push یا deploy انجام نشد.

## تغییرات

- `feedar-demo/src/app/App.tsx`: کامپوننت `Switcher` و رندر `<Switcher/>` از React حذف شدند.
- `feedar-demo/src/features/auth.tsx`: بخش `.demo-accounts`، دکمه‌های انتخاب Boss/Owner/Admin/User، متن رمز نمونه و فرم بازنشانی نمایشی حذف شدند؛ ورود دمو با وارد کردن دستی ایمیل و رمز Fixture همچنان کار می‌کند.
- `feedar-demo/src/styles/global.css` و `src/features/fleet.css`: قواعد اختصاصی کنترل‌های حذف‌شده پاک شدند؛ کلاس عمومی `.grid-2` حفظ شد.
- `feedar-demo/e2e/helpers/demo-login.ts` و تست‌های Playwright وابسته: انتخاب نقش با کلیک Switcher به ورود از فرم با Fixtureهای مجاز تغییر کرد.
- `feedar-demo/e2e/no-demo-controls.spec.ts` و `scripts/verify-demo-removal.mjs`: بررسی نبود عناصر در DOM و مسیرهای محافظت‌شده.
- `feedar-demo/README.md` و `docs/FEATURE_CHECKLIST.md` و `docs/SUBDOMAIN_ARCHITECTURE.md`: مستندات مطابق رابط فعلی اصلاح شدند.

## بررسی مرورگر

بررسی اختصاصی Chrome روی Boss/Organization در Development و Build، هر یک در دسکتاپ 1440×900 و موبایل 390×844، ۱۶ بررسی موفق داشت. در تمام صفحه‌های ورود، شمار `aside.demo-switcher`، `.demo-accounts` و `#root > aside` صفر بود؛ متن‌های «Demo preview» و «Use a demo account» نیز نبودند. مسیر محافظت‌شده به ورود هدایت شد و سرریز افقی دیده نشد. هشت اسکرین‌شات در `screenshots/` ذخیره و چهار نمای شاخص به‌صورت بصری بررسی شد.

TypeScript، ESLint، ۸۷ تست واحد و Build موفق بودند. مجموعهٔ کامل Playwright: ۳۱ موفق، ۰ ناموفق. بررسی ایستای Build روی `/` و `/base-check/` موفق شد. یک اجرای میانی از تست هفت اندازه به‌دلیل ورود تکراری Fixture به timeout خورد؛ تست اصلاح و سپس مجموعهٔ کامل دوباره با موفقیت اجرا شد.

## محدودیت

احراز هویت عملیاتی هنوز Backend مشترک ندارد؛ صفحه‌های Boss و Organization فرم جداگانه دارند، ولی دسترسی واقعی صادر نمی‌کنند. نقش‌ها در دمو از هویت Fixture بعد از ورود تعیین می‌شوند؛ این احراز هویت تولیدی نیست. Node محلی 26.5.1 بود، در حالی که پروژه Node 24 LTS را توصیه می‌کند.
