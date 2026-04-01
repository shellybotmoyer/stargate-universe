# ADR-001: Use ggez + vanilla Three.js (not React Three Fiber)

**Status**: Accepted
**Date**: 2026-03-27
**Decision**: Use ggez framework with direct Three.js scene control

## Context

The game needs a 3D engine for web deployment. Options considered:
- React Three Fiber (R3F) — React wrapper around Three.js
- ggez — Three.js game framework with scene editor, physics, animation pipeline
- Raw Three.js — No framework

## Decision

Use ggez with vanilla Three.js APIs. ggez provides:
- World Editor for scene authoring (`.runtime.json` exports)
- Crashcat physics engine (built-in)
- Animation pipeline (`@ggez/anim-*`)
- Gameplay runtime with system registration
- Scene management with preloading

Direct Three.js access (not R3F) gives full control over the render loop,
scene graph, and lifecycle — critical for a game with complex scene transitions
(ship → gate → planet) and custom camera systems.

## Consequences

- Scenes authored in ggez World Editor, loaded as `.runtime.json`
- Custom gameplay via `mount()` hooks + Three.js APIs
- No React in the render path (better frame budget control)
- Must learn ggez-specific patterns (scene sources, gameplay runtime)
