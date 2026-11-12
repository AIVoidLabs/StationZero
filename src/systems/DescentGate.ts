import { BlendModes, type GameObjects, type Scene } from 'phaser';
import {
  DOOR_CLOSED_V2_KEY,
  DOOR_OPEN_V2_KEY,
  selectWorldArt,
} from '../assets/manifest';
import {
  DEPTH_DARKNESS,
  DEPTH_FLOOR,
  DESCENT_SIGNAL_RANGE,
  DOOR_OPEN_MS,
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

export type DoorState = 'LOCKED' | 'OPENING' | 'OPEN';

const CELL_RADIUS = 0.55;
const SIGNAL_NEAR_TILES = 3;
const LOCKED_TINT = 0x7a5a5a;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class DescentGate {
  private readonly exit: DungeonExit;
  private readonly hatch: GameObjects.Image;
  private readonly glow: GameObjects.Image;
  private readonly signal: GameObjects.Image;
  private readonly shaft: GameObjects.Image;
  private readonly lamp: GameObjects.Arc;
  private readonly closedKey: string | null;
  private readonly openKey: string | null;

  private doorState: DoorState = 'LOCKED';
  private openMs = 0;
  private elapsed = 0;
  private triggered = false;

  constructor(scene: Scene, exit: DungeonExit) {
    this.exit = exit;
    const iso = gridVectorToWorld(exit.x, exit.y, TILE_WIDTH, TILE_HEIGHT);
    const useV2 =
      selectWorldArt().door &&
      scene.textures.exists(DOOR_CLOSED_V2_KEY) &&
      scene.textures.exists(DOOR_OPEN_V2_KEY);
    this.closedKey = useV2 ? DOOR_CLOSED_V2_KEY : null;
    this.openKey = useV2 ? DOOR_OPEN_V2_KEY : null;

    this.hatch = scene.add
      .image(iso.x, iso.y, this.closedKey ?? DESCENT_HATCH_KEY)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_FLOOR + 2);
    if (!useV2) this.hatch.setTint(LOCKED_TINT);

    this.glow = scene.add
      .image(iso.x, iso.y, DESCENT_GLOW_KEY)
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_FLOOR + 3)
      .setBlendMode(BlendModes.ADD)
      .setScale(0.8)
      .setAlpha(0);

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

    this.lamp = scene.add
      .circle(iso.x, iso.y - 2, 2.2, 0xff3a22, 1)
      .setDepth(DEPTH_FLOOR + 4)
      .setBlendMode(BlendModes.ADD);
    if (useV2) this.lamp.setVisible(false);
  }

  get state(): DoorState {
    return this.doorState;
  }

  get isOpen(): boolean {
    return this.doorState === 'OPEN';
  }

  get openness(): number {
    if (this.doorState === 'LOCKED') return 0;
    if (this.doorState === 'OPEN') return 1;
    return clamp01(this.openMs / DOOR_OPEN_MS);
  }

  get cell(): DungeonExit {
    return this.exit;
  }

  open(): void {
    if (this.doorState !== 'LOCKED') return;
    this.doorState = 'OPENING';
    this.openMs = 0;
    if (this.openKey !== null) this.hatch.setTexture(this.openKey);
    else this.hatch.clearTint();
    this.lamp.setVisible(false);
  }

  update(deltaMs: number, player: Player): boolean {
    this.elapsed += deltaMs;

    if (this.doorState === 'OPENING') {
      this.openMs += deltaMs;
      if (this.openMs >= DOOR_OPEN_MS) this.doorState = 'OPEN';
    }

    const openness = this.openness;
    const grid = player.gridPosition;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 0.0026);
    const flicker = 0.5 + 0.5 * Math.sin(this.elapsed * 0.0017 + 1.2);
    const distance = Math.hypot(grid.x - this.exit.x, grid.y - this.exit.y);
    const proximity = clamp01(
      1 - (distance - SIGNAL_NEAR_TILES) / (DESCENT_SIGNAL_RANGE - SIGNAL_NEAR_TILES),
    );

    if (this.doorState === 'LOCKED') {
      this.lamp.setAlpha(0.45 + pulse * 0.55);
    } else {
      this.glow.setScale(0.9 + openness * 0.2).setAlpha((0.36 + pulse * 0.1) * openness);
      this.signal.setAlpha(
        proximity <= 0 ? 0 : (0.18 + proximity * 0.42) * (0.8 + pulse * 0.2) * openness,
      );
      this.shaft.setAlpha((0.16 + proximity * 0.1 + flicker * 0.03) * openness);
      this.shaft.setScale(1 + (1 - openness) * 0.2);
    }

    if (this.triggered || this.doorState !== 'OPEN') return false;

    const inCell =
      Math.abs(grid.x - this.exit.x) <= CELL_RADIUS &&
      Math.abs(grid.y - this.exit.y) <= CELL_RADIUS;
    if (!inCell) return false;

    this.triggered = true;
    return true;
  }

  setActivation(progress: number): void {
    const p = clamp01(progress);
    this.glow.setScale(1.1 + p * 0.55).setAlpha(0.46 + p * 0.4);
    this.shaft.setScale(1 + p * 0.25);
  }

  destroy(): void {
    this.hatch.destroy();
    this.glow.destroy();
    this.signal.destroy();
    this.shaft.destroy();
    this.lamp.destroy();
  }
}
