/* Heroes TT: everything you see, built from boxes, balls and canvas textures (no image or model files).
   World x = map x, world z = map y (the top of the map is -z), and y is up. The camera looks down from the +z side.
   Kit people face -z; facing(dx, dy) turns them toward a map direction. */
(function () {
  'use strict';
  const HTT = (window.HTT = window.HTT || {});
  const T = THREE, G = Kit.gfx;
  const INK = '#14121f';
  const TEAM = ['#3f86e8', '#e8435a', '#ffd400']; // brothers' team, zombie team, critters
  const TEAM_L = ['#9fd0ff', '#ffb0bc', '#ffe680'];
  const R = (a, b) => a + Math.random() * (b - a);
  const tex = {};

  // ---------------------------------------------------------------- shared materials and geometry

  const matCache = {};
  function mat(color, o) {
    const key = color + (o ? JSON.stringify(o) : '');
    return matCache[key] || (matCache[key] = G.std(color, o));
  }
  const glow = (color) => mat(color, { emissive: color, emissiveIntensity: 0.8 });
  const geoCache = {};
  const cached = (key, make) => geoCache[key] || (geoCache[key] = make());
  const boxGeo = (w, h, d) => cached(`b${w},${h},${d}`, () => new T.BoxGeometry(w, h, d));
  const sphGeo = (r, a = 16, b = 12) => cached(`s${r},${a},${b}`, () => new T.SphereGeometry(r, a, b));
  const cylGeo = (r1, r2, h, n = 16) => cached(`c${r1},${r2},${h},${n}`, () => new T.CylinderGeometry(r1, r2, h, n));
  const coneGeo = (r, h, n = 12) => cached(`k${r},${h},${n}`, () => new T.ConeGeometry(r, h, n));
  function add(geo, m, x, y, z, parent) {
    const o = new T.Mesh(geo, typeof m === 'string' ? mat(m) : m);
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  }
  const box = (w, h, d, m, x, y, z, parent) => add(boxGeo(w, h, d), m, x, y, z, parent);
  const ball = (r, m, x, y, z, parent) => add(sphGeo(r), m, x, y, z, parent);
  const cyl = (r1, r2, h, m, x, y, z, parent, n) => add(cylGeo(r1, r2, h, n), m, x, y, z, parent);
  const facing = (dx, dy) => Math.atan2(-dx, -dy);

  // ---------------------------------------------------------------- canvas textures

  function sparkleTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 60);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,250,200,0.8)');
    gr.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 10 : 62, a = (i * Math.PI) / 4;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    return G.toTexture(c);
  }
  function ringTexture() {
    const [c, g] = G.makeCanvas(128, 128);
    g.lineWidth = 12;
    g.strokeStyle = '#ffffff';
    g.beginPath();
    g.arc(64, 64, 52, 0, Math.PI * 2);
    g.stroke();
    return G.toTexture(c);
  }
  function shadowTexture() {
    return G.radialTexture(64, [[0, 'rgba(0,0,0,0.45)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]);
  }
  function barTexture(color) {
    const [c, g] = G.makeCanvas(64, 16);
    g.fillStyle = color;
    g.fillRect(0, 0, 64, 16);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 2, 64, 5);
    return G.toTexture(c);
  }

  // A comic starburst with a word in it (BONK!, POP!, SAVED!...), in English or 中文 (Kit.lang, words in js/zh.js).
  const burstCache = {};
  function burstTexture(en, fill = '#ffd400') {
    const word = Kit.lang ? Kit.lang.t(en) : en;
    const key = word + fill;
    if (burstCache[key]) return burstCache[key];
    const [c, g] = G.makeCanvas(256, 256);
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 ? 78 : 120, a = (i * Math.PI) / 12 + 0.1;
      g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.8);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = INK;
    g.stroke();
    let px = word.length > 6 ? 36 : word.length > 5 ? 46 : 58;
    g.font = `${px}px ${G.FONT}`;
    const wide = g.measureText(word).width;
    if (wide > 200) { px = Math.floor((px * 200) / wide); g.font = `${px}px ${G.FONT}`; }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = INK;
    g.strokeText(word, 128, 132);
    g.fillStyle = '#ffffff';
    g.fillText(word, 128, 132);
    return (burstCache[key] = G.toTexture(c));
  }
  const emojiCache = {};
  const emoji = (e) => emojiCache[e] || (emojiCache[e] = G.emojiTexture(e));

  // the map, painted once: grass, sandy lanes, the two bases, the camps and the middle
  function groundTexture(S) {
    const W = 2048, H = 1024, X0 = -72, Y0 = -36, SC = W / 144;
    const [c, g] = G.makeCanvas(W, H);
    const px = (x) => (x - X0) * SC, py = (y) => (y - Y0) * SC;
    g.fillStyle = '#5f9e44';
    g.fillRect(0, 0, W, H);
    // the play area
    g.fillStyle = '#79bf55';
    G.roundRect(g, px(-S.MAP.W / 2), py(-S.MAP.H / 2), S.MAP.W * SC, S.MAP.H * SC, 60);
    g.fill();
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(30,70,20,0.07)';
      g.beginPath();
      g.arc(Math.random() * W, Math.random() * H, R(6, 26), 0, Math.PI * 2);
      g.fill();
    }
    // the bases
    for (const [team, col] of [[0, '#a9d3f5'], [1, '#f2b3c0']]) {
      const sp = S.MAP.spawn[team];
      g.fillStyle = col;
      g.beginPath();
      g.arc(px(sp.x + (team ? -3 : 3)), py(0), 13 * SC, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 6;
      for (let r = 4; r < 13; r += 3) { g.beginPath(); g.arc(px(sp.x + (team ? -3 : 3)), py(0), r * SC, 0, Math.PI * 2); g.stroke(); }
    }
    // the lanes: a sandy path with a darker edge and little stones
    for (const id of S.LANES) {
      const pts = S.MAP.lanes[id];
      const path = () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(px(x), py(y)) : g.moveTo(px(x), py(y)))); };
      g.lineJoin = 'round';
      g.lineCap = 'round';
      path(); g.strokeStyle = '#c99d5a'; g.lineWidth = 8.2 * SC; g.stroke();
      path(); g.strokeStyle = '#ecd29a'; g.lineWidth = 7 * SC; g.stroke();
      g.setLineDash([2 * SC, 3 * SC]);
      path(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.5 * SC; g.stroke();
      g.setLineDash([]);
    }
    // the middle (where the Golden Basketball and the Peace Shrine appear)
    g.fillStyle = '#e7d7a8';
    g.beginPath(); g.arc(px(0), py(0), 6.2 * SC, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c9b27a'; g.lineWidth = 8; g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle = i % 2 ? '#f5e7bd' : '#dcc58e';
      g.beginPath(); g.moveTo(px(0), py(0)); g.arc(px(0), py(0), 5.6 * SC, a, a + Math.PI / 6); g.closePath(); g.fill();
    }
    // camp clearings
    for (const cp of S.MAP.camps) {
      g.fillStyle = '#b48a55';
      g.beginPath(); g.ellipse(px(cp.x), py(cp.y), 4.2 * SC, 3.4 * SC, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c99e66';
      g.beginPath(); g.ellipse(px(cp.x), py(cp.y), 3.2 * SC, 2.5 * SC, 0, 0, Math.PI * 2); g.fill();
    }
    // flowers
    for (let i = 0; i < 260; i++) {
      const x = R(-62, 62), y = R(-30, 30);
      g.fillStyle = G.pick(['#ffffff', '#ffd400', '#ff8fb1', '#b28dff']);
      g.beginPath(); g.arc(px(x), py(y), R(3, 6), 0, Math.PI * 2); g.fill();
    }
    const t = G.toTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function initTextures() {
    tex.sparkle = sparkleTexture();
    tex.ring = ringTexture();
    tex.shadow = shadowTexture();
    tex.dot = G.dotTexture ? G.dotTexture() : G.glowTexture();
    tex.glow = G.glowTexture();
    tex.bar = [barTexture('#4fd06a'), barTexture('#ff5d6c'), barTexture('#ffd400'), barTexture('#5ab8ff')];
    tex.barBg = barTexture('#1d1a2e');
    tex.shieldBar = barTexture('#ffffff');
  }

  // ---------------------------------------------------------------- the map

  function nearLane(S, x, y, m) {
    for (const id of S.LANES) {
      const d = S.laneProj(id, x, y);
      const p = S.lanePoint(id, d);
      if (Math.hypot(p.x - x, p.y - y) < m) return true;
    }
    return false;
  }
  function tree(parent, x, z, s) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    cyl(0.25, 0.32, 1.4, '#8a5a32', 0, 0.7, 0, g, 8);
    const leaf = G.pick(['#3f9a3a', '#4bb04a', '#2f8a3a', '#5cbf55']);
    if (Math.random() < 0.5) {
      ball(1.2, leaf, 0, 2.2, 0, g);
      ball(0.8, leaf, 0.5, 2.9, 0.2, g);
    } else {
      add(coneGeo(1.3, 2.4, 9), leaf, 0, 2.4, 0, g);
      add(coneGeo(1.0, 1.8, 9), leaf, 0, 3.3, 0, g);
    }
    parent.add(g);
    return g;
  }
  function makeMap(scene, S) {
    const map = new T.Group();
    scene.add(map);
    const ground = new T.Mesh(new T.PlaneGeometry(144, 72), new T.MeshBasicMaterial({ map: groundTexture(S) }));
    ground.rotation.x = -Math.PI / 2;
    map.add(ground);
    const outside = new T.Mesh(new T.PlaneGeometry(600, 400), new T.MeshBasicMaterial({ color: '#4f8a3a' }));
    outside.rotation.x = -Math.PI / 2;
    outside.position.y = -0.02;
    map.add(outside);
    // a white picket fence round the edge
    const W = S.MAP.W / 2 + 1, H = S.MAP.H / 2 + 1;
    const fence = mat('#fff7e6');
    for (let x = -W; x <= W; x += 2) { box(0.25, 1.1, 0.25, fence, x, 0.55, -H, map); box(0.25, 1.1, 0.25, fence, x, 0.55, H, map); }
    for (let z = -H; z <= H; z += 2) { box(0.25, 1.1, 0.25, fence, -W, 0.55, z, map); box(0.25, 1.1, 0.25, fence, W, 0.55, z, map); }
    box(W * 2, 0.18, 0.12, fence, 0, 0.75, -H, map); box(W * 2, 0.18, 0.12, fence, 0, 0.75, H, map);
    box(0.12, 0.18, H * 2, fence, -W, 0.75, 0, map); box(0.12, 0.18, H * 2, fence, W, 0.75, 0, map);
    // trees outside, and a few inside where nobody walks
    for (let i = 0; i < 70; i++) {
      const side = i % 4;
      const x = side < 2 ? R(-W - 10, W + 10) : side === 2 ? R(-W - 12, -W - 2) : R(W + 2, W + 12);
      const z = side === 0 ? R(-H - 9, -H - 2) : side === 1 ? R(H + 2, H + 9) : R(-H - 6, H + 6);
      tree(map, x, z, R(1, 1.6));
    }
    for (let i = 0; i < 120; i++) {
      const x = R(-40, 40), y = R(-30, 30);
      if (nearLane(S, x, y, 6.5) || Math.hypot(x, y) < 9 || S.MAP.camps.some((c) => Math.hypot(c.x - x, c.y - y) < 6.5)) continue;
      if (Math.abs(y) < 14 && Math.abs(x) < 30) { // the middle: bushes, not trees, so fights can go through
        const b = ball(R(0.6, 1), G.pick(['#3f9a3a', '#4bb04a']), x, 0.4, y, map);
        b.scale.y = 0.7;
        continue;
      }
      tree(map, x, y, R(0.8, 1.2));
    }
    // each base: a fountain and the nap beds
    for (const team of [0, 1]) {
      const sp = S.MAP.spawn[team];
      const fx = sp.x + (team ? 4.5 : -4.5);
      cyl(2.4, 2.6, 0.7, '#d7dde6', fx, 0.35, 0, map, 24);
      const water = cyl(2.1, 2.1, 0.1, mat('#5ab8ff', { emissive: '#2a7fd0', emissiveIntensity: 0.4 }), fx, 0.7, 0, map, 24);
      water.userData.water = true;
      cyl(0.35, 0.45, 1.6, '#d7dde6', fx, 1.3, 0, map, 10);
      ball(0.55, mat('#9fe0ff', { emissive: '#5ab8ff', emissiveIntensity: 0.6 }), fx, 2.2, 0, map);
      for (let i = 0; i < 5; i++) bed(map, sp.x + (team ? -1.5 : 1.5), (i - 2) * 2.2, team);
      // a big team flag
      cyl(0.08, 0.08, 4.5, '#ffffff', fx, 2.25, -3.5, map, 6);
      const flag = box(1.6, 1, 0.06, TEAM[team], fx + (team ? -0.8 : 0.8), 4, -3.5, map);
      flag.userData.flag = true;
    }
    // camp dens
    for (const cp of S.MAP.camps) {
      if (cp.kind === 'cub') {
        const den = add(sphGeo(2.2, 14, 8), '#8a6a45', cp.x, 0, cp.y - 3.6, map);
        den.scale.set(1.2, 0.8, 0.8);
        box(1.2, 1.1, 0.3, '#3a2a1a', cp.x, 0.55, cp.y - 2.1, map);
      } else {
        box(3, 1.6, 2, '#9aa3ad', cp.x, 0.8, cp.y + 3.6, map);
        add(coneGeo(2.2, 1.2, 4), '#6c4ad8', cp.x, 2.2, cp.y + 3.6, map).rotation.y = Math.PI / 4;
        box(1, 1, 0.2, '#22242a', cp.x, 0.5, cp.y + 2.55, map);
      }
    }
    return map;
  }
  function bed(parent, x, z, team) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    box(2.2, 0.35, 1.3, '#a0703f', 0, 0.2, 0, g);
    box(2.1, 0.2, 1.2, '#ffffff', 0, 0.45, 0, g);
    box(1.3, 0.16, 1.22, TEAM_L[team], team ? -0.4 : 0.4, 0.58, 0, g);
    box(0.5, 0.22, 0.9, '#fff7e6', team ? 0.75 : -0.75, 0.62, 0, g);
    box(0.15, 0.7, 1.3, '#a0703f', team ? 1.05 : -1.05, 0.5, 0, g);
    parent.add(g);
  }

  // ---------------------------------------------------------------- health bars (sprites that face the camera)

  function makeBar(width, kind) {
    const g = new T.Group();
    const bg = new T.Sprite(new T.SpriteMaterial({ map: tex.barBg, depthWrite: false, depthTest: false }));
    const fill = new T.Sprite(new T.SpriteMaterial({ map: tex.bar[kind], depthWrite: false, depthTest: false }));
    const sh = new T.Sprite(new T.SpriteMaterial({ map: tex.shieldBar, depthWrite: false, depthTest: false }));
    const H = width > 2 ? 0.34 : 0.24;
    bg.scale.set(width + 0.12, H + 0.12, 1);
    fill.center.set(0, 0.5);
    sh.center.set(0, 0.5);
    fill.position.x = sh.position.x = -width / 2;
    fill.scale.set(width, H, 1);
    sh.scale.set(0.001, H, 1);
    bg.renderOrder = 10; fill.renderOrder = 11; sh.renderOrder = 12;
    g.add(bg, fill, sh);
    return {
      g, width, last: -1, lastS: -1,
      set(f, s = 0) {
        f = Math.max(0, Math.min(1, f));
        s = Math.max(0, Math.min(1 - f, s));
        if (f !== this.last) { fill.scale.x = Math.max(0.001, width * f); this.last = f; }
        if (s !== this.lastS) { sh.scale.x = Math.max(0.001, width * s); sh.position.x = -width / 2 + width * f; this.lastS = s; }
      },
      kind(k) { fill.material.map = tex.bar[k]; },
    };
  }

  // ---------------------------------------------------------------- buildings

  function flagOn(g, x, y, z, color) {
    cyl(0.05, 0.05, 1.6, '#ffffff', x, y + 0.8, z, g, 6);
    const f = box(0.9, 0.55, 0.05, color, x + 0.45, y + 1.3, z, g);
    f.userData.flag = true;
    return f;
  }
  function cookie(g, r, x, y, z, upright) {
    const c = cyl(r, r, 0.3, '#d9a35b', x, y, z, g, 20);
    if (upright) c.rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4, d = r * (i % 2 ? 0.55 : 0.3);
      const chip = box(r * 0.18, r * 0.18, r * 0.18, '#4a2a16', 0, 0, 0, g);
      if (upright) chip.position.set(x + Math.cos(a) * d, y + Math.sin(a) * d, z + 0.16);
      else chip.position.set(x + Math.cos(a) * d, y + 0.16, z + Math.sin(a) * d);
    }
    return c;
  }
  // tower, fort or core (the cookie castle). Returns { root, top, shield, parts, rubble }
  function makeStruct(u) {
    const root = new T.Group();
    const parts = new T.Group();
    root.add(parts);
    const team = u.team, col = TEAM[team], light = TEAM_L[team];
    const blockA = team ? '#7d4ad8' : '#3f86e8', blockB = team ? '#6fd04f' : '#ffd400', blockC = team ? '#2b2f3a' : '#ff4b5c';
    let top = 4;
    if (u.kind === 'tower') {
      cyl(1.4, 1.6, 0.5, '#d7dde6', 0, 0.25, 0, parts, 16);
      [blockA, blockB, blockC, blockA].forEach((c, i) => { box(1.5 - i * 0.08, 0.8, 1.5 - i * 0.08, c, 0, 0.9 + i * 0.8, 0, parts).rotation.y = i * 0.3; });
      box(1.8, 0.5, 1.8, '#ffffff', 0, 4.0, 0, parts);
      for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) box(0.4, 0.4, 0.4, col, dx, 4.45, dz, parts);
      if (team) ball(0.45, glow('#ff4b5c'), 0, 4.75, 0, parts);
      else { const hoop = add(new T.TorusGeometry(0.45, 0.07, 6, 16), '#ff7a1a', 0, 4.8, 0.55, parts); hoop.rotation.x = Math.PI / 2; box(0.9, 0.7, 0.08, '#ffffff', 0, 5.1, 0.15, parts); }
      flagOn(parts, 0.6, 4.3, -0.6, col);
      top = 6;
    } else if (u.kind === 'fort') {
      box(4.4, 2.6, 4.4, team ? '#9a8fb0' : '#e8e2d4', 0, 1.3, 0, parts);
      for (let i = -2; i <= 2; i++) {
        box(0.6, 0.6, 0.6, team ? '#7d6f99' : '#d4cbb5', i * 0.95, 2.9, -2.1, parts);
        box(0.6, 0.6, 0.6, team ? '#7d6f99' : '#d4cbb5', i * 0.95, 2.9, 2.1, parts);
        box(0.6, 0.6, 0.6, team ? '#7d6f99' : '#d4cbb5', -2.1, 2.9, i * 0.95, parts);
        box(0.6, 0.6, 0.6, team ? '#7d6f99' : '#d4cbb5', 2.1, 2.9, i * 0.95, parts);
      }
      box(1.3, 1.6, 0.1, '#6b4a2a', 0, 0.8, 2.22, parts);
      for (const [dx, dz] of [[-2.2, -2.2], [2.2, 2.2]]) {
        cyl(0.8, 0.9, 4, light, dx, 2, dz, parts, 12);
        add(coneGeo(1.05, 1.4, 12), col, dx, 4.7, dz, parts);
      }
      flagOn(parts, 0, 2.6, 0, col);
      top = 6.2;
    } else {
      // the cookie castle
      box(5, 3.2, 5, '#e3b06c', 0, 1.6, 0, parts);
      for (let i = 0; i < 18; i++) box(0.3, 0.3, 0.3, '#4a2a16', R(-2.3, 2.3), R(0.4, 3), 2.52 * (Math.random() < 0.5 ? 1 : -1), parts);
      box(5.2, 0.4, 5.2, light, 0, 3.35, 0, parts); // icing
      for (const [dx, dz] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
        cyl(1, 1.1, 4.4, '#e3b06c', dx, 2.2, dz, parts, 14);
        cyl(1.12, 1.12, 0.3, light, dx, 4.4, dz, parts, 14);
        cookie(parts, 1.2, dx, 4.75, dz, false);
      }
      cookie(parts, 1.9, 0, 5.4, 0, true);
      box(1.4, 1.9, 0.1, '#6b4a2a', 0, 0.95, 2.55, parts);
      flagOn(parts, 0, 7.2, 0, col);
      top = 8.6;
    }
    const shield = new T.Mesh(sphGeo(u.r + 2.2, 24, 16), new T.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.16, depthWrite: false }));
    shield.position.y = 1;
    shield.visible = false;
    root.add(shield);
    // rubble for when it's knocked down
    const rubble = new T.Group();
    for (let i = 0; i < 9; i++) {
      const s = R(0.4, 0.9);
      const b = box(s, s * 0.7, s, G.pick([blockA, blockB, '#cfc6b0', u.kind === 'core' ? '#d9a35b' : '#bbb']), R(-u.r, u.r), s * 0.35, R(-u.r, u.r), rubble);
      b.rotation.set(R(0, 1), R(0, 3), R(0, 1));
    }
    rubble.visible = false;
    root.add(rubble);
    root.position.set(u.x, 0, u.y);
    return { root, parts, top, shield, rubble };
  }

  // ---------------------------------------------------------------- minions, critters, champions

  // returns { root, body, legs: [l, r], arms: [l, r], h (height) }
  function makeMinion(kind, team, big) {
    const root = new T.Group();
    const body = new T.Group();
    root.add(body);
    const v = { root, body, legs: [], arms: [], h: 1.4, kind };
    const limb = (w, h, d, c, x, y, z, arr) => { const p = new T.Group(); p.position.set(x, y, z); box(w, h, d, c, 0, -h / 2, 0, p); body.add(p); arr.push(p); return p; };
    if (kind === 'cannon') {
      if (team === 0) {
        box(1.2, 0.5, 1.6, '#a0703f', 0, 0.55, 0, body);
        const barrel = cyl(0.3, 0.38, 1.8, '#2b2f3a', 0, 0.95, -0.4, body, 12);
        barrel.rotation.x = Math.PI / 2 - 0.35;
        ball(0.18, '#ffd400', 0, 1.25, -1.25, body);
      } else {
        box(1.4, 0.7, 1.6, '#6b4a6b', 0, 0.6, 0, body);
        const goo = ball(0.7, mat('#6fd04f', { emissive: '#3a8a2a', emissiveIntensity: 0.3 }), 0, 1.15, 0, body);
        goo.scale.y = 0.7;
        ball(0.12, '#ffffff', -0.2, 1.4, -0.5, body); ball(0.12, '#ffffff', 0.2, 1.4, -0.5, body);
      }
      for (const [dx, dz] of [[-0.75, -0.5], [0.75, -0.5], [-0.75, 0.5], [0.75, 0.5]]) {
        const w = cyl(0.38, 0.38, 0.2, '#5a3a20', dx, 0.38, dz, body, 12);
        w.rotation.z = Math.PI / 2;
        v.legs.push(w);
      }
      v.wheels = true;
      v.h = 1.8;
    } else if (kind === 'cub' || kind === 'dog') {
      const bear = kind === 'cub';
      const c = bear ? '#8b5a2b' : '#9aa3ad', c2 = bear ? '#d9b48a' : '#5a5f6b';
      box(1.0, 0.7, 1.5, c, 0, 0.8, 0, body);
      const head = new T.Group();
      head.position.set(0, 1.25, -0.85);
      body.add(head);
      box(0.8, 0.7, 0.7, c, 0, 0, 0, head);
      box(0.4, 0.3, 0.3, c2, 0, -0.1, -0.4, head);
      box(0.12, 0.12, 0.05, INK, -0.18, 0.12, -0.36, head); box(0.12, 0.12, 0.05, INK, 0.18, 0.12, -0.36, head);
      if (bear) { ball(0.17, c, -0.32, 0.38, 0, head); ball(0.17, c, 0.32, 0.38, 0, head); ball(0.08, INK, 0, -0.05, -0.56, head); }
      else { cyl(0.03, 0.03, 0.5, '#2a2a30', 0.2, 0.55, 0, head, 5); ball(0.09, glow('#5ef2ff'), 0.2, 0.82, 0, head); box(0.14, 0.1, 0.05, glow('#5ef2ff'), -0.18, 0.12, -0.36, head); box(0.14, 0.1, 0.05, glow('#5ef2ff'), 0.18, 0.12, -0.36, head); }
      const tail = box(0.15, 0.15, 0.5, c, 0, 1.0, 0.85, body);
      tail.rotation.x = -0.6;
      v.tail = tail;
      for (const [dx, dz] of [[-0.35, -0.5], [0.35, -0.5], [-0.35, 0.5], [0.35, 0.5]]) limb(0.28, 0.6, 0.28, c, dx, 0.6, dz, v.legs);
      v.head = head;
      v.h = 1.9;
    } else if (kind === 'champ') {
      if (team === 0) {
        // a giant plush teddy bear with a bow tie
        const c = '#c58a4a', c2 = '#f2d2a2';
        ball(1.5, c, 0, 2.4, 0, body).scale.set(1, 1.15, 0.9);
        ball(1.0, c2, 0, 2.3, -0.75, body).scale.set(1, 1.2, 0.5);
        const head = new T.Group();
        head.position.set(0, 4.4, 0);
        body.add(head);
        ball(1.1, c, 0, 0, 0, head);
        ball(0.4, c, -0.85, 0.75, 0, head); ball(0.4, c, 0.85, 0.75, 0, head);
        ball(0.22, '#ff8fb1', -0.85, 0.75, -0.2, head); ball(0.22, '#ff8fb1', 0.85, 0.75, -0.2, head);
        ball(0.45, c2, 0, -0.25, -0.85, head);
        ball(0.15, INK, 0, -0.1, -1.25, head);
        ball(0.13, INK, -0.38, 0.2, -0.95, head); ball(0.13, INK, 0.38, 0.2, -0.95, head);
        box(0.9, 0.5, 0.3, '#ff3d7f', 0, 3.45, -0.95, body);
        v.head = head;
        limb(0.7, 1.4, 0.7, c, -0.75, 1.3, 0, v.legs); limb(0.7, 1.4, 0.7, c, 0.75, 1.3, 0, v.legs);
        limb(0.6, 1.5, 0.6, c, -1.55, 3.2, 0, v.arms); limb(0.6, 1.5, 0.6, c, 1.55, 3.2, 0, v.arms);
      } else {
        // a giant robot
        box(2.6, 2.2, 1.6, '#7d8794', 0, 2.6, 0, body);
        box(1.6, 1.0, 0.1, glow('#ff8a1f'), 0, 2.7, -0.82, body);
        const head = new T.Group();
        head.position.set(0, 4.3, 0);
        body.add(head);
        box(1.6, 1.2, 1.3, '#9aa3ad', 0, 0, 0, head);
        box(0.35, 0.25, 0.1, glow('#ff4b5c'), -0.4, 0.1, -0.66, head); box(0.35, 0.25, 0.1, glow('#ff4b5c'), 0.4, 0.1, -0.66, head);
        cyl(0.05, 0.05, 0.8, '#2a2a30', 0, 1, 0, head, 5); ball(0.15, glow('#ff4b5c'), 0, 1.45, 0, head);
        v.head = head;
        limb(0.8, 1.5, 0.8, '#5a5f6b', -0.7, 1.5, 0, v.legs); limb(0.8, 1.5, 0.8, '#5a5f6b', 0.7, 1.5, 0, v.legs);
        limb(0.6, 1.8, 0.6, '#7d8794', -1.65, 3.6, 0, v.arms); limb(0.6, 1.8, 0.6, '#7d8794', 1.65, 3.6, 0, v.arms);
      }
      v.h = 6;
    } else if (team === 0) {
      // toy soldiers: navy legs, a blue (or red) jacket and a tall black hat with a plume
      const jacket = kind === 'ranged' ? '#e8435a' : '#3f6fd8';
      limb(0.22, 0.55, 0.24, '#1f2a4a', -0.14, 0.55, 0, v.legs); limb(0.22, 0.55, 0.24, '#1f2a4a', 0.14, 0.55, 0, v.legs);
      box(0.6, 0.6, 0.4, jacket, 0, 0.85, 0, body);
      box(0.62, 0.1, 0.42, '#ffd400', 0, 0.62, 0, body);
      box(0.4, 0.38, 0.38, '#efc29c', 0, 1.35, 0, body);
      box(0.06, 0.06, 0.02, INK, -0.09, 1.38, -0.2, body); box(0.06, 0.06, 0.02, INK, 0.09, 1.38, -0.2, body);
      box(0.44, 0.5, 0.42, '#1d1a22', 0, 1.78, 0, body);
      box(0.08, 0.25, 0.08, '#ff4b5c', 0.2, 2.0, 0, body);
      limb(0.16, 0.5, 0.16, jacket, -0.38, 1.1, 0, v.arms); limb(0.16, 0.5, 0.16, jacket, 0.38, 1.1, 0, v.arms);
      if (kind === 'ranged') { const gun = box(0.1, 0.1, 0.6, '#a0703f', 0, -0.5, -0.25, v.arms[1]); gun.userData.gun = true; }
      else box(0.06, 0.06, 0.7, '#cfd6e0', 0, -0.5, -0.3, v.arms[1]);
      v.h = 2.2;
    } else if (kind === 'ranged') {
      // little robots that zap
      limb(0.2, 0.4, 0.2, '#5a5f6b', -0.15, 0.4, 0, v.legs); limb(0.2, 0.4, 0.2, '#5a5f6b', 0.15, 0.4, 0, v.legs);
      box(0.7, 0.6, 0.5, '#9aa3ad', 0, 0.75, 0, body);
      box(0.5, 0.42, 0.42, '#c2c9d2', 0, 1.3, 0, body);
      box(0.32, 0.1, 0.05, glow('#ff5d6c'), 0, 1.33, -0.22, body);
      cyl(0.03, 0.03, 0.4, '#2a2a30', 0, 1.7, 0, body, 5); ball(0.08, glow('#ff5d6c'), 0, 1.92, 0, body);
      limb(0.14, 0.45, 0.14, '#7d8794', -0.42, 0.95, 0, v.arms); limb(0.14, 0.45, 0.14, '#7d8794', 0.42, 0.95, 0, v.arms);
      v.h = 2.1;
    } else {
      // mini zombies (silly, not scary): green, torn purple shirt, arms out in front
      limb(0.22, 0.5, 0.24, '#4a4038', -0.14, 0.5, 0, v.legs); limb(0.22, 0.5, 0.24, '#4a4038', 0.14, 0.5, 0, v.legs);
      box(0.6, 0.6, 0.4, '#6d5a8c', 0, 0.8, 0, body);
      box(0.46, 0.44, 0.42, '#8fbf6a', 0, 1.33, 0, body);
      box(0.1, 0.1, 0.02, '#ffffff', -0.1, 1.38, -0.22, body); box(0.08, 0.08, 0.02, '#ffffff', 0.11, 1.36, -0.22, body);
      box(0.2, 0.05, 0.02, INK, 0, 1.22, -0.22, body);
      box(0.48, 0.12, 0.44, '#2b2f22', 0, 1.6, 0, body);
      const a1 = limb(0.16, 0.5, 0.16, '#8fbf6a', -0.38, 1.05, 0, v.arms), a2 = limb(0.16, 0.5, 0.16, '#8fbf6a', 0.38, 1.05, 0, v.arms);
      a1.rotation.x = a2.rotation.x = 1.4;
      v.zombie = true;
      v.h = 2;
    }
    root.scale.setScalar(kind === 'champ' ? 1 : big ? 1.5 : 1.15);
    return v;
  }
  // a little walk cycle for minions and critters
  function animMinion(v, t, moving, attacking) {
    const s = moving ? Math.sin(t * 10) : 0;
    if (v.wheels) { for (const w of v.legs) w.rotation.x += moving ? 0.15 : 0; return; }
    if (v.legs.length === 4) {
      v.legs[0].rotation.x = v.legs[3].rotation.x = s * 0.6;
      v.legs[1].rotation.x = v.legs[2].rotation.x = -s * 0.6;
      if (v.tail) v.tail.rotation.y = Math.sin(t * 12) * 0.5;
      if (v.head) v.head.position.y = 1.25 + (attacking ? Math.abs(Math.sin(t * 14)) * 0.2 : 0);
      return;
    }
    if (v.legs[0]) { v.legs[0].rotation.x = s * 0.7; v.legs[1].rotation.x = -s * 0.7; }
    if (v.arms[0] && !v.zombie) {
      v.arms[0].rotation.x = -s * 0.5;
      v.arms[1].rotation.x = attacking ? 1.2 + Math.sin(t * 16) * 0.5 : s * 0.5;
    } else if (v.zombie) {
      v.arms[0].rotation.x = 1.4 + Math.sin(t * 6) * 0.15;
      v.arms[1].rotation.x = 1.4 + (attacking ? Math.sin(t * 16) * 0.5 : Math.cos(t * 6) * 0.15);
    }
    v.body.position.y = moving ? Math.abs(s) * 0.08 : 0;
  }

  // ---------------------------------------------------------------- heroes

  const LOOKS = {
    gooey: {
      head: 'human', zombie: true, skin: '#9fd47a', hair: 'ponytail', hairColor: '#3b2a4a', brows: true,
      shirt: 'hoodie', top: '#58c94f', print: 'star', bottom: '#4a3f6b', shoes: '#2b2b2b',
    },
    zippy: {
      head: 'human', zombie: true, skin: '#86c06a', hair: 'short', hairColor: '#2b2f22', hat: 'capBack', hatColor: '#ff8a1f',
      shirt: 'tee', top: '#ffcf3f', print: 'bolt', bottom: '#3d3d55', shorts: true, shoes: '#ff3d7f',
    },
    clank: {
      head: 'robot', skin: '#9aa3ad', eyes: '#ff5d6c',
      shirt: 'jacket', top: '#6c4ad8', print: 'panel', bottom: '#3e4350', shoes: '#22242a',
    },
  };
  function lookFor(kind) {
    if (LOOKS[kind]) return LOOKS[kind];
    const r = Kit.roster.get(kind === 'zombo' ? 'zombie' : kind);
    return r.look;
  }
  // a hero: the Kit person, a team ring under his feet, a health bar and a name tag
  function makeHero(kind, team, name, me) {
    const root = new T.Group();
    const p = Kit.people.build(lookFor(kind));
    root.add(p.root);
    p.root.scale.setScalar(kind === 'bruno' || kind === 'clank' ? 1.38 : 1.25);
    const ring = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ map: tex.ring, color: me ? '#ffd400' : TEAM[team], transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    root.add(ring);
    const bar = makeBar(2, me ? 2 : team);
    bar.g.position.y = 3.35;
    root.add(bar.g);
    const tag = G.nameTag(name, me ? '#ffd400' : TEAM_L[team]);
    tag.scale.set(1.2, 0.38, 1);
    tag.position.y = 3.95;
    tag.material.depthTest = false;
    tag.renderOrder = 12;
    root.add(tag);
    const bubble = new T.Mesh(sphGeo(1.5, 18, 12), new T.MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.28, depthWrite: false }));
    bubble.position.y = 1.35;
    bubble.scale.y = 1.25;
    bubble.visible = false;
    root.add(bubble);
    return { root, p, ring, bar, tag, bubble, kind, team };
  }
  // the visiting brother: smaller (his buddyScale), with a golden ring and his own name tag
  function makeBuddy(kind) {
    const entry = Kit.roster.get(kind);
    const root = new T.Group();
    const p = Kit.people.build(entry.look);
    p.root.scale.setScalar(1.25 * (entry.buddyScale || 0.8)); // heroes here are 1.25 times kit size
    root.add(p.root);
    const ring = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: tex.ring, color: '#ffd400', transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    root.add(ring);
    const tag = G.nameTag(entry.name, entry.tag || '#ffb02e');
    tag.scale.set(1.0, 0.32, 1);
    tag.position.y = 2.4;
    tag.material.depthTest = false;
    tag.renderOrder = 12;
    root.add(tag);
    const halo = new T.Sprite(new T.SpriteMaterial({ map: tex.glow, color: '#ffe680', transparent: true, depthWrite: false, opacity: 0.5 }));
    halo.scale.set(3.2, 3.2, 1);
    halo.position.y = 1;
    root.add(halo);
    return { root, p, ring, tag, halo, kind };
  }

  // ---------------------------------------------------------------- the map objectives

  function makeObjective() {
    const root = new T.Group();
    // the Golden Basketball
    const ballG = new T.Group();
    cyl(1.2, 1.5, 1, '#e7d7a8', 0, 0.5, 0, ballG, 20);
    const gold = new T.Group();
    gold.position.y = 3;
    ballG.add(gold);
    ball(1.4, mat('#ffcf3f', { emissive: '#ff9f1c', emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.35 }), 0, 0, 0, gold);
    for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) {
      const seam = add(new T.TorusGeometry(1.41, 0.05, 6, 32), '#7a4a10', 0, 0, 0, gold);
      seam.rotation.set(rx, ry, 0);
    }
    const sparkle = new T.Sprite(new T.SpriteMaterial({ map: tex.glow, color: '#ffe680', transparent: true, depthWrite: false, opacity: 0.7, blending: T.AdditiveBlending }));
    sparkle.scale.set(6, 6, 1);
    gold.add(sparkle);
    root.add(ballG);
    // the Peace Shrine: a little stone arch with a big ✌️ and a rainbow
    const shrine = new T.Group();
    box(1, 3.4, 1, '#d7d1c4', -1.8, 1.7, 0, shrine); box(1, 3.4, 1, '#d7d1c4', 1.8, 1.7, 0, shrine);
    box(4.8, 0.7, 1.2, '#e8e2d4', 0, 3.6, 0, shrine);
    ['#ff4b5c', '#ff9f1c', '#ffd400', '#4fd06a', '#3f86e8', '#8d5bd8'].forEach((c, i) => {
      const arc = add(new T.TorusGeometry(3.2 - i * 0.22, 0.11, 6, 28, Math.PI), mat(c, { emissive: c, emissiveIntensity: 0.25 }), 0, 3.9, -0.3, shrine);
      arc.userData.rainbow = true;
    });
    const peace = new T.Sprite(new T.SpriteMaterial({ map: emoji('✌️'), transparent: true, depthWrite: false }));
    peace.scale.set(2.2, 2.2, 1);
    peace.position.set(0, 1.9, 0);
    shrine.add(peace);
    root.add(shrine);
    // the capture ring: a canvas redrawn with each team's progress
    const [cv, cg] = G.makeCanvas(256, 256);
    const ringTex = G.toTexture(cv);
    const ring = new T.Mesh(new T.PlaneGeometry(10, 10), new T.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    root.add(ring);
    let last = '';
    function drawRing(p0, p1, contested, t) {
      const key = `${p0.toFixed(2)},${p1.toFixed(2)},${contested},${Math.floor(t * 4) % 2}`;
      if (key === last) return;
      last = key;
      cg.clearRect(0, 0, 256, 256);
      cg.lineWidth = 16;
      cg.strokeStyle = contested && Math.floor(t * 4) % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)';
      cg.setLineDash([18, 10]);
      cg.beginPath(); cg.arc(128, 128, 112, 0, Math.PI * 2); cg.stroke();
      cg.setLineDash([]);
      cg.lineWidth = 20;
      cg.lineCap = 'round';
      if (p0 > 0) { cg.strokeStyle = TEAM[0]; cg.beginPath(); cg.arc(128, 128, 112, -Math.PI / 2, -Math.PI / 2 + p0 * Math.PI * 2); cg.stroke(); }
      if (p1 > 0) { cg.strokeStyle = TEAM[1]; cg.beginPath(); cg.arc(128, 128, 96, -Math.PI / 2, -Math.PI / 2 + p1 * Math.PI * 2); cg.stroke(); }
      ringTex.needsUpdate = true;
    }
    root.visible = false;
    return { root, ball: ballG, gold, shrine, peace, ring, drawRing };
  }

  // ---------------------------------------------------------------- effects: a pool of sprites

  function makeFx(scene) {
    const pool = [];
    const live = [];
    function get(map) {
      let s = pool.pop();
      if (!s) {
        s = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false }));
        s.renderOrder = 5;
      }
      s.material.map = map;
      s.material.color.set('#ffffff');
      s.material.opacity = 1;
      s.material.rotation = 0;
      s.material.blending = T.NormalBlending;
      s.material.depthTest = true;
      s.material.needsUpdate = true;
      s.visible = true;
      scene.add(s);
      return s;
    }
    // o: { map, x, y, z, vx, vy, vz, life, size, grow, spin, g (gravity), drag, color, additive, fade, onTop, pop, follow }
    function addP(o) {
      const s = get(o.map);
      if (o.color) s.material.color.set(o.color);
      if (o.additive) s.material.blending = T.AdditiveBlending;
      if (o.onTop) { s.material.depthTest = false; s.renderOrder = 13; } else s.renderOrder = 5;
      s.position.set(o.x, o.y === undefined ? 1 : o.y, o.z);
      const p = Object.assign({ s, vx: 0, vy: 0, vz: 0, life: 1, age: 0, size: 0.5, grow: 0, spin: 0, g: 0, drag: 0, fade: 0.4, rot: 0 }, o);
      s.scale.set(p.size, p.size, 1);
      live.push(p);
      return p;
    }
    function update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.age += dt;
        if (p.age >= p.life) {
          p.s.visible = false;
          scene.remove(p.s);
          pool.push(p.s);
          live.splice(i, 1);
          continue;
        }
        if (p.to) {
          // fly to a point (golden slam, thrown treats): an arc
          const k = p.age / p.life;
          p.s.position.set(p.x + (p.to.x - p.x) * k, p.y + (p.to.y - p.y) * k + Math.sin(k * Math.PI) * (p.arc || 3), p.z + (p.to.z - p.z) * k);
        } else {
          p.vy -= p.g * dt;
          const d = Math.exp(-p.drag * dt);
          p.vx *= d; p.vz *= d;
          p.s.position.x += p.vx * dt;
          p.s.position.y += p.vy * dt;
          p.s.position.z += p.vz * dt;
          if (p.floor !== undefined && p.s.position.y < p.floor) { p.s.position.y = p.floor; p.vy = -p.vy * 0.4; }
        }
        const k = p.age / p.life;
        let sc = p.size + p.grow * p.age;
        if (p.pop) sc *= k < 0.15 ? 0.4 + (k / 0.15) * 0.75 : k < 0.25 ? 1.15 - ((k - 0.15) / 0.1) * 0.15 : 1;
        p.s.scale.set(sc * (p.sx || 1), sc, 1);
        p.rot += p.spin * dt;
        p.s.material.rotation = p.rot;
        p.s.material.opacity = (k > 1 - p.fade ? (1 - k) / p.fade : 1) * (p.alpha || 1);
      }
    }
    function clear() {
      for (const p of live) { p.s.visible = false; scene.remove(p.s); pool.push(p.s); }
      live.length = 0;
    }
    function puff(x, z, n = 6, color = '#ffffff', spread = 2, y = 0.6) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        addP({ map: tex.dot, x, y, z, vx: Math.cos(a) * R(0.6, spread), vy: R(0.3, 1.2), vz: Math.sin(a) * R(0.6, spread), life: R(0.45, 0.8), size: R(0.5, 0.9), grow: 1.2, drag: 3, color, fade: 0.7 });
      }
    }
    // minions and enemies pop into stars and coins
    function popStars(x, z, n = 6, y = 1) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        addP({ map: emoji(i % 3 === 2 ? '🪙' : '⭐'), x, y, z, vx: Math.cos(a) * R(1.5, 3.5), vy: R(3, 6), vz: Math.sin(a) * R(1.5, 3.5), g: 12, floor: 0.3, life: R(0.8, 1.2), size: R(0.45, 0.65), spin: R(-6, 6), drag: 1.2, fade: 0.35 });
      }
    }
    function word(x, z, text, fill, size = 2.2, y = 3) {
      addP({ map: burstTexture(text, fill), x, y, z, vy: 0.8, life: 0.9, size, pop: true, fade: 0.35, onTop: true, rot: R(-0.25, 0.25) });
    }
    function sparkles(x, z, n = 10, color = '#ffe680', y = 1.5, spread = 3) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        addP({ map: tex.sparkle, x, y, z, vx: Math.cos(a) * R(1, spread), vy: R(0.5, 3), vz: Math.sin(a) * R(1, spread), life: R(0.5, 0.9), size: R(0.6, 1.1), additive: true, color, drag: 2, fade: 0.6 });
      }
    }
    function emojiPop(x, z, e, size = 1.2, y = 2.5, life = 1) {
      addP({ map: emoji(e), x, y, z, vy: 1.2, life, size, pop: true, fade: 0.4, onTop: true });
    }
    function ringWave(x, z, r, color, life = 0.5, y = 0.3) {
      const p = addP({ map: tex.ring, x, y, z, life, size: 0.5, grow: (r * 2) / life, color, fade: 0.6, additive: true });
      return p;
    }
    function throwTo(e, from, to, life = 0.5, size = 0.7, arc = 2) {
      return addP({ map: emoji(e), x: from.x, y: from.y, z: from.z, to, life, size, arc, fade: 0.1, spin: 8 });
    }
    function dotTo(from, to, color, life = 0.25, size = 0.45) {
      return addP({ map: tex.glow, x: from.x, y: from.y, z: from.z, to, life, size, arc: 0.3, fade: 0.1, color, additive: true });
    }
    return { add: addP, update, clear, puff, popStars, word, sparkles, emojiPop, ringWave, throwTo, dotTo, live };
  }

  HTT.art = {
    TEAM, TEAM_L, tex, mat, glow, box, ball, cyl, add, facing, emoji, burstTexture, initTextures,
    makeMap, makeStruct, makeMinion, animMinion, makeHero, makeBuddy, makeObjective, makeFx, makeBar, lookFor,
  };
})();
