import { readJson, writeJson } from '../utils/storage';

export type Language = 'en' | 'tr';

export type KeyAction = 'up' | 'down' | 'left' | 'right' | 'attack' | 'interact' | 'mute' | 'pause';

export const KEY_ACTIONS: readonly KeyAction[] = ['up', 'down', 'left', 'right', 'attack', 'interact', 'mute', 'pause'];

export interface SettingsData {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  minimap: boolean;
  hints: boolean;
  showFps: boolean;
  cutscenes: boolean;
  voice: boolean;
  seenHints: string[];
  language: Language;
  keys: Record<KeyAction, number>;
}

export const DEFAULT_KEYS: Readonly<Record<KeyAction, number>> = {
  up: 87,
  down: 83,
  left: 65,
  right: 68,
  attack: 32,
  interact: 69,
  mute: 77,
  pause: 27,
};

const STORAGE_KEY = 'station-zero:settings';
const KEY_NAMES: Readonly<Record<number, string>> = {
  8: 'BACKSPACE',
  9: 'TAB',
  13: 'ENTER',
  16: 'SHIFT',
  17: 'CTRL',
  18: 'ALT',
  27: 'ESC',
  32: 'SPACE',
  37: 'LEFT',
  38: 'UP',
  39: 'RIGHT',
  40: 'DOWN',
  46: 'DELETE',
};

export function keyName(code: number): string {
  const named = KEY_NAMES[code];
  if (named) return named;
  if ((code >= 48 && code <= 90) || (code >= 96 && code <= 105)) return String.fromCharCode(code).toUpperCase();
  if (code >= 112 && code <= 123) return `F${code - 111}`;
  return `KEY ${code}`;
}

function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

function defaults(): SettingsData {
  return {
    masterVolume: 80,
    musicVolume: 60,
    sfxVolume: 80,
    screenShake: true,
    minimap: true,
    hints: true,
    showFps: true,
    cutscenes: true,
    voice: true,
    seenHints: [],
    language: detectLanguage(),
    keys: { ...DEFAULT_KEYS },
  };
}

function clampVolume(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value / 10) * 10));
}

type Listener = (data: Readonly<SettingsData>) => void;

class SettingsStore {
  readonly data: SettingsData = defaults();
  private readonly listeners = new Set<Listener>();

  constructor() {
    const stored = readJson<Partial<SettingsData>>(STORAGE_KEY);
    if (!stored) return;
    this.data.masterVolume = clampVolume(stored.masterVolume, this.data.masterVolume);
    this.data.musicVolume = clampVolume(stored.musicVolume, this.data.musicVolume);
    this.data.sfxVolume = clampVolume(stored.sfxVolume, this.data.sfxVolume);
    if (typeof stored.screenShake === 'boolean') this.data.screenShake = stored.screenShake;
    if (typeof stored.minimap === 'boolean') this.data.minimap = stored.minimap;
    if (typeof stored.hints === 'boolean') this.data.hints = stored.hints;
    if (typeof stored.showFps === 'boolean') this.data.showFps = stored.showFps;
    if (typeof stored.cutscenes === 'boolean') this.data.cutscenes = stored.cutscenes;
    if (typeof stored.voice === 'boolean') this.data.voice = stored.voice;
    if (Array.isArray(stored.seenHints)) this.data.seenHints = stored.seenHints.filter((id) => typeof id === 'string');
    if (stored.language === 'en' || stored.language === 'tr') this.data.language = stored.language;
    if (stored.keys) {
      for (const action of KEY_ACTIONS) {
        const code = stored.keys[action];
        if (typeof code === 'number' && Number.isFinite(code)) this.data.keys[action] = code;
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  hasSeenHint(id: string): boolean {
    return this.data.seenHints.includes(id);
  }

  markHintSeen(id: string): void {
    if (this.data.seenHints.includes(id)) return;
    this.data.seenHints = [...this.data.seenHints, id];
    this.commit();
  }

  resetHints(): void {
    this.data.seenHints = [];
    this.commit();
  }

  update(patch: Partial<Omit<SettingsData, 'keys'>>): void {
    Object.assign(this.data, patch);
    this.commit();
  }

  bindKey(action: KeyAction, code: number): void {
    const previous = this.data.keys[action];
    for (const other of KEY_ACTIONS) {
      if (other !== action && this.data.keys[other] === code) this.data.keys[other] = previous;
    }
    this.data.keys[action] = code;
    this.commit();
  }

  resetKeys(): void {
    this.data.keys = { ...DEFAULT_KEYS };
    this.commit();
  }

  private commit(): void {
    writeJson(STORAGE_KEY, this.data);
    for (const listener of this.listeners) listener(this.data);
  }
}

export const settings = new SettingsStore();
