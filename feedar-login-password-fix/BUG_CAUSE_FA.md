# علت مسئلهٔ کنترل نمایش رمز

بررسی با Chrome نصب‌شده در Login محلی، Light/Dark و اندازه‌های ۱۴۴۰×۹۰۰ و ۳۹۰×۸۴۴ انجام شد. دادهٔ واقعی DOM و CSS در [تشخیص قبل](before/diagnostics.json) است.

آیکون Eye در Light Mode **سفید یا نامرئی نبود**: رنگ محاسبه‌شدهٔ آن `rgb(37,50,71)` روی فیلد `rgb(245,242,237)` است، با نسبت کنتراست حدود **۱۱٫۵۷:۱**. تغییر `password` به `text`، تعویض Eye/EyeOff و برچسب دسترس‌پذیر نیز از ابتدا کار می‌کرد. کلیک فرم را ارسال نمی‌کرد، زیرا کامپوننت عمومی Button در [ui.tsx](/Users/hossein/project/vares/feedar-demo/src/components/ui.tsx:5) به‌طور پیش‌فرض `type="button"` دارد.

ایرادهای بازتولیدشده: دکمه در [auth.tsx](/Users/hossein/project/vares/feedar-demo/src/features/auth.tsx:96) کلاس مشترک `.btn` داشت؛ ترکیب `.password-field button` در [global.css](/Users/hossein/project/vares/feedar-demo/src/styles/global.css:4) با padding/اندازهٔ آیکون عمومی، سطح کلیک را **۳۶×۴۴ پیکسل** می‌ساخت. قانون hover عمومی Light Mode در [theme.css](/Users/hossein/project/vares/feedar-demo/src/styles/theme.css:82) پس‌زمینهٔ آبی‌خاکستری `rgb(226,233,241)` را روی زمینهٔ گرم Login اعمال می‌کرد. پس از کلیک/لمس نیز فوکوس از ورودی به دکمه می‌رفت.

پس اصلاح لازم به مساحت لمس، هماهنگی رنگی Light Mode و رفتار فوکوس محدود شد؛ مشکل کنتراست آیکون ادعا یا شبیه‌سازی نشد.

در بررسی تکمیلی Build آزمایشی روی دو Origin محلی، دکمهٔ مشابه در Boss Login و Organization Login هر دو **۴۲×۴۲ پیکسل** بودند. آیکون‌ها در Light/Dark خوانا و `type="button"` درست بود؛ نقص تأییدشدهٔ آن‌ها فقط اندازهٔ لمس و خروج فوکوس از ورودی پس از کلیک/لمس بود. شواهد در [operational-diagnostics.json](before/operational-diagnostics.json) ثبت شده است.
