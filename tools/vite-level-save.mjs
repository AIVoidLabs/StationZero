import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROUTE = '/__levels/save';
const LEVEL_DIR = 'src/data/levels';
const MAX_BYTES = 2_000_000;

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(new Error('body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function reply(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

export function levelSavePlugin() {
  return {
    name: 'station-zero-level-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(ROUTE, async (request, response) => {
        if (request.method !== 'POST') return reply(response, 405, { error: 'POST only' });
        try {
          const url = new URL(request.url ?? '', 'http://localhost');
          const floor = Number(url.searchParams.get('floor'));
          if (!Number.isInteger(floor) || floor < 0 || floor > 99) return reply(response, 400, { error: 'bad floor' });

          const text = await readBody(request);
          const level = JSON.parse(text);
          if (typeof level !== 'object' || level === null || level.floor !== floor || !Array.isArray(level.rows)) {
            return reply(response, 400, { error: 'body is not a level for that floor' });
          }

          await mkdir(LEVEL_DIR, { recursive: true });
          const file = path.join(LEVEL_DIR, `floor-${floor}.json`);
          await writeFile(file, `${JSON.stringify(level, null, 2)}\n`, 'utf8');
          return reply(response, 200, { saved: file });
        } catch (error) {
          return reply(response, 500, { error: String(error) });
        }
      });
    },
  };
}
