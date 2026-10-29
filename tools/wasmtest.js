// Node test of the WebAssembly core: node tools/wasmtest.js path/to/wildlinge_core.wasm [steps]
const fs = require('fs');
const file = process.argv[2], steps = +process.argv[3] || 6000;
(async () => {
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(file), {});
  const E = instance.exports, enc = new TextEncoder(), dec = new TextDecoder();
  const out = () => dec.decode(new Uint8Array(E.memory.buffer, E.wl_out_ptr(), E.wl_out_len()));
  const put = s => { const b = enc.encode(s), p = E.wl_alloc(b.length); new Uint8Array(E.memory.buffer, p, b.length).set(b); return [p, b.length]; };
  const cmd = o => { const [p, n] = put(JSON.stringify(o)); E.wl_cmd(p, n); E.wl_dealloc(p, n); return JSON.parse(out()); };
  let t0 = performance.now();
  E.wl_new(42);
  console.log('new world', (performance.now() - t0).toFixed(0), 'ms');
  t0 = performance.now();
  let last = t0;
  for (let i = 1; i <= steps; i++) {
    E.wl_step(1);
    if (i % 1500 === 0) {
      E.wl_panel(0);
      const p = JSON.parse(out());
      const now = performance.now();
      console.log(i, 'pop', p.pop, 'species', p.spCount, 'neurons', p.stats.neurons.toFixed(1), 'ms/step', ((now - last) / 1500).toFixed(2));
      last = now;
    }
  }
  console.log('avg ms/step', ((performance.now() - t0) / steps).toFixed(2));
  E.wl_frame(1000, 600, 2600, 1400, 2.5, 0);
  const meta = JSON.parse(out());
  console.log('frame creatures', E.wl_buf_len(0) / 90, 'foods', E.wl_buf_len(1) / 6, 'bubbles', meta.bub.length);
  E.wl_panel(0); const p = JSON.parse(out());
  const id = p.adopted.length ? p.adopted[0].id : null;
  const r = cmd({ type: 'pick', x: 2000, y: 1200, r: 2000 });
  console.log('pick', r);
  console.log('action', JSON.stringify(cmd({ type: 'action', tool: 'stroke', x: 2000, y: 1200, r: 2000, tokens: [] })));
  E.wl_panel(r.sel); const ps = JSON.parse(out());
  console.log('sel', ps.sel && ps.sel.name, 'phi', ps.sel && ps.sel.phi, 'brain nodes', ps.sel && ps.sel.brain.nodes.length, 'conns', ps.sel && ps.sel.brain.conns.length);
  t0 = performance.now(); E.wl_save(Date.now()); const save = out(); console.log('save MB', (save.length / 1048576).toFixed(2), (performance.now() - t0).toFixed(0), 'ms');
  const [sp, sn] = put(save); t0 = performance.now(); console.log('load', E.wl_load(sp, sn), (performance.now() - t0).toFixed(0), 'ms'); E.wl_dealloc(sp, sn);
  E.wl_step(10); console.log('step after load ok');
  E.wl_newick(); console.log('newick', out().slice(0, 80));
  E.wl_pyphi(r.sel); console.log('pyphi', out().slice(0, 120));
  const ids = Array.from(new Float32Array(E.memory.buffer, E.wl_buf_ptr(0), E.wl_buf_len(0))).filter((v, i) => i % 90 === 0);
  const tk = cmd({ type: 'take', id: ids[0] });
  console.log('take', tk.ok, tk.name, 'rec', tk.rec && tk.rec.length, 'growth', tk.growth);
  const tk3 = cmd({ type: 'take', id: ids[1] });
  E.wl_step(5);
  let tl = cmd({ type: 'tlist' });
  console.log('tlist', tl.list.length, tk3.ok);
  if (tl.list.length >= 2) {
    const br = cmd({ type: 'tbreed', a: tl.list[0].id, b: tl.list[1].id });
    console.log('tbreed', br.ok, br.name, 'gen', br.gen, 'growth', br.growth);
    E.wl_save(Date.now()); const sv = out();
    const [qp, qn] = put(sv); console.log('reload with terra', E.wl_load(qp, qn)); E.wl_dealloc(qp, qn);
    tl = cmd({ type: 'tlist' }); console.log('tlist after reload', tl.list.length);
    const rl = cmd({ type: 'release', id: tl.list[0].id, growth: 1, hp: 80 });
    console.log('release', rl.ok);
    E.wl_step(50);
    cmd({ type: 'tdie', id: tl.list[1].id, cause: 'hunger' });
    tl = cmd({ type: 'tlist' }); console.log('tlist end', tl.list.length);
  }
  const [lp, ln] = put(JSON.stringify({ knock: 'self', reps: 2, steps: 600, seed: 5 })); E.wl_lab_start(lp, ln);
  t0 = performance.now(); while (E.wl_lab_step(100) === 0) {} E.wl_lab_result();
  const lab = JSON.parse(out());
  console.log('lab', (performance.now() - t0).toFixed(0), 'ms', lab.results.slice(0, 4).map(x => `${x.metric}: ${x.meanC.toFixed(2)} vs ${x.meanT.toFixed(2)} p=${x.p.toFixed(3)}`).join(' | '));
  console.log('memory MB', (E.memory.buffer.byteLength / 1048576).toFixed(1));
})();
