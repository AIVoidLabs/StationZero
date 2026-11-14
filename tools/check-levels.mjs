import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { levelSummaries, loadDungeon } = await server.ssrLoadModule('/src/systems/LevelLoader.ts');
  const { checkLevel } = await server.ssrLoadModule('/src/systems/LevelCheck.ts');
  const { rateLevel, formulaTarget } = await server.ssrLoadModule('/src/systems/LevelRating.ts');
  const summaries = levelSummaries();
  let failed = 0;
  let previousScore = 0;

  for (const summary of summaries) {
    const dungeon = loadDungeon(summary.floor);
    const problems = checkLevel(dungeon);
    const e = dungeon.entities;
    const rating = rateLevel({
      floor: summary.floor,
      enemies: e.enemies,
      ventCount: e.hazards.vents.length,
      lootAmmo: e.loot.filter((item) => item.kind === 'ammo').reduce((sum, item) => sum + (item.amount || 4), 0),
      lootStims: e.loot.filter((item) => item.kind === 'stim').length,
    });
    const target = formulaTarget(summary.floor);
    const score = Math.round(rating.total);
    const exit = summary.exit ? `${summary.exit.x},${summary.exit.y}` : 'sealed';
    console.log(
      `floor-${summary.floor}.json  ${summary.width}x${summary.height}  rooms=${summary.rooms}  spawn=${summary.spawnX},${summary.spawnY}  exit=${exit}  enemies=${e.enemies.length} loot=${e.loot.length} props=${e.props.length} vents=${e.hazards.vents.length}  score=${score} (formula ${Math.round(target.total)})`,
    );
    for (const problem of problems) {
      const at = problem.at ? ` (${problem.at.x},${problem.at.y})` : '';
      console.log(`   ! ${problem.message}${at}`);
    }
    if (score < previousScore) console.log(`   note: easier than the floor above (${score} < ${previousScore})`);
    previousScore = score;
    failed += problems.length;
  }

  console.log(`\n${summaries.length} level(s) loaded, ${failed} problem(s).`);
  if (failed > 0) process.exitCode = 1;
} finally {
  await server.close();
}
