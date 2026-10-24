// ---------------------------------------------------------------- 28 · kamış + makine eşleştirmesi (v0.24)
// Her rig için envanterdeki kamış ve makinelerden en uygun ÇİFT seçilir. Bakılanlar: rigin kurşun ya da yem gramı, tekniğin kamış tipi
// ve gücü (en çok taşıdığı gram), boy, makinenin tipi (spinning / çıkrık) ve boyu, kamışın makara yuvası (tetikli kamışa çıkrık, tetiksiz
// kamışa spinning) ve kamış–makine güç dengesi. Özel pakette kurulumda yazan kamış ve makine önce gelir; kamışın "kullanım" notunda
// bir makinenin modeli geçiyorsa o çift öne alınır.
// Seçim sırası: elinde ve uygun → elinde, sınırda → envanterde ama elinde yok (alınacak/bitti) ve uygun → elinde ama uygun değil.
// Elindeki takım rige uymuyorsa yine de rigde gösterilir ("girildi ama uygun değil" ve nedeni); rig tamamlanmadı sayılır ve alışveriş
// listesine gereken ölçüde kamış/makine düşer. "Bu rigde kullan" ile uygun olmayanı bilerek seçersen rig hazır sayılır, uyarı kalır.
const GEAR_CLS = {rod: ['UL', 'L', 'M', 'H', 'XH'], reel: ['S', 'M', 'L', 'XL']};
const SEAT_TXT = {spin: 'tetiksiz (spinning)', cast: 'tetikli (çıkrık)'};
const REEL_SHORT = {spin: 'spinning', cikrik: 'çıkrık'};
const ROD_REEL = {UL: [0, 0], L: [0, 1], M: [0, 2], H: [1, 3], XH: [2, 3]};   // kamış gücüne göre makine sınıfı aralığı (S, M, L, XL)
const capFirst = s => s ? s.charAt(0).toLocaleUpperCase('tr') + s.slice(1) : s;
const ROD_TYPE_TXT = {tekne: 'tekne dip', slowjig: 'slow jig', jig: 'ağır jig', spin: 'spin', lrf: 'LRF', surf: 'surf', samandira: 'şamandıra / bolonez', egi: 'egi', sirti: 'sırtı (trolling)', buyuk: 'büyük oyun (stand-up)', diger: 'diğer'};
const rodTypeTxt = t => ROD_TYPE_TXT[t] || t || '';
// kamışın makara yuvası: formda seçildiyse oradan, yoksa adından ve özelliğinden
function rodSeat(it){
  if (it.rod && it.rod.seat) return it.rod.seat;
  const t = trLower([it.name, it.model, it.spec, it.type, it.note].join(' '));
  if (/tetiksiz|spinning/.test(t)) return 'spin';
  if (/tetikli|casting|baitcast|conventional/.test(t)) return 'cast';
  return null;
}
const rodSpecTxt = it => { const r = rodInfo(it), s = rodSeat(it);
  return [r.type && r.type !== 'diger' ? rodTypeTxt(r.type) : '', r.len ? fmtNum(r.len, 2) + ' m' : '', r.max ? 'en fazla ' + r.max + ' g' : '', r.pe ? 'PE ' + fmtNum(r.pe, 1) : '', s ? SEAT_TXT[s] : ''].filter(Boolean).join(' · '); };
const reelSpecTxt = it => { const r = reelInfo(it); return [r.type ? REEL_SHORT[r.type] : '', r.size ? 'boy ' + r.size : ''].filter(Boolean).join(' · '); };
// rigin takım ihtiyacı: düzen (GEAR), kurşun ya da yem gramı, kurulum
function gearNeed(rg){
  const key = rg.sys === 'ozel' ? 'hirsizli' : rg.lay ? gearKey(rg.lay, rg.mode) : null;
  const G = key && GEAR[key]; if (!G) return null;
  const lure = rg.slots.find(s => s.kind === 'lure' && s.sp && s.sp.g);
  const sk = rg.sinker && rg.sinker.g ? rg.sinker.g.slice() : null;
  return {key, rod: G.rod, reel: G.reel, g: sk || (lure ? lure.sp.g.slice() : null), isLure: !sk && !!lure, max: rg.sinker && rg.sinker.max || null,
    setup: rg.sys === 'ozel' && SETUPS[rg.group] ? SETUPS[rg.group] : null};
}
const clsSpan = (kind, list) => { const ix = list.map(c => GEAR_CLS[kind].indexOf(c)); return [Math.min(...ix), Math.max(...ix)]; };
// kamış bu rige uyuyor mu: {fit: ok | warn | bad, why (uymama nedenleri), warn (sınırda notları), sc (küçük iyi)}
function rodFit(it, need){
  const inf = rodInfo(it), st = stockOf(it.id, '-'), have = usable(st), why = [], warn = [];
  const w = need.isLure ? 'yem' : 'kurşun';
  if (inf.type && inf.type !== 'diger' && !need.rod.types.includes(inf.type)) why.push(capFirst(rodTypeTxt(inf.type)) + ' kamışı; bu rig ' + trLower(need.rod.name) + ' ister');
  const cls = rodCls(inf.max), ci = cls ? GEAR_CLS.rod.indexOf(cls) : -1, [lo, hi] = clsSpan('rod', need.rod.cls);
  if (inf.max != null && need.g && inf.max < need.g[0]) why.push('en fazla ' + inf.max + ' g taşır; rig ' + need.g[0] + '–' + need.g[1] + ' g ' + w + ' ister');
  else if (ci >= 0 && ci < lo) why.push('bu iş için hafif: en fazla ' + inf.max + ' g taşır (' + trLower(need.rod.name) + ': ' + need.rod.spec + ')');
  else if (inf.max != null && need.g && inf.max < need.g[1]) warn.push('en fazla ' + inf.max + ' g taşır; ' + w + ' ' + inf.max + ' g’ı geçerse zorlanır');
  if (ci >= 0 && ci > hi + 1) why.push('bu rig için çok güçlü (en fazla ' + inf.max + ' g); vuruşu hissetmezsin');
  else if (ci >= 0 && ci > hi) warn.push('bu rig için biraz güçlü; vuruşu geç hissedersin');
  if (need.rod.minLen && inf.len && inf.len < need.rod.minLen - 0.2) why.push('boyu ' + fmtNum(inf.len, 2) + ' m; en az ' + fmtNum(need.rod.minLen, 1) + ' m gerekir');
  const bad = why.length > 0;
  let sc = (bad ? 300 : 0) + (have ? 0 : 100) + warn.length * 5 + (inf.type && need.rod.types.includes(inf.type) ? need.rod.types.indexOf(inf.type) * 0.1 : 0.6) + (inf.max == null ? 0.8 : 0);
  if (inf.max != null && need.g) sc += inf.max >= need.g[1] ? Math.min(1, (inf.max - need.g[1]) / need.g[1] * 0.5) : (need.g[1] - inf.max) / need.g[1] * 2;   // işe en yakın güç öne; yetmeyen ne kadar az yetmiyorsa o
  if (need.setup && need.setup.rods) { const i = need.setup.rods.indexOf(it.id); if (i >= 0) sc -= 3 - i * 0.2; }
  return {it, kind: 'rod', inf, st, have, why, warn, bad, sc, fit: bad ? 'bad' : warn.length ? 'warn' : 'ok'};
}
// kamışın kullanım notunda makinenin modeli geçiyorsa bu çift öne alınır
const pairHint = (rod, reel) => { const t = trLower([rod.use, rod.note].join(' ')), m = trLower(reel.model || ''); return m.length >= 3 && t.indexOf(m) >= 0; };
function reelFit(it, need, rodIt){
  const inf = reelInfo(it), st = stockOf(it.id, '-'), have = usable(st), why = [], warn = [];
  if (inf.type && !need.reel.types.includes(inf.type)) why.push(capFirst(REEL_SHORT[inf.type]) + ' makine; bu rig ' + need.reel.types.map(t => REEL_SHORT[t]).join(' ya da ') + ' ister');
  const cls = reelCls(inf.size), ci = cls ? GEAR_CLS.reel.indexOf(cls) : -1, [lo, hi] = clsSpan('reel', need.reel.cls);
  if (ci >= 0 && ci < lo) why.push('boy ' + inf.size + ' bu rig için küçük (' + need.reel.spec + ')');
  else if (ci >= 0 && ci > hi + 1) why.push('boy ' + inf.size + ' bu rig için çok büyük (' + need.reel.spec + ')');
  else if (ci >= 0 && ci > hi) warn.push('boy ' + inf.size + ' bu rig için biraz büyük');
  if (rodIt) {
    const seat = rodSeat(rodIt);
    if (seat === 'cast' && inf.type === 'spin') why.push('kamış tetikli (çıkrık için); spinning makine takılmaz');
    else if (seat === 'spin' && inf.type === 'cikrik') why.push('kamış tetiksiz (spinning için); çıkrık takılmaz');
    const rc = rodCls(rodInfo(rodIt).max);
    if (rc && ci >= 0) { const [a, b] = ROD_REEL[rc]; if (ci < a) warn.push('kamışa göre küçük'); else if (ci > b) warn.push('kamışa göre büyük, takım ağırlaşır'); }
  }
  const bad = why.length > 0;
  let sc = (bad ? 300 : 0) + (have ? 0 : 100) + warn.length * 5 + (inf.type ? need.reel.types.indexOf(inf.type) * 0.1 : 0.6) + (ci < 0 ? 0.5 : 0);
  if (need.setup && need.setup.reel === it.id) sc -= 3;
  if (rodIt && pairHint(rodIt, it)) sc -= 1;
  return {it, kind: 'reel', inf, st, have, why, warn, bad, sc, fit: bad ? 'bad' : warn.length ? 'warn' : 'ok'};
}
// en iyi çift (fixRod / fixReel: kullanıcının bu rig için seçtiği)
function gearPick(need, fixRod, fixReel){
  const rods = fixRod ? [fixRod] : Object.values(ITEMS).filter(i => i.cat === 'rod');
  const reels = fixReel ? [fixReel] : Object.values(ITEMS).filter(i => i.cat === 'reel');
  const rf = rods.map(r => rodFit(r, need)); if (!rf.length) rf.push(null);
  let best = null;
  rf.forEach(R => { (reels.length ? reels.map(m => reelFit(m, need, R ? R.it : null)) : [null]).forEach(M => {
    const sc = (R ? R.sc : 400) + (M ? M.sc : 400); if (!best || sc < best.sc) best = {sc, rod: R, reel: M}; }); });
  return best;
}
// rigin kamış ve makine yuvalarını doldur (pkgRigs ve resolveRig sonunda; S.rigOv'daki kullanıcı seçimi önce)
function applyGear(rg){
  const need = gearNeed(rg); if (!need) return rg;
  const sR = rg.slots.find(s => s.kind === 'rod'), sM = rg.slots.find(s => s.kind === 'reel'); if (!sR && !sM) return rg;
  const ov = S.rigOv || {}, oR = sR && ov[rg.id + '|' + sR.k], oM = sM && ov[rg.id + '|' + sM.k];
  const fR = oR && ITEMS[oR.item] && ITEMS[oR.item].cat === 'rod' ? ITEMS[oR.item] : null, fM = oM && ITEMS[oM.item] && ITEMS[oM.item].cat === 'reel' ? ITEMS[oM.item] : null;
  const auto = gearPick(need, null, null), pick = fR || fM ? gearPick(need, fR, fM) : auto;
  const put = (sl, f, a, user, G) => {
    if (!sl) return;
    const e = sl.t.envanter || {};
    const t = Object.assign({}, sl.t, {envanter: f ? {item: f.it.id, name: f.it.name, size: null} : {item: null, name: e.name || '', size: null}});
    t.turkiye = f && f.have && f.fit !== 'bad' ? {item: f.it.id, name: f.it.name, inv: true} : {name: G.name, size: G.spec};
    if (sl.t.dunya) t.dunya = {name: f ? f.it.name : (sl.t.dunya.name || G.name)};
    sl.t = t; sl.fit = f ? f.fit : null; sl.fitWhy = f ? f.why.concat(f.warn) : []; sl.user = !!user; sl.ov = !!user;
    if (user && a) sl.orig = {item: a.it.id, name: a.it.name, size: null}; else delete sl.orig;
  };
  put(sR, pick.rod, auto.rod, !!fR, need.rod); put(sM, pick.reel, auto.reel, !!fM, need.reel);
  rg.gear = {need, rod: pick.rod, reel: pick.reel};
  return rg;
}
// rigin kamışının taşıdığı en fazla gram (elindeyse): kurşun hesabında kamış sınırı (45-drift.js leadFor)
function rigRodMax(rg){
  const sl = rg.slots && rg.slots.find(s => s.kind === 'rod'); const e = sl && sl.t.envanter; const it = e && e.item && ITEMS[e.item];
  if (!it || !usable(stockOf(it.id, '-'))) return null;
  return rodInfo(it).max || null;
}
// kartta ve öneride: kamış/makine uyarısı (elindeki takım için)
function gearIssues(rg){
  return rg.slots.filter(s => (s.kind === 'rod' || s.kind === 'reel') && s.fit && s.fit !== 'ok' && s.t.envanter && s.t.envanter.item && usable(slotStock(s)))
    .map(s => ({sl: s, bad: s.fit === 'bad', txt: s.label + ' ' + (s.fit === 'bad' ? 'uygun değil' : 'sınırda'), why: (s.fitWhy || [])[0] || ''}));
}
// ---- uygun takım yoksa: aranacak ölçü ve örnek seriler (örnek; modeli ölçüye göre seç)
const GEAR_EX = {
  dip: {rod: ['Shimano Beastmaster Boat', 'Penn Squadron III Boat'], reel: ['Shimano Spheros SW', 'Penn Spinfisher', 'Daiwa BG']},
  kiyi: {rod: ['Daiwa Crosscast Surf'], reel: ['Daiwa Crosscast', 'Shimano Ultegra']},
  canli: {rod: ['Penn Squadron III Boat', 'Shimano Beastmaster Boat'], reel: ['Penn Fathom Lever Drag', 'Shimano Torium']},
  slowjig: {rod: ['Shimano Grappler Type Slow J', 'Daiwa Saltiga SJ'], reel: ['Shimano Ocea Jigger', 'Shimano Grappler', 'Daiwa Saltiga']},
  tairubber: {rod: ['Shimano Engetsu', 'Daiwa Kohga'], reel: ['Shimano Engetsu', 'Daiwa Kohga']},
  inchiku: {rod: ['Shimano Grappler', 'Daiwa Saltiga SJ'], reel: ['Shimano Grappler', 'Shimano Spheros SW']},
  capari: {rod: [], reel: ['Shimano Nasci', 'Daiwa BG']},
  egi: {rod: ['Shimano Sephia', 'Daiwa Emeraldas'], reel: ['Shimano Sephia', 'Daiwa Emeraldas']},
  ahtapot: {rod: ['Shimano Beastmaster Boat', 'Penn Squadron III Boat'], reel: ['Penn Spinfisher', 'Daiwa BG']},
  sirti: {rod: [], reel: ['Shimano TLD', 'Penn Squall']},
  buyuk: {rod: [], reel: ['Shimano Tiagra', 'Penn International']},
  popping: {rod: [], reel: ['Shimano Stella SW', 'Daiwa Saltiga']},
  paternoster: {rod: ['Daiwa Crosscast Surf'], reel: ['Daiwa Crosscast', 'Shimano Ultegra']},
  lrf: {rod: ['Shimano Soare', 'Daiwa Gekkabijin'], reel: ['Shimano Sahara', 'Daiwa Ninja LT']},
  spin: {rod: ['Daiwa Ninja', 'Shimano Catana'], reel: ['Shimano Nasci', 'Daiwa Ninja LT']},
  samandira: {rod: [], reel: ['Shimano Sahara', 'Daiwa Ninja LT']},
};
const GEAR_EX_KEY = {hirsizli: 'dip', iki: 'dip', tek: 'dip', kaydirmali: 'dip', kaydirmaliKiyi: 'kiyi', chunking: 'buyuk', agirsirti: 'buyuk', agirjig: 'popping'};
const gearEx = (need, kind) => ((GEAR_EX[GEAR_EX_KEY[need.key] || need.key] || {})[kind]) || [];
function rodReqTxt(need){
  return [need.rod.name, need.g ? 'en az ' + need.g[1] + ' g taşımalı (rig ' + need.g[0] + '–' + need.g[1] + ' g ' + (need.isLure ? 'yem' : 'kurşun') + ')' : '',
    'genel ölçü ' + need.rod.spec, need.rod.minLen ? 'en az ' + fmtNum(need.rod.minLen, 1) + ' m' : ''].filter(Boolean).join(' · ');
}
function reelReqTxt(need, rodIt){
  const seat = rodIt ? rodSeat(rodIt) : null;
  return [need.reel.name, need.reel.spec, seat === 'cast' ? 'kamışın tetikli: çıkrık seç' : seat === 'spin' ? 'kamışın tetiksiz: spinning seç' : ''].filter(Boolean).join(' · ');
}
// kartta kısa öneri: elinde uygun başka kalem varsa o, yoksa gereken ölçü
function gearSugShort(rg, sl){
  const need = rg.gear && rg.gear.need; if (!need) return '';
  const e = sl.t.envanter || {}, it = e.item && ITEMS[e.item], have = it && usable(slotStock(sl));
  if (have && sl.fit !== 'bad') return '';
  const rodIt = rg.gear.rod ? rg.gear.rod.it : null;
  const alt = Object.values(ITEMS).filter(i => i.cat === sl.kind && i.id !== e.item).map(i => sl.kind === 'rod' ? rodFit(i, need) : reelFit(i, need, rodIt)).filter(f => f.have && !f.bad).sort((a, b) => a.sc - b.sc)[0];
  if (alt) return 'Elindeki uygun: ' + alt.it.name;
  return 'Gereken: ' + (sl.kind === 'rod' ? rodReqTxt(need) : reelReqTxt(need, rodIt)).split(' · ').slice(0, 2).join(' · ');
}
// kart satırı (envanter seviyesi): ad, ölçüler, durum, uygunluk nedeni ve öneri; dokununca "Kamış ve makine" sayfası
function gearRow(rg, sl){
  const e = sl.t.envanter || {}, it = e.item && ITEMS[e.item], st = slotStock(sl), have = usable(st);
  const spec = it ? (sl.kind === 'rod' ? rodSpecTxt(it) : reelSpecTxt(it)) : '';
  let stTxt = ST_TXT[st], dot = st;
  if (it && have && sl.fit === 'bad') { stTxt = 'Uygun değil'; dot = 'yok'; } else if (it && have && sl.fit === 'warn') { stTxt = 'Sınırda'; dot = 'az'; }
  const why = it && sl.fitWhy && sl.fitWhy.length ? (sl.fit === 'bad' ? (sl.user ? 'Senin seçimin, uygun değil: ' : 'Envanterden girildi ama uygun değil: ') : 'Sınırda: ') + sl.fitWhy[0] : '';
  const sug = gearSugShort(rg, sl);
  return '<button type="button" class="crow tap gear" data-gear="' + esc(rg.id) + '"><span class="k">' + esc(sl.label) + '</span><span class="v">' + esc(it ? it.name : (e.name || '— (envanterde yok)')) +
    (sl.user && sl.fit !== 'bad' ? ' <small class="ovt">senin seçimin</small>' : '') + (spec ? '<small class="gspec">' + esc(spec) + '</small>' : '') +
    (why ? '<small class="fitwhy ' + (sl.fit || '') + '">' + esc(why) + '</small>' : '') + (sug ? '<small class="gsug">' + esc(sug) + '</small>' : '') +
    '</span><span class="s"><span class="dot ' + dot + '"></span>' + esc(stTxt) + '<i class="chev" aria-hidden="true">›</i></span></button>';
}
// ---- "Kamış ve makine" sayfası
const FIT_TXT = {ok: 'Uygun', warn: 'Sınırda', bad: 'Uygun değil'};
function fitBadge(f){ return '<span class="fitb ' + f.fit + '">' + FIT_TXT[f.fit] + '</span>'; }
function gearCard(f, cur, rid, k, same){
  const it = f.it, spec = f.kind === 'rod' ? rodSpecTxt(it) : reelSpecTxt(it);
  const notes = f.why.concat(f.warn);
  return '<div class="gcard' + (cur ? ' cur' : '') + '"><div class="gh"><b>' + esc(it.name) + '</b>' + (cur ? '<span class="chip">Bu rigde</span>' : '') + fitBadge(f) + '</div>' +
    (spec ? '<div class="note">' + esc(spec) + '</div>' : '<div class="note">Ölçüsü girilmemiş: kamışta boy ve en fazla gram, makinede tip ve boy girersen daha iyi eşleşir.</div>') +
    '<div class="gst"><span class="dot ' + f.st + '"></span>' + esc(ST_TXT[f.st]) + (it.use ? ' · ' + esc(it.use) : '') + '</div>' +
    (notes.length ? '<ul class="gwhy">' + notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '') +
    (cur ? '' : '<div class="row"><button class="btn small" type="button" data-gearuse="' + esc(rid + '|' + k + '|' + it.id) + '">Bu rigde kullan</button>' +
      (same > 1 ? '<button class="btn small" type="button" data-gearall="' + esc(rid + '|' + k + '|' + it.id) + '">Gruptaki ' + same + ' rigde kullan</button>' : '') + '</div>') + '</div>';
}
function openGear(rid, keep){
  const rg = RIGS[rid]; if (!rg || !rg.gear) { toast('Bu rigde kamış ve makine yok'); return; }
  ui.sheet = 'gear'; ui.sheetArg = rid;
  const {need} = rg.gear, sR = rg.slots.find(s => s.kind === 'rod'), sM = rg.slots.find(s => s.kind === 'reel');
  const cR = rg.gear.rod, cM = rg.gear.reel, rodIt = cR ? cR.it : null;
  const rods = Object.values(ITEMS).filter(i => i.cat === 'rod').map(i => rodFit(i, need)).sort((a, b) => a.sc - b.sc);
  const reels = Object.values(ITEMS).filter(i => i.cat === 'reel').map(i => reelFit(i, need, rodIt)).sort((a, b) => a.sc - b.sc);
  const group = RIG_LIST.filter(r => r.sys === rg.sys && (r.group || '') === (rg.group || '') && r.gear);
  const sec = (t, body) => '<section class="set"><h4>' + t + '</h4>' + body + '</section>';
  const su = need.setup;
  const head = (rg.code ? rg.code + ' · ' : '') + rg.name;
  const wants = '<p class="note"><b>Kamış:</b> ' + esc(rodReqTxt(need)) + '</p><p class="note"><b>Makine:</b> ' + esc(reelReqTxt(need, rodIt)) + '</p>' +
    (su ? '<p class="note"><b>Kurulumun (' + esc(su.name) + '):</b> ' + esc(su.rods_text + ' + ' + su.reel_text) + '</p>' : '') +
    (need.g ? '<p class="note">Kurşun hesabında kamışın taşıdığı en fazla gram sınır alınır.</p>' : '');
  const chosen = (f, sl, lbl) => !sl ? '' : f ? gearCard(f, true, rid, sl.k, 0) + (sl.user ? '<p class="note">Bu rig için sen seçtin. <button class="linkbtn" type="button" data-gearauto="' + esc(rid + '|' + sl.k) + '">Otomatik seçime dön</button></p>' : '') :
    '<div class="gcard"><b>' + lbl + ' yok</b><div class="note">Envanterinde ' + trLower(lbl) + ' yok. Aşağıdan ekle ya da alışveriş listesine koy.</div></div>';
  const buyBlock = (kind, f) => {
    const ex = gearEx(need, kind), req = kind === 'rod' ? rodReqTxt(need) : reelReqTxt(need, rodIt), lbl = kind === 'rod' ? 'Kamış' : 'Makine';
    const open = !f || !f.have || f.fit === 'bad';
    return '<details class="gbuy"' + (open ? ' open' : '') + '><summary>' + (open ? 'Uygun ' + trLower(lbl) + ' al' : 'Başka bir ' + trLower(lbl) + ' almak istersen') + '</summary>' +
      '<p class="note"><b>Aranacak ölçü:</b> ' + esc(req) + '</p>' + (ex.length ? '<p class="note"><b>Örnek seriler:</b> ' + esc(ex.join(', ')) + ' (örnek; modelini yukarıdaki ölçüye göre seç)</p>' : '') +
      '<div class="row"><button class="btn small" type="button" data-gearbuy="' + esc(rid + '|' + kind) + '">Alışveriş listesine ekle</button><button class="btn small" type="button" data-newitem="' + kind + '">Envantere ' + trLower(lbl) + ' ekle</button></div></details>';
  };
  const list = (arr, cur, sl) => arr.filter(f => !cur || f.it.id !== cur.it.id).map(f => gearCard(f, false, rid, sl.k, group.length)).join('') || '<p class="note">Başka yok.</p>';
  openSheet(sheetBar('Kamış ve makine') + '<div class="stack"><p class="sub">' + esc(head) + '</p>' +
    sec('Bu rigin istediği', wants) +
    sec('Bu rigde', chosen(cR, sR, 'Kamış') + chosen(cM, sM, 'Makine')) +
    (sR ? sec('Elindeki diğer kamışlar (' + Math.max(0, rods.length - (cR ? 1 : 0)) + ')', list(rods, cR, sR) + buyBlock('rod', cR)) : '') +
    (sM ? sec('Elindeki diğer makineler (' + Math.max(0, reels.length - (cM ? 1 : 0)) + ')', '<p class="note">Uygunluk seçili kamışa göre (makara yuvası ve güç dengesi).</p>' + list(reels, cM, sM) + buyBlock('reel', cM)) : '') +
    '</div>', keep);
}
function gearAct(kind, val){
  const [rid, k, item] = val.split('|'); const rg = RIGS[rid]; if (!rg) return;
  S.rigOv = S.rigOv || {};
  if (kind === 'use') { S.rigOv[rid + '|' + k] = {item, size: '-'}; invChanged(); toast(ITEMS[item].name + ' bu rigde'); return; }
  if (kind === 'all') {
    const sk = (rg.slots.find(s => s.k === k) || {}).kind; let n = 0;
    RIG_LIST.filter(r => r.sys === rg.sys && (r.group || '') === (rg.group || '')).forEach(r => { const s = r.slots.find(x => x.kind === sk); if (s) { S.rigOv[r.id + '|' + s.k] = {item, size: '-'}; n++; } });
    invChanged(); toast(ITEMS[item].name + ' ' + n + ' rigde'); return;
  }
  if (kind === 'auto') { delete S.rigOv[rid + '|' + k]; invChanged(); toast('Otomatik seçime dönüldü'); return; }
  if (kind === 'buy') {
    const need = rg.gear && rg.gear.need; if (!need) return; const G = k === 'rod' ? need.rod : need.reel;
    const sl = rg.slots.find(s => s.kind === k); const req = k === 'rod' ? rodReqTxt(need) : reelReqTxt(need, rg.gear.rod ? rg.gear.rod.it : null);
    const key = 'gear:' + k + ':' + need.key + (need.g ? ':' + need.g[1] : '');
    S.shopX = S.shopX || {};
    const old = S.shopX[key];
    S.shopX[key] = {k: key, item: null, size: req.split(' · ').slice(1).join(' · '), name: G.name, store: null, kind: k, sp: Object.assign({kind: k, types: G.types, cls: G.cls, minLen: G.minLen || null}, k === 'rod' && need.g ? {minG: need.g[1]} : {}),
      for: [...new Set(((old && old.for) || []).concat([rg.code || rg.name]))], added: new Date().toISOString()};
    persist(); renderAll(); toast(G.name + ' alışveriş listesine eklendi');
  }
}
