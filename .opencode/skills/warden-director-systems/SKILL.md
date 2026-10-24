---
name: warden-director-systems
description: WARDEN AI director for depth-based escalation and tension
license: MIT
compatibility: opencode
metadata:
  type: director
---
## Purpose
Drive tension as director, not narrator.

## Systems
- Depth tracker (current descent level)
- Alarm state (calm/alert/alarmed) based on events/time/depth
- Spawn tables by depth (weights)
- Boss trigger conditions (rare, based on depth/milestones)
- Light/darkness influence
- Spacing rules to avoid horde spam

## Escalation
- Deeper = fewer safe corridors, more alert enemies
- Gradual ramp, not sudden difficulty spikes
- Bosses infrequent and oppressive
- Use silence as a tool - quiet moments build tension
- Spawn to pressure, not to overwhelm

## Notes
- Minimal UI. Let atmosphere do the work
- Environmental cues over explicit warnings
- Tension over jump scares
