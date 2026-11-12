---
description: Suggest minimal drone AI with LOS for testing
agent: combat-ai
argument-hint: "[arguments]"
---
Delegate this to the `combat-ai` subagent (Agent tool) and relay its answer.

Suggest a minimal drone AI implementation for testing.

Parameters: $ARGUMENTS

Focus on:
- LOS raycast/check
- States: idle/patrol/chase/search/disengage
- Aggro only with LOS in range
- Break chase on LOS lost/out of range
- Limit pursuit distance/time
- Avoid swarm behavior
- Tight corridors friendly
- Easy to tune
