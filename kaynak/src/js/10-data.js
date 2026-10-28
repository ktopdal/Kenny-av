// ---------------------------------------------------------------- 10 · şifreleme ve özel paket
// Uygulama herkes için boş ve şifresiz açılır. Kişisel rig sistemi "özel paket" olarak paket/ozel.enc.json içinde
// AES-GCM ile şifreli durur; anahtar şifreden PBKDF2 ile türetilir ve yalnızca bu telefonda saklanır.
let D = null;   // çözülmüş özel paket (yoksa null)
const LS = {state: 'alyssa-v1', pkgData: 'alyssa-pd', pkgKey: 'alyssa-pk', bkKey: 'alyssa-bk', ghTok: 'alyssa-gh',
  /*@ozel*/oldState: 'kenny-av-v1', oldData: 'kenny-av-data', oldKey: 'kenny-av-k'/*@end*//*@genel*/oldState: '', oldData: '', oldKey: ''/*@end*/};
const PKG_URL = /*@ozel*/'paket/ozel.enc.json'/*@end*//*@genel*/''/*@end*/;
const EMBED = (() => { try { const t = $('appdata').textContent.trim(); return t && t[0] === '{' ? JSON.parse(t) : null; } catch (e) { return null; } })();
// genel ve özel yayın aynı alan adında (github.io) olabilir: genel yayının anahtarları ayrı ön ekle tutulur, profiller karışmaz
const lsK = k => EDITION === 'genel' ? String(k).replace(/^alyssa-/, 'awf-') : k;
const lsGet = k => { if (!k) return null; try { return localStorage.getItem(lsK(k)); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(lsK(k), v); return true; } catch (e) { return false; } };
const lsDel = k => { if (!k) return; try { localStorage.removeItem(lsK(k)); } catch (e) {} };
function b64d(s){ const b = atob(s || ''); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function b64e(u){ let s = ''; const C = 0x8000; for (let i = 0; i < u.length; i += C) s += String.fromCharCode.apply(null, u.subarray(i, i + C)); return btoa(s); }
const b64eUtf8 = str => b64e(new TextEncoder().encode(str));
const normPass = p => String(p || '').trim().toLowerCase().replace(/ı/g, 'i').replace(/[\s_.,]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
async function deriveRaw(pass, salt, iter){
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normPass(pass)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256'}, base, 256));
}
async function aesEnc(raw, bytes){
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, bytes));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
}
async function aesDec(raw, data){
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({name: 'AES-GCM', iv: data.subarray(0, 12)}, key, data.subarray(12)));
}
async function decryptPkg(pkg, raw){
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: b64d(pkg.iv)}, key, b64d(pkg.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function fetchPkg(){
  if (EDITION !== 'ozel') return null;
  try { const r = await fetchT(PKG_URL + '?t=' + Date.now(), {cache: 'no-store'}, 15000); if (r.ok) return await r.json(); } catch (e) {}
  return null;
}
function pkgLoadCached(){
  if (EDITION !== 'ozel') { D = null; return; }
  if (EMBED) { D = EMBED; return; }
  try { D = JSON.parse(lsGet(LS.pkgData) || 'null'); } catch (e) { D = null; }
  if (D && !D.rigs) D = null;
}
// şifreyle aç: {ok} ya da {ok:false, err}
async function pkgUnlock(pass){
  const pkg = await fetchPkg();
  if (!pkg) return {ok: false, err: 'Paket indirilemedi. İnternet bağlantını kontrol edip yeniden dene.'};
  try {
    const raw = await deriveRaw(pass, b64d(pkg.salt), pkg.iter);
    const d = await decryptPkg(pkg, raw);
    lsSet(LS.pkgKey, b64e(raw)); lsSet(LS.pkgData, JSON.stringify(d)); D = d;
    return {ok: true};
  } catch (e) { return {ok: false, err: 'Şifre tutmadı. Büyük-küçük harf fark etmez.'}; }
}
// açık paketin yeni sürümü var mı? 'none' | 'offline' | 'same' | 'updated' | 'locked' (yeni şifre gerekiyor)
async function pkgRefresh(){
  if (EMBED || !S.pkg.unlocked) return 'none';
  const pkg = await fetchPkg(); if (!pkg) return 'offline';
  if (D && D.meta && D.meta.data_version === pkg.data_version) return 'same';
  const k = lsGet(LS.pkgKey);
  if (k) { try { const d = await decryptPkg(pkg, b64d(k)); lsSet(LS.pkgData, JSON.stringify(d)); D = d; return 'updated'; } catch (e) {} }
  return 'locked';
}
