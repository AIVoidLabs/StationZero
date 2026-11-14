import { BlendModes, type GameObjects, type Scene } from 'phaser';
import { DEPTH_DARKNESS, DEPTH_FLOOR, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import {
  HAZARD_IDLE_TICK_MS,
  HAZARD_SENSE_TILES,
  SHOCK_CYCLE_MS,
  SHOCK_DAMAGE,
  SHOCK_ENEMY_COOLDOWN_MS,
  SHOCK_IDLE_MS,
  SHOCK_RADIUS,
  SHOCK_WARN_MS,
  STEAM_CYCLE_MS,
  STEAM_DAMAGE,
  STEAM_ENEMY_COOLDOWN_MS,
  STEAM_IDLE_MS,
  STEAM_RADIUS,
  STEAM_WARN_MS,
} from '../data/hazards';
import { ENEMY_SPECS } from '../data/enemies';
import type { ShockSpawn, VentSpawn } from '../data/levelTypes';
import type { Drone } from '../entities/enemies/Drone';
import type { Player } from '../entities/Player';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import { gridVectorToWorld } from '../utils/iso';
import type { Dungeon } from './DungeonGen';
import type { LightSource } from './LightMap';
import { distanceGain, sfx } from './Sfx';

const PUFF_INTERVAL_MS = 110;
const FRAME_KEY = 'hazard_frame';
const FRAME_ALPHA = 0.9;
const BEACON_KEY = 'hazard_beacon';
const BEACON_LIFT_PX = 38;
const BEACON_FADE_FROM_TILES = 4;
const ELECTRODE_SPREAD_PX = 21;
const ELECTRODE_LIFT_PX = 7;
const ARC_SEGMENTS = 7;
const ARC_JITTER_PX = 6;

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
  readonly frame: GameObjects.Image;
  readonly beacon: GameObjects.Image;
  readonly enemyHurt: Map<Drone, number>;
  state: Phase;
  nextPuffAt: number;
  nextTickAt: number;
}

interface Shock {
  readonly cell: Cell;
  readonly phaseMs: number;
  readonly frame: GameObjects.Image;
  readonly beacon: GameObjects.Image;
  readonly plate: GameObjects.Ellipse;
  readonly ring: GameObjects.Ellipse;
  readonly posts: readonly GameObjects.Arc[];
  readonly arcs: GameObjects.Graphics;
  readonly enemyHurt: Map<Drone, number>;
  state: Phase;
  nextTickAt: number;
  nextSparkAt: number;
}

function phaseAt(time: number, offset: number, cycle: number, idle: number, warn: number): Phase {
  const at = (time + offset) % cycle;
  if (at < idle) return 'idle';
  return at < idle + warn ? 'warn' : 'active';
}

function ensureBeacon(scene: Scene): void {
  if (scene.textures.exists(BEACON_KEY)) return;
  const size = 18;
  const ctx = createCanvasContext(scene, BEACON_KEY, size, size);
  ctx.beginPath();
  ctx.moveTo(size / 2, 1);
  ctx.lineTo(size - 1, size - 2);
  ctx.lineTo(1, size - 2);
  ctx.closePath();
  ctx.fillStyle = '#e8c060';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#120e06';
  ctx.stroke();
  ctx.fillStyle = '#120e06';
  ctx.fillRect(size / 2 - 1, 6, 2, 6);
  ctx.fillRect(size / 2 - 1, 13, 2, 2);
  refreshCanvasTexture(scene, BEACON_KEY);
}

function ensureFrame(scene: Scene): void {
  ensureBeacon(scene);
  if (scene.textures.exists(FRAME_KEY)) return;
  const width = TILE_WIDTH;
  const height = TILE_HEIGHT;
  const ctx = createCanvasContext(scene, FRAME_KEY, width, height);
  const path = (inset: number): void => {
    ctx.beginPath();
    ctx.moveTo(width / 2, inset / 2);
    ctx.lineTo(width - inset, height / 2);
    ctx.lineTo(width / 2, height - inset / 2);
    ctx.lineTo(inset, height / 2);
    ctx.closePath();
  };
  path(3);
  ctx.fillStyle = 'rgba(20, 16, 6, 0.38)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#e8c060';
  path(3);
  ctx.stroke();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#120e06';
  path(3);
  ctx.stroke();
  ctx.setLineDash([]);
  refreshCanvasTexture(scene, FRAME_KEY);
}

function jaggedArc(
  g: GameObjects.Graphics,
  from: { x: number; y: number },
  to: { x: number; y: number },
  width: number,
  color: number,
  alpha: number,
): void {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  g.moveTo(from.x, from.y);
  for (let index = 1; index < ARC_SEGMENTS; index += 1) {
    const t = index / ARC_SEGMENTS;
    g.lineTo(
      from.x + (to.x - from.x) * t + (Math.random() - 0.5) * ARC_JITTER_PX,
      from.y + (to.y - from.y) * t + (Math.random() - 0.5) * ARC_JITTER_PX * 2,
    );
  }
  g.lineTo(to.x, to.y);
  g.strokePath();
}

export class Hazards {
  private readonly scene: Scene;
  private readonly player: Player;
  private readonly getEnemies: () => readonly Drone[];
  private readonly vents: Vent[] = [];
  private readonly shocks: Shock[] = [];

  constructor(
    scene: Scene,
    dungeon: Dungeon,
    player: Player,
    getEnemies: () => readonly Drone[],
  ) {
    this.scene = scene;
    this.player = player;
    this.getEnemies = getEnemies;
    ensureFrame(scene);

    for (const vent of dungeon.entities.hazards.vents) this.vents.push(this.buildVent(vent));
    for (const shock of dungeon.entities.hazards.shocks) this.shocks.push(this.buildShock(shock));
  }

  get ventCells(): readonly Cell[] {
    return this.vents.map((vent) => vent.cell);
  }

  get shockCells(): readonly Cell[] {
    return this.shocks.map((shock) => shock.cell);
  }

  update(): void {
    const now = this.scene.time.now;
    const at = this.player.gridPosition;
    const alive = !this.player.isDeadState;

    for (const vent of this.vents) this.updateVent(vent, now, at, alive);
    for (const shock of this.shocks) this.updateShock(shock, now, at, alive);
  }

  emitLights(emit: (light: LightSource) => void): void {
    for (const vent of this.vents) {
      const world = gridVectorToWorld(vent.cell.x, vent.cell.y, TILE_WIDTH, TILE_HEIGHT);
      if (vent.state === 'idle') {
        emit({ x: world.x, y: world.y - 4, radius: 34, intensity: 0.24, tint: 'ember' });
        continue;
      }
      emit({ x: world.x, y: world.y - 6, radius: vent.state === 'active' ? 70 : 40, intensity: 0.45, tint: 'ember' });
    }
    for (const shock of this.shocks) {
      const world = gridVectorToWorld(shock.cell.x, shock.cell.y, TILE_WIDTH, TILE_HEIGHT);
      if (shock.state === 'idle') {
        emit({ x: world.x, y: world.y - 4, radius: 38, intensity: 0.28, tint: 'cyan' });
      } else if (shock.state === 'warn') {
        const flicker = Math.floor(this.scene.time.now / 70) % 2 === 0 ? 0.65 : 0.3;
        emit({ x: world.x, y: world.y - 8, radius: 60, intensity: flicker, tint: 'cyan' });
      } else {
        emit({ x: world.x, y: world.y - 10, radius: 100, intensity: 0.95, tint: 'cyan' });
      }
    }
  }

  destroy(): void {
    for (const vent of this.vents) {
      vent.grate.destroy();
      vent.glow.destroy();
      vent.frame.destroy();
      vent.beacon.destroy();
    }
    for (const shock of this.shocks) {
      shock.frame.destroy();
      shock.beacon.destroy();
      shock.plate.destroy();
      shock.ring.destroy();
      shock.arcs.destroy();
      for (const post of shock.posts) post.destroy();
    }
    this.vents.length = 0;
    this.shocks.length = 0;
  }

  private buildBeacon(world: { x: number; y: number }): GameObjects.Image {
    return this.scene.add.image(world.x, world.y - BEACON_LIFT_PX, BEACON_KEY).setDepth(DEPTH_DARKNESS + 3).setAlpha(0);
  }

  private updateBeacon(beacon: GameObjects.Image, distance: number, state: Phase, now: number): void {
    const near = Math.max(0, Math.min(1, (HAZARD_SENSE_TILES + 1 - distance) / (HAZARD_SENSE_TILES + 1 - BEACON_FADE_FROM_TILES)));
    const rate = state === 'idle' ? 240 : state === 'warn' ? 90 : 60;
    const blink = 0.6 + 0.4 * Math.sin(now / rate);
    beacon.setAlpha(near * blink);
    beacon.setScale(state === 'idle' ? 1 : 1.25);
  }

  private buildFrame(world: { x: number; y: number }): GameObjects.Image {
    return this.scene.add.image(world.x, world.y, FRAME_KEY).setDepth(DEPTH_FLOOR + 1).setAlpha(FRAME_ALPHA);
  }

  private buildVent(spawn: VentSpawn): Vent {
    const cell = { x: spawn.x, y: spawn.y };
    const world = gridVectorToWorld(cell.x, cell.y, TILE_WIDTH, TILE_HEIGHT);
    const frame = this.buildFrame(world);
    const beacon = this.buildBeacon(world);
    const grate = this.scene.add.ellipse(world.x, world.y, 26, 13, 0x1c1f1f, 0.95).setDepth(DEPTH_FLOOR + 2);
    const glow = this.scene.add
      .ellipse(world.x, world.y, 20, 10, 0xff8a3a, 1)
      .setAlpha(0)
      .setDepth(DEPTH_FLOOR + 3)
      .setBlendMode(BlendModes.ADD);
    return {
      cell,
      phaseMs: spawn.phaseMs,
      grate,
      glow,
      frame,
      beacon,
      enemyHurt: new Map(),
      state: 'idle',
      nextPuffAt: 0,
      nextTickAt: 0,
    };
  }

  private buildShock(spawn: ShockSpawn): Shock {
    const cell = { x: spawn.x, y: spawn.y };
    const world = gridVectorToWorld(cell.x, cell.y, TILE_WIDTH, TILE_HEIGHT);
    const frame = this.buildFrame(world);
    const beacon = this.buildBeacon(world);
    const plate = this.scene.add.ellipse(world.x, world.y, 30, 15, 0x14202a, 0.95).setDepth(DEPTH_FLOOR + 2);
    const ring = this.scene.add
      .ellipse(world.x, world.y, 30, 15, 0x000000, 0)
      .setStrokeStyle(2, 0x59d8ff, 1)
      .setAlpha(0.45)
      .setDepth(DEPTH_FLOOR + 3)
      .setBlendMode(BlendModes.ADD);
    const posts = [-1, 1].map((side) =>
      this.scene.add
        .circle(world.x + side * ELECTRODE_SPREAD_PX, world.y - ELECTRODE_LIFT_PX, 3, 0x59d8ff, 1)
        .setDepth(world.y + 20),
    );
    const arcs = this.scene.add.graphics().setDepth(world.y + 21).setBlendMode(BlendModes.ADD);
    return {
      cell,
      phaseMs: spawn.phaseMs,
      frame,
      beacon,
      plate,
      ring,
      posts,
      arcs,
      enemyHurt: new Map(),
      state: 'idle',
      nextTickAt: 0,
      nextSparkAt: 0,
    };
  }

  private updateVent(vent: Vent, now: number, at: { x: number; y: number }, alive: boolean): void {
    const state = phaseAt(now, vent.phaseMs, STEAM_CYCLE_MS, STEAM_IDLE_MS, STEAM_WARN_MS);
    const world = gridVectorToWorld(vent.cell.x, vent.cell.y, TILE_WIDTH, TILE_HEIGHT);
    const gain = distanceGain(vent.cell.x, vent.cell.y, at.x, at.y);
    const distance = Math.hypot(at.x - vent.cell.x, at.y - vent.cell.y);

    if (state !== vent.state) {
      if (state === 'warn' || state === 'active') sfx.play('steam', gain * (state === 'warn' ? 0.45 : 1));
      vent.state = state;
    }

    if (state === 'idle' && distance <= HAZARD_SENSE_TILES && now >= vent.nextTickAt) {
      vent.nextTickAt = now + HAZARD_IDLE_TICK_MS;
      sfx.play('hazardTick', gain * 0.5);
    }

    vent.glow.setAlpha(state === 'warn' ? 0.35 + Math.sin(now / 55) * 0.25 : state === 'active' ? 0.55 : 0.12 + Math.sin(now / 420) * 0.05);
    vent.frame.setAlpha(state === 'idle' ? FRAME_ALPHA : 0.6 + 0.4 * Math.abs(Math.sin(now / 160)));
    this.updateBeacon(vent.beacon, distance, state, now);

    if (state !== 'active') return;
    if (now >= vent.nextPuffAt) {
      vent.nextPuffAt = now + PUFF_INTERVAL_MS;
      this.spawnPuff(world.x, world.y);
    }

    if (alive && distance <= STEAM_RADIUS) {
      this.player.takeDamage(STEAM_DAMAGE, now, { x: at.x - vent.cell.x, y: at.y - vent.cell.y });
    }

    this.hurtEnemies(vent.cell, STEAM_RADIUS, vent.enemyHurt, STEAM_ENEMY_COOLDOWN_MS, STEAM_DAMAGE, now);
  }

  private updateShock(shock: Shock, now: number, at: { x: number; y: number }, alive: boolean): void {
    const state = phaseAt(now, shock.phaseMs, SHOCK_CYCLE_MS, SHOCK_IDLE_MS, SHOCK_WARN_MS);
    const world = gridVectorToWorld(shock.cell.x, shock.cell.y, TILE_WIDTH, TILE_HEIGHT);
    const gain = distanceGain(shock.cell.x, shock.cell.y, at.x, at.y);
    const distance = Math.hypot(at.x - shock.cell.x, at.y - shock.cell.y);

    if (state !== shock.state) {
      if (state === 'warn') sfx.play('shockHum', gain * 0.7);
      if (state === 'active') sfx.play('shock', gain);
      shock.state = state;
    }

    if (state === 'idle' && distance <= HAZARD_SENSE_TILES && now >= shock.nextTickAt) {
      shock.nextTickAt = now + HAZARD_IDLE_TICK_MS;
      sfx.play('hazardTick', gain * 0.5);
    }

    const left = { x: world.x - ELECTRODE_SPREAD_PX, y: world.y - ELECTRODE_LIFT_PX };
    const right = { x: world.x + ELECTRODE_SPREAD_PX, y: world.y - ELECTRODE_LIFT_PX };
    shock.arcs.clear();
    if (state === 'idle') {
      if (now >= shock.nextSparkAt) shock.nextSparkAt = now + 500 + Math.random() * 900;
      if (shock.nextSparkAt - now > 380) {
        shock.ring.setAlpha(0.35 + Math.sin(now / 300) * 0.1);
      } else {
        jaggedArc(shock.arcs, left, right, 1, 0x59d8ff, 0.5);
        shock.ring.setAlpha(0.6);
      }
    } else if (state === 'warn') {
      const on = Math.floor(now / 70) % 2 === 0;
      shock.ring.setAlpha(on ? 0.95 : 0.3);
      if (on) jaggedArc(shock.arcs, left, right, 1, 0x9fe8ff, 0.7);
    } else {
      shock.ring.setAlpha(1);
      jaggedArc(shock.arcs, left, right, 3, 0x59d8ff, 0.9);
      jaggedArc(shock.arcs, left, right, 1.5, 0xffffff, 1);
      jaggedArc(shock.arcs, { x: world.x, y: world.y - 3 }, { x: world.x + (Math.random() - 0.5) * 40, y: world.y - 12 }, 1.5, 0xbff2ff, 0.9);
    }
    shock.frame.setAlpha(state === 'idle' ? FRAME_ALPHA : 0.6 + 0.4 * Math.abs(Math.sin(now / 90)));
    this.updateBeacon(shock.beacon, distance, state, now);

    if (state !== 'active') return;
    if (alive && distance <= SHOCK_RADIUS) {
      this.player.takeDamage(SHOCK_DAMAGE, now, { x: at.x - shock.cell.x, y: at.y - shock.cell.y });
    }
    this.hurtEnemies(shock.cell, SHOCK_RADIUS, shock.enemyHurt, SHOCK_ENEMY_COOLDOWN_MS, SHOCK_DAMAGE, now);
  }

  private hurtEnemies(
    cell: Cell,
    radius: number,
    hurt: Map<Drone, number>,
    cooldownMs: number,
    damage: number,
    now: number,
  ): void {
    for (const enemy of this.getEnemies()) {
      if (enemy.isDead || ENEMY_SPECS[enemy.kind].boss) continue;
      const position = enemy.gridPosition;
      if (Math.hypot(position.x - cell.x, position.y - cell.y) > radius) continue;
      const last = hurt.get(enemy) ?? -cooldownMs;
      if (now - last < cooldownMs) continue;
      hurt.set(enemy, now);
      enemy.takeDamage(damage);
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
