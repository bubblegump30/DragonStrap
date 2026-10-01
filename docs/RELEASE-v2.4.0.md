# DragonStrap v2.4.0 — Everyday QoL

This is an unreleased source update. The latest published Windows Setup and Portable executables remain v2.3.3.

## Changes

- Home shows whether Player and optional Studio are detected, plus when the last successful scan finished. A failed retry does not present an older result as a fresh check.
- Home Play shows the selected session preset and whether automatic Performance settings are enabled.
- FastFlags has a visible pending count in the sidebar and a sticky review shortcut while changes are queued. Apply still uses the validated before/after preview.
- Windows CI runs source checks, unit tests, release verification, and the desktop layout check at multiple window sizes and scaling levels.

## Before a Windows release

Run the UI check on a Windows desktop, test the affected controls against real Player installations, build Setup and Portable x64, verify both packages launch, and publish `SHA256SUMS.txt` generated from the final files. Do not use a source archive as an Update Center binary.
