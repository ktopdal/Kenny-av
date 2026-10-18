// ---------------------------------------------------------------- 70 · Bugün ekranı (saatlik tablo, anlık durum, solunar, öneri)
const ui = {rigSeg: 'all', q: '', inv: 'hook', hday: null, sys: 'all', sheet: null, sheetArg: null};
function dayLabel(d, i, todayKey){
  const k = dateKey(d); const tm = new Date(); tm.setDate(tm.getDate() + 1);
  if (k === todayKey) return 'Bugün'; if (k === dateKey(tm)) return 'Yarın';
  return DOW[d.getDay()] + ' ' + d.getDate();
}
function modelText(arr){ const u = [...new Set(arr.filter(Boolean))]; return u.length ? u.join(' / ') : '–'; }
function bftLegend(){
  const p = bftPal();
  return '<div class="bftscale" role="img" aria-label="Rüzgâr renkleri, 0 ile 12 Bft arası">' + p.map((c, i) => '<span style="background:' + c + ';color:' + textOn(c) + '">' + i + '</span>').join('') + '</div>' +
    '<div class="legend"><span><i style="background:var(--A-bg);border:1px solid var(--A)"></i>dalga &lt;0,5 m</span><span><i style="background:var(--B-bg);border:1px solid var(--B)"></i>0,5–1 m</span>' +
    '<span><i style="background:var(--C-bg);border:1px solid var(--C)"></i>1–1,5 m</span><span><i style="background:var(--D-bg);border:1px solid var(--D)"></i>1,5 m+</span></div>';
}
function renderHourly(){
  const ds = days(); const tbl = $('hTable');
  $('hLegend').innerHTML = bftLegend();
  $('hourly').hidden = !loc();
  if (!ds.length) { $('dayChips').innerHTML = ''; tbl.innerHTML = ''; $('hEmpty').hidden = false; $('hourlyNote').textContent = ''; $('seaNote').hidden = true; return; }
  $('hEmpty').hidden = true;
  const now = new Date(), todayKey = dateKey(now);
  if (!ui.hday || !ds.find(d => d.key === ui.hday)) ui.hday = ds.find(d => d.key === todayKey) ? todayKey : ds[0].key;
  $('dayChips').innerHTML = ds.slice(0, 16).map((d, i) => '<button class="btn small" data-hday="' + d.key + '" aria-pressed="' + (d.key === ui.hday) + '">' + dayLabel(d.date, i, todayKey) + '</button>').join('');
  const dd = ds.find(d => d.key === ui.hday); const hs = dd.hs;
  const isToday = dd.key === todayKey, nowH = now.getHours();
  const cls = (x, extra) => 'c' + (x.h < 7 || x.h >= 19 ? ' night' : '') + (isToday && x.h === nowH ? ' curh' : '') + (extra ? ' ' + extra : '');
  const row = (label, sub, cells, trc) => '<tr' + (trc ? ' class="' + trc + '"' : '') + '><th class="lbl" scope="row"><b>' + label + '</b><small>' + sub + '</small></th>' + cells + '</tr>';
  const acts = hs.map(activity);
  const wcell = (x, v) => { const b = bft(v); return '<td class="' + cls(x, b == null ? '' : 'bf') + '"' + (b == null ? '' : ' style="' + bftStyle(b) + '"') + '>' + (b == null ? '–' : b) + '<small>' + kn(v) + ' kn</small></td>'; };
  const rows = [];
  rows.push(row('Saat', 'yerel saat', hs.map(x => '<td class="' + cls(x) + '">' + pad(x.h) + '</td>').join(''), 'hours'));
  rows.push(row('Hava', 'bulut · yağış', hs.map(x => '<td class="' + cls(x) + '">' + wxIcon(x) + '</td>').join('')));
  rows.push(row('Balık', 'tahmini aktivite % · her balık %20', hs.map((x, i) => '<td class="' + cls(x, 'fish' + (acts[i].pct >= 61 ? ' hi' : '')) + '">' + fishHtml(acts[i].fish) + '<small>%' + acts[i].pct + '</small></td>').join('')));
  rows.push(row('Solunar', 'M major · m minor', hs.map((x, i) => '<td class="' + cls(x, 'sol') + '">' + esc(acts[i].tags.join(' ')) + '</td>').join('')));
  rows.push(row('Yağış', 'olasılık %', hs.map(x => '<td class="' + cls(x, (x.pop || 0) < 10 ? 'p0' : '') + '">' + (x.pop == null ? '–' : Math.round(x.pop)) + '</td>').join('')));
  rows.push(row('Yağış', 'mm', hs.map(x => '<td class="' + cls(x, (x.rain || 0) < 0.1 ? 'p0' : '') + '">' + (x.rain == null ? '–' : x.rain < 0.1 ? '0' : f1(x.rain)) + '</td>').join('')));
  rows.push(row('Sıcaklık', 'hava °C', hs.map(x => '<td class="' + cls(x) + '">' + f0(x.temp) + '</td>').join('')));
  rows.push(row('Rüzgâr', 'Bft · ' + modelText(hs.map(x => x.wm)), hs.map(x => wcell(x, x.wind)).join('')));
  rows.push(row('Yön', 'ok gidiş · harf geliş', hs.map(x => '<td class="' + cls(x) + '">' + arrowFrom(x.wdir) + '<small>' + dir8(x.wdir) + '</small></td>').join('')));
  rows.push(row('Hamle', 'Bft · ' + modelText(hs.map(x => x.gm)), hs.map(x => wcell(x, x.gust)).join('')));
  rows.push(row('Dalga', 'm · ' + modelText(hs.map(x => x.wvm)), hs.map(x => '<td class="' + cls(x, x.wave == null ? '' : 'b' + waveClass(x.wave)) + '">' + f1(x.wave) + '</td>').join('')));
  rows.push(row('Periyot', 'sn · dalga yönü', hs.map(x => '<td class="' + cls(x) + '">' + (x.per == null ? '–' : Math.round(x.per)) + '<small>' + arrowFrom(x.waveDir) + '</small></td>').join('')));
  rows.push(row('Akıntı', 'kn · gittiği yön', hs.map(x => '<td class="' + cls(x) + '">' + f1(x.cur) + '<small>' + arrowTo(x.curDir) + '</small></td>').join('')));
  const anch = S.settings.anchor === 'demir';
  rows.push(row(anch ? 'İpe akış' : 'Sürüklenme', anch ? 'kn · demirli' : 'kn · teknenin gidişi', hs.map(x => { const dr = driftAt(x); return '<td class="' + cls(x) + '">' + (dr && dr.known ? f1(anch ? dr.line : dr.sog) + (anch ? '' : '<small>' + arrowTo(dr.dir) + '</small>') : '–') + '</td>'; }).join('')));
  rows.push(row('Su', '°C', hs.map(x => '<td class="' + cls(x) + '">' + f1(x.sst) + '</td>').join('')));
  rows.push(row('Basınç', 'hPa · 3 sa değişim', hs.map(x => '<td class="' + cls(x) + '">' + f0(x.press) + '<small>' + (x.dp3 == null ? '' : (x.dp3 > 0 ? '+' : '') + f1(x.dp3)) + '</small></td>').join('')));
  tbl.innerHTML = '<tbody>' + rows.join('') + '</tbody>';
  const sea = WX && WX.sea;
  $('hourlyNote').textContent = (S.wx && S.wx.at ? (PREVIEW ? 'örnek veri' : 'güncel ' + hm(new Date(S.wx.at))) : '') + ' · güven ' + dd.conf;
  $('seaNote').hidden = !sea;
  if (sea) $('seaNote').textContent = 'Bu nokta karada ya da kıyıya çok yakın: dalga, akıntı ve su sıcaklığı ' + f1(sea.km) + ' km ' + dir8(sea.dir) + ' yönündeki en yakın deniz noktasından.';
  if (isToday) { const sc = $('hScroll'); const i = hs.findIndex(x => x.h === nowH); if (i > 1) requestAnimationFrame(() => { sc.scrollLeft = (i - 1) * 46; }); }
  else $('hScroll').scrollLeft = 0;
}
function renderToday(){
  $('previewNote').hidden = !PREVIEW;
  const L = loc();
  $('noLoc').hidden = !!L;
  $('noLoc').innerHTML = L ? '' : '<div class="panel stack"><h3>Önce bir konum ekle</h3><p class="sub">Hava, deniz ve solunar bilgisi seçtiğin noktaya göre hesaplanır. Bulunduğun yeri al ya da koordinat gir.</p>' +
    '<div class="row"><button class="btn primary" type="button" data-act="gpsloc">Bulunduğum yer</button><button class="btn" type="button" data-open="konumlar">Koordinat gir</button></div></div>';
  renderHourly();
  const ds = days(); const now = new Date(); const todayKey = dateKey(now);
  const dd = ds.find(d => d.key === todayKey) || ds[0];
  if (!dd) {
    $('nowGrid').innerHTML = L ? '<div class="empty" style="grid-column:1/-1">Hava ve deniz verisi henüz yok. İnternete bağlanınca kendiliğinden gelir.</div>' : '';
    $('classRow').innerHTML = ''; $('solWins').innerHTML = ''; $('solSub').textContent = ''; $('solStars').innerHTML = ''; $('solPanel').hidden = true;
    renderDrift(null); renderRecs(null); return;
  }
  $('solPanel').hidden = false;
  $('todayLbl').textContent = DOW[dd.date.getDay()] + ' · ' + dd.date.getDate() + ' ' + MONTHS[dd.date.getMonth()];
  const cur = dd.hs.reduce((b, x) => Math.abs(x.t - now) < Math.abs(b.t - now) ? x : b, dd.hs[0]);
  const M = (k, v, u, s) => '<div class="metric"><span class="k">' + k + '</span><span class="v">' + v + ' <small>' + u + '</small></span><span class="s">' + s + '</span></div>';
  const bw = bft(cur.wind);
  $('nowGrid').innerHTML =
    M('Rüzgâr', bw == null ? '–' : '<span class="bftb big" style="' + bftStyle(bw) + '">' + bw + '</span>', 'Bft', kn(cur.wind) + ' kn ' + dir8(cur.wdir) + ' · hamle ' + (cur.gust == null ? '–' : bft(cur.gust) + ' Bft')) +
    M('Dalga', f1(cur.wave), 'm', cur.per != null ? Math.round(cur.per) + ' sn · gün en çok ' + f1(dd.wave) + ' m' : 'model yok') +
    M('Akıntı', f1(cur.cur), 'kn', cur.cur != null ? dir8(cur.curDir) + ' yönüne' : 'model yok') +
    M('Su', f1(cur.sst), '°C', 'hava ' + f1(cur.temp) + ' °C · ' + f0(cur.press) + ' hPa');
  const cl = (c, lbl, w) => c ? '<div class="cls ' + c + '"><b>' + c + '</b><span><b style="font:600 13px var(--body)">' + lbl + '</b><br>' + CLS_TXT[c] + ' · en çok ' + bft(w) + ' Bft</span></div>' : '';
  $('classRow').innerHTML = cl(dd.clsD, 'Gündüz', dd.wd) + cl(dd.clsN, 'Gece', dd.wn);
  $('solStars').innerHTML = starsHtml(dd.sol.stars);
  $('solSub').textContent = dd.sol.name + ' · aydınlık %' + Math.round(dd.sol.illum * 100) + ' · gün doğumu ' + hm(dd.sol.sunrise) + ', batımı ' + hm(dd.sol.sunset);
  // bugün: bitmemiş pencereler; hepsi geçtiyse yarının en iyisi
  const isToday = dd.key === todayKey;
  const rest = (isToday ? bestWindows(dd, null, 2, now) : windows(dd)).slice().sort((p, q) => p.a - q.a);
  const wl = rest.map(w => winRow(winLabel(w), w));
  if (isToday && (!rest.length || Math.max(...rest.map(w => w.pct)) < 50)) {
    const nd = ds[ds.indexOf(dd) + 1]; const w = nd && windows(nd).slice().sort((p, q) => p.a - q.a)[0];
    if (!rest.length) wl.push('<p class="note">Bugünün pencereleri geçti.</p>');
    if (w) wl.push(winRow('Yarın · ' + winLabel(w), w));
  }
  $('solWins').innerHTML = wl.join('');
  renderDrift(dd, cur);
  renderRecs(dd);
}
const skipTxt = k => hm(k.t) + ' civarında balık daha yüksek (%' + k.pct + ') ama deniz ' + (k.cls || 'bilinmiyor') + '; sakin deniz öne alındı.';
// pencere satırı: saat aralığı, balık, olaylar, deniz sınıfı (takvim, Bugün ve öneriler aynı hesabı gösterir)
function winRow(lbl, w){
  return '<div class="win"><span class="t">' + (lbl ? '<small>' + esc(lbl) + '</small>' : '') + winTxt(w) + '</span><span class="chips">' + fishHtml(w.fish) + '<b class="wpct">%' + w.pct + '</b>' +
    (w.cls ? '<span class="chip ' + w.cls + '">deniz ' + w.cls + '</span>' : '') + w.evs.map(e => '<span class="chip gold" title="' + esc(EV_LONG[e.e] || '') + '">' + esc(evChip(e)) + '</span>').join('') + '</span>' +
    (w.skipped ? '<span class="note wskip">' + skipTxt(w.skipped) + '</span>' : '') + '</div>';
}
function renderDrift(dd, cur){
  const el = $('driftPanel'); if (!el) return;
  if (!dd || !cur) { el.hidden = true; return; }
  el.hidden = false;
  const dr = driftAt(cur); const depth = locDepth(); const off = startOffset(dr, depth); const ex = leadExtra(dr, depth);
  const lines = [];
  lines.push('<p class="dline">' + (dr && dr.known && !dr.anchored ? '<span class="dbig">' + f1(dr.sog) + ' <small>kn</small> ' + arrowTo(dr.dir) + ' ' + dir8(dr.dir) + '</span>' : '') + esc(driftSentence(dr)) + '</p>');
  if (off) lines.push('<p class="note">Noktanın üstünden geçmek için yaklaşık <b>' + off.m + ' m ' + dir8(off.from) + '</b> tarafından başla (' + (depth || DEPTH_REF) + ' m’ye iniş ≈ ' + off.sinkS + ' sn, dipte 1,5 dk).</p>');
  if (dr && dr.known) lines.push('<p class="note">İpe binen akış ' + f1(dr.line) + ' kn → kurşun ' + (ex ? '<b>+' + ex + ' g</b>' : 'artışı yok') + (dr.line >= 0.4 ? ', hırsız köstek %20 kısa' : '') + '.' + (depth ? ' Derinlik ' + depth + ' m.' : ' Derinlik bilinmiyor, ' + DEPTH_REF + ' m varsayıldı; Konumlar’dan yazabilirsin.') + '</p>');
  el.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center"><h3>Sürüklenme ve kurşun</h3>' + segBtns('anchor', [['surukle', 'Sürüklenerek'], ['demir', 'Demirli']], S.settings.anchor === 'demir' ? 'demir' : 'surukle') + '</div>' + lines.join('');
}
function renderRecs(dd){
  const L = loc();
  if (!RIG_LIST.length) {
    $('recNote').textContent = '';
    $('recList').innerHTML = '<div class="panel stack"><h3>Henüz rig sistemin yok</h3><p class="sub">Önerilerin senin rig sistemine göre gelir. Sihirbazla kendi sistemini kur ya da özel paketini aç.</p>' +
      '<div class="row"><button class="btn primary" type="button" data-act="wizard">Rig sistemimi kur</button><button class="btn" type="button" data-open="paket">Özel paketimi aç</button></div></div>';
    $('recBlockedW').hidden = true; return;
  }
  $('recBlockedW').hidden = false;
  if (!dd) { $('recNote').textContent = 'Hava verisi gelince öneriler hazırlanır.'; $('recList').innerHTML = ''; $('recBlocked').innerHTML = ''; return; }
  // bugün akşamdan sonra gündüz önerileri yarının; gece yarısından sonra gece önerileri dün başlayan gecenin
  const now = new Date(), ds = days(), i0 = ds.indexOf(dd), isToday = dd.key === dateKey(now);
  let dGun = dd, dGece = dd, tagGun = '', tagGece = '';
  if (isToday) {
    if (now.getTime() > partRange(dd, 'gun')[1] && ds[i0 + 1]) { dGun = ds[i0 + 1]; tagGun = ' · yarın'; }
    if (i0 > 0 && now.getTime() < partRange(ds[i0 - 1], 'gece')[1]) { dGece = ds[i0 - 1]; tagGece = ' · bu gece'; }
  }
  const from = isToday ? now : null;
  const day = recommend(dGun, false, dGun === dd ? from : null), night = recommend(dGece, true, from);
  day.tag = tagGun; night.tag = tagGece; day.dd = dGun; night.dd = dGece;
  const pick = arr => arr.filter(x => x.ok).slice(0, 2);
  const recs = pick(day).map(x => Object.assign({}, x, {night: false, R: day})).concat(pick(night).map(x => Object.assign({}, x, {night: true, R: night})));
  const lb = learnBase();
  $('recNote').textContent = (L && L.bottom ? 'Dip: ' + BOTTOM_TXT[L.bottom] : 'Dip bilinmiyor; keşif riglerine öncelik verildi') + ' · yalnızca tamamlanmış rigler önerilir' +
    (lb.on ? ' · avlarına göre ayarlı' : lb.total ? ' · avlardan öğrenme ' + lb.total + '/' + LEARN_MIN : '') + '.';
  const warn = R => (R.cls === 'D' ? ' · deniz uygun değil, çıkma' : R.cls === 'C' ? ' · dikkat, rüzgârlı' : '') +
    (R.dr && R.dr.known && R.dr.line >= 0.7 ? (R.dr.anchored ? ' · akıntı güçlü' : ' · sürüklenme hızlı: paraşüt çapa ya da demir') : '');
  const wTxt = R => R.win ? '<div class="meta why">En iyi pencere ' + winTxt(R.win) + ' · balık %' + R.win.pct + (R.win.cls ? ' · deniz ' + R.win.cls : '') + '</div>' : '';
  $('recList').innerHTML = recs.length ? recs.map((x, i) => (i === 0 || recs[i - 1].night !== x.night ? '<div class="eyebrow" style="margin-top:4px">' + (x.night ? 'Gece' : 'Gündüz') + x.R.tag + warn(x.R) + '</div>' : '') +
    rigCard(x.rg, x.R.dd, x.why, wTxt(x.R), null, x.R.x)).join('') : '<div class="empty">Bugün için uygun ve tamamlanmış rig yok.</div>';
  const blocked = day.concat(night).filter(x => !x.ok).sort((a, b) => b.sc - a.sc).slice(0, 4);
  $('recBlocked').innerHTML = blocked.map(x => '<div class="rec"><div class="h"><b>' + esc(x.rg.name) + '</b><span class="code">' + esc(x.rg.code || '') + '</span></div><div class="why">Eksik: ' +
    esc(missingOf(x.rg).map(sl => { const e = sl.t.envanter || {}; return (e.item && ITEMS[e.item] ? ITEMS[e.item].name : (e.name || sl.label)) + ' ' + (e.size || ''); }).join(', ')) + '</div></div>').join('') || '<p class="note">Yok.</p>';
}
function renderCalendar(){
  const ds = days().slice(0, 16);
  if (!ds.length) { $('dayList').innerHTML = '<div class="empty">' + (loc() ? 'Veri yok. İnternete bağlanınca takvim dolar.' : 'Önce bir konum ekle.') + '</div>'; return; }
  $('dayList').innerHTML = ds.map(dd => {
    const w = windows(dd)[0];
    return '<button class="day' + (dd.idx >= 10 ? ' low' : '') + '" data-calday="' + dd.key + '" style="text-align:left;font:inherit;color:inherit;cursor:pointer;width:100%">' +
      '<div class="d"><b>' + dd.date.getDate() + '</b><span>' + MON3[dd.date.getMonth()] + ' ' + DOW[dd.date.getDay()] + '</span></div>' +
      '<div class="body"><div class="chips">' + (dd.clsD ? '<span class="chip ' + dd.clsD + '">Gündüz ' + dd.clsD + '</span>' : '') + (dd.clsN ? '<span class="chip ' + dd.clsN + '">Gece ' + dd.clsN + '</span>' : '') + starsHtml(dd.sol.stars) + '</div>' +
      '<div class="vals"><span><em>rüzgâr</em> ' + bftBadge(bft(dd.wd)) + '/' + bftBadge(bft(dd.wn)) + ' Bft</span><span><em>hamle</em> ' + bftBadge(bft(dd.gust)) + ' Bft</span>' +
      '<span><em>dalga</em> ' + f1(dd.wave) + ' m</span>' + (dd.cur != null ? '<span><em>akıntı</em> ' + f1(dd.cur) + ' kn</span>' : '') + (dd.sst != null ? '<span><em>su</em> ' + f1(dd.sst) + ' °C</span>' : '') +
      '<span><em>hava</em> ' + f0(dd.tmin) + '–' + f0(dd.tmax) + ' °C</span><span><em>basınç</em> ' + f0(dd.pmean) + ' hPa' + (dd.pdelta > 1 ? ' ↑' : dd.pdelta < -1 ? ' ↓' : '') + '</span>' +
      (dd.pop != null ? '<span><em>yağış</em> %' + Math.round(dd.pop) + (dd.rain >= 0.5 ? ' · ' + f1(dd.rain) + ' mm' : '') + '</span>' : '') +
      '</div>' +
      (w ? '<div class="calwin">' + fishHtml(w.fish) + '<span><b>%' + w.pct + '</b> en iyi pencere <b>' + winTxt(w) + '</b>' + (w.cls ? ' · deniz ' + w.cls : '') + ' · ' + esc(w.evs.map(e => e.k).join(' + ')) + '</span></div>' +
        (w.skipped ? '<div class="note">' + skipTxt(w.skipped) + '</div>' : '') : '') +
      '<div class="note">güven ' + dd.conf + ' · ' + esc(dd.models.join(', ')) + '</div></div></button>';
  }).join('');
}
