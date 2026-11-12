import { BlendModes, type GameObjects, type Scene, type Tweens } from 'phaser';
import { LOOT_V2_KEY, selectWorldArt } from '../../assets/manifest';
import { TILE_HEIGHT, TILE_WIDTH } from '../../data/config';
import { DESCENT_SIGNAL_KEY, LOOT_SPRITE_KEY } from '../../systems/PlaceholderArt';
import { gridVectorToWorld } from '../../utils/iso';
import { Entity } from '../Entity';

export type LootKind = 'stim' | 'ammo';

const KIND_FRAME: Record<LootKind, number> = { stim: 0, ammo: 1 };
const GLOW_TINT: Record<LootKind, number> = { stim: 0x6fe09a, ammo: 0xf0c070 };
const LEGACY_TINT: Record<LootKind, number | null> = { stim: null, ammo: 0xe0b050 };

export class LootPickup extends Entity {
  readonly kind: LootKind;
  private readonly sprite: GameObjects.Image;
  private readonly glow: GameObjects.Image;
  private readonly pulse: Tweens.Tween;
  private collected = false;

  constructor(scene: Scene, gridX: number, gridY: number, kind: LootKind) {
    const iso = gridVectorToWorld(gridX, gridY, TILE_WIDTH, TILE_HEIGHT);
    super(scene, iso.x, iso.y, { gridX, gridY, isoX: iso.x, isoY: iso.y });
    this.kind = kind;

    this.glow = scene.add
      .image(0, -7, DESCENT_SIGNAL_KEY)
      .setOrigin(0.5, 0.5)
      .setBlendMode(BlendModes.ADD)
      .setScale(0.62)
      .setAlpha(0.28)
      .setTint(GLOW_TINT[kind]);

    const useV2 = selectWorldArt().loot && scene.textures.exists(LOOT_V2_KEY);
    this.sprite = useV2
      ? scene.add.image(0, 0, LOOT_V2_KEY, KIND_FRAME[kind])
      : scene.add.image(0, 0, LOOT_SPRITE_KEY);
    this.sprite.setOrigin(0.5, 1);
    const legacyTint = LEGACY_TINT[kind];
    if (!useV2 && legacyTint !== null) this.sprite.setTint(legacyTint);

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

  setHighlight(on: boolean): void {
    if (this.collected) return;
    this.glow.setTint(on ? 0xffffff : GLOW_TINT[this.kind]);
    this.sprite.setScale(on ? 1.15 : 1);
  }

  get isCollected(): boolean {
    return this.collected;
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;
    this.pulse.stop();

    const spark = this.scene.add
      .circle(0, -7, 3, GLOW_TINT[this.kind], 0.9)
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
