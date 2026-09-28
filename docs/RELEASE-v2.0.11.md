# DragonStrap v2.0.11 — Studio Backup Reliability

## Changes

- Assign a strictly increasing timestamp for new Studio backups, including several backups within one millisecond and across service restarts. Retention now consistently keeps the newest backups.
- Write backup metadata through a temporary file and atomic rename. If metadata cannot be committed, the copied backup is removed.
- Validate backup metadata and file paths before listing, restoring, or pruning. A damaged record cannot redirect cleanup outside its project backup directory.
- Restore copies use exclusive creation, so an existing project file cannot be overwritten.
- Existing v1 Studio backup records remain readable when their metadata and backed-up files are valid. Old backups with identical timestamps have a deterministic tie order; their historical creation order cannot be recovered from the previous format.

## Validation

- Source checks and all 157 automated tests pass.
- Regression coverage includes same-millisecond backups across restart, correct retention and restore, an outside-folder metadata path, failed metadata commit cleanup, and refusal to overwrite a restore destination.
- Windows Studio integration and visual checks remain pending in this environment. The v2.0.10 Electron layout gate remains available through `npm run ui:verify` on Windows.
