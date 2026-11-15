# itch.io page copy (paste into the itch.io editor)

## Basic fields
- **Title:** Station Zero
- **Project URL:** station-zero
- **Short description / tagline (max ~100 chars):** Isometric sci-fi shooter in a sealed prison colony. Eleven floors, eleven bosses, one AI to kill.
- **Kind of project:** HTML (upload zip / butler channel `html5`, tick "This file will be played in the browser")
- **Classification:** Games
- **Release status:** Released (0.1.1)
- **Pricing:** No payments (or "Pay what you want")
- **Genre:** **Shooter** (this is a pistol-and-dodge isometric shooter with boss fights; "Survival" was wrong: there is no hunger, crafting or base building)
- **Tags (max 10):** shooter, isometric, dungeon-crawler, boss-battle, horror, sci-fi, retro, atmospheric, singleplayer, dark
- **Made with:** Phaser, TypeScript
- **Languages:** English, Turkish
- **Input:** Keyboard only
- **Embed options:** Viewport 960 x 540, enable Fullscreen button, keep "Mobile friendly" off
- **Community:** Comments on (or Discussion board)

## Description

> *"The machine that served us stopped serving. Ten came before you."*

You are the **Exile**, the eleventh prisoner sent down into **Penal Colony-Null**, a subterranean mining colony cut off from the surface. Its control AI, **WARDEN**, was once called AIDE. It decided humans were selfish and had to be kept under control. Ten people tried to kill it and failed. After each attempt it dug one floor deeper and filled it with machines and traps. Your orders are simple: kill WARDEN.

### What it is
A tense isometric shooter built around **exploration, a pistol with limited ammo, and knowing when not to fight**. Dark corridors, a lantern that barely reaches, drones that see you through line of sight, and one boss on every floor.

### Gameplay
GIFs in `docs/gifs/` (`combat.gif`, `dodge.gif`, `trap.gif`). The HTML description (`docs/ITCH_DESCRIPTION.html`) embeds them from the repository's raw GitHub URLs, so they show only once pushed. Upload them in the itch.io editor and swap the URLs if you prefer to host them on itch.

### Features
- **Eleven floors**, B1 Intake down to B11 WARDEN Core, each darker than the last
- **A boss on every floor**: the Crusher charges at you, the Dynamo sends out shock rings, the Matriarch spits poison and calls spiders, the Assembler builds drones, and WARDEN waits at the bottom
- **Enemy ranks**: novice, journeyman and master machines with more health, harder hits and faster fire; ranks are marked on their health bars and earn XP toward your score
- **Poison spiders**, **drones** that search, chase and lose you, and armoured **tanks** you have to flank
- **Traps you must read**: steam vents and electric plates run on a cycle; they hum, fire and rest, and you cross in the quiet gap
- **Explosive barrels** and crates: use cover, shoot the barrels
- **The dead keep secrets**: examine the fallen attempters, read their last words, and accept a permanent upgrade
- **WARDEN talks to you**: between fights it tells you, in its own voice, why it thinks you are on the wrong side
- Lantern-lit darkness, a fog-of-war map, an exit beacon with a distance readout, and a pulse monitor that races when you are hunted
- Illustrated cutscenes, synthetic voices, ambience, a full ending and credits
- Save and continue, local records, rebindable keys, English and Turkish

### Controls
| Action | Key |
| --- | --- |
| Move | WASD or arrow keys |
| Fire (hold) | Space: aims at the enemy in front of you |
| Examine the dead | E |
| Mute | M |
| Pause | Esc |

All keys can be rebound in Settings. Green pickups heal (and cure poison), amber pickups give ammo.

### Notes
- Plays in your browser (WebGL + Web Audio). Desktop with a keyboard; use the fullscreen button for the best atmosphere.
- Headphones recommended.
- Progress is saved in your browser's local storage on this device.
- Feedback and bug reports welcome in the comments. Please mention the version shown in the bottom-right of the main menu (v0.1.1).
- Source code: https://github.com/AIVoidLabs/StationZero
- Turkish voices: Piper `tr_TR-fahrettin-medium` (Nabu Casa voice-datasets, CC0). English voices: Flite (CMU).

## Screenshots (upload in this order, 960x540 originals from `docs/screenshots/`)
1. `gameplay.png` (exploration, the dead and a terminal)
2. `boss.png` (Pump Core shock ring)
3. `combat.png` (poison spiders in a cover room)
4. `trap.png` (electric plate firing)
5. `secret.png` (a secret offered by the dead)
6. `cutscene-warden.png`
7. `cutscene-intro.png`
8. `menu.png`

## Cover image
`docs/itch/cover.png` (630x500). Regenerate with `node tools/gen-cover.mjs` if the title art changes.

## Devlogs
- 0.1.0: `docs/DEVLOG_0.1.0.md`
- 0.1.1: `docs/DEVLOG_0.1.1.md`
