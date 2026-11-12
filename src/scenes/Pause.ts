import { Scene } from 'phaser';
import { t } from '../i18n';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { MenuController, buildSettingsPage, type MenuPage } from '../systems/MenuKit';
import type { Game } from './Game';

export class Pause extends Scene {

  constructor() {
    super({ key: 'Pause' });
  }

  create(): void {
    const game = this.scene.get('Game') as Game;
    game.setAudioDucked(true);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050505, 0.68).setOrigin(0, 0).setDepth(0);
    const controller = new MenuController(this, GAME_WIDTH / 2, 120, 400);
    controller.setOnRootBack(() => this.resumeGame());
    controller.push(this.pausePage(controller, game));

    this.events.once('shutdown', () => {
      controller.destroy();
    });
  }

  private pausePage(controller: MenuController, game: Game): MenuPage {
    return {
      title: () => t('pause.title'),
      footer: () => t('pause.footer'),
      items: [
        { label: () => t('pause.resume'), onSelect: () => this.resumeGame() },
        { label: () => t('pause.settings'), onSelect: () => controller.push(buildSettingsPage(controller)) },
        {
          label: () => t('pause.restart'),
          onSelect: () => {
            this.resumeGame();
            game.restartFloor();
          },
        },
        {
          label: () => t('pause.saveQuit'),
          onSelect: () => {
            game.saveNow();
            game.setAudioDucked(false);
            this.scene.stop('Game');
            this.scene.stop('HudScene');
            this.scene.start('Menu');
          },
        },
      ],
    };
  }

  private resumeGame(): void {
    const game = this.scene.get('Game') as Game;
    game.setAudioDucked(false);
    this.scene.resume('Game');
    this.scene.resume('HudScene');
    this.scene.stop();
  }
}
