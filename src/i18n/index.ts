import { settings, type Language } from '../systems/Settings';
import { en, type StringKey } from './en';
import { tr } from './tr';

const tables: Record<Language, Record<StringKey, string>> = { en, tr };

export type { StringKey };

function fill(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function t(key: StringKey, params?: Record<string, string | number>): string {
  return fill(tables[settings.data.language][key], params);
}

export function hasKey(key: string): key is StringKey {
  return key in en;
}

export function tDynamic(key: string, params?: Record<string, string | number>): string {
  return hasKey(key) ? t(key, params) : key;
}

export function language(): Language {
  return settings.data.language;
}
