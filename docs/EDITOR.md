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

## Difficulty score
The right panel shows a live **score** for the open floor, the **formula target** (what `difficulty.ts` would place on that floor) and the difference in percent, plus a bar list of **all floors** so you can see the curve. Click a floor to open it. The same score is printed by `npm run levels:check`.

The score is an estimate of how much a floor can hurt and how long it takes to clear:
- each enemy: durability (HP scaled by the floor, plus 0.6 per armour point) x firepower (shots per second, scaled by the floor). Immobile enemies count 0.8. Bosses also count their summoned drones;
- each steam vent: +1.5.
It also shows ammo supply versus ammo needed (start ammo + loot + enemy drops, against the shots to kill everything). Below 1.0x the floor is starved of ammo and is flagged red. A floor scoring lower than the one above is flagged too.

## Hand-made workflow
1. Open a floor, let the generator give you a start (**Regenerate floor** or the bundled map).
2. Edit the map and placements by hand: add, move or remove enemies, loot and props. Watch the score and the all-floors curve.
3. Aim for a smooth curve: each floor a little above the one before. The boss floors (B9 and B11) are naturally steep, so tune the floors around them.
4. When happy, tick **Locked**, **Download JSON**, copy it into `src/data/levels/`, run `npm run levels:check`.
Locked floors are never touched by `npm run levels:bake`. Enemy health and fire rate scale with the floor at run time, so hand-placed enemies follow the same ramp as generated ones.
