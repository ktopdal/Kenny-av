// ---------------------------------------------------------------- 15 · hesap ve bulut eşitleme (Firebase: Google ya da e-postayla giriş)
// Giriş isteğe bağlıdır; girilmezse uygulama eskisi gibi yalnızca telefonda çalışır. Girişte profil (rigler, envanter, konumlar, ayarlar)
// ve av kayıtları kullanıcının kendi Firestore belgesine (users/<uid>) yazılır; veritabanı kuralı gereği başkası okuyamaz.
// Fotoğraflar telefonda kalır. Özel paketin şifresi ve anahtarı buluta gitmez; yeni cihazda paket şifresi bir kez girilir.
// Hesap değişince (ör. deneme hesabı) telefondaki veri o hesabın verisiyle yer değiştirir; yeni hesap ilk girişte telefondaki verinin
// kopyasıyla ya da boş başlar. Eşitleme: son yazan kazanır; iki taraf da değiştiyse kullanıcıya sorulur.
const FB_CONFIG = /*__FBCONFIG__*/null;
const cloudOn = () => !!FB_CONFIG && !PREVIEW;
const LSC = {owner: 'alyssa-cu', sync: 'alyssa-cs'};
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
  return {state: JSON.parse(d.s || 'null'), catches: JSON.parse(d.c || '[]'), at: Number(d.at) || 0};
}
function cloudPayload(){
  const st = JSON.parse(JSON.stringify(S)); st.wx = null;
  return {s: JSON.stringify(st), c: JSON.stringify(CATCHES), at: Date.now(), v: APP_VERSION};
}
async function pushNow(){
  if (!CLOUD.user || CLOUD.ask) return false;
  if (CLOUD.busy) { CLOUD.dirty = true; return false; }
  CLOUD.busy = true; clearTimeout(CLOUD.timer); CLOUD.dirty = false; CLOUD.state = 'sync'; renderCloud();
  let ok = false;
  try {
    const p = cloudPayload();
    if (p.s.length + p.c.length > 950000) throw new Error('Veri bulut belgesinin sınırına yaklaştı; eski avları azalt');
    await CLOUD.fb.m.setDoc(userRef(CLOUD.user.uid), p);
    lsSet(LSC.sync, String(p.at)); lsSet(LSC.owner, CLOUD.user.uid); CLOUD.lastAt = p.at; CLOUD.err = null; CLOUD.state = 'ok'; ok = true;
  } catch (e) { CLOUD.err = authErr(e); CLOUD.state = 'err'; CLOUD.dirty = true; }
  finally { CLOUD.busy = false; renderCloud(); }
  if (ok && CLOUD.dirty) cloudSchedule();   // gönderilirken yeni değişiklik oldu
  return ok;
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
async function applyRemote(r){
  const wx = S.wx;
  S = normalizeState(Object.assign(newState(), r.state || {}));
  if (!S.wx) S.wx = wx;
  S.onboarded = true; S.modAt = r.at; persistQuiet();
  await replaceCatches(r.catches || []);
  pkgLoadCached();
  if (D && S.pkg.unlocked) importPackage(D); else if (S.pkg.unlocked && !D) { S.pkg.need = true; persistQuiet(); }
  lsSet(LSC.sync, String(r.at)); lsSet(LSC.owner, CLOUD.user.uid); CLOUD.lastAt = r.at;
  indexAll(); applyTheme(); WX = S.wx ? buildWx() : null; renderAll(); loadWeather();
}
async function onUser(u){
  if (!u) { CLOUD.user = null; CLOUD.state = 'off'; CLOUD.ask = null; renderCloud(); return; }
  CLOUD.user = {uid: u.uid, email: u.email || '', name: u.displayName || ''};
  CLOUD.state = 'sync'; CLOUD.err = null; renderCloud();
  if ($('welcome') && !$('welcome').hidden) hideWelcome(true);
  await cloudSync(true);
}
// açılışta, uygulamaya dönüşte ve "Şimdi eşitle"de: hangi taraf yeni?
async function cloudSync(first){
  if (!CLOUD.user) return;
  const uid = CLOUD.user.uid; const owner = lsGet(LSC.owner); const last = Number(lsGet(LSC.sync) || 0);
  let r;
  try { r = await pullRemote(uid); } catch (e) { CLOUD.err = authErr(e); CLOUD.state = 'err'; renderCloud(); return; }
  const localNew = (S.modAt || 0) > last;
  if (owner === uid) {
    const remoteNew = !!r && r.at > last;
    if (remoteNew && localNew) { CLOUD.ask = {kind: 'conflict', r}; openMore('hesap'); }
    else if (remoteNew) { await applyRemote(r); toast('Hesabındaki son veri yüklendi'); }
    else if (localNew || !r) await pushNow();
    else { CLOUD.state = 'ok'; CLOUD.lastAt = last; }
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
  if (c === 'remote' && a.r) { await applyRemote(a.r); toast('Hesaptaki veri yüklendi'); }
  else if (c === 'empty') {
    const keep = {settings: S.settings, mode: S.mode};
    S = normalizeState(Object.assign(newState(), keep)); S.onboarded = true; persistQuiet();
    await replaceCatches([]); pkgLoadCached(); indexAll(); renderAll();
    await pushNow(); toast('Hesap boş başladı');
  } else { await pushNow(); toast(c === 'copy' ? 'Telefondaki verinin kopyası bu hesaba yüklendi' : 'Telefondaki veri hesabına yazıldı'); }
  openMore('hesap', true);
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
    else if (a === 'logout') { if (!armOnce(b, 'Çıkmak için tekrar dokun')) return; await cloudLogout(); }
    else if (['local', 'remote', 'copy', 'empty'].includes(a)) { if (a === 'empty' && !armOnce(b, 'Boş başlamak için tekrar dokun')) return; await cloudChoose(a); }
  } catch (e) { err(authErr(e)); if (b) b.disabled = false; }
}
function cloudSub(){
  if (!cloudOn()) return '';
  if (!CLOUD.user) return 'Giriş yapılmadı · veri yalnızca bu telefonda';
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
      '<div class="row"><button class="btn primary" type="button" data-acc="local">Bu telefondakini tut</button><button class="btn" type="button" data-acc="remote">Hesaptakini yükle</button></div>' +
      '<p class="note">Seçmediğin taraf silinir. Emin değilsen önce Daha → Dosya yedeği ile yedek indir.</p></section>';
  } else if (a && a.kind === 'new') {
    body = '<section class="set"><h4>Yeni hesap: nasıl başlasın?</h4><p class="note">' + esc(u.email) + ' hesabı boş. Bu telefonda başka bir hesabın verisi var.</p>' +
      '<div class="row"><button class="btn primary" type="button" data-acc="copy">Bu verinin kopyasıyla başla</button><button class="btn" type="button" data-acc="empty">Boş başla</button></div>' +
      '<p class="note">Kopya ayrı bir hesaptır: denemede silip değiştirdiklerin diğer hesabına dokunmaz. Deneme hesabı için kopyayla başla.</p></section>';
  } else if (u) {
    body = '<section class="set"><h4>' + esc(u.email || u.name) + '</h4><p class="note">' + esc(cloudSub()) + '</p>' +
      '<div class="row"><button class="btn primary" type="button" data-acc="sync">Şimdi eşitle</button><button class="btn" type="button" data-acc="logout">Çıkış yap</button></div>' +
      '<p class="err" id="acErr" hidden></p></section>' +
      '<p class="note">Rigler, envanter, konumlar, ayarlar ve av kayıtları hesabına yazılır; başka telefonda aynı hesapla girince gelir. Fotoğraflar bu telefonda kalır (Bulut yedek açıksa GitHub’a da gider). Özel paketin şifresi buluta gitmez; yeni telefonda bir kez girersin.</p>' +
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
