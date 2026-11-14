import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const TIER_SEED = 0x71e5;
const REROLL = process.argv.includes('--reroll');

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { FLOOR_COUNT } = await server.ssrLoadModule('/src/data/config.ts');
  const { rollTier } = await server.ssrLoadModule('/src/data/tiers.ts');
  const { ENEMY_SPECS } = await server.ssrLoadModule('/src/data/enemies.ts');
  const { createRng } = await server.ssrLoadModule('/src/utils/random.ts');

  for (let floor = 0; floor < FLOOR_COUNT; floor += 1) {
    const path = `src/data/levels/floor-${floor}.json`;
    const level = JSON.parse(await readFile(path, 'utf8'));
    const rng = createRng(level.seed ^ TIER_SEED);
    let assigned = 0;
    level.entities.enemies = level.entities.enemies.map((enemy) => {
      if (enemy.tier !== undefined && !REROLL) return enemy;
      assigned += 1;
      const tier = ENEMY_SPECS[enemy.kind].boss ? 'master' : rollTier(floor, rng());
      return { x: enemy.x, y: enemy.y, kind: enemy.kind, tier, seed: enemy.seed };
    });
    if (assigned === 0) {
      console.log(`floor-${floor}.json  tiers already set`);
      continue;
    }
    await writeFile(path, `${JSON.stringify(level, null, 2)}\n`, 'utf8');
    const counts = { novice: 0, journeyman: 0, master: 0 };
    for (const enemy of level.entities.enemies) counts[enemy.tier] += 1;
    console.log(`floor-${floor}.json  assigned ${assigned}: ${counts.novice} novice, ${counts.journeyman} journeyman, ${counts.master} master`);
  }
} finally {
  await server.close();
}
