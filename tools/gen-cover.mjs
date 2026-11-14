import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const W = 630;
const H = 500;
const menu = resolve(root, 'assets/art/v2/menu');

const bg = await sharp(resolve(menu, 'menu_bg.png'))
  .resize(960, 540, { kernel: 'nearest' })
  .extract({ left: 0, top: 20, width: W, height: H })
  .toBuffer();

const title = await sharp(resolve(menu, 'title.png')).resize(592, 116, { kernel: 'nearest' }).toBuffer();

const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="v" cx="40%" cy="62%" r="75%">
      <stop offset="35%" stop-color="#050505" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#050505" stop-opacity="0.9"/>
    </radialGradient>
    <linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#050505" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#050505" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#050505" stop-opacity="0"/>
      <stop offset="1" stop-color="#050505" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#v)"/>
  <rect width="${W}" height="200" fill="url(#t)"/>
  <rect y="${H - 150}" width="${W}" height="150" fill="url(#b)"/>
  <text x="${W / 2}" y="${H - 62}" text-anchor="middle" font-family="monospace" font-size="15" fill="#c9a24a" letter-spacing="3">PENAL COLONY-NULL</text>
  <text x="${W / 2}" y="${H - 34}" text-anchor="middle" font-family="monospace" font-size="13" fill="#9a9a94">No rescue. Survive one more floor.</text>
</svg>`);

mkdirSync(resolve(root, 'docs/itch'), { recursive: true });
const out = resolve(root, 'docs/itch/cover.png');
await sharp(bg)
  .composite([{ input: overlay }, { input: title, left: Math.round((W - 592) / 2), top: 28 }])
  .png()
  .toFile(out);
console.log(`wrote ${out}`);
