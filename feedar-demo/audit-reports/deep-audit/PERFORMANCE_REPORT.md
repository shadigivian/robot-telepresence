# Performance and reliability observations

Production Vite build on macOS arm64, Node 26.5.1: main `index` JS 360.11 kB / 112.06 kB gzip; Zod chunk 119.72 / 36.24 kB gzip; management chunk 52.34 / 13.45 kB gzip; base CSS 34.83 / 8.56 kB gzip. Build completed in 205 ms according to Vite output. These are artifact sizes and build timing, not user-perceived load measurements.

Chrome viewport test completed seven profiles × four screens in one test without page exceptions or failed requests; its 3.9 s test duration includes automation and screenshots, so it is not a page-load benchmark. `src/services/demo/store.ts:90-111` serializes a whole database snapshot per mutation, with no indexes or pagination. This is acceptable for bounded fictional data but likely scales poorly; no large-organization benchmark, navigation timing, heap leak/soak or IndexedDB quota measurement was run. Production performance cannot be inferred from these tests.

Recommended reproducible next measurement: fixed 100/500/1000-record isolated fixtures, Chrome Performance API navigation and search timing across three cold/warm runs, heap snapshot after repeated navigation, and transaction latency at each size. Keep the fixture in a fresh browser profile.
