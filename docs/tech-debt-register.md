# Technical Debt Register

## ⚠️ STALE — Godot-era document, superseded by the 2026-09-08 Three.js re-pivot

This register tracks debt for the removed Godot stack: `scripts/*.gd`, `addons/vrm`,
`gate_room.gd`, `room.gd`, GDScript conventions and `sprint-005` no longer exist in the
repo (web era: `src/*.js`, `tools/`). TD-001/TD-002/TD-005 reference Godot files that
were deleted; TD-003's `docs/architecture/` does not exist in the web tree. Treat as
historical intent only — re-scan the web-era codebase (`src/*.js`) before rebuilding a
register. The current forward queue lives in git history of main and the open PR stack.

Last updated: 2026-06-26 · Sprint: sprint-005
Total open items: 5 | Estimated total effort: ~XL (one large refactor + three doc writes)

Tracks **conscious** technical-debt decisions for the Godot 4.6 Stargate Universe project.
Maintained via the `/tech-debt` skill (`.claude/skills/tech-debt/`). Run `/tech-debt scan`
at least once per sprint; items open for >3 sprints must be fixed or consciously re-accepted.

Scoring: `priority = (impact × frequency) / effort`. Effort is T-shirt (S/M/L/XL).

| ID | Category | Description | Files | Effort | Impact | Priority | Added | Sprint |
|----|----------|-------------|-------|--------|--------|----------|-------|--------|
| TD-001 | Architecture | `gate_room.gd` is a 4,603-line god object — procedural scene build + cold-open cinematic + throw mechanics in one file. Plan: extract `GateThrowKit` (mechanics) + `GatePrologueDirector` (cinematic) as `Node` helpers (no `class_name`, preload pattern). | `scripts/gate_room.gd` | L | Med | Med | 2026-06-26 | Backlog |
| TD-002 | Architecture | `room.gd` is a 2,657-line god object — base room + standoff choreography cluster (~1117–1763). Plan: extract `RushStandoffDirector`, keep `_spawn_dr_rush` + a thin `_run_standoff_cinematic` forwarder. Lowest-risk extraction (tested behaviorally, not by source-text). | `scripts/room.gd` | M | Med | Med-High | 2026-06-26 | Backlog |
| TD-003 | Documentation | Missing architecture docs flagged "not blocking" in CLAUDE.md. 4 ADRs + a dependency graph exist; the synthesis docs do not. Generate via `/create-architecture`, `/create-control-manifest`. | `docs/architecture/architecture.md`, `docs/architecture/control-manifest.md`, `design/accessibility-requirements.md` | M | Low | Low | 2026-06-26 | Backlog |
| TD-005 | Dependency | VRM addon carries 15 FIXMEs / 13 TODOs around mesh/material/spring-bone handling. **Consciously accepted:** third-party plugin we do not maintain; touching it risks breaking VRM import for marginal gain. Re-evaluate only if we upgrade the addon. | `addons/vrm/*` | L | Low | Low | 2026-06-26 | Accepted |
| TD-007 | Test | Smoke suite (`tests/smoke/`) is SceneTree-based, not GDUnit4, and centred on the E1 vertical slice. Newer systems (planet gen, biomes, equipment) have lighter coverage; no real input-event simulation. Accept for slice scope; revisit if the suite outgrows the framework. | `tests/smoke/`, `tests/README.md` | M | Low | Low | 2026-06-26 | Accepted |

## Resolved / closed

| ID | Category | Description | Resolution | Closed |
|----|----------|-------------|------------|--------|
| TD-004 | Code Quality | Scan flagged ~9 scripts (`character_factory.gd`, `planet_generator.gd`, `room_builder.gd`, `ui/hud_theme.gd`, …) as having untyped `func` signatures. | **False positive** — verified all signatures and parameters are fully typed; the finding tripped on multi-line signature wraps (`-> Type` on the continuation line). No change needed; code already conforms to the typed-GDScript convention. | 2026-06-26 |
| TD-006 | Documentation | `/sound-fetch` skill still described the browser stack (Three.js `audio-manager.ts`, R2 upload via `wrangler`, `resolveAssetUrl()`, `bun run typecheck`, mp3). | Ported Steps 4–8 + format table + path convention to Godot: `Audio` autoload, in-repo `sounds/*.ogg`, `godot --headless --import` sidecar, `tests/run.sh` verify. | 2026-06-26 |
| TD-008 | Code Quality | `scripts/crew_viewer.gd.uid` was untracked (orphaned Godot import sidecar). | Committed alongside its `.gd`. | 2026-06-26 |

## Notes

- Tech debt is a tool, not a failure. Every open entry records WHY it's accepted (deadline,
  third-party, slice scope) and what would trigger a re-evaluation.
- `@no-save:` / `@collection-ok:` opt-out markers (35 across `scripts/`) were audited during
  the 2026-06-26 scan and are all justified — not tracked as debt.
