# Ship State System

> **Status**: Designed
> **Author**: User + Claude
> **Last Updated**: 2026-03-30
> **Implements Pillar**: Pillar 1 (The Ship IS the World)

## Overview

The Ship State System is the central data authority for Destiny's physical
condition — the single source of truth that every other system reads to understand
the state of the ship. It models Destiny at two levels of granularity: **ship-wide
systems** (power grid, life support, shields, FTL drive, weapons, sensors,
communications) that represent the vessel's macro capabilities, and **sections**
(bridge, corridors, decks, specialized rooms) that each contain **subsystems**
(doors, consoles, conduits, vents, lighting circuits) representing the physical
infrastructure the player can discover and repair.

Every element in Ship State has a **condition percentage** (0-100%). At 0%, a
subsystem is non-functional. As condition rises, performance improves continuously.
Systems degrade over time, from narrative events (enemy attacks, power surges), and
from neglect. Repairs restore condition using gathered resources. The player never
interacts with Ship State directly — they interact with consoles, conduits, and
Ancient tech in the world, and the Ship State updates accordingly, broadcasting
changes via the Event Bus (`ship:*` events) so that every downstream system —
atmosphere, lighting, audio, crew AI, the Kino Remote — reacts in real time.

Ship State is **Pillar 1 incarnate**: Destiny transforms from a failing death trap
into a functioning home over dozens of hours of play, and that transformation is
tracked, persisted, and reflected by this system.

## Player Fantasy

The Ship State System serves the fantasy of **bringing Destiny back to life** —
and the emotional quality of that fantasy evolves with the story, mirroring
Eli's own relationship with the ship.

**Season 1 — Nursing a patient**: Destiny is wounded, ancient, barely holding
together. Life support is failing, power is rationed, whole decks are sealed and
dark. Repairing a water recycler or restoring power to a corridor feels like
performing emergency surgery — desperate, urgent, and deeply satisfying when it
works. Every percentage point of condition restored is a small victory against
entropy. The ship feels fragile, and so do you.

**Season 2 — Restoring a relic**: As Eli (and the player) understand more of
Ancient technology, repairs shift from emergency patches to deliberate
restoration. You're not just fixing what's broken — you're uncovering what
Destiny was meant to be. Bringing a sensor array from 40% to 95% and watching it
reveal data the Ancients recorded a million years ago feels like archaeology and
engineering combined. The satisfaction is intellectual as much as practical.

**Season 3+ — Taming a beast**: Destiny has its own mission, its own will. As
ship systems approach full functionality, the player begins to grasp the ship's
true power and purpose. Repairing the final systems doesn't just make the ship
work — it makes it *cooperate*. The fantasy shifts from caretaker to partner.
Destiny goes from "the ship that's killing us" to "our ship."

This serves **Pillar 1 (The Ship IS the World)**: the ship's condition is never
abstract numbers in a menu — it's the lights dimming, the air getting thin, the
hull groaning. You feel the ship's state because you live in it.

## Detailed Design

### Data Model

Ship State is organized in a three-tier hierarchy:

**Tier 1: Ship-Wide Systems** — Destiny's macro capabilities

| System | Description | Primary Effect |
|--------|-------------|---------------|
| Power Grid | Central power generation + distribution | Master constraint. All other systems require power. |
| Life Support | Atmosphere, CO2 scrubbing, temperature | Below 30%: crew health warnings. Below 10%: crisis. |
| FTL Drive | Faster-than-light propulsion | Condition determines FTL jump range and reliability. |
| Shields | Defensive energy barrier | Condition = max shield strength. Below 50%: partial coverage. |
| Sensors | Long-range and local scanning | Higher condition = further detection range, more data. |
| Communications | Subspace link, internal comms, Earth stones | Condition gates communication range and clarity. |
| Weapons | Ancient energy weapons | Condition = fire rate and damage output. |
| Navigation | Stellar cartography, autopilot | Condition affects FTL destination accuracy. |

Each ship-wide system has:
- `condition`: float, 0.0–1.0 (displayed as 0-100%)
- `powered`: boolean (receiving sufficient power from the grid)
- `priority`: int, 1-8 (player-set allocation priority)
- `power_draw`: float (power required at current condition)
- `power_draw_optimal`: float (power required at 100% condition)

**Tier 2: Sections** — Physical areas of the ship

Each section represents a contiguous area of Destiny (bridge, gate room, mess
hall, hydroponics bay, observation deck, corridors, crew quarters, etc.).

Each section has:
- `id`: string (unique identifier, e.g., `"bridge"`, `"corridor-a3"`)
- `discovered`: boolean (has the player visited this section?)
- `accessible`: boolean (can the player reach this section?)
- `atmosphere`: float, 0.0–1.0 (breathable atmosphere level)
- `power_level`: float, 0.0–1.0 (power available; depends on grid routing)
- `structural_integrity`: float, 0.0–1.0 (hull/wall condition)
- `subsystems`: array of subsystem references

**Tier 3: Subsystems** — Individual interactable components within a section

Examples: doors, power conduits, consoles, lighting panels, vent covers, water
recyclers, Ancient consoles.

Each subsystem has:
- `id`: string (unique, e.g., `"bridge-console-main"`)
- `type`: enum (Door, Conduit, Console, LightingPanel, LifeSupportUnit, etc.)
- `condition`: float, 0.0–1.0
- `repair_cost`: resource requirements (defined per-type in config)
- `section_id`: reference to parent section
- `functional_threshold`: float (minimum condition to function; default 0.2)

### Core Rules

1. **Power grid routing**: Power flows from the generation core through
   conduits to sections. Each conduit subsystem has a `capacity` and
   `condition` — a conduit at 50% condition passes 50% of its rated capacity.
   Damaged or destroyed conduits reduce power to downstream sections. Repairing
   conduits is how the player opens up new areas of the ship.

2. **Power priority**: The player can set priority rankings (1 = highest) for
   the 8 ship-wide systems. When total power demand exceeds supply, systems
   are allocated power in priority order. Lower-priority systems get reduced
   power or none. Priority is set via the Kino Remote interface. Default:
   Life Support > Shields > FTL > Sensors > Comms > Navigation > Weapons.

3. **Condition affects performance**: Ship-wide system performance scales with
   condition via meaningful thresholds:
   - 0%: Non-functional
   - 1-19%: Barely functional (intermittent, unreliable)
   - 20-49%: Degraded (works with significant limitations)
   - 50-79%: Functional (works for normal use)
   - 80-99%: Good (works well, minor imperfections)
   - 100%: Optimal (Ancient-intended performance)

4. **Degradation**: Systems and subsystems degrade at a slow base rate.
   Narrative events (attacks, power surges, FTL stress) cause sudden condition
   drops. Degradation rate increases as condition decreases (damaged systems
   break down faster).

5. **Repairs**: The player repairs subsystems by interacting via the radial
   menu and spending resources. Most repairs cost a generic **Ship Parts**
   resource — salvageable from Destiny itself or gathered on planetary runs.
   Repair restores condition by a fixed amount per action (not instant full
   repair). A few story-critical repairs may require specific resources (lime
   for CO2 scrubbers, naquadah for power systems), but these are narrative
   exceptions, not the norm.

6. **Section atmosphere**: Breathable atmosphere depends on life support
   condition, structural integrity (sealed hull), and power level. Unpowered
   or breached sections have no atmosphere — requires EVA suit or sealing the
   breach and restoring power.

7. **Discovery and access**: Sections begin undiscovered and inaccessible.
   Discovery happens when the player physically enters (triggers
   `player:entered:section`). Accessibility depends on repaired conduits,
   opened doors, and structural repairs.

8. **State change events**: Every condition change publishes to the Event Bus.
   Events fire only on state *changes*, not continuously:
   - `ship:power:changed` — power grid output or routing changed
   - `ship:system:condition-changed` — any ship-wide system condition changed
   - `ship:section:unlocked` — previously inaccessible section became accessible
   - `ship:section:discovered` — player visited a section for the first time
   - `ship:lifesupport:critical` — life support below critical threshold
   - `ship:subsystem:repaired` — subsystem condition increased
   - `ship:subsystem:damaged` — subsystem condition decreased

9. **Serialization contract** (provisional — for Save/Load): Ship State
   exposes `serialize(): ShipStateSnapshot` returning complete state as a
   JSON-serializable object, and `deserialize(snapshot: ShipStateSnapshot)`
   to restore it. Snapshot includes all three tiers with current values.

### States and Transitions

**Subsystem condition states** (based on condition percentage):

| State | Condition Range | Visual Indicator | Behavior |
|-------|----------------|-----------------|----------|
| **Destroyed** | 0% | Dark, sparking, smoke | Non-functional. Cannot be used. May block access. |
| **Critical** | 1-19% | Flickering, intermittent sparks | Intermittent function. May fail during use. Degrades faster. |
| **Degraded** | 20-49% | Dim, occasional flicker | Functions with limitations (doors slow, consoles partial data). |
| **Functional** | 50-79% | Normal appearance, minor wear | Works for all standard uses. |
| **Good** | 80-99% | Clean, bright | Full performance. Minor cosmetic imperfections. |
| **Optimal** | 100% | Ancient tech glow, pristine | Peak performance. Ancient design aesthetic fully visible. |

**Section access states:**

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| **Unexplored** | Default for unvisited sections | Player enters → Explored | Shown on Kino Remote map as **greyed out**. Player knows it exists from Ancient ship schematics but hasn't been there. |
| **Explored** | Player physically enters section | — (permanent) | Full detail on Kino Remote map. Section data visible (atmosphere, power, subsystems). |
| **Accessible** | Power conduits + doors functional | Structural failure → Inaccessible | Player can freely enter and exit. |
| **Inaccessible** | No conduit path, sealed door | Repairs restore access | Player cannot enter. Shown on map but marked as blocked. |
| **Compromised** | Hull breach / exposed to space | Breach sealed remotely (repair robot / EVA) | **Flashing red on Kino Remote.** Hard vacuum behind the door. Must NOT open — doing so would decompress adjacent sections. Requires remote repair (repair robot or exterior EVA) before safe entry. |

Notes:
- Explored is permanent — once visited, always explored
- A section can be both Explored and Inaccessible (player visited before, but
  damage has since sealed it off)
- Compromised overrides Accessible — a breach makes the section dangerous
  regardless of door/conduit status
- All sections are always visible on the Kino Remote map (Destiny has full
  schematics). The difference is detail level and status indicators.

### Interactions with Other Systems

| System | Direction | Interface |
|--------|-----------|-----------|
| **Event Bus** | Outbound (publish) | Publishes all `ship:*` events on state changes: `ship:power:changed`, `ship:system:condition-changed`, `ship:section:unlocked`, `ship:section:discovered`, `ship:lifesupport:critical`, `ship:subsystem:repaired`, `ship:subsystem:damaged`. |
| **Event Bus** | Inbound (subscribe) | Subscribes to `resource:consumed` (repair costs), `player:entered:section` (mark explored), `episode:crisis:triggered` (narrative damage). |
| **Resource & Inventory** *(undesigned)* | Inbound | Repair actions check resource availability. Ship State requests consumption via `resource:consumed` event. |
| **Ship Exploration** *(undesigned)* | Outbound (read) | Reads section data (accessible, atmosphere, power_level) for navigation and encounter logic. |
| **Ship Atmosphere & Lighting** *(undesigned)* | Outbound (read + events) | Reads section power_level and atmosphere for fog, light brightness, ambient effects. Subscribes to `ship:power:changed`. |
| **Audio & Ambience** *(undesigned)* | Outbound (events) | Subscribes to `ship:*` for ambient audio: ship hum scales with power, alarms on critical systems. |
| **Kino Remote** *(undesigned)* | Outbound (read) + Inbound (priority) | Reads full ship state for diegetic UI (section map, conditions, priorities). Player sets power priority through Kino Remote → writes to Ship State. |
| **Crew AI & Schedule** *(undesigned)* | Outbound (read + events) | Crew AI reads conditions for NPC behavior (flee compromised sections, gather in powered areas). |
| **Episode Narrative** *(undesigned)* | Bidirectional | Episodes write to Ship State (narrative damage, forced repairs). Ship conditions trigger episode events (life support critical → crisis). |
| **Ancient Tech Puzzles** *(undesigned)* | Bidirectional | Puzzles may restore condition or unlock capabilities. Some puzzles read grid state as input. |
| **Kino Drone** *(undesigned)* | Outbound (read) | Reads section atmosphere to warn before entering compromised areas. |
| **Player Controller** | Inbound (events) | Receives `player:entered:section` for exploration. Radial menu repair actions modify subsystem condition. |
| **Save/Load** *(undesigned)* | Outbound (serialization) | `serialize()`/`deserialize()` for complete state persistence. Largest payload in save file. |

**Provisional contracts:**
- Resource & Inventory: resource types and repair cost schema TBD
- Kino Remote: power priority UI interaction protocol TBD
- Episode Narrative: narrative override API (force conditions, lock/unlock) TBD

## Formulas

### Power Distribution

```
available_power = power_grid_condition * MAX_POWER_OUTPUT
```

For each system in priority order:
```
allocated = min(system.power_draw, remaining_power)
remaining_power -= allocated
system.powered = allocated >= system.power_draw * MIN_POWER_RATIO
```

| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| `MAX_POWER_OUTPUT` | float | 1000 units | config | Destiny's theoretical max power output |
| `power_grid_condition` | float | 0-1.0 | ship state | Power Grid system condition |
| `MIN_POWER_RATIO` | float | 0.3 | config | Minimum power fraction to function |

### Conduit Power Routing

```
section_power = source_power * conduit_condition * conduit_capacity_ratio
```

| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| `source_power` | float | 0-1.0 | upstream | Power at conduit's source |
| `conduit_condition` | float | 0-1.0 | subsystem | Conduit condition |
| `conduit_capacity_ratio` | float | 0-1.0 | config | Rated capacity relative to max |

### Degradation Rate

```
degradation_per_hour = BASE_DEGRADATION
                     * (1 + DAMAGE_ACCELERATION * (1 - condition))
```

| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| `BASE_DEGRADATION` | float | 0.001-0.005 | config | Condition loss per game-hour at 100% |
| `DAMAGE_ACCELERATION` | float | 2.0 | config | How much faster damaged systems degrade |
| `condition` | float | 0-1.0 | subsystem | Current condition |

**Expected range**: 0.001/hr at 100% → 0.015/hr near 0%

### Repair Amount

```
condition_restored = BASE_REPAIR_AMOUNT * repair_skill_modifier
```

| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| `BASE_REPAIR_AMOUNT` | float | 0.1-0.25 | config | Condition restored per action |
| `repair_skill_modifier` | float | 0.8-1.5 | story | Eli's growing competence (S1: 0.8, S2: 1.0, S3: 1.3) |

### Section Atmosphere

```
atmosphere = life_support_effectiveness * structural_integrity * section_power
life_support_effectiveness = life_support_condition * (powered ? 1.0 : 0.0)
```

| Variable | Type | Range | Source | Description |
|----------|------|-------|--------|-------------|
| `life_support_condition` | float | 0-1.0 | ship system | Life Support condition |
| `structural_integrity` | float | 0-1.0 | section | Hull sealed-ness (0 = breach) |
| `section_power` | float | 0-1.0 | section | Power reaching this section |

## Edge Cases

| Scenario | Expected Behavior | Rationale |
|----------|------------------|-----------|
| **Power grid at 0%** | All ship-wide systems unpowered. Sections go dark. Life support fails. Emergency battery provides 30 minutes of minimal lighting only. | Total power failure is the ultimate crisis — but not instant death (no death in this game). Creates a time-pressure narrative event. |
| **Player opens door to compromised section** | Door refuses to open. Kino Remote shows flashing red. Eli comments ("That section is exposed to space."). Player must repair the breach remotely first. | Opening a door to vacuum would decompress adjacent sections — catastrophic. The game prevents this. |
| **All conduits to a section are destroyed** | Section becomes Inaccessible. Power level drops to 0. Must repair at least one conduit from the source side to restore access. | Sections can be cut off by conduit damage. This creates spatial puzzles. |
| **Repair attempted with insufficient Ship Parts** | Repair fails gracefully. UI shows Ship Parts cost and current inventory. No partial repair. | Clear feedback prevents confusion. Ship Parts is the standard currency for most repairs. |
| **Multiple systems compete for power** | Priority system resolves. Highest priority gets full allocation, lower priorities get remainder. If not enough for MIN_POWER_RATIO, system loses `powered` status. | Power scarcity forces meaningful choices — the core tension of the show. |
| **Narrative event forces condition change** | Episode system can directly set any condition value, bypassing normal degradation/repair. Publishes appropriate `ship:*` events. | Story trumps simulation. An enemy attack can damage shields regardless of current condition. |
| **Condition drops below functional_threshold during use** | Active interaction is interrupted. Console goes dark mid-use, door stops mid-open. Appropriate animation plays. | Systems failing mid-use creates dramatic moments. |
| **Player repairs a conduit that creates a power loop** | Power routing uses a directed acyclic graph (DAG). Loops are prevented at the data level — conduits have a defined direction. If level design creates a loop, runtime detects and breaks it at the lowest-priority conduit. | Prevents infinite power exploits. |
| **Save/Load with different game version** | Serialization includes a version number. Deserialize migrates old snapshots forward, adding default values for new fields. Never crashes on old saves. | Save compatibility is critical for a long game. |
| **All life support units in a section destroyed** | Section atmosphere degrades toward 0 over time (air leaks, no scrubbing). Rate depends on section size. Adjacent sections unaffected if sealed. | Localized life support failure, not ship-wide. |

## Dependencies

**Upstream (this system depends on):**

| System | Dependency Type | Interface |
|--------|----------------|-----------|
| Event Bus | Hard | Publishes all `ship:*` events. Subscribes to `resource:*`, `player:entered:section`, `episode:*`. |
| Save/Load (interface only) | Hard (contract) | Serialization contract: `serialize()`/`deserialize()`. Full implementation deferred to VS tier. |

**Downstream (depends on this system):**

| System | Dependency Type | What They Need |
|--------|----------------|----------------|
| Ship Exploration | Hard | Section accessibility, atmosphere, power levels for navigation. |
| Kino Remote | Hard | Full ship state for diegetic map UI. Power priority write-back. |
| Ship Atmosphere & Lighting | Hard | Section power_level and atmosphere for visual effects. |
| Audio & Ambience | Soft | Ship-wide system conditions for ambient audio scaling. |
| Crew AI & Schedule | Hard | Section conditions for NPC behavior and placement. |
| Ancient Tech Puzzles | Soft | Ship state as puzzle input; puzzle solutions write conditions. |
| Episode Narrative | Hard | Conditions as story triggers; narrative writes conditions. |
| Kino Drone | Soft | Section atmosphere for safety warnings. |
| Resource & Inventory | Soft | Repair actions consume Ship Parts (and rarely specific resources). |

## Tuning Knobs

| Parameter | Default | Safe Range | Effect of Increase | Effect of Decrease |
|-----------|---------|------------|-------------------|-------------------|
| `MAX_POWER_OUTPUT` | 1000 | 500-2000 | More power to distribute. Easier to run all systems. | Tighter power budget. More priority trade-offs. |
| `MIN_POWER_RATIO` | 0.3 | 0.1-0.5 | Systems need more power to function. Stricter. | Systems function with less power. More forgiving. |
| `BASE_DEGRADATION` | 0.002/hr | 0.001-0.005 | Faster decay. More repair pressure. | Slower decay. Less maintenance needed. |
| `DAMAGE_ACCELERATION` | 2.0 | 1.0-4.0 | Damaged systems degrade much faster (snowball). | Damage has less compounding effect. |
| `BASE_REPAIR_AMOUNT` | 0.15 | 0.05-0.3 | Repairs restore more per action. Faster recovery. | Repairs feel slow. Multiple actions needed. |
| `REPAIR_COST_SHIP_PARTS` | 5 | 1-20 | Repairs more expensive. Ship Parts scarcer. | Repairs cheap. Less pressure from resource economy. |
| `EMERGENCY_BATTERY_DURATION` | 30 min | 10-60 | Longer window after total power failure. | Shorter — power failure is more urgent. |
| `LIFE_SUPPORT_CRITICAL_THRESHOLD` | 0.3 | 0.1-0.5 | Crisis triggers earlier. More warning time. | Crisis triggers later. Less margin for error. |
| `LIFE_SUPPORT_FATAL_THRESHOLD` | 0.1 | 0.05-0.2 | Narrative consequences trigger earlier. | More time before crew is in real danger. |
| `ATMOSPHERE_DRAIN_RATE` | 0.01/min | 0.005-0.05 | Breached sections lose air faster. | Slower drain — more time to seal breaches. |
| `REPAIR_SKILL_S1` | 0.8 | 0.5-1.0 | S1 Eli is more capable. Less growth arc. | S1 repairs are harder. Bigger skill ceiling. |
| `REPAIR_SKILL_S2` | 1.0 | 0.8-1.2 | S2 baseline higher. | S2 still feels limited. |
| `REPAIR_SKILL_S3` | 1.3 | 1.0-1.5 | S3 Eli is very efficient. | Less mastery payoff. |

## Visual/Audio Requirements

Ship State itself is invisible — but it drives nearly all visual and audio
feedback in the game via downstream systems:

| Ship State Change | Visual Effect (via Atmosphere/Lighting) | Audio Effect (via Audio/Ambience) |
|-------------------|----------------------------------------|----------------------------------|
| Power level changes | Lights brighten/dim in section | Ship hum pitch shifts |
| Life support critical | Red emergency lighting | Alarm klaxons, breathing sounds |
| Section compromised | Vacuum effects visible through windows | Decompression whoosh, silence in vacuum |
| Subsystem repaired | Lights restore, sparks stop, Ancient glow returns | Mechanical startup sounds, satisfying hum |
| Subsystem destroyed | Sparks, smoke, flickering | Electrical crackling, groaning metal |
| Power grid failure | All lights out except emergency strips | Ship hum dies, eerie silence, emergency battery beep |

Ship State owns the data; Atmosphere, Lighting, and Audio systems own the
presentation. This separation allows visual/audio to be tuned independently.

## UI Requirements

Ship State data is displayed exclusively through the **Kino Remote** (diegetic
menu system). Ship State provides the data; Kino Remote owns the display:

| Information | Kino Remote Display | Update Trigger |
|-------------|-------------------|----------------|
| Section map | Full ship schematic. Greyed = Unexplored. Red flash = Compromised. Color = power level. | `ship:section:*` events |
| Ship-wide systems | List with condition bars and powered/unpowered status | `ship:system:condition-changed` |
| Power priority | Draggable priority list | Player interaction |
| Section detail (on select) | Atmosphere, power, structural integrity, subsystem list | On selection + `ship:*` events |

No floating HUD elements. All ship status is accessed through the Kino Remote,
consistent with Pillar 3 (Earned Discovery).

## Acceptance Criteria

- [ ] **Three-tier data model**: Ship-wide systems, sections, and subsystems all store condition (0-1.0) and are queryable.
- [ ] **Power distribution**: Power allocates by priority order. Systems below MIN_POWER_RATIO lose `powered` status.
- [ ] **Power routing**: Conduit condition affects downstream section power. Damaged conduit = reduced power to section.
- [ ] **Priority setting**: Player can reorder system priorities (1-8). Changes take effect immediately. Power redistribution fires `ship:power:changed`.
- [ ] **Degradation**: Subsystems degrade over time. Rate increases as condition decreases. Degradation pauses when game is paused.
- [ ] **Repair**: Interacting with a subsystem and spending Ship Parts restores condition by BASE_REPAIR_AMOUNT * skill modifier. Insufficient resources prevents repair.
- [ ] **Section states**: Sections correctly transition between Unexplored/Explored/Accessible/Inaccessible/Compromised. Explored is permanent.
- [ ] **Atmosphere**: Section atmosphere correctly computes from life support, structural integrity, and power. Breached sections drain to 0.
- [ ] **Compromised warning**: Compromised sections flash red on Kino Remote. Doors refuse to open to compromised sections.
- [ ] **Event publishing**: All `ship:*` events fire on state changes with correct payloads. No events on frame-by-frame reads.
- [ ] **Serialization**: `serialize()` produces a complete JSON-serializable snapshot. `deserialize()` restores state exactly. Version migration handles old saves.
- [ ] **Narrative override**: Episode system can directly set any condition value. Override publishes appropriate events.
- [ ] **Performance**: Full ship state update (degradation + power routing) completes within 2ms per game tick. State reads are O(1) by ID.
- [ ] **No hardcoded values**: All parameters from Tuning Knobs loaded from config.
- [ ] **DAG enforcement**: Power routing graph is a DAG. Loops are detected and broken at runtime.

## Open Questions

| Question | Owner | Deadline | Resolution |
|----------|-------|----------|-----------|
| How many sections should Destiny have at launch? Each needs level design + subsystems. | Level Designer | Before content planning | — |
| Should Destiny's power core be repairable or is it a fixed constraint (story pacing)? | Creative Director | Before S2 story design | — |
| How does the repair robot work for compromised sections? Is it a deployable from Kino Remote or a separate mechanic? | Game Designer | Before Ship Exploration GDD | — |
| Should power priority be auto-adjusted by the Episode system during crises (e.g., "shields maximum!") or always player-controlled? | Game Designer | Before Episode Narrative GDD | — |
| How does Destiny's self-repair work? The show implies the ship has some autonomous repair ability. Should this be modeled or left to narrative? | Creative Director | Before S2 design | — |
| What specific Ship Parts scarcity level creates good tension without grind? Needs playtesting. | Systems Designer | During prototype | — |
