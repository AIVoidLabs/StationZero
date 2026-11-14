import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const SPIDER_SEED = 0x5d1e7;

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const { FLOOR_COUNT } = await server.ssrLoadModule('/src/data/config.ts');
  const { spiderShareForFloor } = await server.ssrLoadModule('/src/data/enemies.ts');
  const { createRng } = await server.ssrLoadModule('/src/utils/random.ts');

  for (let floor = 0; floor < FLOOR_COUNT; floor += 1) {
    const path = `src/data/levels/floor-${floor}.json`;
    const level = JSON.parse(await readFile(path, 'utf8'));
    if (level.entities.enemies.some((enemy) => enemy.kind === 'spider')) {
      console.log(`floor-${floor}.json  spiders already present`);
      continue;
    }
    const share = spiderShareForFloor(floor);
    if (share <= 0) continue;
    const rng = createRng(level.seed ^ SPIDER_SEED);
    let changed = 0;
    for (const enemy of level.entities.enemies) {
      if (enemy.kind === 'drone' && rng() < share) {
        enemy.kind = 'spider';
        changed += 1;
      }
    }
    await writeFile(path, `${JSON.stringify(level, null, 2)}\n`, 'utf8');
    console.log(`floor-${floor}.json  ${changed} drone(s) became spiders`);
  }
} finally {
  await server.close();
}
