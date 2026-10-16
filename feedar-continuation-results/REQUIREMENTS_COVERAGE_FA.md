# پوشش نیازمندی‌ها

| نیازمندی | وضعیت | شواهد |
| --- | --- | --- |
| Robot Status از lease و نشست معتبر؛ آخرین کاربر پس از آزادسازی | از قبل پیاده و دوباره تأیید شد | `src/domain/robot-status.ts`، `src/test/robot-status.test.ts`، `e2e/robot-status.spec.ts` |
| Robot Status برای User با ربات‌های منتسب | تازه تکمیل شد | `src/app/App.tsx`، `src/features/org-robots.tsx`، `src/domain/permissions.ts` |
| نمایش Boss سراسری کنترل‌کننده و دسترسی | تازه تکمیل شد | `src/features/boss.tsx` |
| چرخهٔ کنترل، انحصار و اصلاح‌های ایمنی پیشین | از قبل پیاده و دوباره تأیید شد | `src/services/demo/service.ts`، `src/test/organization-control.test.ts` |
| درخواست بازدیدکننده، اعلان هدفمند، پذیرش/رد/لغو/انقضا | تازه تکمیل شد | `src/features/kiosk.tsx`، `src/app/App.tsx`، `src/services/demo/service.ts`، `src/test/central-support-visitor.test.ts` |
| میز مرکزی Boss، فیلتر، پاسخ دوطرفه، وضعیت و اولویت | تازه تکمیل شد | `src/features/boss-support.tsx`، `src/app/App.tsx`، `e2e/central-support.spec.ts` |
| مهاجرت بدون حذف داده؛ تیکت قدیمی فاقد سازمان | تازه تکمیل شد | `src/services/demo/store.ts`، تست legacy؛ رکورد بدون مرجع معتبر فقط به‌صورت unlinked محفوظ است |
| push مستقل میان دستگاه‌ها و احراز هویت واقعی | نیازمند زیرساخت خارجی | دمو فقط IndexedDB همان مبدأ و نقش‌های نمایشی دارد |
| تست سخت‌افزار واقعی/VPS | اجرا نشد، خارج از مجوز | کد فقط شبیه‌ساز است |
