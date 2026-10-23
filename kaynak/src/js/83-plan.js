// ---------------------------------------------------------------- 83 · takvim uyarısı (.ics), çıkış listesi, güvenlik mesajı, yedek hatırlatma
// Takvim uyarısı (v0.21): kurala uyan av pencereleri alarmıyla telefonun takvimine eklenir; alarmı telefonun takvimi çalar.
//  T1 en çok 3 nokta: her pencerede en iyi nokta yazılır (balık × deniz sınıfı); kara noktasında av penceresi yok
//  T2 kural: rüzgâr, dalga, balık + hedef tür (mevsiminde ve suyu uygun), su sıcaklığı aralığı, solunar yıldızı, akıntı aralığı
//  T3 etkinlik notunda hazırlık: 3 rig, kurşun, eksik malzeme, yem
//  T4 akşam özeti: her akşam (varsayılan 20:00) ertesi günün özeti tek bir takvim notu
//  T5 etkinlikteki bağlantı uygulamayı o gün, o bölüm ve o nokta seçili açar (#av=…)
//  T6 takvime eklenmiş pencere bozulursa (rüzgâr arttı…) "İPTAL" olarak, kayan pencere yeni saatiyle aynı kimlikle güncellenir;
//     uygulama açılınca üstte bildirilir. Uygulama arka planda çalışamadığı için güncelleme uygulama açıldığında hazırlanır.
//  T7 alarmlar: çıkıştan önce son hava kontrolü, bir gün önce hazırlık (yem ve eksikler)
const ALERT_DEF = {bft: 3, wave: 0.5, fish: 4, part: 'ikisi', lead: 120, days: 7, sp: '', suMin: '', suMax: '', star: '', curMin: '', curMax: '', locs: null, sum: 1, sumH: 20, prep: 18};
const alertCfg = () => Object.assign({}, ALERT_DEF, S.settings.alert || {});
const ALERT_MAX = 3, LSA = 'alyssa-als';
const isSet = v => v !== '' && v != null;
function alertLocs(cfg){
  const ids = ((cfg || alertCfg()).locs || []).filter(id => S.locations[id]);
  return (ids.length ? ids : calLocs()).slice(0, ALERT_MAX);
}
function toggleAlertLoc(id){
  const c = alertCfg(); let ids = alertLocs(c).slice();
  if (ids.includes(id)) { if (ids.length > 1) ids = ids.filter(x => x !== id); }
  else { if (ids.length >= ALERT_MAX) { toast('En çok ' + ALERT_MAX + ' nokta'); return; } ids.push(id); }
  c.locs = ids; S.settings.alert = c; persist(); openMore('uyari', true);
}
const wxOf = L => L.id === S.active ? (S.wx && S.wx.raw ? S.wx : null) : (wxFresh(MWX[L.id], L) ? MWX[L.id] : null);
// eksik nokta verisini çek (5 dk'da bir en çok bir deneme), gelince yeniden çiz
function wxNeed(Ls, after){
  Ls.forEach(L => { if (L.id === S.active || MWX_LOAD[L.id] || Date.now() - (MWX_FAIL[L.id] || 0) < 5 * 60000) return;
    loadWxFor(L).then(() => { if (!MWX[L.id]) MWX_FAIL[L.id] = Date.now(); ALERT_C.sig = null; after(); }); });
}
// pencerenin koşulları (pencere ±30 dk): en çok rüzgâr (Bft), dalga, akıntı; ortalama su
function winStats(w){
  const hs = WX.hours.filter(x => x.t >= new Date(w.a.getTime() - 1800000) && x.t <= new Date(w.b.getTime() + 1800000));
  const vals = k => hs.map(x => x[k]).filter(v => v != null);
  const mx = k => { const v = vals(k); return v.length ? Math.max(...v) : null; };
  const sv = vals('sst');
  return {bft: bft(mx('wind') || 0), wave: mx('wave') || 0, cur: mx('cur'), sst: sv.length ? sv.reduce((a, b) => a + b, 0) / sv.length : null, n: hs.length};
}
const suT = c => f0(tempNum(c)) + '°';
// kurala uymayan koşullar (boşsa uyuyor)
function ruleFail(cfg, dd, w, st){
  const out = [];
  if (w.fish < cfg.fish) out.push('balık ' + w.fish + '/5');
  if (st.bft > cfg.bft) out.push('rüzgâr ' + st.bft + ' Bft');
  if (st.wave > cfg.wave) out.push('dalga ' + f1(st.wave) + ' m');
  if (isSet(cfg.star) && dd.sol.stars < +cfg.star) out.push('solunar ' + dd.sol.stars + ' yıldız');
  if (isSet(cfg.curMin)) { if (st.cur == null) out.push('akıntı verisi yok'); else if (st.cur < +cfg.curMin) out.push('akıntı ' + f1(st.cur) + ' kn'); }
  if (isSet(cfg.curMax) && st.cur != null && st.cur > +cfg.curMax) out.push('akıntı ' + f1(st.cur) + ' kn');
  const sst = st.sst != null ? st.sst : dd.sst;
  if (isSet(cfg.suMin) || isSet(cfg.suMax)) {
    if (sst == null) out.push('su sıcaklığı verisi yok');
    else if ((isSet(cfg.suMin) && sst < +cfg.suMin) || (isSet(cfg.suMax) && sst > +cfg.suMax)) out.push('su ' + suT(sst));
  }
  if (cfg.sp && KB.CAL[cfg.sp]) {
    const m = calMonth(cfg.sp, dd.date.getMonth() + 1);
    if (m < 2) out.push(spName(cfg.sp) + ' mevsimi değil');
    else if (sst != null && tempFit(sst, KB.CAL[cfg.sp][1]) < 0.5) out.push('su ' + suT(sst) + ' ' + spName(cfg.sp) + ' için ' + tempWord(sst, KB.CAL[cfg.sp][1]));
  }
  return out;
}
// T3: pencere için hazırlık (o noktanın verisiyle hesaplanır: withLoc içinde çağrılır)
function prepFor(dd, part, w, cfg){
  const R = recommend(dd, part === 'gece', null); let ok = R.filter(x => x.ok); let note = '';
  if (cfg.sp) { const f = ok.filter(x => (x.rg.species || []).includes(cfg.sp)); if (f.length) ok = f.concat(ok.filter(x => !f.includes(x))); else note = spName(cfg.sp) + ' için kurulu hazır rig yok'; }
  const top = ok.slice(0, 3), ld = top[0] ? leadFor(top[0].rg, dd, (w && w.x) || R.x) : null;
  const slotName = sl => { const e = sl.t.envanter || {}, tk = sl.t.turkiye || {}, it = e.item && ITEMS[e.item]; return (it ? it.name : tk.name || e.name || sl.label) + ((e.size || tk.size) ? ' ' + (e.size || tk.size) : ''); };
  const miss = R.filter(x => !x.ok).slice(0, 2).map(x => (x.rg.code || x.rg.name) + ': ' + missingOf(x.rg).slice(0, 3).map(slotName).join(', '));
  const bait = [...new Set(top.map(x => { const bp = baitPick(x.rg); return bp.use && bp.use.st ? bp.use.t + (bp.use.st === 'var' ? ' (elinde)' : ' (al)') : ''; }).filter(Boolean))];
  return {rigs: top.map(x => (x.rg.code ? x.rg.code + ' · ' : '') + x.rg.name), codes: top.map(x => x.rg.code || x.rg.name), kursun: ld && ld.kursun ? ld.kursun : null, miss, bait, note};
}
const prepLines = p => [p.rigs.length ? 'Rigler: ' + p.rigs.join(' | ') : 'Hazır rig yok' + (p.note ? ' (' + p.note + ')' : ''), p.kursun ? 'Kurşun: ' + stripTags(p.kursun) : '',
  p.bait.length ? 'Yem: ' + p.bait.join(', ') : '', p.miss.length ? 'Eksik: ' + p.miss.join(' · ') : '', p.note && p.rigs.length ? p.note : ''].filter(Boolean);
// bir noktanın kurala uyan pencereleri (withLoc içinde)
function locMatches(L, cfg, now){
  const out = [], seen = [];   // gece bölümü ertesi sabaha uzanır: çakışma bütün günler boyunca kontrol edilir
  days().slice(0, cfg.days).forEach(dd => {
    const parts = cfg.part === 'ikisi' ? ['gun', 'gece'] : [cfg.part];
    parts.forEach(part => bestWindows(dd, part, 2, dd.key === dateKey(now) ? now : null).forEach(w => {
      if (w.b <= now || seen.some(s => s.a < w.b && w.a < s.b)) return;
      const st = winStats(w); if (ruleFail(cfg, dd, w, st).length) return;
      seen.push(w);
      out.push({L, dd, w, part, st, label: winLabel(w), score: w.pct * (SEA_F[w.cls] || 0.6), prep: prepFor(dd, part, w, cfg)});
    }));
  });
  return out;
}
// T4: noktaların günlük özeti (her gün için gündüz ve gece en iyi penceresi)
function locDays(L, cfg){
  return days().slice(0, cfg.days + 1).map(dd => {
    const parts = ['gun', 'gece'].map(part => { const w = bestWindows(dd, part, 1)[0] || null; return {part, w, cls: part === 'gun' ? dd.clsD : dd.clsN}; });
    const best = parts.filter(p => p.w).sort((p, q) => q.w.pct * (SEA_F[q.w.cls] || 0.6) - p.w.pct * (SEA_F[p.w.cls] || 0.6))[0] || null;
    return {key: dd.key, date: dd.date, clsD: dd.clsD, clsN: dd.clsN, wd: bft(dd.wd), wn: bft(dd.wn), wave: dd.wave, stars: dd.sol.stars, best,
      score: best ? best.w.pct * (SEA_F[best.w.cls] || 0.6) : 0, prep: best ? prepFor(dd, best.part, best.w, cfg) : null};
  });
}
// tüm hesap: noktalar, eşleşmeler (zamanı çakışan farklı noktalar tek "pencere" olur), günlük özetler
const ALERT_C = {sig: null, res: null};
function alertCompute(cfg){
  cfg = cfg || alertCfg();
  const ids = alertLocs(cfg), Ls = ids.map(id => S.locations[id]), now = new Date();
  const sig = JSON.stringify([cfg, ids, Ls.map(L => { const w = wxOf(L); return [L.id, L.kind, L.bottom, L.bottomEst, w ? w.at : 0]; }), Math.floor(Date.now() / 600000), RIG_LIST.length, CATCHES_V, S.settings.ftarget, S.mode]);
  if (ALERT_C.sig === sig) { ALERT_C.res.diff = alertDiff(ALERT_C.res); return ALERT_C.res; }   // karşılaştırma her seferinde (takvime ekleme bilgisi değişmiş olabilir)
  const miss = [], land = [], all = [], perLoc = {};
  Ls.forEach(L => {
    if (locKind(L) === 'kara') { land.push(L); return; }
    const w = wxOf(L); if (!w) { miss.push(L); return; }
    const run = () => ({m: locMatches(L, cfg, now), d: cfg.sum ? locDays(L, cfg) : []});
    const r = L.id === S.active ? run() : withLoc(L, w, run);
    all.push(...r.m); perLoc[L.id] = r.d;
  });
  all.sort((p, q) => p.w.a - q.w.a);
  const slots = [];
  all.forEach(m => { const s = slots.find(s => !s.items.some(o => o.L === m.L) && s.items.some(o => o.w.a < m.w.b && m.w.a < o.w.b)); if (s) s.items.push(m); else slots.push({items: [m]}); });
  const locset = ids.slice().sort().join('.'), cnt = {};
  slots.forEach(s => { s.items.sort((p, q) => q.score - p.score); s.best = s.items[0];
    const k = dateKey(s.best.w.a).replace(/-/g, '') + '-' + slugTR(s.best.label); cnt[k] = (cnt[k] || 0) + 1;   // pencerenin gerçek tarihi (gece penceresi ertesi sabah olabilir)
    s.uid = 'av-' + k + (cnt[k] > 1 ? '-' + cnt[k] : '') + '-' + locset + '@alyssa'; });
  // T4: yarın ve sonrası için akşam özeti (önceki akşam saat sumH'de)
  const sums = [];
  if (cfg.sum) {
    const keys = [...new Set(Object.values(perLoc).flatMap(d => d.map(x => x.key)))].sort();
    keys.forEach(k => {
      const rows = Ls.filter(L => perLoc[L.id]).map(L => ({L, d: perLoc[L.id].find(x => x.key === k)})).filter(r => r.d);
      if (!rows.length) return;
      const d0 = rows[0].d.date, at = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - 1, +cfg.sumH || 20, 0);
      if (at <= now) return;
      const best = rows.filter(r => r.d.score > 0).sort((p, q) => q.d.score - p.d.score)[0] || null;
      sums.push({key: k, date: d0, at, rows, best, uid: 'ozet-' + k.replace(/-/g, '') + '-' + locset + '@alyssa', match: slots.filter(s => s.best.dd.key === k)});
    });
  }
  const res = {cfg, ids, Ls, slots, sums, miss, land, at: now.getTime()};
  res.diff = alertDiff(res);
  ALERT_C.sig = sig; ALERT_C.res = res;
  return res;
}
// ---- T6: son takvime eklenenle karşılaştırma (yalnız bu cihazda; telefonun takvimi cihaza özgü)
const alsGet = () => { try { return JSON.parse(lsGet(LSA) || 'null') || {ids: {}}; } catch (e) { return {ids: {}}; } };
function alertDiff(res){
  const sent = alsGet(), ids = sent.ids || {}, now = Date.now(), cur = {}, missIds = new Set(res.miss.map(L => L.id)), set = res.ids.slice().sort().join('.');
  res.slots.forEach(s => { cur[s.uid] = s; });
  // verisi henüz gelmeyen noktanın pencereleri "bozuldu" sayılmaz
  const gone = Object.keys(ids).filter(u => ids[u].b > now && !cur[u] && !missIds.has(ids[u].loc))
    .map(u => Object.assign({uid: u, why: ids[u].set && ids[u].set !== set ? 'nokta seçimi değişti' : goneWhy(ids[u], res.cfg)}, ids[u]));
  const fresh = res.slots.filter(s => !ids[s.uid]);
  const moved = res.slots.filter(s => { const e = ids[s.uid]; return e && (Math.abs(e.a - s.best.w.a) > 20 * 60000 || Math.abs(e.b - s.best.w.b) > 20 * 60000 || e.loc !== s.best.L.id); });
  return {sent: !!sent.at, sentAt: sent.at || null, gone, fresh, moved, n: gone.length + fresh.length + moved.length};
}
// takvimdeki pencere neden bozuldu: o saatlerin şimdiki tahmini kurala göre
function goneWhy(e, cfg){
  const L = S.locations[e.loc]; if (!L) return 'nokta silindi';
  if (!alertLocs(cfg).includes(e.loc)) return 'nokta uyarıdan çıkarıldı';
  const w = wxOf(L); if (!w) return 'tahmin değişti';
  const run = () => {
    const dd = days().find(d => d.key === e.date); if (!dd) return 'tahmin değişti';
    const a = new Date(e.a), b = new Date(e.b);
    const hs = WX.hours.filter(x => x.t >= new Date(a.getTime() - 1800000) && x.t <= new Date(b.getTime() + 1800000)); if (!hs.length) return 'tahmin değişti';
    const fish = Math.max(...hs.map(x => activity(x).fish));
    const st = winStats({a, b}); const f = ruleFail(cfg, dd, {fish}, st);
    return f.length ? f.slice(0, 2).join(', ') : 'pencere kaydı';
  };
  try { return L.id === S.active ? run() : withLoc(L, w, run); } catch (err) { return 'tahmin değişti'; }
}
// üstteki bildirim: takvime eklenmiş pencereler değiştiyse (yalnız daha önce eklendiyse ve noktaların verisi hazırsa)
function alertBanner(){
  if (PREVIEW || !alsGet().at || !WX) return '';
  let r; try { r = alertCompute(); } catch (e) { return ''; }
  if (r.miss.length || !r.diff.n) return '';
  const d = r.diff, parts = [d.gone.length ? d.gone.length + ' pencere bozuldu (' + d.gone[0].why + ')' : '', d.moved.length ? d.moved.length + ' pencere kaydı' : '', d.fresh.length ? d.fresh.length + ' yeni pencere' : ''].filter(Boolean);
  return '<div class="newver warn"><b>Takvim uyarısı değişti</b><span class="note">' + esc(parts.join(' · ')) + '. Takvimini güncelle; bozulanlar “İPTAL” olarak işaretlenir.</span><div><button class="btn small primary" type="button" data-open="uyari">Takvimi güncelle</button></div></div>';
}
// ---- .ics
const icsDate = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
function icsFold(line){ const out = []; let s = line; while (new TextEncoder().encode(s).length > 74) { let n = 74; while (new TextEncoder().encode(s.slice(0, n)).length > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); }
// T5: uygulamayı o gün, bölüm ve noktayla açan bağlantı
const appUrl = () => location.origin + location.pathname;
const avLink = (key, part, id) => appUrl() + '#av=' + key + '.' + part + '.' + encodeURIComponent(id);
const dayTxt = d => d.getDate() + ' ' + MON3[d.getMonth()] + ' ' + DOW[d.getDay()];
const clsTxt = c => c ? 'deniz ' + c : '';
function slotText(s){
  const m = s.best, L = m.L;
  const title = (m.label + ' av penceresi · ' + locLabel(L) + (s.items.length > 1 ? ' en iyi' : '') + ' · balık %' + m.w.pct + (m.w.cls ? ' · deniz ' + m.w.cls : ''));
  const lines = [dayTxt(m.w.a) + ' · ' + winTxt(m.w) + ' · ' + m.w.evs.map(evChip).join(', '),
    'Rüzgâr en çok ' + m.st.bft + ' Bft, dalga en çok ' + f1(m.st.wave) + ' m' + (m.st.cur != null ? ', akıntı en çok ' + f1(m.st.cur) + ' kn' : '') + (m.st.sst != null ? ', su ' + suT(m.st.sst) : '') + ', solunar ' + m.dd.sol.stars + ' yıldız'];
  if (s.items.length > 1) lines.push('Diğer noktalar: ' + s.items.slice(1).map(o => locLabel(o.L) + ' ' + winTxt(o.w) + ' balık %' + o.w.pct + (o.w.cls ? ' deniz ' + o.w.cls : '')).join(' · '));
  lines.push(...prepLines(m.prep));
  lines.push('Uygulamada aç: ' + avLink(m.dd.key, m.part, L.id), APP_NAME + ' tahmini; çıkmadan önce güncel hava durumuna bak.');
  return {title, desc: lines.join('\n'), short: winTxt(m.w) + ' ' + locLabel(L) + ' · rüzgâr ≤ ' + m.st.bft + ' Bft, dalga ≤ ' + f1(m.st.wave) + ' m'};
}
function sumText(z){
  const b = z.best;
  const title = 'Yarın · ' + (b ? locLabel(b.L) + ' · ' + winLabel(b.d.best.w) + ' ' + winTxt(b.d.best.w) + ' · balık %' + b.d.best.w.pct + (b.d.best.w.cls ? ' · deniz ' + b.d.best.w.cls : '') : 'belirgin av penceresi yok');
  const lines = [dayTxt(z.date) + ' özeti'];
  z.rows.forEach(({L, d}) => lines.push(locLabel(L) + ': gündüz ' + (d.clsD || '–') + ', gece ' + (d.clsN || '–') + ', rüzgâr ' + d.wd + '/' + d.wn + ' Bft' + (d.wave != null ? ', dalga ' + f1(d.wave) + ' m' : '') + ', solunar ' + d.stars + ' yıldız' +
    (d.best ? '; en iyi ' + winLabel(d.best.w).toLowerCase() + ' ' + winTxt(d.best.w) + ' balık %' + d.best.w.pct : '')));
  lines.push(z.match.length ? 'Kurala uyan pencere: ' + z.match.map(s => winTxt(s.best.w) + ' ' + locLabel(s.best.L)).join(', ') : 'Kurala uyan pencere yok.');
  if (b && b.d.prep) lines.push(...prepLines(b.d.prep));
  if (b) lines.push('Uygulamada aç: ' + avLink(z.key, b.d.best.part, b.L.id));
  return {title, desc: lines.join('\n')};
}
function prepAlarmTxt(s){ const p = s.best.prep; return 'Yarın ' + winTxt(s.best.w) + ' ' + locLabel(s.best.L) + ': ' + [p.bait.length ? 'yem: ' + p.bait.join(', ') : '', p.miss.length ? 'eksik: ' + p.miss.join(' · ') : '', p.rigs.length ? 'rigler: ' + p.codes.join(', ') : ''].filter(Boolean).join(' · '); }
function buildIcs(res){
  const cfg = res.cfg, now = new Date(), sent = alsGet(), seq = u => ((sent.seq || {})[u] || 0) + 1;
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Alyssa by Barbossa App//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Alyssa av pencereleri'];
  const ev = (uid, a, b, title, desc, extra, alarms) => { out.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + icsDate(now), 'SEQUENCE:' + seq(uid), 'DTSTART:' + icsDate(a), 'DTEND:' + icsDate(b), 'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc), ...(extra || []));
    (alarms || []).forEach(([trig, txt]) => out.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(txt), trig, 'END:VALARM')); out.push('END:VEVENT'); };
  res.slots.forEach(s => {
    const m = s.best, t = slotText(s), L = m.L, al = [['TRIGGER:-PT' + cfg.lead + 'M', 'Son hava kontrolü: ' + t.short + '. Uygulamayı açıp güncel tahmine bak.']];
    if (isSet(cfg.prep)) { const pt = new Date(m.w.a.getFullYear(), m.w.a.getMonth(), m.w.a.getDate() - 1, +cfg.prep, 0); if (pt > now && pt.getTime() < m.w.a.getTime() - cfg.lead * 60000) al.push(['TRIGGER;VALUE=DATE-TIME:' + icsDate(pt), 'Hazırlık · ' + prepAlarmTxt(s)]); }
    ev(s.uid, m.w.a, m.w.b, t.title, t.desc, ['LOCATION:' + icsEsc(locLabel(L)), 'GEO:' + L.lat.toFixed(5) + ';' + L.lon.toFixed(5), 'URL:' + avLink(m.dd.key, m.part, L.id), 'STATUS:CONFIRMED'], al);
  });
  res.diff.gone.forEach(e => ev(e.uid, new Date(e.a), new Date(e.b), 'İPTAL · ' + e.title, 'Kurala artık uymuyor: ' + e.why + '.\n' + APP_NAME + ' takvim uyarısı.', ['STATUS:CANCELLED']));
  res.sums.forEach(z => { const t = sumText(z); ev(z.uid, z.at, new Date(z.at.getTime() + 15 * 60000), t.title, t.desc, ['STATUS:CONFIRMED'].concat(z.best ? ['URL:' + avLink(z.key, z.best.d.best.part, z.best.L.id)] : []), [['TRIGGER:PT0M', t.title]]); });
  out.push('END:VCALENDAR');
  return out.map(icsFold).join('\r\n') + '\r\n';
}
// takvime eklenen pencereler bu cihazda saklanır (T6 karşılaştırması için); iptaller bir kez gönderilince düşer
function alsSave(res){
  const sent = alsGet(), seq = Object.assign({}, sent.seq || {}), ids = {};
  const set = res.ids.slice().sort().join('.');
  res.slots.forEach(s => { const m = s.best; ids[s.uid] = {a: m.w.a.getTime(), b: m.w.b.getTime(), title: slotText(s).title, loc: m.L.id, date: m.dd.key, part: m.part, set}; seq[s.uid] = (seq[s.uid] || 0) + 1; });
  // verisi gelmemiş noktaların daha önce eklenmiş pencereleri korunur (bir dahaki karşılaştırmada bakılır)
  const old = sent.ids || {}, missIds = new Set(res.miss.map(L => L.id));
  Object.keys(old).forEach(u => { if (!ids[u] && missIds.has(old[u].loc) && old[u].b > Date.now()) ids[u] = old[u]; });
  res.diff.gone.forEach(e => { seq[e.uid] = (seq[e.uid] || 0) + 1; });
  res.sums.forEach(z => { seq[z.uid] = (seq[z.uid] || 0) + 1; });
  Object.keys(seq).forEach(u => { if (!ids[u] && !/^ozet-/.test(u) && !res.diff.gone.some(e => e.uid === u)) delete seq[u]; });
  lsSet(LSA, JSON.stringify({at: Date.now(), ids, seq}));
  ALERT_C.sig = null;
}
const gcalUrl = s => { const t = slotText(s); const d = t.desc.length > 900 ? t.desc.slice(0, 900) + '…' : t.desc;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(t.title) + '&dates=' + icsDate(s.best.w.a) + '/' + icsDate(s.best.w.b) + '&details=' + encodeURIComponent(d) + '&location=' + encodeURIComponent(locLabel(s.best.L)); };
async function deliverFile(name, type, text){
  const file = new File([text], name, {type});
  try { if (navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], title: name}); return 'share'; } } catch (e) { if (e && e.name === 'AbortError') return 'abort'; }
  const u = URL.createObjectURL(file); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return 'download';
}
async function alertExport(){
  const res = alertCompute();
  if (!res.slots.length && !res.diff.gone.length && !res.sums.length) { toast('Takvime eklenecek bir şey yok'); return; }
  const r = await deliverFile('alyssa-av-pencereleri.ics', 'text/calendar', buildIcs(res));
  if (r === 'abort') return;
  const n = res.slots.length, g = res.diff.gone.length;
  alsSave(res); renderNewVersion(); if (ui.sheet === 'uyari') openMore('uyari', true);
  toast(n + ' pencere' + (g ? ', ' + g + ' iptal' : '') + (res.sums.length ? ', ' + res.sums.length + ' akşam özeti' : '') + ' takvim dosyasında');
}
// T5: bağlantıyla açılış (#av=2026-10-24.gece.1)
function openAvLink(raw){
  const [key, part, id0] = String(raw || '').split('.'); const id = decodeURIComponent(id0 || '');
  try { history.replaceState(history.state, '', location.pathname + location.search + '#fishing'); } catch (e) {}
  if (id && S.locations[id] && S.active !== id) { S.active = id; persist(); WX = null; const L = S.locations[id]; if (wxFresh(MWX[id], L)) { S.wx = MWX[id]; WX = buildWx(); } loadWeather(); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(key || '')) ui.fday = key;
  if (part === 'gun' || part === 'gece') ui.fpart = part;
  if (!$('sheet').hidden) closeSheet(true);
  show('fishing'); renderAll();
}
// ---- sayfa
function sheetAlert(){
  const cfg = alertCfg(), all = Object.values(S.locations), ids = alertLocs(cfg);
  const Ls = ids.map(id => S.locations[id]);
  if (!WX && !Ls.some(L => wxOf(L))) return sheetBar('Takvim uyarısı') + '<div class="stack"><div class="empty">Hava verisi yok; önce bir konum seç.</div></div>';
  const res = alertCompute(cfg);
  if (res.miss.length) wxNeed(res.miss, () => { if (ui.sheet === 'uyari') openMore('uyari', true); });
  const sel = (k, opts) => '<select data-alert="' + k + '">' + opts.map(([v, t]) => '<option value="' + v + '"' + (String(cfg[k]) === String(v) ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>';
  const reg = regionOf(loc()), mine = new Set(RIG_LIST.flatMap(r => r.species || []));
  const sps = KB.SPECIES.filter(s => KB.CAL[s.id] && (s.bol.includes(reg) || mine.has(s.id))).sort((a, b) => (mine.has(b.id) - mine.has(a.id)) || trCmp(a.name, b.name));
  const T = [12, 14, 16, 18, 20, 22, 24, 26];
  const d = res.diff;
  const chg = d.sent && d.n ? '<section class="set achg"><h4>Takvime son eklemeden beri</h4>' +
    d.gone.map(e => '<div class="sp"><b>İPTAL</b> ' + esc(dayTxt(new Date(e.a)) + ' ' + hm(new Date(e.a)) + '–' + hm(new Date(e.b)) + ' · ' + (S.locations[e.loc] ? locLabel(S.locations[e.loc]) : '')) + ' · <span class="warnt">' + esc(e.why) + '</span></div>').join('') +
    d.moved.map(s => '<div class="sp"><b>Değişti</b> ' + esc(dayTxt(s.best.w.a) + ' · ' + winTxt(s.best.w) + ' · ' + locLabel(s.best.L)) + '</div>').join('') +
    d.fresh.map(s => '<div class="sp"><b>Yeni</b> ' + esc(dayTxt(s.best.w.a) + ' · ' + winTxt(s.best.w) + ' · ' + locLabel(s.best.L)) + '</div>').join('') + '</section>' : '';
  const slotHtml = s => { const m = s.best;
    return '<div class="item aslot"><div class="row" style="justify-content:space-between;gap:6px"><b>' + esc(dayTxt(m.w.a) + ' · ' + m.label + ' ' + winTxt(m.w)) + '</b>' + fishHtml(m.w.fish) + '</div>' +
      s.items.map((o, i) => '<div class="sp">' + (s.items.length > 1 && !i ? '<em class="besttag">En iyi</em> ' : '') + esc(locLabel(o.L)) + ' · balık %' + o.w.pct + (o.w.cls ? ' · <span class="chip ' + o.w.cls + '">deniz ' + o.w.cls + '</span>' : '') +
        ' · rüzgâr ≤ ' + o.st.bft + ' Bft · dalga ' + f1(o.st.wave) + ' m' + (o.st.cur != null ? ' · akıntı ' + f1(o.st.cur) + ' kn' : '') + (i ? ' · ' + winTxt(o.w) : '') + '</div>').join('') +
      '<details><summary class="note">Hazırlık</summary><div class="sp">' + prepLines(m.prep).map(esc).join('<br>') + '</div></details>' +
      '<div class="sp"><a href="' + gcalUrl(s) + '" target="_blank" rel="noopener">Google Takvim</a> · <button class="linkbtn" type="button" data-avgo="' + esc(m.dd.key + '.' + m.part + '.' + m.L.id) + '">Fishing’de aç</button></div></div>'; };
  const nxt = res.sums[0];
  return sheetBar('Takvim uyarısı') + '<div class="stack">' +
    '<p class="sub">Kurala uyan av pencereleri hazırlık notu ve alarmlarıyla telefonunun takvimine eklenir. Alarmı takvim çalar; uygulama kapalıyken de çalışır.</p>' +
    (all.length > 1 ? '<section class="set"><h4>Noktalar · en çok ' + ALERT_MAX + '</h4><div class="seg wrapseg">' + all.map(L => '<button class="btn small" type="button" data-alloc="' + esc(L.id) + '" aria-pressed="' + ids.includes(L.id) + '">' + esc(locLabel(L)) + ' <em class="kd ' + locKind(L) + '">' + KIND_TXT[locKind(L)] + '</em></button>').join('') + '</div>' +
      '<p class="note">Aynı saatte birden çok noktada pencere varsa en iyisi (balık × deniz sınıfı) yazılır.' + (res.land.length ? ' Kara noktasında av penceresi yok: ' + esc(res.land.map(locLabel).join(', ')) + '.' : '') + '</p></section>' : '') +
    '<section class="set"><h4>Kural</h4><div class="fields">' +
    '<label class="f">Rüzgâr en çok' + sel('bft', [1, 2, 3, 4, 5, 6].map(v => [v, v + ' Bft'])) + '</label>' +
    '<label class="f">Dalga en çok' + sel('wave', [[0.3, '0,3 m'], [0.5, '0,5 m'], [0.8, '0,8 m'], [1, '1 m'], [1.5, '1,5 m']]) + '</label>' +
    '<label class="f">Balık en az' + sel('fish', [1, 2, 3, 4, 5].map(v => [v, v + ' balık (%' + ((v - 1) * 20 + 1) + '+)'])) + '</label>' +
    '<label class="f">Ne zaman' + sel('part', [['ikisi', 'Gündüz ve gece'], ['gun', 'Gündüz'], ['gece', 'Gece']]) + '</label>' +
    '<label class="f">Hedef tür' + sel('sp', [['', 'Fark etmez']].concat(sps.map(s => [s.id, s.name + (mine.has(s.id) ? ' ●' : '')]))) + '</label>' +
    '<label class="f">Solunar en az' + sel('star', [['', 'Fark etmez'], [2, '2 yıldız'], [3, '3 yıldız'], [4, '4 yıldız'], [5, '5 yıldız']]) + '</label>' +
    '<label class="f">Akıntı en az' + sel('curMin', [['', 'Fark etmez'], [0.2, '0,2 kn'], [0.4, '0,4 kn'], [0.6, '0,6 kn']]) + '</label>' +
    '<label class="f">Akıntı en çok' + sel('curMax', [['', 'Fark etmez'], [0.6, '0,6 kn'], [0.8, '0,8 kn'], [1, '1 kn'], [1.5, '1,5 kn']]) + '</label>' +
    '<label class="f">Su en az' + sel('suMin', [['', 'Fark etmez']].concat(T.map(v => [v, suT(v)]))) + '</label>' +
    '<label class="f">Su en çok' + sel('suMax', [['', 'Fark etmez']].concat(T.map(v => [v, suT(v)]))) + '</label>' +
    '<label class="f">Kaç gün' + sel('days', [[3, '3 gün'], [7, '7 gün'], [10, '10 gün'], [15, '15 gün']]) + '</label></div>' +
    (cfg.sp ? '<p class="note">' + esc(spName(cfg.sp)) + ': mevsiminde olduğu ve suyu uygun olduğu günler; hazırlıkta önce bu türe kurulu rigler.</p>' : '') + '</section>' +
    '<section class="set"><h4>Takvime eklenecekler</h4><div class="fields">' +
    '<label class="f">Son hava kontrolü' + sel('lead', [[30, '30 dk önce'], [60, '1 saat önce'], [120, '2 saat önce'], [720, '12 saat önce']]) + '</label>' +
    '<label class="f">Hazırlık alarmı' + sel('prep', [['', 'Kapalı'], [17, 'Bir gün önce 17:00'], [18, 'Bir gün önce 18:00'], [19, 'Bir gün önce 19:00'], [20, 'Bir gün önce 20:00']]) + '</label>' +
    '<label class="f">Akşam özeti' + sel('sum', [[1, 'Açık'], [0, 'Kapalı']]) + '</label>' +
    (cfg.sum ? '<label class="f">Özet saati' + sel('sumH', [[19, '19:00'], [20, '20:00'], [21, '21:00']]) + '</label>' : '') + '</div>' +
    '<p class="note">Etkinliğin notunda 3 rig, kurşun, yem ve eksikler yazar; bağlantıya dokununca uygulama o gün ve bölümle açılır.</p></section>' +
    chg +
    (res.miss.length ? '<p class="note">Veri yükleniyor: ' + esc(res.miss.map(locLabel).join(', ')) + '…</p>' : '') +
    (!Ls.some(L => locKind(L) !== 'kara') ? '<div class="empty">Seçili noktalar karada: av penceresi hesaplanmaz. Deniz ya da kıyı noktası seç.</div>' :
      res.slots.length ? '<div class="eyebrow">' + res.slots.length + ' pencere uyuyor · ' + esc(Ls.filter(L => locKind(L) !== 'kara').map(locLabel).join(', ')) + '</div>' + res.slots.map(slotHtml).join('') :
      '<div class="empty">Önümüzdeki ' + cfg.days + ' günde bu kurala uyan pencere yok. Rüzgâr ya da dalga sınırını gevşet, balık sınırını düşür' + (cfg.sp || isSet(cfg.star) || isSet(cfg.curMin) || isSet(cfg.suMin) || isSet(cfg.suMax) ? ', ek koşulları kaldır' : '') + '.</div>') +
    (nxt ? '<section class="set asum"><h4>Akşam özeti · ' + esc(dayTxt(nxt.at) + ' ' + hm(nxt.at)) + '</h4><p class="note"><b>' + esc(sumText(nxt).title) + '</b></p><p class="note">' + esc(sumText(nxt).desc.split('\n').slice(1, 1 + nxt.rows.length).join(' · ')) + '</p>' +
      (res.sums.length > 1 ? '<p class="note">Takvime ' + res.sums.length + ' akşam için özet eklenir; her biri ertesi günü anlatır.</p>' : '') + '</section>' : '') +
    (PREVIEW ? '<p class="note">Takvim dosyası telefona kurulan uygulamada iner; önizlemede yalnızca liste görünür.</p>' :
      (res.slots.length || d.gone.length || res.sums.length ? '<button class="btn primary" type="button" data-act="icsAll">' + (d.sent && d.n ? 'Takvimi güncelle (' + d.n + ' değişiklik)' : 'Hepsini takvime ekle') + '</button>' : '') +
      '<p class="note">iPhone’da açılan pencerede “Tümünü Ekle”ye dokun. Tahmin değişirse uygulama açılınca üstte söyler; yeniden eklediğinde aynı etkinlikler güncellenir, bozulanlar “İPTAL” olur. ' +
      'Uygulama kapalıyken kendiliğinden güncelleyemez. Bağlantı Android’de uygulamayı açar; iPhone’da Safari’de açılır (hesabınla giriş yaptıysan aynı veriler gelir).</p>') + '</div>';
}
// ---- çıkış listesi ve güvenlik mesajı
const BOAT_KIT = ['Can yelekleri (herkese bir)', 'VHF telsiz ya da şarjlı telefon (su geçirmez kılıfta)', 'Yakıt: dolu depo ve yedek', 'Çapa ve halat', 'İlk yardım çantası', 'El feneri / kafa lambası', 'Su ve yiyecek', 'Güneş kremi, şapka, güneş gözlüğü', 'Pense, makas, iğne çıkarıcı', 'Kepçe ya da kanca', 'Buz kutusu ve buz', 'Paraşüt çapa (drift sock)'];
const SHORE_KIT = ['Kamış ayağı', 'Kafa lambası ve yedek pil', 'Kaymaz ayakkabı', 'Kepçe ya da uzun saplı kanca', 'Pense ve iğne çıkarıcı', 'Yedek şok lider ve köstek', 'Çapalı (grip) kurşun', 'Yem kutusu ve havlu', 'Buz kutusu', 'Şarjlı telefon', 'Su, mont ya da yağmurluk'];
// Fishing'de seçilen gün ve bölümün (gündüz/gece) 3 rigi; Fishing açılmadıysa bugünün gündüz ve gece ilk ikileri
function checklist(){
  const ds = days(); const dd = (ui.fday && ds.find(d => d.key === ui.fday)) || ds.find(d => d.key === dateKey(new Date())) || ds[0];
  const out = {rigs: [], gear: [], bait: [], kit: shoreMode() ? SHORE_KIT : BOAT_KIT, dd, part: ui.fpart || null};
  if (dd && RIG_LIST.length) {
    const parts = ui.fpart ? [ui.fpart === 'gece'] : [false, true];
    const recs = parts.flatMap(n => { const R = recommend(dd, n); return R.filter(x => x.ok).slice(0, ui.fpart ? F_TOP : 2).map(x => ({rg: x.rg, x: R.x, sub: x.sub})); });
    const seenRig = new Set(), gear = {}, bait = new Set();
    recs.forEach(({rg, x, sub}) => {
      if (seenRig.has(rg.id)) return; seenRig.add(rg.id); out.rigs.push(rg);
      rg.slots.forEach(sl => { const c = sub && sub.list.find(z => z.sl === sl); const e = c ? {item: c.to.item, size: c.to.size} : sl.t.envanter || {}; const it = e.item && ITEMS[e.item]; const nm = (it ? it.name : e.name || sl.label) + (e.size ? ' ' + e.size : '') + (c ? ' (yedek)' : ''); gear[nm] = (gear[nm] || []).concat(rg.code || rg.name); });
      const ld = leadFor(rg, dd, x); if (ld && ld.kursun) { const k = 'Kurşun ' + ld.kursun + (ld.grip ? ' (çapalı)' : ''); gear[k] = (gear[k] || []).concat(rg.code || rg.name); }
      const bp = baitPick(rg); if (bp.use && bp.use.st) bait.add(bp.use.t + (bp.use.st === 'var' ? ' (elinde)' : bp.use.st === 'yok' ? ' (gitmeden al)' : ''));
    });
    out.gear = Object.entries(gear).map(([k, v]) => ({k, v: [...new Set(v)]}));
    out.bait = [...bait];
  }
  return out;
}
function sheetChecklist(){
  const c = checklist(); const today = dateKey(new Date());
  if (!S.check || S.check.date !== today) S.check = {date: today, done: {}};
  const box = (key, label, sub) => '<label class="chk ckl"><input type="checkbox" data-ck="' + esc(key) + '"' + (S.check.done[key] ? ' checked' : '') + '> <span>' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></label>';
  const Lc = loc(); const sp = S.settings.safety || {};
  return sheetBar('Çıkış listesi') + '<div class="stack">' +
    '<p class="sub">' + (shoreMode() ? 'Kıyı' : 'Tekne') + ' · ' + (Lc ? esc(Lc.name) : 'konum yok') + ' · işaretler bugün için saklanır.</p>' +
    (c.rigs.length ? '<section class="set"><h4>' + (c.part && c.dd ? esc(dayLabel(c.dd.date, 0, dateKey(new Date())) + ' · ' + PART_TXT[c.part]) + ' rigleri' : 'Bugünün rigleri') + '</h4><p class="note">' + esc(c.rigs.map(r => (r.code ? r.code + ' ' : '') + r.name).join(' · ')) + '</p>' +
      c.gear.map(g => box('g:' + g.k, g.k, g.v.join(', '))).join('') + (c.bait.length ? c.bait.map(b => box('y:' + b, 'Yem: ' + b)).join('') : '') + '</section>' :
      '<section class="set"><h4>Rigler</h4><p class="note">Önerilen hazır rig yok; Fishing’de gün ve bölüm seçince önerilen riglerin malzemeleri burada listelenir.</p></section>') +
    '<section class="set"><h4>' + (shoreMode() ? 'Kıyı ekipmanı' : 'Tekne ve güvenlik') + '</h4>' + c.kit.map(k => box('k:' + k, k)).join('') + '</section>' +
    '<section class="set"><h4>Güvenlik mesajı</h4><p class="note">Çıkmadan önce bir yakınına nerede olduğunu ve dönüş saatini WhatsApp’tan gönder.</p>' +
    '<div class="fields"><label class="f">Dönüş saati<input type="time" id="sf-ret" value="' + esc(sp.ret || '') + '"></label>' +
    '<label class="f">Kime (telefon, isteğe bağlı)<input id="sf-tel" inputmode="tel" value="' + esc(sp.tel || '') + '" placeholder="905xxxxxxxxx"></label>' +
    '<label class="f wide">Not (tekne adı, kişi sayısı)<input id="sf-not" value="' + esc(sp.not || '') + '" placeholder="Ör. Alya 8, 2 kişi"></label></div>' +
    '<div class="row"><button class="btn primary" type="button" data-act="safety">WhatsApp ile gönder</button>' + (navigator.share ? '<button class="btn" type="button" data-act="safetyShare">Paylaş…</button>' : '') + '</div></section>' +
    '<button class="btn small" type="button" data-act="ckReset">İşaretleri temizle</button></div>';
}
function safetyText(){
  const sp = S.settings.safety || {}; const Lc = loc(); const x = nowHour();
  const parts = [shoreMode() ? 'Kıyıda avdayım.' : 'Denize çıktım.'];
  if (Lc) parts.push('Yer: ' + Lc.name + ' (' + ddm(Lc.lat, 'K', 'G') + ' ' + ddm(Lc.lon, 'D', 'B') + ') https://www.google.com/maps/search/?api=1&query=' + Lc.lat.toFixed(5) + ',' + Lc.lon.toFixed(5));
  if (sp.not) parts.push(sp.not + '.');
  if (sp.ret) parts.push('Dönüş: ' + sp.ret + '. Bu saatte haber vermezsem ara.');
  if (x && x.wind != null) parts.push('Hava: rüzgâr ' + bft(x.wind) + ' Bft ' + windName(x.wdir) + (x.wave != null ? ', dalga ' + f1(x.wave) + ' m' : '') + '.');
  return parts.join('\n');
}
function saveSafety(){ S.settings.safety = {ret: ($('sf-ret') || {}).value || '', tel: (($('sf-tel') || {}).value || '').replace(/[^\d]/g, ''), not: (($('sf-not') || {}).value || '').trim()}; persist(); }
// ---- yedek hatırlatma: veri var ama bulut yedek yok ya da 14 günden eski
function backupReminder(){
  if (PREVIEW) return '';
  const hasData = CATCHES.length > 0 || Object.values(S.systems).some(sy => sy.source === 'sihirbaz') || Object.keys(S.inv.items).length > 0;
  if (!hasData) return '';
  const last = S.backup && S.backup.lastAt ? new Date(S.backup.lastAt) : null;
  const age = last ? (Date.now() - last.getTime()) / 86400000 : null;
  if (bkReady() && age != null && age < 14) return '';
  const snooze = S.settings.bkSnooze ? new Date(S.settings.bkSnooze).getTime() : 0;
  if (Date.now() < snooze) return '';
  return '<div class="newver warn"><b>' + (bkReady() ? 'Son yedek ' + Math.floor(age) + ' gün önce' : 'Bulut yedeğin kapalı') + '</b><span class="note">Avların, fotoğrafların ve kendi kurduğun sistemler yalnızca bu telefonda. Telefon kaybolursa geri gelmez.</span>' +
    '<div class="row"><button class="btn small primary" type="button" data-open="yedek">' + (bkReady() ? 'Şimdi yedekle' : 'Bulut yedeği aç') + '</button><button class="btn small" type="button" data-act="bkSnooze">7 gün sonra hatırlat</button></div></div>';
}
