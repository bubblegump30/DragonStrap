# DragonStrap v0.1.5 — Centered Dragon Watermark

## Goal
Use the supplied DragonStrap dragon artwork inside the actual application UI, with a smaller and properly centered faded treatment.

## Implementation
- Added `renderer/assets/dragon-watermark.png` from the supplied transparent PNG.
- The watermark is attached to `.content-area`, so it is centered in the main application content rather than the full window or sidebar.
- Desktop size is responsive between 340 px and 500 px.
- Opacity is intentionally low (`0.08` desktop) so the artwork reads as a watermark, not foreground art.
- Narrower layouts reduce both watermark size and opacity.
- `pointer-events: none` guarantees the artwork cannot block any UI interaction.
- Installation Status keeps the opaque v0.1.4 panel treatment so the earlier background-bleed issue does not return.
