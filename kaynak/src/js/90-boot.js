// ---------------------------------------------------------------- 90 · gezinme, olaylar, açılış
function nowHour(){ const ds = days(); const dd = ds.find(d => d.key === dateKey(new Date())) || ds[0]; return dd ? refHour(dd) : null; }
function renderTop(){
  const L = loc();
  $('locName').textContent = L ? locLabel(L) : APP_SHORT;
  const kind = locKind(L);
  $('locSub').textContent = L ? fmtCoord(L.lat, L.lon) + ' · ' + (kind === 'kara' ? 'kara · yalnız hava durumu' : kind === 'kiyi' ? 'kıyı' + (facingOf(L) != null ? ' · bakış ' + dir8(facingOf(L)) : '') : 'dip: ' + (BOTTOM_TXT[L.bottom || ''] || 'bilinmiyor')) : 'Konum seçilmedi';
  // Tekne/Kıyı düğmesi: karada yok; kıyı türündeki konumda hep Kıyı (değiştirmek için konumun türü değişir)
  const mb = $('modeBtn'); const sh = modeNow() === 'kiyi';
  mb.hidden = kind === 'kara'; mb.classList.toggle('fixed', kind === 'kiyi');
  mb.innerHTML = sh ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20h18" stroke-width="1.8"/><path d="M6 20l3-9 3 1" stroke-width="1.6"/><path d="M12 12l7-9" stroke-width="1.4"/><path d="M19 3c.5 4 .4 7-1 10" stroke-width="1" stroke-dasharray="1.5 1.5"/><circle cx="9" cy="8" r="1.6"/></svg><span>Kıyı</span>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15h18l-3 5H6z" stroke-width="1.6"/><path d="M12 3v12M12 4l6 9h-6" stroke-width="1.6"/><path d="M2 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1" stroke-width="1"/></svg><span>Tekne</span>';
  mb.setAttribute('aria-label', kind === 'kiyi' ? 'Kıyı noktası; türü Konumlar’dan değiştirilir' : (sh ? 'Kıyı' : 'Tekne') + ' modu; değiştirmek için dokun');
  const x = L ? nowHour() : null; const c = $('compass');
  c.hidden = !x; c.innerHTML = x ? compassHtml(x) : '';
}
function renderAll(){
  if (!S) return;
  const a = document.activeElement;
  if (a && ((a.tagName === 'INPUT' && !['file', 'search', 'checkbox', 'color'].includes(a.type)) || a.tagName === 'TEXTAREA') && !$('sheet').contains(a) && !$('welcome').contains(a)) { a.addEventListener('blur', () => setTimeout(renderAll, 300), {once: true}); return; }   // gecikme: odaktan çıkaran dokunuş (ör. −/+ düğmesi) önce kendi işini yapsın
  DAYS_CACHE = null;
  renderTop(); renderNewVersion(); renderToday(); renderFishing(); renderCalendar(); renderCatches(); renderRigs(); renderInventory(); renderMore();
}
const VIEWS = ['bugun', 'takvim', 'avlar', 'fishing', 'rigler', 'envanter', 'daha'];
function show(v){
  document.querySelectorAll('section.view').forEach(s => { s.hidden = s.id !== 'v-' + v; });
  $('main').classList.toggle('wide', v === 'takvim');   // v0.27: takvim tablette geniş
  if (v === 'takvim' && CAL_DIRTY) renderCalendar();
  document.querySelectorAll('.tabbar button').forEach(b => b.setAttribute('aria-current', b.dataset.v === v ? 'page' : 'false'));
  window.scrollTo({top: 0});
  try { history.replaceState(history.state, '', '#' + v); } catch (e) {}
}
// envanter değişince rigler yeniden çözülür (yuvaya en uygun kalem değişmiş olabilir)
function invChanged(){
  persist(); indexAll(); noteRigChanges();
  renderAll(); if (ui.sheet === 'parca' && ui.sheetArg) { const [r, k] = ui.sheetArg.split('|'); openPart(r, k, true); }
  else if (ui.sheet === 'gear' && ui.sheetArg) openGear(ui.sheetArg, true);
  else if (ui.sheet === 'rig' && ui.sheetArg) openRigSheet(ui.sheetArg, true);
  else if (ui.sheet === 'prep' && ui.sheetArg) openPrep(ui.sheetArg, true);
}
// rig sayfasından (Fishing'deki diğer rigler) parça/kamış sayfasına geçilince "Geri" rig sayfasına döner
function backTo(){
  const a = ui.sheetArg;
  if (ui.sheet === 'rig' && a) ui.back = () => openRigSheet(a, true);
  else if (ui.sheet === 'prep' && a) { const pb = ui.back; ui.back = () => { ui.back = pb; openPrep(a, true); }; }
  else if (ui.sheet !== 'parca' && ui.sheet !== 'gear' && ui.sheet !== 'knot') ui.back = null;
}
// düğüm: rig hazırlama sayfasından açılınca o rigde nerede kullanıldığı ve "Geri" hazırlamaya döner
function knotFrom(k, where){
  if (ui.sheet === 'prep' && ui.sheetArg) { const a = ui.sheetArg; if (!where) { const c = prepCtx(a); where = c ? c.sc.knots.filter(x => x.k === k).map(x => x.where) : null; } backTo(); openKnot(k, where); return; }
  if (ui.sheet === 'dugumler') { ui.back = () => openMore('dugumler', true); openKnot(k); return; }
  if (ui.sheet !== 'knot') ui.back = null;
  openKnot(k, where);
}
function setQty(k, v){ setQtyVal(k, v); invChanged(); }
// adet/paket satırındaki "Alınacak": işaretliyse kaldırır (0 sayısı da silinir), değilse alınacak listesine koyar
function alkToggle(k){
  const st = stockOf(k.split('|')[0], k.split('|')[1]);
  if (toBuy(st) || S.inv.status[k] === 'alinacak') { if (qtyOf(k) === 0) delete S.inv.qty[k]; delete S.inv.status[k]; }
  else S.inv.status[k] = 'alinacak';
  invChanged();
}
const reShop = () => { if (ui.sheet === 'alisveris') openMore('alisveris', true); };
function armOnce(b, txt){ if (b.dataset.armed) return true; b.dataset.armed = '1'; b.dataset.orig = b.textContent; b.textContent = txt; setTimeout(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.textContent = b.dataset.orig; } }, 5000); return false; }
async function pkgCheck(manual){
  const r = await pkgRefresh();
  if (r === 'updated') { importPackage(D); indexAll(); renderAll(); toast('Rig sistemin güncellendi'); }
  else if (r === 'locked') { if (!S.pkg.need) { S.pkg.need = true; persistQuiet(); } renderAll(); if (manual) openMore('paket', true); }
  else if (manual) toast(r === 'offline' ? 'Paket indirilemedi' : 'Paket güncel');
}
function bindEvents(){
  document.querySelector('.tabbar').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) show(b.dataset.v); });
  $('locBtn').addEventListener('click', () => openMap());
  $('net').addEventListener('click', () => loadWeather(true));
  $('compass').addEventListener('click', () => { const x = nowHour(); if (x) toast(compassTxt(x)); });
  $('modeBtn').addEventListener('click', () => { const k = locKind(loc()); if (k === 'kara') return;
    if (k === 'kiyi') { toast('Bu konum kıyıda: kıyıdan av. Tekne için Konumlar’dan türünü Deniz yap.'); return; }
    const m = S.mode === 'kiyi' ? 'tekne' : 'kiyi'; setSetting('mode', m); toast(m === 'kiyi' ? 'Kıyı modu: kıyı rigleri, kıyıya göre rüzgâr' : 'Tekne modu: tekne rigleri, sürüklenme ve kurşun'); });
  $('addCatch').addEventListener('click', () => catchForm(null));
  $('addItem').addEventListener('click', () => itemForm(null));
  document.addEventListener('click', async e => {
    const kg = e.target.closest && e.target.closest('g[data-knot]'); if (kg) { knotFrom(kg.dataset.knot); return; }   // şemadaki düğüm noktası
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.wel) { welcomeAction(d.wel); return; }
    if (d.acc) { e.preventDefault(); accAct(d.acc, b); return; }
    if (WZ && ui.sheet === 'wizard' && (d.wzloc || d.wzmap || d.wzcoord || d.wzm || d.wzr || d.wzt || d.wzs || d.wzsadd || d.wzy || d.wzall || d.wzl || d.wzset || d.wzb || d.wzz || d.wz)) { wzClick(d); return; }
    if (d.tier) { S.settings.tier = d.tier; persist(); renderRigs(); return; }
    if (d.systool) {
      const sy = S.systems[d.sid]; if (!sy) return;
      if (d.systool === 'edit') { startWizard(sy.id); return; }
      if (d.systool === 'toggle') { sy.active = sy.active === false; persist(); indexAll(); renderAll(); if (ui.sheet === 'paket') openMore('paket', true); toast(sy.name + (sy.active ? ' açıldı' : ' kapatıldı')); return; }
      if (d.systool === 'del') { if (!armOnce(b, 'Silmek için tekrar dokun')) return; delete S.systems[sy.id]; ui.sys = 'all'; persist(); indexAll(); renderAll(); toast('Sistem silindi'); return; }
    }
    if (d.catpick != null && d.catpick !== '') { catalogPick(Number(d.catpick)); return; }
    if (d.buyadd) { buyAdd(d.buyadd); return; }
    if (d.open) { openMore(d.open); return; }
    // Türlerim ve tür planı
    if (d.tur) { ui.sheetArg = d.tur; openMore('tur'); return; }
    if (d.tradd) { addTarget(d.tradd); ui.sheetArg = d.tradd; renderAll(); openMore('tur'); return; }
    if (d.trcustom != null) { ui.custom = d.trcustom || null; openMore('turler', true); return; }
    if (d.trlike) { const id = addTarget(null, ui.custom, d.trlike); ui.sheetArg = id; renderAll(); openMore('tur'); return; }
    if (d.trtech || d.trlay || d.trklass || d.trtime) { ui.plan = ui.plan || {}; if (d.trtech) { ui.plan.tech = d.trtech; ui.plan.lay = null; } if (d.trlay) ui.plan.lay = d.trlay; if (d.trklass) ui.plan.klass = d.trklass; if (d.trtime) ui.plan.time = d.trtime; openMore('tur', true); return; }
    if (d.trshop) { const n = planToShop(d.trshop); renderAll(); openMore('tur', true); toast(n ? n + ' kalem alışveriş listesine aktarıldı' : 'Bu kalemler zaten listede'); return; }
    if (d.trrig) { planToSystem(d.trrig); renderAll(); openMore('tur', true); toast('Rig “Tür planlarım” sistemine eklendi'); return; }
    if (d.trdelrig) { const sy = S.systems.tur; if (sy) { sy.rigs = sy.rigs.filter(r => r.id !== d.trdelrig); if (!sy.rigs.length) delete S.systems.tur; } ui.sys = 'all'; persist(); indexAll(); renderAll(); openMore('tur', true); toast('Rig sistemden çıkarıldı'); return; }
    if (d.trdel) { if (!armOnce(b, 'Çıkarmak için tekrar dokun')) return; S.targets = (S.targets || []).filter(t => t.id !== d.trdel); persist(); renderAll(); openMore('turler'); return; }
    if (d.trkeep) { addTarget(d.trkeep); renderAll(); openMore('tur', true); toast('Hedef türlerine eklendi'); return; }
    if (d.step) { const k = d.k; const cur = Number(S.inv.qty[k] || 0); setQty(k, Math.max(0, cur + Number(d.step))); return; }
    if (d.cyc) { cycleStatus(d.cyc); invChanged(); return; }
    if (d.stk && d.st) { setStatus(d.stk, d.st); invChanged(); return; }
    if (d.unit && d.u) { setUnit(d.unit, d.u); invChanged(); toast(UNIT_TXT[d.u] + ' ile sayılıyor'); return; }
    if (d.alk) { alkToggle(d.alk); return; }
    if (d.qadd) { setQtyVal(d.qadd, 1); invChanged(); return; }
    if (d.bait) { const k = d.bait + '|-'; setStatus(k, usable(stockOf(d.bait, '-')) ? 'yok' : 'var'); persist(); renderAll(); return; }
    if (d.bought) { setStatus(d.bought, 'var'); invChanged(); reShop(); toast('Envantere işlendi'); return; }
    if (d.itst) { document.querySelectorAll('#it-st button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (d.rseg) { ui.rigSeg = d.rseg; renderRigs(); return; }
    if (d.sys) { ui.sys = d.sys; renderRigs(); return; }
    if (d.iseg) { ui.inv = d.iseg; renderInventory(); return; }
    if (d.hday) { ui.hday = d.hday; renderHourly(); return; }
    if (d.calloc) { toggleCalLoc(d.calloc); return; }
    if (d.atktab) { ui.calTab = d.atktab; renderCalendar(); return; }
    if (d.atkview) { setCalView(d.atkview); renderCalendar(); setTimeout(() => akGo('gunler'), 30); return; }
    if (d.atkgo) { akGo(d.atkgo); return; }
    if (d.calpick) { const [id, k] = d.calpick.split('|'); if (S.active !== id && S.locations[id]) { S.active = id; persist(); WX = null; if (wxFresh(MWX[id], S.locations[id])) { S.wx = MWX[id]; WX = buildWx(); } loadWeather(); }
      ui.hday = k; show('bugun'); renderAll(); setTimeout(() => $('hourly').scrollIntoView({block: 'start'}), 60); return; }
    if (d.lkind) { const [id, k] = d.lkind.split('|'); setLocKind(id, k); return; }
    if (d.fday) { ui.fday = d.fday; renderFishing(); return; }
    if (d.fpart) { ui.fpart = d.fpart; renderFishing(); return; }
    if (d.part) { backTo(); const [r, k] = d.part.split('|'); openPart(r, k); return; }
    if (d.gear) { backTo(); openGear(d.gear); return; }
    if (d.gearuse) { gearAct('use', d.gearuse); return; }
    if (d.gearall) { gearAct('all', d.gearall); return; }
    if (d.gearauto) { gearAct('auto', d.gearauto); return; }
    if (d.gearbuy) { gearAct('buy', d.gearbuy); return; }
    if (d.newitem) { ui.back = null; itemForm(null, d.newitem); return; }
    if (d.rigopen) { ui.back = null; openRigSheet(d.rigopen); return; }
    if (d.prep) { backTo(); openPrep(d.prep); return; }
    if (d.done) { backTo(); openDone(d.done); return; }
    if (d.prepdone) { applyDone(d.prepdone); return; }
    if (d.undoprep) { undoDone(d.undoprep); return; }
    if (d.redit) { backTo(); openEditor(d.redit); return; }
    if (d.ed) { const i = d.ed.indexOf('|'); edAct(d.ed.slice(0, i), d.ed.slice(i + 1), b); return; }
    if (d.rphoto) { openRigPhoto(d.rphoto); return; }
    if (d.rphdel) { if (!armOnce(b, 'Silmek için tekrar dokun')) return; delRigPhoto(d.rphdel); return; }
    if (d.knot) { knotFrom(d.knot, d.kwhere ? d.kwhere.split('|') : null); return; }
    if (d.prepreset) { const all = prepGet(); delete all[d.prepreset]; lsSet(LSP, JSON.stringify(all)); openPrep(d.prepreset, true); return; }
    if (d.prepimg) { b.disabled = true; await prepImage(d.prepimg); b.disabled = false; return; }
    if (d.partuse) { partAct('use', d.partuse); return; }
    if (d.partall) { partAct('all', d.partall); return; }
    if (d.partorig) { partAct('orig', d.partorig); return; }
    if (d.partbuy) { partAct('buy', d.partbuy); return; }
    if (d.fb) { fbAct(d.fb, d); return; }
    if (d.usta) { ustaAct(d.usta, d); return; }
    if (d.ustam) { lsSet(LSU.model, d.ustam); ustaRedraw(); return; }
    if (d.alloc) { toggleAlertLoc(d.alloc); return; }
    if (d.shopdel) { const x = (S.shopX || {})[d.shopdel]; if (x) { delete S.shopX[d.shopdel]; const id = x.bait && Object.keys(ITEMS).find(i => ITEMS[i].cat === 'bait' && (ITEMS[i].key === x.bait || baitKey(ITEMS[i].name) === x.bait)); if (id) setStatus(id + '|-', 'var'); invChanged(); openMore('alisveris', true); toast('İşaretlendi'); } return; }
    if (d.avgo) { openAvLink(d.avgo); return; }
    if (d.tcal) { ui.calAll = d.tcal === 'all'; openMore('turtakvim', true); return; }
    if (d.goto) { show(d.goto); return; }
    if (d.calday) { ui.hday = d.calday; show('bugun'); renderHourly(); setTimeout(() => $('hourly').scrollIntoView({block: 'start'}), 60); return; }
    if (d.use) { S.active = d.use; persist(); WX = null; renderAll(); loadWeather(); if (ui.sheet === 'konumlar') openMore('konumlar', true); toast('Konum değişti'); return; }
    if (d.del) { if (!armOnce(b, 'Silmek için tekrar dokun')) return; delete S.locations[d.del]; if (!S.locations[S.active]) S.active = Object.keys(S.locations)[0] || null; persist(); WX = null; renderAll(); loadWeather(); openMore('konumlar', true); return; }
    if (d.set && d.val != null) { setSetting(d.set, d.val); return; }
    if (d.mapact) { mapAct(d.mapact, b); return; }
    if (d.share) { shareAct(d.share); return; }
    if (d.grp) { grpAct(d.grp, b); return; }
    if (d.mapbase) { mapLayerSet('base', d.mapbase); return; }
    if (d.rowmv) { const [l, id, dir] = d.rowmv.split('|'); moveRow(l, id, Number(dir)); return; }
    if (d.rowreset) { S.settings[d.rowreset] = null; persist(); renderAll(); if (ui.sheet === 'gorunum') openMore('gorunum', true); toast('Varsayılan düzen'); return; }
    if (d.act) {
      const a = d.act;
      if (a === 'wizard') { if (typeof startWizard === 'function') startWizard(); else toast('Rig Atölyesi bir sonraki sürümde geliyor'); return; }
      if (a === 'gpsloc') { gpsToLocation(); return; }
      if (a === 'icsAll') { await alertExport(); return; }
      if (a === 'rigRefresh') { rigRefresh(); return; }
      if (a === 'rigChClose') { ui.rigCh = null; renderRigs(); return; }
      if (a === 'driftmap') { ui.mapDrift = true; const c = mapCfg(); if (!c.drift) { c.drift = true; S.settings.map = c; persistQuiet(); } openMore('harita'); return; }
      if (a === 'baitShop') { const ds = days(), dd = ds.find(x => x.key === ui.fday) || ds[0], part = ui.fpart || 'gun', now = new Date(); if (!dd) return;
        const R = recommend(dd, part === 'gece', dd.key === dateKey(now) ? now : null), p = baitPlan(dd, part, R); if (!p || p.none || !p.items.length) { toast('Yem gerekmiyor'); return; }
        const n = baitToShop(dd, part, p); renderAll(); toast(n + ' yem alışveriş listesine eklendi'); return; }
      if (a === 'safety') { saveSafety(); const tel = (S.settings.safety || {}).tel; window.open('https://wa.me/' + (tel || '') + '?text=' + encodeURIComponent(safetyText()), '_blank', 'noopener'); return; }
      if (a === 'safetyShare') { saveSafety(); try { await navigator.share({text: safetyText()}); } catch (e) {} return; }
      if (a === 'ckReset') { S.check = {date: dateKey(new Date()), done: {}}; persist(); openMore('liste', true); return; }
      if (a === 'bkSnooze') { S.settings.bkSnooze = new Date(Date.now() + 7 * 86400000).toISOString(); persist(); renderNewVersion(); return; }
      if (a === 'heading') { const Lc = loc(); if (!Lc) return; b.textContent = 'Telefonu denize tut…';
        try { const h = await captureHeading(); Lc.facing = String(Math.round(h)); persist(); renderAll(); toast('Kıyının bakışı ' + dir8(h) + ' (' + Math.round(h) + '°)'); }
        catch (e) { toast(e.message || 'Pusula okunamadı'); b.textContent = 'Pusulayla al'; } return; }
      if (a === 'gpsfill') { if (!navigator.geolocation) { toast('Konum servisi yok'); return; } navigator.geolocation.getCurrentPosition(p => { $('nl-lat').value = p.coords.latitude.toFixed(6); $('nl-lon').value = p.coords.longitude.toFixed(6); toast('Konum alındı'); }, () => toast('Konum izni verilmedi'), {enableHighAccuracy: true, timeout: 15000}); return; }
      if (a === 'baitReset') { Object.values(ITEMS).forEach(i => { if (i.cat === 'bait') { delete S.inv.status[i.id + '|-']; delete S.inv.qty[i.id + '|-']; } }); persist(); renderAll(); toast('Bütün yemler “yok”'); return; }
      if (a === 'resetColors') { S.settings.brand = ''; S.settings.accent = ''; persist(); applyTheme(); openMore('ayarlar', true); return; }
      if (a === 'resetBft') { S.settings.bft = null; persist(); renderAll(); openMore('ayarlar', true); return; }
      if (a === 'bkNow') { const p = backupNow(true); setBkStatus(); await p; if (ui.sheet === 'yedek') openMore('yedek', true); return; }
      if (a === 'bkRestoreAsk') { if (hasProfileData() && !armOnce(b, 'Bu telefondaki profil değişecek · onayla')) return; doRestore(); return; }
      if (a === 'bkRestore') { doRestore(BK.pendingPass); return; }
      if (a === 'bkOverwrite') { if (!armOnce(b, 'Buluttaki yedeğin üzerine yazılacak · onayla')) return; $('bk-pass').value = BK.pendingPass || $('bk-pass').value; submitBackupForm(true); return; }
      if (a === 'pkgCheck') { pkgCheck(true); return; }
      if (a === 'refreshWx') { loadWeather(true); closeSheet(); return; }
      if (a === 'syncHintOff') { S.settings.syncHintOff = true; persistQuiet(); renderNewVersion(); return; }
      if (a === 'gtest') { const n = $('gTestNote'); if (n) n.textContent = 'Google deneniyor…'; const r = await googleTest(); if ($('gTestNote')) $('gTestNote').textContent = r.txt; return; }
      if (a === 'duzenCopy') { const c = duzenCode(), o = $('duzenOut'); if (o) { o.hidden = false; o.value = c; o.select(); }
        try { await navigator.clipboard.writeText(c); toast('Düzen kodu kopyalandı'); } catch (e) { toast('Kodu seçip kopyala'); } return; }
      if (a === 'duzenApply') { const el = $('duzenIn'); try { const n = duzenApply(el ? el.value : ''); toast('Düzen uygulandı (' + n + ' ayar)'); openMore('gorunum', true); } catch (e) { toast('Uygulanamadı: ' + e.message); } return; }
      if (a === 'export') { exportBackup(); return; }
    }
    if (b.id === 'seenVer') { S.seenVersion = APP_VERSION; persist(); renderNewVersion(); return; }
    if (d.catch) { catchDetail(d.catch); return; }
    if (b.hasAttribute('data-close')) { if (ui.back) { const f = ui.back; ui.back = null; f(); return; } closeSheet(); return; }
    if (d.editcatch) { const c = CATCHES.find(x => x.id === d.editcatch); if (c) catchForm(c); return; }
    if (d.delCatch) { if (d.armed) deleteCatch(d.delCatch); else { d.armed = '1'; b.textContent = 'Silmek için tekrar dokun'; } return; }
    if (d.edititem) { itemForm(d.edititem); return; }
    if (d.delitem) { if (!armOnce(b, 'Silmek için tekrar dokun')) return; deleteItem(d.delitem); return; }
    if (b.id === 'itSave') { saveItem(); return; }
    if (d.rmph) {
      const id = d.rmph;
      if (FORM.keep.includes(id)) { FORM.keep = FORM.keep.filter(x => x !== id); FORM.removed.push(id); }
      else { const p = FORM.photos.find(x => x.id === id); if (p && p.url) URL.revokeObjectURL(p.url); FORM.photos = FORM.photos.filter(x => x.id !== id); }
      renderFormPhotos(); return;
    }
    if (b.id === 'cfSave') { saveCatch(); return; }
    if (b.id === 'cfGps') {
      if (!navigator.geolocation) { toast('Konum servisi yok'); return; }
      b.textContent = 'Alınıyor…';
      navigator.geolocation.getCurrentPosition(p => { if (FORM) { FORM.loc = {lat: p.coords.latitude, lon: p.coords.longitude, src: 'gps'}; renderFormLoc(); } b.textContent = 'Bulunduğum yer'; },
        () => { toast('Konum izni verilmedi'); b.textContent = 'Bulunduğum yer'; }, {enableHighAccuracy: true, timeout: 15000});
      return;
    }
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.setc) { S.settings[el.dataset.setc] = el.value; applyTheme(); return; }
    if (el.id === 'it-search') { catalogSearch(el.value); return; }
    if (el.id === 'tr-q') { trSearch(el.value); return; }
    if (el.id === 'wz-spq' && WZ) { wzSpSearch(el.value); return; }
    if (el.id === 'wz-rod' && WZ) { WZ.ans.rodMax = el.value.trim(); return; }
    if (el.id === 'wz-name' && WZ) { WZ.ans.name = el.value; return; }
    if (el.id === 'ed-name' && RED) { RED.name = el.value; return; }
    if (el.id === 'cf-t') { const v = el.value ? new Date(el.value) : null; if (v && !isNaN(v)) $('cf-tlbl').textContent = fmtDT(v); return; }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.prepchk) { prepCheck(el.dataset.prepchk, el.checked); return; }
    if (el.dataset && el.dataset.rpfile) { addRigPhotos(el.dataset.rpfile, el.files); el.value = ''; return; }
    if (el.dataset && el.dataset.edsel != null && RED) { edSel_(el.dataset.edsel, el.value); return; }
    if (el.dataset && el.dataset.edchk === 'trail' && RED) { const l = RED.legs[RED.legs.length - 1]; l.trail = el.checked; edRelabel(RED); renderEditor(true); return; }
    if (el.id === 'cfCam' || el.id === 'cfGal') { addFiles(el.files); el.value = ''; return; }
    if (el.id === 'cf-sp') { $('cf-sp2w').hidden = el.value !== 'diger'; return; }
    if (el.id === 'cf-bot') { if (FORM) FORM.botTouched = true; return; }
    if (el.id === 'it-cat') { itemFormCat(el.value); return; }
    if (el.id === 'importFile') { const f = el.files[0]; if (f) importBackup(f); el.value = ''; return; }
    if (el.dataset.qk) {
      // sayı odaktan çıkarken de "change" olur: değişmediyse bir şey yapma; değiştiyse çizimi biraz geciktir ki aynı dokunuştaki −/+ kaybolmasın
      const k = el.dataset.qk, v = el.value.trim(); const cur = qtyOf(k);
      if ((cur == null ? '' : String(cur)) === v) return;
      setQtyVal(k, v); persist(); setTimeout(() => { indexAll(); renderAll(); reShop(); }, 250); toast('Kaydedildi'); return;
    }
    if (el.dataset.lk) { const L = S.locations[el.dataset.lk]; if (!L) return; L[el.dataset.f] = el.value.trim() || (el.dataset.f === 'name' ? L.name : ''); persist(); renderAll(); toast('Kaydedildi'); return; }
    if (el.dataset.setc) { S.settings[el.dataset.setc] = el.value; persist(); applyTheme(); renderAll(); openMore('ayarlar', true); return; }
    if (el.dataset.bft != null && el.dataset.bft !== '') { const p = bftPal().slice(); p[Number(el.dataset.bft)] = el.value; S.settings.bft = p; persist(); renderAll(); openMore('ayarlar', true); return; }
    if (el.dataset.setb) { S.settings[el.dataset.setb] = el.checked; persist(); renderAll(); return; }
    if (el.dataset.setk) { S.settings[el.dataset.setk] = el.value.trim(); persist(); toast(el.value.trim() ? 'Anahtar kaydedildi' : 'Anahtar silindi'); return; }
    if (el.dataset.grpshare) { setCatchShare(el.dataset.grpshare, {on: el.checked}); return; }
    if (el.dataset.grpopt) { setCatchShare(el.dataset.cid, {[el.dataset.grpopt]: Number(el.value)}); return; }
    if (el.dataset.grpdef) { S.settings.grpDef = Object.assign(grpDef(), {[el.dataset.grpdef]: Number(el.value)}); persist(); toast('Kaydedildi'); return; }
    if (el.dataset.alert) { const c = alertCfg(), k = el.dataset.alert, v = el.value; c[k] = k === 'part' || k === 'sp' ? v : v === '' ? '' : Number(v); S.settings.alert = c; persist(); openMore('uyari', true); return; }
    if (el.dataset.ck) { if (!S.check || S.check.date !== dateKey(new Date())) S.check = {date: dateKey(new Date()), done: {}}; if (el.checked) S.check.done[el.dataset.ck] = 1; else delete S.check.done[el.dataset.ck]; persistQuiet(); return; }
    if (el.id === 'sf-ret' || el.id === 'sf-tel' || el.id === 'sf-not') { saveSafety(); return; }
    if (el.dataset.maplayer) { mapLayerSet(el.dataset.maplayer, el.checked); return; }
    if (el.dataset.rowtog) { const [l, id] = el.dataset.rowtog.split('|'); toggleRow(l, id, el.checked); return; }
    if (el.dataset.setp) { S.profile[el.dataset.setp] = el.value.trim(); persist(); return; }
  });
  document.addEventListener('submit', e => {
    const f = e.target; e.preventDefault();
    if (f.id === 'locForm') {
      const name = $('nl-name').value.trim() || '';
      const lat = num($('nl-lat').value), lon = num($('nl-lon').value);
      if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) { $('locErr').textContent = 'Enlem −90…90°, boylam −180…180° olmalı. Ör. 38.1234 ve 26.5678'; $('locErr').hidden = false; return; }
      const id = addLocation(name, lat, lon, $('nl-bottom').value, $('nl-depth').value.trim());
      renderAll(); loadWeather(); openMore('konumlar', true); toast('Konum ' + id + ' kaydedildi');
      return;
    }
    if (f.id === 'bkForm') { submitBackupForm(false); return; }
    if (f.id === 'pkgForm') { submitPkg(); return; }
    if (f.id === 'welPkg') { welcomePkg(); return; }
    if (f.id === 'grpForm') { grpCreate(); return; }
    if (f.id === 'accForm') { accAct('login', f.querySelector('button[type="submit"]')); return; }
  });
  $('rigSearch').addEventListener('input', e => { ui.q = e.target.value; renderRigs(); });
  // saatlik tablo: kaydırınca satır adları kısalır; ada dokununca tam açılır / kapanır
  // bilgi alanı (satır adları): yalnız dokununca açılır/kapanır; kaydırma, bekleme ya da model seçimi değiştirmez
  $('hTable').addEventListener('click', e => {
    if (e.target.closest('th.lbl')) { S.settings.hFull = !S.settings.hFull; persistQuiet(); $('hScroll').classList.toggle('compact', !S.settings.hFull); return; }
    // saat seçimi: bir sütuna dokun, o saat mavi işaretlenir (tekrar dokununca kalkar); şu anki saat kırmızı kalır
    const td = e.target.closest('td'); if (!td || td.classList.contains('graph')) return;
    const hrow = $('hTable').querySelector('tr.hours'); if (!hrow) return;
    const ci = td.cellIndex, hc = hrow.cells[ci]; if (!hc || hc.tagName !== 'TD') return;
    const key = ui.hday + '|' + parseInt(hc.textContent, 10), off = ui.hsel === key;
    ui.hsel = off ? null : key;
    $('hTable').querySelectorAll('td.selh').forEach(c => c.classList.remove('selh'));
    if (!off) $('hTable').querySelectorAll('tr').forEach(tr => { const c = tr.cells[ci]; if (c && c.tagName === 'TD' && !c.classList.contains('graph') && tr.cells.length === hrow.cells.length) c.classList.add('selh'); });
  });
  // açılır bölümlerin (hazır liste) açık/kapalı hâli yeniden çizimde korunur
  document.addEventListener('toggle', e => { const el = e.target; if (el && el.dataset && el.dataset.dk) { ui.open = ui.open || {}; ui.open[el.dataset.dk] = el.open; } }, true);
  window.addEventListener('hashchange', () => { const h = (location.hash || '').slice(1); if (h.indexOf('al=') === 0) openShareLink(h.slice(3)); else if (h.indexOf('grup=') === 0) openGroupInvite(h.slice(5)); else if (h.indexOf('av=') === 0) openAvLink(h.slice(3)); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (BK.dirty && S.backup.auto && bkReady()) backupNow(false); if (CLOUD.user && CLOUD.dirty) pushNow(); return; }
    loadWeather(); pkgCheck(false); if (CLOUD.user && !CLOUD.busy && !CLOUD.ask) cloudSync(false);
  });
}
// test kancası: yalnızca adres ?qa=1 ile açılınca hesap fonksiyonlarını dışarı verir (veri değiştirmez)
if (/[?&]qa=1\b/.test(location.search)) window.ALYSSA_QA = {days: () => days(), activity, windows, bestWindows, driftAt, leadFor, leadExtra, startOffset, recommend, rigs: () => RIG_LIST,
  state: () => S, winTxt, winLabel, evChip, hm, windName, orderedRows, map: () => MAP, pickPoint, grpFetch, grpCatches, learnBase, learnSummary, solunar, curve, fishN, loc: () => loc(),
  items: () => ITEMS, stockOf, unitOf, shoppingList, baitInfo, baitPick, baitKey, baitIds, termTypes, lureTypeOf, resolveSlot, genSystem, std: () => STD,
  cloud: () => CLOUD, cloudSync, pushNow, ensureKinds, placeInfo, seaDecide, modeNow, landMode, rodInfo, reelInfo, reqSlots, speciesSearch, techsFor, planFor, missingOf, ready, resolveRig,
  spNow, rigSeason, seasonNow, tempFit, tuneRig, lightAt, learnRig, learnFb, fbAll, fbAdd, fbSet, fbPending, kb: () => KB, calMonth, monthRuns, habitatClass, seabedAt, ustaContext, mdLite, usta: () => USTA,
  alertCompute, ruleFail, buildIcs, alsGet, openAvLink, alertBanner, winStats,
  spotMemory, subFor, subSlot, subCands, partUsers, partBuyAlts, rigSnap, gearNeed, rodFit, reelFit, gearPick, rodSeat, gearIssues, rigRodMax, openGear, openRigSheet, rigChain, schemeSvg, rigMaterials, prepSteps, prepChecks, prepImageSvg, openPrep, openKnot, knots: () => KNOTS, svgToPngBlob, prepUse, openDone, applyDone, undoDone, rigToDraft, draftToRig, edWarn, openEditor, rigPh, allPhotoIds, addRigPhotos, red: () => RED, rigTimeline, baitPlan, rigDepth, spDepth, driftNow, geoDest, items2: () => ITEMS, invChanged, setStatus, patOf, hookIdx, lineMm, sizesOf, usable};
(async () => {
  loadState();
  pkgLoadCached();
  if (D && (EMBED || S.pkg.unlocked)) importPackage(D);
  applyTheme();
  indexAll(); bindEvents();
  const h = (location.hash || '').slice(1);
  const shareRaw = h.indexOf('al=') === 0 ? h.slice(3) : null, grpRaw = h.indexOf('grup=') === 0 ? h.slice(5) : null, avRaw = h.indexOf('av=') === 0 ? h.slice(3) : null;
  show(VIEWS.includes(h) ? h : 'bugun');
  if (S.wx) WX = buildWx();
  await loadCatches();
  renderAll();
  if (shareRaw) openShareLink(shareRaw);
  else if (grpRaw) openGroupInvite(grpRaw);
  else if (avRaw && S.onboarded) openAvLink(avRaw);
  else if (!PREVIEW && !S.onboarded && !hasProfileData()) showWelcome();
  else if (!S.onboarded) { S.onboarded = true; persistQuiet(); }
  if (CATCHES.length) { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {} }
  loadWeather();
  setTimeout(ensureKinds, 1500);
  if (!EMBED && S.pkg.unlocked) pkgCheck(false);
  cloudInit();
})();
/*__SW__*/
