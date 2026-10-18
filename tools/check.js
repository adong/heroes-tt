#!/usr/bin/env node
/* Runs the Heroes TT checks in Node (no browser, no npm):
     node tools/check.js                          the rules and the sabotage cases (--verbose lists every rule)
     node tools/check.js --soak [--seeds=N] [--easy | --normal] [--max=MIN]
   The soak plays bot-vs-bot matches (all ten heroes are bots) and every one must end with a cookie castle knocked down.
   Loads the game's rules (title, sim, brain, check) into a sandbox with a fake `window`. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON, Set, Map };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/title.js', 'js/sim.js', 'js/brain.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const HTT = ctx.HTT;
const args = process.argv.slice(2);
const has = (a) => args.includes(a);
const opt = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
let bad = 0;

const rules = HTT.check.rules();
console.log(`rules: ${rules.filter((r) => r.ok).length} of ${rules.length} ok`);
for (const r of rules) if (!r.ok || has('--verbose')) console.log(`  ${r.ok ? 'ok' : 'FAIL'}: ${r.name}${r.info ? ' (' + r.info + ')' : ''}`);
if (rules.some((r) => !r.ok)) bad++;

if (!has('--no-sabotage')) {
  const t0 = Date.now();
  const sab = HTT.check.sabotage();
  console.log(`sabotage: ${sab.filter((s) => s.caught).length} of ${sab.length} broken setups caught (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  for (const s of sab) console.log(`  ${s.caught ? 'caught' : 'MISSED'}: ${s.name}${s.info ? ' (' + s.info + ')' : ''}`);
  if (sab.some((s) => !s.caught)) bad++;
}

if (has('--soak')) {
  const levels = has('--easy') ? ['easy'] : has('--normal') ? ['normal'] : ['easy', 'normal'];
  for (const level of levels) {
    const t0 = Date.now();
    const r = HTT.check.soak({ level, seeds: opt('seeds', 4), maxMin: opt('max', 30) });
    const mins = r.runs.map((x) => x.minutes);
    const wins = [0, 1].map((t) => r.runs.filter((x) => x.winner === t).length);
    console.log(`soak ${level}: ${r.ended} of ${r.runs.length} matches ended with a castle down; ` +
      `brothers' team won ${wins[0]}, zombies ${wins[1]}; ${Math.min(...mins).toFixed(1)}-${Math.max(...mins).toFixed(1)} min (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    for (const x of r.runs) {
      console.log(`  seed ${x.seed}: ${x.over ? (x.winner === 0 ? 'brothers win' : 'zombies win') : 'NOT ENDED'} at ${x.minutes} min, levels ${x.levels.join('/')}, ` +
        `level 10 at ${x.tenAt} min, bonks ${x.bonks.join('/')}, buildings left ${x.buildings.join('/')}, objectives ${x.objs.join('/')}, camps ${x.camps.join('/')}`);
    }
    if (!r.ok) bad++;
  }
}
process.exit(bad ? 1 : 0);
