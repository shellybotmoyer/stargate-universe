# Architecture — Stargate Universe (web/Three.js era)

Generated 2026-10-19 (heartbeat — closes TD-003 for the web-era codebase).
Post re-pivot (2026-09-08): Godot stack removed; game is a single-page ES module
app built with Three.js, vendored addons, and plain JavaScript — no framework,
no bundler, no TypeScript at runtime.

## 1. Technology stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Renderer | Three.js WebGL (WebGPU ready via `?webgl=1` flag) | ACES tone mapping, PCF soft shadows, PMREM environment |
| Language | ES modules (plain `.js`, `import/export`) | No transpile step; browser-native |
| Build | `build.sh` (vendoring + import-map rewrite via inline Python) → `dist/` + itch.io zip | No bundler; `index.html` loads `src/main.js` directly |
| Tests | Node 18+ built-in test runner (`node --test tests/*.test.js`) | Zero framework deps; test suite lives on PR #197 branch (28 files, 1007 tests) — not on origin/main |
| Data | JSON files in `data/` (chapters, ship layout, items, planets, etc.) | Fetched at runtime via `fetch()` |
| Save | `localStorage` single-slot (`SAVE_KEY`) + version migration (`migrateSave()`) | `SAVE_VERSION` guards forward compat |
| Audio | `AudioLoader` → `ASSETS/sounds/…`; procedural synthesis (`toneBuffer()`) for alarms/heartbeat | TTS generation: `tools/tts-bake/` |
| Assets | Repo-local `sounds/`, `models/` (Quaternius UAL), `data/` | `ASSETS` base path resolves CDN vs local |

## 2. Module graph (23 source files on origin/main, 24 on this branch, 3,445 LOC)

```
main.js (702 LOC) — entry point, game loop, chapter engine, FTL/countdown systems
├── gate-room.js (168) — Destiny gate-room geometry + gate interface room
├── stargate.js (234)  — Stargate model, chevron animation, gate activation
├── wormhole.js (52)   — Wormhole transit effect
├── destination.js (130) — Procedural planet generation from data/biomes.json
├── ship.js (310)   — Deck layout from data/ship_layout.json, room geometry, lighting, grow beds
├── components.js (390) — Procedural Ancient-tech prop meshes (beds, lockers, crates, scrubbers, tanks)
├── ancient.js (124) — Shared Ancient material (triplanar PBR, world-space)
├── player.js (145) — Quaternius UAL mannequin, locomotion blend, collision
├── input.js (79)   — Keyboard/mouse/gamepad input, pointer lock
├── interact.js (32) — Proximity interactable system (register/update/prompt)
├── quest.js (34)   — Declarative chapter/step engine (flag-driven advancement)
├── rpg.js (144)    — Level/XP, HP/O2, inventory, equipment, talents
├── settings.js (32) — Persistent settings (clockScale, accessibility options)
├── ui.js (216)     — WoW-style HUD (gold-on-dark) + Kino Remote menu
├── console.js (32) — Dev console (`ftl`, `goto`, `edit` commands)
├── kino.js (33)    — Kino remote probe (diegetic scout drone)
├── hotwire.js (69) — Hotwire mini-game (panel repair)
├── flow.js (69)    — Flow-balance mini-game (coupled-valve life support puzzle)
├── music.js (42)   — Music layer loading + mood-driven transitions
├── autoplay.js (160) — Automated smoke-test walker (keyboard simulation, reload mode)
├── leveledit.js (205) — Level editor (crate style/loot, schematic deck parameter)
├── recorder.js (39) — Frame capture / replay
└── assets.js (4)   — ASSETS base path constant (CDN vs local)
```

## 3. Core data flow

```
data/chapters.json
    │
    ▼
quest.js (createQuestEngine)
    │  flag-driven step advancement: step.complete_when → quest.setFlag() → quest.check()
    │  triggers on step enter/exit: subtitle, radio, toast, ftl_drop, dial, countdown
    ▼
main.js (game loop)
    │  per-frame: poll input → update player → tick FTL → tick countdown → update interact
    │  → render scene → update HUD
    ▼
ship.js / destination.js
    │  world = Destiny (ship interior) OR planet (procedural surface)
    │  enterWorld() swaps camera target, fog, lighting, player position
    ▼
ui.js (HUD)
    │  player frame (HP/O2/XP), quest tracker, minimap, clocks tab, subtitle panel
    │  Kino Remote: full-screen menu (map, ship systems, settings, clocks)
    ▼
rpg.js (state)
    │  inventory, equipment, talents, level → onRpgChange listeners → HUD refresh
    │  saveGame()/loadGame() → localStorage (versioned, migrated)
```

## 4. Key systems

### Quest engine (`quest.js`, 34 LOC)
Declarative chapter/step model. Each step has a `complete_when` flag; when
`quest.setFlag(flag)` is called, `quest.check()` advances through all steps
whose completion flags are already set (20-step guard prevents infinite loops).
Steps carry `on_enter`/`on_exit` trigger arrays (subtitle, radio, toast,
ftl_drop, dial, countdown, countdown_stop). World-state flags persist across
chapters; only the current chapter's step flags are cleared on chapter start.

### FTL rhythm system (`main.js` lines 193–209, tickFtl at 240–252)
Timer-pressure loop: drop-out opens a jump window (default 600s × clockScale),
countdown to zero triggers `ftlJump()`, then cooldown (90s) before re-drop if
the chapter still needs the planet. Rush/Scott radio warnings at 120s/30s.
`ftlRedrop()` re-opens the window for missed deadlines. Per-frame tick
(`tickFtl()`) drives the window/cooldown clock and urgent-alarm state.

### Knockout loop (`main.js` lines 210–226)
No-death design (issue #92): black out → wake on infirmary bed → TJ dialogue
from `data/knockout_lines.json` (graceful fetch fallback). Cause-tagged lines
`(window_closed, asphyxiation, generic)`. `knockedOut` guard prevents re-entrancy.
Heartbeat audio cue synthesized via `toneBuffer()`.

### Story countdowns (`main.js` lines 227–239)
Data-triggered deadlines (`countdown`/`countdown_stop` steps in chapters.json).
Takes over the HUD clock. Expiry → `knockOut(cause)` → re-arms (resets t to
total). Rush/Scott warnings at 120s/30s. `clockScale` accessibility multiplier
stretches or shortens every story clock.

### Ship layout (`ship.js`, 310 LOC)
JSON-driven from `data/ship_layout.json` + `data/room_connections.json`.
Plan units → metres at 0.05 scale. Rooms are AABB shells with arched door
gaps. Crew-deck rooms (`CREW_DECK_ROOMS` set) run on emergency lamps until
the conduit is restored (`setQuartersPower(true)`). Grow beds grow under
lamps (180s cycle) and can be harvested for rations.

### Component system (`components.js`, 390 LOC)
Procedural Ancient-tech prop meshes. `COMPONENTS` dict maps type → builder
function. `BuildContext` carries position, anchor, floor, parts dict, and
loot list. Gull-wing crate lids, loot silhouettes (fuses, rations, misc),
sight glasses, conduit junctions. JSDoc typedefs: `ComponentSpec`,
`BuildContext`, `ComponentDef`.

### Mini-games (`hotwire.js`, `flow.js`)
Both follow the same contract: `play(ctx)` returns a `Promise<boolean>`
(resolve = success, reject/return false = cancel). `isOpen()` lets `main.js`
pause the simulation while the panel is open. Hotwire = wire-following puzzle;
Flow = coupled-valve matrix with guaranteed-solvable targets (40-try rejection).

### Save/load (`main.js` `saveGame()`/`loadGame()`)
`SAVE_VERSION` + `migrateSave()` for forward compatibility. Single localStorage
slot. Persists: chapter ID, step index, flags, deck, FTL state (window/cooldown),
grow bed growth, countdown state, RPG state (HP/O2/XP/inventory/equipment).

### Autoplay (`autoplay.js`, 160 LOC)
Automated smoke-test walker. Keyboard simulation with escalating unstick logic
(back-off + sidestep). `?autoplay&reload` mode reloads at every chapter boundary
and resumes from save, exercising save/load across chapter boundaries. Flow
panel auto-solve, missed-FTL-window recovery.

## 5. CI pipeline (main branch)

`.github/workflows/ci.yml` — single `web-game` job:
1. Checkout + Node 22 setup
2. `node --check` on `src/*.js` (ESM-safe via `.mjs` copy)
3. JSON validation on `data/*.json`
4. `./build.sh` → itch.io build artifact
5. `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` env guard (Node 20 deprecation)

> **Note:** `node --test`, `tsc` typecheck, and `npm run lint` steps are on
> PR #197's branch but not yet on origin/main. They will be added when #197 merges.

## 6. File layout

```
stargate-universe/
├── index.html          — entry point, loads src/main.js
├── build.sh            — build script (vendoring + import-map rewrite via inline Python)
├── tools/
│   ├── gen_gate_sfx.py — procedural gate sound effect generation
│   ├── music-bake/     — music asset baking
│   ├── tts-bake/       — TTS voice line generation
│   └── edit_server.py  — Level editor backend
├── src/                — 24 ES modules (3,445 LOC on local main)
├── data/               — 13 JSON files (chapters, layout, items, planets, etc.)
├── sounds/             — SFX + dialog voice lines (.ogg, .wav)
├── models/             — Quaternius UAL mannequin + environment (.glb)
├── sprites/            — UI sprites, character portraits (PNG)
├── assets/items/       — Item icons for inventory/equipment (PNG)
├── tests/              — (not on origin/main; 28 test files on PR #197 branch)
├── design/             — Game design docs: gdd/, reviews/, concept-art/, data/
├── docs/               — Architecture, tech-debt register, repo learnings, opening script
├── production/         — Sprint notes, daily notes, perf baselines
├── .ai/learnings/      — One lesson per file; read relevant ones before extending a system
├── dist/               — Build output (itch.io zip, generated by build.sh)
└── .github/workflows/  — CI pipeline
```

## 7. Known debt (see tech-debt-register.md)

| ID | Description | Status |
|----|-------------|--------|
| TD-003 | Missing architecture docs | **Closed by this document** |
| TD-009 | `main.js` 702 LOC — countdown extraction pending | Open (M effort) |
| TD-010 | No browser/headless smoke test in CI | Open (L effort) |
| TD-101 | FTL extraction (`src/ftl.js`) | On PR #197 branch, not on origin/main |
| TD-102 | ESLint config + CI lint step | On PR #197 branch, not on origin/main |
| TD-103 | Unit test coverage (28 test files) | On PR #197 branch, not on origin/main |
| TD-104 | Silent catch blocks | Fully resolved on local main — all `catch {}` blocks replaced with `console.warn` |