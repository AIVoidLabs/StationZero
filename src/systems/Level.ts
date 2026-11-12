import type { GameObjects, Scene } from 'phaser';
import { selectWorldArt, TILES_V2_KEY } from '../assets/manifest';
import { DEPTH_FLOOR, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import { cartesianToIso } from '../utils/iso';
import type { Dungeon, FloorStyle } from './DungeonGen';
import { ISO_TILES_KEY, TILE_FRAMES, type TileFrame } from './TileShaper';

export type CellKind = 'floor' | 'wall';

export type FloorMaterial = 'steel' | 'concrete' | 'grate';

export interface CameraBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const WALL_RHYTHM: readonly TileFrame[] = [
  TILE_FRAMES.wall0,
  TILE_FRAMES.wall2,
  TILE_FRAMES.wall1,
  TILE_FRAMES.wall0,
  TILE_FRAMES.wall3,
  TILE_FRAMES.wall1,
  TILE_FRAMES.wall0,
  TILE_FRAMES.wall2,
  TILE_FRAMES.wall4,
  TILE_FRAMES.wall0,
  TILE_FRAMES.wall1,
  TILE_FRAMES.wall3,
];

export class Level {
  readonly width: number;
  readonly height: number;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly floor: number;
  readonly walls: GameObjects.Image[] = [];

  private readonly cells: CellKind[][];
  private readonly styles: FloorStyle[][];
  private readonly blockers = new Set<string>();

  constructor(dungeon: Dungeon) {
    const rows = dungeon.rows;
    const first = rows[0] ?? '';
    this.width = first.length;
    this.height = rows.length;
    this.spawnX = dungeon.spawnX;
    this.spawnY = dungeon.spawnY;
    this.floor = dungeon.floor;

    this.cells = rows.map((row) => {
      const cells: CellKind[] = [];
      for (let x = 0; x < this.width; x += 1) {
        const char = row[x] ?? '#';
        cells.push(char === '#' ? 'wall' : 'floor');
      }
      return cells;
    });

    this.styles = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => 0 as FloorStyle),
    );

    for (const room of dungeon.rooms) {
      for (let y = room.y; y < room.y + room.height; y += 1) {
        const row = this.styles[y];
        if (!row) continue;
        for (let x = room.x; x < room.x + room.width; x += 1) {
          row[x] = room.style;
        }
      }
    }
  }

  cellAt(gridX: number, gridY: number): CellKind {
    if (gridX < 0 || gridY < 0 || gridX >= this.width || gridY >= this.height) return 'wall';
    return this.cells[gridY]?.[gridX] ?? 'wall';
  }

  isWalkable(gridX: number, gridY: number): boolean {
    return this.cellAt(gridX, gridY) === 'floor' && !this.blockers.has(`${gridX},${gridY}`);
  }

  blockCell(gridX: number, gridY: number): void {
    this.blockers.add(`${gridX},${gridY}`);
  }

  unblockCell(gridX: number, gridY: number): void {
    this.blockers.delete(`${gridX},${gridY}`);
  }

  get cameraBounds(): CameraBounds {
    const pad = TILE_WIDTH * 3;
    const minX = -(this.height - 1) * (TILE_WIDTH / 2) - pad;
    const maxX = (this.width - 1) * (TILE_WIDTH / 2) + pad;
    const minY = -TILE_HEIGHT * 6;
    const maxY = (this.width + this.height - 2) * (TILE_HEIGHT / 2) + TILE_HEIGHT * 2;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  render(scene: Scene): void {
    const art = selectWorldArt();
    const floorAtlas = art.floor ? TILES_V2_KEY : ISO_TILES_KEY;
    const wallAtlas = art.wall ? TILES_V2_KEY : ISO_TILES_KEY;
    for (let gridY = 0; gridY < this.height; gridY += 1) {
      for (let gridX = 0; gridX < this.width; gridX += 1) {
        const iso = cartesianToIso(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);

        if (this.cellAt(gridX, gridY) === 'wall') {
          if (!this.touchesFloor(gridX, gridY)) continue;
          const frame = this.wallFrame(gridX, gridY);
          const wall = scene.add
            .image(iso.isoX, iso.isoY + TILE_HEIGHT / 2, wallAtlas, frame)
            .setOrigin(0.5, 1)
            .setDepth(iso.isoY);
          this.walls.push(wall);
          continue;
        }

        scene.add
          .image(iso.isoX, iso.isoY, floorAtlas, this.floorKey(gridX, gridY))
          .setDepth(DEPTH_FLOOR);
      }
    }
  }

  private wallFrame(gridX: number, gridY: number): TileFrame {
    const north = this.isWalkable(gridX, gridY - 1);
    const south = this.isWalkable(gridX, gridY + 1);
    const west = this.isWalkable(gridX - 1, gridY);
    const east = this.isWalkable(gridX + 1, gridY);
    const vertical = north || south;
    const horizontal = west || east;

    if (vertical && horizontal) return TILE_FRAMES.wall5;

    const alongX = vertical;
    const index = alongX ? gridX : gridY;
    const before = alongX ? this.isWalkable(gridX - 1, gridY - 1) || this.isWalkable(gridX - 1, gridY + 1) : this.isWalkable(gridX - 1, gridY - 1) || this.isWalkable(gridX + 1, gridY - 1);
    const after = alongX ? this.isWalkable(gridX + 1, gridY - 1) || this.isWalkable(gridX + 1, gridY + 1) : this.isWalkable(gridX - 1, gridY + 1) || this.isWalkable(gridX + 1, gridY + 1);
    if (before !== after) return TILE_FRAMES.wall7;

    const slot = ((index % WALL_RHYTHM.length) + WALL_RHYTHM.length) % WALL_RHYTHM.length;
    return WALL_RHYTHM[slot] ?? TILE_FRAMES.wall0;
  }

  materialAt(gridX: number, gridY: number): FloorMaterial {
    const frame = this.floorKey(gridX, gridY);
    if (frame === TILE_FRAMES.grate) return 'grate';
    if (frame === TILE_FRAMES.floorB) return 'concrete';
    return 'steel';
  }

  private floorKey(gridX: number, gridY: number): TileFrame {
    const style = this.styles[gridY]?.[gridX] ?? 0;
    const variant = this.hash(gridX, gridY) % 100;
    const wear = this.floor * 4;

    if (style === 1) {
      if (variant < 3 + wear) return TILE_FRAMES.grate;
      if (variant < 74) return TILE_FRAMES.floorB;
      return TILE_FRAMES.floorA;
    }

    if (style === 2) {
      if (variant < 24 + wear) return TILE_FRAMES.grate;
      if (variant < 62) return TILE_FRAMES.floorB;
      return TILE_FRAMES.floorA;
    }

    if (variant < 3 + wear) return TILE_FRAMES.grate;
    if (variant < 28 + wear) return TILE_FRAMES.floorB;
    return TILE_FRAMES.floorA;
  }

  private touchesFloor(gridX: number, gridY: number): boolean {
    return (
      this.isWalkable(gridX + 1, gridY) ||
      this.isWalkable(gridX - 1, gridY) ||
      this.isWalkable(gridX, gridY + 1) ||
      this.isWalkable(gridX, gridY - 1)
    );
  }

  private hash(gridX: number, gridY: number): number {
    let value = (Math.imul(gridX, 374761393) + Math.imul(gridY, 668265263)) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
    return value;
  }
}
