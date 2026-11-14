import type { Scene } from 'phaser';
import { ENEMY_SPECS } from '../data/enemies';
import { Drone } from '../entities/enemies/Drone';
import type { Player } from '../entities/Player';
import type { DepthManager } from './DepthManager';
import type { Dungeon } from './DungeonGen';
import type { Level } from './Level';
import { Projectiles } from './Projectiles';
import { runStats } from './RunStats';

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

    for (const spawn of dungeon.entities.enemies) {
      const unit = new Drone(
        scene,
        level,
        player,
        depth,
        spawn.x,
        spawn.y,
        spawn.seed,
        this.projectiles,
        spawn.kind,
      );
      if (spawn.kind === 'warden') unit.sleep();
      this.drones.push(unit);
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
