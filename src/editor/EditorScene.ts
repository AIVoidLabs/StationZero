import { Input, Scene, type GameObjects } from 'phaser';
import {
  ASSETS,
  DEAD_FRAME_COUNT,
  LOOT_V2_KEY,
  PROPS_FLOOR_KEY,
} from '../assets/manifest';
import { FLOOR_COUNT, TILE_HEIGHT, TILE_WIDTH } from '../data/config';
import { ENEMY_SPECS } from '../data/enemies';
import { TIER_SPECS } from '../data/tiers';
import { Level } from '../systems/Level';
import { ensureArt } from '../systems/PlaceholderArt';
import { registerTilesV2 } from '../systems/TileShaper';
import { gridVectorToWorld, worldToGrid } from '../utils/iso';
import {
  entitiesAt,
  entityPoint,
  findChar,
  isFloor,
  mapSize,
  moveEntity,
  removeEntitiesAt,
  roomAt,
  setChar,
  toLenientDungeon,
  type EditorDoc,
  type Selection,
} from './model';
import type { EditorState, ToolId } from './state';

const OVERLAY_DEPTH = 1_000_000;
const PROP_ORIGIN_Y = 40 / 48;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const DRONE_FRAME_S = 4;

interface Cell {
  x: number;
  y: number;
}

type Drag =
  | { kind: 'pan'; lastX: number; lastY: number }
  | { kind: 'brush'; tool: ToolId; last: Cell }
  | { kind: 'rect'; tool: ToolId; start: Cell; end: Cell }
  | { kind: 'move'; ref: Selection; moved: boolean };

export class EditorScene extends Scene {
  private state!: EditorState;
  private tracked: GameObjects.GameObject[] = [];
  private overlay!: GameObjects.Graphics;
  private hover: Cell | null = null;
  private drag: Drag | null = null;
  private spaceKey: Input.Keyboard.Key | undefined;
  private unsubscribe: Array<() => void> = [];

  constructor() {
    super({ key: 'Editor' });
  }

  init(data: { state: EditorState }): void {
    this.state = data.state;
  }

  preload(): void {
    for (const asset of ASSETS) {
      if (!asset.enabled || asset.kind === 'audio') continue;
      if (asset.kind === 'spritesheet' && asset.frameWidth !== undefined && asset.frameHeight !== undefined) {
        this.load.spritesheet(asset.key, asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
      } else {
        this.load.image(asset.key, asset.path);
      }
    }
  }

  create(): void {
    ensureArt(this);
    registerTilesV2(this);
    this.cameras.main.setBackgroundColor('#0b0b0b');
    this.overlay = this.add.graphics().setDepth(OVERLAY_DEPTH);
    this.input.mouse?.disableContextMenu();
    this.spaceKey = this.input.keyboard?.addKey(Input.Keyboard.KeyCodes.SPACE, false);

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('wheel', this.onWheel, this);

    this.unsubscribe.push(this.state.onChange(() => this.rebuild()));
    this.unsubscribe.push(this.state.onFocus((x, y) => this.centerOn(x, y)));
    this.events.once('shutdown', () => {
      for (const off of this.unsubscribe) off();
    });

    this.rebuild();
    const { width, height } = mapSize(this.state.doc);
    this.centerOn(Math.floor(width / 2), Math.floor(height / 2));
    this.fitToMap();
    this.scale.on('resize', () => this.fitToMap());
  }

  private fitToMap(): void {
    const { width, height } = mapSize(this.state.doc);
    const worldWidth = (width + height) * (TILE_WIDTH / 2);
    const worldHeight = (width + height) * (TILE_HEIGHT / 2) + TILE_HEIGHT * 4;
    const fit = Math.min(this.scale.width / worldWidth, this.scale.height / worldHeight);
    this.cameras.main.setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit)));
    this.centerOn(Math.floor(width / 2), Math.floor(height / 2));
  }

  update(): void {
    this.drawOverlay();
  }

  centerOn(x: number, y: number): void {
    const world = gridVectorToWorld(x, y, TILE_WIDTH, TILE_HEIGHT);
    this.cameras.main.centerOn(world.x, world.y);
  }

  private cellAt(pointer: Phaser.Input.Pointer): Cell {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const grid = worldToGrid(world.x, world.y, TILE_WIDTH, TILE_HEIGHT);
    return { x: grid.gridX, y: grid.gridY };
  }

  private inMap(cell: Cell): boolean {
    const { width, height } = mapSize(this.state.doc);
    return cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height;
  }

  private panning(pointer: Phaser.Input.Pointer): boolean {
    return pointer.middleButtonDown() || pointer.rightButtonDown() || (pointer.leftButtonDown() && this.spaceKey?.isDown === true);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.panning(pointer)) {
      this.drag = { kind: 'pan', lastX: pointer.x, lastY: pointer.y };
      return;
    }
    if (!pointer.leftButtonDown()) return;
    const cell = this.cellAt(pointer);
    if (!this.inMap(cell)) return;
    const state = this.state;
    const tool = state.tool;

    if (tool === 'select') {
      const hit = entitiesAt(state.doc, cell.x, cell.y)[0];
      if (hit) {
        state.select(hit);
        state.checkpoint();
        this.drag = { kind: 'move', ref: hit, moved: false };
        return;
      }
      const room = roomAt(state.doc, cell.x, cell.y);
      state.select(room >= 0 ? { type: 'room', index: room } : null);
      return;
    }

    if (tool === 'floor' || tool === 'wall') {
      state.checkpoint();
      this.drag = { kind: 'brush', tool, last: { x: -1, y: -1 } };
      this.applyBrush(tool, cell);
      return;
    }

    if (tool === 'rectFloor' || tool === 'rectWall' || tool === 'room') {
      this.drag = { kind: 'rect', tool, start: cell, end: cell };
      return;
    }

    state.checkpoint();
    this.applyPoint(tool, cell);
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    const cell = this.cellAt(pointer);
    this.hover = this.inMap(cell) ? cell : null;
    const drag = this.drag;
    if (!drag) return;

    if (drag.kind === 'pan') {
      const cam = this.cameras.main;
      cam.scrollX -= (pointer.x - drag.lastX) / cam.zoom;
      cam.scrollY -= (pointer.y - drag.lastY) / cam.zoom;
      drag.lastX = pointer.x;
      drag.lastY = pointer.y;
      return;
    }
    if (!this.inMap(cell)) return;
    if (drag.kind === 'brush') {
      if (cell.x !== drag.last.x || cell.y !== drag.last.y) this.applyBrush(drag.tool, cell);
    } else if (drag.kind === 'rect') {
      drag.end = cell;
    } else if (drag.kind === 'move') {
      const point = entityPoint(this.state.doc, drag.ref);
      if (!point || (point.x === cell.x && point.y === cell.y) || !isFloor(this.state.doc, cell.x, cell.y)) return;
      moveEntity(this.state.doc, drag.ref, cell.x, cell.y);
      drag.moved = true;
      this.state.changed();
    }
  }

  private onUp(): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    if (drag.kind === 'rect') {
      this.applyRect(drag.tool, drag.start, drag.end);
    } else if (drag.kind === 'move' && !drag.moved) {
      this.state.undoLastCheckpoint();
    }
  }

  private onWheel(_pointer: unknown, _over: unknown, _dx: number, dy: number): void {
    const cam = this.cameras.main;
    const factor = dy > 0 ? 0.9 : 1.1;
    cam.setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor)));
  }

  private applyBrush(tool: ToolId, cell: Cell): void {
    if (this.drag?.kind === 'brush') this.drag.last = cell;
    const doc = this.state.doc;
    if (tool === 'floor') {
      if (setChar(doc, cell.x, cell.y, '.')) this.state.changed();
    } else if (tool === 'wall') {
      if (setChar(doc, cell.x, cell.y, '#')) {
        removeEntitiesAt(doc, cell.x, cell.y);
        this.state.changed();
      }
    }
  }

  private applyRect(tool: ToolId, a: Cell, b: Cell): void {
    const doc = this.state.doc;
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    this.state.checkpoint();
    if (tool === 'room') {
      const { width, height } = mapSize(doc);
      const rx = Math.max(1, x0);
      const ry = Math.max(1, y0);
      const rw = Math.min(width - 1, x1 + 1) - rx;
      const rh = Math.min(height - 1, y1 + 1) - ry;
      if (rw < 1 || rh < 1) return;
      doc.rooms.push({ x: rx, y: ry, width: rw, height: rh, style: this.state.roomStyle });
      if (this.state.carveRooms) {
        for (let y = ry; y < ry + rh; y += 1) for (let x = rx; x < rx + rw; x += 1) if (!isFloor(doc, x, y)) setChar(doc, x, y, '.');
      }
      this.state.selection = { type: 'room', index: doc.rooms.length - 1 };
    } else {
      const char = tool === 'rectFloor' ? '.' : '#';
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          if (setChar(doc, x, y, char) && char === '#') removeEntitiesAt(doc, x, y);
        }
      }
    }
    this.state.changed();
  }

  private applyPoint(tool: ToolId, cell: Cell): void {
    const state = this.state;
    const doc: EditorDoc = state.doc;
    if (tool === 'erase') {
      removeEntitiesAt(doc, cell.x, cell.y);
      const room = roomAt(doc, cell.x, cell.y);
      if (entitiesAt(doc, cell.x, cell.y).length === 0 && room >= 0 && state.selection?.type === 'room') doc.rooms.splice(room, 1);
      state.selection = null;
      state.changed();
      return;
    }
    if (tool === 'spawn' || tool === 'exit') {
      if (!isFloor(doc, cell.x, cell.y)) return;
      if (tool === 'exit' && doc.floor >= FLOOR_COUNT - 1) {
        state.status = 'The last floor has no exit.';
        state.changed();
        return;
      }
      const char = tool === 'spawn' ? '@' : 'X';
      const old = findChar(doc, char);
      if (old) setChar(doc, old.x, old.y, '.');
      removeEntitiesAt(doc, cell.x, cell.y);
      setChar(doc, cell.x, cell.y, char);
      state.changed();
      return;
    }
    if (!isFloor(doc, cell.x, cell.y)) return;
    const e = doc.entities;
    const randomSeed = Math.floor(Math.random() * 0xffffff);
    const phase = (cycle: number): number => Math.floor(Math.random() * cycle);
    let selection: Selection | null = null;

    if (tool.startsWith('prop:')) {
      e.props.push({ x: cell.x, y: cell.y, kind: tool.slice(5) as 'barrel' | 'crate' | 'pipe' | 'theme' });
      selection = { type: 'prop', index: e.props.length - 1 };
    } else if (tool === 'terminal') {
      e.terminals.push({ x: cell.x, y: cell.y });
      selection = { type: 'terminal', index: e.terminals.length - 1 };
    } else if (tool === 'corpse') {
      e.corpse = { x: cell.x, y: cell.y };
      selection = { type: 'corpse', index: 0 };
    } else if (tool.startsWith('loot:')) {
      const kind = tool.slice(5) as 'ammo' | 'stim';
      e.loot.push({ x: cell.x, y: cell.y, kind, amount: kind === 'ammo' ? 4 : 0 });
      selection = { type: 'loot', index: e.loot.length - 1 };
    } else if (tool.startsWith('enemy:')) {
      e.enemies.push({ x: cell.x, y: cell.y, kind: tool.slice(6) as keyof typeof ENEMY_SPECS, tier: ENEMY_SPECS[tool.slice(6) as keyof typeof ENEMY_SPECS].boss ? 'master' : state.placeTier, seed: randomSeed });
      selection = { type: 'enemy', index: e.enemies.length - 1 };
    } else if (tool === 'shock') {
      e.shocks.push({ x: cell.x, y: cell.y, phaseMs: phase(4200) });
      selection = { type: 'shock', index: e.shocks.length - 1 };
    } else if (tool === 'vent') {
      e.vents.push({ x: cell.x, y: cell.y, phaseMs: phase(5200) });
      selection = { type: 'vent', index: e.vents.length - 1 };
    }
    state.selection = selection;
    state.changed();
  }

  private rebuild(): void {
    for (const object of this.tracked) object.destroy();
    this.tracked = [];
    const before = new Set(this.children.list);
    const doc = this.state.doc;
    const floor = Math.max(0, Math.min(FLOOR_COUNT - 1, doc.floor));
    new Level(toLenientDungeon(doc)).render(this);

    const add = <T extends GameObjects.GameObject>(object: T): T => {
      this.tracked.push(object);
      return object;
    };
    const e = doc.entities;

    for (const prop of e.props) {
      const iso = gridVectorToWorld(prop.x, prop.y, TILE_WIDTH, TILE_HEIGHT);
      if (prop.kind === 'theme') add(this.add.image(iso.x, iso.y, PROPS_FLOOR_KEY, DEAD_FRAME_COUNT + floor).setOrigin(0.5, PROP_ORIGIN_Y).setDepth(iso.y));
      else if (prop.kind === 'barrel') add(this.add.image(iso.x, iso.y, PROPS_FLOOR_KEY, DEAD_FRAME_COUNT + FLOOR_COUNT + 1).setOrigin(0.5, PROP_ORIGIN_Y).setDepth(iso.y));
      else add(this.add.image(iso.x, iso.y, 'props', prop.kind === 'crate' ? 1 : 3).setOrigin(0.5, 1).setScale(0.5).setDepth(iso.y));
    }
    for (const terminal of e.terminals) {
      const iso = gridVectorToWorld(terminal.x, terminal.y, TILE_WIDTH, TILE_HEIGHT);
      add(this.add.image(iso.x, iso.y, PROPS_FLOOR_KEY, DEAD_FRAME_COUNT + FLOOR_COUNT).setOrigin(0.5, PROP_ORIGIN_Y).setDepth(iso.y));
    }
    if (e.corpse) {
      const iso = gridVectorToWorld(e.corpse.x, e.corpse.y, TILE_WIDTH, TILE_HEIGHT);
      add(this.add.image(iso.x, iso.y, PROPS_FLOOR_KEY, Math.min(floor, DEAD_FRAME_COUNT - 1)).setOrigin(0.5, PROP_ORIGIN_Y).setDepth(iso.y));
    }
    for (const item of e.loot) {
      const iso = gridVectorToWorld(item.x, item.y, TILE_WIDTH, TILE_HEIGHT);
      add(this.add.image(iso.x, iso.y, LOOT_V2_KEY, item.kind === 'stim' ? 0 : 1).setOrigin(0.5, 1).setDepth(iso.y));
    }
    for (const enemy of e.enemies) {
      const spec = ENEMY_SPECS[enemy.kind];
      const iso = gridVectorToWorld(enemy.x, enemy.y, TILE_WIDTH, TILE_HEIGHT);
      add(this.add.image(iso.x, iso.y, spec.spriteKey, DRONE_FRAME_S).setOrigin(0.5, 1).setScale(spec.scale).setDepth(iso.y));
    }

    for (const object of this.children.list) {
      if (!before.has(object) && object !== this.overlay) this.tracked.push(object);
    }
    this.tracked = [...new Set(this.tracked)];
  }

  private diamond(g: GameObjects.Graphics, x: number, y: number, inset = 0): void {
    const c = gridVectorToWorld(x, y, TILE_WIDTH, TILE_HEIGHT);
    const hw = TILE_WIDTH / 2 - inset * 2;
    const hh = TILE_HEIGHT / 2 - inset;
    g.beginPath();
    g.moveTo(c.x, c.y - hh);
    g.lineTo(c.x + hw, c.y);
    g.lineTo(c.x, c.y + hh);
    g.lineTo(c.x - hw, c.y);
    g.closePath();
  }

  private rectOutline(g: GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    const p = (gx: number, gy: number): { x: number; y: number } => gridVectorToWorld(gx - 0.5, gy - 0.5, TILE_WIDTH, TILE_HEIGHT);
    const a = p(x, y);
    const b = p(x + w, y);
    const c = p(x + w, y + h);
    const d = p(x, y + h);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.closePath();
  }

  private drawOverlay(): void {
    const g = this.overlay;
    g.clear();
    const doc = this.state.doc;
    const selection = this.state.selection;

    doc.rooms.forEach((room, index) => {
      const selected = selection?.type === 'room' && selection.index === index;
      g.lineStyle(selected ? 3 : 1, selected ? 0xffd27a : 0x8a6a2a, selected ? 1 : 0.7);
      this.rectOutline(g, room.x, room.y, room.width, room.height);
      g.strokePath();
    });

    const spawn = findChar(doc, '@');
    if (spawn) {
      g.fillStyle(0x4fe08a, 0.45);
      this.diamond(g, spawn.x, spawn.y, 4);
      g.fillPath();
    }
    const exit = findChar(doc, 'X');
    if (exit) {
      g.fillStyle(0x5ad0ff, 0.45);
      this.diamond(g, exit.x, exit.y, 4);
      g.fillPath();
    }

    for (const enemy of doc.entities.enemies) {
      const stripes = TIER_SPECS[enemy.tier ?? 'novice'].stripes;
      if (stripes === 0 || ENEMY_SPECS[enemy.kind].boss) continue;
      const iso = gridVectorToWorld(enemy.x, enemy.y, TILE_WIDTH, TILE_HEIGHT);
      g.fillStyle(enemy.tier === 'master' ? 0xe8c060 : 0x9fd0ff, 1);
      for (let index = 0; index < stripes; index += 1) g.fillRect(iso.x - 9 + index * 7, iso.y - 46, 5, 4);
    }

    for (const shock of doc.entities.shocks) {
      const iso = gridVectorToWorld(shock.x, shock.y, TILE_WIDTH, TILE_HEIGHT);
      g.lineStyle(2, 0x7fe0ff, 0.95);
      g.strokeEllipse(iso.x, iso.y, 28, 14);
      g.lineStyle(2, 0xffffff, 0.9);
      g.lineBetween(iso.x - 12, iso.y - 4, iso.x - 4, iso.y - 8);
      g.lineBetween(iso.x - 4, iso.y - 8, iso.x + 4, iso.y);
      g.lineBetween(iso.x + 4, iso.y, iso.x + 12, iso.y - 4);
    }

    for (const vent of doc.entities.vents) {
      const iso = gridVectorToWorld(vent.x, vent.y, TILE_WIDTH, TILE_HEIGHT);
      g.fillStyle(0xff8a3a, 0.7);
      g.fillEllipse(iso.x, iso.y, 22, 11);
    }
    if (selection && selection.type !== 'room') {
      const point = entityPoint(doc, selection);
      if (point) {
        g.lineStyle(2, 0xffd27a, 1);
        this.diamond(g, point.x, point.y);
        g.strokePath();
      }
    }

    const marker = this.state.marker;
    if (marker) {
      g.lineStyle(3, 0xff3a2a, 0.6 + 0.4 * Math.sin(this.time.now / 140));
      this.diamond(g, marker.x, marker.y);
      g.strokePath();
    }

    const drag = this.drag;
    if (drag?.kind === 'rect') {
      g.lineStyle(2, 0xffffff, 0.9);
      const x0 = Math.min(drag.start.x, drag.end.x);
      const y0 = Math.min(drag.start.y, drag.end.y);
      this.rectOutline(g, x0, y0, Math.abs(drag.end.x - drag.start.x) + 1, Math.abs(drag.end.y - drag.start.y) + 1);
      g.strokePath();
    } else if (this.hover) {
      g.lineStyle(1, 0xffffff, 0.8);
      this.diamond(g, this.hover.x, this.hover.y);
      g.strokePath();
    }
  }
}
