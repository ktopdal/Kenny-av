// ---------------------------------------------------------------- 77 · Harita: nokta seç, yer adı, derece-dakika koordinat, derinlik, katmanlar
// Leaflet (BSD-2) uygulamayla birlikte gelir (vendor/leaflet), harita ilk açılışta yüklenir.
// Altlık: OpenStreetMap ya da Esri uydu · Katmanlar: OpenSeaMap deniz işaretleri, EMODnet derinlik renkleri ve eğrileri, EMODnet dip türü (AB suları)
// Yer adı: OpenStreetMap Nominatim (karada) ve Overpass (denizde en yakın yer, koy, kıyıya uzaklık) · Derinlik: EMODnet Bathymetry
const MAP_DEF = {base: 'osm', seamark: true, depth: false, contours: true, substrate: false, locs: true, catches: true, grup: true};
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
async function placeInfo(lat, lon, onPart){
  const p = {lat, lon}, R = {rv: undefined, op: undefined, dep: undefined, g: S.settings.gkey ? undefined : null};
  const build = done => {
    const rv = R.rv, op = R.op, dep = R.dep, gname = R.g;
    let land = null, rvKm = null;
    if (rv && !rv.error && rv.lat != null) {
      rvKm = distKm(p, {lat: +rv.lat, lon: +rv.lon}); const a = rv.address || {};
      const local = a.village || a.town || a.suburb || a.neighbourhood || a.quarter || a.hamlet || a.city_district || a.municipality || a.district || a.city;
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
    // deniz mi kara mı: 1) kıyı çizgisinin hangi tarafı (en güvenilir) 2) derinlik 3) kıyı 6 km'de yoksa: yakında adres varsa kara, yoksa açık deniz 4) yalnız Nominatim
    let sea = null;
    if (cs) sea = cs.sea;
    else if (dep != null && dep > 0.5) sea = true;
    else if (op && (rv !== undefined || done)) sea = !(rv && !rv.error && rvKm != null && rvKm < 1.5);
    else if (done && rv !== undefined && rv !== null) sea = rv.error ? true : rvKm > 0.35;
    let name = null;
    const pl = places.slice().sort((a, b) => a.d * (PLACE_W[a.kind] || 1) - b.d * (PLACE_W[b.kind] || 1))[0];
    if (sea === false) name = gname || land || (places.slice().sort((a, b) => a.d - b.d)[0] || {}).name || null;
    else if (sea === true) {
      const bay = feats.filter(f => f.kind === 'bay' && f.d <= 4).sort((a, b) => a.d - b.d)[0];
      const gl = gname ? gname.split(',')[0] : null;
      name = bay ? bay.name : gl ? gl + ' açıkları' : pl ? pl.name + ' açıkları' : land ? land.split(',')[0] + ' açıkları' : done ? 'Açık deniz' : null;
    } else name = gname || land || (pl ? pl.name : null);
    const coastKm = cs ? cs.km : null;
    return {name, sea, coastKm, facing: cs && cs.km <= 0.8 ? cs.facing : null, depth: dep != null && dep > 0.5 ? Math.round(dep) : null, land,
      src: gname ? 'Google' : 'OpenStreetMap', ok: !!(rv || op || dep != null || gname), coastChecked: !!op, done,
      wait: ['rv', 'op', 'dep', 'g'].filter(k => R[k] === undefined).length};
  };
  const step = (k, pr) => pr.then(v => v, () => null).then(v => { R[k] = v; if (onPart) try { onPart(build(false)); } catch (e) {} });
  await Promise.all([step('rv', nominatim(lat, lon)), step('op', overpassNear(lat, lon)), step('dep', depthAt(lat, lon)),
    S.settings.gkey ? step('g', googleName(lat, lon)) : Promise.resolve()]);
  return build(true);
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
  MAPL = {base: null, over: {}, locs: LL.layerGroup(), catches: LL.layerGroup(), grup: LL.layerGroup(), pick: null};
  const cfg = mapCfg(); setBase(cfg.base); ['seamark', 'depth', 'contours', 'substrate'].forEach(k => setOver(k, cfg[k]));
  drawLocs(); drawCatches();
  if (cfg.locs) MAPL.locs.addTo(MAP); if (cfg.catches) MAPL.catches.addTo(MAP);
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
  substrate: () => LF().tileLayer.wms('https://drive.emodnet-geology.eu/geoserver/wms', {layers: 'cp_wp3_seabed_substrate_folk_7', format: 'image/png', transparent: true, opacity: 0.6, attribution: 'Dip türü © EMODnet Geology'}),
};
const OVER_TXT = {seamark: 'Deniz işaretleri (şamandıra, fener, liman)', depth: 'Derinlik renkleri', contours: 'Derinlik eğrileri', substrate: 'Dip türü (AB suları; Türk kıyılarında çoğunlukla yok)', locs: 'Konumlarım', catches: 'Avlarım', grup: 'Grup avları (ortak harita)'};
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
  if (k === 'locs' || k === 'catches' || k === 'grup') { const g = MAPL[k]; if (on) { g.addTo(MAP); if (k === 'grup') grpFetch().then(drawGroup); } else MAP.removeLayer(g); return; }
  if (on && !MAPL.over[k]) MAPL.over[k] = OVERS[k]().addTo(MAP);
  if (!on && MAPL.over[k]) { MAP.removeLayer(MAPL.over[k]); delete MAPL.over[k]; }
}
function renderLayers(){
  const cfg = mapCfg(), el = $('mapLayers'); if (!el) return;
  const bases = [['osm', 'Harita'], ['uydu', 'Uydu']].concat(S.settings.gkey ? [['g', 'Google'], ['gsat', 'Google uydu']] : []);
  el.innerHTML = '<b>Altlık</b><div class="seg wrapseg">' + bases.map(([v, t]) => '<button class="btn small" type="button" data-mapbase="' + v + '" aria-pressed="' + (cfg.base === v) + '">' + t + '</button>').join('') + '</div>' +
    (G_TYPES[cfg.base] && GERR ? '<p class="note mc-g">Google kullanılamadı: ' + esc(GERR) + '</p>' : '') + (!S.settings.gkey ? '<p class="note">Google haritası için Ayarlar → Harita’ya Google anahtarını yaz.</p>' : '') +
    '<b>Katmanlar</b>' + Object.keys(OVER_TXT).filter(k => k !== 'grup' || grpOn()).map(k => '<label class="chk"><input type="checkbox" data-maplayer="' + k + '"' + (cfg[k] ? ' checked' : '') + '> ' + esc(OVER_TXT[k]) + '</label>').join('') +
    '<p class="note">Derinlik ve dip türü EMODnet verisidir; seyir için resmî harita yerine geçmez.</p>';
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
  const facts = [p.sea === true ? 'Deniz' : p.sea === false ? 'Kara' : '', p.coastKm != null ? (p.coastKm < 0.05 ? 'kıyıda' : 'kıyıya ' + f1(p.coastKm) + ' km') : p.sea && p.coastChecked ? 'kıyı 6 km’den uzak' : '',
    p.depth != null ? 'derinlik ≈ ' + p.depth + ' m (EMODnet)' : '', p.facing != null ? 'kıyının bakışı ' + dir8(p.facing) : ''].filter(Boolean);
  const info = p.busy ? (facts.length ? facts.join(' · ') + ' · ' : '') + 'aranıyor…' : p.failed ? 'Yer adı alınamadı (bağlantı yok ya da servisler yanıt vermedi). Koordinatlar doğru; yine kaydedebilirsin.' : facts.join(' · ');
  const gNote = !p.busy && S.settings.gkey && GERR ? '<div class="mc-g">Google kullanılamadı: ' + esc(GERR) + '</div>' : '';
  el.innerHTML = '<div class="mc-h"><b>' + esc(p.name || 'Seçilen nokta') + (p.busy && p.name ? ' …' : '') + '</b><button class="x" type="button" data-mapact="close" aria-label="Kapat">×</button></div>' +
    coordBlock(p.lat, p.lon) + '<div class="mc-i">' + esc(info) + '</div>' + gNote +
    '<div class="row"><button class="btn primary" type="button" data-mapact="forecast">Bu noktanın tahmini</button><button class="btn" type="button" data-mapact="save">Kaydet</button>' +
    '<a class="btn" href="' + gmapsUrl(p.lat, p.lon) + '" target="_blank" rel="noopener">Google Haritalar</a></div>';
  el.hidden = false;
}
async function locCard(id){
  const Lc = S.locations[id], el = $('mapCard'); if (!Lc || !el) return;
  MPICK = {lat: Lc.lat, lon: Lc.lon, id, name: Lc.name};
  if (MAPL && MAPL.pick) { MAP.removeLayer(MAPL.pick); MAPL.pick = null; }
  const draw = dep => {
    el.innerHTML = '<div class="mc-h"><b>' + esc(locLabel(Lc)) + '</b>' + (S.active === id ? '<span class="chip A">Seçili</span>' : '') + '<button class="x" type="button" data-mapact="close" aria-label="Kapat">×</button></div>' +
      coordBlock(Lc.lat, Lc.lon) + '<div class="mc-i">dip: ' + esc(BOTTOM_TXT[Lc.bottom || ''] || 'bilinmiyor') + ' · derinlik: ' + (Lc.depth ? esc(Lc.depth) + ' m' : 'yazılmamış') +
      (dep != null && !Lc.depth ? ' · EMODnet ≈ ' + dep + ' m <button class="linkbtn" type="button" data-mapact="setdepth" data-dep="' + dep + '">derinlik olarak yaz</button>' : '') + '</div>' +
      '<div class="row">' + (S.active === id ? '<button class="btn primary" type="button" data-mapact="today">Tahmine dön</button>' : '<button class="btn primary" type="button" data-mapact="use">Seç ve tahmin</button>') +
      '<a class="btn" href="' + gmapsUrl(Lc.lat, Lc.lon) + '" target="_blank" rel="noopener">Google Haritalar</a></div>';
    el.hidden = false;
  };
  draw(null);
  if (!Lc.depth) { const d = await depthAt(Lc.lat, Lc.lon).catch(() => null); if (MPICK && MPICK.id === id && d != null && d > 0.5) draw(Math.round(d)); }
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
  if (a === 'setdepth' && p.id && S.locations[p.id]) { S.locations[p.id].depth = String(b.dataset.dep); persist(); renderAll(); locCard(p.id); toast('Derinlik kaydedildi'); return; }
  if (a === 'use' && p.id) { S.active = p.id; persist(); WX = null; closeSheet(); show('bugun'); renderAll(); loadWeather(); toast('Konum değişti'); return; }
  if (a === 'today') { closeSheet(); show('bugun'); return; }
  if (a === 'save' || a === 'forecast') {
    const n = nearestLoc(p); let id = n && n.d <= 0.2 ? n.L.id : null;
    if (!id) { id = addLocation(p.name || 'Harita noktası', +p.lat.toFixed(6), +p.lon.toFixed(6), '', p.depth != null ? String(p.depth) : '', a === 'forecast'); if (p.facing != null) S.locations[id].facing = String(p.facing); }
    if (a === 'forecast') { S.active = id; persist(); WX = null; closeSheet(); show('bugun'); renderAll(); loadWeather(); toast(locLabel(S.locations[id]) + ' tahmini'); return; }
    persist(); drawLocs(); renderAll(); toast('Konumlarına kaydedildi: ' + S.locations[id].name);
    locCard(id);
  }
}
