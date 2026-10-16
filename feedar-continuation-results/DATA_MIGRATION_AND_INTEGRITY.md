# مهاجرت و یکپارچگی داده

کلید `visitorRequests` به snapshot نسخهٔ ۱ افزوده شد. `upgradeSnapshot` هنگام خواندن، آرایهٔ خالی را به snapshot قدیمی اضافه می‌کند؛ جدول‌های دیگر بازنشانی نمی‌شوند. تیکت فاقد `organizationId` فقط وقتی `robotId` آن به ربات موجود اشاره کند با سازمان همان ربات لینک می‌شود. بدون چنین مرجعی unlinked باقی می‌ماند و به سازمان تصادفی نسبت داده نمی‌شود. `isDatabase` رکوردهای درخواست را اعتبارسنجی می‌کند. تراکنش IndexedDB ساخت و انتقال وضعیت را اتمی نگه می‌دارد؛ BroadcastChannel فقط اعلان تغییر می‌دهد.

هیچ IndexedDB موجودی reset یا حذف نشد. تست `src/test/central-support-visitor.test.ts` snapshot قدیمی، linked و unlinked را بررسی می‌کند.
