# Archived Documentation (Godot-era / pre-re-pivot)

These documents describe the removed Godot 4.6 and Vite/Cloudflare/bun stacks.
The project re-pivoted to web/Three.js on 2026-09-08. None of the file paths,
code references, or tooling instructions in these files apply to the current
codebase (`src/*.js`, `tools/`).

They are kept for historical context only.

## Contents

| File | Era | Notes |
|---|---|---|
| `audio-inventory.md` | Godot | Audio catalog for `src/systems/audio/sound-catalog.ts` (removed) |
| `deployment-targets.md` | Vite/Cloudflare | PWA/Electron/iPad plan for the Vite stack (removed) |
| `repo-learnings.md` | Godot | Full-repo review of the Godot 4.6 codebase |
| `tts-dialogue.md` | Godot | LuxTTS sidecar + `TTSClient` GDScript integration |
| `hud-redesign/HANDOFF.md` | Godot | HUD redesign handoff notes |

## Current documentation

Active, web-era docs live in `docs/`:
- `architecture.md` — web-era architecture, module graph, core systems
- `tech-debt-register.md` — conscious tech-debt decisions (web-era)
- `OPENING_SCENE_SCRIPT.md` — canonical dialogue transcript (implementation
  pointers are Godot-era and stale, but the dialogue itself is canonical)