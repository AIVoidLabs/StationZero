---
name: dungeon-tight-corridors
description: Generate claustrophobic room+corridor dungeons for Station Zero
license: MIT
compatibility: opencode
metadata:
  type: levelgen
---
## Purpose
Generate tight, oppressive layouts favoring corridors over open spaces.

## Approach
- Prefer narrow rectangular rooms connected by single-width corridors
- Use L-shapes and zig-zags to break line of sight
- Create dead-ends and chokepoints for tension
- Avoid large open arenas
- Keep rooms small (2x3, 3x3 max) with tight connections
- Leave some paths for evasion (not all routes force combat)
- As depth increases, layouts get tighter and more maze-like

## Tips
- Focus on connectivity without making it too open
- Place walls to create natural cover/pursuit breaks
- Design for LOS-based AI
- Environmental storytelling spots at dead-ends/corners
