import type { EnemyKind } from './enemies';

export type PropKind = 'barrel' | 'crate' | 'pipe' | 'theme';
export type LootKindName = 'ammo' | 'stim';
export type GateAxis = 'x' | 'y';

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface PlacedProp extends GridPoint {
  readonly kind: PropKind;
}

export interface LootSpawn extends GridPoint {
  readonly kind: LootKindName;
  readonly amount: number;
}

export interface EnemySpawn extends GridPoint {
  readonly kind: EnemyKind;
  readonly seed: number;
}

export interface VentSpawn extends GridPoint {
  readonly phaseMs: number;
}

export interface GateSpawn extends GridPoint {
  readonly axis: GateAxis;
  readonly phaseMs: number;
}

export interface HazardSpawns {
  readonly vents: readonly VentSpawn[];
  readonly gates: readonly GateSpawn[];
}

export interface LevelEntities {
  readonly props: readonly PlacedProp[];
  readonly terminals: readonly GridPoint[];
  readonly corpse: GridPoint | null;
  readonly loot: readonly LootSpawn[];
  readonly enemies: readonly EnemySpawn[];
  readonly hazards: HazardSpawns;
}
