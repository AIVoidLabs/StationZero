import type { StringKey } from '../i18n';

export interface Camera {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export interface CutscenePanel {
  readonly art: string;
  readonly caption: StringKey;
  readonly ms: number;
  readonly from: Camera;
  readonly to: Camera;
  readonly flicker?: boolean;
}

export type CutsceneId = 'intro' | 'end_comply' | 'end_defy' | `descent_b${number}`;

const DESCENT_PAN_LEFT: Pick<CutscenePanel, 'from' | 'to'> = { from: { x: 20, y: 0, zoom: 1.08 }, to: { x: -20, y: 0, zoom: 1.16 } };
const DESCENT_PAN_RIGHT: Pick<CutscenePanel, 'from' | 'to'> = { from: { x: -20, y: 0, zoom: 1.08 }, to: { x: 20, y: 0, zoom: 1.16 } };
const DESCENT_PUSH: Pick<CutscenePanel, 'from' | 'to'> = { from: { x: 0, y: -8, zoom: 1.02 }, to: { x: 0, y: 8, zoom: 1.2 } };

export const CUTSCENES: Readonly<Partial<Record<CutsceneId, readonly CutscenePanel[]>>> = {
  intro: [
    { art: 'intro_1', caption: 'cs.intro.1', ms: 5200, from: { x: 0, y: 0, zoom: 1 }, to: { x: 0, y: -10, zoom: 1.18 }, flicker: true },
    { art: 'intro_2', caption: 'cs.intro.2', ms: 5600, from: { x: -30, y: 6, zoom: 1.12 }, to: { x: 24, y: 0, zoom: 1.12 } },
    { art: 'intro_3', caption: 'cs.intro.3', ms: 5000, from: { x: 0, y: 10, zoom: 1.2 }, to: { x: 0, y: -4, zoom: 1.02 }, flicker: true },
    { art: 'intro_4', caption: 'cs.intro.4', ms: 5200, from: { x: 0, y: 0, zoom: 1.02 }, to: { x: 0, y: -10, zoom: 1.2 } },
  ],
  descent_b2: [{ art: 'descent_b2', caption: 'cs.descent.b2', ms: 4600, ...DESCENT_PAN_LEFT, flicker: true }],
  descent_b3: [{ art: 'descent_infirmary', caption: 'cs.descent.b3', ms: 4600, ...DESCENT_PAN_RIGHT }],
  descent_b4: [{ art: 'descent_b3', caption: 'cs.descent.b4', ms: 4600, ...DESCENT_PAN_RIGHT }],
  descent_b5: [{ art: 'descent_pump', caption: 'cs.descent.b5', ms: 4600, ...DESCENT_PAN_LEFT }],
  descent_b6: [{ art: 'descent_foundry', caption: 'cs.descent.b6', ms: 4600, ...DESCENT_PUSH, flicker: true }],
  descent_b7: [{ art: 'descent_archive', caption: 'cs.descent.b7', ms: 4600, ...DESCENT_PAN_RIGHT }],
  descent_b8: [{ art: 'descent_power', caption: 'cs.descent.b8', ms: 4600, ...DESCENT_PUSH, flicker: true }],
  descent_b9: [{ art: 'descent_dronefoundry', caption: 'cs.descent.b9', ms: 4600, ...DESCENT_PAN_LEFT }],
  descent_b10: [{ art: 'descent_comms', caption: 'cs.descent.b10', ms: 4600, ...DESCENT_PAN_RIGHT }],
  descent_b11: [{ art: 'descent_b4', caption: 'cs.descent.b11', ms: 4800, ...DESCENT_PUSH, flicker: true }],
  end_comply: [{ art: 'end_comply', caption: 'cs.end.comply', ms: 5600, from: { x: 0, y: 0, zoom: 1.2 }, to: { x: 0, y: -6, zoom: 1.02 } }],
  end_defy: [{ art: 'end_defy', caption: 'cs.end.defy', ms: 5600, from: { x: 0, y: 0, zoom: 1.2 }, to: { x: 0, y: -6, zoom: 1.02 }, flicker: true }],
};

export function descentCutscene(floor: number): CutsceneId | null {
  const id: CutsceneId = `descent_b${floor + 1}`;
  return CUTSCENES[id] ? id : null;
}

export function cutsceneArtKey(art: string): string {
  return `cs_${art}`;
}

export const CUTSCENE_ART: readonly string[] = [
  'intro_1',
  'intro_2',
  'intro_3',
  'intro_4',
  'descent_b2',
  'descent_b3',
  'descent_b4',
  'descent_infirmary',
  'descent_pump',
  'descent_foundry',
  'descent_archive',
  'descent_power',
  'descent_dronefoundry',
  'descent_comms',
  'end_comply',
  'end_defy',
];
