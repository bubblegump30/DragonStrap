# DragonStrap v0.1.2 — UI/UX Precision Pass

This hotfix addresses the layout regression observed at the default 1600 px DragonStrap window.

## Corrected
- Header now has explicit brand, centered motto, and right-side action columns.
- Search, refresh, avatar, and version identity remain pinned to the right instead of occupying the motto column.
- The center motto remains visually centered within its dedicated central lane without overlap.
- PLAY control reduced to a 156 px primary diameter with tighter rings and no center pointer line.
- Focus-visible states are consistent across keyboard-accessible controls.
- v0.1.1 native vertical slider layout is retained.

## Design target
NeoPurpleGUI remains the visual source of truth. This pass changes geometry and rendering precision only; it does not flatten or replace the design language.
