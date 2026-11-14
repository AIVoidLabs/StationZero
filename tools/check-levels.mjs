import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

const key = (cell) => `${cell.x},${cell.y}`;

function reachableCount(dungeon, blocked) {
  const start = { x: dungeon.spawnX, y: dungeon.spawnY };
  const seen = new Set([key(start)]);
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      const char = dungeon.rows[next.y]?.[next.x];
      if (char === undefined || char === '#' || blocked.has(key(next)) || seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return seen.size;
}

function checkEntities(dungeon, bossKinds) {
  const problems = [];
  const e = dungeon.entities;
  const blockers = new Map();
  const claim = (cell, label) => {
    const at = key(cell);
    if (blockers.has(at)) problems.push(`${label} at ${at} overlaps ${blockers.get(at)}`);
    blockers.set(at, label);
  };
  e.props.forEach((p, i) => claim(p, `props[${i}]`));
  e.terminals.forEach((t, i) => claim(t, `terminals[${i}]`));

  const spawn = { x: dungeon.spawnX, y: dungeon.spawnY };
  for (const [at, label] of blockers) {
    if (at === key(spawn)) problems.push(`${label} sits on the spawn`);
    if (dungeon.exit && at === key(dungeon.exit)) problems.push(`${label} sits on the exit`);
  }

  const open = new Set(blockers.keys());
  let openCells = 0;
  for (let y = 0; y < dungeon.height; y += 1) {
    for (let x = 0; x < dungeon.width; x += 1) if (dungeon.rows[y][x] !== '#') openCells += 1;
  }
  if (reachableCount(dungeon, open) !== openCells - open.size) problems.push('props/terminals cut the level into unreachable pieces');

  for (const [i, item] of e.loot.entries()) {
    if (blockers.has(key(item))) problems.push(`loot[${i}] is inside ${blockers.get(key(item))}`);
  }
  const enemyCells = new Set();
  for (const [i, enemy] of e.enemies.entries()) {
    if (blockers.has(key(enemy))) problems.push(`enemies[${i}] is inside ${blockers.get(key(enemy))}`);
    if (enemyCells.has(key(enemy))) problems.push(`enemies[${i}] shares a cell with another enemy`);
    enemyCells.add(key(enemy));
    if (dungeon.exit && key(enemy) === key(dungeon.exit)) problems.push(`enemies[${i}] stands on the exit`);
  }
  for (const [i, vent] of e.hazards.vents.entries()) {
    if (blockers.has(key(vent))) problems.push(`vents[${i}] is inside ${blockers.get(key(vent))}`);
  }
  for (const [i, gate] of e.hazards.gates.entries()) {
    if (blockers.has(key(gate))) problems.push(`gates[${i}] is inside ${blockers.get(key(gate))}`);
  }

  const bossFloor = bossKinds.has(dungeon.floor);
  const bosses = e.enemies.filter((enemy) => enemy.kind === 'assembler' || enemy.kind === 'warden');
  if (bossFloor && bosses.length !== 1) problems.push(`expected exactly one boss, found ${bosses.length}`);
  if (!bossFloor && bosses.length > 0) problems.push('boss found on a floor that should not have one');
  if (e.enemies.length === 0) problems.push('floor has no enemies');
  return problems;
}

try {
  const { levelSummaries, loadDungeon } = await server.ssrLoadModule('/src/systems/LevelLoader.ts');
  const { bossForFloor } = await server.ssrLoadModule('/src/data/enemies.ts');
  const bossKinds = { has: (floor) => bossForFloor(floor) !== null };
  const summaries = levelSummaries();
  let failed = 0;

  for (const summary of summaries) {
    const dungeon = loadDungeon(summary.floor);
    const problems = checkEntities(dungeon, bossKinds);
    const e = dungeon.entities;
    const exit = summary.exit ? `${summary.exit.x},${summary.exit.y}` : 'sealed';
    console.log(
      `floor-${summary.floor}.json  ${summary.width}x${summary.height}  rooms=${summary.rooms}  spawn=${summary.spawnX},${summary.spawnY}  exit=${exit}  enemies=${e.enemies.length} loot=${e.loot.length} props=${e.props.length} vents=${e.hazards.vents.length} gates=${e.hazards.gates.length}`,
    );
    for (const problem of problems) console.log(`   ! ${problem}`);
    failed += problems.length;
  }

  console.log(`\n${summaries.length} level(s) loaded, ${failed} problem(s).`);
  if (failed > 0) process.exitCode = 1;
} finally {
  await server.close();
}
