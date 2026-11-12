import { Textures, type GameObjects, type Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../data/config';
import type { DroneState } from '../entities/enemies/Drone';
import { t } from '../i18n';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import type { Exploration } from './Exploration';

export interface MapDrone {
  readonly x: number;
  readonly y: number;
  readonly state: DroneState;
}

export interface MapState {
  readonly exploration: Exploration;
  readonly playerX: number;
  readonly playerY: number;
  readonly drones: readonly MapDrone[];
  readonly exit: { readonly x: number; readonly y: number } | null;
  readonly exitOpen: boolean;
}

const CELL = 5;
const PAD = 3;
const MARGIN = 12;
const FOG_KEY = 'minimap_fog';
const FOG_UNEXPLORED = 1;
const FOG_REMEMBERED = 0.62;
const FOG_VISIBLE = 0;
const FOG_EASE_MS = 250;
const FOG_EPSILON = 0.004;

export class MiniMap {
  private readonly columns: number;
  private readonly rows: number;
  private readonly width: number;
  private readonly height: number;
  private readonly left: number;
  private readonly top: number;
  private readonly base: GameObjects.Graphics;
  private readonly tab: GameObjects.Graphics;
  private readonly tabText: GameObjects.Text;
  private lastTabText = '';
  private readonly low: GameObjects.Graphics;
  private readonly high: GameObjects.Graphics;
  private readonly fogImage: GameObjects.Image;
  private readonly fogContext: CanvasRenderingContext2D;
  private readonly fogAlpha: Float32Array;
  private readonly scene: Scene;

  private exploration: Exploration | null = null;
  private lastNow = 0;
  private lastRevision = -1;

  constructor(scene: Scene, columns: number, rows: number) {
    this.scene = scene;
    this.columns = columns;
    this.rows = rows;
    this.width = PAD * 2 + columns * CELL;
    this.height = PAD * 2 + rows * CELL;
    this.left = GAME_WIDTH - MARGIN - this.width;
    this.top = GAME_HEIGHT - MARGIN - this.height;
    this.fogAlpha = new Float32Array(columns * rows).fill(FOG_UNEXPLORED);

    this.base = scene.add.graphics();
    this.tab = scene.add.graphics();
    this.tabText = scene.add
      .text(this.left + 16, this.top - 8, '', { fontFamily: 'monospace', fontSize: '8px', color: '#050505' })
      .setOrigin(0, 0.5);
    this.low = scene.add.graphics();

    if (scene.textures.exists(FOG_KEY)) scene.textures.remove(FOG_KEY);
    this.fogContext = createCanvasContext(scene, FOG_KEY, columns, rows);
    scene.textures.get(FOG_KEY).setFilter(Textures.FilterMode.LINEAR);
    this.fogImage = scene.add
      .image(this.left + PAD, this.top + PAD, FOG_KEY)
      .setOrigin(0, 0)
      .setScale(CELL);

    this.high = scene.add.graphics();
    this.paintFog(true);
  }

  update(state: MapState, now: number): void {
    if (this.exploration !== state.exploration) {
      this.exploration = state.exploration;
      this.fogAlpha.fill(FOG_UNEXPLORED);
      this.lastRevision = -1;
      this.drawBase(state.exploration);
    }

    const dt = this.lastNow === 0 ? 16 : Math.min(100, now - this.lastNow);
    this.lastNow = now;

    this.drawTab(state.exploration.percent);
    this.stepFog(state.exploration, dt);
    this.drawLow(state, now);
    this.drawHigh(state, now);
  }

  destroy(): void {
    this.base.destroy();
    this.tab.destroy();
    this.tabText.destroy();
    this.low.destroy();
    this.high.destroy();
    this.fogImage.destroy();
    if (this.scene.textures.exists(FOG_KEY)) this.scene.textures.remove(FOG_KEY);
  }

  private drawTab(percent: number): void {
    const label = t('hud.map', { p: percent });
    if (label === this.lastTabText) return;
    this.lastTabText = label;
    this.tabText.setText(label);
    const width = this.tabText.width + 12;
    const color = percent >= 100 ? 0x3ab4d2 : 0xd9a441;
    this.tab.clear();
    this.tab.fillStyle(color, 1);
    this.tab.fillRect(this.left + 10, this.top - 14, width, 12);
  }

  private cellX(gridX: number): number {
    return this.left + PAD + gridX * CELL;
  }

  private cellY(gridY: number): number {
    return this.top + PAD + gridY * CELL;
  }

  private drawBase(exploration: Exploration): void {
    const g = this.base;
    g.clear();
    g.fillStyle(PALETTE.void, 0.86);
    g.fillRect(this.left, this.top, this.width, this.height);
    g.lineStyle(2, PALETTE.steelLight, 0.9);
    g.strokeRect(this.left + 1, this.top + 1, this.width - 2, this.height - 2);

    g.fillStyle(PALETTE.steelLight, 1);
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        if (exploration.isFloor(x, y)) g.fillRect(this.cellX(x), this.cellY(y), CELL, CELL);
      }
    }
  }

  private stepFog(exploration: Exploration, dt: number): void {
    const ease = Math.min(1, dt / FOG_EASE_MS);
    let changed = this.lastRevision !== exploration.revision;
    this.lastRevision = exploration.revision;

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const index = y * this.columns + x;
        const target = exploration.isVisible(x, y)
          ? FOG_VISIBLE
          : exploration.isSeen(x, y)
            ? FOG_REMEMBERED
            : FOG_UNEXPLORED;
        const current = this.fogAlpha[index] ?? FOG_UNEXPLORED;
        const delta = target - current;
        if (Math.abs(delta) < FOG_EPSILON) {
          if (delta !== 0) {
            this.fogAlpha[index] = target;
            changed = true;
          }
          continue;
        }
        this.fogAlpha[index] = current + delta * ease;
        changed = true;
      }
    }

    if (changed) this.paintFog(false);
  }

  private paintFog(initial: boolean): void {
    const image = this.fogContext.createImageData(this.columns, this.rows);
    for (let index = 0; index < this.fogAlpha.length; index += 1) {
      const alpha = initial ? FOG_UNEXPLORED : (this.fogAlpha[index] ?? FOG_UNEXPLORED);
      image.data[index * 4 + 3] = Math.round(alpha * 255);
    }
    this.fogContext.putImageData(image, 0, 0);
    refreshCanvasTexture(this.scene, FOG_KEY);
  }

  private drawLow(state: MapState, now: number): void {
    const g = this.low;
    g.clear();
    const exit = state.exit;
    if (exit && state.exploration.isSeen(exit.x, exit.y)) {
      const pulse = 0.65 + Math.sin(now / 260) * 0.35;
      g.fillStyle(state.exitOpen ? 0x3ab4d2 : PALETTE.signal, pulse);
      g.fillRect(this.cellX(exit.x) - 1, this.cellY(exit.y) - 1, CELL + 2, CELL + 2);
    }
  }

  private drawHigh(state: MapState, now: number): void {
    const g = this.high;
    g.clear();

    for (const drone of state.drones) {
      const gx = Math.round(drone.x);
      const gy = Math.round(drone.y);
      if (!state.exploration.isVisible(gx, gy)) continue;
      const color =
        drone.state === 'CHASE' ? 0xff4a3a : drone.state === 'SEARCH' ? 0xd9a441 : PALETTE.bone;
      g.fillStyle(color, 1);
      g.fillRect(this.cellX(gx), this.cellY(gy), CELL, CELL);
    }

    const blink = Math.floor(now / 380) % 2 === 0;
    g.fillStyle(PALETTE.amber, blink ? 1 : 0.65);
    g.fillRect(
      this.cellX(Math.round(state.playerX)) - 1,
      this.cellY(Math.round(state.playerY)) - 1,
      CELL + 2,
      CELL + 2,
    );
  }
}
