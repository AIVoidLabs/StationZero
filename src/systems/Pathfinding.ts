export interface GridPoint {
  readonly gridX: number;
  readonly gridY: number;
}

export interface WalkableGrid {
  readonly width: number;
  readonly height: number;
  isWalkable(gridX: number, gridY: number): boolean;
}

interface Neighbor {
  readonly dx: number;
  readonly dy: number;
  readonly cost: number;
}

const NEIGHBORS: readonly Neighbor[] = [
  { dx: 1, dy: 0, cost: 1 },
  { dx: -1, dy: 0, cost: 1 },
  { dx: 0, dy: 1, cost: 1 },
  { dx: 0, dy: -1, cost: 1 },
  { dx: 1, dy: 1, cost: Math.SQRT2 },
  { dx: 1, dy: -1, cost: Math.SQRT2 },
  { dx: -1, dy: 1, cost: Math.SQRT2 },
  { dx: -1, dy: -1, cost: Math.SQRT2 },
];

const DIAGONAL_HEURISTIC = Math.SQRT2 - 2;

class MinHeap {
  private readonly items: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, priority: number): void {
    this.items.push(item);
    this.priorities.push(priority);

    let index = this.items.length - 1;
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      const parentPriority = this.priorities[parentIndex] ?? Number.POSITIVE_INFINITY;
      if (parentPriority <= priority) break;

      const parentItem = this.items[parentIndex];
      if (parentItem === undefined) break;

      this.items[index] = parentItem;
      this.priorities[index] = parentPriority;
      this.items[parentIndex] = item;
      this.priorities[parentIndex] = priority;
      index = parentIndex;
    }
  }

  pop(): number | undefined {
    if (this.items.length === 0) return undefined;

    const top = this.items[0];
    const lastItem = this.items.pop();
    const lastPriority = this.priorities.pop();
    if (this.items.length === 0) return top;
    if (lastItem === undefined || lastPriority === undefined) return top;

    this.items[0] = lastItem;
    this.priorities[0] = lastPriority;

    let index = 0;
    const size = this.items.length;

    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      let smallestPriority = this.priorities[smallest] ?? Number.POSITIVE_INFINITY;

      const leftPriority = left < size ? this.priorities[left] ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
      if (leftPriority < smallestPriority) {
        smallest = left;
        smallestPriority = leftPriority;
      }

      const rightPriority = right < size ? this.priorities[right] ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
      if (rightPriority < smallestPriority) {
        smallest = right;
      }

      if (smallest === index) break;

      const swapItem = this.items[smallest];
      const swapPriority = this.priorities[smallest];
      if (swapItem === undefined || swapPriority === undefined) break;

      const currentItem = this.items[index];
      const currentPriority = this.priorities[index];
      if (currentItem === undefined || currentPriority === undefined) break;

      this.items[index] = swapItem;
      this.priorities[index] = swapPriority;
      this.items[smallest] = currentItem;
      this.priorities[smallest] = currentPriority;
      index = smallest;
    }

    return top;
  }
}

function heuristic(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = Math.abs(fromX - toX);
  const dy = Math.abs(fromY - toY);
  return dx + dy + DIAGONAL_HEURISTIC * Math.min(dx, dy);
}

function reconstructPath(parent: Int32Array, node: number, width: number): GridPoint[] {
  const points: GridPoint[] = [];
  let current = node;

  while (current >= 0) {
    points.push({ gridX: current % width, gridY: Math.floor(current / width) });
    current = parent[current] ?? -1;
  }

  points.reverse();
  points.shift();
  return points;
}

export function findPath(
  grid: WalkableGrid,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
): GridPoint[] | null {
  if (startX === goalX && startY === goalY) return [];
  if (!grid.isWalkable(startX, startY)) return null;
  if (!grid.isWalkable(goalX, goalY)) return null;

  const size = grid.width * grid.height;
  const gScore = new Float64Array(size).fill(Number.POSITIVE_INFINITY);
  const parent = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const open = new MinHeap();

  const startIndex = startY * grid.width + startX;
  gScore[startIndex] = 0;
  open.push(startIndex, heuristic(startX, startY, goalX, goalY));

  while (open.size > 0) {
    const current = open.pop();
    if (current === undefined) break;
    if (closed[current] === 1) continue;
    closed[current] = 1;

    const currentX = current % grid.width;
    const currentY = Math.floor(current / grid.width);
    if (currentX === goalX && currentY === goalY) {
      return reconstructPath(parent, current, grid.width);
    }

    const currentScore = gScore[current] ?? Number.POSITIVE_INFINITY;

    for (const neighbor of NEIGHBORS) {
      const nextX = currentX + neighbor.dx;
      const nextY = currentY + neighbor.dy;
      if (nextX < 0 || nextY < 0 || nextX >= grid.width || nextY >= grid.height) continue;
      if (!grid.isWalkable(nextX, nextY)) continue;

      if (neighbor.dx !== 0 && neighbor.dy !== 0) {
        if (!grid.isWalkable(currentX + neighbor.dx, currentY)) continue;
        if (!grid.isWalkable(currentX, currentY + neighbor.dy)) continue;
      }

      const nextIndex = nextY * grid.width + nextX;
      if (closed[nextIndex] === 1) continue;

      const tentative = currentScore + neighbor.cost;
      if (tentative >= (gScore[nextIndex] ?? Number.POSITIVE_INFINITY)) continue;

      gScore[nextIndex] = tentative;
      parent[nextIndex] = current;
      open.push(nextIndex, tentative + heuristic(nextX, nextY, goalX, goalY));
    }
  }

  return null;
}
