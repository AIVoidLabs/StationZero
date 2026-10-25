import type { GameObjects, Scene } from 'phaser';
import type { Direction } from '../assets/manifest';
import {
  DEPTH_MARKER,
  PLAYER_BOB_PX,
  PLAYER_FOOTPRINT,
  PLAYER_SPEED,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../data/config';
import type { Level } from '../systems/Level';
import { findPath, type GridPoint } from '../systems/Pathfinding';
import { gridVectorToWorld, worldVectorToGrid } from '../utils/iso';
import { Entity } from './Entity';

const WAYPOINT_EPSILON = 0.08;
const CARDINAL_RATIO = 2.2;
const BOB_RATE = 12;
const MAX_STEP_SECONDS = 0.05;

export interface MoveInput {
  readonly x: number;
  readonly y: number;
}

function facingForGridStep(stepX: number, stepY: number): Direction {
  const absX = Math.abs(stepX);
  const absY = Math.abs(stepY);

  if (absX > absY * CARDINAL_RATIO) return stepX > 0 ? 'SE' : 'NW';
  if (absY > absX * CARDINAL_RATIO) return stepY > 0 ? 'SW' : 'NE';
  if (stepX > 0) return stepY > 0 ? 'S' : 'E';
  return stepY > 0 ? 'W' : 'N';
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
  private bobPhase = 0;
  private moving = false;
  private leadX = 0;
  private leadY = 0;

  constructor(scene: Scene, level: Level, gridX: number, gridY: number) {
    const iso = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);

    super(scene, iso.x, iso.y, { gridX, gridY, isoX: iso.x, isoY: iso.y });

    this.level = level;
    this.gridPosX = gridX;
    this.gridPosY = gridY;

    this.shadow = scene.add.image(0, 0, 'shadow').setOrigin(0.5, 0.5);
    this.sprite = scene.add.image(0, 0, `player_${this.facing}`).setOrigin(0.5, 1);
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
    const hasInput = input !== null && (input.x !== 0 || input.y !== 0);
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

    this.updateBob(dt);
  }

  setDestination(gridX: number, gridY: number): void {
    const startX = Math.round(this.gridPosX);
    const startY = Math.round(this.gridPosY);
    const path = findPath(this.level, startX, startY, gridX, gridY);

    if (path === null) {
      this.showMarker(gridX, gridY, false);
      return;
    }

    this.path = path;
    this.showMarker(gridX, gridY, true);
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

  private faceToward(stepX: number, stepY: number): void {
    if (Math.abs(stepX) < 0.00001 && Math.abs(stepY) < 0.00001) return;
    const next = facingForGridStep(stepX, stepY);
    if (next === this.facing) return;
    this.facing = next;
    this.sprite.setTexture(`player_${next}`);
  }

  private updateBob(dt: number): void {
    if (this.moving) {
      this.bobPhase += dt * BOB_RATE;
      this.sprite.y = -Math.abs(Math.sin(this.bobPhase)) * PLAYER_BOB_PX;
      return;
    }

    this.bobPhase = 0;
    this.sprite.y += (0 - this.sprite.y) * Math.min(1, dt * 14);
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
