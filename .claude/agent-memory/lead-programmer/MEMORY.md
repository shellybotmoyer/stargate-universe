# Lead Programmer — Agent Memory

> ## ⚠️ STALE — Godot/Unity/Unreal-era harness notes, repo re-pivoted to Three.js (2026-09-08)
>
> This memory file is a leftover of the multi-engine Claude harness (Godot/Unity/Unreal)
> removed by `abfb5ed` ("chore: remove godot, kenney kit, vite/ggez and mixamo tooling;
> move the three.js game to the repo root"). The engine-convention bullets below reference
> deleted paths (`scripts/gate_room.gd`, the `.claude/agent-memory/godot-gdscript-specialist/`
> dir, `.tscn` scenes) and the old `.claude/agents/*specialist` roster — none exist in the
> web-era tree. Rebuild against the Three.js codebase (`src/`, `index.html`, `build.sh`)
> before relying on any of this in a new session.

## Skill Authoring Conventions

### Frontmatter
- Fields: `name`, `description`, `argument-hint`, `user-invocable`, `allowed-tools`
- Read-only analysis skills that run in isolation also carry `context: fork` and `agent:`
- Interactive skills (write files, ask questions) do NOT use `context: fork`
- `AskUserQuestion` is a usage pattern described in skill body text — it is NOT listed
  in `allowed-tools` frontmatter (no existing skill does this)

### File Layout
- Skills live in `.claude/skills/<name>/SKILL.md` (subdirectory per skill, never flat .md)
- Section headers use `##` for phases, `###` for sub-sections
- Phase names follow "Phase N: Verb Noun" pattern (e.g., "Phase 1: Find the Story")
- Output format templates go in fenced code blocks

### Known Canonical Paths (verify before referencing in new skills)
- Tech debt register: `docs/tech-debt-register.md` (NOT `production/tech-debt.md`)
- Sprint files: `production/sprints/`
- Epic story files: `production/epics/[epic-slug]/story-[NNN]-[slug].md`
- Control manifest: `docs/architecture/control-manifest.md`
- Session state: `production/session-state/active.md`
- Systems index: `design/gdd/systems-index.md`
- Engine reference: `docs/engine-reference/[engine]/VERSION.md`

### Skills Completed
- `story-done` — end-of-story completion handshake (Phase 1-8, writes story file)

## Cross-cutting Engine Conventions (Watch For)

> The conventions below were Godot-era and reference deleted files (`scripts/gate_room.gd`,
> `scripts/kenney_room.gd`, `.tscn` scenes). They do NOT apply to the web-era Three.js
> codebase (`src/*.js`). Rebuild conventions from the live source before relying on them.
> Key web-era patterns: Three.js scene graph in `src/main.js`, component geometry in
> `src/components.js`, ship layout driven by `data/ship_layout.json` IDs.
