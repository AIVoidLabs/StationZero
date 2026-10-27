import type { GameObjects, Scene } from 'phaser';
import { DRONE_FRAME, DRONE_SPRITE_KEY, type Direction } from '../../assets/manifest';
import {
  DRONE_CHASE_LEASH,
  DRONE_CHASE_MAX_MS,
  DRONE_CHASE_SPEED,
  DRONE_CONTACT_RANGE,
  DRONE_DISENGAGE_GRACE_MS,
  DRONE_DISENGAGE_SIGHT_SCALE,
  DRONE_FOOTPRINT,
  DRONE_HEIGHT,
  DRONE_IDLE_MAX_MS,
  DRONE_IDLE_MIN_MS,
  DRONE_LOSE_SIGHT_MS,
  DRONE_PATROL_RADIUS,
  DRONE_PERIPHERAL_RANGE,
  DRONE_REPATH_MS,
  DRONE_RETURN_SPEED,
  DRONE_SCAN_MS,
  DRONE_SEARCH_MS,
  DRONE_SIGHT_RANGE,
  DRONE_SPEED,
  DRONE_VIEW_COSINE,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../../data/config';
import type { Level } from '../../systems/Level';
import type { DepthManager } from '../../systems/DepthManager';
import { hasLineOfSight, type GridCell } from '../../systems/Los';
import { findPath, type GridPoint } from '../../systems/Pathfinding';
import { DRONE_MAX_HP } from '../../data/config';
import { DIRECTION_VECTOR, DIRECTIONS, facingForGridStep } from '../../utils/facing';
import { gridVectorToWorld, worldVectorToGrid } from '../../utils/iso';
import type { Player } from '../Player';
import { Entity } from '../Entity';
import { createRng } from '../../utils/random';

export type DroneState = 'IDLE' | 'PATROL' | 'CHASE' | 'SEARCH' | 'DISENGAGE';

const WAYPOINT_EPSILON = 0.08;
const MAX_STEP_SECONDS = 0.05;
const HEALTH_BAR_WIDTH = 24;
const HEALTH_BAR_HEIGHT = 3;
const HEALTH_BAR_Y = -DRONE_HEIGHT - 6;

export class Drone extends Entity {
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
  private visualKey = '';
  private visualFrame = -1;

  private hp: number;
  private maxHp: number;
  private dead = false;
  private lastDamageAt = -1000000;

  constructor(
    scene: Scene,
    level: Level,
    player: Player,
    depth: DepthManager,
    homeX: number,
    homeY: number,
    seed: number,
  ) {
    const iso = gridVectorToWorld(homeX, homeY, TILE_WIDTH, TILE_HEIGHT);
    super(scene, iso.x, iso.y, { gridX: homeX, gridY: homeY, isoX: iso.x, isoY: iso.y });

    this.level = level;
    this.player = player;
    this.depthManager = depth;
    this.rng = createRng(seed);
    this.homeX = homeX;
    this.homeY = homeY;
    this.lastKnownX = homeX;
    this.lastKnownY = homeY;
    this.posX = homeX;
    this.posY = homeY;
    this.bobPhase = this.rng() * Math.PI * 2;
    this.idleMs = DRONE_IDLE_MIN_MS + this.rng() * (DRONE_IDLE_MAX_MS - DRONE_IDLE_MIN_MS);

    this.hp = DRONE_MAX_HP;
    this.maxHp = DRONE_MAX_HP;
    this.dead = false;

    this.shadow = scene.add.image(0, 0, 'shadow').setOrigin(0.5, 0.5).setScale(0.8).setAlpha(0.65);

    const hasAtlas = scene.textures.exists(DRONE_SPRITE_KEY);
    this.sprite = hasAtlas
      ? scene.add.image(0, 0, DRONE_SPRITE_KEY, DRONE_FRAME[this.facing])
      : scene.add.image(0, 0, `drone_${this.facing}`);
    this.visualKey = hasAtlas ? DRONE_SPRITE_KEY : `drone_${this.facing}`;
    this.visualFrame = hasAtlas ? DRONE_FRAME[this.facing] : -1;
    this.sprite.setOrigin(0.5, 1);
    this.healthBarBack = scene.add
      .rectangle(0, HEALTH_BAR_Y, HEALTH_BAR_WIDTH + 2, HEALTH_BAR_HEIGHT + 2, 0x0a0a0a, 0.9)
      .setOrigin(0.5, 0.5);
    this.healthBarFill = scene.add
      .rectangle(-HEALTH_BAR_WIDTH / 2, HEALTH_BAR_Y, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT, 0x6fae4f, 1)
      .setOrigin(0, 0.5);
    this.add([this.shadow, this.sprite, this.healthBarBack, this.healthBarFill]);
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

  get health(): { hp: number; maxHp: number } {
    return { hp: this.hp, maxHp: this.maxHp };
  }

  takeDamage(amount: number): boolean {
    if (this.dead) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.setHealthBarVisible(false);
    } else {
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
      this.sprite.setVisible(false);
      this.shadow.setVisible(false);
      this.setHealthBarVisible(false);
      return;
    }
    const dt = Math.min(deltaMs, MAX_STEP_SECONDS * 1000) / 1000;
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

    this.followPath(dt, DRONE_SPEED);
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
    if (distanceToPlayer <= DRONE_CONTACT_RANGE) {
      this.path = [];
      this.faceToward(target.gridX - this.posX, target.gridY - this.posY);
      return;
    }

    if (this.repathMs <= 0) {
      this.repathMs = DRONE_REPATH_MS;
      this.setPath(target.gridX, target.gridY);
    }

    this.followPath(dt, DRONE_CHASE_SPEED);
  }

  private updateSearch(dt: number): void {
    if (this.tryAggro(1)) return;

    if (this.modeMs > DRONE_SEARCH_MS) {
      this.enterDisengage();
      return;
    }

    if (this.path.length > 0) {
      this.followPath(dt, DRONE_SPEED);
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

    this.followPath(dt, DRONE_RETURN_SPEED);
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

    if (distance > DRONE_SIGHT_RANGE * rangeScale * awareness) return false;
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
    const radius = DRONE_FOOTPRINT;
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

  private faceToward(stepX: number, stepY: number): void {
    if (Math.abs(stepX) < 0.00001 && Math.abs(stepY) < 0.00001) return;
    this.facing = facingForGridStep(stepX, stepY);
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

  private updateHealthBar(): void {
    const ratio = this.maxHp > 0 ? Math.max(0, Math.min(1, this.hp / this.maxHp)) : 0;
    this.healthBarFill.setScale(ratio, 1);
  }

  private setHealthBarVisible(visible: boolean): void {
    this.healthBarBack.setVisible(visible);
    this.healthBarFill.setVisible(visible);
  }

  private updateVisual(): void {
    const bob = Math.sin(this.scene.time.now * 0.0035 + this.bobPhase) * 1.4;
    this.sprite.y = -2 + bob;
    this.shadow.setScale(0.8 - bob * 0.02, 0.8);

    if (this.mode === 'CHASE') this.sprite.setTint(0xff7a5a);
    else if (this.mode === 'SEARCH') this.sprite.setTint(0xd9a441);
    else this.sprite.clearTint();

    this.applyFacingFrame();
  }

  private applyFacingFrame(): void {
    const hasAtlas = this.scene.textures.exists(DRONE_SPRITE_KEY);
    const key = hasAtlas ? DRONE_SPRITE_KEY : `drone_${this.facing}`;
    const frame = hasAtlas ? DRONE_FRAME[this.facing] : -1;

    if (this.visualKey === key && this.visualFrame === frame) return;
    this.visualKey = key;
    this.visualFrame = frame;

    if (frame >= 0) {
      this.sprite.setTexture(key, frame);
      return;
    }

    this.sprite.setTexture(key);
  }

  destroy(fromScene?: boolean): void {
    this.sprite.destroy();
    this.shadow.destroy();
    this.removeAll(true);
    super.destroy(fromScene);
  }
}
