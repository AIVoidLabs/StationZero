import type { Scene } from 'phaser';
import {
  DRONE_MIN_SPAWN_DISTANCE,
} from '../data/config';
import { ENEMY_SPECS, bossForFloor, droneCountForFloor, tankCountForFloor, type EnemyKind } from '../data/enemies';
import { Drone } from '../entities/enemies/Drone';
import type { Player } from '../entities/Player';
import { createRng } from '../utils/random';
import type { DepthManager } from './DepthManager';
import type { Dungeon, DungeonExit, Room } from './DungeonGen';
import type { Level } from './Level';
import { Projectiles } from './Projectiles';
import { runStats } from './RunStats';

const COMBAT_SEED = 0x0d20e;

interface SpawnCandidate {
  readonly room: Room;
  readonly centerX: number;
  readonly centerY: number;
  readonly distance: number;
}

function roomCenter(room: Room): { readonly x: number; readonly y: number } {
  return {
    x: room.x + Math.floor(room.width / 2),
    y: room.y + Math.floor(room.height / 2),
  };
}

function findSpawn(
  level: Level,
  room: Room,
  centerX: number,
  centerY: number,
  exit: DungeonExit | null,
  taken: ReadonlySet<string>,
): { readonly x: number; readonly y: number } | null {
  let best: { readonly x: number; readonly y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      if (!level.isWalkable(x, y)) continue;
      if (exit !== null && x === exit.x && y === exit.y) continue;
      if (taken.has(`${x},${y}`)) continue;
      const distance = (x - centerX) ** 2 + (y - centerY) ** 2;
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      best = { x, y };
    }
  }

  return best;
}

export class Combat {
  private readonly drones: Drone[] = [];
  private readonly scene: Scene;
  private readonly player: Player;
  private readonly onDroneKilled: ((drone: Drone) => void) | undefined;
  private readonly reportedDeaths = new Set<Drone>();
  private readonly projectiles: Projectiles;
  private readonly level: Level;
  private readonly depth: DepthManager;
  private readonly summoned = new Set<Drone>();
  private summonSeed = 0;

  constructor(
    scene: Scene,
    level: Level,
    dungeon: Dungeon,
    player: Player,
    depth: DepthManager,
    onDroneKilled?: (drone: Drone) => void,
  ) {
    this.scene = scene;
    this.level = level;
    this.depth = depth;
    this.player = player;
    this.onDroneKilled = onDroneKilled;
    this.projectiles = new Projectiles(scene, level, player, () => this.drones);
    const rng = createRng(dungeon.seed ^ COMBAT_SEED);

    const candidates: SpawnCandidate[] = dungeon.rooms
      .map((room) => {
        const center = roomCenter(room);
        return {
          room,
          centerX: center.x,
          centerY: center.y,
          distance: Math.abs(center.x - level.spawnX) + Math.abs(center.y - level.spawnY),
        };
      })
      .sort((a, b) => b.distance - a.distance);

    const distant = candidates.filter((candidate) => candidate.distance >= DRONE_MIN_SPAWN_DISTANCE);
    const pool = distant.length > 0 ? distant : candidates;
    const droneCount = droneCountForFloor(dungeon.floor);

    const taken = new Set<string>();
    const boss = bossForFloor(dungeon.floor);
    const kinds: EnemyKind[] = [
      ...(boss ? [boss] : []),
      ...Array.from({ length: droneCount }, (): EnemyKind => 'drone'),
      ...Array.from({ length: tankCountForFloor(dungeon.floor) }, (): EnemyKind => 'tank'),
    ];

    for (const [index, kind] of kinds.entries()) {
      if (pool.length === 0) break;
      const candidate = pool[index % pool.length];
      if (!candidate) continue;

      const spawn = findSpawn(
        level,
        candidate.room,
        candidate.centerX,
        candidate.centerY,
        dungeon.exit,
        taken,
      );
      if (!spawn) continue;
      taken.add(`${spawn.x},${spawn.y}`);

      this.drones.push(
        new Drone(
          scene,
          level,
          player,
          depth,
          spawn.x,
          spawn.y,
          Math.floor(rng() * 0xffffff),
          this.projectiles,
          kind,
        ),
      );
    }
  }

  get roster(): readonly Drone[] {
    return this.drones;
  }

  get projectileSystem(): Projectiles {
    return this.projectiles;
  }

  update(deltaMs: number): void {
    this.projectiles.update(deltaMs, this.scene.time.now);
    for (const drone of this.drones) {
      if (drone.isDead) {
        this.reportDeath(drone);
        continue;
      }
      drone.update(deltaMs);
      if (drone.isDead) {
        this.reportDeath(drone);
        continue;
      }
      if (drone.summonReady) {
        drone.consumeSummon();
        this.summonFor(drone);
      }
      const p = this.player.gridPosition;
      const d = drone.gridPosition;
      const dist = Math.hypot(d.x - p.x, d.y - p.y);
      if (dist <= drone.contactReach && drone.canDealContactDamage(this.scene.time.now)) {
        this.player.takeDamage(drone.contactDamage, this.scene.time.now, { x: p.x - d.x, y: p.y - d.y });
      }
    }
  }

  private summonFor(boss: Drone): void {
    const cap = ENEMY_SPECS[boss.kind].summonCap;
    for (const unit of this.summoned) if (unit.isDead) this.summoned.delete(unit);
    if (this.summoned.size >= cap) return;

    const origin = boss.gridPosition;
    const ox = Math.round(origin.x);
    const oy = Math.round(origin.y);
    for (let radius = 2; radius <= 4; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = ox + dx;
          const y = oy + dy;
          if (!this.level.isWalkable(x, y)) continue;
          if (this.drones.some((other) => !other.isDead && Math.hypot(other.gridPosition.x - x, other.gridPosition.y - y) < 1)) continue;
          this.summonSeed += 1;
          const unit = new Drone(
            this.scene,
            this.level,
            this.player,
            this.depth,
            x,
            y,
            0x9e3779b9 ^ this.summonSeed,
            this.projectiles,
            'drone',
          );
          this.drones.push(unit);
          this.summoned.add(unit);
          return;
        }
      }
    }
  }

  private reportDeath(drone: Drone): void {
    if (this.reportedDeaths.has(drone)) return;
    this.reportedDeaths.add(drone);
    if (this.summoned.has(drone)) return;
    runStats.kills += 1;
    this.onDroneKilled?.(drone);
    if (ENEMY_SPECS[drone.kind].boss) {
      for (const unit of this.summoned) unit.takeDamage(Number.MAX_SAFE_INTEGER);
    }
  }

  destroy(): void {
    this.projectiles.destroy();
    for (const drone of this.drones) drone.destroy();
    this.drones.length = 0;
    this.reportedDeaths.clear();
    this.summoned.clear();
  }
}
