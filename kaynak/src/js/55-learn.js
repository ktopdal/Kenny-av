// ---------------------------------------------------------------- 55 · avlardan öğrenme
// En az 5 av kaydı birikince öneriler senin sonuçlarına göre ayarlanır:
//   bir rigle tuttuğun balık sayısı, özellikle benzer koşullarda (gece/gündüz, akıntı, ay, mevsim, aynı nokta)
//   bir türü bu dönemde tuttuysan o türe kurulan rigler öne çıkar.
// Yalnızca yakaladığın avlar bilinir (avsız çıkışlar kaydedilmiyor); bu yüzden etki sınırlı tutulur ve her öneride nedeni yazılır.
const LEARN_MIN = 5;
let LEARN = null;
const curB = v => v == null ? null : v < 0.3 ? 0 : v < 0.7 ? 1 : 2;
const CUR_B_TXT = ['akıntısız', 'orta akıntı', 'güçlü akıntı'];
const moonB = il => il == null ? null : il < 25 ? 0 : il <= 75 ? 1 : 2;
const MOON_B_TXT = ['karanlık ay', 'yarım ay', 'dolunaya yakın'];
const monthDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 12 - d); };
function catchNight(c){
  const t = new Date(c.t);
  if (c.loc && c.loc.lat != null) { try { const s = SunCalc.getTimes(new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12), c.loc.lat, c.loc.lon); return t < s.sunrise || t > s.sunset; } catch (e) {} }
  return t.getHours() < 7 || t.getHours() >= 19;
}
function learnBase(){
  const key = CATCHES_V;
  if (LEARN && LEARN.key === key) return LEARN;
  const list = CATCHES.filter(c => c && c.t).map(c => ({c, n: Math.max(1, c.count || 1), night: catchNight(c), month: new Date(c.t).getMonth() + 1,
    cb: curB(c.cond && c.cond.cur_kn), mb: moonB(c.cond && c.cond.illum)}));
  LEARN = {key, list, total: list.length, on: list.length >= LEARN_MIN};
  return LEARN;
}
// av kaydındaki rig bu rig mi? (yeni kayıtlar rig kimliğini, v0.2 kayıtları özel paketin rig kodunu tutar)
const rigMatch = (c, rg) => !!c.rig && (c.rig === rg.id || (rg.sys === 'ozel' && rg.code && c.rig === rg.code));
// ctx: {night, cur (kn), illum (%), month, L}
function learnRig(rg, ctx){
  const B = learnBase(); if (!B.on) return null;
  let all = 0, here = 0, sim = 0, simN = 0;
  const cb0 = curB(ctx.cur), mb0 = moonB(ctx.illum);
  B.list.forEach(o => {
    if (!rigMatch(o.c, rg)) return;
    all += o.n;
    const near = ctx.L && o.c.loc && o.c.loc.lat != null && distKm(ctx.L, o.c.loc) <= 1.5;
    if (near) here += o.n;
    let s = 1;
    if (o.night !== ctx.night) s *= 0.4;
    if (o.cb != null && cb0 != null && o.cb !== cb0) s *= 0.6;
    if (o.mb != null && mb0 != null && o.mb !== mb0) s *= 0.8;
    if (monthDist(o.month, ctx.month) > 1) s *= 0.6;
    if (near) s *= 1.3;
    sim += o.n * s; if (s >= 0.75) simN += o.n;
  });
  if (!all) return null;
  const bonus = Math.min(4, 0.7 * Math.log2(1 + all) + 1.2 * Math.log2(1 + sim));
  const why = ['seninle ' + all + ' balık' + (here ? ' (bu noktada ' + here + ')' : '')];
  if (simN) why.push('benzer koşulda ' + simN + ' (' + [ctx.night ? 'gece' : 'gündüz', cb0 != null ? CUR_B_TXT[cb0] : '', mb0 != null ? MOON_B_TXT[mb0] : ''].filter(Boolean).join(', ') + ')');
  return {bonus, why, all, simN};
}
function learnSpecies(rg, ctx){
  const B = learnBase(); if (!B.on || !rg.species || !rg.species.length) return null;
  let n = 0; const names = new Set();
  B.list.forEach(o => {
    if (!rg.species.includes(o.c.species) || monthDist(o.month, ctx.month) > 1) return;
    const near = ctx.L && o.c.loc && o.c.loc.lat != null && distKm(ctx.L, o.c.loc) <= 5;
    n += o.n * (near ? 1.5 : 1); if (SPECIES[o.c.species]) names.add(SPECIES[o.c.species].name);
  });
  if (!n) return null;
  return {bonus: Math.min(1.5, 0.5 * Math.log2(1 + n)), why: 'bu dönemde ' + [...names].slice(0, 2).join(', ') + ' tuttun'};
}
// Avlar ekranı için özet
function learnSummary(){
  const B = learnBase();
  if (B.sum !== undefined) return B.sum;
  B.sum = learnSummary0(B); return B.sum;
}
function learnSummary0(B){
  if (!B.total) return null;
  if (!B.on) return {on: false, txt: 'Öneriler ' + LEARN_MIN + ' av kaydından sonra senin sonuçlarına göre ayarlanır: ' + B.total + '/' + LEARN_MIN + '.'};
  const byRig = {}; B.list.forEach(o => { if (!o.c.rig) return; const k = o.c.rig; byRig[k] = (byRig[k] || 0) + o.n; });
  const topRigs = Object.entries(byRig).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r, n]) => esc(rigShort(r)) + ' (' + n + ')');
  const byH = {}; B.list.forEach(o => { const h = new Date(o.c.t).getHours(); const k = Math.floor(h / 2) * 2; byH[k] = (byH[k] || 0) + o.n; });
  const topH = Object.entries(byH).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([h, n]) => pad(+h) + '–' + pad((+h + 2) % 24));
  // model sağlaması: avlar balık değerinin 3+ balık (%41+) olduğu saatlerde mi geldi?
  let hit = 0, tot = 0;
  B.list.forEach(o => { const c = o.c; if (!c.loc || c.loc.lat == null) return; const t = new Date(c.t);
    const sp = solSpan(new Date(t.getFullYear(), t.getMonth(), t.getDate()), {lat: c.loc.lat, lon: c.loc.lon});
    const v = solV(t, sp.ev, sp.pfAt(t.getTime())).v; tot += o.n; if (v >= 0.41) hit += o.n; });
  return {on: true, rigs: topRigs, hours: topH, model: tot ? Math.round(hit / tot * 100) : null, total: B.total};
}
