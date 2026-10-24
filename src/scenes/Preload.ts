import { Scene } from 'phaser';

export class Preload extends Scene {
  constructor() {
    super({ key: 'Preload' });
  }

  preload(): void {
    // Asset loading will go here
  }

  create(): void {
    this.scene.start('Game');
  }
}
