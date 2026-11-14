import type { GameObjects, Scene } from 'phaser';
import { DRONE_FRAME, type Direction } from '../../assets/manifest';
import {
  DRONE_BULLET_DAMAGE,
  DRONE_CHASE_LEASH,
  DRONE_CHASE_MAX_MS,
  DRONE_DISENGAGE_GRACE_MS,
  DRONE_DISENGAGE_SIGHT_SCALE,
  DRONE_IDLE_MAX_MS,
  DRONE_IDLE_MIN_MS,
  DRONE_LOSE_SIGHT_MS,
  DRONE_PATROL_RADIUS,
  DRONE_PERIPHERAL_RANGE,
  DRONE_REPATH_MS,
  DRONE_SCAN_MS,
  DRONE_SEARCH_MS,
  DRONE_SIGHT_RANGE,
  DRONE_VIEW_COSINE,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../../data/config';
import type { Level } from '../../systems/Level';
import type { DepthManager } from '../../systems/DepthManager';
import { hasLineOfSight, type GridCell } from '../../systems/Los';
import { findPath, type GridPoint } from '../../systems/Pathfinding';
import {
  DEPTH_VFX,
  DRONE_DODGE_CHANCE,
  DRONE_DODGE_COOLDOWN_MS,
  DRONE_DODGE_MS,
  DRONE_DODGE_RETRY_MS,
  DRONE_DODGE_SENSE_TILES,
  DRONE_DODGE_SPEED,
} from '../../data/config';
import { fireCooldownScale, scaledEnemyHp } from '../../data/difficulty';
import { BOSS_XP, TIER_SPECS, type EnemyTier, type TierSpec } from '../../data/tiers';
import { ENEMY_SPECS, TANK_FRONT_COS, type EnemyKind, type EnemySpec } from '../../data/enemies';
import type { Projectiles } from '../../systems/Projectiles';
import { runFlags } from '../../systems/RunFlags';
import { distanceGain, sfx } from '../../systems/Sfx';
import { upgradeStats } from '../../systems/Upgrades';
import { DIRECTION_VECTOR, DIRECTIONS, facingForGridStep } from '../../utils/facing';
import { gridVectorToWorld, worldVectorToGrid } from '../../utils/iso';
import { BlendModes } from 'phaser';
import type { Player } from '../Player';
import { Entity } from '../Entity';
import { createRng } from '../../utils/random';

export type DroneState = 'IDLE' | 'PATROL' | 'CHASE' | 'SEARCH' | 'DISENGAGE';

export type DroneLightKind = 'idle' | 'search' | 'chase' | 'aim' | 'wreck';

export interface DroneLightState {
  readonly kind: DroneLightKind;
  readonly facing: Direction;
  readonly deathAgeMs: number;
}

type FireState = 'NONE' | 'WINDUP' | 'RECOVER';

const WRECK_DEPTH_OFFSET = 12;
const DORMANT_WAKE_RANGE = 6;

const WAYPOINT_EPSILON = 0.08;
const MAX_STEP_SECONDS = 0.05;
const HEALTH_BAR_HEIGHT = 3;

export interface HitDirection {
  readonly x: number;
  readonly y: number;
}

export class Drone extends Entity {
  readonly kind: EnemyKind;
  readonly tier: EnemyTier;
  private readonly tierSpec: TierSpec;
  private readonly spec: EnemySpec;
  private readonly level: Level;
  private readonly player: Player;
  private readonly depthManager: DepthManager;
  private readonly rng: () => number;
  private readonly sprite: GameObjects.Image;
  private readonly shadow: GameObjects.Image;
  private readonly healthBarBack: GameObjects.Rectangle;
  private readonly healthBarFill: GameObjects.Rectangle;
  private readonly homeX: number;
  private readonly homeY: number;
  private readonly bobPhase: number;
  private readonly projectiles: Projectiles | null;

  private posX: number;
  private posY: number;
  private facing: Direction = 'S';
  private path: GridPoint[] = [];
  private mode: DroneState = 'IDLE';
  private modeMs = 0;
  private idleMs = DRONE_IDLE_MIN_MS;
  private repathMs = 0;
  private scanMs = 0;
  private lostSightMs = 0;
  private lastKnownX: number;
  private lastKnownY: number;
  private visualFrame = -1;

  private hp: number;
  private maxHp: number;
  private dead = false;
  private lastDamageAt = -1000000;
  private fireState: FireState = 'NONE';
  private fireMs = 0;
  private fireCooldownMs = 0;
  private dodgeMs = 0;
  private dodgeDirX = 0;
  private dodgeDirY = 0;
  private dodgeCooldownMs = 0;
  private diedAt = 0;
  private nextTurnAt = 0;
  private armorHp = 0;
  private maxArmorHp = 0;
  private dormant = false;
  private summonClock = 0;
  private summonPending = false;
  private readonly armorBarBack: GameObjects.Rectangle;
  private readonly armorBarFill: GameObjects.Rectangle;
  private readonly tierMarks: GameObjects.Rectangle[] = [];

  constructor(
    scene: Scene,
    level: Level,
    player: Player,
    depth: DepthManager,
    homeX: number,
    homeY: number,
    seed: number,
    projectiles: Projectiles | null = null,
    kind: EnemyKind = 'drone',
    tier: EnemyTier = 'novice',
  ) {
    const iso = gridVectorToWorld(homeX, homeY, TILE_WIDTH, TILE_HEIGHT);
    super(scene, iso.x, iso.y, { gridX: homeX, gridY: homeY, isoX: iso.x, isoY: iso.y });

    this.kind = kind;
    this.spec = ENEMY_SPECS[kind];
    this.tier = this.spec.boss ? 'master' : tier;
    this.tierSpec = this.spec.boss ? TIER_SPECS.novice : TIER_SPECS[tier];
    this.level = level;
    this.player = player;
    this.depthManager = depth;
    this.projectiles = projectiles;
    this.rng = createRng(seed);
    this.fireCooldownMs = 800 + createRng(seed ^ 0x51)() * 1400;
    this.homeX = homeX;
    this.homeY = homeY;
    this.lastKnownX = homeX;
    this.lastKnownY = homeY;
    this.posX = homeX;
    this.posY = homeY;
    this.bobPhase = this.rng() * Math.PI * 2;
    this.idleMs = DRONE_IDLE_MIN_MS + this.rng() * (DRONE_IDLE_MAX_MS - DRONE_IDLE_MIN_MS);

    const maxHp = this.spec.boss ? this.spec.maxHp : Math.max(1, Math.round(scaledEnemyHp(this.spec.maxHp, depth.floor) * this.tierSpec.hpMul));
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.maxArmorHp = this.spec.armorHp > 0 ? this.spec.armorHp + this.tierSpec.armorBonus : 0;
    this.armorHp = this.maxArmorHp;
    this.dead = false;

    const scale = this.spec.scale;
    const barWidth = this.spec.healthBarWidth;
    const barY = -this.spec.height * scale - 6;
    this.shadow = scene.add.image(0, 0, 'shadow').setOrigin(0.5, 0.5).setScale(0.8 * scale).setAlpha(0.65);

    this.sprite = scene.add.image(0, 0, this.spec.spriteKey, DRONE_FRAME[this.facing]);
    this.visualFrame = DRONE_FRAME[this.facing];
    this.sprite.setOrigin(0.5, 1).setScale(scale);
    this.healthBarBack = scene.add
      .rectangle(0, barY, barWidth + 2, HEALTH_BAR_HEIGHT + 2, 0x0a0a0a, 0.9)
      .setOrigin(0.5, 0.5);
    this.healthBarFill = scene.add
      .rectangle(-barWidth / 2, barY, barWidth, HEALTH_BAR_HEIGHT, 0x6fae4f, 1)
      .setOrigin(0, 0.5);
    this.armorBarBack = scene.add
      .rectangle(0, barY + HEALTH_BAR_HEIGHT + 3, barWidth + 2, HEALTH_BAR_HEIGHT + 1, 0x0a0a0a, 0.9)
      .setOrigin(0.5, 0.5)
      .setVisible(this.armorHp > 0);
    this.armorBarFill = scene.add
      .rectangle(-barWidth / 2, barY + HEALTH_BAR_HEIGHT + 3, barWidth, HEALTH_BAR_HEIGHT - 1, 0x7fb4dc, 1)
      .setOrigin(0, 0.5)
      .setVisible(this.armorHp > 0);
    const markColor = this.tier === 'master' ? 0xe8c060 : 0x9fd0ff;
    for (let index = 0; index < this.tierSpec.stripes; index += 1) {
      this.tierMarks.push(
        scene.add.rectangle(-barWidth / 2 - 6 - index * 5, barY, 3, HEALTH_BAR_HEIGHT + 4, markColor, 1).setOrigin(0.5, 0.5),
      );
    }
    if (this.tier === 'master' && !this.spec.boss) this.healthBarBack.setStrokeStyle(1, 0xe8c060, 0.9);
    this.add([this.shadow, this.sprite, this.healthBarBack, this.healthBarFill, this.armorBarBack, this.armorBarFill, ...this.tierMarks]);
    this.updateHealthBar();

    this.setDepth(iso.y);
  }

  get currentState(): DroneState {
    return this.mode;
  }

  get gridPosition(): { readonly x: number; readonly y: number } {
    return { x: this.posX, y: this.posY };
  }

  get facingDirection(): Direction {
    return this.facing;
  }

  get isDead(): boolean {
    return this.dead;
  }

  get isDormant(): boolean {
    return this.dormant;
  }

  sleep(): void {
    this.dormant = true;
  }

  wake(): void {
    if (!this.dormant) return;
    this.dormant = false;
    this.fireCooldownMs = 1500;
    sfx.play('laser', this.audioGain());
    this.spawnArmorBreakFx();
  }

  get contactReach(): number {
    return this.spec.contactRange + 0.25;
  }

  get contactDamage(): number {
    return this.spec.contactDamage + this.tierSpec.damageBonus;
  }

  get xpValue(): number {
    return this.spec.boss ? BOSS_XP : this.tierSpec.xp;
  }

  get health(): { hp: number; maxHp: number } {
    return { hp: this.hp, maxHp: this.maxHp };
  }

  takeDamage(amount: number, travel?: HitDirection): boolean {
    if (this.dead) return false;
    this.wake();
    if (this.armorHp > 0 && travel && this.isFrontalHit(travel)) {
      this.armorHp = Math.max(0, this.armorHp - upgradeStats().armorHit);
      this.updateArmorBar();
      if (this.armorHp <= 0) {
        sfx.play('armorBreak', this.audioGain());
        this.spawnArmorBreakFx();
      } else {
        sfx.play('deflect', this.audioGain());
        this.spawnDeflectFx();
      }
      return false;
    }
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.setHealthBarVisible(false);
      sfx.play('droneDeath', this.audioGain());
      this.onDeath();
    } else {
      sfx.play('droneHit', this.audioGain());
      this.updateHealthBar();
    }
    return true;
  }

  canDealContactDamage(timeNow: number): boolean {
    if (this.dead) return false;
    if (timeNow < this.lastDamageAt + 800) return false;
    this.lastDamageAt = timeNow;
    return true;
  }

  update(deltaMs: number): void {
    if (this.dead) {
      this.shadow.setVisible(false);
      this.setHealthBarVisible(false);
      return;
    }
    if (this.dormant) {
      const at = this.player.gridPosition;
      if (Math.hypot(at.x - this.posX, at.y - this.posY) <= DORMANT_WAKE_RANGE) this.wake();
      else {
        this.updateVisual();
        return;
      }
    }
    const dt = Math.min(deltaMs, MAX_STEP_SECONDS * 1000) / 1000;
    this.fireCooldownMs -= deltaMs;
    this.dodgeCooldownMs -= deltaMs;
    if (this.spec.summonMs > 0 && this.mode === 'CHASE') {
      this.summonClock += deltaMs;
      if (this.summonClock >= this.spec.summonMs) {
        this.summonClock = 0;
        this.summonPending = true;
      }
    }
    if (this.updateDodge(deltaMs, dt)) {
      this.syncTransform();
      this.updateVisual();
      return;
    }
    this.modeMs += deltaMs;
    this.repathMs -= deltaMs;
    this.scanMs -= deltaMs;

    switch (this.mode) {
      case 'IDLE':
        this.updateIdle();
        break;
      case 'PATROL':
        this.updatePatrol(dt);
        break;
      case 'CHASE':
        this.updateChase(deltaMs, dt);
        break;
      case 'SEARCH':
        this.updateSearch(dt);
        break;
      case 'DISENGAGE':
        this.updateDisengage(dt);
        break;
    }

    this.syncTransform();
    if (this.dead) return;
    this.updateVisual();
  }

  private updateIdle(): void {
    if (this.tryAggro(1)) return;

    if (this.scanMs <= 0) {
      this.scanMs = DRONE_SCAN_MS;
      const index = Math.floor(this.rng() * DIRECTIONS.length);
      this.facing = DIRECTIONS[index] ?? 'S';
    }

    if (this.modeMs < this.idleMs) return;

    if (this.pickPatrol()) {
      this.mode = 'PATROL';
      this.modeMs = 0;
      return;
    }

    this.idleMs += 600;
    this.modeMs = 0;
  }

  private updatePatrol(dt: number): void {
    if (this.tryAggro(1)) return;

    if (this.path.length === 0) {
      this.enterIdle();
      return;
    }

    this.followPath(dt, this.spec.speed * this.tierSpec.speedMul);
  }

  private updateChase(deltaMs: number, dt: number): void {
    const target = this.playerCell();
    const sees = this.canSee(1);
    const distanceToHome = Math.hypot(this.posX - this.homeX, this.posY - this.homeY);

    if (sees) {
      this.lastKnownX = target.gridX;
      this.lastKnownY = target.gridY;
      this.lostSightMs = 0;
    } else {
      this.lostSightMs += deltaMs;
    }

    if (
      distanceToHome > DRONE_CHASE_LEASH ||
      this.modeMs > DRONE_CHASE_MAX_MS ||
      this.lostSightMs > DRONE_LOSE_SIGHT_MS
    ) {
      if (this.lostSightMs > DRONE_LOSE_SIGHT_MS && distanceToHome <= DRONE_CHASE_LEASH) {
        this.enterSearch();
      } else {
        this.enterDisengage();
      }
      return;
    }

    const distanceToPlayer = Math.hypot(target.gridX - this.posX, target.gridY - this.posY);
    if (this.updateFire(deltaMs, sees, distanceToPlayer)) return;

    if (this.spec.keepDistance > 0 && distanceToPlayer < this.spec.keepDistance) {
      this.retreatFrom(target, dt);
      return;
    }

    if (distanceToPlayer <= this.spec.contactRange) {
      this.path = [];
      this.faceToward(target.gridX - this.posX, target.gridY - this.posY);
      return;
    }

    if (this.repathMs <= 0) {
      this.repathMs = DRONE_REPATH_MS;
      this.setPath(target.gridX, target.gridY);
    }

    this.followPath(dt, this.spec.chaseSpeed * this.tierSpec.speedMul);
  }

  private retreatFrom(target: GridCell, dt: number): void {
    if (this.repathMs <= 0) {
      this.repathMs = DRONE_REPATH_MS;
      const awayX = this.posX - target.gridX;
      const awayY = this.posY - target.gridY;
      const length = Math.hypot(awayX, awayY) || 1;
      let found = false;
      for (const angle of [0, 0.7, -0.7, 1.4, -1.4]) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const dx = (awayX / length) * c - (awayY / length) * s;
        const dy = (awayX / length) * s + (awayY / length) * c;
        for (const distance of [5, 3]) {
          const goalX = Math.round(this.posX + dx * distance);
          const goalY = Math.round(this.posY + dy * distance);
          if (!this.level.isWalkable(goalX, goalY)) continue;
          this.setPath(goalX, goalY);
          if (this.path.length > 0) found = true;
          if (found) break;
        }
        if (found) break;
      }
    }
    this.followPath(dt, this.spec.chaseSpeed * this.tierSpec.speedMul);
  }

  private updateSearch(dt: number): void {
    if (this.tryAggro(1)) return;

    if (this.modeMs > DRONE_SEARCH_MS) {
      this.enterDisengage();
      return;
    }

    if (this.path.length > 0) {
      this.followPath(dt, this.spec.speed * this.tierSpec.speedMul);
      return;
    }

    if (this.scanMs <= 0) {
      this.scanMs = DRONE_SCAN_MS;
      const index = Math.floor(this.rng() * DIRECTIONS.length);
      this.facing = DIRECTIONS[index] ?? 'S';
    }
  }

  private updateDisengage(dt: number): void {
    if (
      this.modeMs > DRONE_DISENGAGE_GRACE_MS &&
      this.canSee(DRONE_DISENGAGE_SIGHT_SCALE)
    ) {
      this.enterChase(this.playerCell());
      return;
    }

    if (this.path.length === 0) {
      this.enterIdle();
      return;
    }

    this.followPath(dt, this.spec.returnSpeed * this.tierSpec.speedMul);
  }

  private tryAggro(rangeScale: number): boolean {
    if (!this.canSee(rangeScale)) return false;
    this.enterChase(this.playerCell());
    return true;
  }

  private canSee(rangeScale: number): boolean {
    const target = this.playerCell();
    const awareness = this.depthManager.pressure.awareness;
    const dx = target.gridX - this.posX;
    const dy = target.gridY - this.posY;
    const distance = Math.hypot(dx, dy);

    if (distance > DRONE_SIGHT_RANGE * rangeScale * awareness * this.tierSpec.senseMul) return false;
    if (distance > DRONE_PERIPHERAL_RANGE * awareness && !this.inViewCone(dx, dy, distance)) {
      return false;
    }

    const from: GridCell = { gridX: Math.round(this.posX), gridY: Math.round(this.posY) };
    return hasLineOfSight(this.level, from, target);
  }

  private inViewCone(dx: number, dy: number, distance: number): boolean {
    if (distance < 0.0001) return true;
    const forward = DIRECTION_VECTOR[this.facing];
    const dot = (dx / distance) * forward.x + (dy / distance) * forward.y;
    return dot >= DRONE_VIEW_COSINE;
  }

  private playerCell(): GridCell {
    const position = this.player.gridPosition;
    return { gridX: Math.round(position.x), gridY: Math.round(position.y) };
  }

  private enterIdle(): void {
    this.mode = 'IDLE';
    this.modeMs = 0;
    this.path = [];
    this.scanMs = 0;
    this.idleMs = DRONE_IDLE_MIN_MS + this.rng() * (DRONE_IDLE_MAX_MS - DRONE_IDLE_MIN_MS);
  }

  private enterChase(target: GridCell): void {
    this.mode = 'CHASE';
    this.modeMs = 0;
    this.path = [];
    this.repathMs = 0;
    this.lostSightMs = 0;
    this.lastKnownX = target.gridX;
    this.lastKnownY = target.gridY;
    this.faceToward(target.gridX - this.posX, target.gridY - this.posY);
  }

  private enterSearch(): void {
    this.mode = 'SEARCH';
    this.modeMs = 0;
    this.path = [];
    this.scanMs = DRONE_SCAN_MS;
    this.setPath(this.lastKnownX, this.lastKnownY);
  }

  private enterDisengage(): void {
    this.mode = 'DISENGAGE';
    this.modeMs = 0;
    this.path = [];
    this.setPath(this.homeX, this.homeY);
  }

  private pickPatrol(): boolean {
    const startX = Math.round(this.posX);
    const startY = Math.round(this.posY);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const offsetX = Math.round((this.rng() * 2 - 1) * DRONE_PATROL_RADIUS);
      const offsetY = Math.round((this.rng() * 2 - 1) * DRONE_PATROL_RADIUS);
      const goalX = this.homeX + offsetX;
      const goalY = this.homeY + offsetY;

      if (!this.level.isWalkable(goalX, goalY)) continue;
      if (Math.hypot(goalX - this.posX, goalY - this.posY) < 1.5) continue;

      const path = findPath(this.level, startX, startY, goalX, goalY);
      if (path === null || path.length === 0) continue;

      this.path = path;
      return true;
    }

    return false;
  }

  private setPath(goalX: number, goalY: number): void {
    const path = findPath(this.level, Math.round(this.posX), Math.round(this.posY), goalX, goalY);
    this.path = path ?? [];
  }

  private followPath(dt: number, speed: number): void {
    this.advanceWaypoint();

    const target = this.path[0];
    if (!target) {
      this.path = [];
      return;
    }

    const from = gridVectorToWorld(this.posX, this.posY, TILE_WIDTH, TILE_HEIGHT);
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
      directionX * speed,
      directionY * speed,
      TILE_WIDTH,
      TILE_HEIGHT,
    );

    this.faceToward(velocity.x, velocity.y);

    if (!this.moveBy(velocity.x * dt, velocity.y * dt)) this.path = [];
  }

  private advanceWaypoint(): void {
    while (this.path.length > 1) {
      const target = this.path[0];
      if (!target) return;
      const distance = Math.hypot(target.gridX - this.posX, target.gridY - this.posY);
      if (distance > WAYPOINT_EPSILON) return;
      this.path.shift();
    }

    const target = this.path[0];
    if (!target) return;
    const distance = Math.hypot(target.gridX - this.posX, target.gridY - this.posY);
    if (distance <= WAYPOINT_EPSILON) this.path.shift();
  }

  private moveBy(stepX: number, stepY: number): boolean {
    let moved = false;

    const nextX = this.posX + stepX;
    if (!this.isBlocked(nextX, this.posY)) {
      if (Math.abs(nextX - this.posX) > 0.00001) moved = true;
      this.posX = nextX;
    }

    const nextY = this.posY + stepY;
    if (!this.isBlocked(this.posX, nextY)) {
      if (Math.abs(nextY - this.posY) > 0.00001) moved = true;
      this.posY = nextY;
    }

    return moved;
  }

  private isBlocked(gridX: number, gridY: number): boolean {
    const radius = this.spec.footprint;
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

  private audioGain(): number {
    const at = this.player.gridPosition;
    return distanceGain(this.posX, this.posY, at.x, at.y);
  }

  get isAiming(): boolean {
    return this.fireState === 'WINDUP';
  }

  get lightState(): DroneLightState {
    let kind: DroneLightKind = 'idle';
    if (this.dead) kind = 'wreck';
    else if (this.fireState === 'WINDUP') kind = 'aim';
    else if (this.mode === 'CHASE') kind = 'chase';
    else if (this.mode === 'SEARCH') kind = 'search';
    const deathAgeMs = this.dead ? this.scene.time.now - this.diedAt : 0;
    return { kind, facing: this.facing, deathAgeMs };
  }

  private updateFire(deltaMs: number, sees: boolean, distanceToPlayer: number): boolean {
    if (this.projectiles === null) return false;

    if (this.fireState === 'WINDUP') {
      const target = this.playerCell();
      this.path = [];
      this.faceToward(target.gridX - this.posX, target.gridY - this.posY);
      if (!sees) {
        this.fireState = 'NONE';
        this.fireCooldownMs = 600;
        return false;
      }
      this.fireMs += deltaMs;
      if (this.fireMs >= this.spec.fireWindupMs) {
        const at = this.player.gridPosition;
        const base = Math.atan2(at.y - this.posY, at.x - this.posX);
        for (let shot = 0; shot < this.spec.fan; shot += 1) {
          const angle = base + (shot - (this.spec.fan - 1) / 2) * this.spec.fanStep;
          this.projectiles.spawn(this.spec.shot, this.posX, this.posY, Math.cos(angle), Math.sin(angle), {
            damage: DRONE_BULLET_DAMAGE + this.tierSpec.damageBonus,
            speedMul: this.tierSpec.shotSpeedMul,
          });
        }
        sfx.play(this.spec.shot === 'shell' ? 'shell' : this.spec.shot === 'poison' ? 'spit' : 'droneShot', this.audioGain());
        this.fireState = 'RECOVER';
        this.fireMs = 0;
      }
      return true;
    }

    if (this.fireState === 'RECOVER') {
      this.fireMs += deltaMs;
      if (this.fireMs >= this.spec.fireRecoverMs) {
        this.fireState = 'NONE';
        this.fireCooldownMs = this.spec.fireCooldownMs * this.tierSpec.fireMul * fireCooldownScale(this.depthManager.floor, runFlags.alert);
      }
      return true;
    }

    const inRange =
      distanceToPlayer > this.spec.contactRange + 0.4 && distanceToPlayer <= this.spec.fireRange;
    if (sees && inRange && this.fireCooldownMs <= 0) {
      this.fireState = 'WINDUP';
      this.fireMs = 0;
      this.path = [];
      return true;
    }
    return false;
  }

  private updateDodge(deltaMs: number, dt: number): boolean {
    if (this.dodgeMs > 0) {
      this.dodgeMs -= deltaMs;
      this.moveBy(this.dodgeDirX * DRONE_DODGE_SPEED * dt, this.dodgeDirY * DRONE_DODGE_SPEED * dt);
      return true;
    }

    if (this.projectiles === null || !this.spec.dodges || this.dodgeCooldownMs > 0) return false;
    if (this.mode !== 'CHASE' && this.mode !== 'SEARCH') return false;

    for (const bullet of this.projectiles.active) {
      if (bullet.owner !== 'player') continue;
      const relX = this.posX - bullet.x;
      const relY = this.posY - bullet.y;
      const along = relX * bullet.dirX + relY * bullet.dirY;
      if (along <= 0 || along > DRONE_DODGE_SENSE_TILES) continue;
      const side = relX * -bullet.dirY + relY * bullet.dirX;
      if (Math.abs(side) > 0.7) continue;

      if (this.rng() >= DRONE_DODGE_CHANCE) {
        this.dodgeCooldownMs = DRONE_DODGE_RETRY_MS;
        return false;
      }

      const sign = this.rng() < 0.5 ? 1 : -1;
      for (const attempt of [sign, -sign]) {
        const dirX = -bullet.dirY * attempt;
        const dirY = bullet.dirX * attempt;
        if (this.isBlocked(this.posX + dirX * 0.9, this.posY + dirY * 0.9)) continue;
        this.dodgeDirX = dirX;
        this.dodgeDirY = dirY;
        this.dodgeMs = DRONE_DODGE_MS;
        this.dodgeCooldownMs = DRONE_DODGE_COOLDOWN_MS;
        this.fireState = 'NONE';
        this.path = [];
        return true;
      }
      this.dodgeCooldownMs = DRONE_DODGE_RETRY_MS;
      return false;
    }
    return false;
  }

  private onDeath(): void {
    this.diedAt = this.scene.time.now;
    this.fireState = 'NONE';
    this.shadow.setVisible(false);
    this.sprite.clearTint();
    this.sprite.setTexture(this.spec.deadKey);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.y = 0;
    this.sprite.setFlipX(this.rng() < 0.5);
    this.setDepth(this.isoY - WRECK_DEPTH_OFFSET);
    this.spawnDeathFx();
  }

  private spawnDeathFx(): void {
    const colors = [0xff5a2a, 0xffb060, 0xff3a22, 0xfff4d2];
    for (let index = 0; index < 9; index += 1) {
      const angle = this.rng() * Math.PI * 2;
      const distance = 10 + this.rng() * 18;
      const color = colors[index % colors.length] ?? 0xff5a2a;
      const spark = this.scene.add
        .circle(this.x, this.y - 14, 1.6 + this.rng() * 1.2, color, 1)
        .setDepth(DEPTH_VFX)
        .setBlendMode(BlendModes.ADD);
      this.scene.tweens.add({
        targets: spark,
        x: this.x + Math.cos(angle) * distance,
        y: this.y - 14 + Math.sin(angle) * distance * 0.6 - 6,
        alpha: 0,
        duration: 380 + this.rng() * 260,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
    for (let index = 0; index < 3; index += 1) {
      const smoke = this.scene.add
        .circle(this.x + (this.rng() - 0.5) * 10, this.y - 10, 4 + this.rng() * 3, 0x2a2e2e, 0.55)
        .setDepth(DEPTH_VFX - 1);
      this.scene.tweens.add({
        targets: smoke,
        y: smoke.y - 22 - this.rng() * 12,
        scaleX: 2.2,
        scaleY: 2.2,
        alpha: 0,
        duration: 1100 + this.rng() * 500,
        ease: 'Sine.easeOut',
        onComplete: () => smoke.destroy(),
      });
    }
  }

  private faceToward(stepX: number, stepY: number): void {
    if (Math.abs(stepX) < 0.00001 && Math.abs(stepY) < 0.00001) return;
    const next = facingForGridStep(stepX, stepY);
    if (next === this.facing) return;
    const now = this.scene.time.now;
    if (now < this.nextTurnAt) return;
    this.nextTurnAt = now + this.spec.turnMs;
    this.facing = next;
  }

  private isFrontalHit(travel: HitDirection): boolean {
    const length = Math.hypot(travel.x, travel.y);
    if (length < 0.0001) return false;
    const forward = DIRECTION_VECTOR[this.facing];
    const dot = (-travel.x / length) * forward.x + (-travel.y / length) * forward.y;
    return dot >= TANK_FRONT_COS;
  }

  private spawnDeflectFx(): void {
    const spark = this.scene.add
      .circle(this.x, this.y - 18 * this.spec.scale, 3, 0xe8f4ff, 0.95)
      .setDepth(DEPTH_VFX + 1)
      .setBlendMode(BlendModes.ADD);
    this.scene.tweens.add({
      targets: spark,
      alpha: 0,
      scaleX: 2.6,
      scaleY: 2.6,
      y: spark.y - 8,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  private syncTransform(): void {
    const world = gridVectorToWorld(this.posX, this.posY, TILE_WIDTH, TILE_HEIGHT);
    this.setPosition(world.x, world.y);
    this.isoX = world.x;
    this.isoY = world.y;
    this.gridX = Math.round(this.posX);
    this.gridY = Math.round(this.posY);
    this.setDepth(world.y);
  }

  private updateArmorBar(): void {
    const ratio = this.maxArmorHp > 0 ? Math.max(0, this.armorHp / this.maxArmorHp) : 0;
    this.armorBarFill.setScale(ratio, 1);
    const visible = this.armorHp > 0 && !this.dead;
    this.armorBarBack.setVisible(visible);
    this.armorBarFill.setVisible(visible);
  }

  private spawnArmorBreakFx(): void {
    for (let index = 0; index < 8; index += 1) {
      const angle = this.rng() * Math.PI * 2;
      const spark = this.scene.add
        .circle(this.x, this.y - 18 * this.spec.scale, 2, 0xcfe6ff, 1)
        .setDepth(DEPTH_VFX + 1)
        .setBlendMode(BlendModes.ADD);
      this.scene.tweens.add({
        targets: spark,
        x: this.x + Math.cos(angle) * 22,
        y: spark.y + Math.sin(angle) * 14,
        alpha: 0,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  get summonReady(): boolean {
    return this.summonPending;
  }

  consumeSummon(): void {
    this.summonPending = false;
  }

  private updateHealthBar(): void {
    const ratio = this.maxHp > 0 ? Math.max(0, Math.min(1, this.hp / this.maxHp)) : 0;
    this.healthBarFill.setScale(ratio, 1);
  }

  private setHealthBarVisible(visible: boolean): void {
    this.healthBarBack.setVisible(visible);
    this.healthBarFill.setVisible(visible);
    for (const mark of this.tierMarks) mark.setVisible(visible);
    if (!visible) {
      this.armorBarBack.setVisible(false);
      this.armorBarFill.setVisible(false);
    }
  }

  private updateVisual(): void {
    const bob = Math.sin(this.scene.time.now * 0.0035 + this.bobPhase) * this.spec.bob;
    this.sprite.y = -2 + bob;
    this.shadow.setScale((0.8 - bob * 0.02) * this.spec.scale, 0.8 * this.spec.scale);

    if (this.dormant) this.sprite.setTint(0x5a4a4a);
    else if (this.fireState === 'WINDUP') {
      this.sprite.setTint(Math.floor(this.scene.time.now / 70) % 2 === 0 ? 0xff2a1a : 0xffb0a0);
    } else if (this.mode === 'CHASE') this.sprite.setTint(this.spec.chaseTint);
    else if (this.mode === 'SEARCH') this.sprite.setTint(0xd9a441);
    else if (this.spec.idleTint !== null) this.sprite.setTint(this.spec.idleTint);
    else this.sprite.clearTint();

    this.applyFacingFrame();
  }

  private applyFacingFrame(): void {
    const frame = DRONE_FRAME[this.facing];
    if (this.visualFrame === frame) return;
    this.visualFrame = frame;
    this.sprite.setTexture(this.spec.spriteKey, frame);
  }

  destroy(fromScene?: boolean): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.removeAll(true);
    super.destroy(fromScene);
  }
}
