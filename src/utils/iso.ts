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

// Picks the grid cell whose diamond contains the given world point.
// `isoToCartesian` returns continuous grid space where a cell is centered on its
// integer coordinates, so picking requires rounding instead of flooring.
export function worldToGrid(worldX: number, worldY: number, tileWidth: number, tileHeight: number): { gridX: number; gridY: number } {
  const u = worldX / (tileWidth / 2);
  const v = worldY / (tileHeight / 2);
  return { gridX: Math.round((u + v) / 2), gridY: Math.round((v - u) / 2) };
}

export function gridVectorToWorld(gridX: number, gridY: number, tileWidth: number, tileHeight: number): { x: number; y: number } {
  return {
    x: (gridX - gridY) * (tileWidth / 2),
    y: (gridX + gridY) * (tileHeight / 2),
  };
}

export function worldVectorToGrid(x: number, y: number, tileWidth: number, tileHeight: number): { x: number; y: number } {
  const u = x / (tileWidth / 2);
  const v = y / (tileHeight / 2);
  return { x: (u + v) / 2, y: (v - u) / 2 };
}
