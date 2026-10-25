import { Scene } from 'phaser';
import { ASSETS } from '../assets/manifest';
import { ensureArt } from '../systems/PlaceholderArt';
import { buildIsoTiles } from '../systems/TileShaper';

export class Preload extends Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload(): void {
    for (const asset of ASSETS) {
      if (!asset.enabled) continue;

      if (
        asset.kind === 'spritesheet' &&
        asset.frameWidth !== undefined &&
        asset.frameHeight !== undefined
      ) {
        this.load.spritesheet(asset.key, asset.path, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
        });
      } else {
        this.load.image(asset.key, asset.path);
      }
    }
  }

  create(): void {
    ensureArt(this);
    buildIsoTiles(this);
    this.scene.start('Game');
  }
}
