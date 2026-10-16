# گزارش احراز هویت آزمایشی Staging

تاریخ: ۱۶ اکتبر ۲۰۲۶. هیچ استقرار، push، تغییر VPS یا Reset دادهٔ IndexedDB انجام نشد. محیط محلی Node 26.5.1 داشت؛ پروژه Node 24 LTS را توصیه می‌کند.

## علت

در Build عمومی، `demoDevelopment` غیرفعال می‌شد؛ `DemoProvider` mount نمی‌شد، `App` فقط Login بدون مسیر پنل را نشان می‌داد و فرم عملیاتی ورود را رد می‌کرد. `VITE_ENABLE_TEST_DEMO` قدیمی سطح کاربری را به `demo` تغییر می‌داد و تفکیک Boss/App را از بین می‌برد. در Seed فعلی پیش از این تغییر، رمز `FeedarDemo!42` بود و `123456` فقط کد MFA دمو بود.

## اصلاح

- `src/app/runtime.ts` و `src/main.tsx`: حالت صریح `VITE_STAGING_DEMO=true` تنها روی دو Origin متمایز و تنظیم‌شده؛ Provider دمو فقط در توسعهٔ محلی یا Staging مجاز mount می‌شود. Build عمومی پیش‌فرض بسته می‌ماند.
- `src/features/auth.tsx`: فرم‌های مستقل Boss و Organization با طراحی فعلی حفظ شدند؛ در Staging ایمیل و رمز از Seed بررسی می‌شود، سپس کد تأیید دمو وارد می‌شود. هیچ انتخاب دستی نقش یا دکمهٔ ورود سریع اضافه نشد.
- `src/app/context.tsx` و `src/app/App.tsx`: نقش Boss روی Origin Boss و نقش Owner/Admin/User روی Origin App پذیرفته می‌شود؛ نشست بعد از Refresh از storage همان Origin بازیابی می‌شود و Logout آن را پاک می‌کند. این کنترل‌ها امنیت سروری نیستند.
- `src/data/seed.ts`: رمز دمو مطابق درخواست به `123456` تغییر کرد؛ کد MFA دمو نیز `123456` باقی ماند. کاربر جدید ایجاد نشد و IndexedDB پاک نشد.
- `scripts/serve-staging.mjs`: سرور static فقط روی loopback با Basic Auth مستقل از فرم دمو؛ HTML و assetها همگی محافظت می‌شوند. `docs/STAGING_DEMO.md` روش استفاده پشت TLS/VPN/IP allowlist را توضیح می‌دهد.
- `.env.example`، README و تست‌ها به‌روزرسانی شدند.

## حساب‌های موجود در Seed

| نقش | نام | ایمیل |
| --- | --- | --- |
| Boss | Alex Morgan | `boss@feedar.example` |
| Owner | Dr. Maya Chen | `owner@futurehealth.example` |
| Admin | Sara Williams | `admin@futurehealth.example` |
| User | Daniel Foster | `user@futurehealth.example` |

## آزمون واقعی

- Build با `VITE_STAGING_DEMO=true` و دو Origin محلی: موفق. دو سرور static پشت Basic Auth اجرا شدند. درخواست بدون مجوز به HTML و JS هر دو `401` گرفت. ۲۶ بررسی Chrome شامل ورود چهار نقش با رمز `123456`، کد دمو، Refresh، Logout، رد نقش در Origin اشتباه، رد مسیر غیرمجاز User و نبود کنترل‌های Demo موفق شدند.
- Build عمومی با `VITE_STAGING_DEMO=false`: موفق؛ روی هر دو Origin ورود دمو رد و مسیر محافظت‌شده به Login هدایت شد. بررسی ایستا برای `/` و `/base-check/` موفق بود.
- TypeScript و ESLint موفق؛ ۸۸ تست واحد و ۳۱ تست Playwright موفق، بدون شکست یا تست ردشده. اجرای نهایی Playwright بدون Build یا ویرایش هم‌زمان انجام شد.

## محدودیت‌های مانده

هیچ Backend مشترک یا نشست معتبر سروری وجود ندارد. دسترسی به **کل محیط Staging** باید با VPN، IP allowlist یا احراز هویت مستقل سرور محدود شود؛ متغیر Vite و کنترل نقش React به‌تنهایی امنیت نیستند و کاربری که از دروازه بگذرد می‌تواند fixtureها و browser storage را دستکاری کند. داده‌ها، نشست‌ها، تیکت‌ها و اعتبارها بین Boss و App به‌دلیل استقلال IndexedDB دو Origin مشترک نیستند. انتقال مدیریتی بین Originها فعال نشد. طبق درخواست کاربر، استقرار و آزمون VPS/دامنهٔ آنلاین به خود او سپرده شد؛ آزمون با Build و دروازهٔ سروری محلی مشابه استقرار انجام شد.
