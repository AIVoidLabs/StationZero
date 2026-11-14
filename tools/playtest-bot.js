// Dev-only playtest bot. Load it in a page opened with ?debug&depth=0:
//   eval(await (await fetch('/tools/playtest-bot.js')).text());
//   await __bot.boot(); __bot.run(4000, 2000)
// It steps the game manually (no rendering), plays with a naive fight-everything policy and logs progress to
// localStorage so a crashed page can still be inspected.
(() => {
  const DT = 1000 / 60;
  const B = (window.__bot = { flags: { shoot: true, hud: true, dark: true, think: true, trace: false, prefill: false, stopAtClear: false }, simNow: 0, steps: 0, state: 'run', cur: null, floors: {}, realMs: 0, errors: [], thinkMs: 0, log: [] });
  const game = () => window.__game;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const key = () => ['Game', 'Cutscene', 'End', 'Menu', 'Intro'].find((k) => game().scene.isActive(k));
  const save = (note) => {
    try {
      localStorage.setItem('bot-log', JSON.stringify({ note, steps: B.steps, summary: B.summary() }));
    } catch (e) {}
  };

  B.noop = () => {};
  B.boot = async () => {
    for (let i = 0; i < 400 && !(window.__game && window.__sz); i += 1) {
      await new Promise((r) => setTimeout(r, 50));
      if (window.__game) {
        try {
          window.__game.step(performance.now(), 16.7);
        } catch (e) {}
      }
    }
    const stub = () => new Proxy(function () {}, { get: (t, k) => (k === 'connect' ? (x) => x : k === 'disconnect' ? () => {} : k === 'value' ? 0 : stub()), set: () => true, apply: () => stub() });
    for (const name of ['createBufferSource', 'createOscillator', 'createGain', 'createBiquadFilter', 'createStereoPanner', 'createConvolver', 'createDynamicsCompressor', 'createDelay', 'createWaveShaper', 'createAnalyser']) {
      AudioContext.prototype[name] = function () {
        return stub();
      };
    }
    if (!B.flags.hud) { const hud = game().scene.getScene('HudScene'); if (hud) hud.update = B.noop; }
    B.simNow = (game().loop.time || performance.now()) + 90000;
    return { game: !!window.__game, sz: !!window.__sz };
  };

  function los(level, a, b) {
    const x0 = Math.round(a.x), y0 = Math.round(a.y), x1 = Math.round(b.x), y1 = Math.round(b.y);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 1; i < n; i += 1) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
      if (!level.isWalkable(x, y)) return false;
    }
    return true;
  }
  function enterFloor(sz) {
    const f = sz.floor, hp = sz.player.getHealth();
    B.floors[f] = { start: B.simNow, hpStart: hp.hp, maxHp: hp.maxHp, enemies: sz.combat.roster.map((d) => d.kind), damage: 0, shots: 0, ammoTaken: 0, lastHp: hp.hp, lastAmmo: hp.ammo };
    if (B.flags.prefill) for (let i = 0; i < Math.min(f, 10); i += 1) sz.scene.applyDialogueEffect({ type: 'secret', floor: i });
    if (f < 10) sz.scene.applyDialogueEffect({ type: 'secret', floor: f });
    if (B.flags.prefill) { const hp = sz.player.getHealth(); sz.player.heal(hp.maxHp); B.floors[f].hpStart = sz.player.getHealth().hp; B.floors[f].maxHp = sz.player.getHealth().maxHp; B.floors[f].lastHp = sz.player.getHealth().hp; B.floors[f].lastAmmo = sz.player.getHealth().ammo; }
    B.cur = sz;
  }
  function closeFloor(f, reason) {
    const rec = B.floors[f];
    if (!rec || rec.end !== undefined) return;
    rec.end = B.simNow;
    rec.seconds = Math.round((rec.end - rec.start) / 100) / 10;
    rec.reason = reason;
    const sz = window.__sz;
    if (sz && sz.floor === f) {
      const hp = sz.player.getHealth();
      rec.hpEnd = hp.hp;
      rec.ammoEnd = hp.ammo;
    }
  }
  function track(sz) {
    const rec = B.floors[sz.floor];
    if (!rec) return;
    const hp = sz.player.getHealth();
    if (hp.hp < rec.lastHp) rec.damage += rec.lastHp - hp.hp;
    if (hp.ammo < rec.lastAmmo) rec.shots += rec.lastAmmo - hp.ammo;
    if (hp.ammo > rec.lastAmmo) rec.ammoTaken += hp.ammo - rec.lastAmmo;
    rec.lastHp = hp.hp;
    rec.lastAmmo = hp.ammo;
  }
  function think(sz) {
    const sc = sz.scene, p = sz.player, now = sc.time.now, hp = p.getHealth(), pos = p.gridPosition;
    const alive = sz.combat.roster.filter((d) => !d.isDead);
    const gate = sc.gate;
    if (gate && gate.state !== 'LOCKED') {
      if (!p.hasPath) p.setDestination(gate.cell.x, gate.cell.y);
      return;
    }
    const items = sz.loot.pickups.filter((i) => !i.isCollected);
    const wantStim = hp.hp <= hp.maxHp * 0.5, wantAmmo = hp.ammo <= 3;
    if (wantStim || wantAmmo) {
      const pool = items.filter((i) => (wantStim && i.kind === 'stim') || (wantAmmo && i.kind === 'ammo'));
      pool.sort((a, b) => dist(pos, { x: a.gridX, y: a.gridY }) - dist(pos, { x: b.gridX, y: b.gridY }));
      const pick = pool[0];
      if (pick) {
        const dd = dist(pos, { x: pick.gridX, y: pick.gridY });
        if (dd > 0.5 && dd < 14) {
          if (!p.hasPath || B.steps % 30 === 0) p.setDestination(pick.gridX, pick.gridY);
          return;
        }
      }
    }
    if (alive.length === 0) {
      const pool = items.filter((i) => (i.kind === 'stim' && hp.hp < hp.maxHp) || (i.kind === 'ammo' && hp.ammo < hp.maxAmmo));
      pool.sort((a, b) => dist(pos, { x: a.gridX, y: a.gridY }) - dist(pos, { x: b.gridX, y: b.gridY }));
      const pick = pool[0];
      if (pick && !p.hasPath) p.setDestination(pick.gridX, pick.gridY);
      return;
    }
    alive.sort((a, b) => dist(pos, a.gridPosition) - dist(pos, b.gridPosition));
    const target = alive[0], tp = target.gridPosition, d = dist(pos, tp), visible = los(sz.level, pos, tp);
    if (hp.ammo > 0 && d <= 6.5 && visible) {
      p.cancelPath();
      if (B.flags.shoot) sc.playerCombat.tryAttack(now, target);
    } else if (hp.ammo <= 0 && d <= 1.5) {
      p.cancelPath();
      if (B.flags.shoot) sc.playerCombat.tryAttack(now, target);
    } else if (!p.hasPath || B.steps % 25 === 0) p.setDestination(Math.round(tp.x), Math.round(tp.y));
  }
  function mark(phase, extra) {
    if (!B.flags.trace) return;
    try {
      const sz = window.__sz;
      const p = sz && sz.player;
      localStorage.setItem('bot-trace', JSON.stringify({ phase, steps: B.steps, pos: p ? [p.gridPosition.x, p.gridPosition.y] : null, path: p ? p.hasPath : null, extra }));
    } catch (e) {}
  }
  function stepOnce() {
    B.simNow += DT;
    mark('update-start');
    game().scene.update(B.simNow, DT);
    mark('update-end');
    B.steps += 1;
    const k = key();
    if (k === 'Cutscene') {
      const cs = game().scene.getScene('Cutscene');
      if (cs && typeof cs.finish === 'function') cs.finish();
      return;
    }
    if (k === 'End') {
      B.state = 'ended';
      const sz = window.__sz;
      if (sz) closeFloor(sz.floor, sz.player.isDeadState ? 'dead' : 'won');
      return;
    }
    if (k !== 'Game') return;
    const sz = window.__sz;
    if (!sz || !sz.player) return;
    if (B.cur !== sz) {
      if (B.cur) closeFloor(B.cur.floor, 'descended');
      enterFloor(sz);
    }
    track(sz);
    const rec = B.floors[sz.floor];
    if (sz.player.isDeadState) {
      B.state = 'dead';
      rec.deathNear = sz.combat.roster.filter((d) => !d.isDead).map((d) => d.kind + '@' + Math.round(dist(sz.player.gridPosition, d.gridPosition) * 10) / 10);
      closeFloor(sz.floor, 'dead');
      return;
    }
    if (B.flags.stopAtClear && sz.combat.roster.every((d) => d.isDead)) {
      B.state = 'cleared';
      closeFloor(sz.floor, 'cleared');
      return;
    }
    if (B.simNow - rec.start > 420000) {
      B.state = 'stuck';
      closeFloor(sz.floor, 'stuck');
      return;
    }
    if (!B.flags.dark && sz.darkness && sz.darkness.update !== B.noop) sz.darkness.update = B.noop;
    if (B.steps % 6 === 0 && B.flags.think) {
      const t0 = performance.now();
      mark('think-start');
      try {
        think(sz);
      } catch (e) {
        B.errors.push(String(e));
        B.state = 'error';
      }
      B.thinkMs += performance.now() - t0;
    }
  }
  B.run = (maxRealMs, maxSteps = 1e9, chunk = 120) => {
    const t0 = performance.now();
    let n = 0;
    while (performance.now() - t0 < maxRealMs && B.state === 'run' && n < maxSteps) {
      save('before-chunk');
      for (let i = 0; i < chunk && B.state === 'run' && n < maxSteps; i += 1, n += 1) stepOnce();
    }
    B.realMs += performance.now() - t0;
    save('after-run');
    return B.summary();
  };
  B.summary = () => {
    const sz = window.__sz;
    let mem = null;
    try {
      mem = Math.round(performance.memory.usedJSHeapSize / 1e6);
    } catch (e) {}
    return {
      state: B.state, errors: B.errors, scene: key(), floor: sz ? sz.floor : null, simS: Math.round(B.steps / 60), realS: Math.round(B.realMs / 100) / 10, mem,
      floors: Object.fromEntries(Object.entries(B.floors).map(([f, r]) => [f, { s: r.seconds ?? Math.round((B.simNow - r.start) / 100) / 10, dmg: r.damage, shots: r.shots, ammoGot: r.ammoTaken, hp: `${r.hpStart}->${r.hpEnd ?? '?'}`, n: r.enemies.length, reason: r.reason, deathNear: r.deathNear }])),
    };
  };
})();
