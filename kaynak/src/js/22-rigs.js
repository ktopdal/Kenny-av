// ---------------------------------------------------------------- 22 · rig sistemleri, envanter dizini, türler
// Genel rig biçimi: her rigin "yuvaları" (üst/orta/hırsız iğne, ana ip, beden, köstek…) ve her yuva için üç malzeme seviyesi:
// dunya (dünyanın en iyisi), turkiye (Türkiye'de bulunabilen en iyi), envanter (envanterden; hazır olma buna göre).
const TIERS = ['dunya', 'turkiye', 'envanter'];
const TIER_TXT = {dunya: 'Dünyanın en iyisi', turkiye: "Türkiye'de en iyi", envanter: 'Envanterimden'};
const SLOT_LBL = {ust: 'Üst', orta: 'Orta', hirsiz: 'Hırsız', braid: 'Ana ip', beden: 'Beden', kostek: 'Köstek'};
const LEN_LBL = {ust: 'köstek üst', orta: 'orta', hirsiz: 'hırsız', ara: 'köstek arası', kostek: 'köstek', lider: 'lider', sok: 'şok lider'};
const SPECIES_BASE = [
  ['cipura', 'Çipura', 'Sparus aurata'], ['karagoz', 'Karagöz', 'Diplodus vulgaris'], ['sargoz', 'Sargoz', 'Diplodus sargus'],
  ['isparoz', 'İsparoz', 'Diplodus annularis'], ['mercan', 'Mercan', 'Pagellus erythrinus'], ['fangri', 'Fangri', 'Pagrus pagrus'],
  ['sinarit', 'Sinarit', 'Dentex dentex'], ['sinagrit', 'Sinagrit', 'Dentex gibbosus'], ['tranca', 'Trança', 'Pagrus auriga'],
  ['eskina', 'Eşkina', 'Sciaena umbra'], ['akya', 'Akya', 'Lichia amia'], ['levrek', 'Levrek', 'Dicentrarchus labrax'],
  ['izmarit', 'İzmarit', 'Spicara smaris'], ['mirmir', 'Mırmır', 'Lithognathus mormyrus'], ['kupes', 'Kupes', 'Boops boops'],
  ['melanurya', 'Melanurya', 'Oblada melanura'], ['minakop', 'Minakop', 'Umbrina cirrosa'], ['lahos', 'Lahos', 'Epinephelus costae'],
  ['orfoz', 'Orfoz', 'Epinephelus marginatus'], ['iskorpit', 'İskorpit', 'Scorpaena porcus'], ['lipsoz', 'Lipsoz', 'Scorpaena scrofa'],
  ['kirlangic', 'Kırlangıç', 'Chelidonichthys lucerna'], ['barbunya', 'Barbunya', 'Mullus barbatus'], ['tekir', 'Tekir', 'Mullus surmuletus'],
  ['mezgit', 'Mezgit', 'Merlangius merlangus'], ['kalkan', 'Kalkan', 'Scophthalmus maximus'], ['dil', 'Dil', 'Solea solea'],
  ['palamut', 'Palamut', 'Sarda sarda'], ['lufer', 'Lüfer', 'Pomatomus saltatrix'], ['orkinos', 'Orkinos (mavi yüzgeçli)', 'Thunnus thynnus'],
  ['lambuka', 'Lambuka', 'Coryphaena hippurus'], ['zargana', 'Zargana', 'Belone belone'], ['istavrit', 'İstavrit', 'Trachurus spp.'],
  ['kolyoz', 'Kolyoz', 'Scomber colias'], ['uskumru', 'Uskumru', 'Scomber scombrus'], ['kefal', 'Kefal', 'Mugilidae'],
  ['kalamar', 'Kalamar', 'Loligo vulgaris'], ['ahtapot', 'Ahtapot', 'Octopus vulgaris'], ['murekkep', 'Mürekkep balığı', 'Sepia officinalis'],
].map(([id, name, latin]) => ({id, name, latin}));

let ITEMS = {}, SPECIES = {}, RIGS = {}, RIG_LIST = [], SETUPS = {};
const pkgOn = () => !!(D && S.systems.ozel);
function pkgRigs(){
  if (!pkgOn() || S.systems.ozel.active === false) return [];
  const setups = Object.fromEntries(D.setups.map(s => [s.id, s]));
  const tierOf = c => ({name: c.name, size: c.size, raw: c.raw});
  return D.rigs.map(rg => {
    const su = setups[rg.setup] || {}; const st = su.standard_cm || {};
    const slots = Object.keys(SLOT_LBL).filter(k => rg.components[k]).map(k => { const c = rg.components[k];
      return {k, label: SLOT_LBL[k], kind: ['ust', 'orta', 'hirsiz'].includes(k) ? 'hook' : 'line',
        t: {dunya: tierOf(c.dunya), turkiye: Object.assign(tierOf(c.magaza), {store: c.magaza.mark}), envanter: Object.assign(tierOf(c.envanter), {item: c.envanter.item || null})}}; });
    const lc = rg.leader_cm;
    const b3 = o => ({dunya: o.dunya, turkiye: o.magaza, envanter: String(o.envanter || '').replace(/✓/g, '').trim()});
    return {id: 'ozel:' + rg.code, sys: 'ozel', code: rg.code, name: rg.name, group: rg.setup, groupName: su.name || '', mode: 'tekne', tech: 'dip-hirsizli',
      time: rg.time, klass: rg.klass, species: rg.species || [], target: rg.target_text, baitText: rg.bait_text, bottom: rg.bottom || [],
      season: rg.season_months, window: rg.window, core: !!rg.must_prepare, current: !!rg.when_current, slots,
      baits: rg.baits ? {ana: b3(rg.baits.ana), alt: b3(rg.baits.alternatif)} : null,
      lengths: lc ? {ust: lc.ust, orta: lc.orta, hirsiz: lc.hirsiz, ara: st.aralik} : {ust: st.ust, orta: st.orta, hirsiz: st.hirsiz, ara: st.aralik}, own: !!lc,
      sinker: st.kursun_g ? {g: st.kursun_g.slice(), max: st.kursun_max_g} : null,
      success: rg.success ? {dunya: rg.success.dunya, turkiye: rg.success.magaza, envanter: rg.success.envanter} : null,
      notes: [].concat(rg.v2_change ? [{k: 'v2', t: rg.v2_change}] : [], (rg.warnings || []).filter(w => !/mevsimi/.test(w)).map(w => ({k: 'Not', t: w})), (rg.v1_notes || []).map(w => ({k: 'v1', t: w})))};
  });
}
function allRigs(){
  let out = pkgRigs();
  Object.values(S.systems).forEach(sy => { if (sy.source !== 'paket' && sy.active !== false && Array.isArray(sy.rigs)) out = out.concat(sy.rigs.map(r => Object.assign({sys: sy.id}, r))); });
  return out;
}
function indexAll(){
  ITEMS = {};
  if (pkgOn()) D.items.forEach(i => { ITEMS[i.id] = Object.assign({src: 'paket'}, i); });
  Object.values(S.inv.items).forEach(i => { ITEMS[i.id] = i; });
  SPECIES = Object.fromEntries(SPECIES_BASE.map(s => [s.id, Object.assign({}, s)]));
  if (D && D.species) D.species.forEach(s => { SPECIES[s.id] = Object.assign({}, SPECIES[s.id] || {}, s); });
  SETUPS = pkgOn() ? Object.fromEntries(D.setups.map(s => [s.id, s])) : {};
  RIG_LIST = allRigs(); RIGS = {};
  RIG_LIST.forEach(r => { RIGS[r.id] = r; });
  RIG_LIST.forEach(r => { if (r.code && !RIGS[r.code]) RIGS[r.code] = r; });   // eski av kayıtları rig koduyla bağlı
}
// açılan özel paketi profile bağla (paket kalemleri ve rigleri paketten okunur; burada yalnızca sistem, durum tohumları ve konumlar)
function importPackage(d){
  if (!d || !d.rigs) return;
  const before = JSON.stringify([S.systems.ozel, S.inv.status, S.pkg, S.locations, S.active, S.onboarded]);
  if (!S.systems.ozel) S.systems.ozel = {id: 'ozel', name: (d.meta && d.meta.system_name) || 'Özel rig sistemi', source: 'paket', active: true, created: new Date().toISOString()};
  if (d.meta && d.meta.system_name && S.systems.ozel.name !== d.meta.system_name) S.systems.ozel.name = d.meta.system_name;
  (d.seed_status || []).forEach(x => { const k = x.item + '|' + x.size; if (S.inv.status[k] == null && S.inv.qty[k] == null) S.inv.status[k] = x.status; });
  S.pkg.locs = S.pkg.locs || [];
  (d.locations || []).forEach(l => {
    if (S.pkg.locs.includes(l.id)) return;
    S.pkg.locs.push(l.id);
    const same = Object.values(S.locations).find(x => distKm(x, l) < 0.3);
    if (same) { same.pkg = true; return; }
    const id = S.locations[l.id] ? nextLocId() : l.id;
    S.locations[id] = {id, name: l.name, lat: l.lat, lon: l.lon, bottom: l.bottom || '', depth: '', pkg: true};
  });
  Object.values(S.locations).forEach(x => { if (!x.pkg && (d.locations || []).some(l => l.id === x.id && distKm(x, l) < 0.3)) x.pkg = true; });
  if (!S.active || !S.locations[S.active]) S.active = Object.keys(S.locations)[0] || null;
  S.pkg.unlocked = true; S.pkg.version = d.meta && d.meta.data_version; S.pkg.need = false; S.onboarded = true;
  if (JSON.stringify([S.systems.ozel, S.inv.status, S.pkg, S.locations, S.active, S.onboarded]) !== before) persist();
}
// ---- hazır olma (envanter seviyesine göre)
function slotStock(sl){ const e = sl.t && sl.t.envanter; return e && e.item ? stockOf(e.item, e.size) : 'yok'; }
const missingOf = rg => rg.slots.filter(sl => !usable(slotStock(sl)));
const ready = rg => missingOf(rg).length === 0;
const sysName = id => (S.systems[id] && S.systems[id].name) || id;
// alışveriş: eksik yuvalar kaleme göre toplanır; aynı rig bir kez sayılır
function shoppingList(){
  const need = {};
  RIG_LIST.forEach(rg => missingOf(rg).forEach(sl => {
    const e = sl.t.envanter || {}; const tk = sl.t.turkiye || {};
    const k = e.item ? e.item + '|' + (e.size || '-') : 'x|' + (tk.name || e.name || sl.label) + '|' + (tk.size || '');
    const n = need[k] = need[k] || {k, item: e.item || null, size: e.item ? e.size : tk.size, name: e.item ? null : (tk.name || e.name), store: tk.store || null, rigs: []};
    if (!n.rigs.includes(rg.code || rg.name)) n.rigs.push(rg.code || rg.name);
  }));
  return Object.values(need);
}
