import { DUNGEON_SEED, FLOOR_COUNT, FLOOR_SEED_STRIDE } from '../data/config';
import type { EnemyTier } from '../data/tiers';
import { DRAFT_KEY_PREFIX } from '../utils/devflags';
import { generateDungeon } from '../systems/DungeonGen';
import { checkLevel, type LevelProblem } from '../systems/LevelCheck';
import { planLevel } from '../systems/LevelPlan';
import { formulaTarget, rateLevel, type LevelRating } from '../systems/LevelRating';
import { parseLevelJson } from '../systems/LevelLoader';
import {
  docFromJson,
  docText,
  docToJson,
  type EditorDoc,
  type Selection,
} from './model';

export type ToolId =
  | 'select'
  | 'floor'
  | 'wall'
  | 'rectFloor'
  | 'rectWall'
  | 'room'
  | 'erase'
  | 'spawn'
  | 'exit'
  | 'prop:barrel'
  | 'prop:crate'
  | 'prop:pipe'
  | 'prop:theme'
  | 'terminal'
  | 'corpse'
  | 'loot:ammo'
  | 'loot:stim'
  | 'enemy:drone'
  | 'enemy:tank'
  | 'enemy:assembler'
  | 'enemy:warden'
  | 'vent';

const HISTORY_LIMIT = 200;
const EDITOR_KEY_PREFIX = 'station-zero:editor-';
const VALIDATE_DELAY_MS = 150;

const BUNDLED: readonly unknown[] = Object.entries(
  import.meta.glob('../data/levels/floor-*.json', { eager: true, import: 'default' }),
)
  .map(([path, data]): readonly [number, unknown] => [Number(/floor-(\d+)\.json$/.exec(path)?.[1] ?? -1), data])
  .sort((a, b) => a[0] - b[0])
  .map(([, data]) => data);

export interface FloorRating {
  readonly floor: number;
  readonly rating: LevelRating;
  readonly target: LevelRating;
}

export interface FloorBadge {
  readonly floor: number;
  readonly draft: boolean;
}

export class EditorState {
  doc: EditorDoc;
  tool: ToolId = 'select';
  selection: Selection | null = null;
  roomStyle: 0 | 1 | 2 = 0;
  placeTier: EnemyTier = 'novice';
  carveRooms = true;
  problems: LevelProblem[] = [];
  parseError: string | null = null;
  floorRatings: FloorRating[] = [];
  status = '';
  marker: { x: number; y: number } | null = null;

  private past: string[] = [];
  private future: string[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly focusListeners = new Set<(x: number, y: number) => void>();
  private validateTimer: number | undefined;

  constructor() {
    this.doc = this.loadFloor(0);
    this.validate();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onFocus(listener: (x: number, y: number) => void): () => void {
    this.focusListeners.add(listener);
    return () => this.focusListeners.delete(listener);
  }

  focusOn(x: number, y: number): void {
    this.marker = { x, y };
    for (const listener of this.focusListeners) listener(x, y);
    this.emit();
  }

  badges(): FloorBadge[] {
    return Array.from({ length: FLOOR_COUNT }, (_, floor) => {
      const draft = this.readDraft(floor);
      return { floor, draft: draft !== null };
    });
  }

  openFloor(floor: number): void {
    this.doc = this.loadFloor(floor);
    this.selection = null;
    this.marker = null;
    this.past = [];
    this.future = [];
    this.status = '';
    this.validate();
    this.emit();
  }

  resetFloor(): void {
    try {
      window.localStorage.removeItem(`${EDITOR_KEY_PREFIX}${this.doc.floor}`);
    } catch {
      /* storage unavailable */
    }
    this.openFloor(this.doc.floor);
    this.status = 'Floor reset to the bundled level.';
    this.emit();
  }

  loadDocument(doc: EditorDoc): void {
    this.checkpoint();
    this.doc = doc;
    this.selection = null;
    this.changed();
  }

  checkpoint(): void {
    this.past.push(JSON.stringify(this.doc));
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
  }

  changed(): void {
    this.persistDraft();
    this.scheduleValidate();
    this.emit();
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): void {
    const previous = this.past.pop();
    if (previous === undefined) return;
    this.future.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(previous) as EditorDoc;
    this.selection = null;
    this.changed();
  }

  redo(): void {
    const next = this.future.pop();
    if (next === undefined) return;
    this.past.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(next) as EditorDoc;
    this.selection = null;
    this.changed();
  }

  undoLastCheckpoint(): void {
    this.past.pop();
  }

  setTool(tool: ToolId): void {
    this.tool = tool;
    this.emit();
  }

  select(selection: Selection | null): void {
    this.selection = selection;
    this.emit();
  }

  regenerate(seed: number): string | null {
    try {
      const dungeon = generateDungeon(seed, this.doc.floor);
      const rows = dungeon.rows.map((row) => row.split(''));
      if (dungeon.exit) {
        const row = rows[dungeon.exit.y];
        if (row) row[dungeon.exit.x] = 'X';
      }
      const rowStrings = rows.map((row) => row.join(''));
      const base = {
        floor: this.doc.floor,
        seed: dungeon.seed,
        rows: rowStrings,
        rooms: dungeon.rooms.map((room) => ({ x: room.x, y: room.y, width: room.width, height: room.height, style: room.style })),
        entities: planLevel(dungeon),
      };
      const next = docFromJson(base, this.doc.floor);
      next.entities.corpse = base.entities.corpse ? { ...base.entities.corpse } : null;
      this.loadDocument(next);
      return null;
    } catch (error) {
      return String(error);
    }
  }

  replan(): string | null {
    try {
      const dungeon = parseLevelJson(docToJson(this.doc), this.doc.floor);
      const entities = planLevel(dungeon);
      const next = docFromJson({ ...docToJson(this.doc), entities }, this.doc.floor);
      this.loadDocument(next);
      return null;
    } catch (error) {
      return String(error);
    }
  }

  defaultSeed(): number {
    return DUNGEON_SEED + this.doc.floor * FLOOR_SEED_STRIDE;
  }

  exportText(): string {
    return docText(this.doc);
  }

  async saveToFile(): Promise<void> {
    if (this.parseError) {
      this.status = `Not saved: ${this.parseError}`;
      this.emit();
      return;
    }
    const floor = this.doc.floor;
    try {
      const response = await window.fetch(`/__levels/save?floor=${floor}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docToJson(this.doc)),
      });
      const result = (await response.json()) as { saved?: string; error?: string };
      if (!response.ok || !result.saved) throw new Error(result.error ?? `HTTP ${response.status}`);
      window.localStorage.removeItem(`${EDITOR_KEY_PREFIX}${floor}`);
      this.status = `Saved ${result.saved}${this.problems.length > 0 ? ` (${this.problems.length} rule problem(s) remain)` : ''}`;
    } catch (error) {
      this.status = `Could not save: ${error instanceof Error ? error.message : String(error)}. Use Download JSON instead.`;
    }
    this.emit();
  }

  playDraft(): void {
    try {
      window.localStorage.setItem(`${DRAFT_KEY_PREFIX}${this.doc.floor}`, JSON.stringify(docToJson(this.doc)));
      window.open(`/?debug&depth=${this.doc.floor}&level=draft`, '_blank');
    } catch {
      this.status = 'Could not store the draft for play.';
      this.emit();
    }
  }

  private loadFloor(floor: number): EditorDoc {
    const draft = this.readDraft(floor);
    if (draft) {
      try {
        return docFromJson(draft, floor);
      } catch {
        /* fall through to the bundled level */
      }
    }
    return docFromJson(BUNDLED[floor], floor);
  }

  private readDraft(floor: number): unknown {
    try {
      const text = window.localStorage.getItem(`${EDITOR_KEY_PREFIX}${floor}`);
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return null;
    }
  }

  private persistDraft(): void {
    try {
      window.localStorage.setItem(`${EDITOR_KEY_PREFIX}${this.doc.floor}`, JSON.stringify(docToJson(this.doc)));
    } catch {
      /* storage unavailable */
    }
  }

  private scheduleValidate(): void {
    window.clearTimeout(this.validateTimer);
    this.validateTimer = window.setTimeout(() => {
      this.validate();
      this.emit();
    }, VALIDATE_DELAY_MS);
  }

  private ratingOf(doc: EditorDoc): LevelRating {
    const e = doc.entities;
    return rateLevel({
      floor: Math.max(0, Math.min(FLOOR_COUNT - 1, doc.floor)),
      enemies: e.enemies,
      ventCount: e.vents.length,
      lootAmmo: e.loot.filter((item) => item.kind === 'ammo').reduce((sum, item) => sum + (item.amount || 4), 0),
      lootStims: e.loot.filter((item) => item.kind === 'stim').length,
    });
  }

  private validate(): void {
    this.floorRatings = Array.from({ length: FLOOR_COUNT }, (_, floor) => {
      const doc = floor === this.doc.floor ? this.doc : this.loadFloor(floor);
      return { floor, rating: this.ratingOf(doc), target: formulaTarget(floor) };
    });
    try {
      const dungeon = parseLevelJson(docToJson(this.doc), this.doc.floor);
      this.parseError = null;
      this.problems = checkLevel(dungeon);
    } catch (error) {
      this.parseError = error instanceof Error ? error.message : String(error);
      this.problems = [];
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
