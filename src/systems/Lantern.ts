import { BlendModes, type GameObjects, type Scene, type Tweens } from 'phaser';
import {
  DEPTH_LANTERN,
  LANTERN_OFFSET_Y,
  LANTERN_RADIUS,
  PALETTE,
} from '../data/config';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';

const POOL_KEY = 'lantern_pool';
const POOL_SIZE = 256;
const CORE_KEY = 'lantern_core';
const CORE_SIZE = 96;

const POOL_BASE_SCALE = (LANTERN_RADIUS * 2) / POOL_SIZE;
const CORE_BASE_SCALE = (LANTERN_RADIUS * 0.9) / CORE_SIZE;
const POOL_ALPHA_MIN = 0.4;
const POOL_ALPHA_MAX = 0.52;
const CORE_ALPHA_MIN = 0.48;
const CORE_ALPHA_MAX = 0.62;

function hexChannel(color: number, shift: number): number {
  return (color >> shift) & 0xff;
}

function buildPool(scene: Scene): void {
  if (scene.textures.exists(POOL_KEY)) return;
  const ctx = createCanvasContext(scene, POOL_KEY, POOL_SIZE, POOL_SIZE);
  const half = POOL_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  const r = hexChannel(PALETTE.amber, 16);
  const g = hexChannel(PALETTE.amber, 8);
  const b = hexChannel(PALETTE.amber, 0);

  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.55)`);
  gradient.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, 0.34)`);
  gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.12)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, POOL_SIZE, POOL_SIZE);
  refreshCanvasTexture(scene, POOL_KEY);
}

function buildCore(scene: Scene): void {
  if (scene.textures.exists(CORE_KEY)) return;
  const ctx = createCanvasContext(scene, CORE_KEY, CORE_SIZE, CORE_SIZE);
  const half = CORE_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);

  gradient.addColorStop(0, 'rgba(255, 214, 150, 0.5)');
  gradient.addColorStop(0.35, 'rgba(217, 164, 65, 0.24)');
  gradient.addColorStop(1, 'rgba(217, 164, 65, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CORE_SIZE, CORE_SIZE);
  refreshCanvasTexture(scene, CORE_KEY);
}

export class Lantern {
  private readonly scene: Scene;
  private readonly pool: GameObjects.Image;
  private readonly core: GameObjects.Image;

  private poolTween: Tweens.Tween | undefined = undefined;
  private coreTween: Tweens.Tween | undefined = undefined;
  private intensity = 1;

  constructor(scene: Scene, x: number, y: number) {
    this.scene = scene;
    buildPool(scene);
    buildCore(scene);

    this.pool = scene.add
      .image(x, y + LANTERN_OFFSET_Y, POOL_KEY)
      .setBlendMode(BlendModes.ADD)
      .setScale(POOL_BASE_SCALE)
      .setDepth(DEPTH_LANTERN)
      .setAlpha(POOL_ALPHA_MIN);

    this.core = scene.add
      .image(x, y + LANTERN_OFFSET_Y, CORE_KEY)
      .setBlendMode(BlendModes.ADD)
      .setScale(CORE_BASE_SCALE)
      .setDepth(DEPTH_LANTERN)
      .setAlpha(CORE_ALPHA_MIN);

    this.restartFlicker();
  }

  setIntensity(scale: number): void {
    const clamped = Math.max(0.2, Math.min(1, scale));
    if (Math.abs(clamped - this.intensity) < 0.01) return;

    this.intensity = clamped;
    this.pool.setScale(POOL_BASE_SCALE * clamped);
    this.core.setScale(CORE_BASE_SCALE * clamped);
    this.restartFlicker();
  }

  update(x: number, y: number): void {
    this.pool.setPosition(x, y + LANTERN_OFFSET_Y);
    this.core.setPosition(x, y + LANTERN_OFFSET_Y);
  }

  get intensityScale(): number {
    return this.intensity;
  }

  destroy(): void {
    this.poolTween?.remove();
    this.coreTween?.remove();
    this.poolTween = undefined;
    this.coreTween = undefined;
    this.pool.destroy();
    this.core.destroy();
  }

  private restartFlicker(): void {
    this.poolTween?.remove();
    this.coreTween?.remove();

    const scale = this.intensity;
    this.pool.setAlpha(POOL_ALPHA_MIN * scale);
    this.core.setAlpha(CORE_ALPHA_MIN * scale);

    this.poolTween = this.scene.tweens.add({
      targets: this.pool,
      alpha: { from: POOL_ALPHA_MIN * scale, to: POOL_ALPHA_MAX * scale },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.coreTween = this.scene.tweens.add({
      targets: this.core,
      alpha: { from: CORE_ALPHA_MIN * scale, to: CORE_ALPHA_MAX * scale },
      duration: 730,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
