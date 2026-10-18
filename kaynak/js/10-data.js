// ---------------------------------------------------------------- 10 · uygulama verisi (gömülü ya da şifreli)
// Önizlemede veri sayfaya gömülüdür. Yayında rig ve envanter verisi data.enc.json içinde AES-GCM ile şifreli durur;
// anahtar bir kez girilen şifreden PBKDF2 ile türetilir ve yalnızca bu telefonda saklanır.
let D = null;
const DATA_KEY = 'kenny-av-data', KEY_KEY = 'kenny-av-k';
const EMBED = (() => { try { const t = $('appdata').textContent.trim(); return t && t[0] === '{' ? JSON.parse(t) : null; } catch (e) { return null; } })();
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
function b64d(s){ const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function b64e(u){ let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
const normPass = p => String(p || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/[\s_.,]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
async function deriveKey(pass, pkg){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normPass(pass)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name: 'PBKDF2', salt: b64d(pkg.salt), iterations: pkg.iter, hash: 'SHA-256'}, base, 256);
  return new Uint8Array(bits);
}
async function decryptPkg(pkg, raw){
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: b64d(pkg.iv)}, key, b64d(pkg.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function fetchPkg(){
  try { const r = await fetch('data.enc.json?v=' + APP_VERSION + '&t=' + Date.now(), {cache: 'no-store'}); if (r.ok) return await r.json(); } catch (e) {}
  return null;
}
// sonuç: 'ok' | {locked: pkg} | 'nodata'
async function loadData(){
  if (EMBED) { D = EMBED; return 'ok'; }
  let cached = null; try { cached = JSON.parse(lsGet(DATA_KEY) || 'null'); } catch (e) {}
  const pkg = await fetchPkg();
  // bağlantıdaki #anahtar=... (Android ve tarayıcı için tek dokunuşla açma)
  const m = (location.hash || '').match(/anahtar=([^&]+)/);
  if (m && pkg) {
    try { const raw = await deriveKey(decodeURIComponent(m[1]), pkg); const d = await decryptPkg(pkg, raw); lsSet(KEY_KEY, b64e(raw)); lsSet(DATA_KEY, JSON.stringify(d)); cached = d; } catch (e) {}
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }
  const k = lsGet(KEY_KEY);
  if (pkg && k && (!cached || !cached.meta || cached.meta.data_version !== pkg.data_version)) {
    try { const d = await decryptPkg(pkg, b64d(k)); cached = d; lsSet(DATA_KEY, JSON.stringify(d)); }
    catch (e) { if (!cached) return {locked: pkg}; }
  }
  if (cached) { D = cached; return 'ok'; }
  return pkg ? {locked: pkg} : 'nodata';
}
function showLock(pkg, onOpen){
  $('lock').hidden = false;
  $('lockForm').onsubmit = async e => {
    e.preventDefault();
    const btn = $('lockBtn'); btn.disabled = true; $('lockErr').hidden = true; $('lockNote').textContent = 'Açılıyor…';
    try {
      const raw = await deriveKey($('lockPass').value, pkg);
      const d = await decryptPkg(pkg, raw);
      lsSet(KEY_KEY, b64e(raw)); lsSet(DATA_KEY, JSON.stringify(d)); D = d;
      $('lock').hidden = true; onOpen();
    } catch (err) {
      $('lockErr').textContent = 'Şifre tutmadı. Kelimeleri aradaki tirelerle birlikte yaz; büyük-küçük harf önemli değil.'; $('lockErr').hidden = false;
      $('lockNote').textContent = '';
    }
    btn.disabled = false;
  };
  setTimeout(() => { try { $('lockPass').focus(); } catch (e) {} }, 50);
}
// açıkken arka planda yeni veri sürümü var mı? (Claude veriyi güncellediğinde)
async function refreshData(){
  if (EMBED) return false;
  const pkg = await fetchPkg(); const k = lsGet(KEY_KEY);
  if (!pkg || !k || (D && D.meta && D.meta.data_version === pkg.data_version)) return false;
  try { const d = await decryptPkg(pkg, b64d(k)); D = d; lsSet(DATA_KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
}
