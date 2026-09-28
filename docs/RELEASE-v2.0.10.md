# DragonStrap v2.0.10 — Windows UI Verification

## Layout corrections

- Give desktop dashboard columns explicit zero minimum widths so long status text cannot force horizontal overflow.
- Let additional dashboard rows size to content at all breakpoints.
- Remove the legacy fixed-row behavior below 1350 CSS pixels, including at high display scaling.
- Keep all Installation Status rows within their card and bound the Help/About menu to the viewport.

## Windows verification gate

After `npm install`, run `npm run ui:verify`. The Electron harness loads the real renderer styles and assets without Roblox services. It checks five window and zoom combinations for horizontal overflow, Channel-row containment, card overlap, popup viewport bounds, and whether Help/About receives pointer hits above page content. Any failure exits nonzero.

Automated source checks and tests run in the development environment. The Electron layout gate must still be run on Windows before claiming visual verification or publishing compiled installers; the execution environment here lacks an Electron browser binary.
