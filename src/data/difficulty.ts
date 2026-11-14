import { FLOOR_COUNT } from './config';

export const DRONES_BASE = 11;
export const DRONES_PER_FLOOR = 0.55;
export const BOSS_FLOOR_DRONE_SHARE = 0.8;
export const HP_GROWTH_PER_FLOOR = 0.08;
export const FIRE_RATE_GAIN_PER_FLOOR = 0.03;
export const FIRE_COOLDOWN_MIN_SCALE = 0.7;
export const ALERT_FIRE_GAIN = 0.05;

function clampFloor(floor: number): number {
  return Math.max(0, Math.min(FLOOR_COUNT - 1, Math.round(floor)));
}

export function droneTotalForFloor(floor: number, bossFloor: boolean): number {
  const raw = DRONES_BASE + DRONES_PER_FLOOR * clampFloor(floor);
  return Math.round(bossFloor ? raw * BOSS_FLOOR_DRONE_SHARE : raw);
}

export function hpMultiplierForFloor(floor: number): number {
  return 1 + HP_GROWTH_PER_FLOOR * clampFloor(floor);
}

export function scaledEnemyHp(baseHp: number, floor: number): number {
  return Math.max(1, Math.round(baseHp * hpMultiplierForFloor(floor)));
}

export function scaledAmmoDrop(baseDrop: number, floor: number): number {
  return baseDrop <= 0 ? 0 : Math.max(1, Math.round(baseDrop * hpMultiplierForFloor(floor)));
}

export function fireCooldownScale(floor: number, alert: number): number {
  const byFloor = Math.max(FIRE_COOLDOWN_MIN_SCALE, 1 - FIRE_RATE_GAIN_PER_FLOOR * clampFloor(floor));
  return Math.max(0.4, byFloor * (1 - ALERT_FIRE_GAIN * Math.max(0, alert)));
}
