import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { creditLines } from '../data/credits';
import { t } from '../i18n';
import { MENU_COLORS } from '../systems/MenuKit';
import { music } from '../systems/Music';

const SCROLL_PX_PER_SECOND = 34;
const LINE_HEIGHT = 26;
const END_PAUSE_MS = 1800;

export class Credits extends Scene {
  private text: Phaser.GameObjects.Text | undefined;
  private clock = 0;
  private leaving = false;
  private keyHandler: ((event: KeyboardEvent) => void) | undefined;

  constructor() {
    super({ key: 'Credits' });
  }

  create(): void {
    this.leaving = false;
    this.clock = 0;
    this.cameras.main.setBackgroundColor('#050505');
    this.cameras.main.fadeIn(700, 2, 2, 2);
    music.play(this, 'music_end');

    this.text = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT + 20, creditLines().join('\n'), {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: MENU_COLORS.text,
        align: 'center',
        lineSpacing: LINE_HEIGHT - 16,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 16, t('credits.skip'), {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: MENU_COLORS.dim,
      })
      .setOrigin(0.5, 1)
      .setDepth(5);

    this.keyHandler = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === 'Escape' || event.key === ' ') this.finish();
    };
    this.input.keyboard?.on('keydown', this.keyHandler);
    this.input.once('pointerdown', () => this.finish());
    this.events.once('shutdown', () => {
      if (this.keyHandler) this.input.keyboard?.off('keydown', this.keyHandler);
    });
  }

  update(_time: number, delta: number): void {
    const text = this.text;
    if (!text || this.leaving) return;
    this.clock += delta;
    text.y = GAME_HEIGHT + 20 - (this.clock / 1000) * SCROLL_PX_PER_SECOND;
    if (text.y + text.height < 0) {
      this.leaving = true;
      this.time.delayedCall(END_PAUSE_MS, () => {
        this.leaving = false;
        this.finish();
      });
    }
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(600, 2, 2, 2);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      music.stop(0.3);
      this.scene.start('Menu');
    });
  }
}
