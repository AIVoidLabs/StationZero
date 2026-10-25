export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const WALL_HEIGHT = 46;

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const CAMERA_ZOOM = 2;
export const CAMERA_LERP = 0.18;
export const CAMERA_LOOK_AHEAD = 26;

export const PLAYER_WIDTH = 32;
export const PLAYER_HEIGHT = 48;
export const PLAYER_SPEED = 190;
export const PLAYER_FOOTPRINT = 0.3;
export const PLAYER_BOB_PX = 2;

export const DUNGEON_WIDTH = 27;
export const DUNGEON_HEIGHT = 27;
export const DUNGEON_SEED = 240731;

export const VISION_INNER_RADIUS = 110;
export const VISION_OUTER_RADIUS = 430;

export const LANTERN_RADIUS = 185;
export const LANTERN_OFFSET_Y = -4;

export const DEPTH_FLOOR = -10000;
export const DEPTH_MARKER = -9000;
export const DEPTH_LANTERN = 800000;
export const DEPTH_DARKNESS = 900000;

export const PALETTE = {
  void: 0x050505,
  nearBlack: 0x0b0d0c,
  shadow: 0x14181a,
  steelDark: 0x1f2629,
  steel: 0x2e3a3d,
  steelLight: 0x46595c,
  bone: 0x6f807f,
  concrete: 0x8a8f7a,
  amberDim: 0xb0a27a,
  amber: 0xd9a441,
  signal: 0xff6b1a,
  rust: 0x8c3b2a,
  blood: 0x5a1f1a,
  violet: 0x6b4a7a,
  cyan: 0x2a5b6b,
  boneLight: 0xc9c4b4,
} as const;
