import { FLOOR_COUNT } from './config';
import { t, type StringKey } from '../i18n';

function floorNumber(floor: number): number {
  return Math.max(1, Math.min(FLOOR_COUNT, floor + 1));
}

export function arrivalLine(floor: number): StringKey {
  return `warden.b${floorNumber(floor)}_arrival` as StringKey;
}

export function clearLine(floor: number): StringKey {
  return `warden.b${floorNumber(floor)}_clear` as StringKey;
}

export function introLines(): string[] {
  return [
    t('intro.1'),
    t('intro.2'),
    t('intro.3'),
    t('intro.4'),
    t('intro.5'),
    t('intro.6'),
    t('intro.7'),
    t('intro.8'),
    t('intro.9'),
    t('intro.10'),
  ];
}
