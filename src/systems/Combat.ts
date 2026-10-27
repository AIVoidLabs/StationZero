import type { Scene } from 'phaser';
import {
  DRONE_COUNT,
  DRONE_DAMAGE,
  DRONE_EXTRA_FROM_FLOOR,
  DRONE_MIN_SPAWN_DISTANCE,
} from '../data/config';
import { Drone } from '../entities/enemies/Drone';
import type { Player } from '../entities/Player';
import { createRng } from '../utils/random';
import type { DepthManager } from './DepthManager';
import type { Dungeon, DungeonExit, Room } from './DungeonGen';
import type { Level } from './Level';

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
): { readonly x: number; readonly y: number } | null {
  let best: { readonly x: number; readonly y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      if (!level.isWalkable(x, y)) continue;
      if (exit !== null && x === exit.x && y === exit.y) continue;
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

  constructor(
    scene: Scene,
    level: Level,
    dungeon: Dungeon,
    player: Player,
    depth: DepthManager,
    onDroneKilled?: (drone: Drone) => void,
  ) {
    this.scene = scene;
    this.player = player;
    this.onDroneKilled = onDroneKilled;
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
    const droneCount = DRONE_COUNT + (dungeon.floor >= DRONE_EXTRA_FROM_FLOOR ? 1 : 0);

    for (let index = 0; index < droneCount && index < pool.length; index += 1) {
      const candidate = pool[index];
      if (!candidate) continue;

      const spawn = findSpawn(
        level,
        candidate.room,
        candidate.centerX,
        candidate.centerY,
        dungeon.exit,
      );
      if (!spawn) continue;

      this.drones.push(
        new Drone(scene, level, player, depth, spawn.x, spawn.y, Math.floor(rng() * 0xffffff)),
      );
    }
  }

  get roster(): readonly Drone[] {
    return this.drones;
  }

  update(deltaMs: number): void {
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
      const p = this.player.gridPosition;
      const d = drone.gridPosition;
      const dist = Math.hypot(d.x - p.x, d.y - p.y);
      if (dist <= 1.25 && drone.canDealContactDamage(this.scene.time.now)) {
        this.player.takeDamage(DRONE_DAMAGE, this.scene.time.now);
      }
    }
  }

  private reportDeath(drone: Drone): void {
    if (this.reportedDeaths.has(drone)) return;
    this.reportedDeaths.add(drone);
    this.onDroneKilled?.(drone);
  }

  destroy(): void {
    for (const drone of this.drones) drone.destroy();
    this.drones.length = 0;
    this.reportedDeaths.clear();
  }
}
