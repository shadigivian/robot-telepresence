# نتایج اجرای واقعی آزمون‌ها

تاریخ: ۲۰۲۶-۱۰-۱۹؛ مسیر اجرا: `feedar-demo/`. سیستم محلی Node 26.5.1 و npm 11.17.0 داشت؛ Node 24 LTS در دسترس نبود. مرورگر Playwright از Chrome نصب‌شده با `PLAYWRIGHT_CHANNEL=chrome` و `--workers=1` استفاده کرد.

| بررسی | نتیجهٔ نهایی |
| --- | --- |
| `npm run typecheck` | موفق |
| `npm run lint` | موفق |
| `npm test` | ۱۰ فایل، ۸۸ موفق، صفر ناموفق |
| `npm run build` | موفق؛ هشدار غیرمسدودکنندهٔ bundler دربارهٔ دستور `use client` در وابستگی‌ها |
| `npm run test:static` | موفق در `/` و `/base-check/`؛ asset، refresh، redirect و نبود Demo Switcher |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1` | ۳۴ موفق، صفر ناموفق، صفر skipped؛ زمان حدود ۲ دقیقه |
| Build آزمایشی staging روی دو Origin محلی | Boss و Organization Login در تم روشن/تیره، دسکتاپ/موبایل، ذخیرهٔ انتخاب پس از Refresh و نبود کنترل‌های Demo: ۲/۲ Origin موفق |

یک اجرای میانی Playwright با ۳۳ موفق و یک timeout در سناریوی دو تب تمام شد. علت مشاهده‌شده پیمایش اضافی تست به صفحهٔ Welcome بلافاصله پیش از ورود Boss بود؛ آن پیمایش از تست حذف شد. اجرای جداگانهٔ همان سناریو و اجرای نهایی ۳۴/۳۴ هر دو موفق شدند. دو تست اولیهٔ تازهٔ تم نیز به دلیل فرض نادرست دربارهٔ زمان بارگذاری/تم پیش‌فرض اصلاح و دوباره با موفقیت اجرا شدند.

۱۸ تصویر جدید در `screenshots/` شامل ورود Demo، Boss، Robot Status، Telepresence، و ورود عملیاتی Boss/App در تم روشن/تیره و اندازه‌های Desktop/Mobile است. تصاویر بازبینی شدند. تست‌های موجود هنگام اجرا ۳۳ تصویر قدیمی tracked را بازنویسی کردند؛ آن تصاویر به محتوای اولیه بازگردانده شدند.

هیچ تست فیزیکی ربات، Firefox، WebKit، deploy یا سرور عمومی اجرا نشد.
