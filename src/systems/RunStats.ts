export interface RunSnapshot {
  readonly floorReached: number;
  readonly kills: number;
  readonly shots: number;
  readonly playMs: number;
  readonly xp?: number;
}

class RunStatsStore {
  floorReached = 1;
  kills = 0;
  shots = 0;
  xp = 0;
  private playMs = 0;

  reset(): void {
    this.floorReached = 1;
    this.kills = 0;
    this.shots = 0;
    this.xp = 0;
    this.playMs = 0;
  }

  restore(snapshot: RunSnapshot): void {
    this.floorReached = snapshot.floorReached;
    this.kills = snapshot.kills;
    this.shots = snapshot.shots;
    this.xp = snapshot.xp ?? 0;
    this.playMs = snapshot.playMs;
  }

  addTime(deltaMs: number): void {
    this.playMs += Math.min(deltaMs, 250);
  }

  reachFloor(floor: number): void {
    this.floorReached = Math.max(this.floorReached, floor);
  }

  get seconds(): number {
    return Math.floor(this.playMs / 1000);
  }

  snapshot(): RunSnapshot {
    return {
      floorReached: this.floorReached,
      kills: this.kills,
      shots: this.shots,
      playMs: this.playMs,
      xp: this.xp,
    };
  }
}

export const runStats = new RunStatsStore();

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
