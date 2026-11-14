import { LOOT_HEAL_AMOUNT, MELEE_DAMAGE, PISTOL_MAX_AMMO, PLAYER_IFRAMES_MS, PLAYER_MAX_HP } from '../data/config';
import {
  SECRET_AMMO_BONUS,
  SECRET_ARMOR_HIT,
  SECRET_FIRE_RATE_MUL,
  SECRET_IFRAMES_MS,
  SECRET_KINDS,
  SECRET_LIGHT_MUL,
  SECRET_MAX_HP_BONUS,
  SECRET_MELEE_BONUS,
  SECRET_SPEED_MUL,
  SECRET_STIM_BONUS,
} from '../data/secrets';
import { runFlags } from './RunFlags';

export interface UpgradeStats {
  readonly maxHp: number;
  readonly maxAmmo: number;
  readonly speedMul: number;
  readonly stimHeal: number;
  readonly armorHit: number;
  readonly meleeDamage: number;
  readonly lightMul: number;
  readonly iframesMs: number;
  readonly pistolCooldownMul: number;
}

export function upgradeStats(): UpgradeStats {
  let maxHp = PLAYER_MAX_HP;
  let maxAmmo = PISTOL_MAX_AMMO;
  let speedMul = 1;
  let stimHeal = LOOT_HEAL_AMOUNT;
  let armorHit = 1;
  let meleeDamage = MELEE_DAMAGE;
  let lightMul = 1;
  let iframesMs = PLAYER_IFRAMES_MS;
  let pistolCooldownMul = 1;

  for (const [floor, kind] of SECRET_KINDS.entries()) {
    if (!runFlags.hasSecret(floor)) continue;
    switch (kind) {
      case 'maxHp':
      case 'maxHpFull':
        maxHp += SECRET_MAX_HP_BONUS;
        break;
      case 'speed':
        speedMul = SECRET_SPEED_MUL;
        break;
      case 'stim':
        stimHeal += SECRET_STIM_BONUS;
        break;
      case 'ammo':
        maxAmmo += SECRET_AMMO_BONUS;
        break;
      case 'armor':
        armorHit = SECRET_ARMOR_HIT;
        break;
      case 'melee':
        meleeDamage += SECRET_MELEE_BONUS;
        break;
      case 'light':
        lightMul = SECRET_LIGHT_MUL;
        break;
      case 'iframes':
        iframesMs = SECRET_IFRAMES_MS;
        break;
      case 'fireRate':
        pistolCooldownMul = SECRET_FIRE_RATE_MUL;
        break;
    }
  }

  return { maxHp, maxAmmo, speedMul, stimHeal, armorHit, meleeDamage, lightMul, iframesMs, pistolCooldownMul };
}
