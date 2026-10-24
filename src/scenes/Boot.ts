import { Scene } from 'phaser';

export class Boot extends Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    // Load minimal assets here
  }

  create(): void {
    this.scene.start('Preload');
  }
}
