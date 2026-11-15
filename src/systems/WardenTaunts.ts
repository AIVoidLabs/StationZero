import type { StringKey } from '../i18n';
import { runFlags } from './RunFlags';
import { voice } from './Voice';

export const TAUNT_COUNT = 12;

const FIRST_DELAY_MS = 20000;
const GAP_MIN_MS = 45000;
const GAP_MAX_MS = 70000;
const MAX_PER_FLOOR = 2;
const CALM_ALERT = 0.5;
const RETRY_MS = 2000;
const PATIENCE_MS = 12000;

export class WardenTaunts {
  private waitMs = FIRST_DELAY_MS;
  private spoken = 0;
  private deferredMs = 0;

  tick(delta: number): void {
    if (this.spoken >= MAX_PER_FLOOR) return;
    this.waitMs -= delta;
    if (this.waitMs > 0) return;
    const tense = runFlags.alert >= CALM_ALERT && this.deferredMs < PATIENCE_MS;
    if (tense || voice.speaking) {
      this.waitMs = RETRY_MS;
      this.deferredMs += RETRY_MS;
      return;
    }
    this.deferredMs = 0;

    const unused: number[] = [];
    for (let index = 1; index <= TAUNT_COUNT; index += 1) {
      if (!runFlags.hasLore(`t_${index}`)) unused.push(index);
    }
    const pick = unused[Math.floor(Math.random() * unused.length)];
    if (pick === undefined) {
      this.spoken = MAX_PER_FLOOR;
      return;
    }

    runFlags.addLore(`t_${pick}`);
    voice.say(`warden.taunt${pick}` as StringKey, 'warden');
    this.spoken += 1;
    this.waitMs = GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS);
  }
}
