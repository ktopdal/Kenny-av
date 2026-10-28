// ---------------------------------------------------------------- 26 · Rig Atölyesi motoru: cevaplardan rig sistemi kurar ve envanterle eşleştirir
// Her yuvanın bir "ölçüsü" vardır (iğne deseni + boy aralığı, ip çapı aralığı, yem tipi + ağırlık). İki seviye:
//   turkiye  → envanterde ölçüye tam uyan kalem varsa o (✓), yoksa Türkiye'de bulunan en iyi seri
//   envanter → envanterdeki en yakın uyumlu kalem (gerekirse bir boy oynar); yoksa eksik
function hookIdx(s){
  s = String(s == null ? '' : s).trim();
  let m = s.match(/^no\s*[:.]?\s*(\d+)/i); if (m) return {sc: 'jp', v: +m[1]};
  m = s.match(/(\d+)\s*\/\s*0/); if (m) return {sc: 'w', v: +m[1] - 1};
  m = s.match(/^(?:euro\s*|#\s*)?(\d+)$/i); if (m) return {sc: 'w', v: -(+m[1])};
  return null;
}
const hookFmt = (sc, v) => sc === 'jp' ? 'No:' + v : v >= 0 ? (v + 1) + '/0' : '#' + (-v);
const wRange = a => a ? [hookIdx(a[0]).v, hookIdx(a[1]).v] : null;
const PE_MM = [[0.3, 0.09], [0.4, 0.104], [0.6, 0.128], [0.8, 0.148], [1, 0.165], [1.2, 0.185], [1.5, 0.205], [2, 0.235], [2.5, 0.26], [3, 0.285], [4, 0.33], [5, 0.37], [6, 0.405], [8, 0.47], [10, 0.52]];
const peOf = mm => PE_MM.reduce((b, x) => Math.abs(x[1] - mm) < Math.abs(b[1] - mm) ? x : b)[0];
const mmTxt = mm => mm.toFixed(mm < 0.1 ? 3 : 2).replace(/0$/, '').replace('.', ',') + ' mm';
function patOf(it){
  if (it.pattern) { const k = Object.keys(KB.PAT).find(p => KB.PAT[p].name === it.pattern); if (k) return k; }
  const t = trLower([it.type, it.model, it.name].join(' '));
  if (/chinu/.test(t)) return 'chinu'; if (/maruseigo/.test(t)) return 'maruseigo'; if (/iseama/.test(t)) return 'iseama';
  if (/assist/.test(t)) return 'assist'; if (/jig ?head/.test(t)) return 'jighead'; if (/çapari|capari|sabiki/.test(t)) return 'sabiki';
  if (/treble|üçlü|uclu/.test(t)) return 'treble'; if (/circle|mutsu|mutu/.test(t)) return 'circle';
  if (/uzun pala|aberdeen/.test(t)) return 'aberdeen'; if (/baitholder|pala/.test(t)) return 'baitholder';
  if (/live ?bait|canlı yem|hoodlum/.test(t)) return 'livebait'; if (/octopus|beak|ssw/.test(t)) return 'octopus';
  if (/gorilla|jobu|forged|dövme|j-hook|j hook/.test(t)) return 'jforged';
  return null;
}
function lineMm(it){
  const t = [it.name, it.model, it.spec].join(' ').replace(/(\d),(\d)/g, '$1.$2');
  let m = t.match(/(\d+\.\d+)\s*mm/i) || t.match(/\b(0\.\d{2,3})\b/); if (m) return +m[1];
  m = t.match(/pe\s*#?\s*(\d+(?:\.\d+)?)/i); if (m) { const pe = +m[1]; return PE_MM.reduce((b, x) => Math.abs(x[0] - pe) < Math.abs(b[0] - pe) ? x : b)[1]; }
  return null;
}
const lureG = it => { const m = [it.name, it.model, it.spec].join(' ').match(/(\d+(?:[.,]\d+)?)\s*g\b/i); return m ? +m[1].replace(',', '.') : null; };
// ölçüye göre envanterden en iyi kalem: {strict, loose}
function resolveSlot(sp){
  let best = null, bestS = null;
  const take = (c, strict) => { if (!best || c.score < best.score) best = c; if (strict && (!bestS || c.score < bestS.score)) bestS = c; };
  Object.values(ITEMS).forEach(it => {
    if (sp.kind === 'rod' || sp.kind === 'reel' || sp.kind === 'term') { resolveGear(sp, it, take); return; }   // 27-req.js
    if (sp.kind === 'hook') {
      if (it.cat !== 'hook') return; const p = patOf(it); if (!p) return;
      const pref = sp.p.indexOf(p);
      if (pref < 0 && !KB.COMPAT.some(g => g.includes(p) && sp.p.some(q => g.includes(q)))) return;
      const mid = (sp.lo + sp.hi) / 2;
      sizesOf(it).forEach(sz => {
        const h = hookIdx(sz); if (!h || h.sc !== sp.sc) return;
        const inR = h.v >= sp.lo && h.v <= sp.hi; if (!inR && (h.v < sp.lo - 1 || h.v > sp.hi + 1)) return;
        const ok = usable(stockOf(it.id, sz));
        // elde yoksa: önce kendi (bitti/alınacak) kalemin, sonra hazır listedeki Türkiye'de bulunan seri önerilir
        const stdPen = it.std ? (it.rank === 0 ? 0.2 : it.rank === 1 ? 0.4 : 0.6) : 0;
        take({item: it.id, name: it.name, size: sz, ok, score: (pref >= 0 ? pref : 6) * 2 + Math.abs(h.v - mid) + (inR ? 0 : 3) + (ok ? 0 : 20) + stdPen}, ok && inR && pref >= 0 && pref <= 1);
      });
    } else if (sp.kind === 'line') {
      if (!sp.cats.includes(it.cat)) return; const mm = lineMm(it); if (mm == null) return;
      const inR = mm >= sp.lo * 0.93 && mm <= sp.hi * 1.07; if (!inR && (mm < sp.lo * 0.8 || mm > sp.hi * 1.25)) return;
      const ok = usable(stockOf(it.id, '-')); const mid = (sp.lo + sp.hi) / 2;
      take({item: it.id, name: it.name, size: null, ok, score: Math.abs(mm - mid) / mid * 10 + (inR ? 0 : 3) + (ok ? 0 : 20) + sp.cats.indexOf(it.cat) * 2}, ok && inR && it.cat === sp.cats[0]);
    } else if (sp.kind === 'lure') {
      // sahte yem tipi eşleşmeli (slow jig yuvasına metal jig ya da jighead girmez); ağırlık ve çapari boyu aralığa bakılır, her boy ayrı denenir
      if (!['jig', 'lure', 'hook', 'terminal'].includes(it.cat)) return;
      const lt = sp.lt || lureTypeFromKw(sp.kw); const okT = lt ? (LURE_OK[lt] || [lt]) : null;
      const ty = lureTypeOf(it);
      if (okT) { if (!okT.includes(ty)) return; }
      else { const t = trLower([it.name, it.model, it.spec, it.type].join(' ')); if (!(sp.kw || []).some(k => t.indexOf(trLower(k)) >= 0)) return; }
      const pref = okT ? okT.indexOf(ty) : 0;
      const hs = sp.hs ? wRange(sp.hs) : null;
      sizesOf(it).forEach(sz => {
        const g = sz !== '-' ? lureG({name: sz}) : null; const gi = g != null ? g : lureG(it);
        let inR = !sp.g || gi == null || (gi >= sp.g[0] * 0.8 && gi <= sp.g[1] * 1.2);
        if (sp.g && gi != null && (gi < sp.g[0] * 0.5 || gi > sp.g[1] * 2)) return;
        let dist = 0;
        if (hs && sz !== '-') { const h = hookIdx(sz); if (h && h.sc === 'w') { const lo = Math.min(hs[0], hs[1]), hi = Math.max(hs[0], hs[1]); if (h.v < lo - 1 || h.v > hi + 1) return; if (h.v < lo || h.v > hi) inR = false; dist = Math.abs(h.v - (lo + hi) / 2) / Math.max(1, hi - lo); } }
        else if (sp.g && g != null) dist = Math.abs(g - (sp.g[0] + sp.g[1]) / 2) / ((sp.g[0] + sp.g[1]) / 2);
        const ok = usable(stockOf(it.id, sz));
        take({item: it.id, name: it.name, size: sz !== '-' ? sz : null, ok, score: pref * 2 + dist + (inR ? 0 : 3) + (ok ? 0 : 20) + (it.std ? 0.5 : 0)}, ok && inR && pref === 0);
      });
    }
  });
  return {strict: bestS, loose: best};
}
// sihirbaz rigini o anki envanterle çöz (envanter değişince rigler kendiliğinden güncellenir)
function resolveRig(rg){
  const base = rg.slots.some(sl => sl.kind === 'rod') ? rg.slots : rg.slots.concat(reqSlots(rg));   // kamış, makine ve terminal yuvaları (27-req.js)
  // "Dünyanın en iyisi" yalnız özel pakette; diğer sistemlerde (eski kayıtlarda da) atılır
  const noW = t => { const o = Object.assign({}, t || {}); delete o.dunya; return o; };
  const slots = base.map(sl => {
    if (!sl.sp) return Object.assign({}, sl, {t: noW(sl.t)});
    const r = resolveSlot(sl.sp);
    const t = {turkiye: r.strict ? {name: r.strict.name, size: r.strict.size, item: r.strict.item, inv: true} : sl.t.turkiye,
      envanter: r.loose ? {name: r.loose.name, size: r.loose.size, item: r.loose.item} : {name: '', size: null, item: null}};
    return Object.assign({}, sl, {t});
  });
  const baits = rg.baits ? {ana: noW(rg.baits.ana), alt: noW(rg.baits.alt)} : rg.baits;
  return applyGear(Object.assign({}, rg, {slots, baits}));   // kamış + makine çifti (28-gear.js)
}
// ---- yuva ölçüsü ve ürün önerisi
function hookSpec(spec, plus){
  let pats = spec.p.slice(); let sc = KB.PAT[pats[0]].sc;
  if (sc === 'jp' && !spec.jp) sc = 'w';
  if (sc === 'w' && !spec.w) sc = 'jp';
  pats = pats.filter(p => KB.PAT[p].sc === sc).concat(pats.filter(p => KB.PAT[p].sc !== sc));
  let [lo, hi] = sc === 'jp' ? spec.jp : wRange(spec.w);
  if (plus) { lo += 1; hi += 1; }
  return {kind: 'hook', p: pats, sc, lo, hi, big: !!spec.big};
}
function prodHook(sp){
  const p0 = sp.p[0]; const prod = (sp.big && p0 === 'circle') ? KB.HOOK.bigcircle : KB.HOOK[p0] || KB.HOOK.octopus;
  const sz = hookFmt(sp.sc, Math.round((sp.lo + sp.hi) / 2));
  return {turkiye: {name: prod.turkiye, size: sz}};
}
function prodLine(sp, kind){
  const mid = (sp.lo + sp.hi) / 2;
  const prod = kind === 'braid' ? KB.LINE.braid : kind === 'mono' ? KB.LINE.mono : kind === 'sok' ? KB.LINE.shock : (sp.lo >= 0.8 ? KB.LINE.fcbig : KB.LINE.fc);
  const sz = mmTxt(mid) + (kind === 'braid' ? ' (≈PE ' + String(peOf(mid)).replace('.', ',') + ')' : '');
  return {turkiye: {name: prod.turkiye, size: sz}};
}
const rangeTxt = sp => sp.kind === 'hook' ? KB.PAT[sp.p[0]].name + ' ' + hookFmt(sp.sc, sp.lo) + '–' + hookFmt(sp.sc, sp.hi) :
  sp.kind === 'line' ? mmTxt(sp.lo) + '–' + mmTxt(sp.hi) : (sp.g ? sp.g[0] + '–' + sp.g[1] + ' g' : '');
function slotFor(role, F, X, klass, rock){
  const fk = o => o ? (o[klass] || o.porsiyon || o.trofe) : null;
  if (role === 'hook' || role === 'hook+') {
    const spec = X.hook || fk(F.hook); if (!spec) return null;
    const sp = hookSpec(spec, role === 'hook+'); return {sp, t: prodHook(sp)};
  }
  if (role === 'assist' || role === 'jighead') {
    const sp = {kind: 'hook', p: [role], sc: 'w', lo: wRange(X[role])[0], hi: wRange(X[role])[1]};
    const t = prodHook(sp); if (role === 'jighead' && X.g) { t.turkiye.size += ' · ' + X.g.join('–') + ' g'; }
    return {sp, t};
  }
  if (['braid', 'beden', 'kostek', 'sok', 'mono'].includes(role)) {
    let r = role === 'braid' ? (X.braid || fk(F.ana)) : role === 'mono' ? (X.mono || fk(F.ana)) : role === 'sok' ? X.sok : role === 'beden' ? fk(F.beden) : (X.kostek || fk(F.kostek));
    if (!r) return null;
    if (rock && (role === 'kostek' || role === 'beden')) r = [r[0] + 0.04, r[1] + 0.04];
    const cats = role === 'braid' ? ['braid'] : role === 'mono' ? ['mono', 'braid'] : role === 'sok' ? ['mono', 'fc'] : ['fc', 'mono'];
    const sp = {kind: 'line', cats, lo: r[0], hi: r[1]};
    return {sp, t: prodLine(sp, role)};
  }
  if (role.indexOf('lure:') === 0) {
    const type = role.slice(5); const L = KB.LURE[type];
    const sp = {kind: 'lure', lt: type, kw: L.kw, g: X.g || null, hs: type === 'sabiki' && X.sabiki ? X.sabiki : null};
    const sz = type === 'egi' ? X.egi : type === 'sabiki' && X.sabiki ? '#' + X.sabiki[0] + '–#' + X.sabiki[1] : X.g ? X.g[0] + '–' + X.g[1] + ' g' : '';
    return {sp, t: {turkiye: {name: L.turkiye, size: sz}}};
  }
  return null;
}
const KLASS_TXT = {porsiyon: 'Porsiyonluk', trofe: 'Trofe'}, TIME_TXT = {gunduz: 'gündüz', gece: 'gece', her: 'gündüz/gece'};
function topBaits(list, time){
  const cnt = {};
  list.forEach(s => { const arr = (time === 'gece' ? (s.b.n || s.b.g) : time === 'gunduz' ? (s.b.g || s.b.n) : (s.b.g || []).concat(s.b.n || [])) || []; arr.forEach((b, i) => { cnt[b] = (cnt[b] || 0) + (3 - Math.min(i, 2)); }); });
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(x => x[0]);
}
// sihirbazda seçilen yemler: türün yemleri arasındaysa öne alınır; aileye uygunsa alternatif olarak eklenir (rig yemden bağımsızdır, yalnızca öneri)
function prefBaits(list, pref, fam){
  pref = Array.isArray(pref) ? pref : [];
  if (!pref.length) return list;
  const isPref = t => pref.includes(baitKey(t));
  const out = list.filter(isPref).concat(list.filter(t => !isPref(t)));
  const have = new Set(out.map(baitKey).filter(Boolean));
  const extra = pref.filter(k => !have.has(k) && (FAM_BAITS[fam] || []).includes(k)).map(k => (STD_BAITS.find(x => x.key === k) || {}).name).filter(Boolean);
  out.splice(Math.min(1, out.length), 0, ...extra);
  return out;
}
function makeRig(ans, tid, lay, fam, list, klass, time, rock, n){
  const T = KB.TECH[tid], L = KB.LAY[lay], F = KB.FAM[fam] || {}, X = KB.FIX[lay] || {};
  const slots = [];
  L.slots.forEach(([k, label, role]) => { const s = slotFor(role, F, X, klass, rock); if (s) slots.push({k, label, kind: role.indexOf('lure') === 0 ? 'lure' : role, sp: s.sp, t: s.t}); });
  const std = KB.STD[klass] || KB.STD.porsiyon; const tk = time === 'gece' ? 'gece' : 'gunduz';
  let lengths = null, sinker = null;
  if (lay === 'hirsizli') lengths = rock ? {ust: 8, orta: 10, hirsiz: 20, ara: std.gunduz.ara} : Object.assign({}, std[tk]);
  else if (lay === 'iki') lengths = rock ? {ust: 10, hirsiz: 25, ara: std.gunduz.ara} : {ust: std[tk].ust, hirsiz: std[tk].hirsiz, ara: std[tk].ara};
  else if (lay === 'tek') lengths = {kostek: rock ? 40 : klass === 'trofe' ? 120 : 80};
  else if (lay === 'kaydirmali') lengths = {kostek: rock ? 40 : 80};
  else if (lay === 'canli') lengths = {kostek: 150};
  else if (X.len) lengths = Object.assign({}, X.len);
  const rodMax = num(ans.rodMax);
  if (['hirsizli', 'iki', 'tek'].includes(lay)) sinker = {g: std.g.slice(), max: rodMax || std.max};
  else if (lay === 'kaydirmali') sinker = ans.mode === 'kiyi' || tid === 'surf' ? {g: [30, 80], max: rodMax || 120} : {g: [60, 120], max: rodMax || 150};
  else if (lay === 'canli') sinker = {g: [150, 300], max: rodMax || 300};
  else if (lay === 'canliagir') sinker = {g: X.g.slice(), max: rodMax || X.g[1]};
  else if (lay === 'paternoster' || lay === 'capari' || lay === 'samandira') sinker = X.g ? {g: X.g.slice(), max: rodMax || X.g[1]} : null;
  const months = list.every(s => s.m) ? [...new Set(list.flatMap(s => s.m))].sort((a, b) => a - b) : null;
  const hab = [...new Set(list.flatMap(s => s.hab))].filter(b => b !== 'orta-su');
  let bottom = rock ? ['kayalik', 'saf-kayalik'] : (ans.bottoms && ans.bottoms.length ? ans.bottoms.filter(b => hab.includes(b) || (b === 'karma')) : hab);
  if (!bottom.length) bottom = hab.length ? hab : ['karma'];
  const baits = prefBaits(topBaits(list, time), ans.baits, fam);
  const names = list.map(s => s.name);
  const target = names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : '');
  const isDip = ['dip', 'surf', 'canli'].includes(tid);
  const code = isDip ? (tid === 'surf' ? 'K' : '') + (time === 'gece' ? 'N' : time === 'gunduz' ? 'G' : 'H') + '-' + (klass === 'trofe' ? 'T' : 'P') + n : T.code + n;   // surf: KG-P1 (kıyı)
  const mode = (ans.mode === 'kiyi' && T.modes.includes('kiyi')) ? 'kiyi' : T.modes.includes('tekne') ? 'tekne' : 'kiyi';
  const notes = [];
  if (rock) notes.push({k: 'Kayalık', t: 'Köstekler kısa ve bir boy kalın; takılmaya karşı kurşunu ince misinayla (kopma bağı) bağla.'});
  [...new Set(list.map(s => s.note).filter(Boolean))].forEach(t => notes.push({k: 'Dikkat', t}));
  slots.forEach(sl => { if (sl.sp) notes.push({k: sl.label, t: 'ölçü ' + rangeTxt(sl.sp)}); });
  if (months) notes.push({k: 'Mevsim', t: months.map(m => MON3[m - 1]).join(', ') + ' (genel bilgi, bölgene göre değişir)'});
  return {id: '', code, name: target + ' · ' + L.name + (rock ? ' · kayalık' : ''), group: isDip ? (klass === 'trofe' ? 'T' : 'P') + (time === 'gece' ? 'N' : time === 'gunduz' ? 'G' : 'H') : tid,
    groupName: isDip ? KLASS_TXT[klass] + ' ' + TIME_TXT[time] : T.name, mode, tech: tid, lay, fam, time, klass, species: list.map(s => s.id), target,
    baitText: baits.slice(0, 2).join(' · '), bottom, season: months, window: null, core: isDip && klass === 'porsiyon' && !months && !rock, current: false, slots,
    baits: baits.length ? {ana: {turkiye: baits[0], envanter: baits[0]}, alt: {turkiye: baits[1] || '', envanter: baits[1] || ''}} : null,
    lengths, own: rock, sinker, success: null, notes};
}
// sihirbaz cevaplarından rig listesi
function genSystem(ans){
  const out = []; const cnt = {};
  const next = key => (cnt[key] = (cnt[key] || 0) + 1);
  const chosen = ans.species.map(id => KB.SPECIES.find(s => s.id === id)).filter(Boolean);
  const klassAns = ans.klass === 'ikisi' ? ['porsiyon', 'trofe'] : [ans.klass || 'porsiyon'];
  const timeAns = ans.time === 'ikisi' ? ['gunduz', 'gece'] : [ans.time || 'gunduz'];
  const rockOk = !ans.bottoms || !ans.bottoms.length || ans.bottoms.some(b => b === 'kayalik' || b === 'saf-kayalik');
  ans.techs.forEach(tid => {
    const T = KB.TECH[tid]; if (!T) return;
    let lays = (ans.lay && ans.lay[tid] && ans.lay[tid].length) ? ans.lay[tid].filter(l => T.lay.includes(l)) : [T.lay[0]];
    if (ans.size === 'sade') lays = lays.slice(0, 1);
    const groups = {};
    chosen.filter(s => T.fams.includes(s.fam)).forEach(s => {
      let g = s.fam;
      if (tid === 'eging') g = s.id === 'ahtapot' ? 'ahtapot' : 'egi';
      (groups[g] = groups[g] || []).push(s);
    });
    Object.keys(groups).forEach(g => {
      const list = groups[g]; const fam = list[0].fam;
      const F = KB.FAM[fam] || {};
      const famK = F.hook ? Object.keys(F.hook) : ['porsiyon'];
      let klasses = klassAns.filter(k => famK.includes(k) && list.some(s => s.sz[k]));
      if (!klasses.length) klasses = [famK.includes('porsiyon') && list.some(s => s.sz.porsiyon) ? 'porsiyon' : 'trofe'];
      const dayOk = list.some(s => s.t.includes('gunduz') || s.t.includes('safak')), nightOk = list.some(s => s.t.includes('gece') || s.t.includes('safak'));
      let times = timeAns.filter(t => t === 'gunduz' ? dayOk : nightOk); if (!times.length) times = timeAns.slice(0, 1);
      const isDip = ['dip', 'surf', 'canli'].includes(tid);
      if (!isDip || ans.size === 'sade') times = ['her'];
      if (ans.size === 'sade') klasses = klasses.slice(0, 1);
      const layList = tid === 'eging' ? [g === 'ahtapot' ? 'ahtapot' : 'egi'] : lays;
      layList.forEach(lay => klasses.forEach(k => times.forEach(tm => {
        const key = isDip ? (tm === 'gece' ? 'N' : tm === 'gunduz' ? 'G' : 'H') + (k === 'trofe' ? 'T' : 'P') : T.code;
        out.push(makeRig(ans, tid, lay, fam, list, k, tm, false, next(key)));
        if (ans.size === 'tam' && isDip && rockOk && ['hirsizli', 'iki', 'tek'].includes(lay) && list.some(s => s.hab.some(h => h === 'kayalik' || h === 'saf-kayalik')))
          out.push(makeRig(ans, tid, lay, fam, list.filter(s => s.hab.some(h => h === 'kayalik' || h === 'saf-kayalik')), k, tm, true, next(key)));
      })));
    });
    // keşif rigi: dip bilinmiyorsa karışık türlerle (dip seçilmediyse ya da "bilmiyorum")
    if (tid === 'dip' && ans.size === 'tam' && (!ans.bottoms || !ans.bottoms.length)) {
      const mixed = chosen.filter(s => ['sk', 'so'].includes(s.fam));
      if (mixed.length > 1) timeAns.forEach(tm => { const key = (tm === 'gece' ? 'N' : 'G') + 'P'; const r = makeRig(ans, tid, lays[0], mixed.some(s => s.fam === 'so') ? 'so' : 'sk', mixed, 'porsiyon', tm, false, next(key)); r.bottom = ['bilinmeyen']; r.name = 'Keşif · karma dip · ' + KB.LAY[lays[0]].name; r.notes.unshift({k: 'Keşif', t: 'Dibi bilinmeyen noktada ilk takım; av gelince dip öğrenilir.'}); out.push(r); });
    }
  });
  return out;
}
// katalog: envantere eklerken arama (marka, model, kategori, iğne deseni)
const CATALOG = [
  ['hook', 'Gamakatsu', 'Hyper Chinu', 'chinu'], ['hook', 'Owner', 'Cut Super Chinu', 'chinu'], ['hook', 'BKK', 'Chinu-R', 'chinu'], ['hook', 'Sasame', 'Chinu', 'chinu'],
  ['hook', 'Gamakatsu', 'Maruseigo', 'maruseigo'], ['hook', 'BKK', 'Maruseigo-R', 'maruseigo'], ['hook', 'Gamakatsu', 'Iseama', 'iseama'], ['hook', 'Sasame', 'Iseama', 'iseama'],
  ['hook', 'Owner', 'SSW Cutting Point', 'octopus'], ['hook', 'BKK', 'Octopus Beak', 'octopus'], ['hook', 'Gamakatsu', 'Octopus', 'octopus'],
  ['hook', 'Owner', 'Mutu Light Circle', 'circle'], ['hook', 'BKK', 'Mutsu Circle Light-SS', 'circle'], ['hook', 'Owner', 'Super Mutu Circle', 'circle'], ['hook', 'Mustad', 'Demon Perfect Circle', 'circle'],
  ['hook', 'Owner', 'Gorilla', 'jforged'], ['hook', 'Owner', 'Ringed Gorilla (5105R)', 'jforged'], ['hook', 'Gamakatsu', 'Baitholder', 'baitholder'], ['hook', 'BKK', 'Beak Baitholder-R', 'baitholder'],
  ['hook', 'Kamasan', 'B940 Aberdeen', 'aberdeen'], ['hook', 'Mustad', 'Aberdeen', 'aberdeen'], ['hook', 'Gamakatsu', 'Live Bait', 'livebait'], ['hook', 'Mustad', 'Hoodlum', 'livebait'],
  ['hook', 'BKK', 'Lone Fighter Assist', 'assist'], ['hook', 'Owner', 'Assist (çift)', 'assist'], ['hook', 'Owner', 'Cultiva jighead', 'jighead'], ['hook', 'Hayabusa', 'Çapari', 'sabiki'], ['hook', 'Owner', 'ST-36 üçlü', 'treble'],
  ['braid', 'YGK', 'X-Braid Upgrade X8'], ['braid', 'Daiwa', 'J-Braid x8'], ['braid', 'Daiwa', 'Saltiga 8x'], ['braid', 'Spiderwire', 'Stealth Smooth x8'], ['braid', 'PowerPro', 'Super 8 Slick'],
  ['fc', 'Seaguar', 'Grandmax FX'], ['fc', 'Seaguar', 'Grandmax FC'], ['fc', 'Seaguar', 'FXR'], ['fc', 'Sunline', 'Siglon FC'], ['fc', 'Daiwa', 'Tournament FC'], ['fc', 'Seaguar', 'Big Game FC'],
  ['mono', 'Berkley', 'Trilene Big Game'], ['mono', 'Momoi', 'Diamond'],
  ['jig', 'Savage Gear', 'SwimSquid Inchiku'], ['jig', 'Daiwa', 'Kohga Bayrubber'], ['jig', 'Shimano', 'Ocea Stingray'], ['jig', 'Shimano', 'Coltsniper'], ['jig', 'Yamashita', 'Egi-Oh K'], ['jig', 'Yo-Zuri', 'Aurie-Q'], ['jig', 'Hayabusa', 'Çapari takımı'],
  ['lure', 'Duo', 'Tide Minnow'], ['lure', 'Rapala', 'X-Rap'], ['lure', 'Rapala', 'CD Magnum'], ['lure', 'Yo-Zuri', 'Crystal Minnow'], ['lure', 'Halco', 'Laser Pro'], ['lure', 'Ecogear', 'Grass Minnow'],
  ['sinker', '', 'Armut kurşun'], ['sinker', '', 'Piramit (grip) kurşun'], ['sinker', '', 'Zeytin (gezer) kurşun'],
  ['terminal', '', 'T-fırdöndü (3 yollu)'], ['terminal', '', 'Fırdöndü + klips'], ['terminal', '', 'Stop boncuk'], ['terminal', '', 'Fosforlu boncuk'],
  ['bait', '', 'Mamun'], ['bait', '', 'Sülünez'], ['bait', '', 'Çimçim'], ['bait', '', 'Karides'], ['bait', '', 'Kalamar'], ['bait', '', 'Sardalya'],
].map(([cat, brand, model, pat]) => ({cat, brand, model, pattern: pat ? KB.PAT[pat].name : '', name: [brand, model].filter(Boolean).join(' ')}));
