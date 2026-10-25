export interface IsoDepthSortable {
  readonly y: number;
  setDepth(value: number): unknown;
}

export function sortByIsoDepth(items: IsoDepthSortable[]): void {
  items.sort((a, b) => a.y - b.y);
}

export function applyIsoDepth(items: Iterable<IsoDepthSortable>): void {
  for (const item of items) {
    item.setDepth(item.y);
  }
}
