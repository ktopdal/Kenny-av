// ---------------------------------------------------------------- 74b · açılır kart (v0.29.4)
// Açık sayfanın (sheet) üstünde küçük kart: üstte X; kapanınca alttaki sayfa olduğu yerde kalır ve tazelenir.
// İlk kullanım: Rig Atölyesinde seçili noktanın kartı (derinlik, dip, avlanma şekli) — geri dönüp baştan girmek gerekmesin.
let MODAL = null;   // {kind, arg, onClose}
function openModal(html, st){
  const m = $('modal'); if (!m) return;
  MODAL = Object.assign({}, st || {});
  m.innerHTML = '<div class="mcard">' + html + '</div>'; m.hidden = false;
}
function closeModal(silent){
  const m = $('modal'); if (!m || m.hidden) return;
  const st = MODAL; MODAL = null; m.hidden = true; m.innerHTML = '';
  if (!silent && st && st.onClose) st.onClose();
}
// ---- konum kartı: avlanma şekli (karadan / denizden), derinlik ve dip; eksikse EMODnet ve EUSeaMap'ten kendiliğinden yazılır
const AVK = [['deniz', 'Denizden av', 'tekneyle', 'boat'], ['kiyi', 'Karadan av', 'kıyıdan, ayağın karada', 'shore'], ['kara', 'Yalnız hava', 'balık ve rig yok', 'cloud']];
// izin verilmeyen seçimin acemiye anlaşılır nedeni (kıyı/deniz terimi yerine "karadan / tekneyle")
function avkWhy(L, ok){
  const b = kindBase(L); if (!b) return '';
  if (b === 'kiyi') return 'Nokta kıyıda: buradan tekneyle (denizden) avlanılmaz.';
  if (b === 'deniz') return ok.includes('kiyi') ? '' : 'Nokta denizde ve kıyıdan uzak: buradan karadan avlanılmaz.';
  return ok.includes('kiyi') ? 'Nokta karada: buradan tekneyle avlanılmaz.' : 'Nokta karada ve denizden uzak: yalnız hava durumu gösterilir.';
}
function avkTiles(kinds, cur, ok, attr){
  return '<div class="avk">' + AVK.filter(([v]) => kinds.includes(v)).map(([v, t, s2, i]) => '<button type="button" class="opt hasic" ' + attr + '="' + v + '" aria-pressed="' + (cur === v) + '"' + (ok.includes(v) ? '' : ' aria-disabled="true"') + '>' +
    ic(i) + '<span class="opt-t"><b>' + t + '</b><small>' + s2 + '</small></span></button>').join('') + '</div>';
}
function locModalHtml(id){
  const L = S.locations[id]; if (!L) return '';
  const k = locKind(L), ok = kindAllowed(L), busy = MODAL && MODAL.busy || {};
  const kSel = k === 'deniz' && L.id === S.active && S.mode === 'kiyi' ? 'kiyi' : k;   // sihirbaz ve üstteki tekne/kıyı ile aynı
  const kinds = ['deniz', 'kiyi'].concat(ok.includes('kara') || k === 'kara' ? ['kara'] : []);
  const why = avkWhy(L, ok) ? '<p class="avk-note">' + esc(avkWhy(L, ok)) + '</p>' : '';
  const bot = WZ_BOT.concat([['', 'Bilmiyorum', 'info']]);
  return '<div class="mtop">' + ic('pin', 'coral') + '<h3 id="modalTitle">' + esc(locLabel(L)) + '</h3><button class="x" type="button" data-mclose aria-label="Kapat">×</button></div>' +
    '<div class="sp mono">' + esc(fmtCoord(L.lat, L.lon, true)) + '</div>' +
    '<div class="msec"><b>' + ic('compass', null, 'sm') + 'Nereden avlanacaksın?</b>' + avkTiles(kinds, kSel, ok, 'data-mlkind') + why + '</div>' +
    (k === 'kara' ? '<p class="note">Kara noktası: yalnız hava durumu gösterilir.</p>' :
      '<div class="msec"><b>' + ic('depth', null, 'sm') + 'Derinlik</b><div class="depthrow"><input data-lk="' + esc(L.id) + '" data-f="depth" inputmode="decimal" value="' + esc(L.depth || '') + '" placeholder="—" aria-label="Derinlik (m)"><span>m</span>' +
        (busy.depth ? '<span class="waitline"><span class="spin"></span>Bekleyiniz…</span>' : L.depth && L.depthAuto ? '<span class="autotag">EMODnet, tahmini</span>' : '') + '</div></div>' +
      '<div class="msec"><b>' + ic('karma', null, 'sm') + 'Dip</b><div class="opts tiles">' + bot.map(([v, t, i]) => '<button type="button" class="opt hasic" data-mlbot="' + esc(L.id + '|' + v) + '" aria-pressed="' + ((L.bottom || '') === v) + '">' + ic(i) + '<span class="opt-t"><b>' + t + '</b></span></button>').join('') + '</div>' +
        (busy.bed ? '<span class="waitline"><span class="spin"></span>Dip bulunuyor, bekleyiniz…</span>' : L.bottom && L.bottomAuto ? '<p class="note">Dip haritadan (EUSeaMap) tahmin edildi' + (L.bottomEstTxt ? ': ' + esc(L.bottomEstTxt) : '') + '. Biliyorsan değiştir.</p>' : '') + '</div>') +
    '<div class="row"><button class="btn primary" type="button" data-mclose>Tamam</button></div>';
}
function openLocModal(id, onClose){
  const L = S.locations[id]; if (!L) return;
  openModal(locModalHtml(id), {kind: 'loc', arg: id, onClose, busy: {}});
  locAutoFill(id);
}
function renderLocModal(){
  if (!MODAL || MODAL.kind !== 'loc') return; const m = $('modal'); const c = m && m.querySelector('.mcard'); if (!c || !S.locations[MODAL.arg]) return;
  // yazılırken yenilenirse (ör. derinlik servisi o an yanıt verdi) yazılan kaybolmasın
  const a = document.activeElement, typing = a && c.contains(a) && a.tagName === 'INPUT' && a.value !== '' ? {f: a.dataset.f, v: a.value, s: a.selectionStart} : null;
  c.innerHTML = locModalHtml(MODAL.arg);
  if (typing) { const i = c.querySelector('input[data-f="' + typing.f + '"]'); if (i) { i.value = typing.v; i.focus({preventScroll: true}); try { i.setSelectionRange(typing.s, typing.s); } catch (e) {} } }
}
// eksik derinlik ve dip sormadan yazılır (tahmini işaretiyle; kullanıcı değiştirince işaret kalkar)
async function locAutoFill(id){
  const L = S.locations[id]; if (!L || locKind(L) === 'kara') return;
  const st = MODAL && MODAL.kind === 'loc' && MODAL.arg === id ? MODAL : null;
  const jobs = [];
  if (!L.depth) { if (st) st.busy.depth = true; jobs.push(depthAt(L.lat, L.lon).then(d => { if (d != null && d > 0.5 && !L.depth) { L.depth = String(Math.round(d)); L.depthAuto = true; } else if (!L.depth) L.depthTried = Date.now(); }, () => {}).then(() => { if (st) st.busy.depth = false; })); }
  if (!L.bottom && !L.bottomNo) { if (st) st.busy.bed = true; jobs.push(seabedAt(L.lat, L.lon).then(bed => { if (bed && bed.bottom && !L.bottom) { setBedEst(L, bed); L.bottom = bed.bottom; L.bottomAuto = true; } else if (!L.bottom) L.bottomTried = Date.now(); }, () => { if (!L.bottom) L.bottomTried = Date.now(); }).then(() => { if (st) st.busy.bed = false; })); }
  if (!jobs.length) return;
  renderLocModal();
  await Promise.all(jobs);
  if (!S.locations[id]) return;
  persist(); renderLocModal();
}
function locModalAct(d, b){
  const id = MODAL && MODAL.arg, L = id && S.locations[id]; if (!L) return;
  if (d.mlkind) {
    if (b.getAttribute('aria-disabled') === 'true') { toast(avkWhy(L, kindAllowed(L)) || 'Bu ' + kindRuleTxt(L) + '.'); return; }
    const viaMode = id === S.active && locKind(L) === 'deniz' && d.mlkind === 'kiyi';   // seçili deniz noktasında karadan: nokta deniz kalır, kıyı modu açılır
    if (locKind(L) !== d.mlkind && !viaMode) setLocKind(id, d.mlkind);
    if (id === S.active && d.mlkind !== 'kara' && S.mode !== (d.mlkind === 'kiyi' ? 'kiyi' : 'tekne')) { S.mode = d.mlkind === 'kiyi' ? 'kiyi' : 'tekne'; persist(); renderAll(); }
    renderLocModal(); if (locKind(L) !== 'kara') locAutoFill(id); return;
  }
  if (d.mlbot) { const v = d.mlbot.split('|')[1]; L.bottom = v; delete L.bottomAuto; if (v) delete L.bottomNo; else L.bottomNo = true; persist(); indexAll(); renderAll(); renderLocModal(); toast('Dip: ' + BOTTOM_TXT[v]); }
}
