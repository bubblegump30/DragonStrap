# DragonStrap v2.5.1 — Account & Session Center reliability

This stable maintenance release preserves the Neo Purple interface and v2.5.0 functionality while fixing reproducible session and form-refresh bugs.

## Fixes

- Pending account launches stop when the manager closes or Stop all is used. Async authentication must not dispatch a later launch after cancellation. Requests already handed to Windows cannot be recalled; unidentified Roblox Players are never killed.
- Failed initial and edited Windows process policy requests are retried on later monitoring ticks instead of being incorrectly recorded as applied.
- Completed sessions release their private join-log tracking snapshots.
- Background refresh preserves unfinished schedule, appearance and manager settings forms even after focus moves away.

## Verification

222 automated tests cover the existing features plus closure during authentication/handoff, Stop all during ticket acquisition, policy retry, initial-policy retry and join-snapshot cleanup. Actual renderer checks exercise unsaved fields with focus moved outside the form and run the background timer before checking that the same input/value remains. Windows layout checks run across main screens and account-center panes/dialogs.

Regression tests first reproduced the original backend failures before the fixes. No real Roblox process was terminated, no real account credentials were used, and no Windows policy/registry settings were changed by these synthetic verification cases. Existing real-game launch and telemetry evidence remains documented from v2.5.0; it is not a new live acceptance claim for optional automation.

## Downloads and boundaries

Setup, single-file Portable, Fast Folder and source archives include SHA256SUMS.txt. Extract the complete Fast Folder ZIP and keep all runtime files together. Folder updates use a new complete extracted folder; normal account/settings data is retained.

Direct CPU temperature still requires a compatible installed PawnIO driver and administrator access on the verified Ryzen PC; FPS capture needs Windows ETW permissions. No driver is installed automatically. Private/specific-server joins, concurrency, anti-AFK, real-game process-policy compatibility, exit recovery and admin GDI tuning retain their documented acceptance limits.

Windows packages remain unsigned. No VirusTotal report was generated for these newly built v2.5.1 files; previous reports do not cover them.
