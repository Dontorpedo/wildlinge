'use strict';
/* Wildlinge host: runs the WebAssembly core, either inside a Web Worker or (fallback) on the main thread.
   Roles: 'sim' runs the persistent world, 'lab' runs controlled experiments. */
const WH = { YEAR_LEN: 6000, DAY_LEN: 400, WORLD_W: 4000, WORLD_H: 2400 };
let hostPost = () => {};
const H = {
  E: null, role: 'sim', running: true, speed: 1, acc: 0, sel: 0, tickN: 0, stepMs: 0,
  view: { x0: 0, y0: 0, x1: 1600, y1: 800, wpp: 2.5 }, lastPanel: 0, lastSave: 0, timer: null, lab: null, booted: false
};
const enc = new TextEncoder(), dec = new TextDecoder();
const num = (v, a, b, d) => { const x = +v; return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d; };

function out() { const E = H.E; return dec.decode(new Uint8Array(E.memory.buffer, E.wl_out_ptr(), E.wl_out_len())); }
function withStr(s, fn) {
  const E = H.E, b = enc.encode(s), p = E.wl_alloc(b.length);
  new Uint8Array(E.memory.buffer, p, b.length).set(b);
  try { return fn(p, b.length); } finally { E.wl_dealloc(p, b.length); }
}
function outBytes() { const E = H.E; return new Uint8Array(E.memory.buffer, E.wl_out_ptr(), E.wl_out_len()).slice(); }
function postInit(fresh) {
  H.E.wl_map();
  const bio = outBytes();
  hostPost({ type: 'init', seed: H.E.wl_seed(), fresh, bio }, [bio.buffer]);
}
function buf(k) { const E = H.E; return new Float32Array(E.memory.buffer, E.wl_buf_ptr(k), E.wl_buf_len(k)).slice(); }
function cmd(o) { return withStr(JSON.stringify(o), (p, n) => { H.E.wl_cmd(p, n); return JSON.parse(out()); }); }

async function gzip(str) {
  if (typeof CompressionStream === 'undefined') return str;
  const s = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
  return await new Response(s).arrayBuffer();
}
async function textOf(data) {
  if (data === null || data === undefined) return null;
  if (typeof data === 'string') return data;
  const u8 = new Uint8Array(data);
  if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('gzip not supported');
    const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(s).text();
  }
  return dec.decode(u8);
}

async function hostSave() {
  if (!H.E || H.role !== 'sim') return;
  try {
    H.E.wl_save(Date.now());
    const json = out(), data = await gzip(json);
    hostPost({ type: 'persist', data, bytes: json.length }, typeof data === 'string' ? [] : [data]);
  } catch (e) {
    hostPost({ type: 'error', k: 'app.saveFail', msg: String(e && e.message || e) });
  }
}
function loadText(text) {
  return withStr(text, (p, n) => {
    const r = H.E.wl_load(p, n), msg = out();
    if (r !== 0) throw new Error(msg);
    return JSON.parse(msg);
  });
}
function simulateAway(ms) {
  const target = Math.min(WH.YEAR_LEN, Math.floor(ms / 1000 * 20));
  if (target < 200) return;
  const E = H.E, start = performance.now();
  E.wl_away_begin();
  let n = 0;
  while (n < target && performance.now() - start < 15000) {
    E.wl_step(50); n += 50;
    if (n % 500 === 0) hostPost({ type: 'progress', pct: Math.round(n / target * 100) });
  }
  E.wl_away_report();
  hostPost({ type: 'away', rep: JSON.parse(out()) });
}
async function boot(msg) {
  H.role = msg.role === 'lab' ? 'lab' : 'sim';
  const { instance } = await WebAssembly.instantiate(msg.wasm, {});
  H.E = instance.exports;
  H.booted = true;
  if (H.role === 'lab') { hostPost({ type: 'labReady' }); return; }
  let info = null;
  if (msg.save) {
    try { info = loadText(await textOf(msg.save)); }
    catch (e) { hostPost({ type: 'error', k: 'app.loadFail', msg: String(e && e.message || e).slice(0, 200), keepOld: true }); info = null; }
  }
  if (!info) H.E.wl_new(num(msg.seed, 1, 4294967295, (Math.random() * 4294967295) >>> 0) >>> 0);
  postInit(!info);
  if (info && info.savedAt) simulateAway(Date.now() - info.savedAt);
  loop();
}
function postFrame() {
  const E = H.E, v = H.view;
  E.wl_frame(v.x0, v.y0, v.x1, v.y1, v.wpp, H.sel);
  const meta = JSON.parse(out()), cs = buf(0), foods = buf(1);
  hostPost({ type: 'frame', meta, cs, foods, running: H.running, stepMs: H.stepMs }, [cs.buffer, foods.buffer]);
}
function postPanel() {
  H.E.wl_panel(H.sel);
  hostPost({ type: 'panel', json: out() });
}
function loop() {
  if (H.timer) return;
  const tick = () => {
    const t0 = performance.now(), E = H.E;
    if (H.running) {
      H.acc += H.speed;
      let n = 0;
      while (H.acc >= 1 && performance.now() - t0 < 14) { E.wl_step(1); H.acc -= 1; n++; }
      if (H.acc > H.speed * 2) H.acc = 0;
      if (n) H.stepMs = H.stepMs * 0.9 + (performance.now() - t0) / n * 0.1;
    }
    H.tickN++;
    postFrame();
    const now = performance.now();
    if (now - H.lastPanel > 350) { H.lastPanel = now; postPanel(); }
    if (now - H.lastSave > 20000) { H.lastSave = now; hostSave(); }
    H.timer = setTimeout(tick, Math.max(1, 16 - (performance.now() - t0)));
  };
  tick();
}
function download(name, mime, text) { hostPost({ type: 'download', name, mime, text }); }

/* ---------- laboratory (separate instance) ---------- */
function labRun() {
  const L = H.lab;
  if (!L || L.stop) { H.lab = null; return; }
  const t0 = performance.now();
  let done = 0;
  while (performance.now() - t0 < 60) {
    done = H.E.wl_lab_step(10);
    if (done !== 0) break;
  }
  const prog = JSON.parse(out() || '{}');
  if (done === 1) {
    H.E.wl_lab_result();
    hostPost({ type: 'labResult', res: JSON.parse(out()) });
    H.lab = null;
    return;
  }
  if (done < 0) { H.lab = null; return; }
  hostPost({ type: 'labProgress', done: prog.done, steps: prog.steps });
  setTimeout(labRun, 0);
}

async function hostHandle(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'boot') {
    if (H.booted) return;
    try { await boot(msg); } catch (e) { hostPost({ type: 'fatal', msg: String(e && e.message || e) }); }
    return;
  }
  if (!H.E) return;
  const E = H.E;
  switch (msg.type) {
    case 'view': H.view = { x0: num(msg.x0, -1e4, 1e4, 0), y0: num(msg.y0, -1e4, 1e4, 0), x1: num(msg.x1, -1e4, 1e4, 0), y1: num(msg.y1, -1e4, 1e4, 0), wpp: num(msg.wpp, 0.5, 20, 2.5) }; break;
    case 'speed': H.speed = num(msg.v, 1, 60, 1); break;
    case 'run': H.running = !!msg.v; break;
    case 'select': H.sel = num(msg.id, 0, 4294967295, 0) >>> 0; H.lastPanel = 0; break;
    case 'pick': { const r = cmd({ type: 'pick', x: msg.x, y: msg.y, r: msg.r }); H.sel = r.sel >>> 0; H.lastPanel = 0; hostPost({ type: 'sel', id: H.sel }); break; }
    case 'action': {
      const r = cmd({ type: 'action', tool: String(msg.tool || ''), x: msg.x, y: msg.y, r: msg.r, tokens: Array.isArray(msg.tokens) ? msg.tokens.slice(0, 3).map(String) : [] });
      hostPost({ type: 'toast', o: r.toast }); H.lastPanel = 0; break;
    }
    case 'adopt': cmd({ type: 'adopt', id: msg.id >>> 0, on: msg.on === undefined ? undefined : !!msg.on, name: typeof msg.name === 'string' ? msg.name.slice(0, 40) : undefined }); H.lastPanel = 0; break;
    case 'tcmd': {
      const c = msg.c || {};
      if (['take', 'tlist', 'trename', 'tbreed', 'release', 'tdie', 'tteach'].includes(c.type)) {
        const res = cmd(c);
        hostPost({ type: 'tres', rid: msg.rid, res });
        H.lastPanel = 0;
        if (c.type !== 'tlist') H.lastSave = 0;
      } else hostPost({ type: 'tres', rid: msg.rid, res: {} });
      break;
    }
    case 'move': { const r = cmd({ type: 'move', id: num(msg.id, 0, 4294967295, 0) >>> 0, x: msg.x, y: msg.y }); hostPost({ type: 'toast', o: { k: r.ok ? 't.moved' : r.water ? 't.moveWater' : 't.miss', p: [] } }); break; }
    case 'knock': cmd({ type: 'knock', key: String(msg.key || ''), v: !!msg.v }); H.lastPanel = 0; break;
    case 'save': hostSave(); break;
    case 'export': E.wl_save(Date.now()); download(`wildlinge-${E.wl_seed()}-${E.wl_step(0)}.json`, 'application/json', out()); break;
    case 'csv': E.wl_csv(); download(`wildlinge-series-${E.wl_step(0)}.csv`, 'text/csv', out()); break;
    case 'newick': E.wl_newick(); download(`wildlinge-phylogeny-${E.wl_step(0)}.nwk`, 'text/plain', out()); break;
    case 'pyphi': E.wl_pyphi(H.sel); download(`wildlinge-pyphi-${H.sel}.json`, 'application/json', out()); break;
    case 'series': E.wl_series(num(msg.from, 0, 1e9, 0) >>> 0); hostPost({ type: 'series', json: out() }); break;
    case 'import':
      try {
        const text = await textOf(msg.data);
        if (!text || text.length > 120e6) throw new Error('size');
        loadText(text); H.sel = 0;
        postInit(false);
        hostSave();
      } catch (e) { hostPost({ type: 'error', k: 'app.importFail', msg: String(e && e.message || e).slice(0, 200) }); }
      break;
    case 'reset': E.wl_new((Math.random() * 4294967295) >>> 0); H.sel = 0; postInit(true); hostSave(); break;
    case 'labStart':
      if (H.role !== 'lab' || H.lab) break;
      withStr(JSON.stringify({ knock: String(msg.knock || 'self'), reps: num(msg.reps, 2, 8, 3) | 0, steps: num(msg.steps, 300, 30000, 3000) | 0, seed: num(msg.seed, 1, 4294967295, 1) >>> 0 }),
        (p, n) => E.wl_lab_start(p, n));
      H.lab = { stop: false };
      setTimeout(labRun, 0);
      break;
    case 'labStop': if (H.lab) H.lab.stop = true; break;
  }
}

if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
  hostPost = (m, tr) => self.postMessage(m, tr || []);
  self.onmessage = e => { hostHandle(e.data); };
}
