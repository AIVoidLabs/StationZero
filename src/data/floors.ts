import { t } from '../i18n';

export interface FloorInfo {
  readonly code: string;
  readonly name: string;
  readonly tagline: string;
}

export const FLOOR_COUNT_INFO = 4;

export function floorInfo(floor: number): FloorInfo {
  const index = Math.max(0, Math.min(FLOOR_COUNT_INFO - 1, floor)) + 1;
  switch (index) {
    case 1:
      return { code: 'B1', name: t('floor.b1.name'), tagline: t('floor.b1.tagline') };
    case 2:
      return { code: 'B2', name: t('floor.b2.name'), tagline: t('floor.b2.tagline') };
    case 3:
      return { code: 'B3', name: t('floor.b3.name'), tagline: t('floor.b3.tagline') };
    default:
      return { code: 'B4', name: t('floor.b4.name'), tagline: t('floor.b4.tagline') };
  }
}
