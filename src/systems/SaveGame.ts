import { readJson, removeKey, writeJson } from '../utils/storage';
import type { FlagSnapshot } from './RunFlags';
import type { RunSnapshot } from './RunStats';

export interface SaveData {
  readonly version: 1;
  readonly floor: number;
  readonly hp: number;
  readonly ammo: number;
  readonly stats: RunSnapshot;
  readonly flags?: FlagSnapshot | undefined;
  readonly savedAt: number;
}

const STORAGE_KEY = 'station-zero:save';

export const saveGame = {
  load(): SaveData | null {
    const data = readJson<SaveData>(STORAGE_KEY);
    if (!data || data.version !== 1) return null;
    if (![data.floor, data.hp, data.ammo].every((value) => typeof value === 'number')) return null;
    return data;
  },

  exists(): boolean {
    return saveGame.load() !== null;
  },

  save(floor: number, hp: number, ammo: number, stats: RunSnapshot, flags?: FlagSnapshot): void {
    const data: SaveData = { version: 1, floor, hp, ammo, stats, flags, savedAt: Date.now() };
    writeJson(STORAGE_KEY, data);
  },

  clear(): void {
    removeKey(STORAGE_KEY);
  },
};
