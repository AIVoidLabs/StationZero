import type { Scene } from 'phaser';
import { VOICE_KEYS, voiceAudioKey, voicePath, type VoiceSpeaker } from '../data/voicelist';
import { t, tDynamic, type StringKey } from '../i18n';
import { settings, type Language } from './Settings';

export interface Subtitle {
  readonly key: string;
  readonly speaker: VoiceSpeaker;
  readonly text: string;
}

const VOICE_GAIN = 0.95;
const TAIL_MS = 700;
const FALLBACK_MS_PER_CHAR = 62;
const MIN_DURATION_MS = 1800;
const FADE_OUT_S = 0.06;

interface ActiveLine {
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

function resolveContext(sound: unknown): AudioContext | null {
  if (typeof sound !== 'object' || sound === null) return null;
  if (typeof AudioContext === 'undefined') return null;
  const context = (sound as { context?: unknown }).context;
  return context instanceof AudioContext ? context : null;
}

type SpeakingListener = (speaking: boolean) => void;

interface QueuedLine {
  readonly key: string;
  readonly speaker: VoiceSpeaker;
}

class VoiceEngine {
  private context: AudioContext | null = null;
  private scene: Scene | null = null;
  private gain: GainNode | null = null;
  private readonly queue: QueuedLine[] = [];
  private readonly listeners = new Set<SpeakingListener>();
  private readonly requested = new Set<Language>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private subscribed = false;
  private busy = false;
  private subtitle: Subtitle | null = null;
  private timer: number | null = null;
  private active: ActiveLine | null = null;

  get current(): Subtitle | null {
    return this.subtitle;
  }

  get speaking(): boolean {
    return this.busy;
  }

  attach(scene: Scene): void {
    this.scene = scene;
    if (!this.context) {
      const context = resolveContext(scene.sound);
      if (!context) return;
      this.context = context;
      this.gain = context.createGain();
      this.gain.connect(context.destination);
      this.applyGain();
    }
    if (!this.subscribed) {
      this.subscribed = true;
      settings.subscribe(() => {
        this.applyGain();
        this.loadLanguage(settings.data.language);
      });
    }
    this.loadLanguage(settings.data.language);
  }

  markLoaded(lang: Language): void {
    this.requested.add(lang);
  }

  loadLanguage(lang: Language): void {
    const context = this.context;
    if (!context || this.requested.has(lang)) return;
    this.requested.add(lang);
    for (const key of VOICE_KEYS) {
      const audioKey = voiceAudioKey(lang, key);
      if (this.scene?.cache.audio.exists(audioKey)) continue;
      void this.fetchLine(context, audioKey, voicePath(lang, key));
    }
  }

  private async fetchLine(context: AudioContext, audioKey: string, path: string): Promise<void> {
    try {
      const response = await fetch(path);
      if (!response.ok) return;
      this.buffers.set(audioKey, await context.decodeAudioData(await response.arrayBuffer()));
    } catch {
      // the line stays subtitle-only
    }
  }

  onSpeaking(listener: SpeakingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  say(key: StringKey | string, speaker: VoiceSpeaker): void {
    if (this.queue.some((line) => line.key === key) || this.subtitle?.key === key) return;
    this.queue.push({ key, speaker });
    this.pump();
  }

  clear(): void {
    this.queue.length = 0;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.stopActive();
    this.subtitle = null;
    this.setBusy(false);
  }

  private stopActive(): void {
    const active = this.active;
    const context = this.context;
    this.active = null;
    if (!active || !context) return;
    const { source, gain } = active;
    try {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
      source.stop(now + FADE_OUT_S);
    } catch {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
  }

  speakerLabel(speaker: VoiceSpeaker): string {
    return t(`speaker.${speaker}` as StringKey);
  }

  private setBusy(busy: boolean): void {
    if (this.busy === busy) return;
    this.busy = busy;
    for (const listener of this.listeners) listener(busy);
  }

  private applyGain(): void {
    const context = this.context;
    const gain = this.gain;
    if (!context || !gain) return;
    const level = settings.data.voice ? VOICE_GAIN * (settings.data.masterVolume / 100) * (settings.data.sfxVolume / 100) : 0;
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
    gain.gain.linearRampToValueAtTime(level, context.currentTime + 0.05);
  }

  private pump(): void {
    if (this.busy) return;
    const line = this.queue.shift();
    if (!line) return;

    const text = tDynamic(line.key);
    this.subtitle = { key: line.key, speaker: line.speaker, text };
    this.setBusy(true);

    let durationMs = Math.max(MIN_DURATION_MS, text.length * FALLBACK_MS_PER_CHAR);
    const context = this.context;
    const audioKey = voiceAudioKey(settings.data.language, line.key);
    const buffer: unknown = this.buffers.get(audioKey) ?? this.scene?.cache.audio.get(audioKey);
    if (context && this.gain && buffer instanceof AudioBuffer) {
      durationMs = buffer.duration * 1000;
      if (settings.data.voice && context.state === 'running') {
        const source = context.createBufferSource();
        const lineGain = context.createGain();
        source.buffer = buffer;
        source.connect(lineGain);
        lineGain.connect(this.gain);
        const active: ActiveLine = { source, gain: lineGain };
        source.onended = () => {
          if (this.active === active) this.active = null;
          lineGain.disconnect();
        };
        this.active = active;
        source.start();
      }
    }

    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.subtitle = null;
      this.setBusy(false);
      this.pump();
    }, durationMs + TAIL_MS);
  }
}

export const voice = new VoiceEngine();
