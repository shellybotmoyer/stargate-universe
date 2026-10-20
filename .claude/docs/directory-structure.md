# Directory Structure

Updated 2026-10-20 for the web/Three.js era (post re-pivot from Godot, 2026-09-08).

```text
/
├── index.html                   # Entry point — loads src/main.js as ES module
├── CLAUDE.md                    # Master configuration
├── .claude/                     # Agent definitions, skills, hooks, rules, docs
├── src/                         # Game source code — 24 ES modules (.js), 3,445 LOC
├── data/                        # Game data — 13 JSON files (chapters, ship_layout, items, etc.)
├── sounds/                      # SFX + dialog voice lines (.wav)
├── models/                      # 3D models — Quaternius UAL mannequin (.glb)
├── assets/                      # Static game assets (items/)
├── design/                      # Game design documents
│   ├── gdd/                     # Game design docs (systems-index, camera, FTL, etc.)
│   └── reviews/                 # Repo review notes
├── docs/                        # Technical documentation (architecture.md, tech-debt-register, learnings)
├── tests/                       # Unit tests — 28 files, 1007 tests (Node 18+ runner). On PR #197 branch, not on main.
├── tools/                       # Build/pipeline tools (vendor.py, tts-bake/, edit_server.py, zip.py)
├── build.sh                     # Build script → tools/vendor.py → dist/ + itch.io zip
├── eslint.config.js             # ESLint flat config (ES modules, browser globals). On PR #197 branch.
├── jsconfig.json                # tsc config for type-checking (noEmit). On PR #197 branch.
├── package.json                 # npm scripts (test, typecheck, lint, build)
├── production/                  # Production management (sprints, milestones, daily notes)
│   ├── sprints/                 # Sprint plans
│   ├── daily-notes/             # Daily development notes
│   └── notes/                   # Misc production notes
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
