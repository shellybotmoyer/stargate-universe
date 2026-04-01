# ggez Engine Patterns Reference

## Scene Lifecycle

Scenes are the core unit of content in ggez. Each scene is a directory under
`src/scenes/<scene-id>/` containing:

```
src/scenes/<scene-id>/
  index.ts              — Scene definition (GameSceneDefinition export)
  scene.runtime.json    — World Editor export (geometry, physics, lights, entities)
  assets/               — Scene-local assets (models, textures)
```

### Scene Definition

```typescript
export const myScene = defineGameScene({
  id: "my-scene",
  source: createColocatedRuntimeSceneSource({
    assetUrlLoaders,
    manifestLoader: () => import("./scene.runtime.json?raw").then(m => m.default)
  }),
  title: "My Scene",
  player: { cameraMode: "third-person" },
  mount: async (context) => {
    // context.scene — Three.js Scene
    // context.camera — PerspectiveCamera
    // context.physicsWorld — CrashcatPhysicsWorld
    // context.player — StarterPlayerController | null
    // context.renderer — WebGPURenderer
    // context.runtimeScene — ThreeRuntimeSceneInstance
    // context.gotoScene(id) — Scene transition
    return {
      update(delta) { /* per-frame render callback */ },
      fixedUpdate(fixedDelta) { /* per-physics-step callback */ },
      dispose() { /* cleanup */ }
    };
  }
});
```

### Scene Loading Flow

1. `source.load()` fetches `.runtime.json` manifest
2. `createThreeRuntimeSceneInstance()` instantiates Three.js objects
3. `createCrashcatPhysicsWorld()` creates physics from scene settings
4. `createRuntimePhysicsSession()` creates physics bodies from scene geometry
5. Gameplay runtime starts (`createGameplayRuntime()`)
6. Player controller spawns at `player-spawn` entity
7. `mount()` hook called — add custom objects, logic, lifecycle

### Auto-Discovery

Scenes in `src/scenes/<id>/` are auto-discovered by the ggez Vite plugin
(`createWebHammerGamePlugin`). No manual registration needed.

## Physics (Crashcat)

### Creating Physics Bodies

Physics bodies are automatically created from `.runtime.json` nodes that have
`physics.enabled: true`. For programmatic bodies:

```typescript
import { rigidBody, capsule, MotionType, MotionQuality } from "@ggez/runtime-physics-crashcat";

const body = rigidBody.create(physicsWorld, {
  motionType: MotionType.DYNAMIC,
  motionQuality: MotionQuality.LINEAR_CAST,
  position: [x, y, z],
  shape: capsule.create({ halfHeightOfCylinder: 0.5, radius: 0.3 }),
  friction: 0.8,
  linearDamping: 0.8
});
```

### Raycasting

```typescript
import { castRay, createClosestCastRayCollector, createDefaultCastRaySettings, filter } from "@ggez/runtime-physics-crashcat";

const collector = createClosestCastRayCollector();
const settings = createDefaultCastRaySettings();
const rayFilter = filter.create(physicsWorld.settings.layers);

castRay(physicsWorld, collector, settings, origin, direction, maxDistance, rayFilter);
if (collector.hit.status === CastRayStatus.COLLIDING) {
  // collector.hit.bodyIdB, collector.hit.fraction
}
```

### Fixed Timestep

Physics steps at 1/60s fixed rate with accumulator-based stepping:
- `updateBeforeStep()` — apply forces/velocities
- `stepCrashcatPhysicsWorld()` — physics simulation
- `syncVisuals()` — copy physics positions to Three.js objects
- `updateAfterStep()` — camera, post-step logic

Adaptive physics (added in prototype): step rate drops to 20Hz under load.

## Runtime Scene Format (.runtime.json)

### Key Structures

- `nodes[]` — Scene objects: `kind: "primitive"` (brushes) or `kind: "light"`
- `entities[]` — Non-visual markers: `type: "player-spawn"`, triggers, etc.
- `materials[]` — PBR material definitions (color, metallic, roughness)
- `settings.player` — Camera mode, movement speed, jump height
- `settings.world` — Gravity, fog, ambient light, physics enabled

### Primitive Node Physics

```json
{
  "data": {
    "physics": {
      "bodyType": "fixed",
      "colliderShape": "trimesh",
      "friction": 0.9,
      "enabled": true
    },
    "shape": "cube",
    "size": { "x": 16, "y": 1, "z": 20 }
  },
  "geometry": { "primitives": [{ "positions": [...], "normals": [...], "indices": [...] }] }
}
```

## Gameplay Runtime

### System Registration

```typescript
const gameplayRuntime = createGameplayRuntime({
  host: gameplayHost,
  scene: createGameplayRuntimeSceneFromRuntimeScene(runtimeScene.scene),
  systems: [...defaultSystems, ...customSystems]
});
gameplayRuntime.start();
// Called every frame:
gameplayRuntime.update(delta);
```

### Default Systems

`createDefaultGameplaySystems()` provides: triggers, sequences, openables, movers,
path movers. Custom systems extend these via `mergeGameplaySystems()`.

## Performance Notes (from prototype)

- **Point lights**: Expensive. Keep under 8 per visible area. Use emissive materials
  (`MeshStandardMaterial` with `emissive` + `emissiveIntensity`) for accent glow.
- **Shadows**: Expensive. Disable during prototyping (`renderer.shadowMap.enabled = false`).
- **Wall raycasting**: Throttle to every 3rd frame. Cache results.
- **LatheGeometry**: Use for custom ring/band cross-sections (flat Stargate ring).
- **Debug mode**: Double-backtick toggle for FPS overlay + SpotLightHelper cones.
