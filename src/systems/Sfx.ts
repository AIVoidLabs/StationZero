import type { Scene } from 'phaser';
import { settings } from './Settings';

export type SfxName =
  | 'pistol'
  | 'melee'
  | 'droneShot'
  | 'playerHurt'
  | 'droneHit'
  | 'droneDeath'
  | 'playerDeath'
  | 'pickupHealth'
  | 'pickupAmmo'
  | 'stepSteel'
  | 'stepConcrete'
  | 'stepGrate'
  | 'heartbeat'
  | 'uiMove'
  | 'uiClick';

type FilterKind = 'lowpass' | 'bandpass' | 'highpass';

const SFX_MASTER = 0.8;
const NOISE_SECONDS = 1.5;

function resolveContext(sound: unknown): AudioContext | null {
  if (typeof sound !== 'object' || sound === null) return null;
  if (typeof AudioContext === 'undefined') return null;
  const context = (sound as { context?: unknown }).context;
  return context instanceof AudioContext ? context : null;
}

class SfxEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private lastPlayed = new Map<SfxName, number>();

  get ready(): boolean {
    return this.context !== null && this.master !== null;
  }

  attach(scene: Scene): void {
    if (this.context) return;
    const context = resolveContext(scene.sound);
    if (!context) return;

    this.context = context;
    this.master = context.createGain();
    this.master.connect(context.destination);
    this.applyMaster();

    const length = Math.floor(context.sampleRate * NOISE_SECONDS);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;

    settings.subscribe(() => this.applyMaster());
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMaster();
  }

  play(name: SfxName, volume = 1, pitch = 1): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master || this.muted || volume <= 0.01) return;
    if (context.state !== 'running') return;

    const now = context.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.03) return;
    this.lastPlayed.set(name, now);

    const voice = context.createGain();
    voice.gain.value = Math.min(1, volume);
    voice.connect(master);
    const t = now;

    const tone = (type: OscillatorType, from: number, to: number, duration: number, amp: number, delay = 0): void => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from * pitch, t + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, to * pitch), t + delay + duration);
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.linearRampToValueAtTime(amp, t + delay + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + duration);
      osc.connect(gain);
      gain.connect(voice);
      osc.start(t + delay);
      osc.stop(t + delay + duration + 0.02);
    };

    const noise = (
      duration: number,
      amp: number,
      kind: FilterKind,
      from: number,
      to: number,
      delay = 0,
    ): void => {
      const buffer = this.noiseBuffer;
      if (!buffer) return;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = kind;
      filter.frequency.setValueAtTime(from * pitch, t + delay);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, to * pitch), t + delay + duration);
      gain.gain.setValueAtTime(0.0001, t + delay);
      gain.gain.linearRampToValueAtTime(amp, t + delay + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(voice);
      source.start(t + delay, Math.random() * 0.5);
      source.stop(t + delay + duration + 0.02);
    };

    switch (name) {
      case 'pistol':
        noise(0.14, 0.9, 'lowpass', 4200, 380);
        tone('sine', 150, 42, 0.16, 0.9);
        tone('square', 1100, 180, 0.05, 0.18);
        break;
      case 'melee':
        noise(0.1, 0.9, 'bandpass', 1900, 700);
        tone('triangle', 240, 110, 0.12, 0.7);
        break;
      case 'droneShot':
        tone('sawtooth', 1500, 280, 0.24, 0.3);
        tone('square', 760, 140, 0.24, 0.16);
        noise(0.16, 0.18, 'highpass', 2500, 1200);
        break;
      case 'playerHurt':
        tone('sine', 120, 50, 0.28, 0.95);
        tone('sawtooth', 320, 85, 0.22, 0.25);
        noise(0.2, 0.55, 'lowpass', 1000, 180);
        break;
      case 'droneHit':
        tone('square', 1250, 480, 0.09, 0.45);
        tone('triangle', 2500, 1700, 0.14, 0.3);
        noise(0.08, 0.45, 'bandpass', 3200, 1500);
        break;
      case 'droneDeath':
        noise(0.75, 0.85, 'lowpass', 2800, 110);
        tone('sawtooth', 420, 34, 0.75, 0.5);
        tone('square', 240, 55, 0.45, 0.2, 0.05);
        tone('triangle', 2100, 300, 0.3, 0.15, 0.08);
        break;
      case 'playerDeath':
        tone('sawtooth', 230, 26, 1.5, 0.55);
        tone('sine', 115, 20, 1.7, 0.75);
        noise(1.3, 0.45, 'lowpass', 1400, 90);
        break;
      case 'pickupHealth':
        tone('sine', 523, 523, 0.2, 0.6);
        tone('sine', 659, 659, 0.2, 0.6, 0.08);
        tone('sine', 784, 784, 0.32, 0.6, 0.16);
        tone('triangle', 1568, 1568, 0.28, 0.18, 0.16);
        break;
      case 'pickupAmmo':
        noise(0.05, 0.8, 'bandpass', 3400, 2600);
        noise(0.06, 0.75, 'bandpass', 2900, 2200, 0.09);
        tone('square', 420, 260, 0.06, 0.32);
        tone('square', 520, 300, 0.07, 0.32, 0.09);
        break;
      case 'stepSteel':
        noise(0.07, 0.7, 'bandpass', 2200, 1000);
        tone('triangle', 340, 190, 0.09, 0.45);
        tone('sine', 1500, 1300, 0.12, 0.1, 0.01);
        break;
      case 'stepConcrete':
        noise(0.11, 0.8, 'lowpass', 1300, 380);
        tone('sine', 95, 58, 0.1, 0.55);
        break;
      case 'stepGrate':
        noise(0.05, 0.6, 'bandpass', 2800, 1800);
        tone('square', 720, 420, 0.05, 0.22);
        noise(0.05, 0.45, 'bandpass', 3200, 2000, 0.045);
        tone('square', 860, 500, 0.05, 0.16, 0.045);
        tone('sine', 2300, 2100, 0.14, 0.09, 0.02);
        break;
      case 'heartbeat':
        tone('sine', 62, 38, 0.16, 0.9);
        tone('sine', 56, 34, 0.18, 0.7, 0.2);
        break;
      case 'uiMove':
        tone('square', 880, 760, 0.035, 0.12);
        break;
      case 'uiClick':
        tone('square', 520, 340, 0.07, 0.2);
        noise(0.04, 0.2, 'bandpass', 2600, 1800);
        break;
    }
  }

  private applyMaster(): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const target = this.muted ? 0 : SFX_MASTER * (settings.data.sfxVolume / 100) * (settings.data.masterVolume / 100);
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(master.gain.value, context.currentTime);
    master.gain.linearRampToValueAtTime(target, context.currentTime + 0.05);
  }
}

export const sfx = new SfxEngine();

export function distanceGain(fromX: number, fromY: number, toX: number, toY: number): number {
  const distance = Math.hypot(fromX - toX, fromY - toY);
  return Math.max(0.2, Math.min(1, 1.1 - distance / 14));
}
