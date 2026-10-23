// ---------------------------------------------------------------- 72 · Rigler ve Envanter
function renderRigs(){
  const sys = Object.values(S.systems);
  const all = RIG_LIST; const n = all.filter(ready).length;
  $('rigEyebrow').textContent = sys.length ? sys.length + ' sistem · ' + all.length + ' rig' : 'Rig sistemi yok';
  $('rigSub').textContent = all.length ? n + ' rig tamam, ' + (all.length - n) + ' rig eksik kalem bekliyor. Tamamlanmayanlar soluk görünür ve öneriye girmez.' : '';
  $('sysBar').innerHTML = (sys.length > 1 ? '<button class="btn small" data-sys="all" aria-pressed="' + (ui.sys === 'all') + '">Tümü</button>' : '') +
    sys.map(sy => '<button class="btn small" data-sys="' + esc(sy.id) + '" aria-pressed="' + (ui.sys === sy.id || sys.length === 1) + '">' + esc(sy.name) + '</button>').join('') +
    '<button class="btn small" type="button" data-act="wizard">+ Yeni sistem</button><button class="btn small" type="button" data-open="turler">Türlerim</button>';
  const one = sys.length === 1 ? sys[0] : S.systems[ui.sys];
  const wOk = !!(one && one.source === 'paket');   // "Dünyanın en iyisi" yalnız 32'lik özel sistemde, yalnız bu seçicide
  const tier = S.settings.tier === 'dunya' && !wOk ? 'turkiye' : (S.settings.tier || 'envanter');
  $('sysTools').innerHTML = (one ? '<div class="systools"><span class="note">' + esc(one.source === 'paket' ? 'Özel paket' : one.source === 'tur' ? 'Tür planından' : 'Rig Atölyesi') + (one.active === false ? ' · kapalı, önerilere girmez' : '') + '</span>' +
      (one.source === 'sihirbaz' ? '<button class="linkbtn" type="button" data-systool="edit" data-sid="' + esc(one.id) + '">Cevapları düzenle</button>' : '') +
      '<button class="linkbtn" type="button" data-systool="toggle" data-sid="' + esc(one.id) + '">' + (one.active === false ? 'Aç' : 'Kapat') + '</button>' +
      (one.source !== 'paket' ? '<button class="linkbtn" type="button" data-systool="del" data-sid="' + esc(one.id) + '">Sil</button>' : '') + '</div>' : '') +
    (sys.length ? '<div class="seg wrapseg tiers">' + TIERS.slice().reverse().filter(t => t !== 'dunya' || wOk).map(t => '<button class="btn small" type="button" data-tier="' + t + '" aria-pressed="' + (tier === t) + '">' + esc(TIER_TXT[t]) + '</button>').join('') + '</div>' : '');
  if (!all.length) {
    $('rigSeg').innerHTML = ''; $('rigSearch').hidden = true;
    if (sys.length) { $('rigList').innerHTML = '<div class="empty">Açık sistemde rig yok. Kapalı bir sistemi açabilir ya da yeni sistem kurabilirsin.</div>'; return; }
    $('rigList').innerHTML = '<div class="panel stack"><h3>Rig sistemini kur</h3><p class="sub">Uygulama boş başlar. Nasıl avlandığını, hangi türü hedeflediğini ve takım tercihini sorup sana özel bir rig sistemi kurar; her rig için envanterinden ve Türkiye\'de bulunabilen en iyi olmak üzere iki malzeme seviyesi verir.</p>' +
      '<div class="row"><button class="btn primary" type="button" data-act="wizard">Rig sistemimi kur</button><button class="btn" type="button" data-open="paket">Özel paketimi aç</button></div></div>';
    return;
  }
  $('rigSearch').hidden = false;
  const groups = [...new Set(all.filter(r => r.group).map(r => r.group + '|' + r.groupName))].map(s => s.split('|'));
  const segs = [['all', 'Tümü'], ['ready', 'Tamam'], ['missing', 'Tamamlanmadı']].concat(groups);
  $('rigSeg').innerHTML = segs.map(([k, t]) => '<button class="btn small" data-rseg="' + esc(k) + '" aria-pressed="' + (ui.rigSeg === k) + '">' + esc(t) + '</button>').join('');
  const q = trLower(ui.q.trim());
  const ds = days(); const dd = ds.find(d => d.key === dateKey(new Date())) || ds[0];
  const list = all.filter(rg => {
    if (ui.sys !== 'all' && sys.length > 1 && rg.sys !== ui.sys) return false;
    if (ui.rigSeg === 'ready' && !ready(rg)) return false;
    if (ui.rigSeg === 'missing' && ready(rg)) return false;
    if (!['all', 'ready', 'missing'].includes(ui.rigSeg) && rg.group !== ui.rigSeg) return false;
    if (!q) return true;
    return trLower([rg.code, rg.name, rg.target, rg.baitText].concat(rg.slots.map(sl => (sl.t.envanter && sl.t.envanter.name) || '')).join(' ')).includes(q);
  });
  $('rigList').innerHTML = list.length ? list.map(rg => rigCard(rg, dd, null, null, tier)).join('') : '<div class="empty">Bu filtrede rig yok.</div>';
}
const INV_SEG = [['hook', 'İğneler'], ['line', 'İp ve florokarbon'], ['gear', 'Makine ve kamış'], ['jig', 'Jig, zoka, sahte'], ['terminal', 'Terminal ve kurşun'], ['bait', 'Yem'], ['ekip', 'Ekipman']];
const INV_CATS = {hook: ['hook'], line: ['braid', 'fc', 'mono'], gear: ['reel', 'rod'], jig: ['jig', 'lure'], terminal: ['terminal', 'sinker'], bait: ['bait'], ekip: ['ekip']};
const CAT_TXT = {hook: 'İğne', braid: 'Örgü ip', fc: 'Florokarbon', mono: 'Misina (naylon)', reel: 'Makine', rod: 'Kamış', jig: 'Jig / zoka', lure: 'Sahte yem', terminal: 'Terminal', sinker: 'Kurşun', bait: 'Yem', ekip: 'Ekipman'};
const HOOK_PATTERNS = ['Chinu', 'Maruseigo', 'Iseama', 'Octopus / beak', 'Mutsu / circle', 'Circle', 'J (dövme, güçlü)', 'Baitholder (palalı)', 'Aberdeen (ince tel)', 'Canlı yem', 'Assist (jig)', 'Üçlü (treble)', 'Jighead', 'Diğer'];
const ROD_T = [['tekne', 'Tekne dip'], ['slowjig', 'Slow jig'], ['jig', 'Jig (ağır)'], ['spin', 'Spin'], ['lrf', 'LRF / ultralight'], ['surf', 'Surf'], ['samandira', 'Şamandıra / bolonez'], ['egi', 'Egi'], ['sirti', 'Sırtı (trolling)'], ['buyuk', 'Büyük oyun (stand-up)'], ['diger', 'Diğer']];
const REEL_T = [['spin', 'Spinning (açık makara)'], ['cikrik', 'Çıkrık (lever drag / baitcasting)']];
const INV_HINT = {hook: 'Hazır listeden elindeki iğneleri işaretle. Boya dokun: var → bitti (alınacak) → yok. Adet ya da paketle saymak istersen kalemin üstünden seç.',
  line: 'Makaralarını “+ Kalem ekle” ile gir (marka ve çap). Adet sorulmaz: var ya da yok.', gear: 'Kamış ve makinelerini gir; hayalindekini “Alınacak” olarak ekleyebilirsin. Adet sorulmaz.',
  jig: 'Hazır listeden işaretle ya da kendi jig ve zokalarını ekle. İstersen adetle say.', terminal: 'Terminalde adet yok, yalnızca var mı yok mu. Kurşunda elindeki gramajlara dokun.',
  ekip: 'Pense, kepçe, lamba gibi ekipmanın.'};
function gearMeta(it){
  if (it.cat === 'rod' && it.rod) { const r = it.rod; return [(ROD_T.find(x => x[0] === r.type) || [0, ''])[1], r.len ? fmtNum(r.len, 2) + ' m' : '', r.max ? 'max ' + r.max + ' g' : '', r.pe ? 'PE ' + fmtNum(r.pe, 1) : ''].filter(Boolean).join(' · '); }
  if (it.cat === 'reel' && it.reel) { const r = it.reel; return [(REEL_T.find(x => x[0] === r.type) || [0, ''])[1], r.size ? 'boy ' + r.size : ''].filter(Boolean).join(' · '); }
  return '';
}
function itemSum(it){ const sts = sizesOf(it).map(sz => stockOf(it.id, sz)); return {have: sts.some(usable), buy: sts.some(toBuy), sts}; }
// tek boylu kalem: Var / Alınacak / Yok
function stSeg(k, st){
  const cur = usable(st) ? 'var' : toBuy(st) ? 'alinacak' : 'yok';
  return '<span class="stseg" role="group">' + [['var', 'Var'], ['alinacak', st === 'bitti' ? 'Bitti · al' : 'Alınacak'], ['yok', 'Yok']].map(([v, t]) => '<button type="button" data-stk="' + esc(k) + '" data-st="' + v + '" aria-pressed="' + (cur === v) + '">' + t + '</button>').join('') + '</span>';
}
// çok boylu kalem: boy çipi (dokun: yok → var → alınacak → yok)
function sizeChip(it, sz){
  const k = it.id + '|' + sz; const st = stockOf(it.id, sz);
  const cls = usable(st) ? 'on' : toBuy(st) ? 'buy' : '';
  return '<button type="button" class="szc ' + cls + '" data-cyc="' + esc(k) + '" aria-label="' + esc(sz + ': ' + ST_TXT[st]) + '">' + esc(sz) + (toBuy(st) ? '<small>al</small>' : '') + '</button>';
}
function qtyRow(it, sz, u){
  const k = it.id + '|' + sz; const st = stockOf(it.id, sz); const n = qtyOf(k);
  return '<div class="qrow"><span class="lb"><span class="dot ' + st + '"></span>' + esc(sz !== '-' ? sz : ST_TXT[st]) + '</span>' +
    '<span class="qty"><button type="button" data-step="-1" data-k="' + esc(k) + '" aria-label="Azalt">−</button><input id="q-' + esc(k.replace(/[^a-z0-9]/gi, '_')) + '" data-qk="' + esc(k) + '" inputmode="numeric" value="' + esc(n == null ? '' : n) + '" placeholder="–" aria-label="' + esc(it.name + ' ' + (sz !== '-' ? sz : '') + ' ' + u) + '"><button type="button" data-step="1" data-k="' + esc(k) + '" aria-label="Arttır">+</button></span>' +
    '<span class="u">' + (u === 'paket' ? 'paket' : 'adet') + '</span><button type="button" class="albtn" data-alk="' + esc(k) + '" aria-pressed="' + toBuy(st) + '">' + (st === 'bitti' ? 'Bitti · al' : 'Alınacak') + '</button></div>';
}
function itemCard(it){
  const u = unitOf(it); const sizes = sizesOf(it);
  const used = RIG_LIST.filter(r => r.slots.some(sl => sl.t.envanter && sl.t.envanter.item === it.id)).length;
  const meta = [gearMeta(it), it.type || (it.cat === 'hook' ? it.pattern : ''), it.spec, it.use || it.note].filter(x => x && x !== '—').join(' · ');
  let ctl;
  if (u !== 'durum') {
    // sayılan kalemde yalnızca işaretli boylar satır olur; diğer boylar küçük çip (dokununca 1 ile başlar)
    const marked = sizes.filter(sz => { const k = it.id + '|' + sz; return qtyOf(k) != null || S.inv.status[k] != null || baseStatus(it, sz) !== 'yok'; });
    const rest = sizes.filter(sz => !marked.includes(sz));
    ctl = marked.map(sz => qtyRow(it, sz, u)).join('') + (rest.length ? '<div class="szs"><span class="note">Diğer boylar:</span>' + rest.map(sz => '<button type="button" class="szc" data-qadd="' + esc(it.id + '|' + sz) + '">' + esc(sz) + ' +</button>').join('') + '</div>' : '');
  }
  else if (sizes.length === 1 && sizes[0] === '-') ctl = stSeg(it.id + '|-', stockOf(it.id, '-'));
  else ctl = '<div class="szs">' + sizes.map(sz => sizeChip(it, sz)).join('') + '</div>';
  const units = UNITS[it.cat] ? '<span class="useg" role="group" aria-label="Sayım">' + UNITS[it.cat].map(x => '<button type="button" data-unit="' + esc(it.id) + '" data-u="' + x + '" aria-pressed="' + (u === x) + '">' + UNIT_TXT[x] + '</button>').join('') + '</span>' : '';
  return '<div class="item"><div class="ih"><div class="nm">' + esc(it.name) + (used ? ' <span class="chip">' + used + ' rigde</span>' : '') + (it.store ? ' <span class="store">Mağaza ' + esc(it.store) + '</span>' : '') +
    (it.std ? ' <span class="chip">Hazır liste</span>' : '') + (it.src === 'paket' || it.std ? '' : ' <button class="linkbtn" type="button" data-edititem="' + esc(it.id) + '">Düzenle</button>') + '</div>' +
    (meta ? '<div class="sp">' + esc(meta) + '</div>' : '') + '</div>' + units + ctl + '</div>';
}
// hazır listedeki işaretlenmemiş kalem: kısa satır, boyları çip
function stdRow(it){
  const sizes = sizesOf(it);
  return '<div class="srow"><span class="nm">' + esc(it.name) + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</span>' +
    (sizes.length === 1 && sizes[0] === '-' ? '<button type="button" class="szc" data-stk="' + esc(it.id + '|-') + '" data-st="var">Var</button>' : '<span class="szs">' + sizes.map(sz => sizeChip(it, sz)).join('') + '</span>') + '</div>';
}
const openAttr = k => ui.open && ui.open[k] ? ' open' : '';
function renderInventory(){
  $('invSeg').innerHTML = INV_SEG.map(([k, t]) => '<button class="btn small" data-iseg="' + k + '" aria-pressed="' + (ui.inv === k) + '">' + t + '</button>').join('');
  const all = Object.values(ITEMS);
  const mine = all.filter(i => !i.std || itemSum(i).have || itemSum(i).buy);
  const nHave = mine.filter(i => i.cat !== 'bait' && itemSum(i).have).length, nBuy = shoppingList().length;
  $('invEyebrow').textContent = mine.length ? nHave + ' kalem var' + (nBuy ? ' · ' + nBuy + ' alınacak' : '') : 'Envanter boş';
  if (ui.inv === 'bait') { $('invList').innerHTML = baitPanel(); return; }
  const its = all.filter(i => INV_CATS[ui.inv].includes(i.cat)).sort((a, b) => trCmp(a.name, b.name));
  const sum = new Map(its.map(i => [i.id, itemSum(i)]));
  const own = its.filter(i => !i.std || sum.get(i.id).have || sum.get(i.id).buy);
  const have = own.filter(i => sum.get(i.id).have), buy = own.filter(i => !sum.get(i.id).have && sum.get(i.id).buy), rest = own.filter(i => !sum.get(i.id).have && !sum.get(i.id).buy);
  const std = its.filter(i => i.std && !sum.get(i.id).have && !sum.get(i.id).buy);
  const sec = (t, list) => list.length ? '<div class="eyebrow">' + esc(t) + ' (' + list.length + ')</div>' + list.map(itemCard).join('') : '';
  let stdHtml = '';
  if (std.length) {
    // gruplar hazır listenin kendi sırasıyla (iğnede Chinu önce, terminalde fırdöndü önce); tek boylu kalemler çip, çok boylular satır
    const g = {}; std.slice().sort((a, b) => STD.indexOf(a) - STD.indexOf(b)).forEach(i => { (g[i.grp || 'Diğer'] = g[i.grp || 'Diğer'] || []).push(i); });
    const one = i => sizesOf(i).length === 1 && sizesOf(i)[0] === '-';
    const grpHtml = list => { const ones = list.filter(one).sort((a, b) => trCmp(a.name, b.name)), multi = list.filter(i => !one(i)).sort((a, b) => trCmp(a.name, b.name));
      return (ones.length ? '<div class="bchips">' + ones.map(i => '<button type="button" class="bchip" data-stk="' + esc(i.id + '|-') + '" data-st="var">' + esc(i.name) + '</button>').join('') + '</div>' : '') + multi.map(stdRow).join(''); };
    const dk = 'std-' + ui.inv; ui.open = ui.open || {};
    if (ui.open[dk] == null && !own.length) ui.open[dk] = true;   // hiç kalem yokken hazır liste açık başlar ve açık kalır
    stdHtml = '<details class="stdl" data-dk="' + dk + '"' + openAttr(dk) + '><summary>Hazır liste: elindekileri işaretle (' + std.length + ')</summary>' +
      '<p class="note">Varsayılan “yok”. ' + (ui.inv === 'hook' || ui.inv === 'jig' ? 'Boya dokun: var → bitti (alınacak) → yok; işaretlediğin kalem yukarı “Var” bölümüne çıkar.' : 'Dokununca “var” olur ve yukarı çıkar.') + '</p>' +
      Object.keys(g).map(k => '<div class="sgrp"><div class="gh">' + esc(k) + '</div>' + grpHtml(g[k]) + '</div>').join('') + '</details>';
  }
  $('invList').innerHTML = '<p class="note">' + esc(INV_HINT[ui.inv] || '') + '</p>' + sec('Var', have) + sec('Alınacak / bitti', buy) + sec('Elinde yok', rest) + stdHtml +
    (!own.length && !std.length ? '<div class="empty">Bu grupta kalem yok. “+ Kalem ekle” ile gir.</div>' : '');
}
// yemler: adet yok, yalnızca isim; varsayılan "yok". Avdan önce aldığını "var" yap; rigin hazır olmasını etkilemez.
function baitPanel(){
  const baits = Object.values(ITEMS).filter(i => i.cat === 'bait');
  const grpOf = i => i.std ? i.grp : ((STD_BAITS.find(b => b.key === baitKey(i.name) && !!b.live === /canlı/.test(trLower(i.name))) || {}).grp || 'diger');
  const pref = S.profile.baits || [];
  const chip = i => { const on = usable(stockOf(i.id, '-')); const key = i.std ? i.key : baitKey(i.name);
    return '<button type="button" class="bchip' + (on ? ' on' : '') + '" data-bait="' + esc(i.id) + '" aria-pressed="' + on + '">' + esc(i.name) + (pref.includes(key) ? ' <small>★</small>' : '') + '</button>' +
      (i.std || i.src === 'paket' ? '' : '<button type="button" class="linkbtn" data-edititem="' + esc(i.id) + '" aria-label="' + esc(i.name) + ' düzenle">✎</button>'); };
  const nOn = baits.filter(i => usable(stockOf(i.id, '-'))).length;
  return '<p class="note">Yemde adet yok. Varsayılan “yok”: avdan önce aldığın yeme dokun, “var” olsun. Rigler yemden bağımsızdır; öneri elindeki uygun yemi yazar, yoksa “gitmeden al” der.' + (pref.length ? ' ★ Rig Atölyesi’nde seçtiğin yemler.' : '') + '</p>' +
    '<div class="row"><span class="chip ' + (nOn ? 'A' : '') + '">' + nOn + ' yem var</span>' + (nOn ? '<button class="btn small" type="button" data-act="baitReset">Avdan döndüm: hepsini “yok” yap</button>' : '') + '</div>' +
    Object.keys(BAIT_GRP).map(g => { const list = baits.filter(i => grpOf(i) === g).sort((a, b) => trCmp(a.name, b.name)); return list.length ? '<div class="eyebrow">' + esc(BAIT_GRP[g]) + '</div><div class="bchips">' + list.map(chip).join('') + '</div>' : ''; }).join('') +
    '<p class="note">Listede olmayan bir yem için “+ Kalem ekle” → Kategori: Yem.</p>';
}
function cycleStatus(k){
  const [id, sz] = k.split('|'); const st = stockOf(id, sz);
  const next = usable(st) ? 'bitti' : toBuy(st) ? 'yok' : 'var';   // elindeyken dokun: bitti (alınacak); tekrar: yok; tekrar: var
  if (next === 'yok') delete S.inv.qty[k];
  setStatus(k, next);
}
function itemForm(id, cat0){
  const it = id ? S.inv.items[id] : null; const c = it || {cat: cat0 || (ui.inv === 'line' ? 'fc' : ui.inv === 'gear' ? 'rod' : (INV_CATS[ui.inv] || ['hook'])[0])};
  ui.sheet = 'item'; ui.sheetArg = id || null;
  const cats = Object.keys(CAT_TXT).map(k => '<option value="' + k + '"' + (c.cat === k ? ' selected' : '') + '>' + CAT_TXT[k] + '</option>').join('');
  const pats = '<option value="">—</option>' + HOOK_PATTERNS.map(p => '<option' + (c.pattern === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
  const st0 = it ? (it.sizes && it.sizes.length ? 'var' : stockOf(it.id, '-')) : (c.cat === 'bait' ? 'yok' : 'var');
  const r = c.rod || {}, m = c.reel || {};
  const opt = (list, cur) => list.map(([v, t]) => '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
  openSheet(sheetBar(it ? 'Kalemi düzenle' : 'Yeni kalem', '<button class="btn primary" type="button" id="itSave">Kaydet</button>') +
    '<div class="stack">' + (it ? '' : '<label class="f">Katalogda ara<input id="it-search" type="search" placeholder="Ör. chinu, Seaguar, egi, kurşun" autocomplete="off"></label><div class="catres" id="itCat"></div>') +
    '<div class="fields">' +
    '<label class="f wide">Kategori<select id="it-cat">' + cats + '</select></label>' +
    '<label class="f">Marka<input id="it-brand" value="' + esc(c.brand || '') + '" placeholder="Ör. Owner"></label>' +
    '<label class="f">Model / ad<input id="it-model" value="' + esc(c.model || '') + '" placeholder="Ör. SSW 5111"></label>' +
    '<label class="f wide" id="it-patw"' + (c.cat === 'hook' ? '' : ' hidden') + '>İğne tipi<select id="it-pat">' + pats + '</select></label>' +
    '<div class="fields wide" id="it-rodw"' + (c.cat === 'rod' ? '' : ' hidden') + '><label class="f wide">Kamış tipi<select id="it-rodt">' + opt(ROD_T, r.type || 'tekne') + '</select></label>' +
      '<label class="f">Boy (m)<input id="it-rodl" inputmode="decimal" value="' + esc(r.len ? fmtNum(r.len, 2) : '') + '" placeholder="Ör. 2,10"></label>' +
      '<label class="f">En fazla (g)<input id="it-rodm" inputmode="numeric" value="' + esc(r.max || '') + '" placeholder="Ör. 150"></label>' +
      '<label class="f">PE<input id="it-rodp" inputmode="decimal" value="' + esc(r.pe ? fmtNum(r.pe, 1) : '') + '" placeholder="Ör. 2"></label></div>' +
    '<div class="fields wide" id="it-reelw"' + (c.cat === 'reel' ? '' : ' hidden') + '><label class="f wide">Makine tipi<select id="it-reelt">' + opt(REEL_T, m.type || 'spin') + '</select></label>' +
      '<label class="f">Boy<input id="it-reels" inputmode="numeric" value="' + esc(m.size || '') + '" placeholder="Ör. 4000"></label></div>' +
    '<label class="f wide">Özellik<input id="it-spec" value="' + esc(c.spec || '') + '" placeholder="Ör. 0,26 mm · PE 1,5 · 120 g · siyah nikel"></label>' +
    '<label class="f wide" id="it-sizew"' + (['rod', 'reel', 'bait', 'braid', 'fc', 'mono'].includes(c.cat) ? ' hidden' : '') + '>Boylar (virgülle; tek boyluysa boş bırak)<input id="it-sizes" value="' + esc((c.sizes || []).join(', ')) + '" placeholder="Ör. No:1, No:2  ya da  2/0, 3/0  ya da  80 g, 100 g"></label>' +
    '<label class="f wide">Not<input id="it-note" value="' + esc(c.note || '') + '" placeholder="Ör. mercan için"></label>' +
    '</div><div class="stack"><span class="eyebrow">Durum' + (it && (it.sizes || []).length ? ' (bütün boylar; boy boy işaretlemek için boş geç)' : '') + '</span><div class="seg" id="it-st" data-st0="' + (it ? (usable(st0) ? 'var' : toBuy(st0) ? 'alinacak' : 'yok') : '') + '">' + [['var', 'Var'], ['alinacak', 'Alınacak (henüz yok)'], ['yok', 'Yok']].map(([v, t]) => '<button class="btn small" type="button" data-itst="' + v + '" aria-pressed="' + ((usable(st0) ? 'var' : toBuy(st0) ? 'alinacak' : 'yok') === v) + '">' + t + '</button>').join('') + '</div></div>' +
    '<p class="err" id="itErr" hidden></p>' +
    (it ? '<button class="btn" type="button" id="itDel" data-delitem="' + esc(it.id) + '" style="color:var(--D)">Kalemi sil</button>' : '') + '</div>');
}
function itemFormCat(cat){
  $('it-patw').hidden = cat !== 'hook'; $('it-rodw').hidden = cat !== 'rod'; $('it-reelw').hidden = cat !== 'reel';
  $('it-sizew').hidden = ['rod', 'reel', 'bait', 'braid', 'fc', 'mono'].includes(cat);
}
function saveItem(){
  const g = k => $(k).value.trim();
  const brand = g('it-brand'), model = g('it-model');
  if (!brand && !model) { $('itErr').textContent = 'Marka ya da ad yaz.'; $('itErr').hidden = false; return; }
  const cat = $('it-cat').value;
  const sizes = $('it-sizew').hidden ? [] : g('it-sizes').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const id = ui.sheetArg || ('u-' + (slugTR(brand + '-' + model).slice(0, 40) || 'kalem') + '-' + Math.random().toString(36).slice(2, 6));
  const old = S.inv.items[id];
  const stB = document.querySelector('#it-st button[aria-pressed="true"]'); const st = stB ? stB.dataset.itst : 'var';
  const it = {id, cat, brand, model, name: [brand, model].filter(Boolean).join(' '), pattern: cat === 'hook' ? $('it-pat').value : '', spec: g('it-spec'), note: g('it-note'),
    sizes, stock: Object.fromEntries((sizes.length ? sizes : ['-']).map(s => [s, st === 'yok' ? 'yok' : st])), src: 'kullanici', created: old ? old.created : new Date().toISOString()};
  if (cat === 'rod') it.rod = {type: $('it-rodt').value, len: num(g('it-rodl')), max: num(g('it-rodm')), pe: num(g('it-rodp'))};
  if (cat === 'reel') it.reel = {type: $('it-reelt').value, size: num(g('it-reels'))};
  S.inv.items[id] = it;
  // düzenlemede durum seçimi değiştiyse eski işaretler (adetler dahil) yeni seçime uyar; değişmediyse boy boy işaretler korunur
  const st0 = $('it-st').dataset.st0; const changed = !old || st !== st0;
  (sizes.length ? sizes : ['-']).forEach(sz => { const k = id + '|' + sz;
    if (old && changed) { delete S.inv.qty[k]; delete S.inv.status[k]; }
    if (changed && cat === 'bait' && st === 'var') S.inv.status[k] = 'var'; });
  persist(); indexAll(); closeSheet(); ui.inv = INV_SEG.find(([k]) => INV_CATS[k].includes(cat))[0]; renderAll(); toast('Kalem kaydedildi');
}
function deleteItem(id){
  delete S.inv.items[id]; delete S.inv.unit[id];
  Object.keys(S.inv.qty).forEach(k => { if (k.split('|')[0] === id) delete S.inv.qty[k]; });
  Object.keys(S.inv.status).forEach(k => { if (k.split('|')[0] === id) delete S.inv.status[k]; });
  persist(); indexAll(); closeSheet(); renderAll(); toast('Kalem silindi');
}
function catalogSearch(q){
  q = trLower(q.trim()); const el = $('itCat'); if (!el) return;
  if (q.length < 2) { el.innerHTML = ''; return; }
  const res = CATALOG.filter(c => trLower(c.name + ' ' + (CAT_TXT[c.cat] || '') + ' ' + c.pattern).indexOf(q) >= 0).slice(0, 10);
  el.innerHTML = res.map((c, i) => '<button type="button" class="catpick" data-catpick="' + CATALOG.indexOf(c) + '"><b>' + esc(c.name) + '</b><small>' + esc((CAT_TXT[c.cat] || c.cat) + (c.pattern ? ' · ' + c.pattern : '')) + '</small></button>').join('') || '<p class="note">Katalogda yok; aşağıya elle yazabilirsin.</p>';
}
function catalogPick(i){
  const c = CATALOG[i]; if (!c) return;
  $('it-cat').value = c.cat; $('it-brand').value = c.brand; $('it-model').value = c.model;
  itemFormCat(c.cat); if (c.cat === 'hook') $('it-pat').value = c.pattern;
  const hint = {hook: 'Ör. No:1, No:2 ya da 2/0, 3/0', braid: 'Ör. 0,16 mm · PE 1', fc: 'Ör. 0,26 mm', mono: 'Ör. 0,30 mm', jig: 'Ör. 120 g', lure: 'Ör. 14 cm · 25 g', sinker: 'Ör. 100–150 g'}[c.cat];
  if (hint) $('it-spec').placeholder = hint;
  $('itCat').innerHTML = ''; $('it-search').value = '';
  ($('it-spec').value || $('it-sizew').hidden ? $('it-note') : $('it-spec')).focus();
}
// alışveriş listesinden: listede kalemi olmayan ürünü envantere ekle (rigler hemen tamamlanır)
function buyAdd(key){
  const n = shoppingList().find(x => x.k === key); if (!n || !n.sp) return;
  const sp = n.sp; const nm = String(n.name || 'Kalem');
  const parts = nm.indexOf('/') >= 0 ? ['', nm] : [nm.split(' ')[0], nm.split(' ').slice(1).join(' ')];
  let cat = 'hook', pattern = '', sizes = [], spec = '', extra = {};
  if (sp.kind === 'hook') { pattern = KB.PAT[sp.p[0]] ? KB.PAT[sp.p[0]].name : ''; sizes = n.size ? [n.size] : []; }
  else if (sp.kind === 'line') { cat = sp.cats[0]; spec = n.size || ''; }
  else if (sp.kind === 'rod') { cat = 'rod'; spec = n.size || ''; extra.rod = {type: sp.types[0], len: null, max: CLS_REP.rod[sp.cls[0]] || null, pe: null}; }
  else if (sp.kind === 'reel') { cat = 'reel'; spec = n.size || ''; extra.reel = {type: sp.types[0], size: CLS_REP.reel[sp.cls[0]] || null}; }
  else if (sp.kind === 'term') { const k = sp.tts[0]; cat = k.indexOf('k-') === 0 ? 'sinker' : 'terminal'; spec = n.size || ''; }
  else { cat = /jig|egi|inchiku|rubber|çapari|zoka/i.test(nm) ? 'jig' : 'lure'; spec = n.size || ''; }
  if (['rod', 'reel', 'term'].includes(sp.kind)) { parts[0] = ''; parts[1] = nm; }
  const id = 'u-' + (slugTR(nm).slice(0, 40) || 'kalem') + '-' + Math.random().toString(36).slice(2, 6);
  S.inv.items[id] = Object.assign({id, cat, brand: parts[0], model: parts[1], name: nm, pattern, spec, note: 'Alışveriş listesinden', sizes, stock: Object.fromEntries((sizes.length ? sizes : ['-']).map(s => [s, 'var'])), src: 'kullanici', created: new Date().toISOString()}, extra);
  if (S.shopX) delete S.shopX[key];
  persist(); indexAll(); renderAll(); openMore('alisveris', true); toast(nm + ' envantere eklendi');
}
