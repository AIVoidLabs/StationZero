import { t, type StringKey } from '../i18n';
import { FLOOR_COUNT } from './config';

export interface FloorInfo {
  readonly code: string;
  readonly name: string;
  readonly tagline: string;
}

export function floorInfo(floor: number): FloorInfo {
  const number = Math.max(0, Math.min(FLOOR_COUNT - 1, floor)) + 1;
  return {
    code: `B${number}`,
    name: t(`floor.b${number}.name` as StringKey),
    tagline: t(`floor.b${number}.tagline` as StringKey),
  };
}
