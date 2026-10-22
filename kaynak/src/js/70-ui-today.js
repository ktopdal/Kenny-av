// ---------------------------------------------------------------- 70 · Bugün ekranı (saatlik tablo, anlık durum, solunar, öneri)
const ui = {rigSeg: 'all', q: '', inv: 'hook', hday: null, sys: 'all', sheet: null, sheetArg: null};
function dayLabel(d, i, todayKey){
  const k = dateKey(d); const tm = new Date(); tm.setDate(tm.getDate() + 1);
  if (k === todayKey) return 'Bugün'; if (k === dateKey(tm)) return 'Yarın';
  return DOW[d.getDay()] + ' ' + d.getDate();
}
function modelText(arr){ const u = [...new Set(arr.filter(Boolean))]; return u.length ? u.join(' / ') : '–'; }
// Bugün ekranının kartları ve takvim satırları (Görünüm sayfasından açılıp kapatılır, sırası değiştirilir)
const TCARDS = [
  {id: 'saatlik', t: 'Saatlik tablo'},
  {id: 'anlik', t: 'Şu an ve deniz sınıfı'},
  {id: 'surukle', t: 'Sürüklenme ve kurşun'},
  {id: 'solunar', t: 'Solunar ve en iyi pencereler'},
  {id: 'oneri', t: 'Bugün bağla (öneriler)'},
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
  $('todayTitle').textContent = shoreMode() ? 'Bugün kıyıda' : 'Bugün denizde';
  applyCards();
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
  // Rüzgâr kartı Karma satırıyla aynı (Karma: ICON-EU, yedeğe geçmez); Hamle ayrı kartta, kendi modeliyle (Karma: GFS)
  const u = windU(), ul = u === 'bft' ? windU2() : u;
  const sub = (v, d) => v == null ? 'model yok' : windNum(v, ul) + ' ' + WU_TXT[ul] + (d == null ? '' : ' ' + windName(d));
  const big = v => { const b = bft(v); return b == null ? '–' : '<span class="bftb big" style="' + bftStyle(b) + '">' + b + '</span>'; };
  const kId = cur.wkid || 'icon', gId = cur.gid;
  const gDir = gId && cur.m && cur.m[gId] && cur.m[gId].d != null ? cur.m[gId].d : cur.wdir;
  $('nowGrid').innerHTML =
    M('Rüzgâr ' + mBadge(SRC[kId].short), big(cur.wk), 'Bft', sub(cur.wk, cur.wkd)) +
    M('Hamle ' + mBadge(gId ? (SRC[gId] ? SRC[gId].short : 'En iyi') : '–'), big(cur.gust), 'Bft', sub(cur.gust, gDir)) +
    M('Dalga', f1(cur.wave), 'm', cur.per != null ? Math.round(cur.per) + ' sn ' + windName(cur.waveDir) + ' · gün en çok ' + f1(dd.wave) + ' m' : 'model yok') +
    M('Akıntı', f1(cur.cur), 'kn', cur.cur != null ? dir8(cur.curDir) + ' yönüne' : 'model yok') +
    M('Su sıcaklığı', cur.sst == null ? '–' : tempV(cur.sst, true), TU(), 'gün ort. ' + tempTxt(dd.sst, true)) +
    M('Hava', cur.temp == null ? '–' : tempV(cur.temp), TU(), pressTxt(cur.press) + (cur.dp3 == null ? '' : ' ' + (cur.dp3 >= 0.5 ? '↑' : cur.dp3 <= -0.5 ? '↓' : '→')));
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
  if (shoreMode()) renderShore(dd, cur); else renderDrift(dd, cur);
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
  // kapalı sistem uyarısı: kapatılan sistemin rigleri önerilere girmez
  const offSys = Object.values(S.systems).filter(sy => sy.active === false && (sy.source !== 'paket' || pkgOn()));
  const offNote = offSys.length ? '<div class="banner">' + offSys.map(sy => esc(sy.name) + ' kapalı ' + '<button class="btn small" type="button" data-systool="toggle" data-sid="' + esc(sy.id) + '">Aç</button>').join(' · ') + '</div>' : '';
  if (!RIG_LIST.length) {
    $('recNote').textContent = '';
    $('recList').innerHTML = offNote + '<div class="panel stack"><h3>' + (offSys.length ? 'Açık rig sistemin yok' : 'Henüz rig sistemin yok') + '</h3><p class="sub">Önerilerin senin rig sistemine göre gelir. Sihirbazla kendi sistemini kur ya da özel paketini aç.</p>' +
      '<div class="row"><button class="btn primary" type="button" data-act="wizard">Rig sistemimi kur</button><button class="btn" type="button" data-open="paket">Özel paketimi aç</button></div></div>';
    $('recBlockedW').hidden = true; return;
  }
  $('recBlockedW').hidden = false;
  if (!RIG_LIST.some(r => !r.mode || r.mode === (S.mode || 'tekne'))) {
    $('recNote').textContent = '';
    $('recList').innerHTML = offNote + '<div class="panel stack"><h3>' + (shoreMode() ? 'Kıyı rigin yok' : 'Tekne rigin yok') + '</h3><p class="sub">' + (shoreMode() ? 'Sistemlerindeki rigler tekne için. Rig Atölyesi’nde “Kıyıdan” seçip surf, LRF, spin ya da şamandıra sistemini kur.' : 'Sistemlerindeki rigler kıyı için. Rig Atölyesi’nde “Tekneden” seçip sistem kur.') + '</p>' +
      '<div class="row"><button class="btn primary" type="button" data-act="wizard">' + (shoreMode() ? 'Kıyı sistemimi kur' : 'Tekne sistemimi kur') + '</button><button class="btn" type="button" data-set="mode" data-val="' + (shoreMode() ? 'tekne' : 'kiyi') + '">' + (shoreMode() ? 'Tekne moduna dön' : 'Kıyı moduna geç') + '</button></div></div>';
    $('recBlocked').innerHTML = ''; $('recBlockedW').hidden = true; return;
  }
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
  const on = {}; orderedRows(CROWS, S.settings.calrows).forEach(r => { on[r.id] = r.on; });
  const V = (id, html) => on[id] ? html : '';
  $('dayList').innerHTML = ds.map(dd => {
    const w = windows(dd)[0];
    return '<button class="day' + (dd.idx >= 10 ? ' low' : '') + '" data-calday="' + dd.key + '" style="text-align:left;font:inherit;color:inherit;cursor:pointer;width:100%">' +
      '<div class="d"><b>' + dd.date.getDate() + '</b><span>' + MON3[dd.date.getMonth()] + ' ' + DOW[dd.date.getDay()] + '</span></div>' +
      '<div class="body"><div class="chips">' + (dd.clsD ? '<span class="chip ' + dd.clsD + '">Gündüz ' + dd.clsD + '</span>' : '') + (dd.clsN ? '<span class="chip ' + dd.clsN + '">Gece ' + dd.clsN + '</span>' : '') + starsHtml(dd.sol.stars) + '</div>' +
      '<div class="vals">' + V('ruzgar', '<span><em>rüzgâr</em> ' + bftBadge(bft(dd.wd)) + '/' + bftBadge(bft(dd.wn)) + ' Bft</span>') + V('hamle', '<span><em>hamle</em> ' + bftBadge(bft(dd.gust)) + ' Bft</span>') +
      V('dalga', '<span><em>dalga</em> ' + f1(dd.wave) + ' m</span>') + V('akinti', dd.cur != null ? '<span><em>akıntı</em> ' + f1(dd.cur) + ' kn</span>' : '') + V('su', dd.sst != null ? '<span><em>su</em> ' + tempTxt(dd.sst, true) + '</span>' : '') +
      V('hava', '<span><em>hava</em> ' + tempV(dd.tmin) + '–' + tempV(dd.tmax) + ' ' + TU() + '</span>') + V('basinc', '<span><em>basınç</em> ' + pressTxt(dd.pmean) + (dd.pdelta > 1 ? ' ↑' : dd.pdelta < -1 ? ' ↓' : '') + '</span>') +
      V('yagis', dd.pop != null ? '<span><em>yağış</em> %' + Math.round(dd.pop) + (dd.rain >= 0.5 ? ' · ' + f1(dd.rain) + ' mm' : '') + '</span>' : '') +
      '</div>' +
      V('pencere', w ? '<div class="calwin">' + fishHtml(w.fish) + '<span><b>%' + w.pct + '</b> en iyi pencere <b>' + winTxt(w) + '</b>' + (w.cls ? ' · deniz ' + w.cls : '') + ' · ' + esc(w.evs.map(e => e.k).join(' + ')) + '</span></div>' +
        (w.skipped ? '<div class="note">' + skipTxt(w.skipped) + '</div>' : '') : '') +
      V('guven', '<div class="note">güven ' + dd.conf + ' · ' + esc(dd.models.join(', ')) + '</div>') + '</div></button>';
  }).join('');
}
