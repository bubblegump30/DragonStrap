# DragonStrap v1.0.0 — Stable Release

DragonStrap v1.0.0 is the first stable release of the current Windows feature set.

## Release gates

A v1.0.0 release is considered ready only after all of the following succeed:

- `npm run check`
- `npm test`
- `npm run release:verify`
- `npm run release:prepare`
- Windows packaging through `scripts\Build-Windows-Release.ps1`
- SHA-256 generation for distributed artifacts

## Official artifacts

The intended official GitHub Release contains:

- `DragonStrap-Portable-1.0.0-x64.exe`
- `DragonStrap-Setup-1.0.0-x64.exe`
- `SHA256SUMS.txt`
- source archive / GitHub source snapshot

Artifact names can vary if electron-builder changes naming behavior, but all distributed executable artifacts must be covered by the published SHA-256 list.

## Signing

Code signing is optional for the first stable build. If `CSC_LINK`/signing credentials are configured, electron-builder can sign the Windows artifacts. If not, the release must be described as unsigned; DragonStrap must never claim a signature that is not present.

## Stable boundaries

- Channel & Version Manager is metadata/tracking only; it does not replace Roblox deployment packages.
- Performance+ and FastFlag Manager apply to Roblox Player only.
- Studio FastFlags are not modified.
- Update Center checks official GitHub Releases and opens the verified release page; automatic download/install remains disabled.

## Rollback

The previous public baseline is v0.9.5. If a v1.0.0 packaging issue is discovered, users can return to the prior source/tag while the issue is corrected.
