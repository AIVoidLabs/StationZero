import { t, type StringKey } from '../i18n';
import { FLOOR_COUNT } from './config';

export const LOGS_PER_FLOOR = 4;

export function floorLogs(floor: number): string[] {
  const number = Math.max(1, Math.min(FLOOR_COUNT, floor + 1));
  return Array.from({ length: LOGS_PER_FLOOR }, (_, index) => t(`log.b${number}.${index + 1}` as StringKey));
}
