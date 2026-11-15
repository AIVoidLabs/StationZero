import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const FRAMES = path.resolve(process.argv[2] ?? 'art-preview/proposed/player_3d/frames');
const APPLY = process.argv.includes('--apply');
const OUT = path.join(process.cwd(), 'art-preview', 'proposed', 'player_3d');
const RUNTIME_V2 = path.join(process.cwd(), 'assets', 'art', 'v2');
const W = 64;
const H = 48;
const COVERAGE = 0.45;
const SHADOW_BELOW = 0.5;
const LIGHT_ABOVE = 0.92;
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const CLIPS = [
  { clip: 'idle', file: 'player.png', frames: 1 },
  { clip: 'walk', file: 'player_walk.png', frames: 6 },
  { clip: 'aim', file: 'player_aim.png', frames: 3 },
];

const OUTLINE = [8, 10, 10];
const FLASH_HOT = [255, 244, 210];
const FLASH_WARM = [217, 164, 65];
const REGIONS = [
  { name: 'suit', id: [255, 0, 0], color: [46, 58, 61] },
  { name: 'hood', id: [128, 0, 0], color: [38, 47, 50] },
  { name: 'pack', id: [0, 255, 0], color: [54, 68, 71], dim: true },
  { name: 'strap', id: [0, 128, 0], color: [31, 38, 41], claim: 0.35, seamless: true },
  { name: 'mask', id: [0, 0, 255], color: [111, 128, 127] },
  { name: 'boot', id: [255, 255, 0], color: [58, 56, 50], dim: true },
  { name: 'glove', id: [0, 255, 255], color: [20, 24, 26] },
  { name: 'gun', id: [255, 0, 255], color: [20, 24, 26] },
  { name: 'slide', id: [128, 0, 128], color: [111, 128, 127], claim: 0.3 },
  { name: 'lamp', id: [255, 128, 0], color: [217, 164, 65], claim: 0.2, flat: true },
  { name: 'flash', id: [255, 255, 255], color: FLASH_HOT, claim: 0.2, flat: true },
];
const FLASH = REGIONS.findIndex((r) => r.name === 'flash');

const level = (v) => (v < 64 ? 0 : v < 192 ? 1 : 2);
const idKey = (r, g, b) => level(r) * 9 + level(g) * 3 + level(b);
const REGION_BY_KEY = new Map(REGIONS.map((region, index) => [idKey(...region.id), index]));

function shade(color, band) {
  const k = band > 0 ? 1.4 : band < 0 ? 0.62 : 1;
  return color.map((c) => Math.max(0, Math.min(255, Math.round(c * k))));
}

async function raw(name) {
  return sharp(path.join(FRAMES, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

function pickRegion(counts, total) {
  let best = -1;
  for (let r = REGIONS.length - 1; r >= 0; r--) {
    const claim = REGIONS[r].claim;
    if (claim !== undefined && counts[r] >= total * claim) return r;
    if (best < 0 || counts[r] > counts[best]) best = r;
  }
  return best;
}

async function loadFrame(name) {
  const id = await raw(`${name}_id.png`);
  const light = await raw(`${name}_shade.png`);
  const scale = id.info.width / W;
  const cell = scale * scale;
  const out = new Uint8Array(W * H * 4);
  const solid = new Uint8Array(W * H);
  const regionAt = new Int8Array(W * H).fill(-1);
  const bandAt = new Int8Array(W * H);
  const counts = new Float64Array(REGIONS.length);
  const lumas = new Float64Array(REGIONS.length);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      counts.fill(0);
      lumas.fill(0);
      let opaque = 0;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const i = ((y * scale + sy) * id.info.width + x * scale + sx) * 4;
          if (id.data[i + 3] < 128) continue;
          const region = REGION_BY_KEY.get(idKey(id.data[i], id.data[i + 1], id.data[i + 2]));
          if (region === undefined) continue;
          opaque++;
          counts[region]++;
          lumas[region] += (light.data[i] * 0.3 + light.data[i + 1] * 0.59 + light.data[i + 2] * 0.11) / 255;
        }
      }
      if (opaque < cell * COVERAGE) continue;
      const r = pickRegion(counts, opaque);
      const region = REGIONS[r];
      const o = y * W + x;
      solid[o] = 1;
      if (r === FLASH) {
        out.set([...(counts[r] >= cell * 0.7 ? FLASH_HOT : FLASH_WARM), 255], o * 4);
      } else if (region.flat) {
        out.set([...region.color, 255], o * 4);
      } else {
        const luma = lumas[r] / counts[r];
        regionAt[o] = r;
        const band = luma < SHADOW_BELOW ? -1 : luma > LIGHT_ABOVE ? 1 : 0;
        bandAt[o] = region.dim ? Math.min(band, 0) : band;
      }
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      const r = regionAt[o];
      if (r < 0) continue;
      const above = y > 0 ? regionAt[o - W] : -1;
      const left = x > 0 ? regionAt[o - 1] : -1;
      const edge = (other) => other >= 0 && other !== r && !REGIONS[other].seamless && !REGIONS[r].seamless;
      const seam = edge(above) || edge(left);
      out.set([...shade(REGIONS[r].color, seam ? -1 : bandAt[o]), 255], o * 4);
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (solid[i]) continue;
      const touches =
        (x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W]);
      if (touches) out.set([...OUTLINE, 255], i * 4);
    }
  }
  return out;
}

function sheet(frames, columns) {
  const rows = Math.ceil(frames.length / columns);
  const data = new Uint8Array(columns * W * rows * H * 4);
  frames.forEach((frame, index) => {
    const ox = (index % columns) * W;
    const oy = Math.floor(index / columns) * H;
    for (let y = 0; y < H; y++) {
      data.set(frame.subarray(y * W * 4, (y + 1) * W * 4), ((oy + y) * columns * W + ox) * 4);
    }
  });
  return sharp(data, { raw: { width: columns * W, height: rows * H, channels: 4 } });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const all = [];
  for (const { clip, file, frames } of CLIPS) {
    const loaded = [];
    for (const direction of DIRECTIONS) {
      for (let i = 0; i < frames; i++) loaded.push(await loadFrame(`${clip}_${direction}_${i}`));
    }
    await writeFile(path.join(OUT, file), await sheet(loaded, loaded.length).png().toBuffer());
    all.push({ frames, loaded });
  }

  const perRow = all.reduce((sum, c) => sum + c.frames, 0);
  const rows = DIRECTIONS.flatMap((_, d) => all.flatMap((c) => c.loaded.slice(d * c.frames, (d + 1) * c.frames)));
  const compare = await sheet(rows, perRow)
    .png()
    .toBuffer()
    .then((buffer) =>
      sharp(buffer)
        .resize(perRow * W * 4, DIRECTIONS.length * H * 4, { kernel: 'nearest' })
        .flatten({ background: { r: 58, g: 58, b: 58 } })
        .png()
        .toBuffer(),
    );
  await writeFile(path.join(OUT, 'compare.png'), compare);

  if (APPLY) {
    for (const { file } of CLIPS) await copyFile(path.join(OUT, file), path.join(RUNTIME_V2, file));
  }
  console.log(`player_3d sheets written to ${OUT}${APPLY ? ' and applied to assets/art/v2' : ''}`);
}

await main();
