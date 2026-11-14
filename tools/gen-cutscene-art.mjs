import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const V2 = path.join(ROOT, 'assets', 'art', 'v2');
const OUT = path.join(V2, 'cutscenes');
const PREVIEW = path.join(ROOT, 'art-preview', 'proposed', 'cutscenes');

const W = 480;
const H = 270;
const LOW_W = 240;
const LOW_H = 135;
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function svg(body, defs = '') {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LOW_W}" height="${LOW_H}" viewBox="0 0 ${LOW_W} ${LOW_H}"><defs>${defs}</defs>${body}</svg>`,
  );
}

function radial(id, cx, cy, r, stops) {
  const items = stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">${items}</radialGradient>`;
}

function overlaySvg(width, height, glows, vignette) {
  const defs = glows
    .map((g, i) => radial(`g${i}`, g.x, g.y, g.r, [[0, g.color, g.a], [1, g.color, 0]]))
    .join('');
  const rects = glows.map((_, i) => `<rect width="${width}" height="${height}" fill="url(#g${i})"/>`).join('');
  const vig = `<radialGradient id="v" cx="${width / 2}" cy="${height / 2}" r="${width * 0.7}" gradientUnits="userSpaceOnUse"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${vignette}"/></radialGradient>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${defs}${vig}</defs>${rects}<rect width="${width}" height="${height}" fill="url(#v)"/></svg>`,
  );
}

async function sprite(file, index, frameWidth = 32, frameHeight = 48) {
  return sharp(file)
    .extract({ left: index * frameWidth, top: 0, width: frameWidth, height: frameHeight })
    .png()
    .toBuffer();
}

async function scaled(buffer, factor, rotate = 0) {
  let img = sharp(buffer);
  if (rotate) img = img.rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const meta = await sharp(await img.png().toBuffer()).metadata();
  return sharp(await img.png().toBuffer())
    .resize({ width: Math.round((meta.width ?? 32) * factor), kernel: 'nearest' })
    .png()
    .toBuffer();
}

async function finish(lowSvg, sprites, glows, vignette = 0.75) {
  const base = await sharp(lowSvg).png().toBuffer();
  const up = await sharp(base).resize({ width: W, height: H, kernel: 'nearest' }).png().toBuffer();
  const composites = [];
  for (const item of sprites) composites.push({ input: item.input, left: item.left, top: item.top });
  composites.push({ input: overlaySvg(W, H, glows, vignette), blend: 'screen' });
  const out = await sharp(up).composite(composites).png().toBuffer();
  const vigOnly = await sharp(out)
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="v" cx="${W / 2}" cy="${H / 2}" r="${W * 0.7}" gradientUnits="userSpaceOnUse"><stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${vignette}"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`,
        ),
      },
    ])
    .png({ palette: true, colors: 40 })
    .toBuffer();
  return vigOnly;
}

function scanlines() {
  let lines = '';
  for (let y = 0; y < LOW_H; y += 2) lines += `<rect y="${y}" width="${LOW_W}" height="0.5" fill="#000" opacity="0.18"/>`;
  return lines;
}

async function introShaft() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#05070a"/>`;
  const cx = 120;
  const cy = 58;
  for (let i = 0; i < 11; i += 1) {
    const size = 230 * 0.76 ** i;
    const half = size / 2;
    const color = i % 2 === 0 ? '#10161a' : '#182025';
    body += `<rect x="${cx - half}" y="${cy - half * 0.58}" width="${size}" height="${size * 0.58}" fill="${color}" stroke="#05070a" stroke-width="0.6"/>`;
    const rung = size * 0.2;
    body += `<line x1="${cx - rung}" y1="${cy - half * 0.58}" x2="${cx - rung}" y2="${cy + half * 0.58}" stroke="#3a4a50" stroke-width="${Math.max(0.3, size / 90)}"/>`;
    body += `<line x1="${cx + rung}" y1="${cy - half * 0.58}" x2="${cx + rung}" y2="${cy + half * 0.58}" stroke="#3a4a50" stroke-width="${Math.max(0.3, size / 90)}"/>`;
  }
  body += `<rect x="${cx - 5}" y="${cy - 3}" width="10" height="6" fill="#d8eef8"/>`;
  body += `<rect x="${cx - 3}" y="${cy - 1.5}" width="6" height="3" fill="#ffffff"/>`;
  body += scanlines();
  return finish(
    svg(body),
    [],
    [
      { x: cx * 2, y: cy * 2, r: 200, color: 'rgb(150,200,225)', a: 0.5 },
      { x: cx * 2, y: cy * 2, r: 60, color: 'rgb(255,255,255)', a: 0.5 },
    ],
    0.8,
  );
}

async function introNames() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#07090b"/>`;
  body += `<rect x="40" y="10" width="160" height="116" fill="#10161a" stroke="#2a3438" stroke-width="1.2"/>`;
  body += `<rect x="40" y="10" width="160" height="10" fill="#1a2328"/>`;
  for (let i = 0; i < 10; i += 1) {
    const y = 28 + i * 8.6;
    const w = 40 + ((i * 29) % 44);
    body += `<line x1="52" y1="${y}" x2="${52 + w}" y2="${y}" stroke="#7a8c92" stroke-width="1.5"/>`;
    body += `<line x1="52" y1="${y}" x2="${52 + w}" y2="${y}" stroke="#3a464a" stroke-width="0.5" stroke-dasharray="1 2" transform="translate(0 1.4)"/>`;
    body += `<line x1="${52 + w + 6}" y1="${y - 2}" x2="${52 + w + 12}" y2="${y + 2}" stroke="#a02a22" stroke-width="1.2"/>`;
    body += `<line x1="${52 + w + 12}" y1="${y - 2}" x2="${52 + w + 6}" y2="${y + 2}" stroke="#a02a22" stroke-width="1.2"/>`;
  }
  const y11 = 28 + 10 * 8.6;
  body += `<path d="M52,${y11} q6,-5 12,0 t12,0 t12,0 t12,0 t10,-1" fill="none" stroke="#d9a441" stroke-width="1.6"/>`;
  body += scanlines();
  return finish(svg(body), [], [
    { x: 240, y: 40, r: 230, color: 'rgb(170,200,210)', a: 0.32 },
    { x: 260, y: 230, r: 80, color: 'rgb(217,164,65)', a: 0.35 },
  ], 0.78);
}

async function introEye() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#04050 6"/>`.replace('#04050 6', '#040506');
  body += `<rect x="0" y="0" width="${LOW_W}" height="14" fill="#0d1113"/>`;
  body += `<rect x="108" y="10" width="24" height="18" fill="#161d20" stroke="#050607"/>`;
  body += `<circle cx="120" cy="58" r="30" fill="#10161a" stroke="#050607" stroke-width="2"/>`;
  body += `<circle cx="120" cy="58" r="22" fill="#1d262b" stroke="#050607"/>`;
  body += `<circle cx="120" cy="58" r="16" fill="#3a0a07"/>`;
  body += `<circle cx="120" cy="58" r="11" fill="#c8281a"/>`;
  body += `<circle cx="120" cy="58" r="5" fill="#ff7a5a"/>`;
  body += `<circle cx="115" cy="53" r="2" fill="#ffffff"/>`;
  body += `<polygon points="120,88 60,${LOW_H} 180,${LOW_H}" fill="#c8281a" opacity="0.14"/>`;
  body += scanlines();
  return finish(
    svg(body),
    [],
    [
      { x: 240, y: 116, r: 220, color: 'rgb(255,40,24)', a: 0.5 },
      { x: 240, y: 116, r: 50, color: 'rgb(255,160,120)', a: 0.5 },
    ],
    0.85,
  );
}

async function introHatch() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#05070a"/>`;
  body += `<polygon points="120,40 190,76 120,112 50,76" fill="#1a2024" stroke="#050607" stroke-width="1.5"/>`;
  body += `<polygon points="120,50 172,76 120,102 68,76" fill="#04090b"/>`;
  body += `<polygon points="120,60 150,76 120,92 90,76" fill="#2a8aa8" opacity="0.7"/>`;
  for (let i = 0; i < 7; i += 1) body += `<polygon points="${52 + i * 20},${76 - 24 + i * 3.4} ${60 + i * 20},${72 - 24 + i * 3.4} ${64 + i * 20},${74 - 24 + i * 3.4} ${56 + i * 20},${78 - 24 + i * 3.4}" fill="#b88a28" opacity="0.5"/>`;
  body += scanlines();
  const exile = await sprite(path.join(V2, 'player.png'), 0);
  const figure = await scaled(exile, 3);
  return finish(
    svg(body),
    [{ input: figure, left: 192, top: 50 }],
    [{ x: 240, y: 152, r: 190, color: 'rgb(60,180,210)', a: 0.55 }],
    0.8,
  );
}

async function descentCells() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#06080a"/>`;
  body += `<polygon points="0,0 120,50 120,80 0,135" fill="#10171a"/>`;
  body += `<polygon points="${LOW_W},0 120,50 120,80 ${LOW_W},135" fill="#0c1215"/>`;
  body += `<polygon points="0,135 120,80 ${LOW_W},135" fill="#0a0f12"/>`;
  body += `<polygon points="0,0 120,50 ${LOW_W},0" fill="#080c0e"/>`;
  for (let i = 0; i < 4; i += 1) {
    const t = i / 4;
    const x0 = 8 + t * 82;
    const x1 = x0 + 18 * (1 - t * 0.6);
    const y0 = 14 + t * 30;
    const y1 = 118 - t * 30;
    body += `<polygon points="${x0},${y0 + 8} ${x1},${y0 + 14} ${x1},${y1 - 6} ${x0},${y1}" fill="#05080a" stroke="#2a3438" stroke-width="0.8"/>`;
    for (let b = 1; b < 5; b += 1) body += `<line x1="${x0 + (x1 - x0) * (b / 5)}" y1="${y0 + 8 + 6 * (b / 5)}" x2="${x0 + (x1 - x0) * (b / 5)}" y2="${y1 - 6 * (1 - b / 5)}" stroke="#3a4448" stroke-width="0.6"/>`;
    body += `<rect x="${130 + i * 24}" y="${4 + i * 6}" width="${14 - i * 3}" height="2" fill="#c8281a"/>`;
  }
  body += scanlines();
  const exile = await sprite(path.join(V2, 'player.png'), 1);
  const figure = await scaled(exile, 2);
  return finish(
    svg(body),
    [{ input: figure, left: 290, top: 150 }],
    [
      { x: 300, y: 20, r: 220, color: 'rgb(255,40,24)', a: 0.45 },
      { x: 130, y: 60, r: 120, color: 'rgb(255,40,24)', a: 0.3 },
    ],
    0.8,
  );
}

async function descentDrill() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#07080a"/>`;
  body += `<rect y="100" width="${LOW_W}" height="35" fill="#14110e"/>`;
  const cx = 150;
  const cy = 62;
  body += `<circle cx="${cx}" cy="${cy}" r="44" fill="#1a1f22" stroke="#050607" stroke-width="2"/>`;
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    body += `<polygon points="${cx + Math.cos(a) * 44},${cy + Math.sin(a) * 44} ${cx + Math.cos(a + 0.1) * 54},${cy + Math.sin(a + 0.1) * 54} ${cx + Math.cos(a + 0.2) * 44},${cy + Math.sin(a + 0.2) * 44}" fill="#2a3135"/>`;
  }
  body += `<circle cx="${cx}" cy="${cy}" r="30" fill="#262d31" stroke="#050607"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="14" fill="#10151a"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="6" fill="#d9a441"/>`;
  for (let i = 0; i < 6; i += 1) body += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(i * 1.05) * 40}" y2="${cy + Math.sin(i * 1.05) * 40}" stroke="#05080a" stroke-width="1.4"/>`;
  body += `<rect x="0" y="90" width="110" height="8" fill="#22292d" stroke="#050607"/>`;
  for (let i = 0; i < 8; i += 1) body += `<rect x="${i * 14}" y="90" width="2" height="8" fill="#b88a28" opacity="0.7"/>`;
  for (let i = 0; i < 14; i += 1) body += `<rect x="${60 + (i * 37) % 100}" y="${70 + (i * 23) % 40}" width="1.6" height="1.6" fill="#ff9a3a"/>`;
  body += scanlines();
  return finish(
    svg(body),
    [],
    [
      { x: 300, y: 124, r: 190, color: 'rgb(255,150,60)', a: 0.5 },
      { x: 150, y: 220, r: 110, color: 'rgb(255,120,40)', a: 0.3 },
    ],
    0.8,
  );
}

async function descentInfirmary() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#050809"/>`;
  body += `<polygon points="0,0 120,52 120,84 0,135" fill="#0c1618"/>`;
  body += `<polygon points="${LOW_W},0 120,52 120,84 ${LOW_W},135" fill="#0a1214"/>`;
  body += `<polygon points="0,135 120,84 ${LOW_W},135" fill="#10201f"/>`;
  body += `<polygon points="0,0 120,52 ${LOW_W},0" fill="#070d0e"/>`;
  for (let i = 0; i < 5; i += 1) {
    const t = i / 5;
    const x = 6 + t * 84;
    const size = 1 - t * 0.7;
    const top = 70 + t * 22;
    body += `<polygon points="${x},${top} ${x + 46 * size},${top + 12 * size} ${x + 46 * size},${top + 24 * size} ${x},${top + 12 * size}" fill="#cfe0e0"/>`;
    body += `<polygon points="${x},${top + 12 * size} ${x + 46 * size},${top + 24 * size} ${x + 46 * size},${top + 34 * size} ${x},${top + 22 * size}" fill="#6a8c92"/>`;
    body += `<rect x="${x + 2}" y="${top + 2}" width="${10 * size}" height="${5 * size}" fill="#f2fafa"/>`;
    body += `<rect x="${130 + i * 20}" y="${4 + i * 5}" width="${16 - i * 3}" height="2" fill="#8fe8ee"/>`;
  }
  body += scanlines();
  return finish(svg(body), [], [
    { x: 300, y: 30, r: 230, color: 'rgb(120,230,240)', a: 0.4 },
    { x: 120, y: 180, r: 140, color: 'rgb(90,200,220)', a: 0.25 },
  ], 0.8);
}

async function descentPump() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#06060c"/>`;
  body += `<rect y="86" width="${LOW_W}" height="49" fill="#0e0c1c"/>`;
  for (let i = 0; i < 6; i += 1) {
    const y = 90 + i * 8;
    body += `<line x1="0" y1="${y}" x2="${LOW_W}" y2="${y}" stroke="#4a3a8a" stroke-width="0.6" opacity="${0.6 - i * 0.07}" stroke-dasharray="${6 + i * 2} ${4 + i}"/>`;
  }
  body += `<rect x="0" y="22" width="${LOW_W}" height="14" fill="#1b2236" stroke="#05060c"/>`;
  body += `<rect x="0" y="44" width="${LOW_W}" height="10" fill="#161c2c" stroke="#05060c"/>`;
  for (let i = 0; i < 6; i += 1) body += `<rect x="${12 + i * 42}" y="20" width="4" height="18" fill="#2a3452"/>`;
  const cx = 150;
  const cy = 62;
  body += `<circle cx="${cx}" cy="${cy}" r="24" fill="none" stroke="#6a52c8" stroke-width="4"/>`;
  for (let i = 0; i < 4; i += 1) body += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(i * 1.57) * 24}" y2="${cy + Math.sin(i * 1.57) * 24}" stroke="#6a52c8" stroke-width="2"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="4" fill="#150f2a"/>`;
  for (let i = 0; i < 9; i += 1) body += `<rect x="${20 + (i * 53) % 200}" y="${38 + (i * 17) % 40}" width="1.2" height="3" fill="#9a88ee" opacity="0.8"/>`;
  body += scanlines();
  return finish(svg(body), [], [
    { x: 300, y: 120, r: 200, color: 'rgb(130,100,255)', a: 0.45 },
    { x: 150, y: 220, r: 140, color: 'rgb(110,90,230)', a: 0.3 },
  ], 0.8);
}

async function descentFoundry() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#080505"/>`;
  body += `<rect y="104" width="${LOW_W}" height="31" fill="#140c0a"/>`;
  body += `<polygon points="70,22 170,22 184,104 56,104" fill="#2a1814" stroke="#050303" stroke-width="1.6"/>`;
  body += `<polygon points="84,40 156,40 166,104 74,104" fill="#ff6a1a"/>`;
  body += `<polygon points="96,56 144,56 150,104 90,104" fill="#ffb040"/>`;
  body += `<polygon points="108,74 132,74 134,104 106,104" fill="#fff0b0"/>`;
  for (let i = 0; i < 6; i += 1) body += `<rect x="${24 + i * 4}" y="${10 + i * 12}" width="2" height="${60 - i * 8}" fill="#1a0f0c"/>`;
  body += `<line x1="30" y1="0" x2="30" y2="48" stroke="#2a1d18" stroke-width="2"/>`;
  body += `<polygon points="22,48 38,48 34,62 26,62" fill="#3a2418"/>`;
  for (let i = 0; i < 26; i += 1) body += `<rect x="${80 + (i * 47) % 90}" y="${10 + (i * 29) % 80}" width="1.4" height="1.4" fill="#ffc060"/>`;
  body += scanlines();
  return finish(svg(body), [], [
    { x: 240, y: 100, r: 260, color: 'rgb(255,130,40)', a: 0.6 },
    { x: 240, y: 200, r: 160, color: 'rgb(255,90,20)', a: 0.4 },
  ], 0.8);
}

async function descentArchive() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#040806"/>`;
  body += `<polygon points="0,135 120,76 ${LOW_W},135" fill="#0a1612"/>`;
  const spines = ['#3a6a5a', '#8a4a3a', '#a89a50', '#4a6a7a'];
  for (let side = 0; side < 2; side += 1) {
    for (let i = 0; i < 5; i += 1) {
      const t = i / 5;
      const x = side === 0 ? 4 + t * 78 : LOW_W - 4 - t * 78 - 30 * (1 - t * 0.6);
      const w = 30 * (1 - t * 0.6);
      const top = 12 + t * 26;
      const bottom = 124 - t * 30;
      body += `<rect x="${x}" y="${top}" width="${w}" height="${bottom - top}" fill="#0c1814" stroke="#1e3a32" stroke-width="0.8"/>`;
      for (let r = 0; r < 5; r += 1) {
        const y = top + 4 + r * ((bottom - top - 8) / 5);
        body += `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="#1e3a32" stroke-width="0.6"/>`;
        for (let k = 0; k < 6; k += 1) body += `<rect x="${x + 2 + k * (w / 6.6)}" y="${y - 6 * (1 - t * 0.4)}" width="${w / 9}" height="${5.5 * (1 - t * 0.4)}" fill="${spines[(i + k + r) % 4]}" opacity="0.8"/>`;
      }
    }
  }
  body += `<rect x="108" y="58" width="26" height="20" fill="#06100c" stroke="#2a5a4a"/>`;
  body += `<rect x="111" y="61" width="20" height="14" fill="#2ee8a0"/>`;
  for (let i = 0; i < 4; i += 1) body += `<line x1="113" y1="${64 + i * 3}" x2="${126 - (i % 2) * 4}" y2="${64 + i * 3}" stroke="#06100c" stroke-width="0.8"/>`;
  body += scanlines();
  return finish(svg(body), [], [
    { x: 250, y: 150, r: 200, color: 'rgb(60,240,170)', a: 0.42 },
    { x: 100, y: 120, r: 120, color: 'rgb(40,200,150)', a: 0.2 },
  ], 0.82);
}

async function descentPower() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#04050a"/>`;
  body += `<rect y="108" width="${LOW_W}" height="27" fill="#0a0c14"/>`;
  body += `<polygon points="84,40 156,40 164,108 76,108" fill="#10151f" stroke="#04050a" stroke-width="1.6"/>`;
  for (let i = 0; i < 3; i += 1) {
    const x = 96 + i * 24;
    body += `<rect x="${x}" y="22" width="8" height="18" fill="#d8c040"/>`;
    body += `<rect x="${x - 2}" y="20" width="12" height="3" fill="#f4e480"/>`;
  }
  const arcs = [[100, 22, 40, 6], [124, 22, 120, 4], [148, 22, 196, 10]];
  for (const [x, y, ex, ey] of arcs) {
    let pts = `${x},${y}`;
    for (let k = 1; k < 7; k += 1) pts += ` ${x + (ex - x) * (k / 7) + ((k * 13) % 9 - 4)},${y + (ey - y) * (k / 7) + ((k * 7) % 9 - 4)}`;
    body += `<polyline points="${pts} ${ex},${ey}" fill="none" stroke="#9ac8ff" stroke-width="1.2"/>`;
    body += `<polyline points="${pts} ${ex},${ey}" fill="none" stroke="#e8f4ff" stroke-width="0.5"/>`;
  }
  for (let i = 0; i < 5; i += 1) body += `<rect x="${92 + i * 12}" y="${70 + (i % 2) * 10}" width="5" height="12" fill="#1c2436"/>`;
  body += `<rect x="86" y="96" width="68" height="4" fill="#d8c040" opacity="0.7"/>`;
  body += scanlines();
  return finish(svg(body), [], [
    { x: 240, y: 60, r: 240, color: 'rgb(110,160,255)', a: 0.5 },
    { x: 240, y: 200, r: 130, color: 'rgb(220,200,80)', a: 0.2 },
  ], 0.82);
}

async function descentDroneFoundry() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#070705"/>`;
  body += `<polygon points="0,135 60,78 ${LOW_W},70 ${LOW_W},135" fill="#14140e"/>`;
  body += `<polygon points="0,106 ${LOW_W},62 ${LOW_W},78 0,122" fill="#2a2a22" stroke="#050503"/>`;
  for (let i = 0; i < 8; i += 1) body += `<rect x="${i * 30}" y="${106 - i * 5.4}" width="14" height="4" fill="#d6a820" opacity="0.65"/>`;
  for (let i = 0; i < 5; i += 1) {
    const x = 30 + i * 42;
    const y = 96 - i * 8;
    const r = 11 - i * 0.9;
    body += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.7}" fill="${i < 3 ? '#4a5254' : '#2a3032'}" stroke="#050503"/>`;
    if (i >= 3) body += `<ellipse cx="${x + r * 0.25}" cy="${y - 1}" rx="${r * 0.25}" ry="${r * 0.2}" fill="#f0a830"/>`;
  }
  body += `<line x1="150" y1="0" x2="150" y2="44" stroke="#3a3a30" stroke-width="3"/>`;
  body += `<polygon points="138,44 162,44 156,62 144,62" fill="#4a4a3e" stroke="#050503"/>`;
  body += `<rect x="146" y="62" width="8" height="12" fill="#f4c430"/>`;
  for (let i = 0; i < 12; i += 1) body += `<rect x="${140 + (i * 7) % 22}" y="${72 + (i * 5) % 20}" width="1.3" height="1.3" fill="#ffd060"/>`;
  body += scanlines();
  return finish(svg(body), [], [
    { x: 300, y: 70, r: 230, color: 'rgb(255,210,70)', a: 0.45 },
    { x: 100, y: 190, r: 130, color: 'rgb(220,170,40)', a: 0.25 },
  ], 0.8);
}

async function descentComms() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#04070c"/>`;
  body += `<rect y="106" width="${LOW_W}" height="29" fill="#0a0e16"/>`;
  body += `<rect x="30" y="16" width="90" height="82" fill="#0a1018" stroke="#1e3248"/>`;
  for (let i = 0; i < 10; i += 1) {
    const y = 24 + i * 7;
    body += `<line x1="38" y1="${y}" x2="${60 + ((i * 17) % 40)}" y2="${y}" stroke="#7ac8f0" stroke-width="1.2"/>`;
  }
  body += `<line x1="38" y1="94" x2="80" y2="94" stroke="#3a4a5a" stroke-width="1.2" stroke-dasharray="2 2"/>`;
  body += `<circle cx="180" cy="70" r="32" fill="none" stroke="#5a7898" stroke-width="3"/>`;
  body += `<ellipse cx="180" cy="70" rx="32" ry="10" fill="#101a26" stroke="#5a7898" stroke-width="1.4" transform="rotate(-24 180 70)"/>`;
  body += `<line x1="180" y1="70" x2="196" y2="34" stroke="#8aa8c8" stroke-width="2"/>`;
  body += `<circle cx="196" cy="33" r="2.4" fill="#e03a30"/>`;
  body += `<line x1="180" y1="70" x2="180" y2="108" stroke="#3a4a5c" stroke-width="5"/>`;
  for (let i = 0; i < 18; i += 1) body += `<rect x="${130 + (i * 19) % 100}" y="${14 + (i * 31) % 80}" width="1.2" height="1.2" fill="#a8d8ff" opacity="0.7"/>`;
  body += scanlines();
  return finish(svg(body), [], [
    { x: 150, y: 120, r: 220, color: 'rgb(100,170,240)', a: 0.42 },
    { x: 400, y: 120, r: 140, color: 'rgb(90,150,220)', a: 0.3 },
  ], 0.8);
}

function coreScene(options) {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#050407"/>`;
  const cx = 120;
  const cy = 46;
  for (let i = 0; i < 6; i += 1) {
    const rx = 46 + i * 12;
    body += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.28}" fill="none" stroke="${options.ring}" stroke-width="${0.8 + (i % 2) * 0.6}" opacity="${0.8 - i * 0.1}"/>`;
  }
  body += `<circle cx="${cx}" cy="${cy}" r="28" fill="url(#core)"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="9" fill="${options.pupil}"/>`;
  if (options.crack) {
    body += `<polyline points="${cx - 22},${cy - 18} ${cx - 8},${cy - 4} ${cx - 14},${cy + 6} ${cx + 4},${cy + 14} ${cx},${cy + 26}" fill="none" stroke="#050407" stroke-width="2"/>`;
    for (let i = 0; i < 12; i += 1) body += `<rect x="${cx - 40 + ((i * 23) % 80)}" y="${cy - 20 + ((i * 17) % 60)}" width="1.6" height="1.6" fill="#ff7a3a"/>`;
  }
  for (let i = 0; i < 7; i += 1) {
    body += `<path d="M ${20 + i * 33} ${LOW_H} Q ${50 + i * 24} ${90} ${cx} ${cy + 20}" fill="none" stroke="#10161a" stroke-width="2"/>`;
  }
  body += `<polygon points="${cx - 8},${cy + 28} ${cx + 8},${cy + 28} ${cx + 46},${LOW_H} ${cx - 46},${LOW_H}" fill="${options.beam}" opacity="0.16"/>`;
  if (options.extra) body += options.extra;
  body += scanlines();
  const defs = radial('core', cx, cy, 28, [[0, options.center, 1], [0.6, options.mid, 1], [1, options.edge, 1]]);
  return { body, defs };
}

async function descentCore() {
  const scene = coreScene({ ring: '#7a1c14', pupil: '#ffffff', center: '#fff2e0', mid: '#e0382a', edge: '#4a0c08', beam: '#c8281a', crack: false });
  const exile = await sprite(path.join(V2, 'player.png'), 0);
  const figure = await scaled(exile, 2);
  return finish(
    svg(scene.body, scene.defs),
    [{ input: figure, left: 224, top: 168 }],
    [
      { x: 240, y: 92, r: 260, color: 'rgb(255,50,30)', a: 0.5 },
      { x: 240, y: 92, r: 70, color: 'rgb(255,220,180)', a: 0.5 },
    ],
    0.8,
  );
}

async function endComply() {
  let marks = '';
  for (let i = 0; i < 10; i += 1) marks += `<rect x="${58 + i * 12.5}" y="7" width="1.4" height="9" fill="#6a5a4a"/>`;
  marks += `<path d="M171,16 q3,-8 6,0" fill="none" stroke="#d9a441" stroke-width="1.3"/>`;
  const scene = coreScene({ ring: '#3a3a3e', pupil: '#7a4a2a', center: '#5a3a2a', mid: '#2a1a18', edge: '#0e0a0a', beam: '#8a7a5a', crack: false, extra: marks });
  const exile = await sprite(path.join(V2, 'player.png'), 0);
  const figure = await scaled(exile, 2.4);
  return finish(
    svg(scene.body, scene.defs),
    [{ input: figure, left: 214, top: 146 }],
    [
      { x: 240, y: 92, r: 220, color: 'rgb(200,150,90)', a: 0.3 },
      { x: 240, y: 200, r: 80, color: 'rgb(217,164,65)', a: 0.3 },
    ],
    0.82,
  );
}

async function endDefy() {
  const shaft = `<polygon points="${105},0 ${135},0 ${160},${LOW_H} ${80},${LOW_H}" fill="#cfe0f0" opacity="0.14"/>`;
  const scene = coreScene({ ring: '#3a2a28', pupil: '#120a0a', center: '#2a1a18', mid: '#1a0e0c', edge: '#0a0606', beam: '#cfe0f0', crack: true, extra: shaft });
  const aim = await sharp(path.join(V2, 'player_aim.png'))
    .extract({ left: 1 * 32, top: 0, width: 32, height: 48 })
    .png()
    .toBuffer();
  const figure = await scaled(aim, 2.4);
  return finish(
    svg(scene.body, scene.defs),
    [{ input: figure, left: 214, top: 146 }],
    [
      { x: 240, y: 0, r: 320, color: 'rgb(190,215,240)', a: 0.5 },
      { x: 250, y: 160, r: 60, color: 'rgb(255,240,200)', a: 0.3 },
    ],
    0.8,
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(PREVIEW, { recursive: true });
  void DIRS;
  const panels = {
    intro_1: await introShaft(),
    intro_2: await introNames(),
    intro_3: await introHatch(),
    intro_4: await introEye(),
    descent_b2: await descentCells(),
    descent_b3: await descentDrill(),
    descent_b4: await descentCore(),
    descent_infirmary: await descentInfirmary(),
    descent_pump: await descentPump(),
    descent_foundry: await descentFoundry(),
    descent_archive: await descentArchive(),
    descent_power: await descentPower(),
    descent_dronefoundry: await descentDroneFoundry(),
    descent_comms: await descentComms(),
    end_comply: await endComply(),
    end_defy: await endDefy(),
  };
  for (const [name, buffer] of Object.entries(panels)) {
    await writeFile(path.join(OUT, `${name}.png`), buffer);
  }

  const names = Object.keys(panels);
  const cols = 3;
  const rows = Math.ceil(names.length / cols);
  const sheet = await sharp({
    create: { width: cols * W, height: rows * H, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } },
  })
    .composite(names.map((name, index) => ({ input: panels[name], left: (index % cols) * W, top: Math.floor(index / cols) * H })))
    .png()
    .toBuffer();
  await writeFile(path.join(PREVIEW, 'contact.png'), sheet);
  console.log(`cutscene art written: ${names.length} panels`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
