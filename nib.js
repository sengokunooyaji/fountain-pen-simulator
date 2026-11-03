// 万年筆 筆記シミュレーター © 2026 川窪万年筆店 (sengokunooyaji) All rights reserved.
// ===== Fountain-pen nib model (pure; browser + Node) =====
// Nominal line widths per grade, domestic (Japanese) vs. foreign, and how each nib alloy
// flexes under pressure. Widths are typical values in mm, to be calibrated against real pens.
const NIB = (() => {
  const GRADES = ['UEF', 'EF', 'F', 'FM', 'M', 'B', 'BB', 'BBB'];
  const WIDTH = {                       // mm on paper at normal writing pressure
    domestic: { UEF: 0.15, EF: 0.22, F: 0.30, FM: 0.38, M: 0.45, B: 0.58, BB: 0.75, BBB: 0.95 },
    foreign:  { UEF: 0.20, EF: 0.32, F: 0.42, FM: 0.50, M: 0.58, B: 0.75, BB: 0.95, BBB: 1.20 },
  };
  // Hardest first. flex: width multiplier at full pressure; onset: pressure at which the tines start
  // to spread; curve: how quickly they spread after that (<1 = soft, quick to open).
  const METALS = {
    ss:  { label: 'ステンレス', flex: 1.10, onset: 0.50, curve: 1.60 },
    k14: { label: '14金',       flex: 1.30, onset: 0.42, curve: 1.35 },
    k18: { label: '18金',       flex: 1.50, onset: 0.36, curve: 1.15 },
    k21: { label: '21金',       flex: 1.75, onset: 0.30, curve: 1.00 },
    k22: { label: '22金',       flex: 1.95, onset: 0.27, curve: 0.92 },
    k23: { label: '23金',       flex: 2.20, onset: 0.24, curve: 0.85 },
  };
  const INKS = {
    blue:      { label: 'ブルー',         color: '#1f47a8' },
    blueblack: { label: 'ブルーブラック', color: '#22304f' },
    black:     { label: 'ブラック',       color: '#1b1b1d' },
    red:       { label: 'レッド',         color: '#b3261e' },
  };
  // Colour chart: 8 shades per base ink (the first is the standard colour).
  const CHART = {
    blue: [['#1f47a8', 'ブルー'], ['#2a5fd0', 'ロイヤルブルー'], ['#3a86c8', 'スカイブルー'], ['#1e7fa0', 'ターコイズブルー'],
           ['#2c3e94', '群青'], ['#4b4fa8', '紫みのブルー'], ['#0f2a6b', '紺'], ['#5a7088', 'ブルーグレー']],
    blueblack: [['#22304f', 'ブルーブラック'], ['#263a6b', '青みの強い'], ['#2b3a5e', '明るめ'], ['#1a2233', '黒に近い'],
           ['#1f3a42', '緑み'], ['#2e2f4a', '紫み'], ['#2c3f55', '青灰'], ['#4a5468', '退色した色']],
    black: [['#1b1b1d', 'ブラック'], ['#0d0d0f', '漆黒'], ['#2e2e32', '柔らかい黒'], ['#2a2622', '茶みの黒'],
           ['#1f2528', '青みの黒'], ['#22261f', '緑みの黒'], ['#2a1f24', '赤みの黒'], ['#45454a', 'チャコールグレー']],
    red: [['#b3261e', 'レッド'], ['#d03a22', '朱色'], ['#c41e3a', '紅'], ['#d4561c', 'オレンジレッド'],
           ['#c23a62', 'ローズ'], ['#9c3a26', '煉瓦色'], ['#7a1c2a', 'ボルドー'], ['#8f1d3c', 'ワインレッド']],
  };

  // Nib cut. normal: round tipping. stub: a flat, wide tip — broad downstrokes, thin cross-strokes,
  // and stiffer (the wide edge barely spreads). flex: a cut-out, very soft nib whose tines open far
  // with pressure, from a hairline to a broad swell.
  const CUTS = {
    normal: { label: 'ノーマル', note: '標準' },
    stub:   { label: 'スタブ',   note: '縦太・横細' },
    flex:   { label: 'フレックス', note: '筆圧で大きく変化' },
  };
  const STUB = { broad: 1.3, thin: 0.32, angle: -8 * Math.PI / 180 };   // edge width vs. grade, thin/broad ratio, edge tilt
  function cutMetal(m, cut) {
    if (cut === 'flex') return { flex: m.flex * 1.6 + 0.8, onset: m.onset * 0.45, curve: m.curve * 0.8, light: 0.6 };
    if (cut === 'stub') return { flex: 1 + (m.flex - 1) * 0.3, onset: m.onset, curve: m.curve, light: 0.94 };
    return { ...m, light: 0.88 };
  }
  // Line width (mm) for a grade, origin, alloy and pressure 0..1 (with speed in mm/s).
  // For a stub this is the broad edge; stubWidth() gives the width for a stroke direction.
  function width(grade, origin, metal, pressure, speed = 0, cut = 'normal') {
    const base = WIDTH[origin][grade] * (cut === 'stub' ? STUB.broad : 1), m = cutMetal(METALS[metal], cut);
    const p = Math.min(1, Math.max(0, pressure));
    const spread = p <= m.onset ? 0 : Math.pow((p - m.onset) / (1 - m.onset), m.curve);
    const light = m.light + (1 - m.light) * Math.min(1, p / Math.max(0.01, m.onset));     // a feather touch lays a slightly thinner line
    const w = base * light * (1 + (m.flex - 1) * spread);
    const fast = 1 - 0.08 * Math.min(1, speed / 200);                          // a fast stroke spreads a little less ink
    return w * fast;
  }
  // Ink density 0..1 (how dark it lays down): slow strokes and stroke ends pool more ink.
  function density(speed, pressure) {
    const slow = 1 - Math.min(1, speed / 120);
    return Math.min(1, 0.78 + 0.16 * slow + 0.06 * pressure);
  }
  // Width of a stub line moving in direction (dx, dy): the flat edge projected across the stroke.
  function stubWidth(W, dx, dy) {
    const th = Math.atan2(dy, dx) - STUB.angle, T = W * STUB.thin;
    return Math.hypot(W * Math.sin(th), T * Math.cos(th));
  }
  const range = (grade, origin, metal, cut = 'normal') => {
    const r = { min: width(grade, origin, metal, cut === 'flex' ? 0.05 : 0.2, 0, cut), max: width(grade, origin, metal, 1, 0, cut) };
    if (cut === 'stub') { const W = width(grade, origin, metal, 0.4, 0, cut); r.thin = stubWidth(W, 1, 0); r.broad = stubWidth(W, 0, 1); }
    return r;
  };

  // ---------- pen condition ----------
  // Each point of a stroke gets a coverage c (0 = no ink reaches the paper, 1 = a full line).
  //  skip:   the nib skips at random (hard starts, fast or light strokes) and lays dry, streaky passages
  //  starve: the feed cannot keep up — the nib dries out as you write and recovers when you lift the pen
  //  empty:  the tank is running dry — the line thins, sputters and finally stops until refilled
  const CONDITIONS = {
    good:   { label: '良好' },
    skip:   { label: '掠れる',           note: 'ランダムに飛ぶ' },
    starve: { label: 'インクが続かない', note: '書くうちに薄れる' },
    empty:  { label: 'インク切れ間近',   note: 'やがて書けなくなる' },
  };
  function rng(seed) {                                   // mulberry32
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

  // Stateful ink supply for one pen. severity 0..1 (for 'empty': how little ink is left).
  function flow(kind, severity, seed = 1, init = {}) {
    const R = rng(seed), sev = clamp01(severity);
    const st = { wet: init.wet ?? 1, tank: init.tank ?? 1, ev: null, dry: 1, dryT: 1, dryLeft: 0 };
    const L = kind === 'starve' ? 70 - 52 * sev : 60;     // mm of F-width line a full nib lays down unsupplied
    const Vs = kind === 'starve' ? 55 - 45 * sev : 70;    // mm/s of F-width line the feed can keep up with
    const CAP = 1500 * (1 - sev) + 120;                   // 'empty': mm of F-width line left in the tank
    const supply = () => (kind === 'empty' ? smooth(st.tank / 0.3) : 1);
    function event(len, depth) { st.ev = { pos: 0, len, depth }; }

    function lift(dt) {                                   // pen off the paper: the feed refills the nib
      if (kind === 'good' || kind === 'skip') return;
      const rate = (kind === 'starve' ? 0.75 - 0.5 * sev : 0.8) * supply();
      st.wet = Math.min(kind === 'empty' ? Math.max(st.tank > 0 ? 0.15 : 0, supply()) : 1, st.wet + dt * rate);
    }
    function start(p) {                                   // touching down: a dry nib may not start at once
      if (kind === 'good') return;
      let chance = 0;
      if (kind === 'skip') chance = 0.12 + 0.45 * sev + 0.5 * Math.max(0, 0.3 - p);
      else chance = 0.6 * (1 - smooth(st.wet / 0.6));
      if (R() < chance) event(0.4 + R() * (1 + 2.5 * sev), R() * 0.25);
    }
    // Advance by dmm (mm moved) over dt (s); w = line width (mm). Returns coverage 0..1.
    function step(dmm, dt, speed, p, w) {
      if (kind === 'good') return 1;
      const rel = w / 0.30;
      let c = 1;
      if (kind === 'starve' || kind === 'empty') {
        if (kind === 'empty') st.tank = Math.max(0, st.tank - (dmm * rel) / CAP);
        st.wet = clamp01(st.wet + (-dmm * rel + dt * Vs * supply()) / L);
        c = smooth((st.wet - 0.03) / 0.42);
      } else {                                            // skip: slowly wandering dryness
        st.dryLeft -= dmm;
        if (st.dryLeft <= 0) { st.dryT = 1 - 0.55 * sev * R() * R(); st.dryLeft = 1.5 + R() * 3; }
        st.dry += (st.dryT - st.dry) * Math.min(1, dmm / 1.5);
        c = st.dry;
      }
      // random skips: more for fast or light strokes and for a drying nib
      let rate = kind === 'skip' ? 0.025 + 0.22 * sev : 0.35 * (1 - c) * (1 - c);
      rate *= (1 + Math.min(2, speed / 150)) * (1 + 2 * Math.max(0, 0.3 - p));
      if (!st.ev && dmm > 0 && R() < rate * dmm) event((0.3 + R() * 2) * (0.5 + sev), R() * 0.4);
      if (st.ev) {
        const e = st.ev; e.pos += dmm;
        if (e.pos >= e.len) st.ev = null;
        else c *= 1 - (1 - e.depth) * Math.pow(Math.sin(Math.PI * e.pos / e.len), 0.6);
      }
      return clamp01(c);
    }
    return {
      kind, lift, start, step,
      get wet() { return st.wet; }, get tank() { return st.tank; },
      refill() { st.wet = 1; st.tank = 1; st.ev = null; },
      state: () => ({ wet: st.wet, tank: st.tank }),
    };
  }

  return { GRADES, WIDTH, METALS, INKS, CHART, CONDITIONS, CUTS, STUB, width, stubWidth, density, range, flow, rng };
})();
if (typeof module !== 'undefined') module.exports = NIB;
