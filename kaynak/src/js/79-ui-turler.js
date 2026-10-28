// ---------------------------------------------------------------- 79 · Türlerim: tür ekle → takım planı → alışveriş listesi ya da sistemine ekle
// Kullanıcı hedeflediği türü (ör. istavrit) ekler; uygulama türün genel bilgisini, sistemindeki uygun rigleri ve tekne/kıyı moduna,
// eldeki kamış ve makineye göre önerilen takımı gösterir. Eksikler tek dokunuşla alışveriş listesine ("İstavrit için") aktarılır,
// istenirse rig "Tür planlarım" sistemine eklenir (eksik kaldıkça tamamlanmadı, tamamlanınca önerilere girer). Takım bilgisi geneldir.
const SP_ALIAS = {lufer: ['çinekop', 'sarıkanat', 'kofana', 'defne'], palamut: ['torik', 'vonoz'], cipura: ['çupra'], lahos: ['lagos', 'lahoz'], kupes: ['kupez'],
  eskina: ['işkine'], isparoz: ['ispari'], orkinos: ['ton balığı', 'tuna', 'bluefin', 'mavi yüzgeçli'], lambuka: ['mahi mahi', 'dorado'], murekkep: ['sübye'],
  kefal: ['has kefal', 'topan', 'pulatarina', 'altınbaş'], levrek: ['lavrak'], sargoz: ['sargos'], zargana: ['zurna'], 'kaya-baligi': ['kaya balığı', 'gobi'],
  sarikuyruk: ['akya sarıkuyruk', 'amberjack'], kirma: ['kırma'], iskorpit: ['iskorpit'], lipsoz: ['lipsos']};
// türün takım ailesine göre teknik sırası (ilk uygun olan önerilir; eldeki kamış/makine uyan teknik öne alınır)
const TECH_PREF = {pelajikk: ['capari', 'lrf', 'samandira'], sk: ['dip', 'surf', 'samandira', 'lrf'], so: ['dip', 'surf', 'jig'], sg: ['dip', 'canli', 'jig'], kaya: ['dip', 'jig', 'lrf'],
  yirtici: ['canli', 'spin', 'sirti', 'surf', 'samandira', 'lrf'], kum: ['dip', 'surf'], buyukdip: ['canli', 'dip', 'jig'], kefal: ['samandira'], pelajikb: ['sirti', 'spin', 'canli'], buyuk: ['orkinos'], kafadan: ['eging']};
const spById = id => KB.SPECIES.find(x => x.id === id) || null;
function speciesSearch(q){
  const n = slugTR(q); if (n.length < 2) return [];
  return KB.SPECIES.map(s => { const names = [s.name, s.latin].concat(SP_ALIAS[s.id] || []).map(slugTR);
    const hit = names.findIndex(x => x.indexOf(n) >= 0); return hit < 0 ? null : {s, rank: names[hit].indexOf(n) === 0 ? 0 : 1, via: hit > 1 ? (SP_ALIAS[s.id] || [])[hit - 2] : null}; })
    .filter(Boolean).sort((a, b) => a.rank - b.rank || trCmp(a.s.name, b.s.name)).slice(0, 8);
}
const tgtSp = t => spById(t.like || t.id);
// tür için teknikler: önce kendi modundakiler (eldeki kamış/makineye uyan öne), sonra diğer moddakiler
function techsFor(s){
  const mode = S.mode || 'tekne'; const ok = t => KB.TECH[t] && KB.TECH[t].fams.includes(s.fam); const inM = t => KB.TECH[t].modes.includes(mode);
  const pref = (TECH_PREF[s.fam] || []).filter(ok), rest = Object.keys(KB.TECH).filter(t => ok(t) && !pref.includes(t));
  const lay0 = t => t === 'eging' ? (s.id === 'ahtapot' ? 'ahtapot' : 'egi') : KB.TECH[t].lay[0];
  // türün asıl teknikleri arasında elindeki kamış/makineye uyan öne geçer; türe uymayan teknik takım var diye öne çıkmaz
  const pIn = pref.filter(inM); const fit = pIn.filter(t => gearReady(lay0(t), mode));
  return fit.concat(pIn.filter(t => !fit.includes(t)), rest.filter(inM), pref.filter(t => !inM(t)), rest.filter(t => !inM(t)));
}
// planın rigi: Rig Atölyesi'nin aynı kurallarıyla, tek tür için
function planFor(t){
  const s = tgtSp(t); if (!s) return null;
  if (!ui.plan || ui.plan.id !== t.id) ui.plan = {id: t.id};
  const P = ui.plan; const mode = S.mode || 'tekne';
  const techs = techsFor(s); const tech = P.tech && techs.includes(P.tech) ? P.tech : techs[0]; if (!tech) return {s, t, techs: []};
  const T = KB.TECH[tech];
  const lays = tech === 'eging' ? [s.id === 'ahtapot' ? 'ahtapot' : 'egi'] : T.lay;
  const lay = P.lay && lays.includes(P.lay) ? P.lay : lays[0];
  const F = KB.FAM[s.fam] || {}; const famK = F.hook ? Object.keys(F.hook) : ['porsiyon', 'trofe'];
  const klasses = ['porsiyon', 'trofe'].filter(k => s.sz[k] && famK.includes(k));
  const klass = P.klass && klasses.includes(P.klass) ? P.klass : (klasses[0] || 'porsiyon');
  const times = [...new Set(s.t.map(x => x === 'gece' ? 'gece' : 'gunduz'))];
  const time = P.time && times.includes(P.time) ? P.time : (times.includes('gunduz') ? 'gunduz' : times[0]);
  const ans = {mode: T.modes.includes(mode) ? mode : T.modes[0], region: regionOf(loc()), techs: [tech], species: [s.id], baits: (S.profile.baits || []).slice(), lay: {[tech]: [lay]}, klass, time, bottoms: [], size: 'dengeli', rodMax: '', name: ''};
  const raw = genSystem(ans).find(r => !r.own) || genSystem(ans)[0] || null;
  if (raw && t.like) { raw.name = t.name + ' · ' + KB.LAY[lay].name; raw.target = t.name; }
  const rg = raw ? resolveRig(Object.assign({sys: 'plan'}, raw, {id: 'plan:' + s.id})) : null;
  return {s, t, techs, tech, lays, lay, klasses, klass, times, time, ans, raw, rg};
}
function targetStatus(t){
  const sid = t.like || t.id; const rs = RIG_LIST.filter(r => (r.species || []).includes(sid));
  return {rs, ok: rs.filter(ready)};
}
// ---- Türlerim listesi
function sheetTurler(){
  const tg = S.targets || [];
  const chip = st => st.ok.length ? '<span class="chip A">Hazır · ' + st.ok.length + ' rig</span>' : st.rs.length ? '<span class="chip buy">Eksik · ' + st.rs.length + ' rig</span>' : '<span class="chip">Takım yok</span>';
  const row = t => { const s = tgtSp(t); const st = targetStatus(t);
    return '<button type="button" class="mrow" data-tur="' + esc(t.id) + '"><span><b>' + esc(t.name) + '</b><small>' + esc(s ? (t.like ? 'benzer: ' + s.name + ' · ' : '') + (KB.FAM[s.fam] || {}).name : '') + '</small></span>' + chip(st) + '</button>'; };
  const mine = new Set(tg.map(t => t.like || t.id));
  const sysSp = [...new Set(RIG_LIST.flatMap(r => r.species || []))].filter(id => !mine.has(id) && spById(id));
  return sheetBar('Türlerim', '<button class="btn" type="button" data-open="turtakvim">Takvim</button>') + '<div class="stack"><p class="sub">Hedeflediğin türü ekle; uygulama hangi takımla gitmen gerektiğini, elinde ne olduğunu ve neyi alman gerektiğini çıkarır.</p>' +
    '<label class="f">Tür ekle<input id="tr-q" type="search" placeholder="Ör. istavrit, çinekop, sinarit" autocomplete="off"></label><div class="catres" id="trRes"></div>' +
    (ui.custom ? customPick() : '') +
    (tg.length ? '<div class="eyebrow">Hedef türlerim (' + tg.length + ')</div><div class="mlist">' + tg.map(row).join('') + '</div>' : '<div class="empty">Henüz tür eklemedin. Yukarıya bir tür adı yaz.</div>') +
    (sysSp.length ? '<div class="eyebrow">Rig sistemimdeki türler</div><div class="bchips">' + sysSp.map(id => '<button type="button" class="bchip" data-tur="' + esc(id) + '">' + esc(spById(id).name) + '</button>').join('') + '</div>' : '') + '</div>';
}
function trSearch(q){
  const el = $('trRes'); if (!el) return;
  const res = speciesSearch(q);
  el.innerHTML = res.map(r => '<button type="button" class="catpick" data-tradd="' + esc(r.s.id) + '"><b>' + esc(r.s.name) + (r.via ? ' <small>(' + esc(r.via) + ')</small>' : '') + '</b><small>' + esc(r.s.latin + ' · ' + ((KB.FAM[r.s.fam] || {}).name || '')) + '</small></button>').join('') +
    (slugTR(q).length >= 2 && !res.some(r => [r.s.name].concat(SP_ALIAS[r.s.id] || []).some(x => slugTR(x) === slugTR(q))) ? '<button type="button" class="catpick" data-trcustom="' + esc(q.trim()) + '"><b>“' + esc(q.trim()) + '” listede yok</b><small>Adıyla ekle ve hangi türe benzediğini seç</small></button>' : '');
}
function customPick(){
  const by = {}; KB.SPECIES.forEach(s => { (by[s.fam] = by[s.fam] || []).push(s); });
  return '<section class="set"><h4>“' + esc(ui.custom) + '” hangi türe benziyor?</h4><p class="note">Takım planı benzer türün kurallarıyla çıkar; adı senin yazdığın gibi kalır.</p>' +
    Object.keys(by).map(f => '<div class="eyebrow">' + esc((KB.FAM[f] || {}).name || f) + '</div><div class="bchips">' + by[f].map(s => '<button type="button" class="bchip" data-trlike="' + esc(s.id) + '">' + esc(s.name) + '</button>').join('') + '</div>').join('') +
    '<button class="btn small" type="button" data-trcustom="">Vazgeç</button></section>';
}
function addTarget(id, name, like){
  S.targets = S.targets || [];
  const tid = like ? 'c:' + slugTR(name) : id;
  if (!S.targets.some(t => t.id === tid)) S.targets.push({id: tid, name: name || (spById(id) || {}).name || id, like: like || null, added: new Date().toISOString()});
  ui.custom = null; persist(); return tid;
}
// ---- tür planı
function sheetTur(id){
  let t = (S.targets || []).find(x => x.id === id);
  if (!t) { const s = spById(id); if (!s) return sheetBar('Tür') + '<div class="empty">Tür bulunamadı.</div>'; t = {id, name: s.name, like: null, temp: true}; }
  const p = planFor(t); const s = p.s;
  const mode = S.mode || 'tekne'; const reg = regionOf(loc()); const REG = Object.fromEntries(KB.REGIONS);
  const month = new Date().getMonth() + 1;
  const info = [
    ['Takım ailesi', (KB.FAM[s.fam] || {}).name],
    ['Ne zaman', KB.CAL[s.id] ? calSummary(s.id, month) : s.m ? s.m.map(m => MON3[m - 1]).join(' ') + (s.m.includes(month) ? ' · şu an mevsimi' : ' · şu an mevsimi değil') : 'Yıl boyu'],
    ['Su', KB.CAL[s.id] ? suTxt(s.id) : ''],
    ['Saat', s.t.map(x => ({gunduz: 'gündüz', gece: 'gece', safak: 'şafak'}[x] || x)).join(', ')],
    ['Derinlik', s.depth[0] + '–' + s.depth[1] + ' m'],
    ['Dip', s.hab.map(b => BOTTOM_TXT[b] || b).join(', ')],
    [[].concat(s.b.g || [], s.b.n || []).every(x => LURE_WORDS.test(trLower(x))) ? 'Sahte yem' : 'Yem', [].concat(s.b.g || [], s.b.n || []).filter((x, i, a) => a.indexOf(x) === i).join(', ')],
    ['Boy', Object.entries(s.sz).map(([k, v]) => (k === 'trofe' ? 'trofe ' : 'porsiyon ') + v).join(' · ')],
    ['Bölge', s.bol.map(r => REG[r]).join(', ')]];
  const warn = [];
  if (!s.bol.includes(reg)) warn.push('Bu tür ' + (REG[reg] || reg) + ' bölgesinde az görülür (genel bilgi).');
  if (s.note) warn.push(s.note);
  // grubundan bu türün avları
  let grp = '';
  try { const L = loc(); const gc = (typeof grpCatches === 'function' ? grpCatches() : []).filter(c => c.sp === s.id);
    if (gc.length) { const near = L ? gc.map(c => distKm(L, c)).sort((a, b) => a - b)[0] : null;
      grp = '<p class="note"><b>Grubunda ' + gc.length + ' av</b>' + (near != null ? ', en yakını ' + f1(near) + ' km' : '') + '. Yerini ortak av haritasında gör.</p>'; } } catch (e) {}
  const st = targetStatus(t);
  const ds = days(); const dd = ds.find(d => d.key === dateKey(new Date())) || ds[0];
  const have = st.rs.length ? '<section class="set"><h4>Sistemindeki takım</h4>' + st.rs.slice(0, 4).map(r => '<div class="row" style="justify-content:space-between"><span>' + esc((r.code ? r.code + ' · ' : '') + r.name) + '</span>' + (ready(r) ? '<span class="chip A">Hazır</span>' : '<span class="chip buy">Eksik: ' + missingOf(r).length + '</span>') + '</div>').join('') + '</section>' : '';
  let plan = '';
  if (p.rg) {
    const miss = missingOf(p.rg);
    const techChips = p.techs.map(x => '<button class="btn small" type="button" data-trtech="' + x + '" aria-pressed="' + (x === p.tech) + '">' + esc(KB.TECH[x].name.replace(/\s*\(.*?\)/g, '')) + (KB.TECH[x].modes.includes(mode) ? '' : ' (' + (mode === 'tekne' ? 'kıyı' : 'tekne') + ')') + '</button>').join('');
    const layChips = p.lays.length > 1 ? '<div class="seg wrapseg">' + p.lays.map(l => '<button class="btn small" type="button" data-trlay="' + l + '" aria-pressed="' + (l === p.lay) + '">' + esc(KB.LAY[l].name) + '</button>').join('') + '</div>' : '';
    const kChips = p.klasses.length > 1 ? p.klasses.map(k => '<button class="btn small" type="button" data-trklass="' + k + '" aria-pressed="' + (k === p.klass) + '">' + (k === 'trofe' ? 'Trofe' : 'Porsiyon') + '</button>').join('') : '';
    const tChips = p.times.length > 1 ? p.times.map(k => '<button class="btn small" type="button" data-trtime="' + k + '" aria-pressed="' + (k === p.time) + '">' + (k === 'gece' ? 'Gece' : 'Gündüz') + '</button>').join('') : '';
    const sys = S.systems.tur; const added = sys && (sys.rigs || []).find(r => r.plan && r.plan.target === t.id && r.tech === p.tech && r.lay === p.lay && r.klass === p.klass && r.time === p.raw.time);
    const bp = baitPick(p.rg);
    plan = '<section class="set"><h4>Önerilen takım</h4><p class="note">' + esc(KB.TECH[p.tech].desc) + (gearReady(p.lay, p.ans.mode) ? ' Elindeki kamış ve makine bu işe uyuyor.' : '') + '</p>' +
      '<div class="seg wrapseg">' + techChips + '</div>' + layChips + ((kChips || tChips) ? '<div class="seg wrapseg">' + kChips + tChips + '</div>' : '') + '</section>' +
      rigCard(p.rg, dd, null, null, 'envanter') +
      '<section class="set"><h4>' + (miss.length ? 'Alman gerekenler (' + miss.length + ')' : 'Takımın tam') + '</h4>' +
      (miss.length ? '<ul class="buy">' + miss.map(sl => { const e = sl.t.envanter || {}; const tk = sl.t.turkiye || {}; const it = e.item && ITEMS[e.item];
        const nm = it ? it.name : (tk.name || e.name || ''); const sz = e.size || tk.size;
        return '<li><b>' + esc(sl.label) + ':</b> ' + (nm && nm !== sl.label ? esc(nm) + ' ' : '') + (sz ? '<span class="mono">' + esc(sz) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="note">Bu rig için gereken her şey envanterinde var.</p>') +
      (bp.use && bp.use.st ? '<p class="note"><b>Yem:</b> ' + esc(bp.use.t) + (bp.use.st === 'var' ? ' (elinde)' : ' (gitmeden al; rigin hazır olmasını etkilemez)') + '</p>' : '') +
      '<div class="row">' + (miss.length ? '<button class="btn primary" type="button" data-trshop="' + esc(t.id) + '">Alışveriş listesine aktar</button>' : '') +
      (added ? '<button class="btn" type="button" data-trdelrig="' + esc(added.id) + '">Sistemimden çıkar</button>' : '<button class="btn" type="button" data-trrig="' + esc(t.id) + '">Rigi sistemime ekle</button>') + '</div>' +
      (added ? '<p class="note">Bu rig “Tür planlarım” sisteminde' + (ready(RIGS[added.id] || p.rg) ? ' ve hazır; uygun günde önerilere girer.' : '; eksikler tamamlanınca önerilere girer.') + '</p>' : '') + '</section>';
  } else plan = '<div class="empty">Bu tür için önerilecek takım bulunamadı.</div>';
  return '<div class="bar"><button class="btn" type="button" data-open="turler">Geri</button><h3 id="sheetTitle">' + esc(t.name) + '</h3><span style="width:64px"></span></div><div class="stack">' +
    (hasFishArt(s.id) ? '<div class="tur-art ' + fishKind(s.id) + '">' + fishArt(s.id, s.name) + '</div>' : '') +
    '<p class="sub">' + esc(s.latin) + (t.like ? ' · “' + esc(s.name) + '” kurallarıyla' : '') + (hasFishArt(s.id) ? ' · çizim temsilîdir' : '') + '</p>' +
    '<div class="tbl panel info"><table><tbody>' + info.map(([k, v]) => '<tr><th>' + esc(k) + '</th><td>' + esc(v || '—') + '</td></tr>').join('') + '</tbody></table></div>' +
    warn.map(w => '<p class="banner">' + esc(w) + '</p>').join('') + grp + have + plan +
    '<section class="set dan-cta"><h4>Marka ve model önerisi</h4><p class="note">Takım danışmanı yapay zekâyla internette arar: Türkiye’de satılan kamış, makine, ip, iğne ve aksesuarı noktana ve elindeki takıma göre önerir; motor ölçüleri kontrol eder.</p><button class="btn primary small" type="button" data-danopen="' + esc(JSON.stringify({sp: s.id})) + '">Takım danışmanına sor</button></section>' +
    '<p class="note">Takım bilgisi geneldir. Bölgende bu türün nerede ve ne zaman olduğunu arkadaşlarına sor; en azından hangi takımla gideceğini baştan bilirsin.</p>' +
    (t.temp ? '<button class="btn" type="button" data-trkeep="' + esc(t.id) + '">Hedef türlerime ekle</button>' : '<button class="btn small" type="button" data-trdel="' + esc(t.id) + '" style="color:var(--D)">Listeden çıkar</button>') + '</div>';
}
// eksikleri alışveriş listesine aktar ("<tür> için")
function planToShop(id){
  const t = (S.targets || []).find(x => x.id === id) || {id, name: (spById(id) || {}).name || id};
  const p = planFor(t); if (!p || !p.rg) return 0;
  S.shopX = S.shopX || {}; let n = 0;
  missingOf(p.rg).forEach(sl => {
    const e = sl.t.envanter || {}; const tk = sl.t.turkiye || {};
    const k = e.item ? e.item + '|' + (e.size || '-') : 'x|' + (tk.name || e.name || sl.label) + '|' + (tk.size || '');
    const x = S.shopX[k] = S.shopX[k] || {k, item: e.item || null, size: e.item ? e.size : (tk.size || null), name: e.item ? null : (tk.name || e.name || sl.label), store: tk.store || null, kind: sl.kind, sp: sl.sp || null, for: [], added: new Date().toISOString()};
    if (!x.for.includes(t.name)) { x.for.push(t.name); n++; }
  });
  persist(); return n;
}
// rigi "Tür planlarım" sistemine ekle (Rig Atölyesi rigi gibi saklanır; envanter değiştikçe kendiliğinden güncellenir)
function planToSystem(id){
  let t = (S.targets || []).find(x => x.id === id);
  if (!t) { addTarget(id); t = S.targets.find(x => x.id === id); }
  const p = planFor(t); if (!p || !p.raw) return null;
  const sys = S.systems.tur = S.systems.tur || {id: 'tur', name: 'Tür planlarım', source: 'tur', active: true, created: new Date().toISOString(), rigs: []};
  const raw = JSON.parse(JSON.stringify(p.raw));
  let code = 'T-' + raw.code, c = code, n = 2; while (sys.rigs.some(r => r.code === c)) c = code + '·' + n++;
  raw.code = c; raw.id = 'tur:' + c; raw.plan = {species: p.s.id, target: t.id};
  sys.rigs.push(raw); sys.active = true; sys.updated = new Date().toISOString();
  S.onboarded = true; persist(); indexAll(); return raw.id;
}
// ---- Tür takvimi (v0.19): Ege için ay ay oltaya gelme ve sevdiği su sıcaklığı (52-tune.js, KB.CAL)
// ardışık ayları aralık olarak yaz (Ara–Şub gibi yıl dönümünü de)
function monthRuns(sel){
  if (sel.size >= 12) return 'yıl boyu';
  if (!sel.size) return '';
  let start = 0; while (sel.has(start)) start++;
  const runs = []; let cur = null;
  for (let k = 1; k <= 12; k++) { const i = (start + k) % 12; if (sel.has(i)) { if (!cur) cur = [i, i]; else cur[1] = i; } else if (cur) { runs.push(cur); cur = null; } }
  if (cur) runs.push(cur);
  return runs.map(([a, b]) => a === b ? MON3[a] : MON3[a] + '–' + MON3[b]).join(', ');
}
function calSummary(id, month){
  const by = [new Set(), new Set(), new Set(), new Set()];
  for (let i = 0; i < 12; i++) by[calMonth(id, i + 1)].add(i);   // Ekim–Kasım: özel paketteki tahmin varsa o
  const best = monthRuns(by[3]), good = monthRuns(by[2]);
  return [best ? 'en iyi ' + best : '', good ? 'iyi ' + good : '', 'şu an ' + CAL_TXT[calMonth(id, month)]].filter(Boolean).join(' · ');
}
const todaySst = () => { if (!WX || landMode()) return null; const ds = days(); const dd = ds.find(d => d.key === dateKey(new Date())) || ds[0]; return dd ? dd.sst : null; };
function suTxt(id){
  const r = KB.CAL[id][1], t = todaySst();
  return 'ideal ' + f0(tempNum(r[1])) + '–' + f0(tempNum(r[2])) + ' ' + TU() + (t != null ? ' · bugün ' + tempTxt(t, true) + ', ' + tempWord(t, r) : '');
}
function sheetSpeciesCal(){
  const month = new Date().getMonth() + 1, sst = todaySst(), L = loc(), reg = regionOf(L);
  const mine = new Set(RIG_LIST.flatMap(r => r.species || []).concat((S.targets || []).map(t => t.like || t.id)));
  const all = ui.calAll || !mine.size;
  const list = KB.SPECIES.filter(s => KB.CAL[s.id] && (all ? (s.bol.includes(reg) || mine.has(s.id)) : mine.has(s.id)))
    .map(s => ({s, n: spNow(s.id, month, sst)})).sort((a, b) => b.n.v - a.n.v || b.n.m - a.n.m || trCmp(a.s.name, b.s.name));
  const head = '<div class="tcal-r tcal-h"><span class="nm"></span>' + MON3.map((m, i) => '<span class="mo' + (i + 1 === month ? ' now' : '') + '">' + m.charAt(0) + '</span>').join('') + '<span class="su">su ' + TU() + '</span></div>';
  const rows = list.map(({s, n}) => { const c = KB.CAL[s.id], w = sst != null ? tempWord(sst, c[1]) : '';
    return '<button type="button" class="tcal-r" data-tur="' + esc(s.id) + '"><span class="nm">' + esc(s.name) + (mine.has(s.id) && all ? ' <i class="mk" aria-label="sistemimde"></i>' : '') + '</span>' +
      MON3.map((x, i) => '<span class="c c' + calMonth(s.id, i + 1) + (i + 1 === month ? ' now' : '') + '"></span>').join('') +
      '<span class="su ' + (w === 'ideal' ? 'ok' : /soğuk/.test(w) ? 'cold' : /sıcak/.test(w) ? 'hot' : '') + '">' + f0(tempNum(c[1][1])) + '–' + f0(tempNum(c[1][2])) + '</span></button>'; }).join('');
  return sheetBar('Tür takvimi') + '<div class="stack"><p class="sub">Ege için ay ay oltaya gelme ve türün sevdiği su sıcaklığı. Genel bilgidir; yıla ve noktaya göre değişir. Avların ve “tuttu / tutmadı” bildirimlerin önerileri senin noktana göre ayarlar.</p>' +
    (mine.size ? '<div class="seg wrapseg"><button class="btn small" type="button" data-tcal="mine" aria-pressed="' + !all + '">Sistemimdeki türler</button><button class="btn small" type="button" data-tcal="all" aria-pressed="' + all + '">Bölgenin türleri</button></div>' : '') +
    (sst != null ? '<p class="note">Bugün su <b>' + tempTxt(sst, true) + '</b> (' + esc(locLabel(L)) + '). Sağdaki sütun türün sevdiği su: yeşil uygun, mavi soğuk, kırmızı sıcak.</p>' : '<p class="note">Su sıcaklığı deniz noktası seçilince gelir.</p>') +
    '<div class="tcal">' + head + rows + '</div>' +
    '<div class="tcal-leg"><span><i class="c c1"></i>az</span><span><i class="c c2"></i>iyi</span><span><i class="c c3"></i>en iyi</span><span class="note">Bu ay: ' + MON_LONG[month - 1] + '. Türe dokun: takım planı.</span></div></div>';
}
