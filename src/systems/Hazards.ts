import { BlendModes, type GameObjects, type Scene } from 'phaser';
import { DEPTH_FLOOR, DEPTH_VFX, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import {
  HAZARD_LOOT_CLEARANCE,
  HAZARD_MIN_SEPARATION,
  HAZARD_SPAWN_CLEARANCE,
  LASER_ALERT,
  LASER_CYCLE_MS,
  LASER_DAMAGE,
  LASER_HALF_WIDTH,
  LASER_IDLE_MS,
  LASER_WARN_MS,
  STEAM_CYCLE_MS,
  STEAM_DAMAGE,
  STEAM_ENEMY_COOLDOWN_MS,
  STEAM_IDLE_MS,
  STEAM_RADIUS,
  STEAM_WARN_MS,
  laserCount,
  steamCount,
} from '../data/hazards';
import { ENEMY_SPECS } from '../data/enemies';
import type { Drone } from '../entities/enemies/Drone';
import type { Player } from '../entities/Player';
import { gridVectorToWorld } from '../utils/iso';
import { createRng } from '../utils/random';
import type { Dungeon } from './DungeonGen';
import type { Level } from './Level';
import type { LightSource } from './LightMap';
import { runFlags } from './RunFlags';
import { distanceGain, sfx } from './Sfx';

const HAZARD_SEED = 0x7a5e;
const EXIT_CLEARANCE = 2.5;
const STEAM_CORRIDOR_SHARE = 0.6;
const PUFF_INTERVAL_MS = 110;
const BEAM_HEIGHT_PX = 16;
const SPAWN_CLEARANCE_SQ = HAZARD_SPAWN_CLEARANCE * HAZARD_SPAWN_CLEARANCE;

type Phase = 'idle' | 'warn' | 'active';
type Axis = 'x' | 'y';

interface Cell {
  readonly x: number;
  readonly y: number;
}

interface CorridorCell extends Cell {
  readonly axis: Axis;
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

interface Gate {
  readonly cell: Cell;
  readonly axis: Axis;
  readonly phaseMs: number;
  readonly beam: GameObjects.Line;
  readonly posts: readonly GameObjects.Arc[];
  state: Phase;
  alerted: boolean;
}

function phaseAt(time: number, offset: number, cycle: number, idle: number, warn: number): Phase {
  const at = (time + offset) % cycle;
  if (at < idle) return 'idle';
  return at < idle + warn ? 'warn' : 'active';
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    const held = items[index];
    const other = items[swap];
    if (held === undefined || other === undefined) continue;
    items[index] = other;
    items[swap] = held;
  }
  return items;
}

export class Hazards {
  private readonly scene: Scene;
  private readonly player: Player;
  private readonly getEnemies: () => readonly Drone[];
  private readonly vents: Vent[] = [];
  private readonly gates: Gate[] = [];

  constructor(
    scene: Scene,
    level: Level,
    dungeon: Dungeon,
    player: Player,
    getEnemies: () => readonly Drone[],
    avoid: readonly Cell[],
  ) {
    this.scene = scene;
    this.player = player;
    this.getEnemies = getEnemies;

    const rng = createRng(dungeon.seed ^ HAZARD_SEED);
    const { corridor, open } = this.collectCandidates(level, dungeon, avoid);
    shuffle(corridor, rng);
    shuffle(open, rng);

    const placed: Cell[] = [];
    const lasers = this.take(corridor, laserCount(dungeon.floor), placed);
    const steamTotal = steamCount(dungeon.floor);
    const steamCorridor = Math.ceil(steamTotal * STEAM_CORRIDOR_SHARE);
    const steam = [
      ...this.take(corridor, steamCorridor, placed),
      ...this.take(open, steamTotal - steamCorridor, placed),
    ];
    if (steam.length < steamTotal) steam.push(...this.take(corridor, steamTotal - steam.length, placed));

    for (const cell of lasers) this.gates.push(this.buildGate(cell, rng));
    for (const cell of steam) this.vents.push(this.buildVent(cell, rng));
  }

  get ventCells(): readonly Cell[] {
    return this.vents.map((vent) => vent.cell);
  }

  get gateCells(): readonly Cell[] {
    return this.gates.map((gate) => gate.cell);
  }

  update(): void {
    const now = this.scene.time.now;
    const at = this.player.gridPosition;
    const alive = !this.player.isDeadState;

    for (const vent of this.vents) this.updateVent(vent, now, at, alive);
    for (const gate of this.gates) this.updateGate(gate, now, at, alive);
  }

  emitLights(emit: (light: LightSource) => void): void {
    for (const vent of this.vents) {
      if (vent.state === 'idle') continue;
      const world = gridVectorToWorld(vent.cell.x, vent.cell.y, TILE_WIDTH, TILE_HEIGHT);
      emit({ x: world.x, y: world.y - 6, radius: vent.state === 'active' ? 70 : 40, intensity: 0.45, tint: 'ember' });
    }
    for (const gate of this.gates) {
      if (gate.state === 'idle') continue;
      const world = gridVectorToWorld(gate.cell.x, gate.cell.y, TILE_WIDTH, TILE_HEIGHT);
      emit({
        x: world.x,
        y: world.y - BEAM_HEIGHT_PX,
        radius: gate.state === 'active' ? 90 : 45,
        intensity: gate.state === 'active' ? 0.8 : 0.3,
        tint: 'red',
      });
    }
  }

  destroy(): void {
    for (const vent of this.vents) {
      vent.grate.destroy();
      vent.glow.destroy();
    }
    for (const gate of this.gates) {
      gate.beam.destroy();
      for (const post of gate.posts) post.destroy();
    }
    this.vents.length = 0;
    this.gates.length = 0;
  }

  private collectCandidates(
    level: Level,
    dungeon: Dungeon,
    avoid: readonly Cell[],
  ): { corridor: CorridorCell[]; open: Cell[] } {
    const corridor: CorridorCell[] = [];
    const open: Cell[] = [];
    const inRoom = new Set<string>();
    for (const room of dungeon.rooms) {
      for (let y = room.y; y < room.y + room.height; y += 1) {
        for (let x = room.x; x < room.x + room.width; x += 1) inRoom.add(`${x},${y}`);
      }
    }

    const walkable = (x: number, y: number): boolean => level.isWalkable(x, y);
    for (let y = 0; y < dungeon.height; y += 1) {
      for (let x = 0; x < dungeon.width; x += 1) {
        if (!walkable(x, y)) continue;
        const dx = x - level.spawnX;
        const dy = y - level.spawnY;
        if (dx * dx + dy * dy < SPAWN_CLEARANCE_SQ) continue;
        if (dungeon.exit && Math.hypot(x - dungeon.exit.x, y - dungeon.exit.y) < EXIT_CLEARANCE) continue;
        if (avoid.some((cell) => Math.hypot(cell.x - x, cell.y - y) < HAZARD_LOOT_CLEARANCE)) continue;

        const north = walkable(x, y - 1);
        const south = walkable(x, y + 1);
        const west = walkable(x - 1, y);
        const east = walkable(x + 1, y);
        if (west && east && !north && !south) corridor.push({ x, y, axis: 'x' });
        else if (north && south && !west && !east) corridor.push({ x, y, axis: 'y' });
        else if (north && south && west && east && inRoom.has(`${x},${y}`)) open.push({ x, y });
      }
    }
    return { corridor, open };
  }

  private take<T extends Cell>(list: T[], count: number, placed: Cell[]): T[] {
    const picked: T[] = [];
    for (const candidate of list) {
      if (picked.length >= count) break;
      if (placed.some((cell) => Math.hypot(cell.x - candidate.x, cell.y - candidate.y) < HAZARD_MIN_SEPARATION)) continue;
      picked.push(candidate);
      placed.push(candidate);
    }
    return picked;
  }

  private buildVent(cell: Cell, rng: () => number): Vent {
    const world = gridVectorToWorld(cell.x, cell.y, TILE_WIDTH, TILE_HEIGHT);
    const grate = this.scene.add.ellipse(world.x, world.y, 26, 13, 0x1c1f1f, 0.95).setDepth(DEPTH_FLOOR + 2);
    const glow = this.scene.add
      .ellipse(world.x, world.y, 20, 10, 0xff8a3a, 0)
      .setDepth(DEPTH_FLOOR + 3)
      .setBlendMode(BlendModes.ADD);
    return {
      cell,
      phaseMs: Math.floor(rng() * STEAM_CYCLE_MS),
      grate,
      glow,
      enemyHurt: new Map(),
      state: 'idle',
      nextPuffAt: 0,
    };
  }

  private buildGate(cell: CorridorCell, rng: () => number): Gate {
    const half = 0.5;
    const from = cell.axis === 'x' ? { x: cell.x, y: cell.y - half } : { x: cell.x - half, y: cell.y };
    const to = cell.axis === 'x' ? { x: cell.x, y: cell.y + half } : { x: cell.x + half, y: cell.y };
    const a = gridVectorToWorld(from.x, from.y, TILE_WIDTH, TILE_HEIGHT);
    const b = gridVectorToWorld(to.x, to.y, TILE_WIDTH, TILE_HEIGHT);
    const beam = this.scene.add
      .line(0, 0, a.x, a.y - BEAM_HEIGHT_PX, b.x, b.y - BEAM_HEIGHT_PX, 0xff3322, 0)
      .setOrigin(0, 0)
      .setLineWidth(3)
      .setDepth(DEPTH_VFX - 10)
      .setBlendMode(BlendModes.ADD);
    const posts = [a, b].map((point) =>
      this.scene.add.circle(point.x, point.y - BEAM_HEIGHT_PX, 3, 0x6a1a14, 1).setDepth(DEPTH_VFX - 11),
    );
    return {
      cell,
      axis: cell.axis,
      phaseMs: Math.floor(rng() * LASER_CYCLE_MS),
      beam,
      posts,
      state: 'idle',
      alerted: false,
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

  private updateGate(gate: Gate, now: number, at: { x: number; y: number }, alive: boolean): void {
    const state = phaseAt(now, gate.phaseMs, LASER_CYCLE_MS, LASER_IDLE_MS, LASER_WARN_MS);
    const gain = distanceGain(gate.cell.x, gate.cell.y, at.x, at.y);

    if (state !== gate.state) {
      if (state === 'warn') sfx.play('laser', gain * 0.4);
      if (state === 'active') {
        sfx.play('laser', gain);
        gate.alerted = false;
      }
      gate.state = state;
    }

    if (state === 'active') gate.beam.setAlpha(1);
    else if (state === 'warn') gate.beam.setAlpha(Math.floor(now / 60) % 2 === 0 ? 0.35 : 0);
    else gate.beam.setAlpha(0);

    if (state !== 'active' || !alive) return;
    const along = gate.axis === 'x' ? at.x - gate.cell.x : at.y - gate.cell.y;
    const across = gate.axis === 'x' ? at.y - gate.cell.y : at.x - gate.cell.x;
    if (Math.abs(along) > LASER_HALF_WIDTH || Math.abs(across) > 0.6) return;

    const hit = this.player.takeDamage(LASER_DAMAGE, now, { x: at.x - gate.cell.x, y: at.y - gate.cell.y });
    if (hit && !gate.alerted) {
      gate.alerted = true;
      runFlags.addAlert(LASER_ALERT);
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
