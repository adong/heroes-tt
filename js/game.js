/* Heroes TT: the game. Sets up Three.js, runs the rules (js/sim.js) at a fixed 60 ticks a second, turns the rules'
   events into poofs, sounds, toasts and the HUD, and handles the menus, keys and touch.
   Test hooks live on window.game (see the bottom of this file and the README). */
(function () {
  'use strict';
  const T = THREE;
  const G = Kit.gfx;
  const A = HTT.art;
  const S = HTT.sim;
  const SFX = HTT.sfx;
  const $ = (id) => document.getElementById(id);
  const DT = 1 / 60;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const ROLE = { bruiser: 'BRUISER', support: 'HELPER', speedy: 'SPEEDY', shooter: 'SHOOTER', tank: 'TANK' };
  const KEYSETS = [
    { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], ab: ['KeyF', 'KeyG', 'KeyH', 'KeyR'], bud: ['KeyT'], tal: ['Digit1', 'Digit2'] },
    { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], ab: ['KeyJ', 'KeyK', 'KeyL', 'KeyI'], bud: ['Enter', 'NumpadEnter'], tal: ['Digit9', 'Digit0'] },
  ];
  const KEYCAPS = [['F', 'G', 'H', 'R'], ['J', 'K', 'L', 'I']];
  const OBJ_NAME = { ball: 'GOLDEN BASKETBALL', shrine: 'PEACE SHRINE' };
  const OBJ_EMOJI = { ball: '🏀', shrine: '✌️' };
  const sig = (kind, which) => Kit.roster.signature(Kit.roster.get(kind), which);
  const t = (en) => (Kit.lang ? Kit.lang.t(en) : en);

  // ---------------------------------------------------------------- storage

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const settings = Object.assign({ level: 'easy', lastPlayers: ['teddy'] }, store.get('heroesTT.settings', {}));
  const saveSettings = () => store.set('heroesTT.settings', settings);

  // ---------------------------------------------------------------- renderer, scene, camera

  const canvas = $('view');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new T.Scene();
  scene.background = new T.Color('#8fd3ff');
  const camera = new T.PerspectiveCamera(42, 1, 0.5, 500);
  const hemi = new T.HemisphereLight('#ffffff', '#5b7a3a', 0.9);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff3e0', 1.0);
  sun.position.set(-20, 40, 25);
  scene.add(sun);

  A.initTextures();
  const map = A.makeMap(scene, S);
  const fx = A.makeFx(scene);
  const objView = A.makeObjective();
  scene.add(objView.root);

  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || /[?&]touch=1/.test(location.search);
  if (touch) document.body.classList.add('touch');
  const faces = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 152 });

  // ---------------------------------------------------------------- state

  const st = {
    mode: 'loading', time: 0, M: null, demo: false, acc: 0, players: ['teddy'], level: settings.level === 'normal' ? 'normal' : 'easy',
    frozen: false, keepAwake: false, toasts: [], banner: null, shake: 0, endAt: 0, endFocus: null,
    cam: { x: -40, z: 0, f: 1 }, stick: [null, null], miniAt: 0, lastLevel: [1, 1], heroicShown: {}, saveToastAt: -9,
  };
  const views = { heroes: new Map(), units: new Map(), shots: new Map(), zones: new Map(), drops: new Map(), buddy: null };
  const humans = () => (st.M ? st.players.map((k) => st.M.hero(k)).filter(Boolean) : []);
  const playerIndex = (h) => st.players.indexOf(h.kind);

  // ---------------------------------------------------------------- views

  function clearViews() {
    for (const v of views.heroes.values()) scene.remove(v.root);
    for (const v of views.units.values()) scene.remove(v.root);
    for (const v of views.shots.values()) scene.remove(v);
    for (const v of views.zones.values()) scene.remove(v.root);
    for (const v of views.drops.values()) scene.remove(v);
    if (views.buddy) scene.remove(views.buddy.root);
    views.heroes.clear(); views.units.clear(); views.shots.clear(); views.zones.clear(); views.drops.clear();
    views.buddy = null;
    fx.clear();
  }
  function heroView(h) {
    let v = views.heroes.get(h.id);
    if (!v) {
      v = A.makeHero(h.kind, h.team, h.name, h.human && !st.demo);
      v.phase = Math.random() * 6;
      v.yaw = h.team ? -Math.PI / 2 : Math.PI / 2;
      v.zzT = Math.random();
      scene.add(v.root);
      views.heroes.set(h.id, v);
    }
    return v;
  }
  const POSE = { jab: 'jab', straight: 'straight', jumpshot: 'jumpshot', peace: 'peace', combo: 'jab', melee: 'straight', shot: 'give', zone: 'give', zap: 'give', atk: 'give', nova: 'wave', shield: 'wave', teamShield: 'wave', leap: 'jump', dash: 'run', speed: 'run' };
  function updateHero(h, dt) {
    const v = heroView(h);
    const k = 1 - Math.exp(-18 * dt);
    if (h.down) {
      // napping on his bed at base, with a little ZZZ
      const sp = S.MAP.spawn[h.team];
      const bx = sp.x + (h.team ? -1.5 : 1.5), bz = (h.slot - 2) * 2.2;
      v.root.position.set(bx + (h.team ? -1 : 1), 0.62, bz);
      v.root.rotation.y = h.team ? Math.PI / 2 : -Math.PI / 2;
      v.p.root.rotation.x = Math.PI / 2;
      v.p.root.position.y = 0;
      Kit.people.pose(v.p, 0, 'stand', 1);
      v.bar.g.visible = v.ring.visible = v.bubble.visible = false;
      v.tag.position.set(0, 1.2, 1);
      if (v.stun) v.stun.visible = false;
      v.zzT -= dt;
      if (v.zzT <= 0) {
        v.zzT = 0.9;
        fx.add({ map: A.emoji('💤'), x: bx, y: 1.4, z: bz - 0.3, vx: 0.2, vy: 0.9, life: 1.6, size: 0.8, grow: 0.3, fade: 0.5 });
      }
      return;
    }
    v.p.root.rotation.x = 0;
    v.bar.g.visible = v.ring.visible = true;
    v.tag.position.set(0, 3.95, 0);
    v.root.position.set(h.x, h.z || 0, h.y);
    const want = A.facing(Math.cos(h.face), Math.sin(h.face));
    let d = want - v.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    v.yaw += d * k;
    v.root.rotation.y = v.yaw;
    const moving = Math.hypot(h.vx, h.vy) > 0.5;
    let mode = '';
    if (h.leap) mode = h.kind === 'teddy' ? 'jumpshot' : 'jump';
    else if (h.act && POSE[h.act]) mode = POSE[h.act];
    else if (moving || h.dash) mode = 'run';
    else if (h.kind === 'teddy' || h.kind === 'zombo') mode = 'guard';
    if (mode === 'peace' && h.kind !== 'tommy') mode = 'wave';
    Kit.people.pose(v.p, st.time * 11 + v.phase, mode, k);
    v.bar.set(h.hp / h.maxHp, h.shield / h.maxHp);
    v.bubble.visible = h.shield > 0;
    if (v.bubble.visible) v.bubble.scale.set(1 + Math.sin(st.time * 6) * 0.04, 1.25, 1 + Math.sin(st.time * 6) * 0.04);
    if (h.stunT > 0) {
      if (!v.stun) { v.stun = new T.Sprite(new T.SpriteMaterial({ map: A.emoji('💫'), depthWrite: false })); v.stun.scale.set(0.9, 0.9, 1); v.root.add(v.stun); }
      v.stun.visible = true;
      v.stun.position.set(Math.cos(st.time * 8) * 0.4, 2.4, Math.sin(st.time * 8) * 0.4);
    } else if (v.stun) v.stun.visible = false;
  }

  const discGeo = new T.CircleGeometry(0.75, 20);
  function unitView(u) {
    let v = views.units.get(u.id);
    if (v) return v;
    if (u.type === 'struct') {
      v = A.makeStruct(u);
      v.bar = A.makeBar(u.kind === 'core' ? 4 : 3, u.team);
      v.bar.g.position.y = v.top;
      v.root.add(v.bar.g);
    } else {
      v = A.makeMinion(u.kind, u.team, u.big);
      const color = A.TEAM[u.team];
      const disc = new T.Mesh(discGeo, new T.MeshBasicMaterial({ color, transparent: true, opacity: u.team === 2 ? 0.45 : 0.6, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.04;
      disc.scale.setScalar(u.r / 0.55);
      v.root.add(disc);
      v.bar = A.makeBar(u.champ ? 3 : 1.1, u.team);
      v.bar.g.position.y = v.h + 0.3;
      v.bar.g.visible = false;
      v.root.add(v.bar.g);
      v.yaw = u.team === 1 ? -Math.PI / 2 : Math.PI / 2;
      v.root.position.set(u.x, 0, u.y);
      v.root.rotation.y = v.yaw;
    }
    v.u = u;
    scene.add(v.root);
    views.units.set(u.id, v);
    return v;
  }
  function updateUnit(u, dt) {
    const v = unitView(u);
    if (u.type === 'struct') {
      if (!u.alive) return;
      v.bar.set(u.hp / u.maxHp, 0);
      v.bar.g.visible = u.hp < u.maxHp || u.kind === 'core';
      const shielded = u.kind === 'core' && st.M.coreShielded(u);
      v.shield.visible = shielded;
      if (shielded) v.shield.material.opacity = 0.12 + Math.sin(st.time * 3) * 0.04;
      return;
    }
    if (!u.alive || v.dying !== undefined) return;
    const k = 1 - Math.exp(-14 * dt);
    v.root.position.set(u.x, 0, u.y);
    const moving = Math.hypot(u.vx, u.vy) > 0.3;
    if (moving || u.focus) {
      const want = u.focus && !moving ? A.facing(u.focus.x - u.x, u.focus.y - u.y) : A.facing(u.vx, u.vy);
      let d = want - v.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      v.yaw += d * k;
      v.root.rotation.y = v.yaw;
    }
    A.animMinion(v, st.time + (u.id % 7), moving, !moving && !!u.focus && u.atkT > u.rate - 0.3);
    v.bar.g.visible = u.hp < u.maxHp;
    if (v.bar.g.visible) v.bar.set(u.hp / u.maxHp, 0);
  }
  function popView(id, x, z) {
    const v = views.units.get(id);
    if (v) v.dying = 0;
    fx.popStars(x, z, 6);
    fx.puff(x, z, 5, '#ffffff', 1.6);
  }
  function syncViews(dt) {
    const M = st.M;
    if (!M) return;
    for (const h of M.heroes) updateHero(h, dt);
    const seen = new Set();
    for (const u of M.units) {
      if (u.hero) continue;
      seen.add(u.id);
      updateUnit(u, dt);
    }
    for (const [id, v] of views.units) {
      if (v.u.type === 'struct') continue;
      if (!seen.has(id) && v.dying === undefined) v.dying = 0;
      if (v.dying !== undefined) {
        v.dying += dt;
        const s = Math.max(0.01, 1 - v.dying / 0.25) * (v.u.champ ? 1 : v.u.big ? 1.5 : 1.15);
        v.root.scale.setScalar(s);
        if (v.dying > 0.25) { scene.remove(v.root); views.units.delete(id); }
      }
    }
    // skill shots
    const live = new Set();
    for (const s of M.shots) {
      live.add(s.id);
      let sp = views.shots.get(s.id);
      if (!sp) {
        sp = new T.Sprite(new T.SpriteMaterial({ map: A.emoji(s.emoji), depthWrite: false }));
        const size = s.big ? 2.8 : 1.1;
        sp.scale.set(size, size, 1);
        scene.add(sp);
        views.shots.set(s.id, sp);
      }
      sp.position.set(s.x, s.big ? 1.8 : 1.3, s.y);
      sp.material.rotation += dt * (s.returns ? 14 : 6);
    }
    for (const [id, sp] of views.shots) if (!live.has(id)) { scene.remove(sp); views.shots.delete(id); }
    // zones (bubbles, star showers, puddles, static)
    const zl = new Set(M.zones);
    for (const z of M.zones) {
      let v = views.zones.get(z);
      if (!v) {
        const color = { tommy: '#9fe0ff', luna: '#c79bff', bolt: '#ffe680', gooey: '#8fe06a' }[z.kind] || '#ffffff';
        const root = new T.Group();
        const disc = new T.Mesh(new T.CircleGeometry(z.r, 32), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0.06;
        root.add(disc);
        const bits = [];
        for (let i = 0; i < 5; i++) {
          const b = new T.Sprite(new T.SpriteMaterial({ map: A.emoji(z.emoji), depthWrite: false, transparent: true }));
          b.scale.set(0.9, 0.9, 1);
          root.add(b);
          bits.push({ b, a: (i / 5) * Math.PI * 2, r: z.r * (0.3 + Math.random() * 0.5), s: Math.random() * 6 });
        }
        root.position.set(z.x, 0, z.y);
        scene.add(root);
        v = { root, disc, bits };
        views.zones.set(z, v);
      }
      for (const b of v.bits) {
        const a = b.a + st.time * 0.8;
        b.b.position.set(Math.cos(a) * b.r, 0.6 + ((st.time * 1.5 + b.s) % 2), Math.sin(a) * b.r);
      }
      v.disc.material.opacity = 0.35 * Math.min(1, z.t / 0.4);
    }
    for (const [z, v] of views.zones) if (!zl.has(z)) { scene.remove(v.root); views.zones.delete(z); }
    // cookies on the ground
    const dl = new Set();
    for (const c of M.drops) {
      dl.add(c.id);
      let sp = views.drops.get(c.id);
      if (!sp) {
        sp = new T.Sprite(new T.SpriteMaterial({ map: A.emoji('🍪'), depthWrite: false }));
        sp.scale.set(0.8, 0.8, 1);
        scene.add(sp);
        views.drops.set(c.id, sp);
      }
      sp.position.set(c.x, 0.55 + Math.sin(st.time * 4 + c.id) * 0.12, c.y);
      sp.material.opacity = c.t < 2 ? (Math.floor(st.time * 8) % 2 ? 0.4 : 1) : 1;
    }
    for (const [id, sp] of views.drops) if (!dl.has(id)) { scene.remove(sp); views.drops.delete(id); }
    // the objective
    const O = M.obj;
    objView.root.visible = O.state === 'live';
    if (objView.root.visible) {
      objView.ball.visible = O.kind === 'ball';
      objView.shrine.visible = O.kind === 'shrine';
      objView.gold.position.y = 3 + Math.sin(st.time * 2) * 0.3;
      objView.gold.rotation.y += dt * 1.2;
      objView.peace.position.y = 1.9 + Math.sin(st.time * 3) * 0.15;
      objView.drawRing(O.prog[0] / S.OBJ.capture, O.prog[1] / S.OBJ.capture, O.contested, st.time);
    }
    updateBuddyView(dt);
  }

  function updateBuddyView(dt) {
    const B = st.M && st.M.buddy;
    if (!B) {
      if (views.buddy) { scene.remove(views.buddy.root); views.buddy = null; }
      return;
    }
    let v = views.buddy;
    if (!v || v.kind !== B.kind) {
      if (v) scene.remove(v.root);
      v = views.buddy = A.makeBuddy(B.kind);
      scene.add(v.root);
      v.yaw = 0;
    }
    v.root.position.set(B.x, B.phase === 'in' ? Math.sin(Math.min(1, B.t / S.BUDDY.inT) * Math.PI) * 1.5 : 0, B.y);
    let mode = 'run', yaw = A.facing(B.x - (v.lx || B.x), B.y - (v.lz || B.y) + 0.0001);
    if (B.phase === 'hello') {
      mode = B.kind === 'teddy' ? (B.t < 0.9 ? 'boxing' : 'jumpshot') : sig(B.kind, 'hello');
      yaw = Math.PI; // to the camera
    } else if (B.phase === 'out') {
      mode = sig(B.kind, 'goodbye');
      yaw = Math.PI;
    } else if (B.phase === 'stay') {
      const busy = st.time - (v.hitAt || -9) < 0.35;
      mode = busy ? B.act || 'jab' : B.kind === 'teddy' ? 'guard' : '';
      yaw = busy ? A.facing(Math.cos(B.face), Math.sin(B.face)) : Math.PI;
    }
    v.lx = B.x; v.lz = B.y;
    let d = yaw - v.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    v.yaw += d * (1 - Math.exp(-12 * dt));
    v.root.rotation.y = v.yaw;
    Kit.people.pose(v.p, st.time * 11, mode, 1 - Math.exp(-20 * dt));
    v.halo.material.opacity = 0.35 + Math.sin(st.time * 5) * 0.15;
  }

  // ---------------------------------------------------------------- events from the rules: effects, sounds, toasts

  const W3 = (x, y, h = 1.2) => ({ x, y: h, z: y });
  const mine = (team) => (st.demo ? false : team === 0);
  function handleEvent(e) {
    const M = st.M;
    const me = humans();
    const isMe = (id) => me.some((h) => h.id === id);
    const near = (x, y, r = 30) => Math.hypot(x - st.cam.x, y - st.cam.z) < r * st.cam.f;
    switch (e.type) {
      case 'atk': {
        if (!near(e.x, e.y)) break;
        const d = Math.hypot(e.tx - e.x, e.ty - e.y);
        const u = M.units.find((x) => x.id === e.id);
        if (u && u.type === 'struct') {
          fx.dotTo(W3(e.x, e.y, u.kind === 'tower' ? 4.6 : 4), W3(e.tx, e.ty, 1), A.TEAM[e.team], 0.3, 1);
          SFX.tower();
        } else if (d > 3) {
          if (e.emoji) fx.throwTo(e.emoji, W3(e.x, e.y, 1.4), W3(e.tx, e.ty, 1.1), 0.22, 0.7, 0.6);
          else fx.dotTo(W3(e.x, e.y, 1.2), W3(e.tx, e.ty, 1), e.kind === 'cannon' ? '#ffd400' : e.team === 1 ? '#ff5d6c' : '#9fe0ff', e.kind === 'cannon' ? 0.5 : 0.25, e.kind === 'cannon' ? 0.9 : 0.5);
          if (e.hero) SFX.shot();
        } else {
          fx.puff(e.tx, e.ty, 2, '#ffffff', 1);
          if (e.hero) SFX.punch(); else SFX.hit(false);
        }
        break;
      }
      case 'cast': {
        const h = M.units.find((x) => x.id === e.id);
        if (near(e.x, e.y)) SFX.cast(e.ab);
        if (e.ab === 'nova') {
          const A2 = h && h.def.abil[e.i];
          fx.ringWave(e.x, e.y, A2 ? A2.r : 5, e.kind === 'tommy' ? '#ffe680' : e.kind === 'gooey' ? '#8fe06a' : '#ffffff', 0.5);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; fx.add({ map: A.emoji(e.emoji), x: e.x, y: 1.2, z: e.y, vx: Math.cos(a) * 9, vz: Math.sin(a) * 9, life: 0.5, size: 0.8, drag: 2, fade: 0.5 }); }
        } else if (e.ab === 'teamShield') {
          for (const v of M.heroes) if (v.team === (h ? h.team : 0) && !v.down) fx.ringWave(v.x, v.y, 2.5, '#7fe8ff', 0.6, 1);
          fx.emojiPop(e.x, e.y, e.emoji, 2, 3.4, 1.2);
        } else if (e.ab === 'zap' && e.chain) {
          for (const c of e.chain) { fx.dotTo(W3(c.fx, c.fy, 1.4), W3(c.x, c.y, 1.2), '#ffe680', 0.15, 0.9); fx.sparkles(c.x, c.y, 4, '#ffe680', 1.2, 2); }
        } else if (e.ab === 'dash') {
          fx.puff(e.x, e.y, 6, '#ffffff', 2.2, 0.4);
        } else if (e.ab === 'shield') {
          const v = M.units.find((x) => x.id === e.target);
          if (v) fx.sparkles(v.x, v.y, 8, '#7fe8ff', 1.4, 2);
        } else if (e.ab === 'combo' || e.ab === 'melee') {
          if (near(e.x, e.y)) fx.word(e.x + Math.cos(h ? h.face : 0) * 1.5, e.y + Math.sin(h ? h.face : 0) * 1.5, e.ab === 'combo' ? 'JAB!' : 'WHACK!', '#ffd400', 1.4, 2.4);
        }
        if (e.i === 3) {
          // heroics get a big word
          fx.word(e.x, e.y, e.name + '!', '#ff9f1c', 3.2, 4);
          st.shake = Math.max(st.shake, 0.25);
        }
        break;
      }
      case 'straight': if (near(e.x, e.y)) fx.word(e.x, e.y, 'POW!', '#ffd400', 1.6, 2.6); break;
      case 'land': {
        fx.ringWave(e.x, e.y, e.r, '#ffd400', 0.5);
        fx.puff(e.x, e.y, 12, '#e8d4a0', 4, 0.5);
        if (e.kind === 'teddy') { fx.emojiPop(e.x, e.y, '🏀', 2.6, 3.5, 1.1); fx.word(e.x, e.y, 'SLAM DUNK!', '#ff9f1c', 3.4, 4.5); }
        else fx.word(e.x, e.y, 'BOOM!', '#ffd400', 2.6, 3.5);
        st.shake = Math.max(st.shake, 0.4);
        if (near(e.x, e.y)) SFX.land();
        break;
      }
      case 'shotHit': if (near(e.x, e.y)) { fx.puff(e.x, e.y, e.big ? 8 : 3, '#ffffff', e.big ? 3 : 1.4, 1); SFX.hit(true); } break;
      case 'pop': {
        popView(e.id, e.x, e.y);
        if (near(e.x, e.y)) { SFX.pop(); if (Math.random() < 0.3) fx.word(e.x, e.y, Math.random() < 0.5 ? 'POP!' : 'BONK!', '#ffd400', 1.4, 2.2); }
        break;
      }
      case 'bonk': {
        fx.popStars(e.x, e.y, 10);
        const h = M.units.find((x) => x.id === e.id);
        if (h) { const v = heroView(h); fx.word(v.root.position.x, v.root.position.z, 'BONK!', '#ff5d6c', 2.4, 3); }
        if (isMe(e.id)) {
          SFX.bonk();
          toast(`${e.kind.toUpperCase()} TAKES A NAP!`, 'oops');
          if (st.players.length === 1) toast(`Call ${NAMES[Kit.roster.buddyFor(st.players[0])]} to wake up!`, 'good');
        } else if (!st.demo && e.team === 1 && near(e.x, e.y, 40)) { SFX.pop(); toast(`BONKED ${M.hero(e.kind).name}!`, 'good'); }
        break;
      }
      case 'boom': {
        const v = views.units.get(e.id);
        if (v) { v.parts.visible = false; v.rubble.visible = true; v.bar.g.visible = false; v.shield.visible = false; }
        fx.puff(e.x, e.y, 18, '#e8e2d4', 5, 1.5);
        fx.popStars(e.x, e.y, 14, 3);
        fx.word(e.x, e.y, e.kind === 'core' ? 'CRUMBS!' : 'CRUMBLE!', '#ffd400', 3.4, 6);
        st.shake = Math.max(st.shake, 0.5);
        SFX.boom();
        if (!st.demo && e.kind !== 'core') {
          const what = e.kind === 'tower' ? 'TOWER' : 'FORT';
          if (mine(e.team)) toast(`OH NO! THEY KNOCKED DOWN OUR ${what}!`, 'oops');
          else toast(`YOU KNOCKED DOWN A ZOMBIE ${what}!`, 'good');
          if (e.kind === 'fort') toast(mine(e.team) ? 'Their minions come out BIG in that lane!' : 'Your minions come out BIG in that lane!', mine(e.team) ? 'oops' : 'good');
        }
        break;
      }
      case 'coreShield': if (!st.demo && e.team === 1) toast('The castle has a shield! Knock down a fort first.', 'oops'); break;
      case 'saved': {
        const h = M.units.find((x) => x.id === e.id);
        if (h) fx.word(h.x, h.y, 'SAVED!', '#18d4ff', 2.2, 3.2);
        SFX.saved();
        if (st.time - st.saveToastAt > 2.5) { st.saveToastAt = st.time; toast(`${NAMES[e.kind]} SAVED YOU!`, 'save'); }
        break;
      }
      case 'buddy': SFX.buddy(); break;
      case 'treat': {
        const host = M.units.find((x) => x.id === e.host);
        if (host) fx.throwTo(e.emoji, W3(e.x, e.y, 1.8), W3(host.x, host.y, 1.8), 0.6, 1.1, 2.5);
        setTimeout(() => SFX.treat(), 0);
        toast(`${e.emoji} ${e.name} FROM ${NAMES[e.kind]}!`, 'good');
        break;
      }
      case 'wake': toast(`${NAMES[e.kind]} WOKE YOU UP!`, 'good'); break;
      case 'awake': if (isMe(e.id)) SFX.wake(); break;
      case 'buddyHit': {
        if (e.kind === 'teddy') { fx.word(e.tx, e.ty, e.act === 'jab' ? 'JAB!' : 'POW!', '#ffd400', 1.3, 2.2); SFX.punch(); }
        else { fx.ringWave(e.x, e.y, 5, '#ffe680', 0.45); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fx.add({ map: A.emoji('✌️'), x: e.x, y: 1.3, z: e.y, vx: Math.cos(a) * 8, vz: Math.sin(a) * 8, life: 0.45, size: 0.7, drag: 2 }); } }
        if (views.buddy) views.buddy.hitAt = st.time;
        break;
      }
      case 'teamUp': {
        fx.emojiPop(e.x, e.y, '✋', 2.4, 3.6, 1.2);
        fx.word(e.x, e.y, e.together ? 'HIGH FIVE!' : 'TEAM-UP!', '#ffd400', 3.2, 4.4);
        for (const h of humans()) { fx.ringWave(h.x, h.y, e.together ? 9 : 7, '#ffd400', 0.6); fx.sparkles(h.x, h.y, 12); }
        SFX.heroic();
        st.shake = Math.max(st.shake, 0.3);
        break;
      }
      case 'nope': {
        SFX.nope();
        if (e.what === 'teamUp') shakeEl($('budBtn'));
        else {
          const h = M.units.find((x) => x.id === e.id);
          if (h && h.human) { const pi = playerIndex(h); const b = abButtons[pi] && abButtons[pi][e.i]; if (b) shakeEl(b); }
        }
        break;
      }
      case 'level': {
        if (st.demo) break;
        if (e.team === 0) {
          SFX.level();
          if (e.level === 10) banner('LEVEL 10!', `HEROIC READY: press ${st.players.length > 1 ? 'R or I' : 'R'}`);
          else toast(`TEAM TT: LEVEL ${e.level}!`, 'good');
          for (const h of humans()) fx.sparkles(h.x, h.y, 10, '#ffe680', 2);
        } else if (e.level === 10) toast('The zombies are level 10 too!', 'oops');
        break;
      }
      case 'talent': if (!st.demo) { toast('LEVEL UP! PICK A TALENT', 'good'); } break;
      case 'picked': {
        const h = M.units.find((x) => x.id === e.id);
        if (h && h.human) { const tal = S.TALENTS[e.tier].find((x) => x.id === e.talent); fx.emojiPop(h.x, h.y, tal.emoji, 1.4, 3.4); SFX.level(); }
        break;
      }
      case 'objSoon': if (!st.demo) toast(`${OBJ_EMOJI[e.kind]} ${OBJ_NAME[e.kind]} SOON!`, 'good'); break;
      case 'objUp': {
        if (st.demo) break;
        SFX.horn();
        banner(`${OBJ_EMOJI[e.kind]} ${OBJ_NAME[e.kind]}!`, 'Go to the middle and stand next to it!');
        break;
      }
      case 'objWon': {
        fx.sparkles(e.x, e.y, 24, e.team === 0 ? '#9fd0ff' : '#ffb0bc', 3, 5);
        if (st.demo) break;
        SFX.capture(e.team === 0);
        if (e.team === 0) banner(e.kind === 'ball' ? 'GOLDEN SLAM!' : 'PEACE PARADE!', e.kind === 'ball' ? 'Golden balls bonk the zombie towers!' : 'A giant teddy bear marches with you!');
        else banner(e.kind === 'ball' ? 'OH NO!' : 'OH NO!', e.kind === 'ball' ? 'The zombies got the golden ball!' : 'A giant robot marches for the zombies!', true);
        break;
      }
      case 'golden': {
        for (const hit of e.hits) fx.add({ map: A.emoji('🏀'), x: 0, y: 3, z: 0, to: { x: hit.x, y: 5, z: hit.y }, life: 1.2, size: 2.2, arc: 12, fade: 0.05, spin: 6 });
        break;
      }
      case 'slam': {
        fx.word(e.x, e.y, 'SLAM!', '#ffd400', 3.4, 6);
        fx.sparkles(e.x, e.y, 20, '#ffe680', 4, 5);
        fx.puff(e.x, e.y, 12, '#ffe680', 4, 2);
        st.shake = Math.max(st.shake, 0.4);
        SFX.land();
        break;
      }
      case 'champ': if (!st.demo) toast(e.team === 0 ? `A GIANT TEDDY BEAR MARCHES DOWN THE ${e.lane === 'top' ? 'TOP' : 'BOTTOM'} LANE!` : `A GIANT ROBOT MARCHES DOWN THE ${e.lane === 'top' ? 'TOP' : 'BOTTOM'} LANE!`, e.team === 0 ? 'good' : 'oops'); break;
      case 'camp': {
        fx.sparkles(e.x, e.y, 16, e.team === 0 ? '#9fd0ff' : '#ffb0bc', 2, 4);
        if (st.demo) break;
        const who = e.camp === 'bears' ? 'THE BEAR CUBS' : 'THE ROBOT DOGS';
        toast(e.team === 0 ? `${who} JOINED YOUR TEAM!` : `${who} JOINED THE ZOMBIES!`, e.team === 0 ? 'good' : 'oops');
        SFX.capture(e.team === 0);
        break;
      }
      case 'munch': { fx.emojiPop(e.x, e.y, '😋', 1, 2.6, 0.7); if (isMe(e.id)) SFX.munch(); break; }
      case 'heroic': break;
      case 'win': endMatch(e.team); break;
    }
  }
  function drainEvents() {
    const M = st.M;
    if (!M) return;
    for (const e of M.events) handleEvent(e);
    M.events.length = 0;
  }

  // ---------------------------------------------------------------- toasts and banners (run on the game clock)

  function toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    $('toasts').appendChild(el);
    st.toasts.push({ el, t: 0, life: cls === 'save' ? 1.6 : 2.6 });
    while (st.toasts.length > 3) { const o = st.toasts.shift(); o.el.remove(); }
  }
  function updateToasts(dt) {
    const small = innerHeight < 520;
    let y = small ? 72 : 118;
    for (let i = st.toasts.length - 1; i >= 0; i--) {
      const o = st.toasts[i];
      o.t += dt;
      if (o.t > o.life) { o.el.remove(); st.toasts.splice(i, 1); continue; }
    }
    for (const o of st.toasts) {
      const k = Math.min(1, o.t / 0.18);
      const s = k < 1 ? 0.6 + k * 0.5 : o.t < 0.3 ? 1.1 - (o.t - 0.18) * 0.8 : 1;
      o.el.style.transform = `translate(-50%, ${y}px) scale(${s.toFixed(3)})`;
      o.el.style.opacity = String(o.t > o.life - 0.4 ? (o.life - o.t) / 0.4 : 1);
      y += small ? 24 : 40;
    }
  }
  function banner(text, small, bad) {
    const el = $('banner');
    el.innerHTML = '';
    el.appendChild(document.createTextNode(text));
    if (small) { const s = document.createElement('small'); s.textContent = small; el.appendChild(s); }
    el.classList.toggle('bad', !!bad);
    el.classList.remove('hidden');
    st.banner = { t: 0, life: 2.8 };
  }
  function updateBanner(dt) {
    if (!st.banner) return;
    const b = st.banner, el = $('banner');
    b.t += dt;
    if (b.t > b.life) { el.classList.add('hidden'); st.banner = null; return; }
    const k = Math.min(1, b.t / 0.25);
    el.style.transform = `scale(${(k < 1 ? 0.5 + k * 0.6 : 1.1 - Math.min(0.1, (b.t - 0.25) * 0.4)).toFixed(3)})`;
    el.style.opacity = String(b.t > b.life - 0.4 ? (b.life - b.t) / 0.4 : 1);
  }
  function shakeEl(el) {
    el.classList.remove('no');
    void el.offsetWidth;
    el.classList.add('no');
    setTimeout(() => el.classList.remove('no'), 320);
  }

  // ---------------------------------------------------------------- HUD

  const abButtons = [[], []];
  function setupHud() {
    const two = st.players.length > 1;
    document.body.classList.toggle('two', two);
    st.players.forEach((kind, pi) => {
      const card = $('pc' + pi);
      card.classList.remove('hidden');
      card.classList.toggle('tm', kind === 'tommy');
      card.querySelector('img').src = faces[kind];
      card.querySelector('.n').textContent = NAMES[kind];
      const H = S.HEROES[kind];
      card.querySelector('.role').textContent = ROLE[H.role];
      const row = card.querySelector('.abil');
      row.innerHTML = '';
      abButtons[pi] = H.abil.map((ab, i) => {
        const b = document.createElement('button');
        b.className = 'ab' + (i === 3 ? ' heroic' : '');
        b.title = ab.name;
        b.innerHTML = `<span class="e"></span><kbd></kbd><span class="lock">LV 10</span>`;
        b.querySelector('.e').textContent = ab.emoji;
        b.querySelector('kbd').textContent = two ? KEYCAPS[pi][i] : KEYCAPS[0][i];
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); press(pi, i); });
        row.appendChild(b);
        return b;
      });
    });
    if (!two) $('pc1').classList.add('hidden');
    const bud = $('budBtn');
    const imgs = bud.querySelectorAll('img');
    bud.classList.toggle('two', two);
    if (two) {
      imgs[0].src = faces.teddy; imgs[1].src = faces.tommy; imgs[1].classList.remove('hidden');
      bud.querySelector('small').textContent = 'TEAM-UP!';
      bud.querySelector('kbd').textContent = 'T';
    } else {
      const b = Kit.roster.buddyFor(st.players[0]);
      imgs[0].src = faces[b]; imgs[1].classList.add('hidden');
      bud.querySelector('small').textContent = `CALL ${NAMES[b]}`;
      bud.querySelector('kbd').textContent = 'T';
    }
    $('tal0').classList.add('hidden');
    $('tal1').classList.add('hidden');
    st.talShown = [-1, -1];
    drawMiniBase();
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };
  function updateHud() {
    const M = st.M;
    if (!M || st.demo) return;
    for (const team of [0, 1]) {
      const T2 = M.teams[team];
      setText($('lv' + team), `LEVEL ${T2.level}`);
      $('xp' + team).style.setProperty('--fill', T2.level >= S.XP.maxLevel ? 1 : (T2.xp / S.XP.need(T2.level)).toFixed(3));
    }
    setText($('clock'), fmt(M.t));
    st.players.forEach((kind, pi) => {
      const h = M.hero(kind);
      const card = $('pc' + pi);
      card.classList.toggle('down', h.down);
      if (h.down) setText(card.querySelector('.zz'), `💤 ${Math.ceil(h.napT)}`);
      const hp = card.querySelector('.hp');
      hp.style.setProperty('--fill', h.down ? 0 : (h.hp / h.maxHp).toFixed(3));
      hp.style.setProperty('--sh', (Math.min(h.shield, h.maxHp) / h.maxHp).toFixed(3));
      const tals = h.talents.map((id) => S.TALENTS.flat().find((x) => x.id === id).emoji).join('');
      setText(card.querySelector('.tals'), tals);
      const lvl = M.teams[h.team].level;
      abButtons[pi].forEach((b, i) => {
        const A2 = h.def.abil[i];
        const locked = i === 3 && lvl < 10;
        b.classList.toggle('locked', locked);
        const cd = h.cds[i] > 0 ? clamp(h.cds[i] / A2.cd, 0, 1) : 0;
        b.style.setProperty('--cd', cd.toFixed(3));
        b.classList.toggle('ready', !locked && cd === 0 && !h.down);
      });
      // talent pick
      const tal = $('tal' + pi);
      if (h.pendingTalent >= 0) {
        if (st.talShown[pi] !== h.pendingTalent) {
          st.talShown[pi] = h.pendingTalent;
          const opts = tal.querySelector('.opts');
          opts.innerHTML = '';
          S.TALENTS[h.pendingTalent].forEach((o, c) => {
            const b = document.createElement('button');
            b.innerHTML = `<span class="e"></span><span class="n"></span><small></small><kbd></kbd>`;
            b.querySelector('.e').textContent = o.emoji;
            b.querySelector('.n').textContent = o.name;
            b.querySelector('small').textContent = o.tip;
            b.querySelector('kbd').textContent = st.players.length > 1 ? (pi ? ['9', '0'][c] : ['1', '2'][c]) : ['1', '2'][c];
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); pickTalent(pi, c); });
            opts.appendChild(b);
          });
          tal.classList.remove('hidden');
        }
      } else if (st.talShown[pi] !== -1) { st.talShown[pi] = -1; tal.classList.add('hidden'); }
    });
    // the companion / team-up button
    const bud = $('budBtn');
    if (st.players.length > 1) {
      const rest = M.teamUp.rest;
      bud.classList.toggle('rest', rest > 0);
      bud.classList.remove('on');
      bud.style.setProperty('--fill', rest > 0 ? (1 - rest / M.lv.teamUpRest).toFixed(3) : 1);
    } else {
      const B = M.buddy;
      bud.classList.toggle('on', !!B && B.phase !== 'out');
      bud.style.setProperty('--fill', B && B.phase !== 'out' ? clamp(B.left / M.lv.buddyVisit, 0, 1).toFixed(3) : 1);
    }
    // the objective
    const O = M.obj, tip = $('objTip');
    if (O.state === 'live') {
      tip.classList.remove('hidden');
      setText($('objText'), `${OBJ_EMOJI[O.kind]} ${O.contested ? 'BOTH TEAMS ARE THERE!' : OBJ_NAME[O.kind] + '!'}`);
      $('objBar').style.setProperty('--a', (O.prog[0] / S.OBJ.capture).toFixed(3));
      $('objBar').style.setProperty('--b', (O.prog[1] / S.OBJ.capture).toFixed(3));
    } else if (O.at <= 20) {
      tip.classList.remove('hidden');
      setText($('objText'), `${OBJ_EMOJI[O.kind]} ${OBJ_NAME[O.kind]} IN ${Math.ceil(O.at)}`);
      $('objBar').style.setProperty('--a', 0);
      $('objBar').style.setProperty('--b', 0);
    } else tip.classList.add('hidden');
    updateObjArrow();
  }
  const v3 = new T.Vector3();
  function updateObjArrow() {
    const O = st.M.obj, el = $('objArrow');
    if (O.state !== 'live' || st.mode !== 'play') { el.classList.add('hidden'); return; }
    v3.set(O.x, 2, O.y).project(camera);
    const w = innerWidth, h = innerHeight;
    const sx = (v3.x * 0.5 + 0.5) * w, sy = (-v3.y * 0.5 + 0.5) * h;
    const m = 60;
    if (sx > m && sx < w - m && sy > m && sy < h - m && v3.z < 1) { el.classList.add('hidden'); return; }
    const cx = w / 2, cy = h / 2;
    let dx = sx - cx, dy = sy - cy;
    if (v3.z > 1) { dx = -dx; dy = -dy; }
    const k = Math.min((w / 2 - m) / Math.abs(dx || 1e-3), (h / 2 - m) / Math.abs(dy || 1e-3));
    el.style.left = `${cx + dx * k}px`;
    el.style.top = `${cy + dy * k}px`;
    el.style.setProperty('--a', `${Math.atan2(dy, dx)}rad`);
    setText($('objArrowE'), OBJ_EMOJI[O.kind]);
    el.classList.remove('hidden');
  }

  // the minimap: lanes and bases drawn once, then buildings, minions, heroes and the objective
  const mini = $('mini'), mg = mini.getContext('2d');
  const miniBase = document.createElement('canvas');
  miniBase.width = 400; miniBase.height = 200;
  const MX = (x) => (x + S.MAP.W / 2) * (400 / S.MAP.W), MY = (y) => (y + S.MAP.H / 2) * (200 / S.MAP.H);
  function drawMiniBase() {
    const g = miniBase.getContext('2d');
    g.fillStyle = '#4f9a3f'; g.fillRect(0, 0, 400, 200);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const id of S.LANES) {
      g.beginPath();
      S.MAP.lanes[id].forEach(([x, y], i) => (i ? g.lineTo(MX(x), MY(y)) : g.moveTo(MX(x), MY(y))));
      g.strokeStyle = '#e8cf95'; g.lineWidth = 16; g.stroke();
    }
    g.fillStyle = 'rgba(169,211,245,0.8)'; g.beginPath(); g.arc(MX(-57), MY(0), 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(242,179,192,0.8)'; g.beginPath(); g.arc(MX(57), MY(0), 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e7d7a8'; g.beginPath(); g.arc(MX(0), MY(0), 16, 0, Math.PI * 2); g.fill();
  }
  function drawMini() {
    const M = st.M;
    mg.drawImage(miniBase, 0, 0);
    for (const c of M.camps) {
      mg.fillStyle = c.state === 'ready' ? '#ffd400' : 'rgba(255,255,255,0.35)';
      mg.beginPath(); mg.arc(MX(c.x), MY(c.y), 8, 0, Math.PI * 2); mg.fill();
    }
    for (const u of M.units) {
      if (!u.alive || u.hero) continue;
      if (u.type === 'struct') {
        const s = u.kind === 'core' ? 22 : u.kind === 'fort' ? 16 : 12;
        mg.fillStyle = A.TEAM[u.team]; mg.strokeStyle = '#fff'; mg.lineWidth = 3;
        mg.fillRect(MX(u.x) - s / 2, MY(u.y) - s / 2, s, s); mg.strokeRect(MX(u.x) - s / 2, MY(u.y) - s / 2, s, s);
      } else if (u.team !== 2) {
        mg.fillStyle = u.team === 0 ? '#bfe0ff' : '#ffb0bc';
        const s = u.champ ? 14 : 6;
        mg.fillRect(MX(u.x) - s / 2, MY(u.y) - s / 2, s, s);
      }
    }
    if (M.obj.state === 'live') {
      mg.font = '28px ' + G.EMOJI_FONT; mg.textAlign = 'center'; mg.textBaseline = 'middle';
      mg.fillText(OBJ_EMOJI[M.obj.kind], MX(0), MY(0) + 2);
    }
    for (const h of M.heroes) {
      if (h.down) continue;
      const me = h.human && !st.demo;
      mg.fillStyle = me ? '#ffd400' : A.TEAM[h.team];
      mg.strokeStyle = me ? '#14121f' : '#ffffff'; mg.lineWidth = 3;
      mg.beginPath(); mg.arc(MX(h.x), MY(h.y), me ? 11 : 8, 0, Math.PI * 2); mg.fill(); mg.stroke();
    }
    // what the camera sees
    mg.strokeStyle = 'rgba(255,255,255,0.85)'; mg.lineWidth = 3;
    const vw = 19 * st.cam.f * Math.max(1, camera.aspect / 1.6), vh = 11 * st.cam.f;
    mg.strokeRect(MX(st.cam.x - vw), MY(st.cam.z - vh), (vw * 2 * 400) / S.MAP.W, (vh * 2 * 200) / S.MAP.H);
  }

  // ---------------------------------------------------------------- camera

  function updateCamera(dt) {
    const M = st.M;
    let tx = st.cam.x, tz = st.cam.z, f = 1;
    if (st.demo || !M) {
      tx = Math.sin(st.time * 0.06) * 42;
      tz = Math.sin(st.time * 0.045) * 10;
      f = 1.6;
    } else if (st.mode === 'end' && st.endFocus) {
      tx = st.endFocus.x; tz = st.endFocus.y; f = 1.1;
    } else {
      const hs = humans();
      const up = hs.filter((h) => !h.down);
      const use = up.length ? up : hs;
      tx = use.reduce((s, h) => s + h.x, 0) / use.length;
      tz = use.reduce((s, h) => s + h.y, 0) / use.length;
      if (use.length > 1) {
        const sp = Math.hypot(use[0].x - use[1].x, (use[0].y - use[1].y) * 1.6);
        f = clamp(0.85 + sp / 26, 1, 3);
      }
      tz -= 1.5; // keep the hero a little below the middle, under the toasts
    }
    tx = clamp(tx, -54, 54);
    tz = clamp(tz, -24, 24);
    const k = 1 - Math.exp(-5 * dt);
    st.cam.x = lerp(st.cam.x, tx, k);
    st.cam.z = lerp(st.cam.z, tz, k);
    st.cam.f = lerp(st.cam.f, f, 1 - Math.exp(-2.5 * dt));
    // narrow screens (phones held upright) need to stand further back
    const narrow = camera.aspect < 1.4 ? Math.pow(1.4 / camera.aspect, 0.8) : 1;
    const F = st.cam.f * narrow;
    let sx = 0, sz = 0;
    if (st.shake > 0) { st.shake = Math.max(0, st.shake - dt); const s = st.shake * 0.8; sx = G.rand(-s, s); sz = G.rand(-s, s); }
    camera.position.set(st.cam.x + sx, 21 * F, st.cam.z + 15 * F + sz);
    camera.lookAt(st.cam.x + sx, 0, st.cam.z + sz - 0.5);
  }

  // ---------------------------------------------------------------- the match

  function setMode(m) {
    st.mode = m;
    document.body.dataset.mode = m;
  }
  function show(id) {
    for (const s of ['title', 'pause', 'end']) $(s).classList.toggle('hidden', s !== id);
  }
  function newMatch(players, level, demo) {
    clearViews();
    st.M = S.newMatch({ level, humans: demo ? [] : players, seed: (Date.now() % 100000) + 1 });
    st.demo = !!demo;
    st.endAt = 0;
    st.endFocus = null;
    st.acc = 0;
    st.toasts.forEach((o) => o.el.remove());
    st.toasts.length = 0;
    st.banner = null;
    $('banner').classList.add('hidden');
    for (const u of st.M.units) if (u.type === 'struct') unitView(u);
    for (const h of st.M.heroes) heroView(h);
    const hs = demo ? [] : humans();
    if (hs.length) { st.cam.x = hs[0].x + 8; st.cam.z = hs[0].y; }
  }
  function startDemo() {
    newMatch([], 'easy', true);
    st.M.obj.at = 30;
  }
  function startGame(players, opts = {}) {
    Kit.sound.init();
    st.players = players.slice();
    if (opts.level) st.level = opts.level;
    settings.level = st.level;
    settings.lastPlayers = st.players;
    saveSettings();
    newMatch(st.players, st.level, false);
    st.stick = [null, null];
    st.hold = [];
    for (const s of ['stick0', 'stick1']) $(s).classList.remove('on');
    setupHud();
    $('hud').classList.remove('hidden');
    show(null);
    setMode('play');
    Kit.sound.music('play');
    SFX.fanfare();
    banner('KNOCK DOWN THE COOKIE CASTLE!', 'Walk down a lane with your minions. You hit by yourself!');
  }
  function endMatch(winner) {
    if (st.demo) { startDemo(); return; }
    st.toasts.forEach((o) => o.el.remove());
    st.toasts.length = 0;
    st.endAt = st.time + 3.6;
    const core = st.M.teams[winner ^ 1].core;
    st.endFocus = { x: core.x, y: core.y };
    setMode('end');
    if (winner === 0) {
      banner('YOU WIN!', 'The zombies\' cookie castle is crumbs!');
      SFX.win();
      for (let i = 0; i < 40; i++) fx.add({ map: A.emoji(G.pick(['🎉', '⭐', '🍪', '🎊'])), x: core.x + G.rand(-8, 8), y: G.rand(8, 14), z: core.y + G.rand(-6, 6), vy: -2, g: 2, life: 3.4, size: G.rand(0.8, 1.4), spin: G.rand(-3, 3), fade: 0.3 });
      for (const h of st.M.heroes) if (h.team === 0 && !h.down) { h.act = h.kind === 'tommy' ? 'peace' : h.kind === 'teddy' ? 'jumpshot' : 'wave'; h.actT = 4; }
    } else {
      banner('OH NO!', 'The zombies got our cookie castle!', true);
      SFX.lose();
    }
  }
  function showEnd() {
    const M = st.M, win = M.winner === 0;
    setMode('over');
    $('hud').classList.add('hidden');
    $('endEmoji').textContent = win ? '🏆' : '🍪';
    $('endTitle').textContent = win ? 'YOU WIN!' : 'OH NO!';
    $('endSub').textContent = win ? 'You knocked down the zombies\' cookie castle!' : 'The zombies munched our cookie castle. Try again!';
    const lost = (team) => M.units.length && 5 - M.units.filter((u) => u.type === 'struct' && u.team === team && u.alive).length;
    const rows = [
      ['', 'TEAM TT', 'ZOMBIES'],
      ['⏱️ time', fmt(M.t), ''],
      ['⭐ level', M.teams[0].level, M.teams[1].level],
      ['💥 bonks', M.stats.bonks[0], M.stats.bonks[1]],
      ['🏰 buildings knocked down', lost(1), lost(0)],
      ['🏀 objectives', M.teams[0].objs, M.teams[1].objs],
      ['🐻 critter camps', M.teams[0].camps, M.teams[1].camps],
    ];
    if (st.players.length === 1) rows.push([`🛡️ saves by ${NAMES[Kit.roster.buddyFor(st.players[0])]}`, M.stats.saves, '']);
    const tally = $('tally');
    tally.innerHTML = '';
    rows.forEach((r, i) => r.forEach((c, j) => {
      const el = document.createElement('span');
      el.textContent = String(c);
      if (i === 0) el.className = 'h' + (j ? ' t' + (j - 1) : '');
      tally.appendChild(el);
    }));
    show('end');
    Kit.sound.music('over');
  }
  function pause() {
    if (st.mode !== 'play') return;
    setMode('pause');
    show('pause');
    Kit.sound.music('pause');
  }
  function resume() {
    if (st.mode !== 'pause') return;
    setMode('play');
    show(null);
    Kit.sound.music('play');
  }
  function toMenu() {
    $('hud').classList.add('hidden');
    startDemo();
    setMode('title');
    show('title');
    refreshTitle();
    Kit.sound.music('title');
  }

  // ---------------------------------------------------------------- input

  const keys = new Set();
  function press(pi, i) {
    const M = st.M;
    if (st.mode !== 'play' || !M) return;
    const h = M.hero(st.players[pi]);
    if (!h) return;
    M.input[h.kind].cast[i] = true;
    const b = abButtons[pi][i];
    if (b) { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 120); }
  }
  function pickTalent(pi, c) {
    const M = st.M;
    if (!M || st.mode !== 'play') return;
    const h = M.hero(st.players[pi]);
    if (h && h.pendingTalent >= 0) M.pickTalent(h, c);
  }
  function callBuddy(pi = 0) {
    const M = st.M;
    if (!M || st.mode !== 'play') return;
    const bud = $('budBtn');
    bud.classList.add('down');
    setTimeout(() => bud.classList.remove('down'), 140);
    if (st.players.length > 1) M.teamUp.go(M.hero(st.players[pi]));
    else M.callBuddy(M.hero(st.players[0]));
  }
  const has = (codes) => codes.some((c) => keys.has(c));
  function readInput() {
    const M = st.M;
    if (!M || st.demo) return;
    st.players.forEach((kind, pi) => {
      const sets = st.players.length > 1 ? [KEYSETS[pi]] : KEYSETS;
      let mx = 0, my = 0;
      for (const K of sets) {
        mx += (has(K.right) ? 1 : 0) - (has(K.left) ? 1 : 0);
        my += (has(K.down) ? 1 : 0) - (has(K.up) ? 1 : 0);
      }
      const s = st.stick[st.players.length > 1 ? pi : 0];
      if (s && (st.players.length > 1 || pi === 0)) { mx += s.dx; my += s.dy; }
      if (st.hold && st.hold[pi]) { mx += st.hold[pi].mx || 0; my += st.hold[pi].my || 0; } // game.input() from a test
      const l = Math.hypot(mx, my);
      if (l > 1) { mx /= l; my /= l; }
      const inp = M.input[kind];
      inp.mx = mx;
      inp.my = my;
    });
  }
  addEventListener('keydown', (e) => {
    if (e.repeat && !/^Arrow|^Key[WASD]$/.test(e.code)) return;
    const c = e.code;
    if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault();
    if (st.mode === 'title') {
      Kit.sound.init();
      if (c === 'Digit1') startGame(['teddy']);
      else if (c === 'Digit2') startGame(['tommy']);
      else if (c === 'Digit3') startGame(['teddy', 'tommy']);
      else if (c === 'KeyE') { st.level = st.level === 'easy' ? 'normal' : 'easy'; settings.level = st.level; saveSettings(); refreshTitle(); }
      else if (c === 'Enter') startGame(settings.lastPlayers || ['teddy']);
      else if (c === 'KeyM') toggleMute();
      return;
    }
    if (st.mode === 'pause') {
      if (c === 'KeyP' || c === 'Escape' || c === 'Space') resume();
      else if (c === 'KeyR') startGame(st.players);
      else if (c === 'KeyQ') toMenu();
      else if (c === 'KeyM') toggleMute();
      return;
    }
    if (st.mode === 'over') {
      if (c === 'Enter' || c === 'Space') startGame(st.players);
      else if (c === 'Escape') toMenu();
      return;
    }
    if (st.mode !== 'play') return;
    keys.add(c);
    if (c === 'KeyP' || c === 'Escape') { pause(); return; }
    if (c === 'KeyM') { toggleMute(); return; }
    const two = st.players.length > 1;
    KEYSETS.forEach((K, ki) => {
      const pi = two ? ki : 0;
      K.ab.forEach((code, i) => { if (code === c) press(pi, i); });
      if (K.bud.includes(c)) callBuddy(pi);
      K.tal.forEach((code, ch) => { if (code === c) pickTalent(pi, ch); });
    });
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  // touch: a joystick under your thumb (the left half; with two players, each player's own half)
  canvas.addEventListener('pointerdown', (e) => {
    if (st.mode !== 'play') return;
    const two = st.players.length > 1;
    let pi = 0;
    if (two) pi = e.clientX < innerWidth / 2 ? 0 : 1;
    else if (e.clientX > innerWidth * 0.55 && e.pointerType !== 'mouse') return;
    if (st.stick[pi]) return;
    st.stick[pi] = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
    const el = $('stick' + pi);
    el.style.left = `${e.clientX}px`;
    el.style.top = `${e.clientY}px`;
    el.classList.add('on');
    el.querySelector('i').style.transform = '';
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    Kit.sound.init();
  });
  function moveStick(e) {
    for (let pi = 0; pi < 2; pi++) {
      const s = st.stick[pi];
      if (!s || s.id !== e.pointerId) continue;
      let dx = e.clientX - s.x, dy = e.clientY - s.y;
      const l = Math.hypot(dx, dy), R = 50;
      if (l > R) { dx *= R / l; dy *= R / l; }
      s.dx = l > 8 ? dx / R : 0;
      s.dy = l > 8 ? dy / R : 0;
      $('stick' + pi).querySelector('i').style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }
  function endStick(e) {
    for (let pi = 0; pi < 2; pi++) {
      const s = st.stick[pi];
      if (!s || s.id !== e.pointerId) continue;
      st.stick[pi] = null;
      $('stick' + pi).classList.remove('on');
    }
  }
  canvas.addEventListener('pointermove', moveStick);
  canvas.addEventListener('pointerup', endStick);
  canvas.addEventListener('pointercancel', endStick);
  $('budBtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // with two players on an iPad, whoever's side the button is pressed from calls the team-up (both do the same thing)
    callBuddy(st.players.length > 1 && e.clientX > innerWidth / 2 ? 1 : 0);
  });

  function toggleMute() {
    Kit.sound.toggleMute();
    for (const b of document.querySelectorAll('.muteBtn')) b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
  }
  for (const b of document.querySelectorAll('.muteBtn')) {
    b.textContent = Kit.sound.isMuted() ? '🔇' : '🔊';
    b.addEventListener('click', () => { Kit.sound.init(); toggleMute(); });
  }
  $('pauseBtn').addEventListener('click', pause);
  $('resumeBtn').addEventListener('click', resume);
  $('restartBtn').addEventListener('click', () => startGame(st.players));
  $('quitBtn').addEventListener('click', toMenu);
  $('againBtn').addEventListener('click', () => startGame(st.players));
  $('endMenuBtn').addEventListener('click', toMenu);

  // ---------------------------------------------------------------- title screen

  function setupTitle() {
    document.title = `${HTT.TITLE} · Teddy & Tommy`;
    $('logoMain').textContent = HTT.TITLE;
    for (const img of document.querySelectorAll('img[data-face]')) img.src = faces[img.dataset.face];
    for (const b of document.querySelectorAll('[data-play]')) {
      b.addEventListener('click', () => {
        const p = b.dataset.play;
        startGame(p === 'both' ? ['teddy', 'tommy'] : [p]);
      });
    }
    for (const b of document.querySelectorAll('[data-level]')) {
      b.addEventListener('click', () => { st.level = b.dataset.level; settings.level = st.level; saveSettings(); refreshTitle(); });
    }
  }
  function refreshTitle() {
    for (const b of document.querySelectorAll('[data-level]')) b.setAttribute('aria-checked', String(b.dataset.level === st.level));
  }

  // ---------------------------------------------------------------- layout and the loop

  function layout() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function tick(dt) {
    st.time += dt;
    const M = st.M;
    const running = st.mode === 'play' || st.mode === 'title' || st.mode === 'end';
    if (M && running) {
      readInput();
      st.acc += dt;
      let n = 0;
      while (st.acc >= DT && n < 6) { M.tick(DT); st.acc -= DT; n++; drainEvents(); }
      if (n === 6) st.acc = 0;
      if (st.demo && (M.over || M.t > 240)) startDemo();
    }
    if (st.mode === 'end' && st.time >= st.endAt) showEnd();
    syncViews(dt);
    fx.update(dt);
    map.children.forEach((c) => { if (c.userData.flag) c.rotation.y = Math.sin(st.time * 3 + c.position.x) * 0.25; });
    updateCamera(dt);
    if (st.mode === 'play') {
      updateHud();
      if (st.time >= st.miniAt) { st.miniAt = st.time + 0.15; drawMini(); }
    }
    updateToasts(dt);
    updateBanner(dt);
  }
  function render() {
    renderer.render(scene, camera);
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!st.frozen) tick(dt);
    render();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!st.keepAwake) { pause(); Kit.sound.suspend(); }
    } else Kit.sound.resume();
  });
  addEventListener('resize', layout);
  addEventListener('orientationchange', () => setTimeout(layout, 200));
  const firstGesture = () => { Kit.sound.init(); if (st.mode === 'title') Kit.sound.music('title'); };
  addEventListener('pointerdown', firstGesture, { once: true });
  addEventListener('keydown', firstGesture, { once: true });

  // ---------------------------------------------------------------- start

  setupTitle();
  drawMiniBase();
  $('loading').remove();
  startDemo();
  setMode('title');
  show('title');
  refreshTitle();
  layout();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks

  window.game = {
    // advance the game by `seconds` and draw (the Browser pane throttles animation while hidden)
    step(seconds = 1 / 60) {
      let n = Math.max(1, Math.round(seconds / DT));
      while (n-- > 0) tick(DT);
      render();
      return game.state();
    },
    // start a match: { players: ['teddy'] | ['tommy'] | ['teddy', 'tommy'], level: 'easy' | 'normal' }
    start(o = {}) { startGame(o.players || ['teddy'], o); return game.state(); },
    state() {
      const M = st.M;
      if (!M) return { mode: st.mode };
      return {
        mode: st.mode, demo: st.demo, level: M.level, t: +M.t.toFixed(1), over: M.over, winner: M.winner,
        teams: M.teams.map((x) => ({ level: x.level, xp: Math.round(x.xp), bonks: x.bonks, camps: x.camps, objs: x.objs })),
        players: humans().map((h) => ({ kind: h.kind, x: +h.x.toFixed(1), y: +h.y.toFixed(1), hp: Math.round(h.hp), maxHp: Math.round(h.maxHp), down: h.down, nap: +h.napT.toFixed(1), shield: Math.round(h.shield), cds: h.cds.map((c) => +Math.max(0, c).toFixed(1)), talents: h.talents, pending: h.pendingTalent })),
        buddy: M.buddy ? { kind: M.buddy.kind, phase: M.buddy.phase, left: +M.buddy.left.toFixed(1), saves: M.buddy.saves } : null,
        teamUp: +M.teamUp.rest.toFixed(1),
        obj: { state: M.obj.state, kind: M.obj.kind, at: +M.obj.at.toFixed(1), prog: M.obj.prog.map((p) => +p.toFixed(1)) },
        units: M.units.filter((u) => u.alive && !u.hero).length,
        buildings: [0, 1].map((team) => M.units.filter((u) => u.type === 'struct' && u.team === team && u.alive).length),
      };
    },
    sim: () => st.M,
    buddy() { callBuddy(0); return game.state().buddy; },
    teamUp(pi = 0) { callBuddy(pi); return game.state().teamUp; },
    cast(i, pi = 0) { press(pi, i); },
    talent(c, pi = 0) { pickTalent(pi, c); },
    // hold a player's movement: game.input(0, { mx: 1, my: 0 })
    input(pi, o) { st.hold = st.hold || []; st.hold[pi] = o && (o.mx || o.my) ? o : null; },
    xp(n = 500, team = 0) { st.M.giveXp(team, n); },
    obj(kind = 'ball') { const O = st.M.obj; O.kind = kind; O.at = 0.01; O.state = 'wait'; },
    win(team = 0) { const c = st.M.teams[team ^ 1].core; for (const u of st.M.units) if (u.type === 'struct' && u.team === (team ^ 1) && u.kind === 'fort') st.M.hurt(u, 1e7, null); st.M.hurt(c, 1e8, null); },
    autopilot(on = true) { if (st.M) st.M.autoAll = on; },
    keepAwake(on = true) { st.keepAwake = on; },
    freeze(on = true) { st.frozen = on; },
    // a close look at a point: game.peek(x, y, f) (map coordinates, f = zoom: 0.3 is close); game.peek() to go back
    peek(x, y, f = 0.35) {
      if (x === undefined) { st.peek = null; return; }
      st.cam.x = x; st.cam.z = y; st.cam.f = f;
      const F = f;
      camera.position.set(x, 21 * F, y + 15 * F);
      camera.lookAt(x, 0, y - 0.5);
      render();
    },
    menu: toMenu,
    pause, resume,
    check: () => ({ rules: HTT.check.rules(), sabotage: HTT.check.sabotage() }),
    soak: (o) => HTT.check.soak(o),
    layout,
    st,
  };
})();
