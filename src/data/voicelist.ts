import { en, type StringKey } from '../i18n/en';
import type { Language } from '../systems/Settings';

export type VoiceSpeaker = 'warden' | 'exile';

function isVoiceKey(key: string): boolean {
  return /^(warden|exile)\./.test(key);
}

export const VOICE_KEYS: readonly StringKey[] = (Object.keys(en) as StringKey[]).filter(isVoiceKey);

export function voiceAudioKey(lang: Language, key: string): string {
  return `voice_${lang}_${key}`;
}

export function voicePath(lang: Language, key: string): string {
  return `audio/voice/${lang}/${key}.ogg`;
}
