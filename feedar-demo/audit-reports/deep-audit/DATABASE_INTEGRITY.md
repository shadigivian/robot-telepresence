# Data integrity

Feedar stores one version-1 database snapshot in one IndexedDB object store (`src/services/demo/store.ts:5-30,50-114`). Mutations use synchronous read/write transactions and revision increments; BroadcastChannel announces commits but is not a lock. `isDatabase()` checks arrays, IDs, key references and some numeric/tenant invariants. Corrupt snapshots are replaced with fictional seed data and a warning (`:79-83`), as unit-tested. There is no migration beyond v1, backup/import/export for all data, or user-data recovery. Quota exhaustion and concurrent-tab conflict cases were not forced. These matter only if this model is retained beyond demo use.

Legacy `lib/store.js:25-47` writes a temporary JSON file, fsyncs the file, then renames it before publishing success. It does not fsync the parent directory after rename and assumes one process owns the file. Crash durability and multi-process writes were not tested. The legacy and Feedar stores have unrelated schemas and no migration path.

FDR-01/02 were cross-record integrity defects; regression tests are in `src/test/domain.test.ts:27-28`. No real runtime data was read or changed.
