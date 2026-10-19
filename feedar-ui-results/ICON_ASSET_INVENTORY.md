# فهرست آیکون و دارایی

منبع SVG موجود `lucide-react` است؛ فونت، تصویر خارجی یا وابستگی جدید افزوده نشده است. رجیستری معنایی در `src/components/status-icon.tsx` قرار دارد.

| گروه | کلیدها | محل استفاده |
| --- | --- | --- |
| اتصال و کار | `online`, `offline`, `working`, `idle`, `available`, `busy` | Robot Status |
| باتری | `charging`, `battery`, `lowBattery`, `criticalBattery` | Robot Status؛ بر اساس mode و درصد واقعی دادهٔ Demo |
| کاربر | `currentUser`, `lastUser` | Robot Status؛ نام از وضعیت نشست موجود گرفته می‌شود |
| خدمات و هشدار | `maintenance`, `warning`, `error`, `visitorCall` | رجیستری آمادهٔ استفاده در وضعیت‌های خدمات/دعوت |
| نشست | `sessionActive`, `sessionEnded`, `approved`, `rejected`, `pending` | رجیستری قابل‌استفاده در Telepresence و اعلان‌ها |
| عمومی | `robot`, `empty` | وضعیت خالی مشترک و گسترش آتی |

آیکون‌های ناوبری Boss/Organizations/Robot/Telepresence/Notifications/Support/Settings از Lucide موجود در `src/app/App.tsx` حفظ شدند. آیکون‌های هشدار و کنترل بصری Robot Status از رجیستری مشترک می‌آیند. هر نشان وضعیت متن نیز دارد و فقط به رنگ وابسته نیست.
