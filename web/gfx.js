'use strict';
/* Wildlinge graphics: pixel terrain and creatures with mutable shapes (elongation, boxiness, segments, head, taper). */
const WORLD_W = 4000, WORLD_H = 2400, TAU = Math.PI * 2, VIEW_W = 1600, VIEW_H = 800, YEAR_LEN = 6000, DAY_LEN = 400, CS_STRIDE = 82, MEAT_DECAY = 1500;
const S = 3, BW = Math.ceil(VIEW_W / S), BH = Math.ceil(VIEW_H / S), TPX = 4;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rp = Math.round;
const OUTLINE = '#141912';
const KIND_KEYS = ['leg', 'fin', 'wing', 'weapon', 'armor', 'sense', 'storage', 'insul', 'display', 'bud'];
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
    ['#0f2a45', '#123252', '#16395c', '#1a4166'], ['#235a7a', '#2a6787', '#327394', '#3b80a0'],
    ['#2b4426', '#31512b', '#3c6132', '#4a7139'], ['#1b2e19', '#213820', '#284224', '#2f4d29'],
    ['#b89a5c', '#c4a866', '#cfb472', '#d8c080'], ['#55574f', '#63655c', '#72746a', '#83857a']
  ],
  winter: [
    ['#102638', '#142d42', '#18344c', '#1c3b55'], ['#b9d3e2', '#c7dde9', '#d4e6ef', '#e2eff5'],
    ['#c3d0d8', '#d1dde3', '#dde7ec', '#ebf2f5'], ['#7f939c', '#93a6ae', '#a8b9c0', '#bccbd1'],
    ['#a6967a', '#b3a487', '#c0b295', '#ccbfa3'], ['#b8c0c6', '#cdd4d8', '#e0e5e8', '#f2f5f7']
  ]
};
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function buildTerrain(map, winter, seed) {
  const { gw, gh, bio } = map, tw = WORLD_W / TPX, th = WORLD_H / TPX, c2 = document.createElement('canvas');
  c2.width = tw; c2.height = th;
  const x2 = c2.getContext('2d'), img = x2.createImageData(tw, th), d = img.data;
  const pal = (winter ? PAL.winter : PAL.summer).map(row => row.map(hexRgb));
  const bioAt = (wx, wy) => bio[clamp((wy / 20) | 0, 0, gh - 1) * gw + clamp((wx / 20) | 0, 0, gw - 1)];
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const wx = x * TPX + 2, wy = y * TPX + 2;
      const jx = (vnoise(wx / 45, wy / 45, seed + 1) - 0.5) * 26, jy = (vnoise(wx / 45 + 50, wy / 45, seed + 2) - 0.5) * 26;
      const bi = bioAt(wx + jx, wy + jy);
      const fine = vnoise(wx / 14, wy / 14, seed + 3) * 0.6 + vnoise(wx / 40, wy / 40, seed + 4) * 0.4;
      const lvl = fine * 4 + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 1.1;
      let col = pal[bi][clamp(lvl | 0, 0, 3)];
      if (bi === 5 && vnoise(wx / 90, wy / 90, seed + 5) > 0.68) col = winter ? [250, 252, 253] : [232, 238, 242];
      const o = (y * tw + x) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  x2.putImageData(img, 0, 0);
  const rng = mulberry32(seed * 31 + 7);
  for (let i = 0; i < 9000; i++) {
    const x = (rng() * tw) | 0, y = (rng() * th) | 0, bi = bioAt(x * TPX, y * TPX);
    if (bi === 3) {
      x2.fillStyle = winter ? '#5d6e72' : '#13220f'; x2.fillRect(x - 1, y + 1, 3, 1);
      x2.fillStyle = winter ? '#e9f0f3' : '#2e5a27'; x2.fillRect(x - 1, y - 1, 3, 2);
      x2.fillStyle = winter ? '#ffffff' : '#467a35'; x2.fillRect(x, y - 2, 1, 1);
    } else if (bi === 2 && rng() < 0.5) {
      x2.fillStyle = winter ? '#ffffff' : '#6f9a45'; x2.fillRect(x, y, 1, 1);
      x2.fillStyle = winter ? '#b8c6cf' : '#2f4d27'; x2.fillRect(x - 1, y + 1, 1, 1); x2.fillRect(x + 1, y + 1, 1, 1);
    } else if (bi === 2 && !winter && rng() < 0.08) {
      x2.fillStyle = ['#f2d24a', '#f07ab0', '#ffffff'][(rng() * 3) | 0]; x2.fillRect(x, y, 1, 1);
    } else if (bi === 4 && rng() < 0.15) {
      x2.fillStyle = '#5e7a3a'; x2.fillRect(x, y - 2, 1, 3); x2.fillRect(x - 1, y - 1, 1, 1);
    } else if (bi === 5 && rng() < 0.4) {
      x2.fillStyle = '#2f302b'; x2.fillRect(x, y + 1, 2, 1);
      x2.fillStyle = winter ? '#ffffff' : '#9c9e92'; x2.fillRect(x, y, 2, 1);
    } else if (bi === 1 && !winter && rng() < 0.3) {
      x2.fillStyle = '#5a8a4a'; x2.fillRect(x, y - 1, 1, 2);
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

/* ---------- body geometry from shape genes ---------- */
function geom(r, sh, baby) {
  const e = sh[0], bx = sh[1], seg = clamp(Math.floor(sh[2]), 1, 3), hd = sh[3], tp = sh[4];
  const a = r * (1 + 0.55 * e), bb = Math.max(1, r * (1 - 0.22 * e)), n = 2 + 3 * bx;
  const segs = [];
  let u = 0;
  for (let k = 0; k < seg; k++) {
    const s = 1 - 0.18 * k, ak = seg > 1 ? a * 0.68 * s : a, bk = bb * s;
    if (k > 0) u -= segs[k - 1].a * 0.8 + ak * 0.8;
    segs.push({ u, a: ak, b: bk });
  }
  const rh = Math.max(1.2, r * (0.5 + 0.35 * hd) * (baby ? 1.25 : 1));
  const uh = segs[0].a * 0.6;
  const umax = Math.max(segs[0].a, uh + rh);
  const last = segs[seg - 1], umin = last.u - last.a;
  const R = Math.ceil(Math.max(umax, -umin, bb, rh * 1.6, uh + rh * 1.2)) + 2;
  return { segs, n, tp, rh, uh, umax, umin, R };
}
function inBody(g, u, v, carn) {
  const rh = g.rh;
  const du = u - g.uh;
  if (du * du + v * v <= rh * rh) return true;
  for (const s of g.segs) {
    const uu = u - s.u;
    let bt = s.b * (1 + g.tp * 0.35 * clamp(uu / s.a, -1, 1));
    if (bt < 0.6) bt = 0.6;
    if (Math.pow(Math.abs(uu) / s.a, g.n) + Math.pow(Math.abs(v) / bt, g.n) <= 1) return true;
  }
  const er = Math.max(0.9, rh * 0.38), eu = g.uh - rh * 0.15;
  const av = Math.abs(v);
  if (carn) {
    const ev = rh * 0.95;
    if (Math.pow((u - eu) / (er * 0.8), 2) + Math.pow((av - ev) / (er * 1.6), 2) <= 1) return true;
  } else {
    const ev = rh * 0.85;
    if ((u - eu) * (u - eu) + (av - ev) * (av - ev) <= er * er) return true;
  }
  return false;
}
function rhoAt(g, th) {
  const s0 = g.segs[0], c = Math.cos(th), s = Math.sin(th);
  let rho = (s0.a * s0.b) / Math.sqrt((s0.b * c) ** 2 + (s0.a * s) ** 2);
  if (c < -0.3 && g.segs.length > 1) rho += (-g.umin - s0.a) * -c;
  return rho;
}

const spriteCache = new Map();
function bodySprite(hue, r, carn, light, patt, dirQ, sh, baby) {
  const qe = Math.round(sh[0] * 3) / 3, qb = Math.round(sh[1] * 2) / 2, qh = Math.round(sh[3] * 3) / 3, qt = Math.round(sh[4] * 2) / 2, seg = clamp(Math.floor(sh[2]), 1, 3);
  const key = `${hue}|${r}|${carn}|${light}|${patt}|${dirQ}|${qe}|${qb}|${seg}|${qh}|${qt}|${baby}`;
  let ent = spriteCache.get(key);
  if (ent) return ent;
  if (spriteCache.size > 4000) spriteCache.clear();
  const g = geom(r, [qe, qb, seg, qh, qt], baby), R = g.R, d = 2 * R + 1;
  const ang = dirQ * TAU / 16, ca = Math.cos(ang), sa = Math.sin(ang);
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = d;
  const x = cnv.getContext('2d');
  const mask = new Uint8Array(d * d);
  for (let py = 0; py < d; py++) {
    for (let px = 0; px < d; px++) {
      const dx = px - R, dy = py - R, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if (inBody(g, u, v, carn)) mask[py * d + px] = 1;
    }
  }
  for (let py = 0; py < d; py++) {
    for (let px = 0; px < d; px++) {
      if (!mask[py * d + px]) continue;
      const dx = px - R, dy = py - R, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      const edge = px === 0 || py === 0 || px === d - 1 || py === d - 1 || !mask[py * d + px - 1] || !mask[py * d + px + 1] || !mask[(py - 1) * d + px] || !mask[(py + 1) * d + px];
      const shade = (dx + dy) / (2 * R + 1);
      let L = light + (shade < -0.3 ? 14 : shade > 0.35 ? -8 : 0);
      if (!edge && r >= 3) {
        if (patt === 1 && (Math.round(u) * 7 + Math.round(v) * 13 + 1000) % 5 === 0) L -= 12;
        if (patt === 2 && Math.round(u) % 2 === 0 && Math.abs(v) < g.segs[0].b - 1) L -= 10;
      }
      x.fillStyle = edge ? `hsl(${hue},40%,${Math.max(10, light - 24)}%)` : `hsl(${hue},58%,${L}%)`;
      x.fillRect(px, py, 1, 1);
    }
  }
  if (r >= 3) {
    const hx = R + Math.cos(ang) * (g.uh - g.rh * 0.5) - Math.sin(ang) * 0, hy = R + Math.sin(ang) * (g.uh - g.rh * 0.5);
    x.fillStyle = `hsl(${hue},80%,${Math.min(92, light + 30)}%)`;
    x.fillRect(rp(hx - 1), rp(hy - 1), 1, 1);
  }
  ent = { cnv, g, ang, R };
  spriteCache.set(key, ent);
  return ent;
}

/* ---------- parts ---------- */
const BACK_KINDS = new Set(['leg', 'fin', 'wing', 'insul', 'storage', 'sense', 'bud']);
function drawPart(cs, o, i, side, px, py, g, front, st) {
  const q = o + 26 + i * 7, kind = KIND_KEYS[cs[q + 5]] || 'bud';
  if (BACK_KINDS.has(kind) === front) return;
  const a0 = side * cs[q], len = cs[q + 2], wid = cs[q + 3], mot = cs[q + 4], col = cs[q + 6];
  const dir = cs[o + 3], hue = st.hue, sl = cs[o + 12], spd = cs[o + 18];
  const wig = mot > 0.3 && !sl ? Math.sin(st.animT * 0.3 * (0.3 + spd) + i * 1.7 + (side < 0 ? 1.5 : 0)) * 0.3 * mot : 0;
  const ang = dir + a0 + wig, ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
  const rho = rhoAt(g, a0 + wig), r = g.segs[0].b;
  const L = Math.max(1, rp(len * r * 1.6) + 1);
  let fill;
  switch (kind) {
    case 'leg': fill = `hsl(${hue},35%,22%)`; break;
    case 'fin': fill = `hsl(${hue},55%,66%)`; break;
    case 'wing': fill = `hsl(${(hue + 20) % 360},40%,82%)`; break;
    case 'weapon': fill = '#efe6cc'; break;
    case 'armor': fill = '#646c74'; break;
    case 'sense': fill = `hsl(${hue},40%,32%)`; break;
    case 'storage': fill = `hsl(${hue},50%,74%)`; break;
    case 'insul': fill = `hsl(${hue},30%,${62 + col * 18}%)`; break;
    case 'display': fill = `hsl(${(hue + 180) % 360},85%,62%)`; break;
    default: fill = `hsl(${hue},45%,50%)`;
  }
  b.fillStyle = fill;
  if (kind === 'armor') {
    for (let k = -1; k <= 1; k++) { const a2 = dir + a0 + k * 0.45; b.fillRect(rp(px + Math.cos(a2) * (rho - 0.5)), rp(py + Math.sin(a2) * (rho - 0.5)), 1, 1); }
    return;
  }
  if (kind === 'storage') { b.fillRect(rp(px + ux * (rho + 1)) - 1, rp(py + uy * (rho + 1)) - 1, 2, 2); return; }
  if (kind === 'insul') {
    for (let k = -2; k <= 2; k++) { const a2 = dir + a0 + k * 0.3; b.fillRect(rp(px + Math.cos(a2) * (rho + 0.6)), rp(py + Math.sin(a2) * (rho + 0.6)), 1, 1); }
    return;
  }
  const wide = kind === 'fin' || kind === 'wing' || kind === 'display';
  for (let j = 0; j < L; j++) {
    const qx = px + ux * (rho + j), qy = py + uy * (rho + j);
    b.fillRect(rp(qx), rp(qy), 1, 1);
    if (wide) {
      const sw = Math.max(0, rp(wid * (kind === 'wing' ? Math.min(j + 1, L - j) : j + 1) * 0.7));
      for (let s = 1; s <= sw; s++) b.fillRect(rp(qx - vx * s * side), rp(qy - vy * s * side), 1, 1);
    } else if (wid > 0.45 && j < L - 1) b.fillRect(rp(qx + vx), rp(qy + vy), 1, 1);
  }
  if (kind === 'leg' && L >= 2) { b.fillStyle = `hsl(${hue},40%,16%)`; b.fillRect(rp(px + ux * (rho + L - 1)), rp(py + uy * (rho + L - 1)), 1, 1); }
  if (kind === 'sense') { b.fillStyle = '#ffe36a'; b.fillRect(rp(px + ux * (rho + L)), rp(py + uy * (rho + L)), 1, 1); }
}

/* ---------- cute face on the head ---------- */
function drawFace(cs, o, px, py, ent) {
  const g = ent.g, ang = ent.ang, fx = Math.cos(ang), fy = Math.sin(ang), qx = -fy, qy = fx;
  const hx = px + fx * g.uh, hy = py + fy * g.uh, rh = g.rh;
  const sl = cs[o + 12], fear = cs[o + 10], wb = cs[o + 13], baby = cs[o + 25];
  if (rh < 2) { b.fillStyle = '#ffffff'; b.fillRect(rp(hx + fx * rh), rp(hy + fy * rh), 1, 1); return; }
  const cx = hx + fx * rh * 0.22, cy = hy + fy * rh * 0.22, sep = Math.max(1, rh * 0.52);
  let es = Math.max(1, rp(rh * 0.6)) + (baby && rh >= 3 ? 1 : 0);
  if (fear > 0.6 && !sl) es += 1;
  for (const sd of [-1, 1]) {
    const ex = rp(cx + qx * sd * sep - es / 2), ey = rp(cy + qy * sd * sep - es / 2);
    if (sl) { b.fillStyle = OUTLINE; b.fillRect(ex, ey + (es >> 1), es, 1); continue; }
    b.fillStyle = '#ffffff';
    b.fillRect(ex, ey, es, es);
    const ps = Math.max(1, es - 1 - (fear > 0.6 ? 1 : 0));
    const ox = rp((es - ps) / 2 + fx * (es - ps) / 2), oy = rp((es - ps) / 2 + fy * (es - ps) / 2);
    b.fillStyle = fear > 0.6 ? '#7a1010' : '#1a1a22';
    b.fillRect(ex + ox, ey + oy, ps, ps);
    if (es >= 3) { b.fillStyle = '#ffffff'; b.fillRect(ex + ox, ey + oy, 1, 1); }
  }
  if (!sl && wb > 0.75 && rh >= 3) {
    b.fillStyle = 'rgba(255,120,160,.75)';
    for (const sd of [-1, 1]) b.fillRect(rp(cx + qx * sd * sep * 1.75 - fx * 0.5), rp(cy + qy * sd * sep * 1.75 - fy * 0.5), 1, 1);
  }
  if (rh >= 3 && !sl) {
    const mx = hx + fx * rh * 0.78, my = hy + fy * rh * 0.78;
    b.fillStyle = '#3a1820';
    if (fear > 0.6) b.fillRect(rp(mx), rp(my), 1, 1);
    else if (wb > 0.68) {
      b.fillRect(rp(mx), rp(my), 1, 1);
      b.fillRect(rp(mx + qx - fx * 0.7), rp(my + qy - fy * 0.7), 1, 1);
      b.fillRect(rp(mx - qx - fx * 0.7), rp(my - qy - fy * 0.7), 1, 1);
    } else {
      b.fillRect(rp(mx + qx * 0.5), rp(my + qy * 0.5), 1, 1);
      b.fillRect(rp(mx - qx * 0.5), rp(my - qy * 0.5), 1, 1);
    }
  }
}

/* ---------- one creature ---------- */
function drawCreature(cs, o, sel, wpp, ox, oy, st) {
  const x = cs[o + 1], y = cs[o + 2], dir = cs[o + 3], size = cs[o + 4];
  const r = clamp(rp(size / wpp * 1.25), 1, 11);
  const px = rp((x - ox) / wpp), py = rp((y - oy) / wpp);
  if (px < -30 || py < -30 || px > BW + 30 || py > BH + 30) return;
  const hue = (rp(cs[o + 5] / 18) * 18) % 360;
  st.hue = hue;
  const carn = cs[o + 6] > 0, hp = cs[o + 7], fly = cs[o + 9] > 0, sl = cs[o + 12];
  if (st.showSense || sel) {
    b.fillStyle = 'rgba(255,255,255,.28)';
    const sr = cs[o + 16] / wpp;
    for (let a = 0; a < TAU; a += 3 / sr) b.fillRect(rp(px + Math.cos(a) * sr), rp(py + Math.sin(a) * sr), 1, 1);
  }
  if (r < 2) {
    b.fillStyle = `hsl(${hue},58%,50%)`;
    b.fillRect(px, py, 2, 2);
    return;
  }
  const sh = [cs[o + 20], cs[o + 21], cs[o + 22], cs[o + 23], cs[o + 24]];
  const baby = cs[o + 25] > 0 ? 1 : 0;
  const light = hp > 66 ? 52 : hp > 33 ? 44 : 34;
  const dirQ = ((rp(dir / (TAU / 16)) % 16) + 16) % 16;
  const ent = bodySprite(hue, r, carn ? 1 : 0, light, cs[o + 8] | 0, dirQ, sh, baby);
  const g = ent.g, R = ent.R;
  b.fillStyle = 'rgba(0,0,0,.33)';
  const sw = Math.max(r, rp(-g.umin * 0.6 + g.segs[0].b)), sy = rp(g.segs[0].b) + 1;
  if (fly) b.fillRect(px - sw + 3, py + sy + 3, 2 * sw, 1);
  else { b.fillRect(px - sw + 1, py + sy, 2 * sw, 1); b.fillRect(px - sw + 2, py + sy + 1, 2 * sw - 2, 1); }
  const np = cs[o + 19] | 0, detail = np > 0;
  if (detail) for (let i = 0; i < np; i++) { drawPart(cs, o, i, 1, px, py, g, false, st); if (cs[o + 26 + i * 7 + 1]) drawPart(cs, o, i, -1, px, py, g, false, st); }
  b.drawImage(ent.cnv, px - R, py - R);
  if (detail) for (let i = 0; i < np; i++) { drawPart(cs, o, i, 1, px, py, g, true, st); if (cs[o + 26 + i * 7 + 1]) drawPart(cs, o, i, -1, px, py, g, true, st); }
  drawFace(cs, o, px, py, ent);
  const fx = Math.cos(ent.ang), fy = Math.sin(ent.ang), qx = -fy, qy = fx;
  if (cs[o + 11]) {
    b.fillStyle = 'rgba(255,255,255,.85)';
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
  0: ['#1f5a63', '#3a8d96', '#8fe0d0'], 1: ['#2d6f6a', '#46a39a', '#8fe0d0'], 2: ['#2c4a22', '#4d8a35', '#e8d65a'],
  3: ['#1d3a17', '#3b6e2b', '#d2485a'], 4: ['#3d5a25', '#6a8f3a', '#f08ac0'], 5: ['#4b5a45', '#78907a', '#e0e8f0']
};
