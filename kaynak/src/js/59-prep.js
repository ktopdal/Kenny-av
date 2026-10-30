// ---------------------------------------------------------------- 59 · hazırlama kartı (B3) · v0.25
// Rig kartında "Takım" satırına dokununca: şema (bugünkü ayarla), bu rigdeki düğümler, malzeme listesi (ne kadar ip, kaç iğne,
// kaç T-fırdöndü), ölçülü adım adım hazırlama ve kontroller. Malzeme satırları işaretlenebilir (bu cihazda tutulur).
// "Resim olarak kaydet" şemayı ve adımları tek resim yapar: tekneye telefonsuz götürmek ya da arkadaşına atmak için.
const PREP_TOP = 20, PREP_BOT = 15, PREP_KNOT = 10;   // fırdöndüden ilk T'ye ve son T'den kurşuna öneri boyları, bağ payı (cm)
const LSP = 'alyssa-prep';
function prepCtx(rid){
  const rg = RIGS[rid]; if (!rg) return null;
  const ds = days(), dd = ds.find(d => d.key === ui.fday) || ds.find(d => d.key === dateKey(new Date())) || ds[0] || null;
  const ld = leadFor(rg, dd);
  return {rg, dd, ld, sc: schemeSvg(rg, {ld})};
}
const hookTxt = h => h ? (h.name + (h.size ? ' ' + h.size : '')).trim() : '';
// malzeme: kalem, miktar, not (ip boyları cm cinsinden toplanır)
function rigMaterials(rg, ch){
  const N = ch.nodes, out = [];
  const tees = N.filter(n => n.t === 'tee' || n.t === 'trailTee'), trails = N.filter(n => n.t === 'trail'), legs = tees.concat(trails);
  const ana = N.find(n => n.t === 'line' && n.role === 'ana'), lead = N.find(n => n.t === 'leader');
  const bed = N.find(n => n.t === 'gap' && n.l);
  if (ana && ana.l) out.push({k: 'ana', t: 'Ana ip', v: lineNm(ana.l), q: 'makarada', item: ana.l.item});
  const sok = N.find(n => n.t === 'line' && n.role === 'sok'); if (sok && sok.l) out.push({k: 'sok', t: 'Şok lider', v: lineNm(sok.l), q: '≈ 10 m', item: sok.l.item, cm: 1000});
  if (bed && tees.length && (ch.lay === 'hirsizli' || ch.lay === 'iki' || ch.lay === 'tek' || ch.lay === 'canli' || ch.lay === 'paternoster' || ch.lay === 'surfhirsiz')) {
    const gaps = N.filter(n => n.t === 'gap' && n.cm).reduce((a, n) => a + n.cm, 0);
    const cm = PREP_TOP + gaps + PREP_BOT + PREP_KNOT * (tees.length + 2);
    out.push({k: 'beden', t: ch.lay === 'paternoster' || ch.lay === 'surfhirsiz' ? 'Beden (şok lider)' : 'Beden', v: lineNm(bed.l), q: '≈ ' + fmtNum(cm / 100, 1) + ' m', cm, item: bed.l.item});
  }
  if (legs.length) { const cm = legs.reduce((a, n) => a + n.cm + PREP_KNOT, 0), l = legs[0].line;
    out.push({k: 'kostek', t: 'Köstek', v: lineNm(l), q: '≈ ' + fmtNum(cm / 100, 1) + ' m', cm, item: l ? l.item : null}); }
  if (lead) out.push({k: 'lider', t: lead.label, v: lineNm(lead.l), q: fmtNum((lead.cm + 20) / 100, 1) + ' m', cm: lead.cm + 20, item: lead.l ? lead.l.item : null});
  const hooks = {};
  legs.forEach(n => { const h = hookTxt(n.hook); if (h) { hooks[h] = hooks[h] || {n: 0, item: n.hook.item, size: n.hook.size}; hooks[h].n++; } });
  N.filter(n => n.t === 'leader' && n.end && n.end.hook).forEach(n => { const h = hookTxt(n.end.hook); if (h) { hooks[h] = hooks[h] || {n: 0, item: n.end.hook.item, size: n.end.hook.size}; hooks[h].n++; } });
  N.filter(n => n.t === 'lure' && n.assist).forEach(n => { const h = hookTxt(n.assist); if (h) { hooks[h] = hooks[h] || {n: 0, item: n.assist.item, size: n.assist.size}; hooks[h].n++; } });
  Object.keys(hooks).forEach((h, i) => out.push({k: 'igne' + i, t: 'İğne', v: h, q: '× ' + hooks[h].n, n: hooks[h].n, item: hooks[h].item, size: hooks[h].size}));
  const nT = tees.length, nSw = N.filter(n => n.t === 'swivel').length;
  if (nT) out.push({k: 'tfir', t: 'T-fırdöndü', v: 'üç yollu fırdöndü', q: '× ' + nT});
  if (nSw) out.push({k: 'fir', t: 'Fırdöndü / klips', v: N.filter(n => n.t === 'swivel').map(n => n.label).join(', '), q: '× ' + nSw});
  if (N.some(n => n.t === 'sinker')) out.push({k: 'kursun', t: 'Kurşun', v: ch.kursun + (N.find(n => n.t === 'sinker').shape === 'piramit' ? ' piramit' : ' armut') + (N.find(n => n.t === 'sinker').ring2 ? ' (iki halkalı)' : ''), q: 'klipsle'});
  if (N.some(n => n.t === 'slide')) out.push({k: 'gezer', t: N.find(n => n.t === 'slide').small ? 'Saçma kurşun' : 'Gezer kurşun', v: N.find(n => n.t === 'slide').g || '', q: ''});
  if (N.some(n => n.t === 'bead')) out.push({k: 'boncuk', t: 'Stop boncuk', v: '', q: '× ' + N.filter(n => n.t === 'bead').length});
  const lure = N.find(n => n.t === 'lure' || n.t === 'sabiki'); if (lure) out.push({k: 'yem', t: lure.t === 'sabiki' ? 'Çapari' : 'Sahte yem', v: lure.label + (lure.g ? ' · ' + lure.g : lure.size ? ' · ' + lure.size : ''), q: '× 1'});
  if (N.some(n => n.t === 'float')) out.push({k: 'samandira', t: 'Şamandıra', v: '', q: '× 1'});
  if (rg.gear && rg.gear.rod) out.push({k: 'kamis', t: 'Kamış', v: rg.gear.rod.it.name, q: ''});
  if (rg.gear && rg.gear.reel) out.push({k: 'makine', t: 'Makine', v: rg.gear.reel.it.name, q: ''});
  return out;
}
// adım adım hazırlama
function prepSteps(rg, ch, ld){
  const N = ch.nodes, S_ = [], push = s => S_.push(s);
  const K = k => (KNOTS[k] || {}).name || k;
  const ana = N.find(n => n.t === 'line' && n.role === 'ana'), lead = N.find(n => n.t === 'leader');
  const tees = N.filter(n => n.t === 'tee' || n.t === 'trailTee'), trails = N.filter(n => n.t === 'trail'), legs = tees.concat(trails);
  const sw = N.find(n => n.t === 'swivel'), k0 = N.find(n => n.t === 'knot');
  const anaT = ana && ana.l ? lineNm(ana.l) : 'ana ip';
  if (ch.lay === 'hirsizli' || ch.lay === 'iki' || ch.lay === 'tek' || ch.lay === 'canli' || ch.lay === 'paternoster' || ch.lay === 'surfhirsiz') {
    if (ch.lay === 'paternoster' || ch.lay === 'surfhirsiz') push('Ana ipi (' + anaT + ') şok lidere ' + K('ciftuni') + ' ile ekle; şok lider makarada en az 5–6 tur kalsın.');
    else push('Ana ipi (' + anaT + ') fırdöndüye ' + K(k0 ? k0.k : 'palomar') + ' ile bağla.');
    const bed = N.find(n => n.t === 'gap' && n.l), bl = bed && bed.l ? bed.l.txt : '';
    const seq = [ch.lay === 'paternoster' || ch.lay === 'surfhirsiz' ? 'şok lider' : 'fırdöndü', PREP_TOP + ' cm'];
    N.forEach(n => { if (n.t === 'tee' || n.t === 'trailTee') seq.push(trLower(n.label) + ' T-fırdöndüsü'); else if (n.t === 'gap' && n.cm) seq.push(n.cm + ' cm'); });
    const hAlt = trails.length > 0;
    seq.push(PREP_BOT + ' cm', hAlt ? 'kurşun (üst halka)' : 'kurşun klipsi');
    push('Bedeni (' + (bed && bed.l ? lineNm(bed.l) : 'florokarbon') + ') parça parça şu sırayla bağla, her bağ ' + K('uni') + ': ' + seq.join(' → ') + '.');
    if (legs.length) push('Köstekleri ' + (legs[0].line ? lineNm(legs[0].line) + ' ipinden ' : '') + 'kes (her birine ' + PREP_KNOT + ' cm bağ payı ekle): ' + legs.map(n => trLower(n.label) + ' ' + (n.cm + PREP_KNOT) + ' cm').join(', ') + '.');
    const hk = {}; legs.forEach(n => { const h = hookTxt(n.hook); if (h) (hk[h] = hk[h] || []).push(trLower(n.label)); });
    if (Object.keys(hk).length) push('İğneleri köstek uçlarına ' + K('snell') + ' ile bağla: ' + Object.keys(hk).map(h => hk[h].join(' ve ') + ' → ' + h).join('; ') + '.');
    push('Köstekleri T-fırdöndülerin yan halkasına ' + K('uni') + ' ile bağla' + (hAlt ? '; hırsızı kurşunun alt halkasına bağla.' : '.'));
    if (ld && ld.short && legs.some(n => n.k === 'hirsiz')) push('Akış güçlü: hırsızı %' + (ld.short === true ? 20 : ld.short) + ' kısa bağla (' + (ld.hirsiz || '') + ' cm; normalde ' + ((rg.lengths || {}).hirsiz || '') + ' cm).');
  } else if (ch.lay === 'canliagir') {
    if (lead) push('Lideri ' + fmtNum((lead.cm + 20) / 100, 1) + ' m kes (' + (lead.l ? lead.l.txt : 'kalın florokarbon') + '); çiftlik halatı ve ağına sürtünmeye karşı uzun kalsın.');
    push('Ana ipi (' + anaT + ') lidere ' + K('fg') + ' ile bağla; düğümü makaraya sarmadan önce sık ve ıslat.');
    push('Liderin ucuna rulmanlı fırdöndüyü ' + K('palomar') + ' ile bağla; fırdöndünün alt halkasına bir halka (solid ring) tak.');
    if (legs[0]) push('Canlı yem kösteğini ' + (legs[0].cm + PREP_KNOT) + ' cm kes; halkaya ' + K('uni') + ', iğneye' + (hookTxt(legs[0].hook) ? ' (' + hookTxt(legs[0].hook) + ')' : '') + ' ' + K('snell') + ' ile bağla.');
    push('Kurşunu (' + ch.kursun + ') halkaya ince bir misina ya da kalın lastikle (kopma bağı) bağla: balık takılınca kurşun kopar, balık serbest çekilir.');
  } else if (ch.lay === 'kaydirmali') {
    push('Gezer kurşunu (' + ch.kursun + ') ve stop boncuğu ana ipe (' + anaT + ') geçir.');
    push('Ana ipi fırdöndüye ' + K(k0 ? N.filter(n => n.t === 'knot')[0].k : 'palomar') + ' ile bağla.');
    if (lead) push('Kösteği ' + lead.cm + ' cm (+' + PREP_KNOT + ' cm bağ payı) kes, fırdöndünün alt halkasına ' + K('uni') + ' ile bağla.');
    if (lead && lead.end && lead.end.hook) push('İğneyi (' + hookTxt(lead.end.hook) + ') ' + K('snell') + ' ile bağla.');
  } else if (ch.lay === 'capari') {
    push('Ana ipi (' + anaT + ') klipsli fırdöndüye ' + K(k0 ? k0.k : 'palomar') + ' ile bağla.');
    push('Çapari takımını üstteki klipse, kurşunu (' + ch.kursun + ') alttaki klipse tak.');
  } else if (ch.lay === 'samandira') {
    push('Stopu, şamandırayı ve saçma kurşunu ana ipe geçir; derinliği stoptan ayarla.');
    push('Ana ipi fırdöndüye ' + K('uni') + ' ile bağla.');
    if (lead) push('Kösteği ' + lead.cm + ' cm kes, fırdöndüye ' + K('uni') + ', iğneye (' + hookTxt(lead.end && lead.end.hook) + ') ' + K('snell') + ' ile bağla.');
  } else {
    const kk = N.filter(n => n.t === 'knot');
    if (lead) push('Lideri ' + lead.cm + ' cm kes (' + (lead.l ? lead.l.txt : 'florokarbon') + ').');
    if (kk[0]) push('Ana ipi (' + anaT + ') lidere ' + K(kk[0].k) + ' ile bağla.');
    if (kk[1]) push('Liderin ucuna ' + trLower(sw ? sw.label : 'klips') + ' ' + K(kk[1].k) + ' ile bağla.');
    const lu = N.find(n => n.t === 'lure'); if (lu) push('Yemi (' + lu.label + (lu.g ? ', ' + lu.g : '') + ') ' + trLower(sw ? sw.label : 'klips') + 'a tak' + (lu.assist ? '; assist iğneleri (' + hookTxt(lu.assist) + ') halkaya, jigin baş tarafına' : '') + '.');
  }
  if (N.some(n => n.t === 'sinker') && ch.lay !== 'capari' && ch.lay !== 'canliagir') push('Kurşunu (' + ch.kursun + ') klipse tak' + ((rg.bottom || []).some(b => b === 'kayalik' || b === 'saf-kayalik') || rg.own ? '. Kayalıkta kurşunu bedenden ince bir misinayla bağla (kopma bağı): takılırsa yalnız kurşun gider.' : '.'));
  push('Bütün düğümleri ıslatıp tek tek çek; ucu 2–3 mm bırakıp kes.');
  return S_;
}
// kontroller: dolaşma, akış, kamış sınırı, köstek–beden kalınlığı, dişli tür
function prepChecks(rg, ch, ld){
  const out = [], N = ch.nodes;
  const tees = N.filter(n => n.t === 'tee' || n.t === 'trailTee');
  tees.forEach((n, i) => { const gap = N.slice(N.indexOf(n) + 1).find(m => m.t === 'gap' && m.cm); const next = tees[i + 1];
    if (next && gap) out.push(n.cm >= gap.cm ? {bad: true, t: n.label + ' (' + n.cm + ' cm) köstek arasından (' + gap.cm + ' cm) uzun: alttaki köstekle dolaşır; ' + Math.max(10, gap.cm - 10) + ' cm’ye kısalt.'} : {t: n.label + ' ' + n.cm + ' cm < köstek arası ' + gap.cm + ' cm: dolaşmaz.'}); });
  const bed = N.find(n => n.t === 'gap' && n.l), leg = tees[0] || N.find(n => n.t === 'trail');
  if (bed && bed.l && bed.l.mm && leg && leg.line && leg.line.mm) {
    if (leg.line.mm > bed.l.mm + 0.001) out.push({bad: true, t: 'Köstek (' + mmS(leg.line.mm) + ') bedenden (' + mmS(bed.l.mm) + ') kalın: takılınca beden kopar. Köstek bedenden ince olmalı.'});
    else out.push({t: 'Köstek (' + mmS(leg.line.mm) + ') bedenden (' + mmS(bed.l.mm) + ') ince: takılırsa yalnız köstek gider.'});
  }
  if (ld && ld.short) out.push({t: 'Akış güçlü: hırsız %' + (ld.short === true ? 20 : ld.short) + ' kısa, köstekler dolaşmasın.'});
  if (ld && ld.over) out.push({bad: true, t: 'Gereken kurşun ≈ ' + ld.need + ' g, sınır ' + ld.max + ' g: paraşüt çapa at ya da demirle.'});
  else if (ld && ld.rodCap) out.push({t: 'Kamışın en fazla ' + ld.max + ' g taşır; kurşunu buna göre seç.'});
  const teeth = (rg.species || []).filter(s => KB.TEETH && KB.TEETH[s]);
  if (teeth.length) out.push({t: 'Dişli tür (' + teeth.map(spName).join(', ') + '): ' + (KB.TEETH[teeth[0]] === 'steel' ? 'çelik tel' : 'kalın florokarbon') + ' lider kullan.'});
  gearIssues(rg).forEach(g => out.push({bad: g.bad, t: g.txt + (g.why ? ': ' + g.why : '')}));
  out.push({t: 'Yedek: en az 2 köstek ve 3 iğne hazırla; tekneye bağlı götür.'});
  return out;
}
const prepGet = () => { try { return JSON.parse(lsGet(LSP) || '{}') || {}; } catch (e) { return {}; } };
// v0.29.3 · malzeme satırından rigin yuvası: iğne, ip ve sahte yem "Değiştir" ile parça sayfasına gider (orada başka parça seçilir)
function matSlot(rg, m){
  const env = sl => sl.t.envanter || {};
  if (m.k.indexOf('igne') === 0) {
    const hs = rg.slots.filter(sl => partKind(sl) === 'hook');
    const s = hs.find(sl => env(sl).item === m.item && (env(sl).size || null) === (m.size || null)) || hs.find(sl => m.item && env(sl).item === m.item) || (hs.length === 1 ? hs[0] : null);
    return s ? s.k : null;
  }
  if (m.k === 'yem') { const s = rg.slots.find(sl => partKind(sl) === 'lure'); return s ? s.k : null; }
  const keys = {ana: ['braid', 'ana', 'mono'], sok: ['sok'], beden: ['beden'], kostek: ['kostek', 'lider'], lider: ['lider', 'kostek']}[m.k];
  if (!keys) return null;
  const s = keys.map(k => rg.slots.find(sl => sl.k === k)).find(Boolean) || rg.slots.find(sl => slotIsLine(sl) && m.item && env(sl).item === m.item);
  return s ? s.k : null;
}
function openPrep(rid, keep){
  const c = prepCtx(rid); if (!c) { toast('Rig bulunamadı'); return; }
  ui.sheet = 'prep'; ui.sheetArg = rid;
  const {rg, ld, sc} = c, ch = sc.chain, mats = rigMaterials(rg, ch), steps = prepSteps(rg, ch, ld), checks = prepChecks(rg, ch, ld);
  const done = (prepGet()[rid] || {});
  const kn = {}; sc.knots.forEach(x => { (kn[x.k] = kn[x.k] || []).push(x.where); });
  const sec = (t, body) => '<section class="set"><h4>' + t + '</h4>' + body + '</section>';
  const hasH = ch.nodes.some(n => n.t === 'trailTee' && n.k === 'hirsiz') || ch.nodes.some(n => n.t === 'trail');
  openSheet(sheetBar((rg.code ? rg.code + ' · ' : '') + 'Hazırlama') + '<div class="stack prep">' +
    '<p class="sub">' + esc(rg.name) + (rg.groupName ? ' · ' + esc(rg.groupName) : '') + '</p>' +
    (ld && (ld.short || ld.kursun) ? '<p class="note">Bugünkü ayar: ' + esc([ld.kursun ? 'kurşun ' + stripTags(ld.kursun) : '', ld.short ? 'hırsız %' + (ld.short === true ? 20 : ld.short) + ' kısa' : ''].filter(Boolean).join(' · ')) + '</p>' : '') +
    '<div class="schemewrap">' + sc.svg + '</div>' +
    (hasH ? '<div class="row hpos"><span class="note">Hırsız</span>' + segBtns('hirsizPos', [['ust', 'Kurşunun üstünde'], ['alt', 'Kurşunun altında']], hirsizPos()) + '</div>' : '') +
    sec('Bu rigdeki düğümler', '<div class="knrow">' + Object.keys(kn).map(k => '<button type="button" class="btn small" data-knot="' + k + '" data-kwhere="' + esc(kn[k].join('|')) + '">' + esc(KNOTS[k].name) + ' <small>× ' + kn[k].length + '</small></button>').join('') + '</div><p class="note">Şemadaki renkli noktalara da dokunabilirsin.</p>') +
    sec('Malzeme', '<ul class="mats">' + mats.map(m => { const sk = matSlot(rg, m);
      return '<li' + (sk ? ' class="chg"' : '') + '><label><input type="checkbox" data-prepchk="' + esc(rid + '|' + m.k) + '"' + (done[m.k] ? ' checked' : '') + '><span><b>' + esc(m.t) + '</b> ' + esc(m.v || '') + '</span><em>' + esc(m.q || '') + '</em></label>' +
        (sk ? '<button class="linkbtn mchg" type="button" data-part="' + esc(rid + '|' + sk) + '" aria-label="' + esc(m.t + ' değiştir') + '">Değiştir</button>' : '') + '</li>'; }).join('') + '</ul>' +
      '<p class="note">Beden boyu öneridir: fırdöndüden ilk T’ye ' + PREP_TOP + ' cm, son T’den kurşuna ' + PREP_BOT + ' cm ve her bağa ' + PREP_KNOT + ' cm pay. <button class="linkbtn" type="button" data-prepreset="' + esc(rid) + '">İşaretleri sıfırla</button></p>') +
    sec('Adım adım', '<ol class="psteps">' + steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>') +
    sec('Kontrol', '<ul class="pchecks">' + checks.map(x => '<li class="' + (x.bad ? 'bad' : 'ok') + '">' + (x.bad ? '⚠ ' : '✓ ') + esc(x.t) + '</li>').join('') + '</ul>') +
    rigPhotoHtml(rid) +
    '<div class="row prepbtns"><button class="btn primary" type="button" data-done="' + esc(rid) + '">Rig hazırladım</button><button class="btn" type="button" data-prepimg="' + esc(rid) + '">Resim olarak kaydet</button>' +
      (edOk(rg) ? '<button class="btn" type="button" data-redit="' + esc(rid) + '">' + (rg.sys === 'atolye' ? 'Düzenle' : 'Kopyasını düzenle') + '</button>' : '') +
      '<button class="btn" type="button" data-gear="' + esc(rid) + '">Kamış ve makine</button></div>' +
    '<p class="note">“Rig hazırladım” iğneleri envanterden düşer; “Kopyasını düzenle” bu rigden kendi rigini yapar (asıl rig değişmez).</p>' +
    '</div>', keep);
  fillRigPhotos($('sheet'));
}
function prepCheck(val, on){
  const [rid, k] = val.split('|'); const all = prepGet(); all[rid] = all[rid] || {};
  if (on) all[rid][k] = 1; else delete all[rid][k];
  lsSet(LSP, JSON.stringify(all));
}
// ---- resim olarak kaydet: şema + adımlar + malzeme (açık renk, beyaz zemin)
function wrapTxt(s, n){ const w = String(s).split(' '), out = []; let l = ''; w.forEach(x => { if ((l + ' ' + x).trim().length > n) { if (l) out.push(l); l = x; } else l = (l + ' ' + x).trim(); }); if (l) out.push(l); return out; }
function prepImageSvg(rid, photo){
  const c = prepCtx(rid); if (!c) return null;
  const {rg, ld} = c, sc = schemeSvg(rg, {ld, pal: 'print'}), ch = sc.chain, P = SC_PAL.print;
  const W = 720, pad = 24, txt = [];
  let y = 40;
  const T = (s, o) => { txt.push('<text x="' + (o && o.x || pad) + '" y="' + y + '" style="font:' + (o && o.w || 400) + ' ' + (o && o.fs || 15) + 'px system-ui,-apple-system,sans-serif;fill:' + (o && o.c || P.txt) + '">' + esc(s) + '</text>'); };
  T((rg.code ? rg.code + ' · ' : '') + rg.name, {w: 700, fs: 22}); y += 24;
  T([rg.groupName, ld && ld.kursun ? 'kurşun ' + stripTags(ld.kursun) : '', ld && ld.short ? 'hırsız %' + (ld.short === true ? 20 : ld.short) + ' kısa' : ''].filter(Boolean).join(' · '), {c: P.mut, fs: 14}); y += 10;
  const sw = 340, sh = sc.h * (sw / sc.w);
  const scheme = '<svg x="' + pad + '" y="' + y + '" width="' + sw + '" height="' + sh.toFixed(0) + '" viewBox="0 0 ' + sc.w + ' ' + sc.h + '">' + sc.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</svg>';
  // sağ sütun: (fotoğraf) + malzeme
  let ry = y + 18; const rx = pad + sw + 18, right = [];
  if (photo) { right.push('<image x="' + rx + '" y="' + (ry - 10) + '" width="' + (W - rx - pad) + '" height="210" preserveAspectRatio="xMidYMid slice" href="' + photo + '"/>'); ry += 214; }
  const R = (s, o) => { right.push('<text x="' + rx + '" y="' + ry + '" style="font:' + (o && o.w || 400) + ' ' + (o && o.fs || 13) + 'px system-ui,-apple-system,sans-serif;fill:' + (o && o.c || P.txt) + '">' + esc(s) + '</text>'); ry += (o && o.lh) || 18; };
  R('Malzeme', {w: 700, fs: 15, lh: 22});
  rigMaterials(rg, ch).forEach(m => wrapTxt('☐ ' + m.t + ': ' + (m.v || '') + (m.q ? ' (' + m.q + ')' : ''), 40).forEach((l, i) => R(l, {fs: 12.5, c: i ? P.mut : P.txt, lh: 17})));
  ry += 8; R('Düğümler', {w: 700, fs: 15, lh: 22});
  const kn = {}; sc.knots.forEach(x => { kn[x.k] = (kn[x.k] || 0) + 1; });
  Object.keys(kn).forEach(k => R('• ' + KNOTS[k].name + ' × ' + kn[k] + ' (' + KNOTS[k].str + ')', {fs: 12.5, lh: 17}));
  y = Math.max(y + sh, ry) + 20;
  T('Adım adım', {w: 700, fs: 16}); y += 22;
  prepSteps(rg, ch, ld).forEach((s, i) => { wrapTxt((i + 1) + '. ' + s, 92).forEach(l => { T(l, {fs: 13.5}); y += 19; }); y += 3; });
  y += 8; T('Kontrol', {w: 700, fs: 16}); y += 22;
  prepChecks(rg, ch, ld).forEach(x => { wrapTxt((x.bad ? '⚠ ' : '✓ ') + x.t, 92).forEach(l => { T(l, {fs: 13, c: x.bad ? P.warn : P.txt}); y += 18; }); });
  y += 14; T(APP_NAME + ' · ' + fmtDT(new Date()), {fs: 11, c: P.mut}); y += 16;
  return {w: W, h: Math.ceil(y), svg: '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + Math.ceil(y) + '" viewBox="0 0 ' + W + ' ' + Math.ceil(y) + '"><rect width="100%" height="100%" fill="#fff"/>' + scheme + right.join('') + txt.join('') + '</svg>'};
}
function svgToPngBlob(svg, w, h, scale){
  return new Promise((res, rej) => {
    const img = new Image(); const s = scale || 2;
    img.onload = () => { try { const cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s); const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob(b => b ? res(b) : rej(new Error('png')), 'image/png'); } catch (e) { rej(e); } };
    img.onerror = () => rej(new Error('svg'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.indexOf('xmlns=') < 0 ? svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"') : svg);
  });
}
// paylaş (telefonda paylaşım menüsü) ya da indir
async function shareImage(blob, name, title){
  const file = new File([blob], name, {type: 'image/png'});
  try { if (navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], title}); return 'share'; } } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return 'download';
}
async function prepImage(rid){
  const r = prepImageSvg(rid, await rigPhotoData(rid)); if (!r) return;
  try { const b = await svgToPngBlob(r.svg, r.w, r.h, 2); const rg = RIGS[rid]; const how = await shareImage(b, slugTR((rg.code || 'rig') + '-' + rg.name).slice(0, 40) + '.png', rg.name);
    if (how === 'download') toast('Resim indirildi'); }
  catch (e) { toast('Resim hazırlanamadı'); }
}
