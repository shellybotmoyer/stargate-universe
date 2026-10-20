# Technical Debt Register

Last updated: 2026-10-19 (heartbeat — TD-003 closed: architecture.md generated for web-era codebase) · Sprint: web-era (post re-pivot)
Total open items: 2 (TD-009/010 web-era) | Estimated total effort: ~M-L

Tracks **conscious** technical-debt decisions for the Stargate Universe project (historically Godot 4.6, now web/Three.js since the 2026-09-08 re-pivot). All Godot-era items (TD-001 through TD-008) are archived as historical — their code references point to removed `.gd`/`.tscn` files.
Maintained via the `/tech-debt` skill (`.claude/skills/tech-debt/`). Run `/tech-debt scan`
at least once per sprint; items open for >3 sprints must be fixed or consciously re-accepted.

Scoring: `priority = (impact × frequency) / effort`. Effort is T-shirt (S/M/L/XL).

| ID | Category | Description | Files | Effort | Impact | Priority | Added | Sprint |
|----|----------|-------------|-------|--------|--------|----------|-------|--------|
| TD-009 | Code Quality | `src/main.js` is ~702 lines — game loop, chapter engine, FTL/countdown systems, knockout loop, and frame dispatcher all in one closure. Not yet a god object, but trending. Plan: extract `createCountdownSystem()` into `src/countdown.js` (FTL already extracted on PR #197 branch as `src/ftl.js` via TD-101 — awaiting merge). Re-evaluate after PR #197 lands. | `src/main.js` | M | Med | Med | 2026-10-17 | Backlog |
| TD-010 | Test | **New (web-era):** No automated browser/headless test runner. CI runs `node --test` on unit-testable modules and `tsc --noEmit` + ESLint for static checks, but there is no Puppeteer/Playwright smoke that loads `index.html` and verifies the game boots. Autoplay reload-mode covers this manually but is not wired to CI. | `.github/workflows/ci.yml` | L | Med | Med | 2026-10-16 | Backlog |

## Resolved / closed

| ID | Category | Description | Resolution | Closed |
|----|----------|-------------|------------|--------|
| TD-001 | Architecture | ~~`gate_room.gd` is a 4,603-line god object.~~ File deleted in Godot→Three.js re-pivot. Web-era equivalent (`src/main.js` gate logic) is ~50 lines. | Deleted with Godot stack. | 2026-10-16 |
| TD-002 | Architecture | ~~`room.gd` is a 2,657-line god object.~~ File deleted in Godot→Three.js re-pivot. Web-era equivalent is `src/ship.js` (~300 lines). | Deleted with Godot stack. | 2026-10-16 |
| TD-003 | Documentation | Missing architecture docs flagged "not blocking" in CLAUDE.md. 4 ADRs + a dependency graph existed in the Godot era; the synthesis docs did not. | **Closed 2026-10-19:** `docs/architecture.md` generated for the web-era codebase — covers technology stack, 24-module graph (3,445 LOC on local main; 25 with PR #197's `ftl.js` + `save.js`), core data flow, key systems (quest engine, FTL rhythm, knockout loop, countdowns, ship layout, component system, mini-games, save/load, autoplay), CI pipeline, file layout, and known debt. | 2026-10-19 |
| TD-004 | Code Quality | Scan flagged ~9 scripts (`character_factory.gd`, `planet_generator.gd`, `room_builder.gd`, `ui/hud_theme.gd`, …) as having untyped `func` signatures. | **False positive** — verified all signatures and parameters are fully typed; the finding tripped on multi-line signature wraps (`-> Type` on the continuation line). No change needed; code already conforms to the typed-GDScript convention. | 2026-06-26 |
| TD-005 | Dependency | VRM addon carried 15 FIXMEs / 13 TODOs around mesh/material/spring-bone handling. | VRM addon removed in Godot→Three.js re-pivot (2026-09-08). | 2026-10-16 |
| TD-006 | Documentation | `/sound-fetch` skill still described the browser stack (Three.js `audio-manager.ts`, R2 upload via `wrangler`, `resolveAssetUrl()`, `bun run typecheck`, mp3). | Ported Steps 4–8 + format table + path convention to Godot: `Audio` autoload, in-repo `sounds/*.ogg`, `godot --headless --import` sidecar, `tests/run.sh` verify. (Note: Godot stack has since been removed; this resolution is historical.) | 2026-06-26 |
| TD-007 | Test | Smoke suite (`tests/smoke/`) was SceneTree-based, not GDUnit4, and centred on the E1 vertical slice. | Tests removed with Godot stack. Web-era CI on origin/main currently runs `node --check` (syntax), JSON validation, and itch.io build only — no `node --test`, `tsc`, or ESLint (those are on PR #197's branch, see TD-102/TD-103). See TD-010 for the remaining gap (no browser smoke). | 2026-10-16 |
| TD-008 | Code Quality | `scripts/crew_viewer.gd.uid` was untracked (orphaned Godot import sidecar). | Committed alongside its `.gd`, then both deleted with Godot stack. | 2026-06-26 |
| TD-101 | Architecture | FTL rhythm + countdown system inline in `src/main.js` closure — bloats the game-loop file. | Extraction shipped on PR #197 branch (commit c4a67c9: `src/ftl.js` 167 LOC, `createFtlSystem(ctx)` DI pattern). **Not yet on origin/main** — PR #197 awaits maintainer merge. main.js on local main is still 702 lines with FTL+countdown inline (lines 196–250). Re-evaluate after PR #197 merges. | 2026-10-17 |
| TD-102 | Code Quality | No linter — silent code-style drift, dead variables, missing optional chaining. | Added `eslint.config.js` (flat config, ES modules, browser globals + THREE readonly). CI lint step added (commit bfbcd3c). **Not yet on origin/main** — both the config and the CI lint step live on PR #197's branch. origin/main has no eslint config and no lint CI step. Re-evaluate after PR #197 merges. | 2026-10-17 |
| TD-103 | Test | Unit test coverage gap — only a few of 25 source modules had tests. | Added 28 test files covering all 25 source modules: 943 unit tests across `tests/*.test.js`. Uses Node 18+ built-in runner, mock ctx pattern, no framework deps. **Not yet on origin/main** — the `tests/` directory and CI `node --test` step live on PR #197's branch. origin/main has no `tests/` directory and no test CI step. Re-evaluate after PR #197 merges. | 2026-10-17 |
| TD-104 | Code Quality | Silent `catch {}` blocks in `src/main.js` swallow errors invisibly — debugging blind spots. | Replaced last 2 silent catch blocks (`saveGame` catch, `knockout_lines.json` fetch `.catch(() => {})`) with `console.warn`. Fullscreen `.catch?.(() => {})` intentionally left (expected user-gesture failure). Commit 2470e9f. **Main branch follow-up (2026-10-18):** remaining silent `catch {}` blocks in `settings.js`, `rpg.js` (save/load), and `leveledit.js` (live layout) also replaced with `console.warn`. Commit 12150b4. **Final sweep (2026-10-18):** last 2 silent catches in `src/recorder.js` (frame upload chain) and `tools/edit_server.py` (indentation detection) replaced with `console.warn`/`stderr`. Commit 2f93ec9. **Final final sweep (2026-10-19):** two remaining silent catches in `src/input.js` (pointerLock) and `src/main.js` (requestFullscreen) replaced with `console.warn`. All silent catches now truly gone across `src/` and `tools/`. | 2026-10-19 |

## Notes

- Tech debt is a tool, not a failure. Every open entry records WHY it's accepted (deadline,
  third-party, slice scope) and what would trigger a re-evaluation.
- `@no-save:` / `@collection-ok:` opt-out markers (35 across `scripts/`) were audited during
  the 2026-06-26 scan and are all justified — not tracked as debt. (Markers removed with Godot stack.)
- **2026-10-16 re-audit:** the register was Godot-era only. TD-001/TD-002/TD-007/TD-008
  reference deleted files and are closed. TD-005 (VRM addon) is closed. TD-003 (missing
  architecture docs) is now closed — `docs/architecture.md` generated 2026-10-19. Two new items (TD-009, TD-010)
  were added for web-era debt identified during this scan.
- **2026-10-18 update:** added 4 resolved items (TD-101 through TD-104) tracking the
  web-era module-extraction, lint, test-coverage, and silent-catch work shipped on the
  `heartbeat/pr195-replacement` branch (PR #197). All four were referenced by commit
  messages but absent from the register — now recorded for audit completeness.
  **Accuracy correction (same heartbeat):** TD-101 and TD-102/103/104 resolutions all
  live on PR #197's branch, not on origin/main. The register previously implied these were
  resolved on origin/main. TD-101 resolution text now explicitly states "Not yet on origin/main" —
  main.js on local main is still 702 lines with FTL+countdown inline. TD-009 updated to
  reflect FTL extraction is done (on PR branch) and only countdown extraction remains.