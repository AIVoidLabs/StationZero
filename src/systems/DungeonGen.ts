import { DUNGEON_HEIGHT, DUNGEON_SEED, DUNGEON_WIDTH } from '../data/config';
import { createRng } from '../utils/random';

export type FloorStyle = 0 | 1 | 2;

export interface Room {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly style: FloorStyle;
}

export interface Dungeon {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly string[];
  readonly spawnX: number;
  readonly spawnY: number;
  readonly rooms: readonly Room[];
  readonly seed: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

const ROOM_COUNT = 7;
const HALL_SIZE = 7;
const MIN_ROOM_WIDTH = 3;
const MAX_ROOM_WIDTH = 7;
const MIN_ROOM_HEIGHT = 3;
const MAX_ROOM_HEIGHT = 6;
const ROOM_PLACEMENT_ATTEMPTS = 40;
const MAX_SEED_ATTEMPTS = 24;
const MAX_EXTRA_LINKS = 3;
const EXTRA_LINK_DISTANCE = 14;
const WALL = '#';
const FLOOR = '.';
const SPAWN = '@';

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function roomCenter(room: Room): Point {
  return {
    x: room.x + Math.floor(room.width / 2),
    y: room.y + Math.floor(room.height / 2),
  };
}

function roomArea(room: Room): number {
  return room.width * room.height;
}

function overlaps(a: Room, b: Room, gap: number): boolean {
  return (
    a.x - gap < b.x + b.width &&
    a.x + a.width + gap > b.x &&
    a.y - gap < b.y + b.height &&
    a.y + a.height + gap > b.y
  );
}

function createCells(): string[][] {
  return Array.from({ length: DUNGEON_HEIGHT }, () => Array.from({ length: DUNGEON_WIDTH }, () => WALL));
}

function setFloor(cells: string[][], x: number, y: number): void {
  if (x <= 0 || y <= 0 || x >= DUNGEON_WIDTH - 1 || y >= DUNGEON_HEIGHT - 1) return;
  const row = cells[y];
  if (row) row[x] = FLOOR;
}

function carveRoom(cells: string[][], room: Room): void {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      setFloor(cells, x, y);
    }
  }
}

function carveCorridor(cells: string[][], from: Point, to: Point, horizontalFirst: boolean): void {
  let x = from.x;
  let y = from.y;
  const stepX = Math.sign(to.x - from.x);
  const stepY = Math.sign(to.y - from.y);

  if (horizontalFirst) {
    while (x !== to.x) {
      x += stepX;
      setFloor(cells, x, y);
    }
    while (y !== to.y) {
      y += stepY;
      setFloor(cells, x, y);
    }
    return;
  }

  while (y !== to.y) {
    y += stepY;
    setFloor(cells, x, y);
  }
  while (x !== to.x) {
    x += stepX;
    setFloor(cells, x, y);
  }
}

function placeRoom(
  rng: () => number,
  rooms: readonly Room[],
  width: number,
  height: number,
  style: FloorStyle,
): Room | null {
  for (let attempt = 0; attempt < ROOM_PLACEMENT_ATTEMPTS; attempt += 1) {
    const x = randInt(rng, 1, DUNGEON_WIDTH - width - 1);
    const y = randInt(rng, 1, DUNGEON_HEIGHT - height - 1);
    const room: Room = { x, y, width, height, style };
    if (rooms.some((other) => overlaps(other, room, 1))) continue;
    return room;
  }
  return null;
}

function connectRooms(cells: string[][], rng: () => number, rooms: readonly Room[]): void {
  const centers = rooms.map(roomCenter);
  const inTree: number[] = [0];
  const linked = new Set<string>();

  while (inTree.length < rooms.length) {
    let bestFrom = -1;
    let bestTo = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const from of inTree) {
      const fromCenter = centers[from];
      if (!fromCenter) continue;
      for (let to = 0; to < rooms.length; to += 1) {
        if (inTree.includes(to)) continue;
        const toCenter = centers[to];
        if (!toCenter) continue;
        const distance = Math.abs(fromCenter.x - toCenter.x) + Math.abs(fromCenter.y - toCenter.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestFrom = from;
          bestTo = to;
        }
      }
    }

    if (bestFrom < 0 || bestTo < 0) break;
    const fromCenter = centers[bestFrom];
    const toCenter = centers[bestTo];
    if (!fromCenter || !toCenter) break;

    carveCorridor(cells, fromCenter, toCenter, rng() < 0.5);
    linked.add(`${Math.min(bestFrom, bestTo)}:${Math.max(bestFrom, bestTo)}`);
    inTree.push(bestTo);
  }

  let extraLinks = 0;
  for (let i = 0; i < rooms.length && extraLinks < MAX_EXTRA_LINKS; i += 1) {
    for (let j = i + 1; j < rooms.length && extraLinks < MAX_EXTRA_LINKS; j += 1) {
      if (linked.has(`${i}:${j}`)) continue;
      const a = centers[i];
      const b = centers[j];
      if (!a || !b) continue;
      const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (distance > EXTRA_LINK_DISTANCE || rng() > 0.4) continue;
      carveCorridor(cells, a, b, rng() < 0.5);
      extraLinks += 1;
    }
  }
}

function addPillars(cells: string[][], room: Room): void {
  const inset = 2;
  const positions: readonly Point[] = [
    { x: room.x + inset, y: room.y + inset },
    { x: room.x + room.width - inset - 1, y: room.y + inset },
    { x: room.x + inset, y: room.y + room.height - inset - 1 },
    { x: room.x + room.width - inset - 1, y: room.y + room.height - inset - 1 },
  ];
  for (const position of positions) {
    const row = cells[position.y];
    if (row) row[position.x] = WALL;
  }
}

function countFloors(cells: readonly (readonly string[])[]): number {
  let count = 0;
  for (const row of cells) {
    for (const cell of row) {
      if (cell !== WALL) count += 1;
    }
  }
  return count;
}

function countReachable(cells: readonly (readonly string[])[], start: Point): number {
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const queue: Point[] = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const direction of DIRECTIONS) {
      const x = current.x + direction[0];
      const y = current.y + direction[1];
      const key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= DUNGEON_WIDTH || y >= DUNGEON_HEIGHT) continue;
      if (seen.has(key)) continue;
      if (cells[y]?.[x] === WALL) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }

  return seen.size;
}

function attemptDungeon(seed: number): Dungeon | null {
  const rng = createRng(seed);
  const cells = createCells();
  const rooms: Room[] = [];

  const hall = placeRoom(rng, rooms, HALL_SIZE, HALL_SIZE, 1);
  if (!hall) return null;
  rooms.push(hall);

  let styleCursor = 0;
  let placements = 0;
  while (rooms.length < ROOM_COUNT && placements < 400) {
    placements += 1;
    const width = randInt(rng, MIN_ROOM_WIDTH, MAX_ROOM_WIDTH);
    const height = randInt(rng, MIN_ROOM_HEIGHT, MAX_ROOM_HEIGHT);
    const style: FloorStyle = styleCursor % 3 === 0 ? 2 : 0;
    styleCursor += 1;
    const room = placeRoom(rng, rooms, width, height, style);
    if (!room) continue;
    rooms.push(room);
  }
  if (rooms.length < ROOM_COUNT) return null;

  for (const room of rooms) {
    carveRoom(cells, room);
  }

  connectRooms(cells, rng, rooms);
  addPillars(cells, hall);

  const spawnRoom = rooms
    .filter((room) => room !== hall)
    .reduce<Room | null>((smallest, room) => (smallest === null || roomArea(room) < roomArea(smallest) ? room : smallest), null);
  if (!spawnRoom) return null;
  const spawn = roomCenter(spawnRoom);

  const spawnRow = cells[spawn.y];
  if (!spawnRow) return null;
  spawnRow[spawn.x] = SPAWN;

  const floors = countFloors(cells);
  const reachable = countReachable(cells, spawn);
  if (reachable !== floors) return null;

  return {
    width: DUNGEON_WIDTH,
    height: DUNGEON_HEIGHT,
    rows: cells.map((row) => row.join('')),
    spawnX: spawn.x,
    spawnY: spawn.y,
    rooms,
    seed,
  };
}

export function generateDungeon(seed: number = DUNGEON_SEED): Dungeon {
  for (let attempt = 0; attempt < MAX_SEED_ATTEMPTS; attempt += 1) {
    const dungeon = attemptDungeon(seed + attempt);
    if (dungeon) return dungeon;
  }
  throw new Error('Could not generate a connected dungeon');
}
