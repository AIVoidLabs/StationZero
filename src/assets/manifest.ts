export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export const PLAYER_DIRECTIONS: readonly Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const PLAYER_SPRITE_KEY = 'player';

export const PLAYER_WALK_SPRITE_KEY = 'player_walk';

export const PLAYER_FRAME: Record<Direction, number> = {
  N: 0,
  NE: 1,
  E: 2,
  SE: 3,
  S: 4,
  SW: 5,
  W: 6,
  NW: 7,
};

export const PLAYER_WALK_FRAMES = 4;

export const PLAYER_WALK_FRAME: Record<Direction, number> = {
  N: 0,
  NE: 4,
  E: 8,
  SE: 12,
  S: 16,
  SW: 20,
  W: 24,
  NW: 28,
};

export const AMBIENCE_AUDIO_KEY = 'ambience';

export const DRONE_SPRITE_KEY = 'drone';

export const DRONE_FRAME: Record<Direction, number> = {
  N: 0,
  NE: 1,
  E: 2,
  SE: 3,
  S: 4,
  SW: 5,
  W: 6,
  NW: 7,
};

export type AssetKind = 'image' | 'spritesheet' | 'audio';

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
  { key: 'src_floor_a', path: 'art/runtime/textures/floor_a.png', kind: 'image', enabled: true },
  { key: 'src_floor_b', path: 'art/runtime/textures/floor_b.png', kind: 'image', enabled: true },
  { key: 'src_grate', path: 'art/runtime/textures/grate.png', kind: 'image', enabled: true },
  { key: 'src_wall_a', path: 'art/runtime/textures/wall_a.png', kind: 'image', enabled: true },
  { key: 'src_wall_b', path: 'art/runtime/textures/wall_b.png', kind: 'image', enabled: true },
  {
    key: PLAYER_SPRITE_KEY,
    path: 'art/runtime/player.png',
    kind: 'spritesheet',
    frameWidth: 32,
    frameHeight: 48,
    enabled: true,
  },
  {
    key: PLAYER_WALK_SPRITE_KEY,
    path: 'art/runtime/player_walk.png',
    kind: 'spritesheet',
    frameWidth: 32,
    frameHeight: 48,
    enabled: true,
  },
  {
    key: 'props',
    path: 'art/runtime/props.png',
    kind: 'spritesheet',
    frameWidth: 64,
    frameHeight: 96,
    enabled: true,
  },
  {
    key: 'decals',
    path: 'art/runtime/decals.png',
    kind: 'spritesheet',
    frameWidth: 64,
    frameHeight: 32,
    enabled: true,
  },
  {
    key: DRONE_SPRITE_KEY,
    path: 'art/runtime/drone.png',
    kind: 'spritesheet',
    frameWidth: 40,
    frameHeight: 40,
    enabled: false,
  },
  {
    key: AMBIENCE_AUDIO_KEY,
    path: 'audio/ambience.ogg',
    kind: 'audio',
    enabled: true,
  },
];
