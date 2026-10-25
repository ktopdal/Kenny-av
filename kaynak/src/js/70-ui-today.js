// ---------------------------------------------------------------- 70 · Bugün ekranı (saatlik tablo, anlık durum, solunar, öneri)
const ui = {rigSeg: 'all', q: '', inv: 'hook', hday: null, sys: 'all', sheet: null, sheetArg: null};
function dayLabel(d, i, todayKey){
  const k = dateKey(d); const tm = new Date(); tm.setDate(tm.getDate() + 1);
  if (k === todayKey) return 'Bugün'; if (k === dateKey(tm)) return 'Yarın';
  return DOW[d.getDay()] + ' ' + d.getDate();
}
function modelText(arr){ const u = [...new Set(arr.filter(Boolean))]; return u.length ? u.join(' / ') : '–'; }
// Bugün ekranının kartları ve takvim satırları (Görünüm sayfasından açılıp kapatılır, sırası değiştirilir)
// Solunar, Bunu bağla ve Sürüklenme ve kurşun v0.16'da Fishing sekmesine taşındı
const TCARDS = [
  {id: 'saatlik', t: 'Saatlik tablo'},
  {id: 'anlik', t: 'Şu an ve deniz sınıfı'},
];
const CROWS = [
  {id: 'ruzgar', t: 'Rüzgâr'}, {id: 'hamle', t: 'Hamle'}, {id: 'dalga', t: 'Dalga'}, {id: 'akinti', t: 'Akıntı'}, {id: 'su', t: 'Su sıcaklığı'},
  {id: 'hava', t: 'Hava sıcaklığı'}, {id: 'basinc', t: 'Basınç'}, {id: 'yagis', t: 'Yağış'}, {id: 'pencere', t: 'Balık ve en iyi pencere'}, {id: 'guven', t: 'Güven ve modeller'},
];
function applyCards(){
  const box = $('todayCards'); if (!box) return;
  const order = orderedRows(TCARDS, S.settings.cards);
  order.forEach(c => { const el = box.querySelector('.tcard[data-card="' + c.id + '"]'); if (el) { box.appendChild(el); el.hidden = !c.on; } });
}
function renderToday(){
  $('previewNote').hidden = !PREVIEW;
  const land = landMode();
  $('todayTitle').textContent = land ? 'Hava durumu' : shoreMode() ? 'Bugün kıyıda' : 'Bugün denizde';
  $('landNote').hidden = !land; $('landNote').innerHTML = land ? landPanel() : '';
  $('fcta').hidden = land;
  applyCards();
  const L = loc();
  $('noLoc').hidden = !!L;
  $('noLoc').innerHTML = L ? '' : '<div class="panel stack"><h3>Önce bir konum ekle</h3><p class="sub">Hava, deniz ve solunar bilgisi seçtiğin noktaya göre hesaplanır. Bulunduğun yeri al ya da koordinat gir.</p>' +
    '<div class="row"><button class="btn primary" type="button" data-act="gpsloc">Bulunduğum yer</button><button class="btn" type="button" data-open="konumlar">Koordinat gir</button></div></div>';
  renderHourly();
  const ds = days(); const now = new Date(); const todayKey = dateKey(now);
  const dd = ds.find(d => d.key === todayKey) || ds[0];
  if (!dd) {
    $('nowGrid').innerHTML = L ? '<div class="empty" style="grid-column:1/-1">' + (land ? 'Hava' : 'Hava ve deniz') + ' verisi henüz yok. İnternete bağlanınca kendiliğinden gelir.</div>' : '';
    $('classRow').innerHTML = ''; return;
  }
  $('todayLbl').textContent = DOW[dd.date.getDay()] + ' · ' + dd.date.getDate() + ' ' + MONTHS[dd.date.getMonth()];
  const cur = dd.hs.reduce((b, x) => Math.abs(x.t - now) < Math.abs(b.t - now) ? x : b, dd.hs[0]);
  const M = (k, v, u, s, ic) => '<div class="metric"><span class="k">' + (ic ? akI(ic, 'm-ic') : '') + k + '</span><span class="v">' + v + ' <small>' + u + '</small></span><span class="s">' + s + '</span></div>';
  // Rüzgâr kartı Karma satırıyla aynı (Karma: ICON-EU, yedeğe geçmez); Hamle ayrı kartta, kendi modeliyle (Karma: GFS)
  const u = windU(), ul = u === 'bft' ? windU2() : u;
  const sub = (v, d) => v == null ? 'model yok' : windNum(v, ul) + ' ' + WU_TXT[ul] + (d == null ? '' : ' ' + windName(d));
  const big = v => { const b = bft(v); return b == null ? '–' : '<span class="bftb big" style="' + bftStyle(b) + '">' + b + '</span>'; };
  const kId = cur.wkid || 'icon', gId = cur.gid;
  const gDir = gId && cur.m && cur.m[gId] && cur.m[gId].d != null ? cur.m[gId].d : cur.wdir;
  if (land) {   // kara: yalnız hava durumu
    const pops = dd.hs.map(x => x.pop).filter(v => v != null);
    $('nowGrid').innerHTML =
      M('Rüzgâr ' + mBadge(SRC[kId].short), big(cur.wk), 'Bft', sub(cur.wk, cur.wkd), 'wind') +
      M('Hamle ' + mBadge(gId ? (SRC[gId] ? SRC[gId].short : 'En iyi') : '–'), big(cur.gust), 'Bft', sub(cur.gust, gDir), 'gust') +
      M('Sıcaklık', cur.temp == null ? '–' : tempV(cur.temp), TU(), 'gün ' + tempV(dd.tmin) + '–' + tempV(dd.tmax) + ' ' + TU(), 'thermo') +
      M('Yağış', cur.pop == null ? '–' : '%' + Math.round(cur.pop), '', 'gün en çok %' + (pops.length ? Math.round(Math.max(...pops)) : '–') + (dd.rain >= 0.1 ? ' · ' + f1(dd.rain) + ' mm' : ' · yağış yok'), 'rain') +
      M('Bulut', cur.cloud == null ? '–' : '%' + Math.round(cur.cloud), '', cur.cloud == null ? '' : cur.cloud < 20 ? 'açık' : cur.cloud < 60 ? 'parçalı bulutlu' : cur.cloud < 90 ? 'çok bulutlu' : 'kapalı', 'cloud') +
      M('Basınç', cur.press == null ? '–' : Math.round(pressNum(cur.press)), pressU() === 'mmhg' ? 'mmHg' : 'hPa', cur.dp3 == null ? '' : '3 saatte ' + (cur.dp3 >= 0.5 ? '↑ yükseliyor' : cur.dp3 <= -0.5 ? '↓ düşüyor' : '→ durgun'), 'gauge');
    $('classRow').innerHTML = '';
    return;
  }
  $('nowGrid').innerHTML =
    M('Rüzgâr ' + mBadge(SRC[kId].short), big(cur.wk), 'Bft', sub(cur.wk, cur.wkd), 'wind') +
    M('Hamle ' + mBadge(gId ? (SRC[gId] ? SRC[gId].short : 'En iyi') : '–'), big(cur.gust), 'Bft', sub(cur.gust, gDir), 'gust') +
    M('Dalga', f1(cur.wave), 'm', cur.per != null ? Math.round(cur.per) + ' sn ' + windName(cur.waveDir) + ' · gün en çok ' + f1(dd.wave) + ' m' : 'model yok', 'wave') +
    M('Akıntı', f1(cur.cur), 'kn', cur.cur != null ? dir8(cur.curDir) + ' yönüne' : 'model yok', 'current') +
    M('Su sıcaklığı', cur.sst == null ? '–' : tempV(cur.sst, true), TU(), 'gün ort. ' + tempTxt(dd.sst, true), 'drop') +
    M('Hava', cur.temp == null ? '–' : tempV(cur.temp), TU(), pressTxt(cur.press) + (cur.dp3 == null ? '' : ' ' + (cur.dp3 >= 0.5 ? '↑' : cur.dp3 <= -0.5 ? '↓' : '→')), 'thermo');
  const cl = (c, lbl, w) => c ? '<div class="cls ' + c + '"><b>' + c + '</b><span><b style="font:600 13px var(--body)">' + lbl + '</b><br>' + CLS_TXT[c] + ' · en çok ' + bft(w) + ' Bft</span></div>' : '';
  $('classRow').innerHTML = cl(dd.clsD, 'Gündüz', dd.wd) + cl(dd.clsN, 'Gece', dd.wn);
}
// kara noktasında Bugün ve Fishing'de gösterilen not: av için deniz ya da kıyı noktası seç
function landPanel(){
  const sea = Object.values(S.locations).filter(L => locKind(L) !== 'kara');
  return '<div class="panel landnote stack"><h3>Kara noktası · yalnız hava durumu</h3><p class="sub">Bu nokta karada: balık tahmini, rig önerisi, su sıcaklığı, dalga ve akıntı gösterilmez. Av için denizde ya da kıyıda bir nokta seç.</p>' +
    (sea.length ? '<div class="row wrap">' + sea.slice(0, 4).map(L => '<button class="btn small" type="button" data-use="' + esc(L.id) + '">' + esc(locLabel(L)) + '</button>').join('') + '</div>' : '') +
    '<div class="row wrap"><button class="btn primary" type="button" data-open="harita">Haritadan nokta seç</button><button class="btn" type="button" data-open="konumlar">Türünü değiştir</button></div></div>';
}
const skipTxt = k => hm(k.t) + ' civarında balık daha yüksek (%' + k.pct + ') ama deniz ' + (k.cls || 'bilinmiyor') + '; sakin deniz öne alındı.';
// pencere satırı: saat aralığı, balık, olaylar, deniz sınıfı (takvim, Bugün ve öneriler aynı hesabı gösterir)
function winRow(lbl, w){
  return '<div class="win"><span class="t">' + (lbl ? '<small>' + esc(lbl) + '</small>' : '') + winTxt(w) + '</span><span class="chips">' + fishHtml(w.fish) + '<b class="wpct">%' + w.pct + '</b>' +
    (w.cls ? '<span class="chip ' + w.cls + '">deniz ' + w.cls + '</span>' : '') + w.evs.map(e => '<span class="chip gold" title="' + esc(EV_LONG[e.e] || '') + '">' + esc(evChip(e)) + '</span>').join('') + '</span>' +
    (w.skipped ? '<span class="note wskip">' + skipTxt(w.skipped) + '</span>' : '') + '</div>';
}
// ---- takvimde en çok 3 nokta: seçim, diğer noktaların verisi ve gün gün karşılaştırma
const CAL_MAX = 3;
function calLocs(){
  const ids = (S.settings.calLocs || []).filter(id => S.locations[id]);
  return ids.length ? ids : (S.active && S.locations[S.active] ? [S.active] : []);
}
function toggleCalLoc(id){
  let ids = calLocs().slice();
  if (ids.includes(id)) { if (ids.length > 1) ids = ids.filter(x => x !== id); }
  else { if (ids.length >= CAL_MAX) { toast('En çok ' + CAL_MAX + ' nokta karşılaştırılır; önce birini çıkar'); return; } ids.push(id); }
  S.settings.calLocs = ids; ui.calTab = null; persist(); renderCalendar();
}
// başka bir konumun günlerini hesapla: genel durum (seçili konum, veri) geçici olarak o konuma çevrilir, sonra geri alınır
function withLoc(L, w, fn){
  const sv = {a: S.active, wx: S.wx, WX, DC: DAYS_CACHE};
  try { S.active = L.id; S.wx = w; WX = buildWx(); DAYS_CACHE = null; return fn(); }
  finally { S.active = sv.a; S.wx = sv.wx; WX = sv.WX; DAYS_CACHE = sv.DC; }
}
const CAL_SUM = {};
// takvim değerlerinin ne olduğu (takvim altına)
function calLegend(){
  const m = S.settings.model || 'karma';
  const src = m === 'karma' ? 'Karma: rüzgâr ICON-EU (yoksa ECMWF), hamle GFS' : 'model ' + (SRC[m] ? SRC[m].short : m);
  return '<p class="note callegend">Rüzgâr ve hamle: gündüz (07–18) / gece (19–06) en yüksek değer · ' + esc(src) + '. ' + (landMode() ? 'Basınç: gün ortalaması' : 'Dalga ve akıntı: günün en yükseği · su ve basınç: gün ortalaması') + ' · hava: en düşük–en yüksek · yağış: günün en yüksek ihtimali.</p>';
}
function locSummary(L){
  const w = L.id === S.active ? S.wx : MWX[L.id];
  if (!w || !w.raw) return null;
  const sig = w.at + '|' + locKind(L) + '|' + (S.settings.model || '') + '|' + S.mode + '|' + (L.facing || '') + '|' + (L.bottom || '');
  if (CAL_SUM[L.id] && CAL_SUM[L.id].sig === sig) return CAL_SUM[L.id].days;
  const make = () => days().slice(0, 16).map(dd => {
    const land = locKind(L) === 'kara', win = land ? null : windows(dd)[0] || null;
    const worst = [dd.clsD, dd.clsN].filter(Boolean).sort().pop() || null;
    const score = land || !win ? 0 : win.pct * (SEA_F[win.cls || worst] || 0.5);
    return {key: dd.key, date: dd.date, idx: dd.idx, wd: dd.wd, wn: dd.wn, gust: dd.gust, gD: dd.gD, gN: dd.gN, wave: dd.wave, clsD: dd.clsD, clsN: dd.clsN, tmin: dd.tmin, tmax: dd.tmax, pop: dd.pop, rain: dd.rain,
      wx: akDayWx(dd), dir: akDir(dd), sst: dd.sst, stars: dd.sol.stars,
      land, win: win ? {pct: win.pct, fish: win.fish, a: win.a, b: win.b, cls: win.cls} : null, score};
  });
  const out = L.id === S.active ? make() : withLoc(L, w, make);
  CAL_SUM[L.id] = {sig, days: out};
  return out;
}
function renderCalPick(){
  const el = $('calPick'); if (!el) return;
  const all = Object.values(S.locations), sel = calLocs();
  if (all.length < 2) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="eyebrow">Noktalar · en çok ' + CAL_MAX + '</div><div class="seg wrapseg">' + all.map(L => '<button class="btn small" type="button" data-calloc="' + esc(L.id) + '" aria-pressed="' + sel.includes(L.id) + '">' +
    esc(locLabel(L)) + ' <em class="kd ' + locKind(L) + '">' + KIND_TXT[locKind(L)] + '</em></button>').join('') + '</div>';
}
