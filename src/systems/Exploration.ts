import type { Dungeon, Room } from './DungeonGen';
import type { Level } from './Level';
import { hasLineOfSight, type GridCell } from './Los';
import type { WalkableGrid } from './Pathfinding';

const VISION_RADIUS = 5;

export class Exploration {
  readonly width: number;
  readonly height: number;

  private readonly level: Level;
  private readonly rooms: readonly Room[];
  private readonly exit: { readonly x: number; readonly y: number } | null;
  private readonly seen: Uint8Array;
  private readonly visible: Uint8Array;
  private readonly revealedAt: Float64Array;
  private readonly floorGrid: WalkableGrid;

  private lastCell = '';
  private seenTotal = 0;
  private readonly floorTotal: number;
  private revisionCounter = 0;

  constructor(level: Level, dungeon: Dungeon) {
    this.level = level;
    this.width = level.width;
    this.height = level.height;
    this.rooms = dungeon.rooms;
    this.exit = dungeon.exit;
    this.seen = new Uint8Array(this.width * this.height);
    this.visible = new Uint8Array(this.width * this.height);
    this.revealedAt = new Float64Array(this.width * this.height);
    let floors = 0;
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (level.cellAt(x, y) === 'floor') floors += 1;
      }
    }
    this.floorTotal = Math.max(1, floors);
    this.floorGrid = {
      width: level.width,
      height: level.height,
      isWalkable: (gridX: number, gridY: number): boolean => level.cellAt(gridX, gridY) === 'floor',
    };
  }

  get percent(): number {
    return Math.min(100, Math.floor((this.seenTotal / this.floorTotal) * 100));
  }

  get seenCount(): number {
    return this.seenTotal;
  }

  get revision(): number {
    return this.revisionCounter;
  }

  isFloor(gridX: number, gridY: number): boolean {
    return this.level.cellAt(gridX, gridY) === 'floor';
  }

  isVisible(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridY < 0 || gridX >= this.width || gridY >= this.height) return false;
    return this.visible[gridY * this.width + gridX] === 1;
  }

  isSeen(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridY < 0 || gridX >= this.width || gridY >= this.height) return false;
    return this.seen[gridY * this.width + gridX] === 1;
  }

  seenAt(gridX: number, gridY: number): number {
    return this.revealedAt[gridY * this.width + gridX] ?? 0;
  }

  update(gridX: number, gridY: number, now: number): void {
    const key = `${gridX},${gridY}`;
    if (key === this.lastCell) return;
    this.lastCell = key;

    for (const room of this.rooms) {
      if (
        gridX >= room.x &&
        gridX < room.x + room.width &&
        gridY >= room.y &&
        gridY < room.y + room.height
      ) {
        this.revealRoom(room, now);
      }
    }

    this.visible.fill(0);
    this.revisionCounter += 1;

    const from: GridCell = { gridX, gridY };
    for (let dy = -VISION_RADIUS; dy <= VISION_RADIUS; dy += 1) {
      for (let dx = -VISION_RADIUS; dx <= VISION_RADIUS; dx += 1) {
        if (dx * dx + dy * dy > VISION_RADIUS * VISION_RADIUS) continue;
        const cx = gridX + dx;
        const cy = gridY + dy;
        if (this.level.cellAt(cx, cy) !== 'floor') continue;
        if (!hasLineOfSight(this.floorGrid, from, { gridX: cx, gridY: cy })) continue;
        this.visible[cy * this.width + cx] = 1;
        this.mark(cx, cy, now);
      }
    }
  }

  private revealRoom(room: Room, now: number): void {
    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        if (this.level.cellAt(x, y) === 'floor') this.mark(x, y, now);
      }
    }
    if (this.exit && this.isNearSeen(this.exit.x, this.exit.y)) this.mark(this.exit.x, this.exit.y, now);
  }

  private isNearSeen(gridX: number, gridY: number): boolean {
    return (
      this.isSeen(gridX + 1, gridY) ||
      this.isSeen(gridX - 1, gridY) ||
      this.isSeen(gridX, gridY + 1) ||
      this.isSeen(gridX, gridY - 1)
    );
  }

  private mark(gridX: number, gridY: number, now: number): void {
    const index = gridY * this.width + gridX;
    if (this.seen[index] === 1) return;
    this.seen[index] = 1;
    this.seenTotal += 1;
    this.revealedAt[index] = now;
    this.revisionCounter += 1;
  }
}
