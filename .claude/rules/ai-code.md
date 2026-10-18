---
paths: []
---

# AI Code Rules

> **Web-era note:** The game has no `src/ai/` directory — crew NPC behavior is
> data-driven via `data/characters.json` and orchestrated from `src/main.js` /
> `src/rpg.js`. These rules are retained for reference in case a future milestone
> adds a dedicated AI module. `paths: []` means this rule file will not match
> any files in the current repo.

- AI update budget: 2ms per frame maximum — profile to verify
- All AI parameters must be tunable from data files (behavior tree weights, perception ranges, timers)
- AI must be debuggable: implement visualization hooks for all AI state (paths, perception cones, decision trees)
- AI should telegraph intentions — players need time to read and react
- Prefer utility-based or behavior tree approaches over hard-coded if/else chains
- Group AI must support formation, flanking, and role assignment from data
- All AI state machines must log transitions for debugging
- Never trust AI input from the network without validation
