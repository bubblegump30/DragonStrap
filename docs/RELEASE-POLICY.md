# DragonStrap Release Policy

## Official source

The official DragonStrap repository is:

`https://github.com/bubblegump30/DragonStrap`

Official binary releases should be distributed through that repository's GitHub Releases page.

## Release integrity

Every official Windows release should include SHA-256 hashes for the distributed installer and portable executable. Users should compare downloaded files with `SHA256SUMS.txt` before running them when integrity verification matters.

## Stable channel

Stable releases use normal semantic-version tags such as `v1.0.0`. Pre-release builds should use an explicit suffix such as `v1.1.0-beta.1` and be marked as prereleases on GitHub.

## Update behavior

DragonStrap's Update Center reads GitHub Releases metadata from `bubblegump30/DragonStrap`. v1.0.0 does not automatically download or execute updates. The user is taken to the verified GitHub release page instead.

## Signing

If Windows code signing is configured for a release, release notes should identify that fact. If signing is not configured, the release must be described as unsigned.

## Source and third-party notices

`THIRD_PARTY_NOTICES.md` must remain in source distributions. Upstream-derived code, if introduced in future versions, must retain the applicable upstream license text and attribution at the point of incorporation.
