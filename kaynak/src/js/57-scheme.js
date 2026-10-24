// ---------------------------------------------------------------- 57 · rig şeması (B1) · v0.25
// Her rigin şeması kendi verisinden çizilir: ana ip, fırdöndü, beden, köstekler (cm), iğne boyları, kurşun (g), sahte yem.
// "Bugünkü ayar" (akışta hırsızın kısalması, kurşun gramı, kamış sınırı) şemaya yansır. Şemadaki düğüm noktasına dokununca o düğüm
// adım adım açılır (58-knots.js). Ekranda tema renkleri, resim olarak kaydederken açık renkler kullanılır.
const SC_PAL = {
  screen: {braid: 'var(--sc-braid)', fc: 'var(--sc-fc)', mono: 'var(--sc-mono)', metal: 'var(--sc-metal)', lead: 'var(--sc-lead)', knot: 'var(--accent)', bed: 'var(--sc-bed)', bed2: 'var(--sc-bed2)',
    lure: 'var(--sc-lure)', hook: 'var(--sc-hook)', txt: 'var(--ink)', mut: 'var(--muted)', bg: 'var(--surface)', warn: 'var(--D)', float: '#D9483B'},
  print: {braid: '#C8642F', fc: '#3B8FC4', mono: '#8E9AA0', metal: '#5D666C', lead: '#7D858A', knot: '#C23C14', bed: '#EFE6CC', bed2: '#CDBB8C',
    lure: '#3F7FA8', hook: '#2E3438', txt: '#10202A', mut: '#5B6B73', bg: '#FFFFFF', warn: '#B02A20', float: '#D9483B'},
};
const SC_W = 360, SC_X0 = 120;
const mmS = mm => mmT(mm) + ' mm';
// ip adı ölçüsünü zaten içeriyorsa yalnız ad, değilse ad + ölçü
const lineNm = l => !l ? '' : !l.name ? l.txt : /\d\s*mm|\bpe\s*\d/i.test(l.name) ? l.name : l.name + ' · ' + l.txt;
// yuvanın ip çapı ve türü: envanterdeki kalemden ya da ölçüden
function slotLine(sl){
  if (!sl) return null;
  const e = sl.t.envanter || {}, it = e.item && ITEMS[e.item];
  const cat = it ? it.cat : sl.sp && sl.sp.cats ? sl.sp.cats[0] : sl.k === 'braid' ? 'braid' : 'fc';
  const mm = it ? lineMm(it) : sl.sp && sl.sp.lo ? (sl.sp.lo + sl.sp.hi) / 2 : lineMm({name: [e.name, e.size, (sl.t.turkiye || {}).name].join(' ')});
  return {mat: cat === 'braid' ? 'braid' : cat === 'mono' ? 'mono' : 'fc', mm, item: it ? it.id : null, name: it ? it.name : e.name || (sl.t.turkiye || {}).name || '',
    txt: cat === 'braid' ? (mm ? 'PE ' + fmtNum(peOf(mm), 1) + ' · ' + mmS(mm) : 'örgü') : (mm ? mmS(mm) + ' ' : '') + (cat === 'mono' ? 'misina' : 'FC')};
}
function slotHook(sl){
  if (!sl) return null;
  const e = sl.t.envanter || {}, it = e.item && ITEMS[e.item];
  return {k: sl.k, name: it ? it.name : e.name || (sl.t.turkiye || {}).name || '', size: e.size || (sl.t.turkiye || {}).size || '', item: e.item || null};
}
const hirsizPos = () => S.settings.hirsizPos === 'alt' ? 'alt' : 'ust';
// rigin yukarıdan aşağı parçaları (düğüm noktalarıyla)
function rigChain(rg, ld){
  const lay = rg.sys === 'ozel' ? 'hirsizli' : rg.lay || 'hirsizli';
  const sl = k => rg.slots.find(s => s.k === k);
  const len = Object.assign({}, rg.lengths || {}); if (ld) ['ust', 'orta', 'hirsiz', 'ara', 'kostek', 'lider', 'sok'].forEach(k => { if (ld[k] != null) len[k] = ld[k]; });
  const kursun = ld && ld.kursun ? ld.kursun : rg.sinker && rg.sinker.g ? rg.sinker.g[0] + '–' + rg.sinker.g[1] + ' g' : '';
  const ana = slotLine(sl('braid') || sl('ana') || sl('mono')), beden = slotLine(sl('beden')), kostek = slotLine(sl('kostek') || sl('lider')), sok = slotLine(sl('sok'));
  const lureSl = rg.slots.find(s => s.kind === 'lure'), lure = lureSl ? {lt: lureSl.sp && lureSl.sp.lt || 'generic', name: slotHook(lureSl).name, size: slotHook(lureSl).size, g: lureSl.sp && lureSl.sp.g ? lureSl.sp.g[0] + '–' + lureSl.sp.g[1] + ' g' : ''} : null;
  const N = [], add = o => N.push(o);
  const anaKnot = to => ana && ana.mat === 'braid' ? (to === 'leader' ? 'fg' : 'palomar') : to === 'leader' ? 'ciftuni' : 'uni';
  const short = ld && ld.short ? (ld.short === true ? 20 : ld.short) : 0;
  const tee = (k, label, cm, extra) => add(Object.assign({t: 'tee', k, label, cm, hook: slotHook(sl(k)), line: kostek}, extra || {}));
  const top = (mat) => { add({t: 'line', role: 'ana', label: 'Ana ip', l: ana, h: 34}); add({t: 'knot', k: anaKnot('swivel'), where: 'Ana ip → fırdöndü'}); add({t: 'swivel', label: 'Fırdöndü'}); add({t: 'knot', k: 'uni', where: 'Beden → fırdöndü'}); };
  const dipEnd = (hk, hlabel, cm0) => {
    const H = hk ? {cm: cm0 || len[hk] || len.hirsiz || 80, short} : null;
    if (H && hirsizPos() === 'alt' && /hırsız/i.test(hlabel)) { add({t: 'gap', cm: null, l: beden, h: 26}); add({t: 'sinker', g: kursun, ring2: true}); add({t: 'trail', k: hk, label: hlabel, cm: H.cm, short, hook: slotHook(sl(hk)), line: kostek, from: 'sinker'}); }
    else { if (H) add({t: 'trailTee', k: hk, label: hlabel, cm: H.cm, short, hook: slotHook(sl(hk)), line: kostek}); add({t: 'gap', cm: null, l: beden, h: 24}); add({t: 'sinker', g: kursun}); }
    add({t: 'bed'});
  };
  if (rg.legs && rg.legs.length) {
    // Rig Atölyem (59-rigedit.js): köstek sayısı ve boyları rigin kendi listesinden
    top(); add({t: 'gap', cm: null, l: beden, h: 22, lab: 'Beden'});
    const reg = rg.legs.filter(l => !l.trail), tr = rg.legs.find(l => l.trail);
    reg.forEach((l, i) => { tee(l.k, l.label, l.cm); if (i < reg.length - 1 || tr) add({t: 'gap', cm: len.ara || 50, l: beden}); });
    if (tr) dipEnd(tr.k, tr.label, ld && ld.short && ld.hirsiz != null ? ld.hirsiz : tr.cm);
    else { add({t: 'gap', cm: null, l: beden, h: 24}); add({t: 'sinker', g: kursun}); add({t: 'bed'}); }
  } else if (lay === 'hirsizli' || lay === 'iki') {
    top();
    add({t: 'gap', cm: null, l: beden, h: 22, lab: 'Beden'});
    tee('ust', 'Üst köstek', len.ust || 25);
    add({t: 'gap', cm: len.ara || 50, l: beden});
    if (lay === 'hirsizli') { tee('orta', 'Orta köstek', len.orta || 30); add({t: 'gap', cm: len.ara || 50, l: beden}); }
    dipEnd('hirsiz', lay === 'iki' ? 'Alt (hırsız)' : 'Hırsız');
  } else if (lay === 'tek' || lay === 'canli') {
    top(); add({t: 'gap', cm: null, l: beden, h: 22, lab: 'Beden'});
    add({t: 'trailTee', k: 'igne', label: lay === 'canli' ? 'Canlı yem kösteği' : 'Köstek', cm: len.kostek || 100, short: 0, hook: slotHook(sl('igne')), line: kostek});
    add({t: 'gap', cm: null, l: beden, h: 24}); add({t: 'sinker', g: kursun}); add({t: 'bed'});
  } else if (lay === 'kaydirmali') {
    add({t: 'line', role: 'ana', label: 'Ana ip', l: ana, h: 30});
    add({t: 'slide', g: kursun}); add({t: 'bead', label: 'Stop boncuk'});
    add({t: 'knot', k: anaKnot('swivel'), where: 'Ana ip → fırdöndü'}); add({t: 'swivel', label: 'Fırdöndü'}); add({t: 'knot', k: 'uni', where: 'Köstek → fırdöndü'});
    add({t: 'leader', label: 'Köstek', cm: len.kostek || 80, l: kostek, end: {t: 'hook', hook: slotHook(sl('igne'))}, bed: true}); add({t: 'bed'});
  } else if (lay === 'paternoster') {
    add({t: 'line', role: 'ana', label: 'Ana ip', l: ana, h: 30}); add({t: 'knot', k: 'ciftuni', where: 'Ana ip → şok lider'});
    add({t: 'line', role: 'sok', label: 'Şok lider', l: sok, h: 30});
    tee('ust', 'Üst iğne', len.kostek || 35, {line: kostek}); add({t: 'gap', cm: len.ara || 60, l: sok});
    tee('alt', 'Alt iğne', len.kostek || 35, {line: kostek}); add({t: 'gap', cm: null, l: sok, h: 22});
    add({t: 'sinker', g: kursun, shape: 'piramit'}); add({t: 'bed'});
  } else if (lay === 'capari') {
    add({t: 'line', role: 'ana', label: 'Ana ip', l: ana, h: 34}); add({t: 'knot', k: anaKnot('swivel'), where: 'Ana ip → klipsli fırdöndü'}); add({t: 'swivel', label: 'Klipsli fırdöndü'});
    add({t: 'sabiki', label: lure ? lure.name : 'Çapari', size: lure ? lure.size : ''}); add({t: 'swivel', label: 'Klips'}); add({t: 'sinker', g: kursun}); add({t: 'bed'});
  } else if (lay === 'samandira') {
    add({t: 'line', role: 'ana', label: 'Ana ip', l: ana, h: 24}); add({t: 'bead', label: 'Stop'}); add({t: 'float', label: 'Şamandıra'});
    add({t: 'line', role: 'ana', label: '', l: ana, h: 24}); add({t: 'slide', g: 'saçma', small: true}); add({t: 'knot', k: 'uni', where: 'Ana ip → fırdöndü'}); add({t: 'swivel', label: 'Fırdöndü'}); add({t: 'knot', k: 'uni', where: 'Köstek → fırdöndü'});
    add({t: 'leader', label: 'Köstek', cm: len.kostek || 50, l: kostek, end: {t: 'hook', hook: slotHook(sl('igne'))}});
  } else if (lay === 'chunking') {
    add({t: 'line', role: 'ana', label: 'Ana ip', l: ana, h: 34}); add({t: 'knot', k: 'ciftuni', where: 'Ana ip → lider'});
    add({t: 'leader', label: 'Lider', cm: len.lider || 400, l: kostek, end: {t: 'hook', hook: slotHook(sl('igne'))}});
  } else {
    // sahte yem: örgü → FG → lider → halka / klips → yem (assist / jighead)
    const sirti = lay === 'sirti' || lay === 'agirsirti';
    add({t: 'line', role: 'ana', label: 'Ana ip', l: ana, h: 34}); add({t: 'knot', k: anaKnot('leader'), where: 'Ana ip → lider'});
    add({t: 'leader', label: 'Lider', cm: len.lider || 200, l: kostek, end: null}); add({t: 'knot', k: sirti || lay === 'popping' ? 'palomar' : 'uni', where: 'Lider → ' + (lay === 'slowjig' || lay === 'agirjig' || lay === 'popping' ? 'halka' : 'klips')});
    add({t: 'swivel', label: lay === 'slowjig' || lay === 'agirjig' || lay === 'popping' ? 'Halka' : 'Klips', ring: true});
    const asst = rg.slots.find(s => s.k === 'igne');
    add({t: 'lure', lt: lure ? lure.lt : 'generic', label: lure ? lure.name : 'Sahte yem', g: lure ? (lure.g || lure.size) : '', assist: asst && (asst.sp && asst.sp.p && (asst.sp.p[0] === 'assist' || asst.sp.p[0] === 'jighead')) ? slotHook(asst) : null, jighead: asst && asst.sp && asst.sp.p && asst.sp.p[0] === 'jighead'});
  }
  return {lay, nodes: N, kursun, short, len};
}
// ---- çizim
const scT = (x, y, s, o) => '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '"' + (o && o.a ? ' text-anchor="' + o.a + '"' : '') + ' style="font:' + (o && o.w ? o.w + ' ' : '') + (o && o.fs || 11) + 'px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;fill:' + (o && o.c || 'currentColor') + '">' + esc(s) + '</text>';
const scLine = (x1, y1, x2, y2, c, w) => '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" style="stroke:' + c + ';stroke-width:' + (w || 2) + ';stroke-linecap:round"/>';
const scPath = (d, c, w, f) => '<path d="' + d + '" style="stroke:' + c + ';stroke-width:' + (w || 2) + ';fill:' + (f || 'none') + ';stroke-linecap:round;stroke-linejoin:round"/>';
const scCut = (s, n) => s && s.length > n ? s.slice(0, n - 1) + '…' : (s || '');
// iğne: göz (x,y), ölçek s, yön (sağa açılan kanca); horiz: yatay yatan iğne
function scHook(x, y, P, horiz){
  if (horiz) return '<g>' + '<circle cx="' + x + '" cy="' + y + '" r="2.6" style="fill:none;stroke:' + P.hook + ';stroke-width:1.6"/>' +
    scPath('M' + (x + 2.6) + ' ' + y + ' L' + (x + 20) + ' ' + y + ' A6 6 0 0 1 ' + (x + 20) + ' ' + (y - 12) + ' L' + (x + 15) + ' ' + (y - 12) + ' l2 3', P.hook, 1.8) + '</g>';
  return '<g>' + '<circle cx="' + x + '" cy="' + y + '" r="2.6" style="fill:none;stroke:' + P.hook + ';stroke-width:1.6"/>' +
    scPath('M' + x + ' ' + (y + 2.6) + ' L' + x + ' ' + (y + 17) + ' A6.5 6.5 0 0 0 ' + (x + 13) + ' ' + (y + 17) + ' L' + (x + 13) + ' ' + (y + 11) + ' l-2.6 2.4', P.hook, 1.8) + '</g>';
}
function scKnot(x, y, k, P, lbl, side){
  const nm = (KNOTS[k] || {}).name || k;
  return '<g class="kn" data-knot="' + k + '" role="button" tabindex="0" aria-label="' + esc(nm + ' düğümü') + '"><circle cx="' + x + '" cy="' + y + '" r="13" style="fill:transparent"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="4.6" style="fill:' + P.knot + ';stroke:' + P.bg + ';stroke-width:1.6"/>' +
    (lbl !== false ? scT(side === 'l' ? x - 9 : x + 9, y + 3.5, nm, {fs: 10, c: P.knot, w: 600, a: side === 'l' ? 'end' : null}) : '') + '</g>';
}
const scLbl = (y, a, b, P) => scT(SC_X0 - 14, y, a, {a: 'end', w: 600, fs: 11.5, c: P.txt}) + (b ? scT(SC_X0 - 14, y + 13, b, {a: 'end', fs: 10, c: P.mut}) : '');
function scLure(x, y, lt, P){
  const F = P.lure;
  if (lt === 'egi') return scPath('M' + x + ' ' + y + ' C' + (x + 9) + ' ' + (y + 8) + ' ' + (x + 9) + ' ' + (y + 34) + ' ' + x + ' ' + (y + 46) + ' C' + (x - 9) + ' ' + (y + 34) + ' ' + (x - 9) + ' ' + (y + 8) + ' ' + x + ' ' + y + 'Z', P.hook, 1.4, F) +
    [-6, -3, 0, 3, 6].map(d => scLine(x + d * 0.6, y + 46, x + d, y + 54, P.hook, 1.2)).join('') + scLine(x - 6, y + 12, x - 13, y + 22, P.hook, 1.4);
  if (lt === 'tairubber' || lt === 'inchiku') return '<circle cx="' + x + '" cy="' + (y + 7) + '" r="7" style="fill:' + (lt === 'inchiku' ? P.lead : '#D9483B') + ';stroke:' + P.hook + ';stroke-width:1.2"/>' +
    [-7, -4, -1, 2, 5, 8].map(d => scPath('M' + (x + d * 0.5) + ' ' + (y + 13) + ' q' + (d * 0.6) + ' 14 ' + (d * 0.9) + ' 30', lt === 'inchiku' ? '#E0A030' : '#E2683A', 1.3)).join('');
  if (lt === 'soft') return '<circle cx="' + x + '" cy="' + (y + 4) + '" r="4" style="fill:' + P.lead + '"/>' + scPath('M' + x + ' ' + (y + 8) + ' c6 8 -6 16 0 24 c5 7 -3 12 2 18', '#7FB069', 5);
  if (lt === 'minnow' || lt === 'trolling' || lt === 'bigtroll' || lt === 'popper')
    return scPath('M' + x + ' ' + y + ' C' + (x + 10) + ' ' + (y + 6) + ' ' + (x + 10) + ' ' + (y + 34) + ' ' + x + ' ' + (y + 42) + ' C' + (x - 10) + ' ' + (y + 34) + ' ' + (x - 10) + ' ' + (y + 6) + ' ' + x + ' ' + y + 'Z', P.hook, 1.3, F) +
      scPath('M' + (x - 6) + ' ' + (y + 46) + ' L' + x + ' ' + (y + 40) + ' L' + (x + 6) + ' ' + (y + 46), P.hook, 1.3) + '<circle cx="' + (x + 3) + '" cy="' + (y + 8) + '" r="1.8" style="fill:' + P.bg + '"/>';
  // jig (slowjig / bigjig) ve diğerleri
  return scPath('M' + (x - 5) + ' ' + y + ' L' + (x + 6) + ' ' + (y + 5) + ' L' + (x + 5) + ' ' + (y + 46) + ' L' + (x - 6) + ' ' + (y + 50) + 'Z', P.hook, 1.3, F) + scLine(x - 2, y + 10, x + 2, y + 40, P.bg, 1.2);
}
// şemayı çiz: {svg, h, knots: [{k, where}]}
function schemeSvg(rg, opt){
  opt = opt || {};
  const P = SC_PAL[opt.pal || 'screen'], ch = opt.chain || rigChain(rg, opt.ld);
  const X = SC_X0, out = [], knots = [];
  let y = 14;
  const kn = (k, where, yy, side) => { knots.push({k, where}); out.push(scKnot(X, yy, k, P, true, side)); };
  const mc = l => l ? P[l.mat] || P.fc : P.fc;
  let bedY = null, bedLab = false;
  ch.nodes.forEach((n, i) => {
    if (n.t === 'line') { out.push(scLine(X, y, X, y + n.h, mc(n.l), n.l && n.l.mat === 'braid' ? 1.8 : 2.2)); if (n.label) out.push(scLbl(y + n.h / 2 - 2, n.label, n.l ? n.l.txt : '', P)); y += n.h; }
    else if (n.t === 'knot') kn(n.k, n.where, y);
    else if (n.t === 'swivel') {
      out.push('<circle cx="' + X + '" cy="' + (y + 3) + '" r="3" style="fill:none;stroke:' + P.metal + ';stroke-width:1.8"/>' + '<rect x="' + (X - 4) + '" y="' + (y + 6) + '" width="8" height="13" rx="3" style="fill:' + P.metal + '"/>' +
        (n.ring ? '' : '<circle cx="' + X + '" cy="' + (y + 22) + '" r="3" style="fill:none;stroke:' + P.metal + ';stroke-width:1.8"/>'));
      out.push(scT(X - 14, y + 16, n.label, {a: 'end', fs: 10.5, c: P.mut})); y += n.ring ? 20 : 25;
    }
    else if (n.t === 'gap') {
      const h = n.h || Math.max(38, Math.min(84, (n.cm || 40) * 0.9));
      out.push(scLine(X, y, X, y + h, mc(n.l), 2.2));
      if (n.cm) out.push(scPath('M' + (X - 8) + ' ' + (y + 3) + ' l-4 0 l0 ' + (h - 6) + ' l4 0', P.mut, 1) + scT(X - 16, y + h / 2 + 4, n.cm + ' cm', {a: 'end', fs: 10.5, c: P.mut}));
      if (n.lab && n.l && !bedLab) { bedLab = true; out.push(scLbl(y + h / 2 - 2, n.lab, n.l.txt, P)); }
      y += h;
    }
    else if (n.t === 'tee' || n.t === 'trailTee') {
      // T-fırdöndü: gövde + yan halka; köstek sağa (trailTee: dibe yatan uzun köstek)
      out.push('<rect x="' + (X - 3.5) + '" y="' + (y - 5) + '" width="7" height="12" rx="2.5" style="fill:' + P.metal + '"/><circle cx="' + (X + 6) + '" cy="' + (y + 1) + '" r="2.6" style="fill:none;stroke:' + P.metal + ';stroke-width:1.6"/>');
      const cm = n.cm, L = Math.min(n.t === 'trailTee' ? 196 : 150, Math.max(26, cm * (n.t === 'trailTee' ? 1.5 : 2.2)));
      const x1 = X + 8, c = mc(n.line);
      if (n.t === 'tee') {
        const x2 = x1 + L, y2 = y + 12;
        out.push(scPath('M' + x1 + ' ' + (y + 1) + ' C' + (x1 + L * 0.4) + ' ' + (y + 1) + ' ' + (x1 + L * 0.75) + ' ' + (y + 4) + ' ' + x2 + ' ' + y2, c, 1.6));
        out.push(scHook(x2, y2, P));
        out.push(scT(x1 + 4, y - 6, n.label + ' · ' + cm + ' cm', {fs: 10.5, w: 600, c: P.txt}));
        if (n.hook) { const ht = scCut(n.hook.name + (n.hook.size ? ' ' + n.hook.size : ''), 34), hw = ht.length * 5.4; out.push(scT(Math.max(hw / 2 + 4, Math.min(SC_W - hw / 2 - 4, x2 + 6)), y2 + 33, ht, {fs: 10, c: P.mut, a: 'middle'})); }
        knots.push({k: 'uni', where: n.label + ' → T-fırdöndü'}); out.push(scKnot(x1, y + 1, 'uni', P, false));
        knots.push({k: 'snell', where: n.label + ' → iğne'}); out.push(scKnot(x2, y2, 'snell', P, false));
        y += 52;
      } else {
        n._y = y; n._x1 = x1; n._L = L; n._c = c;   // dibe yatan kısım, dip çizgisi belli olunca çizilir
        out.push('@@TRAIL' + i + '@@');
        y += 6;
      }
    }
    else if (n.t === 'sinker') {
      if (n.shape === 'piramit') out.push(scPath('M' + X + ' ' + (y + 2) + ' L' + (X + 11) + ' ' + (y + 34) + ' L' + (X - 11) + ' ' + (y + 34) + 'Z', P.hook, 1.2, P.lead));
      else out.push('<circle cx="' + X + '" cy="' + (y + 2) + '" r="2.6" style="fill:none;stroke:' + P.metal + ';stroke-width:1.6"/>' + scPath('M' + X + ' ' + (y + 5) + ' C' + (X + 11) + ' ' + (y + 17) + ' ' + (X + 13) + ' ' + (y + 36) + ' ' + X + ' ' + (y + 38) + ' C' + (X - 13) + ' ' + (y + 36) + ' ' + (X - 11) + ' ' + (y + 17) + ' ' + X + ' ' + (y + 5) + 'Z', P.hook, 1.2, P.lead));
      if (n.ring2) out.push('<circle cx="' + X + '" cy="' + (y + 41) + '" r="2.6" style="fill:none;stroke:' + P.metal + ';stroke-width:1.6"/>');
      out.push(scT(X - 16, y + 18, 'Kurşun', {a: 'end', w: 600, fs: 11.5, c: P.txt}) + scT(X - 16, y + 32, n.g || '', {a: 'end', fs: 11, w: 700, c: P.txt}));
      n._y = y; y += n.ring2 ? 44 : 40;
    }
    else if (n.t === 'slide') {
      out.push(scPath('M' + X + ' ' + y + ' C' + (X + (n.small ? 4 : 8)) + ' ' + (y + 4) + ' ' + (X + (n.small ? 4 : 8)) + ' ' + (y + (n.small ? 8 : 22)) + ' ' + X + ' ' + (y + (n.small ? 10 : 26)) + ' C' + (X - (n.small ? 4 : 8)) + ' ' + (y + (n.small ? 8 : 22)) + ' ' + (X - (n.small ? 4 : 8)) + ' ' + (y + 4) + ' ' + X + ' ' + y + 'Z', P.hook, 1.2, P.lead));
      out.push(scT(X - 14, y + (n.small ? 8 : 15), n.small ? 'Saçma kurşun' : 'Gezer kurşun', {a: 'end', fs: 10.5, w: 600, c: P.txt}) + (n.small ? '' : scT(X - 14, y + 28, n.g || '', {a: 'end', fs: 10.5, w: 700, c: P.txt})));
      out.push(scLine(X, y + (n.small ? 10 : 26), X, y + (n.small ? 18 : 34), P.fc, 1.6)); y += n.small ? 18 : 34;
    }
    else if (n.t === 'bead') { out.push('<circle cx="' + X + '" cy="' + (y + 4) + '" r="4" style="fill:#E2683A"/>' + scT(X - 14, y + 8, n.label, {a: 'end', fs: 10.5, c: P.mut})); out.push(scLine(X, y + 8, X, y + 16, P.fc, 1.6)); y += 16; }
    else if (n.t === 'float') { out.push(scLine(10, y + 8, SC_W - 10, y + 8, P.fc, 1) + scPath('M' + X + ' ' + y + ' C' + (X + 7) + ' ' + (y + 6) + ' ' + (X + 7) + ' ' + (y + 24) + ' ' + X + ' ' + (y + 30) + ' C' + (X - 7) + ' ' + (y + 24) + ' ' + (X - 7) + ' ' + (y + 6) + ' ' + X + ' ' + y + 'Z', P.hook, 1.2, P.float) + scT(X - 14, y + 18, n.label, {a: 'end', fs: 10.5, w: 600, c: P.txt}) + scT(SC_W - 12, y + 4, 'su yüzeyi', {a: 'end', fs: 9.5, c: P.mut})); y += 32; }
    else if (n.t === 'sabiki') {
      out.push(scLine(X, y, X, y + 96, P.mono, 1.6));
      for (let j = 0; j < 6; j++) { const yy = y + 8 + j * 15; out.push(scLine(X, yy, X + 16, yy + 4, P.mono, 1.2) + '<circle cx="' + (X + 17) + '" cy="' + (yy + 4) + '" r="2.2" style="fill:#7FD3A0"/>' + scHook(X + 19, yy + 4, P)); }
      out.push(scLbl(y + 44, n.label || 'Çapari', n.size || '', P)); y += 98;
    }
    else if (n.t === 'leader') {
      const h = Math.max(46, Math.min(96, (n.cm || 100) * 0.22)), c = mc(n.l);
      out.push(scLine(X, y, X, y + h, c, 2) + scLbl(y + h / 2 - 2, n.label + ' · ' + n.cm + ' cm', n.l ? n.l.txt : '', P)); y += h;
      if (n.end && n.end.t === 'hook') { knots.push({k: 'snell', where: n.label + ' → iğne'}); out.push(scKnot(X, y, 'snell', P, true)); out.push(scHook(X, y + 2, P)); if (n.end.hook) out.push(scT(X + 22, y + 22, scCut(n.end.hook.name + ' ' + (n.end.hook.size || ''), 30), {fs: 10, c: P.mut})); y += 30; }
    }
    else if (n.t === 'lure') {
      out.push(scLure(X, y + 2, n.lt, P));
      const lx = X + (n.assist ? 40 : 22);
      out.push(scT(lx, y + 14, scCut(n.label, 34), {fs: 11, w: 600, c: P.txt}) + (n.g ? scT(lx, y + 28, n.g, {fs: 10.5, c: P.mut}) : ''));
      if (n.assist) { out.push(scPath('M' + (X + 2) + ' ' + (y + 2) + ' q14 4 12 16', P.mono, 1.2) + scHook(X + 14, y + 18, P) + scT(lx, y + 42, scCut((n.jighead ? 'Jighead ' : 'Assist ') + (n.assist.name || '') + ' ' + (n.assist.size || ''), 34), {fs: 10, c: P.mut})); }
      y += 64;
    }
    else if (n.t === 'bed') { bedY = y + 2; y += 26; }
  });
  // dibe yatan köstekler (hırsız): dip çizgisi
  const yb = bedY != null ? bedY : y;
  ch.nodes.forEach((n, i) => {
    let path = '', x0, y0, label = n.label;
    if (n.t === 'trailTee') { x0 = n._x1; y0 = n._y + 1; }
    else if (n.t === 'trail') { const s = ch.nodes.find(m => m.t === 'sinker'); x0 = X + 2; y0 = (s ? s._y : yb - 6) + 43; }
    else return;
    const L = Math.min(196, Math.max(40, n.cm * 1.5)), c = n._c || mc(n.line), yy = yb - 3;
    const xe = Math.min(SC_W - 24, x0 + 26 + L);
    path = 'M' + x0 + ' ' + y0 + ' C' + (x0 + 16) + ' ' + (y0 + 2) + ' ' + (x0 + 20) + ' ' + (yy - 2) + ' ' + (x0 + 34) + ' ' + yy + ' L' + xe + ' ' + yy;
    const html = scPath(path, c, 1.6) + scHook(xe, yy, P, true) +
      scT(Math.min(x0 + 40, SC_W - 150), Math.min(y0 + 2, yy - 18) + (n.t === 'trail' ? 0 : -6), label + ' · ' + n.cm + ' cm' + (n.short ? ' (akış: %' + n.short + ' kısa)' : ''), {fs: 10.5, w: 600, c: n.short ? P.warn : P.txt}) +
      (n.hook ? scT(SC_W - 6, yy + 20, scCut(n.hook.name + (n.hook.size ? ' ' + n.hook.size : ''), 34), {fs: 10, c: P.mut, a: 'end'}) : '') +
      scKnot(x0, y0, n.t === 'trail' ? 'uni' : 'uni', P, false) + scKnot(xe, yy, 'snell', P, false);
    knots.push({k: 'uni', where: label + (n.t === 'trail' ? ' → kurşunun alt halkası' : ' → T-fırdöndü')}, {k: 'snell', where: label + ' → iğne'});
    const tok = '@@TRAIL' + i + '@@', at = out.indexOf(tok);
    if (at >= 0) out[at] = html; else out.push(html);
  });
  if (bedY != null) {
    out.unshift('<rect x="0" y="' + bedY + '" width="' + SC_W + '" height="22" style="fill:' + P.bed + '"/>' +
      Array.from({length: 22}, (_, j) => '<circle cx="' + (8 + j * 15.3).toFixed(1) + '" cy="' + (bedY + 7 + (j % 3) * 4) + '" r="1.4" style="fill:' + P.bed2 + '"/>').join('') +
      scT(8, bedY + 18, 'dip', {fs: 9.5, c: P.mut}));
  }
  const H = Math.max(y, (bedY || 0) + 26) + 6;
  const uniq = []; knots.forEach(x => { if (!uniq.some(u => u.k === x.k && u.where === x.where)) uniq.push(x); });
  const svg = '<svg class="rigsvg" viewBox="0 0 ' + SC_W + ' ' + H + '" width="100%" role="img" aria-label="' + esc((rg.code ? rg.code + ' ' : '') + 'rig şeması') + '" style="color:' + P.txt + ';max-width:' + (SC_W * 1.25) + 'px">' +
    (opt.pal === 'print' ? '<rect width="' + SC_W + '" height="' + H + '" style="fill:#fff"/>' : '') + out.join('') + '</svg>';
  return {svg, h: H, w: SC_W, knots: uniq, chain: ch};
}
