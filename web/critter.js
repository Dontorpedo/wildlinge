'use strict';
/* Side-view chibi sprites built from the genome (terrarium).
   The body is rasterised into an indexed pixel grid with a coloured outline around every part. */
const CR_ACC = ['#f2c14e', '#f58fb0', '#ff9a6a', '#7fe0b8', '#b79af2', '#7ec8f5', '#ffb347', '#b6e36a', '#f06ac8', '#4fd0c8', '#ffc9a3', '#ef6a6a'];
const CR_IRIS = ['#2d4a9c', '#2f8a5c', '#a05a22', '#7a48c0', '#1f98aa', '#c8406c', '#c89020', '#5a6478'];
const CR_CHEEK = ['#ff9db8', '#ff8aa8', '#ffb86a', '#9ec8ff'];
const CR = { OUT: 1, BASE: 2, SH: 3, HI: 4, BEL: 5, BELSH: 6, SPOT: 7, ACC: 8, ACCSH: 9, PINK: 10, WING: 11, WVEIN: 12, FAR: 13, FARSH: 14, WOUT: 15, PAWSH: 16 };
const crCache = new Map();

function crHsl(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255), 255];
}
function crHex(x) { return [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16), 255]; }
function crMix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255]; }
function crPalette(h, accIdx) {
  const acc = crHex(CR_ACC[accIdx % CR_ACC.length]), P = [[0, 0, 0, 0]];
  P[CR.OUT] = crHsl((h + 6) % 360, 38, 15);
  P[CR.BASE] = crHsl(h, 62, 78);
  P[CR.SH] = crHsl(h, 50, 63);
  P[CR.HI] = crHsl(h, 74, 88);
  P[CR.BEL] = crHsl((h + 32) % 360, 78, 94);
  P[CR.BELSH] = crHsl((h + 32) % 360, 52, 84);
  P[CR.SPOT] = crHsl((h + 10) % 360, 72, 87);
  P[CR.ACC] = acc;
  P[CR.ACCSH] = crMix(acc, [90, 50, 70, 255], 0.28);
  P[CR.PINK] = crMix(acc, [255, 214, 224, 255], 0.55);
  const w = crHsl((h + 12) % 360, 75, 92); w[3] = 205; P[CR.WING] = w;
  const v = crHsl((h + 12) % 360, 50, 76); v[3] = 235; P[CR.WVEIN] = v;
  P[CR.FAR] = crHsl(h, 46, 60);
  P[CR.FARSH] = crHsl(h, 42, 52);
  const wo = crHsl((h + 12) % 360, 42, 62); wo[3] = 240; P[CR.WOUT] = wo;
  P[CR.PAWSH] = crHsl((h + 32) % 360, 45, 74);
  return P;
}
function crRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const crClamp = (v, a, b) => Math.min(b, Math.max(a, v));
/* Catmull-Rom spline through control points -> flattened polygon */
function crSpline(pts, closed, seg) {
  seg = seg || 6;
  const n = pts.length, out = [], cnt = closed ? n : n - 1;
  const P = i => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  for (let i = 0; i < cnt; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t, f = d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
/* closed smooth shape: returns { inside(x,y), bb } */
function crShape(pts, seg) {
  const poly = crSpline(pts, true, seg || 6), n = poly.length;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const q of poly) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
  const inside = (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    let c = false;
    for (let i = 0, j = n - 1; i < n; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; }
    return c;
  };
  return { inside, bb: [x0 - 2, y0 - 2, x1 + 2, y1 + 2] };
}
const crScale = (pts, cx, cy, k) => pts.map(q => [cx + (q[0] - cx) * k, cy + (q[1] - cy) * k]);

/* rec: creature frame record; opt: { r, baby, ph (0 idle, 1..4 walk), lie } */
function crBuild(rec, opt) {
  const r = opt.r, baby = opt.baby ? 1 : 0, ph = opt.ph | 0, lie = !!opt.lie;
  const look = [82, 83, 84, 85, 86, 87, 88, 89].map(i => rec[i] | 0);
  const sh = [rec[20], rec[21], rec[22], rec[23], rec[24]];
  const ge = geom(r, sh, baby, look[7]);
  const hue = (Math.round(rec[5] / 12) * 12) % 360, P = crPalette(hue, look[0]);
  const np = rec[19] | 0, kinds = {};
  let nLegs = 0;
  for (let i = 0; i < np; i++) { const k = KIND_KEYS[rec[26 + i * 7 + 5]] || 'bud'; kinds[k] = (kinds[k] || 0) + 1; if (k === 'leg') nLegs++; }
  const seg0 = ge.segs[0], a = seg0.a, b = Math.max(3, Math.min(seg0.b, a * 0.78)), rh = Math.max(3, Math.round(a * 0.74 + (baby ? a * 0.1 : 0) + (ge.rh - r * 0.9) * 0.5)), nseg = ge.segs.length;
  const ls = look[6], pat = look[1], ear = look[3];
  const hasLegs = nLegs > 0 && !lie, ng = hasLegs ? crClamp(nseg > 1 ? Math.min(nseg, nLegs + 1) : Math.max(2, nLegs), 2, 6) : 0;
  const legL = hasLegs ? Math.max(3, Math.round(b * 0.62) + 1) : 0;
  const W = Math.ceil(2 * (ge.R + rh * 0.9) + 14), earH = Math.round(rh * 0.9), hornH = Math.round(rh * 0.75), wingH = kinds.wing ? Math.round(r * 0.9) : 0;
  const H = Math.ceil(legL + 2 * b + rh * 1.5 + Math.max(earH * 0.3, hornH, wingH * 0.5) + 10);
  const ox = Math.round(W / 2 + (ge.tmin < -a * 1.2 ? 2 : 0)), gy = H - 2;
  const g = new Uint8Array(W * H);
  const set = (x, y, i) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = i; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? g[y * W + x] : 0);
  const X = u => ox + u, Y = v => gy + v;
  /* layer: paints a coloured outline ring first, then the fill chosen per pixel */
  const layer = (x0, y0, x1, y1, inside, shade, noOut) => {
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = inside(x + x0 + 0.5, y + y0 + 0.5) ? 1 : 0;
    const mm = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0);
    if (!noOut) for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (!mm(x, y) && (mm(x - 1, y) || mm(x + 1, y) || mm(x, y - 1) || mm(x, y + 1))) set(x + x0, y + y0, CR.OUT);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { const c = shade(x + x0 + 0.5, y + y0 + 0.5); if (c) set(x + x0, y + y0, c); }
  };
  const ellShade = (cx, cy, rx, ry, base, sh, hi) => (x, y) => {
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    if (ny * 0.9 - nx * 0.3 > 0.5) return sh;
    if (ny < -0.55 && nx < 0.35 && nx > -0.6 && hi) return hi;
    return base;
  };
  const ell = (cx, cy, rx, ry, pw) => (x, y) => Math.pow(Math.abs(x - cx) / rx, pw || 2) + Math.pow(Math.abs(y - cy) / ry, pw || 2) <= 1;
  const tri = (ax, ay, bx, by, cx, cy) => (x, y) => {
    const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    const u = ((x - ax) * (cy - ay) - (cx - ax) * (y - ay)) / d, v = ((bx - ax) * (y - ay) - (x - ax) * (by - ay)) / d;
    return u >= 0 && v >= 0 && u + v <= 1;
  };
  const blob = pts => (x, y) => { for (const q of pts) { const dx = x - q[0], dy = y - q[1]; if (dx * dx + dy * dy <= q[2] * q[2]) return true; } return false; };
  const bbox = pts => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of pts) { x0 = Math.min(x0, q[0] - q[2]); x1 = Math.max(x1, q[0] + q[2]); y0 = Math.min(y0, q[1] - q[2]); y1 = Math.max(y1, q[1] + q[2]); } return [x0 - 1, y0 - 1, x1 + 1, y1 + 1]; };
  const walk = Math.sin(ph * Math.PI / 2), lift = Math.cos(ph * Math.PI / 2);
  const bc = lie ? -(b - 1) : -(legL + b - 2);
  const bcy = Y(bc), huC = X(nseg > 1 ? ge.uh : a * 0.62 + (lie ? a * 0.1 : 0)), hvC = lie ? Y(-rh * 0.85) : Y(bc - b - rh * 0.12);
  const rnd = crRng((hue * 7 + look[1] * 131 + (rec[20] * 977 | 0) + (rec[21] * 331 | 0) + nLegs * 17) | 0);

  /* wings: scalloped membrane with finger bones */
  const wing = (far) => {
    const wl = Math.max(5, r * 0.85), ww = Math.max(2.2, r * 0.36), ang = -1.85 + Math.sin(ph * 1.6 + (far ? 1.2 : 0)) * 0.22;
    const ca = Math.cos(ang), sa = Math.sin(ang), cx = X(-a * 0.05 - (far ? 3 : 0)), cy = bcy - b * 0.8;
    const loc = [[0, 0], [wl * .3, -ww * 1.2], [wl * .72, -ww * 1.5], [wl * 1.05, -ww * .6], [wl * .78, -ww * .05], [wl * .84, ww * .9], [wl * .5, ww * .25], [wl * .46, ww * 1.1], [wl * .2, ww * .5]];
    const sh = crShape(loc.map(q => [cx + q[0] * ca - q[1] * sa, cy + q[0] * sa + q[1] * ca]), 5);
    layer(sh.bb[0], sh.bb[1], sh.bb[2], sh.bb[3], sh.inside, (x, y) => {
      const dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if (Math.abs(v + ww * 1.05 * Math.sin(Math.min(1, u / wl) * 2.2)) < 0.6 && u > 0) return CR.WVEIN;
      if ((Math.abs(u - wl * 0.5) < 0.55 || Math.abs(u - wl * 0.78) < 0.55) && v > -ww * 0.6) return CR.WVEIN;
      return CR.WING;
    }, false);
  };
  if (kinds.wing) wing(true);

  /* far legs (before body) */
  const legXs = [];
  if (hasLegs) {
    const nNear = Math.ceil(ng / 2), nFar = ng - nNear;
    for (let i = 0; i < nNear; i++) legXs.push([nseg > 1 ? ge.segs[Math.min(i, nseg - 1)].u : (nNear === 1 ? a * 0.2 : -a * 0.55 + (a * 1.1) * i / (nNear - 1)), false]);
    for (let i = 0; i < nFar; i++) legXs.push([(nseg > 1 ? ge.segs[Math.min(i, nseg - 1)].u : (nFar === 1 ? a * 0.05 : -a * 0.4 + (a * 0.9) * i / (nFar - 1))) + 3, true]);
  }
  const leg = (u0, far, idx) => {
    const sgn = idx % 2 ? -1 : 1, sw = Math.round(walk * 2 * sgn), up = ph ? Math.max(0, lift * sgn) * 1.2 : 0;
    const w = crClamp(Math.round(a * 0.36), 4, 8), top = bcy + b * 0.5, bot = gy - Math.round(up), x0 = X(u0);
    const cBase = far ? CR.FAR : CR.BASE, cSh = far ? CR.FARSH : CR.SH, cPaw = far ? CR.FARSH : CR.BEL, cPawSh = far ? CR.FARSH : CR.PAWSH;
    if (ls === 1) {
      const pts = [];
      const n = Math.max(5, legL + 3);
      for (let k = 0; k < n; k++) { const q = k / (n - 1), curl = q > 0.7 ? (q - 0.7) * 3.2 * w : 0; pts.push([x0 + Math.sin(q * 4 + ph * 1.3 + idx) * 1.2 + curl, top + q * (bot - top - 1), Math.max(1.2, w * 0.5 * (1 - q * 0.7))]); }
      const bb = bbox(pts);
      layer(bb[0], bb[1], bb[2], bb[3], blob(pts), (x, y) => (y < top + 2 ? cBase : (Math.floor((y - top) / 3) % 3 === 2 ? CR.ACC : cBase)));
      return;
    }
    if (ls === 2) {
      const lx = x0 + sw * 0.5, ww = 2;
      layer(lx - ww - 1, top, lx + ww + 1, bot, (x, y) => Math.abs(x - lx) <= ww * 0.5 + 0.5 && y < bot - 2, () => cSh);
      layer(lx - 3, bot - 4, lx + 3, bot + 1, ell(lx, bot - 2, 2.6, 2.4), () => cPaw);
      return;
    }
    const lx = x0 + sw * 0.4, L = bot - top;
    const lg = crShape([[lx - w * .55, top], [lx + w * .55, top], [lx + w * .5, top + L * .45], [lx + w * .42, bot - 4], [lx + w * .95 + 1, bot - 2.2], [lx + w * .85 + 1, bot + .4], [lx - w * .35, bot + .4], [lx - w * .5, bot - 3], [lx - w * .45, top + L * .5]], 4);
    layer(lg.bb[0], lg.bb[1], lg.bb[2], lg.bb[3], lg.inside, (x, y) => {
      if (y > bot - 3) return (x > lx + w / 2 + 0.2 && y > bot - 1.2) ? cPawSh : cPaw;
      return x - lx > 0 ? cBase : cSh;
    });
    if (ls === 3) { set(lx - w / 2 - 1, top + 2, far ? CR.FARSH : CR.ACC); set(lx - w / 2 - 1, top + 4, far ? CR.FARSH : CR.ACC); set(lx + w / 2 + 1, top + 3, far ? CR.FARSH : CR.ACC); }
    if (!far && w >= 4) { set(lx - 1, bot - 1, CR.ACCSH); set(lx + w * 0.5, bot - 1, CR.ACCSH); }
  };
  legXs.forEach(([u0, far], i) => { if (far) leg(u0, true, i); });

  /* tail: short and curved with a fan tip */
  {
    const ts = look[7], lb = b, ux = -a * 0.88, y0 = bcy - b * 0.05;
    const tpts = [];
    if (ts === 0 || ts === 3) {
      const L = a * (ts === 3 ? 1.5 : 0.95), n = Math.round(L / 1.4) + 3;
      for (let k = 0; k < n; k++) { const q = k / (n - 1); tpts.push([X(ux - q * L), y0 + q * lb * 0.2 - Math.sin(q * 3.1) * lb * (ts === 3 ? -0.5 : 0.35) - q * q * lb * 0.8, Math.max(1.5, lb * 0.42 * (1 - q * 0.65))]); }
    } else if (ts === 1) { tpts.push([X(ux - 1), y0 + 1, Math.max(2.4, lb * 0.45)], [X(ux - lb * 0.55), y0 - 1, Math.max(2, lb * 0.34)]); }
    else if (ts === 2) { for (let k = 0; k < 6; k++) tpts.push([X(ux - 1 - k * Math.max(1.6, lb * 0.35)), y0 + Math.sin(k) * 0.8, Math.max(1.2, lb * 0.38 * (1 - k * 0.12))]); }
    else if (ts === 4) { tpts.push([X(ux - 1), y0, Math.max(2, lb * 0.4)], [X(ux - lb * 0.75), y0 - 1, Math.max(3, lb * 0.62)]); }
    else { for (let k = -2; k <= 2; k++) tpts.push([X(ux - lb * 0.6 - Math.abs(k) * 0.4), y0 + k * Math.max(1.3, lb * 0.32) - lb * 0.1, Math.max(1.3, lb * 0.32)]); }
    const last = tpts[tpts.length - 1];
    let fanIn = null, fanBB = null;
    if (ts === 0 || ts === 3) {
      const f = Math.max(3, lb * 0.75), lx = last[0], ly = last[1];
      const fs = crShape([[lx + f * .1, ly], [lx - f * .5, ly - f * .95], [lx - f * 1.5, ly - f * .75], [lx - f * 2.0, ly - f * .05], [lx - f * 1.5, ly + f * .7], [lx - f * .5, ly + f * .9]], 5);
      fanIn = fs.inside; fanBB = fs.bb;
    }
    const bb = bbox(tpts), tipX = last[0] - Math.max(1, lb * 0.1), tb = blob(tpts);
    if (fanBB) { bb[0] = Math.min(bb[0], fanBB[0]); bb[1] = Math.min(bb[1], fanBB[1]); bb[2] = Math.max(bb[2], fanBB[2]); bb[3] = Math.max(bb[3], fanBB[3]); }
    layer(bb[0], bb[1], bb[2], bb[3], fanIn ? (x, y) => tb(x, y) || fanIn(x, y) : tb, (x, y) => {
      if (ts === 0 || ts === 3) { if (x < tipX) return (y > last[1] + 3 || x < tipX - Math.max(3, lb * 0.5)) ? CR.ACCSH : CR.ACC; return y > last[1] + 2 ? CR.SH : CR.BASE; }
      if (ts === 4 && x < tpts[1][0] + 1) return CR.HI;
      if (ts === 5 && x < tpts[0][0] - lb * 0.3) return CR.ACC;
      return y > tpts[0][1] + 1 ? CR.SH : CR.BASE;
    });
  }
  /* dorsal fin / crest / armor behind the body */
  if (kinds.fin) {
    const n = Math.min(3, kinds.fin + 1);
    for (let k = 0; k < n; k++) { const u = -a * 0.6 + k * a * 0.5, hh = Math.max(3, Math.round(b * 0.5)); layer(X(u) - 4, bcy - b - hh - 1, X(u) + 4, bcy - b + 2, tri(X(u) - 3, bcy - b + 2, X(u) + 3, bcy - b + 2, X(u) - 1, bcy - b - hh), () => CR.ACC); }
  }
  /* body segments, last first */
  for (let k = nseg - 1; k >= 0; k--) {
    const s = ge.segs[k], cx = X(s.u), cy = bcy + (k ? s.b * 0.15 : 0), n = ge.n;
    const ins = (x, y) => { const uu = (x - cx) / s.a; let bt = s.b * (1 + ge.tp * 0.35 * crClamp(uu, -1, 1)); if (bt < 0.6) bt = 0.6; return Math.pow(Math.abs(uu), n) + Math.pow(Math.abs(y - cy) / bt, n) <= 1; };
    layer(cx - s.a - 1, cy - s.b * 1.4 - 1, cx + s.a + 1, cy + s.b * 1.4 + 1, ins, (x, y) => {
      const nx = (x - cx) / s.a, ny = (y - cy) / s.b;
      const belly = (ny > 0.05 && Math.pow((x - (cx + s.a * 0.12)) / (s.a * 0.82), 2) + Math.pow((y - (cy + s.b * 0.62)) / (s.b * 0.66), 2) <= 1) || (k === 0 && nseg === 1 && nx > 0.25 && Math.pow((x - (cx + s.a * 0.62)) / (s.a * 0.5), 2) + Math.pow((y - (cy + s.b * 0.1)) / (s.b * 1.0), 2) <= 1);
      if (belly) return ny > 0.72 ? CR.BELSH : CR.BEL;
      return ellShade(cx, cy, s.a, s.b, CR.BASE, CR.SH, CR.HI)(x, y);
    });
    /* pattern, only on body pixels */
    const body = v => v === CR.BASE || v === CR.SH || v === CR.HI;
    const spots = [];
    if (pat === 1) for (let q = 0; q < 5; q++) spots.push([cx + (rnd() - 0.55) * s.a * 1.4, cy - s.b * (0.1 + rnd() * 0.65), 1.3 + rnd() * Math.max(1, s.b * 0.22)]);
    else if (pat === 5) for (let q = 0; q < 12; q++) spots.push([cx + (rnd() - 0.5) * s.a * 1.7, cy + (rnd() - 0.6) * s.b * 1.3, 0.9 + rnd() * 0.5]);
    else if (pat === 4) for (let q = 0; q < 2; q++) spots.push([cx + (rnd() - 0.5) * s.a * 1.0, cy - s.b * (0.2 + rnd() * 0.4), s.b * (0.35 + rnd() * 0.2)]);
    for (const q of spots) for (let y = Math.floor(q[1] - q[2] - 1); y <= q[1] + q[2] + 1; y++) for (let x = Math.floor(q[0] - q[2] - 1); x <= q[0] + q[2] + 1; x++) if (Math.hypot(x + 0.5 - q[0], y + 0.5 - q[1]) <= q[2] && body(get(x, y))) set(x, y, CR.SPOT);
    if (pat === 2) for (let x = Math.floor(cx - s.a * 0.7); x <= cx + s.a * 0.7; x += 4) for (let y = Math.floor(cy - s.b); y < cy + s.b * 0.25; y++) if (body(get(x, y)) && body(get(x + 1, y))) { set(x, y, CR.SPOT); set(x + 1, y, CR.SPOT); }
    if (kinds.armor) for (let j = -2; j <= 2; j++) { const px = cx + j * s.a * 0.3, py = cy - s.b * (1 - Math.abs(j) * 0.04); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dy <= 0 || dx === 0) set(px + dx, py + dy + 1, dy < 0 ? CR.ACC : CR.ACCSH); }
    if (kinds.insul) for (let j = -3; j <= 3; j++) { const px = cx + j * s.a * 0.24, py = cy - s.b * Math.sqrt(Math.max(0, 1 - (j * 0.24) ** 2)) - 1; layer(px - 2, py - 2, px + 2, py + 2, ell(px, py, 1.8, 1.6), () => CR.HI); }
    if (kinds.storage && k === 0) layer(cx - 4, cy + s.b * 0.35, cx + 5, cy + s.b + 1, ell(cx + 1, cy + s.b * 0.72, 3.8, 2.6), () => CR.BELSH);
  }
  /* near legs */
  legXs.forEach(([u0, far], i) => { if (!far) leg(u0, false, i); });
  /* near wing */
  if (kinds.wing) wing(false);

  /* ears, horns, crest drawn before the head so its outline covers their bases */
  const hu = huC, hv = hvC, hr = rh;
  const earBase = (dxo, farE) => {
    const cB = farE ? CR.FAR : CR.BASE, cI = farE ? CR.FARSH : CR.PINK, eL = Math.max(4, Math.round(hr * (ear === 2 ? 1.4 : 1.25)));
    if (ear === 0) {
      const b1x = hu - hr * 0.25 + dxo, b1y = hv - hr * 0.92, b2x = hu - hr * 1.0 + dxo, b2y = hv + hr * 0.05, ax = hu - hr * 1.62 + dxo, ay = hv - hr * 1.0;
      const pts = [[b1x, b1y], [(b1x + ax) / 2 + hr * 0.05, (b1y + ay) / 2 - hr * 0.3], [ax, ay], [(ax + b2x) / 2 + hr * 0.1, (ay + b2y) / 2 + hr * 0.12], [b2x, b2y]];
      const o = crShape(pts, 6), inn = crShape(crScale(pts, (b1x + b2x) / 2 + hr * 0.1, (b1y + b2y) / 2, 0.58), 6);
      layer(o.bb[0], o.bb[1], o.bb[2], o.bb[3], o.inside, (x, y) => (inn.inside(x, y) ? cI : cB));
    } else if (ear === 3) {
      const bx = hu - hr * 0.35 + dxo, by = hv - hr * 0.8, ew = hr * 0.55;
      const pts = [[bx - ew, by + 2], [bx - ew * 1.05, by - eL * 0.5], [bx - ew * 0.2, by - eL], [bx + ew * 0.8, by - eL * 0.45], [bx + ew, by + 1]];
      const o = crShape(pts, 6), inn = crShape(crScale(pts, bx, by + 2, 0.55), 6);
      layer(o.bb[0], o.bb[1], o.bb[2], o.bb[3], o.inside, (x, y) => (inn.inside(x, y) ? cI : cB));
    } else if (ear === 1) {
      const bx = hu - hr * 0.45 + dxo, by = hv - hr * 0.85, ew = hr * 0.5;
      layer(bx - ew - 1, by - ew * 1.4 - 1, bx + ew + 1, by + 3, ell(bx, by - ew * 0.4, ew, ew * 1.05), (x, y) => (ell(bx, by - ew * 0.35, ew * 0.55, ew * 0.6)(x, y) ? cI : cB));
    } else {
      const bx = hu - hr * 0.4 + dxo, by = hv - hr * 0.8, ew = hr * 0.38, lean = hr * 0.35;
      const pts = [[bx - ew, by + 2], [bx - ew * 1.1 - lean * 0.45, by - eL * 0.8], [bx - lean * 1.1, by - eL * 1.65], [bx + ew * 0.9 - lean * 0.45, by - eL * 0.85], [bx + ew, by + 2]];
      const o = crShape(pts, 6), inn = crShape(crScale(pts, bx, by + 2, 0.5), 6);
      layer(o.bb[0], o.bb[1], o.bb[2], o.bb[3], o.inside, (x, y) => (inn.inside(x, y) ? cI : cB));
    }
  };
  earBase(hr * 0.35, true);
  const nH = kinds.weapon ? Math.min(2, kinds.weapon + 1) : 0;
  for (let k = 0; k < nH; k++) {
    const bx = hu - hr * (0.0 - k * 0.5), by = hv - hr * (0.9 - k * 0.1), hh = Math.max(4, Math.round(hr * 0.78) - k), bw = Math.max(2, hr * 0.22);
    const hp = [];
    for (let j = 0; j <= 10; j++) { const t = j / 10, u = 1 - t; hp.push([u * u * bx + 2 * u * t * (bx + hh * 0.12) + t * t * (bx - hh * 0.5), u * u * (by + 2) + 2 * u * t * (by - hh * 0.6) + t * t * (by - hh), Math.max(0.7, bw * (1 - t * 0.85))]);
    }
    const hb = bbox(hp);
    layer(hb[0], hb[1], hb[2], hb[3], blob(hp), (x, y) => (y < by - hh * 0.55 ? ((x + y) % 4 < 1 ? CR.ACCSH : CR.ACC) : (y < by - hh * 0.25 ? CR.BEL : CR.BASE)));
  }
  if (kinds.display) for (let k = 0; k < 3; k++) { const bx = hu - hr * (0.55 - k * 0.22), by = hv - hr * 0.95 - k * 0.3, hh = Math.max(3, Math.round(hr * 0.5)); layer(bx - 3, by - hh - 1, bx + 3, by + 2, tri(bx - 2, by + 1, bx + 2, by + 1, bx - 1.5, by - hh), () => (k === 1 ? CR.ACCSH : CR.ACC)); }
  if (kinds.sense) {
    const bx = hu + hr * 0.45, by = hv - hr * 0.95, Ln = Math.max(4, Math.round(hr * 0.7)), sway = Math.sin(ph * 1.3) * 1.2;
    for (let j = 0; j < Ln; j++) set(bx + sway * j / Ln - j * 0.15, by - j, CR.OUT);
    const ex = bx + sway - Ln * 0.15, ey = by - Ln;
    if (ls === 2) layer(ex - 3, ey - 4, ex + 3, ey + 2, ell(ex, ey - 1, 2.4, 2.4), (x, y) => (Math.hypot(x - ex - 0.6, y - ey + 1) < 1.2 ? CR.OUT : CR.HI));
    else layer(ex - 3, ey - 4, ex + 3, ey + 2, ell(ex, ey - 1, 2, 2), () => CR.ACC);
  }
  earBase(0, false);

  /* head */
  const hsx = hr * 1.04, hsy = hr * 0.94;
  const hs = crShape([[0.05, -1.0], [0.7, -0.8], [1.03, -0.1], [0.92, 0.55], [0.4, 0.99], [-0.3, 0.99], [-1.0, 0.56], [-1.04, -0.1], [-0.7, -0.8]].map(q => [hu + q[0] * hsx, hv + q[1] * hsy]), 6);
  layer(hs.bb[0], hs.bb[1], hs.bb[2], hs.bb[3], hs.inside, (x, y) => {
    const nx = (x - hu) / hsx, ny = (y - hv) / hsy;
    const muz = Math.pow((x - (hu + hr * 0.52)) / (hr * 0.66), 2) + Math.pow((y - (hv + hr * 0.3)) / (hr * 0.78), 2) <= 1 || (nx > 0.2 && ny > 0.35);
    if (muz) return ny > 0.78 ? CR.BELSH : CR.BEL;
    return ellShade(hu, hv, hsx, hsy, CR.BASE, CR.SH, CR.HI)(x, y);
  });
  if (pat === 1 || pat === 4) for (let q = 0; q < 2; q++) { const px = hu - hr * (0.2 + q * 0.4), py = hv - hr * (0.55 + q * 0.1); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && Math.abs(dx) + Math.abs(dy) < 3 && [CR.BASE, CR.HI, CR.SH].includes(get(px + dx, py + dy))) set(px + dx, py + dy, CR.SPOT); }
  /* forehead tuft for accent */
  if (look[5] === 1) { set(hu - hr * 0.1, hv - hr * 0.45, CR.HI); }

  return {
    W, H, ox, gy, g, P,
    A: { hu: hu - ox, hv: hv - gy, hr, ew: Math.max(2, Math.round(hr * 0.5)), eh: Math.max(3, Math.round(hr * 0.64)), top: 0, legL, a, b, bcv: bc, iris: CR_IRIS[look[2] % CR_IRIS.length], cheek: CR_CHEEK[look[4] % CR_CHEEK.length], cheekKind: look[4], ear, earH, nLegs, nseg }
  };
}

function crSprite(rec, opt) {
  const sh = opt.baby ? 1 : 0;
  const key = [Math.round(rec[5] / 12), opt.r, sh, opt.ph | 0, opt.lie ? 1 : 0, rec[19], rec[20].toFixed(1), rec[21].toFixed(1), rec[22] | 0, rec[23].toFixed(1), rec[24].toFixed(1), ...[82, 83, 84, 85, 86, 87, 88, 89].map(i => rec[i] | 0), (() => { let s = ''; for (let i = 0; i < (rec[19] | 0); i++) s += (rec[26 + i * 7 + 5] | 0) + ((rec[26 + i * 7 + 1] > 0) ? 's' : 'a') + (Math.round(rec[26 + i * 7 + 2] * 4)); return s; })()].join('|');
  let e = crCache.get(key);
  if (e) return e;
  const s = crBuild(rec, opt), cnv = document.createElement('canvas');
  cnv.width = s.W; cnv.height = s.H;
  const cx = cnv.getContext('2d'), img = cx.createImageData(s.W, s.H);
  for (let i = 0; i < s.g.length; i++) { const c = s.P[s.g[i]]; if (c) { const o = i * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c[3]; } }
  cx.putImageData(img, 0, 0);
  let top = s.H;
  for (let y = 0; y < s.H && top === s.H; y++) for (let x = 0; x < s.W; x++) if (s.g[y * s.W + x]) { top = y; break; }
  let x0 = s.W, x1 = 0;
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) if (s.g[y * s.W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  e = { cnv, W: s.W, H: s.H, ox: s.ox, gy: s.gy, A: s.A, hAbove: s.gy - top, wHalf: Math.max(s.ox - x0, x1 - s.ox) };
  e.A.top = top - s.gy;
  if (crCache.size > 400) crCache.delete(crCache.keys().next().value);
  crCache.set(key, e);
  return e;
}
