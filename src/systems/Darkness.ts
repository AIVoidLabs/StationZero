import type { GameObjects, Scene, Textures } from 'phaser';
import {
  CAMERA_ZOOM,
  DEPTH_DARKNESS,
  GAME_HEIGHT,
  GAME_WIDTH,
  VISION_INNER_RADIUS,
  VISION_OUTER_RADIUS,
} from '../data/config';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';

const OVERLAY_KEY = 'vision_overlay';
const OVERLAY_MARGIN = 1.5;
const MIN_VISION_SCALE = 0.6;

export interface DarknessLayer {
  update(x: number, y: number): void;
  setVisionScale(scale: number): void;
  destroy(): void;
}

export class Darkness implements DarknessLayer {
  private readonly scene: Scene;
  private readonly width = Math.ceil(GAME_WIDTH * OVERLAY_MARGIN);
  private readonly height = Math.ceil(GAME_HEIGHT * OVERLAY_MARGIN);
  private readonly overlay: GameObjects.Image;

  private visionScale = 1;

  constructor(scene: Scene) {
    this.scene = scene;

    if (!scene.textures.exists(OVERLAY_KEY)) {
      createCanvasContext(scene, OVERLAY_KEY, this.width, this.height);
    }
    this.paint(1);

    this.overlay = scene.add
      .image(0, 0, OVERLAY_KEY)
      .setOrigin(0.5, 0.5)
      .setScale(1 / CAMERA_ZOOM)
      .setDepth(DEPTH_DARKNESS);

    scene.tweens.add({
      targets: this.overlay,
      alpha: { from: 0.9, to: 1 },
      duration: 5200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setVisionScale(scale: number): void {
    const clamped = Math.max(MIN_VISION_SCALE, Math.min(1, scale));
    if (Math.abs(clamped - this.visionScale) < 0.01) return;

    this.visionScale = clamped;
    this.paint(clamped);
  }

  update(x: number, y: number): void {
    this.overlay.setPosition(x, y);
  }

  destroy(): void {
    this.overlay.destroy();
  }

  private paint(scale: number): void {
    const texture = this.scene.textures.get(OVERLAY_KEY) as Textures.CanvasTexture;
    const ctx = texture.context;
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    ctx.clearRect(0, 0, this.width, this.height);
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      VISION_INNER_RADIUS * scale,
      centerX,
      centerY,
      VISION_OUTER_RADIUS * scale,
    );
    gradient.addColorStop(0, 'rgba(2, 2, 2, 0)');
    gradient.addColorStop(0.45, 'rgba(2, 2, 2, 0.3)');
    gradient.addColorStop(0.75, 'rgba(2, 2, 2, 0.72)');
    gradient.addColorStop(1, 'rgba(2, 2, 2, 0.95)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    refreshCanvasTexture(this.scene, OVERLAY_KEY);
  }
}
