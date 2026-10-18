// ---------------------------------------------------------------- 20 · profil (telefondaki durum)
// Rig sistemleri, envanter adetleri, konumlar, ayarlar. Güncellemeler bu veriyi asla silmez: eksik alanlar eklenir.
const BOTTOM = [['', 'Bilmiyorum'], ['kum', 'Kum'], ['kum-kayalik', 'Kum–kayalık'], ['kayalik', 'Kayalık'], ['saf-kayalik', 'Saf kayalık'], ['karma', 'Karma'], ['camur', 'Çamur']];
const BOTTOM_TXT = Object.assign(Object.fromEntries(BOTTOM), {'': 'Bilinmiyor', 'orta-su': 'Orta su', 'bilinmeyen': 'Bilinmeyen'});
const LOW = {hook: 5, terminal: 3, jig: 1, sinker: 5};   // bu adedin altı "az kaldı"

let S = null;
function newState(){
  return {v: 2, created: new Date().toISOString(), seenVersion: APP_VERSION, onboarded: false, mode: 'tekne',
    profile: {name: ''},
    settings: {scheme: 'auto', preset: 'deniz', brand: '', accent: '', zoom: 0, bft: null, hideCoords: false, coord: 'dd', tier: 'envanter', anchor: 'surukle', leeway: 'orta'},
    inv: {items: {}, qty: {}, status: {}},
    systems: {}, locations: {}, active: null, wx: null,
    pkg: {unlocked: false, version: null, need: false, locs: []},
    backup: {repo: '', name: '', auto: true, photosOn: true, lastAt: null, sha: null, photos: {}, salt: null, err: null}};
}
// eksik alanları tamamla (eski sürümden ya da yedekten gelen profil)
function normalizeState(st){
  const n = newState();
  for (const k of Object.keys(n)) if (st[k] === undefined || st[k] === null && typeof n[k] === 'object' && k !== 'wx' && k !== 'active') st[k] = n[k];
  for (const g of ['settings', 'inv', 'pkg', 'backup', 'profile']) for (const k of Object.keys(n[g])) if (st[g][k] === undefined) st[g][k] = n[g][k];
  if (!st.locations[st.active]) st.active = Object.keys(st.locations)[0] || null;
  if (st.wx && !st.wx.raw) st.wx = null;
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
const locLabel = L => !L ? '' : (L.id === '1' && L.pkg ? 'Konum 1 · ' : '') + L.name;

// ---------------------------------------------------------------- stok
function baseStatus(it, size){ if (!it) return 'yok'; if (it.stock) return it.stock[size || '-'] || it.stock['-'] || 'yok'; return 'var'; }
function stockOf(id, size){
  const k = id + '|' + (size || '-'); const it = ITEMS[id];
  const q = S.inv.qty[k];
  if (q !== undefined && q !== null && q !== '') {
    const n = Number(q);
    if (n <= 0) return (S.inv.status[k] === 'alinacak' || baseStatus(it, size) === 'alinacak') ? 'alinacak' : 'bitti';
    return n < (LOW[it && it.cat] || 0) ? 'az' : 'var';
  }
  return S.inv.status[k] || baseStatus(it, size);
}
const usable = st => st === 'var' || st === 'az';
const sizesOf = it => (it.sizes && it.sizes.length) ? it.sizes : ['-'];
const ST_TXT = {var: 'Var', az: 'Az', bitti: 'Bitti', alinacak: 'Alınacak', yok: 'Yok'};
