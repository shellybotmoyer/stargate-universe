# Technical Debt Register

## Web-era register — rebuilt 2026-10-06 from a full `src/*.js` scan

Previous Godot-era entries (TD-001 through TD-008) are archived at the bottom.
The codebase was re-pivoted to web/Three.js on 2026-09-08; this register reflects
the current `src/*.js` (24 modules, 3,308 LOC) loaded via ES import maps.

Scoring: `priority = (impact × frequency) / effort`. Effort is T-shirt (S/M/L/XL).

| ID | Category | Description | Files | Effort | Impact | Priority | Added |
|----|----------|-------------|-------|--------|--------|----------|-------|
| TD-101 | Architecture | `main.js` is a 706-line orchestrator that owns the game loop, save/load, FTL, countdown, title screen, chapter flow, and input wiring. Growing risk of implicit coupling as features accrete. Plan: extract `saveGame`/`loadGame`/`newGame` into a `save.js` module (~40 lines), extract FTL+countdown into `ftl.js`. | `src/main.js` | M | Med | Med | 2026-10-06 |
| TD-102 | 🔶 Build/Type | PARTIALLY RESOLVED 2026-10-07 — Added `package.json` (devDependencies: `three@0.180.0`, `typescript@^5.6.0`; scripts: `test`, `typecheck`, `build`) and `jsconfig.json` (TypeScript `--checkJs` config with import-map path aliases for `three` and `three/addons/*`). Provides IDE type info, a `npm run typecheck` CI gate, and a dependency version lock via `package-lock.json` (after `npm install`). No bundler needed — import maps still work for dev. Remaining: run `npm install` to generate lock file (already done — `package-lock.json` committed), add eslint config. CI typecheck step committed 2026-10-09 (cfafa32) — on PR #197 branch, pending merge to main. | `package.json`, `jsconfig.json`, `index.html`, `build.sh` | L | Med | Med | 2026-10-06 |
| TD-103 | ✅ Test | PARTIALLY RESOLVED 2026-10-07 — Added 31 unit tests across 3 test files: `tests/rpg.test.js` (13 tests: save/load round-trip, log truncation, XP/leveling, inventory add/remove), `tests/settings.test.js` (6 tests: defaults, override, persistence, reset, corruption fallback), `tests/quest.test.js` (12 tests: chapter loading, flag-based step advancement, terminal detection, guard limit, world-state flag preservation). All pass with `node --test`. Uses Node 18+ built-in test runner — zero framework deps. Remaining: integration tests for save/load across modules, and main.js orchestrator tests. | `src/rpg.js`, `src/quest.js`, `src/settings.js` | L | High | High | 2026-10-06 |
| TD-104 | ✅ Error Handling | RESOLVED 2026-10-06 — 6 silent `catch {}` blocks replaced with `catch (e) { console.warn(...) }` in rpg.js, settings.js, leveledit.js, main.js. quest.js fetch wrapped with HTTP status check. Commit on `heartbeat/pr195-replacement`. Updated 2026-10-06 17:30 UTC: `knockout_lines.json` fetch (`.catch(() => {})`) also upgraded to HTTP status check + `console.warn` — last silent catch in main.js. | — | S | Med | High | 2026-10-06 |
| TD-105 | ✅ Asset Loading | RESOLVED 2026-10-06 — GLTFLoader.loadAsync in player.js wrapped with .catch() (logs + rethrows). Music layer loadAsync in music.js wrapped with .catch() (skips missing layer). SFX loadAsync in main.js wrapped with try/catch per file (warns + continues). Ship layout/connections fetch in main.js wrapped with try/catch + HTTP status check (falls back to empty objects so scene still renders). Commit 4ac16c4 on `heartbeat/pr195-replacement`. | — | S | High | High | 2026-10-06 |
| TD-106 | ✅ Save System | RESOLVED 2026-10-06 — Added `SAVE_VERSION = 1` constant and `migrateSave()` function to `main.js`. `saveGame()` now writes `version: 1` into the localStorage blob. `loadGame()` calls `migrateSave()` before restoring state, treating version-less saves as v0. Future schema changes add migration steps in `migrateSave()`. Commit 3dac598 on `heartbeat/pr195-replacement`. | — | S | Med | High | 2026-10-06 |
| TD-107 | ✅ Code Quality | RESOLVED 2026-10-06 — Added JSDoc `@typedef` blocks for `ComponentSpec`, `BuildContext`, and `ComponentDef` at the top of `components.js`. Documents the implicit component schema (type, u/v position, ry rotation, anchor, loot, style) and the build() contract so IDEs provide autocomplete and contributors don't need to read the object literal. Commit 20becfe on `heartbeat/pr195-replacement`. | — | M | Low | Low | 2026-10-06 |
| TD-108 | ✅ Build | RESOLVED 2026-10-07 — Extracted inline Python heredocs from `build.sh` into `tools/vendor.py` (standalone module: `vendor_addons()`, `rewrite_index()`, `main()`). `build.sh` now calls `python3 tools/vendor.py` instead of using `<<'PY'` heredocs. Vendor logic is now testable and data-driven. Asset manifest extraction deferred (the `cp` chain is stable and documented). | `build.sh`, `tools/vendor.py` | M | Low | Low | 2026-10-07 |

## Resolved / closed

| ID | Category | Description | Resolution | Closed |
|----|----------|-------------|------------|--------|
| TD-104 | Error Handling | Silent `catch {}` blocks | ✅ Resolved 2026-10-06 | 2026-10-06 |
| TD-105 | Asset Loading | Missing error handling on GLTFLoader/fetch | ✅ Resolved 2026-10-06 | 2026-10-06 |
| TD-106 | Save System | No save versioning or migration | ✅ Resolved 2026-10-06 | 2026-10-06 |
| TD-107 | Code Quality | Missing JSDoc typedefs for component schema | ✅ Resolved 2026-10-06 | 2026-10-06 |
| TD-103 | Test | Zero test files — no automated verification | ✅ Partially resolved 2026-10-07 — 31 unit tests added (rpg, settings, quest) | 2026-10-07 |

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