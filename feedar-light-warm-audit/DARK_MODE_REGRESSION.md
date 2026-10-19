# عدم پسرفت Dark Mode

هشت نمای تیره قبل/بعد شامل Welcome، Login، سازمان عمومی، Kiosk، Boss Overview، Boss Support، Owner Robot Status و Owner Telepresence ثبت شدند. هفت جفت در مقایسهٔ PNG اختلاف صفر داشتند. Robot Status موبایل اختلاف میانگین ۰٫۴۳ از ۲۵۵ داشت؛ دادهٔ زمان‌دار شبیه‌ساز بین دو capture تغییر کرده است و بازبینی دستی تغییر پالت/چیدمان نشان نداد. [Dark Login قبل](screenshots/before/dark-login-laptop.png) · [بعد](screenshots/after/dark-login-laptop.png).

تست‌های Playwright toggle، حفظ انتخاب پس از Refresh، رنگ اصلی Dark Mode، وضعیت ربات و نمایش ورود مستقل Boss/Organization در هر دو حالت گذشتند. همهٔ CSS تازه زیر `:root[data-theme=light]` است. در صفحات بررسی‌شده نشت سطح گرم به Dark Mode مشاهده نشد.
