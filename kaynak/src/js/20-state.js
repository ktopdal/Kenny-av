// ---------------------------------------------------------------- 20 · profil (telefondaki durum)
// Rig sistemleri, envanter adetleri, konumlar, ayarlar. Güncellemeler bu veriyi asla silmez: eksik alanlar eklenir.
const BOTTOM = [['', 'Bilmiyorum'], ['kum', 'Kum'], ['kum-kayalik', 'Kum–kayalık'], ['kayalik', 'Kayalık'], ['saf-kayalik', 'Saf kayalık'], ['karma', 'Karma'], ['camur', 'Çamur']];
const BOTTOM_TXT = Object.assign(Object.fromEntries(BOTTOM), {'': 'Bilinmiyor', 'orta-su': 'Orta su', 'bilinmeyen': 'Bilinmeyen'});
const LOW = {hook: 5};   // adetle sayılan iğnede bu adedin altı "az kaldı"; paket ve diğerlerinde "az" yok
// birim: makine, kamış, ip, terminal, kurşun, yem ve ekipman yalnızca durumla (var / alınacak / yok) tutulur;
// iğnede kalem başına adet ya da paket seçilebilir, jig ve sahte yemde adet
const UNITS = {hook: ['durum', 'adet', 'paket'], jig: ['durum', 'adet'], lure: ['durum', 'adet']};
const UNIT_TXT = {durum: 'Var/yok', adet: 'Adet', paket: 'Paket'};

let S = null;
function newState(){
  return {v: 2, created: new Date().toISOString(), seenVersion: APP_VERSION, onboarded: false, mode: 'tekne',
    profile: {name: '', baits: []},
    settings: {scheme: 'auto', preset: 'deniz', brand: '', accent: '', zoom: 0, bft: null, hideCoords: false, coord: 'dd', tier: 'envanter', anchor: 'surukle', leeway: 'orta',
      model: 'karma', windUnit: 'bft', pressUnit: 'hpa', windNames: 'yerel', hrows: null, cards: null, calrows: null, map: null, mapView: null, gkey: '', alert: null, safety: null, bkSnooze: null, hookUnit: 'durum', tempUnit: 'c', windUnit2: '', hFull: false, hrv: 16, ftarget: ''},
    inv: {items: {}, qty: {}, status: {}, unit: {}, v: 2},
    systems: {}, locations: {}, active: null, wx: null, targets: [], shopX: {}, fb: {}, rigOv: {}, rigPhotos: {}, prepLog: [],
    pkg: {unlocked: false, version: null, need: false, locs: []},
    backup: {repo: '', name: '', auto: true, photosOn: true, lastAt: null, sha: null, photos: {}, salt: null, err: null}};
}
// eksik alanları tamamla (eski sürümden ya da yedekten gelen profil)
function normalizeState(st){
  const n = newState();
  const hrv0 = (st.settings && st.settings.hrv) || 0;   // satır düzeni sürümü (eksik alan doldurulmadan önce)
  if (st.inv && st.inv.v == null) st.inv.v = 1;   // eski envanter: adetler yeni birim düzenine taşınacak (migrateInv)
  for (const k of Object.keys(n)) if (st[k] === undefined || st[k] === null && typeof n[k] === 'object' && k !== 'wx' && k !== 'active') st[k] = n[k];
  for (const g of ['settings', 'inv', 'pkg', 'backup', 'profile']) for (const k of Object.keys(n[g])) if (st[g][k] === undefined) st[g][k] = n[g][k];
  if (!st.locations[st.active]) st.active = Object.keys(st.locations)[0] || null;
  if (st.wx && !st.wx.raw) st.wx = null;
  // v0.15: rüzgâr/hamle satırları yeni düzene (Karma + 3 model rüzgâr + 3 model hamle) varsayılan yerleriyle gelir
  if (hrv0 < 15) { if (Array.isArray(st.settings.hrows)) st.settings.hrows = st.settings.hrows.filter(e => !/^(ruzgar|r_icon|r_ecmwf|r_gfs|h_icon|h_ecmwf|h_gfs|hamle|yon|uyum)$/.test(e && e[0])); st.settings.hrv = 15; }
  // v0.16: saatlik tablonun yeni varsayılan düzeni (Kenny'nin düzeni) herkese bir kez uygulanır; Bulut ve Solunar satırı kalktı
  if (hrv0 < 16) { st.settings.hrows = null; st.settings.hrv = 16; }
  return st;
}
// v0.2 (Kenny Av) → v0.3: adetler, durumlar, konumlar, hava önbelleği ve açılmış paket taşınır
function migrateV1(st, old){
  st.inv.qty = old.qty || {}; st.inv.status = old.status || {};
  st.locations = old.locations || {}; st.active = old.active || null;
  st.wx = old.wx && old.wx.raw ? old.wx : null;
  st.seenVersion = old.seenVersion || '0.2.0'; st.onboarded = true;
  let od = null; try { od = JSON.parse(lsGet(LS.oldData) || 'null'); } catch (e) {}
  if (od && od.rigs) {
    lsSet(LS.pkgData, JSON.stringify(od));
    st.pkg.unlocked = true; st.pkg.version = od.meta && od.meta.data_version;
    st.pkg.locs = (od.locations || []).map(l => l.id);
    st.systems.ozel = {id: 'ozel', name: (od.meta && od.meta.system_name) || 'Özel rig sistemi', source: 'paket', active: true, created: new Date().toISOString()};
  }
  lsDel(LS.oldKey);   // eski şifrenin anahtarı yeni pakette işe yaramaz
}
function loadState(){
  let st = null; try { st = JSON.parse(lsGet(LS.state) || 'null'); } catch (e) {}
  if (!st || st.v !== 2) {
    let old = null; try { old = JSON.parse(lsGet(LS.oldState) || 'null'); } catch (e) {}
    st = newState();
    if (old && old.v === 1) migrateV1(st, old);
  }
  S = normalizeState(st);
}
function persistQuiet(){ if (!lsSet(LS.state, JSON.stringify(S))) { S.wx = null; lsSet(LS.state, JSON.stringify(S)); } }
function persist(){ persistQuiet(); if (typeof markDirty === 'function') markDirty(); }
const loc = () => (S && S.active && S.locations[S.active]) || (S ? Object.values(S.locations)[0] : null) || null;
const nextLocId = () => String(Math.max(0, ...Object.keys(S.locations).map(Number).filter(isFinite)) + 1);
// konum türü: deniz (tekne ya da kıyı), kıyı (kıyıdan av: kıyı modu), kara (yalnız hava durumu; balık, rig, su verisi yok)
// tür bilinmiyorsa deniz gibi davranılır; özel paketin konumları Kenny'nin deniz noktalarıdır
const KIND_TXT = {deniz: 'Deniz', kiyi: 'Kıyı', kara: 'Kara'};
const kmTxt = km => km == null ? '' : km < 1 ? Math.max(10, Math.round(km * 100) * 10) + ' m' : f1(km) + ' km';   // 1 km altı metre
const locKind = L => !L ? null : L.kind && KIND_TXT[L.kind] ? L.kind : 'deniz';
const landMode = () => locKind(loc()) === 'kara';
// geçerli av modu: karada 'kara', kıyı türünde her zaman 'kiyi', denizde kullanıcının seçimi (Tekne/Kıyı)
const modeNow = () => { const k = locKind(loc()); return k === 'kara' ? 'kara' : k === 'kiyi' ? 'kiyi' : (S.mode === 'kiyi' ? 'kiyi' : 'tekne'); };
const locLabel = L => !L ? '' : (L.id === '1' && L.pkg ? 'Konum 1 · ' : '') + L.name;

// ---------------------------------------------------------------- stok
// durum: var | az (adette azalmış) | bitti (sayı 0 ya da "bitti" işareti; alınacak sayılır) | alinacak (istek, henüz yok) | yok
// Standart liste kalemleri ve yemler varsayılan olarak "yok"tur: kullanıcı elindekini işaretler, yemi avdan önce "var" yapar.
function baseStatus(it, size){
  if (!it) return 'yok';
  if (it.std || it.cat === 'bait') return 'yok';
  if (it.stock) return it.stock[size || '-'] || it.stock['-'] || 'yok';
  return 'var';
}
function unitOf(it){
  const al = it && UNITS[it.cat]; if (!al) return 'durum';
  const u = S.inv.unit[it.id] || (it.cat === 'hook' ? S.settings.hookUnit : null) || 'durum';
  return al.includes(u) ? u : 'durum';
}
const qtyOf = k => { const q = S.inv.qty[k]; return q === undefined || q === null || q === '' ? null : Number(q); };
function stockOf(id, size){
  const k = id + '|' + (size || '-'); const it = ITEMS[id];
  const u = unitOf(it);
  if (u !== 'durum') {
    const n = qtyOf(k);
    if (n != null) {
      if (n <= 0) return S.inv.status[k] === 'alinacak' ? 'alinacak' : 'bitti';
      return u === 'adet' && n < (LOW[it.cat] || 0) ? 'az' : 'var';
    }
  }
  return S.inv.status[k] || baseStatus(it, size);
}
const usable = st => st === 'var' || st === 'az';
const toBuy = st => st === 'bitti' || st === 'alinacak';
const sizesOf = it => (it.sizes && it.sizes.length) ? it.sizes : ['-'];
const ST_TXT = {var: 'Var', az: 'Az', bitti: 'Bitti · al', alinacak: 'Alınacak', yok: 'Yok'};
// durum işareti: temel durumla aynıysa kayıt silinir (profil küçük kalır)
function setStatus(k, st){
  const [id, size] = k.split('|'); const it = ITEMS[id];
  if (st === baseStatus(it, size) && !(qtyOf(k) != null && unitOf(it) !== 'durum')) delete S.inv.status[k]; else S.inv.status[k] = st;
  if (st === 'yok' || st === 'var' && unitOf(it) === 'durum') delete S.inv.qty[k];
}
// adet/paket yazılınca: sıfırdan büyükse alınacak/bitti işareti kalkar
function setQtyVal(k, v){
  if (v === '' || v == null) { delete S.inv.qty[k]; return; }
  const n = Math.max(0, Math.round(Number(String(v).replace(',', '.')) || 0));
  S.inv.qty[k] = n;
  if (n > 0 && S.inv.status[k] && S.inv.status[k] !== 'var') delete S.inv.status[k];
}
// birim değişince sayılar durum işaretine çevrilir (adetten pakete sayı aktarılamaz)
function setUnit(id, u){
  const it = ITEMS[id]; if (!it) return;
  sizesOf(it).forEach(sz => { const k = id + '|' + sz; const n = qtyOf(k);
    if (n != null) { delete S.inv.qty[k]; if (n > 0) S.inv.status[k] = 'var'; else if (S.inv.status[k] !== 'alinacak') S.inv.status[k] = 'bitti'; } });
  if (u === 'durum' && it.cat !== 'hook') delete S.inv.unit[id]; else S.inv.unit[id] = u;
}
// v0.10 → v0.11: adetle tutulan ip, terminal, kurşun, makine, kamış ve yem kayıtları durum işaretine döner; iğne/jig adetleri "adet" birimiyle kalır.
// Her dizinlemede çalışır (paket sonradan açılırsa onun kalemleri de taşınır); değişiklik yoksa bir şey yazmaz.
function migrateInv(){
  if (!S) return;
  let ch = S.inv.v !== 2;
  Object.keys(S.inv.qty).forEach(k => {
    const id = k.split('|')[0]; const it = ITEMS[id]; if (!it) return;
    const n = qtyOf(k);
    if (UNITS[it.cat]) { if (n != null && !S.inv.unit[id]) { S.inv.unit[id] = 'adet'; ch = true; } return; }
    if (n != null) S.inv.status[k] = n > 0 ? 'var' : 'bitti';
    delete S.inv.qty[k]; ch = true;
  });
  S.inv.v = 2;
  if (ch) persistQuiet();
}
