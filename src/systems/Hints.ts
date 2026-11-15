import { settings } from './Settings';

const HINT_MS = 5600;

interface Hint {
  readonly id: string;
  readonly text: string;
}

class HintQueue {
  private readonly queue: Hint[] = [];
  private active: { hint: Hint; until: number } | null = null;

  trigger(id: string, text: string): void {
    if (!settings.data.hints || settings.hasSeenHint(id)) return;
    if (this.queue.some((hint) => hint.id === id) || this.active?.hint.id === id) return;
    settings.markHintSeen(id);
    this.queue.push({ id, text });
  }

  announce(id: string, text: string): void {
    if (!settings.data.hints) return;
    if (this.queue.some((hint) => hint.id === id) || this.active?.hint.id === id) return;
    this.queue.unshift({ id, text });
    this.active = null;
  }

  tick(now: number): string | null {
    if (this.active && now >= this.active.until) this.active = null;
    if (!this.active) {
      const next = this.queue.shift();
      if (next) this.active = { hint: next, until: now + HINT_MS };
    }
    return this.active ? this.active.hint.text : null;
  }

  clear(): void {
    this.queue.length = 0;
    this.active = null;
  }
}

export const hints = new HintQueue();
