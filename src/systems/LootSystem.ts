import type { Scene } from 'phaser';
import { LOOT_DROP_CHANCE, LOOT_HEAL_AMOUNT, LOOT_PICKUP_RANGE } from '../data/config';
import type { Player } from '../entities/Player';
import { LootPickup } from '../entities/props/LootPickup';
import { createRng } from '../utils/random';
import type { Dungeon } from './DungeonGen';
import type { Level } from './Level';

const LOOT_SEED = 0x1097;

export class LootSystem {
  private readonly scene: Scene;
  private readonly level: Level;
  private readonly rng: () => number;
  private readonly items: LootPickup[] = [];
  private guaranteedDrop = true;

  constructor(scene: Scene, level: Level, dungeon: Dungeon) {
    this.scene = scene;
    this.level = level;
    this.rng = createRng(dungeon.seed ^ LOOT_SEED);
  }

  get pickups(): readonly LootPickup[] {
    return this.items;
  }

  roll(gridX: number, gridY: number): LootPickup | null {
    const x = Math.round(gridX);
    const y = Math.round(gridY);
    if (!this.level.isWalkable(x, y)) return null;
    if (this.items.some((item) => item.gridX === x && item.gridY === y)) return null;

    if (!this.guaranteedDrop && this.rng() > LOOT_DROP_CHANCE) return null;
    this.guaranteedDrop = false;

    const pickup = new LootPickup(this.scene, x, y);
    this.items.push(pickup);
    return pickup;
  }

  update(player: Player): void {
    const { hp, maxHp } = player.getHealth();
    if (hp <= 0 || hp >= maxHp) return;

    const grid = player.gridPosition;
    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      const item = this.items[index];
      if (!item) continue;
      if (item.isCollected) {
        this.items.splice(index, 1);
        continue;
      }

      const distance = Math.hypot(item.gridX - grid.x, item.gridY - grid.y);
      if (distance > LOOT_PICKUP_RANGE) continue;

      item.collect();
      player.heal(LOOT_HEAL_AMOUNT);
      this.items.splice(index, 1);
      return;
    }
  }

  destroy(): void {
    for (const item of this.items) item.destroy();
    this.items.length = 0;
  }
}
