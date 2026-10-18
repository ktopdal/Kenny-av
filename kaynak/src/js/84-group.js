// ---------------------------------------------------------------- 84 · ortak av haritası: kapalı grup (GitHub deposu, grup anahtarıyla uçtan uca şifreli)
// Her üye kendi dosyasını yazar: grup/<üye>.json = {app:'alyssa-grup', enc: base64(iv‖AES-GCM)}; herkes klasördeki dosyaları okur, grup anahtarıyla açar.
// Davet bağlantısı (#grup=…) depo adını, depoya yazan anahtarı ve grup anahtarını taşır: bağlantı kimdeyse grupta odur.
// Her av baştan gizlidir; paylaşılan avın yeri 1 ya da 2 km'lik karenin ortasına yuvarlanır, istenirse 1–2 gün gecikmeli görünür.
const GRP_LS = 'alyssa-grp';
const grpCfg = () => { try { return JSON.parse(lsGet(GRP_LS) || 'null'); } catch (e) { return null; } };
const grpOn = () => { const g = grpCfg(); return !!(g && g.repo && g.tok && g.key && g.me); };
const grpC = g => ({repo: g.repo, tok: g.tok});
const grpDef = () => Object.assign({grid: 1, delay: 0}, S.settings.grpDef || {});
let GROUP = {at: 0, members: [], err: null, busy: false};
function roundGrid(lat, lon, km){
  const dLat = km / 110.57, dLon = km / (111.32 * Math.cos(lat * Math.PI / 180));
  return {lat: +((Math.floor(lat / dLat) + 0.5) * dLat).toFixed(5), lon: +((Math.floor(lon / dLon) + 0.5) * dLon).toFixed(5)};
}
function sharedRecord(c){
  const sh = c.share || {}; const km = sh.grid || 1;
  const p = c.loc && c.loc.lat != null ? roundGrid(c.loc.lat, c.loc.lon, km) : null; const rg = c.rig && RIGS[c.rig];
  return {id: c.id, sp: c.species, spName: catchLine(c).sp, n: c.count || 1, kg: c.kg, cm: c.cm, t: c.t, vis: new Date(new Date(c.t).getTime() + (sh.delay || 0) * 86400000).toISOString(),
    lat: p ? p.lat : null, lon: p ? p.lon : null, km, rig: rg ? (rg.code ? rg.code + ' · ' : '') + rg.name : '', bait: c.bait || '', depth: c.depth_m, bottom: c.bottom || ''};
}
async function grpPublish(){
  const g = grpCfg(); if (!g) return 0;
  const list = CATCHES.filter(c => c.share && c.share.on).map(sharedRecord);
  const body = {member: g.name, me: g.me, updated: new Date().toISOString(), catches: list};
  const enc = b64e(await aesEnc(b64d(g.key), new TextEncoder().encode(JSON.stringify(body))));
  const c = grpC(g), path = 'grup/' + g.me + '.json';
  await ghPutFile(c, path, b64eUtf8(JSON.stringify({app: 'alyssa-grup', v: 1, enc})), 'grup: ' + g.me, await ghSha(c, path));
  GROUP.at = 0; return list.length;
}
async function grpFetch(force){
  const g = grpCfg(); if (!g) return GROUP;
  if (!force && GROUP.at && Date.now() - GROUP.at < 5 * 60000) return GROUP;
  GROUP.busy = true;
  try {
    const c = grpC(g); const r = await gh('GET', c, 'grup');
    if (r.status === 404) { GROUP = {at: Date.now(), members: [], err: null}; return GROUP; }
    await ghCheck(r);
    const files = (await r.json()).filter(f => f.type === 'file' && /\.json$/.test(f.name));
    const raw = b64d(g.key), members = [];
    for (const f of files) {
      try {
        const rr = await gh('GET', c, f.path, null, true); await ghCheck(rr);
        const j = JSON.parse(await rr.text()); if (j.app !== 'alyssa-grup') continue;
        const m = JSON.parse(new TextDecoder().decode(await aesDec(raw, b64d(j.enc)))); m.file = f.name; members.push(m);
      } catch (e) { /* başka anahtarla yazılmış ya da bozuk dosya: atla */ }
    }
    GROUP = {at: Date.now(), members, err: null};
  } catch (e) { GROUP = Object.assign({}, GROUP, {err: e.message || 'bağlantı yok'}); }
  finally { GROUP.busy = false; }
  return GROUP;
}
function grpCatches(){
  const now = Date.now(), me = (grpCfg() || {}).me;
  return GROUP.members.flatMap(m => (m.catches || []).filter(c => c.lat != null && new Date(c.vis || c.t).getTime() <= now).map(c => Object.assign({member: m.member, mine: m.me === me}, c)));
}
const inviteLink = g => SHARE_URL() + '#grup=' + b64url(new TextEncoder().encode(JSON.stringify({r: g.repo, t: g.tok, k: g.key, n: g.group, by: g.name})));
function sheetGroup(){
  const g = grpCfg();
  if (!g) return sheetBar('Ortak av haritası') + '<div class="stack">' +
    '<p class="sub">Kapalı bir grubun (sen, Ogün, birkaç arkadaş) paylaştığı avlar ortak haritada görünür. Her av baştan gizlidir; paylaşmak istediğini avın sayfasından seçersin. Nokta 1–2 km’lik kareye yuvarlanır.</p>' +
    '<p class="note">Bir davet bağlantın varsa ona dokun; uygulama seni gruba katar. Grubu sen kuracaksan:</p>' +
    '<form class="panel stack" id="grpForm" novalidate><div class="fields">' +
    '<label class="f wide">Depo (kullanıcı/depo)<input id="gp-repo" placeholder="ör. ktopdal/alyssa-grup" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
    '<label class="f wide">GitHub anahtarı (yalnızca bu depo)<input id="gp-tok" type="password" autocomplete="off" placeholder="github_pat_…"></label>' +
    '<label class="f">Grubun adı<input id="gp-name" placeholder="ör. Seferihisar avcıları"></label>' +
    '<label class="f">Senin adın<input id="gp-me" value="' + esc(S.profile.name || '') + '" placeholder="ör. Kenny"></label></div>' +
    '<p class="err" id="gpErr" hidden></p><button class="btn primary" type="submit">Grubu kur</button></form>' +
    '<details class="panel"><summary>GitHub’da depo ve anahtar nasıl hazırlanır?</summary><ol class="steps">' +
    '<li>GitHub’da yeni bir <b>özel</b> depo aç (ör. alyssa-grup). Yedek deponu kullanma.</li>' +
    '<li>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.</li>' +
    '<li>Repository access: “Only select repositories” → yalnızca bu depo. Permissions → Contents: <b>Read and write</b>.</li>' +
    '<li>Anahtarı buraya yapıştır. Davet bağlantısı bu anahtarı taşır; birini çıkarmak için anahtarı yenileyip yeni davet gönder.</li></ol></details></div>';
  const mine = CATCHES.filter(c => c.share && c.share.on).length; const d = grpDef();
  const mem = GROUP.members.map(m => '<div class="item"><b>' + esc(m.member || m.me) + (m.me === g.me ? ' (sen)' : '') + '</b><div class="sp">' + (m.catches || []).length + ' paylaşılan av · son güncelleme ' + (m.updated ? fmtDT(new Date(m.updated)) : '–') + '</div></div>').join('');
  return sheetBar('Ortak av haritası') + '<div class="stack">' +
    '<div class="panel stack"><b>' + esc(g.group || 'Grup') + '</b><span class="note">Depo ' + esc(g.repo) + ' · sen: ' + esc(g.name) + ' · paylaştığın av: ' + mine + '</span>' +
    '<div class="row"><button class="btn primary" type="button" data-grp="map">Haritada gör</button><button class="btn" type="button" data-grp="invite">Davet bağlantısı</button><button class="btn" type="button" data-grp="refresh">Yenile</button></div></div>' +
    '<div id="grpInvite"></div>' +
    '<section class="set"><h4>Üyeler</h4>' + (GROUP.busy ? '<p class="note">Yükleniyor…</p>' : GROUP.err ? '<p class="err">' + esc(GROUP.err) + '</p>' : mem || '<p class="note">Henüz kimse paylaşmadı.</p>') + '</section>' +
    '<section class="set"><h4>Paylaşırken varsayılan</h4><div class="fields"><label class="f">Yer hassasiyeti<select data-grpdef="grid"><option value="1"' + (d.grid === 1 ? ' selected' : '') + '>1 km kare</option><option value="2"' + (d.grid === 2 ? ' selected' : '') + '>2 km kare</option></select></label>' +
    '<label class="f">Gecikme<select data-grpdef="delay"><option value="0"' + (d.delay === 0 ? ' selected' : '') + '>Hemen</option><option value="1"' + (d.delay === 1 ? ' selected' : '') + '>1 gün sonra</option><option value="2"' + (d.delay === 2 ? ' selected' : '') + '>2 gün sonra</option></select></label></div>' +
    '<p class="note">Bir avı paylaşmak için Avlar’da avına dokun → “Grupla paylaş”.</p></section>' +
    '<button class="btn small" type="button" data-grp="leave">Gruptan çık</button></div>';
}
async function grpCreate(){
  const err = m => { $('gpErr').textContent = m; $('gpErr').hidden = false; };
  const repo = $('gp-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, ''), tok = $('gp-tok').value.trim(), group = $('gp-name').value.trim(), name = $('gp-me').value.trim();
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) { err('Depoyu kullanıcı/depo biçiminde yaz.'); return; }
  if (!tok) { err('GitHub anahtarını yapıştır.'); return; }
  if (!name) { err('Adını yaz; üyeler seni bu adla görür.'); return; }
  const key = crypto.getRandomValues(new Uint8Array(32));
  const g = {repo, tok, key: b64e(key), group: group || 'Av grubu', name, me: (slugTR(name) || 'uye') + '-' + Math.random().toString(36).slice(2, 6)};
  try {
    const c = grpC(g); const path = 'grup/README.md';
    await ghPutFile(c, path, b64eUtf8('# Alyssa ortak av haritası\n\nBu klasördeki dosyalar grup anahtarıyla şifrelidir.\n'), 'grup kuruldu', await ghSha(c, path));
  } catch (e) { err(e.message || 'GitHub’a yazılamadı'); return; }
  lsSet(GRP_LS, JSON.stringify(g)); if (!S.profile.name) { S.profile.name = name; persist(); }
  try { await grpPublish(); } catch (e) {}
  await grpFetch(true); openMore('grup', true); grpInvite(); toast('Grup kuruldu');
}
function grpInvite(){
  const g = grpCfg(), el = $('grpInvite'); if (!g || !el) return;
  const url = inviteLink(g); const text = g.name + ' seni Alyssa’da “' + g.group + '” av grubuna davet ediyor. Katılmak için dokun: ' + url;
  el.innerHTML = '<section class="set"><h4>Davet bağlantısı</h4><p class="note">Bu bağlantı grubun anahtarını taşır; yalnızca gruba almak istediğin kişilere gönder.</p>' +
    '<div class="row"><a class="btn primary" href="https://wa.me/?text=' + encodeURIComponent(text) + '" target="_blank" rel="noopener">WhatsApp ile gönder</a><button class="btn" type="button" data-grp="copy">Kopyala</button></div></section>';
  grpInvite.last = url;
}
let GRP_IN = null;
function openGroupInvite(raw){
  let d = null; try { d = JSON.parse(new TextDecoder().decode(b64urlDec(raw))); } catch (e) {}
  if (!d || !d.r || !d.t || !d.k) { toast('Davet bağlantısı açılamadı'); clearShareHash(); return; }
  GRP_IN = d; ui.sheet = 'grupdavet';
  const g = grpCfg();
  openSheet(sheetBar('Grup daveti', null, 'Kapat') + '<div class="stack"><p class="sub"><b>' + esc(d.by || 'Bir arkadaşın') + '</b> seni <b>“' + esc(d.n || 'Av grubu') + '”</b> grubuna davet ediyor.</p>' +
    (g ? '<p class="note">Şu an “' + esc(g.group) + '” grubundasın; katılırsan o gruptan çıkarsın.</p>' : '') +
    '<p class="note">Grupta paylaşılan avları ortak haritada görürsün. Sen bir avı paylaşmadıkça hiçbir avın gruba gitmez.</p>' +
    '<label class="f">Adın (üyeler seni böyle görür)<input id="gj-name" value="' + esc(S.profile.name || '') + '" placeholder="ör. Ogün"></label><p class="err" id="gjErr" hidden></p>' +
    '<div class="row"><button class="btn primary" type="button" data-grp="join">Gruba katıl</button><button class="btn" type="button" data-grp="nojoin">Vazgeç</button></div></div>');
}
async function grpJoin(){
  const d = GRP_IN; if (!d) return;
  const name = ($('gj-name').value || '').trim(); if (!name) { $('gjErr').textContent = 'Adını yaz.'; $('gjErr').hidden = false; return; }
  const g = {repo: d.r, tok: d.t, key: d.k, group: d.n || 'Av grubu', name, me: (slugTR(name) || 'uye') + '-' + Math.random().toString(36).slice(2, 6)};
  lsSet(GRP_LS, JSON.stringify(g)); if (!S.profile.name) S.profile.name = name; S.onboarded = true; persist();
  GRP_IN = null; clearShareHash();
  if ($('welcome') && !$('welcome').hidden) hideWelcome();
  try { await grpPublish(); toast('Gruba katıldın: ' + g.group); } catch (e) { toast('Gruba katıldın ama yazılamadı: ' + (e.message || '')); }
  await grpFetch(true); openMore('grup');
}
async function grpAct(a, b){
  if (a === 'map') { const cfg = mapCfg(); cfg.grup = true; S.settings.map = cfg; persistQuiet(); openMap(); return; }
  if (a === 'invite') { grpInvite(); return; }
  if (a === 'copy') { try { await navigator.clipboard.writeText(grpInvite.last); toast('Davet kopyalandı'); } catch (e) { toast('Kopyalanamadı'); } return; }
  if (a === 'refresh') { GROUP.busy = true; openMore('grup', true); await grpFetch(true); if (ui.sheet === 'grup') openMore('grup', true); return; }
  if (a === 'leave') { if (!armOnce(b, 'Çıkmak için tekrar dokun')) return; lsDel(GRP_LS); GROUP = {at: 0, members: [], err: null}; openMore('grup', true); toast('Gruptan çıktın'); return; }
  if (a === 'join') { grpJoin(); return; }
  if (a === 'nojoin') { GRP_IN = null; closeSheet(); clearShareHash(); return; }
}
// av sayfasında paylaşım seçenekleri
function catchShareBox(c){
  if (!grpOn()) return '';
  const sh = c.share || {}, d = grpDef(), on = !!sh.on, grid = sh.grid || d.grid, delay = sh.delay != null ? sh.delay : d.delay;
  return '<div class="panel stack grpbox"><label class="chk"><input type="checkbox" data-grpshare="' + esc(c.id) + '"' + (on ? ' checked' : '') + '> <b>Grupla paylaş</b> (' + esc((grpCfg() || {}).group || '') + ')</label>' +
    '<div class="fields"><label class="f">Yer<select data-grpopt="grid" data-cid="' + esc(c.id) + '"><option value="1"' + (grid === 1 ? ' selected' : '') + '>1 km kare</option><option value="2"' + (grid === 2 ? ' selected' : '') + '>2 km kare</option></select></label>' +
    '<label class="f">Görünsün<select data-grpopt="delay" data-cid="' + esc(c.id) + '"><option value="0"' + (delay === 0 ? ' selected' : '') + '>Hemen</option><option value="1"' + (delay === 1 ? ' selected' : '') + '>1 gün sonra</option><option value="2"' + (delay === 2 ? ' selected' : '') + '>2 gün sonra</option></select></label></div>' +
    '<p class="note">Gruba tür, boy/kilo, tarih, rig ve yem gider; yer karenin ortasına yuvarlanır, fotoğraf gitmez.</p></div>';
}
async function setCatchShare(id, patch){
  const c = CATCHES.find(x => x.id === id); if (!c) return;
  const d = grpDef(); c.share = Object.assign({on: false, grid: d.grid, delay: d.delay}, c.share || {}, patch);
  await IDB.put('catches', c); markDirty();
  try { const n = await grpPublish(); toast(c.share.on ? 'Grupla paylaşıldı (' + n + ' av)' : 'Paylaşım kaldırıldı'); } catch (e) { toast('Gruba yazılamadı: ' + (e.message || '')); }
}
