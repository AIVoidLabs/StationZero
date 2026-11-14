import { runFlags } from './RunFlags';
import {
  DEPTH_AWARENESS_MAX_SCALE,
  DEPTH_LANTERN_MIN_SCALE,
  DEPTH_LIGHT_MIN_SCALE,
  DEPTH_MAX_BAND,
  DEPTH_PULSE_INTERVAL_MIN_SCALE,
  DEPTH_SILENCE_CHANCE_MAX,
  DEPTH_SILENCE_HOLD_MAX_SCALE,
  WARDEN_SILENCE_CHANCE,
} from '../data/config';

export interface DepthPressure {
  readonly band: number;
  readonly t: number;
  readonly lightScale: number;
  readonly lanternScale: number;
  readonly silenceChance: number;
  readonly silenceHoldScale: number;
  readonly pulseIntervalScale: number;
  readonly awareness: number;
}

const ALERT_PRESSURE_PER_POINT = 0.12;
const ALERT_AWARENESS_PER_POINT = 0.1;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampBand(floor: number): number {
  return Math.max(0, Math.min(DEPTH_MAX_BAND, Math.round(floor)));
}

function pressureFor(band: number, alert = 0): DepthPressure {
  const t = clamp01(band / DEPTH_MAX_BAND + ALERT_PRESSURE_PER_POINT * alert);
  return {
    band,
    t,
    lightScale: 1 - (1 - DEPTH_LIGHT_MIN_SCALE) * t,
    lanternScale: 1 - (1 - DEPTH_LANTERN_MIN_SCALE) * t,
    silenceChance: WARDEN_SILENCE_CHANCE + (DEPTH_SILENCE_CHANCE_MAX - WARDEN_SILENCE_CHANCE) * t,
    silenceHoldScale: 1 + (DEPTH_SILENCE_HOLD_MAX_SCALE - 1) * t,
    pulseIntervalScale: 1 - (1 - DEPTH_PULSE_INTERVAL_MIN_SCALE) * t,
    awareness: (1 + (DEPTH_AWARENESS_MAX_SCALE - 1) * t) * (1 + ALERT_AWARENESS_PER_POINT * alert),
  };
}

export class DepthManager {
  private readonly baseBand: number;
  private cached: DepthPressure;
  private cachedAlert = -1;

  constructor(floor: number) {
    this.baseBand = clampBand(floor);
    this.cached = pressureFor(this.baseBand);
    this.cachedAlert = 0;
  }

  get floor(): number {
    return this.baseBand;
  }

  get pressure(): DepthPressure {
    const alert = Math.round(runFlags.alert * 20) / 20;
    if (alert !== this.cachedAlert) {
      this.cached = pressureFor(this.baseBand, alert);
      this.cachedAlert = alert;
    }
    return this.cached;
  }
}

