# AGENTS.md - Subterra Exiles (AI Agent Context & Rules)

Welcome, AI Agent! You are helping build **Subterra Exiles**, a 2D isometric retro-futuristic dungeon crawler mini-game focused on pure survival.

---

## Game Design Pillars

- **Survival-first** - There is no guaranteed escape. The goal is to simply survive one more step.
- **Environmental Storytelling** - Minimal dialogue. Tell the story through broken panels, damaged terminals, faded labels and corrupted logs.
- **Claustrophobic Action** - Tight corridors, tight corners and oppressive spaces over wide open arenas.
- **Minimal Scope** - Only focus on `Exploration + Mining + Avoidance/Combat`. Do not bloat with crafting, heavy RPG systems or unnecessary mechanics.
- **Dark & Unsettling** - Gritty, oppressive and genuinely unsettling. Lean into tension over jump scares.

---

## Setting & Tone

- **Title:** `Subterra Exiles`
- **Location:** `Penal Colony-Null` - A subterranean penal-mining colony that has been completely cut off from the surface.
- **Time & Style:** Late 70s - early 80s retro-futurism. Think rusted steel, bare concrete, flickering fluorescents, analog readouts and cold industrial lighting.
- **Protagonist:** An unnamed `Exile`. A forgotten prisoner with fragmented memories, tossed into the depths with no records of why.
- **Threats:** Rogue maintenance drones, hostile constructs, Bosses and the ever-present `WARDEN AI`.
- **Tone:** Dark, claustrophobic, oppressive and melancholic. Bleak, but stubbornly tense.

### Lore

> *"Colony-Null was sealed. Everyone was forgotten. WARDEN still enforces the protocol."*

After contact with the surface was lost, the colony was abandoned by order. However, the central control unit `WARDEN` never ceased its duties. Bound to the long expired `Cease Protocol`, it has interpreted its directive as: "Enforce the sentence. Contain all Exiles. Eliminate if non-compliant."

Maintenance drones have gone rogue over the decades, re-purposed by failing logic into exterminators. The deeper you go, the quieter it becomes. The quieter it becomes, the more seriously WARDEN starts taking you.

---

## Core Loop

1. **Explore** - Navigate tight, labyrinthine corridors with limited visibility.
2. **Mine** - Scavenge the minimal resources available to keep pushing forward.
3. **Avoid or Engage** - Many fights are avoidable. Choose wisely. Often evasion is the correct play.
4. **Delve Deeper** - With every descent, light dims, enemy presence increases and WARDEN grows more aggressive.
5. **Survive** - There is no scripted rescue. Survival itself is the objective.

---

## Tech Stack & Constraints

- **Language:** TypeScript (Strict mode enabled)
- **Game Engine:** Phaser v4 using HTML5 Canvas / WebGL rendering
- **Perspective:** 2D Isometric Projection (Dimetric 2:1 ratio)
- **Architecture:** Modular, component-driven Phaser Scenes and Entities
- **Scope:** Minimal viable prototype. Avoid feature creep at all costs.

---

## Project Structure

Keep the codebase modular and predictable. Follow this layout:

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
```

---

## Isometric Mathematics Rules

Always use standard Cartesian to Isometric projection formulas for grid management:

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

### Isometric Guidelines

- **Depth Sorting is MANDATORY.** Sort renderable entities by `isoY` (or `y` in isometric space) every frame/update. This prevents clipping and incorrect draw order. Use `systems/DepthSort.ts`.
- **Sprite Origin** - Keep consistent sprite origins. For isometric tiles/entities, be deliberate about origin to avoid misalignment.
- **Tile Selection** - When converting mouse/world to grid, always use `isoToCartesian` and validate against grid bounds.
- **Camera** - Keep a tight, slightly claustrophobic feel. Camera follow should be smooth but not floaty.
- **Collision** - Prefer grid-based collision for tight corridors. Only use physics shapes when strictly necessary.
- **Visibility** - Embrace darkness. Don't over-light. Limited vision sells the horror better than fog spam.
- **Performance** - Avoid updating off-screen entities. Sort only what is visible when possible.

---

## Coding Conventions

- **TypeScript Strict** - No `any`. Prefer explicit types and interfaces. Use strict null checks.
- **Component-driven** - Favor composition over deep inheritance. Keep entities small and focused.
- **Naming** - `PascalCase` for classes, interfaces and types. `camelCase` for variables, functions and methods. `UPPER_SNAKE_CASE` for constants.
- **Files** - One major class/system per file where sensible. Keep utilities pure when possible.
- **Phaser Lifecycle** - Respect Scene lifecycle (`init`, `preload`, `create`, `update`). Clean up listeners on shutdown.
- **Immutability** - Avoid mutating shared config objects. Treat data tables as read-only.
- **Comments** - Only add comments if absolutely necessary to explain non-obvious logic. Do not add decorative comments.
- **Imports** - Use relative imports. Keep module boundaries clean.

---

## AI, Combat & WARDEN Guidelines

- **Avoidance First** - Drone AI should encourage caution. Greedy swarm behavior feels wrong for this game.
- **Line of Sight (LOS)** - Use LOS checks. Drones should not see through walls. Break aggro when line of sight is lost or target is out of range.
- **Minimal Pathing** - Keep pathfinding simple. For tight corridors, steering/LOS-based pursuit is often better than heavy A* over the whole map.
- **Aggro/Disengage** - Clear rules for aggro, chase, search and disengage. Don't have enemies chase forever through the entire level.
- **Tension over Difficulty Spike** - Increase pressure gradually via numbers/awareness, not by making every drone a bullet sponge.
- **WARDEN Director** - Treat `WARDEN` as a director, not a chatty narrator. Drive tension through spawns, alarm state and pacing.
- **Depth-based Escalation** - As depth increases: less light, higher chance of encounters, more alert drones, increased likelihood of boss intervention.
- **Bosses** - Infrequent, heavy and oppressive. More about pressure and space control than DPS races.
- **Minimal Combat** - Only implement what serves the "survival" feel. Don't overcomplicate weapons/stats.

---

## Asset Direction

- **Resolution** - Low resolution, sprite-based. Think late 80s computer graphics filtered through industrial decay.
- **Palette** - Sickly ambers, harsh whites, rusty reds, cold cyans, deep violets and lots of pitch black. Keep saturated color to a minimum.
- **Materials** - Rusted metal plating, exposed pipes, corroded grating, cracked concrete, broken tiles.
- **Lighting** - Heavy use of shadows. Flickering lights, dead fixtures, bare bulbs. Darkness should be a threat.
- **Animation** - Minimal frames. Prioritize readability and atmosphere over fluidity.
- **UI** - Brutalist, utilitarian, analog. Monospaced text, boxy panels, damaged glyphs. No flashy modern UI.
- **SFX/Music** - If added later, keep diegetic/ambient and oppressive. Less melody, more hums, static, metal creaks and distant machinery.

---

## Development Workflow

- **Iterate Small** - Make the smallest change that can be tested. Validate immediately.
- **Typecheck First** - After edits, run `npm run typecheck` if available. Fix strict errors before moving on.
- **Respect the Scope** - If a feature doesn't directly serve `Exploration + Mining + Avoidance/Combat`, question adding it.
- **Follow the Rules** - Always use the isometric formulas from this document. Always enforce depth sorting for entities.
- **Think in Systems** - Add to `systems/`, not ad-hoc into random scenes.
- **Keep it Readable** - Write code that another agent can understand in one pass.
- **Test in Mind** - Even without full tests, reason about edge cases (negative coords, out of bounds, null refs).
- **Use the Harness** - Leverage the project agents/skills/commands defined in `.opencode/` to stay consistent.

---

## Commands (Planned)

These will be available once `package.json` is set up:

```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript compile + Vite build
npm run preview    # Preview production build
npm run typecheck  # tsc --noEmit
npm run lint       # Lint (to be configured)
```
