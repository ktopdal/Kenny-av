// ---------------------------------------------------------------- 71 · saatlik tablo (Windy düzeni; satırlar, birimler ve model seçilebilir)
// Rüzgâr adları: geldiği yöne göre (Kıble = güneyden). Ok rüzgârın, dalganın ve teknenin gittiği yönü gösterir.
const WIND_NAMES = ['Yıldız', 'Poyraz', 'Gündoğusu', 'Keşişleme', 'Kıble', 'Lodos', 'Batı', 'Karayel'];
const windName = deg => deg == null ? '' : (S.settings.windNames === 'harf' ? dir8(deg) : WIND_NAMES[Math.round((((deg % 360) + 360) % 360) / 45) % 8]);
const WU_TXT = {bft: 'Bft', kn: 'kn', ms: 'm/s', kmh: 'km/sa'};
const windU = () => WU_TXT[S.settings.windUnit] ? S.settings.windUnit : 'bft';
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
const HROWS = [
  {id: 'saat', t: 'Saat', fixed: true},
  {id: 'gunes', t: 'Güneş ve ay'},
  {id: 'hava', t: 'Hava (bulut, yağış simgesi)'},
  {id: 'balik', t: 'Balık (5 balık)'},
  {id: 'balikgrafik', t: 'Balık çubukları ve günün eğrisi'},
  {id: 'solunar', t: 'Solunar olayları'},
  {id: 'yagis', t: 'Yağış olasılığı'},
  {id: 'yagismm', t: 'Yağış miktarı'},
  {id: 'sicaklik', t: 'Hava sıcaklığı'},
  {id: 'ruzgar', t: 'Rüzgâr'},
  {id: 'r_icon', t: 'Rüzgâr · ICON-EU', on: false},
  {id: 'r_ecmwf', t: 'Rüzgâr · ECMWF'},
  {id: 'r_gfs', t: 'Rüzgâr · GFS', on: false},
  {id: 'uyum', t: 'Model uyumu'},
  {id: 'yon', t: 'Rüzgâr yönü'},
  {id: 'hamle', t: 'Hamle'},
  {id: 'dalga', t: 'Dalga'},
  {id: 'periyot', t: 'Dalga periyodu ve yönü'},
  {id: 'akinti', t: 'Akıntı'},
  {id: 'suruklenme', t: 'Sürüklenme (tekne)', mode: 'tekne'},
  {id: 'kiyiya', t: 'Rüzgâr kıyıya göre (kıyı)', mode: 'kiyi'},
  {id: 'su', t: 'Su sıcaklığı'},
  {id: 'basinc', t: 'Basınç'},
  {id: 'basincgrafik', t: 'Basınç grafiği'},
  {id: 'bulut', t: 'Bulut', on: false},
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
  const row = (label, sub, cells, trc) => '<tr' + (trc ? ' class="' + trc + '"' : '') + '><th class="lbl" scope="row"><b>' + label + '</b><small>' + sub + '</small></th>' + cells + '</tr>';
  const acts = hs.map(activity);
  const u = windU();
  const wcell = (x, v, small) => { const b = bft(v); if (b == null) return '<td class="' + cls(x) + '">–</td>';
    const main = windNum(v, u); const sub = u === 'bft' ? kn(v) + ' kn' : b + ' Bft';
    return '<td class="' + cls(x, 'bf' + (small ? ' bfs' : '')) + '" style="' + bftStyle(b) + '">' + main + (small ? '' : '<small>' + sub + '</small>') + '</td>'; };
  const span = (inner, trc) => '<td class="graph" colspan="' + hs.length + '">' + inner + '</td>';
  const W = hs.length * COL_W, t0 = hs[0].t.getTime();
  const xOf = t => COL_W / 2 + (t - t0) / 3600000 * COL_W;
  const R = {
    saat: () => row('Saat', 'yerel saat', hs.map(x => '<td class="' + cls(x, nightH(x) ? 'nt' : '') + '">' + pad(x.h) + '</td>').join(''), 'hours'),
    gunes: () => {
      const evs = [{t: sol.sunrise, h: '<span class="sunev">☀↑</span>'}, {t: sol.sunset, h: '<span class="sunev">☀↓</span>'}]
        .concat(sol.allMinor.map(p => ({t: p.c, h: moonSvg(SunCalc.getMoonIllumination(p.c).phase) + (p.e === 'rise' ? '↑' : '↓')})));
      return row('Güneş · Ay', 'doğuş ↑ · batış ↓', hs.map(x => { const a = x.t.getTime() - 30 * 60000, b = a + 3600000; const e = evs.filter(v => v.t.getTime() >= a && v.t.getTime() < b);
        return '<td class="' + cls(x, 'ev') + '">' + e.map(v => '<span class="evi">' + v.h + '<small>' + hm(v.t) + '</small></span>').join('') + '</td>'; }).join(''));
    },
    hava: () => row('Hava', 'bulut · yağış', hs.map(x => '<td class="' + cls(x) + '">' + wxIcon(x, nightH(x)) + '</td>').join('')),
    balik: () => row('Balık', 'tahmini aktivite % · her balık %20', hs.map((x, i) => '<td class="' + cls(x, 'fish' + (acts[i].pct >= 61 ? ' hi' : '')) + '">' + fishHtml(acts[i].fish) + '<small>%' + acts[i].pct + '</small></td>').join('')),
    balikgrafik: () => {
      const H = 44, pts = curve(dd).pts.filter(p => p.t.getTime() >= t0 - 1800000 && p.t.getTime() <= hs[hs.length - 1].t.getTime() + 1800000);
      const bars = hs.map((x, i) => { const p = acts[i].pct, h = Math.max(1, p / 100 * (H - 6)); return '<rect x="' + (i * COL_W + 12) + '" y="' + (H - 2 - h).toFixed(1) + '" width="' + (COL_W - 24) + '" height="' + h.toFixed(1) + '" rx="2" class="fb' + fishN(p) + '"/>'; }).join('');
      const line = pts.map(p => xOf(p.t.getTime()).toFixed(1) + ',' + (H - 2 - p.v * (H - 6)).toFixed(1)).join(' ');
      const grid = [20, 40, 60, 80].map(v => '<line x1="0" x2="' + W + '" y1="' + (H - 2 - v / 100 * (H - 6)).toFixed(1) + '" y2="' + (H - 2 - v / 100 * (H - 6)).toFixed(1) + '" class="gl"/>').join('');
      return row('Balık eğrisi', 'çubuk saatlik % · çizgi 10 dk', span('<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + grid + bars + '<polyline points="' + line + '" class="fl"/></svg>'));
    },
    solunar: () => row('Solunar', 'M major · m minor · ☀ şafak', hs.map((x, i) => '<td class="' + cls(x, 'sol') + '">' + esc(acts[i].tags.join(' ')) + '</td>').join('')),
    yagis: () => row('Yağış', 'olasılık %', hs.map(x => '<td class="' + cls(x, (x.pop || 0) < 10 ? 'p0' : '') + '" style="' + (x.pop >= 10 ? tint('#3D7DD8', Math.min(60, 10 + x.pop * 0.5)) : '') + '">' + (x.pop == null ? '–' : Math.round(x.pop)) + '</td>').join('')),
    yagismm: () => row('Yağış', 'mm', hs.map(x => '<td class="' + cls(x, (x.rain || 0) < 0.1 ? 'p0' : '') + '" style="' + ((x.rain || 0) >= 0.1 ? tint('#2F6BC7', Math.min(70, 25 + x.rain * 12)) : '') + '">' + (x.rain == null ? '–' : x.rain < 0.1 ? '0' : f1(x.rain)) + '</td>').join('')),
    sicaklik: () => row('Sıcaklık', 'hava °C', hs.map(x => '<td class="' + cls(x) + '" style="' + tint(scaleColor(TEMP_STOPS, x.temp)) + '">' + f0(x.temp) + '</td>').join('')),
    ruzgar: () => row('Rüzgâr', WU_TXT[u] + ' ' + [...new Set(hs.map(x => x.wid).filter(Boolean))].map(k => mBadge(SRC[k].short)).join(' '), hs.map(x => wcell(x, x.wind)).join('')),
    r_icon: () => row('Rüzgâr', WU_TXT[u] + ' ' + mBadge('ICON'), hs.map(x => wcell(x, x.m && x.m.icon ? x.m.icon.w : null, true)).join(''), 'mrow2'),
    r_ecmwf: () => row('Rüzgâr', WU_TXT[u] + ' ' + mBadge('ECMWF'), hs.map(x => wcell(x, x.m && x.m.ecmwf ? x.m.ecmwf.w : null, true)).join(''), 'mrow2'),
    r_gfs: () => row('Rüzgâr', WU_TXT[u] + ' ' + mBadge('GFS'), hs.map(x => wcell(x, x.m && x.m.gfs ? x.m.gfs.w : null, true)).join(''), 'mrow2'),
    uyum: () => row('Model uyumu', 'en çok fark kn', hs.map(x => { const sp = spreadKn(x); const c = sp == null ? '' : sp <= 4 ? 'A' : sp <= 8 ? 'C' : 'D';
      return '<td class="' + cls(x, 'agree') + '">' + (sp == null ? '–' : '<i class="dot ' + c + '"></i><small>' + Math.round(sp) + '</small>') + '</td>'; }).join('')),
    yon: () => row('Yön', 'ok gittiği · ad geldiği yön', hs.map(x => '<td class="' + cls(x, 'wd') + '">' + arrowFrom(x.wdir) + '<small>' + esc(windName(x.wdir)) + '</small></td>').join('')),
    hamle: () => row('Hamle', WU_TXT[u] + ' ' + mBadge(modelText(hs.map(x => x.gm))), hs.map(x => wcell(x, x.gust)).join('')),
    dalga: () => row('Dalga', 'm ' + mBadge(modelText(hs.map(x => x.wvm)) === 'MFWAM' ? 'MFWAM' : 'deniz'), hs.map(x => '<td class="' + cls(x, x.wave == null ? '' : 'b' + waveClass(x.wave)) + '">' + f1(x.wave) + '</td>').join('')),
    periyot: () => row('Periyot', 'sn · ok dalganın gidişi', hs.map(x => '<td class="' + cls(x) + '">' + (x.per == null ? '–' : Math.round(x.per)) + '<small>' + arrowFrom(x.waveDir) + '</small></td>').join('')),
    akinti: () => row('Akıntı', 'kn · ok gittiği yön', hs.map(x => '<td class="' + cls(x) + '">' + f1(x.cur) + '<small>' + arrowTo(x.curDir) + '</small></td>').join('')),
    suruklenme: () => { const anch = S.settings.anchor === 'demir';
      return row(anch ? 'İpe akış' : 'Sürüklenme', anch ? 'kn · demirli' : 'kn · teknenin gidişi', hs.map(x => { const dr = driftAt(x); return '<td class="' + cls(x) + '">' + (dr && dr.known ? f1(anch ? dr.line : dr.sog) + (anch ? '' : '<small>' + arrowTo(dr.dir) + '</small>') : '–') + '</td>'; }).join('')); },
    kiyiya: () => { const f = facingOf(loc());
      return row('Kıyıya göre', f == null ? 'kıyının bakışını gir' : 'kıyının bakışı ' + dir8(f), hs.map(x => { const r = shoreRel(x.wdir, f), c = shoreClass(x, f);
        return '<td class="' + cls(x, c ? 'b' + c : '') + '">' + (r ? {vuran: 'vuran', esen: 'esen', yandan: 'yandan'}[r] : '–') + '</td>'; }).join('')); },
    su: () => row('Su', '°C', hs.map(x => '<td class="' + cls(x) + '" style="' + tint(scaleColor(SST_STOPS, x.sst)) + '">' + f1(x.sst) + '</td>').join('')),
    basinc: () => row('Basınç', (pressU() === 'mmhg' ? 'mmHg' : 'hPa') + ' · 3 sa değişim', hs.map(x => '<td class="' + cls(x) + '" style="' + tint(scaleColor(PRESS_STOPS, x.press), 36) + '">' + (x.press == null ? '–' : Math.round(pressNum(x.press))) + '<small>' + (x.dp3 == null ? '' : (x.dp3 > 0 ? '+' : '') + f1(pressU() === 'mmhg' ? x.dp3 * 0.750062 : x.dp3)) + '</small></td>').join('')),
    basincgrafik: () => {
      const v = hs.map(x => x.press); const ok = v.filter(p => p != null); if (ok.length < 2) return row('Basınç', 'grafik', span('<span class="note">veri yok</span>'));
      const H = 40, lo = Math.min(...ok) - 0.5, hi = Math.max(...ok) + 0.5, y = p => (H - 4 - (p - lo) / (hi - lo) * (H - 8)).toFixed(1);
      const pts = hs.map((x, i) => x.press == null ? null : (i * COL_W + COL_W / 2) + ',' + y(x.press)).filter(Boolean).join(' ');
      const d = ok[ok.length - 1] - ok[0];
      return row('Basınç', 'gün içi ' + (d > 1 ? '↑ yükseliyor' : d < -1 ? '↓ düşüyor' : '→ durgun'), span('<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polyline points="' + pts + '" class="pl"/>' +
        '<text x="4" y="11" class="gt">' + Math.round(pressNum(Math.max(...ok))) + '</text><text x="4" y="' + (H - 2) + '" class="gt">' + Math.round(pressNum(Math.min(...ok))) + '</text></svg>'));
    },
    bulut: () => row('Bulut', '%', hs.map(x => '<td class="' + cls(x) + '" style="' + (x.cloud != null ? tint('#8A9AAE', Math.round(x.cloud * 0.5)) : '') + '">' + f0(x.cloud) + '</td>').join('')),
  };
  const rows = orderedRows(HROWS, S.settings.hrows).filter(r => r.on && R[r.id] && (!r.mode || r.mode === (S.mode || 'tekne'))).map(r => R[r.id]());
  tbl.innerHTML = '<tbody>' + rows.join('') + '</tbody>';
  const sea = WX && WX.sea;
  const sp = hs.map(spreadKn).filter(v => v != null); const mx = sp.length ? Math.max(...sp) : null;
  $('hourlyNote').textContent = (S.wx && S.wx.at ? (PREVIEW ? 'örnek veri' : 'güncel ' + hm(new Date(S.wx.at))) : '') + ' · güven ' + dd.conf +
    (mx == null ? '' : mx <= 6 ? ' · modeller uyumlu' : ' · modeller ayrışıyor (' + Math.round(mx) + ' kn fark)');
  $('seaNote').hidden = !sea;
  if (sea) $('seaNote').textContent = 'Bu nokta karada ya da kıyıya çok yakın: dalga, akıntı ve su sıcaklığı ' + f1(sea.km) + ' km ' + dir8(sea.dir) + ' yönündeki en yakın deniz noktasından.';
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
