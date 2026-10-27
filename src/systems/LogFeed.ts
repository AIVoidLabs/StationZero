import type { GameObjects, Scene } from 'phaser';
import { LOG_REACH_TILES, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import { CORRUPTED_LOGS, SEALED_LOG } from '../data/logs';
import { gridVectorToWorld } from '../utils/iso';

export interface TerminalCell {
  readonly x: number;
  readonly y: number;
}

const LABEL_OFFSET_Y = 56;
const FADE_PER_SECOND = 3.2;

function logFor(cell: TerminalCell, sealed: boolean): string {
  if (sealed) return SEALED_LOG;
  const hash = ((cell.x * 73856093) ^ (cell.y * 19349663)) >>> 0;
  return CORRUPTED_LOGS[hash % CORRUPTED_LOGS.length] ?? CORRUPTED_LOGS[0] ?? '';
}

function step(current: number, target: number, delta: number): number {
  const amount = (delta / 1000) * FADE_PER_SECOND;
  if (current < target) return Math.min(target, current + amount);
  if (current > target) return Math.max(target, current - amount);
  return target;
}

export class LogFeed {
  private readonly label: GameObjects.Text;
  private readonly terminals: readonly TerminalCell[];
  private readonly sealed: boolean;
  private active = -1;
  private alpha = 0;

  constructor(scene: Scene, terminals: readonly TerminalCell[], sealed = false) {
    this.terminals = terminals;
    this.sealed = sealed;
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#b0a27a',
        resolution: 2,
        stroke: '#050505',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setAlpha(0);
  }

  update(gridX: number, gridY: number, delta: number): void {
    const index = this.nearest(gridX, gridY);

    if (index !== this.active) {
      this.active = index;
      this.alpha = 0;
      if (index >= 0) this.place(index);
    }

    this.alpha = step(this.alpha, this.active >= 0 ? 1 : 0, delta);
    this.label.setAlpha(this.alpha);
  }

  destroy(): void {
    this.label.destroy();
  }

  private place(index: number): void {
    const cell = this.terminals[index];
    if (!cell) {
      this.active = -1;
      return;
    }

    const iso = gridVectorToWorld(cell.x, cell.y, TILE_WIDTH, TILE_HEIGHT);
    this.label
      .setText(logFor(cell, this.sealed))
      .setPosition(iso.x, iso.y - LABEL_OFFSET_Y)
      .setDepth(iso.y);
  }

  private nearest(gridX: number, gridY: number): number {
    let best = -1;
    let bestDistance = LOG_REACH_TILES;

    for (let index = 0; index < this.terminals.length; index += 1) {
      const cell = this.terminals[index];
      if (!cell) continue;

      const dx = cell.x - gridX;
      const dy = cell.y - gridY;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      if (distance > bestDistance) continue;

      best = index;
      bestDistance = distance;
    }

    return best;
  }
}
