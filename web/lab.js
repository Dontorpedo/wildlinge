'use strict';
/* Terrarium lab (workshop room): material items with properties, general handles (pick up, drop, strike, combine, eat),
   fire as physics, learning pets (per-pet value table, epsilon-greedy, reward-based) and imitation. Loaded after gallery.js. */
const LAB_ROOM = 4, LAB_MAX = 16;
TZ.lab = { items: [], log: [], disc: {}, fx: [], nid: 1, spawnT: 12, sel: 'stone' };
const LAB_KINDS = {
  stone: { hard: 0.9, heavy: 0.7, long: 0.1, flam: 0, sharp: 0.3, food: 0, shell: 0, d: 0 },
  stick: { hard: 0.35, heavy: 0.2, long: 0.9, flam: 0.9, sharp: 0.1, food: 0, shell: 0, d: 0 },
  nut: { hard: 0.5, heavy: 0.2, long: 0.1, flam: 0.2, sharp: 0, food: 0, shell: 1, d: 0 },
  fiber: { hard: 0.05, heavy: 0.05, long: 0.5, flam: 1, sharp: 0, food: 0, shell: 0, d: 0 },
  kernel: { hard: 0.1, heavy: 0.1, long: 0.1, flam: 0.3, sharp: 0, food: 1, shell: 0, d: 0 }
};
function tzLabNew(k, x, p) {
  const L = TZ.lab, base = LAB_KINDS[k] || p;
  const it = { id: L.nid++, k, x, y: TZ_FLOOR - 160, vy: 0, p: Object.assign({}, base, p || {}), burn: 0, h: 0, cook: 0, cooked: 0 };
  L.items.push(it);
  while (L.items.length > LAB_MAX) { const o = L.items.findIndex(q => !q.h && !q.burn); if (o < 0) break; L.items.splice(o, 1); }
  return it;
}
/* class signature: what a pet can perceive about an item (properties only, no names) */
function tzLabCls(i) {
  const p = i.p;
  return (p.hard > 0.6 ? 'h' : 's') + (p.heavy > 0.6 ? 'g' : '') + (p.long > 0.6 ? 'l' : '') + (p.flam > 0.5 ? 'f' : '') + (p.food > 0 ? 'e' : '') + (p.shell ? 'c' : '') + (i.burn > 0 ? 'H' : '');
}
function tzLabClsTxt(s) {
  const w = tr('lab.cls');
  return s.split('').map(ch => w[ch] || ch).join('+');
}
function tzLabKindOf(p) { return p.shell ? 'nut' : p.food > 0 ? 'kernel' : (p.hard > 0.6 && p.long > 0.5) ? 'hammer' : p.hard > 0.6 ? 'stone' : p.flam > 0.6 ? 'bundle' : 'lump'; }
function tzLabFx(x, y, n, col, up) {
  for (let i = 0; i < n; i++) TZ.lab.fx.push({ x: x + tzRnd(-4, 4), y: y + tzRnd(-3, 3), vx: tzRnd(-1.2, 1.2), vy: -tzRnd(0.5, up || 2.2), life: tzRnd(14, 34), col });
}
function tzLabDisc(c, k) {
  const L = TZ.lab;
  if (L.disc[k]) return;
  L.disc[k] = { ts: Date.now(), pet: c.name };
  L.log.push({ ts: Date.now(), k, pet: c.name });
  if (L.log.length > 40) L.log.shift();
  tzNews('lab.disc.' + k, c.name);
  sndFx('chime', 0);
  tzAlbumNote(c.id, 'disc', t('lab.name.' + k));
}
function tzLabIgnite(it, c) {
  if (it.burn > 0 || it.p.flam < 0.15) return false;
  it.burn = 12 + it.p.flam * 28 * (0.5 + it.p.long);
  tzLabFx(it.x, it.y - 6, 8, '#ffb02a', 2.4);
  sndFx('tick', (it.x - 400) / 400);
  if (c) tzLabDisc(c, 'fire');
  return true;
}
function tzLabDrop(c) {
  const h = c.hold;
  if (h) { h.h = 0; h.x = c.x + c.face * 12; h.y = TZ_FLOOR - 14; h.vy = 0; }
  c.hold = null; c.holdT = 0;
}
function tzLabQ(c, key) { const s = c.lsk && c.lsk[key]; return s ? s.q : 0.25; }
function tzLabUpd(c, key, r, a) {
  if (!c.lsk) c.lsk = {};
  const s = c.lsk[key] || (c.lsk[key] = { q: 0.25, n: 0 });
  const al = a !== undefined ? a : tzClamp(0.2 + (c.learn || 0.06) * 3, 0.2, 0.7);
  s.q += al * (r - s.q); s.n++;
}
function tzLabPlan(c) {
  const L = TZ.lab, held = c.hold, opt = [];
  const free = L.items.filter(i => !i.h && i !== held).sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x)).slice(0, 6);
  const fear = c.fear > TZ.clock;
  if (!held) {
    for (const it of free) opt.push({ a: 'pick', it, x: it.x, key: 'pick:' + tzLabCls(it), pen: fear && it.burn > 0 ? 1 : 0 });
  } else {
    const ch = tzLabCls(held);
    opt.push({ a: 'drop', x: c.x, key: 'drop:' + ch, pen: c.holdT > 12 ? -0.5 : 0 });
    opt.push({ a: 'eat', x: c.x, key: 'eat:' + ch, pen: held.p.food > 0 ? -0.2 : 0 });
    opt.push({ a: 'strike', it: null, x: tzClamp(c.x + c.face * 30, 20, 780), key: 'strike:' + ch + ':floor', pen: 0 });
    for (const it of free) {
      const ct = tzLabCls(it), pen = fear && (it.burn > 0 || held.burn > 0) ? 1 : 0;
      opt.push({ a: 'strike', it, x: it.x, key: 'strike:' + ch + ':' + ct, pen });
      opt.push({ a: 'comb', it, x: it.x, key: 'comb:' + ch + ':' + ct, pen });
    }
  }
  if (!opt.length) return null;
  if (Math.random() < 0.1 + c.cur * 0.12) return opt[(Math.random() * opt.length) | 0];
  let best = null, bs = -9;
  for (const o of opt) {
    const s = tzLabQ(c, o.key) + 0.7 / (1 + ((c.lsk && c.lsk[o.key]) ? c.lsk[o.key].n : 0)) + Math.random() * 0.2 - o.pen;
    if (s > bs) { bs = s; best = o; }
  }
  return best;
}
/* strike held item against a target: power from properties */
function tzLabStrike(c, h, tg) {
  const p = h.p, power = p.hard * (0.3 + p.heavy * 0.5) * (0.5 + 0.5 * p.long);
  let r = -0.05;
  const x = tg ? tg.x : c.x + c.face * 30;
  tzLabFx(x, TZ_FLOOR - 10, 3, '#e8e0d0', 1.2);
  sndFx('tick', (x - 400) / 400);
  if (h.burn > 0 && tg && tg.p.flam > 0.15 && tzLabIgnite(tg, c)) r = 0.7;
  if (tg && tg.p.shell && Math.random() < tzClamp((power - 0.2) / 0.4, 0, 1)) {
    const i = TZ.lab.items.indexOf(tg); if (i >= 0) TZ.lab.items.splice(i, 1);
    const kn = tzLabNew('kernel', tg.x, null); kn.y = TZ_FLOOR - 14;
    tzLabFx(tg.x, TZ_FLOOR - 12, 12, '#d9a066', 2.6); sndFx('pop', (tg.x - 400) / 400);
    tzLabDisc(c, 'crack'); if (power > 0.5) tzLabDisc(c, 'crackTool');
    r = 0.9;
  }
  if (tg && tg.p.hard > 0.8 && p.hard > 0.8 && power > 0.2 && Math.random() < 0.3) {
    tzLabFx(x, TZ_FLOOR - 14, 10, '#fff2a0', 3);
    sndFx('chime', (x - 400) / 400);
    tzLabDisc(c, 'spark'); r = Math.max(r, 0.35);
    for (const o of TZ.lab.items) if (o.p.flam >= 0.15 && Math.abs(o.x - x) < 34 && tzLabIgnite(o, c)) { r = 0.8; tzLabDisc(c, 'sparkFire'); break; }
  }
  return r;
}
function tzLabComb(c, h, tg) {
  if (!tg || h.p.food > 0 || tg.p.food > 0 || h.p.shell || tg.p.shell || h.burn > 0 || tg.burn > 0 || Math.max(h.p.d, tg.p.d) >= 2) return -0.08;
  const a = h.p, b = tg.p;
  const p = { hard: Math.max(a.hard, b.hard) * 0.95, heavy: Math.min(1.5, a.heavy + b.heavy), sharp: Math.max(a.sharp, b.sharp), long: Math.min(1, Math.max(a.long, b.long)), flam: (a.flam + b.flam) / 2, food: 0, shell: 0, d: Math.max(a.d, b.d) + 1 };
  const L = TZ.lab; L.items.splice(L.items.indexOf(tg), 1); L.items.splice(L.items.indexOf(h), 1);
  c.hold = null; c.holdT = 0;
  const it = tzLabNew(tzLabKindOf(p), tg.x, p); it.y = TZ_FLOOR - 14;
  tzLabFx(tg.x, TZ_FLOOR - 14, 8, '#c8d0ff', 1.8); sndFx('pop', (tg.x - 400) / 400);
  const key = 'made:' + tzLabCls(it), seen = c.lsk && c.lsk[key];
  tzLabUpd(c, key, 0, 0);
  if (it.k === 'hammer') tzLabDisc(c, 'tool');
  return seen ? 0.25 : 0.6;
}
function tzLabDo(c, pl) {
  const n = c.needs, h = c.hold, mx = v => Math.min(100, v);
  let r = 0;
  if (pl.a === 'pick') {
    if (!pl.it || pl.it.h || Math.abs(pl.it.x - c.x) > 24) return;
    if (c.hold) tzLabDrop(c);
    c.hold = pl.it; pl.it.h = c.id; c.holdT = 0; r = 0.05; sndFx('tick', (c.x - 400) / 400);
    if (pl.it.burn > 0) r = -0.1;
  } else if (pl.a === 'drop') { tzLabDrop(c); r = -0.02; }
  else if (pl.a === 'eat') {
    if (h && h.p.food > 0) {
      const v = h.cooked ? 60 : 35, hungry = n.food < 70;
      n.food = mx(n.food + v); n.fun = mx(n.fun + 6); c.heartUntil = Date.now() + 1200;
      r = (h.cooked ? 1 : 0.7) * (hungry ? 1 : 0.5);
      if (h.cooked) tzLabDisc(c, 'eatCooked');
      const i = TZ.lab.items.indexOf(h); if (i >= 0) TZ.lab.items.splice(i, 1);
      c.hold = null; sndFx('pop', (c.x - 400) / 400);
    } else if (h) { r = -0.25; c.stress = Math.min(100, c.stress + 3); }
  } else if (pl.a === 'strike' && h) { r = tzLabStrike(c, h, pl.it); c.kick = 0.4; }
  else if (pl.a === 'comb' && h) r = tzLabComb(c, h, pl.it);
  tzLabUpd(c, pl.key, r);
  if (r > 0.3 && c.prevKey) tzLabUpd(c, c.prevKey, r * 0.5);
  c.prevKey = pl.key;
  if (r > 0.3) { n.fun = mx(n.fun + 8 * r); tzLabShow(c, pl.key, r); }
  else n.fun = mx(n.fun + 0.8);
}
/* pets near a successful action watch and raise their own value for the same action class */
function tzLabShow(c, key, r) {
  for (const o of TZ.list) {
    if (o === c || o.room !== c.room || Math.abs(o.x - c.x) > 170) continue;
    const prev = o.lsk && o.lsk[key] ? o.lsk[key].q : 0.25;
    tzLabUpd(o, key, r, 0.35);
    o.watchUntil = Date.now() + 1500;
    if (prev < 0.5 && tzLabQ(o, key) >= 0.5) { o.imit = (o.imit || 0) + 1; tzLabDisc(o, 'imitate'); }
  }
}
function tzLabAct(c, g, dt) {
  if (!g.pl) {
    g.pl = tzLabPlan(c);
    if (!g.pl) { c.goalT = 0; return; }
    g.x = g.pl.x; g.lvl = 0; c.act = 0; return;
  }
  const pl = g.pl;
  if (pl.it && !TZ.lab.items.includes(pl.it)) { g.pl = null; return; }
  if (pl.it) g.x = pl.it.x;
  if (Math.abs(c.x - g.x) > 20) return;
  c.act += dt;
  if (c.act < 0.8) return;
  c.act = 0;
  tzLabDo(c, pl);
  g.pl = null;
  if (c.goalT < 3) c.goalT = 3;
  if (c.needs.fun > 96) c.goalT = 0;
}
function tzLabGoal(c) {
  if (!TZ.lab.items.length && !c.hold) return null;
  return { type: 'lab', x: c.x, lvl: 0, t: 16, pl: null };
}
/* world step: item physics, fire, cooking, warmth, burns, spawning (also while the room is not viewed) */
function tzLabStep(dt) {
  const L = TZ.lab, k = Math.min(4, dt * 60);
  L.spawnT -= dt;
  if (L.spawnT <= 0) {
    L.spawnT = 40 + Math.random() * 30;
    if (L.items.length < 7) tzLabNew(['stone', 'stone', 'stick', 'stick', 'nut', 'nut', 'fiber'][(Math.random() * 7) | 0], tzRnd(60, 740), null);
  }
  const holders = new Map(); for (const c of TZ.list) holders.set(c.id, c);
  for (const it of L.items) {
    if (it.h) {
      const c = holders.get(it.h);
      if (!c || c.room !== LAB_ROOM || c.held) { it.h = 0; if (c && c.hold === it) c.hold = null; }
      else { it.x = c.x + c.face * (c.halfW || 10) * 0.8; it.y = c.y - c.half * 1.1; c.holdT = (c.holdT || 0) + dt; continue; }
    }
    if (it.y < TZ_FLOOR - 14) { it.vy += 0.3 * k; it.y = Math.min(TZ_FLOOR - 14, it.y + it.vy * k); } else it.vy = 0;
  }
  for (const c of TZ.list) if (c.hold && (!L.items.includes(c.hold) || c.room !== LAB_ROOM)) { c.hold = null; }
  const burning = L.items.filter(i => i.burn > 0);
  for (const it of burning) {
    it.burn -= dt;
    if (it.x > 170 && it.x < 215 && !it.h) { it.burn = 0; tzLabFx(it.x, it.y - 8, 8, '#cfe8ff', 1.4); continue; }
    if (it.burn <= 0) {
      tzLabFx(it.x, it.y - 6, 6, '#8a8a92', 1);
      const i = L.items.indexOf(it); if (i >= 0) L.items.splice(i, 1);
      const hc = it.h && holders.get(it.h); if (hc) { hc.hold = null; }
      continue;
    }
    if (Math.random() < dt * 14) tzLabFx(it.x, it.y - 8, 1, Math.random() < 0.5 ? '#ff8a2a' : '#ffd84a', 2.2);
    for (const o of L.items) {
      if (o === it || o.burn > 0) continue;
      const d = Math.abs(o.x - it.x) + Math.abs(o.y - it.y) * 0.5;
      if (d < 26 && o.p.flam > 0.15 && Math.random() < dt * 0.35 * o.p.flam) tzLabIgnite(o, null);
      else if (d < 52 && o.p.food > 0 && !o.cooked) { o.cook += dt; if (o.cook > 4) { o.cooked = 1; tzLabFx(o.x, o.y - 8, 6, '#e0a868', 1.5); const who = TZ.list.find(q => q.room === LAB_ROOM) ; if (who) tzLabDisc(who, 'cook'); } }
    }
  }
  for (const c of TZ.list) {
    if (c.room !== LAB_ROOM) continue;
    let heat = 0, hurt = 0;
    for (const it of burning) {
      const d = Math.abs(it.x - c.x);
      if (d < 120) heat += 1 - d / 120;
      if (it.h === c.id) hurt += 1.0; else if (d < 16 && !it.h) hurt += 2.5;
    }
    if (heat > 0) c.needs.warmth = Math.min(100, c.needs.warmth + 3.5 * Math.min(1, heat) * dt);
    if (hurt > 0) {
      c.hp = Math.max(1, c.hp - hurt * dt); c.stress = Math.min(100, c.stress + 6 * dt);
      c.burnT = (c.burnT || 0) + dt;
      if (c.burnT > 1.2) {
        c.burnT = 0; c.fear = TZ.clock + 60; sndFx('hit', (c.x - 400) / 400);
        if (c.prevKey) tzLabUpd(c, c.prevKey, -0.9, 0.6);
        if (c.hold && c.hold.burn > 0) tzLabDrop(c);
        c.goalT = 0; c.goal = null;
        tzLabDisc(c, 'burn');
      }
    }
  }
  for (const f of L.fx) { f.x += f.vx * k; f.y += f.vy * k; f.vy += 0.03 * k; f.life -= k; }
  L.fx = L.fx.filter(f => f.life > 0);
  if (L.fx.length > 200) L.fx.splice(0, L.fx.length - 200);
}
/* ---------- drawing ---------- */
function tzLabSprite(it, now) {
  const x = Math.round(it.x), y = Math.round(it.y), p = it.p, B = b;
  const R = (col, dx, dy, w, h) => tzRect(col, x + dx, y + dy, w, h);
  switch (it.k) {
    case 'stone': R(OUTLINE, -7, -7, 14, 9); R('#8d939c', -6, -6, 12, 7); R('#b9bec6', -4, -6, 5, 2); R('#6c717a', 1, -1, 5, 2); break;
    case 'stick': R(OUTLINE, -12, -4, 24, 5); R('#8a5a30', -11, -3, 22, 3); R('#a8763f', -11, -3, 22, 1); R('#5e3a1a', 4, -3, 2, 3); break;
    case 'nut': R(OUTLINE, -5, -8, 10, 10); R('#8a5a30', -4, -7, 8, 8); R('#b07a44', -3, -7, 4, 3); R('#5e3a1a', -1, -9, 2, 2); break;
    case 'kernel': R(OUTLINE, -5, -7, 10, 8); R(it.cooked ? '#b8742e' : '#f0dca0', -4, -6, 8, 6); R(it.cooked ? '#d89850' : '#fff3c4', -3, -6, 3, 2); break;
    case 'hammer': R(OUTLINE, -12, -3, 24, 5); R('#8a5a30', -11, -2, 22, 3); R(OUTLINE, 5, -11, 10, 12); R('#8d939c', 6, -10, 8, 10); R('#b9bec6', 7, -10, 4, 2); break;
    case 'bundle': R(OUTLINE, -9, -6, 18, 8); R('#9aa04a', -8, -5, 16, 6); R('#7a5a30', -2, -5, 3, 6); break;
    case 'fiber': for (let i = 0; i < 5; i++) { R('#c8c050', -6 + i * 3, -10 + (i % 2) * 2, 2, 11 - (i % 2) * 2); } R('#8a7a30', -7, -1, 14, 2); break;
    default: R(OUTLINE, -6, -6, 12, 8); R(p.hard > 0.5 ? '#9aa0aa' : '#a8a050', -5, -5, 10, 6);
  }
  if (it.burn > 0) {
    const f = (Math.floor(now / 110) + it.id) % 3, hh = 10 + f * 3;
    B.fillStyle = 'rgba(255,170,70,.10)'; for (let q = 3; q > 0; q--) { B.beginPath(); B.arc(x, y - 8, 22 * q / 3 + f, 0, 6.3); B.fill(); }
    R('#e8602a', -5, -hh - 2, 10, hh); R('#ffb02a', -3, -hh + 1, 6, hh - 3); R('#fff07a', -1, -hh + 5, 2, 4);
  }
}
function tzLabOver(now) {
  const L = TZ.lab, B = b;
  for (const it of L.items) tzLabSprite(it, now);
  for (const f of L.fx) { B.fillStyle = f.col; B.globalAlpha = Math.min(1, f.life / 14); B.fillRect(Math.round(f.x), Math.round(f.y), 2, 2); }
  B.globalAlpha = 1;
  for (const c of TZ.list) if (c.room === LAB_ROOM && c.watchUntil > now) { tzRect('#ffffff', c.x - 5, c.y - c.half * 2 - 14, 4, 4); tzRect('#ffffff', c.x + 2, c.y - c.half * 2 - 14, 4, 4); tzRect('#15191d', c.x - 3, c.y - c.half * 2 - 13, 2, 2); tzRect('#15191d', c.x + 4, c.y - c.half * 2 - 13, 2, 2); }
}
/* ---------- player interaction ---------- */
function tzLabClick(x, y) {
  const L = TZ.lab;
  if (L.sel === 'spark') {
    let hit = null, hd = 40;
    for (const it of L.items) { const d = Math.hypot(it.x - x, it.y - 8 - y); if (d < hd) { hd = d; hit = it; } }
    tzLabFx(x, y, 10, '#fff2a0', 3); sndFx('chime', (x - 400) / 400);
    if (hit) tzLabIgnite(hit, null);
    return true;
  }
  if (L.sel === 'remove') {
    let hit = null, hd = 30;
    for (const it of L.items) { const d = Math.hypot(it.x - x, it.y - 8 - y); if (d < hd) { hd = d; hit = it; } }
    if (hit) { L.items.splice(L.items.indexOf(hit), 1); for (const c of TZ.list) if (c.hold === hit) c.hold = null; }
    return true;
  }
  const it = tzLabNew(L.sel, tzClamp(x, 12, 788), null); it.y = Math.min(y, TZ_FLOOR - 40);
  sndFx('pop', (x - 400) / 400);
  return true;
}
function tzLabMats() {
  const el = document.getElementById('labMats'); if (!el) return;
  el.style.display = TZ.tool === 'lab' ? 'inline-flex' : 'none';
  if (TZ.tool !== 'lab') return;
  el.innerHTML = ['stone', 'stick', 'nut', 'fiber', 'spark', 'remove'].map(m => `<button data-labsel="${m}"${TZ.lab.sel === m ? ' class="on"' : ''}>${esc(t('lab.mat.' + m))}</button>`).join('');
}
function tzLabHtml() {
  const L = TZ.lab, sel = tzFind(TZ.sel);
  const mats = ['stone', 'stick', 'nut', 'fiber', 'spark', 'remove'];
  let h = `<div class="muted" style="margin:6px 0 3px">${esc(t('lab.title'))}</div><div class="row" style="flex-wrap:wrap">` +
    mats.map(m => `<button data-labsel="${m}"${L.sel === m ? ' class="on"' : ''}>${esc(t('lab.mat.' + m))}</button>`).join('') + '</div>';
  h += `<div class="muted" style="margin-top:4px">${esc(t('lab.hint'))}</div>`;
  if (sel && sel.lsk) {
    const top = Object.entries(sel.lsk).filter(([k, s]) => s.n >= 2 && s.q > 0.35 && !k.startsWith('made:')).sort((a, b) => b[1].q - a[1].q).slice(0, 4);
    const bad = Object.entries(sel.lsk).filter(([k, s]) => s.n >= 2 && s.q < -0.2).sort((a, b) => a[1].q - b[1].q).slice(0, 2);
    const fmt = ([k, s]) => { const q = k.split(':'); return `<tr><td class="l">${esc(t('lab.act.' + q[0]))} ${esc(tzLabClsTxt(q[1] || ''))}${q[2] ? ' &rarr; ' + esc(q[2] === 'floor' ? t('lab.floor') : tzLabClsTxt(q[2])) : ''}</td><td>${(s.q * 100) | 0}%</td></tr>`; };
    if (top.length || bad.length) h += `<div class="muted" style="margin-top:6px">${esc(t('lab.learned', sel.name))}</div><table>${top.map(fmt).join('')}${bad.map(fmt).join('')}</table>`;
  }
  const lg = L.log.slice(-6).reverse().map(v => `<tr><td class="l">${esc(t('lab.name.' + v.k))}</td><td class="muted">${esc(v.pet)}</td></tr>`).join('');
  if (lg) h += `<div class="muted" style="margin-top:6px">${esc(t('lab.log'))}</div><table>${lg}</table>`;
  return h;
}
function tzLabSer() {
  const L = TZ.lab;
  return { items: L.items.filter(i => !i.h).map(i => ({ k: i.k, x: Math.round(i.x), p: i.p, burn: i.burn, cooked: i.cooked })), log: L.log, disc: L.disc, nid: L.nid };
}
function tzLabRestore(P) {
  const q = P && P.lab, L = TZ.lab;
  if (!q) return;
  L.items = []; L.nid = q.nid || 1;
  for (const i of (Array.isArray(q.items) ? q.items : []).slice(0, LAB_MAX)) {
    if (!i || !isFinite(i.x) || !i.p) continue;
    const it = tzLabNew(i.k, tzClamp(i.x, 10, 790), i.p); it.y = TZ_FLOOR - 14; it.burn = i.burn || 0; it.cooked = i.cooked || 0;
  }
  L.log = Array.isArray(q.log) ? q.log.slice(-40) : []; L.disc = q.disc && typeof q.disc === 'object' ? q.disc : {};
}
document.addEventListener('click', e => { const bt = e.target.closest && e.target.closest('[data-labsel]'); if (bt) { TZ.lab.sel = bt.dataset.labsel; tzLabMats(); tzPanel(true); } });
