// ---------------------------------------------------------------- 35 · önizleme örnek verisi
function SAMPLE_WX(){ try { const t = $('sample').textContent.trim(); return t && t[0] === '{' ? JSON.parse(t) : null; } catch (e) { return null; } }

// ---------------------------------------------------------------- 40 · solunar, balık aktivitesi ve en iyi pencere (tek hesap)
// Her an için 0–1 arası bir solunar değeri hesaplanır; saatlik tablo, takvim, en iyi pencere ve öneriler hep bu eğriden okunur.
//   taban %24 · major (ay üst/alt geçişi) · minor (ay doğuşu/batışı) · şafak ve alacakaranlık
//   olaylar üst üste binince değer artar ama %100'ü aşmaz: 1 − (1 − taban) × Π(1 − ağırlık × etki)
//   ay evresi: dördünlerde ×0,9, yeniay ve dolunayda ×1,1 · hava payı: basınç eğilimi ve akıntı (saatlik)
const SOL_K = {Major: [40, 100], Minor: [15, 50], 'Şafak': [30, 80], 'Alacakaranlık': [30, 80]};   // [tam etki ±dk, etkinin bittiği ±dk]
const SOL_W = {Major: 0.6, Minor: 0.36, 'Şafak': 0.4, 'Alacakaranlık': 0.4};
const SOL_BASE = 0.24;
const SOL_TAG = {Major: 'M', Minor: 'm', 'Şafak': '☀↑', 'Alacakaranlık': '☀↓'};
const SEA_F = {A: 1, B: 0.92, C: 0.7, D: 0.25};
const fishN = pct => pct <= 0 ? 0 : Math.min(5, Math.ceil(pct / 20));        // her balık %20: 1 → %1–20 … 5 → %81–100
function kern(dtMin, p, e){ const a = Math.abs(dtMin); return a <= p ? 1 : a >= e ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (a - p) / (e - p)); }

function moonEvents(L, d0, d1){
  const ev = {rise: [], set: [], up: [], low: []};
  for (let t = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()); t < d1; t = new Date(t.getTime() + 86400000)) {
    const mt = SunCalc.getMoonTimes(t, L.lat, L.lon);
    if (mt.rise && mt.rise >= d0 && mt.rise < d1) ev.rise.push(mt.rise);
    if (mt.set && mt.set >= d0 && mt.set < d1) ev.set.push(mt.set);
  }
  const pts = [];
  for (let t = d0.getTime(); t <= d1.getTime(); t += 300000) pts.push({t, a: SunCalc.getMoonPosition(new Date(t), L.lat, L.lon).altitude});
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i].a > pts[i - 1].a && pts[i].a >= pts[i + 1].a) ev.up.push(new Date(pts[i].t));
    if (pts[i].a < pts[i - 1].a && pts[i].a <= pts[i + 1].a) ev.low.push(new Date(pts[i].t));
  }
  return ev;
}
// olay listesindeki etkilerle bir andaki solunar değeri
function solV(t, ev, pf){
  let q = 1 - SOL_BASE; const tags = [];
  for (const e of ev) {
    const k = kern((t - e.t) / 60000, SOL_K[e.kind][0], SOL_K[e.kind][1]);
    if (k > 0) { q *= 1 - SOL_W[e.kind] * k; if (k >= 0.5 && !tags.includes(e.kind)) tags.push(e.kind); }
  }
  return {v: Math.min(1, (1 - q) * pf), tags};
}
const SOL_CACHE = {};
function solunar(day, L){
  L = L || loc(); const key = L.lat + ',' + L.lon + ',' + dateKey(day);
  if (SOL_CACHE[key]) return SOL_CACHE[key];
  const d0 = new Date(day.getFullYear(), day.getMonth(), day.getDate()), d1 = new Date(d0.getTime() + 86400000);
  const ev = moonEvents(L, new Date(d0.getTime() - 3 * 3600000), new Date(d1.getTime() + 3 * 3600000));
  const inDay = t => t >= d0 && t < d1;
  const per = (t, half, kind, e) => ({a: new Date(t.getTime() - half * 60000), b: new Date(t.getTime() + half * 60000), kind, e, c: t});
  const allMajor = ev.up.map(t => per(t, 60, 'Major', 'up')).concat(ev.low.map(t => per(t, 60, 'Major', 'low')));
  const allMinor = ev.rise.map(t => per(t, 30, 'Minor', 'rise')).concat(ev.set.map(t => per(t, 30, 'Minor', 'set')));
  const major = allMajor.filter(p => inDay(p.c)), minor = allMinor.filter(p => inDay(p.c));
  const noon = new Date(d0.getTime() + 12 * 3600000);
  const sun = SunCalc.getTimes(noon, L.lat, L.lon);
  const dawn = {a: new Date(sun.sunrise.getTime() - 45 * 60000), b: new Date(sun.sunrise.getTime() + 45 * 60000), kind: 'Şafak'};
  const dusk = {a: new Date(sun.sunset.getTime() - 45 * 60000), b: new Date(sun.sunset.getTime() + 45 * 60000), kind: 'Alacakaranlık'};
  const ill = SunCalc.getMoonIllumination(noon);
  const elong = ill.phase <= 0.5 ? ill.phase * 360 : 360 - ill.phase * 360;   // 0 yeniay … 180 dolunay
  const pf = 0.9 + 0.2 * Math.abs(Math.cos(elong * Math.PI / 180));
  // eğri için olaylar (merkez anları): şafak gün doğumundan 10 dk önce, alacakaranlık batıştan 10 dk sonra en güçlü
  const evs = allMajor.map(p => ({t: p.c, kind: 'Major', e: p.e})).concat(allMinor.map(p => ({t: p.c, kind: 'Minor', e: p.e})),
    [{t: new Date(sun.sunrise.getTime() - 10 * 60000), kind: 'Şafak', sun: sun.sunrise}, {t: new Date(sun.sunset.getTime() + 10 * 60000), kind: 'Alacakaranlık', sun: sun.sunset}]);
  let peak = 0, peakT = d0;
  for (let t = d0.getTime(); t < d1.getTime(); t += 600000) { const r = solV(new Date(t), evs, pf); if (r.v > peak) { peak = r.v; peakT = new Date(t); } }
  const stars = peak >= 0.85 ? 5 : peak >= 0.76 ? 4 : peak >= 0.68 ? 3 : peak >= 0.6 ? 2 : 1;
  const f = ill.fraction, waxing = ill.phase < 0.5;
  const name = f < 0.03 ? 'Yeniay' : f >= 0.97 ? 'Dolunay' : waxing ? (f < 0.45 ? 'Büyüyen hilal' : f <= 0.55 ? 'İlk dördün' : 'Büyüyen şişkin ay') : (f < 0.45 ? 'Küçülen hilal' : f <= 0.55 ? 'Son dördün' : 'Küçülen şişkin ay');
  const res = {major, minor, allMajor, allMinor, dawn, dusk, sunrise: sun.sunrise, sunset: sun.sunset, illum: f, name, elong, pf, evs, peak, peakT, stars, score: Math.round(peak * 100)};
  SOL_CACHE[key] = res; return res;
}
// bir günün ve ertesi sabahın olayları (gece penceresi gece yarısını geçebilir)
function solSpan(day, L){
  const s0 = solunar(day, L), s1 = solunar(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, 12), L);
  const ev = s0.evs.slice();
  s1.evs.forEach(e => { if (!ev.some(x => x.kind === e.kind && Math.abs(x.t - e.t) < 40 * 60000)) ev.push(e); });
  const split = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  return {s0, s1, ev, split, pfAt: t => t < split ? s0.pf : s1.pf};
}
// hava payı (saatlik): basınç eğilimi (3 sa) ve akıntı. Rüzgâr ve dalga balık değerine girmez; pencere seçiminde deniz sınıfı ayrıca tartılır.
function wxFactor(x){
  let f = 1; const why = [];
  const dp = x && x.dp3;
  if (dp != null) {
    if (dp <= -2.5) { f *= 0.85; why.push('basınç hızlı düşüyor'); }
    else if (dp <= -0.5) { f *= 1.08; why.push('basınç yavaş düşüyor'); }
    else if (dp >= 1.5) { f *= 0.85; why.push('basınç hızlı yükseliyor'); }
    else if (dp >= 0.5) { f *= 0.95; why.push('basınç yükseliyor'); }
  }
  const c = x && x.cur;
  if (c != null) { if (c < 0.1) { f *= 0.96; why.push('akıntı yok'); } else if (c <= 0.9) f *= 1.04; else if (c > 1.3) { f *= 0.95; why.push('akıntı çok güçlü'); } }
  return {f, why};
}
// saatlik tahmini balık aktivitesi: HH:00'ın ±30 dakikasının ortalaması (tablodaki diğer değerler gibi o saate aittir)
function activity(x){
  if (x._act) return x._act;
  const day = new Date(x.t.getFullYear(), x.t.getMonth(), x.t.getDate());
  const sp = solSpan(day);      // günün olayları önceki akşamın son 3 saatini de kapsar
  const t0 = x.t.getTime(); let sum = 0, n = 0; const tg = new Set();
  for (let m = -30; m <= 30; m += 10) { const t = t0 + m * 60000; const r = solV(new Date(t), sp.ev, sp.pfAt(t)); sum += r.v; n++; r.tags.forEach(k => tg.add(k)); }
  const sol = sum / n; const w = wxFactor(x);
  const pct = Math.max(1, Math.min(100, Math.round(sol * w.f * 100)));
  const order = ['Major', 'Minor', 'Şafak', 'Alacakaranlık'];
  const kinds = order.filter(k => tg.has(k));
  return (x._act = {pct, fish: fishN(pct), sol: Math.round(sol * 100), kinds, tags: kinds.map(k => SOL_TAG[k]), wx: w});
}
// ---- 10 dakikalık eğri: gün 00:00 → ertesi gün 10:00
function hourRec(t){
  if (!WX) return null;
  if (!WX._byH) { WX._byH = {}; WX.hours.forEach(x => { WX._byH[x.key + 'T' + pad(x.h)] = x; }); }
  const r = new Date(t.getTime() + 30 * 60000);
  return WX._byH[dateKey(r) + 'T' + pad(r.getHours())] || null;
}
const clsOf = x => x && x.wind != null ? bump(seaClass(x.wind), x.wave) : null;
function curve(dd){
  if (dd._curve) return dd._curve;
  const sp = solSpan(dd.date);
  const d0 = new Date(dd.date.getFullYear(), dd.date.getMonth(), dd.date.getDate()).getTime();
  const pts = [];
  for (let m = 0; m <= 34 * 60; m += 10) {
    const t = new Date(d0 + m * 60000); const x = hourRec(t);
    const r = solV(t, sp.ev, sp.pfAt(t.getTime()));
    const wf = x ? wxFactor(x).f : 1; const cls = clsOf(x);
    pts.push({t, sol: r.v, v: Math.min(1, r.v * wf), tags: r.tags, x, cls, sf: cls ? SEA_F[cls] : 0.9});
  }
  dd._curve = {pts, sp};
  return dd._curve;
}
function partRange(dd, part){
  const s = dd.sol, d0 = new Date(dd.date.getFullYear(), dd.date.getMonth(), dd.date.getDate());
  const n = solunar(new Date(d0.getTime() + 36 * 3600000));
  // gündüz: şafaktan alacakaranlığın sonuna · gece: alacakaranlıktan ertesi şafağın öncesine (şafak ertesi günün gündüzüne sayılır)
  if (part === 'gun') return [s.sunrise.getTime() - 75 * 60000, s.sunset.getTime() + 45 * 60000];
  if (part === 'gece') return [s.sunset.getTime() - 30 * 60000, n.sunrise.getTime() - 45 * 60000];
  return [d0.getTime(), d0.getTime() + 86400000 - 1];
}
const CLS_ORDER = 'ABCD';
// en iyi pencereler: balık değeri × deniz payı en yüksek an, çevresinde değerin %88'inin üstünde kalan süre (60–150 dk)
// from verilirse (bugün için "şimdi") bitmiş pencereler atlanır; süren pencere gösterilir
function bestWindows(dd, part, max, from){
  const fk = from ? Math.floor(from.getTime() / 600000) : 0;
  const key = (part || 'all') + (max || 2) + ':' + fk;
  dd._win = dd._win || {};
  if (dd._win[key]) return dd._win[key];
  const {pts, sp} = curve(dd); let [A, B] = partRange(dd, part);
  if (from) A = Math.max(A, from.getTime() - 30 * 60000);
  const idx = []; pts.forEach((p, i) => { if (p.t.getTime() >= A && p.t.getTime() <= B) idx.push(i); });
  const out = []; if (!idx.length) return (dd._win[key] = out);
  const lo = idx[0], hi = idx[idx.length - 1];
  const used = new Set(); const sc = i => pts[i].v * pts[i].sf;
  // denizden bağımsız en yüksek balık anı (deniz yüzünden seçilmezse nedeni yazılır)
  let bio = lo; idx.forEach(i => { if (pts[i].v > pts[bio].v) bio = i; });
  while (out.length < (max || 2)) {
    let best = -1; idx.forEach(i => { if (!used.has(i) && (best < 0 || sc(i) > sc(best))) best = i; });
    if (best < 0) break;
    const top = sc(best);
    if (out.length && (top < 0.72 * out[0].score || pts[best].v < 0.45)) break;
    const thr = 0.88 * top, free = i => i >= lo && i <= hi && !used.has(i);
    let a = best, b = best;
    while (b - a < 15 && free(a - 1) && sc(a - 1) >= thr) a--;
    while (b - a < 15 && free(b + 1) && sc(b + 1) >= thr) b++;
    while (b - a < 6) { const ca = free(a - 1) ? sc(a - 1) : -1, cb = free(b + 1) ? sc(b + 1) : -1; if (ca < 0 && cb < 0) break; if (ca >= cb) a--; else b++; }
    for (let i = a - 6; i <= b + 6; i++) used.add(i);
    const seg = pts.slice(a, b + 1);
    const hrs = [...new Set(seg.map(p => p.x).filter(Boolean))];
    const pct = hrs.length ? Math.max(...hrs.map(x => activity(x).pct)) : Math.round(pts[best].v * 100);
    const cls = seg.reduce((w, p) => !p.cls ? w : (!w || CLS_ORDER.indexOf(p.cls) > CLS_ORDER.indexOf(w)) ? p.cls : w, null);   // pencerenin en kötü deniz sınıfı
    const kinds = []; seg.forEach(p => p.tags.forEach(k => { if (!kinds.includes(k)) kinds.push(k); }));
    const evs = kinds.map(k => { const e = sp.ev.filter(y => y.kind === k).sort((p, q) => Math.abs(p.t - pts[best].t) - Math.abs(q.t - pts[best].t))[0]; return {k, t: e ? (e.sun || e.t) : null, e: e && e.e}; });
    const s = solunar(pts[best].t);
    const night = pts[best].t < s.sunrise || pts[best].t > s.sunset;
    out.push({a: pts[a].t, b: new Date(pts[b].t.getTime() + 10 * 60000), peakT: pts[best].t, peak: pts[best], score: top, pct, fish: fishN(pct), cls, kinds, evs, night,
      x: pts[best].x || hrs[0] || null});
  }
  out.sort((p, q) => q.score - p.score);
  // deniz yüzünden seçilmeyen daha yüksek balık saati varsa nedeni yazılır (tablodaki saatlik değerle karşılaştırılır)
  if (out[0] && (pts[bio].t < out[0].a || pts[bio].t > out[0].b)) {
    const xb = pts[bio].x; const bp = xb ? activity(xb).pct : Math.round(pts[bio].v * 100);
    if (bp >= out[0].pct + 3) out[0].skipped = {t: xb ? xb.t : pts[bio].t, pct: bp, cls: pts[bio].cls};
  }
  return (dd._win[key] = out);
}
const windows = dd => bestWindows(dd, null, 2);
const EV_TXT = {Major: 'Major', Minor: 'Minor', 'Şafak': 'Şafak', 'Alacakaranlık': 'Alacakaranlık'};
// olay etiketi: major/minor saati ayın geçişi ya da doğuş/batışı; şafak ve alacakaranlıkta güneşin doğuş/batış saati
function evChip(e){ return EV_TXT[e.k] + (e.t ? ' ' + hm(e.t) : ''); }
const EV_LONG = {up: 'ay tepede', low: 'ay en altta', rise: 'ay doğuyor', set: 'ay batıyor'};
const winTxt = w => hm(w.a) + '–' + hm(w.b);
// pencerenin adı: gün doğumuna yakınsa sabah, batışa yakınsa akşam, değilse gündüz ya da gece
function winLabel(w){
  const s = solunar(w.peakT), near = (t, c) => Math.abs(t - c) <= 100 * 60000;
  if (near(w.peakT, s.sunrise)) return 'Sabah';
  if (near(w.peakT, s.sunset)) return 'Akşam';
  return w.night ? 'Gece' : 'Gündüz';
}
