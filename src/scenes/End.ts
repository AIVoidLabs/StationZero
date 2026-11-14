import { Scene } from 'phaser';
import { END_DEAD_KEY, END_SURVIVED_KEY } from '../assets/manifest';
import { t } from '../i18n';
import { FLOOR_COUNT, GAME_WIDTH } from '../data/config';
import { MenuController, MENU_COLORS } from '../systems/MenuKit';
import { music } from '../systems/Music';
import { records, type Outcome } from '../systems/Records';
import { formatTime, runStats } from '../systems/RunStats';
import { runFlags } from '../systems/RunFlags';
import { saveGame } from '../systems/SaveGame';

interface EndData {
  readonly outcome?: Outcome;
}

export class End extends Scene {
  private leaving = false;

  constructor() {
    super({ key: 'End' });
  }

  create(data?: EndData): void {
    this.leaving = false;
    const outcome: Outcome = data?.outcome ?? 'dead';
    const snapshot = runStats.snapshot();
    const result = records.add(outcome, snapshot);
    saveGame.clear();

    this.cameras.main.fadeIn(700, 2, 2, 2);
    const survived = outcome === 'survived';
    music.play(this, 'music_end');

    this.add.image(GAME_WIDTH / 2, 8, survived ? END_SURVIVED_KEY : END_DEAD_KEY).setOrigin(0.5, 0).setDepth(1);
    this.add
      .text(GAME_WIDTH / 2, 196, survived ? t('end.survivedTitle') : t('end.deadTitle'), {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: survived ? '#3ab4d2' : MENU_COLORS.danger,
      })
      .setOrigin(0.5, 0)
      .setDepth(5);
    this.add
      .text(
        GAME_WIDTH / 2,
        230,
        survived ? (runFlags.compliant ? t('end.compliantLine') : t('end.defiantLine')) : t('end.deadLine'),
        { fontFamily: 'monospace', fontSize: '11px', color: MENU_COLORS.dim },
      )
      .setOrigin(0.5, 0)
      .setDepth(5);

    const controller = new MenuController(this, GAME_WIDTH / 2, 252, 400);
    const stat = (label: string, value: string | number): string => `${label.padEnd(22)}${value}`;
    const lines = [
      stat(t('end.floor'), `${snapshot.floorReached}/${FLOOR_COUNT}`),
      stat(t('end.hostiles'), snapshot.kills),
      stat(t('end.shots'), snapshot.shots),
      stat(t('end.time'), formatTime(Math.floor(snapshot.playMs / 1000))),
      stat(t('end.score'), result.entry.score),
      result.rank !== null ? t('end.record', { n: result.rank }) : '',
    ];
    controller.push({
      title: () => t('end.report'),
      bodyLeft: true,
      body: () => lines,
      items: [
        { label: () => t('end.tryAgain'), onSelect: () => this.leave('Game') },
        { label: () => t('end.mainMenu'), onSelect: () => this.leave('Menu') },
      ],
      footer: ' ',
    });

    this.events.once('shutdown', () => {
      controller.destroy();
    });
  }

  private leave(target: 'Game' | 'Menu'): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(450, 2, 2, 2);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      music.stop(0.3);
      if (target === 'Game') {
        runStats.reset();
        runFlags.reset();
        this.scene.start('Game', { floor: 0 });
      } else {
        this.scene.start('Menu');
      }
    });
  }
}
