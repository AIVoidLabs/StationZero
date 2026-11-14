import { FLOOR_COUNT } from './config';

export const STEAM_FROM_FLOOR = 3;

export const STEAM_CYCLE_MS = 5200;
export const STEAM_IDLE_MS = 3000;
export const STEAM_WARN_MS = 800;
export const STEAM_RADIUS = 0.85;
export const STEAM_DAMAGE = 1;
export const STEAM_ENEMY_COOLDOWN_MS = 900;

export const HAZARD_SPAWN_CLEARANCE = 6;
export const HAZARD_MIN_SEPARATION = 3;
export const HAZARD_LOOT_CLEARANCE = 1.5;

export function steamCount(floor: number): number {
  if (floor < STEAM_FROM_FLOOR) return 0;
  return Math.min(6, 2 + Math.min(FLOOR_COUNT - 1, floor) - STEAM_FROM_FLOOR);
}
