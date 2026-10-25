// ---------------------------------------------------------------- 22 · rig sistemleri, envanter dizini, türler
// Genel rig biçimi: her rigin "yuvaları" (üst/orta/hırsız iğne, ana ip, beden, köstek…) ve her yuva için malzeme seviyeleri:
// dunya (dünyanın en iyisi: yalnız 32'lik özel sistemde, yalnız Rigler seçicisinde), turkiye (Türkiye'de bulunabilen en iyi), envanter (envanterden; hazır olma buna göre).
const TIERS = ['dunya', 'turkiye', 'envanter'];
const TIER_TXT = {dunya: 'Dünyanın en iyisi', turkiye: "Türkiye'de en iyi", envanter: 'Envanterimden'};
const SLOT_LBL = {ust: 'Üst', orta: 'Orta', hirsiz: 'Hırsız', braid: 'Ana ip', beden: 'Beden', kostek: 'Köstek'};
const LEN_LBL = {ust: 'köstek üst', orta: 'orta', hirsiz: 'hırsız', ara: 'köstek arası', kostek: 'köstek', lider: 'lider', sok: 'şok lider'};
const SPECIES_BASE = KB.SPECIES;   // 21-kb.js

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
  }).map(rg => {
    // v0.24: kamış ve makine yuvaları (kurulumdaki takım önce; envanterdeki en uygun çift, 28-gear.js)
    const su = setups[rg.group] || {};
    const gs = (k, label, kind, o, txt) => ({k, label, kind, sp: {kind, types: o.types, cls: o.cls, minLen: o.minLen || null},
      t: {dunya: {name: txt || o.name}, turkiye: {name: o.name, size: o.spec}, envanter: {item: null, name: txt || '', size: null}}});
    rg.slots.push(gs('kamis', 'Kamış', 'rod', DIP_GEAR.rod, su.rods_text), gs('makine', 'Makine', 'reel', DIP_GEAR.reel, su.reel_text));
    return applyGear(rg);
  });
}
function allRigs(){
  let out = pkgRigs();
  Object.values(S.systems).forEach(sy => { if (sy.source !== 'paket' && sy.active !== false && Array.isArray(sy.rigs)) out = out.concat(sy.rigs.map(r => resolveRig(Object.assign({sys: sy.id}, r)))); });
  // v0.23: rig parçası sayfasından seçilen değişim (S.rigOv["rigId|yuva"] = {item, size}); kalem envanterden silinmişse yok sayılır
  const ov = S.rigOv || {};
  out.forEach(rg => rg.slots.forEach(sl => { const o = ov[rg.id + '|' + sl.k]; if (!o || !ITEMS[o.item] || sl.kind === 'rod' || sl.kind === 'reel') return;   // kamış/makine: applyGear
    const e = sl.t.envanter || {}; sl.orig = {item: e.item || null, size: e.size || null, name: e.name || null};
    sl.t.envanter = Object.assign({}, e, {item: o.item, size: o.size && o.size !== '-' ? o.size : null, name: null}); sl.ov = true; }));
  return out;
}
function indexAll(){
  ITEMS = {};
  if (pkgOn()) D.items.forEach(i => { ITEMS[i.id] = Object.assign({src: 'paket'}, i); });
  Object.values(S.inv.items).forEach(i => { ITEMS[i.id] = i; });
  const own = Object.values(ITEMS);
  STD.forEach(s => { if (!ITEMS[s.id] && !stdHidden(s, own)) ITEMS[s.id] = s; });   // 23-std.js: hazır liste
  migrateInv();
  SPECIES = Object.fromEntries(SPECIES_BASE.map(s => [s.id, Object.assign({}, s)]));
  if (D && D.species) D.species.forEach(s => { SPECIES[s.id] = Object.assign({}, SPECIES[s.id] || {}, s); });
  SETUPS = pkgOn() ? Object.fromEntries(D.setups.map(s => [s.id, s])) : {};
  RIG_LIST = allRigs(); RIGS = {};
  RIG_LIST.forEach(r => { RIGS[r.id] = r; });
  RIG_LIST.forEach(r => { if (r.code && !RIGS[r.code]) RIGS[r.code] = r; });   // eski av kayıtları rig koduyla bağlı
  SUB_C = {};   // envanter değişti: yedek aramaları yeniden (53-spot.js)
}
// açılan özel paketi profile bağla (paket kalemleri ve rigleri paketten okunur; burada yalnızca sistem, durum tohumları ve konumlar)
function importPackage(d){
  if (!d || !d.rigs) return;
  const before = JSON.stringify([S.systems.ozel, S.inv.status, S.pkg, S.locations, S.active, S.onboarded, S.settings.gkey]);
  if (!S.systems.ozel) S.systems.ozel = {id: 'ozel', name: (d.meta && d.meta.system_name) || 'Özel rig sistemi', source: 'paket', active: true, created: new Date().toISOString()};
  if (d.settings && d.settings.gkey && !S.settings.gkey) S.settings.gkey = d.settings.gkey;   // paketle gelen harita anahtarı (kullanıcı kendi anahtarını girdiyse ona dokunulmaz)
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
  if (JSON.stringify([S.systems.ozel, S.inv.status, S.pkg, S.locations, S.active, S.onboarded, S.settings.gkey]) !== before) persist();
}
// ---- hazır olma (envanter seviyesine göre)
function slotStock(sl){ const e = sl.t && sl.t.envanter; return e && e.item ? stockOf(e.item, e.size) : 'yok'; }
// kamış/makine envanterden girildi ama rige uymuyorsa (ve bilerek seçilmediyse) eksik sayılır (28-gear.js)
const slotBad = sl => sl.fit === 'bad' && !sl.user;
const missingOf = rg => rg.slots.filter(sl => !usable(slotStock(sl)) || slotBad(sl));
const ready = rg => missingOf(rg).length === 0;
const sysName = id => (S.systems[id] && S.systems[id].name) || id;
// alışveriş: rigleri tamamlamak için eksik yuvalar (kaleme göre, aynı rig bir kez) + bitti / alınacak işaretli kalemler (rigde olmasa da; yemler hariç)
function shoppingList(){
  const need = {};
  const add = (k, o) => need[k] = need[k] || Object.assign({k, rigs: [], why: []}, o);
  RIG_LIST.forEach(rg => missingOf(rg).forEach(sl => {
    const e0 = sl.t.envanter || {}; const tk = sl.t.turkiye || {};
    const e = slotBad(sl) ? {} : e0;   // uymayan kamış/makine: o kalem değil, gereken ölçü alınır
    const k = e.item ? e.item + '|' + (e.size || '-') : 'x|' + (tk.name || e.name || sl.label) + '|' + (tk.size || '');
    const sp = sl.sp && slotBad(sl) && sl.kind === 'rod' && rg.gear && rg.gear.need.g ? Object.assign({}, sl.sp, {minG: rg.gear.need.g[1]}) : sl.sp || null;
    const n = add(k, {item: e.item || null, size: e.item ? e.size : tk.size, name: e.item ? null : (tk.name || e.name), store: tk.store || null, kind: sl.kind, sp});
    if (!n.why.includes('rig')) n.why.push('rig');
    if (!n.rigs.includes(rg.code || rg.name)) n.rigs.push(rg.code || rg.name);
  }));
  Object.values(ITEMS).forEach(it => { if (it.cat === 'bait') return; sizesOf(it).forEach(sz => {
    const k = it.id + '|' + sz; const st = stockOf(it.id, sz);
    if (!toBuy(st) && S.inv.status[k] !== 'alinacak') return;
    const n = add(k, {item: it.id, size: sz !== '-' ? sz : null, name: null, store: null, kind: it.cat, sp: null});
    const w = st === 'bitti' ? 'bitti' : 'alinacak'; if (!n.why.includes(w)) n.why.push(w);
  }); });
  // tür planından aktarılanlar ("İstavrit için"): alınınca (envanterde var olunca) kendiliğinden düşer
  const today = dateKey(new Date());
  Object.values(S.shopX || {}).forEach(x => {
    if (x.until && x.until < today) return;   // çıkışı geçmiş yem planı (54-trip.js)
    if (x.item) { if (!ITEMS[x.item] || usable(stockOf(x.item, x.size || '-'))) return; }
    if (x.sp) { try { if (resolveSlot(x.sp).strict) return; } catch (e) {} }   // başka bir kalemle karşılandı (ör. kamışı formdan ekledin)
    const n = add(x.k, {item: x.item || null, size: x.size || null, name: x.item ? null : x.name, store: x.store || null, kind: x.kind, sp: x.sp || null});
    if (!n.sp && x.sp) n.sp = x.sp;
    if (x.dan) n.dan = x.dan;   // takım danışmanından (58b-danisman.js)
    (x.for || []).forEach(f => { const w = (x.kind === 'bait' ? 'yem:' : 'tur:') + f; if (!n.why.includes(w)) n.why.push(w); });
  });
  return Object.values(need);
}
