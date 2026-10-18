// ---------------------------------------------------------------- 45 · sürüklenme ve kurşun
// Tekne yere göre: akıntı + rüzgâr payı (rüzgâr hızının %3–6'sı, rüzgârın gittiği yöne).
// İpe binen akış: sürüklenirken tekne dipteki suya göre (rüzgâr payı + akıntının ~%40'ı; dipte akıntı yüzeyden yavaş),
// demirliyken akıntının ~%80'i. Kurşun artışı derinlik × akış² ile büyür: 50 m'de 0,4 kn ≈ +30 g (Kenny'nin kuralı).
const LEEWAY = {az: 0.03, orta: 0.045, cok: 0.06};
const LEEWAY_TXT = {az: 'Az (alçak, ağır tekne)', orta: 'Orta', cok: 'Çok (yüksek kabinli, hafif tekne)'};
const DRIFT_C = 4.2;          // g / (m · kn²)
const DEPTH_REF = 50;         // derinlik bilinmiyorsa
const SINK_MS = 1.0;          // 100–150 g kurşunla iniş hızı (m/sn), yaklaşık
const vecTo = (spd, toDeg) => [spd * Math.sin(toDeg * Math.PI / 180), spd * Math.cos(toDeg * Math.PI / 180)];
const vMag = v => Math.hypot(v[0], v[1]);
const vDir = v => (Math.atan2(v[0], v[1]) * 180 / Math.PI + 360) % 360;
function driftAt(x){
  if (!x) return null;
  const k = LEEWAY[S.settings.leeway] || LEEWAY.orta;
  const wk = x.wind == null ? null : x.wind * KN;
  const lee = wk == null || x.wdir == null ? [0, 0] : vecTo(k * wk, x.wdir + 180);
  const cur = x.cur == null || x.curDir == null ? [0, 0] : vecTo(x.cur, x.curDir);
  const anchored = S.settings.anchor === 'demir';
  const g = anchored ? [0, 0] : [lee[0] + cur[0], lee[1] + cur[1]];
  const rel = anchored ? [cur[0] * 0.8, cur[1] * 0.8] : [lee[0] + 0.4 * cur[0], lee[1] + 0.4 * cur[1]];
  return {anchored, sog: vMag(g), dir: vDir(g), lee: vMag(lee), leeDir: vDir(lee), cur: x.cur, curDir: x.curDir, line: vMag(rel),
    known: wk != null || x.cur != null, curKnown: x.cur != null, windKnown: wk != null};
}
function locDepth(){ const L = loc(); const d = L ? num(L.depth) : null; return d && d > 0 ? d : null; }
// kurşun artışı (g), 10 g'a yuvarlı
function leadExtra(dr, depth){ if (!dr) return 0; const v = DRIFT_C * (depth || DEPTH_REF) * dr.line * dr.line; return v < 8 ? 0 : Math.round(v / 10) * 10; }
// noktanın üstünden geçmek için ne kadar yukarıdan başlanır (yere göre sürüklenmenin tersine)
function startOffset(dr, depth){
  if (!dr || dr.anchored || dr.sog < 0.1) return null;
  const sec = (depth || DEPTH_REF) / SINK_MS + 90;           // iniş + dipte 1,5 dk arama
  const m = dr.sog * 0.5144 * sec;
  return {m: m < 20 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10, from: (dr.dir + 180) % 360, sinkS: Math.round((depth || DEPTH_REF) / SINK_MS)};
}
// bir günde öneri anı: verilen saat, yoksa bugünse şimdi, değilse 07:00
function refHour(dd){
  if (!dd) return null;
  const now = new Date(); const hs = dd.hs || [];
  if (dd.key === dateKey(now)) return hs.reduce((b, x) => !b || Math.abs(x.t - now) < Math.abs(b.t - now) ? x : b, null);
  return hs.find(x => x.h === 7) || hs[0] || null;
}
// kurşun ve köstek: rigin taban kurşunu + sürüklenme payı; derin noktada üst sınırdan başlar; kamış sınırı aşılmaz.
// İpe binen akış 0,4 kn üstündeyse hırsız köstek %20 kısalır (kayalık rigler zaten kısa).
function leadFor(rg, dd, x){
  x = x || refHour(dd);
  if (rg.mode === 'kiyi') return shoreLead(rg, x);
  const dr = x ? driftAt(x) : null;
  const depth = locDepth();
  const k = Object.assign({}, rg.lengths || {});
  if (dr && dr.line >= 0.4 && !rg.own && k.hirsiz) { k.hirsiz = Math.round(k.hirsiz * 0.8); k.short = true; }
  if (!rg.sinker || !rg.sinker.g) return rg.lengths ? Object.assign(k, {kursun: null, drift: dr}) : null;
  let [lo, hi] = rg.sinker.g; const max = rg.sinker.max || hi;
  if ((depth || 0) > 80) lo = hi;
  const extra = leadExtra(dr, depth);
  const need = lo + extra;                 // en az gereken
  lo = Math.min(need, max); hi = Math.min(hi + extra, max);
  const over = need > max;                 // en hafif kurşun bile kamışı aşıyor
  return Object.assign(k, {kursun: lo === hi ? lo + ' g' : lo + '–' + hi + ' g', max, extra, over, need, capped: !over && hi === max && extra > 0, drift: dr, depth, at: x ? x.t : null});
}
function driftSentence(dr){
  if (!dr || !dr.known) return 'Rüzgâr ve akıntı verisi yok; sürüklenme hesaplanamadı.';
  if (dr.anchored) return 'Demirli: akıntı ' + (dr.curKnown ? f1(dr.cur) + ' kn ' + dir8(dr.curDir) + ' yönüne' : 'bilinmiyor') + '; ipe binen akış ' + f1(dr.line) + ' kn.';
  return 'Tekne ' + f1(dr.sog) + ' kn ile ' + dir8(dr.dir) + ' yönüne sürüklenir (rüzgâr payı ' + f1(dr.lee) + ' kn' + (dr.curKnown ? ', akıntı ' + f1(dr.cur) + ' kn ' + dir8(dr.curDir) + ' yönüne' : ', akıntı verisi yok') + ').';
}
