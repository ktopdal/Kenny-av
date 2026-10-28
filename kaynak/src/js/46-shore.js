// ---------------------------------------------------------------- 46 · kıyı modu
// Kıyının bakışı (facing): kıyıdan denize doğru yön, ° (ör. 225 = güneybatıya bakan kıyı).
// Rüzgâr kıyıya göre: geldiği yön kıyının bakışına yakınsa "kıyıya vuran" (denizden), tersineyse "kıyıdan esen" (karadan), değilse "yandan".
// Bakış: telefonun pusulasıyla, haritada kıyı çizgisinden (OSM kıyı çizgisinde kara solda, deniz sağda) ya da elle seçilir.
const shoreMode = () => modeNow() === 'kiyi';
const facingOf = Lc => Lc && Lc.facing !== '' && Lc.facing != null && isFinite(Lc.facing) ? ((Number(Lc.facing) % 360) + 360) % 360 : null;
const angDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
function shoreRel(wdir, facing){ if (wdir == null || facing == null) return null; const d = angDiff(wdir, facing); return d <= 50 ? 'vuran' : d >= 130 ? 'esen' : 'yandan'; }
const REL_TXT = {vuran: 'kıyıya vuran (denizden)', esen: 'kıyıdan esen (karadan)', yandan: 'kıyıya yandan'};
const SHORE_TOP = ['levrek', 'cipura', 'sargoz', 'mirmir', 'karagoz', 'istavrit', 'zargana'];
// kıyıdan (kayalık, iskele, kumsal, mendirek) oltaya gelen türler; diğerleri (orkinos, lahos, fangri, kalkan…) tekne ister
const SHORE_SP = new Set(['karagoz', 'isparoz', 'izmarit', 'kupes', 'melanurya', 'mirmir', 'sargoz', 'cipura', 'minakop', 'kirma', 'eskina', 'iskorpit', 'hani', 'kaya-baligi',
  'akya', 'levrek', 'lufer', 'palamut', 'zargana', 'istavrit', 'kolyoz', 'uskumru', 'kefal', 'tekir', 'barbunya', 'mezgit', 'dil', 'trakonya', 'kalamar', 'murekkep', 'ahtapot']);
const spShore = id => SHORE_SP.has(id);
// kıyı için deniz sınıfı: kıyıya vuran rüzgâr ve kıyıdaki dalga belirleyici
function shoreClass(x, facing){
  if (!x || x.wind == null) return null;
  const b = bft(x.wind), rel = shoreRel(x.wdir, facing), w = x.wave || 0, on = rel === 'vuran' || rel == null;
  if (w >= 1.5 || (on && b >= 6) || b >= 8) return 'D';
  if (w >= 1.0 || (on && b >= 5) || b >= 7) return 'C';
  if (w >= 0.6 || (on && b >= 4) || b >= 6) return 'B';
  return 'A';
}
// seçili moda göre saatlik deniz sınıfı (pencere seçimi, takvim ve öneriler bunu kullanır)
function seaClsAt(x){ if (!x || x.wind == null) return null; return shoreMode() ? shoreClass(x, facingOf(loc())) : bump(seaClass(x.wind), x.wave); }
const worstCls = arr => arr.reduce((w, c) => !c ? w : (!w || 'ABCD'.indexOf(c) > 'ABCD'.indexOf(w)) ? c : w, null);
// kıyı rigi için kurşun: atış ağırlığı sınırı; kıyıya vuran dalga ya da akıntıda çapalı (grip) kurşun ve +20 g
function shoreLead(rg, x){
  const k = Object.assign({}, rg.lengths || {});
  if (!rg.sinker || !rg.sinker.g) return rg.lengths ? Object.assign(k, {kursun: null}) : null;
  let [lo, hi] = rg.sinker.g; const max = rg.sinker.max || hi;
  const rel = x ? shoreRel(x.wdir, facingOf(loc())) : null; let extra = 0; const why = [];
  if (x && (x.wave || 0) >= 0.6 && rel !== 'esen') { extra += 20; why.push('dalga'); }
  if (x && (x.cur || 0) >= 0.5) { extra += 20; why.push('akıntı'); }
  const need = lo + extra; lo = Math.min(need, max); hi = Math.min(hi + extra, max);
  return Object.assign(k, {kursun: lo === hi ? lo + ' g' : lo + '–' + hi + ' g', max, extra, need, over: need > max, grip: extra > 0, shore: true, shoreWhy: why});
}
// kıyıda ne demek: kısa yorum
function shoreAdvice(x, facing){
  if (!x || x.wind == null) return '';
  const rel = shoreRel(x.wdir, facing), b = bft(x.wind), w = x.wave || 0;
  if (rel == null) return 'Kıyının bakışını gir; rüzgârın kıyıya vurup vurmadığını ona göre yazarım.';
  if (rel === 'vuran') return w >= 1.0 || b >= 5 ? 'Rüzgâr ve dalga yüzüne geliyor: atış zor, kayalık kıyıda tehlikeli. Korunaklı bir koy seç.' :
    w >= 0.3 ? 'Hafif kıyıya vuran rüzgâr: dalga yemi kıyıya taşır; surf ve dipten atma için iyi, şamandıra için zor.' : 'Rüzgâr denizden ama zayıf: her teknik uygun.';
  if (rel === 'esen') return b >= 5 ? 'Karadan sert esiyor: deniz kıyıda düz ama hafif yem ve şamandıra açığa sürüklenir; misinayı gergin tut.' :
    'Rüzgâr arkadan: atışlar uzar, deniz kıyıda sakin; LRF, spin ve şamandıra için iyi.';
  return b >= 5 ? 'Yandan sert rüzgâr: misina kavis yapar, ağır kurşunla dibi tut.' : 'Rüzgâr yandan: atışı rüzgâra göre biraz yukarıdan yap.';
}
// telefonun pusulasıyla kıyının bakışı: telefonu denize doğru tut
async function captureHeading(){
  const D = window.DeviceOrientationEvent;
  if (!D) throw new Error('Bu telefonda pusula yok');
  if (typeof D.requestPermission === 'function') { const r = await D.requestPermission(); if (r !== 'granted') throw new Error('Pusula izni verilmedi'); }
  return new Promise((res, rej) => {
    const vals = [];
    const done = () => { window.removeEventListener('deviceorientationabsolute', h, true); window.removeEventListener('deviceorientation', h, true); clearTimeout(t); };
    const t = setTimeout(() => { done(); rej(new Error('Pusula okunamadı; yönü elle seç')); }, 5000);
    function h(e){
      let hd = null;
      if (e.webkitCompassHeading != null && isFinite(e.webkitCompassHeading)) hd = e.webkitCompassHeading;
      else if ((e.absolute || e.type === 'deviceorientationabsolute') && e.alpha != null) hd = (360 - e.alpha) % 360;
      if (hd == null) return;
      vals.push(hd);
      if (vals.length >= 5) { done(); const s = vals.reduce((a, v) => a + Math.sin(v * Math.PI / 180), 0), c = vals.reduce((a, v) => a + Math.cos(v * Math.PI / 180), 0); res((Math.atan2(s, c) * 180 / Math.PI + 360) % 360); }
    }
    window.addEventListener('deviceorientationabsolute', h, true); window.addEventListener('deviceorientation', h, true);
  });
}
const dirOpts = () => DIR8.map((d, i) => [String(i * 45), d + ' · ' + WIND_NAMES[i]]);
// kıyının bakışı: pusulayla al ya da elle seç (Fishing → Kıyı ve kurşun)
function shoreControls(Lc, f){
  if (!Lc) return '';
  const sel = '<select data-lk="' + esc(Lc.id) + '" data-f="facing" aria-label="Kıyının bakışı"><option value="">Seç</option>' +
    dirOpts().map(([v, t]) => '<option value="' + v + '"' + (f != null && Math.round(f / 45) % 8 * 45 === Number(v) ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>';
  return '<div class="row shorebtns"><button class="btn small" type="button" data-act="heading">Pusulayla al</button><label class="f inl">Bakış ' + sel + '</label></div>';
}
