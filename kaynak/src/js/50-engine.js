// ---------------------------------------------------------------- 50 · öneri motoru (kurallar şeffaf, her önerinin nedeni yazılır)
// Her rig, günün o bölümünün (gündüz / gece) en iyi penceresindeki koşullarla puanlanır:
// dip uyumu, mevsim (tür takvimi ve su sıcaklığı), hedef boy, deniz sınıfı, balık değeri, akıntı ve sürüklenme, tekniğin istediği koşullar,
// avlarından ve "bağladım: tuttu / tutmadı" bildirimlerinden öğrenilenler.
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
// at: {x} verilirse o saatin koşullarıyla (saat saat plan için); yoksa bölümün en iyi penceresiyle
function recommend(dd, night, from, at){
  const L = loc(); const month = dd.date.getMonth() + 1;
  const w = at ? (at.w || null) : bestWindows(dd, night ? 'gece' : 'gun', 1, from)[0] || null;
  const x = at ? at.x : (w && w.x) || refHour(dd);
  const dr = x ? driftAt(x) : null;
  const cls = at ? (x && seaClsAt(x)) || (night ? dd.clsN : dd.clsD) : (w && w.cls) || (night ? dd.clsN : dd.clsD);
  const sm = spotMemory(L), depth = locDepth();
  const ctx = {night, cur: x ? x.cur : null, illum: Math.round(dd.sol.illum * 100), month, L};
  const sst = x && x.sst != null ? x.sst : dd.sst != null ? dd.sst : null, tgt = S.settings.ftarget || '';
  const out = [];
  RIG_LIST.forEach(rg => {
    if (rg.mode && rg.mode !== modeNow()) return;
    if (rg.time && rg.time !== 'her' && (rg.time === 'gece') !== night) return;
    if (rg.season && rg.season.length && !rg.season.includes(month)) return;
    if (rg.klass === 'trofe' && cls === 'D') return;
    const why = []; let sc = 0;
    if (rg.core) { sc += 3; why.push('12 ay geçerli'); }
    // dip: seçilen dip; yoksa EUSeaMap tahmini (yarım ağırlık, keşif rigleri de önde kalır)
    const est = L && !L.bottom && L.bottomEst ? L.bottomEst : null, bE = est ? bottomMatch(rg, est) : null;
    const bm = est ? Math.round((0.5 * bottomMatch(rg, null) + 0.6 * bE) * 10) / 10 : bottomMatch(rg, L && L.bottom);
    sc += bm;
    if (est && bE >= 2) why.push('taban tahmini: ' + (BOTTOM_TXT[est] || '') + ' (EUSeaMap)');
    else if (!est && bm >= 2) why.push('dip uyumu: ' + (BOTTOM_TXT[L.bottom] || ''));
    else if (L && !L.bottom && bottomMatch(rg, null) > 0) why.push('dip bilinmiyor, keşif rigi');
    if (rg.klass === 'trofe') {
      if (w && w.pct >= 70 && (cls === 'A' || cls === 'B')) { sc += 1.5; why.push('pencere %' + w.pct + ', sakin deniz'); }
      if (cls === 'C') { sc -= 2; why.push('rüzgâr C sınıfı'); }
    }
    const curKn = x && x.cur != null ? x.cur : null;
    if (rg.current && ((dr && dr.line >= 0.35) || (curKn || 0) >= 0.4)) { sc += 3; why.push('akıntı ' + f1(curKn) + ' kn, akıntı rigi'); }
    if (rg.window && night) { sc += 0.5; why.push('pencere ' + rg.window.join('–')); }
    // tür takvimi ve su sıcaklığı (52-tune.js): rigin türlerinden bu ay ve bu suda en uygun olanı
    const se = rigSeason(rg, month, sst); if (se) { sc += se.d; why.push(...se.why); }
    if (rg.season && rg.season.length) { sc += 1; if (!se) why.push('mevsiminde'); }
    // hedef boy (Fishing'de seçilir): porsiyon ya da trofe
    if (tgt && rg.klass) { if (rg.klass === tgt) { sc += 1.5; why.push('hedef ' + (tgt === 'trofe' ? 'trofe' : 'porsiyon')); } else sc -= 3; }
    const tr = techRule(rg, {dr, x, w, night, cls}); sc += tr.d; why.push(...tr.why);
    const lr = learnRig(rg, ctx); if (lr) { sc += lr.bonus; why.push(...lr.why); }
    const ls = learnSpecies(rg, ctx); if (ls) { sc += ls.bonus; why.push(ls.why); }
    // R1 nokta hafızası: bu noktada en çok tutan 3 rig
    const si = spotIdx(sm, rg); if (si >= 0) { sc += [1.5, 1, 0.7][si]; why.push('bu noktada ' + (si + 1) + '. (' + spotRigTxt(sm.top[si]).replace(/^[^(]*\(/, '').replace(/\)$/, '') + ')'); }
    // R6 mevsime göre derinlik
    const rd = rigDepth(rg, month, depth); if (rd) { sc += rd.d; why.push(rd.why); }
    // R3 eksik iğne/ip envanterden yedekle tamamlanabiliyorsa öneriye girer
    const okR = ready(rg), sub = okR ? null : subFor(rg);
    if (sub) { sc -= 0.5; why.push('yedekle hazır (' + sub.list.length + ' parça)'); }
    out.push({rg, sc, why, ok: okR || !!sub, sub, learned: !!(lr || ls)});
  });
  out.sort((a, b) => b.sc - a.sc);
  out.win = w; out.x = x; out.dr = dr; out.cls = cls; out.sst = sst; out.month = month; out.spot = sm;
  return out;
}
