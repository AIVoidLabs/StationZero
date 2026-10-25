import type { Scene } from 'phaser';
import { PALETTE, PLAYER_HEIGHT, PLAYER_WIDTH } from '../data/config';
import { PLAYER_DIRECTIONS, SOURCE_TEXTURES, type Direction } from '../assets/manifest';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import { createRng, seedFromString } from '../utils/random';

const SOURCE_SIZE = 128;

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

function drawMarker(ctx: CanvasRenderingContext2D, reachable: boolean): void {
  const color = reachable ? PALETTE.amber : PALETTE.rust;
  const points: readonly (readonly [number, number])[] = [
    [32, 2],
    [62, 16],
    [32, 30],
    [2, 16],
  ];

  ctx.beginPath();
  const first = points[0];
  if (!first) return;
  ctx.moveTo(first[0], first[1]);
  for (let i = 1; i < points.length; i += 1) {
    const point = points[i];
    if (point) ctx.lineTo(point[0], point[1]);
  }
  ctx.closePath();

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

function drawShadow(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(16, 6, 1, 16, 6, 15);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.28)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 12);
}

export function ensureArt(scene: Scene): void {
  for (const key of SOURCE_TEXTURES) {
    if (scene.textures.exists(key)) continue;
    const ctx = createCanvasContext(scene, key, SOURCE_SIZE, SOURCE_SIZE);
    drawSource(ctx, key);
    refreshCanvasTexture(scene, key);
  }

  for (const direction of PLAYER_DIRECTIONS) {
    const key = `player_${direction}`;
    if (scene.textures.exists(key)) continue;
    const ctx = createCanvasContext(scene, key, PLAYER_WIDTH, PLAYER_HEIGHT);
    drawPlayer(ctx, direction);
    refreshCanvasTexture(scene, key);
  }

  for (const reachable of [true, false]) {
    const key = reachable ? 'tile_marker_ok' : 'tile_marker_blocked';
    if (scene.textures.exists(key)) continue;
    const ctx = createCanvasContext(scene, key, 64, 32);
    drawMarker(ctx, reachable);
    refreshCanvasTexture(scene, key);
  }

  if (!scene.textures.exists('shadow')) {
    const ctx = createCanvasContext(scene, 'shadow', 32, 12);
    drawShadow(ctx);
    refreshCanvasTexture(scene, 'shadow');
  }
}
