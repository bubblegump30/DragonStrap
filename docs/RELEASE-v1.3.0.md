# DragonStrap v1.3.0 — Update Center 2.0

v1.3.0 converts DragonStrap's release checker into a verified Windows self-update workflow.

## Added

- Portable vs installed Setup build detection.
- Build-specific GitHub release asset selection.
- `SHA256SUMS.txt` retrieval and parsing.
- Local SHA-256 verification before an update becomes installable.
- Optional cross-check against GitHub's published asset digest.
- In-app download progress and cancellation.
- Persistent verified staging metadata.
- In-app release notes.
- Stable and pre-release channel support.
- Version-specific 1-hour, 1-day, and 7-day update deferral.
- Update-folder shortcut.
- Safe portable post-exit replacement with backup/restore protection.
- Verified Setup handoff for installed builds.

## Security boundaries

- Release discovery never executes binaries.
- The initial asset URL must be an HTTPS GitHub release-download URL under `bubblegump30/DragonStrap`.
- A matching SHA-256 line must exist in `SHA256SUMS.txt`.
- Mismatched downloads are deleted and never exposed as installable.
- Staged files are re-hashed immediately before application.
- Source/dev mode cannot apply binary self-updates.
- The renderer never supplies arbitrary executable or filesystem paths to the update service.

## Compatibility

The release preserves the v1.1.x Roblox Player transactional installation engine and all existing DragonStrap centers.
