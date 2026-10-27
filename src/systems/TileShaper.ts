import type { Scene } from 'phaser';
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
  wallA: 'wall_a',
  wallB: 'wall_b',
} as const;

export type TileFrame = (typeof TILE_FRAMES)[keyof typeof TILE_FRAMES];

type TileKind = 'floor' | 'wall';

interface TileSpec {
  readonly frame: TileFrame;
  readonly source: string;
  readonly fallback: number;
  readonly kind: TileKind;
  readonly x: number;
  readonly y: number;
}

const WALL_IMAGE_HEIGHT = TILE_HEIGHT + WALL_HEIGHT;
const ATLAS_WIDTH = TILE_WIDTH * 3;
const ATLAS_HEIGHT = TILE_HEIGHT + WALL_IMAGE_HEIGHT;

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
  {
    frame: TILE_FRAMES.wallA,
    source: 'src_wall_a',
    fallback: PALETTE.steelDark,
    kind: 'wall',
    x: 0,
    y: TILE_HEIGHT,
  },
  {
    frame: TILE_FRAMES.wallB,
    source: 'src_wall_b',
    fallback: PALETTE.shadow,
    kind: 'wall',
    x: TILE_WIDTH,
    y: TILE_HEIGHT,
  },
];

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

  ctx.fillStyle = 'rgba(5, 5, 5, 0.14)';
  ctx.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
  ctx.restore();
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

  if (source) drawRegion(ctx, source, TILE_WIDTH, WALL_IMAGE_HEIGHT, rng);
  else paintFlat(ctx, TILE_WIDTH, WALL_IMAGE_HEIGHT, spec.fallback);

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
  tracePolygon(ctx, DIAMOND);
  ctx.strokeStyle = 'rgba(201, 196, 180, 0.18)';
  ctx.lineWidth = 1;
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
