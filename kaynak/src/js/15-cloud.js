// ---------------------------------------------------------------- 15 · hesap ve bulut eşitleme (Firebase: Google ya da e-postayla giriş)
// Giriş isteğe bağlıdır; girilmezse uygulama eskisi gibi yalnızca telefonda çalışır. Girişte profil (rigler, envanter, konumlar, ayarlar)
// ve av kayıtları kullanıcının kendi Firestore belgesine (users/<uid>) yazılır; veritabanı kuralı gereği başkası okuyamaz.
// Fotoğraflar telefonda kalır. Özel paketin şifresi ve anahtarı buluta gitmez; yeni cihazda paket şifresi bir kez girilir.
// Hesap değişince (ör. deneme hesabı) telefondaki veri o hesabın verisiyle yer değiştirir; yeni hesap ilk girişte telefondaki verinin
// kopyasıyla ya da boş başlar.
// Eşitleme (v0.18): her cihazın kimliği var; son eşitlenen veri "taban" olarak cihazda saklanır. İki cihazda da değişiklik varsa
// taban üzerinden alan alan birleştirilir (rig sistemleri, konumlar, envanter kalemleri, ayarlar, avlar ayrı ayrı); aynı şey iki
// yerde değiştiyse son değiştiren kazanır (birleştiren cihaz; saatler 1 dakikadan çok farklıysa saati yeni olan). Cihaz saatleri
// birbirinden kayabildiği için "yeni mi" kararı saatle değil, belgenin sürümü ve tabanla karşılaştırarak verilir.
// Uygulama açıkken 30 sn'de bir küçük bir okumayla (yalnız sürüm) yenilik var mı bakılır.
// Birleştirmeden ya da başka cihazın verisi gelmeden önce bu cihazın hâli "önceki hâl" olarak saklanır (Hesap → Önceki hâline dön).
const FB_CONFIG = /*__FBCONFIG__*/null;
const cloudOn = () => !!FB_CONFIG && !PREVIEW;
const LSC = {owner: 'alyssa-cu', sync: 'alyssa-cs', base: 'alyssa-cb', dev: 'alyssa-dev', prev: 'alyssa-cprev', from: 'alyssa-cfrom'};
// cihaza özgü olanlar eşitlenmez: hava önbelleği, dosya yedeği ayarı, sürüm notu, paket kilidi, haritanın son görünümü, yazı boyutu, bilgi alanı
const DEV_KEYS = ['wx', 'backup', 'seenVersion', 'modAt', 'pkg'], DEV_SET = ['mapView', 'hFull', 'zoom'];
const QA_FAST = /[?&]qa=1\b/.test(location.search);
function devInfo(){
  let id = lsGet(LSC.dev); if (!id) { id = 'd' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); lsSet(LSC.dev, id); }
  const ua = navigator.userAgent || '', touch = (navigator.maxTouchPoints || 0) > 1;
  const name = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android telefon' : 'Android tablet') :
    /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Tarayıcı';
  return {id, name};
}
const DEV = devInfo();
// eşitlenen kısım: cihaza özgü alanlar çıkarılır
function syncPart(st){
  const o = JSON.parse(JSON.stringify(st || {})); DEV_KEYS.forEach(k => { delete o[k]; });
  if (o.settings) DEV_SET.forEach(k => { delete o.settings[k]; });
  return o;
}
// sıralı JSON: aynı veri iki cihazda farklı anahtar sırasıyla yazılmış olsa da eşit sayılır
const stableJ = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => { o[kk] = x[kk]; return o; }, {}) : x);
const sameJ = (a, b) => stableJ(a) === stableJ(b);
const isPlain = v => !!v && typeof v === 'object' && !Array.isArray(v);
// üç yollu birleştirme: b taban, l bu cihaz, r hesap. Yalnız bir taraf değiştiyse o alınır; ikisi de değiştiyse nesneler anahtar anahtar,
// diğerleri (sayı, yazı, liste) için yeni olan alınır; biri silip diğeri düzenlediyse düzenleme kalır
function merge3(b, l, r, newer, path, log){
  if (sameJ(l, r)) return l;
  if (sameJ(l, b)) return r;
  if (sameJ(r, b)) return l;
  if (isPlain(l) && isPlain(r)) {
    const out = {};
    new Set(Object.keys(l).concat(Object.keys(r))).forEach(k => { const v = merge3(isPlain(b) ? b[k] : undefined, l[k], r[k], newer, path + '.' + k, log); if (v !== undefined) out[k] = v; });
    return out;
  }
  if (l === undefined) return r;
  if (r === undefined) return l;
  log.push(path); return newer === 'remote' ? r : l;
}
const byId = list => { const o = {}; (list || []).forEach(c => { if (c && c.id) o[c.id] = c; }); return o; };
function mergeAll(base, local, remote){
  const d = (local.at || 0) - (remote.at || 0);
  const log = [], newer = Math.abs(d) > 60000 && d < 0 ? 'remote' : 'local';
  const s = merge3(base ? base.s : undefined, local.s, remote.s, newer, 'S', log);
  const c = merge3(base ? byId(base.c) : undefined, byId(local.c), byId(remote.c), newer, 'avlar', log);
  return {s, c: Object.values(c || {}).sort((a, b) => (b.t || '').localeCompare(a.t || '')), log};
}
// hesaptaki belge son gördüğümüzden farklı mı (cihaz saatleri birbirinden kayabilir: büyük/küçük değil, eşit mi diye bakılır)
const stampNew = st => !!st && st.at !== Number(lsGet(LSC.sync) || 0);
const loadBase = () => { try { return JSON.parse(lsGet(LSC.base) || 'null'); } catch (e) { return null; } };
function saveBase(st, catches){ if (!lsSet(LSC.base, JSON.stringify({s: syncPart(st), c: catches || []}))) lsSet(LSC.base, ''); }
// başka cihazın verisi ya da birleştirme uygulanmadan önce bu cihazın hâli saklanır (3 gün geri alınabilir)
function savePrev(){ if (!S || !hasProfileData()) return; const st = JSON.parse(JSON.stringify(S)); st.wx = null; lsSet(LSC.prev, JSON.stringify({at: Date.now(), dev: DEV.name, s: st, c: CATCHES})); }
const prevInfo = () => { try { const p = JSON.parse(lsGet(LSC.prev) || 'null'); return p && Date.now() - p.at < 3 * 86400000 ? p : null; } catch (e) { return null; } };
const CLOUD = {fb: null, user: null, state: 'off', err: null, timer: null, busy: false, dirty: false, ask: null, lastAt: null};
const AUTH_ERR = {'auth/invalid-credential': 'E-posta ya da şifre hatalı', 'auth/wrong-password': 'E-posta ya da şifre hatalı', 'auth/invalid-login-credentials': 'E-posta ya da şifre hatalı',
  'auth/user-not-found': 'Bu e-postayla hesap yok; “Kayıt ol”u seç', 'auth/email-already-in-use': 'Bu e-postayla zaten hesap var; “Giriş yap”ı seç',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı', 'auth/invalid-email': 'E-posta adresi geçersiz', 'auth/missing-password': 'Şifreyi yaz',
  'auth/network-request-failed': 'İnternet bağlantısı yok', 'auth/too-many-requests': 'Çok deneme yapıldı; biraz sonra tekrar dene',
  'auth/popup-closed-by-user': 'Google penceresi kapatıldı', 'auth/cancelled-popup-request': 'Google penceresi kapatıldı',
  'auth/unauthorized-domain': 'Bu adres Firebase’de izinli değil (Authentication → Settings → Authorized domains)',
  'auth/operation-not-allowed': 'Bu giriş yöntemi Firebase’de açılmamış (Authentication → Sign-in method)'};
const authErr = e => AUTH_ERR[e && e.code] || (e && e.message) || String(e);
async function fbLoad(){
  if (CLOUD.fb) return CLOUD.fb;
  const m = await import('./vendor/firebase/fb.js');
  const app = m.initializeApp(FB_CONFIG);
  CLOUD.fb = {m, auth: m.getAuth(app), db: m.getFirestore(app)};
  return CLOUD.fb;
}
function cloudInit(){
  if (!cloudOn()) return;
  setInterval(stampCheck, QA_FAST ? 1500 : 30000);
  window.addEventListener('online', () => { if (CLOUD.user && !CLOUD.ask) { if (CLOUD.dirty) pushNow(); else cloudSync(false); } });
  fbLoad().then(F => {
    F.m.getRedirectResult(F.auth).catch(e => { CLOUD.err = authErr(e); renderCloud(); });
    F.m.onAuthStateChanged(F.auth, u => { onUser(u).catch(e => { CLOUD.err = e.message || String(e); CLOUD.state = 'err'; renderCloud(); }); });
  }).catch(() => { CLOUD.err = 'Giriş servisi yüklenemedi (internet?)'; CLOUD.state = 'err'; renderCloud(); });
}
const userRef = uid => CLOUD.fb.m.doc(CLOUD.fb.db, 'users', uid);
async function pullRemote(uid){
  const snap = await CLOUD.fb.m.getDoc(userRef(uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {state: JSON.parse(d.s || 'null'), catches: JSON.parse(d.c || '[]'), at: Number(d.at) || 0, dev: d.dev || null, dn: d.dn || ''};
}
function cloudPayload(){
  const st = JSON.parse(JSON.stringify(S)); st.wx = null;
  return {s: JSON.stringify(st), c: JSON.stringify(CATCHES), at: Date.now(), v: APP_VERSION, dev: DEV.id, dn: DEV.name};
}
async function pushNow(){
  if (!CLOUD.user || CLOUD.ask) return false;
  if (CLOUD.busy) { CLOUD.dirty = true; return false; }
  CLOUD.busy = true; clearTimeout(CLOUD.timer); CLOUD.dirty = false; CLOUD.state = 'sync'; renderCloud();
  let ok = false;
  try {
    if (!CLOUD.syncing && lsGet(LSC.owner) === CLOUD.user.uid) {
      const st = await remoteStamp().catch(() => null);
      if (stampNew(st)) { CLOUD.busy = false; CLOUD.dirty = false; await cloudSync(false); return true; }
    }
    const p = cloudPayload();
    if (p.s.length + p.c.length > 950000) throw new Error('Veri bulut belgesinin sınırına yaklaştı; eski avları azalt');
    await CLOUD.fb.m.setDoc(userRef(CLOUD.user.uid), p);
    lsSet(LSC.sync, String(p.at)); lsSet(LSC.owner, CLOUD.user.uid); saveBase(S, CATCHES); CLOUD.lastAt = p.at; CLOUD.err = null; CLOUD.state = 'ok'; ok = true;
  } catch (e) { CLOUD.err = authErr(e); CLOUD.state = 'err'; CLOUD.dirty = true; }
  finally { CLOUD.busy = false; renderCloud(); }
  if (ok && CLOUD.dirty) cloudSchedule();   // gönderilirken yeni değişiklik oldu
  return ok;
}
// belgenin yalnız "at" ve "dev" alanları (Firestore REST, alan maskesi): küçük, tek okuma. Belge yoksa {at: 0}
async function remoteStamp(){
  const cu = CLOUD.fb && CLOUD.fb.auth.currentUser; if (!cu || !CLOUD.user) return null;
  const t = await cu.getIdToken();
  const u = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(FB_CONFIG.projectId) + '/databases/(default)/documents/users/' + encodeURIComponent(CLOUD.user.uid) + '?mask.fieldPaths=at&mask.fieldPaths=dev';
  const res = await fetchT(u, {headers: {Authorization: 'Bearer ' + t}}, 10000);
  if (res.status === 404) return {at: 0, dev: null};
  if (!res.ok) return null;
  const j = await res.json(), f = j.fields || {};
  return {at: Number(f.at && (f.at.integerValue || f.at.doubleValue)) || 0, dev: (f.dev && f.dev.stringValue) || null};
}
// uygulama açıkken yenilik var mı (30 sn'de bir)
async function stampCheck(){
  if (!CLOUD.user || !CLOUD.fb || document.hidden || CLOUD.busy || CLOUD.syncing || CLOUD.ask) return;
  try { const st = await remoteStamp(); if (stampNew(st)) cloudSync(false); } catch (e) {}
}
function cloudSchedule(){ clearTimeout(CLOUD.timer); CLOUD.timer = setTimeout(pushNow, 3000); }
// her kayıtta (persist → markDirty) ve av değişince çağrılır
function cloudDirty(){
  if (!S) return;
  S.modAt = Date.now();
  if (!CLOUD.user || CLOUD.ask) return;
  CLOUD.dirty = true; cloudSchedule();
}
async function replaceCatches(list){
  const ids = new Set(list.map(c => c.id));
  for (const c of CATCHES) if (!ids.has(c.id)) await IDB.del('catches', c.id);
  for (const c of list) await IDB.put('catches', c);
  await loadCatches();
}
// buluttaki veriyi telefona uygula (fotoğraflar ve özel paketin anahtarı cihazda kalır)
async function applyRemote(r, merged){
  const old = S, keepPkg = old && old.pkg && old.pkg.unlocked;
  if (!merged) savePrev();
  const st = Object.assign(newState(), r.state || {});
  if (old) { ['wx', 'backup', 'seenVersion'].forEach(k => { if (old[k] !== undefined) st[k] = old[k]; }); if (keepPkg) st.pkg = old.pkg;
    st.settings = Object.assign({}, st.settings || {}); DEV_SET.forEach(k => { if (old.settings && old.settings[k] !== undefined) st.settings[k] = old.settings[k]; }); }
  S = normalizeState(st);
  S.onboarded = true; S.modAt = r.at; persistQuiet();
  await replaceCatches(r.catches || []);
  pkgLoadCached();
  if (D && S.pkg.unlocked) importPackage(D); else if (S.pkg.unlocked && !D) { S.pkg.need = true; persistQuiet(); }
  lsSet(LSC.sync, String(r.at)); lsSet(LSC.owner, CLOUD.user.uid); CLOUD.lastAt = r.at;
  if (r.dn && r.dev !== DEV.id) lsSet(LSC.from, r.dn + '|' + r.at);
  saveBase(S, CATCHES);
  indexAll(); applyTheme(); WX = S.wx ? buildWx() : null; renderAll(); loadWeather();
}
async function onUser(u){
  CLOUD.resolved = true;
  if (!u) { CLOUD.user = null; CLOUD.state = 'off'; CLOUD.ask = null; renderCloud(); if (typeof renderNewVersion === 'function' && S) renderNewVersion(); return; }
  CLOUD.user = {uid: u.uid, email: u.email || '', name: u.displayName || ''};
  CLOUD.state = 'sync'; CLOUD.err = null; renderCloud();
  if ($('welcome') && !$('welcome').hidden) hideWelcome(true);
  await cloudSync(true);
}
// açılışta, uygulamaya dönüşte ve "Şimdi eşitle"de: hangi taraf yeni?
async function cloudSync(first){
  if (!CLOUD.user || CLOUD.syncing) return;
  CLOUD.syncing = true;
  try { await cloudSyncRun(first); } finally { CLOUD.syncing = false; }
}
async function cloudSyncRun(first){
  const uid = CLOUD.user.uid; const owner = lsGet(LSC.owner); const last = Number(lsGet(LSC.sync) || 0);
  let r;
  try { r = await pullRemote(uid); } catch (e) { CLOUD.err = authErr(e); CLOUD.state = 'err'; renderCloud(); return; }
  if (!CLOUD.user || CLOUD.user.uid !== uid) return;
  const base = loadBase();
  // bu cihazda eşitlenmemiş değişiklik var mı: son eşitlenen veriyle (taban) karşılaştırılır; saat kullanılmaz (cihaz saatleri kayabilir)
  const localNew = base ? (!sameJ(syncPart(S), base.s) || !sameJ(byId(CATCHES), byId(base.c))) : (S.modAt || 0) > last;
  if (owner === uid) {
    const remoteNew = !!r && r.at !== last;
    if (remoteNew && localNew) {   // ikisi de değişti: birleştir (taban yoksa ilk eşitleme: hiçbir şey silinmeden birleşim)
      savePrev();
      const m = mergeAll(base, {s: syncPart(S), c: CATCHES, at: S.modAt}, {s: syncPart(r.state), c: r.catches, at: (r.state && r.state.modAt) || r.at});
      await applyRemote({state: Object.assign({}, r.state, m.s), catches: m.c, at: r.at, dev: r.dev, dn: r.dn}, true);
      S.modAt = Date.now(); persistQuiet();
      await pushNow();
      toast((r.dn ? r.dn + ' ile ' : 'Diğer cihazla ') + 'birleştirildi' + (m.log.length ? ' · ' + m.log.length + ' alanda son değişiklik alındı' : ''));
    }
    else if (remoteNew) { await applyRemote(r); if (!first || r.dev !== DEV.id) toast(r.dn && r.dev !== DEV.id ? 'Son değişiklikler geldi · ' + r.dn : 'Hesabındaki son değişiklikler geldi'); }
    else if (localNew || !r) await pushNow();
    else { CLOUD.state = 'ok'; CLOUD.lastAt = last; if (!base && r) saveBase(S, CATCHES); }
  } else if (!owner) {
    // bu telefondaki veri henüz bir hesaba bağlı değil (ilk giriş): yerel veri buluta taşınır
    if (!r) { await pushNow(); if (first) toast('Telefondaki verin hesabına yüklendi'); }
    else if (hasProfileData()) { CLOUD.ask = {kind: 'conflict', r}; openMore('hesap'); }
    else await applyRemote(r);
  } else {
    // başka hesaptan geçiş (ör. deneme hesabı)
    if (r) { await applyRemote(r); toast(CLOUD.user.email + ' hesabının verisi yüklendi'); }
    else { CLOUD.ask = {kind: 'new', r: null}; openMore('hesap'); }
  }
  renderCloud();
}
async function cloudChoose(c){
  const a = CLOUD.ask; if (!a) return;
  CLOUD.ask = null;
  if (c === 'merge' && a.r) {   // ikisini birleştir: hiçbir şey silinmez, aynı şey iki yerde farklıysa yeni olan
    savePrev();
    const m = mergeAll(null, {s: syncPart(S), c: CATCHES, at: S.modAt}, {s: syncPart(a.r.state), c: a.r.catches, at: (a.r.state && a.r.state.modAt) || a.r.at});
    await applyRemote({state: Object.assign({}, a.r.state, m.s), catches: m.c, at: a.r.at, dev: a.r.dev, dn: a.r.dn}, true);
    S.modAt = Date.now(); persistQuiet(); await pushNow(); toast('Bu cihazdaki ve hesaptaki veri birleştirildi');
  }
  else if (c === 'remote' && a.r) { await applyRemote(a.r); toast('Hesaptaki veri yüklendi'); }
  else if (c === 'empty') {
    const keep = {settings: S.settings, mode: S.mode};
    S = normalizeState(Object.assign(newState(), keep)); S.onboarded = true; persistQuiet();
    await replaceCatches([]); pkgLoadCached(); indexAll(); renderAll();
    await pushNow(); toast('Hesap boş başladı');
  } else { await pushNow(); toast(c === 'copy' ? 'Telefondaki verinin kopyası bu hesaba yüklendi' : 'Telefondaki veri hesabına yazıldı'); }
  openMore('hesap', true);
}
async function restorePrev(){
  const p = prevInfo(); if (!p) return false;
  const cur = JSON.parse(JSON.stringify(S)); cur.wx = null;
  const st = Object.assign(newState(), p.s); ['wx', 'backup', 'seenVersion', 'pkg'].forEach(k => { st[k] = S[k]; });
  S = normalizeState(st); S.modAt = Date.now(); persistQuiet();
  await replaceCatches(p.c || []);
  lsSet(LSC.prev, JSON.stringify({at: Date.now(), dev: DEV.name, s: cur, c: CATCHES}));   // geri dönüş de geri alınabilir
  indexAll(); applyTheme(); WX = S.wx ? buildWx() : null; renderAll();
  if (CLOUD.user) { CLOUD.dirty = true; await pushNow(); }
  return true;
}
async function cloudLogout(){
  if (CLOUD.user && CLOUD.dirty) await pushNow();
  const F = await fbLoad(); await F.m.signOut(F.auth);
  toast('Çıkış yapıldı; veri bu telefonda duruyor');
}
async function loginGoogle(){
  const F = await fbLoad(); const p = new F.m.GoogleAuthProvider(); p.setCustomParameters({prompt: 'select_account'});
  try { await F.m.signInWithPopup(F.auth, p); }
  catch (e) { if (/popup-blocked|operation-not-supported|web-storage-unsupported/.test(e.code || '')) await F.m.signInWithRedirect(F.auth, p); else throw e; }
}
async function loginEmail(create){
  const email = ($('ac-mail').value || '').trim(), pass = $('ac-pass').value || '';
  const F = await fbLoad();
  return create ? F.m.createUserWithEmailAndPassword(F.auth, email, pass) : F.m.signInWithEmailAndPassword(F.auth, email, pass);
}
async function accAct(a, b){
  const err = m => { const e = $('acErr'); if (e) { e.textContent = m; e.hidden = !m; } };
  try {
    if (a === 'google') { err(''); await loginGoogle(); }
    else if (a === 'login' || a === 'signup') { err(''); b.disabled = true; await loginEmail(a === 'signup'); }
    else if (a === 'reset') { const mail = ($('ac-mail').value || '').trim(); if (!mail) { err('Önce e-postanı yaz'); return; } const F = await fbLoad(); await F.m.sendPasswordResetEmail(F.auth, mail); toast('Şifre yenileme e-postası gönderildi'); }
    else if (a === 'sync') { await cloudSync(false); if (!CLOUD.ask) { if (CLOUD.dirty) await pushNow(); toast(CLOUD.err ? CLOUD.err : 'Eşitlendi'); } }
    else if (a === 'prev') { if (!armOnce(b, 'Bu cihazın önceki hâline dönmek için tekrar dokun')) return; if (await restorePrev()) { toast('Önceki hâline dönüldü'); openMore('hesap', true); } }
    else if (a === 'logout') { if (!armOnce(b, 'Çıkmak için tekrar dokun')) return; await cloudLogout(); }
    else if (['local', 'remote', 'copy', 'empty', 'merge'].includes(a)) { if (a === 'empty' && !armOnce(b, 'Boş başlamak için tekrar dokun')) return; await cloudChoose(a); }
  } catch (e) { err(authErr(e)); if (b) b.disabled = false; }
}
function cloudSub(){
  if (!cloudOn()) return '';
  if (!CLOUD.user) return 'Giriş yapılmadı · veri yalnızca bu cihazda';
  return CLOUD.user.email + ' · ' + (CLOUD.state === 'err' ? '⚠ ' + (CLOUD.err || 'eşitlenemedi') : CLOUD.state === 'sync' ? 'eşitleniyor…' : CLOUD.lastAt ? 'eşitlendi ' + hm(new Date(CLOUD.lastAt)) : 'bağlı');
}
function renderCloud(){ if (typeof renderMore === 'function' && S) renderMore(); if (ui.sheet === 'hesap') openMore('hesap', true); }
function sheetAccount(){
  const u = CLOUD.user; const a = CLOUD.ask;
  const fmt = t => t ? new Date(t).toLocaleString('tr-TR', {day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'}) : '—';
  let body;
  if (a && a.kind === 'conflict') {
    body = '<section class="set"><h4>Hangi veri kalsın?</h4><p class="note">Hem bu telefonda hem hesabında farklı veri var.</p>' +
      '<p class="note"><b>Bu telefon:</b> ' + Object.keys(S.systems).length + ' sistem, ' + Object.keys(S.locations).length + ' konum, ' + CATCHES.length + ' av · son değişiklik ' + fmt(S.modAt) + '</p>' +
      '<p class="note"><b>Hesap:</b> ' + Object.keys((a.r.state || {}).systems || {}).length + ' sistem, ' + Object.keys((a.r.state || {}).locations || {}).length + ' konum, ' + (a.r.catches || []).length + ' av · ' + fmt(a.r.at) + '</p>' +
      '<div class="row"><button class="btn primary" type="button" data-acc="merge">İkisini birleştir</button></div>' +
      '<p class="note">Birleştirince hiçbir şey silinmez: iki taraftaki rig sistemleri, konumlar, envanter ve avlar bir arada olur; aynı şey iki yerde farklıysa son değiştirilen kalır.</p>' +
      '<div class="row"><button class="btn small" type="button" data-acc="local">Yalnız bu cihazdakini tut</button><button class="btn small" type="button" data-acc="remote">Yalnız hesaptakini yükle</button></div>' +
      '<p class="note">“Yalnız …” seçeneklerinde seçmediğin taraf silinir.</p></section>';
  } else if (a && a.kind === 'new') {
    body = '<section class="set"><h4>Yeni hesap: nasıl başlasın?</h4><p class="note">' + esc(u.email) + ' hesabı boş. Bu telefonda başka bir hesabın verisi var.</p>' +
      '<div class="row"><button class="btn primary" type="button" data-acc="copy">Bu verinin kopyasıyla başla</button><button class="btn" type="button" data-acc="empty">Boş başla</button></div>' +
      '<p class="note">Kopya ayrı bir hesaptır: denemede silip değiştirdiklerin diğer hesabına dokunmaz. Deneme hesabı için kopyayla başla.</p></section>';
  } else if (u) {
    body = '<section class="set"><h4>' + esc(u.email || u.name) + '</h4><p class="note">' + esc(cloudSub()) + '</p>' +
      '<div class="syncinfo"><span><b>Bu cihaz</b> ' + esc(DEV.name) + '</span>' + (() => { const f = (lsGet(LSC.from) || '').split('|'); return f[0] ? '<span><b>Son gelen</b> ' + esc(f[0]) + ' · ' + esc(new Date(Number(f[1])).toLocaleString('tr-TR', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})) + '</span>' : ''; })() + '</div>' +
      '<div class="row"><button class="btn primary" type="button" data-acc="sync">Şimdi eşitle</button><button class="btn" type="button" data-acc="logout">Çıkış yap</button></div>' +
      '<p class="err" id="acErr" hidden></p></section>' +
      '<section class="set"><h4>Cihazlar arası eşitleme</h4><p class="note">Tablet ve telefonda aynı hesapla giriş yap. Bir cihazdaki değişiklik birkaç saniyede hesabına yazılır; diğer cihaz açıksa en geç 30 saniyede, kapalıysa açılınca gelir.</p>' +
      '<p class="note">İki cihazda aynı anda değişiklik olursa birleştirilir: tabletteki yeni rig sistemi ve telefondaki envanter değişikliği ikisi de kalır. Aynı şey iki yerde değiştiyse son değiştiren kazanır.</p>' +
      (prevInfo() ? '<p class="note">Son birleştirmeden önceki hâl ' + esc(new Date(prevInfo().at).toLocaleString('tr-TR', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})) + ' tarihinde saklandı.</p><div class="row"><button class="btn small" type="button" data-acc="prev">Önceki hâline dön</button></div>' : '') + '</section>' +
      '<p class="note">Rigler, envanter, konumlar, ayarlar ve av kayıtları hesabına yazılır. Fotoğraflar çekildiği cihazda kalır (Bulut yedek açıksa GitHub’a da gider). Özel paketin şifresi buluta gitmez; yeni cihazda bir kez girersin. Yazı boyutu, haritanın son görünümü ve bilgi alanının açık/kapalı hâli her cihazda ayrı.</p>' +
      '<p class="note">Deneme için: çıkış yap, başka bir e-postayla (ör. ad+deneme@gmail.com) kayıt ol, “kopyasıyla başla”yı seç. Asıl hesabına dönünce kendi verin geri gelir.</p>';
  } else {
    body = '<p class="sub">Hesapla girersen verin telefona bağlı kalmaz: telefon değişse de, iki cihazda da aynı rigler, envanter ve avlar. Giriş isteğe bağlı; girmezsen uygulama yalnızca bu telefonda çalışır.</p>' +
      '<button class="btn primary bigbtn" type="button" data-acc="google">Google ile giriş</button>' +
      '<form id="accForm" class="panel stack" novalidate><div class="fields"><label class="f wide">E-posta<input id="ac-mail" type="email" autocomplete="email" autocapitalize="none" spellcheck="false"></label>' +
      '<label class="f wide">Şifre (en az 6 karakter)<input id="ac-pass" type="password" autocomplete="current-password"></label></div><p class="err" id="acErr"' + (CLOUD.err ? '' : ' hidden') + '>' + esc(CLOUD.err || '') + '</p>' +
      '<div class="row"><button class="btn primary" type="submit" data-acc="login">Giriş yap</button><button class="btn" type="button" data-acc="signup">Kayıt ol</button><button class="linkbtn" type="button" data-acc="reset">Şifremi unuttum</button></div></form>' +
      '<p class="note">İlk girişte bu telefondaki verin hesabına yüklenir; hiçbir şey silinmez.</p>';
  }
  return sheetBar('Hesap') + '<div class="stack">' + body + '</div>';
}
