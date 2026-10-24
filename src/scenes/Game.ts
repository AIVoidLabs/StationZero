import { Scene } from 'phaser';

export class Game extends Scene {
  constructor() {
    super({ key: 'Game' });
  }

  create(): void {
    // Minimal game scene - will be expanded
    const text = this.add.text(this.scale.width / 2, this.scale.height / 2, 'SUBTERRA EXILES', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ff6b1a'
    });
    text.setOrigin(0.5);
  }

  update(): void {
    // Game loop
  }
}
