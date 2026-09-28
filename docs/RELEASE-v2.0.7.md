# DragonStrap v2.0.7 — Settings QoL

- Added scoped General and Update Preferences resets using validated main-process defaults.
- Added an automatic installation refresh toggle; the interval is disabled when automatic refresh is off.
- Made the notifications preference control non-error in-app messages. Errors remain visible.
- Added descriptions for refresh scope, notifications, startup update checks, and release channels.
- Added persistent inline saving, success, and failure feedback with controls locked during preference writes.
- Failed persistence restores the previous in-memory settings; failed Settings-page edits restore the displayed controls.
- Resets preserve Player tuning, FastFlags, saved profiles, installations, downloaded updates, and deferrals.

Source release; Windows executables are not built or signed. Windows visual verification remains outstanding.

Validation: source checks, all 154 automated tests, and release verification passed.

An initial full-suite run hit an intermittent existing Studio backup-retention ordering assertion. The new Settings tests passed; the full suite passed on rerun. Backup timestamp ordering remains a known follow-up.
