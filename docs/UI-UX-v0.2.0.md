# DragonStrap v0.2.0 — Complete Purple Dragon UI/UX

## Design goals

- One consistent Purple Dragon visual language across every view.
- Transparent glass surfaces that preserve the dragon watermark without reducing readability.
- High-DPI controls with crisp geometry, restrained purple bloom, and predictable interaction states.
- Keyboard-accessible navigation with visible focus indicators and reduced-motion support.
- UI state synchronization so profile choices look consistent everywhere they appear.

## Architecture

The legacy NeoPurple foundation remains in `renderer/styles.css`. DragonStrap-owned v0.2.0 styling is isolated in `renderer/purple-dragon.css`, which loads afterward. This gives future releases a clean place to evolve the product design without continuing to append unrelated hotfixes to the base stylesheet.
