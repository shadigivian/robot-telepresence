# ممیزی صفحه‌های ورود

صفحهٔ Demo Login در هفت اندازهٔ درخواستی با Chrome دیده و با نسخهٔ قبلی مقایسه شد. زمینه و کارت روشن اکنون گرم و کم‌نورترند؛ برچسب‌ها، کادرهای ورودی، دکمهٔ Sign in، لوگو و toggle خوانا مانده‌اند. [قبل](screenshots/before/light-login-mobile.png) · [بعد](screenshots/after/light-login-mobile.png). نمای Dark Login [قبل](screenshots/before/dark-login-laptop.png) و [بعد](screenshots/after/dark-login-laptop.png) یکسان بود.

آزمون واقعی Login محلی: فیلد خالی و ایمیل نامعتبر پیام خطا نشان دادند؛ رمز اشتباه رد شد؛ نمایش/مخفی کردن رمز و ارسال با Enter کار کرد؛ کد MFA اشتباه رد و کد آزمایشی درست پذیرفته شد؛ نشست پس از Refresh حفظ و پس از Sign out صفحهٔ ورود نمایش داده شد. Boss، Owner، Admin و User به مسیر مجاز خود رفتند. تست قبلی تعلیق Admin نیز در مجموعهٔ کامل گذشت. Demo Switcher و Demo Accounts در DOM نبودند. کنترل «Forgot password» در این Demo وجود ندارد؛ بنابراین رفتاری برای آن ادعا نمی‌شود. انقضای هشت‌ساعتهٔ نشست با جابه‌جایی زمان مرورگر در این ممیزی جداگانه آزمایش نشد.

Build آزمایشی محافظت‌شده روی دو Origin **محلی** `127.0.0.1:4181` و `:4182` بررسی شد. Boss و Organization Login در روشن/تیره و دسکتاپ/موبایل تصویرگیری شدند؛ ورود نقش نامجاز در هر Origin رد شد و ورود Boss و Owner مجاز در دسکتاپ کار کرد. [Boss روشن](screenshots/after/staging-boss-light-desktop.png) · [Organization روشن موبایل](screenshots/after/staging-organization-light-mobile.png). این کار اثبات احراز هویت Production یا اشتراک داده بین Originها نیست. صفحات operational در حالت public بدون سرویس احراز هویت همچنان ورود را غیرفعال نشان می‌دهند.

ایراد عملکردی تازه‌ای در Login مشاهده نشد؛ تغییر کد عملکرد Login انجام نشد. خطاهای میانی آزمون از انتظار CSS قدیمی آزمون بودند و پس از اصلاح، suite کامل گذشت.
