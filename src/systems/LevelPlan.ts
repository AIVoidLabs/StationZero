import { FLOOR_LOOT_BASE, FLOOR_LOOT_MIN, HEALTH_PER_HOSTILE, LOOT_AMMO_AMOUNT } from '../data/config';
import { DRONE_MIN_SPAWN_DISTANCE } from '../data/config';
import { bossForFloor, droneCountForFloor, hostileCountForFloor, tankCountForFloor, type EnemyKind } from '../data/enemies';
import {
  HAZARD_LOOT_CLEARANCE,
  HAZARD_MIN_SEPARATION,
  HAZARD_SPAWN_CLEARANCE,
  STEAM_CYCLE_MS,
  steamCount,
} from '../data/hazards';
import type {
  EnemySpawn,
  GridPoint,
  LevelEntities,
  LootSpawn,
  PlacedProp,
  PropKind,
  VentSpawn,
} from '../data/levelTypes';
import { createRng } from '../utils/random';
import type { Dungeon, Room } from './DungeonGen';
import { Level } from './Level';

const DECOR_SEED = 0x5a17e;
const COVER_SEED = 0xc07e5;
const TERMINAL_SEED = 0x7e34a;
const FLOOR_LOOT_SEED = 0x2b3c;
const COMBAT_SEED = 0x0d20e;
const HAZARD_SEED = 0x7a5e;

const BARRELS_PER_COVER_ROOM = 2;
const EXTRA_BARREL_CHANCE = 0.5;
const SMALL_ROOM_BARREL_CHANCE = 0.6;
const SMALL_ROOM_MIN_SIZE = 4;
const COVER_MIN_ROOM_WIDTH = 6;
const COVER_MIN_ROOM_HEIGHT = 5;
const COVER_BIG_ROOM_AREA = 40;
const COVER_PAIR_CHANCE = 0.55;
const COVER_START_CLEARANCE = 3;
const COVER_SPACING = 2;
const MAX_PROPS = 10;
const MIN_TERMINALS = 3;
const PROPS_PER_FLOOR = 2;
const THEME_PROP_CHANCE = 0.6;
const RANDOM_PROP_KINDS: readonly PropKind[] = ['barrel', 'barrel', 'crate', 'pipe'];
const CORPSE_FLOORS = 10;
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
const ORTHOGONAL = CORPSE_NEIGHBORS.slice(0, 4);

const LOOT_SPAWN_CLEARANCE = 5;
const ENEMY_SPACING = 2.5;
const EXIT_CLEARANCE = 2.5;
const STEAM_CORRIDOR_SHARE = 0.6;
const SPAWN_CLEARANCE_SQ = HAZARD_SPAWN_CLEARANCE * HAZARD_SPAWN_CLEARANCE;

interface Cell extends GridPoint {}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const held = items[index];
    const other = items[swap];
    if (held === undefined || other === undefined) continue;
    items[index] = other;
    items[swap] = held;
  }
  return items;
}

function roomCenter(room: Room): Cell {
  return { x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) };
}

function inRoom(room: Room, cell: Cell): boolean {
  return cell.x >= room.x && cell.x < room.x + room.width && cell.y >= room.y && cell.y < room.y + room.height;
}

class Planner {
  private readonly level: Level;
  private readonly dungeon: Dungeon;
  private readonly props: PlacedProp[] = [];
  private readonly terminals: Cell[] = [];
  private readonly loot: LootSpawn[] = [];
  private propCount = 0;

  constructor(dungeon: Dungeon) {
    this.dungeon = dungeon;
    this.level = new Level(dungeon);
  }

  plan(): LevelEntities {
    const dungeon = this.dungeon;
    const terminalTarget = Math.max(1, MIN_TERMINALS - dungeon.floor);
    const propTarget = Math.min(MAX_PROPS, MIN_TERMINALS + 5 + dungeon.floor * PROPS_PER_FLOOR);
    const propBudget = Math.max(1, propTarget - terminalTarget);

    this.placeProps(propBudget);
    this.placeTerminals(terminalTarget);
    this.placeCover();
    this.placeFloorLoot();
    const enemies = this.placeEnemies();
    const hazards = this.placeHazards();
    const corpse = this.placeCorpse(enemies, hazards);

    return {
      props: this.props,
      terminals: this.terminals,
      corpse,
      loot: this.loot,
      enemies,
      hazards,
    };
  }

  private isExit(x: number, y: number): boolean {
    const exit = this.dungeon.exit;
    return exit !== null && exit.x === x && exit.y === y;
  }

  private placeProps(budget: number): void {
    const rng = createRng(this.dungeon.seed ^ DECOR_SEED);

    for (const room of this.dungeon.rooms) {
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
          this.props.push({ x: cell.x, y: cell.y, kind: 'theme' });
        } else {
          const kind = RANDOM_PROP_KINDS[Math.floor(rng() * RANDOM_PROP_KINDS.length)] ?? 'barrel';
          this.props.push({ x: cell.x, y: cell.y, kind });
        }
        this.level.blockCell(cell.x, cell.y);
        this.propCount += 1;
      }
    }
  }

  private placeTerminals(target: number): void {
    const rng = createRng(this.dungeon.seed ^ TERMINAL_SEED);
    let placed = 0;

    for (const room of this.dungeon.rooms) {
      if (placed >= target) break;

      const candidates = this.propCandidates(room);
      if (candidates.length === 0) continue;

      const cell = candidates[Math.floor(rng() * candidates.length)];
      if (!cell) continue;

      this.terminals.push({ x: cell.x, y: cell.y });
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
        if (this.isExit(x, y)) continue;

        const onPerimeter =
          x === room.x || x === room.x + room.width - 1 || y === room.y || y === room.y + room.height - 1;
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
      if (!inRoom(room, { x: neighborX, y: neighborY }) && this.level.isWalkable(neighborX, neighborY)) return true;
    }

    return false;
  }

  private placeCorpse(enemies: readonly EnemySpawn[], hazards: { vents: VentSpawn[] }): Cell | null {
    if (this.dungeon.floor >= CORPSE_FLOORS) return null;
    const terminal = this.terminals[0];
    if (!terminal) return null;

    const taken = new Set<string>();
    for (const cell of [...this.props, ...this.terminals, ...this.loot, ...enemies, ...hazards.vents]) {
      taken.add(`${cell.x},${cell.y}`);
    }
    taken.add(`${Math.round(this.level.spawnX)},${Math.round(this.level.spawnY)}`);

    const open = (x: number, y: number): boolean => this.level.cellAt(x, y) === 'floor';
    const exposed = (x: number, y: number): boolean => {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) if (!open(x + dx, y + dy)) return false;
      }
      return true;
    };
    const free = (x: number, y: number): boolean => !taken.has(`${x},${y}`) && !this.isExit(x, y);

    const terminalRoom = this.dungeon.rooms.find((room) => inRoom(room, terminal));
    const rooms = [...(terminalRoom ? [terminalRoom] : []), ...this.dungeon.rooms.filter((room) => room !== terminalRoom)];
    for (const room of rooms) {
      let best: Cell | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let y = room.y + 1; y < room.y + room.height - 1; y += 1) {
        for (let x = room.x + 1; x < room.x + room.width - 1; x += 1) {
          if (!free(x, y) || !exposed(x, y)) continue;
          const distance = Math.hypot(x - terminal.x, y - terminal.y);
          if (distance >= bestDistance) continue;
          bestDistance = distance;
          best = { x, y };
        }
      }
      if (best) return best;
    }

    for (const [dx, dy] of CORPSE_NEIGHBORS) {
      const x = terminal.x + dx;
      const y = terminal.y + dy;
      if (this.level.isWalkable(x, y) && free(x, y)) return { x, y };
    }
    return null;
  }

  private placeCover(): void {
    const rng = createRng(this.dungeon.seed ^ COVER_SEED);
    const placed: Cell[] = [];
    let walkable = this.countWalkable();

    const tryBlock = (cell: Cell, kind: PropKind = 'crate'): boolean => {
      this.level.blockCell(cell.x, cell.y);
      if (this.countReachable() === walkable - 1) {
        walkable -= 1;
        this.props.push({ x: cell.x, y: cell.y, kind });
        placed.push(cell);
        return true;
      }
      this.level.unblockCell(cell.x, cell.y);
      return false;
    };

    for (const room of this.dungeon.rooms) {
      if (room.width < COVER_MIN_ROOM_WIDTH || room.height < COVER_MIN_ROOM_HEIGHT) {
        if (room.width < SMALL_ROOM_MIN_SIZE || room.height < SMALL_ROOM_MIN_SIZE || rng() >= SMALL_ROOM_BARREL_CHANCE) continue;
        const spots = this.coverCandidates(room, placed, 1);
        const spot = spots[Math.floor(rng() * spots.length)];
        if (spot) tryBlock(spot, 'barrel');
        continue;
      }
      const blocks = room.width * room.height >= COVER_BIG_ROOM_AREA ? 3 : 2;

      for (let index = 0; index < blocks; index += 1) {
        const candidates = this.coverCandidates(room, placed);
        const cell = candidates[Math.floor(rng() * candidates.length)];
        if (!cell || !tryBlock(cell)) continue;
        if (rng() >= COVER_PAIR_CHANCE) continue;

        const along = rng() < 0.5 ? { x: 1, y: 0 } : { x: 0, y: 1 };
        const next = { x: cell.x + along.x, y: cell.y + along.y };
        if (candidates.some((other) => other.x === next.x && other.y === next.y)) tryBlock(next);
      }

      const barrelCount = BARRELS_PER_COVER_ROOM + (rng() < EXTRA_BARREL_CHANCE ? 1 : 0);
      for (let index = 0; index < barrelCount; index += 1) {
        const spots = this.coverCandidates(room, placed);
        const spot = spots[Math.floor(rng() * spots.length)];
        if (spot) tryBlock(spot, 'barrel');
      }
    }
  }

  private coverCandidates(room: Room, placed: readonly Cell[], margin = 2): Cell[] {
    const result: Cell[] = [];
    const exit = this.dungeon.exit;
    for (let y = room.y + margin; y < room.y + room.height - margin; y += 1) {
      for (let x = room.x + margin; x < room.x + room.width - margin; x += 1) {
        if (!this.level.isWalkable(x, y)) continue;
        if (Math.hypot(x - this.level.spawnX, y - this.level.spawnY) < COVER_START_CLEARANCE) continue;
        if (exit !== null && Math.hypot(x - exit.x, y - exit.y) < COVER_START_CLEARANCE) continue;
        if (placed.some((cell) => Math.max(Math.abs(cell.x - x), Math.abs(cell.y - y)) < COVER_SPACING)) continue;
        if (this.terminals.some((cell) => Math.max(Math.abs(cell.x - x), Math.abs(cell.y - y)) <= 1)) continue;
        result.push({ x, y });
      }
    }
    return result;
  }

  private countWalkable(): number {
    let count = 0;
    for (let y = 0; y < this.level.height; y += 1) {
      for (let x = 0; x < this.level.width; x += 1) if (this.level.isWalkable(x, y)) count += 1;
    }
    return count;
  }

  private countReachable(): number {
    const start = { x: Math.round(this.level.spawnX), y: Math.round(this.level.spawnY) };
    const seen = new Set<number>([start.y * this.level.width + start.x]);
    const queue: Cell[] = [start];
    for (let head = 0; head < queue.length; head += 1) {
      const cell = queue[head];
      if (!cell) continue;
      for (const [dx, dy] of ORTHOGONAL) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        const key = y * this.level.width + x;
        if (seen.has(key) || !this.level.isWalkable(x, y)) continue;
        seen.add(key);
        queue.push({ x, y });
      }
    }
    return seen.size;
  }

  private farFromSpawn(x: number, y: number): boolean {
    return Math.hypot(x - this.level.spawnX, y - this.level.spawnY) >= LOOT_SPAWN_CLEARANCE;
  }

  private placeFloorLoot(): void {
    const dungeon = this.dungeon;
    const rng = createRng(dungeon.seed ^ FLOOR_LOOT_SEED);
    const target = Math.max(FLOOR_LOOT_MIN, Math.round(FLOOR_LOOT_BASE - dungeon.floor / 2));
    const roomCells: Cell[] = [];
    const deadEnds: Cell[] = [];

    for (const room of dungeon.rooms) {
      for (let y = room.y; y < room.y + room.height; y += 1) {
        for (let x = room.x; x < room.x + room.width; x += 1) {
          if (!this.level.isWalkable(x, y) || this.isExit(x, y) || !this.farFromSpawn(x, y)) continue;
          roomCells.push({ x, y });
        }
      }
    }

    for (let y = 0; y < this.level.height; y += 1) {
      for (let x = 0; x < this.level.width; x += 1) {
        if (!this.level.isWalkable(x, y) || this.isExit(x, y) || !this.farFromSpawn(x, y)) continue;
        const open =
          Number(this.level.isWalkable(x + 1, y)) +
          Number(this.level.isWalkable(x - 1, y)) +
          Number(this.level.isWalkable(x, y + 1)) +
          Number(this.level.isWalkable(x, y - 1));
        if (open <= 1) deadEnds.push({ x, y });
      }
    }

    for (let index = 0; index < target; index += 1) {
      const pool = deadEnds.length > 0 && rng() < 0.3 ? deadEnds : roomCells;
      if (pool.length === 0) break;
      const pick = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      if (!pick) continue;
      this.addLoot(pick, index % 2 === 0 ? 'ammo' : 'stim');
    }

    this.placeHealthRooms(rng);
  }

  private addLoot(cell: Cell, kind: 'ammo' | 'stim'): void {
    this.loot.push({ x: cell.x, y: cell.y, kind, amount: kind === 'ammo' ? LOOT_AMMO_AMOUNT : 0 });
  }

  private placeHealthRooms(rng: () => number): void {
    const dungeon = this.dungeon;
    const target = Math.max(1, Math.round(hostileCountForFloor(dungeon.floor) * HEALTH_PER_HOSTILE));
    const rooms = shuffle([...dungeon.rooms], rng);

    let placed = 0;
    for (const room of rooms) {
      if (placed >= target) break;
      const cells: Cell[] = [];
      for (let y = room.y; y < room.y + room.height; y += 1) {
        for (let x = room.x; x < room.x + room.width; x += 1) {
          if (!this.level.isWalkable(x, y) || this.isExit(x, y) || !this.farFromSpawn(x, y)) continue;
          if (this.loot.some((item) => item.x === x && item.y === y)) continue;
          cells.push({ x, y });
        }
      }
      const pick = cells[Math.floor(rng() * cells.length)];
      if (!pick) continue;
      this.addLoot(pick, 'stim');
      placed += 1;
    }
  }

  private placeEnemies(): EnemySpawn[] {
    const dungeon = this.dungeon;
    const rng = createRng(dungeon.seed ^ COMBAT_SEED);
    const spawnCell = { x: Math.round(this.level.spawnX), y: Math.round(this.level.spawnY) };
    const ranked = dungeon.rooms
      .filter((room) => !inRoom(room, spawnCell))
      .map((room) => {
        const center = roomCenter(room);
        return {
          room,
          area: room.width * room.height,
          distance: Math.abs(center.x - spawnCell.x) + Math.abs(center.y - spawnCell.y),
        };
      })
      .sort((a, b) => b.distance - a.distance);
    const rooms = ranked.length > 0 ? ranked : dungeon.rooms.map((room) => ({ room, area: room.width * room.height, distance: 0 }));
    const bySize = [...rooms].sort((a, b) => b.area - a.area);

    const plan: { room: Room; kind: EnemyKind }[] = [];
    const bossKind = bossForFloor(dungeon.floor);
    const bossRoom = bossKind ? rooms[0]?.room : undefined;
    if (bossKind && bossRoom) plan.push({ room: bossRoom, kind: bossKind });

    const droneTotal = droneCountForFloor(dungeon.floor);
    const droneCounts = new Map<Room, number>();
    for (const entry of rooms.slice(0, droneTotal)) droneCounts.set(entry.room, 1);
    for (let extra = droneTotal - droneCounts.size, index = 0; extra > 0 && bySize.length > 0; extra -= 1, index += 1) {
      const entry = bySize[index % bySize.length];
      if (entry) droneCounts.set(entry.room, (droneCounts.get(entry.room) ?? 0) + 1);
    }
    for (const [room, count] of droneCounts) {
      for (let index = 0; index < count; index += 1) plan.push({ room, kind: 'drone' });
    }

    const tankRooms = bySize.filter((entry) => entry.room !== bossRoom).slice(0, tankCountForFloor(dungeon.floor));
    for (const entry of tankRooms) plan.push({ room: entry.room, kind: 'tank' });

    const taken = new Set<string>();
    const placed: Cell[] = [];
    const enemies: EnemySpawn[] = [];
    for (const { room, kind } of plan) {
      const spawn = this.pickSpawn(room, taken, placed, spawnCell, rng);
      if (!spawn) continue;
      taken.add(`${spawn.x},${spawn.y}`);
      placed.push(spawn);
      enemies.push({ x: spawn.x, y: spawn.y, kind, seed: Math.floor(rng() * 0xffffff) });
    }
    return enemies;
  }

  private pickSpawn(
    room: Room,
    taken: ReadonlySet<string>,
    placed: readonly Cell[],
    start: Cell,
    rng: () => number,
  ): Cell | null {
    const spread: Cell[] = [];
    const loose: Cell[] = [];
    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        if (!this.level.isWalkable(x, y)) continue;
        if (this.isExit(x, y)) continue;
        if (taken.has(`${x},${y}`)) continue;
        loose.push({ x, y });
        const farFromStart = Math.hypot(x - start.x, y - start.y) >= DRONE_MIN_SPAWN_DISTANCE;
        const apart = placed.every((other) => Math.hypot(other.x - x, other.y - y) >= ENEMY_SPACING);
        if (farFromStart && apart) spread.push({ x, y });
      }
    }
    const pool = spread.length > 0 ? spread : loose;
    return pool[Math.floor(rng() * pool.length)] ?? null;
  }

  private placeHazards(): { vents: VentSpawn[] } {
    const dungeon = this.dungeon;
    const rng = createRng(dungeon.seed ^ HAZARD_SEED);
    const { corridor, open } = this.collectCandidates();
    shuffle(corridor, rng);
    shuffle(open, rng);

    const placed: Cell[] = [];
    const steamTotal = steamCount(dungeon.floor);
    const steamCorridor = Math.ceil(steamTotal * STEAM_CORRIDOR_SHARE);
    const steam: Cell[] = [
      ...this.take(corridor, steamCorridor, placed),
      ...this.take(open, steamTotal - steamCorridor, placed),
    ];
    if (steam.length < steamTotal) steam.push(...this.take(corridor, steamTotal - steam.length, placed));

    const vents = steam.map((cell): VentSpawn => ({ x: cell.x, y: cell.y, phaseMs: Math.floor(rng() * STEAM_CYCLE_MS) }));
    return { vents };
  }

  private collectCandidates(): { corridor: Cell[]; open: Cell[] } {
    const dungeon = this.dungeon;
    const level = this.level;
    const corridor: Cell[] = [];
    const open: Cell[] = [];
    const roomCells = new Set<string>();
    for (const room of dungeon.rooms) {
      for (let y = room.y; y < room.y + room.height; y += 1) {
        for (let x = room.x; x < room.x + room.width; x += 1) roomCells.add(`${x},${y}`);
      }
    }

    for (let y = 0; y < dungeon.height; y += 1) {
      for (let x = 0; x < dungeon.width; x += 1) {
        if (!level.isWalkable(x, y)) continue;
        const dx = x - level.spawnX;
        const dy = y - level.spawnY;
        if (dx * dx + dy * dy < SPAWN_CLEARANCE_SQ) continue;
        if (dungeon.exit && Math.hypot(x - dungeon.exit.x, y - dungeon.exit.y) < EXIT_CLEARANCE) continue;
        if (this.loot.some((item) => Math.hypot(item.x - x, item.y - y) < HAZARD_LOOT_CLEARANCE)) continue;
        const north = level.isWalkable(x, y - 1);
        const south = level.isWalkable(x, y + 1);
        const west = level.isWalkable(x - 1, y);
        const east = level.isWalkable(x + 1, y);
        if ((west && east && !north && !south) || (north && south && !west && !east)) corridor.push({ x, y });
        else if (north && south && west && east && roomCells.has(`${x},${y}`)) open.push({ x, y });
      }
    }
    return { corridor, open };
  }

  private take<T extends Cell>(list: T[], count: number, placed: Cell[]): T[] {
    const picked: T[] = [];
    for (const candidate of list) {
      if (picked.length >= count) break;
      if (placed.some((cell) => Math.hypot(cell.x - candidate.x, cell.y - candidate.y) < HAZARD_MIN_SEPARATION)) continue;
      picked.push(candidate);
      placed.push(candidate);
    }
    return picked;
  }
}

export function planLevel(dungeon: Dungeon): LevelEntities {
  return new Planner(dungeon).plan();
}
