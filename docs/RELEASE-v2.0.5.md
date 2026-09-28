# DragonStrap v2.0.5 — UI/UX Cleanup

- Removed inherited feature-card and sidebar minimum heights that created unused space.
- Standardized content gaps, heading wrapping, and action-button spacing.
- Adjusted header, navigation, channel controls, and performance forms for narrower windows.
- Wrapped long hardware, runtime, and configuration values instead of truncating them.
- Added accessible labels and tooltips to compact navigation and Home shortcuts.
- Removed historical release prefixes from feature badges; feature and Core API versions remain intact.
- Bounded Help dialog height and allowed footer wrapping.
- Preserved the black/purple NeoPurpleGUI styling and Core API 2.0.0.

This is a presentation release. Installation, launch, update, and configuration behavior is unchanged.

## Validation

- Source checks passed.
- All 148 automated tests passed.
- Release verification passed.
- Windows runtime and visual resize checks remain outstanding; a browser was unavailable in the build environment.
- Source package only; Windows executables have not been built or signed for this release.
