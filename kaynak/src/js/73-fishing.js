// ---------------------------------------------------------------- 73 · Fishing sekmesi (uygulamanın asıl yeri)
// Sıra: gün + gündüz/gece seç → o bölümün solunar pencereleri → yalnızca en uygun 3 rig (Bunu bağla) → en altta 3 saatlik dilimlerle sürüklenme ve kurşun.
// Gündüz: gün doğumundan 75 dk önce → gün batımından 45 dk sonra · Gece: gün batımından 30 dk önce → ertesi gün doğumundan 45 dk önce (partRange).
const F_TOP = 3;
const PART_TXT = {gun: 'Gündüz', gece: 'Gece'};
// seçili gün ve bölüm; ilk açılışta bugün, akşamüstünden sonra gece
function fState(ds){
  const now = new Date(), tk = dateKey(now);
  if (!ui.fday || !ds.find(d => d.key === ui.fday)) ui.fday = (ds.find(d => d.key === tk) || ds[0]).key;
  const dd = ds.find(d => d.key === ui.fday);
  if (!ui.fpart) ui.fpart = dd.key === tk && now.getTime() > partRange(dd, 'gun')[1] - 90 * 60000 ? 'gece' : 'gun';
  return dd;
}
const fHours = (dd, part) => { const [A, B] = partRange(dd, part); return WX ? WX.hours.filter(x => { const t = x.t.getTime(); return t >= A - 30 * 60000 && t < B; }) : []; };
// yön ortalaması (vektörle): ağırlık hız
function meanDir(items){
  let sx = 0, sy = 0; items.forEach(([v, d]) => { if (v == null || d == null) return; sx += v * Math.sin(d * Math.PI / 180); sy += v * Math.cos(d * Math.PI / 180); });
  return sx === 0 && sy === 0 ? null : (Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360;
}
const meanV = arr => { const v = arr.filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const spanTxt = (lo, hi, u) => lo == null ? '–' : lo === hi ? lo + ' ' + u : lo + '–' + hi + ' ' + u;
const hhmm = t => hm(new Date(t));
function renderFishing(){
  if (!$('v-fishing')) return;
  const L = loc(); const ds = L ? days() : [];
  $('fLoc').textContent = L ? locLabel(L) : 'Fishing';
  // kara noktası: balık, rig ve sürüklenme yok; deniz ya da kıyı noktası seçtirilir
  const land = !!L && locKind(L) === 'kara';
  $('v-fishing').classList.toggle('isLand', land);
  const ask = !land && L ? fbAskHtml() : ''; $('fAsk').hidden = !ask; $('fAsk').innerHTML = ask;
  if (land) { $('fNoLoc').hidden = false; $('fNoLoc').innerHTML = landPanel(); return; }
  const empty = !L || !ds.length;
  $('fNoLoc').hidden = !empty;
  $('fNoLoc').innerHTML = !L ? '<div class="panel stack"><h3>Önce bir konum ekle</h3><p class="sub">Av planı seçtiğin noktanın hava, deniz ve solunar bilgisine göre hazırlanır.</p>' +
    '<div class="row"><button class="btn primary" type="button" data-act="gpsloc">Bulunduğum yer</button><button class="btn" type="button" data-open="konumlar">Koordinat gir</button></div></div>' :
    !ds.length ? '<div class="empty">Hava ve deniz verisi henüz yok. İnternete bağlanınca av planı hazırlanır.</div>' : '';
  ['fPick', 'solPanel'].forEach(id => { $(id).hidden = empty; });
  if (empty) { $('fDays').innerHTML = ''; $('fParts').innerHTML = ''; $('fSum').innerHTML = ''; fRecs(null); fDrift(null); return; }
  const dd = fState(ds), part = ui.fpart, now = new Date(), tk = dateKey(now), isToday = dd.key === tk;
  const [A, B] = partRange(dd, part);
  const past = isToday && now.getTime() > B;
  $('fDays').innerHTML = ds.slice(0, 16).map((d, i) => '<button class="btn small dchip" type="button" data-fday="' + d.key + '" aria-pressed="' + (d.key === dd.key) + '"><span>' + dayLabel(d.date, i, tk) + '</span>' + dayStrip(d) + '</button>').join('');
  const pc = {gun: dd.clsD, gece: dd.clsN};
  $('fParts').innerHTML = [['gun', '☀', 'doğuş ' + hm(dd.sol.sunrise)], ['gece', '☾', 'batış ' + hm(dd.sol.sunset)]].map(([v, ic, s]) =>
    '<button class="fpart" type="button" data-fpart="' + v + '" aria-pressed="' + (part === v) + '"><i aria-hidden="true">' + ic + '</i><span><b>' + PART_TXT[v] + '</b><small>' + s + '</small></span>' +
    (pc[v] ? '<em class="chip ' + pc[v] + '">' + pc[v] + '</em>' : '') + '</button>').join('');
  // bölümün özeti: saat aralığı, deniz sınıfı, rüzgâr ve dalga
  const hs = fHours(dd, part);
  const bs = hs.map(x => bft(x.wind)).filter(v => v != null), wv = hs.map(x => x.wave).filter(v => v != null);
  const cls = part === 'gun' ? dd.clsD : dd.clsN;
  $('fSum').innerHTML = '<div class="fsrow"><b class="mono">' + hhmm(A) + ' – ' + hhmm(B) + (part === 'gece' ? ' <small>(ertesi sabah)</small>' : '') + '</b>' +
    (cls ? '<span class="chip ' + cls + '">deniz ' + cls + ' · ' + esc(CLS_TXT[cls]) + '</span>' : '') + '</div>' +
    '<p class="note">' + [bs.length ? 'rüzgâr ' + spanTxt(Math.min(...bs), Math.max(...bs), 'Bft') : '', wv.length ? 'dalga en çok ' + f1(Math.max(...wv)) + ' m' : '',
      hs.some(x => x.cur != null) ? 'akıntı en çok ' + f1(Math.max(...hs.map(x => x.cur || 0))) + ' kn' : '', dd.sst != null ? 'su ' + tempTxt(dd.sst, true) : ''].filter(Boolean).join(' · ') + '</p>' +
    seasonLine(dd) +
    (past ? '<div class="banner">Bugünün gündüzü bitti. <button class="btn small" type="button" data-fpart="gece">Bu gece</button> ' +
      (ds[ds.indexOf(dd) + 1] ? '<button class="btn small" type="button" data-fday="' + ds[ds.indexOf(dd) + 1].key + '">Yarın sabah</button>' : '') + '</div>' : '');
  // solunar: o günün ayı ve bu bölümün en iyi pencereleri
  $('solStars').innerHTML = starsHtml(dd.sol.stars);
  $('solSub').textContent = dd.sol.name + ' · aydınlık %' + Math.round(dd.sol.illum * 100) + ' · gün doğumu ' + hm(dd.sol.sunrise) + ', batımı ' + hm(dd.sol.sunset);
  const from = isToday ? now : null;
  const ws = past ? [] : bestWindows(dd, part, 2, from).slice().sort((p, q) => p.a - q.a);
  $('solWins').innerHTML = ws.length ? ws.map(w => winRow(winLabel(w), w)).join('') : '<p class="note">' + (past ? 'Bu bölüm geçti.' : 'Bu bölümde belirgin bir pencere yok.') + '</p>';
  fRecs(dd, part, from, past);
  fDrift(dd, part);
}
// ---- bu ay ve bu suda mevsiminde olan türler (tür takvimi, 52-tune.js)
function seasonLine(dd){
  const month = dd.date.getMonth() + 1, list = seasonNow(month, dd.sst, 6);
  if (!list.length) return '';
  return '<div class="fseason"><b>Mevsiminde</b>' + list.map(x => '<button type="button" class="sz" data-tur="' + esc(x.id) + '">' + esc(spName(x.id)) + calDots(x.m) + (x.tf != null && tempWord(dd.sst, KB.CAL[x.id][1]) !== 'ideal' ? '<em>' + esc(tempWord(dd.sst, KB.CAL[x.id][1])) + '</em>' : '') + '</button>').join('') +
    '<button type="button" class="btn small" data-open="turtakvim">Tür takvimi</button></div>';
}
// ---- Bunu bağla: yalnızca seçili bölüm, en uygun 3 rig (kafa karışmasın); kalanlar kapalı listede ad olarak
function fRecs(dd, part, from, past){
  const L = loc();
  const offSys = Object.values(S.systems).filter(sy => sy.active === false && (sy.source !== 'paket' || pkgOn()));
  const offNote = offSys.length ? '<div class="banner">' + offSys.map(sy => esc(sy.name) + ' kapalı ' + '<button class="btn small" type="button" data-systool="toggle" data-sid="' + esc(sy.id) + '">Aç</button>').join(' · ') + '</div>' : '';
  $('recHead').textContent = 'Bunu bağla' + (dd ? ' · ' + PART_TXT[part] : '');
  $('recMoreW').hidden = true; $('recMore').innerHTML = ''; $('fTarget').innerHTML = '';
  if (!RIG_LIST.length) {
    $('recNote').textContent = '';
    $('recList').innerHTML = offNote + '<div class="panel stack"><h3>' + (offSys.length ? 'Açık rig sistemin yok' : 'Henüz rig sistemin yok') + '</h3><p class="sub">Önerilerin senin rig sistemine göre gelir. Sihirbazla kendi sistemini kur ya da özel paketini aç.</p>' +
      '<div class="row"><button class="btn primary" type="button" data-act="wizard">Rig sistemimi kur</button><button class="btn" type="button" data-open="paket">Özel paketimi aç</button></div></div>';
    $('recBlockedW').hidden = true; return;
  }
  if (!RIG_LIST.some(r => !r.mode || r.mode === modeNow())) {
    $('recNote').textContent = '';
    $('recList').innerHTML = offNote + '<div class="panel stack"><h3>' + (shoreMode() ? 'Kıyı rigin yok' : 'Tekne rigin yok') + '</h3><p class="sub">' + (shoreMode() ? 'Sistemlerindeki rigler tekne için. Rig Atölyesi’nde “Kıyıdan” seçip surf, LRF, spin ya da şamandıra sistemini kur.' : 'Sistemlerindeki rigler kıyı için. Rig Atölyesi’nde “Tekneden” seçip sistem kur.') + '</p>' +
      '<div class="row"><button class="btn primary" type="button" data-act="wizard">' + (shoreMode() ? 'Kıyı sistemimi kur' : 'Tekne sistemimi kur') + '</button><button class="btn" type="button" data-set="mode" data-val="' + (shoreMode() ? 'tekne' : 'kiyi') + '">' + (shoreMode() ? 'Tekne moduna dön' : 'Kıyı moduna geç') + '</button></div></div>';
    $('recBlocked').innerHTML = ''; $('recBlockedW').hidden = true; return;
  }
  $('recBlockedW').hidden = false;
  if (!dd) { $('recNote').textContent = 'Hava verisi gelince öneriler hazırlanır.'; $('recList').innerHTML = offNote; $('recBlocked').innerHTML = ''; return; }
  const night = part === 'gece';
  $('fTarget').innerHTML = '<span class="note">Hedef boy</span>' + segBtns('ftarget', [['', 'Hepsi'], ['porsiyon', 'Porsiyon'], ['trofe', 'Trofe']], S.settings.ftarget || '');
  const R = recommend(dd, night, past ? null : from);
  const ok = R.filter(x => x.ok), top = ok.slice(0, F_TOP), more = ok.slice(F_TOP, F_TOP + 6);
  const lb = learnBase();
  $('recNote').textContent = (L && L.bottom ? 'Dip: ' + BOTTOM_TXT[L.bottom] : 'Dip bilinmiyor; keşif riglerine öncelik verildi') + ' · en uygun ' + F_TOP + ' rig · yalnızca tamamlanmış rigler' +
    (lb.on ? ' · avlarına göre ayarlı' : lb.total ? ' · avlardan öğrenme ' + lb.total + '/' + LEARN_MIN : '') + '.';
  // uyarı, üstteki özetle aynı sınıfa bakar (bölümün en kötü saatleri)
  const pcls = night ? dd.clsN : dd.clsD;
  const warn = pcls === 'D' ? '<div class="banner bad">' + PART_TXT[part] + ' deniz D: uygun değil, çıkma.' + (R.win && R.win.cls && R.win.cls !== 'D' ? ' En iyi pencerede ' + R.win.cls + ' (' + winTxt(R.win) + ').' : '') + '</div>' :
    pcls === 'C' ? '<div class="banner">Dikkat: ' + PART_TXT[part].toLowerCase() + ' deniz C, rüzgârlı.</div>' : '';
  const flow = R.dr && R.dr.known && R.dr.line >= 0.7 ? '<div class="banner">' + (R.dr.anchored ? 'Akıntı güçlü: ağır kurşun.' : 'Sürüklenme hızlı: paraşüt çapa ya da demir.') + '</div>' : '';
  const wTxt = R.win ? '<div class="meta why">En iyi pencere ' + winTxt(R.win) + ' · balık %' + R.win.pct + (R.win.cls ? ' · deniz ' + R.win.cls : '') + '</div>' : '';
  $('recList').innerHTML = offNote + warn + flow + (top.length ? top.map((x, i) => '<div class="rank">' + (i + 1) + '</div>' +
    rigCard(x.rg, dd, x.why, wTxt, null, R.x, {tune: tuneRig(x.rg, dd, R.x, R.win, night, R.month), foot: past ? '' : fbRow(x.rg)})).join('') :
    '<div class="empty">' + PART_TXT[part] + ' için uygun ve tamamlanmış rig yok.</div>');
  $('recMoreW').hidden = !more.length;
  $('recMoreS').textContent = 'Diğer uygun rigler (' + more.length + ')';
  $('recMore').innerHTML = more.map(x => '<div class="rec"><div class="h"><b>' + esc(x.rg.name) + '</b><span class="code">' + esc(x.rg.code || '') + '</span></div><div class="why">' + esc(x.why.slice(0, 3).join(' · ')) + '</div></div>').join('');
  const blocked = R.filter(x => !x.ok).slice(0, 3);
  $('recBlocked').innerHTML = blocked.map(x => '<div class="rec"><div class="h"><b>' + esc(x.rg.name) + '</b><span class="code">' + esc(x.rg.code || '') + '</span></div><div class="why">Eksik: ' +
    esc(missingOf(x.rg).map(sl => { const e = sl.t.envanter || {}; return (e.item && ITEMS[e.item] ? ITEMS[e.item].name : (e.name || sl.label)) + ' ' + (e.size || ''); }).join(', ')) + '</div></div>').join('') || '<p class="note">Yok.</p>';
}
// ---- 3 saatlik dilimler (son dilim 1,5 saatten kısaysa öncekine katılır)
function fBlocks(dd, part){
  const [A, B] = partRange(dd, part); const hs = fHours(dd, part);
  const t = new Date(A); t.setMinutes(0, 0, 0);
  const out = []; let a = t.getTime();
  while (a < B) { let b = a + 3 * 3600000; if (B - b < 90 * 60000) b = B; out.push({a: Math.max(a, A), b: Math.min(b, B), a0: a}); a = b; }
  return out.map(k => Object.assign(k, {xs: hs.filter(x => x.t.getTime() >= k.a0 && x.t.getTime() < k.b)})).filter(k => k.xs.length);
}
function blockStats(k, depth){
  const xs = k.xs;
  const drs = xs.map(driftAt).filter(d => d && d.known);
  const bs = xs.map(x => bft(x.wind)).filter(v => v != null);
  const o = {bLo: bs.length ? Math.min(...bs) : null, bHi: bs.length ? Math.max(...bs) : null,
    wdir: meanDir(xs.map(x => [x.wind, x.wdir])), wave: xs.some(x => x.wave != null) ? Math.max(...xs.map(x => x.wave || 0)) : null,
    cur: meanV(xs.map(x => x.cur)), curDir: meanDir(xs.map(x => [x.cur, x.curDir])), cls: worstCls(xs.map(seaClsAt)), known: drs.length > 0};
  if (drs.length) {
    o.anch = drs[0].anchored;
    o.sog = meanV(drs.map(d => d.sog)); o.dir = meanDir(drs.map(d => [d.sog, d.dir]));
    o.lineHi = Math.max(...drs.map(d => d.line)); o.lineLo = Math.min(...drs.map(d => d.line));
    o.extra = leadExtra({line: o.lineHi}, depth);
    o.off = o.anch ? null : startOffset({anchored: false, sog: o.sog, dir: o.dir == null ? 0 : o.dir}, depth);
  }
  return o;
}
function fDrift(dd, part){
  const el = $('driftPanel'); if (!el) return;
  if (!dd) { el.hidden = true; return; }
  el.hidden = false;
  const depth = locDepth(), blocks = fBlocks(dd, part).map(k => Object.assign(k, {st: blockStats(k, depth)}));
  if (shoreMode()) { el.innerHTML = fShore(dd, part, blocks); return; }
  const anch = S.settings.anchor === 'demir';
  const kn = blocks.filter(k => k.st.known);
  const rows = blocks.map((k, i) => {
    const s = k.st, prev = i ? blocks[i - 1].st : null;
    const head = '<div class="fbh"><b class="mono">' + hhmm(k.a) + '–' + hhmm(k.b) + '</b>' + (s.bHi != null ? '<span class="bftb" style="' + bftStyle(s.bHi) + '">' + s.bHi + '</span>' : '') + (s.cls ? '<span class="chip ' + s.cls + '">' + s.cls + '</span>' : '') + '</div>';
    if (!s.known) return '<div class="fblock">' + head + '<p>Rüzgâr ve akıntı verisi yok.</p></div>';
    const wind = 'rüzgâr ' + (s.wdir != null ? windName(s.wdir) + ' ' : '') + spanTxt(s.bLo, s.bHi, 'Bft');
    const cur = s.cur != null ? 'akıntı ' + f1(s.cur) + ' kn' + (s.curDir != null ? ' ' + dir8(s.curDir) + ' yönüne' : '') : 'akıntı verisi yok';
    const trend = prev && prev.bHi != null && s.bHi != null ? (s.bHi - prev.bHi >= 1 ? ' Rüzgâr artıyor.' : prev.bHi - s.bHi >= 1 ? ' Rüzgâr azalıyor.' : '') : '';
    const lead = s.extra ? 'kurşun <b>+' + s.extra + ' g</b>' : 'kurşun artışı yok';
    const txt = anch ? 'Demirli: ' + cur + ' · ' + wind + '. İpe binen akış ' + f1(s.lineHi) + ' kn → ' + lead + '.' :
      'Tekne ~' + f1(s.sog) + ' kn ile ' + (s.dir != null ? dir8(s.dir) + ' yönüne' : '') + ' sürüklenir (' + wind + ', ' + cur + ').' + trend +
      ' İpe binen akış ' + (f1(s.lineLo) === f1(s.lineHi) ? f1(s.lineHi) : f1(s.lineLo) + '–' + f1(s.lineHi)) + ' kn → ' + lead + (s.lineHi >= 0.7 ? ', hırsız köstek %30 kısa' : s.lineHi >= 0.4 ? ', hırsız köstek %20 kısa' : '') + '.' +
      (s.off ? ' Noktanın ~' + s.off.m + ' m ' + dir8(s.off.from) + ' tarafından başla.' : '');
    return '<div class="fblock">' + head + '<p>' + txt + '</p></div>';
  });
  let sum = '';
  if (kn.length) {
    const fast = kn.reduce((b, k) => (anch ? k.st.lineHi : k.st.sog) > (anch ? b.st.lineHi : b.st.sog) ? k : b, kn[0]);
    const vals = kn.map(k => anch ? k.st.lineHi : k.st.sog), ex = Math.max(...kn.map(k => k.st.extra || 0));
    sum = '<p class="dline"><span class="dbig">' + f1(Math.min(...vals)) + '–' + f1(Math.max(...vals)) + ' <small>kn</small></span>' + PART_TXT[part] + ' boyunca ' + (anch ? 'ipe binen akış' : 'sürüklenme') +
      '; en hızlı ' + hhmm(fast.a) + '–' + hhmm(fast.b) + '. Kurşun en çok ' + (ex ? '+' + ex + ' g' : 'artmaz') + '.</p>';
  }
  el.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center"><h3>Sürüklenme ve kurşun</h3>' + segBtns('anchor', [['surukle', 'Sürüklenerek'], ['demir', 'Demirli']], anch ? 'demir' : 'surukle') + '</div>' +
    sum + rows.join('') +
    '<p class="note">' + (depth ? 'Derinlik ' + depth + ' m.' : 'Derinlik bilinmiyor, ' + DEPTH_REF + ' m varsayıldı; Konumlar’dan yazabilirsin.') + ' Rig kartlarındaki kurşun en iyi penceredeki koşula göredir. Tekne rüzgâr payı Ayarlar’dan.</p>';
}
// ---- kıyı modu: kıyıya göre rüzgâr ve dalga, çapalı kurşun
function fShore(dd, part, blocks){
  const Lc = loc(), f = facingOf(Lc);
  const rows = blocks.map(k => {
    const s = k.st; const rx = k.xs.reduce((b, x) => (x.wind || 0) > (b.wind || 0) ? x : b, k.xs[0]);
    const rel = shoreRel(s.wdir, f);
    let extra = 0; const why = [];
    if ((s.wave || 0) >= 0.6 && rel !== 'esen') { extra += 20; why.push('dalga'); }
    if ((s.cur || 0) >= 0.5) { extra += 20; why.push('akıntı'); }
    return '<div class="fblock"><div class="fbh"><b class="mono">' + hhmm(k.a) + '–' + hhmm(k.b) + '</b>' + (s.bHi != null ? '<span class="bftb" style="' + bftStyle(s.bHi) + '">' + s.bHi + '</span>' : '') + (s.cls ? '<span class="chip ' + s.cls + '">' + s.cls + '</span>' : '') + '</div>' +
      '<p>' + (s.bHi == null ? 'Rüzgâr verisi yok.' : 'Rüzgâr ' + (s.wdir != null ? windName(s.wdir) + ' ' : '') + spanTxt(s.bLo, s.bHi, 'Bft') + (rel ? ' · ' + esc(REL_TXT[rel] || rel) : '') + (s.wave != null ? ' · dalga ' + f1(s.wave) + ' m' : '') + '. ' +
        esc(f == null ? '' : shoreAdvice(rx, f)) + ' ' + (extra ? 'Çapalı kurşun, <b>+' + extra + ' g</b> (' + why.join(' ve ') + ').' : 'Normal kurşun yeter.')) + '</p></div>';
  });
  return '<div class="row" style="justify-content:space-between;align-items:center"><h3>Kıyı ve kurşun</h3>' + segBtns('mode', [['tekne', 'Tekne'], ['kiyi', 'Kıyı']], 'kiyi') + '</div>' +
    (f == null ? '<p class="dline">Kıyının bakışı bilinmiyor. Telefonu denize doğru tut ve “Pusulayla al”a dokun ya da yönü seç.</p>' : '<p class="note">Kıyı <b>' + dir8(f) + '</b> yönüne bakıyor (' + Math.round(f) + '°).</p>') +
    shoreControls(Lc, f) + rows.join('');
}
