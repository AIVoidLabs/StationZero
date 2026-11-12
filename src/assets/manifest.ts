import { CUTSCENE_ART, cutsceneArtKey } from '../data/cutscenes';
import { settings } from '../systems/Settings';

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

export interface PlayerArt {
  readonly idleKey: string;
  readonly walkKey: string;
  readonly walkFrames: number;
  readonly aimKey: string | null;
}

const PLAYER_ART_LEGACY: PlayerArt = {
  idleKey: PLAYER_SPRITE_KEY,
  walkKey: PLAYER_WALK_SPRITE_KEY,
  walkFrames: PLAYER_WALK_FRAMES,
  aimKey: null,
};

const PLAYER_ART_V2: PlayerArt = {
  idleKey: 'player_v2',
  walkKey: 'player_v2_walk',
  walkFrames: 6,
  aimKey: 'player_v2_aim',
};

export const PLAYER_AIM_FRAMES = 3;

export interface WorldArt {
  readonly floor: boolean;
  readonly wall: boolean;
  readonly drone: boolean;
  readonly door: boolean;
  readonly loot: boolean;
}

function artEnabled(params: URLSearchParams, name: string): boolean {
  const specific = params.get(name);
  if (specific === 'v2') return true;
  if (specific === 'classic') return false;
  const all = params.get('art');
  if (all === 'v2') return true;
  if (all === 'classic') return false;
  return settings.data.artStyle === 'v2';
}

export function selectWorldArt(): WorldArt {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  const params = new URLSearchParams(search);
  const on = (name: string): boolean => artEnabled(params, name);
  return {
    floor: on('floor'),
    wall: on('wall'),
    drone: on('drone'),
    door: on('door'),
    loot: on('loot'),
  };
}

export const DRONE_V2_SPRITE_KEY = 'drone_v2';

export const DRONE_DEAD_V2_KEY = 'drone_dead_v2';

export const TILES_V2_KEY = 'tiles_v2';

export const DOOR_CLOSED_V2_KEY = 'door_closed_v2';

export const DOOR_OPEN_V2_KEY = 'door_open_v2';

export const LOOT_V2_KEY = 'loot_v2';

export const HUD_CROSS_KEY = 'hud_cross';

export const HUD_BULLET_KEY = 'hud_bullet';

export const HUD_BULLET_EMPTY_KEY = 'hud_bullet_empty';

export const MENU_TITLE_KEY = 'menu_title';

export const MENU_BG_KEY = 'menu_bg';

export const END_DEAD_KEY = 'end_dead';

export const END_SURVIVED_KEY = 'end_survived';

export function selectPlayerArt(): PlayerArt {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return artEnabled(new URLSearchParams(search), 'char') ? PLAYER_ART_V2 : PLAYER_ART_LEGACY;
}

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
  { key: 'player_v2', path: 'art/v2/player.png', kind: 'spritesheet', frameWidth: 32, frameHeight: 48, enabled: true },
  { key: 'player_v2_walk', path: 'art/v2/player_walk.png', kind: 'spritesheet', frameWidth: 32, frameHeight: 48, enabled: true },
  { key: 'player_v2_aim', path: 'art/v2/player_aim.png', kind: 'spritesheet', frameWidth: 32, frameHeight: 48, enabled: true },
  { key: DRONE_DEAD_V2_KEY, path: 'art/v2/drone_dead.png', kind: 'image', enabled: true },
  { key: MENU_TITLE_KEY, path: 'art/v2/menu/title.png', kind: 'image', enabled: true },
  { key: MENU_BG_KEY, path: 'art/v2/menu/menu_bg.png', kind: 'image', enabled: true },
  { key: END_DEAD_KEY, path: 'art/v2/menu/end_dead.png', kind: 'image', enabled: true },
  { key: END_SURVIVED_KEY, path: 'art/v2/menu/end_survived.png', kind: 'image', enabled: true },
  ...CUTSCENE_ART.map((name) => ({
    key: cutsceneArtKey(name),
    path: `art/v2/cutscenes/${name}.png`,
    kind: 'image' as const,
    enabled: true,
  })),
  { key: HUD_CROSS_KEY, path: 'art/v2/hud_cross.png', kind: 'image', enabled: true },
  { key: HUD_BULLET_KEY, path: 'art/v2/hud_bullet.png', kind: 'image', enabled: true },
  { key: HUD_BULLET_EMPTY_KEY, path: 'art/v2/hud_bullet_empty.png', kind: 'image', enabled: true },
  { key: 'music_menu', path: 'audio/music_menu.ogg', kind: 'audio', enabled: true },
  { key: 'music_end', path: 'audio/music_end.ogg', kind: 'audio', enabled: true },
  { key: DOOR_CLOSED_V2_KEY, path: 'art/v2/door_closed.png', kind: 'image', enabled: true },
  { key: DOOR_OPEN_V2_KEY, path: 'art/v2/door_open.png', kind: 'image', enabled: true },
  { key: LOOT_V2_KEY, path: 'art/v2/loot.png', kind: 'spritesheet', frameWidth: 16, frameHeight: 16, enabled: true },
  { key: TILES_V2_KEY, path: 'art/v2/tiles.png', kind: 'image', enabled: true },
  { key: DRONE_V2_SPRITE_KEY, path: 'art/v2/drone.png', kind: 'spritesheet', frameWidth: 40, frameHeight: 40, enabled: true },
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
