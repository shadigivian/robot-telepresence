# Repository guidance

Preserve the existing Node telepresence application, firmware, private runtime configuration/data, and uncommitted work. The new `feedar-demo/` package is a separate browser-only static demonstration and has its own AGENTS.md and documentation.

For Feedar changes, follow `feedar-demo/AGENTS.md`; run its scripts from that directory using Node 24 LTS. Do not import legacy backend, Web Serial, or hardware-control code into the public demo.

Do not commit runtime secrets or data, deploy or push without explicit authorization, or present simulation tests as validation of physical hardware.
