import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { levelSummaries, loadDungeon } = await server.ssrLoadModule('/src/systems/LevelLoader.ts');
  const { checkLevel } = await server.ssrLoadModule('/src/systems/LevelCheck.ts');
  const summaries = levelSummaries();
  let failed = 0;

  for (const summary of summaries) {
    const dungeon = loadDungeon(summary.floor);
    const problems = checkLevel(dungeon);
    const e = dungeon.entities;
    const exit = summary.exit ? `${summary.exit.x},${summary.exit.y}` : 'sealed';
    console.log(
      `floor-${summary.floor}.json  ${summary.width}x${summary.height}  rooms=${summary.rooms}  spawn=${summary.spawnX},${summary.spawnY}  exit=${exit}  enemies=${e.enemies.length} loot=${e.loot.length} props=${e.props.length} vents=${e.hazards.vents.length} gates=${e.hazards.gates.length}`,
    );
    for (const problem of problems) {
      const at = problem.at ? ` (${problem.at.x},${problem.at.y})` : '';
      console.log(`   ! ${problem.message}${at}`);
    }
    failed += problems.length;
  }

  console.log(`\n${summaries.length} level(s) loaded, ${failed} problem(s).`);
  if (failed > 0) process.exitCode = 1;
} finally {
  await server.close();
}
