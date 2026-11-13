import { Scene } from 'phaser';
import { ASSETS } from '../assets/manifest';
import { ensureArt } from '../systems/PlaceholderArt';
import { registerTilesV2 } from '../systems/TileShaper';
import { VOICE_KEYS, voiceAudioKey, voicePath } from '../data/voicelist';
import { settings } from '../systems/Settings';
import { voice } from '../systems/Voice';
import { isDevStart } from '../utils/devstart';

export class Preload extends Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload(): void {
    const lang = settings.data.language;
    for (const key of VOICE_KEYS) this.load.audio(voiceAudioKey(lang, key), voicePath(lang, key));
    voice.markLoaded(lang);

    for (const asset of ASSETS) {
      if (!asset.enabled) continue;

      if (asset.kind === 'audio') {
        this.load.audio(asset.key, asset.path);
        continue;
      }

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
    registerTilesV2(this);
    this.scene.start(isDevStart() ? 'Game' : 'Menu');
  }
}
