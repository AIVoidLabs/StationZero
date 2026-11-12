import { readJson, writeJson } from '../utils/storage';
import type { RunSnapshot } from './RunStats';

export type Outcome = 'dead' | 'survived';

export interface RecordEntry {
  readonly score: number;
  readonly outcome: Outcome;
  readonly floor: number;
  readonly kills: number;
  readonly shots: number;
  readonly seconds: number;
  readonly date: number;
}

const STORAGE_KEY = 'station-zero:records';
const MAX_RECORDS = 10;

export function computeScore(outcome: Outcome, stats: RunSnapshot): number {
  const seconds = Math.floor(stats.playMs / 1000);
  const raw = stats.floorReached * 1000 + stats.kills * 150 + (outcome === 'survived' ? 3000 : 0) - seconds;
  return Math.max(0, raw);
}

export const records = {
  list(): RecordEntry[] {
    const data = readJson<RecordEntry[]>(STORAGE_KEY);
    return Array.isArray(data) ? data : [];
  },

  add(outcome: Outcome, stats: RunSnapshot): { entry: RecordEntry; rank: number | null } {
    const entry: RecordEntry = {
      score: computeScore(outcome, stats),
      outcome,
      floor: stats.floorReached,
      kills: stats.kills,
      shots: stats.shots,
      seconds: Math.floor(stats.playMs / 1000),
      date: Date.now(),
    };
    const all = [...records.list(), entry].sort((a, b) => b.score - a.score || a.seconds - b.seconds);
    const top = all.slice(0, MAX_RECORDS);
    writeJson(STORAGE_KEY, top);
    const index = top.indexOf(entry);
    return { entry, rank: index >= 0 ? index + 1 : null };
  },
};
