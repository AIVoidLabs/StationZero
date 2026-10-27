import { mkdir, writeFile } from 'node:fs/promises';
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

  await mkdir('src/data/levels', { recursive: true });

  for (let floor = 0; floor < FLOOR_COUNT; floor += 1) {
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
    };

    await writeFile(
      `src/data/levels/floor-${floor}.json`,
      `${JSON.stringify(level, null, 2)}\n`,
      'utf8',
    );

    const exit = dungeon.exit ? `${dungeon.exit.x},${dungeon.exit.y}` : 'sealed';
    console.log(`floor-${floor}.json  rooms=${dungeon.rooms.length}  spawn=${dungeon.spawnX},${dungeon.spawnY}  exit=${exit}`);
  }
} finally {
  await server.close();
}
