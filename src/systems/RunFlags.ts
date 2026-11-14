export interface FlagSnapshot {
  readonly lore: readonly string[];
  readonly secrets?: readonly number[];
}

export const MAX_ALERT = 4;
const ALERT_RISE_PER_SECOND = 0.45;
const ALERT_FALL_PER_SECOND = 0.15;
const ALERT_CALM_DELAY_MS = 2500;

class RunFlagStore {
  alert = 0;
  private calmMs = 0;
  private lore = new Set<string>();
  private secrets = new Set<number>();

  reset(): void {
    this.alert = 0;
    this.calmMs = 0;
    this.lore.clear();
    this.secrets.clear();
  }

  restore(snapshot: FlagSnapshot | undefined): void {
    this.reset();
    if (!snapshot) return;
    for (const id of snapshot.lore) this.lore.add(id);
    for (const floor of snapshot.secrets ?? []) this.secrets.add(floor);
  }

  snapshot(): FlagSnapshot {
    return { lore: [...this.lore], secrets: [...this.secrets] };
  }

  addAlert(amount: number): void {
    this.alert = Math.max(0, Math.min(MAX_ALERT, this.alert + amount));
    if (amount > 0) this.calmMs = 0;
  }

  tickAlert(deltaMs: number, spotted: boolean): void {
    if (spotted) {
      this.calmMs = 0;
      this.addAlert((deltaMs / 1000) * ALERT_RISE_PER_SECOND);
      return;
    }
    this.calmMs += deltaMs;
    if (this.calmMs < ALERT_CALM_DELAY_MS || this.alert <= 0) return;
    this.alert = Math.max(0, this.alert - (deltaMs / 1000) * ALERT_FALL_PER_SECOND);
  }

  addLore(id: string): void {
    this.lore.add(id);
  }

  hasLore(id: string): boolean {
    return this.lore.has(id);
  }

  addSecret(floor: number): void {
    this.secrets.add(floor);
  }

  hasSecret(floor: number): boolean {
    return this.secrets.has(floor);
  }

  get secretCount(): number {
    return this.secrets.size;
  }

}

export const runFlags = new RunFlagStore();
