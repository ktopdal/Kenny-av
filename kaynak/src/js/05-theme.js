// ---------------------------------------------------------------- 05 · tema, renkler, Bft renk skalası
const PRESETS = [
  {id: 'deniz', name: 'Deniz', brand: '#0B6B7C', accent: '#C23C14'},
  {id: 'lacivert', name: 'Lacivert', brand: '#1E3F8A', accent: '#C9800C'},
  {id: 'gece', name: 'Gece moru', brand: '#5A46B2', accent: '#D9533C'},
  {id: 'yosun', name: 'Yosun', brand: '#2E6B3C', accent: '#C0651A'},
  {id: 'mercan', name: 'Mercan', brand: '#A83445', accent: '#1C6E8C'},
  {id: 'kum', name: 'Kum', brand: '#85581F', accent: '#0B6B7C'},
];
// 0–12 Bft: yeşil → sarı → kırmızı → lacivert (10 Bft mavi); sarı ve kırmızı geniş aralığa yayılır.
const BFT_DEFAULT = ['#86D9A6', '#2DB46C', '#93C83E', '#E8D61E', '#F6B40C', '#F18A1B', '#E5531D', '#D0231F', '#9E1530', '#681E74', '#1F4EB4', '#173A87', '#0D2256'];
const BFT_NAMES = ['Sakin', 'Esinti', 'Hafif rüzgâr', 'Tatlı rüzgâr', 'Mutedil rüzgâr', 'Sert rüzgâr', 'Kuvvetli rüzgâr', 'Fırtınamsı', 'Fırtına', 'Kuvvetli fırtına', 'Tam fırtına', 'Çok şiddetli fırtına', 'Kasırga'];
const ZOOMS = [1, 1.12, 1.25];
const bftPal = () => (S && Array.isArray(S.settings.bft) && S.settings.bft.length === 13 && S.settings.bft.every(isHex)) ? S.settings.bft : BFT_DEFAULT;
function bftColor(b){ return b == null ? null : bftPal()[Math.max(0, Math.min(12, b))]; }
function bftStyle(b){ const c = bftColor(b); return c ? 'background:' + c + ';color:' + textOn(c) : ''; }
const bftBadge = b => b == null ? '–' : '<span class="bftb" style="' + bftStyle(b) + '">' + b + '</span>';
function themeColors(){
  const st = S ? S.settings : {};
  const pr = PRESETS.find(p => p.id === st.preset) || PRESETS[0];
  return {brand: isHex(st.brand) ? st.brand : pr.brand, accent: isHex(st.accent) ? st.accent : pr.accent};
}
function applyTheme(){
  const st = S ? S.settings : {}; const root = document.documentElement;
  if (st.scheme === 'light' || st.scheme === 'dark') root.setAttribute('data-theme', st.scheme); else root.removeAttribute('data-theme');
  const {brand, accent} = themeColors();
  const lt = {brand, accent, soft: mix(brand, '#F4F8F9', 0.82)};
  const dB = mix(brand, '#FFFFFF', 0.42), dA = mix(accent, '#FFFFFF', 0.30);
  const dk = {brand: dB, accent: dA, soft: mix(brand, '#0D242F', 0.70)};
  const vars = o => '--brand:' + o.brand + ';--accent:' + o.accent + ';--brand-soft:' + o.soft + ';--on-brand:' + textOn(o.brand) + ';--on-accent:' + textOn(o.accent) + ';';
  const z = ZOOMS[st.zoom] || 1;
  const el = $('userTheme'); if (!el) return;
  el.textContent = ':root{' + vars(lt) + '--zoom:' + z + '}' +
    '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + vars(dk) + '}}' +
    ':root[data-theme="dark"]{' + vars(dk) + '}';
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', brand);
}
