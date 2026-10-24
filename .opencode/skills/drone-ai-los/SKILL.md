---
name: drone-ai-los
description: LOS-based drone AI with aggro/disengage for avoidance-first gameplay
license: MIT
compatibility: opencode
metadata:
  type: ai
---
## Purpose
Implement cautious, threatening drones that reward evasion.

## States
- idle/patrol
- investigate (on sound/alert)
- chase (only with LOS + in range)
- search (brief, after losing LOS)
- disengage (return to patrol/search area or idle)

## Rules
- Raycast/LOS check before aggro
- Don't see through walls/obstacles
- Break aggro if LOS lost for short time OR out of range
- Limit chase distance/time - don't follow forever
- Avoid swarm stacking - spacing matters
- React to WARDEN alarm state but don't instantly aggro everything
- Encourage avoidance over direct confrontation
