# Directory Structure

Updated 2026-10-20 for the web/Three.js era (post re-pivot from Godot, 2026-09-08).

```text
/
├── index.html                   # Entry point — loads src/main.js as ES module
├── CLAUDE.md                    # Master configuration
├── .claude/                     # Agent definitions, skills, hooks, rules, docs
├── src/                         # Game source code — 24 ES modules (.js), 3,445 LOC (flow.js on local main since commit ba80d90)
├── data/                        # Game data — 13 JSON files + AGENTS.md (chapters, ship_layout, items, etc.)
├── sounds/                      # SFX + dialog voice lines (.ogg, .wav) + music/ and dialog/ subdirs
├── models/                      # 3D models — Quaternius UAL mannequin, environment props (.glb) + Textures/
├── assets/                      # Static game assets (items/)
├── design/                      # Game design documents
│   ├── gdd/                     # Game design docs (16 files: systems-index, camera, FTL, etc.)
│   ├── data/                    # Design data (entities, lights, materials, rooms, ship-systems .json)
│   ├── concept-art/             # Concept art references (destiny-ship, gate-room, materials, ui)
│   ├── reviews/                 # Repo review notes
│   ├── sgu-opening-reference.md # Opening scene reference
│   └── voice-line-manifest.md   # Voice line manifest
├── docs/                        # Technical documentation (architecture.md, tech-debt-register, repo-learnings, audio-inventory, deployment-targets, tts-dialogue, opening scene script, hud-redesign/)
├── tests/                       # Unit tests — 28 files, 1007 tests (Node 18+ runner). On PR #197 branch, not on main.
├── tools/                       # Build/pipeline tools (edit_server.py, gen_gate_sfx.py, music-bake/, tts-bake/)
├── build.sh                     # Build script → dist/ + itch.io zip (inline vendoring, calls tools/)
├── eslint.config.js             # ESLint flat config (ES modules, browser globals). On PR #197 branch.
├── jsconfig.json                # tsc config for type-checking (noEmit). On PR #197 branch.
├── package.json                 # npm scripts (test, typecheck, lint, build). On PR #197 branch.
├── production/                  # Production management (sprints, milestones, daily notes, stage tracking)
│   ├── sprints/                 # Sprint plans
│   ├── daily-notes/             # Daily development notes
│   ├── notes/                   # Misc production notes
│   ├── next-development-plan.md # Next development plan
│   ├── perf-baseline-2026-05-21.md # Performance baseline
│   └── stage.txt                # Current stage tracker
└── .github/workflows/           # CI pipeline (ci.yml — web-game job)
```

### Removed (Godot era)

The following directories from the Godot stack no longer exist after the 2026-09-08 re-pivot:

- `scripts/` — GDScript files (replaced by `src/*.js`)
- `scenes/` — Godot `.tscn` scene files (replaced by procedural JS geometry)
- `addons/` — Godot addons including VRM integration (removed)
- `prototypes/` — Throwaway prototypes (not recreated in web era)
- `docs/engine-reference/` — Godot engine API snapshots (removed)
- `production/session-state/` and `production/session-logs/` — Not recreated
