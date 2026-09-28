# DragonStrap v2.3.3 — Layout balance

Addresses the remaining FastFlags and Settings gaps shown in the September 28 Windows screenshots. FastFlags controls flow into balanced columns rather than rigid shared grid rows; Settings shortcuts fill the space beside General. The one-click Verify-UI.cmd workflow remains included. Automated checks pass; Windows visual verification remains necessary.

## Publishing checklist

This source update does not contain a built Windows executable. Before publishing v2.3.3 on GitHub Releases, run `Verify-UI.cmd` on Windows, build both Portable and Setup x64 executables, and upload `SHA256SUMS.txt` generated from those exact files. Verify the hashes and launch each package. The Update Center consumes published assets and must not be offered a source ZIP as a binary update.

## Upgrade summary from v2.0.4

The intervening source releases improve UI/UX, dashboard status, Settings defaults, backup reliability, first-run guidance, launch targets, and saved-profile workflow. Existing settings remain local; first-run completion migrates existing installations as completed. Review the changelog for individual version details.
