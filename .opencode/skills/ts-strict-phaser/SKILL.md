---
name: ts-strict-phaser
description: TypeScript strict mode patterns for Phaser v4
license: MIT
compatibility: opencode
metadata:
  type: typescript
---
## Purpose
Avoid strict mode pitfalls with Phaser.

## Guidelines
- No `any`. Use proper types/interfaces
- Strict null checks - guard against undefined
- Type scene data properly
- Use Phaser types, avoid casting unless absolutely necessary
- Clean up event listeners in shutdown/destroy
- Avoid mutating shared config objects
- Type component data structures explicitly
- Be careful with sprite/gameobject property access

## Common Issues
- Group/Container typing
- Tween callbacks
- Input events
- Asset keys
- Tilemap layers
