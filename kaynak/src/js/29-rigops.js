// ---------------------------------------------------------------- 29 · rig silme ve birleştirme (v0.29.4)
// Sil: kendi sistemlerindeki rig (Rig Atölyesi, sihirbaz, tür planı) sistemden çıkar. Özel paketin rigi paketten silinmez, gizlenir;
// Rigler sayfasının altındaki "Gizlenen rigler" ile geri gelir. Envanter hiç değişmez.
// Birleştir: aynı av için yazılmış rigler (aynı teknik, aynı takım düzeni, aynı balık boyu, ortak tür grubu): gündüz + gece → tek rig
// (gündüz ve gece); türler, aylar ve dipler birleşir; iğne, ip ve boylar ilk seçilen rigden. Farklı av (ör. levrek yırtıcı rigi ile
// karagöz ya da ahtapot rigi) birleşmez; neden birleşmediği yazılır.
const rigHidden = id => !!(S && S.rigHide && S.rigHide[id]);
const rigTech = rg => rg.tech === 'dip-hirsizli' ? 'dip' : rg.tech || '';
const rigLay = rg => rg.sys === 'ozel' ? 'hirsizli' : rg.lay || (rg.legs ? 'hirsizli' : '');
const techName = rg => ((KB.TECH[rigTech(rg)] || {}).name || rigTech(rg) || 'rig').replace(/\s*\(.*?\)/g, '');
const layName = rg => (KB.LAY[rigLay(rg)] || {}).name || rigLay(rg) || '—';
const famName = f => (KB.FAM[f] || {}).name || f;
function rigFams(rg){ const f = new Set((rg.species || []).map(id => (spById(id) || {}).fam).filter(Boolean)); if (!f.size && rg.fam) f.add(rg.fam); return f; }
// iki rig birleşebilir mi: boşsa evet, değilse nedeni
function mergeWhy(a, b){
  if (rigTech(a) !== rigTech(b)) return 'Farklı teknik: ' + techName(a) + ' ↔ ' + techName(b) + '.';
  if ((a.mode || 'tekne') !== (b.mode || 'tekne')) return 'Biri tekneden, biri karadan (kıyıdan) avlanan rig.';
  if (rigLay(a) !== rigLay(b)) return 'Takım düzeni farklı: ' + layName(a) + ' ↔ ' + layName(b) + '.';
  if (a.klass && b.klass && a.klass !== b.klass) return 'Biri porsiyonluk, biri trofe: iğne boyu ve ip kalınlığı farklı.';
  const fa = rigFams(a), fb = rigFams(b);
  if (fa.size && fb.size) { if (![...fa].some(f => fb.has(f))) return 'Farklı av: ' + [...fa].map(famName).join(', ') + ' ↔ ' + [...fb].map(famName).join(', ') + '; iğne, ip ve yem farklı.'; }
  else if ((a.species || []).length && (b.species || []).length && !a.species.some(s => b.species.includes(s))) return 'Farklı türler için yazılmış: ' + (a.target || a.name) + ' ↔ ' + (b.target || b.name) + '.';
  return '';
}
// çözülmüş rigden saklanacak kopya (Rig Atölyem'e): iğne ve ipler bugünkü haliyle sabit, kamış/makine/terminal yeniden seçilir
function rigClone(rg){
  const c = JSON.parse(JSON.stringify(rg));
  ['gear', 'sys', 'success'].forEach(k => delete c[k]);
  c.lay = rigLay(rg) || c.lay;
  c.slots = (c.slots || []).map(sl => { ['ov', 'orig', 'fit', 'fitWhy', 'user'].forEach(k => delete sl[k]); if (!['rod', 'reel', 'term'].includes(sl.kind)) delete sl.sp; return sl; });
  return c;
}
function rigDropOv(id){ Object.keys(S.rigOv || {}).forEach(k => { if (k.indexOf(id + '|') === 0) delete S.rigOv[k]; }); }
// bir rigi kaldır (paket rigi gizlenir); envantere dokunulmaz
function rigRemoveOne(rg){
  if (!rg) return 'yok';
  if (rg.sys === 'ozel') { S.rigHide = S.rigHide || {}; S.rigHide[rg.id] = Date.now(); return 'gizli'; }
  const sy = S.systems[rg.sys]; if (!sy || !Array.isArray(sy.rigs)) return 'yok';
  sy.rigs = sy.rigs.filter(x => x.id !== rg.id); rigDropOv(rg.id);
  if (!sy.rigs.length) delete S.systems[rg.sys];
  return 'silindi';
}
function rigDelete(ids){
  const r = {silindi: 0, gizli: 0};
  ids.map(id => RIGS[id]).filter(Boolean).forEach(rg => { const k = rigRemoveOne(rg); if (r[k] != null) r[k]++; });
  persist(); indexAll(); noteRigChanges(true);
  return r;
}
const uniq = a => [...new Set(a)];
function mergeName(rs){
  const strip = n => String(n || '').replace(/\s*[·,-]?\s*\b(gündüz|gece|gündüz\/gece)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  const b = strip(rs[0].name);
  return rs.every(r => strip(r.name) === b) ? b + ' (gündüz ve gece)' : rs[0].name + ' + ' + rs.slice(1).map(r => r.code || r.name).join(' + ');
}
// birleştir: {ok, id, name} ya da {err, a, b}
function rigMerge(ids){
  const rs = ids.map(id => RIGS[id]).filter(Boolean);
  if (rs.length < 2) return {err: 'Birleştirmek için en az iki rig seç.'};
  const base = rs[0];
  for (const r of rs.slice(1)) { const w = mergeWhy(base, r); if (w) return {err: w, a: base, b: r}; }
  const sy0 = S.systems[base.sys];
  const same = base.sys !== 'ozel' && rs.every(r => r.sys === base.sys) && sy0 && Array.isArray(sy0.rigs) && sy0.rigs.some(x => x.id === base.id);
  const m = same ? JSON.parse(JSON.stringify(sy0.rigs.find(x => x.id === base.id))) : rigClone(base);
  const times = uniq(rs.map(r => r.time || 'her'));
  m.time = times.length > 1 || times.includes('her') ? 'her' : times[0];
  m.species = uniq(rs.flatMap(r => r.species || []));
  m.season = rs.every(r => r.season && r.season.length) ? uniq(rs.flatMap(r => r.season)).sort((x, y) => x - y) : null;
  m.window = null;
  m.bottom = uniq(rs.flatMap(r => r.bottom || []));
  m.core = rs.some(r => r.core);
  const names = m.species.map(id => (spById(id) || {}).name).filter(Boolean);
  if (names.length) m.target = names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : '');
  m.name = mergeName(rs);
  m.notes = (m.notes || []).filter(n => n.k !== 'Birleştirildi').concat([{k: 'Birleştirildi', t: rs.map(r => r.code || r.name).join(' + ') + ' (iğne, ip ve boylar ' + (base.code || base.name) + ' riginden)'}]);
  if (m.time === 'her' && /^[PT][GNH]$/.test(m.group || '')) { m.group = m.group[0] + 'H'; m.groupName = (KLASS_TXT[m.klass] || '') + ' ' + TIME_TXT.her; }
  let id = base.id;
  // aynı sistemde: kod da gündüz/gece harfinden (G-, N-) "H-"ye döner (ör. G-P1 + N-P1 → H-P1)
  if (same && m.time === 'her' && /^[GN]-[PT]\d+$/.test(m.code || '')) { const pre = 'H-' + m.code[2], used = new Set(sy0.rigs.map(x => x.code)); let n = 1; while (used.has(pre + n)) n++; m.code = pre + n; }
  if (same) {
    sy0.rigs = sy0.rigs.filter(x => x.id === base.id || !ids.includes(x.id)).map(x => x.id === base.id ? m : x);
    rs.slice(1).forEach(r => rigDropOv(r.id));
  } else {
    const sy = S.systems.atolye = S.systems.atolye || {id: 'atolye', name: 'Rig Atölyem', source: 'atolye', active: true, created: new Date().toISOString(), rigs: []};
    const n = sy.rigs.reduce((mx, x) => Math.max(mx, +(String(x.code || '').split('-')[1]) || 0), 0) + 1;
    id = 'atolye:' + uid('r'); m.id = id; m.code = 'A-' + n; m.group = 'atolye'; m.groupName = 'Rig Atölyem';
    sy.rigs.push(m); sy.updated = new Date().toISOString();
    rs.forEach(r => rigRemoveOne(r));
  }
  persist(); indexAll(); noteRigChanges(true);
  return {ok: true, id, name: m.name, code: (RIGS[id] || {}).code || m.code};
}
// birleşmedi: iki rig yan yana, neden
function mergeErrHtml(r){
  const row = rg => '<li>' + ic(TECH_IC[rg.tech] || 'rig') + '<span><b>' + esc((rg.code ? rg.code + ' · ' : '') + rg.name) + '</b><br><small class="note">' + esc(techName(rg) + ' · ' + layName(rg) + (rg.target ? ' · ' + rg.target : '')) + '</small></span></li>';
  return '<div class="mtop">' + ic('merge', 'coral') + '<h3 id="modalTitle">Bu rigler birleşemez</h3><button class="x" type="button" data-mclose aria-label="Kapat">×</button></div>' +
    (r.a && r.b ? '<ul class="mergewhy">' + row(r.a) + row(r.b) + '</ul>' : '') + '<p>' + esc(r.err) + '</p>' +
    '<p class="note">Birleşen rigler aynı av için yazılmış olmalı: ör. aynı türün gündüz ve gece rigi. Birini silebilir ya da ikisini ayrı tutabilirsin.</p>' +
    '<div class="row"><button class="btn primary" type="button" data-mclose>Tamam</button></div>';
}
// simge düğmesinde "emin misin": içerik bir an yazıya döner (armOnce yalnız yazıyı saklıyor)
function armIcon(b, txt){
  if (b.dataset.armed) return true;
  b.dataset.armed = '1'; b.dataset.html = b.innerHTML; b.innerHTML = txt;
  setTimeout(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.innerHTML = b.dataset.html; } }, 4000);
  return false;
}
