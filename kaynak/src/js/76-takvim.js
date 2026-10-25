// ---------------------------------------------------------------- 76 · Takvim sayfası (v0.27)
// "Konum 1 Av Takvimi" sayfasının düzeni uygulamanın içinde, her gün güncel veriyle ve kullanıcının seçtiği noktalar için:
// kahraman (konum çizelgesi), özet ve uygunluk şeridi, dikey gün kartları (ya da eski satır listesi), meteogram, ayrıntılı tablo,
// solunar şeritleri, en iyi pencereler (rig önerisiyle), yöntem. En çok 3 nokta seçilir; her nokta kendi sekmesinde, "Karşılaştır"
// sekmesinde günler yan yana dikey kartlarla. İkonlar shell.html'deki ak-* sembollerinden gelir.
const DOWL = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const AK_CONF = {'yüksek': [4, 'Yüksek', 1], 'iyi': [3, 'İyi', 0.97], 'orta': [2, 'Orta', 0.9], 'düşük': [1, 'Düşük', 0.75]};
const AK_WXT = {sunny: 'Açık', partly: 'Parçalı bulutlu', cloudy: 'Bulutlu', rain: 'Yağmurlu', drizzle: 'Çiseleme', showers: 'Sağanak olasılığı', unknown: 'Veri yok'};
let CAL_DIRTY = true;
// gün görünümü bu cihaza kaydedilir (telefon ve tablet aynı profili paylaşsa da ayrı seçilir): yoksa telefonda yatay, tablette dikey
const CV_KEY = 'alyssa-cv';
function calView(){ let v = null; try { v = localStorage.getItem(CV_KEY); } catch (e) {} return v === 'kart' || v === 'liste' ? v : ((window.innerWidth || 400) >= 700 ? 'kart' : 'liste'); }
function setCalView(v){ try { localStorage.setItem(CV_KEY, v); } catch (e) {} }
const akI = (n, c) => '<svg class="' + (c || 't-ic') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#ak-' + n + '"/></svg>';
const akWxI = (k, c) => '<svg class="' + (c || 't-wx') + '" viewBox="0 0 48 48" role="img" aria-label="' + AK_WXT[k] + '"><title>' + AK_WXT[k] + '</title><use href="#ak-w-' + k + '"/></svg>';
// ok rüzgârın / dalganın gittiği yöne bakar (geldiği yön + 180°); akıntı zaten gittiği yöndür
const akArr = (from, c) => from == null ? '' : '<svg class="' + (c || 't-arr') + '" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(' + Math.round((from + 180) % 360) + 'deg)"><use href="#ak-arrow"/></svg>';
const akArrTo = (to, c) => to == null ? '' : akArr((to + 180) % 360, c);
const akStars = n => '<span class="t-stars" role="img" aria-label="' + n + ' / 5 yıldız">' + [0, 1, 2, 3, 4].map(i => '<svg class="t-st ' + (i < n ? 'on' : 'off') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#ak-star"/></svg>').join('') + '</span>';
const akConf = c => { const a = AK_CONF[c] || AK_CONF['orta']; return '<span class="t-conf c' + a[0] + '" role="img" aria-label="Güven ' + a[1] + '" title="Güven: ' + a[1] + '"><i></i><i></i><i></i><i></i></span>'; };
const akBadge = (c, icon, label, sm) => c ? '<span class="t-badge ' + c + (sm ? ' sm' : '') + '" title="' + esc(CLS_TXT[c]) + '">' + (icon ? akI(icon) : '') + (label || c) + '</span>' : '';
const akDname = d => d.getDate() + ' ' + MONTHS[d.getMonth()];
const akWk = d => d.getDay() === 0 || d.getDay() === 6;
const akDay0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function akRange(a, b){
  if (dateKey(a) === dateKey(b)) return akDname(a);
  if (a.getMonth() === b.getMonth()) return a.getDate() + '–' + b.getDate() + ' ' + MONTHS[b.getMonth()];
  return akDname(a) + ' – ' + akDname(b);
}
// "17 ve 26 Ekim" / "17, 26 ve 29 Ekim" (ay değişince ay adıyla)
function akList(ds){
  const g = []; ds.forEach(d => { const m = MONTHS[d.date.getMonth()]; if (g.length && g[g.length - 1][0] === m) g[g.length - 1][1].push(d.date.getDate()); else g.push([m, [d.date.getDate()]]); });
  return g.map(([m, n]) => n.length === 1 ? n[0] + ' ' + m : n.slice(0, -1).join(', ') + ' ve ' + n[n.length - 1] + ' ' + m).join(', ');
}
function akRuns(ds, pred){ const out = []; let cur = []; ds.forEach(d => { if (pred(d)) cur.push(d); else if (cur.length) { out.push(cur); cur = []; } }); if (cur.length) out.push(cur); return out; }
// ay evresi resmi (illum 0–1, büyüyen mi)
function akMoon(illum, waxing, size, craters){
  const s = size || 28, c = s / 2, r = s / 2 - 1.6, k = Math.max(0, Math.min(1, illum || 0));
  let p = '<svg class="t-moon" viewBox="0 0 ' + s + ' ' + s + '" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false"><circle cx="' + c + '" cy="' + c + '" r="' + r.toFixed(1) + '" fill="var(--moon-dark)" stroke="var(--moon-edge)" stroke-width="1"/>';
  p += akMoonLit(k, waxing, c, c, r);
  if (craters && s >= 30) [[-0.28, -0.22, 0.16], [0.22, 0.12, 0.2], [-0.1, 0.38, 0.11]].forEach(([fx, fy, fr]) => { p += '<circle cx="' + (c + fx * r).toFixed(1) + '" cy="' + (c + fy * r).toFixed(1) + '" r="' + (fr * r).toFixed(1) + '" fill="var(--moon-dark)" opacity=".10"/>'; });
  return p + '</svg>';
}
function akMoonLit(k, waxing, cx, cy, r){
  if (k >= 0.97) return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '" fill="var(--moon-lit)"/>';
  if (k <= 0.03) return '';
  const rx = Math.abs(1 - 2 * k) * r, f = v => v.toFixed(2);
  const d = waxing ? 'M' + f(cx) + ' ' + f(cy - r) + ' A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(cx) + ' ' + f(cy + r) + ' A' + f(rx) + ' ' + f(r) + ' 0 0 ' + (k < 0.5 ? 0 : 1) + ' ' + f(cx) + ' ' + f(cy - r) + ' Z'
    : 'M' + f(cx) + ' ' + f(cy - r) + ' A' + f(r) + ' ' + f(r) + ' 0 0 0 ' + f(cx) + ' ' + f(cy + r) + ' A' + f(rx) + ' ' + f(r) + ' 0 0 ' + (k < 0.5 ? 1 : 0) + ' ' + f(cx) + ' ' + f(cy - r) + ' Z';
  return '<path d="' + d + '" fill="var(--moon-lit)"/>';
}
const akMoonG = (illum, waxing, cx, cy, r) => '<g><circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r + '" fill="var(--moon-dark)" stroke="var(--moon-edge)" stroke-width="1"/>' + akMoonLit(Math.max(0, Math.min(1, illum || 0)), waxing, +cx.toFixed(1), +cy.toFixed(1), r) + '</g>';
const akWax = dd => { if (dd._wax == null) dd._wax = SunCalc.getMoonIllumination(new Date(akDay0(dd.date) + 12 * 3600000)).phase < 0.5; return dd._wax; };
// ana evreler (yeniay, ilk dördün, dolunay, son dördün) ve tam saatleri: Meeus, Astronomical Algorithms, 49. bölüm (dakika düzeyinde)
function akPhaseT(k){
  const T = k / 1236.85, rd = Math.PI / 180, q = Math.round((k - Math.floor(k)) * 4) % 4;
  const JDE = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T * T * T + 0.00000000073 * T * T * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = (2.5534 + 29.1053567 * k - 0.0000014 * T * T) * rd, Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T * T * T) * rd;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T * T * T) * rd, Om = (124.7746 - 1.56375588 * k + 0.0020672 * T * T) * rd;
  const sn = Math.sin; let c;
  if (q === 0 || q === 2) {
    const nw = q === 0;
    c = (nw ? -0.4072 : -0.40614) * sn(Mp) + (nw ? 0.17241 : 0.17302) * E * sn(M) + (nw ? 0.01608 : 0.01614) * sn(2 * Mp) + (nw ? 0.01039 : 0.01043) * sn(2 * F) +
      (nw ? 0.00739 : 0.00734) * E * sn(Mp - M) - (nw ? 0.00514 : 0.00515) * E * sn(Mp + M) + (nw ? 0.00208 : 0.00209) * E * E * sn(2 * M) - 0.00111 * sn(Mp - 2 * F) - 0.00057 * sn(Mp + 2 * F) +
      0.00056 * E * sn(2 * Mp + M) - 0.00042 * sn(3 * Mp) + 0.00042 * E * sn(M + 2 * F) + 0.00038 * E * sn(M - 2 * F) - 0.00024 * E * sn(2 * Mp - M) - 0.00017 * sn(Om) - 0.00007 * sn(Mp + 2 * M) +
      0.00004 * sn(2 * Mp - 2 * F) + 0.00004 * sn(3 * M) + 0.00003 * sn(Mp + M - 2 * F) + 0.00003 * sn(2 * Mp + 2 * F) - 0.00003 * sn(Mp + M + 2 * F) + 0.00003 * sn(Mp - M + 2 * F) - 0.00002 * sn(Mp - M - 2 * F) - 0.00002 * sn(3 * Mp + M) + 0.00002 * sn(4 * Mp);
  } else {
    c = -0.62801 * sn(Mp) + 0.17172 * E * sn(M) - 0.01183 * E * sn(Mp + M) + 0.00862 * sn(2 * Mp) + 0.00804 * sn(2 * F) + 0.00454 * E * sn(Mp - M) + 0.00204 * E * E * sn(2 * M) - 0.0018 * sn(Mp - 2 * F) -
      0.0007 * sn(Mp + 2 * F) - 0.0004 * sn(3 * Mp) - 0.00034 * E * sn(2 * Mp - M) + 0.00032 * E * sn(M + 2 * F) + 0.00032 * E * sn(M - 2 * F) - 0.00028 * E * E * sn(Mp + 2 * M) + 0.00027 * E * sn(2 * Mp + M) -
      0.00017 * sn(Om) - 0.00005 * sn(Mp - M - 2 * F) + 0.00004 * sn(2 * Mp + 2 * F) - 0.00004 * sn(Mp + M + 2 * F) + 0.00004 * sn(Mp - 2 * M) + 0.00003 * sn(Mp + M - 2 * F) + 0.00003 * sn(3 * M) + 0.00002 * sn(2 * Mp - 2 * F) + 0.00002 * sn(Mp - M + 2 * F) - 0.00002 * sn(3 * Mp + M);
    const W = 0.00306 - 0.00038 * E * Math.cos(M) + 0.00026 * Math.cos(Mp) - 0.00002 * Math.cos(Mp - M) + 0.00002 * Math.cos(Mp + M) + 0.00002 * Math.cos(2 * F);
    c += q === 1 ? W : -W;
  }
  return new Date((JDE + c - 69 / 86400 - 2440587.5) * 86400000);   // TT → UT (ΔT ≈ 69 sn)
}
function akPhases(t0, t1){
  const NM = [['Yeniay', 0, true], ['İlk dördün', 0.5, true], ['Dolunay', 1, true], ['Son dördün', 0.5, false]], out = [];
  const y = new Date(t0).getFullYear() + (new Date(t0).getMonth() + 0.5) / 12;
  const k0 = Math.floor((y - 2000) * 12.3685) - 2;
  for (let k = k0; k < k0 + 8; k++) for (let q = 0; q < 4; q++) { const t = akPhaseT(k + q / 4); if (t.getTime() >= t0 && t.getTime() < t1) out.push({name: NM[q][0], t, illum: NM[q][1], waxing: NM[q][2]}); }
  return out.sort((a, b) => a.t - b.t);
}
// gün değerleri: hava simgesi, rüzgâr/dalga/akıntı yönü (rüzgâr ağırlıklı ortalama)
function akDayWx(dd){
  if (dd._wxk) return dd._wxk;
  const hs = dd.hs.filter(x => x.h >= 7 && x.h < 19), cl = meanOf(hs, 'cloud'), pp = maxOf(hs, 'pop'), rn = hs.reduce((a, x) => a + (x.rain || 0), 0);
  let k = 'unknown';
  if (cl != null || pp != null) {
    const c = cl == null ? 50 : cl, p = pp || 0;
    k = rn >= 2 || p >= 70 ? 'rain' : rn >= 0.3 || p >= 45 ? (c < 70 ? 'showers' : 'drizzle') : c < 20 ? 'sunny' : c < 65 ? 'partly' : 'cloudy';
  }
  return (dd._wxk = k);
}
function akMeanDir(hs, dk, wk){
  let s = 0, c = 0; hs.forEach(x => { const d = x[dk], w = wk ? x[wk] : 1; if (d == null || w == null) return; s += Math.sin(d * Math.PI / 180) * w; c += Math.cos(d * Math.PI / 180) * w; });
  return !s && !c ? null : (Math.atan2(s, c) * 180 / Math.PI + 360) % 360;
}
const akDir = (dd, night) => akMeanDir(dd.hs.filter(x => night ? (x.h < 7 || x.h >= 19) : (x.h >= 7 && x.h < 18)), 'wdir', 'wind');
// rüzgâr değeri: seçili birim (Bft rozeti ya da sayı) ve küçük ikinci birim
function akW(ms, two){
  if (ms == null) return '–';
  const u = windU(), u2 = windU2();
  const main = u === 'bft' ? bftBadge(bft(ms)) + ' Bft' : windNum(ms, u) + ' ' + WU_TXT[u];
  return main + (two === false ? '' : ' <small>' + (u2 === 'bft' ? bft(ms) + ' Bft' : windNum(ms, u2) + ' ' + WU_TXT[u2]) + '</small>');
}
// hamle gündüz / gece (rüzgâr gibi iki değer)
function akW2(a, b){
  if (b == null) return akW(a, false); if (a == null) return akW(b, false);
  const u = windU(); return u === 'bft' ? bftBadge(bft(a)) + '/' + bftBadge(bft(b)) + ' Bft' : windNum(a, u) + '/' + windNum(b, u) + ' ' + WU_TXT[u];
}
const akWt = ms => ms == null ? '–' : windNum(ms) + ' ' + WU_TXT[windU()];
// günün en iyi penceresi ve sıralama puanı (balık × deniz payı × güven)
function akBest(ds){
  const rows = []; ds.forEach(dd => windows(dd).forEach(w => rows.push({dd, w, adj: w.pct * (SEA_F[w.cls] || 0.5) * (AK_CONF[dd.conf] || AK_CONF['orta'])[2]})));
  return rows.sort((a, b) => b.adj - a.adj);
}

// ---------------------------------------------------------------- konum çizelgesi (ölçekli dakika ağı, 1–2–3 mil halkaları; kara çizilmez)
function akPlot(L){
  const W = 380, cx = 190, cy = 190, nm = 52, coslat = Math.cos(L.lat * Math.PI / 180);
  const latM = (Math.abs(L.lat) % 1) * 60, lonM = (Math.abs(L.lon) % 1) * 60, sLat = L.lat >= 0 ? 1 : -1, sLon = L.lon >= 0 ? 1 : -1;
  const x0 = 26, y0 = 26, x1 = W - 26, y1 = W - 26, o = [];
  o.push('<svg class="t-plot" viewBox="0 0 ' + W + ' ' + W + '" role="img" aria-label="' + esc(locLabel(L)) + ' çizelgesi: 1, 2 ve 3 millik halkalar">');
  o.push('<defs><clipPath id="ak-plotclip"><rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '"/></clipPath></defs>');
  o.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" fill="var(--plot-bg)"/><g clip-path="url(#ak-plotclip)">');
  const bl = Math.floor(latM), bo = Math.floor(lonM), ys = [], xs = [];
  for (let k = -4; k <= 5; k++) { const m = bl + k, y = cy - sLat * (m - latM) * nm; if (y >= y0 - 2 && y <= y1 + 2) { o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="pl-grid"/>'); ys.push([y, m]); } }
  for (let k = -6; k <= 7; k++) { const m = bo + k, x = cx + sLon * (m - lonM) * nm * coslat; if (x >= x0 - 2 && x <= x1 + 2) { o.push('<line y1="' + y0 + '" y2="' + y1 + '" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" class="pl-grid"/>'); xs.push([x, m]); } }
  [1, 2, 3].forEach(i => o.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + i * nm + '" class="pl-ring"/>'));
  o.push('<line x1="' + x0 + '" x2="' + x1 + '" y1="' + cy + '" y2="' + cy + '" class="pl-axis"/><line y1="' + y0 + '" y2="' + y1 + '" x1="' + cx + '" x2="' + cx + '" class="pl-axis"/></g>');
  o.push('<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" class="pl-frame"/>');
  const mm = m => pad(((m % 60) + 60) % 60) + '′';
  ys.forEach(([y, m]) => { if (y >= y0 + 6 && y <= y1 - 6) o.push('<text x="' + (x0 - 4) + '" y="' + y.toFixed(1) + '" class="pl-tick" text-anchor="end" dominant-baseline="middle">' + mm(m) + '</text>'); });
  xs.forEach(([x, m]) => { if (x >= x0 + 10 && x <= x1 - 10) o.push('<text x="' + x.toFixed(1) + '" y="' + (y0 - 8) + '" class="pl-tick" text-anchor="middle">' + mm(m) + '</text>'); });
  [1, 2, 3].forEach(i => o.push('<text x="' + (cx + i * nm * 0.7071 + 3).toFixed(1) + '" y="' + (cy - i * nm * 0.7071 - 3).toFixed(1) + '" class="pl-ringlbl">' + i + ' mil</text>'));
  const nmTxt = String(L.id === '1' && L.pkg ? '1' : locLabel(L)).slice(0, 14);
  o.push('<circle cx="' + cx + '" cy="' + cy + '" r="9" class="pl-mark-halo"/><circle cx="' + cx + '" cy="' + cy + '" r="4.2" class="pl-mark"/><text x="' + (cx + 13) + '" y="' + (cy - 11) + '" class="pl-name">' + esc(nmTxt) + '</text>');
  const sx = x0 + 12, sy = y1 - 14;
  o.push('<path d="M' + sx + ' ' + sy + ' h' + nm + ' M' + sx + ' ' + sy + ' v-5 M' + (sx + nm) + ' ' + sy + ' v-5" class="pl-scale"/><text x="' + (sx + nm + 6) + '" y="' + (sy + 1) + '" class="pl-scale-t">1 deniz mili</text>');
  const nx = x1 - 22, ny = y1 - 34;
  o.push('<path d="M' + nx + ' ' + (ny - 14) + ' l6 16 -6 -4 -6 4z" class="pl-north"/><text x="' + nx + '" y="' + (ny + 14) + '" class="pl-n" text-anchor="middle">K</text></svg>');
  return o.join('');
}

// ---------------------------------------------------------------- bölüm başlığı ve kahraman
const akHead = (eb, title, sub, right) => '<div class="t-head"><span class="eyebrow">' + eb + '</span><div class="t-hrow"><h2>' + title + '</h2>' + (right || '') + '</div>' + (sub ? '<p class="t-sub">' + sub + '</p>' : '') + '</div>';
function akHero(L, ds, land, cmp){
  const hide = S.settings.hideCoords, kind = locKind(L);
  const n = ds.length, d0 = ds[0], d1 = ds[n - 1];
  let h = '<header class="t-hero' + (hide || cmp ? ' noplot' : '') + '"><div>';
  h += '<p class="t-kicker">' + akI('pin') + (cmp ? '<span>' + cmp.length + ' nokta</span><span>·</span><span>' + esc(cmp.map(id => locLabel(S.locations[id])).join(' · ')) + '</span>'
    : '<span>' + esc(locLabel(L)) + '</span><span>·</span><span>' + esc(KIND_TXT[kind] + (kind !== 'kara' && shoreMode() ? ' · kıyıdan av' : kind !== 'kara' ? ' · tekne' : '')) + '</span>') + '</p>';
  h += '<h1 class="t-h1"><span>' + (n ? n + ' günlük' : 'Günlük') + '</span> <em id="calTitle">' + (land ? 'Hava takvimi' : 'Av takvimi') + '</em></h1>';
  const what = land ? 'hava, rüzgâr, hamle, sıcaklık, basınç ve yağış.' : shoreMode() ? 'hava, rüzgâr, dalga, su sıcaklığı, solunar pencereler ve kıyıdan tutulabilecek balıklar.' : 'hava, rüzgâr, dalga, su sıcaklığı, solunar pencereler ve tekneyle tutulabilecek balıklar.';
  h += '<p class="t-lede" id="calSub">' + (n ? esc(akRange(d0.date, d1.date) + ' ' + d1.date.getFullYear()) + ': ' : '') + (cmp ? 'noktalar yan yana. Her gün balık ve deniz sınıfına göre en iyi nokta işaretli; bir karta dokun, o nokta seçilir ve o günün saatlik tablosu açılır.' : what) + '</p>';
  if (!cmp && !hide) h += '<div class="t-coords"><span class="t-pill">' + akI('compass') + esc(f6(L.lat)) + '° ' + (L.lat >= 0 ? 'K' : 'G') + '</span><span class="t-pill">' + akI('compass') + esc(f6(L.lon)) + '° ' + (L.lon >= 0 ? 'D' : 'B') + '</span><span class="t-pill">' + esc(ddm(L.lat, 'K', 'G') + ' · ' + ddm(L.lon, 'D', 'B')) + '</span></div>';
  if (!cmp) {
    const at = S.wx && S.wx.at ? new Date(S.wx.at) : null;
    const ms = [...new Set(ds.flatMap(d => d.models))];
    h += '<p class="t-stamp">' + (at ? 'Veri ' + esc(fmtDT(at)) + ' güncellendi. ' : '') + 'Rüzgâr: ' + esc(ms.join(', ') || '–') + (land ? '' : ' · hamle GFS · dalga MFWAM') + '. Saatler telefonun saatidir. Bir güne dokun, saatlik tablosu açılır.</p>';
  }
  h += '<div class="row wrap" id="calAlertRow"' + (land ? ' hidden' : '') + '><button class="btn small" type="button" data-open="uyari">' + akI('clock') + 'Takvim uyarısı kur</button></div>';
  h += '</div>' + (cmp || hide ? '' : '<figure class="t-plotfig">' + akPlot(L) + '<figcaption>' + esc(locLabel(L)) + ' · çizelge ölçeklidir: 1 deniz mili = 1 dakika enlem</figcaption></figure>') + '</header>';
  return h;
}
const f6 = v => v.toFixed(6).replace('.', ',');

// ---------------------------------------------------------------- özet
function akSummary(ds, land){
  const it = [], add = (ic, cls, t) => it.push('<li><span class="t-ib ' + cls + '">' + akI(ic) + '</span><p class="t">' + t + '</p></li>');
  if (!land) {
    const ok = d => ['A', 'B'].includes(d.clsD) && ['A', 'B'].includes(d.clsN) && d.conf !== 'düşük';
    const rr = akRuns(ds, ok).sort((a, b) => b.length - a.length)[0];
    if (rr) {
      const wm = Math.max(...rr.map(x => Math.max(x.wd || 0, x.wn || 0))), hm2 = Math.max(...rr.map(x => x.wave || 0));
      add('boat', 'ok', '<b>' + akRange(rr[0].date, rr[rr.length - 1].date) + '</b> ' + (shoreMode() ? 'kıyı' : 'tekne') + ' için en rahat aralık: gündüz ve gece A–B sınıfı (rüzgâr en çok ' + akWt(wm) + ')' + (hm2 ? ', dalga en fazla ' + f1(hm2) + ' m' : '') + '.');
    } else add('boat', 'warn', 'Bu dönemde gündüzü ve gecesi birlikte A–B sınıfı olan gün yok; tek tek günlere ve saatlik tabloya bak.');
    const bad = ds.filter(d => d.clsD === 'D' || d.clsN === 'D'), bh = bad.filter(d => d.conf !== 'düşük'), bl = bad.filter(d => d.conf === 'düşük');
    const rng = a => { const v = [...new Set(a.map(d => windNum(Math.max(d.wd || 0, d.wn || 0))))].sort((p, q) => p - q); return (v.length > 1 ? v[0] + '–' + v[v.length - 1] : v[0]) + ' ' + WU_TXT[windU()]; };
    const parts = []; if (bh.length) parts.push('<b>' + akList(bh) + '</b> deniz D sınıfında (rüzgâr ' + rng(bh) + ' ya da dalga yüksek): çıkışı gözden geçir');
    if (bl.length) parts.push('<b>' + akList(bl) + '</b> için tahmin ' + rng(bl) + ' civarı gösteriyor (düşük güven)');
    if (parts.length) add('warn', 'warn', parts.join('. ') + '.');
    const pk = akRuns(ds, d => d.sol.stars >= 4);
    const ph = akPhases(akDay0(ds[0].date), akDay0(ds[ds.length - 1].date) + 86400000);
    if (pk.length || ph.length) {
      const best = pk.sort((a, b) => b.reduce((s, x) => s + x.sol.stars, 0) - a.reduce((s, x) => s + x.sol.stars, 0))[0];
      const five = ds.filter(d => d.sol.stars === 5);
      add('moon', 'gold', (best ? '<b>Solunar ' + akRange(best[0].date, best[best.length - 1].date) + '</b> ' + (best.length > 1 ? 'arası' : 'günü') + ' 4–5 yıldız' + (five.length ? ' (zirve ' + akList(five) + ')' : '') + '. ' : '') +
        ph.map(p => p.name + ' ' + akDname(p.t) + ' ' + hm(p.t)).join(', ') + (ph.length ? '.' : ''));
    }
    const seen = new Set(), top = []; akBest(ds).forEach(r => { if (top.length < 3 && !seen.has(r.dd.key)) { seen.add(r.dd.key); top.push(r); } });
    if (top.length) add('fish', '', '<b>En iyi pencereler</b> (balık, deniz ve güvene göre, günde en iyisi): ' + top.map(r => akDname(r.dd.date) + ' ' + winTxt(r.w) + ' ' + r.w.kinds.join('+') + ' (%' + r.w.pct + ', ' + (r.w.night ? 'gece' : 'gündüz') + (r.w.cls ? ', ' + r.w.cls + ' sınıfı' : '') + ')').join('; ') + '.');
  } else {
    const calm = ds.filter(d => d.wd != null && bft(d.wd) <= 3);
    add('wind', '', calm.length ? '<b>' + akList(calm.slice(0, 8)) + '</b> gündüz rüzgâr 3 Bft ve altında.' : 'Bu dönemde gündüz rüzgârı 4 Bft altına inmiyor.');
    const windy = ds.filter(d => d.gD != null && bft(d.gD) >= 6); if (windy.length) add('warn', 'warn', '<b>' + akList(windy) + '</b> hamle 6 Bft ve üstü.');
  }
  const tmn = minOf(ds, 'tmin'), tmx = maxOf(ds, 'tmax'), sst = ds.filter(d => d.sst != null), rain = ds.filter(d => d.rain >= 1);
  add('thermo', '', 'Hava <b>' + tempV(tmn) + '–' + tempV(tmx) + ' ' + TU() + '</b>' + (!land && sst.length ? ', su sıcaklığı <b>' + tempV(sst[0].sst, true) + ' → ' + tempV(sst[sst.length - 1].sst, true) + ' ' + TU() + '</b>' : '') + '. ' +
    (rain.length ? 'Belirgin yağış ' + rain.slice(0, 5).map(d => akDname(d.date) + ' (' + f1(d.rain) + ' mm)').join(', ') + (rain.length > 5 ? ' ve ' + (rain.length - 5) + ' gün daha' : '') + '.' : 'Belirgin yağış görünmüyor.'));
  const fall = akRuns(ds, d => d.pdelta != null && d.pdelta <= -2.5)[0];
  if (fall) add('gauge', '', 'Basınç ' + akRange(fall[0].date, fall[fall.length - 1].date) + ' ' + (fall.length > 1 ? 'arası günde' : 'günü') + ' yaklaşık ' + Math.round(Math.abs(fall.reduce((a, x) => a + x.pdelta, 0) / fall.length)) + ' hPa düşüyor; hava değişiminin habercisi olabilir.');
  const low = ds.find(d => d.conf === 'düşük');
  if (low) add('info', '', '<b>' + akDname(low.date) + ' ve sonrası</b> düşük güven: modeller uzak günlerde ayrışır, yalnız eğilim olarak oku.');
  return '<ul class="t-sum">' + it.join('') + '</ul>';
}
// uygunluk şeridi: gündüz, gece ve solunar (karşılaştırmada her nokta için gündüz/gece)
function akStrip(ds, rows){
  const n = ds.length, cols = 'grid-template-columns:52px repeat(' + n + ',minmax(16px,1fr))';
  let h = '<div class="t-strip-w"><div class="t-strip" style="' + cols + '" role="table" aria-label="Günlük uygunluk"><span class="lab"></span>' + ds.map(d => '<span class="dn' + (akWk(d.date) ? ' wk' : '') + '">' + d.date.getDate() + '</span>').join('');
  rows.forEach(r => {
    if (r.group) { h += '<span class="gl">' + esc(r.group) + '</span>'; return; }
    h += '<span class="lab">' + esc(r.lab) + '</span>' + r.cells.map(c => c == null ? '<span class="cell na">–</span>' : '<span class="cell ' + c.c + '" title="' + esc(c.t) + '">' + c.v + '</span>').join('');
  });
  return h + '</div></div>';
}
function akSecOzet(ds, land){
  const n = ds.length, rows = [];
  if (!land) {
    rows.push({lab: 'gündüz', cells: ds.map(d => d.clsD ? {c: d.clsD, v: d.clsD, t: akDname(d.date) + ' ' + DOW[d.date.getDay()] + ': gündüz ' + CLS_TXT[d.clsD]} : null)});
    rows.push({lab: 'gece', cells: ds.map(d => d.clsN ? {c: d.clsN, v: d.clsN, t: akDname(d.date) + ' ' + DOW[d.date.getDay()] + ': gece ' + CLS_TXT[d.clsN]} : null)});
    rows.push({lab: 'solunar', cells: ds.map(d => ({c: 'sol s' + d.sol.stars, v: d.sol.stars, t: akDname(d.date) + ': solunar ' + d.sol.stars + '/5 yıldız'}))});
  } else {
    rows.push({lab: 'gündüz', cells: ds.map(d => d.wd == null ? null : {c: seaClass(d.wd), v: bft(d.wd), t: akDname(d.date) + ': gündüz en çok ' + bft(d.wd) + ' Bft'})});
    rows.push({lab: 'hamle', cells: ds.map(d => d.gD == null ? null : {c: seaClass(d.gD), v: bft(d.gD), t: akDname(d.date) + ': hamle ' + bft(d.gD) + ' Bft'})});
  }
  const ph = akPhases(akDay0(ds[0].date), akDay0(ds[n - 1].date) + 86400000);
  return '<section class="t-sec" id="t-ozet">' + akHead('Özet', 'Bu ' + n + ' günde ne var?', 'Tek bakışta: ' + (land ? 'rüzgâr, sıcaklık ve yağış' : 'deniz uygunluğu, solunar gücü ve öne çıkan pencereler') + '. Ayrıntılar aşağıda.') +
    '<div class="t-sumgrid"><div class="t-panel">' + akSummary(ds, land) + '</div><div class="t-panel"><h3>' + (land ? 'Rüzgâr şeridi' : (shoreMode() ? 'Kıyı' : 'Tekne') + ' uygunluğu şeridi') + '</h3>' +
    '<p class="t-note" style="margin:4px 0 12px">' + (land ? 'Gündüz (07–18) en yüksek rüzgâr ve hamle, Bft.' : 'Rüzgâr ve dalgaya göre gündüz (07–18) ve gece (19–06) sınıfı.') + '</p>' + akStrip(ds, rows) +
    '<div class="t-legend">' + 'ABCD'.split('').map(c => '<span><i class="t-sw ' + c + '"></i>' + c + ' ' + CLS_TXT[c] + '</span>').join('') + (land ? '' : '<span><i class="t-sw sol"></i>Solunar 1–5 yıldız</span>') + '</div>' +
    (ph.length ? '<div class="t-phases">' + ph.map(p => '<div class="t-phase">' + akMoon(p.illum, p.waxing, 34, true) + '<div><b>' + p.name + '</b><small>' + akDname(p.t) + ' ' + hm(p.t) + '</small></div></div>').join('') + '</div>' : '') +
    '</div></div></section>';
}

// ---------------------------------------------------------------- dikey gün kartları
function akDayCard(dd, o){
  const land = o.land, on = o.on, key = dd.key, w = land ? null : windows(dd)[0];
  const today = key === dateKey(new Date());
  let cls = 't-day' + (dd.idx >= 10 ? ' low' : ''), flag = '';
  if (o.best.includes(key)) { cls += ' best'; flag = '<span class="t-flag">öne çıkan</span>'; }
  else if (!land && dd.clsD === 'D' && dd.clsN === 'D') { cls += ' worst'; flag = '<span class="t-flag warn">rüzgârlı</span>'; }
  if (today) flag = '<span class="t-flag t-now">bugün</span>' + flag;
  const V = (id, html) => on[id] && !(land && ['dalga', 'akinti', 'su', 'pencere'].includes(id)) ? html : '';
  const dir = akDir(dd);
  let h = '<button type="button" class="' + cls + '" data-calday="' + key + '" aria-label="' + esc(akDname(dd.date) + ' ' + DOWL[dd.date.getDay()]) + '">';
  h += '<header><span class="dn">' + dd.date.getDate() + '</span><span class="dm' + (akWk(dd.date) ? ' wk' : '') + '">' + MON3[dd.date.getMonth()] + ' · ' + DOW[dd.date.getDay()] + '</span>' + flag + '</header>';
  h += '<div class="t-wxrow">' + akWxI(akDayWx(dd)) + '<div class="t-temps"><b>' + (dd.tmax == null ? '–' : tempV(dd.tmax) + '°') + '</b><span>' + (dd.tmin == null ? '' : tempV(dd.tmin) + '°') + '</span></div>' + (on.guven ? akConf(dd.conf) : '') + '</div>';
  h += '<ul class="t-kv">' +
    V('ruzgar', '<li><span class="k">' + akI('wind') + 'Rüzgâr</span><b>' + akArr(dir) + '<span class="dl">' + esc(windName(dir)) + '</span> ' + akW(dd.wd, false) + '</b></li>') +
    V('ruzgar', dd.wn != null ? '<li><span class="k">' + akI('moon') + 'Gece</span><b>' + akW(dd.wn, false) + '</b></li>' : '') +
    V('hamle', dd.gD != null || dd.gN != null ? '<li><span class="k">' + akI('gust') + 'Hamle</span><b title="gündüz / gece">' + akW2(dd.gD, dd.gN) + '</b></li>' : '') +
    V('dalga', dd.wave != null ? '<li><span class="k">' + akI('wave') + 'Dalga</span><b>' + f1(dd.wave) + ' m' + (dd.per ? ' <small>' + Math.round(dd.per) + ' sn</small>' : '') + '</b></li>' : '') +
    V('akinti', dd.cur != null ? '<li><span class="k">' + akI('current') + 'Akıntı</span><b>' + f1(dd.cur) + ' kn</b></li>' : '') +
    V('su', dd.sst != null ? '<li><span class="k">' + akI('drop') + 'Su</span><b>' + tempV(dd.sst, true) + '°</b></li>' : '') +
    V('basinc', dd.pmean != null ? '<li><span class="k">' + akI('gauge') + 'Basınç</span><b>' + Math.round(pressNum(dd.pmean)) + ' <small>' + (dd.pdelta > 1 ? '↑ +' : dd.pdelta < -1 ? '↓ −' : '→ ') + (Math.abs(dd.pdelta) > 1 ? f1(Math.abs(dd.pdelta)) : '') + '</small></b></li>' : '') +
    V('yagis', dd.pop != null ? '<li><span class="k">' + akI('rain') + 'Yağış</span><b>%' + Math.round(dd.pop) + (dd.rain >= 0.5 ? ' <small>' + f1(dd.rain) + ' mm</small>' : '') + '</b></li>' : '') + '</ul>';
  if (!land) h += '<div class="t-cls">' + akBadge(dd.clsD, 'sun', 'gündüz ' + (dd.clsD || '')) + akBadge(dd.clsN, 'moon', 'gece ' + (dd.clsN || '')) + '</div>';
  if (w && on.pencere) h += '<div class="t-dwin">' + fishHtml(w.fish) + '<span><b>%' + w.pct + '</b> ' + winTxt(w) + '</span></div>';
  h += '<div class="t-solrow">' + akMoon(dd.sol.illum, akWax(dd), 26) + (land ? '' : akStars(dd.sol.stars)) + '<small>%' + Math.round(dd.sol.illum * 100) + ' · ' + esc(dd.sol.name) + '</small></div>';
  return h + '</button>';
}
// yatay gün kartı (telefonda varsayılan): solda tarih, sağda hava simgesi ve sınıflar, ikonlu değerler, balık penceresi ve ay
const akChip = (ic, html, t) => '<span class="t-c"' + (t ? ' title="' + esc(t) + '"' : '') + '>' + akI(ic) + html + '</span>';
function akDayRow(dd, o){
  const land = o.land, on = o.on, key = dd.key, w = land ? null : windows(dd)[0], today = key === dateKey(new Date());
  let cls = 't-drow' + (dd.idx >= 10 ? ' low' : ''), flag = '';
  if (o.best.includes(key)) { cls += ' best'; flag = '<span class="t-flag">öne çıkan</span>'; }
  else if (!land && dd.clsD === 'D' && dd.clsN === 'D') { cls += ' worst'; flag = '<span class="t-flag warn">rüzgârlı</span>'; }
  if (today) flag = '<span class="t-flag t-now">bugün</span>' + flag;
  const V = (id, html) => on[id] && !(land && ['dalga', 'akinti', 'su', 'pencere'].includes(id)) ? html : '';
  const dir = akDir(dd), wk = akWk(dd.date) ? ' wk' : '';
  let h = '<button type="button" class="' + cls + '" data-calday="' + key + '" aria-label="' + esc(akDname(dd.date) + ' ' + DOWL[dd.date.getDay()]) + '">';
  h += '<div class="t-dd"><b class="dn">' + dd.date.getDate() + '</b><span class="dm' + wk + '">' + MON3[dd.date.getMonth()] + '</span><span class="dw' + wk + '">' + DOW[dd.date.getDay()] + '</span></div><div class="t-dbd">';
  h += '<div class="t-dtop">' + akWxI(akDayWx(dd)) + '<div class="t-temps"><b>' + (dd.tmax == null ? '–' : tempV(dd.tmax) + '°') + '</b><span>' + (dd.tmin == null ? '' : tempV(dd.tmin) + '°') + '</span></div>' +
    (on.guven ? akConf(dd.conf) : '') + flag + (land ? '' : '<span class="t-dcl">' + akBadge(dd.clsD, 'sun', dd.clsD, true) + akBadge(dd.clsN, 'moon', dd.clsN, true) + '</span>') + '</div>';
  h += '<div class="t-chips">' +
    V('ruzgar', akChip('wind', akArr(dir) + akW(dd.wd, false), 'Rüzgâr gündüz' + (dir == null ? '' : ', ' + windName(dir)))) +
    V('ruzgar', dd.wn != null ? akChip('moon', akW(dd.wn, false), 'Rüzgâr gece') : '') +
    V('hamle', dd.gD != null || dd.gN != null ? akChip('gust', akW2(dd.gD, dd.gN), 'Hamle gündüz / gece') : '') +
    V('dalga', dd.wave != null ? akChip('wave', f1(dd.wave) + ' m' + (dd.per ? ' <small>' + Math.round(dd.per) + ' sn</small>' : ''), 'Dalga') : '') +
    V('akinti', dd.cur != null ? akChip('current', f1(dd.cur) + ' kn', 'Akıntı') : '') +
    V('su', dd.sst != null ? akChip('drop', tempV(dd.sst, true) + '°', 'Su sıcaklığı') : '') +
    V('basinc', dd.pmean != null ? akChip('gauge', Math.round(pressNum(dd.pmean)) + ' <small>' + (dd.pdelta > 1 ? '↑' : dd.pdelta < -1 ? '↓' : '→') + '</small>', 'Basınç') : '') +
    V('yagis', dd.pop != null ? akChip('rain', '%' + Math.round(dd.pop) + (dd.rain >= 0.5 ? ' <small>' + f1(dd.rain) + ' mm</small>' : ''), 'Yağış') : '') + '</div>';
  h += '<div class="t-dbot">' + (w && on.pencere ? '<span class="t-dwin">' + fishHtml(w.fish) + '<span><b>%' + w.pct + '</b> ' + winTxt(w) + '</span></span>' : '') +
    '<span class="t-dsol">' + akMoon(dd.sol.illum, akWax(dd), 22) + (land ? '<small>%' + Math.round(dd.sol.illum * 100) + '</small>' : akStars(dd.sol.stars)) + '</span></div>';
  return h + '</div></button>';
}
function akBestDays(ds){ const out = []; akBest(ds).forEach(r => { if (out.length < 3 && !out.includes(r.dd.key) && ['A', 'B'].includes(r.w.cls)) out.push(r.dd.key); }); return out; }
function akSecGunler(ds, land, inner, title){
  const v = calView();
  const seg = '<div class="t-viewseg" role="group" aria-label="Gün kartları"><button type="button" data-atkview="kart" aria-pressed="' + (v === 'kart') + '">' + akI('cards') + 'Dikey</button><button type="button" data-atkview="liste" aria-pressed="' + (v === 'liste') + '">' + akI('rows') + 'Yatay</button></div>';
  return '<section class="t-sec" id="t-gunler">' + akHead('Günlük kartlar', title || ds.length + ' günün tek bakışta özeti',
    title ? 'Her gün noktalar ' + (v === 'kart' ? 'yan yana' : 'alt alta') + '; deniz sınıfı ve balık penceresine göre en iyi nokta yeşil çerçeveli. Bir karta dokun: o nokta seçilir ve o günün saatlik tablosu açılır.' :
    land ? 'Her kart hava simgesini, sıcaklığı, gündüz ve gece rüzgârını, hamleyi, basıncı ve yağışı verir.' : 'Her kart gündüz ve gece rüzgârını, hamleyi, dalgayı, su sıcaklığını ve basıncı verir. Yeşil çerçeveli üç gün, deniz uygunluğu ile balık penceresini birlikte en iyi sunan günlerdir.', seg) +
    '<div id="dayList" class="t-dlist ' + v + '">' + inner + '</div>' +
    '<p class="t-note">Ok rüzgârın gittiği yöne bakar' + (v === 'kart' ? ', ad geldiği yönü verir' : '') + '. Noktalar tahminin güvenini gösterir: ●●●● yüksek, ●○○○ düşük. Telefonda yatay, tablette dikey kartlar açılır; seçimin bu cihazda kalır. Kart satırlarını Daha → Görünüm’den açıp kapatırsın.</p></section>';
}

// ---------------------------------------------------------------- meteogram
function akMeteo(ds, land){
  const n = ds.length, t0 = akDay0(ds[0].date), t1 = akDay0(ds[n - 1].date) + 86400000;
  const hrs = WX.hours.filter(x => x.t >= t0 && x.t < t1);
  const W = 1000, L = 64, R = 34, pw = W - L - R, X = t => L + (t - t0) / (t1 - t0) * pw, o = [];
  const defs = land ? [['wind', 176], ['press', 104], ['temp', 132]] : [['wind', 176], ['wave', 136], ['press', 104], ['temp', 132]];
  const P = {}; let y = 52; defs.forEach(([k, hh]) => { const band = k === 'wave' ? 32 : 0; P[k] = {y, py: y + band, ph: hh - band}; y += hh + 38; });
  const yEnd = y - 38, H = yEnd + 92;
  const r1 = v => v.toFixed(1), rect = (x, yy, w, hh, c) => w > 0 && hh > 0 ? '<rect x="' + r1(x) + '" y="' + r1(yy) + '" width="' + r1(w) + '" height="' + r1(hh) + '" class="' + c + '"/>' : '';
  const hl = (p, v, Y) => '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + r1(Y(v)) + '" y2="' + r1(Y(v)) + '" class="grid"/>';
  const ys = (p, a, b) => v => p.py + p.ph - (v - a) / (b - a) * p.ph;
  const lines = (fy, cls) => { const segs = []; let cur = []; hrs.forEach(x => { const v = fy(x); if (v == null || isNaN(v)) { if (cur.length > 1) segs.push(cur); cur = []; } else cur.push(r1(X(x.t.getTime())) + ',' + r1(v)); }); if (cur.length > 1) segs.push(cur); return segs.map(s => '<polyline points="' + s.join(' ') + '" class="' + cls + '"/>').join(''); };
  const gridV = p => { for (let i = 0; i <= n; i++) { const x = X(i < n ? akDay0(ds[i].date) : t1); o.push('<line x1="' + r1(x) + '" x2="' + r1(x) + '" y1="' + r1(p.py) + '" y2="' + r1(p.py + p.ph) + '" class="grid"/>'); } };
  const mid = d => X(akDay0(d.date) + 12 * 3600000);
  const lowI = ds.findIndex(d => d.conf === 'düşük'), tLow = lowI >= 0 ? akDay0(ds[lowI].date) : null;
  o.push('<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + n + ' günlük meteogram">');
  Object.values(P).forEach(p => {
    ds.forEach(d => { const b = akDay0(d.date); o.push(rect(X(b), p.py, X(d.sol.sunrise.getTime()) - X(b), p.ph, 'nightbg'), rect(X(d.sol.sunset.getTime()), p.py, X(b + 86400000) - X(d.sol.sunset.getTime()), p.ph, 'nightbg')); });
    if (tLow) o.push(rect(X(tLow), p.py, X(t1) - X(tLow), p.ph, 'lowconf'));
  });
  // RÜZGÂR (seçili birim; Bft seçiliyse kn)
  const wu = windU() === 'bft' ? 'kn' : windU(), cf = wu === 'kn' ? KN : wu === 'kmh' ? 3.6 : 1, step = wu === 'kmh' ? 10 : wu === 'ms' ? 2 : 5;
  let p = P.wind; const wmax = Math.max(13.4, ...hrs.map(x => Math.max(x.wind || 0, x.gust || 0)));
  const vmax = Math.min(Math.ceil(28 * cf / step) * step, Math.ceil(wmax * cf / step) * step); let Y = ys(p, 0, vmax);
  [[0, 5.4, 'A'], [5.4, 7.9, 'B'], [7.9, 10.7, 'C'], [10.7, 99, 'D']].forEach(([a, b, c]) => { const ta = a * cf, tb = Math.min(b * cf, vmax); if (ta >= vmax) return; o.push(rect(L, Y(tb), pw, Y(ta) - Y(tb), 'band band-' + c), '<text x="' + (W - R + 16) + '" y="' + r1((Y(tb) + Y(ta)) / 2 + 4) + '" class="cls-l cls-' + c + '" text-anchor="middle">' + c + '</text>'); });
  for (let v = 0; v <= vmax; v += step) o.push(hl(p, v, Y), '<text x="' + (L - 8) + '" y="' + r1(Y(v) + 4) + '" text-anchor="end">' + v + '</text>');
  [5.4, 7.9, 10.7].forEach(v => { if (v * cf < vmax) o.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + r1(Y(v * cf)) + '" y2="' + r1(Y(v * cf)) + '" class="thr"/>'); });
  gridV(p);
  const segs = []; let cur = []; hrs.forEach(x => { if (x.wind == null) { if (cur.length > 1) segs.push(cur); cur = []; } else cur.push(x); }); if (cur.length > 1) segs.push(cur);
  segs.forEach(s => o.push('<path d="M' + r1(X(s[0].t.getTime())) + ',' + r1(Y(0)) + ' L' + s.map(x => r1(X(x.t.getTime())) + ',' + r1(Y(Math.min(vmax, x.wind * cf)))).join(' L') + ' L' + r1(X(s[s.length - 1].t.getTime())) + ',' + r1(Y(0)) + ' Z" class="area-wind"/>'));
  o.push(lines(x => x.gust == null ? null : Y(Math.min(vmax, x.gust * cf)), 'line-gust'), lines(x => x.wind == null ? null : Y(Math.min(vmax, x.wind * cf)), 'line-wind'));
  hrs.forEach(x => { if ([3, 9, 15, 21].includes(x.h) && x.wdir != null) o.push('<path d="M0 -6L4.2 5L0 2.6L-4.2 5Z" transform="translate(' + r1(X(x.t.getTime())) + ' ' + r1(p.py + 11) + ') rotate(' + Math.round((x.wdir + 180) % 360) + ')" class="warr"/>'); });
  // DALGA
  if (!land) {
    p = P.wave; const wvm = Math.max(1.8, Math.ceil(((maxOf(ds, 'wave') || 0) + 0.2) * 2) / 2); Y = ys(p, 0, wvm);
    for (let v = 0; v < wvm + 0.01; v += 0.5) o.push(hl(p, v, Y), '<text x="' + (L - 8) + '" y="' + r1(Y(v) + 4) + '" text-anchor="end">' + f1(v) + '</text>');
    o.push('<line x1="' + L + '" x2="' + (W - R) + '" y1="' + r1(Y(1)) + '" y2="' + r1(Y(1)) + '" class="thr thr-c"/><line x1="' + L + '" x2="' + (W - R) + '" y1="' + r1(Y(1.5)) + '" y2="' + r1(Y(1.5)) + '" class="thr thr-d"/>');
    o.push('<text x="' + (W - R - 4) + '" y="' + r1(Y(1) - 4) + '" class="thr-t thr-c-t" text-anchor="end">1,0 m dikkat</text><text x="' + (W - R - 4) + '" y="' + r1(Y(1.5) - 4) + '" class="thr-t thr-d-t" text-anchor="end">1,5 m uygun değil</text>');
    gridV(p);
    ds.forEach(d => { if (d.wave == null) return; const xc = mid(d), wd = akMeanDir(d.hs, 'waveDir', 'wave');
      o.push(rect(xc - 12, Y(d.wave), 24, Y(0) - Y(d.wave), 'bar-lo'));
      if (wd != null) o.push('<path d="M0 -6L4.2 5L0 2.6L-4.2 5Z" transform="translate(' + r1(xc) + ' ' + r1(p.y + 8) + ') rotate(' + Math.round((wd + 180) % 360) + ')" class="warr wv"/>');
      if (d.per) o.push('<text x="' + r1(xc) + '" y="' + r1(p.y + 27) + '" text-anchor="middle" class="tiny">' + Math.round(d.per) + ' sn</text>'); });
    o.push(lines(x => x.wave == null ? null : Y(Math.min(wvm, x.wave)), 'line-wave'));
  }
  // BASINÇ
  p = P.press; const pr = hrs.map(x => pressNum(x.press)).filter(v => v != null), ps = pressU() === 'mmhg' ? 4 : 5;
  gridV(p);
  if (pr.length) {
    const a = Math.floor(Math.min(...pr) / ps) * ps; let b = Math.ceil(Math.max(...pr) / ps) * ps; if (b - a < 3 * ps) b = a + 3 * ps; Y = ys(p, a, b);
    for (let v = a; v <= b + 0.1; v += ps) o.push(hl(p, v, Y), '<text x="' + (L - 8) + '" y="' + r1(Y(v) + 4) + '" text-anchor="end">' + v + '</text>');
    o.push(lines(x => x.press == null ? null : Y(pressNum(x.press)), 'line-press'));
  } else o.push('<text x="' + (L + pw / 2) + '" y="' + r1(p.py + p.ph / 2 + 4) + '" text-anchor="middle" class="note-t">basınç verisi yok</text>');
  // SICAKLIK (hava ve su)
  p = P.temp; const tv = hrs.map(x => tempNum(x.temp)).concat(land ? [] : hrs.map(x => tempNum(x.sst))).filter(v => v != null);
  gridV(p);
  if (tv.length) {
    const a = Math.floor(Math.min(...tv) / 4) * 4; let b = Math.ceil(Math.max(...tv) / 4) * 4; if (b - a < 8) b = a + 8; Y = ys(p, a, b);
    for (let v = a; v <= b + 0.1; v += 4) o.push(hl(p, v, Y), '<text x="' + (L - 8) + '" y="' + r1(Y(v) + 4) + '" text-anchor="end">' + v + '</text>');
    o.push(lines(x => x.temp == null ? null : Y(tempNum(x.temp)), 'line-temp'));
    if (!land) o.push(lines(x => x.sst == null ? null : Y(tempNum(x.sst)), 'line-sst'));
    const lx = L + 12, ly = p.py + 14;
    o.push('<line x1="' + lx + '" x2="' + (lx + 22) + '" y1="' + (ly - 4) + '" y2="' + (ly - 4) + '" class="line-temp"/><text x="' + (lx + 28) + '" y="' + ly + '" class="leg-t">hava</text>');
    if (!land) o.push('<line x1="' + (lx + 74) + '" x2="' + (lx + 96) + '" y1="' + (ly - 4) + '" y2="' + (ly - 4) + '" class="line-sst"/><text x="' + (lx + 102) + '" y="' + ly + '" class="leg-t">su</text>');
  }
  // şimdi, düşük güven sınırı, başlıklar, gün etiketleri, ay
  const now = Date.now(); if (now > t0 && now < t1) o.push('<line x1="' + r1(X(now)) + '" x2="' + r1(X(now)) + '" y1="22" y2="' + yEnd + '" class="nowl"/><text x="' + r1(X(now) + 4) + '" y="20" class="split-t" style="fill:var(--brand)">şimdi</text>');
  if (tLow) o.push('<line x1="' + r1(X(tLow)) + '" x2="' + r1(X(tLow)) + '" y1="22" y2="' + yEnd + '" class="split"/><text x="' + r1(X(tLow) + 6) + '" y="16" class="split-t">düşük güven ▸ yalnız eğilim</text>');
  const titles = {wind: 'RÜZGÂR · ' + WU_TXT[wu], wave: 'DALGA · m', press: 'BASINÇ · ' + (pressU() === 'mmhg' ? 'mmHg' : 'hPa'), temp: 'SICAKLIK · ' + TU()};
  Object.entries(P).forEach(([k, q]) => o.push('<text transform="translate(14 ' + r1(q.py + q.ph / 2) + ') rotate(-90)" text-anchor="middle" class="ptitle">' + titles[k] + '</text>'));
  ds.forEach(d => { const xc = mid(d), wk = akWk(d.date) ? ' wk' : '', t = d.date.getDate() + ' ' + DOW[d.date.getDay()];
    o.push('<text x="' + r1(xc) + '" y="40" text-anchor="middle" class="dl' + wk + '">' + t + '</text><text x="' + r1(xc) + '" y="' + (yEnd + 22) + '" text-anchor="middle" class="dl' + wk + '">' + t + '</text>');
    o.push(akMoonG(d.sol.illum, akWax(d), xc, yEnd + 44, 8.5), '<text x="' + r1(xc) + '" y="' + (yEnd + 66) + '" text-anchor="middle" class="tiny">%' + Math.round(d.sol.illum * 100) + '</text>'); });
  return o.join('') + '</svg>';
}
function akSecGrafik(ds, land){
  return '<section class="t-sec" id="t-grafik">' + akHead('Meteogram', land ? 'Rüzgâr, basınç ve sıcaklık' : 'Rüzgâr, dalga, basınç ve sıcaklık', 'Saat saat model verisi. Gece saatleri koyu zeminle, düşük güvenli günler açık gölgeyle gösterilir. Grafik yana kaydırılır.') +
    '<div class="t-chart">' + akMeteo(ds, land) + '</div>' +
    '<div class="t-lrow"><span><i class="lg wind"></i>Rüzgâr</span><span><i class="lg gust"></i>Hamle</span>' + (land ? '' : '<span><i class="lg" style="background:var(--sea)"></i>Günün en yüksek dalgası</span>') + '<span><i class="lg night"></i>Gece</span></div>' +
    '<p class="t-note"><b>Nasıl okunur:</b> Rüzgâr panelindeki renkli bantlar ' + (land ? 'rüzgâr sınıflarını' : 'deniz sınıflarını') + ' (A–D) gösterir; oklar rüzgârın gittiği yöne bakar.' + (land ? '' : ' Dalga panelinde sütun günün en yüksek dalgası, ince çizgi saatlik dalga; üstteki ok dalganın gittiği yönü, sayı periyodu verir.') + '</p></section>';
}

// ---------------------------------------------------------------- ayrıntılı tablo
function akSecTablo(ds, land){
  const u = windU(), un = WU_TXT[u === 'bft' ? 'kn' : u];
  let h = '<section class="t-sec" id="t-tablo">' + akHead('Ayrıntılı tablo', land ? 'Hava verileri' : 'Hava ve deniz verileri', 'Aynı veriler sayısal olarak. Tablo yana kaydırılır; tarih sütunu sabit kalır.') +
    '<div class="t-tbl"><table class="t-data"><thead><tr><th rowspan="2">Tarih</th><th rowspan="2">Hava</th><th rowspan="2">Sıcaklık<br>maks / min</th><th colspan="4" class="grp">Rüzgâr · ' + un + '</th>' +
    (land ? '' : '<th colspan="3" class="grp">Dalga</th><th rowspan="2">Akıntı<br>kn</th><th rowspan="2">Su<br>' + TU() + '</th>') + '<th rowspan="2">Basınç<br>gün değişimi</th><th rowspan="2">Yağış</th><th rowspan="2">Güneş</th>' +
    (land ? '' : '<th colspan="2" class="grp">' + (shoreMode() ? 'Kıyı' : 'Tekne') + '</th>') + '</tr><tr><th>Yön</th><th>Gündüz</th><th>Gece</th><th>Hamle</th>' + (land ? '' : '<th>Yükseklik m</th><th>Periyot · boy</th><th>Yön</th>') + (land ? '' : '<th>Gündüz</th><th>Gece</th>') + '</tr></thead><tbody>';
  const wv = ms => ms == null ? '<span class="na">–</span>' : (u === 'bft' ? Math.round(ms * KN) : windNum(ms, u)) + '<small>Bft ' + bft(ms) + ' · ' + Math.round(ms * 3.6) + ' km/sa</small>';
  ds.forEach((d, i) => {
    const dir = akDir(d), wdD = akMeanDir(d.hs, 'waveDir', 'wave'), cdir = akMeanDir(d.hs, 'curDir', 'cur'), est = d.idx >= 10 ? ' class="est"' : '';
    const dl = d.sol.sunset - d.sol.sunrise;
    h += '<tr' + (d.idx === 10 ? ' class="sep"' : '') + '><td><div class="dcell"><b>' + d.date.getDate() + '</b><span class="' + (akWk(d.date) ? 'wk' : '') + '">' + MON3[d.date.getMonth()] + '<br>' + DOW[d.date.getDay()] + '</span></div>' + akConf(d.conf) + '</td>' +
      '<td><div class="wxc">' + akWxI(akDayWx(d)) + '<span>' + AK_WXT[akDayWx(d)] + '</span></div></td><td>' + (d.tmax == null ? '–' : tempV(d.tmax) + '° / ' + tempV(d.tmin) + '°') + '</td>' +
      '<td>' + akArr(dir) + ' ' + esc(dir == null ? '–' : dir8(dir) + ' · ' + windName(dir)) + '</td><td' + est + '>' + wv(d.wd) + '</td><td' + est + '>' + wv(d.wn) + '</td><td' + est + '>' + wv(d.gust) + '</td>' +
      (land ? '' : '<td>' + (d.wave == null ? '<span class="na">–</span>' : f1(d.wave)) + '</td><td>' + (d.per ? Math.round(d.per) + ' sn<small>' + Math.round(1.56 * d.per * d.per) + ' m boy</small>' : '<span class="na">–</span>') + '</td><td>' + (wdD == null ? '–' : akArr(wdD, 't-arr wv') + ' ' + dir8(wdD)) + '</td>' +
        '<td>' + (d.cur == null ? '<span class="na">–</span>' : f1(d.cur) + (cdir != null ? '<small>→ ' + dir8(cdir) + '</small>' : '')) + '</td><td>' + (d.sst == null ? '<span class="na">–</span>' : tempV(d.sst, true)) + '</td>') +
      '<td>' + (d.pmean == null ? '<span class="na">–</span>' : Math.round(pressNum(d.pmean)) + '<small>' + (d.pdelta >= 0 ? '↑ +' : '↓ −') + f1(Math.abs(d.pdelta)) + ' hPa</small>') + '</td>' +
      '<td>' + (d.pop == null && !d.rain ? '<span class="na">–</span>' : (d.pop != null ? '%' + Math.round(d.pop) : '') + (d.rain >= 0.1 ? '<small>' + f1(d.rain) + ' mm</small>' : '')) + '</td>' +
      '<td>' + hm(d.sol.sunrise) + ' – ' + hm(d.sol.sunset) + '<small>gün ' + Math.floor(dl / 3600000) + ' sa ' + Math.round(dl % 3600000 / 60000) + ' dk</small></td>' +
      (land ? '' : '<td>' + akBadge(d.clsD) + '</td><td>' + akBadge(d.clsN) + '</td>') + '</tr>';
  });
  return h + '</tbody></table></div><p class="t-note">Rüzgâr: gündüz 07–18, gece 19–06 saatlerinin en yüksek değeri; hamle günün en yükseği. ' + (land ? '' : 'Dalga boyu derin su ilişkisiyle 1,56 × T² (m). Akıntı ve su sıcaklığı deniz modelinden. ') + 'İtalik değerler düşük güvenli günlerdir.</p></section>';
}

// ---------------------------------------------------------------- solunar
function akSolStrip(ds){
  const W = 1000, L = 112, R = 100, pw = W - L - R, top = 38, pitch = 38, rh = 32, H = top + ds.length * pitch + 6, o = [];
  const X = hh => L + Math.max(0, Math.min(24, hh)) / 24 * pw, r1 = v => v.toFixed(1);
  o.push('<svg class="ch" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Günlük 24 saatlik solunar çizelgesi">');
  for (let hh = 0; hh <= 24; hh += 3) o.push('<text x="' + r1(X(hh)) + '" y="' + (top - 14) + '" text-anchor="middle">' + pad(hh) + '</text>');
  ds.forEach((d, i) => {
    const ry = top + i * pitch, b = akDay0(d.date), hf = t => (t - b) / 3600000, s = d.sol;
    const rc = (a, z, yy, hh, c) => { a = Math.max(0, Math.min(24, a)); z = Math.max(0, Math.min(24, z)); return z - a <= 0 ? '' : '<rect x="' + r1(X(a)) + '" y="' + r1(yy) + '" width="' + r1(X(z) - X(a)) + '" height="' + r1(hh) + '" class="' + c + '"/>'; };
    const sr = hf(s.sunrise), ss = hf(s.sunset);
    o.push(rc(0, 24, ry, rh, 'sl-day'), rc(0, sr, ry, rh, 'sl-night'), rc(ss, 24, ry, rh, 'sl-night'), rc(sr - 0.75, sr + 0.75, ry, rh, 'sl-twi'), rc(ss - 0.75, ss + 0.75, ry, rh, 'sl-twi'));
    for (let hh = 0; hh <= 24; hh += 3) o.push('<line x1="' + r1(X(hh)) + '" x2="' + r1(X(hh)) + '" y1="' + ry + '" y2="' + (ry + rh) + '" class="grid"/>');
    d.hs.forEach(x => { const c = clsOf(x); if (c) o.push(rc(x.h, x.h + 1, ry + rh - 5, 5, 'wc-' + c)); });
    s.allMajor.forEach(p => o.push(rc(hf(p.a), hf(p.b), ry + 3, rh - 11, 'sl-major')));
    s.allMinor.forEach(p => o.push(rc(hf(p.a), hf(p.b), ry + 8, rh - 21, 'sl-minor')));
    o.push('<line x1="' + r1(X(sr)) + '" x2="' + r1(X(sr)) + '" y1="' + ry + '" y2="' + (ry + rh) + '" class="sl-sun"/><line x1="' + r1(X(ss)) + '" x2="' + r1(X(ss)) + '" y1="' + ry + '" y2="' + (ry + rh) + '" class="sl-sun"/>');
    s.allMinor.forEach(p => { const hh = hf(p.c); if (hh < 0 || hh >= 24) return; o.push(p.e === 'rise' ? '<path d="M' + r1(X(hh)) + ' ' + (ry + 1.5) + ' l-3.6 5.4 h7.2z" class="sl-mm"/>' : '<path d="M' + r1(X(hh)) + ' ' + (ry + 8.5) + ' l-3.6 -5.4 h7.2z" class="sl-mm"/>'); });
    windows(d).forEach(w => { const a = Math.max(0, hf(w.a)), z = Math.min(24, hf(w.b)); if (z > a) o.push('<rect x="' + r1(X(a) + 1) + '" y="' + (ry + 1) + '" width="' + r1(X(z) - X(a) - 2) + '" height="' + (rh - 2) + '" rx="3" class="sl-win win-' + (w.cls || 'B') + '"/>'); });
    const m = ry + rh / 2;
    o.push(akMoonG(s.illum, akWax(d), 12, m, 8), '<text x="28" y="' + r1(m + 4) + '" class="dl sl-lab' + (akWk(d.date) ? ' wk' : '') + '">' + d.date.getDate() + ' ' + DOW[d.date.getDay()] + '</text>');
    for (let k = 0; k < 5; k++) o.push('<use href="#ak-star" x="' + r1(W - R + 10 + k * 14.5) + '" y="' + r1(m - 6.5) + '" width="13" height="13" class="sst ' + (k < s.stars ? 'on' : 'off') + '"/>');
  });
  return o.join('') + '</svg>';
}
const akTags = w => w.kinds.map(k => '<span class="t-tag' + (k === 'Şafak' || k === 'Alacakaranlık' ? ' dawn' : '') + '">' + esc(k) + '</span>').join('');
function akSecSolunar(ds){
  const inDay = (d, t) => t >= akDay0(d.date) && t < akDay0(d.date) + 86400000;
  let h = '<section class="t-sec" id="t-solunar">' + akHead('Solunar', 'Ay evresi ve günlük pencereler', 'Major dönem ay tepede ya da en alttayken (±60 dk), minor dönem ay doğarken ya da batarken (±30 dk). Yıldız, günün en yüksek solunar değerinden; renkli çerçeve o günün en iyi pencereleri.') +
    '<div class="t-moons">' + ds.map(d => '<div class="t-mn' + (d.sol.stars === 5 ? ' peak' : '') + '" title="' + esc(akDname(d.date) + ': ' + d.sol.name + ', %' + Math.round(d.sol.illum * 100)) + '">' + akMoon(d.sol.illum, akWax(d), 28) + '<b>' + d.date.getDate() + '</b><small>%' + Math.round(d.sol.illum * 100) + '</small>' + akStars(d.sol.stars) + '</div>').join('') + '</div>' +
    '<div class="t-chart">' + akSolStrip(ds) + '</div>' +
    '<div class="t-lrow"><span><i class="lg major"></i>Major</span><span><i class="lg minor"></i>Minor</span><span><i class="lg twi"></i>Şafak / alacakaranlık (±45 dk)</span><span><i class="lg night"></i>Gece</span><span><i class="lg sun"></i>Güneş doğar / batar</span><span>▲ ▼ Ay doğar / batar</span><span><i class="lg win"></i>Önerilen pencere (deniz sınıfı rengi)</span><span>Alt şerit: saatlik deniz sınıfı</span></div>' +
    '<div class="t-tbl" style="margin-top:16px"><table class="t-data" style="min-width:1080px"><thead><tr><th>Tarih</th><th>Evre</th><th>Yıldız</th><th>Major</th><th>Minor</th><th>Ay doğar / batar</th><th>Pencere 1</th><th>Pencere 2</th></tr></thead><tbody>';
  ds.forEach(d => {
    const s = d.sol, per = a => a.length ? a.map(p => hm(p.a) + '–' + hm(p.b)).join('<br>') : '<span class="na">–</span>';
    const rise = s.allMinor.filter(p => p.e === 'rise' && inDay(d, p.c)).map(p => hm(p.c)), set = s.allMinor.filter(p => p.e === 'set' && inDay(d, p.c)).map(p => hm(p.c));
    const ws = windows(d).map(w => '<b>' + winTxt(w) + '</b><br>' + akTags(w) + akBadge(w.cls, null, null, true) + '<small>' + (w.night ? 'gece' : 'gündüz') + ' · %' + w.pct + ' balık' + (w.x && w.x.wind != null ? ' · rüzgâr ' + akWt(w.x.wind) : '') + '</small>');
    while (ws.length < 2) ws.push('<span class="na">–</span>');
    h += '<tr><td><div class="dcell"><b>' + d.date.getDate() + '</b><span class="' + (akWk(d.date) ? 'wk' : '') + '">' + MON3[d.date.getMonth()] + '<br>' + DOW[d.date.getDay()] + '</span></div></td>' +
      '<td><div class="dcell">' + akMoon(s.illum, akWax(d), 26) + '<span>%' + Math.round(s.illum * 100) + '<br>' + esc(s.name) + '</span></div></td><td>' + akStars(s.stars) + '</td><td>' + per(s.major) + '</td><td>' + per(s.minor) + '</td>' +
      '<td>↑ ' + (rise.join(' · ') || '–') + '<small>↓ ' + (set.join(' · ') || '–') + '</small></td><td>' + ws[0] + '</td><td>' + ws[1] + '</td></tr>';
  });
  return h + '</tbody></table></div><p class="t-note">Ay doğuşu, batışı ve geçişleri bu koordinat için hesaplanır. Pencereler balık değerini (solunar eğrisi ve hava payı) deniz sınıfıyla tartar; aynı hesap Bugün ve Fishing ekranlarında da kullanılır. Bir planlama aracıdır, kesin bir etki iddiası değildir.</p></section>';
}

// ---------------------------------------------------------------- en iyi pencereler (rig önerisiyle)
function akSecPencere(ds){
  const top = akBest(ds).slice(0, 6);
  let h = '<section class="t-sec" id="t-pencere">' + akHead('Planlama', 'En iyi ' + (top.length || '') + ' pencere', 'Balık değeri, deniz sınıfı ve tahminin güvenine göre sıralandı. Rig önerileri o pencerenin koşullarıyla senin sistemindeki hazır riglerden gelir; rige dokun, rig sayfası açılır.') + '<div class="t-wins">';
  top.forEach((r, i) => {
    const {dd, w} = r; let recs = [];
    try { recs = recommend(dd, w.night, null, {w, x: w.x}).filter(o => o.ok).slice(0, 3); } catch (e) { recs = []; }
    h += '<article class="t-win"><div class="rk">' + (i + 1) + '</div><div><h3>' + akDname(dd.date) + ' ' + DOWL[dd.date.getDay()] + ', ' + winTxt(w) + '</h3><p class="when">' + winLabel(w) + ' penceresi · ' + (w.night ? 'gece' : 'gündüz') + '</p>' +
      '<div class="meta">' + akTags(w) + akBadge(w.cls, 'boat', w.cls ? w.cls + ' · ' + CLS_TXT[w.cls] : '') + '</div>' +
      '<div class="meta">' + fishHtml(w.fish) + '<span>Balık <b>%' + w.pct + '</b></span>' + (w.x && w.x.wind != null ? '<span>Rüzgâr <b>' + akWt(w.x.wind) + '</b></span>' : '') + (dd.wave != null ? '<span>Dalga <b>' + f1(dd.wave) + ' m</b></span>' : '') + '<span>Solunar ' + akStars(dd.sol.stars) + '</span><span>Güven ' + akConf(dd.conf) + '</span></div>' +
      (recs.length ? '<div class="t-rigs"><span class="lbl">Rig</span>' + recs.map(o => '<button type="button" class="' + (w.night ? 'n' : 'g') + '" data-rigopen="' + esc(o.rg.id) + '" title="' + esc(o.rg.name || '') + '">' + esc(o.rg.code || '') + (o.rg.name ? ' <small>' + esc(o.rg.name) + '</small>' : '') + '</button>').join('') + '</div>'
        : '<p class="t-note">Bu pencere için hazır rig yok; Rigler sekmesinden sistemini kur ya da eksikleri tamamla.</p>') + '</div></article>';
  });
  return h + '</div>' + (top.length ? '' : '<div class="t-empty">Pencere hesaplanamadı.</div>') + '</section>';
}

// ---------------------------------------------------------------- yöntem
function akSecYontem(land){
  const row = (a, b) => '<tr><td><b>' + esc(a) + '</b></td><td>' + esc(b) + '</td></tr>';
  let h = '<section class="t-sec" id="t-yontem">' + akHead('Yöntem', 'Veriler nereden geliyor, neler hesaplandı?', 'Hangi değerin model çıktısı, hangisinin hesap olduğu ayrı yazıldı.') +
    '<div class="t-warn">' + akI('warn') + '<p><b>Resmî deniz tahmini değildir.</b> Çıkıştan önce MGM ve Kıyı Emniyeti denizcilik uyarılarını, o günkü güncel rüzgâr ve dalga tahminini kontrol et. Sınıflar bir güvenlik garantisi değil, planlama kılavuzudur.</p></div>' +
    '<div class="t-method" style="margin-top:16px"><div class="t-panel"><h3>Hangi değer nereden?</h3><table class="t-kvt"><thead><tr><th>Değer</th><th>Kaynak ve yöntem</th></tr></thead><tbody>' +
    row('Rüzgâr', 'Karma: ICON-EU 7 km, bittiği yerde ECMWF IFS, sonra Open-Meteo en iyi eşleşme. Model seçimi Bugün → Saatlik tablodan değişir.') +
    row('Hamle', 'Karma: GFS; yoksa en iyi eşleşme.') +
    row('Hava, basınç, bulut, yağış', 'Aynı modellerden saatlik; yağış olasılığı Open-Meteo en iyi eşleşme.') +
    (land ? '' : row('Dalga', 'MFWAM (Météo-France) dalga modeli; yoksa en iyi deniz modeli. Yükseklik, yön ve periyot.') + row('Akıntı ve su sıcaklığı', 'Open-Meteo deniz modeli (en iyi eşleşme). Nokta karadaysa en yakın deniz noktası.')) +
    row('Güneş, ay, solunar', 'Bu koordinat için astronomik hesap (SunCalc): gün doğumu ve batımı, ay doğuşu, batışı, tepe ve alt geçişi.') +
    '</tbody></table></div><div class="t-panel"><h3>' + (land ? 'Rüzgâr sınıfları' : 'Deniz sınıfları') + '</h3><table class="t-kvt"><thead><tr><th>Sınıf</th><th>Rüzgâr (en çok)</th><th>Anlamı</th></tr></thead><tbody>' +
    [['A', '≤ 10,5 kn · ≤ 5,4 m/s · Bft ≤ 3'], ['B', '≤ 15,4 kn · ≤ 7,9 m/s · Bft 4'], ['C', '≤ 20,8 kn · ≤ 10,7 m/s · Bft 5'], ['D', '> 20,8 kn · Bft ≥ 6']].map(([c, t]) => '<tr><td>' + akBadge(c) + '</td><td class="mono">' + t + '</td><td>' + CLS_TXT[c] + '</td></tr>').join('') +
    '</tbody></table>' + (land ? '' : '<p class="t-note">Dalga 1,0 m ve üstündeyse sınıf bir kademe düşer, 1,5 m ve üstünde D olur. Kıyı modunda rüzgârın kıyıya göre yönü (vuran, esen, yandan) de hesaba girer.</p>') +
    '<h3 style="margin-top:16px">Güven</h3><table class="t-kvt"><tbody><tr><td>' + akConf('yüksek') + '</td><td><b>1–3. gün</b> · yüksek</td></tr><tr><td>' + akConf('iyi') + '</td><td><b>4–7. gün</b> · iyi</td></tr><tr><td>' + akConf('orta') + '</td><td><b>8–10. gün</b> · orta</td></tr><tr><td>' + akConf('düşük') + '</td><td><b>11. gün ve sonrası</b> · düşük, yalnız eğilim</td></tr></tbody></table>' +
    (land ? '' : '<h3 style="margin-top:16px">Balık değeri ve pencere</h3><p class="t-note" style="margin-top:0">10 dakikalık solunar eğrisi: taban %24; major (±60 dk) 0,6, minor (±30 dk) 0,36, şafak ve alacakaranlık 0,4 ağırlık; ay evresi ×0,9–1,1; saatlik değer basınç eğilimi ve akıntıyla düzeltilir. 5 balık, her balık %20. Pencere = balık × deniz payı (A 1 · B 0,92 · C 0,7 · D 0,25); sıralamada güven de çarpılır (yüksek 1 … düşük 0,75).</p>') +
    '</div></div><div class="t-panel" style="margin-top:16px"><h3>Kaynaklar</h3><ul class="t-src">' +
    [['Open-Meteo hava tahmini (ICON-EU, ECMWF, GFS)', 'https://open-meteo.com/en/docs'], ['Open-Meteo deniz tahmini (dalga, akıntı, su sıcaklığı)', 'https://open-meteo.com/en/docs/marine-weather-api'], ['SunCalc (güneş ve ay hesabı)', 'https://github.com/mourner/suncalc'], ['MGM denizcilik tahmini ve uyarıları', 'https://www.mgm.gov.tr/denizcilik/']]
      .map(([t, u]) => '<li><a href="' + u + '" target="_blank" rel="noopener noreferrer">' + esc(t) + '</a></li>').join('') + '</ul></div></section>';
  return h;
}

// ---------------------------------------------------------------- karşılaştırma (en çok 3 nokta)
function akCmpCard(L, d, best, land){
  const cls = 't-day' + (best ? ' best' : '') + (d.idx >= 10 ? ' low' : '');
  return '<button type="button" class="' + cls + '" data-calpick="' + esc(L.id) + '|' + d.key + '"><div class="nm"><span>' + esc(locLabel(L)) + '</span>' + (best ? '<em class="t-flag">en iyi</em>' : '') + '</div>' +
    '<div class="t-wxrow">' + akWxI(d.wx || 'unknown') + '<div class="t-temps"><b>' + (d.tmax == null ? '–' : tempV(d.tmax) + '°') + '</b><span>' + (d.tmin == null ? '' : tempV(d.tmin) + '°') + '</span></div></div>' +
    '<ul class="t-kv"><li><span class="k">' + akI('wind') + 'Rüzgâr</span><b>' + akArr(d.dir) + ' ' + akW(d.wd, false) + '</b></li>' + (d.wn != null ? '<li><span class="k">' + akI('moon') + 'Gece</span><b>' + akW(d.wn, false) + '</b></li>' : '') +
    (d.gD != null || d.gN != null ? '<li><span class="k">' + akI('gust') + 'Hamle</span><b title="gündüz / gece">' + akW2(d.gD, d.gN) + '</b></li>' : '') +
    (land ? (d.pop != null ? '<li><span class="k">' + akI('rain') + 'Yağış</span><b>%' + Math.round(d.pop) + '</b></li>' : '') : (d.wave != null ? '<li><span class="k">' + akI('wave') + 'Dalga</span><b>' + f1(d.wave) + ' m</b></li>' : '') + (d.sst != null ? '<li><span class="k">' + akI('drop') + 'Su</span><b>' + tempV(d.sst, true) + '°</b></li>' : '')) + '</ul>' +
    (land ? '<div class="t-note" style="margin:0">Kara · yalnız hava</div>' : '<div class="t-cls">' + akBadge(d.clsD, 'sun', 'gündüz ' + (d.clsD || '')) + akBadge(d.clsN, 'moon', 'gece ' + (d.clsN || '')) + '</div>' +
      (d.win ? '<div class="t-dwin">' + fishHtml(d.win.fish) + '<span><b>%' + d.win.pct + '</b> ' + hm(d.win.a) + '–' + hm(d.win.b) + '</span></div>' : '')) + '</button>';
}
function akCmpRow(L, d, best, land){
  const cls = 't-drow cmp' + (best ? ' best' : '') + (d.idx >= 10 ? ' low' : '');
  return '<button type="button" class="' + cls + '" data-calpick="' + esc(L.id) + '|' + d.key + '"><div class="t-dbd"><div class="t-dtop">' + akWxI(d.wx || 'unknown') +
    '<span class="t-dnm">' + akI(land ? 'pin' : 'anchor') + esc(locLabel(L)) + '</span>' + (best ? '<em class="t-flag">en iyi</em>' : '') +
    '<div class="t-temps"><b>' + (d.tmax == null ? '–' : tempV(d.tmax) + '°') + '</b><span>' + (d.tmin == null ? '' : tempV(d.tmin) + '°') + '</span></div>' +
    (land ? '' : '<span class="t-dcl">' + akBadge(d.clsD, 'sun', d.clsD, true) + akBadge(d.clsN, 'moon', d.clsN, true) + '</span>') + '</div>' +
    '<div class="t-chips">' + akChip('wind', akArr(d.dir) + akW(d.wd, false), 'Rüzgâr gündüz') + (d.wn != null ? akChip('moon', akW(d.wn, false), 'Rüzgâr gece') : '') + (d.gD != null || d.gN != null ? akChip('gust', akW2(d.gD, d.gN), 'Hamle gündüz / gece') : '') +
    (land ? (d.pop != null ? akChip('rain', '%' + Math.round(d.pop), 'Yağış') : '') : (d.wave != null ? akChip('wave', f1(d.wave) + ' m', 'Dalga') : '') + (d.sst != null ? akChip('drop', tempV(d.sst, true) + '°', 'Su sıcaklığı') : '')) + '</div>' +
    (!land && d.win ? '<div class="t-dbot"><span class="t-dwin">' + fishHtml(d.win.fish) + '<span><b>%' + d.win.pct + '</b> ' + hm(d.win.a) + '–' + hm(d.win.b) + '</span></span></div>' : '') + '</div></button>';
}
function akCompare(ids){
  const Ls = ids.map(id => S.locations[id]);
  const sums = Ls.map(L => { const sm = locSummary(L); if (!sm && L.id !== S.active && !wxFresh(MWX[L.id], L) && !MWX_LOAD[L.id] && Date.now() - (MWX_FAIL[L.id] || 0) > 5 * 60000)
    loadWxFor(L).then(() => { if (!MWX[L.id]) MWX_FAIL[L.id] = Date.now(); renderCalendar(); }); return sm; });
  const allLand = Ls.every(L => locKind(L) === 'kara');
  const keys = []; sums.forEach(sm => (sm || []).forEach(d => { if (!keys.includes(d.key)) keys.push(d.key); })); keys.sort();
  const k16 = keys.slice(0, 16), ds = k16.map(k => { for (const sm of sums) { const d = (sm || []).find(x => x.key === k); if (d) return d; } return null; });
  let body = '';
  if (!k16.length) body = '<div class="t-empty">Noktaların verisi yükleniyor…</div>';
  else {
    const rows = []; Ls.forEach((L, i) => { const sm = sums[i] || []; rows.push({group: locLabel(L)});
      if (locKind(L) === 'kara') rows.push({lab: 'rüzgâr', cells: k16.map(k => { const d = sm.find(x => x.key === k); return d && d.wd != null ? {c: seaClass(d.wd), v: bft(d.wd), t: 'gündüz ' + bft(d.wd) + ' Bft'} : null; })});
      else ['clsD', 'clsN'].forEach(f => rows.push({lab: f === 'clsD' ? 'gündüz' : 'gece', cells: k16.map(k => { const d = sm.find(x => x.key === k); return d && d[f] ? {c: d[f], v: d[f], t: locLabel(L) + ' ' + akDname(d.date) + ': ' + CLS_TXT[d[f]]} : null; })})); });
    const v = calView();
    body = '<section class="t-sec" id="t-ozet">' + akHead('Özet', 'Noktalar yan yana', 'Her nokta için gündüz ve gece sınıfı. Bir noktanın bütün sayfası için üstteki sekmesine dokun.') + '<div class="t-panel">' + akStrip(ds, rows) +
      '<div class="t-legend">' + 'ABCD'.split('').map(c => '<span><i class="t-sw ' + c + '"></i>' + c + ' ' + CLS_TXT[c] + '</span>').join('') + '</div></div></section>';
    const inner = k16.map(k => {
      const cards = Ls.map((L, i) => ({L, d: (sums[i] || []).find(x => x.key === k) || null}));
      const best = cards.filter(r => r.d && r.d.score > 0).sort((p, q) => q.d.score - p.d.score)[0];
      const d0 = cards.find(r => r.d).d;
      return '<div class="t-cday"><div class="t-cdh"><b>' + d0.date.getDate() + '</b><span class="' + (akWk(d0.date) ? 'wk' : '') + '">' + MONTHS[d0.date.getMonth()] + ' · ' + DOWL[d0.date.getDay()] + '</span></div><div class="' + (v === 'kart' ? 't-cgrid' : 't-crows') + '">' +
        cards.map(({L, d}) => d ? (v === 'kart' ? akCmpCard : akCmpRow)(L, d, best && best.L === L, d.land) : '<div class="t-empty">' + esc(locLabel(L)) + ' yükleniyor…</div>').join('') + '</div></div>';
    }).join('');
    body += akSecGunler(ds, allLand, inner + calLegend(), 'Noktalar gün gün');
  }
  return {body, allLand};
}

// ---------------------------------------------------------------- sayfa
const AK_SECS = [['ozet', 'Özet', 'info'], ['gunler', 'Günler', 'cal'], ['grafik', 'Grafik', 'chart'], ['tablo', 'Tablo', 'table'], ['solunar', 'Solunar', 'moon'], ['pencere', 'Pencereler', 'clock'], ['balik', 'Balıklar', 'fish'], ['yontem', 'Yöntem', 'compass']];
const akNav = ids => '<nav class="t-nav" aria-label="Takvim bölümleri">' + AK_SECS.filter(s => ids.includes(s[0])).map(s => '<button type="button" data-atkgo="' + s[0] + '">' + akI(s[2]) + s[1] + '</button>').join('') + '</nav>';
function akTabs(sel){
  if (sel.length < 2) return '';
  const t = ui.calTab;
  return '<div class="t-tabs" role="tablist" aria-label="Takvim noktası">' + sel.map(id => '<button class="btn small" type="button" data-atktab="' + esc(id) + '" aria-pressed="' + (t === id) + '">' + akI(locKind(S.locations[id]) === 'kara' ? 'pin' : 'anchor') + esc(locLabel(S.locations[id])) + '</button>').join('') +
    '<button class="btn small" type="button" data-atktab="cmp" aria-pressed="' + (t === 'cmp') + '">' + akI('cards') + 'Karşılaştır</button></div>';
}
function akLocPage(L){
  const ds = days().slice(0, 16), land = locKind(L) === 'kara';
  if (!ds.length) return {hero: '', body: '<div class="t-empty">' + (loc() ? 'Veri yok. İnternete bağlanınca takvim dolar.' : 'Önce bir konum ekle.') + '</div>', secs: [], land};
  const v = calView();
  const on = {}; orderedRows(CROWS, S.settings.calrows).forEach(r => { on[r.id] = r.on; });
  const o = {land, on, best: land ? [] : akBestDays(ds)};
  const inner = (v === 'kart' ? '<div class="t-days">' + ds.map(dd => akDayCard(dd, o)).join('') : '<div class="t-rows">' + ds.map(dd => akDayRow(dd, o)).join('')) + '</div>' + calLegend();
  const secs = land ? ['ozet', 'gunler', 'grafik', 'tablo', 'yontem'] : ['ozet', 'gunler', 'grafik', 'tablo', 'solunar', 'pencere', 'balik', 'yontem'];
  const body = akSecOzet(ds, land) + akSecGunler(ds, land, inner) + akSecGrafik(ds, land) + akSecTablo(ds, land) + (land ? '' : akSecSolunar(ds) + akSecPencere(ds) + akSecBalik(L)) + akSecYontem(land) +
    '<footer class="t-foot"><span>' + esc(locLabel(L)) + (S.settings.hideCoords ? '' : ' · ' + esc(fmtCoord(L.lat, L.lon, true))) + '</span><span>Veriler tahmindir; resmî deniz tahmini yerine geçmez.</span></footer>';
  return {hero: akHero(L, ds, land, null), body, secs, land, v, ds};
}
// görünüm seçilmemişse tablet döndürülünce (700 px sınırı) kartlar yeniden çizilir
let AK_VIEW_R = null, AK_RZ = null;
window.addEventListener('resize', () => { clearTimeout(AK_RZ); AK_RZ = setTimeout(() => { const v = $('v-takvim'); if (v && !v.hidden && AK_VIEW_R && calView() !== AK_VIEW_R) renderCalendar(); }, 250); });
function renderCalendar(){
  const view = $('v-takvim'); if (!view) return;
  if (view.hidden) { CAL_DIRTY = true; return; }
  CAL_DIRTY = false; AK_VIEW_R = calView();
  const box = $('atk'); if (!box) return;
  const sel = calLocs();
  if (!sel.length) { box.innerHTML = '<div class="t-empty">Önce bir konum ekle. Takvim seçtiğin noktaya göre hesaplanır.<div class="row" style="justify-content:center;margin-top:10px"><button class="btn primary" type="button" data-open="konumlar">Konum ekle</button></div></div>'; return; }
  if (ui.calTab !== 'cmp' && !sel.includes(ui.calTab)) ui.calTab = null;
  if (!ui.calTab || (ui.calTab === 'cmp' && sel.length < 2)) ui.calTab = sel.length >= 2 ? 'cmp' : sel[0];
  const top = '<div class="calpick" id="calPick"></div>' + akTabs(sel);
  if (ui.calTab === 'cmp') {
    const r = akCompare(sel);
    box.innerHTML = akHeroCmp(sel, r.allLand) + top + akNav(['ozet', 'gunler']) + r.body;
    renderCalPick(); return;
  }
  const L = S.locations[ui.calTab];
  let pg;
  if (L.id === S.active) pg = akLocPage(L);
  else {
    const w = MWX[L.id];
    if (!w || !w.raw) {
      if (!MWX_LOAD[L.id] && Date.now() - (MWX_FAIL[L.id] || 0) > 5 * 60000) loadWxFor(L).then(() => { if (!MWX[L.id]) MWX_FAIL[L.id] = Date.now(); renderCalendar(); });
      box.innerHTML = top + '<div class="t-empty">' + esc(locLabel(L)) + ' için veri yükleniyor…</div>'; renderCalPick(); return;
    }
    pg = withLoc(L, w, () => akLocPage(L));
  }
  box.innerHTML = pg.hero + top + (pg.secs.length ? akNav(pg.secs) : '') + pg.body;
  renderCalPick();
}
function akHeroCmp(sel, allLand){
  const L = S.locations[sel[0]];
  const ds = (locSummary(L) || []).slice(0, 16);
  const fake = ds.length ? ds : [];
  return akHero(L, fake.map(d => ({date: d.date, models: []})), !!allLand, sel);
}
// bölüm çubuğu: dokununca o bölüme kayar
function akGo(id){ const el = $('t-' + id); if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'}); }
