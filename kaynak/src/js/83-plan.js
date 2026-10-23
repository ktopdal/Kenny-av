// ---------------------------------------------------------------- 83 · takvim uyarısı (.ics), çıkış listesi, güvenlik mesajı, yedek hatırlatma
// Uyarı kuralı: rüzgâr ≤ X Bft, dalga ≤ Y m, balık ≥ Z; uyan pencereler alarmıyla telefon takvimine eklenir.
// Anlık bildirim için sunucu gerekir; takvim alarmı bunun yerine telefonun kendi takviminden çalar.
const ALERT_DEF = {bft: 3, wave: 0.5, fish: 4, part: 'ikisi', lead: 120, days: 7};
const alertCfg = () => Object.assign({}, ALERT_DEF, S.settings.alert || {});
function alertMatches(){
  const cfg = alertCfg(), now = new Date(), out = [];
  if (landMode()) return out;   // kara noktasında av penceresi yok
  days().slice(0, cfg.days).forEach(dd => {
    const parts = cfg.part === 'ikisi' ? ['gun', 'gece'] : [cfg.part];
    const seen = [];
    parts.forEach(part => bestWindows(dd, part, 2, dd.key === dateKey(now) ? now : null).forEach(w => {
      if (seen.some(s => s.a < w.b && w.a < s.b)) return;
      if (w.fish < cfg.fish) return;
      const hs = WX.hours.filter(x => x.t >= new Date(w.a.getTime() - 1800000) && x.t <= new Date(w.b.getTime() + 1800000));
      const wmax = Math.max(...hs.map(x => x.wind == null ? 0 : x.wind)), gmax = Math.max(...hs.map(x => x.wave == null ? 0 : x.wave));
      if (bft(wmax) > cfg.bft || gmax > cfg.wave) return;
      seen.push(w); out.push({dd, w, part, bft: bft(wmax), wave: gmax});
    }));
  });
  return out.sort((p, q) => p.w.a - q.w.a);
}
const icsDate = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
function icsFold(line){ const out = []; let s = line; while (new TextEncoder().encode(s).length > 74) { let n = 74; while (new TextEncoder().encode(s.slice(0, n)).length > 74) n--; out.push(s.slice(0, n)); s = ' ' + s.slice(n); } out.push(s); return out.join('\r\n'); }
function matchText(m){
  const Lc = loc();
  return {title: 'Av penceresi · balık %' + m.w.pct + ' · ' + (Lc ? Lc.name : APP_SHORT),
    desc: winTxt(m.w) + ' · ' + m.w.evs.map(evChip).join(', ') + '\nRüzgâr en çok ' + m.bft + ' Bft, dalga en çok ' + f1(m.wave) + ' m' + (m.w.cls ? ', deniz ' + m.w.cls : '') + '\n' + APP_NAME + ' tahmini; çıkmadan önce güncel hava durumuna bak.'};
}
function buildIcs(list){
  const Lc = loc(), cfg = alertCfg(), now = new Date();
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Alyssa by Barbossa App//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Alyssa av pencereleri'];
  list.forEach(m => {
    const t = matchText(m);
    L.push('BEGIN:VEVENT', 'UID:' + icsDate(m.w.a) + '-' + (Lc ? Lc.id : 'x') + '@alyssa', 'DTSTAMP:' + icsDate(now), 'DTSTART:' + icsDate(m.w.a), 'DTEND:' + icsDate(m.w.b),
      'SUMMARY:' + icsEsc(t.title), 'DESCRIPTION:' + icsEsc(t.desc), Lc ? 'LOCATION:' + icsEsc(Lc.name) : null, Lc ? 'GEO:' + Lc.lat.toFixed(5) + ';' + Lc.lon.toFixed(5) : null,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(t.title), 'TRIGGER:-PT' + cfg.lead + 'M', 'END:VALARM', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.filter(Boolean).map(icsFold).join('\r\n') + '\r\n';
}
const gcalUrl = m => { const t = matchText(m); return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(t.title) + '&dates=' + icsDate(m.w.a) + '/' + icsDate(m.w.b) + '&details=' + encodeURIComponent(t.desc) + (loc() ? '&location=' + encodeURIComponent(loc().name) : ''); };
async function deliverFile(name, type, text){
  const file = new File([text], name, {type});
  try { if (navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], title: name}); return 'share'; } } catch (e) { if (e && e.name === 'AbortError') return 'abort'; }
  const u = URL.createObjectURL(file); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return 'download';
}
function sheetAlert(){
  const cfg = alertCfg(); const ok = !!(WX && days().length);
  const list = ok ? alertMatches() : [];
  const sel = (k, opts) => '<select data-alert="' + k + '">' + opts.map(([v, t]) => '<option value="' + v + '"' + (String(cfg[k]) === String(v) ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>';
  return sheetBar('Takvim uyarısı') + '<div class="stack">' +
    '<p class="sub">Kurala uyan av pencereleri alarmıyla telefonunun takvimine eklenir. Alarmı takvim çalar; uygulama kapalıyken de çalışır.</p>' +
    '<div class="fields">' +
    '<label class="f">Rüzgâr en çok' + sel('bft', [1, 2, 3, 4, 5, 6].map(v => [v, v + ' Bft'])) + '</label>' +
    '<label class="f">Dalga en çok' + sel('wave', [[0.3, '0,3 m'], [0.5, '0,5 m'], [0.8, '0,8 m'], [1, '1 m'], [1.5, '1,5 m']]) + '</label>' +
    '<label class="f">Balık en az' + sel('fish', [1, 2, 3, 4, 5].map(v => [v, v + ' balık (%' + ((v - 1) * 20 + 1) + '+)'])) + '</label>' +
    '<label class="f">Ne zaman' + sel('part', [['ikisi', 'Gündüz ve gece'], ['gun', 'Gündüz'], ['gece', 'Gece']]) + '</label>' +
    '<label class="f">Alarm' + sel('lead', [[30, '30 dk önce'], [60, '1 saat önce'], [120, '2 saat önce'], [720, '12 saat önce']]) + '</label>' +
    '<label class="f">Kaç gün' + sel('days', [[3, '3 gün'], [7, '7 gün'], [10, '10 gün'], [15, '15 gün']]) + '</label></div>' +
    (landMode() ? '<div class="empty">Seçili konum karada: av penceresi hesaplanmaz. Deniz ya da kıyı noktası seç.</div>' : !ok ? '<div class="empty">Hava verisi yok; önce bir konum seç.</div>' : list.length ?
      '<div class="eyebrow">' + list.length + ' pencere uyuyor · ' + esc(loc() ? loc().name : '') + '</div>' + list.map(m => '<div class="item"><div class="row" style="justify-content:space-between"><b>' + m.dd.date.getDate() + ' ' + MON3[m.dd.date.getMonth()] + ' ' + DOW[m.dd.date.getDay()] + ' · ' + winTxt(m.w) + '</b>' + fishHtml(m.w.fish) + '</div>' +
        '<div class="sp">balık %' + m.w.pct + ' · rüzgâr en çok ' + m.bft + ' Bft · dalga ' + f1(m.wave) + ' m · ' + esc(m.w.evs.map(e => e.k).join(' + ')) + ' · <a href="' + gcalUrl(m) + '" target="_blank" rel="noopener">Google Takvim</a></div></div>').join('') +
      (PREVIEW ? '<p class="note">Takvim dosyası telefona kurulan uygulamada iner; önizlemede yalnızca liste görünür.</p>' : '<button class="btn primary" type="button" data-act="icsAll">Hepsini takvime ekle</button><p class="note">iPhone’da açılan pencerede “Tümünü Ekle”ye dokun. Tahmin değişirse uyarıyı yeniden kur; eski etkinlikler aynı kimlikle güncellenir.</p>') :
      '<div class="empty">Önümüzdeki ' + cfg.days + ' günde bu kurala uyan pencere yok. Rüzgâr ya da dalga sınırını gevşet, balık sınırını düşür.</div>') + '</div>';
}
// ---- çıkış listesi ve güvenlik mesajı
const BOAT_KIT = ['Can yelekleri (herkese bir)', 'VHF telsiz ya da şarjlı telefon (su geçirmez kılıfta)', 'Yakıt: dolu depo ve yedek', 'Çapa ve halat', 'İlk yardım çantası', 'El feneri / kafa lambası', 'Su ve yiyecek', 'Güneş kremi, şapka, güneş gözlüğü', 'Pense, makas, iğne çıkarıcı', 'Kepçe ya da kanca', 'Buz kutusu ve buz', 'Paraşüt çapa (drift sock)'];
const SHORE_KIT = ['Kamış ayağı', 'Kafa lambası ve yedek pil', 'Kaymaz ayakkabı', 'Kepçe ya da uzun saplı kanca', 'Pense ve iğne çıkarıcı', 'Yedek şok lider ve köstek', 'Çapalı (grip) kurşun', 'Yem kutusu ve havlu', 'Buz kutusu', 'Şarjlı telefon', 'Su, mont ya da yağmurluk'];
// Fishing'de seçilen gün ve bölümün (gündüz/gece) 3 rigi; Fishing açılmadıysa bugünün gündüz ve gece ilk ikileri
function checklist(){
  const ds = days(); const dd = (ui.fday && ds.find(d => d.key === ui.fday)) || ds.find(d => d.key === dateKey(new Date())) || ds[0];
  const out = {rigs: [], gear: [], bait: [], kit: shoreMode() ? SHORE_KIT : BOAT_KIT, dd, part: ui.fpart || null};
  if (dd && RIG_LIST.length) {
    const parts = ui.fpart ? [ui.fpart === 'gece'] : [false, true];
    const recs = parts.flatMap(n => { const R = recommend(dd, n); return R.filter(x => x.ok).slice(0, ui.fpart ? F_TOP : 2).map(x => ({rg: x.rg, x: R.x})); });
    const seenRig = new Set(), gear = {}, bait = new Set();
    recs.forEach(({rg, x}) => {
      if (seenRig.has(rg.id)) return; seenRig.add(rg.id); out.rigs.push(rg);
      rg.slots.forEach(sl => { const e = sl.t.envanter || {}; const it = e.item && ITEMS[e.item]; const nm = (it ? it.name : e.name || sl.label) + (e.size ? ' ' + e.size : ''); gear[nm] = (gear[nm] || []).concat(rg.code || rg.name); });
      const ld = leadFor(rg, dd, x); if (ld && ld.kursun) { const k = 'Kurşun ' + ld.kursun + (ld.grip ? ' (çapalı)' : ''); gear[k] = (gear[k] || []).concat(rg.code || rg.name); }
      const bp = baitPick(rg); if (bp.use && bp.use.st) bait.add(bp.use.t + (bp.use.st === 'var' ? ' (elinde)' : bp.use.st === 'yok' ? ' (gitmeden al)' : ''));
    });
    out.gear = Object.entries(gear).map(([k, v]) => ({k, v: [...new Set(v)]}));
    out.bait = [...bait];
  }
  return out;
}
function sheetChecklist(){
  const c = checklist(); const today = dateKey(new Date());
  if (!S.check || S.check.date !== today) S.check = {date: today, done: {}};
  const box = (key, label, sub) => '<label class="chk ckl"><input type="checkbox" data-ck="' + esc(key) + '"' + (S.check.done[key] ? ' checked' : '') + '> <span>' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span></label>';
  const Lc = loc(); const sp = S.settings.safety || {};
  return sheetBar('Çıkış listesi') + '<div class="stack">' +
    '<p class="sub">' + (shoreMode() ? 'Kıyı' : 'Tekne') + ' · ' + (Lc ? esc(Lc.name) : 'konum yok') + ' · işaretler bugün için saklanır.</p>' +
    (c.rigs.length ? '<section class="set"><h4>' + (c.part && c.dd ? esc(dayLabel(c.dd.date, 0, dateKey(new Date())) + ' · ' + PART_TXT[c.part]) + ' rigleri' : 'Bugünün rigleri') + '</h4><p class="note">' + esc(c.rigs.map(r => (r.code ? r.code + ' ' : '') + r.name).join(' · ')) + '</p>' +
      c.gear.map(g => box('g:' + g.k, g.k, g.v.join(', '))).join('') + (c.bait.length ? c.bait.map(b => box('y:' + b, 'Yem: ' + b)).join('') : '') + '</section>' :
      '<section class="set"><h4>Rigler</h4><p class="note">Önerilen hazır rig yok; Fishing’de gün ve bölüm seçince önerilen riglerin malzemeleri burada listelenir.</p></section>') +
    '<section class="set"><h4>' + (shoreMode() ? 'Kıyı ekipmanı' : 'Tekne ve güvenlik') + '</h4>' + c.kit.map(k => box('k:' + k, k)).join('') + '</section>' +
    '<section class="set"><h4>Güvenlik mesajı</h4><p class="note">Çıkmadan önce bir yakınına nerede olduğunu ve dönüş saatini WhatsApp’tan gönder.</p>' +
    '<div class="fields"><label class="f">Dönüş saati<input type="time" id="sf-ret" value="' + esc(sp.ret || '') + '"></label>' +
    '<label class="f">Kime (telefon, isteğe bağlı)<input id="sf-tel" inputmode="tel" value="' + esc(sp.tel || '') + '" placeholder="905xxxxxxxxx"></label>' +
    '<label class="f wide">Not (tekne adı, kişi sayısı)<input id="sf-not" value="' + esc(sp.not || '') + '" placeholder="Ör. Alya 8, 2 kişi"></label></div>' +
    '<div class="row"><button class="btn primary" type="button" data-act="safety">WhatsApp ile gönder</button>' + (navigator.share ? '<button class="btn" type="button" data-act="safetyShare">Paylaş…</button>' : '') + '</div></section>' +
    '<button class="btn small" type="button" data-act="ckReset">İşaretleri temizle</button></div>';
}
function safetyText(){
  const sp = S.settings.safety || {}; const Lc = loc(); const x = nowHour();
  const parts = [shoreMode() ? 'Kıyıda avdayım.' : 'Denize çıktım.'];
  if (Lc) parts.push('Yer: ' + Lc.name + ' (' + ddm(Lc.lat, 'K', 'G') + ' ' + ddm(Lc.lon, 'D', 'B') + ') https://www.google.com/maps/search/?api=1&query=' + Lc.lat.toFixed(5) + ',' + Lc.lon.toFixed(5));
  if (sp.not) parts.push(sp.not + '.');
  if (sp.ret) parts.push('Dönüş: ' + sp.ret + '. Bu saatte haber vermezsem ara.');
  if (x && x.wind != null) parts.push('Hava: rüzgâr ' + bft(x.wind) + ' Bft ' + windName(x.wdir) + (x.wave != null ? ', dalga ' + f1(x.wave) + ' m' : '') + '.');
  return parts.join('\n');
}
function saveSafety(){ S.settings.safety = {ret: ($('sf-ret') || {}).value || '', tel: (($('sf-tel') || {}).value || '').replace(/[^\d]/g, ''), not: (($('sf-not') || {}).value || '').trim()}; persist(); }
// ---- yedek hatırlatma: veri var ama bulut yedek yok ya da 14 günden eski
function backupReminder(){
  if (PREVIEW) return '';
  const hasData = CATCHES.length > 0 || Object.values(S.systems).some(sy => sy.source === 'sihirbaz') || Object.keys(S.inv.items).length > 0;
  if (!hasData) return '';
  const last = S.backup && S.backup.lastAt ? new Date(S.backup.lastAt) : null;
  const age = last ? (Date.now() - last.getTime()) / 86400000 : null;
  if (bkReady() && age != null && age < 14) return '';
  const snooze = S.settings.bkSnooze ? new Date(S.settings.bkSnooze).getTime() : 0;
  if (Date.now() < snooze) return '';
  return '<div class="newver warn"><b>' + (bkReady() ? 'Son yedek ' + Math.floor(age) + ' gün önce' : 'Bulut yedeğin kapalı') + '</b><span class="note">Avların, fotoğrafların ve kendi kurduğun sistemler yalnızca bu telefonda. Telefon kaybolursa geri gelmez.</span>' +
    '<div class="row"><button class="btn small primary" type="button" data-open="yedek">' + (bkReady() ? 'Şimdi yedekle' : 'Bulut yedeği aç') + '</button><button class="btn small" type="button" data-act="bkSnooze">7 gün sonra hatırlat</button></div></div>';
}
