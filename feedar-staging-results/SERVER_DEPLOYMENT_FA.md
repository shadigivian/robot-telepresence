# استقرار نمایشی روی IP

تاریخ: ۱۷ اکتبر ۲۰۲۶ (Asia/Tehran). نسخهٔ سورس: commit `f4d4096e8fec3babe4b86aaa3af7fc0dc6ffb476`.

## نشانی‌ها

- Boss: `https://80.249.113.32/#/login`
- Organization: `https://80.249.113.32:8443/#/login`

دو پورت، دو Origin مستقل دارند. داده و نشست IndexedDB بین آن‌ها مشترک نیست. به درخواست کاربر، دروازهٔ HTTP Basic Auth در ۱۷ اکتبر حذف شد و صفحات بدون رمز سروری باز می‌شوند. فرم ورود خود برنامه باقی است؛ رمز حساب آزمایشی و کد تأیید دمو هر دو `123456` هستند.

## تغییرات سرور

- Certbot 5.8 از Snap نصب شد. گواهی معتبر Let's Encrypt با SAN نوع IP صادر شد؛ پایان اعتبار فعلی ۲۳ اکتبر ۲۰۲۶ است. تایمر Snap برای تمدید فعال است و hook `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx` پس از تمدید، nginx را بررسی و reload می‌کند. `certbot renew --dry-run` موفق بود.
- سورس package در `/opt/feedar-staging-src` با Node 24.21.0 و npm 11.21.0 نصب و با `VITE_STAGING_DEMO=true`، `VITE_BOSS_ORIGIN=https://80.249.113.32` و `VITE_APP_ORIGIN=https://80.249.113.32:8443` Build شد. خروجی در `/var/www/feedar-staging` قرار گرفت.
- تنظیمات جداگانهٔ `/etc/nginx/sites-available/feedar-staging` روی پورت‌های 443 و 8443 فعال شد. سپس خطوط `auth_basic` از همین فایل حذف و credentialهای تولیدشدهٔ دروازه پاک شدند. در ادامه، تنظیم HTTP پورت 80 برای هدایت موقت `302` به نشانی Organization روی HTTPS اصلاح شد؛ مسیر `/.well-known/acme-challenge/` برای تمدید گواهی حفظ شد. نسخهٔ قبلی تنظیم HTTP در `/etc/nginx/sites-available/feedar.before-http-redirect-20261017` موجود است.

## آزمون اجراشده

- `npm ci`: ۱۹۶ package نصب، ۰ آسیب‌پذیری گزارش‌شده؛ Build شامل TypeScript و Vite موفق.
- در آزمون اولیهٔ محافظت، هر دو URL و یک فایل JS بدون دروازه `401` دادند. پس از حذف دروازه، هر سه بدون credential پاسخ `200` دادند. آدرس HTTP قدیمی اکنون `302` به Organization روی HTTPS می‌دهد.
- Playwright با Chrome روی آدرس‌های HTTPS واقعی: ۳۰ بررسی موفق، ۰ شکست. ورود چهار نقش، مسیرهای مناسب، Refresh، Logout، رد دسترسی User، رد حساب روی Origin اشتباه، نبود Demo Switcher و خطای JS صفحه بررسی شد.
- پس از حذف دروازه، ورود Boss و Owner با Chrome و بدون credential سروری دوباره اجرا و هر دو موفق شد.
- در مرورگر داخلی VS Code، آدرس قدیمی `http://80.249.113.32/#/login` به `https://80.249.113.32:8443/#/login` هدایت شد؛ ورود Owner از همین مسیر دوباره انجام و داشبورد سازمان مشاهده شد. پس از اصلاح HTTP، `certbot renew --dry-run` نیز دوباره موفق بود.
- تصویر داشبورد Boss در `feedar-demo/.qa/live-boss-desktop.png` محلی ثبت شد؛ `.qa` در Git نادیده گرفته می‌شود.

## محدودیت

این بسته همچنان شبیه‌سازی مرورگری است و Backend هویت یا دادهٔ مشترک ندارد. اکنون هر کسی که لینک را بداند می‌تواند فایل‌های JavaScript و حساب‌های نمونه را ببیند؛ فرم React امنیت Production نیست. گواهی IP شش‌روزه است و سلامت تمدید خودکار باید پایش شود.
