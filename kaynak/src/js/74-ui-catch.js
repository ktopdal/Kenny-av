// ---------------------------------------------------------------- 74 · Av kaydı (fotoğraflar telefonda, IndexedDB)
const IDB = (() => {
  let dbp = null;
  function open(){
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!('indexedDB' in window)) { rej(new Error('IndexedDB yok')); return; }
      const r = indexedDB.open('kenny-av', 1);
      r.onupgradeneeded = () => { const db = r.result;
        if (!db.objectStoreNames.contains('catches')) db.createObjectStore('catches', {keyPath: 'id'});
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', {keyPath: 'id'}); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function run(store, mode, fn){
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(store, mode); const st = t.objectStore(store); let out; const rq = fn(st);
      if (rq) rq.onsuccess = () => { out = rq.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    }));
  }
  return {put: (s, v) => run(s, 'readwrite', st => st.put(v)), get: (s, k) => run(s, 'readonly', st => st.get(k)),
    all: s => run(s, 'readonly', st => st.getAll()), del: (s, k) => run(s, 'readwrite', st => st.delete(k))};
})();
let CATCHES = [], CATCHES_V = 0;
const URLS = {};
async function loadCatches(){ try { CATCHES = (await IDB.all('catches')) || []; } catch (e) { CATCHES = []; } CATCHES.sort((a, b) => (b.t || '').localeCompare(a.t || '')); CATCHES_V++; }
async function photoUrl(id, which){
  const k = id + ':' + which; if (URLS[k]) return URLS[k];
  try { const p = await IDB.get('photos', id); if (!p) return null; URLS[k] = URL.createObjectURL(which === 'big' ? p.big : p.thumb); return URLS[k]; } catch (e) { return null; }
}
function dropUrls(id){ ['big', 'thumb'].forEach(w => { const k = id + ':' + w; if (URLS[k]) { URL.revokeObjectURL(URLS[k]); delete URLS[k]; } }); }

// ---- EXIF: çekim zamanı ve GPS (JPEG)
async function readExif(file){
  const buf = await file.slice(0, 196608).arrayBuffer(); const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return {};
  let off = 2;
  while (off + 10 < v.byteLength) {
    const mk = v.getUint16(off); if ((mk & 0xFF00) !== 0xFF00) break;
    const len = v.getUint16(off + 2);
    if (mk === 0xFFE1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
    off += 2 + len;
  }
  return {};
}
function parseTiff(v, s){
  const le = v.getUint16(s) === 0x4949;
  const u16 = o => v.getUint16(s + o, le), u32 = o => v.getUint32(s + o, le);
  const ok = o => s + o + 12 <= v.byteLength;
  const out = {}; let exifP = 0, gpsP = 0;
  const ifd = (o, cb) => { if (!ok(o)) return; const n = u16(o); for (let i = 0; i < n; i++) { const e = o + 2 + i * 12; if (!ok(e)) break; cb(u16(e), u16(e + 2), u32(e + 4), e + 8); } };
  const str = (o, n) => { let t = ''; for (let i = 0; i < n - 1 && s + o + i < v.byteLength; i++) t += String.fromCharCode(v.getUint8(s + o + i)); return t; };
  const rat = o => { const d = u32(o + 4); return d ? u32(o) / d : 0; };
  try {
    ifd(u32(4), (tag, type, cnt, vo) => { if (tag === 0x8769) exifP = u32(vo); if (tag === 0x8825) gpsP = u32(vo); if (tag === 0x0132 && !out.dt) out.dt = str(u32(vo), cnt); });
    if (exifP) ifd(exifP, (tag, type, cnt, vo) => { if (tag === 0x9003) out.dt = str(u32(vo), cnt); });
    if (gpsP) {
      const g = {};
      ifd(gpsP, (tag, type, cnt, vo) => {
        if (tag === 1 || tag === 3) g[tag] = String.fromCharCode(v.getUint8(s + vo));
        if (tag === 2 || tag === 4) { const p = u32(vo); g[tag] = rat(p) + rat(p + 8) / 60 + rat(p + 16) / 3600; }
      });
      if (g[2] != null && g[4] != null && (g[2] || g[4])) out.gps = {lat: g[1] === 'S' ? -g[2] : g[2], lon: g[3] === 'W' ? -g[4] : g[4]};
    }
  } catch (e) {}
  if (out.dt) { const m = out.dt.match(/(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/); out.date = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null; }
  return out;
}
// ---- fotoğrafı küçült (uzun kenar 1600 px ve 360 px önizleme)
function loadImg(file){ return new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { res(im); setTimeout(() => URL.revokeObjectURL(u), 1000); }; im.onerror = rej; im.src = u; }); }
function toJpeg(src, max, q){
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height; const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(b => r(b), 'image/jpeg', q));
}
async function processPhoto(file){
  const exif = await readExif(file).catch(() => ({}));
  let src = null;
  try { src = await createImageBitmap(file, {imageOrientation: 'from-image'}); } catch (e) { src = await loadImg(file); }
  const big = await toJpeg(src, 1600, 0.82), thumb = await toJpeg(src, 360, 0.75);
  if (src.close) src.close();
  return {id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), big, thumb, exif};
}

// ---- liste
const rigShort = r => RIGS[r] ? (RIGS[r].code || RIGS[r].name) : r;
function catchLine(c){
  const sp = c.species === 'diger' ? (c.species_other || 'Diğer') : (SPECIES[c.species] ? SPECIES[c.species].name : c.species);
  const d = new Date(c.t);
  const bits = [(c.count > 1 ? c.count + ' adet' : ''), c.kg != null ? fmtNum(c.kg, 2) + ' kg' : '', c.cm != null ? fmtNum(c.cm, 1) + ' cm' : ''].filter(Boolean).join(' · ');
  return {sp, d, bits};
}
async function renderCatches(){
  const tot = CATCHES.reduce((a, c) => a + (c.count || 1), 0), kg = CATCHES.reduce((a, c) => a + (c.kg || 0), 0);
  const by = {}; CATCHES.forEach(c => { const n = catchLine(c).sp; by[n] = (by[n] || 0) + (c.count || 1); });
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  const M = (k, v, s) => '<div class="metric"><span class="k">' + k + '</span><span class="v">' + v + '</span><span class="s">' + s + '</span></div>';
  $('catchStats').innerHTML = M('Av', tot, 'balık') + M('Toplam', fmtNum(kg, 1) || '0', 'kg') + M('En çok', top ? esc(top[0]) : '–', top ? top[1] + ' balık' : '');
  const ls = learnSummary(); const lb = $('learnBox');
  lb.hidden = !ls;
  if (ls) lb.innerHTML = '<b>Avlarından öğrenme</b>' + (!ls.on ? '<span>' + esc(ls.txt) + '</span>' :
    '<span>Öneriler ' + ls.total + ' av kaydına göre ayarlanıyor: aynı rigin benzer koşullarda (gece/gündüz, akıntı, ay, mevsim, nokta) verdiği sonuç öne çıkar.</span>' +
    (ls.rigs.length ? '<span>En verimli rigler: <b>' + ls.rigs.join(', ') + '</b></span>' : '') +
    (ls.hours.length ? '<span>En çok tuttuğun saatler: <b>' + ls.hours.join(', ') + '</b></span>' : '') +
    (ls.model != null ? '<span>Uygulamanın 3 ve üstü balık (%41+) gösterdiği saatlerde gelen balıkların oranı: <b>%' + ls.model + '</b></span>' : ''));
  if (!CATCHES.length) { $('catchList').innerHTML = '<div class="empty">Henüz av yok. İlk balığını “+ Av ekle” ile kaydet.</div>'; return; }
  $('catchList').innerHTML = CATCHES.map(c => { const l = catchLine(c);
    return '<button class="catch" type="button" data-catch="' + esc(c.id) + '">' + (c.photos && c.photos.length ? '<img class="th" alt="" data-ph="' + esc(c.photos[0]) + '">' : '<span class="th ph">🐟</span>') +
      '<span><b>' + esc(l.sp) + '</b><br><span class="m">' + esc(l.bits || '—') + (c.rig ? ' · ' + esc(rigShort(c.rig)) : '') + '</span><br>' +
      '<span class="s">' + l.d.getDate() + ' ' + MON3[l.d.getMonth()] + ' ' + l.d.getFullYear() + ' ' + hm(l.d) + (c.loc && c.loc.name ? ' · ' + esc(c.loc.name) : '') + '</span></span></button>'; }).join('');
  document.querySelectorAll('#catchList img[data-ph]').forEach(async im => { const u = await photoUrl(im.dataset.ph, 'thumb'); if (u) im.src = u; });
}

// ---- form (ekle / düzenle)
let FORM = null;
function openSheet(html, keepScroll){
  const sh = $('sheet'); const wasHidden = sh.hidden; const top = sh.scrollTop;
  if (ui.sheet !== 'harita' && MAP) closeMap();
  sh.classList.toggle('full', ui.sheet === 'harita');
  sh.innerHTML = '<div class="sin">' + html + '</div>'; sh.hidden = false; sh.scrollTop = keepScroll ? top : 0; document.body.style.overflow = 'hidden';
  if (wasHidden) { try { history.pushState({sheet: 1}, ''); } catch (e) {} }
}
function closeSheet(fromPop){ const sh = $('sheet'); if (sh.hidden) return; const backToWel = !!(WZ && WZ.fromWel && !S.onboarded); closeMap(); sh.classList.remove('full'); sh.hidden = true; sh.innerHTML = ''; document.body.style.overflow = ''; FORM = null; WZ = null; ui.sheet = null; ui.sheetArg = null; if (!fromPop) { try { history.back(); } catch (e) {} } if (backToWel && !hasProfileData()) showWelcome(); }
window.addEventListener('popstate', () => { if (!$('sheet').hidden) closeSheet(true); });
function toLocalInput(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function nearestLoc(p){ if (!p || p.lat == null) return null; let best = null; Object.values(S.locations).forEach(L => { const d = distKm(L, p); if (!best || d < best.d) best = {L, d}; }); return best; }
const CATCH_TECH = ['Jig', 'Slow jig', 'Inchiku', 'Tai rubber', 'Kalamar zokası', 'Çapari', 'Sırtı (trolling)', 'Surf', 'LRF', 'Spin', 'Şamandıra', 'Diğer'];
function catchForm(c){
  const isNew = !c; c = c || {};
  const L = loc();
  FORM = {id: c.id || null, photos: [], keep: (c.photos || []).slice(), removed: [], loc: c.loc || (L ? {lat: L.lat, lon: L.lon, name: L.name, src: 'konum'} : null), t: c.t ? new Date(c.t) : new Date(), botTouched: c.bottom != null};
  const sps = Object.values(SPECIES).sort((a, b) => trCmp(a.name, b.name));
  const spOpts = '<option value="">Seç</option>' + sps.map(s => '<option value="' + s.id + '"' + (c.species === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '<option value="diger"' + (c.species === 'diger' ? ' selected' : '') + '>Diğer</option>';
  const sel = r => (c.rig && (c.rig === r.id || c.rig === r.code)) ? ' selected' : '';
  const rigOpt = r => '<option value="' + esc(r.id) + '"' + sel(r) + '>' + esc((r.code ? r.code + ' · ' : '') + r.name) + (ready(r) ? '' : ' (eksik)') + '</option>';
  const bySys = {}; RIG_LIST.forEach(r => { (bySys[r.sys] = bySys[r.sys] || []).push(r); });
  const rigOpts = '<option value="">—</option>' + Object.keys(bySys).map(sid => '<optgroup label="' + esc(sysName(sid)) + '">' + bySys[sid].filter(ready).concat(bySys[sid].filter(r => !ready(r))).map(rigOpt).join('') + '</optgroup>').join('') +
    '<optgroup label="Teknik">' + CATCH_TECH.map(x => '<option' + (c.rig === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</optgroup>';
  const baitOpts = ['', 'Mamun', 'Sülünez', 'Çimçim', 'Karides', 'Kalamar', 'Sardalya', 'Midye', 'Yengeç', 'Canlı yem', 'Yapay yem', 'Diğer'].map(x => '<option value="' + x + '"' + ((c.bait || '') === x ? ' selected' : '') + '>' + (x || '—') + '</option>').join('');
  const n0 = nearestLoc(FORM.loc); const defBot = c.bottom != null ? c.bottom : (n0 && n0.d <= 0.5 ? (n0.L.bottom || '') : '');
  const botOpts = BOTTOM.map(([k, t]) => '<option value="' + k + '"' + (defBot === k ? ' selected' : '') + '>' + t + '</option>').join('');
  ui.sheet = 'catch';
  openSheet('<div class="bar"><button class="btn" type="button" data-close>Vazgeç</button><h3 id="sheetTitle">' + (isNew ? 'Yeni av' : 'Avı düzenle') + '</h3><button class="btn primary" type="button" id="cfSave">Kaydet</button></div>' +
    '<div class="stack" style="margin-top:6px">' +
    '<div class="row"><label class="btn filebtn">📷 Fotoğraf çek<input type="file" accept="image/*" capture="environment" id="cfCam"></label>' +
    '<label class="btn filebtn">🖼 Galeriden seç<input type="file" accept="image/*" multiple id="cfGal"></label></div>' +
    '<div class="photos" id="cfPhotos"></div><p class="note" id="cfPhotoNote">En fazla 4 fotoğraf. Galeriden seçilen fotoğrafın saati ve konumu varsa kendiliğinden alınır.</p>' +
    '<div class="fields">' +
    '<label class="f wide">Tür<select id="cf-sp">' + spOpts + '</select></label>' +
    '<label class="f wide" id="cf-sp2w"' + (c.species === 'diger' ? '' : ' hidden') + '>Tür adı<input id="cf-sp2" value="' + esc(c.species_other || '') + '" placeholder="Ör. lahos"></label>' +
    '<label class="f">Adet<input id="cf-n" inputmode="numeric" value="' + esc(c.count || 1) + '"></label>' +
    '<label class="f">Ağırlık (kg)<input id="cf-kg" inputmode="decimal" value="' + esc(c.kg != null ? fmtNum(c.kg, 3) : '') + '" placeholder="1,25"></label>' +
    '<label class="f">Boy (cm)<input id="cf-cm" inputmode="decimal" value="' + esc(c.cm != null ? fmtNum(c.cm, 1) : '') + '" placeholder="38"></label>' +
    '<label class="f">Derinlik (m)<input id="cf-dep" inputmode="decimal" value="' + esc(c.depth_m != null ? fmtNum(c.depth_m, 1) : '') + '" placeholder="55"></label>' +
    '<label class="f wide">Rig ya da takım<select id="cf-rig">' + rigOpts + '</select></label>' +
    '<label class="f">Yem<select id="cf-bait">' + baitOpts + '</select></label>' +
    '<label class="f">Dip<select id="cf-bot">' + botOpts + '</select></label>' +
    '<label class="f wide">Tarih ve saat<input type="datetime-local" id="cf-t" value="' + toLocalInput(FORM.t) + '"><span class="tr-date" id="cf-tlbl">' + fmtDT(FORM.t) + '</span></label>' +
    '</div>' +
    '<div class="panel"><div class="row" style="justify-content:space-between"><div><b>Konum</b><div class="note mono" id="cfLoc"></div></div><button class="btn small" type="button" id="cfGps">Bulunduğum yer</button></div>' +
    '<label class="row note" style="gap:8px;margin-top:8px" id="cfAddLocW"><input type="checkbox" id="cfAddLoc" checked> Bu noktayı konumlarıma ekle (yakında kayıtlı konum yok)</label></div>' +
    '<label class="f">Not<input id="cf-note" value="' + esc(c.note || '') + '" placeholder="Ör. ikinci salkımda geldi"></label>' +
    '<p class="err" id="cfErr" hidden></p></div>');
  renderFormPhotos(); renderFormLoc();
}
function renderFormLoc(){
  if (!FORM) return; const p = FORM.loc;
  if (!p || p.lat == null) { $('cfLoc').textContent = 'Konum yok · “Bulunduğum yer”e dokun'; $('cfAddLocW').hidden = true; return; }
  const n = nearestLoc(p); const near = n && n.d <= 0.5;
  $('cfLoc').textContent = fmtCoord(p.lat, p.lon, true) + ' · ' + (near ? locLabel(n.L) + (n.d > 0.05 ? ' (' + Math.round(n.d * 1000) + ' m)' : '') : 'kayıtlı konum dışında') + ' · ' + ({gps: 'GPS', foto: 'fotoğraftan', konum: 'seçili konum'}[p.src] || '');
  $('cfAddLocW').hidden = near;
  // dip: kullanıcı seçmediyse yakın kayıtlı konumunkini, uzaksa "Bilmiyorum"u göster
  if (!FORM.botTouched && $('cf-bot')) $('cf-bot').value = near ? (n.L.bottom || '') : '';
}
async function renderFormPhotos(){
  if (!FORM) return;
  const items = [];
  for (const id of FORM.keep) items.push({id, url: await photoUrl(id, 'thumb'), old: true});
  FORM.photos.forEach(p => items.push({id: p.id, url: p.url}));
  $('cfPhotos').innerHTML = items.map(p => '<div class="p"><img alt="" src="' + (p.url || '') + '"><button type="button" data-rmph="' + esc(p.id) + '" aria-label="Fotoğrafı çıkar">×</button></div>').join('');
}
async function addFiles(files){
  if (!FORM) return;
  const room = 4 - FORM.keep.length - FORM.photos.length;
  const list = Array.from(files || []).slice(0, Math.max(0, room));
  if (!list.length) { toast('En fazla 4 fotoğraf'); return; }
  $('cfPhotoNote').textContent = 'Fotoğraf hazırlanıyor…';
  for (const f of list) {
    try {
      const p = await processPhoto(f); p.url = URL.createObjectURL(p.thumb); FORM.photos.push(p);
      if (p.exif && p.exif.date && FORM.photos.length + FORM.keep.length === 1) { FORM.t = p.exif.date; $('cf-t').value = toLocalInput(p.exif.date); $('cf-tlbl').textContent = fmtDT(p.exif.date); }
      if (p.exif && p.exif.gps && (!FORM.loc || FORM.loc.src !== 'gps')) { FORM.loc = {lat: p.exif.gps.lat, lon: p.exif.gps.lon, src: 'foto'}; renderFormLoc(); }
    } catch (e) { toast('Bu fotoğraf açılamadı'); }
  }
  $('cfPhotoNote').textContent = 'En fazla 4 fotoğraf. ' + (FORM.photos.some(p => p.exif && (p.exif.date || p.exif.gps)) ? 'Fotoğrafın saati' + (FORM.photos.some(p => p.exif && p.exif.gps) ? ' ve konumu' : '') + ' alındı.' : '');
  renderFormPhotos();
}
function condAt(t, p){
  if (!WX || !WX.hours.length || !p || p.lat == null) return null;
  const L = loc(); if (!L || distKm(L, p) > 40) return null;
  let best = null, bd = 1e15; WX.hours.forEach(x => { const d = Math.abs(x.t - t); if (d < bd) { bd = d; best = x; } });
  if (!best || bd > 3 * 3600000) return null;
  const s = solunar(new Date(t.getFullYear(), t.getMonth(), t.getDate())); const a = activity(best); const dr = driftAt(best);
  return {wind_bft: bft(best.wind), wind_kn: best.wind == null ? null : Math.round(best.wind * KN), wdir: dir8(best.wdir), gust_bft: bft(best.gust), wave_m: best.wave, per_s: best.per,
    cur_kn: best.cur, sst: best.sst, temp: best.temp, press: best.press, dp3: best.dp3, moon: s.name, illum: Math.round(s.illum * 100), stars: s.stars, act: a.pct, sol: a.tags.join(' '),
    drift_kn: dr && dr.known ? +dr.sog.toFixed(2) : null, drift_dir: dr && dr.known ? dir8(dr.dir) : null, line_kn: dr && dr.known ? +dr.line.toFixed(2) : null, anchored: !!(dr && dr.anchored), v: 5};
}
async function saveCatch(){
  const err = m => { $('cfErr').textContent = m; $('cfErr').hidden = false; };
  const sp = $('cf-sp').value; if (!sp) { err('Türü seç.'); return; }
  if (sp === 'diger' && !$('cf-sp2').value.trim()) { err('Türün adını yaz.'); return; }
  const t = $('cf-t').value ? new Date($('cf-t').value) : new Date();
  const p = FORM.loc;
  const n = nearestLoc(p); const near = n && n.d <= 0.5;
  const bottom = $('cf-bot').value, depth = num($('cf-dep').value);
  let lname = near ? n.L.name : '';
  if (near && bottom && !n.L.bottom) { n.L.bottom = bottom; toast(locLabel(n.L) + ': dip ' + BOTTOM_TXT[bottom] + ' olarak öğrenildi'); }
  if (p && p.lat != null && !near && $('cfAddLoc').checked) {
    const id = nextLocId();
    lname = 'Av noktası ' + id; S.locations[id] = {id, name: lname, lat: p.lat, lon: p.lon, bottom, depth: depth != null ? String(depth) : ''};
    if (!S.active) S.active = id;
  }
  persist();
  const btn = $('cfSave'); btn.disabled = true; btn.textContent = 'Kaydediliyor…';
  try {
    for (const ph of FORM.photos) await IDB.put('photos', {id: ph.id, big: ph.big, thumb: ph.thumb});
    for (const id of FORM.removed) { await IDB.del('photos', id); dropUrls(id); }
    const id = FORM.id || ('c' + Date.now().toString(36));
    const old = CATCHES.find(c => c.id === id);
    const rec = {id, t: t.toISOString(), species: sp, species_other: sp === 'diger' ? $('cf-sp2').value.trim() : '', count: Math.max(1, Math.round(num($('cf-n').value) || 1)),
      kg: num($('cf-kg').value), cm: num($('cf-cm').value), depth_m: depth, rig: $('cf-rig').value, bait: $('cf-bait').value, bottom,
      loc: p && p.lat != null ? {lat: p.lat, lon: p.lon, name: lname, src: p.src} : null, note: $('cf-note').value.trim(), photos: FORM.keep.concat(FORM.photos.map(x => x.id)),
      cond: old && old.cond && old.t === t.toISOString() ? old.cond : condAt(t, p), created: old ? old.created : new Date().toISOString(), updated: new Date().toISOString()};
    await IDB.put('catches', rec);
    FORM.photos.forEach(x => { if (x.url) URL.revokeObjectURL(x.url); });
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    await loadCatches(); closeSheet(); markDirty(); renderAll(); toast('Av kaydedildi');
  } catch (e) { btn.disabled = false; btn.textContent = 'Kaydet'; err('Kaydedilemedi: telefonda yer kalmamış olabilir.'); }
}
async function catchDetail(id){
  const c = CATCHES.find(x => x.id === id); if (!c) return;
  const l = catchLine(c);
  const urls = []; for (const pid of (c.photos || [])) urls.push(await photoUrl(pid, 'big'));
  const K = (k, v) => v == null || v === '' ? '' : '<div><span>' + k + '</span><b>' + esc(v) + '</b></div>';
  const cd = c.cond; const rr = c.rig && RIGS[c.rig];
  ui.sheet = 'catchDetail';
  openSheet('<div class="bar"><button class="btn" type="button" data-close>Geri</button><h3 id="sheetTitle">' + esc(l.sp) + '</h3><button class="btn" type="button" data-editcatch="' + esc(id) + '">Düzenle</button></div>' +
    '<div class="stack">' + urls.filter(Boolean).map(u => '<div class="hero"><img alt="" src="' + u + '"></div>').join('') +
    (c.photos && c.photos.length && !urls.filter(Boolean).length ? '<p class="note">Fotoğraflar bu telefonda yok; bulut yedekten geri yüklenince gelir.</p>' : '') +
    '<div class="kv">' + K('Tarih', fmtDT(l.d)) + K('Adet', c.count) + K('Ağırlık', c.kg != null ? fmtNum(c.kg, 2) + ' kg' : '') + K('Boy', c.cm != null ? fmtNum(c.cm, 1) + ' cm' : '') +
    K('Rig', c.rig ? (rr ? (rr.code ? rr.code + ' · ' : '') + rr.name : c.rig) : '') + K('Yem', c.bait) + K('Derinlik', c.depth_m != null ? fmtNum(c.depth_m, 1) + ' m' : '') + K('Dip', BOTTOM_TXT[c.bottom] || '') +
    K('Konum', c.loc ? (c.loc.name ? c.loc.name + ' · ' : '') + fmtCoord(c.loc.lat, c.loc.lon) : '') + K('Not', c.note) + '</div>' +
    (cd ? '<h3 style="margin-top:6px">O saatteki koşullar</h3><div class="kv">' + K('Rüzgâr', cd.wind_bft != null ? cd.wind_bft + ' Bft · ' + cd.wind_kn + ' kn ' + (cd.wdir || '') : '') + K('Hamle', cd.gust_bft != null ? cd.gust_bft + ' Bft' : '') +
      K('Dalga', cd.wave_m != null ? fmtNum(cd.wave_m, 1) + ' m' + (cd.per_s != null ? ' · ' + Math.round(cd.per_s) + ' sn' : '') : '') + K('Akıntı', cd.cur_kn != null ? fmtNum(cd.cur_kn, 1) + ' kn' : '') +
      K('Su', cd.sst != null ? tempTxt(cd.sst, true) : '') + K('Hava', cd.temp != null ? tempTxt(cd.temp) : '') + K('Basınç', cd.press != null ? Math.round(cd.press) + ' hPa' + (cd.dp3 != null ? ' (3 sa ' + (cd.dp3 > 0 ? '+' : '') + fmtNum(cd.dp3, 1) + ')' : '') : '') +
      K('Sürüklenme', cd.drift_kn != null ? (cd.anchored ? 'demirli · ipe akış ' + fmtNum(cd.line_kn, 1) + ' kn' : fmtNum(cd.drift_kn, 1) + ' kn ' + (cd.drift_dir || '') + ' yönüne') : '') +
      K('Ay', cd.moon + ' · %' + cd.illum) + K('Balık aktivitesi', '%' + cd.act + (cd.v === 5 ? '' : ' (eski ölçek)') + (cd.sol ? ' · ' + cd.sol : '')) + '</div>' : '<p class="note">Bu av için deniz koşulu kaydı yok (o saatin verisi telefonda değildi).</p>') +
    catchShareBox(c) +
    '<button class="btn" type="button" id="delCatch" data-del-catch="' + esc(id) + '" style="margin-top:10px;color:var(--D)">Avı sil</button></div>');
}
async function deleteCatch(id){
  const c = CATCHES.find(x => x.id === id); if (!c) return;
  for (const pid of (c.photos || [])) { try { await IDB.del('photos', pid); } catch (e) {} dropUrls(pid); }
  await IDB.del('catches', id); await loadCatches(); closeSheet(); markDirty(); renderAll(); toast('Av silindi');
}
