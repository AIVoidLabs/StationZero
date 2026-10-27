import { GameObjects, Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/config';
import { createCanvasContext, refreshCanvasTexture } from '../utils/canvas';
import type { Game } from './Game';

const DEATH_VIGNETTE_KEY = 'hud_death_vignette';

export class HudScene extends Scene {
  private hpText!: GameObjects.Text;
  private ammoText!: GameObjects.Text;
  private deathOverlay!: GameObjects.Image;
  private deathText!: GameObjects.Text;
  private lastHp = '';
  private lastAmmo = '';
  private deathShown = false;

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
    const panel = this.add.rectangle(12, 12, 148, 46, 0x14110e, 0.82).setOrigin(0, 0);
    panel.setStrokeStyle(1, 0x6b5a44, 0.9);

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#d7c9b3',
    };

    this.hpText = this.add.text(20, 19, 'HP --/--', style);
    this.ammoText = this.add
      .text(20, 36, 'AMMO --/--', { ...style, color: '#b9a07e' })
      .setOrigin(0, 0);

    if (!this.textures.exists(DEATH_VIGNETTE_KEY)) {
      const ctx = createCanvasContext(this, DEATH_VIGNETTE_KEY, 480, 270);
      const gradient = ctx.createRadialGradient(240, 135, 46, 240, 135, 292);
      gradient.addColorStop(0, 'rgba(64, 10, 6, 0)');
      gradient.addColorStop(0.55, 'rgba(64, 10, 6, 0.22)');
      gradient.addColorStop(0.82, 'rgba(52, 7, 4, 0.62)');
      gradient.addColorStop(1, 'rgba(38, 4, 2, 0.94)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 480, 270);
      refreshCanvasTexture(this, DEATH_VIGNETTE_KEY);
    }

    this.deathOverlay = this.add
      .image(0, 0, DEATH_VIGNETTE_KEY)
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setAlpha(0);
    this.deathText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'SIGNAL LOST', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#8c3b2a',
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);

    this.lastHp = '';
    this.lastAmmo = '';
    this.deathShown = false;
  }

  update(): void {
    const game = this.scene.get('Game') as Game;
    const state = game.hudState;
    if (!state) return;

    const hp = `HP ${state.hp}/${state.maxHp}`;
    const ammo =
      state.weaponType === 'MELEE' || state.ammo <= 0
        ? 'AMMO ---'
        : `AMMO ${state.ammo}/${state.maxAmmo}`;

    if (hp !== this.lastHp) {
      this.hpText.setText(hp);
      this.lastHp = hp;
    }
    if (ammo !== this.lastAmmo) {
      this.ammoText.setText(ammo);
      this.lastAmmo = ammo;
    }

    if (state.hp <= 0) {
      if (!this.deathShown) {
        this.deathShown = true;
        this.tweens.add({
          targets: this.deathOverlay,
          alpha: 1,
          duration: 420,
          ease: 'Quad.easeOut',
        });
        this.tweens.add({
          targets: this.deathText,
          alpha: 1,
          duration: 700,
          delay: 220,
          ease: 'Quad.easeOut',
        });
      }
      return;
    }

    if (this.deathShown) {
      this.deathShown = false;
      this.tweens.killTweensOf(this.deathOverlay);
      this.tweens.killTweensOf(this.deathText);
      this.deathOverlay.setAlpha(0);
      this.deathText.setAlpha(0);
    }
  }
}
