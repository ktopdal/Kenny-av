// ---------------------------------------------------------------- 80 · bulut yedek (GitHub, uçtan uca şifreli)
// Dosyalar: kullanicilar/<profil>/profil.json (şifreli profil + av kayıtları) ve kullanicilar/<profil>/foto/<id>.bin (şifreli fotoğraf).
// Anahtar yedek şifresinden PBKDF2 (600 000 tur, profile özel tuz) ile türetilir; GitHub anahtarı ve yedek şifresi yedeğe girmez.
const GH_API = 'https://api.github.com';
const BK = {timer: null, busy: false, dirty: false};
const bkCfg = () => ({repo: String(S.backup.repo || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, ''), name: slugTR(S.backup.name || S.profile.name || '') || 'profil', tok: lsGet(LS.ghTok) || ''});
const bkReady = () => { const c = bkCfg(); return /^[^/\s]+\/[^/\s]+$/.test(c.repo) && !!c.tok && !!lsGet(LS.bkKey) && !!S.backup.salt; };
const ghPath = (c, f) => 'kullanicilar/' + c.name + '/' + f;
function bkStatusText(){
  const b = S.backup;
  if (BK.busy) return 'Yedekleniyor…';
  if (b.err) return 'Son deneme başarısız: ' + b.err;
  return b.lastAt ? 'Son yedek ' + fmtDT(new Date(b.lastAt)) + (BK.dirty ? ' · bekleyen değişiklik var' : '') : 'Henüz yedek alınmadı';
}
function setBkStatus(){ const el = $('bkStatus'); if (el) el.textContent = bkStatusText(); }
async function gh(method, c, path, body, raw){
  const url = GH_API + '/repos/' + c.repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + (method === 'GET' ? '?t=' + Date.now() : '');
  const h = {Authorization: 'Bearer ' + c.tok, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'};
  if (body) h['Content-Type'] = 'application/json';
  return fetchT(url, {method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store'}, 60000);
}
function ghErrText(st){
  return {401: 'GitHub anahtarı geçersiz ya da süresi dolmuş', 403: 'anahtarın bu depoya yazma izni yok (Contents: Read and write)', 404: 'depo bulunamadı ya da anahtar bu depoya erişemiyor',
    409: 'dosya çakışması, yeniden denenecek', 422: 'GitHub isteği reddetti', 429: 'çok fazla istek, biraz sonra yeniden dene'}[st] || ('GitHub hatası ' + st);
}
async function ghCheck(r){ if (!r.ok) throw new Error(ghErrText(r.status)); return r; }
async function ghSha(c, path){ const r = await gh('GET', c, path); if (r.status === 404) return null; await ghCheck(r); const j = await r.json(); return j.sha || null; }
async function ghPutFile(c, path, b64, msg, sha){
  let r = await gh('PUT', c, path, {message: msg, content: b64, sha: sha || undefined});
  if (r.status === 409 || r.status === 422) { const s2 = await ghSha(c, path); r = await gh('PUT', c, path, {message: msg, content: b64, sha: s2 || undefined}); }
  await ghCheck(r); const j = await r.json(); return j.content && j.content.sha;
}
// fotoğraf paketi: [4 bayt büyük boy][büyük JPEG][küçük JPEG]
async function packPhoto(p){
  const big = new Uint8Array(await p.big.arrayBuffer()), th = new Uint8Array(await p.thumb.arrayBuffer());
  const out = new Uint8Array(4 + big.length + th.length); new DataView(out.buffer).setUint32(0, big.length); out.set(big, 4); out.set(th, 4 + big.length); return out;
}
function unpackPhoto(id, u){ const n = new DataView(u.buffer, u.byteOffset, u.byteLength).getUint32(0); return {id, big: new Blob([u.subarray(4, 4 + n)], {type: 'image/jpeg'}), thumb: new Blob([u.subarray(4 + n)], {type: 'image/jpeg'})}; }
function bkPayload(){
  const st = JSON.parse(JSON.stringify(S)); st.wx = null;
  return {app: 'alyssa', v: 1, at: new Date().toISOString(), version: APP_VERSION, state: st, catches: CATCHES, pkgKey: lsGet(LS.pkgKey) || null};
}
function markDirty(){
  if (typeof cloudDirty === 'function') cloudDirty();   // 15-cloud.js: hesap açıksa buluta da yazılır
  BK.dirty = true;
  if (PREVIEW || !S.backup.auto || !bkReady()) return;
  clearTimeout(BK.timer); BK.timer = setTimeout(() => backupNow(false), 60000);
}
async function backupNow(manual){
  if (BK.busy) return false;
  const c = bkCfg(); const raw = b64d(lsGet(LS.bkKey) || '');
  if (!bkReady()) { if (manual) toast('Önce bulut yedeğini ayarla'); return false; }
  BK.busy = true; clearTimeout(BK.timer); setBkStatus();
  try {
    if (S.backup.photosOn !== false) {
      for (const pid of allPhotoIds()) {   // av ve rig fotoğrafları
        if (S.backup.photos[pid]) continue;
        const p = await IDB.get('photos', pid); if (!p) continue;
        const path = ghPath(c, 'foto/' + pid + '.bin');
        if (!(await ghSha(c, path))) await ghPutFile(c, path, b64e(await aesEnc(raw, await packPhoto(p))), 'foto ' + pid);
        S.backup.photos[pid] = 1; persistQuiet();
      }
    }
    BK.dirty = false;
    const enc = await aesEnc(raw, new TextEncoder().encode(JSON.stringify(bkPayload())));
    const file = {app: 'alyssa-yedek', v: 1, salt: S.backup.salt, iter: 600000, at: new Date().toISOString(), data: b64e(enc)};
    S.backup.sha = await ghPutFile(c, ghPath(c, 'profil.json'), b64eUtf8(JSON.stringify(file)), 'yedek ' + new Date().toISOString().slice(0, 16).replace('T', ' '), S.backup.sha);
    S.backup.lastAt = Date.now(); S.backup.err = null; persistQuiet();
    if (manual) toast('Yedek alındı');
    return true;
  } catch (e) {
    BK.dirty = true; S.backup.err = String(e && e.name === 'AbortError' ? 'zaman aşımı' : (e && e.message) || e); persistQuiet();
    if (manual) toast('Yedek alınamadı: ' + S.backup.err);
    return false;
  } finally { BK.busy = false; setBkStatus(); if (ui.sheet === null) renderMore(); }
}
// uzak profil dosyası: {file} | null (yok)
async function bkRemote(c){
  const r = await gh('GET', c, ghPath(c, 'profil.json'), null, true);
  if (r.status === 404) return null;
  await ghCheck(r);
  return JSON.parse(await r.text());
}
// "Bağlan ve yedekle" / "Ayarları kaydet"
async function submitBackupForm(force){
  const err = m => { $('bkErr').textContent = m; $('bkErr').hidden = false; };
  $('bkErr').hidden = true; $('bkConflict').innerHTML = '';
  const repo = $('bk-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, ''), name = slugTR($('bk-name').value), tok = $('bk-tok').value.trim(), pass = $('bk-pass').value;
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) { err('Depoyu kullanıcı/depo biçiminde yaz. Ör. ktopdal/alyssa-yedek'); return; }
  if (!name) { err('Bir profil adı yaz. Ör. kenny'); return; }
  if (!tok && !lsGet(LS.ghTok)) { err('GitHub anahtarını yapıştır.'); return; }
  const changed = repo !== S.backup.repo || name !== S.backup.name;
  S.backup.repo = repo; S.backup.name = name; S.backup.auto = $('bk-auto').checked; S.backup.photosOn = $('bk-photos').checked;
  if (tok) lsSet(LS.ghTok, tok);
  if (changed) { S.backup.sha = null; S.backup.photos = {}; }
  persistQuiet();
  if (lsGet(LS.bkKey) && S.backup.salt && !pass && !changed) { toast('Ayarlar kaydedildi'); openMore('yedek', true); if (BK.dirty) backupNow(false); return; }
  if (!pass) { err('Yedek şifresini yaz. Yedeği açmak için bu şifre gerekir.'); return; }
  const c = bkCfg(); let remote = null;
  setBusy(true, 'Bağlanıyor…');
  try { remote = await bkRemote(c); } catch (e) { setBusy(false); err(e.message || String(e)); return; }
  if (remote && !force) {
    setBusy(false);
    $('bkConflict').innerHTML = '<div class="banner stack"><b>Bu profil adıyla bulutta bir yedek var' + (remote.at ? ' (' + esc(fmtDT(new Date(remote.at))) + ')' : '') + '.</b><span>Bu telefona geri yükleyebilir ya da bu telefondaki profille üzerine yazabilirsin.</span>' +
      '<div class="row"><button class="btn primary" type="button" data-act="bkRestore">Buradan geri yükle</button><button class="btn" type="button" data-act="bkOverwrite">Üzerine yaz</button></div></div>';
    BK.pendingPass = pass; return;
  }
  try {
    const salt = remote && remote.salt ? remote.salt : b64e(crypto.getRandomValues(new Uint8Array(16)));
    const raw = await deriveRaw(pass, b64d(salt), 600000);
    lsSet(LS.bkKey, b64e(raw)); S.backup.salt = salt; S.backup.sha = null; S.backup.err = null; persistQuiet();
    setBusy(false); openMore('yedek', true);
    await backupNow(true); openMore('yedek', true);
  } catch (e) { setBusy(false); err(e.message || String(e)); }
}
function setBusy(on, txt){ const f = $('bkForm'); if (!f) return; f.querySelectorAll('button').forEach(b => { b.disabled = on; }); const s = f.querySelector('button[type="submit"]'); if (s) { if (on) { s.dataset.t = s.textContent; s.textContent = txt || '…'; } else if (s.dataset.t) s.textContent = s.dataset.t; } }
// geri yükleme: profil dosyasını indir, şifreyi doğrula, profili ve avları değiştir, fotoğrafları indir
async function restoreNow(pass){
  const c = bkCfg();
  const remote = await bkRemote(c);
  if (!remote) throw new Error('Bu profil adıyla bulutta yedek bulunamadı');
  const raw = await deriveRaw(pass, b64d(remote.salt), remote.iter || 600000);
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(await aesDec(raw, b64d(remote.data)))); } catch (e) { throw new Error('Yedek şifresi tutmadı'); }
  const keep = {repo: c.repo, name: c.name, auto: S.backup.auto, photosOn: S.backup.photosOn};
  S = normalizeState(Object.assign(newState(), payload.state));
  S.backup = Object.assign(S.backup, keep, {salt: remote.salt, err: null, lastAt: Date.now()});
  S.onboarded = true;
  lsSet(LS.bkKey, b64e(raw));
  if (payload.pkgKey) lsSet(LS.pkgKey, payload.pkgKey);
  persistQuiet();
  for (const ct of (payload.catches || [])) await IDB.put('catches', ct);
  await loadCatches();
  if (S.pkg.unlocked && payload.pkgKey) { const r = await pkgRefresh(); if (r === 'locked') { S.pkg.need = true; } }
  pkgLoadCached(); indexAll(); applyTheme(); renderAll(); loadWeather(true);
  // fotoğraflar arka planda
  let n = 0;
  for (const pid of allPhotoIds()) {
    try {
      if (await IDB.get('photos', pid)) continue;
      const r = await gh('GET', c, ghPath(c, 'foto/' + pid + '.bin'), null, true);
      if (!r.ok) continue;
      const dec = await aesDec(raw, new Uint8Array(await r.arrayBuffer()));
      await IDB.put('photos', unpackPhoto(pid, dec)); S.backup.photos[pid] = 1; n++;
    } catch (e) {}
  }
  persistQuiet(); renderCatches();
  return {catches: CATCHES.length, photos: n};
}
async function doRestore(passFromForm){
  const pass = passFromForm || ($('bk-pass') && $('bk-pass').value) || BK.pendingPass;
  if (!pass) { const e = $('bkErr'); if (e) { e.textContent = 'Geri yüklemek için yedek şifresini yaz.'; e.hidden = false; } return; }
  const form = $('bkForm');
  if (form) { const repo = $('bk-repo').value.trim(), name = slugTR($('bk-name').value), tok = $('bk-tok').value.trim(); if (repo) S.backup.repo = repo.replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, ''); if (name) S.backup.name = name; if (tok) lsSet(LS.ghTok, tok); }
  setBusy(true, 'Geri yükleniyor…'); toast('Geri yükleniyor…');
  try {
    const r = await restoreNow(pass); BK.pendingPass = null;
    closeSheet(); toast('Geri yüklendi: ' + r.catches + ' av' + (r.photos ? ', ' + r.photos + ' fotoğraf' : ''));
  } catch (e) { setBusy(false); const el = $('bkErr'); if (el) { el.textContent = e.message || String(e); el.hidden = false; } else toast(e.message || String(e)); }
}

// v0.28 · profili sıfırla: özel paket (32 rig sistemi) ve ayarlar kalır
async function resetProfile(av, locs){
  Object.keys(S.systems).forEach(k => { if (k !== 'ozel') delete S.systems[k]; });
  S.inv = {items: {}, qty: {}, status: {}, unit: {}, v: 2};
  S.targets = []; S.shopX = {}; S.rigOv = {}; S.rigPhotos = {}; S.prepLog = []; S.advice = []; S.fb = {}; S.profile.baits = [];
  if (locs) Object.keys(S.locations).forEach(id => { const L = S.locations[id]; if (!(L.pkg)) delete S.locations[id]; });
  if (!S.locations[S.active]) S.active = Object.keys(S.locations)[0] || null;
  if (av) { try { for (const c of CATCHES) { await IDB.del('catches', c.id); (c.photos || []).forEach(p => IDB.del('photos', p).catch(() => {})); } } catch (e) {} await loadCatches(); }
  persist(); indexAll(); renderAll(); closeSheet(); toast('Profil sıfırlandı; özel paketin duruyor');
}
