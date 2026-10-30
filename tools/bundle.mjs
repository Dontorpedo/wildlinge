// Bundles web/ and the WebAssembly core into one self-contained dist/wildlinge.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const rd = p => readFileSync(new URL('../' + p, import.meta.url));
const txt = p => rd(p).toString('utf8');
const wasm = rd('dist/wildlinge_core.wasm');

const csp = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:",
  'worker-src blob:',
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  "connect-src 'self' ws: wss:",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const shim = "try { new Intl.NumberFormat(navigator.language); } catch (e) { Object.defineProperty(Navigator.prototype, 'language', { get: () => 'en' }); }\n";
const libs = shim + txt('node_modules/uplot/dist/uPlot.iife.min.js') + '\n;\n' + txt('node_modules/d3-hierarchy/dist/d3-hierarchy.min.js');
const worker = txt('web/worker.js');
if (/<\/script/i.test(worker + libs + txt('web/app.js') + txt('web/gfx.js') + txt('web/terrarium.js') + txt('web/critter.js') + txt('web/i18n.js'))) throw new Error('script end tag inside source');

const parts = {
  CSP: csp,
  FONT: rd('node_modules/@fontsource/silkscreen/files/silkscreen-latin-400-normal.woff2').toString('base64'),
  UPLOT_CSS: txt('node_modules/uplot/dist/uPlot.min.css'),
  WASM: wasm.toString('base64'),
  WORKER: worker,
  LIBS: libs,
  I18N: txt('web/i18n.js'),
  GFX: 'const TILE_STAMPS=' + txt('web/assets/tiles/stamps.json') + ';\n' + txt('web/gfx.js'),
  CRITTER: 'const CR_ATLAS=' + JSON.stringify(Object.fromEntries(['heads', 'bodies', 'ears', 'tails', 'legs', 'wings', 'crests', 'horns'].map(n => [n, 'data:image/png;base64,' + rd('web/assets/parts/' + n + '.png').toString('base64')]))) + ';\n' + txt('web/critter.js'),
  TERRA: txt('web/terrarium.js'),
  APP: txt('web/app.js')
};
let html = txt('web/index.html');
for (const [k, v] of Object.entries(parts)) html = html.split(`/*${k}*/`).join(v);
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/wildlinge.html', import.meta.url), html);
console.log('dist/wildlinge.html', (html.length / 1048576).toFixed(2), 'MB, wasm', (wasm.length / 1024).toFixed(0), 'KB');
