// ---------------------------------------------------------------- 82 · paylaşım: envanter ve rig sistemi bağlantısı, geri bildirim
// Bağlantı verinin kendisini taşır (adresin # sonrası sunucuya gitmez): #al=<z|j><base64url>; z = deflate-raw sıkıştırılmış JSON.
// Açan kişi veriyi KENDİ profiline kopyalar; gönderenin envanteri, konumları, avları ve özel paketi paylaşılmaz, bağlantı tek yönlüdür.
const SHARE_URL = () => location.origin + location.pathname;
const b64url = bytes => b64e(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDec = s => b64d(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
async function packShare(obj){
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') {
    try { const out = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(); return 'z' + b64url(new Uint8Array(out)); } catch (e) {}
  }
  return 'j' + b64url(bytes);
}
async function unpackShare(s){
  const kind = s[0], bytes = b64urlDec(s.slice(1));
  const json = kind === 'z' ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text() : new TextDecoder().decode(bytes);
  return JSON.parse(json);
}
const ITEM_KEYS = ['cat', 'brand', 'model', 'name', 'spec', 'pattern', 'sizes', 'unit'];
// hazır listedeki kalemler yalnızca işaretlendiyse gider (alıcıda zaten var; std kimliğiyle eşleşir)
const shareable = it => !it.std || sizesOf(it).some(sz => stockOf(it.id, sz) !== 'yok');
function invPayload(){
  const items = Object.values(ITEMS).filter(shareable).map(it => {
    const o = {}; ITEM_KEYS.forEach(k => { if (it[k] != null && it[k] !== '' && !(Array.isArray(it[k]) && !it[k].length)) o[k] = it[k]; });
    if (it.use || it.note) o.note = it.use || it.note;
    if (it.std) o.std = it.id;
    if (it.rod) o.rod = it.rod; if (it.reel) o.reel = it.reel;
    const u = unitOf(it); if (u !== 'durum') o.unit = u;
    o.st = {}; o.q = {};
    sizesOf(it).forEach(sz => { o.st[sz] = stockOf(it.id, sz); const q = qtyOf(it.id + '|' + sz); if (q != null && u !== 'durum') o.q[sz] = q; });
    return o;
  });
  return {t: 'envanter', v: 1, from: (S.profile.name || '').trim() || 'Bir arkadaşın', at: new Date().toISOString().slice(0, 10), items};
}
function sysPayload(ids){
  const list = ids.map(id => S.systems[id]).filter(sy => sy && sy.source === 'sihirbaz' && sy.answers).map(sy => ({name: sy.name, answers: sy.answers}));
  return {t: 'sistem', v: 1, from: (S.profile.name || '').trim() || 'Bir arkadaşın', systems: list};
}
let SHARE_IN = null;
function sheetShare(){
  const wiz = Object.values(S.systems).filter(sy => sy.source === 'sihirbaz');
  const nItems = Object.values(ITEMS).filter(shareable).length;
  return sheetBar('Paylaş') + '<div class="stack">' +
    '<section class="set"><h4>Envanterimi paylaş</h4><p class="note">' + nItems + ' kalem, stok durumları ve adetleriyle tek bir bağlantıya girer. Açan kişi bunu kendi envanterine kopyalar; sonra iki envanter ayrı kalır, senin envanterine dokunamaz. Konumların, avların ve fotoğrafların gitmez.</p>' +
    (nItems ? '<button class="btn primary" type="button" data-share="envanter">Bağlantı oluştur</button>' : '<p class="note">Envanterin boş.</p>') + '</section>' +
    '<section class="set"><h4>Rig sistemimi paylaş</h4>' + (wiz.length ? '<p class="note">Rig Atölyesi’nde kurduğun sistemlerin cevapları gider; açan kişide aynı sistem kendi envanterine göre kurulur.</p>' +
      wiz.map(sy => '<label class="chk"><input type="checkbox" data-sharesys="' + esc(sy.id) + '" checked> ' + esc(sy.name) + ' (' + (sy.rigs || []).length + ' rig)</label>').join('') +
      '<button class="btn primary" type="button" data-share="sistem">Bağlantı oluştur</button>' : '<p class="note">Rig Atölyesi’nde kurulmuş sistemin yok.</p>') +
    '<p class="note">Özel paketindeki rigler bu yolla paylaşılmaz; paketin şifresini bilen kendi telefonunda açabilir.</p></section>' +
    '<div id="shareOut"></div>' +
    '<section class="set"><h4>Geri bildirim</h4><p class="note">Bir hata ya da öneri için WhatsApp mesajı hazırlar; sürüm ve telefon bilgisi eklenir, kime gideceğini sen seçersin.</p><button class="btn" type="button" data-share="geri">Geri bildirim yaz</button></section>' +
    '</div>';
}
async function makeShare(kind){
  const out = $('shareOut'); if (!out) return;
  let payload;
  if (kind === 'envanter') payload = invPayload();
  else { const ids = [...document.querySelectorAll('input[data-sharesys]')].filter(i => i.checked).map(i => i.dataset.sharesys); if (!ids.length) { toast('Bir sistem seç'); return; } payload = sysPayload(ids); }
  const url = SHARE_URL() + '#al=' + await packShare(payload);
  const label = kind === 'envanter' ? 'envanterini' : 'rig sistemini';
  const text = (S.profile.name ? S.profile.name + ' ' : '') + 'Alyssa’da ' + label + ' paylaştı. Açmak için dokun: ' + url;
  out.innerHTML = '<section class="set"><h4>Bağlantı hazır</h4><p class="note mono" style="word-break:break-all;max-height:80px;overflow:hidden">' + esc(url.slice(0, 160)) + '…</p>' +
    '<div class="row"><a class="btn primary" href="https://wa.me/?text=' + encodeURIComponent(text) + '" target="_blank" rel="noopener">WhatsApp ile gönder</a>' +
    '<button class="btn" type="button" data-share="kopyala">Kopyala</button>' + (navigator.share ? '<button class="btn" type="button" data-share="paylas">Paylaş…</button>' : '') + '</div>' +
    '<p class="note">' + Math.round(url.length / 1024 * 10) / 10 + ' KB · bağlantıdaki veri yalnızca bunu açan telefona kopyalanır.</p></section>';
  makeShare.last = {url, text};
}
async function shareAct(a){
  if (a === 'envanter' || a === 'sistem') { await makeShare(a); return; }
  if (a === 'kopyala' && makeShare.last) { try { await navigator.clipboard.writeText(makeShare.last.url); toast('Bağlantı kopyalandı'); } catch (e) { toast('Kopyalanamadı'); } return; }
  if (a === 'paylas' && makeShare.last) { try { await navigator.share({title: APP_NAME, text: makeShare.last.text}); } catch (e) {} return; }
  if (a === 'geri') {
    const t = APP_NAME + ' v' + APP_VERSION + ' geri bildirim\n' + (navigator.userAgent.match(/\(([^)]+)\)/) || ['', ''])[1] + '\n\n';
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener'); return;
  }
  if (a === 'al') { importShare(); return; }
  if (a === 'vazgec') { SHARE_IN = null; closeSheet(); clearShareHash(); return; }
}
function clearShareHash(){ try { history.replaceState(history.state, '', location.pathname + location.search + '#bugun'); } catch (e) {} }
// gelen bağlantı: ne geldiğini göster, onayla kopyala
async function openShareLink(raw){
  let data = null;
  try { data = await unpackShare(raw); } catch (e) { toast('Paylaşım bağlantısı açılamadı'); clearShareHash(); return; }
  if (!data || (data.t !== 'envanter' && data.t !== 'sistem')) { toast('Tanınmayan bağlantı'); clearShareHash(); return; }
  SHARE_IN = data; ui.sheet = 'paylasim';
  let body = '';
  if (data.t === 'envanter') {
    const by = {}; (data.items || []).forEach(i => { by[i.cat] = (by[i.cat] || 0) + 1; });
    body = '<p class="sub"><b>' + esc(data.from) + '</b> envanterini paylaştı: ' + (data.items || []).length + ' kalem' + (data.at ? ' (' + esc(data.at) + ')' : '') + '.</p>' +
      '<p class="note">' + Object.entries(by).map(([c, n]) => esc(CAT_TXT[c] || c) + ' ' + n).join(' · ') + '</p>' +
      '<p class="note">Kalemler stok durumları ve adetleriyle senin envanterine kopyalanır. Senin var olan kalemlerin silinmez; aynı adlı kalem varsa üzerine yazılmaz, atlanır. Sonra iki envanter ayrıdır.</p>';
  } else {
    body = '<p class="sub"><b>' + esc(data.from) + '</b> rig sistemi paylaştı:</p><ul>' + (data.systems || []).map(sy => '<li>' + esc(sy.name) + '</li>').join('') + '</ul>' +
      '<p class="note">Sistemler senin envanterine göre kurulur; eksik kalemler alışveriş listene düşer.</p>';
  }
  openSheet(sheetBar('Paylaşılan ' + (data.t === 'envanter' ? 'envanter' : 'rig sistemi'), null, 'Kapat') + '<div class="stack">' + body +
    '<div class="row"><button class="btn primary" type="button" data-share="al">' + (data.t === 'envanter' ? 'Envanterime kopyala' : 'Sistemlerime ekle') + '</button><button class="btn" type="button" data-share="vazgec">Vazgeç</button></div></div>');
}
function importShare(){
  const data = SHARE_IN; if (!data) return;
  let n = 0;
  if (data.t === 'envanter') {
    const have = new Set(Object.values(ITEMS).map(i => trLower(i.name || ((i.brand || '') + ' ' + (i.model || '')))));
    (data.items || []).forEach(i => {
      // hazır liste kalemi (ya da aynı adlı kalem): alıcının kendi hazır listesindeki kaleme işaret konur (onda bir işaret yoksa)
      const nm0 = trLower(i.name || [i.brand, i.model].filter(Boolean).join(' '));
      const tgt = (i.std && ITEMS[i.std]) || Object.values(ITEMS).find(x => x.std && x.cat === i.cat && trLower(x.name) === nm0);
      if (tgt) { const it = tgt; let t = 0;
        sizesOf(it).forEach(sz => { const k = it.id + '|' + sz; const st = (i.st || {})[sz]; if (!st || st === 'yok' || S.inv.status[k] != null || qtyOf(k) != null) return; S.inv.status[k] = st === 'az' ? 'var' : st; if (i.q && i.q[sz] != null) S.inv.qty[k] = i.q[sz]; t++; });
        if (i.unit && !S.inv.unit[it.id]) S.inv.unit[it.id] = i.unit; if (t) n++; return; }
      const name = i.name || [i.brand, i.model].filter(Boolean).join(' '); if (!name || have.has(trLower(name))) return;
      const id = 'u-' + (slugTR(name).slice(0, 40) || 'kalem') + '-' + Math.random().toString(36).slice(2, 6);
      const sizes = Array.isArray(i.sizes) && i.sizes.length ? i.sizes : [];
      const stock = {}; (sizes.length ? sizes : ['-']).forEach(sz => { const st = (i.st || {})[sz]; stock[sz] = st === 'az' ? 'var' : (st || 'var'); });
      S.inv.items[id] = {id, cat: i.cat || 'other', brand: i.brand || '', model: i.model || '', name, pattern: i.pattern || '', spec: i.spec || '', note: i.note || '', sizes, stock, src: 'paylasim', from: data.from, created: new Date().toISOString()};
      if (i.rod) S.inv.items[id].rod = i.rod; if (i.reel) S.inv.items[id].reel = i.reel;
      if (i.unit && UNITS[i.cat] && UNITS[i.cat].includes(i.unit)) S.inv.unit[id] = i.unit;
      if (i.cat === 'bait') Object.entries(i.st || {}).forEach(([sz, st]) => { if (st === 'var') S.inv.status[id + '|' + sz] = 'var'; });
      Object.entries(i.q || {}).forEach(([sz, q]) => { S.inv.qty[id + '|' + sz] = q; });
      have.add(trLower(name)); n++;
    });
  } else {
    (data.systems || []).forEach(sy => {
      if (!sy.answers || !Array.isArray(sy.answers.techs)) return;
      const a = Object.assign(wzDefaults(), sy.answers); const rigs = genSystem(a); if (!rigs.length) return;
      const id = uid('s'); rigs.forEach(r => { r.id = id + ':' + r.code; });
      S.systems[id] = {id, name: sy.name + ' (' + data.from + ')', source: 'sihirbaz', active: true, created: new Date().toISOString(), updated: new Date().toISOString(), answers: a, rigs, from: data.from}; n++;
    });
  }
  S.onboarded = true; persist(); indexAll(); SHARE_IN = null; closeSheet(); clearShareHash();
  if ($('welcome') && !$('welcome').hidden) hideWelcome();
  show(data.t === 'envanter' ? 'envanter' : 'rigler'); renderAll();
  toast(n ? (data.t === 'envanter' ? n + ' kalem envanterine eklendi' : n + ' sistem eklendi') : 'Yeni kalem yok; hepsi zaten envanterinde');
}
