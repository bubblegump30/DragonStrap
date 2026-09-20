# DragonStrap v1.1.0 — Roblox Installation & Update Engine

This feature release adds transactional Roblox Player installation/update behavior to the v1.0.0 stable baseline.

## Release gates

- Source validation passes.
- JavaScript syntax checks pass.
- Full Node test suite passes.
- UI selector audit reports no missing referenced IDs.
- Release verification passes with VERSION/package/renderer metadata synchronized.
- Windows package build should be tested on a Windows 10/11 system before publishing binaries.
- At least one live Roblox Player install/update should be verified against the production channel before marking the GitHub release stable.

## Important operational note

The automated tests use controlled package/manifests and do not substitute for a live Roblox CDN installation test. DragonStrap fails closed on package names it does not recognize, so Roblox can introduce a new package that requires a DragonStrap mapping update before installation proceeds.
