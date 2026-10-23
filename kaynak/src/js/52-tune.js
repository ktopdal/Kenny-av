// ---------------------------------------------------------------- 52 · tür takvimi, su sıcaklığı ve koşula göre ölçüler (v0.19)
// Tür takvimi (KB.CAL, Ege için genel bilgi): türün "şimdi" değeri = ay puanı (0–3) × su sıcaklığı uyumu. Rig puanına, rigin türlerinden
// bu ay ve bu suda en uygun olanı katkı verir ve nedeni yazılır. Kenny'nin paketindeki Ekim–Kasım tahmini (1–5) varsa o ay için o kullanılır.
// Bugünkü ayar (yalnız öneri; rigin kendi ölçüsü değişmez): kurşun (derinlik ve akış), köstek boyu (akış), köstek kalınlığı (ışık ve dip),
// hedef boy (porsiyon / trofe) ve dişli tür (lüfer, palamut) uyarısı.
const MON_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const CAL_TXT = ['mevsimi değil', 'az görülür', 'mevsiminde', 'en iyi ayında'];
// su sıcaklığı uyumu: ideal aralıkta 1, en düşük/en yüksekte ve ötesinde 0, arada doğrusal
function tempFit(t, r){
  if (t == null || !r) return null;
  const [a, lo, hi, b] = r;
  if (t >= lo && t <= hi) return 1;
  if (t <= a || t >= b) return 0;
  return t < lo ? (t - a) / (lo - a) : (b - t) / (b - hi);
}
// söz: ideal aralığın 1 °C dışına kadar "ideal" denir (21,2° için "sıcak" denmez)
const tempWord = (t, r) => t == null || !r ? '' : t <= r[0] ? 'çok soğuk' : t >= r[3] ? 'çok sıcak' : t < r[1] - 1 ? 'soğuk' : t > r[2] + 1 ? 'sıcak' : 'ideal';
function calMonth(id, month){
  const c = KB.CAL[id]; if (!c) return null;
  const sp = SPECIES[id];
  if ((month === 10 || month === 11) && sp && sp.fit_oct_est) return [0, 1, 2, 3, 3][Math.max(1, Math.min(5, Math.round(sp.fit_oct_est))) - 1];   // 1–5 → 0–3
  return +c[0][month - 1];
}
// türün bu ay ve bu sudaki durumu: m (0–3), tf (0–1 ya da veri yoksa null), v (0–1): su hiç uymuyorsa en iyi ayında bile düşük
function spNow(id, month, sst){
  const c = KB.CAL[id]; if (!c) return null;
  const m = calMonth(id, month), tf = tempFit(sst, c[1]);
  return {id, m, tf, v: m / 3 * (tf == null ? 1 : 0.15 + 0.85 * tf)};
}
const spName = id => (SPECIES[id] || {}).name || (KB.SPECIES.find(s => s.id === id) || {}).name || id;
// rigin mevsim ve su payı: {d, why, best}
function rigSeason(rg, month, sst){
  const list = (rg.species || []).map(id => spNow(id, month, sst)).filter(Boolean);
  if (!list.length) return null;
  list.sort((a, b) => b.v - a.v);
  const best = list[0];
  if (list.every(x => x.m === 0)) return {d: -2.5, why: [MON_LONG[month - 1] + ': ' + list.slice(0, 2).map(x => spName(x.id)).join(', ') + ' mevsimi değil'], best};
  const tw = sst != null ? tempWord(sst, KB.CAL[best.id][1]) : '';
  const why = [MON_LONG[month - 1] + ': ' + spName(best.id) + ' ' + CAL_TXT[best.m] + (tw ? ', su ' + f0(tempNum(sst)) + '° ' + tw : '')];
  return {d: Math.round((best.v - 0.45) * 3 * 10) / 10, why, best};
}
// şu an mevsiminde olan türler (Fishing özeti): sistemimdeki ve hedeflediğim türler önce; yoksa bölgenin türleri
function seasonNow(month, sst, n){
  const reg = regionOf(loc());
  const mine = new Set(RIG_LIST.flatMap(r => r.species || []).concat((S.targets || []).map(t => t.like || t.id)));
  const pool = KB.SPECIES.filter(s => KB.CAL[s.id] && s.bol.includes(reg) && (!mine.size || mine.has(s.id)));
  return pool.map(s => spNow(s.id, month, sst)).filter(x => x && x.m >= 2 && x.v >= 0.4).sort((a, b) => b.v - a.v || b.m - a.m).slice(0, n || 6);
}
const calDots = m => '<span class="cdots" aria-label="' + CAL_TXT[m] + '">' + [1, 2, 3].map(i => '<i class="' + (i <= m ? 'on' : '') + '"></i>').join('') + '</span>';

// ---- Bugünkü ayar
// ışık: gündüz bulut, dalga ve yağış; gece ay ışığı (aydınlık ve ay ufkun üstünde mi) ve bulut; şafak/alacakaranlık loş
function lightAt(x, dd, w, night){
  if (!x) return null;
  const cl = x.cloud == null ? 50 : x.cloud, wave = x.wave || 0, rain = x.rain || 0;
  if (w && (w.kinds || []).some(k => k === 'Şafak' || k === 'Alacakaranlık')) return {lv: 1, t: (w.kinds.includes('Şafak') ? 'şafak' : 'alacakaranlık') + ', ışık az'};
  if (!night) {
    if (cl < 35 && wave < 0.5 && rain < 0.3) return {lv: 3, t: 'güneşli ve sakin, su berrak'};
    if (cl >= 75 || wave >= 1 || rain >= 0.5) return {lv: 1, t: (rain >= 0.5 ? 'yağışlı' : cl >= 75 ? 'kapalı' : 'dalgalı') + ', ışık az'};
    return {lv: 2, t: 'gündüz'};
  }
  const L = loc(); let up = false;
  try { up = !!L && SunCalc.getMoonPosition(x.t, L.lat, L.lon).altitude > 0.1; } catch (e) {}
  const il = dd && dd.sol ? dd.sol.illum : 0;
  if (up && il >= 0.6 && cl < 50) return {lv: 2, t: 'ay ışıklı gece (%' + Math.round(il * 100) + ')'};
  return {lv: 0, t: 'karanlık gece'};
}
const LEADER_MM = [0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.235, 0.26, 0.28, 0.30, 0.33, 0.37, 0.40, 0.45, 0.50, 0.57, 0.60, 0.70, 0.80, 0.90, 1.00, 1.20, 1.40];
const mmStep = (mm, dir) => dir < 0 ? LEADER_MM.filter(v => v < mm * 0.97).pop() || null : LEADER_MM.find(v => v > mm * 1.03) || null;
// yuvanın o seviyedeki çapı (ad, ölçü ya da envanter kaleminden)
function slotMm(sl, tier){
  const t = (sl.t && (sl.t[tier] || sl.t.envanter || sl.t.turkiye)) || {};
  const it = t.item && ITEMS[t.item];
  return lineMm({name: [t.name, t.size, t.raw].filter(Boolean).join(' '), model: it ? it.name : '', spec: it ? it.spec || '' : ''});
}
const leaderSlot = rg => (rg.slots || []).find(sl => sl.k === 'kostek' || sl.k === 'lider') || null;
// envanterde bu çapta köstek var mı (florokarbon ya da misina)
function leaderHave(mm){ try { const r = resolveSlot({kind: 'line', cats: ['fc', 'mono'], lo: mm * 0.97, hi: mm * 1.03}); return r.strict ? r.strict.name : null; } catch (e) { return null; } }
const mmT = mm => { let t = (Math.round(mm * 1000) / 1000).toFixed(3); if (t.endsWith('0')) t = t.slice(0, -1); return t.replace('.', ','); };   // 0,235 · 0,40 · 0,26
// rig için bugünkü ayar satırları: [{k, t}]
function tuneRig(rg, dd, x, w, night, month){
  const out = []; if (!rg || !dd) return out;
  const L = loc(), bot = L ? L.bottom || L.bottomEst : null, rock = bot === 'kayalik' || bot === 'saf-kayalik';
  const sl = leaderSlot(rg), mm = sl ? slotMm(sl, 'envanter') : null;
  // dişli tür: bu ay mevsimindeyse ve rig ona uygunsa köstek uyarısı (ışık ayarından önce gelir)
  const pred = ['sirti', 'spin', 'canli', 'lrf'].includes(rg.tech) || /sardalya|kalamar|istavrit|canlı/i.test([rg.baitText || ''].concat(rg.baits && rg.baits.ana ? [rg.baits.ana.envanter || rg.baits.ana.turkiye || ''] : []).join(' '));
  let teeth = null;
  Object.keys(KB.TEETH).forEach(id => {
    if (teeth) return; const s = KB.SPECIES.find(z => z.id === id); if (!s || !s.bol.includes(regionOf(L))) return;
    const m = calMonth(id, month); if (m < 2) return;
    if ((rg.species || []).includes(id) || pred) teeth = {id, m, kind: KB.TEETH[id]};
  });
  if (teeth) out.push({k: 'Köstek', t: spName(teeth.id) + ' ' + CAL_TXT[teeth.m] + ': ' + (teeth.kind === 'steel' ? 'kaplamalı çelik tel (7–15 kg) ya da en az 0,50 mm florokarbon; ince köstek keser.' : 'lider en az 0,40 mm florokarbon; ince ip kesilir.'), warn: true});
  // köstek kalınlığı: ışığa göre bir boy ince ya da kalın (kayalıkta incelme önerilmez)
  const lt = lightAt(x, dd, w, night);
  if (mm && lt && !(teeth && teeth.kind === 'steel')) {
    if (lt.lv === 3 && !rock) { const to = mmStep(mm, -1); if (to) { const h = leaderHave(to); out.push({k: 'Köstek', t: lt.t + ': bir boy ince köstek balığı daha az ürkütür (' + mmT(mm) + ' → ' + mmT(to) + ' mm' + (h ? ', envanterinde: ' + h : ', envanterinde yok') + ').'}); } }
    else if (lt.lv === 3 && rock) out.push({k: 'Köstek', t: lt.t + ' ama dip kayalık: köstek aynen kalsın (' + mmT(mm) + ' mm), ince köstek kayada kopar.'});
    else if (lt.lv === 0 && (rock || rg.klass === 'trofe')) { const to = mmStep(mm, 1); if (to) { const h = leaderHave(to); out.push({k: 'Köstek', t: lt.t + ': balık ipi görmez; ' + (rock ? 'kayaya ' : 'büyük balığa ') + 'karşı bir boy kalın bağlanabilir (' + mmT(mm) + ' → ' + mmT(to) + ' mm' + (h ? ', envanterinde: ' + h : '') + ').'}); } }
  }
  // hedef boy: seçilen hedefle rigin sınıfı uyuşmuyorsa iğne ve köstek bir boy
  const tg = S.settings.ftarget;
  if (tg && rg.klass && rg.klass !== tg && (rg.slots || []).some(s => s.kind === 'hook'))
    out.push({k: 'İğne', t: tg === 'trofe' ? 'Hedef trofe, bu rig porsiyon: iğneleri bir boy büyük, köstek bir boy kalın bağla.' : 'Hedef porsiyon, bu rig trofe: iğneleri bir boy küçült; küçük ağızlı balık iğneyi alamaz.'});
  // mevsime göre derinlik (R6)
  const rd = rigDepth(rg, month, locDepth()); if (rd) out.push({k: 'Derinlik', t: rd.line});
  // akış: köstek boyu (leadFor zaten kısaltır; burada nedeni yazılır)
  const dr = x ? driftAt(x) : null;
  if (dr && dr.known && !rg.own && (rg.lengths || {}).hirsiz) {
    if (dr.line >= 0.7) out.push({k: 'Köstek boyu', t: 'akış ' + f1(dr.line) + ' kn, çok güçlü: hırsız köstek %30 kısa, köstekler dolaşmasın.'});
    else if (dr.line >= 0.4) out.push({k: 'Köstek boyu', t: 'akış ' + f1(dr.line) + ' kn: hırsız köstek %20 kısa.'});
    else if (dr.line < 0.15) out.push({k: 'Köstek boyu', t: 'akış yok denecek kadar az: köstekler tam boy, yem doğal dursun.'});
  }
  return out;
}
// ---- R6 · mevsime göre derinlik (v0.22): türün bu mevsim tutulduğu derinlik ile noktanın derinliği (Konumlar’da yazılan ya da haritadan EMODnet)
const SEASON_IX = m => m === 12 || m <= 2 ? 0 : m <= 5 ? 1 : m <= 8 ? 2 : 3;
const SEASON_TXT = ['kışın', 'ilkbaharda', 'yazın', 'sonbaharda'];
const spDepth = (id, month) => { const d = KB.SDEP[id]; return d ? d[SEASON_IX(month)] : null; };
const NO_DEPTH_TECH = ['sirti', 'spin', 'orkinos', 'capari', 'samandira', 'lrf'];   // orta su ve kıyı teknikleri: dip derinliği belirleyici değil
function rigDepth(rg, month, depth){
  if (!depth || NO_DEPTH_TECH.includes(rg.tech)) return null;
  const list = (rg.species || []).map(id => { const r = spDepth(id, month); if (!r) return null;
    const off = depth < r[0] ? r[0] - depth : depth > r[1] ? depth - r[1] : 0;
    return {id, r, off, rel: off ? off / Math.max(10, depth < r[0] ? r[0] : r[1]) : 0, deeper: depth < r[0]}; }).filter(Boolean);
  if (!list.length) return null;
  list.sort((a, b) => a.rel - b.rel);
  const b = list[0], rt = b.r[0] + '–' + b.r[1] + ' m', head = SEASON_TXT[SEASON_IX(month)] + ' ' + spName(b.id) + ' ' + rt;
  if (!b.off) return {d: 0.6, fit: true, b, why: 'derinlik uygun (' + head + ')', line: 'Burası ' + depth + ' m: ' + head + ' aralığında.'};
  return {d: -Math.round((0.4 + Math.min(1.2, b.rel)) * 10) / 10, fit: false, b, why: head + ': ' + (b.deeper ? 'daha derin' : 'daha sığ') + ' dene',
    line: 'Burası ' + depth + ' m; ' + head + '. ' + (b.deeper ? 'Daha derine in (≥ ' + b.r[0] + ' m).' : 'Daha sığa çık (≤ ' + b.r[1] + ' m).')};
}
