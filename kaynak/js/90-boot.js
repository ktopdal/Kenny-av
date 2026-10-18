// ---------------------------------------------------------------- 90 · gezinme, olaylar, açılış
function renderTop(){
  const L = loc();
  $('locName').textContent = L ? (L.id === '1' ? 'Konum 1 · ' : '') + L.name : 'Konum yok';
  $('locSub').textContent = L ? L.lat.toFixed(4) + '°, ' + L.lon.toFixed(4) + '° · dip: ' + (BOTTOM_TXT[L.bottom || ''] || 'bilinmiyor') : '';
}
function renderAll(){
  if (!D || !S) return;
  const a = document.activeElement;
  if (a && ((a.tagName === 'INPUT' && !['file', 'search', 'checkbox'].includes(a.type)) || a.tagName === 'TEXTAREA') && !$('sheet').contains(a)) { a.addEventListener('blur', () => renderAll(), {once: true}); return; }
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
  if (v === '' || v == null) delete S.qty[k]; else S.qty[k] = Math.max(0, Math.round(Number(String(v).replace(',', '.')) || 0));
  persist(); renderAll();
}
function bindEvents(){
  document.querySelector('.tabbar').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) show(b.dataset.v); });
  $('locBtn').addEventListener('click', () => { show('daha'); setTimeout(() => { const el = $('locHead'); if (el) el.scrollIntoView({block: 'start'}); }, 60); });
  $('net').addEventListener('click', () => loadWeather(true));
  $('addCatch').addEventListener('click', () => catchForm(null));
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.step) { const k = b.dataset.k; const cur = Number(S.qty[k] || 0); setQty(k, cur + Number(b.dataset.step)); return; }
    if (b.dataset.rseg) { ui.rigSeg = b.dataset.rseg; renderRigs(); return; }
    if (b.dataset.iseg) { ui.inv = b.dataset.iseg; renderInventory(); return; }
    if (b.dataset.hday) { ui.hday = b.dataset.hday; renderHourly(); return; }
    if (b.dataset.calday) { ui.hday = b.dataset.calday; show('bugun'); renderHourly(); setTimeout(() => $('hourly').scrollIntoView({block: 'start'}), 60); return; }
    if (b.dataset.use) { S.active = b.dataset.use; persist(); WX = null; renderAll(); loadWeather(); toast('Konum değişti'); return; }
    if (b.dataset.del) { delete S.locations[b.dataset.del]; if (!S.locations[S.active]) S.active = Object.keys(S.locations)[0]; persist(); renderAll(); return; }
    if (b.id === 'seenVer') { S.seenVersion = APP_VERSION; persist(); renderNewVersion(); return; }
    if (b.dataset.catch) { catchDetail(b.dataset.catch); return; }
    if (b.hasAttribute('data-close')) { closeSheet(); return; }
    if (b.dataset.editcatch) { const c = CATCHES.find(x => x.id === b.dataset.editcatch); if (c) catchForm(c); return; }
    if (b.dataset.delCatch) { if (b.dataset.armed) deleteCatch(b.dataset.delCatch); else { b.dataset.armed = '1'; b.textContent = 'Silmek için tekrar dokun'; } return; }
    if (b.dataset.rmph) {
      const id = b.dataset.rmph;
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
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'cfCam' || el.id === 'cfGal') { addFiles(el.files); el.value = ''; return; }
    if (el.id === 'cf-sp') { $('cf-sp2w').hidden = el.value !== 'diger'; return; }
    if (el.id === 'importFile') { const f = el.files[0]; if (f) importBackup(f); el.value = ''; return; }
    if (el.dataset.qk) { setQty(el.dataset.qk, el.value.trim()); toast('Kaydedildi'); return; }
    if (el.dataset.lk) { const L = S.locations[el.dataset.lk]; L[el.dataset.f] = el.value.trim(); persist(); renderAll(); toast('Kaydedildi'); return; }
  });
  $('rigSearch').addEventListener('input', e => { ui.q = e.target.value; renderRigs(); });
  $('exportBtn').addEventListener('click', exportBackup);
  $('locForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('nl-name').value.trim() || 'Yeni konum';
    const lat = num($('nl-lat').value), lon = num($('nl-lon').value);
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) { $('locErr').textContent = 'Enlem −90…90°, boylam −180…180° olmalı. Ör. 38.1234 ve 26.5678'; $('locErr').hidden = false; return; }
    $('locErr').hidden = true;
    const id = String(Math.max(1, ...Object.keys(S.locations).map(Number).filter(isFinite)) + 1);
    S.locations[id] = {id, name, lat, lon, bottom: $('nl-bottom').value, depth: $('nl-depth').value.trim()};
    S.active = id; persist(); e.target.reset(); WX = null; renderAll(); loadWeather(); toast('Konum ' + id + ' kaydedildi');
  });
  $('useGps').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Konum servisi yok'); return; }
    navigator.geolocation.getCurrentPosition(p => { $('nl-lat').value = p.coords.latitude.toFixed(6); $('nl-lon').value = p.coords.longitude.toFixed(6); toast('Konum alındı'); },
      () => toast('Konum izni verilmedi'), {enableHighAccuracy: true, timeout: 15000});
  });
  document.addEventListener('visibilitychange', async () => { if (document.hidden) return; loadWeather(); if (await refreshData()) { indexData(); renderAll(); toast('Rig verisi güncellendi'); } });
  if (PREVIEW) { $('exportBtn').hidden = true; $('importFile').closest('label').hidden = true; $('bkNote').textContent = 'Yedek alma ve yükleme telefona kurulan uygulamada çalışır.'; }
}
async function start(){
  indexData(); loadState(); bindEvents();
  const h = (location.hash || '').slice(1);
  show(VIEWS.includes(h) ? h : 'bugun');
  if (S.wx) WX = buildWx();
  await loadCatches();
  renderAll();
  loadWeather();
}
(async () => {
  const r = await loadData();
  if (r === 'ok') { start(); return; }
  if (r && r.locked) { showLock(r.locked, start); return; }
  document.body.insertAdjacentHTML('beforeend', '<div class="lock"><div class="box"><h2>Kenny Av</h2><p class="sub">Uygulama verisi indirilemedi. İnternet bağlantını kontrol edip uygulamayı yeniden aç.</p></div></div>');
})();
/*__SW__*/
