import { FLOOR_COUNT } from '../data/config';
import { docFromJson, ENEMY_KINDS, removeSelection, type EditorDoc, type Selection } from './model';
import type { EditorState, ToolId } from './state';

interface ToolSpec {
  readonly id: ToolId;
  readonly label: string;
  readonly key?: string;
}

const TOOL_GROUPS: readonly { readonly title: string; readonly tools: readonly ToolSpec[] }[] = [
  {
    title: 'Map',
    tools: [
      { id: 'select', label: 'Select / move', key: '1' },
      { id: 'floor', label: 'Floor brush', key: '2' },
      { id: 'wall', label: 'Wall brush', key: '3' },
      { id: 'rectFloor', label: 'Floor rectangle', key: '4' },
      { id: 'rectWall', label: 'Wall rectangle', key: '5' },
      { id: 'room', label: 'Room', key: '6' },
      { id: 'erase', label: 'Erase', key: '7' },
      { id: 'spawn', label: 'Spawn' },
      { id: 'exit', label: 'Exit hatch' },
    ],
  },
  {
    title: 'Enemies',
    tools: [
      { id: 'enemy:drone', label: 'Drone' },
      { id: 'enemy:tank', label: 'Tank' },
      { id: 'enemy:assembler', label: 'Assembler (boss)' },
      { id: 'enemy:warden', label: 'WARDEN (boss)' },
    ],
  },
  {
    title: 'Items',
    tools: [
      { id: 'loot:ammo', label: 'Ammo' },
      { id: 'loot:stim', label: 'Stim' },
    ],
  },
  {
    title: 'Props',
    tools: [
      { id: 'prop:barrel', label: 'Explosive barrel' },
      { id: 'prop:crate', label: 'Crate' },
      { id: 'prop:pipe', label: 'Pipe' },
      { id: 'prop:theme', label: 'Themed prop' },
      { id: 'terminal', label: 'Terminal' },
      { id: 'corpse', label: 'The dead' },
    ],
  },
  {
    title: 'Hazards',
    tools: [
      { id: 'vent', label: 'Steam vent' },
      { id: 'gate:x', label: 'Laser gate (x)' },
      { id: 'gate:y', label: 'Laser gate (y)' },
    ],
  },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { text?: string; className?: string; title?: string } = {},
  children: readonly (HTMLElement | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.text !== undefined) node.textContent = props.text;
  if (props.className) node.className = props.className;
  if (props.title) node.title = props.title;
  for (const child of children) node.append(child);
  return node;
}

function button(label: string, onClick: () => void, disabled = false, className = ''): HTMLButtonElement {
  const node = el('button', { text: label, className });
  node.type = 'button';
  node.disabled = disabled;
  node.addEventListener('click', onClick);
  return node;
}

function numberField(label: string, value: number, onChange: (value: number) => void): HTMLElement {
  const input = el('input');
  input.type = 'number';
  input.value = String(value);
  input.addEventListener('change', () => {
    const next = Number(input.value);
    if (Number.isFinite(next)) onChange(Math.round(next));
  });
  return el('label', { className: 'field' }, [el('span', { text: label }), input]);
}

function selectField<T extends string | number>(
  label: string,
  value: T,
  options: readonly T[],
  onChange: (value: string) => void,
): HTMLElement {
  const select = el('select');
  for (const option of options) {
    const node = el('option', { text: String(option) });
    node.value = String(option);
    select.append(node);
  }
  select.value = String(value);
  select.addEventListener('change', () => onChange(select.value));
  return el('label', { className: 'field' }, [el('span', { text: label }), select]);
}

export function mountPanels(state: EditorState): void {
  const floors = document.getElementById('floors');
  const tools = document.getElementById('tools');
  const topbar = document.getElementById('topbar');
  const inspector = document.getElementById('inspector');
  const problems = document.getElementById('problems');
  if (!floors || !tools || !topbar || !inspector || !problems) throw new Error('editor.html is missing a panel');

  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    void file.text().then((text) => {
      try {
        const doc = docFromJson(JSON.parse(text) as unknown, state.doc.floor);
        if (doc.floor !== state.doc.floor) {
          state.openFloor(Math.max(0, Math.min(FLOOR_COUNT - 1, doc.floor)));
        }
        state.loadDocument(doc);
        state.status = `Loaded ${file.name}`;
      } catch (error) {
        state.status = `Could not load ${file.name}: ${String(error)}`;
      }
      state.changed();
    });
  });

  const render = (): void => {
    renderFloors(floors, state);
    renderTools(tools, state);
    renderTopbar(topbar, state, fileInput);
    renderInspector(inspector, state);
    renderProblems(problems, state);
  };

  state.onChange(render);
  render();

  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) state.redo();
      else state.undo();
      return;
    }
    if (ctrl && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      state.redo();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selection = state.selection;
      if (!selection) return;
      event.preventDefault();
      state.checkpoint();
      removeSelection(state.doc, selection);
      state.selection = null;
      state.changed();
      return;
    }
    if (event.key === 'Escape') {
      state.select(null);
      return;
    }
    for (const group of TOOL_GROUPS) {
      const hit = group.tools.find((tool) => tool.key === event.key);
      if (hit) state.setTool(hit.id);
    }
  });
}

function renderFloors(root: HTMLElement, state: EditorState): void {
  root.replaceChildren(el('h2', { text: 'Floors' }));
  for (const badge of state.badges()) {
    const label = `B${badge.floor + 1}${badge.locked ? '  LOCKED' : ''}${badge.draft ? '  *draft' : ''}`;
    const node = button(label, () => state.openFloor(badge.floor), false, badge.floor === state.doc.floor ? 'active' : '');
    root.append(node);
  }
}

function renderTools(root: HTMLElement, state: EditorState): void {
  root.replaceChildren();
  for (const group of TOOL_GROUPS) {
    root.append(el('h2', { text: group.title }));
    for (const tool of group.tools) {
      const label = tool.key ? `${tool.label}  [${tool.key}]` : tool.label;
      root.append(button(label, () => state.setTool(tool.id), false, state.tool === tool.id ? 'active' : ''));
    }
  }
}

function renderTopbar(root: HTMLElement, state: EditorState, fileInput: HTMLInputElement): void {
  const seed = el('input');
  seed.type = 'number';
  seed.value = String(state.doc.seed || state.defaultSeed());
  seed.title = 'Seed for regenerate';

  const lock = el('input');
  lock.type = 'checkbox';
  lock.checked = state.doc.locked;
  lock.addEventListener('change', () => {
    state.checkpoint();
    state.doc.locked = lock.checked;
    state.changed();
  });

  const report = (message: string | null): void => {
    state.status = message ?? '';
    state.changed();
  };

  root.replaceChildren(
    el('strong', { text: `STATION ZERO / LEVEL DESIGNER   B${state.doc.floor + 1}` }),
    button('Undo', () => state.undo(), !state.canUndo),
    button('Redo', () => state.redo(), !state.canRedo),
    button('Download JSON', () => {
      const blob = new Blob([state.exportText()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = el('a');
      link.href = url;
      link.download = `floor-${state.doc.floor}.json`;
      link.click();
      URL.revokeObjectURL(url);
      state.status = `Downloaded floor-${state.doc.floor}.json. Put it in src/data/levels/.`;
      state.changed();
    }),
    button('Upload JSON', () => fileInput.click()),
    button('Play draft', () => state.playDraft()),
    el('label', { className: 'inline' }, [lock, el('span', { text: 'Locked (bake skips)' })]),
    el('label', { className: 'inline' }, [el('span', { text: 'Seed' }), seed]),
    button('Regenerate floor', () => {
      if (!window.confirm('Regenerate the map and every placement from this seed? Unsaved edits on this floor are replaced.')) return;
      report(state.regenerate(Number(seed.value) || state.defaultSeed()));
    }),
    button('Re-plan entities', () => {
      if (!window.confirm('Recompute enemies, loot, props and hazards for the current map?')) return;
      report(state.replan());
    }),
    button('Reset floor', () => {
      if (window.confirm('Discard all edits on this floor and reload the bundled level?')) state.resetFloor();
    }),
    fileInput,
    el('span', { className: 'status', text: state.status }),
  );
}

function renderInspector(root: HTMLElement, state: EditorState): void {
  root.replaceChildren(el('h2', { text: 'Selection' }));
  const selection = state.selection;
  const doc = state.doc;
  if (!selection) {
    root.append(
      el('p', {
        className: 'hint',
        text: 'Left click: use the active tool. Right or middle drag, or Space + drag: pan. Wheel: zoom. Delete: remove the selection. Ctrl+Z / Ctrl+Shift+Z: undo / redo.',
      }),
    );
    if (state.tool === 'room') {
      root.append(
        selectField('Room style', state.roomStyle, [0, 1, 2], (value) => {
          state.roomStyle = Number(value) as 0 | 1 | 2;
        }),
      );
      const carve = el('input');
      carve.type = 'checkbox';
      carve.checked = state.carveRooms;
      carve.addEventListener('change', () => {
        state.carveRooms = carve.checked;
      });
      root.append(el('label', { className: 'inline' }, [carve, el('span', { text: 'Carve floor inside the room' })]));
    }
    return;
  }

  const edit = (apply: () => void): void => {
    state.checkpoint();
    apply();
    state.changed();
  };
  root.append(el('p', { className: 'hint', text: describe(doc, selection) }));
  const e = doc.entities;

  switch (selection.type) {
    case 'enemy': {
      const enemy = e.enemies[selection.index];
      if (!enemy) break;
      root.append(
        selectField('Kind', enemy.kind, ENEMY_KINDS, (value) => edit(() => (enemy.kind = value as typeof enemy.kind))),
        numberField('Seed', enemy.seed, (value) => edit(() => (enemy.seed = value))),
      );
      break;
    }
    case 'loot': {
      const item = e.loot[selection.index];
      if (!item) break;
      root.append(
        selectField('Kind', item.kind, ['ammo', 'stim'], (value) => edit(() => (item.kind = value as typeof item.kind))),
        numberField('Amount', item.amount, (value) => edit(() => (item.amount = value))),
      );
      break;
    }
    case 'prop': {
      const prop = e.props[selection.index];
      if (!prop) break;
      root.append(selectField('Kind', prop.kind, ['barrel', 'crate', 'pipe', 'theme'], (value) => edit(() => (prop.kind = value as typeof prop.kind))));
      break;
    }
    case 'vent': {
      const vent = e.vents[selection.index];
      if (!vent) break;
      root.append(numberField('Phase (ms)', vent.phaseMs, (value) => edit(() => (vent.phaseMs = value))));
      break;
    }
    case 'gate': {
      const gate = e.gates[selection.index];
      if (!gate) break;
      root.append(
        selectField('Axis', gate.axis, ['x', 'y'], (value) => edit(() => (gate.axis = value as typeof gate.axis))),
        numberField('Phase (ms)', gate.phaseMs, (value) => edit(() => (gate.phaseMs = value))),
      );
      break;
    }
    case 'room': {
      const room = doc.rooms[selection.index];
      if (!room) break;
      root.append(
        numberField('X', room.x, (value) => edit(() => (room.x = value))),
        numberField('Y', room.y, (value) => edit(() => (room.y = value))),
        numberField('Width', room.width, (value) => edit(() => (room.width = Math.max(1, value)))),
        numberField('Height', room.height, (value) => edit(() => (room.height = Math.max(1, value)))),
        selectField('Style', room.style, [0, 1, 2], (value) => edit(() => (room.style = Number(value) as 0 | 1 | 2))),
      );
      break;
    }
    default:
      break;
  }

  root.append(
    button('Delete', () => {
      state.checkpoint();
      removeSelection(doc, selection);
      state.selection = null;
      state.changed();
    }),
  );
}

function describe(doc: EditorDoc, selection: Selection): string {
  if (selection.type === 'room') {
    const room = doc.rooms[selection.index];
    return room ? `Room #${selection.index} at ${room.x},${room.y}` : 'Room';
  }
  const e = doc.entities;
  const point =
    selection.type === 'prop' ? e.props[selection.index]
    : selection.type === 'terminal' ? e.terminals[selection.index]
    : selection.type === 'corpse' ? e.corpse
    : selection.type === 'loot' ? e.loot[selection.index]
    : selection.type === 'enemy' ? e.enemies[selection.index]
    : selection.type === 'vent' ? e.vents[selection.index]
    : e.gates[selection.index];
  return `${selection.type} at ${point ? `${point.x},${point.y}` : '?'}`;
}

function renderProblems(root: HTMLElement, state: EditorState): void {
  root.replaceChildren(el('h2', { text: 'Validation' }));
  if (state.parseError) {
    root.append(el('p', { className: 'problem', text: state.parseError }));
    return;
  }
  if (state.problems.length === 0) {
    root.append(el('p', { className: 'ok', text: 'No problems.' }));
    return;
  }
  for (const problem of state.problems) {
    const at = problem.at;
    const row = el('button', { className: 'problem', text: at ? `${problem.message} (${at.x},${at.y})` : problem.message });
    row.type = 'button';
    if (at) row.addEventListener('click', () => state.focusOn(at.x, at.y));
    root.append(row);
  }
}
