// ---------------------------------------------------------------- 75 · Daha: alışveriş, konumlar, standartlar, yedek, kaynaklar
function renderMore(){
  const need = {};
  D.rigs.forEach(rg => missingOf(rg).forEach(m => { const id = m.c.item; if (!id) return; const k = id + '|' + (m.c.size || '-'); (need[k] = need[k] || {id, size: m.c.size, rigs: []}).rigs.push(rg.code); }));
  const groups = {};
  Object.values(need).forEach(n => { const it = ITEMS[n.id]; const st = it.store || 'Envanter'; (groups[st] = groups[st] || []).push(n); });
  const SN = {A: 'Owner mağazası (A)', B: 'Karma mağaza (B)', Envanter: 'Yeniden alınacak'};
  $('buyList').innerHTML = Object.keys(groups).sort().map(g => '<div class="eyebrow">' + esc(SN[g] || g) + '</div>' + groups[g].map(n => {
    const it = ITEMS[n.id]; const k = n.id + '|' + (n.size || '-');
    return '<div class="item"><div class="row" style="justify-content:space-between"><div class="nm">' + esc(it.name) + ' <b class="mono">' + esc(n.size || '') + '</b></div><span class="chip">' + n.rigs.length + ' rigde</span></div>' +
      '<div class="sp">' + esc(n.rigs.join(', ')) + (it.note ? ' · ' + esc(it.note) : '') + '</div>' +
      '<div class="row"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Aldığım (adet)<input style="width:90px" id="b-' + esc(k.replace(/[^a-z0-9]/gi, '_')) + '" data-qk="' + esc(k) + '" inputmode="numeric" placeholder="0"></label></div></div>';
  }).join('')).join('') || '<div class="empty">Eksik kalem yok, tüm rigler tamam.</div>';
  // konumlar
  const ccount = id => CATCHES.filter(c => c.loc && distKm(c.loc, S.locations[id]) <= 0.5).length;
  $('locList').innerHTML = Object.values(S.locations).map(L => '<div class="item"><div class="row" style="justify-content:space-between"><div><div class="nm">' + (L.id === '1' ? 'Konum 1 · ' : 'Konum ' + esc(L.id) + ' · ') + esc(L.name) + '</div>' +
    '<div class="sp mono">' + L.lat.toFixed(5) + '°, ' + L.lon.toFixed(5) + '°' + (ccount(L.id) ? ' · ' + ccount(L.id) + ' av' : '') + '</div></div>' +
    (S.active === L.id ? '<span class="chip A">Seçili</span>' : '<button class="btn small" data-use="' + esc(L.id) + '">Seç</button>') + '</div>' +
    '<div class="fields"><label class="f">Dip<select data-lk="' + esc(L.id) + '" data-f="bottom" id="lb-' + esc(L.id) + '">' + BOTTOM.map(([k, t]) => '<option value="' + k + '"' + (k === (L.bottom || '') ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
    '<label class="f">Derinlik (m)<input data-lk="' + esc(L.id) + '" data-f="depth" id="ld-' + esc(L.id) + '" inputmode="decimal" value="' + esc(L.depth || '') + '" placeholder="—"></label></div>' +
    (L.id !== '1' ? '<div><button class="btn small" data-del="' + esc(L.id) + '">Sil</button></div>' : '') + '</div>').join('');
  if (!$('nl-bottom').options.length) $('nl-bottom').innerHTML = BOTTOM.map(([k, t]) => '<option value="' + k + '">' + t + '</option>').join('');
  $('stdRows').innerHTML = D.setups.map(s => { const st = s.standard_cm; return '<tr><td>' + esc(s.name) + '</td><td>' + st.ust + '</td><td>' + st.orta + '</td><td>' + st.hirsiz + '</td><td>' + st.aralik + '</td><td>' + st.kursun_g.join('–') + '</td><td>' + st.kursun_max_g + '</td></tr>'; }).join('');
  // kaynak durumu
  const stt = (S.wx && S.wx.status) || {};
  $('srcList').innerHTML = Object.keys(SRC).map(id => { const s = stt[id]; return '<span class="' + (s === 'ok' ? 'ok' : s ? 'no' : '') + '">' + (s === 'ok' ? '✓' : s ? '✗' : '·') + ' ' + esc(SRC[id].label) + ' — ' + esc(SRC[id].what) + (s && s !== 'ok' ? ' (' + esc(s) + ')' : '') + '</span>'; }).join('') +
    (S.wx && S.wx.at ? '<span>Son güncelleme: ' + hm(new Date(S.wx.at)) + '</span>' : '');
  $('about').textContent = 'Kenny Av v' + APP_VERSION + ' · veri ' + (D.meta.data_version || D.meta.built) + ' · ' + D.rigs.length + ' rig, ' + D.items.length + ' kalem. Resmî deniz tahmini değildir; çıkmadan önce MGM uyarılarına bak.';
}
function renderNewVersion(){
  const el = $('newVer');
  if (!S.seenVersion || !verGt(APP_VERSION, S.seenVersion)) { el.innerHTML = ''; return; }
  const notes = CHANGELOG.filter(c => verGt(c.v, S.seenVersion) && !verGt(c.v, APP_VERSION)).flatMap(c => c.notes);
  el.innerHTML = '<div class="newver"><b>Kenny Av güncellendi · v' + APP_VERSION + '</b><ul>' + notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul><div><button class="btn small" type="button" id="seenVer">Tamam</button></div></div>';
}
// ---- yedek
async function blobToDataUrl(b){ return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
async function dataUrlToBlob(u){ const r = await fetch(u); return r.blob(); }
async function exportBackup(){
  const withPhotos = $('bkPhotos').checked;
  const out = {app: 'kenny-av', version: APP_VERSION, exported: new Date().toISOString(), state: {qty: S.qty, status: S.status, locations: S.locations, active: S.active, prefs: S.prefs}, catches: CATCHES};
  if (withPhotos) { out.photos = {}; for (const c of CATCHES) for (const pid of (c.photos || [])) { const p = await IDB.get('photos', pid); if (p) out.photos[pid] = {big: await blobToDataUrl(p.big), thumb: await blobToDataUrl(p.thumb)}; } }
  const blob = new Blob([JSON.stringify(out)], {type: 'application/json'});
  const name = 'kenny-av-yedek-' + new Date().toISOString().slice(0, 10) + '.json';
  try {
    const f = new File([blob], name, {type: 'application/json'});
    if (navigator.canShare && navigator.canShare({files: [f]})) { await navigator.share({files: [f], title: 'Kenny Av yedeği'}); $('bkNote').textContent = 'Yedek paylaşıldı.'; return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  $('bkNote').textContent = 'Yedek indirildi (' + Math.round(blob.size / 1024) + ' KB).';
}
async function importBackup(file){
  try {
    const j = JSON.parse(await file.text()); if (j.app !== 'kenny-av' || !j.state) throw new Error('x');
    Object.assign(S, j.state); persist();
    if (j.photos) for (const pid of Object.keys(j.photos)) await IDB.put('photos', {id: pid, big: await dataUrlToBlob(j.photos[pid].big), thumb: await dataUrlToBlob(j.photos[pid].thumb)});
    if (Array.isArray(j.catches)) for (const c of j.catches) await IDB.put('catches', c);
    await loadCatches(); renderAll(); loadWeather(true);
    $('bkNote').textContent = 'Yedek yüklendi' + (j.catches ? ' · ' + j.catches.length + ' av' : '') + '.';
  } catch (e) { $('bkNote').textContent = 'Bu dosya Kenny Av yedeği değil.'; }
}
