import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'art-source');
const OUT = path.join(ROOT, 'assets', 'art', 'runtime');
const PREVIEW = path.join(ROOT, 'art-preview');

const SOURCES = {
  props: path.join(SOURCE, 'props', 'Industrial Isometric Prop Sprite Sheet.png'),
  decals: path.join(SOURCE, 'decals', 'Isometric Industrial Stain and Scorch Decals.png'),
};

const PROP_FRAME = { width: 64, height: 96 };
const DECAL_FRAME = { width: 64, height: 32 };
const ALPHA_THRESHOLD = 10;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readImage(file) {
  const buffer = await readFile(file);
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { buffer, data, width: info.width, height: info.height, channels: info.channels };
}

function alphaBounds(image, originX, originY, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = image.data[((originY + y) * image.width + originX + x) * image.channels + 3];
      if (alpha <= ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return {
    left: originX + minX,
    top: originY + minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function fitFrame(image, bounds, frame, placement) {
  const resized = await sharp(image.buffer)
    .extract(bounds)
    .resize({
      width: frame.width,
      height: frame.height,
      fit: 'inside',
      kernel: 'lanczos3',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  const meta = await sharp(resized).metadata();
  assert(typeof meta.width === 'number' && typeof meta.height === 'number', 'resized frame has no size');

  const left = Math.max(0, Math.floor((frame.width - meta.width) / 2));
  const top =
    placement === 'bottom'
      ? Math.max(0, frame.height - meta.height)
      : Math.max(0, Math.floor((frame.height - meta.height) / 2));

  return sharp({
    create: {
      width: frame.width,
      height: frame.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

async function packSheet(frames, frame) {
  assert(frames.length > 0, 'no frames to pack');
  return sharp({
    create: {
      width: frame.width * frames.length,
      height: frame.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(frames.map((input, index) => ({ input, left: index * frame.width, top: 0 })))
    .png()
    .toBuffer();
}

function labelSvg(width, height, cells, columns, rows) {
  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const lines = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const x = col * cellWidth;
      const y = row * cellHeight;
      lines.push(
        `<rect x="${x + 1}" y="${y + 1}" width="${cellWidth - 2}" height="${cellHeight - 2}" fill="none" stroke="#ff6b1a" stroke-width="2" stroke-dasharray="8 5" opacity="0.85"/>`,
      );
      const label = cells[row * columns + col];
      if (label) {
        lines.push(
          `<text x="${x + 10}" y="${y + 34}" font-family="monospace" font-size="26" font-weight="bold" fill="#d9a441" stroke="#050505" stroke-width="5" paint-order="stroke">${label}</text>`,
        );
      }
    }
  }

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines.join('')}</svg>`,
  );
}

async function writePreview(file, labels, columns, rows) {
  const input = await readFile(file);
  const meta = await sharp(input).metadata();
  assert(typeof meta.width === 'number' && typeof meta.height === 'number', 'preview source has no size');
  const svg = labelSvg(meta.width, meta.height, labels, columns, rows);
  const name = path.basename(file);
  const output = path.join(PREVIEW, name.replace('.png', '-map.png'));
  await sharp(input).composite([{ input: svg, left: 0, top: 0 }]).png().toFile(output);
  return output;
}

async function buildProps() {
  const image = await readImage(SOURCES.props);
  assert(image.width === 1448 && image.height === 1086, 'unexpected prop sheet size');

  const cellWidth = image.width / 2;
  const cellHeight = image.height / 2;
  const frames = [];

  for (let index = 0; index < 4; index += 1) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const bounds = alphaBounds(image, col * cellWidth, row * cellHeight, cellWidth, cellHeight);
    assert(bounds, `empty prop frame: ${index}`);
    frames.push(await fitFrame(image, bounds, PROP_FRAME, 'bottom'));
  }

  const sheet = await packSheet(frames, PROP_FRAME);
  const output = path.join(OUT, 'props.png');
  await writeFile(output, sheet);
  return output;
}

async function buildDecals() {
  const image = await readImage(SOURCES.decals);
  assert(image.width === 1774 && image.height === 887, 'unexpected decal sheet size');

  const cellWidth = image.width / 2;
  const frames = [];

  for (let index = 0; index < 2; index += 1) {
    const bounds = alphaBounds(image, index * cellWidth, 0, cellWidth, image.height);
    assert(bounds, `empty decal frame: ${index}`);
    frames.push(await fitFrame(image, bounds, DECAL_FRAME, 'center'));
  }

  const sheet = await packSheet(frames, DECAL_FRAME);
  const output = path.join(OUT, 'decals.png');
  await writeFile(output, sheet);
  return output;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(PREVIEW, { recursive: true });

  const props = await buildProps();
  const decals = await buildDecals();

  await writePreview(SOURCES.props, ['barrel', 'crate', 'terminal', 'pipe'], 2, 2);
  await writePreview(SOURCES.decals, ['decal_0', 'decal_1'], 2, 1);

  console.log(JSON.stringify({ props, decals, preview: PREVIEW }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
