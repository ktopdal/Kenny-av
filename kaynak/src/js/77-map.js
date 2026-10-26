// ---------------------------------------------------------------- 77 · Harita: nokta seç, yer adı, derece-dakika koordinat, derinlik, katmanlar
// Leaflet (BSD-2) uygulamayla birlikte gelir (vendor/leaflet), harita ilk açılışta yüklenir.
// Altlık: OpenStreetMap ya da Esri uydu · Katmanlar: OpenSeaMap deniz işaretleri, EMODnet derinlik renkleri ve eğrileri, EMODnet dip türü (AB suları)
// Yer adı: OpenStreetMap Nominatim (karada) ve Overpass (denizde en yakın yer, koy, kıyıya uzaklık) · Derinlik: EMODnet Bathymetry
const MAP_DEF = {base: 'osm', seamark: true, depth: false, contours: true, habitat: false, substrate: false, locs: true, catches: true, grup: true, drift: true};
const mapCfg = () => Object.assign({}, MAP_DEF, S.settings.map || {});
const NOMI = 'https://nominatim.openstreetmap.org/reverse';
// Overpass: ana sunucu sık sık yoğun; iki sunucuya birden sorulur, ilk yanıt alınır
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const EMOD_DEPTH = 'https://rest.emodnet-bathymetry.eu/depth_sample';
let MAP = null, MAPL = null, MPICK = null, PICK_ID = 0;
const LF = () => window.L;
function loadLeaflet(){
  if (window.L && window.L.map) return Promise.resolve();
  if (loadLeaflet.p) return loadLeaflet.p;
  const base = PREVIEW ? 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/' : 'vendor/leaflet/';
  loadLeaflet.p = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = base + 'leaflet.js';
    s.onload = () => res(); s.onerror = () => { loadLeaflet.p = null; s.remove(); rej(new Error('harita kütüphanesi yüklenemedi')); };
    document.head.appendChild(s);
  });
  return loadLeaflet.p;
}
async function fetchJ(url, opt, ms){ const r = await fetchT(url, opt, ms || 12000); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
let NOMI_AT = 0;
async function nominatim(lat, lon){
  const wait = NOMI_AT + 1100 - Date.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait));   // Nominatim: saniyede en çok 1 istek
  NOMI_AT = Date.now();
  return fetchJ(NOMI + '?format=jsonv2&addressdetails=1&zoom=14&accept-language=tr&lat=' + lat.toFixed(5) + '&lon=' + lon.toFixed(5), null, 8000);
}
function overpassNear(lat, lon){
  const b = [lat - 0.06, lon - 0.075, lat + 0.06, lon + 0.075].map(v => v.toFixed(4)).join(',');
  const q = '[out:json][timeout:9];way(around:6000,' + lat.toFixed(5) + ',' + lon.toFixed(5) + ')[natural=coastline];out geom(' + b + ');' +
    'node(around:15000,' + lat.toFixed(5) + ',' + lon.toFixed(5) + ')[place~"^(city|town|village|suburb|hamlet|neighbourhood|locality|island|islet)$"][name];out;' +
    'nwr(around:6000,' + lat.toFixed(5) + ',' + lon.toFixed(5) + ')[natural~"^(bay|cape|peninsula|strait)$"][name];out center;';
  const one = async u => { const j = await fetchJ(u, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'data=' + encodeURIComponent(q)}, 10000);
    if (!j || !Array.isArray(j.elements) || /runtime error|timed out/i.test(j.remark || '')) throw new Error('overpass yarım yanıt'); return j; };
  return anyOf(OVERPASS.map(one));
}
// ilk başarılı yanıt (Promise.any yedeği)
function anyOf(ps){ return new Promise((res, rej) => { let n = ps.length; ps.forEach(p => p.then(res, () => { if (--n === 0) rej(new Error('hepsi başarısız')); })); }); }
async function depthAt(lat, lon){
  const j = await fetchJ(EMOD_DEPTH + '?geom=' + encodeURIComponent('POINT(' + lon.toFixed(5) + ' ' + lat.toFixed(5) + ')'), null, 8000);
  const v = j && (j.avg != null ? j.avg : j.smoothed);
  return v == null || !isFinite(v) ? null : Number(v);
}
// v0.20 · deniz tabanı (EMODnet Seabed Habitats, EUSeaMap 2025): bütün Akdeniz için modelle üretilmiş taban haritası (yaklaşık 100 m).
// Noktaya dokununca o yerin sınıfı sorulur (GetFeatureInfo); açıklamadaki kelimelerden dip türü çıkarılır. Tahmindir: konumun dibi
// kullanıcı seçmedikçe "tahmini" kalır, öneride yarım ağırlıkla sayılır. Servis yanıt vermezse (bağlantı, izin) sessizce atlanır.
const HAB_WMS = 'https://ows.emodnet-seabedhabitats.eu/geoserver/emodnet_view/wms', HAB_LAYER = 'eusm_eunis2019_group';
const HAB_TXT = {kayalik: 'Kaya', 'kum-kayalik': 'İri taneli (çakıl, kaba kum)', karma: 'Karışık', kum: 'Kum', camur: 'Çamur'};
function habitatClass(txt){
  const t = String(txt || '').toLowerCase();
  if (!t.trim()) return null;
  let zone = /bathyal|abyssal/.test(t) ? 'derin (batiyal)' : /offshore circalittoral/.test(t) ? 'açık sirkalitoral (derin kıta sahanlığı)' : /circalittoral/.test(t) ? 'sirkalitoral (ışığın azaldığı derinlik)' : /infralittoral/.test(t) ? 'infralitoral (ışıklı sığ su)' : '';
  let bottom = null, label = null;
  if (/posidonia|seagrass|cymodocea|zostera|caulerpa/.test(t)) { bottom = 'karma'; label = 'Posidonia / deniz çayırı'; }
  else if (/\brock|hard substrat|reef|coralligen|biogenic/.test(t)) bottom = 'kayalik';
  else if (/coarse/.test(t)) bottom = 'kum-kayalik';
  else if (/mixed/.test(t)) bottom = 'karma';
  else if (/muddy sand/.test(t)) bottom = 'kum';
  else if (/\bmud\b|sandy mud|\bmuds?\b/.test(t)) bottom = 'camur';
  else if (/sand/.test(t)) bottom = 'kum';
  // yalnız EUNIS 2019 kodu geldiyse (ör. MB55, MC15): 2. harf derinlik kuşağı, 3. hane taban (1 kaya · 2 biyojenik · 3 iri · 4 karışık · 5 kum · 6 çamur)
  const c = !bottom ? String(txt || '').match(/\bM([A-G])([1-6])/) : null;
  if (c) { bottom = {1: 'kayalik', 2: 'karma', 3: 'kum-kayalik', 4: 'karma', 5: 'kum', 6: 'camur'}[c[2]]; if (c[2] === '2') label = 'Biyojenik (çayır ya da resif)';
    if (!zone) zone = {A: 'kıyı (gelgit kuşağı)', B: 'infralitoral (ışıklı sığ su)', C: 'sirkalitoral (ışığın azaldığı derinlik)', D: 'açık sirkalitoral (derin kıta sahanlığı)', E: 'derin (batiyal)', F: 'derin (batiyal)', G: 'çok derin (abisal)'}[c[1]]; }
  if (!bottom && !zone) return null;
  return {bottom, label: label || (bottom ? HAB_TXT[bottom] : 'Bilinmiyor'), zone};
}
async function seabedAt(lat, lon){
  const d = 0.0006, q = 'service=WMS&version=1.1.1&request=GetFeatureInfo&layers=' + HAB_LAYER + '&query_layers=' + HAB_LAYER + '&styles=&srs=EPSG:4326&bbox=' +
    [lon - d, lat - d, lon + d, lat + d].map(v => v.toFixed(5)).join(',') + '&width=11&height=11&x=5&y=5&info_format=application/json&feature_count=3';
  const j = await fetchJ(HAB_WMS + '?' + q, null, 9000);
  const f = (j && j.features || []).find(x => x && x.properties) || null; if (!f) return null;
  const vals = Object.values(f.properties).filter(v => typeof v === 'string');
  const r = habitatClass(vals.join(' | ')); if (!r) return null;
  const desc = vals.filter(v => /[a-z]{4}/i.test(v) && v.length > 6).sort((a, b) => b.length - a.length)[0] || '';
  return Object.assign(r, {raw: desc.slice(0, 120)});
}
// Google (isteğe bağlı): anahtar varsa yer adları Maps JavaScript API'nin Geocoder'ından, altlık olarak Google haritası ve uydu.
// Google bir isteği reddederse sebebi GERR'e yazılır ve kullanıcıya Google Cloud'daki adıyla (İngilizce) gösterilir.
let GERR = null, GOK = false;
const G_ERR = {
  RefererNotAllowedMapError: 'Anahtarın Website restrictions listesi bu adresi kapsamıyor. Credentials → anahtar → Application restrictions → Websites: https://ktopdal.github.io/* yaz.',
  ApiNotActivatedMapError: 'Maps JavaScript API projede açık değil. APIs & Services → Library → Maps JavaScript API → Enable.',
  ApiTargetBlockedMapError: 'Anahtarın API restrictions listesinde Maps JavaScript API yok. Credentials → anahtar → API restrictions.',
  BillingNotEnabledMapError: 'Projede Billing açık değil. ☰ → Billing → projeyi bir billing account’a bağla.',
  InvalidKeyMapError: 'Anahtar geçersiz. Ayarlar → Harita’daki anahtarı Google Cloud’daki “Show key” ile karşılaştır.',
  MissingKeyMapError: 'Anahtar gönderilmedi.', ExpiredKeyMapError: 'Anahtarın süresi dolmuş.', DeletedApiProjectMapError: 'Google Cloud projesi silinmiş.',
  ProjectDeniedMapError: 'Google projeyi reddetti (hesap ya da Billing sorunu).', OverQuotaMapError: 'Günlük kota doldu.',
};
function gReason(msg){
  const m = String(msg || ''), seen = (/with referer:\s*(\S+)/i.exec(m) || [])[1];
  if (/billing/i.test(m)) return G_ERR.BillingNotEnabledMapError;
  if (/site or mobile application|referer|referrer|RefererNotAllowed/i.test(m)) return G_ERR.RefererNotAllowedMapError + (seen ? ' (Google’ın gördüğü adres: ' + seen + ')' : '');
  if (/API key is not authorized|ApiTargetBlocked/i.test(m)) return 'Anahtarın API restrictions listesinde Geocoding API yok. Credentials → anahtar → API restrictions → Geocoding API’yi ekle.';
  if (/API project is not authorized|has not been used|disabled|not activated|ApiNotActivated/i.test(m)) return 'Geocoding API projede açık değil. APIs & Services → Library → Geocoding API → Enable.';
  if (/OVER_QUERY_LIMIT|quota/i.test(m)) return 'Google kotası doldu.';
  if (/INVALID|invalid/.test(m)) return G_ERR.InvalidKeyMapError;
  return m ? 'Google: ' + m.slice(0, 160) : 'Google yanıt vermedi.';
}
function hookGoogleErrors(){
  if (hookGoogleErrors.on) return; hookGoogleErrors.on = true;
  window.gm_authFailure = () => { GOK = false; if (!GERR) GERR = 'Google anahtarı reddetti (site kısıtı, Billing ya da API kapalı).'; setTimeout(() => { if (GDIV && !GDIV.hidden) googleFallback(); }, 50); };
  const ce = console.error.bind(console);
  console.error = (...a) => { try { const m = String(a[0] || ''); const k = /Google Maps JavaScript API (?:error|warning): (\w+)/.exec(m);
    if (k && /Error$/.test(k[1])) { GOK = false; const u = /authorized:\s*(\S+)/.exec(m); GERR = (G_ERR[k[1]] || k[1]) + (u && k[1] === 'RefererNotAllowedMapError' ? ' (Google’ın gördüğü adres: ' + u[1] + ')' : ''); } } catch (e) {} ce(...a); };
}
function loadGoogle(){
  const key = (S.settings.gkey || '').trim(); if (!key) return Promise.reject(new Error('anahtar yok'));
  if (window.google && window.google.maps && window.google.maps.Geocoder) return Promise.resolve();
  if (loadGoogle.p && loadGoogle.key === key) return loadGoogle.p;
  loadGoogle.key = key; hookGoogleErrors();
  loadGoogle.p = new Promise((res, rej) => {
    window.__alyssaGm = () => res();
    const s = document.createElement('script'); s.async = true;
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&language=tr&region=TR&loading=async&callback=__alyssaGm';
    s.onerror = () => { loadGoogle.p = null; GERR = 'Google Maps betiği yüklenemedi (bağlantı).'; rej(new Error('Google yüklenemedi')); };
    document.head.appendChild(s);
    setTimeout(() => { if (!(window.google && window.google.maps && window.google.maps.Geocoder)) { loadGoogle.p = null; rej(new Error('zaman aşımı')); } }, 10000);
  });
  return loadGoogle.p;
}
async function googleName(lat, lon){
  await loadGoogle();
  let r;
  try {
    r = await Promise.race([new window.google.maps.Geocoder().geocode({location: {lat, lng: lon}}), new Promise((_, rej) => setTimeout(() => rej(new Error('zaman aşımı')), 8000))]);
  } catch (e) {
    const code = (e && (e.code || e.status)) || '';
    if (code === 'ZERO_RESULTS' || /ZERO_RESULTS/.test(String(e && e.message))) { GOK = true; GERR = null; return null; }
    GOK = false; GERR = gReason((code ? code + ' ' : '') + (e && e.message || '')); throw e;
  }
  GOK = true; GERR = null;
  const res = (r && r.results) || [];
  const comp = type => { for (const x of res) for (const c of (x.address_components || [])) if (c.types.includes(type)) return c.long_name; return null; };
  const local = comp('administrative_area_level_4') || comp('neighborhood') || comp('locality') || comp('administrative_area_level_2');
  const region = comp('administrative_area_level_1');
  return [local, region && region !== local ? region : null].filter(Boolean).join(', ') || null;
}
// Google durumu (Ayarlar → Harita'daki "Google'ı dene")
async function googleTest(){
  const L = loc() || {lat: 38.4, lon: 26.6};
  GERR = null;
  try { const n = await googleName(L.lat, L.lon); return {ok: true, txt: 'Google çalışıyor ✓' + (n ? ' · ' + n : '')}; }
  catch (e) { return {ok: false, txt: GERR || gReason(e && e.message)}; }
}
// En yakın kıyı çizgisi ve noktanın hangi tarafta kaldığı. OSM kıyı çizgisi yönlüdür: kara solda, deniz sağda.
// Bu yüzden "deniz mi kara mı" sorusunu derinlik servisi yanıt vermese de kesin cevaplar (kıyıya 6 km'den yakınsa).
function coastSide(p, ways){
  const kx = 111.32 * Math.cos(p.lat * Math.PI / 180), ky = 110.57;
  const P = c => [(c.lon - p.lon) * kx, (c.lat - p.lat) * ky];          // nokta orijinde, km
  const side = (a, b) => (b[0] - a[0]) * (-a[1]) - (b[1] - a[1]) * (-a[0]);   // > 0: nokta parçanın solunda (kara)
  let best = null;
  ways.forEach(g => { for (let i = 1; i < g.length; i++) {
    if (!g[i - 1] || !g[i]) continue;
    const a = P(g[i - 1]), b = P(g[i]), dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? -(a[0] * dx + a[1] * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(a[0] + t * dx, a[1] + t * dy);
    if (!best || d < best.d) best = {d, a, b, t, g, i};
  } });
  if (!best) return null;
  let left;
  if (best.t > 0 && best.t < 1) left = side(best.a, best.b) > 0;
  else {
    // en yakın yer bir köşe: iki komşu parçaya birlikte bakılır (sola dönen köşede iki parçanın da solu, sağa dönende biri yeter)
    const g = best.g, v = best.t <= 0 ? best.i - 1 : best.i;
    const pr = v > 0 && g[v - 1] ? P(g[v - 1]) : null, V = P(g[v]), nx = v < g.length - 1 && g[v + 1] ? P(g[v + 1]) : null;
    if (!pr || !nx) left = side(best.a, best.b) > 0;
    else { const l1 = side(pr, V) > 0, l2 = side(V, nx) > 0; const turn = (V[0] - pr[0]) * (nx[1] - V[1]) - (V[1] - pr[1]) * (nx[0] - V[0]); left = turn > 0 ? l1 && l2 : l1 || l2; }
  }
  const br = (Math.atan2(best.b[0] - best.a[0], best.b[1] - best.a[1]) * 180 / Math.PI + 360) % 360;
  return {sea: !left, km: best.d, facing: Math.round((br + 90) % 360)};
}
const PLACE_W = {city: 0.5, town: 0.6, village: 0.8, suburb: 0.9, island: 0.8, islet: 1, hamlet: 1.2, neighbourhood: 1.3, locality: 1.4};
// Yer bilgisi: dört kaynak aynı anda sorulur, her yanıt geldikçe kart güncellenir (onPart). En çok ~10 sn.
// yükselti (Open-Meteo Elevation, Copernicus 90 m): denizde 0, karada yükseklik; 3 m üstü kesin kara
async function elevAt(lat, lon){
  const j = await fetchJ(API_F.replace('/forecast', '/elevation') + '?latitude=' + lat.toFixed(5) + '&longitude=' + lon.toFixed(5), null, 7000);
  const v = j && Array.isArray(j.elevation) ? j.elevation[0] : null;
  return v == null || !isFinite(v) ? null : Number(v);
}
// deniz mi kara mı (sıra önemli; derinlik servisi karada da değer döndürebildiği için tek başına karar vermez):
// 1) OSM kıyı çizgisinin hangi tarafı (6 km içinde, en güvenilir) 2) yükselti 3 m üstü → kara
// 3) kıyı 6 km içinde yok: yakında adres varsa kara, yoksa açık deniz 4) yükselti + adres 5) yalnız adres
function seaDecide(s){
  const near = km => s.rv && !s.rv.error && s.rvKm != null && s.rvKm <= km;
  if (s.cs) return {sea: s.cs.sea, strong: true, by: 'kıyı çizgisi'};
  if (s.elev != null && s.elev >= 3) return {sea: false, strong: true, by: 'yükselti'};
  if (s.op && s.rv !== undefined) return {sea: !near(1.5), strong: s.elev != null && (s.elev <= 1) === !near(1.5), by: 'kıyıya uzaklık'};
  if (s.elev != null && s.rv !== undefined) return {sea: !near(0.35) && s.elev <= 1, strong: false, by: 'yükselti ve adres'};
  if (s.done && s.rv) return {sea: s.rv.error ? true : near(0.35) ? false : null, strong: false, by: 'adres'};
  return {sea: null, strong: false, by: ''};
}
const kindOf = (sea, coastKm) => sea === true ? 'deniz' : sea === false ? (coastKm != null && coastKm <= 0.3 ? 'kiyi' : 'kara') : null;
// Yer bilgisi: kaynaklar aynı anda sorulur, her yanıt geldikçe kart güncellenir (onPart). En çok ~10 sn.
// opt.lite: yalnız tür ve ad için (derinlik ve Google sorulmaz) — kayıtlı konumların türünü bulmakta kullanılır
async function placeInfo(lat, lon, onPart, opt){
  opt = opt || {};
  const p = {lat, lon}, useG = !opt.lite && !!S.settings.gkey;
  const R = {rv: undefined, op: undefined, el: undefined, dep: opt.lite ? null : undefined, g: useG ? undefined : null};
  const build = done => {
    const rv = R.rv, op = R.op, dep = R.dep, gname = R.g, elev = R.el;
    let land = null, local = null, rvKm = null;
    if (rv && !rv.error && rv.lat != null) {
      rvKm = distKm(p, {lat: +rv.lat, lon: +rv.lon}); const a = rv.address || {};
      local = a.village || a.town || a.suburb || a.neighbourhood || a.quarter || a.hamlet || a.city_district || a.municipality || a.district || a.city || null;
      const region = a.province || a.city || a.state;
      land = [local, region && region !== local ? region : null].filter(Boolean).join(', ') || rv.name || null;
    }
    const ways = [], places = [], feats = [];
    ((op && op.elements) || []).forEach(el => {
      const t = el.tags || {};
      if (t.natural === 'coastline' && el.geometry) { ways.push(el.geometry); return; }
      const c = el.center || (el.lat != null ? {lat: el.lat, lon: el.lon} : null); if (!c || !t.name) return;
      (t.place ? places : feats).push({name: t['name:tr'] || t.name, kind: t.place || t.natural, d: distKm(p, c)});
    });
    const cs = ways.length ? coastSide(p, ways) : null;
    const dec = seaDecide({cs, elev, rv, rvKm, op, done});
    const sea = dec.sea, coastKm = cs ? cs.km : null, kind = kindOf(sea, coastKm);
    let name = null;
    const pl = places.slice().sort((a, b) => a.d * (PLACE_W[a.kind] || 1) - b.d * (PLACE_W[b.kind] || 1))[0];
    const landName = gname || land || (places.slice().sort((a, b) => a.d - b.d)[0] || {}).name || null;
    if (sea === false) name = landName;       // karada ve kıyıda "açıkları" eki yok
    else if (sea === true) {
      const bay = feats.filter(f => f.kind === 'bay' && f.d <= 4).sort((a, b) => a.d - b.d)[0];
      const gl = gname ? gname.split(',')[0] : null;
      name = bay ? bay.name : gl ? gl + ' açıkları' : pl ? pl.name + ' açıkları' : land ? land.split(',')[0] + ' açıkları' : done ? 'Açık deniz' : null;
    } else name = landName || (pl ? pl.name : null);
    return {name, sea, kind, strong: dec.strong, by: dec.by, coastKm, facing: cs && cs.km <= 0.8 ? cs.facing : null,
      depth: sea === true && dep != null && dep > 0.5 ? Math.round(dep) : null, elev: elev != null ? Math.round(elev) : null, land, landName,
      src: gname ? 'Google' : 'OpenStreetMap', ok: !!(rv || op || elev != null || dep != null || gname), coastChecked: !!op, done,
      wait: ['rv', 'op', 'el', 'dep', 'g'].filter(k => R[k] === undefined).length};
  };
  const step = (k, pr) => pr.then(v => v, () => null).then(v => { R[k] = v; if (onPart) try { onPart(build(false)); } catch (e) {} });
  await Promise.all([step('rv', nominatim(lat, lon)), step('op', overpassNear(lat, lon)), step('el', elevAt(lat, lon)),
    opt.lite ? Promise.resolve() : step('dep', depthAt(lat, lon)), useG ? step('g', googleName(lat, lon)) : Promise.resolve()]);
  return build(true);
}
// ---- kayıtlı konumların türü: bir kez bulunur (özel paketin konumları ve elle seçilenler hariç)
// kara ya da kıyı çıkarsa ve karar güçlüyse haritadan gelmiş "… açıkları" adı düzeltilir
function applyKind(L, r){
  L.kind = r.kind; L.kindAuto = true; L.kindBy = r.by; L.kindAt = Date.now();
  if (r.coastKm != null) L.coastKm = Math.round(r.coastKm * 100) / 100;
  if (r.elev != null) L.elev = r.elev;
  if (r.kind === 'kiyi' && r.facing != null && (L.facing == null || L.facing === '')) L.facing = String(r.facing);
  if (r.kind !== 'deniz' && r.strong) {
    if (/ açıkları$/.test(L.name || '')) L.name = L.name.replace(/ açıkları$/, '');
    else if ((L.name === 'Açık deniz' || L.name === 'Harita noktası') && r.landName) L.name = r.landName;
  }
}
// tek seferde bir tarama; tarama sürerken çağrılırsa (yeni konum eklendi) bittikten sonra bir kez daha geçer
const KR = {p: null, again: false};
function ensureKinds(){
  if (PREVIEW || !S) return Promise.resolve();
  if (KR.p) { KR.again = true; return KR.p; }
  KR.p = (async () => { do { KR.again = false; await kindPass(); } while (KR.again); })().finally(() => { KR.p = null; });
  return KR.p;
}
async function kindPass(){
  for (const L of Object.values(S.locations)) {
    if (!S.locations[L.id] || L.kind || L.pkg || L.kindTried) continue;
    const r = await placeInfo(L.lat, L.lon, null, {lite: true}).catch(() => null);
    if (!S.locations[L.id] || L.kind) continue;           // bu arada silindi ya da elle seçildi
    if (r && r.ok) L.kindTried = Date.now();               // ağ yoksa sonraki açılışta yeniden denenir
    if (!r || !r.kind) { persistQuiet(); continue; }
    const wasActive = S.active === L.id, before = locKind(L);
    applyKind(L, r); persist();
    if (wasActive && (before === 'kara') !== (L.kind === 'kara')) loadWeather(true);   // yalnız karaya geçiş/çıkış veri çekimini değiştirir
    renderAll(); if (ui.sheet === 'konumlar') openMore('konumlar', true);
  }
}
// ---- harita sayfası
function sheetMap(){
  return '<div class="bar"><button class="btn" type="button" data-close>Geri</button><h3 id="sheetTitle">Harita</h3><button class="btn" type="button" data-mapact="list">Liste</button></div>' +
    '<div class="mapwrap"><div id="map" role="application" aria-label="Harita: bir noktaya dokun"></div>' +
    '<p class="mapmsg" id="mapMsg">Harita yükleniyor…</p>' +
    '<div class="maptools"><button class="btn" type="button" data-mapact="layers" aria-label="Katmanlar">Katmanlar</button><button class="btn" type="button" data-mapact="gps" aria-label="Bulunduğum yer">⌖</button></div>' +
    '<div class="maplayers" id="mapLayers" hidden></div>' +
    '<div class="mapcard" id="mapCard" hidden></div></div>';
}
async function openMap(){
  ui.sheet = 'harita';
  openSheet(sheetMap());
  try { await loadLeaflet(); } catch (e) { const m = $('mapMsg'); if (m) m.textContent = 'Harita yüklenemedi; internet bağlantısını kontrol et.'; return; }
  if (ui.sheet !== 'harita' || !$('map')) return;
  initMap();
}
function initMap(){
  const LL = LF(); const cur = loc(); const v = S.settings.mapView;
  if (MAP) { try { MAP.remove(); } catch (e) {} MAP = null; }
  GMAP = null; GDIV = null;
  const center = cur ? [cur.lat, cur.lon] : v ? [v.lat, v.lon] : [38.4, 26.6];
  MAP = LL.map('map', {zoomControl: false, attributionControl: true}).setView(center, cur ? 11 : v ? v.z : 8);
  LL.control.zoom({position: 'topright'}).addTo(MAP);
  MAP.attributionControl.setPrefix(false);
  MAPL = {base: null, over: {}, locs: LL.layerGroup(), catches: LL.layerGroup(), grup: LL.layerGroup(), drift: LL.layerGroup(), pick: null};
  const cfg = mapCfg(); setBase(cfg.base); ['seamark', 'depth', 'contours', 'habitat', 'substrate'].forEach(k => setOver(k, cfg[k]));
  drawLocs(); drawCatches(); drawDrift();
  if (cfg.locs) MAPL.locs.addTo(MAP); if (cfg.catches) MAPL.catches.addTo(MAP); if (cfg.drift) MAPL.drift.addTo(MAP);
  if (ui.mapDrift) { ui.mapDrift = false; const Lc = loc(); if (Lc) MAP.setView([Lc.lat, Lc.lon], 14); }
  if (cfg.grup && grpOn()) { MAPL.grup.addTo(MAP); drawGroup(); grpFetch().then(drawGroup); }
  MAP.on('click', e => pickPoint(e.latlng.lat, e.latlng.lng));
  MAP.on('moveend', () => { const c = MAP.getCenter(); S.settings.mapView = {lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), z: MAP.getZoom()}; persistQuiet(); });
  const m = $('mapMsg'); if (m) m.hidden = true;
  setTimeout(() => { if (MAP) MAP.invalidateSize(); }, 80);
}
function closeMap(){ if (MAP) { try { MAP.remove(); } catch (e) {} } MAP = null; MAPL = null; MPICK = null; GMAP = null; GDIV = null; }
const BASES = {
  osm: () => LF().tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> katkıcıları'}),
  uydu: () => LF().tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom: 19, attribution: 'Uydu © Esri, Maxar, Earthstar Geographics'}),
};
const OVERS = {
  seamark: () => LF().tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {maxZoom: 18, attribution: 'Deniz işaretleri © <a href="https://www.openseamap.org" target="_blank" rel="noopener">OpenSeaMap</a>'}),
  depth: () => LF().tileLayer.wms('https://ows.emodnet-bathymetry.eu/wms', {layers: 'emodnet:mean_multicolour', format: 'image/png', transparent: true, opacity: 0.55, attribution: 'Derinlik © EMODnet Bathymetry'}),
  contours: () => LF().tileLayer.wms('https://ows.emodnet-bathymetry.eu/wms', {layers: 'emodnet:contours', format: 'image/png', transparent: true, attribution: 'Derinlik eğrileri © EMODnet Bathymetry'}),
  habitat: () => LF().tileLayer.wms(HAB_WMS, {layers: HAB_LAYER, format: 'image/png', transparent: true, opacity: 0.55, attribution: 'Deniz tabanı © EMODnet Seabed Habitats (EUSeaMap)'}),
  substrate: () => LF().tileLayer.wms('https://drive.emodnet-geology.eu/geoserver/wms', {layers: 'cp_wp3_seabed_substrate_folk_7', format: 'image/png', transparent: true, opacity: 0.6, attribution: 'Dip türü © EMODnet Geology'}),
};
const OVER_TXT = {seamark: 'Deniz işaretleri (şamandıra, fener, liman)', depth: 'Derinlik renkleri', contours: 'Derinlik eğrileri', habitat: 'Deniz tabanı (EUSeaMap: kaya, kum, çamur, çayır; bütün Akdeniz, tahmini)', drift: 'Sürüklenme çizgisi (seçili nokta; Fishing’de seçilen gün ve bölüm)', substrate: 'Dip türü ölçümü (AB suları; Türk kıyılarında çoğunlukla yok)', locs: 'Konumlarım', catches: 'Avlarım', grup: 'Grup avları (ortak harita)'};
function setBase(k){
  if (!MAP) return; if (MAPL.base) { MAP.removeLayer(MAPL.base); MAPL.base = null; }
  if (G_TYPES[k] && S.settings.gkey) { setGoogleBase(k); return; }
  hideGoogle(); MAPL.base = (BASES[G_TYPES[k] ? 'osm' : k] || BASES.osm)().addTo(MAP); MAPL.base.bringToBack();
}
// Google altlığı: Leaflet'in altına eşzamanlı bir Google haritası (Maps JavaScript API) konur; dokunuşlar ve işaretler Leaflet'te kalır
let GMAP = null, GDIV = null;
const G_TYPES = {g: 'roadmap', gsat: 'hybrid'};
function gSync(){ if (!GMAP || !MAP) return; const c = MAP.getCenter(); GMAP.moveCamera({center: {lat: c.lat, lng: c.lng}, zoom: MAP.getZoom()}); }
function gZoomAnim(e){ if (GMAP && e && e.center) GMAP.moveCamera({center: {lat: e.center.lat, lng: e.center.lng}, zoom: e.zoom}); }
function hideGoogle(){ if (GDIV) GDIV.hidden = true; if (MAP) MAP.getContainer().classList.remove('hasg'); }
function googleFallback(){
  if (!MAP || !MAPL || MAPL.base) return;
  hideGoogle(); MAPL.base = BASES.osm().addTo(MAP); MAPL.base.bringToBack();
  toast('Google haritası açılamadı: ' + (GERR || 'bağlantı yok') + ' Şimdilik OpenStreetMap gösteriliyor.');
  if (!$('mapLayers').hidden) renderLayers();
}
async function setGoogleBase(k){
  const box = MAP.getContainer();
  try { await loadGoogle(); } catch (e) { if (MAP && MAP.getContainer() === box) googleFallback(); return; }
  if (!MAP || MAP.getContainer() !== box || mapCfg().base !== k || MAPL.base) return;
  if (!GDIV || !box.contains(GDIV)) {
    GDIV = document.createElement('div'); GDIV.className = 'gbase'; box.insertBefore(GDIV, box.firstChild);
    const c = MAP.getCenter();
    GMAP = new window.google.maps.Map(GDIV, {center: {lat: c.lat, lng: c.lng}, zoom: MAP.getZoom(), mapTypeId: G_TYPES[k], disableDefaultUI: true, gestureHandling: 'none',
      keyboardShortcuts: false, clickableIcons: false, isFractionalZoomEnabled: true, backgroundColor: 'transparent'});
    MAP.on('move zoom resize', gSync); MAP.on('zoomanim', gZoomAnim);
  } else GMAP.setMapTypeId(G_TYPES[k]);
  GDIV.hidden = false; box.classList.add('hasg'); gSync();
  if (GERR && !GOK) googleFallback();
}
function setOver(k, on){
  if (!MAP) return;
  if (k === 'locs' || k === 'catches' || k === 'grup' || k === 'drift') { const g = MAPL[k]; if (on) { g.addTo(MAP); if (k === 'grup') grpFetch().then(drawGroup); if (k === 'drift') drawDrift(); } else MAP.removeLayer(g); return; }
  if (on && !MAPL.over[k]) MAPL.over[k] = OVERS[k]().addTo(MAP);
  if (!on && MAPL.over[k]) { MAP.removeLayer(MAPL.over[k]); delete MAPL.over[k]; }
}
function renderLayers(){
  const cfg = mapCfg(), el = $('mapLayers'); if (!el) return;
  const bases = [['osm', 'Harita'], ['uydu', 'Uydu']].concat(S.settings.gkey ? [['g', 'Google'], ['gsat', 'Google uydu']] : []);
  el.innerHTML = '<b>Altlık</b><div class="seg wrapseg">' + bases.map(([v, t]) => '<button class="btn small" type="button" data-mapbase="' + v + '" aria-pressed="' + (cfg.base === v) + '">' + t + '</button>').join('') + '</div>' +
    (G_TYPES[cfg.base] && GERR ? '<p class="note mc-g">Google kullanılamadı: ' + esc(GERR) + '</p>' : '') + (!S.settings.gkey ? '<p class="note">Google haritası için Ayarlar → Harita’ya Google anahtarını yaz.</p>' : '') +
    '<b>Katmanlar</b>' + Object.keys(OVER_TXT).filter(k => k !== 'grup' || grpOn()).map(k => '<label class="chk"><input type="checkbox" data-maplayer="' + k + '"' + (cfg[k] ? ' checked' : '') + '> ' + esc(OVER_TXT[k]) + '</label>').join('') +
    (cfg.habitat ? '<details class="hableg"><summary class="note">Deniz tabanı lejantı (EUSeaMap)</summary><img alt="EUSeaMap lejantı" loading="lazy" src="' + HAB_WMS + '?service=WMS&amp;version=1.1.1&amp;request=GetLegendGraphic&amp;format=image/png&amp;layer=' + HAB_LAYER + '" onerror="this.replaceWith(document.createTextNode(\'Lejant alınamadı; noktaya dokun, sınıfı yazılır.\'))"></details><p class="note">Noktaya dokununca tabanın sınıfı kartta yazılır (kaya, kum, çamur, çayır).</p>' : '') +
    '<p class="note">Derinlik ve deniz tabanı EMODnet verisidir (taban modelle tahmin); seyir için resmî harita yerine geçmez.</p>';
}
function mapLayerSet(k, v){ const cfg = mapCfg(); cfg[k] = v; S.settings.map = cfg; persistQuiet(); if (k === 'base') setBase(v); else setOver(k, v); renderLayers(); }
// ---- işaretler
const pinIcon = (cls, label) => LF().divIcon({className: 'mpin ' + cls, html: '<svg viewBox="0 0 24 32" width="24" height="32" aria-hidden="true"><path d="M12 31s10-11.3 10-19A10 10 0 0 0 2 12c0 7.7 10 19 10 19z"/><circle cx="12" cy="12" r="3.8"/></svg>' + (label ? '<span>' + esc(label) + '</span>' : ''), iconSize: [24, 32], iconAnchor: [12, 31]});
function drawLocs(){
  if (!MAPL) return; MAPL.locs.clearLayers();
  Object.values(S.locations).forEach(Lc => {
    const m = LF().marker([Lc.lat, Lc.lon], {icon: pinIcon(S.active === Lc.id ? 'act' : 'loc', Lc.name), title: Lc.name, keyboard: false});
    m.on('click', e => { if (e.originalEvent) LF().DomEvent.stopPropagation(e.originalEvent); locCard(Lc.id); });
    MAPL.locs.addLayer(m);
  });
}
function drawCatches(){
  if (!MAPL) return; MAPL.catches.clearLayers();
  CATCHES.forEach(c => {
    if (!c.loc || c.loc.lat == null) return; const l = catchLine(c);
    const m = LF().circleMarker([c.loc.lat, c.loc.lon], {radius: 7, weight: 2, className: 'mcatch'});
    m.bindPopup('<b>' + esc(l.sp) + '</b><br>' + l.d.getDate() + ' ' + MON3[l.d.getMonth()] + ' ' + l.d.getFullYear() + (l.bits ? ' · ' + esc(l.bits) : '') + (c.rig ? '<br>' + esc(rigShort(c.rig)) : ''));
    MAPL.catches.addLayer(m);
  });
}
function drawGroup(){
  if (!MAPL || !MAP) return; MAPL.grup.clearLayers();
  grpCatches().forEach(c => {
    const m = LF().circleMarker([c.lat, c.lon], {radius: 9, weight: 2, className: 'mgrp' + (c.mine ? ' me' : '')});
    const d = new Date(c.t);
    m.bindPopup('<b>' + esc(c.member) + '</b> · ' + esc(c.spName || c.sp) + (c.n > 1 ? ' · ' + c.n + ' adet' : '') + (c.kg ? ' · ' + fmtNum(c.kg, 2) + ' kg' : '') + (c.cm ? ' · ' + fmtNum(c.cm, 1) + ' cm' : '') +
      '<br>' + d.getDate() + ' ' + MON3[d.getMonth()] + ' ' + d.getFullYear() + (c.rig ? '<br>' + esc(c.rig) : '') + (c.bait ? ' · yem: ' + esc(c.bait) : '') + '<br><small>yer ±' + (c.km || 1) + ' km kare</small>');
    MAPL.grup.addLayer(m);
  });
}
// ---- nokta kartı
async function pickPoint(lat, lon){
  if (!MAP) return;
  if (MAPL.pick) MAPL.pick.setLatLng([lat, lon]); else MAPL.pick = LF().marker([lat, lon], {icon: pinIcon('pick'), keyboard: false}).addTo(MAP);
  const my = ++PICK_ID; MPICK = {lat, lon, busy: true};
  $('mapLayers').hidden = true; renderPick();
  seabedAt(lat, lon).then(bed => { if (my === PICK_ID && MPICK && bed) { MPICK.bed = bed; renderPick(); } }, () => {});
  const info = await placeInfo(lat, lon, part => { if (my === PICK_ID && MPICK) { Object.assign(MPICK, part, {busy: true}); renderPick(); } }).catch(() => null);
  if (my !== PICK_ID || !MPICK) return;
  Object.assign(MPICK, info || {}, {busy: false, failed: !info || !info.ok}); renderPick();
}
function coordBlock(lat, lon){
  return '<div class="mc-c"><span class="mono">' + ddm(lat, 'K', 'G') + '&nbsp; ' + ddm(lon, 'D', 'B') + '</span><button class="btn small" type="button" data-mapact="copy">Kopyala</button></div>' +
    '<div class="mc-d mono">' + lat.toFixed(5) + '°, ' + lon.toFixed(5) + '°</div>';
}
const gmapsUrl = (lat, lon) => 'https://www.google.com/maps/search/?api=1&query=' + lat.toFixed(6) + ',' + lon.toFixed(6);
function renderPick(){
  const p = MPICK, el = $('mapCard'); if (!el || !p) return;
  const facts = [p.kind ? KIND_TXT[p.kind] : '', p.coastKm != null ? (p.coastKm < 0.05 ? 'kıyıda' : 'kıyıya ' + kmTxt(p.coastKm)) : p.sea && p.coastChecked ? 'kıyı 6 km’den uzak' : '',
    p.depth != null ? 'derinlik ≈ ' + p.depth + ' m (EMODnet)' : '', p.bed && p.sea !== false ? 'taban ≈ ' + p.bed.label + ' (EUSeaMap)' : '', p.sea === false && p.elev != null && p.elev >= 1 ? 'yükselti ≈ ' + p.elev + ' m' : '',
    p.facing != null ? 'kıyının bakışı ' + dir8(p.facing) : ''].filter(Boolean);
  const kNote = !p.busy && p.kind === 'kara' ? '<div class="mc-k">Kara noktası: yalnız hava durumu (balık, rig ve deniz verisi yok).</div>' :
    !p.busy && p.kind === 'kiyi' ? '<div class="mc-k">Kıyı noktası: kıyıdan av; deniz verisi en yakın deniz noktasından.</div>' : '';
  const info = p.busy ? (facts.length ? facts.join(' · ') + ' · ' : '') + 'aranıyor…' : p.failed ? 'Yer adı alınamadı (bağlantı yok ya da servisler yanıt vermedi). Koordinatlar doğru; yine kaydedebilirsin.' : facts.join(' · ');
  const gNote = !p.busy && S.settings.gkey && GERR ? '<div class="mc-g">Google kullanılamadı: ' + esc(GERR) + '</div>' : '';
  el.innerHTML = '<div class="mc-h"><b>' + esc(p.name || 'Seçilen nokta') + (p.busy && p.name ? ' …' : '') + '</b><button class="x" type="button" data-mapact="close" aria-label="Kapat">×</button></div>' +
    coordBlock(p.lat, p.lon) + '<div class="mc-i">' + esc(info) + '</div>' + kNote + gNote +
    (ui.mapFor === 'wizard' && WZ ? '<div class="row"><button class="btn primary" type="button" data-mapact="wzuse">Rig Atölyesinde kullan</button></div>' : '') +
    '<div class="row"><button class="btn' + (ui.mapFor === 'wizard' ? '' : ' primary') + '" type="button" data-mapact="forecast">' + (p.kind === 'kara' ? 'Bu noktanın hava durumu' : 'Bu noktanın tahmini') + '</button><button class="btn" type="button" data-mapact="save">Kaydet</button>' +
    '<a class="btn" href="' + gmapsUrl(p.lat, p.lon) + '" target="_blank" rel="noopener">Google Haritalar</a></div>';
  el.hidden = false;
}
async function locCard(id){
  const Lc = S.locations[id], el = $('mapCard'); if (!Lc || !el) return;
  MPICK = {lat: Lc.lat, lon: Lc.lon, id, name: Lc.name};
  if (MAPL && MAPL.pick) { MAP.removeLayer(MAPL.pick); MAPL.pick = null; }
  const k = locKind(Lc);
  const draw = dep => {
    el.innerHTML = '<div class="mc-h"><b>' + esc(locLabel(Lc)) + '</b>' + (S.active === id ? '<span class="chip A">Seçili</span>' : '') + '<button class="x" type="button" data-mapact="close" aria-label="Kapat">×</button></div>' +
      coordBlock(Lc.lat, Lc.lon) + (k === 'kara' ? '<div class="mc-i">Kara · yalnız hava durumu' + (Lc.elev != null ? ' · yükselti ≈ ' + Lc.elev + ' m' : '') + '</div>' : '<div class="mc-i">' + KIND_TXT[k] + ' · dip: ' + esc(BOTTOM_TXT[Lc.bottom || ''] || 'bilinmiyor') + ' · derinlik: ' + (Lc.depth ? esc(Lc.depth) + ' m' : 'yazılmamış') +
      (dep != null && !Lc.depth ? ' · EMODnet ≈ ' + dep + ' m <button class="linkbtn" type="button" data-mapact="setdepth" data-dep="' + dep + '">derinlik olarak yaz</button>' : '') +
      (!Lc.bottom && Lc.bottomEst ? ' · taban tahmini: ' + esc(Lc.bottomEstTxt || BOTTOM_TXT[Lc.bottomEst]) + ' <button class="linkbtn" type="button" data-mapact="setbed">dip olarak yaz</button>' : '') + '</div>') +
      (ui.mapFor === 'wizard' && WZ && k !== 'kara' ? '<div class="row"><button class="btn primary" type="button" data-mapact="wzuse">Rig Atölyesinde kullan</button></div>' : '') +
      '<div class="row">' + (S.active === id ? '<button class="btn primary" type="button" data-mapact="today">Tahmine dön</button>' : '<button class="btn primary" type="button" data-mapact="use">' + (k === 'kara' ? 'Seç · hava durumu' : 'Seç ve tahmin') + '</button>') +
      '<a class="btn" href="' + gmapsUrl(Lc.lat, Lc.lon) + '" target="_blank" rel="noopener">Google Haritalar</a></div>';
    el.hidden = false;
  };
  draw(null);
  if (!Lc.bottom && !Lc.bottomEst && k !== 'kara') seabedAt(Lc.lat, Lc.lon).then(bed => { if (bed && bed.bottom && S.locations[id] && !Lc.bottom) { setBedEst(Lc, bed); persistQuiet(); if (MPICK && MPICK.id === id) draw(null); } }, () => {});
  if (!Lc.depth && k !== 'kara') { const d = await depthAt(Lc.lat, Lc.lon).catch(() => null); if (MPICK && MPICK.id === id && d != null && d > 0.5) draw(Math.round(d)); }
}
async function mapAct(a, b){
  const p = MPICK;
  if (a === 'list') { openMore('konumlar'); return; }
  if (a === 'layers') { const el = $('mapLayers'); renderLayers(); el.hidden = !el.hidden; if (!el.hidden) $('mapCard').hidden = true; return; }
  if (a === 'gps') {
    if (!navigator.geolocation) { toast('Konum servisi yok'); return; }
    toast('Konum alınıyor…');
    navigator.geolocation.getCurrentPosition(g => { if (!MAP) return; MAP.setView([g.coords.latitude, g.coords.longitude], Math.max(MAP.getZoom(), 12)); pickPoint(g.coords.latitude, g.coords.longitude); }, () => toast('Konum izni verilmedi'), {enableHighAccuracy: true, timeout: 15000});
    return;
  }
  if (a === 'close') { $('mapCard').hidden = true; if (MAPL && MAPL.pick) { MAP.removeLayer(MAPL.pick); MAPL.pick = null; } MPICK = null; return; }
  if (!p) return;
  if (a === 'copy') {
    const txt = ddm(p.lat, 'K', 'G') + ' ' + ddm(p.lon, 'D', 'B');
    try { await navigator.clipboard.writeText(txt); toast('Kopyalandı: ' + txt); } catch (e) { toast(txt); }
    return;
  }
  if (a === 'setbed' && p.id && S.locations[p.id]) { const Lc = S.locations[p.id]; if (Lc.bottomEst) { Lc.bottom = Lc.bottomEst; persist(); indexAll(); renderAll(); locCard(p.id); toast('Dip: ' + BOTTOM_TXT[Lc.bottom]); } return; }
  if (a === 'setdepth' && p.id && S.locations[p.id]) { S.locations[p.id].depth = String(b.dataset.dep); persist(); renderAll(); locCard(p.id); toast('Derinlik kaydedildi'); return; }
  if (a === 'use' && p.id) { S.active = p.id; persist(); WX = null; closeSheet(); show('bugun'); renderAll(); loadWeather(); toast('Konum değişti'); return; }
  if (a === 'today') { closeSheet(); show('bugun'); return; }
  // v0.24: Rig Atölyesi'nden açıldıysa noktayı kaydet ve sihirbaza dön
  if (a === 'wzuse') {
    if (p.kind === 'kara' && !p.id) { toast('Kara noktası: denizde bir nokta seç'); return; }
    const id = p.id || mapSavePoint(p, false);
    ui.mapFor = null; ui.back = null;
    if (!WZ) { closeSheet(); return; }
    wzUseLoc(id); persist(); ui.sheet = 'wizard'; renderWizard(); toast(locLabel(S.locations[id]) + ' · Rig Atölyesi'); return;
  }
  // v0.28.6: kaydetmeden önce ad sor (haritadaki yer adı önerilir)
  if (a === 'save' && !p.id && !b.dataset.named) {
    const card = $('mapCard'); card.hidden = false;
    card.innerHTML = '<div class="stack"><b>Konumun adı</b><label class="f wide">Ad<input id="mpName" value="' + esc(p.name || '') + '" placeholder="Ör. Sığacık açığı" autocomplete="off"></label>' +
      (p.name ? '<p class="note">Haritadaki adı önerildi; istersen değiştir.</p>' : '') +
      '<div class="row"><button class="btn primary" type="button" data-mapact="save" data-named="1">Kaydet</button><button class="btn" type="button" data-mapact="namecancel">Vazgeç</button></div></div>';
    const inp = $('mpName'); if (inp) { inp.focus(); inp.select(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') card.querySelector('[data-named]').click(); }); }
    return;
  }
  if (a === 'namecancel') { pickPoint(p.lat, p.lon); return; }
  if (a === 'save' || a === 'forecast') {
    const nm = b.dataset.named && $('mpName') ? $('mpName').value.trim() : '';
    if (nm) p.name = nm;
    const hadActive = !!loc();
    const id = mapSavePoint(p, a === 'forecast');
    if (nm && S.locations[id]) S.locations[id].name = nm;
    if (a === 'forecast') { S.active = id; persist(); WX = null; closeSheet(); show('bugun'); renderAll(); loadWeather(); toast(locLabel(S.locations[id]) + ' tahmini'); return; }
    persist(); drawLocs(); renderAll(); toast('Konumlarına kaydedildi: ' + S.locations[id].name);
    if (!hadActive || S.active === id) { WX = null; loadWeather(true); }   // ilk konumsa tahmin hemen gelsin
    locCard(id);
  }
}
// haritada seçilen noktayı konumlara kaydet (0,2 km içinde kayıtlı nokta varsa o kullanılır)
function mapSavePoint(p, activate){
  const n = nearestLoc(p); let id = n && n.d <= 0.2 ? n.L.id : null;
  if (!id) {
    id = addLocation(p.name || 'Harita noktası', +p.lat.toFixed(6), +p.lon.toFixed(6), '', p.depth != null ? String(p.depth) : '', activate, true);
    const NL = S.locations[id];
    if (p.kind && !p.busy) applyKind(NL, p); else NL.kindTried = null;   // tür biliniyorsa hemen; yoksa arka planda bulunur
    if (p.facing != null && (NL.facing == null || NL.facing === '')) NL.facing = String(p.facing);
    if (p.bed && p.bed.bottom && p.sea !== false) setBedEst(NL, p.bed);
    if (!NL.kind) setTimeout(ensureKinds, 50);
  }
  return id;
}
// konumun taban tahmini (EUSeaMap): dip seçilmemişse öneride yarım ağırlıkla kullanılır
function setBedEst(L, bed){ L.bottomEst = bed.bottom; L.bottomEstTxt = bed.label + (bed.zone ? ', ' + bed.zone : ''); L.bottomEstAt = Date.now(); }
// ---- R4 · sürüklenme çizgisi (v0.22): noktanın üstünden geçmek için başlama yeri ve sürüklenme yönü
function geoDest(lat, lon, brg, m){
  const R = 6371000, d = m / R, t = brg * Math.PI / 180, p1 = lat * Math.PI / 180, l1 = lon * Math.PI / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 * 180 / Math.PI, l2 * 180 / Math.PI];
}
// Fishing'de seçili gün ve bölüm: bölüm şu an sürüyorsa şimdiki saat, değilse bölümün en iyi penceresi
function driftNow(){
  const L = loc(); if (!L || !WX || locKind(L) === 'kara' || shoreMode()) return null;
  const ds = days(); const dd = ds.find(d => d.key === ui.fday) || ds[0]; if (!dd) return null;
  const part = ui.fpart || 'gun', [A, B] = partRange(dd, part), now = Date.now();
  let x = null, lbl = '';
  if (now >= A && now <= B) { x = hourRec(new Date()); lbl = 'şimdi'; }
  if (!x) { const w = bestWindows(dd, part, 1)[0]; x = w ? w.x : refHour(dd); lbl = w ? winTxt(w) + ' en iyi pencere' : ''; }
  const dr = x ? driftAt(x) : null; if (!dr || !dr.known) return null;
  return {L, dr, off: startOffset(dr, locDepth()), lbl};
}
const arrowIcon = deg => LF().divIcon({className: 'mdarrow', html: '<svg viewBox="0 0 24 24" width="26" height="26" style="transform:rotate(' + Math.round(deg) + 'deg)" aria-hidden="true"><path d="M12 2l7 14h-5v6h-4v-6H5z" fill="#DC143C" stroke="#fff" stroke-width="1.2"/></svg>', iconSize: [26, 26], iconAnchor: [13, 13]});
function drawDrift(){
  if (!MAPL || !MAPL.drift) return; MAPL.drift.clearLayers();
  const z = driftNow(); if (!z) return;
  const LL = LF(), L = z.L, dr = z.dr, P = [L.lat, L.lon];
  if (dr.anchored || !z.off) {
    if (dr.cur == null || dr.curDir == null) return;
    const E = geoDest(L.lat, L.lon, dr.curDir, 300);
    MAPL.drift.addLayer(LL.polyline([P, E], {color: '#DC143C', weight: 3, dashArray: '6 6', interactive: false}));
    MAPL.drift.addLayer(LL.marker(E, {icon: arrowIcon(dr.curDir), keyboard: false, interactive: false, title: 'Akıntı ' + f1(dr.cur) + ' kn ' + dir8(dr.curDir) + ' yönüne'}));
    return;
  }
  const S0 = geoDest(L.lat, L.lon, z.off.from, z.off.m), E = geoDest(L.lat, L.lon, dr.dir, Math.max(150, z.off.m * 0.6));
  MAPL.drift.addLayer(LL.polyline([S0, P, E], {color: '#DC143C', weight: 3, dashArray: '8 6', interactive: false}));
  MAPL.drift.addLayer(LL.marker(E, {icon: arrowIcon(dr.dir), keyboard: false, interactive: false}));
  const st = LL.marker(S0, {icon: LL.divIcon({className: 'mdstart', html: '<span>Başla</span>', iconSize: [52, 24], iconAnchor: [26, 12]}), keyboard: false, title: 'Buradan başla'});
  st.bindPopup('<b>Buradan başla</b><br>Noktanın ~' + z.off.m + ' m ' + dir8(z.off.from) + ' tarafı. Tekne ' + f1(dr.sog) + ' kn ile ' + dir8(dr.dir) + ' yönüne sürüklenir; ' +
    'kurşun ~' + z.off.sinkS + ' sn’de dibe iner.' + (z.lbl ? '<br><small>' + esc(z.lbl) + '</small>' : ''));
  MAPL.drift.addLayer(st);
}
