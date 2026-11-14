import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { t, type StringKey } from '../i18n';
import { MenuController, type MenuPage } from '../systems/MenuKit';
import { sfx } from '../systems/Sfx';
import { voice } from '../systems/Voice';
import type { Game } from './Game';

interface SecretData {
  readonly floor?: number;
}

const CHAR_MS = 26;

export class SecretScene extends Scene {
  private controller: MenuController | undefined;
  private floor = 0;
  private typed = 0;
  private poem = '';
  private keyHandler: ((event: KeyboardEvent) => void) | undefined;

  constructor() {
    super({ key: 'Secret' });
  }

  create(data?: SecretData): void {
    this.floor = data?.floor ?? 0;
    this.poem = t(`secret.poem.b${this.floor + 1}` as StringKey);
    this.typed = 0;

    const game = this.scene.get('Game') as Game;
    game.setAudioDucked(true);
    voice.clear();
    sfx.attach(this);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050505, 0.78).setOrigin(0, 0).setDepth(0);
    const controller = new MenuController(this, GAME_WIDTH / 2, 110, 640);
    this.controller = controller;
    controller.setOnRootBack(() => this.close());
    controller.push(this.page());

    this.keyHandler = (event: KeyboardEvent): void => {
      const index = event.keyCode - 49;
      if (index < 0 || index > 1) return;
      const item = controller.page?.items[index];
      if (item?.onSelect) {
        sfx.play('uiClick');
        item.onSelect();
      }
    };
    this.input.keyboard?.on('keydown', this.keyHandler);

    this.events.once('shutdown', () => {
      if (this.keyHandler) this.input.keyboard?.off('keydown', this.keyHandler);
      controller.destroy();
      this.controller = undefined;
    });
  }

  update(_time: number, delta: number): void {
    if (this.typed >= this.poem.length) return;
    this.typed = Math.min(this.poem.length, this.typed + Math.max(1, Math.floor(delta / CHAR_MS)));
    this.controller?.refresh();
  }

  private page(): MenuPage {
    const number = this.floor + 1;
    const lineCount = this.poem.split('\n').length;
    const gain = `${t('secret.gain')}: ${t(`secret.b${number}` as StringKey)}`;
    return {
      title: () => t(`secret.who.b${number}` as StringKey),
      bodyLeft: true,
      bodyMinLines: lineCount + 2,
      body: () => [...this.poem.slice(0, this.typed).split('\n'), '', ...(this.typed >= this.poem.length ? [gain] : [''])],
      footer: () => t('secret.footer'),
      items: [
        { label: () => `1. ${t('secret.accept')}`, onSelect: () => this.accept() },
        { label: () => `2. ${t('secret.leave')}`, onSelect: () => this.close() },
      ],
    };
  }

  private accept(): void {
    const game = this.scene.get('Game') as Game;
    game.collectSecret(this.floor);
    this.close();
  }

  private close(): void {
    const game = this.scene.get('Game') as Game;
    game.setAudioDucked(false);
    this.scene.resume('Game');
    this.scene.resume('HudScene');
    this.scene.stop();
  }
}
