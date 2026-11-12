import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { introLines } from '../data/story';
import { t } from '../i18n';
import { MENU_COLORS } from '../systems/MenuKit';
import { music } from '../systems/Music';
import { sfx } from '../systems/Sfx';
import { voice } from '../systems/Voice';

const CHAR_MS = 34;
const LINE_PAUSE_MS = 420;
const BLANK_PAUSE_MS = 520;
const OUTRO_MS = 1300;
const LINE_HEIGHT = 30;

export class Intro extends Scene {
  private texts: Phaser.GameObjects.Text[] = [];
  private lines: readonly string[] = [];
  private lineIndex = 0;
  private charIndex = 0;
  private clock = 0;
  private pause = 0;
  private finished = false;
  private leaving = false;
  private outro = 0;
  private spoke = false;
  private keyHandler: ((event: KeyboardEvent) => void) | undefined;

  constructor() {
    super({ key: 'Intro' });
  }

  create(): void {
    this.texts = [];
    this.lineIndex = 0;
    this.charIndex = 0;
    this.clock = 0;
    this.pause = 600;
    this.finished = false;
    this.leaving = false;
    this.outro = 0;
    this.spoke = false;

    this.cameras.main.setBackgroundColor('#050505');
    this.cameras.main.fadeIn(500, 2, 2, 2);
    sfx.attach(this);
    voice.attach(this);
    music.play(this, 'music_menu');

    const lines = introLines();
    this.lines = lines;
    const top = (GAME_HEIGHT - lines.length * LINE_HEIGHT) / 2;
    lines.forEach((_, index) => {
      const text = this.add
        .text(GAME_WIDTH / 2, top + index * LINE_HEIGHT, '', {
          fontFamily: 'monospace',
          fontSize: index === 0 ? '24px' : '17px',
          color: index === 0 ? MENU_COLORS.title : index === lines.length - 1 ? '#d9a441' : '#b8ad99',
        })
        .setOrigin(0.5, 0);
      this.texts.push(text);
    });

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 26, t('intro.skip'), {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: MENU_COLORS.dim,
      })
      .setOrigin(0.5, 1);

    this.keyHandler = (event: KeyboardEvent): void => {
      if ([13, 27, 32].includes(event.keyCode)) this.leave();
    };
    this.input.keyboard?.on('keydown', this.keyHandler);
    this.input.on('pointerdown', () => this.leave());

    this.events.once('shutdown', () => {
      if (this.keyHandler) this.input.keyboard?.off('keydown', this.keyHandler);
      this.input.off('pointerdown');
    });
  }

  update(_time: number, delta: number): void {
    if (this.leaving) return;

    if (this.finished) {
      this.outro += delta;
      if (!this.spoke && this.outro > 400) {
        this.spoke = true;
        voice.say('warden.intro', 'warden');
      }
      if (this.outro > OUTRO_MS + 3600) this.leave();
      return;
    }

    this.clock += delta;
    if (this.pause > 0) {
      this.pause -= delta;
      return;
    }

    const line = this.lines[this.lineIndex];
    if (line === undefined) {
      this.finished = true;
      return;
    }

    if (line === '') {
      this.lineIndex += 1;
      this.pause = BLANK_PAUSE_MS;
      return;
    }

    this.charIndex += Math.max(1, Math.floor(delta / CHAR_MS));
    const text = this.texts[this.lineIndex];
    if (text) text.setText(line.slice(0, this.charIndex));
    if (this.charIndex >= line.length) {
      this.lineIndex += 1;
      this.charIndex = 0;
      this.pause = LINE_PAUSE_MS;
    }
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    voice.clear();
    this.cameras.main.fadeOut(500, 2, 2, 2);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      music.stop(0.3);
      this.scene.start('Game', { floor: 0 });
    });
  }
}
