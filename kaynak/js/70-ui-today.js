// ---------------------------------------------------------------- 70 · Bugün ekranı (saatlik tablo, anlık durum, solunar, öneri)
const ui = {rigSeg: 'all', q: '', inv: 'hook', hday: null};
function dayLabel(d, i, todayKey){
  const k = dateKey(d); const tm = new Date(); tm.setDate(tm.getDate() + 1);
  if (k === todayKey) return 'Bugün'; if (k === dateKey(tm)) return 'Yarın';
  return DOW[d.getDay()] + ' ' + d.getDate();
}
function modelText(arr){ const u = [...new Set(arr.filter(Boolean))]; return u.length ? u.join(' / ') : '–'; }
function renderHourly(){
  const ds = days(); const tbl = $('hTable');
  if (!ds.length) { $('dayChips').innerHTML = ''; tbl.innerHTML = '<tr><td class="lbl" style="position:static;max-width:none;min-width:0;padding:14px 12px">Saatlik veri yok. İnternete bağlanınca gelir.</td></tr>'; $('hourlyNote').textContent = ''; return; }
  const now = new Date(), todayKey = dateKey(now);
  if (!ui.hday || !ds.find(d => d.key === ui.hday)) ui.hday = ds.find(d => d.key === todayKey) ? todayKey : ds[0].key;
  $('dayChips').innerHTML = ds.slice(0, 16).map((d, i) => '<button class="btn small" data-hday="' + d.key + '" aria-pressed="' + (d.key === ui.hday) + '">' + dayLabel(d.date, i, todayKey) + '</button>').join('');
  const dd = ds.find(d => d.key === ui.hday); const hs = dd.hs;
  const isToday = dd.key === todayKey, nowH = now.getHours();
  const cls = (x, extra) => 'c' + (x.h < 7 || x.h >= 19 ? ' night' : '') + (isToday && x.h === nowH ? ' curh' : '') + (extra ? ' ' + extra : '');
  const row = (label, sub, cells, trc) => '<tr' + (trc ? ' class="' + trc + '"' : '') + '><th class="lbl" scope="row"><b>' + label + '</b><small>' + sub + '</small></th>' + cells + '</tr>';
  const acts = hs.map(activity);
  const rows = [];
  rows.push(row('Saat', 'yerel saat', hs.map(x => '<td class="' + cls(x) + '">' + pad(x.h) + '</td>').join(''), 'hours'));
  rows.push(row('Hava', 'bulut · yağış', hs.map(x => '<td class="' + cls(x) + '">' + wxIcon(x) + '</td>').join('')));
  rows.push(row('Balık', 'tahmini aktivite %', hs.map((x, i) => '<td class="' + cls(x, 'fish' + (acts[i].pct >= 67 ? ' hi' : '')) + '">' + fishHtml(acts[i].fish) + '<small>%' + acts[i].pct + '</small></td>').join('')));
  rows.push(row('Solunar', 'M major · m minor', hs.map((x, i) => '<td class="' + cls(x, 'sol') + '">' + esc(acts[i].tags.join(' ')) + '</td>').join('')));
  rows.push(row('Yağış', 'olasılık %', hs.map(x => '<td class="' + cls(x, (x.pop || 0) < 10 ? 'p0' : '') + '">' + (x.pop == null ? '–' : Math.round(x.pop)) + '</td>').join('')));
  rows.push(row('Yağış', 'mm', hs.map(x => '<td class="' + cls(x, (x.rain || 0) < 0.1 ? 'p0' : '') + '">' + (x.rain == null ? '–' : x.rain < 0.1 ? '0' : f1(x.rain)) + '</td>').join('')));
  rows.push(row('Sıcaklık', 'hava °C', hs.map(x => '<td class="' + cls(x) + '">' + f0(x.temp) + '</td>').join('')));
  rows.push(row('Rüzgâr', 'Bft · ' + modelText(hs.map(x => x.wm)), hs.map(x => { const b = bft(x.wind); return '<td class="' + cls(x, b == null ? '' : 'b' + seaClass(x.wind)) + '">' + (b == null ? '–' : b) + '<small>' + kn(x.wind) + ' kn</small></td>'; }).join('')));
  rows.push(row('Yön', 'rüzgâr nereye', hs.map(x => '<td class="' + cls(x) + '">' + arrowFrom(x.wdir) + '<small>' + dir8(x.wdir) + '</small></td>').join('')));
  rows.push(row('Hamle', 'Bft · ' + modelText(hs.map(x => x.gm)), hs.map(x => { const b = bft(x.gust); return '<td class="' + cls(x, b == null ? '' : 'b' + seaClass(x.gust)) + '">' + (b == null ? '–' : b) + '<small>' + kn(x.gust) + ' kn</small></td>'; }).join('')));
  rows.push(row('Dalga', 'm · ' + modelText(hs.map(x => x.wvm)), hs.map(x => '<td class="' + cls(x, x.wave == null ? '' : 'b' + waveClass(x.wave)) + '">' + f1(x.wave) + '</td>').join('')));
  rows.push(row('Periyot', 'sn · dalga yönü', hs.map(x => '<td class="' + cls(x) + '">' + (x.per == null ? '–' : Math.round(x.per)) + '<small>' + arrowFrom(x.waveDir) + '</small></td>').join('')));
  rows.push(row('Akıntı', 'kn · gittiği yön', hs.map(x => '<td class="' + cls(x) + '">' + f1(x.cur) + '<small>' + arrowTo(x.curDir) + '</small></td>').join('')));
  rows.push(row('Su', '°C', hs.map(x => '<td class="' + cls(x) + '">' + f1(x.sst) + '</td>').join('')));
  rows.push(row('Basınç', 'hPa · 3 sa değişim', hs.map(x => '<td class="' + cls(x) + '">' + f0(x.press) + '<small>' + (x.dp3 == null ? '' : (x.dp3 > 0 ? '+' : '') + f1(x.dp3)) + '</small></td>').join('')));
  tbl.innerHTML = '<tbody>' + rows.join('') + '</tbody>';
  $('hourlyNote').textContent = (S.wx && S.wx.at ? (PREVIEW ? 'örnek veri' : 'güncel ' + hm(new Date(S.wx.at))) : '') + ' · güven ' + dd.conf;
  if (isToday) { const sc = $('hScroll'); const i = hs.findIndex(x => x.h === nowH); if (i > 1) requestAnimationFrame(() => { sc.scrollLeft = (i - 1) * 46; }); }
  else $('hScroll').scrollLeft = 0;
}
function renderToday(){
  $('previewNote').hidden = !PREVIEW;
  renderHourly();
  const ds = days(); const now = new Date(); const todayKey = dateKey(now);
  const dd = ds.find(d => d.key === todayKey) || ds[0];
  if (!dd) {
    $('nowGrid').innerHTML = '<div class="empty" style="grid-column:1/-1">Hava ve deniz verisi henüz yok. İnternete bağlanınca kendiliğinden gelir.</div>';
    $('classRow').innerHTML = ''; $('solWins').innerHTML = ''; $('recList').innerHTML = ''; $('solSub').textContent = ''; $('solStars').innerHTML = ''; return;
  }
  $('todayLbl').textContent = DOW[dd.date.getDay()] + ' · ' + dd.date.getDate() + ' ' + MONTHS[dd.date.getMonth()];
  const cur = dd.hs.reduce((b, x) => Math.abs(x.t - now) < Math.abs(b.t - now) ? x : b, dd.hs[0]);
  const M = (k, v, u, s) => '<div class="metric"><span class="k">' + k + '</span><span class="v">' + v + ' <small>' + u + '</small></span><span class="s">' + s + '</span></div>';
  $('nowGrid').innerHTML =
    M('Rüzgâr', cur.wind == null ? '–' : bft(cur.wind), 'Bft', kn(cur.wind) + ' kn ' + dir8(cur.wdir) + ' · hamle ' + (cur.gust == null ? '–' : bft(cur.gust) + ' Bft')) +
    M('Dalga', f1(cur.wave), 'm', cur.per != null ? Math.round(cur.per) + ' sn · gün en çok ' + f1(dd.wave) + ' m' : 'model yok') +
    M('Akıntı', f1(cur.cur), 'kn', cur.cur != null ? dir8(cur.curDir) + ' yönüne' : 'model yok') +
    M('Su', f1(cur.sst), '°C', 'hava ' + f1(cur.temp) + ' °C · ' + f0(cur.press) + ' hPa');
  const cl = (c, lbl, w) => c ? '<div class="cls ' + c + '"><b>' + c + '</b><span><b style="font:600 13px var(--body)">' + lbl + '</b><br>' + CLS_TXT[c] + ' · en çok ' + bft(w) + ' Bft</span></div>' : '';
  $('classRow').innerHTML = cl(dd.clsD, 'Gündüz', dd.wd) + cl(dd.clsN, 'Gece', dd.wn);
  $('solStars').innerHTML = starsHtml(dd.sol.stars);
  $('solSub').textContent = dd.sol.name + ' · aydınlık %' + Math.round(dd.sol.illum * 100) + ' · gün doğumu ' + hm(dd.sol.sunrise) + ', batımı ' + hm(dd.sol.sunset);
  $('solWins').innerHTML = windows(dd).map(w => '<div class="win"><span class="t">' + hm(w.a) + '–' + hm(w.b) + '</span><span class="chips"><span class="chip ' + w.cls + '">' + w.cls + '</span>' +
    w.tags.map(t => '<span class="chip gold">' + esc(t) + '</span>').join('') + (w.night ? '<span class="chip">gece</span>' : '') + '</span></div>').join('');
  const day = recommend(dd, false), night = recommend(dd, true);
  const pick = arr => arr.filter(x => x.ok).slice(0, 2);
  const recs = pick(day).map(x => ({...x, night: false})).concat(pick(night).map(x => ({...x, night: true})));
  const L = loc();
  $('recNote').textContent = (L.bottom ? 'Dip: ' + BOTTOM_TXT[L.bottom] : 'Dip bilinmiyor; keşif riglerine öncelik verildi') + ' · yalnızca tamamlanmış rigler önerilir.';
  const warn = c => c === 'D' ? ' · deniz uygun değil, çıkma' : c === 'C' ? ' · dikkat, rüzgârlı' : '';
  const bh = {day: bestHours(dd, false), night: bestHours(dd, true)};
  const bhTxt = arr => arr.length ? '<div class="meta why">En iyi saatler: ' + arr.map(p => pad(p.x.h) + ':00 (%' + p.a.pct + ')').join(' · ') + '</div>' : '';
  $('recList').innerHTML = recs.length ? recs.map((x, i) => (i === 0 || recs[i - 1].night !== x.night ? '<div class="eyebrow" style="margin-top:4px">' + (x.night ? 'Gece' + warn(dd.clsN) : 'Gündüz' + warn(dd.clsD)) + '</div>' : '') +
    rigCard(x.rg, dd, x.why, bhTxt(x.night ? bh.night : bh.day))).join('') : '<div class="empty">Bugün için uygun ve tamamlanmış rig yok.</div>';
  const blocked = day.concat(night).filter(x => !x.ok).sort((a, b) => b.sc - a.sc).slice(0, 4);
  $('recBlocked').innerHTML = blocked.map(x => '<div class="rec"><div class="h"><b>' + esc(x.rg.name) + '</b><span class="code">' + x.rg.code + '</span></div><div class="why">Eksik: ' +
    esc(missingOf(x.rg).map(m => (ITEMS[m.c.item] ? ITEMS[m.c.item].name : m.c.name) + ' ' + (m.c.size || '')).join(', ')) + '</div></div>').join('') || '<p class="note">Yok.</p>';
}
function renderCalendar(){
  const ds = days().slice(0, 16);
  if (!ds.length) { $('dayList').innerHTML = '<div class="empty">Veri yok. İnternete bağlanınca takvim dolar.</div>'; return; }
  $('dayList').innerHTML = ds.map(dd => {
    const w = windows(dd)[0];
    const acts = dd.hs.map(activity); const best = acts.reduce((m, a, i) => a.pct > m.p ? {p: a.pct, h: dd.hs[i].h} : m, {p: 0, h: 0});
    return '<button class="day' + (dd.idx >= 10 ? ' low' : '') + '" data-calday="' + dd.key + '" style="text-align:left;font:inherit;color:inherit;cursor:pointer;width:100%">' +
      '<div class="d"><b>' + dd.date.getDate() + '</b><span>' + MON3[dd.date.getMonth()] + ' ' + DOW[dd.date.getDay()] + '</span></div>' +
      '<div class="body"><div class="chips">' + (dd.clsD ? '<span class="chip ' + dd.clsD + '">Gündüz ' + dd.clsD + '</span>' : '') + (dd.clsN ? '<span class="chip ' + dd.clsN + '">Gece ' + dd.clsN + '</span>' : '') + starsHtml(dd.sol.stars) + '</div>' +
      '<div class="vals"><span><em>rüzgâr</em> ' + (dd.wd == null ? '–' : bft(dd.wd)) + '/' + (dd.wn == null ? '–' : bft(dd.wn)) + ' Bft</span><span><em>hamle</em> ' + (dd.gust == null ? '–' : bft(dd.gust) + ' Bft') + '</span>' +
      '<span><em>dalga</em> ' + f1(dd.wave) + ' m</span>' + (dd.cur != null ? '<span><em>akıntı</em> ' + f1(dd.cur) + ' kn</span>' : '') + (dd.sst != null ? '<span><em>su</em> ' + f1(dd.sst) + ' °C</span>' : '') +
      '<span><em>hava</em> ' + f0(dd.tmin) + '–' + f0(dd.tmax) + ' °C</span><span><em>basınç</em> ' + f0(dd.pmean) + ' hPa' + (dd.pdelta > 1 ? ' ↑' : dd.pdelta < -1 ? ' ↓' : '') + '</span>' +
      (dd.pop != null ? '<span><em>yağış</em> %' + Math.round(dd.pop) + (dd.rain >= 0.5 ? ' · ' + f1(dd.rain) + ' mm' : '') + '</span>' : '') +
      '<span><em>balık</em> en çok %' + best.p + ' (' + pad(best.h) + ':00)</span></div>' +
      (w ? '<div class="note">En iyi pencere ' + hm(w.a) + '–' + hm(w.b) + ' · ' + esc(w.tags.join(', ')) + ' · güven ' + dd.conf + ' · ' + esc(dd.models.join(', ')) + '</div>' : '') + '</div></button>';
  }).join('');
}
