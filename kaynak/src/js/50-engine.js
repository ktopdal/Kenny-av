// ---------------------------------------------------------------- 50 · öneri motoru (kurallar şeffaf, her önerinin nedeni yazılır)
// Her rig, günün o bölümünün (gündüz / gece) en iyi penceresindeki koşullarla puanlanır:
// dip uyumu, mevsim, deniz sınıfı, balık değeri, akıntı ve sürüklenme, tekniğin istediği koşullar ve avlarından öğrenilenler.
function bottomMatch(rg, b){
  const rb = rg.bottom || [];
  if (!b) return rb.includes('bilinmeyen') ? 3 : 0;
  const near = {kum: ['kum', 'kum-kayalik'], 'kum-kayalik': ['kum-kayalik', 'kum', 'kayalik'], kayalik: ['kayalik', 'kum-kayalik', 'saf-kayalik'],
    'saf-kayalik': ['saf-kayalik', 'kayalik'], karma: ['karma', 'kum-kayalik'], camur: ['kum', 'camur']}[b] || [];
  if (rb.some(x => x === b)) return 2;
  if (rb.some(x => near.includes(x))) return 1;
  if (rb.includes('karma') || rb.includes('bilinmeyen') || !rb.length) return 0.5;
  return -2;
}
// tekniğe özel koşullar (sürüklenme, dalga, ışık)
function techRule(rg, c){
  const t = rg.tech; const out = {d: 0, why: []};
  const add = (d, w) => { out.d += d; if (w) out.why.push(w); };
  const line = c.dr ? c.dr.line : null, wave = c.x ? c.x.wave : null, dusk = c.w && c.w.kinds.some(k => k === 'Şafak' || k === 'Alacakaranlık');
  if (t === 'jig' && line != null) { if (line >= 0.25 && line <= 0.8) add(1, 'jig için uygun sürüklenme'); else if (line > 1.0) add(-1.5, 'jig için sürüklenme hızlı'); else if (line < 0.15) add(-0.5, 'sürüklenme çok yavaş'); }
  if (t === 'eging') { if (c.night || dusk) add(1, 'kalamar için ışık uygun'); if (wave != null && wave >= 1) add(-1.5, 'dalga kalamar için yüksek'); }
  if ((t === 'orkinos' || t === 'sirti') && c.cls && c.cls !== 'A' && c.cls !== 'B') add(-3, 'açık deniz için rüzgâr fazla');
  if (t === 'samandira' && line != null && line > 0.5) add(-1, 'şamandıra için akıntı fazla');
  if ((t === 'lrf' || t === 'spin') && dusk) add(1, 'şafak/alacakaranlıkta yüzey avı');
  if (rg.mode === 'kiyi' && c.x) {
    const rel = shoreRel(c.x.wdir, facingOf(loc())), b = bft(c.x.wind), w = c.x.wave || 0;
    if (t === 'surf') { if (w >= 0.3 && w <= 1.0 && rel === 'vuran') add(1, 'dalga yemi kıyıya taşır'); if (w > 1.2) add(-2, 'dalga çok yüksek'); if (rel === 'vuran' && b >= 5) add(-1, 'rüzgâr yüzüne, atış zor'); if (rel === 'esen') add(0.5, 'rüzgâr arkadan, atış uzar'); }
    if (t === 'lrf' || t === 'spin' || t === 'samandira') { if (w >= 0.8) add(-1.5, 'dalga hafif takım için fazla'); if (rel === 'esen' && b <= 4) add(0.5, 'kıyıda deniz sakin'); if (t === 'samandira' && rel === 'esen' && b >= 5) add(-1, 'şamandıra açığa sürüklenir'); }
  }
  return out;
}
function recommend(dd, night, from){
  const L = loc(); const month = dd.date.getMonth() + 1;
  const w = bestWindows(dd, night ? 'gece' : 'gun', 1, from)[0] || null;
  const x = (w && w.x) || refHour(dd);
  const dr = x ? driftAt(x) : null;
  const cls = (w && w.cls) || (night ? dd.clsN : dd.clsD);
  const ctx = {night, cur: x ? x.cur : null, illum: Math.round(dd.sol.illum * 100), month, L};
  const out = [];
  RIG_LIST.forEach(rg => {
    if (rg.mode && rg.mode !== (S.mode || 'tekne')) return;
    if (rg.time && rg.time !== 'her' && (rg.time === 'gece') !== night) return;
    if (rg.season && rg.season.length && !rg.season.includes(month)) return;
    if (rg.klass === 'trofe' && cls === 'D') return;
    const why = []; let sc = 0;
    if (rg.core) { sc += 3; why.push('12 ay geçerli'); }
    const bm = bottomMatch(rg, L && L.bottom);
    sc += bm; if (bm >= 2) why.push('dip uyumu: ' + (BOTTOM_TXT[L.bottom] || '')); else if (L && !L.bottom && bm > 0) why.push('dip bilinmiyor, keşif rigi');
    if (rg.klass === 'trofe') {
      if (w && w.pct >= 70 && (cls === 'A' || cls === 'B')) { sc += 1.5; why.push('pencere %' + w.pct + ', sakin deniz'); }
      if (cls === 'C') { sc -= 2; why.push('rüzgâr C sınıfı'); }
    }
    const curKn = x && x.cur != null ? x.cur : null;
    if (rg.current && ((dr && dr.line >= 0.35) || (curKn || 0) >= 0.4)) { sc += 3; why.push('akıntı ' + f1(curKn) + ' kn, akıntı rigi'); }
    if (rg.window && night) { sc += 0.5; why.push('pencere ' + rg.window.join('–')); }
    if (rg.season && rg.season.length) { sc += 1; why.push('mevsiminde'); }
    if (month === 10 || month === 11) { const fit = Math.max(0, ...(rg.species || []).map(s => (SPECIES[s] && SPECIES[s].fit_oct_est) || 0)); if (fit) { sc += (fit - 3) * 0.5; if (fit >= 4) why.push('sezon uyumu ' + fit + '/5 (tahmin)'); } }
    const tr = techRule(rg, {dr, x, w, night, cls}); sc += tr.d; why.push(...tr.why);
    const lr = learnRig(rg, ctx); if (lr) { sc += lr.bonus; why.push(...lr.why); }
    const ls = learnSpecies(rg, ctx); if (ls) { sc += ls.bonus; why.push(ls.why); }
    out.push({rg, sc, why, ok: ready(rg), learned: !!(lr || ls)});
  });
  out.sort((a, b) => b.sc - a.sc);
  out.win = w; out.x = x; out.dr = dr; out.cls = cls;
  return out;
}
