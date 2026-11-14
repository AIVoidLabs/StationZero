import { readFile, writeFile } from 'node:fs/promises';

const FROM_FLOOR = 5;
const CYCLE_MS = 4200;
const SPAWN_CLEARANCE = 6;
const EXIT_CLEARANCE = 2.5;
const LOOT_CLEARANCE = 1.5;
const SEPARATION = 3;
const CORRIDOR_SHARE = 0.6;
const SEED = 0x5b0c;

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shockCount = (floor) => (floor < FROM_FLOOR ? 0 : Math.min(4, 1 + Math.floor((floor - FROM_FLOOR) / 2)));

for (let floor = FROM_FLOOR; floor < 11; floor += 1) {
  const path = `src/data/levels/floor-${floor}.json`;
  const level = JSON.parse(await readFile(path, 'utf8'));
  const hazards = level.entities.hazards;
  if (Array.isArray(hazards.shocks) && hazards.shocks.length > 0) {
    console.log(`floor-${floor}.json  shocks already set`);
    continue;
  }
  const rows = level.rows;
  const open = (x, y) => rows[y]?.[x] !== undefined && rows[y][x] !== '#';
  const taken = new Set();
  for (const group of [level.entities.props, level.entities.terminals, level.entities.enemies, hazards.vents]) {
    for (const item of group) taken.add(`${item.x},${item.y}`);
  }
  if (level.entities.corpse) taken.add(`${level.entities.corpse.x},${level.entities.corpse.y}`);
  let spawn = { x: 0, y: 0 };
  let exit = null;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === '@') spawn = { x, y };
      if (row[x] === 'X') exit = { x, y };
    }
  });
  const roomCells = new Set();
  for (const room of level.rooms) for (let y = room.y; y < room.y + room.height; y += 1) for (let x = room.x; x < room.x + room.width; x += 1) roomCells.add(`${x},${y}`);

  const corridor = [];
  const spaces = [];
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      if (!open(x, y) || taken.has(`${x},${y}`)) continue;
      if (Math.hypot(x - spawn.x, y - spawn.y) < SPAWN_CLEARANCE) continue;
      if (exit && Math.hypot(x - exit.x, y - exit.y) < EXIT_CLEARANCE) continue;
      if (level.entities.loot.some((item) => Math.hypot(item.x - x, item.y - y) < LOOT_CLEARANCE)) continue;
      const n = open(x, y - 1);
      const s = open(x, y + 1);
      const w = open(x - 1, y);
      const e = open(x + 1, y);
      if ((w && e && !n && !s) || (n && s && !w && !e)) corridor.push({ x, y });
      else if (n && s && w && e && roomCells.has(`${x},${y}`)) spaces.push({ x, y });
    }
  }
  const rng = createRng(level.seed ^ SEED);
  const shuffle = (list) => {
    for (let index = list.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [list[index], list[swap]] = [list[swap], list[index]];
    }
    return list;
  };
  shuffle(corridor);
  shuffle(spaces);
  const placed = hazards.vents.map((vent) => ({ x: vent.x, y: vent.y }));
  const take = (list, count) => {
    const picked = [];
    for (const candidate of list) {
      if (picked.length >= count) break;
      if (placed.some((cell) => Math.hypot(cell.x - candidate.x, cell.y - candidate.y) < SEPARATION)) continue;
      picked.push(candidate);
      placed.push(candidate);
    }
    return picked;
  };
  const total = shockCount(floor);
  const fromCorridor = Math.ceil(total * CORRIDOR_SHARE);
  let picks = [...take(corridor, fromCorridor), ...take(spaces, total - fromCorridor)];
  if (picks.length < total) picks = [...picks, ...take(corridor, total - picks.length)];
  hazards.shocks = picks.map((cell) => ({ x: cell.x, y: cell.y, phaseMs: Math.floor(rng() * CYCLE_MS) }));
  await writeFile(path, `${JSON.stringify(level, null, 2)}\n`, 'utf8');
  console.log(`floor-${floor}.json  added ${hazards.shocks.length} shock plate(s): ${hazards.shocks.map((s) => `${s.x},${s.y}`).join('  ')}`);
}
