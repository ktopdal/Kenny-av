// ---------------------------------------------------------------- 59 · "Rig hazırladım" (B5) · v0.26
// Hazırlama sayfasındaki "Rig hazırladım": rigin harcadığı iğneler envanterden düşer (iğne adetle ya da paketle sayılıyorsa; pakette
// açık paketten kalan adet tutulur), iplerin kullanılan metresi kaydedilir (makara boyu girilmişse kalan yazar). Düşmeden önce ne
// düşeceği, sonra ne kalacağı ve azalan iğnenin hangi rigleri etkileyeceği gösterilir. "Geri al" son hazırlığı envantere geri koyar.
const PACK_DEF = 10;
const invX = k => { S.inv[k] = S.inv[k] || {}; return S.inv[k]; };   // loose (açık paketten kalan), pack (paket içi adet), used (ip m), spool (makara m)
// bu rigin bir hazırlığında harcananlar ve envanterdeki karşılığı
function prepUse(rid){
  const c = prepCtx(rid); if (!c) return null;
  const mats = rigMaterials(c.rg, c.sc.chain);
  const hooks = mats.filter(m => m.k.indexOf('igne') === 0 && m.item && ITEMS[m.item]).map(m => {
    const it = ITEMS[m.item], sz = m.size || '-', k = it.id + '|' + sz, u = unitOf(it), q = qtyOf(k);
    const pack = (invX('pack'))[it.id] || PACK_DEF, loose = (invX('loose'))[k] || 0;
    const users = RIG_LIST.filter(r => r.slots.some(s => { const e = s.t.envanter || {}; return e.item === it.id && (e.size || '-') === sz; }));
    let can = u !== 'durum' && q != null, after = null, afterLoose = loose, open = 0, short = false;
    if (can && u === 'adet') { after = Math.max(0, q - m.n); short = q < m.n; }
    if (can && u === 'paket') { let need = m.n - loose; if (need <= 0) { afterLoose = loose - m.n; after = q; } else { open = Math.ceil(need / pack); if (open > q) { short = true; open = q; } after = q - open; afterLoose = Math.max(0, loose + open * pack - m.n); } }
    const left = u === 'adet' ? after : u === 'paket' && after != null ? after * pack + afterLoose : null;
    return {k, it, sz, n: m.n, u, q, pack, loose, after, afterLoose, open, short, can, left, users, preps: left != null ? Math.floor(left / m.n) : null};
  });
  const lines = mats.filter(m => ['beden', 'kostek', 'lider', 'sok'].includes(m.k) && m.item && ITEMS[m.item] && m.cm).map(m => {
    const id = m.item, used = (invX('used'))[id] || 0, spool = (invX('spool'))[id] || null, mtr = Math.round(m.cm) / 100;
    return {id, it: ITEMS[id], t: m.t, m: mtr, used, spool, left: spool ? Math.round((spool - used - mtr) * 10) / 10 : null};
  });
  return {rg: c.rg, hooks, lines};
}
function openDone(rid, keep, done){
  const u = prepUse(rid); if (!u) return;
  ui.sheet = 'rigdone'; ui.sheetArg = rid;
  const H = u.hooks.map(h => {
    const unitTxt = h.u === 'adet' ? 'adet' : h.u === 'paket' ? 'paket' : 'var/yok';
    const now = h.u === 'adet' ? (h.q != null ? h.q + ' adet' : 'adet girilmemiş') : h.u === 'paket' ? (h.q != null ? h.q + ' paket' + (h.loose ? ' + açık pakette ' + h.loose : '') : 'paket sayısı girilmemiş') : 'var/yok tutuluyor';
    const aft = !h.can ? (h.u === 'durum' ? 'Adet tutulmuyor: Envanter → İğneler’de bu iğneyi “Adet” ya da “Paket” ile saymaya geç.' : 'Önce Envanter’de ' + unitTxt + ' sayısını gir.') :
      h.u === 'adet' ? 'Sonra ' + h.after + ' adet kalır' : 'Sonra ' + h.after + ' paket' + (h.afterLoose ? ' + açık pakette ' + h.afterLoose : '') + ' kalır' + (h.open ? ' (' + h.open + ' paket açılır)' : '');
    const warn = h.short ? 'Yetmiyor: elinde ' + h.n + ' iğne yok.' : h.can && h.preps != null && h.preps < 2 ? 'Az kaldı: ' + (h.preps ? h.preps + ' hazırlık daha yeter' : 'bir hazırlık daha yetmez') + '; bu iğneyi kullanan ' + h.users.length + ' rig etkilenir (' + h.users.slice(0, 8).map(r => r.code || r.name).join(', ') + (h.users.length > 8 ? '…' : '') + ').' : '';
    return '<li><label><input type="checkbox" data-donek="' + esc(h.k) + '"' + (h.can && !done ? ' checked' : '') + (h.can && !done ? '' : ' disabled') + '><span><b>' + esc(h.it.name + (h.sz !== '-' ? ' ' + h.sz : '')) + '</b> × ' + h.n +
      '<small>Şimdi: ' + esc(now) + ' · ' + esc(aft) + '</small>' + (warn ? '<small class="warnt">' + esc(warn) + '</small>' : '') +
      (h.u === 'paket' && !done ? '<small class="pk">Pakette <input type="number" min="1" max="500" inputmode="numeric" data-pack="' + esc(h.it.id) + '" value="' + h.pack + '"> iğne</small>' : '') + '</span></label></li>';
  }).join('');
  const L = u.lines.map(l => '<li><label><input type="checkbox" data-donel="' + esc(l.id) + '"' + (done ? ' disabled' : ' checked') + '><span><b>' + esc(l.t) + '</b> ' + esc(l.it.name) + ' · ' + fmtNum(l.m, 2) + ' m' +
    '<small>Bu ipten şimdiye kadar ' + fmtNum(l.used, 1) + ' m kullandın' + (l.spool ? ' · makara ' + l.spool + ' m, sonra ≈ ' + fmtNum(l.left, 1) + ' m kalır' : '') + '</small>' + (l.spool && l.left != null && l.left < 5 ? '<small class="warnt">Makara bitiyor.</small>' : '') +
    (done ? '' : '<small class="pk">Makara boyu <input type="number" min="1" max="2000" inputmode="numeric" data-spool="' + esc(l.id) + '" value="' + (l.spool || '') + '" placeholder="m"> m (biliyorsan)</small>') + '</span></label></li>').join('');
  const log = (S.prepLog || []).filter(x => x.rid === rid).slice(0, 3);
  openSheet(sheetBar('Rig hazırladım') + '<div class="stack">' +
    '<p class="sub">' + esc((u.rg.code ? u.rg.code + ' · ' : '') + u.rg.name) + '</p>' +
    (done ? '<div class="banner">Envanterden düşüldü. Yanlışlıkla mı bastın? <button class="btn small" type="button" data-undoprep="' + esc(done) + '">Geri al</button></div>' :
      '<p class="note">İşaretli kalemler envanterden düşer. İpler var/yok tutulduğu için yalnız kullanılan metre kaydedilir.</p>') +
    (H ? '<section class="set"><h4>İğneler</h4><ul class="mats done">' + H + '</ul></section>' : '') +
    (L ? '<section class="set"><h4>İpler</h4><ul class="mats done">' + L + '</ul></section>' : '') +
    (done ? '' : '<button class="btn primary" type="button" data-prepdone="' + esc(rid) + '">Envanterden düş</button>') +
    (log.length ? '<section class="set"><h4>Son hazırlıklar</h4><ul class="pchecks">' + log.map(x => '<li class="ok">' + esc(fmtDT(new Date(x.at)) + ' · ' + x.sum) + '</li>').join('') + '</ul></section>' : '') +
    '</div>', keep);
}
function applyDone(rid){
  const u = prepUse(rid); if (!u) return;
  const sheet = $('sheet'), on = sel => sheet.querySelector(sel);
  const ch = [], sum = [];
  // paket içi adet ve makara boyu girişleri
  sheet.querySelectorAll('input[data-pack]').forEach(el => { const v = Math.round(+el.value); if (v > 0) invX('pack')[el.dataset.pack] = v; });
  sheet.querySelectorAll('input[data-spool]').forEach(el => { const v = +el.value; if (v > 0) invX('spool')[el.dataset.spool] = v; else if (el.value === '') delete invX('spool')[el.dataset.spool]; });
  const u2 = prepUse(rid);   // paket içi adet değiştiyse yeniden
  u2.hooks.forEach(h => {
    const box = on('input[data-donek="' + CSS.escape(h.k) + '"]'); if (!box || !box.checked || !h.can) return;
    ch.push({kind: 'qty', k: h.k, before: h.q, after: h.after}); setQtyVal(h.k, h.after);
    if (h.u === 'paket') { ch.push({kind: 'loose', k: h.k, before: h.loose, after: h.afterLoose}); if (h.afterLoose) invX('loose')[h.k] = h.afterLoose; else delete invX('loose')[h.k]; }
    sum.push(h.n + ' × ' + h.it.name + (h.sz !== '-' ? ' ' + h.sz : ''));
  });
  u2.lines.forEach(l => { const box = on('input[data-donel="' + CSS.escape(l.id) + '"]'); if (!box || !box.checked) return;
    ch.push({kind: 'used', k: l.id, before: l.used, after: Math.round((l.used + l.m) * 100) / 100}); invX('used')[l.id] = Math.round((l.used + l.m) * 100) / 100; sum.push(fmtNum(l.m, 2) + ' m ' + trLower(l.t)); });
  if (!ch.length) { toast('Düşülecek kalem seçilmedi'); return; }
  const id = uid('h'); S.prepLog = [{id, at: Date.now(), rid, code: u.rg.code || '', sum: sum.join(', '), ch}].concat(S.prepLog || []).slice(0, 30);
  invChanged(); openDone(rid, false, id); toast('Envanterden düşüldü');
}
function undoDone(id){
  const i = (S.prepLog || []).findIndex(x => x.id === id); if (i < 0) return;
  const x = S.prepLog[i];
  x.ch.slice().reverse().forEach(c => { if (c.kind === 'qty') { if (c.before == null) delete S.inv.qty[c.k]; else setQtyVal(c.k, c.before); }
    else if (c.kind === 'loose') { if (c.before) invX('loose')[c.k] = c.before; else delete invX('loose')[c.k]; }
    else if (c.kind === 'used') { if (c.before) invX('used')[c.k] = c.before; else delete invX('used')[c.k]; } });
  S.prepLog.splice(i, 1); invChanged(); openDone(x.rid, true); toast('Geri alındı');
}
// envanter kartında: azalan iğne hangi rigleri etkiler (adet ya da paketle sayılan iğnede)
function lowNote(it){
  if (it.cat !== 'hook') return '';
  const u = unitOf(it); if (u === 'durum') return '';
  const low = sizesOf(it).filter(sz => { const k = it.id + '|' + sz, q = qtyOf(k); if (q == null) return false; const left = u === 'adet' ? q : q * ((S.inv.pack || {})[it.id] || PACK_DEF) + ((S.inv.loose || {})[k] || 0); return left < 4; });
  if (!low.length) return '';
  const users = RIG_LIST.filter(r => r.slots.some(s => { const e = s.t.envanter || {}; return e.item === it.id && low.includes(e.size || '-'); }));
  return users.length ? '<p class="note warnt">Az kaldı (' + esc(low.filter(x => x !== '-').join(', ') || 'bu iğne') + '): bitince ' + users.length + ' rig eksik kalır · ' + esc(users.slice(0, 6).map(r => r.code || r.name).join(', ')) + (users.length > 6 ? '…' : '') + '</p>' : '';
}
