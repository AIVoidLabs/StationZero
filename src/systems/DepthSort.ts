import { GameObjects } from 'phaser';

export interface DepthSortable {
  depth?: number;
  y?: number;
}

export function sortByIsoDepth(list: DepthSortable[]): void {
  list.sort((a, b) => {
    const ay = a.y ?? 0;
    const by = b.y ?? 0;
    if (ay === by) return 0;
    return ay < by ? -1 : 1;
  });
}

export function applyDepthSort(scene: Phaser.Scene, group: Phaser.GameObjects.Group): void {
  const children = group.getChildren() as GameObjects.GameObject[];
  const sortable: DepthSortable[] = children.filter((child): child is DepthSortable & GameObjects.GameObject => {
    return typeof (child as DepthSortable).y === 'number';
  });
  
  sortable.sort((a, b) => {
    const ay = a.y ?? 0;
    const by = b.y ?? 0;
    if (ay === by) return 0;
    return ay < by ? -1 : 1;
  });
  
  sortable.forEach((child, index) => {
    (child as GameObjects.GameObject).setDepth(index);
  });
}
