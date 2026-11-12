import type { Scene } from 'phaser';
import { settings } from './Settings';

export type MusicKey = 'music_menu' | 'music_end';

const MUSIC_GAIN = 0.5;
const FADE_SECONDS = 0.8;

function resolveContext(sound: unknown): AudioContext | null {
  if (typeof sound !== 'object' || sound === null) return null;
  if (typeof AudioContext === 'undefined') return null;
  const context = (sound as { context?: unknown }).context;
  return context instanceof AudioContext ? context : null;
}

class MusicPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private currentKey: MusicKey | null = null;
  private unsubscribe: (() => void) | null = null;
  private pendingScene: Scene | null = null;

  get playing(): MusicKey | null {
    return this.currentKey;
  }

  get level(): number {
    return this.gain ? this.gain.gain.value : 0;
  }

  play(scene: Scene, key: MusicKey): void {
    if (this.currentKey === key) return;
    this.stop(0.2);
    this.currentKey = key;

    const sound = scene.sound;
    if (sound.locked) {
      this.pendingScene = scene;
      sound.once('unlocked', () => {
        if (this.currentKey === key && this.pendingScene === scene) this.start(scene, key);
      });
      return;
    }
    this.start(scene, key);
  }

  stop(fadeSeconds = 0.4): void {
    this.pendingScene = null;
    this.currentKey = null;
    this.unsubscribe?.();
    this.unsubscribe = null;

    const context = this.context;
    const gain = this.gain;
    const source = this.source;
    this.gain = null;
    this.source = null;
    if (!context || !gain || !source) return;

    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    window.setTimeout(() => {
      try {
        source.stop();
      } catch {
        // already stopped
      }
      source.disconnect();
      gain.disconnect();
    }, fadeSeconds * 1000 + 80);
  }

  private target(): number {
    return MUSIC_GAIN * (settings.data.musicVolume / 100) * (settings.data.masterVolume / 100);
  }

  private start(scene: Scene, key: MusicKey): void {
    const context = resolveContext(scene.sound);
    if (!context) return;
    const buffer: unknown = scene.cache.audio.get(key);
    if (!(buffer instanceof AudioBuffer)) return;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
    const now = context.currentTime;
    gain.gain.linearRampToValueAtTime(this.target(), now + FADE_SECONDS);

    this.context = context;
    this.source = source;
    this.gain = gain;
    this.unsubscribe = settings.subscribe(() => {
      const ctx = this.context;
      const node = this.gain;
      if (!ctx || !node) return;
      const t = ctx.currentTime;
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(node.gain.value, t);
      node.gain.linearRampToValueAtTime(this.target(), t + 0.1);
    });
  }
}

export const music = new MusicPlayer();
