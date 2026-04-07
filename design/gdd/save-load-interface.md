# Save/Load Interface Contract

> **Status**: Designed (interface only — full system deferred to Vertical Slice)
> **Author**: User + Claude
> **Last Updated**: 2026-04-01

## Purpose

This document defines the `ISaveableSystem` interface that all MVP systems
implement for serialization. The full Save/Load system (file management, slots,
migration) is a Vertical Slice feature, but the interface contract must exist
now so MVP systems can be built with serialization in mind.

## Interface Definition

```typescript
interface ISaveableSystem {
   /** Unique ID for this system's save data block */
   readonly saveId: string;

   /** Return a JSON-serializable snapshot of all persistent state */
   serialize(): Record<string, unknown>;

   /** Restore state from a previously serialized snapshot */
   deserialize(data: Record<string, unknown>, version: number): void;
}
```

## Contract Rules

1. `serialize()` must return a plain JSON-serializable object (no classes,
   functions, circular references, or `undefined` values).
2. `deserialize()` must handle missing fields gracefully (use defaults for
   any field not present in `data` — enables forward compatibility).
3. The `version` parameter enables migration: if the save was created with an
   older schema, the system must fill in defaults for new fields.
4. Each system's `saveId` must be unique (e.g., `"ship-state"`, `"resources"`,
   `"timers"`, `"crew-dialogue"`).
5. `serialize()` must be fast — called on every save. Target < 1ms per system.
6. `deserialize()` must restore state exactly — a round-trip of
   `deserialize(serialize())` must produce identical game state.

## Systems Implementing This Interface

| System | saveId | Key Data |
|--------|--------|----------|
| Ship State | `"ship-state"` | All three tiers: systems, sections, subsystems with conditions |
| Resource & Inventory | `"resources"` | Resource quantities + story item flags |
| Timer & Pressure | `"timers"` | Active timers with remaining time, state, fired flags |
| Crew Dialogue & Choice | `"crew-dialogue"` | Affinities, romance values, choice history, narrative flags |
| Stargate & Planetary Runs | `"stargate"` | Gate state, on-planet progress, planet health |
| Ship Exploration | `"exploration"` | Discovery state, knowledge tier, barrier status |
| Kino Remote | `"kino-remote"` | Unlocked screens, console connections |
