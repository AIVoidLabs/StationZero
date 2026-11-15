import { BlendModes, type GameObjects, type Scene } from 'phaser';

const FONT = 'monospace';
const BRACKET = 8;

export interface PanelOptions {
  readonly label: string;
  readonly accent: number;
}

export class PanelFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;

  private readonly scene: Scene;
  private readonly graphics: GameObjects.Graphics;
  private readonly tabText: GameObjects.Text;
  private tabWidth: number;
  private baseAccent: number;
  private shownAccent: number;
  private flashTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Scene, x: number, y: number, width: number, height: number, options: PanelOptions) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.baseAccent = options.accent;
    this.shownAccent = options.accent;

    this.graphics = scene.add.graphics();
    this.tabText = scene.add
      .text(x + 16, y - 8, options.label, { fontFamily: FONT, fontSize: '8px', color: '#050505' })
      .setOrigin(0, 0.5);
    this.tabWidth = this.tabText.width + 12;
    this.draw();
  }

  setLabel(label: string): void {
    this.tabText.setText(label);
    this.tabWidth = this.tabText.width + 12;
    this.draw();
  }

  setAccent(accent: number): void {
    if (accent === this.baseAccent) return;
    this.baseAccent = accent;
    if (this.flashTimer === null) {
      this.shownAccent = accent;
      this.draw();
    }
  }

  flash(color: number, ms = 380): void {
    this.flashTimer?.remove();
    this.shownAccent = color;
    this.draw();
    this.flashTimer = this.scene.time.delayedCall(ms, () => {
      this.flashTimer = null;
      this.shownAccent = this.baseAccent;
      this.draw();
    });
  }

  private draw(): void {
    const g = this.graphics;
    const { x, y, width, height } = this;
    const accent = this.shownAccent;
    g.clear();

    g.fillStyle(0x0b0907, 0.9);
    g.fillRect(x, y, width, height);
    g.fillStyle(0x1b1610, 0.9);
    g.fillRect(x, y, width, height / 2);
    g.fillStyle(0x000000, 0.18);
    for (let line = y + 2; line < y + height; line += 3) g.fillRect(x, line, width, 1);

    g.lineStyle(1, 0x050505, 1);
    g.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
    g.lineStyle(1, accent, 0.4);
    g.strokeRect(x + 3.5, y + 3.5, width - 7, height - 7);

    g.lineStyle(2, accent, 1);
    g.beginPath();
    g.moveTo(x, y + BRACKET);
    g.lineTo(x, y);
    g.lineTo(x + BRACKET, y);
    g.moveTo(x + width - BRACKET, y);
    g.lineTo(x + width, y);
    g.lineTo(x + width, y + BRACKET);
    g.moveTo(x + width, y + height - BRACKET);
    g.lineTo(x + width, y + height);
    g.lineTo(x + width - BRACKET, y + height);
    g.moveTo(x + BRACKET, y + height);
    g.lineTo(x, y + height);
    g.lineTo(x, y + height - BRACKET);
    g.strokePath();

    g.fillStyle(0x6b5a44, 1);
    for (const [rx, ry] of [
      [x + 6, y + 6],
      [x + width - 8, y + 6],
      [x + 6, y + height - 8],
      [x + width - 8, y + height - 8],
    ] as const) {
      g.fillRect(rx, ry, 2, 2);
    }

    g.fillStyle(accent, 1);
    g.fillRect(x + 10, y - 14, this.tabWidth, 12);
    g.fillStyle(0x050505, 1);
    g.fillRect(x + 10, y - 3, this.tabWidth, 1);
    this.tabText.setPosition(x + 16, y - 8).setColor('#050505');
  }
}

export function drawSlantCell(
  g: GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  skew: number,
  color: number,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(x + skew, y);
  g.lineTo(x + width + skew, y);
  g.lineTo(x + width, y + height);
  g.lineTo(x, y + height);
  g.closePath();
  g.fillPath();
}

export interface ExitPointer {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly visible: boolean;
  readonly distance: number;
}

const BEACON_CYAN = 0x3ab4d2;
const BEACON_DARK = 0x050505;
const CHEVRON_PITCH = 10;
const CHEVRON_STEP_MS = 130;
const PLATE_HEIGHT = 30;
const PLATE_SKEW = 6;
const INTRO_MS = 1000;
const MARKER_LIFT = 44;
const MARKER_FADE_NEAR = 1.5;
const MARKER_FADE_SPAN = 1.5;
const CHEVRON: readonly (readonly [number, number])[] = [
  [-4, -9],
  [1, -9],
  [8, 0],
  [1, 9],
  [-4, 9],
  [3, 0],
];

export class ExitBeacon {
  private readonly root: GameObjects.Container;
  private readonly glow: GameObjects.Graphics;
  private readonly chevrons: GameObjects.Graphics;
  private readonly plate: GameObjects.Graphics;
  private readonly label: GameObjects.Text;
  private readonly range: GameObjects.Text;
  private plateWidth = 0;
  private introMs = 0;
  private shown = false;

  constructor(scene: Scene, label: string) {
    this.glow = scene.add.graphics().setBlendMode(BlendModes.ADD);
    for (const radius of [34, 27, 20, 13]) {
      this.glow.fillStyle(BEACON_CYAN, 0.07);
      this.glow.fillCircle(0, 0, radius);
    }
    this.chevrons = scene.add.graphics();
    this.plate = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, label, { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#c9eef7' })
      .setOrigin(0.5, 0.5);
    this.range = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '9px', color: '#3ab4d2' }).setOrigin(0.5, 0.5);
    this.root = scene.add
      .container(0, 0, [this.glow, this.plate, this.label, this.range, this.chevrons])
      .setVisible(false);
    this.drawPlate();
  }

  setLabel(label: string): void {
    this.label.setText(label);
    this.drawPlate();
  }

  update(pointer: ExitPointer | null, time: number, delta: number): void {
    if (!pointer) {
      this.root.setVisible(false);
      this.shown = false;
      return;
    }
    if (!this.shown) {
      this.shown = true;
      this.introMs = INTRO_MS;
    }
    this.introMs = Math.max(0, this.introMs - delta);
    const intro = this.introMs / INTRO_MS;

    const edge = pointer.visible;
    const angle = edge ? pointer.angle : Math.PI / 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const bob = 4 * Math.sin(time / 190);
    const near = edge ? 1 : Math.max(0, Math.min(1, (pointer.distance - MARKER_FADE_NEAR) / MARKER_FADE_SPAN));

    this.root
      .setVisible(near > 0.01)
      .setPosition(pointer.x + dirX * bob, pointer.y + dirY * bob - (edge ? 0 : MARKER_LIFT))
      .setScale(1 + 0.4 * intro * intro)
      .setAlpha(near);

    this.glow.setAlpha(0.7 + 0.3 * Math.sin(time / 320) + intro);
    this.drawChevrons(angle, time, intro);

    const reach = 30 + Math.abs(dirX) * (this.plateWidth / 2) + Math.abs(dirY) * (PLATE_HEIGHT / 2);
    const plateX = -dirX * reach;
    const plateY = -dirY * reach;
    this.plate.setPosition(plateX, plateY);
    this.label.setPosition(plateX + 2, plateY - 5);
    this.range.setPosition(plateX + 2, plateY + 8).setText(`${Math.max(1, Math.round(pointer.distance))} M`);
  }

  private drawChevrons(angle: number, time: number, intro: number): void {
    const g = this.chevrons;
    const lit = Math.floor(time / CHEVRON_STEP_MS) % 5;
    g.clear();
    g.setRotation(angle);
    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * CHEVRON_PITCH;
      const trace = (): void => {
        g.beginPath();
        CHEVRON.forEach(([px, py], point) => {
          if (point === 0) g.moveTo(px + offset, py);
          else g.lineTo(px + offset, py);
        });
        g.closePath();
      };
      trace();
      g.lineStyle(3, BEACON_DARK, 1);
      g.strokePath();
      trace();
      g.fillStyle(index === lit || intro > 0.5 ? 0xc9eef7 : BEACON_CYAN, index === lit ? 1 : 0.55 + 0.45 * intro);
      g.fillPath();
    }
  }

  private drawPlate(): void {
    const g = this.plate;
    const width = Math.max(58, this.label.width + 30);
    const left = -width / 2;
    const top = -PLATE_HEIGHT / 2;
    this.plateWidth = width;
    g.clear();
    drawSlantCell(g, left - PLATE_SKEW / 2, top, width, PLATE_HEIGHT, PLATE_SKEW, BEACON_DARK, 0.88);
    drawSlantCell(g, left - PLATE_SKEW / 2, top, 5, PLATE_HEIGHT, PLATE_SKEW, BEACON_CYAN, 1);
    g.lineStyle(1, BEACON_CYAN, 0.9);
    g.beginPath();
    g.moveTo(left + PLATE_SKEW / 2, top);
    g.lineTo(left + width + PLATE_SKEW / 2, top);
    g.lineTo(left + width - PLATE_SKEW / 2, top + PLATE_HEIGHT);
    g.lineTo(left - PLATE_SKEW / 2, top + PLATE_HEIGHT);
    g.closePath();
    g.strokePath();
    g.fillStyle(BEACON_CYAN, 0.35);
    g.fillRect(left + 10, top + PLATE_HEIGHT / 2 + 1, width - 18, 1);
  }
}
