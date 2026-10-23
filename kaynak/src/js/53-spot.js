// ---------------------------------------------------------------- 53 · nokta hafızası (R1) ve envanterden yedek (R3) · v0.22
// R1: Noktanın 1,5 km çevresindeki av kayıtları ve "bağladım" bildirimlerinden o noktada en çok tutan 3 rig ve türler çıkar.
//     Öneride o noktanın ilk 3 rigi öne geçer (1. +1,5 · 2. +1 · 3. +0,7); tek av kaydıyla da çalışır.
// R3: Bir rig yalnız eksik iğne ya da ip yüzünden önerilemiyorsa envanterde elde olan uyumlu bir yedek aranır: iğnede aynı ya da
//     uyumlu desen, en çok bir boy fark; ipte aynı tür (köstekte florokarbon ↔ misina), çap ±%12. Hepsi bulunursa rig "yedekle hazır" olur.
const SPOT_KM = 1.5;
const SPOT_C = {};
function spotMemory(L){
  if (!L) return null;
  const fbs = fbAll().filter(f => f.res === 'tuttu' || f.res === 'tutmadi');
  const key = CATCHES_V + ':' + fbs.length + ':' + fbs.map(f => f.res[3]).join('') + ':' + L.lat + ',' + L.lon;
  if (SPOT_C[L.id] && SPOT_C[L.id].key === key) return SPOT_C[L.id].res;
  const near = p => !!p && p.lat != null && distKm(L, p) <= SPOT_KM;
  const rigs = {}, sp = {}; let n = 0, fish = 0;
  const R = id => rigs[id] = rigs[id] || {id, fish: 0, av: 0, ok: 0, no: 0};
  CATCHES.forEach(c => { if (!c || !near(c.loc)) return; const k = Math.max(1, c.count || 1); fish += k; n++;
    if (c.species && c.species !== 'diger') sp[c.species] = (sp[c.species] || 0) + k;
    if (c.rig) { const r = R(c.rig); r.fish += k; r.av++; } });
  fbs.forEach(f => { if (!near(f.loc) || !f.rig) return; R(f.rig)[f.res === 'tuttu' ? 'ok' : 'no']++; });
  const all = Object.values(rigs).map(r => Object.assign(r, {sc: r.fish + r.ok * 1.5 - r.no * 1.2}));
  const res = {n, fish, nfb: fbs.filter(f => near(f.loc)).length, top: all.filter(r => r.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 3),
    sp: Object.entries(sp).sort((a, b) => b[1] - a[1]).slice(0, 4), weak: all.filter(r => r.no > r.ok && !r.fish)};
  SPOT_C[L.id] = {key, res};
  return res;
}
const spotIdx = (sm, rg) => !sm ? -1 : sm.top.findIndex(r => r.id === rg.id || (!!rg.code && r.id === rg.code));
const spotRigName = id => RIGS[id] ? (RIGS[id].code || RIGS[id].name) : id;
const spotRigTxt = r => spotRigName(r.id) + ' (' + [r.fish ? r.fish + ' balık' : '', r.ok ? r.ok + ' kez tuttu' : '', r.no ? r.no + ' kez tutmadı' : ''].filter(Boolean).join(', ') + ')';
function spotLine(L){
  const sm = spotMemory(L); if (!sm || (!sm.n && !sm.nfb)) return '';
  return 'Bu noktada ' + (sm.n ? sm.n + ' av kaydı, ' + sm.fish + ' balık' : sm.nfb + ' bildirim') + (sm.top.length ? ' · en iyi: ' + sm.top.map(spotRigTxt).join(', ') : '') +
    (sm.sp.length ? ' · türler: ' + sm.sp.map(([id, k]) => spName(id) + ' ' + k).join(', ') : '');
}
// ---- R3 · envanterden yedek
let SUB_C = {};
function subSlot(sl){
  const e = sl.t.envanter || {}, it0 = e.item && ITEMS[e.item];
  const isHook = sl.kind === 'hook' || sl.kind === 'hook+' || (it0 && it0.cat === 'hook') || (sl.sp && sl.sp.kind === 'hook' && sl.sp.p && !['assist', 'jighead', 'sabiki', 'treble'].includes(sl.sp.p[0]));
  const isLine = sl.kind === 'line' || ['braid', 'beden', 'kostek', 'sok', 'mono'].includes(sl.kind) || (it0 && ['fc', 'mono', 'braid'].includes(it0.cat)) || (sl.sp && sl.sp.kind === 'line');
  if (isHook) {
    const p0 = it0 ? patOf(it0) : sl.sp && sl.sp.p ? sl.sp.p[0] : null;
    const h0 = e.size ? hookIdx(e.size) : sl.sp && sl.sp.sc ? {sc: sl.sp.sc, v: Math.round((sl.sp.lo + sl.sp.hi) / 2)} : null;
    if (!p0 || !h0) return null;
    let best = null;
    Object.values(ITEMS).forEach(it => {
      if (it.cat !== 'hook') return; const p = patOf(it); if (!p) return;
      const same = p === p0; if (!same && !KB.COMPAT.some(g => g.includes(p) && g.includes(p0))) return;
      sizesOf(it).forEach(sz => {
        if (it.id === e.item && sz === e.size) return;
        const h = hookIdx(sz); if (!h || h.sc !== h0.sc) return; const dv = h.v - h0.v; if (Math.abs(dv) > 1) return;
        if (!usable(stockOf(it.id, sz))) return;
        const sc = Math.abs(dv) * 2 + (same ? 0 : 1) + (dv < 0 ? 0.2 : 0);
        if (!best || sc < best.sc) best = {sc, item: it.id, name: it.name, size: sz, dv, same};
      });
    });
    return best ? {sl, to: best, txt: sl.label + ': ' + best.name + ' ' + best.size + (best.dv ? ' (bir boy ' + (best.dv > 0 ? 'büyük' : 'küçük') + ')' : best.same ? '' : ' (benzer desen)')} : null;
  }
  if (isLine) {
    const mm0 = it0 ? lineMm(it0) : e.size ? lineMm({name: e.size}) : sl.sp && sl.sp.lo ? (sl.sp.lo + sl.sp.hi) / 2 : null;
    if (!mm0) return null;
    const cats = it0 ? (it0.cat === 'braid' ? ['braid'] : [it0.cat, it0.cat === 'fc' ? 'mono' : 'fc']) : sl.sp && sl.sp.cats ? sl.sp.cats : ['fc', 'mono'];
    let best = null;
    Object.values(ITEMS).forEach(it => {
      if (!cats.includes(it.cat) || it.id === e.item) return; const mm = lineMm(it); if (!mm) return;
      const d = (mm - mm0) / mm0; if (Math.abs(d) > 0.12) return;
      if (!usable(stockOf(it.id, '-'))) return;
      const sc = Math.abs(d) * 10 + cats.indexOf(it.cat) * 0.6 + (d < 0 ? 0.2 : 0);
      if (!best || sc < best.sc) best = {sc, item: it.id, name: it.name, mm, d};
    });
    return best ? {sl, to: best, txt: sl.label + ': ' + best.name + (best.name.indexOf(String(best.mm).replace('.', ',')) < 0 && best.name.indexOf(String(best.mm)) < 0 ? ' ' + mmTxt(best.mm) : '') + (Math.abs(best.d) >= 0.03 ? ' (' + (best.d > 0 ? 'biraz kalın' : 'biraz ince') + ')' : '')} : null;
  }
  return null;
}
function subFor(rg){
  if (Object.prototype.hasOwnProperty.call(SUB_C, rg.id)) return SUB_C[rg.id];
  const miss = missingOf(rg); let res = null;
  if (miss.length && miss.length <= 3) {
    const list = [];
    for (const sl of miss) { const c = subSlot(sl); if (!c) { list.length = 0; break; } list.push(c); }
    if (list.length === miss.length) res = {complete: true, list};
  }
  SUB_C[rg.id] = res;
  return res;
}
