import { FLOOR_COUNT } from '../data/config';
import { CUTSCENE_ART, cutsceneArtKey } from '../data/cutscenes';

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';


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

export const PLAYER_IDLE_KEY = 'player_v2';

export const PLAYER_WALK_KEY = 'player_v2_walk';

export const PLAYER_WALK_FRAMES = 6;

export const PLAYER_AIM_KEY = 'player_v2_aim';

export const PLAYER_AIM_FRAMES = 3;

export const DRONE_V2_SPRITE_KEY = 'drone_v2';

export const DRONE_DEAD_V2_KEY = 'drone_dead_v2';

export const SPIDER_V2_SPRITE_KEY = 'spider_v2';

export const SPIDER_DEAD_V2_KEY = 'spider_dead_v2';

export const TANK_V2_SPRITE_KEY = 'tank_v2';

export const TANK_DEAD_V2_KEY = 'tank_dead_v2';

export const WARDEN_V2_SPRITE_KEY = 'warden_v2';

export const WARDEN_DEAD_V2_KEY = 'warden_dead_v2';

export const TILES_V2_KEY = 'tiles_v2';

export function tilesKeyForFloor(floor: number): string {
  return floor <= 0 ? TILES_V2_KEY : `${TILES_V2_KEY}_${floor}`;
}

export const DOOR_CLOSED_V2_KEY = 'door_closed_v2';

export const DOOR_OPEN_V2_KEY = 'door_open_v2';

export const LOOT_V2_KEY = 'loot_v2';

export const PROPS_FLOOR_KEY = 'props_floor';

export const DEAD_FRAME_COUNT = 10;

export const HUD_CROSS_KEY = 'hud_cross';

export const HUD_BULLET_KEY = 'hud_bullet';

export const HUD_BULLET_EMPTY_KEY = 'hud_bullet_empty';

export const MENU_TITLE_KEY = 'menu_title';

export const MENU_BG_KEY = 'menu_bg';

export const END_DEAD_KEY = 'end_dead';

export const END_SURVIVED_KEY = 'end_survived';

export const AMBIENCE_AUDIO_KEY = 'ambience';

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

export const ASSETS: readonly AssetSpec[] = [
  { key: PLAYER_IDLE_KEY, path: 'art/v2/player.png', kind: 'spritesheet', frameWidth: 32, frameHeight: 48, enabled: true },
  { key: PLAYER_WALK_KEY, path: 'art/v2/player_walk.png', kind: 'spritesheet', frameWidth: 32, frameHeight: 48, enabled: true },
  { key: PLAYER_AIM_KEY, path: 'art/v2/player_aim.png', kind: 'spritesheet', frameWidth: 32, frameHeight: 48, enabled: true },
  { key: DRONE_DEAD_V2_KEY, path: 'art/v2/drone_dead.png', kind: 'image', enabled: true },
  { key: WARDEN_DEAD_V2_KEY, path: 'art/v2/warden_dead.png', kind: 'image', enabled: true },
  { key: WARDEN_V2_SPRITE_KEY, path: 'art/v2/warden.png', kind: 'spritesheet', frameWidth: 64, frameHeight: 64, enabled: true },
  { key: TANK_DEAD_V2_KEY, path: 'art/v2/tank_dead.png', kind: 'image', enabled: true },
  { key: TANK_V2_SPRITE_KEY, path: 'art/v2/tank.png', kind: 'spritesheet', frameWidth: 56, frameHeight: 52, enabled: true },
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
  ...Array.from({ length: FLOOR_COUNT - 1 }, (_, index) => ({
    key: tilesKeyForFloor(index + 1),
    path: `art/v2/tiles_${index + 1}.png`,
    kind: 'image' as const,
    enabled: true,
  })),
  { key: DRONE_V2_SPRITE_KEY, path: 'art/v2/drone.png', kind: 'spritesheet', frameWidth: 40, frameHeight: 40, enabled: true },
  { key: SPIDER_V2_SPRITE_KEY, path: 'art/v2/spider.png', kind: 'spritesheet', frameWidth: 40, frameHeight: 40, enabled: true },
  { key: SPIDER_DEAD_V2_KEY, path: 'art/v2/spider_dead.png', kind: 'image', enabled: true },
  {
    key: 'props',
    path: 'art/runtime/props.png',
    kind: 'spritesheet',
    frameWidth: 64,
    frameHeight: 96,
    enabled: true,
  },
  {
    key: PROPS_FLOOR_KEY,
    path: 'art/v2/props_floor.png',
    kind: 'spritesheet',
    frameWidth: 48,
    frameHeight: 48,
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
    key: AMBIENCE_AUDIO_KEY,
    path: 'audio/ambience.ogg',
    kind: 'audio',
    enabled: true,
  },
];
