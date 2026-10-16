# نتایج آزمون‌های اجراشده

محیط: macOS arm64، Node 26.5.1، npm 11.17.0، Chrome نصب‌شده، شاخه `feedar-demo`، HEAD `b873771`. اجرای مرورگر با دسترسی localhost انجام شد؛ sandbox اولیه برای bind به 127.0.0.1 خطای EPERM می‌داد.

| دستور از `feedar-demo/` | نتیجهٔ نهایی |
| --- | --- |
| `npm run typecheck` | موفق |
| `npm run lint` | موفق |
| `npm test` | ۹ فایل، ۸۵ موفق، ۰ شکست، ۰ ردشده |
| `npm run build` | موفق؛ هشدار غیرمسدودکنندهٔ `use client` در وابستگی‌ها |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:static` | موفق در `/` و `/base-check/` |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- --workers=1` | ۳۰ موفق، ۰ شکست، ۰ ردشده؛ ۱ دقیقه |
| `PLAYWRIGHT_CHANNEL=chrome npx playwright test e2e/central-support.spec.ts --workers=1` بعد از آخرین اصلاح جزئی | ۳ موفق، ۰ شکست؛ pageerror و پاسخ HTTP ناموفق هم‌مبدأ: ۰ |
| `git diff --check` | موفق |

Playwright در تست‌های موجود هفت نوع صفحه و اندازه‌های Surface/موبایل را بررسی کرد. تصاویر اختصاصی این مرحله از Boss Support و کیوسک در ۱۴۴۰×۱۰۰۰ و ۳۹۰×۸۴۴ ثبت شدند. Firefox/WebKit و ربات فیزیکی اجرا نشدند. VS Code Test Explorer در این محیط ابزار قابل‌دسترسی نداشت؛ همهٔ آزمون‌ها از ترمینال اجرا شدند.

شکست‌های میانی: دو تست قدیمی پنج لینک Boss انتظار داشتند؛ مطابق نیاز جدید به شش لینک اصلاح شدند. یک تست تازه selector مبهم Reply داشت و اصلاح شد. یک اجرای کامل هنگام تغییر کد در حالت توسعه متوقف شد؛ همان تست onboarding در اجرای جداگانه و اجرای کامل نهایی گذشت. این‌ها در نتیجهٔ نهایی باقی نماندند.
