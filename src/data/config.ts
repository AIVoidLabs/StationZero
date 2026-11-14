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
export const PLAYER_STRIDE_TILES = 1.8;
export const FOOTSTEP_DISTANCE = 0.9;

export const DUNGEON_WIDTH = 35;
export const DUNGEON_HEIGHT = 35;
export const DUNGEON_SEED = 240731;

export const FLOOR_COUNT = 11;
export const FLOOR_SEED_STRIDE = 8191;
export const DESCENT_DWELL_MS = 900;
export const DESCENT_FADE_MS = 420;
export const DESCENT_ARRIVAL_PULSE_MS = 1100;
export const DESCENT_SIGNAL_RANGE = 14;
export const DESCENT_SPIN_MS = 1100;
export const DESCENT_SPIN_SNAP_MS = 150;
export const DOOR_OPEN_MS = 700;

export const PLAYER_KNOCKBACK_TILES = 0.9;
export const PLAYER_KNOCKBACK_MS = 180;
export const PLAYER_KNOCKBACK_SHAKE_MS = 80;


export const LANTERN_RADIUS = 185;
export const PLAYER_LIGHT_RADIUS = 150;
export const DRONE_DEATH_FLARE_MS = 900;
export const LANTERN_OFFSET_Y = -4;

export const DEPTH_FLOOR = -10000;
export const DEPTH_CURSOR = 700000;
export const DEPTH_MARKER = DEPTH_CURSOR;
export const DEPTH_LANTERN = 800000;
export const DEPTH_DARKNESS = 900000;
export const DEPTH_VFX = DEPTH_DARKNESS + 200;

export const WARDEN_ALARM_RAMP_MS = 540000;
export const WARDEN_PULSE_MIN_MS = 21000;
export const WARDEN_PULSE_MAX_MS = 47000;
export const WARDEN_SILENCE_CHANCE = 0.25;
export const WARDEN_SILENCE_DELAY_MS = 300;
export const LOG_REACH_TILES = 1.35;

export const DRONE_WIDTH = 40;
export const DRONE_HEIGHT = 40;
export const DRONE_SPEED = 105;
export const DRONE_CHASE_SPEED = 128;
export const DRONE_RETURN_SPEED = 140;
export const DRONE_FOOTPRINT = 0.22;
export const DRONE_SIGHT_RANGE = 7.5;
export const DRONE_FOV_DEG = 120;
export const DRONE_VIEW_COSINE = Math.cos(((DRONE_FOV_DEG / 2) * Math.PI) / 180);
export const DRONE_PERIPHERAL_RANGE = 1.8;
export const DRONE_LOSE_SIGHT_MS = 900;
export const DRONE_SEARCH_MS = 2600;
export const DRONE_CHASE_MAX_MS = 7000;
export const DRONE_CHASE_LEASH = 11;
export const DRONE_REPATH_MS = 220;
export const DRONE_IDLE_MIN_MS = 1400;
export const DRONE_IDLE_MAX_MS = 4200;
export const DRONE_SCAN_MS = 900;
export const DRONE_PATROL_RADIUS = 7;
export const DRONE_CONTACT_RANGE = 1.15;
export const DRONE_DISENGAGE_GRACE_MS = 2200;
export const DRONE_DISENGAGE_SIGHT_SCALE = 0.55;
export const DRONE_MIN_SPAWN_DISTANCE = 11;

// Combat
export const PLAYER_MAX_HP = 6;
export const PLAYER_IFRAMES_MS = 600;

// Pistol
export const PISTOL_AMMO_START = 12;
export const PISTOL_MAX_AMMO = 12;
export const PISTOL_RANGE = 7;
export const PISTOL_DAMAGE = 1;
export const PISTOL_COOLDOWN_MS = 320;

// Melee
export const MELEE_RANGE = 1.8;
export const MELEE_ARC_DEGREES = 95;
export const MELEE_COOLDOWN_MS = 280;
export const MELEE_DAMAGE = 1;

export const PLAYER_BULLET_SPEED = 15;
export const PLAYER_BULLET_LENGTH = 26;
export const PLAYER_BULLET_RANGE = PISTOL_RANGE + 1.5;
export const PLAYER_BULLET_HIT_RADIUS = 0.5;

export const DRONE_BULLET_SPEED = 4.5;
export const DRONE_BULLET_LENGTH = 20;
export const DRONE_BULLET_RANGE = 9;
export const DRONE_BULLET_DAMAGE = 1;
export const DRONE_BULLET_HIT_RADIUS = 0.4;

export const DRONE_FIRE_RANGE = 6;
export const DRONE_FIRE_WINDUP_MS = 450;
export const DRONE_FIRE_RECOVER_MS = 500;
export const DRONE_FIRE_COOLDOWN_MS = 2400;
export const DRONE_FIRE_COOLDOWN_MIN_SCALE = 0.6;

export const DRONE_DODGE_COOLDOWN_MS = 1400;
export const DRONE_DODGE_RETRY_MS = 350;
export const DRONE_DODGE_MS = 300;
export const DRONE_DODGE_SPEED = 4.5;
export const DRONE_DODGE_CHANCE = 0.5;
export const DRONE_DODGE_SENSE_TILES = 3.5;

export const BULLET_HEIGHT_PX = 22;

export const DRONE_MAX_HP = 2;
export const DRONE_DAMAGE = 1;
export const DRONE_CONTACT_COOLDOWN_MS = 800;
export const DRONE_CONTACT_DAMAGE_RANGE = 1.25;

export const LOOT_PICKUP_RANGE = 0.62;
export const LOOT_DROP_CHANCE = 0.3;
export const LOOT_DROP_DEPTH_STEP = 0.03;
export const LOOT_DROP_CHANCE_MIN = 0.15;
export const LOOT_AMMO_AMOUNT = 4;
export const FLOOR_LOOT_BASE = 3;
export const FLOOR_LOOT_MIN = 1;
export const LOOT_HEAL_AMOUNT = 2;
export const HEALTH_PER_HOSTILE = 0.4;

export const DEPTH_MAX_BAND = FLOOR_COUNT - 1;
export const DEPTH_LIGHT_MIN_SCALE = 0.65;
export const DEPTH_LANTERN_MIN_SCALE = 0.68;
export const DEPTH_SILENCE_CHANCE_MAX = 0.6;
export const DEPTH_SILENCE_HOLD_MAX_SCALE = 1.8;
export const DEPTH_PULSE_INTERVAL_MIN_SCALE = 0.55;
export const DEPTH_AWARENESS_MAX_SCALE = 1.3;
export const DEPTH_PITCH_PER_BAND = 0.03;

export const AUDIO_MASTER_GAIN = 0.8;
export const AUDIO_AMBIENCE_GAIN = 0.13;
export const AUDIO_SILENCE_FADE_MS = 80;
export const AUDIO_SILENCE_HOLD_MIN_MS = 1600;
export const AUDIO_SILENCE_HOLD_MAX_MS = 2600;
export const AUDIO_SILENCE_RETURN_MS = 400;

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
