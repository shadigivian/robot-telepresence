# خلاصهٔ اصلاح

در [auth.tsx](/Users/hossein/project/vares/feedar-demo/src/features/auth.tsx:96) دکمهٔ Eye اکنون `type="button"` صریح، کلاس اختصاصی `password-visibility` و `aria-pressed` مطابق وضعیت واقعی دارد. پس از کلیک/لمس، فوکوس به ورودی برمی‌گردد؛ فعال‌سازی با صفحه‌کلید فوکوس را روی دکمه نگه می‌دارد تا نشانگر آن قابل مشاهده باشد. مقدار رمز در تغییر حالت حفظ می‌شود.

در [theme.css](/Users/hossein/project/vares/feedar-demo/src/styles/theme.css:105) سطح دکمه به ۴۴×۴۴ و آیکون به ۱۸×۱۸ پیکسل رسید. قانون رنگ و hover فقط زیر `data-theme=light` اعمال می‌شود و زمینهٔ hover با پالت گرم هماهنگ است. نشانگر `focus-visible` مشخص شد. رنگ‌های Dark Mode تغییر نکردند.

پس از اصلاح، نسبت کنتراست آیکون روی فیلد حدود **۱۱٫۵۷:۱** در Light و **۱۷٫۰۴:۱** در Dark است. در چهار ترکیب theme/اندازه، toggle، مقدار ورودی، label، آیکون، فوکوس اشاره‌گر، عدم ارسال فرم و نبود خطای کنسول بررسی و تأیید شد.

برای Boss و Organization Login نیز همان دکمهٔ موجود در [auth.tsx](/Users/hossein/project/vares/feedar-demo/src/features/auth.tsx:60) `aria-pressed` گرفت و پس از تعامل اشاره‌گر فوکوس ورودی را حفظ می‌کند. قانون کوچک در [theme.css](/Users/hossein/project/vares/feedar-demo/src/styles/theme.css:110) دکمهٔ operational را از ۴۲×۴۲ به ۴۴×۴۴ رساند؛ hover گرم فقط در Light Mode اعمال شد. هشت ترکیب دو portal، دو اندازه و دو theme از Build محلی با Chrome گذشتند.
