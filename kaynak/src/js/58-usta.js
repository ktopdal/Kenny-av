// ---------------------------------------------------------------- 58 · Usta'ya sor (v0.20): Claude ile bugünkü koşullar ve riglerin hakkında soru
// Kullanıcının kendi Claude API anahtarıyla doğrudan Anthropic'e sorulur (tarayıcıdan; sunucu yok). Anahtar yalnız bu cihazda
// (localStorage) durur: profile, buluta, yedeğe, paylaşıma ve Düzenim koduna girmez. Soruyla birlikte Fishing'deki gün ve bölümün
// özeti gider: konum adı ve türü, dip, derinlik, 3 saatlik hava/deniz, solunar pencereleri, mevsimindeki türler, önerilen rigler
// (malzeme, takım, bugünkü ayar), son bildirimler ve avlar. Koordinat gitmez.
const USTA_API = 'https://api.anthropic.com/v1/messages';
const USTA_MODELS = [['claude-sonnet-5-5', 'Sonnet 5.5', 'en iyi cevap · soru başına ≈ 1–2 cent', 2, 10], ['claude-haiku-5-5', 'Haiku 5.5', 'hızlı ve ucuz · soru başına ≈ 0,1 cent', 0.1, 0.5]];
const LSU = {key: 'alyssa-ak', model: 'alyssa-am'};
const USTA = {msgs: [], busy: false, err: null};
const ustaKey = () => (lsGet(LSU.key) || '').trim();
const ustaModel = () => { const m = lsGet(LSU.model); return USTA_MODELS.find(x => x[0] === m) || USTA_MODELS[0]; };
const USTA_Q = ['Bugün hangi rigi bağlayayım?', 'Kurşun ve köstek ne olsun?', 'Hangi saatte, nasıl avlanayım?', 'Yem olarak ne kullanayım?', 'Bu hava çıkmaya uygun mu?'];
const USTA_SYS = 'Sen Ege’de (İzmir–Seferihisar) tekneden ve kıyıdan olta balıkçılığında uzun yıllar deneyimli bir ustasın. Alyssa uygulamasını kullanan, kendi rig sistemi olan ' +
  'deneyimli bir amatör balıkçıya bugünkü koşullara göre kısa, net ve uygulanabilir cevap veriyorsun.\n' +
  'Kurallar:\n- Önce BAĞLAM’daki verilere dayan (hava, deniz, solunar, sürüklenme, rigler, envanter, bildirimler, avlar). Bağlamda olmayan bir şey söylüyorsan genel bilgi olduğunu belirt.\n' +
  '- Rig önerirken uygulamanın rig kodlarını ve adlarını kullan. Envanterde olmayan bir şey önerirsen “alınacak” de.\n' +
  '- Güvenlik önce gelir: deniz sınıfı C ya da D, kuvvetli hamle ya da yüksek dalga varsa açıkça uyar; D’de çıkmamasını söyle.\n' +
  '- Av yasağı ve boy sınırı için kesin bilgi verme; güncel tebliğe bakmasını söyle.\n' +
  '- Türkçe yaz; en fazla 180 kelime; gerekirse kısa maddeler. Giriş cümlesi kurma, doğrudan cevap ver.';
const stripTags = h => String(h || '').replace(/<[^>]+>/g, '');
// bağlam: Fishing'de seçili gün ve bölüm (yoksa bugün, gündüz)
function ustaContext(){
  const L = loc(); if (!L) return 'Konum seçilmemiş.';
  const k = locKind(L), out = [];
  out.push('Konum: ' + locLabel(L) + ' · tür: ' + KIND_TXT[k] + (k === 'kara' ? '' : ' · dip: ' + (L.bottom ? BOTTOM_TXT[L.bottom] : L.bottomEst ? 'tahmini ' + (L.bottomEstTxt || BOTTOM_TXT[L.bottomEst]) + ' (EUSeaMap)' : 'bilinmiyor') +
    ' · derinlik: ' + (L.depth ? L.depth + ' m' : 'bilinmiyor') + ' · av: ' + (modeNow() === 'kiyi' ? 'kıyıdan' : 'tekneden' + (S.settings.anchor === 'demir' ? ', demirli' : ', sürüklenerek'))));
  const ds = WX ? days() : []; if (!ds.length) { out.push('Hava ve deniz verisi yok.'); return out.join('\n'); }
  const dd = ds.find(d => d.key === ui.fday) || ds[0], part = ui.fpart || 'gun', night = part === 'gece', [A, B] = partRange(dd, part);
  out.push('Gün: ' + dd.date.getDate() + ' ' + MON_LONG[dd.date.getMonth()] + ' ' + dd.date.getFullYear() + ' · bölüm: ' + (night ? 'gece' : 'gündüz') + ' ' + hhmm(A) + '–' + hhmm(B) + (k === 'kara' ? '' : ' · deniz sınıfı ' + ((night ? dd.clsN : dd.clsD) || '?')));
  if (k === 'kara') out.push('Bu nokta karada: yalnız hava durumu var.');
  const depth = locDepth();
  fBlocks(dd, part).forEach(b => { const s = blockStats(b, depth), xs = b.xs;
    const g = xs.map(x => bft(x.gust)).filter(v => v != null), tp = xs.map(x => x.temp).filter(v => v != null), pr = xs.map(x => x.press).filter(v => v != null);
    out.push('  ' + hhmm(b.a) + '–' + hhmm(b.b) + ': rüzgâr ' + (s.wdir != null ? windName(s.wdir) + ' ' : '') + spanTxt(s.bLo, s.bHi, 'Bft') + (g.length ? ', hamle ' + Math.max(...g) + ' Bft' : '') +
      (k === 'kara' ? '' : (s.wave != null ? ', dalga ' + f1(s.wave) + ' m' : '') + (s.cur != null ? ', akıntı ' + f1(s.cur) + ' kn' + (s.curDir != null ? ' ' + dir8(s.curDir) + ' yönüne' : '') : '') + (s.cls ? ', deniz ' + s.cls : '') +
        (s.known ? ', ' + (s.anch ? 'ipe akış ' + f1(s.lineHi) : 'sürüklenme ' + f1(s.sog) + ' kn ' + (s.dir != null ? dir8(s.dir) + ' yönüne' : '')) + (s.extra ? ', kurşun +' + s.extra + ' g' : '') : '')) +
      (tp.length ? ', hava ' + (f0(Math.min(...tp)) === f0(Math.max(...tp)) ? f0(tp[0]) : f0(Math.min(...tp)) + '–' + f0(Math.max(...tp))) + ' °C' : '') + (pr.length ? ', basınç ' + Math.round(pr[0]) + ' hPa' : '') + (xs.some(x => (x.rain || 0) >= 0.2) ? ', yağış var' : ''));
  });
  if (k === 'kara') return out.join('\n');
  if (dd.sst != null) out.push('Su sıcaklığı: ' + f1(dd.sst) + ' °C');
  out.push('Ay: ' + dd.sol.name + ' (aydınlık %' + Math.round(dd.sol.illum * 100) + ') · gün doğumu ' + hm(dd.sol.sunrise) + ', batımı ' + hm(dd.sol.sunset));
  bestWindows(dd, part, 2).forEach(w => out.push('  Pencere ' + winTxt(w) + ': balık %' + w.pct + (w.cls ? ', deniz ' + w.cls : '') + (w.kinds.length ? ' (' + w.kinds.join(', ') + ')' : '')));
  const month = dd.date.getMonth() + 1, sn = seasonNow(month, dd.sst, 8);
  if (sn.length) out.push('Mevsiminde (Ege takvimi + su): ' + sn.map(x => spName(x.id) + ' ' + CAL_TXT[x.m]).join(', '));
  const R = recommend(dd, night, null), ok = R.filter(x => x.ok);
  if (S.settings.ftarget) out.push('Hedef boy: ' + S.settings.ftarget);
  out.push('Uygulamanın önerdiği rigler:');
  ok.slice(0, 3).forEach((x, i) => { const rg = x.rg, ld = leadFor(rg, dd, R.x);
    out.push((i + 1) + ') ' + (rg.code ? rg.code + ' · ' : '') + rg.name + ' — ' + (rg.groupName || '') + '; hedef: ' + (rg.target || '-') + '; neden: ' + x.why.join(', '));
    out.push('   malzeme: ' + rg.slots.map(sl => { const e = sl.t.envanter || {}; const it = e.item && ITEMS[e.item]; return sl.label + ': ' + (it ? it.name : e.name || '-') + (e.size ? ' ' + e.size : ''); }).join('; '));
    const bt = stripTags(baitHtml(rg, 'envanter')); if (bt) out.push('   yem: ' + bt);
    if (ld && lengthsTxt(ld)) out.push('   takım: ' + stripTags(lengthsTxt(ld)));
    const tn = tuneRig(rg, dd, R.x, R.win, night, month); if (tn.length) out.push('   bugünkü ayar: ' + tn.map(t => t.k + ': ' + t.t).join(' | '));
  });
  if (!ok.length) out.push('  (bu bölüm için hazır rig yok)');
  const more = ok.slice(3, 10).map(x => (x.rg.code ? x.rg.code + ' ' : '') + x.rg.name); if (more.length) out.push('Diğer hazır rigler: ' + more.join(', '));
  const bl = R.filter(x => !x.ok).slice(0, 3).map(x => (x.rg.code || x.rg.name) + ' (eksik: ' + missingOf(x.rg).map(sl => sl.label).join(', ') + ')'); if (bl.length) out.push('Eksik yüzünden bekleyen: ' + bl.join('; '));
  const fbs = fbAll().filter(f => f.res === 'tuttu' || f.res === 'tutmadi').sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 8)
    .map(f => (f.code || f.name) + ' ' + (f.res === 'tuttu' ? 'tuttu' : 'tutmadı') + ' (' + f.t.slice(0, 10) + (f.night ? ', gece' : ', gündüz') + (f.loc ? ', ' + f.loc.name : '') + ')');
  if (fbs.length) out.push('Son "bağladım" bildirimleri: ' + fbs.join('; '));
  const cs = CATCHES.slice(0, 8).map(c => catchLine(c).sp + (c.count > 1 ? ' ×' + c.count : '') + (c.kg ? ' ' + fmtNum(c.kg, 2) + ' kg' : '') + (c.rig ? ' · ' + rigShort(c.rig) : '') + (c.bait ? ' · ' + c.bait : '') + ' · ' + (c.t || '').slice(0, 10));
  if (cs.length) out.push('Son avlar: ' + cs.join('; '));
  return out.join('\n');
}
function ustaErr(st, j){
  const m = ((j && j.error && j.error.message) || '') + '';
  if (st === 401) return 'API anahtarı geçersiz. Claude Console’da API keys → Create key ile yeni anahtar oluşturup buraya yapıştır.';
  if (/credit|balance|billing/i.test(m)) return 'Hesapta kredi yok: Claude Console’da Billing → Buy credits ile kredi yükle.';
  if (/workspace/i.test(m)) return 'Anahtar bir workspace’e bağlı değil: Create key’de workspace olarak Default Workspace’i seçip yeni anahtar oluştur.';
  if (st === 403) return 'Bu anahtarın bu işe izni yok (' + m.slice(0, 80) + ').';
  if (st === 404) return 'Model bulunamadı: aşağıdan diğer modeli seç.';
  if (st === 413) return 'Soru çok uzun.';
  if (st === 429) return 'Çok sık soruldu ya da limit doldu; biraz bekleyip tekrar dene.';
  if (st >= 500) return 'Claude şu an yoğun; birazdan tekrar dene.';
  return 'Hata ' + st + (m ? ': ' + m.slice(0, 120) : '');
}
async function ustaCall(q){
  const key = ustaKey(); if (!key) throw new Error('Önce API anahtarını gir.');
  const md = ustaModel();
  const hist = USTA.msgs.slice(0, -1).filter(m => m.ok).slice(-8); while (hist.length && hist[0].role !== 'user') hist.shift();   // son mesaj şimdiki soru
  const body = {model: md[0], max_tokens: 1500, output_config: {effort: 'low'},
    system: [{type: 'text', text: USTA_SYS}, {type: 'text', text: 'BAĞLAM (Alyssa uygulamasından, ' + new Date().toLocaleString('tr-TR') + '):\n' + ustaContext()}],
    messages: hist.map(m => ({role: m.role, content: m.text})).concat([{role: 'user', content: q}])};
  const send = ver => fetchT(USTA_API, {method: 'POST', headers: {'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': ver, 'anthropic-dangerous-direct-browser-access': 'true'}, body: JSON.stringify(body)}, 90000);
  let r = await send('2023-06-01'), j = await r.json().catch(() => ({}));
  if (r.status === 400 && /anthropic-version/i.test(JSON.stringify(j))) { r = await send('2026-10-21'); j = await r.json().catch(() => ({})); }
  if (r.status === 400 && /output_config|effort/i.test(JSON.stringify(j))) { delete body.output_config; r = await send('2023-06-01'); j = await r.json().catch(() => ({})); }   // eski model ya da sürüm effort'u tanımazsa
  if (!r.ok) throw new Error(ustaErr(r.status, j));
  const text = (j.content || []).filter(c => c && c.type === 'text').map(c => c.text).join('\n').trim();
  if (!text) throw new Error('Boş cevap geldi; tekrar dene.');
  const u = j.usage || {}, cost = ((u.input_tokens || 0) * md[3] + (u.output_tokens || 0) * md[4]) / 1e6;
  return {text, model: md[1], cost, tok: (u.input_tokens || 0) + (u.output_tokens || 0)};
}
async function ustaAsk(q){
  q = String(q || '').trim(); if (!q || USTA.busy) return;
  USTA.err = null; USTA.busy = true; USTA.msgs.push({role: 'user', text: q, ok: true}); ustaRedraw();
  try { const a = await ustaCall(q); USTA.msgs.push({role: 'assistant', text: a.text, ok: true, meta: a.model + ' · ≈ $' + (a.cost < 0.001 ? a.cost.toFixed(4) : a.cost.toFixed(3)).replace('.', ',')}); }
  catch (e) { USTA.msgs[USTA.msgs.length - 1].ok = false; USTA.err = e && e.name === 'AbortError' ? 'Cevap gecikti (90 sn); bağlantıyı kontrol edip tekrar dene.' : (e && e.message) || String(e); }
  finally { USTA.busy = false; ustaRedraw(true); }
}
function ustaRedraw(end){ if (ui.sheet !== 'usta') return; openMore('usta', true); if (end) { const sh = $('sheet'); const last = sh && sh.querySelector('.umsg:last-of-type'); if (last) last.scrollIntoView({block: 'start'}); } }
// cevaptaki basit biçim: **kalın**, maddeler, paragraflar
function mdLite(t){
  const inl = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s*/, '');
  let out = '', ul = false;
  esc(t).split(/\n/).forEach(l => { const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (m) { if (!ul) { out += '<ul>'; ul = true; } out += '<li>' + inl(m[1]) + '</li>'; }
    else { if (ul) { out += '</ul>'; ul = false; } if (l.trim()) out += '<p>' + inl(l) + '</p>'; } });
  return out + (ul ? '</ul>' : '');
}
function ustaKeyBox(first){
  const md = ustaModel();
  return '<section class="set ukey"><h4>' + (first ? 'Usta’ya sormak için Claude API anahtarı' : 'Anahtar ve model') + '</h4>' +
    (first ? '<p class="note">Anahtarı bir kez gir; yalnız bu cihazda saklanır (hesaba, yedeğe, paylaşıma girmez). Anahtar almak için Claude Console’da: <b>platform.claude.com/settings/keys</b> → <b>Create key</b> (workspace: <b>Default Workspace</b>) → anahtarı kopyala (bir kez gösterilir). ' +
      'Kredi için: <b>Billing</b> sayfası (platform.claude.com/settings/billing) → <b>Buy credits</b>. Sonnet 5.5 ile soru başına ≈ 1–2 cent, Haiku 5.5 ile ≈ 0,1 cent.</p>' : '') +
    '<label class="f wide">API anahtarı<input id="ak-key" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="' + (ustaKey() ? '•••• kayıtlı · değiştirmek için yapıştır' : 'sk-ant-…') + '"></label>' +
    '<div class="seg wrapseg">' + USTA_MODELS.map(m => '<button class="btn small" type="button" data-ustam="' + m[0] + '" aria-pressed="' + (m[0] === md[0]) + '">' + esc(m[1]) + '</button>').join('') + '</div>' +
    '<p class="note">' + esc(md[1] + ': ' + md[2]) + '</p>' +
    '<div class="row"><button class="btn primary small" type="button" data-usta="savekey">Kaydet</button>' + (ustaKey() ? '<button class="btn small" type="button" data-usta="delkey">Anahtarı sil</button>' : '') + '</div></section>';
}
function sheetUsta(){
  const L = loc(), has = !!ustaKey();
  const ds = WX && L ? days() : [], dd = ds.find(d => d.key === ui.fday) || ds[0], part = ui.fpart || 'gun';
  const ctx = L ? [locLabel(L), dd ? dayLabel(dd.date, ds.indexOf(dd), dateKey(new Date())) + ' ' + (part === 'gece' ? 'gece' : 'gündüz') : '', dd && locKind(L) !== 'kara' ? 'deniz ' + ((part === 'gece' ? dd.clsN : dd.clsD) || '?') : '', dd && dd.sst != null && locKind(L) !== 'kara' ? 'su ' + tempTxt(dd.sst, true) : ''].filter(Boolean).join(' · ') : 'Konum yok';
  const msgs = USTA.msgs.map(m => '<div class="umsg ' + (m.role === 'user' ? 'q' : 'a') + (m.ok === false ? ' fail' : '') + '">' + (m.role === 'user' ? '<p>' + esc(m.text) + '</p>' : mdLite(m.text) + (m.meta ? '<small>' + esc(m.meta) + '</small>' : '')) + '</div>').join('');
  return sheetBar('Usta’ya sor', USTA.msgs.length ? '<button class="btn" type="button" data-usta="clear">Temizle</button>' : '') + '<div class="stack usta">' +
    '<p class="note uctx">' + esc(ctx) + ' · <button class="linkbtn" type="button" data-usta="fishing">Fishing’de gün/bölüm seç</button></p>' +
    (!has ? ustaKeyBox(true) :
      (msgs ? '<div class="umsgs">' + msgs + '</div>' : '<p class="sub">Bugünkü hava, deniz, solunar ve önerilen riglerin Claude’a gider; usta bunlara bakarak cevap verir.</p>') +
      (USTA.busy ? '<div class="umsg a busy"><p>Usta düşünüyor…</p></div>' : '') +
      (USTA.err ? '<div class="banner bad">' + esc(USTA.err) + '</div>' : '') +
      '<div class="uq">' + USTA_Q.map(q => '<button class="bchip" type="button" data-usta="q" data-q="' + esc(q) + '"' + (USTA.busy ? ' disabled' : '') + '>' + esc(q) + '</button>').join('') + '</div>' +
      '<label class="f wide">Sorun<textarea id="ustaQ" rows="3" placeholder="Ör. Akşam 3 saatim var; Sığacık’ta hangi rigle başlayayım?"' + (USTA.busy ? ' disabled' : '') + '></textarea></label>' +
      '<div class="row"><button class="btn primary" type="button" data-usta="ask"' + (USTA.busy ? ' disabled' : '') + '>Sor</button></div>' +
      '<p class="note">Giden: konum adı, dip, derinlik, seçili gün ve bölümün hava/deniz özeti, solunar, önerilen riglerin ve malzemen, son bildirim ve avların. Koordinat gitmez. Cevap genel tavsiyedir; denize çıkma kararı senin.</p>' +
      '<details><summary class="note">Anahtar ve model</summary>' + ustaKeyBox(false) + '</details>') + '</div>';
}
function ustaAct(a, d){
  if (a === 'q') { ustaAsk(d.q); return; }
  if (a === 'ask') { const el = $('ustaQ'); const q = el ? el.value : ''; if (!q.trim()) { toast('Sorunu yaz'); return; } ustaAsk(q); return; }
  if (a === 'fishing') { closeSheet(); show('fishing'); return; }
  if (a === 'clear') { USTA.msgs = []; USTA.err = null; ustaRedraw(); return; }
  if (a === 'savekey') { const v = ($('ak-key') || {}).value || ''; if (!v.trim()) { toast(ustaKey() ? 'Anahtar aynı kaldı' : 'Anahtarı yapıştır'); return; }
    if (!/^sk-ant-/.test(v.trim())) { toast('Anahtar “sk-ant-” ile başlamalı'); return; }
    lsSet(LSU.key, v.trim()); toast('Anahtar bu cihaza kaydedildi'); ustaRedraw(); return; }
  if (a === 'delkey') { lsDel(LSU.key); toast('Anahtar silindi'); ustaRedraw(); return; }
}
