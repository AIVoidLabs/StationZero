import { devStartFloor } from './devflags';

export function isDevStart(): boolean {
  return devStartFloor() !== null;
}
