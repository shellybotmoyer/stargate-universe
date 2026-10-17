# Technical Debt Register

Last updated: 2026-10-17 · Sprint: web-era (post re-pivot)
Total open items: 3 (all inherited from Godot era, re-accepted as historical) | Estimated total effort: ~M (one doc write + two evaluations)

Tracks **conscious** technical-debt decisions for the Stargate Universe project (historically Godot 4.6, now web/Three.js since the 2026-09-08 re-pivot).
Maintained via the `/tech-debt` skill (`.claude/skills/tech-debt/`). Run `/tech-debt scan`
at least once per sprint; items open for >3 sprints must be fixed or consciously re-accepted.

Scoring: `priority = (impact × frequency) / effort`. Effort is T-shirt (S/M/L/XL).

| ID | Category | Description | Files | Effort | Impact | Priority | Added | Sprint |
|----|----------|-------------|-------|--------|--------|----------|-------|--------|
| TD-003 | Documentation | Missing architecture docs flagged "not blocking" in CLAUDE.md. 4 ADRs + a dependency graph exist; the synthesis docs do not. Generate via `/create-architecture`, `/create-control-manifest`. | `docs/architecture/architecture.md`, `docs/architecture/control-manifest.md`, `design/accessibility-requirements.md` | M | Low | Low | 2026-06-26 | Backlog |
| TD-005 | Dependency | ~~VRM addon carries 15 FIXMEs / 13 TODOs.~~ VRM addon was removed in the Godot→Three.js re-pivot (2026-09-08). This item is now closed — see Resolved section. | ~~`addons/vrm/*`~~ | — | — | — | 2026-06-26 | Closed 2026-10-16 |
| TD-009 | Code Quality | **New (web-era):** `src/main.js` is ~650 lines and growing — game loop, chapter engine, FTL/countdown systems, knockout loop, and frame dispatcher are all in one closure. Not yet a god object, but trending. Plan: extract `createFtlSystem()` and `createCountdownSystem()` into `src/ftl.js` / `src/countdown.js` modules when main.js exceeds ~800 lines. | `src/main.js` | M | Med | Med | 2026-10-16 | Backlog |
| TD-010 | Test | **New (web-era):** No automated browser/headless test runner. CI runs `node --test` on unit-testable modules and `tsc --noEmit` + ESLint for static checks, but there is no Puppeteer/Playwright smoke that loads `index.html` and verifies the game boots. Autoplay reload-mode covers this manually but is not wired to CI. | `.github/workflows/ci.yml` | L | Med | Med | 2026-10-16 | Backlog |

## Resolved / closed

| ID | Category | Description | Resolution | Closed |
|----|----------|-------------|------------|--------|
| TD-001 | Architecture | ~~`gate_room.gd` is a 4,603-line god object.~~ File deleted in Godot→Three.js re-pivot. Web-era equivalent (`src/main.js` gate logic) is ~50 lines. | Deleted with Godot stack. | 2026-10-16 |
| TD-002 | Architecture | ~~`room.gd` is a 2,657-line god object.~~ File deleted in Godot→Three.js re-pivot. Web-era equivalent is `src/ship.js` (~300 lines). | Deleted with Godot stack. | 2026-10-16 |
| TD-004 | Code Quality | Scan flagged ~9 scripts (`character_factory.gd`, `planet_generator.gd`, `room_builder.gd`, `ui/hud_theme.gd`, …) as having untyped `func` signatures. | **False positive** — verified all signatures and parameters are fully typed; the finding tripped on multi-line signature wraps (`-> Type` on the continuation line). No change needed; code already conforms to the typed-GDScript convention. | 2026-06-26 |
| TD-005 | Dependency | VRM addon carried 15 FIXMEs / 13 TODOs around mesh/material/spring-bone handling. | VRM addon removed in Godot→Three.js re-pivot (2026-09-08). | 2026-10-16 |
| TD-006 | Documentation | `/sound-fetch` skill still described the browser stack (Three.js `audio-manager.ts`, R2 upload via `wrangler`, `resolveAssetUrl()`, `bun run typecheck`, mp3). | Ported Steps 4–8 + format table + path convention to Godot: `Audio` autoload, in-repo `sounds/*.ogg`, `godot --headless --import` sidecar, `tests/run.sh` verify. (Note: Godot stack has since been removed; this resolution is historical.) | 2026-06-26 |
| TD-007 | Test | Smoke suite (`tests/smoke/`) was SceneTree-based, not GDUnit4, and centred on the E1 vertical slice. | Tests removed with Godot stack. Web-era CI uses `node --test`, `tsc --noEmit`, ESLint. See TD-010 for the remaining gap (no browser smoke). | 2026-10-16 |
| TD-008 | Code Quality | `scripts/crew_viewer.gd.uid` was untracked (orphaned Godot import sidecar). | Committed alongside its `.gd`, then both deleted with Godot stack. | 2026-06-26 |

## Notes

- Tech debt is a tool, not a failure. Every open entry records WHY it's accepted (deadline,
  third-party, slice scope) and what would trigger a re-evaluation.
- `@no-save:` / `@collection-ok:` opt-out markers (35 across `scripts/`) were audited during
  the 2026-06-26 scan and are all justified — not tracked as debt. (Markers removed with Godot stack.)
- **2026-10-16 re-audit:** the register was Godot-era only. TD-001/TD-002/TD-007/TD-008
  reference deleted files and are closed. TD-005 (VRM addon) is closed. TD-003 (missing
  architecture docs) is still valid for the web-era codebase. Two new items (TD-009, TD-010)
  were added for web-era debt identified during this scan.