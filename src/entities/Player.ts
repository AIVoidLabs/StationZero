import type { GameObjects, Scene } from 'phaser';
import {
  PLAYER_AIM_FRAMES,
  PLAYER_AIM_KEY,
  PLAYER_FRAME,
  PLAYER_IDLE_KEY,
  PLAYER_WALK_FRAMES,
  PLAYER_WALK_KEY,
  type Direction,
} from '../assets/manifest';
import {
  DEPTH_MARKER,
  DESCENT_SPIN_SNAP_MS,
  FOOTSTEP_DISTANCE,
  PLAYER_KNOCKBACK_MS,
  PLAYER_KNOCKBACK_SHAKE_MS,
  PLAYER_KNOCKBACK_TILES,
  MELEE_COOLDOWN_MS,
  PISTOL_AMMO_START,
  PISTOL_MAX_AMMO,
  PLAYER_FOOTPRINT,
  PLAYER_IFRAMES_MS,
  POISON_DAMAGE,
  POISON_DURATION_MS,
  POISON_TICK_MS,
  PLAYER_SPEED,
  PLAYER_STRIDE_TILES,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../data/config';
import type { Level } from '../systems/Level';
import { runStats } from '../systems/RunStats';
import { settings } from '../systems/Settings';
import { sfx } from '../systems/Sfx';
import { upgradeStats } from '../systems/Upgrades';
import { findPath, type GridPoint } from '../systems/Pathfinding';
import { facingForGridStep } from '../utils/facing';
import { gridVectorToWorld, worldVectorToGrid } from '../utils/iso';
import { Entity } from './Entity';

export type WeaponType = 'PISTOL' | 'MELEE';
const SPIN_ORDER: readonly Direction[] = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];

interface SpinState {
  t: number;
  readonly duration: number;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
}

export interface PlayerStart {
  readonly hp: number;
  readonly ammo: number;
}

export interface HitSource {
  readonly x: number;
  readonly y: number;
}

const AIM_HOLD_MS = 450;
const AIM_FIRE_MS = 110;
const AIM_LOWER_MS = 140;
const WAYPOINT_EPSILON = 0.08;
const MAX_STEP_SECONDS = 0.05;

export interface MoveInput {
  readonly x: number;
  readonly y: number;
}

export class Player extends Entity {
  private readonly level: Level;
  private readonly sprite: GameObjects.Image;
  private readonly shadow: GameObjects.Image;
  private readonly marker: GameObjects.Image;

  private facing: Direction = 'S';
  private path: GridPoint[] = [];
  private gridPosX: number;
  private gridPosY: number;
  private walkPhase = 0;
  private walkStep = 0;
  private aimUntil = 0;
  private fireUntil = 0;
  private spin: SpinState | null = null;
  private stepDistance = 0;
  private stepSide = 0;
  private stunMs = 0;
  private knockX = 0;
  private knockY = 0;
  private visualKey = '';
  private visualFrame = -1;
  private moving = false;
  private leadX = 0;
  private leadY = 0;

  private hp: number;
  private maxHp: number;
  private dead = false;
  private lastHitAt = -1000000;
  private poisonMs = 0;
  private poisonTickMs = 0;
  private attackCooldownUntil = 0;

  private weaponType: WeaponType = 'PISTOL';
  private ammo: number = PISTOL_AMMO_START;
  private maxAmmo: number = PISTOL_MAX_AMMO;
  private speedMul = 1;
  private iframesMs = PLAYER_IFRAMES_MS;

  getHealth(): { hp: number; maxHp: number; ammo: number; maxAmmo: number; weaponType: WeaponType } {
    const w = this.getActiveWeapon();
    return { hp: this.hp, maxHp: this.maxHp, ammo: this.ammo, maxAmmo: this.maxAmmo, weaponType: w };
  }

  get weapon(): WeaponType {
    return this.getActiveWeapon();
  }

  get ammoCount(): number {
    return this.ammo;
  }

  getActiveWeapon(): WeaponType {
    if (this.weaponType === 'PISTOL' && this.ammo <= 0) return 'MELEE';
    return this.weaponType;
  }

  consumeAmmo(): boolean {
    if (this.getActiveWeapon() !== 'PISTOL') return true;
    if (this.ammo <= 0) return false;
    this.ammo -= 1;
    runStats.shots += 1;
    return true;
  }

  get isDeadState(): boolean {
    return this.dead;
  }

  canAttack(timeNow: number): boolean {
    return !this.dead && !this.locked && timeNow >= this.attackCooldownUntil && !this.hasPath;
  }

  startAttackCooldown(timeNow: number, ms: number = MELEE_COOLDOWN_MS): void {
    this.attackCooldownUntil = timeNow + ms;
  }

  get locked(): boolean {
    return this.spin !== null || this.stunMs > 0;
  }

  get spinProgress(): number {
    return this.spin ? this.spin.t / this.spin.duration : 0;
  }

  get spinFinished(): boolean {
    return this.spin !== null && this.spin.t >= this.spin.duration;
  }

  startSpin(durationMs: number, centerX: number, centerY: number): void {
    if (this.dead || this.spin) return;
    this.path = [];
    this.moving = false;
    this.stunMs = 0;
    this.spin = {
      t: 0,
      duration: durationMs,
      fromX: this.gridPosX,
      fromY: this.gridPosY,
      toX: centerX,
      toY: centerY,
    };
  }

  addAmmo(amount: number): number {
    const before = this.ammo;
    this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
    return this.ammo - before;
  }

  takeDamage(amount: number, timeNow: number, source?: HitSource): boolean {
    if (this.dead) return false;
    if (timeNow < this.lastHitAt + this.iframesMs) return false;
    this.lastHitAt = timeNow;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.sprite.setTint(0x6b2b2b);
      sfx.play('playerDeath');
      return true;
    }
    sfx.play('playerHurt');
    if (source && !this.spin) this.startKnockback(source);
    return true;
  }

  private startKnockback(source: HitSource): void {
    const length = Math.hypot(source.x, source.y);
    if (length < 1e-4) return;
    this.knockX = source.x / length;
    this.knockY = source.y / length;
    this.stunMs = PLAYER_KNOCKBACK_MS;
    this.path = [];
    if (settings.data.screenShake) this.scene.cameras.main.shake(PLAYER_KNOCKBACK_SHAKE_MS, 0.004);
  }

  refreshUpgrades(): void {
    const stats = upgradeStats();
    const hpGain = Math.max(0, stats.maxHp - this.maxHp);
    const ammoGain = Math.max(0, stats.maxAmmo - this.maxAmmo);
    this.maxHp = stats.maxHp;
    this.maxAmmo = stats.maxAmmo;
    this.hp = Math.min(this.maxHp, this.hp + hpGain);
    this.ammo = Math.min(this.maxAmmo, this.ammo + ammoGain);
    this.speedMul = stats.speedMul;
    this.iframesMs = stats.iframesMs;
  }

  get isPoisoned(): boolean {
    return this.poisonMs > 0 && !this.dead;
  }

  applyPoison(): void {
    if (this.dead) return;
    if (this.poisonMs <= 0) this.poisonTickMs = POISON_TICK_MS;
    this.poisonMs = POISON_DURATION_MS;
    this.sprite.setTint(0x9fe8a0);
  }

  curePoison(): void {
    this.poisonMs = 0;
    if (!this.dead) this.sprite.clearTint();
  }

  private updatePoison(deltaMs: number): void {
    if (this.poisonMs <= 0 || this.dead) return;
    this.poisonMs -= deltaMs;
    this.poisonTickMs -= deltaMs;
    if (this.poisonTickMs <= 0) {
      this.poisonTickMs += POISON_TICK_MS;
      this.hp -= POISON_DAMAGE;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        this.sprite.setTint(0x6b2b2b);
        sfx.play('playerDeath');
        return;
      }
      sfx.play('playerHurt', 0.5);
    }
    if (this.poisonMs <= 0) this.sprite.clearTint();
  }

  heal(amount: number): void {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  constructor(scene: Scene, level: Level, gridX: number, gridY: number, start?: PlayerStart) {
    const iso = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);

    super(scene, iso.x, iso.y, { gridX, gridY, isoX: iso.x, isoY: iso.y });

    this.level = level;
    this.gridPosX = gridX;
    this.gridPosY = gridY;
    const stats = upgradeStats();
    this.maxHp = stats.maxHp;
    this.hp = Math.max(1, Math.min(stats.maxHp, start?.hp ?? stats.maxHp));
    this.weaponType = 'PISTOL';
    this.ammo = Math.max(0, Math.min(stats.maxAmmo, start?.ammo ?? PISTOL_AMMO_START));
    this.maxAmmo = stats.maxAmmo;
    this.speedMul = stats.speedMul;
    this.iframesMs = stats.iframesMs;

    this.shadow = scene.add.image(0, 0, 'shadow').setOrigin(0.5, 0.5);
    this.sprite = scene.add.image(0, 0, PLAYER_IDLE_KEY, PLAYER_FRAME[this.facing]);
    this.visualKey = PLAYER_IDLE_KEY;
    this.visualFrame = PLAYER_FRAME[this.facing];
    this.sprite.setOrigin(0.5, 1);
    this.add([this.shadow, this.sprite]);

    this.marker = scene.add
      .image(iso.x, iso.y, 'tile_marker_ok')
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_MARKER)
      .setAlpha(0);

    this.setDepth(iso.y);
  }

  get leadDirection(): { readonly x: number; readonly y: number } {
    return { x: this.leadX, y: this.leadY };
  }

  get gridPosition(): { readonly x: number; readonly y: number } {
    return { x: this.gridPosX, y: this.gridPosY };
  }

  get facingDirection(): Direction {
    return this.facing;
  }

  get hasPath(): boolean {
    return this.path.length > 0;
  }

  update(deltaMs: number, input: MoveInput | null): void {
    const dt = Math.min(deltaMs, MAX_STEP_SECONDS * 1000) / 1000;
    this.updatePoison(deltaMs);
    if (this.dead) {
      this.path = [];
      this.moving = false;
      this.updateVisual(0);
      return;
    }
    if (this.spin) {
      this.updateSpin(deltaMs);
      return;
    }
    if (this.stunMs > 0) {
      this.updateKnockback(deltaMs);
      return;
    }
    const hasInput = input !== null && (input.x !== 0 || input.y !== 0);
    const fromX = this.gridPosX;
    const fromY = this.gridPosY;
    this.moving = false;

    if (hasInput && input) {
      if (this.path.length > 0) this.path = [];
      const length = Math.hypot(input.x, input.y);
      this.moveAlongWorldDirection(input.x / length, input.y / length, dt);
    } else if (this.path.length > 0) {
      this.followPath(dt);
    }

    if (!hasInput && !this.moving) {
      this.leadX = 0;
      this.leadY = 0;
    }

    const travelled = Math.hypot(this.gridPosX - fromX, this.gridPosY - fromY);
    this.trackFootsteps(travelled);
    this.updateVisual(travelled);
  }

  private trackFootsteps(travelled: number): void {
    if (travelled <= 0) return;
    this.stepDistance += travelled;
    if (this.stepDistance < FOOTSTEP_DISTANCE) return;
    this.stepDistance -= FOOTSTEP_DISTANCE;
    this.stepSide = 1 - this.stepSide;
    const material = this.level.materialAt(Math.round(this.gridPosX), Math.round(this.gridPosY));
    const name =
      material === 'grate'
        ? 'stepGrate'
        : material === 'concrete'
          ? 'stepConcrete'
          : material === 'tile'
            ? 'stepTile'
            : material === 'water'
              ? 'stepWater'
              : 'stepSteel';
    const pitch = (this.stepSide === 0 ? 0.94 : 1.04) + (Math.random() - 0.5) * 0.08;
    sfx.play(name, 0.55, pitch);
  }

  private updateSpin(deltaMs: number): void {
    const spin = this.spin;
    if (!spin) return;
    spin.t = Math.min(spin.duration, spin.t + deltaMs);
    this.moving = false;
    this.leadX = 0;
    this.leadY = 0;

    const snap = Math.min(1, spin.t / DESCENT_SPIN_SNAP_MS);
    const eased = 1 - (1 - snap) * (1 - snap);
    this.gridPosX = spin.fromX + (spin.toX - spin.fromX) * eased;
    this.gridPosY = spin.fromY + (spin.toY - spin.fromY) * eased;
    this.syncTransform();

    const turn = Math.min(0.999, spin.t / spin.duration);
    this.facing = SPIN_ORDER[Math.floor(turn * SPIN_ORDER.length)] ?? 'S';
    this.updateVisual(0);
  }

  private updateKnockback(deltaMs: number): void {
    const before = this.stunMs;
    const after = Math.max(0, before - deltaMs);
    const ease = (remaining: number): number => {
      const progress = 1 - remaining / PLAYER_KNOCKBACK_MS;
      return 1 - (1 - progress) * (1 - progress);
    };
    const distance = PLAYER_KNOCKBACK_TILES * (ease(after) - ease(before));
    if (this.moveBy(this.knockX * distance, this.knockY * distance)) this.syncTransform();
    this.stunMs = after;
    this.moving = false;
    this.updateVisual(0);
  }

  setDestination(gridX: number, gridY: number): boolean {
    const startX = Math.round(this.gridPosX);
    const startY = Math.round(this.gridPosY);
    const path = findPath(this.level, startX, startY, gridX, gridY);

    if (path === null) {
      this.showMarker(gridX, gridY, false);
      return false;
    }

    this.path = path;
    this.showMarker(gridX, gridY, true);
    return true;
  }

  cancelPath(): void {
    this.path = [];
  }

  private moveAlongWorldDirection(directionX: number, directionY: number, dt: number): void {
    const velocity = worldVectorToGrid(
      directionX * PLAYER_SPEED * this.speedMul,
      directionY * PLAYER_SPEED * this.speedMul,
      TILE_WIDTH,
      TILE_HEIGHT,
    );

    this.faceToward(velocity.x, velocity.y);
    this.leadX = directionX;
    this.leadY = directionY;

    const moved = this.moveBy(velocity.x * dt, velocity.y * dt);
    this.moving = moved;
  }

  private followPath(dt: number): void {
    this.advanceWaypoint();

    const target = this.path[0];
    if (!target) {
      this.path = [];
      return;
    }

    const from = gridVectorToWorld(this.gridPosX, this.gridPosY, TILE_WIDTH, TILE_HEIGHT);
    const to = gridVectorToWorld(target.gridX, target.gridY, TILE_WIDTH, TILE_HEIGHT);
    const offsetX = to.x - from.x;
    const offsetY = to.y - from.y;
    const distance = Math.hypot(offsetX, offsetY);

    if (distance < WAYPOINT_EPSILON) {
      this.path.shift();
      return;
    }

    const directionX = offsetX / distance;
    const directionY = offsetY / distance;
    const velocity = worldVectorToGrid(
      directionX * PLAYER_SPEED * this.speedMul,
      directionY * PLAYER_SPEED * this.speedMul,
      TILE_WIDTH,
      TILE_HEIGHT,
    );

    this.faceToward(velocity.x, velocity.y);
    this.leadX = directionX;
    this.leadY = directionY;

    const moved = this.moveBy(velocity.x * dt, velocity.y * dt);
    this.moving = moved;

    if (!moved) this.path = [];
  }

  private advanceWaypoint(): void {
    while (this.path.length > 1) {
      const target = this.path[0];
      if (!target) return;
      const distance = Math.hypot(target.gridX - this.gridPosX, target.gridY - this.gridPosY);
      if (distance > WAYPOINT_EPSILON) return;
      this.path.shift();
    }

    const target = this.path[0];
    if (!target) return;
    const distance = Math.hypot(target.gridX - this.gridPosX, target.gridY - this.gridPosY);
    if (distance <= WAYPOINT_EPSILON) this.path.shift();
  }

  private moveBy(stepX: number, stepY: number): boolean {
    let moved = false;

    const nextX = this.gridPosX + stepX;
    if (!this.isBlocked(nextX, this.gridPosY)) {
      if (Math.abs(nextX - this.gridPosX) > 0.00001) moved = true;
      this.gridPosX = nextX;
    }

    const nextY = this.gridPosY + stepY;
    if (!this.isBlocked(this.gridPosX, nextY)) {
      if (Math.abs(nextY - this.gridPosY) > 0.00001) moved = true;
      this.gridPosY = nextY;
    }

    if (moved) this.syncTransform();
    return moved;
  }

  private isBlocked(gridX: number, gridY: number): boolean {
    const radius = PLAYER_FOOTPRINT;
    const minX = Math.round(gridX - radius);
    const maxX = Math.round(gridX + radius);
    const minY = Math.round(gridY - radius);
    const maxY = Math.round(gridY + radius);

    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        if (!this.level.isWalkable(cellX, cellY)) return true;
      }
    }

    return false;
  }

  private syncTransform(): void {
    const world = gridVectorToWorld(this.gridPosX, this.gridPosY, TILE_WIDTH, TILE_HEIGHT);
    this.setPosition(world.x, world.y);
    this.isoX = world.x;
    this.isoY = world.y;
    this.gridX = Math.round(this.gridPosX);
    this.gridY = Math.round(this.gridPosY);
    this.setDepth(world.y);
  }

  aimToward(gridDx: number, gridDy: number, fired = false): void {
    this.faceToward(gridDx, gridDy);
    const now = this.scene.time.now;
    this.aimUntil = now + AIM_HOLD_MS;
    if (fired) this.fireUntil = now + AIM_FIRE_MS;
    this.applyVisualFrame();
  }

  private faceToward(stepX: number, stepY: number): void {
    if (Math.abs(stepX) < 0.00001 && Math.abs(stepY) < 0.00001) return;
    const next = facingForGridStep(stepX, stepY);
    if (next === this.facing) return;
    this.facing = next;
  }

  private updateVisual(travelled: number): void {
    if (this.moving) {
      this.walkPhase = (this.walkPhase + travelled / PLAYER_STRIDE_TILES) % 1;
      this.walkStep = Math.floor(this.walkPhase * PLAYER_WALK_FRAMES) % PLAYER_WALK_FRAMES;
    } else {
      this.walkPhase = 0;
      this.walkStep = 0;
    }

    this.sprite.x = 0;
    this.sprite.y = 0;
    if (!this.dead) {
      if (this.stunMs > 0) {
        this.sprite.setTint(Math.floor(this.scene.time.now / 50) % 2 === 0 ? 0xff6a5a : 0xffffff);
      } else {
        this.sprite.clearTint();
      }
    }
    this.applyVisualFrame();
  }

  private applyVisualFrame(): void {
    const now = this.scene.time.now;
    const aiming = !this.moving && now < this.aimUntil;
    const directionIndex = PLAYER_FRAME[this.facing];

    let key = PLAYER_IDLE_KEY;
    let frame = directionIndex;
    if (aiming) {
      key = PLAYER_AIM_KEY;
      let phase = 0;
      if (now < this.fireUntil) phase = 1;
      else if (this.aimUntil - now < AIM_LOWER_MS) phase = 2;
      frame = directionIndex * PLAYER_AIM_FRAMES + phase;
    } else if (this.moving) {
      key = PLAYER_WALK_KEY;
      frame = directionIndex * PLAYER_WALK_FRAMES + this.walkStep;
    }

    if (this.visualKey === key && this.visualFrame === frame) return;
    this.visualKey = key;
    this.visualFrame = frame;
    this.sprite.setTexture(key, frame);
  }

  private showMarker(gridX: number, gridY: number, reachable: boolean): void {
    const iso = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
    this.scene.tweens.killTweensOf(this.marker);
    this.marker
      .setTexture(reachable ? 'tile_marker_ok' : 'tile_marker_blocked')
      .setPosition(iso.x, iso.y)
      .setAlpha(0.9);
    this.scene.tweens.add({
      targets: this.marker,
      alpha: 0,
      duration: reachable ? 650 : 420,
      ease: 'Quad.easeIn',
    });
  }
}
