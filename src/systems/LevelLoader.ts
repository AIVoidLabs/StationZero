import {
  DUNGEON_SEED,
  FLOOR_COUNT,
  FLOOR_SEED_STRIDE,
} from '../data/config';
import floor0 from '../data/levels/floor-0.json';
import floor1 from '../data/levels/floor-1.json';
import floor2 from '../data/levels/floor-2.json';
import floor3 from '../data/levels/floor-3.json';
import type { Dungeon, DungeonExit, FloorStyle, Room } from './DungeonGen';

const RAW_LEVELS: readonly unknown[] = [floor0, floor1, floor2, floor3];

const WALL = '#';
const FLOOR = '.';
const SPAWN = '@';
const EXIT = 'X';

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const cache = new Map<number, Dungeon>();

export interface LevelSummary {
  readonly floor: number;
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly spawnX: number;
  readonly spawnY: number;
  readonly exit: DungeonExit | null;
  readonly rooms: number;
}

function fail(floor: number, message: string): never {
  throw new Error(`Level floor-${floor}.json: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readInteger(record: Record<string, unknown>, key: string, floor: number): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(floor, `\`${key}\` must be an integer`);
  }
  return value;
}

function parseStyle(value: unknown, floor: number): FloorStyle {
  if (value === 0) return 0;
  if (value === 1) return 1;
  if (value === 2) return 2;
  return fail(floor, '`rooms[].style` must be 0, 1 or 2');
}

function parseRows(value: unknown, floor: number): { readonly rows: string[]; readonly width: number; readonly height: number } {
  if (!Array.isArray(value) || value.length < 3) {
    fail(floor, '`rows` must be an array of at least 3 strings');
  }

  const rows: string[] = [];
  let width = -1;

  for (let index = 0; index < value.length; index += 1) {
    const row: unknown = value[index];
    if (typeof row !== 'string') fail(floor, `\`rows[${index}]\` must be a string`);

    if (width < 0) {
      width = row.length;
      if (width < 3) fail(floor, 'rows must be at least 3 characters wide');
    } else if (row.length !== width) {
      fail(floor, `\`rows[${index}]\` is ${row.length} characters wide, expected ${width}`);
    }

    for (let x = 0; x < row.length; x += 1) {
      const char = row[x];
      if (char !== WALL && char !== FLOOR && char !== SPAWN && char !== EXIT) {
        fail(floor, `\`rows[${index}]\` contains unsupported character \`${String(char)}\``);
      }
    }

    rows.push(row);
  }

  return { rows, width, height: rows.length };
}

function parseRooms(
  value: unknown,
  floor: number,
  width: number,
  height: number,
  rows: readonly string[],
): Room[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(floor, '`rooms` must be a non-empty array');
  }

  const rooms: Room[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const raw: unknown = value[index];
    if (!isRecord(raw)) fail(floor, `\`rooms[${index}]\` must be an object`);

    const x = readInteger(raw, 'x', floor);
    const y = readInteger(raw, 'y', floor);
    const roomWidth = readInteger(raw, 'width', floor);
    const roomHeight = readInteger(raw, 'height', floor);

    if (roomWidth < 1 || roomHeight < 1) {
      fail(floor, `\`rooms[${index}]\` must have a positive width and height`);
    }
    if (x < 0 || y < 0 || x + roomWidth > width || y + roomHeight > height) {
      fail(floor, `\`rooms[${index}]\` is outside the map`);
    }

    const style = parseStyle(raw.style, floor);
    let openCells = 0;

    for (let cellY = y; cellY < y + roomHeight; cellY += 1) {
      for (let cellX = x; cellX < x + roomWidth; cellX += 1) {
        if (rows[cellY]?.[cellX] !== WALL) openCells += 1;
      }
    }

    if (openCells === 0) fail(floor, `\`rooms[${index}]\` covers no floor`);

    rooms.push({ x, y, width: roomWidth, height: roomHeight, style });
  }

  return rooms;
}

function countOpenCells(rows: readonly string[]): number {
  let count = 0;
  for (const row of rows) {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== WALL) count += 1;
    }
  }
  return count;
}

function countReachable(rows: readonly string[], start: DungeonExit): number {
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue: DungeonExit[] = [start];

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    if (!current) continue;

    for (const [dx, dy] of DIRECTIONS) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (y < 0 || y >= rows.length) continue;
      const row = rows[y];
      if (!row || x < 0 || x >= row.length) continue;
      if (row[x] === WALL) continue;

      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }

  return seen.size;
}

function parseDungeon(input: unknown, expectedFloor: number): Dungeon {
  if (!isRecord(input)) fail(expectedFloor, 'root must be an object');

  const declaredFloor = readInteger(input, 'floor', expectedFloor);
  if (declaredFloor !== expectedFloor) {
    fail(expectedFloor, `declares floor ${declaredFloor}, expected ${expectedFloor}`);
  }

  const { rows, width, height } = parseRows(input.rows, expectedFloor);

  let spawn: DungeonExit | null = null;
  let exit: DungeonExit | null = null;

  for (let y = 0; y < height; y += 1) {
    const row = rows[y];
    if (!row) continue;
    for (let x = 0; x < width; x += 1) {
      const char = row[x];
      if (char === SPAWN) {
        if (spawn !== null) fail(expectedFloor, 'more than one spawn marker `@`');
        spawn = { x, y };
      } else if (char === EXIT) {
        if (exit !== null) fail(expectedFloor, 'more than one exit marker `X`');
        exit = { x, y };
      }
    }
  }

  if (spawn === null) fail(expectedFloor, 'missing spawn marker `@`');

  const sealed = expectedFloor >= FLOOR_COUNT - 1;
  if (sealed && exit !== null) fail(expectedFloor, 'the final floor must not have an exit marker `X`');
  if (!sealed && exit === null) fail(expectedFloor, 'missing exit marker `X`');

  const reachable = countReachable(rows, spawn);
  const open = countOpenCells(rows);
  if (reachable !== open) {
    fail(expectedFloor, `${open - reachable} floor cells are unreachable from the spawn`);
  }

  const rooms = parseRooms(input.rooms, expectedFloor, width, height, rows);

  const seedValue = input.seed;
  let seed = DUNGEON_SEED + expectedFloor * FLOOR_SEED_STRIDE;
  if (seedValue !== undefined) {
    if (typeof seedValue !== 'number' || !Number.isInteger(seedValue)) {
      fail(expectedFloor, '`seed` must be an integer');
    }
    seed = seedValue;
  }

  return {
    width,
    height,
    rows,
    spawnX: spawn.x,
    spawnY: spawn.y,
    rooms,
    seed,
    floor: expectedFloor,
    exit,
  };
}

export function loadDungeon(floor: number): Dungeon {
  if (!Number.isInteger(floor) || floor < 0 || floor >= FLOOR_COUNT) {
    throw new Error(`Level floor ${floor} is outside 0..${FLOOR_COUNT - 1}`);
  }

  const cached = cache.get(floor);
  if (cached) return cached;

  const raw = RAW_LEVELS[floor];
  if (raw === undefined) {
    throw new Error(`No level file registered for floor ${floor}`);
  }

  const dungeon = parseDungeon(raw, floor);
  cache.set(floor, dungeon);
  return dungeon;
}

export function levelSummaries(): readonly LevelSummary[] {
  const summaries: LevelSummary[] = [];

  for (let floor = 0; floor < FLOOR_COUNT; floor += 1) {
    const dungeon = loadDungeon(floor);
    summaries.push({
      floor: dungeon.floor,
      seed: dungeon.seed,
      width: dungeon.width,
      height: dungeon.height,
      spawnX: dungeon.spawnX,
      spawnY: dungeon.spawnY,
      exit: dungeon.exit,
      rooms: dungeon.rooms.length,
    });
  }

  return summaries;
}
