import {
  DRONE_DEAD_V2_KEY,
  DRONE_V2_SPRITE_KEY,
  TANK_DEAD_V2_KEY,
  TANK_V2_SPRITE_KEY,
  WARDEN_DEAD_V2_KEY,
  WARDEN_V2_SPRITE_KEY,
} from '../assets/manifest';
import {
  DRONE_CHASE_SPEED,
  DRONE_CONTACT_RANGE,
  DRONE_DAMAGE,
  DRONE_FIRE_COOLDOWN_MS,
  DRONE_FIRE_RANGE,
  DRONE_FIRE_RECOVER_MS,
  DRONE_FIRE_WINDUP_MS,
  DRONE_FOOTPRINT,
  DRONE_HEIGHT,
  DRONE_MAX_HP,
  DRONE_RETURN_SPEED,
  DRONE_SPEED,
  FLOOR_COUNT,
} from './config';

export type EnemyKind = 'drone' | 'tank' | 'assembler' | 'warden';
export type EnemyShot = 'drone' | 'shell';

export interface EnemySpec {
  readonly spriteKey: string;
  readonly deadKey: string;
  readonly height: number;
  readonly bob: number;
  readonly maxHp: number;
  readonly speed: number;
  readonly chaseSpeed: number;
  readonly returnSpeed: number;
  readonly footprint: number;
  readonly contactRange: number;
  readonly contactDamage: number;
  readonly fireWindupMs: number;
  readonly fireRecoverMs: number;
  readonly fireCooldownMs: number;
  readonly fireRange: number;
  readonly shot: EnemyShot;
  readonly dodges: boolean;
  readonly armorHp: number;
  readonly fan: number;
  readonly fanStep: number;
  readonly summonMs: number;
  readonly summonCap: number;
  readonly boss: boolean;
  readonly ammoDrop: number;
  readonly turnMs: number;
  readonly scale: number;
  readonly idleTint: number | null;
  readonly chaseTint: number;
  readonly healthBarWidth: number;
}

export const ENEMY_SPECS: Readonly<Record<EnemyKind, EnemySpec>> = {
  drone: {
    spriteKey: DRONE_V2_SPRITE_KEY,
    deadKey: DRONE_DEAD_V2_KEY,
    height: DRONE_HEIGHT,
    bob: 1.4,
    maxHp: DRONE_MAX_HP,
    speed: DRONE_SPEED,
    chaseSpeed: DRONE_CHASE_SPEED,
    returnSpeed: DRONE_RETURN_SPEED,
    footprint: DRONE_FOOTPRINT,
    contactRange: DRONE_CONTACT_RANGE,
    contactDamage: DRONE_DAMAGE,
    fireWindupMs: DRONE_FIRE_WINDUP_MS,
    fireRecoverMs: DRONE_FIRE_RECOVER_MS,
    fireCooldownMs: DRONE_FIRE_COOLDOWN_MS,
    fireRange: DRONE_FIRE_RANGE,
    shot: 'drone',
    dodges: true,
    armorHp: 0,
    fan: 1,
    fanStep: 0,
    summonMs: 0,
    summonCap: 0,
    boss: false,
    ammoDrop: 4,
    turnMs: 0,
    scale: 1,
    idleTint: null,
    chaseTint: 0xff7a5a,
    healthBarWidth: 24,
  },
  tank: {
    spriteKey: TANK_V2_SPRITE_KEY,
    deadKey: TANK_DEAD_V2_KEY,
    height: 52,
    bob: 0.25,
    maxHp: 2,
    speed: 70,
    chaseSpeed: 84,
    returnSpeed: 70,
    footprint: 0.3,
    contactRange: 1.5,
    contactDamage: 1,
    fireWindupMs: 1100,
    fireRecoverMs: 900,
    fireCooldownMs: 3800,
    fireRange: 7,
    shot: 'shell',
    dodges: false,
    armorHp: 3,
    fan: 1,
    fanStep: 0,
    summonMs: 0,
    summonCap: 0,
    boss: false,
    ammoDrop: 8,
    turnMs: 900,
    scale: 1,
    idleTint: null,
    chaseTint: 0xffa090,
    healthBarWidth: 34,
  },
  assembler: {
    spriteKey: TANK_V2_SPRITE_KEY,
    deadKey: TANK_DEAD_V2_KEY,
    height: 52,
    bob: 0.2,
    maxHp: 6,
    speed: 50,
    chaseSpeed: 62,
    returnSpeed: 50,
    footprint: 0.42,
    contactRange: 1.8,
    contactDamage: 1,
    fireWindupMs: 900,
    fireRecoverMs: 800,
    fireCooldownMs: 3000,
    fireRange: 8,
    shot: 'shell',
    dodges: false,
    armorHp: 3,
    fan: 3,
    fanStep: 0.34,
    summonMs: 11000,
    summonCap: 2,
    boss: true,
    ammoDrop: 8,
    turnMs: 800,
    scale: 1.7,
    idleTint: 0xe0c060,
    chaseTint: 0xffb070,
    healthBarWidth: 60,
  },
  warden: {
    spriteKey: WARDEN_V2_SPRITE_KEY,
    deadKey: WARDEN_DEAD_V2_KEY,
    height: 64,
    bob: 0.6,
    maxHp: 9,
    speed: 0,
    chaseSpeed: 0,
    returnSpeed: 0,
    footprint: 0.45,
    contactRange: 1.2,
    contactDamage: 1,
    fireWindupMs: 1000,
    fireRecoverMs: 900,
    fireCooldownMs: 3200,
    fireRange: 11,
    shot: 'shell',
    dodges: false,
    armorHp: 4,
    fan: 5,
    fanStep: 0.27,
    summonMs: 10000,
    summonCap: 2,
    boss: true,
    ammoDrop: 0,
    turnMs: 1100,
    scale: 1,
    idleTint: null,
    chaseTint: 0xff9a8a,
    healthBarWidth: 64,
  },
};

export const TANK_FRONT_COS = 0.8;

const DRONES_BY_FLOOR: readonly number[] = [4, 4, 4, 5, 5, 5, 6, 6, 5, 6, 5];
const TANKS_BY_FLOOR: readonly number[] = [0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0];
const BOSS_BY_FLOOR: Readonly<Record<number, EnemyKind>> = { 8: 'assembler', 10: 'warden' };

export function droneCountForFloor(floor: number): number {
  return DRONES_BY_FLOOR[Math.max(0, Math.min(FLOOR_COUNT - 1, floor))] ?? 2;
}

export function hostileCountForFloor(floor: number): number {
  return droneCountForFloor(floor) + tankCountForFloor(floor) + (bossForFloor(floor) ? 2 : 0);
}

export function tankCountForFloor(floor: number): number {
  return TANKS_BY_FLOOR[Math.max(0, Math.min(FLOOR_COUNT - 1, floor))] ?? 0;
}

export function bossForFloor(floor: number): EnemyKind | null {
  return BOSS_BY_FLOOR[floor] ?? null;
}
