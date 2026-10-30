'use strict';
/* Terrarium: side-view care room for adopted Plimploms.
   Genomes, brains and language live in the WebAssembly world (world.terra); needs, positions and objects live here. */
const TZ = {
  MAX: 8, GROW: 600, ADULT: 0.98, list: [], eggs: [], items: [], parts: [], graves: [], sel: 0, tool: 'select',
  room: { food: 70, water: 70, lamp: true, light: false, music: 0 }, extra: [], lv: [], reach: [],
  last: 0, ready: false, saveAt: 0, persisted: null, night: 0, hour: 12, pending: false, clock: 0, breedT: 0, drag: null, partyCool: 0, callT: 0, callX: 0, callLvl: 0, wordMem: ''
};
const TZ_FLOOR = 330;
const TZ_BASE = [{ x0: -1e9, x1: 1e9, y: TZ_FLOOR }, { x0: 330, x1: 520, y: 285 }, { x0: 440, x1: 640, y: 235 }];
const TZ_ROWS = [285, 235, 190, 145, 100];
const TZ_OBJ = { food: 230, water: 292, lamp: 650, bed: 120, music: 395, ceiling: 400, puzzle: 560 };
const TZ_NEEDS = ['food', 'water', 'warmth', 'light', 'fun', 'rest', 'social'];
const TZ_RATE = { food: 0.12, water: 0.15, warmth: 0.05, light: 0.08, fun: 0.1, rest: 0.04, social: 0.06 };
const TZ_FEAT = { food: 1, water: 8, warmth: 7, light: 9, fun: 9, rest: 5, social: 3 };
const TZ_GOALNEED = { food: 'food', treat: 'food', water: 'water', warm: 'warmth', sleep: 'rest', ball: 'fun', music: 'fun', puzzle: 'fun', bubble: 'fun', plush: 'social', social: 'social', call: 'social', wander: 'fun', party: 'fun' };
const TZ_ACC = ['none', 'bow', 'hat', 'glasses', 'scarf', 'crown', 'flower'];
const TZ_TOOLS = ['select', 'pet', 'brush', 'tickle', 'treat', 'ball', 'bubbles', 'plush', 'call', 'dress', 'party', 'teach', 'level'];
const TZ_GLYPH = {
  food: [['00100', '01110', '11111', '11111', '01110'], '#e86a5a'],
  water: [['00100', '00100', '01110', '11111', '01110'], '#4a9ae0'],
  warmth: [['00100', '01100', '01110', '11111', '01110'], '#f08a3a'],
  light: [['10101', '01110', '11111', '01110', '10101'], '#e8b020'],
  fun: [['01110', '11101', '11111', '11111', '01110'], '#c060c8'],
  rest: [['11111', '00010', '00100', '01000', '11111'], '#6a7ab0'],
  social: [['00000', '10001', '00000', '01110', '10001'], '#6a8fc8'],
  love: [['01010', '11111', '11111', '01110', '00100'], '#ff6fa8']
};
const tzClamp = (v, a, b) => Math.min(b, Math.max(a, v));
const tzRnd = (a, b) => a + Math.random() * (b - a);
const tzEl = id => document.getElementById(id);
const tzDefNeeds = () => ({ food: 80, water: 80, warmth: 80, light: 80, fun: 70, rest: 80, social: 80 });

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

/* ---------- levels (shelves) and path finding ---------- */
function tzBuildLevels() {
  TZ.lv = TZ_BASE.concat(TZ.extra);
  const n = TZ.lv.length;
  TZ.reach = new Array(n).fill(false);
  TZ.reach[0] = true;
  let ch = true;
  while (ch) { ch = false; for (let i = 0; i < n; i++) if (TZ.reach[i]) for (let j = 0; j < n; j++) if (!TZ.reach[j] && tzEdgeUp(i, j)) { TZ.reach[j] = true; ch = true; } }
}
function tzEdgeUp(i, j) {
  const A = TZ.lv[i], B = TZ.lv[j];
  if (B.y >= A.y || A.y - B.y > 58) return false;
  return Math.max(A.x0, B.x0 - 10) + 6 <= Math.min(A.x1, B.x1 + 10) - 6;
}
function tzEdge(i, j) { return TZ.lv[j].y > TZ.lv[i].y || tzEdgeUp(i, j); }
/* next level on the way from `from` to `to`, -1 if equal, -2 if unreachable */
function tzPlan(from, to) {
  if (from === to) return -1;
  const n = TZ.lv.length, prev = new Array(n).fill(-2), q = [from];
  prev[from] = -1;
  while (q.length) {
    const i = q.shift();
    if (i === to) break;
    for (let j = 0; j < n; j++) if (prev[j] === -2 && tzEdge(i, j)) { prev[j] = i; q.push(j); }
  }
  if (prev[to] === -2) return -2;
  let j = to;
  while (prev[j] !== from) j = prev[j];
  return j;
}
function tzLevelOf(y) { let best = 0, bd = 1e9; TZ.lv.forEach((L, i) => { const d = Math.abs(L.y - y); if (d < bd && TZ.reach[i]) { bd = d; best = i; } }); return best; }
function tzToggleLevel(x, y) {
  const row = TZ_ROWS.reduce((a, r) => (Math.abs(r - y) < Math.abs(a - y) ? r : a), TZ_ROWS[0]);
  const hit = TZ.extra.findIndex(L => Math.abs(L.y - row) < 4 && x >= L.x0 - 6 && x <= L.x1 + 6);
  if (hit >= 0) {
    TZ.extra.splice(hit, 1);
    tzBuildLevels();
    for (const c of TZ.list) { if (c.lvl >= TZ.lv.length || !TZ.reach[c.lvl]) { c.lvl = 0; c.ground = false; } else if (c.ground) { const L = TZ.lv[c.lvl]; if (c.x < L.x0 || c.x > L.x1) c.ground = false; } }
    return;
  }
  if (TZ.extra.length >= 5) { toast(t('tz.maxLevels')); return; }
  const cx = tzClamp(x, 85, 715), L = { x0: cx - 75, x1: cx + 75, y: row };
  if (TZ.extra.some(q => q.y === row && q.x0 < L.x1 && q.x1 > L.x0) || TZ_BASE.some((q, i) => i > 0 && q.y === row && q.x0 < L.x1 && q.x1 > L.x0)) { toast(t('tz.levelBlocked')); return; }
  TZ.extra.push(L);
  tzBuildLevels();
  if (!TZ.reach[TZ.lv.length - 1]) { TZ.extra.pop(); tzBuildLevels(); toast(t('tz.levelUnreach')); return; }
  tzBurst('star', cx, row - 6, 8);
}

/* ---------- creature records ---------- */
function tzMake(r, st) {
  const rec = Array.from(r.rec), g = tzClamp(r.growth === undefined ? 1 : r.growth, 0, 1);
  const adult = rec[4] > 0.5 ? rec[4] / (0.5 + 0.5 * g) : 7;
  const rT = tzClamp(Math.round(7 + adult * 1.5), 14, 22);
  const c = {
    id: r.id, name: r.name, gen: r.gen, kids: r.children || 0, words: r.words || 0, learn: r.learn || 0.06, cur: r.cur || 0.5, rec, adult, rT,
    age: (st && st.age !== undefined) ? st.age : g * TZ.GROW,
    needs: Object.assign(tzDefNeeds(), st && st.needs || {}),
    hp: st && st.hp !== undefined ? st.hp : 100, stress: st && st.stress || 0, love: st && st.love || 0, breedCool: st && st.breedCool || 0,
    acc: st && st.acc || 0, skill: st && st.skill || 0, obey: st && st.obey || 0, vocab: st && st.vocab || {},
    x: st && st.x !== undefined ? tzClamp(st.x, 30, 770) : tzRnd(80, 720), y: TZ_FLOOR, vx: 0, vy: 0, face: 1, lvl: 0, ground: true, held: false,
    goal: null, goalT: 0, sleeping: false, bubble: null, bubbleUntil: 0, nextBubble: 0, heartUntil: 0, laughUntil: 0, danceUntil: 0, hopT: 0, moving: false, kick: 0, act: 0,
    px: 0, py: 0, pt: 0, stuck: 0, arrived: false
  };
  c.soc = r.soc !== undefined ? tzClamp(r.soc, 0, 1) : tzSoc(c);
  c.fly = rec[9] > 0;
  tzGeom(c);
  if (st && st.y !== undefined) { c.y = st.y; c.lvl = st.lvl || 0; if (c.lvl >= TZ.lv.length) { c.lvl = 0; c.y = TZ_FLOOR; } }
  c.px = c.x; c.py = c.y;
  return c;
}
/* sociality 0..1: per individual trait derived from its genome record; predators and loners need little company */
function tzSoc(c) {
  let h = 2166136261;
  for (let i = 0; i < 12; i++) { h ^= (c.rec[20 + (i % 5)] * 31 + c.rec[5] + i * 7) | 0; h = Math.imul(h, 16777619); }
  const u = ((h >>> 0) % 1000) / 1000;
  return tzClamp((c.rec[6] > 0 ? 0.15 : 0.35) + u * 0.65, 0, 1);
}
function tzGrowth(c) { return Math.min(1, c.age / TZ.GROW); }
function tzWholeGeom(c) {
  const g = tzGrowth(c), r = Math.max(2, Math.round(c.rT * (0.5 + 0.5 * g))), idx = crPickIdx(c.rec);
  const sp = crWholeSprite(idx, (Math.round(c.rec[5] / 12) * 12) % 360, c.rec[82] | 0);
  const s = Math.max(1, Math.round(r * 2.4 / sp.h));
  c.r = r; c.ws = s; c.wsp = sp;
  c.half = Math.max(8, sp.h * s / 2); c.halfW = Math.max(8, sp.w * s * 0.45); c.bodyH = sp.h * s * 0.6; c.legL = 3 * s;
  return sp;
}
function tzGeom(c) {
  if (crWholeOn()) { tzWholeGeom(c); return; }
  const g = tzGrowth(c), r = Math.max(2, Math.round(c.rT * (0.5 + 0.5 * g)));
  const sp = crSprite(c.rec, { r, baby: g < 0.5, ph: 0 });
  c.r = r;
  c.half = Math.max(8, sp.hAbove / 2);
  c.halfW = Math.max(8, sp.wHalf * 0.9);
  c.bodyH = sp.hAbove * 0.6;
  c.legL = sp.A.legL;
}
function tzMood(c) { const n = c.needs; return (n.food + n.water + n.warmth + n.light + n.fun + n.rest + n.social) / 7; }
function tzFind(id) { return TZ.list.find(c => c.id === id); }
function tzAlone() { return TZ.list.length <= 1; }

/* ---------- adopt, release, reconcile ---------- */
async function tzAdopt(id) {
  if (TZ.list.length + TZ.eggs.length >= TZ.MAX) { toast(t('tz.full')); return; }
  const r = await tzCall({ type: 'take', id });
  if (!r.ok) { toast(r.full ? t('tz.full') : r.kraft ? t('t.kraft') : r.low ? t('tz.low') : t('tz.noTake')); return; }
  const c = tzMake(r, null);
  TZ.list.push(c);
  TZ.sel = c.id;
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
  if (P && Array.isArray(P.extra)) TZ.extra = P.extra.filter(L => L && isFinite(L.x0) && isFinite(L.x1) && TZ_ROWS.includes(L.y)).slice(0, 5);
  tzBuildLevels();
  TZ.list = []; TZ.eggs = [];
  for (const q of rs) {
    if (eggById.has(q.id)) { const e = eggById.get(q.id); TZ.eggs.push({ id: q.id, name: q.name, gen: q.gen, rec: q.rec, learn: q.learn, cur: q.cur, soc: q.soc, x: e.x, left: e.left, y: TZ_FLOOR, vy: 0 }); continue; }
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
    v: 2, savedAt: Date.now(), room: TZ.room, graves: TZ.graves, extra: TZ.extra,
    eggs: TZ.eggs.map(e => ({ id: e.id, x: e.x, left: e.left })),
    list: TZ.list.map(c => ({ id: c.id, age: c.age, needs: c.needs, hp: c.hp, stress: c.stress, love: c.love, breedCool: c.breedCool, x: c.x, y: c.y, lvl: c.lvl, acc: c.acc, skill: c.skill, obey: c.obey, vocab: c.vocab }))
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
    for (const k of TZ_NEEDS) { const rate = TZ_RATE[k] * (k === 'social' && tzAlone() ? 2 : 1); c.needs[k] = Math.max(Math.min(c.needs[k], 15), c.needs[k] - rate * sec * 0.25); if (c.needs[k] <= 15) low = true; }
    if (low) { c.hp = Math.max(30, c.hp - Math.min(40, sec / 900)); c.stress = Math.min(70, c.stress + sec / 400); }
    c.sleeping = false; c.goal = null; c.ground = true; c.y = TZ_FLOOR; c.lvl = 0; c.vy = 0; c.held = false;
    tzGeom(c);
  }
  for (const e of TZ.eggs) e.left -= sec;
  TZ.room.food = Math.max(0, TZ.room.food - sec * 0.01);
  TZ.room.water = Math.max(0, TZ.room.water - sec * 0.01);
  tzHatch();
}

/* ---------- day and night from the real clock ---------- */
function tzDay() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  TZ.hour = h;
  TZ.night = 1 - Math.min(tzClamp((h - 6) / 2, 0, 1), tzClamp((20 - h) / 2, 0, 1));
}

/* ---------- particles ---------- */
function tzBurst(type, x, y, n) {
  for (let i = 0; i < n; i++) {
    if (type === 'conf') TZ.parts.push({ type, x: x + tzRnd(-30, 30), y: y + tzRnd(-10, 10), vx: tzRnd(-1.5, 1.5), vy: tzRnd(-3.5, -0.5), life: 140, col: `hsl(${(Math.random() * 360) | 0},80%,72%)` });
    else if (type === 'heart') TZ.parts.push({ type, x: x + tzRnd(-8, 8), y, vx: tzRnd(-0.2, 0.2), vy: -0.5 - Math.random() * 0.3, life: 50, col: '#ff6fa8' });
    else TZ.parts.push({ type: 'star', x: x + tzRnd(-12, 12), y: y + tzRnd(-12, 12), vx: tzRnd(-0.6, 0.6), vy: tzRnd(-0.8, 0.2), life: 26, col: '#fff2a0' });
  }
  if (TZ.parts.length > 400) TZ.parts.splice(0, TZ.parts.length - 400);
}
function tzParts(k) {
  for (const p of TZ.parts) {
    p.x += p.vx * k; p.y += p.vy * k; p.life -= k;
    if (p.type === 'conf') { p.vy += 0.06 * k; p.vx *= 0.99; if (p.y > TZ_FLOOR + 10) { p.vy = 0; p.vx = 0; p.y = TZ_FLOOR + 10; p.life -= 2 * k; } }
  }
  TZ.parts = TZ.parts.filter(p => p.life > 0);
}

/* ---------- simulation ---------- */
function tzFrame() {
  const now = Date.now();
  if (!TZ.last) TZ.last = now;
  const ms = now - TZ.last;
  TZ.last = now;
  if (!TZ.ready) return;
  if (ms > 3000) { tzCatchUp(Math.min(ms / 1000, 86400 * 3)); return; }
  tzStep(ms / 1000);
  if (now - TZ.saveAt > 10000) tzSave();
}
function tzStep(dt) {
  const k = Math.min(4, dt * 60);
  tzDay();
  TZ.clock += dt;
  TZ.partyCool = Math.max(0, TZ.partyCool - dt);
  TZ.callT = Math.max(0, TZ.callT - dt);
  if (TZ.room.music > 0) TZ.room.music = Math.max(0, TZ.room.music - dt);
  const lightOn = TZ.night < 0.5 || TZ.room.light, alone = tzAlone();
  for (const c of TZ.list) {
    if (c.held) continue;
    const n = c.needs, sl = c.sleeping;
    c.age += dt;
    n.food -= TZ_RATE.food * dt * (sl ? 0.4 : 1);
    n.water -= TZ_RATE.water * dt * (sl ? 0.4 : 1);
    n.warmth -= TZ_RATE.warmth * dt * (1 + TZ.night);
    if (lightOn) n.light = Math.min(100, n.light + 0.3 * dt); else n.light -= TZ_RATE.light * dt;
    n.fun -= TZ_RATE.fun * dt * (sl ? 0 : 1);
    n.rest += (sl ? 1.3 : -TZ_RATE.rest) * dt;
    const near = TZ.list.some(o => o !== c && Math.abs(o.x - c.x) < 80 && Math.abs(o.y - c.y) < 70);
    if (near) n.social += 1.2 * dt; else n.social -= TZ_RATE.social * (0.15 + 1.7 * c.soc) * (alone ? 1.6 : 1) * dt * (sl ? 0.3 : 1);
    for (const q of TZ_NEEDS) n[q] = tzClamp(n[q], 0, 100);
    const min = Math.min(n.food, n.water, n.warmth, n.light, n.fun, n.rest, n.social);
    const w = n.social === min && min < 25 ? 0.5 : 1;
    if (min < 25) c.stress = Math.min(100, c.stress + (25 - min) / 25 * 0.6 * dt * w); else if (min > 50) c.stress = Math.max(0, c.stress - 0.8 * dt);
    if (n.food <= 0 || n.water <= 0 || n.warmth <= 0) { c.hp -= 0.4 * dt; c.cause = n.water <= 0 ? 'thirst' : n.food <= 0 ? 'hunger' : 'cold'; }
    else if (c.stress > 80) { c.hp -= 0.1 * dt; c.cause = n.social < 15 ? 'lonely' : 'stress'; }
    else if (tzMood(c) > 55) c.hp = Math.min(100, c.hp + 0.15 * dt);
    c.breedCool = Math.max(0, c.breedCool - dt);
    tzAI(c, dt, k);
    tzPhys(c, k);
    tzWatch(c, dt);
    if (c.age / TZ.GROW < 1 && ((c.age / TZ.GROW) * 20 | 0) !== (((c.age - dt) / TZ.GROW) * 20 | 0)) tzGeom(c);
  }
  tzItems(k, dt);
  tzParts(k);
  for (const e of TZ.eggs) { e.left -= dt; e.vy += 0.25 * k; e.y = Math.min(TZ_FLOOR, e.y + e.vy * k); if (e.y >= TZ_FLOOR) e.vy = 0; }
  tzHatch();
  TZ.breedT += dt;
  if (TZ.breedT > 1) { TZ.breedT = 0; tzBreeding(); tzDeaths(); }
}
/* stuck watchdog: no progress towards a goal for 3 s means a new plan; repeatedly stuck means a nudge to the floor */
function tzWatch(c, dt) {
  c.pt += dt;
  if (c.pt < 3) return;
  c.pt = 0;
  const moved = Math.hypot(c.x - c.px, c.y - c.py);
  c.px = c.x; c.py = c.y;
  if (c.sleeping || c.arrived || c.fly || moved > 4) { c.stuck = 0; return; }
  c.stuck++;
  c.goal = null; c.goalT = 0;
  if (c.ground) { c.vy = -5.2; c.ground = false; c.hopT = 0.4; }
  if (c.stuck >= 3) { c.stuck = 0; c.x = tzRnd(60, 740); c.y = TZ_FLOOR; c.lvl = 0; c.ground = true; c.vy = 0; }
}
function tzHatch() {
  const keep = [];
  for (const e of TZ.eggs) {
    if (e.left > 0) { keep.push(e); continue; }
    const c = tzMake({ id: e.id, name: e.name, gen: e.gen, rec: e.rec, growth: 0, children: 0, learn: e.learn, cur: e.cur, soc: e.soc }, { age: 0, x: e.x });
    c.heartUntil = Date.now() + 2500;
    TZ.list.push(c);
    tzBurst('star', c.x, c.y - c.half, 10);
    toast(t('tz.hatched', c.name));
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
  const ad = TZ.list.filter(c => tzGrowth(c) >= TZ.ADULT && !c.sleeping && c.hp > 60 && !c.held);
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
      TZ.eggs.push({ id: r.id, name: r.name, gen: r.gen, rec: Array.from(r.rec), learn: r.learn, cur: r.cur, soc: r.soc, x: (c.x + o.x) / 2, y: Math.min(c.y, o.y) - 20, vy: 0, left: 90 });
      c.kids++; o.kids++;
      c.heartUntil = o.heartUntil = Date.now() + 2500;
      tzBurst('heart', (c.x + o.x) / 2, c.y - c.half * 2, 6);
      toast(t('tz.egg'));
      tzSave();
    }
    return;
  }
}

/* ---------- behaviour ---------- */
function tzSpot(x, lvl) { const L = TZ.lv[lvl] || TZ.lv[0]; return tzClamp(x, Math.max(L.x0, 0) + 12, Math.min(L.x1, 800) - 12); }
function tzChoose(c) {
  const n = c.needs, room = TZ.room, night = TZ.night, ps = TZ.reach;
  if (TZ.callT > 0 && c.obey + 0.3 > Math.random()) return { type: 'call', x: TZ.callX, lvl: TZ.callLvl, t: 6 };
  const tre = TZ.items.filter(i => i.type === 'treat' && i.ground).sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0];
  if (tre && n.food < 85) return { type: 'treat', item: tre, x: tre.x, lvl: tzLevelOf(tre.y), t: 8 };
  const opt = [];
  if (n.food < 55 && room.food > 1) opt.push([100 - n.food, { type: 'food', x: TZ_OBJ.food, lvl: 0, t: 12 }]);
  if (n.water < 55 && room.water > 1) opt.push([100 - n.water, { type: 'water', x: TZ_OBJ.water, lvl: 0, t: 12 }]);
  if (n.warmth < 50 && room.lamp) opt.push([100 - n.warmth, { type: 'warm', x: TZ_OBJ.lamp, lvl: 0, t: 25 }]);
  if (n.rest < 30 || (night > 0.6 && n.rest < 70)) opt.push([100 - n.rest + night * 15, { type: 'sleep', x: TZ_OBJ.bed, lvl: 0, t: 60 }]);
  if (n.social < 55) {
    const others = TZ.list.filter(o => o !== c);
    const pl = TZ.items.find(i => i.type === 'plush');
    if (others.length) { const o = others.sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0]; opt.push([100 - n.social, { type: 'social', x: o.x + tzRnd(-20, 20), lvl: o.lvl, t: 8 }]); }
    else if (pl) opt.push([90 - n.social, { type: 'plush', item: pl, x: pl.x, lvl: tzLevelOf(pl.y), t: 20 }]);
  }
  if (n.fun < 65) {
    const bub = TZ.items.find(i => i.type === 'sbub');
    const ball = TZ.items.find(i => i.type === 'ball');
    if (bub) opt.push([100 - n.fun + 10, { type: 'bubble', item: bub, x: bub.x, lvl: tzLevelOf(bub.y + 30), t: 8 }]);
    if (ps[2] && (c.skill > 0.3 || n.fun < 50) && Math.random() < 0.6) opt.push([100 - n.fun + c.skill * 30, { type: 'puzzle', x: TZ_OBJ.puzzle, lvl: 2, t: 20 }]);
    if (ball) opt.push([100 - n.fun, { type: 'ball', item: ball, x: ball.x, lvl: tzLevelOf(ball.y), t: 15 }]);
    else if (ps[1]) opt.push([100 - n.fun - 5, { type: 'music', x: TZ_OBJ.music, lvl: 1, t: 15 }]);
  }
  if (c.skill > 0.4 && n.food < 75 && ps[2]) opt.push([100 - n.food + 5, { type: 'puzzle', x: TZ_OBJ.puzzle, lvl: 2, t: 20 }]);
  if (opt.length) { opt.sort((a, b) => b[0] - a[0]); return opt[0][1]; }
  const cand = TZ.lv.map((L, i) => i).filter(i => TZ.reach[i]);
  const lv = Math.random() < 0.55 ? 0 : cand[(Math.random() * cand.length) | 0], L = TZ.lv[lv];
  return { type: 'wander', x: lv === 0 ? tzRnd(40, 760) : tzRnd(L.x0 + 15, L.x1 - 15), lvl: lv, t: tzRnd(3, 8) };
}
function tzAI(c, dt, k) {
  const n = c.needs;
  c.arrived = false;
  if (c.sleeping) {
    c.moving = false;
    if (n.rest >= 95 || n.food < 12 || n.water < 12) c.sleeping = false;
    return;
  }
  if (c.danceUntil > Date.now() && c.ground && c.hopT <= 0) { c.vy = -3.2; c.ground = false; c.hopT = 0.35; }
  c.goalT -= dt;
  const g0 = c.goal;
  if (!g0 || c.goalT <= 0 || (g0.item && !TZ.items.includes(g0.item))) { c.goal = tzChoose(c); c.goalT = c.goal.t || 5; c.act = 0; }
  const g = c.goal;
  if (g.item) { g.x = g.item.x; g.lvl = tzLevelOf(g.item.y + (g.type === 'bubble' ? 30 : 0)); }
  const arrived = tzGo(c, g.x, g.lvl, k);
  c.arrived = arrived || g.type === 'wander' && false;
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
    case 'music': if (TZ.room.music > 0) n.fun += 4 * dt; else TZ.room.music = 20; break;
    case 'social': n.social = Math.min(100, n.social + 0.8 * dt); break;
    case 'plush': n.social = Math.min(100, n.social + 2 * dt); n.fun = Math.min(100, n.fun + 0.6 * dt); if (Math.random() < dt * 0.5) tzBurst('heart', c.x, c.y - c.half * 2, 1); break;
    case 'call': if (c.goalT > 1.5) { n.fun = Math.min(100, n.fun + 2); c.obey = Math.min(1, c.obey + 0.04); c.heartUntil = Date.now() + 1200; c.goalT = 1.4; } break;
    case 'treat': { const i = TZ.items.indexOf(g.item); if (i >= 0) { TZ.items.splice(i, 1); n.food = Math.min(100, n.food + 30); n.fun = Math.min(100, n.fun + 6); c.heartUntil = Date.now() + 1500; tzBurst('star', c.x, c.y - c.half, 4); } c.goalT = 0; break; }
    case 'bubble': if (Math.hypot(g.item.x - c.x, g.item.y - (c.y - c.half)) < c.half + 16) tzPop(g.item, c); break;
    case 'ball': {
      const b = g.item;
      if (Math.abs(b.x - c.x) < c.halfW + 8 && b.ground && c.kick <= 0) { b.vx = c.face * tzRnd(1.8, 3.2); b.vy = -tzRnd(2.5, 4.2); b.ground = false; n.fun = Math.min(100, n.fun + 9); c.kick = 0.6; tzBurst('star', b.x, b.y, 3); }
      break;
    }
    case 'puzzle': {
      c.act += dt;
      if (c.act >= 1.4) {
        c.act = 0;
        if (Math.random() < 0.08 + 0.85 * c.skill) {
          TZ.items.push({ type: 'treat', x: TZ_OBJ.puzzle + c.face * 14, y: TZ.lv[2].y - 24, vx: c.face * 0.8, vy: -1.5, ground: false });
          c.skill = Math.min(1, c.skill + 0.12 * (c.learn / 0.06));
          n.fun = Math.min(100, n.fun + 10); c.heartUntil = Date.now() + 1500; tzBurst('star', TZ_OBJ.puzzle, TZ.lv[2].y - 28, 8); c.goalT = 0;
        } else { c.skill = Math.min(1, c.skill + 0.02 * (c.learn / 0.06)); n.fun = Math.min(100, n.fun + 1); }
      }
      break;
    }
  }
  c.kick -= dt;
}
function tzPop(i, c) {
  const x = TZ.items.indexOf(i);
  if (x >= 0) TZ.items.splice(x, 1);
  tzBurst('star', i.x, i.y, 6);
  if (c) { c.needs.fun = Math.min(100, c.needs.fun + 7); c.laughUntil = Date.now() + 700; }
}
/* walk, jump or fly towards x on level lvl; true when there */
function tzGo(c, tx, lvl, k) {
  const sp = (0.45 + c.rec[18] * 0.25) * (0.7 + 0.3 * tzGrowth(c)) * (1 + c.obey * 0.15) * k, Ls = TZ.lv;
  if (lvl >= Ls.length || !TZ.reach[lvl]) lvl = 0;
  if (c.fly) {
    const ty = Ls[lvl].y - 20 - c.half - Math.sin(TZ.clock * 1.5 + c.id) * 8;
    c.vx = tzClamp(tx - c.x, -sp * 1.3, sp * 1.3); c.x += c.vx; c.y += tzClamp(ty - c.y, -sp, sp);
    c.vy = 0; c.ground = true;
    if (c.vx) c.face = c.vx > 0 ? 1 : -1;
    return Math.abs(tx - c.x) < 10;
  }
  let wx = tzSpot(tx, lvl);
  if (c.lvl >= Ls.length) { c.lvl = 0; c.ground = false; }
  if (c.lvl !== lvl) {
    const nx = tzPlan(c.lvl, lvl);
    if (nx >= 0) {
      const A = Ls[c.lvl], B = Ls[nx];
      if (B.y < A.y) {
        const lo = Math.max(A.x0, B.x0 - 10) + 6, hi = Math.min(A.x1, B.x1 + 10) - 6;
        wx = tzClamp(c.x, lo, hi);
        if (c.ground && Math.abs(c.x - wx) < 4 && c.hopT <= 0) { c.vy = -5.8; c.ground = false; c.hopT = 0.4; }
      } else wx = c.x - A.x0 < A.x1 - c.x ? A.x0 - 10 : A.x1 + 10;
      c.wx = wx;
    } else return false;
  }
  if (!c.ground && c.lvl !== lvl && c.wx !== undefined) wx = c.wx;
  const d = wx - c.x;
  if (Math.abs(d) > 3) { c.vx = tzClamp(d, -sp, sp); c.face = d > 0 ? 1 : -1; } else c.vx = 0;
  c.x = tzClamp(c.x + c.vx, 20, 780);
  return c.lvl === lvl && c.ground && Math.abs(tx - c.x) < 10;
}
function tzPhys(c, k) {
  c.hopT -= k / 60;
  if (c.held || c.fly) return;
  const Ls = TZ.lv, L = Ls[c.lvl] || Ls[0];
  if (c.ground && (c.x < L.x0 - 2 || c.x > L.x1 + 2)) c.ground = false;
  if (c.ground) { c.vy = 0; c.y = L.y; return; }
  const py = c.y;
  c.vy += 0.25 * k;
  c.y += c.vy * k;
  if (c.vy >= 0) {
    let best = -1;
    for (let i = 0; i < Ls.length; i++) {
      const q = Ls[i];
      if (py <= q.y + 0.5 && c.y >= q.y && c.x >= q.x0 - 2 && c.x <= q.x1 + 2 && (best < 0 || q.y < Ls[best].y)) best = i;
    }
    if (best >= 0) { c.y = Ls[best].y; c.vy = 0; c.ground = true; c.lvl = best; }
  }
}
function tzItems(k, dt) {
  const Ls = TZ.lv;
  for (const i of TZ.items) {
    i.age = (i.age || 0) + dt;
    if (i.type === 'sbub') {
      i.x += (i.vx + Math.sin(i.age * 2 + i.y) * 0.25) * k; i.y += i.vy * k; i.vy = Math.min(0.35, i.vy + 0.004 * k);
      const L = Ls[tzLevelOf(i.y + 20)];
      if (i.y >= L.y - 4 || i.age > 16) { i.dead = true; tzBurst('star', i.x, i.y, 4); }
      continue;
    }
    if (i.ground && (i.type === 'treat' || i.type === 'plush')) {
      const L = Ls[tzLevelOf(i.y + 6)];
      if (i.x < L.x0 - 2 || i.x > L.x1 + 2) i.ground = false; else continue;
    }
    i.vy += 0.25 * k;
    i.x += i.vx * k; i.y += i.vy * k;
    i.vx *= i.ground ? 0.9 : 0.999;
    if (i.x < 8) { i.x = 8; i.vx = Math.abs(i.vx) * 0.6; }
    if (i.x > 792) { i.x = 792; i.vx = -Math.abs(i.vx) * 0.6; }
    i.ground = false;
    const rad = i.type === 'plush' ? 8 : 5;
    let best = -1;
    for (let q = 0; q < Ls.length; q++) {
      const L = Ls[q];
      if (i.vy >= 0 && i.y >= L.y - rad && i.y - i.vy * k <= L.y - rad + 0.5 && i.x >= L.x0 && i.x <= L.x1 && (best < 0 || L.y < Ls[best].y)) best = q;
    }
    if (best >= 0) {
      i.y = Ls[best].y - rad;
      if (i.type === 'ball' && Math.abs(i.vy) > 1.2) i.vy = -i.vy * 0.62; else { i.vy = 0; i.ground = true; }
    }
    if (i.type === 'ball' && i.ground && Math.abs(i.vx) < 0.05) i.vx = 0;
  }
  TZ.items = TZ.items.filter(i => !i.dead && !(i.type === 'treat' && (i.age || 0) > 90));
}

/* ---------- room drawing ---------- */
function tzRoom(now) {
  const B = b, night = TZ.night, sun = tzClamp((TZ.hour - 6) / 14, 0, 1);
  B.imageSmoothingEnabled = false;
  for (let x = 0; x < BW; x += 20) { B.fillStyle = (x / 20) % 2 ? '#f6e9f0' : '#f1e1ea'; B.fillRect(x, 0, 20, TZ_FLOOR); }
  B.fillStyle = '#e7d4df'; B.fillRect(0, 300, BW, 22);
  B.fillStyle = '#fff6ea'; B.fillRect(0, 320, BW, 10);
  B.fillStyle = '#e9cba2'; B.fillRect(0, TZ_FLOOR, BW, BH - TZ_FLOOR);
  B.fillStyle = '#dcb98a';
  for (let x = 0; x < BW; x += 50) B.fillRect(x + ((x / 50) % 2 ? 20 : 0), TZ_FLOOR + 6, 2, BH);
  for (let y = TZ_FLOOR + 22; y < BH; y += 22) B.fillRect(0, y, BW, 1);
  B.fillStyle = '#f3dcb8'; B.fillRect(0, TZ_FLOOR, BW, 2);
  const wx = 70, wy = 45, ww = 120, wh = 120;
  B.fillStyle = '#fff4e2'; B.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
  B.fillStyle = night > 0.5 ? '#26305e' : '#a9dcfb'; B.fillRect(wx, wy, ww, wh / 2);
  B.fillStyle = night > 0.5 ? '#3d4a86' : '#dff3ff'; B.fillRect(wx, wy + wh / 2, ww, wh / 2);
  if (night < 0.5) {
    const sx = wx + 10 + sun * (ww - 30), sy = wy + 80 - Math.sin(sun * Math.PI) * 60;
    B.fillStyle = '#ffe58a'; B.fillRect(sx - 6, sy - 6, 12, 12); B.fillStyle = '#fff6c0'; B.fillRect(sx - 4, sy - 4, 8, 8);
    const cl = wx + 12 + ((now / 400) % 70);
    B.fillStyle = '#ffffff'; B.fillRect(cl | 0, wy + 28, 22, 6); B.fillRect((cl + 6) | 0, wy + 24, 12, 6);
  } else {
    B.fillStyle = '#f4f1d0'; B.fillRect(wx + 80, wy + 22, 14, 14); B.fillStyle = '#26305e'; B.fillRect(wx + 85, wy + 22, 10, 10);
    B.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) B.fillRect(wx + ((i * 37 + 11) % 110), wy + ((i * 23 + 7) % 80), 1 + (i % 2), 1 + (i % 2));
  }
  B.fillStyle = '#fff4e2'; B.fillRect(wx + ww / 2 - 2, wy, 4, wh); B.fillRect(wx, wy + wh / 2 - 2, ww, 4);
  B.fillStyle = '#e9d3b4'; B.fillRect(wx - 10, wy + wh + 6, ww + 20, 6);
  if (night < 0.5) { B.fillStyle = 'rgba(255,244,200,.14)'; B.beginPath(); B.moveTo(wx, wy + wh); B.lineTo(wx + ww, wy + wh); B.lineTo(wx + ww + 120, TZ_FLOOR + 40); B.lineTo(wx + 80, TZ_FLOOR + 40); B.closePath(); B.fill(); }
  for (let i = 1; i < TZ.lv.length; i++) {
    const L = TZ.lv[i], ex = i >= TZ_BASE.length;
    B.fillStyle = ex ? '#bf9d78' : '#c99a6a'; B.fillRect(L.x0, L.y, L.x1 - L.x0, 7);
    B.fillStyle = ex ? '#dcc0a0' : '#e4bc8a'; B.fillRect(L.x0, L.y, L.x1 - L.x0, 2);
    B.fillStyle = '#b3855a'; B.fillRect(L.x0 + 10, L.y + 7, 5, 12); B.fillRect(L.x1 - 15, L.y + 7, 5, 12);
  }
  tzPlant(745, TZ_FLOOR, 1.2); tzPlant(610, TZ.lv[2].y, 0.7);
  B.fillStyle = '#ffb7cf'; B.fillRect(TZ_OBJ.bed - 34, TZ_FLOOR - 12, 68, 12); B.fillRect(TZ_OBJ.bed - 30, TZ_FLOOR - 16, 60, 4);
  B.fillStyle = '#ffd2e0'; B.fillRect(TZ_OBJ.bed - 28, TZ_FLOOR - 15, 40, 3);
  B.fillStyle = '#f08fb0'; B.fillRect(TZ_OBJ.bed - 34, TZ_FLOOR - 2, 68, 2);
  tzBowl(TZ_OBJ.food, TZ.room.food, '#9ccff2', '#c98f5a');
  tzBowl(TZ_OBJ.water, TZ.room.water, '#ffc9dc', '#7cc0f0');
  const my = TZ.lv[1].y;
  B.fillStyle = '#9b7ad8'; B.fillRect(TZ_OBJ.music - 14, my - 14, 28, 14); B.fillStyle = '#c4a8f2'; B.fillRect(TZ_OBJ.music - 14, my - 14, 28, 3);
  B.fillStyle = '#ffe58a'; B.fillRect(TZ_OBJ.music + 14, my - 10, 5, 2); B.fillRect(TZ_OBJ.music + 17, my - 10, 2, 6);
  if (TZ.room.music > 0) {
    B.fillStyle = '#9b7ad8';
    for (let i = 0; i < 3; i++) { const q = ((now / 30 + i * 33) % 100), nx = TZ_OBJ.music - 6 + i * 8 + Math.sin(q / 8) * 3, ny = my - 18 - q * 0.5; B.fillRect(nx | 0, ny | 0, 3, 3); B.fillRect((nx + 2) | 0, (ny - 5) | 0, 1, 5); }
  }
  /* puzzle box */
  const py = TZ.lv[2].y, px = TZ_OBJ.puzzle, blink = (now / 400 | 0) % 2;
  B.fillStyle = OUTLINE; B.fillRect(px - 15, py - 25, 30, 25);
  B.fillStyle = '#7ad0c0'; B.fillRect(px - 14, py - 24, 28, 23); B.fillStyle = '#a8e8dc'; B.fillRect(px - 14, py - 24, 28, 4);
  B.fillStyle = '#ff7a8a'; B.fillRect(px - 5, py - 18, 10, 8); B.fillStyle = '#ffb0ba'; B.fillRect(px - 4, py - 17, 4, 3);
  B.fillStyle = blink ? '#fff07a' : '#c8c070'; B.fillRect(px + 8, py - 22, 3, 3);
  B.fillStyle = '#4a9a8c'; B.fillRect(px - 6, py - 6, 12, 5);
  B.fillStyle = '#b9b3a6'; B.fillRect(TZ_OBJ.ceiling, 0, 1, 26);
  B.fillStyle = '#fff1c4'; B.fillRect(TZ_OBJ.ceiling - 12, 26, 24, 8); B.fillRect(TZ_OBJ.ceiling - 8, 22, 16, 4);
  if (TZ.room.light) { B.fillStyle = '#fff6a8'; B.fillRect(TZ_OBJ.ceiling - 6, 34, 12, 3); }
  B.fillStyle = '#b9b3a6'; B.fillRect(TZ_OBJ.lamp, 0, 1, 40);
  B.fillStyle = '#9aa6ba'; B.fillRect(TZ_OBJ.lamp - 14, 40, 28, 8); B.fillRect(TZ_OBJ.lamp - 9, 36, 18, 4);
  B.fillStyle = TZ.room.lamp ? '#ffb35a' : '#8a8f9a'; B.fillRect(TZ_OBJ.lamp - 6, 48, 12, 5);
  if (TZ.room.lamp) { B.fillStyle = 'rgba(255,190,110,.13)'; B.beginPath(); B.moveTo(TZ_OBJ.lamp - 8, 53); B.lineTo(TZ_OBJ.lamp + 8, 53); B.lineTo(TZ_OBJ.lamp + 80, TZ_FLOOR); B.lineTo(TZ_OBJ.lamp - 80, TZ_FLOOR); B.closePath(); B.fill(); }
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
function tzDisc(x, y, r, col) {
  b.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.5)); b.fillRect(Math.round(x) - w, Math.round(y) + dy, 2 * w + 1, 1); }
}
function tzGlyph(cx, cy, key, word) {
  const G = TZ_GLYPH[key];
  if (!G) return;
  const B = b;
  if (word) {
    B.font = '8px Silkscreen, monospace';
    const w = Math.ceil(B.measureText(word).width) + 6;
    B.fillStyle = OUTLINE; B.fillRect(cx - (w >> 1) - 1, cy - 6, w + 2, 13);
    B.fillStyle = '#fffaf0'; B.fillRect(cx - (w >> 1), cy - 5, w, 11);
    B.fillStyle = OUTLINE; B.fillRect(cx - 1, cy + 7, 3, 2); B.fillStyle = '#fffaf0'; B.fillRect(cx, cy + 6, 1, 2);
    B.fillStyle = G[1]; B.textAlign = 'center'; B.textBaseline = 'middle'; B.fillText(word, cx, cy + 1);
    B.textAlign = 'start'; B.textBaseline = 'alphabetic';
    return;
  }
  B.fillStyle = OUTLINE; B.fillRect(cx - 5, cy - 5, 11, 11);
  B.fillStyle = '#fffaf0'; B.fillRect(cx - 4, cy - 4, 9, 9);
  B.fillStyle = OUTLINE; B.fillRect(cx - 1, cy + 6, 3, 2); B.fillStyle = '#fffaf0'; B.fillRect(cx, cy + 5, 1, 2);
  B.fillStyle = G[1];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (G[0][j][i] === '1') B.fillRect(cx - 2 + i, cy - 2 + j, 1, 1);
}

/* ---------- creature in side view ---------- */
function tzEye(P, cu, cv, ew, eh, iris, open, look) {
  const ex = Math.round(cu - ew / 2), ey = Math.round(cv - eh / 2);
  if (!open) {
    b.fillStyle = '#3a2f58';
    if (look === 'laugh') { P(ex, ey + (eh >> 1), 1, 1); P(ex + 1, ey + (eh >> 1) - 1, Math.max(1, ew - 2), 1); P(ex + ew - 1, ey + (eh >> 1), 1, 1); }
    else P(ex, ey + (eh >> 1), ew, 1);
    return;
  }
  for (let j = 0; j < eh; j++) for (let i = 0; i < ew; i++) {
    const nx = (i + 0.5 - ew / 2) / (ew / 2), ny = (j + 0.5 - eh / 2) / (eh / 2), d = nx * nx + ny * ny;
    if (d > 1.15) continue;
    let col = iris;
    if (d > 0.62) col = '#2a2450';
    else if (j < eh * 0.36) col = '#1d1840';
    else if (j > eh * 0.68) col = '#58d0d8';
    b.fillStyle = col; P(ex + i, ey + j, 1, 1);
  }
  if (ew >= 3) { b.fillStyle = '#ffffff'; P(ex + 1, ey + 1, ew >= 5 ? 2 : 1, ew >= 5 ? 2 : 1); if (ew >= 4) { P(ex + ew - 2, ey + eh - 2, 1, 1); } }
}
function tzSideWhole(c, sel, now) {
  const sp = tzWholeGeom(c), s = c.ws, m = sp.m, f = c.face >= 0 ? 1 : -1, rec = c.rec, W = sp.w * s, H = sp.h * s;
  const walking = c.moving && !c.sleeping && !c.held && (c.ground || c.fly);
  const g0 = c.goal, eating = g0 && (g0.type === 'food' || g0.type === 'water' || g0.type === 'treat') && !c.moving;
  const happy = c.danceUntil > now || c.laughUntil > now || c.hopT > 0;
  const kind = c.sleeping ? 'sleep' : c.held ? 'run' : c.fly ? 'fly' : c.kick > 0 ? 'attack' : happy ? 'hop' : eating ? 'eat' : walking ? 'walk' : 'idle';
  const t = now / 16.7, z = crPose(kind, t, c.id, Math.min(1.5, Math.abs(c.vx || 0) + 0.3), H, W);
  z.hue = (Math.round(rec[5] / 12) * 12) % 360; z.acc = rec[82] | 0;
  if (c.laughUntil > now) z.closed = true;
  const cx = Math.round(c.x), gy = Math.round(c.y);
  const P = (u, v, w, h) => { w = w || 1; h = h || 1; b.fillRect(Math.round(f > 0 ? cx + u : cx - u - (w - 1)), Math.round(gy + v), w, h); };
  if (c.fly && !c.held) { b.fillStyle = 'rgba(70,50,80,.16)'; const sy = TZ.lv[tzLevelOf(c.y)].y, sw = W >> 2; b.fillRect(cx - sw, sy, sw * 2, 1); }
  const topY = crWholeBlit(b, sp, cx, gy, s, f, z);
  const lean = z.lean * 0.85 + z.dx, dyz = z.dy;
  const hr = Math.max(4, Math.round(H * 0.28)), hu = Math.round((m.hx - sp.w / 2) * s + lean), topv = Math.round(topY - gy), hv = Math.round(topv + hr * 0.93);
  const eu = Math.round(((m.ex0 === undefined ? m.hx : (m.ex0 + m.ex1) / 2) - sp.w / 2 + 0.5) * s + lean), ev = Math.round(((m.ex0 === undefined ? sp.h * 0.5 : (m.ey0 + m.ey1) / 2) - sp.h + 0.5) * s + dyz + (H * (1 - z.sy)) * 0);
  const ew = m.ex0 === undefined ? 2 * s : (m.ex1 - m.ex0 + 1) * s, eh = m.ex0 === undefined ? 2 * s : (m.ey1 - m.ey0 + 1) * s;
  const mood = tzMood(c) / 100, sad = (c.soc > 0.35 && c.needs.social < 25) || mood < 0.35, fear = c.stress > 60;
  if (!c.sleeping && !z.closed) {
    if (sad) { b.fillStyle = '#6aaaf0'; const tq = Math.round((now / 120) % 6); P(eu - (ew >> 1) + 1, ev + (eh >> 1) + tq, 1, 2); b.fillStyle = '#3a2f58'; P(eu - (ew >> 1), ev - (eh >> 1) - 2, ew + 1, 1); }
    if (fear) { b.fillStyle = '#9ad8ff'; const tq = Math.round((now / 90) % 5); P(eu - ew - 2, ev - eh + tq, 1, 2); }
  }
  if (((rec[87] | 0) === 1) && (((now / 16 + c.id * 7) % 48) < 4)) { b.fillStyle = '#fff6b0'; P(hu - hr, topv + hr, 1, 3); P(hu - hr - 1, topv + hr + 1, 3, 1); }
  const top = topv;
  switch (TZ_ACC[c.acc]) {
    case 'bow': { const u = Math.round(hu - hr * 0.55), v = top + 1; b.fillStyle = '#ff7aa8'; P(u - 3, v - 2, 3, 4); P(u + 1, v - 2, 3, 4); b.fillStyle = '#ffc0d6'; P(u - 2, v - 1, 1, 1); P(u + 2, v - 1, 1, 1); b.fillStyle = '#d04a80'; P(u, v - 1, 1, 2); break; }
    case 'hat': { const u = hu, v = top + 2; b.fillStyle = '#3b3560'; P(u - 5, v, 11, 2); P(u - 3, v - 6, 7, 6); b.fillStyle = '#d8506a'; P(u - 3, v - 2, 7, 2); break; }
    case 'glasses': { b.fillStyle = '#2a2236'; const x0 = eu - (ew >> 1) - 2, y0 = ev - (eh >> 1) - 2, gw = ew + 4, gh = eh + 4; P(x0, y0, gw, 1); P(x0, y0 + gh - 1, gw, 1); P(x0, y0, 1, gh); P(x0 + gw - 1, y0, 1, gh); P(x0 - 5, y0 + 1, 5, 1); break; }
    case 'scarf': { const u = Math.round(hu - hr * 0.7), v = Math.round(hv + hr * 0.7); b.fillStyle = '#e8506a'; P(u, v, 5, 3); b.fillStyle = '#ffb0c0'; P(u + 1, v + 1, 1, 1); P(u + 3, v + 1, 1, 1); b.fillStyle = '#e8506a'; P(u - 1, v + 3, 3, 5); break; }
    case 'crown': { const u = hu, v = top + 2; b.fillStyle = '#ffd84a'; P(u - 4, v - 1, 9, 3); P(u - 4, v - 3, 1, 2); P(u, v - 4, 1, 3); P(u + 4, v - 3, 1, 2); b.fillStyle = '#e04a4a'; P(u, v, 1, 1); break; }
    case 'flower': { const u = Math.round(hu - hr * 0.35), v = top + 3; b.fillStyle = '#ffa0d0'; P(u - 1, v - 2, 3, 1); P(u - 1, v + 2, 3, 1); P(u - 2, v - 1, 1, 3); P(u + 2, v - 1, 1, 3); b.fillStyle = '#ffe070'; P(u - 1, v - 1, 3, 3); break; }
  }
  const tp = topY - 4;
  if (sel || c.hp < 60) {
    const w = Math.round(W * 0.6);
    b.fillStyle = OUTLINE; b.fillRect(cx - (w >> 1) - 1, tp - 3, w + 2, 2);
    b.fillStyle = c.hp > 50 ? '#6fd36f' : c.hp > 25 ? '#e5c14a' : '#e05a4a';
    b.fillRect(cx - (w >> 1), tp - 3, Math.max(1, Math.round(w * Math.max(0, c.hp) / 100)), 1);
  }
  if (sel) {
    const sw = (W >> 1) + 4, x0 = Math.round(cx - sw), x1 = Math.round(cx + sw), y0 = Math.round(tp - 1), y1 = Math.round(c.y + 2);
    b.fillStyle = '#ffd84a';
    b.fillRect(x0, y0, 3, 1); b.fillRect(x0, y0, 1, 3); b.fillRect(x1 - 2, y0, 3, 1); b.fillRect(x1, y0, 1, 3);
    b.fillRect(x0, y1, 3, 1); b.fillRect(x0, y1 - 2, 1, 3); b.fillRect(x1 - 2, y1, 3, 1); b.fillRect(x1, y1 - 2, 1, 3);
  }
}
function tzSide(c, sel, now) {
  if (crWholeOn()) return tzSideWhole(c, sel, now);
  const g = tzGrowth(c), baby = g < 0.5, rec = c.rec, f = c.face >= 0 ? 1 : -1;
  const walking = c.moving && !c.sleeping && c.ground && !c.held && !c.fly;
  const ph = walking ? 1 + (Math.floor(now / 110) % 4) : 0;
  const sp = crSprite(rec, { r: c.r, baby, ph, lie: c.sleeping }), A = sp.A;
  const cx = Math.round(c.x), gy = Math.round(c.y) - (walking && ph % 2 ? 1 : 0);
  const P = (u, v, w, h) => { w = w || 1; h = h || 1; b.fillRect(Math.round(f > 0 ? cx + u : cx - u - (w - 1)), Math.round(gy + v), w, h); };
  /* soft shadow on the ground */
  if (!c.held) {
    b.fillStyle = 'rgba(70,50,80,.16)';
    const sw = Math.round(sp.wHalf * (c.fly ? 0.6 : 0.95)), sy = c.fly ? (TZ.lv[tzLevelOf(c.y)].y) : Math.round(c.y);
    b.fillRect(cx - sw, sy, sw * 2, 1); b.fillRect(cx - sw + 2, sy + 1, sw * 2 - 4, 1);
  }
  if (f > 0) b.drawImage(sp.cnv, cx - sp.ox, gy - sp.gy);
  else { b.save(); b.translate(cx + 1, 0); b.scale(-1, 1); b.drawImage(sp.cnv, -sp.ox, gy - sp.gy); b.restore(); }
  /* face */
  const hr = A.hr, hu = A.hu, hv = A.hv, look = [82, 83, 84, 85, 86, 87, 88, 89].map(i => rec[i] | 0);
  const mood = tzMood(c) / 100, sad = (c.soc > 0.35 && c.needs.social < 25) || mood < 0.35, fear = c.stress > 60, laugh = c.laughUntil > now;
  const blink = ((now / 16 + c.id * 13) % 170) < 5, closed = c.sleeping || blink || laugh;
  if (hr >= 4) {
    const ew = A.ew, eh = A.eh, iris = fear ? '#c03a50' : A.iris;
    const F = A.face, eu = F ? F.eye[0] : hu + hr * 0.5, ev = F ? F.eye[1] : hv - hr * 0.02;
    if (F && !c.sleeping) {
      b.fillStyle = '#fffaf2';
      for (let j = -1; j <= eh; j++) for (let i = -1; i <= ew; i++) {
        const nx = (i + 0.5 - ew / 2) / (ew / 2 + 1), ny = (j + 0.5 - eh / 2) / (eh / 2 + 1);
        if (nx * nx + ny * ny <= 1.1) P(Math.round(eu - ew / 2) + i, Math.round(ev - eh / 2) + j, 1, 1);
      }
    }
    tzEye(P, eu, ev, ew, eh, iris, !closed, laugh ? 'laugh' : '');
    if (hr >= 99 && !c.sleeping) tzEye(P, hu + hr * 0.9, hv - hr * 0.1, Math.max(2, ew - 1), Math.max(3, eh - 1), iris, !closed, laugh ? 'laugh' : '');
    if (sad && !c.sleeping && !closed) { b.fillStyle = '#6aaaf0'; const tq = Math.round((now / 120) % 6); P(Math.round(eu - ew / 2 + 1), Math.round(ev + eh + tq), 1, 2); b.fillStyle = '#3a2f58'; P(Math.round(eu - 1), Math.round(ev - 2), ew + 1, 1); }
    /* nose and mouth */
    b.fillStyle = '#5a3a58'; P(Math.round(F ? F.nose[0] : hu + hr * 1.0), Math.round(F ? F.nose[1] : hv + hr * 0.2), 2, 2);
    const mu = Math.round(F ? F.mouth[0] : hu + hr * 0.62), mv = Math.round(F ? F.mouth[1] : hv + hr * 0.52);
    if (hr >= 5) {
      b.fillStyle = '#8a4660';
      if (laugh) { P(mu - 1, mv - 1, 4, 3); b.fillStyle = '#ff8fae'; P(mu, mv + 1, 2, 1); }
      else if (c.sleeping) P(mu, mv, 2, 1);
      else if (sad || fear) { P(mu - 1, mv + 1, 1, 1); P(mu, mv, 2, 1); P(mu + 2, mv + 1, 1, 1); }
      else if (mood > 0.5) { P(mu - 1, mv, 1, 1); P(mu, mv + 1, 2, 1); P(mu + 2, mv, 1, 1); }
      else P(mu - 1, mv, 4, 1);
      if (rec[6] > 0 && !sad && !laugh) { b.fillStyle = '#ffffff'; P(mu - 1, mv + 1, 1, 1); P(mu + 2, mv + 1, 1, 1); }
    }
    /* cheek blush */
    if (!c.sleeping) {
      const bu = Math.round(F ? F.cheek[0] : hu + hr * 0.08), bv = Math.round(F ? F.cheek[1] : hv + hr * 0.36);
      b.globalAlpha = 0.85; b.fillStyle = A.cheek;
      if (A.cheekKind === 1) { P(bu, bv, 1, 1); P(bu + 2, bv, 1, 1); P(bu, bv + 1, 3, 1); P(bu + 1, bv + 2, 1, 1); }
      else if (A.cheekKind === 2) { P(bu + 1, bv, 1, 3); P(bu, bv + 1, 3, 1); }
      else if (A.cheekKind === 3) { P(bu, bv, 1, 1); P(bu + 2, bv, 1, 1); P(bu + 1, bv + 1, 1, 1); P(bu, bv + 2, 1, 1); P(bu + 2, bv + 2, 1, 1); }
      else { P(bu, bv, 4, 2); P(bu + 1, bv - 1, 2, 1); }
      b.globalAlpha = 1;
    }
  }
  if (look[5] === 1 && (((now / 16 + c.id * 7) % 48) < 4)) { b.fillStyle = '#fff6b0'; const u = Math.round(A.hu - A.hr * 1.2), v = Math.round(A.bcv - A.b * 0.4); P(u, v - 1, 1, 3); P(u - 1, v, 3, 1); }
  /* accessories */
  const top = Math.round(hv - hr * 0.93);
  switch (TZ_ACC[c.acc]) {
    case 'bow': { const u = Math.round(hu - hr * 0.55), v = top + 1; b.fillStyle = '#ff7aa8'; P(u - 3, v - 2, 3, 4); P(u + 1, v - 2, 3, 4); b.fillStyle = '#ffc0d6'; P(u - 2, v - 1, 1, 1); P(u + 2, v - 1, 1, 1); b.fillStyle = '#d04a80'; P(u, v - 1, 1, 2); break; }
    case 'hat': { const u = Math.round(hu + hr * 0.05), v = top + 2; b.fillStyle = '#3b3560'; P(u - 5, v, 11, 2); P(u - 3, v - 6, 7, 6); b.fillStyle = '#d8506a'; P(u - 3, v - 2, 7, 2); break; }
    case 'glasses': { b.fillStyle = '#2a2236'; for (const [eu, ew2, eh2] of [[hu + hr * 0.4, A.ew, A.eh], [hu + hr * 0.93, Math.max(2, A.ew - 1), Math.max(3, A.eh - 1)]]) { const x0 = Math.round(eu - ew2 / 2) - 1, y0 = Math.round(hv - hr * 0.02 - eh2 / 2) - 1; P(x0, y0, ew2 + 2, 1); P(x0, y0 + eh2 + 1, ew2 + 2, 1); P(x0, y0, 1, eh2 + 2); P(x0 + ew2 + 1, y0, 1, eh2 + 2); } P(Math.round(hu + hr * 0.62), Math.round(hv - hr * 0.1), 3, 1); break; }
    case 'scarf': { const u = Math.round(hu - hr * 0.7), v = Math.round(hv + hr * 0.45); b.fillStyle = '#e8506a'; P(u, v, 5, 3); b.fillStyle = '#ffb0c0'; P(u + 1, v + 1, 1, 1); P(u + 3, v + 1, 1, 1); b.fillStyle = '#e8506a'; P(u - 1, v + 3, 3, 5); break; }
    case 'crown': { const u = Math.round(hu + hr * 0.05), v = top + 2; b.fillStyle = '#ffd84a'; P(u - 4, v - 1, 9, 3); P(u - 4, v - 3, 1, 2); P(u, v - 4, 1, 3); P(u + 4, v - 3, 1, 2); b.fillStyle = '#e04a4a'; P(u, v, 1, 1); break; }
    case 'flower': { const u = Math.round(hu - hr * 0.35), v = top + 3; b.fillStyle = '#ffa0d0'; P(u - 1, v - 2, 3, 1); P(u - 1, v + 2, 3, 1); P(u - 2, v - 1, 1, 3); P(u + 2, v - 1, 1, 3); b.fillStyle = '#ffe070'; P(u - 1, v - 1, 3, 3); break; }
  }
  /* selection corners and health */
  const tp = gy + A.top - 4;
  if (sel || c.hp < 60) {
    const w = Math.round(sp.wHalf * 1.2);
    b.fillStyle = OUTLINE; b.fillRect(cx - (w >> 1) - 1, tp - 3, w + 2, 2);
    b.fillStyle = c.hp > 50 ? '#6fd36f' : c.hp > 25 ? '#e5c14a' : '#e05a4a';
    b.fillRect(cx - (w >> 1), tp - 3, Math.max(1, Math.round(w * Math.max(0, c.hp) / 100)), 1);
  }
  if (sel) {
    const s = sp.wHalf + 4, x0 = Math.round(cx - s), x1 = Math.round(cx + s), y0 = Math.round(tp - 1), y1 = Math.round(c.y + 2);
    b.fillStyle = '#ffd84a';
    b.fillRect(x0, y0, 3, 1); b.fillRect(x0, y0, 1, 3); b.fillRect(x1 - 2, y0, 3, 1); b.fillRect(x1, y0, 1, 3);
    b.fillRect(x0, y1, 3, 1); b.fillRect(x0, y1 - 2, 1, 3); b.fillRect(x1 - 2, y1, 3, 1); b.fillRect(x1, y1 - 2, 1, 3);
  }
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
    if (i.type === 'ball') { tzDisc(i.x, i.y, 6, OUTLINE); tzDisc(i.x, i.y, 5, '#ff9db8'); B.fillStyle = '#ffffff'; B.fillRect(Math.round(i.x) - 5, Math.round(i.y), 10, 2); tzDisc(i.x - 2, i.y - 3, 1, '#ffe0ea'); }
    else if (i.type === 'sbub') { tzDisc(i.x, i.y, 8, 'rgba(160,215,255,.55)'); tzDisc(i.x, i.y, 6, 'rgba(235,248,255,.5)'); B.fillStyle = 'rgba(255,255,255,.95)'; B.fillRect(Math.round(i.x) - 4, Math.round(i.y) - 4, 2, 2); }
    else if (i.type === 'plush') {
      tzDisc(i.x, i.y, 9, OUTLINE); tzDisc(i.x, i.y, 8, '#ffd0a8'); tzDisc(i.x - 6, i.y - 7, 3, '#ffd0a8'); tzDisc(i.x + 6, i.y - 7, 3, '#ffd0a8');
      B.fillStyle = '#2a2236'; B.fillRect(Math.round(i.x) - 4, Math.round(i.y) - 2, 2, 2); B.fillRect(Math.round(i.x) + 2, Math.round(i.y) - 2, 2, 2);
      B.fillStyle = '#ff8fae'; B.fillRect(Math.round(i.x) - 1, Math.round(i.y) + 1, 2, 2);
    } else { tzDisc(i.x, i.y, 5, OUTLINE); tzDisc(i.x, i.y, 4, '#e0a868'); B.fillStyle = '#8a5a30'; B.fillRect(Math.round(i.x) - 2, Math.round(i.y) - 1, 1, 1); B.fillRect(Math.round(i.x) + 1, Math.round(i.y), 1, 1); B.fillRect(Math.round(i.x) - 1, Math.round(i.y) + 2, 1, 1); }
  }
  const order = TZ.list.slice().sort((p, q) => p.y - q.y);
  for (const c of order) tzSide(c, c.id === TZ.sel, now);
  for (const c of order) {
    const top = Math.round(c.y - c.half * 2 - 8);
    let key = null, word = null;
    if (c.sleeping) key = (now / 700 | 0) % 2 ? 'rest' : null;
    else if (c.heartUntil > now) key = 'love';
    else if (c.bubble && c.bubbleUntil > TZ.clock) { key = c.bubble; word = c.vocab[c.bubble] || null; }
    if (key) tzGlyph(Math.round(c.x), top, key, word);
  }
  for (const p of TZ.parts) {
    if (p.type === 'conf') { B.fillStyle = p.col; B.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    else if (p.type === 'heart') { B.fillStyle = p.col; const x = Math.round(p.x), y = Math.round(p.y); B.fillRect(x - 2, y, 2, 2); B.fillRect(x + 1, y, 2, 2); B.fillRect(x - 2, y + 1, 5, 2); B.fillRect(x - 1, y + 3, 3, 1); }
    else { B.fillStyle = p.col; const x = Math.round(p.x), y = Math.round(p.y); B.fillRect(x, y - 1, 1, 3); B.fillRect(x - 1, y, 3, 1); }
  }
  TZ.graves.slice(-4).forEach((q, i) => { const gx = 770 - i * 22; B.fillStyle = OUTLINE; B.fillRect(gx - 7, TZ_FLOOR - 17, 14, 17); B.fillStyle = '#cfc8d6'; B.fillRect(gx - 6, TZ_FLOOR - 16, 12, 16); B.fillStyle = '#9a93a3'; B.fillRect(gx - 1, TZ_FLOOR - 13, 2, 8); B.fillRect(gx - 3, TZ_FLOOR - 10, 6, 2); });
  if (TZ.night > 0.05) { B.fillStyle = `rgba(20,24,70,${(TZ.room.light ? 0.12 : 0.36) * TZ.night})`; B.fillRect(0, 0, BW, BH); }
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
function tzXY(e) {
  const r = tzEl('terra').getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * BW, (e.clientY - r.top) / r.height * BH];
}
function tzHit(x, y) {
  let hit = null, hd = 1e9;
  for (const c of TZ.list) {
    const d = Math.hypot(x - c.x, y - (c.y - c.half));
    if (d < c.half + c.halfW * 0.4 + 6 && d < hd) { hd = d; hit = c; }
  }
  return hit;
}
function tzDown(e) {
  const [x, y] = tzXY(e), hit = tzHit(x, y), now = Date.now();
  if (hit) {
    TZ.sel = hit.id;
    const n = hit.needs;
    switch (TZ.tool) {
      case 'select': TZ.drag = { id: hit.id, dy: y - (hit.y - hit.half), dx: x - hit.x, from: hit.y, moved: false }; tzEl('terra').setPointerCapture(e.pointerId); break;
      case 'pet': hit.stress = Math.max(0, hit.stress - 10); n.fun = Math.min(100, n.fun + 7); n.social = Math.min(100, n.social + 8); hit.love = Math.min(100, hit.love + 3); hit.heartUntil = now + 1800; hit.sleeping = false; tzBurst('heart', hit.x, hit.y - hit.half * 2, 2); break;
      case 'brush': hit.stress = Math.max(0, hit.stress - 18); n.social = Math.min(100, n.social + 12); n.rest = Math.min(100, n.rest + 4); hit.heartUntil = now + 2200; tzBurst('star', hit.x, hit.y - hit.half, 8); break;
      case 'tickle': { hit.sleeping = false; hit.laughUntil = now + 900; hit.tick = (hit.tick || 0) + 1; if (now - (hit.tickAt || 0) > 4000) hit.tick = 1; hit.tickAt = now; n.fun = Math.min(100, n.fun + 14); if (hit.tick > 5) hit.stress = Math.min(100, hit.stress + 4); if (hit.ground) { hit.vy = -3.4; hit.ground = false; hit.hopT = 0.35; } tzBurst('star', hit.x, hit.y - hit.half, 4); break; }
      case 'dress': hit.acc = (hit.acc + 1) % TZ_ACC.length; hit.heartUntil = now + 900; tzBurst('star', hit.x, hit.y - hit.half * 1.6, 6); break;
      case 'teach': tzTeach(hit); break;
      default: break;
    }
    tzPanel(true);
    return;
  }
  const near = (ox, oy, w, h) => x >= ox - w && x <= ox + w && y >= oy - h && y <= oy + h;
  const bub = TZ.items.find(i => i.type === 'sbub' && Math.hypot(i.x - x, i.y - y) < 12);
  if (bub) { tzPop(bub, null); return; }
  if (near(TZ_OBJ.food, TZ_FLOOR - 8, 22, 14)) { TZ.room.food = Math.min(100, TZ.room.food + 40); toast(t('tz.filled')); return; }
  if (near(TZ_OBJ.water, TZ_FLOOR - 8, 22, 14)) { TZ.room.water = Math.min(100, TZ.room.water + 40); toast(t('tz.filled')); return; }
  if (near(TZ_OBJ.lamp, 44, 22, 14)) { TZ.room.lamp = !TZ.room.lamp; return; }
  if (near(TZ_OBJ.ceiling, 30, 18, 10)) { TZ.room.light = !TZ.room.light; return; }
  if (near(TZ_OBJ.music, TZ.lv[1].y - 8, 20, 12)) { TZ.room.music = 25; return; }
  if (near(TZ_OBJ.puzzle, TZ.lv[2].y - 12, 18, 14)) { tzBurst('star', TZ_OBJ.puzzle, TZ.lv[2].y - 26, 5); toast(t('tz.puzzleHint')); return; }
  switch (TZ.tool) {
    case 'treat': if (TZ.items.filter(i => i.type === 'treat').length < 6) TZ.items.push({ type: 'treat', x: tzClamp(x, 10, 790), y: Math.min(y, 200), vx: 0, vy: 0, ground: false }); break;
    case 'ball': if (TZ.items.filter(i => i.type === 'ball').length >= 2) TZ.items.splice(TZ.items.findIndex(i => i.type === 'ball'), 1); TZ.items.push({ type: 'ball', x: tzClamp(x, 10, 790), y: Math.min(y, 200), vx: tzRnd(-1, 1), vy: 0, ground: false }); break;
    case 'bubbles': for (let i = 0; i < 5; i++) if (TZ.items.filter(q => q.type === 'sbub').length < 14) TZ.items.push({ type: 'sbub', x: tzClamp(x + tzRnd(-18, 18), 10, 790), y: tzClamp(y + tzRnd(-14, 14), 10, 300), vx: tzRnd(-0.3, 0.3), vy: tzRnd(-0.4, 0.05) }); break;
    case 'plush': if (TZ.items.filter(i => i.type === 'plush').length >= 2) TZ.items.splice(TZ.items.findIndex(i => i.type === 'plush'), 1); TZ.items.push({ type: 'plush', x: tzClamp(x, 14, 786), y: Math.min(y, 220), vx: 0, vy: 0, ground: false }); break;
    case 'call': TZ.callT = 8; TZ.callX = tzClamp(x, 20, 780); TZ.callLvl = tzLevelOf(y); tzBurst('star', x, y, 6); for (const c of TZ.list) { c.sleeping = false; c.goalT = 0; } break;
    case 'party': if (TZ.partyCool <= 0) { TZ.partyCool = 6; tzBurst('conf', x, Math.min(y, 120), 60); for (const c of TZ.list) { c.danceUntil = now + 4000; c.needs.fun = Math.min(100, c.needs.fun + 12); c.needs.social = Math.min(100, c.needs.social + 6); c.sleeping = false; } } break;
    case 'level': tzToggleLevel(x, y); break;
    default: TZ.sel = 0; break;
  }
  tzPanel(true);
}
function tzMove(e) {
  const d = TZ.drag;
  if (!d) return;
  const c = tzFind(d.id);
  if (!c) { TZ.drag = null; return; }
  const [x, y] = tzXY(e);
  d.moved = true; c.held = true; c.sleeping = false; c.ground = false; c.vy = 0;
  c.x = tzClamp(x - d.dx, 20, 780);
  c.y = tzClamp(y - d.dy + c.half, c.half + 10, TZ_FLOOR);
  c.goal = null;
}
function tzUp() {
  const d = TZ.drag;
  TZ.drag = null;
  if (!d) return;
  const c = tzFind(d.id);
  if (!c || !d.moved) return;
  c.held = false; c.ground = false; c.vy = 0; c.lvl = 0; c.pt = 0; c.px = c.x; c.py = c.y;
  const fall = TZ_FLOOR - c.y;
  if (fall > 150) { c.stress = Math.min(100, c.stress + 5); c.laughUntil = 0; }
  else { c.laughUntil = Date.now() + 700; c.needs.fun = Math.min(100, c.needs.fun + 4); }
}
async function tzTeach(c) {
  const inp = tzEl('tzWord'), w = (inp.value || '').toLowerCase().replace(/[^a-zäöü]/g, '').slice(0, 12);
  if (!w) { toast(t('app.wordFirst')); inp.focus(); return; }
  const mv = tzEl('tzMean').value, need = mv && TZ_FEAT[mv] !== undefined ? mv : TZ_GOALNEED[c.goal && c.goal.type] || 'fun', feat = TZ_FEAT[need] === undefined ? 9 : TZ_FEAT[need];
  const r = await tzCall({ type: 'tteach', id: c.id, word: w, feat });
  if (r.ok) { c.vocab[need] = w; c.words = r.words || c.words; c.heartUntil = Date.now() + 1500; toast(t('tz.taught', c.name, w, tr('tz.needs')[need])); tzSave(); } else toast(t('tz.noTeach'));
}
function tzSetTool(name) {
  TZ.tool = name;
  for (const bt of document.querySelectorAll('#ttools button[data-ttool]')) bt.classList.toggle('on', bt.dataset.ttool === name);
  const h = tzEl('help');
  if (h && typeof viewMode !== 'undefined' && viewMode === 'terra') h.textContent = t('tz.help') + ' | ' + t('tz.tip.' + name);
  tzEl('terra').style.cursor = name === 'select' ? 'grab' : 'pointer';
}
function tzFillMean() {
  const sel = tzEl('tzMean'), L = tr('tz.needs'), v = sel.value;
  sel.innerHTML = '';
  const o0 = document.createElement('option'); o0.value = ''; o0.textContent = t('tz.meanAuto'); sel.appendChild(o0);
  for (const k of Object.keys(L)) { const o = document.createElement('option'); o.value = k; o.textContent = L[k]; sel.appendChild(o); }
  sel.value = v;
}
function tzInit() {
  const cv2 = tzEl('terra');
  tzFillMean();
  const lg = document.getElementById('langSel'); if (lg) lg.addEventListener('change', () => setTimeout(tzFillMean, 0));
  cv2.addEventListener('pointerdown', tzDown);
  cv2.addEventListener('pointermove', tzMove);
  cv2.addEventListener('pointerup', tzUp);
  cv2.addEventListener('pointercancel', tzUp);
  for (const bt of document.querySelectorAll('#ttools button[data-ttool]')) bt.onclick = () => tzSetTool(bt.dataset.ttool);
  tzEl('tzRename').onclick = () => {
    const v = tzEl('tzName').value, c = tzFind(TZ.sel);
    if (c && v.trim()) { tzCall({ type: 'trename', id: c.id, name: v }).then(() => tzReconcileNames()); tzEl('tzName').value = ''; }
  };
  tzEl('tzRelease').onclick = () => { if (TZ.sel) tzRelease(TZ.sel); };
  window.addEventListener('beforeunload', () => { tzSave(); });
  tzBuildLevels();
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
  const alone = TZ.list.length === 1 ? `<div class="muted" style="margin-bottom:6px">${esc(t('tz.alone'))}</div>` : '';
  setHtml(tzEl('tzList'), TZ.list.length ? alone + TZ.list.map(card).join('') : `<div class="muted">${esc(t('tz.none'))}</div>`);
  const eg = TZ.eggs.length ? `<div class="muted">${esc(t('tz.eggs', TZ.eggs.length, Math.max(0, Math.ceil(Math.min(...TZ.eggs.map(e => e.left))))))}</div>` : '';
  setHtml(tzEl('tzEggs'), eg);
  tzEl('tzSelHead').style.display = sel ? 'block' : 'none';
  if (sel) {
    const g = tzGrowth(sel), voc = Object.entries(sel.vocab).map(([k, w]) => `${esc(w)} (${esc(L[k])})`).join(', ');
    tzEl('tzSelName').textContent = sel.name;
    setHtml(tzEl('tzInfo'), '<table>' +
      row(t('tz.growth'), pct(g)) + row(t('tz.mood'), pct(tzMood(sel) / 100)) + row(t('tz.stress'), pct(sel.stress / 100)) + row(t('tz.love'), pct(sel.love / 100)) +
      row(t('tz.skill'), pct(sel.skill)) + row(t('tz.obey'), pct(sel.obey)) + row(t('tz.acc'), esc(t('tz.accs.' + TZ_ACC[sel.acc]))) +
      row(t('tz.gen'), sel.gen) + row(t('tz.kids'), sel.kids) + row(t('tz.words'), sel.words) + row(t('tz.vocab'), voc || '-') + '</table>');
  }
  const gr = TZ.graves.slice().reverse().map(q => `<tr><td class="l">${esc(q.name)} <span class="muted">${esc(t('tz.gen'))} ${q.gen}</span></td><td>${esc(tr('causes')[q.cause] || q.cause)}</td></tr>`).join('');
  setHtml(tzEl('tzGraves'), gr ? `<table>${gr}</table>` : `<div class="muted">-</div>`);
  const rm = TZ.room, yes = `<span class="yes">${esc(t('sel.yes'))}</span>`, no = `<span class="no">${esc(t('sel.no'))}</span>`;
  setHtml(tzEl('tzRoom'), '<table>' + row(t('tz.bowlFood'), barHtml(rm.food / 100, '#c98f5a')) + row(t('tz.bowlWater'), barHtml(rm.water / 100, '#7cc0f0')) +
    row(t('tz.lamp'), rm.lamp ? yes : no) + row(t('tz.light'), rm.light ? yes : no) + row(t('tz.levels'), TZ.lv.length - 1) + '</table>');
}
