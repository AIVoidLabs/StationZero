import { Game as PhaserGame, AUTO, Scale } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './data/config';
import { Boot } from './scenes/Boot';
import { Preload } from './scenes/Preload';
import { Game } from './scenes/Game';
import { HudScene } from './scenes/Hud';

const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  backgroundColor: '#050505',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Scale.ScaleModes.FIT,
    autoCenter: Scale.Center.CENTER_BOTH,
  },
  scene: [Boot, Preload, Game, HudScene],
};

const game = new PhaserGame(config);

if (window.location.search.includes('debug')) {
  (window as unknown as { __game?: PhaserGame }).__game = game;
}
