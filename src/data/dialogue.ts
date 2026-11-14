import type { StringKey } from '../i18n';

export type Effect =
  | { readonly type: 'alert'; readonly amount: number }
  | { readonly type: 'stance'; readonly amount: number }
  | { readonly type: 'reveal'; readonly radius: number }
  | { readonly type: 'cache'; readonly kind: 'stim' | 'ammo' }
  | { readonly type: 'lore'; readonly id: string }
  | { readonly type: 'secret'; readonly floor: number }
  | { readonly type: 'wake' };

export type Speaker =
  | 'hale'
  | 'voss'
  | 'lund'
  | 'dray'
  | 'sato'
  | 'brandt'
  | 'pell'
  | 'moreau'
  | 'iyer'
  | 'kessler'
  | 'warden'
  | 'exile';

export interface DialogueChoice {
  readonly text: StringKey;
  readonly next: string | null;
  readonly effects?: readonly Effect[];
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
        speaker: 'hale',
        line: 'term.b1.n1',
        choices: [
          { text: 'term.b1.c1a', next: 'n2' },
          { text: 'term.b1.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'hale',
        line: 'term.b1.n2',
        effects: [{ type: 'lore', id: 'aide' }],
        choices: [
          { text: 'term.b1.c2a', next: 'n3' },
          { text: 'term.b1.c2b', next: null },
        ],
      },
      n3: {
        speaker: 'hale',
        line: 'term.b1.n3',
        effects: [{ type: 'lore', id: 'secret_b1' }, { type: 'cache', kind: 'ammo' }],
        choices: [
          { text: 'term.b1.c3a', next: null, effects: [{ type: 'secret', floor: 0 }] },
        ],
      },
    },
  },
  {
    id: 'b2',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'voss',
        line: 'term.b2.n1',
        choices: [
          { text: 'term.b2.c1a', next: 'n2' },
          { text: 'term.b2.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'voss',
        line: 'term.b2.n2',
        choices: [
          { text: 'term.b2.c2a', next: 'n3', effects: [{ type: 'stance', amount: 1 }] },
          { text: 'term.b2.c2b', next: 'n3', effects: [{ type: 'stance', amount: -1 }] },
        ],
      },
      n3: {
        speaker: 'voss',
        line: 'term.b2.n3',
        effects: [{ type: 'lore', id: 'secret_b2' }, { type: 'reveal', radius: 6 }],
        choices: [
          { text: 'term.b2.c3a', next: null, effects: [{ type: 'secret', floor: 1 }] },
        ],
      },
    },
  },
  {
    id: 'b3',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'lund',
        line: 'term.b3.n1',
        choices: [
          { text: 'term.b3.c1a', next: 'n2' },
          { text: 'term.b3.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'lund',
        line: 'term.b3.n2',
        choices: [
          { text: 'term.b3.c2a', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'lund',
        line: 'term.b3.n3',
        effects: [{ type: 'lore', id: 'secret_b3' }, { type: 'cache', kind: 'stim' }],
        choices: [
          { text: 'term.b3.c3a', next: null, effects: [{ type: 'secret', floor: 2 }] },
        ],
      },
    },
  },
  {
    id: 'b4',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'dray',
        line: 'term.b4.n1',
        choices: [
          { text: 'term.b4.c1a', next: 'n2' },
          { text: 'term.b4.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'dray',
        line: 'term.b4.n2',
        effects: [{ type: 'lore', id: 'drill_units' }],
        choices: [
          { text: 'term.b4.c2a', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'dray',
        line: 'term.b4.n3',
        effects: [{ type: 'lore', id: 'secret_b4' }, { type: 'reveal', radius: 5 }],
        choices: [
          { text: 'term.b4.c3a', next: null, effects: [{ type: 'secret', floor: 3 }] },
        ],
      },
    },
  },
  {
    id: 'b5',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'sato',
        line: 'term.b5.n1',
        choices: [
          { text: 'term.b5.c1a', next: 'n2' },
          { text: 'term.b5.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'sato',
        line: 'term.b5.n2',
        choices: [
          { text: 'term.b5.c2a', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'sato',
        line: 'term.b5.n3',
        effects: [{ type: 'lore', id: 'secret_b5' }, { type: 'cache', kind: 'ammo' }],
        choices: [
          { text: 'term.b5.c3a', next: null, effects: [{ type: 'secret', floor: 4 }] },
        ],
      },
    },
  },
  {
    id: 'b6',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'brandt',
        line: 'term.b6.n1',
        choices: [
          { text: 'term.b6.c1a', next: 'n2' },
          { text: 'term.b6.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'brandt',
        line: 'term.b6.n2',
        effects: [{ type: 'stance', amount: -1 }],
        choices: [
          { text: 'term.b6.c2a', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'brandt',
        line: 'term.b6.n3',
        effects: [{ type: 'lore', id: 'secret_b6' }, { type: 'lore', id: 'rear_seam' }],
        choices: [
          { text: 'term.b6.c3a', next: null, effects: [{ type: 'secret', floor: 5 }] },
        ],
      },
    },
  },
  {
    id: 'b7',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'pell',
        line: 'term.b7.n1',
        choices: [
          { text: 'term.b7.c1a', next: 'n2' },
          { text: 'term.b7.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'pell',
        line: 'term.b7.n2',
        choices: [
          { text: 'term.b7.c2a', next: 'n3', effects: [{ type: 'stance', amount: 1 }] },
          { text: 'term.b7.c2b', next: 'n3', effects: [{ type: 'stance', amount: -1 }] },
        ],
      },
      n3: {
        speaker: 'pell',
        line: 'term.b7.n3',
        effects: [{ type: 'lore', id: 'secret_b7' }, { type: 'lore', id: 'file_zero' }],
        choices: [
          { text: 'term.b7.c3a', next: null, effects: [{ type: 'secret', floor: 6 }] },
        ],
      },
    },
  },
  {
    id: 'b8',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'moreau',
        line: 'term.b8.n1',
        choices: [
          { text: 'term.b8.c1a', next: 'n2' },
          { text: 'term.b8.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'moreau',
        line: 'term.b8.n2',
        choices: [
          { text: 'term.b8.c2a', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'moreau',
        line: 'term.b8.n3',
        effects: [{ type: 'lore', id: 'secret_b8' }, { type: 'reveal', radius: 8 }],
        choices: [
          { text: 'term.b8.c3a', next: null, effects: [{ type: 'secret', floor: 7 }] },
        ],
      },
    },
  },
  {
    id: 'b9',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'iyer',
        line: 'term.b9.n1',
        choices: [
          { text: 'term.b9.c1a', next: 'n2' },
          { text: 'term.b9.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'iyer',
        line: 'term.b9.n2',
        effects: [{ type: 'stance', amount: 1 }],
        choices: [
          { text: 'term.b9.c2a', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'iyer',
        line: 'term.b9.n3',
        effects: [{ type: 'lore', id: 'secret_b9' }, { type: 'lore', id: 'first_command' }],
        choices: [
          { text: 'term.b9.c3a', next: null, effects: [{ type: 'secret', floor: 8 }] },
        ],
      },
    },
  },
  {
    id: 'b10',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'kessler',
        line: 'term.b10.n1',
        choices: [
          { text: 'term.b10.c1a', next: 'n2' },
          { text: 'term.b10.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'kessler',
        line: 'term.b10.n2',
        effects: [{ type: 'stance', amount: 1 }],
        choices: [
          { text: 'term.b10.c2a', next: 'n3', effects: [{ type: 'stance', amount: -1 }] },
          { text: 'term.b10.c2b', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'kessler',
        line: 'term.b10.n3',
        effects: [{ type: 'lore', id: 'secret_b10' }, { type: 'cache', kind: 'ammo' }, { type: 'reveal', radius: 10 }],
        choices: [
          { text: 'term.b10.c3a', next: null, effects: [{ type: 'secret', floor: 9 }] },
        ],
      },
    },
  },
  {
    id: 'b11',
    start: 'n1',
    nodes: {
      n1: {
        speaker: 'warden',
        line: 'term.b11.n1',
        choices: [
          { text: 'term.b11.c1a', next: 'n2' },
          { text: 'term.b11.c1b', next: 'n3' },
        ],
      },
      n2: {
        speaker: 'warden',
        line: 'term.b11.n2',
        choices: [
          { text: 'term.b11.c2a', next: 'n4', effects: [{ type: 'stance', amount: -1 }] },
          { text: 'term.b11.c2b', next: 'n3' },
        ],
      },
      n3: {
        speaker: 'warden',
        line: 'term.b11.n3',
        effects: [{ type: 'stance', amount: 1 }],
        choices: [
          { text: 'term.b11.c3a', next: 'n4' },
          { text: 'term.b11.c3b', next: 'n4', effects: [{ type: 'stance', amount: 1 }] },
        ],
      },
      n4: {
        speaker: 'warden',
        line: 'term.b11.n4',
        choices: [
          { text: 'term.b11.c4a', next: null, effects: [{ type: 'wake' }] },
        ],
      },
    },
  },
];

export function dialogueForFloor(floor: number): DialogueScript | undefined {
  return DIALOGUES[floor];
}
