import type { GameObjects, Scene } from 'phaser';
import { DEPTH_FLOOR, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import { cartesianToIso } from '../utils/iso';
import type { Dungeon, FloorStyle } from './DungeonGen';
import { TILE_KEYS } from './TileShaper';

export type CellKind = 'floor' | 'wall';

export interface CameraBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class Level {
  readonly width: number;
  readonly height: number;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly walls: GameObjects.Image[] = [];

  private readonly cells: CellKind[][];
  private readonly styles: FloorStyle[][];

  constructor(dungeon: Dungeon) {
    const rows = dungeon.rows;
    const first = rows[0] ?? '';
    this.width = first.length;
    this.height = rows.length;
    this.spawnX = dungeon.spawnX;
    this.spawnY = dungeon.spawnY;

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
    return this.cellAt(gridX, gridY) === 'floor';
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
    for (let gridY = 0; gridY < this.height; gridY += 1) {
      for (let gridX = 0; gridX < this.width; gridX += 1) {
        const iso = cartesianToIso(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);

        if (this.cellAt(gridX, gridY) === 'wall') {
          if (!this.touchesFloor(gridX, gridY)) continue;
          const key = this.hash(gridX, gridY) % 6 === 0 ? TILE_KEYS.wallB : TILE_KEYS.wallA;
          const wall = scene.add
            .image(iso.isoX, iso.isoY + TILE_HEIGHT / 2, key)
            .setOrigin(0.5, 1)
            .setDepth(iso.isoY);
          this.walls.push(wall);
          continue;
        }

        scene.add
          .image(iso.isoX, iso.isoY, this.floorKey(gridX, gridY))
          .setDepth(DEPTH_FLOOR);
      }
    }
  }

  private floorKey(gridX: number, gridY: number): string {
    const style = this.styles[gridY]?.[gridX] ?? 0;
    const variant = this.hash(gridX, gridY) % 100;

    if (style === 1) {
      if (variant < 8) return TILE_KEYS.grate;
      if (variant < 74) return TILE_KEYS.floorB;
      return TILE_KEYS.floorA;
    }

    if (style === 2) {
      if (variant < 42) return TILE_KEYS.grate;
      if (variant < 62) return TILE_KEYS.floorB;
      return TILE_KEYS.floorA;
    }

    if (variant < 6) return TILE_KEYS.grate;
    if (variant < 28) return TILE_KEYS.floorB;
    return TILE_KEYS.floorA;
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
