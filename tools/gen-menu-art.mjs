import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const V2 = path.join(ROOT, 'assets', 'art', 'v2');
const OUT = path.join(V2, 'menu');
const PREVIEW = path.join(ROOT, 'art-preview', 'proposed', 'menu');

const TILE_W = 64;
const TILE_H = 32;
const WALL_H = 46;
const WALL_IMG_H = TILE_H + WALL_H;
const WALL_COLUMNS = 4;
const OUTLINE = [8, 10, 10, 255];

const GLYPHS = {
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed + 1, 2147483647)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

class Img {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3] ?? 255;
  }

  opaque(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.data[(y * this.width + x) * 4 + 3] > 0;
  }

  outline(color = OUTLINE) {
    const edge = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.opaque(x, y)) continue;
        if (this.opaque(x + 1, y) || this.opaque(x - 1, y) || this.opaque(x, y + 1) || this.opaque(x, y - 1)) edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.set(x, y, color);
  }

  async png(scale = 1) {
    let img = sharp(Buffer.from(this.data), { raw: { width: this.width, height: this.height, channels: 4 } });
    if (scale > 1) img = img.resize({ width: this.width * scale, kernel: 'nearest' });
    return img.png().toBuffer();
  }
}

async function title() {
  const text = 'STATION ZERO';
  const scale = 4;
  const gap = 4;
  const letterW = 5 * scale;
  const letterH = 7 * scale;
  const width = text.length * (letterW + gap) - gap + 12;
  const stripeH = 8;
  const height = letterH + stripeH * 2 + 14;
  const img = new Img(width, height);

  const stripe = (top) => {
    for (let y = 0; y < stripeH; y += 1) {
      for (let x = 0; x < width; x += 1) {
        img.set(x, top + y, Math.floor((x + y) / 5) % 2 === 0 ? [190, 138, 40, 255] : [26, 28, 28, 255]);
      }
    }
  };
  stripe(0);
  stripe(height - stripeH);

  let cursor = 6;
  for (const ch of text) {
    if (ch === ' ') {
      cursor += letterW + gap;
      continue;
    }
    const glyph = GLYPHS[ch];
    for (let gy = 0; gy < 7; gy += 1) {
      for (let gx = 0; gx < 5; gx += 1) {
        if (glyph[gy][gx] !== '#') continue;
        for (let py = 0; py < scale; py += 1) {
          for (let px = 0; px < scale; px += 1) {
            const x = cursor + gx * scale + px;
            const y = stripeH + 7 + gy * scale + py;
            let shade = [201, 196, 180, 255];
            if (py === 0 || px === 0) shade = [232, 226, 206, 255];
            if (py === scale - 1 || px === scale - 1) shade = [140, 132, 114, 255];
            if (hash(x, y, 3) > 0.9) shade = [124, 70, 48, 255];
            img.set(x, y, shade);
          }
        }
      }
    }
    cursor += letterW + gap;
  }
  img.outline();
  return img;
}

async function extractFrame(file, left, top, width, height) {
  return sharp(file).extract({ left, top, width, height }).png().toBuffer();
}

function iso(gx, gy, ox, oy) {
  return { x: (gx - gy) * (TILE_W / 2) + ox, y: (gx + gy) * (TILE_H / 2) + oy };
}

function glowSvg(width, height, stops) {
  const defs = stops
    .map(
      (s, i) =>
        `<radialGradient id="g${i}" cx="${s.x}" cy="${s.y}" r="${s.r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${s.color}" stop-opacity="${s.a}"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></radialGradient>`,
    )
    .join('');
  const rects = stops.map((_, i) => `<rect width="${width}" height="${height}" fill="url(#g${i})"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${defs}</defs>${rects}</svg>`);
}

function darknessSvg(width, height, lights, ambient) {
  const holes = lights
    .map(
      (l, i) =>
        `<radialGradient id="h${i}" cx="${l.x}" cy="${l.y}" r="${l.r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity="1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`,
    )
    .join('');
  const masks = lights.map((_, i) => `<rect width="${width}" height="${height}" fill="url(#h${i})"/>`).join('');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${holes}<mask id="m"><rect width="${width}" height="${height}" fill="#fff"/>${masks}</mask></defs><rect width="${width}" height="${height}" fill="rgb(2,3,4)" opacity="${ambient}" mask="url(#m)"/></svg>`,
  );
}

async function menuBackground() {
  const width = 480;
  const height = 270;
  const tiles = path.join(V2, 'tiles.png');
  const doorClosed = path.join(V2, 'door_closed.png');
  const playerSheet = path.join(V2, 'player.png');

  const floorFrame = await extractFrame(tiles, 0, 0, TILE_W, TILE_H);
  const floorAlt = await extractFrame(tiles, TILE_W, 0, TILE_W, TILE_H);
  const wallFrames = [];
  for (let variant = 0; variant < 8; variant += 1) {
    wallFrames.push(
      await extractFrame(
        tiles,
        (variant % WALL_COLUMNS) * TILE_W,
        TILE_H + Math.floor(variant / WALL_COLUMNS) * WALL_IMG_H,
        TILE_W,
        WALL_IMG_H,
      ),
    );
  }
  const door = await sharp(doorClosed).png().toBuffer();

  const ox = 300;
  const oy = 52;
  const composites = [];
  const length = 9;

  for (let gy = length; gy >= 0; gy -= 1) {
    const centre = iso(0, gy, ox, oy);
    if (gy === 0) {
      composites.push({ input: door, left: centre.x - 32, top: centre.y - 16 });
    } else {
      composites.push({ input: gy % 3 === 0 ? floorAlt : floorFrame, left: centre.x - 32, top: centre.y - 16 });
    }
  }

  const rhythm = [0, 2, 1, 0, 3, 1, 0, 2, 4, 0];
  const walls = [];
  for (let gy = -1; gy <= length; gy += 1) {
    for (const gx of [-1, 1]) {
      if (gx === 1) continue;
      const p = iso(gx, gy, ox, oy);
      const variant = gy === 0 ? 7 : rhythm[Math.abs(gy) % rhythm.length];
      walls.push({ input: wallFrames[variant], left: p.x - 32, top: p.y + 16 - WALL_IMG_H, depth: gx + gy });
    }
  }

  const player = await extractFrame(playerSheet, 32, 0, 32, 48);
  const playerAt = iso(0, 6, ox, oy);
  walls.push({ input: player, left: playerAt.x - 16, top: playerAt.y - 46, depth: 6 });
  walls.sort((a, b) => a.depth - b.depth);
  for (const item of walls) composites.push({ input: item.input, left: item.left, top: item.top });

  const base = await sharp({
    create: { width, height, channels: 4, background: { r: 8, g: 10, b: 11, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer();

  const doorPos = iso(0, 0, ox, oy);
  const lights = [
    { x: playerAt.x, y: playerAt.y - 20, r: 160 },
    { x: doorPos.x, y: doorPos.y, r: 150 },
  ];
  const withDark = await sharp(base)
    .composite([{ input: darknessSvg(width, height, lights, 0.86), blend: 'over' }])
    .png()
    .toBuffer();
  return sharp(withDark)
    .composite([
      {
        input: glowSvg(width, height, [
          { x: doorPos.x, y: doorPos.y, r: 110, color: 'rgb(255,48,30)', a: 0.45 },
          { x: playerAt.x, y: playerAt.y - 20, r: 90, color: 'rgb(255,190,110)', a: 0.28 },
        ]),
        blend: 'screen',
      },
    ])
    .png()
    .toBuffer();
}

async function endIllustration(kind) {
  const width = 320;
  const height = 180;
  const composites = [];
  let glow;
  let lights;
  if (kind === 'dead') {
    const wreck = await sharp(path.join(V2, 'drone_dead.png')).resize({ width: 120, kernel: 'nearest' }).png().toBuffer();
    composites.push({ input: wreck, left: 100, top: 14 });
    glow = [
      { x: 160, y: 95, r: 100, color: 'rgb(255,70,30)', a: 0.5 },
      { x: 135, y: 90, r: 40, color: 'rgb(255,150,60)', a: 0.4 },
    ];
    lights = [{ x: 160, y: 95, r: 140 }];
  } else {
    const door = await sharp(path.join(V2, 'door_open.png')).resize({ width: 192, kernel: 'nearest' }).png().toBuffer();
    const exile = await sharp(path.join(V2, 'player.png'))
      .extract({ left: 128, top: 0, width: 32, height: 48 })
      .resize({ width: 64, kernel: 'nearest' })
      .png()
      .toBuffer();
    composites.push({ input: door, left: 64, top: 84 }, { input: exile, left: 126, top: 36 });
    glow = [{ x: 160, y: 110, r: 110, color: 'rgb(60,180,210)', a: 0.5 }];
    lights = [{ x: 160, y: 110, r: 130 }];
  }
  const base = await sharp({
    create: { width, height, channels: 4, background: { r: 8, g: 10, b: 11, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
  const dark = await sharp(base)
    .composite([{ input: darknessSvg(width, height, lights, 0.9), blend: 'over' }])
    .png()
    .toBuffer();
  return sharp(dark)
    .composite([{ input: glowSvg(width, height, glow), blend: 'screen' }])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(PREVIEW, { recursive: true });

  const titleImage = await title();
  const files = {
    'title.png': await titleImage.png(),
    'menu_bg.png': await menuBackground(),
    'end_dead.png': await endIllustration('dead'),
    'end_survived.png': await endIllustration('survived'),
  };
  for (const [name, buffer] of Object.entries(files)) {
    await writeFile(path.join(OUT, name), buffer);
    await writeFile(path.join(PREVIEW, name), buffer);
  }
  console.log('menu art written to assets/art/v2/menu and art-preview/proposed/menu');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
