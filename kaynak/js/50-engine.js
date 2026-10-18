// ---------------------------------------------------------------- 50 · öneri motoru v0.2 (kurallar şeffaf, her önerinin nedeni yazılır)
function bottomMatch(rg, b){
  if (!b) return rg.bottom.includes('bilinmeyen') ? 3 : 0;
  const near = {kum: ['kum', 'kum-kayalik'], 'kum-kayalik': ['kum-kayalik', 'kum', 'kayalik'], kayalik: ['kayalik', 'kum-kayalik', 'saf-kayalik'],
    'saf-kayalik': ['saf-kayalik', 'kayalik'], karma: ['karma', 'kum-kayalik'], camur: ['kum']}[b] || [];
  if (rg.bottom.some(x => x === b)) return 2;
  if (rg.bottom.some(x => near.includes(x))) return 1;
  if (rg.bottom.includes('karma') || rg.bottom.includes('bilinmeyen')) return 0.5;
  return -2;
}
function recommend(dd, night){
  const L = loc(); const month = dd.date.getMonth() + 1;
  const cls = night ? dd.clsN : dd.clsD;
  const out = [];
  D.rigs.forEach(rg => {
    if ((rg.time === 'gece') !== night) return;
    if (rg.season_months && !rg.season_months.includes(month)) return;
    if (rg.klass === 'trofe' && cls === 'D') return;
    const why = []; let sc = 0;
    if (rg.must_prepare) { sc += 3; why.push('12 ay geçerli'); }
    const bm = bottomMatch(rg, L.bottom);
    sc += bm; if (bm >= 2) why.push('dip uyumu: ' + (BOTTOM_TXT[L.bottom] || '')); else if (!L.bottom && bm > 0) why.push('dip bilinmiyor, keşif rigi');
    if (rg.klass === 'trofe') { if (dd.sol.stars >= 4 && (cls === 'A' || cls === 'B')) { sc += 1.5; why.push(dd.sol.stars + ' yıldız, sakin deniz'); } if (cls === 'C') { sc -= 2; why.push('rüzgâr C sınıfı'); } }
    if (rg.when_current && night && (dd.curMean || 0) >= 0.4) { sc += 3; why.push('akıntı ' + f1(dd.curMean) + ' kn'); }
    if (rg.window && night) { sc += 0.5; why.push('pencere ' + rg.window.join('–')); }
    if (rg.season_months) { sc += 1; why.push('mevsiminde'); }
    if (month === 10 || month === 11) { const fit = Math.max(0, ...rg.species.map(s => (SPECIES[s] && SPECIES[s].fit_oct_est) || 0)); if (fit) { sc += (fit - 3) * 0.5; if (fit >= 4) why.push('sezon uyumu ' + fit + '/5 (tahmin)'); } }
    out.push({rg, sc, why, ok: ready(rg)});
  });
  out.sort((a, b) => b.sc - a.sc);
  return out;
}
// gündüz (07–18) ya da gece (19–06) içinde en yüksek aktiviteli 2 saat
function bestHours(dd, night){
  const hs = WX ? WX.hours.filter(x => {
    if (night) { const n = new Date(dd.date.getTime() + 86400000); return (x.key === dd.key && x.h >= 19) || (x.key === dateKey(n) && x.h < 6); }
    return x.key === dd.key && x.h >= 7 && x.h < 18;
  }) : [];
  return hs.map(x => ({x, a: activity(x)})).sort((p, q) => q.a.pct - p.a.pct).slice(0, 2).sort((p, q) => p.x.t - q.x.t);
}
function leadFor(rg, dd){
  const s = SETUPS[rg.setup]; const st = s && s.standard_cm; if (!st) return null;
  const cur = dd ? (dd.curMean || 0) : 0;
  let [lo, hi] = st.kursun_g; const max = st.kursun_max_g;
  const L = loc(); const deep = Number(num(L.depth)) > 80;
  if (cur >= 0.5) { lo += 30; hi += 30; }
  if (deep) lo = hi;
  lo = Math.min(lo, max); hi = Math.min(hi, max);
  const k = rg.leader_cm || {ust: st.ust, orta: st.orta, hirsiz: st.hirsiz};
  const hz = cur >= 0.5 && !rg.leader_cm ? Math.round(k.hirsiz * 0.8) : k.hirsiz;
  return {ust: k.ust, orta: k.orta, hirsiz: hz, ara: st.aralik, kursun: lo === hi ? lo + ' g' : lo + '–' + hi + ' g', own: !!rg.leader_cm, max};
}
