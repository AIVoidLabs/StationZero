import type { GameObjects, Scene, Textures } from 'phaser';
import { CAMERA_ZOOM, DEPTH_DARKNESS, GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import type { DarknessLayer } from './Darkness';

export type LightTint = 'warm' | 'cold' | 'red' | 'amber' | 'cyan' | 'ember' | 'green';

export interface LightCone {
  readonly angle: number;
  readonly length: number;
}

export interface LightSource {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly intensity: number;
  readonly tint: LightTint;
  readonly squash?: number;
  readonly cone?: LightCone;
}

export type LightEmitter = (emit: (light: LightSource) => void) => void;

const KEY = 'light_map';
const WORLD_PER_PIXEL = 2;
const MARGIN = 1.5;
const MAP_WIDTH = Math.ceil((GAME_WIDTH / CAMERA_ZOOM) * MARGIN / WORLD_PER_PIXEL);
const MAP_HEIGHT = Math.ceil((GAME_HEIGHT / CAMERA_ZOOM) * MARGIN / WORLD_PER_PIXEL);
const AMBIENT_ALPHA = 0.9;
const AMBIENT_DEPTH_BONUS = 0.05;
const MIN_VISION_SCALE = 0.6;
const GLOW_SIZE = 128;
const CONE_HALF_ANGLE = (32 * Math.PI) / 180;
const DEFAULT_SQUASH = 0.8;
const TINT_ALPHA = 0.5;

const TINT_RGB: Record<LightTint, string> = {
  warm: '255, 190, 110',
  cold: '150, 200, 225',
  red: '255, 40, 24',
  amber: '230, 170, 60',
  cyan: '60, 180, 210',
  ember: '255, 90, 30',
  green: '90, 230, 140',
};

function makeCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return { canvas, ctx };
}

function buildGlow(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(GLOW_SIZE);
  const half = GLOW_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.88)');
  gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.16)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  return canvas;
}

function buildTint(rgb: string): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(GLOW_SIZE);
  const half = GLOW_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, `rgba(${rgb}, 0.55)`);
  gradient.addColorStop(0.5, `rgba(${rgb}, 0.22)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  return canvas;
}

function buildCone(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(GLOW_SIZE);
  const half = GLOW_SIZE / 2;
  const gradient = ctx.createRadialGradient(0, half, 0, 0, half, GLOW_SIZE);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, half);
  ctx.arc(0, half, GLOW_SIZE, -CONE_HALF_ANGLE, CONE_HALF_ANGLE);
  ctx.closePath();
  ctx.fill();
  return canvas;
}

export class LightMap implements DarknessLayer {
  private readonly scene: Scene;
  private readonly emitter: LightEmitter;
  private readonly image: GameObjects.Image;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly glow = buildGlow();
  private readonly cone = buildCone();
  private readonly tints: Record<LightTint, HTMLCanvasElement>;
  private readonly lights: LightSource[] = [];

  private visionScale = 1;

  constructor(scene: Scene, emitter: LightEmitter) {
    this.scene = scene;
    this.emitter = emitter;
    this.tints = {
      warm: buildTint(TINT_RGB.warm),
      cold: buildTint(TINT_RGB.cold),
      red: buildTint(TINT_RGB.red),
      amber: buildTint(TINT_RGB.amber),
      cyan: buildTint(TINT_RGB.cyan),
      ember: buildTint(TINT_RGB.ember),
      green: buildTint(TINT_RGB.green),
    };

    if (scene.textures.exists(KEY)) scene.textures.remove(KEY);
    this.ctx = createCanvasContext(scene, KEY, MAP_WIDTH, MAP_HEIGHT);
    this.image = scene.add
      .image(0, 0, KEY)
      .setOrigin(0.5, 0.5)
      .setScale(WORLD_PER_PIXEL)
      .setDepth(DEPTH_DARKNESS);
  }

  setVisionScale(scale: number): void {
    this.visionScale = Math.max(MIN_VISION_SCALE, Math.min(1, scale));
  }

  update(): void {
    const view = this.scene.cameras.main.worldView;
    const centerX = Math.round(view.centerX / WORLD_PER_PIXEL) * WORLD_PER_PIXEL;
    const centerY = Math.round(view.centerY / WORLD_PER_PIXEL) * WORLD_PER_PIXEL;
    this.image.setPosition(centerX, centerY);

    const left = centerX - (MAP_WIDTH * WORLD_PER_PIXEL) / 2;
    const top = centerY - (MAP_HEIGHT * WORLD_PER_PIXEL) / 2;
    const ctx = this.ctx;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    const depthBonus = ((1 - this.visionScale) / (1 - MIN_VISION_SCALE)) * AMBIENT_DEPTH_BONUS;
    ctx.fillStyle = `rgba(2, 3, 4, ${AMBIENT_ALPHA + depthBonus})`;
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    this.lights.length = 0;
    this.emitter((light) => this.lights.push(light));

    for (const light of this.lights) {
      const px = (light.x - left) / WORLD_PER_PIXEL;
      const py = (light.y - top) / WORLD_PER_PIXEL;
      const radius = light.radius / WORLD_PER_PIXEL;
      const intensity = Math.max(0, Math.min(1, light.intensity));
      if (intensity <= 0 || radius <= 0) continue;
      if (px < -radius * 2 || px > MAP_WIDTH + radius * 2) continue;
      if (py < -radius * 2 || py > MAP_HEIGHT + radius * 2) continue;

      ctx.save();
      ctx.translate(px, py);

      if (light.cone) {
        ctx.rotate(light.cone.angle);
        const length = light.cone.length / WORLD_PER_PIXEL;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = intensity;
        ctx.drawImage(this.cone, 0, -length / 2, length, length);
        ctx.restore();
        continue;
      }

      ctx.scale(1, light.squash ?? DEFAULT_SQUASH);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = intensity;
      ctx.drawImage(this.glow, -radius, -radius, radius * 2, radius * 2);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = intensity * TINT_ALPHA;
      ctx.drawImage(this.tints[light.tint], -radius, -radius, radius * 2, radius * 2);
      ctx.restore();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    refreshCanvasTexture(this.scene, KEY);
  }

  destroy(): void {
    this.image.destroy();
    const texture = this.scene.textures.get(KEY) as Textures.CanvasTexture | undefined;
    if (texture) this.scene.textures.remove(KEY);
  }
}
