import { Game as PhaserGame, AUTO, Scale } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './data/config';
import { Boot } from './scenes/Boot';
import { Preload } from './scenes/Preload';
import { Game } from './scenes/Game';
import { HudScene } from './scenes/Hud';
import { Menu } from './scenes/Menu';
import { Pause } from './scenes/Pause';
import { End } from './scenes/End';
import { Intro } from './scenes/Intro';
import { SecretScene } from './scenes/Secret';
import { Credits } from './scenes/Credits';
import { Cutscene } from './scenes/Cutscene';
import { isDebugMode } from './utils/devflags';

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
  scene: [Boot, Preload, Menu, Cutscene, Intro, Game, HudScene, Pause, SecretScene, End, Credits],
};

const game = new PhaserGame(config);

if (isDebugMode()) {
  (window as unknown as { __game?: PhaserGame }).__game = game;
}
