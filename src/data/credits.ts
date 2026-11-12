import { t, type StringKey } from '../i18n';

type CreditLine = StringKey | { readonly text: string } | '';

const LINES: readonly CreditLine[] = [
  { text: 'STATION ZERO' },
  '',
  'menu.subtitle',
  '',
  '',
  'credits.developer',
  { text: 'Bora Akgün' },
  { text: 'github.com/QuickOrBeDead' },
  '',
  'credits.studio',
  { text: 'AIVoidLabs' },
  '',
  'credits.source',
  { text: 'github.com/AIVoidLabs/MoatWanted' },
  '',
  'credits.engine',
  { text: 'Phaser 4' },
  '',
  'credits.artAudio',
  'credits.artAudioText',
  '',
  'credits.tooling',
  { text: 'TypeScript / Vite / sharp / ffmpeg' },
  { text: 'Built with OpenCode' },
  { text: 'Built with Claude Code' },
  '',
  '',
  'credits.lore1',
  'credits.lore2',
  'credits.lore3',
];

export function creditLines(): string[] {
  return LINES.map((line) => {
    if (line === '') return '';
    return typeof line === 'string' ? t(line) : line.text;
  });
}
