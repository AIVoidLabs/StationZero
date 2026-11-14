import { BlendModes, Scene } from 'phaser';
import type { Player } from '../entities/Player';
import type { Drone } from '../entities/enemies/Drone';
import type { Level } from './Level';
import type { Projectiles } from './Projectiles';
import { sfx } from './Sfx';
import { hasLineOfSight } from './Los';
import {
  DEPTH_VFX,
  DRONE_HEIGHT,
  MELEE_ARC_DEGREES,
  MELEE_COOLDOWN_MS,
  MELEE_DAMAGE,
  MELEE_RANGE,
  PISTOL_COOLDOWN_MS,
  PISTOL_RANGE,
  PLAYER_HEIGHT,
} from '../data/config';
import { facingToVector } from '../utils/facing';

function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  const dot = ax * bx + ay * by;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA < 1e-6 || magB < 1e-6) return Math.PI;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cos);
}

export class PlayerCombat {
  private readonly scene: Scene;
  private readonly player: Player;
  private readonly level: Level;
  private readonly getDrones: () => readonly Drone[];
  private readonly projectiles: Projectiles;

  constructor(
    scene: Scene,
    player: Player,
    level: Level,
    getDrones: () => readonly Drone[],
    projectiles: Projectiles,
  ) {
    this.scene = scene;
    this.player = player;
    this.level = level;
    this.getDrones = getDrones;
    this.projectiles = projectiles;
  }

  tryAttack(timeNow: number, preferred?: Drone): boolean {
    if (this.player.isDeadState) return false;
    if (this.player.weapon === 'PISTOL') {
      return this.tryPistol(timeNow, preferred);
    }
    return this.tryMelee(timeNow, preferred);
  }

  tryRightClickPistol(timeNow: number, preferred?: Drone): boolean {
    if (this.player.isDeadState) return false;
    if (!this.player.canRightClickPistol(timeNow)) return false;
    return this.tryPistol(timeNow, preferred);
  }

  canAttackTarget(target: Drone): boolean {
    if (this.player.isDeadState) return false;
    if (this.player.weapon === 'PISTOL') {
      return this.pickPistolTarget(target) === target;
    }
    return this.pickMeleeTarget(target) === target;
  }

  private tryPistol(timeNow: number, preferred?: Drone): boolean {
    if (!this.player.canAttack(timeNow)) return false;
    if (this.player.ammoCount <= 0) return this.tryMelee(timeNow, preferred);

    const target = this.pickPistolTarget(preferred);
    if (!target) return false;
    if (!this.player.consumeAmmo()) return this.tryMelee(timeNow, preferred);

    this.aimAt(target, true);
    const from = this.player.gridPosition;
    const to = target.gridPosition;
    this.projectiles.spawn('player', from.x, from.y, to.x - from.x, to.y - from.y);
    sfx.play('pistol');
    this.playPistolFx(target);
    this.player.startAttackCooldown(timeNow, PISTOL_COOLDOWN_MS);
    return true;
  }

  private tryMelee(timeNow: number, preferred?: Drone): boolean {
    if (!this.player.canAttack(timeNow)) return false;

    const target = this.pickMeleeTarget(preferred);
    if (!target) return false;

    this.aimAt(target);
    sfx.play('melee');
    this.player.startAttackCooldown(timeNow, MELEE_COOLDOWN_MS);
    const from = this.player.gridPosition;
    const to = target.gridPosition;
    target.takeDamage(MELEE_DAMAGE, { x: to.x - from.x, y: to.y - from.y });
    this.spawnImpact(target.x, target.y - DRONE_HEIGHT * 0.45);
    return true;
  }

  private aimAt(target: Drone, fired = false): void {
    const from = this.player.gridPosition;
    const to = target.gridPosition;
    this.player.aimToward(to.x - from.x, to.y - from.y, fired);
  }

  private playPistolFx(drone: Drone): void {
    const originX = this.player.x;
    const originY = this.player.y - PLAYER_HEIGHT * 0.55;
    const targetX = drone.x;
    const targetY = drone.y - DRONE_HEIGHT * 0.45;
    const dx = targetX - originX;
    const dy = targetY - originY;
    const length = Math.hypot(dx, dy);
    if (length < 1e-3) return;

    const muzzleX = originX + (dx / length) * 10;
    const muzzleY = originY + (dy / length) * 10;

    const flash = this.scene.add
      .circle(muzzleX, muzzleY, 3.6, 0xfff4d2, 0.95)
      .setDepth(DEPTH_VFX)
      .setBlendMode(BlendModes.ADD);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2.6,
      scaleY: 2.6,
      duration: 100,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  private spawnImpact(x: number, y: number): void {
    const spark = this.scene.add
      .circle(x, y, 3, 0xffb060, 0.95)
      .setDepth(DEPTH_VFX + 1)
      .setBlendMode(BlendModes.ADD);
    this.scene.tweens.add({
      targets: spark,
      alpha: 0,
      scaleX: 2.2,
      scaleY: 2.2,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  private pickPistolTarget(preferred?: Drone): Drone | null {
    const grid = this.player.gridPosition;
    const origin = { gridX: Math.round(grid.x), gridY: Math.round(grid.y) };

    const inRange = (drone: Drone): number | null => {
      if (drone.isDead) return null;
      const dgrid = drone.gridPosition;
      const distance = Math.hypot(dgrid.x - grid.x, dgrid.y - grid.y);
      if (distance > PISTOL_RANGE) return null;
      const cell = { gridX: Math.round(dgrid.x), gridY: Math.round(dgrid.y) };
      if (!hasLineOfSight(this.level, origin, cell)) return null;
      return distance;
    };

    if (preferred && inRange(preferred) !== null) {
      return preferred;
    }

    let best: Drone | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const drone of this.getDrones()) {
      const distance = inRange(drone);
      if (distance === null || distance >= bestDistance) continue;
      bestDistance = distance;
      best = drone;
    }
    return best;
  }

  private pickMeleeTarget(preferred?: Drone): Drone | null {
    const grid = this.player.gridPosition;
    const origin = { gridX: Math.round(grid.x), gridY: Math.round(grid.y) };
    const facing = facingToVector(this.player.facingDirection);
    const halfArc = (MELEE_ARC_DEGREES * Math.PI) / 360;

    const inRange = (drone: Drone, requireArc: boolean): number | null => {
      if (drone.isDead) return null;
      const dgrid = drone.gridPosition;
      const dx = dgrid.x - grid.x;
      const dy = dgrid.y - grid.y;
      const distance = Math.hypot(dx, dy);
      if (distance > MELEE_RANGE) return null;
      if (distance > 1e-4 && requireArc) {
        const angle = angleBetween(facing.x, facing.y, dx / distance, dy / distance);
        if (angle > halfArc) return null;
      }
      const cell = { gridX: Math.round(dgrid.x), gridY: Math.round(dgrid.y) };
      if (!hasLineOfSight(this.level, origin, cell)) return null;
      return distance;
    };

    if (preferred && inRange(preferred, false) !== null) {
      return preferred;
    }

    let best: Drone | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const drone of this.getDrones()) {
      const distance = inRange(drone, true);
      if (distance === null || distance >= bestDistance) continue;
      bestDistance = distance;
      best = drone;
    }
    return best;
  }
}
