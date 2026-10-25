import { BlendModes, type GameObjects, type Scene } from 'phaser';
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
  private readonly pool: GameObjects.Image;
  private readonly core: GameObjects.Image;

  constructor(scene: Scene, x: number, y: number) {
    buildPool(scene);
    buildCore(scene);

    this.pool = scene.add
      .image(x, y + LANTERN_OFFSET_Y, POOL_KEY)
      .setBlendMode(BlendModes.ADD)
      .setScale((LANTERN_RADIUS * 2) / POOL_SIZE)
      .setDepth(DEPTH_LANTERN)
      .setAlpha(0.46);

    this.core = scene.add
      .image(x, y + LANTERN_OFFSET_Y, CORE_KEY)
      .setBlendMode(BlendModes.ADD)
      .setScale((LANTERN_RADIUS * 0.9) / CORE_SIZE)
      .setDepth(DEPTH_LANTERN)
      .setAlpha(0.55);

    scene.tweens.add({
      targets: this.pool,
      alpha: { from: 0.4, to: 0.52 },
      duration: 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    scene.tweens.add({
      targets: this.core,
      alpha: { from: 0.48, to: 0.62 },
      duration: 730,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(x: number, y: number): void {
    this.pool.setPosition(x, y + LANTERN_OFFSET_Y);
    this.core.setPosition(x, y + LANTERN_OFFSET_Y);
  }

  destroy(): void {
    this.pool.destroy();
    this.core.destroy();
  }
}
