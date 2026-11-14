import { BlendModes, type GameObjects, type Scene } from 'phaser';
import { DEPTH_FLOOR, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import {
  STEAM_CYCLE_MS,
  STEAM_DAMAGE,
  STEAM_ENEMY_COOLDOWN_MS,
  STEAM_IDLE_MS,
  STEAM_RADIUS,
  STEAM_WARN_MS,
} from '../data/hazards';
import { ENEMY_SPECS } from '../data/enemies';
import type { VentSpawn } from '../data/levelTypes';
import type { Drone } from '../entities/enemies/Drone';
import type { Player } from '../entities/Player';
import { gridVectorToWorld } from '../utils/iso';
import type { Dungeon } from './DungeonGen';
import type { LightSource } from './LightMap';
import { distanceGain, sfx } from './Sfx';

const PUFF_INTERVAL_MS = 110;

type Phase = 'idle' | 'warn' | 'active';

interface Cell {
  readonly x: number;
  readonly y: number;
}

interface Vent {
  readonly cell: Cell;
  readonly phaseMs: number;
  readonly grate: GameObjects.Ellipse;
  readonly glow: GameObjects.Ellipse;
  readonly enemyHurt: Map<Drone, number>;
  state: Phase;
  nextPuffAt: number;
}

function phaseAt(time: number, offset: number, cycle: number, idle: number, warn: number): Phase {
  const at = (time + offset) % cycle;
  if (at < idle) return 'idle';
  return at < idle + warn ? 'warn' : 'active';
}

export class Hazards {
  private readonly scene: Scene;
  private readonly player: Player;
  private readonly getEnemies: () => readonly Drone[];
  private readonly vents: Vent[] = [];

  constructor(
    scene: Scene,
    dungeon: Dungeon,
    player: Player,
    getEnemies: () => readonly Drone[],
  ) {
    this.scene = scene;
    this.player = player;
    this.getEnemies = getEnemies;

    for (const vent of dungeon.entities.hazards.vents) this.vents.push(this.buildVent(vent));
  }

  get ventCells(): readonly Cell[] {
    return this.vents.map((vent) => vent.cell);
  }

  update(): void {
    const now = this.scene.time.now;
    const at = this.player.gridPosition;
    const alive = !this.player.isDeadState;

    for (const vent of this.vents) this.updateVent(vent, now, at, alive);
  }

  emitLights(emit: (light: LightSource) => void): void {
    for (const vent of this.vents) {
      if (vent.state === 'idle') continue;
      const world = gridVectorToWorld(vent.cell.x, vent.cell.y, TILE_WIDTH, TILE_HEIGHT);
      emit({ x: world.x, y: world.y - 6, radius: vent.state === 'active' ? 70 : 40, intensity: 0.45, tint: 'ember' });
    }
  }

  destroy(): void {
    for (const vent of this.vents) {
      vent.grate.destroy();
      vent.glow.destroy();
    }
    this.vents.length = 0;
  }

  private buildVent(spawn: VentSpawn): Vent {
    const cell = { x: spawn.x, y: spawn.y };
    const world = gridVectorToWorld(cell.x, cell.y, TILE_WIDTH, TILE_HEIGHT);
    const grate = this.scene.add.ellipse(world.x, world.y, 26, 13, 0x1c1f1f, 0.95).setDepth(DEPTH_FLOOR + 2);
    const glow = this.scene.add
      .ellipse(world.x, world.y, 20, 10, 0xff8a3a, 0)
      .setDepth(DEPTH_FLOOR + 3)
      .setBlendMode(BlendModes.ADD);
    return {
      cell,
      phaseMs: spawn.phaseMs,
      grate,
      glow,
      enemyHurt: new Map(),
      state: 'idle',
      nextPuffAt: 0,
    };
  }

  private updateVent(vent: Vent, now: number, at: { x: number; y: number }, alive: boolean): void {
    const state = phaseAt(now, vent.phaseMs, STEAM_CYCLE_MS, STEAM_IDLE_MS, STEAM_WARN_MS);
    const world = gridVectorToWorld(vent.cell.x, vent.cell.y, TILE_WIDTH, TILE_HEIGHT);
    const gain = distanceGain(vent.cell.x, vent.cell.y, at.x, at.y);

    if (state !== vent.state) {
      if (state === 'warn' || state === 'active') sfx.play('steam', gain * (state === 'warn' ? 0.45 : 1));
      vent.state = state;
    }

    vent.glow.setAlpha(state === 'warn' ? 0.35 + Math.sin(now / 55) * 0.25 : state === 'active' ? 0.55 : 0);

    if (state !== 'active') return;
    if (now >= vent.nextPuffAt) {
      vent.nextPuffAt = now + PUFF_INTERVAL_MS;
      this.spawnPuff(world.x, world.y);
    }

    if (alive && Math.hypot(at.x - vent.cell.x, at.y - vent.cell.y) <= STEAM_RADIUS) {
      this.player.takeDamage(STEAM_DAMAGE, now, { x: at.x - vent.cell.x, y: at.y - vent.cell.y });
    }

    for (const enemy of this.getEnemies()) {
      if (enemy.isDead || ENEMY_SPECS[enemy.kind].boss) continue;
      const position = enemy.gridPosition;
      if (Math.hypot(position.x - vent.cell.x, position.y - vent.cell.y) > STEAM_RADIUS) continue;
      const last = vent.enemyHurt.get(enemy) ?? -STEAM_ENEMY_COOLDOWN_MS;
      if (now - last < STEAM_ENEMY_COOLDOWN_MS) continue;
      vent.enemyHurt.set(enemy, now);
      enemy.takeDamage(STEAM_DAMAGE);
    }
  }

  private spawnPuff(x: number, y: number): void {
    const drift = (Math.random() - 0.5) * 14;
    const puff = this.scene.add
      .ellipse(x + drift, y - 4, 10, 6, 0xd8dedc, 0.5)
      .setDepth(y + 40);
    this.scene.tweens.add({
      targets: puff,
      y: puff.y - 34 - Math.random() * 12,
      scaleX: 2.6,
      scaleY: 3,
      alpha: 0,
      duration: 650,
      ease: 'Sine.easeOut',
      onComplete: () => puff.destroy(),
    });
  }
}
