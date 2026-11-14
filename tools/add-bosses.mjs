import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const SIZES = [
  [11, 9],
  [11, 7],
  [9, 9],
  [9, 7],
];
const MAP = 35;

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const { FLOOR_COUNT } = await server.ssrLoadModule('/src/data/config.ts');
  const { ENEMY_SPECS } = await server.ssrLoadModule('/src/data/enemies.ts');
  const { bossVariantForFloor } = await server.ssrLoadModule('/src/data/bosses.ts');
  const { createRng } = await server.ssrLoadModule('/src/utils/random.ts');

  const overlaps = (a, b, gap) =>
    a.x - gap < b.x + b.width && a.x + a.width + gap > b.x && a.y - gap < b.y + b.height && a.y + a.height + gap > b.y;

  for (let floor = 0; floor < FLOOR_COUNT; floor += 1) {
    const path = `src/data/levels/floor-${floor}.json`;
    const level = JSON.parse(await readFile(path, 'utf8'));
    if (level.entities.enemies.some((enemy) => ENEMY_SPECS[enemy.kind].boss)) {
      console.log(`floor-${floor}.json  already has a boss`);
      continue;
    }
    const variant = bossVariantForFloor(floor);
    let spawn = { x: 0, y: 0 };
    level.rows.forEach((row, y) => {
      const x = row.indexOf('@');
      if (x >= 0) spawn = { x, y };
    });
    const center = (room) => ({ x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) });
    const spawnRoom = level.rooms.find((room) => spawn.x >= room.x && spawn.x < room.x + room.width && spawn.y >= room.y && spawn.y < room.y + room.height);
    const ranked = level.rooms
      .filter((room) => room !== spawnRoom)
      .map((room) => ({ room, distance: Math.abs(center(room).x - spawn.x) + Math.abs(center(room).y - spawn.y) }))
      .sort((a, b) => b.distance - a.distance);

    let chosen = null;
    for (const { room } of ranked) {
      const c = center(room);
      for (const [w, h] of SIZES) {
        const x = Math.max(1, Math.min(MAP - 1 - w, c.x - Math.floor(w / 2)));
        const y = Math.max(1, Math.min(MAP - 1 - h, c.y - Math.floor(h / 2)));
        const next = { x, y, width: Math.max(w, room.width), height: Math.max(h, room.height), style: 2 };
        if (next.x + next.width > MAP - 1 || next.y + next.height > MAP - 1) continue;
        if (level.rooms.some((other) => other !== room && overlaps(next, other, 1))) continue;
        chosen = { room, next };
        break;
      }
      if (chosen) break;
    }
    if (!chosen) {
      console.log(`floor-${floor}.json  NO SPACE for a boss arena, needs a manual edit`);
      continue;
    }

    const { room, next } = chosen;
    for (let y = next.y; y < next.y + next.height; y += 1) {
      const row = level.rows[y].split('');
      for (let x = next.x; x < next.x + next.width; x += 1) if (row[x] === '#') row[x] = '.';
      level.rows[y] = row.join('');
    }
    level.rooms[level.rooms.indexOf(room)] = next;

    const taken = new Set();
    for (const group of [level.entities.props, level.entities.terminals, level.entities.loot, level.entities.enemies, level.entities.hazards.vents, level.entities.hazards.shocks ?? []]) {
      for (const item of group) taken.add(`${item.x},${item.y}`);
    }
    if (level.entities.corpse) taken.add(`${level.entities.corpse.x},${level.entities.corpse.y}`);
    const c = center(next);
    let best = null;
    for (let y = next.y; y < next.y + next.height; y += 1) {
      for (let x = next.x; x < next.x + next.width; x += 1) {
        if (level.rows[y][x] === '#' || level.rows[y][x] === '@' || level.rows[y][x] === 'X' || taken.has(`${x},${y}`)) continue;
        const distance = Math.hypot(x - c.x, y - c.y);
        if (!best || distance < best.distance) best = { x, y, distance };
      }
    }
    const rng = createRng(level.seed ^ 0xb055);
    level.entities.enemies.push({ x: best.x, y: best.y, kind: variant.kind, tier: 'master', seed: Math.floor(rng() * 0xffffff) });
    await writeFile(path, `${JSON.stringify(level, null, 2)}\n`, 'utf8');
    console.log(`floor-${floor}.json  ${variant.kind} at ${best.x},${best.y} in room ${next.width}x${next.height} (was ${room.width}x${room.height})`);
  }
} finally {
  await server.close();
}
