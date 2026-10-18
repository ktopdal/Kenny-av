// ---------------------------------------------------------------- 72 · Rigler ve Envanter
function renderRigs(){
  const sys = Object.values(S.systems);
  const all = RIG_LIST; const n = all.filter(ready).length;
  $('rigEyebrow').textContent = sys.length ? sys.length + ' sistem · ' + all.length + ' rig' : 'Rig sistemi yok';
  $('rigSub').textContent = all.length ? n + ' rig tamam, ' + (all.length - n) + ' rig eksik kalem bekliyor. Tamamlanmayanlar soluk görünür ve öneriye girmez.' : '';
  $('sysBar').innerHTML = (sys.length > 1 ? '<button class="btn small" data-sys="all" aria-pressed="' + (ui.sys === 'all') + '">Tümü</button>' : '') +
    sys.map(sy => '<button class="btn small" data-sys="' + esc(sy.id) + '" aria-pressed="' + (ui.sys === sy.id || sys.length === 1) + '">' + esc(sy.name) + '</button>').join('') +
    '<button class="btn small" type="button" data-act="wizard">+ Yeni sistem</button>';
  if (!all.length) {
    $('rigSeg').innerHTML = ''; $('rigSearch').hidden = true;
    $('rigList').innerHTML = '<div class="panel stack"><h3>Rig sistemini kur</h3><p class="sub">Uygulama boş başlar. Nasıl avlandığını, hangi türü hedeflediğini ve takım tercihini sorup sana özel bir rig sistemi kurar; her rig için dünyanın en iyisi, envanterinden ve Türkiye\'de bulunabilen en iyi olmak üzere üç malzeme seviyesi verir.</p>' +
      '<div class="row"><button class="btn primary" type="button" data-act="wizard">Rig sistemimi kur</button><button class="btn" type="button" data-open="paket">Özel paketimi aç</button></div></div>';
    return;
  }
  $('rigSearch').hidden = false;
  const groups = [...new Set(all.filter(r => r.group).map(r => r.group + '|' + r.groupName))].map(s => s.split('|'));
  const segs = [['all', 'Tümü'], ['ready', 'Tamam'], ['missing', 'Tamamlanmadı']].concat(groups);
  $('rigSeg').innerHTML = segs.map(([k, t]) => '<button class="btn small" data-rseg="' + esc(k) + '" aria-pressed="' + (ui.rigSeg === k) + '">' + esc(t) + '</button>').join('');
  const q = trLower(ui.q.trim());
  const ds = days(); const dd = ds.find(d => d.key === dateKey(new Date())) || ds[0];
  const list = all.filter(rg => {
    if (ui.sys !== 'all' && sys.length > 1 && rg.sys !== ui.sys) return false;
    if (ui.rigSeg === 'ready' && !ready(rg)) return false;
    if (ui.rigSeg === 'missing' && ready(rg)) return false;
    if (!['all', 'ready', 'missing'].includes(ui.rigSeg) && rg.group !== ui.rigSeg) return false;
    if (!q) return true;
    return trLower([rg.code, rg.name, rg.target, rg.baitText].concat(rg.slots.map(sl => (sl.t.envanter && sl.t.envanter.name) || '')).join(' ')).includes(q);
  });
  $('rigList').innerHTML = list.length ? list.map(rg => rigCard(rg, dd, null)).join('') : '<div class="empty">Bu filtrede rig yok.</div>';
}
const INV_SEG = [['hook', 'İğneler'], ['line', 'İp ve florokarbon'], ['gear', 'Makine ve kamış'], ['jig', 'Jig, zoka, sahte'], ['terminal', 'Terminal ve kurşun'], ['bait', 'Yem'], ['ekip', 'Ekipman']];
const INV_CATS = {hook: ['hook'], line: ['braid', 'fc', 'mono'], gear: ['reel', 'rod'], jig: ['jig', 'lure'], terminal: ['terminal', 'sinker'], bait: ['bait'], ekip: ['ekip']};
const CAT_TXT = {hook: 'İğne', braid: 'Örgü ip', fc: 'Florokarbon', mono: 'Misina', reel: 'Makine', rod: 'Kamış', jig: 'Jig / zoka', lure: 'Sahte yem', terminal: 'Terminal', sinker: 'Kurşun', bait: 'Yem', ekip: 'Ekipman'};
const UNIT_LBL = {bait: 'paket', sinker: 'adet', reel: 'adet', rod: 'adet', braid: 'makara', fc: 'makara', mono: 'makara', hook: 'adet', jig: 'adet', lure: 'adet', terminal: 'adet', ekip: 'adet'};
const HOOK_PATTERNS = ['Chinu', 'Maruseigo', 'Iseama', 'Octopus / beak', 'Mutsu / circle', 'Circle', 'J (dövme, güçlü)', 'Baitholder (palalı)', 'Aberdeen (ince tel)', 'Canlı yem', 'Assist (jig)', 'Üçlü (treble)', 'Jighead', 'Diğer'];
function renderInventory(){
  $('invSeg').innerHTML = INV_SEG.map(([k, t]) => '<button class="btn small" data-iseg="' + k + '" aria-pressed="' + (ui.inv === k) + '">' + t + '</button>').join('');
  const all = Object.values(ITEMS);
  $('invEyebrow').textContent = all.length ? all.length + ' kalem' : 'Envanter boş';
  const its = all.filter(i => INV_CATS[ui.inv].includes(i.cat)).sort((a, b) => trCmp(a.name, b.name));
  $('invList').innerHTML = its.map(it => {
    const u = UNIT_LBL[it.cat] || 'adet';
    const q = sizesOf(it).map(sz => {
      const k = it.id + '|' + sz; const st = stockOf(it.id, sz); const v = S.inv.qty[k];
      return '<span class="qty"><span class="lb"><span class="dot ' + st + '"></span>' + (sz !== '-' ? esc(sz) : u) + '</span>' +
        '<button type="button" data-step="-1" data-k="' + esc(k) + '" aria-label="Azalt">−</button>' +
        '<input id="q-' + esc(k.replace(/[^a-z0-9]/gi, '_')) + '" data-qk="' + esc(k) + '" inputmode="numeric" value="' + esc(v == null ? '' : v) + '" placeholder="?" aria-label="' + esc(it.name + ' ' + (sz !== '-' ? sz : '') + ' ' + u) + '">' +
        '<button type="button" data-step="1" data-k="' + esc(k) + '" aria-label="Arttır">+</button></span>';
    }).join('');
    const used = RIG_LIST.filter(r => r.slots.some(sl => sl.t.envanter && sl.t.envanter.item === it.id)).length;
    const meta = [it.type || it.pattern, it.spec, it.use || it.note].filter(x => x && x !== '—').join(' · ');
    return '<div class="item"><div><div class="nm">' + esc(it.name) + (used ? ' <span class="chip">' + used + ' rigde</span>' : '') + (it.store ? ' <span class="store">Mağaza ' + esc(it.store) + '</span>' : '') +
      (it.src === 'paket' ? '' : ' <button class="linkbtn" type="button" data-edititem="' + esc(it.id) + '">Düzenle</button>') + '</div><div class="sp">' +
      esc((meta ? meta + ' · ' : '') + 'birim: ' + u) + '</div></div><div class="qtys">' + q + '</div></div>';
  }).join('') || '<div class="empty">' + (all.length ? 'Bu grupta kalem yok.' : 'Envanterin boş. “+ Kalem ekle” ile iğne, ip, kurşun ve takımlarını gir; rig sistemin hazır olup olmadığını buna göre hesaplar.') + '</div>';
}
function itemForm(id){
  const it = id ? S.inv.items[id] : null; const c = it || {cat: ui.inv === 'line' ? 'fc' : (INV_CATS[ui.inv] || ['hook'])[0]};
  ui.sheet = 'item'; ui.sheetArg = id || null;
  const cats = Object.keys(CAT_TXT).map(k => '<option value="' + k + '"' + (c.cat === k ? ' selected' : '') + '>' + CAT_TXT[k] + '</option>').join('');
  const pats = '<option value="">—</option>' + HOOK_PATTERNS.map(p => '<option' + (c.pattern === p ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
  openSheet(sheetBar(it ? 'Kalemi düzenle' : 'Yeni kalem', '<button class="btn primary" type="button" id="itSave">Kaydet</button>') +
    '<div class="stack"><div class="fields">' +
    '<label class="f wide">Kategori<select id="it-cat">' + cats + '</select></label>' +
    '<label class="f">Marka<input id="it-brand" value="' + esc(c.brand || '') + '" placeholder="Ör. Owner"></label>' +
    '<label class="f">Model<input id="it-model" value="' + esc(c.model || '') + '" placeholder="Ör. SSW 5111"></label>' +
    '<label class="f wide" id="it-patw"' + (c.cat === 'hook' ? '' : ' hidden') + '>İğne tipi<select id="it-pat">' + pats + '</select></label>' +
    '<label class="f wide">Özellik<input id="it-spec" value="' + esc(c.spec || '') + '" placeholder="Ör. 0,26 mm · PE 1,5 · 120 g · siyah nikel"></label>' +
    '<label class="f wide">Boylar (virgülle; tek boyluysa boş bırak)<input id="it-sizes" value="' + esc((c.sizes || []).join(', ')) + '" placeholder="Ör. No:1, No:2  ya da  2/0, 3/0"></label>' +
    '<label class="f wide">Not<input id="it-note" value="' + esc(c.note || '') + '" placeholder="Ör. mercan için"></label>' +
    '</div><p class="err" id="itErr" hidden></p>' +
    (it ? '<button class="btn" type="button" id="itDel" data-delitem="' + esc(it.id) + '" style="color:var(--D)">Kalemi sil</button>' : '') + '</div>');
}
function saveItem(){
  const g = k => $(k).value.trim();
  const brand = g('it-brand'), model = g('it-model');
  if (!brand && !model) { $('itErr').textContent = 'Marka ya da model yaz.'; $('itErr').hidden = false; return; }
  const sizes = g('it-sizes').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const id = ui.sheetArg || ('u-' + (slugTR(brand + '-' + model).slice(0, 40) || 'kalem') + '-' + Math.random().toString(36).slice(2, 6));
  const old = S.inv.items[id];
  const cat = $('it-cat').value;
  S.inv.items[id] = {id, cat, brand, model, name: [brand, model].filter(Boolean).join(' '), pattern: cat === 'hook' ? $('it-pat').value : '', spec: g('it-spec'), note: g('it-note'),
    sizes, stock: Object.fromEntries((sizes.length ? sizes : ['-']).map(s => [s, 'var'])), src: 'kullanici', created: old ? old.created : new Date().toISOString()};
  persist(); indexAll(); closeSheet(); ui.inv = INV_SEG.find(([k]) => INV_CATS[k].includes(cat))[0]; renderAll(); toast('Kalem kaydedildi');
}
function deleteItem(id){
  delete S.inv.items[id];
  Object.keys(S.inv.qty).forEach(k => { if (k.split('|')[0] === id) delete S.inv.qty[k]; });
  Object.keys(S.inv.status).forEach(k => { if (k.split('|')[0] === id) delete S.inv.status[k]; });
  persist(); indexAll(); closeSheet(); renderAll(); toast('Kalem silindi');
}
