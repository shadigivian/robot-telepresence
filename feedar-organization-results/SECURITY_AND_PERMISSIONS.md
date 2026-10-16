# امنیت و مجوزهای نسخهٔ نمایشی

- Operations check action, role and organization in `DemoService`/domain policy. Admin cannot modify Owner/Admin or transfer ownership. User access is limited to assigned robots and own tickets/sessions; Support opens their own ticket history without the credit ledger. Boss remains attributed as Boss in scoped administration.
- Department, employee, robot, ticket, registry pairing and credit changes check tenant ownership. Names/usernames and referenced floors/departments are validated. User-scoped records omit other-tenant data, unassigned robots, private organization guidance/PDF, unpublished knowledge, other users' assignments and credit entries.
- Robot suspension/release/member suspension invalidate sessions and leases; control denials and stale request actions stop only the appropriate live lease. Tests cover three previously reported defects plus pending release.
- PDF and ticket attachments are limited to ۵ MB and allowed MIME/magic signatures; logo is limited to ۱ MB and validated dimensions/type. Files stay in IndexedDB. Client-side checks do not provide server-enforced isolation or trustworthy authentication.
- Demo invitation acceptance uses fictitious `.example` identities; no production password storage. Billing has no payment gateway; support tickets are not delivered externally. No physical command path was exercised.

- نمایش کنترل‌کنندهٔ فعلی نیازمند اجارهٔ granted، نشست متصل، زمان و نسل معتبر، هویت و عضویت فعال و تخصیص User به همان ربات است. درخواست pending و اجارهٔ منقضی‌شده نام فعلی تولید نمی‌کنند.
