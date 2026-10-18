// ---------------------------------------------------------------- 35 · önizleme örnek verisi
function SAMPLE_WX(){ try { const t = $('sample').textContent.trim(); return t && t[0] === '{' ? JSON.parse(t) : null; } catch (e) { return null; } }

// ---------------------------------------------------------------- 40 · solunar, pencereler, saatlik balık aktivitesi
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
const SOL_CACHE = {};
function solunar(day){
  const L = loc(); const key = L.lat + ',' + L.lon + ',' + dateKey(day);
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
  const ov = (p, w) => Math.max(0, (Math.min(p.b, w.b) - Math.max(p.a, w.a)) / 60000);
  let score = 40 + 40 * Math.abs(Math.cos(elong * Math.PI / 180));
  if (major.some(p => ov(p, dawn) + ov(p, dusk) > 15)) score += 10;
  score += Math.min(10, 5 * minor.filter(p => ov(p, dawn) + ov(p, dusk) > 10).length);
  score = Math.min(100, score);
  const stars = score >= 85 ? 5 : score >= 70 ? 4 : score >= 55 ? 3 : score >= 40 ? 2 : 1;
  const f = ill.fraction, waxing = ill.phase < 0.5;
  const name = f < 0.03 ? 'Yeniay' : f >= 0.97 ? 'Dolunay' : waxing ? (f < 0.45 ? 'Büyüyen hilal' : f <= 0.55 ? 'İlk dördün' : 'Büyüyen şişkin ay') : (f < 0.45 ? 'Küçülen hilal' : f <= 0.55 ? 'Son dördün' : 'Küçülen şişkin ay');
  const res = {major, minor, allMajor, allMinor, dawn, dusk, sunrise: sun.sunrise, sunset: sun.sunset, illum: f, name, elong, score, stars,
    phaseF: 0.8 + 0.4 * Math.abs(Math.cos(elong * Math.PI / 180))};
  SOL_CACHE[key] = res; return res;
}
function windAtHour(dd, t){ let best = null, bd = 1e15; dd.hs.forEach(x => { const d = Math.abs(x.t - t); if (d < bd) { bd = d; best = x; } }); return best; }
function windows(dd){
  const s = dd.sol;
  const cands = s.major.map(p => ({...p, w: 3.0})).concat(s.minor.map(p => ({...p, w: 1.6})), [{...s.dawn, w: 1.3}, {...s.dusk, w: 1.3}]);
  const out = cands.map(c => {
    let sc = c.w; const tags = [c.kind];
    cands.forEach(o => { if (o === c) return; const ov = Math.max(0, Math.min(c.b, o.b) - Math.max(c.a, o.a)); if (ov > 0) { const fr = ov / (o.b - o.a); sc += 0.5 * o.w * fr; if (fr > 0.4 && !tags.includes(o.kind)) tags.push(o.kind); } });
    const mid = new Date((c.a.getTime() + c.b.getTime()) / 2);
    const x = windAtHour(dd, mid); const cls = x && x.wind != null ? bump(seaClass(x.wind), x.wave) : 'B';
    sc *= {A: 1, B: .9, C: .6, D: .2}[cls] * s.phaseF;
    return {a: c.a, b: c.b, score: sc, tags, cls, night: !(mid >= s.sunrise && mid <= s.sunset), wind: x ? x.wind : null};
  }).sort((x, y) => y.score - x.score);
  const top = [];
  out.forEach(c => { if (top.length < 2 && top.every(t => c.b <= t.a || c.a >= t.b)) top.push(c); });
  return top;
}
// Saatlik tahmini balık aktivitesi (%): solunar + şafak/alacakaranlık + ay evresi + basınç eğilimi
function activity(x){
  const day = new Date(x.t.getFullYear(), x.t.getMonth(), x.t.getDate());
  const s = solunar(day);
  const prev = solunar(new Date(day.getTime() - 86400000)), next = solunar(new Date(day.getTime() + 86400000));
  const majors = s.allMajor.concat(prev.allMajor, next.allMajor), minors = s.allMinor.concat(prev.allMinor, next.allMinor);
  const a0 = x.t.getTime(), a1 = a0 + 3600000;
  const frac = p => Math.max(0, Math.min(a1, p.b.getTime()) - Math.max(a0, p.a.getTime())) / 3600000;
  const near = (p, mins) => Math.min(Math.abs(p.a.getTime() - a1), Math.abs(a0 - p.b.getTime())) <= mins * 60000;
  let v = 0.22, tags = [];
  const fm = Math.max(0, ...majors.map(frac)); if (fm > 0) { v += 0.48 * Math.min(1, fm * 1.5); tags.push('M'); } else if (majors.some(p => near(p, 60))) v += 0.12;
  const fn = Math.max(0, ...minors.map(frac)); if (fn > 0) { v += 0.26 * Math.min(1, fn * 2); tags.push('m'); } else if (minors.some(p => near(p, 45))) v += 0.06;
  const fl = Math.max(frac(s.dawn), frac(s.dusk)); if (fl > 0) { v += 0.2 * Math.min(1, fl * 1.5); tags.push(frac(s.dawn) > 0 ? '☀↑' : '☀↓'); }
  v = Math.min(1, v) * (s.phaseF / 1.2);
  const dp = x.dp3;
  if (dp != null) v *= dp <= -2.5 ? 0.85 : dp <= -0.5 ? 1.08 : dp < 0.5 ? 1.0 : dp < 1.5 ? 0.95 : 0.82;
  const pct = Math.max(1, Math.min(100, Math.round(v * 100)));
  return {pct, fish: pct >= 67 ? 3 : pct >= 40 ? 2 : 1, tags};
}
