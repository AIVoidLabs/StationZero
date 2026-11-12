export interface FlagSnapshot {
  readonly alert: number;
  readonly stance: number;
  readonly lore: readonly string[];
  readonly used: readonly string[];
}

const MAX_ALERT = 4;

class RunFlagStore {
  alert = 0;
  stance = 0;
  private lore = new Set<string>();
  private used = new Set<string>();

  reset(): void {
    this.alert = 0;
    this.stance = 0;
    this.lore.clear();
    this.used.clear();
  }

  restore(snapshot: FlagSnapshot | undefined): void {
    this.reset();
    if (!snapshot) return;
    this.alert = snapshot.alert;
    this.stance = snapshot.stance;
    for (const id of snapshot.lore) this.lore.add(id);
    for (const id of snapshot.used) this.used.add(id);
  }

  snapshot(): FlagSnapshot {
    return { alert: this.alert, stance: this.stance, lore: [...this.lore], used: [...this.used] };
  }

  addAlert(amount: number): void {
    this.alert = Math.max(0, Math.min(MAX_ALERT, this.alert + amount));
  }

  addStance(amount: number): void {
    this.stance += amount;
  }

  addLore(id: string): void {
    this.lore.add(id);
  }

  hasLore(id: string): boolean {
    return this.lore.has(id);
  }

  markUsed(id: string): void {
    this.used.add(id);
  }

  isUsed(id: string): boolean {
    return this.used.has(id);
  }

  get compliant(): boolean {
    return this.stance >= 0;
  }
}

export const runFlags = new RunFlagStore();
