# ADR-002: Use Crashcat Physics (not Rapier)

**Status**: Accepted
**Date**: 2026-03-27
**Decision**: Use Crashcat exclusively for all physics simulation

## Context

The game needs physics for character movement, collision detection, and
raycasting. Options:
- Rapier (popular Rust-based WASM physics)
- Crashcat (ggez built-in physics engine)

## Decision

Crashcat exclusively. Never Rapier.

Crashcat is ggez's built-in physics engine, tightly integrated with the scene
pipeline and gameplay runtime. It provides:
- Rigid bodies (dynamic + fixed)
- Capsule colliders (player character)
- Trimesh colliders (static environment from `.runtime.json`)
- Raycasting with configurable filters
- Contact detection for ground probing

## Consequences

- Physics bodies created from runtime scene data automatically
- Player controller uses Crashcat capsule + raycast ground probing
- Fixed timestep at 1/60s with accumulator-based stepping
- No dual-physics-engine complexity
- All physics code uses `@ggez/runtime-physics-crashcat` APIs
