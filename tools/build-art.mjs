import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'art-source');
const OUT = path.join(ROOT, 'assets', 'art', 'runtime');
const PREVIEW = path.join(ROOT, 'art-preview');

const SOURCES = {
  entities: path.join(SOURCE, 'entities', 'Eight-Direction Hooded Sci-Fi Sprite Sheet.png'),
  entityWalk: path.join(SOURCE, 'entities', 'walk', 'Hooded Wanderer Walking Sprite Sheet.png'),
  textures: path.join(SOURCE, 'textures', 'Pixel Art Sci-Fi Texture Atlas.png'),
  props: path.join(SOURCE, 'props', 'Industrial Isometric Prop Sprite Sheet.png'),
  decals: path.join(SOURCE, 'decals', 'Isometric Industrial Stain and Scorch Decals.png'),
};

const PLAYER_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const PLAYER_FRAME = { width: 32, height: 48 };
const WALK_COLUMNS = 8;
const WALK_ROWS = 4;
const WALK_CYCLE_FRAMES = WALK_ROWS;
const WALK_BG_TOLERANCE = 20;

// Generated sheets often bleed one or two pixels of the previous row's feet into the
// top of the next cell. Ignoring that band keeps every frame's bounds tight.
const WALK_CELL_TOP_INSET = 2;

// The sheet uses the standard 8-direction order, one column per direction:
// 1 N, 2 NE, 3 E, 4 SE, 5 S, 6 SW, 7 W, 8 NW.
const WALK_SOURCES = {
  N: { column: 0 },
  NE: { column: 1 },
  E: { column: 2 },
  SE: { column: 3 },
  S: { column: 4 },
  SW: { column: 5 },
  W: { column: 6 },
  NW: { column: 7 },
};
const PROP_FRAME = { width: 64, height: 96 };
const DECAL_FRAME = { width: 64, height: 32 };
const TEXTURE_SIZE = 256;
const ALPHA_THRESHOLD = 10;

const TEXTURE_CELLS = [
  { name: 'floor_a', cx: 1 / 6, cy: 1 / 4 },
  { name: 'floor_b', cx: 3 / 6, cy: 1 / 4 },
  { name: 'grate', cx: 5 / 6, cy: 1 / 4 },
  { name: 'wall_a', cx: 1 / 4, cy: 3 / 4 },
  { name: 'wall_b', cx: 3 / 4, cy: 3 / 4 },
];

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

async function writeTexturePreview() {
  const input = await readFile(SOURCES.textures);
  const meta = await sharp(input).metadata();
  assert(typeof meta.width === 'number' && typeof meta.height === 'number', 'preview source has no size');

  const width = meta.width;
  const height = meta.height;
  const rects = [
    { label: 'floor_a', x: 0, y: 0, width: width / 3, height: height / 2 },
    { label: 'floor_b', x: width / 3, y: 0, width: width / 3, height: height / 2 },
    { label: 'grate', x: (width * 2) / 3, y: 0, width: width / 3, height: height / 2 },
    { label: 'wall_a', x: 0, y: height / 2, width: width / 2, height: height / 2 },
    { label: 'wall_b', x: width / 2, y: height / 2, width: width / 2, height: height / 2 },
  ];

  const lines = rects.map(
    (rect) =>
      `<rect x="${rect.x + 1}" y="${rect.y + 1}" width="${rect.width - 2}" height="${rect.height - 2}" fill="none" stroke="#ff6b1a" stroke-width="2" stroke-dasharray="8 5" opacity="0.85"/>` +
      `<text x="${rect.x + 10}" y="${rect.y + 34}" font-family="monospace" font-size="26" font-weight="bold" fill="#d9a441" stroke="#050505" stroke-width="5" paint-order="stroke">${rect.label}</text>`,
  );

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${lines.join('')}</svg>`,
  );

  const output = path.join(PREVIEW, path.basename(SOURCES.textures).replace('.png', '-map.png'));
  await sharp(input).composite([{ input: svg, left: 0, top: 0 }]).png().toFile(output);
  return output;
}

function floodKeyBackground(image) {
  const { data, width, height } = image;
  const background = [data[0], data[1], data[2]];
  const pixelCount = width * height;

  const matchesBackground = (pixel) => {
    const index = pixel * 4;
    return (
      Math.abs(data[index] - background[0]) <= WALK_BG_TOLERANCE &&
      Math.abs(data[index + 1] - background[1]) <= WALK_BG_TOLERANCE &&
      Math.abs(data[index + 2] - background[2]) <= WALK_BG_TOLERANCE
    );
  };

  const filled = new Uint8Array(pixelCount);
  const stack = new Int32Array(pixelCount);
  let top = 0;

  const push = (pixel) => {
    if (filled[pixel] === 1) return;
    if (!matchesBackground(pixel)) return;
    filled[pixel] = 1;
    stack[top] = pixel;
    top += 1;
  };

  for (let x = 0; x < width; x += 1) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (top > 0) {
    top -= 1;
    const pixel = stack[top];
    const x = pixel % width;
    if (x > 0) push(pixel - 1);
    if (x < width - 1) push(pixel + 1);
    if (pixel >= width) push(pixel - width);
    if (pixel < pixelCount - width) push(pixel + width);
  }

  const out = Buffer.alloc(pixelCount * 4);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (filled[pixel] === 1) continue;
    const index = pixel * 4;
    out[index] = data[index];
    out[index + 1] = data[index + 1];
    out[index + 2] = data[index + 2];
    out[index + 3] = 255;
  }

  return { data: out, width, height, channels: 4 };
}

async function walkFrame(keyedPng, union, bounds, scale, scaledWidth, leftOffset) {
  const frameWidth = union.width;
  const frameHeight = bounds.height;

  const crop = await sharp(keyedPng)
    .extract({ left: union.left, top: bounds.top, width: frameWidth, height: frameHeight })
    .png()
    .toBuffer();

  const scaledHeight = Math.max(1, Math.min(PLAYER_FRAME.height, Math.round(bounds.height * scale)));
  const resized = await sharp(crop)
    .resize({ width: scaledWidth, height: scaledHeight, fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: PLAYER_FRAME.width,
      height: PLAYER_FRAME.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: leftOffset, top: PLAYER_FRAME.height - scaledHeight }])
    .png()
    .toBuffer();
}

async function buildWalk() {
  const image = await readImage(SOURCES.entityWalk);
  assert(image.width === 1536, 'unexpected walk sheet width');
  assert(image.height % WALK_ROWS === 0, 'walk sheet height does not divide into rows');
  assert(image.width % WALK_COLUMNS === 0, 'walk sheet width does not divide into columns');
  assert(image.height % WALK_ROWS === 0, 'walk sheet height does not divide into rows');

  const keyed = floodKeyBackground(image);
  const keyedPng = await sharp(keyed.data, {
    raw: { width: keyed.width, height: keyed.height, channels: 4 },
  })
    .png()
    .toBuffer();
  const keyedImage = { ...keyed, buffer: keyedPng };

  const cellWidth = image.width / WALK_COLUMNS;
  const cellHeight = image.height / WALK_ROWS;
  const usedColumns = new Set(
    PLAYER_DIRECTIONS.map((direction) => WALK_SOURCES[direction].column),
  );
  const frames = [];

  for (const direction of PLAYER_DIRECTIONS) {
    const source = WALK_SOURCES[direction];
    const boundsList = [];

    for (let row = 0; row < WALK_ROWS; row += 1) {
      const bounds = alphaBounds(
        keyedImage,
        source.column * cellWidth,
        row * cellHeight + WALK_CELL_TOP_INSET,
        cellWidth,
        cellHeight - WALK_CELL_TOP_INSET,
      );
      assert(bounds, `empty walk frame: ${direction} ${row}`);
      boundsList.push(bounds);
    }

    const left = Math.min(...boundsList.map((bounds) => bounds.left));
    const right = Math.max(...boundsList.map((bounds) => bounds.left + bounds.width));
    const union = { left, width: right - left };
    const bodyHeight = Math.max(...boundsList.map((bounds) => bounds.height));
    const scale = Math.min(PLAYER_FRAME.width / union.width, PLAYER_FRAME.height / bodyHeight);
    const scaledWidth = Math.max(1, Math.min(PLAYER_FRAME.width, Math.floor(union.width * scale)));
    const leftOffset = Math.floor((PLAYER_FRAME.width - scaledWidth) / 2);

    for (let row = 0; row < WALK_ROWS; row += 1) {
      const frame = await walkFrame(
        keyedPng,
        union,
        boundsList[row],
        scale,
        scaledWidth,
        leftOffset,
      );
      frames.push(
        source.flip ? await sharp(frame).flop().png().toBuffer() : frame,
      );
    }

    console.log(
      `${direction}: column ${source.column + 1}${source.flip ? ' mirrored' : ''} frames ${WALK_ROWS}`,
    );
  }

  for (let column = 0; column < WALK_COLUMNS; column += 1) {
    if (!usedColumns.has(column)) console.log(`walk column ${column + 1} unused`);
  }

  assert(
    frames.length === PLAYER_DIRECTIONS.length * WALK_CYCLE_FRAMES,
    'unexpected walk frame count',
  );

  const sheet = await packSheet(frames, PLAYER_FRAME);
  const output = path.join(OUT, 'player_walk.png');
  await writeFile(output, sheet);
  return output;
}

async function buildPlayer() {
  const image = await readImage(SOURCES.entities);
  assert(image.width === 1536 && image.height === 1024, 'unexpected entity sheet size');

  const cellWidth = image.width / 4;
  const cellHeight = image.height / 2;
  const frames = [];

  for (let index = 0; index < PLAYER_DIRECTIONS.length; index += 1) {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const bounds = alphaBounds(image, col * cellWidth, row * cellHeight, cellWidth, cellHeight);
    assert(bounds, `empty player frame: ${PLAYER_DIRECTIONS[index]}`);
    frames.push(await fitFrame(image, bounds, PLAYER_FRAME, 'bottom'));
  }

  const sheet = await packSheet(frames, PLAYER_FRAME);
  const output = path.join(OUT, 'player.png');
  await writeFile(output, sheet);
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

async function buildTextures() {
  const buffer = await readFile(SOURCES.textures);
  const meta = await sharp(buffer).metadata();
  assert(typeof meta.width === 'number' && typeof meta.height === 'number', 'texture atlas has no size');
  assert(meta.width === 1254 && meta.height === 1254, 'unexpected texture atlas size');

  const outputs = [];

  for (const cell of TEXTURE_CELLS) {
    const centerX = cell.cx * meta.width;
    const centerY = cell.cy * meta.height;
    const left = Math.floor(centerX - TEXTURE_SIZE / 2);
    const top = Math.floor(centerY - TEXTURE_SIZE / 2);
    const output = path.join(OUT, 'textures', `${cell.name}.png`);
    await sharp(buffer)
      .extract({ left, top, width: TEXTURE_SIZE, height: TEXTURE_SIZE })
      .png()
      .toFile(output);
    outputs.push(output);
  }

  return outputs;
}

async function main() {
  await mkdir(path.join(OUT, 'textures'), { recursive: true });
  await mkdir(PREVIEW, { recursive: true });

  const player = await buildPlayer();
  const walk = await buildWalk();
  const props = await buildProps();
  const decals = await buildDecals();
  const textures = await buildTextures();

  const columnLabels = Array.from({ length: WALK_COLUMNS }, (_, column) => {
    const match = PLAYER_DIRECTIONS.find(
      (direction) => WALK_SOURCES[direction].column === column && !WALK_SOURCES[direction].flip,
    );
    return match ? `${match} c${column + 1}` : `c${column + 1}`;
  });
  const walkLabels = Array.from({ length: WALK_ROWS }, (_, row) =>
    columnLabels.map((label) => `${label} f${row + 1}`),
  ).flat();

  await writePreview(SOURCES.entities, PLAYER_DIRECTIONS, 4, 2);
  await writePreview(SOURCES.entityWalk, walkLabels, WALK_COLUMNS, WALK_ROWS);
  await writeTexturePreview();
  await writePreview(SOURCES.props, ['barrel', 'crate', 'terminal', 'pipe'], 2, 2);
  await writePreview(SOURCES.decals, ['decal_0', 'decal_1'], 2, 1);

  console.log(
    JSON.stringify(
      {
        player,
        walk,
        props,
        decals,
        textures,
        preview: PREVIEW,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
