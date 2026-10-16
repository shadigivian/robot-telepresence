# فایل‌های تغییرکرده در این ادامه

این فهرست فقط تغییرهای همین مرحله است؛ فایل‌ها و تغییرات نیمه‌تمام موجود پیش از شروع حفظ شدند.

| فایل | تغییر |
| --- | --- |
| `feedar-demo/src/domain/models.ts` | مدل درخواست بازدیدکننده، ارجاع اعلان و snapshot تیکت |
| `feedar-demo/src/domain/permissions.ts` | مجوز درخواست، scope اعلان/تیکت و جداسازی Boss/User |
| `feedar-demo/src/data/seed.ts` | آرایهٔ خالی درخواست در دادهٔ اولیه |
| `feedar-demo/src/services/demo/store.ts` | ارتقای snapshot قدیمی، پیوند امن تیکت قدیمی و اعتبارسنجی درخواست |
| `feedar-demo/src/services/demo/service.ts` | چرخهٔ درخواست، اعلان، تیکت مرکزی، اعتبارسنجی و انقضا |
| `feedar-demo/src/app/context.tsx` | دادهٔ عمومی کارکنان قابل انتخاب کیوسک با ایمیل حذف‌شده |
| `feedar-demo/src/app/App.tsx` | مسیر/ناوبری Boss Support و User Robot Status، اعلان قابل اقدام و شمار خوانده‌نشده |
| `feedar-demo/src/features/kiosk.tsx` | انتخاب کارمند و ثبت/لغو درخواست |
| `feedar-demo/src/features/boss.tsx` | وضعیت کنترل‌کننده در پایش سراسری |
| `feedar-demo/src/features/org-robots.tsx` | مدل ربات و لینک اتصال متناسب با نقش |
| `feedar-demo/src/features/org-support.tsx` | عنوان وضعیت و کنترل مجوز دکمهٔ بستن |
| `feedar-demo/src/features/boss-support.tsx` | صفحهٔ تازهٔ پشتیبانی مرکزی و پیوست‌ها |
| `feedar-demo/src/styles/global.css` | شمار خوانده‌نشده با توکن رنگ موجود |
| `feedar-demo/src/test/central-support-visitor.test.ts` | تست‌های سرویس، مجوز، مهاجرت و درخواست |
| `feedar-demo/e2e/central-support.spec.ts` | سه سناریوی مرورگر و تصاویر |
| `feedar-demo/e2e/boss-cleanup.spec.ts` و `feedar-demo/e2e/organization.spec.ts` | انتظار ناوبری شش بخشی Boss |

گزارش‌ها و تصاویر در `feedar-continuation-results/` قرار دارند. هیچ commit، push، deploy، reset داده یا تغییر firmware انجام نشد.
