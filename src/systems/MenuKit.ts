import type { GameObjects, Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { sfx } from './Sfx';
import { t } from '../i18n';
import { KEY_ACTIONS, keyName, settings, type KeyAction, type Language } from './Settings';

export interface MenuItem {
  readonly label: () => string;
  readonly onSelect?: () => void;
  readonly onAdjust?: (direction: -1 | 1) => void;
  readonly enabled?: () => boolean;
}

export interface MenuPage {
  readonly title: string | (() => string);
  readonly items: readonly MenuItem[];
  readonly body?: () => readonly string[];
  readonly footer?: string | (() => string);
  readonly bodyLeft?: boolean;
  readonly bodyMinLines?: number;
  readonly scrollLines?: readonly string[];
  readonly onBack?: () => void;
}

export const MENU_COLORS = {
  title: '#d9a441',
  text: '#d7c9b3',
  dim: '#6b5a44',
  selected: '#ffd27a',
  danger: '#c8321e',
  body: '#9a8f7c',
} as const;

function text(value: string | (() => string) | undefined): string {
  if (value === undefined) return '';
  return typeof value === 'function' ? value() : value;
}

const FONT = 'monospace';
const ITEM_HEIGHT = 26;
const BODY_LINE_HEIGHT = 16;
const PANEL_PADDING = 22;
const TITLE_HEIGHT = 40;
const SCROLL_VIEW = 230;
const SCROLL_LINE = 20;
const AUTO_SCROLL_PX_PER_MS = 0.02;
const BUTTON_FILL = 0x2a2216;

export class MenuController {
  private readonly scene: Scene;
  private readonly centerX: number;
  private top: number;
  private readonly baseTop: number;
  private readonly panelWidth: number;
  private readonly pages: MenuPage[] = [];
  private readonly panel: GameObjects.Rectangle;
  private readonly titleText: GameObjects.Text;
  private readonly bodyText: GameObjects.Text;
  private readonly footerText: GameObjects.Text;
  private readonly itemTexts: GameObjects.Text[] = [];
  private readonly itemButtons: GameObjects.Rectangle[] = [];
  private readonly scrollTexts: GameObjects.Text[] = [];
  private readonly scrollTrack: GameObjects.Rectangle;
  private readonly scrollThumb: GameObjects.Rectangle;
  private readonly keyHandler: (event: KeyboardEvent) => void;
  private readonly updateHandler: (time: number, delta: number) => void;
  private unsubscribeSettings: (() => void) | null = null;
  private readonly wheelHandler: (pointer: unknown, over: unknown, dx: number, dy: number) => void;

  private selected = 0;
  private capture: ((code: number) => void) | null = null;
  private onRootBack: (() => void) | null = null;
  private scrollOffset = 0;
  private autoScroll = true;
  private scrollTop = 0;

  constructor(scene: Scene, centerX: number, top: number, panelWidth = 440) {
    this.scene = scene;
    this.centerX = centerX;
    this.top = top;
    this.baseTop = top;
    this.panelWidth = panelWidth;

    this.panel = scene.add
      .rectangle(centerX - panelWidth / 2, top, panelWidth, 100, 0x0b0907, 0.86)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6b5a44, 0.9)
      .setDepth(10);
    this.titleText = scene.add
      .text(centerX, top + PANEL_PADDING, '', { fontFamily: FONT, fontSize: '18px', color: MENU_COLORS.title })
      .setOrigin(0.5, 0)
      .setDepth(11);
    this.bodyText = scene.add
      .text(centerX, top, '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: MENU_COLORS.body,
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(11);
    this.footerText = scene.add
      .text(centerX, top, '', { fontFamily: FONT, fontSize: '10px', color: MENU_COLORS.dim })
      .setOrigin(0.5, 0)
      .setDepth(11);

    this.scrollTrack = scene.add
      .rectangle(centerX + panelWidth / 2 - 14, top, 3, 10, 0x3a3022, 0.8)
      .setOrigin(0, 0)
      .setDepth(11)
      .setVisible(false);
    this.scrollThumb = scene.add
      .rectangle(centerX + panelWidth / 2 - 14, top, 3, 10, 0xd9a441, 0.9)
      .setOrigin(0, 0)
      .setDepth(12)
      .setVisible(false);

    this.keyHandler = (event: KeyboardEvent): void => this.onKey(event);
    this.updateHandler = (_time: number, delta: number): void => this.updateScroll(delta);
    this.wheelHandler = (_pointer: unknown, _over: unknown, _dx: number, dy: number): void => {
      if (!this.page?.scrollLines) return;
      this.autoScroll = false;
      this.scrollBy(dy * 0.5);
    };
    scene.input.keyboard?.on('keydown', this.keyHandler);
    scene.events.on('update', this.updateHandler);
    scene.input.on('wheel', this.wheelHandler);
    this.unsubscribeSettings = settings.subscribe(() => this.refresh());
  }

  get page(): MenuPage | undefined {
    return this.pages[this.pages.length - 1];
  }

  get depth(): number {
    return this.pages.length;
  }

  setOnRootBack(callback: (() => void) | null): void {
    this.onRootBack = callback;
  }

  push(page: MenuPage): void {
    this.pages.push(page);
    this.selected = this.firstEnabled(page);
    this.rebuild();
  }

  pop(): void {
    this.pages.pop();
    const page = this.page;
    if (!page) {
      this.hide();
      return;
    }
    this.selected = this.firstEnabled(page);
    this.rebuild();
  }

  refresh(): void {
    const page = this.page;
    if (!page) return;
    for (let index = 0; index < this.itemTexts.length; index += 1) this.paintItem(index);
    if (page.body) this.bodyText.setText(page.body().join('\n'));
    this.titleText.setText(text(page.title));
    this.footerText.setText(text(page.footer));
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keyHandler);
    this.scene.events.off('update', this.updateHandler);
    this.scene.input.off('wheel', this.wheelHandler);
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
    this.clearScroll();
    this.scrollTrack.destroy();
    this.scrollThumb.destroy();
    for (const button of this.itemButtons) button.destroy();
    this.itemButtons.length = 0;
    this.panel.destroy();
    this.titleText.destroy();
    this.bodyText.destroy();
    this.footerText.destroy();
    for (const text of this.itemTexts) text.destroy();
    this.itemTexts.length = 0;
  }

  beginCapture(callback: (code: number) => void): void {
    this.capture = callback;
    this.refresh();
  }

  get isCapturing(): boolean {
    return this.capture !== null;
  }

  private hide(): void {
    this.panel.setVisible(false);
    this.titleText.setVisible(false);
    this.bodyText.setVisible(false);
    this.footerText.setVisible(false);
    for (const text of this.itemTexts) text.setVisible(false);
    for (const button of this.itemButtons) button.setVisible(false);
    this.clearScroll();
  }

  private isEnabled(item: MenuItem): boolean {
    return item.enabled ? item.enabled() : true;
  }

  private firstEnabled(page: MenuPage): number {
    const index = page.items.findIndex((item) => this.isEnabled(item));
    return index >= 0 ? index : 0;
  }

  private move(direction: -1 | 1): void {
    const page = this.page;
    if (!page || page.items.length === 0) return;
    let next = this.selected;
    for (let attempt = 0; attempt < page.items.length; attempt += 1) {
      next = (next + direction + page.items.length) % page.items.length;
      const item = page.items[next];
      if (item && this.isEnabled(item)) break;
    }
    this.selected = next;
    sfx.play('uiMove');
    this.refresh();
  }

  private activate(): void {
    const item = this.page?.items[this.selected];
    if (!item || !this.isEnabled(item)) return;
    sfx.play('uiClick');
    if (item.onSelect) item.onSelect();
    else item.onAdjust?.(1);
    this.refresh();
  }

  private adjust(direction: -1 | 1): void {
    const item = this.page?.items[this.selected];
    if (!item || !this.isEnabled(item)) return;
    item.onAdjust?.(direction);
    this.refresh();
  }

  private back(): void {
    const page = this.page;
    if (!page) return;
    if (this.pages.length <= 1) {
      this.onRootBack?.();
      return;
    }
    if (page.onBack) page.onBack();
    this.pop();
  }

  private onKey(event: KeyboardEvent): void {
    if (this.capture) {
      event.preventDefault();
      const callback = this.capture;
      this.capture = null;
      if (event.keyCode !== 27) callback(event.keyCode);
      this.refresh();
      return;
    }

    if (this.page?.scrollLines) {
      const scrollKeys: Record<number, number> = { 38: -40, 87: -40, 40: 40, 83: 40, 33: -200, 34: 200, 36: -100000, 35: 100000 };
      const delta = scrollKeys[event.keyCode];
      if (delta !== undefined) {
        this.autoScroll = false;
        this.scrollBy(delta);
        return;
      }
    }

    switch (event.keyCode) {
      case 38:
      case 87:
        this.move(-1);
        break;
      case 40:
      case 83:
        this.move(1);
        break;
      case 37:
      case 65:
        this.adjust(-1);
        break;
      case 39:
      case 68:
        this.adjust(1);
        break;
      case 13:
      case 32:
        this.activate();
        break;
      case 27:
      case 8:
        this.back();
        break;
      default:
        break;
    }
  }

  private rebuild(): void {
    const page = this.page;
    if (!page) return;

    this.clearScroll();
    this.panel.setVisible(true);
    this.titleText.setVisible(true).setText(text(page.title));
    this.footerText.setVisible(true);

    const scrolling = page.scrollLines !== undefined;
    const bodyLines = page.body ? page.body() : [];
    const reservedLines = Math.max(bodyLines.length, page.bodyMinLines ?? 0);
    this.bodyText.setText(bodyLines.join('\n'));
    const lineHeight =
      bodyLines.length > 0 ? Math.max(BODY_LINE_HEIGHT, (this.bodyText.height + this.bodyText.lineSpacing) / bodyLines.length) : BODY_LINE_HEIGHT;
    const bodyHeight = scrolling ? SCROLL_VIEW : Math.ceil(reservedLines * lineHeight);
    const relItemsTop = PANEL_PADDING + TITLE_HEIGHT + (bodyHeight > 0 ? bodyHeight + 14 : 0);
    const itemsHeight = page.items.length * ITEM_HEIGHT;
    const footerHeight = text(page.footer).trim().length > 0 ? 26 : 0;
    const height = relItemsTop + itemsHeight + 12 + footerHeight;
    this.top = Math.max(8, Math.min(this.baseTop, GAME_HEIGHT - height - 8));
    const itemsTop = this.top + relItemsTop;
    const footerY = itemsTop + itemsHeight + 12;

    this.panel.setY(this.top);
    this.titleText.setY(this.top + PANEL_PADDING);
    this.panel.setSize(this.panelWidth, height);
    this.panel.setStrokeStyle(1, 0x6b5a44, 0.9);

    this.bodyText.setVisible(reservedLines > 0 && !scrolling);
    this.bodyText.setPosition(this.centerX, this.top + PANEL_PADDING + TITLE_HEIGHT);
    this.bodyText.setAlign(page.bodyLeft ? 'left' : 'center');

    if (page.scrollLines) this.buildScroll(page.scrollLines, this.top + PANEL_PADDING + TITLE_HEIGHT);

    this.footerText.setPosition(this.centerX, footerY);
    this.footerText.setText(text(page.footer));

    for (const text of this.itemTexts) text.destroy();
    for (const button of this.itemButtons) button.destroy();
    this.itemTexts.length = 0;
    this.itemButtons.length = 0;

    const buttonWidth = this.panelWidth - 48;
    page.items.forEach((_, index) => {
      const rowY = itemsTop + index * ITEM_HEIGHT;
      const button = this.scene.add
        .rectangle(this.centerX, rowY + (ITEM_HEIGHT - 2) / 2, buttonWidth, ITEM_HEIGHT - 4, BUTTON_FILL, 0)
        .setStrokeStyle(1, 0x3a3022, 0.7)
        .setDepth(10.5);
      button.setInteractive({ useHandCursor: true });
      button.on('pointerover', () => {
        const item = page.items[index];
        if (!item || !this.isEnabled(item) || this.capture) return;
        this.selected = index;
        sfx.play('uiMove');
        this.refresh();
      });
      button.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const item = page.items[index];
        if (!item || !this.isEnabled(item) || this.capture) return;
        this.selected = index;
        if (item.onAdjust && !item.onSelect && pointer.x < this.centerX - buttonWidth / 6) {
          this.adjust(-1);
          return;
        }
        this.activate();
      });
    
      this.itemButtons.push(button);

      const text = this.scene.add
        .text(this.centerX, rowY + 3, '', {
          fontFamily: FONT,
          fontSize: '15px',
          color: MENU_COLORS.text,
        })
        .setOrigin(0.5, 0)
        .setDepth(11);
      this.itemTexts.push(text);
      this.paintItem(index);
    });
  }

  private buildScroll(lines: readonly string[], top: number): void {
    this.scrollTop = top;
    this.scrollOffset = 0;
    this.autoScroll = true;
    for (const line of lines) {
      const text = this.scene.add
        .text(this.centerX, top, line, { fontFamily: FONT, fontSize: '13px', color: MENU_COLORS.body })
        .setOrigin(0.5, 0)
        .setDepth(11);
      this.scrollTexts.push(text);
    }
    const x = this.centerX + this.panelWidth / 2 - 14;
    this.scrollTrack.setPosition(x, top).setSize(3, SCROLL_VIEW).setDisplaySize(3, SCROLL_VIEW).setVisible(true);
    this.scrollThumb.setPosition(x, top).setVisible(true);
    this.layoutScroll();
  }

  private clearScroll(): void {
    for (const text of this.scrollTexts) text.destroy();
    this.scrollTexts.length = 0;
    this.scrollTrack.setVisible(false);
    this.scrollThumb.setVisible(false);
  }

  private maxScroll(): number {
    return Math.max(0, this.scrollTexts.length * SCROLL_LINE - SCROLL_VIEW);
  }

  private scrollBy(delta: number): void {
    this.scrollOffset = Math.max(0, Math.min(this.maxScroll(), this.scrollOffset + delta));
    this.layoutScroll();
  }

  private updateScroll(delta: number): void {
    if (!this.page?.scrollLines || !this.autoScroll) return;
    this.scrollOffset += delta * AUTO_SCROLL_PX_PER_MS;
    if (this.scrollOffset > this.maxScroll() + SCROLL_VIEW * 0.4) this.scrollOffset = -SCROLL_VIEW * 0.4;
    this.layoutScroll();
  }

  private layoutScroll(): void {
    const top = this.scrollTop;
    const bottom = top + SCROLL_VIEW;
    this.scrollTexts.forEach((text, index) => {
      const y = top + index * SCROLL_LINE - this.scrollOffset;
      text.setY(y);
      const fadeIn = (y - top) / 18;
      const fadeOut = (bottom - (y + SCROLL_LINE)) / 18;
      const alpha = Math.max(0, Math.min(1, fadeIn, fadeOut + 1));
      text.setAlpha(alpha);
      text.setVisible(alpha > 0.02);
    });
    const content = Math.max(this.scrollTexts.length * SCROLL_LINE, 1);
    const thumbHeight = Math.max(14, Math.min(SCROLL_VIEW, (SCROLL_VIEW * SCROLL_VIEW) / content));
    const range = Math.max(1, this.maxScroll());
    const ratio = Math.max(0, Math.min(1, this.scrollOffset / range));
    this.scrollThumb.setSize(3, thumbHeight).setDisplaySize(3, thumbHeight);
    this.scrollThumb.setY(top + ratio * (SCROLL_VIEW - thumbHeight));
  }

  private paintItem(index: number): void {
    const page = this.page;
    const text = this.itemTexts[index];
    const item = page?.items[index];
    if (!text || !item) return;
    const enabled = this.isEnabled(item);
    const selected = index === this.selected;
    const label = item.label();
    text.setText(selected && enabled ? `> ${label} <` : label);
    text.setColor(!enabled ? MENU_COLORS.dim : selected ? MENU_COLORS.selected : MENU_COLORS.text);
    const button = this.itemButtons[index];
    if (button) {
      if (selected && enabled) {
        button.setFillStyle(BUTTON_FILL, 0.95).setStrokeStyle(1, 0xd9a441, 0.9);
      } else {
        button.setFillStyle(BUTTON_FILL, 0).setStrokeStyle(1, enabled ? 0x3a3022 : 0x24201a, 0.7);
      }
    }
  }
}

const ON_OFF = (value: boolean): string => (value ? t('ui.on') : t('ui.off'));

function row(label: string, value: string): string {
  return `${label.padEnd(18)} ${value}`;
}

function volumeLabel(label: string, value: number): string {
  return row(label, `${String(value).padStart(3)}%`);
}

function nextVolume(value: number, direction: -1 | 1): number {
  return Math.max(0, Math.min(100, value + direction * 10));
}

export function buildSettingsPage(controller: MenuController): MenuPage {
  return {
    title: () => t('settings.title'),
    footer: () => t('settings.footer'),
    items: [
      {
        label: () => volumeLabel(t('settings.masterVolume'), settings.data.masterVolume),
        onAdjust: (direction) => settings.update({ masterVolume: nextVolume(settings.data.masterVolume, direction) }),
      },
      {
        label: () => volumeLabel(t('settings.musicVolume'), settings.data.musicVolume),
        onAdjust: (direction) => settings.update({ musicVolume: nextVolume(settings.data.musicVolume, direction) }),
      },
      {
        label: () => volumeLabel(t('settings.sfxVolume'), settings.data.sfxVolume),
        onAdjust: (direction) => {
          settings.update({ sfxVolume: nextVolume(settings.data.sfxVolume, direction) });
          sfx.play('uiClick');
        },
      },
      {
        label: () => row(t('settings.screenShake'), ON_OFF(settings.data.screenShake)),
        onAdjust: () => settings.update({ screenShake: !settings.data.screenShake }),
      },
      {
        label: () => row(t('settings.minimap'), ON_OFF(settings.data.minimap)),
        onAdjust: () => settings.update({ minimap: !settings.data.minimap }),
      },
      {
        label: () => row(t('settings.showFps'), ON_OFF(settings.data.showFps)),
        onAdjust: () => settings.update({ showFps: !settings.data.showFps }),
      },
      {
        label: () => row(t('settings.cutscenes'), ON_OFF(settings.data.cutscenes)),
        onAdjust: () => settings.update({ cutscenes: !settings.data.cutscenes }),
      },
      {
        label: () => row(t('settings.hints'), ON_OFF(settings.data.hints)),
        onAdjust: () => settings.update({ hints: !settings.data.hints }),
      },
      {
        label: () => row(t('settings.voice'), ON_OFF(settings.data.voice)),
        onAdjust: () => settings.update({ voice: !settings.data.voice }),
      },
      {
        label: () => t('settings.resetHints'),
        onSelect: () => settings.resetHints(),
      },
      {
        label: () => row(t('settings.language'), t('settings.languageName')),
        onAdjust: () => {
          const next: Language = settings.data.language === 'en' ? 'tr' : 'en';
          settings.update({ language: next });
        },
      },
      { label: () => t('settings.controls'), onSelect: () => controller.push(buildControlsPage(controller)) },
      { label: () => t('ui.back'), onSelect: () => controller.pop() },
    ],
  };
}

export function buildControlsPage(controller: MenuController): MenuPage {
  let capturingAction: KeyAction | null = null;

  const rows = KEY_ACTIONS.map((action: KeyAction) => ({
    label: () =>
      controller.isCapturing && capturingAction === action
        ? `${t(`key.${action}`).padEnd(12)} ${t('controls.pressKey')}`
        : `${t(`key.${action}`).padEnd(12)} [${keyName(settings.data.keys[action])}]`,
    onSelect: () => {
      capturingAction = action;
      controller.beginCapture((code) => {
        capturingAction = null;
        settings.bindKey(action, code);
      });
    },
  }));

  return {
    title: () => t('controls.title'),
    body: () => [t('controls.body1'), t('controls.body2')],
    footer: () => t('controls.footer'),
    items: [
      ...rows,
      { label: () => t('controls.reset'), onSelect: () => settings.resetKeys() },
      { label: () => t('ui.back'), onSelect: () => controller.pop() },
    ],
  };
}

export function centerX(): number {
  return GAME_WIDTH / 2;
}
