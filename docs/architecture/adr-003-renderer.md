# ADR-003: WebGPU Renderer with WebGL Fallback

**Status**: Accepted
**Date**: 2026-03-27
**Decision**: Use Three.js WebGPU renderer as primary, WebGL as fallback

## Context

Three.js 0.181 supports both WebGL and WebGPU renderers. WebGPU is the modern
API with better performance characteristics, but browser support is still
growing.

## Decision

Use `WebGPURenderer` from `three/webgpu` as the primary renderer. WebGL
fallback is handled by Three.js automatically when WebGPU is unavailable.

## Consequences

- `new WebGPURenderer({ antialias: true })` with `await renderer.init()`
- Shadows enabled (`renderer.shadowMap.enabled = true`) — toggle per scene
- Pixel ratio capped at 2 (`renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`)
- Materials use `MeshStandardMaterial` (PBR, works on both backends)
- Performance budget: 60 FPS / 16.6ms frame / <200 draw calls / 512MB memory
- Point lights are expensive — prefer emissive materials for accent lighting
  (validated in gate room prototype: 6 point lights + emissives = 100 FPS)
