import type { GameObjects, Scene } from 'phaser';
import {
  PLAYER_AIM_FRAMES,
  PLAYER_FRAME,
  selectPlayerArt,
  type Direction,
  type PlayerArt,
} from '../assets/manifest';
import {
  DEPTH_MARKER,
  DESCENT_SPIN_SNAP_MS,
  FOOTSTEP_DISTANCE,
  PLAYER_KNOCKBACK_MS,
  PLAYER_KNOCKBACK_SHAKE_MS,
  PLAYER_KNOCKBACK_TILES,
  PISTOL_MAX_AMMO as AMMO_CAP,
  MELEE_COOLDOWN_MS,
  PISTOL_AMMO_START,
  PISTOL_MAX_AMMO,
  PLAYER_FOOTPRINT,
  PLAYER_IFRAMES_MS,
  PLAYER_MAX_HP,
  PLAYER_SPEED,
  PLAYER_STRIDE_TILES,
  PLAYER_SWAY_PX,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../data/config';
import type { Level } from '../systems/Level';
import { runStats } from '../systems/RunStats';
import { settings } from '../systems/Settings';
import { sfx } from '../systems/Sfx';
import { findPath, type GridPoint } from '../systems/Pathfinding';
import { facingForGridStep } from '../utils/facing';
import { gridVectorToWorld, worldVectorToGrid } from '../utils/iso';
import { Entity } from './Entity';

export type WeaponType = 'PISTOL' | 'MELEE';
export type PlayerCombatState = 'IDLE' | 'MOVING_TO_ATTACK' | 'ATTACKING';

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
  private readonly art: PlayerArt = selectPlayerArt();
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
  private attackCooldownUntil = 0;

  private weaponType: WeaponType = 'PISTOL';
  private ammo: number = PISTOL_AMMO_START;
  private maxAmmo: number = PISTOL_MAX_AMMO;
  private combatState: PlayerCombatState = 'IDLE';

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

  get combatMode(): PlayerCombatState {
    return this.combatState;
  }

  getActiveWeapon(): WeaponType {
    if (this.weaponType === 'PISTOL' && this.ammo <= 0) return 'MELEE';
    return this.weaponType;
  }

  setAttackTarget(target: { gridX: number; gridY: number } | null): void {
    if (target) {
      this.combatState = 'MOVING_TO_ATTACK';
    } else {
      this.combatState = 'IDLE';
    }
  }

  beginAttacking(): void {
    this.combatState = 'ATTACKING';
  }

  isStationary(): boolean {
    return !this.moving && this.path.length === 0;
  }

  consumeAmmo(): boolean {
    if (this.getActiveWeapon() !== 'PISTOL') return true;
    if (this.ammo <= 0) return false;
    this.ammo -= 1;
    runStats.shots += 1;
    return true;
  }

  canRightClickPistol(timeNow: number): boolean {
    return (
      !this.dead &&
      !this.locked &&
      this.getActiveWeapon() === 'PISTOL' &&
      this.ammo > 0 &&
      !this.hasPath &&
      timeNow >= this.attackCooldownUntil
    );
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

  get isSpinning(): boolean {
    return this.spin !== null;
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
    if (timeNow < this.lastHitAt + PLAYER_IFRAMES_MS) return false;
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
    this.maxHp = PLAYER_MAX_HP;
    this.hp = Math.max(1, Math.min(PLAYER_MAX_HP, start?.hp ?? PLAYER_MAX_HP));
    this.weaponType = 'PISTOL';
    this.ammo = Math.max(0, Math.min(AMMO_CAP, start?.ammo ?? PISTOL_AMMO_START));
    this.maxAmmo = PISTOL_MAX_AMMO;
    this.combatState = 'IDLE';

    this.shadow = scene.add.image(0, 0, 'shadow').setOrigin(0.5, 0.5);
    const hasIdleAtlas = scene.textures.exists(this.art.idleKey);
    this.sprite = hasIdleAtlas
      ? scene.add.image(0, 0, this.art.idleKey, PLAYER_FRAME[this.facing])
      : scene.add.image(0, 0, `player_${this.facing}`);
    this.visualKey = hasIdleAtlas ? this.art.idleKey : `player_${this.facing}`;
    this.visualFrame = hasIdleAtlas ? PLAYER_FRAME[this.facing] : -1;
    this.sprite.setOrigin(0.5, 1);
    this.add([this.shadow, this.sprite]);

    this.marker = scene.add
      .image(iso.x, iso.y, 'tile_marker_ok')
      .setOrigin(0.5, 0.5)
      .setDepth(DEPTH_MARKER)
      .setAlpha(0);

    this.setDepth(iso.y);
  }

  get isMoving(): boolean {
    return this.moving;
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
    if (this.dead) {
      this.path = [];
      this.moving = false;
      this.updateVisual(dt, 0);
      return;
    }
    if (this.spin) {
      this.updateSpin(deltaMs, dt);
      return;
    }
    if (this.stunMs > 0) {
      this.updateKnockback(deltaMs, dt);
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
    this.updateVisual(dt, travelled);
  }

  private trackFootsteps(travelled: number): void {
    if (travelled <= 0) return;
    this.stepDistance += travelled;
    if (this.stepDistance < FOOTSTEP_DISTANCE) return;
    this.stepDistance -= FOOTSTEP_DISTANCE;
    this.stepSide = 1 - this.stepSide;
    const material = this.level.materialAt(Math.round(this.gridPosX), Math.round(this.gridPosY));
    const name = material === 'grate' ? 'stepGrate' : material === 'concrete' ? 'stepConcrete' : 'stepSteel';
    const pitch = (this.stepSide === 0 ? 0.94 : 1.04) + (Math.random() - 0.5) * 0.08;
    sfx.play(name, 0.55, pitch);
  }

  private updateSpin(deltaMs: number, dt: number): void {
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
    this.updateVisual(dt, 0);
  }

  private updateKnockback(deltaMs: number, dt: number): void {
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
    this.updateVisual(dt, 0);
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
      directionX * PLAYER_SPEED,
      directionY * PLAYER_SPEED,
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
      directionX * PLAYER_SPEED,
      directionY * PLAYER_SPEED,
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

  private updateVisual(dt: number, travelled: number): void {
    if (this.moving) {
      this.walkPhase = (this.walkPhase + travelled / PLAYER_STRIDE_TILES) % 1;
      this.walkStep = Math.floor(this.walkPhase * this.art.walkFrames) % this.art.walkFrames;
      const sway = this.art.aimKey !== null ? 0 : this.walkStep < this.art.walkFrames / 2 ? -1 : 1;
      this.sprite.x = sway * PLAYER_SWAY_PX;
    } else {
      this.walkPhase = 0;
      this.walkStep = 0;
      this.sprite.x += (0 - this.sprite.x) * Math.min(1, dt * 14);
    }

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
    const aiming = this.art.aimKey !== null && !this.moving && now < this.aimUntil;
    const walking = this.moving && this.scene.textures.exists(this.art.walkKey);
    const directionIndex = PLAYER_FRAME[this.facing];

    let key = this.art.idleKey;
    let frame = directionIndex;
    if (aiming && this.art.aimKey !== null) {
      key = this.art.aimKey;
      let phase = 0;
      if (now < this.fireUntil) phase = 1;
      else if (this.aimUntil - now < AIM_LOWER_MS) phase = 2;
      frame = directionIndex * PLAYER_AIM_FRAMES + phase;
    } else if (walking) {
      key = this.art.walkKey;
      frame = directionIndex * this.art.walkFrames + this.walkStep;
    }
    const resolvedKey = this.scene.textures.exists(key) ? key : `player_${this.facing}`;
    const resolvedFrame = resolvedKey === key ? frame : -1;

    if (this.visualKey === resolvedKey && this.visualFrame === resolvedFrame) return;
    this.visualKey = resolvedKey;
    this.visualFrame = resolvedFrame;

    if (resolvedFrame >= 0) {
      this.sprite.setTexture(resolvedKey, resolvedFrame);
      return;
    }

    this.sprite.setTexture(resolvedKey);
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
