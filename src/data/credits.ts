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
  { text: 'github.com/AIVoidLabs/StationZero' },
  '',
  'credits.engine',
  { text: 'Phaser 4' },
  '',
  'credits.artAudio',
  'credits.artAudioText',
  '',
  'credits.voices',
  { text: 'EN: Flite (CMU) - awb / slt' },
  { text: 'TR: Piper - tr_TR-fahrettin-medium' },
  { text: 'Nabu Casa voice-datasets, CC0' },
  '',
  'credits.tooling',
  { text: 'TypeScript / Vite / sharp / ffmpeg / Piper' },
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
