import { BlendModes, type GameObjects, type Scene, type Tweens } from 'phaser';
import { TILE_HEIGHT, TILE_WIDTH } from '../../data/config';
import { DESCENT_SIGNAL_KEY, LOOT_SPRITE_KEY } from '../../systems/PlaceholderArt';
import { gridVectorToWorld } from '../../utils/iso';
import { Entity } from '../Entity';

export class LootPickup extends Entity {
  private readonly sprite: GameObjects.Image;
  private readonly glow: GameObjects.Image;
  private readonly pulse: Tweens.Tween;
  private collected = false;

  constructor(scene: Scene, gridX: number, gridY: number) {
    const iso = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
    super(scene, iso.x, iso.y, { gridX, gridY, isoX: iso.x, isoY: iso.y });

    this.glow = scene.add
      .image(0, -7, DESCENT_SIGNAL_KEY)
      .setOrigin(0.5, 0.5)
      .setBlendMode(BlendModes.ADD)
      .setScale(0.62)
      .setAlpha(0.28);

    this.sprite = scene.add.image(0, 0, LOOT_SPRITE_KEY).setOrigin(0.5, 1);

    this.add([this.glow, this.sprite]);
    this.setDepth(iso.y);

    this.pulse = scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.2, to: 0.55 },
      scaleX: { from: 0.56, to: 0.8 },
      scaleY: { from: 0.56, to: 0.8 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  get isCollected(): boolean {
    return this.collected;
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.pulse.stop();

    const spark = this.scene.add
      .circle(0, -7, 3, 0xf0c070, 0.9)
      .setBlendMode(BlendModes.ADD);
    this.add(spark);

    this.scene.tweens.add({
      targets: spark,
      alpha: 0,
      scaleX: 2.6,
      scaleY: 2.6,
      duration: 220,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: [this.sprite, this.glow],
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => this.destroy(),
    });
  }

  destroy(fromScene?: boolean): void {
    this.pulse.stop();
    this.sprite.destroy();
    this.glow.destroy();
    this.removeAll(true);
    super.destroy(fromScene);
  }
}
