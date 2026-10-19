# نتایج اجراشده

محیط: macOS arm64، Node 26.5.1، npm 11.17.0، Google Chrome نصب‌شده. Node 24 LTS در این محیط موجود نبود.

| اجرا | نتیجه |
| --- | --- |
| `npm run typecheck` | موفق |
| `npm run lint` | موفق |
| `npm test` | ۸۸/۸۸ موفق، ۱۰ فایل |
| `npm run build` | موفق؛ هشدارهای غیرمسدودکنندهٔ `use client` در وابستگی‌ها |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:static` | root و `/base-check/` موفق |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1` | **۴۱/۴۱ موفق، ۰ ناموفق، ۰ skipped** |
| capture سفارشی Chrome | ۸۴ تصویر یکتای قبل و ۸۴ تصویر یکتای بعد؛ ۰ خطای ثبت‌شده |
| Build آزمایشی staging روی دو Origin محلی | چهار بررسی portal/اندازه موفق؛ هشت تصویر روشن/تیره |

اجرای میانی suite یک شکست داشت: انتظار رنگ متن Telepresence هنوز `#243247` بود، در حالی‌که توکن جدید `#253247` است. انتظار اصلاح و **کل suite** دوباره اجرا شد؛ نتیجهٔ نهایی ۴۱/۴۱ موفق است. اجرای متمرکز اولیه نیز یک انتظار اشتباه `background-color` برای کارت Dark Mode داشت؛ کارت با گرادیان رسم می‌شود و آزمون اصلاح شد. این‌ها نقص عملکردی محصول نبودند.

Manifest تصویرها: [قبل](before-manifest.json) و [بعد](after-manifest.json). صفحاتِ ثبت‌شده در آن‌ها از تست‌های خودکار suite متمایزند. مرورگر Firefox/WebKit اجرا نشد.
