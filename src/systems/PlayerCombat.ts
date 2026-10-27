import { Scene } from 'phaser';
import type { Player } from '../entities/Player';
import type { Drone } from '../entities/enemies/Drone';
import type { Level } from './Level';
import { hasLineOfSight } from './Los';
import { MELEE_ARC_DEGREES, MELEE_DAMAGE, MELEE_RANGE } from '../data/config';
import { facingToVector } from '../utils/facing';
import type { Direction } from '../assets/manifest';

function angleBetween(ax: number, ay: number, bx: number, by: number): number {
  const dot = ax * bx + ay * by;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA < 1e-6 || magB < 1e-6) return Math.PI;
  const cos = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cos);
}

export class PlayerCombat {
  private readonly player: Player;
  private readonly level: Level;
  private readonly getDrones: () => readonly Drone[];

  constructor(_scene: Scene, player: Player, level: Level, getDrones: () => readonly Drone[]) {
    this.player = player;
    this.level = level;
    this.getDrones = getDrones;
  }

  tryAttack(timeNow: number): boolean {
    if (!this.player.canAttack(timeNow)) return false;
    const grid = this.player.gridPosition;
    const facing = (this.player.facingDirection as Direction);
    const dir = facingToVector(facing);
    const forwardX = dir.x;
    const forwardY = dir.y;
    const halfArc = (MELEE_ARC_DEGREES * Math.PI) / 360;

    const drones = this.getDrones();
    for (const drone of drones) {
      if (drone.isDead) continue;
      const dgrid = drone.gridPosition;
      const dx = dgrid.x - grid.x;
      const dy = dgrid.y - grid.y;
      const dist = Math.hypot(dx, dy);
      if (dist > MELEE_RANGE) continue;
      if (dist < 1.2) {
        // very close - allow hit even if slightly off angle
        const from = { gridX: Math.round(grid.x), gridY: Math.round(grid.y) };
        const to = { gridX: Math.round(dgrid.x), gridY: Math.round(dgrid.y) };
        if (!hasLineOfSight(this.level, from, to)) continue;
        drone.takeDamage(MELEE_DAMAGE);
        this.player.startAttackCooldown(timeNow);
        return true;
      }
      if (dist < 1e-4) {
        drone.takeDamage(MELEE_DAMAGE);
        this.player.startAttackCooldown(timeNow);
        return true;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const ang = angleBetween(forwardX, forwardY, nx, ny);
      if (ang > halfArc) continue;
      const from = { gridX: Math.round(grid.x), gridY: Math.round(grid.y) };
      const to = { gridX: Math.round(dgrid.x), gridY: Math.round(dgrid.y) };
      if (!hasLineOfSight(this.level, from, to)) continue;
      drone.takeDamage(MELEE_DAMAGE);
      this.player.startAttackCooldown(timeNow);
      return true;
    }

    this.player.startAttackCooldown(timeNow);
    return false;
  }
}
