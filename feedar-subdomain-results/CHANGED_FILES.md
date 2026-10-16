# فایل‌های این مرحله

- `feedar-demo/src/app/runtime.ts` — تشخیص Origin و تنظیمات
- `feedar-demo/src/features/auth.tsx` — صفحات ورود Boss/App و حفظ ورود دمو فقط در توسعه
- `feedar-demo/src/app/App.tsx` — جداسازی مسیرها و حذف Demo Preview از سطح عملیاتی
- `feedar-demo/src/app/context.tsx` — محدودسازی هویت نمایشی به توسعه
- `feedar-demo/src/main.tsx` — حذف mount شدن DemoProvider روی Origin عملیاتی
- `feedar-demo/src/test/runtime.test.ts` — تست نگاشت Hostname
- `feedar-demo/scripts/verify-static.mjs` — بررسی Build عملیاتی در مسیر ریشه و زیرمسیر
- `feedar-demo/.env.example` — نمونه تنظیمات Origin
- `feedar-demo/docs/SUBDOMAIN_ARCHITECTURE.md` — معماری و وابستگی Backend

هیچ فایل firmware، backend قدیمی یا دادهٔ runtime تغییر نکرد.
