// Dev-only "human-like" playtest bot. Open a page with ?debug&depth=N&cutscenes=0, then:
//   eval(await (await fetch('/tools/playtest-human.js')).text());
//   await __human.boot(); __human.run(40000)
// It steps the game manually (no rendering). Unlike playtest-bot.js it does not know the map or enemy positions:
// it explores by frontier, only reacts to enemies it has had in line of sight for a reaction delay, misses some
// shots, picks up loot it has seen, retreats when hurt and stops when it reaches the open exit.
(() => {
  const DT = 1000 / 60;
  const THINK_EVERY = 6;
  const SIGHT = 9;
  const REACTION_MS = 400;
  const MISS_CHANCE = 0.2;
  const SHOOT_RANGE = 6.2;
  const RETREAT_HP = 0.4;
  const TERMINAL_READ_S = 15;
  const H = (window.__human = {
    flags: { prefill: true, hud: false, dark: false },
    simNow: 0,
    steps: 0,
    state: 'run',
    cur: null,
    rec: null,
    known: new Set(),
    seenAt: new Map(),
    lastSeen: new Map(),
    blacklist: new Set(),
    target: null,
    stuck: { at: 0, x: 0, y: 0 },
    retreatAt: 0,
    rngSeed: 1234567,
    errors: [],
    realMs: 0,
  });
  const game = () => window.__game;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const k = (x, y) => `${x},${y}`;
  const rand = () => {
    H.rngSeed = (H.rngSeed * 1664525 + 1013904223) >>> 0;
    return H.rngSeed / 4294967296;
  };
  const key = () => ['Game', 'Cutscene', 'End', 'Menu', 'Intro'].find((n) => game().scene.isActive(n));

  H.boot = async () => {
    for (let i = 0; i < 400 && !(window.__game && window.__sz); i += 1) {
      await new Promise((r) => setTimeout(r, 50));
      try {
        window.__game.step(performance.now(), 16.7);
      } catch (e) {}
    }
    const stub = () => new Proxy(function () {}, { get: (t, p) => (p === 'connect' ? (x) => x : p === 'disconnect' ? () => {} : p === 'value' ? 0 : stub()), set: () => true, apply: () => stub() });
    for (const name of ['createBufferSource', 'createOscillator', 'createGain', 'createBiquadFilter', 'createStereoPanner', 'createConvolver', 'createDynamicsCompressor', 'createDelay', 'createWaveShaper', 'createAnalyser']) {
      AudioContext.prototype[name] = function () {
        return stub();
      };
    }
    const hud = game().scene.getScene('HudScene');
    if (hud && !H.flags.hud) hud.update = () => {};
    H.simNow = (game().loop.time || performance.now()) + 90000;
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
    H.rec = { floor: f, start: H.simNow, hp0: hp.hp, damage: 0, shots: 0, hits: 0, lastHp: hp.hp, lastAmmo: hp.ammo, retreats: 0, terminals: sz.decor.terminals.length, enemies: sz.combat.roster.length };
    if (H.flags.prefill) for (let i = 0; i < Math.min(f, 10); i += 1) sz.scene.collectSecret(i);
    if (f < 10) sz.scene.collectSecret(f);
    const h = sz.player.getHealth();
    sz.player.heal(h.maxHp);
    H.rec.hp0 = sz.player.getHealth().hp;
    H.rec.lastHp = H.rec.hp0;
    H.rec.lastAmmo = sz.player.getHealth().ammo;
    H.known.clear();
    H.seenAt.clear();
    H.lastSeen.clear();
    H.blacklist.clear();
    H.target = null;
    H.cur = sz;
  }

  function finish(reason) {
    const r = H.rec;
    if (!r || r.reason) return;
    r.reason = reason;
    r.seconds = Math.round((H.simNow - r.start) / 100) / 10;
    r.readS = r.terminals * TERMINAL_READ_S;
    const sz = window.__sz;
    if (sz) r.hpEnd = sz.player.getHealth().hp;
    H.state = reason;
  }

  function updateKnowledge(sz, pos) {
    const level = sz.level, px = Math.round(pos.x), py = Math.round(pos.y);
    for (let y = py - SIGHT; y <= py + SIGHT; y += 1) {
      for (let x = px - SIGHT; x <= px + SIGHT; x += 1) {
        if (!level.isWalkable(x, y) && level.cellAt(x, y) !== 'floor') continue;
        if (Math.hypot(x - px, y - py) > SIGHT) continue;
        if (los(level, pos, { x, y })) H.known.add(k(x, y));
      }
    }
  }

  const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function bfs(level, start, accept, limit = 4000) {
    const seen = new Set([k(start.x, start.y)]);
    const queue = [{ x: start.x, y: start.y, d: 0 }];
    for (let head = 0; head < queue.length && head < limit; head += 1) {
      const c = queue[head];
      if (c.d > 0 && accept(c)) return c;
      for (const [dx, dy] of NEIGHBORS) {
        const x = c.x + dx, y = c.y + dy, id = k(x, y);
        if (seen.has(id) || !level.isWalkable(x, y) || !H.known.has(id)) continue;
        seen.add(id);
        queue.push({ x, y, d: c.d + 1 });
      }
    }
    return null;
  }

  function isFrontier(level, x, y) {
    if (H.blacklist.has(k(x, y))) return false;
    for (const [dx, dy] of NEIGHBORS) {
      if (level.isWalkable(x + dx, y + dy) && !H.known.has(k(x + dx, y + dy))) return true;
    }
    return false;
  }

  function explore(sz, pos) {
    const p = sz.player, level = sz.level;
    const here = { x: Math.round(pos.x), y: Math.round(pos.y) };
    if (H.target && p.hasPath && isFrontier(level, H.target.x, H.target.y)) return;
    const next = bfs(level, here, (c) => isFrontier(level, c.x, c.y));
    if (!next) {
      H.target = null;
      const gate = sz.scene.gate;
      if (gate && gate.state === 'LOCKED') {
        const hunted = sz.combat.roster.filter((d) => !d.isDead).sort((a, b) => dist(here, a.gridPosition) - dist(here, b.gridPosition))[0];
        if (hunted && !p.hasPath) p.setDestination(Math.round(hunted.gridPosition.x), Math.round(hunted.gridPosition.y));
      }
      return;
    }
    H.target = next;
    p.setDestination(next.x, next.y);
  }

  function nearestLoot(sz, pos, kind) {
    let best = null;
    for (const i of sz.loot.pickups) {
      if (i.isCollected || i.kind !== kind || !H.known.has(k(i.gridX, i.gridY))) continue;
      const d = dist(pos, { x: i.gridX, y: i.gridY });
      if (!best || d < best.d) best = { x: i.gridX, y: i.gridY, d };
    }
    return best;
  }

  function retreat(sz, pos, threats) {
    const level = sz.level, p = sz.player;
    if (H.simNow - H.retreatAt < 700) return;
    H.retreatAt = H.simNow;
    H.rec.retreats += 1;
    const here = { x: Math.round(pos.x), y: Math.round(pos.y) };
    let best = null;
    const seen = new Set([k(here.x, here.y)]);
    const queue = [{ ...here, d: 0 }];
    for (let head = 0; head < queue.length; head += 1) {
      const c = queue[head];
      const away = Math.min(...threats.map((t) => dist(c, t.gridPosition)));
      const score = away - c.d * 0.25;
      if (c.d > 0 && (!best || score > best.score)) best = { x: c.x, y: c.y, score };
      if (c.d >= 9) continue;
      for (const [dx, dy] of NEIGHBORS) {
        const x = c.x + dx, y = c.y + dy, id = k(x, y);
        if (seen.has(id) || !level.isWalkable(x, y) || !H.known.has(id)) continue;
        seen.add(id);
        queue.push({ x, y, d: c.d + 1 });
      }
    }
    if (best) p.setDestination(best.x, best.y);
  }

  function think(sz) {
    const sc = sz.scene, p = sz.player, level = sz.level, now = sc.time.now;
    const hp = p.getHealth(), pos = p.gridPosition;
    updateKnowledge(sz, pos);

    const alive = sz.combat.roster.filter((d) => !d.isDead);
    const visible = [];
    for (const d of alive) {
      const dd = dist(pos, d.gridPosition);
      if (dd <= SIGHT && los(level, pos, d.gridPosition)) {
        if (!H.seenAt.has(d)) H.seenAt.set(d, H.simNow);
        H.lastSeen.set(d, H.simNow);
        if (H.simNow - H.seenAt.get(d) >= REACTION_MS) visible.push(d);
      } else if (H.lastSeen.has(d) && H.simNow - H.lastSeen.get(d) > 1500) {
        H.seenAt.delete(d);
      }
    }
    visible.sort((a, b) => dist(pos, a.gridPosition) - dist(pos, b.gridPosition));

    const gate = sc.gate;
    const gateKnown = gate && H.known.has(k(gate.cell.x, gate.cell.y));
    if (gate && gate.state !== 'LOCKED' && gateKnown && dist(pos, gate.cell) <= 1.6) {
      finish('exit');
      return;
    }

    const lowHp = hp.hp <= hp.maxHp * RETREAT_HP;
    if (visible.length > 0) {
      const t = visible[0], d = dist(pos, t.gridPosition);
      const close = visible.filter((v) => dist(pos, v.gridPosition) <= 5).length;
      if (lowHp) {
        const stim = nearestLoot(sz, pos, 'stim');
        if (stim && d > 2.5) {
          p.setDestination(stim.x, stim.y);
          return;
        }
        retreat(sz, pos, visible);
        if (d <= SHOOT_RANGE && hp.ammo > 0 && rand() > MISS_CHANCE) sc.playerCombat.tryAttack(now, t);
        return;
      }
      if (hp.ammo <= 0) {
        const ammo = nearestLoot(sz, pos, 'ammo');
        if (d <= 1.5) {
          p.cancelPath();
          sc.playerCombat.tryAttack(now, t);
        } else if (ammo && ammo.d < d + 6) p.setDestination(ammo.x, ammo.y);
        else retreat(sz, pos, visible);
        return;
      }
      if (close >= 3) {
        retreat(sz, pos, visible);
        if (rand() > MISS_CHANCE) sc.playerCombat.tryAttack(now, t);
        return;
      }
      if (d <= SHOOT_RANGE) {
        p.cancelPath();
        if (rand() > MISS_CHANCE) sc.playerCombat.tryAttack(now, t);
      } else if (!p.hasPath || H.steps % 30 === 0) {
        p.setDestination(Math.round(t.gridPosition.x), Math.round(t.gridPosition.y));
      }
      return;
    }

    if (hp.hp < hp.maxHp * 0.65) {
      const stim = nearestLoot(sz, pos, 'stim');
      if (stim && stim.d < 14) {
        if (!p.hasPath) p.setDestination(stim.x, stim.y);
        return;
      }
    }
    if (hp.ammo <= 3 || hp.ammo < hp.maxAmmo * 0.5) {
      const ammo = nearestLoot(sz, pos, 'ammo');
      if (ammo && ammo.d < 14) {
        if (!p.hasPath) p.setDestination(ammo.x, ammo.y);
        return;
      }
    }
    if (gate && gate.state !== 'LOCKED' && gateKnown) {
      if (!p.hasPath) p.setDestination(gate.cell.x, gate.cell.y);
      return;
    }
    explore(sz, pos);
  }

  function track(sz) {
    const r = H.rec;
    const hp = sz.player.getHealth();
    if (hp.hp < r.lastHp) r.damage += r.lastHp - hp.hp;
    if (hp.ammo < r.lastAmmo) r.shots += r.lastAmmo - hp.ammo;
    r.lastHp = hp.hp;
    r.lastAmmo = hp.ammo;
  }

  function stepOnce() {
    H.simNow += DT;
    game().scene.update(H.simNow, DT);
    H.steps += 1;
    const name = key();
    if (name === 'Cutscene') {
      const cs = game().scene.getScene('Cutscene');
      if (cs && typeof cs.finish === 'function') cs.finish();
      return;
    }
    if (name === 'End') {
      finish('won');
      return;
    }
    if (name !== 'Game') return;
    const sz = window.__sz;
    if (!sz || !sz.player) return;
    if (H.cur !== sz) enterFloor(sz);
    track(sz);
    if (sz.player.isDeadState) {
      finish('dead');
      return;
    }
    if (H.simNow - H.rec.start > 600000) {
      finish('stuck');
      return;
    }
    if (H.steps % THINK_EVERY === 0) {
      const p = sz.player.gridPosition;
      if (H.simNow - H.stuck.at > 6000) {
        if (H.target && Math.hypot(p.x - H.stuck.x, p.y - H.stuck.y) < 0.4 && sz.player.hasPath) {
          H.blacklist.add(k(H.target.x, H.target.y));
          H.target = null;
        }
        H.stuck = { at: H.simNow, x: p.x, y: p.y };
      }
      try {
        think(sz);
      } catch (e) {
        H.errors.push(String(e));
        H.state = 'error';
      }
    }
    if (H.state === 'run' && H.rec.reason) H.state = H.rec.reason;
    if (H.state === 'run' && sz.combat.roster.every((d) => d.isDead) && sz.scene.gate && sz.scene.gate.state === 'LOCKED') H.rec.note = 'cleared-but-locked';
  }

  H.run = (maxRealMs, maxSteps = 1e9) => {
    const t0 = performance.now();
    let n = 0;
    while (performance.now() - t0 < maxRealMs && H.state === 'run' && n < maxSteps) {
      stepOnce();
      n += 1;
    }
    H.realMs += performance.now() - t0;
    return H.summary();
  };

  H.summary = () => {
    const r = H.rec || {};
    return {
      state: H.state,
      errors: H.errors,
      floor: r.floor,
      seconds: r.seconds ?? Math.round((H.simNow - (r.start || H.simNow)) / 100) / 10,
      readEstimateS: r.readS ?? r.terminals * TERMINAL_READ_S,
      damage: r.damage,
      shots: r.shots,
      retreats: r.retreats,
      enemies: r.enemies,
      hp: `${r.hp0}->${r.hpEnd ?? '?'}`,
      reason: r.reason,
      note: r.note,
      knownCells: H.known.size,
    };
  };
})();
