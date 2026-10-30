'use strict';
/* Wildlinge graphics: pixel terrain and creatures with mutable shapes (elongation, boxiness, segments, head, taper). */
const WORLD_W = 4000, WORLD_H = 2400, TAU = Math.PI * 2, VIEW_W = 1600, VIEW_H = 800, YEAR_LEN = 6000, DAY_LEN = 400, CS_STRIDE = 90, MEAT_DECAY = 1500;
const S = 2, BW = Math.ceil(VIEW_W / S), BH = Math.ceil(VIEW_H / S), TPX = 3;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rp = Math.round;
const OUTLINE = '#141912';
const KIND_KEYS = ['leg', 'fin', 'wing', 'weapon', 'armor', 'sense', 'storage', 'insul', 'display', 'bud'];
const EYE_COL = ['#3b3354', '#4a8be0', '#3fae6a', '#a0642c', '#9a58d0', '#e8b030', '#e0507a', '#30c0d0'];
const CHEEK_COL = ['rgba(255,130,170,.85)', 'rgba(255,170,90,.85)', null, 'rgba(120,180,255,.85)'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const bufCanvas = document.createElement('canvas');
bufCanvas.width = BW;
bufCanvas.height = BH;
const b = bufCanvas.getContext('2d');

/* ---------- noise and terrain ---------- */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(ix, iy, s) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(ix, iy, s), q = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (q - a) * sx + (c - a) * sy + (a - q - c + d) * sx * sy;
}
const PAL = {
  summer: [
    ['#17589d', '#1d65a7', '#2974b3', '#3281bd'], ['#46c9c5', '#51d2cc', '#66d3cb', '#7ad9ce'],
    ['#41a239', '#4bad3b', '#5db240', '#69b944'], ['#1c5827', '#1c711e', '#287e29', '#2e7930'],
    ['#dca467', '#e7ac67', '#ebba6f', '#f2cb7c'], ['#98b6c4', '#a5c0cb', '#acc7d1', '#bcdbe4']
  ],
  winter: [
    ['#3a78b4', '#4082bc', '#488cc4', '#5096cc'], ['#cfe6f2', '#d9ecf6', '#e3f2f9', '#edf7fc'],
    ['#d5e3ea', '#dfeaf0', '#e8f1f5', '#f1f7fa'], ['#9db3bd', '#aabfc8', '#b8cad2', '#c6d5db'],
    ['#cdbf9f', '#d6c9ab', '#dfd3b8', '#e7ddc4'], ['#cfd6dd', '#dbe1e7', '#e7ebf0', '#f3f5f8']
  ]
};
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/* decoration stamps cut from the tile sheets (raw RGBA) */
const stampCache = {};
function stampOf(group, rnd) {
  if (typeof TILE_STAMPS === 'undefined') return null;
  const lst = TILE_STAMPS[group];
  if (!lst || !lst.length) return null;
  const i = (rnd * lst.length) | 0, key = group + i;
  let c = stampCache[key];
  if (!c) {
    const s = lst[i], bin = atob(s.d), cv = document.createElement('canvas');
    cv.width = s.w; cv.height = s.h;
    const cx = cv.getContext('2d'), im = cx.createImageData(s.w, s.h);
    for (let k = 0; k < bin.length; k++) im.data[k] = bin.charCodeAt(k);
    cx.putImageData(im, 0, 0);
    c = stampCache[key] = cv;
  }
  return c;
}
function drawStamp(x2, group, x, y, rnd) {
  const c = stampOf(group, rnd);
  if (!c) return false;
  x2.drawImage(c, x - (c.width >> 1), y - c.height + 1);
  return true;
}

function drawTree(x2, x, y, winter, big) {
  const o = winter ? ['#5d6f76', '#9fb4ba', '#e3eef2', '#ffffff'] : ['#2b6a3c', '#3f9a56', '#62c070', '#a8ea90'];
  x2.fillStyle = winter ? '#3a2e24' : '#4a3020'; x2.fillRect(x, y + 2, 2, 3);
  x2.fillStyle = o[0]; x2.fillRect(x - 3, y - 1, 8, 4); x2.fillRect(x - 2, y - 3, 6, 3); x2.fillRect(x - 1, y - 5, 4, 3);
  x2.fillStyle = o[1]; x2.fillRect(x - 2, y - 1, 6, 3); x2.fillRect(x - 1, y - 3, 4, 2); x2.fillRect(x, y - 4, 2, 1);
  x2.fillStyle = o[2]; x2.fillRect(x - 2, y - 1, 3, 1); x2.fillRect(x - 1, y - 3, 2, 1);
  x2.fillStyle = o[3]; x2.fillRect(x - 1, y - 3, 1, 1);
  if (big && !winter) { x2.fillStyle = '#d2485a'; x2.fillRect(x + 2, y, 1, 1); }
}
function buildTerrain(map, winter, seed) {
  const { gw, gh, bio } = map, tw = Math.ceil(WORLD_W / TPX), th = Math.ceil(WORLD_H / TPX), c2 = document.createElement('canvas');
  c2.width = tw; c2.height = th;
  const x2 = c2.getContext('2d'), img = x2.createImageData(tw, th), d = img.data;
  const pal = (winter ? PAL.winter : PAL.summer).map(row => row.map(hexRgb));
  const bioAt = (wx, wy) => bio[clamp((wy / 20) | 0, 0, gh - 1) * gw + clamp((wx / 20) | 0, 0, gw - 1)];
  const cls = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const wx = x * TPX + 1.5, wy = y * TPX + 1.5;
      const jx = (vnoise(wx / 45, wy / 45, seed + 1) - 0.5) * 26, jy = (vnoise(wx / 45 + 50, wy / 45, seed + 2) - 0.5) * 26;
      const bi = bioAt(wx + jx, wy + jy);
      cls[y * tw + x] = bi;
      const fine = vnoise(wx / 9, wy / 9, seed + 3) * 0.55 + vnoise(wx / 30, wy / 30, seed + 4) * 0.45;
      const lvl = fine * 4 + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 1.1;
      let col = pal[bi][clamp(lvl | 0, 0, 3)];
      if (bi === 5 && vnoise(wx / 90, wy / 90, seed + 5) > 0.68) col = winter ? [250, 252, 253] : [232, 238, 242];
      const o = (y * tw + x) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  /* shore foam and darker deep-water rim */
  const foam = winter ? [244, 250, 252] : [214, 236, 244];
  for (let y = 2; y < th - 2; y++) {
    for (let x = 2; x < tw - 2; x++) {
      const bi = cls[y * tw + x];
      if (bi > 1) continue;
      const near = cls[y * tw + x - 2] > 1 || cls[y * tw + x + 2] > 1 || cls[(y - 2) * tw + x] > 1 || cls[(y + 2) * tw + x] > 1;
      if (near && ((x + y) & 1) === 0) { const o = (y * tw + x) * 4; d[o] = foam[0]; d[o + 1] = foam[1]; d[o + 2] = foam[2]; }
    }
  }
  /* beach band on land next to water, wet sand and a light surf line on the water side */
  if (!winter) {
    const out = new Uint8ClampedArray(d), isW = (x, y) => cls[y * tw + x] <= 1;
    for (let y = 4; y < th - 4; y++) for (let x = 4; x < tw - 4; x++) {
      const bi = cls[y * tw + x], o = (y * tw + x) * 4;
      let dist = 9;
      for (let k = 1; k <= 4 && dist === 9; k++) if (isW(x - k, y) !== isW(x, y) || isW(x + k, y) !== isW(x, y) || isW(x, y - k) !== isW(x, y) || isW(x, y + k) !== isW(x, y)) dist = k;
      if (dist === 9) continue;
      const nz = vnoise(x / 5, y / 5, seed + 9);
      if (bi === 2 || bi === 3) {
        if (dist <= 2 + (nz > 0.5 ? 1 : 0)) { const c = dist === 1 ? [235, 186, 111] : (nz > 0.45 ? [242, 203, 124] : [231, 172, 103]); out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; }
      } else if (bi === 1) {
        if (dist === 1) { out[o] = 222; out[o + 1] = 246; out[o + 2] = 240; }
        else if (dist === 2) { out[o] = 154; out[o + 1] = 222; out[o + 2] = 206; }
      }
    }
    d.set(out);
  }
  x2.putImageData(img, 0, 0);
  const rng = mulberry32(seed * 31 + 7);
  const N = Math.floor(tw * th / 35);
  for (let i = 0; i < N; i++) {
    const x = (rng() * (tw - 8) + 4) | 0, y = (rng() * (th - 8) + 4) | 0, bi = cls[y * tw + x], r = rng();
    if (bi === 3) {
      if (r < 0.5) drawTree(x2, x, y, winter, r < 0.06);
      else if (r < 0.8 && drawStamp(x2, winter ? 'snow' : 'grass', x, y, rng())) { /* stamp */ }
      else { x2.fillStyle = winter ? '#e9f0f3' : '#3f7a33'; x2.fillRect(x, y - 1, 1, 2); x2.fillRect(x + 1, y, 1, 1); }
    } else if (bi === 2) {
      if (r < 0.7 && drawStamp(x2, winter ? 'snow' : 'grass', x, y, rng())) { /* stamp */ }
      else if (r < 0.5) {
        x2.fillStyle = winter ? '#ffffff' : '#78a84c'; x2.fillRect(x, y - 1, 1, 2);
        x2.fillStyle = winter ? '#b8c6cf' : '#2f4d27'; x2.fillRect(x - 1, y, 1, 1); x2.fillRect(x + 1, y, 1, 1);
      } else if (!winter && r < 0.62) {
        const c = ['#f2d24a', '#f07ab0', '#ffffff', '#8fb8ff', '#ff9a4a'][(rng() * 5) | 0];
        x2.fillStyle = c; x2.fillRect(x - 1, y, 3, 1); x2.fillRect(x, y - 1, 1, 3);
        x2.fillStyle = '#f2d24a'; x2.fillRect(x, y, 1, 1);
      } else if (r < 0.66) {
        x2.fillStyle = winter ? '#9aa6ae' : '#6b6e66'; x2.fillRect(x, y, 3, 2);
        x2.fillStyle = winter ? '#ffffff' : '#9c9e92'; x2.fillRect(x, y, 2, 1);
      }
    } else if (bi === 4) {
      if (r > 0.45 && r < 0.7 && drawStamp(x2, 'sand', x, y, rng())) { /* stamp */ }
      else if (r < 0.2) {
        x2.fillStyle = winter ? '#6d7f5a' : '#3f6a2a'; x2.fillRect(x, y - 3, 2, 5); x2.fillRect(x - 2, y - 2, 2, 1); x2.fillRect(x + 2, y - 1, 2, 1);
        x2.fillStyle = winter ? '#dfe8d8' : '#7fb04a'; x2.fillRect(x, y - 3, 1, 3);
      } else if (r < 0.4) {
        x2.fillStyle = '#8a7340'; x2.fillRect(x, y, 3, 1);
        x2.fillStyle = '#e0cd92'; x2.fillRect(x, y - 1, 2, 1);
      }
    } else if (bi === 5) {
      if (r > 0.55 && r < 0.75 && drawStamp(x2, r > 0.7 ? 'rock' : 'snow', x, y, rng())) { /* stamp */ }
      else if (r < 0.1) {
        x2.fillStyle = '#2f302b'; x2.fillRect(x, y + 1, 4, 1); x2.fillRect(x + 1, y - 1, 3, 2);
        x2.fillStyle = winter ? '#d8e0e4' : '#8a8c80'; x2.fillRect(x + 1, y, 3, 1);
        x2.fillStyle = '#ffffff'; x2.fillRect(x + 1, y - 1, 2, 1);
      }
    } else if (bi === 1 && !winter && r < 0.18) {
      x2.fillStyle = '#4a8a46'; x2.fillRect(x, y, 3, 2);
      x2.fillStyle = '#7fc46a'; x2.fillRect(x, y, 2, 1);
      if (r < 0.03) { x2.fillStyle = '#ffb6d0'; x2.fillRect(x + 1, y - 1, 1, 1); }
    }
  }
  return c2;
}
function buildMini(map) {
  const c2 = document.createElement('canvas');
  c2.width = map.gw; c2.height = map.gh;
  const x2 = c2.getContext('2d'), img = x2.createImageData(map.gw, map.gh), d = img.data;
  const pal = PAL.summer.map(row => hexRgb(row[2]));
  for (let i = 0; i < map.bio.length; i++) { const col = pal[map.bio[i]] || pal[2], o = i * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; }
  x2.putImageData(img, 0, 0);
  return c2;
}
function biomeAt(map, wx, wy) {
  return map.bio[clamp((wy / 20) | 0, 0, map.gh - 1) * map.gw + clamp((wx / 20) | 0, 0, map.gw - 1)];
}
function windAt(x, y, t) {
  return { x: 0.25 * Math.sin(y / 180 + t / 900), y: 0.25 * Math.cos(x / 220 - t / 1100) };
}

/* ---------- body geometry from shape genes (chibi proportions: big head, small soft body) ---------- */
function geom(r, sh, baby, ts) {
  const e = sh[0], bx = sh[1], seg = clamp(Math.floor(sh[2]), 1, 6), hd = sh[3], tp = sh[4];
  const a = r * 0.85 * (1 + 0.5 * e), bb = Math.max(1, r * 0.85 * (1 - 0.2 * e)), n = 2 + 2 * bx;
  const segs = [];
  let u = 0;
  for (let k = 0; k < seg; k++) {
    const s = Math.max(0.4, 1 - (seg > 3 ? 0.11 : 0.18) * k), ak = seg > 1 ? a * (seg > 3 ? 0.5 : 0.68) * s : a, bk = bb * s * (seg > 3 ? 0.8 : 1);
    if (k > 0) u -= segs[k - 1].a * 0.8 + ak * 0.8;
    segs.push({ u, a: ak, b: bk });
  }
  const rh = Math.max(1.6, r * (0.72 + 0.3 * hd) * (baby ? 1.2 : 1));
  const uh = segs[0].a * 0.75;
  const last = segs[seg - 1], umin = last.u - last.a, lb = last.b;
  const tail = [];
  if (ts === 1) tail.push([umin - Math.max(1.2, lb * 0.3), 0, Math.max(1.4, lb * 0.38)]);
  else if (ts === 2) for (let k = 0; k < 6; k++) tail.push([umin - 0.5 - k * Math.max(1.3, lb * 0.4), 0, Math.max(0.8, lb * 0.3 * (1 - k * 0.13))]);
  else if (ts === 3) for (let k = 0; k < 9; k++) { const q = k / 8; tail.push([umin - 0.5 - q * lb * 2.0, Math.sin(q * 4.2) * lb * 0.55 * q, Math.max(0.8, lb * 0.3 * (1 - q * 0.5))]); }
  else if (ts === 4) tail.push([umin - Math.max(1.5, lb * 0.55), 0, Math.max(1.8, lb * 0.65)]);
  else if (ts === 5) for (let k = -2; k <= 2; k++) tail.push([umin - Math.max(1.5, lb * 0.6) - Math.abs(k) * 0.2, k * Math.max(1, lb * 0.32), Math.max(0.9, lb * 0.34)]);
  let tmin = umin, tv = 0;
  for (const q of tail) { tmin = Math.min(tmin, q[0] - q[2]); tv = Math.max(tv, Math.abs(q[1]) + q[2]); }
  const umax = Math.max(segs[0].a, uh + rh);
  const R = Math.ceil(Math.max(umax, -tmin, bb, tv, rh * 1.7, uh + rh * 1.3)) + 2;
  return { segs, n, tp, rh, uh, umax, umin, tmin, tail, R };
}
/* 0 = outside, 1 = body, 2 = inner ear */
function inBody(g, u, v, ear, top) {
  const rh = g.rh, du = u - g.uh;
  if (du * du + v * v <= rh * rh) return 1;
  for (const s of g.segs) {
    const uu = u - s.u;
    let bt = s.b * (1 + g.tp * 0.35 * clamp(uu / s.a, -1, 1));
    if (bt < 0.6) bt = 0.6;
    if (Math.pow(Math.abs(uu) / s.a, g.n) + Math.pow(Math.abs(v) / bt, g.n) <= 1) return 1;
  }
  for (const q of g.tail) { const dq = u - q[0], dv = v - q[1]; if (dq * dq + dv * dv <= q[2] * q[2]) return 1; }
  const er = Math.max(1.2, rh * 0.42), eu = g.uh - rh * 0.4, av = top ? -v : Math.abs(v);
  if (top && v > 0) return 0;
  if (ear === 0) {
    const ev = rh * 0.78, d2 = (u - eu) * (u - eu) + (av - ev) * (av - ev);
    if (d2 <= er * er) return d2 <= er * er * 0.3 && er >= 1.8 ? 2 : 1;
  } else if (ear === 1) {
    const ev = rh * 0.85, q = Math.pow((u - eu) / (er * 0.8), 2) + Math.pow((av - ev) / (er * 1.5), 2);
    if (q <= 1) return q <= 0.35 && er >= 1.8 ? 2 : 1;
  } else if (ear === 2) {
    const ev = rh * 0.95;
    if (Math.pow((u - eu + er * 0.9) / (er * 1.4), 2) + Math.pow((av - ev) / (er * 0.85), 2) <= 1) return 1;
  }
  return 0;
}
function rhoAt(g, th) {
  const s0 = g.segs[0], c = Math.cos(th), s = Math.sin(th);
  let rho = (s0.a * s0.b) / Math.sqrt((s0.b * c) ** 2 + (s0.a * s) ** 2);
  if (c < -0.3 && g.segs.length > 1) rho += (-g.umin - s0.a) * -c;
  return rho;
}

const spriteCache = new Map();
function bodySprite(hue, r, carn, light, look, dirQ, sh, baby, side) {
  const qe = Math.round(sh[0] * 3) / 3, qb = Math.round(sh[1] * 2) / 2, qh = Math.round(sh[3] * 3) / 3, qt = Math.round(sh[4] * 2) / 2, seg = clamp(Math.floor(sh[2]), 1, 6);
  const key = `${hue}|${r}|${light}|${look[0]}|${look[1]}|${look[3]}|${look[7]}|${dirQ}|${qe}|${qb}|${seg}|${qh}|${qt}|${baby}|${side ? 1 : 0}`;
  let ent = spriteCache.get(key);
  if (ent) return ent;
  if (spriteCache.size > 4000) spriteCache.clear();
  const g = geom(r, [qe, qb, seg, qh, qt], baby, look[7]), R = g.R, d = 2 * R + 1;
  const ang = dirQ * TAU / 16, ca = Math.cos(ang), sa = Math.sin(ang);
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = d;
  const x = cnv.getContext('2d');
  const mask = new Uint8Array(d * d);
  for (let py = 0; py < d; py++) {
    for (let px = 0; px < d; px++) {
      const dx = px - R, dy = py - R, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      mask[py * d + px] = inBody(g, u, v, look[3], side);
    }
  }
  const accH = (look[0] * 30 + 15) % 360;
  for (let py = 0; py < d; py++) {
    for (let px = 0; px < d; px++) {
      const m = mask[py * d + px];
      if (!m) continue;
      const dx = px - R, dy = py - R, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      const edge = px === 0 || py === 0 || px === d - 1 || py === d - 1 || !mask[py * d + px - 1] || !mask[py * d + px + 1] || !mask[(py - 1) * d + px] || !mask[(py + 1) * d + px];
      const shade = (dx + dy) / (2 * R + 1);
      let L = light + (shade < -0.3 ? 5 : shade > 0.35 ? -7 : 0);
      if (!edge) {
        if (!mask[(py - 1) * d + px] || !mask[py * d + px - 1]) L += 6;
        else if (!mask[(py + 1) * d + px] || !mask[py * d + px + 1]) L -= 6;
      }
      const dh = u - g.uh;
      if (dh > g.rh * 0.2 && dh * dh + v * v <= g.rh * g.rh && Math.abs(v) < g.rh * 0.6) L += 7;
      let useAcc = false;
      if (!edge && r >= 3) {
        const ru = Math.round(u), rv = Math.round(v), bs = g.segs[0].b;
        switch (look[1]) {
          case 1: useAcc = (ru * 7 + rv * 13 + 1000) % 5 === 0; break;
          case 2: useAcc = ((ru % 3) + 3) % 3 === 0 && Math.abs(v) < bs - 0.5; break;
          case 3: useAcc = hash2(Math.floor(u / 2.5), Math.floor(v / 2.5), 9) > 0.62; break;
          case 4: useAcc = Math.abs(v) < bs * 0.4 && u < g.segs[0].a * 0.2 && u > g.umin * 0.9; break;
          case 5: useAcc = dh > -g.rh * 0.1 && dh * dh + v * v <= g.rh * g.rh && Math.abs(v) > g.rh * 0.15; break;
        }
      }
      if (edge) x.fillStyle = `hsl(${hue},38%,${Math.max(30, light - 30)}%)`;
      else if (m === 2) x.fillStyle = `hsl(350,80%,${Math.min(90, light + 6)}%)`;
      else if (useAcc) x.fillStyle = `hsl(${accH},70%,${Math.min(90, L + 2)}%)`;
      else x.fillStyle = `hsl(${hue},60%,${Math.min(95, L)}%)`;
      x.fillRect(px, py, 1, 1);
    }
  }
  if (r >= 3) {
    const hx = R + Math.cos(ang) * g.uh, hy = R + Math.sin(ang) * g.uh;
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.fillRect(rp(hx - g.rh * 0.5), rp(hy - g.rh * 0.6), 2, 1);
    x.fillRect(rp(hx - g.rh * 0.5), rp(hy - g.rh * 0.6) + 1, 1, 1);
  }
  ent = { cnv, g, ang, R };
  spriteCache.set(key, ent);
  return ent;
}

/* ---------- parts: soft paws, feelers, wings and crests ---------- */
const BACK_KINDS = new Set(['leg', 'fin', 'wing', 'insul', 'storage', 'sense', 'bud']);
function drawPart(cs, o, i, side, px, py, g, front, st) {
  const q = o + 26 + i * 7, kind = KIND_KEYS[cs[q + 5]] || 'bud';
  if (BACK_KINDS.has(kind) === front) return;
  const a0 = side * cs[q], len = cs[q + 2], wid = cs[q + 3], mot = cs[q + 4], col = cs[q + 6];
  const dir = cs[o + 3], hue = st.hue, sl = cs[o + 12], spd = cs[o + 18];
  const wig = mot > 0.3 && !sl ? Math.sin(st.animT * 0.3 * (0.3 + spd) + i * 1.7 + (side < 0 ? 1.5 : 0)) * 0.3 * mot : 0;
  const ang = dir + a0 + wig, ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
  const rho = rhoAt(g, a0 + wig), r = g.segs[0].b;
  const cap = 2 + Math.floor(r / 4);
  const L = Math.min(cap + (kind === 'wing' || kind === 'fin' || kind === 'display' ? 2 : 0), Math.max(1, rp(len * r * 1.3) + 1));
  let fill;
  switch (kind) {
    case 'leg': fill = `hsl(${hue},48%,66%)`; break;
    case 'fin': fill = `hsl(${(hue + 170) % 360},70%,86%)`; break;
    case 'wing': fill = `hsl(${(hue + 20) % 360},60%,95%)`; break;
    case 'weapon': fill = '#fff4d6'; break;
    case 'armor': fill = `hsl(${hue},28%,74%)`; break;
    case 'sense': fill = `hsl(${hue},48%,64%)`; break;
    case 'storage': fill = `hsl(${hue},60%,88%)`; break;
    case 'insul': fill = `hsl(${hue},50%,${86 + col * 6}%)`; break;
    case 'display': fill = `hsl(${(hue + 180) % 360},80%,84%)`; break;
    default: fill = `hsl(${hue},52%,72%)`;
  }
  const ls = cs[o + 88] | 0;
  if (ls > 0 && (kind === 'leg' || kind === 'weapon' || kind === 'sense' || kind === 'bud' || kind === 'display')) {
    const tl = ls === 1 ? Math.max(5, rp(len * r * 2.6) + 4) : ls === 2 ? Math.max(4, rp(len * r * 1.8) + 3) : Math.max(3, rp(len * r * 1.5) + 2);
    const ph = st.animT * 0.12 + i * 1.3 + (side < 0 ? 1.7 : 0), amp = (0.8 + 1.4 * mot) * (sl ? 0.3 : 1);
    let lx = 0, ly = 0;
    for (let j = 0; j < tl; j++) {
      const w = ls === 1 ? Math.sin(j * 0.55 - ph) * amp * Math.min(1, j / 3) : ls === 3 ? Math.sin(ph * 0.5 + j) * 0.3 : 0;
      const qx = px + ux * (rho + j) + vx * w, qy = py + uy * (rho + j) + vy * w;
      b.fillStyle = ls === 1 && j % 3 === 2 ? `hsl(${hue},55%,84%)` : fill;
      b.fillRect(rp(qx), rp(qy), 1, 1);
      if (ls === 1 && j < tl * 0.55) b.fillRect(rp(qx + vx), rp(qy + vy), 1, 1);
      if (ls === 3 && j > 0 && j % 2 === 0) { b.fillStyle = `hsl(${(hue + 25) % 360},60%,90%)`; b.fillRect(rp(qx + vx), rp(qy + vy), 1, 1); b.fillRect(rp(qx - vx), rp(qy - vy), 1, 1); }
      lx = qx; ly = qy;
    }
    if (ls === 2) {
      const eyeBall = kind === 'sense' || kind === 'leg';
      b.fillStyle = eyeBall ? '#ffffff' : `hsl(${(hue + 150) % 360},70%,78%)`;
      b.fillRect(rp(lx) - 1, rp(ly) - 1, 3, 3);
      if (eyeBall) { b.fillStyle = '#2a2236'; b.fillRect(rp(lx), rp(ly), 1, 1); }
    } else {
      b.fillStyle = '#ff9db8';
      b.fillRect(rp(lx), rp(ly), 1, 1);
    }
    return;
  }
  b.fillStyle = fill;
  if (kind === 'armor') {
    for (let k = -1; k <= 1; k++) { const a2 = dir + a0 + k * 0.45; b.fillRect(rp(px + Math.cos(a2) * (rho - 0.5)), rp(py + Math.sin(a2) * (rho - 0.5)), 2, 2); }
    return;
  }
  if (kind === 'storage') { b.fillRect(rp(px + ux * (rho + 1)) - 1, rp(py + uy * (rho + 1)) - 1, 3, 3); return; }
  if (kind === 'insul') {
    for (let k = -2; k <= 2; k++) { const a2 = dir + a0 + k * 0.3; b.fillRect(rp(px + Math.cos(a2) * (rho + 0.6)), rp(py + Math.sin(a2) * (rho + 0.6)), 1, 1); b.fillRect(rp(px + Math.cos(a2) * (rho + 1.6)), rp(py + Math.sin(a2) * (rho + 1.6)), 1, 1); }
    return;
  }
  const wide = kind === 'fin' || kind === 'wing' || kind === 'display';
  if (wide) b.globalAlpha = 0.9;
  for (let j = 0; j < L; j++) {
    const qx = px + ux * (rho + j), qy = py + uy * (rho + j);
    b.fillRect(rp(qx), rp(qy), 1, 1);
    if (wide) {
      const sw = Math.max(1, rp(wid * (kind === 'wing' ? Math.min(j + 1, L - j) : j + 1) * 0.8));
      for (let s = 1; s <= sw; s++) b.fillRect(rp(qx - vx * s * side), rp(qy - vy * s * side), 1, 1);
    } else if (kind === 'leg' || (kind === 'weapon' && j === 0)) b.fillRect(rp(qx + vx), rp(qy + vy), 1, 1);
  }
  if (wide) b.globalAlpha = 1;
  const ex = px + ux * (rho + L - 1), ey = py + uy * (rho + L - 1);
  if (kind === 'leg') {
    b.fillStyle = `hsl(${hue},45%,52%)`;
    b.fillRect(rp(ex), rp(ey), 2, 2);
    b.fillStyle = `hsl(${hue},50%,80%)`;
    b.fillRect(rp(ex), rp(ey), 1, 1);
  }
  if (kind === 'sense') { b.fillStyle = '#fff09a'; b.fillRect(rp(px + ux * (rho + L)), rp(py + uy * (rho + L)), 2, 2); }
}

/* ---------- cute face on the head ---------- */
function drawFace(cs, o, px, py, ent, look, carn, st) {
  const g = ent.g, ang = ent.ang, fx = Math.cos(ang), fy = Math.sin(ang), qx = -fy, qy = fx;
  const hx = px + fx * g.uh, hy = py + fy * g.uh, rh = g.rh;
  const sl = cs[o + 12], fear = cs[o + 10], wb = cs[o + 13], baby = cs[o + 25];
  if (rh < 2.6) { b.fillStyle = '#2a2236'; b.fillRect(rp(hx + fx * rh * 0.5 - 0.5), rp(hy + fy * rh * 0.5 - 0.5), 1, 1); return; }
  const sep = Math.max(1.3, rh * 0.5), cx = hx + fx * rh * 0.2, cy = hy + fy * rh * 0.2;
  let es = Math.max(2, Math.min(6, rp(rh * 0.45))) + (baby && rh >= 4 ? 1 : 0);
  if (fear > 0.6 && !sl) es += 1;
  const blink = ((st.animT + (cs[o] | 0) * 13) % 170) < 5;
  for (const sd of [-1, 1]) {
    const ex = rp(cx + qx * sd * sep - es / 2), ey = rp(cy + qy * sd * sep - es / 2);
    if (sl || blink) { b.fillStyle = '#4a3a58'; b.fillRect(ex, ey + (es >> 1), es, 1); if (es >= 3) { b.fillRect(ex, ey + (es >> 1) - 1, 1, 1); b.fillRect(ex + es - 1, ey + (es >> 1) - 1, 1, 1); } continue; }
    b.fillStyle = fear > 0.6 ? '#c03a50' : EYE_COL[look[2]] || '#3b3354';
    if (es >= 3) { b.fillRect(ex + 1, ey, es - 2, es); b.fillRect(ex, ey + 1, es, es - 2); } else b.fillRect(ex, ey, es, es);
    b.fillStyle = '#1b1226';
    if (es >= 4) { const ps = Math.max(2, es - 3); b.fillRect(ex + ((es - ps) >> 1) + rp(fx * 0.5), ey + ((es - ps) >> 1) + rp(fy * 0.5) + 1, ps, ps); }
    else if (es === 3) b.fillRect(ex + 1 + rp(fx * 0.5), ey + 1 + rp(fy * 0.5), 1, 1);
    else b.fillRect(ex, ey, es, es);
    b.fillStyle = '#ffffff';
    b.fillRect(ex + (es >= 3 ? 1 : 0), ey, 1, 1);
    if (es >= 4) b.fillRect(ex + es - 2, ey + es - 2, 1, 1);
  }
  if (rh >= 3.4) {
    const nx = hx + fx * rh * 0.84, ny = hy + fy * rh * 0.84;
    b.fillStyle = '#ff8fae';
    b.fillRect(rp(nx - 0.5), rp(ny - 0.5), 1, 1);
    if (!sl) {
      const mx = nx - fx * 1.3, my = ny - fy * 1.3;
      b.fillStyle = '#8a4660';
      if (fear > 0.6) { b.fillRect(rp(mx), rp(my), 1, 1); }
      else if (wb > 0.6) { b.fillRect(rp(mx + qx * 1.1), rp(my + qy * 1.1), 1, 1); b.fillRect(rp(mx - qx * 1.1), rp(my - qy * 1.1), 1, 1); b.fillRect(rp(mx - fx * 0.8), rp(my - fy * 0.8), 1, 1); }
      else { b.fillRect(rp(mx + qx * 0.6), rp(my + qy * 0.6), 1, 1); b.fillRect(rp(mx - qx * 0.6), rp(my - qy * 0.6), 1, 1); }
      if (carn) { b.fillStyle = '#ffffff'; b.fillRect(rp(mx + qx * 1.6), rp(my + qy * 1.6), 1, 1); b.fillRect(rp(mx - qx * 1.6), rp(my - qy * 1.6), 1, 1); }
    }
  }
  if (!sl && rh >= 3.4 && CHEEK_COL[look[4]]) {
    b.fillStyle = CHEEK_COL[look[4]];
    for (const sd of [-1, 1]) b.fillRect(rp(cx + qx * sd * sep * 1.85 + fx * rh * 0.1), rp(cy + qy * sd * sep * 1.85 + fy * rh * 0.1), 2, 1);
  }
}

/* ---------- one creature ---------- */
function drawCreature(cs, o, sel, wpp, ox, oy, st) {
  const x = cs[o + 1], y = cs[o + 2], dir = cs[o + 3], size = cs[o + 4];
  const r = clamp(rp(size / wpp * 1.8), 1, 26);
  const px = rp((x - ox) / wpp), pyBase = rp((y - oy) / wpp);
  const moving = cs[o + 18] > 0.15 && !cs[o + 12];
  const bob = moving ? rp(Math.abs(Math.sin(st.animT * 0.3 * (0.3 + cs[o + 18]) + (cs[o] | 0))) * Math.min(2, r * 0.18)) : 0;
  const py = pyBase - bob;
  if (px < -30 || py < -30 || px > BW + 30 || py > BH + 30) return;
  const hue = (rp(cs[o + 5] / 12) * 12) % 360;
  st.hue = hue;
  const carn = cs[o + 6] > 0, hp = cs[o + 7], fly = cs[o + 9] > 0, sl = cs[o + 12];
  if ((st.showSense || sel) && !st.noRing) {
    b.fillStyle = 'rgba(255,255,255,.28)';
    const sr = cs[o + 16] / wpp;
    for (let a = 0; a < TAU; a += 3 / sr) b.fillRect(rp(px + Math.cos(a) * sr), rp(py + Math.sin(a) * sr), 1, 1);
  }
  if (r < 2) {
    b.fillStyle = `hsl(${hue},60%,74%)`;
    b.fillRect(px, py, 2, 2);
    return;
  }
  const sh = [cs[o + 20], cs[o + 21], cs[o + 22], cs[o + 23], cs[o + 24]];
  const baby = cs[o + 25] > 0 ? 1 : 0;
  const light = hp > 66 ? 80 : hp > 33 ? 73 : 64;
  const dirQ = ((rp(dir / (TAU / 16)) % 16) + 16) % 16;
  const look = [cs[o + 82] | 0, cs[o + 83] | 0, cs[o + 84] | 0, cs[o + 85] | 0, cs[o + 86] | 0, cs[o + 87] | 0, cs[o + 88] | 0, cs[o + 89] | 0];
  const ent = bodySprite(hue, r, carn ? 1 : 0, light, look, dirQ, sh, baby);
  const g = ent.g, R = ent.R;
  b.fillStyle = 'rgba(30,40,70,.22)';
  const sw = Math.max(r, rp(-g.tmin * 0.6 + g.segs[0].b)), sy = rp(g.segs[0].b) + 1;
  if (fly) b.fillRect(px - sw + 3, pyBase + sy + 3, 2 * sw, 1);
  else { b.fillRect(px - sw + 1, pyBase + sy, 2 * sw, 1); b.fillRect(px - sw + 2, pyBase + sy + 1, 2 * sw - 2, 1); }
  const np = cs[o + 19] | 0, detail = np > 0;
  if (r >= 5 && typeof crDrawWild === 'function' && crDrawWild(cs, o, px, py, r, baby, moving, st, hp)) { /* hand drawn parts */ }
  else {
    if (detail) for (let i = 0; i < np; i++) { drawPart(cs, o, i, 1, px, py, g, false, st); if (cs[o + 26 + i * 7 + 1]) drawPart(cs, o, i, -1, px, py, g, false, st); }
    b.drawImage(ent.cnv, px - R, py - R);
    if (detail) for (let i = 0; i < np; i++) { drawPart(cs, o, i, 1, px, py, g, true, st); if (cs[o + 26 + i * 7 + 1]) drawPart(cs, o, i, -1, px, py, g, true, st); }
    drawFace(cs, o, px, py, ent, look, carn, st);
  }
  if (look[5] === 1 && r >= 3 && (((st.animT + (cs[o] | 0) * 7) % 48) < 4)) {
    const k = ((cs[o] | 0) * 31 + (st.animT / 48 | 0) * 17) % 7, sx = px + (k % 3 - 1) * R * 0.7, sy2 = py + ((k / 3 | 0) - 1) * R * 0.7;
    b.fillStyle = '#fff6b0';
    b.fillRect(rp(sx), rp(sy2) - 1, 1, 3); b.fillRect(rp(sx) - 1, rp(sy2), 3, 1);
  }
  const fx = Math.cos(ent.ang), fy = Math.sin(ent.ang), qx = -fy, qy = fx;
  if (cs[o + 11]) {
    b.fillStyle = 'rgba(255,255,255,.9)';
    const hr = g.uh + g.rh + 2;
    for (let j = -1; j <= 1; j++) b.fillRect(rp(px + fx * hr + qx * j), rp(py + fy * hr + qy * j), 1, 1);
  }
  const ext = Math.max(g.rh + g.uh, g.segs[0].b, R * 0.7);
  let top = py - rp(ext) - 3;
  if (sel || hp < 60) {
    const w = 2 * r + 3;
    b.fillStyle = OUTLINE; b.fillRect(px - r - 1, top, w, 1);
    b.fillStyle = hp > 50 ? '#6fd36f' : hp > 25 ? '#e5c14a' : '#e05a4a';
    b.fillRect(px - r - 1, top, Math.max(1, rp(w * Math.max(0, hp) / 100)), 1);
    top -= 2;
  }
  if (cs[o + 14]) {
    const yy = top - 1;
    b.fillStyle = OUTLINE; b.fillRect(px - 3, yy - 2, 7, 4);
    b.fillStyle = '#ffd84a';
    b.fillRect(px - 2, yy, 5, 1);
    b.fillRect(px - 2, yy - 1, 1, 1); b.fillRect(px, yy - 1, 1, 1); b.fillRect(px + 2, yy - 1, 1, 1);
    b.fillStyle = '#d23c3c'; b.fillRect(px, yy, 1, 1);
    top -= 5;
  }
  if (cs[o + 17]) {
    const yy = top - 1;
    b.fillStyle = '#ff6fa8';
    b.fillRect(px - 2, yy - 1, 2, 1); b.fillRect(px + 1, yy - 1, 2, 1);
    b.fillRect(px - 2, yy, 5, 1); b.fillRect(px - 1, yy + 1, 3, 1); b.fillRect(px, yy + 2, 1, 1);
  }
  if (sel) {
    const s = Math.max(r, rp(ext)) + 3 + ((st.animT >> 3) & 1), x0 = px - s, x1 = px + s, y0 = py - s, y1 = py + s;
    b.fillStyle = '#ffd84a';
    b.fillRect(x0, y0, 2, 1); b.fillRect(x0, y0, 1, 2);
    b.fillRect(x1 - 1, y0, 2, 1); b.fillRect(x1, y0, 1, 2);
    b.fillRect(x0, y1, 2, 1); b.fillRect(x0, y1 - 1, 1, 2);
    b.fillRect(x1 - 1, y1, 2, 1); b.fillRect(x1, y1 - 1, 1, 2);
  }
}
const PLANT_COL = {
  0: ['#2f7a88', '#5cc0c8', '#d6fff0'], 1: ['#3a8a80', '#6cd0c0', '#d6fff0'], 2: ['#3f7a30', '#7bd05a', '#fff07a'],
  3: ['#2d5a24', '#5ab04a', '#ff7a90'], 4: ['#5a7a30', '#a0cf5a', '#ffa0d8'], 5: ['#5f7a58', '#a0c0a0', '#f2f8ff']
};
