import { Scene } from 'phaser';
import { MENU_BG_KEY, MENU_TITLE_KEY } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { creditLines } from '../data/credits';
import { t } from '../i18n';
import { MENU_COLORS, MenuController, buildSettingsPage, type MenuPage } from '../systems/MenuKit';
import { music } from '../systems/Music';
import { records } from '../systems/Records';
import { formatTime, runStats } from '../systems/RunStats';
import { runFlags } from '../systems/RunFlags';
import { saveGame } from '../systems/SaveGame';
import { settings } from '../systems/Settings';
import { sfx } from '../systems/Sfx';
import { cutscenesDisabledByFlag } from '../utils/devflags';

export function recordsPage(ctrl: MenuController): MenuPage {
  return {
    title: () => t('records.title'),
    bodyLeft: true,
    body: () => {
      const list = records.list();
      if (list.length === 0) return [t('records.empty1'), t('records.empty2')];
      const rows = list.map((entry, index) => {
        const mark = entry.outcome === 'survived' ? t('records.surv') : t('records.lost');
        return `${String(index + 1).padStart(2)}. ${String(entry.score).padStart(5)}  ${t('records.floorShort')} ${entry.floor}  ${t('records.killsShort')} ${String(entry.kills).padStart(2)}  ${formatTime(entry.seconds)}  ${mark}`;
      });
      return [t('records.header'), ...rows];
    },
    footer: () => t('records.footer'),
    items: [{ label: () => t('ui.back'), onSelect: () => ctrl.pop() }],
  };
}

export function creditsPage(ctrl: MenuController): MenuPage {
  return {
    title: () => t('credits.title'),
    scrollLines: creditLines(),
    footer: () => t('credits.footer'),
    items: [{ label: () => t('ui.back'), onSelect: () => ctrl.pop() }],
  };
}

export class Menu extends Scene {
  controller: MenuController | undefined;
  private subtitle: Phaser.GameObjects.Text | undefined;
  private lore: Phaser.GameObjects.Text | undefined;
  private starting = false;

  constructor() {
    super({ key: 'Menu' });
  }

  create(): void {
    this.starting = false;
    this.cameras.main.fadeIn(600, 5, 5, 5);

    this.add.image(0, 0, MENU_BG_KEY).setOrigin(0, 0).setScale(GAME_WIDTH / 480).setDepth(0);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050505, 0.35).setOrigin(0, 0).setDepth(1);

    const title = this.add.image(GAME_WIDTH / 2, 70, MENU_TITLE_KEY).setScale(2).setDepth(5);
    this.tweens.add({
      targets: title,
      alpha: { from: 1, to: 0.82 },
      duration: 140,
      yoyo: true,
      repeat: -1,
      repeatDelay: 1800,
    });
    this.subtitle = this.add
      .text(GAME_WIDTH / 2, 138, t('menu.subtitle'), {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: MENU_COLORS.dim,
      })
      .setOrigin(0.5, 0)
      .setDepth(5);
    this.lore = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 22, t('menu.lore'), {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: MENU_COLORS.dim,
      })
      .setOrigin(0.5, 1)
      .setDepth(5);

    this.add
      .text(GAME_WIDTH - 8, GAME_HEIGHT - 6, `v${__APP_VERSION__}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: MENU_COLORS.dim,
      })
      .setOrigin(1, 1)
      .setDepth(5);

    sfx.attach(this);
    music.play(this, 'music_menu');

    const controller = new MenuController(this, GAME_WIDTH / 2, 176, 400);
    this.controller = controller;
    controller.push(this.mainPage(controller));

    const unsubscribe = settings.subscribe(() => {
      this.subtitle?.setText(t('menu.subtitle'));
      this.lore?.setText(t('menu.lore'));
    });

    this.events.once('shutdown', () => {
      unsubscribe();
      controller.destroy();
    });
  }

  private mainPage(controller: MenuController): MenuPage {
    const hasSave = (): boolean => saveGame.exists();
    return {
      title: () => t('menu.title'),
      footer: () => t('menu.footer'),
      items: [
        {
          label: () => {
            const save = saveGame.load();
            return save ? t('menu.continueFloor', { n: save.floor + 1 }) : t('menu.continue');
          },
          enabled: hasSave,
          onSelect: () => this.startGame(true),
        },
        {
          label: () => t('menu.newGame'),
          onSelect: () => {
            if (!hasSave()) {
              this.startGame(false);
              return;
            }
            controller.push({
              title: () => t('menu.overwrite'),
              items: [
                { label: () => t('menu.overwriteYes'), onSelect: () => this.startGame(false) },
                { label: () => t('menu.no'), onSelect: () => controller.pop() },
              ],
            });
          },
        },
        { label: () => t('menu.records'), onSelect: () => controller.push(recordsPage(controller)) },
        { label: () => t('menu.settings'), onSelect: () => controller.push(buildSettingsPage(controller)) },
        { label: () => t('menu.credits'), onSelect: () => controller.push(creditsPage(controller)) },
      ],
    };
  }

  private startGame(resume: boolean): void {
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.fadeOut(450, 2, 2, 2);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const save = resume ? saveGame.load() : null;
      if (save) {
        music.stop(0.3);
        runStats.restore(save.stats);
        runFlags.restore(save.flags);
        this.scene.start('Game', { floor: save.floor, hp: save.hp, ammo: save.ammo });
        return;
      }
      runStats.reset();
      runFlags.reset();
      saveGame.clear();
      if (settings.data.cutscenes && !cutscenesDisabledByFlag()) this.scene.start('Cutscene', { id: 'intro', next: { scene: 'Intro' } });
      else this.scene.start('Intro');
    });
  }
}
