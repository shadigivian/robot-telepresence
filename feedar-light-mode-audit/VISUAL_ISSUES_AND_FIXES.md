# ایرادهای تصویری تأییدشده و اصلاح‌ها

| صفحه / بخش | مشکل قبل | تصویر قبل | اصلاح | تصویر بعد | نتیجه |
| --- | --- | --- | --- | --- | --- |
| Kiosk / زبان، انتخاب کارمند، نام بازدیدکننده | ورودی سفید با متن روشن، متن انتخاب‌شده ناخوانا | [قبل](screenshots/before/light-kiosk-mobile.png) | توکن‌ها و رنگ فیلدهای Kiosk در Light Mode به سطح تیرهٔ محلی بازگردانده شد | [بعد](screenshots/after/light-kiosk-mobile.png) | متن و placeholder خوانا؛ کادر مشخص |
| Telepresence / داده‌های تله‌متری | متن `strong` روشن روی کارت روشن | [قبل](screenshots/before/light-org-telepresence-mobile.png) | رنگ متن از `--text` روشن گرفته شد | [بعد](screenshots/after/light-org-telepresence-mobile.png) | اعداد خوانا |
| Boss / فرم ایجاد سازمان | کادر ورودی‌ها کم‌رنگ و تشخیص فیلد سخت | [قبل](screenshots/before/light-boss-create-org-dialog-laptop.png) | `--control-border` و focus روشن مشخص | [بعد](screenshots/after/light-boss-create-org-dialog-focus-laptop.png) | مرزها و فوکوس قابل تشخیص |
| Boss Overview / کارت‌ها و دکمهٔ اصلی | سفیدی گسترده، گرادیان و سایهٔ پررنگ | [قبل](screenshots/before/light-boss-overview-laptop.png) | سطح off-white، آبی یکدست و سایهٔ نرم | [بعد](screenshots/after/light-boss-overview-laptop.png) | ساختار حفظ شده؛ شدت بصری کمتر |
| Organization / Robot Status | زمینه و نشان‌ها با زبان رنگی تند | [قبل](screenshots/before/light-org-status-mobile.png) | توکن‌های وضعیت و زمینهٔ روشن نرم‌تر | [بعد](screenshots/after/light-org-status-mobile.png) | برچسب و آیکون وضعیت باقی ماند |
| Boss Organizations / جدول و کنترل‌ها | تمایز ردیف‌ها و hover ضعیف | [قبل](screenshots/before/light-boss-organizations-laptop.png) | پس‌زمینهٔ بسیار ملایم ردیف زوج و hover | [بعد](screenshots/after/light-boss-organizations-laptop.png) | ردیف‌ها بدون تغییر چیدمان تشخیص‌پذیرترند |
| Welcome / Login | زمینهٔ روشن و دکمهٔ گرادیانی شدید | [قبل](screenshots/before/light-login-laptop.png) | توکن‌های صفحه و اکشن ملایم‌تر | [بعد](screenshots/after/light-login-laptop.png) | فرم و مسیر ورود حفظ شده |
| همهٔ صفحات / favicon | خطای ۴۰۴ در کنسولِ capture اولیه | [قبل](screenshots/before/light-welcome-laptop.png) | favicon SVG و آدرس وابسته به `BASE_URL` | [بعد](screenshots/after/light-welcome-laptop.png) | manifest بعدی بدون خطای کنسول؛ static root/base گذشت |

بررسی دستی تصاویر با مقایسهٔ پیکسلی مکمل شد. مقدار اختلاف پیکسلی به تنهایی معیار بهبود نیست؛ [`visual-comparison.json`](visual-comparison.json) فقط سند تغییرات است.
