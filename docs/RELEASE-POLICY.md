# DragonStrap Release Policy

## Official source

The official DragonStrap repository is:

`https://github.com/bubblegump30/DragonStrap`

Official binary releases should be distributed through that repository's GitHub Releases page.

## Required release artifacts

A Windows release intended for Update Center 2.0 should contain:

- `DragonStrap-Portable-<version>-x64.exe`
- `DragonStrap-Setup-<version>-x64.exe`
- `SHA256SUMS.txt`

The file names are part of the updater contract. Update Center 2.0 selects the artifact that matches the running distribution type and architecture.

## Release integrity

`SHA256SUMS.txt` is mandatory for in-app binary staging. DragonStrap downloads the checksum file first, locates the exact selected artifact name, downloads that artifact, computes SHA-256 locally, and stages it only if the values match. If GitHub supplies an asset `sha256:` digest, DragonStrap also requires it to agree with `SHA256SUMS.txt`.

A missing checksum, mismatched digest, changed staged file, or untrusted initial release URL causes the update to fail closed.

## Stable and pre-release channels

Stable releases use normal semantic-version tags such as `v1.5.0`. Pre-release builds use an explicit suffix such as `v1.6.0-beta.1` and should be marked as prereleases on GitHub.

The Stable channel uses GitHub's latest stable release. The Pre-release channel can surface the newest published non-draft release, including prereleases.

## Update application

Installed/Setup builds launch the already verified Setup executable and then close the current DragonStrap process.

Portable builds create a local post-exit PowerShell handoff. The helper waits for DragonStrap to close, copies the verified binary beside the current portable executable, keeps a temporary backup of the previous executable, replaces it, relaunches DragonStrap, and removes the backup after a successful handoff. If replacement fails before a valid target exists, the helper attempts to restore the backup.

Source/dev sessions never self-modify.

## Deferral

Deferrals are stored against a specific target version. Available presets are 1 hour, 1 day, and 7 days. A later release is not suppressed by a deferral for an older version.

## Signing

If Windows code signing is configured for a release, release notes should identify that fact. If signing is not configured, the release must be described as unsigned. SHA-256 verification is an integrity check and does not substitute for Authenticode publisher identity.

## Source and third-party notices

`THIRD_PARTY_NOTICES.md` must remain in source distributions. Upstream-derived code, if introduced in future versions, must retain the applicable upstream license text and attribution at the point of incorporation.
