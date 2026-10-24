import { GameObjects } from 'phaser';

export interface EntityData {
  gridX?: number;
  gridY?: number;
  isoX?: number;
  isoY?: number;
}

export abstract class Entity extends GameObjects.Container {
  public gridX: number = 0;
  public gridY: number = 0;
  public isoX: number = 0;
  public isoY: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, data?: EntityData) {
    super(scene, x, y);
    scene.add.existing(this);
    
    if (data?.gridX !== undefined) this.gridX = data.gridX;
    if (data?.gridY !== undefined) this.gridY = data.gridY;
    if (data?.isoX !== undefined) this.isoX = data.isoX;
    if (data?.isoY !== undefined) this.isoY = data.isoY;
  }

  public setGridPosition(gridX: number, gridY: number): void {
    this.gridX = gridX;
    this.gridY = gridY;
  }

  public setIsoPosition(isoX: number, isoY: number): void {
    this.isoX = isoX;
    this.isoY = isoY;
    this.x = isoX;
    this.y = isoY;
  }

  public destroy(fromScene?: boolean): void {
    super.destroy(fromScene);
  }
}
