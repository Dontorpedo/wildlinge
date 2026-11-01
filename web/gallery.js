'use strict';
/* Gallery room: photo album of own and past creatures with a short life story. Loaded after rooms.js. */
TZ.album = []; TZ.galSel = 0; TZ.galPage = 0;
const TZ_GAL_PER = 10, TZ_GAL_MAX = 80, TZ_GAL = 5;

function tzAlbumGet(id) { return TZ.album.find(a => a.id === id); }
function tzAlbumAdd(c, k) {
  let e = tzAlbumGet(c.id);
  if (!e) {
    e = { id: c.id, name: c.name, gen: c.gen, hue: (c.rec && c.rec[5]) || 0, born: Date.now(), state: 'home', ev: [], kids: 0, words: 0, adult: false, photo: '', img: null, snapAt: 0, redo: false };
    TZ.album.push(e);
    if (TZ.album.length > TZ_GAL_MAX) { const i = TZ.album.findIndex(q => q.state !== 'home'); TZ.album.splice(i < 0 ? 0 : i, 1); }
    if (k) tzAlbumNote(c.id, k);
  }
  return e;
}
function tzAlbumNote(id, k, a, b) {
  const e = tzAlbumGet(id); if (!e) return;
  e.ev.push({ ts: Date.now(), k, a: a === undefined ? '' : a, b: b === undefined ? '' : b });
  if (e.ev.length > 50) e.ev.splice(1, 1);
  if (k === 'kid') e.kids++;
  if (k === 'teach') e.words++;
  if (k === 'release') { e.state = 'wild'; e.end = Date.now(); }
  if (k === 'death') { e.state = 'dead'; e.end = Date.now(); e.cause = a; }
}
function tzSnap(c) {
  const e = tzAlbumGet(c.id); if (!e) return;
  const w = 72, h = 80, sx = Math.max(0, Math.min(BW - w, Math.round(c.x - w / 2))), sy = Math.max(0, Math.min(BH - h, Math.round(c.y - c.half * 2 - 18)));
  const cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h;
  cv2.getContext('2d').drawImage(bufCanvas, sx, sy, w, h, 0, 0, w, h);
  try { e.photo = cv2.toDataURL('image/png'); } catch (err) { return; }
  e.img = null; e.snapAt = Date.now(); e.redo = false;
}
/* called right after the pets of the viewed room were drawn */
function tzGalleryShots(order) {
  for (const c of TZ.list) { const e = tzAlbumAdd(c, 'known'); const g = tzGrowth(c); if (!e.adult && g >= TZ.ADULT) { e.adult = true; if (e.ev.length > 1) tzAlbumNote(c.id, 'adult'); e.redo = true; } }
  for (const c of order) { const e = tzAlbumGet(c.id); if (e && !c.held && (!e.photo || e.redo)) tzSnap(c); }
}
function tzGalList() {
  return TZ.album.slice().sort((p, q) => ((q.ev.length ? q.ev[q.ev.length - 1].ts : 0) - (p.ev.length ? p.ev[p.ev.length - 1].ts : 0)));
}
function tzGalPages() { return Math.max(1, Math.ceil(TZ.album.length / TZ_GAL_PER)); }
function tzGalSlots() {
  const list = tzGalList().slice(TZ.galPage * TZ_GAL_PER, (TZ.galPage + 1) * TZ_GAL_PER);
  return list.map((e, i) => ({ e, x: 30 + (i % 5) * 150, y: 16 + ((i / 5) | 0) * 152, w: 112, h: 126 }));
}
function tzGalleryDraw(now) {
  const B = b;
  tzRect('#eadcc2', 0, 0, BW, TZ_FLOOR);
  for (let x = 0; x < BW; x += 40) tzRect('#e3d3b6', x, 0, 20, TZ_FLOOR);
  tzRect('#5a4026', 0, TZ_FLOOR - 8, BW, 8); tzRect('#7a5a38', 0, TZ_FLOOR, BW, BH - TZ_FLOOR);
  for (let x = 0; x < BW; x += 60) tzRect('#68492a', x, TZ_FLOOR + 6, 2, BH);
  tzRect('#9a7448', 0, TZ_FLOOR, BW, 3);
  const slots = tzGalSlots();
  B.textAlign = 'center'; B.textBaseline = 'middle'; B.font = '8px Silkscreen, monospace';
  for (const s of slots) {
    const e = s.e, sel = e.id === TZ.galSel;
    if (sel) { B.fillStyle = 'rgba(255,230,120,.35)'; B.fillRect(s.x - 8, s.y - 8, s.w + 16, s.h + 30); }
    tzRect('rgba(0,0,0,.18)', s.x + 4, s.y + 4, s.w, s.h);
    tzRect(OUTLINE, s.x - 1, s.y - 1, s.w + 2, s.h + 2); tzRect('#d9b25a', s.x, s.y, s.w, s.h); tzRect('#f0d27a', s.x + 2, s.y + 2, s.w - 4, 3);
    tzRect('#fff8e8', s.x + 6, s.y + 6, s.w - 12, s.h - 12);
    const px = s.x + 10, py = s.y + 10, pw = s.w - 20, ph = s.h - 20;
    if (e.photo) {
      if (!e.img) { e.img = new Image(); e.img.src = e.photo; }
      if (e.img.complete && e.img.naturalWidth) { B.imageSmoothingEnabled = false; B.drawImage(e.img, px, py, pw, ph); if (e.state === 'dead') { B.fillStyle = 'rgba(70,70,90,.45)'; B.fillRect(px, py, pw, ph); } }
    } else { tzRect(`hsl(${e.hue},60%,80%)`, px, py, pw, ph); }
    tzRect('#7a5a38', s.x + 8, s.y + s.h + 4, s.w - 16, 12); tzRect('#fff8e8', s.x + 9, s.y + s.h + 5, s.w - 18, 10);
    B.fillStyle = '#3a2a18'; B.fillText(e.name.slice(0, 14), s.x + s.w / 2, s.y + s.h + 10.5);
    const mx = s.x + s.w - 12, my = s.y + 12;
    if (e.state === 'home') { tzRect('#3fae5a', mx - 3, my - 3, 7, 7); tzRect('#9af0a8', mx - 2, my - 2, 3, 3); }
    else if (e.state === 'wild') { tzRect('#3a8fd8', mx - 3, my - 3, 7, 7); tzRect('#a8d8ff', mx - 2, my - 2, 3, 3); }
    else { tzRect('#2a2a34', mx - 3, my - 4, 7, 9); tzRect('#e8e8f0', mx - 1, my - 3, 3, 7); tzRect('#e8e8f0', mx - 2, my - 1, 5, 2); }
  }
  if (!slots.length) { B.fillStyle = '#6a5436'; B.font = '10px Silkscreen, monospace'; B.fillText(t('tz.gal.empty'), 400, 150); }
  const pages = tzGalPages();
  if (pages > 1) {
    B.font = '10px Silkscreen, monospace'; B.fillStyle = '#6a5436';
    B.fillText(`${TZ.galPage + 1} / ${pages}`, 400, TZ_FLOOR - 22);
    tzRect('#d9b25a', 330, TZ_FLOOR - 30, 22, 16); tzRect('#d9b25a', 448, TZ_FLOOR - 30, 22, 16);
    B.fillStyle = '#3a2a18'; B.fillText('<', 341, TZ_FLOOR - 21); B.fillText('>', 459, TZ_FLOOR - 21);
  }
  B.textAlign = 'start'; B.textBaseline = 'alphabetic';
}
function tzGalleryClick(x, y) {
  if (tzGalPages() > 1 && y > TZ_FLOOR - 34 && y < TZ_FLOOR - 10) {
    if (x > 326 && x < 356) { TZ.galPage = (TZ.galPage + tzGalPages() - 1) % tzGalPages(); sndFx('tick', 0); tzPanel(true); return true; }
    if (x > 444 && x < 474) { TZ.galPage = (TZ.galPage + 1) % tzGalPages(); sndFx('tick', 0); tzPanel(true); return true; }
  }
  for (const s of tzGalSlots()) if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h + 18) { TZ.galSel = s.e.id; sndFx('chime', (x - 400) / 400); tzPanel(true); return true; }
  return false;
}
function tzGalleryHtml() {
  const list = tzGalList();
  const e = tzAlbumGet(TZ.galSel) || list[0];
  if (!e) return `<div class="muted">${esc(t('tz.gal.empty'))}</div>`;
  const fmt = ts => new Date(ts).toLocaleDateString(LANG === 'de' ? 'de-AT' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const days = Math.max(0, Math.round(((e.end || Date.now()) - e.born) / 86400000));
  const st = e.state === 'dead' ? t('tz.gal.st.dead', fmt(e.end), tr('causes')[e.cause] || e.cause || '') : e.state === 'wild' ? t('tz.gal.st.wild', fmt(e.end)) : t('tz.gal.st.home');
  const sum = t('tz.gal.sum', e.name, e.gen, days < 1 ? '<1' : days, e.words, e.kids);
  const evs = e.ev.map(v => {
    const a = v.k === 'teach' ? v.a : v.k === 'death' ? (tr('causes')[v.a] || v.a) : v.a, bb = v.k === 'teach' ? (tr('tz.needs')[v.b] || v.b) : v.b;
    return `<tr><td class="l muted" style="white-space:nowrap">${esc(fmt(v.ts))}</td><td>${esc(t('tz.gal.ev.' + v.k, a, bb))}</td></tr>`;
  }).join('');
  const kids = TZ.album.filter(q => q.pa === e.id || q.pb === e.id).map(q => q.name);
  const kin = (e.pan ? `<div class="muted">${esc(t('tz.gal.parents', e.pan, e.pbn))}</div>` : '') + (kids.length ? `<div class="muted">${esc(t('tz.gal.children', kids.join(', ')))}</div>` : '');
  const img = e.photo ? `<img src="${e.photo}" alt="" style="width:144px;image-rendering:pixelated;border:5px solid #d9b25a;border-radius:3px;background:#fff8e8;float:left;margin:0 10px 6px 0">` : '';
  const pg = tzGalPages() > 1 ? `<div class="row"><button data-galpage="-1">&lt;</button><span class="muted">${TZ.galPage + 1} / ${tzGalPages()}</span><button data-galpage="1">&gt;</button></div>` : '';
  return `<div class="tzcard on">${img}<b>${esc(e.name)}</b><div class="muted">${esc(st)}</div><div style="margin-top:6px">${esc(sum)}</div>${kin}<div style="clear:both"></div><table>${evs}</table></div>${pg}`;
}
tzEl('tzList').addEventListener('click', ev => { const bt = ev.target.closest('[data-galpage]'); if (bt) { TZ.galPage = (TZ.galPage + (+bt.dataset.galpage) + tzGalPages()) % tzGalPages(); tzPanel(true); } });
