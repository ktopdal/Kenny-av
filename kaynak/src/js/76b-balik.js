// ---------------------------------------------------------------- 76b · balık çizimleri ve tür kartları (v0.28)
// Av takvimi sayfasındaki parametrik çizimler (sparit, uskumrugiller, kalamar) ve su sahnesi; diğer türler için aynı kalıplardan
// renk ve desen değişkeleri, yassı balıklar, ahtapot ve mürekkep balığı. Çizimler temsilîdir, ölçekli fotoğraf değildir.
// Takvimin "Balıklar" bölümü ve Türlerim tür sayfası buradan çizer. Renkler doğal tonlardır (su zemininin üstünde sabit).
function fSpline(pts, closed){
  const n = pts.length, P = i => closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))], f = v => v.toFixed(1);
  const out = ['M' + f(pts[0][0]) + ' ' + f(pts[0][1])];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    out.push('C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f(p2[0]) + ' ' + f(p2[1]));
  }
  return out.join(' ') + (closed ? ' Z' : '');
}
const fSc = (pts, d, cy) => pts.map(([x, y]) => [x, (cy || 64) + (y - (cy || 64)) * d]);
const fRays = (pts, col, op) => pts.map(([a, b, c, d]) => '<line x1="' + a + '" y1="' + b + '" x2="' + c + '" y2="' + d + '" stroke="' + col + '" stroke-opacity="' + (op || 0.35) + '" stroke-width=".9"/>').join('');
const fDefs = (u, back, mid, belly, body, so) => '<linearGradient id="' + u + '-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + back + '"/><stop offset=".52" stop-color="' + mid + '"/><stop offset="1" stop-color="' + belly + '"/></linearGradient>' +
  '<clipPath id="' + u + '-c"><path d="' + body + '"/></clipPath><pattern id="' + u + '-s" width="9" height="7" patternUnits="userSpaceOnUse"><path d="M0 7Q4.5 1.2 9 7M-4.5 3.5Q0 -2 4.5 3.5M4.5 3.5Q9 -2 13.5 3.5" fill="none" stroke="#10202a" stroke-opacity="' + (so == null ? 0.13 : so) + '" stroke-width=".8"/></pattern>';
const fPath = (d, fill, line, extra) => '<path d="' + d + '" fill="' + fill + '" stroke="' + line + '" stroke-opacity=".5" stroke-width="1" stroke-linejoin="round"' + (extra || '') + '/>';
const F_HEADS = {pointy: {1: [17, 61], 2: [27, 51], 3: [46, 39]}, steep: {1: [15, 55], 2: [22, 41], 3: [42, 31]}, hump: {1: [16, 53], 2: [25, 38], 3: [44, 25]}, blunt: {1: [14, 60], 2: [20, 49], 3: [44, 36]}};
// sparit gövdesi (çipura, karagöz, mercan …): o = {u, back, mid, belly, fin, edge, marks, depth, head, tail, eye, dorsal, line, tailCol, fin2, teeth, pec, front}
function fSparid(o){
  const line = o.line || '#14262f', d = o.depth || 1, head = o.head || 'normal';
  let top = [[12, 66], [17, 57], [28, 46], [46, 36], [70, 29], [100, 25], [130, 27], [156, 34], [174, 44], [190, 55]];
  let bot = [[190, 73], [174, 81], [156, 90], [130, 98], [100, 102], [72, 100], [48, 92], [30, 80], [18, 72]];
  Object.entries(F_HEADS[head] || {}).forEach(([i, v]) => { top[i] = v; });
  if (head === 'steep' || head === 'hump') bot.splice(-2, 2, [27, 83], [16, 73]); else if (head === 'pointy') bot.splice(-2, 2, [30, 78], [18, 70]);
  const body = fSpline(fSc(top, d).concat(fSc(bot, d)), true), tc = o.tailCol || o.fin, fb = o.fin2 || o.fin, u = o.u;
  const r = ['<defs>' + fDefs(u, o.back, o.mid, o.belly, body) + '</defs>'];
  if ((o.tail || 'fork') === 'fork') {
    r.push(fPath('M184 57C198 49 218 35 237 18C229 38 219 52 213 64C219 76 229 92 237 110C218 94 198 80 184 71Z', tc, line));
    r.push(fRays([[190, 64, 232, 26], [190, 64, 224, 38], [190, 64, 216, 50], [190, 64, 216, 78], [190, 64, 224, 90], [190, 64, 232, 102]], line, 0.22));
    r.push('<path d="M237 18C229 38 219 52 213 64C219 76 229 92 237 110" fill="none" stroke="' + o.edge + '" stroke-width="2.2" stroke-opacity=".7" stroke-linecap="round"/>');
  } else {
    r.push(fPath('M184 57C202 47 226 50 238 64C226 80 202 82 184 71Z', tc, line));
    r.push(fRays([[190, 64, 234, 56], [190, 64, 236, 64], [190, 64, 234, 72], [190, 64, 224, 52], [190, 64, 224, 76]], line, 0.22));
  }
  const spiny = (o.dorsal || 'spiny') === 'spiny';
  const dd = spiny ? 'M64 33L70 15L76 22L86 11L92 19L103 9L110 17L121 9L128 17C142 11 156 21 172 44Z' : 'M64 33L70 17L78 23L88 14L97 20L106 15C114 12 124 10 136 12C152 14 166 26 174 46Z';
  const rays = spiny ? [[66, 31, 70, 15], [74, 31, 78, 21], [82, 29, 86, 11], [90, 28, 94, 18], [99, 27, 103, 9], [108, 27, 112, 16], [117, 27, 121, 9], [126, 28, 130, 16]]
    : [[70, 31, 70, 17], [78, 31, 78, 23], [88, 29, 88, 14], [97, 28, 97, 20], [110, 27, 110, 14], [122, 27, 122, 11], [134, 28, 136, 12], [146, 30, 150, 17], [158, 34, 162, 24]];
  r.push(fPath(dd, o.dorsalCol || o.fin, line), fRays(rays, line, 0.28), '<path d="' + dd.split('Z')[0] + '" fill="none" stroke="' + o.edge + '" stroke-width="1.6" stroke-opacity=".55"/>');
  r.push(fPath('M136 97L142 111L152 107L160 113C168 104 175 92 179 80Z', fb, line), fRays([[144, 99, 143, 110], [152, 97, 152, 107], [160, 94, 160, 112], [168, 88, 170, 102]], line, 0.25));
  r.push(fPath('M84 96C86 111 94 119 105 115C102 107 98 101 96 96Z', fb, line), o.back2 || '');
  r.push('<path d="' + body + '" fill="url(#' + u + '-g)"/><path d="' + body + '" fill="url(#' + u + '-s)"/><g clip-path="url(#' + u + '-c)">');
  r.push('<path d="' + fSpline(fSc([[38, 49], [70, 41], [110, 38], [150, 44], [182, 55]], d)) + '" fill="none" stroke="#fff" stroke-opacity=".26" stroke-width="7" stroke-linecap="round"/>', o.marks || '', '</g>');
  r.push('<path d="' + body + '" fill="none" stroke="' + line + '" stroke-opacity=".62" stroke-width="1.3" stroke-linejoin="round"/>');
  r.push('<path d="M57 37C66 53 66 75 53 93" fill="none" stroke="' + line + '" stroke-opacity=".5" stroke-width="1.4"/><path d="M62 42C68 56 67 72 59 87" fill="none" stroke="' + line + '" stroke-opacity=".2" stroke-width="1"/>');
  r.push('<path d="M68 51C102 43 150 51 186 62" fill="none" stroke="' + line + '" stroke-opacity=".32" stroke-width="1" stroke-dasharray="2 3"/>');
  r.push('<path d="M12.5 67C15 72 21 74.5 28 73.5" fill="none" stroke="' + line + '" stroke-opacity=".7" stroke-width="1.4" stroke-linecap="round"/>');
  if (o.teeth) r.push('<path d="M14 68.5l1.8 4 1.6-3.2 2 3.8 1.4-3" fill="#fff" stroke="' + line + '" stroke-opacity=".5" stroke-width=".6"/>');
  r.push(fPath('M62 66C75 60 89 69 95 85C82 87 66 81 62 66Z', o.pec || o.fin, line, ' fill-opacity=".72"'));
  r.push('<circle cx="33" cy="56" r="7.5" fill="' + (o.eye || '#E9C46A') + '"/><circle cx="33" cy="56" r="7.5" fill="none" stroke="' + line + '" stroke-opacity=".55" stroke-width="1"/><circle cx="33" cy="56" r="4.3" fill="#0d171c"/><circle cx="31.2" cy="54.2" r="1.5" fill="#fff" fill-opacity=".9"/>');
  r.push('<circle cx="21" cy="54" r="1.2" fill="' + line + '" fill-opacity=".55"/>', o.front || '');
  return r.join('');
}
// uskumrugil/pelajik gövde (palamut, lüfer, akya, kolyoz …)
function fFusi(o){
  const line = o.line || '#10222d', d = o.depth || 1, u = o.u;
  const body = fSpline(fSc([[8, 64], [16, 55], [34, 46], [62, 40], [100, 37], [140, 40], [172, 48], [198, 58]], d, 65).concat(fSc([[198, 71], [172, 80], [140, 89], [100, 92], [62, 90], [34, 83], [16, 73]], d, 65)), true);
  const tc = o.tailCol || o.fin, fb = o.fin2 || o.fin, r = ['<defs>' + fDefs(u, o.back, o.mid, o.belly, body, 0.1) + '</defs>'];
  r.push(fPath('M192 59C206 53 224 40 239 18C233 40 230 55 229 65C230 75 233 90 239 112C224 90 206 77 192 71Z', tc, line));
  r.push(fRays([[196, 65, 235, 26], [196, 65, 228, 40], [196, 65, 224, 54], [196, 65, 224, 76], [196, 65, 228, 90], [196, 65, 235, 104]], line, 0.22));
  r.push('<path d="M239 18C233 40 230 55 229 65C230 75 233 90 239 112" fill="none" stroke="' + o.edge + '" stroke-width="2.2" stroke-opacity=".7" stroke-linecap="round"/>');
  const dor = o.dorsal || 'tuna';
  if (dor === 'tuna') {
    r.push(fPath('M58 42L64 29L74 25L86 23L98 25L110 29L122 35L132 41Z', o.dorsalCol || o.fin, line), fRays([[66, 40, 66, 29], [76, 39, 76, 26], [88, 38, 88, 24], [100, 38, 100, 26], [112, 39, 113, 31], [122, 40, 123, 36]], line, 0.25));
    r.push(fPath('M142 41L151 31L161 35L169 46Z', fb, line));
  } else if (dor === 'two') {
    r.push(fPath('M70 41L76 28L90 26L104 29L114 41Z', o.dorsalCol || o.fin, line), fRays([[78, 40, 78, 29], [88, 39, 88, 27], [98, 39, 98, 29]], line, 0.25));
    r.push(fPath('M126 41C132 31 148 27 158 34L170 47Z', fb, line), fRays([[134, 40, 136, 31], [144, 40, 147, 30], [154, 42, 158, 34]], line, 0.25));
  } else if (dor === 'long') {
    r.push(fPath('M40 44C50 26 80 24 110 26C140 28 160 34 178 50Z', o.dorsalCol || o.fin, line), fRays([[50, 42, 52, 30], [66, 40, 68, 27], [84, 38, 86, 26], [102, 38, 104, 26], [120, 39, 122, 28], [138, 40, 140, 31], [156, 44, 158, 36]], line, 0.25));
  } else {
    [66, 76, 86, 96, 106].forEach((x, i) => r.push(fPath('M' + (x - 3) + ' 41L' + (x + 1) + ' ' + (27 - (i % 2) * 2) + ' L' + (x + 5) + ' 41Z', o.fin, line)));
    r.push(fPath('M120 41C124 26 142 20 156 27C166 32 172 40 178 52Z', fb, line), fRays([[128, 40, 131, 27], [138, 39, 142, 23], [148, 40, 152, 26], [158, 42, 163, 33]], line, 0.25));
  }
  if (o.finlets) for (let i = 0; i < 5; i++) { const x = 172 + i * 5.2, y = 49 + i * 2.1, yb = 79 - i * 2.1;
    r.push(fPath('M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'L' + (x + 4).toFixed(1) + ' ' + (y - 7).toFixed(1) + 'L' + (x + 8).toFixed(1) + ' ' + (y + 1).toFixed(1) + 'Z', o.fin, line), fPath('M' + (x - 2).toFixed(1) + ' ' + yb.toFixed(1) + 'L' + (x + 2).toFixed(1) + ' ' + (yb + 7).toFixed(1) + 'L' + (x + 6).toFixed(1) + ' ' + (yb - 1).toFixed(1) + 'Z', o.fin, line)); }
  r.push(fPath('M138 90L148 101L160 99L172 81Z', fb, line), fPath('M80 89L86 100L96 94Z', fb, line), o.back2 || '');
  r.push('<path d="' + body + '" fill="url(#' + u + '-g)"/><path d="' + body + '" fill="url(#' + u + '-s)"/><g clip-path="url(#' + u + '-c)">');
  r.push('<path d="' + fSpline(fSc([[30, 56], [70, 50], [120, 49], [165, 55], [196, 63]], d, 65)) + '" fill="none" stroke="#fff" stroke-opacity=".30" stroke-width="6" stroke-linecap="round"/>', o.marks || '', '</g>');
  r.push('<path d="' + body + '" fill="none" stroke="' + line + '" stroke-opacity=".62" stroke-width="1.3" stroke-linejoin="round"/>');
  r.push('<path d="M45 48C52 60 52 74 43 86" fill="none" stroke="' + line + '" stroke-opacity=".5" stroke-width="1.4"/><path d="M50 52C103 46 150 56 194 65" fill="none" stroke="' + line + '" stroke-opacity=".30" stroke-width="1" stroke-dasharray="2 3"/>');
  r.push(o.mouth === 'big' ? '<path d="M8.5 66C16 72 26 74 38 73" fill="none" stroke="' + line + '" stroke-opacity=".75" stroke-width="1.5" stroke-linecap="round"/><path d="M10 67.5l1.5 3.5 1.8-3.2 1.8 3.4 1.6-3" fill="#fff" stroke="' + line + '" stroke-opacity=".5" stroke-width=".6"/>'
    : '<path d="M8.5 66C14 70 20 72 27 71.5" fill="none" stroke="' + line + '" stroke-opacity=".75" stroke-width="1.4" stroke-linecap="round"/>');
  r.push(fPath('M56 67C64 65 72 70 76 79C67 79 59 74 56 67Z', o.pec || o.fin, line, ' fill-opacity=".8"'));
  r.push('<circle cx="27" cy="57.5" r="6" fill="' + (o.eye || '#F2E6B6') + '"/><circle cx="27" cy="57.5" r="6" fill="none" stroke="' + line + '" stroke-opacity=".55" stroke-width="1"/><circle cx="27" cy="57.5" r="3.5" fill="#0d171c"/><circle cx="25.6" cy="56" r="1.2" fill="#fff" fill-opacity=".9"/>', o.front || '');
  return r.join('');
}
// kalamar ve mürekkep balığı
function fSquid(u, cuttle){
  const g1 = cuttle ? '#8C6E57' : '#C98FB0', g2 = cuttle ? '#C9AE92' : '#E9C2D3', g3 = cuttle ? '#EFE2D2' : '#F7E7EE', arm = cuttle ? '#A88B72' : '#D6A1BE', line = '#2a1f3d';
  const body = cuttle ? 'M84 60C96 36 168 32 206 60C168 88 96 84 84 60Z' : 'M94 60C112 43 164 37 214 60C164 83 112 77 94 60Z';
  const r = ['<defs><linearGradient id="' + u + '-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + g1 + '"/><stop offset=".55" stop-color="' + g2 + '"/><stop offset="1" stop-color="' + g3 + '"/></linearGradient><clipPath id="' + u + '-c"><path d="' + body + '"/></clipPath></defs>'];
  [[88, 54, 40, 40], [88, 57, 36, 52], [88, 60, 34, 63], [88, 63, 36, 74], [88, 66, 40, 86]].forEach(([x, y, ex, ey]) => r.push('<path d="M' + x + ' ' + y + ' C' + (x - 14) + ' ' + (y - 6) + ' ' + (ex + 16) + ' ' + (ey + 6) + ' ' + ex + ' ' + ey + '" fill="none" stroke="' + arm + '" stroke-width="3.2" stroke-linecap="round"/>'));
  if (!cuttle) r.push('<path d="M92 56C70 46 52 34 24 28" fill="none" stroke="' + g1 + '" stroke-width="2.4" stroke-linecap="round"/><path d="M92 64C70 74 52 86 24 92" fill="none" stroke="' + g1 + '" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="21" cy="27.5" rx="7" ry="4.2" transform="rotate(-18 21 27.5)" fill="' + g1 + '"/><ellipse cx="21" cy="92.5" rx="7" ry="4.2" transform="rotate(18 21 92.5)" fill="' + g1 + '"/>');
  r.push(cuttle ? '<path d="M88 50C120 30 176 30 210 56L210 64C176 90 120 90 88 70Z" fill="' + g2 + '" fill-opacity=".7" stroke="' + line + '" stroke-opacity=".4"/>' : fPath('M160 52L214 60L160 68C176 62 176 58 160 52Z', '#D9A7C2', line));
  r.push('<path d="' + body + '" fill="url(#' + u + '-g)" stroke="' + line + '" stroke-opacity=".6" stroke-width="1.3" stroke-linejoin="round"/><g clip-path="url(#' + u + '-c)">');
  if (cuttle) for (let i = 0; i < 9; i++) r.push('<path d="M' + (104 + i * 11) + ' 40q4 10 0 20" fill="none" stroke="#3b2a1e" stroke-opacity=".45" stroke-width="2.2"/>');
  else [[110, 56], [118, 50], [126, 58], [134, 52], [142, 60], [150, 50], [158, 57], [166, 53], [174, 61], [182, 55], [190, 60], [122, 66], [138, 67], [154, 66], [170, 68], [118, 59], [146, 55], [130, 62], [162, 61], [200, 59]]
    .forEach(([x, y], i) => r.push('<circle cx="' + x + '" cy="' + y + '" r="' + (1.2 + (i % 3) * 0.5).toFixed(1) + '" fill="#8E3F6B" fill-opacity=".' + (4 + i % 4) + '"/>'));
  r.push('<path d="M100 54C130 44 170 44 206 58" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/></g>');
  r.push('<ellipse cx="86" cy="60" rx="12" ry="9.5" fill="' + arm + '" stroke="' + line + '" stroke-opacity=".55" stroke-width="1.2"/><circle cx="86" cy="53" r="5.2" fill="#F4EBC0"/><circle cx="86" cy="53" r="2.8" fill="#0d171c"/><circle cx="86" cy="68" r="5.2" fill="#F4EBC0"/><circle cx="86" cy="67.5" r="2.8" fill="#0d171c"/>');
  return r.join('');
}
function fOcto(u){
  const c1 = '#B0645A', c2 = '#D99A8A', line = '#3a1d1a', r = ['<defs><radialGradient id="' + u + '-g" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="' + c2 + '"/><stop offset="1" stop-color="' + c1 + '"/></radialGradient></defs>'];
  [[96, 78, 30, 104, 8, 86], [104, 82, 64, 112, 40, 108], [114, 84, 110, 116, 90, 118], [124, 82, 150, 114, 170, 110], [132, 78, 190, 104, 214, 90], [100, 74, 46, 84, 20, 70], [130, 74, 186, 82, 222, 64], [118, 84, 128, 118, 140, 120]]
    .forEach(([x, y, cx, cy, ex, ey]) => { r.push('<path d="M' + x + ' ' + y + ' Q' + cx + ' ' + cy + ' ' + ex + ' ' + ey + '" fill="none" stroke="' + c1 + '" stroke-width="7" stroke-linecap="round"/><path d="M' + x + ' ' + y + ' Q' + cx + ' ' + cy + ' ' + ex + ' ' + ey + '" fill="none" stroke="#F3D3C6" stroke-width="2" stroke-dasharray="1.5 4" stroke-linecap="round" stroke-opacity=".8"/>'); });
  r.push('<path d="M88 74C80 40 96 14 116 12C138 10 152 36 144 74Z" fill="url(#' + u + '-g)" stroke="' + line + '" stroke-opacity=".55" stroke-width="1.3"/>');
  r.push('<ellipse cx="104" cy="60" rx="5" ry="4" fill="#F4EBC0"/><rect x="101" y="59" width="6" height="2" rx="1" fill="#0d171c"/><ellipse cx="130" cy="60" rx="5" ry="4" fill="#F4EBC0"/><rect x="127" y="59" width="6" height="2" rx="1" fill="#0d171c"/>');
  r.push('<path d="M104 30c6-4 14-4 20 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>');
  return r.join('');
}
// yassı balık (dil, kalkan): üstten bakış
function fFlat(u, round){
  const c1 = round ? '#7A6A4E' : '#8B6F4C', c2 = round ? '#A8956E' : '#B9996F', line = '#2c2216';
  const body = round ? 'M30 64C30 26 76 14 120 16C166 18 196 38 198 64C196 90 166 110 120 112C76 114 30 102 30 64Z' : 'M18 62C24 38 70 28 120 30C170 32 196 48 200 64C196 80 170 96 120 98C70 100 24 88 18 62Z';
  const r = ['<defs><linearGradient id="' + u + '-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c2 + '"/><stop offset="1" stop-color="' + c1 + '"/></linearGradient><clipPath id="' + u + '-c"><path d="' + body + '"/></clipPath></defs>'];
  r.push('<path d="' + (round ? 'M24 64C22 18 80 4 120 8C170 10 206 34 206 64C206 94 170 118 120 120C80 124 22 110 24 64Z' : 'M10 62C16 30 70 18 120 20C176 22 204 44 208 64C204 84 176 106 120 108C70 110 16 94 10 62Z') + '" fill="' + c1 + '" fill-opacity=".55" stroke="' + line + '" stroke-opacity=".35"/>');
  r.push(fPath(round ? 'M196 56L234 40L230 64L234 88L196 72Z' : 'M198 56L236 44L232 64L236 84L198 72Z', c1, line));
  r.push('<path d="' + body + '" fill="url(#' + u + '-g)" stroke="' + line + '" stroke-opacity=".55" stroke-width="1.3"/><g clip-path="url(#' + u + '-c)">');
  for (let i = 0; i < 26; i++) { const x = 46 + (i * 37) % 150, y = 34 + (i * 23) % 64; r.push('<circle cx="' + x + '" cy="' + y + '" r="' + (round ? 2.4 : 3.2 + (i % 3)) + '" fill="' + (round ? '#3d2f1f' : '#5a4630') + '" fill-opacity="' + (round ? 0.5 : 0.28) + '"/>'); }
  r.push('<path d="M60 64C100 60 150 62 196 64" fill="none" stroke="' + line + '" stroke-opacity=".3" stroke-dasharray="2 3"/></g>');
  r.push('<circle cx="48" cy="52" r="4.5" fill="#E8D9A8"/><circle cx="48" cy="52" r="2.4" fill="#0d171c"/><circle cx="56" cy="44" r="4.5" fill="#E8D9A8"/><circle cx="56" cy="44" r="2.4" fill="#0d171c"/>');
  return r.join('');
}
// su sahnesi: dip (kum, taş, yosun) · açık su · gece
function fScene(kind, u){
  const o = ['<defs><linearGradient id="' + u + '-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".17"/><stop offset="1" stop-color="#fff" stop-opacity=".03"/></linearGradient></defs>'];
  if (kind !== 'gece') o.push('<g fill="url(#' + u + '-r)"><path d="M30 0L64 0 104 190 56 190 Z"/><path d="M122 0L140 0 184 190 144 190 Z"/><path d="M196 0L222 0 270 190 222 190 Z"/></g>');
  else o.push('<circle cx="42" cy="26" r="28" fill="#FFE9A8" fill-opacity=".14"/><circle cx="42" cy="26" r="9" fill="#FFF3C8" fill-opacity=".9"/><g fill="#fff" fill-opacity=".55">' + [[150, 14, 1], [190, 30, 1.2], [232, 12, 0.9], [254, 38, 1], [112, 34, 0.8], [86, 12, 0.8], [214, 58, 0.8]].map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>').join('') + '</g>');
  o.push('<g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1">' + [[250, 110, 3], [256, 92, 2], [245, 78, 1.5], [26, 120, 2.5], [20, 102, 1.6], [34, 140, 1.4]].map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>').join('') + '</g>');
  if (kind === 'dip') o.push('<path d="M0 168C40 160 74 174 124 166C172 158 222 174 280 164L280 190L0 190Z" style="fill:var(--sand-a)"/><path d="M0 180C60 174 110 184 170 178C220 173 250 182 280 178L280 190L0 190Z" style="fill:var(--sand-b)"/>' +
    '<path d="M236 170c-6-16 6-26 0-42M244 170c4-14-4-22 2-34M252 170c-5-12 3-18-1-30" fill="none" stroke="var(--weed)" stroke-width="3" stroke-linecap="round"/><ellipse cx="24" cy="171" rx="16" ry="9" style="fill:var(--rock-a)"/><ellipse cx="43" cy="175" rx="11" ry="6.5" style="fill:var(--rock-b)"/>');
  else if (kind === 'gece') o.push('<path d="M0 176C50 170 90 180 140 174C190 168 240 180 280 172L280 190L0 190Z" style="fill:var(--sand-a)" fill-opacity=".55"/>');
  return o.join('');
}
const fBands = (xs, w, op, col) => xs.map(x => '<path d="M' + x + ' 20C' + (x + 4) + ' 50 ' + (x + 4) + ' 80 ' + x + ' 112L' + (x + w) + ' 112C' + (x + w + 4) + ' 80 ' + (x + w + 4) + ' 50 ' + (x + w) + ' 20Z" fill="' + (col || '#1a2229') + '" fill-opacity="' + op + '"/>').join('');
const fLines = (n, y0, dy, col, op, w) => Array.from({length: n}, (_, i) => '<path d="M70 ' + (y0 + i * dy) + ' C110 ' + (y0 - 6 + i * dy) + ' 150 ' + (y0 - 2 + i * dy) + ' 188 ' + (y0 + 4 + i * dy) + '" fill="none" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width="' + (w || 1.3) + '"/>').join('');
const fDots = (pts, col, r, op) => pts.map(([x, y]) => '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 2) + '" fill="' + col + '" fill-opacity="' + (op || 0.85) + '"/>').join('');
const fMottle = (col, op) => [[60, 48], [84, 60], [104, 44], [120, 70], [140, 52], [160, 66], [74, 80], [112, 88], [150, 84], [176, 56], [92, 30], [132, 36]].map(([x, y], i) => '<ellipse cx="' + x + '" cy="' + y + '" rx="' + (6 + i % 3 * 2) + '" ry="' + (4 + i % 2 * 2) + '" fill="' + col + '" fill-opacity="' + op + '"/>').join('');
const FA = {};   // tür kimliği → çizim
FA.cipura = u => fSparid({u, back: '#566C78', mid: '#A6B6BD', belly: '#E9EEF0', fin: '#6C7F89', edge: '#2d3e47', depth: 1.02, eye: '#E2B755', tailCol: '#5B6E78',
  marks: '<path d="M20 52C28 38 46 31 70 29L70 37C50 38 37 45 29 58Z" fill="#E1B04A" fill-opacity=".95"/><ellipse cx="60" cy="64" rx="8" ry="16" fill="#B9382B" fill-opacity=".8"/><ellipse cx="61" cy="64" rx="5" ry="12.5" fill="#1d2226" fill-opacity=".85"/>' + fLines(5, 56, 7, '#1d2f38', 0.14)});
FA.karagoz = u => fSparid({u, back: '#76858D', mid: '#B9C5C9', belly: '#EEF2F2', fin: '#8795A0', edge: '#2d3e47', tailCol: '#70808A', marks: fBands([58], 14, 0.78) + fBands([172], 16, 0.86) + fLines(4, 60, 8, '#caa04a', 0.3, 1.2)});
FA.sargoz = u => fSparid({u, back: '#68787F', mid: '#B0BCC1', belly: '#E6EBEC', fin: '#7D8D96', edge: '#2d3e47', depth: 1.05, head: 'steep', eye: '#E3C46C', tailCol: '#697A83',
  marks: fBands([66, 84, 102, 120, 138, 154], 6, 0.26) + '<ellipse cx="180" cy="64" rx="7" ry="17" fill="#13181c" fill-opacity=".88"/>'});
FA.isparoz = u => fSparid({u, back: '#8998A0', mid: '#C6D0D4', belly: '#EFF3F4', fin: '#98A7AF', edge: '#2d3e47', depth: 0.92, eye: '#E8D28A', tailCol: '#8A99A1',
  marks: '<path d="M172 34C176 52 176 76 172 96L184 96C188 76 188 52 184 34Z" fill="#14191d" fill-opacity=".9"/><path d="M62 70C100 62 140 68 170 72" fill="none" stroke="#d3b45b" stroke-opacity=".35" stroke-width="1.4"/>'});
FA.mercan = u => fSparid({u, back: '#D8686F', mid: '#EFA9A8', belly: '#FBEFEE', fin: '#E48D8E', edge: '#8d3340', depth: 0.94, head: 'pointy', eye: '#F3E3B2', tailCol: '#DD777A',
  marks: '<ellipse cx="70" cy="68" rx="3.6" ry="3.6" fill="#7A2A31" fill-opacity=".8"/><path d="M30 70C70 82 130 88 186 70" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3"/>'});
FA.fangri = u => fSparid({u, back: '#C24A55', mid: '#E58E90', belly: '#F8DCDA', fin: '#D2616A', edge: '#7d2a35', depth: 1.1, head: 'steep', eye: '#F0D79A', tailCol: '#CD5A64',
  marks: fDots([[78, 40], [92, 36], [106, 34], [120, 36], [134, 40], [86, 50], [100, 47], [114, 46], [128, 49], [146, 50], [70, 58], [96, 58], [122, 59], [150, 58], [164, 52], [60, 48]], '#8CC9E8', 2, 0.9)});
FA.sinarit = u => fSparid({u, back: '#334F6C', mid: '#7799B3', belly: '#D7E3EA', fin: '#3F5E7E', edge: '#1b2f45', depth: 1.06, head: 'hump', eye: '#E8DDA0', tailCol: '#3A5977', teeth: true,
  marks: fDots([[70, 44], [90, 40], [112, 38], [134, 42], [80, 54], [102, 51], [124, 53], [146, 52], [160, 56], [66, 60], [92, 64]], '#BBD7EA', 1.8, 0.8)});
FA.sinagrit = u => fSparid({u, back: '#B4606C', mid: '#E2A2A6', belly: '#F7E4E2', fin: '#C87882', edge: '#6e2c38', depth: 1.1, head: 'hump', eye: '#F0D79A', tailCol: '#BE6A75', teeth: true,
  marks: fDots([[80, 44], [100, 40], [122, 42], [92, 54], [114, 52], [136, 54]], '#C9E1EE', 1.6, 0.7)});
FA.tranca = u => fSparid({u, back: '#8A6B3E', mid: '#C9A25C', belly: '#F1E4C0', fin: '#D58B3E', edge: '#7b4a1c', depth: 1.08, head: 'hump', eye: '#F2E1A0', tailCol: '#CF7F36',
  marks: '<path d="M10 20L74 20 74 112 10 112Z" fill="#E2B13F" fill-opacity=".38"/><path d="M30 70C70 84 130 90 186 72" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3"/>'});
FA.eskina = u => fSparid({u, back: '#41312A', mid: '#7A5B3E', belly: '#B58C58', fin: '#4B392F', edge: '#EDE5D0', depth: 0.96, head: 'blunt', tail: 'round', dorsal: 'long', eye: '#E8C57A', tailCol: '#46362D', fin2: '#4B392F', line: '#1a120d',
  marks: '<path d="M20 70C70 84 130 92 186 74" fill="none" stroke="#F0C27A" stroke-opacity=".30" stroke-width="4"/><path d="M62 44C104 38 150 48 186 60" fill="none" stroke="#2a1d14" stroke-opacity=".25" stroke-width="2"/>'});
FA.minakop = u => fSparid({u, back: '#7C6A4A', mid: '#C7B48A', belly: '#EFE6CF', fin: '#8C7A58', edge: '#3a2f1f', depth: 0.94, head: 'blunt', tail: 'round', dorsal: 'long', eye: '#E8D7A0', tailCol: '#7E6C4C',
  marks: Array.from({length: 7}, (_, i) => '<path d="M' + (60 + i * 17) + ' 30L' + (80 + i * 17) + ' 100" stroke="#5a4a30" stroke-opacity=".35" stroke-width="2"/>').join(''), front: '<path d="M16 74l2 8" stroke="#3a2f1f" stroke-width="1.6" stroke-linecap="round"/>'});
FA.izmarit = u => fSparid({u, back: '#6E7F91', mid: '#B9C4CE', belly: '#EEF1F3', fin: '#8494A4', edge: '#2d3e47', depth: 0.8, head: 'pointy', tailCol: '#7A8B9C', marks: '<rect x="96" y="54" width="14" height="10" rx="3" fill="#1c252d" fill-opacity=".75"/>'});
FA.kupes = u => fSparid({u, back: '#8A8C5A', mid: '#CFCB98', belly: '#F2F0DE', fin: '#A3A06A', edge: '#3a3a1f', depth: 0.78, head: 'pointy', eye: '#EBDCA0', tailCol: '#999760', marks: fLines(4, 48, 10, '#D9B23C', 0.55, 1.6)});
FA.melanurya = u => fSparid({u, back: '#6B7A86', mid: '#BBC6CD', belly: '#EEF2F3', fin: '#7D8C98', edge: '#2d3e47', depth: 0.9, tailCol: '#6E7D88',
  marks: '<ellipse cx="180" cy="64" rx="9" ry="13" fill="#fff" fill-opacity=".8"/><ellipse cx="180" cy="64" rx="7" ry="11" fill="#101418"/>' + fLines(4, 52, 9, '#3c4a55', 0.18)});
FA.mirmir = u => fSparid({u, back: '#8E9AA2', mid: '#CCD4D8', belly: '#F2F4F5', fin: '#9EA9B0', edge: '#2d3e47', depth: 0.86, head: 'pointy', tailCol: '#909CA4', marks: fBands([56, 70, 84, 98, 112, 126, 140, 154, 168], 5, 0.45)});
FA.kirma = u => fSparid({u, back: '#C79C98', mid: '#E6C9C5', belly: '#FAF0EE', fin: '#D4AFAB', edge: '#7d4a4a', depth: 0.9, head: 'pointy', eye: '#F3E3B2', tailCol: '#C9A09C', marks: '<ellipse cx="66" cy="64" rx="5" ry="6" fill="#4a2020" fill-opacity=".7"/>'});
FA.hani = u => fSparid({u, back: '#8A5A3C', mid: '#C9966A', belly: '#EED9BE', fin: '#A36E4A', edge: '#3d2414', depth: 0.92, head: 'pointy', tail: 'round', teeth: true, tailCol: '#97653F',
  marks: fBands([70, 92, 114, 136, 158], 9, 0.35, '#4a2a18') + fLines(2, 66, 12, '#F0C38A', 0.6, 2)});
FA.iskorpit = u => fSparid({u, back: '#6E4A33', mid: '#A87A58', belly: '#E3CDB4', fin: '#7E5A40', edge: '#2a1a10', depth: 1.05, head: 'blunt', tail: 'round', eye: '#E9B87A', tailCol: '#76533A', line: '#22140b',
  marks: fMottle('#3a2416', 0.45), front: '<path d="M30 46l-4-8M38 44l0-9M46 44l4-8" stroke="#3a2416" stroke-width="1.6" stroke-linecap="round"/>'});
FA.lipsoz = u => fSparid({u, back: '#B5523C', mid: '#DE8C6E', belly: '#F6DCCB', fin: '#C2664C', edge: '#5a1f12', depth: 1.05, head: 'blunt', tail: 'round', eye: '#F2D08A', tailCol: '#B85A42', line: '#3a160c',
  marks: fMottle('#7a2a1a', 0.4), front: '<path d="M30 46l-4-8M38 44l0-9M46 44l4-8M24 78l-6 4" stroke="#7a2a1a" stroke-width="1.6" stroke-linecap="round"/>'});
FA.gelincik = u => fSparid({u, back: '#6A5040', mid: '#A68A72', belly: '#E6D8C8', fin: '#7A604E', edge: '#2a1c12', depth: 0.82, head: 'blunt', tail: 'round', dorsal: 'long', tailCol: '#6E5444', front: '<path d="M18 74l-3 9" stroke="#2a1c12" stroke-width="1.4" stroke-linecap="round"/>'});
FA.lahos = u => fSparid({u, back: '#6B5A3A', mid: '#A8925E', belly: '#E8DDBE', fin: '#7A6844', edge: '#2e2414', depth: 1.06, tail: 'round', teeth: true, tailCol: '#73613E', marks: fLines(3, 48, 14, '#E2C060', 0.55, 2.2)});
FA.orfoz = u => fSparid({u, back: '#5A4636', mid: '#8E7660', belly: '#D9CBB8', fin: '#665040', edge: '#241a12', depth: 1.12, tail: 'round', teeth: true, tailCol: '#5E4A3A', marks: fMottle('#E8DCC4', 0.35)});
FA['kaya-baligi'] = u => fSparid({u, back: '#6B5E48', mid: '#A3967A', belly: '#E3DCC8', fin: '#7A6C52', edge: '#2a2418', depth: 0.86, head: 'blunt', tail: 'round', dorsal: 'long', tailCol: '#6E6048', marks: fMottle('#3a3020', 0.35)});
FA.barbunya = u => fSparid({u, back: '#D0605A', mid: '#EFA4A0', belly: '#FBEDEB', fin: '#DE8580', edge: '#7a2a28', depth: 0.86, head: 'steep', eye: '#F3E3B2', tailCol: '#D46A64',
  front: '<path d="M17 76c1 8 3 12 6 14M21 77c1 7 4 11 7 12" fill="none" stroke="#B5524A" stroke-width="1.4" stroke-linecap="round"/>'});
FA.tekir = u => fSparid({u, back: '#C0605A', mid: '#E9A49A', belly: '#FBEDEB', fin: '#D88A7E', edge: '#7a2a28', depth: 0.86, head: 'steep', eye: '#F3E3B2', tailCol: '#C86A60', marks: fLines(3, 54, 9, '#F2CC4A', 0.75, 2),
  dorsalCol: '#E9C2A0', front: '<path d="M17 76c1 8 3 12 6 14M21 77c1 7 4 11 7 12" fill="none" stroke="#B5524A" stroke-width="1.4" stroke-linecap="round"/>'});
FA.kirlangic = u => fSparid({u, back: '#B5524A', mid: '#DE8E84', belly: '#F6DEDA', fin: '#C86A60', edge: '#5a1f1a', depth: 0.92, head: 'blunt', eye: '#F2D08A', tailCol: '#BE5E56',
  pec: '#3E8A9E', front: '<path d="M60 66C80 56 110 72 116 96C96 100 66 88 60 66Z" fill="#4AA0B4" fill-opacity=".75" stroke="#1d5866" stroke-opacity=".6"/><path d="M66 70C84 66 104 78 110 92" fill="none" stroke="#9fe0ee" stroke-width="1.5"/>'});
FA.trakonya = u => fFusi({u, back: '#8C7E5C', mid: '#C8BC98', belly: '#F2EDDC', fin: '#9C8E6A', edge: '#3a3020', depth: 0.72, dorsal: 'two', mouth: 'big', dorsalCol: '#1c1a14', tailCol: '#958866',
  marks: Array.from({length: 8}, (_, i) => '<path d="M' + (60 + i * 16) + ' 46L' + (74 + i * 16) + ' 84" stroke="#3a6a8a" stroke-opacity=".45" stroke-width="2"/>').join('')});
FA.akya = u => fFusi({u, back: '#4A667A', mid: '#B2C3CD', belly: '#EEF2F4', fin: '#5A788C', edge: '#24394a', depth: 1.18, dorsal: 'free', mouth: 'big', tailCol: '#587589',
  marks: '<path d="M48 70C90 62 140 68 190 66" fill="none" stroke="#E8B8B0" stroke-opacity=".5" stroke-width="3"/>' + fDots([[90, 52], [104, 56], [118, 52], [132, 57], [146, 53], [160, 58]], '#2c3b46', 1.8, 0.45)});
FA.sarikuyruk = u => fFusi({u, back: '#5B6E7C', mid: '#B9C2BF', belly: '#F0EFE6', fin: '#6A7E8A', edge: '#24394a', depth: 1.12, dorsal: 'free', mouth: 'big', tailCol: '#D9B53B', fin2: '#C9A83E',
  marks: '<path d="M30 44L76 34" stroke="#3a3020" stroke-opacity=".55" stroke-width="3"/><path d="M40 68C90 62 140 64 196 64" fill="none" stroke="#E2C04A" stroke-opacity=".75" stroke-width="4"/>'});
FA.levrek = u => fFusi({u, back: '#5E6E78', mid: '#B7C3C9', belly: '#F1F4F5', fin: '#6C7C86', edge: '#2a3a44', depth: 1.05, dorsal: 'two', mouth: 'big', tailCol: '#66767F', marks: '<ellipse cx="46" cy="56" rx="4" ry="5" fill="#1e2a33" fill-opacity=".55"/>' + fLines(3, 52, 8, '#3c4a55', 0.18)});
FA.palamut = u => fFusi({u, back: '#1A3B66', mid: '#7C9DBF', belly: '#E7EEF4', fin: '#2A4F7E', edge: '#10243f', depth: 1.06, tailCol: '#22446F', finlets: true,
  marks: Array.from({length: 7}, (_, i) => '<path d="M' + (58 + i * 17) + ' 30C' + (64 + i * 17) + ' 44 ' + (74 + i * 17) + ' 54 ' + (84 + i * 17) + ' 68" fill="none" stroke="#12263f" stroke-opacity=".85" stroke-width="3.4" stroke-linecap="round"/>').join('')});
FA.orkinos = u => fFusi({u, back: '#13294B', mid: '#6F8FB0', belly: '#E4EBF1', fin: '#1E3A64', edge: '#0b1a33', depth: 1.3, tailCol: '#1A3560', finlets: true, fin2: '#C9A83E',
  marks: '<path d="M30 70C90 64 150 68 196 66" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>'});
FA.lufer = u => fFusi({u, back: '#36707A', mid: '#AFC8CC', belly: '#F2F6F6', fin: '#C7B65F', edge: '#3b5a36', depth: 1.08, dorsal: 'two', mouth: 'big', tailCol: '#3F7C84', fin2: '#C7B65F',
  marks: '<ellipse cx="55" cy="66" rx="4" ry="5" fill="#1e3338" fill-opacity=".6"/><path d="M40 70C90 63 150 68 196 66" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>'});
FA.lambuka = u => fFusi({u, back: '#2F8F6B', mid: '#C6D44A', belly: '#F2E27A', fin: '#2F7FA0', edge: '#1d4a3a', depth: 1.15, dorsal: 'long', mouth: 'small', tailCol: '#D2C040', dorsalCol: '#2F7FA0',
  marks: fDots([[60, 56], [80, 50], [100, 58], [120, 50], [140, 58], [160, 52], [90, 70], [130, 72]], '#2a6fb0', 2, 0.8)});
FA.kolyoz = u => fFusi({u, back: '#2C6B73', mid: '#A9C4C6', belly: '#F3F6F5', fin: '#4E8890', edge: '#17353d', depth: 0.96, tailCol: '#3C7A82', finlets: true,
  marks: Array.from({length: 5}, (_, i) => '<path d="M' + (24 + (i % 2) * 4) + ' ' + (44 + i * 4.5) + ' q4 -4 8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0 t8 0" fill="none" stroke="#10303b" stroke-opacity=".65" stroke-width="1.2"/>').join('') +
    Array.from({length: 11}, (_, i) => '<circle cx="' + (60 + i * 11) + '" cy="78" r="1.3" fill="#31434b" fill-opacity=".45"/><circle cx="' + (60 + i * 11) + '" cy="84" r="1.3" fill="#31434b" fill-opacity=".45"/>').join('')});
FA.uskumru = u => fFusi({u, back: '#1F5E6E', mid: '#9CC0C6', belly: '#F3F6F5', fin: '#3E7684', edge: '#10303b', depth: 0.92, tailCol: '#2E6A78', finlets: true,
  marks: Array.from({length: 9}, (_, i) => '<path d="M' + (40 + i * 16) + ' 38c6 6 -2 12 6 20" fill="none" stroke="#0b1f27" stroke-opacity=".8" stroke-width="2.4"/>').join('')});
FA.istavrit = u => fFusi({u, back: '#4D7F94', mid: '#BCD0D8', belly: '#F3F6F7', fin: '#6A96A8', edge: '#1d3a46', depth: 0.86, dorsal: 'two', tailCol: '#5A8A9C',
  marks: '<path d="M44 58C80 56 110 60 140 66C160 70 180 66 196 65" fill="none" stroke="#2b4a56" stroke-opacity=".6" stroke-width="3" stroke-dasharray="3 1.5"/><ellipse cx="46" cy="52" rx="3" ry="3" fill="#1e2a33" fill-opacity=".6"/>'});
FA.mezgit = u => fFusi({u, back: '#8D9AA3', mid: '#CBD3D8', belly: '#F4F6F7', fin: '#9AA7AF', edge: '#36444c', depth: 0.82, dorsal: 'two', tailCol: '#909DA6', marks: '<ellipse cx="58" cy="66" rx="3" ry="3.5" fill="#1e2a33" fill-opacity=".6"/>'});
FA.kefal = u => fFusi({u, back: '#5B6A73', mid: '#AEB9BF', belly: '#ECF0F1', fin: '#6A7880', edge: '#2a363d', depth: 0.98, dorsal: 'two', tailCol: '#63717A', marks: fLines(5, 46, 8, '#2d3a42', 0.4, 1.4)});
FA.zargana = u => fFusi({u, back: '#2E6B7E', mid: '#A8C8CF', belly: '#F2F6F6', fin: '#3C7A8C', edge: '#173a46', depth: 0.42, dorsal: 'two', tailCol: '#3A7486',
  front: '<path d="M10 63L-16 64.5L10 66.5Z" fill="#2E6B7E" stroke="#173a46" stroke-opacity=".6"/>', marks: '<path d="M20 64C80 62 140 63 196 64" stroke="#7FD0C0" stroke-opacity=".6" stroke-width="2"/>'});
FA.kalamar = u => fSquid(u, false);
FA.murekkep = u => fSquid(u, true);
FA.ahtapot = u => fOcto(u);
FA.dil = u => fFlat(u, false);
FA.kalkan = u => fFlat(u, true);
// tür sahnesi: açık su, gece ya da dip
const F_KIND = {palamut: 'acik', lufer: 'acik', kolyoz: 'acik', istavrit: 'acik', uskumru: 'acik', akya: 'acik', sarikuyruk: 'acik', orkinos: 'acik', lambuka: 'acik', zargana: 'acik', levrek: 'acik', kefal: 'acik', mezgit: 'acik', kalamar: 'gece'};
const fishKind = id => F_KIND[id] || 'dip';
let F_UID = 0;
function fishArt(id, label){
  const fn = FA[id]; if (!fn) return '';
  const u = 'fa' + (++F_UID), kind = fishKind(id);
  const tx = id === 'kalamar' || id === 'murekkep' ? 26 : id === 'ahtapot' ? 20 : 20, ty = id === 'kalamar' || id === 'murekkep' ? 30 : id === 'ahtapot' ? 34 : 26;
  return '<svg class="t-art" viewBox="0 0 280 190" preserveAspectRatio="xMidYMax meet" role="img" aria-label="' + esc(label || '') + ', temsilî çizim">' + fScene(kind, u) + '<g transform="translate(' + tx + ' ' + ty + ')">' + fn(u) + '</g></svg>';
}
const hasFishArt = id => !!FA[id];

// ---------------------------------------------------------------- takvim: Balıklar bölümü (tür kartları)
// Sistemindeki (riglerin ve hedef türlerin) türler, sonra bölgede bu dönem iyi olan diğerleri. Uyum 1–5: Ege av takvimi (bu ay), su sıcaklığı;
// özel paketin tür notu varsa (Ekim–Kasım tahmini, dip, yem, boy, zaman) o yazılır. Karta dokununca tür sayfası, rig koduna dokununca rig açılır.
const SPFIT_TXT = ['', 'Mevsimi değil', 'Zayıf', 'Orta', 'İyi', 'Çok iyi'];
const SEASON_NM = ['kış', 'ilkbahar', 'yaz', 'sonbahar'];
function spFit(id, month, sst){
  const p = SPECIES[id];
  if ((month === 10 || month === 11) && p && p.fit_oct_est) return Math.max(1, Math.min(5, Math.round(p.fit_oct_est)));
  const n = spNow(id, month, sst); if (!n) return null;
  return Math.max(1, Math.min(5, Math.round(1 + 4 * n.v)));
}
const fitMeter = f => '<span class="t-meter f' + f + '" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b></span>';
function spRigs(id){
  const rs = RIG_LIST.filter(r => (r.species || []).includes(id));
  return rs.map(r => ({r, ok: ready(r)})).sort((a, b) => (b.ok - a.ok) || String(a.r.code || '').localeCompare(String(b.r.code || ''))).slice(0, 6);
}
function spCard(s, month, sst){
  const id = s.id, p = SPECIES[id] || {}, fit = spFit(id, month, sst), kind = fishKind(id);
  const uniq = a => a.filter((x, i) => x && a.indexOf(x) === i);
  const bait = p.bait || uniq([].concat(s.b.g || [], s.b.n || [])).join(', ');
  const lure = !p.bait && bait && uniq([].concat(s.b.g || [], s.b.n || [])).every(x => LURE_WORDS.test(trLower(x)));
  const dep = spDepth(id, month);
  const facts = [
    ['Dip', p.bottom || s.hab.map(b => BOTTOM_TXT[b] || b).join(', ')],
    ['Derinlik', dep ? dep[0] + '–' + dep[1] + ' m (' + SEASON_NM[SEASON_IX(month)] + ')' : s.depth[0] + '–' + s.depth[1] + ' m'],
    [lure ? 'Sahte yem' : 'Yem', bait],
    ['Boy', p.size || Object.entries(s.sz || {}).map(([k, v]) => (k === 'trofe' ? 'trofe ' : 'porsiyon ') + v).join(' · ')],
    ['Zaman', p.time || s.t.map(x => ({gunduz: 'gündüz', gece: 'gece', safak: 'şafak'}[x] || x)).join(', ')],
    ['Su', KB.CAL[id] ? suTxt(id) : '']].filter(x => x[1]);
  const why = p.note || (KB.CAL[id] ? MON_LONG[month - 1] + ': ' + CAL_TXT[calMonth(id, month)] + '. ' + calSummary(id, month).replace(/ · şu an .*$/, '') + '.' : s.note || '');
  const rigs = spRigs(id);
  return '<article class="t-sp"><button type="button" class="t-sp-art ' + kind + '" data-tur="' + esc(id) + '" aria-label="' + esc(s.name) + ' tür sayfası">' + fishArt(id, s.name) + '</button><div class="t-sp-body">' +
    '<header><h3><button type="button" data-tur="' + esc(id) + '">' + esc(s.name) + '</button></h3><i>' + esc(p.sub ? s.latin + ' · ' + p.sub : s.latin) + '</i></header>' +
    (fit ? '<div class="t-fit">' + fitMeter(fit) + '<span>' + SPFIT_TXT[fit] + ' · ' + fit + '/5</span></div>' : '') +
    (why ? '<p class="t-why">' + esc(why) + '</p>' : '') +
    '<dl class="t-facts">' + facts.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl>' +
    (rigs.length ? '<div class="t-rigs"><span class="lbl">Rig</span>' + rigs.map(({r, ok}) => '<button type="button" class="' + (r.time === 'gece' || /^N-/.test(r.code || '') ? 'n' : 'g') + (ok ? '' : ' off') + '" data-rigopen="' + esc(r.id) + '" title="' + esc((r.name || '') + (ok ? '' : ' · tamamlanmadı')) + '">' + esc(r.code || r.name || '') + '</button>').join('') + '</div>' : '') +
    '</div></article>';
}
function akSecBalik(L){
  const month = new Date().getMonth() + 1, sst = todaySst(), reg = regionOf(L), shore = shoreMode();
  const mine = new Set(RIG_LIST.flatMap(r => r.species || []).concat((S.targets || []).map(t => t.like || t.id)));
  const fitOf = s => spFit(s.id, month, sst) || 0;
  const sorter = (a, b) => b.f - a.f || trCmp(a.s.name, b.s.name);
  const g1 = KB.SPECIES.filter(s => mine.has(s.id)).map(s => ({s, f: fitOf(s)})).sort(sorter);
  const g2 = KB.SPECIES.filter(s => !mine.has(s.id) && s.bol.includes(reg) && KB.CAL[s.id] && calMonth(s.id, month) >= 2).map(s => ({s, f: fitOf(s)})).sort(sorter).slice(0, g1.length ? 6 : 10);
  const grp = (title, note, list) => list.length ? '<div class="t-spg"><h3>' + title + '</h3><p class="t-note" style="margin-top:2px">' + note + '</p><div class="t-spgrid">' + list.map(x => spCard(x.s, month, sst)).join('') + '</div></div>' : '';
  return '<section class="t-sec" id="t-balik">' + akHead('Hedef türler', (shore ? 'Kıyıdan' : 'Tekneyle') + ' tutulabilecek balıklar', 'Bu dönem için tahmini sezon uyumu: Ege av takvimi (' + MON_LONG[month - 1] + '), ' + (sst != null ? 'bugünkü su ' + tempTxt(sst, true) + ' ' : 'su sıcaklığı ') + 've senin sistemin. Çizimler temsilîdir, ölçekli fotoğraf değildir. Resme ya da ada dokun: tür sayfası açılır.') +
    grp('Sistemindeki türler', 'Riglerinin ve hedef türlerinin balıkları, uyuma göre sıralı. Soluk rig kodu: eksiği var.', g1) +
    grp(g1.length ? 'Bölgede bu dönem iyi olan diğer türler' : 'Bölgede bu dönem iyi olan türler', 'Sisteminde rigi olmayan, bu ay mevsiminde ya da en iyi ayında olan türler.', g2) +
    (g1.length || g2.length ? '' : '<div class="t-empty">Bu ay için öne çıkan tür bulunamadı.</div>') + '</section>';
}
