import type { GameObjects, Scene } from 'phaser';
import { DEAD_FRAME_COUNT, PROPS_FLOOR_KEY } from '../assets/manifest';
import { DEPTH_FLOOR, FLOOR_COUNT, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import { gridVectorToWorld } from '../utils/iso';
import { createRng } from '../utils/random';
import type { Dungeon, DungeonExit } from './DungeonGen';
import type { BarrelCell } from './Barrels';
import type { Level } from './Level';
import type { TerminalCell } from './LogFeed';
import type { OccluderSpec } from './Occlusion';

const DECAL_SEED = 0xdecaf;
const MAX_DECALS = 12;
const DECALS_PER_FLOOR = 2;
const PROP_FRAMES = {
  barrel: 0,
  crate: 1,
  terminal: 2,
  pipe: 3,
} as const;
const PROP_SCALE: Record<keyof typeof PROP_FRAMES, number> = {
  barrel: 0.45,
  crate: 0.5,
  terminal: 0.5,
  pipe: 0.5,
};
const DECAL_FRAMES: readonly number[] = [0, 1];
const FLOOR_PROP_BASE_ORIGIN_Y = 40 / 48;
const CORPSE_DEPTH_OFFSET = 4;

type PropKind = keyof typeof PROP_FRAMES;

interface Cell {
  readonly x: number;
  readonly y: number;
}

export class Decor {
  private readonly scene: Scene;
  private readonly level: Level;
  private readonly images: GameObjects.Image[] = [];
  private readonly propOccluders: OccluderSpec[] = [];
  private readonly terminalCells: TerminalCell[] = [];
  private readonly barrelCells: BarrelCell[] = [];
  private corpse: { x: number; y: number } | null = null;
  private readonly exit: DungeonExit | null;
  private readonly decalTarget: number;
  private readonly floorIndex: number;

  constructor(scene: Scene, level: Level, dungeon: Dungeon) {
    this.scene = scene;
    this.level = level;
    this.exit = dungeon.exit;
    this.floorIndex = dungeon.floor;
    this.decalTarget = Math.min(MAX_DECALS, 5 + dungeon.floor * DECALS_PER_FLOOR);

    const { props, terminals, corpse } = dungeon.entities;
    for (const prop of props) {
      if (prop.kind === 'theme') this.addThemeProp(prop.x, prop.y);
      else this.addProp(prop.x, prop.y, prop.kind);
      this.level.blockCell(prop.x, prop.y);
    }
    for (const terminal of terminals) {
      this.addProp(terminal.x, terminal.y, 'terminal');
      this.level.blockCell(terminal.x, terminal.y);
    }
    if (corpse) {
      this.corpse = { x: corpse.x, y: corpse.y };
      this.addCorpse(corpse.x, corpse.y);
    }
    this.placeDecals(dungeon);
  }

  get occluders(): readonly OccluderSpec[] {
    return this.propOccluders;
  }

  get terminals(): readonly TerminalCell[] {
    return this.terminalCells;
  }

  get corpseCell(): { readonly x: number; readonly y: number } | null {
    return this.corpse;
  }

  get barrels(): readonly BarrelCell[] {
    return this.barrelCells;
  }

  destroy(): void {
    for (const image of this.images) image.destroy();
    this.images.length = 0;
    this.propOccluders.length = 0;
    this.terminalCells.length = 0;
    this.barrelCells.length = 0;
    this.corpse = null;
  }

  private addThemeProp(gridX: number, gridY: number): void {
    const iso = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
    const image = this.scene.add
      .image(iso.x, iso.y, PROPS_FLOOR_KEY, DEAD_FRAME_COUNT + this.floorIndex)
      .setOrigin(0.5, FLOOR_PROP_BASE_ORIGIN_Y)
      .setDepth(iso.y);
    this.images.push(image);
    this.propOccluders.push({ sprite: image, baseY: iso.y });
  }

  private addCorpse(gridX: number, gridY: number): void {
    const iso = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
    const image = this.scene.add
      .image(iso.x, iso.y, PROPS_FLOOR_KEY, this.floorIndex)
      .setOrigin(0.5, FLOOR_PROP_BASE_ORIGIN_Y)
      .setDepth(DEPTH_FLOOR + CORPSE_DEPTH_OFFSET);
    this.images.push(image);
  }

  private addProp(gridX: number, gridY: number, kind: PropKind): void {
    const iso = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
    if (kind === 'barrel') {
      const barrel = this.scene.add
        .image(iso.x, iso.y, PROPS_FLOOR_KEY, DEAD_FRAME_COUNT + FLOOR_COUNT + 1)
        .setOrigin(0.5, FLOOR_PROP_BASE_ORIGIN_Y)
        .setDepth(iso.y);
      this.images.push(barrel);
      this.propOccluders.push({ sprite: barrel, baseY: iso.y });
      this.barrelCells.push({ x: gridX, y: gridY, image: barrel });
      return;
    }
    const image =
      kind === 'terminal'
        ? this.scene.add
            .image(iso.x, iso.y, PROPS_FLOOR_KEY, DEAD_FRAME_COUNT + FLOOR_COUNT)
            .setOrigin(0.5, FLOOR_PROP_BASE_ORIGIN_Y)
            .setDepth(iso.y)
        : this.scene.add
            .image(iso.x, iso.y, 'props', PROP_FRAMES[kind])
            .setOrigin(0.5, 1)
            .setScale(PROP_SCALE[kind])
            .setDepth(iso.y);
    this.images.push(image);
    this.propOccluders.push({ sprite: image, baseY: iso.y });
    if (kind === 'terminal') this.terminalCells.push({ x: gridX, y: gridY });
  }

  private placeDecals(dungeon: Dungeon): void {
    const rng = createRng(dungeon.seed ^ DECAL_SEED);
    const cells: Cell[] = [];

    for (const room of dungeon.rooms) {
      for (let y = room.y; y < room.y + room.height; y += 1) {
        for (let x = room.x; x < room.x + room.width; x += 1) {
          if (!this.level.isWalkable(x, y)) continue;
          if (x === this.level.spawnX && y === this.level.spawnY) continue;
          if (this.exit !== null && x === this.exit.x && y === this.exit.y) continue;
          cells.push({ x, y });
        }
      }
    }

    const count = Math.min(this.decalTarget, cells.length);

    for (let index = 0; index < count && cells.length > 0; index += 1) {
      const cellIndex = Math.floor(rng() * cells.length);
      const cell = cells.splice(cellIndex, 1)[0];
      if (!cell) continue;

      const frame = DECAL_FRAMES[Math.floor(rng() * DECAL_FRAMES.length)] ?? 0;
      const iso = gridVectorToWorld(cell.x, cell.y, TILE_WIDTH, TILE_HEIGHT);
      const image = this.scene.add
        .image(iso.x, iso.y, 'decals', frame)
        .setOrigin(0.5, 0.5)
        .setDepth(DEPTH_FLOOR + 1)
        .setAlpha(0.35 + rng() * 0.2)
        .setFlipX(rng() < 0.5)
        .setFlipY(rng() < 0.5);
      this.images.push(image);
    }
  }
}
