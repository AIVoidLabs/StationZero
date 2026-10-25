import type { GameObjects, Scene } from 'phaser';
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

export class Darkness {
  private readonly overlay: GameObjects.Image;

  constructor(scene: Scene) {
    if (!scene.textures.exists(OVERLAY_KEY)) {
      const width = Math.ceil(GAME_WIDTH * OVERLAY_MARGIN);
      const height = Math.ceil(GAME_HEIGHT * OVERLAY_MARGIN);
      const ctx = createCanvasContext(scene, OVERLAY_KEY, width, height);
      const centerX = width / 2;
      const centerY = height / 2;
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        VISION_INNER_RADIUS,
        centerX,
        centerY,
        VISION_OUTER_RADIUS,
      );
      gradient.addColorStop(0, 'rgba(2, 2, 2, 0)');
      gradient.addColorStop(0.45, 'rgba(2, 2, 2, 0.3)');
      gradient.addColorStop(0.75, 'rgba(2, 2, 2, 0.72)');
      gradient.addColorStop(1, 'rgba(2, 2, 2, 0.95)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      refreshCanvasTexture(scene, OVERLAY_KEY);
    }

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

  update(x: number, y: number): void {
    this.overlay.setPosition(x, y);
  }

  destroy(): void {
    this.overlay.destroy();
  }
}
