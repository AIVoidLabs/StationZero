---
description: Create a new Phaser Scene (Boot/Preload/Game/UI)
agent: game-architect
argument-hint: "[arguments]"
---
Delegate to the `game-architect` subagent (Agent tool) for the design and code. It is read-only, so apply the files it returns yourself.

Create a new Phaser Scene in src/scenes/ with name $ARGUMENTS.

Follow Phaser v4 Scene lifecycle (init, preload, create, update).
Keep minimal and modular. Add proper typing.
Respect project structure.
Clean up listeners on shutdown if added.
