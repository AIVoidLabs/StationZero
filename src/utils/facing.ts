import type { Direction } from '../assets/manifest';

export interface GridVector {
  readonly x: number;
  readonly y: number;
}

const CARDINAL_RATIO = 2.2;
const DIAGONAL = Math.SQRT1_2;

export const DIRECTIONS: readonly Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const DIRECTION_VECTOR: Record<Direction, GridVector> = {
  N: { x: -DIAGONAL, y: -DIAGONAL },
  NE: { x: 0, y: -1 },
  E: { x: DIAGONAL, y: -DIAGONAL },
  SE: { x: 1, y: 0 },
  S: { x: DIAGONAL, y: DIAGONAL },
  SW: { x: 0, y: 1 },
  W: { x: -DIAGONAL, y: DIAGONAL },
  NW: { x: -1, y: 0 },
};

export const DIRECTION_VECTOR_GRID: Record<Direction, GridVector> = {
  N: { x: 0, y: -1 },
  NE: { x: 1, y: -1 },
  E: { x: 1, y: 0 },
  SE: { x: 1, y: 1 },
  S: { x: 0, y: 1 },
  SW: { x: -1, y: 1 },
  W: { x: -1, y: 0 },
  NW: { x: -1, y: -1 },
};

export function facingToVector(direction: Direction): GridVector {
  return DIRECTION_VECTOR_GRID[direction] ?? { x: 0, y: 1 };
}

export function facingForGridStep(stepX: number, stepY: number): Direction {
  const absX = Math.abs(stepX);
  const absY = Math.abs(stepY);

  if (absX > absY * CARDINAL_RATIO) return stepX > 0 ? 'SE' : 'NW';
  if (absY > absX * CARDINAL_RATIO) return stepY > 0 ? 'W' : 'N';
  if (stepY > 0) return stepX > 0 ? 'S' : 'E';
  return stepX > 0 ? 'NE' : 'SW';
}
