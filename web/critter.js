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


/* ---------- part atlas compositor (hand drawn parts, recoloured from the genome) ---------- */
const CR_ATL = {};
let crReady = false;
const crTintCache = new Map(), crBaseCache = new Map();
function crAtlasInit() {
  if (typeof CR_ATLAS === 'undefined' || typeof Image === 'undefined') return;
  const names = Object.keys(CR_ATLAS);
  let n = 0;
  for (const k of names) {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      CR_ATL[k] = x.getImageData(0, 0, im.width, im.height);
      if (++n === names.length) { crReady = true; crCache.clear(); }
    };
    im.src = CR_ATLAS[k];
  }
}
function crCellOf(name, i) {
  const a = CR_ATL[name], w = 64, d = new Uint8ClampedArray(w * w * 4), cx = (i % 4) * 64, cy = ((i / 4) | 0) * 64;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const s = ((cy + y) * a.width + cx + x) * 4, o = (y * w + x) * 4; d[o] = a.data[s]; d[o + 1] = a.data[s + 1]; d[o + 2] = a.data[s + 2]; d[o + 3] = a.data[s + 3]; }
  return { w, h: w, d };
}
function crRgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
function crHsv2rgb(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}
function crTint(name, i, hue, acc) {
  const key = name + i + '|' + hue + '|' + acc;
  let p = crTintCache.get(key);
  if (p) return p;
  p = crCellOf(name, i);
  const d = p.d;
  for (let o = 0; o < d.length; o += 4) {
    if (!d[o + 3]) continue;
    const [h, s, v] = crRgb2hsv(d[o], d[o + 1], d[o + 2]);
    if (s < 0.28 && v > 0.7) continue;
    let nh;
    if (h >= 175 && h <= 260) nh = hue; else if (s > 0.3) nh = acc; else continue;
    const c = crHsv2rgb(nh, s, v); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
  }
  if (crTintCache.size > 600) crTintCache.delete(crTintCache.keys().next().value);
  crTintCache.set(key, p);
  return p;
}
function crBBox(p) {
  let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? [0, 0, 0, 0] : [x0, y0, x1 + 1, y1 + 1];
}
/* halve a part; outline pixels win so the contour stays closed */
function crHalf(p) {
  const w = p.w >> 1, h = p.h >> 1, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0, best = -1, bl = 1e9, tl = -1;
    for (let k = 0; k < 4; k++) {
      const s = ((y * 2 + (k >> 1)) * p.w + x * 2 + (k & 1)) * 4;
      if (p.d[s + 3] < 128) continue;
      n++;
      const l = p.d[s] * 0.3 + p.d[s + 1] * 0.59 + p.d[s + 2] * 0.11;
      if (tl < 0) tl = s;
      if (l < bl) { bl = l; best = s; }
    }
    if (n < 2 && !(n === 1 && bl < 90)) continue;
    const s = bl < 95 ? best : tl, o = (y * w + x) * 4;
    d[o] = p.d[s]; d[o + 1] = p.d[s + 1]; d[o + 2] = p.d[s + 2]; d[o + 3] = 255;
  }
  return { w, h, d };
}
function crCrop(p) {
  const b = crBBox(p), w = b[2] - b[0], h = b[3] - b[1], d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = ((y + b[1]) * p.w + x + b[0]) * 4, o = (y * w + x) * 4; d[o] = p.d[s]; d[o + 1] = p.d[s + 1]; d[o + 2] = p.d[s + 2]; d[o + 3] = p.d[s + 3]; }
  return { w, h, d };
}
function crRot(p, deg) {
  const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), W = Math.ceil(Math.abs(p.w * c) + Math.abs(p.h * s)) + 1, H = Math.ceil(Math.abs(p.w * s) + Math.abs(p.h * c)) + 1;
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2, sx = Math.floor(dx * c - dy * s + p.w / 2), sy = Math.floor(dx * s + dy * c + p.h / 2);
    if (sx < 0 || sy < 0 || sx >= p.w || sy >= p.h) continue;
    const a = (sy * p.w + sx) * 4, o = (y * W + x) * 4;
    if (p.d[a + 3] < 128) continue;
    d[o] = p.d[a]; d[o + 1] = p.d[a + 1]; d[o + 2] = p.d[a + 2]; d[o + 3] = 255;
  }
  return { w: W, h: H, d };
}
function crShadeP(p, f) {
  const d = new Uint8ClampedArray(p.d);
  for (let o = 0; o < d.length; o += 4) if (d[o + 3]) { d[o] *= f; d[o + 1] *= f; d[o + 2] *= f * 1.08; }
  return { w: p.w, h: p.h, d };
}
function crBlit(dst, p, x, y) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
    const dx = x + i, dy = y + j;
    if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
    const s = (j * p.w + i) * 4;
    if (!p.d[s + 3]) continue;
    const o = (dy * dst.w + dx) * 4;
    dst.d[o] = p.d[s]; dst.d[o + 1] = p.d[s + 1]; dst.d[o + 2] = p.d[s + 2]; dst.d[o + 3] = 255;
  }
}
function crTailBase(i) {
  let b = crBaseCache.get(i);
  if (b) return b;
  const p = crCellOf('tails', i), d = p.d;
  let ox = 0, oy = 0, n = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const o = (y * 64 + x) * 4; if (d[o + 3] && d[o] > 200 && d[o + 1] > 120 && d[o + 1] < 200 && d[o + 2] < 120) { ox += x; oy += y; n++; } }
  b = [32, 60];
  if (n) {
    ox /= n; oy /= n; let bd = -1;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const o = (y * 64 + x) * 4; if (d[o + 3] && d[o + 2] > d[o]) { const q = (x - ox) ** 2 + (y - oy) ** 2; if (q > bd) { bd = q; b = [x, y]; } } }
  }
  crBaseCache.set(i, b);
  return b;
}
/* muzzle (cream) bounding box of a head part, for the face anchors */
function crMuzzle(p) {
  let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const o = (y * p.w + x) * 4;
    if (!p.d[o + 3]) continue;
    const [h, s, v] = crRgb2hsv(p.d[o], p.d[o + 1], p.d[o + 2]);
    if (s < 0.4 && v > 0.8 && h > 20 && h < 70 && x > p.w * 0.45) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : [x0, y0, x1, y1];
}
const CR_EAR_OK = [0, 1, 2, 3, 6, 7, 8, 9, 11, 12, 13, 14];
function crHash(rec, salt) {
  let h = (2166136261 ^ (salt * 7919)) >>> 0;
  for (const i of [5, 19, 20, 21, 22, 23, 24, 82, 83, 84, 85, 86, 87, 88, 89]) { h ^= Math.round((rec[i] || 0) * 10) + 0x9e3779b9; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  return h >>> 0;
}
function crCompose(rec, opt) {
  const look = [82, 83, 84, 85, 86, 87, 88, 89].map(i => rec[i] | 0);
  const hue = (Math.round(rec[5] / 12) * 12) % 360, accc = crHex(CR_ACC[look[0] % CR_ACC.length]), acc = crRgb2hsv(accc[0], accc[1], accc[2])[0];
  const ph = opt.ph | 0, lie = !!opt.lie, fly = !!opt.fly, nolegs = lie || fly, walk = Math.sin(ph * Math.PI / 2), lift = Math.cos(ph * Math.PI / 2);
  const ih = crHash(rec, 1) % 16, ib = crHash(rec, 2) % 16, ie = CR_EAR_OK[crHash(rec, 3) % CR_EAR_OK.length], it = crHash(rec, 4) % 16, il = crHash(rec, 5) % 16;
  const W = 150, H = 190, dst = { w: W, h: H, d: new Uint8ClampedArray(W * H * 4) };
  const body = crTint('bodies', ib, hue, acc), bb = crBBox(body);
  const head = crTint('heads', ih, hue, acc), hb = crBBox(head);
  const leg = crCrop(crHalf(crTint('legs', il, hue, acc))), legF = crShadeP(leg, 0.78);
  const bx = 55, bodyBottom = H - 4 - (nolegs ? 0 : leg.h - 8);
  const by = bodyBottom - bb[3];
  const legY = by + bb[3] - 8, bw = bb[2] - bb[0], gyF = legY + leg.h;
  let sx = 0, sn = 0;
  for (let y = bb[3] - 14; y < bb[3] - 4; y++) for (let x = 0; x < 64; x++) if (body.d[(y * 64 + x) * 4 + 3]) { sx += x; sn++; }
  const bcx = sn ? sx / sn : (bb[0] + bb[2]) / 2;
  /* wings behind the body (flyers only), mirrored so they spread backwards */
  let nWings = 0;
  for (let i = 0; i < (rec[19] | 0); i++) if (KIND_KEYS[rec[26 + i * 7 + 5] | 0] === 'wing') nWings++;
  if (nWings) {
    const wp = crTint('wings', crHash(rec, 6) % 16, hue, acc), wh = crCrop(wp), wf = { w: wh.w, h: wh.h, d: new Uint8ClampedArray(wh.d.length) };
    for (let y = 0; y < wh.h; y++) for (let x = 0; x < wh.w; x++) { const a = (y * wh.w + x) * 4, o = (y * wh.w + (wh.w - 1 - x)) * 4; for (let k = 0; k < 4; k++) wf.d[o + k] = wh.d[a + k]; }
    const flap = ph ? Math.round(Math.sin(ph * Math.PI / 2) * (fly ? 7 : 3)) : 0;
    crBlit(dst, wf, bx + bb[0] + 18 - wf.w, by + Math.round(bb[3] * 0.42) - wf.h + 4 - flap);
  }
  /* tail behind the body */
  const tp = crTint('tails', it, hue, acc), tbase = crTailBase(it);
  crBlit(dst, tp, bx + bb[0] + 5 - tbase[0], by + Math.round(bb[3] * 0.72) - tbase[1]);
  if (!nolegs) {
    const sw = Math.round(walk * 4), up = ph ? Math.max(0, lift) * 3 : 0, upF = ph ? Math.max(0, -lift) * 3 : 0;
    crBlit(dst, legF, bx + bcx + 3 - leg.w / 2 - sw, legY - Math.round(upF));
  }
  crBlit(dst, body, bx, by);
  if (!nolegs) {
    const sw = Math.round(walk * 4), up = ph ? Math.max(0, lift) * 3 : 0;
    crBlit(dst, leg, bx + bcx - 6 - leg.w / 2 + sw, legY - Math.round(up));
  }
  let nFin = 0;
  for (let i = 0; i < (rec[19] | 0); i++) if (KIND_KEYS[rec[26 + i * 7 + 5] | 0] === 'fin') nFin++;
  if (nFin) {
    const cr = crCrop(crHalf(crTint('crests', crHash(rec, 7) % 16, hue, acc)));
    crBlit(dst, cr, bx + bb[0] - 9, by + bb[1] + Math.round((bb[3] - bb[1]) * 0.62) - cr.h + 3);
  }
  const bob = ph ? (ph % 2 ? 1 : 0) : 0;
  const hx = bx + 38, hy = by + 13 + (lie ? 8 : 0);
  const hpx = hx - ((hb[0] + hb[2]) >> 1) - 2, hpy = hy + 7 - hb[3] + bob * 0;
  crBlit(dst, head, hpx, hpy);
  let nHorn = 0;
  for (let i = 0; i < (rec[19] | 0); i++) if (KIND_KEYS[rec[26 + i * 7 + 5] | 0] === 'weapon') nHorn++;
  if (nHorn) {
    const hrn = crCrop(crHalf(crTint('horns', crHash(rec, 8) % 16, hue, acc))), hcx2 = hpx + (hb[0] + hb[2]) / 2 + 6;
    for (let k = 0; k < Math.min(2, nHorn); k++) crBlit(dst, hrn, hcx2 + k * 9 - hrn.w / 2, hpy + hb[1] + 7 - hrn.h);
  }
  const ear = crRot(crHalf(crTint('ears', ie, hue, acc)), 28), eb = crBBox(ear);
  crBlit(dst, ear, hpx + hb[0] + Math.floor((hb[2] - hb[0]) * 0.08) - eb[0], hpy + hb[1] + Math.floor((hb[3] - hb[1]) * 0.52) - eb[3]);
  /* reduce to final size (x0.5), keep outlines */
  const full = crHalf(dst), fb = crBBox(full), fw = fb[2] - fb[0], fh = fb[3] - fb[1];
  const out = crCrop(full), px = hpx / 2 - fb[0], py = hpy / 2 - fb[1];
  const mz = crMuzzle(head), hcx = (hpx + (hb[0] + hb[2]) / 2) / 2 - fb[0], hcy = (hpy + (hb[1] + hb[3]) / 2) / 2 - fb[1];
  const ox = Math.round((bx + (bb[0] + bb[2]) / 2) / 2 - fb[0]), gy = Math.round(gyF / 2 - fb[1]) - 1;
  const hw = (hb[2] - hb[0]) / 2, mx0 = mz ? (hpx + mz[0]) / 2 - fb[0] : hcx + 4, my0 = mz ? (hpy + mz[1]) / 2 - fb[1] : hcy, mx1 = mz ? (hpx + mz[2]) / 2 - fb[0] : hcx + 10, my1 = mz ? (hpy + mz[3]) / 2 - fb[1] : hcy + 6;
  const u = x => x - ox, v = y => y - gy;
  const eyeX = Math.round(mx0 + (mx1 - mx0) * 0.3), eyeY = Math.round(my0 - 2);
  const A = {
    hu: u(hcx), hv: v(hcy), hr: Math.round(hw / 2), ew: 5, eh: 6, top: v(0), legL: nolegs ? 0 : Math.round(leg.h / 2), a: Math.round(bw / 4), b: Math.round((bb[3] - bb[1]) / 4), bcv: v(by / 2 - fb[1] + (bb[1] + bb[3]) / 4),
    iris: CR_IRIS[look[2] % CR_IRIS.length], cheek: CR_CHEEK[look[4] % CR_CHEEK.length], cheekKind: look[4], ear: 0, earH: 8, nLegs: 2, nseg: 1,
    face: { eye: [u(eyeX), v(eyeY)], nose: [u(mx1 - 1), v(my0 + 1)], mouth: [u((mx0 + mx1) / 2 - 1), v(my1 - 2)], cheek: [u(mx0 - 3), v(my0 + 1)], hat: [u(hcx), v(hpy / 2 - fb[1] + 4)] }
  };
  return { out, ox, gy, A };
}
crAtlasInit();

function crFinish(c, opt) {
  const { out, ox, gy, A } = c, cnv = document.createElement('canvas');
  cnv.width = out.w; cnv.height = out.h;
  const cx = cnv.getContext('2d'), img = cx.createImageData(out.w, out.h);
  img.data.set(out.d); cx.putImageData(img, 0, 0);
  let x0 = out.w, x1 = 0, top = out.h;
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) if (out.d[(y * out.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < top) top = y; }
  A.top = top - gy;
  return { cnv, W: out.w, H: out.h, ox, gy, A, hAbove: gy - top, wHalf: Math.max(ox - x0, x1 - ox) };
}

function crSprite(rec, opt) {
  const sh = opt.baby ? 1 : 0;
  let key = [Math.round(rec[5] / 12), opt.r, sh, opt.ph | 0, opt.lie ? 1 : opt.fly ? 2 : 0, rec[19], rec[20].toFixed(1), rec[21].toFixed(1), rec[22] | 0, rec[23].toFixed(1), rec[24].toFixed(1), ...[82, 83, 84, 85, 86, 87, 88, 89].map(i => rec[i] | 0), (() => { let s = ''; for (let i = 0; i < (rec[19] | 0); i++) s += (rec[26 + i * 7 + 5] | 0) + ((rec[26 + i * 7 + 1] > 0) ? 's' : 'a') + (Math.round(rec[26 + i * 7 + 2] * 4)); return s; })()].join('|');
  if (crReady) key += '|A';
  let e = crCache.get(key);
  if (e) return e;
  if (crReady) {
    e = crScaleSprite(crFinish(crCompose(rec, opt), opt), opt);
    if (crCache.size > 400) crCache.delete(crCache.keys().next().value);
    crCache.set(key, e);
    return e;
  }
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

/* size gene / age: nearest-neighbour rescale of the finished sprite */
function crScaleSprite(e, opt) {
  const m = Math.max(0.6, Math.min(1.0, Math.round((opt.r / 22) * 20) / 20));
  if (m >= 0.99) return e;
  const w = Math.max(1, Math.round(e.W * m)), h = Math.max(1, Math.round(e.H * m)), c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(e.cnv, 0, 0, w, h);
  const A = e.A, f = q => Math.round(q * m);
  const A2 = Object.assign({}, A, { hu: A.hu * m, hv: A.hv * m, hr: Math.max(3, f(A.hr)), top: A.top * m, legL: f(A.legL), a: f(A.a), b: f(A.b), bcv: A.bcv * m });
  if (A.face) { const g = k => [A.face[k][0] * m, A.face[k][1] * m]; A2.face = { eye: g('eye'), nose: g('nose'), mouth: g('mouth'), cheek: g('cheek'), hat: g('hat') }; }
  return { cnv: c, W: w, H: h, ox: f(e.ox), gy: f(e.gy), A: A2, hAbove: e.hAbove * m, wHalf: e.wHalf * m };
}

/* wild view: the same hand drawn sprite, scaled to the creature size, mirrored by heading */
function crDrawWild(cs, o, px, py, r, baby, moving, st, hp) {
  if (!crReady) return false;
  const rec = cs.subarray(o, o + CS_STRIDE), sl = cs[o + 12], dir = cs[o + 3];
  const fly = cs[o + 9] > 0;
  const ph = fly ? 1 + (((st.animT >> 1) + (cs[o] | 0)) % 4) : moving ? 1 + ((st.animT >> 2) % 4) : 0;
  const sp = crSprite(rec, { r: 22, baby: false, ph, lie: false, fly });
  if (fly) py -= Math.round(r * 0.8 + 2 + Math.sin(st.animT * 0.12 + (cs[o] | 0)) * 1.3);
  const k = Math.max(0.2, (r * 2.7) / Math.max(1, sp.hAbove)), w = Math.max(1, Math.round(sp.W * k)), h = Math.max(1, Math.round(sp.H * k));
  const flip = Math.cos(dir) < 0 ? -1 : 1, gy = Math.round(py + (sp.hAbove * k) / 2), ox = Math.round(sp.ox * k), goy = Math.round(sp.gy * k);
  st.sprTop = gy - Math.round(sp.hAbove * k);
  b.imageSmoothingEnabled = k < 0.8;
  if (flip > 0) b.drawImage(sp.cnv, px - ox, gy - goy, w, h);
  else { b.save(); b.translate(px + ox, 0); b.scale(-1, 1); b.drawImage(sp.cnv, 0, gy - goy, w, h); b.restore(); }
  b.imageSmoothingEnabled = false;
  const F = sp.A.face;
  if (F && r >= 7) {
    const ew = Math.max(1, Math.round(sp.A.ew * k)), eh = Math.max(2, Math.round(sp.A.eh * k)), ex = px + flip * Math.round(F.eye[0] * k) - (flip > 0 ? 0 : ew - 1), ey = gy + Math.round(F.eye[1] * k) - (eh >> 1);
    b.fillStyle = '#fffaf2'; b.fillRect(ex - 1, ey - 1, ew + 2, eh + 2);
    b.fillStyle = sl ? '#3a2f58' : '#2a2450';
    if (sl) b.fillRect(ex, ey + (eh >> 1), ew, 1); else b.fillRect(ex, ey, ew, eh);
    if (!sl && ew >= 2) { b.fillStyle = '#ffffff'; b.fillRect(ex, ey, 1, 1); }
  }
  return true;
}
