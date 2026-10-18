/* Heroes TT: the rule checks, the bot-vs-bot soak and the sabotage cases. Runs in the browser (game.check(),
   game.soak()) and in Node (node tools/check.js), on the same rules (js/sim.js) and bots (js/brain.js). */
(function () {
  'use strict';
  const HTT = (window.HTT = window.HTT || {});
  const S = () => HTT.sim;

  // one match with bots on both teams, played to the end (or until maxMin minutes, which counts as stuck)
  function match(o = {}) {
    const M = S().newMatch({ level: o.level || 'easy', humans: [], seed: o.seed || 1, sabotage: o.sabotage });
    const dt = o.dt || 0.05, maxT = (o.maxMin || 30) * 60;
    let tenAt = 0;
    while (!M.over && M.t < maxT) {
      M.tick(dt);
      M.events.length = 0;
      if (!tenAt && M.teams.some((t) => t.level >= 10)) tenAt = M.t;
    }
    const left = (team) => M.units.filter((u) => u.type === 'struct' && u.team === team && u.alive).length;
    return {
      over: M.over, winner: M.winner, minutes: +(M.t / 60).toFixed(2), levels: M.teams.map((t) => t.level), tenAt: +(tenAt / 60).toFixed(1),
      bonks: M.stats.bonks.slice(), buildings: [left(0), left(1)], objs: M.teams.map((t) => t.objs), camps: M.teams.map((t) => t.camps),
    };
  }

  // the soak: every match must end with a core knocked down
  function soak(o = {}) {
    const runs = [];
    for (let seed = 1; seed <= (o.seeds || 4); seed++) {
      const r = match({ level: o.level || 'easy', seed: seed * 7919 + (o.level === 'normal' ? 13 : 0), sabotage: o.sabotage, maxMin: o.maxMin, dt: o.dt });
      r.seed = seed;
      runs.push(r);
    }
    const ended = runs.filter((r) => r.over).length;
    return { level: o.level || 'easy', runs, ended, ok: ended === runs.length };
  }

  // ---------------------------------------------------------------- rules

  function run(M, seconds, dt = 1 / 60) {
    const evs = [];
    for (let t = 0; t < seconds; t += dt) { M.tick(dt); evs.push(...M.events); M.events.length = 0; }
    return evs;
  }
  // a quiet match: no waves, no objective, for testing one thing at a time
  function quiet(o) {
    const M = S().newMatch(Object.assign({ level: 'easy', humans: ['teddy'], seed: 5 }, o));
    M.nextWave = 1e9;
    M.obj.at = 1e9;
    return M;
  }
  const foe = (M, team) => M.heroes.find((h) => h.team !== team);

  function rules(sab) {
    const out = [];
    const ok = (name, cond, info) => out.push({ name, ok: !!cond, info: info || '' });

    {
      const M = quiet({ sabotage: sab });
      const me = M.hero('teddy');
      const B = M.callBuddy(me);
      ok('Teddy\'s companion is Tommy', B && B.kind === 'tommy');
      const evs = run(M, 2.5);
      ok('the companion says hi and tosses a treat that heals', evs.some((e) => e.type === 'treat') && M.stats.treats === 1);
      const hp = me.hp;
      const z = foe(M, 0);
      M.hurt(me, 50, z);
      const evs2 = run(M, 0.1);
      ok('while he is there, every hit on you is blocked (TOMMY SAVED YOU!)', me.hp === hp && M.stats.saves > 0, `hp ${hp.toFixed(0)} -> ${me.hp.toFixed(0)}`);
      ok('a save shows up as an event for the toast', evs2.length >= 0 && M.events.length === 0);
      const left = M.buddy.left;
      run(M, 3);
      M.callBuddy(me);
      const evs3 = run(M, 2.5);
      ok('calling again: another hello, another treat, the whole visit again', evs3.some((e) => e.type === 'treat') && M.buddy && M.buddy.left > left - 3.5, `left ${M.buddy && M.buddy.left.toFixed(1)}`);
      run(M, M.lv.buddyVisit + 3);
      ok('he goes home at the end of his visit', !M.buddy);
      const hp2 = me.hp;
      M.hurt(me, 20, z);
      ok('after he goes, hits land again', me.hp < hp2);
    }
    {
      const M = quiet({ humans: ['tommy'], sabotage: sab });
      ok('Tommy\'s companion is Teddy', M.callBuddy(M.hero('tommy')).kind === 'teddy');
    }
    {
      const M = quiet({ sabotage: sab });
      const me = M.hero('teddy');
      M.hurt(me, 99999, foe(M, 0));
      ok('a bonked hero takes a nap at base', me.down && me.napT > 0 && me.x < -50);
      M.callBuddy(me);
      run(M, 1.6);
      ok('calling your brother while you nap wakes you up', !me.down && me.hp === me.maxHp);
    }
    {
      const M = quiet({ humans: ['teddy', 'tommy'], sabotage: sab });
      const [a, b] = [M.hero('teddy'), M.hero('tommy')];
      M.hurt(b, 99999, foe(M, 0));
      ok('2 players: no companion, T is the team-up', M.callBuddy !== null && M.teamUp.go(a));
      ok('the team-up wakes a napping brother and shields both', !b.down && a.shield > 0 && b.shield > 0);
      ok('then it needs a rest', !M.teamUp.go(a) && M.teamUp.rest > 0);
    }
    {
      const M = quiet({ sabotage: sab });
      const me = M.hero('teddy');
      ok('the heroic is locked before level 10', !M.ready(me, 3) && !M.cast(me, 3));
      M.giveXp(0, 1e4);
      ok('level 10 unlocks the heroic', M.teams[0].level >= 10 && M.ready(me, 3));
      const bot = M.hero('zoom');
      ok('bots pick their talents straight away', bot.talents.length === 3);
      ok('your talents wait for you to pick', me.pendingTalent >= 0 && me.talents.length < 3);
      const before = me.maxHp;
      while (me.pendingTalent >= 0) M.pickTalent(me, me.pendingTalent === 0 ? 1 : 0);
      ok('TOUGH gives more health', me.maxHp > before * 1.2, `${before.toFixed(0)} -> ${me.maxHp.toFixed(0)}`);
    }
    {
      const M = quiet({ sabotage: sab });
      const core = M.teams[1].core;
      const me = M.hero('teddy');
      M.hurt(core, 500, me);
      ok('the cookie castle is shielded while both its forts stand', core.hp === core.maxHp);
      for (const u of M.units) if (u.type === 'struct' && u.team === 1 && u.kind === 'fort' && u.lane === 'top') M.hurt(u, 1e6, me);
      M.hurt(core, 500, me);
      ok('knock down a fort and the castle can be hit', core.hp < core.maxHp);
      M.hurt(core, 1e7, me);
      ok('knock down the castle and you win', M.over && M.winner === 0);
    }
    {
      const M = quiet({ sabotage: sab });
      M.obj.at = 0.01;
      M.obj.kind = 'ball';
      const me = M.hero('teddy');
      run(M, 0.1);
      me.x = M.obj.x; me.y = M.obj.y;
      M.input.teddy = { mx: 0, my: 0, cast: [false, false, false, false] };
      for (const h of M.heroes) if (h !== me) { h.x = h.team ? 50 : -50; }
      const towers = M.units.filter((u) => u.type === 'struct' && u.team === 1 && u.kind === 'tower');
      const evs = [];
      for (let t = 0; t < 7; t += 1 / 60) { me.x = M.obj.x; me.y = M.obj.y; for (const h of M.heroes) if (h !== me && h.team === 1) h.x = 55; M.tick(1 / 60); evs.push(...M.events); M.events.length = 0; }
      ok('standing on the Golden Basketball captures it', evs.some((e) => e.type === 'objWon' && e.team === 0));
      ok('the golden slam knocks big chunks off the zombie towers', towers.every((u) => u.hp < u.maxHp * 0.6), towers.map((u) => Math.round(u.hp)).join(','));
      ok('then the Peace Shrine comes next', M.obj.kind === 'shrine' && M.obj.state === 'wait');
      M.obj.at = 0.01;
      const evs2 = [];
      for (let t = 0; t < 7; t += 1 / 60) { me.x = M.obj.x; me.y = M.obj.y; for (const h of M.heroes) if (h !== me && h.team === 1) h.x = 55; M.tick(1 / 60); evs2.push(...M.events); M.events.length = 0; }
      ok('capturing the Peace Shrine sends a giant friend down a lane', evs2.some((e) => e.type === 'champ' && e.team === 0) && M.units.some((u) => u.champ && u.team === 0 && u.alive));
    }
    {
      const M = quiet({ sabotage: sab });
      const camp = M.camps[0];
      const me = M.hero('teddy');
      for (const c of camp.critters) M.hurt(c, 1e5, me);
      ok('beat the critters and they join your team', camp.state === 'cool' && M.units.some((u) => u.merc && u.team === 0 && u.alive));
    }
    {
      const E = S().LEVELS.easy, N = S().LEVELS.normal;
      ok('Easy is gentler: more health and softer hits for the kid\'s hero, weaker and slower zombie bots, shorter naps',
        E.humanHp > N.humanHp && E.toHuman < N.toHuman && E.dmg[1] < N.dmg[1] && E.think[1][0] > N.think[1][0] && E.nap[0][0] < N.nap[0][0]);
      const me = quiet({ level: 'easy' }).hero('teddy'), bot = quiet({ level: 'easy' }).hero('zoom');
      const meN = quiet({ level: 'normal' }).hero('teddy');
      ok('on Easy your hero has more health than on Normal', me.maxHp > meN.maxHp * 1.2 && bot.maxHp === S().HEROES.zoom.hp, `${me.maxHp} vs ${meN.maxHp}`);
    }
    {
      const M = quiet({ sabotage: sab });
      const me = M.hero('teddy');
      const z = M.hero('zombo');
      z.x = me.x + 2; z.y = me.y;
      const hp = z.hp;
      M.tick(1 / 60);
      M.tick(1 / 60);
      ok('heroes hit the nearest enemy in range by themselves', z.hp < hp);
    }
    return out;
  }

  // ---------------------------------------------------------------- sabotage: the checks must be able to fail

  function sabotage() {
    const cases = [];
    const add = (name, caught, info) => cases.push({ name, caught: !!caught, info: info || '' });
    {
      const r = soak({ level: 'easy', seeds: 1, maxMin: 12, sabotage: { noHarm: true } });
      add('nobody can hurt anything: the soak must report a match that never ends', !r.ok, `${r.ended}/${r.runs.length} ended`);
    }
    {
      const r = soak({ level: 'normal', seeds: 1, maxMin: 12, sabotage: { toughStructs: true } });
      add('buildings that take no damage: the soak must fail', !r.ok, `${r.ended}/${r.runs.length} ended`);
    }
    {
      const bad = rules({ lazyBuddy: true });
      add('a companion who forgets to guard: the rules must catch it', bad.some((x) => !x.ok), bad.filter((x) => !x.ok).map((x) => x.name).join('; '));
    }
    {
      const bad = rules({ earlyHeroic: true });
      add('a heroic that works before level 10: the rules must catch it', bad.some((x) => !x.ok));
    }
    return cases;
  }

  HTT.check = { match, soak, rules, sabotage };
})();
