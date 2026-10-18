/* Heroes TT: the game's own sounds, made with Kit.sound.tone / hiss (Web Audio synth, no files).
   Everything is a no-op until Kit.sound.init() runs on the first tap or key. */
(function () {
  'use strict';
  const HTT = (window.HTT = window.HTT || {});
  const S = Kit.sound;
  const tone = (o) => S.tone(o), hiss = (o) => S.hiss(o);
  const last = {};
  // the same sound at most every `gap` seconds (fights get busy)
  const often = (k, gap) => { const t = performance.now() / 1000; if (last[k] && t - last[k] < gap) return false; last[k] = t; return true; };

  HTT.sfx = {
    // the match-start fanfare: our own little "charge!" (C major arpeggio and a held top note)
    fanfare() {
      [[392, 0], [523, 0.12], [659, 0.24], [784, 0.36], [659, 0.52], [784, 0.62]].forEach(([f, at]) => tone({ type: 'square', f, at, dur: 0.11, vol: 0.07, lp: 3000 }));
      tone({ type: 'square', f: 1047, at: 0.76, dur: 0.5, vol: 0.07, lp: 3000 });
      [[131, 0], [196, 0.36], [262, 0.76]].forEach(([f, at]) => tone({ type: 'triangle', f, at, dur: 0.3, vol: 0.2 }));
    },
    hit(hero) { if (often('hit', 0.06)) tone({ type: 'square', f: hero ? 260 : 380, to: hero ? 120 : 200, dur: 0.06, vol: hero ? 0.06 : 0.035, lp: 2000 }); },
    punch() { if (often('punch', 0.08)) S.punch(); },
    shot() { if (often('shot', 0.08)) tone({ type: 'triangle', f: 500, to: 900, dur: 0.08, vol: 0.05 }); },
    tower() { if (often('tower', 0.2)) { tone({ type: 'sine', f: 180, to: 90, dur: 0.15, vol: 0.12 }); hiss({ filter: 'lowpass', f: 1500, to: 300, dur: 0.12, vol: 0.06 }); } },
    zap() { tone({ type: 'sawtooth', f: 1400, to: 300, dur: 0.18, vol: 0.05, lp: 3500 }); hiss({ f: 4000, to: 1500, dur: 0.15, vol: 0.05 }); },
    swoosh() { hiss({ f: 600, to: 3000, dur: 0.25, vol: 0.12, q: 0.8 }); },
    pop() {
      if (!often('pop', 0.07)) return;
      tone({ type: 'square', f: 520, to: 200, dur: 0.08, vol: 0.05, lp: 2400 });
      [1047, 1319, 1568].forEach((f, i) => tone({ type: 'triangle', f, at: 0.04 + i * 0.035, dur: 0.07, vol: 0.035 }));
    },
    bonk() { S.crash(); tone({ type: 'triangle', f: 700, to: 200, dur: 0.35, vol: 0.12 }); },
    boom() { hiss({ filter: 'lowpass', f: 2600, to: 90, dur: 1.2, vol: 0.5 }); tone({ type: 'sine', f: 110, to: 40, dur: 0.9, vol: 0.4 }); },
    level() { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, at: i * 0.07, dur: 0.09, vol: 0.05, lp: 3500 })); },
    heroic() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.06, dur: 0.2, vol: 0.09 })); S.powerup(); },
    cast(type) {
      if (type === 'shield' || type === 'teamShield') { tone({ type: 'sine', f: 600, to: 1200, dur: 0.3, vol: 0.08 }); return; }
      if (type === 'nova') { hiss({ f: 300, to: 2400, dur: 0.4, vol: 0.18, q: 0.6 }); tone({ type: 'triangle', f: 330, to: 660, dur: 0.3, vol: 0.08 }); return; }
      if (type === 'dash' || type === 'speed') { this.swoosh(); return; }
      if (type === 'zap') { this.zap(); return; }
      if (type === 'leap') { S.jump(); return; }
      if (type === 'zone') { tone({ type: 'sine', f: 900, to: 500, dur: 0.25, vol: 0.06 }); return; }
      if (type === 'combo' || type === 'melee') { S.swish(); return; }
      tone({ type: 'triangle', f: 420, to: 840, dur: 0.12, vol: 0.08 });
    },
    land() { S.land(); hiss({ filter: 'lowpass', f: 1800, to: 120, dur: 0.6, vol: 0.35 }); tone({ type: 'sine', f: 140, to: 50, dur: 0.5, vol: 0.3 }); },
    nope() { tone({ type: 'square', f: 200, to: 160, dur: 0.12, vol: 0.05, lp: 1200 }); },
    saved() { if (often('saved', 0.25)) { tone({ type: 'triangle', f: 1047, dur: 0.08, vol: 0.08 }); tone({ type: 'triangle', f: 1568, at: 0.07, dur: 0.14, vol: 0.08 }); } },
    treat() { S.coin(3); tone({ type: 'sine', f: 660, to: 990, at: 0.05, dur: 0.15, vol: 0.06 }); },
    buddy() { hiss({ f: 500, to: 2500, dur: 0.4, vol: 0.12 }); [659, 784, 988].forEach((f, i) => tone({ type: 'square', f, at: 0.15 + i * 0.07, dur: 0.08, vol: 0.05, lp: 3000 })); },
    horn() { S.horn(0.5); },
    capture(good) {
      const notes = good ? [523, 659, 784, 1047, 784, 1047] : [392, 349, 311, 262];
      notes.forEach((f, i) => tone({ type: 'square', f, at: i * 0.11, dur: 0.12, vol: 0.06, lp: 3000 }));
    },
    munch() { if (often('munch', 0.2)) [700, 500, 800].forEach((f, i) => tone({ type: 'square', f, at: i * 0.06, dur: 0.05, vol: 0.04, lp: 1800 })); },
    snore() { tone({ type: 'sine', f: 110, to: 160, dur: 0.6, vol: 0.05 }); hiss({ filter: 'lowpass', f: 600, to: 300, dur: 0.6, vol: 0.04 }); },
    wake() { [523, 784].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.08, dur: 0.1, vol: 0.07 })); },
    win() { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'square', f, at: i * 0.1, dur: 0.14, vol: 0.06, lp: 3500 })); },
    lose() { [523, 466, 415, 392].forEach((f, i) => tone({ type: 'triangle', f, at: i * 0.22, dur: 0.25, vol: 0.1 })); },
  };
})();
