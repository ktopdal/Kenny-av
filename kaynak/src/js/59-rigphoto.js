// ---------------------------------------------------------------- 59 · rig fotoğrafı (B6) · v0.26
// Bağladığın takımın gerçek fotoğrafı rige eklenir (kamera ya da galeri; en çok 4). Fotoğraflar telefonda (IndexedDB) durur, hangi
// rigde oldukları profille (S.rigPhotos) eşitlenir; bulut yedeği açıksa fotoğraflar da yedeklenir. Hazırlama kartı resim olarak
// kaydedilirken ilk fotoğraf da resme girer.
const RP_MAX = 4;
const rigPh = rid => ((S.rigPhotos || {})[rid] || []).slice();
// av ve rig fotoğraflarının hepsi (yedek, dosya yedeği, geri yükleme)
const allPhotoIds = () => CATCHES.flatMap(c => c.photos || []).concat(Object.values(S.rigPhotos || {}).flat());
function rigPhotoHtml(rid){
  const ph = rigPh(rid);
  return '<section class="set"><h4>Fotoğraflar</h4>' + (ph.length ? '<div class="rphotos">' + ph.map(p => '<button type="button" class="rph" data-rphoto="' + esc(rid + '|' + p) + '"><img alt="Rig fotoğrafı" data-rph="' + esc(p) + '"></button>').join('') + '</div>' : '<p class="note">Bağladığın takımın fotoğrafını ekle: bir dahaki sefere aynısını kurarsın, arkadaşına da atarsın.</p>') +
    (ph.length < RP_MAX ? '<label class="btn small rpadd">Fotoğraf ekle<input type="file" accept="image/*" multiple hidden data-rpfile="' + esc(rid) + '"></label>' : '') + '</section>';
}
function fillRigPhotos(root){ (root || document).querySelectorAll('img[data-rph]').forEach(async im => { const u = await photoUrl(im.dataset.rph, 'thumb'); if (u) im.src = u; }); }
async function addRigPhotos(rid, files){
  const cur = rigPh(rid), room = RP_MAX - cur.length; if (room <= 0) { toast('En çok ' + RP_MAX + ' fotoğraf'); return; }
  let n = 0;
  for (const f of Array.from(files || []).slice(0, room)) {
    try { const p = await processPhoto(f); await IDB.put('photos', {id: p.id, big: p.big, thumb: p.thumb}); cur.push(p.id); n++; } catch (e) {}
  }
  if (!n) { toast('Fotoğraf eklenemedi'); return; }
  S.rigPhotos = S.rigPhotos || {}; S.rigPhotos[rid] = cur; persist();
  if (ui.sheet === 'prep' && ui.sheetArg === rid) openPrep(rid, true);
  renderAll(); toast(n + ' fotoğraf eklendi');
}
async function openRigPhoto(val){
  const [rid, pid] = val.split('|'); const u = await photoUrl(pid, 'big');
  const pb = ui.back, a = ui.sheetArg; ui.back = () => { ui.back = pb; openPrep(a, true); };
  ui.sheet = 'rphoto'; ui.sheetArg = val;
  openSheet(sheetBar('Rig fotoğrafı') + '<div class="stack">' + (u ? '<img class="rphbig" alt="Rig fotoğrafı" src="' + u + '">' : '<p class="note">Fotoğraf bu cihazda yok; bulut yedekten geri yüklenince gelir.</p>') +
    '<button class="btn" type="button" data-rphdel="' + esc(val) + '" style="color:var(--D)">Fotoğrafı sil</button></div>');
}
async function delRigPhoto(val){
  const [rid, pid] = val.split('|');
  S.rigPhotos[rid] = rigPh(rid).filter(x => x !== pid); if (!S.rigPhotos[rid].length) delete S.rigPhotos[rid];
  try { await IDB.del('photos', pid); } catch (e) {} dropUrls(pid); persist();
  ui.back = null; openPrep(rid); renderAll(); toast('Fotoğraf silindi');
}
// hazırlama resmine ilk fotoğraf (data URL)
async function rigPhotoData(rid){
  const pid = rigPh(rid)[0]; if (!pid) return null;
  try { const p = await IDB.get('photos', pid); if (!p) return null; return await blobToDataUrl(p.big); } catch (e) { return null; }
}
