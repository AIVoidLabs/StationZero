import { bossForFloor } from '../data/enemies';
import type { GridPoint } from '../data/levelTypes';
import type { Dungeon } from './DungeonGen';

export interface LevelProblem {
  readonly message: string;
  readonly at: GridPoint | null;
}

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function key(cell: GridPoint): string {
  return `${cell.x},${cell.y}`;
}

function isOpen(dungeon: Dungeon, x: number, y: number): boolean {
  const char = dungeon.rows[y]?.[x];
  return char !== undefined && char !== '#';
}

function reachableCount(dungeon: Dungeon, blocked: ReadonlySet<string>): number {
  const start = { x: dungeon.spawnX, y: dungeon.spawnY };
  const seen = new Set<string>([key(start)]);
  const queue: GridPoint[] = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    if (!cell) continue;
    for (const [dx, dy] of ORTHOGONAL) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      if (!isOpen(dungeon, next.x, next.y) || blocked.has(key(next)) || seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return seen.size;
}

export function checkLevel(dungeon: Dungeon): LevelProblem[] {
  const problems: LevelProblem[] = [];
  const add = (message: string, at: GridPoint | null): void => {
    problems.push({ message, at });
  };
  const e = dungeon.entities;
  const spawn = { x: dungeon.spawnX, y: dungeon.spawnY };

  const blockers = new Map<string, string>();
  const claim = (cell: GridPoint, label: string): void => {
    const at = key(cell);
    const other = blockers.get(at);
    if (other) add(`${label} overlaps ${other}`, cell);
    blockers.set(at, label);
  };
  e.props.forEach((prop, index) => claim(prop, `props[${index}]`));
  e.terminals.forEach((terminal, index) => claim(terminal, `terminals[${index}]`));

  for (const [at, label] of blockers) {
    const [x, y] = at.split(',').map(Number);
    const cell = { x: x ?? 0, y: y ?? 0 };
    if (at === key(spawn)) add(`${label} sits on the spawn`, cell);
    if (dungeon.exit && at === key(dungeon.exit)) add(`${label} sits on the exit`, cell);
  }

  let openCells = 0;
  for (let y = 0; y < dungeon.height; y += 1) {
    for (let x = 0; x < dungeon.width; x += 1) if (isOpen(dungeon, x, y)) openCells += 1;
  }
  const reachable = reachableCount(dungeon, new Set(blockers.keys()));
  if (reachable !== openCells - blockers.size) {
    add('props or terminals cut the level into unreachable pieces', null);
  }

  e.loot.forEach((item, index) => {
    const other = blockers.get(key(item));
    if (other) add(`loot[${index}] is inside ${other}`, item);
  });

  const enemyCells = new Set<string>();
  e.enemies.forEach((enemy, index) => {
    const other = blockers.get(key(enemy));
    if (other) add(`enemies[${index}] is inside ${other}`, enemy);
    if (enemyCells.has(key(enemy))) add(`enemies[${index}] shares a cell with another enemy`, enemy);
    enemyCells.add(key(enemy));
    if (dungeon.exit && key(enemy) === key(dungeon.exit)) add(`enemies[${index}] stands on the exit`, enemy);
  });
  e.hazards.vents.forEach((vent, index) => {
    const other = blockers.get(key(vent));
    if (other) add(`vents[${index}] is inside ${other}`, vent);
  });

  const corpse = e.corpse;
  if (corpse) {
    const other = blockers.get(key(corpse));
    if (other) add(`corpse is inside ${other}`, corpse);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!isOpen(dungeon, corpse.x + dx, corpse.y + dy)) {
          add('corpse touches a wall and may be hidden behind it', corpse);
          dy = 2;
          break;
        }
      }
    }
  }

  const bosses = e.enemies.filter((enemy) => enemy.kind === 'assembler' || enemy.kind === 'warden');
  const expected = bossForFloor(dungeon.floor) !== null ? 1 : 0;
  if (bosses.length !== expected) add(`expected ${expected} boss, found ${bosses.length}`, null);
  if (e.enemies.length === 0) add('floor has no enemies', null);

  return problems;
}
