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
const ENEMY_SPACING = 2.5;

function roomCenter(room: Room): { readonly x: number; readonly y: number } {
  return {
    x: room.x + Math.floor(room.width / 2),
    y: room.y + Math.floor(room.height / 2),
  };
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

    const spawnCell = { x: Math.round(level.spawnX), y: Math.round(level.spawnY) };
    const inRoom = (room: Room, cell: { x: number; y: number }): boolean =>
      cell.x >= room.x && cell.x < room.x + room.width && cell.y >= room.y && cell.y < room.y + room.height;
    const ranked = dungeon.rooms
      .filter((room) => !inRoom(room, spawnCell))
      .map((room) => {
        const center = roomCenter(room);
        return {
          room,
          area: room.width * room.height,
          distance: Math.abs(center.x - spawnCell.x) + Math.abs(center.y - spawnCell.y),
        };
      })
      .sort((a, b) => b.distance - a.distance);
    const rooms = ranked.length > 0 ? ranked : dungeon.rooms.map((room) => ({ room, area: room.width * room.height, distance: 0 }));
    const bySize = [...rooms].sort((a, b) => b.area - a.area);

    const plan: { room: Room; kind: EnemyKind }[] = [];
    const bossKind = bossForFloor(dungeon.floor);
    const bossRoom = bossKind ? rooms[0]?.room : undefined;
    if (bossKind && bossRoom) plan.push({ room: bossRoom, kind: bossKind });

    const droneTotal = droneCountForFloor(dungeon.floor);
    const droneCounts = new Map<Room, number>();
    for (const entry of rooms.slice(0, droneTotal)) droneCounts.set(entry.room, 1);
    for (let extra = droneTotal - droneCounts.size, index = 0; extra > 0 && bySize.length > 0; extra -= 1, index += 1) {
      const entry = bySize[index % bySize.length];
      if (entry) droneCounts.set(entry.room, (droneCounts.get(entry.room) ?? 0) + 1);
    }
    for (const [room, count] of droneCounts) {
      for (let index = 0; index < count; index += 1) plan.push({ room, kind: 'drone' });
    }

    const tankRooms = bySize.filter((entry) => entry.room !== bossRoom).slice(0, tankCountForFloor(dungeon.floor));
    for (const entry of tankRooms) plan.push({ room: entry.room, kind: 'tank' });

    const taken = new Set<string>();
    const placed: { x: number; y: number }[] = [];
    for (const { room, kind } of plan) {
      const spawn = this.pickSpawn(room, dungeon.exit, taken, placed, spawnCell, rng);
      if (!spawn) continue;
      taken.add(`${spawn.x},${spawn.y}`);
      placed.push(spawn);

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

  private pickSpawn(
    room: Room,
    exit: DungeonExit | null,
    taken: ReadonlySet<string>,
    placed: readonly { x: number; y: number }[],
    start: { x: number; y: number },
    rng: () => number,
  ): { readonly x: number; readonly y: number } | null {
    const spread: { x: number; y: number }[] = [];
    const loose: { x: number; y: number }[] = [];
    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        if (!this.level.isWalkable(x, y)) continue;
        if (exit !== null && x === exit.x && y === exit.y) continue;
        if (taken.has(`${x},${y}`)) continue;
        loose.push({ x, y });
        const farFromStart = Math.hypot(x - start.x, y - start.y) >= DRONE_MIN_SPAWN_DISTANCE;
        const apart = placed.every((other) => Math.hypot(other.x - x, other.y - y) >= ENEMY_SPACING);
        if (farFromStart && apart) spread.push({ x, y });
      }
    }
    const pool = spread.length > 0 ? spread : loose;
    return pool[Math.floor(rng() * pool.length)] ?? null;
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
