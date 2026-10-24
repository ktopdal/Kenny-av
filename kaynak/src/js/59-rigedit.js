// ---------------------------------------------------------------- 59 · rig editörü (B4) · v0.26
// Hazırlama sayfasındaki "Düzenle" bir rigin kopyasını açar (özel paketteki rig ve envanter hiç değişmez): köstek ekle / çıkar,
// boy ve iğne değiştir, köstek arası, ana ip / beden / köstek ipi, kurşun. Şema canlı değişir; motor dolaşma, kalınlık, akış ve kamış
// sınırı için uyarır. Kaydedince "Rig Atölyem" sisteminde kendi rigin olur; öneriye ve Fishing'e girer.
const ED_LAYS = ['hirsizli', 'iki', 'tek', 'canli'];
let RED = null;   // düzenlenen taslak
const edLay = rg => rg.sys === 'ozel' ? 'hirsizli' : rg.lay;
const edOk = rg => !!rg && (!!rg.legs || ED_LAYS.includes(edLay(rg)));
// bir rigden düzenlenebilir taslak (yalnız veriler; envanter kalemleri kimlikle)
function rigToDraft(rg){
  const ch = rigChain(rg, null), N = ch.nodes;
  const legs = N.filter(n => n.t === 'tee' || n.t === 'trailTee' || n.t === 'trail').map((n, i) => ({k: 'h' + (i + 1), label: n.label, cm: n.cm, trail: n.t !== 'tee',
    hook: n.hook && n.hook.item ? {item: n.hook.item, size: n.hook.size || null} : null}));
  const lineOf = k => { const sl = rg.slots.find(s => s.k === k); const e = sl && sl.t.envanter || {}; return e.item ? e.item : null; };
  const gap = N.find(n => n.t === 'gap' && n.cm);
  return {id: rg.sys === 'atolye' ? rg.id : null, src: rg.sys === 'atolye' ? rg.src : rg.id, name: rg.sys === 'atolye' ? rg.name : rg.name + ' (benim)',
    lay: edLay(rg), mode: rg.mode || 'tekne', tech: rg.tech, legs, ara: gap ? gap.cm : (rg.lengths && rg.lengths.ara) || 50,
    ana: lineOf('braid') || lineOf('ana') || lineOf('mono'), beden: lineOf('beden'), kostek: lineOf('kostek'),
    g: rg.sinker && rg.sinker.g ? rg.sinker.g.slice() : [100, 120], gmax: rg.sinker && rg.sinker.max || null,
    gear: rg.slots.filter(s => s.kind === 'rod' || s.kind === 'reel' || s.kind === 'term').map(s => ({k: s.k, label: s.label, kind: s.kind, sp: s.sp || null, t: {turkiye: (s.t || {}).turkiye || {}, envanter: {item: null, name: '', size: null}}})),
    meta: {species: rg.species || [], klass: rg.klass, time: rg.time, bottom: rg.bottom || [], season: rg.season || null, window: rg.window || null, current: !!rg.current,
      baits: rg.baits || null, baitText: rg.baitText || '', target: rg.target || '', own: !!rg.own, group: rg.group || null, groupName: rg.groupName || '',
      setupId: rg.sys === 'ozel' ? rg.group : rg.setupId || null}};
}
// taslaktan kayıtlı rig nesnesi (Rig Atölyem sistemi; slotlarda envanter kalemi sabit, kamış/makine/terminal ölçüyle çözülür)
function draftToRig(d){
  const it = id => id && ITEMS[id];
  const lineSlot = (k, label, id) => ({k, label, kind: 'line', t: {envanter: {item: id || null, name: it(id) ? it(id).name : '', size: null}}});
  const slots = d.legs.map(l => ({k: l.k, label: l.label, kind: 'hook', t: {envanter: {item: l.hook ? l.hook.item : null, size: l.hook ? l.hook.size : null, name: l.hook && it(l.hook.item) ? it(l.hook.item).name : ''}}}))
    .concat([lineSlot('braid', 'Ana ip', d.ana), lineSlot('beden', 'Beden', d.beden), lineSlot('kostek', 'Köstek', d.kostek)])
    .concat(d.gear.map(g => JSON.parse(JSON.stringify(g))));
  const trail = d.legs.find(l => l.trail);
  const lengths = {ara: d.ara}; d.legs.forEach(l => { lengths[l.k] = l.cm; }); if (trail) lengths.hirsiz = trail.cm;
  const m = d.meta;
  return {id: d.id, src: d.src, code: d.code || null, name: (d.name || '').trim() || 'Rigim', sys: 'atolye', mode: d.mode, tech: d.tech, lay: d.lay, legs: d.legs.map(l => Object.assign({}, l)),
    slots, lengths, sinker: {g: d.g.slice(), max: d.gmax || null}, species: m.species, klass: m.klass, time: m.time, bottom: m.bottom, season: m.season, window: m.window,
    current: m.current, core: false, baits: m.baits, baitText: m.baitText, target: m.target, own: m.own, group: 'atolye', groupName: 'Rig Atölyem', success: null, setupId: m.setupId || null,
    notes: d.src && RIGS[d.src] ? [{k: 'Kaynak', t: (RIGS[d.src].code ? RIGS[d.src].code + ' · ' : '') + RIGS[d.src].name + ' rigini değiştirdin'}] : []};
}
// editörün uyarıları
function edWarn(r, ld){
  const out = [], legs = r.legs || [], ara = r.lengths.ara;
  legs.forEach((l, i) => { if (!l.trail && i < legs.length - 1 && l.cm >= ara) out.push({bad: true, t: (i + 1) + '. köstek (' + l.cm + ' cm) köstek arasından (' + ara + ' cm) uzun: alttaki köstekle dolaşır.'});
    if (!l.trail && l.cm < 8 && !r.own) out.push({t: (i + 1) + '. köstek ' + l.cm + ' cm: çok kısa, yem doğal durmaz (kayalık değilse).'}); });
  if (legs.filter(l => !l.trail).length >= 4) out.push({t: 'Dört ve daha çok köstek: dolaşma ve dibe takılma artar.'});
  if (ara < 30 && legs.length > 1) out.push({t: 'Köstek arası ' + ara + ' cm: kısa, köstekler birbirine yaklaşır.'});
  const tr = legs.find(l => l.trail);
  if (tr && ld && ld.short) out.push({bad: tr.cm > 100, t: 'Şu an akış güçlü: hırsız %' + (ld.short === true ? 20 : ld.short) + ' kısa bağlanmalı (' + Math.round(tr.cm * (1 - (ld.short === true ? 20 : ld.short) / 100)) + ' cm).'});
  else if (tr && tr.cm > 150) out.push({t: 'Hırsız ' + tr.cm + ' cm: çok uzun, akışta dolanır.'});
  const ln = k => { const sl = r.slots.find(s => s.k === k); const e = sl && sl.t.envanter; return e && e.item && ITEMS[e.item] ? lineMm(ITEMS[e.item]) : null; };
  const kb = ln('beden'), kk = ln('kostek');
  if (kb && kk && kk > kb + 0.001) out.push({bad: true, t: 'Köstek (' + mmS(kk) + ') bedenden (' + mmS(kb) + ') kalın: takılınca beden kopar.'});
  r.slots.filter(s => s.kind === 'hook' || s.kind === 'line').forEach(s => { const e = s.t.envanter || {}; if (!e.item) out.push({bad: true, t: s.label + ': seçilmedi.'}); else if (!usable(stockOf(e.item, e.size))) out.push({t: s.label + ': ' + ITEMS[e.item].name + (e.size ? ' ' + e.size : '') + ' elinde yok (alışveriş listesine düşer).'}); });
  const rm = rigRodMax(r); if (rm && r.sinker.g[0] > rm) out.push({bad: true, t: 'Kurşun ' + r.sinker.g[0] + ' g: kamışın en fazla ' + rm + ' g taşır.'});
  gearIssues(r).forEach(g => out.push({bad: g.bad, t: g.txt + (g.why ? ': ' + g.why : '')}));
  return out;
}
// envanterden seçenekler
function hookOpts(cur){
  const out = []; Object.values(ITEMS).filter(i => i.cat === 'hook').sort((a, b) => trCmp(a.name, b.name)).forEach(it => sizesOf(it).forEach(sz => {
    const st = stockOf(it.id, sz), v = it.id + '|' + sz; if (!usable(st) && !(cur && cur === v) && !toBuy(st)) return;
    out.push([v, it.name + (sz !== '-' ? ' ' + sz : '') + (usable(st) ? '' : ' (' + trLower(ST_TXT[st]) + ')')]); }));
  return out;
}
const lineOpts = (cats, cur) => Object.values(ITEMS).filter(i => cats.includes(i.cat) && (usable(stockOf(i.id, '-')) || i.id === cur || toBuy(stockOf(i.id, '-')))).sort((a, b) => (lineMm(a) || 0) - (lineMm(b) || 0))
  .map(i => [i.id, i.name + (usable(stockOf(i.id, '-')) ? '' : ' (' + trLower(ST_TXT[stockOf(i.id, '-')]) + ')')]);
const edSel = (id, opts, cur, ph) => '<select class="edsel" data-edsel="' + esc(id) + '"><option value="">' + esc(ph || '— seç —') + '</option>' + opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>';
const edStep = (op, val, unit) => '<span class="edstep"><button type="button" class="btn small" data-ed="' + op + '|-" aria-label="Azalt">−</button><b>' + val + (unit || '') + '</b><button type="button" class="btn small" data-ed="' + op + '|+" aria-label="Arttır">+</button></span>';
function openEditor(rid){
  const rg = RIGS[rid]; if (!edOk(rg)) { toast('Bu rig türü henüz düzenlenemiyor'); return; }
  RED = rigToDraft(rg); renderEditor();
}
function renderEditor(keep){
  const d = RED; ui.sheet = 'redit'; ui.sheetArg = d.id || d.src;
  const r = resolveRig(Object.assign({}, draftToRig(d), {id: d.id || 'atolye:taslak'}));
  const ds = days(), dd = ds.find(x => x.key === ui.fday) || ds[0] || null, ld = leadFor(r, dd);
  const sc = schemeSvg(r, {ld}), W = edWarn(r, ld);
  const legRow = (l, i) => '<div class="edleg"><div class="edlh"><b>' + (i + 1) + '. ' + esc(l.label) + '</b>' + (d.legs.length > 1 ? '<button class="linkbtn" type="button" data-ed="del|' + i + '">Çıkar</button>' : '') + '</div>' +
    '<div class="edlr"><span class="note">Boy</span>' + edStep('cm:' + i, l.cm, ' cm') + (i === d.legs.length - 1 && ['hirsizli', 'iki'].includes(d.lay) ? '<label class="chk note"><input type="checkbox" data-edchk="trail"' + (l.trail ? ' checked' : '') + '> Hırsız (dibe yatar)</label>' : '') + '</div>' +
    '<div class="edlr"><span class="note">İğne</span>' + edSel('hook:' + i, hookOpts(l.hook ? l.hook.item + '|' + (l.hook.size || '-') : ''), l.hook ? l.hook.item + '|' + (l.hook.size || '-') : '', '— iğne seç —') + '</div></div>';
  openSheet(sheetBar(d.id ? 'Rigi düzenle' : 'Rigimi yap', '<button class="btn primary" type="button" data-ed="save|">Kaydet</button>') + '<div class="stack edit">' +
    '<label class="f">Rigin adı<input id="ed-name" value="' + esc(d.name || '') + '" maxlength="60"></label>' +
    (d.src && RIGS[d.src] && !d.id ? '<p class="note">' + esc((RIGS[d.src].code ? RIGS[d.src].code + ' · ' : '') + RIGS[d.src].name) + ' rigi kopyalandı; asıl rig ve envanterin değişmez.</p>' : '') +
    '<div class="schemewrap">' + sc.svg + '</div>' +
    (W.length ? '<ul class="pchecks edwarn">' + W.map(x => '<li class="' + (x.bad ? 'bad' : 'ok') + '">' + (x.bad ? '⚠ ' : '• ') + esc(x.t) + '</li>').join('') + '</ul>' : '<p class="note okline">✓ Dolaşma, kalınlık ve kamış sınırı uygun.</p>') +
    '<section class="set"><h4>Köstekler</h4>' + d.legs.map(legRow).join('') +
      (d.legs.length < 5 ? '<button class="btn small" type="button" data-ed="add|">+ Köstek ekle</button>' : '') +
      (d.legs.length > 1 ? '<div class="edlr"><span class="note">Köstek arası</span>' + edStep('ara', d.ara, ' cm') + '</div>' : '') + '</section>' +
    '<section class="set"><h4>İpler</h4>' +
      '<div class="edlr"><span class="note">Ana ip</span>' + edSel('ana', lineOpts(['braid', 'mono'], d.ana), d.ana || '') + '</div>' +
      '<div class="edlr"><span class="note">Beden</span>' + edSel('beden', lineOpts(['fc', 'mono'], d.beden), d.beden || '') + '</div>' +
      '<div class="edlr"><span class="note">Köstek</span>' + edSel('kostek', lineOpts(['fc', 'mono'], d.kostek), d.kostek || '') + '</div></section>' +
    '<section class="set"><h4>Kurşun</h4><div class="edlr"><span class="note">En az</span>' + edStep('g0', d.g[0], ' g') + '<span class="note">en çok</span>' + edStep('g1', d.g[1], ' g') + '</div>' +
      (rigRodMax(r) ? '<p class="note">Rigdeki kamış en fazla ' + rigRodMax(r) + ' g taşır.</p>' : '') + '</section>' +
    (d.id ? '<button class="btn" type="button" data-ed="remove|" style="color:var(--D)">Bu rigi sil</button>' : '') + '</div>', keep);
}
function edAct(op, arg, b){
  const d = RED; if (!d) return;
  const [o, i] = op.split(':');
  if (o === 'cm') { const l = d.legs[+i]; l.cm = Math.max(5, Math.min(250, l.cm + (arg === '+' ? 5 : -5))); }
  else if (o === 'ara') d.ara = Math.max(15, Math.min(150, d.ara + (arg === '+' ? 5 : -5)));
  else if (o === 'g0') { d.g[0] = Math.max(10, Math.min(d.g[1], d.g[0] + (arg === '+' ? 10 : -10))); }
  else if (o === 'g1') { d.g[1] = Math.max(d.g[0], Math.min(600, d.g[1] + (arg === '+' ? 10 : -10))); }
  else if (o === 'del') { d.legs.splice(+arg, 1); edRelabel(d); }
  else if (o === 'add') {
    const tr = d.legs.findIndex(l => l.trail), at = tr >= 0 ? tr : d.legs.length, prev = d.legs[Math.max(0, at - 1)];
    d.legs.splice(at, 0, {k: 'h' + Date.now().toString(36).slice(-4), label: '', cm: prev && !prev.trail ? prev.cm : 25, trail: false, hook: prev && prev.hook ? Object.assign({}, prev.hook) : null}); edRelabel(d);
  }
  else if (o === 'save') { edSave(); return; }
  else if (o === 'remove') { if (!armOnce(b, 'Silmek için tekrar dokun')) return; edRemove(); return; }
  renderEditor(true);
}
// köstek adları sıraya göre: üst, orta, … ; hırsız en altta
function edRelabel(d){
  const n = d.legs.filter(l => !l.trail).length, names = n === 1 ? ['Köstek'] : n === 2 ? ['Üst köstek', 'Alt köstek'] : n === 3 ? ['Üst köstek', 'Orta köstek', 'Alt köstek'] : null;
  let j = 0; d.legs.forEach(l => { if (l.trail) { l.label = d.lay === 'canli' ? 'Canlı yem kösteği' : d.legs.length === 1 ? 'Köstek' : 'Hırsız'; return; } l.label = names ? names[j] : (j + 1) + '. köstek'; j++; });
}
function edSel_(key, val){
  const d = RED; if (!d) return;
  if (key.indexOf('hook:') === 0) { const l = d.legs[+key.slice(5)]; if (!val) l.hook = null; else { const [item, size] = val.split('|'); l.hook = {item, size: size === '-' ? null : size}; } }
  else if (key === 'ana' || key === 'beden' || key === 'kostek') d[key] = val || null;
  renderEditor(true);
}
function edSave(){
  const d = RED; d.name = ($('ed-name') && $('ed-name').value || d.name || '').trim();
  const r = draftToRig(d);
  if (r.slots.some(s => (s.kind === 'hook' || s.kind === 'line') && !s.t.envanter.item)) { toast('Her köstek için iğne ve ipleri seç'); return; }
  const sy = S.systems.atolye = S.systems.atolye || {id: 'atolye', name: 'Rig Atölyem', source: 'atolye', active: true, created: new Date().toISOString(), rigs: []};
  if (!d.id) { const n = sy.rigs.reduce((m, x) => Math.max(m, +(String(x.code || '').split('-')[1]) || 0), 0) + 1; r.code = 'A-' + n; r.id = 'atolye:' + uid('r'); }
  else { const old = sy.rigs.find(x => x.id === d.id); r.code = old ? old.code : r.code || 'A-1'; }
  delete r.sys;
  const i = sy.rigs.findIndex(x => x.id === r.id); if (i >= 0) sy.rigs[i] = r; else sy.rigs.push(r);
  sy.active = sy.active !== false; sy.updated = new Date().toISOString();
  RED = null; persist(); indexAll(); noteRigChanges(true); ui.sys = 'atolye'; ui.rigSeg = 'all';
  ui.back = null; openPrep(r.id); renderAll(); toast(r.code + ' · ' + r.name + ' kaydedildi');
}
function edRemove(){
  const d = RED, sy = S.systems.atolye; if (!d || !d.id || !sy) return;
  sy.rigs = sy.rigs.filter(x => x.id !== d.id); if (!sy.rigs.length) delete S.systems.atolye;
  RED = null; persist(); indexAll(); ui.sys = 'all'; closeSheet(); renderAll(); toast('Rig silindi');
}
