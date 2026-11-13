import type { Scene } from 'phaser';
import { PALETTE } from '../data/config';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';

export const DESCENT_GLOW_KEY = 'descent_glow';
export const DESCENT_SIGNAL_KEY = 'descent_signal';
export const DESCENT_SHAFT_KEY = 'descent_shaft';

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
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

export function ensureArt(scene: Scene): void {
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

  if (!scene.textures.exists(DESCENT_SHAFT_KEY)) {
    const ctx = createCanvasContext(scene, DESCENT_SHAFT_KEY, 32, 120);
    drawDescentShaft(ctx);
    refreshCanvasTexture(scene, DESCENT_SHAFT_KEY);
  }
}
