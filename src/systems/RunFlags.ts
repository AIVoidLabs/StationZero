export interface FlagSnapshot {
  readonly lore: readonly string[];
  readonly secrets?: readonly number[];
}

class RunFlagStore {
  private lore = new Set<string>();
  private secrets = new Set<number>();

  reset(): void {
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
