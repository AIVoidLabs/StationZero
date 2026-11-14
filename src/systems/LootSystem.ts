import type { GameObjects, Scene } from 'phaser';
import {
  DEPTH_VFX,
  FLOOR_LOOT_BASE,
  FLOOR_LOOT_MIN,
  LOOT_AMMO_AMOUNT,
  LOOT_DROP_CHANCE,
  LOOT_DROP_CHANCE_MIN,
  LOOT_DROP_DEPTH_STEP,
  LOOT_PICKUP_RANGE,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../data/config';
import { t } from '../i18n';
import type { Player } from '../entities/Player';
import { LootPickup, type LootKind } from '../entities/props/LootPickup';
import { gridVectorToWorld } from '../utils/iso';
import { createRng } from '../utils/random';
import type { Dungeon } from './DungeonGen';
import type { Level } from './Level';
import { sfx } from './Sfx';
import { upgradeStats } from './Upgrades';

const LOOT_SEED = 0x1097;
const FLOOR_LOOT_SEED = 0x2b3c;
const SPAWN_CLEARANCE = 5;
const TEXT_COLORS: Record<LootKind, string> = { stim: '#8fe8ae', ammo: '#f0c070' };
const HOVER_RADIUS_PX = 20;
const HOVER_LABEL_OFFSET_Y = 34;

interface Cell {
  readonly x: number;
  readonly y: number;
}

export class LootSystem {
  private readonly scene: Scene;
  private readonly level: Level;
  private readonly player: Player;
  private readonly rng: () => number;
  private readonly items: LootPickup[] = [];
  private readonly dropChance: number;
  private hoverLabel: GameObjects.Text | null = null;
  private hovered: LootPickup | null = null;

  constructor(scene: Scene, level: Level, dungeon: Dungeon, player: Player) {
    this.scene = scene;
    this.level = level;
    this.player = player;
    this.rng = createRng(dungeon.seed ^ LOOT_SEED);
    this.dropChance = Math.max(LOOT_DROP_CHANCE_MIN, LOOT_DROP_CHANCE - dungeon.floor * LOOT_DROP_DEPTH_STEP);
    this.placeFloorLoot(dungeon);
  }

  get pickups(): readonly LootPickup[] {
    return this.items;
  }

  roll(gridX: number, gridY: number, ammoDrop: number): void {
    const x = Math.round(gridX);
    const y = Math.round(gridY);
    if (ammoDrop > 0) {
      const cell = this.freeCellNear(x, y);
      if (cell) this.spawn(cell.x, cell.y, 'ammo', ammoDrop);
    }

    const state = this.player.getHealth();
    if (state.hp >= state.maxHp || this.rng() > this.dropChance) return;
    const cell = this.freeCellNear(x, y);
    if (cell) this.spawn(cell.x, cell.y, 'stim');
  }

  hoverAt(worldX: number | null, worldY: number, player: Player): void {
    let best: LootPickup | null = null;
    if (worldX !== null) {
      let bestDistance = HOVER_RADIUS_PX;
      for (const item of this.items) {
        if (item.isCollected) continue;
        const distance = Math.hypot(item.x - worldX, item.y - 8 - worldY);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = item;
        }
      }
    }

    if (best !== this.hovered) {
      this.hovered?.setHighlight(false);
      this.hovered = best;
      best?.setHighlight(true);
    }

    if (!best) {
      this.hoverLabel?.setVisible(false);
      return;
    }

    const label = this.ensureLabel();
    const state = player.getHealth();
    const full = best.kind === 'stim' ? state.hp >= state.maxHp : state.ammo >= state.maxAmmo;
    const effect =
      best.kind === 'stim'
        ? t('loot.stimEffect', { n: upgradeStats().stimHeal })
        : t('loot.ammoEffect', { n: best.amount || LOOT_AMMO_AMOUNT });
    const name = best.kind === 'stim' ? t('loot.stim') : t('loot.ammo');
    label
      .setText(`${name}\n${effect}${full ? `  ${t('loot.full')}` : ''}`)
      .setColor(full ? '#9a8f7c' : TEXT_COLORS[best.kind])
      .setPosition(best.x, best.y - HOVER_LABEL_OFFSET_Y)
      .setVisible(true);
  }

  private ensureLabel(): GameObjects.Text {
    if (!this.hoverLabel) {
      this.hoverLabel = this.scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#f0c070',
          align: 'center',
          resolution: 2,
          stroke: '#050505',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH_VFX + 8)
        .setVisible(false);
    }
    return this.hoverLabel;
  }

  spawnNear(gridX: number, gridY: number, kind: LootKind): void {
    const cell = this.freeCellNear(Math.round(gridX), Math.round(gridY));
    if (cell) this.spawn(cell.x, cell.y, kind);
  }

  update(player: Player): void {
    if (player.isDeadState) return;
    const grid = player.gridPosition;

    for (let index = this.items.length - 1; index >= 0; index -= 1) {
      const item = this.items[index];
      if (!item) continue;
      if (item.isCollected) {
        this.items.splice(index, 1);
        continue;
      }

      if (Math.hypot(item.gridX - grid.x, item.gridY - grid.y) > LOOT_PICKUP_RANGE) continue;

      const text = this.apply(item.kind, item.amount, player);
      if (text === null) continue;

      item.collect();
      this.items.splice(index, 1);
      this.floatText(text, item.kind, grid.x, grid.y);
    }
  }

  destroy(): void {
    this.hoverLabel?.destroy();
    this.hoverLabel = null;
    this.hovered = null;
    for (const item of this.items) item.destroy();
    this.items.length = 0;
  }

  private apply(kind: LootKind, amount: number, player: Player): string | null {
    const state = player.getHealth();
    if (kind === 'stim') {
      if (state.hp >= state.maxHp) return null;
      const heal = upgradeStats().stimHeal;
      player.heal(heal);
      sfx.play('pickupHealth');
      return t('loot.gainHp', { n: heal });
    }
    if (state.ammo >= state.maxAmmo) return null;
    const added = player.addAmmo(amount || LOOT_AMMO_AMOUNT);
    if (added > 0) sfx.play('pickupAmmo');
    return added > 0 ? t('loot.gainAmmo', { n: added }) : null;
  }

  private floatText(text: string, kind: LootKind, gridX: number, gridY: number): void {
    const world = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
    const label = this.scene.add
      .text(world.x, world.y - 40, text, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: TEXT_COLORS[kind],
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_VFX + 5);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 14,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private spawn(x: number, y: number, kind: LootKind, amount = 0): LootPickup {
    const pickup = new LootPickup(this.scene, x, y, kind, amount);
    this.items.push(pickup);
    return pickup;
  }

  private freeCellNear(x: number, y: number): Cell | null {
    const offsets: readonly (readonly [number, number])[] = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of offsets) {
      const cx = x + dx;
      const cy = y + dy;
      if (!this.level.isWalkable(cx, cy)) continue;
      if (this.items.some((item) => item.gridX === cx && item.gridY === cy)) continue;
      return { x: cx, y: cy };
    }
    return null;
  }

  private placeFloorLoot(dungeon: Dungeon): void {
    const rng = createRng(dungeon.seed ^ FLOOR_LOOT_SEED);
    const target = Math.max(FLOOR_LOOT_MIN, Math.round(FLOOR_LOOT_BASE - dungeon.floor / 2));
    const roomCells: Cell[] = [];
    const deadEnds: Cell[] = [];

    const farFromSpawn = (x: number, y: number): boolean =>
      Math.hypot(x - this.level.spawnX, y - this.level.spawnY) >= SPAWN_CLEARANCE;
    const isExit = (x: number, y: number): boolean =>
      dungeon.exit !== null && dungeon.exit.x === x && dungeon.exit.y === y;

    for (const room of dungeon.rooms) {
      for (let y = room.y; y < room.y + room.height; y += 1) {
        for (let x = room.x; x < room.x + room.width; x += 1) {
          if (!this.level.isWalkable(x, y) || isExit(x, y) || !farFromSpawn(x, y)) continue;
          roomCells.push({ x, y });
        }
      }
    }

    for (let y = 0; y < this.level.height; y += 1) {
      for (let x = 0; x < this.level.width; x += 1) {
        if (!this.level.isWalkable(x, y) || isExit(x, y) || !farFromSpawn(x, y)) continue;
        const open =
          Number(this.level.isWalkable(x + 1, y)) +
          Number(this.level.isWalkable(x - 1, y)) +
          Number(this.level.isWalkable(x, y + 1)) +
          Number(this.level.isWalkable(x, y - 1));
        if (open <= 1) deadEnds.push({ x, y });
      }
    }

    for (let index = 0; index < target; index += 1) {
      const pool = deadEnds.length > 0 && rng() < 0.3 ? deadEnds : roomCells;
      if (pool.length === 0) break;
      const pick = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      if (!pick) continue;
      this.spawn(pick.x, pick.y, index % 2 === 0 ? 'ammo' : 'stim');
    }
  }
}
