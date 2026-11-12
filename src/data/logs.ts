import { t } from '../i18n';

export function floorLogs(floor: number): string[] {
  const index = Math.max(0, Math.min(3, floor)) + 1;
  switch (index) {
    case 1:
      return [t('log.b1.1'), t('log.b1.2'), t('log.b1.3'), t('log.b1.4')];
    case 2:
      return [t('log.b2.1'), t('log.b2.2'), t('log.b2.3'), t('log.b2.4')];
    case 3:
      return [t('log.b3.1'), t('log.b3.2'), t('log.b3.3'), t('log.b3.4')];
    default:
      return [t('log.b4.1'), t('log.b4.2'), t('log.b4.3'), t('log.b4.4')];
  }
}
