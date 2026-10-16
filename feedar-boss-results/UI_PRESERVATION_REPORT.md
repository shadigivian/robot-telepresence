# UI preservation

Baseline screenshots were captured before implementation in `/private/tmp/feedar-boss-baseline`; matching Chrome screenshots after implementation are in `/private/tmp/feedar-boss-after`. Both captures used 1440×900 except mobile Owner at 390×844. Full-page sizes (before → after):

| Screen | Pixels | Explanation |
| --- | --- | --- |
| Boss Overview | 1440×1174 → 1440×1967 | Six statistics, recent robots, alerts and searches added |
| Organizations | 1440×1337 → 1440×1518 | Phone, Owner/invitation/credit details and entry buttons added |
| Organization details | 1440×1086 → 1440×1662 | Entry and credit ledger added |
| Create organization | 1440×1337 → 1440×1518 | Required phone country/number fields added |
| Existing robot operations | 1440×2320 → 1440×2320 | Same page dimensions |
| Owner overview | 1440×1243 → 1440×1243 | Same page dimensions |
| Mobile Owner overview | 390×1958 → 390×1958 | Same page dimensions |

PNG bytes differ because the simulator, timestamps and page content are dynamic. No pixel-identical claim is made. Existing CSS was untouched; additions use existing components and class names. Seven viewport profiles passed existing Playwright overflow checks, including desktop, tablet and mobile. Camera-based QR layout was not validated on a physical mobile device.
