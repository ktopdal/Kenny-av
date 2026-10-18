// ---------------------------------------------------------------- 20 · telefondaki durum (envanter adetleri, konumlar, tercih)
// Güncellemeler bu veriyi asla silmez: eksik alanlar eklenir, var olanlara dokunulmaz.
const STATE_KEY = 'kenny-av-v1';
let ITEMS = {}, SETUPS = {}, SPECIES = {}, RIGS = {};
function indexData(){
  ITEMS = Object.fromEntries(D.items.map(i => [i.id, i]));
  SETUPS = Object.fromEntries(D.setups.map(s => [s.id, s]));
  SPECIES = Object.fromEntries(D.species.map(s => [s.id, s]));
  RIGS = Object.fromEntries(D.rigs.map(r => [r.code, r]));
}
const POS = {ust: 'Üst', orta: 'Orta', hirsiz: 'Hırsız', braid: 'Ana ip', beden: 'Beden', kostek: 'Köstek'};
const BOTTOM = [['', 'Bilmiyorum'], ['kum', 'Kum'], ['kum-kayalik', 'Kum–kayalık'], ['kayalik', 'Kayalık'], ['saf-kayalik', 'Saf kayalık'], ['karma', 'Karma'], ['camur', 'Çamur']];
const BOTTOM_TXT = Object.assign(Object.fromEntries(BOTTOM), {'orta-su': 'Orta su', 'bilinmeyen': 'Bilinmeyen'});
const LOW = {hook: 5, terminal: 3, jig: 1, sinker: 5};   // bu adedin altı "az kaldı"

let S = null;
function newState(){
  const st = {v: 1, qty: {}, status: {}, locations: {}, active: '1', prefs: {qty_mode: 'adet'}, wx: null, seenVersion: null};
  (D.seed_status || []).forEach(x => { st.status[x.item + '|' + x.size] = x.status; if (x.qty != null) st.qty[x.item + '|' + x.size] = x.qty; });
  D.locations.forEach(l => { st.locations[l.id] = {id: l.id, name: l.name, lat: l.lat, lon: l.lon, bottom: l.bottom || '', depth: ''}; });
  return st;
}
function loadState(){
  let st = null; try { st = JSON.parse(lsGet(STATE_KEY) || 'null'); } catch (e) {}
  if (!st || st.v !== 1) { st = newState(); st.seenVersion = APP_VERSION; }
  // geçişler (v0.1 → v0.2): alanları tamamla
  st.qty = st.qty || {}; st.status = st.status || {}; st.prefs = st.prefs || {qty_mode: 'adet'};
  st.locations = st.locations || {}; if (!Object.keys(st.locations).length) D.locations.forEach(l => { st.locations[l.id] = {id: l.id, name: l.name, lat: l.lat, lon: l.lon, bottom: l.bottom || '', depth: ''}; });
  if (!st.locations[st.active]) st.active = Object.keys(st.locations)[0];
  if (st.weather) { delete st.weather; }          // v0.1 önbelleği, yeni biçimle yeniden çekilir
  if (st.wx && !st.wx.raw) st.wx = null;
  if (!('seenVersion' in st)) st.seenVersion = '0.1.0';
  S = st;
}
function persist(){ if (!lsSet(STATE_KEY, JSON.stringify(S))) { /* depolama dolu: hava önbelleğini bırak */ S.wx = null; lsSet(STATE_KEY, JSON.stringify(S)); } }

// ---------------------------------------------------------------- stok
function baseStatus(id, size){ const it = ITEMS[id]; if (!it) return 'yok'; return (it.stock && (it.stock[size || '-'] || it.stock['-'])) || 'yok'; }
function stockOf(id, size){
  const k = id + '|' + (size || '-');
  const q = S.qty[k];
  if (q !== undefined && q !== null && q !== '') {
    const n = Number(q), it = ITEMS[id];
    if (n <= 0) return (S.status[k] === 'alinacak' || baseStatus(id, size) === 'alinacak') ? 'alinacak' : 'bitti';
    return n < (LOW[it && it.cat] || 0) ? 'az' : 'var';
  }
  return S.status[k] || baseStatus(id, size);
}
const usable = st => st === 'var' || st === 'az';
function missingOf(rg){
  const m = [];
  for (const k of Object.keys(POS)) {
    const c = rg.components[k].envanter;
    const st = c.item ? stockOf(c.item, c.size) : 'yok';
    if (!usable(st)) m.push({k, c, st});
  }
  return m;
}
const ready = rg => missingOf(rg).length === 0;
const sizesOf = it => (it.sizes && it.sizes.length) ? it.sizes : ['-'];
const loc = () => S.locations[S.active] || Object.values(S.locations)[0];
