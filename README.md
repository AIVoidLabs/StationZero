# Station Zero

A 2D isometric retro-futuristic dungeon crawler focused on pure survival. Trapped in the sealed penal-mining colony `Penal Colony-Null`, you are a forgotten Exile with fragmented memories. The central control unit `WARDEN` still enforces its expired Cease Protocol. There is no guaranteed escape — survival is the objective.

## Game Design Pillars

- **Survival-first** — No scripted rescue. Survive one more step.
- **Environmental storytelling** — Tell the story through broken panels, terminals, faded labels, and corrupted logs.
- **Claustrophobic action** — Tight corridors, tight corners, and oppressive spaces over wide-open arenas.
- **Minimal scope** — Focus on `Exploration + Mining + Avoidance/Combat`. Avoid feature creep.
- **Dark & unsettling** — Lean into tension and oppressive atmosphere over jump scares.

## Tech Stack

- **Language:** [TypeScript](https://www.typescriptlang.org/) (Strict mode)
- **Engine:** [Phaser v4](https://phaser.io/) (HTML5 Canvas / WebGL)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Perspective:** 2D Isometric (Dimetric 2:1 ratio)
- **Architecture:** Modular, component-driven Phaser Scenes and Entities

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [npm](https://www.npmjs.com/)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd StationZero

# Install dependencies
npm install
```

### Development

```bash
# Start Vite dev server
npm run dev

# Type check without emitting files
npm run typecheck

# Build for production
npm run build

# Preview production build
npm run preview
```

### Controls

- **WASD / Arrow keys** — Move (8 directions, screen-relative)
- **Left click** — Walk to a reachable tile (A* pathfinding)
- Any movement key cancels a click path.

The game currently boots into a seeded room-and-corridor level. Append `?debug` to the URL to expose `window.__sz` (`level`, `player`, `dungeon`) for inspection.

## Project Structure

```text
src/
├── assets/        # Asset loading references and manifest
├── data/          # Static data (configs, spawn tables, weights)
├── entities/      # Entity classes and component logic
├── scenes/        # Phaser Scenes (Boot, Preload, Game, UI)
├── systems/       # Global systems (DepthSort, WardenDirector, Spawner)
└── utils/         # Utilities (iso.ts, grid.ts, helpers)

assets/            # Raw art/audio (keep minimal and low-res)
.opencode/         # Agent harness (agents, skills, commands)
AGENTS.md          # AI agent rules, conventions, and project context
```

## Adding New Features

Follow these rules to keep the project consistent with `AGENTS.md`:

- **Respect scope** — Only add features that serve `Exploration + Mining + Avoidance/Combat`. If it doesn't, reconsider.
- **Follow isometric rules** — Use `cartesianToIso` / `isoToCartesian` from `src/utils/iso.ts`. Always enforce depth sorting via `systems/DepthSort.ts` by sorting renderables by `isoY` every frame/update.
- **Use composition** — Favor component-driven entities over deep inheritance. Keep classes small and focused.
- **Stay strictly typed** — No `any`. Use explicit types/interfaces and strict null checks.
- **Respect Phaser lifecycle** — Use `init`, `preload`, `create`, `update` correctly. Clean up listeners on scene shutdown.
- **Grid-first thinking** — Prefer grid-based collision for tight corridors. Only use physics when strictly necessary.
- **Small iterations** — Make the smallest testable change and run `npm run typecheck` before moving on.

### Isometric Math (Reference)

Use these formulas exactly as defined in `AGENTS.md`:

```typescript
// Cartesian (gridX, gridY) to Screen (isoX, isoY)
export function cartesianToIso(gridX: number, gridY: number, tileWidth: number, tileHeight: number) {
  const isoX = (gridX - gridY) * (tileWidth / 2);
  const isoY = (gridX + gridY) * (tileHeight / 2);
  return { isoX, isoY };
}

// Screen (isoX, isoY) to Cartesian (gridX, gridY)
export function isoToCartesian(isoX: number, isoY: number, tileWidth: number, tileHeight: number) {
  const gridX = (isoX / (tileWidth / 2) + isoY / (tileHeight / 2)) / 2;
  const gridY = (isoY / (tileHeight / 2) - isoX / (tileWidth / 2)) / 2;
  return { gridX: Math.floor(gridX), gridY: Math.floor(gridY) };
}
```

## OpenCode Commands

These commands live in `.opencode/commands/` and can be run via OpenCode. They route to specialized agents by default.

| Command | Agent | Purpose | Usage |
| --- | --- | --- | --- |
| `core-scaffold` | `isometric-engineer` | Scaffold core utilities/systems (`src/utils/iso.ts`, `src/utils/grid.ts`, `src/systems/DepthSort.ts`, `src/entities/Entity.ts`). | Use once at the beginning or when bootstrapping missing core pieces. |
| `new-scene` | `game-architect` | Create a new Phaser Scene in `src/scenes/` with proper lifecycle and typing. | `new-scene <SceneName>` (e.g. `Game`, `UI`). |
| `new-entity` | `entity-scripter` | Scaffold a minimal, component-driven entity with isometric positioning prep and depth-sorting readiness. | `new-entity <EntityName>`. |
| `gen-tight-dungeon` | `level-designer` | Suggest claustrophobic room+corridor layouts with chokepoints, dead-ends, and LOS-friendly paths. | `gen-tight-dungeon size:20x20 depth:3` (tune params as needed). |
| `drone-test` | `combat-ai` | Suggest a minimal LOS-based drone AI (idle/patrol/chase/search/disengage) with avoidance-first behavior. | `drone-test <context>` (e.g. describe corridor constraints). |
| `warden-sim` | `warden-director` | Suggest depth-based WARDEN spawn/pacing plan with gradual escalation. | `warden-sim depth:5`. |

## Sub-Agent Usage (Efficient)

Pick the right agent for the job instead of dumping everything to `general`. Use the `$ARGUMENTS` pattern with commands where applicable, or call agents directly via OpenCode.

| Agent | When to use | Notes |
| --- | --- | --- |
| `explore` | Find files/symbols or understand unfamiliar code quickly. | Choose `quick`/`medium`/`very thorough` based on scope. Great for answering "where is X used?". |
| `game-architect` | High-level design, modular restructuring, or preventing scope creep. | Keep decisions aligned with `AGENTS.md` pillars. |
| `isometric-engineer` | Isometric math, camera, tilemap, depth sorting. | Must follow `AGENTS.md` formulas. Use for `src/utils/iso.ts`, `src/systems/DepthSort.ts`. |
| `entity-scripter` | Adding player, drones, mines, or other entities/components. | Component-driven. Keep minimal and ready for depth sorting. |
| `combat-ai` | Drone behavior, LOS, aggro/disengage, pursuit limits. | Avoidance-first. Use with the `drone-ai-los` skill for tighter consistency. |
| `level-designer` | Tight corridor dungeon layouts. | Use with `dungeon-tight-corridors` skill. Prioritize chokepoints and evasion paths. |
| `warden-director` | WARDEN director logic, spawns, alarm state, depth escalation. | Use with `warden-director-systems` skill. Tension over difficulty spikes. |
| `perf-reviewer` | Review large changes for strict TS, isometric correctness, and performance. | Mostly read-only. Best after implementing systems. |

## Skills

Load a skill when the task matches its description (`skill` tool). Skills provide specialized workflows that keep behavior consistent with project rules.

| Skill | When to load | Purpose |
| --- | --- | --- |
| `iso-math-grid` | Working with grid <-> screen conversions or tile selection. | Cartesian<->isometric math, tile picking, grid collision helpers. |
| `ts-strict-phaser` | Writing/refactoring Phaser code in strict TypeScript. | Strict typing patterns, lifecycle safety, clean imports. |
| `phaser-v4-iso-combat` | Implementing movement, damage, or minimal combat. | Phaser v4 isometric combat patterns with minimal scope. |
| `drone-ai-los` | Implementing drone AI. | LOS-based aggro/disengage with avoidance-first gameplay. |
| `dungeon-tight-corridors` | Generating dungeon layouts. | Room+corridor generation tuned for claustrophobic spaces. |
| `warden-director-systems` | Implementing WARDEN director. | Depth-based escalation, spawns, alarm state, pacing. |
| `opencode` | Questions about OpenCode itself. | Config, agents/skills/commands/tools, MCP, troubleshooting. |
| `report` | Want to report an OpenCode issue/bug. | Collect diagnostics and publish via GitHub CLI. |

## Tips & Best Practices

- **Read `AGENTS.md` first** — Treat it as the source of truth for rules and conventions.
- **Typecheck often** — Run `npm run typecheck` after meaningful edits.
- **Keep it small** — Prefer minimal implementations that are easy to test and reason about.
- **Embrace darkness** — Limited visibility sells the horror better than over-lighting.
- **Avoidance is valid** — Many fights are avoidable. The AI should respect that (especially drones).
- **Use `context7` for Phaser API** — For Phaser v4 API questions, use `tools.context7["query-docs"]` with the `phaser` library. This is often faster and more up-to-date than guessing.
- **Route to specialists** — Use agents/skills/commands over ad-hoc prompting when they fit the task.

## License

This project is in early development. License to be determined.