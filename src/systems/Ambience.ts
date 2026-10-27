import type { Scene } from 'phaser';
import { AMBIENCE_AUDIO_KEY } from '../assets/manifest';
import {
  AUDIO_AMBIENCE_GAIN,
  AUDIO_MASTER_GAIN,
  AUDIO_SILENCE_FADE_MS,
  AUDIO_SILENCE_HOLD_MAX_MS,
  AUDIO_SILENCE_HOLD_MIN_MS,
  AUDIO_SILENCE_RETURN_MS,
  DEPTH_PITCH_PER_BAND,
} from '../data/config';
import { createRng } from '../utils/random';

const RNG_SEED = 0x3c0de;
const MUTE_RAMP_SECONDS = 0.08;
const PITCH_RAMP_SECONDS = 1.4;
const ANALYSER_SIZE = 1024;

function resolveContext(sound: unknown): AudioContext | null {
  if (typeof sound !== 'object' || sound === null) return null;
  if (typeof AudioContext === 'undefined') return null;

  const context = (sound as { context?: unknown }).context;
  return context instanceof AudioContext ? context : null;
}

export class Ambience {
  private readonly scene: Scene;
  private readonly context: AudioContext | null;
  private readonly rng = createRng(RNG_SEED);

  private source: AudioBufferSourceNode | null = null;
  private ambienceGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;
  private muted = false;
  private frames = 0;
  private band = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.context = resolveContext(scene.sound);
  }

  get playing(): boolean {
    return this.source !== null;
  }

  get depthBand(): number {
    return this.band;
  }

  get pitchRate(): number {
    return 1 - DEPTH_PITCH_PER_BAND * this.band;
  }

  get contextState(): AudioContextState | 'unavailable' {
    return this.context ? this.context.state : 'unavailable';
  }

  get bufferFrames(): number {
    return this.frames;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  start(): void {
    const context = this.context;
    if (!context || this.source) return;

    const buffer: unknown = this.scene.cache.audio.get(AMBIENCE_AUDIO_KEY);
    if (!(buffer instanceof AudioBuffer)) return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = this.pitchRate;

    const ambience = context.createGain();
    ambience.gain.value = AUDIO_AMBIENCE_GAIN;

    const master = context.createGain();
    master.gain.value = this.muted ? 0 : AUDIO_MASTER_GAIN;

    source.connect(ambience);
    ambience.connect(master);
    master.connect(context.destination);
    source.start();

    this.source = source;
    this.ambienceGain = ambience;
    this.masterGain = master;
    this.frames = buffer.length;
  }

  setDepthBand(band: number): void {
    this.band = Math.max(0, Math.round(band));

    const context = this.context;
    const source = this.source;
    if (!context || !source) return;

    const now = context.currentTime;
    const rate = source.playbackRate;
    rate.cancelScheduledValues(now);
    rate.setValueAtTime(rate.value, now);
    rate.linearRampToValueAtTime(this.pitchRate, now + PITCH_RAMP_SECONDS);
  }

  silence(holdScale = 1): void {
    const context = this.context;
    const gain = this.ambienceGain?.gain;
    if (!context || !gain) return;

    const now = context.currentTime;
    const hold =
      (AUDIO_SILENCE_HOLD_MIN_MS +
        (AUDIO_SILENCE_HOLD_MAX_MS - AUDIO_SILENCE_HOLD_MIN_MS) * this.rng()) *
      holdScale;
    const down = now + AUDIO_SILENCE_FADE_MS / 1000;
    const up = down + hold / 1000;
    const end = up + AUDIO_SILENCE_RETURN_MS / 1000;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, down);
    gain.setValueAtTime(0, up);
    gain.linearRampToValueAtTime(AUDIO_AMBIENCE_GAIN, end);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;

    const context = this.context;
    const gain = this.masterGain?.gain;
    if (context && gain) {
      const now = context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(
        this.muted ? 0 : AUDIO_MASTER_GAIN,
        now + MUTE_RAMP_SECONDS,
      );
    }

    return this.muted;
  }

  measure(): number {
    const context = this.context;
    const master = this.masterGain;
    if (!context || !master) return 0;

    if (!this.analyser) {
      const analyser = context.createAnalyser();
      analyser.fftSize = ANALYSER_SIZE;
      master.connect(analyser);
      this.analyser = analyser;
      this.samples = new Float32Array(analyser.fftSize);
    }

    const analyser = this.analyser;
    const samples = this.samples;
    if (!analyser || !samples) return 0;

    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
  }

  destroy(): void {
    this.source?.stop();
    this.source?.disconnect();
    this.ambienceGain?.disconnect();
    this.masterGain?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.ambienceGain = null;
    this.masterGain = null;
    this.analyser = null;
    this.samples = null;
    this.frames = 0;
  }
}
