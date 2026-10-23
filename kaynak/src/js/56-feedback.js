// ---------------------------------------------------------------- 56 · "Bağladım → tuttu / tutmadı" (v0.19)
// Fishing'de önerilen rig bağlanınca tek dokunuşla işaretlenir; sonra "Tuttu" ya da "Tutmadı". Cevaplanmamış soru Fishing'in üstünde
// sorulur. Kayıtlar profilde (S.fb, kimlikle) tutulur ve cihazlar arasında eşitlenir. Öğrenme: "tuttu" bir av gibi sayılır (aynı rigle
// 6 saat içinde av kaydı varsa av sayılır, iki kez sayılmaz); "tutmadı" benzer koşulda (gece/gündüz, akıntı, ay, mevsim, aynı nokta)
// o rigi geri plana iter. Az bildirimle de çalışır; etkisi sınırlıdır ve nedeni öneride yazılır.
const FB_MAX = 300, FB_OPEN_H = 12;
const fbAll = () => Object.values(S.fb || {}).filter(f => f && f.id && f.t);
const fbAge = f => Date.now() - new Date(f.t).getTime();
function fbAdd(rg, dd, part, x){
  const L = loc(); S.fb = S.fb || {};
  const f = {id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: new Date().toISOString(), rig: rg.id, code: rg.code || '', name: rg.name || '', sys: rg.sys || '',
    loc: L ? {id: L.id, name: L.name, lat: L.lat, lon: L.lon} : null, night: part === 'gece', cur: x && x.cur != null ? Math.round(x.cur * 100) / 100 : null,
    illum: dd && dd.sol ? Math.round(dd.sol.illum * 100) : null, sst: x && x.sst != null ? Math.round(x.sst * 10) / 10 : null, res: null, rt: null};
  S.fb[f.id] = f;
  const all = fbAll().sort((a, b) => (a.t < b.t ? -1 : 1)); while (all.length > FB_MAX) delete S.fb[all.shift().id];
  persist(); return f;
}
function fbSet(id, res){ const f = S.fb && S.fb[id]; if (!f) return null; f.res = res; f.rt = new Date().toISOString(); persist(); return f; }
function fbUndo(id){ const f = S.fb && S.fb[id]; if (!f) return; if (f.res) { f.res = null; f.rt = null; } else delete S.fb[id]; persist(); }
// bu rigin son 12 saatteki bildirimi
const fbOpen = rg => fbAll().filter(f => f.rig === rg.id && fbAge(f) < FB_OPEN_H * 3600000).sort((a, b) => (a.t < b.t ? 1 : -1))[0] || null;
// cevap bekleyen (45 dakikadan eski, 3 günden yeni) en son bildirim
const fbPending = () => fbAll().filter(f => !f.res && fbAge(f) > 45 * 60000 && fbAge(f) < 3 * 86400000).sort((a, b) => (a.t < b.t ? 1 : -1))[0] || null;
const fbRigName = f => { const r = RIGS[f.rig]; return r ? (r.code ? r.code + ' · ' : '') + r.name : (f.code ? f.code + ' · ' : '') + (f.name || 'rig'); };
const fbWhen = f => { const d = new Date(f.t), now = new Date(); return (dateKey(d) === dateKey(now) ? '' : d.getDate() + ' ' + MON3[d.getMonth()] + ' ') + hm(d); };
// rig kartının altındaki satır
function fbRow(rg){
  const f = fbOpen(rg), b = (act, txt, cls, f2) => '<button class="btn small' + (cls ? ' ' + cls : '') + '" type="button" data-fb="' + act + '"' + (f2 ? ' data-fid="' + esc(f2.id) + '"' : ' data-rig="' + esc(rg.id) + '"') + '>' + txt + '</button>';
  if (!f) return '<div class="fbrow">' + b('bagla', 'Bağladım', 'primary') + '<span class="note">Bağlayınca dokun; sonra tuttu mu diye sorarım.</span></div>';
  if (!f.res) return '<div class="fbrow on"><span class="fbst">Bağlı · ' + fbWhen(f) + '</span>' + b('tuttu', 'Tuttu', 'primary', f) + b('tutmadi', 'Tutmadı', '', f) + b('geri', 'Vazgeç', 'ghost', f) + '</div>';
  return '<div class="fbrow ' + esc(f.res) + '"><span class="fbst">' + (f.res === 'tuttu' ? '✓ Tuttu' : f.res === 'tutmadi' ? 'Tutmadı' : 'Cevapsız') + ' · ' + fbWhen(f) + '</span>' +
    (f.res === 'tuttu' ? b('av', 'Avı kaydet', '', f) : '') + b('geri', 'Geri al', 'ghost', f) + '</div>';
}
// Fishing'in üstünde: cevap bekleyen soru
function fbAskHtml(){
  const f = fbPending(); if (!f) return '';
  return '<div class="fbask"><b>Bağladığın rig tuttu mu?</b><span class="note">' + esc([fbRigName(f), f.loc ? f.loc.name : '', fbWhen(f)].filter(Boolean).join(' · ')) + '</span>' +
    '<div class="row"><button class="btn small primary" type="button" data-fb="tuttu" data-fid="' + esc(f.id) + '">Tuttu</button><button class="btn small" type="button" data-fb="tutmadi" data-fid="' + esc(f.id) + '">Tutmadı</button>' +
    '<button class="btn small ghost" type="button" data-fb="sorma" data-fid="' + esc(f.id) + '">Hatırlamıyorum</button></div></div>';
}
// öğrenme: bu rigin bildirimleri benzer koşullara göre tartılır
function learnFb(rg, ctx){
  const list = fbAll().filter(f => (f.res === 'tuttu' || f.res === 'tutmadi') && (f.rig === rg.id || (rg.sys === 'ozel' && rg.code && f.code === rg.code && f.sys === 'ozel')));
  if (!list.length) return null;
  const cb0 = curB(ctx.cur), mb0 = moonB(ctx.illum);
  let pos = 0, neg = 0, posN = 0, negN = 0, negSim = 0;
  list.forEach(f => {
    const t = new Date(f.t);
    if (f.res === 'tuttu' && CATCHES.some(c => c.t && rigMatch(c, rg) && Math.abs(new Date(c.t) - t) < 6 * 3600000)) return;   // av kaydı zaten sayılıyor
    let s = 1;
    if (!!f.night !== !!ctx.night) s *= 0.4;
    const cb = curB(f.cur), mb = moonB(f.illum);
    if (cb != null && cb0 != null && cb !== cb0) s *= 0.6;
    if (mb != null && mb0 != null && mb !== mb0) s *= 0.8;
    if (monthDist(t.getMonth() + 1, ctx.month) > 1) s *= 0.6;
    if (ctx.L && f.loc && f.loc.lat != null && distKm(ctx.L, f.loc) <= 1.5) s *= 1.3;
    if (f.res === 'tuttu') { pos += s; posN++; } else { neg += s; negN++; if (s >= 0.75) negSim++; }
  });
  if (!posN && !negN) return null;
  const bonus = Math.min(1.5, 0.8 * Math.log2(1 + pos)) - Math.min(3, 1.3 * Math.log2(1 + neg));
  const why = [];
  if (posN) why.push('bağladığında ' + posN + ' kez tuttu');
  if (negN) why.push(negSim ? 'benzer koşulda ' + negSim + ' kez tutmadı' : negN + ' kez tutmadı');
  return {bonus: Math.round(bonus * 10) / 10, why, posN, negN};
}
// Avlar ekranı için kısa özet
function fbSummary(){
  const l = fbAll().filter(f => f.res === 'tuttu' || f.res === 'tutmadi');
  if (!l.length) return null;
  const by = {}; l.forEach(f => { const k = f.code || f.rig; by[k] = by[k] || {k, n: f.code || fbRigName(f), ok: 0, no: 0}; by[k][f.res === 'tuttu' ? 'ok' : 'no']++; });
  return {ok: l.filter(f => f.res === 'tuttu').length, no: l.filter(f => f.res === 'tutmadi').length, rigs: Object.values(by).sort((a, b) => (b.ok - b.no) - (a.ok - a.no)).slice(0, 3)};
}
const fbRedraw = () => { renderFishing(); renderCatches(); };
// dokunuşlar (90-boot.js: data-fb)
function fbAct(a, d){
  if (a === 'bagla') {
    const rg = RIGS[d.rig]; if (!rg) return;
    const ds = days(); const dd = ds.find(x => x.key === ui.fday) || ds[0] || null;
    const x = hourRec(new Date()) || (dd ? refHour(dd) : null);
    fbAdd(rg, dd, ui.fpart || 'gun', x); fbRedraw(); toast('Bağladın · dönüşte tuttu mu diye sorarım'); return;
  }
  const f = S.fb && S.fb[d.fid]; if (!f) return;
  if (a === 'tuttu') { fbSet(f.id, 'tuttu'); fbRedraw(); toast('Tuttu · bu rig benzer koşulda öne çıkar'); return; }
  if (a === 'tutmadi') { fbSet(f.id, 'tutmadi'); fbRedraw(); toast('Not edildi · benzer koşulda bu rig geri planda kalır'); return; }
  if (a === 'sorma') { fbSet(f.id, 'bilinmiyor'); fbRedraw(); return; }
  if (a === 'geri') { fbUndo(f.id); fbRedraw(); return; }
  if (a === 'av') { catchForm(null, {rig: f.rig}); return; }
}
