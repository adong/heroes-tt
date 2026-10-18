/* Heroes TT: the rules. No Three.js in here, so the browser game (js/game.js) and the headless check
   (tools/check.js) run exactly the same code.
   The map: x runs from Team Teddy & Tommy's base (left, x < 0) to the Zombie & Robot base (right, x > 0),
   y runs from the top of the map to the bottom (world z in js/art.js). Distances are metres, times seconds.
   Team 0 is the brothers' team, team 1 the zombies and robots, team 2 the friendly critters in the camps.
   Everything the screen needs to show (pops, bonks, saves, level ups...) goes out as events in M.events. */
(function () {
  'use strict';
  const HTT = (window.HTT = window.HTT || {});

  // ---------------------------------------------------------------- the numbers (change these to tune)

  // 🐣 Easy is for Tommy (5): the brothers' team is tougher, the zombie bots are slow and forgiving.
  // 🔥 Normal is for Teddy (8): both teams the same.
  const LEVELS = {
    easy: {
      hp: [1, 1], // hero health, [brothers' team, zombie team]
      humanHp: 1.4, // the hero a kid is playing gets more health...
      toHuman: 0.7, // ...and everything hits him softer
      dmg: [1, 0.9], // hero damage
      speed: [1, 1],
      think: [[0.25, 0.4], [0.35, 0.65]], // how long each team's bots take to react (s)
      aim: [0, 0.6], // how far off the bots' skill shots land (m)
      cast: [1, 0.85], // how keen the bots are to use their abilities
      nap: [[3, 0.35], [5, 0.6]], // nap after a bonk: base + per level (s)
      struct: [1.2, 1.5], // tower, fort and core health
      buddyVisit: 12, teamUpRest: 12, regen: [0.025, 0.012],
    },
    normal: {
      hp: [1, 1], humanHp: 1, toHuman: 1, dmg: [1, 1], speed: [1, 1], think: [[0.25, 0.4], [0.25, 0.4]], aim: [0, 0], cast: [1, 1],
      nap: [[5, 0.7], [5, 0.7]], struct: [0.75, 0.75],
      buddyVisit: 10, teamUpRest: 20, regen: [0.012, 0.012],
    },
  };

  const MAP = {
    W: 128, H: 64, // x -64..64, y -32..32
    spawn: [{ x: -57, y: 0 }, { x: 57, y: 0 }], // where heroes nap and wake up: next to the fountain behind the core
    fountainR: 7,
    lanes: {
      top: [[-49, 0], [-45, -12], [-35, -20], [0, -22], [35, -20], [45, -12], [49, 0]],
      bot: [[-49, 0], [-45, 12], [-35, 20], [0, 22], [35, 20], [45, 12], [49, 0]],
    },
    camps: [
      { id: 'bears', kind: 'cub', x: 0, y: -9, lane: 'top', n: 3, name: 'BEAR CUBS' },
      { id: 'dogs', kind: 'dog', x: 0, y: 9, lane: 'bot', n: 3, name: 'ROBOT DOGS' },
    ],
    obj: { x: 0, y: 0, r: 4.5 },
  };
  const LANES = ['top', 'bot'];

  // Towers and forts stand beside each lane (d = metres along the lane from the team's own core).
  const STRUCTS = {
    tower: { hp: 1000, dmg: 30, rate: 1.0, range: 8, r: 1.4, d: 40, xp: 120 },
    fort: { hp: 1800, dmg: 38, rate: 1.0, range: 8.5, r: 2.2, d: 22, xp: 220 },
    core: { hp: 3200, dmg: 45, rate: 1.0, range: 9.5, r: 3.4, d: 0, xp: 0 },
  };

  // Minions march every WAVE seconds. They get a little stronger every minute, so every match ends.
  const WAVE = { every: 30, first: 5, perMin: 0.06, cannonEvery: 3 };
  const MINIONS = {
    melee: { hp: 100, dmg: 9, rate: 1.0, range: 1.5, speed: 3.8, r: 0.55, xp: 10 },
    ranged: { hp: 70, dmg: 12, rate: 1.2, range: 5.5, speed: 3.8, r: 0.5, xp: 14 },
    cannon: { hp: 170, dmg: 26, rate: 2.0, range: 8.6, speed: 3.2, r: 0.8, xp: 24, structMul: 1.5 },
    cub: { hp: 260, dmg: 14, rate: 1.1, range: 1.9, speed: 4.2, r: 0.8, xp: 15 },
    dog: { hp: 200, dmg: 13, rate: 1.0, range: 5, speed: 4.2, r: 0.7, xp: 15 },
    champ: { hp: 2200, dmg: 40, rate: 1.4, range: 3, speed: 3.0, r: 1.7, xp: 150, structMul: 2.2 },
  };
  const CAMP_RESPAWN = 75;
  const OBJ = { first: 90, every: 120, capture: 5, kinds: ['ball', 'shrine'] };

  // XP is shared by the whole team. Talent picks at 4, 7 and 10; the heroic unlocks at 10.
  const XP = { trickle: 2, need: (L) => 130 + 32 * (L - 1), maxLevel: 20, near: 14, heroBonk: (L) => 30 + 6 * L };
  const TALENT_LEVELS = [4, 7, 10];
  const TALENTS = [
    [{ id: 'strong', emoji: '💪', name: 'STRONG', tip: 'hit 25% harder' }, { id: 'tough', emoji: '❤️', name: 'TOUGH', tip: '25% more health' }],
    [{ id: 'quick', emoji: '⚡', name: 'QUICK', tip: 'abilities come back faster' }, { id: 'speedy', emoji: '👟', name: 'SPEEDY', tip: 'run faster' }],
    [{ id: 'munch', emoji: '🍪', name: 'COOKIE MUNCH', tip: 'heal when you bonk someone' }, { id: 'armor', emoji: '🛡️', name: 'SUPER ARMOR', tip: 'get hurt less' }],
  ];

  // The brothers' team and the silly Zombie & Robot team. Each hero: 3 abilities (F G H / J K L) and a heroic (R / I).
  // Ability types: combo, melee, shot, dash, leap, nova, shield, teamShield, speed, zone, zap (see cast() below).
  const HEROES = {
    teddy: {
      name: 'TEDDY', role: 'bruiser', team: 0, lane: 'top', hp: 250, speed: 6.6,
      atk: { range: 2.3, dmg: 18, rate: 0.7 },
      abil: [
        { name: 'JAB + STRAIGHT', emoji: '🥊', type: 'combo', cd: 5, range: 3.2, dmg: 36, knock: 3 },
        { name: 'JUMP SHOT', emoji: '🏀', type: 'shot', cd: 6, range: 14, speed: 20, dmg: 42, r: 0.9, pose: 'jumpshot' },
        { name: 'DASH', emoji: '💨', type: 'dash', cd: 9, dist: 8, dmg: 24 },
        { name: 'SLAM DUNK', emoji: '🏀', type: 'leap', cd: 45, dist: 10, r: 5, dmg: 95, stun: 1.2, pose: 'jumpshot' },
      ],
    },
    tommy: {
      name: 'TOMMY', role: 'support', team: 0, lane: 'top', hp: 190, speed: 6.4,
      atk: { range: 6.5, dmg: 12, rate: 0.8, emoji: '✌️' },
      abil: [
        { name: 'PEACE WAVE', emoji: '✌️', type: 'nova', cd: 7, r: 6, heal: 45, dmg: 14, push: 3.5, pose: 'peace' },
        { name: 'HUG SHIELD', emoji: '🛡️', type: 'shield', cd: 8, range: 9, shield: 75, t: 4 },
        { name: 'SLEEPY BUBBLES', emoji: '🫧', type: 'zone', cd: 9, range: 9, r: 4, slow: 0.45, dps: 6, t: 3 },
        { name: 'BIG Y', emoji: '🙌', type: 'teamShield', cd: 55, shield: 110, heal: 30, t: 5, pose: 'peace' },
      ],
    },
    zoom: {
      name: 'ZOOM', role: 'speedy', team: 0, lane: 'roam', hp: 190, speed: 7.6,
      atk: { range: 2.2, dmg: 15, rate: 0.55 },
      abil: [
        { name: 'ZIP KICK', emoji: '👟', type: 'melee', cd: 4, range: 2.9, dmg: 32 },
        { name: 'ZOOM!', emoji: '⚡', type: 'speed', cd: 10, t: 3, amount: 0.6 },
        { name: 'SKATE DASH', emoji: '🛹', type: 'dash', cd: 8, dist: 9, dmg: 22 },
        { name: 'TORNADO', emoji: '🌪️', type: 'nova', cd: 45, r: 6.5, dmg: 85, push: 4.5 },
      ],
    },
    luna: {
      name: 'LUNA', role: 'shooter', team: 0, lane: 'bot', hp: 175, speed: 6.4,
      atk: { range: 6.8, dmg: 14, rate: 0.85, emoji: '🌙' },
      abil: [
        { name: 'MOON BOOMERANG', emoji: '🌙', type: 'shot', cd: 5, range: 12, speed: 16, dmg: 30, r: 1.0, pierce: true, returns: true },
        { name: 'STAR SHOWER', emoji: '🌠', type: 'zone', cd: 8, range: 10, r: 3.5, dps: 24, t: 2 },
        { name: 'MOON HOP', emoji: '🐇', type: 'dash', cd: 10, dist: 7, dmg: 0 },
        { name: 'FULL MOON', emoji: '🌕', type: 'shot', cd: 45, range: 18, speed: 14, dmg: 90, r: 2.2, pierce: true },
      ],
    },
    bruno: {
      name: 'BRUNO', role: 'tank', team: 0, lane: 'bot', hp: 330, speed: 6.0,
      atk: { range: 2.4, dmg: 16, rate: 0.9 },
      abil: [
        { name: 'BEAR SWIPE', emoji: '🐾', type: 'melee', cd: 5, range: 3.1, dmg: 28, slow: 0.35 },
        { name: 'BIG ROAR', emoji: '📣', type: 'nova', cd: 10, r: 5, dmg: 16, stun: 0.8 },
        { name: 'HONEY ARMOR', emoji: '🍯', type: 'shield', cd: 12, self: true, shield: 100, t: 4 },
        { name: 'BELLY FLOP', emoji: '💥', type: 'leap', cd: 50, dist: 9, r: 5.5, dmg: 80, stun: 1.4 },
      ],
    },
    zombo: {
      name: 'ZOMBO', role: 'bruiser', team: 1, lane: 'top', hp: 250, speed: 6.6,
      atk: { range: 2.3, dmg: 18, rate: 0.7 },
      abil: [
        { name: 'ZOMBIE SWIPES', emoji: '🧟', type: 'combo', cd: 5, range: 3.2, dmg: 36, knock: 3 },
        { name: 'GOO BALL', emoji: '🟢', type: 'shot', cd: 6, range: 14, speed: 20, dmg: 42, r: 0.9 },
        { name: 'SHAMBLE RUSH', emoji: '💨', type: 'dash', cd: 9, dist: 8, dmg: 24 },
        { name: 'BIG BELLY BOUNCE', emoji: '💥', type: 'leap', cd: 45, dist: 10, r: 5, dmg: 95, stun: 1.2 },
      ],
    },
    gooey: {
      name: 'GOOEY', role: 'support', team: 1, lane: 'top', hp: 190, speed: 6.4,
      atk: { range: 6.5, dmg: 12, rate: 0.8, emoji: '🟢' },
      abil: [
        { name: 'GOO SPLASH', emoji: '💚', type: 'nova', cd: 7, r: 6, heal: 45, dmg: 14, push: 3.5 },
        { name: 'SLIME SHIELD', emoji: '🛡️', type: 'shield', cd: 8, range: 9, shield: 75, t: 4 },
        { name: 'STICKY PUDDLE', emoji: '🟩', type: 'zone', cd: 9, range: 9, r: 4, slow: 0.45, dps: 6, t: 3 },
        { name: 'GOO FORT', emoji: '🏰', type: 'teamShield', cd: 55, shield: 110, heal: 30, t: 5 },
      ],
    },
    zippy: {
      name: 'ZIPPY', role: 'speedy', team: 1, lane: 'roam', hp: 190, speed: 7.6,
      atk: { range: 2.2, dmg: 15, rate: 0.55 },
      abil: [
        { name: 'ZIPPY SLAP', emoji: '✋', type: 'melee', cd: 4, range: 2.9, dmg: 32 },
        { name: 'ZIP!', emoji: '⚡', type: 'speed', cd: 10, t: 3, amount: 0.6 },
        { name: 'ROLLER RUSH', emoji: '🛼', type: 'dash', cd: 8, dist: 9, dmg: 22 },
        { name: 'ZOMBIE DANCE', emoji: '🕺', type: 'nova', cd: 45, r: 6.5, dmg: 85, push: 4.5 },
      ],
    },
    bolt: {
      name: 'BOLT', role: 'shooter', team: 1, lane: 'bot', hp: 175, speed: 6.4,
      atk: { range: 6.8, dmg: 14, rate: 0.85, emoji: '⚡' },
      abil: [
        { name: 'ZAP!', emoji: '⚡', type: 'zap', cd: 5, range: 9, dmg: 45, chain: 2 },
        { name: 'STATIC FIELD', emoji: '🌩️', type: 'zone', cd: 8, range: 10, r: 3.5, dps: 24, t: 2 },
        { name: 'ROCKET BOOTS', emoji: '🚀', type: 'dash', cd: 10, dist: 7, dmg: 0 },
        { name: 'ROBO BEAM', emoji: '🔆', type: 'shot', cd: 45, range: 18, speed: 16, dmg: 90, r: 2.2, pierce: true },
      ],
    },
    clank: {
      name: 'CLANK', role: 'tank', team: 1, lane: 'bot', hp: 330, speed: 6.0,
      atk: { range: 2.4, dmg: 16, rate: 0.9 },
      abil: [
        { name: 'CLANK PUNCH', emoji: '🤖', type: 'melee', cd: 5, range: 3.1, dmg: 28, slow: 0.35 },
        { name: 'BONK WAVE', emoji: '📣', type: 'nova', cd: 10, r: 5, dmg: 16, stun: 0.8 },
        { name: 'TIN ARMOR', emoji: '🥫', type: 'shield', cd: 12, self: true, shield: 100, t: 4 },
        { name: 'GROUND POUND', emoji: '💥', type: 'leap', cd: 50, dist: 9, r: 5.5, dmg: 80, stun: 1.4 },
      ],
    },
  };
  const TEAMS = [['teddy', 'tommy', 'zoom', 'luna', 'bruno'], ['zombo', 'gooey', 'zippy', 'bolt', 'clank']];

  // The other brother, called with T (1 player): stays a while, brings a treat, and blocks every hit on you.
  const BUDDY = {
    inT: 0.6, helloT: 1.5, outT: 1.0, treatAt: 0.7, treatHeal: 0.25,
    teddy: { every: 0.8, range: 3.4, dmg: 20 }, // jab, straight
    tommy: { every: 2.2, range: 5, dmg: 10, push: 2.5 }, // little ✌️ waves
  };
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];
  const TEAMUP = { shield: 90, heal: 0.3, t: 5, r: 7, dmg: 60, push: 3.5, together: 8 };

  // ---------------------------------------------------------------- small helpers

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // lanes as polylines with distances along them (team 0's way round: from its core to the zombies' core)
  const LANE = {};
  for (const id of LANES) {
    const pts = MAP.lanes[id].map(([x, y]) => ({ x, y }));
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + dist(pts[i - 1], pts[i]));
    LANE[id] = { id, pts, acc, len: acc[acc.length - 1] };
  }
  function lanePoint(id, d) {
    const L = LANE[id];
    d = clamp(d, 0, L.len);
    let i = 1;
    while (i < L.pts.length - 1 && L.acc[i] < d) i++;
    const a = L.pts[i - 1], b = L.pts[i], k = (d - L.acc[i - 1]) / (L.acc[i] - L.acc[i - 1] || 1);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: (b.x - a.x) / (L.acc[i] - L.acc[i - 1]), dy: (b.y - a.y) / (L.acc[i] - L.acc[i - 1]) };
  }
  // distance along a lane of the point nearest to (x, y), team 0's way round
  function laneProj(id, x, y) {
    const L = LANE[id];
    let best = 1e9, bd = 0;
    for (let i = 1; i < L.pts.length; i++) {
      const a = L.pts[i - 1], b = L.pts[i];
      const ex = b.x - a.x, ey = b.y - a.y, len2 = ex * ex + ey * ey;
      const k = clamp(((x - a.x) * ex + (y - a.y) * ey) / len2, 0, 1);
      const px = a.x + ex * k, py = a.y + ey * k, dd = (px - x) ** 2 + (py - y) ** 2;
      if (dd < best) { best = dd; bd = L.acc[i - 1] + k * Math.sqrt(len2); }
    }
    return bd;
  }
  // a lane distance seen from a team's side (each team measures from its own core)
  const teamD = (team, id, d) => (team === 0 ? d : LANE[id].len - d);
  const teamPoint = (team, id, d) => lanePoint(id, teamD(team, id, d));

  // ---------------------------------------------------------------- a match

  // o: { level: 'easy' | 'normal', humans: ['teddy'] | ['tommy'] | ['teddy', 'tommy'] | [], seed, sabotage: {...} }
  function newMatch(o = {}) {
    const lv = LEVELS[o.level] || LEVELS.easy;
    const rand = rng(o.seed || 1);
    const sab = o.sabotage || {};
    const M = {
      level: o.level === 'normal' ? 'normal' : 'easy', lv, rand, t: 0, over: false, winner: -1,
      units: [], shots: [], zones: [], drops: [], events: [], later: [],
      teams: [0, 1].map((i) => ({ i, xp: 0, level: 1, bonks: 0, camps: 0, objs: 0 })),
      heroes: [], humans: (o.humans || []).slice(), input: {}, waveN: 0, nextWave: WAVE.first,
      camps: [], obj: { state: 'wait', kind: OBJ.kinds[0], n: 0, at: OBJ.first, prog: [0, 0], x: MAP.obj.x, y: MAP.obj.y, r: MAP.obj.r },
      buddy: null, teamUp: { rest: 0 }, front: [{}, {}], sab, nextId: 1, stats: { pops: [0, 0], bonks: [0, 0], saves: 0, treats: 0 },
    };
    const ev = (type, o2) => M.events.push(Object.assign({ type, t: M.t }, o2));
    M.ev = ev;
    const add = (u) => { u.id = M.nextId++; u.alive = true; u.slowT = 0; u.slow = 0; u.stunT = 0; u.shield = 0; u.shieldT = 0; u.pushX = 0; u.pushY = 0; u.hurtT = 99; u.atkT = 0; u.vx = 0; u.vy = 0; u.face = u.team === 1 ? Math.PI : 0; M.units.push(u); return u; };

    // structures
    for (const team of [0, 1]) {
      for (const lane of LANES) {
        for (const kind of ['tower', 'fort']) {
          const S = STRUCTS[kind];
          const p = teamPoint(team, lane, S.d);
          const out = lane === 'top' ? -1 : 1; // stand on the outside of the lane
          add({ type: 'struct', kind, team, lane, x: p.x, y: p.y + out * 3, r: S.r, hp: S.hp * lv.struct[team], maxHp: S.hp * lv.struct[team], range: S.range, dmg: S.dmg, rate: S.rate, xp: S.xp, dmgMul: 1 });
        }
      }
      const c = teamPoint(team, 'top', 0), S = STRUCTS.core;
      M.teams[team].core = add({ type: 'struct', kind: 'core', team, lane: null, x: c.x, y: c.y, r: S.r, hp: S.hp * lv.struct[team], maxHp: S.hp * lv.struct[team], range: S.range, dmg: S.dmg, rate: S.rate, xp: 0, dmgMul: 1 });
    }
    if (sab.noCore) for (const t of M.teams) t.core.hp = t.core.maxHp = 1e9;

    // heroes
    for (const team of [0, 1]) {
      TEAMS[team].forEach((kind, i) => {
        const H = HEROES[kind];
        const sp = MAP.spawn[team];
        const h = add({
          type: 'hero', hero: true, kind, name: H.name, team, def: H, x: sp.x + (team ? -1 : 1) * 2, y: sp.y + (i - 2) * 2, r: 0.7,
          human: M.humans.includes(kind), lane: H.lane, slot: i, cds: [0, 0, 0, 0], talents: [], talentQ: [], pendingTalent: -1, talentWait: 0,
          down: false, napT: 0, napLen: 0, hasteT: 0, haste: 0, dash: null, leap: null, act: null, actT: 0, bonks: 0, retreat: false,
          brain: { t: rand() * 0.3, goal: null, focus: null },
        });
        h.baseHp = H.hp * lv.hp[team] * (h.human ? lv.humanHp : 1);
        h.maxHp = h.hp = h.baseHp;
        h.dmgMul = lv.dmg[team];
        h.range = H.atk.range;
        M.heroes.push(h);
        M.input[kind] = { mx: 0, my: 0, cast: [false, false, false, false] };
      });
    }
    for (const c of MAP.camps) M.camps.push({ def: c, id: c.id, x: c.x, y: c.y, state: 'ready', t: 0, owner: -1, critters: [] });
    for (const c of M.camps) spawnCamp(c);

    // ---------------------------------------------------------------- spatial grid (for "who's near")

    const CELL = 6, GX = Math.ceil(MAP.W / CELL) + 2, GY = Math.ceil(MAP.H / CELL) + 2;
    const grid = new Array(GX * GY);
    for (let i = 0; i < grid.length; i++) grid[i] = [];
    const cellOf = (x, y) => clamp(Math.floor((x + MAP.W / 2) / CELL) + 1, 0, GX - 1) + clamp(Math.floor((y + MAP.H / 2) / CELL) + 1, 0, GY - 1) * GX;
    function rebuildGrid() {
      for (const c of grid) c.length = 0;
      for (const u of M.units) if (u.alive && !u.down) grid[cellOf(u.x, u.y)].push(u);
    }
    // calls fn(u, d) for every unit within r of (x, y) (r measured to the unit's edge)
    function near(x, y, r, fn) {
      const x0 = clamp(Math.floor((x - r - 4 + MAP.W / 2) / CELL) + 1, 0, GX - 1), x1 = clamp(Math.floor((x + r + 4 + MAP.W / 2) / CELL) + 1, 0, GX - 1);
      const y0 = clamp(Math.floor((y - r - 4 + MAP.H / 2) / CELL) + 1, 0, GY - 1), y1 = clamp(Math.floor((y + r + 4 + MAP.H / 2) / CELL) + 1, 0, GY - 1);
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          for (const u of grid[gx + gy * GX]) {
            if (!u.alive || u.down) continue;
            const d = Math.hypot(u.x - x, u.y - y) - u.r;
            if (d <= r) fn(u, d);
          }
        }
      }
    }
    const isFoe = (a, b) => a.team !== b.team && b.alive && !b.down && !(b.team === 2 && a.type === 'minion');
    function nearestFoe(u, r, pick) {
      let best = null, bd = 1e9;
      near(u.x, u.y, r, (v, d) => {
        if (!isFoe(u, v) || (pick && !pick(v))) return;
        if (v.team === 2 && v.camp && v.camp.state !== 'ready') return;
        if (d < bd) { bd = d; best = v; }
      });
      return best;
    }
    M.near = near;
    M.nearestFoe = nearestFoe;
    M.isFoe = isFoe;

    // ---------------------------------------------------------------- damage, healing, bonks

    // the cookie castle has a bubble shield while both of its forts are standing
    const coreShielded = (S) => S.kind === 'core' && M.units.filter((u) => u.type === 'struct' && u.kind === 'fort' && u.team === S.team && u.alive).length >= 2;
    M.coreShielded = coreShielded;
    let lastSaveEv = -9, lastShieldEv = -9;

    function hurt(t, amt, src, how) {
      if (!t.alive || t.down || amt <= 0 || M.over || sab.noHarm) return 0;
      if (t.leap) return 0; // in the air
      if (t.type === 'struct') {
        if (coreShielded(t)) {
          if (src && src.hero && M.t - lastShieldEv > 2) { lastShieldEv = M.t; ev('coreShield', { team: t.team, x: t.x, y: t.y }); }
          return 0;
        }
        if (src && src.hero) amt *= 0.6; // minions do most of the knocking down
        if (src && src.def && src.def.structMul) amt *= src.def.structMul;
        if (sab.toughStructs) amt = 0;
      }
      if (t.hero && M.buddy && M.buddy.host === t && M.buddy.phase !== 'out' && !sab.lazyBuddy) {
        if (M.t - (M.buddy.savedAt || -9) > 0.5) { M.buddy.saves++; M.stats.saves++; M.buddy.savedAt = M.t; } // count hits, not damage ticks
        if (M.t - lastSaveEv > 1.4) { lastSaveEv = M.t; ev('saved', { id: t.id, kind: M.buddy.kind, x: t.x, y: t.y }); }
        return 0;
      }
      amt *= src && src.dmgMul ? src.dmgMul : 1;
      if (t.hero && t.talents.includes('armor')) amt *= 0.8;
      if (t.human) amt *= lv.toHuman;
      if (t.shield > 0) {
        const a = Math.min(t.shield, amt);
        t.shield -= a;
        amt -= a;
        if (a > 0 && t.hero) ev('block', { id: t.id });
      }
      if (amt <= 0) return 0;
      t.hp -= amt;
      t.hurtT = 0;
      if (src) t.lastBy = src;
      if (t.camp && src && t.team === 2) { t.aggro = src; t.camp.fightT = 4; }
      if (t.hp <= 0) kill(t, src);
      return amt;
    }
    function heal(t, amt) {
      if (!t.alive || t.down) return;
      const before = t.hp;
      t.hp = Math.min(t.maxHp, t.hp + amt);
      if (t.hp - before > 2 && t.hero) ev('heal', { id: t.id, n: Math.round(t.hp - before) });
    }
    M.hurt = hurt;
    M.heal = heal;

    function giveXp(team, n) {
      if (team !== 0 && team !== 1 || M.over) return;
      const T = M.teams[team];
      if (T.level >= XP.maxLevel) return;
      T.xp += n;
      while (T.level < XP.maxLevel && T.xp >= XP.need(T.level)) {
        T.xp -= XP.need(T.level);
        T.level++;
        for (const h of M.heroes) if (h.team === team) levelUp(h, T.level);
        ev('level', { team, level: T.level });
      }
    }
    M.giveXp = giveXp;
    function heroStats(h) {
      const L = M.teams[h.team].level;
      const scale = 1 + 0.045 * (L - 1);
      const frac = h.maxHp ? h.hp / h.maxHp : 1;
      h.maxHp = h.baseHp * scale * (h.talents.includes('tough') ? 1.25 : 1);
      h.hp = h.down ? h.maxHp : frac * h.maxHp;
      h.dmgMul = lv.dmg[h.team] * scale * (h.talents.includes('strong') ? 1.25 : 1) * (sab.weakHeroes ? 0 : 1);
    }
    M.heroStats = heroStats;
    function levelUp(h, L) {
      heroStats(h);
      const tier = TALENT_LEVELS.indexOf(L);
      if (tier >= 0) {
        if (h.human) {
          h.talentQ.push(tier);
          if (h.pendingTalent < 0) { h.pendingTalent = tier; h.talentWait = 0; }
          ev('talent', { id: h.id, kind: h.kind, tier });
        }
        else pickTalent(h, M.rand() < 0.5 ? 0 : 1, tier);
      }
      if (L === 10) ev('heroic', { id: h.id, kind: h.kind, team: h.team });
    }
    function pickTalent(h, choice, tier = h.pendingTalent) {
      if (tier < 0) return false;
      const tal = TALENTS[tier][choice ? 1 : 0];
      h.talents.push(tal.id);
      h.talentQ = h.talentQ.filter((x) => x !== tier);
      if (h.pendingTalent === tier) { h.pendingTalent = h.talentQ.length ? h.talentQ[0] : -1; h.talentWait = 0; }
      heroStats(h);
      ev('picked', { id: h.id, kind: h.kind, talent: tal.id, tier });
      return true;
    }
    M.pickTalent = pickTalent;

    function napTime(h) {
      const [b, per] = lv.nap[h.team];
      return b + per * M.teams[h.team].level;
    }
    function kill(t, src) {
      const by = src ? src.team : -1;
      if (t.hero) {
        t.down = true;
        t.napT = t.napLen = napTime(t);
        t.dash = t.leap = null;
        t.shield = 0;
        t.retreat = false;
        const sp = MAP.spawn[t.team];
        t.x = sp.x + (t.team ? -1 : 1) * 1.5;
        t.y = sp.y + (t.slot - 2) * 2.2;
        M.teams[t.team ^ 1].bonks++;
        M.stats.bonks[t.team ^ 1]++;
        giveXp(t.team ^ 1, XP.heroBonk(M.teams[t.team].level));
        // whoever helped gets the cookie-munch heal
        for (const h of M.heroes) if (h.team !== t.team && !h.down && h.talents.includes('munch') && dist(h, t) < 15) heal(h, h.maxHp * 0.15);
        if (src && src.hero) src.bonks++;
        ev('bonk', { id: t.id, kind: t.kind, team: t.team, by: src ? src.id : 0, x: t.x, y: t.y });
        return;
      }
      t.alive = false;
      if (t.type === 'struct') {
        giveXp(t.team ^ 1, t.xp);
        ev('boom', { id: t.id, kind: t.kind, team: t.team, lane: t.lane, x: t.x, y: t.y });
        if (t.kind === 'core') { M.over = true; M.winner = t.team ^ 1; ev('win', { team: t.team ^ 1 }); }
        return;
      }
      // minions, critters and champions pop into stars and coins
      const xpBy = t.team === 2 ? by : t.team ^ 1;
      if (xpBy === 0 || xpBy === 1) {
        const heroNear = M.heroes.some((h) => h.team === xpBy && !h.down && dist(h, t) < XP.near);
        if (heroNear || t.team === 2) giveXp(xpBy, t.xp);
        M.stats.pops[xpBy]++;
        if (t.type === 'minion' && t.team !== 2 && M.rand() < 0.22) M.drops.push({ id: M.nextId++, x: t.x, y: t.y, team: xpBy, t: 14 });
      }
      ev('pop', { id: t.id, kind: t.kind, team: t.team, x: t.x, y: t.y, by: xpBy });
      if (t.camp) campCheck(t.camp, by);
    }

    // ---------------------------------------------------------------- minions, critters and champions

    function addMinion(kind, team, lane, x, y, mul = 1, extra) {
      const D = MINIONS[kind];
      return add(Object.assign({
        type: 'minion', kind, team, lane, def: D, x, y, r: D.r, hp: D.hp * mul, maxHp: D.hp * mul, dmg: D.dmg, rate: D.rate,
        range: D.range, speed: D.speed, xp: D.xp, dmgMul: mul * (sab.weakMinions ? 0 : 1),
      }, extra || {}));
    }
    function spawnWave() {
      M.waveN++;
      const mul = 1 + WAVE.perMin * (M.t / 60);
      for (const team of [0, 1]) {
        // a safety cap: no more than 60 minions a side on the map at once
        if (M.units.filter((u) => u.alive && u.type === 'minion' && u.team === team).length > 60) continue;
        for (const lane of LANES) {
          const kinds = ['melee', 'melee', 'melee', 'ranged', 'ranged'];
          if (M.waveN % WAVE.cannonEvery === 0) kinds.push('cannon');
          // knock down the other team's fort in a lane and your minions there come out big
          const big = !M.units.some((u) => u.type === 'struct' && u.kind === 'fort' && u.team !== team && u.lane === lane && u.alive);
          kinds.forEach((k, i) => {
            const p = teamPoint(team, lane, 5 - i * 1.3);
            const m = addMinion(k, team, lane, p.x - p.dy * (i % 2 ? 0.7 : -0.7), p.y + p.dx * (i % 2 ? 0.7 : -0.7), mul * (big ? 1.5 : 1), big ? { big: true } : null);
            m.d = 5 - i * 1.3;
          });
        }
      }
      ev('wave', { n: M.waveN });
    }
    function spawnCamp(c) {
      c.critters = [];
      for (let i = 0; i < c.def.n; i++) {
        const a = (i / c.def.n) * Math.PI * 2;
        const m = addMinion(c.def.kind, 2, null, c.x + Math.cos(a) * 1.8, c.y + Math.sin(a) * 1.8, 1, { camp: c, home: { x: c.x + Math.cos(a) * 1.8, y: c.y + Math.sin(a) * 1.8 } });
        c.critters.push(m);
      }
      c.state = 'ready';
      c.owner = -1;
      c.fightT = 0;
    }
    function campCheck(c, by) {
      if (c.state !== 'ready' || c.critters.some((m) => m.alive)) return;
      if (by !== 0 && by !== 1) { spawnCamp(c); return; }
      c.state = 'cool';
      c.t = CAMP_RESPAWN;
      c.owner = by;
      M.teams[by].camps++;
      // the critters come back as friends and march down the nearest lane
      const mul = 1 + WAVE.perMin * (M.t / 60);
      const dEnemy = laneProj(c.def.lane, c.x, c.y);
      for (let i = 0; i < c.def.n; i++) {
        const m = addMinion(c.def.kind, by, c.def.lane, c.x + (i - 1) * 1.4, c.y, mul, { merc: true });
        m.d = teamD(by, c.def.lane, dEnemy);
      }
      ev('camp', { camp: c.id, team: by, x: c.x, y: c.y, lane: c.def.lane });
    }
    function addChamp(team) {
      // walk the lane where the other team has fewer buildings left (the quickest way to their core)
      let lane = LANES[M.rand() < 0.5 ? 0 : 1], best = 99;
      for (const l of LANES) {
        const n = M.units.filter((u) => u.type === 'struct' && u.team !== team && u.lane === l && u.alive).length;
        if (n < best) { best = n; lane = l; }
      }
      const mul = 1 + WAVE.perMin * (M.t / 60);
      const p = teamPoint(team, lane, 8);
      const m = addMinion('champ', team, lane, p.x, p.y, mul, { champ: true });
      m.d = 8;
      ev('champ', { team, lane, id: m.id, x: p.x, y: p.y });
    }
    M.spawnWave = spawnWave;
    M.addChamp = addChamp;

    // where each team's minions have got to in each lane (metres from its own core)
    function updateFront() {
      for (const team of [0, 1]) {
        for (const lane of LANES) {
          let f = -1;
          for (const u of M.units) {
            if (u.type !== 'minion' || u.team !== team || u.lane !== lane || !u.alive) continue;
            if (u.d > f) f = u.d;
          }
          M.front[team][lane] = f;
        }
      }
    }

    // ---------------------------------------------------------------- abilities

    function aimAt(h, range, pickHeroes = true) {
      let t = null;
      if (pickHeroes) t = nearestFoe(h, range, (v) => v.hero);
      if (!t) t = nearestFoe(h, range, (v) => v.type !== 'struct');
      if (!t) t = nearestFoe(h, range);
      return t;
    }
    function dirTo(h, t, aimErr = 0) {
      let dx, dy;
      if (t) {
        dx = t.x - h.x + (aimErr ? (M.rand() - 0.5) * aimErr * 2 : 0);
        dy = t.y - h.y + (aimErr ? (M.rand() - 0.5) * aimErr * 2 : 0);
      } else { dx = Math.cos(h.face); dy = Math.sin(h.face); }
      const l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    }
    const cdMul = (h) => (h.talents.includes('quick') ? 0.75 : 1);
    const ready = (h, i) => !h.down && h.cds[i] <= 0 && (i < 3 || M.teams[h.team].level >= 10 || sab.earlyHeroic);
    M.ready = ready;

    // h casts ability i. aim: optional {x, y} direction (bots retreating). Returns true if it went off.
    function cast(h, i, aim) {
      if (!ready(h, i) || h.stunT > 0 || h.leap || M.over) return false;
      const A = h.def.abil[i];
      const err = h.human ? 0 : lv.aim[h.team];
      h.cds[i] = A.cd * cdMul(h) * (i === 3 && h.talents.includes('heroic') ? 0.6 : 1);
      const e = { id: h.id, kind: h.kind, i, ab: A.type, name: A.name, emoji: A.emoji, x: h.x, y: h.y };
      const reach = A.range || A.dist || A.r || 6;
      const target = A.type === 'shield' || A.type === 'teamShield' || A.type === 'speed' ? null : aimAt(h, reach * 1.15 + 1);
      const d = aim || dirTo(h, target, err);
      h.face = Math.atan2(d.y, d.x);
      h.act = A.pose || A.type;
      h.actT = 0.6;
      switch (A.type) {
        case 'combo': {
          hitArc(h, A.range, A.dmg * 0.4, 0, 0);
          h.act = 'jab';
          M.later.push({ t: M.t + 0.22, fn: () => { if (!h.down) { h.act = 'straight'; h.actT = 0.4; hitArc(h, A.range + 0.3, A.dmg * 0.6, A.knock, 0); ev('straight', { id: h.id, x: h.x, y: h.y }); } } });
          break;
        }
        case 'melee': hitArc(h, A.range, A.dmg, A.knock || 1, A.slow || 0); break;
        case 'shot': {
          M.shots.push({ id: M.nextId++, x: h.x, y: h.y, dx: d.x, dy: d.y, speed: A.speed, max: A.range, gone: 0, team: h.team, src: h, dmg: A.dmg, r: A.r, pierce: !!A.pierce, returns: !!A.returns, back: false, hit: new Set(), emoji: A.emoji, big: i === 3 });
          break;
        }
        case 'dash': {
          let len = A.dist;
          if (target && !aim) len = clamp(dist(h, target) - 1, 2, A.dist);
          h.dash = { dx: d.x, dy: d.y, left: len, speed: 30, dmg: A.dmg, hit: new Set() };
          break;
        }
        case 'leap': {
          let len = A.dist;
          if (target) len = clamp(dist(h, target), 1, A.dist);
          const tx = clamp(h.x + d.x * len, -MAP.W / 2 + 2, MAP.W / 2 - 2), ty = clamp(h.y + d.y * len, -MAP.H / 2 + 2, MAP.H / 2 - 2);
          h.leap = { fx: h.x, fy: h.y, tx, ty, t: 0, dur: 0.75, A };
          e.tx = tx; e.ty = ty;
          break;
        }
        case 'nova': {
          near(h.x, h.y, A.r, (v) => {
            if (isFoe(h, v)) {
              if (A.dmg) hurt(v, A.dmg, h);
              if (A.push) push(v, h, A.push);
              if (A.stun && v.type !== 'struct') v.stunT = Math.max(v.stunT, A.stun);
            } else if (A.heal && v.team === h.team && v.hero) heal(v, A.heal * (h.dmgMul || 1));
          });
          break;
        }
        case 'shield': {
          let who = h;
          if (!A.self) {
            let worst = h.hp / h.maxHp;
            near(h.x, h.y, A.range, (v) => { if (v.hero && v.team === h.team && v.hp / v.maxHp < worst) { worst = v.hp / v.maxHp; who = v; } });
          }
          shieldUp(who, A.shield * (h.dmgMul || 1), A.t);
          e.target = who.id;
          break;
        }
        case 'teamShield': {
          for (const v of M.heroes) if (v.team === h.team && !v.down) { shieldUp(v, A.shield * (h.dmgMul || 1), A.t); heal(v, A.heal * (h.dmgMul || 1)); }
          break;
        }
        case 'speed': h.hasteT = A.t; h.haste = A.amount; break;
        case 'zone': {
          const len = target ? Math.min(dist(h, target), A.range) : Math.min(A.range, 5);
          const z = { x: h.x + d.x * len, y: h.y + d.y * len, r: A.r, t: A.t, life: A.t, team: h.team, src: h, slow: A.slow || 0, dps: A.dps || 0, emoji: A.emoji, kind: h.kind };
          M.zones.push(z);
          e.zx = z.x; e.zy = z.y; e.r = z.r;
          break;
        }
        case 'zap': {
          let t = target && dist(h, target) <= A.range + target.r ? target : null;
          const hitIds = [];
          let from = h;
          for (let n = 0; t && n <= A.chain; n++) {
            hurt(t, A.dmg * (n ? 0.6 : 1), h);
            hitIds.push({ x: t.x, y: t.y, fx: from.x, fy: from.y });
            from = t;
            const prev = t;
            t = null;
            let bd = 1e9;
            near(prev.x, prev.y, 4.5, (v, dd) => { if (isFoe(h, v) && v !== prev && !hitIds.some((p) => p.x === v.x && p.y === v.y) && v.type !== 'struct' && dd < bd) { bd = dd; t = v; } });
          }
          e.chain = hitIds;
          break;
        }
      }
      ev('cast', e);
      return true;
    }
    M.cast = cast;
    function shieldUp(v, amount, t) {
      v.shield = Math.max(v.shield, amount);
      v.shieldT = Math.max(v.shieldT, t);
      ev('shield', { id: v.id });
    }
    M.shieldUp = shieldUp;
    function push(v, from, amount) {
      if (v.type === 'struct' || v.champ) return;
      const dx = v.x - from.x, dy = v.y - from.y, l = Math.hypot(dx, dy) || 1;
      v.pushX = (dx / l) * amount * 5;
      v.pushY = (dy / l) * amount * 5;
    }
    function hitArc(h, range, dmg, knock, slow) {
      const fx = Math.cos(h.face), fy = Math.sin(h.face);
      let n = 0;
      near(h.x, h.y, range, (v) => {
        if (!isFoe(h, v)) return;
        const dx = v.x - h.x, dy = v.y - h.y, l = Math.hypot(dx, dy) || 1;
        if ((dx * fx + dy * fy) / l < 0.25 && l > v.r + 0.8) return; // in front (or right on top of you)
        hurt(v, dmg, h);
        if (knock) push(v, h, knock);
        if (slow) { v.slowT = 2; v.slow = Math.max(v.slow, slow); }
        n++;
      });
      return n;
    }

    // ---------------------------------------------------------------- the companion (1 player) and the team-up (2 players)

    function callBuddy(host) {
      if (!host || !host.human) return null;
      const kind = Kit_buddyFor(host.kind);
      let B = M.buddy;
      const treat = TREATS[Math.floor(M.rand() * TREATS.length)];
      if (B && B.host === host && B.phase !== 'out') {
        B.phase = 'hello';
        B.t = 0;
        B.left = lv.buddyVisit;
        B.treat = treat;
        B.treatDone = false;
      } else {
        const side = host.team === 0 ? -1 : 1;
        B = M.buddy = {
          kind, host, phase: 'in', t: 0, left: lv.buddyVisit, x: host.x + side * 9, y: host.y + 4, fx: host.x + side * 9, fy: host.y + 4,
          treat, treatDone: false, atkT: 0, saves: 0, side: 1, face: 0, act: null,
        };
      }
      // a brother who's napping gets woken up
      if (host.down) {
        host.napT = Math.min(host.napT, 1.2);
        B.wake = true;
        ev('wake', { id: host.id, kind });
      }
      ev('buddy', { kind, host: host.id });
      return B;
    }
    M.callBuddy = callBuddy;
    function tickBuddy(dt) {
      const B = M.buddy;
      if (!B) return;
      const h = B.host;
      B.t += dt;
      // he stands beside you, on the side away from the zombies
      const tx = h.x + (h.team === 0 ? -1.8 : 1.8), ty = h.y + 1.2;
      if (B.phase === 'in') {
        const k = Math.min(1, B.t / BUDDY.inT);
        B.x = B.fx + (tx - B.fx) * k;
        B.y = B.fy + (ty - B.fy) * k;
        if (B.t >= BUDDY.inT) { B.phase = 'hello'; B.t = 0; }
        return;
      }
      if (B.phase === 'out') {
        B.x += (h.team === 0 ? -1 : 1) * dt * 14;
        B.y += dt * 4;
        if (B.t >= BUDDY.outT) M.buddy = null;
        return;
      }
      const k = 1 - Math.exp(-dt * 8);
      B.x += (tx - B.x) * k;
      B.y += (ty - B.y) * k;
      if (B.phase === 'hello') {
        if (!B.treatDone && B.t >= BUDDY.treatAt) {
          B.treatDone = true;
          heal(h, h.maxHp * BUDDY.treatHeal);
          M.stats.treats++;
          ev('treat', { kind: B.kind, emoji: B.treat[0], name: B.treat[1], x: B.x, y: B.y, host: h.id });
        }
        if (B.t >= BUDDY.helloT) { B.phase = 'stay'; B.t = 0; }
        return;
      }
      // stay: help out, and count down
      B.left -= dt;
      B.atkT -= dt;
      const P = BUDDY[B.kind];
      if (B.atkT <= 0 && !h.down) {
        const f = nearestFoe(B, P.range, (v) => v.type !== 'struct');
        if (f) {
          B.atkT = P.every;
          if (B.kind === 'teddy') {
            hurt(f, P.dmg, h);
            B.act = B.act === 'jab' ? 'straight' : 'jab';
            B.face = Math.atan2(f.y - B.y, f.x - B.x);
          } else {
            near(B.x, B.y, P.range, (v) => { if (isFoe(h, v) && v.type !== 'struct') { hurt(v, P.dmg, h); push(v, B, P.push); } });
            B.act = 'peace';
          }
          ev('buddyHit', { kind: B.kind, x: B.x, y: B.y, tx: f.x, ty: f.y, act: B.act });
        }
      }
      if (B.left <= 0) { B.phase = 'out'; B.t = 0; ev('buddyBye', { kind: B.kind }); }
    }
    function teamUp(who) {
      const bros = M.heroes.filter((h) => h.human && (h.kind === 'teddy' || h.kind === 'tommy'));
      if (bros.length < 2) return false;
      if (M.teamUp.rest > 0) { ev('nope', { what: 'teamUp' }); return false; }
      M.teamUp.rest = lv.teamUpRest;
      const [a, b] = bros;
      for (const h of bros) {
        if (h.down) { h.napT = 0; wakeUp(h); }
      }
      const together = dist(a, b) < TEAMUP.together;
      for (const h of bros) {
        shieldUp(h, TEAMUP.shield * h.dmgMul, TEAMUP.t);
        heal(h, h.maxHp * TEAMUP.heal);
        near(h.x, h.y, TEAMUP.r * (together ? 1.3 : 1), (v) => {
          if (!isFoe(h, v) || v.type === 'struct') return;
          hurt(v, TEAMUP.dmg * (together ? 1.5 : 1), h);
          push(v, h, TEAMUP.push);
        });
        h.act = h.kind === 'teddy' ? 'jumpshot' : 'peace';
        h.actT = 1.2;
      }
      ev('teamUp', { together, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, by: who ? who.kind : null });
      return true;
    }
    M.teamUp.go = teamUp;

    // ---------------------------------------------------------------- the map objective

    function tickObj(dt) {
      const O = M.obj;
      if (O.state === 'wait') {
        O.at -= dt;
        if (O.at <= 15 && !O.warned) { O.warned = true; ev('objSoon', { kind: O.kind }); }
        if (O.at <= 0) { O.state = 'live'; O.prog = [0, 0]; O.warned = false; ev('objUp', { kind: O.kind, x: O.x, y: O.y }); }
        return;
      }
      // live: stand next to it with nobody from the other team there
      const here = [0, 0];
      for (const h of M.heroes) if (!h.down && Math.hypot(h.x - O.x, h.y - O.y) <= O.r) here[h.team]++;
      O.contested = here[0] > 0 && here[1] > 0;
      for (const team of [0, 1]) {
        if (here[team] && !here[team ^ 1]) O.prog[team] += dt;
        else if (!here[team]) O.prog[team] = Math.max(0, O.prog[team] - dt * 0.5);
      }
      for (const team of [0, 1]) {
        if (O.prog[team] >= OBJ.capture) {
          M.teams[team].objs++;
          ev('objWon', { kind: O.kind, team, x: O.x, y: O.y });
          if (O.kind === 'ball') goldenSlam(team);
          else addChamp(team);
          O.n++;
          O.kind = OBJ.kinds[O.n % OBJ.kinds.length];
          O.state = 'wait';
          O.at = OBJ.every;
          O.prog = [0, 0];
          break;
        }
      }
    }
    // the Golden Basketball: a golden ball slams the front building in each lane
    function goldenSlam(team) {
      const hits = [];
      for (const lane of LANES) {
        const order = ['tower', 'fort'];
        let S = null;
        for (const k of order) { S = M.units.find((u) => u.type === 'struct' && u.team !== team && u.lane === lane && u.kind === k && u.alive); if (S) break; }
        if (!S) { const c = M.teams[team ^ 1].core; if (c.alive && !coreShielded(c)) S = c; }
        if (!S) continue;
        hits.push({ x: S.x, y: S.y, id: S.id });
        const amt = S.maxHp * (S.kind === 'core' ? 0.2 : 0.45);
        M.later.push({ t: M.t + 1.2, fn: () => {
          if (!S.alive || sab.noHarm) return;
          S.hp -= amt; // a golden slam always lands
          ev('slam', { x: S.x, y: S.y, id: S.id });
          near(S.x, S.y, 9, (v) => { if (v.type === 'minion' && v.team === S.team) hurt(v, 9999, null); });
          if (S.hp <= 0) kill(S, null);
          if (S.kind === 'core' && !S.alive) { /* handled in kill */ }
        } });
      }
      ev('golden', { team, hits });
    }
    M.goldenSlam = goldenSlam;

    // ---------------------------------------------------------------- moving things

    function wakeUp(h) {
      h.down = false;
      h.napT = 0;
      h.hp = h.maxHp;
      h.cdsWake = true;
      const sp = MAP.spawn[h.team];
      h.x = sp.x + (h.team ? -1 : 1) * 2;
      h.y = sp.y + (h.slot - 2) * 1.6;
      h.retreat = false;
      ev('awake', { id: h.id, kind: h.kind });
    }
    function moveUnit(u, mx, my, speed, dt) {
      let sp = speed;
      if (u.slowT > 0) sp *= 1 - u.slow;
      if (u.hasteT > 0) sp *= 1 + u.haste;
      if (u.stunT > 0) sp = 0;
      u.vx = mx * sp;
      u.vy = my * sp;
      if (mx || my) u.face = Math.atan2(my, mx);
      u.x += (u.vx + u.pushX) * dt;
      u.y += (u.vy + u.pushY) * dt;
      const pk = Math.exp(-dt * 7);
      u.pushX *= pk;
      u.pushY *= pk;
    }
    function separate(dt) {
      for (const u of M.units) {
        if (!u.alive || u.down || u.type === 'struct' || u.leap) continue;
        near(u.x, u.y, u.r + 0.2, (v) => {
          if (v === u) return;
          const dx = u.x - v.x, dy = u.y - v.y, l = Math.hypot(dx, dy) || 0.01, min = u.r + v.r;
          if (l >= min) return;
          if (v.type === 'struct') { u.x = v.x + (dx / l) * min; u.y = v.y + (dy / l) * min; return; }
          const k = Math.min(1, dt * 6) * (min - l) * 0.5;
          u.x += (dx / l) * k;
          u.y += (dy / l) * k;
        });
        u.x = clamp(u.x, -MAP.W / 2 + 1, MAP.W / 2 - 1);
        u.y = clamp(u.y, -MAP.H / 2 + 1, MAP.H / 2 - 1);
      }
    }
    // basic attacks: the nearest enemy in range (or the bot's chosen target)
    function attack(u, dt) {
      u.atkT -= dt;
      if (u.atkT > 0 || u.stunT > 0) return;
      const range = u.hero ? u.def.atk.range : u.range;
      let t = null;
      if (u.focus && u.focus.alive && !u.focus.down && dist(u, u.focus) - u.focus.r <= range && isFoe(u, u.focus)) t = u.focus;
      if (!t && u.type === 'struct') t = nearestFoe(u, range, (v) => !v.hero) || nearestFoe(u, range);
      if (!t && u.hero && !u.human && !u.brain.hitBuildings) t = nearestFoe(u, range, (v) => v.type !== 'struct');
      if (!t) t = nearestFoe(u, range);
      if (!t) return;
      if (t.type === 'struct' && coreShielded(t) && !u.human) return; // bots don't waste swings on a shielded core
      const dmg = u.hero ? u.def.atk.dmg : u.dmg;
      u.atkT = u.hero ? u.def.atk.rate : u.rate;
      if (u.hero || u.type === 'minion') u.face = Math.atan2(t.y - u.y, t.x - u.x);
      hurt(t, dmg, u);
      if (u.hero) { u.act = u.kind === 'teddy' || u.kind === 'zombo' ? (u.act === 'jab' ? 'straight' : 'jab') : 'atk'; u.actT = 0.3; }
      ev('atk', { id: u.id, tid: t.id, x: u.x, y: u.y, tx: t.x, ty: t.y, kind: u.kind, team: u.team, hero: !!u.hero, emoji: u.hero ? u.def.atk.emoji : null });
    }
    // minions walk their lane and fight whatever they meet; camp critters stay home unless someone pokes them
    function tickMinion(u, dt) {
      if (u.team === 2) {
        const c = u.camp;
        let t = u.aggro && u.aggro.alive && !u.aggro.down ? u.aggro : null;
        if (t && (dist(t, c) > 11 || c.fightT <= 0)) { t = null; u.aggro = null; }
        if (!t) {
          const dx = u.home.x - u.x, dy = u.home.y - u.y, l = Math.hypot(dx, dy);
          if (l > 0.3) moveUnit(u, dx / l, dy / l, u.speed * 1.4, dt);
          else moveUnit(u, 0, 0, 0, dt);
          if (l < 2) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.25 * dt);
          return;
        }
        u.focus = t;
        const l = dist(u, t);
        if (l - t.r > u.range * 0.9) moveUnit(u, (t.x - u.x) / l, (t.y - u.y) / l, u.speed, dt);
        else moveUnit(u, 0, 0, 0, dt);
        attack(u, dt);
        return;
      }
      const t = nearestFoe(u, u.champ ? 7 : 6.5);
      if (t && !(t.type === 'struct' && coreShielded(t) && !u.champ)) {
        u.focus = t;
        const l = dist(u, t);
        if (l - t.r > u.range * 0.9) moveUnit(u, (t.x - u.x) / l, (t.y - u.y) / l, u.speed, dt);
        else moveUnit(u, 0, 0, 0, dt);
      } else {
        u.focus = null;
        const ahead = teamPoint(u.team, u.lane, u.d + 2.5);
        const dx = ahead.x - u.x, dy = ahead.y - u.y, l = Math.hypot(dx, dy) || 1;
        moveUnit(u, dx / l, dy / l, u.speed, dt);
      }
      u.d = teamD(u.team, u.lane, laneProj(u.lane, u.x, u.y));
      attack(u, dt);
    }
    function tickHero(h, dt) {
      if (h.down) {
        h.napT -= dt;
        if (h.napT <= 0) wakeUp(h);
        return;
      }
      for (let i = 0; i < 4; i++) if (h.cds[i] > 0) h.cds[i] -= dt;
      if (h.hasteT > 0) h.hasteT -= dt;
      if (h.actT > 0) { h.actT -= dt; if (h.actT <= 0) h.act = null; }
      if (h.talents.includes('speedy')) h.speedy = 1.15; else h.speedy = 1;
      h.hurtT += dt;
      // in the air (slam dunk, belly flop)
      if (h.leap) {
        const L = h.leap;
        L.t += dt;
        const k = Math.min(1, L.t / L.dur);
        h.x = L.fx + (L.tx - L.fx) * k;
        h.y = L.fy + (L.ty - L.fy) * k;
        h.z = Math.sin(k * Math.PI) * 4;
        if (k >= 1) {
          h.leap = null;
          h.z = 0;
          near(h.x, h.y, L.A.r, (v) => {
            if (!isFoe(h, v)) return;
            hurt(v, L.A.dmg, h);
            if (L.A.stun && v.type !== 'struct') v.stunT = Math.max(v.stunT, L.A.stun);
            push(v, h, 1.5);
          });
          ev('land', { id: h.id, kind: h.kind, x: h.x, y: h.y, r: L.A.r });
        }
        return;
      }
      if (h.dash) {
        const D = h.dash, step = Math.min(D.left, D.speed * dt);
        h.x += D.dx * step;
        h.y += D.dy * step;
        D.left -= step;
        if (D.dmg) near(h.x, h.y, 1.2, (v) => { if (isFoe(h, v) && !D.hit.has(v.id)) { D.hit.add(v.id); hurt(v, D.dmg, h); } });
        if (D.left <= 0.01) h.dash = null;
        attack(h, dt);
        return;
      }
      const inp = h.human && !M.autoAll ? M.input[h.kind] : h.brain.input || { mx: 0, my: 0 };
      if (h.human && !M.autoAll) {
        for (let i = 0; i < 4; i++) if (inp.cast[i]) { inp.cast[i] = false; if (!cast(h, i)) ev('nope', { id: h.id, i }); }
        if (h.pendingTalent >= 0) {
          h.talentWait += dt;
          if (h.talentWait > 25) pickTalent(h, 0); // a 5-year-old may never pick: the first one is fine
        }
      }
      const l = Math.hypot(inp.mx, inp.my);
      const mx = l > 1 ? inp.mx / l : inp.mx, my = l > 1 ? inp.my / l : inp.my;
      moveUnit(h, mx, my, h.def.speed * lv.speed[h.team] * h.speedy, dt);
      attack(h, dt);
      // back home at the fountain: heal up fast
      const sp = MAP.spawn[h.team];
      if (Math.hypot(h.x - sp.x, h.y - sp.y) < MAP.fountainR) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.2 * dt);
      else if (h.hurtT > 4) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * lv.regen[h.team] * dt);
      // cookies from popped minions heal whoever walks over them
      for (let i = M.drops.length - 1; i >= 0; i--) {
        const c = M.drops[i];
        if (c.team === h.team && h.hp < h.maxHp && Math.hypot(c.x - h.x, c.y - h.y) < 1.4) {
          heal(h, h.maxHp * (h.talents.includes('munch') ? 0.24 : 0.12));
          M.drops.splice(i, 1);
          ev('munch', { id: h.id, x: c.x, y: c.y, did: c.id });
        }
      }
    }
    function tickStruct(S, dt) {
      if (sab.quietTowers) return;
      attack(S, dt);
    }
    function tickShots(dt) {
      for (let i = M.shots.length - 1; i >= 0; i--) {
        const s = M.shots[i];
        const step = s.speed * dt;
        if (s.back) {
          const dx = s.src.x - s.x, dy = s.src.y - s.y, l = Math.hypot(dx, dy) || 1;
          if (l < 1 || s.src.down) { M.shots.splice(i, 1); continue; }
          s.dx = dx / l; s.dy = dy / l;
        }
        s.x += s.dx * step;
        s.y += s.dy * step;
        s.gone += step;
        let stop = false;
        near(s.x, s.y, s.r, (v) => {
          if (stop || !isFoe(s.src, v) || s.hit.has(v.id)) return;
          if (v.type === 'struct' && !s.big) return; // skill shots fly over buildings
          s.hit.add(v.id);
          hurt(v, s.dmg, s.src);
          ev('shotHit', { x: v.x, y: v.y, emoji: s.emoji, big: s.big });
          if (!s.pierce) stop = true;
        });
        if (stop) { M.shots.splice(i, 1); continue; }
        if (!s.back && s.gone >= s.max) {
          if (s.returns) { s.back = true; s.hit.clear(); } else { M.shots.splice(i, 1); ev('shotEnd', { x: s.x, y: s.y, emoji: s.emoji }); }
        }
      }
    }
    function tickZones(dt) {
      for (let i = M.zones.length - 1; i >= 0; i--) {
        const z = M.zones[i];
        z.t -= dt;
        if (z.t <= 0) { M.zones.splice(i, 1); continue; }
        near(z.x, z.y, z.r, (v) => {
          if (!isFoe(z.src, v) || v.type === 'struct') return;
          if (z.slow) { v.slowT = Math.max(v.slowT, 0.3); v.slow = Math.max(v.slow, z.slow); }
          if (z.dps) hurt(v, z.dps * dt, z.src);
        });
      }
    }

    // ---------------------------------------------------------------- one tick

    M.tick = function (dt) {
      if (M.over) { M.t += dt; return; }
      M.t += dt;
      rebuildGrid();
      for (let i = M.later.length - 1; i >= 0; i--) if (M.later[i].t <= M.t) { const L = M.later[i]; M.later.splice(i, 1); L.fn(); }
      if (M.t >= M.nextWave) { M.nextWave += WAVE.every; spawnWave(); }
      for (const c of M.camps) {
        if (c.state === 'cool') { c.t -= dt; if (c.t <= 0) { spawnCamp(c); ev('campBack', { camp: c.id }); } }
        else if (c.fightT > 0) c.fightT -= dt;
      }
      // a little XP for everyone, all the time
      if (!sab.noXp) { giveXp(0, XP.trickle * dt); giveXp(1, XP.trickle * dt); }
      updateFront();
      if (HTT.brain) for (const h of M.heroes) if (!h.human || M.autoAll) HTT.brain.think(M, h, dt);
      M.flip = !M.flip; // take turns going first, so neither team always swings first
      const U = M.units, n = U.length;
      for (let k = 0; k < n; k++) {
        const u = U[M.flip ? n - 1 - k : k];
        if (!u.alive) continue;
        if (u.slowT > 0) { u.slowT -= dt; if (u.slowT <= 0) u.slow = 0; }
        if (u.stunT > 0) u.stunT -= dt;
        if (u.shieldT > 0) { u.shieldT -= dt; if (u.shieldT <= 0) u.shield = 0; }
        if (u.hero) tickHero(u, dt);
        else if (u.type === 'minion') tickMinion(u, dt);
        else if (u.type === 'struct') tickStruct(u, dt);
        if (M.over) break;
      }
      tickShots(dt);
      tickZones(dt);
      separate(dt);
      tickObj(dt);
      tickBuddy(dt);
      if (M.teamUp.rest > 0) M.teamUp.rest -= dt;
      for (let i = M.drops.length - 1; i >= 0; i--) { M.drops[i].t -= dt; if (M.drops[i].t <= 0) M.drops.splice(i, 1); }
      // tidy away popped minions (the view has already been told)
      if (M.units.length > 140 || ((M.t * 10) | 0) % 50 === 0) M.units = M.units.filter((u) => u.alive || u.hero);
    };
    M.hero = (kind) => M.heroes.find((h) => h.kind === kind);
    M.wake = wakeUp;
    return M;
  }

  // the other brother (Kit.roster.buddyFor in the browser, the same rule in Node)
  function Kit_buddyFor(id) {
    const K = typeof window !== 'undefined' && window.Kit && window.Kit.roster;
    return K ? K.buddyFor(id) : id === 'tommy' ? 'teddy' : 'tommy';
  }

  HTT.sim = { LEVELS, MAP, LANES, LANE, STRUCTS, WAVE, MINIONS, OBJ, XP, TALENT_LEVELS, TALENTS, HEROES, TEAMS, BUDDY, TREATS, TEAMUP, CAMP_RESPAWN, newMatch, lanePoint, laneProj, teamPoint, teamD, rng };
})();
