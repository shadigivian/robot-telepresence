# نتیجهٔ واقعی اجرا

محیط: macOS arm64، Node 26.5.1، npm 11.17.0، Google Chrome نصب‌شده با `PLAYWRIGHT_CHANNEL=chrome`. نسخهٔ درخواستی مخزن Node 24 LTS روی این سیستم در دسترس نبود.

| فرمان / بررسی | نتیجه |
| --- | --- |
| `npm run typecheck` | موفق |
| `npm run lint` | موفق |
| `npm test` | ۸۸ موفق، ۰ ناموفق، ۱۰ فایل |
| `npm run build` | موفق؛ هشدارهای غیرمسدودکنندهٔ `use client` از وابستگی‌ها |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:static` | موفق؛ root و `/base-check/` |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1` | ۳۵ موفق، ۰ ناموفق |
| تصویرگیری سفارشی Chrome | ۸۴ قبل + ۸۴ بعد؛ هفت اندازهٔ هدف روی صفحات اصلی |
| manifest بعد | ۰ خطای کنسول/صفحه، ۰ سرریز ثبت‌شده |

اجرای نخست `test:static` در sandbox به سبب منع bind به `127.0.0.1:4174` با EPERM متوقف شد؛ اجرای مجاز با دسترسی به پورت محلی موفق شد. پیش از اصلاح favicon، capture اولیه یک ۴۰۴ داشت. تصویرگیری مجدد بعد از اصلاح ۰ خطا داشت. بازنویسی PNGهای قدیمی توسط suite به نسخهٔ اولیهٔ مخزن بازگردانده شد؛ تصاویر این ممیزی جدا نگه‌داری شده‌اند.

پوشش مسیرها در [`after-manifest.json`](after-manifest.json) و اسکریپت بازتولید در [`capture.mjs`](capture.mjs) است. اجرا روی Chrome بود، نه Firefox یا WebKit.
