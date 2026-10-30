// ---------------------------------------------------------------- 55 · rig parçası sayfası (v0.23)
// Rig kartında iğne / ip / kamış satırına dokununca açılır: envanterdeki durumu (var/yok, adet), bu parçanın kaç rigde kullanıldığı,
// elindeki uyumlu yedekler ("bu rigde kullan" / "bu parçayı kullanan bütün riglerde kullan"), bulunamazsa yerine alınabilecek ürünler.
// Değişim S.rigOv["rigId|yuva"] = {item, size} olarak saklanır (22-rigs.js allRigs uygular; senkronla öteki cihaza da gider).
function partSlot(rid, k){ const rg = RIGS[rid]; return rg ? {rg, sl: rg.slots.find(s => s.k === k)} : {}; }
// bu kalemi (aynı boy) kullanan rigler
function partUsers(item, size){
  if (!item) return [];
  return RIG_LIST.filter(r => r.slots.some(s => { const e = s.t.envanter || {}; return e.item === item && (!size || !e.size || e.size === size); }));
}
// yerine alınabilecekler (katalog): iğnede aynı/uyumlu desen aynı boy, ipte aynı tür aynı çap
function partBuyAlts(sl){
  const nd = slotNeed(sl); if (!nd) return [];
  const cur = nd.e.item && ITEMS[nd.e.item] ? trLower(ITEMS[nd.e.item].name) : '';
  if (nd.hook) {
    const size = nd.e.size || hookFmt(nd.h0.sc, nd.h0.v);
    return CATALOG.filter(c => c.cat === 'hook' && c.pattern).map(c => ({c, p: Object.keys(KB.PAT).find(p => KB.PAT[p].name === c.pattern)}))
      .filter(x => x.p && patCompat(x.p, nd.p0) && trLower(x.c.name) !== cur && cur.indexOf(trLower(x.c.model)) < 0)
      .sort((a, b) => (a.p === nd.p0 ? 0 : 1) - (b.p === nd.p0 ? 0 : 1)).slice(0, 4)
      .map(x => ({name: x.c.name, size, same: x.p === nd.p0, sp: {kind: 'hook', p: [x.p], sc: nd.h0.sc, lo: nd.h0.v, hi: nd.h0.v}}));
  }
  const mm = Math.round(nd.mm0 * 1000) / 1000;
  return CATALOG.filter(c => nd.cats.includes(c.cat) && cur.indexOf(trLower(c.model)) < 0).sort((a, b) => nd.cats.indexOf(a.cat) - nd.cats.indexOf(b.cat)).slice(0, 4)
    .map(c => ({name: c.name, size: mmTxt(mm), cat: c.cat, sp: {kind: 'line', cats: [c.cat], lo: mm * 0.95, hi: mm * 1.05}}));
}
// v0.29.3 · istediğin parçayı seç: envanterdeki aynı türden bütün kalemler (iğnede bütün iğneler ve boyları, ipte bütün ipler,
// sahte yemde aynı tip yemler). Uyumlu olmasa da seçilebilir; rigin istediğinden farkı yanında yazar. Asıl rig ve paket değişmez:
// seçim S.rigOv'da bu rige (ya da aynı parçayı kullanan bütün riglere) yazılır, "Asıl parçaya dön" geri alır.
function partKind(sl){
  if (slotIsHook(sl) || sl.kind === 'assist' || sl.kind === 'jighead') return 'hook';
  if (slotIsLine(sl)) return 'line';
  if (sl.kind === 'lure' || (sl.sp && sl.sp.kind === 'lure')) return 'lure';
  return null;
}
const PART_PL = {hook: 'iğneler', line: 'ipler', lure: 'sahte yemler'}, PART_ONE = {hook: 'iğne', line: 'ip', lure: 'sahte yem'};
function partPickList(sl){
  const pk = partKind(sl); if (!pk) return [];
  const e = sl.t.envanter || {}, nd = slotNeed(sl), cur = (e.item || '') + '|' + (e.size || '-');
  const lt = pk === 'lure' ? (sl.sp && sl.sp.lt) || (e.item && ITEMS[e.item] ? lureTypeOf(ITEMS[e.item]) : null) : null, okT = lt ? (LURE_OK[lt] || [lt]) : null;
  const cats = pk === 'hook' ? (sl.kind === 'jighead' ? ['hook', 'jig'] : ['hook']) : pk === 'line' ? ['braid', 'fc', 'mono'] : okT ? ['jig', 'lure', 'hook', 'terminal'] : ['jig', 'lure'];
  const out = [];
  Object.values(ITEMS).forEach(it => {
    if (!cats.includes(it.cat) || (okT && !okT.includes(lureTypeOf(it)))) return;
    sizesOf(it).forEach(sz => {
      const v = it.id + '|' + sz; if (v === cur) return;
      const st = stockOf(it.id, sz), have = usable(st), diff = [];
      let sc = 0;   // rigin istediğine yakınlık: aynı desen ve boy önce
      if (pk === 'hook' && nd && nd.hook) {
        const p = patOf(it), h = hookIdx(sz), same = p === nd.p0, cp = !!p && patCompat(p, nd.p0);
        if (p && !same) diff.push(cp ? 'benzer desen' : 'farklı desen');
        if (h && h.sc === nd.h0.sc && h.v !== nd.h0.v) diff.push(Math.abs(h.v - nd.h0.v) + ' boy ' + (h.v > nd.h0.v ? 'büyük' : 'küçük'));
        sc = (same ? 0 : cp ? 2 : 6) + (h && h.sc === nd.h0.sc ? Math.abs(h.v - nd.h0.v) : 4);
      }
      if (pk === 'line' && nd && nd.line) {
        const mm = lineMm(it), d = mm ? (mm - nd.mm0) / nd.mm0 : 1;
        if (!nd.cats.includes(it.cat)) diff.push(trLower(CAT_TXT[it.cat] || it.cat));
        if (mm && Math.abs(d) >= 0.12) diff.push(d > 0 ? 'kalın' : 'ince');
        sc = Math.abs(d) * 10 + (nd.cats.includes(it.cat) ? 0 : 4);
      }
      out.push({v, have, sc, txt: it.name + (sz !== '-' ? ' ' + sz : '') + (diff.length ? ' (' + diff.join(', ') + ')' : '')});
    });
  });
  return out.sort((a, b) => (b.have - a.have) || (a.sc - b.sc) || trCmp(a.txt, b.txt));
}
function partPickHtml(rid, k, sl, same){
  const pk = partKind(sl); if (!pk) return '';
  const L = partPickList(sl), sel = ui.partSel && L.some(x => x.v === ui.partSel) ? ui.partSel : '';
  const nd = slotNeed(sl), newCat = pk === 'hook' ? 'hook' : pk === 'line' ? ((nd && nd.cats) || ['fc'])[0] : 'lure';
  const opt = x => '<option value="' + esc(x.v) + '"' + (x.v === sel ? ' selected' : '') + '>' + esc(x.txt) + '</option>';
  const yes = L.filter(x => x.have), no = L.filter(x => !x.have);
  const add = '<p class="note">Listede yoksa <button class="linkbtn" type="button" data-partnew="' + esc(rid + '|' + k + '|' + newCat) + '">envantere yeni ' + PART_ONE[pk] + ' ekle</button>; kaydedince buraya döner.</p>';
  if (!L.length) return '<p class="note">Envanterinde başka ' + PART_ONE[pk] + ' yok.</p>' + add;
  return '<p class="note">Envanterindeki bütün ' + PART_PL[pk] + '. Rigin istediğinden farklıysa yanında yazar; elinde olmayanı seçersen rig “eksik” görünür ve alışveriş listesine düşer.</p>' +
    '<select class="edsel partsel" id="partPick" aria-label="Başka ' + PART_ONE[pk] + ' seç"><option value="">— ' + PART_ONE[pk] + ' seç —</option>' +
    (yes.length ? '<optgroup label="Elinde">' + yes.map(opt).join('') + '</optgroup>' : '') + (no.length ? '<optgroup label="Elinde yok">' + no.map(opt).join('') + '</optgroup>' : '') + '</select>' +
    '<div class="row partbtns"><button class="btn small primary" type="button" data-partpick="' + esc('use|' + rid + '|' + k) + '">Bu rigde kullan</button>' +
    (same ? '<button class="btn small" type="button" data-partpick="' + esc('all|' + rid + '|' + k) + '">' + (same + 1) + ' rigde kullan</button>' : '') + '</div>' + add;
}
function openPart(rid, k, keep){
  const {rg, sl} = partSlot(rid, k); if (!rg || !sl) { toast('Parça bulunamadı'); return; }
  ui.sheet = 'parca'; ui.sheetArg = rid + '|' + k;
  const e = sl.t.envanter || {}, it = e.item && ITEMS[e.item], st = slotStock(sl);
  const tk = sl.t.turkiye || {};
  const need = sl.sp ? specTxt(sl.sp) : '';
  const users = partUsers(e.item, e.size);
  const cands = ['hook', 'hook+', 'line', 'braid', 'beden', 'kostek', 'sok', 'mono'].includes(sl.kind) || slotIsHook(sl) || slotIsLine(sl) ? subCands(sl, 6) : [];
  const buy = usable(st) ? [] : partBuyAlts(sl);
  const ov = (S.rigOv || {})[rid + '|' + k];
  const same = users.filter(r => r.id !== rid).length;
  const head = (rg.code ? rg.code + ' · ' : '') + rg.name;
  const sec = (t, body) => '<section class="set"><h4>' + t + '</h4>' + body + '</section>';
  openSheet(sheetBar(sl.label) + '<div class="stack">' +
    '<p class="sub">' + esc(head) + '</p>' +
    sec('Bu rigde', '<div class="crow"><span class="k">' + esc(sl.label) + '</span><span class="v">' + esc(it ? it.name : (e.name || tk.name || '—')) + (e.size ? ' <b>' + esc(e.size) + '</b>' : '') + '</span><span class="s"><span class="dot ' + st + '"></span>' + ST_TXT[st] + '</span></div>' +
      (need ? '<p class="note">Rigin istediği ölçü: ' + esc(need) + '</p>' : '') +
      (ov && sl.orig ? '<p class="note">Bu rig için değiştirdin; asıl parça: ' + esc((sl.orig.item && ITEMS[sl.orig.item] ? ITEMS[sl.orig.item].name : sl.orig.name || '—') + (sl.orig.size ? ' ' + sl.orig.size : '')) + '. <button class="linkbtn" type="button" data-partorig="' + esc(rid + '|' + k) + '">Asıl parçaya dön</button></p>' : '')) +
    (it ? sec('Envanterde', itemCard(it) + (it.src === 'paket' || it.std ? '<p class="note">' + (it.std ? 'Hazır listeden' : /*@ozel*/'Özel paketten'/*@end*//*@genel*/'Paketten'/*@end*/) + ' gelen kalem: silinmez; “Yok” yapabilirsin.</p>' : '') +
      (users.length ? '<p class="note">Bu parça ' + users.length + ' rigde: ' + esc(users.slice(0, 12).map(r => r.code || r.name).join(', ')) + (users.length > 12 ? '…' : '') + '</p>' : '')) : '') +
    (!cands.length && partKind(sl) && !slotNeed(sl) ? '' : sec('Elindeki yedekler', cands.length ? '<p class="note">Envanterinde var olan uyumlu parçalar' + (slotIsHook(sl) ? ' (aynı ya da benzer desen, en çok bir boy fark)' : ' (aynı tür, çap ±%12)') + '.</p>' +
      cands.map(c => '<div class="altrow"><span class="v">' + esc(c.txt) + '</span><span class="row"><button class="btn small" type="button" data-partuse="' + esc(rid + '|' + k + '|' + c.item + '|' + c.size) + '">Bu rigde kullan</button>' +
        (same ? '<button class="btn small" type="button" data-partall="' + esc(rid + '|' + k + '|' + c.item + '|' + c.size) + '">' + (same + 1) + ' rigde kullan</button>' : '') + '</span></div>').join('')
      : '<p class="note">' + (slotNeed(sl) ? 'Envanterinde buna uyan başka bir parça yok.' : 'Bu parça için yedek aranmaz (kamış, makine, fırdöndü ve kurşun elindekidir).') + '</p>')) +
    (partKind(sl) ? sec('Başka ' + PART_ONE[partKind(sl)] + ' seç', partPickHtml(rid, k, sl, same)) : '') +
    (buy.length ? sec('Bulamazsan yerine alınabilecekler', '<p class="note">Aynı iş görür; mağazada stok yoksa bunlardan birini al. Listeye eklersen aldığında “Aldım, envantere ekle” der.</p>' +
      buy.map((b, i) => '<div class="altrow"><span class="v">' + esc(b.name) + ' <b>' + esc(b.size) + '</b>' + (b.same === false ? ' <small>(benzer desen)</small>' : '') + '</span><button class="btn small" type="button" data-partbuy="' + esc(rid + '|' + k + '|' + i) + '">Listeye ekle</button></div>').join('')) : '') +
    (tk.name && !tk.item && trLower(tk.name) !== trLower(it ? it.name : '') ? '<p class="note">Türkiye’de bulunur: ' + esc(tk.name + (tk.size ? ' ' + tk.size : '')) + (tk.store ? ' · mağaza ' + esc(tk.store) : '') + '</p>' : '') +
    '</div>', keep);
  ui.partSel = null;
}
function specTxt(sp){
  if (sp.kind === 'hook' && sp.sc) return (sp.p || []).map(p => KB.PAT[p] ? KB.PAT[p].name : p).join(' / ') + ' ' + (sp.lo === sp.hi ? hookFmt(sp.sc, sp.lo) : hookFmt(sp.sc, sp.lo) + '–' + hookFmt(sp.sc, sp.hi));
  if (sp.kind === 'line' && sp.lo) return (sp.cats || []).map(c => CAT_TXT[c] || c).join(' / ') + ' ' + mmTxt(sp.lo) + '–' + mmTxt(sp.hi);
  return '';
}
function partAct(kind, val){
  const [rid, k, item, size] = val.split('|');
  S.rigOv = S.rigOv || {};
  if (kind === 'use' || kind === 'all') {
    const {sl} = partSlot(rid, k); const e = sl && sl.t.envanter || {};
    const list = kind === 'all' ? partUsers(e.item, e.size) : [RIGS[rid]];
    let n = 0;
    list.forEach(r => r.slots.forEach(s => { const x = s.t.envanter || {}; if ((r.id === rid && s.k === k) || (kind === 'all' && e.item && x.item === e.item && (!e.size || !x.size || x.size === e.size))) { S.rigOv[r.id + '|' + s.k] = {item, size}; n++; } }));
    invChanged(); openPart(rid, k, true); toast(n > 1 ? n + ' rigde değiştirildi' : 'Bu rigde değiştirildi'); return;
  }
  if (kind === 'orig') { delete S.rigOv[rid + '|' + k]; invChanged(); openPart(rid, k, true); toast('Asıl parçaya dönüldü'); return; }
  if (kind === 'buy') {
    const {rg, sl} = partSlot(rid, k); const b = partBuyAlts(sl)[+item]; if (!b) return;
    S.shopX = S.shopX || {};
    const key = 'alt:' + slugTR(b.name + '-' + b.size);
    S.shopX[key] = {k: key, item: null, size: b.size, name: b.name, store: null, kind: b.sp.kind, sp: b.sp, for: [(rg.code || rg.name) + ' yedeği'], added: new Date().toISOString()};
    persist(); renderAll(); toast('Alışveriş listesine eklendi');
  }
}
// ---- envanter değişince rigler: ne değişti? (hazır oldu / eksik kaldı / parça değişti)
const LSR = 'alyssa-rsnap';
let RSNAP = null;   // son görülen rig durumu (envanter değişikliğini karşılaştırmak için)
function rigSnap(){ const o = {}; RIG_LIST.forEach(r => { o[r.id] = {r: ready(r) ? 2 : subFor(r) ? 1 : 0, s: r.slots.map(s => { const e = s.t.envanter || {}; return (e.item || '') + ':' + (e.size || ''); }).join(',')}; }); return o; }
function rigDiff(a, b){
  const up = [], down = [], sw = [];
  Object.keys(b).forEach(id => { const x = a[id], y = b[id]; if (!x) return; const nm = (RIGS[id] && (RIGS[id].code || RIGS[id].name)) || id;
    if (x.r !== y.r) (y.r > x.r ? up : down).push(nm + (y.r === 1 ? ' (yedekle hazır)' : '')); else if (x.s !== y.s) sw.push(nm); });
  return {up, down, sw, n: up.length + down.length + sw.length};
}
// indexAll'dan sonra çağrılır: önceki görülen duruma göre ne değişti (panel + kısa bildirim)
function noteRigChanges(quiet){
  const b = rigSnap(), a = RSNAP; RSNAP = b; lsSet(LSR, JSON.stringify(b));
  if (!a) return null;
  const d = rigDiff(a, b); if (!d.n) return d;
  ui.rigCh = d; if (!quiet && (d.up.length || d.down.length)) toast('Rigler güncellendi: ' + rigDiffTxt(d));
  return d;
}
const rigDiffTxt = d => [d.up.length ? d.up.length + ' rig hazır oldu' : '', d.down.length ? d.down.length + ' rig eksik kaldı' : '', d.sw.length ? d.sw.length + ' rigde parça değişti' : ''].filter(Boolean).join(', ');
function rigChangesHtml(){
  const d = ui.rigCh; if (!d || !d.n) return '';
  const L = (t, a) => a.length ? '<div><b>' + t + ':</b> ' + esc(a.slice(0, 16).join(', ')) + (a.length > 16 ? '…' : '') + '</div>' : '';
  return '<div class="panel rigch"><div class="row" style="justify-content:space-between"><b>Rigler envantere göre güncellendi</b><button class="linkbtn" type="button" data-act="rigChClose">Kapat</button></div>' +
    L('Hazır oldu', d.up) + L('Eksik kaldı', d.down) + L('Parçası değişti', d.sw) + '</div>';
}
// "Rigleri envantere göre güncelle": son güncellemeden (ya da son basıştan) bu yana ne değiştiyse gösterir
function rigRefresh(){
  let prev = null; try { prev = JSON.parse(lsGet(LSR) || 'null'); } catch (e) {}
  indexAll(); const now = rigSnap(); lsSet(LSR, JSON.stringify(now)); RSNAP = now;
  const d = prev ? rigDiff(prev, now) : {up: [], down: [], sw: [], n: 0};
  ui.rigCh = d.n ? d : null; renderAll();
  const nR = RIG_LIST.filter(ready).length, nS = RIG_LIST.filter(r => !ready(r) && subFor(r)).length;
  toast(RIG_LIST.length + ' rig: ' + nR + ' hazır' + (nS ? ', ' + nS + ' yedekle hazır' : '') + ', ' + (RIG_LIST.length - nR - nS) + ' eksik' + (d.n ? ' · ' + rigDiffTxt(d) : ' · değişiklik yok'));
}
