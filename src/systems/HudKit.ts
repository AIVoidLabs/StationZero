import type { GameObjects, Scene } from 'phaser';

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
