import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.join(process.cwd(), 'art-preview', 'proposed', 'player_new');
const RUNTIME_V2 = path.join(process.cwd(), 'assets', 'art', 'v2');
const W = 32;
const H = 48;
const GROUND_Y = 46.2;
const CENTER_X = 16;
const DEPTH_TILT = 0.5;
const WALK_FRAMES = 6;

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

const C = {
  outline: [8, 10, 10],
  suit: [46, 58, 61],
  suitDark: [31, 38, 41],
  hood: [38, 47, 50],
  pack: [70, 89, 92],
  strap: [20, 24, 26],
  boot: [74, 72, 64],
  glove: [20, 24, 26],
  rust: [98, 46, 36],
  lamp: [217, 164, 65],
  mask: [111, 128, 127],
  face: [11, 13, 12],
  gun: [20, 24, 26],
  slide: [111, 128, 127],
  flashHot: [255, 244, 210],
  flashWarm: [217, 164, 65],
};

const rad = (deg) => (deg * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

function shade(color, band) {
  const k = band > 0 ? 1.4 : band < 0 ? 0.62 : 1;
  return [clamp(Math.round(color[0] * k), 0, 255), clamp(Math.round(color[1] * k), 0, 255), clamp(Math.round(color[2] * k), 0, 255)];
}

class Canvas {
  constructor() {
    this.data = new Uint8Array(W * H * 4);
  }

  set(x, y, color) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    this.data[i] = color[0];
    this.data[i + 1] = color[1];
    this.data[i + 2] = color[2];
    this.data[i + 3] = 255;
  }

  opaque(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return this.data[(y * W + x) * 4 + 3] > 0;
  }

  outline() {
    const edge = [];
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (this.opaque(x, y)) continue;
        if (this.opaque(x + 1, y) || this.opaque(x - 1, y) || this.opaque(x, y + 1) || this.opaque(x, y - 1)) {
          edge.push([x, y]);
        }
      }
    }
    for (const [x, y] of edge) this.set(x, y, C.outline);
  }
}

function lightBand(ox, oy) {
  const l = ox * -0.55 + oy * -0.85;
  if (l > 0.4) return 1;
  if (l < -0.45) return -1;
  return 0;
}

function capsule(canvas, a, b, ra, rb, color, patch) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const minX = Math.floor(Math.min(a.x - ra, b.x - rb)) - 1;
  const maxX = Math.ceil(Math.max(a.x + ra, b.x + rb)) + 1;
  const minY = Math.floor(Math.min(a.y - ra, b.y - rb)) - 1;
  const maxY = Math.ceil(Math.max(a.y + ra, b.y + rb)) + 1;
  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const cx = px + 0.5;
      const cy = py + 0.5;
      const t = len2 < 1e-6 ? 0 : clamp(((cx - a.x) * abx + (cy - a.y) * aby) / len2, 0, 1);
      const qx = a.x + abx * t;
      const qy = a.y + aby * t;
      const r = lerp(ra, rb, t);
      const d = Math.hypot(cx - qx, cy - qy);
      if (d > r) continue;
      let band = lightBand((cx - qx) / r, (cy - qy) / r);
      if (r >= 1.9 && d > r - 0.85) band = Math.min(band, -1);
      let base = color;
      if (patch && t >= patch.t0 && t <= patch.t1 && d < r - 0.7) base = patch.color;
      canvas.set(px, py, shade(base, band));
    }
  }
}

function ellipse(canvas, cx0, cy0, rx, ry, color, bands = true) {
  for (let py = Math.floor(cy0 - ry) - 1; py <= Math.ceil(cy0 + ry) + 1; py += 1) {
    for (let px = Math.floor(cx0 - rx) - 1; px <= Math.ceil(cx0 + rx) + 1; px += 1) {
      const ox = (px + 0.5 - cx0) / rx;
      const oy = (py + 0.5 - cy0) / ry;
      if (ox * ox + oy * oy > 1) continue;
      let band = bands ? lightBand(ox, oy) : 0;
      if (bands && rx >= 2 && ox * ox + oy * oy > 0.72) band = Math.min(band, -1);
      canvas.set(px, py, shade(color, band));
    }
  }
}

function roundBox(canvas, cx0, cy0, hw, hh, radius, color, opts = {}) {
  for (let py = Math.floor(cy0 - hh) - 1; py <= Math.ceil(cy0 + hh) + 1; py += 1) {
    for (let px = Math.floor(cx0 - hw) - 1; px <= Math.ceil(cx0 + hw) + 1; px += 1) {
      const dx = Math.abs(px + 0.5 - cx0) - (hw - radius);
      const dy = Math.abs(py + 0.5 - cy0) - (hh - radius);
      const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
      if (outside > 0) continue;
      const u = (px + 0.5 - cx0) / hw;
      const v = (py + 0.5 - cy0) / hh;
      let band = u < -0.4 ? 1 : u > 0.45 ? -1 : 0;
      if (v > 0.8) band = Math.min(band, -1);
      if (outside > -0.7 && hw > 3) band = Math.min(band, -1);
      let base = color;
      if (opts.stripe && Math.abs(u) < opts.stripe.width && v > opts.stripe.from) base = opts.stripe.color;
      if (opts.bandY && v > opts.bandY.from && v < opts.bandY.to) base = opts.bandY.color;
      canvas.set(px, py, shade(base, band));
    }
  }
}

function makeProjector(yawDeg) {
  const theta = rad(yawDeg);
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    cos,
    sin,
    project(lx, ly, lz, lift = 0) {
      const wx = -lx * cos + lz * sin;
      const wz = lx * sin + lz * cos;
      return { x: CENTER_X + wx, y: GROUND_Y - (ly + lift) + wz * DEPTH_TILT, depth: wz };
    },
  };
}

function twoBone(hip, target, l1, l2, bendForward) {
  const dx = target.lz - hip.lz;
  const dy = target.ly - hip.ly;
  const dist = clamp(Math.hypot(dx, dy), 0.001, l1 + l2 - 0.02);
  const nx = dx / Math.hypot(dx, dy || 1e-6);
  const ny = dy / Math.hypot(dx, dy || 1e-6);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const px = -ny;
  const py = nx;
  const sign = (bendForward ? 1 : -1) * (px >= 0 ? 1 : -1);
  const mx = hip.lz + nx * a;
  const my = hip.ly + ny * a;
  const knee = { lz: mx + px * h * sign, ly: my + py * h * sign };
  const end = { lz: hip.lz + nx * dist, ly: hip.ly + ny * dist };
  return { knee, end };
}

const HIP_Y = 19;
const SHOULDER_Y = 30.5;
const LEG_UPPER = 10.5;
const LEG_LOWER = 10.5;
const ARM_UPPER = 6.8;
const ARM_LOWER = 6.6;

function buildPrimitives(canvas, yaw, pose) {
  const view = makeProjector(yaw);
  const prims = [];
  const bob = pose.bob ?? 0;
  const aim = pose.aim ?? 0;

  const leg = (side, swing, lift) => {
    const lx = 2.9 * side;
    const hip = { lz: 0, ly: HIP_Y + bob };
    const foot = { lz: swing, ly: 0.9 + lift };
    const { knee, end } = twoBone(hip, foot, LEG_UPPER, LEG_LOWER, true);
    const pHip = view.project(lx, hip.ly, hip.lz);
    const pKnee = view.project(lx, knee.ly, knee.lz);
    const pAnkle = view.project(lx, end.ly, end.lz);
    const pToe = view.project(lx, end.ly - 0.6, end.lz + 3.6);
    const depth = (pHip.depth + pKnee.depth + pAnkle.depth) / 3 - 0.2;
    prims.push({
      depth,
      draw: () => {
        capsule(canvas, pKnee, pAnkle, 2.2, 2.0, C.suit, { t0: 0.05, t1: 0.3, color: C.rust });
        capsule(canvas, pHip, pKnee, 2.7, 2.3, C.suit);
        capsule(canvas, pAnkle, pToe, 2.1, 1.9, C.boot);
      },
    });
  };

  const stride = pose.stride ?? 0;
  const phase = pose.phase ?? 0;
  const swingR = pose.walking ? Math.sin(phase) * stride : 1.0;
  const swingL = pose.walking ? -Math.sin(phase) * stride : -1.0;
  const liftR = pose.walking ? Math.max(0, Math.cos(phase)) * 4 : 0;
  const liftL = pose.walking ? Math.max(0, -Math.cos(phase)) * 4 : 0;
  leg(1, swingR, liftR);
  leg(-1, swingL, liftL);

  const arm = (side, handLz, handLy, handLx, gun) => {
    const sx = 6.3 * side;
    const shoulder = { lz: 0.3, ly: SHOULDER_Y + bob };
    const { knee: elbow, end: hand } = twoBone(shoulder, { lz: handLz, ly: handLy + bob }, ARM_UPPER, ARM_LOWER, false);
    const pShoulder = view.project(sx, shoulder.ly, shoulder.lz);
    const pElbow = view.project(lerp(sx, handLx, 0.5), elbow.ly, elbow.lz);
    const pHand = view.project(handLx, hand.ly, hand.lz);
    const depth = (pShoulder.depth + pHand.depth) / 2 + 0.1;
    const pMuzzle = gun ? view.project(handLx, hand.ly + 0.6, hand.lz + 5.8) : null;
    prims.push({
      depth,
      draw: () => {
        capsule(canvas, pShoulder, pElbow, 2.4, 2.0, C.suit);
        capsule(canvas, pElbow, pHand, 2.0, 1.7, C.suit);
        if (gun && pMuzzle) {
          capsule(canvas, pHand, pMuzzle, 1.5, 1.3, C.gun);
          capsule(canvas, { x: pHand.x, y: pHand.y - 1 }, { x: pMuzzle.x, y: pMuzzle.y - 1 }, 0.55, 0.55, C.slide);
        }
        ellipse(canvas, pHand.x, pHand.y, 1.7, 1.7, C.glove);
      },
    });
    return pMuzzle;
  };

  const swingArm = pose.walking ? Math.sin(phase) * stride * 0.8 : 0;
  const recoil = pose.recoil ?? 0;
  const aimHand = {
    lz: lerp(0.6 - swingArm, 10.5 - recoil, aim),
    ly: lerp(SHOULDER_Y - 12, SHOULDER_Y - 0.5, aim),
    lx: lerp(7.2, 3.4, aim),
  };
  const muzzle = arm(1, aimHand.lz, aimHand.ly, aimHand.lx, aim > 0.3);
  arm(-1, 0.6 + swingArm, SHOULDER_Y - 12, -7.2, false);

  const torsoCenter = view.project(0, 24, 0, bob);
  const torsoHalfW = 6.1 * Math.abs(view.cos) + 3.8 * Math.abs(view.sin) + 0.4;
  prims.push({
    depth: 0,
    draw: () => {
      roundBox(canvas, torsoCenter.x, torsoCenter.y, torsoHalfW, 7.8, 2.4, C.suit, {
        bandY: { from: 0.55, to: 0.78, color: C.strap },
      });
      const front = view.cos;
      if (front > 0.35) {
        const pouchX = torsoCenter.x - view.sin * 3.5;
        roundBox(canvas, pouchX, torsoCenter.y - 1, 2.1 * front + 0.4, 2.6, 1, C.pack);
      }
    },
  });

  const hips = view.project(0, HIP_Y + 0.5, 0, bob);
  prims.push({
    depth: -0.3,
    draw: () => roundBox(canvas, hips.x, hips.y, 5.2 * Math.abs(view.cos) + 3.4 * Math.abs(view.sin) + 0.4, 3.2, 1.6, C.suitDark),
  });

  const pack = view.project(0, 26, -5.2, bob);
  prims.push({
    depth: pack.depth,
    draw: () => {
      const halfW = 5 * Math.abs(view.cos) + 3.2 * Math.abs(view.sin) + 0.3;
      roundBox(canvas, pack.x, pack.y, halfW, 6.6, 1.6, C.pack, {
        stripe: { width: 0.18, from: -1, color: C.strap },
      });
    },
  });

  const head = view.project(0, 37.6, 0.2, bob);
  prims.push({
    depth: 0.4,
    draw: () => {
      ellipse(canvas, head.x, head.y, 6.1, 6.3, C.hood);
      const peak = view.project(0, 42.6, -2.2, bob);
      ellipse(canvas, peak.x, peak.y + 0.6, 2.4, 2.2, C.hood);
      const forwardZ = view.cos;
      if (forwardZ > 0.1) {
        const fx = head.x + view.sin * 4.6;
        const rx = 3.6 * Math.max(0.3, forwardZ);
        ellipse(canvas, fx, head.y + 0.4, rx, 4.1, C.face, false);
        if (forwardZ > 0.55) {
          ellipse(canvas, fx, head.y + 2.4, rx * 0.75, 1.7, C.mask);
          canvas.set(Math.floor(fx), Math.floor(head.y + 5), C.strap);
          canvas.set(Math.floor(fx), Math.floor(head.y + 6), C.strap);
        } else {
          ellipse(canvas, fx + view.sin * 0.6, head.y + 2.2, rx * 0.8, 1.5, C.mask);
        }
      }
    },
  });

  const lamp = view.project(-7.4, SHOULDER_Y - 0.8, 0.4, bob);
  prims.push({
    depth: lamp.depth + 0.5,
    draw: () => {
      ellipse(canvas, lamp.x, lamp.y, 1.5, 1.5, C.lamp, false);
      canvas.set(Math.floor(lamp.x), Math.floor(lamp.y), C.flashHot);
    },
  });

  if (pose.flash && muzzle) {
    prims.push({
      depth: 999,
      draw: () => {
        const dx = Math.sign(muzzle.x - (CENTER_X + 0)) || 0;
        ellipse(canvas, muzzle.x + dx, muzzle.y, 2.0, 2.0, C.flashWarm, false);
        ellipse(canvas, muzzle.x + dx, muzzle.y, 1.1, 1.1, C.flashHot, false);
      },
    });
  }

  return prims;
}

function renderFrame(yaw, pose) {
  const canvas = new Canvas();
  const prims = buildPrimitives(canvas, yaw, pose);
  prims.sort((a, b) => a.depth - b.depth);
  for (const prim of prims) prim.draw();
  canvas.outline();
  return canvas;
}

function idlePose() {
  return { bob: 0 };
}

function walkPose(step) {
  const phase = (step / WALK_FRAMES) * Math.PI * 2;
  return { walking: true, phase, stride: 5.4, bob: 1.1 * Math.cos(phase) ** 2 - 0.5 };
}

function aimPoses() {
  return [
    { aim: 0.6, bob: 0 },
    { aim: 1, bob: 0, recoil: 1.6, flash: true },
    { aim: 0.45, bob: 0 },
  ];
}

async function sheetPng(frames, columns, scale = 1) {
  const rows = Math.ceil(frames.length / columns);
  const sheet = Buffer.alloc(columns * W * rows * H * 4);
  frames.forEach((frame, index) => {
    const ox = (index % columns) * W;
    const oy = Math.floor(index / columns) * H;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const src = (y * W + x) * 4;
        const dst = ((oy + y) * columns * W + ox + x) * 4;
        sheet[dst] = frame.data[src];
        sheet[dst + 1] = frame.data[src + 1];
        sheet[dst + 2] = frame.data[src + 2];
        sheet[dst + 3] = frame.data[src + 3];
      }
    }
  });
  let img = sharp(sheet, { raw: { width: columns * W, height: rows * H, channels: 4 } });
  if (scale > 1) img = img.resize({ width: columns * W * scale, kernel: 'nearest' });
  return img.png().toBuffer();
}

async function compare(rows, labels, scale) {
  const labelW = 54;
  const cols = Math.max(...rows.map((r) => r.length));
  const cellW = W * scale;
  const cellH = H * scale;
  const composites = [];
  const svg = [];
  for (let r = 0; r < rows.length; r += 1) {
    svg.push(`<text x="6" y="${r * cellH + 24}" font-family="monospace" font-size="16" fill="#d9a441">${labels[r]}</text>`);
    for (let c = 0; c < rows[r].length; c += 1) {
      composites.push({ input: await sheetPng([rows[r][c]], 1, scale), left: labelW + c * cellW, top: r * cellH });
    }
  }
  const width = labelW + cols * cellW;
  const height = rows.length * cellH;
  composites.push({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svg.join('')}</svg>`),
    left: 0,
    top: 0,
  });
  return sharp({ create: { width, height, channels: 4, background: { r: 58, g: 58, b: 58, alpha: 1 } } })
    .composite(composites)
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(RUNTIME_V2, { recursive: true });
  const idle = DIRECTIONS.map((d) => renderFrame(d.yaw, idlePose()));
  const walk = DIRECTIONS.flatMap((d) => Array.from({ length: WALK_FRAMES }, (_, step) => renderFrame(d.yaw, walkPose(step))));
  const aim = DIRECTIONS.flatMap((d) => aimPoses().map((pose) => renderFrame(d.yaw, pose)));

  await writeFile(path.join(OUT, 'player.png'), await sheetPng(idle, 8));
  await writeFile(path.join(OUT, 'player_walk.png'), await sheetPng(walk, DIRECTIONS.length * WALK_FRAMES));
  await writeFile(path.join(OUT, 'player_aim.png'), await sheetPng(aim, DIRECTIONS.length * 3));

  for (const name of ['player.png', 'player_walk.png', 'player_aim.png']) {
    await copyFile(path.join(OUT, name), path.join(RUNTIME_V2, name));
  }

  const rows = DIRECTIONS.map((_, d) => [
    idle[d],
    ...walk.slice(d * WALK_FRAMES, (d + 1) * WALK_FRAMES),
    ...aim.slice(d * 3, d * 3 + 3),
  ]);
  await writeFile(path.join(OUT, 'compare.png'), await compare(rows, DIRECTIONS.map((d) => d.name), 4));
  console.log('player_new written');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
