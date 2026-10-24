---
name: iso-math-grid
description: Cartesian<->isometric math, tile selection, grid collision helpers
license: MIT
compatibility: opencode
metadata:
  type: utilities
  projection: dimetric-2:1
---
## Purpose
Implements and uses the exact formulas from AGENTS.md.

## Formulas (must use)
```typescript
// Cartesian (gridX, gridY) to Screen (isoX, isoY)
export function cartesianToIso(gridX: number, gridY: number, tileWidth: number, tileHeight: number) {
  const isoX = (gridX - gridY) * (tileWidth / 2);
  const isoY = (gridX + gridY) * (tileHeight / 2);
  return { isoX, isoY };
}

// Screen (isoX, isoY) to Cartesian (gridX, gridY)
export function isoToCartesian(isoX: number, isoY: number, tileWidth: number, tileHeight: number) {
  const gridX = (isoX / (tileWidth / 2) + isoY / (tileHeight / 2)) / 2;
  const gridY = (isoY / (tileHeight / 2) - isoX / (tileWidth / 2)) / 2;
  return { gridX: Math.floor(gridX), gridY: Math.floor(gridY) };
}
```

## Usage
- Mouse/world -> grid: use isoToCartesian, floor, check bounds
- Grid -> world: use cartesianToIso for positioning
- Always validate grid coordinates are in bounds
- Be careful with negative coords
