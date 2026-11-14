import { AUTO, Game, Scale } from 'phaser';
import { EditorScene } from './EditorScene';
import { mountPanels } from './panels';
import { EditorState } from './state';

const state = new EditorState();
mountPanels(state);

const game = new Game({
  type: AUTO,
  parent: 'stage',
  backgroundColor: '#0b0b0b',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Scale.ScaleModes.RESIZE, width: '100%', height: '100%' },
  scene: [],
});
game.scene.add('Editor', EditorScene, true, { state });
(window as unknown as { __editor?: { state: EditorState; game: Game } }).__editor = { state, game };
