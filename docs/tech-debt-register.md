# Technical Debt Register

## Web-era register — rebuilt 2026-10-06 from a full `src/*.js` scan

Previous Godot-era entries (TD-001 through TD-008) are archived at the bottom.
The codebase was re-pivoted to web/Three.js on 2026-09-08; this register reflects
the current `src/*.js` (24 modules, 3,308 LOC) loaded via ES import maps.

Scoring: `priority = (impact × frequency) / effort`. Effort is T-shirt (S/M/L/XL).

| ID | Category | Description | Files | Effort | Impact | Priority | Added |
|----|----------|-------------|-------|--------|--------|----------|-------|
| TD-101 | Architecture | `main.js` is a 706-line orchestrator that owns the game loop, save/load, FTL, countdown, title screen, chapter flow, and input wiring. Growing risk of implicit coupling as features accrete. Plan: extract `saveGame`/`loadGame`/`newGame` into a `save.js` module (~40 lines), extract FTL+countdown into `ftl.js`. | `src/main.js` | M | Med | Med | 2026-10-06 |
| TD-102 | Architecture | No `package.json`, no bundler, no type-check, no linter. The project loads Three.js from CDN via import maps in `index.html`. `build.sh` vendors the same CDN files into `dist/`. This works but means: (1) no CI gate on syntax/type errors, (2) no dependency version lock file — a CDN release could silently break the game, (3) IDE tooling (autocomplete, go-to-definition) is degraded. Plan: add a minimal `package.json` with `three@0.180.0` as a devDependency for type info, a `typecheck` script using TypeScript's `--checkJs`, and a `lint` script using eslint with the `js` config. No bundler needed — import maps work fine for dev. | `index.html`, `build.sh` | L | Med | Med | 2026-10-06 |
| TD-103 | Test | Zero test files in the repo. No `tests/`, `test/`, `*.spec.js`, or `*.test.js` anywhere. The game has complex state (quest engine, RPG inventory, ship layout, save/load round-trip) with no automated verification. Plan: start with unit tests for pure-logic modules: `rpg.js` (inventory add/remove/equip, XP calc, save/load round-trip), `quest.js` (chapter loading, flag tracking), `settings.js` (defaults, persistence). Use `node:test` (built into Node 18+) — no framework dependency. | `src/rpg.js`, `src/quest.js`, `src/settings.js` | L | High | High | 2026-10-06 |
| TD-104 | ✅ Error Handling | RESOLVED 2026-10-06 — 6 silent `catch {}` blocks replaced with `catch (e) { console.warn(...) }` in rpg.js, settings.js, leveledit.js, main.js. quest.js fetch wrapped with HTTP status check. Commit on `heartbeat/pr195-replacement`. | — | S | Med | High | 2026-10-06 |
| TD-105 | ✅ Asset Loading | RESOLVED 2026-10-06 — GLTFLoader.loadAsync in player.js wrapped with .catch() (logs + rethrows). Music layer loadAsync in music.js wrapped with .catch() (skips missing layer). SFX loadAsync in main.js wrapped with try/catch per file (warns + continues). Ship layout/connections fetch in main.js wrapped with try/catch + HTTP status check (falls back to empty objects so scene still renders). Commit 4ac16c4 on `heartbeat/pr195-replacement`. | — | S | High | High | 2026-10-06 |
| TD-106 | ✅ Save System | RESOLVED 2026-10-06 — Added `SAVE_VERSION = 1` constant and `migrateSave()` function to `main.js`. `saveGame()` now writes `version: 1` into the localStorage blob. `loadGame()` calls `migrateSave()` before restoring state, treating version-less saves as v0. Future schema changes add migration steps in `migrateSave()`. Commit 3dac598 on `heartbeat/pr195-replacement`. | — | S | Med | High | 2026-10-06 |
| TD-107 | Code Quality | `components.js` (390 lines) exports a flat `COMPONENTS` registry, `DEFAULT_PROPS`, and `ROOM_PROPS` as large object literals. No JSDoc on any export. The component schema is implicit — you have to read the object to understand what fields each component expects. Plan: add JSDoc `@typedef` blocks for `Component`, `ComponentProps`, and document the registry pattern. | `src/components.js` | M | Low | Low | 2026-10-06 |
| TD-108 | Build | `build.sh` uses inline Python heredocs (`python3 - <<'PY'`) for asset vendoring and index.html rewriting. This works but is fragile — any Python version change or encoding issue breaks the build silently. The script also hardcodes the asset list (sound files, models) as a manual `cp` chain. Plan: extract the Python logic into `tools/vendor.py` and the asset manifest into `tools/assets.json` so the build is data-driven. | `build.sh` | M | Low | Low | 2026-10-06 |

## Resolved / closed

| ID | Category | Description | Resolution | Closed |
|----|----------|-------------|------------|--------|
| TD-101 through TD-108 | — | Web-era items above are all open as of 2026-10-06. | — | — |

---

## Archived: Godot-era register (2026-06-26)

These items reference files that no longer exist (`scripts/*.gd`, `addons/vrm/`,
`tests/smoke/`). Kept for historical context only.

| ID | Category | Description | Status |
|----|----------|-------------|--------|
| TD-001 | Architecture | `gate_room.gd` 4,603-line god object | **Deleted** — file removed in re-pivot |
| TD-002 | Architecture | `room.gd` 2,657-line god object | **Deleted** — file removed in re-pivot |
| TD-003 | Documentation | Missing architecture docs | **Moot** — `docs/architecture/` never created |
| TD-004 | Code Quality | Untyped GDScript signatures (false positive) | **Deleted** — no GDScript left |
| TD-005 | Dependency | VRM addon FIXMEs/TODOs | **Deleted** — addon removed in re-pivot |
| TD-006 | Documentation | `/sound-fetch` skill described browser stack | **Moot** — skill context changed |
| TD-007 | Test | SceneTree-based smoke suite | **Deleted** — `tests/smoke/` removed |
| TD-008 | Code Quality | Orphaned `.uid` sidecar | **Deleted** — no Godot imports left |

## Notes

- Tech debt is a tool, not a failure. Every open entry records WHY it's accepted
  and what would trigger a re-evaluation.
- The web-era codebase is remarkably clean: zero `TODO`/`FIXME`/`HACK` comments,
  zero `console.log` debug statements, zero `debugger` statements, no dead code
  found. The debt is structural (no tests, no build tooling, no type checking)
  rather than code-level neglect.
- Highest-value quick wins: TD-104 (error handling, effort S) and TD-105 (asset
  load error handling, effort S) — both are small changes with high impact on
  user experience when things go wrong.