import type { Scene } from 'phaser';
import { PALETTE, TILE_HEIGHT, TILE_WIDTH, WALL_HEIGHT } from '../data/config';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import { createRng, seedFromString } from '../utils/random';

type Point = readonly [number, number];
type Polygon = readonly Point[];

export const TILE_KEYS = {
  floorA: 'iso_floor_a',
  floorB: 'iso_floor_b',
  grate: 'iso_grate',
  wallA: 'iso_wall_a',
  wallB: 'iso_wall_b',
} as const;

const WALL_IMAGE_HEIGHT = TILE_HEIGHT + WALL_HEIGHT;

const DIAMOND: Polygon = [
  [TILE_WIDTH / 2, 0],
  [TILE_WIDTH, TILE_HEIGHT / 2],
  [TILE_WIDTH / 2, TILE_HEIGHT],
  [0, TILE_HEIGHT / 2],
];

const SILHOUETTE: Polygon = [
  [0, TILE_HEIGHT / 2],
  [TILE_WIDTH / 2, 0],
  [TILE_WIDTH, TILE_HEIGHT / 2],
  [TILE_WIDTH, TILE_HEIGHT / 2 + WALL_HEIGHT],
  [TILE_WIDTH / 2, TILE_HEIGHT + WALL_HEIGHT],
  [0, TILE_HEIGHT / 2 + WALL_HEIGHT],
];

const LEFT_FACE: Polygon = [
  [0, TILE_HEIGHT / 2],
  [TILE_WIDTH / 2, TILE_HEIGHT],
  [TILE_WIDTH / 2, TILE_HEIGHT + WALL_HEIGHT],
  [0, TILE_HEIGHT / 2 + WALL_HEIGHT],
];

const RIGHT_FACE: Polygon = [
  [TILE_WIDTH / 2, TILE_HEIGHT],
  [TILE_WIDTH, TILE_HEIGHT / 2],
  [TILE_WIDTH, TILE_HEIGHT / 2 + WALL_HEIGHT],
  [TILE_WIDTH / 2, TILE_HEIGHT + WALL_HEIGHT],
];

function getSource(scene: Scene, key: string): HTMLImageElement | HTMLCanvasElement | null {
  if (!scene.textures.exists(key)) return null;
  const image = scene.textures.get(key).getSourceImage();
  if (image instanceof HTMLImageElement || image instanceof HTMLCanvasElement) return image;
  return null;
}

function tracePolygon(ctx: CanvasRenderingContext2D, polygon: Polygon): void {
  const first = polygon[0];
  if (!first) return;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < polygon.length; i += 1) {
    const point = polygon[i];
    if (point) ctx.lineTo(point[0], point[1]);
  }
  ctx.closePath();
}

function paintFlat(ctx: CanvasRenderingContext2D, width: number, height: number, color: number): void {
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, width, height);
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
  rng: () => number,
): void {
  const sampleWidth = Math.min(width, source.width);
  const sampleHeight = Math.min(height, source.height);
  const maxX = Math.max(0, source.width - sampleWidth);
  const maxY = Math.max(0, source.height - sampleHeight);
  const sx = Math.floor(rng() * (maxX + 1));
  const sy = Math.floor(rng() * (maxY + 1));
  ctx.drawImage(source, sx, sy, sampleWidth, sampleHeight, 0, 0, width, height);
}

function buildFloor(
  scene: Scene,
  sourceKey: string,
  targetKey: string,
  fallback: number,
): void {
  if (scene.textures.exists(targetKey)) return;

  const ctx = createCanvasContext(scene, targetKey, TILE_WIDTH, TILE_HEIGHT);
  const source = getSource(scene, sourceKey);
  const rng = createRng(seedFromString(targetKey));

  ctx.clearRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
  ctx.save();
  tracePolygon(ctx, DIAMOND);
  ctx.clip();

  if (source) drawRegion(ctx, source, TILE_WIDTH, TILE_HEIGHT, rng);
  else paintFlat(ctx, TILE_WIDTH, TILE_HEIGHT, fallback);

  ctx.fillStyle = 'rgba(5, 5, 5, 0.14)';
  ctx.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
  ctx.restore();

  refreshCanvasTexture(scene, targetKey);
}

function buildWall(scene: Scene, sourceKey: string, targetKey: string, fallback: number): void {
  if (scene.textures.exists(targetKey)) return;

  const ctx = createCanvasContext(scene, targetKey, TILE_WIDTH, WALL_IMAGE_HEIGHT);
  const source = getSource(scene, sourceKey);
  const rng = createRng(seedFromString(targetKey));

  ctx.clearRect(0, 0, TILE_WIDTH, WALL_IMAGE_HEIGHT);

  if (source) drawRegion(ctx, source, TILE_WIDTH, WALL_IMAGE_HEIGHT, rng);
  else paintFlat(ctx, TILE_WIDTH, WALL_IMAGE_HEIGHT, fallback);

  const shade = (polygon: Polygon, alpha: number): void => {
    ctx.save();
    tracePolygon(ctx, polygon);
    ctx.clip();
    ctx.fillStyle = `rgba(5, 5, 5, ${alpha})`;
    ctx.fillRect(0, 0, TILE_WIDTH, WALL_IMAGE_HEIGHT);
    ctx.restore();
  };

  shade(DIAMOND, 0.1);
  shade(LEFT_FACE, 0.52);
  shade(RIGHT_FACE, 0.28);

  ctx.globalCompositeOperation = 'destination-in';
  tracePolygon(ctx, SILHOUETTE);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  tracePolygon(ctx, DIAMOND);
  ctx.strokeStyle = 'rgba(201, 196, 180, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  refreshCanvasTexture(scene, targetKey);
}

export function buildIsoTiles(scene: Scene): void {
  buildFloor(scene, 'src_floor_a', TILE_KEYS.floorA, PALETTE.steel);
  buildFloor(scene, 'src_floor_b', TILE_KEYS.floorB, PALETTE.steelLight);
  buildFloor(scene, 'src_grate', TILE_KEYS.grate, PALETTE.nearBlack);
  buildWall(scene, 'src_wall_a', TILE_KEYS.wallA, PALETTE.steelDark);
  buildWall(scene, 'src_wall_b', TILE_KEYS.wallB, PALETTE.shadow);
}
