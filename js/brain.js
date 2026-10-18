/* Heroes TT: the bots. Every hero nobody is playing is driven from here (both teams), and so is your own hero
   in the title-screen demo, game.autopilot() and the headless soak.
   A bot decides every few tenths of a second (slower for the zombie bots on Easy) and steers every tick:
   - nap, then walk back out; go home to the fountain when low on health;
   - stand just behind its own minions in its lane, and never under an enemy tower that nobody else is tanking;
   - the roamer takes the critter camps; everyone goes for the Golden Basketball and the Peace Shrine;
   - fight enemy heroes close by, and use abilities when they'd do some good. */
(function () {
  'use strict';
  const HTT = (window.HTT = window.HTT || {});

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function enemyStructs(M, team) {
    return M.units.filter((u) => u.type === 'struct' && u.team !== team && u.alive);
  }
  // is somebody from our team (a minion, critter or champion) standing in this tower's range to take the shots?
  function tanked(M, S, team) {
    for (const u of M.units) if (u.alive && u.type === 'minion' && u.team === team && dist(u, S) < S.range + u.r) return true;
    return false;
  }
  // move a goal point out of the range of untanked enemy buildings
  function safe(M, h, g) {
    const hpF = h.hp / h.maxHp;
    for (const S of enemyStructs(M, h.team)) {
      const R = S.range + 1.2 + h.r;
      const d = dist(g, S);
      if (d >= R) continue;
      if (S.hp / S.maxHp < 0.12 && hpF > 0.6 && !M.coreShielded(S)) continue; // nearly down: go for it
      if (tanked(M, S, h.team) && hpF > 0.35) continue;
      const home = HTT.sim.MAP.spawn[h.team];
      let dx = g.x - S.x, dy = g.y - S.y, l = Math.hypot(dx, dy);
      if (l < 0.5) { dx = home.x - S.x; dy = home.y - S.y; l = Math.hypot(dx, dy); }
      g = { x: S.x + (dx / l) * R, y: S.y + (dy / l) * R };
    }
    return g;
  }

  // where a hero stands in a lane: just behind its team's front minion, or by its own front building
  function laneSpot(M, h, lane) {
    const S = HTT.sim;
    let d = M.front[h.team][lane];
    if (d < 0) {
      d = 4;
      for (const kind of ['tower', 'fort']) {
        const T = M.units.find((u) => u.type === 'struct' && u.team === h.team && u.lane === lane && u.kind === kind && u.alive);
        if (T) { d = S.STRUCTS[kind].d - 3; break; }
      }
    } else d = Math.max(6, d - 2.5);
    const p = S.teamPoint(h.team, lane, d);
    const side = h.slot % 2 ? 1 : -1;
    return { x: p.x - p.dy * side * 1.3, y: p.y + p.dx * side * 1.3 };
  }

  function countFoes(M, h, x, y, r, pick) {
    let n = 0;
    M.near(x, y, r, (v) => { if (M.isFoe(h, v) && (!pick || pick(v))) n++; });
    return n;
  }
  const notStruct = (v) => v.type !== 'struct';

  function tryCasts(M, h, fh, fd) {
    const b = h.brain;
    const keen = M.lv.cast[h.team];
    const hpF = h.hp / h.maxHp;
    const home = HTT.sim.MAP.spawn[h.team];
    const towardHome = () => { const dx = home.x - h.x, dy = home.y - h.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
    const order = [3, 0, 1, 2];
    for (const i of order) {
      if (!M.ready(h, i)) continue;
      if (M.rand() > keen) continue;
      const A = h.def.abil[i];
      let go = false, aim = null;
      switch (A.type) {
        case 'combo': case 'melee':
          go = (fh && fd <= A.range) || (!b.retreat && countFoes(M, h, h.x, h.y, A.range, notStruct) >= 2 && M.rand() < 0.3);
          break;
        case 'shot':
          go = (fh && fd <= A.range * 0.85) || (i < 3 && A.pierce && countFoes(M, h, h.x, h.y, A.range * 0.7, notStruct) >= 3 && M.rand() < 0.3);
          break;
        case 'zap':
          go = (fh && fd <= A.range) || (countFoes(M, h, h.x, h.y, A.range, notStruct) >= 2 && M.rand() < 0.4);
          break;
        case 'dash':
          if (b.retreat) { go = fh && fd < 9; aim = towardHome(); }
          else go = A.dmg > 0 && fh && fd <= A.dist + 1 && fd > 2.5 && (fh.hp / fh.maxHp < 0.6 || hpF > 0.7) && !b.unsafe(fh);
          break;
        case 'leap':
          go = !b.retreat && fh && fd <= A.dist && (fh.hp / fh.maxHp < 0.7 || countFoes(M, h, fh.x, fh.y, A.r, (v) => v.hero) >= 2) && !b.unsafe(fh);
          break;
        case 'nova':
          if (A.heal) {
            let hurtAlly = false;
            M.near(h.x, h.y, A.r, (v) => { if (v.hero && v.team === h.team && v.hp / v.maxHp < 0.7) hurtAlly = true; });
            go = hurtAlly || (fh && fd <= A.r * 0.8);
          } else go = (fh && fd <= A.r * 0.85) || (i < 3 && countFoes(M, h, h.x, h.y, A.r, notStruct) >= 3 && M.rand() < 0.3);
          break;
        case 'shield':
          if (A.self) go = hpF < 0.6 && ((fh && fd < 10) || h.hurtT < 1);
          else M.near(h.x, h.y, A.range, (v) => { if (v.hero && v.team === h.team && v.hp / v.maxHp < 0.55 && v.hurtT < 2) go = true; });
          break;
        case 'teamShield': {
          let low = 0, veryLow = false;
          for (const v of M.heroes) {
            if (v.team !== h.team || v.down || v.hurtT > 2) continue;
            if (v.hp / v.maxHp < 0.5) low++;
            if (v.hp / v.maxHp < 0.3) veryLow = true;
          }
          go = low >= 2 || veryLow;
          break;
        }
        case 'speed':
          go = (b.retreat && fh && fd < 10) || (fh && fh.hp / fh.maxHp < 0.4 && fd > h.def.atk.range + 1 && fd < 10);
          break;
        case 'zone':
          go = (fh && fd <= A.range) || (countFoes(M, h, h.x, h.y, A.range, notStruct) >= 3 && M.rand() < 0.3);
          break;
      }
      if (go && M.cast(h, i, aim)) break; // one at a time
    }
  }

  function decide(M, h) {
    const S = HTT.sim;
    const b = h.brain;
    const hpF = h.hp / h.maxHp;
    const home = S.MAP.spawn[h.team];
    b.unsafe = (p) => {
      for (const T of enemyStructs(M, h.team)) if (dist(p, T) < T.range + 0.5 && !tanked(M, T, h.team)) return true;
      return false;
    };
    h.focus = null;
    b.focus = null;
    // go home when hurt, until nearly full again
    if (hpF < 0.32) b.retreat = true;
    if (b.retreat && hpF > 0.92) b.retreat = false;
    const fh = M.nearestFoe(h, 11, (v) => v.hero);
    const fd = fh ? dist(h, fh) - fh.r : 99;
    if (b.retreat) {
      b.goal = { x: home.x, y: home.y };
      b.stop = 1.5;
      tryCasts(M, h, fh, fd);
      return;
    }
    // where to be
    let goal;
    const O = M.obj;
    if (O.state === 'live' && hpF > 0.45) {
      const a = h.slot * 1.26 + h.team * 0.6;
      goal = { x: O.x + Math.cos(a) * (O.r - 1.8), y: O.y + Math.sin(a) * (O.r - 1.8) };
    } else if (h.lane === 'roam') {
      const camp = M.camps.find((c) => c.state === 'ready' && M.teams[h.team].level >= 3 && hpF > 0.6);
      if (camp) {
        goal = { x: camp.x, y: camp.y };
        const critter = camp.critters.filter((c) => c.alive).sort((p, q) => dist(h, p) - dist(h, q))[0];
        if (critter && dist(h, camp) < 9) { h.focus = critter; b.focus = critter; }
      } else {
        // help whichever lane is losing
        const lane = M.front[h.team].top <= M.front[h.team].bot ? 'top' : 'bot';
        goal = laneSpot(M, h, lane);
      }
    } else goal = laneSpot(M, h, h.lane);

    // fight a hero close by, if it's a fair fight
    if (fh && fd < 9 && (hpF > 0.45 || fh.hp / fh.maxHp < hpF) && !b.unsafe(fh) && dist(fh, goal) < 16) {
      h.focus = fh;
      b.focus = fh;
    } else if (!b.focus) {
      const m = M.nearestFoe(h, 8, (v) => v.type !== 'struct' && !(v.team === 2 && h.lane !== 'roam'));
      if (m && dist(m, goal) < 10) { h.focus = m; b.focus = m; }
    }
    b.goal = goal;
    b.stop = 1.2;
    tryCasts(M, h, fh, fd);
  }

  // every tick: walk toward the goal (or the target), around buildings, and out of untanked tower range
  function steer(M, h) {
    const b = h.brain;
    let g = b.goal;
    let stop = b.stop || 1;
    const f = b.focus;
    if (f && f.alive && !f.down) {
      const range = h.def.atk.range + f.r;
      const d = dist(h, f);
      if (d > range * 0.9) { g = { x: f.x, y: f.y }; stop = range * 0.8; } else g = { x: h.x, y: h.y };
    } else if (f) b.focus = h.focus = null;
    if (!g) { b.input = { mx: 0, my: 0 }; return; }
    if (!b.retreat) g = safe(M, h, g);
    let dx = g.x - h.x, dy = g.y - h.y;
    const l = Math.hypot(dx, dy);
    if (l < stop) { b.input = { mx: 0, my: 0 }; return; }
    dx /= l; dy /= l;
    // slide round buildings in the way
    for (const u of M.units) {
      if (u.type !== 'struct' || !u.alive) continue;
      const ox = u.x - h.x, oy = u.y - h.y, od = Math.hypot(ox, oy);
      if (od > u.r + 3 || od < 0.01) continue;
      const along = (ox * dx + oy * dy) / od;
      if (along < 0.5) continue;
      const side = ox * dy - oy * dx > 0 ? 1 : -1;
      const px = (-oy / od) * side, py = (ox / od) * side;
      dx = dx * 0.4 + px * 0.6; dy = dy * 0.4 + py * 0.6;
      const k = Math.hypot(dx, dy) || 1;
      dx /= k; dy /= k;
    }
    b.input = { mx: dx, my: dy };
  }

  function think(M, h, dt) {
    const b = h.brain;
    if (h.down) { b.input = { mx: 0, my: 0 }; b.goal = null; b.focus = null; return; }
    b.t -= dt;
    if (b.t <= 0) {
      const [lo, hi] = M.lv.think[h.team];
      b.t = lo + M.rand() * (hi - lo);
      decide(M, h);
    }
    steer(M, h);
  }

  HTT.brain = { think, safe, laneSpot };
})();
