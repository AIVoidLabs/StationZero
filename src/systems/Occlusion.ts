import type { GameObjects, Scene } from 'phaser';
import { TILE_HEIGHT } from '../data/config';

interface Occluder {
  readonly sprite: GameObjects.Image;
  readonly baseY: number;
  faded: boolean;
}

const FADE_ALPHA = 0.28;
const FADE_DURATION = 130;
const FRONT_RANGE = TILE_HEIGHT * 1.9;
const SIDE_RANGE = 48;

export class Occlusion {
  private readonly scene: Scene;
  private readonly occluders: readonly Occluder[];

  constructor(scene: Scene, walls: readonly GameObjects.Image[]) {
    this.scene = scene;
    this.occluders = walls.map((sprite) => ({
      sprite,
      baseY: sprite.y - TILE_HEIGHT / 2,
      faded: false,
    }));
  }

  update(feetX: number, feetY: number): void {
    for (const occluder of this.occluders) {
      const distance = occluder.baseY - feetY;
      const shouldFade =
        distance > 0 &&
        distance < FRONT_RANGE &&
        Math.abs(occluder.sprite.x - feetX) < SIDE_RANGE;

      if (shouldFade === occluder.faded) continue;
      occluder.faded = shouldFade;

      this.scene.tweens.killTweensOf(occluder.sprite);
      this.scene.tweens.add({
        targets: occluder.sprite,
        alpha: shouldFade ? FADE_ALPHA : 1,
        duration: FADE_DURATION,
        ease: 'Quad.easeOut',
      });
    }
  }

  destroy(): void {
    for (const occluder of this.occluders) {
      this.scene.tweens.killTweensOf(occluder.sprite);
    }
  }
}
