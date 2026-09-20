# DragonStrap v1.5.1 — Performance Profile Layout Hotfix

## Scope

This hotfix corrects the Performance Center 2.0 built-in profile cards at wide desktop layouts where the Performance Profile card occupies one grid column.

## Fixes

- Rebuilt the four built-in preset buttons with explicit icon and text regions.
- Added bounded text columns so `Performance` cannot spill into the adjacent `Quality` card.
- Normalized title and configuration-summary baselines across Default, Balanced, Performance and Quality.
- Reduced internal icon/text footprint without reducing the surrounding Performance Center card.
- Added wrapping for the descriptive line while keeping preset titles on one line.
- Preserved all v1.5.0 hardware detection, recommendations, per-experience profiles and live process logic unchanged.

## Compatibility

No settings schema, FastFlag ownership, IPC, hardware detection, launch behavior, or Performance+ application logic changed in v1.5.1.
