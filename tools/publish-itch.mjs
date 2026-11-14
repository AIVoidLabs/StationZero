import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const target = process.env.ITCH_TARGET;
if (!target) throw new Error('Set ITCH_TARGET, e.g. user/station-zero:html5');
execFileSync('butler', ['push', resolve(root, 'dist'), target, '--userversion', version], { stdio: 'inherit' });
