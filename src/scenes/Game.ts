import { Input, Scene } from 'phaser';
import {
  CAMERA_LOOK_AHEAD,
  CAMERA_LERP,
  CAMERA_ZOOM,
  DESCENT_ARRIVAL_PULSE_MS,
  DESCENT_FADE_MS,
  FLOOR_COUNT,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../data/config';
import { Player, type MoveInput } from '../entities/Player';
import { Ambience } from '../systems/Ambience';
import { Combat } from '../systems/Combat';
import { Darkness } from '../systems/Darkness';
import { DebugMap } from '../systems/DebugMap';
import { Decor } from '../systems/Decor';
import { DepthManager } from '../systems/DepthManager';
import { DescentGate } from '../systems/DescentGate';
import type { Dungeon, DungeonExit } from '../systems/DungeonGen';
import { Level } from '../systems/Level';
import { Lantern } from '../systems/Lantern';
import { loadDungeon } from '../systems/LevelLoader';
import { LogFeed } from '../systems/LogFeed';
import { Occlusion } from '../systems/Occlusion';
import { PlayerCombat } from '../systems/PlayerCombat';
import { TileCursor, type HoverTarget } from '../systems/TileCursor';
import { WardenAtmosphere } from '../systems/WardenAtmosphere';
import { gridVectorToWorld, worldToGrid } from '../utils/iso';

interface GameSceneData {
  readonly floor?: number;
}

interface DebugWindow extends Window {
  __sz?: {
    level: Level;
    player: Player;
    dungeon: Dungeon;
    warden: WardenAtmosphere;
    decor: Decor;
    logFeed: LogFeed;
    ambience: Ambience;
    combat: Combat;
    depth: DepthManager;
    darkness: Darkness;
    lantern: Lantern;
    floor: number;
    exit: DungeonExit | null;
    gate: DescentGate | null;
    debugMap: DebugMap | null;
    scene: Game;
  };
}

export class Game extends Scene {
  private player: Player | undefined = undefined;
  private level: Level | undefined = undefined;
  private darkness: Darkness | undefined = undefined;
  private lantern: Lantern | undefined = undefined;
  private occlusion: Occlusion | undefined = undefined;
  private decor: Decor | undefined = undefined;
  private logFeed: LogFeed | undefined = undefined;
  private warden: WardenAtmosphere | undefined = undefined;
  private ambience: Ambience | undefined = undefined;
  private combat: Combat | undefined = undefined;
  private depth: DepthManager | undefined = undefined;
  private gate: DescentGate | undefined = undefined;
  private debugMap: DebugMap | undefined = undefined;
  private tileCursor: TileCursor | undefined = undefined;
  private playerCombat: PlayerCombat | undefined = undefined;
  private floor = 0;
  private transitioning = false;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined = undefined;
  private wKey: Input.Keyboard.Key | undefined = undefined;
  private aKey: Input.Keyboard.Key | undefined = undefined;
  private sKey: Input.Keyboard.Key | undefined = undefined;
  private dKey: Input.Keyboard.Key | undefined = undefined;
  private mKey: Input.Keyboard.Key | undefined = undefined;
  private unlockedHandler: (() => void) | undefined = undefined;
  private pointerHandler: ((pointer: Phaser.Input.Pointer) => void) | undefined = undefined;
  private pointerMoveHandler: ((pointer: Phaser.Input.Pointer) => void) | undefined = undefined;
  private pointerOutHandler: (() => void) | undefined = undefined;
  private attackKey: Phaser.Input.Keyboard.Key | undefined = undefined;
  private pointerInside = false;

  constructor() {
    super({ key: 'Game' });
  }

  init(data?: GameSceneData): void {
    const requested = data?.floor ?? this.readFloorOverride() ?? 0;
    this.floor = this.clampFloor(requested);
    this.transitioning = false;
  }

  create(): void {
    const floor = this.floor;
    const dungeon = loadDungeon(floor);
    const level = new Level(dungeon);
    level.render(this);

    const decor = new Decor(this, level, dungeon);
    const player = new Player(this, level, level.spawnX, level.spawnY);
    const depth = new DepthManager(floor);
    const combat = new Combat(this, level, dungeon, player, depth);
    const gate = dungeon.exit ? new DescentGate(this, dungeon.exit) : null;
    const lantern = new Lantern(this, player.x, player.y);
    const darkness = new Darkness(this);
    const warden = new WardenAtmosphere(this, player.x, player.y);
    const ambience = new Ambience(this);
    ambience.start();
    const unlockedHandler = (): void => {
      ambience.start();
    };
    this.sound.once('unlocked', unlockedHandler);
    const logFeed = new LogFeed(this, decor.terminals, floor === FLOOR_COUNT - 1);
    const occlusion = new Occlusion(this, [
      ...level.walls.map((sprite) => ({ sprite, baseY: sprite.y - TILE_HEIGHT / 2 })),
      ...decor.occluders,
    ]);
    const tileCursor = new TileCursor(this);
    const debugMode = window.location.search.includes('debug');
    const debugMap = debugMode ? new DebugMap(this, level, dungeon) : null;

    const playerCombat = new PlayerCombat(this, player, level, () => combat.roster);

    darkness.update(player.x, player.y);

    this.player = player;
    this.level = level;
    this.lantern = lantern;
    this.darkness = darkness;
    this.occlusion = occlusion;
    this.decor = decor;
    this.logFeed = logFeed;
    this.warden = warden;
    this.ambience = ambience;
    this.combat = combat;
    this.depth = depth;
    this.gate = gate ?? undefined;
    this.debugMap = debugMap ?? undefined;
    this.playerCombat = playerCombat;
    this.unlockedHandler = unlockedHandler;
    this.tileCursor = tileCursor;

    this.applyDepth(depth);

    if (floor > 0) {
      this.time.delayedCall(DESCENT_ARRIVAL_PULSE_MS, () => {
        this.warden?.pulseNow(true);
      });
    }

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
    if (debugMode) {
      debugWindow.__sz = {
        level,
        player,
        dungeon,
        warden,
        decor,
        logFeed,
        ambience,
        combat,
        depth,
        darkness,
        lantern,
        floor,
        exit: dungeon.exit,
        gate,
        debugMap,
        scene: this,
      };
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
      if (this.attackKey) {
        this.input.keyboard?.removeKey(this.attackKey);
        this.attackKey = undefined;
      }
      this.pointerInside = false;
      if (this.unlockedHandler) {
        this.sound.off('unlocked', this.unlockedHandler);
        this.unlockedHandler = undefined;
      }
      this.ambience?.destroy();
      this.ambience = undefined;
      this.combat?.destroy();
      this.combat = undefined;
      this.playerCombat = undefined;
      this.gate?.destroy();
      this.gate = undefined;
      this.debugMap?.destroy();
      this.debugMap = undefined;
      this.depth = undefined;
      this.occlusion?.destroy();
      this.occlusion = undefined;
      this.decor?.destroy();
      this.decor = undefined;
      this.logFeed?.destroy();
      this.logFeed = undefined;
      this.warden?.destroy();
      this.warden = undefined;
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
      this.mKey = undefined;
      this.transitioning = false;
      delete debugWindow.__sz;
    });
  }

  update(_time: number, delta: number): void {
    const player = this.player;
    const darkness = this.darkness;
    const lantern = this.lantern;
    const occlusion = this.occlusion;
    const logFeed = this.logFeed;
    const warden = this.warden;
    const ambience = this.ambience;
    const combat = this.combat;
    const depth = this.depth;
    if (
      !player ||
      !darkness ||
      !lantern ||
      !occlusion ||
      !logFeed ||
      !warden ||
      !ambience ||
      !combat ||
      !depth
    ) {
      return;
    }

    if (this.transitioning) return;

    if (this.mKey && Input.Keyboard.JustDown(this.mKey)) {
      ambience.toggleMute();
    }

    player.update(delta, this.readInput());
    const grid = player.gridPosition;

    if (this.gate?.update(delta, player) === true) {
      this.beginDescent();
      return;
    }

    combat.update(delta);
    this.debugMap?.update(player, combat.roster);

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
    warden.update(delta, player.x, player.y);
    if (warden.takeSilenceRequest()) ambience.silence(depth.pressure.silenceHoldScale);

    logFeed.update(grid.x, grid.y, delta);
  }

  private applyDepth(depth: DepthManager): void {
    const pressure = depth.pressure;
    this.darkness?.setVisionScale(pressure.lightScale);
    this.lantern?.setIntensity(pressure.lanternScale);
    this.ambience?.setDepthBand(pressure.band);
    this.warden?.setPressure(pressure);
  }

  private beginDescent(): void {
    if (this.transitioning) return;

    const nextFloor = this.floor + 1;
    if (nextFloor >= FLOOR_COUNT) return;

    this.transitioning = true;
    this.player?.cancelPath();
    this.tileCursor?.hide();

    this.cameras.main.fadeOut(DESCENT_FADE_MS, 2, 2, 2);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ floor: nextFloor });
    });
  }

  private clampFloor(value: number): number {
    return Math.max(0, Math.min(FLOOR_COUNT - 1, Math.round(value)));
  }

  private readFloorOverride(): number | null {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('floor') ?? params.get('depth');
    if (raw === null) return null;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : null;
  }

  private setupInput(player: Player): void {
    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.wKey = keyboard.addKey(Input.Keyboard.KeyCodes.W);
      this.aKey = keyboard.addKey(Input.Keyboard.KeyCodes.A);
      this.sKey = keyboard.addKey(Input.Keyboard.KeyCodes.S);
      this.dKey = keyboard.addKey(Input.Keyboard.KeyCodes.D);
      this.mKey = keyboard.addKey(Input.Keyboard.KeyCodes.M);
    }

    const handler = (pointer: Phaser.Input.Pointer): void => {
      if (this.transitioning) return;
      if (this.playerCombat) {
        this.playerCombat.tryAttack(this.time.now);
      }
      this.pointerInside = true;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const grid = worldToGrid(world.x, world.y, TILE_WIDTH, TILE_HEIGHT);
      player.setDestination(grid.gridX, grid.gridY);
    };

    const moveHandler = (pointer: Phaser.Input.Pointer): void => {
      if (!this.transitioning && pointer.isDown && this.playerCombat) {
        this.playerCombat.tryAttack(this.time.now);
      }
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

    this.attackKey = this.input.keyboard?.addKey(Input.Keyboard.KeyCodes.SPACE);
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
