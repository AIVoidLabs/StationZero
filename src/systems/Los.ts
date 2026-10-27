import type { WalkableGrid } from './Pathfinding';

export interface GridCell {
  readonly gridX: number;
  readonly gridY: number;
}

export function hasLineOfSight(
  grid: WalkableGrid,
  from: GridCell,
  to: GridCell,
): boolean {
  if (from.gridX === to.gridX && from.gridY === to.gridY) return true;
  if (!grid.isWalkable(from.gridX, from.gridY)) return false;
  if (!grid.isWalkable(to.gridX, to.gridY)) return false;

  const dx = to.gridX - from.gridX;
  const dy = to.gridY - from.gridY;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  let x = from.gridX;
  let y = from.gridY;
  let tMaxX = absX === 0 ? Number.POSITIVE_INFINITY : 0.5 / absX;
  let tMaxY = absY === 0 ? Number.POSITIVE_INFINITY : 0.5 / absY;
  const tDeltaX = absX === 0 ? Number.POSITIVE_INFINITY : 1 / absX;
  const tDeltaY = absY === 0 ? Number.POSITIVE_INFINITY : 1 / absY;
  const limit = absX + absY + 2;

  for (let step = 0; step < limit; step += 1) {
    if (x === to.gridX && y === to.gridY) return true;

    if (tMaxX < tMaxY) {
      x += stepX;
      tMaxX += tDeltaX;
    } else {
      y += stepY;
      tMaxY += tDeltaY;
    }

    if (!grid.isWalkable(x, y)) return false;
  }

  return x === to.gridX && y === to.gridY;
}
