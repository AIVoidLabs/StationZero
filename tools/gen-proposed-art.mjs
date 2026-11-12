import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const RUNTIME = path.join(ROOT, 'assets', 'art', 'runtime');
const WALK_SOURCE = path.join(ROOT, 'art-source', 'entities', 'walk', 'Hooded Wanderer Walking Sprite Sheet.png');
const OUT = path.join(ROOT, 'art-preview', 'proposed');

const W = 32;
const H = 48;
const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const WALK_FRAMES = 4;
const BG_TOLERANCE = 20;
const TOP_INSET = 2;

const COLOR = {
  sleeve: [46, 58, 61, 255],
  sleeveLight: [70, 89, 92, 255],
  glove: [20, 24, 26, 255],
  gun: [20, 24, 26, 255],
  slide: [111, 128, 127, 255],
  flashHot: [255, 244, 210, 255],
  flashWarm: [217, 164, 65, 255],
};

async function loadRaw(file) {
  const { data, info } = await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Buffer.from(data), width: info.width, height: info.height };
}

function toPng(image) {
  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } }).png().toBuffer();
}

function blank(width, height) {
  return { data: Buffer.alloc(width * height * 4), width, height };
}

function crop(image, left, top, width, height) {
  const out = blank(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = left + x;
      const sy = top + y;
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
      image.data.copy(out.data, (y * width + x) * 4, (sy * image.width + sx) * 4, (sy * image.width + sx) * 4 + 4);
    }
  }
  return out;
}

function blit(dest, src, ox, oy) {
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const dx = x + ox;
      const dy = y + oy;
      if (dx < 0 || dy < 0 || dx >= dest.width || dy >= dest.height) continue;
      const i = (y * src.width + x) * 4;
      if (src.data[i + 3] === 0) continue;
      src.data.copy(dest.data, (dy * dest.width + dx) * 4, i, i + 4);
    }
  }
}

function setPixel(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const i = (y * image.width + x) * 4;
  image.data[i] = color[0];
  image.data[i + 1] = color[1];
  image.data[i + 2] = color[2];
  image.data[i + 3] = color[3];
}

function line(image, x0, y0, x1, y1, color) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    setPixel(image, x, y, color);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function flipX(image) {
  const out = blank(image.width, image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      image.data.copy(out.data, (y * image.width + (image.width - 1 - x)) * 4, (y * image.width + x) * 4, (y * image.width + x) * 4 + 4);
    }
  }
  return out;
}

// shoulder (arm root) and aimed barrel tip per facing, in 32x48 frame pixels. W/SW/NW mirror E/SE/NE.
const AIM_RIG = {
  N: { shoulder: [21, 22], hand: [22, 18], tip: [23, 14], gunLen: 3, hidden: true },
  NE: { shoulder: [22, 22], hand: [25, 20], tip: [30, 16], gunLen: 4 },
  E: { shoulder: [19, 23], hand: [23, 25], tip: [30, 25], gunLen: 5 },
  SE: { shoulder: [21, 23], hand: [24, 27], tip: [30, 31], gunLen: 5 },
  S: { shoulder: [21, 23], hand: [21, 29], tip: [21, 35], gunLen: 4 },
};
const MIRROR = { SW: 'SE', W: 'E', NW: 'NE' };

function rigFor(direction) {
  const mirrored = MIRROR[direction];
  return { rig: AIM_RIG[mirrored ?? direction], mirrored: Boolean(mirrored) };
}

function drawAimLayer(direction, phase) {
  const { rig, mirrored } = rigFor(direction);
  const layer = blank(W, H);
  const reach = phase === 'raise' ? 0.6 : 1;
  const recoil = phase === 'fire' ? 1 : 0;
  const [sx, sy] = rig.shoulder;
  const [hx, hy] = rig.hand;
  const [tx, ty] = rig.tip;
  const dirX = Math.sign(tx - hx);
  const dirY = Math.sign(ty - hy);

  const handX = sx + (hx - sx) * reach - dirX * recoil;
  const handY = sy + (hy - sy) * reach - dirY * recoil;

  line(layer, sx, sy, handX, handY, COLOR.sleeve);
  line(layer, sx, sy - 1, handX, handY - 1, COLOR.sleeveLight);
  setPixel(layer, Math.round(handX), Math.round(handY), COLOR.glove);

  const gunX = handX + (tx - hx) * 0.0;
  const gunY = handY;
  const endX = gunX + dirX * rig.gunLen * reach;
  const endY = gunY + dirY * rig.gunLen * reach;
  line(layer, gunX, gunY, endX, endY, COLOR.gun);
  line(layer, gunX, gunY - 1, endX, endY - 1, COLOR.slide);

  if (phase === 'fire') {
    const fx = Math.round(endX + dirX);
    const fy = Math.round(endY + dirY);
    setPixel(layer, fx, fy, COLOR.flashHot);
    setPixel(layer, fx + dirX, fy + dirY, COLOR.flashWarm);
    setPixel(layer, fx, fy - 1, COLOR.flashWarm);
    setPixel(layer, fx, fy + 1, COLOR.flashWarm);
  }

  return mirrored ? flipX(layer) : layer;
}

function aimFrames(idle, direction) {
  const base = crop(idle, DIRS.indexOf(direction) * W, 0, W, H);
  const behindBody = direction === 'N' || direction === 'NE' || direction === 'NW';
  const frames = [];
  for (const phase of ['raise', 'fire', 'lower']) {
    const frame = blank(W, H);
    const layer = drawAimLayer(direction, phase === 'lower' ? 'raise' : phase);
    if (behindBody) {
      blit(frame, layer, 0, 0);
      blit(frame, base, 0, 0);
    } else {
      blit(frame, base, 0, 0);
      blit(frame, layer, 0, 0);
    }
    frames.push(frame);
  }
  return frames;
}

function overlayFrame(direction) {
  return drawAimLayer(direction, 'fire');
}

function floodKey(image) {
  const { data, width, height } = image;
  const bg = [data[0], data[1], data[2]];
  const count = width * height;
  const seen = new Uint8Array(count);
  const stack = [];
  const matches = (pixel) => {
    const i = pixel * 4;
    return (
      Math.abs(data[i] - bg[0]) <= BG_TOLERANCE &&
      Math.abs(data[i + 1] - bg[1]) <= BG_TOLERANCE &&
      Math.abs(data[i + 2] - bg[2]) <= BG_TOLERANCE
    );
  };
  const push = (pixel) => {
    if (seen[pixel] || !matches(pixel)) return;
    seen[pixel] = 1;
    stack.push(pixel);
  };
  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (stack.length > 0) {
    const pixel = stack.pop();
    const x = pixel % width;
    if (x > 0) push(pixel - 1);
    if (x < width - 1) push(pixel + 1);
    if (pixel >= width) push(pixel - width);
    if (pixel < count - width) push(pixel + width);
  }
  const out = blank(width, height);
  for (let pixel = 0; pixel < count; pixel += 1) {
    if (seen[pixel]) continue;
    data.copy(out.data, pixel * 4, pixel * 4, pixel * 4 + 3);
    out.data[pixel * 4 + 3] = 255;
  }
  return out;
}

function alphaBounds(image, left, top, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (image.data[((top + y) * image.width + left + x) * 4 + 3] <= 10) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return null;
  return { left: left + minX, top: top + minY, right: left + maxX + 1, bottom: top + maxY + 1 };
}

// Option A: one shared crop box and one scale per direction, so the four frames keep size and baseline.
async function buildStableWalk() {
  const raw = await loadRaw(WALK_SOURCE);
  const keyed = floodKey(raw);
  const cellW = keyed.width / 8;
  const cellH = keyed.height / WALK_FRAMES;
  const frames = [];

  for (let column = 0; column < 8; column += 1) {
    const boxes = [];
    for (let row = 0; row < WALK_FRAMES; row += 1) {
      const box = alphaBounds(keyed, column * cellW, row * cellH + TOP_INSET, cellW, cellH - TOP_INSET);
      if (!box) throw new Error(`empty walk frame ${column}/${row}`);
      boxes.push(box);
    }
    const left = Math.min(...boxes.map((b) => b.left));
    const right = Math.max(...boxes.map((b) => b.right));
    const height = Math.max(...boxes.map((b) => b.bottom - b.top));
    const scale = Math.min(W / (right - left), H / height);
    const outW = Math.max(1, Math.round((right - left) * scale));
    const outH = Math.max(1, Math.round(height * scale));
    const xOff = Math.floor((W - outW) / 2);

    for (let row = 0; row < WALK_FRAMES; row += 1) {
      const box = boxes[row];
      const bottom = box.bottom;
      const cropped = crop(keyed, left, bottom - height, right - left, height);
      const resized = await sharp(await toPng(cropped))
        .resize({ width: outW, height: outH, kernel: 'nearest' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const frame = blank(W, H);
      blit(frame, { data: resized.data, width: resized.info.width, height: resized.info.height }, xOff, H - outH);
      frames.push(frame);
    }
  }
  return frames;
}

// Option B: derive the cycle from the clean idle frame. Legs scissor, body bobs and sways.
function buildProceduralWalk(idle) {
  const frames = [];
  const hip = 31;
  const swing = [-1, 0, 1, 0];
  const bob = [0, -1, 0, -1];
  const sway = [0, 0, 0, 0];
  for (const direction of DIRS) {
    const base = crop(idle, DIRS.indexOf(direction) * W, 0, W, H);
    const upper = crop(base, 0, 0, W, hip);
    const lower = crop(base, 0, hip, W, H - hip);
    const legsLeft = crop(lower, 0, 0, W / 2, lower.height);
    const legsRight = crop(lower, W / 2, 0, W / 2, lower.height);
    for (let step = 0; step < WALK_FRAMES; step += 1) {
      const frame = blank(W, H);
      const lift = bob[step] ?? 0;
      const shift = swing[step] ?? 0;
      const planted = shift === 0;
      blit(frame, legsLeft, shift, hip + (planted ? 0 : shift > 0 ? -1 : 0));
      blit(frame, legsRight, W / 2 - shift, hip + (planted ? 0 : shift > 0 ? 0 : -1));
      blit(frame, upper, sway[step] ?? 0, lift);
      frames.push(frame);
    }
  }
  return frames;
}

async function packSheet(frames, columns, scale = 1) {
  const rows = Math.ceil(frames.length / columns);
  const sheet = blank(columns * W, rows * H);
  frames.forEach((frame, index) => {
    blit(sheet, frame, (index % columns) * W, Math.floor(index / columns) * H);
  });
  const png = await toPng(sheet);
  if (scale === 1) return png;
  return sharp(png).resize({ width: sheet.width * scale, kernel: 'nearest' }).png().toBuffer();
}

async function labeled(rows, scale, labels) {
  const cellW = W * scale;
  const cellH = H * scale;
  const labelW = 150;
  const maxCols = Math.max(...rows.map((r) => r.length));
  const width = labelW + maxCols * cellW;
  const height = rows.length * cellH;
  const composites = [];
  const svgParts = [];
  for (let r = 0; r < rows.length; r += 1) {
    svgParts.push(
      `<text x="8" y="${r * cellH + 24}" font-family="monospace" font-size="14" fill="#d9a441">${labels[r]}</text>`,
    );
    for (let c = 0; c < rows[r].length; c += 1) {
      const png = await sharp(await toPng(rows[r][c]))
        .resize({ width: cellW, height: cellH, kernel: 'nearest' })
        .png()
        .toBuffer();
      composites.push({ input: png, left: labelW + c * cellW, top: r * cellH });
    }
  }
  composites.push({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svgParts.join('')}</svg>`),
    left: 0,
    top: 0,
  });
  return sharp({
    create: { width, height, channels: 4, background: { r: 62, g: 62, b: 62, alpha: 1 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const idle = await loadRaw(path.join(RUNTIME, 'player.png'));
  const current = await loadRaw(path.join(RUNTIME, 'player_walk.png'));
  const currentFrames = Array.from({ length: 32 }, (_, i) => crop(current, i * W, 0, W, H));

  const walkA = await buildStableWalk();
  const walkB = buildProceduralWalk(idle);
  await writeFile(path.join(OUT, 'player_walk_A_stable-crop.png'), await packSheet(walkA, 32));
  await writeFile(path.join(OUT, 'player_walk_B_procedural.png'), await packSheet(walkB, 32));

  const idleFrames = DIRS.map((_, i) => crop(idle, i * W, 0, W, H));
  const aimFrameSets = DIRS.map((direction) => aimFrames(idle, direction));
  const overlays = DIRS.map((direction) => overlayFrame(direction));
  const overlayComposites = DIRS.map((direction, i) => {
    const frame = blank(W, H);
    const behindBody = direction === 'N' || direction === 'NE' || direction === 'NW';
    if (behindBody) {
      blit(frame, overlays[i], 0, 0);
      blit(frame, idleFrames[i], 0, 0);
    } else {
      blit(frame, idleFrames[i], 0, 0);
      blit(frame, overlays[i], 0, 0);
    }
    return frame;
  });

  await writeFile(path.join(OUT, 'player_aim_opt2_sheet.png'), await packSheet(aimFrameSets.flat(), 24));
  await writeFile(path.join(OUT, 'player_aim_opt1_overlay.png'), await packSheet(overlays, 8));

  const walkRows = [];
  const walkLabels = [];
  for (let d = 0; d < 8; d += 1) {
    walkRows.push(
      [
        ...currentFrames.slice(d * 4, d * 4 + 4),
        ...walkA.slice(d * 4, d * 4 + 4),
        ...walkB.slice(d * 4, d * 4 + 4),
      ],
    );
    walkLabels.push(`${DIRS[d]}: cur | A | B`);
  }
  await writeFile(path.join(OUT, 'compare-walk.png'), await labeled(walkRows, 4, walkLabels));

  const aimRows = DIRS.map((_, d) => [idleFrames[d], overlayComposites[d], ...aimFrameSets[d]]);
  await writeFile(
    path.join(OUT, 'compare-aim.png'),
    await labeled(aimRows, 5, DIRS.map((d) => `${d}: idle|opt1|opt2 r/f/l`)),
  );

  console.log('proposed art written to art-preview/proposed/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
