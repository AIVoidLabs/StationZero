import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { t } from '../i18n';
import { ASSETS } from '../assets/manifest';
import { ensureArt } from '../systems/PlaceholderArt';
import { registerTilesV2 } from '../systems/TileShaper';
import { VOICE_KEYS, voiceAudioKey, voicePath } from '../data/voicelist';
import { settings } from '../systems/Settings';
import { voice } from '../systems/Voice';
import { isDevStart } from '../utils/devstart';

const BAR_WIDTH = 360;
const BAR_HEIGHT = 14;
const BAR_CELL = 12;
const AMBER = 0xd9a441;

export class Preload extends Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload(): void {
    this.showProgress();
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

  private showProgress(): void {
    const x = (GAME_WIDTH - BAR_WIDTH) / 2;
    const y = GAME_HEIGHT / 2;
    const style = { fontFamily: 'monospace', fontSize: '13px', color: '#d9a441' };
    this.add.text(x, y - 22, t('load.title'), style).setOrigin(0, 0.5);
    const percent = this.add.text(x + BAR_WIDTH, y - 22, '0%', style).setOrigin(1, 0.5);
    const file = this.add.text(x, y + BAR_HEIGHT + 14, '', { ...style, fontSize: '9px', color: '#6b5a44' }).setOrigin(0, 0.5);
    const bar = this.add.graphics();

    const draw = (value: number): void => {
      bar.clear();
      bar.lineStyle(1, AMBER, 0.7);
      bar.strokeRect(x - 3.5, y - 3.5, BAR_WIDTH + 7, BAR_HEIGHT + 7);
      const cells = Math.floor((BAR_WIDTH * value) / BAR_CELL);
      bar.fillStyle(AMBER, 1);
      for (let cell = 0; cell < cells; cell += 1) bar.fillRect(x + cell * BAR_CELL, y, BAR_CELL - 2, BAR_HEIGHT);
      percent.setText(`${Math.round(value * 100)}%`);
    };

    draw(0);
    this.load.on('progress', draw);
    this.load.on('fileprogress', (item: { key: string }) => file.setText(`> ${item.key.toUpperCase()}`));
  }

  create(): void {
    ensureArt(this);
    registerTilesV2(this);
    this.scene.start(isDevStart() ? 'Game' : 'Menu');
  }
}
