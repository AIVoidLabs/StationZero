import type { GameObjects, Scene } from 'phaser';
import { DEAD_FRAME_COUNT, PROPS_FLOOR_KEY } from '../assets/manifest';
import { DEPTH_FLOOR, FLOOR_COUNT, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import { gridVectorToWorld } from '../utils/iso';
import { createRng } from '../utils/random';
import type { Dungeon, DungeonExit, Room } from './DungeonGen';
import type { Level } from './Level';
import type { TerminalCell } from './LogFeed';
import type { OccluderSpec } from './Occlusion';

const DECOR_SEED = 0x5a17e;
const DECAL_SEED = 0xdecaf;
const TERMINAL_SEED = 0x7e34a;
const MAX_PROPS = 10;
const MIN_TERMINALS = 3;
const MAX_DECALS = 12;
const PROPS_PER_FLOOR = 2;
const DECALS_PER_FLOOR = 2;
const PROP_FRAMES = {
  barrel: 0,
  crate: 1,
  terminal: 2,
  pipe: 3,
} as const;
const RANDOM_PROP_KINDS: readonly PropKind[] = ['barrel', 'crate', 'pipe'];
const PROP_SCALE: Record<keyof typeof PROP_FRAMES, number> = {
  barrel: 0.45,
  crate: 0.5,
  terminal: 0.5,
  pipe: 0.5,
};
const DECAL_FRAMES: readonly number[] = [0, 1];
const THEME_PROP_CHANCE = 0.6;
const FLOOR_PROP_BASE_ORIGIN_Y = 40 / 48;
const CORPSE_DEPTH_OFFSET = 4;
const CORPSE_NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];

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
  private readonly exit: DungeonExit | null;
  private readonly terminalTarget: number;
  private readonly propBudget: number;
  private readonly decalTarget: number;
  private readonly floorIndex: number;
  private propCount = 0;

  constructor(scene: Scene, level: Level, dungeon: Dungeon) {
    this.scene = scene;
    this.level = level;
    this.exit = dungeon.exit;
    this.floorIndex = dungeon.floor;
    this.terminalTarget = Math.max(1, MIN_TERMINALS - dungeon.floor);

    const propTarget = Math.min(
      MAX_PROPS,
      MIN_TERMINALS + 5 + dungeon.floor * PROPS_PER_FLOOR,
    );
    this.propBudget = Math.max(1, propTarget - this.terminalTarget);
    this.decalTarget = Math.min(MAX_DECALS, 5 + dungeon.floor * DECALS_PER_FLOOR);

    this.placeProps(dungeon);
    this.placeTerminals(dungeon);
    this.placeCorpse();
    this.placeDecals(dungeon);
  }

  get occluders(): readonly OccluderSpec[] {
    return this.propOccluders;
  }

  get terminals(): readonly TerminalCell[] {
    return this.terminalCells;
  }

  destroy(): void {
    for (const image of this.images) image.destroy();
    this.images.length = 0;
    this.propOccluders.length = 0;
    this.terminalCells.length = 0;
  }

  private placeProps(dungeon: Dungeon): void {
    const rng = createRng(dungeon.seed ^ DECOR_SEED);
    const budget = this.propBudget;

    for (const room of dungeon.rooms) {
      if (this.propCount >= budget) break;

      const candidates = this.propCandidates(room);
      if (candidates.length === 0) continue;

      const wanted = room.width >= 5 && room.height >= 5 && rng() < 0.45 ? 2 : 1;
      const count = Math.min(wanted, candidates.length, budget - this.propCount);

      for (let index = 0; index < count; index += 1) {
        const candidateIndex = Math.floor(rng() * candidates.length);
        const cell = candidates.splice(candidateIndex, 1)[0];
        if (!cell) continue;

        if (rng() < THEME_PROP_CHANCE) {
          this.addThemeProp(cell.x, cell.y);
        } else {
          const kind = RANDOM_PROP_KINDS[Math.floor(rng() * RANDOM_PROP_KINDS.length)] ?? 'barrel';
          this.addProp(cell.x, cell.y, kind);
        }
        this.level.blockCell(cell.x, cell.y);
        this.propCount += 1;
      }
    }
  }

  private placeTerminals(dungeon: Dungeon): void {
    const rng = createRng(dungeon.seed ^ TERMINAL_SEED);
    let placed = 0;

    for (const room of dungeon.rooms) {
      if (placed >= this.terminalTarget) break;

      const candidates = this.propCandidates(room);
      if (candidates.length === 0) continue;

      const cell = candidates[Math.floor(rng() * candidates.length)];
      if (!cell) continue;

      this.addProp(cell.x, cell.y, 'terminal');
      this.level.blockCell(cell.x, cell.y);
      this.propCount += 1;
      placed += 1;
    }
  }

  private propCandidates(room: Room): Cell[] {
    const result: Cell[] = [];

    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        if (!this.level.isWalkable(x, y)) continue;
        if (x === this.level.spawnX && y === this.level.spawnY) continue;
        if (this.exit !== null && x === this.exit.x && y === this.exit.y) continue;

        const onPerimeter =
          x === room.x ||
          x === room.x + room.width - 1 ||
          y === room.y ||
          y === room.y + room.height - 1;
        if (!onPerimeter) continue;
        if (this.hasOutsideFloorNeighbor(room, x, y)) continue;

        result.push({ x, y });
      }
    }

    return result;
  }

  private hasOutsideFloorNeighbor(room: Room, x: number, y: number): boolean {
    const neighbors: readonly (readonly [number, number])[] = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];

    for (const [neighborX, neighborY] of neighbors) {
      const inside =
        neighborX >= room.x &&
        neighborX < room.x + room.width &&
        neighborY >= room.y &&
        neighborY < room.y + room.height;
      if (!inside && this.level.isWalkable(neighborX, neighborY)) return true;
    }

    return false;
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

  private placeCorpse(): void {
    if (this.floorIndex >= DEAD_FRAME_COUNT) return;
    const terminal = this.terminalCells[0];
    if (!terminal) return;

    for (const [dx, dy] of CORPSE_NEIGHBORS) {
      const x = terminal.x + dx;
      const y = terminal.y + dy;
      if (!this.level.isWalkable(x, y)) continue;
      if (x === this.level.spawnX && y === this.level.spawnY) continue;
      if (this.exit !== null && x === this.exit.x && y === this.exit.y) continue;

      const iso = gridVectorToWorld(x, y, TILE_WIDTH, TILE_HEIGHT);
      const image = this.scene.add
        .image(iso.x, iso.y, PROPS_FLOOR_KEY, this.floorIndex)
        .setOrigin(0.5, FLOOR_PROP_BASE_ORIGIN_Y)
        .setDepth(DEPTH_FLOOR + CORPSE_DEPTH_OFFSET);
      this.images.push(image);
      return;
    }
  }

  private addProp(gridX: number, gridY: number, kind: PropKind): void {
    const iso = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
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
