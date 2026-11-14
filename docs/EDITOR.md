# Level Designer

A browser tool for editing the floor files in `src/data/levels/floor-N.json`. Start the dev server and open
`http://localhost:5173/editor.html`. It uses the game's own tiles and sprites, drawn isometrically.

It does **not** write to disk. Edits are autosaved as a draft in the browser (`*draft` in the floor list). When you are
happy, press **Download JSON**, copy `floor-N.json` into `src/data/levels/`, and run `npm run levels:check`.

## Layout
- **Left:** floor list (B1-B11) and tools. **Right:** inspector for the selection, and the validation list.
- **Top:** Undo / Redo, Download / Upload JSON, Play draft, Locked, Seed + Regenerate floor, Re-plan entities, Reset floor.

## Tools
| Tool | Key | What it does |
| --- | --- | --- |
| Select / move | 1 | Click to select an entity or room, drag an entity to move it, `Delete` removes it. |
| Floor / Wall brush | 2 / 3 | Paint cells. Painting a wall removes anything standing there. |
| Floor / Wall rectangle | 4 / 5 | Drag a rectangle. |
| Room | 6 | Drag a rectangle to add a room (style 0-2). "Carve floor" digs it out. |
| Erase | 7 | Removes the entity on a cell. |
| Spawn, Exit hatch | | One each. The last floor has no exit. |
| Enemies, items, props, terminal, the dead, steam vent | | Click a floor cell to place; adjust seed, phase or amount in the inspector. |

Pan: right or middle mouse drag, or Space + drag. Zoom: wheel. Undo / redo: Ctrl+Z / Ctrl+Shift+Z.

## Validation
Runs live on every change with the same rules as `npm run levels:check` (`src/systems/LevelCheck.ts`): schema (the loader),
unreachable cells, overlaps, anything on the spawn or exit, props cutting the level, boss count, the dead touching a wall.
Click a problem to jump to its cell.

## Generator and locking
- **Regenerate floor** builds a new map and all placements from a seed (what `levels:bake` does).
- **Re-plan entities** recomputes enemies, loot, props and hazards for the current map.
- Tick **Locked** to mark the floor hand-made. `npm run levels:bake` then skips it (`locked: true` in the JSON) and will
  not overwrite your work. `levels:check` still validates it.

## Try it
**Play draft** stores the current floor and opens `/?debug&depth=N&level=draft` (dev server only), so you can walk it
without copying files.
