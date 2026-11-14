import type { GameObjects, Scene } from 'phaser';
import {
  CAMERA_ZOOM,
  DEPTH_DARKNESS,
  GAME_HEIGHT,
  GAME_WIDTH,
  WARDEN_ALARM_RAMP_MS,
  WARDEN_PULSE_MAX_MS,
  WARDEN_PULSE_MIN_MS,
  WARDEN_SILENCE_CHANCE,
  WARDEN_SILENCE_DELAY_MS,
} from '../data/config';
import { createRng } from '../utils/random';
import type { DepthPressure } from './DepthManager';

const OVERLAY_MARGIN = 1.5;
const RNG_SEED = 0x9a3d1;

const FADE_IN_MS = 90;
const HOLD_MS = 70;
const FAST_FADE_MS = 220;
const SLOW_FADE_MS = 900;
const FAST_FADE_KEEP = 0.35;

const PULSE_TOTAL_MS = FADE_IN_MS + HOLD_MS + FAST_FADE_MS + SLOW_FADE_MS;
const PULSE_PEAK_MS = FADE_IN_MS + HOLD_MS;
const SILENCE_TRIGGER_MS = PULSE_PEAK_MS + WARDEN_SILENCE_DELAY_MS;

export class WardenAtmosphere {
  private readonly overlay: GameObjects.Rectangle;
  private readonly rng = createRng(RNG_SEED);

  private elapsed = 0;
  private alarmValue = 0;
  private nextPulse = 0;
  private pulseClock = -1;
  private pulseStrength = 0;
  private silenceRoll = false;
  private silenceFired = false;
  private silenceRequest = false;
  private silenceChance = WARDEN_SILENCE_CHANCE;
  private pulseIntervalScale = 1;
  private pulseStrengthScale = 1;

  constructor(scene: Scene, x: number, y: number) {
    this.overlay = scene.add
      .rectangle(
        x,
        y,
        Math.ceil(GAME_WIDTH * OVERLAY_MARGIN),
        Math.ceil(GAME_HEIGHT * OVERLAY_MARGIN),
        0x020202,
        1,
      )
      .setOrigin(0.5, 0.5)
      .setScale(1 / CAMERA_ZOOM)
      .setDepth(DEPTH_DARKNESS - 1)
      .setAlpha(0);

    this.scheduleNext();
  }

  get alarm(): number {
    return this.alarmValue;
  }

  setPressure(pressure: DepthPressure): void {
    const previousScale = this.pulseIntervalScale;

    this.silenceChance = pressure.silenceChance;
    this.pulseIntervalScale = pressure.pulseIntervalScale;
    this.pulseStrengthScale = 1 + pressure.t * 0.2;

    if (previousScale > 0 && this.pulseClock < 0 && this.nextPulse > 0) {
      this.nextPulse *= this.pulseIntervalScale / previousScale;
    }
  }

  update(delta: number, x: number, y: number): void {
    this.elapsed += delta;
    this.alarmValue = Math.min(1, this.elapsed / WARDEN_ALARM_RAMP_MS);
    this.overlay.setPosition(x, y);

    if (this.pulseClock >= 0) {
      this.advancePulse(delta);
      return;
    }

    this.nextPulse -= delta;
    if (this.nextPulse <= 0) this.pulseNow();
  }

  pulseNow(forceSilence = false): void {
    if (this.pulseClock >= 0) return;
    this.pulseClock = 0;
    const cueScale = forceSilence ? 1.6 : 1;
    this.pulseStrength = (0.1 + 0.14 * this.alarmValue) * this.pulseStrengthScale * cueScale;
    this.silenceRoll = forceSilence || this.rng() < this.silenceChance;
    this.silenceFired = false;
  }

  takeSilenceRequest(): boolean {
    if (!this.silenceRequest) return false;
    this.silenceRequest = false;
    return true;
  }

  destroy(): void {
    this.overlay.destroy();
  }

  private advancePulse(delta: number): void {
    this.pulseClock += delta;
    const clock = this.pulseClock;
    const peak = this.pulseStrength;

    if (this.silenceRoll && !this.silenceFired && clock >= SILENCE_TRIGGER_MS) {
      this.silenceFired = true;
      this.silenceRequest = true;
    }

    if (clock >= PULSE_TOTAL_MS) {
      this.overlay.setAlpha(0);
      this.pulseClock = -1;
      this.scheduleNext();
      return;
    }

    this.overlay.setAlpha(this.pulseAlpha(clock, peak));
  }

  private pulseAlpha(clock: number, peak: number): number {
    const fastStart = FADE_IN_MS + HOLD_MS;
    const fastEnd = fastStart + FAST_FADE_MS;
    const slowEnd = fastEnd + SLOW_FADE_MS;

    if (clock < FADE_IN_MS) return peak * (clock / FADE_IN_MS);
    if (clock < fastStart) return peak;
    if (clock < fastEnd) {
      const t = (clock - fastStart) / FAST_FADE_MS;
      return peak - (peak - peak * FAST_FADE_KEEP) * t;
    }
    if (clock < slowEnd) {
      const t = (clock - fastEnd) / SLOW_FADE_MS;
      return peak * FAST_FADE_KEEP * (1 - t);
    }
    return 0;
  }

  private scheduleNext(): void {
    const min = WARDEN_PULSE_MIN_MS * this.pulseIntervalScale;
    const max = WARDEN_PULSE_MAX_MS * this.pulseIntervalScale;
    const interval = max - (max - min) * this.alarmValue;
    const jittered = interval * (0.75 + 0.5 * this.rng());
    this.nextPulse = Math.min(max, Math.max(min, jittered));
  }
}
