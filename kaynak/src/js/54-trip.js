// ---------------------------------------------------------------- 54 · çıkış planı (v0.22): saat saat rig ve kurşun (R2), yem planı (R5)
// R2: Seçili bölüm 3 saatlik dilimlere ayrılır; her dilimin ortasındaki koşulla (akıntı, rüzgâr, deniz) en uygun hazır rig ve kurşunu
//     hesaplanır. Rig değişirse ya da kurşun 20 g'dan fazla değişirse plana yazılır; en iyi pencereler ve bölüm sonundaki geçiş
//     (alacakaranlıkta gece rigine, şafakta gündüz rigine) eklenir.
// R5: Kamış sayısı × iğne sayısı × saatte iğne başı yem değişimi × süre ≈ yem değişimi; %25 payla yemin satış birimine çevrilir
//     (ör. 1 kutu mamun ≈ 30 iğnelik). Tahmindir; kamış ve süre Fishing'den değiştirilir. Eksik yem alışveriş listesine eklenir.
function rigTimeline(dd, part){
  const night = part === 'gece', depth = locDepth(), now = Date.now(), ev = [];
  const blocks = fBlocks(dd, part); if (!blocks.length) return ev;
  const name = rg => (rg.code ? rg.code + ' · ' : '') + rg.name;
  let prev = null, prevEx = null, prevLead = '';
  blocks.forEach(k => {
    if (k.b <= now) return;
    const x = k.xs[Math.floor(k.xs.length / 2)] || k.xs[0];
    const R = recommend(dd, night, null, {x}), top = R.find(r => r.ok); if (!top) return;
    const ld = leadFor(top.rg, dd, x), st = blockStats(k, depth), ex = ld && ld.extra != null ? ld.extra : 0;
    const cond = [st.cur != null ? 'akıntı ' + f1(st.cur) + ' kn' : '', st.known ? (st.anch ? 'ipe akış ' + f1(st.lineHi) + ' kn' : 'sürüklenme ' + f1(st.sog) + ' kn') : '', st.bHi != null ? 'rüzgâr ' + st.bHi + ' Bft' : ''].filter(Boolean).join(', ');
    const lead = ld && ld.kursun ? 'kurşun ' + stripTags(ld.kursun) + (ld.short ? ', hırsız %' + (ld.short === true ? 20 : ld.short) + ' kısa' : '') : '';
    const t = Math.max(k.a, now);
    if (!prev) ev.push({t, kind: 'start', txt: name(top.rg) + ' bağla' + (lead ? '; ' + lead : '') + (top.sub ? ' (yedekle)' : '') + '.', why: cond});
    else if (top.rg.id !== prev.id) ev.push({t: k.a, kind: 'rig', txt: name(top.rg) + '’e geç' + (lead ? '; ' + lead : '') + '.', why: cond + (top.rg.current ? ' · akıntı rigi' : '')});
    else if (Math.abs(ex - prevEx) >= 20 && lead !== prevLead) ev.push({t: k.a, kind: 'lead', txt: (ex > prevEx ? 'Akış arttı: ' : 'Akış azaldı: ') + lead + '.', why: cond});   // kurşun yazısı değişmediyse (kamış sınırı) yazılmaz
    prev = top.rg; prevEx = ex; prevLead = lead;
  });
  bestWindows(dd, part, 2).forEach(w => { if (w.b.getTime() > now) ev.push({t: w.a.getTime(), kind: 'win', txt: winLabel(w) + ' penceresi ' + winTxt(w) + ' · balık %' + w.pct + (w.cls ? ' · deniz ' + w.cls : ''), why: w.kinds.join(', ')}); });
  // bölüm sonu geçişi
  const ds = days(), [, B] = partRange(dd, part);
  if (part === 'gun') {
    const t = dd.sol.sunset.getTime() - 10 * 60000, R = recommend(dd, true, null), top = R.find(r => r.ok);
    if (t > now && top) ev.push({t, kind: 'switch', txt: 'Alacakaranlık: devam edeceksen gece rigine geç: ' + name(top.rg) + '.', why: 'gün batımı ' + hm(dd.sol.sunset)});
  } else {
    const nd = ds[ds.indexOf(dd) + 1], t = B - 15 * 60000;
    const top = nd ? recommend(nd, false, null).find(r => r.ok) : null;
    if (t > now && top) ev.push({t, kind: 'switch', txt: 'Şafak yaklaşıyor: devam edeceksen gündüz rigine geç: ' + name(top.rg) + '.', why: 'gün doğumu ' + hm(nd.sol.sunrise)});
  }
  return ev.sort((a, b) => a.t - b.t);
}
// ---- R5 · yem planı
const BAIT_UNIT = {mamun: ['kutu', 30], sulunez: ['kutu', 25], cimcim: ['kutu', 30], 'boru-kurdu': ['kutu', 20], bibi: ['kutu', 20], 'cin-kurdu': ['kutu', 20],
  karides: ['paket (250 g)', 40], midye: ['kg', 50], yengec: ['adet', 2], kalamar: ['adet', 15], subye: ['adet', 15], ahtapot: ['kg', 60], sardalya: ['kg', 60],
  hamsi: ['kg', 80], istavrit: ['kg', 50], gumus: ['kg', 80], uskumru: ['kg', 50], 'balik-serit': ['kg', 50], ekmek: ['adet', 40], tavuk: ['kg', 80]};
const hookCount = rg => (rg.slots || []).filter(sl => sl.kind === 'hook' || sl.kind === 'hook+').length;
function baitPlan(dd, part, R){
  const ok = R.filter(x => x.ok).slice(0, 2); if (!ok.length) return null;
  const main = ok[0].rg, hooks = hookCount(main);
  const rods = Math.max(1, +S.settings.rods || 2), [A, B] = partRange(dd, part), hours = Math.max(1, Math.min(+S.settings.tripH || 4, (B - A) / 3600000));
  if (!hooks) return {none: true, rods, hours, main};
  const pct = R.win ? R.win.pct : 40, warm = (R.sst || 0) >= 22;
  const rate = Math.max(1, 3 + (pct >= 60 ? 1 : pct < 35 ? -1 : 0) + (warm ? 1 : 0));   // saatte iğne başı yem değişimi
  const changes = rods * hooks * rate * hours;
  const bp = baitPick(main), list = bp.list.filter(x => x.ids.length || baitKey(x.t));
  const pick = [], add = (b, share) => { if (!b) return; const key = baitKey(b.t) || 'x:' + trLower(b.t); const e = pick.find(p => p.key === key); if (e) e.share += share; else pick.push({key, t: b.t, st: b.st, share}); };
  add(bp.use, 0.7);
  const second = list.find(x => x !== bp.use && x.src === 'rig') || (ok[1] ? baitPick(ok[1].rg).use : null);
  if (second && (baitKey(second.t) || second.t) !== (baitKey(bp.use && bp.use.t) || (bp.use && bp.use.t))) add(second, 0.3); else if (pick[0]) pick[0].share = 1;
  const items = pick.filter(p => !LURE_WORDS.test(trLower(p.t))).map(p => {
    const k = p.key === '*canli' ? 'canli' : p.key, live = /^canli|^teke$/.test(k) || k === 'canli';
    const std = STD_BAITS.find(b => b.key === p.key);
    const u = live ? ['adet', 1] : BAIT_UNIT[k] || ['paket', 30];
    const need = live ? Math.ceil(rods * hooks * 1.2 * hours * p.share) : Math.max(1, Math.ceil(changes * p.share * 1.25 / u[1]));
    return {key: p.key, name: std ? std.name : p.t, qty: need, unit: u[0], st: p.st, share: p.share};
  });
  return {rods, hours: Math.round(hours * 10) / 10, rate, hooks, changes: Math.round(changes), warm, items, main};
}
// eksik yemleri alışveriş listesine (o çıkış için; çıkış günü geçince listeden düşer)
function baitToShop(dd, part, plan){
  S.shopX = S.shopX || {}; let n = 0;
  const forTxt = dd.date.getDate() + ' ' + MON3[dd.date.getMonth()] + ' ' + PART_TXT[part].toLowerCase();
  const until = part === 'gece' ? dateKey(new Date(dd.date.getFullYear(), dd.date.getMonth(), dd.date.getDate() + 1)) : dd.key;
  plan.items.forEach(it => {
    const k = 'yem:' + it.key + ':' + dd.key + ':' + part;
    S.shopX[k] = {k, item: null, size: it.qty + ' ' + it.unit, name: it.name, store: null, kind: 'bait', sp: null, for: [forTxt], until, bait: it.key, added: new Date().toISOString()}; n++;
  });
  persist(); return n;
}
