import type { Direction } from '../assets/manifest';

export interface GridVector {
  readonly x: number;
  readonly y: number;
}

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

export function facingToVector(direction: Direction): GridVector {
  return DIRECTION_VECTOR[direction] ?? { x: DIAGONAL, y: DIAGONAL };
}

const SCREEN_SECTORS: readonly Direction[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

// Sprite directions are screen-relative. A grid step (x, y) projects to screen (x - y, (x + y) / 2),
// so the y axis is doubled here to keep the grid axes at the centre of the 45 degree sectors.
export function facingForScreenVector(screenX: number, screenY: number): Direction {
  const angle = Math.atan2(screenY, screenX);
  const sector = Math.round(angle / (Math.PI / 4));
  return SCREEN_SECTORS[((sector % 8) + 8) % 8] ?? 'S';
}

export function facingForGridStep(stepX: number, stepY: number): Direction {
  return facingForScreenVector(stepX - stepY, stepX + stepY);
}

export function facingScreenAngle(direction: Direction): number {
  const index = SCREEN_SECTORS.indexOf(direction);
  return (Math.max(0, index) * Math.PI) / 4;
}
