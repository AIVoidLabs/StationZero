export type SecretKind =
  | 'maxHp'
  | 'speed'
  | 'stim'
  | 'ammo'
  | 'armor'
  | 'melee'
  | 'light'
  | 'iframes'
  | 'fireRate'
  | 'maxHpFull';

export const SECRET_KINDS: readonly SecretKind[] = [
  'maxHp',
  'speed',
  'stim',
  'ammo',
  'armor',
  'melee',
  'light',
  'iframes',
  'fireRate',
  'maxHpFull',
];

export const SECRET_COUNT = SECRET_KINDS.length;

export const SECRET_MAX_HP_BONUS = 1;
export const SECRET_SPEED_MUL = 1.06;
export const SECRET_STIM_BONUS = 1;
export const SECRET_AMMO_BONUS = 3;
export const SECRET_ARMOR_HIT = 2;
export const SECRET_MELEE_BONUS = 1;
export const SECRET_LIGHT_MUL = 1.1;
export const SECRET_IFRAMES_MS = 900;
export const SECRET_FIRE_RATE_MUL = 0.8;
