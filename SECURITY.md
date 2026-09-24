# Security Policy

## Supported versions

Security fixes are targeted at the current maintained DragonStrap release line.

| Version | Supported |
| --- | --- |
| 2.0.x | Yes |
| Older releases | No |

## Reporting a vulnerability

Do **not** publish sensitive vulnerability details, authentication material, private system information, exploit code, or proof-of-concept material that could put users at risk in a public issue.

For sensitive vulnerabilities, use GitHub's **Private vulnerability reporting** feature from the repository's **Security** tab when it is available.

If private vulnerability reporting is unavailable, contact the repository owner through an available private channel before sharing sensitive technical details.

For non-sensitive security bugs that are safe to discuss publicly, open a GitHub issue and clearly identify it as security-related.

Please include:

- DragonStrap version
- Windows version and architecture
- Roblox channel/build information when relevant
- a concise description of the vulnerability
- reproduction steps
- expected and observed behavior
- whether administrator privileges are required
- sanitized logs or screenshots when useful

Never include Roblox authentication cookies, passwords, API keys, access tokens, private keys, signing material, or unsanitized diagnostic data.

## Security-sensitive areas

Security-sensitive components include:

- Electron main/preload/renderer privilege boundaries
- IPC validation and exposed preload methods
- Roblox installation and package extraction
- bootstrap/update/recovery pipelines
- self-update integrity and SHA-256 verification
- process execution and executable path validation
- FastFlag configuration handling
- filesystem allowlists and transactional restore behavior
- server-intelligence network requests
- release packaging and distribution

## Disclosure

Please allow reasonable time for validation, remediation, testing, and release preparation before publicly disclosing a sensitive vulnerability.
