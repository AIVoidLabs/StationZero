import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const dist = resolve(root, 'dist');
if (!existsSync(resolve(dist, 'index.html'))) throw new Error('dist/index.html missing; run npm run build first');

const outDir = resolve(root, 'release');
mkdirSync(outDir, { recursive: true });
const zip = resolve(outDir, `station-zero-v${version}-html5.zip`);
rmSync(zip, { force: true });
execFileSync('zip', ['-r', '-q', '-X', zip, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`packaged ${zip}`);
