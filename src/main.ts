import { Game as PhaserGame, AUTO } from 'phaser';
import { Boot } from './scenes/Boot';
import { Preload } from './scenes/Preload';
import { Game } from './scenes/Game';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 1024,
  height: 768,
  parent: 'app',
  backgroundColor: '#050505',
  pixelArt: true,
  scene: [Boot, Preload, Game],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  }
};

new PhaserGame(config);
