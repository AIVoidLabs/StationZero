import type { GameObjects, Scene } from 'phaser';
import { TILE_HEIGHT } from '../data/config';

export interface OcclusionFocus {
  readonly x: number;
  readonly y: number;
}

export interface OccluderSpec {
  readonly sprite: GameObjects.Image;
  readonly baseY: number;
}

interface Occluder {
  readonly sprite: GameObjects.Image;
  readonly baseY: number;
  targetAlpha: number;
}

const PLAYER_ALPHA = 0.28;
const HOVER_ALPHA = 0.4;
const FADE_DURATION = 130;
const FRONT_RANGE = TILE_HEIGHT * 1.9;
const SIDE_RANGE = 48;

export class Occlusion {
  private readonly scene: Scene;
  private readonly occluders: readonly Occluder[];

  constructor(scene: Scene, occluders: readonly OccluderSpec[]) {
    this.scene = scene;
    this.occluders = occluders.map(({ sprite, baseY }) => ({
      sprite,
      baseY,
      targetAlpha: 1,
    }));
  }

  update(feetX: number, feetY: number, hover: OcclusionFocus | null): void {
    for (const occluder of this.occluders) {
      const playerCovers = this.covers(occluder, feetX, feetY);
      const hoverCovers = hover !== null && this.covers(occluder, hover.x, hover.y);
      const targetAlpha = playerCovers ? PLAYER_ALPHA : hoverCovers ? HOVER_ALPHA : 1;

      if (Math.abs(targetAlpha - occluder.targetAlpha) < 0.001) continue;
      occluder.targetAlpha = targetAlpha;

      this.scene.tweens.killTweensOf(occluder.sprite);
      this.scene.tweens.add({
        targets: occluder.sprite,
        alpha: targetAlpha,
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

  private covers(occluder: Occluder, focusX: number, focusY: number): boolean {
    const distance = occluder.baseY - focusY;
    return (
      distance > 0 &&
      distance < FRONT_RANGE &&
      Math.abs(occluder.sprite.x - focusX) < SIDE_RANGE
    );
  }
}
