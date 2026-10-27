import type { Scene } from 'phaser';
import {
  DRONE_HEIGHT,
  DRONE_WIDTH,
  PALETTE,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
} from '../data/config';
import {
  DRONE_SPRITE_KEY,
  PLAYER_DIRECTIONS,
  PLAYER_SPRITE_KEY,
  SOURCE_TEXTURES,
  type Direction,
} from '../assets/manifest';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import { createRng, seedFromString } from '../utils/random';

const SOURCE_SIZE = 128;

export const LOOT_SPRITE_KEY = 'loot_stim';

export const DESCENT_HATCH_KEY = 'descent_hatch';
export const DESCENT_GLOW_KEY = 'descent_glow';
export const DESCENT_SIGNAL_KEY = 'descent_signal';
export const DESCENT_SHAFT_KEY = 'descent_shaft';

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function speckle(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  colors: readonly number[],
  count: number,
  maxSize = 2,
): void {
  for (let i = 0; i < count; i += 1) {
    const color = colors[Math.floor(rng() * colors.length)];
    if (color === undefined) continue;
    ctx.fillStyle = hex(color);
    const size = 1 + Math.floor(rng() * maxSize);
    ctx.fillRect(Math.floor(rng() * SOURCE_SIZE), Math.floor(rng() * SOURCE_SIZE), size, size);
  }
}

function crack(ctx: CanvasRenderingContext2D, rng: () => number, startX: number, startY: number): void {
  ctx.fillStyle = hex(PALETTE.shadow);
  let x = startX;
  let y = startY;
  for (let i = 0; i < 26; i += 1) {
    if (x < 0 || y < 0 || x >= SOURCE_SIZE || y >= SOURCE_SIZE) break;
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    if (rng() < 0.45) x += rng() < 0.5 ? -1 : 1;
    if (rng() < 0.7) y += 1;
  }
}

function drawFloorSteel(ctx: CanvasRenderingContext2D, rng: () => number): void {
  ctx.fillStyle = hex(PALETTE.steel);
  ctx.fillRect(0, 0, SOURCE_SIZE, SOURCE_SIZE);

  for (let y = 0; y < SOURCE_SIZE; y += 32) {
    ctx.fillStyle = hex(PALETTE.steelDark);
    ctx.fillRect(0, y, SOURCE_SIZE, 1);
    const offset = (y / 32) % 2 === 0 ? 0 : 16;
    for (let x = offset; x < SOURCE_SIZE; x += 32) {
      ctx.fillRect(x, y, 1, 32);
      ctx.fillStyle = hex(PALETTE.steelLight);
      ctx.fillRect(x + 2, y + 2, 2, 2);
      ctx.fillStyle = hex(PALETTE.steelDark);
      ctx.fillRect(x + 2, y + 2, 1, 1);
    }
  }

  speckle(ctx, rng, [PALETTE.steelDark, PALETTE.steelLight, PALETTE.shadow], 420, 2);
  speckle(ctx, rng, [PALETTE.rust, PALETTE.blood], 26, 4);

  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = hex(rng() < 0.5 ? PALETTE.steelLight : PALETTE.shadow);
    ctx.fillRect(Math.floor(rng() * SOURCE_SIZE), Math.floor(rng() * SOURCE_SIZE), 4 + Math.floor(rng() * 10), 1);
  }
}

function drawFloorConcrete(ctx: CanvasRenderingContext2D, rng: () => number): void {
  ctx.fillStyle = hex(PALETTE.steel);
  ctx.fillRect(0, 0, SOURCE_SIZE, SOURCE_SIZE);

  for (let y = 0; y < SOURCE_SIZE; y += 4) {
    for (let x = 0; x < SOURCE_SIZE; x += 4) {
      if (rng() < 0.28) {
        ctx.fillStyle = hex(rng() < 0.5 ? PALETTE.steelDark : PALETTE.steelLight);
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  speckle(ctx, rng, [PALETTE.steelDark, PALETTE.bone, PALETTE.shadow], 460, 2);
  speckle(ctx, rng, [PALETTE.rust, PALETTE.blood], 18, 3);

  for (let i = 0; i < 10; i += 1) {
    crack(ctx, rng, rng() * SOURCE_SIZE, rng() * SOURCE_SIZE);
  }
}

function drawGrate(ctx: CanvasRenderingContext2D, rng: () => number): void {
  ctx.fillStyle = hex(PALETTE.nearBlack);
  ctx.fillRect(0, 0, SOURCE_SIZE, SOURCE_SIZE);

  for (let x = 0; x < SOURCE_SIZE; x += 8) {
    ctx.fillStyle = hex(PALETTE.steel);
    ctx.fillRect(x, 0, 4, SOURCE_SIZE);
    ctx.fillStyle = hex(PALETTE.steelLight);
    ctx.fillRect(x, 0, 1, SOURCE_SIZE);
    ctx.fillStyle = hex(PALETTE.shadow);
    ctx.fillRect(x + 3, 0, 1, SOURCE_SIZE);
  }

  for (let y = 0; y < SOURCE_SIZE; y += 24) {
    ctx.fillStyle = hex(PALETTE.steelDark);
    ctx.fillRect(0, y, SOURCE_SIZE, 3);
    ctx.fillStyle = hex(PALETTE.steelLight);
    ctx.fillRect(0, y, SOURCE_SIZE, 1);
  }

  speckle(ctx, rng, [PALETTE.rust, PALETTE.blood, PALETTE.steelLight], 60, 3);
}

function drawWallSteel(ctx: CanvasRenderingContext2D, rng: () => number): void {
  ctx.fillStyle = hex(PALETTE.steelDark);
  ctx.fillRect(0, 0, SOURCE_SIZE, SOURCE_SIZE);

  for (let x = 0; x < SOURCE_SIZE; x += 32) {
    ctx.fillStyle = hex(PALETTE.void);
    ctx.fillRect(x, 0, 1, SOURCE_SIZE);
    ctx.fillStyle = hex(PALETTE.steel);
    ctx.fillRect(x + 1, 0, 2, SOURCE_SIZE);
    for (let y = 12; y < SOURCE_SIZE; y += 24) {
      ctx.fillStyle = hex(PALETTE.steelLight);
      ctx.fillRect(x + 4, y, 2, 2);
      ctx.fillStyle = hex(PALETTE.void);
      ctx.fillRect(x + 4, y + 1, 1, 1);
    }
  }

  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = hex(PALETTE.rust);
    const x = Math.floor(rng() * SOURCE_SIZE);
    const y = Math.floor(rng() * SOURCE_SIZE);
    ctx.fillRect(x, y, 1, 4 + Math.floor(rng() * 22));
    if (rng() < 0.4) {
      ctx.fillStyle = hex(PALETTE.blood);
      ctx.fillRect(x + 1, y + 2, 1, 3 + Math.floor(rng() * 10));
    }
  }

  speckle(ctx, rng, [PALETTE.steel, PALETTE.void, PALETTE.steelLight], 380, 2);
}

function drawWallDamaged(ctx: CanvasRenderingContext2D, rng: () => number): void {
  drawWallSteel(ctx, rng);

  for (let i = 0; i < 7; i += 1) {
    const x = Math.floor(rng() * (SOURCE_SIZE - 20));
    const y = Math.floor(rng() * (SOURCE_SIZE - 16));
    ctx.fillStyle = hex(PALETTE.shadow);
    ctx.fillRect(x, y, 10 + Math.floor(rng() * 12), 5 + Math.floor(rng() * 7));
    ctx.fillStyle = hex(PALETTE.steelLight);
    ctx.fillRect(x, y, 10 + Math.floor(rng() * 12), 1);
  }

  ctx.fillStyle = hex(PALETTE.bone);
  ctx.fillRect(20, 60, 30, 1);
  ctx.fillRect(20, 60, 1, 18);

  speckle(ctx, rng, [PALETTE.rust, PALETTE.blood], 60, 5);
}

function drawSource(ctx: CanvasRenderingContext2D, key: string): void {
  const rng = createRng(seedFromString(key));
  if (key === 'src_floor_a') drawFloorSteel(ctx, rng);
  else if (key === 'src_floor_b') drawFloorConcrete(ctx, rng);
  else if (key === 'src_grate') drawGrate(ctx, rng);
  else if (key === 'src_wall_a') drawWallSteel(ctx, rng);
  else drawWallDamaged(ctx, rng);
}

type View = 'front' | 'back' | 'side';

interface Pose {
  readonly view: View;
  readonly mirror: boolean;
  readonly turn: number;
}

const POSES: Readonly<Record<Direction, Pose>> = {
  S: { view: 'front', mirror: false, turn: 0 },
  N: { view: 'back', mirror: false, turn: 0 },
  E: { view: 'side', mirror: false, turn: 0 },
  W: { view: 'side', mirror: true, turn: 0 },
  SE: { view: 'front', mirror: false, turn: 1 },
  SW: { view: 'front', mirror: true, turn: 1 },
  NE: { view: 'back', mirror: false, turn: -1 },
  NW: { view: 'back', mirror: true, turn: -1 },
};

function drawExileBody(
  pose: Pose,
  rect: (color: number, x: number, y: number, w: number, h: number) => void,
): void {
  const lean = Math.round(pose.turn * 1.5);
  const side = pose.view === 'side';
  const torsoX = 9 + lean;
  const torsoWidth = side ? 10 : 14;

  rect(PALETTE.nearBlack, 10 + lean, 42, 5, 6);
  rect(PALETTE.nearBlack, 17 + lean, 42, 5, 6);
  rect(PALETTE.steelLight, 10 + lean, 42, 5, 1);

  rect(PALETTE.steelDark, 11 + lean, 31, 4, 11);
  rect(PALETTE.steelDark, 17 + lean, 31, 4, 11);

  rect(PALETTE.steel, torsoX, 17, torsoWidth, 16);
  rect(PALETTE.steelDark, torsoX, 17, side ? 2 : 3, 16);
  rect(PALETTE.nearBlack, torsoX, 31, torsoWidth, 2);
  rect(PALETTE.steelLight, torsoX + torsoWidth - 2, 19, 1, 12);

  if (side) {
    rect(PALETTE.steelDark, torsoX - 2, 20, 3, 10);
    rect(PALETTE.bone, torsoX - 1, 29, 2, 2);
    rect(PALETTE.steelDark, torsoX + torsoWidth - 2, 20, 3, 9);
    rect(PALETTE.bone, torsoX + torsoWidth - 1, 28, 2, 2);
  } else {
    rect(PALETTE.steelDark, torsoX - 3, 20, 3, 11);
    rect(PALETTE.steelDark, torsoX + torsoWidth, 20, 3, 11);
    rect(PALETTE.bone, torsoX - 2, 30, 2, 2);
    rect(PALETTE.bone, torsoX + torsoWidth, 30, 2, 2);
  }

  const headX = (side ? 11 : 10) + lean;
  const headWidth = side ? 8 : 12;

  rect(PALETTE.shadow, headX - 1, 13, headWidth + 2, 5);
  rect(PALETTE.steelDark, headX, 5, headWidth, 9);
  rect(PALETTE.steelDark, headX + 1, 3, headWidth - 2, 3);
  rect(PALETTE.steelLight, headX + headWidth - 1, 7, 1, 6);

  if (pose.view === 'front') {
    rect(PALETTE.shadow, headX + 1, 9, headWidth - 2, 3);
    rect(PALETTE.bone, headX + 1, 12, headWidth - 2, 2);
    const eyeShift = Math.round(pose.turn * 2);
    rect(PALETTE.nearBlack, headX + 2 + eyeShift, 10, 2, 1);
    rect(PALETTE.nearBlack, headX + headWidth - 4 + eyeShift, 10, 2, 1);
    rect(PALETTE.amber, headX - 2, 13, 3, 3);
    rect(PALETTE.steelLight, headX - 2, 12, 3, 1);
  } else if (pose.view === 'back') {
    rect(PALETTE.shadow, headX + Math.round(headWidth / 2) - 1, 5, 2, 8);
    rect(PALETTE.steel, headX + 2, 14, headWidth - 4, 2);
    rect(PALETTE.steelDark, headX - 2, 16, 3, 8);
    rect(PALETTE.amber, torsoX + torsoWidth + 1, 21, 2, 2);
  } else {
    rect(PALETTE.shadow, headX + headWidth - 3, 8, 2, 5);
    rect(PALETTE.bone, headX + headWidth - 2, 10, 1, 2);
    rect(PALETTE.amber, headX + headWidth - 1, 8, 2, 2);
    rect(PALETTE.amber, torsoX + torsoWidth + 1, 23, 3, 4);
    rect(PALETTE.amberDim, torsoX + torsoWidth + 1, 27, 3, 1);
  }

  if (pose.view !== 'side') {
    rect(PALETTE.amber, torsoX + torsoWidth + 1, 24, 3, 4);
    rect(PALETTE.amberDim, torsoX + torsoWidth + 1, 28, 3, 1);
    rect(PALETTE.nearBlack, torsoX + torsoWidth, 22, 1, 7);
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, direction: Direction): void {
  const pose = POSES[direction];

  ctx.save();
  if (pose.mirror) {
    ctx.translate(PLAYER_WIDTH, 0);
    ctx.scale(-1, 1);
  }

  const rect = (color: number, x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, w, h);
  };

  drawExileBody(pose, rect);
  ctx.restore();
}

function drawDrone(ctx: CanvasRenderingContext2D, direction: Direction): void {
  const pose = POSES[direction];

  ctx.save();
  if (pose.mirror) {
    ctx.translate(DRONE_WIDTH, 0);
    ctx.scale(-1, 1);
  }

  const rect = (color: number, x: number, y: number, w: number, h: number): void => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, w, h);
  };

  const lean = Math.round(pose.turn * 2);
  const side = pose.view === 'side';

  rect(PALETTE.shadow, 5, 31, 30, 2);

  if (side) {
    rect(PALETTE.steelDark, 30, 19, 5, 8);
    rect(PALETTE.steel, 30, 19, 1, 8);
    rect(PALETTE.steelDark, 6, 16, 7, 4);
    rect(PALETTE.steelLight, 6, 16, 7, 1);
    rect(PALETTE.steel, 9, 22, 3, 2);
  } else {
    rect(PALETTE.steelDark, 3, 19, 7, 8);
    rect(PALETTE.steel, 4, 19, 1, 8);
    rect(PALETTE.rust, 5, 24, 2, 3);
    rect(PALETTE.steelDark, 30, 19, 7, 8);
    rect(PALETTE.steelLight, 30, 19, 7, 1);
    rect(PALETTE.steel, 10, 22, 3, 2);
    rect(PALETTE.steel, 27, 22, 3, 2);
  }

  const bodyX = 11 + lean;
  const bodyWidth = side ? 17 : 18;
  rect(PALETTE.steelDark, bodyX, 18, bodyWidth, 12);
  rect(PALETTE.steel, bodyX + 1, 18, bodyWidth - 2, 3);
  rect(PALETTE.steelLight, bodyX + 1, 18, bodyWidth - 2, 1);
  rect(PALETTE.shadow, bodyX + 1, 27, bodyWidth - 2, 3);
  rect(PALETTE.steel, bodyX + 3, 22, 1, 4);
  rect(PALETTE.rust, bodyX + 2, 25, 3, 2);

  rect(PALETTE.steel, side ? bodyX + 5 : 19, 11, 1, 7);
  rect(PALETTE.signal, side ? bodyX + 5 : 19, 10, 1, 1);

  if (pose.view === 'front') {
    rect(PALETTE.shadow, bodyX + 4, 22, 10, 7);
    rect(PALETTE.cyan, bodyX + 5, 23, 8, 5);
    rect(PALETTE.boneLight, bodyX + 7, 24, 1, 1);
    rect(PALETTE.boneLight, bodyX + 11, 24, 1, 1);
    rect(PALETTE.cyan, bodyX + 5, 26, 8, 1);
  } else if (pose.view === 'back') {
    rect(PALETTE.shadow, bodyX + 4, 23, 10, 5);
    rect(PALETTE.steel, bodyX + 5, 23, 8, 1);
    rect(PALETTE.cyan, bodyX + 5, 27, 3, 1);
    rect(PALETTE.cyan, bodyX + 11, 27, 3, 1);
  } else {
    rect(PALETTE.shadow, bodyX + bodyWidth - 6, 21, 6, 7);
    rect(PALETTE.cyan, bodyX + bodyWidth - 5, 22, 4, 4);
    rect(PALETTE.boneLight, bodyX + bodyWidth - 4, 23, 1, 1);
  }

  rect(PALETTE.nearBlack, bodyX + 3, 30, 11, 1);
  rect(PALETTE.steelDark, bodyX + 4, 29, 9, 1);

  ctx.restore();
}

const DIAMOND: readonly (readonly [number, number])[] = [
  [32, 2],
  [62, 16],
  [32, 30],
  [2, 16],
];

function traceDiamond(ctx: CanvasRenderingContext2D): boolean {
  const first = DIAMOND[0];
  if (!first) return false;

  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < DIAMOND.length; i += 1) {
    const point = DIAMOND[i];
    if (point) ctx.lineTo(point[0], point[1]);
  }
  ctx.closePath();
  return true;
}

function drawMarker(ctx: CanvasRenderingContext2D, reachable: boolean): void {
  const color = reachable ? PALETTE.amber : PALETTE.rust;

  if (!traceDiamond(ctx)) return;

  ctx.fillStyle = `rgba(5, 5, 5, 0.28)`;
  ctx.fill();
  ctx.strokeStyle = hex(color);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = hex(color);
  if (reachable) {
    ctx.fillRect(30, 14, 4, 4);
    ctx.fillRect(31, 13, 2, 6);
    ctx.fillRect(29, 15, 6, 2);
  } else {
    ctx.fillRect(24, 15, 16, 2);
    ctx.strokeStyle = hex(color);
    ctx.beginPath();
    ctx.moveTo(24, 8);
    ctx.lineTo(40, 24);
    ctx.moveTo(40, 8);
    ctx.lineTo(24, 24);
    ctx.stroke();
  }
}

function drawHover(ctx: CanvasRenderingContext2D, reachable: boolean): void {
  const color = reachable ? PALETTE.amber : PALETTE.signal;

  if (!traceDiamond(ctx)) return;

  ctx.fillStyle = `rgba(5, 5, 5, 0.16)`;
  ctx.fill();
  ctx.strokeStyle = hex(color);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = hex(color);
  if (reachable) {
    ctx.fillRect(30, 14, 4, 4);
  } else {
    ctx.fillRect(29, 15, 6, 2);
    ctx.strokeStyle = hex(color);
    ctx.beginPath();
    ctx.moveTo(27, 11);
    ctx.lineTo(37, 21);
    ctx.moveTo(37, 11);
    ctx.lineTo(27, 21);
    ctx.stroke();
  }
}

function drawShadow(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(16, 6, 1, 16, 6, 15);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.28)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 12);
}

function traceGateDiamond(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
): void {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - halfHeight);
  ctx.lineTo(centerX + halfWidth, centerY);
  ctx.lineTo(centerX, centerY + halfHeight);
  ctx.lineTo(centerX - halfWidth, centerY);
  ctx.closePath();
}

function drawDescentHatch(ctx: CanvasRenderingContext2D): void {
  const centerX = 32;
  const centerY = 16;

  ctx.clearRect(0, 0, 64, 32);

  traceGateDiamond(ctx, centerX, centerY, 31, 15);
  ctx.fillStyle = hex(PALETTE.steelDark);
  ctx.fill();

  traceGateDiamond(ctx, centerX, centerY, 28, 13);
  ctx.fillStyle = hex(PALETTE.steel);
  ctx.fill();

  traceGateDiamond(ctx, centerX, centerY, 23, 10);
  ctx.fillStyle = hex(PALETTE.void);
  ctx.fill();

  ctx.save();
  traceGateDiamond(ctx, centerX, centerY, 23, 10);
  ctx.clip();

  for (let y = 8; y < 26; y += 4) {
    const offset = Math.abs(y - centerY) / 10;
    const halfWidth = 23 * (1 - offset);
    ctx.strokeStyle = hex(PALETTE.steelDark);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - halfWidth, y);
    ctx.lineTo(centerX + halfWidth, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = hex(PALETTE.rust);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 10);
  ctx.lineTo(12, 13);
  ctx.moveTo(56, 10);
  ctx.lineTo(52, 13);
  ctx.stroke();

  traceGateDiamond(ctx, centerX, centerY, 28, 13);
  ctx.strokeStyle = 'rgba(201, 196, 180, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawDescentGlow(ctx: CanvasRenderingContext2D): void {
  const half = 48;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  const r = (PALETTE.amber >> 16) & 0xff;
  const g = (PALETTE.amber >> 8) & 0xff;
  const b = PALETTE.amber & 0xff;

  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.5)`);
  gradient.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.2)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
}

function drawDescentSignal(ctx: CanvasRenderingContext2D): void {
  const half = 16;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 214, 150, 0.95)');
  gradient.addColorStop(0.25, 'rgba(217, 164, 65, 0.55)');
  gradient.addColorStop(1, 'rgba(217, 164, 65, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
}

function drawDescentShaft(ctx: CanvasRenderingContext2D): void {
  const width = 32;
  const height = 120;
  const r = (PALETTE.amber >> 16) & 0xff;
  const g = (PALETTE.amber >> 8) & 0xff;
  const b = PALETTE.amber & 0xff;
  const centerX = width / 2;

  const beam = ctx.createLinearGradient(0, height, 0, 0);
  beam.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.6)`);
  beam.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.22)`);
  beam.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(centerX - 9, height);
  ctx.lineTo(centerX - 2, 0);
  ctx.lineTo(centerX + 2, 0);
  ctx.lineTo(centerX + 9, height);
  ctx.closePath();
  ctx.fill();

  const core = ctx.createLinearGradient(0, height, 0, 0);
  core.addColorStop(0, 'rgba(255, 226, 170, 0.7)');
  core.addColorStop(0.5, 'rgba(255, 214, 150, 0.18)');
  core.addColorStop(1, 'rgba(255, 214, 150, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(centerX - 2, 0, 4, height);
}

function drawLootStim(ctx: CanvasRenderingContext2D): void {
  const px = (color: number, x: number, y: number, width = 1, height = 1): void => {
    ctx.fillStyle = hex(color);
    ctx.fillRect(x, y, width, height);
  };

  px(PALETTE.shadow, 4, 14, 8, 1);

  px(PALETTE.steelDark, 5, 4, 6, 10);
  px(PALETTE.steel, 5, 4, 1, 10);
  px(PALETTE.steelLight, 10, 4, 1, 10);

  px(PALETTE.bone, 6, 2, 4, 2);
  px(PALETTE.steelDark, 6, 3, 4, 1);

  px(PALETTE.amber, 7, 6, 2, 5);
  px(PALETTE.amberDim, 7, 10, 2, 1);
  px(PALETTE.boneLight, 7, 6, 1, 2);

  px(PALETTE.steelDark, 6, 13, 4, 1);
}

export function ensureArt(scene: Scene): void {
  for (const key of SOURCE_TEXTURES) {
    if (scene.textures.exists(key)) continue;
    const ctx = createCanvasContext(scene, key, SOURCE_SIZE, SOURCE_SIZE);
    drawSource(ctx, key);
    refreshCanvasTexture(scene, key);
  }

  if (!scene.textures.exists(PLAYER_SPRITE_KEY)) {
    for (const direction of PLAYER_DIRECTIONS) {
      const key = `player_${direction}`;
      if (scene.textures.exists(key)) continue;
      const ctx = createCanvasContext(scene, key, PLAYER_WIDTH, PLAYER_HEIGHT);
      drawPlayer(ctx, direction);
      refreshCanvasTexture(scene, key);
    }
  }

  if (!scene.textures.exists(DRONE_SPRITE_KEY)) {
    for (const direction of PLAYER_DIRECTIONS) {
      const key = `drone_${direction}`;
      if (scene.textures.exists(key)) continue;
      const ctx = createCanvasContext(scene, key, DRONE_WIDTH, DRONE_HEIGHT);
      drawDrone(ctx, direction);
      refreshCanvasTexture(scene, key);
    }
  }

  for (const reachable of [true, false]) {
    const suffix = reachable ? 'ok' : 'blocked';

    const markerKey = `tile_marker_${suffix}`;
    if (!scene.textures.exists(markerKey)) {
      const ctx = createCanvasContext(scene, markerKey, 64, 32);
      drawMarker(ctx, reachable);
      refreshCanvasTexture(scene, markerKey);
    }

    const hoverKey = `tile_hover_${suffix}`;
    if (!scene.textures.exists(hoverKey)) {
      const ctx = createCanvasContext(scene, hoverKey, 64, 32);
      drawHover(ctx, reachable);
      refreshCanvasTexture(scene, hoverKey);
    }
  }

  if (!scene.textures.exists('shadow')) {
    const ctx = createCanvasContext(scene, 'shadow', 32, 12);
    drawShadow(ctx);
    refreshCanvasTexture(scene, 'shadow');
  }

  if (!scene.textures.exists(DESCENT_HATCH_KEY)) {
    const ctx = createCanvasContext(scene, DESCENT_HATCH_KEY, 64, 32);
    drawDescentHatch(ctx);
    refreshCanvasTexture(scene, DESCENT_HATCH_KEY);
  }

  if (!scene.textures.exists(DESCENT_GLOW_KEY)) {
    const ctx = createCanvasContext(scene, DESCENT_GLOW_KEY, 96, 96);
    drawDescentGlow(ctx);
    refreshCanvasTexture(scene, DESCENT_GLOW_KEY);
  }

  if (!scene.textures.exists(DESCENT_SIGNAL_KEY)) {
    const ctx = createCanvasContext(scene, DESCENT_SIGNAL_KEY, 32, 32);
    drawDescentSignal(ctx);
    refreshCanvasTexture(scene, DESCENT_SIGNAL_KEY);
  }

  if (!scene.textures.exists(LOOT_SPRITE_KEY)) {
    const ctx = createCanvasContext(scene, LOOT_SPRITE_KEY, 16, 16);
    drawLootStim(ctx);
    refreshCanvasTexture(scene, LOOT_SPRITE_KEY);
  }

  if (!scene.textures.exists(DESCENT_SHAFT_KEY)) {
    const ctx = createCanvasContext(scene, DESCENT_SHAFT_KEY, 32, 120);
    drawDescentShaft(ctx);
    refreshCanvasTexture(scene, DESCENT_SHAFT_KEY);
  }
}
