export interface GridSize {
  width: number;
  height: number;
}

export function isInBounds(gridX: number, gridY: number, size: GridSize): boolean {
  return gridX >= 0 && gridX < size.width && gridY >= 0 && gridY < size.height;
}

export function clampToBounds(gridX: number, gridY: number, size: GridSize): { gridX: number; gridY: number } {
  const clampedX = Math.max(0, Math.min(size.width - 1, gridX));
  const clampedY = Math.max(0, Math.min(size.height - 1, gridY));
  return { gridX: clampedX, gridY: clampedY };
}

export function gridKey(gridX: number, gridY: number): string {
  return `${gridX},${gridY}`;
}

export function keyToGrid(key: string): { gridX: number; gridY: number } | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const gridX = parseInt(parts[0] ?? '', 10);
  const gridY = parseInt(parts[1] ?? '', 10);
  if (isNaN(gridX) || isNaN(gridY)) return null;
  return { gridX, gridY };
}
