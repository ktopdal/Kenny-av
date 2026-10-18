// ---------------------------------------------------------------- 78 · Rig Atölyesi sihirbazı (sıfırdan rig sistemi kurulumu)
let WZ = null;
const WZ_STEPS = ['Yer', 'Teknik', 'Türler', 'Takım', 'Kur'];
const LAY_DESC = {
  hirsizli: 'Üst, orta ve uzun hırsız köstek; 3 iğne', iki: 'Üst köstek ve uzun alt (hırsız) köstek', tek: 'Tek iğne, uzun köstek (80–120 cm)',
  kaydirmali: 'Gezer kurşun, tek iğne; temkinli balık için', slowjig: '100–250 g jig, assist iğne', tairubber: '60–150 g tai rubber', inchiku: '80–200 g inchiku',
  chunking: 'Parça yem ve circle iğne', popping: 'Popper ve stickbait, kalın lider', agirjig: '200–400 g jig', agirsirti: 'Büyük sırtı yemi, kalın mono',
  paternoster: '2 iğne, piramit kurşun', egi: 'Kalamar ve mürekkep zokası', ahtapot: 'Ahtapot zokası',
};
function wzDefaults(){
  return {mode: S.mode || 'tekne', region: regionOf(loc()), techs: [], species: [], lay: {}, klass: 'ikisi', time: 'ikisi', bottoms: [], size: 'dengeli', rodMax: '', name: ''};
}
function startWizard(editId){
  const sy = editId && S.systems[editId];
  WZ = {step: 0, ans: sy && sy.answers ? JSON.parse(JSON.stringify(sy.answers)) : wzDefaults(), editId: sy ? editId : null};
  ui.sheet = 'wizard'; renderWizard();
}
const wzTechs = () => Object.keys(KB.TECH).filter(id => WZ.ans.mode === 'ikisi' || KB.TECH[id].modes.includes(WZ.ans.mode));
function wzFams(){ const f = new Set(); WZ.ans.techs.forEach(t => KB.TECH[t].fams.forEach(x => f.add(x))); return f; }
const wzSpecies = () => { const f = wzFams(); const list = KB.SPECIES.filter(s => f.has(s.fam) && s.bol.includes(WZ.ans.region));
  if (WZ.ans.mode === 'kiyi') list.sort((a, b) => (SHORE_TOP.includes(b.id) ? 1 : 0) - (SHORE_TOP.includes(a.id) ? 1 : 0)); return list; };
const optBtn = (attr, val, on, label, sub) => '<button type="button" class="opt" ' + attr + '="' + esc(val) + '" aria-pressed="' + !!on + '"><b>' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</button>';
const segWz = (name, opts, cur) => '<div class="seg wrapseg">' + opts.map(([v, t]) => '<button class="btn small" type="button" data-wzset="' + name + '" data-val="' + v + '" aria-pressed="' + (cur === v) + '">' + esc(t) + '</button>').join('') + '</div>';
function wzSummary(){
  const a = WZ.ans;
  const mode = {tekne: 'Tekne', kiyi: 'Kıyı', ikisi: 'Tekne ve kıyı'}[a.mode];
  const reg = (KB.REGIONS.find(r => r[0] === a.region) || [0, ''])[1];
  const short = s => s.replace(/\s*\(.*?\)/g, '');
  const techs = a.techs.map(t => short(KB.TECH[t].name) + (a.lay[t] && a.lay[t].length && KB.TECH[t].lay.length > 1 && t !== 'eging' ? ': ' + a.lay[t].map(l => trLower(short(KB.LAY[l].name))).join(', ') : '')).join(' · ');
  const sps = a.species.map(id => (KB.SPECIES.find(s => s.id === id) || {}).name).filter(Boolean).join(', ');
  const kl = {porsiyon: 'porsiyonluk', trofe: 'trofe', ikisi: 'porsiyonluk ve trofe'}[a.klass], tm = {gunduz: 'gündüz', gece: 'gece', ikisi: 'gündüz ve gece'}[a.time];
  return [mode + ' · ' + reg, techs, sps, kl + ' · ' + tm, a.bottoms.length ? 'Dip: ' + a.bottoms.map(b => BOTTOM_TXT[b]).join(', ') : 'Dip: bilinmiyor (keşif)'].filter(Boolean).join(' · ');
}
function wzValid(){
  const a = WZ.ans, st = WZ.step;
  if (st === 1) return a.techs.length > 0;
  if (st === 2) return a.species.length > 0;
  if (st === 4) return a.techs.length > 0 && a.species.length > 0 && genSystem(a).length > 0;
  return true;
}
function renderWizard(keep){
  const a = WZ.ans; const st = WZ.step; let body = '';
  if (st === 0) {
    body = '<h3>Nerede avlanıyorsun?</h3><div class="opts">' + [['tekne', 'Tekneden', 'Dip, jig, sırtı, canlı yem, orkinos'], ['kiyi', 'Kıyıdan', 'Surf, LRF, spin, şamandıra'], ['ikisi', 'İkisinden de', 'Bütün teknikler']].map(([v, t, s]) => optBtn('data-wzm', v, a.mode === v, t, s)).join('') + '</div>' +
      '<h3>Hangi denizde?</h3><div class="seg wrapseg">' + KB.REGIONS.map(([v, t]) => '<button class="btn small" type="button" data-wzr="' + v + '" aria-pressed="' + (a.region === v) + '">' + t + '</button>').join('') + '</div>' +
      '<p class="note">Seçili konumuna göre tahmin edildi. Türler bölgeye göre süzülür.</p>';
  } else if (st === 1) {
    body = '<h3>Nasıl avlanıyorsun?</h3><p class="note">Birden çok seçebilirsin; her teknik için ayrı rigler kurulur.</p><div class="opts">' + wzTechs().map(id => optBtn('data-wzt', id, a.techs.includes(id), KB.TECH[id].name, KB.TECH[id].desc)).join('') + '</div>';
  } else if (st === 2) {
    const by = {}; wzSpecies().forEach(s => { (by[s.fam] = by[s.fam] || []).push(s); });
    body = '<h3>Hangi balıkları hedefliyorsun?</h3><p class="note">Seçtiğin tekniklere ve bölgene uyan türler. Altlarındaki aylar genel bilgidir.</p>' +
      (Object.keys(by).map(f => '<div class="famgrp"><div class="row" style="justify-content:space-between"><span class="eyebrow">' + esc((KB.FAM[f] || {}).name || f) + '</span><button class="linkbtn" type="button" data-wzall="' + f + '">Hepsini seç</button></div><div class="opts sp">' +
        by[f].map(s => optBtn('data-wzs', s.id, a.species.includes(s.id), s.name, s.m ? s.m.map(m => MON3[m - 1]).join(' ') : 'yıl boyu')).join('') + '</div></div>').join('') || '<div class="empty">Önce bir teknik seç.</div>');
  } else if (st === 3) {
    const multi = a.techs.filter(t => KB.TECH[t].lay.length > 1 && t !== 'eging');
    body = multi.map(t => '<h3>' + esc(KB.TECH[t].name) + ': takım düzeni</h3><p class="note">Birden çok seçebilirsin.</p><div class="opts">' + KB.TECH[t].lay.map(l => optBtn('data-wzl', t + '|' + l, (a.lay[t] || []).includes(l), KB.LAY[l].name, LAY_DESC[l] || '')).join('') + '</div>').join('') +
      '<h3>Balık boyu</h3>' + segWz('klass', [['porsiyon', 'Porsiyonluk'], ['trofe', 'Trofe (iri)'], ['ikisi', 'İkisi de']], a.klass) +
      '<h3>Ne zaman?</h3>' + segWz('time', [['gunduz', 'Gündüz'], ['gece', 'Gece'], ['ikisi', 'İkisi de']], a.time) +
      '<h3>Hangi diplerde?</h3><p class="note">Bilmiyorsan boş bırak; keşif rigleri de kurulur.</p><div class="seg wrapseg">' + [['kum', 'Kum'], ['kum-kayalik', 'Kum–kayalık'], ['kayalik', 'Kayalık'], ['karma', 'Karma'], ['camur', 'Çamur']].map(([v, t]) => '<button class="btn small" type="button" data-wzb="' + v + '" aria-pressed="' + a.bottoms.includes(v) + '">' + t + '</button>').join('') + '</div>';
  } else {
    const n = a.techs.length && a.species.length ? genSystem(a).length : 0;
    body = '<h3>Takımın</h3><div class="fields"><label class="f wide">' + (a.mode === 'kiyi' ? 'Kamışının atış ağırlığı üst sınırı (g, biliyorsan)' : 'Kamışının kurşun sınırı (g, biliyorsan)') + '<input id="wz-rod" inputmode="numeric" value="' + esc(a.rodMax || '') + '" placeholder="' + (a.mode === 'kiyi' ? 'Ör. 100' : 'Ör. 150') + '"></label></div>' +
      '<h3>Sistem ne kadar ayrıntılı olsun?</h3><div class="opts">' + [['sade', 'Sade', 'Her tür grubu için tek rig'], ['dengeli', 'Dengeli', 'Boya, gündüz/geceye ve takım düzenine göre ayrı rigler'], ['tam', 'Tam', 'Dengeli + kayalık ve keşif rigleri']].map(([v, t, s]) => optBtn('data-wzz', v, a.size === v, t, s)).join('') + '</div>' +
      '<h3>Sistemin adı</h3><div class="fields"><label class="f wide">Ad<input id="wz-name" value="' + esc(a.name || '') + '" placeholder="Ör. Benim dip sistemim"></label></div>' +
      '<div class="panel stack"><b id="wzCount">' + n + ' rig kurulacak</b><span class="note">' + esc(wzSummary()) + '</span>' +
      '<span class="note">Her rigde üç malzeme seviyesi olur: dünyanın en iyisi, envanterinden ve Türkiye\'de bulunabilen en iyi (envanterinde uygun olan varsa o). Envanteri değiştirdikçe rigler kendiliğinden güncellenir.</span></div>';
  }
  const ok = wzValid();
  openSheet(sheetBar(WZ.editId ? 'Rig sistemini düzenle' : 'Rig Atölyesi', null, 'Kapat') +
    '<div class="wzsteps">' + WZ_STEPS.map((t, i) => '<span class="' + (i === st ? 'on' : i < st ? 'done' : '') + '">' + (i + 1) + ' ' + t + '</span>').join('') + '</div>' +
    '<div class="stack wz">' + body + '<p class="err" id="wzErr" hidden></p></div>' +
    '<div class="wznav">' + (st > 0 ? '<button class="btn" type="button" data-wz="back">Geri</button>' : '<span></span>') +
    (st < 4 ? '<button class="btn primary" type="button" data-wz="next"' + (ok ? '' : ' disabled') + '>İleri</button>' : '<button class="btn primary" type="button" data-wz="done"' + (ok ? '' : ' disabled') + '>' + (WZ.editId ? 'Sistemi güncelle' : 'Sistemi kur') + '</button>') + '</div>', keep);
}
function wzToggle(arr, v){ const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
function wzClick(d){
  const a = WZ.ans;
  if (d.wzm) { a.mode = d.wzm; a.techs = a.techs.filter(t => wzTechs().includes(t)); }
  else if (d.wzr) { a.region = d.wzr; }
  else if (d.wzt) { wzToggle(a.techs, d.wzt); if (a.techs.includes(d.wzt) && !(a.lay[d.wzt] || []).length) a.lay[d.wzt] = [KB.TECH[d.wzt].lay[0]]; }
  else if (d.wzs) { wzToggle(a.species, d.wzs); }
  else if (d.wzall) { const ids = wzSpecies().filter(s => s.fam === d.wzall).map(s => s.id); const all = ids.every(i => a.species.includes(i)); ids.forEach(i => { const k = a.species.indexOf(i); if (all && k >= 0) a.species.splice(k, 1); if (!all && k < 0) a.species.push(i); }); }
  else if (d.wzl) { const [t, l] = d.wzl.split('|'); a.lay[t] = a.lay[t] || []; wzToggle(a.lay[t], l); }
  else if (d.wzset) { a[d.wzset] = d.val; }
  else if (d.wzb) { wzToggle(a.bottoms, d.wzb); }
  else if (d.wzz) { a.size = d.wzz; }
  else if (d.wz === 'back') { WZ.step = Math.max(0, WZ.step - 1); renderWizard(); return; }
  else if (d.wz === 'next') {
    if (!wzValid()) return;
    if (WZ.step === 1) { const f = wzFams(); a.species = a.species.filter(id => { const s = KB.SPECIES.find(x => x.id === id); return s && f.has(s.fam); }); }
    WZ.step = Math.min(4, WZ.step + 1); renderWizard(); return;
  }
  else if (d.wz === 'done') { wzFinish(); return; }
  renderWizard(true);
}
function wzFinish(){
  const a = WZ.ans;
  const rigs = genSystem(a);
  if (!rigs.length) { $('wzErr').textContent = 'Bu seçimlerle rig kurulamadı; tür ve teknik seçimini kontrol et.'; $('wzErr').hidden = false; return; }
  const id = WZ.editId || uid('s');
  const name = (a.name || '').trim() || (KB.TECH[a.techs[0]].name + ' sistemim');
  rigs.forEach(r => { r.id = id + ':' + r.code; });
  const old = S.systems[id] || {};
  S.systems[id] = Object.assign({}, old, {id, name, source: 'sihirbaz', active: old.active !== false, created: old.created || new Date().toISOString(), updated: new Date().toISOString(), answers: JSON.parse(JSON.stringify(a)), rigs});
  if (a.mode !== 'ikisi') S.mode = a.mode;
  S.onboarded = true; persist(); indexAll();
  const edit = !!WZ.editId; WZ = null; closeSheet();
  ui.sys = id; ui.rigSeg = 'all'; show('rigler'); renderAll();
  toast(rigs.length + ' rig ' + (edit ? 'güncellendi' : 'kuruldu'));
}
