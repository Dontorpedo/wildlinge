'use strict';
/* Terrarium: side-view care room for adopted Wildlings.
   Genomes, brains and language live in the WebAssembly world (world.terra); needs, positions and objects live here. */
const TZ = {
  MAX: 8, GROW: 600, ADULT: 0.98, list: [], eggs: [], items: [], graves: [], sel: 0, tool: 'select',
  room: { food: 70, water: 70, lamp: true, light: false, music: 0 },
  last: 0, ready: false, saveAt: 0, savedAt: 0, persisted: null, night: 0, hour: 12, pending: false, clock: 0, breedT: 0, bubT: 0, dirty: false
};
const TZ_FLOOR = 330;
const TZ_LEVELS = [{ x0: -1e9, x1: 1e9, y: TZ_FLOOR }, { x0: 330, x1: 520, y: 285 }, { x0: 440, x1: 640, y: 235 }];
const TZ_OBJ = { food: 230, water: 292, lamp: 650, bed: 120, music: 395, ceiling: 400 };
const TZ_NEEDS = ['food', 'water', 'warmth', 'light', 'fun', 'rest'];
const TZ_RATE = { food: 0.12, water: 0.15, warmth: 0.05, light: 0.08, fun: 0.1, rest: 0.04 };
const TZ_GLYPH = {
  food: [['00100', '01110', '11111', '11111', '01110'], '#e86a5a'],
  water: [['00100', '00100', '01110', '11111', '01110'], '#4a9ae0'],
  warmth: [['00100', '01100', '01110', '11111', '01110'], '#f08a3a'],
  light: [['10101', '01110', '11111', '01110', '10101'], '#e8b020'],
  fun: [['01110', '11101', '11111', '11111', '01110'], '#c060c8'],
  rest: [['11111', '00010', '00100', '01000', '11111'], '#6a7ab0'],
  love: [['01010', '11111', '11111', '01110', '00100'], '#ff6fa8']
};
const tzClamp = (v, a, b) => Math.min(b, Math.max(a, v));
const tzRnd = (a, b) => a + Math.random() * (b - a);
const tzEl = id => document.getElementById(id);

function tzCall(o) {
  return new Promise(res => {
    TZ.rid = (TZ.rid || 0) + 1;
    (TZ.waits = TZ.waits || new Map()).set(TZ.rid, res);
    sendHost({ type: 'tcmd', rid: TZ.rid, c: o });
  });
}
function tzResolve(m) {
  const f = TZ.waits && TZ.waits.get(m.rid);
  if (f) { TZ.waits.delete(m.rid); f(m.res || {}); }
}

/* ---------- creature records ---------- */
function tzMake(r, st) {
  const rec = Array.from(r.rec), g = tzClamp(r.growth === undefined ? 1 : r.growth, 0, 1);
  const adult = rec[4] > 0.5 ? rec[4] / (0.5 + 0.5 * g) : 7;
  const rT = tzClamp(Math.round(7 + adult * 1.5), 14, 22);
  const c = {
    id: r.id, name: r.name, gen: r.gen, kids: r.children || 0, words: r.words || 0, rec, adult, rT,
    age: (st && st.age !== undefined) ? st.age : g * TZ.GROW,
    needs: st && st.needs ? Object.assign({ food: 80, water: 80, warmth: 80, light: 80, fun: 70, rest: 80 }, st.needs) : { food: 80, water: 80, warmth: 80, light: 80, fun: 70, rest: 80 },
    hp: st && st.hp !== undefined ? st.hp : 100, stress: st && st.stress || 0, love: st && st.love || 0, breedCool: st && st.breedCool || 0,
    x: st && st.x !== undefined ? st.x : tzRnd(80, 720), y: TZ_FLOOR, vx: 0, vy: 0, face: 1, lvl: 0, ground: true,
    goal: null, goalT: 0, sleeping: false, bubble: null, bubbleUntil: 0, nextBubble: 0, heartUntil: 0, hopT: 0, moving: false, kick: 0
  };
  c.fly = rec[9] > 0;
  tzGeom(c);
  if (st && st.y !== undefined) { c.y = st.y; c.lvl = st.lvl || 0; }
  return c;
}
function tzGrowth(c) { return Math.min(1, c.age / TZ.GROW); }
function tzGeom(c) {
  const g = tzGrowth(c), r = Math.max(2, Math.round(c.rT * (0.5 + 0.5 * g))), sh = c.rec.slice(20, 25), ge = geom(r, sh, g < 0.5 ? 1 : 0, c.rec[89] | 0);
  c.r = r;
  c.half = Math.max(ge.segs[0].b, ge.rh) + 2 + (r >> 2);
  c.halfW = Math.max(6, -ge.tmin * 0.7);
}
function tzMood(c) { const n = c.needs; return (n.food + n.water + n.warmth + n.light + n.fun + n.rest) / 6; }
function tzFind(id) { return TZ.list.find(c => c.id === id); }

/* ---------- adopt, release, reconcile ---------- */
async function tzAdopt(id) {
  if (TZ.list.length + TZ.eggs.length >= TZ.MAX) { toast(t('tz.full')); return; }
  const r = await tzCall({ type: 'take', id });
  if (!r.ok) { toast(r.full ? t('tz.full') : t('tz.noTake')); return; }
  const c = tzMake(r, null);
  TZ.list.push(c);
  TZ.sel = c.id;
  TZ.dirty = true;
  toast(t('tz.adopted', c.name));
  setViewMode('terra');
  tzSave();
}
async function tzRelease(id) {
  const c = tzFind(id);
  if (!c) return;
  if (!confirm(t('tz.releaseConfirm', c.name))) return;
  const r = await tzCall({ type: 'release', id, growth: tzGrowth(c), hp: c.hp });
  if (!r.ok) return;
  TZ.list = TZ.list.filter(q => q.id !== id);
  if (TZ.sel === id) TZ.sel = 0;
  toast(t('tz.released', c.name));
  tzSave();
}
async function tzReconcile() {
  const r = await tzCall({ type: 'tlist' });
  const rs = r.list || [], P = TZ.persisted, old = new Map();
  for (const c of TZ.list) old.set(c.id, c);
  const stById = new Map(P && P.list ? P.list.map(q => [q.id, q]) : []);
  const eggById = new Map(P && P.eggs ? P.eggs.map(q => [q.id, q]) : []);
  TZ.list = []; TZ.eggs = [];
  for (const q of rs) {
    if (eggById.has(q.id)) { const e = eggById.get(q.id); TZ.eggs.push({ id: q.id, name: q.name, gen: q.gen, rec: q.rec, x: e.x, left: e.left, y: TZ_FLOOR, vy: 0 }); continue; }
    const prev = old.get(q.id);
    if (prev) { prev.name = q.name; prev.rec = Array.from(q.rec); prev.kids = q.children; prev.words = q.words; TZ.list.push(prev); continue; }
    TZ.list.push(tzMake(q, stById.get(q.id) || null));
  }
  if (P) {
    if (P.room) Object.assign(TZ.room, P.room);
    TZ.graves = Array.isArray(P.graves) ? P.graves.slice(-12) : [];
    if (P.savedAt) { const away = (Date.now() - P.savedAt) / 1000; if (away > 5) tzCatchUp(Math.min(away, 86400 * 3)); }
    TZ.persisted = null;
  }
  if (!tzFind(TZ.sel)) TZ.sel = 0;
  TZ.ready = true;
  TZ.last = Date.now();
}

/* ---------- persistence ---------- */
function tzSerialize() {
  return JSON.stringify({
    v: 1, savedAt: Date.now(), room: TZ.room, graves: TZ.graves,
    eggs: TZ.eggs.map(e => ({ id: e.id, x: e.x, left: e.left })),
    list: TZ.list.map(c => ({ id: c.id, age: c.age, needs: c.needs, hp: c.hp, stress: c.stress, love: c.love, breedCool: c.breedCool, x: c.x, y: c.y, lvl: c.lvl }))
  });
}
async function tzSave() {
  if (!TZ.ready) return;
  TZ.saveAt = Date.now();
  try { await idbDo('readwrite', st => st.put(tzSerialize(), 'terrarium')); } catch (e) { /* storage unavailable */ }
}
async function tzLoad() {
  try {
    const s = await idbDo('readonly', st => st.get('terrarium'));
    if (typeof s === 'string') TZ.persisted = JSON.parse(s);
  } catch (e) { TZ.persisted = null; }
}

/* ---------- time away: damped, so a short absence never kills ---------- */
function tzCatchUp(sec) {
  for (const c of TZ.list) {
    c.age += sec;
    let low = false;
    for (const k of TZ_NEEDS) { c.needs[k] = Math.max(Math.min(c.needs[k], 15), c.needs[k] - TZ_RATE[k] * sec * 0.25); if (c.needs[k] <= 15) low = true; }
    if (low) { c.hp = Math.max(30, c.hp - Math.min(40, sec / 900)); c.stress = Math.min(70, c.stress + sec / 400); }
    c.sleeping = false; c.goal = null; c.ground = true; c.y = TZ_FLOOR; c.lvl = 0; c.vy = 0;
    tzGeom(c);
  }
  for (const e of TZ.eggs) e.left -= sec;
  TZ.room.food = Math.max(0, TZ.room.food - sec * 0.01);
  TZ.room.water = Math.max(0, TZ.room.water - sec * 0.01);
  tzHatch();
  TZ.dirty = true;
}

/* ---------- day and night from the real clock ---------- */
function tzDay() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  TZ.hour = h;
  const up = tzClamp((h - 6) / 2, 0, 1), down = tzClamp((20 - h) / 2, 0, 1);
  TZ.night = 1 - Math.min(up, down);
}

/* ---------- simulation ---------- */
function tzFrame() {
  const now = Date.now();
  if (!TZ.last) TZ.last = now;
  const ms = now - TZ.last;
  TZ.last = now;
  if (!TZ.ready) return;
  if (ms > 3000) { tzCatchUp(Math.min(ms / 1000, 86400 * 3)); return; }
  const dt = ms / 1000, k = Math.min(4, dt * 60);
  tzDay();
  TZ.clock += dt;
  if (TZ.room.music > 0) TZ.room.music = Math.max(0, TZ.room.music - dt);
  const lightOn = TZ.night < 0.5 || TZ.room.light;
  for (const c of TZ.list) {
    const n = c.needs;
    c.age += dt;
    const sl = c.sleeping;
    n.food -= TZ_RATE.food * dt * (sl ? 0.4 : 1);
    n.water -= TZ_RATE.water * dt * (sl ? 0.4 : 1);
    n.warmth -= TZ_RATE.warmth * dt * (1 + TZ.night);
    if (lightOn) n.light = Math.min(100, n.light + 0.3 * dt); else n.light -= TZ_RATE.light * dt;
    n.fun -= TZ_RATE.fun * dt * (sl ? 0 : 1);
    n.rest += (sl ? 1.3 : -TZ_RATE.rest) * dt;
    for (const q of TZ_NEEDS) n[q] = tzClamp(n[q], 0, 100);
    const min = Math.min(n.food, n.water, n.warmth, n.light, n.fun, n.rest);
    if (min < 25) c.stress = Math.min(100, c.stress + (25 - min) / 25 * 0.6 * dt); else if (min > 50) c.stress = Math.max(0, c.stress - 0.8 * dt);
    if (n.food <= 0 || n.water <= 0 || n.warmth <= 0) { c.hp -= 0.4 * dt; c.cause = n.water <= 0 ? 'thirst' : n.food <= 0 ? 'hunger' : 'cold'; }
    else if (c.stress > 80) { c.hp -= 0.1 * dt; c.cause = 'stress'; }
    else if (tzMood(c) > 55) c.hp = Math.min(100, c.hp + 0.15 * dt);
    c.breedCool = Math.max(0, c.breedCool - dt);
    tzAI(c, dt, k);
    tzPhys(c, k);
    if (c.age / TZ.GROW < 1 && ((c.age / TZ.GROW) * 20 | 0) !== (((c.age - dt) / TZ.GROW) * 20 | 0)) tzGeom(c);
  }
  tzItems(k, dt);
  for (const e of TZ.eggs) { e.left -= dt; e.vy += 0.25 * k; e.y = Math.min(TZ_FLOOR, e.y + e.vy * k); if (e.y >= TZ_FLOOR) e.vy = 0; }
  tzHatch();
  TZ.breedT += dt;
  if (TZ.breedT > 1) { TZ.breedT = 0; tzBreeding(); tzDeaths(); }
  if (now - TZ.saveAt > 10000) tzSave();
}
function tzHatch() {
  const keep = [];
  for (const e of TZ.eggs) {
    if (e.left > 0) { keep.push(e); continue; }
    const c = tzMake({ id: e.id, name: e.name, gen: e.gen, rec: e.rec, growth: 0, children: 0 }, { age: 0, x: e.x });
    c.heartUntil = Date.now() + 2500;
    TZ.list.push(c);
    toast(t('tz.hatched', c.name));
    TZ.dirty = true;
  }
  TZ.eggs = keep;
}
async function tzDeaths() {
  for (const c of TZ.list.slice()) {
    if (c.hp > 0) continue;
    TZ.list = TZ.list.filter(q => q.id !== c.id);
    if (TZ.sel === c.id) TZ.sel = 0;
    TZ.graves.push({ name: c.name, gen: c.gen, cause: c.cause || 'stress', age: Math.round(c.age) });
    if (TZ.graves.length > 12) TZ.graves.shift();
    toast(t('tz.died', c.name, tr('causes')[c.cause] || c.cause));
    await tzCall({ type: 'tdie', id: c.id, cause: c.cause || 'stress' });
    tzSave();
  }
}
async function tzBreeding() {
  if (TZ.pending || TZ.list.length + TZ.eggs.length >= TZ.MAX) return;
  const ad = TZ.list.filter(c => tzGrowth(c) >= TZ.ADULT && !c.sleeping && c.hp > 60);
  for (const c of ad) {
    let near = null;
    for (const o of ad) if (o !== c && Math.abs(o.x - c.x) < 80 && Math.abs(o.y - c.y) < 60 && tzMood(c) > 60 && tzMood(o) > 60) { near = o; break; }
    if (near) c.love = Math.min(100, c.love + 4); else c.love = Math.max(0, c.love - 1);
  }
  for (const c of ad) {
    if (c.love < 100 || c.breedCool > 0) continue;
    const o = ad.find(q => q !== c && q.love >= 100 && q.breedCool <= 0 && Math.abs(q.x - c.x) < 80);
    if (!o) continue;
    TZ.pending = true;
    const r = await tzCall({ type: 'tbreed', a: c.id, b: o.id });
    TZ.pending = false;
    c.love = o.love = 0;
    c.breedCool = o.breedCool = 180;
    if (r.ok) {
      TZ.eggs.push({ id: r.id, name: r.name, gen: r.gen, rec: Array.from(r.rec), x: (c.x + o.x) / 2, y: Math.min(c.y, o.y) - 20, vy: 0, left: 90 });
      c.kids++; o.kids++;
      c.heartUntil = o.heartUntil = Date.now() + 2500;
      toast(t('tz.egg'));
      tzSave();
    }
    return;
  }
}

/* ---------- behaviour ---------- */
function tzChoose(c) {
  const n = c.needs, room = TZ.room, night = TZ.night;
  const tre = TZ.items.filter(i => i.type === 'treat' && i.ground).sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0];
  if (tre && n.food < 85) return { type: 'treat', item: tre, x: tre.x, lvl: 0, t: 8 };
  const opt = [];
  if (n.food < 55 && room.food > 1) opt.push([100 - n.food, { type: 'food', x: TZ_OBJ.food, lvl: 0, t: 12 }]);
  if (n.water < 55 && room.water > 1) opt.push([100 - n.water, { type: 'water', x: TZ_OBJ.water, lvl: 0, t: 12 }]);
  if (n.warmth < 50 && room.lamp) opt.push([100 - n.warmth, { type: 'warm', x: TZ_OBJ.lamp, lvl: 0, t: 25 }]);
  if (n.rest < 30 || (night > 0.6 && n.rest < 70)) opt.push([100 - n.rest + night * 15, { type: 'sleep', x: TZ_OBJ.bed, lvl: 0, t: 60 }]);
  if (n.fun < 55) {
    const ball = TZ.items.find(i => i.type === 'ball');
    if (ball) opt.push([100 - n.fun, { type: 'ball', item: ball, x: ball.x, lvl: 0, t: 15 }]);
    else opt.push([100 - n.fun, { type: 'music', x: TZ_OBJ.music, lvl: 1, t: 15 }]);
  }
  if (opt.length) { opt.sort((a, b) => b[0] - a[0]); return opt[0][1]; }
  const others = TZ.list.filter(o => o !== c);
  if (others.length && Math.random() < 0.3) { const o = others[(Math.random() * others.length) | 0]; return { type: 'social', x: o.x + tzRnd(-25, 25), lvl: o.lvl, t: 6 }; }
  const lv = Math.random() < 0.6 ? 0 : 1 + ((Math.random() * 2) | 0), L = TZ_LEVELS[lv];
  return { type: 'wander', x: lv === 0 ? tzRnd(40, 760) : tzRnd(L.x0 + 15, L.x1 - 15), lvl: lv, t: tzRnd(3, 8) };
}
function tzAI(c, dt, k) {
  const n = c.needs;
  if (c.sleeping) {
    c.moving = false;
    if (n.rest >= 95 || n.food < 12 || n.water < 12) c.sleeping = false;
    return;
  }
  c.goalT -= dt;
  if (!c.goal || c.goalT <= 0 || (c.goal.type === 'treat' && !TZ.items.includes(c.goal.item)) || (c.goal.type === 'ball' && !TZ.items.includes(c.goal.item))) {
    c.goal = tzChoose(c);
    c.goalT = c.goal.t || 5;
  }
  const g = c.goal;
  if (g.item) g.x = g.item.x;
  const arrived = tzGo(c, g.x, g.lvl, k);
  c.moving = !arrived || c.fly;
  if (c.nextBubble < TZ.clock) {
    c.nextBubble = TZ.clock + 5 + Math.random() * 4;
    let worst = null, wv = 38;
    for (const q of TZ_NEEDS) if (n[q] < wv) { wv = n[q]; worst = q; }
    if (worst) { c.bubble = worst; c.bubbleUntil = TZ.clock + 2.6; }
  }
  if (!arrived) return;
  switch (g.type) {
    case 'food': if (TZ.room.food > 0 && n.food < 98) { n.food += 22 * dt; TZ.room.food = Math.max(0, TZ.room.food - 6 * dt); n.fun += 0.5 * dt; } else c.goalT = 0; break;
    case 'water': if (TZ.room.water > 0 && n.water < 98) { n.water += 26 * dt; TZ.room.water = Math.max(0, TZ.room.water - 6 * dt); } else c.goalT = 0; break;
    case 'warm': if (TZ.room.lamp && n.warmth < 96) n.warmth += 1.8 * dt; else c.goalT = 0; break;
    case 'sleep': c.sleeping = true; c.goal = null; break;
    case 'music': if (TZ.room.music > 0) n.fun += 4 * dt; else if (n.fun < 55) { TZ.room.music = 20; } break;
    case 'treat': { const i = TZ.items.indexOf(g.item); if (i >= 0) { TZ.items.splice(i, 1); n.food = Math.min(100, n.food + 30); n.fun = Math.min(100, n.fun + 6); c.heartUntil = Date.now() + 1500; } c.goalT = 0; break; }
    case 'ball': {
      const b = g.item;
      if (Math.abs(b.x - c.x) < c.halfW + 8 && b.ground && c.kick <= 0) { b.vx = c.face * tzRnd(1.8, 3.2); b.vy = -tzRnd(2.5, 4.2); b.ground = false; n.fun = Math.min(100, n.fun + 9); c.kick = 0.6; }
      break;
    }
  }
  c.kick -= dt;
}
/* walk, jump or fly towards x on level lvl; true when there */
function tzGo(c, tx, lvl, k) {
  const sp = (0.45 + c.rec[18] * 0.25) * (0.7 + 0.3 * tzGrowth(c)) * k;
  if (c.fly) {
    const ty = TZ_LEVELS[lvl].y - 20 - c.half - Math.sin(TZ.clock * 1.5 + c.id) * 8;
    c.vx = tzClamp(tx - c.x, -sp * 1.3, sp * 1.3); c.x += c.vx; c.y += tzClamp(ty - c.y, -sp, sp);
    c.vy = 0; c.ground = true;
    if (c.vx) c.face = c.vx > 0 ? 1 : -1;
    return Math.abs(tx - c.x) < 10;
  }
  let wx = tx;
  if (c.ground) {
    if (lvl > c.lvl) {
      const N = TZ_LEVELS[c.lvl + 1];
      wx = tzClamp(c.x, N.x0 + 14, N.x1 - 14);
      if (Math.abs(c.x - wx) < 4 && c.hopT <= 0) { c.vy = -5.8; c.ground = false; c.hopT = 0.4; }
    } else if (lvl < c.lvl) {
      const L = TZ_LEVELS[c.lvl];
      wx = c.x - L.x0 < L.x1 - c.x ? L.x0 - 8 : L.x1 + 8;
    }
  } else {
    const N = TZ_LEVELS[Math.min(lvl, c.lvl + 1)];
    wx = lvl > c.lvl ? tzClamp(c.x, N.x0 + 14, N.x1 - 14) : tx;
  }
  const d = wx - c.x;
  if (Math.abs(d) > 3) { c.vx = tzClamp(d, -sp, sp); c.face = d > 0 ? 1 : -1; } else c.vx = 0;
  c.x = tzClamp(c.x + c.vx, 20, 780);
  return c.lvl === lvl && c.ground && Math.abs(tx - c.x) < 10;
}
function tzPhys(c, k) {
  c.hopT -= k / 60;
  if (c.fly) return;
  const L = TZ_LEVELS[c.lvl];
  if (c.ground && (c.x < L.x0 - 2 || c.x > L.x1 + 2)) c.ground = false;
  if (c.ground) { c.vy = 0; c.y = L.y; return; }
  const py = c.y;
  c.vy += 0.25 * k;
  c.y += c.vy * k;
  if (c.vy >= 0) {
    for (let i = TZ_LEVELS.length - 1; i >= 0; i--) {
      const q = TZ_LEVELS[i];
      if (py <= q.y + 0.5 && c.y >= q.y && c.x >= q.x0 - 2 && c.x <= q.x1 + 2) { c.y = q.y; c.vy = 0; c.ground = true; c.lvl = i; break; }
    }
  }
}
function tzItems(k, dt) {
  for (const i of TZ.items) {
    if (i.ground && i.type === 'treat') { i.life = (i.life || 0) + dt; continue; }
    i.vy += 0.25 * k;
    i.x += i.vx * k; i.y += i.vy * k;
    i.vx *= i.ground ? 0.9 : 0.999;
    if (i.x < 8) { i.x = 8; i.vx = Math.abs(i.vx) * 0.6; }
    if (i.x > 792) { i.x = 792; i.vx = -Math.abs(i.vx) * 0.6; }
    i.ground = false;
    for (let q = TZ_LEVELS.length - 1; q >= 0; q--) {
      const L = TZ_LEVELS[q];
      if (i.vy >= 0 && i.y >= L.y - 5 && i.y - i.vy * k <= L.y - 5 + 0.5 && i.x >= L.x0 && i.x <= L.x1) {
        i.y = L.y - 5;
        if (i.type === 'ball' && Math.abs(i.vy) > 1.2) i.vy = -i.vy * 0.62; else { i.vy = 0; i.ground = true; }
        break;
      }
    }
    if (i.type === 'ball' && i.ground && Math.abs(i.vx) < 0.05) i.vx = 0;
  }
  TZ.items = TZ.items.filter(i => !(i.type === 'treat' && (i.life || 0) > 90));
}

/* ---------- drawing ---------- */
function tzSky() {
  const h = TZ.hour, night = TZ.night;
  return { night, sun: tzClamp((h - 6) / 14, 0, 1) };
}
function tzRoom(now) {
  const { night, sun } = tzSky(), B = b;
  B.imageSmoothingEnabled = false;
  for (let x = 0; x < BW; x += 20) { B.fillStyle = (x / 20) % 2 ? '#f6e9f0' : '#f1e1ea'; B.fillRect(x, 0, 20, TZ_FLOOR); }
  B.fillStyle = '#e7d4df'; B.fillRect(0, 300, BW, 22);
  B.fillStyle = '#fff6ea'; B.fillRect(0, 320, BW, 10);
  B.fillStyle = '#e9cba2'; B.fillRect(0, TZ_FLOOR, BW, BH - TZ_FLOOR);
  B.fillStyle = '#dcb98a';
  for (let x = 0; x < BW; x += 50) B.fillRect(x + ((x / 50) % 2 ? 20 : 0), TZ_FLOOR + 6, 2, BH);
  for (let y = TZ_FLOOR + 22; y < BH; y += 22) B.fillRect(0, y, BW, 1);
  B.fillStyle = '#f3dcb8'; B.fillRect(0, TZ_FLOOR, BW, 2);
  /* window */
  const wx = 70, wy = 45, ww = 120, wh = 120;
  B.fillStyle = '#fff4e2'; B.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
  const skyTop = night > 0.5 ? '#26305e' : '#a9dcfb', skyBot = night > 0.5 ? '#3d4a86' : '#dff3ff';
  B.fillStyle = skyTop; B.fillRect(wx, wy, ww, wh / 2);
  B.fillStyle = skyBot; B.fillRect(wx, wy + wh / 2, ww, wh / 2);
  if (night < 0.5) {
    const sx = wx + 10 + sun * (ww - 30), sy = wy + 80 - Math.sin(sun * Math.PI) * 60;
    B.fillStyle = '#ffe58a'; B.fillRect(sx - 6, sy - 6, 12, 12); B.fillStyle = '#fff6c0'; B.fillRect(sx - 4, sy - 4, 8, 8);
    B.fillStyle = '#ffffff'; B.fillRect(wx + 12 + ((now / 400) % 70) | 0, wy + 28, 22, 6); B.fillRect(wx + 18 + ((now / 400) % 70) | 0, wy + 24, 12, 6);
  } else {
    B.fillStyle = '#f4f1d0'; B.fillRect(wx + 80, wy + 22, 14, 14); B.fillStyle = '#26305e'; B.fillRect(wx + 85, wy + 22, 10, 10);
    B.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) B.fillRect(wx + ((i * 37 + 11) % 110), wy + ((i * 23 + 7) % 80), 1 + (i % 2), 1 + (i % 2));
  }
  B.fillStyle = '#fff4e2'; B.fillRect(wx + ww / 2 - 2, wy, 4, wh); B.fillRect(wx, wy + wh / 2 - 2, ww, 4);
  B.fillStyle = '#e9d3b4'; B.fillRect(wx - 10, wy + wh + 6, ww + 20, 6);
  if (night < 0.5) { B.fillStyle = 'rgba(255,244,200,.14)'; B.beginPath(); B.moveTo(wx, wy + wh); B.lineTo(wx + ww, wy + wh); B.lineTo(wx + ww + 120, TZ_FLOOR + 40); B.lineTo(wx + 80, TZ_FLOOR + 40); B.closePath(); B.fill(); }
  /* shelves */
  for (let i = 1; i < TZ_LEVELS.length; i++) {
    const L = TZ_LEVELS[i];
    B.fillStyle = '#c99a6a'; B.fillRect(L.x0, L.y, L.x1 - L.x0, 7);
    B.fillStyle = '#e4bc8a'; B.fillRect(L.x0, L.y, L.x1 - L.x0, 2);
    B.fillStyle = '#b3855a'; B.fillRect(L.x0 + 10, L.y + 7, 5, 12); B.fillRect(L.x1 - 15, L.y + 7, 5, 12);
  }
  /* plants */
  tzPlant(745, TZ_FLOOR, 1.2); tzPlant(610, TZ_LEVELS[2].y, 0.7);
  /* cushion */
  B.fillStyle = '#ffb7cf'; B.fillRect(TZ_OBJ.bed - 34, TZ_FLOOR - 12, 68, 12); B.fillRect(TZ_OBJ.bed - 30, TZ_FLOOR - 16, 60, 4);
  B.fillStyle = '#ffd2e0'; B.fillRect(TZ_OBJ.bed - 28, TZ_FLOOR - 15, 40, 3);
  B.fillStyle = '#f08fb0'; B.fillRect(TZ_OBJ.bed - 34, TZ_FLOOR - 2, 68, 2);
  /* bowls */
  tzBowl(TZ_OBJ.food, TZ.room.food, '#9ccff2', '#c98f5a');
  tzBowl(TZ_OBJ.water, TZ.room.water, '#ffc9dc', '#7cc0f0');
  /* music box */
  const my = TZ_LEVELS[1].y;
  B.fillStyle = '#9b7ad8'; B.fillRect(TZ_OBJ.music - 14, my - 14, 28, 14); B.fillStyle = '#c4a8f2'; B.fillRect(TZ_OBJ.music - 14, my - 14, 28, 3);
  B.fillStyle = '#ffe58a'; B.fillRect(TZ_OBJ.music + 14, my - 10, 5, 2); B.fillRect(TZ_OBJ.music + 17, my - 10, 2, 6);
  if (TZ.room.music > 0) {
    B.fillStyle = '#9b7ad8';
    for (let i = 0; i < 3; i++) { const q = ((now / 30 + i * 33) % 100), nx = TZ_OBJ.music - 6 + i * 8 + Math.sin(q / 8) * 3, ny = my - 18 - q * 0.5; B.fillRect(nx | 0, ny | 0, 3, 3); B.fillRect((nx + 2) | 0, (ny - 5) | 0, 1, 5); }
  }
  /* ceiling light */
  B.fillStyle = '#b9b3a6'; B.fillRect(TZ_OBJ.ceiling, 0, 1, 26);
  B.fillStyle = '#fff1c4'; B.fillRect(TZ_OBJ.ceiling - 12, 26, 24, 8); B.fillRect(TZ_OBJ.ceiling - 8, 22, 16, 4);
  if (TZ.room.light) { B.fillStyle = '#fff6a8'; B.fillRect(TZ_OBJ.ceiling - 6, 34, 12, 3); }
  /* heat lamp */
  B.fillStyle = '#b9b3a6'; B.fillRect(TZ_OBJ.lamp, 0, 1, 40);
  B.fillStyle = '#9aa6ba'; B.fillRect(TZ_OBJ.lamp - 14, 40, 28, 8); B.fillRect(TZ_OBJ.lamp - 9, 36, 18, 4);
  B.fillStyle = TZ.room.lamp ? '#ffb35a' : '#8a8f9a'; B.fillRect(TZ_OBJ.lamp - 6, 48, 12, 5);
  if (TZ.room.lamp) {
    B.fillStyle = 'rgba(255,190,110,.13)'; B.beginPath(); B.moveTo(TZ_OBJ.lamp - 8, 53); B.lineTo(TZ_OBJ.lamp + 8, 53); B.lineTo(TZ_OBJ.lamp + 80, TZ_FLOOR); B.lineTo(TZ_OBJ.lamp - 80, TZ_FLOOR); B.closePath(); B.fill();
  }
}
function tzPlant(x, y, s) {
  const B = b, w = 18 * s;
  B.fillStyle = '#ee9a78'; B.fillRect(x - w / 2, y - 14 * s, w, 14 * s); B.fillStyle = '#f7b99c'; B.fillRect(x - w / 2, y - 14 * s, w, 3 * s);
  B.fillStyle = '#7fcf8c';
  for (let i = -2; i <= 2; i++) B.fillRect(x + i * 6 * s - 2, y - (30 + (2 - Math.abs(i)) * 9) * s, 5 * s, (18 + (2 - Math.abs(i)) * 9) * s);
  B.fillStyle = '#a8e6ae'; for (let i = -2; i <= 2; i++) B.fillRect(x + i * 6 * s - 2, y - (30 + (2 - Math.abs(i)) * 9) * s, 2, 5 * s);
}
function tzBowl(x, level, col, fill) {
  const B = b, y = TZ_FLOOR;
  B.fillStyle = col; B.fillRect(x - 17, y - 10, 34, 10); B.fillRect(x - 14, y - 12, 28, 2);
  B.fillStyle = 'rgba(255,255,255,.45)'; B.fillRect(x - 15, y - 9, 3, 6);
  if (level > 1) { B.fillStyle = fill; const h = Math.max(1, Math.round(level / 100 * 8)); B.fillRect(x - 12, y - 12 - h + 2, 24, h); }
  B.fillStyle = 'rgba(0,0,0,.12)'; B.fillRect(x - 17, y - 1, 34, 1);
}
function tzGlyph(cx, cy, key) {
  const G = TZ_GLYPH[key];
  if (!G) return;
  const B = b;
  B.fillStyle = OUTLINE; B.fillRect(cx - 5, cy - 5, 11, 11);
  B.fillStyle = '#fffaf0'; B.fillRect(cx - 4, cy - 4, 9, 9);
  B.fillStyle = OUTLINE; B.fillRect(cx - 1, cy + 6, 3, 2); B.fillStyle = '#fffaf0'; B.fillRect(cx, cy + 5, 1, 2);
  B.fillStyle = G[1];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (G[0][j][i] === '1') B.fillRect(cx - 2 + i, cy - 2 + j, 1, 1);
}
function tzDraw(c, sel, now) {
  const wpp = c.adult * 1.8 / c.rT, g = tzGrowth(c), size = c.adult * (0.5 + 0.5 * g), cy = c.y - c.half;
  const rec = TZ.tmp || (TZ.tmp = new Float32Array(CS_STRIDE));
  for (let i = 0; i < CS_STRIDE; i++) rec[i] = c.rec[i] || 0;
  rec[1] = c.x * wpp; rec[2] = cy * wpp; rec[3] = c.face > 0 ? 0 : Math.PI; rec[4] = size;
  rec[7] = c.hp; rec[10] = c.stress > 60 ? 0.7 : 0; rec[11] = 0; rec[12] = c.sleeping ? 1 : 0; rec[13] = tzMood(c) / 100;
  rec[14] = 0; rec[15] = g < 0.5 ? 1 - g : 0; rec[17] = c.heartUntil > now ? 1 : 0;
  rec[18] = c.moving ? 0.5 : 0; rec[25] = g < 0.5 ? 1 : 0; rec[19] = c.rec[19];
  gst.noRing = true;
  drawCreature(rec, 0, sel, wpp, 0, 0, gst);
  gst.noRing = false;
}
function tzRender() {
  const now = Date.now(), B = b;
  tzRoom(now);
  for (const e of TZ.eggs) {
    const wob = e.left < 12 ? Math.sin(now / 60) * 1.5 : 0;
    B.fillStyle = OUTLINE; B.fillRect(e.x - 6 + wob, e.y - 17, 12, 17); B.fillRect(e.x - 4 + wob, e.y - 19, 8, 2);
    B.fillStyle = '#fff3d6'; B.fillRect(e.x - 5 + wob, e.y - 16, 10, 15); B.fillRect(e.x - 3 + wob, e.y - 18, 6, 2);
    B.fillStyle = `hsl(${(e.rec[5] || 0)},70%,80%)`; B.fillRect(e.x - 5 + wob, e.y - 9, 10, 3); B.fillRect(e.x - 2 + wob, e.y - 14, 3, 2);
  }
  for (const i of TZ.items) {
    if (i.type === 'ball') { B.fillStyle = OUTLINE; B.fillRect(i.x - 6, i.y - 6, 12, 12); B.fillStyle = '#ff9db8'; B.fillRect(i.x - 5, i.y - 5, 10, 10); B.fillStyle = '#ffd0de'; B.fillRect(i.x - 3, i.y - 4, 3, 3); B.fillStyle = '#ffffff'; B.fillRect(i.x - 5, i.y - 1, 10, 2); }
    else { B.fillStyle = OUTLINE; B.fillRect(i.x - 5, i.y - 4, 10, 8); B.fillStyle = '#e0a868'; B.fillRect(i.x - 4, i.y - 3, 8, 6); B.fillStyle = '#8a5a30'; B.fillRect(i.x - 2, i.y - 2, 1, 1); B.fillRect(i.x + 1, i.y, 1, 1); B.fillRect(i.x - 1, i.y + 1, 1, 1); }
  }
  const order = TZ.list.slice().sort((p, q) => p.y - q.y);
  for (const c of order) tzDraw(c, c.id === TZ.sel, now);
  for (const c of order) {
    const top = c.y - c.half * 2 - 6;
    let key = null;
    if (c.sleeping) key = (now / 700 | 0) % 2 ? 'rest' : null;
    else if (c.heartUntil > now) key = 'love';
    else if (c.bubble && c.bubbleUntil > TZ.clock) key = c.bubble;
    if (key) tzGlyph(Math.round(c.x), Math.round(top - 8), key);
  }
  B.fillStyle = '#d9d3dc';
  TZ.graves.slice(-4).forEach((q, i) => { const gx = 770 - i * 22; B.fillStyle = OUTLINE; B.fillRect(gx - 7, TZ_FLOOR - 17, 14, 17); B.fillStyle = '#cfc8d6'; B.fillRect(gx - 6, TZ_FLOOR - 16, 12, 16); B.fillStyle = '#9a93a3'; B.fillRect(gx - 1, TZ_FLOOR - 13, 2, 8); B.fillRect(gx - 3, TZ_FLOOR - 10, 6, 2); });
  if (TZ.night > 0.05) {
    B.fillStyle = `rgba(20,24,70,${(TZ.room.light ? 0.12 : 0.36) * TZ.night})`;
    B.fillRect(0, 0, BW, BH);
  }
  const tc = tzEl('terra').getContext('2d');
  tc.imageSmoothingEnabled = false;
  tc.drawImage(bufCanvas, 0, 0, BW * S, BH * S);
  tc.font = '12px Silkscreen, monospace';
  tc.textAlign = 'center';
  for (const c of order) {
    const nx = c.x * S, ny = (c.y + 12) * S;
    tc.fillStyle = 'rgba(40,30,60,.75)'; tc.fillText(c.name, nx + 1, ny + 1);
    tc.fillStyle = c.id === TZ.sel ? '#ffd84a' : '#fffaf0'; tc.fillText(c.name, nx, ny);
  }
}

/* ---------- input ---------- */
function tzPointer(e) {
  const cv2 = tzEl('terra'), r = cv2.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * BW, y = (e.clientY - r.top) / r.height * BH;
  let hit = null, hd = 1e9;
  for (const c of TZ.list) {
    const cx = c.x, cy = c.y - c.half, d = Math.hypot(x - cx, y - cy);
    if (d < c.half + c.halfW * 0.4 + 6 && d < hd) { hd = d; hit = c; }
  }
  if (hit) {
    TZ.sel = hit.id;
    if (TZ.tool === 'pet') {
      hit.stress = Math.max(0, hit.stress - 10); hit.needs.fun = Math.min(100, hit.needs.fun + 7); hit.love = Math.min(100, hit.love + 3);
      hit.heartUntil = Date.now() + 1800; hit.sleeping = false;
    }
    tzPanel(true);
    return;
  }
  const near = (ox, oy, w, h) => x >= ox - w && x <= ox + w && y >= oy - h && y <= oy + h;
  if (near(TZ_OBJ.food, TZ_FLOOR - 8, 22, 14)) { TZ.room.food = Math.min(100, TZ.room.food + 40); toast(t('tz.filled')); return; }
  if (near(TZ_OBJ.water, TZ_FLOOR - 8, 22, 14)) { TZ.room.water = Math.min(100, TZ.room.water + 40); toast(t('tz.filled')); return; }
  if (near(TZ_OBJ.lamp, 44, 22, 14)) { TZ.room.lamp = !TZ.room.lamp; return; }
  if (near(TZ_OBJ.ceiling, 30, 18, 10)) { TZ.room.light = !TZ.room.light; return; }
  if (near(TZ_OBJ.music, TZ_LEVELS[1].y - 8, 20, 12)) { TZ.room.music = 25; return; }
  if (TZ.tool === 'treat' && TZ.items.filter(i => i.type === 'treat').length < 6) TZ.items.push({ type: 'treat', x: tzClamp(x, 10, 790), y: Math.min(y, 200), vx: 0, vy: 0, ground: false });
  else if (TZ.tool === 'ball') { if (TZ.items.filter(i => i.type === 'ball').length >= 2) TZ.items.shift(); TZ.items.push({ type: 'ball', x: tzClamp(x, 10, 790), y: Math.min(y, 200), vx: tzRnd(-1, 1), vy: 0, ground: false }); }
  else if (TZ.tool === 'select') { TZ.sel = 0; tzPanel(true); }
}
function tzSetTool(name) {
  TZ.tool = name;
  for (const bt of document.querySelectorAll('#ttools button')) bt.classList.toggle('on', bt.dataset.ttool === name);
}
function tzInit() {
  tzEl('terra').addEventListener('pointerdown', tzPointer);
  for (const bt of document.querySelectorAll('#ttools button')) bt.onclick = () => tzSetTool(bt.dataset.ttool);
  tzEl('tzRename').onclick = () => {
    const v = tzEl('tzName').value, c = tzFind(TZ.sel);
    if (c && v.trim()) { tzCall({ type: 'trename', id: c.id, name: v }).then(() => tzReconcileNames()); tzEl('tzName').value = ''; }
  };
  tzEl('tzRelease').onclick = () => { if (TZ.sel) tzRelease(TZ.sel); };
  window.addEventListener('beforeunload', () => { tzSave(); });
  tzLoad().then(() => { TZ.loaded = true; });
}
async function tzReconcileNames() {
  const r = await tzCall({ type: 'tlist' });
  for (const q of r.list || []) { const c = tzFind(q.id); if (c) c.name = q.name; }
}

/* ---------- side panel ---------- */
function tzPanel(force) {
  const now = Date.now();
  if (!force && TZ.panelAt && now - TZ.panelAt < 400) return;
  TZ.panelAt = now;
  const L = tr('tz.needs'), sel = tzFind(TZ.sel);
  const card = c => {
    const g = tzGrowth(c), phase = g < 0.5 ? t('tz.baby') : g < TZ.ADULT ? t('tz.young') : t('tz.adult');
    return `<div class="tzcard${c.id === TZ.sel ? ' on' : ''}"><a class="w" data-tz="${c.id}">${esc(c.name)}</a> <span class="muted">${esc(phase)} | ${esc(t('tz.gen'))} ${c.gen}</span><table>` +
      row(t('tz.hp'), barHtml(c.hp / 100, c.hp > 50 ? '#6fd36f' : c.hp > 25 ? '#e5c14a' : '#e05a4a')) +
      TZ_NEEDS.map(q => row(esc(L[q]), barHtml(c.needs[q] / 100, c.needs[q] > 40 ? '#9fd8ff' : '#e0645a'))).join('') + '</table></div>';
  };
  setHtml(tzEl('tzList'), TZ.list.length ? TZ.list.map(card).join('') : `<div class="muted">${esc(t('tz.none'))}</div>` + (TZ.eggs.length ? '' : ''));
  const eg = TZ.eggs.length ? `<div class="muted">${esc(t('tz.eggs', TZ.eggs.length, Math.max(0, Math.ceil(Math.min(...TZ.eggs.map(e => e.left))))))}</div>` : '';
  setHtml(tzEl('tzEggs'), eg);
  tzEl('tzSelHead').style.display = sel ? 'block' : 'none';
  if (sel) {
    const g = tzGrowth(sel);
    tzEl('tzSelName').textContent = sel.name;
    setHtml(tzEl('tzInfo'), '<table>' +
      row(t('tz.growth'), pct(g)) + row(t('tz.mood'), pct(tzMood(sel) / 100)) + row(t('tz.stress'), pct(sel.stress / 100)) + row(t('tz.love'), pct(sel.love / 100)) +
      row(t('tz.gen'), sel.gen) + row(t('tz.kids'), sel.kids) + row(t('tz.words'), sel.words) + '</table>');
  }
  const gr = TZ.graves.slice().reverse().map(q => `<tr><td class="l">${esc(q.name)} <span class="muted">${esc(t('tz.gen'))} ${q.gen}</span></td><td>${esc(tr('causes')[q.cause] || q.cause)}</td></tr>`).join('');
  setHtml(tzEl('tzGraves'), gr ? `<table>${gr}</table>` : `<div class="muted">-</div>`);
  const rm = TZ.room;
  setHtml(tzEl('tzRoom'), '<table>' + row(t('tz.bowlFood'), barHtml(rm.food / 100, '#c98f5a')) + row(t('tz.bowlWater'), barHtml(rm.water / 100, '#7cc0f0')) +
    row(t('tz.lamp'), rm.lamp ? `<span class="yes">${esc(t('sel.yes'))}</span>` : `<span class="no">${esc(t('sel.no'))}</span>`) +
    row(t('tz.light'), rm.light ? `<span class="yes">${esc(t('sel.yes'))}</span>` : `<span class="no">${esc(t('sel.no'))}</span>`) + '</table>');
}
