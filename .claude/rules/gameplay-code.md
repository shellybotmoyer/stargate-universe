---
paths:
  - "src/main.js"
  - "src/rpg.js"
  - "src/quest.js"
  - "src/flow.js"
  - "src/interact.js"
  - "src/ancient.js"
  - "src/hotwire.js"
  - "src/input.js"
  - "src/player.js"
  - "src/kino.js"
  - "src/music.js"
  - "src/settings.js"
  - "src/save.js"
  - "src/ftl.js"
  - "src/autoplay.js"
---

# Gameplay Code Rules

> **Web-era note:** The repo uses flat `src/*.js` modules (no `src/gameplay/` directory).
> Gameplay-layer modules include `main.js` (game loop/chapter engine), `rpg.js`,
> `quest.js`, `flow.js`, `interact.js`, `player.js`, `kino.js`, `save.js` (save/load,
> extracted TD-101 — on PR #197 branch, not yet on main), `ftl.js` (FTL rhythm, extracted
> TD-101 — on PR #197 branch, not yet on main), `autoplay.js` (autonomous
> playthrough), etc. Data-driven config lives in `data/*.json`.
> **Note:** `src/save.js` and `src/ftl.js` in the paths above do not exist on local main
> yet — they will appear when PR #197 merges.

- ALL gameplay values MUST come from external config/data files, NEVER hardcoded
- Use delta time for ALL time-dependent calculations (frame-rate independence)
- NO direct references to UI code — use events/signals for cross-system communication
- Every gameplay system must implement a clear interface
- State machines must have explicit transition tables with documented states
- Write unit tests for all gameplay logic — separate logic from presentation
- Document which design doc each feature implements in code comments
- No static singletons for game state — use dependency injection

## Examples

**Correct** (data-driven):

```javascript
const damage = config.getValue("combat", "base_damage", 10.0);
const speed = statsResource.movementSpeed * delta;
```

**Incorrect** (hardcoded):

```javascript
const damage = 25.0;   // VIOLATION: hardcoded gameplay value
const speed = 5.0;      // VIOLATION: not from config, not using delta
```
