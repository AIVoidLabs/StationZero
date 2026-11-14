import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { dialogueForFloor, type DialogueNode, type DialogueScript } from '../data/dialogue';
import { t, type StringKey } from '../i18n';
import { MenuController, type MenuPage } from '../systems/MenuKit';
import { runFlags } from '../systems/RunFlags';
import { sfx } from '../systems/Sfx';
import { voice } from '../systems/Voice';
import type { Game } from './Game';

interface DialogueData {
  readonly floor?: number;
}

const WRAP_CHARS = 64;
const CHAR_MS = 22;

function wrap(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line.length + word.length + 1 > width && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line = line.length > 0 ? `${line} ${word}` : word;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

export class DialogueScene extends Scene {
  private controller: MenuController | undefined;
  private script: DialogueScript | undefined;
  private floor = 0;
  private typed = 0;
  private fullLine = '';
  private entered = new Set<string>();
  private keyHandler: ((event: KeyboardEvent) => void) | undefined;

  constructor() {
    super({ key: 'Dialogue' });
  }

  create(data?: DialogueData): void {
    this.floor = data?.floor ?? 0;
    this.script = dialogueForFloor(this.floor);
    this.entered.clear();
    this.typed = 0;

    const game = this.scene.get('Game') as Game;
    game.setAudioDucked(true);
    sfx.attach(this);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050505, 0.72).setOrigin(0, 0).setDepth(0);
    const controller = new MenuController(this, GAME_WIDTH / 2, 90, 640);
    this.controller = controller;
    controller.setOnRootBack(() => this.close());

    const script = this.script;
    if (!script || runFlags.isUsed(`d_${script.id}`)) controller.push(this.idlePage());
    else this.goTo(script.start);

    this.keyHandler = (event: KeyboardEvent): void => {
      const index = event.keyCode - 49;
      if (index < 0 || index > 8) return;
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
    if (this.typed >= this.fullLine.length) return;
    this.typed = Math.min(this.fullLine.length, this.typed + Math.max(1, Math.floor(delta / CHAR_MS)));
    this.controller?.refresh();
  }

  private goTo(nodeId: string): void {
    const script = this.script;
    const game = this.scene.get('Game') as Game;
    const node = script?.nodes[nodeId];
    if (!script || !node) {
      this.finish();
      return;
    }

    if (!this.entered.has(nodeId)) {
      this.entered.add(nodeId);
      for (const effect of node.effects ?? []) game.applyDialogueEffect(effect);
    }
    this.fullLine = t(node.line);
    voice.clear();
    voice.say(node.line, node.speaker);
    this.typed = 0;
    this.controller?.replaceAll(this.nodePage(node));
  }

  private nodePage(node: DialogueNode): MenuPage {
    return {
      title: () => t(`speaker.${node.speaker}`),
      bodyLeft: true,
      bodyMinLines: wrap(this.fullLine, WRAP_CHARS).length,
      body: () => wrap(this.fullLine.slice(0, this.typed), WRAP_CHARS),
      footer: () => t('dialogue.footer'),
      items: node.choices.map((choice, index) => ({
        label: () => `${index + 1}. ${t(choice.text as StringKey)}`,
        onSelect: () => {
          const game = this.scene.get('Game') as Game;
          for (const effect of choice.effects ?? []) game.applyDialogueEffect(effect);
          if (choice.next === null) this.finish();
          else this.goTo(choice.next);
        },
      })),
    };
  }

  private idlePage(): MenuPage {
    return {
      title: () => t('speaker.warden'),
      body: () => [t('dialogue.idle')],
      footer: () => t('dialogue.footer'),
      items: [{ label: () => t('dialogue.leave'), onSelect: () => this.close() }],
    };
  }

  private finish(): void {
    if (this.script) runFlags.markUsed(`d_${this.script.id}`);
    this.close();
  }

  private close(): void {
    const game = this.scene.get('Game') as Game;
    game.setAudioDucked(false);
    voice.clear();
    this.scene.resume('Game');
    this.scene.resume('HudScene');
    this.scene.stop();
  }
}
