// Cartesian (gridX, gridY) to Screen (isoX, isoY)
export function cartesianToIso(gridX: number, gridY: number, tileWidth: number, tileHeight: number): { isoX: number; isoY: number } {
  const isoX = (gridX - gridY) * (tileWidth / 2);
  const isoY = (gridX + gridY) * (tileHeight / 2);
  return { isoX, isoY };
}

// Screen (isoX, isoY) to Cartesian (gridX, gridY)
export function isoToCartesian(isoX: number, isoY: number, tileWidth: number, tileHeight: number): { gridX: number; gridY: number } {
  const gridX = (isoX / (tileWidth / 2) + isoY / (tileHeight / 2)) / 2;
  const gridY = (isoY / (tileHeight / 2) - isoX / (tileWidth / 2)) / 2;
  return { gridX: Math.floor(gridX), gridY: Math.floor(gridY) };
}

// Snap world position to isometric grid cell
export function worldToGrid(worldX: number, worldY: number, tileWidth: number, tileHeight: number): { gridX: number; gridY: number } {
  return isoToCartesian(worldX, worldY, tileWidth, tileHeight);
}
