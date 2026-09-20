# Third-Party Notices

## NeoPurpleGUI v1.0.0

DragonStrap uses the NeoPurpleGUI package supplied by the DragonStrap project owner as the visual source of truth. The renderer stylesheet is derived directly from that supplied package and extended for DragonStrap screens.

## Fishstrap — upstream reference / lineage

MIT License

Copyright (c) 2025 returnrqt

Fishstrap source is not vendored in DragonStrap v2.0.0. This notice is retained because Fishstrap is an upstream reference for bootstrapper behavior and architecture.

## Bloxstrap — upstream lineage

MIT License

Copyright (c) 2022 pizzaboxer

Bloxstrap source is not vendored in DragonStrap v2.0.0. This notice is retained because Fishstrap is a Bloxstrap fork and DragonStrap follows that bootstrapper lineage.
DragonStrap v2.0.0 also references the small set of rendering presets retained by current Bloxstrap releases when defining its conservative FastFlag Safe Core metadata. DragonStrap implements that metadata independently and does not vendor Bloxstrap source.

The full upstream MIT license texts should be copied verbatim alongside any upstream-derived source at the point that source is incorporated.

## RoValra

DragonStrap can optionally query RoValra public server-data endpoints to enrich Roblox public-server information with region, version, datacenter and uptime metadata. RoValra is a separate project and is not bundled with DragonStrap. See the RoValra project for its license and terms.

## electron-builder
Release packaging uses electron-builder (MIT License) as a development dependency.

## Integration note

DragonStrap v2.0.0 does not bundle Fishstrap, Bloxstrap, or RoValra source code or protected RoValra artwork. Public API behavior and upstream projects are referenced for interoperability and attribution only.

## Roblox deployment package interoperability

DragonStrap v2.0.0 independently implements interoperability with Roblox public deployment metadata and package manifests. Bloxstrap documentation/source was consulted to confirm public package-manifest format and known extraction-directory behavior. No Bloxstrap/Fishstrap source code is bundled in DragonStrap.
