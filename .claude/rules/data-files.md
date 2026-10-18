---
paths:
  - "data/*.json"
---

# Data File Rules

> **Web-era note:** Data files live in `data/` (not `assets/data/`). The repo has
> no `assets/data/` directory. Data files include `biomes.json`, `chapters.json`,
> `characters.json`, `items.json`, `quests.json`, `ship_layout.json`, etc.

- All JSON files must be valid JSON — broken JSON blocks the entire build pipeline
- File naming: lowercase with underscores only, following `[system]_[name].json` pattern
- Every data file must have a documented schema (either JSON Schema or documented in the corresponding design doc)
- Numeric values must include comments or companion docs explaining what the numbers mean
- Use consistent key naming: camelCase for keys within JSON files
- No orphaned data entries — every entry must be referenced by code or another data file
- Version data files when making breaking schema changes
- Include sensible defaults for all optional fields

## Examples

**Correct** naming and structure (`combat_enemies.json`):

```json
{
  "goblin": {
    "baseHealth": 50,
    "baseDamage": 8,
    "moveSpeed": 3.5,
    "lootTable": "loot_goblin_common"
  },
  "goblin_chief": {
    "baseHealth": 150,
    "baseDamage": 20,
    "moveSpeed": 2.8,
    "lootTable": "loot_goblin_rare"
  }
}
```

**Incorrect** (`EnemyData.json`):

```json
{
  "Goblin": { "hp": 50 }
}
```

Violations: uppercase filename, uppercase key, no `[system]_[name]` pattern, missing required fields.
