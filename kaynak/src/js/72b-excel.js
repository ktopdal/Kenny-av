// ---------------------------------------------------------------- 72b · Excel ile toplu envanter
// Örnek dosya (ornek-envanter.xlsx) derleyicide üretilir ve buraya gömülür: çevrimdışı da indirilir.
// Yükleme tarayıcıda: .xlsx bir zip'tir; merkezi dizin okunur, dosyalar DecompressionStream('deflate-raw') ile açılır,
// workbook → ilişkiler → sayfa XML'i ve paylaşılan metinler okunur. CSV (virgül, noktalı virgül ya da sekme) de olur.
// Başlıklar adından tanınır (sütun sırası önemli değil). Önce özet gösterilir; onaylanınca kalemler kullanıcının envanterine eklenir.
const XLSX_TPL = /*__XLSXTPL__*/null;
const XL_NAME = 'ornek-envanter.xlsx';
let XL = null;   // {file, items, skip, dup}

const xlNorm = s => trLower(String(s == null ? '' : s)).replace(/[*:.()\/]+/g, ' ').replace(/\s+/g, ' ').trim();
const XL_COLS = {cat: ['kategori', 'kategori tur', 'tur', 'category'], brand: ['marka', 'brand'], model: ['model ad', 'model', 'ad', 'urun', 'ürün', 'urun adi', 'ürün adı', 'name'],
  spec: ['özellik', 'ozellik', 'özellikler', 'cap', 'çap'], sizes: ['boylar', 'boy', 'numara', 'numaralar', 'gramaj', 'sizes'], st: ['durum', 'stok', 'status'],
  note: ['not', 'notlar', 'açıklama', 'aciklama', 'note'], pattern: ['iğne tipi', 'igne tipi'], rodt: ['kamış tipi', 'kamis tipi'], rodl: ['kamış boyu m', 'kamış boyu', 'kamis boyu m', 'kamis boyu'],
  rodm: ['kamış en fazla g', 'kamış en fazla', 'en fazla g', 'kamis en fazla g'], rodp: ['kamış pe', 'kamis pe', 'pe'], reelt: ['makine tipi'], reels: ['makine boyu', 'makine boy']};
const XL_CAT_ALIAS = [[/^(iğne|igne|hook)/, 'hook'], [/örgü|orgu|braid|^pe\b/, 'braid'], [/floro|^fc\b|lider|şok|sok/, 'fc'], [/misina|naylon|mono/, 'mono'],
  [/makine|makara|reel|çıkrık|cikrik/, 'reel'], [/kamış|kamis|rod|olta kam/, 'rod'], [/jig|zoka|inchiku|tai/, 'jig'], [/sahte|rapala|maket|lure|kaşık|kasik|silikon|egi/, 'lure'],
  [/terminal|fırdöndü|firdondu|klips|halka|boncuk|swivel/, 'terminal'], [/kurşun|kursun|sinker/, 'sinker'], [/^yem|bait/, 'bait'], [/ekipman|ekip|aksesuar|diğer|diger/, 'ekip']];
const XL_NOSIZE = ['rod', 'reel', 'bait', 'braid', 'fc', 'mono'];

function xlCat(v){
  const n = xlNorm(v); if (!n) return null;
  const k = Object.keys(CAT_TXT).find(c => xlNorm(CAT_TXT[c]) === n || c === n); if (k) return k;
  const a = XL_CAT_ALIAS.find(x => x[0].test(n)); return a ? a[1] : null;
}
function xlSt(v){
  const n = xlNorm(v); if (!n) return 'var';
  if (/^(var|evet|x|1|✓|elimde|mevcut)/.test(n)) return 'var';
  if (/^(al|alınacak|alinacak|istek|lazım|lazim|bitti)/.test(n)) return 'alinacak';
  if (/^(yok|hayır|hayir|0|-)/.test(n)) return 'yok';
  return null;
}
const xlPick = (list, v) => { const n = xlNorm(v); if (!n) return null; const f = list.find(([k, t]) => k === n || xlNorm(t) === n || xlNorm(t).indexOf(n) === 0); return f ? f[0] : null; };

// ---- zip ve xlsx okuma
async function xlUnzip(buf){
  const u = new Uint8Array(buf), dv = new DataView(buf);
  let e = u.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
  for (let i = 0; i < n && dv.getUint32(p, true) === 0x02014b50; i++) {
    const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    files[new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl)).replace(/^\/+/, '')] = {meth, csz, off};
    p += 46 + nl + xl + cl;
  }
  const read = async name => {
    const f = files[String(name).replace(/^\/+/, '')]; if (!f) return null;
    const s = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true); const data = u.subarray(s, s + f.csz);
    if (f.meth === 0) return new TextDecoder().decode(data);
    if (f.meth !== 8 || typeof DecompressionStream !== 'function') throw new Error('sıkıştırma');
    return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  };
  return read;
}
const xlXml = t => new DOMParser().parseFromString(t, 'application/xml');
const xlTags = (el, name) => Array.from(el.getElementsByTagNameNS('*', name));
const xlColIx = ref => { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
async function xlReadXlsx(buf){
  const read = await xlUnzip(buf);
  const wb = xlXml(await read('xl/workbook.xml') || '');
  const sheets = xlTags(wb, 'sheet').map(s => ({name: s.getAttribute('name') || '', rid: s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id')}));
  if (!sheets.length) throw new Error('sayfa');
  const sh = sheets.find(s => xlNorm(s.name) === 'envanter') || sheets.find(s => !/örnek|ornek|nasıl|nasil|liste/.test(xlNorm(s.name))) || sheets[0];
  const rels = xlXml(await read('xl/_rels/workbook.xml.rels') || '<r/>');
  const rel = xlTags(rels, 'Relationship').find(r => r.getAttribute('Id') === sh.rid);
  let target = rel ? rel.getAttribute('Target') : 'worksheets/sheet1.xml';
  target = target.charAt(0) === '/' ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  const ssT = await read('xl/sharedStrings.xml');
  const ss = ssT ? xlTags(xlXml(ssT), 'si').map(si => xlTags(si, 't').filter(t => !(t.parentNode && t.parentNode.localName === 'rPh')).map(t => t.textContent).join('')) : [];
  const ws = xlXml(await read(target) || '');
  return xlTags(ws, 'row').map(r => {
    const out = []; let ix = 0;
    xlTags(r, 'c').forEach(c => {
      const ci = c.getAttribute('r') ? xlColIx(c.getAttribute('r')) : ix; ix = ci + 1;
      const t = c.getAttribute('t'); const v = xlTags(c, 'v')[0];
      let val = '';
      if (t === 's') val = v ? ss[+v.textContent] || '' : '';
      else if (t === 'inlineStr') val = xlTags(c, 't').map(x => x.textContent).join('');
      else if (t === 'b') val = v && v.textContent === '1' ? 'evet' : '';
      else val = v ? v.textContent : '';
      if (t !== 's' && t !== 'inlineStr' && t !== 'str' && /^-?\d+\.\d{6,}$/.test(val)) val = String(+(+val).toFixed(4));   // 1.9800000001 → 1.98
      out[ci] = String(val).trim();
    });
    return Array.from(out, x => x || '');
  });
}
function xlReadCsv(text){
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const d = [';', '\t', ','].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === d) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

// ---- satırlardan kalemler
function xlParse(rows){
  const hi = rows.findIndex(r => r.some(c => XL_COLS.cat.includes(xlNorm(c))));
  if (hi < 0) return {err: 'Başlık satırı bulunamadı. İlk satırda en az “Kategori” ve “Model / ad” sütunları olmalı (örnek dosyadaki gibi).'};
  const head = rows[hi].map(xlNorm); const col = {};
  Object.keys(XL_COLS).forEach(k => { const i = head.findIndex(h => XL_COLS[k].includes(h)); if (i >= 0) col[k] = i; });
  if (col.model == null && col.brand == null) return {err: '“Model / ad” ya da “Marka” sütunu bulunamadı.'};
  const have = new Set(Object.values(S.inv.items).map(it => it.cat + '|' + trLower(it.name) + '|' + trLower(it.spec || '')));
  const items = [], skip = [], dup = [];
  rows.slice(hi + 1).forEach((r, i) => {
    const n = hi + i + 2; const g = k => col[k] != null ? String(r[col[k]] || '').trim() : '';
    if (!r.some(c => String(c || '').trim())) return;
    const brand = g('brand'), model = g('model');
    if (!brand && !model) { skip.push([n, 'ad yok']); return; }
    const cat = xlCat(g('cat'));
    if (!cat) { skip.push([n, g('cat') ? '“' + g('cat') + '” kategorisi tanınmadı' : 'kategori yok']); return; }
    const st = xlSt(g('st'));
    if (!st) { skip.push([n, '“' + g('st') + '” durumu tanınmadı (Var, Alınacak ya da Yok)']); return; }
    let spec = g('spec'); const raw = g('sizes').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    let sizes = XL_NOSIZE.includes(cat) ? [] : Array.from(new Set(raw));
    if (XL_NOSIZE.includes(cat) && g('sizes')) spec = [spec, g('sizes')].filter(Boolean).join(' · ');   // ipte çap, kamışta boy: olduğu gibi özelliğe
    let pattern = '';
    if (cat === 'hook' && g('pattern')) { const p = HOOK_PATTERNS.find(x => xlNorm(x) === xlNorm(g('pattern')) || xlNorm(x).indexOf(xlNorm(g('pattern'))) === 0); if (p) pattern = p; else spec = [spec, g('pattern')].filter(Boolean).join(' · '); }
    const name = [brand, model].filter(Boolean).join(' ');
    const key = cat + '|' + trLower(name) + '|' + trLower(spec);
    if (have.has(key)) { dup.push([n, name]); return; }
    have.add(key);
    const it = {id: 'u-' + (slugTR(brand + '-' + model).slice(0, 40) || 'kalem') + '-' + Math.random().toString(36).slice(2, 6), cat, brand, model, name, pattern, spec, note: g('note'),
      sizes, stock: Object.fromEntries((sizes.length ? sizes : ['-']).map(s => [s, st])), src: 'kullanici', created: new Date().toISOString(), xlRow: n};
    if (cat === 'rod') { it.rod = {type: xlPick(ROD_T, g('rodt')) || 'tekne', len: num(g('rodl')), max: num(g('rodm')), pe: num(g('rodp'))}; }
    if (cat === 'reel') it.reel = {type: xlPick(REEL_T, g('reelt')) || 'spin', size: num(g('reels'))};
    items.push(it);
  });
  return {items, skip, dup};
}

// ---- arayüz
async function xlTemplate(){
  let bytes = null;
  if (XLSX_TPL) bytes = b64d(XLSX_TPL);
  else { try { const r = await fetch(XL_NAME); if (r.ok) bytes = new Uint8Array(await r.arrayBuffer()); } catch (e) {} }
  if (!bytes) { toast('Örnek dosya bulunamadı'); return; }
  const r = await deliverFile(XL_NAME, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes);
  if (r !== 'abort') toast('Örnek dosya hazır: “Envanter” sayfasını doldur, sonra “Excel’den yükle”');
}
async function xlLoad(file){
  if (!file) return;
  let rows;
  try {
    if (/\.csv$/i.test(file.name) || /csv|text\/plain/.test(file.type)) rows = xlReadCsv(await file.text());
    else rows = await xlReadXlsx(await file.arrayBuffer());
  } catch (e) {
    XL = {file: file.name, err: e && e.message === 'sıkıştırma' ? 'Bu tarayıcı Excel dosyasını açamıyor. Dosyayı CSV olarak kaydedip onu yükle.' : 'Dosya okunamadı. Excel (.xlsx) ya da CSV olmalı.'};
    xlSheet(); return;
  }
  XL = Object.assign({file: file.name}, xlParse(rows || []));
  xlSheet();
}
function xlSheet(){
  ui.sheet = 'xlimp'; const x = XL || {};
  const row = it => '<li><b>' + esc(it.name) + '</b> <span class="chip">' + esc(CAT_TXT[it.cat]) + '</span>' + (it.spec ? ' <small>' + esc(it.spec) + '</small>' : '') + (it.sizes.length ? ' <small>· ' + esc(it.sizes.join(', ')) + '</small>' : '') +
    ' <small class="note">' + esc(ST_TXT[it.stock[it.sizes[0] || '-']] || '') + '</small></li>';
  const by = {}; (x.items || []).forEach(it => { by[it.cat] = (by[it.cat] || 0) + 1; });
  openSheet(sheetBar('Excel’den yükle', x.items && x.items.length ? '<button class="btn primary" type="button" data-xl="ok">Ekle</button>' : '') + '<div class="stack">' +
    '<p class="sub">' + esc(x.file || '') + '</p>' +
    (x.err ? '<div class="banner">' + esc(x.err) + '</div><div class="row"><button class="btn" type="button" data-xl="tpl">Örnek Excel dosyasını indir</button><button class="btn" type="button" data-xl="pick">Başka dosya seç</button></div>' :
      '<div class="panel stack"><b>' + x.items.length + ' kalem eklenecek</b>' + (x.items.length ? '<span class="note">' + Object.keys(by).map(c => esc(CAT_TXT[c]) + ' ' + by[c]).join(' · ') + '</span>' : '') +
        (x.dup.length ? '<span class="note">' + x.dup.length + ' kalem zaten envanterde, atlanacak.</span>' : '') +
        (x.skip.length ? '<span class="note" style="color:var(--D)">' + x.skip.length + ' satır okunamadı (aşağıda).</span>' : '') + '</div>' +
      (x.items.length ? '<ul class="steps">' + x.items.slice(0, 60).map(row).join('') + (x.items.length > 60 ? '<li class="note">… ve ' + (x.items.length - 60) + ' kalem daha</li>' : '') + '</ul>' : '<div class="empty">Eklenecek kalem yok.</div>') +
      (x.skip.length ? '<section class="set"><h4>Okunamayan satırlar</h4><ul class="steps">' + x.skip.slice(0, 40).map(([n, w]) => '<li>Satır ' + n + ': ' + esc(w) + '</li>').join('') + '</ul></section>' : '') +
      (x.dup.length ? '<section class="set"><h4>Zaten envanterde</h4><p class="note">' + x.dup.slice(0, 40).map(([n, w]) => esc(w) + ' (satır ' + n + ')').join(', ') + '</p></section>' : '') +
      '<div class="row wrap">' + (x.items.length ? '<button class="btn primary" type="button" data-xl="ok">' + x.items.length + ' kalemi envantere ekle</button>' : '') + '<button class="btn" type="button" data-xl="pick">Başka dosya seç</button></div>') +
    '</div>');
}
function xlCommit(){
  const x = XL; if (!x || !x.items || !x.items.length) return;
  x.items.forEach(it => { const o = Object.assign({}, it); delete o.xlRow; S.inv.items[o.id] = o;
    if (o.cat === 'bait') (o.sizes.length ? o.sizes : ['-']).forEach(sz => { if (o.stock[sz] === 'var') S.inv.status[o.id + '|' + sz] = 'var'; }); });
  const n = x.items.length, cat = x.items[0].cat; XL = null;
  persist(); indexAll(); noteRigChanges(true); closeSheet();
  ui.inv = (INV_SEG.find(([k]) => INV_CATS[k].includes(cat)) || INV_SEG[0])[0]; renderAll();
  toast(n + ' kalem envantere eklendi');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-xl]'); if (!b) return;
  const a = b.dataset.xl;
  if (a === 'tpl') xlTemplate();
  else if (a === 'pick') { const f = $('xlFile'); if (f) { f.value = ''; f.click(); } }
  else if (a === 'ok') xlCommit();
});
document.addEventListener('change', e => { if (e.target && e.target.id === 'xlFile') { const f = e.target.files && e.target.files[0]; e.target.value = ''; xlLoad(f); } });   // aynı dosya yeniden seçilebilsin
