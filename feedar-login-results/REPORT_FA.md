# گزارش بازطراحی ورود Feedar

تاریخ: ۱۶ اکتبر ۲۰۲۶. تغییرات قبلی Boss، Organizations و Robot Status حفظ شدند؛ commit، push و deploy انجام نشد.

## تغییرات

- `feedar-demo/src/features/auth.tsx`: تجربه‌های مستقل Boss و Organization با تصویرسازی، متن و رنگ متفاوت؛ فرم دارای Email، Password، نمایش/مخفی‌سازی رمز، اعتبارسنجی، Loading و خطای نبود سرویس احراز هویت.
- `feedar-demo/src/styles/operational-login.css`: چیدمان تازه، تم روشن/تیره، واکنش‌گرایی، Focus واضح و Reduced Motion.
- `feedar-demo/src/main.tsx`: بارگذاری سبک‌های ورود عملیاتی.
- `feedar-demo/scripts/verify-operational-login.mjs`: بررسی خودکار دو صفحه در دسکتاپ/موبایل و هر دو تم، همراه با اسکرین‌شات.
- `feedar-demo/scripts/verify-static.mjs`: هماهنگی نام صفحه در تست Build ایستا.

Boss از تصویر شبکهٔ مدیریت و رنگ فیروزه‌ای با عنوان «Feedar Control Center / Central Administration» استفاده می‌کند. سازمان از تصویر فضای کاری و رنگ آبی با عنوان «Welcome to Feedar / Your workspace for connected robots» استفاده می‌کند. در هیچ‌کدام انتخاب نقش یا کنترل دمو وجود ندارد. حالت توسعهٔ محلی دمو برای آزمون جریان‌های قبلی باقی است.

## مسیرهای محلی

با Build دارای `VITE_BOSS_ORIGIN=http://127.0.0.1:4183` و `VITE_APP_ORIGIN=http://127.0.0.1:4184`، صفحات در `http://127.0.0.1:4183/#/login` و `http://127.0.0.1:4184/#/login` با `npm run preview -- --port 4183` و `--port 4184` مشاهده شدند. این سرورها پس از آزمون متوقف شدند. نسخهٔ توسعه‌ای دمو همچنان با `npm run dev` در localhost قابل اجراست.

## بررسی و تصاویر

TypeScript، ESLint و Build موفق؛ ۸۷ تست واحد، ۳۰ تست Playwright بازگشتی و ۲۸ بررسی اختصاصی ورود موفق شدند. بررسی Build ایستا روی `/` و `/base-check/` موفق بود. تصاویر واقعی قبل (۴ تصویر) و بعد (۸ تصویر) در `screenshots/` هستند. همهٔ تصاویر بعد از اجرا بررسی شدند؛ تداخل تصویر با تیتر موبایل و زمان ثبت تم تیره اصلاح شد. Chrome استفاده شد؛ Firefox/WebKit اجرا نشدند.

## محدودیت عملیاتی

Backend مشترک و سرویس احراز هویت در این بستهٔ static وجود ندارد. فرم‌ها رمز را ذخیره یا ارسال نمی‌کنند و بعد از تلاش ورود، خطای سرویس نشان می‌دهند. دسترسی Boss و Organization و انتقال امن Boss به سازمان به نشست و مجوز معتبر سمت سرور نیاز دارد؛ این قابلیت‌ها در این مرحله عملیاتی نیستند. تغییر URL یا browser storage پنل عملیاتی را باز نمی‌کند. Node محلی 26.5.1 بود؛ پروژه Node 24 LTS را توصیه می‌کند.
