# DragonStrap v1.9.0 — Reliability & Recovery 2.0

v1.9.0 is a recovery-focused release. It adds trusted Roblox Player rollback, configuration restore points, interrupted-update recovery, stronger corruption detection, expanded diagnostic metadata, and one-click bounded repair workflows.

## Release highlights

- Player installation integrity scanner
- Trusted previous-version / backup rollback
- SHA-256 verified configuration restore points
- Automatic safety snapshot before restore or Safe Repair
- Interrupted self-update recovery
- Abandoned installer staging cleanup
- Reliability & Recovery 2.0 interface
- Diagnostic Report schema v2
- One-click Safe Repair

## Safety posture

Recovery operations use fixed/derived allowlists. The renderer cannot provide arbitrary rollback, restore, executable, or filesystem destinations. Safe Repair does not download a replacement Player on its own and only invokes rollback when a candidate comes from DragonStrap-managed install state.
