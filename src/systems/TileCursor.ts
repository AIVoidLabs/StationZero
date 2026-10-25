import type { GameObjects, Scene } from 'phaser';
import { DEPTH_CURSOR } from '../data/config';

export interface HoverTarget {
  readonly x: number;
  readonly y: number;
  readonly gridX: number;
  readonly gridY: number;
  readonly walkable: boolean;
}

export class TileCursor {
  private readonly image: GameObjects.Image;

  constructor(scene: Scene) {
    this.image = scene.add
      .image(0, 0, 'tile_hover_ok')
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_CURSOR)
      .setVisible(false);
  }

  show(target: HoverTarget): void {
    this.image
      .setTexture(target.walkable ? 'tile_hover_ok' : 'tile_hover_blocked')
      .setPosition(target.x, target.y)
      .setVisible(true);
  }

  hide(): void {
    this.image.setVisible(false);
  }

  destroy(): void {
    this.image.destroy();
  }
}
