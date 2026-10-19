# بررسی عدم پسرفت Dark Mode

هشت نمای تیره پیش و پس از اصلاح با Chrome، viewport و حساب یکسان ثبت شد: Welcome، Login، سازمان عمومی، Kiosk، Boss Overview، Boss Support، Owner Robot Status و Owner Telepresence.

در مقایسهٔ نمونه‌برداری‌شدهٔ PNG، هفت نمای تیره اختلاف پیکسلی صفر داشتند. `dark-org-status-mobile.png` اختلاف میانگین ۰٫۴۴ از ۲۵۵ داشت که به دادهٔ زمان‌دار شبیه‌ساز در دو نوبت capture مربوط است؛ چیدمان و پالت در بازبینی دستی ثابت بود. فایل‌های کامل در [`screenshots/before/`](screenshots/before/) و [`screenshots/after/`](screenshots/after/) قرار دارند.

تست Playwright تغییر theme، ماندگاری پس از refresh، و نمایش Robot Status در هر دو حالت موفق شد. قواعد اصلاح‌شده با `:root[data-theme=light]` محدود شده‌اند؛ توکن اصلی Dark Mode تغییری نکرد. در نمونه‌های بازبینی‌شده نفوذ زمینهٔ روشن به حالت تیره مشاهده نشد.
