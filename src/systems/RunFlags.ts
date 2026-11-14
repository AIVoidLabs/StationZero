export interface FlagSnapshot {
  readonly alert: number;
  readonly lore: readonly string[];
  readonly secrets?: readonly number[];
}

const MAX_ALERT = 4;

class RunFlagStore {
  alert = 0;
  private lore = new Set<string>();
  private secrets = new Set<number>();

  reset(): void {
    this.alert = 0;
    this.lore.clear();
    this.secrets.clear();
  }

  restore(snapshot: FlagSnapshot | undefined): void {
    this.reset();
    if (!snapshot) return;
    this.alert = snapshot.alert;
    for (const id of snapshot.lore) this.lore.add(id);
    for (const floor of snapshot.secrets ?? []) this.secrets.add(floor);
  }

  snapshot(): FlagSnapshot {
    return { alert: this.alert, lore: [...this.lore], secrets: [...this.secrets] };
  }

  addAlert(amount: number): void {
    this.alert = Math.max(0, Math.min(MAX_ALERT, this.alert + amount));
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
