# DragonStrap v2.6.0 — Account groups, bulk actions and session history

## New account workflows

- Create/rename/remove local groups and move selected accounts between them. Each account has one optional group. Removing a group keeps its accounts, saved games and encrypted credentials.
- Select accounts individually or select visible rows. Selection survives filters and refresh; selected counts include hidden rows.
- Bulk refresh Roblox details, favorite/unfavorite accounts, assign groups, launch favorite games, or stop selected managed sessions. Remote/process operations run serially and report an outcome for every account.
- Review account-specific favorite games and managed sessions before launching/stopping. The backend rejects changed favorite targets and replacement sessions outside the review. Multiple launches require explicit concurrency preference; Roblox controls concurrent-client compatibility.
- Cancel remaining bulk work while the current request finishes. Stop all also invalidates remaining batch launches. Accounts cannot be removed while their launch is pending.

## Session history

Sessions now shows active managed clients. History shows retained completed/detached records with account and outcome filters, account/game search, local start/end timestamps, tracked duration and join-confirmation context. Entries use 50-row pages; the existing 1,000-entry retention and lifetime totals are preserved. New history records retain account labels after account removal. Exits are not classified as confirmed crashes; manager closure is described as detaching and leaving Roblox running.

## Data and verification

The account schema remains additive and backward compatible. Older records load as ungrouped without rewriting the file on read. Group and metadata batch writes are atomic. Credentials are not moved or included in history/results. Studio configuration, FastFlag behavior, presets, monitoring and v2.5.1 cancellation/retry fixes remain intact.

239 automated tests passed locally. Coverage includes legacy-file preservation, group CRUD/atomic failures, invalid selections, serialized/partial batch results, overlap prevention, remaining-work cancellation, reviewed favorite/session changes and persisted history labels. Electron interaction/layout checks cover group creation/assignment, review and cancellation, selection retention, per-account results, history pagination/privacy and account/group/bulk dialogs across supported sizes/scales. Hosted Windows CI repeats source, test, release and UI checks before publication.

These checks use synthetic accounts/providers/processes. They do not establish new live multi-account/concurrency acceptance or authorize changing real Roblox sessions. The existing normal-game launch and telemetry acceptance is retained; private/specific-server behavior, concurrency, anti-AFK, process-policy compatibility, recovery and admin tuning retain documented limits.

## Packages

Setup x64, single-file Portable x64, Fast Folder x64, source archive and SHA256SUMS.txt. Extract every Fast Folder file and keep the complete folder together; replace the complete folder for future updates. Existing settings and accounts remain in the normal user-data directory.

Direct CPU temperature and FPS still require their documented sensor/Windows permissions. No driver is installed automatically. Packages remain unsigned. No VirusTotal scan was performed for these newly built files; older reports apply only to their exact hashes.
