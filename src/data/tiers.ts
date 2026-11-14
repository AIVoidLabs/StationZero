import type { StringKey } from '../i18n';

export type EnemyTier = 'novice' | 'journeyman' | 'master';

export const ENEMY_TIERS: readonly EnemyTier[] = ['novice', 'journeyman', 'master'];

export interface TierSpec {
  readonly nameKey: StringKey;
  readonly hpMul: number;
  readonly damageBonus: number;
  readonly fireMul: number;
  readonly speedMul: number;
  readonly shotSpeedMul: number;
  readonly senseMul: number;
  readonly armorBonus: number;
  readonly xp: number;
  readonly stripes: 0 | 1 | 2;
}

export const TIER_SPECS: Readonly<Record<EnemyTier, TierSpec>> = {
  novice: {
    nameKey: 'tier.novice',
    hpMul: 1,
    damageBonus: 0,
    fireMul: 1,
    speedMul: 1,
    shotSpeedMul: 1,
    senseMul: 1,
    armorBonus: 0,
    xp: 10,
    stripes: 0,
  },
  journeyman: {
    nameKey: 'tier.journeyman',
    hpMul: 1.3,
    damageBonus: 0,
    fireMul: 0.9,
    speedMul: 1.06,
    shotSpeedMul: 1.1,
    senseMul: 1.1,
    armorBonus: 0,
    xp: 25,
    stripes: 1,
  },
  master: {
    nameKey: 'tier.master',
    hpMul: 1.7,
    damageBonus: 1,
    fireMul: 0.8,
    speedMul: 1.12,
    shotSpeedMul: 1.15,
    senseMul: 1.15,
    armorBonus: 1,
    xp: 60,
    stripes: 2,
  },
};

export const BOSS_XP = 150;
const JOURNEYMAN_PER_FLOOR = 0.03;
const JOURNEYMAN_MAX = 0.3;
const MASTER_FROM_FLOOR = 3;
const MASTER_PER_FLOOR = 0.02;
const MASTER_MAX = 0.12;

export function isEnemyTier(value: unknown): value is EnemyTier {
  return value === 'novice' || value === 'journeyman' || value === 'master';
}

export function tierMixForFloor(floor: number): { readonly journeyman: number; readonly master: number } {
  const depth = Math.max(0, floor);
  return {
    journeyman: Math.min(JOURNEYMAN_MAX, JOURNEYMAN_PER_FLOOR * depth),
    master: Math.min(MASTER_MAX, Math.max(0, depth - MASTER_FROM_FLOOR) * MASTER_PER_FLOOR),
  };
}

export function rollTier(floor: number, roll: number): EnemyTier {
  const mix = tierMixForFloor(floor);
  if (roll < mix.master) return 'master';
  if (roll < mix.master + mix.journeyman) return 'journeyman';
  return 'novice';
}
