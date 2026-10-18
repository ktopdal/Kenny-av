// ---------------------------------------------------------------- 00 · yardımcılar
const APP_NAME = 'Alyssa by Barbossa App', APP_SHORT = 'Alyssa';
const APP_VERSION = '/*__VERSION__*/';
const PREVIEW = /*__PREVIEW__*/false;
const CHANGELOG = [
  {v: '0.5.0', notes: [
    'Balık tahmini 5 balıkla: üstte 3, altta 2; her balık %20. Ölçek yenilendi: sakin saatte 1–2, iyi pencerede 4–5 balık',
    'Takvim, Bugün ve öneriler aynı hesaptan: en iyi pencere, tepe değeri ve nedeni (major, minor, şafak, alacakaranlık) birbirini tutar; deniz sınıfı da tartılır',
    'Sürüklenme: rüzgâr ve akıntıdan teknenin gidişi; noktanın ne kadar yukarısından başlayacağın; kurşun gramı sürüklenme ve derinliğe göre',
    'Demirli / sürüklenerek seçimi ve teknenin rüzgârdan etkilenme ayarı',
    'Avlarından öğrenme: 5 av kaydından sonra öneriler senin sonuçlarına göre ayarlanır',
    'Teknik kuralları: jig, kalamar, şamandıra, orkinos ve sırtı için koşul uyumu',
  ]},
  {v: '0.4.0', notes: [
    'Rig Atölyesi: nasıl avlandığını, hedef türleri ve takım düzenini sorup sıfırdan rig sistemi kurar (dip, jig, canlı yem, çapari, kalamar, sırtı, orkinos, surf, LRF, spin, şamandıra)',
    'Her rigde üç malzeme seviyesi: dünyanın en iyisi, envanterimden, Türkiye\'de en iyi (envanterde uygunu varsa o); envanter değiştikçe rigler kendiliğinden güncellenir',
    'Rigler ekranında seviye seçici ve sistem araçları (cevapları düzenle, kapat/aç, sil)',
    'Envantere kalem eklerken katalogda arama',
    '40 türlük bilgi tabanı: boy, mevsim, dip, yem ve korunan türler için uyarılar',
  ]},
  {v: '0.3.0', notes: [
    'Yeni ad: Alyssa by Barbossa App',
    'Uygulama şifresiz ve boş açılır; senin rig sistemin şifreli özel paket olarak yeni şifreyle açılır',
    'Bulut yedek: profilin, avların ve fotoğrafların şifrelenip senin GitHub deponda saklanır',
    'Rüzgâr renkleri: 1 Bft yeşil → sarı → kırmızı → 10 Bft mavi (Ayarlar\'dan değiştirilebilir)',
    'Ayarlar: açık/koyu tema, renk paleti, özel renkler, yazı boyutu, koordinat biçimi ve gizleme',
    'Karadaki noktalarda dalga ve akıntı en yakın deniz noktasından gelir; takılan "Yükleniyor" giderildi',
    'Alışveriş listesinde aynı rig iki kez yazılmaz; av formunda yeni noktada dip "Bilinmiyor" gelir',
  ]},
  {v: '0.2.0', notes: [
    'Bugün ekranında saatlik tablo: yağış %, rüzgâr ve hamle (Bft), dalga (m), akıntı (kn), su sıcaklığı, basınç',
    'Her saat için balık simgeli tahmini balık aktivitesi (%)',
    'Rüzgâr ICON-EU 7 km ve ECMWF, hamle GFS, dalga MFWAM modellerinden',
    'Avlar sekmesi: fotoğraf çek ya da galeriden seç; saat, konum ve deniz koşulları kendiliğinden kaydedilir',
    'Tüm tablolarda birimler (cm, g, m, kn, Bft, °C, hPa, %)',
  ]},
  {v: '0.1.0', notes: ['İlk sürüm: Bugün, 15 günlük takvim, rigler, adetli envanter, alışveriş, konumlar, yedek']},
];
document.documentElement.lang = 'tr';
const verGt = (a, b) => { const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); } return false; };
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
const dateKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const trLower = s => String(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');
const trCmp = (a, b) => String(a).localeCompare(String(b), 'tr');
const KN = 1.943844;
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MON3 = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DIR8 = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
const dir8 = deg => deg == null ? '' : DIR8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const f1 = v => v == null || isNaN(v) ? '–' : v.toFixed(1).replace('.', ',');
const f0 = v => v == null || isNaN(v) ? '–' : String(Math.round(v));
const kn = ms => ms == null ? '–' : String(Math.round(ms * KN));
const num = s => { const n = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isFinite(n) ? n : null; };
const fmtNum = (v, d) => v == null ? '' : String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).replace('.', ',');
const fmtDT = d => d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + hm(d);
const uid = p => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const slugTR = s => trLower(s || '').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// koordinat: ondalık ya da derece-dakika (plotter biçimi)
function ddm(v, pos, neg){ const s = v < 0 ? neg : pos; v = Math.abs(v); let d = Math.floor(v), m = (v - d) * 60; if (m >= 59.9995) { d += 1; m = 0; } return d + '°' + (m < 10 ? '0' : '') + m.toFixed(3).replace('.', ',') + '′ ' + s; }
function fmtCoord(lat, lon, force){
  if (lat == null || lon == null) return '';
  if (!force && S && S.settings.hideCoords) return '•••';
  if (S && S.settings.coord === 'ddm') return ddm(lat, 'K', 'G') + '  ' + ddm(lon, 'D', 'B');
  return lat.toFixed(4) + '°, ' + lon.toFixed(4) + '°';
}

// Beaufort (m/s eşikleri) ve tekne sınıfı: Bft 0–3 = A, 4 = B, 5 = C, 6+ = D
function bft(ms){ if (ms == null) return null; const L = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]; for (let i = 0; i < L.length; i++) if (ms < L[i]) return i; return 12; }
function seaClass(ms){ return ms == null ? null : ms <= 5.4 ? 'A' : ms <= 7.9 ? 'B' : ms <= 10.7 ? 'C' : 'D'; }
function waveClass(m){ return m == null ? null : m < 0.5 ? 'A' : m < 1.0 ? 'B' : m < 1.5 ? 'C' : 'D'; }
function bump(c, wave){ if (!c || wave == null) return c; if (wave >= 1.5) return 'D'; if (wave >= 1.0) return c === 'D' ? 'D' : String.fromCharCode(c.charCodeAt(0) + 1); return c; }
const CLS_TXT = {A: 'Çok uygun', B: 'Uygun', C: 'Dikkat', D: 'Uygun değil'};

// renk yardımcıları
const isHex = s => /^#[0-9a-f]{6}$/i.test(String(s || ''));
function hexRgb(h){ h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function mix(a, b, t){ const x = hexRgb(a), y = hexRgb(b); return rgbHex(...x.map((v, i) => v + (y[i] - v) * t)); }
function relLum(h){ const c = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a, b){ const la = relLum(a), lb = relLum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
const textOn = bg => contrast(bg, '#FFFFFF') >= contrast(bg, '#0A2431') ? '#FFFFFF' : '#0A2431';

function toast(msg){ const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600); }
function distKm(a, b){
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// bir noktadan belli yön (°) ve uzaklıkta (km) yeni nokta
function offsetPt(p, bearing, km){
  const R = 6371, r = Math.PI / 180, d = km / R, b = bearing * r, la = p.lat * r, lo = p.lon * r;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return {lat: la2 / r, lon: ((lo2 / r + 540) % 360) - 180};
}
// zaman aşımlı fetch: iOS'ta takılan istekler "Yükleniyor"da bekletmesin
async function fetchT(url, opt, ms){
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ac ? setTimeout(() => ac.abort(), ms || 15000) : null;
  try { return await fetch(url, Object.assign({}, opt || {}, ac ? {signal: ac.signal} : {})); }
  finally { if (t) clearTimeout(t); }
}
