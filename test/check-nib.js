// Sanity checks for the nib model: node test/check-nib.js
const assert = require('assert');
const N = require('../nib.js');

// 1. Grades widen in order; foreign nibs are wider than domestic for the same grade
for (const o of ['domestic', 'foreign']) N.GRADES.slice(1).forEach((g, i) => assert(N.WIDTH[o][g] > N.WIDTH[o][N.GRADES[i]], `${o} ${g}`));
N.GRADES.forEach((g) => assert(N.WIDTH.foreign[g] > N.WIDTH.domestic[g], `foreign ${g}`));

// 2. Softer alloys spread more under full pressure
const keys = Object.keys(N.METALS);
keys.slice(1).forEach((k, i) => assert(N.range('F', 'domestic', k).max > N.range('F', 'domestic', keys[i]).max, `flex ${k}`));

// 3. Width grows with pressure for every alloy and cut
for (const cut of Object.keys(N.CUTS)) for (const m of keys) {
  let prev = 0;
  for (let p = 0; p <= 1.0001; p += 0.05) { const w = N.width('M', 'domestic', m, p, 0, cut); assert(w >= prev - 1e-12, `${cut} ${m} p=${p}`); prev = w; }
}

// 4. Stub: broad on downstrokes, thin on cross-strokes; flex: far wider range than normal
const st = N.range('M', 'domestic', 'k14', 'stub');
assert(st.broad / st.thin > 2.5, 'stub contrast');
assert(N.stubWidth(1, 0, 1) > N.stubWidth(1, 1, 1) && N.stubWidth(1, 1, 1) > N.stubWidth(1, 1, 0), 'stub direction');
const fx = N.range('F', 'domestic', 'k14', 'flex'), nm = N.range('F', 'domestic', 'k14');
assert(fx.max / fx.min > 2 * (nm.max / nm.min), 'flex range');

// 5. Conditions: good is always full; starve dries out with writing and recovers when lifted; empty runs out
const good = N.flow('good', 1, 1); assert(good.step(1, 0.01, 50, 0.5, 0.3) === 1);
const sv = N.flow('starve', 0.6, 3);
let mm = 0; while (sv.step(0.2, 0.005, 40, 0.4, 0.3) > 0.02 && mm < 1000) mm += 0.2;
assert(mm > 10 && mm < 300, `starve dries after ${mm} mm`); const dryMM = mm;
sv.lift(3); assert(sv.wet > 0.9, 'starve recovers');
const em = N.flow('empty', 0.9, 5); mm = 0;
while (em.tank > 0 && mm < 10000) { em.step(0.5, 0.01, 50, 0.4, 0.3); mm += 0.5; }
assert(em.tank === 0 && mm < 1000, `empty after ${mm} mm`);
em.refill(); assert(em.tank === 1 && em.wet === 1, 'refill');
const sk = N.flow('skip', 1, 7); let gaps = 0;
for (let i = 0; i < 2000; i++) if (sk.step(0.2, 0.004, 60, 0.4, 0.3) < 0.1) gaps++;
assert(gaps > 0, 'skips happen');

// 6. Ink chart: 8 shades per base ink, the first being the standard colour
for (const [k, v] of Object.entries(N.INKS)) { assert.strictEqual(N.CHART[k].length, 8); assert.strictEqual(N.CHART[k][0][0], v.color); }

console.log(`OK  nib: stub M ${st.thin.toFixed(2)}/${st.broad.toFixed(2)} mm, flex F ${fx.min.toFixed(2)}–${fx.max.toFixed(2)} mm, starve dries after ${dryMM.toFixed(0)} mm`);
