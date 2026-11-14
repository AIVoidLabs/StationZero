import type { Scene } from 'phaser';
import { tilesKeyForFloor } from '../assets/manifest';
import { FLOOR_COUNT, TILE_HEIGHT, TILE_WIDTH, WALL_HEIGHT } from '../data/config';

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

export type TileFrame = (typeof TILE_FRAMES)[keyof typeof TILE_FRAMES];

interface TileSpec {
  readonly frame: TileFrame;
  readonly floor: boolean;
  readonly x: number;
  readonly y: number;
}

const WALL_COLUMNS = 4;
const WALL_IMAGE_HEIGHT = TILE_HEIGHT + WALL_HEIGHT;

const WALL_FRAMES: readonly TileFrame[] = [
  TILE_FRAMES.wall0,
  TILE_FRAMES.wall1,
  TILE_FRAMES.wall2,
  TILE_FRAMES.wall3,
  TILE_FRAMES.wall4,
  TILE_FRAMES.wall5,
  TILE_FRAMES.wall6,
  TILE_FRAMES.wall7,
];

const TILE_SPECS: readonly TileSpec[] = [
  { frame: TILE_FRAMES.floorA, floor: true, x: 0, y: 0 },
  { frame: TILE_FRAMES.floorB, floor: true, x: TILE_WIDTH, y: 0 },
  { frame: TILE_FRAMES.grate, floor: true, x: TILE_WIDTH * 2, y: 0 },
  ...WALL_FRAMES.map((frame, index) => ({
    frame,
    floor: false,
    x: (index % WALL_COLUMNS) * TILE_WIDTH,
    y: TILE_HEIGHT + Math.floor(index / WALL_COLUMNS) * WALL_IMAGE_HEIGHT,
  })),
];

export function registerTilesV2(scene: Scene): void {
  for (let floor = 0; floor < FLOOR_COUNT; floor += 1) {
    const key = tilesKeyForFloor(floor);
    if (!scene.textures.exists(key)) continue;
    const texture = scene.textures.get(key);
    for (const spec of TILE_SPECS) {
      if (texture.has(spec.frame)) continue;
      const height = spec.floor ? TILE_HEIGHT : WALL_IMAGE_HEIGHT;
      texture.add(spec.frame, 0, spec.x, spec.y, TILE_WIDTH, height);
    }
  }
}
