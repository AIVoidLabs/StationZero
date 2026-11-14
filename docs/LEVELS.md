# Levels (`src/data/levels/floor-N.json`)

Each floor is one JSON file. The game only **reads** it: nothing about where things stand is computed at run time
(except decals, which are purely visual, and things that appear during play: kill drops, boss summons, explosions).

```jsonc
{
  "floor": 3, "seed": 123, "rows": ["#####", "#.@.X", ...], "rooms": [{ "x": 1, "y": 1, "width": 6, "height": 5, "style": 0 }],
  "entities": {
    "props":     [{ "x": 9, "y": 4, "kind": "barrel|crate|pipe|theme" }],       // block the cell; barrels explode
    "terminals": [{ "x": 5, "y": 7 }],                                         // [0] is the talking terminal
    "corpse":    { "x": 6, "y": 7 },                                           // or null (B11)
    "loot":      [{ "x": 3, "y": 8, "kind": "ammo|stim", "amount": 4 }],       // amount 0 for stims
    "enemies":   [{ "x": 12, "y": 9, "kind": "drone|tank|assembler|warden", "seed": 1234567 }],
    "hazards":   { "vents": [{ "x": 7, "y": 12, "phaseMs": 1400 }],
                   "gates": [{ "x": 17, "y": 13, "axis": "x|y", "phaseMs": 900 }] }
  }
}
```

`rows`: `#` wall, `.` floor, `@` spawn, `X` exit. Every coordinate is a grid cell on a floor tile.
Boss floors (B9, B11) hold exactly one `assembler` / `warden`; the warden starts dormant.

## Two ways to work

- **Edit by hand.** Change any coordinate, then run `npm run levels:check`. It validates the schema (the loader
  refuses bad files) and the rules: nothing overlaps or sits on spawn/exit, props do not cut the level apart, loot and
  enemies are not inside props, boss counts are right.
- **Regenerate.** When a rule or a number changes (enemy counts, loot amounts, placement code), run
  `npm run levels:bake`. It rebuilds the maps **and** every placement through `src/systems/LevelPlan.ts` and
  **overwrites hand edits**. Commit the diff.

`LevelPlan.ts` is the single place that decides where things go; `Decor`, `LootSystem`, `Combat` and `Hazards` only
create objects from the JSON.
