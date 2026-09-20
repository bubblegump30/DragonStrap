# DragonStrap Core API v2

Core API version: `2.0.0`

## Purpose

The Core API is DragonStrap's stable process boundary for architecture/runtime metadata. It is not a public arbitrary-code plugin API.

The preload object exposes:

```text
window.dragonStrap.apiVersion
window.dragonStrap.getCoreState()
```

`getCoreState()` returns read-only metadata for:

- registered service names, contract versions, stability, and capabilities
- exclusive core operation state
- bootstrap pipeline state
- built-in extension manifests
- supported extension-point definitions
- whether external plugin loading is enabled

## Compatibility policy

- Existing v1.x preload methods remain supported throughout the v2.0 line unless a documented replacement exists.
- New core contracts receive an explicit contract version.
- Renderer code must not receive raw Node.js service objects.
- Paths and process execution targets continue to be resolved in trusted main-process services.

## Plugin policy in v2.0.0

External plugins are disabled. DragonStrap 2.0 only defines extension contracts and registers built-in manifests. A future external-plugin release must define permissions, isolation, signing/trust, compatibility negotiation, and safe failure behavior before third-party code loading is enabled.
