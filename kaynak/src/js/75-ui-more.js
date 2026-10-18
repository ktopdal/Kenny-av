// ---------------------------------------------------------------- 75 · Daha: menü ve sayfalar (ayarlar, bulut yedek, özel paket, konumlar, alışveriş…)
const MORE = [
  ['ayarlar', 'Ayarlar', () => 'Tema, renkler, rüzgâr renkleri, yazı boyutu'],
  ['yedek', 'Bulut yedek', () => bkReady() ? (S.backup.err ? '⚠ ' + S.backup.err : S.backup.lastAt ? 'Son yedek ' + fmtDT(new Date(S.backup.lastAt)) : 'Bağlı, henüz yedek yok') : 'Kapalı · GitHub deponda şifreli yedek'],
  ['paket', 'Özel paket', () => S.pkg.need ? '⚠ Güncellendi, yeni şifreyle aç' : pkgOn() ? 'Açık · ' + D.rigs.length + ' rig, ' + D.items.length + ' kalem' : 'Kapalı'],
  ['konumlar', 'Konumlar', () => Object.keys(S.locations).length + ' konum' + (loc() ? ' · seçili: ' + locLabel(loc()) : '')],
  ['alisveris', 'Alışveriş listesi', () => { const n = shoppingList().length; return n ? n + ' kalem eksik' : 'Eksik kalem yok'; }],
  ['standart', 'Takım standartları', () => Object.keys(SETUPS).length ? Object.keys(SETUPS).length + ' takım' : 'Rig sistemi kurulunca'],
  ['dosya', 'Dosya yedeği', () => 'Telefona indir ya da dosyadan yükle'],
  ['kaynak', 'Veri kaynakları', () => { const st = (S.wx && S.wx.status) || {}; const k = Object.keys(SRC); const ok = k.filter(i => st[i] === 'ok').length; return S.wx ? ok + '/' + k.length + ' kaynak çalışıyor' : 'Henüz veri yok'; }],
  ['surum', 'Sürüm notları', () => 'v' + APP_VERSION],
];
function renderMore(){
  $('moreMenu').innerHTML = MORE.map(([k, t, sub]) => '<button class="mrow" type="button" data-open="' + k + '"><span><b>' + esc(t) + '</b><small>' + esc(sub()) + '</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>').join('');
  $('about').textContent = APP_NAME + ' v' + APP_VERSION + (pkgOn() ? ' · özel paket ' + (D.meta.data_version || '') : '') + ' · ' + RIG_LIST.length + ' rig, ' + Object.keys(ITEMS).length + ' kalem. Resmî deniz tahmini değildir; denize çıkmadan önce MGM uyarılarına bak.';
}
function renderNewVersion(){
  const el = $('banners'); const out = [];
  if (S.seenVersion && verGt(APP_VERSION, S.seenVersion)) {
    const notes = CHANGELOG.filter(c => verGt(c.v, S.seenVersion) && !verGt(c.v, APP_VERSION)).flatMap(c => c.notes);
    out.push('<div class="newver"><b>' + APP_SHORT + ' güncellendi · v' + APP_VERSION + '</b><ul>' + notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul><div><button class="btn small" type="button" id="seenVer">Tamam</button></div></div>');
  }
  if (S.pkg.need) out.push('<div class="newver warn"><b>Rig sistemin güncellendi</b><span class="note">Özel paketin yeni şifreyle şifrelendi. Bir kez yeni şifreyi gir; telefon hatırlar.</span><div><button class="btn small primary" type="button" data-open="paket">Şifreyi gir</button></div></div>');
  el.innerHTML = out.join('');
}
function openMore(name, keep){
  ui.sheet = name;
  const F = {ayarlar: sheetSettings, yedek: sheetBackup, paket: sheetPackage, konumlar: sheetLocations, alisveris: sheetShopping, standart: sheetStandards, dosya: sheetFile, kaynak: sheetSources, surum: sheetChangelog}[name];
  if (F) openSheet(F(), keep);
}
// ---- Ayarlar
function sheetSettings(){
  const st = S.settings; const tc = themeColors();
  const pal = bftPal();
  return sheetBar('Ayarlar') + '<div class="stack">' +
    '<section class="set"><h4>Tema</h4>' + segBtns('scheme', [['auto', 'Otomatik'], ['light', 'Açık'], ['dark', 'Koyu']], st.scheme) + '</section>' +
    '<section class="set"><h4>Renk paleti</h4><div class="presets">' + PRESETS.map(p => '<button class="preset" type="button" data-set="preset" data-val="' + p.id + '" aria-pressed="' + (st.preset === p.id && !st.brand && !st.accent) + '"><i style="background:' + p.brand + '"></i><i style="background:' + p.accent + '"></i>' + esc(p.name) + '</button>').join('') + '</div>' +
    '<div class="fields" style="margin-top:10px"><label class="f">Ana renk<input type="color" data-setc="brand" value="' + tc.brand + '"></label><label class="f">Vurgu rengi<input type="color" data-setc="accent" value="' + tc.accent + '"></label></div>' +
    (st.brand || st.accent ? '<button class="btn small" type="button" data-act="resetColors">Paletin renklerine dön</button>' : '') + '</section>' +
    '<section class="set"><h4>Yazı boyutu</h4>' + segBtns('zoom', [[0, 'Normal'], [1, 'Büyük'], [2, 'Çok büyük']], st.zoom) + '</section>' +
    '<section class="set"><h4>Rüzgâr renkleri (Bft)</h4><p class="note">Saatlik tabloda rüzgâr ve hamle hücreleri, takvim ve anlık durum bu renklerle boyanır. Bir kutuya dokunup rengini değiştir.</p>' +
    '<div class="bftedit">' + pal.map((c, i) => '<label title="' + esc(BFT_NAMES[i]) + '"><span>' + i + '</span><input type="color" data-bft="' + i + '" value="' + c + '" aria-label="' + i + ' Bft rengi (' + esc(BFT_NAMES[i]) + ')"></label>').join('') + '</div>' +
    bftLegend().split('<div class="legend">')[0] + (st.bft ? '<button class="btn small" type="button" data-act="resetBft">Varsayılan renkler</button>' : '') + '</section>' +
    '<section class="set"><h4>Koordinatlar</h4>' + segBtns('coord', [['dd', 'Ondalık · 38.3783°'], ['ddm', 'Derece-dakika · 38°22,698′ K']], st.coord) +
    '<label class="row note chk"><input type="checkbox" data-setb="hideCoords"' + (st.hideCoords ? ' checked' : '') + '> Koordinatları üst çubukta ve av kayıtlarında gizle (ekran görüntüsü paylaşırken)</label></section>' +
    '<section class="set"><h4>Av modu</h4>' + segBtns('mode', [['tekne', 'Tekne'], ['kiyi', 'Kıyı']], S.mode) + '<p class="note">Kıyı modunda kıyı teknikleri ve kıyı rigleri öne çıkar (kıyı önerileri sonraki sürümlerde genişleyecek).</p></section>' +
    '<section class="set"><h4>Profil</h4><label class="f">Adın (isteğe bağlı)<input id="pf-name" data-setp="name" value="' + esc(S.profile.name || '') + '" placeholder="Ör. Kaptan"></label></section>' +
    '</div>';
}
function setSetting(name, val){
  if (name === 'mode') S.mode = val;
  else if (name === 'preset') { S.settings.preset = val; S.settings.brand = ''; S.settings.accent = ''; }
  else if (name === 'zoom') S.settings.zoom = Number(val) || 0;
  else S.settings[name] = val;
  persist(); applyTheme(); indexAll(); renderAll();
  if (ui.sheet === 'ayarlar') openMore('ayarlar', true);
}
// ---- Bulut yedek
function sheetBackup(){
  const b = S.backup; const tok = lsGet(LS.ghTok); const ready = bkReady();
  return sheetBar('Bulut yedek') + '<div class="stack">' +
    '<p class="sub">Profilin (rig sistemlerin, envanterin, konumların, ayarların) ve avların fotoğraflarıyla birlikte şifrelenip <b>senin GitHub deponda</b> saklanır. Her kullanıcının kendi dosyası olur; şifreyi bilmeyen depoyu görse bile açamaz.</p>' +
    (ready ? '<div class="panel stack"><b>Bağlı: ' + esc(b.repo) + ' · profil: ' + esc(bkCfg().name) + '</b><span class="note" id="bkStatus">' + esc(bkStatusText()) + '</span>' +
      '<div class="row"><button class="btn primary" type="button" data-act="bkNow">Şimdi yedekle</button><button class="btn" type="button" data-act="bkRestoreAsk">Buluttan geri yükle</button></div></div>' : '') +
    '<form class="panel stack" id="bkForm" novalidate><div class="fields">' +
    '<label class="f wide">Depo (kullanıcı/depo)<input id="bk-repo" value="' + esc(b.repo || '') + '" placeholder="ör. ktopdal/alyssa-yedek" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
    '<label class="f wide">Profil adı<input id="bk-name" value="' + esc(b.name || slugTR(S.profile.name || '')) + '" placeholder="ör. kenny" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
    '<label class="f wide">GitHub anahtarı (token)' + (tok ? ' · kayıtlı ✓' : '') + '<input id="bk-tok" type="password" autocomplete="off" placeholder="' + (tok ? 'değiştirmek için yeni anahtarı yapıştır' : 'github_pat_…') + '"></label>' +
    '<label class="f wide">Yedek şifresi' + (lsGet(LS.bkKey) ? ' · kayıtlı ✓' : '') + '<input id="bk-pass" type="password" autocomplete="off" placeholder="' + (lsGet(LS.bkKey) ? 'değiştirmek gerekmez' : 'yedeği açacak şifre') + '"></label>' +
    '</div><label class="row note chk"><input type="checkbox" id="bk-auto"' + (b.auto ? ' checked' : '') + '> Otomatik yedekle (değişiklikten 1 dakika sonra)</label>' +
    '<label class="row note chk"><input type="checkbox" id="bk-photos"' + (b.photosOn !== false ? ' checked' : '') + '> Fotoğrafları da yedekle</label>' +
    '<p class="err" id="bkErr" hidden></p><div id="bkConflict"></div>' +
    '<div class="row"><button class="btn primary" type="submit">' + (ready ? 'Ayarları kaydet' : 'Bağlan ve yedekle') + '</button>' + (ready ? '' : '<button class="btn" type="button" data-act="bkRestoreAsk">Buluttan geri yükle</button>') + '</div>' +
    '<p class="note">Yedek şifresini unutursan yedek açılamaz. Anahtar ve şifre yalnızca bu telefonda saklanır, yedeğin içine girmez.</p></form>' +
    '<details class="panel"><summary>GitHub\'da depo ve anahtar nasıl hazırlanır?</summary><ol class="steps">' +
    '<li>github.com → sağ üstte <b>+</b> → <b>New repository</b>. Ad: <code>alyssa-yedek</code>, <b>Private</b> seç, oluştur.</li>' +
    '<li>Profil resmi → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>' +
    '<li>Repository access: <b>Only select repositories</b> → <code>alyssa-yedek</code>. Permissions → <b>Contents: Read and write</b>.</li>' +
    '<li>Oluşan <code>github_pat_…</code> anahtarını buraya yapıştır. Süresi dolarsa uygulama haber verir; yenisini yapıştırman yeter.</li></ol></details>' +
    '</div>';
}
// ---- Özel paket
function sheetPackage(){
  const on = pkgOn();
  return sheetBar('Özel paket') + '<div class="stack">' +
    '<p class="sub">Özel paket, sahibinin şifresiyle açılan şifreli bir rig sistemidir (rigler, envanter kalemleri, kayıtlı konumlar). Şifre yalnızca bir kez girilir; telefon hatırlar.</p>' +
    (on ? '<div class="panel stack"><b>Açık · ' + esc(S.systems.ozel.name) + '</b><span class="note">' + D.rigs.length + ' rig · ' + D.items.length + ' kalem · veri sürümü ' + esc(D.meta.data_version || '') + '</span>' +
      '<div class="row"><button class="btn" type="button" data-act="pkgCheck">Güncellemeyi denetle</button></div></div>' : '') +
    (S.pkg.need ? '<div class="banner">Paket güncellendi ama bu telefondaki anahtar eski şifreye ait. Yeni şifreyi bir kez gir.</div>' : '') +
    (!on || S.pkg.need ? '<form class="panel stack" id="pkgForm" novalidate><label class="f">Şifre<input id="pk-pass" type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
      '<p class="err" id="pkErr" hidden></p><div class="row"><button class="btn primary" type="submit" id="pkBtn">Aç</button></div></form>' : '') +
    '</div>';
}
async function submitPkg(){
  const pass = $('pk-pass').value; const btn = $('pkBtn'); btn.disabled = true; btn.textContent = 'Açılıyor…'; $('pkErr').hidden = true;
  const r = await pkgUnlock(pass);
  btn.disabled = false; btn.textContent = 'Aç';
  if (!r.ok) { $('pkErr').textContent = r.err; $('pkErr').hidden = false; return false; }
  importPackage(D); indexAll(); closeSheet(); renderAll(); loadWeather(); toast('Özel paket açıldı: ' + D.rigs.length + ' rig');
  return true;
}
// ---- Konumlar
function sheetLocations(){
  const ccount = id => CATCHES.filter(c => c.loc && distKm(c.loc, S.locations[id]) <= 0.5).length;
  const list = Object.values(S.locations);
  return sheetBar('Konumlar') + '<div class="stack">' +
    (list.length ? list.map(L => '<div class="item"><div class="row" style="justify-content:space-between;align-items:flex-start"><div style="min-width:0;flex:1"><input class="nameedit" data-lk="' + esc(L.id) + '" data-f="name" value="' + esc(L.name) + '" aria-label="Konum adı">' +
      '<div class="sp mono">' + fmtCoord(L.lat, L.lon, true) + (ccount(L.id) ? ' · ' + ccount(L.id) + ' av' : '') + '</div>' +
      (L.sea && L.sea.lat != null ? '<div class="sp">Deniz verisi ' + f1(L.sea.km) + ' km ' + dir8(L.sea.dir) + ' yönündeki noktadan</div>' : '') + '</div>' +
      (S.active === L.id ? '<span class="chip A">Seçili</span>' : '<button class="btn small" type="button" data-use="' + esc(L.id) + '">Seç</button>') + '</div>' +
      '<div class="fields"><label class="f">Dip<select data-lk="' + esc(L.id) + '" data-f="bottom">' + BOTTOM.map(([k, t]) => '<option value="' + k + '"' + (k === (L.bottom || '') ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
      '<label class="f">Derinlik (m)<input data-lk="' + esc(L.id) + '" data-f="depth" inputmode="decimal" value="' + esc(L.depth || '') + '" placeholder="—"></label></div>' +
      (list.length > 1 ? '<div><button class="btn small" type="button" data-del="' + esc(L.id) + '">Sil</button></div>' : '') + '</div>').join('') : '<div class="empty">Henüz konum yok.</div>') +
    '<form class="panel" id="locForm" novalidate><h4 style="font-size:16px">Yeni konum</h4><div class="fields" style="margin-top:8px">' +
    '<label class="f wide">Ad<input id="nl-name" placeholder="Ör. Sığacık açığı"></label>' +
    '<label class="f">Enlem (°)<input id="nl-lat" inputmode="decimal" placeholder="ör. 38.1234"></label>' +
    '<label class="f">Boylam (°)<input id="nl-lon" inputmode="decimal" placeholder="ör. 26.5678"></label>' +
    '<label class="f">Dip (biliyorsan)<select id="nl-bottom">' + BOTTOM.map(([k, t]) => '<option value="' + k + '">' + t + '</option>').join('') + '</select></label>' +
    '<label class="f">Derinlik (m)<input id="nl-depth" inputmode="decimal" placeholder="—"></label></div>' +
    '<p class="err" id="locErr" hidden></p><div class="row" style="margin-top:10px"><button class="btn primary" type="submit">Kaydet</button><button class="btn" type="button" data-act="gpsfill">Bulunduğum yer</button></div>' +
    '<p class="note" style="margin-top:8px">Nokta karadaysa ya da kıyıya çok yakınsa dalga ve akıntı en yakın deniz noktasından alınır.</p></form></div>';
}
function addLocation(name, lat, lon, bottom, depth){
  const id = nextLocId();
  S.locations[id] = {id, name: name || 'Konum ' + id, lat, lon, bottom: bottom || '', depth: depth || ''};
  S.active = id; S.onboarded = true; persist(); WX = null; return id;
}
// ---- Alışveriş
function sheetShopping(){
  const groups = {};
  shoppingList().forEach(n => { const it = n.item && ITEMS[n.item]; const st = (it && it.store) || n.store || (it ? 'Envanter' : 'Yeni'); (groups[st] = groups[st] || []).push(n); });
  const SN = {Envanter: 'Yeniden alınacak', Yeni: 'Envanterde olmayanlar'};
  if (pkgOn() && Array.isArray(D.stores)) D.stores.forEach(st => { SN[st.id] = st.name + ' (' + st.id + ')'; });
  const body = Object.keys(groups).sort().map(g => '<div class="eyebrow">' + esc(SN[g] || 'Mağaza ' + g) + '</div>' + groups[g].map(n => {
    const it = n.item && ITEMS[n.item]; const k = n.item ? n.item + '|' + (n.size || '-') : null;
    return '<div class="item"><div class="row" style="justify-content:space-between"><div class="nm">' + esc(it ? it.name : n.name) + ' <b class="mono">' + esc(n.size || '') + '</b></div><span class="chip">' + n.rigs.length + ' rigde</span></div>' +
      '<div class="sp">' + esc(n.rigs.join(', ')) + (it && it.note ? ' · ' + esc(it.note) : '') + '</div>' +
      (k ? '<div class="row"><label class="f" style="flex-direction:row;align-items:center;gap:8px">Aldığım (adet)<input style="width:90px" data-qk="' + esc(k) + '" inputmode="numeric" placeholder="0"></label></div>' :
        (n.sp ? '<div class="row"><button class="btn small" type="button" data-buyadd="' + esc(n.k) + '">Aldım, envantere ekle</button></div>' : '')) + '</div>';
  }).join('')).join('');
  return sheetBar('Alışveriş listesi') + '<div class="stack"><p class="note">Rigleri tamamlamak için gerekenler. Aldığında adedini gir; ilgili rigler hemen tamamlanır.</p>' + (body || '<div class="empty">Eksik kalem yok, tüm rigler tamam.</div>') + '</div>';
}
function sheetStandards(){
  const rows = Object.values(SETUPS).map(s => { const st = s.standard_cm; return '<tr><td>' + esc(s.name) + '</td><td>' + st.ust + '</td><td>' + st.orta + '</td><td>' + st.hirsiz + '</td><td>' + st.aralik + '</td><td>' + st.kursun_g.join('–') + '</td><td>' + st.kursun_max_g + '</td></tr>'; }).join('');
  return sheetBar('Takım standartları') + '<div class="stack">' + (rows ? '<div class="tbl panel"><table><thead><tr><th>Takım</th><th>Üst köstek (cm)</th><th>Orta köstek (cm)</th><th>Hırsız (cm)</th><th>Köstek arası (cm)</th><th>Kurşun (g)</th><th>Kamış sınırı (g)</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="note">Akıntı 0,5 knot (kn) üstündeyse kurşun +30 g ve hırsız köstek %20 kısa; kurşun kamış sınırını aşmaz. Kayalık rigler kendi kısa kösteklerini kullanır.</p>' : '<div class="empty">Henüz standardı olan bir rig sistemi yok.</div>') + '</div>';
}
function sheetFile(){
  return sheetBar('Dosya yedeği') + '<div class="stack"><p class="sub">Profilini ve avlarını tek dosya olarak indir ya da bir dosyadan geri yükle. Bulut yedeği açıksa buna genelde gerek kalmaz.</p>' +
    '<label class="row note chk"><input type="checkbox" id="bkPhotos"> Fotoğrafları da dosyaya kat (dosya büyür)</label>' +
    (PREVIEW ? '<p class="note">Dosya yedeği telefona kurulan uygulamada çalışır.</p>' : '<div class="row"><button class="btn" id="exportBtn" type="button" data-act="export">Yedeği indir</button><label class="btn filebtn">Yedeği yükle<input type="file" id="importFile" accept="application/json,.json"></label></div>') +
    '<p class="note" id="bkNote"></p></div>';
}
function sheetSources(){
  const stt = (S.wx && S.wx.status) || {};
  const sea = WX && WX.sea;
  return sheetBar('Veri kaynakları') + '<div class="stack"><div class="panel"><div class="srcs">' + Object.keys(SRC).map(id => { const s = stt[id]; return '<span class="' + (s === 'ok' ? 'ok' : s ? 'no' : '') + '">' + (s === 'ok' ? '✓' : s ? '✗' : '·') + ' ' + esc(SRC[id].label) + ' — ' + esc(SRC[id].what) + (s && s !== 'ok' ? ' (' + esc(s) + ')' : '') + '</span>'; }).join('') +
    (S.wx && S.wx.at ? '<span>Son güncelleme: ' + hm(new Date(S.wx.at)) + '</span>' : '') + (sea ? '<span>Deniz verisi ' + f1(sea.km) + ' km ' + dir8(sea.dir) + ' yönündeki en yakın deniz noktasından</span>' : '') + '</div>' +
    '<p class="note" style="margin-top:8px">Rüzgâr: ICON-EU 7 km (yaklaşık 5 gün), sonrası ECMWF. Hamle: GFS. Yağış olasılığı: topluluk (ensemble) modelleri. Dalga: MFWAM (Météo-France, 10 gün), sonrası en iyi deniz modeli. Akıntı ve su sıcaklığı: Météo-France (10 gün). Hepsi Open-Meteo üzerinden, telefonun kendisi çeker. Bir kaynak 15 saniyede yanıt vermezse atlanır.</p></div>' +
    '<button class="btn" type="button" data-act="refreshWx">Şimdi yenile</button></div>';
}
function sheetChangelog(){
  return sheetBar('Sürüm notları') + '<div class="stack">' + CHANGELOG.map(c => '<div class="panel"><b>v' + c.v + '</b><ul class="steps">' + c.notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul></div>').join('') + '</div>';
}
// ---- dosya yedeği
async function blobToDataUrl(b){ return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
async function dataUrlToBlob(u){ const r = await fetch(u); return r.blob(); }
async function exportBackup(){
  const withPhotos = $('bkPhotos') && $('bkPhotos').checked;
  const st = JSON.parse(JSON.stringify(S)); st.wx = null;
  const out = {app: 'alyssa', version: APP_VERSION, exported: new Date().toISOString(), state: st, catches: CATCHES};
  if (withPhotos) { out.photos = {}; for (const c of CATCHES) for (const pid of (c.photos || [])) { const p = await IDB.get('photos', pid); if (p) out.photos[pid] = {big: await blobToDataUrl(p.big), thumb: await blobToDataUrl(p.thumb)}; } }
  const blob = new Blob([JSON.stringify(out)], {type: 'application/json'});
  const name = 'alyssa-yedek-' + new Date().toISOString().slice(0, 10) + '.json';
  try {
    const f = new File([blob], name, {type: 'application/json'});
    if (navigator.canShare && navigator.canShare({files: [f]})) { await navigator.share({files: [f], title: APP_SHORT + ' yedeği'}); $('bkNote').textContent = 'Yedek paylaşıldı.'; return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  $('bkNote').textContent = 'Yedek indirildi (' + Math.round(blob.size / 1024) + ' KB).';
}
async function importBackup(file){
  try {
    const j = JSON.parse(await file.text());
    if (j.app === 'kenny-av' && j.state) { const st = newState(); migrateV1(st, Object.assign({v: 1}, j.state)); S = normalizeState(Object.assign(st, {onboarded: true})); }
    else if (j.app === 'alyssa' && j.state) { S = normalizeState(Object.assign(newState(), j.state)); }
    else throw new Error('x');
    persist();
    if (j.photos) for (const pid of Object.keys(j.photos)) await IDB.put('photos', {id: pid, big: await dataUrlToBlob(j.photos[pid].big), thumb: await dataUrlToBlob(j.photos[pid].thumb)});
    if (Array.isArray(j.catches)) for (const c of j.catches) await IDB.put('catches', c);
    pkgLoadCached(); indexAll(); applyTheme(); await loadCatches(); renderAll(); loadWeather(true);
    $('bkNote').textContent = 'Yedek yüklendi' + (j.catches ? ' · ' + j.catches.length + ' av' : '') + '.';
  } catch (e) { $('bkNote').textContent = 'Bu dosya ' + APP_SHORT + ' yedeği değil.'; }
}
