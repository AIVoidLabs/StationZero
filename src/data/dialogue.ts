import type { StringKey } from '../i18n';

export type Effect =
  | { readonly type: 'alert'; readonly amount: number }
  | { readonly type: 'stance'; readonly amount: number }
  | { readonly type: 'reveal'; readonly radius: number }
  | { readonly type: 'cache'; readonly kind: 'stim' | 'ammo' }
  | { readonly type: 'lore'; readonly id: string };

export type Speaker = 'clerk' | 'ross' | 'foreman' | 'warden' | 'exile';

export interface DialogueChoice {
  readonly text: StringKey;
  readonly next: string | null;
}

export interface DialogueNode {
  readonly speaker: Speaker;
  readonly line: StringKey;
  readonly effects?: readonly Effect[];
  readonly choices: readonly DialogueChoice[];
}

export interface DialogueScript {
  readonly id: string;
  readonly start: string;
  readonly nodes: Readonly<Record<string, DialogueNode>>;
}

export const DIALOGUES: readonly DialogueScript[] = [
  {
    id: 'b1',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'clerk',
        line: 'term.b1.n1',
        choices: [
          { text: 'term.b1.c1a', next: 'n2' },
          { text: 'term.b1.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'clerk',
        line: 'term.b1.n2',
        choices: [
          { text: 'term.b1.c2a', next: 'n4' },
          { text: 'term.b1.c2b', next: 'n5' },
        ],
      },
      n3: {
        speaker: 'clerk',
        line: 'term.b1.n3',
        effects: [{ type: 'stance', amount: 1 }],
        choices: [{ text: 'term.b1.c3a', next: 'n4' }],
      },
      n4: {
        speaker: 'clerk',
        line: 'term.b1.n4',
        effects: [{ type: 'cache', kind: 'ammo' }],
        choices: [{ text: 'term.b1.c4a', next: null }],
      },
      n5: {
        speaker: 'clerk',
        line: 'term.b1.n5',
        effects: [
          { type: 'alert', amount: 1 },
          { type: 'stance', amount: -1 },
        ],
        choices: [{ text: 'term.b1.c5a', next: null }],
      },
    },
  },
  {
    id: 'b2',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'ross',
        line: 'term.b2.n1',
        choices: [
          { text: 'term.b2.c1a', next: 'n2' },
          { text: 'term.b2.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'ross',
        line: 'term.b2.n2',
        choices: [
          { text: 'term.b2.c2a', next: 'n3' },
          { text: 'term.b2.c2b', next: null },
        ],
      },
      n3: {
        speaker: 'ross',
        line: 'term.b2.n3',
        effects: [
          { type: 'lore', id: 'ross_cells' },
          { type: 'reveal', radius: 6 },
        ],
        choices: [
          { text: 'term.b2.c3a', next: 'n4' },
          { text: 'term.b2.c3b', next: null },
        ],
      },
      n4: {
        speaker: 'ross',
        line: 'term.b2.n4',
        effects: [{ type: 'cache', kind: 'stim' }],
        choices: [{ text: 'term.b2.c4a', next: null }],
      },
    },
  },
  {
    id: 'b3',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'foreman',
        line: 'term.b3.n1',
        choices: [
          { text: 'term.b3.c1a', next: 'n2' },
          { text: 'term.b3.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'foreman',
        line: 'term.b3.n2',
        effects: [{ type: 'lore', id: 'drill_units' }],
        choices: [
          { text: 'term.b3.c2a', next: 'n4' },
          { text: 'term.b3.c2b', next: null },
        ],
      },
      n3: {
        speaker: 'foreman',
        line: 'term.b3.n3',
        choices: [
          { text: 'term.b3.c3a', next: 'n5' },
          { text: 'term.b3.c3b', next: 'n6' },
        ],
      },
      n4: {
        speaker: 'foreman',
        line: 'term.b3.n4',
        effects: [{ type: 'reveal', radius: 5 }],
        choices: [{ text: 'term.b3.c4a', next: null }],
      },
      n5: {
        speaker: 'foreman',
        line: 'term.b3.n5',
        effects: [
          { type: 'stance', amount: 1 },
          { type: 'reveal', radius: 8 },
        ],
        choices: [{ text: 'term.b3.c5a', next: null }],
      },
      n6: {
        speaker: 'warden',
        line: 'term.b3.n6',
        effects: [
          { type: 'stance', amount: -1 },
          { type: 'alert', amount: 1 },
        ],
        choices: [{ text: 'term.b3.c6a', next: null }],
      },
    },
  },
  {
    id: 'b4',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'warden',
        line: 'term.b4.n1',
        choices: [
          { text: 'term.b4.c1a', next: 'n2' },
          { text: 'term.b4.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'warden',
        line: 'term.b4.n2',
        choices: [
          { text: 'term.b4.c2a', next: 'n4' },
          { text: 'term.b4.c2b', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'warden',
        line: 'term.b4.n3',
        choices: [
          { text: 'term.b4.c3a', next: 'n5' },
          { text: 'term.b4.c3b', next: 'n4' },
        ],
      },
      n4: {
        speaker: 'warden',
        line: 'term.b4.n4',
        effects: [{ type: 'stance', amount: 2 }],
        choices: [{ text: 'term.b4.c4a', next: null }],
      },
      n5: {
        speaker: 'warden',
        line: 'term.b4.n5',
        effects: [
          { type: 'stance', amount: -2 },
          { type: 'alert', amount: 2 },
        ],
        choices: [{ text: 'term.b4.c5a', next: null }],
      },
    },
  },
];

export function dialogueForFloor(floor: number): DialogueScript | undefined {
  return DIALOGUES[Math.max(0, Math.min(DIALOGUES.length - 1, floor))];
}
