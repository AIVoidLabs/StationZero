import type { StringKey } from '../i18n';
import type { EnemyKind } from './enemies';

export interface BossVariant {
  readonly floor: number;
  readonly kind: EnemyKind;
  readonly nameKey: StringKey;
  readonly scaleMul: number;
  readonly hpMul: number;
  readonly idleTint: number | null;
  readonly chaseTint: number | null;
}

export const BOSS_VARIANTS: readonly BossVariant[] = [
  { floor: 0, kind: 'crusher', nameKey: 'boss.b1', scaleMul: 0.8, hpMul: 0.6, idleTint: 0xc8d0d8, chaseTint: 0xffb898 },
  { floor: 1, kind: 'crusher', nameKey: 'boss.b2', scaleMul: 0.9, hpMul: 0.8, idleTint: 0xd89a90, chaseTint: 0xff7a68 },
  { floor: 2, kind: 'matriarch', nameKey: 'boss.b3', scaleMul: 0.9, hpMul: 0.75, idleTint: 0xb8e8c8, chaseTint: 0x9fe8a0 },
  { floor: 3, kind: 'assembler', nameKey: 'boss.b4', scaleMul: 1, hpMul: 0.85, idleTint: 0xe0b070, chaseTint: 0xffb070 },
  { floor: 4, kind: 'dynamo', nameKey: 'boss.b5', scaleMul: 0.95, hpMul: 0.9, idleTint: 0x8ad8ff, chaseTint: 0xb8f0ff },
  { floor: 5, kind: 'crusher', nameKey: 'boss.b6', scaleMul: 1.15, hpMul: 1.3, idleTint: 0xffa860, chaseTint: 0xff7040 },
  { floor: 6, kind: 'assembler', nameKey: 'boss.b7', scaleMul: 1, hpMul: 1, idleTint: 0xd8c8a0, chaseTint: 0xffc890 },
  { floor: 7, kind: 'dynamo', nameKey: 'boss.b8', scaleMul: 1.1, hpMul: 1.15, idleTint: 0x70c8ff, chaseTint: 0xa8e8ff },
  { floor: 8, kind: 'assembler', nameKey: 'boss.b9', scaleMul: 1.1, hpMul: 1.2, idleTint: 0xe0c060, chaseTint: 0xffb070 },
  { floor: 9, kind: 'matriarch', nameKey: 'boss.b10', scaleMul: 1.1, hpMul: 1.25, idleTint: 0x98e8b0, chaseTint: 0x80ff98 },
  { floor: 10, kind: 'warden', nameKey: 'boss.b11', scaleMul: 1, hpMul: 1, idleTint: null, chaseTint: null },
];

export function bossVariantForFloor(floor: number): BossVariant | null {
  return BOSS_VARIANTS.find((variant) => variant.floor === floor) ?? null;
}
