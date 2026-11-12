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

export type CutsceneId = 'intro' | 'descent_b2' | 'descent_b3' | 'descent_b4' | 'end_comply' | 'end_defy';

export const CUTSCENES: Readonly<Record<CutsceneId, readonly CutscenePanel[]>> = {
  intro: [
    { art: 'intro_1', caption: 'cs.intro.1', ms: 5200, from: { x: 0, y: 0, zoom: 1 }, to: { x: 0, y: -10, zoom: 1.18 }, flicker: true },
    { art: 'intro_2', caption: 'cs.intro.2', ms: 5600, from: { x: -30, y: 6, zoom: 1.12 }, to: { x: 24, y: 0, zoom: 1.12 } },
    { art: 'intro_3', caption: 'cs.intro.3', ms: 5000, from: { x: 0, y: 10, zoom: 1.2 }, to: { x: 0, y: -4, zoom: 1.02 }, flicker: true },
    { art: 'intro_4', caption: 'cs.intro.4', ms: 5200, from: { x: 0, y: 0, zoom: 1.02 }, to: { x: 0, y: -10, zoom: 1.2 } },
  ],
  descent_b2: [{ art: 'descent_b2', caption: 'cs.descent.b2', ms: 4600, from: { x: 20, y: 0, zoom: 1.08 }, to: { x: -20, y: 0, zoom: 1.16 }, flicker: true }],
  descent_b3: [{ art: 'descent_b3', caption: 'cs.descent.b3', ms: 4600, from: { x: -20, y: 0, zoom: 1.08 }, to: { x: 20, y: 0, zoom: 1.16 } }],
  descent_b4: [{ art: 'descent_b4', caption: 'cs.descent.b4', ms: 4800, from: { x: 0, y: -8, zoom: 1.02 }, to: { x: 0, y: 8, zoom: 1.2 }, flicker: true }],
  end_comply: [{ art: 'end_comply', caption: 'cs.end.comply', ms: 5600, from: { x: 0, y: 0, zoom: 1.2 }, to: { x: 0, y: -6, zoom: 1.02 } }],
  end_defy: [{ art: 'end_defy', caption: 'cs.end.defy', ms: 5600, from: { x: 0, y: 0, zoom: 1.2 }, to: { x: 0, y: -6, zoom: 1.02 }, flicker: true }],
};

export function descentCutscene(floor: number): CutsceneId | null {
  if (floor === 1) return 'descent_b2';
  if (floor === 2) return 'descent_b3';
  if (floor === 3) return 'descent_b4';
  return null;
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
  'end_comply',
  'end_defy',
];
