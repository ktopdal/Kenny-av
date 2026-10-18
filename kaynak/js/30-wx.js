// ---------------------------------------------------------------- 30 · hava ve deniz (Open-Meteo, telefondan)
// Rüzgâr: ICON-EU 7 km (≈5 gün) → ECMWF IFS 0,25° → en iyi eşleşme. Hamle: GFS → en iyi eşleşme.
// Yağış olasılığı: en iyi eşleşme (topluluk modelleri). Dalga: MFWAM → en iyi deniz modeli. Akıntı ve su: Météo-France.
const API_F = 'https://api.open-meteo.com/v1/forecast', API_M = 'https://marine-api.open-meteo.com/v1/marine';
const FV = 'temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation';
const MV = 'wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature';
const SRC = {
  icon: {label: 'ICON-EU 7 km', what: 'rüzgâr, sıcaklık, yağış'},
  ecmwf: {label: 'ECMWF IFS', what: 'rüzgâr (ICON sonrası)'},
  gfs: {label: 'GFS', what: 'hamle'},
  best: {label: 'Open-Meteo en iyi', what: 'yağış olasılığı, yedek'},
  mf: {label: 'MFWAM', what: 'dalga'},
  mbest: {label: 'Deniz (en iyi)', what: 'akıntı, su sıcaklığı, yedek dalga'},
};
function reqUrls(id, L){
  const ll = 'latitude=' + L.lat.toFixed(4) + '&longitude=' + L.lon.toFixed(4) + '&timezone=auto';
  const f = (extra) => API_F + '?' + ll + '&wind_speed_unit=ms' + extra;
  const m = (extra) => API_M + '?' + ll + extra;
  switch (id) {
    case 'icon': return [f('&models=icon_eu&forecast_days=7&hourly=' + FV), f('&models=icon_seamless&forecast_days=7&hourly=' + FV)];
    case 'ecmwf': return [16, 15, 10].map(n => f('&models=ecmwf_ifs025&forecast_days=' + n + '&hourly=' + FV));
    case 'gfs': return [f('&models=gfs_seamless&forecast_days=16&hourly=wind_gusts_10m'), f('&models=gfs_global&forecast_days=16&hourly=wind_gusts_10m')];
    case 'best': return [f('&forecast_days=16&hourly=precipitation_probability,wind_gusts_10m,' + FV), f('&forecast_days=16&hourly=wind_gusts_10m,' + FV)];
    case 'mf': return [m('&models=meteofrance_wave&forecast_days=10&hourly=wave_height,wave_direction,wave_period')];
    case 'mbest': return [16, 10, 8, 7].map(n => m('&forecast_days=' + n + '&hourly=' + MV));
  }
  return [];
}
async function fetchFirst(urls){
  let last = null;
  for (const u of urls) {
    try {
      const r = await fetch(u, {cache: 'no-store'});
      if (r.ok) { const j = await r.json(); if (j && j.hourly && j.hourly.time) return {ok: true, data: {hourly: j.hourly, hourly_units: j.hourly_units || {}, utc_offset_seconds: j.utc_offset_seconds}}; last = 'boş yanıt'; }
      else last = 'HTTP ' + r.status;
    } catch (e) { last = 'bağlantı yok'; }
  }
  return {ok: false, err: last};
}
const wxKey = L => L.lat.toFixed(4) + ',' + L.lon.toFixed(4);
function setNet(s, msg){ const n = $('net'); n.dataset.s = s; n.querySelector('span').textContent = msg; }
let WX = null;   // birleşik saatlik seri (önbellekten kurulur)
async function loadWeather(force){
  const L = loc(); if (!L) return;
  const key = wxKey(L);
  if (PREVIEW) { if (!S.wx || S.wx.key !== key) { const smp = SAMPLE_WX(); if (smp) S.wx = {key, at: Date.now(), raw: smp.raw, status: smp.status}; } WX = buildWx(); setNet('ok', 'Örnek veri'); renderAll(); return; }
  if (S.wx && S.wx.key === key && !force && Date.now() - S.wx.at < 45 * 60 * 1000) { WX = buildWx(); setNet('ok', 'Güncel ' + hm(new Date(S.wx.at))); renderAll(); return; }
  setNet('load', 'Yükleniyor');
  const ids = Object.keys(SRC);
  const res = await Promise.all(ids.map(id => fetchFirst(reqUrls(id, L))));
  const raw = {}, status = {};
  ids.forEach((id, i) => { status[id] = res[i].ok ? 'ok' : (res[i].err || 'hata'); if (res[i].ok) raw[id] = res[i].data; });
  if (Object.keys(raw).length) {
    S.wx = {key, at: Date.now(), raw, status}; persist();
    WX = buildWx(); setNet('ok', 'Güncel ' + hm(new Date()));
  } else {
    WX = S.wx && S.wx.key === key ? buildWx() : null;
    setNet('err', WX ? 'Eski veri' : 'Veri alınamadı');
  }
  renderAll();
}
function seriesOf(raw, name){
  if (!raw || !raw.hourly) return null;
  const h = raw.hourly; if (h[name]) return h[name];
  const k = Object.keys(h).find(x => x.indexOf(name + '_') === 0); return k ? h[k] : null;
}
function fillGaps(arr, maxGap){
  if (!arr) return arr; const a = arr.slice(); let i = 0;
  while (i < a.length) {
    if (a[i] == null) { let j = i; while (j < a.length && a[j] == null) j++;
      if (i > 0 && j < a.length && j - i <= maxGap) { const v0 = a[i - 1], v1 = a[j]; for (let k = i; k < j; k++) a[k] = v0 + (v1 - v0) * (k - i + 1) / (j - i + 1); }
      i = j; } else i++;
  }
  return a;
}
// yön serileri için boşlukları vektörle doldur
function fillDir(arr, maxGap){
  if (!arr) return arr; const s = fillGaps(arr.map(d => d == null ? null : Math.sin(d * Math.PI / 180)), maxGap), c = fillGaps(arr.map(d => d == null ? null : Math.cos(d * Math.PI / 180)), maxGap);
  return arr.map((d, i) => d != null ? d : (s[i] == null || c[i] == null ? null : (Math.atan2(s[i], c[i]) * 180 / Math.PI + 360) % 360));
}
function curToKn(v, unit){ if (v == null) return null; unit = String(unit || 'km/h').toLowerCase(); if (unit.indexOf('kn') >= 0) return v; if (unit.indexOf('m/s') >= 0) return v * KN; if (unit.indexOf('mph') >= 0) return v * 0.868976; return v / 1.852; }
function windToMs(v, unit){ if (v == null) return null; unit = String(unit || 'm/s').toLowerCase(); if (unit.indexOf('km') >= 0) return v / 3.6; if (unit.indexOf('kn') >= 0) return v / KN; if (unit.indexOf('mph') >= 0) return v * 0.44704; return v; }
function buildWx(){
  if (!S.wx || !S.wx.raw) return null;
  const R = S.wx.raw;
  const times = {}; Object.values(R).forEach(r => r.hourly.time.forEach(t => { times[t] = 1; }));
  const T = Object.keys(times).sort();
  const col = (id, name, gap, dir) => {
    const r = R[id]; if (!r) return null; const s = seriesOf(r, name); if (!s) return null;
    const idx = {}; r.hourly.time.forEach((t, i) => { idx[t] = i; });
    const arr = T.map(t => idx[t] != null ? s[idx[t]] : null);
    return dir ? fillDir(arr, gap) : fillGaps(arr, gap);
  };
  const unit = (id, name) => { const r = R[id]; if (!r) return ''; const u = r.hourly_units || {}; if (u[name]) return u[name]; const k = Object.keys(u).find(x => x.indexOf(name + '_') === 0); return k ? u[k] : ''; };
  const g = {}; ['icon', 'ecmwf', 'best'].forEach(id => {
    g[id] = {wind: col(id, 'wind_speed_10m', 6), wdir: col(id, 'wind_direction_10m', 6, true), temp: col(id, 'temperature_2m', 6), press: col(id, 'pressure_msl', 6),
      cloud: col(id, 'cloud_cover', 6), rain: col(id, 'precipitation', 0), u: unit(id, 'wind_speed_10m')};
  });
  const gustG = col('gfs', 'wind_gusts_10m', 6), gustB = col('best', 'wind_gusts_10m', 6);
  const pop = col('best', 'precipitation_probability', 3);
  const wMF = col('mf', 'wave_height', 6), wMFd = col('mf', 'wave_direction', 6, true), wMFp = col('mf', 'wave_period', 6);
  const wB = col('mbest', 'wave_height', 6), wBd = col('mbest', 'wave_direction', 6, true), wBp = col('mbest', 'wave_period', 6);
  const cur = col('mbest', 'ocean_current_velocity', 6), curd = col('mbest', 'ocean_current_direction', 6, true), sst = col('mbest', 'sea_surface_temperature', 12);
  const cu = unit('mbest', 'ocean_current_velocity');
  const hours = T.map((t, i) => {
    const pickW = ['icon', 'ecmwf', 'best'].find(id => g[id].wind && g[id].wind[i] != null);
    const w = pickW ? g[pickW] : null;
    const val = k => { for (const id of ['icon', 'ecmwf', 'best']) { const s = g[id][k]; if (s && s[i] != null) return s[i]; } return null; };
    const gu = gustG && gustG[i] != null ? {v: gustG[i], m: 'GFS', u: unit('gfs', 'wind_gusts_10m')} : gustB && gustB[i] != null ? {v: gustB[i], m: 'En iyi', u: unit('best', 'wind_gusts_10m')} : null;
    const wv = wMF && wMF[i] != null ? {h: wMF[i], d: wMFd && wMFd[i], p: wMFp && wMFp[i], m: 'MFWAM'} : wB && wB[i] != null ? {h: wB[i], d: wBd && wBd[i], p: wBp && wBp[i], m: 'en iyi deniz modeli'} : null;
    const d = new Date(t);
    return {t: d, key: t.slice(0, 10), h: Number(t.slice(11, 13)),
      wind: w ? windToMs(w.wind[i], w.u) : null, wdir: w && w.wdir ? w.wdir[i] : null, wm: pickW ? SRC[pickW].label : null, wmShort: pickW === 'icon' ? 'I' : pickW === 'ecmwf' ? 'E' : pickW ? 'O' : '',
      temp: val('temp'), press: val('press'), cloud: val('cloud'), rain: val('rain'),
      gust: gu ? windToMs(gu.v, gu.u) : null, gm: gu ? gu.m : null, pop: pop ? pop[i] : null,
      wave: wv ? wv.h : null, waveDir: wv ? wv.d : null, per: wv ? wv.p : null, wvm: wv ? wv.m : null,
      cur: cur ? curToKn(cur[i], cu) : null, curDir: curd ? curd[i] : null, sst: sst ? sst[i] : null};
  });
  hours.forEach((x, i) => { const p3 = hours[i - 3]; x.dp3 = (p3 && x.press != null && p3.press != null) ? x.press - p3.press : null; });
  return {hours, at: S.wx.at, status: S.wx.status || {}};
}
const maxOf = (arr, k) => { let v = null; arr.forEach(x => { if (x[k] != null && (v == null || x[k] > v)) v = x[k]; }); return v; };
const minOf = (arr, k) => { let v = null; arr.forEach(x => { if (x[k] != null && (v == null || x[k] < v)) v = x[k]; }); return v; };
const meanOf = (arr, k) => { const v = arr.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
let DAYS_CACHE = null;
function days(){
  if (!WX || !WX.hours.length) return [];
  if (DAYS_CACHE && DAYS_CACHE.src === WX) return DAYS_CACHE.days;
  const by = {}; WX.hours.forEach(x => { (by[x.key] = by[x.key] || []).push(x); });
  const keys = Object.keys(by).sort().filter(k => by[k].some(x => x.wind != null));
  const out = keys.map((k, idx) => {
    const hs = by[k], next = by[keys[idx + 1]] || [];
    const day = hs.filter(x => x.h >= 7 && x.h < 18), night = hs.filter(x => x.h >= 19).concat(next.filter(x => x.h < 6));
    const wd = maxOf(day, 'wind'), wn = maxOf(night, 'wind'), wv = maxOf(hs, 'wave');
    const d = new Date(k + 'T12:00:00');
    const models = [...new Set(hs.map(x => x.wm).filter(Boolean))];
    return {key: k, date: d, idx, hs, wd, wn, gust: maxOf(hs, 'gust'), wave: wv, per: maxOf(hs, 'per'), cur: maxOf(hs, 'cur'), curMean: meanOf(hs, 'cur'),
      sst: meanOf(hs, 'sst'), tmax: maxOf(hs, 'temp'), tmin: minOf(hs, 'temp'), pmean: meanOf(hs, 'press'), pop: maxOf(hs, 'pop'),
      pdelta: hs.length > 1 && hs[hs.length - 1].press != null && hs[0].press != null ? hs[hs.length - 1].press - hs[0].press : 0,
      rain: hs.reduce((a, x) => a + (x.rain || 0), 0), models,
      clsD: wd == null ? null : bump(seaClass(wd), wv), clsN: wn == null ? null : bump(seaClass(wn), wv),
      conf: idx < 3 ? 'yüksek' : idx < 7 ? 'iyi' : idx < 10 ? 'orta' : 'düşük', sol: solunar(d)};
  });
  DAYS_CACHE = {src: WX, days: out};
  return out;
}
