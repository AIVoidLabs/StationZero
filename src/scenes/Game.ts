import { Input, Scene } from 'phaser';
import {
  CAMERA_LOOK_AHEAD,
  CAMERA_LERP,
  CAMERA_ZOOM,
  DUNGEON_SEED,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../data/config';
import { Player, type MoveInput } from '../entities/Player';
import { Darkness } from '../systems/Darkness';
import { generateDungeon } from '../systems/DungeonGen';
import { Lantern } from '../systems/Lantern';
import { Level } from '../systems/Level';
import { Occlusion } from '../systems/Occlusion';
import { TileCursor, type HoverTarget } from '../systems/TileCursor';
import { gridVectorToWorld, worldToGrid } from '../utils/iso';

interface DebugWindow extends Window {
  __sz?: {
    level: Level;
    player: Player;
    dungeon: ReturnType<typeof generateDungeon>;
  };
}

export class Game extends Scene {
  private player: Player | undefined = undefined;
  private level: Level | undefined = undefined;
  private darkness: Darkness | undefined = undefined;
  private lantern: Lantern | undefined = undefined;
  private occlusion: Occlusion | undefined = undefined;
  private tileCursor: TileCursor | undefined = undefined;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined = undefined;
  private wKey: Input.Keyboard.Key | undefined = undefined;
  private aKey: Input.Keyboard.Key | undefined = undefined;
  private sKey: Input.Keyboard.Key | undefined = undefined;
  private dKey: Input.Keyboard.Key | undefined = undefined;
  private pointerHandler: ((pointer: Phaser.Input.Pointer) => void) | undefined = undefined;
  private pointerMoveHandler: (() => void) | undefined = undefined;
  private pointerOutHandler: (() => void) | undefined = undefined;
  private pointerInside = false;

  constructor() {
    super({ key: 'Game' });
  }

  create(): void {
    const dungeon = generateDungeon(DUNGEON_SEED);
    const level = new Level(dungeon);
    level.render(this);

    const player = new Player(this, level, level.spawnX, level.spawnY);
    const lantern = new Lantern(this, player.x, player.y);
    const darkness = new Darkness(this);
    const occlusion = new Occlusion(this, level.walls);
    const tileCursor = new TileCursor(this);

    darkness.update(player.x, player.y);

    this.player = player;
    this.level = level;
    this.lantern = lantern;
    this.darkness = darkness;
    this.occlusion = occlusion;
    this.tileCursor = tileCursor;

    const camera = this.cameras.main;
    camera.setZoom(CAMERA_ZOOM);
    camera.setRoundPixels(true);
    camera.setBounds(
      level.cameraBounds.x,
      level.cameraBounds.y,
      level.cameraBounds.width,
      level.cameraBounds.height,
    );
    camera.startFollow(player, true, CAMERA_LERP, CAMERA_LERP);
    camera.fadeIn(900, 5, 5, 5);

    this.setupInput(player);

    const debugWindow = window as DebugWindow;
    if (window.location.search.includes('debug')) {
      debugWindow.__sz = { level, player, dungeon };
    }

    this.events.once('shutdown', () => {
      if (this.pointerHandler) {
        this.input.off('pointerdown', this.pointerHandler);
        this.pointerHandler = undefined;
      }
      if (this.pointerMoveHandler) {
        this.input.off('pointermove', this.pointerMoveHandler);
        this.pointerMoveHandler = undefined;
      }
      if (this.pointerOutHandler) {
        this.input.off('gameout', this.pointerOutHandler);
        this.pointerOutHandler = undefined;
      }
      this.pointerInside = false;
      this.occlusion?.destroy();
      this.occlusion = undefined;
      this.tileCursor?.destroy();
      this.tileCursor = undefined;
      this.lantern?.destroy();
      this.lantern = undefined;
      this.darkness?.destroy();
      this.darkness = undefined;
      this.player = undefined;
      this.level = undefined;
      this.cursors = undefined;
      this.wKey = undefined;
      this.aKey = undefined;
      this.sKey = undefined;
      this.dKey = undefined;
      delete debugWindow.__sz;
    });
  }

  update(_time: number, delta: number): void {
    const player = this.player;
    const darkness = this.darkness;
    const lantern = this.lantern;
    const occlusion = this.occlusion;
    if (!player || !darkness || !lantern || !occlusion) return;

    player.update(delta, this.readInput());

    const lead = player.leadDirection;
    this.cameras.main.setFollowOffset(
      -lead.x * CAMERA_LOOK_AHEAD,
      -lead.y * CAMERA_LOOK_AHEAD,
    );

    const hover = this.resolveHover();
    if (hover) this.tileCursor?.show(hover);
    else this.tileCursor?.hide();

    occlusion.update(player.x, player.y, hover?.walkable === true ? hover : null);
    lantern.update(player.x, player.y);
    darkness.update(player.x, player.y);
  }

  private setupInput(player: Player): void {
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.wKey = keyboard.addKey(Input.Keyboard.KeyCodes.W);
      this.aKey = keyboard.addKey(Input.Keyboard.KeyCodes.A);
      this.sKey = keyboard.addKey(Input.Keyboard.KeyCodes.S);
      this.dKey = keyboard.addKey(Input.Keyboard.KeyCodes.D);
    }

    const handler = (pointer: Phaser.Input.Pointer): void => {
      this.pointerInside = true;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const grid = worldToGrid(world.x, world.y, TILE_WIDTH, TILE_HEIGHT);
      player.setDestination(grid.gridX, grid.gridY);
    };

    const moveHandler = (): void => {
      this.pointerInside = true;
    };

    const outHandler = (): void => {
      this.pointerInside = false;
      this.tileCursor?.hide();
    };

    this.input.on('pointerdown', handler);
    this.input.on('pointermove', moveHandler);
    this.input.on('gameout', outHandler);
    this.pointerHandler = handler;
    this.pointerMoveHandler = moveHandler;
    this.pointerOutHandler = outHandler;
  }

  private resolveHover(): HoverTarget | null {
    const level = this.level;
    if (!level || !this.pointerInside) return null;

    const pointer = this.input.activePointer;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const grid = worldToGrid(world.x, world.y, TILE_WIDTH, TILE_HEIGHT);

    if (
      grid.gridX < 0 ||
      grid.gridY < 0 ||
      grid.gridX >= level.width ||
      grid.gridY >= level.height
    ) {
      return null;
    }

    const center = gridVectorToWorld(grid.gridX, grid.gridY, TILE_WIDTH, TILE_HEIGHT);
    return {
      x: center.x,
      y: center.y,
      gridX: grid.gridX,
      gridY: grid.gridY,
      walkable: level.isWalkable(grid.gridX, grid.gridY),
    };
  }

  private readInput(): MoveInput | null {
    let x = 0;
    let y = 0;

    if (this.cursors?.left.isDown || this.aKey?.isDown) x -= 1;
    if (this.cursors?.right.isDown || this.dKey?.isDown) x += 1;
    if (this.cursors?.up.isDown || this.wKey?.isDown) y -= 1;
    if (this.cursors?.down.isDown || this.sKey?.isDown) y += 1;

    if (x === 0 && y === 0) return null;
    return { x, y };
  }
}
