# Archive — Browser-Stack Sprints (Pre-Pivot)

Sprints 1–4 were planned and (partially) executed against the **browser stack**:
Three.js + WebGPU + ggez (`@kopertop/vibe-game-engine`) + Crashcat physics + VRM
characters + TypeScript + Vite. They live here as historical reference.

## What actually shipped

| Sprint | Branch | Status |
|---|---|---|
| Sprint 1 (`sprint-001.md`) | `main` | Shipped — see `sprint-001-retro.md` |
| Sprint 2 (`sprint-002.md`) | `main` | Partial — wall colliders + Kino Remote slipped |
| Sprint 3 (`sprint-003.md`) | `main` | Partial — VRM cinematic + save/load + Lt. Scott landed |
| Sprint 4 (`sprint-004.md`) | _never started_ | All tasks (DRACO/Meshopt/KTX2/EffectComposer/leva) are Three.js-specific |

## Why archived

These sprints were planned against the pre-pivot browser stack (Three.js +
WebGPU + ggez + TypeScript + Vite). The 2026-09-08 re-pivot (`abfb5ed`, merged
via #188/#190) removed the Godot-era branch and tooling entirely and landed the
web-era Three.js game at the repo root (`src/*.js`, `index.html`, `build.sh`).
The current stack is plain Three.js via CDN import map — no ggez/Crashcat, no
TypeScript/Vite bundling (see `.claude/docs/technical-preferences.md`). The
sprint task lists (DRACO, EffectComposer, leva, VRM) do not map onto the current
tree as written; they live here as historical reference only.

Resumption of the web-era roadmap is tracked by the open PR stack (#191-#195)
and the `production/sprints/sprint-005*` notes (marked stale — Godot-era).
