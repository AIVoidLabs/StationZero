# Station Zero 0.1.0 is live

> *"The machine that served us stopped serving. Ten came before you."*

Station Zero 0.1.0 is out. It is a short, dark, isometric shooter that plays in your browser. You are the eleventh prisoner sent into Penal Colony-Null, and your only order is to kill WARDEN.

## What is in 0.1.0

- **Eleven floors**, from B1 Intake down to B11 WARDEN Core. Every floor is darker and tighter than the last.
- **A boss on every floor.** The Crusher charges you, the Dynamo sends out shock rings, the Matriarch spits poison and calls spiders, the Assembler builds drones, and WARDEN waits at the bottom.
- **Enemy ranks.** Novice, journeyman and master machines. Higher ranks have more health, hit harder and fire faster. Ranks are marked on their health bars and earn XP toward your score.
- **Poison spiders.** Fast, they keep their distance and spit poison. A stim cures it.
- **Traps you have to read.** Steam vents and electric plates hum, flicker and warn before they strike.
- **The dead keep secrets.** Ten people came before you. Find their bodies, read their last words and take what they left behind.
- **A full ending and credits.** Kill WARDEN and the story closes.
- **Keyboard only.** WASD or arrows to move, Space to fire, E to examine.

## What changed since the early build

The first public build had four floors, mouse controls and a branching-terminal ending. 0.1.0 replaces all of that:

- Four floors became eleven, each one hand-designed and then locked.
- Mouse controls are gone. Everything is keyboard-driven, with auto-aim on the enemy in front of you.
- There is now one ending: defeat WARDEN.
- Enemies got ranks, XP and new types. Traps got visual and audio warnings so they can be noticed in the dark.
- WARDEN was made tougher after testing showed the final fight was too easy.

## How it was made

Phaser 4 and TypeScript. Levels are data files made in a small built-in level designer that shows a live difficulty score while you draw. Art, voices and ambience are generated and kept deliberately low resolution to suit the late-70s industrial look.

## What I would like to know

- Which floor first made you stop and think before moving?
- Did any boss feel unfair, or too easy?
- Were the traps readable in the dark?

Please leave feedback in the comments and mention the version shown in the bottom-right of the main menu (v0.1.0). Thank you for playing.

Source code: https://github.com/AIVoidLabs/StationZero
