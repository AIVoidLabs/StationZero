import { BlendModes, type GameObjects, type Scene } from 'phaser';
import { DEPTH_FLOOR, DEPTH_VFX, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import type { Drone } from '../entities/enemies/Drone';
import type { Player } from '../entities/Player';
import { gridVectorToWorld } from '../utils/iso';
import type { Level } from './Level';
import type { LightSource } from './LightMap';
import { settings } from './Settings';
import { distanceGain, sfx } from './Sfx';

const BLAST_RADIUS = 2.2;
const ENEMY_DAMAGE = 3;
const PLAYER_DAMAGE = 2;
const CHAIN_DELAY_MS = 140;
const FLASH_MS = 420;
const SHAKE_MS = 200;
const SHAKE_INTENSITY = 0.009;

export interface BarrelCell {
  readonly x: number;
  readonly y: number;
  readonly image: GameObjects.Image;
}

interface Flash {
  readonly x: number;
  readonly y: number;
  age: number;
}

export class Barrels {
  private readonly scene: Scene;
  private readonly level: Level;
  private readonly player: Player;
  private readonly getEnemies: () => readonly Drone[];
  private readonly barrels: BarrelCell[];
  private readonly exploded = new Set<BarrelCell>();
  private readonly flashes: Flash[] = [];
  private readonly scorches: GameObjects.Ellipse[] = [];

  constructor(
    scene: Scene,
    level: Level,
    player: Player,
    getEnemies: () => readonly Drone[],
    barrels: readonly BarrelCell[],
  ) {
    this.scene = scene;
    this.level = level;
    this.player = player;
    this.getEnemies = getEnemies;
    this.barrels = [...barrels];
  }

  hitCell(gridX: number, gridY: number): void {
    const barrel = this.barrels.find((item) => item.x === gridX && item.y === gridY && !this.exploded.has(item));
    if (barrel) this.explode(barrel);
  }

  update(deltaMs: number): void {
    for (let index = this.flashes.length - 1; index >= 0; index -= 1) {
      const flash = this.flashes[index];
      if (!flash) continue;
      flash.age += deltaMs;
      if (flash.age >= FLASH_MS) this.flashes.splice(index, 1);
    }
  }

  emitLights(emit: (light: LightSource) => void): void {
    for (const flash of this.flashes) {
      const fade = 1 - flash.age / FLASH_MS;
      const world = gridVectorToWorld(flash.x, flash.y, TILE_WIDTH, TILE_HEIGHT);
      emit({ x: world.x, y: world.y - 12, radius: 170 * (0.6 + fade * 0.6), intensity: 1.1 * fade, tint: 'ember' });
      emit({ x: world.x, y: world.y - 12, radius: 90 * fade, intensity: 0.9 * fade, tint: 'warm' });
    }
  }

  destroy(): void {
    for (const scorch of this.scorches) scorch.destroy();
    this.scorches.length = 0;
    this.flashes.length = 0;
    this.exploded.clear();
    this.barrels.length = 0;
  }

  private explode(barrel: BarrelCell): void {
    this.exploded.add(barrel);
    this.level.unblockCell(barrel.x, barrel.y);
    barrel.image.setVisible(false).setActive(false);
    this.flashes.push({ x: barrel.x, y: barrel.y, age: 0 });

    const at = this.player.gridPosition;
    sfx.play('explosion', distanceGain(barrel.x, barrel.y, at.x, at.y));
    if (settings.data.screenShake) this.scene.cameras.main.shake(SHAKE_MS, SHAKE_INTENSITY);

    this.spawnEffects(barrel);

    for (const enemy of this.getEnemies()) {
      if (enemy.isDead) continue;
      const position = enemy.gridPosition;
      if (Math.hypot(position.x - barrel.x, position.y - barrel.y) <= BLAST_RADIUS) enemy.takeDamage(ENEMY_DAMAGE);
    }

    if (!this.player.isDeadState && Math.hypot(at.x - barrel.x, at.y - barrel.y) <= BLAST_RADIUS) {
      this.player.takeDamage(PLAYER_DAMAGE, this.scene.time.now, { x: at.x - barrel.x, y: at.y - barrel.y });
    }

    for (const other of this.barrels) {
      if (this.exploded.has(other)) continue;
      if (Math.hypot(other.x - barrel.x, other.y - barrel.y) > BLAST_RADIUS) continue;
      this.exploded.add(other);
      this.scene.time.delayedCall(CHAIN_DELAY_MS, () => {
        this.exploded.delete(other);
        this.explode(other);
      });
    }
  }

  private spawnEffects(barrel: BarrelCell): void {
    const world = gridVectorToWorld(barrel.x, barrel.y, TILE_WIDTH, TILE_HEIGHT);

    const scorch = this.scene.add.ellipse(world.x, world.y, 44, 22, 0x0a0806, 0.75).setDepth(DEPTH_FLOOR + 3);
    this.scorches.push(scorch);

    const ring = this.scene.add
      .ellipse(world.x, world.y, 20, 10, 0xffb060, 0.9)
      .setDepth(DEPTH_VFX)
      .setBlendMode(BlendModes.ADD);
    this.scene.tweens.add({
      targets: ring,
      scaleX: BLAST_RADIUS * 4.4,
      scaleY: BLAST_RADIUS * 4.4,
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    const core = this.scene.add
      .circle(world.x, world.y - 10, 14, 0xfff0c0, 1)
      .setDepth(DEPTH_VFX + 1)
      .setBlendMode(BlendModes.ADD);
    this.scene.tweens.add({
      targets: core,
      scaleX: 2.8,
      scaleY: 2.8,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => core.destroy(),
    });

    for (let index = 0; index < 14; index += 1) {
      const angle = (index / 14) * Math.PI * 2 + Math.random() * 0.4;
      const reach = 26 + Math.random() * 34;
      const spark = this.scene.add
        .circle(world.x, world.y - 10, 1.8 + Math.random() * 1.6, index % 2 === 0 ? 0xff7a2a : 0xffd070, 1)
        .setDepth(DEPTH_VFX)
        .setBlendMode(BlendModes.ADD);
      this.scene.tweens.add({
        targets: spark,
        x: world.x + Math.cos(angle) * reach,
        y: world.y - 10 + Math.sin(angle) * reach * 0.6 - 10,
        alpha: 0,
        duration: 420 + Math.random() * 260,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }

    for (let index = 0; index < 5; index += 1) {
      const smoke = this.scene.add
        .circle(world.x + (Math.random() - 0.5) * 18, world.y - 8, 6 + Math.random() * 4, 0x2a2826, 0.6)
        .setDepth(DEPTH_VFX - 1);
      this.scene.tweens.add({
        targets: smoke,
        y: smoke.y - 30 - Math.random() * 20,
        scaleX: 2.6,
        scaleY: 2.6,
        alpha: 0,
        duration: 1100 + Math.random() * 600,
        ease: 'Sine.easeOut',
        onComplete: () => smoke.destroy(),
      });
    }
  }
}
