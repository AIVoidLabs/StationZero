import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'assets', 'art', 'v2');
const PREVIEW = path.join(ROOT, 'art-preview', 'proposed', 'world_v2');

const TILE_W = 64;
const TILE_H = 32;
const WALL_H = 46;
const WALL_IMG_H = TILE_H + WALL_H;
const WALL_COLUMNS = 4;
const ATLAS_W = TILE_W * WALL_COLUMNS;
const ATLAS_H = TILE_H + WALL_IMG_H * 2;

const OUTLINE = [8, 10, 10];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const add = (c, d) => [clamp(c[0] + d, 0, 255), clamp(c[1] + d, 0, 255), clamp(c[2] + d, 0, 255)];
const mul = (c, k) => [clamp(Math.round(c[0] * k), 0, 255), clamp(Math.round(c[1] * k), 0, 255), clamp(Math.round(c[2] * k), 0, 255)];

function hash(x, y, seed) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed + 1, 2147483647)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function polyDist(px, py, points) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    best = Math.min(best, segDist(px, py, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]));
  }
  return best;
}

class Image {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = color[0];
    this.data[i + 1] = color[1];
    this.data[i + 2] = color[2];
    this.data[i + 3] = 255;
  }

  opaque(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.data[(y * this.width + x) * 4 + 3] > 0;
  }

  blit(src, ox, oy) {
    for (let y = 0; y < src.height; y += 1) {
      for (let x = 0; x < src.width; x += 1) {
        const i = (y * src.width + x) * 4;
        if (src.data[i + 3] === 0) continue;
        this.set(x + ox, y + oy, [src.data[i], src.data[i + 1], src.data[i + 2]]);
      }
    }
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

// ---------- floors ----------

const FLOOR = {
  steel: [54, 65, 69],
  steelSeam: [17, 21, 23],
  steelLine: [78, 93, 97],
  concrete: [70, 74, 64],
  concreteCrack: [22, 24, 21],
  grateBase: [11, 14, 15],
  grateBar: [88, 58, 44],
  grateEdge: [104, 62, 44],
  wet: [34, 46, 66],
};

function floorColor(kind, u, v, px, py) {
  const edge = Math.min(u, v, 1 - u, 1 - v);
  const grain = hash(px, py, 7);

  if (kind === 'grate') {
    if (edge < 0.05) return FLOOR.steelSeam;
    if (edge < 0.1) return u < 0.1 || v < 0.1 ? add(FLOOR.grateEdge, 12) : FLOOR.grateEdge;
    const inner = (u - 0.1) / 0.8;
    if (v < 0.14 || v > 0.86) return FLOOR.grateBase;
    const sub = (inner * 6) % 1;
    if (sub > 0.7) return sub < 0.78 ? add(FLOOR.grateBar, 10) : FLOOR.grateBar;
    return [5, 6, 7];
  }

  let base = kind === 'steel' ? FLOOR.steel : FLOOR.concrete;
  if (edge < 0.04) return FLOOR.steelSeam;
  if (edge < 0.075 && (u < 0.075 || v < 0.075)) return kind === 'steel' ? FLOOR.steelLine : add(base, 9);

  if (PATTERN === 'tiles') {
    if (Math.abs(u - 0.5) < 0.012 || Math.abs(v - 0.5) < 0.012) return mul(base, 0.72);
    if (grain > 0.95) return add(base, 6);
    return base;
  }

  if (PATTERN === 'wet') {
    const puddle = Math.sin(u * 9 + Math.sin(v * 5) * 2) * Math.sin(v * 8 + u * 3);
    if (puddle > 0.5) return puddle > 0.82 ? add(FLOOR.wet, 18) : FLOOR.wet;
  }

  if (kind === 'steel') {
    for (const [cu, cv] of [
      [0.16, 0.16],
      [0.84, 0.16],
      [0.16, 0.84],
      [0.84, 0.84],
    ]) {
      const d = Math.hypot(u - cu, v - cv);
      if (d < 0.034) return d < 0.018 ? [110, 128, 130] : [30, 37, 40];
    }
    for (const line of [
      [[0.28, 0.72], [0.62, 0.58]],
      [[0.5, 0.3], [0.78, 0.42]],
    ]) {
      if (segDist(u, v, line[0][0], line[0][1], line[1][0], line[1][1]) < 0.011) return add(base, 11);
    }
  } else {
    const crack = [
      [0.1, 0.3],
      [0.28, 0.37],
      [0.42, 0.33],
      [0.55, 0.49],
      [0.7, 0.54],
      [0.9, 0.7],
    ];
    if (polyDist(u, v, crack) < 0.012) return FLOOR.concreteCrack;
    if (segDist(u, v, 0.55, 0.49, 0.62, 0.78) < 0.01) return FLOOR.concreteCrack;
    if (grain > 0.985) return add(base, 20);
  }

  if (grain > 0.93) return add(base, 3);
  if (grain < 0.05) return add(base, -3);
  return base;
}

function floorTile(kind) {
  const img = new Image(TILE_W, TILE_H);
  for (let y = 0; y < TILE_H; y += 1) {
    for (let x = 0; x < TILE_W; x += 1) {
      const dx = Math.abs(x + 0.5 - TILE_W / 2) / (TILE_W / 2);
      const dy = Math.abs(y + 0.5 - TILE_H / 2) / (TILE_H / 2);
      if (dx + dy > 1) continue;
      const sx = (x + 0.5 - TILE_W / 2) / (TILE_W / 2);
      const sy = (y + 0.5 - TILE_H / 2) / (TILE_H / 2);
      const u = (sx + sy) / 2 + 0.5;
      const v = (sy - sx) / 2 + 0.5;
      img.set(x, y, floorColor(kind, u, v, x, y));
    }
  }
  return img;
}

let PATTERN = 'plain';

// ---------- walls ----------

const WALL = {
  cap: [122, 140, 142],
  capEdge: [180, 194, 188],
  left: [62, 77, 81],
  right: [86, 103, 107],
  seam: [14, 17, 18],
  rivet: [128, 146, 146],
  rust: [124, 62, 44],
  amber: [182, 132, 38],
  dark: [24, 27, 28],
  cableRed: [112, 40, 34],
  cableCyan: [40, 92, 108],
  clamp: [96, 110, 110],
};

const DEFAULT_FLOOR = { ...FLOOR };
const DEFAULT_WALL = { ...WALL };

const THEMES = [
  { name: 'intake' },
  {
    name: 'cellblock',
    floor: { steel: [66, 60, 52], steelLine: [96, 86, 70], concrete: [74, 66, 54], grateBar: [150, 98, 40], grateEdge: [128, 84, 36] },
    wall: { cap: [140, 124, 104], capEdge: [196, 178, 148], left: [76, 68, 58], right: [102, 90, 74], rust: [150, 84, 44], amber: [200, 142, 40] },
  },
  {
    name: 'infirmary',
    pattern: 'tiles',
    floor: { steel: [150, 168, 170], steelSeam: [58, 76, 80], steelLine: [190, 204, 204], concrete: [130, 152, 154], grateBar: [80, 140, 150], grateEdge: [70, 120, 130] },
    wall: { cap: [190, 214, 216], capEdge: [225, 240, 240], left: [96, 126, 132], right: [128, 160, 166], rust: [96, 150, 156], cableCyan: [70, 170, 190] },
  },
  {
    name: 'drill',
    floor: { steel: [78, 66, 50], concrete: [90, 76, 56], concreteCrack: [30, 24, 16], grateBar: [140, 96, 50], grateEdge: [120, 80, 40] },
    wall: { cap: [140, 118, 86], capEdge: [190, 164, 120], left: [80, 66, 50], right: [108, 90, 66], rust: [160, 84, 40], amber: [210, 150, 40] },
  },
  {
    name: 'pump',
    pattern: 'wet',
    floor: { steel: [44, 56, 70], steelLine: [66, 82, 108], concrete: [48, 56, 76], wet: [58, 48, 98], grateBar: [90, 70, 130], grateEdge: [76, 60, 112] },
    wall: { cap: [96, 110, 150], capEdge: [146, 160, 204], left: [46, 58, 80], right: [64, 78, 104], rust: [96, 70, 140], cableCyan: [90, 80, 190] },
  },
  {
    name: 'foundry',
    floor: { steel: [78, 46, 38], steelLine: [118, 70, 52], concrete: [86, 54, 44], grateBar: [210, 110, 40], grateEdge: [160, 70, 30] },
    wall: { cap: [150, 92, 70], capEdge: [210, 140, 100], left: [88, 48, 38], right: [122, 66, 50], rust: [170, 80, 36], amber: [232, 140, 36] },
  },
  {
    name: 'archive',
    floor: { steel: [34, 52, 48], steelLine: [60, 92, 84], concrete: [40, 60, 54], grateBar: [50, 140, 110], grateEdge: [40, 110, 90] },
    wall: { cap: [80, 120, 110], capEdge: [130, 186, 170], left: [36, 58, 54], right: [52, 84, 78], rust: [56, 120, 96], cableCyan: [70, 190, 170] },
  },
  {
    name: 'power',
    floor: { steel: [30, 36, 50], steelLine: [52, 64, 92], concrete: [34, 40, 54], grateBar: [70, 110, 210], grateEdge: [50, 80, 160] },
    wall: { cap: [70, 84, 120], capEdge: [120, 140, 200], left: [28, 34, 50], right: [44, 52, 74], rust: [60, 90, 170], amber: [214, 196, 60], cableCyan: [70, 130, 230] },
  },
  {
    name: 'dronefoundry',
    floor: { steel: [72, 72, 66], steelLine: [112, 108, 70], concrete: [80, 78, 66], grateBar: [200, 160, 30], grateEdge: [160, 124, 30] },
    wall: { cap: [138, 132, 100], capEdge: [196, 188, 140], left: [76, 74, 64], right: [104, 100, 82], rust: [150, 110, 40], amber: [226, 176, 30] },
  },
  {
    name: 'comms',
    floor: { steel: [50, 64, 84], steelLine: [78, 98, 130], concrete: [54, 66, 88], grateBar: [90, 140, 210], grateEdge: [70, 110, 170] },
    wall: { cap: [120, 148, 190], capEdge: [180, 206, 240], left: [56, 72, 98], right: [78, 98, 130], rust: [80, 120, 180], cableCyan: [100, 180, 250] },
  },
  {
    name: 'core',
    floor: { steel: [18, 20, 22], steelSeam: [8, 8, 10], steelLine: [60, 64, 68], concrete: [24, 26, 28], concreteCrack: [8, 8, 8], grateBar: [120, 20, 20], grateEdge: [90, 16, 16] },
    wall: { cap: [70, 72, 76], capEdge: [150, 154, 160], left: [20, 22, 24], right: [34, 36, 40], rust: [110, 24, 24], cableRed: [160, 30, 30], amber: [150, 30, 30] },
  },
];

function applyTheme(theme) {
  Object.assign(FLOOR, DEFAULT_FLOOR, theme.floor ?? {});
  Object.assign(WALL, DEFAULT_WALL, theme.wall ?? {});
  PATTERN = theme.pattern ?? 'plain';
}

function wallFace(variant, s, t, base, px, py) {
  let c = base;

  if (t < 0.05) c = mul(c, 0.78);
  if (t > 0.92) c = mul(c, 0.55);
  if (s < 0.05) c = mul(c, 0.86);

  const rivet = (cs, ct) => {
    const d = Math.hypot((s - cs) * 1.0, (t - ct) * 1.45);
    if (d < 0.05) return d < 0.027 ? WALL.rivet : mul(base, 0.6);
    return null;
  };
  const corners = [
    [0.15, 0.15],
    [0.85, 0.15],
    [0.15, 0.86],
    [0.85, 0.86],
  ];

  switch (variant) {
    case 0: {
      if (Math.abs(t - 0.52) < 0.014) return WALL.seam;
      if (Math.abs(t - 0.56) < 0.012) return add(base, 14);
      for (const [cs, ct] of corners) {
        const r = rivet(cs, ct);
        if (r) return r;
      }
      break;
    }
    case 1: {
      if (Math.abs(s - 0.5) < 0.02 || Math.abs(t - 0.5) < 0.014) return WALL.seam;
      if (Math.abs(s - 0.55) < 0.016 && t > 0.05) return add(base, 12);
      break;
    }
    case 2: {
      for (const ct of [0.3, 0.7]) {
        for (const cs of [0.2, 0.4, 0.6, 0.8]) {
          const r = rivet(cs, ct);
          if (r) return r;
        }
      }
      if (Math.abs(t - 0.5) < 0.012) return add(base, -10);
      break;
    }
    case 3: {
      const inBox = s > 0.2 && s < 0.8 && t > 0.2 && t < 0.64;
      if (inBox) {
        const frame = s < 0.25 || s > 0.75 || t < 0.25 || t > 0.59;
        if (frame) return add(base, 16);
        const slat = Math.floor(((t - 0.25) / 0.34) * 6);
        return slat % 2 === 0 ? [6, 8, 9] : add(base, -6);
      }
      for (const [cs, ct] of corners) {
        const r = rivet(cs, ct);
        if (r) return r;
      }
      break;
    }
    case 4: {
      const red = Math.abs(s - 0.38);
      const cyan = Math.abs(s - 0.54);
      if (cyan < 0.05) return cyan < 0.02 ? add(WALL.cableCyan, 22) : WALL.cableCyan;
      if (red < 0.05) return red < 0.02 ? add(WALL.cableRed, 22) : WALL.cableRed;
      if ((Math.abs(t - 0.28) < 0.03 || Math.abs(t - 0.68) < 0.03) && s > 0.28 && s < 0.64) {
        return Math.abs(t - 0.28) < 0.012 || Math.abs(t - 0.68) < 0.012 ? add(WALL.clamp, 18) : WALL.clamp;
      }
      if (Math.abs(s - 0.8) < 0.016) return WALL.seam;
      break;
    }
    case 5: {
      const crack = [
        [0.5, 0.04],
        [0.42, 0.2],
        [0.56, 0.34],
        [0.44, 0.5],
        [0.6, 0.66],
        [0.52, 0.84],
        [0.58, 0.96],
      ];
      const d = polyDist(s, t * 0.8, crack.map(([cs, ct]) => [cs, ct * 0.8]));
      if (d < 0.02) return [10, 12, 12];
      if (d < 0.045) return hash(px, py, 3) > 0.35 ? WALL.rust : mul(WALL.rust, 0.75);
      if (d < 0.07 && hash(px, py, 4) > 0.7) return mul(WALL.rust, 0.8);
      break;
    }
    case 6: {
      if (t > 0.5 && t < 0.78) {
        if (t < 0.52 || t > 0.76) return WALL.seam;
        const stripe = Math.floor((s * 30 + t * 30) / 5) % 2;
        return stripe === 0 ? WALL.amber : WALL.dark;
      }
      if (Math.abs(t - 0.28) < 0.012) return WALL.seam;
      break;
    }
    case 7: {
      const border = s < 0.13 || s > 0.87 || t < 0.1 || t > 0.9;
      if (border) {
        for (const [cs, ct] of [
          [0.065, 0.05],
          [0.935, 0.05],
          [0.065, 0.95],
          [0.935, 0.95],
        ]) {
          const r = rivet(cs, ct);
          if (r) return r;
        }
        return add(base, 14);
      }
      if (Math.abs(s - 0.5) < 0.014) return WALL.seam;
      return add(base, -8);
    }
    default:
      break;
  }

  const grain = hash(px, py, 11 + variant);
  if (grain > 0.92) return add(c, 4);
  if (grain < 0.05) return add(c, -4);
  return c;
}

function wallTile(variant) {
  const img = new Image(TILE_W, WALL_IMG_H);
  for (let y = 0; y < WALL_IMG_H; y += 1) {
    for (let x = 0; x < TILE_W; x += 1) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const dx = Math.abs(cx - TILE_W / 2) / (TILE_W / 2);
      const dy = Math.abs(cy - TILE_H / 2 + 0) / (TILE_H / 2);
      const topDy = Math.abs(cy - 16) / 16;
      const onTop = dx + topDy <= 1;

      if (onTop) {
        const edgeDist = 1 - (dx + topDy);
        let color = WALL.cap;
        if (edgeDist < 0.085) color = WALL.capEdge;
        else if (hash(x, y, 21) > 0.93) color = add(color, 5);
        else if (hash(x, y, 22) < 0.06) color = add(color, -5);
        img.set(x, y, color);
        continue;
      }

      if (cx < 32) {
        const upper = 16 + cx / 2;
        const lower = 62 + cx / 2;
        if (cy >= upper && cy <= lower) {
          img.set(x, y, wallFace(variant, cx / 32, (cy - upper) / WALL_H, WALL.left, x, y));
        }
      } else {
        const upper = 32 - (cx - 32) / 2;
        const lower = 78 - (cx - 32) / 2;
        if (cy >= upper && cy <= lower) {
          img.set(x, y, wallFace(variant, (cx - 32) / 32, (cy - upper) / WALL_H, WALL.right, x, y));
        }
      }
      void dy;
    }
  }

  for (let y = 33; y < WALL_IMG_H; y += 1) {
    if (img.opaque(32, y) && img.opaque(31, y)) img.set(32, y, [112, 128, 126]);
  }
  img.outline();
  return img;
}

// ---------- drone ----------

const DRONE_W = 40;
const DRONE_H = 40;
const DRONE_CX = 20;
const DRONE_GROUND = 38.2;
const DRONE_TILT = 0.5;
const DIRECTIONS = [
  { name: 'N', yaw: 180 },
  { name: 'NE', yaw: 135 },
  { name: 'E', yaw: 90 },
  { name: 'SE', yaw: 45 },
  { name: 'S', yaw: 0 },
  { name: 'SW', yaw: -45 },
  { name: 'W', yaw: -90 },
  { name: 'NW', yaw: -135 },
];

const DR = {
  hull: [62, 76, 79],
  hullDark: [31, 38, 41],
  ring: [20, 24, 26],
  rust: [104, 52, 38],
  lens: [217, 164, 65],
  lensHot: [255, 244, 210],
  lensHousing: [12, 14, 14],
  glow: [18, 52, 64],
  glowHot: [42, 91, 107],
  nozzle: [70, 150, 170],
  steel: [46, 58, 61],
};

function band(ox, oy) {
  const l = ox * -0.55 + oy * -0.85;
  return l > 0.4 ? 1 : l < -0.45 ? -1 : 0;
}

function shadeBand(color, b) {
  return b > 0 ? mul(color, 1.4) : b < 0 ? mul(color, 0.62) : color;
}

function ellipseFill(img, cx, cy, rx, ry, color, bands = true) {
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y += 1) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x += 1) {
      const ox = (x + 0.5 - cx) / rx;
      const oy = (y + 0.5 - cy) / ry;
      const d = ox * ox + oy * oy;
      if (d > 1) continue;
      let b = bands ? band(ox, oy) : 0;
      if (bands && d > 0.74 && rx >= 2.5) b = Math.min(b, -1);
      img.set(x, y, shadeBand(color, b));
    }
  }
}

function capsuleFill(img, a, b, ra, rb, color) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  for (let y = Math.floor(Math.min(a.y, b.y) - ra) - 1; y <= Math.ceil(Math.max(a.y, b.y) + ra) + 1; y += 1) {
    for (let x = Math.floor(Math.min(a.x, b.x) - ra) - 1; x <= Math.ceil(Math.max(a.x, b.x) + ra) + 1; x += 1) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const t = len2 < 1e-6 ? 0 : clamp(((cx - a.x) * abx + (cy - a.y) * aby) / len2, 0, 1);
      const qx = a.x + abx * t;
      const qy = a.y + aby * t;
      const r = lerp(ra, rb, t);
      const d = Math.hypot(cx - qx, cy - qy);
      if (d > r) continue;
      let bnd = band((cx - qx) / r, (cy - qy) / r);
      if (r >= 1.9 && d > r - 0.85) bnd = Math.min(bnd, -1);
      img.set(x, y, shadeBand(color, bnd));
    }
  }
}

function droneFrame(yaw) {
  const img = new Image(DRONE_W, DRONE_H);
  const theta = (yaw * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const proj = (lx, ly, lz) => {
    const wx = -lx * cos + lz * sin;
    const wz = lx * sin + lz * cos;
    return { x: DRONE_CX + wx, y: DRONE_GROUND - ly + wz * DRONE_TILT, depth: wz };
  };

  const prims = [];
  const push = (depth, draw) => prims.push({ depth, draw });

  const glow = proj(0, 2.2, 0);
  push(-99, () => {
    ellipseFill(img, glow.x, glow.y, 9.5, 3.3, DR.glow, false);
    ellipseFill(img, glow.x, glow.y, 6, 2, DR.glowHot, false);
  });

  const under = proj(0, 8, 0);
  push(-5, () => ellipseFill(img, under.x, under.y, 8.6, 3.4, DR.hullDark));

  for (const side of [-1, 1]) {
    const top = proj(11 * side, 15.5, 0);
    const bottom = proj(11 * side, 8.2, 0);
    push(top.depth, () => {
      capsuleFill(img, top, bottom, 2.4, 2.1, DR.steel);
      ellipseFill(img, bottom.x, bottom.y + 1.1, 1.6, 1, DR.nozzle, false);
    });
  }

  const body = proj(0, 16.5, 0);
  push(0, () => {
    ellipseFill(img, body.x, body.y, 10.4, 8.6, DR.hull);
    ellipseFill(img, body.x, body.y + 2.6, 10.4, 2.4, DR.ring, false);
    const cap = proj(0, 21.2, 0);
    ellipseFill(img, cap.x, cap.y, 5.6, 2.8, add(DR.hull, 12));
    const patch = proj(5.5, 12.6, 4);
    if (patch.depth > -2) ellipseFill(img, patch.x, patch.y, 2.2, 1.5, DR.rust, false);
    const patch2 = proj(-6.5, 18, -2);
    if (patch2.depth > -1) ellipseFill(img, patch2.x, patch2.y, 1.6, 1.2, DR.rust, false);
  });

  const antennaBase = proj(-3, 23.5, -2.5);
  const antennaTop = proj(-3, 30, -2.5);
  push(-0.5, () => {
    capsuleFill(img, antennaBase, antennaTop, 0.8, 0.7, DR.steel);
    img.set(Math.floor(antennaTop.x), Math.floor(antennaTop.y) - 1, DR.lens);
  });

  const front = cos;
  if (front > -0.15) {
    const lens = proj(0, 17.2, 8.4);
    push(1, () => {
      const rx = 3.6 * Math.max(0.35, front);
      ellipseFill(img, lens.x, lens.y, rx + 1.1, 4.3, DR.lensHousing, false);
      ellipseFill(img, lens.x, lens.y, rx, 3.2, DR.lens, false);
      img.set(Math.floor(lens.x - rx * 0.3), Math.floor(lens.y - 1), DR.lensHot);
    });
  } else {
    const vent = proj(0, 16.5, -9);
    push(1, () => {
      for (let i = -1; i <= 1; i += 1) {
        const y = Math.round(vent.y + i * 2);
        for (let dx = -3; dx <= 3; dx += 1) img.set(Math.round(vent.x) + dx, y, DR.lensHousing);
      }
    });
  }

  prims.sort((a, b) => a.depth - b.depth);
  for (const prim of prims) prim.draw();
  img.outline();
  return img;
}

const TANK_W = 56;
const TANK_H = 52;
const TANK_CX = 28;
const TANK_GROUND = 49.5;

const TK = {
  track: [28, 31, 31],
  trackLight: [52, 58, 58],
  hull: [74, 80, 76],
  plate: [112, 120, 114],
  turret: [90, 98, 94],
  rust: [112, 56, 36],
  barrel: [46, 52, 52],
  lens: [217, 164, 65],
  lensHot: [255, 244, 210],
  dark: [12, 14, 14],
  warn: [214, 170, 40],
};

function tankFrame(yaw) {
  const img = new Image(TANK_W, TANK_H);
  const theta = (yaw * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const proj = (lx, ly, lz) => {
    const wx = -lx * cos + lz * sin;
    const wz = lx * sin + lz * cos;
    return { x: TANK_CX + wx, y: TANK_GROUND - ly + wz * DRONE_TILT, depth: wz };
  };
  const prims = [];
  const push = (depth, draw) => prims.push({ depth, draw });

  for (const side of [-1, 1]) {
    const a = proj(side * 12, 5, -11);
    const b = proj(side * 12, 5, 11);
    push(proj(side * 12, 5, 0).depth - 0.5, () => {
      capsuleFill(img, a, b, 4.4, 4.4, TK.track);
      for (let i = 0; i < 6; i += 1) {
        const t = i / 5;
        const wheel = proj(side * 12, 5, -9 + t * 18);
        ellipseFill(img, wheel.x, wheel.y, 1.7, 1.5, TK.trackLight, false);
      }
    });
  }

  const hull = proj(0, 10, 0);
  push(0, () => {
    ellipseFill(img, hull.x, hull.y, 13.5, 7.6, TK.hull);
    const deck = proj(0, 13.2, -1);
    ellipseFill(img, deck.x, deck.y, 10.5, 4.4, add(TK.hull, 10));
    const patch = proj(8, 9, 2);
    if (patch.depth > -3) ellipseFill(img, patch.x, patch.y, 2.6, 1.8, TK.rust, false);
    const patch2 = proj(-7, 12, -4);
    if (patch2.depth > -2) ellipseFill(img, patch2.x, patch2.y, 2, 1.4, TK.rust, false);
  });

  if (cos > -0.2) {
    const plate = proj(0, 10.5, 11.2);
    push(0.8, () => {
      const rx = 11 * Math.max(0.4, cos) + 1.2;
      ellipseFill(img, plate.x, plate.y, rx, 5.6, TK.plate);
      for (const dx of [-0.45, 0.45]) {
        const stripe = proj(dx * 12, 8.2, 11.2);
        ellipseFill(img, stripe.x, stripe.y, 1.2, 0.9, TK.warn, false);
      }
    });
  } else {
    const vent = proj(0, 12, -11);
    push(0.8, () => {
      for (let i = -1; i <= 1; i += 1) {
        const y = Math.round(vent.y + i * 2);
        for (let dx = -4; dx <= 4; dx += 1) img.set(Math.round(vent.x) + dx, y, TK.dark);
      }
    });
  }

  const turret = proj(0, 17, 0);
  push(1, () => {
    ellipseFill(img, turret.x, turret.y, 8.2, 5.6, TK.turret);
    const cap = proj(0, 20.4, 0);
    ellipseFill(img, cap.x, cap.y, 5.2, 2.6, add(TK.turret, 14));
    const hatch = proj(-2, 21.5, -2);
    ellipseFill(img, hatch.x, hatch.y, 1.8, 0.9, TK.dark, false);
  });

  const barrelBase = proj(0, 17.4, 3);
  const barrelEnd = proj(0, 17.4, 19);
  push(barrelEnd.depth + 0.4, () => {
    capsuleFill(img, barrelBase, barrelEnd, 2.1, 1.7, TK.barrel);
    ellipseFill(img, barrelEnd.x, barrelEnd.y, 1.9, 1.5, TK.dark, false);
  });

  if (cos > -0.2) {
    const lens = proj(0, 18, 8);
    push(barrelEnd.depth - 0.2, () => {
      const rx = 2.6 * Math.max(0.4, cos);
      ellipseFill(img, lens.x, lens.y, rx + 0.9, 2.6, TK.dark, false);
      ellipseFill(img, lens.x, lens.y, rx, 1.8, TK.lens, false);
      img.set(Math.floor(lens.x - rx * 0.3), Math.floor(lens.y - 1), TK.lensHot);
    });
  }

  prims.sort((a, b) => a.depth - b.depth);
  for (const prim of prims) prim.draw();
  img.outline();
  return img;
}

function tankWreck() {
  const img = new Image(TANK_W, TANK_H);
  ellipseFill(img, 28, 46, 22, 5.2, [14, 15, 15], false);
  capsuleFill(img, { x: 14, y: 43 }, { x: 40, y: 43 }, 4.4, 4.4, TK.track);
  ellipseFill(img, 27, 38, 14, 7.6, [52, 56, 54]);
  ellipseFill(img, 26, 34, 8, 4.4, [64, 70, 68]);
  capsuleFill(img, { x: 30, y: 38 }, { x: 50, y: 44 }, 2, 1.8, TK.barrel);
  ellipseFill(img, 25, 33, 4, 1.6, [12, 12, 12], false);
  for (const [x, y] of [[20, 36], [33, 40], [28, 30]]) ellipseFill(img, x, y, 2.4, 1.6, [104, 50, 34], false);
  img.outline();
  return img;
}

const WD_W = 64;
const WD_H = 64;

function wardenFrame(yaw, dead = false) {
  const img = new Image(WD_W, WD_H);
  const theta = (yaw * Math.PI) / 180;
  isoBox(img, 32, 58, 20, 10, 9, dead ? [24, 26, 26] : [36, 40, 42]);
  rect(img, 27, 30, 10, 22, dead ? [20, 22, 22] : [30, 34, 36]);
  for (const side of [-1, 1]) {
    capsuleFill(img, { x: 32 + side * 4, y: 48 }, { x: 32 + side * 17, y: 55 }, 1.6, 1.4, dead ? [20, 22, 22] : [46, 52, 54]);
  }
  ellipseFill(img, 32, 25, 20, 18.5, dead ? [18, 20, 20] : [26, 29, 31]);
  ellipseFill(img, 32, 25, 15.5, 14, dead ? [34, 12, 10] : [78, 20, 18], false);
  if (!dead) {
    ellipseFill(img, 32, 25, 11.5, 10.2, [168, 32, 26], false);
    const ox = Math.sin(theta) * 5.5;
    const oy = -Math.cos(theta) * 2.6;
    ellipseFill(img, 32 + ox, 25 + oy, 5.4, 5, [255, 214, 170], false);
    ellipseFill(img, 32 + ox, 25 + oy, 2.4, 2.4, [40, 8, 6], false);
    img.set(Math.floor(32 + ox - 2), Math.floor(25 + oy - 2), [255, 255, 240]);
  } else {
    ellipseFill(img, 32, 25, 8, 7, [10, 4, 4], false);
    for (let i = 0; i < 9; i += 1) img.set(26 + i, 20 + ((i * 3) % 12), [60, 24, 20]);
  }
  for (const [sx, sy, ex, ey] of [[14, 14, 8, 5], [50, 14, 56, 5], [32, 7, 32, 0], [22, 9, 18, 1], [42, 9, 46, 1]]) {
    capsuleFill(img, { x: sx, y: sy }, { x: ex, y: ey }, 1.3, 0.7, dead ? [24, 26, 26] : [52, 58, 60]);
  }
  for (const y of [36, 42]) rect(img, 27, y, 10, 1, dead ? [40, 14, 12] : [190, 40, 34]);
  img.outline();
  return propShadow(img, 22, 5.5, WD_W, WD_H);
}

function droneWreck() {
  const img = new Image(DRONE_W, DRONE_H);
  ellipseFill(img, 20, 34, 16.5, 4.6, [14, 15, 15], false);
  ellipseFill(img, 20, 34, 12, 3, [24, 22, 20], false);

  capsuleFill(img, { x: 31.5, y: 35 }, { x: 36, y: 33.4 }, 2, 1.8, DR.steel);
  ellipseFill(img, 36.6, 33.2, 1.4, 1, DR.nozzle, false);

  ellipseFill(img, 19, 30, 10.6, 6.6, [46, 56, 59]);
  ellipseFill(img, 19, 32.5, 10.6, 2.2, DR.ring, false);
  ellipseFill(img, 17, 25.6, 5.4, 2.6, [70, 82, 84]);
  ellipseFill(img, 17.4, 26.2, 3.4, 1.4, [12, 12, 12], false);

  const crack = [
    [22, 24],
    [20.5, 27],
    [23, 29],
    [21, 32],
  ];
  for (let i = 0; i < crack.length - 1; i += 1) {
    const [ax, ay] = crack[i];
    const [bx, by] = crack[i + 1];
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let s = 0; s <= steps; s += 1) {
      img.set(Math.round(ax + ((bx - ax) * s) / steps), Math.round(ay + ((by - ay) * s) / steps), [8, 9, 9]);
    }
  }

  ellipseFill(img, 25.5, 30, 3.4, 2.6, [12, 14, 14], false);
  ellipseFill(img, 25.5, 30, 2.1, 1.5, [74, 52, 22], false);
  img.set(24, 29, [34, 26, 14]);

  for (const [x, y, color] of [
    [14, 24, [255, 122, 42]],
    [15, 23, [255, 200, 120]],
    [26, 25, [255, 90, 34]],
    [12, 28, [255, 150, 60]],
    [29, 28, [255, 110, 40]],
    [17, 26, [255, 160, 70]],
  ]) {
    img.set(x, y, color);
  }
  ellipseFill(img, 8.5, 33.5, 1.6, 0.8, DR.glow, false);
  img.outline();
  return img;
}

function doorTile(open) {
  const img = new Image(TILE_W, TILE_H);
  for (let y = 0; y < TILE_H; y += 1) {
    for (let x = 0; x < TILE_W; x += 1) {
      const dx = Math.abs(x + 0.5 - TILE_W / 2) / (TILE_W / 2);
      const dy = Math.abs(y + 0.5 - TILE_H / 2) / (TILE_H / 2);
      if (dx + dy > 1) continue;
      const sx = (x + 0.5 - TILE_W / 2) / (TILE_W / 2);
      const sy = (y + 0.5 - TILE_H / 2) / (TILE_H / 2);
      const u = (sx + sy) / 2 + 0.5;
      const v = (sy - sx) / 2 + 0.5;
      const edge = Math.min(u, v, 1 - u, 1 - v);

      if (edge < 0.04) {
        img.set(x, y, [17, 21, 23]);
        continue;
      }
      if (edge < 0.15) {
        const stripe = Math.floor((u * 22 + v * 22) / 3) % 2;
        img.set(x, y, stripe === 0 ? [190, 138, 40] : [26, 28, 28]);
        continue;
      }
      if (edge < 0.19) {
        img.set(x, y, [34, 40, 43]);
        continue;
      }

      const inner = Math.hypot(u - 0.5, v - 0.5);
      if (open) {
        const k = clamp(1 - inner / 0.45, 0, 1);
        const base = [5, 7, 8];
        const glow = [46, 140, 168];
        img.set(x, y, [
          Math.round(lerp(base[0], glow[0], k * k)),
          Math.round(lerp(base[1], glow[1], k * k)),
          Math.round(lerp(base[2], glow[2], k * k)),
        ]);
        if (u < 0.27 || u > 0.73) img.set(x, y, add([62, 74, 78], hash(x, y, 5) > 0.9 ? 6 : 0));
        continue;
      }

      let color = [64, 76, 80];
      if (Math.abs(u - 0.5) < 0.014) color = [10, 12, 13];
      else if (Math.abs(u - 0.5) < 0.03) color = [88, 102, 104];
      else if (Math.abs(v - 0.5) < 0.012) color = [26, 31, 33];
      if (inner < 0.075) color = inner < 0.04 ? [236, 60, 40] : [24, 12, 12];
      else if (hash(x, y, 9) > 0.93) color = add(color, 6);
      img.set(x, y, color);
    }
  }
  return img;
}

function lootSheet() {
  const sheet = new Image(32, 16);
  const stim = new Image(16, 16);
  ellipseFill(stim, 8, 13.5, 4.6, 1.6, [10, 12, 12], false);
  for (let y = 4; y <= 12; y += 1) {
    for (let x = 5; x <= 10; x += 1) stim.set(x, y, y >= 8 ? [70, 190, 120] : [168, 180, 178]);
  }
  for (let y = 4; y <= 12; y += 1) {
    stim.set(5, y, [244, 250, 248]);
    stim.set(10, y, [30, 60, 44]);
  }
  for (let x = 6; x <= 9; x += 1) stim.set(x, 3, [60, 66, 66]);
  stim.set(7, 2, [34, 38, 38]);
  stim.set(8, 2, [34, 38, 38]);
  stim.set(7, 6, [210, 50, 40]);
  stim.set(8, 6, [210, 50, 40]);
  stim.set(7, 5, [210, 50, 40]);
  stim.set(8, 5, [210, 50, 40]);
  stim.outline();

  const ammo = new Image(16, 16);
  ellipseFill(ammo, 8, 13.5, 6.4, 1.8, [10, 12, 12], false);
  for (let y = 7; y <= 12; y += 1) {
    for (let x = 3; x <= 12; x += 1) ammo.set(x, y, x < 5 ? [206, 168, 76] : x > 10 ? [120, 92, 36] : [176, 136, 52]);
  }
  for (let x = 3; x <= 12; x += 1) ammo.set(x, 7, [226, 190, 100]);
  for (let x = 4; x <= 11; x += 1) ammo.set(x, 9, [96, 70, 28]);
  for (const x of [5, 8, 11]) {
    ammo.set(x, 5, [224, 196, 120]);
    ammo.set(x, 6, [196, 150, 60]);
  }
  ammo.outline();

  sheet.blit(stim, 0, 0);
  sheet.blit(ammo, 16, 0);
  return sheet;
}

// ---------- floor props and the ten dead ----------

const PROP_FRAME_W = 48;
const PROP_FRAME_H = 48;
const PROP_BASE_X = 24;
const PROP_BASE_Y = 40;

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function fillPoly(img, pts, color) {
  const minX = Math.floor(Math.min(...pts.map((p) => p[0])));
  const maxX = Math.ceil(Math.max(...pts.map((p) => p[0])));
  const minY = Math.floor(Math.min(...pts.map((p) => p[1])));
  const maxY = Math.ceil(Math.max(...pts.map((p) => p[1])));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPoly(x + 0.5, y + 0.5, pts)) img.set(x, y, color);
    }
  }
}

function isoBox(img, cx, by, w, d, h, color) {
  const top = [cx, by - h - d];
  const right = [cx + w, by - h];
  const bottomTop = [cx, by - h + d];
  const left = [cx - w, by - h];
  fillPoly(img, [left, bottomTop, [cx, by + d], [cx - w, by]], mul(color, 0.86));
  fillPoly(img, [bottomTop, right, [cx + w, by], [cx, by + d]], mul(color, 0.58));
  fillPoly(img, [top, right, bottomTop, left], mul(color, 1.14));
}

function rect(img, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) img.set(xx, yy, color);
}

function propShadow(img, rx = 15, ry = 4.5, width = PROP_FRAME_W, height = PROP_FRAME_H) {
  const shadow = new Image(width, height);
  ellipseFill(shadow, width / 2, height === PROP_FRAME_H ? PROP_BASE_Y + 1 : height - 5, rx, ry, [8, 10, 10], false);
  shadow.blit(img, 0, 0);
  return shadow;
}

const SKIN = [172, 150, 128];
const BLOOD = [92, 26, 24];

function itemDraw(img, type, x, y) {
  switch (type) {
    case 'badge':
      rect(img, x, y, 6, 4, [226, 232, 232]);
      rect(img, x, y, 6, 1, [60, 120, 170]);
      img.set(x + 1, y + 2, [40, 50, 52]);
      break;
    case 'map':
      rect(img, x, y, 7, 5, [214, 212, 190]);
      for (const yy of [1, 3]) rect(img, x + 1, y + yy, 5, 1, [120, 110, 90]);
      break;
    case 'vial':
      rect(img, x + 1, y, 3, 5, [168, 184, 180]);
      rect(img, x + 1, y + 2, 3, 3, [70, 190, 120]);
      img.set(x + 2, y - 1, [60, 66, 66]);
      break;
    case 'valve':
      rect(img, x, y + 2, 7, 2, [196, 156, 60]);
      rect(img, x + 5, y, 2, 6, [196, 156, 60]);
      img.set(x + 6, y + 1, [240, 210, 110]);
      break;
    case 'cutter':
      rect(img, x, y + 2, 6, 2, [98, 108, 108]);
      rect(img, x + 6, y + 2, 2, 2, [255, 150, 50]);
      img.set(x + 8, y + 2, [255, 230, 150]);
      break;
    case 'fuse':
      rect(img, x, y + 1, 6, 3, [150, 156, 154]);
      rect(img, x, y + 1, 1, 3, [214, 172, 64]);
      rect(img, x + 5, y + 1, 1, 3, [214, 172, 64]);
      break;
    case 'page':
      rect(img, x, y, 6, 5, [230, 232, 222]);
      rect(img, x + 1, y + 1, 4, 1, [140, 140, 150]);
      rect(img, x + 1, y + 3, 3, 1, [140, 140, 150]);
      break;
    case 'key':
      rect(img, x, y, 7, 4, [60, 200, 220]);
      rect(img, x + 1, y + 1, 3, 1, [200, 250, 255]);
      img.set(x - 1, y - 1, [120, 230, 245]);
      img.set(x + 7, y + 4, [120, 230, 245]);
      break;
    default:
      break;
  }
}

function corpseFrame(outfit) {
  const body = new Image(PROP_FRAME_W, PROP_FRAME_H);
  ellipseFill(body, 22, 38, 12, 3.2, BLOOD, false);
  capsuleFill(body, { x: 27, y: 35 }, { x: 41, y: 38 }, 2.7, 2.1, outfit.pants);
  capsuleFill(body, { x: 27, y: 38 }, { x: 40, y: 41 }, 2.5, 2, mul(outfit.pants, 0.9));
  capsuleFill(body, { x: 14, y: 34 }, { x: 28, y: 36 }, 4.3, 3.9, outfit.shirt);
  capsuleFill(body, { x: 16, y: 32 }, { x: 24, y: 30 }, 1.9, 1.7, outfit.shirt);
  capsuleFill(body, { x: 17, y: 38 }, { x: 25, y: 41 }, 1.9, 1.7, outfit.shirt);
  ellipseFill(body, 24, 29.5, 1.5, 1.3, SKIN);
  ellipseFill(body, 26, 41.5, 1.5, 1.3, SKIN);
  ellipseFill(body, 10, 34, 3.7, 3.5, SKIN);
  if (outfit.hat) ellipseFill(body, 9.5, 31.6, 4.2, 2.4, outfit.hat);
  if (outfit.hair) ellipseFill(body, 9, 32.4, 3.6, 2.2, outfit.hair);
  if (outfit.mark) {
    for (const [mx, my] of outfit.mark.points) body.set(mx, my, outfit.mark.color);
  }
  body.outline();
  itemDraw(body, outfit.item, 3, 39);
  return propShadow(body, 19, 4.8);
}

const THE_DEAD = [
  { shirt: [140, 144, 140], pants: [58, 62, 66], hair: [60, 48, 40], item: 'badge', mark: { color: [150, 40, 36], points: [[20, 33], [20, 34], [21, 34], [22, 35]] } },
  { shirt: [38, 50, 80], pants: [30, 36, 52], hat: [28, 34, 52], item: 'map', mark: { color: [196, 168, 60], points: [[18, 32], [19, 32], [20, 32]] } },
  { shirt: [204, 210, 210], pants: [64, 80, 90], hair: [120, 120, 118], item: 'vial', mark: { color: [150, 34, 30], points: [[18, 33], [19, 33], [18, 34], [19, 34], [20, 35]] } },
  { shirt: [124, 84, 44], pants: [70, 58, 44], hat: [224, 142, 30], item: 'badge', mark: { color: [240, 210, 80], points: [[19, 32], [20, 32], [21, 32]] } },
  { shirt: [52, 82, 132], pants: [40, 60, 98], hair: [70, 52, 40], item: 'valve', mark: { color: [196, 156, 60], points: [[19, 34], [20, 34]] } },
  { shirt: [78, 56, 40], pants: [46, 40, 36], hat: [60, 66, 70], item: 'cutter', mark: { color: [255, 150, 50], points: [[18, 35], [19, 35]] } },
  { shirt: [64, 98, 84], pants: [52, 52, 60], hair: [150, 150, 150], item: 'page', mark: { color: [30, 34, 34], points: [[7, 33], [8, 33], [11, 33], [12, 33]] } },
  { shirt: [210, 176, 40], pants: [44, 46, 50], hat: [210, 176, 40], item: 'fuse', mark: { color: [30, 30, 30], points: [[19, 33], [21, 33], [23, 33]] } },
  { shirt: [92, 82, 114], pants: [44, 44, 56], hair: [30, 26, 34], item: 'page', mark: { color: [200, 190, 230], points: [[18, 34], [19, 34], [20, 34]] } },
  { shirt: [32, 38, 32], pants: [30, 34, 30], hair: [90, 70, 50], item: 'key', mark: { color: [196, 40, 36], points: [[22, 33], [22, 34], [22, 35], [22, 36]] } },
];

const BASE = PROP_BASE_Y;
const CX = PROP_BASE_X;

function floorProp(floor) {
  const img = new Image(PROP_FRAME_W, PROP_FRAME_H);
  switch (floor) {
    case 0: {
      isoBox(img, CX, BASE, 15, 7, 11, [128, 132, 128]);
      rect(img, CX - 6, BASE - 21, 10, 5, [20, 24, 24]);
      rect(img, CX - 5, BASE - 20, 8, 3, [70, 200, 150]);
      rect(img, CX + 2, BASE - 12, 4, 2, [210, 200, 150]);
      break;
    }
    case 1: {
      isoBox(img, CX, BASE, 14, 7, 5, [88, 78, 64]);
      isoBox(img, CX, BASE - 13, 14, 7, 3, [96, 86, 70]);
      for (const [px, py] of [[CX - 13, BASE - 2], [CX + 13, BASE - 2], [CX, BASE + 5]]) rect(img, px - 1, py - 14, 2, 14, [36, 34, 32]);
      rect(img, CX - 6, BASE - 19, 7, 2, [150, 130, 100]);
      break;
    }
    case 2: {
      isoBox(img, CX, BASE, 14, 7, 6, [204, 218, 218]);
      isoBox(img, CX - 6, BASE - 6, 5, 3, 2, [244, 250, 250]);
      fillPoly(img, [[CX + 1, BASE - 12], [CX + 13, BASE - 6], [CX, BASE + 1], [CX - 12, BASE - 5]], [90, 150, 176]);
      rect(img, CX + 15, BASE - 22, 1, 20, [170, 180, 180]);
      rect(img, CX + 13, BASE - 24, 5, 4, [190, 220, 230]);
      break;
    }
    case 3: {
      isoBox(img, CX, BASE - 3, 13, 6, 8, [102, 74, 48]);
      for (let i = 0; i < 12; i += 1) img.set(CX - 8 + ((i * 5) % 16), BASE - 14 - (i % 3), i % 2 ? [120, 120, 112] : [196, 160, 70]);
      for (const wx of [CX - 8, CX + 8]) ellipseFill(img, wx, BASE + 4, 3, 3, [40, 40, 42], false);
      break;
    }
    case 4: {
      isoBox(img, CX, BASE, 12, 6, 3, [70, 76, 92]);
      rect(img, CX - 8, BASE - 22, 16, 20, [60, 74, 126]);
      ellipseFill(img, CX, BASE - 22, 8, 3, [96, 112, 176], false);
      ellipseFill(img, CX + 11, BASE - 10, 4, 4, [104, 78, 170], false);
      ellipseFill(img, CX + 11, BASE - 10, 1.6, 1.6, [20, 20, 30], false);
      rect(img, CX - 9, BASE - 14, 18, 1, [30, 36, 70]);
      break;
    }
    case 5: {
      rect(img, CX - 9, BASE - 20, 18, 20, [60, 46, 40]);
      ellipseFill(img, CX, BASE, 9, 3.5, [60, 46, 40], false);
      ellipseFill(img, CX, BASE - 20, 9, 3.5, [50, 36, 30], false);
      ellipseFill(img, CX, BASE - 20, 7, 2.6, [255, 150, 40], false);
      ellipseFill(img, CX, BASE - 20, 4, 1.4, [255, 230, 150], false);
      rect(img, CX - 9, BASE - 10, 18, 2, [90, 40, 30]);
      for (const [sx, sy] of [[CX - 5, BASE - 26], [CX + 4, BASE - 28], [CX + 1, BASE - 31]]) img.set(sx, sy, [255, 190, 90]);
      break;
    }
    case 6: {
      isoBox(img, CX, BASE, 12, 5, 24, [58, 76, 70]);
      for (const sy of [BASE - 8, BASE - 15, BASE - 22]) rect(img, CX - 12, sy, 12, 1, [22, 30, 28]);
      const spines = [[190, 80, 60], [90, 140, 170], [200, 180, 80], [140, 150, 150]];
      for (let i = 0; i < 9; i += 1) rect(img, CX - 11 + i, BASE - 6 - (i % 3) * 7, 1, 5, spines[i % spines.length]);
      break;
    }
    case 7: {
      isoBox(img, CX, BASE, 13, 6, 14, [52, 62, 82]);
      for (const ix of [CX - 8, CX, CX + 8]) {
        rect(img, ix - 1, BASE - 24, 3, 7, [214, 196, 70]);
        rect(img, ix - 2, BASE - 25, 5, 1, [244, 232, 130]);
      }
      for (let i = 0; i < 5; i += 1) rect(img, CX - 11 + i * 2, BASE - 6, 1, 4, i % 2 ? [24, 24, 24] : [214, 196, 70]);
      break;
    }
    case 8: {
      isoBox(img, CX, BASE, 15, 7, 4, [70, 70, 64]);
      rect(img, CX - 12, BASE - 6, 24, 1, [210, 170, 40]);
      ellipseFill(img, CX, BASE - 11, 8, 5, [96, 100, 100]);
      ellipseFill(img, CX + 3, BASE - 11, 2, 1.8, [250, 170, 40], false);
      rect(img, CX - 10, BASE - 17, 1, 4, [60, 64, 64]);
      rect(img, CX + 9, BASE - 17, 1, 4, [60, 64, 64]);
      break;
    }
    case 9: {
      isoBox(img, CX, BASE, 13, 6, 8, [56, 74, 104]);
      fillPoly(img, [[CX - 10, BASE - 8], [CX + 10, BASE - 8], [CX + 10, BASE - 20], [CX - 10, BASE - 16]], [22, 30, 42]);
      fillPoly(img, [[CX - 8, BASE - 9], [CX + 8, BASE - 9], [CX + 8, BASE - 18], [CX - 8, BASE - 15]], [60, 150, 210]);
      rect(img, CX + 12, BASE - 34, 1, 26, [140, 150, 160]);
      img.set(CX + 12, BASE - 35, [230, 60, 50]);
      break;
    }
    default: {
      isoBox(img, CX, BASE, 10, 5, 28, [26, 28, 30]);
      rect(img, CX - 1, BASE - 28, 2, 26, [190, 36, 32]);
      rect(img, CX - 10, BASE - 14, 10, 1, [90, 96, 100]);
      ellipseFill(img, CX, BASE - 33, 4, 2, [210, 40, 36], false);
      break;
    }
  }
  img.outline();
  return propShadow(img);
}

function terminalProp() {
  const img = new Image(PROP_FRAME_W, PROP_FRAME_H);
  isoBox(img, CX, BASE, 11, 5, 13, [46, 52, 54]);
  fillPoly(img, [[CX - 10, BASE - 14], [CX + 10, BASE - 14], [CX + 10, BASE - 30], [CX - 10, BASE - 24]], [14, 18, 18]);
  fillPoly(img, [[CX - 8, BASE - 15], [CX + 8, BASE - 15], [CX + 8, BASE - 28], [CX - 8, BASE - 23]], [18, 54, 44]);
  for (let i = 0; i < 5; i += 1) rect(img, CX - 6, BASE - 26 + i * 2 + (i === 0 ? 1 : 0), 12 - (i % 3) * 3, 1, [120, 240, 170]);
  rect(img, CX - 7, BASE - 9, 14, 2, [24, 28, 28]);
  for (let i = 0; i < 6; i += 1) img.set(CX - 6 + i * 2, BASE - 9, [150, 160, 156]);
  img.set(CX + 8, BASE - 12, [230, 60, 50]);
  img.outline();
  return propShadow(img);
}

function explosiveBarrel() {
  const img = new Image(PROP_FRAME_W, PROP_FRAME_H);
  const red = [176, 52, 38];
  rect(img, CX - 8, BASE - 22, 16, 22, red);
  ellipseFill(img, CX, BASE, 8, 3.2, mul(red, 0.7), false);
  ellipseFill(img, CX, BASE - 22, 8, 3.2, mul(red, 1.25), false);
  for (const y of [BASE - 17, BASE - 5]) {
    rect(img, CX - 8, y, 16, 2, mul(red, 0.62));
    rect(img, CX - 8, y, 16, 1, mul(red, 0.9));
  }
  rect(img, CX - 8, BASE - 22, 3, 22, mul(red, 1.18));
  rect(img, CX + 5, BASE - 22, 3, 22, mul(red, 0.66));
  fillPoly(img, [[CX, BASE - 15], [CX + 4.5, BASE - 7], [CX - 4.5, BASE - 7]], [236, 196, 40]);
  rect(img, CX - 0, BASE - 12, 1, 3, [24, 20, 12]);
  img.set(CX, BASE - 8, [24, 20, 12]);
  rect(img, CX - 3, BASE - 24, 6, 2, [60, 62, 62]);
  img.outline();
  return propShadow(img, 12, 4);
}

function floorPropSheet() {
  const frames = [...THE_DEAD.map((outfit) => corpseFrame(outfit)), ...Array.from({ length: 11 }, (_, floor) => floorProp(floor)), terminalProp(), explosiveBarrel()];
  const sheet = new Image(PROP_FRAME_W * frames.length, PROP_FRAME_H);
  frames.forEach((frame, index) => sheet.blit(frame, index * PROP_FRAME_W, 0));
  return { sheet, count: frames.length };
}

function hudIcons() {
  const cross = new Image(12, 12);
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 12; x += 1) {
      const arm = (x >= 4 && x <= 7) || (y >= 4 && y <= 7);
      if (!arm) continue;
      const lit = x === 4 || y === 4;
      const shade = x === 7 || y === 7;
      cross.set(x, y, lit ? [140, 240, 170] : shade ? [40, 120, 70] : [80, 200, 120]);
    }
  }
  cross.outline();

  const bullet = (empty) => {
    const img = new Image(6, 12);
    const body = empty ? [44, 40, 34] : [200, 150, 60];
    const tip = empty ? [60, 56, 48] : [236, 214, 160];
    const light = empty ? [58, 54, 46] : [240, 196, 100];
    for (let y = 0; y < 12; y += 1) {
      for (let x = 1; x <= 4; x += 1) {
        if (y < 3) {
          if (x >= 2 && x <= 3) img.set(x, y, y === 0 ? tip : tip);
          else if (y >= 1 && (x === 1 || x === 4)) img.set(x, y, body);
        } else if (y < 10) {
          img.set(x, y, x === 1 ? light : x === 4 ? (empty ? [30, 28, 24] : [130, 90, 36]) : body);
        } else {
          img.set(x, y, empty ? [38, 34, 28] : [150, 110, 44]);
        }
      }
    }
    img.outline();
    return img;
  };
  return { cross, full: bullet(false), empty: bullet(true) };
}

// ---------- output ----------

function buildAtlas() {
  const atlas = new Image(ATLAS_W, ATLAS_H);
  const frames = [];
  atlas.blit(floorTile('steel'), 0, 0);
  atlas.blit(floorTile('concrete'), TILE_W, 0);
  atlas.blit(floorTile('grate'), TILE_W * 2, 0);
  frames.push({ name: 'floor_a', x: 0, y: 0 }, { name: 'floor_b', x: TILE_W, y: 0 }, { name: 'grate', x: TILE_W * 2, y: 0 });
  for (let variant = 0; variant < 8; variant += 1) {
    const x = (variant % WALL_COLUMNS) * TILE_W;
    const y = TILE_H + Math.floor(variant / WALL_COLUMNS) * WALL_IMG_H;
    atlas.blit(wallTile(variant), x, y);
    frames.push({ name: `wall_${variant}`, x, y });
  }
  return { atlas, frames };
}

async function mockCorridor(atlas) {
  const cols = 9;
  const rows = 6;
  const canvas = new Image(cols * TILE_W + 64, rows * TILE_H + WALL_H + 40);
  const frame = (name) => {
    const f = { floor_a: [0, 0], floor_b: [64, 0], grate: [128, 0] }[name];
    const out = new Image(TILE_W, TILE_H);
    for (let y = 0; y < TILE_H; y += 1) {
      for (let x = 0; x < TILE_W; x += 1) {
        const i = ((f[1] + y) * ATLAS_W + f[0] + x) * 4;
        if (atlas.data[i + 3]) out.set(x, y, [atlas.data[i], atlas.data[i + 1], atlas.data[i + 2]]);
      }
    }
    return out;
  };
  const wallFrame = (variant) => {
    const ox = (variant % WALL_COLUMNS) * TILE_W;
    const oy = TILE_H + Math.floor(variant / WALL_COLUMNS) * WALL_IMG_H;
    const out = new Image(TILE_W, WALL_IMG_H);
    for (let y = 0; y < WALL_IMG_H; y += 1) {
      for (let x = 0; x < TILE_W; x += 1) {
        const i = ((oy + y) * ATLAS_W + ox + x) * 4;
        if (atlas.data[i + 3]) out.set(x, y, [atlas.data[i], atlas.data[i + 1], atlas.data[i + 2]]);
      }
    }
    return out;
  };
  const originX = 5 * (TILE_W / 2) + 32;
  const place = (gx, gy) => ({ x: originX + (gx - gy) * (TILE_W / 2) - TILE_W / 2, y: 20 + WALL_H + (gx + gy) * (TILE_H / 2) - TILE_H / 2 });
  const floors = ['floor_a', 'floor_a', 'floor_b', 'floor_a', 'grate', 'floor_a'];
  for (let gy = 0; gy < 6; gy += 1) {
    for (let gx = 0; gx < 6; gx += 1) {
      const p = place(gx, gy);
      canvas.blit(frame(floors[(gx * 2 + gy) % floors.length]), p.x, p.y);
    }
  }
  for (let gx = 0; gx < 6; gx += 1) {
    const p = place(gx, -1);
    canvas.blit(wallFrame([0, 2, 1, 0, 3, 4][gx % 6]), p.x, p.y + TILE_H - WALL_IMG_H);
  }
  for (let gy = 0; gy < 6; gy += 1) {
    const p = place(-1, gy);
    canvas.blit(wallFrame([6, 0, 1, 5, 2, 7][gy % 6]), p.x, p.y + TILE_H - WALL_IMG_H);
  }
  return canvas;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(PREVIEW, { recursive: true });

  for (const [index, theme] of THEMES.entries()) {
    applyTheme(theme);
    const themed = buildAtlas().atlas;
    const file = index === 0 ? 'tiles.png' : `tiles_${index}.png`;
    await writeFile(path.join(OUT, file), await themed.png());
    const mockup = await mockCorridor(themed);
    await writeFile(path.join(PREVIEW, `corridor_${index}_${theme.name}.png`), await mockup.png(3));
  }
  applyTheme(THEMES[0]);
  const { atlas } = buildAtlas();

  const drones = DIRECTIONS.map((d) => droneFrame(d.yaw));
  const sheet = new Image(DRONE_W * 8, DRONE_H);
  drones.forEach((frame, index) => sheet.blit(frame, index * DRONE_W, 0));
  await writeFile(path.join(OUT, 'drone.png'), await sheet.png());

  const tanks = DIRECTIONS.map((d) => tankFrame(d.yaw));
  const tankSheet = new Image(TANK_W * 8, TANK_H);
  tanks.forEach((frame, index) => tankSheet.blit(frame, index * TANK_W, 0));
  await writeFile(path.join(OUT, 'tank.png'), await tankSheet.png());
  await writeFile(path.join(OUT, 'tank_dead.png'), await tankWreck().png());
  await writeFile(path.join(PREVIEW, 'tank-4x.png'), await tankSheet.png(4));
  const wardens = DIRECTIONS.map((d) => wardenFrame(d.yaw));
  const wardenSheet = new Image(WD_W * 8, WD_H);
  wardens.forEach((frame, index) => wardenSheet.blit(frame, index * WD_W, 0));
  await writeFile(path.join(OUT, 'warden.png'), await wardenSheet.png());
  await writeFile(path.join(OUT, 'warden_dead.png'), await wardenFrame(0, true).png());
  await writeFile(path.join(PREVIEW, 'warden-4x.png'), await wardenSheet.png(4));
  await writeFile(path.join(OUT, 'drone_dead.png'), await droneWreck().png());
  await writeFile(path.join(PREVIEW, 'drone-dead-8x.png'), await droneWreck().png(8));

  await writeFile(path.join(OUT, 'door_closed.png'), await doorTile(false).png());
  await writeFile(path.join(OUT, 'door_open.png'), await doorTile(true).png());
  await writeFile(path.join(OUT, 'loot.png'), await lootSheet().png());
  const props = new Image(64 * 2 + 16 + 64, 40);
  props.blit(doorTile(false), 0, 4);
  props.blit(doorTile(true), 68, 4);
  props.blit(lootSheet(), 140, 12);
  await writeFile(path.join(PREVIEW, 'door-loot-6x.png'), await props.png(6));

  const icons = hudIcons();
  await writeFile(path.join(OUT, 'hud_cross.png'), await icons.cross.png());
  await writeFile(path.join(OUT, 'hud_bullet.png'), await icons.full.png());
  await writeFile(path.join(OUT, 'hud_bullet_empty.png'), await icons.empty.png());
  const iconSheet = new Image(40, 20);
  iconSheet.blit(icons.cross, 2, 2);
  iconSheet.blit(icons.full, 18, 2);
  iconSheet.blit(icons.empty, 28, 2);
  await writeFile(path.join(PREVIEW, 'hud-icons-8x.png'), await iconSheet.png(8));

  const floorProps = floorPropSheet();
  await writeFile(path.join(OUT, 'props_floor.png'), await floorProps.sheet.png());
  await writeFile(path.join(PREVIEW, 'props-floor-4x.png'), await floorProps.sheet.png(4));

  const mock = await mockCorridor(atlas);
  await writeFile(path.join(PREVIEW, 'corridor.png'), await mock.png(3));
  await writeFile(path.join(PREVIEW, 'tiles-4x.png'), await atlas.png(4));
  await writeFile(path.join(PREVIEW, 'drone-4x.png'), await sheet.png(4));
  console.log('world v2 written to assets/art/v2 and art-preview/proposed/world_v2');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
