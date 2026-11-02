'use strict';
/* Terrarium rooms: garden, pond, cave, workshop. Loaded after terrarium.js.
   Only the viewed room is simulated in detail; pets in other rooms are handled by tzAway(). */
const TZ_FL = { x0: -1e9, x1: 1e9, y: 330 };
const TZ_ROOMS = [
  { key: 'home', lv: null, prov: { food: 0, water: 0, warmth: 0, rest: 1.0, fun: 0.5 } },
  { key: 'garden', lv: [TZ_FL, { x0: 560, x1: 740, y: 270 }], prov: { food: 8, water: 20, warmth: 1.2, rest: 1.0, fun: 2 } },
  { key: 'pond', lv: [TZ_FL, { x0: 560, x1: 760, y: 290 }], prov: { food: 8, water: 22, warmth: 1.2, rest: 1.0, fun: 3 } },
  { key: 'cave', lv: [TZ_FL, { x0: 300, x1: 480, y: 270 }], prov: { food: 8, water: 20, warmth: 1.8, rest: 1.2, fun: 2 } },
  { key: 'shop', lv: [TZ_FL, { x0: 520, x1: 700, y: 280 }], prov: { food: 12, water: 22, warmth: 1.4, rest: 1.0, fun: 3 } },
  { key: 'gallery', lv: [TZ_FL], prov: { food: 0, water: 0, warmth: 1, rest: 1, fun: 1 } }
];
TZ.cur = 0;
TZ.bf = [{ x: 300, y: 250 }, { x: 500, y: 240 }, { x: 650, y: 255 }];
TZ.garden = [{ x: 150, g: 0.7 }, { x: 290, g: 0.35 }, { x: 430, g: 0.95 }, { x: 570, g: 0.15 }];
const TZ_GROW_S = 240;

function tzLightOn(c) {
  const r = c.room;
  if (r === 0) return TZ.night < 0.5 || TZ.room.light;
  if (r >= 3) return true;
  return TZ.night < 0.5;
}
function tzRestoreRooms(P) {
  tzLabRestore(P);
  if (Array.isArray(P.album)) TZ.album = P.album.slice(-80).map(a => ({ ...a, img: null, redo: false }));
  if (Array.isArray(P.garden) && P.garden.length === 4) TZ.garden = P.garden.map((q, i) => ({ x: [150, 290, 430, 570][i], g: tzClamp(+q.g || 0, 0, 1) }));
}
function tzRoomsStep(dt) {
  for (const p of TZ.garden) p.g = Math.min(1, p.g + dt / TZ_GROW_S);
  if (TZ.cur === 1) TZ.bf.forEach((q, i) => { const t = TZ.clock * 0.5 + i * 2.1; q.x = 400 + Math.sin(t) * 300 + Math.sin(t * 2.3) * 40; q.y = 240 + Math.sin(t * 1.7 + i) * 45; });
}
function tzGardenCatchUp(sec) { for (const p of TZ.garden) p.g = Math.min(1, p.g + sec / TZ_GROW_S); }


/* ---------- decor props (Pixellab sprites, drawn behind the pets) ---------- */
/* [sprite, x, scale, bottom y (optional), glow colour (optional)] */
const TZ_PROPS = {
  0: [['p_home0', 62, 1.2], ['p_home2', 400, 2.2, TZ_FLOOR + 12, null, 0.28], ['p_home3', 590, 1.15], ['p_home6', 470, 1.0]],
  1: [['p_garden1', 70, 1.5], ['p_garden2', 215, 1.2], ['p_garden5', 360, 1.3], ['p_garden4', 480, 1.1], ['p_garden9', 330, 0.9], ['p_garden10', 150, 1.0], ['p_garden7', 790, 1.1]],
  2: [['p_garden1', 85, 1.4], ['p_pond5', 168, 1.3], ['p_pond3', 60, 1.1], ['p_pond4', 540, 1.2], ['p_pond7', 700, 1.0, 290], ['p_pond6', 130, 1.2]],
  3: [['p_cave0', 60, 1.4, null, '120,200,255'], ['p_cave1', 265, 1.2, null, '200,120,255'], ['p_cave2', 335, 1.0, null, '120,255,240'], ['p_cave4', 520, 1.4], ['p_cave6', 745, 1.1], ['p_cave7', 215, 1.3, 140, '255,170,70'], ['p_cave8', 575, 1.1, null, '255,150,230']],
  4: [['p_shop2', 62, 1.3], ['p_shop4', 240, 1.0], ['p_shop3', 340, 1.1], ['p_shop5', 430, 2.2, TZ_FLOOR + 12, null, 0.28], ['p_shop6', 470, 1.2, 150], ['p_shop7', 500, 1.1], ['p_shop9', 150, 0.9]]
};
function tzProps(r, now) {
  const L = TZ_PROPS[r]; if (!L || !crObjHas('p_home0')) return;
  const B = b, dark = TZ.night > 0.5 && (r === 1 || r === 2);
  if (dark) B.filter = 'brightness(.62)';
  const pulse = 0.6 + 0.4 * Math.sin(now / 700);
  for (const q of L) {
    const sz = crObjSize(q[0]); if (!sz) continue;
    const y = q[3] || TZ_FLOOR + 3;
    if (q[4]) {
      const g = B.createRadialGradient(q[1], y - sz.h * q[2] * 0.5, 2, q[1], y - sz.h * q[2] * 0.5, 38 + 14 * pulse);
      g.addColorStop(0, `rgba(${q[4]},${0.35 * pulse})`); g.addColorStop(1, `rgba(${q[4]},0)`);
      B.fillStyle = g; B.fillRect(q[1] - 60, y - sz.h * q[2] - 40, 120, sz.h * q[2] + 80);
    }
    if (q[5]) { B.save(); B.translate(q[1], y); B.scale(1, q[5]); B.translate(-q[1], -y); }
    crObjDraw(B, q[0], q[1], y, Math.round(sz.h * q[2]));
    if (q[5]) B.restore();
  }
  if (dark) B.filter = 'none';
}

/* ---------- navigation ---------- */
function tzNavHtml() {
  const names = tr('tz.rooms');
  return '<div class="row" style="flex-wrap:wrap">' + names.map((n, i) => {
    const cnt = TZ.list.filter(c => c.room === i).length;
    return `<button data-troom="${i}"${i === TZ.cur ? ' class="on"' : ''}>${esc(n)} (${cnt})</button>`;
  }).join('') + '</div>';
}
function tzPlaceArrive(c, dir) {
  c.x = dir > 0 ? 44 : 756; c.y = TZ_FLOOR; c.lvl = 0; c.ground = true; c.vy = 0; c.goal = null; c.goalT = 0; c.sleeping = false; c.swim = false; c.px = c.x; c.py = c.y;
}
function tzViewRoom(r) {
  if (r < 0 || r >= TZ_ROOMS.length || r === TZ.cur) return;
  TZ.cur = r; TZ.drag = null;
  tzBuildLevels();
  for (const c of TZ.list) {
    c.held = false;
    if (c.room === r) { c.x = tzClamp(c.x, 40, 760); c.y = TZ_FLOOR; c.lvl = 0; c.ground = true; c.vy = 0; c.goal = null; c.goalT = 0; c.swim = false; c.pt = 0; c.px = c.x; c.py = c.y; }
    tzGeom(c);
  }
  if (TZ.sel) { const s = tzFind(TZ.sel); if (s && s.room !== r) TZ.sel = 0; }
  tzSetTool(TZ.tool);
  tzPanel(true);
}
function tzDoors() {
  const r = TZ.cur, d = [];
  if (r > 0) d.push({ dir: -1, x: 18, to: r - 1 });
  if (r < TZ_ROOMS.length - 1) d.push({ dir: 1, x: 782, to: r + 1 });
  return d;
}

/* ---------- pet behaviour in the rooms ---------- */
function tzTripGoal(c) {
  const want = c.stay > 0 ? (c.dest || 0) : 0;
  if (want === c.room) return null;
  const dir = want > c.room ? 1 : -1;
  return { type: 'door', dir, x: dir > 0 ? 776 : 24, lvl: 0, t: 15 };
}
function tzChooseR(c) {
  const n = c.needs, R = c.room, night = TZ.night, day = night < 0.5, opt = [];
  if (TZ.callT > 0 && c.obey + 0.3 > Math.random()) return { type: 'call', x: TZ.callX, lvl: 0, t: 6 };
  if (Math.min(n.food, n.water, n.warmth) > 30) { const tg = tzTripGoal(c); if (tg) return tg; }
  const use = (need, x, rate, lvl, t) => ({ type: 'use', need, rate, x, lvl: lvl || 0, t: t || 12 });
  if (R === 1) {
    if (n.food < 55) { const p = TZ.garden.slice().sort((a, b) => b.g - a.g)[0]; opt.push([100 - n.food, { type: 'plant', plant: p, x: p.x, lvl: 0, t: 14 }]); }
    if (n.water < 55) opt.push([100 - n.water, use('water', 700, 26)]);
    if (n.warmth < 50 && day) opt.push([100 - n.warmth, use('warmth', 380, 1.8, 0, 25)]);
    if (n.rest < 30 || (night > 0.6 && n.rest < 70)) opt.push([100 - n.rest + night * 15, { type: 'sleep', x: 110, lvl: 0, t: 60 }]);
    if (n.fun < 65) { const bf = TZ.bf[(Math.random() * 3) | 0]; opt.push([100 - n.fun, { type: 'flutter', bf, x: bf.x, lvl: 0, t: 10 }]); }
  } else if (R === 2) {
    if (n.food < 55) opt.push([100 - n.food, use('food', 80, 14)]);
    if (n.water < 55) opt.push([100 - n.water, use('water', 215, 26)]);
    if (n.warmth < 50 && day) opt.push([100 - n.warmth, use('warmth', 650, 1.8, 1, 25)]);
    if (n.rest < 30 || (night > 0.6 && n.rest < 70)) opt.push([100 - n.rest + night * 15, { type: 'sleep', x: 160, lvl: 0, t: 60 }]);
    if (n.fun < 65) opt.push([100 - n.fun, { type: 'swim', x: tzRnd(270, 490), lvl: 0, t: 14 }]);
  } else if (R === 3) {
    if (n.food < 55) opt.push([100 - n.food, use('food', 150, 14)]);
    if (n.water < 55) opt.push([100 - n.water, use('water', 600, 26)]);
    if (n.warmth < 55) opt.push([100 - n.warmth, use('warmth', 400, 2.4, 0, 25)]);
    if (n.rest < 30 || (night > 0.6 && n.rest < 70)) opt.push([100 - n.rest + night * 15, { type: 'sleep', x: 720, lvl: 0, t: 60 }]);
    if (n.fun < 65) opt.push([100 - n.fun, { type: 'gaze', x: tzRnd(330, 450), lvl: 1, t: 14 }]);
  } else if (R === 4) {
    if (n.food < 55) opt.push([100 - n.food, use('food', 110, 20)]);
    if (n.water < 55) opt.push([100 - n.water, use('water', 190, 26)]);
    if (n.warmth < 55) opt.push([100 - n.warmth, use('warmth', 300, 1.8, 0, 25)]);
    if (n.rest < 30 || (night > 0.6 && n.rest < 70)) opt.push([100 - n.rest + night * 15, { type: 'sleep', x: 740, lvl: 0, t: 60 }]);
    if (n.fun < 75 && Math.random() < 0.6) { const lg = tzLabGoal(c); if (lg) opt.push([100 - n.fun + 12, lg]); }
    if (n.fun < 70) {
      if (c.skill < 0.95 && Math.random() < 0.6) opt.push([100 - n.fun + 8, { type: 'machine', x: 420, lvl: 0, t: 16 }]);
      else opt.push([100 - n.fun, { type: 'tramp', x: 600, lvl: 0, t: 12 }]);
    }
  }
    { const pls = TZ.list.filter(o => o !== c && o.room === c.room && !o.sleeping && !o.held); if (pls.length && n.fun < 70 && TZ.clock - (c.playAt || -999) > 120 && Math.random() < 0.15) { const o = pls[(Math.random() * pls.length) | 0]; c.playAt = o.playAt = TZ.clock; opt.push([100 - n.fun + 6, { type: 'play', with: o, x: o.x, lvl: o.lvl, t: 11 }]); } }
  if (n.social < 55) {
    const others = TZ.list.filter(o => o !== c && o.room === c.room);
    if (others.length) { const o = others.sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0]; opt.push([100 - n.social, { type: 'social', x: o.x + tzRnd(-20, 20), lvl: o.lvl, t: 8 }]); }
  }
  if (opt.length) { opt.sort((a, b) => b[0] - a[0]); return opt[0][1]; }
  if (Math.random() < 0.12 && Math.min(n.food, n.water, n.rest) > 50) { c.dest = Math.random() < 0.5 ? 0 : (Math.random() * 5) | 0; c.stay = c.dest ? tzRnd(40, 100) : 0; const tg = tzTripGoal(c); if (tg) return tg; }
  const cand = TZ.lv.map((L, i) => i).filter(i => TZ.reach[i]);
  const lv = Math.random() < 0.6 ? 0 : cand[(Math.random() * cand.length) | 0], L = TZ.lv[lv];
  return { type: 'wander', x: lv === 0 ? tzRnd(40, 760) : tzRnd(L.x0 + 15, L.x1 - 15), lvl: lv, t: tzRnd(3, 8) };
}
/* effect of a goal once the pet has arrived (called from tzAI for goal types it does not know) */
function tzUseR(c, g, dt) {
  const n = c.needs, mx = v => Math.min(100, v);
  switch (g.type) {
    case 'use': if (n[g.need] < 98) n[g.need] = mx(n[g.need] + g.rate * dt); else c.goalT = 0; break;
    case 'plant': {
      const p = g.plant;
      if (p.g >= 1) {
        n.food = mx(n.food + 24 * dt); c.act += dt;
        if (c.act > 2.2) { c.act = 0; p.g = 0.15; n.fun = mx(n.fun + 6); c.heartUntil = Date.now() + 1200; tzBurst('star', p.x, TZ_FLOOR - 20, 6); c.goalT = 0; }
      } else { p.g = Math.min(1, p.g + 0.03 * dt); n.fun = mx(n.fun + 1.2 * dt); if (Math.random() < dt * 0.4) tzBurst('star', p.x, TZ_FLOOR - 14, 1); }
      break;
    }
    case 'lab': tzLabAct(c, g, dt); break;
    case 'flutter': n.fun = mx(n.fun + 4 * dt); if (Math.random() < dt * 0.5) tzBurst('heart', c.x, c.y - c.half * 2, 1); break;
    case 'swim': c.swim = true; if (c.ground && c.hopT <= 0 && Math.random() < dt * 0.25) { c.vy = -4; c.ground = false; c.hopT = 0.4; tzBurst('drop', c.x, 318, 6); } if (Math.random() < dt * 1.2) tzBurst('ripple', c.x + tzRnd(-10, 10), 319, 1); n.fun = mx(n.fun + 5 * dt); n.warmth = Math.max(0, n.warmth - 0.3 * dt); if (Math.random() < dt * 0.8) tzBurst('star', c.x + tzRnd(-10, 10), 318, 1); break;
    case 'gaze': n.fun = mx(n.fun + 5 * dt); if (Math.random() < dt * 0.3) tzBurst('note', c.x, c.y - c.half * 2, 1); if (Math.random() < dt * 0.5) sndFx('chime', (c.x - 400) / 400); break;
    case 'machine': {
      c.act += dt;
      if (c.act > 1.6) {
        c.act = 0; const s0 = c.skill; c.skill = Math.min(1, c.skill + 0.035 * (c.learn / 0.06)); for (const m of [0.25, 0.5, 0.75]) if (s0 < m && c.skill >= m) tzNews('tz.n.skill', c.name, Math.round(m * 100)); if (c.skill >= 0.95 && !c.skilled) { c.skilled = true; tzAlbumNote(c.id, 'skilled'); tzNews('tz.n.skilled', c.name); } c.obey = Math.min(1, c.obey + 0.01); n.fun = mx(n.fun + 7);
        tzBurst('star', 420, 290, 4); sndFx('tick', (420 - 400) / 400);
      }
      break;
    }
    case 'tramp': {
      n.fun = mx(n.fun + 5 * dt);
      if (c.ground && c.hopT <= 0) { c.vy = -7.5; c.ground = false; c.hopT = 0.55; c.laughUntil = Date.now() + 500; sndFx('pop', (c.x - 400) / 400); }
      break;
    }
    case 'door': {
      const r = c.room + g.dir;
      if (r < 0 || r >= TZ_ROOMS.length) { c.goalT = 0; break; }
      c.room = r; c.goal = null; c.goalT = 0;
      if (r === TZ.cur) tzPlaceArrive(c, g.dir);
      else if (TZ.follow && TZ.sel === c.id) { tzViewRoom(r); tzPlaceArrive(c, g.dir); }
      else { c.x = tzRnd(60, 740); c.y = TZ_FLOOR; c.lvl = 0; c.ground = true; c.vy = 0; c.sleeping = false; c.away = 0; if (TZ.sel === c.id && !TZ.follow) TZ.sel = 0; }
      break;
    }
    default: c.goalT = 0; break;
  }
}
/* pets in a room nobody is looking at: crude needs recovery and moving between rooms */
function tzAway(c, dt) {
  const n = c.needs, P = TZ_ROOMS[c.room].prov, mx = v => Math.min(100, v);
  if (c.room === 0) {
    if (TZ.room.food > 1 && n.food < 60) { n.food = mx(n.food + 6 * dt); TZ.room.food = Math.max(0, TZ.room.food - 1.5 * dt); }
    if (TZ.room.water > 1 && n.water < 60) { n.water = mx(n.water + 7 * dt); TZ.room.water = Math.max(0, TZ.room.water - 1.5 * dt); }
    if (TZ.room.lamp && n.warmth < 60) n.warmth = mx(n.warmth + 0.6 * dt);
  } else {
    if (n.food < 60) n.food = mx(n.food + P.food * dt);
    if (n.water < 60) n.water = mx(n.water + P.water * dt);
    if (n.warmth < 60 && (c.room >= 3 || TZ.night < 0.5)) n.warmth = mx(n.warmth + P.warmth * dt);
  }
  if (n.rest < 40) n.rest = mx(n.rest + P.rest * dt);
  if (n.fun < 60) n.fun = mx(n.fun + P.fun * dt);
  c.sleeping = false;
  c.away = (c.away || 0) + dt;
  if (c.away > 9) {
    c.away = 0;
    const want = c.stay > 0 ? (c.dest || 0) : 0;
    if (want !== c.room) {
      const mv = want > c.room ? 1 : -1;
      c.room += mv;
      c.x = tzRnd(60, 740);
      if (c.room === TZ.cur) tzPlaceArrive(c, mv);
    }
  }
}

/* ---------- clicks ---------- */
function tzRoomClick(x, y) {
  for (const d of tzDoors()) if (Math.abs(x - d.x) < 24 && y > TZ_FLOOR - 70 && y < TZ_FLOOR + 6) { tzViewRoom(d.to); return true; }
  const r = TZ.cur;
  if (r === 5) return tzGalleryClick(x, y);
  if (r === 4 && TZ.tool === 'lab') return tzLabClick(x, y);
  if (r === 1) {
    for (const p of TZ.garden) if (Math.abs(x - p.x) < 24 && y > 230) { p.g = Math.min(1, p.g + 0.2); tzBurst('star', p.x, TZ_FLOOR - 24, 6); sndFx('pop', (p.x - 400) / 400); return true; }
  } else if (r === 2) {
    if (x > 230 && x < 520 && y > 316) { for (let i = 0; i < 5; i++) tzBurst('star', x + tzRnd(-20, 20), 318, 1); sndFx('pop', (x - 400) / 400); TZ.fishScare = TZ.clock; return true; }
  } else if (r === 3) {
    if (y < 290 && x > 280 && x < 500) { sndFx('chime', (x - 400) / 400); tzBurst('star', x, 250, 6); return true; }
  } else if (r === 4) {
    if (Math.abs(x - 420) < 30 && y > 250) { sndFx('tick', 0); tzBurst('star', 420, 290, 8); return true; }
  }
  return false;
}
function tzRoomTool(x, y, now) {
  if (TZ.tool === 'call') { TZ.callT = 8; TZ.callX = tzClamp(x, 20, 780); tzBurst('star', x, y, 6); for (const c of TZ.list) if (c.room === TZ.cur) { c.sleeping = false; c.goalT = 0; } }
  else if (TZ.partyCool <= 0) { sndFx('joy', 0); TZ.partyCool = 6; tzBurst('conf', x, Math.min(y, 120), 60); for (const c of TZ.list) if (c.room === TZ.cur) { c.danceUntil = now + 4000; c.needs.fun = Math.min(100, c.needs.fun + 12); c.sleeping = false; } }
}

/* ---------- drawing ---------- */
function tzRect(col, x, y, w, h) { b.fillStyle = col; b.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function tzSky(top, bot, bands) {
  for (let i = 0; i < bands; i++) tzRect(i % 2 ? top : bot, 0, i * (TZ_FLOOR / bands), BW, TZ_FLOOR / bands + 1);
}
function tzSun(now, x0, y0, w) {
  const sun = tzClamp((TZ.hour - 6) / 14, 0, 1);
  if (TZ.night < 0.5) {
    const sx = x0 + sun * w, sy = y0 + 40 - Math.sin(sun * Math.PI) * 40;
    tzRect('#ffe58a', sx - 9, sy - 9, 18, 18); tzRect('#fff6c0', sx - 6, sy - 6, 12, 12);
    const cl = (now / 300) % 900 - 100;
    tzRect('#ffffff', cl, 50, 40, 9); tzRect('#ffffff', cl + 8, 43, 22, 9);
    tzRect('#ffffff', (cl * 0.6 + 400) % 900 - 60, 90, 34, 8);
  } else {
    tzRect('#f4f1d0', 640, 40, 20, 20); tzRect('#26305e', 646, 38, 16, 16);
    for (let i = 0; i < 24; i++) tzRect('#ffffff', (i * 97 + 31) % 800, (i * 53 + 11) % 200, 1 + (i % 2), 1 + (i % 2));
  }
}
function tzRoomDraw(r, now) {
  const B = b, night = TZ.night, nb = night > 0.5;
  B.imageSmoothingEnabled = false;
  const bgOk = r >= 1 && r <= 4 && crBgDraw(B, r, BW, BH);
  if (bgOk && (r === 1 || r === 2) && night > 0.02) { B.fillStyle = `rgba(14,20,70,${(0.55 * Math.min(1, night)).toFixed(2)})`; B.fillRect(0, 0, BW, BH); }
  if (r === 1) {
    if (!bgOk) {
    tzSky(nb ? '#26305e' : '#a9dcfb', nb ? '#2d3a70' : '#b8e4fc', 8); tzSun(now, 80, 20, 560);
    tzRect(nb ? '#2e5a46' : '#8fd08a', 0, 210, BW, 120);
    for (let i = 0; i < 6; i++) { tzRect(nb ? '#264c3a' : '#7cc47a', i * 150 - 20, 190 + (i % 2) * 8, 120, 40); }
    tzRect(nb ? '#3f7a58' : '#6dbb6a', 0, TZ_FLOOR, BW, BH - TZ_FLOOR);
    for (let x = 0; x < BW; x += 14) tzRect(nb ? '#356b4c' : '#5aa85a', x + (x % 28 ? 3 : 0), TZ_FLOOR + 6 + (x * 7 % 40), 3, 5);
    for (let x = 30; x < BW; x += 52) { tzRect('#f2e4c8', x, 262, 8, 68); tzRect('#e0cca4', x, 262, 8, 4); }
    tzRect('#f2e4c8', 0, 280, BW, 6); tzRect('#f2e4c8', 0, 304, BW, 6);
    /* tree with branch ledge */
    tzRect('#8a5a30', 640, 150, 26, 180); tzRect('#a8743e', 640, 150, 8, 180);
    tzRect(nb ? '#2c6a44' : '#4faa58', 540, 90, 220, 90); tzRect(nb ? '#3a7a52' : '#63c06a', 560, 80, 180, 40);
    } else { if (nb) B.filter = 'brightness(.62)'; crObjDraw(B, 'p_garden0', 650, TZ_FLOOR + 2, 200); B.filter = 'none'; }
    tzRect('#8a5a30', 560, 270, 180, 7); tzRect('#b07a44', 560, 270, 180, 2);
    /* sun patch, moss bed, birdbath */
    if (!nb) { B.fillStyle = 'rgba(255,240,150,.35)'; B.beginPath(); B.ellipse(380, TZ_FLOOR - 2, 50, 8, 0, 0, 6.3); B.fill(); }
    tzRect('#3f8a4c', 70, TZ_FLOOR - 10, 80, 10); tzRect('#5fae6a', 76, TZ_FLOOR - 14, 68, 6);
    tzRect('#b9b3a6', 696, TZ_FLOOR - 26, 8, 26); tzRect('#cfc8bd', 680, TZ_FLOOR - 32, 40, 8); tzRect('#7cc0f0', 684, TZ_FLOOR - 34, 32, 4);
    for (const p of TZ.garden) tzGardenPlant(p, now);
  } else if (r === 2) {
    if (!bgOk) {
    tzSky(nb ? '#26305e' : '#a9dcfb', nb ? '#2d3a70' : '#b8e4fc', 8); tzSun(now, 80, 20, 560);
    tzRect(nb ? '#2e5a46' : '#8fd08a', 0, 230, BW, 100);
    tzRect(nb ? '#3f7a58' : '#6dbb6a', 0, TZ_FLOOR, BW, BH - TZ_FLOOR);
    /* berry bush */
    tzRect(nb ? '#2c6a44' : '#4faa58', 40, TZ_FLOOR - 40, 80, 40); tzRect(nb ? '#3a7a52' : '#63c06a', 50, TZ_FLOOR - 46, 60, 14);
    for (let i = 0; i < 7; i++) tzRect('#e0486a', 48 + i * 10, TZ_FLOOR - 34 + (i * 7 % 22), 4, 4);
    tzRect('#5fae6a', 130, TZ_FLOOR - 10, 60, 10);
    }
    /* dock */
    tzRect('#9a6a3a', 560, 290, 200, 7); tzRect('#b98a52', 560, 290, 200, 2); tzRect('#7a4f28', 575, 297, 6, 33); tzRect('#7a4f28', 735, 297, 6, 33);
    tzRect('#b9b3a6', 620, 276, 60, 14); tzRect('#cfc8bd', 626, 272, 48, 6);
    /* reeds */
    for (let i = 0; i < 8; i++) { tzRect('#4f8a3c', 222 + i * 6, TZ_FLOOR - 24 - (i % 3) * 7, 2, 28); tzRect('#7a5230', 221 + i * 6, TZ_FLOOR - 30 - (i % 3) * 7, 4, 8); }
  } else if (r === 3) {
    if (!bgOk) {
    tzRect('#1b1730', 0, 0, BW, BH); for (let y = 0; y < TZ_FLOOR; y += 24) tzRect('#211c3a', 0, y, BW, 12);
    for (let x = 0; x < BW; x += 36) { const h = 20 + (x * 13 % 50); tzRect('#2a2447', x, 0, 22, h); tzRect('#352d58', x + 4, h, 14, 8); tzRect('#2a2447', x + 8, h + 8, 6, 10); }
    tzRect('#2b2543', 0, TZ_FLOOR, BW, BH - TZ_FLOOR); tzRect('#3a3260', 0, TZ_FLOOR, BW, 3);
    }
    /* crystal ledge */
    tzRect('#4a4070', 300, 270, 180, 10); tzRect('#5c5190', 300, 270, 180, 3);
    /* mushrooms, fire, pool, moss */
    if (!bgOk) for (let i = 0; i < 4; i++) { const mx = 120 + i * 22; tzRect('#e8e0d0', mx, TZ_FLOOR - 14 - i % 2 * 6, 4, 14 + i % 2 * 6); tzRect(i % 2 ? '#d86a9a' : '#6ab8d8', mx - 6, TZ_FLOOR - 18 - i % 2 * 6, 16, 6); }
    tzRect('#4a4a58', 600, TZ_FLOOR - 8, 64, 8); tzRect('#3a8fc8', 606, TZ_FLOOR - 10, 52, 4);
    tzRect('#3f6a4c', 690, TZ_FLOOR - 10, 70, 10); tzRect('#5a8a68', 696, TZ_FLOOR - 14, 58, 6);
    tzRect('#5a5a68', 376, TZ_FLOOR - 6, 50, 6);
  } else if (r === 4) {
    if (!bgOk) {
    for (let x = 0; x < BW; x += 40) tzRect((x / 40) % 2 ? '#d9b98a' : '#d0ad7c', x, 0, 40, TZ_FLOOR);
    tzRect('#b98e5c', 0, 300, BW, 22);
    tzRect('#9a6f42', 0, TZ_FLOOR, BW, BH - TZ_FLOOR); for (let x = 0; x < BW; x += 60) tzRect('#855a30', x, TZ_FLOOR + 6, 2, BH);
    tzRect('#b98e5c', 0, TZ_FLOOR, BW, 3);
    /* window and pegboard */
    tzRect('#fff4e2', 330, 40, 100, 80); tzRect(nb ? '#26305e' : '#a9dcfb', 336, 46, 88, 68); tzRect('#fff4e2', 378, 46, 4, 68);
    tzRect('#7a5a38', 40, 50, 160, 90); for (let i = 0; i < 6; i++) { tzRect(['#c8c8d0', '#e0486a', '#4a9ae0', '#e8b020', '#6fd36f', '#c060c8'][i], 55 + i * 24, 62 + (i % 2) * 20, 8, 30); }
    }
    /* shelf ledge */
    tzRect('#8a5a30', 520, 280, 180, 7); tzRect('#b07a44', 520, 280, 180, 2); tzRect('#7a4f28', 530, 287, 5, 12); tzRect('#7a4f28', 685, 287, 5, 12);
    tzRect('#e0486a', 560, 262, 18, 18); tzRect('#4a9ae0', 590, 266, 14, 14); tzRect('#e8b020', 640, 264, 20, 16);
    /* food dispenser, tap, radiator, trampoline, bed */
    tzRect('#9ccff2', 92, TZ_FLOOR - 52, 36, 52); tzRect('#c98f5a', 98, TZ_FLOOR - 46, 24, 20); tzRect('#6a8ab0', 98, TZ_FLOOR - 10, 24, 10);
    tzRect('#b9b3a6', 186, TZ_FLOOR - 56, 6, 56); tzRect('#b9b3a6', 186, TZ_FLOOR - 56, 22, 6); tzRect('#7cc0f0', 204, TZ_FLOOR - 50, 3, 8);
    tzRect('#c0c0c8', 280, TZ_FLOOR - 28, 40, 28); for (let i = 0; i < 5; i++) tzRect('#9a9aa6', 284 + i * 7, TZ_FLOOR - 24, 3, 20);
    tzRect('#3a3a48', 570, TZ_FLOOR - 12, 60, 4); tzRect('#e0486a', 570, TZ_FLOOR - 16, 60, 4); tzRect('#3a3a48', 574, TZ_FLOOR - 12, 4, 12); tzRect('#3a3a48', 622, TZ_FLOOR - 12, 4, 12);
    tzRect('#ffb7cf', 706, TZ_FLOOR - 12, 68, 12); tzRect('#ffd2e0', 710, TZ_FLOOR - 15, 40, 3);
    /* learning machine */
    const blink = (now / 300 | 0) % 2;
    tzRect(OUTLINE, 388, 252, 64, 78); tzRect('#7a8ad8', 390, 254, 60, 74); tzRect('#a8b4f0', 390, 254, 60, 6);
    tzRect('#15191d', 398, 266, 44, 26); tzRect(blink ? '#6fd36f' : '#3fa03f', 402, 270, 36, 18);
    const gx = 420 + Math.cos(now / 400) * 6, gy = 307 + Math.sin(now / 400) * 6;
    tzRect('#ffd84a', gx - 3, gy - 3, 6, 6); tzRect('#ffd84a', 400, 300, 4, 4); tzRect('#e0486a', 436, 300, 4, 4);
  }
  else if (r === 5) tzGalleryDraw(now);
  tzProps(r, now);
  /* doors */
  for (const d of tzDoors()) {
    const x = d.dir > 0 ? 770 : 6;
    tzRect(OUTLINE, x - 1, TZ_FLOOR - 62, 26, 63); tzRect('#7a5a38', x, TZ_FLOOR - 60, 24, 60); tzRect('#9a7448', x + 3, TZ_FLOOR - 56, 18, 52); tzRect('#e8c84a', x + (d.dir > 0 ? 4 : 17), TZ_FLOOR - 30, 3, 3);
  }
}
/* drawn after the pets: water, glow */
function tzRoomOver(r, now) {
  const B = b;
  if (r === 4) tzLabOver(now);
  if (r === 2) {
    const ph = now / 400;
    B.fillStyle = TZ.night > 0.5 ? 'rgba(40,70,140,.62)' : 'rgba(90,170,230,.55)';
    B.fillRect(230, 318, 290, BH - 318);
    B.fillStyle = 'rgba(255,255,255,.45)';
    for (let i = 0; i < 12; i++) B.fillRect(236 + ((i * 53 + Math.floor(ph * 8)) % 270), 320 + (i % 3) * 3, 10, 1);
    /* fish */
    const scare = TZ.fishScare && TZ.clock - TZ.fishScare < 1.5;
    for (let i = 0; i < 4; i++) {
      const fx = 250 + ((now / (scare ? 12 : 40) + i * 90) % 250), fy = 345 + (i * 13 % 30) + Math.sin(now / 500 + i) * 3, f = i % 2 ? 1 : 0;
      B.fillStyle = i % 2 ? '#ff9a3a' : '#ffd84a'; B.fillRect(fx, fy, 12, 5); B.fillRect(fx - 4, fy - 1 + (Math.floor(now / 150) % 2), 4, 4);
      B.fillStyle = '#15191d'; B.fillRect(fx + 9, fy + 1, 1, 1);
    }
    /* lily pads */
    if (crObjHas('p_pond0')) { crObjDraw(B, 'p_pond0', 300, 322, 26 + Math.round(Math.sin(now / 900)), false); crObjDraw(B, 'p_pond0', 455, 323, 22, true); crObjDraw(B, 'p_pond2', 395 + Math.sin(now / 1500) * 6, 324 + Math.sin(now / 700), 30, false); }
    else { B.fillStyle = '#4faa58'; B.fillRect(300, 316, 14, 4); B.fillRect(440, 317, 12, 3); B.fillStyle = '#ff9fc4'; B.fillRect(305, 313, 4, 4); }
  } else if (r === 3) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 600);
    const gem = (x, y, h, col, glow) => {
      B.fillStyle = glow; for (let k = 3; k > 0; k--) { B.beginPath(); B.arc(x, y - h / 2, (16 + pulse * 6) * k / 3 * 1.6, 0, 6.3); B.fill(); }
      B.fillStyle = col; B.fillRect(x - 3, y - h, 7, h); B.fillRect(x - 1, y - h - 4, 3, 4); B.fillStyle = 'rgba(255,255,255,.7)'; B.fillRect(x - 2, y - h + 2, 2, 5);
    };
    gem(330, 270, 22, '#6ae0f0', 'rgba(100,220,240,.12)'); gem(390, 270, 30, '#e070f0', 'rgba(220,110,240,.12)'); gem(450, 270, 20, '#6ae0f0', 'rgba(100,220,240,.12)');
    gem(60, TZ_FLOOR, 26, '#e070f0', 'rgba(220,110,240,.10)'); gem(760, TZ_FLOOR - 10, 30, '#6ae0f0', 'rgba(100,220,240,.10)');
    /* fire */
    const fl = Math.floor(now / 120) % 3;
    B.fillStyle = 'rgba(255,170,70,.06)'; for (let k = 4; k > 0; k--) { B.beginPath(); B.arc(400, TZ_FLOOR - 14, (70 + pulse * 6) * k / 4, 0, 6.3); B.fill(); }
    B.fillStyle = '#e8602a'; B.fillRect(388, TZ_FLOOR - 18 - fl * 2, 24, 12 + fl * 2); B.fillStyle = '#ffb02a'; B.fillRect(393, TZ_FLOOR - 15 - fl, 14, 9 + fl); B.fillStyle = '#fff07a'; B.fillRect(397, TZ_FLOOR - 11, 6, 5);
    /* drip */
    const dy = (now / 6) % 120;
    B.fillStyle = '#6ab8f0'; B.fillRect(630, 150 + dy, 3, 5);
    B.fillStyle = 'rgba(20,16,40,.28)'; B.fillRect(0, 0, BW, BH);
  } else if (r === 1) {
    for (const q of TZ.bf) {
      const w = Math.floor(now / 110) % 2;
      B.fillStyle = '#ff9fc4'; B.fillRect(q.x - 4, q.y - (w ? 3 : 1), 4, 4); B.fillRect(q.x + 1, q.y - (w ? 3 : 1), 4, 4);
      B.fillStyle = '#15191d'; B.fillRect(q.x, q.y, 1, 4);
    }
  }
  /* door labels */
  const names = tr('tz.rooms');
  for (const d of tzDoors()) {
    B.font = '8px Silkscreen, monospace'; B.textAlign = d.dir > 0 ? 'right' : 'left'; B.textBaseline = 'alphabetic';
    B.fillStyle = 'rgba(40,30,60,.8)'; B.fillText(names[d.to], d.dir > 0 ? 792 : 8, TZ_FLOOR - 66);
    B.textAlign = 'start';
  }
}
function tzGardenPlant(p, now) {
  const B = b, g = p.g, h = 8 + g * 38, x = p.x, y = TZ_FLOOR;
  tzRect('#7a5230', x - 14, y - 6, 28, 6);
  tzRect('#4f9a3c', x - 1, y - h, 3, h - 4);
  if (g > 0.3) { tzRect('#63c06a', x - 10, y - h * 0.6, 10, 5); tzRect('#63c06a', x + 2, y - h * 0.75, 10, 5); }
  if (g >= 1) {
    for (let i = 0; i < 3; i++) { tzDisc(x - 9 + i * 9, y - h - 2 + (i % 2) * 4, 4, OUTLINE); tzDisc(x - 9 + i * 9, y - h - 2 + (i % 2) * 4, 3, ['#e8483a', '#ff9a3a', '#e8483a'][i]); }
  } else if (g > 0.6) { tzRect('#ff9fc4', x - 4, y - h - 4, 8, 6); tzRect('#fff07a', x - 1, y - h - 2, 3, 3); }
  else if (g > 0.15) tzRect('#7fcf8c', x - 3, y - h - 3, 7, 5);
}
