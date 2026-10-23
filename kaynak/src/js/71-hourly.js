// ---------------------------------------------------------------- 71 · saatlik tablo (Windy düzeni; satırlar, birimler ve model seçilebilir)
// Rüzgâr adları: geldiği yöne göre (Kıble = güneyden). Ok rüzgârın, dalganın ve teknenin gittiği yönü gösterir.
const WIND_NAMES = ['Yıldız', 'Poyraz', 'Gündoğusu', 'Keşişleme', 'Kıble', 'Lodos', 'Batı', 'Karayel'];
const windName = deg => deg == null ? '' : (S.settings.windNames === 'harf' ? dir8(deg) : WIND_NAMES[Math.round((((deg % 360) + 360) % 360) / 45) % 8]);
const WU_TXT = {bft: 'Bft', kn: 'kn', ms: 'm/s', kmh: 'km/sa'};
const WU_UP = {bft: 'BFT', kn: 'KN', ms: 'M/S', kmh: 'KM/SA'};
const windU = () => WU_TXT[S.settings.windUnit] ? S.settings.windUnit : 'bft';
// ikinci satır birimi (hücrenin altı): seçilmemişse Bft ↔ kn
const windU2 = () => { const a = windU(), b = S.settings.windUnit2; return WU_TXT[b] && b !== a ? b : (a === 'bft' ? 'kn' : 'bft'); };
// sıcaklık birimi: °C / °F (Görünüm → Birimler)
const tempU = () => S.settings.tempUnit === 'f' ? 'f' : 'c';
const TU = () => tempU() === 'f' ? '°F' : '°C';
const tempNum = c => c == null ? null : tempU() === 'f' ? c * 9 / 5 + 32 : c;
const tempV = (c, d) => d && tempU() === 'c' ? f1(c) : f0(tempNum(c));
const tempTxt = (c, d) => c == null ? '–' : tempV(c, d) + ' ' + TU();
const degHtml = (c, d) => c == null ? '–' : tempV(c, d) + '<sup class="dg">°</sup>';
function windNum(ms, u){ if (ms == null) return null; u = u || windU(); return u === 'kn' ? Math.round(ms * KN) : u === 'ms' ? Math.round(ms) : u === 'kmh' ? Math.round(ms * 3.6) : bft(ms); }
const pressU = () => S.settings.pressUnit === 'mmhg' ? 'mmhg' : 'hpa';
const pressNum = hpa => hpa == null ? null : pressU() === 'mmhg' ? hpa * 0.750062 : hpa;
const pressTxt = hpa => hpa == null ? '–' : Math.round(pressNum(hpa)) + (pressU() === 'mmhg' ? ' mmHg' : ' hPa');
const MODEL_OPTS = [['karma', 'Karma'], ['icon', 'ICON-EU'], ['ecmwf', 'ECMWF'], ['gfs', 'GFS']];
// renk ölçekleri (hücre zemini yarı saydam boyanır)
const TEMP_STOPS = [[0, '#5B7BD5'], [8, '#5FB4D9'], [14, '#6CC79A'], [20, '#E2D35A'], [26, '#F2A33A'], [32, '#E0533A']];
const SST_STOPS = [[12, '#5B7BD5'], [16, '#5FB4D9'], [19, '#6CC79A'], [23, '#E2D35A'], [27, '#F2A33A']];
const PRESS_STOPS = [[995, '#8A6BD1'], [1005, '#5FA3D9'], [1013, '#7CC79A'], [1020, '#E6CF5A'], [1030, '#F0A040']];
function scaleColor(stops, v){
  if (v == null) return null;
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return stops[stops.length - 1][1];
}
const tint = (c, a) => c ? 'background:color-mix(in srgb,' + c + ' ' + (a || 42) + '%,transparent)' : '';
// ay evresi simgesi (p: 0 yeniay, 0,5 dolunay)
function moonSvg(p, size){
  const r = 6, k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r, wax = p < 0.5;
  const so = wax ? 1 : 0, si = (k > 0) === wax ? 0 : 1;
  return '<svg class="moon" viewBox="0 0 14 14" width="' + (size || 14) + '" height="' + (size || 14) + '" aria-hidden="true"><circle cx="7" cy="7" r="6"/><path d="M7 1A6 6 0 0 ' + so + ' 7 13A' + rx.toFixed(2) + ' 6 0 0 ' + si + ' 7 1Z"/></svg>';
}
// ---- satırlar
// varsayılan sıra ve açık/kapalı satırlar Kenny'nin düzeni (v0.16); Bulut ve Solunar satırı yok: bulut % Hava hücresinde, solunar Balık hücresinde
const HROWS = [
  {id: 'saat', t: 'Saat', fixed: true},
  {id: 'gunes', t: 'Güneş ve ay'},
  {id: 'sicaklik', t: 'Hava sıcaklığı'},
  {id: 'su', t: 'Su sıcaklığı'},
  {id: 'hava', t: 'Hava (bulut %, yağış simgesi)'},
  {id: 'yagis', t: 'Yağış olasılığı'},
  {id: 'yagismm', t: 'Yağış miktarı'},
  {id: 'balik', t: 'Balık (5 balık, % ve solunar)'},
  {id: 'balikgrafik', t: 'Balık çubukları ve günün eğrisi'},
  {id: 'ruzgar', t: 'Rüzgâr · Karma (üstte seçili model)'},
  {id: 'r_icon', t: 'Rüzgâr · ICON-EU', on: false},
  {id: 'r_ecmwf', t: 'Rüzgâr · ECMWF', on: false},
  {id: 'r_gfs', t: 'Rüzgâr · GFS', on: false},
  {id: 'hamle', t: 'Hamle · Bugün ekranındaki (Karma: GFS)'},
  {id: 'h_icon', t: 'Hamle · ICON-EU', on: false},
  {id: 'h_ecmwf', t: 'Hamle · ECMWF', on: false},
  {id: 'h_gfs', t: 'Hamle · GFS', on: false},
  {id: 'yon', t: 'Rüzgâr yönü'},
  {id: 'uyum', t: 'Model uyumu', on: false},
  {id: 'dalga', t: 'Dalga'},
  {id: 'periyot', t: 'Dalga periyodu ve yönü'},
  {id: 'akinti', t: 'Akıntı'},
  {id: 'suruklenme', t: 'Sürüklenme (tekne)', mode: 'tekne'},
  {id: 'kiyiya', t: 'Rüzgâr kıyıya göre (kıyı)', mode: 'kiyi'},
  {id: 'basinc', t: 'Basınç'},
  {id: 'basincgrafik', t: 'Basınç grafiği'},
];
// kayıtlı sıra + yeni eklenen satırlar varsayılan yerlerine
function orderedRows(reg, saved){
  const byId = {}; reg.forEach(r => { byId[r.id] = r; });
  const out = [], seen = new Set();
  (Array.isArray(saved) ? saved : []).forEach(e => { const id = e && e[0]; if (byId[id] && !seen.has(id)) { out.push(Object.assign({}, byId[id], {on: byId[id].fixed ? true : !!e[1]})); seen.add(id); } });
  reg.forEach((r, i) => {
    if (seen.has(r.id)) return;
    const prev = reg.slice(0, i).reverse().find(p => seen.has(p.id));
    const at = prev ? out.findIndex(o => o.id === prev.id) + 1 : 0;
    out.splice(at, 0, Object.assign({}, r, {on: r.on !== false})); seen.add(r.id);
  });
  return out;
}
const COL_W = 46;
function dayStrip(dd){
  const seg = []; for (let h = 0; h < 24; h += 3) { const xs = dd.hs.filter(x => x.h >= h && x.h < h + 3 && x.wind != null); const w = xs.length ? Math.max(...xs.map(x => x.wind)) : null; seg.push(w == null ? '<i></i>' : '<i style="background:' + bftColor(bft(w)) + '"></i>'); }
  return '<span class="dstrip" aria-hidden="true">' + seg.join('') + '</span>';
}
function bftLegend(){
  const p = bftPal();
  return '<div class="bftscale" role="img" aria-label="Rüzgâr renkleri, 0 ile 12 Bft arası">' + p.map((c, i) => '<span style="background:' + c + ';color:' + textOn(c) + '">' + i + '</span>').join('') + '</div>' +
    '<div class="legend"><span><i style="background:var(--A-bg);border:1px solid var(--A)"></i>dalga &lt;0,5 m</span><span><i style="background:var(--B-bg);border:1px solid var(--B)"></i>0,5–1 m</span>' +
    '<span><i style="background:var(--C-bg);border:1px solid var(--C)"></i>1–1,5 m</span><span><i style="background:var(--D-bg);border:1px solid var(--D)"></i>1,5 m+</span></div>';
}
const mBadge = t => t ? '<span class="mb">' + esc(t) + '</span>' : '';
function spreadKn(x){ const v = ['icon', 'ecmwf', 'gfs'].map(k => x.m && x.m[k] ? x.m[k].w : null).filter(v => v != null); return v.length >= 2 ? (Math.max(...v) - Math.min(...v)) * KN : null; }
// bilgi alanı kapalıyken (dar sütun) gösterilen kısa adlar
const H_SHORT = {'Saat': 'Saat', 'Güneş · Ay': '☀ ☾', 'Hava': 'Hava', 'Balık': 'Balık', 'Balık eğrisi': 'Eğri', 'Model uyumu': 'Uyum', 'Yön': 'Yön',
  'Dalga': 'Dlg.', 'Periyot': 'Per.', 'Akıntı': 'Akın.', 'Sürüklenme': 'Sürk.', 'İpe akış': 'İpe', 'Kıyıya göre': 'Kıyı'};
function renderHourly(){
  const ds = days(); const tbl = $('hTable');
  $('hLegend').innerHTML = bftLegend();
  $('hourly').hidden = !loc();
  $('hBar').innerHTML = '<div class="seg msel" role="group" aria-label="Hava modeli">' + MODEL_OPTS.map(([v, t]) => '<button class="btn small" type="button" data-set="model" data-val="' + v + '" aria-pressed="' + ((S.settings.model || 'karma') === v) + '">' + t + '</button>').join('') + '</div>';
  if (!ds.length) { $('dayChips').innerHTML = ''; tbl.innerHTML = ''; $('hEmpty').hidden = false; $('hourlyNote').textContent = ''; $('seaNote').hidden = true; return; }
  $('hEmpty').hidden = true;
  const now = new Date(), todayKey = dateKey(now);
  if (!ui.hday || !ds.find(d => d.key === ui.hday)) ui.hday = ds.find(d => d.key === todayKey) ? todayKey : ds[0].key;
  $('dayChips').innerHTML = ds.slice(0, 16).map((d, i) => '<button class="btn small dchip" data-hday="' + d.key + '" aria-pressed="' + (d.key === ui.hday) + '"><span>' + dayLabel(d.date, i, todayKey) + '</span>' + dayStrip(d) + '</button>').join('');
  const dd = ds.find(d => d.key === ui.hday); const hs = dd.hs;
  const isToday = dd.key === todayKey, nowH = now.getHours();
  const sol = dd.sol, sr = sol.sunrise.getTime(), ss = sol.sunset.getTime();
  const nightH = x => x.t.getTime() < sr - 20 * 60000 || x.t.getTime() > ss + 20 * 60000;
  const cls = (x, extra) => 'c' + (nightH(x) ? ' night' : '') + (isToday && x.h === nowH ? ' curh' : '') + (extra ? ' ' + extra : '');
  // bilgi alanı: açıkken tam ad + alt satır, kapalıyken kısa ad (sh = [üst, alt]); yalnız dokununca açılır/kapanır
  const short = (label, sh) => sh ? esc(sh[0]) + (sh[1] ? '<em>' + esc(sh[1]) + '</em>' : '') : esc(H_SHORT[label] || label.slice(0, 4));
  const row = (label, sub, cells, trc, sh) => '<tr' + (trc ? ' class="' + trc + '"' : '') + '><th class="lbl" scope="row"><b>' + label + '</b>' + (Array.isArray(sub) ? sub : [sub]).filter(Boolean).map(t => '<small>' + t + '</small>').join('') + '<i class="sh" aria-hidden="true">' + short(label, sh) + '</i></th>' + cells + '</tr>';
  const acts = hs.map(activity);
  const u = windU(), u2 = windU2(), UT = WU_TXT[u];
  // rüzgâr hücresi: ana değer + yanında küçük birim, altında ikinci birim (renk her zaman Bft ölçeği)
  const wcell = (x, v) => { const b = bft(v); if (b == null) return '<td class="' + cls(x, 'nd') + '">–</td>';
    return '<td class="' + cls(x, 'bf') + '" style="' + bftStyle(b) + '">' + windNum(v, u) + '<u class="wu">' + UT + '</u><small>' + windNum(v, u2) + ' ' + WU_TXT[u2] + '</small></td>'; };
  const mVal = (x, id, k) => x.m && x.m[id] ? x.m[id][k] : null;
  const mSel = S.settings.model || 'karma', kId = mSel === 'karma' ? 'icon' : mSel;
  const wRow = (lbl, id, k, trc) => row(lbl, UT + ' ' + mBadge(SRC[id].short), hs.map(x => wcell(x, mVal(x, id, k))).join(''), trc, [lbl === 'Rüzgâr' ? 'Rüz.' : 'Hml.', WU_UP[u] + ' ' + SRC[id].ab]);
  const span = (inner, trc) => '<td class="graph" colspan="' + hs.length + '">' + inner + '</td>';
  const W = hs.length * COL_W, t0 = hs[0].t.getTime();
  const xOf = t => COL_W / 2 + (t - t0) / 3600000 * COL_W;
  const R = {
    saat: () => row('Saat', '', hs.map(x => '<td class="' + cls(x, nightH(x) ? 'nt' : '') + '">' + pad(x.h) + '</td>').join(''), 'hours'),
    gunes: () => {
      const evs = [{t: sol.sunrise, h: '<span class="sunev">☀↑</span>'}, {t: sol.sunset, h: '<span class="sunev">☀↓</span>'}]
        .concat(sol.allMinor.map(p => ({t: p.c, h: moonSvg(SunCalc.getMoonIllumination(p.c).phase) + (p.e === 'rise' ? '↑' : '↓')})));
      return row('Güneş · Ay', 'Doğuş · Batış', hs.map(x => { const a = x.t.getTime() - 30 * 60000, b = a + 3600000; const e = evs.filter(v => v.t.getTime() >= a && v.t.getTime() < b);
        return '<td class="' + cls(x, 'ev') + '">' + e.map(v => '<span class="evi">' + v.h + '<small>' + hm(v.t) + '</small></span>').join('') + '</td>'; }).join(''));
    },
    // Hava: simgenin altında bulut %; bulut yoksa (%0) yazı yok
    hava: () => row('Hava', 'bulut % · yağış', hs.map(x => { const c = x.cloud == null ? null : Math.round(x.cloud);
      return '<td class="' + cls(x, 'wxc') + '">' + wxIcon(x, nightH(x)) + (c ? '<small>%' + c + '</small>' : '') + '</td>'; }).join('')),
    // Balık: 5 balık, saatlik %, altında o saatin solunar olayları (M major · m minor · ☀↑ şafak · ☀↓ alacakaranlık)
    balik: () => row('Balık', ['aktivite %', 'Solunar M · m · ☀'], hs.map((x, i) => '<td class="' + cls(x, 'fish' + (acts[i].pct >= 61 ? ' hi' : '')) + '">' + fishHtml(acts[i].fish) + '<small>%' + acts[i].pct + '</small>' +
      '<em class="sol">' + (acts[i].tags.length ? esc(acts[i].tags.join(' ')) : '') + '</em></td>').join(''), 'fishrow', ['Balık', '% M m ☀']),
    balikgrafik: () => {
      const H = 44, pts = curve(dd).pts.filter(p => p.t.getTime() >= t0 - 1800000 && p.t.getTime() <= hs[hs.length - 1].t.getTime() + 1800000);
      const bars = hs.map((x, i) => { const p = acts[i].pct, h = Math.max(1, p / 100 * (H - 6)); return '<rect x="' + (i * COL_W + 12) + '" y="' + (H - 2 - h).toFixed(1) + '" width="' + (COL_W - 24) + '" height="' + h.toFixed(1) + '" rx="2" class="fb' + fishN(p) + '"/>'; }).join('');
      const line = pts.map(p => xOf(p.t.getTime()).toFixed(1) + ',' + (H - 2 - p.v * (H - 6)).toFixed(1)).join(' ');
      const grid = [20, 40, 60, 80].map(v => '<line x1="0" x2="' + W + '" y1="' + (H - 2 - v / 100 * (H - 6)).toFixed(1) + '" y2="' + (H - 2 - v / 100 * (H - 6)).toFixed(1) + '" class="gl"/>').join('');
      return row('Balık eğrisi', 'saat · 10 dk', span('<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + grid + bars + '<polyline points="' + line + '" class="fl"/></svg>'));
    },
    yagis: () => row('Yağış %', '', hs.map(x => '<td class="' + cls(x, (x.pop || 0) < 10 ? 'p0' : '') + '" style="' + (x.pop >= 10 ? tint('#3D7DD8', Math.min(60, 10 + x.pop * 0.5)) : '') + '">' + (x.pop == null ? '–' : '%' + Math.round(x.pop)) + '</td>').join(''), 'slim', ['Yağ.', '%']),
    yagismm: () => row('Yağış mm', '', hs.map(x => '<td class="' + cls(x, (x.rain || 0) < 0.1 ? 'p0' : '') + '" style="' + ((x.rain || 0) >= 0.1 ? tint('#2F6BC7', Math.min(70, 25 + x.rain * 12)) : '') + '">' + (x.rain == null ? '–' : x.rain < 0.1 ? '0' : f1(x.rain)) + '</td>').join(''), 'slim', ['Yağ.', 'mm']),
    sicaklik: () => row('Hava sıcaklığı', TU(), hs.map(x => '<td class="' + cls(x, 'tc') + '" style="' + tint(scaleColor(TEMP_STOPS, x.temp)) + '">' + degHtml(x.temp) + '</td>').join(''), '', ['Sıc.', TU()]),
    // Karma satırı: Karma seçiliyken ICON-EU, tek model seçiliyken o model; yedeğe geçmez, model bitince –
    ruzgar: () => row(mSel === 'karma' ? 'Rüzgâr · Karma' : 'Rüzgâr · Seçili', UT + ' ' + mBadge(SRC[kId].short), hs.map(x => wcell(x, x.wk)).join(''), 'krow', ['Rüz.', WU_UP[u] + ' ' + (mSel === 'karma' ? 'KRM' : SRC[kId].ab)]),
    r_icon: () => wRow('Rüzgâr', 'icon', 'w', 'mrow2'),
    r_ecmwf: () => wRow('Rüzgâr', 'ecmwf', 'w', 'mrow2'),
    r_gfs: () => wRow('Rüzgâr', 'gfs', 'w', 'mrow2'),
    h_icon: () => wRow('Hamle', 'icon', 'g', 'mrow2'),
    h_ecmwf: () => wRow('Hamle', 'ecmwf', 'g', 'mrow2'),
    h_gfs: () => wRow('Hamle', 'gfs', 'g', 'mrow2'),
    uyum: () => row('Model uyumu', 'fark kn', hs.map(x => { const sp = spreadKn(x); const c = sp == null ? '' : sp <= 4 ? 'A' : sp <= 8 ? 'C' : 'D';
      return '<td class="' + cls(x, 'agree') + '">' + (sp == null ? '–' : '<i class="dot ' + c + '"></i><small>' + Math.round(sp) + '</small>') + '</td>'; }).join(''), '', ['Uyum', 'kn']),
    yon: () => row('Rüzgâr Yönü', '', hs.map(x => '<td class="' + cls(x, 'wd') + '">' + arrowFrom(x.wdir) + '<small>' + esc(windName(x.wdir)) + '</small></td>').join(''), '', ['Yön']),
    hamle: () => row('Hamle', UT + ' ' + mBadge(modelText(hs.map(x => x.gm))), hs.map(x => wcell(x, x.gust)).join(''), '', ['Hml.', WU_UP[u] + ' ' + modelText(hs.map(x => x.gid ? SRC[x.gid].ab : null))]),
    dalga: () => row('Dalga', 'm ' + mBadge(modelText(hs.map(x => x.wvm)) === 'MFWAM' ? 'MFWAM' : 'deniz'), hs.map(x => '<td class="' + cls(x, x.wave == null ? '' : 'b' + waveClass(x.wave)) + '">' + f1(x.wave) + '</td>').join(''), '', ['Dlg.', 'm']),
    periyot: () => row('Periyot', 'sn · ok', hs.map(x => '<td class="' + cls(x) + '">' + (x.per == null ? '–' : Math.round(x.per)) + '<small>' + arrowFrom(x.waveDir) + '</small></td>').join(''), '', ['Per.', 'sn']),
    akinti: () => row('Akıntı', 'kn · ok', hs.map(x => '<td class="' + cls(x) + '">' + f1(x.cur) + '<small>' + arrowTo(x.curDir) + '</small></td>').join(''), '', ['Akın.', 'kn']),
    suruklenme: () => { const anch = S.settings.anchor === 'demir';
      return row(anch ? 'İpe akış' : 'Sürüklenme', 'kn', hs.map(x => { const dr = driftAt(x); return '<td class="' + cls(x) + '">' + (dr && dr.known ? f1(anch ? dr.line : dr.sog) + (anch ? '' : '<small>' + arrowTo(dr.dir) + '</small>') : '–') + '</td>'; }).join(''), '', [anch ? 'İpe' : 'Sürk.', 'kn']); },
    kiyiya: () => { const f = facingOf(loc());
      return row('Kıyıya göre', f == null ? 'bakışı gir' : 'bakış ' + dir8(f), hs.map(x => { const r = shoreRel(x.wdir, f), c = shoreClass(x, f);
        return '<td class="' + cls(x, c ? 'b' + c : '') + '">' + (r ? {vuran: 'vuran', esen: 'esen', yandan: 'yandan'}[r] : '–') + '</td>'; }).join('')); },
    su: () => row('Su sıcaklığı', TU(), hs.map(x => '<td class="' + cls(x, 'tc') + '" style="' + tint(scaleColor(SST_STOPS, x.sst)) + '">' + degHtml(x.sst, true) + '</td>').join(''), '', ['Su', TU()]),
    basinc: () => row('Basınç', (pressU() === 'mmhg' ? 'mmHg' : 'hPa') + ' · 3 sa', hs.map(x => '<td class="' + cls(x) + '" style="' + tint(scaleColor(PRESS_STOPS, x.press), 36) + '">' + (x.press == null ? '–' : Math.round(pressNum(x.press))) +
      '<small>' + (x.dp3 == null ? '' : (x.dp3 >= 0.5 ? '↑' : x.dp3 <= -0.5 ? '↓' : '→') + f1(Math.abs(pressU() === 'mmhg' ? x.dp3 * 0.750062 : x.dp3))) + '</small></td>').join(''), '', [pressU() === 'mmhg' ? 'mmHg' : 'hPa', '3 sa']),
    basincgrafik: () => {
      const v = hs.map(x => x.press); const ok = v.filter(p => p != null); if (ok.length < 2) return row('Basınç', 'grafik', span('<span class="note">veri yok</span>'), '', ['Bas.', 'graf.']);
      const H = 40, lo = Math.min(...ok) - 0.5, hi = Math.max(...ok) + 0.5, y = p => (H - 4 - (p - lo) / (hi - lo) * (H - 8)).toFixed(1);
      const pts = hs.map((x, i) => x.press == null ? null : (i * COL_W + COL_W / 2) + ',' + y(x.press)).filter(Boolean).join(' ');
      const d = ok[ok.length - 1] - ok[0];
      return row('Basınç', 'gün içi ' + (d > 1 ? '↑' : d < -1 ? '↓' : '→'), span('<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polyline points="' + pts + '" class="pl"/>' +
        '<text x="4" y="11" class="gt">' + Math.round(pressNum(Math.max(...ok))) + '</text><text x="4" y="' + (H - 2) + '" class="gt">' + Math.round(pressNum(Math.min(...ok))) + '</text></svg>'), '', ['Bas.', 'gün ' + (d > 1 ? '↑' : d < -1 ? '↓' : '→')]);
    },
  };
  const rows = orderedRows(HROWS, S.settings.hrows).filter(r => r.on && R[r.id] && (!r.mode || r.mode === (S.mode || 'tekne'))).map(r => R[r.id]());
  tbl.innerHTML = '<tbody>' + rows.join('') + '</tbody>';
  const sea = WX && WX.sea;
  const sp = hs.map(spreadKn).filter(v => v != null); const mx = sp.length ? Math.max(...sp) : null;
  $('hourlyNote').textContent = (S.wx && S.wx.at ? (PREVIEW ? 'örnek veri' : 'güncel ' + hm(new Date(S.wx.at))) : '') + ' · güven ' + dd.conf +
    (mx == null ? '' : mx <= 6 ? ' · modeller uyumlu' : ' · modeller ayrışıyor (' + Math.round(mx) + ' kn fark)');
  $('seaNote').hidden = !sea;
  if (sea) $('seaNote').textContent = 'Bu nokta karada ya da kıyıya çok yakın: dalga, akıntı ve su sıcaklığı ' + f1(sea.km) + ' km ' + dir8(sea.dir) + ' yönündeki en yakın deniz noktasından.';
  $('hScroll').classList.toggle('compact', !S.settings.hFull);
  if (isToday) { const sc = $('hScroll'); const i = hs.findIndex(x => x.h === nowH); if (i > 1) requestAnimationFrame(() => { sc.scrollLeft = (i - 1) * COL_W; }); }
  else $('hScroll').scrollLeft = 0;
}
// konum başlığında pusula: rüzgâr (Bft renginde), dalga ve akıntı oku (hepsi gittiği yöne)
function compassHtml(x){
  if (!x) return '';
  const arm = (deg, len, cls, w) => deg == null ? '' : '<g transform="rotate(' + Math.round(deg) + ' 18 18)"><line x1="18" y1="' + (18 + len * 0.35) + '" x2="18" y2="' + (18 - len) + '" class="' + cls + '" stroke-width="' + w + '"/><path d="M18 ' + (18 - len - 3) + 'l-3.2 5h6.4z" class="' + cls + 'h"/></g>';
  const b = bft(x.wind);
  return '<svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true"><circle cx="18" cy="18" r="16.5" class="cr"/><text x="18" y="7.2" class="cn">K</text>' +
    '<g style="--wc:' + (b == null ? 'var(--muted)' : bftColor(b)) + '">' + arm(x.wdir == null ? null : x.wdir + 180, 10, 'cw', 2.6) + '</g>' +
    arm(x.waveDir == null ? null : x.waveDir + 180, 7, 'cv', 1.8) + arm(x.curDir, 5, 'cc', 1.8) + '</svg>';
}
function compassTxt(x){
  if (!x) return '';
  return 'Rüzgâr ' + (x.wind == null ? '–' : windName(x.wdir) + ' ' + kn(x.wind) + ' kn') + ' · dalga ' + (x.wave == null ? '–' : f1(x.wave) + ' m, ' + windName(x.waveDir) + ' yönünden') + ' · akıntı ' + (x.cur == null ? '–' : f1(x.cur) + ' kn ' + dir8(x.curDir) + ' yönüne');
}
