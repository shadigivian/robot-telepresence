# Known limitations

- The separately referenced Persian requirements document was unavailable. Implementation follows the detailed attached request, as the user directed.
- This is a browser-only demo. IndexedDB state and authorization are local to a browser profile/origin; neither is production security. Dynamic invitations do not cross independent browsers and no email is sent.
- Demo credits are arbitrary internal units. Raw token counts are entered manually. There is no currency, pricing, automatic charging, payment gateway or real AI meter.
- QR scanning depends on camera permission and browser BarcodeDetector support; manual identifier entry remains available. Physical camera/QR behavior was not exercised.
- Robot telemetry, connection and activity are simulated. No physical robot or production endpoint was contacted.
- Pre-existing simulator control defects reported in earlier audits were outside this Boss workflow; robot-control logic was left untouched. Existing regression tests passed but do not validate hardware.
- Migration of v1 snapshots was unit tested. It adds a registry record for each existing robot and an empty ledger; legacy organization phone remains absent until edited. A production-grade data migration/backup process is outside this static demo.
- Local environment used Node 26 rather than requested Node 24; retest under Node 24 LTS before a release.
