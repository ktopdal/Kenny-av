// ---------------------------------------------------------------- 00 · yardımcılar
const APP_VERSION = '/*__VERSION__*/';
const PREVIEW = /*__PREVIEW__*/false;
const CHANGELOG = [
  {v: '0.2.0', notes: [
    'Bugün ekranında saatlik tablo: yağış %, rüzgâr ve hamle (Bft), dalga (m), akıntı (kn), su sıcaklığı, basınç',
    'Her saat için balık simgeli tahmini balık aktivitesi (%)',
    'Rüzgâr ICON-EU 7 km ve ECMWF, hamle GFS, dalga MFWAM modellerinden',
    'Avlar sekmesi: fotoğraf çek ya da galeriden seç; saat, konum ve deniz koşulları kendiliğinden kaydedilir',
    'Tüm tablolarda birimler (cm, g, m, kn, Bft, °C, hPa, %)',
    'Rig ve envanter verisi şifreli',
  ]},
  {v: '0.1.0', notes: ['İlk sürüm: Bugün, 15 günlük takvim, 32 rig, adetli envanter, alışveriş, konumlar, yedek']},
];
document.documentElement.lang = 'tr';
const verGt = (a, b) => { const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); } return false; };
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
const dateKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const trLower = s => String(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');
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

// Beaufort (m/s eşikleri) ve tekne sınıfı: Bft 0–3 = A, 4 = B, 5 = C, 6+ = D
function bft(ms){ if (ms == null) return null; const L = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]; for (let i = 0; i < L.length; i++) if (ms < L[i]) return i; return 12; }
function seaClass(ms){ return ms == null ? null : ms <= 5.4 ? 'A' : ms <= 7.9 ? 'B' : ms <= 10.7 ? 'C' : 'D'; }
function waveClass(m){ return m == null ? null : m < 0.5 ? 'A' : m < 1.0 ? 'B' : m < 1.5 ? 'C' : 'D'; }
function bump(c, wave){ if (!c || wave == null) return c; if (wave >= 1.5) return 'D'; if (wave >= 1.0) return c === 'D' ? 'D' : String.fromCharCode(c.charCodeAt(0) + 1); return c; }
const CLS_TXT = {A: 'Çok uygun', B: 'Uygun', C: 'Dikkat', D: 'Uygun değil'};

function toast(msg){ const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2400); }
function distKm(a, b){
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
