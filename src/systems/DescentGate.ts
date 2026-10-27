import { BlendModes, type GameObjects, type Scene } from 'phaser';
import {
  DEPTH_DARKNESS,
  DEPTH_FLOOR,
  DESCENT_DWELL_MS,
  DESCENT_SIGNAL_RANGE,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../data/config';
import type { Player } from '../entities/Player';
import { gridVectorToWorld } from '../utils/iso';
import type { DungeonExit } from './DungeonGen';
import {
  DESCENT_GLOW_KEY,
  DESCENT_HATCH_KEY,
  DESCENT_SHAFT_KEY,
  DESCENT_SIGNAL_KEY,
} from './PlaceholderArt';

const CELL_RADIUS = 0.55;
const SIGNAL_NEAR_TILES = 3;
const DWELL_RELEASE_RATE = 1.5;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class DescentGate {
  private readonly exit: DungeonExit;
  private readonly hatch: GameObjects.Image;
  private readonly glow: GameObjects.Image;
  private readonly signal: GameObjects.Image;
  private readonly shaft: GameObjects.Image;

  private elapsed = 0;
  private dwell = 0;
  private triggered = false;

  constructor(scene: Scene, exit: DungeonExit) {
    this.exit = exit;
    const iso = gridVectorToWorld(exit.x, exit.y, TILE_WIDTH, TILE_HEIGHT);

    this.hatch = scene.add
      .image(iso.x, iso.y, DESCENT_HATCH_KEY)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_FLOOR + 2);

    this.glow = scene.add
      .image(iso.x, iso.y, DESCENT_GLOW_KEY)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_FLOOR + 3)
      .setBlendMode(BlendModes.ADD)
      .setScale(0.8)
      .setAlpha(0.34);

    this.signal = scene.add
      .image(iso.x, iso.y - 6, DESCENT_SIGNAL_KEY)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_DARKNESS + 2)
      .setBlendMode(BlendModes.ADD)
      .setAlpha(0);

    this.shaft = scene.add
      .image(iso.x, iso.y, DESCENT_SHAFT_KEY)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_DARKNESS + 1)
      .setBlendMode(BlendModes.ADD)
      .setAlpha(0);
  }

  update(deltaMs: number, player: Player): boolean {
    this.elapsed += deltaMs;

    const grid = player.gridPosition;
    const inCell =
      Math.abs(grid.x - this.exit.x) <= CELL_RADIUS &&
      Math.abs(grid.y - this.exit.y) <= CELL_RADIUS;

    if (inCell) {
      this.dwell = Math.min(DESCENT_DWELL_MS, this.dwell + deltaMs);
    } else {
      this.dwell = Math.max(0, this.dwell - deltaMs * DWELL_RELEASE_RATE);
    }

    const progress = this.dwell / DESCENT_DWELL_MS;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 0.0026);
    const flicker = 0.5 + 0.5 * Math.sin(this.elapsed * 0.0017 + 1.2);
    const distance = Math.hypot(grid.x - this.exit.x, grid.y - this.exit.y);
    const proximity = clamp01(
      1 - (distance - SIGNAL_NEAR_TILES) / (DESCENT_SIGNAL_RANGE - SIGNAL_NEAR_TILES),
    );

    this.glow.setScale(0.9 + progress * 0.55).setAlpha(0.36 + pulse * 0.1 + progress * 0.3);
    this.hatch.setAlpha(0.86 + progress * 0.14);
    this.signal.setAlpha(
      proximity <= 0 ? 0 : (0.18 + proximity * 0.42 + progress * 0.18) * (0.8 + pulse * 0.2),
    );
    this.shaft.setAlpha(0.16 + proximity * 0.1 + progress * 0.2 + flicker * 0.03);
    this.shaft.setScale(1 + progress * 0.25);

    if (this.triggered) return false;
    if (progress < 1) return false;

    this.triggered = true;
    return true;
  }

  destroy(): void {
    this.hatch.destroy();
    this.glow.destroy();
    this.signal.destroy();
    this.shaft.destroy();
  }
}
