import type { GameObjects, Scene } from 'phaser';
import { CAMERA_ZOOM, DEPTH_DARKNESS, PALETTE } from '../data/config';
import type { Player } from '../entities/Player';
import type { Drone } from '../entities/enemies/Drone';
import type { Dungeon } from './DungeonGen';
import type { Level } from './Level';

const CELL = 5;
const PAD = 3;
const MARGIN = 6;
const WALL = '#';

const DRONE_CHASE = 0xff4a3a;
const DRONE_SEARCH = 0xd9a441;

export class DebugMap {
  private readonly exit: { readonly x: number; readonly y: number } | null;
  private readonly container: GameObjects.Container;
  private readonly markers: GameObjects.Graphics;
  private readonly width: number;
  private readonly height: number;

  constructor(scene: Scene, level: Level, dungeon: Dungeon) {
    this.exit = dungeon.exit;
    this.width = PAD * 2 + level.width * CELL;
    this.height = PAD * 2 + level.height * CELL;

    const frame = scene.add.graphics();
    frame.fillStyle(PALETTE.void, 0.86);
    frame.fillRect(0, 0, this.width, this.height);
    frame.lineStyle(2, PALETTE.steelLight, 0.9);
    frame.strokeRect(1, 1, this.width - 2, this.height - 2);

    const cells = scene.add.graphics();
    cells.fillStyle(PALETTE.steel, 1);
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        if (dungeon.rows[y]?.[x] === WALL) continue;
        cells.fillRect(PAD + x * CELL, PAD + y * CELL, CELL, CELL);
      }
    }

    this.markers = scene.add.graphics();

    this.container = scene.add
      .container(0, 0, [frame, cells, this.markers])
      .setDepth(DEPTH_DARKNESS + 100)
      .setScale(1 / CAMERA_ZOOM);
  }

  update(player: Player, drones: readonly Drone[]): void {
    this.pinToView();

    const markers = this.markers;
    markers.clear();

    if (this.exit) {
      markers.fillStyle(PALETTE.signal, 1);
      markers.fillRect(
        PAD + this.exit.x * CELL - 1,
        PAD + this.exit.y * CELL - 1,
        CELL + 2,
        CELL + 2,
      );
    }

    for (const drone of drones) {
      const grid = drone.gridPosition;
      const state = drone.currentState;
      markers.fillStyle(
        state === 'CHASE' ? DRONE_CHASE : state === 'SEARCH' ? DRONE_SEARCH : PALETTE.bone,
        1,
      );
      markers.fillRect(PAD + grid.x * CELL, PAD + grid.y * CELL, CELL, CELL);
    }

    const playerGrid = player.gridPosition;
    markers.fillStyle(PALETTE.amber, 1);
    markers.fillRect(
      PAD + playerGrid.x * CELL - 1,
      PAD + playerGrid.y * CELL - 1,
      CELL + 2,
      CELL + 2,
    );
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private pinToView(): void {
    const camera = this.container.scene.cameras.main;
    const view = camera.worldView;
    const scale = 1 / camera.zoom;

    this.container.setScale(scale);
    this.container.setPosition(
      view.left + MARGIN * scale,
      view.bottom - MARGIN * scale - this.height * scale,
    );
  }
}
