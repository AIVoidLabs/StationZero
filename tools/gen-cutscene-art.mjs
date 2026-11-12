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

async function introCell() {
  let body = `<rect width="${LOW_W}" height="${LOW_H}" fill="#07090b"/>`;
  body += `<rect x="0" y="0" width="${LOW_W}" height="86" fill="#141b1e"/>`;
  for (let x = 0; x < LOW_W; x += 40) body += `<rect x="${x}" y="0" width="1" height="86" fill="#0a0e10"/>`;
  body += `<polygon points="0,86 ${LOW_W},86 ${LOW_W},${LOW_H} 0,${LOW_H}" fill="#0e1417"/>`;
  for (let i = 0; i < 9; i += 1) body += `<rect x="${176 + i * 6}" y="0" width="1.4" height="86" fill="#2a3338"/>`;
  body += `<rect x="40" y="82" width="120" height="14" fill="#2b2a24"/>`;
  body += `<rect x="40" y="96" width="120" height="3" fill="#15130f"/>`;
  body += `<rect x="46" y="99" width="4" height="12" fill="#15130f"/><rect x="150" y="99" width="4" height="12" fill="#15130f"/>`;
  body += `<rect x="4" y="6" width="26" height="4" fill="#a02418"/>`;
  body += scanlines();
  const player = await sprite(path.join(V2, 'player.png'), 4);
  const lying = await scaled(player, 3.4, 90);
  return finish(
    svg(body),
    [{ input: lying, left: 118, top: 90 }],
    [
      { x: 34, y: 14, r: 150, color: 'rgb(255,50,30)', a: 0.5 },
      { x: 240, y: 150, r: 120, color: 'rgb(150,200,225)', a: 0.15 },
    ],
    0.78,
  );
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
  const scene = coreScene({ ring: '#4a6c7a', pupil: '#ffffff', center: '#ffffff', mid: '#9ad0e8', edge: '#1c3a48', beam: '#9ad0e8', crack: false });
  const exile = await sprite(path.join(V2, 'player.png'), 0);
  const figure = await scaled(exile, 2.4);
  return finish(
    svg(scene.body, scene.defs),
    [{ input: figure, left: 214, top: 146 }],
    [
      { x: 240, y: 92, r: 260, color: 'rgb(150,210,235)', a: 0.5 },
      { x: 240, y: 190, r: 90, color: 'rgb(200,235,255)', a: 0.4 },
    ],
    0.75,
  );
}

async function endDefy() {
  const scene = coreScene({ ring: '#7a2c14', pupil: '#ffcf8a', center: '#ffd9a0', mid: '#e05a2a', edge: '#4a1008', beam: '#ff7a3a', crack: true });
  const aim = await sharp(path.join(V2, 'player_aim.png'))
    .extract({ left: 1 * 32, top: 0, width: 32, height: 48 })
    .png()
    .toBuffer();
  const figure = await scaled(aim, 2.4);
  return finish(
    svg(scene.body, scene.defs),
    [{ input: figure, left: 214, top: 146 }],
    [
      { x: 240, y: 92, r: 260, color: 'rgb(255,110,50)', a: 0.5 },
      { x: 250, y: 160, r: 60, color: 'rgb(255,240,200)', a: 0.5 },
    ],
    0.78,
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(PREVIEW, { recursive: true });
  void DIRS;
  const panels = {
    intro_1: await introShaft(),
    intro_2: await introCell(),
    intro_3: await introEye(),
    intro_4: await introHatch(),
    descent_b2: await descentCells(),
    descent_b3: await descentDrill(),
    descent_b4: await descentCore(),
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
