import { FLOOR_COUNT } from '../data/config';
import type { EnemyKind } from '../data/enemies';
import type { EnemySpawn, GateSpawn, GridPoint, LootSpawn, PlacedProp, VentSpawn } from '../data/levelTypes';
import type { Dungeon, FloorStyle, Room } from '../systems/DungeonGen';

type Mut<T> = { -readonly [K in keyof T]: T[K] };

export interface MutableRoom {
  x: number;
  y: number;
  width: number;
  height: number;
  style: FloorStyle;
}

export interface EditorEntities {
  props: Mut<PlacedProp>[];
  terminals: Mut<GridPoint>[];
  corpse: Mut<GridPoint> | null;
  loot: Mut<LootSpawn>[];
  enemies: Mut<EnemySpawn>[];
  vents: Mut<VentSpawn>[];
  gates: Mut<GateSpawn>[];
}

export interface EditorDoc {
  floor: number;
  seed: number;
  locked: boolean;
  rows: string[];
  rooms: MutableRoom[];
  entities: EditorEntities;
}

export type EntityType = 'prop' | 'terminal' | 'corpse' | 'loot' | 'enemy' | 'vent' | 'gate';

export type Selection =
  | { readonly type: EntityType; readonly index: number }
  | { readonly type: 'room'; readonly index: number };

export const ENEMY_KINDS: readonly EnemyKind[] = ['drone', 'tank', 'assembler', 'warden'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function list<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]).map((item) => ({ ...(item as object) }) as T) : [];
}

export function docFromJson(raw: unknown, floor: number): EditorDoc {
  if (!isRecord(raw) || !Array.isArray(raw.rows) || !raw.rows.every((row) => typeof row === 'string')) {
    throw new Error('file is not a level: `rows` must be an array of strings');
  }
  const entities = isRecord(raw.entities) ? raw.entities : {};
  const hazards = isRecord(entities.hazards) ? entities.hazards : {};
  const corpse = isRecord(entities.corpse) ? { x: Number(entities.corpse.x), y: Number(entities.corpse.y) } : null;
  return {
    floor: typeof raw.floor === 'number' ? raw.floor : floor,
    seed: typeof raw.seed === 'number' ? raw.seed : 0,
    locked: raw.locked === true,
    rows: [...(raw.rows as string[])],
    rooms: list<MutableRoom>(raw.rooms),
    entities: {
      props: list<Mut<PlacedProp>>(entities.props),
      terminals: list<Mut<GridPoint>>(entities.terminals),
      corpse,
      loot: list<Mut<LootSpawn>>(entities.loot),
      enemies: list<Mut<EnemySpawn>>(entities.enemies),
      vents: list<Mut<VentSpawn>>(hazards.vents),
      gates: list<Mut<GateSpawn>>(hazards.gates),
    },
  };
}

export function docToJson(doc: EditorDoc): Record<string, unknown> {
  const e = doc.entities;
  return {
    floor: doc.floor,
    seed: doc.seed,
    ...(doc.locked ? { locked: true } : {}),
    rows: doc.rows,
    rooms: doc.rooms.map((room) => ({ x: room.x, y: room.y, width: room.width, height: room.height, style: room.style })),
    entities: {
      props: e.props,
      terminals: e.terminals,
      corpse: e.corpse,
      loot: e.loot,
      enemies: e.enemies,
      hazards: { vents: e.vents, gates: e.gates },
    },
  };
}

export function docText(doc: EditorDoc): string {
  return `${JSON.stringify(docToJson(doc), null, 2)}\n`;
}

export function cloneDoc(doc: EditorDoc): EditorDoc {
  return JSON.parse(JSON.stringify(doc)) as EditorDoc;
}

export function mapSize(doc: EditorDoc): { width: number; height: number } {
  return { width: doc.rows[0]?.length ?? 0, height: doc.rows.length };
}

export function cellChar(doc: EditorDoc, x: number, y: number): string | undefined {
  return doc.rows[y]?.[x];
}

export function isFloor(doc: EditorDoc, x: number, y: number): boolean {
  const char = cellChar(doc, x, y);
  return char !== undefined && char !== '#';
}

export function setChar(doc: EditorDoc, x: number, y: number, char: string): boolean {
  const { width, height } = mapSize(doc);
  if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
  const row = doc.rows[y];
  if (row === undefined || row[x] === char) return false;
  doc.rows[y] = `${row.slice(0, x)}${char}${row.slice(x + 1)}`;
  return true;
}

export function findChar(doc: EditorDoc, char: string): GridPoint | null {
  for (let y = 0; y < doc.rows.length; y += 1) {
    const x = doc.rows[y]?.indexOf(char) ?? -1;
    if (x >= 0) return { x, y };
  }
  return null;
}

export function toLenientDungeon(doc: EditorDoc): Dungeon {
  const { width, height } = mapSize(doc);
  const spawn = findChar(doc, '@') ?? { x: 1, y: 1 };
  const exit = findChar(doc, 'X');
  return {
    width,
    height,
    rows: doc.rows,
    spawnX: spawn.x,
    spawnY: spawn.y,
    rooms: doc.rooms as Room[],
    seed: doc.seed,
    floor: Math.max(0, Math.min(FLOOR_COUNT - 1, doc.floor)),
    exit,
    entities: { props: [], terminals: [], corpse: null, loot: [], enemies: [], hazards: { vents: [], gates: [] } },
  };
}

export function entityPoint(doc: EditorDoc, ref: Selection): Mut<GridPoint> | null {
  const e = doc.entities;
  switch (ref.type) {
    case 'prop':
      return e.props[ref.index] ?? null;
    case 'terminal':
      return e.terminals[ref.index] ?? null;
    case 'corpse':
      return e.corpse;
    case 'loot':
      return e.loot[ref.index] ?? null;
    case 'enemy':
      return e.enemies[ref.index] ?? null;
    case 'vent':
      return e.vents[ref.index] ?? null;
    case 'gate':
      return e.gates[ref.index] ?? null;
    case 'room': {
      const room = doc.rooms[ref.index];
      return room ? { x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) } : null;
    }
  }
}

const PICK_ORDER: readonly EntityType[] = ['enemy', 'loot', 'vent', 'gate', 'terminal', 'prop', 'corpse'];

export function entitiesAt(doc: EditorDoc, x: number, y: number): Selection[] {
  const found: Selection[] = [];
  for (const type of PICK_ORDER) {
    const e = doc.entities;
    const points: readonly (GridPoint | null)[] =
      type === 'enemy' ? e.enemies
      : type === 'loot' ? e.loot
      : type === 'vent' ? e.vents
      : type === 'gate' ? e.gates
      : type === 'terminal' ? e.terminals
      : type === 'prop' ? e.props
      : [e.corpse];
    points.forEach((point, index) => {
      if (point && point.x === x && point.y === y) found.push({ type, index });
    });
  }
  return found;
}

export function roomAt(doc: EditorDoc, x: number, y: number): number {
  for (let index = doc.rooms.length - 1; index >= 0; index -= 1) {
    const room = doc.rooms[index];
    if (room && x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height) return index;
  }
  return -1;
}

export function removeSelection(doc: EditorDoc, ref: Selection): void {
  const e = doc.entities;
  switch (ref.type) {
    case 'prop':
      e.props.splice(ref.index, 1);
      break;
    case 'terminal':
      e.terminals.splice(ref.index, 1);
      break;
    case 'corpse':
      e.corpse = null;
      break;
    case 'loot':
      e.loot.splice(ref.index, 1);
      break;
    case 'enemy':
      e.enemies.splice(ref.index, 1);
      break;
    case 'vent':
      e.vents.splice(ref.index, 1);
      break;
    case 'gate':
      e.gates.splice(ref.index, 1);
      break;
    case 'room':
      doc.rooms.splice(ref.index, 1);
      break;
  }
}

export function removeEntitiesAt(doc: EditorDoc, x: number, y: number): void {
  const hits = entitiesAt(doc, x, y).sort((a, b) => b.index - a.index);
  for (const hit of hits) removeSelection(doc, hit);
}

export function moveEntity(doc: EditorDoc, ref: Selection, x: number, y: number): void {
  const point = entityPoint(doc, ref);
  if (!point || ref.type === 'room') return;
  point.x = x;
  point.y = y;
}
