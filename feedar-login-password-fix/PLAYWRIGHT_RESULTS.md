# نتایج واقعی آزمون

محیط: macOS arm64، Node 26.5.1، npm 11.17.0، Google Chrome نصب‌شده با `PLAYWRIGHT_CHANNEL=chrome`. Node 24 LTS در این ماشین موجود نبود.

| بررسی | نتیجه |
| --- | --- |
| Chrome diagnostic Demo Login قبل/بعد | ۴ ترکیب Light/Dark × دسکتاپ/موبایل؛ ۱۶ تصویر قبل و ۱۶ بعد؛ ۰ خطای کنسول/صفحه |
| Chrome روی Build staging محلی Boss/Organization | ۸ ترکیب portal/اندازه/theme؛ ۸ تصویر قبل و ۸ بعد؛ همهٔ toggle، لمس، صفحه‌کلید، فوکوس و Refresh موفق |
| Playwright متمرکز `password-visibility.spec.ts` | ۴/۴ موفق؛ کلیک، لمس، Enter، Space، reload، برچسب، آیکون، کنتراست و اندازه |
| `npm run typecheck` | موفق |
| `npm run lint` | موفق |
| `npm test` | ۸۸/۸۸ موفق، ۱۰ فایل |
| `npm run build` | موفق؛ هشدارهای غیرمسدودکنندهٔ `use client` در وابستگی‌ها |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1` | **۴۵/۴۵ موفق، ۰ ناموفق، ۰ skipped** |

اجرای اولیهٔ چهار تست متمرکز به علت روش نادرست آزمون برای `:focus-visible` شکست خورد: `locator.focus()` بعد از تعامل با ماوس، حالت focus-visible صفحه‌کلید را فعال نمی‌کند. آزمون با `Tab` واقعی اصلاح و دوباره اجرا شد؛ ۴/۴ موفق. این شکست اولیه نقص محصول نبود.

در آزمون نهایی، رمز پیش‌فرض پوشیده بود، با کلیک/لمس آشکار و دوباره پوشیده شد، متن باقی ماند، آیکون/label/pressed state هماهنگ بود، فرم ارسال نشد، و پس از reload حالت پیش‌فرض پوشیده برگشت. Dark Mode رنگ پیشین را حفظ کرد.

Build staging فقط روی `127.0.0.1:4181` و `:4182` اجرا و سپس متوقف شد. در پایان، Build عادی بدون متغیر staging دوباره تولید شد. هیچ VPS یا دامنهٔ واقعی آزمون نشد.
