# سیستم تم Feedar

`src/app/theme.tsx` انتخاب `system | light | dark` را نگه می‌دارد. در حالت System، `prefers-color-scheme` خوانده می‌شود و تغییر آن زنده دنبال می‌شود. انتخاب دستی در کلید غیرحساس `feedar.theme` در localStorage همان Origin ذخیره می‌شود. `ThemeProvider` در `src/main.tsx` همهٔ مسیرها و هر دو حالت Demo/Operational Login را می‌پوشاند. ویژگی `data-theme` و `color-scheme` روی `html` قرار می‌گیرند.

دکمهٔ قابل‌دسترسی تغییر تم در ورود، پوستهٔ داخلی و صفحات عمومی قرار دارد. صفحهٔ Settings سه انتخاب System، Light و Dark دارد. برای Boss نیز بخش Appearance در Settings نمایش داده می‌شود.

`src/styles/theme.css` توکن‌های background، surface، card، field، border، primary/secondary text، accent، info، success، warning، danger و disabled را تعریف می‌کند. CSS موجود برای اجزای مشترک از این توکن‌ها استفاده می‌کند. رنگ‌های وضعیت در هر دو تم علاوه بر رنگ، متن و آیکون دارند.

**محدودهٔ ذخیره‌سازی:** تنظیم تم در localStorage هر Origin است؛ `boss.*` و `app.*` در دو Origin جداگانه ترجیح مستقل دارند. این فایل‌ها هیچ دادهٔ حساب یا نشست را در localStorage اضافه نمی‌کنند.

محاسبهٔ نسبت کنتراست توکن‌های پایه روی کارت روشن `#fff`: متن اصلی 14.57:1، متن کم‌رنگ 5.91:1، accent 4.93:1. روی کارت تیره `#0d1b2d`: متن اصلی 16.27:1، متن کم‌رنگ 6.66:1، accent 11.42:1. این اعداد مربوط به جفت‌رنگ‌های پایه‌اند؛ حسابرسی خودکار همهٔ حالت‌های تصویری انجام نشده است.
