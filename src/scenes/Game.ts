import { Input, Scene } from 'phaser';
import {
  BULLET_HEIGHT_PX,
  LOG_REACH_TILES,
  CAMERA_LOOK_AHEAD,
  CAMERA_LERP,
  CAMERA_ZOOM,
  DEPTH_VFX,
  DESCENT_ARRIVAL_PULSE_MS,
  DESCENT_FADE_MS,
  DESCENT_SPIN_MS,
  DRONE_DEATH_FLARE_MS,
  FLOOR_COUNT,
  PLAYER_LIGHT_RADIUS,
  TILE_HEIGHT,
  TILE_WIDTH,
} from '../data/config';
import type { Drone } from '../entities/enemies/Drone';
import { Player, type MoveInput, type WeaponType } from '../entities/Player';
import { Ambience } from '../systems/Ambience';
import { Combat } from '../systems/Combat';
import { LightMap, type DarknessLayer, type LightEmitter, type LightSource } from '../systems/LightMap';
import { Decor } from '../systems/Decor';
import { DepthManager } from '../systems/DepthManager';
import { DescentGate } from '../systems/DescentGate';
import type { Dungeon, DungeonExit } from '../systems/DungeonGen';
import { Exploration } from '../systems/Exploration';
import { Level } from '../systems/Level';
import type { MapState } from '../systems/MiniMap';
import { Lantern } from '../systems/Lantern';
import { loadDungeon } from '../systems/LevelLoader';
import { LogFeed } from '../systems/LogFeed';
import { Barrels } from '../systems/Barrels';
import { Hazards } from '../systems/Hazards';
import { LootSystem } from '../systems/LootSystem';
import { Occlusion } from '../systems/Occlusion';
import { PlayerCombat } from '../systems/PlayerCombat';
import { TileCursor, type HoverTarget } from '../systems/TileCursor';
import { WardenAtmosphere } from '../systems/WardenAtmosphere';
import { facingScreenAngle } from '../utils/facing';
import { runStats } from '../systems/RunStats';
import { saveGame } from '../systems/SaveGame';
import { arrivalLine, clearLine } from '../data/story';
import { floorInfo } from '../data/floors';
import { hints } from '../systems/Hints';
import { voice } from '../systems/Voice';
import { keyName } from '../systems/Settings';
import { t, type StringKey } from '../i18n';
import { dialogueForFloor, type Effect } from '../data/dialogue';
import { runFlags } from '../systems/RunFlags';
import { upgradeStats } from '../systems/Upgrades';
import { scaledAmmoDrop } from '../data/difficulty';
import { ENEMY_SPECS } from '../data/enemies';
import { SECRET_COUNT } from '../data/secrets';
import { descentCutscene } from '../data/cutscenes';
import { logKeyFor } from '../systems/LogFeed';
import { sfx } from '../systems/Sfx';
import { isDebugMode, devStartFloor } from '../utils/devflags';
import { isDevStart } from '../utils/devstart';
import { settings } from '../systems/Settings';
import { gridVectorToWorld, worldToGrid } from '../utils/iso';

let cardCounter = 0;

export interface HudState {
  hp: number;
  maxHp: number;
  ammo: number;
  maxAmmo: number;
  weaponType: WeaponType;
  floor: number;
  floorCount: number;
  floorCode: string;
  floorName: string;
  floorTagline: string;
  prompt: string | null;
  objective: string;
  objectiveCalm: boolean;
  cardToken: number;
  exitPointer: { x: number; y: number; angle: number; visible: boolean } | null;
  hostiles: number;
  exit: 'NONE' | 'LOCKED' | 'OPEN';
  lastFloor: boolean;
  secrets: number;
}

const DEATH_TO_END_MS = 2200;
const CLEAR_TO_END_MS = 1500;

interface GameSceneData {
  readonly floor?: number;
  readonly hp?: number;
  readonly ammo?: number;
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
    loot: LootSystem;
    hazards: Hazards;
    barrels: Barrels;
    depth: DepthManager;
    darkness: DarknessLayer;
    lantern: Lantern;
    floor: number;
    exit: DungeonExit | null;
    gate: DescentGate | null;
    scene: Game;
  };
}

export class Game extends Scene {
  private player: Player | undefined = undefined;
  private level: Level | undefined = undefined;
  private darkness: DarknessLayer | undefined = undefined;
  private lantern: Lantern | undefined = undefined;
  private occlusion: Occlusion | undefined = undefined;
  private decor: Decor | undefined = undefined;
  private logFeed: LogFeed | undefined = undefined;
  private warden: WardenAtmosphere | undefined = undefined;
  private ambience: Ambience | undefined = undefined;
  private combat: Combat | undefined = undefined;
  private hazards: Hazards | undefined = undefined;
  private barrels: Barrels | undefined = undefined;
  private loot: LootSystem | undefined = undefined;
  private depth: DepthManager | undefined = undefined;
  private gate: DescentGate | undefined = undefined;
  private tileCursor: TileCursor | undefined = undefined;
  private playerCombat: PlayerCombat | undefined = undefined;
  private floor = 0;
  private transitioning = false;
  private spinning = false;
  private ending = false;
  private deathMs = 0;
  private clearMs = 0;
  private cardToken = 0;
  private lightMul = 1;
  private hintClock = 0;
  private hintHp = -1;
  private startSeen = 0;
  private unsubscribeVoice: (() => void) | undefined = undefined;
  private exploration: Exploration | undefined = undefined;
  private carry: { hp: number; ammo: number } | undefined = undefined;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined = undefined;
  private wKey: Input.Keyboard.Key | undefined = undefined;
  private aKey: Input.Keyboard.Key | undefined = undefined;
  private sKey: Input.Keyboard.Key | undefined = undefined;
  private dKey: Input.Keyboard.Key | undefined = undefined;
  private mKey: Input.Keyboard.Key | undefined = undefined;
  private pauseKey: Input.Keyboard.Key | undefined = undefined;
  private interactKey: Input.Keyboard.Key | undefined = undefined;
  private unsubscribeSettings: (() => void) | undefined = undefined;
  private unlockedHandler: (() => void) | undefined = undefined;
  private pointerHandler: ((pointer: Phaser.Input.Pointer) => void) | undefined = undefined;
  private pointerMoveHandler: ((pointer: Phaser.Input.Pointer) => void) | undefined = undefined;
  private pointerOutHandler: (() => void) | undefined = undefined;
  private attackKey: Phaser.Input.Keyboard.Key | undefined = undefined;
  private attackTarget: Drone | undefined = undefined;
  private repathCell: { x: number; y: number } | undefined = undefined;
  private lastRepathAt = 0;
  private pointerInside = false;

  constructor() {
    super({ key: 'Game' });
  }

  init(data?: GameSceneData): void {
    this.carry = data?.hp !== undefined && data.ammo !== undefined ? { hp: data.hp, ammo: data.ammo } : undefined;
    this.spinning = false;
    this.ending = false;
    this.deathMs = 0;
    this.clearMs = 0;
    this.hintClock = 0;
    this.hintHp = -1;
    const requested = data?.floor ?? devStartFloor() ?? 0;
    this.floor = this.clampFloor(requested);
    this.transitioning = false;
  }

  create(): void {
    const floor = this.floor;
    const dungeon = loadDungeon(floor);
    const level = new Level(dungeon);
    level.render(this);

    const decor = new Decor(this, level, dungeon);
    const player = new Player(this, level, level.spawnX, level.spawnY, this.carry);
    const depth = new DepthManager(floor);
    const loot = new LootSystem(this, level, dungeon, player);
    const combat = new Combat(this, level, dungeon, player, depth, (drone) => {
      const at = drone.gridPosition;
      loot.roll(at.x, at.y, scaledAmmoDrop(ENEMY_SPECS[drone.kind].ammoDrop, floor));
    });
    const hazards = new Hazards(
      this,
      dungeon,
      player,
      () => combat.roster,
    );
    const barrels = new Barrels(this, level, player, () => combat.roster, decor.barrels);
    combat.projectileSystem.setBlockedHitHandler((x, y, owner) => barrels.hitCell(x, y, owner === 'player'));
    const gate = dungeon.exit ? new DescentGate(this, dungeon.exit) : null;
    if (dungeon.exit) level.blockCell(dungeon.exit.x, dungeon.exit.y);
    const lantern = new Lantern(this, player.x, player.y);
    const emitLights: LightEmitter = (emit) => this.emitLights(emit, lantern, combat);
    const darkness: DarknessLayer = new LightMap(this, emitLights);
    const warden = new WardenAtmosphere(this, player.x, player.y);
    const ambience = new Ambience(this);
    sfx.attach(this);
    ambience.start();
    const unlockedHandler = (): void => {
      ambience.start();
    };
    this.sound.once('unlocked', unlockedHandler);
    const logFeed = new LogFeed(this, decor.terminals, floor);
    const occlusion = new Occlusion(this, [
      ...level.walls.map((sprite) => ({ sprite, baseY: sprite.y - TILE_HEIGHT / 2 })),
      ...decor.occluders,
    ]);
    const tileCursor = new TileCursor(this);
    const exploration = new Exploration(level, dungeon);
    runStats.reachFloor(floor + 1);
    if (!isDevStart()) {
      const health = player.getHealth();
      saveGame.save(floor, health.hp, health.ammo, runStats.snapshot(), runFlags.snapshot());
    }
    exploration.update(Math.round(level.spawnX), Math.round(level.spawnY), this.time.now);

    const playerCombat = new PlayerCombat(
      this,
      player,
      level,
      () => combat.roster,
      combat.projectileSystem,
    );

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
    this.hazards = hazards;
    this.barrels = barrels;
    this.loot = loot;
    this.depth = depth;
    this.gate = gate ?? undefined;
    this.playerCombat = playerCombat;
    this.attackTarget = undefined;
    this.repathCell = undefined;
    this.lastRepathAt = 0;
    this.unlockedHandler = unlockedHandler;
    this.tileCursor = tileCursor;
    this.exploration = exploration;
    this.startSeen = exploration.seenCount;
    this.cardToken = ++cardCounter;
    this.lightMul = upgradeStats().lightMul;
    voice.attach(this);
    voice.clear();
    hints.clear();
    this.unsubscribeVoice = voice.onSpeaking((speaking) => ambience.setVoiceDuck(speaking));
    this.time.delayedCall(1500, () => voice.say(arrivalLine(floor), 'warden'));
    if (floor === 3) this.time.delayedCall(6200, () => this.exileOnce('drill', 'exile.drill'));
    if (floor === FLOOR_COUNT - 1) this.time.delayedCall(6200, () => this.exileOnce('final', 'exile.final'));

    if (!this.scene.isActive('HudScene')) {
      this.scene.launch('HudScene');
    }
    this.scene.bringToTop('HudScene');

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
    if (isDebugMode()) {
      debugWindow.__sz = {
        level,
        player,
        dungeon,
        warden,
        decor,
        logFeed,
        ambience,
        combat,
        loot,
        hazards,
        barrels,
        depth,
        darkness,
        lantern,
        floor,
        exit: dungeon.exit,
        gate,
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
      for (const key of [this.wKey, this.aKey, this.sKey, this.dKey, this.mKey, this.attackKey, this.pauseKey, this.interactKey]) {
        if (key) this.input.keyboard?.removeKey(key);
      }
      this.attackKey = undefined;
      this.pointerInside = false;
      if (this.unlockedHandler) {
        this.sound.off('unlocked', this.unlockedHandler);
        this.unlockedHandler = undefined;
      }
      this.ambience?.destroy();
      this.ambience = undefined;
      this.combat?.destroy();
      this.combat = undefined;
      this.hazards?.destroy();
      this.hazards = undefined;
      this.barrels?.destroy();
      this.barrels = undefined;
      this.playerCombat = undefined;
      this.attackTarget = undefined;
      this.repathCell = undefined;
      this.loot?.destroy();
      this.loot = undefined;
      this.gate?.destroy();
      this.gate = undefined;
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
      this.pauseKey = undefined;
      this.interactKey = undefined;
      this.unsubscribeSettings?.();
      this.unsubscribeSettings = undefined;
      this.unsubscribeVoice?.();
      this.unsubscribeVoice = undefined;
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

    if (this.pauseKey && Input.Keyboard.JustDown(this.pauseKey)) {
      this.openPause();
      return;
    }

    if (this.mKey && Input.Keyboard.JustDown(this.mKey)) {
      sfx.setMuted(ambience.toggleMute());
    }

    runStats.addTime(delta);

    if (this.interactKey && Input.Keyboard.JustDown(this.interactKey)) {
      this.interact();
      if (this.scene.isPaused()) return;
    }

    const input = this.readInput();
    if (input) this.clearAttackTarget();
    player.update(delta, input);
    this.updateCombatTarget();

    if (this.attackKey && Input.Keyboard.JustDown(this.attackKey)) {
      this.playerCombat?.tryAttack(this.time.now, this.attackTarget);
    }

    const grid = player.gridPosition;

    this.updateDoor(delta, player, combat);
    this.updateEnding(delta, player, combat);
    this.updateHints(delta, player, combat);
    this.exploration?.update(Math.round(grid.x), Math.round(grid.y), this.time.now);

    combat.update(delta);
    this.hazards?.update();
    this.barrels?.update(delta);
    this.loot?.update(player);
    if (this.pointerInside) {
      const pointer = this.input.activePointer;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.loot?.hoverAt(world.x, world.y, player);
    } else {
      this.loot?.hoverAt(null, 0, player);
    }

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

  setAudioDucked(ducked: boolean): void {
    this.ambience?.setDucked(ducked);
  }

  saveNow(): void {
    const player = this.player;
    if (!player || player.isDeadState) return;
    const health = player.getHealth();
    saveGame.save(this.floor, health.hp, health.ammo, runStats.snapshot(), runFlags.snapshot());
  }

  restartFloor(): void {
    const save = saveGame.load();
    const carry = save && save.floor === this.floor ? save : null;
    this.scene.restart({ floor: this.floor, hp: carry?.hp, ammo: carry?.ammo });
  }

  private updateHints(delta: number, player: Player, combat: Combat): void {
    if (!settings.data.hints) return;
    this.hintClock += delta;
    const keys = settings.data.keys;
    const grid = player.gridPosition;
    const health = player.getHealth();

    if (this.floor === 0 && this.hintClock > 2600) {
      hints.trigger(
        'move',
        t('hint.move', {
          keys: `${keyName(keys.up)} ${keyName(keys.left)} ${keyName(keys.down)} ${keyName(keys.right)}`,
        }),
      );
    }

    if (this.terminalNear() !== null) hints.trigger('interact', t('hint.interact', { key: keyName(keys.interact) }));

    for (const drone of combat.roster) {
      if (drone.isDead) continue;
      if (drone.currentState === 'CHASE') {
        this.exileOnce('drone', 'exile.drone');
        hints.trigger('attack', t('hint.attack', { key: keyName(keys.attack) }));
      }
      if (drone.isAiming) hints.trigger('dodge', t('hint.dodge'));
    }

    for (const drone of combat.roster) {
      if (drone.isDead || drone.kind === 'drone') continue;
      const at = drone.gridPosition;
      if (Math.hypot(at.x - grid.x, at.y - grid.y) >= 10) continue;
      hints.trigger(drone.kind === 'tank' ? 'tank' : 'boss', t(drone.kind === 'tank' ? 'hint.tank' : 'hint.boss'));
    }

    for (const cell of this.hazards?.ventCells ?? []) {
      if (Math.hypot(cell.x - grid.x, cell.y - grid.y) < 4) hints.trigger('steam', t('hint.steam'));
    }

    for (const cell of this.hazards?.gateCells ?? []) {
      if (Math.hypot(cell.x - grid.x, cell.y - grid.y) < 5) hints.trigger('laser', t('hint.laser'));
    }

    for (const item of this.loot?.pickups ?? []) {
      if (!item.isCollected && Math.hypot(item.gridX - grid.x, item.gridY - grid.y) < 3) {
        hints.trigger('loot', t('hint.loot'));
        break;
      }
    }

    const gate = this.gate;
    if (gate && gate.state === 'LOCKED' && Math.hypot(gate.cell.x - grid.x, gate.cell.y - grid.y) < 3.6) {
      hints.trigger('sealed', t('hint.sealed'));
    }

    if (this.exploration && this.exploration.seenCount > this.startSeen + 16) {
      hints.trigger('map', t('hint.map'));
    }

    if (this.hintHp >= 0 && health.hp < this.hintHp) {
      hints.trigger('hit', t('hint.hit'));
      this.exileOnce('hurt', 'exile.hurt');
    }
    this.hintHp = health.hp;

    if (health.ammo === 0) hints.trigger('noammo', t('hint.noammo'));
    if (health.hp === 1) {
      hints.trigger('lowhp', t('hint.lowhp'));
      this.exileOnce('low', 'exile.low');
    }
  }

  private updateEnding(delta: number, player: Player, combat: Combat): void {
    if (this.ending) return;

    if (player.isDeadState) {
      if (this.deathMs === 0) voice.say('warden.dead', 'warden');
      this.deathMs += delta;
      if (this.deathMs >= DEATH_TO_END_MS) this.endRun('dead');
      return;
    }

    const lastFloor = this.floor === FLOOR_COUNT - 1;
    if (lastFloor && combat.roster.every((drone) => drone.isDead)) {
      if (this.clearMs === 0) voice.say(clearLine(this.floor), 'warden');
      this.clearMs += delta;
      if (this.clearMs >= CLEAR_TO_END_MS) this.endRun('survived');
    }
  }

  private endRun(outcome: 'dead' | 'survived'): void {
    this.ending = true;
    this.transitioning = true;
    this.cameras.main.fadeOut(700, 2, 2, 2);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop('HudScene');
      if (outcome === 'survived' && settings.data.cutscenes) {
        const id = runFlags.compliant ? 'end_comply' : 'end_defy';
        this.scene.start('Cutscene', { id, next: { scene: 'End', data: { outcome } } });
        return;
      }
      this.scene.start('End', { outcome });
    });
  }

  private updateDoor(delta: number, player: Player, combat: Combat): void {
    const gate = this.gate;
    if (!gate || !this.level) return;

    if (gate.state === 'LOCKED' && combat.roster.every((drone) => drone.isDead)) {
      this.level.unblockCell(gate.cell.x, gate.cell.y);
      gate.open();
      voice.say(clearLine(this.floor), 'warden');
      hints.trigger('unsealed', t('hint.unsealed'));
    }

    if (gate.update(delta, player) && !this.spinning) {
      this.spinning = true;
      this.clearAttackTarget();
      this.tileCursor?.hide();
      player.startSpin(DESCENT_SPIN_MS, gate.cell.x, gate.cell.y);
    }

    if (this.spinning) {
      gate.setActivation(player.spinProgress);
      if (player.spinFinished) {
        this.spinning = false;
        this.beginDescent();
      }
    }
  }

  private emitLights(
    emit: (light: LightSource) => void,
    lantern: Lantern,
    combat: Combat,
  ): void {
    const now = this.time.now;
    this.hazards?.emitLights(emit);
    this.barrels?.emitLights(emit);
    const player = this.player;
    if (player && !player.isDeadState) {
      const flicker = 1 + Math.sin(now / 130) * 0.035 + Math.sin(now / 57) * 0.02;
      emit({
        x: player.x,
        y: player.y - 14,
        radius: PLAYER_LIGHT_RADIUS * lantern.intensityScale * flicker * this.lightMul,
        intensity: 1,
        tint: 'warm',
        squash: 0.8,
      });
    }

    for (const drone of combat.roster) {
      const at = { x: drone.x, y: drone.y - 16 };
      const state = drone.lightState;
      if (state.kind === 'wreck') {
        const fade = 1 - Math.min(1, state.deathAgeMs / DRONE_DEATH_FLARE_MS);
        if (fade > 0) emit({ ...at, radius: 110 * fade, intensity: 0.9 * fade, tint: 'red' });
        emit({ x: at.x, y: at.y + 8, radius: 30, intensity: 0.22, tint: 'ember' });
        continue;
      }

      const angle = facingScreenAngle(state.facing);
      if (state.kind === 'aim') {
        const pulse = 0.85 + Math.sin(now / 45) * 0.15;
        emit({ ...at, radius: 150, intensity: 0.9 * pulse, tint: 'red' });
        emit({ ...at, radius: 0, intensity: 0.8, tint: 'red', cone: { angle, length: 360 } });
      } else if (state.kind === 'chase') {
        emit({ ...at, radius: 110, intensity: 0.65, tint: 'red' });
        emit({ ...at, radius: 0, intensity: 0.55, tint: 'red', cone: { angle, length: 300 } });
      } else if (state.kind === 'search') {
        emit({ ...at, radius: 84, intensity: 0.5, tint: 'amber' });
        emit({ ...at, radius: 0, intensity: 0.4, tint: 'amber', cone: { angle, length: 240 } });
      } else {
        emit({ ...at, radius: 64, intensity: 0.38, tint: 'cold' });
        emit({ ...at, radius: 0, intensity: 0.3, tint: 'cold', cone: { angle, length: 200 } });
      }
    }

    const projectiles = combat.projectileSystem;
    for (const bullet of projectiles.active) {
      const world = gridVectorToWorld(bullet.x, bullet.y, TILE_WIDTH, TILE_HEIGHT);
      emit({
        x: world.x,
        y: world.y - BULLET_HEIGHT_PX,
        radius: 62,
        intensity: 0.85,
        tint: bullet.owner === 'player' ? 'amber' : 'red',
      });
    }
    for (const flare of projectiles.flares) {
      const world = gridVectorToWorld(flare.x, flare.y, TILE_WIDTH, TILE_HEIGHT);
      const remaining = 1 - flare.age / flare.duration;
      emit({
        x: world.x,
        y: world.y - BULLET_HEIGHT_PX,
        radius: flare.radius * (1 + (1 - remaining) * 0.6),
        intensity: 0.9 * remaining,
        tint: flare.owner === 'player' ? 'amber' : 'red',
      });
    }

    const gate = this.gate;
    if (gate) {
      const world = gridVectorToWorld(gate.cell.x, gate.cell.y, TILE_WIDTH, TILE_HEIGHT);
      if (gate.state === 'LOCKED') {
        const pulse = 0.7 + Math.sin(now / 280) * 0.3;
        emit({ x: world.x, y: world.y - 4, radius: 56, intensity: 0.4 * pulse, tint: 'red' });
      } else {
        emit({
          x: world.x,
          y: world.y,
          radius: 90 * gate.openness,
          intensity: 0.6 * gate.openness,
          tint: 'cyan',
        });
      }
    }

    for (const pickup of this.loot?.pickups ?? []) {
      if (pickup.isCollected) continue;
      emit({
        x: pickup.x,
        y: pickup.y - 8,
        radius: 48,
        intensity: 0.55,
        tint: pickup.kind === 'stim' ? 'green' : 'amber',
        squash: 0.7,
      });
    }
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

    const health = this.player?.getHealth();
    this.cameras.main.fadeOut(DESCENT_FADE_MS, 2, 2, 2);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const cutscene = settings.data.cutscenes ? descentCutscene(nextFloor) : null;
      const next = { floor: nextFloor, hp: health?.hp, ammo: health?.ammo };
      if (cutscene) {
        this.scene.stop('HudScene');
        this.scene.start('Cutscene', { id: cutscene, next: { scene: 'Game', data: next } });
        return;
      }
      this.scene.restart(next);
    });
  }

  private clampFloor(value: number): number {
    return Math.max(0, Math.min(FLOOR_COUNT - 1, Math.round(value)));
  }

  private setupInput(player: Player): void {
    this.bindKeys();
    this.unsubscribeSettings = settings.subscribe(() => this.bindKeys());

    const handler = (pointer: Phaser.Input.Pointer): void => {
      if (this.transitioning) return;
      this.pointerInside = true;

      if (pointer.rightButtonDown()) {
        this.stopAndFirePistol();
        return;
      }
      if (!pointer.leftButtonDown()) return;

      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const hover = this.resolveHoverAt(world);
      const target = this.findDroneAt(hover);

      if (target) {
        this.attackTarget = target;
        this.repathCell = undefined;
        player.setAttackTarget({ gridX: target.gridPosition.x, gridY: target.gridPosition.y });
        return;
      }

      this.clearAttackTarget();
      if (hover && hover.walkable) {
        player.cancelPath();
        player.setDestination(hover.gridX, hover.gridY);
      }
    };

    const moveHandler = (pointer: Phaser.Input.Pointer): void => {
      this.pointerInside = true;
      if (this.transitioning) return;
      if (pointer.rightButtonDown()) {
        this.stopAndFirePistol();
      }
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

    this.input.mouse?.disableContextMenu();
  }

  private bindKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    for (const key of [this.wKey, this.aKey, this.sKey, this.dKey, this.mKey, this.attackKey, this.pauseKey, this.interactKey]) {
      if (key) keyboard.removeKey(key);
    }

    const keys = settings.data.keys;
    this.cursors = this.cursors ?? keyboard.createCursorKeys();
    this.wKey = keyboard.addKey(keys.up);
    this.sKey = keyboard.addKey(keys.down);
    this.aKey = keyboard.addKey(keys.left);
    this.dKey = keyboard.addKey(keys.right);
    this.attackKey = keyboard.addKey(keys.attack);
    this.mKey = keyboard.addKey(keys.mute);
    this.pauseKey = keyboard.addKey(keys.pause);
    this.interactKey = keyboard.addKey(keys.interact);
  }

  applyDialogueEffect(effect: Effect): void {
    const player = this.player;
    switch (effect.type) {
      case 'alert':
        runFlags.addAlert(effect.amount);
        break;
      case 'stance':
        runFlags.addStance(effect.amount);
        break;
      case 'lore':
        runFlags.addLore(effect.id);
        break;
      case 'reveal':
        if (player && this.exploration) {
          const grid = player.gridPosition;
          this.exploration.revealRadius(Math.round(grid.x), Math.round(grid.y), effect.radius, this.time.now);
        }
        break;
      case 'secret':
        this.collectSecret(effect.floor);
        break;
      case 'wake':
        this.combat?.wakeBoss();
        break;
      case 'cache':
        if (player) {
          const grid = player.gridPosition;
          this.loot?.spawnNear(grid.x, grid.y, effect.kind);
        }
        break;
    }
  }

  private collectSecret(floor: number): void {
    const player = this.player;
    if (!player || runFlags.hasSecret(floor)) return;
    runFlags.addSecret(floor);
    player.refreshUpgrades();
    if (floor === SECRET_COUNT - 1) player.heal(Number.MAX_SAFE_INTEGER);
    this.lightMul = upgradeStats().lightMul;
    sfx.play('pickupHealth');

    const label = this.add
      .text(player.x, player.y - 56, `${t('secret.taken')}: ${t(`secret.b${floor + 1}` as StringKey)}`, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#d9a441',
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_VFX + 5);
    this.tweens.add({
      targets: label,
      y: label.y - 18,
      alpha: 0,
      duration: 2600,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private exileOnce(id: string, key: string): void {
    if (runFlags.hasLore(`x_${id}`)) return;
    runFlags.addLore(`x_${id}`);
    voice.say(key, 'exile');
  }

  private terminalNear(): { index: number; cell: { x: number; y: number } } | null {
    const player = this.player;
    const terminals = this.decor?.terminals ?? [];
    if (!player) return null;
    const grid = player.gridPosition;
    let best: { index: number; cell: { x: number; y: number } } | null = null;
    let bestDistance = LOG_REACH_TILES + 0.2;
    terminals.forEach((cell, index) => {
      const distance = Math.max(Math.abs(cell.x - grid.x), Math.abs(cell.y - grid.y));
      if (distance > bestDistance) return;
      bestDistance = distance;
      best = { index, cell: { x: cell.x, y: cell.y } };
    });
    return best;
  }

  private promptText(): string | null {
    const near = this.terminalNear();
    if (!near) return null;
    const key = keyName(settings.data.keys.interact);
    if (near.index === 0 && dialogueForFloor(this.floor)) return t('prompt.access', { key });
    return t('prompt.read', { key });
  }

  private interact(): void {
    const near = this.terminalNear();
    if (!near) return;
    if (near.index === 0 && dialogueForFloor(this.floor)) {
      this.exileOnce('terminal', 'exile.terminal');
      this.openDialogue();
      return;
    }
    voice.say(logKeyFor(near.cell, this.floor), 'log');
  }

  private openDialogue(): void {
    if (this.transitioning || this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.pause('HudScene');
    this.scene.launch('Dialogue', { floor: this.floor });
  }

  private openPause(): void {
    if (this.transitioning || this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.pause('HudScene');
    this.scene.launch('Pause');
  }

  get mapState(): MapState | null {
    const player = this.player;
    const exploration = this.exploration;
    if (!player || !exploration) return null;
    const grid = player.gridPosition;
    const gate = this.gate;
    return {
      exploration,
      playerX: grid.x,
      playerY: grid.y,
      drones: (this.combat?.roster ?? [])
        .filter((drone) => !drone.isDead)
        .map((drone) => ({
          x: drone.gridPosition.x,
          y: drone.gridPosition.y,
          state: drone.currentState,
        })),
      exit: gate ? gate.cell : null,
      exitOpen: gate?.isOpen === true,
    };
  }

  get hudState(): HudState | null {
    const player = this.player;
    if (!player) return null;
    const hostiles = (this.combat?.roster ?? []).filter((drone) => !drone.isDead).length;
    const gate = this.gate;
    const exit = gate === undefined ? 'NONE' : gate.state === 'LOCKED' ? 'LOCKED' : 'OPEN';
    const lastFloor = this.floor === FLOOR_COUNT - 1;
    const info = floorInfo(this.floor);

    let objective = '';
    let objectiveCalm = false;
    if (exit === 'OPEN') {
      objective = t('obj.hatch');
      objectiveCalm = true;
    } else if (hostiles > 0) {
      objective = t('obj.hostiles', { n: hostiles });
    } else if (lastFloor) {
      objective = t('obj.clear');
      objectiveCalm = true;
    }

    return {
      ...player.getHealth(),
      floor: this.floor + 1,
      floorCount: FLOOR_COUNT,
      floorCode: info.code,
      floorName: info.name,
      floorTagline: info.tagline,
      prompt: this.promptText(),
      objective,
      objectiveCalm,
      cardToken: this.cardToken,
      exitPointer: exit === 'OPEN' ? this.computeExitPointer() : null,
      hostiles,
      exit,
      lastFloor,
      secrets: runFlags.secretCount,
    };
  }

  private computeExitPointer(): { x: number; y: number; angle: number; visible: boolean } | null {
    const gate = this.gate;
    if (!gate) return null;
    const camera = this.cameras.main;
    const view = camera.worldView;
    const world = gridVectorToWorld(gate.cell.x, gate.cell.y, TILE_WIDTH, TILE_HEIGHT);
    const sx = (world.x - view.x) * camera.zoom;
    const sy = (world.y - view.y) * camera.zoom;
    const margin = 36;
    const width = camera.width;
    const height = camera.height;
    const onScreen = sx > margin && sx < width - margin && sy > margin && sy < height - margin;
    if (onScreen) return { x: sx, y: sy, angle: 0, visible: false };

    const cx = width / 2;
    const cy = height / 2;
    const dx = sx - cx;
    const dy = sy - cy;
    const scale = Math.min((cx - margin) / Math.max(1e-3, Math.abs(dx)), (cy - margin) / Math.max(1e-3, Math.abs(dy)));
    return { x: cx + dx * scale, y: cy + dy * scale, angle: Math.atan2(dy, dx), visible: true };
  }

  private findDroneAt(hover: HoverTarget | null): Drone | null {
    if (!hover) return null;
    let best: Drone | null = null;
    let bestDistance = 1.2;

    for (const drone of this.combat?.roster ?? []) {
      if (drone.isDead) continue;
      const grid = drone.gridPosition;
      const distance = Math.hypot(grid.x - hover.gridX, grid.y - hover.gridY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = drone;
      }
    }

    return best;
  }

  private clearAttackTarget(): void {
    this.attackTarget = undefined;
    this.repathCell = undefined;
    this.player?.setAttackTarget(null);
  }

  private stopAndFirePistol(): void {
    const player = this.player;
    if (!player) return;
    if (player.weapon !== 'PISTOL' || player.ammoCount <= 0) return;
    this.clearAttackTarget();
    player.cancelPath();
    this.playerCombat?.tryRightClickPistol(this.time.now, undefined);
  }

  private updateCombatTarget(): void {
    const player = this.player;
    const combat = this.playerCombat;
    const target = this.attackTarget;
    if (!player || !combat) return;

    if (!target) return;
    if (target.isDead) {
      this.clearAttackTarget();
      return;
    }

    const targetGrid = target.gridPosition;

    if (combat.canAttackTarget(target)) {
      player.cancelPath();
      this.repathCell = undefined;
      if (!player.canAttack(this.time.now)) return;
      player.beginAttacking();
      combat.tryAttack(this.time.now, target);
      return;
    }

    const cellX = Math.round(targetGrid.x);
    const cellY = Math.round(targetGrid.y);
    const drifted =
      !this.repathCell ||
      Math.abs(cellX - this.repathCell.x) >= 1 ||
      Math.abs(cellY - this.repathCell.y) >= 1;

    if (!player.hasPath || drifted) {
      if (!player.hasPath && this.time.now - this.lastRepathAt < 250) return;
      player.cancelPath();
      this.lastRepathAt = this.time.now;
      if (!player.setDestination(cellX, cellY)) {
        this.clearAttackTarget();
        return;
      }
      player.setAttackTarget({ gridX: cellX, gridY: cellY });
      this.repathCell = { x: cellX, y: cellY };
    }
  }

  private resolveHoverAt(world: { x: number; y: number }): HoverTarget | null {
    const level = this.level;
    if (!level) return null;
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

  private resolveHover(): HoverTarget | null {
    const level = this.level;
    if (!level || !this.pointerInside) return null;
    const pointer = this.input.activePointer;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return this.resolveHoverAt(world);
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
