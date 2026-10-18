---
paths:
  - "src/components.js"
  - "src/destination.js"
  - "src/gate-room.js"
  - "src/ship.js"
  - "src/stargate.js"
  - "src/wormhole.js"
---

# Engine Code Rules

> **Web-era note:** The repo uses flat `src/*.js` modules (no `src/core/` directory).
> Engine-layer modules are the scene/world builders: `components.js`, `destination.js`,
> `gate-room.js`, `ship.js`, `stargate.js`, `wormhole.js`. Three.js 0.180 is loaded via
> import map — there is no `docs/engine-reference/` directory; consult the
> [Three.js docs](https://threejs.org/docs/) and `.claude/docs/technical-preferences.md`
> for engine version and conventions.

- ZERO allocations in hot paths (update loops, rendering, physics) — pre-allocate, pool, reuse
- All engine APIs must be thread-safe OR explicitly documented as single-thread-only
- Profile before AND after every optimization — document the measured numbers
- Engine code must NEVER depend on gameplay code (strict dependency direction: engine <- gameplay)
- Every public API must have usage examples in its doc comment
- Changes to public interfaces require a deprecation period and migration guide
- Use RAII / deterministic cleanup for all resources
- All engine systems must support graceful degradation

## Examples

**Correct** (zero-alloc hot path):

```javascript
// Pre-allocated array reused each frame
const _nearbyCache = [];

function physicsUpdate(delta) {
  _nearbyCache.length = 0;  // Reuse, don't reallocate
  spatialGrid.queryRadius(position, radius, _nearbyCache);
}
```

**Incorrect** (allocating in hot path):

```javascript
function physicsUpdate(delta) {
  const nearby = [];  // VIOLATION: allocates every frame
  nearby = scene.getObjectsInGroup("enemies");  // VIOLATION: scene query every frame
}
```
