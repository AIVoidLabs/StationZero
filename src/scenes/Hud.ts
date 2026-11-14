import { GameObjects, Scene } from 'phaser';
import { HUD_BULLET_EMPTY_KEY, HUD_BULLET_KEY, HUD_CROSS_KEY } from '../assets/manifest';
import { SECRET_COUNT } from '../data/secrets';
import { GAME_HEIGHT, GAME_WIDTH, PISTOL_MAX_AMMO, PLAYER_MAX_HP } from '../data/config';
import { t } from '../i18n';
import { hints } from '../systems/Hints';
import { PanelFrame, drawSlantCell } from '../systems/HudKit';
import { MiniMap } from '../systems/MiniMap';
import { settings } from '../systems/Settings';
import { sfx } from '../systems/Sfx';
import { voice } from '../systems/Voice';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import type { Game } from './Game';

const DEATH_VIGNETTE_KEY = 'hud_death_vignette';
const HURT_VIGNETTE_KEY = 'hud_hurt_vignette';
const HEAL_VIGNETTE_KEY = 'hud_heal_vignette';

const FONT = 'monospace';
const GREEN = 0x6fae4f;
const AMBER = 0xd9a441;
const ORANGE = 0xff7a4a;
const RED = 0xc8321e;
const CYAN = 0x3ab4d2;
const SEG_WIDTH = 22;
const SEG_HEIGHT = 16;
const SEG_PITCH = 25;
const SEG_SKEW = 4;
const HP_X = 14;
const HP_Y = 26;
const HP_W = 262;
const HP_H = 62;
const HP_SLOTS = PLAYER_MAX_HP + 2;
const AMMO_SLOTS = PISTOL_MAX_AMMO + 3;
const ECG_SAMPLES = 100;
const ECG_STEP_MS = 16;
const PIP_SPACING = 11;
const PIP_SCALE = 1.5;
const AMMO_W = 262;
const AMMO_H = 44;
const AMMO_X = 14;
const AMMO_Y = GAME_HEIGHT - 14 - AMMO_H;
const SECTOR_W = 280;
const SECTOR_H = 62;
const SECTOR_X = GAME_WIDTH - 14 - SECTOR_W;
const SECTOR_Y = 26;
const LOW_AMMO = 3;
const HEARTBEAT_MS = 950;
const CARD_FADE_IN = 500;
const CARD_HOLD = 2400;
const CARD_FADE_OUT = 800;

interface Segment {
  fill: number;
  flash: number;
  flashColor: number;
  animating: boolean;
}

function ecgWave(phase: number): number {
  if (phase > 0.1 && phase < 0.18) return 0.16 * Math.sin(((phase - 0.1) / 0.08) * Math.PI);
  if (phase > 0.3 && phase < 0.33) return -0.22;
  if (phase >= 0.33 && phase < 0.36) return 1;
  if (phase >= 0.36 && phase < 0.39) return -0.45;
  if (phase > 0.55 && phase < 0.72) return 0.26 * Math.sin(((phase - 0.55) / 0.17) * Math.PI);
  return 0;
}

function makeVignette(scene: Scene, key: string, rgb: string, edgeAlpha: number): void {
  if (scene.textures.exists(key)) return;
  const ctx = createCanvasContext(scene, key, 480, 270);
  const gradient = ctx.createRadialGradient(240, 135, 70, 240, 135, 290);
  gradient.addColorStop(0, `rgba(${rgb}, 0)`);
  gradient.addColorStop(0.6, `rgba(${rgb}, ${edgeAlpha * 0.3})`);
  gradient.addColorStop(1, `rgba(${rgb}, ${edgeAlpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 480, 270);
  refreshCanvasTexture(scene, key);
}

export class HudScene extends Scene {
  private hpFrame!: PanelFrame;
  private ammoFrame!: PanelFrame;
  private sectorFrame!: PanelFrame;
  private barGfx!: GameObjects.Graphics;
  private ecgGfx!: GameObjects.Graphics;
  private stripeGfx!: GameObjects.Graphics;
  private cross!: GameObjects.Image;
  private segments: Segment[] = [];
  private pips: GameObjects.Image[] = [];
  private ammoCount!: GameObjects.Text;
  private ammoMax!: GameObjects.Text;
  private ammoWarn!: GameObjects.Text;
  private codeText!: GameObjects.Text;
  private nameText!: GameObjects.Text;
  private objectiveText!: GameObjects.Text;
  private codeBox!: GameObjects.Graphics;
  private subtitleBg!: GameObjects.Rectangle;
  private subtitleText!: GameObjects.Text;
  private hintBg!: GameObjects.Rectangle;
  private hintText!: GameObjects.Text;
  private cardGroup!: GameObjects.Container;
  private cardCode!: GameObjects.Text;
  private cardName!: GameObjects.Text;
  private cardTagline!: GameObjects.Text;
  private pointer!: GameObjects.Container;
  private promptBg!: GameObjects.Rectangle;
  private promptText!: GameObjects.Text;
  private hurtVignette!: GameObjects.Image;
  private healVignette!: GameObjects.Image;
  private lowVignette!: GameObjects.Image;
  private deathOverlay!: GameObjects.Image;
  private deathText!: GameObjects.Text;
  private miniMap: MiniMap | null = null;
  private fpsText!: GameObjects.Text;
  private fpsClock = 0;
  private fpsSmooth = 60;

  private ecg: number[] = [];
  private ecgPhase = 0;
  private ecgClock = 0;
  private shakeX = 0;
  private currentHp = 4;
  private maxHpShown = PLAYER_MAX_HP;
  private secretText!: GameObjects.Text;
  private objectiveCalm = false;
  private lastObjective = '';
  private lastCode = '';
  private lastName = '';
  private lastCard = 0;
  private prevHp = -1;
  private prevAmmo = -1;
  private prevFloor = -1;
  private nextBeat = 0;
  private deathShown = false;

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT,
      fontSize: '11px',
      color: '#d7c9b3',
    };

    makeVignette(this, HURT_VIGNETTE_KEY, '220, 24, 12', 0.9);
    makeVignette(this, HEAL_VIGNETTE_KEY, '70, 230, 130', 0.55);
    this.hurtVignette = this.fullImage(HURT_VIGNETTE_KEY, 0);
    this.healVignette = this.fullImage(HEAL_VIGNETTE_KEY, 0);
    this.lowVignette = this.fullImage(HURT_VIGNETTE_KEY, 0);

    this.hpFrame = new PanelFrame(this, HP_X, HP_Y, HP_W, HP_H, { label: t('hud.vitals'), accent: GREEN });
    this.cross = this.add.image(HP_X + 14, HP_Y + 11, HUD_CROSS_KEY).setOrigin(0, 0).setScale(2);
    this.barGfx = this.add.graphics();
    this.ecgGfx = this.add.graphics();
    this.segments = [];
    for (let index = 0; index < HP_SLOTS; index += 1) {
      this.segments.push({ fill: 1, flash: 0, flashColor: 0xffffff, animating: false });
    }

    this.secretText = this.add
      .text(HP_X + 4, HP_Y + HP_H + 8, '', { fontFamily: FONT, fontSize: '9px', color: '#d9a441' })
      .setOrigin(0, 0);

    this.ammoFrame = new PanelFrame(this, AMMO_X, AMMO_Y, AMMO_W, AMMO_H, { label: t('hud.ammo'), accent: AMBER });
    const ammoBox = this.add.graphics();
    ammoBox.fillStyle(0x050505, 0.9);
    ammoBox.fillRect(AMMO_X + 182, AMMO_Y + 8, 68, AMMO_H - 16);
    ammoBox.lineStyle(1, 0x6b5a44, 0.9);
    ammoBox.strokeRect(AMMO_X + 182.5, AMMO_Y + 8.5, 67, AMMO_H - 17);
    this.pips = [];
    for (let index = 0; index < AMMO_SLOTS; index += 1) {
      this.pips.push(
        this.add
          .image(AMMO_X + 14 + index * PIP_SPACING, AMMO_Y + 13, HUD_BULLET_KEY)
          .setOrigin(0, 0)
          .setScale(PIP_SCALE),
      );
    }
    this.ammoCount = this.add
      .text(AMMO_X + 206, AMMO_Y + AMMO_H / 2, '00', { fontFamily: FONT, fontSize: '20px', color: '#d9a441' })
      .setOrigin(0.5, 0.5);
    this.ammoMax = this.add
      .text(AMMO_X + 241, AMMO_Y + AMMO_H / 2 + 5, `/${PISTOL_MAX_AMMO}`, { ...textStyle, fontSize: '9px', color: '#6b5a44' })
      .setOrigin(0.5, 0.5);
    this.ammoWarn = this.add
      .text(AMMO_X + 216, AMMO_Y + AMMO_H / 2, t('hud.noAmmo'), { ...textStyle, fontSize: '10px', color: '#c8321e' })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.sectorFrame = new PanelFrame(this, SECTOR_X, SECTOR_Y, SECTOR_W, SECTOR_H, { label: t('hud.sector'), accent: RED });
    this.codeBox = this.add.graphics();
    this.stripeGfx = this.add.graphics();
    this.codeText = this.add
      .text(SECTOR_X + 41, SECTOR_Y + 27, '', { fontFamily: FONT, fontSize: '26px', color: '#d9a441' })
      .setOrigin(0.5, 0.5);
    this.nameText = this.add
      .text(SECTOR_X + 80, SECTOR_Y + 20, '', { fontFamily: FONT, fontSize: '15px', color: '#d7c9b3' })
      .setOrigin(0, 0.5);
    this.objectiveText = this.add
      .text(SECTOR_X + 80, SECTOR_Y + 38, '', { ...textStyle, fontSize: '10px', color: '#c8321e' })
      .setOrigin(0, 0.5);

    this.subtitleBg = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 128, 660, 28, 0x050505, 0.72)
      .setOrigin(0.5, 0.5)
      .setAlpha(0);
    this.subtitleText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 128, '', { ...textStyle, fontSize: '13px', color: '#9fd8e8' })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);
    this.hintBg = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 84, 760, 32, 0x14110e, 0.82)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(1, 0xd9a441, 0.7)
      .setAlpha(0);
    this.hintText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 84, '', { ...textStyle, fontSize: '13px', color: '#ecdcb6' })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);

    this.promptBg = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 168, 260, 26, 0x14110e, 0.9)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(1, 0xd9a441, 0.9)
      .setVisible(false);
    this.promptText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 168, '', { ...textStyle, fontSize: '12px', color: '#f0c070' })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.cardCode = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '54px', color: '#d9a441' }).setOrigin(0.5, 0.5);
    this.cardName = this.add.text(0, 52, '', { fontFamily: FONT, fontSize: '28px', color: '#d7c9b3' }).setOrigin(0.5, 0.5);
    this.cardTagline = this.add.text(0, 88, '', { fontFamily: FONT, fontSize: '13px', color: '#a08a66' }).setOrigin(0.5, 0.5);
    const cardBg = this.add.rectangle(0, 42, 520, 170, 0x050505, 0.62).setOrigin(0.5, 0.5);
    this.cardGroup = this.add
      .container(GAME_WIDTH / 2, 170, [cardBg, this.cardCode, this.cardName, this.cardTagline])
      .setAlpha(0);

    const arrow = this.add.graphics();
    arrow.fillStyle(CYAN, 1);
    arrow.fillTriangle(14, 0, -8, -9, -8, 9);
    arrow.lineStyle(1, 0x050505, 1);
    arrow.strokeTriangle(14, 0, -8, -9, -8, 9);
    const pointerLabel = this.add
      .text(0, 20, t('hud.exit'), { ...textStyle, fontSize: '9px', color: '#3ab4d2' })
      .setOrigin(0.5, 0.5);
    this.pointer = this.add.container(0, 0, [arrow, pointerLabel]).setVisible(false);

    makeVignette(this, DEATH_VIGNETTE_KEY, '52, 7, 4', 0.94);
    this.deathOverlay = this.fullImage(DEATH_VIGNETTE_KEY, 0);
    this.deathText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, t('hud.signalLost'), {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#8c3b2a',
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);

    this.fpsText = this.add
      .text(GAME_WIDTH / 2, 8, '', { fontFamily: FONT, fontSize: '10px', color: '#6fae4f' })
      .setOrigin(0.5, 0);
    this.fpsClock = 0;

    this.ecg = new Array<number>(ECG_SAMPLES).fill(0);
    this.ecgPhase = 0;
    this.ecgClock = 0;
    this.shakeX = 0;
    this.currentHp = PLAYER_MAX_HP;
    this.objectiveCalm = false;
    this.lastObjective = '';
    this.lastCode = '';
    this.lastName = '';
    this.lastCard = 0;
    this.prevHp = -1;
    this.prevAmmo = -1;
    this.prevFloor = -1;
    this.nextBeat = 0;
    this.miniMap?.destroy();
    this.miniMap = null;
    this.deathShown = false;

    const unsubscribe = settings.subscribe(() => this.refreshLabels());
    this.events.once('shutdown', unsubscribe);
  }

  private refreshLabels(): void {
    this.hpFrame.setLabel(t('hud.vitals'));
    this.ammoFrame.setLabel(t('hud.ammo'));
    this.sectorFrame.setLabel(t('hud.sector'));
    this.ammoWarn.setText(t('hud.noAmmo'));
    const label = this.pointer.list[1] as GameObjects.Text | undefined;
    label?.setText(t('hud.exit'));
    this.deathText.setText(t('hud.signalLost'));
    this.lastName = '';
    this.lastObjective = '';
  }

  update(time: number, delta: number): void {
    this.updateFps(delta);
    const game = this.scene.get('Game') as Game;
    const state = game.hudState;
    if (!state) return;

    const floorChanged = state.floor !== this.prevFloor;
    this.updateHealth(state.hp, state.maxHp, floorChanged);
    this.updateAmmo(state.ammo, state.maxAmmo, state.weaponType, floorChanged);
    this.secretText.setText(`${t('hud.secrets')} ${state.secrets}/${SECRET_COUNT}`);
    this.prevFloor = state.floor;

    this.updateSector(state.floorCode, state.floorName, state.objective, state.objectiveCalm);
    this.drawHealth(delta);
    this.drawStripe(state.objectiveCalm);

    if (state.cardToken !== this.lastCard) {
      this.lastCard = state.cardToken;
      this.showCard(state.floorCode, state.floorName, state.floorTagline);
    }

    this.updatePrompt(state.prompt);
    this.updateText(time);
    this.updatePointer(state.exitPointer);
    this.updateMap(game);
    this.updateDeath(state.hp);
  }

  private updateFps(delta: number): void {
    this.fpsText.setVisible(settings.data.showFps);
    if (!settings.data.showFps) return;
    const instant = delta > 0 ? 1000 / delta : 60;
    this.fpsSmooth += (instant - this.fpsSmooth) * 0.08;
    this.fpsClock += delta;
    if (this.fpsClock < 250) return;
    this.fpsClock = 0;
    const fps = Math.round(this.fpsSmooth);
    this.fpsText.setText(`${fps} FPS`);
    this.fpsText.setColor(fps >= 55 ? '#6fae4f' : fps >= 30 ? '#d9a441' : '#c8321e');
  }

  private fullImage(key: string, alpha: number): GameObjects.Image {
    return this.add
      .image(0, 0, key)
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(Math.max(0, alpha));
  }

  private hpColor(hp: number): number {
    if (hp >= this.maxHpShown * 0.6) return GREEN;
    if (hp > this.maxHpShown * 0.3) return AMBER;
    return RED;
  }

  private updateSector(code: string, name: string, objective: string, calm: boolean): void {
    if (code !== this.lastCode) {
      this.codeText.setText(code);
      this.lastCode = code;
    }
    if (name !== this.lastName) {
      this.nameText.setText(name);
      this.lastName = name;
    }
    if (objective !== this.lastObjective || calm !== this.objectiveCalm) {
      this.lastObjective = objective;
      this.objectiveCalm = calm;
      this.objectiveText.setText(objective ? `>> ${objective}` : '');
      this.objectiveText.setColor(calm ? '#3ab4d2' : '#c8321e');
      const accent = calm ? CYAN : RED;
      this.sectorFrame.setAccent(accent);
      this.codeBox.clear();
      this.codeBox.fillStyle(0x050505, 0.92);
      this.codeBox.fillRect(SECTOR_X + 14, SECTOR_Y + 10, 54, 34);
      this.codeBox.lineStyle(1, accent, 0.9);
      this.codeBox.strokeRect(SECTOR_X + 14.5, SECTOR_Y + 10.5, 53, 33);
    }
  }

  private drawStripe(calm: boolean): void {
    const g = this.stripeGfx;
    g.clear();
    const x0 = SECTOR_X + 12;
    const width = SECTOR_W - 24;
    const y = SECTOR_Y + SECTOR_H - 11;
    const offset = calm ? 0 : (this.time.now / 60) % 12;
    g.fillStyle(0x050505, 1);
    g.fillRect(x0, y, width, 4);
    const color = calm ? CYAN : RED;
    for (let x = -12; x < width; x += 12) {
      const left = Math.max(0, x + offset);
      const right = Math.min(width, x + offset + 6);
      if (right > left) drawSlantCell(g, x0 + left, y, right - left, 4, 2, color, calm ? 0.8 : 0.95);
    }
  }

  private updateHealth(hp: number, maxHp: number, skipEffects: boolean): void {
    const previous = this.prevHp;
    this.prevHp = hp;
    this.currentHp = hp;
    this.maxHpShown = maxHp;
    this.hpFrame.setAccent(this.hpColor(hp));

    this.segments.forEach((segment, index) => {
      if (!segment.animating) segment.fill = index < hp && index < maxHp ? 1 : 0;
    });

    if (previous >= 0 && !skipEffects && hp !== previous) {
      if (hp < previous) this.onDamage(previous - hp, hp);
      else this.onHeal(previous, hp);
    }

    const low = hp === 1 && !this.deathShown;
    this.lowVignette.setAlpha(low ? 0.16 + 0.22 * (0.5 + 0.5 * Math.sin(this.time.now / 260)) : 0);
    if (low && this.time.now >= this.nextBeat) {
      this.nextBeat = this.time.now + HEARTBEAT_MS;
      sfx.play('heartbeat');
    }
  }

  private drawHealth(delta: number): void {
    const hp = this.currentHp;
    const color = this.hpColor(hp);
    const g = this.barGfx;
    g.clear();
    const x0 = HP_X + 56 + this.shakeX;
    const y0 = HP_Y + 12;
    const pulse = hp === 1 ? 0.6 + 0.4 * Math.sin(this.time.now / 170) : 1;

    this.cross.setX(HP_X + 14 + this.shakeX);

    this.segments.forEach((segment, index) => {
      if (index >= this.maxHpShown) return;
      const x = x0 + index * SEG_PITCH;
      drawSlantCell(g, x - 1, y0 - 1, SEG_WIDTH + 2, SEG_HEIGHT + 2, SEG_SKEW, 0x050505, 1);
      drawSlantCell(g, x, y0, SEG_WIDTH, SEG_HEIGHT, SEG_SKEW, 0x241d14, 1);
      if (segment.fill > 0) {
        const alpha = (index === 0 ? pulse : 1) * Math.min(1, segment.fill + 0.2);
        const width = SEG_WIDTH * segment.fill;
        drawSlantCell(g, x, y0, width, SEG_HEIGHT, SEG_SKEW, color, alpha);
        drawSlantCell(g, x, y0, width, 4, SEG_SKEW, 0xffffff, 0.22 * alpha);
        drawSlantCell(g, x, y0 + SEG_HEIGHT - 3, width, 3, SEG_SKEW, 0x000000, 0.28 * alpha);
      }
      if (segment.flash > 0.01) {
        drawSlantCell(g, x, y0, SEG_WIDTH, SEG_HEIGHT, SEG_SKEW, segment.flashColor, segment.flash);
      }
    });

    this.ecgClock += delta;
    const rate = hp >= 4 ? 0.9 : hp === 3 ? 1.05 : hp === 2 ? 1.35 : hp === 1 ? 1.9 : 0;
    while (this.ecgClock >= ECG_STEP_MS) {
      this.ecgClock -= ECG_STEP_MS;
      this.ecgPhase = (this.ecgPhase + (ECG_STEP_MS / 1000) * rate) % 1;
      this.ecg.push(hp > 0 ? ecgWave(this.ecgPhase) : 0);
      if (this.ecg.length > ECG_SAMPLES) this.ecg.shift();
    }

    const e = this.ecgGfx;
    e.clear();
    const ex = HP_X + 56 + this.shakeX;
    const ey = HP_Y + 47;
    e.lineStyle(1, 0x2a2218, 1);
    e.beginPath();
    e.moveTo(ex, ey);
    e.lineTo(ex + ECG_SAMPLES * 2, ey);
    e.strokePath();
    e.lineStyle(1.5, hp > 0 ? color : RED, 0.95);
    e.beginPath();
    this.ecg.forEach((value, index) => {
      const px = ex + index * 2;
      const py = ey - value * 8;
      if (index === 0) e.moveTo(px, py);
      else e.lineTo(px, py);
    });
    e.strokePath();
  }

  private onDamage(amount: number, hp: number): void {
    this.tweens.killTweensOf(this.hurtVignette);
    this.hurtVignette.setAlpha(Math.min(1, 0.55 + amount * 0.18));
    this.tweens.add({ targets: this.hurtVignette, alpha: 0, duration: 520, ease: 'Quad.easeOut' });

    for (let index = hp; index < hp + amount; index += 1) {
      const segment = this.segments[index];
      if (!segment) continue;
      segment.fill = 0;
      segment.animating = false;
      segment.flashColor = 0xffffff;
      this.tweens.killTweensOf(segment);
      segment.flash = 1;
      this.tweens.add({
        targets: segment,
        flash: 0,
        duration: 140,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          segment.flash = 0;
        },
      });
    }

    this.hpFrame.flash(0xff3a22);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 260,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        this.shakeX = Math.sin(t * Math.PI * 8) * 5 * (1 - t);
      },
      onComplete: () => {
        this.shakeX = 0;
      },
    });
  }

  private onHeal(from: number, to: number): void {
    this.tweens.killTweensOf(this.healVignette);
    this.healVignette.setAlpha(0.5);
    this.tweens.add({ targets: this.healVignette, alpha: 0, duration: 650, ease: 'Quad.easeOut' });

    for (let index = from; index < to; index += 1) {
      const segment = this.segments[index];
      if (!segment) continue;
      segment.fill = 0;
      segment.animating = true;
      segment.flashColor = 0x9af0b4;
      segment.flash = 0.8;
      this.tweens.killTweensOf(segment);
      this.tweens.add({
        targets: segment,
        fill: 1,
        flash: 0,
        duration: 420,
        ease: 'Back.easeOut',
        delay: (index - from) * 110,
        onComplete: () => {
          segment.animating = false;
          segment.fill = 1;
        },
      });
    }
    this.hpFrame.flash(0x7af0a0);
  }

  private updateAmmo(ammo: number, maxAmmo: number, weapon: string, skipEffects: boolean): void {
    const previous = this.prevAmmo;
    this.prevAmmo = ammo;
    const empty = ammo <= 0 || weapon === 'MELEE';
    const low = ammo > 0 && ammo <= LOW_AMMO;
    const blink = 0.55 + 0.45 * Math.abs(Math.sin(this.time.now / 220));

    this.ammoMax.setText(`/${maxAmmo}`);
    this.pips.forEach((pip, index) => {
      pip.setVisible(index < maxAmmo);
      const filled = index < ammo;
      pip.setTexture(filled ? HUD_BULLET_KEY : HUD_BULLET_EMPTY_KEY);
      if (filled && low) pip.setTint(ORANGE);
      else pip.clearTint();
      pip.setAlpha(empty ? blink : 1);
    });

    this.ammoFrame.setAccent(empty ? RED : low ? ORANGE : AMBER);
    this.ammoCount.setText(String(Math.max(0, ammo)).padStart(2, '0'));
    this.ammoCount.setColor(empty ? '#c8321e' : low ? '#ff9a5a' : '#d9a441');
    this.ammoCount.setVisible(!empty);
    this.ammoMax.setVisible(!empty);
    this.ammoWarn.setVisible(empty);
    this.ammoWarn.setAlpha(blink);

    if (previous < 0 || skipEffects || ammo === previous) return;

    if (ammo < previous) {
      const pip = this.pips[ammo];
      if (pip) {
        pip.setTexture(HUD_BULLET_KEY).setTint(0xffffff).setScale(PIP_SCALE * 1.5);
        this.tweens.add({
          targets: pip,
          scale: PIP_SCALE,
          duration: 180,
          ease: 'Quad.easeOut',
          onComplete: () => pip.setTexture(HUD_BULLET_EMPTY_KEY).clearTint(),
        });
      }
      this.tweens.add({ targets: this.ammoCount, scale: { from: 1.3, to: 1 }, duration: 160 });
    } else {
      for (let index = previous; index < ammo; index += 1) {
        const pip = this.pips[index];
        if (!pip) continue;
        pip.setScale(PIP_SCALE * 1.7);
        this.tweens.add({
          targets: pip,
          scale: PIP_SCALE,
          duration: 260,
          ease: 'Back.easeOut',
          delay: (index - previous) * 55,
        });
      }
      this.tweens.add({ targets: this.ammoCount, scale: { from: 1.4, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      this.ammoFrame.flash(0xf0c070);
    }
  }

  private showCard(code: string, name: string, tagline: string): void {
    this.cardCode.setText(code);
    this.cardName.setText(name);
    this.cardTagline.setText(tagline);
    this.tweens.killTweensOf(this.cardGroup);
    this.cardGroup.setAlpha(0);
    this.tweens.chain({
      targets: this.cardGroup,
      tweens: [
        { alpha: 1, duration: CARD_FADE_IN, ease: 'Sine.easeOut' },
        { alpha: 1, duration: CARD_HOLD },
        { alpha: 0, duration: CARD_FADE_OUT, ease: 'Sine.easeIn' },
      ],
    });
  }

  private updatePrompt(prompt: string | null): void {
    const visible = prompt !== null;
    this.promptBg.setVisible(visible);
    this.promptText.setVisible(visible);
    if (prompt === null) return;
    if (this.promptText.text !== prompt) this.promptText.setText(prompt);
    const width = this.promptText.width + 36;
    this.promptBg.setSize(width, 26).setDisplaySize(width, 26);
    this.promptText.setAlpha(0.75 + 0.25 * Math.sin(this.time.now / 260));
  }

  private updateText(time: number): void {
    const line = voice.current;
    const subtitle = line ? `> ${voice.speakerLabel(line.speaker)} :: ${line.text.toUpperCase()}` : '';
    if (subtitle !== this.subtitleText.text) this.subtitleText.setText(subtitle);
    const subtitleTarget = line ? 1 : 0;
    this.subtitleText.setAlpha(this.subtitleText.alpha + (subtitleTarget - this.subtitleText.alpha) * 0.2);
    this.subtitleBg.setAlpha(this.subtitleText.alpha * 0.72);
    const subtitleWidth = Math.max(80, this.subtitleText.width + 40);
    this.subtitleBg.setSize(subtitleWidth, 28).setDisplaySize(subtitleWidth, 28);

    const hint = hints.tick(time);
    if (hint !== null && hint !== this.hintText.text) this.hintText.setText(hint);
    const hintTarget = hint !== null ? 1 : 0;
    this.hintText.setAlpha(this.hintText.alpha + (hintTarget - this.hintText.alpha) * 0.18);
    this.hintBg.setAlpha(this.hintText.alpha * 0.82);
    const hintWidth = Math.max(120, this.hintText.width + 44);
    this.hintBg.setSize(hintWidth, 32).setDisplaySize(hintWidth, 32);
  }

  private updatePointer(pointer: { x: number; y: number; angle: number; visible: boolean } | null): void {
    if (!pointer || !pointer.visible) {
      this.pointer.setVisible(false);
      return;
    }
    const bob = 3 * Math.sin(this.time.now / 200);
    this.pointer.setVisible(true);
    this.pointer.setPosition(pointer.x + Math.cos(pointer.angle) * bob, pointer.y + Math.sin(pointer.angle) * bob);
    this.pointer.setRotation(pointer.angle);
    const label = this.pointer.list[1] as GameObjects.Text | undefined;
    label?.setRotation(-pointer.angle);
  }

  private updateMap(game: Game): void {
    const mapState = game.mapState;
    if (!settings.data.minimap && this.miniMap) {
      this.miniMap.destroy();
      this.miniMap = null;
    }
    if (mapState && settings.data.minimap) {
      if (!this.miniMap) {
        this.miniMap = new MiniMap(this, mapState.exploration.width, mapState.exploration.height);
      }
      this.miniMap.update(mapState, this.time.now);
    }
  }

  private updateDeath(hp: number): void {
    if (hp <= 0) {
      if (!this.deathShown) {
        this.deathShown = true;
        this.tweens.add({ targets: this.deathOverlay, alpha: 1, duration: 420, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: this.deathText, alpha: 1, duration: 700, delay: 220, ease: 'Quad.easeOut' });
      }
      return;
    }

    if (this.deathShown) {
      this.deathShown = false;
      this.tweens.killTweensOf(this.deathOverlay);
      this.tweens.killTweensOf(this.deathText);
      this.deathOverlay.setAlpha(0);
      this.deathText.setAlpha(0);
    }
  }
}
