# Station Zero — Game Design Document

Version 0.0.1 (prototype). Numbers are taken from `src/data/config.ts` unless noted; if the code and this document disagree, the code wins.

## 1. Vision

A 2D isometric, retro-futuristic survival dungeon crawler set in `Penal Colony-Null`, a sealed subterranean mining colony. The player is a forgotten prisoner, the *Exile*, descending through four floors while the colony's control AI, **WARDEN**, hunts them with rogue maintenance drones. There is no rescue; surviving one more step is the goal.

**Elevator pitch:** *Claustrophobic isometric survival. Dim lantern, limited ammo, drones that watch, and an AI that never stops enforcing your sentence.*

### Pillars

1. **Survival-first** – no scripted escape; every encounter is a resource decision.
2. **Environmental storytelling** – broken panels, terminals, faded labels, corrupted logs; minimal dialogue.
3. **Claustrophobic action** – tight rooms and corridors, short sight lines, never a wide arena.
4. **Minimal scope** – only *Exploration + Mining(Scavenging) + Avoidance/Combat*. No crafting, no RPG stats.
5. **Dark & unsettling** – tension over jump scares; darkness is a threat.

### Platform and target

Browser (desktop), HTML5 / WebGL via Phaser 4, 960×540 logical resolution scaled to fit, keyboard + mouse. A single run takes roughly 10–20 minutes.

## 2. Core loop

1. **Explore** a small, dark floor with a lantern and a fog-of-war minimap.
2. **Scavenge** loot: stims (health) and ammo; terminals reveal map areas or unlock caches.
3. **Avoid or engage** drones. They see in a cone and with line of sight; evasion is often right.
4. **Clear** the floor: when every hostile on the floor is destroyed, the hatch unseals.
5. **Descend** by stepping onto the hatch. Light dims, drones get sharper, WARDEN grows louder.
6. **Survive** to the end of B4. The run is scored and recorded either way.

## 3. The player (Exile)

| Stat | Value |
| --- | --- |
| Health | 4 (HP), 0.6 s invulnerability after a hit, small knockback |
| Move speed | 190 px/s, 8 screen-relative directions, grid collision |
| Pistol | 12 rounds max (start full), 1 damage, range 5.5 tiles, 0.32 s cooldown; bullet travels at 15 tiles/s (visible streak) |
| Melee | 1 damage, range 1.8 tiles, 95° arc, 0.28 s cooldown |
| Loot | Stim +1 HP; ammo box +4 rounds. Drops from drones (55%) plus a guaranteed number per floor (5 on B1, fewer deeper) |

Input: WASD/arrows (rebindable), click-to-walk with A* pathfinding (hover previews the target tile), left-click or Space attacks, right-click fires the pistol, `E` interacts with terminals, `M` mutes, `Esc` pauses.

## 4. World

- **Projection:** dimetric 2:1 (tile 64×32, wall height 46); depth-sorted by iso Y; walls near the player fade out.
- **Floors:** four hand-baked 27×27 grid levels (`src/data/levels/floor-*.json`), 6–7 rooms each, spawn and a far-away hatch (sealed on the last floor). Materials: steel, concrete, grate; decals and props (barrel, crate, terminal, pipe) add clutter; props block movement.
- **Visibility:** a light map darkens everything except the player's light and the lantern cone; dying drone flares and shots briefly light the room. Walls occlude drone vision.
- **Minimap:** bottom-right, fog-of-war (unexplored areas stay black), with a *% explored* readout.

## 5. Enemies — rogue maintenance drones

- 2 HP, hover with a bob, hostile since WARDEN rebuilt them. Two per floor, three from B3.
- **States:** idle/patrol → chase → search → return/disengage. Sight: 7.5 tiles in a 120° cone, plus 1.8 tiles of peripheral awareness; sight scales up with depth (+30% at B4).
- **Rules:** need line of sight; chase leashes (max 7 s / 11 tiles), search for 2.6 s, then return home. No infinite pursuit.
- **Attack:** a red flash wind-up (0.45 s), then a red bullet (7 tiles/s, slower than the player's), 1 damage; fire cooldown ~2.4 s, shorter deeper. They also sidestep player shots (50% chance) and deal contact damage in melee.
- **Death:** a wreck sprite stays on the floor; a flare lights the area for 0.9 s. Kills may drop loot.
- Pressure rises with **numbers and awareness, not HP**: drones never become bullet sponges.

## 6. WARDEN — the director

WARDEN is not a character on screen; it is a **director**.

- **Atmosphere pulses:** periodic light dips (every 21–47 s, shorter on deeper floors) and "silence" holds where all ambience cuts out (25% chance on B1 rising to 60% on B4, held up to 1.8× longer).
- **Announcements:** a short line when you arrive and when the floor is cleared, in text and a synthetic voice (see [SCENARIO.md](SCENARIO.md)).
- **Escalation per floor (B1→B4):** vision radius ×1→0.65, lantern ×1→0.68, ambience pitch −3% per floor, drone awareness ×1→1.3.
- **Alert** (0–4, set by terminal choices): each point adds +12% to depth pressure and +10% awareness on top of the floor baseline.

## 7. Progression and structure

| Floor | Name | Hostiles | Notes |
| --- | --- | --- | --- |
| B1 | INTAKE | 2 | Teaches movement, click-to-walk, interacting with a terminal, loot |
| B2 | CELL BLOCK | 2 | Ross's log; map reveal option; first dark corners |
| B3 | DRILL 3 | 3 | Foreman's log; drones have the longest sight so far; shortcut that costs/bargains stance |
| B4 | WARDEN CORE | 3 | WARDEN's terminal; darkest floor; clearing it ends the run |

- **Sealed hatch:** opens when all hostiles on the floor are destroyed (the door plays an opening animation, a guide arrow appears). Stepping onto it makes the Exile spin on the spot, then descend with a fade and a short cutscene.
- **Save:** an autosave on arrival at each floor (floor, HP, ammo, run stats, story flags) powers *Continue*.
- **Endings:** compliant, defiant or death, decided by choices (see [SCENARIO.md](SCENARIO.md)).
- **Score:** `floorReached × 1000 + kills × 150 + (survived ? 3000 : 0) − seconds played`, minimum 0; top 10 kept locally in *Records*.

## 8. Systems

| System | Notes |
| --- | --- |
| Menus | Main menu (Continue / New game / Records / Settings / Credits), pause, end screen; mouse and keyboard, hover sound |
| Settings | Master/music/SFX volume, screen shake, minimap, FPS counter, cutscenes, hints, voice, language, key rebinding |
| Hints | One-time contextual hint bar (move, attack, dodge, loot, sealed hatch, map, low HP…) with *Reset hints* |
| Terminals | Interaction prompt; branching dialogue panel with 1–3 hotkeys; effects (stance, alert, reveal, cache, lore) |
| Cutscenes | Intro, three descents, two endings; illustrated stills with camera moves, skippable, can be disabled |
| Records | Local leaderboard in `localStorage` (`station-zero:records`) |
| Localisation | English and Turkish, auto-detected from the browser, switchable in Settings |
| Dev flags | `?debug`, `?depth=n` — dev server only |

## 9. Presentation

### Art direction
Late-70s / early-80s retro-futurism: rusted steel, bare concrete, flickering fluorescents, analog readouts. Palette: sickly amber, harsh white, rust red, cold cyan, deep violet and a lot of black (`PALETTE` in `config.ts`). Low-resolution pixel art; **all art is generated in code** (SVG rigs → pixelated → composited), so the whole look can be regenerated deterministically (`npm run art:v2`). UI is brutalist and monospaced: boxy panels, tick marks, green VITALS, amber AMMO, red SECTOR card.

### Audio
Diegetic, oppressive, low melody: a 24 s ventilation ambience loop, menu/end music, procedural SFX (shots, hits, pickups, door, UI), footsteps that change by floor material (steel / concrete / grate), and distinct synthetic voices (WARDEN, clerk, Ross, foreman, the Exile) in English and Turkish through ffmpeg/espeak-ng.

### Camera and feel
Zoom 2×, soft follow with slight look-ahead; short screen shake and a red vignette pulse on damage (optional). The health and ammo HUD flash on change.

## 10. Out of scope (on purpose)

Crafting, inventory, XP/levels, skill trees, shops, open arenas, procedural runtime level generation (levels are authored/baked), multiplayer, gamepad (for now), jump scares.

## 11. Known gaps and ideas

- Turkish text and voices need a native-speaker review.
- Bosses ("heavy, infrequent, space-controlling") are in the design pillars but not implemented yet.
- Mining proper (scavenging nodes) is represented only by loot/caches.
- Gamepad support, more drone types, and additional floors are possible follow-ups.
- Automated tests do not exist yet; verification is typecheck + manual play (+ `npm run levels:check`).
