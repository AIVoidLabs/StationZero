import { BlendModes, type GameObjects, type Scene } from 'phaser';
import {
  BULLET_HEIGHT_PX,
  DEPTH_VFX,
  DRONE_BULLET_DAMAGE,
  DRONE_BULLET_HIT_RADIUS,
  DRONE_BULLET_LENGTH,
  DRONE_BULLET_RANGE,
  DRONE_BULLET_SPEED,
  PISTOL_DAMAGE,
  PLAYER_BULLET_HIT_RADIUS,
  PLAYER_BULLET_LENGTH,
  PLAYER_BULLET_RANGE,
  PLAYER_BULLET_SPEED,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../data/config';
import type { Drone } from '../entities/enemies/Drone';
import type { Player } from '../entities/Player';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import { gridVectorToWorld } from '../utils/iso';
import type { Level } from './Level';

export type ProjectileOwner = 'player' | 'drone' | 'shell';

export interface ProjectileView {
  readonly owner: ProjectileOwner;
  readonly x: number;
  readonly y: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly speed: number;
}

export interface Flare {
  readonly x: number;
  readonly y: number;
  readonly owner: ProjectileOwner;
  readonly radius: number;
  readonly age: number;
  readonly duration: number;
}

interface Projectile extends ProjectileView {
  x: number;
  y: number;
  readonly damage: number;
  readonly hitRadius: number;
  remaining: number;
  readonly image: GameObjects.Image;
}

interface FlareState {
  readonly x: number;
  readonly y: number;
  readonly owner: ProjectileOwner;
  readonly radius: number;
  readonly duration: number;
  age: number;
}

const STREAK_WIDTH = 64;
const STREAK_HEIGHT = 6;
const STREAK_KEYS: Record<ProjectileOwner, string> = {
  player: 'bullet_streak_player',
  drone: 'bullet_streak_drone',
  shell: 'bullet_streak_shell',
};
const STREAK_COLORS: Record<ProjectileOwner, readonly [string, string, string]> = {
  player: ['255, 244, 210', '255, 190, 96', '217, 164, 65'],
  drone: ['255, 236, 224', '255, 48, 30', '140, 18, 10'],
  shell: ['255, 240, 200', '255, 120, 30', '150, 50, 10'],
};
const SPARK_COLORS: Record<ProjectileOwner, number> = { player: 0xffb060, drone: 0xff3a22, shell: 0xff8a2a };

interface ProjectileStats {
  readonly speed: number;
  readonly damage: number;
  readonly hitRadius: number;
  readonly range: number;
  readonly length: number;
}

const PROJECTILE_STATS: Record<ProjectileOwner, ProjectileStats> = {
  player: {
    speed: PLAYER_BULLET_SPEED,
    damage: PISTOL_DAMAGE,
    hitRadius: PLAYER_BULLET_HIT_RADIUS,
    range: PLAYER_BULLET_RANGE,
    length: PLAYER_BULLET_LENGTH,
  },
  drone: {
    speed: DRONE_BULLET_SPEED,
    damage: DRONE_BULLET_DAMAGE,
    hitRadius: DRONE_BULLET_HIT_RADIUS,
    range: DRONE_BULLET_RANGE,
    length: DRONE_BULLET_LENGTH,
  },
  shell: { speed: 5, damage: 1, hitRadius: 0.62, range: 10, length: 34 },
};
const SUBSTEP_TILES = 0.2;
const FLARE_MS = 110;
const FLARE_RADIUS_PX = 70;

function buildStreak(scene: Scene, owner: ProjectileOwner): void {
  const key = STREAK_KEYS[owner];
  if (scene.textures.exists(key)) return;
  const ctx = createCanvasContext(scene, key, STREAK_WIDTH, STREAK_HEIGHT);
  const [hot, warm, cool] = STREAK_COLORS[owner];
  const gradient = ctx.createLinearGradient(0, 0, STREAK_WIDTH, 0);
  gradient.addColorStop(0, `rgba(${cool}, 0)`);
  gradient.addColorStop(0.55, `rgba(${cool}, 0.55)`);
  gradient.addColorStop(0.88, `rgba(${warm}, 0.95)`);
  gradient.addColorStop(1, `rgba(${hot}, 1)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 1, STREAK_WIDTH, STREAK_HEIGHT - 2);
  ctx.fillStyle = `rgba(${hot}, 0.9)`;
  ctx.fillRect(STREAK_WIDTH * 0.7, 2, STREAK_WIDTH * 0.3, STREAK_HEIGHT - 4);
  refreshCanvasTexture(scene, key);
}

export class Projectiles {
  private readonly scene: Scene;
  private readonly level: Level;
  private readonly getDrones: () => readonly Drone[];
  private readonly player: Player;
  private readonly bullets: Projectile[] = [];
  private readonly flareStates: FlareState[] = [];
  private blockedHit: ((gridX: number, gridY: number, owner: ProjectileOwner) => void) | null = null;

  constructor(scene: Scene, level: Level, player: Player, getDrones: () => readonly Drone[]) {
    this.scene = scene;
    this.level = level;
    this.player = player;
    this.getDrones = getDrones;
    buildStreak(scene, 'player');
    buildStreak(scene, 'drone');
    buildStreak(scene, 'shell');
  }

  setBlockedHitHandler(handler: (gridX: number, gridY: number, owner: ProjectileOwner) => void): void {
    this.blockedHit = handler;
  }

  get active(): readonly ProjectileView[] {
    return this.bullets;
  }

  get flares(): readonly Flare[] {
    return this.flareStates;
  }

  spawn(owner: ProjectileOwner, gridX: number, gridY: number, aimX: number, aimY: number): void {
    const length = Math.hypot(aimX, aimY);
    if (length < 1e-4) return;
    const dirX = aimX / length;
    const dirY = aimY / length;
    const fromX = gridX + dirX * 0.35;
    const fromY = gridY + dirY * 0.35;

    const stats = PROJECTILE_STATS[owner];
    const image = this.scene.add
      .image(0, 0, STREAK_KEYS[owner])
      .setOrigin(1, 0.5)
      .setDepth(DEPTH_VFX + 1)
      .setBlendMode(BlendModes.ADD);
    image.setScale(stats.length / STREAK_WIDTH, 1);
    const screen = gridVectorToWorld(dirX, dirY, TILE_WIDTH, TILE_HEIGHT);
    image.setRotation(Math.atan2(screen.y, screen.x));

    const bullet: Projectile = {
      owner,
      x: fromX,
      y: fromY,
      dirX,
      dirY,
      speed: stats.speed,
      damage: stats.damage,
      hitRadius: stats.hitRadius,
      remaining: stats.range,
      image,
    };
    this.placeImage(bullet);
    this.bullets.push(bullet);
    this.addFlare(fromX, fromY, owner);
  }

  update(deltaMs: number, now: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;

    for (let index = this.flareStates.length - 1; index >= 0; index -= 1) {
      const flare = this.flareStates[index];
      if (!flare) continue;
      flare.age += deltaMs;
      if (flare.age >= flare.duration) this.flareStates.splice(index, 1);
    }

    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      if (!bullet) continue;
      if (this.advance(bullet, dt, now)) {
        bullet.image.destroy();
        this.bullets.splice(index, 1);
      } else {
        this.placeImage(bullet);
      }
    }
  }

  destroy(): void {
    for (const bullet of this.bullets) bullet.image.destroy();
    this.bullets.length = 0;
    this.flareStates.length = 0;
  }

  private advance(bullet: Projectile, dt: number, now: number): boolean {
    let travel = bullet.speed * dt;

    while (travel > 0) {
      const step = Math.min(SUBSTEP_TILES, travel, bullet.remaining);
      if (step <= 0) {
        this.impact(bullet, bullet.x, bullet.y);
        return true;
      }
      const fromX = bullet.x;
      const fromY = bullet.y;
      bullet.x += bullet.dirX * step;
      bullet.y += bullet.dirY * step;
      bullet.remaining -= step;
      travel -= step;

      if (!this.level.isWalkable(Math.round(bullet.x), Math.round(bullet.y))) {
        this.blockedHit?.(Math.round(bullet.x), Math.round(bullet.y), bullet.owner);
        this.impact(bullet, fromX, fromY);
        return true;
      }

      if (this.hitTarget(bullet, fromX, fromY, now)) return true;

      if (bullet.remaining <= 0) {
        this.impact(bullet, bullet.x, bullet.y);
        return true;
      }
    }

    return false;
  }

  private hitTarget(bullet: Projectile, fromX: number, fromY: number, now: number): boolean {
    if (bullet.owner === 'player') {
      for (const drone of this.getDrones()) {
        if (drone.isDead) continue;
        const at = drone.gridPosition;
        if (segmentDistance(at.x, at.y, fromX, fromY, bullet.x, bullet.y) > bullet.hitRadius) continue;
        drone.takeDamage(bullet.damage, { x: bullet.dirX, y: bullet.dirY });
        this.impact(bullet, at.x, at.y);
        return true;
      }
      return false;
    }

    if (this.player.isDeadState) return false;
    const at = this.player.gridPosition;
    if (segmentDistance(at.x, at.y, fromX, fromY, bullet.x, bullet.y) > bullet.hitRadius) return false;
    this.player.takeDamage(bullet.damage, now, { x: bullet.dirX, y: bullet.dirY });
    this.impact(bullet, at.x, at.y);
    return true;
  }

  private impact(bullet: Projectile, gridX: number, gridY: number): void {
    const world = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
    const y = world.y - BULLET_HEIGHT_PX;
    const spark = this.scene.add
      .circle(world.x, y, 3, SPARK_COLORS[bullet.owner], 0.95)
      .setDepth(DEPTH_VFX + 1)
      .setBlendMode(BlendModes.ADD);
    this.scene.tweens.add({
      targets: spark,
      alpha: 0,
      scaleX: 2.4,
      scaleY: 2.4,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
    this.addFlare(gridX, gridY, bullet.owner);
  }

  private addFlare(gridX: number, gridY: number, owner: ProjectileOwner): void {
    this.flareStates.push({
      x: gridX,
      y: gridY,
      owner,
      radius: FLARE_RADIUS_PX,
      duration: FLARE_MS,
      age: 0,
    });
  }

  private placeImage(bullet: Projectile): void {
    const world = gridVectorToWorld(bullet.x, bullet.y, TILE_WIDTH, TILE_HEIGHT);
    bullet.image.setPosition(world.x, world.y - BULLET_HEIGHT_PX);
  }
}

function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
