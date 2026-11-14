# Station Zero — Game Design Document

Version 0.0.1 (prototype). Numbers are taken from `src/data/config.ts` unless noted; if the code and this document disagree, the code wins.

## 1. Vision

A 2D isometric, retro-futuristic survival dungeon crawler set in `Penal Colony-Null`, a sealed subterranean mining colony. The player is the *Exile*, the eleventh person sent down by the humans above, descending eleven floors to kill the colony's control AI, **WARDEN**, while it hunts them with rogue maintenance drones. Ten attempts came before; each left a body and a secret on its floor.

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
6. **Survive** to B11 and kill WARDEN. The run is scored and recorded either way.

## 3. The player (Exile)

| Stat | Value |
| --- | --- |
| Health | 6 (HP), 0.6 s invulnerability after a hit, small knockback |
| Move speed | 190 px/s, 8 screen-relative directions, grid collision |
| Pistol | 12 rounds max (start full), 1 damage, range 7 tiles, 0.32 s cooldown; bullet travels at 15 tiles/s (visible streak) |
| Melee | 1 damage, range 1.8 tiles, 95° arc, 0.28 s cooldown |
| Loot | Stim +2 HP; ammo box +4 rounds. Every drone drops +4 ammo (tank +8, Assembler +8); stims drop 30% (falling with depth) when HP is missing, and 0.4 stims per hostile are left in separate rooms plus a guaranteed number per floor (3 on B1, fewer deeper) |

Input: WASD/arrows (rebindable), click-to-walk with A* pathfinding (hover previews the target tile), left-click or Space attacks, right-click fires the pistol, `E` interacts with terminals, `M` mutes, `Esc` pauses.

## 4. World

- **Projection:** dimetric 2:1 (tile 64×32, wall height 46); depth-sorted by iso Y; walls near the player fade out.
- **Floors:** eleven hand-baked 35×35 grid levels (`src/data/levels/floor-*.json`), 6–7 rooms each, spawn and a far-away hatch (sealed on the last floor). Materials: steel, concrete, grate; decals and props (barrel, crate, terminal, pipe) add clutter; props block movement.
- **Enemy placement:** every room except the one holding the spawn gets at least one enemy; the rest are spread over the larger rooms. On boss floors (B9, B11) the generator reserves an 11x9 boss room and only accepts a layout where it is the room farthest from the spawn, so the boss waits in the last room with a couple of guards.
- **Cover:** rooms 6x5 and larger get 2-3 crate blocks (some two tiles long) inside them. They block movement, sight and bullets, and placement is checked so the floor stays connected.
- **Explosive barrels:** red barrels (2-3 per cover room, one in most smaller rooms, plus random ones; none next to a terminal) explode when any bullet hits them, the Exile's or an enemy's. The blast reaches 2.2 tiles: 3 damage to every enemy (armour ignored; 2 to a boss), 2 to the Exile. Only a barrel set off by the Exile's bullet hurts enemies; one set off by an enemy shot hurts only the Exile. Steam vents do not hurt bosses, so a boss can only be killed by the player, and it sets off barrels nearby after a short delay. The barrel leaves a scorch and frees its cell.
- **Visibility:** a light map darkens everything except the player's light and the lantern cone; dying drone flares and shots briefly light the room. Walls occlude drone vision.
- **Minimap:** bottom-right, fog-of-war (unexplored areas stay black), with a *% explored* readout.

## 5. Enemies — rogue maintenance drones

- 2 HP, hover with a bob, hostile since WARDEN rebuilt them. Six on B1, rising to nine by B7 (see the floor table).
- **States:** idle/patrol → chase → search → return/disengage. Sight: 7.5 tiles in a 120° cone, plus 1.8 tiles of peripheral awareness; sight scales up with depth (+30% at B11).
- **Rules:** need line of sight; chase leashes (max 7 s / 11 tiles), search for 2.6 s, then return home. No infinite pursuit.
- **Attack:** a red flash wind-up (0.45 s), then a red bullet (4.5 tiles/s, slower than the player), 1 damage; fire cooldown ~2.4 s, shorter deeper. They also sidestep player shots (50% chance) and deal contact damage in melee.
- **Death:** a wreck sprite stays on the floor; a flare lights the area for 0.9 s. Kills may drop loot.
- Pressure rises with **numbers and awareness, not HP**: drones never become bullet sponges.

### Hazards and the robot tank

- **Steam vent** (from B4): a floor grate on a 5.2 s cycle: quiet 3.0 s, hissing warning 0.8 s, blast 1.4 s. The blast deals 1 damage within 0.85 tiles to the Exile and to enemies. Placed in corridors and room interiors, never near spawn, exit or loot.
- **Laser grid** (from B7): a beam across a one-tile corridor on a 3.4 s cycle: off 1.7 s, flickering warning 0.5 s, on 1.2 s. Touching it deals 1 damage and raises WARDEN alert by 1.
- **Armour** (tank and bosses): the front plate has its own HP. Head-on hits chip it down (3 for the tank); once it breaks the enemy is open from every side. Flanking hits skip the plate entirely.
- **Assembler** (B9 mid boss): 6 HP, 3 armour, slow tank body. Fires a fan of 3 shells and calls a drone every 11 s (up to 2 alive). Summoned drones give no loot or score and die with it.
- **WARDEN core** (B11 final boss): 9 HP, 4 armour, immobile. Turns slowly. Fires a fan of 5 shells and calls drones every 10 s (up to 2 alive). Killing it ends the run.
- **Robot tank** (from B6, rare): 2 HP, slow, turns slowly (one facing change per 0.9 s). Its front armour (a 37 degree cone) deflects shots; shots from the sides and rear, melee from behind, and hazards hurt it. Fires a heavy shell (1 damage, slow) after a 1.1 s wind-up; crushes in melee for 1.

## 6. WARDEN — the director

WARDEN is not a character on screen; it is a **director**.

- **Atmosphere pulses:** periodic light dips (every 21–47 s, shorter on deeper floors) and "silence" holds where all ambience cuts out (25% chance on B1 rising to 60% on B11, held up to 1.8× longer).
- **Announcements:** a short line when you arrive and when the floor is cleared, in text and a synthetic voice (see [SCENARIO.md](SCENARIO.md)).
- **Escalation per floor (B1→B11):** vision radius ×1→0.65, lantern ×1→0.68, ambience pitch −3% per floor, drone awareness ×1→1.3.
- **Alert** (0–4, set by terminal choices): each point adds +12% to depth pressure and +10% awareness on top of the floor baseline.

## 7. Progression and structure

| Floor | Name | Hostiles | Notes |
| --- | --- | --- | --- |
| B1 | INTAKE | 6 | Teaches movement, click-to-walk, terminals, loot; Hale's recording (WARDEN's old name) |
| B2 | CELL BLOCK | 7 | Voss: patrol loop; first dark corners |
| B3 | INFIRMARY | 7 | Lund: WARDEN reads pulse and voice |
| B4 | DRILL 3 | 8 | Dray: drones are rebuilt miners; steam vents |
| B5 | PUMP STATION | 8 | Sato: cooling lines |
| B6 | FOUNDRY | 8 + tank | Brandt: rear seam; first robot tank |
| B7 | ARCHIVE | 9 | Pell: FILE 0; laser grids |
| B8 | POWER GRID | 9 + tank | Moreau: backup feed |
| B9 | DRONE FOUNDRY | 6 + boss | Iyer: first instruction; mid boss, the Assembler |
| B10 | COMMS ARRAY | 9 + tank | Kessler: how to end it |
| B11 | WARDEN CORE | 6 + boss | WARDEN's terminal; final boss, the WARDEN core; killing it ends the run |

- **Secrets:** each recording on B1-B10 ends with a "take" choice that grants a permanent upgrade for the rest of the run (kept in saves). The hatch is unaffected: it still opens when every hostile is dead. A `SECRETS n/10` counter sits under the vitals panel.

| Floor | Secret | Upgrade |
| --- | --- | --- |
| B1 Hale | badge | +1 max HP |
| B2 Voss | route map | +6% move speed |
| B3 Lund | syringe | stims heal +1 |
| B4 Dray | badge | +3 ammo capacity |
| B5 Sato | valve key | front hits do 2 armour damage |
| B6 Brandt | cutter | melee damage +1 |
| B7 Pell | page | light radius +10% |
| B8 Moreau | fuse | 0.9 s recovery after a hit (was 0.6 s) |
| B9 Iyer | page | pistol fires 20% faster |
| B10 Kessler | final key | +1 max HP and a full heal |

- **Sealed hatch:** opens when all hostiles on the floor are destroyed (the door plays an opening animation, a guide arrow appears). Stepping onto it makes the Exile spin on the spot, then descend with a fade and a short cutscene.
- **Save:** an autosave on arrival at each floor (floor, HP, ammo, run stats, story flags) powers *Continue*.
- **Endings:** one ending (kill WARDEN) whose last line depends on stance, or death (see [SCENARIO.md](SCENARIO.md)).
- **Score:** `floorReached × 1000 + kills × 150 + (survived ? 3000 : 0) − seconds played`, minimum 0; top 10 kept locally in *Records*.

## 8. Systems

| System | Notes |
| --- | --- |
| Menus | Main menu (Continue / New game / Records / Settings / Credits), pause, end screen; mouse and keyboard, hover sound |
| Settings | Master/music/SFX volume, screen shake, minimap, FPS counter, cutscenes, hints, voice, language, key rebinding |
| Hints | One-time contextual hint bar (move, attack, dodge, loot, sealed hatch, map, low HP…) with *Reset hints* |
| Terminals | Interaction prompt; branching dialogue panel with 1–3 hotkeys; effects (stance, alert, reveal, cache, lore) |
| Cutscenes | Intro, descents (every floor from B2 has a still), two ending stills; illustrated stills with camera moves, skippable, can be disabled |
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
- Mining proper (scavenging nodes) is represented only by loot/caches.
- Gamepad support, more drone types, and additional floors are possible follow-ups.
- Automated tests do not exist yet; verification is typecheck + manual play (+ `npm run levels:check`).
