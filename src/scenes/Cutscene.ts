import { Scene } from 'phaser';
import { CUTSCENES, cutsceneArtKey, type CutsceneId } from '../data/cutscenes';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { t } from '../i18n';
import { MENU_COLORS } from '../systems/MenuKit';
import { music } from '../systems/Music';
import { sfx } from '../systems/Sfx';

export interface CutsceneData {
  readonly id: CutsceneId;
  readonly next: { readonly scene: string; readonly data?: object };
}

const BASE_SCALE = GAME_WIDTH / 480;
const FADE_MS = 500;
const CHAR_MS = 28;

export class Cutscene extends Scene {
  private def!: CutsceneData;
  private panelIndex = 0;
  private image: Phaser.GameObjects.Image | undefined;
  private caption: Phaser.GameObjects.Text | undefined;
  private flicker: Phaser.GameObjects.Rectangle | undefined;
  private fullCaption = '';
  private typed = 0;
  private leaving = false;
  private keyHandler: ((event: KeyboardEvent) => void) | undefined;

  constructor() {
    super({ key: 'Cutscene' });
  }

  create(data: CutsceneData): void {
    this.def = data;
    this.panelIndex = 0;
    this.leaving = false;
    this.cameras.main.setBackgroundColor('#020202');
    sfx.attach(this);
    music.play(this, data.id.startsWith('end') ? 'music_end' : 'music_menu');

    this.image = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, cutsceneArtKey('intro_1')).setAlpha(0).setDepth(1);
    this.flicker = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0).setOrigin(0, 0).setDepth(2);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 54, GAME_WIDTH, 78, 0x050505, 0.78)
      .setOrigin(0.5, 0.5)
      .setDepth(3);
    this.caption = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 54, '', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#e8dcc0',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 120 },
      })
      .setOrigin(0.5, 0.5)
      .setDepth(4);
    this.add
      .text(GAME_WIDTH - 16, 14, t('cutscene.skip'), { fontFamily: 'monospace', fontSize: '10px', color: MENU_COLORS.dim })
      .setOrigin(1, 0)
      .setDepth(5);

    this.keyHandler = (event: KeyboardEvent): void => {
      if ([13, 27, 32].includes(event.keyCode)) this.skip();
    };
    this.input.keyboard?.on('keydown', this.keyHandler);
    this.input.on('pointerdown', () => this.skip());
    this.events.once('shutdown', () => {
      if (this.keyHandler) this.input.keyboard?.off('keydown', this.keyHandler);
      this.input.off('pointerdown');
    });

    this.cameras.main.fadeIn(FADE_MS, 2, 2, 2);
    this.showPanel();
  }

  update(_time: number, delta: number): void {
    if (!this.caption || this.typed >= this.fullCaption.length) return;
    this.typed = Math.min(this.fullCaption.length, this.typed + Math.max(1, Math.floor(delta / CHAR_MS)));
    this.caption.setText(this.fullCaption.slice(0, this.typed));
  }

  private showPanel(): void {
    const panel = CUTSCENES[this.def.id]?.[this.panelIndex];
    const image = this.image;
    if (!panel || !image) {
      this.finish();
      return;
    }

    image.setTexture(cutsceneArtKey(panel.art));
    const startScale = BASE_SCALE * 1.0 * panel.from.zoom;
    image.setScale(startScale).setPosition(GAME_WIDTH / 2 + panel.from.x, GAME_HEIGHT / 2 + panel.from.y).setAlpha(0);

    this.fullCaption = t(panel.caption);
    this.typed = 0;
    this.caption?.setText('');

    this.tweens.add({ targets: image, alpha: 1, duration: FADE_MS });
    this.tweens.add({
      targets: image,
      scale: BASE_SCALE * panel.to.zoom,
      x: GAME_WIDTH / 2 + panel.to.x,
      y: GAME_HEIGHT / 2 + panel.to.y,
      duration: panel.ms,
      ease: 'Sine.easeInOut',
    });
    if (this.flicker && panel.flicker) {
      this.tweens.add({
        targets: this.flicker,
        alpha: { from: 0, to: 0.22 },
        duration: 90,
        yoyo: true,
        repeat: Math.floor(panel.ms / 700),
        repeatDelay: 520,
      });
    }

    this.time.delayedCall(panel.ms - FADE_MS, () => {
      if (this.leaving) return;
      this.tweens.add({ targets: image, alpha: 0, duration: FADE_MS });
    });
    this.time.delayedCall(panel.ms, () => {
      if (this.leaving) return;
      this.panelIndex += 1;
      this.showPanel();
    });
  }

  private skip(): void {
    if (this.leaving) return;
    this.finish();
  }

  private finish(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(400, 2, 2, 2);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.def.next.scene === 'Game' || this.def.next.scene === 'Intro') music.stop(0.3);
      this.scene.start(this.def.next.scene, this.def.next.data);
    });
  }
}
