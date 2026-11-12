import type { Scene } from 'phaser';
import { TILES_V2_KEY } from '../assets/manifest';
import { PALETTE, TILE_HEIGHT, TILE_WIDTH, WALL_HEIGHT } from '../data/config';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import { createRng, seedFromString } from '../utils/random';

type Point = readonly [number, number];
type Polygon = readonly Point[];

export const ISO_TILES_KEY = 'iso_tiles';

export const TILE_FRAMES = {
  floorA: 'floor_a',
  floorB: 'floor_b',
  grate: 'grate',
  wall0: 'wall_0',
  wall1: 'wall_1',
  wall2: 'wall_2',
  wall3: 'wall_3',
  wall4: 'wall_4',
  wall5: 'wall_5',
  wall6: 'wall_6',
  wall7: 'wall_7',
} as const;

export const PLAIN_WALL_FRAMES: readonly TileFrame[] = [
  TILE_FRAMES.wall0,
  TILE_FRAMES.wall1,
  TILE_FRAMES.wall2,
  TILE_FRAMES.wall3,
];

export const DETAIL_WALL_FRAMES: readonly TileFrame[] = [
  TILE_FRAMES.wall4,
  TILE_FRAMES.wall5,
  TILE_FRAMES.wall6,
  TILE_FRAMES.wall7,
];

export type TileFrame = (typeof TILE_FRAMES)[keyof typeof TILE_FRAMES];

type TileKind = 'floor' | 'wall';

interface TileSpec {
  readonly frame: TileFrame;
  readonly source: string;
  readonly fallback: number;
  readonly kind: TileKind;
  readonly x: number;
  readonly y: number;
  readonly cropX?: number;
  readonly cropY?: number;
}

const WALL_COLUMNS = 4;
const WALL_IMAGE_HEIGHT = TILE_HEIGHT + WALL_HEIGHT;
const ATLAS_WIDTH = TILE_WIDTH * WALL_COLUMNS;
const ATLAS_HEIGHT = TILE_HEIGHT + WALL_IMAGE_HEIGHT * 2;

function wallSpecs(
  entries: readonly (readonly [TileFrame, string, number, number])[],
): TileSpec[] {
  return entries.map(([frame, source, cropX, cropY], index) => ({
    frame,
    source,
    fallback: PALETTE.steelDark,
    kind: 'wall',
    x: (index % WALL_COLUMNS) * TILE_WIDTH,
    y: TILE_HEIGHT + Math.floor(index / WALL_COLUMNS) * WALL_IMAGE_HEIGHT,
    cropX,
    cropY,
  }));
}

const TILE_SPECS: readonly TileSpec[] = [
  {
    frame: TILE_FRAMES.floorA,
    source: 'src_floor_a',
    fallback: PALETTE.steel,
    kind: 'floor',
    x: 0,
    y: 0,
  },
  {
    frame: TILE_FRAMES.floorB,
    source: 'src_floor_b',
    fallback: PALETTE.steelLight,
    kind: 'floor',
    x: TILE_WIDTH,
    y: 0,
  },
  {
    frame: TILE_FRAMES.grate,
    source: 'src_grate',
    fallback: PALETTE.nearBlack,
    kind: 'floor',
    x: TILE_WIDTH * 2,
    y: 0,
  },
  ...wallSpecs([
    [TILE_FRAMES.wall0, 'src_wall_b', 64, 90],
    [TILE_FRAMES.wall1, 'src_wall_a', 128, 0],
    [TILE_FRAMES.wall2, 'src_wall_b', 190, 100],
    [TILE_FRAMES.wall3, 'src_wall_a', 100, 170],
    [TILE_FRAMES.wall4, 'src_wall_b', 0, 0],
    [TILE_FRAMES.wall5, 'src_wall_b', 128, 0],
    [TILE_FRAMES.wall6, 'src_wall_b', 0, 170],
    [TILE_FRAMES.wall7, 'src_wall_a', 64, 90],
  ]),
];

export function registerTilesV2(scene: Scene): void {
  if (!scene.textures.exists(TILES_V2_KEY)) return;
  const texture = scene.textures.get(TILES_V2_KEY);
  for (const spec of TILE_SPECS) {
    if (texture.has(spec.frame)) continue;
    const height = spec.kind === 'floor' ? TILE_HEIGHT : WALL_IMAGE_HEIGHT;
    texture.add(spec.frame, 0, spec.x, spec.y, TILE_WIDTH, height);
  }
}

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
  crop?: { readonly x: number; readonly y: number },
): void {
  const sampleWidth = Math.min(width, source.width);
  const sampleHeight = Math.min(height, source.height);
  const maxX = Math.max(0, source.width - sampleWidth);
  const maxY = Math.max(0, source.height - sampleHeight);
  const sx = crop ? Math.min(maxX, crop.x) : Math.floor(rng() * (maxX + 1));
  const sy = crop ? Math.min(maxY, crop.y) : Math.floor(rng() * (maxY + 1));
  ctx.drawImage(source, sx, sy, sampleWidth, sampleHeight, 0, 0, width, height);
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  spec: TileSpec,
): void {
  const source = getSource(scene, spec.source);
  const rng = createRng(seedFromString(spec.frame));

  ctx.save();
  ctx.translate(spec.x, spec.y);
  ctx.clearRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
  ctx.beginPath();
  tracePolygon(ctx, DIAMOND);
  ctx.clip();

  if (source) drawRegion(ctx, source, TILE_WIDTH, TILE_HEIGHT, rng);
  else paintFlat(ctx, TILE_WIDTH, TILE_HEIGHT, spec.fallback);

  calm(ctx, TILE_WIDTH, TILE_HEIGHT, 0.6, 'rgba(18, 21, 21, 0.4)');
  ctx.restore();
}

function calm(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  desaturate: number,
  flatten: string,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = `rgba(128, 128, 128, ${desaturate})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  ctx.fillStyle = flatten;
  ctx.fillRect(0, 0, width, height);
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  spec: TileSpec,
): void {
  const source = getSource(scene, spec.source);
  const rng = createRng(seedFromString(spec.frame));

  ctx.save();
  ctx.translate(spec.x, spec.y);
  ctx.clearRect(0, 0, TILE_WIDTH, WALL_IMAGE_HEIGHT);

  if (source) {
    const crop = spec.cropX !== undefined && spec.cropY !== undefined ? { x: spec.cropX, y: spec.cropY } : undefined;
    drawRegion(ctx, source, TILE_WIDTH, WALL_IMAGE_HEIGHT, rng, crop);
  }
  else paintFlat(ctx, TILE_WIDTH, WALL_IMAGE_HEIGHT, spec.fallback);

  const shade = (polygon: Polygon, alpha: number): void => {
    ctx.save();
    tracePolygon(ctx, polygon);
    ctx.clip();
    ctx.fillStyle = `rgba(5, 5, 5, ${alpha})`;
    ctx.fillRect(0, 0, TILE_WIDTH, WALL_IMAGE_HEIGHT);
    ctx.restore();
  };

  ctx.save();
  tracePolygon(ctx, SILHOUETTE);
  ctx.clip();
  calm(ctx, TILE_WIDTH, WALL_IMAGE_HEIGHT, 0.35, 'rgba(10, 14, 14, 0.08)');
  ctx.restore();

  shade(DIAMOND, 0);
  shade(LEFT_FACE, 0.5);
  shade(RIGHT_FACE, 0.3);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, TILE_WIDTH, WALL_IMAGE_HEIGHT);
  ctx.clip();
  ctx.globalCompositeOperation = 'destination-in';
  tracePolygon(ctx, SILHOUETTE);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, TILE_HEIGHT / 2 + 0.5);
  ctx.lineTo(TILE_WIDTH / 2, 0.5);
  ctx.lineTo(TILE_WIDTH, TILE_HEIGHT / 2 + 0.5);
  ctx.strokeStyle = 'rgba(201, 196, 180, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, TILE_HEIGHT / 2 + WALL_HEIGHT - 0.5);
  ctx.lineTo(TILE_WIDTH / 2, TILE_HEIGHT + WALL_HEIGHT - 0.5);
  ctx.lineTo(TILE_WIDTH, TILE_HEIGHT / 2 + WALL_HEIGHT - 0.5);
  ctx.strokeStyle = 'rgba(5, 5, 5, 0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

export function buildIsoTiles(scene: Scene): void {
  if (scene.textures.exists(ISO_TILES_KEY)) return;

  const ctx = createCanvasContext(scene, ISO_TILES_KEY, ATLAS_WIDTH, ATLAS_HEIGHT);

  for (const spec of TILE_SPECS) {
    if (spec.kind === 'floor') drawFloor(ctx, scene, spec);
    else drawWall(ctx, scene, spec);
  }

  const texture = scene.textures.get(ISO_TILES_KEY);
  for (const spec of TILE_SPECS) {
    const height = spec.kind === 'floor' ? TILE_HEIGHT : WALL_IMAGE_HEIGHT;
    texture.add(spec.frame, 0, spec.x, spec.y, TILE_WIDTH, height);
  }

  refreshCanvasTexture(scene, ISO_TILES_KEY);
}
