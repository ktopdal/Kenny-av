// ---------------------------------------------------------------- 78 · Rig Atölyesi sihirbazı (sıfırdan rig sistemi kurulumu)
let WZ = null;
const WZ_STEPS = ['Yer', 'Teknik', 'Türler', 'Yem', 'Takım', 'Kur'];
const LAY_DESC = {
  hirsizli: 'Üst, orta ve uzun hırsız köstek; 3 iğne', iki: 'Üst köstek ve uzun alt (hırsız) köstek', tek: 'Tek iğne, uzun köstek (80–120 cm)',
  kaydirmali: 'Gezer kurşun, tek iğne; temkinli balık için', slowjig: '100–250 g jig, assist iğne', tairubber: '60–150 g tai rubber', inchiku: '80–200 g inchiku',
  chunking: 'Parça yem ve circle iğne', canliagir: '200–400 g kurşun, canlı yem, 10 m kalın lider', popping: 'Popper ve stickbait, kalın lider', agirjig: '200–400 g jig', agirsirti: 'Büyük sırtı yemi, kalın mono',
  paternoster: '2 iğne, piramit kurşun', egi: 'Kalamar ve mürekkep zokası', ahtapot: 'Ahtapot zokası',
};
// v0.24: "Hangi denizde?" yerine nokta: kayıtlı konumlardan, haritadan ya da koordinatla. Deniz bölgesi (türler buna göre süzülür),
// dip ve derinlik noktadan alınır.
const wzLocs = () => Object.values(S.locations).filter(L => locKind(L) !== 'kara');
function wzDefLoc(region){
  const A = loc(); if (A && locKind(A) !== 'kara' && (!region || regionOf(A) === region)) return A;
  return wzLocs().find(L => !region || regionOf(L) === region) || null;
}
const WZ_BOTTOM = {kum: 'kum', 'kum-kayalik': 'kum-kayalik', kayalik: 'kayalik', 'saf-kayalik': 'kayalik', karma: 'karma', camur: 'camur'};
// v0.29.2: noktanın türü avlanma yerini belirler: kıyı noktası → kıyıdan, deniz noktası → tekneden (ayrıca sorulmaz)
// seçili konumda üstteki Tekne/Kıyı düğmesi de geçerlidir (deniz noktasında kıyı modu seçilmişse kıyıdan)
const wzModeOf = L => { if (!L) return null; const k = locKind(L); if (k === 'kara') return null; if (L.id === S.active) return modeNow() === 'kiyi' ? 'kiyi' : 'tekne'; return k === 'kiyi' ? 'kiyi' : 'tekne'; };
function wzSetMode(m){
  const a = WZ.ans; if (!m || a.mode === m) return;
  a.mode = m; a.techs = a.techs.filter(t => wzTechs().includes(t));
  a.species = a.species.filter(id => { const s = spById(id); return s && wzSpOk(s); });
  if (a.techAuto) { a.techs = (WZ_EASY[a.mode] || []).slice(); a.techs.forEach(t => { if (!(a.lay[t] || []).length) a.lay[t] = [KB.TECH[t].lay[0]]; }); }
}
function wzUseLoc(id){
  const a = WZ.ans, L = S.locations[id]; if (!L) return;
  a.locId = id; a.region = regionOf(L);
  const b = WZ_BOTTOM[L.bottom || L.bottomEst || ''];
  if (b && (!a.bottoms.length || a.bottomsAuto)) { a.bottoms = [b]; a.bottomsAuto = true; }
  wzSetMode(wzModeOf(L));
}
function wzDefaults(){
  const L = wzDefLoc();
  const a = {mode: wzModeOf(L) || S.mode || 'tekne', region: regionOf(L || loc()), locId: L ? L.id : null, techs: [], species: [], baits: (S.profile.baits || []).slice(), lay: {}, klass: 'ikisi', time: 'ikisi', bottoms: [], size: 'dengeli', rodMax: '', name: ''};
  return a;
}
function startWizard(editId){
  const sy = editId && S.systems[editId];
  WZ = {step: 0, ans: sy && sy.answers ? JSON.parse(JSON.stringify(sy.answers)) : wzDefaults(), editId: sy ? editId : null};
  if (!Array.isArray(WZ.ans.baits)) WZ.ans.baits = (S.profile.baits || []).slice();
  if (!WZ.ans.locId || !S.locations[WZ.ans.locId]) { const L = wzDefLoc(WZ.ans.region); WZ.ans.locId = L ? L.id : null; }
  if (WZ.ans.locId && S.locations[WZ.ans.locId]) wzSetMode(wzModeOf(S.locations[WZ.ans.locId]));
  ui.sheet = 'wizard'; renderWizard();
}
// koordinat: "38,4192" ya da "38.4192"; derece-dakika (38°25,152') da olur
function wzParseCoord(v){
  v = String(v || '').trim().replace(/,/g, '.'); if (!v) return null;
  const m = v.match(/^(-?\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*['’′]?)?/); if (!m) return null;
  const d = +m[1], mi = m[2] != null ? +m[2] : 0; if (isNaN(d)) return null;
  return d < 0 ? d - mi / 60 : d + mi / 60;
}
function wzLocStep(a){
  const Ls = wzLocs(), L = a.locId && S.locations[a.locId];
  const reg = (KB.REGIONS.find(r => r[0] === a.region) || [0, 'Ege'])[1];
  const sub = x => [(KB.REGIONS.find(r => r[0] === regionOf(x)) || [0, ''])[1], x.depth ? x.depth + ' m' : '', x.bottom ? BOTTOM_TXT[x.bottom] : x.bottomEst ? 'tahmini ' + trLower(BOTTOM_TXT[x.bottomEst] || '') : '', locKind(x) === 'kiyi' ? 'kıyı' : 'deniz'].filter(Boolean).join(' · ');
  return '<h3>Hangi noktada avlanıyorsun?</h3><p class="note">Kıyıdan mı tekneden mi avlanacağın, deniz bölgesi, dip ve derinlik noktadan alınır; türler bölgeye göre süzülür.</p>' +
    (Ls.length ? '<div class="opts">' + Ls.map(x => optBtn('data-wzloc', x.id, a.locId === x.id, locLabel(x), sub(x))).join('') + '</div>' : '<p class="note">Kayıtlı deniz noktan yok.</p>') +
    '<div class="row wzlocb"><button class="btn small" type="button" data-wzmap="1">Haritadan yeni nokta seç</button></div>' +
    '<details class="wzmore"><summary>Koordinatla gir</summary><div class="fields"><label class="f">Enlem (K)<input id="wz-lat" inputmode="decimal" placeholder="Ör. 38,1234"></label><label class="f">Boylam (D)<input id="wz-lon" inputmode="decimal" placeholder="Ör. 26,6543"></label></div>' +
    '<div class="row"><button class="btn small" type="button" data-wzcoord="1">Noktayı ekle</button></div></details>' +
    '<div class="panel stack wzreg"><b>' + (L ? esc(locLabel(L)) + ' · ' + esc(reg) : 'Nokta seçilmedi · ' + esc(reg) + ' varsayıldı') + '</b>' +
    (L ? '<span class="note">' + esc([L.depth ? 'derinlik ' + L.depth + ' m' : 'derinlik yazılmamış', L.bottom ? 'dip: ' + trLower(BOTTOM_TXT[L.bottom]) : L.bottomEst ? 'taban tahmini: ' + (L.bottomEstTxt || trLower(BOTTOM_TXT[L.bottomEst])) : 'dip bilinmiyor'].join(' · ')) + '</span>' : '<span class="note">Nokta seçmezsen türler ' + esc(reg) + ' için gelir.</span>') + '</div>';
}
const wzTechs = () => Object.keys(KB.TECH).filter(id => WZ.ans.mode === 'ikisi' || KB.TECH[id].modes.includes(WZ.ans.mode));
function wzFams(){ const f = new Set(); WZ.ans.techs.forEach(t => KB.TECH[t].fams.forEach(x => f.add(x))); return f; }
// kıyıda yalnız kıyıdan tutulan türler (orkinos, lahos, fangri… tekne ister)
const wzSpOk = s => WZ.ans.mode !== 'kiyi' || spShore(s.id);
// "Bilmiyorum": acemiye en kolay teknikler
const WZ_EASY = {tekne: ['dip', 'capari'], kiyi: ['surf', 'samandira'], ikisi: ['dip', 'surf']};
const wzSpecies = () => { const f = wzFams(); const list = KB.SPECIES.filter(s => f.has(s.fam) && s.bol.includes(WZ.ans.region) && wzSpOk(s));
  if (WZ.ans.mode === 'kiyi') list.sort((a, b) => (SHORE_TOP.includes(b.id) ? 1 : 0) - (SHORE_TOP.includes(a.id) ? 1 : 0)); return list; };
// v0.29.3 · "Bilmiyorum, sen seç": bölgenin başlıca türlerinden, seçilen tekniklerle tutulan ve bu ay mevsiminde olan en çok 4 tür
// (önce noktanın av kayıtlarında tutanlar; seçilen her teknikten en az bir tür). Acemiye sade bir başlangıç; isteyen sonra ekler.
const WZ_MAX = 4;
const WZ_MAIN = {
  tekne: {ege: ['istavrit', 'mercan', 'karagoz', 'barbunya', 'isparoz', 'sargoz', 'kupes', 'tekir', 'izmarit', 'kolyoz', 'iskorpit', 'hani', 'kalamar', 'cipura'],
    akdeniz: ['istavrit', 'mercan', 'karagoz', 'sargoz', 'barbunya', 'isparoz', 'tekir', 'iskorpit', 'hani', 'kupes', 'kalamar', 'cipura'],
    marmara: ['istavrit', 'mezgit', 'uskumru', 'barbunya', 'lufer', 'iskorpit', 'kalkan', 'palamut', 'izmarit', 'kefal', 'kalamar'],
    karadeniz: ['istavrit', 'mezgit', 'barbunya', 'uskumru', 'kalkan', 'iskorpit', 'lufer', 'palamut', 'kefal']},
  kiyi: {ege: ['cipura', 'levrek', 'sargoz', 'mirmir', 'karagoz', 'istavrit', 'kefal', 'zargana', 'isparoz', 'kupes', 'melanurya', 'kalamar'],
    akdeniz: ['cipura', 'levrek', 'sargoz', 'mirmir', 'karagoz', 'istavrit', 'kefal', 'zargana', 'melanurya', 'kalamar'],
    marmara: ['istavrit', 'levrek', 'lufer', 'kefal', 'zargana', 'cipura', 'sargoz', 'izmarit', 'kalamar'],
    karadeniz: ['istavrit', 'levrek', 'kefal', 'zargana', 'lufer', 'iskorpit', 'barbunya']}};
function wzMainSp(){
  const a = WZ.ans, list = wzSpecies(); if (!list.length) return [];
  const pri = WZ_MAIN[a.mode === 'kiyi' ? 'kiyi' : 'tekne'], top = pri[a.region] || pri.ege;
  const mon = new Date().getMonth(), cal = id => { const c = KB.CAL[id]; return c ? +c[0][mon] : 1; };
  const L = a.locId && S.locations[a.locId], sm = L ? spotMemory(L) : null, here = sm ? sm.sp.map(x => x[0]) : [];
  const sc = s => { const i = top.indexOf(s.id), h = here.indexOf(s.id); return (h >= 0 ? h - 50 : 0) + (i < 0 ? 40 : i) - cal(s.id) * 3; };
  const inSeason = list.filter(s => cal(s.id) > 0 || here.includes(s.id));
  const ok = (inSeason.length ? inSeason : list).slice().sort((x, y) => sc(x) - sc(y));
  const pick = [];
  a.techs.forEach(t => { if (pick.length >= WZ_MAX || !KB.TECH[t]) return; const f = KB.TECH[t].fams; const s = ok.find(x => f.includes(x.fam) && !pick.includes(x)); if (s) pick.push(s); });
  ok.forEach(s => { if (pick.length < WZ_MAX && !pick.includes(s)) pick.push(s); });
  return pick.sort((x, y) => sc(x) - sc(y)).map(s => s.id);
}
const wzSpNames = ids => ids.map(id => (spById(id) || {}).name).filter(Boolean).join(', ');
const optBtn = (attr, val, on, label, sub) => '<button type="button" class="opt" ' + attr + '="' + esc(val) + '" aria-pressed="' + !!on + '"><b>' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button>';
const segWz = (name, opts, cur) => '<div class="seg wrapseg">' + opts.map(([v, t]) => '<button class="btn small" type="button" data-wzset="' + name + '" data-val="' + v + '" aria-pressed="' + (cur === v) + '">' + esc(t) + '</button>').join('') + '</div>';
function wzSummary(){
  const a = WZ.ans;
  const mode = {tekne: 'Tekne', kiyi: 'Kıyı', ikisi: 'Tekne ve kıyı'}[a.mode];
  const reg = (KB.REGIONS.find(r => r[0] === a.region) || [0, ''])[1];
  const short = s => s.replace(/\s*\(.*?\)/g, '');
  const techs = a.techs.map(t => short(KB.TECH[t].name) + (a.lay[t] && a.lay[t].length && KB.TECH[t].lay.length > 1 && t !== 'eging' ? ': ' + a.lay[t].map(l => trLower(short(KB.LAY[l].name))).join(', ') : '')).join(' · ');
  const sps = a.species.map(id => (KB.SPECIES.find(s => s.id === id) || {}).name).filter(Boolean).join(', ');
  const kl = {porsiyon: 'porsiyonluk', trofe: 'trofe', ikisi: 'porsiyonluk ve trofe'}[a.klass], tm = {gunduz: 'gündüz', gece: 'gece', ikisi: 'gündüz ve gece'}[a.time];
  const yem = (a.baits || []).map(k => (STD_BAITS.find(b => b.key === k) || {}).name).filter(Boolean);
  const L = a.locId && S.locations[a.locId];
  return [mode + ' · ' + (L ? locLabel(L) + ' (' + reg + ')' : reg), techs, sps, yem.length ? 'Yem: ' + yem.join(', ') : '', kl + ' · ' + tm, a.bottoms.length ? 'Dip: ' + a.bottoms.map(b => BOTTOM_TXT[b]).join(', ') : 'Dip: bilinmiyor (keşif)'].filter(Boolean).join(' · ');
}
function wzValid(){
  const a = WZ.ans, st = WZ.step;
  if (st === 1) return a.techs.length > 0;
  if (st === 2) return a.species.length > 0 || wzSpecies().length > 0;   // tür seçmek zorunlu değil: boşsa bölgenin başlıca en çok 4 türü
  if (st === 5) return a.techs.length > 0 && a.species.length > 0 && genSystem(a).length > 0;
  return true;
}
// yem adımı: seçilen türlere uygun yemler önde; rigler yemden bağımsız, seçim yalnızca öneriyi sıralar
function wzBaitStep(a){
  const fit = new Set();
  a.species.forEach(id => { const s = KB.SPECIES.find(x => x.id === id); if (!s) return;
    [].concat(s.b.g || [], s.b.n || []).forEach(t => { const k = baitKey(t); if (k && k !== '*canli') fit.add(k); else if (k === '*canli') (FAM_BAITS[s.fam] || []).filter(x => x.indexOf('canli') === 0).forEach(x => fit.add(x)); });
    (FAM_BAITS[s.fam] || []).forEach(k => fit.add(k)); });
  const sel = a.baits || [];
  const chip = b => '<button type="button" class="bchip" data-wzy="' + esc(b.key) + '" aria-pressed="' + sel.includes(b.key) + '">' + esc(b.name) + '</button>';
  const fitL = STD_BAITS.filter(b => fit.has(b.key)), rest = STD_BAITS.filter(b => !fit.has(b.key));
  return '<h3>Hangi yemlerle avlanıyorsun?</h3><p class="note">Rigler yemden bağımsız kurulur. Seçtiğin yemler rig kartlarında ve önerilerde öne çıkar; seçmediğin uygun yemler de alternatif olarak yazılır. Avdan önce aldığın yemi Envanter → Yem’de “var” yap, öneri onu kullanır. İstersen boş geç.</p>' +
    (fitL.length ? '<div class="eyebrow">Seçtiğin türler için uygun</div><div class="bchips">' + fitL.map(chip).join('') + '</div>' : '') +
    '<details class="wzmore"' + (fitL.length ? '' : ' open') + '><summary>' + (fitL.length ? 'Diğer yemler' : 'Yemler') + ' (' + rest.length + ')</summary><div class="bchips">' + rest.map(chip).join('') + '</div></details>';
}
function renderWizard(keep){
  const a = WZ.ans; const st = WZ.step; let body = '';
  if (st === 0) {
    const L0 = a.locId && S.locations[a.locId], m0 = wzModeOf(L0);
    body = wzLocStep(a) + (m0 ? '<div class="panel stack wzmode"><b>' + (m0 === 'kiyi' ? (locKind(L0) === 'kiyi' ? 'Kıyı noktası' : 'Kıyı modu') + ': kıyıdan avlanma' : 'Deniz noktası: tekneden avlanma') + '</b><span class="note">' +
        (m0 === 'kiyi' ? 'Yalnız kıyı teknikleri ve kıyıdan tutulan türler gelir.' : 'Yalnız tekne teknikleri gelir.') + ' Noktanın türünü Daha → Konumlar’dan, seçili noktada modu üstteki Tekne/Kıyı düğmesinden değiştirebilirsin.</span></div>' :
      '<h3>Nereden avlanıyorsun?</h3><div class="opts">' + [['tekne', 'Tekneden', 'Dip, jig, sırtı, canlı yem'], ['kiyi', 'Kıyıdan', 'Surf, LRF, spin, şamandıra'], ['ikisi', 'İkisinden de', 'Bütün teknikler']].map(([v, t, s]) => optBtn('data-wzm', v, a.mode === v, t, s)).join('') + '</div>');
  } else if (st === 1) {
    const easy = WZ_EASY[a.mode] || WZ_EASY.tekne;
    body = '<h3>Nasıl avlanıyorsun?</h3><p class="note">Birden çok seçebilirsin; her teknik için ayrı rigler kurulur.' +
      (a.mode === 'kiyi' ? ' Kıyıdan avlandığın için yalnız kıyı teknikleri var; tekne teknikleri için geri dönüp “Tekneden” ya da “İkisinden de” seç.' : a.mode === 'tekne' ? ' Tekneden avlandığın için tekne teknikleri var.' : '') + '</p>' +
      '<div class="opts">' + optBtn('data-wztx', '1', !!a.techAuto, 'Bilmiyorum, sen seç', 'Yeni başlayana en kolayı: ' + easy.map(t => KB.TECH[t].name.replace(/\s*\(.*?\)/g, '')).join(' ve ')) + '</div>' +
      '<div class="opts">' + wzTechs().map(id => optBtn('data-wzt', id, a.techs.includes(id), KB.TECH[id].name, KB.TECH[id].desc)).join('') + '</div>';
  } else if (st === 2) {
    const by = {}; wzSpecies().forEach(s => { (by[s.fam] = by[s.fam] || []).push(s); });
    const rg0 = (KB.REGIONS.find(r => r[0] === a.region) || [0, ''])[1];
    body = '<h3>Hangi balıkları hedefliyorsun?</h3><p class="note">Seçtiğin tekniklere ve noktanın bölgesine (' + esc(rg0) + ') uyan türler' + (a.mode === 'kiyi' ? ', yalnız kıyıdan tutulanlar' : '') + '. Altlarındaki aylar genel bilgidir. Bilmiyorsan “Bilmiyorum, sen seç”e dokun: bölgende bu ay en çok tutulan en fazla ' + WZ_MAX + ' tür seçilir; istediğini sonra eklersin.</p>' +
      '<div class="opts">' + optBtn('data-wzsx', '1', !!a.spAuto, 'Bilmiyorum, sen seç', (wzMainSp().length ? rg0 + (/[aıou][^aeıioöuü]*$/i.test(rg0) ? '’da' : '’de') + ' bu ay başlıca: ' + wzSpNames(wzMainSp()) : 'Önce bir teknik seç')) + '</div>' +
      (Object.keys(by).map(f => '<div class="famgrp"><div class="row" style="justify-content:space-between"><span class="eyebrow">' + esc((KB.FAM[f] || {}).name || f) + '</span><button class="linkbtn" type="button" data-wzall="' + f + '">Hepsini seç</button></div><div class="opts sp">' +
        by[f].map(s => optBtn('data-wzs', s.id, a.species.includes(s.id), s.name, s.m ? s.m.map(m => MON3[m - 1]).join(' ') : 'yıl boyu')).join('') + '</div></div>').join('') || '<div class="empty">Önce bir teknik seç.</div>') +
      (a.species.filter(id => !wzSpecies().some(s => s.id === id)).length ? '<p class="note">Aramadan eklenenler: ' + esc(a.species.filter(id => !wzSpecies().some(s => s.id === id)).map(id => (spById(id) || {}).name).filter(Boolean).join(', ')) + '</p>' : '') +
      '<section class="set"><h4>Aradığın tür listede yok mu?</h4><p class="note">Bütün türlerde ara; seçince ona uygun teknik de sisteme eklenir.</p><label class="f"><input id="wz-spq" type="search" placeholder="Ör. istavrit, çinekop" autocomplete="off" aria-label="Tür ara"></label><div class="catres" id="wzSpRes"></div></section>';
  } else if (st === 3) {
    body = wzBaitStep(a);
  } else if (st === 4) {
    const multi = a.techs.filter(t => KB.TECH[t].lay.length > 1 && t !== 'eging');
    body = multi.map(t => '<h3>' + esc(KB.TECH[t].name) + ': takım düzeni</h3><p class="note">Birden çok seçebilirsin.</p><div class="opts">' + KB.TECH[t].lay.map(l => optBtn('data-wzl', t + '|' + l, (a.lay[t] || []).includes(l), KB.LAY[l].name, LAY_DESC[l] || '')).join('') + '</div>').join('') +
      '<h3>Balık boyu</h3>' + segWz('klass', [['porsiyon', 'Porsiyonluk'], ['trofe', 'Trofe (iri)'], ['ikisi', 'İkisi de']], a.klass) +
      '<h3>Ne zaman?</h3>' + segWz('time', [['gunduz', 'Gündüz'], ['gece', 'Gece'], ['ikisi', 'İkisi de']], a.time) +
      '<h3>Hangi diplerde?</h3><p class="note">' + (a.bottomsAuto && a.bottoms.length ? 'Noktanın dibinden seçildi; değiştirebilirsin. ' : '') + 'Bilmiyorsan boş bırak; keşif rigleri de kurulur.</p><div class="seg wrapseg">' + [['kum', 'Kum'], ['kum-kayalik', 'Kum–kayalık'], ['kayalik', 'Kayalık'], ['karma', 'Karma'], ['camur', 'Çamur']].map(([v, t]) => '<button class="btn small" type="button" data-wzb="' + v + '" aria-pressed="' + a.bottoms.includes(v) + '">' + t + '</button>').join('') + '</div>';
  } else {
    const n = a.techs.length && a.species.length ? genSystem(a).length : 0;
    const nRod = Object.values(ITEMS).filter(i => i.cat === 'rod' && usable(stockOf(i.id, '-'))).length, nReel = Object.values(ITEMS).filter(i => i.cat === 'reel' && usable(stockOf(i.id, '-'))).length;
    body = '<h3>Takımın</h3><p class="note">' + (nRod || nReel ? 'Her rig için envanterindeki ' + nRod + ' kamış ve ' + nReel + ' makineden en uygun çift kendiliğinden seçilir; uymayanlar rig kartında yazar.' : 'Envanterinde kamış ve makine yok; ekleyince her rig için en uygun çift seçilir.') + '</p>' +
      '<div class="fields"><label class="f wide">' + (a.mode === 'kiyi' ? 'Kamışının atış ağırlığı üst sınırı (g, biliyorsan)' : 'Kamışının kurşun sınırı (g, biliyorsan)') + '<input id="wz-rod" inputmode="numeric" value="' + esc(a.rodMax || '') + '" placeholder="' + (a.mode === 'kiyi' ? 'Ör. 100' : 'Ör. 150') + '"></label></div>' +
      '<h3>Sistem ne kadar ayrıntılı olsun?</h3><div class="opts">' + [['sade', 'Sade', 'Her tür grubu için tek rig'], ['dengeli', 'Dengeli', 'Boya, gündüz/geceye ve takım düzenine göre ayrı rigler'], ['tam', 'Tam', 'Dengeli + kayalık ve keşif rigleri']].map(([v, t, s]) => optBtn('data-wzz', v, a.size === v, t, s)).join('') + '</div>' +
      '<h3>Sistemin adı</h3><div class="fields"><label class="f wide">Ad<input id="wz-name" value="' + esc(a.name || '') + '" placeholder="Ör. Benim dip sistemim"></label></div>' +
      '<div class="panel stack"><b id="wzCount">' + n + ' rig kurulacak</b><span class="note">' + esc(wzSummary()) + '</span>' +
      '<span class="note">Her rigde iki malzeme seviyesi olur: envanterinden ve Türkiye\'de bulunabilen en iyi (envanterinde uygun olan varsa o). Envanteri değiştirdikçe rigler kendiliğinden güncellenir.</span></div>';
  }
  const ok = wzValid();
  openSheet(sheetBar(WZ.editId ? 'Rig sistemini düzenle' : 'Rig Atölyesi', null, 'Kapat') +
    '<div class="wzsteps">' + WZ_STEPS.map((t, i) => '<span class="' + (i === st ? 'on' : i < st ? 'done' : '') + '">' + (i + 1) + ' ' + t + '</span>').join('') + '</div>' +
    '<div class="stack wz">' + body + '<p class="err" id="wzErr" hidden></p></div>' +
    '<div class="wznav">' + (st > 0 ? '<button class="btn" type="button" data-wz="back">Geri</button>' : '<span></span>') +
    (st < 5 ? '<button class="btn primary" type="button" data-wz="next"' + (ok ? '' : ' disabled') + '>İleri</button>' : '<button class="btn primary" type="button" data-wz="done"' + (ok ? '' : ' disabled') + '>' + (WZ.editId ? 'Sistemi güncelle' : 'Sistemi kur') + '</button>') + '</div>', keep);
}
function wzToggle(arr, v){ const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
function wzClick(d){
  const a = WZ.ans;
  if (d.wzm) { wzSetMode(d.wzm); }
  else if (d.wztx) { a.techAuto = !a.techAuto; a.techs = a.techAuto ? (WZ_EASY[a.mode] || WZ_EASY.tekne).filter(t => wzTechs().includes(t)) : []; a.techs.forEach(t => { if (!(a.lay[t] || []).length) a.lay[t] = [KB.TECH[t].lay[0]]; }); }
  else if (d.wzsx) { a.spAuto = !a.spAuto; a.species = a.spAuto ? wzMainSp() : []; if (a.spAuto && !a.sizeSet) a.size = 'sade'; }
  else if (d.wzr) { a.region = d.wzr; }
  else if (d.wzloc) { wzUseLoc(d.wzloc); }
  else if (d.wzmap) { ui.mapFor = 'wizard'; ui.back = () => { ui.mapFor = null; if (WZ) { ui.sheet = 'wizard'; renderWizard(); } else closeSheet(); }; openMap(); return; }
  else if (d.wzcoord) {
    const lat = wzParseCoord($('wz-lat') && $('wz-lat').value), lon = wzParseCoord($('wz-lon') && $('wz-lon').value);
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) { toast('Enlem ve boylamı yaz (ör. 38,1234 ve 26,6543)'); return; }
    const n = nearestLoc({lat, lon}); const id = n && n.d <= 0.2 ? n.L.id : addLocation('Rig noktası ' + lat.toFixed(3) + ', ' + lon.toFixed(3), +lat.toFixed(6), +lon.toFixed(6), '', '', false);
    wzUseLoc(id); toast(locLabel(S.locations[id]) + ' seçildi');
  }
  else if (d.wzt) { a.techAuto = false; wzToggle(a.techs, d.wzt); if (a.techs.includes(d.wzt) && !(a.lay[d.wzt] || []).length) a.lay[d.wzt] = [KB.TECH[d.wzt].lay[0]]; }
  else if (d.wzs) { a.spAuto = false; wzToggle(a.species, d.wzs); }
  else if (d.wzsadd) {   // aramadan tür: uygun tekniği de ekle
    const sp = spById(d.wzsadd); if (!sp || !wzSpOk(sp)) return; a.spAuto = false;
    const tid = techsFor(sp).find(t => wzTechs().includes(t)) || null;
    if (tid && !a.techs.includes(tid)) { a.techs.push(tid); if (!(a.lay[tid] || []).length) a.lay[tid] = [KB.TECH[tid].lay[0]]; }
    if (!a.species.includes(sp.id)) a.species.push(sp.id);
    toast(sp.name + (tid ? ' eklendi · teknik: ' + KB.TECH[tid].name.replace(/\s*\(.*?\)/g, '') : ' eklendi'));
  }
  else if (d.wzy) { if (!Array.isArray(a.baits)) a.baits = []; wzToggle(a.baits, d.wzy); }
  else if (d.wzall) { a.spAuto = false; const ids = wzSpecies().filter(s => s.fam === d.wzall).map(s => s.id); const all = ids.every(i => a.species.includes(i)); ids.forEach(i => { const k = a.species.indexOf(i); if (all && k >= 0) a.species.splice(k, 1); if (!all && k < 0) a.species.push(i); }); }
  else if (d.wzl) { const [t, l] = d.wzl.split('|'); a.lay[t] = a.lay[t] || []; wzToggle(a.lay[t], l); }
  else if (d.wzset) { a[d.wzset] = d.val; }
  else if (d.wzb) { if (a.bottomsAuto) { a.bottomsAuto = false; } wzToggle(a.bottoms, d.wzb); }
  else if (d.wzz) { a.size = d.wzz; a.sizeSet = true; }
  else if (d.wz === 'back') { WZ.step = Math.max(0, WZ.step - 1); renderWizard(); return; }
  else if (d.wz === 'next') {
    if (!wzValid()) return;
    if (WZ.step === 1) { const f = wzFams(); a.species = a.species.filter(id => { const s = KB.SPECIES.find(x => x.id === id); return s && f.has(s.fam) && wzSpOk(s); }); if (a.spAuto) a.species = wzMainSp(); }
    if (WZ.step === 2 && !a.species.length) { a.species = wzMainSp(); a.spAuto = true; if (!a.sizeSet) a.size = 'sade'; toast('Tür seçmedin: ' + wzSpNames(a.species) + ' için kuruluyor; istersen geri dönüp ekle'); }
    WZ.step = Math.min(5, WZ.step + 1); renderWizard(); return;
  }
  else if (d.wz === 'done') { wzFinish(); return; }
  renderWizard(true);
}
function wzFinish(){
  const a = WZ.ans;
  const rigs = genSystem(a);
  if (!rigs.length) { $('wzErr').textContent = 'Bu seçimlerle rig kurulamadı; tür ve teknik seçimini kontrol et.'; $('wzErr').hidden = false; return; }
  const id = WZ.editId || uid('s');
  const name = (a.name || '').trim() || (KB.TECH[a.techs[0]].name + ' sistemim');
  rigs.forEach(r => { r.id = id + ':' + r.code; });
  const old = S.systems[id] || {};
  S.systems[id] = Object.assign({}, old, {id, name, source: 'sihirbaz', active: old.active !== false, created: old.created || new Date().toISOString(), updated: new Date().toISOString(), answers: JSON.parse(JSON.stringify(a)), rigs});
  if (a.mode !== 'ikisi') S.mode = a.mode;
  if (Array.isArray(a.baits)) S.profile.baits = a.baits.slice();
  S.onboarded = true; persist(); indexAll();
  const edit = !!WZ.editId; WZ = null; closeSheet();
  ui.sys = id; ui.rigSeg = 'all'; show('rigler'); renderAll();
  toast(rigs.length + ' rig ' + (edit ? 'güncellendi' : 'kuruldu'));
}

function wzSpSearch(q){
  const el = $('wzSpRes'); if (!el) return;
  el.innerHTML = speciesSearch(q).map(r => wzSpOk(r.s) ? '<button type="button" class="catpick" data-wzsadd="' + esc(r.s.id) + '"><b>' + esc(r.s.name) + (WZ.ans.species.includes(r.s.id) ? ' ✓' : '') + '</b><small>' + esc((KB.FAM[r.s.fam] || {}).name || '') + '</small></button>' :
    '<button type="button" class="catpick" disabled><b>' + esc(r.s.name) + '</b><small>Kıyıdan tutulmaz; tekne gerekir</small></button>').join('') || (slugTR(q).length >= 2 ? '<p class="note">Bulunamadı. Türlerim ekranında “benzer tür” seçerek ekleyebilirsin.</p>' : '');
}
