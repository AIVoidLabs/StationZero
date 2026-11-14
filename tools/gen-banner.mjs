import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const W = 1920;
const H = 540;
const SRC_TOP = 160;
const SHIFT = 0;

const shot = await sharp(resolve(root, 'docs/itch/banner-source.png'))
  .resize(1920, 1080, { kernel: 'nearest' })
  .extract({ left: 0, top: SRC_TOP, width: W - SHIFT, height: H })
  .extend({ left: SHIFT, background: '#000' })
  .modulate({ brightness: 1.4, saturation: 1.1 })
  .toBuffer();

const title = await sharp(resolve(root, 'assets/art/v2/menu/title.png')).resize(720, 141, { kernel: 'nearest' }).toBuffer();

const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="l" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#050505" stop-opacity="0.96"/>
      <stop offset="0.38" stop-color="#050505" stop-opacity="0.6"/>
      <stop offset="0.55" stop-color="#050505" stop-opacity="0"/>
      <stop offset="1" stop-color="#050505" stop-opacity="0.25"/>
    </linearGradient>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#050505" stop-opacity="0.7"/>
      <stop offset="0.25" stop-color="#050505" stop-opacity="0"/>
      <stop offset="0.75" stop-color="#050505" stop-opacity="0"/>
      <stop offset="1" stop-color="#050505" stop-opacity="0.8"/>
    </linearGradient>
    <pattern id="s" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="#000" opacity="0.18"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#l)"/>
  <rect width="${W}" height="${H}" fill="url(#v)"/>
  <rect width="${W}" height="${H}" fill="url(#s)"/>
  <rect x="64" y="262" width="8" height="150" fill="#a63a2a"/>
  <text x="96" y="318" font-family="monospace" font-weight="bold" font-size="64" fill="#e8dcc0" letter-spacing="4">ONE MORE FLOOR.</text>
  <text x="96" y="368" font-family="monospace" font-size="26" fill="#d99a3a" letter-spacing="3">11 FLOORS  /  11 BOSSES  /  1 AI TO KILL</text>
  <text x="96" y="410" font-family="monospace" font-size="22" fill="#9a9a94" letter-spacing="2">FAST. DARK. ISOMETRIC SHOOTER.</text>
</svg>`);

mkdirSync(resolve(root, 'docs/itch'), { recursive: true });
const out = resolve(root, 'docs/itch/banner.png');
await sharp(shot)
  .composite([{ input: overlay }, { input: title, left: 80, top: 90 }])
  .png({ palette: true, colours: 256, effort: 10 })
  .toFile(out);
console.log(`wrote ${out}`);
