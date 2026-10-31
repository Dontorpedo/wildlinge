'use strict';
/* Plimploms user interface: rendering loop, panels, charts, input. The simulation runs in a worker (WebAssembly). */
const BMC_URL = 'https://buymeacoffee.com/denisthedev'; /* set your Buy-me-a-coffee link here */
const DB_NAME = 'wildlinge', STORE = 'saves', SAVE_KEY = 'world';
const ZOOMS = [7.5, 5, 3.5, 2.5, 1.7, 1.2];
const DRIVE_COL = ['#e5a94a', '#e0645a', '#f08a5d', '#9fd8ff', '#e27bd0', '#6fcf6a', '#ffd84a', '#8f8fe8'];
const KNOCK_KEYS = ['repro', 'mut', 'learn', 'self', 'lang', 'meta'];
const LINE_COL = ['#6fcf6a', '#e0645a', '#9fd8ff', '#e5c14a', '#e27bd0', '#8f8fe8'];
const SERIES_SETS = {
  pop: ['pop', 'herb', 'carn', 'species'],
  life: ['life', 'mind', 'certainty', 'understand', 'wellbeing', 'mirror'],
  brain: ['neurons', 'conns', 'parts', 'diversity', 'phi', 'lz'],
  lang: ['entropy', 'mi', 'topo', 'understand'],
  modes: ['mChange', 'mNovelty', 'mEcology', 'mComplexity', 'bActivity']
};

const $ = id => document.getElementById(id);
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const cv = $('world'), ctx = cv.getContext('2d');
const chart = $('chart'), cctx = chart.getContext('2d');
const mini = $('minimap'), mctx = mini.getContext('2d');
const cam = { x: WORLD_W / 2, y: WORLD_H / 2, zi: 4 };

let carryId = 0, carryWait = false, serverMode = false, srvWs = null, srvChain = Promise.resolve(), srvMs = 125, srvAt = 0, srvRetry = 0;
let sendHost = () => {}, worker = null, mode = 'worker', labWorker = null;
let viewMode = 'wild';
let relIds = new Set(), frame = null, panel = null, tool = 'select', running = true, selId = 0, activeTab = 'world';
let showSense = false, showBubbles = true, showMeaning = true, follow = false;
let mapInfo = null, terrainSummer = null, terrainWinter = null, miniBase = null;
let bubbles = [], animT = 0, lastView = '', toastTimer = null, centered = false, gotInit = false, welcomeOk = false;
let seriesData = null, upl = null, uplSet = '', lastSeriesAt = 0, phyloSig = '', brainPts = [], lastLab = null;
const gst = { animT: 0, hue: 0, showSense: false };
const windP = Array.from({ length: 120 }, () => ({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, l: Math.random() * 200 }));

/* ---------- small helpers ---------- */
function setHtml(el, html) { if (el._h !== html) { el._h = html; el.innerHTML = html; } }
const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
const pct = v => Math.round((v || 0) * 100) + ' %';
const sub = s => `<h4>${s}</h4>`;
const barHtml = (v, col) => `<span class="bar"><i style="width:${Math.round(clamp(v, 0, 1) * 100)}%;background:${col}"></i></span>`;
const joinW = x => (Array.isArray(x) ? x.join(' ') : String(x === undefined || x === null ? '' : x));
const yn = v => (v ? `<span class="yes">${esc(t('sel.yes'))}</span>` : `<span class="no">${esc(t('sel.no'))}</span>`);
const dayOf = tk => [Math.floor(tk / YEAR_LEN) + 1, Math.floor((tk % YEAR_LEN) / DAY_LEN) + 1];
function b64ToBytes(s) {
  const bin = atob(s), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function wasmBuffer() { return b64ToBytes($('wasm-b64').textContent.trim()).buffer; }
function toast(text) {
  if (!text) return;
  const el = $('toast');
  el.textContent = text;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2400);
}
function saveFile(name, mime, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbDo(modeName, fn) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, modeName), rq = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); res(rq && rq.result); };
    tx.onerror = () => { db.close(); rej(tx.error); };
  });
}

/* ---------- static texts ---------- */
function applyI18n() {
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  $('welcomeList').innerHTML = tr('welcome.l').map(s => `<li>${esc(s)}</li>`).join('');
  $('btnRun').textContent = t(running ? 'btn.pause' : 'btn.run');
  if (viewMode === 'wild') $('help').textContent = t('help.keys'); else tzSetTool(TZ.tool);
  $('chartSet').innerHTML = Object.entries(tr('chartSets')).map(([k, n]) => `<option value="${k}"${k === uplSet ? ' selected' : ''}>${esc(n)}</option>`).join('');
  $('labKnock').innerHTML = KNOCK_KEYS.map(k => `<option value="${k}">${esc(tr('knocks')[k])}</option>`).join('');
  $('langSel').value = LANG;
  $('bmc').title = $('bmc2').title = BMC_URL.includes('YOUR-NAME') ? t('bmc.todo') : '';
  upl = null; uplSet = '';
  if (panel) renderPanel(panel);
  if (seriesData) drawSeries();
  phyloSig = '';
}

/* ---------- world graphics from the biome grid ---------- */
function prepareGraphics(msg) {
  const u8 = new Uint8Array(msg.bio);
  const gw = u8[0] | (u8[1] << 8), gh = u8[2] | (u8[3] << 8);
  mapInfo = { gw, gh, bio: u8.subarray(4), seed: msg.seed >>> 0 };
  terrainSummer = buildTerrain(mapInfo, false, mapInfo.seed);
  terrainWinter = buildTerrain(mapInfo, true, mapInfo.seed);
  miniBase = buildMini(mapInfo);
}
function viewRect() {
  const wpp = ZOOMS[cam.zi], vw = BW * wpp, vh = BH * wpp;
  cam.x = vw >= WORLD_W ? WORLD_W / 2 : clamp(cam.x, vw / 2, WORLD_W - vw / 2);
  cam.y = vh >= WORLD_H ? WORLD_H / 2 : clamp(cam.y, vh / 2, WORLD_H - vh / 2);
  return { wpp, ox: cam.x - vw / 2, oy: cam.y - vh / 2, vw, vh };
}

/* ---------- render loop ---------- */
function render() {
  animT++;
  gst.animT = animT;
  requestAnimationFrame(render);
  tzFrame();
  if (viewMode === 'terra') { tzRender(); if (activeTab === 'terra') tzPanel(false); return; }
  if (!frame || !terrainSummer) return;
  const fr = frame, cs = fr.cs, meta = fr.meta;
  if (serverMode) lerpFrame(fr);
  let selO = -1;
  if (selId) for (let o = 0; o + CS_STRIDE <= cs.length; o += CS_STRIDE) if (cs[o] === selId) { selO = o; break; }
  if (follow && selO >= 0) { cam.x += (cs[selO + 1] - cam.x) * 0.15; cam.y += (cs[selO + 2] - cam.y) * 0.15; }
  const { wpp, ox, oy, vw, vh } = viewRect();
  const vkey = `${rp(ox)}|${rp(oy)}|${wpp}`;
  if (vkey !== lastView) { lastView = vkey; sendHost({ type: 'view', x0: ox, y0: oy, x1: ox + vw, y1: oy + vh, wpp }); }
  const sf = meta.sf, wf = clamp((0.45 - sf) / 0.45, 0, 1);
  b.imageSmoothingEnabled = false;
  b.fillStyle = '#0b1a2b';
  b.fillRect(0, 0, BW, BH);
  b.globalAlpha = 1;
  b.drawImage(terrainSummer, ox / TPX, oy / TPX, vw / TPX, vh / TPX, 0, 0, BW, BH);
  if (wf > 0) { b.globalAlpha = wf; b.drawImage(terrainWinter, ox / TPX, oy / TPX, vw / TPX, vh / TPX, 0, 0, BW, BH); b.globalAlpha = 1; }
  b.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 70; i++) {
    const x = (Math.random() * BW) | 0, y = (Math.random() * BH) | 0;
    const bi = biomeAt(mapInfo, ox + x * wpp, oy + y * wpp);
    if (bi === 0 || (bi === 1 && !meta.frozen)) b.fillRect(x, y, 2, 1);
  }
  b.fillStyle = 'rgba(255,255,255,.22)';
  for (const p of windP) {
    const w = windAt(p.x, p.y, meta.t), sx = (p.x - ox) / wpp, sy = (p.y - oy) / wpp;
    if (sx >= 0 && sy >= 0 && sx < BW && sy < BH) { b.fillRect(sx | 0, sy | 0, 1, 1); b.fillRect(((p.x - w.x * 12 - ox) / wpp) | 0, ((p.y - w.y * 12 - oy) / wpp) | 0, 1, 1); }
    if (fr.running) { p.x += w.x * 6; p.y += w.y * 6; p.l--; }
    if (p.l <= 0 || p.x < 0 || p.x > WORLD_W || p.y < 0 || p.y > WORLD_H) { p.x = ox + Math.random() * vw; p.y = oy + Math.random() * vh; p.l = 100 + Math.random() * 150; }
  }
  const big = wpp < 3.6, fd = fr.foods;
  for (let i = 0; i + 6 <= fd.length; i += 6) {
    const px = ((fd[i] - ox) / wpp) | 0, py = ((fd[i + 1] - oy) / wpp) | 0, e = fd[i + 2];
    if (fd[i + 3] === 3) {
      const w2 = e > 18 ? 3 : e > 8 ? 2 : 1;
      b.fillStyle = OUTLINE; b.fillRect(px - w2 - 1, py - 1, 2 * w2 + 3, 4);
      b.fillStyle = '#8a6a3c'; b.fillRect(px - w2, py - 1, 2 * w2 + 1, 2);
      b.fillStyle = '#b8914f'; b.fillRect(px - w2, py - 1, 2 * w2 + 1, 1);
      b.fillStyle = '#5a4026'; b.fillRect(px - w2, py + 1, 2 * w2 + 1, 1);
      continue;
    }
    if (fd[i + 3] === 2) {
      b.fillStyle = '#4a3326'; b.fillRect(px, py, big ? 2 : 1, 1);
      b.fillStyle = '#7a5a3c'; b.fillRect(px, py, 1, 1);
      continue;
    }
    if (fd[i + 3]) {
      b.globalAlpha = clamp(1 - fd[i + 5] / MEAT_DECAY, 0.25, 1);
      b.fillStyle = '#5e1717'; b.fillRect(px, py, big ? 2 : 1, big ? 2 : 1);
      b.fillStyle = '#c04a3a'; b.fillRect(px, py, 1, 1);
      b.globalAlpha = 1;
      continue;
    }
    const pc = PLANT_COL[fd[i + 4]] || PLANT_COL[2];
    if (big && e > 6) { b.fillStyle = pc[0]; b.fillRect(px - 1, py, 3, 1); b.fillRect(px, py - 1, 1, 3); }
    b.fillStyle = pc[1]; b.fillRect(px, py, 1, 1);
    if (big && e > 16 && sf > 0.35 && ((fd[i] * 13 + fd[i + 1] * 7) | 0) % 3 === 0) { b.fillStyle = pc[2]; b.fillRect(px, py - 1, 1, 1); }
  }
  for (const m of meta.mirrors || []) {
    const px = rp((m[0] - ox) / wpp), py0 = rp((m[1] - 50 - oy) / wpp), h = Math.max(3, rp(100 / wpp));
    b.fillStyle = OUTLINE; b.fillRect(px - 2, py0 - 1, 4, h + 2);
    b.fillStyle = '#c9d6e3'; b.fillRect(px - 1, py0, 2, h);
    b.fillStyle = '#ffffff'; b.fillRect(px - 1, py0 + 1, 1, Math.max(1, h >> 2));
  }
  gst.showSense = showSense;
  const ordered = [];
  for (let o = 0; o + CS_STRIDE <= cs.length; o += CS_STRIDE) if (o !== selO) ordered.push(o);
  ordered.sort((p, q) => cs[p + 2] - cs[q + 2]);
  for (const o of ordered) drawCreature(cs, o, false, wpp, ox, oy, gst);
  if (selO >= 0) drawCreature(cs, selO, true, wpp, ox, oy, gst);
  if (relIds.size) {
    for (let o = 0; o + CS_STRIDE <= cs.length; o += CS_STRIDE) if (relIds.has(cs[o])) {
      const mx = rp((cs[o + 1] - ox) / wpp), my = rp((cs[o + 2] - oy) / wpp) - clamp(rp(cs[o + 4] / wpp * 1.8), 1, 26) - 8 - (Math.sin(animT * 0.1) > 0 ? 1 : 0);
      if (mx < -10 || my < -10 || mx > BW + 10 || my > BH + 10) continue;
      b.fillStyle = OUTLINE; b.fillRect(mx - 3, my - 1, 7, 3); b.fillRect(mx - 1, my - 3, 3, 7);
      b.fillStyle = '#ffd84a'; b.fillRect(mx - 2, my, 5, 1); b.fillRect(mx, my - 2, 1, 5);
    }
  }
  if (meta.night > 0) { b.fillStyle = `rgba(8,12,40,${0.5 * meta.night})`; b.fillRect(0, 0, BW, BH); }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bufCanvas, 0, 0, BW * S, BH * S);
  drawBubbles(ox, oy, wpp);
}
function drawBubbles(ox, oy, wpp) {
  const now = performance.now();
  bubbles = bubbles.filter(q => q.until > now);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const q of bubbles) {
    if (q.until - now < 300 && ((now / 80) | 0) % 2) continue;
    const sx = (q.x - ox) / wpp * S, sy = (q.y - oy) / wpp * S;
    if (sx < -60 || sy < -60 || sx > VIEW_W + 60 || sy > VIEW_H + 60) continue;
    const small = q.kind === 2;
    ctx.font = (small ? '10px' : '13px') + ' Silkscreen, monospace';
    const tw = Math.ceil((ctx.measureText(q.text).width + 12) / S) * S, h = small ? 15 : 21;
    const x = rp((sx - tw / 2) / S) * S, y = rp((sy - 46) / S) * S;
    ctx.fillStyle = OUTLINE; ctx.fillRect(x - S, y - S, tw + 2 * S, h + 2 * S);
    ctx.fillStyle = q.kind === 1 ? '#ffd84a' : small ? '#c9ccc4' : '#f2efe4';
    ctx.fillRect(x, y, tw, h);
    const tx = rp(sx / S) * S;
    ctx.fillRect(tx - S, y + h, 2 * S, S);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(tx - 2 * S, y + h, S, S); ctx.fillRect(tx + S, y + h, S, S); ctx.fillRect(tx - S, y + h + S, 2 * S, S);
    ctx.fillStyle = '#15191d';
    ctx.fillText(q.text, x + tw / 2, y + h / 2 + 1);
  }
  ctx.textBaseline = 'alphabetic';
}

/* ---------- panels ---------- */
function renderPanel(p) {
  const stepMs = frame ? frame.stepMs || 0 : 0;
  $('clock').textContent = t('app.clock', tDay(p.day), tSeason(p.season), p.pop, p.spCount, stepMs.toFixed(1)) + (mode === 'main' ? ' | ' + t('app.mainThread') : '');
  if (activeTab === 'world') renderWorld(p);
  if (activeTab === 'creature') renderSel(p.sel);
  if (activeTab === 'research') renderResearch(p);
  drawChart(p.hist);
  drawMini(p.mini);
  const ad = p.sel;
  $('selHead').style.display = ad ? 'block' : 'none';
  if (ad) {
    $('selName').textContent = ad.name;
    $('selId').textContent = '#' + ad.id;
    $('btnAdopt').textContent = t('btn.adopt');
  }
}
function renderWorld(p) {
  const st = p.stats, d = st.deaths || {};
  setHtml($('goals'), p.goals.map(([k, tk]) => `<tr><td${tk !== null ? ' class="done"' : ''}>${esc(tr('milestones')[k] || k)}</td><td class="${tk !== null ? 'done' : 'muted'}">${tk !== null ? esc(tDay(dayOf(tk))) : esc(t('goal.open'))}</td></tr>`).join(''));
  setHtml($('stats'),
    row(t('st.herbCarn'), `${st.herb} / ${st.carn}`) +
    row(t('st.plants'), `${st.plants} / ${st.asleep}`) +
    row(t('st.cycle'), `${st.dets} / ${st.fert}`) +
    (st.react && st.react[0] >= 20 ? row(t('st.react'), `${Math.round(100 * st.react[1] / st.react[0])}% / ${st.react[2] ? Math.round(100 * st.react[3] / st.react[2]) : 0}%`) + row(t('st.react2'), st.react[0]) : '') +
    (st.cache ? row(t('st.cache'), `${st.cache[0]} | ${st.cache[3]}`) + row(t('st.cache2'), `${st.cache[1]} / ${st.cache[2]}`) : '') +
    (st.acts ? tr('acts').map((n, k) => (st.acts[k] ? row(t('st.acts') + ': ' + n, `${st.acts[k]} (${Math.round(100 * st.acts[k] / Math.max(1, st.acts.reduce((p, q) => p + q, 0)))}%)`) : '')).join('') : '') +
    row(t('st.gen'), st.gen) +
    row(t('st.wb'), pct(st.wb)) +
    row(t('st.neurons'), `${st.neurons.toFixed(1)} / ${st.conns.toFixed(0)}`) +
    row(t('st.cert'), pct(st.cert)) +
    row(t('st.parts'), st.parts.toFixed(1)) +
    row(t('st.rate'), pct(st.rate)) +
    row(t('st.sentences'), st.sentences) +
    row(t('st.words'), st.words) +
    row(t('st.births'), st.births) +
    row(t('st.deaths1'), `${d.hunger || 0} / ${d.age || 0} / ${d.eaten || 0}`) +
    row(t('st.deaths2'), `${d.drowned || 0} / ${d.frozen || 0} / ${d.heat || 0} / ${d.injury || 0}`) +
    row(t('st.macro'), `${st.macro} / ${st.bossChanges}`) +
    row(t('st.neuronMut'), st.neuronsN));
  const lexRows = (list, where) => list.length
    ? list.map(([w, sh, x]) => `<tr><td><a class="w" data-w="${esc(w)}">${esc(w)}</a></td><td class="l">${showMeaning ? esc(where ? tSector(x) : describeVec(x)) : '?'}</td><td>${pct(sh)}</td></tr>`).join('')
    : `<tr><td class="muted">${esc(t('lang.none'))}</td></tr>`;
  setHtml($('lexicon'), sub(esc(t('lang.what'))) + `<table>${lexRows(p.lang.what, false)}</table>` + sub(esc(t('lang.where'))) + `<table>${lexRows(p.lang.where, true)}</table>` +
    `<div class="muted" style="margin-top:6px">${esc(t('lang.click'))}</div>`);
  const head = tr('sp.head');
  setHtml($('species'), `<tr><th>${esc(head[0])}</th><th>${esc(head[1])}</th><th style="text-align:right">${esc(head[2])}</th></tr>` + p.species.map(s => {
    const boss = s.boss ? `<a class="w" data-id="${s.boss.id}" style="color:#ffd84a">${esc(s.boss.name)}</a> ${esc(t('sp.votes', Math.round(s.score * 100), s.votes, s.voters))}` : '-';
    const kinds = s.kinds.map(([k, sh]) => `${esc(tKind(k))} ${Math.round(sh * 100)}%`).join(', ');
    const ord = s.ord !== undefined && s.ord !== null ? t('sp.order', s.ord >= 0.5 ? t('sp.ordWW') : t('sp.ordRW'), Math.round(Math.max(s.ord, 1 - s.ord) * 100)) : '';
    return `<tr><td class="l"><span style="display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px;background:hsl(${+s.hue || 0},58%,52%);${s.carn ? 'outline:1px solid #e0645a' : ''}"></span>${esc(s.name)}</td><td class="l">${s.n}</td><td>${boss}</td></tr>` +
      `<tr><td colspan="3" class="muted l" style="font-size:11px">${kinds}${kinds && ord ? ' | ' : ''}${esc(ord)}</td></tr>`;
  }).join(''));
  setHtml($('events'), p.events.map(([d2, k, par]) => `<div><span class="muted">${esc(tDay(d2))}</span> ${esc(tEvent(k, par))}</div>`).join(''));
  setHtml($('log'), p.log.map(e => {
    const who = e.id ? `${esc(e.name)} (${e.carn ? 'C' : 'H'})` : esc(t('lang.you'));
    const meaning = showMeaning && e.vec ? ` <span class="muted">(${esc(describeVec(e.vec))}${e.sector >= 0 ? ', ' + esc(tSector(e.sector)) : ''})</span>` : '';
    return `<div>${who}: <b>${esc(e.words)}</b>${meaning}</div>`;
  }).join(''));
  relIds = new Set((p.released || []).map(a => a.id));
  setHtml($('mine'), (p.adopted.length
    ? '<table>' + p.adopted.map(a => `<tr><td class="l"><a class="w" data-id="${a.id}" data-focus="1">${esc(a.name)}</a> <span class="muted">${esc(tPhase(a.phase))}</span></td><td>${a.asleep ? esc(t('mine.asleep')) : esc(tr('goals')[a.goal] || '')} | ${pct(a.wb)}</td></tr>`).join('') + '</table>'
    : `<div class="muted">${esc(t('mine.none'))}</div>`) +
    ((p.released || []).length ? sub(esc(t('mine.released'))) + '<table>' + p.released.map(a => `<tr><td class="l"><a class="w" data-id="${a.id}" data-focus="1">${esc(a.name)}</a> <span class="muted">${esc(tPhase(a.phase))} | ${esc(t('tz.gen'))} ${a.gen}</span></td><td>${a.asleep ? esc(t('mine.asleep')) : esc(tr('goals')[a.goal] || '')} | ${esc(t('mine.kids', a.kids))}</td></tr>`).join('') + '</table>' : '') +
    (p.memorial.length ? sub(esc(t('mine.memorial'))) + '<table>' + p.memorial.map(m => `<tr><td class="l">${esc(m.name)}</td><td>${esc(t('mine.memRow', tDay(m.died), tCause(m.cause), m.children))}</td></tr>`).join('') + '</table>' : ''));
}
function renderResearch(p) {
  const r = p.research, last = r.last || {};
  const crit = (names, vals) => '<table>' + names.map((n, i) => `<tr><td>${esc(n)}</td><td>${vals ? barHtml(vals[i], '#6fcf6a') + ' ' + pct(vals[i]) : '-'}</td></tr>`).join('') + '</table>';
  setHtml($('research'),
    `<div class="q"><b>${esc(t('res.lifeQ'))}</b><br>${esc(t('res.lifeT'))}</div>` +
    sub(esc(t('res.bio'))) + crit(tr('life'), r.life) + sub(esc(t('res.mind'))) + crit(tr('mind'), r.mind) +
    `<div class="q"><b>${esc(t('res.bodyQ'))}</b><br>${esc(t('res.bodyT', last.parts !== undefined ? last.parts.toFixed(2) : '-', last.diversity !== undefined ? last.diversity.toFixed(2) : '-'))}</div>` +
    (r.firstKinds.length ? '<table>' + r.firstKinds.map(([k, d2]) => `<tr><td>${esc(tKind(k))}</td><td>${esc(tDay(d2))}</td></tr>`).join('') + '</table>' : `<div class="muted">${esc(t('res.noKinds'))}</div>`) +
    `<div class="q"><b>${esc(t('res.selfQ'))}</b><br>${esc(t('res.selfT'))}</div>` +
    '<table>' + row(t('res.cert'), pct(last.certainty)) + row(t('res.gut'), pct(r.gutOwn)) +
    row(t('res.mirrorPass'), `${r.mirrorPass} / ${r.mirrorTests}`) + row(t('res.mirrors'), `${r.mirrors} / 3`) + '</table>' +
    sub(esc(t('res.open'))) + `<div class="muted">${esc(t('res.bedau', r.bedau.diversity, (+r.bedau.mean).toFixed(2), r.bedau.new))}</div>` +
    sub(esc(t('res.knock'))) +
    KNOCK_KEYS.map((k, i) => `<label><input type="checkbox" data-knock="${k}"${r.knock[i] ? ' checked' : ''}> ${esc(t('res.off', tr('knocks')[k]))}</label>`).join('') +
    `<div class="muted" style="margin-top:6px">${esc(t('res.series', r.nSeries))} | ${esc(t('res.strokes', r.strokes, r.taught))}</div>`);
  const now = performance.now();
  if (now - lastSeriesAt > 4000) { lastSeriesAt = now; sendHost({ type: 'series', from: 0 }); }
  const sig = p.phylo.map(n => n.id + (n.died >= 0 ? 'x' : '')).join(',');
  if (sig !== phyloSig) { phyloSig = sig; drawPhylo(p.phylo); }
}
function lookRows(lk) {
  if (!lk) return '';
  const L = tr('look'), ph = lk.ph;
  const vis = L.loci.map((n, i) => `${esc(n)}: ${esc(L.v[i][ph[i]])}`).join(', ');
  const hid = L.loci.map((n, i) => { const o = Math.max(lk.al[i][0], lk.al[i][1]); return o !== ph[i] ? `${esc(n)}: ${esc(L.v[i][o])}` : ''; }).filter(Boolean).join(', ');
  return row(t('sel.look'), vis) + row(t('sel.lookHidden'), hid || '-') + row(t('sel.rarity'), pct(lk.rarity));
}
function famLink(f) {
  if (!f) return '';
  return `<a class="w" data-id="${f.id}">${esc(f.name)}</a>${f.alive ? '' : ` <span class="muted">(${esc(t('sel.dead'))})</span>`}`;
}
function ancHtml(n) {
  if (!n) return '';
  const ps = (n.p || []).map(ancHtml).join('');
  return `<li>${famLink(n)}${ps ? `<ul>${ps}</ul>` : ''}</li>`;
}
function renderSel(s) {
  const el = $('info');
  if (!s) { setHtml(el, `<div class="muted">${esc(t('sel.none'))}</div>`); return; }
  const ls = s.lastSaid, dr = tr('drives');
  const mutEnc = (s.mutation || []).map(([k, p]) => k + ':' + p).join('|');
  const focus = s.focus >= 0 ? tr('features')[s.focus] : '-';
  setHtml(el,
    '<table>' +
    row(t('sel.spType'), `${esc(s.sp)} / ${esc(t(s.carn ? 'sel.carn' : 'sel.herb'))}`) +
    row(t('sel.phaseGen'), `${esc(tPhase(s.phase))} / ${s.gen}`) +
    row(t('sel.age'), esc(t('sel.ageOf', s.age, s.life))) +
    row(t('sel.energy'), `${esc(t('sel.of', s.energy.toFixed(0), s.maxE.toFixed(0)))} / ${s.health.toFixed(0)}`) +
    row(t('sel.place'), esc(tBiome(s.biome))) +
    row(t('sel.nowDoing'), esc(tr('acts')[s.act] || '-')) +
    row(t('sel.state'), s.asleep ? esc(s.dream >= 0 ? t('sel.dreams', tr('features')[s.dream]) : t('sel.sleeps')) : esc(t('sel.awake'))) +
    '</table>' + sub(esc(t('sel.acts'))) + '<table>' +
    (() => { const ac = s.actc || [], tot = Math.max(1, ac.reduce((p, q) => p + q, 0)); return tr('acts').map((n, k) => `<tr><td>${esc(n)}</td><td>${barHtml(ac[k] / tot, '#8fb8e8')}</td></tr>`).join(''); })() +
    '</table>' + sub(esc(t('sel.drives'))) + '<table>' +
    `<tr class="goal"><td>${esc(t('sel.goal'))}</td><td>${esc(tr('goals')[s.goal] || '')}</td></tr>` +
    dr.map((n, i) => `<tr><td>${esc(n)} <span class="muted">(${s.dw[i].toFixed(2)})</span></td><td>${barHtml(s.D[i], DRIVE_COL[i])}</td></tr>`).join('') +
    row(t('sel.wbReward'), `${pct(s.wb)} / ${s.reward.toFixed(3)}`) +
    '</table>' + sub(esc(t('sel.chem'))) + '<table>' +
    `<tr><td>${esc(t('sel.adr'))}</td><td>${barHtml(s.horm[0], '#e0645a')}</td></tr>` +
    `<tr><td>${esc(t('sel.endo'))}</td><td>${barHtml(s.horm[1], '#ff9ec7')}</td></tr>` +
    `<tr><td>${esc(t('sel.cort'))}</td><td>${barHtml(s.horm[2], '#e5c14a')}</td></tr>` +
    `<tr><td>${esc(t('sel.tired'))}</td><td>${barHtml(s.tired, '#8f8fe8')}</td></tr>` +
    '</table>' + sub(esc(t('sel.criteria'))) + '<table>' +
    tr('life').map((n, i) => row(esc(n), yn(s.lifeC[i]))).join('') + tr('mind').map((n, i) => row(esc(n), yn(s.mindC[i]))).join('') +
    '</table>' + sub(esc(t('sel.brainSelf'))) + '<table>' +
    row(t('sel.neurons'), `${s.hidden} / ${s.conns} / ${s.plast.toFixed(4)}`) +
    row(t('sel.learned'), s.learned.toFixed(2)) +
    row(t('sel.cert'), `${pct(s.cert)} / ${s.surprise.toFixed(2)}`) +
    row(t('sel.ext'), s.ext.toFixed(2)) +
    row(t('sel.gut'), s.gutEvents ? `${pct(s.gutOwn)} (${s.gutEvents})` : '-') +
    row(t('sel.mirror'), s.selfRecog ? esc(t('sel.mirrorYes')) : s.mirrorT ? esc(t('sel.mirrorT', s.mirrorT)) : '-') +
    row(t('sel.phi'), (+s.phi).toFixed(4)) +
    row(t('sel.lz'), (+s.lz).toFixed(3)) +
    '</table>' + sub(esc(t('sel.body'))) + '<table>' +
    row(t('sel.shape'), esc(tShape(s.shape))) +
    lookRows(s.look) +
    row(t('sel.parts'), esc(s.parts.map(([k, n]) => `${tKind(k)}${n > 1 ? ' x' + n : ''}`).join(', ')) || '-') +
    row(t('sel.abil'), esc(s.abil.map(([k, v]) => `${tAbil(k)} ${v.toFixed(2)}`).join(', ')) || '-') +
    row(t('sel.fly'), yn(s.fly)) +
    row(t('sel.size'), `${s.size.toFixed(1)} / ${s.sizeG.toFixed(1)}`) +
    row(t('sel.speedSense'), `${s.speed.toFixed(2)} / ${s.sense.toFixed(0)} / ${s.diet.toFixed(2)}`) +
    row(t('sel.mut'), esc(mutEnc ? tMutList(mutEnc) : '-')) +
    row(t('sel.kids'), `${s.children} / ${s.kills}`) +
    '</table>' + sub(esc(t('sel.mind'))) + '<table>' +
    row(t('sel.fear'), `${s.fear.toFixed(2)} / ${esc(focus)}`) +
    row(t('sel.fe'), s.fe.toFixed(2)) +
    row(t('sel.protos'), `${s.protos} / 10`) +
    row(t('sel.said'), ls ? `${esc(joinW(ls.tokens))}${showMeaning ? ` (${esc(describeVec(ls.vec))}${ls.sector >= 0 ? ', ' + esc(tSector(ls.sector)) : ''})` : ''}` : '-') +
    row(t('sel.heard'), s.heard ? `${esc(joinW(s.heard.words))} = ${esc(describeVec(s.heard.vec))}${s.heard.where !== null && s.heard.where !== undefined ? ', ' + esc(tSector(s.heard.where)) : ''}` : '-') +
    row(t('sel.understoodBy'), s.spoken ? `${pct(Math.min(1, s.echoes / s.spoken))} (${s.echoes}/${s.spoken})` : '-') +
    row(t('sel.understands'), s.heardN ? `${pct(s.understood / s.heardN)} (${esc(t('sel.heardN', s.heardN))})` : '-') +
    row(t('sel.order'), esc(s.order === 0 ? t('sp.ordWW') : t('sp.ordRW'))) +
    `<tr><td colspan="2" class="muted l">${s.vocab.length ? s.vocab.map(([w, v]) => `<a class="w" data-w="${esc(w)}">${esc(w)}</a> = ${esc(describeVec(v))}`).join(', ') : esc(t('sel.vocab0'))}</td></tr>` +
    '</table>' + sub(esc(t('sel.family'))) + '<table>' +
    row(t('sel.parents'), s.parents.filter(Boolean).length ? s.parents.map(famLink).filter(Boolean).join(', ') : esc(t('sel.immigrant'))) +
    row(t('sel.children'), s.kids.length ? s.kids.map(famLink).join(', ') : '-') +
    row(t('sel.desc'), s.descN || 0) +
    '</table>' + ((s.anc || []).some(Boolean) ? sub(esc(t('sel.anc'))) + `<ul class="tree">${(s.anc || []).map(ancHtml).join('')}</ul>` : '') + sub(esc(t('sel.role'))) + '<table>' +
    row(t('sel.role'), s.isBoss ? esc(t('sel.bossSince', Math.max(1, Math.round((s.t - s.bossSince) / DAY_LEN)))) : esc(t('sel.member'))) +
    s.boss.parts.map((v, i) => row(esc(t('sel.bossPts', tr('boss.aspects')[i])), Math.round(v * 100))).join('') +
    row(t('sel.bossTotal'), Math.round(s.boss.total * 100)) +
    '</table>' + sub(esc(t('sel.diary'))) +
    (s.diary.length ? '<table>' + s.diary.map(([d2, k, par]) => `<tr><td class="l muted" style="white-space:nowrap;padding-right:8px">${esc(tDay(d2))}</td><td class="l">${esc(tDiary(k, par))}</td></tr>`).join('') + '</table>' : `<div class="muted">${esc(t('sel.diary0'))}</div>`));
  drawBrain(s.brain);
}

/* ---------- brain graph ---------- */
function drawBrain(g) {
  const c = $('brain'), x = c.getContext('2d'), W = c.width, H = c.height;
  x.clearRect(0, 0, W, H);
  brainPts = [];
  if (!g) return;
  const ins = g.nodes.filter(n => n.k === 'in'), outs = g.nodes.filter(n => n.k === 'out'), hid = g.nodes.filter(n => n.k === 'hid').sort((p, q) => p.d - q.d || p.i - q.i);
  const pos = new Map();
  const col = (list, xf, label) => list.forEach((n, i) => { pos.set(n.i, [xf(n, i), 14 + (H - 28) * (i + 0.5) / list.length]); });
  col(ins, () => 16);
  col(outs, () => W - 16);
  col(hid, (n, i) => W * (0.22 + 0.56 * clamp(n.d, 0, 1)) + ((i % 3) - 1) * 10);
  x.lineWidth = 1;
  for (const [s, tg, w] of g.conns) {
    const a = pos.get(s), bb = pos.get(tg);
    if (!a || !bb) continue;
    const m = Math.min(1, Math.abs(w) / 2);
    x.strokeStyle = w >= 0 ? `rgba(111,207,106,${0.06 + 0.5 * m})` : `rgba(224,100,90,${0.06 + 0.5 * m})`;
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(bb[0], bb[1]); x.stroke();
  }
  for (const n of g.nodes) {
    const p = pos.get(n.i);
    if (!p) continue;
    const v = clamp(Math.abs(n.v), 0, 1), r = n.k === 'hid' ? 4 : n.k === 'out' ? 4 : 2.5;
    x.fillStyle = n.v >= 0 ? `rgb(${60 + 140 * v | 0},${110 + 100 * v | 0},${70 + 40 * v | 0})` : `rgb(${110 + 110 * v | 0},${70 + 20 * v | 0},${70 + 20 * v | 0})`;
    x.beginPath(); x.arc(p[0], p[1], r, 0, TAU); x.fill();
    x.strokeStyle = '#0f1317'; x.stroke();
    brainPts.push([p[0], p[1], n]);
  }
  x.fillStyle = '#8a96a3';
  x.font = '11px system-ui, sans-serif';
  x.textAlign = 'right';
  for (const n of outs) { const p = pos.get(n.i); x.fillText(inName(n.i), p[0] - 8, p[1] + 4); }
}

/* ---------- small history chart and minimap ---------- */
function drawChart(hs) {
  const w = chart.width, h = chart.height;
  cctx.clearRect(0, 0, w, h);
  cctx.fillStyle = 'rgba(255,255,255,.07)';
  for (let i = 1; i < 4; i++) cctx.fillRect(0, (h * i / 4) | 0, w, 1);
  if (!hs || hs.length < 2) return;
  let max = 1;
  for (const r of hs) max = Math.max(max, r[0], r[1]);
  $('chartMax').textContent = 'max ' + Math.round(max);
  const n = hs.length;
  for (const [idx, col, sc] of [[2, '#9fd8ff', v => v], [1, '#e0645a', v => v / max], [0, '#6fcf6a', v => v / max]]) {
    let prev = null;
    for (let x = 0; x < w; x++) {
      const y = rp(h - 1 - sc(hs[rp(x / (w - 1) * (n - 1))][idx]) * (h - 3));
      if (idx === 0) { cctx.fillStyle = 'rgba(111,207,106,.16)'; cctx.fillRect(x, y, 1, h - y); }
      cctx.fillStyle = col;
      const y0 = prev === null ? y : prev;
      cctx.fillRect(x, Math.min(y, y0), 1, Math.abs(y - y0) + 1);
      prev = y;
    }
  }
}
function drawMini(m) {
  if (!miniBase || activeTab !== 'world') return;
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(miniBase, 0, 0, mini.width, mini.height);
  const sx = mini.width / WORLD_W, sy = mini.height / WORLD_H;
  const cols = ['#c8ffb0', '#ff6a5a', '#ffffff', '#ffd84a', '#ff6fa8'];
  for (let i = 0; i + 3 <= m.length; i += 3) {
    const tp = m[i + 2], s = tp >= 3 ? 3 : 2;
    mctx.fillStyle = cols[tp] || cols[0];
    mctx.fillRect((m[i] * sx) | 0, (m[i + 1] * sy) | 0, s, s);
  }
  const { ox, oy, vw, vh } = viewRect();
  mctx.strokeStyle = '#ffffff';
  mctx.lineWidth = 1;
  mctx.strokeRect((ox * sx | 0) + 0.5, (oy * sy | 0) + 0.5, Math.max(2, vw * sx | 0), Math.max(2, vh * sy | 0));
}

/* ---------- time series (uPlot) and phylogeny (d3-hierarchy) ---------- */
function parseSeries(j) {
  const cols = j.cols, data = {};
  cols.forEach(c => { data[c] = []; });
  for (const r of j.rows) cols.forEach((c, i) => { data[c].push(c === 'knock' ? 0 : parseFloat(r[i])); });
  return data;
}
function drawSeries() {
  if (!seriesData || typeof uPlot === 'undefined') return;
  const set = $('chartSet').value || 'pop', cols = SERIES_SETS[set] || SERIES_SETS.pop;
  const x = seriesData.t, ys = cols.map(c => seriesData[c] || []);
  if (!x || x.length < 2) return;
  if (!upl || uplSet !== set) {
    if (upl) upl.destroy();
    uplSet = set;
    const own = set !== 'pop';
    const names = tr('cols');
    const series = [{ label: names.t }].concat(cols.map((c, i) => ({ label: names[c] || c, stroke: LINE_COL[i % LINE_COL.length], width: 1.5, scale: own ? c : 'y', points: { show: false } })));
    const scales = { x: { time: false } };
    if (own) cols.forEach(c => { scales[c] = {}; }); else scales.y = {};
    const axisCol = '#8a96a3', grid = { stroke: 'rgba(255,255,255,.06)', width: 1 };
    upl = new uPlot({
      width: Math.max(260, $('uplot').clientWidth || 380), height: 220, scales, series, legend: { live: true },
      axes: [{ stroke: axisCol, grid, ticks: { stroke: axisCol } }, { scale: own ? cols[0] : 'y', stroke: axisCol, grid, ticks: { stroke: axisCol }, size: 46 }],
      cursor: { drag: { x: false, y: false } }
    }, [x].concat(ys), $('uplot'));
    $('chartNote').style.display = own ? 'block' : 'none';
  } else upl.setData([x].concat(ys));
}
function drawPhylo(list) {
  const el = $('phylo');
  if (!list.length || typeof d3 === 'undefined') { setHtml(el, ''); return; }
  const byId = new Map(list.map(n => [n.id, { ...n, children: [] }]));
  const root = { id: -1, name: '', children: [], hue: 0, maxN: 0, died: -1, carn: false };
  for (const n of byId.values()) { const par = byId.get(n.parent); (par && par !== n ? par : root).children.push(n); }
  const h = d3.hierarchy(root);
  const leaves = h.leaves().length, depth = h.height;
  const dx = 18, dy = 120, wpx = (depth + 1) * dy + 140, hpx = Math.max(60, leaves * dx + 20);
  d3.tree().nodeSize([dx, dy])(h);
  let y0 = Infinity;
  h.each(n => { y0 = Math.min(y0, n.x); });
  let svg = `<svg viewBox="0 0 ${wpx} ${hpx}" width="${wpx}" height="${hpx}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif" font-size="11">`;
  const X = n => n.y + 10, Y = n => n.x - y0 + 12;
  h.links().forEach(l => {
    if (l.source.data.id === -1) return;
    svg += `<path d="M${X(l.source)},${Y(l.source)}H${(X(l.source) + X(l.target)) / 2}V${Y(l.target)}H${X(l.target)}" fill="none" stroke="#46535f" stroke-width="1.5"/>`;
  });
  h.each(n => {
    const d = n.data;
    if (d.id === -1) return;
    const dead = d.died >= 0;
    svg += `<circle cx="${X(n)}" cy="${Y(n)}" r="${3 + Math.min(5, Math.sqrt(d.maxN) / 2)}" fill="${dead ? '#59626b' : `hsl(${+d.hue || 0},58%,52%)`}" stroke="${d.carn ? '#e0645a' : '#141912'}" stroke-width="1.5"/>`;
    svg += `<text x="${X(n) + 9}" y="${Y(n) + 4}" fill="${dead ? '#6b7682' : '#d9e0e7'}">${esc(d.name)} (${d.maxN})</text>`;
  });
  svg += '</svg>';
  setHtml(el, svg);
}

/* ---------- laboratory (second worker with its own wasm instance) ---------- */
function labMessage(m) {
  switch (m.type) {
    case 'labReady': labGo(); break;
    case 'labProgress': $('labBar').style.width = Math.round(m.done / Math.max(1, m.steps) * 100) + '%'; $('labState').textContent = t('lab.progress', m.done, m.steps); break;
    case 'labResult': labDone(m.res); break;
    case 'fatal': $('labState').textContent = m.msg; labEnd(); break;
  }
}
let labCfg = null;
function labStart() {
  if (typeof Worker === 'undefined' || mode === 'main') { $('labState').textContent = t('lab.noWorker'); return; }
  labCfg = { knock: $('labKnock').value, reps: +$('labReps').value || 3, steps: +$('labSteps').value || 3000, seed: +$('labSeed').value || 1 };
  $('btnLab').disabled = true; $('btnLabStop').disabled = false; $('btnLabCsv').disabled = true;
  $('labOut').innerHTML = ''; $('labBar').style.width = '0';
  try {
    labWorker = new Worker(URL.createObjectURL(new Blob([$('worker-src').textContent], { type: 'text/javascript' })));
    labWorker.onmessage = e => labMessage(e.data);
    labWorker.onerror = () => { $('labState').textContent = t('lab.noWorker'); labEnd(); };
    const w = wasmBuffer();
    labWorker.postMessage({ type: 'boot', role: 'lab', wasm: w }, [w]);
  } catch (e) { $('labState').textContent = t('lab.noWorker'); labEnd(); }
}
function labGo() { labWorker.postMessage({ type: 'labStart', ...labCfg }); }
function labEnd() {
  if (labWorker) { labWorker.terminate(); labWorker = null; }
  $('btnLab').disabled = false; $('btnLabStop').disabled = true;
}
function labDone(res) {
  lastLab = res;
  labEnd();
  $('btnLabCsv').disabled = false;
  $('labBar').style.width = '100%';
  $('labState').textContent = t('lab.done', tr('knocks')[res.knock] || res.knock, res.reps, res.steps);
  const mn = tr('labMetrics');
  $('labOut').innerHTML = `<table><tr><th>${esc(t('lab.metric'))}</th><th style="text-align:right">${esc(t('lab.ctrl'))}</th><th style="text-align:right">${esc(t('lab.trt'))}</th><th style="text-align:right">${esc(t('lab.p'))}</th></tr>` +
    res.results.map(r => `<tr><td>${esc(mn[r.metric] || r.metric)}</td><td>${r.meanC.toFixed(2)} (${r.sdC.toFixed(2)})</td><td>${r.meanT.toFixed(2)} (${r.sdT.toFixed(2)})</td><td class="${r.p < 0.05 ? 'done' : 'muted'}" title="${esc(r.p < 0.05 ? t('lab.sig') : t('lab.ns'))}">${r.p.toFixed(3)}${r.p < 0.05 ? ' *' : ''}</td></tr>`).join('') + '</table>';
}

/* ---------- messages from the worker ---------- */
function receive(m) {
  switch (m.type) {
    case 'init': {
      gotInit = true;
      prepareGraphics(m);
      selId = 0; centered = false; frame = null; lastView = '';
      sendHost({ type: 'select', id: 0 });
      tzWhenLoaded().then(tzReconcile);
      if (m.fresh && !welcomeOk) {
        let seen = false;
        try { seen = localStorage.getItem('wildlinge-welcome') === '1'; } catch (e) { /* storage blocked */ }
        if (!seen) { if (serverMode) $('welcomeNote').textContent = t('welcome.noteSrv'); $('welcome').style.display = 'flex'; }
      }
      break;
    }
    case 'frame': {
      if (serverMode) prepInterp(m);
      frame = m;
      if (showBubbles) for (const q of m.meta.bub || []) bubbles.push({ x: q.x, y: q.y, text: q.kind === 2 ? tBody(q.text) : q.text, kind: q.kind, until: performance.now() + (q.kind === 2 ? 1100 : 1600) });
      if (bubbles.length > 90) bubbles.splice(0, bubbles.length - 90);
      if (!centered && m.cs.length >= CS_STRIDE) { centered = true; cam.x = m.cs[1]; cam.y = m.cs[2]; }
      break;
    }
    case 'panel': panel = JSON.parse(m.json); if (serverMode) srvSeen(panel); if (panel.sel) selId = panel.sel.id; else if (selId && !panel.sel) selId = 0; renderPanel(panel); break;
    case 'sel':
      selId = m.id;
      if (carryWait) { carryWait = false; if (m.id) { carryId = m.id; toast(t('t.carryPick')); } else toast(t('t.miss')); break; }
      if (m.id) setTab('creature');
      break;
    case 'kraft': showKraft(m); break;
    case 'persist': persist(m); break;
    case 'tres': tzResolve(m); break;
    case 'toast': toast(tToast(m.o)); break;
    case 'progress': $('clock').textContent = t('app.away', m.pct); break;
    case 'error': toast(t(m.k, m.msg)); break;
    case 'fatal': $('clock').textContent = m.msg; break;
    case 'series': seriesData = parseSeries(JSON.parse(m.json)); if (activeTab === 'research') drawSeries(); break;
    case 'download': saveFile(m.name, m.mime, m.text); break;
    case 'away': showAway(m.rep); break;
  }
}
let srvSeenDone = false, srvSeenAt = 0;
function srvSeen(p) {
  const key = 'plimploms-seen';
  if (!srvSeenDone) {
    srvSeenDone = true;
    try {
      const o = JSON.parse(localStorage.getItem(key) || 'null');
      if (o && o.seed === p.seed && p.t > o.t + DAY_LEN * 0.5) {
        const evs = (p.events || []).filter(e => e[3] > o.t).slice(0, 30);
        showAway({ days: Math.floor((p.t - o.t) / DAY_LEN), births: Math.max(0, p.stats.births - o.b), deaths: Math.max(0, p.stats.deaths - o.d), events: evs, lost: [], adopted: p.adopted || [] });
      }
    } catch (e) { /* storage blocked */ }
  }
  const now = Date.now();
  if (now - srvSeenAt > 15000) {
    srvSeenAt = now;
    try { localStorage.setItem(key, JSON.stringify({ seed: p.seed, t: p.t, b: p.stats.births, d: p.stats.deaths })); } catch (e) { /* storage blocked */ }
  }
}
function showAway(rep) {
  if (!rep || rep.days === undefined) return;
  const ev = (rep.events || []).map(([d2, k, par]) => `<li><span class="muted">${esc(tDay(d2))}</span> ${esc(tEvent(k, par))}</li>`).join('');
  $('awayBody').innerHTML =
    `<p>${esc(t('away.p', rep.days, rep.births, rep.deaths))}</p>` +
    (rep.lost.length ? `<p><b>${esc(t('away.lost'))}</b> ${rep.lost.map(l => `${esc(l.name)} (${esc(tCause(l.cause))})`).join(', ')}</p>` : '') +
    (rep.adopted.length ? `<p><b>${esc(t('away.alive'))}</b> ${rep.adopted.map(a => esc(a.name)).join(', ')}</p>` : '') +
    (ev ? `<p><b>${esc(t('away.events'))}</b></p><ul>${ev}</ul>` : '');
  $('away').style.display = 'flex';
}
async function persist(m) {
  try {
    await idbDo('readwrite', st => st.put(m.data, SAVE_KEY));
    $('saveState').textContent = t('app.saved', new Date().toTimeString().slice(0, 8), (m.bytes / 1048576).toFixed(1));
  } catch (e) {
    $('saveState').textContent = t('app.saveFail', e && e.message || e);
  }
}

/* ---------- start ---------- */
function useMainThread() {
  mode = 'main';
  if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } worker = null; }
  hostPost = msg => setTimeout(() => receive(msg), 0);
  sendHost = msg => { hostHandle(msg); };
}
/* ---------- shared server mode ---------- */
function srvToken() {
  try {
    let tk = localStorage.getItem('wildlinge-token');
    if (!tk || !/^[A-Za-z0-9_-]{16,64}$/.test(tk)) {
      const a = new Uint8Array(24); crypto.getRandomValues(a);
      tk = Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('wildlinge-token', tk);
    }
    return tk;
  } catch (e) {
    if (!window.__wlTok) { const a = new Uint8Array(24); crypto.getRandomValues(a); window.__wlTok = Array.from(a, x => x.toString(16).padStart(2, '0')).join(''); }
    return window.__wlTok;
  }
}
const SRV_SEND = new Set(['view', 'select', 'pick', 'action', 'move', 'tcmd', 'series', 'hidden']);
function srvSend(msg) {
  if (!srvWs || srvWs.readyState !== 1 || !SRV_SEND.has(msg.type)) return;
  srvWs.send(JSON.stringify(msg));
}
async function inflate(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'));
  return await new Response(s).arrayBuffer();
}
async function srvIn(d) {
  if (typeof d === 'string') { receive(JSON.parse(d)); return; }
  const u8 = new Uint8Array(d), kind = u8[0], dv = new DataView(d);
  if (kind === 1) {
    const hl = dv.getUint32(1, true), cn = dv.getUint32(5, true), fn = dv.getUint32(9, true);
    const raw = await inflate(u8.subarray(13));
    const m = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 0, hl)));
    m.cs = new Float32Array(raw.slice(hl, hl + cn * 4));
    m.foods = new Float32Array(raw.slice(hl + cn * 4, hl + cn * 4 + fn * 4));
    receive(m);
  } else if (kind === 2) {
    const hl = dv.getUint32(1, true);
    const m = JSON.parse(new TextDecoder().decode(u8.subarray(5, 5 + hl)));
    m.bio = u8.slice(5 + hl);
    m.fresh = true;
    receive(m);
  } else if (kind === 3) {
    const raw = await inflate(u8.subarray(1));
    receive(JSON.parse(new TextDecoder().decode(raw)));
  }
}
function trySrv() {
  if (!/^https?:$/.test(location.protocol) || typeof DecompressionStream === 'undefined' || typeof WebSocket === 'undefined') return Promise.resolve(false);
  return new Promise(res => {
    let opened = false, done = false;
    const fin = v => { if (!done) { done = true; res(v); } };
    let ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { fin(false); return; }
    ws.binaryType = 'arraybuffer';
    const tm = setTimeout(() => { if (!opened) { try { ws.close(); } catch (e) { /* ignore */ } fin(false); } }, 3500);
    ws.onopen = () => {
      opened = true; clearTimeout(tm);
      srvWs = ws; sendHost = srvSend; serverMode = true;
      ws.send(JSON.stringify({ type: 'hello', token: srvToken() }));
      for (const id of ['btnExport', 'btnImport', 'btnReset', 'btnRun', 'speed']) { const el = $(id); const l = el && (el.closest('label') || el); if (l) l.style.display = 'none'; }
      $('saveState').textContent = t('srv.state');
      fin(true);
    };
    ws.onmessage = e => { srvChain = srvChain.then(() => srvIn(e.data)).catch(() => {}); };
    ws.onerror = () => fin(false);
    ws.onclose = () => {
      if (!opened) { fin(false); return; }
      $('clock').textContent = t('srv.lost');
      srvRetry = setTimeout(() => location.reload(), 5000);
    };
  });
}
document.addEventListener('visibilitychange', () => { if (serverMode) sendHost({ type: 'hidden', v: document.hidden }); });
function showKraft(m) {
  const el = $('kraft');
  el.style.display = 'inline';
  el.textContent = t('srv.kraft', Math.round(m.v), Math.round(m.max), m.online);
}
function prepInterp(m) {
  const now = performance.now();
  if (srvAt) srvMs = clamp(srvMs * 0.7 + (now - srvAt) * 0.3, 60, 400);
  srvAt = now;
  const n = m.cs.length / CS_STRIDE, fx = new Float32Array(n), fy = new Float32Array(n), prev = new Map(), old = frame;
  if (old && old.tx) for (let i = 0; i < old.tx.length; i++) prev.set(old.ids[i], i);
  m.ids = new Float32Array(n); m.tx = new Float32Array(n); m.ty = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * CS_STRIDE; m.ids[i] = m.cs[o]; m.tx[i] = m.cs[o + 1]; m.ty[i] = m.cs[o + 2];
    const j = prev.get(m.cs[o]);
    if (j !== undefined && Math.abs(old.tx[j] - m.tx[i]) < 150 && Math.abs(old.ty[j] - m.ty[i]) < 150) { fx[i] = old.tx[j]; fy[i] = old.ty[j]; } else { fx[i] = m.tx[i]; fy[i] = m.ty[i]; }
  }
  m.fx = fx; m.fy = fy; m.at = now;
}
function lerpFrame(fr) {
  if (!fr.fx) return;
  const k = clamp((performance.now() - fr.at) / srvMs, 0, 1), cs = fr.cs, n = fr.fx.length;
  for (let i = 0; i < n; i++) { const o = i * CS_STRIDE; cs[o + 1] = fr.fx[i] + (fr.tx[i] - fr.fx[i]) * k; cs[o + 2] = fr.fy[i] + (fr.ty[i] - fr.fy[i]) * k; }
}

async function startApp() {
  if (typeof WebAssembly === 'undefined') { $('clock').textContent = t('app.noWasm'); return; }
  let saved = null;
  try { saved = await idbDo('readonly', st => st.get(SAVE_KEY)); } catch (e) { $('saveState').textContent = t('app.noStorage'); }
  const online = /^https?:$/.test(location.protocol) && !/[#?&]offline\b/.test(location.href);
  for (;;) {
    if (await trySrv()) { serverMode = true; requestAnimationFrame(render); return; }
    if (!online) break;
    $('clock').textContent = t('srv.down');
    await new Promise(r => setTimeout(r, 4000));
  }
  const bootMsg = () => ({ type: 'boot', role: 'sim', wasm: wasmBuffer(), save: saved || null });
  try {
    worker = new Worker(URL.createObjectURL(new Blob([$('worker-src').textContent], { type: 'text/javascript' })));
    worker.onmessage = e => receive(e.data);
    worker.onerror = () => { if (!gotInit) { useMainThread(); const m = bootMsg(); sendHost(m); } };
    sendHost = msg => worker.postMessage(msg);
    const m = bootMsg();
    worker.postMessage(m, [m.wasm]);
  } catch (e) {
    useMainThread();
    sendHost(bootMsg());
  }
  try { welcomeOk = !!saved; } catch (e) { /* ignore */ }
  requestAnimationFrame(render);
}

/* ---------- input ---------- */
function screenToWorld(e) {
  const r = cv.getBoundingClientRect(), { wpp, ox, oy } = viewRect();
  return [ox + (e.clientX - r.left) * VIEW_W / r.width / S * wpp, oy + (e.clientY - r.top) * VIEW_H / r.height / S * wpp];
}
function zoomAt(dz, wx, wy) {
  const nz = clamp(cam.zi + dz, 0, ZOOMS.length - 1);
  if (nz === cam.zi) return;
  const before = ZOOMS[cam.zi], after = ZOOMS[nz];
  if (wx !== undefined) { cam.x = wx + (cam.x - wx) * after / before; cam.y = wy + (cam.y - wy) * after / before; }
  cam.zi = nz;
}
const tokensFromInput = () => $('wordIn').value.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-zäöü]/g, '').slice(0, 12)).filter(Boolean).slice(0, 3);
function setTool(name) {
  tool = name;
  for (const bt of document.querySelectorAll('#tools button')) bt.classList.toggle('on', bt.dataset.tool === name);
  cv.classList.toggle('tool', name !== 'select');
  if ((name === 'say' || name === 'teach') && !tokensFromInput().length) { $('wordIn').focus(); toast(t('app.wordFirst')); }
}
function setTab(name) {
  activeTab = name;
  for (const bt of document.querySelectorAll('#tabs button')) bt.classList.toggle('on', bt.dataset.tab === name);
  for (const pg of document.querySelectorAll('.page')) pg.classList.toggle('on', pg.id === 'page-' + name);
  if (name === 'research') { lastSeriesAt = 0; phyloSig = ''; upl = null; uplSet = ''; }
  if (panel) renderPanel(panel);
  if (name === 'research' && seriesData) drawSeries();
}
let drag = null;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 5) { drag.moved = true; cv.classList.add('drag'); if (follow) { follow = false; $('follow').checked = false; } }
  if (drag.moved) {
    const r = cv.getBoundingClientRect(), k = VIEW_W / r.width / S * ZOOMS[cam.zi];
    cam.x = drag.cx - dx * k; cam.y = drag.cy - dy * k;
  }
});
cv.addEventListener('pointerup', e => {
  const wasDrag = drag && drag.moved;
  drag = null;
  cv.classList.remove('drag');
  if (wasDrag) return;
  const [x, y] = screenToWorld(e), r = 8 * ZOOMS[cam.zi];
  if (tool === 'select') { sendHost({ type: 'pick', x, y, r }); return; }
  if (tool === 'carry') {
    if (!carryId) { carryWait = true; sendHost({ type: 'pick', x, y, r }); } else { sendHost({ type: 'move', id: carryId, x, y }); carryId = 0; }
    return;
  }
  const tokens = tokensFromInput();
  if ((tool === 'say' || tool === 'teach') && !tokens.length) { toast(t('app.wordFirst')); $('wordIn').focus(); return; }
  sendHost({ type: 'action', tool, x, y, r, tokens });
});
cv.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = screenToWorld(e); zoomAt(e.deltaY < 0 ? 1 : -1, x, y); }, { passive: false });
window.addEventListener('keydown', e => {
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT')) return;
  const step = 60 * ZOOMS[cam.zi], tools = ['select', 'stroke', 'scold', 'teach', 'say', 'food', 'mirror', 'carry'];
  if (e.key >= '1' && e.key <= '8') setTool(tools[+e.key - 1]);
  else if (e.key === 'ArrowLeft') cam.x -= step;
  else if (e.key === 'ArrowRight') cam.x += step;
  else if (e.key === 'ArrowUp') cam.y -= step;
  else if (e.key === 'ArrowDown') cam.y += step;
  else if (e.key === '+') zoomAt(1);
  else if (e.key === '-') zoomAt(-1);
  else return;
  e.preventDefault();
});
function miniJump(e) {
  const r = mini.getBoundingClientRect();
  cam.x = (e.clientX - r.left) / r.width * WORLD_W;
  cam.y = (e.clientY - r.top) / r.height * WORLD_H;
  follow = false; $('follow').checked = false;
}
mini.addEventListener('pointerdown', e => { miniJump(e); mini.setPointerCapture(e.pointerId); mini.onpointermove = miniJump; });
mini.addEventListener('pointerup', () => { mini.onpointermove = null; });
$('brain').addEventListener('mousemove', e => {
  const c = $('brain'), r = c.getBoundingClientRect(), px = (e.clientX - r.left) * c.width / r.width, py = (e.clientY - r.top) * c.height / r.height;
  let best = null, bd = 100;
  for (const [x, y, n] of brainPts) { const d = (x - px) ** 2 + (y - py) ** 2; if (d < bd) { bd = d; best = n; } }
  $('brainTip').textContent = best ? `${inName(best.i)}: ${best.v.toFixed(2)}` : '';
});
for (const bt of document.querySelectorAll('#tools button')) bt.onclick = () => setTool(bt.dataset.tool);
for (const bt of document.querySelectorAll('#tabs button')) bt.onclick = () => setTab(bt.dataset.tab);

document.addEventListener('click', e => {
  const a = e.target.closest('a.w');
  if (a && !a.getAttribute('href')) {
    e.preventDefault();
    if (a.dataset.id) {
      selId = +a.dataset.id;
      sendHost({ type: 'select', id: selId });
      if (a.dataset.focus || a.closest('#species')) { follow = true; $('follow').checked = true; }
      setTab('creature');
    } else if (a.dataset.w) {
      const inp = $('wordIn'), cur = inp.value.trim().split(/\s+/).filter(Boolean);
      if (cur.length >= 3) cur.length = 0;
      cur.push(a.dataset.w);
      inp.value = cur.join(' ');
    }
  }
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.knock;
  if (k) sendHost({ type: 'knock', key: k, v: e.target.checked });
});
$('btnAdopt').onclick = () => { if (panel && panel.sel) tzAdopt(panel.sel.id); };
$('btnRename').onclick = () => { const n = $('renameIn').value; if (panel && panel.sel && n.trim()) { sendHost({ type: 'adopt', id: panel.sel.id, name: n }); $('renameIn').value = ''; } };
$('btnPyphi').onclick = () => { if (selId) sendHost({ type: 'pyphi' }); };
$('btnCsv').onclick = () => sendHost({ type: 'csv' });
$('btnNewick').onclick = () => sendHost({ type: 'newick' });
$('btnRun').onclick = () => { running = !running; $('btnRun').textContent = t(running ? 'btn.pause' : 'btn.run'); sendHost({ type: 'run', v: running }); };
$('btnZoomIn').onclick = () => zoomAt(1);
$('btnZoomOut').onclick = () => zoomAt(-1);
$('btnExport').onclick = () => sendHost({ type: 'export' });
$('btnReset').onclick = async () => {
  if (!confirm(t('app.newWorld'))) return;
  try { await idbDo('readwrite', st => st.delete(SAVE_KEY)); } catch (e) { /* ignore */ }
  sendHost({ type: 'reset' });
};
$('btnImport').onclick = () => $('fileImport').click();
$('fileImport').onchange = e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > 100e6) { toast(t('app.tooBig')); return; }
  f.arrayBuffer().then(buf => sendHost({ type: 'import', data: buf })).catch(err => toast(t('app.importFail', err.message)));
};
$('speed').oninput = e => { const v = +e.target.value; $('speedVal').textContent = v + 'x'; sendHost({ type: 'speed', v }); };
$('follow').onchange = e => { follow = e.target.checked; };
$('showSense').onchange = e => { showSense = e.target.checked; };
$('styleSel').value = crStyle;
$('styleSel').onchange = e => { crSetStyle(e.target.value); };
$('showBubbles').onchange = e => { showBubbles = e.target.checked; if (!showBubbles) bubbles = []; };
$('showMeaning').onchange = e => { showMeaning = e.target.checked; if (panel) renderPanel(panel); };
$('chartSet').onchange = () => { upl = null; drawSeries(); };
$('langSel').onchange = e => { setLang(e.target.value); applyI18n(); };
$('btnLab').onclick = labStart;
$('btnLabStop').onclick = () => { labEnd(); $('labState').textContent = ''; };
$('btnLabCsv').onclick = () => {
  if (!lastLab) return;
  const head = 'metric;meanControl;sdControl;meanTreated;sdTreated;t;df;p';
  const rows = lastLab.results.map(r => [r.metric, r.meanC, r.sdC, r.meanT, r.sdT, r.t, r.df, r.p].join(';'));
  saveFile(`wildlinge-lab-${lastLab.knock}.csv`, 'text/csv', [head].concat(rows).join('\n') + '\n');
};
$('welcomeOk').onclick = () => { $('welcome').style.display = 'none'; try { localStorage.setItem('wildlinge-welcome', '1'); } catch (e) { /* ignore */ } };
$('awayOk').onclick = () => { $('away').style.display = 'none'; };
$('bmc').href = $('bmc2').href = BMC_URL;
window.addEventListener('beforeunload', () => sendHost({ type: 'save' }));
document.addEventListener('visibilitychange', () => { if (document.hidden) sendHost({ type: 'save' }); });

function setViewMode(m) {
  viewMode = m;
  $('world').style.display = m === 'wild' ? 'block' : 'none';
  $('terra').style.display = m === 'terra' ? 'block' : 'none';
  $('tools').style.display = m === 'wild' ? 'flex' : 'none';
  $('ttools').style.display = m === 'terra' ? 'flex' : 'none';
  if (m === 'wild') $('help').textContent = t('help.keys'); else tzSetTool(TZ.tool);
  $('modeWild').classList.toggle('on', m === 'wild');
  $('modeTerra').classList.toggle('on', m === 'terra');
  if (m === 'terra') setTab('terra'); else if (activeTab === 'terra') setTab('world');
}
function tzWhenLoaded() { return new Promise(res => { const f = () => (TZ.loaded ? res() : setTimeout(f, 30)); f(); }); }
$('btnShot').onclick = () => {
  const cv = $(viewMode === 'wild' ? 'world' : 'terra');
  cv.toBlob(bl => {
    if (!bl) return;
    const a = document.createElement('a'), u = URL.createObjectURL(bl);
    a.href = u; a.download = 'wildlinge-' + viewMode + '-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  }, 'image/png');
};
let clipBusy = false;
$('btnClip').onclick = () => {
  const cv = $(viewMode === 'wild' ? 'world' : 'terra');
  if (clipBusy) return;
  if (typeof MediaRecorder === 'undefined' || !cv.captureStream) { toast(t('clip.na')); return; }
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) { toast(t('clip.na')); return; }
  clipBusy = true;
  const rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 4000000 }), parts = [], btn = $('btnClip');
  let left = 10;
  const tick = setInterval(() => { left--; btn.textContent = t('clip.rec', left); }, 1000);
  btn.textContent = t('clip.rec', left);
  rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
  rec.onstop = () => {
    clearInterval(tick); clipBusy = false; btn.textContent = t('btn.clip');
    const bl = new Blob(parts, { type: mime }), a = document.createElement('a'), u = URL.createObjectURL(bl);
    a.href = u; a.download = 'plimploms-' + viewMode + '-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + (mime.startsWith('video/mp4') ? '.mp4' : '.webm');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  rec.start(); setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, 10000);
};
$('modeWild').onclick = () => setViewMode('wild');
$('modeTerra').onclick = () => setViewMode('terra');
document.addEventListener('click', e => {
  const a = e.target.closest('a.w');
  if (a && a.dataset.tz) { e.preventDefault(); TZ.sel = +a.dataset.tz; tzPanel(true); }
});
window.addEventListener('keydown', e => {
  if (viewMode !== 'terra') return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT')) return;
  const k = e.key === '0' ? 9 : (e.key >= '1' && e.key <= '9' ? +e.key - 1 : -1);
  if (k >= 0 && TZ_TOOLS[k]) { tzSetTool(TZ_TOOLS[k]); e.stopImmediatePropagation(); }
}, true);
applyI18n();
tzInit();
startApp();
