---
name: phaser-v4-iso-combat
description: Phaser v4 patterns for isometric action - movement, damage, minimal combat
license: MIT
compatibility: opencode
metadata:
  engine: phaser-v4
  genre: isometric-action
---
## Purpose
Patterns for isometric action in Phaser v4 focused on avoidance/combat minimalism.

## Key Patterns
- Isometric movement: convert input to isometric directions or use grid-based movement
- Depth sorting: sort sprites by isoY each frame in update or use a dedicated system
- Collision: prefer tile/grid checks for tight corridors
- Combat: simple hitboxes/ranges, minimal damage, knockback sparingly
- Camera: tight follow, avoid floaty movement

## Tips
- Keep update loops lean
- Clean up events on scene shutdown
- Test with tight corridors to catch z-order issues
- Avoid physics-heavy arcade bodies unless necessary
