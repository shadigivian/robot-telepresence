# فایل‌های تغییرکرده

## کد و آزمون در `feedar-demo/`

- `src/app/theme.tsx` — Provider، تشخیص تم سیستم، ذخیرهٔ انتخاب و دکمهٔ تغییر تم.
- `src/main.tsx` — پوشش همهٔ مسیرها با Provider و بارگذاری CSS تم.
- `src/styles/theme.css` — توکن‌ها، تنظیم دو تم، کارت موبایل Robot Status و حرکت‌های کوچک.
- `src/styles/global.css`, `src/styles/management.css`, `src/features/fleet.css` — انتقال رنگ‌های پایه به توکن‌های معنایی.
- `src/styles/operational-login.css`, `src/features/auth.tsx` — اتصال ورود Boss/App و ورود Demo به تم سراسری.
- `src/app/App.tsx` — دکمهٔ تم در پوسته/عمومی و وضعیت مشترک Loading/Error.
- `src/features/management.tsx` — انتخاب System/Light/Dark در Settings.
- `src/components/status-icon.tsx` — رجیستری آیکون وضعیت Lucide.
- `src/components/ui.tsx` — وضعیت خالی/خطا/موفقیت و Loading مشترک.
- `src/features/org-robots.tsx` — آیکون‌های وضعیت واقعی و برچسب کارت موبایل.
- `e2e/theme.spec.ts` — پایداری تم، وضعیت ربات، موبایل و تصاویر بصری.
- `e2e/organization.spec.ts` — حذف پیمایش اضافیِ باعث race در تست دو تب.
- `docs/FEATURE_CHECKLIST.md` — نتیجهٔ واقعی اجرای ۲۰۲۶-۱۰-۱۹.

## نتایج محلی

`feedar-ui-results/`: هفت گزارش خواسته‌شده و ۱۸ تصویر در `screenshots/`. فایل موجود `feedar-demo-removal-results/.DS_Store` از قبل وجود داشت و دست‌نخورده ماند. هیچ فایل رمز، دادهٔ خصوصی، firmware یا backend تغییر نکرد.
