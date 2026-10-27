import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { levelSummaries } = await server.ssrLoadModule('/src/systems/LevelLoader.ts');
  const summaries = levelSummaries();

  for (const summary of summaries) {
    const exit = summary.exit ? `${summary.exit.x},${summary.exit.y}` : 'sealed';
    console.log(
      `floor-${summary.floor}.json  ${summary.width}x${summary.height}  rooms=${summary.rooms}  spawn=${summary.spawnX},${summary.spawnY}  exit=${exit}  seed=${summary.seed}`,
    );
  }

  console.log(`\n${summaries.length} level(s) valid.`);
} finally {
  await server.close();
}
