---
description: Scaffold core utilities and systems (iso, grid, DepthSort)
agent: isometric-engineer
---
Delegate to the `isometric-engineer` subagent (Agent tool) for the design and code. It is read-only, so apply the files it returns yourself.

Scaffold minimal core files for Station Zero:

- src/utils/iso.ts (use exact formulas from AGENTS.md)
- src/utils/grid.ts (grid helpers, bounds checks)
- src/systems/DepthSort.ts (sort by isoY)
- src/entities/Entity.ts (base entity)

Keep strictly typed, no any. Follow project structure.
Make them minimal but production-usable.
