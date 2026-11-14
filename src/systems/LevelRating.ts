import { PISTOL_AMMO_START, PISTOL_DAMAGE } from '../data/config';
import { fireCooldownScale, scaledAmmoDrop, scaledEnemyHp } from '../data/difficulty';
import { ENEMY_SPECS, bossForFloor, droneCountForFloor, tankCountForFloor, type EnemyKind } from '../data/enemies';
import { steamCount } from '../data/hazards';

const ARMOR_WEIGHT = 0.6;
const BASE_FIREPOWER = 0.5;
const IMMOBILE_FACTOR = 0.8;
const BASE_COOLDOWN_MS = 2400;
const VENT_THREAT = 1.5;
const SUMMON_SHARE = 1;

export interface RatingInput {
  readonly floor: number;
  readonly enemies: readonly { readonly kind: EnemyKind }[];
  readonly ventCount: number;
  readonly lootAmmo: number;
  readonly lootStims: number;
}

export interface LevelRating {
  readonly total: number;
  readonly enemyThreat: number;
  readonly hazardThreat: number;
  readonly counts: Readonly<Record<EnemyKind, number>>;
  readonly ammoSupply: number;
  readonly ammoNeeded: number;
  readonly stims: number;
}

export function enemyThreat(kind: EnemyKind, floor: number): number {
  const spec = ENEMY_SPECS[kind];
  const hp = spec.boss ? spec.maxHp : scaledEnemyHp(spec.maxHp, floor);
  const durability = hp + spec.armorHp * ARMOR_WEIGHT;
  const firepower = (spec.fan * BASE_COOLDOWN_MS) / (spec.fireCooldownMs * fireCooldownScale(floor, 0));
  const mobility = spec.chaseSpeed > 0 ? 1 : IMMOBILE_FACTOR;
  return durability * (BASE_FIREPOWER + firepower) * mobility;
}

export function rateLevel(input: RatingInput): LevelRating {
  const counts: Record<EnemyKind, number> = { drone: 0, tank: 0, assembler: 0, warden: 0 };
  let enemies = 0;
  let ammoNeeded = 0;
  let ammoDrops = 0;
  for (const enemy of input.enemies) {
    counts[enemy.kind] += 1;
    const spec = ENEMY_SPECS[enemy.kind];
    enemies += enemyThreat(enemy.kind, input.floor);
    if (spec.boss) enemies += spec.summonCap * SUMMON_SHARE * enemyThreat('drone', input.floor);
    const hp = spec.boss ? spec.maxHp : scaledEnemyHp(spec.maxHp, input.floor);
    ammoNeeded += (hp + spec.armorHp) / PISTOL_DAMAGE;
    ammoDrops += scaledAmmoDrop(spec.ammoDrop, input.floor);
  }
  const hazardThreat = input.ventCount * VENT_THREAT;
  return {
    total: enemies + hazardThreat,
    enemyThreat: enemies,
    hazardThreat,
    counts,
    ammoSupply: PISTOL_AMMO_START + input.lootAmmo + ammoDrops,
    ammoNeeded,
    stims: input.lootStims,
  };
}

export function formulaTarget(floor: number): LevelRating {
  const enemies: { kind: EnemyKind }[] = [];
  const boss = bossForFloor(floor);
  if (boss) enemies.push({ kind: boss });
  for (let index = 0; index < droneCountForFloor(floor); index += 1) enemies.push({ kind: 'drone' });
  for (let index = 0; index < tankCountForFloor(floor); index += 1) enemies.push({ kind: 'tank' });
  return rateLevel({ floor, enemies, ventCount: steamCount(floor), lootAmmo: 0, lootStims: 0 });
}
