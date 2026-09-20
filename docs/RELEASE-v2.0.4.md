# DragonStrap v2.0.4 — Roblox Overview Status Polish

## Scope

This hotfix makes the Home Roblox Overview present real installation/build state without decorative pseudo-metrics.

## Changes

- Player and Studio display their actual detected `version-*` build folder identifiers with explicit labels.
- Removed the old stripping of the `version-` prefix that made build IDs look like unexplained numbers.
- Converted the three overview rings from arbitrary percentage arcs into status dials.
- Player/Studio report READY or MISSING based on local detection.
- Channel reports the actual selected channel display name and identifies LIVE as official production.
- No install, launch, update, channel, or Studio behavior changed.

## Core API

Core API remains `2.0.0`; this is a presentation/state-clarity hotfix.
