// ---------------------------------------------------------------- 59 · düğüm kütüphanesi (B2) · v0.25
// Şemadaki her bağlantı noktasına dokununca o düğüm adım adım çizimle açılır. Rig hangi ipleri birleştiriyorsa düğüm ona göre seçilir:
// örgü → fırdöndü: Palomar · örgü → lider: FG · misina → şok lider: çift uni · FC → fırdöndü / T-fırdöndü: Uni · köstek → iğne: Snell.
// Fırdöndüsüz köstek çıkışı için köstek halkası (dropper loop). Dayanımlar yaklaşık değerdir; ipe ve bağlayışa göre değişir.
const KN_W = 260, KN_H = 120;
const knC = P => ({a: P.fc, b: P.braid, m: P.metal, h: P.hook, ar: P.mut});
const knP = (d, c, w, dash) => '<path d="' + d + '" style="stroke:' + c + ';stroke-width:' + (w || 2.2) + ';fill:none;stroke-linecap:round;stroke-linejoin:round' + (dash ? ';stroke-dasharray:4 3' : '') + '"/>';
const knRing = (x, y, r, c) => '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 6) + '" style="fill:none;stroke:' + c + ';stroke-width:2.4"/>';
const knSwv = (x, y, c) => knRing(x, y, 5.5, c) + '<rect x="' + (x - 5) + '" y="' + (y + 6) + '" width="10" height="20" rx="4" style="fill:' + c + '"/>' + knRing(x, y + 32, 5.5, c);
const knArrow = (x1, y1, x2, y2, c) => { const a = Math.atan2(y2 - y1, x2 - x1), h = 7;
  return knP('M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2, c, 1.4) + knP('M' + (x2 - h * Math.cos(a - 0.45)).toFixed(1) + ' ' + (y2 - h * Math.sin(a - 0.45)).toFixed(1) + ' L' + x2 + ' ' + y2 + ' L' + (x2 - h * Math.cos(a + 0.45)).toFixed(1) + ' ' + (y2 - h * Math.sin(a + 0.45)).toFixed(1), c, 1.4); };
const knWraps = (x0, x1, n, y, ry, c, w) => Array.from({length: n}, (_, i) => { const x = x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)); return '<ellipse cx="' + x.toFixed(1) + '" cy="' + y + '" rx="3.2" ry="' + ry + '" style="fill:none;stroke:' + c + ';stroke-width:' + (w || 2) + '"/>'; }).join('');
const knHook = (x, y, c) => knRing(x, y, 4.5, c) + knP('M' + x + ' ' + (y + 4.5) + ' L' + x + ' ' + (y + 64) + ' A16 16 0 0 0 ' + (x + 32) + ' ' + (y + 64) + ' L' + (x + 32) + ' ' + (y + 48) + ' l-5 5', c, 2.6);
const knTxt = (x, y, s, c) => '<text x="' + x + '" y="' + y + '" style="font:600 10px system-ui,-apple-system,sans-serif;fill:' + c + '">' + esc(s) + '</text>';
const KNOTS = {
  palomar: {name: 'Palomar', use: 'Örgü ya da misinayı fırdöndüye, klipse ya da iğneye bağlar. Örgüde en güvenilir uç düğümü.', str: '≈ %85–95',
    pairs: ['örgü → fırdöndü / klips', 'örgü → iğne', 'misina → fırdöndü'],
    tips: ['Örgüde ucu 4–5 mm bırak; çok kısa kesilen örgü kayabilir.', 'Fırdöndü ya da yem büyükse ilmeği üzerinden geçirmek zorlaşır; o zaman Uni.'],
    steps: [
      ['İpi yaklaşık 15 cm ikiye katla; katlı ucu (ilmeği) fırdöndünün halkasından geçir.', C => knSwv(70, 22, C.m) + knP('M250 20 L70 20 Q46 20 40 24', C.a) + knP('M250 28 L70 28 Q46 28 40 24', C.b) + knTxt(150, 14, 'ana ip', C.ar) + knTxt(150, 44, 'uç', C.ar)],
      ['Katlı iple gevşek bir basit düğüm at; fırdöndü ilmeğin ucunda sarksın.', C => knSwv(46, 30, C.m) + knP('M250 28 L170 28 C140 28 128 4 112 18 C98 32 132 52 150 30 L100 30 Q60 30 46 36', C.a) + knP('M250 34 L172 34 C146 34 132 12 118 22 C106 32 132 46 146 36 L100 36 Q64 36 46 40', C.b)],
      ['İlmeği fırdöndünün (ya da iğnenin) tamamının üzerinden geçir.', C => knSwv(70, 40, C.m) + knP('M250 26 L160 26 C140 26 132 12 120 20 C110 28 124 40 140 32', C.a) + knP('M250 32 L162 32 C146 32 140 22 130 26', C.b) + knP('M120 30 C100 30 52 18 52 52 C52 92 94 92 92 60', C.a, 1.8) + knArrow(92, 96, 72, 104, C.ar)],
      ['Islat; ana ipi ve ucu birlikte çek, düğüm halkaya otursun. Ucu 3–4 mm bırakıp kes.', C => knSwv(70, 46, C.m) + knWraps(72, 84, 3, 46, 5, C.a) + knP('M84 44 L250 44', C.a) + knP('M84 49 L96 56', C.b) + knArrow(200, 70, 240, 70, C.ar)],
    ]},
  fg: {name: 'FG', use: 'Örgü ana ipi florokarbon ya da misina lidere bağlar. İnce ve uzundur, kamış halkalarından takılmadan geçer.', str: '≈ %85–95',
    pairs: ['örgü → florokarbon lider', 'örgü → misina şok lider'],
    tips: ['En az 20 sarım (10 çift) yap; az sarım kayar.', 'Kilitlerden önce ıslatıp iki yandan çok sıkı çek; gevşek FG yükte sıyrılır.'],
    steps: [
      ['Örgüyü gergin tut (bir yere bağla ya da dişinle tut). Lideri örgünün altından çaprazla.', C => knP('M10 56 L250 56', C.b, 1.6) + knP('M40 104 L150 56 L170 47', C.a, 3.4) + knArrow(30, 74, 10, 74, C.ar) + knArrow(230, 74, 250, 74, C.ar) + knTxt(14, 48, 'örgü', C.ar) + knTxt(40, 96, 'lider', C.ar)],
      ['Örgüyü liderin bir önünden bir arkasından sar; her çift bir tur. En az 10 çift (20 sarım).', C => knP('M20 62 L230 62', C.a, 3.4) + knP('M250 34 L196 56 L186 70 L176 54 L166 70 L156 54 L146 70 L136 54 L126 70 L116 54 L106 70 L96 58 L20 58', C.b, 1.5) + knTxt(110, 92, '× 20', C.ar)],
      ['Sarımları sık; 2–3 yarım kilitle (half hitch) örgüyü lidere sabitle. Islatıp iki yandan kuvvetlice çek.', C => knP('M20 62 L230 62', C.a, 3.4) + knWraps(110, 180, 12, 62, 4.5, C.b, 1.4) + knWraps(92, 102, 2, 62, 6, C.b, 1.6) + knP('M250 40 L186 60', C.b, 1.5) + knArrow(60, 88, 20, 88, C.ar) + knArrow(200, 88, 240, 88, C.ar)],
      ['Lider ucunu 2–3 mm bırakıp kes; örgü ucuyla 4–6 yarım kilit daha at (son ikisi çift) ve kes.', C => knP('M20 62 L182 62', C.a, 3.4) + knWraps(112, 180, 12, 62, 4.2, C.b, 1.3) + knWraps(184, 204, 5, 60, 3, C.b, 1.3) + knP('M204 59 L250 52', C.b, 1.6) + knTxt(40, 50, 'lider', C.ar) + knTxt(220, 46, 'örgü', C.ar)],
    ]},
  uni: {name: 'Uni (Grinner)', use: 'Florokarbon ve misinayı fırdöndüye, T-fırdöndüye ya da klipse bağlar.', str: '≈ %80–90',
    pairs: ['florokarbon → fırdöndü / T-fırdöndü', 'misina → fırdöndü', 'köstek → kurşun halkası'],
    tips: ['0,40 mm üstü florokarbonda 4 sarım, ince ipte 5–6.', 'Sıkmadan önce mutlaka ıslat; kuru sıkılan florokarbon ısınıp zayıflar.'],
    steps: [
      ['İpi halkadan 15 cm geçir; ucu ana ipe paralel geri getirip üstte bir ilmek yap.', C => knRing(40, 62, 7, C.m) + knP('M250 66 L46 66', C.a) + knP('M46 66 C34 66 34 56 46 56 L186 56 C212 56 212 84 186 84 L126 84', C.b)],
      ['Ucu ilmeğin içinden iki ipin etrafına 5–6 kez sar.', C => knRing(40, 62, 7, C.m) + knP('M250 66 L46 66', C.a) + knP('M46 66 C34 66 34 56 46 56 L120 56', C.b) + knWraps(126, 176, 6, 61, 13, C.b) + knP('M176 70 L196 92', C.b)],
      ['Islat; uçtan çekerek sarımları sıkıştır.', C => knRing(40, 62, 7, C.m) + knP('M250 66 L46 66', C.a) + knP('M46 66 C34 66 34 56 46 56 L148 56', C.b) + knWraps(150, 166, 6, 61, 8, C.b) + knP('M166 66 L196 90', C.b) + knArrow(196, 90, 214, 108, C.ar)],
      ['Ana ipi çek; düğüm halkaya kadar kayar. Ucu kes.', C => knRing(40, 62, 7, C.m) + knWraps(52, 66, 6, 63, 6, C.b) + knP('M66 66 L250 66', C.a) + knP('M66 60 L74 54', C.b) + knArrow(190, 86, 240, 86, C.ar)],
    ]},
  snell: {name: 'Snell (iğne bağı)', use: 'Kösteği iğneye bağlar. İp gözden iğne ucu tarafına çıkar; vuruşta iğne dönerek ağza oturur.', str: '≈ %85–95',
    pairs: ['köstek → iğne (gözlü ya da palalı)'],
    tips: ['Sarımlar gözden aşağı doğru, düzgün ve üst üste binmeden.', 'Palalı (gözsüz) iğnede de aynı bağ; pala sarımları tutar.'],
    steps: [
      ['İpi iğne gözünden iğne ucu tarafından geçir; pala boyunca aşağı uzatıp sapın yanında bir ilmek yap.', C => knHook(110, 14, C.h) + knP('M20 18 L105 18 L116 18 L116 72 C116 84 90 84 90 64 L90 30', C.a) + knP('M90 30 L84 22', C.b)],
      ['İlmeği iğnenin sapı ve ipin etrafına gözden aşağı doğru 7–8 kez sar.', C => knHook(110, 14, C.h) + knP('M20 18 L116 18 L116 30', C.a) + Array.from({length: 7}, (_, i) => '<ellipse cx="113" cy="' + (30 + i * 5.5) + '" rx="9" ry="2.6" style="fill:none;stroke:' + C.b + ';stroke-width:2"/>').join('') + knP('M120 68 C130 80 96 92 96 74', C.a)],
      ['Sarımları parmakla tutup ana ipi çek; ilmek sarımların altında kapanır.', C => knHook(110, 14, C.h) + Array.from({length: 7}, (_, i) => '<ellipse cx="113" cy="' + (28 + i * 4.5) + '" rx="8" ry="2.4" style="fill:none;stroke:' + C.b + ';stroke-width:2"/>').join('') + knP('M20 18 L112 18', C.a) + knArrow(60, 34, 24, 34, C.ar)],
      ['Sıkıca çek ve ucu kes. İp gözden iğne ucu tarafına çıkmalı.', C => knHook(110, 14, C.h) + Array.from({length: 7}, (_, i) => '<ellipse cx="111" cy="' + (24 + i * 3.6) + '" rx="6.5" ry="2" style="fill:none;stroke:' + C.b + ';stroke-width:2"/>').join('') + knP('M112 14 L150 4 L250 4', C.a) + knTxt(160, 22, 'uç tarafa çıkar', C.ar)],
    ]},
  dropper: {name: 'Köstek halkası (dropper loop)', use: 'Bedenin ortasında fırdöndüsüz köstek çıkışı yapar (T-fırdöndü yoksa ya da hafif takımda).', str: '≈ %60–75 (bedeni zayıflatır)',
    pairs: ['beden üzerinde köstek çıkışı', 'çapari / hafif takım'],
    tips: ['Köstek bedenden ince olsun: takılırsa köstek kopsun, takım kalsın.', 'Burgu sayısı 5–7; az burgu kayar.'],
    steps: [
      ['Köstek çıkacak yerde ipte 5–6 cm’lik bir ilmek yap.', C => knP('M10 70 L104 70 C114 26 150 26 160 70 L250 70', C.a)],
      ['İlmeğin bir yanını ötekinin etrafında 5–7 kez çevir; ilmek ortada kalsın.', C => knP('M10 70 L60 70', C.a) + knP('M196 70 L250 70', C.a) + knWraps(64, 104, 5, 70, 7, C.a) + knWraps(156, 196, 5, 70, 7, C.a) + knP('M108 68 C116 24 148 24 154 68', C.a)],
      ['İlmeğin ortasını burgunun ortasındaki boşluktan geçir; parmağınla ya da dişinle tut.', C => knP('M10 70 L64 70', C.a) + knP('M196 70 L250 70', C.a) + knWraps(68, 112, 5, 70, 7, C.a) + knWraps(148, 192, 5, 70, 7, C.a) + knP('M116 68 C122 36 142 36 146 68', C.a) + knArrow(131, 40, 131, 96, C.ar)],
      ['İki ucu yavaşça çek; burgular toplanır ve ilmek dik çıkar. Köstek bu ilmeğe bağlanır.', C => knP('M10 50 L250 50', C.a) + knWraps(118, 142, 6, 50, 5, C.a) + knP('M126 54 C122 90 140 90 136 54', C.a) + knTxt(150, 96, '≈ 5 cm', C.ar) + knArrow(60, 34, 20, 34, C.ar) + knArrow(200, 34, 240, 34, C.ar)],
    ]},
  ciftuni: {name: 'Çift uni', use: 'İki ipi uç uca ekler: örgü → misina / florokarbon, misina → şok lider.', str: '≈ %70–85',
    pairs: ['örgü → misina / florokarbon', 'misina → şok lider', 'iki misina'],
    tips: ['Örgü tarafında 8–10 sarım, misina ya da florokarbon tarafında 4–6.', 'İki düğüm birbirine dayanana kadar çek; arada boşluk kalmasın.'],
    steps: [
      ['İki ipi uç uca 20 cm üst üste koy.', C => knP('M10 56 L200 56', C.a, 2.6) + knP('M250 64 L60 64', C.b, 1.8) + knTxt(110, 88, '≈ 20 cm', C.ar)],
      ['Birinci ipin ucuyla ötekinin üzerine uni at (4–6 sarım).', C => knP('M10 56 L150 56', C.a, 2.6) + knP('M250 64 L60 64', C.b, 1.8) + knWraps(154, 186, 5, 60, 10, C.a, 2.2) + knP('M186 52 L206 40', C.a, 2.2)],
      ['Aynısını ikinci ipin ucuyla öteki yönde yap (örgüde 8–10 sarım).', C => knP('M10 56 L150 56', C.a, 2.6) + knP('M250 64 L110 64', C.b, 1.8) + knWraps(154, 186, 5, 60, 8, C.a, 2.2) + knWraps(68, 104, 9, 60, 9, C.b, 1.5) + knP('M68 68 L50 82', C.b, 1.6)],
      ['İki ana ipi zıt yöne çek; düğümler kayıp birleşir. Uçları kes.', C => knP('M10 60 L112 60', C.a, 2.6) + knWraps(112, 126, 5, 60, 6, C.a, 2.2) + knWraps(128, 150, 9, 60, 5, C.b, 1.4) + knP('M150 60 L250 60', C.b, 1.8) + knArrow(60, 84, 20, 84, C.ar) + knArrow(200, 84, 240, 84, C.ar)],
    ]},
};
const KNOT_ORDER = ['palomar', 'fg', 'uni', 'snell', 'dropper', 'ciftuni'];
function knotStepSvg(k, i, pal){
  const P = SC_PAL[pal || 'screen'], C = knC(P), s = KNOTS[k].steps[i];
  return '<svg class="knsvg" viewBox="0 0 ' + KN_W + ' ' + KN_H + '" width="100%" role="img" aria-label="' + esc(KNOTS[k].name + ' adım ' + (i + 1)) + '">' + s[1](C) + '</svg>';
}
// tek düğüm sayfası (rigden açılınca o rigde nerede kullanıldığı da yazar)
function openKnot(k, where, keep){
  const K = KNOTS[k]; if (!K) return;
  ui.sheet = 'knot'; ui.sheetArg = k;
  openSheet(sheetBar(K.name) + '<div class="stack">' +
    '<p class="sub">' + esc(K.use) + '</p>' +
    '<div class="row knmeta"><span class="chip">Dayanım ' + esc(K.str) + '</span>' + K.pairs.map(p => '<span class="chip">' + esc(p) + '</span>').join('') + '</div>' +
    (where && where.length ? '<p class="note"><b>Bu rigde:</b> ' + esc(where.join(' · ')) + '</p>' : '') +
    '<ol class="knsteps">' + K.steps.map((s, i) => '<li><div class="knfig">' + knotStepSvg(k, i) + '</div><p><b>' + (i + 1) + '.</b> ' + esc(s[0]) + '</p></li>').join('') + '</ol>' +
    '<section class="set"><h4>İpuçları</h4><ul class="kntips">' + K.tips.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></section>' +
    '<p class="note">Dayanım yaklaşık değerdir; ipe, kalınlığa ve bağlayışa göre değişir. Çizimler şematiktir.</p>' +
    '<button class="btn" type="button" data-open="dugumler">Bütün düğümler</button></div>', keep);
}
function sheetKnots(){
  return sheetBar('Düğüm kütüphanesi') + '<div class="stack"><p class="sub">Riglerde kullanılan düğümler. Rig şemasında bir bağlantı noktasına dokunursan o noktanın düğümü açılır.</p>' +
    KNOT_ORDER.map(k => { const K = KNOTS[k]; return '<button type="button" class="kncard" data-knot="' + k + '"><div class="knfig">' + knotStepSvg(k, K.steps.length - 1) + '</div><div><b>' + esc(K.name) + '</b><span class="note">' + esc(K.use) + '</span><span class="chip">Dayanım ' + esc(K.str) + '</span></div></button>'; }).join('') + '</div>';
}
