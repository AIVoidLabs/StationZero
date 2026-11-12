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

  const { atlas } = buildAtlas();
  await writeFile(path.join(OUT, 'tiles.png'), await atlas.png());

  const drones = DIRECTIONS.map((d) => droneFrame(d.yaw));
  const sheet = new Image(DRONE_W * 8, DRONE_H);
  drones.forEach((frame, index) => sheet.blit(frame, index * DRONE_W, 0));
  await writeFile(path.join(OUT, 'drone.png'), await sheet.png());

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
