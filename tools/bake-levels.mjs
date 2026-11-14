import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { DUNGEON_SEED, FLOOR_COUNT, FLOOR_SEED_STRIDE } = await server.ssrLoadModule(
    '/src/data/config.ts',
  );
  const { generateDungeon } = await server.ssrLoadModule('/src/systems/DungeonGen.ts');
  const { planLevel } = await server.ssrLoadModule('/src/systems/LevelPlan.ts');

  await mkdir('src/data/levels', { recursive: true });

  for (let floor = 0; floor < FLOOR_COUNT; floor += 1) {
    const path = `src/data/levels/floor-${floor}.json`;
    const existing = await readFile(path, 'utf8').then((text) => JSON.parse(text)).catch(() => null);
    if (existing && existing.locked === true) {
      console.log(`floor-${floor}.json  locked, skipped`);
      continue;
    }

    const seed = DUNGEON_SEED + floor * FLOOR_SEED_STRIDE;
    const dungeon = generateDungeon(seed, floor);
    const rows = dungeon.rows.map((row) => row.split(''));

    if (dungeon.exit) {
      const row = rows[dungeon.exit.y];
      if (!row) throw new Error(`exit row ${dungeon.exit.y} missing on floor ${floor}`);
      row[dungeon.exit.x] = 'X';
    }

    const level = {
      floor,
      seed: dungeon.seed,
      rows: rows.map((row) => row.join('')),
      rooms: dungeon.rooms.map((room) => ({
        x: room.x,
        y: room.y,
        width: room.width,
        height: room.height,
        style: room.style,
      })),
      entities: planLevel(dungeon),
    };

    await writeFile(
      path,
      `${JSON.stringify(level, null, 2)}\n`,
      'utf8',
    );

    const e = level.entities;
    const exit = dungeon.exit ? `${dungeon.exit.x},${dungeon.exit.y}` : 'sealed';
    console.log(`floor-${floor}.json  rooms=${dungeon.rooms.length}  spawn=${dungeon.spawnX},${dungeon.spawnY}  exit=${exit}  enemies=${e.enemies.length} loot=${e.loot.length} props=${e.props.length} terminals=${e.terminals.length} vents=${e.hazards.vents.length}`);
  }
} finally {
  await server.close();
}
