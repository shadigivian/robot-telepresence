# یافته‌های ممیزی Light Mode

تاریخ: ۱۹ اکتبر ۲۰۲۶. اجرا فقط محلی با Chrome نصب‌شده؛ هیچ درخواستی به VPS ارسال نشد.

در نمای قبلی، زمینهٔ صفحه `#f6f8fb`، کارت `#fbfcfe` و سطح ثانویه `#edf1f5` ته‌رنگ آبی سرد و روشن داشتند. این یک قضاوت بصری دربارهٔ راحتی استفاده است، نه نقص عملکردی. تصویرهای [Login قبل](screenshots/before/light-login-laptop.png)، [Boss قبل](screenshots/before/light-boss-overview-laptop.png) و [Robot Status قبل](screenshots/before/light-org-status-mobile.png) شاهد وضعیت اولیه‌اند. در نسخهٔ نهایی رنگ‌ها به خنثی گرم، با متن و برند آبی/فیروزه‌ای خوانا، تغییر کردند: [Login بعد](screenshots/after/light-login-laptop.png)، [Boss بعد](screenshots/after/light-boss-overview-laptop.png)، [Robot Status بعد](screenshots/after/light-org-status-mobile.png).

۸۴ فایل تصویر هم‌نام قبل/بعد ذخیره شد؛ اسکریپت ۸۷ capture در هر نوبت انجام داد و سه نمای لپ‌تاپ را دوباره روی همان نام ثبت کرد. هفت اندازهٔ درخواستی برای Welcome، Login، سازمان عمومی، Kiosk، Boss Overview، Robot Status و Telepresence ثبت شد. صفحه‌های دیگر در ۱۴۴۰×۹۰۰ و چند نمای موبایل ثبت شدند. فهرست دقیق و خطاهای مرورگر در [manifest نهایی](after-manifest.json) است؛ خطای ثبت‌شده: صفر. بازبینی دستی Login، Boss، Robot Status، دیالوگ ساخت سازمان، Support، سازمان عمومی و صفحات مستقل ورود انجام شد.

صفحات ثبت‌شده: Welcome، Login، دعوت‌نامه/تور عمومی از تست‌های موجود، Kiosk، Boss Overview، Organizations، Robot Management، Robot Monitoring، Support، Settings، دیالوگ ساخت سازمان و Notifications؛ Owner Information، Users، Robots، Status، Telepresence، Billing/Support، Operations، Maps، Activity، Settings، Knowledge؛ نماهای Admin و User. تفاوت صفحهٔ عمومی با دعوت‌نامه در manifest روشن است: خود صفحهٔ دعوت‌نامه در capture سفارشی ثبت نشد و فقط suite موجود آن را اجرا کرد.

حالت تیره و عملکرد برنامه در [گزارش Dark Mode](DARK_MODE_REGRESSION.md) و [نتایج Playwright](PLAYWRIGHT_RESULTS.md) مستند شده‌اند.
