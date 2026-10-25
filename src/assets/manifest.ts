export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const PLAYER_DIRECTIONS: readonly Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export type AssetKind = 'image' | 'spritesheet';

export interface AssetSpec {
  readonly key: string;
  readonly path: string;
  readonly kind: AssetKind;
  readonly frameWidth?: number;
  readonly frameHeight?: number;
  readonly enabled: boolean;
}

export const SOURCE_TEXTURES: readonly string[] = [
  'src_floor_a',
  'src_floor_b',
  'src_grate',
  'src_wall_a',
  'src_wall_b',
];

export const ASSETS: readonly AssetSpec[] = [
  { key: 'src_floor_a', path: 'art/textures/tex_floor_a.png', kind: 'image', enabled: false },
  { key: 'src_floor_b', path: 'art/textures/tex_floor_b.png', kind: 'image', enabled: false },
  { key: 'src_grate', path: 'art/textures/tex_grate.png', kind: 'image', enabled: false },
  { key: 'src_wall_a', path: 'art/textures/tex_wall_a.png', kind: 'image', enabled: false },
  { key: 'src_wall_b', path: 'art/textures/tex_wall_b.png', kind: 'image', enabled: false },
  { key: 'player_N', path: 'art/entities/player_N.png', kind: 'image', enabled: false },
  { key: 'player_NE', path: 'art/entities/player_NE.png', kind: 'image', enabled: false },
  { key: 'player_E', path: 'art/entities/player_E.png', kind: 'image', enabled: false },
  { key: 'player_SE', path: 'art/entities/player_SE.png', kind: 'image', enabled: false },
  { key: 'player_S', path: 'art/entities/player_S.png', kind: 'image', enabled: false },
  { key: 'player_SW', path: 'art/entities/player_SW.png', kind: 'image', enabled: false },
  { key: 'player_W', path: 'art/entities/player_W.png', kind: 'image', enabled: false },
  { key: 'player_NW', path: 'art/entities/player_NW.png', kind: 'image', enabled: false },
];
