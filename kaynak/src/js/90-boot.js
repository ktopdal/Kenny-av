// ---------------------------------------------------------------- 90 · gezinme, olaylar, açılış
function nowHour(){ const ds = days(); const dd = ds.find(d => d.key === dateKey(new Date())) || ds[0]; return dd ? refHour(dd) : null; }
function renderTop(){
  const L = loc();
  $('locName').textContent = L ? locLabel(L) : APP_SHORT;
  $('locSub').textContent = L ? fmtCoord(L.lat, L.lon) + ' · dip: ' + (BOTTOM_TXT[L.bottom || ''] || 'bilinmiyor') : 'Konum seçilmedi';
  const x = L ? nowHour() : null; const c = $('compass');
  c.hidden = !x; c.innerHTML = x ? compassHtml(x) : '';
}
function renderAll(){
  if (!S) return;
  const a = document.activeElement;
  if (a && ((a.tagName === 'INPUT' && !['file', 'search', 'checkbox', 'color'].includes(a.type)) || a.tagName === 'TEXTAREA') && !$('sheet').contains(a) && !$('welcome').contains(a)) { a.addEventListener('blur', () => renderAll(), {once: true}); return; }
  DAYS_CACHE = null;
  renderTop(); renderNewVersion(); renderToday(); renderCalendar(); renderCatches(); renderRigs(); renderInventory(); renderMore();
}
const VIEWS = ['bugun', 'takvim', 'avlar', 'rigler', 'envanter', 'daha'];
function show(v){
  document.querySelectorAll('section.view').forEach(s => { s.hidden = s.id !== 'v-' + v; });
  document.querySelectorAll('.tabbar button').forEach(b => b.setAttribute('aria-current', b.dataset.v === v ? 'page' : 'false'));
  window.scrollTo({top: 0});
  try { history.replaceState(history.state, '', '#' + v); } catch (e) {}
}
function setQty(k, v){
  if (v === '' || v == null) delete S.inv.qty[k]; else S.inv.qty[k] = Math.max(0, Math.round(Number(String(v).replace(',', '.')) || 0));
  persist(); renderAll();
}
function armOnce(b, txt){ if (b.dataset.armed) return true; b.dataset.armed = '1'; b.dataset.orig = b.textContent; b.textContent = txt; setTimeout(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.textContent = b.dataset.orig; } }, 5000); return false; }
async function pkgCheck(manual){
  const r = await pkgRefresh();
  if (r === 'updated') { importPackage(D); indexAll(); renderAll(); toast('Rig sistemin güncellendi'); }
  else if (r === 'locked') { if (!S.pkg.need) { S.pkg.need = true; persistQuiet(); } renderAll(); if (manual) openMore('paket', true); }
  else if (manual) toast(r === 'offline' ? 'Paket indirilemedi' : 'Paket güncel');
}
function bindEvents(){
  document.querySelector('.tabbar').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) show(b.dataset.v); });
  $('locBtn').addEventListener('click', () => openMore('konumlar'));
  $('net').addEventListener('click', () => loadWeather(true));
  $('compass').addEventListener('click', () => { const x = nowHour(); if (x) toast(compassTxt(x)); });
  $('addCatch').addEventListener('click', () => catchForm(null));
  $('addItem').addEventListener('click', () => itemForm(null));
  document.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.wel) { welcomeAction(d.wel); return; }
    if (WZ && (d.wzm || d.wzr || d.wzt || d.wzs || d.wzall || d.wzl || d.wzset || d.wzb || d.wzz || d.wz)) { wzClick(d); return; }
    if (d.tier) { S.settings.tier = d.tier; persist(); renderRigs(); return; }
    if (d.systool) {
      const sy = S.systems[d.sid]; if (!sy) return;
      if (d.systool === 'edit') { startWizard(sy.id); return; }
      if (d.systool === 'toggle') { sy.active = sy.active === false; persist(); indexAll(); renderAll(); toast(sy.name + (sy.active ? ' açıldı' : ' kapatıldı')); return; }
      if (d.systool === 'del') { if (!armOnce(b, 'Silmek için tekrar dokun')) return; delete S.systems[sy.id]; ui.sys = 'all'; persist(); indexAll(); renderAll(); toast('Sistem silindi'); return; }
    }
    if (d.catpick != null && d.catpick !== '') { catalogPick(Number(d.catpick)); return; }
    if (d.buyadd) { buyAdd(d.buyadd); return; }
    if (d.open) { openMore(d.open); return; }
    if (d.step) { const k = d.k; const cur = Number(S.inv.qty[k] || 0); setQty(k, cur + Number(d.step)); return; }
    if (d.rseg) { ui.rigSeg = d.rseg; renderRigs(); return; }
    if (d.sys) { ui.sys = d.sys; renderRigs(); return; }
    if (d.iseg) { ui.inv = d.iseg; renderInventory(); return; }
    if (d.hday) { ui.hday = d.hday; renderHourly(); return; }
    if (d.calday) { ui.hday = d.calday; show('bugun'); renderHourly(); setTimeout(() => $('hourly').scrollIntoView({block: 'start'}), 60); return; }
    if (d.use) { S.active = d.use; persist(); WX = null; renderAll(); loadWeather(); if (ui.sheet === 'konumlar') openMore('konumlar', true); toast('Konum değişti'); return; }
    if (d.del) { if (!armOnce(b, 'Silmek için tekrar dokun')) return; delete S.locations[d.del]; if (!S.locations[S.active]) S.active = Object.keys(S.locations)[0] || null; persist(); WX = null; renderAll(); loadWeather(); openMore('konumlar', true); return; }
    if (d.set && d.val != null) { setSetting(d.set, d.val); return; }
    if (d.rowmv) { const [l, id, dir] = d.rowmv.split('|'); moveRow(l, id, Number(dir)); return; }
    if (d.rowreset) { S.settings[d.rowreset] = null; persist(); renderAll(); if (ui.sheet === 'gorunum') openMore('gorunum', true); toast('Varsayılan düzen'); return; }
    if (d.act) {
      const a = d.act;
      if (a === 'wizard') { if (typeof startWizard === 'function') startWizard(); else toast('Rig Atölyesi bir sonraki sürümde geliyor'); return; }
      if (a === 'gpsloc') { gpsToLocation(); return; }
      if (a === 'gpsfill') { if (!navigator.geolocation) { toast('Konum servisi yok'); return; } navigator.geolocation.getCurrentPosition(p => { $('nl-lat').value = p.coords.latitude.toFixed(6); $('nl-lon').value = p.coords.longitude.toFixed(6); toast('Konum alındı'); }, () => toast('Konum izni verilmedi'), {enableHighAccuracy: true, timeout: 15000}); return; }
      if (a === 'resetColors') { S.settings.brand = ''; S.settings.accent = ''; persist(); applyTheme(); openMore('ayarlar', true); return; }
      if (a === 'resetBft') { S.settings.bft = null; persist(); renderAll(); openMore('ayarlar', true); return; }
      if (a === 'bkNow') { const p = backupNow(true); setBkStatus(); await p; if (ui.sheet === 'yedek') openMore('yedek', true); return; }
      if (a === 'bkRestoreAsk') { if (hasProfileData() && !armOnce(b, 'Bu telefondaki profil değişecek · onayla')) return; doRestore(); return; }
      if (a === 'bkRestore') { doRestore(BK.pendingPass); return; }
      if (a === 'bkOverwrite') { if (!armOnce(b, 'Buluttaki yedeğin üzerine yazılacak · onayla')) return; $('bk-pass').value = BK.pendingPass || $('bk-pass').value; submitBackupForm(true); return; }
      if (a === 'pkgCheck') { pkgCheck(true); return; }
      if (a === 'refreshWx') { loadWeather(true); closeSheet(); return; }
      if (a === 'export') { exportBackup(); return; }
    }
    if (b.id === 'seenVer') { S.seenVersion = APP_VERSION; persist(); renderNewVersion(); return; }
    if (d.catch) { catchDetail(d.catch); return; }
    if (b.hasAttribute('data-close')) { closeSheet(); return; }
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
    if (el.id === 'wz-rod' && WZ) { WZ.ans.rodMax = el.value.trim(); return; }
    if (el.id === 'wz-name' && WZ) { WZ.ans.name = el.value; return; }
    if (el.id === 'cf-t') { const v = el.value ? new Date(el.value) : null; if (v && !isNaN(v)) $('cf-tlbl').textContent = fmtDT(v); return; }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'cfCam' || el.id === 'cfGal') { addFiles(el.files); el.value = ''; return; }
    if (el.id === 'cf-sp') { $('cf-sp2w').hidden = el.value !== 'diger'; return; }
    if (el.id === 'cf-bot') { if (FORM) FORM.botTouched = true; return; }
    if (el.id === 'it-cat') { $('it-patw').hidden = el.value !== 'hook'; return; }
    if (el.id === 'importFile') { const f = el.files[0]; if (f) importBackup(f); el.value = ''; return; }
    if (el.dataset.qk) { setQty(el.dataset.qk, el.value.trim()); if (ui.sheet === 'alisveris') openMore('alisveris', true); toast('Kaydedildi'); return; }
    if (el.dataset.lk) { const L = S.locations[el.dataset.lk]; if (!L) return; L[el.dataset.f] = el.value.trim() || (el.dataset.f === 'name' ? L.name : ''); persist(); renderAll(); toast('Kaydedildi'); return; }
    if (el.dataset.setc) { S.settings[el.dataset.setc] = el.value; persist(); applyTheme(); renderAll(); openMore('ayarlar', true); return; }
    if (el.dataset.bft != null && el.dataset.bft !== '') { const p = bftPal().slice(); p[Number(el.dataset.bft)] = el.value; S.settings.bft = p; persist(); renderAll(); openMore('ayarlar', true); return; }
    if (el.dataset.setb) { S.settings[el.dataset.setb] = el.checked; persist(); renderAll(); return; }
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
  });
  $('rigSearch').addEventListener('input', e => { ui.q = e.target.value; renderRigs(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (BK.dirty && S.backup.auto && bkReady()) backupNow(false); return; }
    loadWeather(); pkgCheck(false);
  });
}
// test kancası: yalnızca adres ?qa=1 ile açılınca hesap fonksiyonlarını dışarı verir (veri değiştirmez)
if (/[?&]qa=1\b/.test(location.search)) window.ALYSSA_QA = {days: () => days(), activity, windows, bestWindows, driftAt, leadFor, leadExtra, startOffset, recommend, rigs: () => RIG_LIST,
  state: () => S, winTxt, winLabel, evChip, hm, windName, orderedRows, learnBase, learnSummary, solunar, curve, fishN, loc: () => loc()};
(async () => {
  loadState();
  pkgLoadCached();
  if (D && (EMBED || S.pkg.unlocked)) importPackage(D);
  applyTheme();
  indexAll(); bindEvents();
  const h = (location.hash || '').slice(1);
  show(VIEWS.includes(h) ? h : 'bugun');
  if (S.wx) WX = buildWx();
  await loadCatches();
  renderAll();
  if (!PREVIEW && !S.onboarded && !hasProfileData()) showWelcome();
  else if (!S.onboarded) { S.onboarded = true; persistQuiet(); }
  loadWeather();
  if (!EMBED && S.pkg.unlocked) pkgCheck(false);
})();
/*__SW__*/
