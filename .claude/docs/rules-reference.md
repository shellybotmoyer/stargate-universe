# Path-Specific Rules

Rules in `.claude/rules/` are automatically enforced when editing files in matching paths:

> **Web-era note (2026-09-08 re-pivot):** The repo now uses flat `src/*.js` modules.
> Path patterns below reflect the actual `paths:` frontmatter in each rule file.
> Rules with `paths: []` do not match any files in the current single-player Three.js game.

| Rule File | Path Pattern | Enforces |
| ---- | ---- | ---- |
| `gameplay-code.md` | `src/main.js`, `src/rpg.js`, `src/quest.js`, `src/flow.js`, `src/interact.js`, `src/ancient.js`, `src/hotwire.js`, `src/input.js`, `src/player.js`, `src/kino.js` | Data-driven values, delta time, no UI references |
| `engine-code.md` | `src/components.js`, `src/destination.js`, `src/gate-room.js`, `src/ship.js`, `src/stargate.js`, `src/wormhole.js` | Zero allocs in hot paths, thread safety, API stability |
| `ai-code.md` | `paths: []` _(no match — single-player game)_ | Performance budgets, debuggability, data-driven params |
| `network-code.md` | `paths: []` _(no match — single-player game)_ | Server-authoritative, versioned messages, security |
| `ui-code.md` | `src/ui.js`, `src/console.js`, `src/leveledit.js` | No game state ownership, localization-ready, accessibility |
| `design-docs.md` | `design/gdd/**` | Required 8 sections, formula format, edge cases |
| `narrative.md` | `paths: []` _(no match — no `design/narrative/` dir)_ | Lore consistency, character voice, canon levels |
| `data-files.md` | `data/*.json` | JSON validity, naming conventions, schema rules |
| `test-standards.md` | `tests/**` | Test naming, coverage requirements, fixture patterns |
| `prototype-code.md` | `paths: []` _(⚠️ `prototypes/` removed in web-era re-pivot — historical reference)_ | Relaxed standards, README required, hypothesis documented |