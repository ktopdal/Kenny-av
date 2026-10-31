// ---------------------------------------------------------------- 58b · Takım danışmanı (v0.28): yapay zekâ + internet araması, motor kontrolü
// Kullanıcı yapay zekâsını seçer: Claude (Anthropic, web araması), Gemini (Google, Google Arama ile; Google AI Modu'nun motoru),
// ChatGPT (OpenAI, web araması) ya da anahtarsız kopyala–yapıştır (Google AI Modu, Gemini, ChatGPT, Claude uygulaması). Anahtarlar yalnız
// bu cihazda (localStorage) durur; profile, buluta, yedeğe ve paylaşıma girmez. Giden: tür ve hedef boy, nokta adı, mera notu, derinlik,
// dip, akıntı ve su sıcaklığı, motorun kuralları (kamış, makine, kurşun, iğne, ip ölçüleri), envanterdeki takım. Koordinat gitmez.
// Cevap bir JSON öneri tablosu olarak istenir; uygulamanın motoru her satırı ölçüsüyle kontrol eder (kamış gramı, makara yuvası,
// iğne boyu, ip çapı, kurşun). Satırlar alışveriş listesine ya da (alınınca) marka, model ve ölçüleriyle envantere eklenir.
const AI_TO = 240000;
const AI_PROV = {
  claude: {name: 'Claude', by: 'Anthropic · internette arar', key: 'alyssa-ak', mkey: 'alyssa-dmc', rx: /^sk-ant-/, ph: 'sk-ant-…',
    models: [['claude-sonnet-5-5', 'Sonnet 5.5', 2, 10], ['claude-opus-5-5', 'Opus 5.5'], ['claude-haiku-5-5', 'Haiku 5.5', 0.1, 0.5]],
    help: 'Claude Console’da <b>platform.claude.com/settings/keys</b> → <b>Create key</b> (workspace: <b>Default Workspace</b>). Kredi: <b>Billing</b> → <b>Buy credits</b>. Usta’ya sor da aynı anahtarı kullanır.',
    cost: 'Öneri başına yaklaşık 10–30 cent (internet araması 1 000 aramada 10 $, artı metin).'},
  gemini: {name: 'Gemini', by: 'Google · Google Arama ile (Google AI Modu’nun motoru)', key: 'alyssa-gk', mkey: 'alyssa-dmg', rx: /^AIza/, ph: 'AIza…',
    models: [['gemini-3.5-flash', 'Gemini 3.5 Flash'], ['gemini-flash-latest', 'Gemini Flash (en yeni)']],
    help: 'Google AI Studio’da <b>aistudio.google.com/apikey</b> → <b>Create API key</b>. Ücretsiz katmanda gönderdiğin metni Google ürünlerini geliştirmek için kullanabilir; faturalandırması açık (ücretli) projede kullanmaz.',
    cost: 'Google Arama’lı cevapların aylık ücretsiz kotası var; aşınca arama başına ücretli.'},
  openai: {name: 'ChatGPT', by: 'OpenAI · internette arar', key: 'alyssa-ok', mkey: 'alyssa-dmo', rx: /^sk-/, ph: 'sk-…',
    models: [['gpt-5.5', 'GPT-5.5']],
    help: 'OpenAI Platform’da <b>platform.openai.com/api-keys</b> → <b>Create new secret key</b>. Kredi: <b>Billing</b>. ChatGPT Plus aboneliği API’de geçmez.',
    cost: 'Öneri başına birkaç–birkaç on cent (web araması 1 000 aramada 10 $, artı metin).'},
  elle: {name: 'Google AI (kopyala–yapıştır)', by: 'Soruyu Google AI Modu’na (ya da Gemini, ChatGPT, Claude uygulamasına) yapıştırırsın · anahtarsız, ücretsiz', manual: true},
};
const AI_API = ['claude', 'gemini', 'openai'];
const LSD = {prov: 'alyssa-dp'};
const aiKey = p => AI_PROV[p] && AI_PROV[p].key ? (lsGet(AI_PROV[p].key) || '').trim() : '';
const aiModel = p => { const P = AI_PROV[p]; if (!P || !P.models) return ''; const m = (lsGet(P.mkey) || '').trim(); return m || P.models[0][0]; };
const aiModelName = (p, m) => { const P = AI_PROV[p]; const x = P && P.models && P.models.find(y => y[0] === m); return x ? x[1] : m; };
function aiProv(){ const p = lsGet(LSD.prov); if (AI_PROV[p]) return p; return AI_API.find(k => aiKey(k)) || 'elle'; }
const MANUAL_LINKS = [['Google AI Modu', 'https://www.google.com/search?udm=50'], ['Gemini', 'https://gemini.google.com/app'], ['ChatGPT', 'https://chatgpt.com/'], ['Claude', 'https://claude.ai/new']];

// ---- durum
const DAN_CATS = [['kamis', 'Kamış'], ['makine', 'Makine'], ['ana_ip', 'Ana ip'], ['lider', 'Lider'], ['igne', 'İğne'], ['terminal', 'Fırdöndü, halka, klips'],
  ['kursun', 'Kurşun / jig'], ['aksesuar', 'Aksesuar (kemer, eldiven, gaf)'], ['dugum_aleti', 'Düğüm aleti'], ['hazir_rig', 'Hazır rig']];
const DAN_CAT_TXT = Object.assign(Object.fromEntries(DAN_CATS), {jig: 'Jig / sahte yem', yem: 'Yem', diger: 'Diğer'});
const DAN = {sp: null, size: '', loc: null, note: '', lay: '', budget: '', tr: true, own: true, cats: null, rid: null, step: 'form', busy: false, err: null, res: null, ans: {}, prompt: null, view: null};
function openDan(o){
  o = o || {};
  const rg = o.rid ? RIGS[o.rid] : null;
  const sp = o.sp || (rg && (rg.species || [])[0]) || (DAN.sp && spById(DAN.sp) ? DAN.sp : null) || ((S.targets || [])[0] || {}).id || null;
  if (sp !== DAN.sp) { DAN.size = ''; DAN.lay = ''; DAN.ans = {}; }
  DAN.sp = sp && spById(sp) ? (spById(sp).id) : null;
  DAN.rid = rg ? rg.id : null;
  DAN.lay = rg && rg.lay ? rg.lay : (o.sp ? '' : DAN.lay);
  const L = loc(); DAN.loc = L && locKind(L) !== 'kara' ? L.id : (danLocs()[0] || {}).id || null;
  DAN.note = DAN.loc ? (S.locations[DAN.loc].mera || '') : '';
  if (o.cats) DAN.cats = o.cats.slice(); else if (!DAN.cats) DAN.cats = DAN_CATS.map(c => c[0]);
  DAN.step = 'form'; DAN.err = null; DAN.view = null;
  openMore('danisman');
}
const danLocs = () => Object.values(S.locations).filter(L => locKind(L) !== 'kara');
function danRead(){
  const v = id => { const el = $(id); return el ? el.value : null; };
  if (v('dn-sp') != null) { const s = v('dn-sp'); if (s !== DAN.sp) { DAN.sp = s; DAN.lay = ''; DAN.rid = null; } }
  if (v('dn-size') != null) DAN.size = v('dn-size').trim();
  if (v('dn-loc') != null) { const l = v('dn-loc'); if (l !== DAN.loc) { DAN.loc = l; DAN.note = (S.locations[l] || {}).mera || ''; } else DAN.note = (v('dn-note') || '').trim(); }
  else if (v('dn-note') != null) DAN.note = v('dn-note').trim();
  if (v('dn-budget') != null) DAN.budget = v('dn-budget').trim();
  const tr = $('dn-tr'), own = $('dn-own'); if (tr) DAN.tr = tr.checked; if (own) DAN.own = own.checked;
  document.querySelectorAll('[data-danq]').forEach(el => { DAN.ans[el.dataset.danq] = el.value.trim(); });
}

// ---- motorun kuralları: seçilen düzen için tür planı (ya da danışman bir rigden açıldıysa o rig)
function danTechOfLay(s, lay){ return techsFor(s).find(t => (t === 'eging' ? [s.id === 'ahtapot' ? 'ahtapot' : 'egi'] : KB.TECH[t].lay).includes(lay)) || null; }
function danLays(s){
  const out = [];
  techsFor(s).forEach(t => (t === 'eging' ? [s.id === 'ahtapot' ? 'ahtapot' : 'egi'] : KB.TECH[t].lay).forEach(l => { if (KB.LAY[l] && !out.includes(l)) out.push(l); }));
  return out;
}
function danRig(){
  if (DAN.rid && RIGS[DAN.rid]) return RIGS[DAN.rid];
  const s = spById(DAN.sp); if (!s) return null;
  const sv = ui.plan;
  try { ui.plan = {id: s.id}; if (DAN.lay) { ui.plan.lay = DAN.lay; ui.plan.tech = danTechOfLay(s, DAN.lay); } const p = planFor({id: s.id, name: s.name}); return p && p.rg ? p.rg : null; }
  catch (e) { return null; } finally { ui.plan = sv; }
}
const danNeed = rg => rg ? ((rg.gear && rg.gear.need) || gearNeed(rg)) : null;
function danRules(rg){
  if (!rg) return [];
  const out = [], need = danNeed(rg);
  out.push('Düzen: ' + (KB.LAY[rg.lay] ? KB.LAY[rg.lay].name : rg.sys === 'ozel' ? 'Hırsızlı dip takımı' : rg.lay || '-') + (rg.code ? ' (rig ' + rg.code + ')' : ''));
  if (need) { out.push('Kamış: ' + rodReqTxt(need)); out.push('Makine: ' + reelReqTxt(need, null)); }
  if (rg.sinker && rg.sinker.g) out.push('Kurşun: ' + rg.sinker.g[0] + '–' + rg.sinker.g[1] + ' g');
  rg.slots.filter(sl => sl.sp && ['hook', 'line', 'lure'].includes(sl.sp.kind)).forEach(sl => { const r = rangeTxt(sl.sp); if (r) out.push(sl.label + ': ' + r); });
  const len = rg.lengths || {}; if (len.lider) out.push('Lider boyu: ' + fmtNum(len.lider / 100, 1) + ' m');
  return out;
}

// ---- nokta ve deniz özeti (koordinatsız)
function danSea(L){
  const f = () => { const ds = days().slice(0, 7); if (!ds.length) return null;
    const cur = ds.map(d => d.cur).filter(v => v != null), w = ds.map(d => Math.max(d.wd || 0, d.wn || 0)).filter(Boolean);
    return {cur: cur.length ? Math.max(...cur) : null, curM: cur.length ? cur.reduce((a, b) => a + b, 0) / cur.length : null, sst: ds[0].sst, w: w.length ? Math.max(...w) : null, wave: maxOf(ds, 'wave')}; };
  try { if (L.id === S.active) return WX ? f() : null; const w = MWX[L.id]; return w && w.raw ? withLoc(L, w, f) : null; } catch (e) { return null; }
}
function danLocLines(L){
  if (!L) return ['Nokta seçilmedi.'];
  const REG = Object.fromEntries(KB.REGIONS), k = locKind(L), sea = danSea(L), out = [];
  out.push('Nokta: ' + locLabel(L) + ' · ' + (REG[regionOf(L)] || 'Ege') + ' Denizi, Türkiye · ' + (k === 'kiyi' ? 'kıyıdan av' : 'tekneden av' + (S.settings.anchor === 'demir' ? ', demirli' : ', sürüklenerek')));
  if (DAN.note) out.push('Mera notu: ' + DAN.note);
  const dp = L.depth || (L.id === S.active && typeof locDepth === 'function' ? locDepth() : null);
  out.push('Derinlik: ' + (dp ? dp + ' m' : 'bilinmiyor') + ' · dip: ' + (L.bottom ? BOTTOM_TXT[L.bottom] : L.bottomEst ? 'tahmini ' + (L.bottomEstTxt || BOTTOM_TXT[L.bottomEst]) : 'bilinmiyor'));
  if (sea) out.push('Önümüzdeki 7 gün: akıntı en çok ' + (sea.cur != null ? f1(sea.cur) + ' kn (ort. ' + f1(sea.curM) + ')' : 'bilinmiyor') + (sea.w ? ' · rüzgâr en çok ' + bft(sea.w) + ' Bft' : '') + (sea.wave != null ? ' · dalga en çok ' + f1(sea.wave) + ' m' : '') + (sea.sst != null ? ' · su ' + f1(sea.sst) + ' °C' : ''));
  out.push('Ay: ' + MON_LONG[new Date().getMonth()] + ' ' + new Date().getFullYear());
  return out;
}

// ---- envanterdeki takım (yalnız elde olanlar; iğnede seçilen düzenin ölçüsüne yakın olanlar)
function danInv(rg){
  const use = it => sizesOf(it).filter(sz => usable(stockOf(it.id, sz)));
  const its = Object.values(ITEMS).filter(it => it.cat !== 'bait' && use(it).length);
  const g = c => its.filter(it => c.includes(it.cat));
  const out = [];
  const add = (lbl, arr, f, max) => { if (!arr.length) return; out.push(lbl + ':'); arr.slice(0, max || 20).forEach(it => out.push('- ' + f(it))); if (arr.length > (max || 20)) out.push('- (+' + (arr.length - (max || 20)) + ' kalem daha)'); };
  const sp = it => [it.spec, it.note && it.note.length < 60 ? it.note : ''].filter(Boolean).join(' · ');
  add('Kamışlar', g(['rod']), it => it.name + (rodSpecTxt(it) ? ' · ' + rodSpecTxt(it) : '') + (sp(it) ? ' · ' + sp(it) : ''));
  add('Makineler', g(['reel']), it => it.name + (reelSpecTxt(it) ? ' · ' + reelSpecTxt(it) : '') + (sp(it) ? ' · ' + sp(it) : ''));
  add('İpler', g(['braid', 'fc', 'mono']), it => it.name + ' (' + CAT_TXT[it.cat] + ')' + (it.spec ? ' · ' + it.spec : ''));
  const hs = rg && rg.slots.find(sl => sl.sp && sl.sp.kind === 'hook') ? rg.slots.find(sl => sl.sp && sl.sp.kind === 'hook').sp : null;
  const hooks = g(['hook']).map(it => { const sz = use(it).filter(s => { if (!hs) return true; const h = hookIdx(s); return h && h.sc === hs.sc && h.v >= hs.lo - 2 && h.v <= hs.hi + 2; }); return sz.length ? {it, sz} : null; }).filter(Boolean);
  add('İğneler' + (hs ? ' (bu işe yakın boylar)' : ''), hooks.map(x => Object.assign({}, x.it, {_sz: x.sz})), it => it.name + ' · ' + it._sz.join(', '), 15);
  add('Terminal ve kurşun', g(['terminal', 'sinker']), it => it.name + (use(it)[0] !== '-' ? ' · ' + use(it).join(', ') : ''), 15);
  add('Jig ve sahte yem', g(['jig', 'lure']), it => it.name + (use(it)[0] !== '-' ? ' · ' + use(it).join(', ') : ''), 12);
  add('Ekipman', g(['ekip']), it => it.name, 12);
  return out.length ? out : ['(envanter boş)'];
}

// ---- soru (sistem + kullanıcı)
const DAN_SCHEMA = '{\n "ozet": "3–6 cümle",\n "sorular": ["en fazla 3 kısa soru; yoksa boş liste"],\n "eldeki": [{"ad": "envanterdeki adıyla", "kategori": "kamis|makine|ana_ip|lider|igne|diger", "karar": "uygun|sinirda|uygun_degil", "neden": "ölçüyle kısa neden"}],\n' +
  ' "oneriler": [{"kategori": "kamis|makine|ana_ip|lider|igne|terminal|kursun|jig|yem|aksesuar|dugum_aleti|hazir_rig", "marka": "", "model": "", "seviye": "kolay|orta|premium",\n   "olcu": {"boy_cm": null, "min_g": null, "max_g": null, "pe": null, "lb": null, "mm": null, "igne_no": null, "agirlik_g": null, "makine_boy": null, "yuva": "tetikli|tetiksiz|null"},\n' +
  '   "neden": "neden bu ürün, neye uyar", "fiyat_tl": "örn. 5.400–6.100", "nerede": "mağaza ya da site adı", "url": "ürün sayfası"}],\n "uyarilar": ["güvenlik, ölçü uyumsuzluğu"],\n "kaynaklar": [{"baslik": "", "url": ""}]\n}';
const DAN_SYS = 'Sen Türkiye’de deniz olta balıkçılığı takımı konusunda uzman bir danışmansın (tekne ve kıyı: dip, jig, canlı yem, sırtı, büyük oyun). ' +
  'Kullanıcı Alyssa uygulamasından yazıyor; aşağıda hedefi, avlanacağı nokta, uygulamanın kuralları ve elindeki takım var.\n' +
  'Görevin:\n' +
  '1) İnternette ara ve Türkiye’de satılan güncel ürünleri bul: gerçek marka ve model adı, üreticinin ölçüleri, Türk mağazalarındaki TL fiyatı. Model uydurma; emin olmadığın ölçüyü null bırak.\n' +
  '2) Eldeki takımı değerlendir: her kamış, makine ve ip için bu iş için uygun, sınırda ya da uygun değil de; nedenini ölçüyle yaz. Uymuyorsa yerine öneri ver (kamış da makine de olabilir).\n' +
  '3) İstenen her kategoride 1–3 seçenek ver: Türkiye’de kolay bulunan ve premium. Bütçe verildiyse alınacakların toplamı bütçeyi aşmasın.\n' +
  '4) Ölçüler birbirine uysun: kamışın en fazla gramı rigin kurşun/yem gramını karşılasın; makara yuvası uysun (tetikli kamış → çıkrık; tetiksiz → spinning); ip PE/lb kamış ve makineye uysun; iğne boyu türe ve yeme uysun.\n' +
  '5) Kritik bir bilgi eksikse en fazla 3 kısa soru sor ama yine de elindeki bilgiyle öneri ver.\n' +
  '6) Av yasağı ve boy sınırı için kesin bilgi verme; güncel tebliğe bakmasını söyle. Güvenlik uyarılarını unutma.\n' +
  'Biçim: önce kısa bir Türkçe özet yaz, sonra cevabın EN SONUNA tek bir ```json kod bloğu koy; şeması:\n' + DAN_SCHEMA + '\nBirimler: cm, g, m, PE, lb, mm. Sayılar sayı olsun. Metinler Türkçe.';
function danPrompt(){
  const s = spById(DAN.sp), L = S.locations[DAN.loc], rg = danRig();
  const out = [];
  out.push('HEDEF: ' + (s ? s.name + ' (' + s.latin + ')' : 'belirtilmedi') + (DAN.size ? ' · hedef boy: ' + DAN.size : s && s.sz ? ' · tipik boy: ' + Object.values(s.sz).join(', ') : ''));
  out.push(...danLocLines(L));
  out.push('TEKNİK: ' + (DAN.lay && KB.LAY[DAN.lay] ? KB.LAY[DAN.lay].name : 'sen öner (uygulamanın önerdiği düzen aşağıda)'));
  const R = danRules(rg); if (R.length) { out.push('UYGULAMANIN KURALLARI (ölçü ölçü):'); R.forEach(r => out.push('- ' + r)); }
  if (DAN.own) { out.push('ELDEKİ TAKIM (envanterden):'); out.push(...danInv(rg)); } else out.push('ELDEKİ TAKIM: değerlendirme istenmedi.');
  out.push('İSTENEN KATEGORİLER: ' + DAN.cats.map(c => DAN_CAT_TXT[c] || c).join(', '));
  out.push('BÜTÇE: ' + (DAN.budget ? DAN.budget + ' TL’ye kadar (alınacakların toplamı)' : 'belirtilmedi') + (DAN.tr ? ' · Yalnız Türkiye’de satılan ürünler' : ''));
  const qa = (DAN.res && DAN.res.data && DAN.res.data.sorular || []).map((q, i) => DAN.ans['q' + i] ? '- ' + q + ' → ' + DAN.ans['q' + i] : '').filter(Boolean);
  if (qa.length) { out.push('EK BİLGİ (önceki sorularına kullanıcının cevapları; artık soru sorma):'); out.push(...qa); }
  return {sys: DAN_SYS, user: out.join('\n')};
}

// ---- sağlayıcı çağrıları
async function aiClaude(sys, user){
  const key = aiKey('claude'); if (!key) throw new Error('Önce Claude API anahtarını gir.');
  const model = aiModel('claude'), md = AI_PROV.claude.models.find(m => m[0] === model);
  const body = {model, max_tokens: 12000, system: sys, messages: [{role: 'user', content: user}],
    tools: [{type: 'web_search_20250305', name: 'web_search', max_uses: 8, user_location: {type: 'approximate', city: 'İzmir', region: 'İzmir', country: 'TR', timezone: 'Europe/Istanbul'}}]};
  const send = () => fetchT(USTA_API, {method: 'POST', headers: {'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'}, body: JSON.stringify(body)}, AI_TO);
  let r = await send(), j = await r.json().catch(() => ({}));
  if (r.status === 400 && /web_search/i.test(JSON.stringify(j))) { body.tools[0].type = 'web_search_20260318'; r = await send(); j = await r.json().catch(() => ({})); }   // araç sürümü tanınmazsa yenisi
  if (!r.ok) throw new Error(ustaErr(r.status, j).replace('aşağıdan diğer modeli seç', 'Bağlantı ayarlarından başka model seç'));
  const content = [].concat(j.content || []); let n = 0; const u = {i: 0, o: 0, s: 0};
  const acc = x => { x = x || {}; u.i += x.input_tokens || 0; u.o += x.output_tokens || 0; u.s += ((x.server_tool_use || {}).web_search_requests) || 0; }; acc(j.usage);
  while (j.stop_reason === 'pause_turn' && n < 3) {   // uzun arama turu: kaldığı yerden devam
    body.messages = [{role: 'user', content: user}, {role: 'assistant', content: content.slice()}];
    r = await send(); j = await r.json().catch(() => ({})); if (!r.ok) break; content.push(...(j.content || [])); acc(j.usage); n++;
  }
  const text = content.filter(c => c && c.type === 'text').map(c => c.text).join('');
  const src = [], seen = new Set(), put = (t, u2) => { if (u2 && !seen.has(u2)) { seen.add(u2); src.push({t: t || u2, u: u2}); } };
  content.filter(c => c && c.type === 'text').forEach(c => (c.citations || []).forEach(x => put(x.title, x.url)));
  if (src.length < 3) content.filter(c => c && c.type === 'web_search_tool_result' && Array.isArray(c.content)).forEach(c => c.content.slice(0, 4).forEach(x => put(x.title, x.url)));
  const cost = md && md[2] != null ? (u.i * md[2] + u.o * md[3]) / 1e6 + u.s * 0.01 : null;
  return {text, src: src.slice(0, 14), entry: null, model: aiModelName('claude', model), cost, searches: u.s};
}
function gemErr(st, j){
  const e = (j && j.error) || {}, m = (e.message || '') + ' ' + (e.status || '');
  if (/API_KEY_INVALID|API key not valid/i.test(m) || st === 401) return 'API anahtarı geçersiz. Google AI Studio’da Create API key ile yeni anahtar al.';
  if (st === 403) return 'Bu anahtarın Gemini API izni yok (' + (e.message || '').slice(0, 80) + ').';
  if (st === 404) return 'Model bulunamadı: Bağlantı ayarlarından başka model seç ya da model adını yaz.';
  if (st === 429 || /RESOURCE_EXHAUSTED/.test(m)) return 'Kota doldu (ücretsiz katmanın dakikalık ya da günlük sınırı); biraz bekleyip tekrar dene.';
  if (st >= 500) return 'Gemini şu an yoğun; birazdan tekrar dene.';
  return 'Hata ' + st + (e.message ? ': ' + e.message.slice(0, 120) : '');
}
async function aiGemini(sys, user){
  const key = aiKey('gemini'); if (!key) throw new Error('Önce Gemini API anahtarını gir.');
  let model = aiModel('gemini');
  const body = JSON.stringify({systemInstruction: {parts: [{text: sys}]}, contents: [{role: 'user', parts: [{text: user}]}], tools: [{google_search: {}}], generationConfig: {temperature: 0.3, maxOutputTokens: 12000}});
  const send = m => fetchT('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(m) + ':generateContent?key=' + encodeURIComponent(key), {method: 'POST', headers: {'content-type': 'application/json'}, body}, AI_TO);
  let r = await send(model), j = await r.json().catch(() => ({}));
  if (r.status === 404) for (const m of ['gemini-flash-latest', 'gemini-3.5-flash']) { if (m === model) continue; const r2 = await send(m), j2 = await r2.json().catch(() => ({})); if (r2.ok) { r = r2; j = j2; model = m; break; } }
  if (!r.ok) throw new Error(gemErr(r.status, j));
  const c = (j.candidates || [])[0] || {};
  const text = (((c.content || {}).parts) || []).map(p => p.text || '').join('');
  if (!text) throw new Error(c.finishReason ? 'Cevap gelmedi (' + c.finishReason + '); tekrar dene.' : 'Boş cevap geldi; tekrar dene.');
  const gm = c.groundingMetadata || {};
  const src = (gm.groundingChunks || []).map(x => x.web).filter(Boolean).map(w => ({t: w.title || w.uri, u: w.uri}));
  return {text, src: src.slice(0, 14), entry: (gm.searchEntryPoint || {}).renderedContent || null, model: aiModelName('gemini', model), cost: null, searches: (gm.webSearchQueries || []).length};
}
function oaErr(st, j){
  const m = ((j && j.error && j.error.message) || '') + '';
  if (st === 401) return 'API anahtarı geçersiz. OpenAI Platform’da API keys → Create new secret key ile yeni anahtar al.';
  if (/quota|billing|credit/i.test(m)) return 'Hesapta kredi yok: OpenAI Platform’da Billing’den kredi yükle.';
  if (st === 404 || /model/i.test(m) && st === 400) return 'Model bulunamadı ya da bu anahtar kullanamıyor: Bağlantı ayarlarından model adını değiştir.';
  if (st === 429) return 'Çok sık soruldu ya da limit doldu; biraz bekleyip tekrar dene.';
  if (st >= 500) return 'OpenAI şu an yoğun; birazdan tekrar dene.';
  return 'Hata ' + st + (m ? ': ' + m.slice(0, 120) : '');
}
async function aiOpenAI(sys, user){
  const key = aiKey('openai'); if (!key) throw new Error('Önce OpenAI API anahtarını gir.');
  const model = aiModel('openai');
  const body = {model, instructions: sys, input: user, max_output_tokens: 24000,
    tools: [{type: 'web_search', user_location: {type: 'approximate', country: 'TR', city: 'İzmir', region: 'İzmir', timezone: 'Europe/Istanbul'}}]};
  const r = await fetchT('https://api.openai.com/v1/responses', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + key}, body: JSON.stringify(body)}, AI_TO);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(oaErr(r.status, j));
  const parts = (j.output || []).filter(o => o.type === 'message').flatMap(o => o.content || []).filter(c => c.type === 'output_text');
  const text = parts.map(c => c.text).join('\n');
  if (!text) throw new Error('Boş cevap geldi; tekrar dene.');
  const src = [], seen = new Set(); parts.forEach(c => (c.annotations || []).forEach(a => { if (a.type === 'url_citation' && a.url && !seen.has(a.url)) { seen.add(a.url); src.push({t: a.title || a.url, u: a.url}); } }));
  return {text, src: src.slice(0, 14), entry: null, model: aiModelName('openai', model), cost: null, searches: (j.output || []).filter(o => o.type === 'web_search_call').length};
}
const AI_CALL = {claude: aiClaude, gemini: aiGemini, openai: aiOpenAI};

// ---- cevabı okuma: son ```json bloğu (yoksa en dıştaki { … }); olmazsa Markdown tablolarından
function danParse(t){
  t = String(t || '');
  const blocks = [...t.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)].map(x => x[1].trim()).filter(x => x.charAt(0) === '{');
  let cand = blocks.length ? blocks[blocks.length - 1] : null;
  if (!cand) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) cand = t.slice(a, b + 1); }
  const tryP = x => { try { return JSON.parse(x); } catch (e) { return null; } };
  let j = cand ? (tryP(cand) || tryP(cand.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1'))) : null;
  const pre = (j && blocks.length ? t.replace(/```(?:json|JSON)?\s*[\s\S]*?```/g, '') : j ? t.slice(0, t.indexOf('{')) : t).trim();
  if (!j) { const rows = mdTables(t); if (rows.length) return {data: danNorm({ozet: '', oneriler: rows}), pre: t.split(/\r?\n/).filter(l => !/\|/.test(l)).join('\n').trim()}; }
  return j ? {data: danNorm(j), pre} : {data: null, pre: t.trim()};
}
const CAT_ALIAS = [[/kam[ıi]ş|rod/i, 'kamis'], [/makine|makara|reel|çıkrık|cikrik/i, 'makine'], [/lider|şok|sok|leader|florokarbon|fluoro/i, 'lider'], [/ana.?ip|örgü|orgu|braid|misina|ip\b|pe\b/i, 'ana_ip'],
  [/iğne|igne|hook/i, 'igne'], [/fırdöndü|firdondu|halka|ring|klips|swivel|terminal/i, 'terminal'], [/kurşun|kursun|ağırlık|agirlik|sinker/i, 'kursun'], [/jig|zoka|popper|sahte/i, 'jig'],
  [/düğüm|dugum|knot/i, 'dugum_aleti'], [/hazır|hazir|rig/i, 'hazir_rig'], [/kemer|gimbal|eldiven|gaf|aksesuar|pense/i, 'aksesuar'], [/yem\b|bait/i, 'yem']];
function danCat(c){ c = String(c || ''); if (DAN_CAT_TXT[c]) return c; const a = CAT_ALIAS.find(x => x[0].test(c)); return a ? a[1] : 'diger'; }
const numOf = v => { if (v == null || v === '') return null; if (typeof v === 'number') return v; const m = String(v).replace(/(\d)\.(\d{3})\b/g, '$1$2').replace(',', '.').match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : null; };
function danNorm(j){
  const arr = x => Array.isArray(x) ? x : x ? [x] : [];
  const o = arr(j.oneriler || j.recommendations).map(x => { const ol = x.olcu || x.olculer || {};
    return {kategori: danCat(x.kategori || x.category), marka: String(x.marka || x.brand || '').trim(), model: String(x.model || x.urun || x.name || '').trim(), seviye: String(x.seviye || '').trim(),
      olcu: {boy_cm: numOf(ol.boy_cm), min_g: numOf(ol.min_g), max_g: numOf(ol.max_g), pe: ol.pe != null ? String(ol.pe) : null, lb: numOf(ol.lb), mm: numOf(ol.mm), igne_no: ol.igne_no != null ? String(ol.igne_no) : null,
        agirlik_g: numOf(ol.agirlik_g), makine_boy: numOf(ol.makine_boy), yuva: ol.yuva && ol.yuva !== 'null' ? String(ol.yuva) : null},
      neden: String(x.neden || x.aciklama || '').trim(), fiyat_tl: x.fiyat_tl != null ? String(x.fiyat_tl) : '', nerede: String(x.nerede || '').trim(), url: /^https?:\/\//.test(x.url || '') ? x.url : ''}; })
    .filter(x => x.marka || x.model);
  return {ozet: String(j.ozet || '').trim(), sorular: arr(j.sorular).map(String).filter(Boolean).slice(0, 3),
    eldeki: arr(j.eldeki).map(x => ({ad: String(x.ad || ''), kategori: danCat(x.kategori), karar: /degil|değil|bad/.test(x.karar || '') ? 'bad' : /sinir|sınır|warn/.test(x.karar || '') ? 'warn' : 'ok', neden: String(x.neden || '')})).filter(x => x.ad),
    oneriler: o, uyarilar: arr(j.uyarilar).map(String).filter(Boolean),
    kaynaklar: arr(j.kaynaklar).map(x => ({t: String(x.baslik || x.title || x.url || ''), u: String(x.url || '')})).filter(x => /^https?:\/\//.test(x.u))};
}
// Markdown tablosu (Google AI Modu çoğu zaman tablo verir): başlıklara göre sütun eşle
function mdTables(t){
  const lines = String(t).split(/\r?\n/), out = []; let head = null, cat = null;
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim().replace(/\*\*/g, ''));
  lines.forEach((l, i) => {
    if (!/\|/.test(l)) { if (/^#{1,4}\s|^\*\*.+\*\*$|tablosu/i.test(l.trim())) cat = l.replace(/[#*]/g, '').trim(); head = null; return; }
    if (/^\s*\|?\s*:?-{3,}/.test(l)) return;
    const c = cells(l);
    if (!head) { head = c.map(h => trLower(h)); return; }
    const col = re => head.findIndex(h => re.test(h));
    const iM = col(/model|ürün|urun|öneri|oneri|marka/), iB = col(/^marka$/), iC = col(/tür|tur|kategori|ekipman/), iP = col(/fiyat/), iD = col(/özellik|ozellik|karakter|açıklama|aciklama|fonksiyon|amaç|amac/),
      iG = col(/kapasite|atar|gram|ağırlık|agirlik/), iPe = col(/\bpe\b|ip/), iL = col(/boy/);
    if (iM < 0) return;
    let model = c[iM] || '', marka = iB >= 0 && iB !== iM ? c[iB] : '';
    if (!marka) { const p = model.split(/\s+/); marka = p.shift(); model = p.join(' '); }
    const g = iG >= 0 ? (c[iG] || '').match(/(\d+)\s*(?:[-–]\s*(\d+))?\s*g/i) : null;
    out.push({kategori: iC >= 0 ? c[iC] : cat || '', marka, model, olcu: {max_g: g ? +(g[2] || g[1]) : null, min_g: g && g[2] ? +g[1] : null, pe: iPe >= 0 ? c[iPe] : null, boy_cm: iL >= 0 ? numOf(c[iL]) : null},
      neden: iD >= 0 ? c[iD] : '', fiyat_tl: iP >= 0 ? (c[iP] || '').replace(/\s*TL$/i, '') : ''});
  });
  return out;
}

// ---- motor kontrolü: öneri bu rige uyuyor mu
const danItName = o => [o.marka, o.model].filter(Boolean).join(' ');
function danRodIt(o){
  const ol = o.olcu || {}, base = rodInfo({name: danItName(o) + ' ' + (o.neden || ''), model: '', spec: ''});
  const seat = /tetiksiz|spin/i.test(ol.yuva || '') ? 'spin' : /tetikli|cast|baitcast|çıkrık/i.test(ol.yuva || '') ? 'cast' : null;
  return {id: 'dan:rod', name: danItName(o), model: o.model, rod: Object.assign({type: base.type, len: ol.boy_cm ? ol.boy_cm / 100 : base.len, max: ol.max_g || base.max, pe: numOf(ol.pe) || base.pe}, seat ? {seat} : {})};
}
function danReelIt(o){
  const ol = o.olcu || {}, base = reelInfo({name: danItName(o) + ' ' + (o.neden || ''), model: o.model, spec: ol.yuva || ''});
  const type = /tetikli|çıkrık|cikrik|lever|baitcast|conventional/i.test(ol.yuva || '') ? 'cikrik' : /tetiksiz|spin/i.test(ol.yuva || '') ? 'spin' : base.type;
  // çıkrıkta boy sınıf numarasıdır (12, 20, 30, 50; LX 6/3): spinning boyuna çevir (12–20 → L, 30 ve üstü → XL)
  let size = ol.makine_boy || base.size; if (type === 'cikrik' && size && size < 100) size = size >= 30 ? 14000 : size >= 12 ? 8000 : 4000;
  return {id: 'dan:reel', name: danItName(o), model: o.model, reel: {type, size}};
}
const peMm = pe => { const v = numOf(pe); return v == null ? null : PE_MM.reduce((b, x) => Math.abs(x[0] - v) < Math.abs(b[0] - v) ? x : b)[1]; };
function danCheck(o, rg, ctx){
  if (!rg) return null;
  const need = danNeed(rg), ol = o.olcu || {}, why = [], warn = [];
  const fin = () => ({fit: why.length ? 'bad' : warn.length ? 'warn' : 'ok', why: why.concat(warn)});
  if (o.kategori === 'kamis' && need) {
    const it = danRodIt(o); if (!it.rod.max && !it.rod.type) return {fit: null, why: ['Ölçüsü (en fazla gram) yazılmamış; kontrol edilemedi.']};
    const f = rodFit(it, need); why.push(...f.why); warn.push(...f.warn);
    // makara yuvası: bu rige uyan makinelerinden biri bu kamışa takılabiliyor mu
    const seat = it.rod.seat, rl = (ctx && ctx.reels) || [];
    if (seat && rl.length) { const want = seat === 'cast' ? 'cikrik' : 'spin';
      if (!rl.some(r => r.type === want)) warn.push((seat === 'cast' ? 'Tetikli kamış: çıkrık ister; ' : 'Tetiksiz kamış: spinning makine ister; ') + 'bu rige uyan makinen ' + rl.map(r => r.name + ' (' + REEL_SHORT[r.type] + ')').join(', ')); }
    return fin();
  }
  if (o.kategori === 'makine' && need) { const it = danReelIt(o); if (!it.reel.type && !it.reel.size) return {fit: null, why: ['Tipi ve boyu yazılmamış; kontrol edilemedi.']}; const f = reelFit(it, need, null); why.push(...f.why); warn.push(...f.warn); return fin(); }   // rigin ihtiyacına göre (eldeki uymayan kamışa göre değil)
  const slot = k => rg.slots.find(sl => sl.sp && (k === 'hook' ? sl.sp.kind === 'hook' : k === 'ana' ? sl.sp.kind === 'line' && ['braid', 'ana'].includes(sl.k) : sl.sp.kind === 'line' && ['lider', 'kostek'].includes(sl.k)));
  if (o.kategori === 'igne') {
    const sl = slot('hook'), h = ol.igne_no ? hookIdx(String(ol.igne_no).replace(/^no\.?\s*/i, '')) || hookIdx(ol.igne_no) : null;
    if (!sl || !h) return sl ? {fit: null, why: ['İğne numarası yazılmamış; kontrol edilemedi.']} : null;
    const sp = sl.sp, R = hookFmt(sp.sc, sp.lo) + '–' + hookFmt(sp.sc, sp.hi);
    if (h.sc !== sp.sc) warn.push('Boy ölçeği farklı; bu rig ' + R + ' ister');
    else if (h.v < sp.lo - 1 || h.v > sp.hi + 1) why.push(ol.igne_no + ' bu rig için ' + (h.v < sp.lo ? 'küçük' : 'büyük') + '; ' + R + ' ister');
    else if (h.v < sp.lo || h.v > sp.hi) warn.push(ol.igne_no + ' sınırda; rig ' + R + ' ister');
    return fin();
  }
  if (o.kategori === 'ana_ip' || o.kategori === 'lider') {
    const sl = slot(o.kategori === 'ana_ip' ? 'ana' : 'lider'); if (!sl) return null;
    const mm = ol.mm || peMm(ol.pe); if (!mm) return {fit: null, why: ['Çapı (mm ya da PE) yazılmamış; kontrol edilemedi.']};
    const sp = sl.sp, R = mmTxt(sp.lo) + '–' + mmTxt(sp.hi);
    if (mm < sp.lo * 0.8 || mm > sp.hi * 1.25) why.push(mmTxt(mm) + ' bu rig için ' + (mm < sp.lo ? 'ince' : 'kalın') + '; ' + R + ' ister');
    else if (mm < sp.lo * 0.93 || mm > sp.hi * 1.07) warn.push(mmTxt(mm) + ' sınırda; rig ' + R + ' ister');
    return fin();
  }
  if ((o.kategori === 'kursun' || o.kategori === 'jig') && need && need.g) {
    const g = ol.agirlik_g || ol.max_g; if (!g) return null;
    if (g < need.g[0] * 0.8 || g > need.g[1] * 1.2) warn.push(g + ' g; bu rig ' + need.g[0] + '–' + need.g[1] + ' g ister'); return fin();
  }
  return null;
}
// elindeki kamış ve makine: motorun görüşü
function danOwn(rg){
  const need = danNeed(rg); if (!need) return {rods: [], reels: [], ctx: {}};
  const owned = it => sizesOf(it).some(sz => usable(stockOf(it.id, sz)));
  const rods = Object.values(ITEMS).filter(i => i.cat === 'rod' && owned(i)).map(i => rodFit(i, need)).sort((a, b) => a.sc - b.sc);
  const rod0 = (rods[0] || {}).it || null;
  const reels = Object.values(ITEMS).filter(i => i.cat === 'reel' && owned(i)).map(i => reelFit(i, need, null)).sort((a, b) => a.sc - b.sc);
  const okR = reels.filter(r => r.fit !== 'bad' && r.inf.type).map(r => ({type: r.inf.type, name: r.it.name}));
  return {rods, reels, ctx: {rodIt: rod0, reels: okR}};
}

// ---- sor
async function danAsk(){
  danRead();
  if (!DAN.sp) { toast('Önce türü seç'); return; }
  if (!DAN.cats.length) { toast('En az bir kategori seç'); return; }
  const L = S.locations[DAN.loc]; if (L && DAN.note !== (L.mera || '')) { L.mera = DAN.note; persist(); }
  const p = aiProv(), pr = danPrompt(); DAN.prompt = pr;
  if (AI_PROV[p].manual) { DAN.step = 'paste'; danRedraw(); try { await navigator.clipboard.writeText(pr.sys + '\n\n' + pr.user); toast('Soru kopyalandı; yapay zekâna yapıştır'); } catch (e) { toast('Aşağıdaki metni seçip kopyala'); } return; }
  if (!aiKey(p)) { DAN.err = AI_PROV[p].name + ' için önce API anahtarını gir (Bağlantı ayarları).'; DAN.step = 'form'; danRedraw(); return; }
  DAN.busy = true; DAN.err = null; DAN.step = 'busy'; DAN.t0 = Date.now(); danRedraw();
  try { const a = await AI_CALL[p](pr.sys, pr.user); danDone(a.text, Object.assign({prov: p}, a)); }
  catch (e) { DAN.err = e && e.name === 'AbortError' ? 'Cevap gecikti (' + Math.round(AI_TO / 1000) + ' sn); bağlantıyı kontrol edip tekrar dene.' : (e && e.message) || String(e); DAN.step = 'form'; }
  finally { DAN.busy = false; danRedraw(true); }
}
function danDone(text, meta){
  const P = danParse(text);
  if (!P.data && !P.pre) { DAN.err = 'Cevap okunamadı.'; DAN.step = DAN.step === 'paste' ? 'paste' : 'form'; return; }
  const res = {id: 'a' + Date.now().toString(36), at: new Date().toISOString(), sp: DAN.sp, loc: DAN.loc, lay: DAN.lay, rid: DAN.rid, prov: meta.prov, model: meta.model || '', cost: meta.cost, searches: meta.searches || 0,
    secs: Math.round((Date.now() - (DAN.t0 || Date.now())) / 1000), pre: P.pre.slice(0, 4000), data: P.data, src: (meta.src || []).slice(0, 14), entry: meta.entry ? String(meta.entry).slice(0, 20000) : null};
  DAN.res = res; DAN.step = 'res';
  S.advice = [res].concat((S.advice || []).filter(x => x.id !== res.id)).slice(0, 6); persist();
}
function danRedraw(top){ if (ui.sheet !== 'danisman') return; openMore('danisman', true); if (top) { const sh = $('sheet'); if (sh) sh.scrollTop = 0; } }

// ---- alışveriş listesi ve envanter
const DAN_KIND = {kamis: 'rod', makine: 'reel', ana_ip: 'line', lider: 'line', igne: 'hook', terminal: 'term', kursun: 'term', jig: 'lure', yem: 'bait', aksesuar: 'ekip', dugum_aleti: 'ekip', hazir_rig: 'term', diger: 'ekip'};
function danOlcuTxt(o){
  const ol = o.olcu || {}, out = [];
  if (ol.boy_cm) out.push(fmtNum(ol.boy_cm / 100, 2) + ' m');
  if (ol.max_g || ol.min_g) out.push(ol.min_g && ol.max_g ? ol.min_g + '–' + ol.max_g + ' g' : 'en fazla ' + (ol.max_g || ol.min_g) + ' g');
  if (ol.pe) out.push('PE ' + String(ol.pe).replace(/^pe\s*/i, ''));
  if (ol.lb) out.push(ol.lb + ' lb'); if (ol.mm) out.push(fmtNum(ol.mm, 2) + ' mm');
  if (ol.igne_no) out.push(String(ol.igne_no)); if (ol.agirlik_g) out.push(ol.agirlik_g + ' g'); if (ol.makine_boy) out.push('boy ' + ol.makine_boy);
  if (ol.yuva) out.push(ol.yuva);
  return out.join(' · ');
}
function danForTxt(res){ const s = spById(res.sp); return (s ? s.name.replace(/\s*\(.*?\)/, '') : 'Takım') + ' · takım danışmanı'; }
// v0.29.5: önerideki her mağaza ayrı düğme; mağazanın kendi aramasında ürün adı aranır (bilinmeyen mağaza: Google'da mağaza + ürün)
const STORE_Q = [[/hepsiburada/i, 'Hepsiburada', 'https://www.hepsiburada.com/ara?q='], [/trendyol/i, 'Trendyol', 'https://www.trendyol.com/sr?q='],
  [/amazon/i, 'Amazon', 'https://www.amazon.com.tr/s?k='], [/\bn11\b/i, 'n11', 'https://www.n11.com/arama?q='], [/akak[cç]e/i, 'Akakçe', 'https://www.akakce.com/arama/?q='],
  [/cimri/i, 'Cimri', 'https://www.cimri.com/arama?q='], [/ptt\s*avm/i, 'PttAVM', 'https://www.pttavm.com/arama?q='], [/epey/i, 'Epey', 'https://www.epey.com/ara/?q=']];
function storeLinks(nerede, q, url){
  const parts = [...new Set(String(nerede || '').split(/\s*(?:,|·|;|\/|\+|\bve\b|\bveya\b)\s*/i).map(s => s.trim()).filter(s => s && s.length < 40))].slice(0, 6);
  const a = parts.map(p => { const k = STORE_Q.find(([rx]) => rx.test(p)), u = k ? k[2] + encodeURIComponent(q) : 'https://www.google.com/search?q=' + encodeURIComponent(q + ' ' + p);
    return '<a class="storeln" href="' + esc(u) + '" target="_blank" rel="noopener">' + icRaw('cart') + esc(k ? k[1] : p) + '</a>'; });
  if (url) a.push('<a class="storeln pg" href="' + esc(url) + '" target="_blank" rel="noopener">Ürün sayfası</a>');
  return a.length ? '<div class="stores">' + a.join('') + '</div>' : '';
}
function danShop(res, i){
  const o = res.data.oneriler[i]; if (!o) return;
  const k = 'dan:' + slugTR(danItName(o)).slice(0, 50);
  S.shopX = S.shopX || {};
  S.shopX[k] = {k, item: null, size: danOlcuTxt(o), name: danItName(o), store: null, kind: DAN_KIND[o.kategori] || 'ekip', sp: null, for: [danForTxt(res)],
    dan: {o, sp: res.sp}, added: new Date().toISOString()};
  persist(); renderAll(); toast(danItName(o) + ' alışveriş listesine eklendi');
}
function danInvCat(o){
  const t = trLower(danItName(o) + ' ' + (o.neden || ''));
  switch (o.kategori) {
    case 'kamis': return 'rod'; case 'makine': return 'reel'; case 'igne': return 'hook'; case 'kursun': return 'sinker';
    case 'ana_ip': return /örgü|orgu|braid|x8|x4|pe\b|8 ?kat/.test(t) || (o.olcu && o.olcu.pe) ? 'braid' : 'mono';
    case 'lider': return /floro|fluoro|\bfc\b|karbon/.test(t) ? 'fc' : 'mono';
    case 'jig': return /jig|zoka|inchiku|egi|rubber/.test(t) ? 'jig' : 'lure';
    case 'yem': return /sahte|silikon|minnow|popper/.test(t) ? 'lure' : 'bait';
    case 'terminal': case 'hazir_rig': return 'terminal';
    default: return 'ekip';
  }
}
function danToInv(o, note){
  const cat = danInvCat(o), ol = o.olcu || {}, nm = danItName(o);
  const id = 'u-' + (slugTR(nm).slice(0, 40) || 'kalem') + '-' + Math.random().toString(36).slice(2, 6);
  const sizes = cat === 'hook' && ol.igne_no ? [String(ol.igne_no)] : cat === 'sinker' && ol.agirlik_g ? [ol.agirlik_g + ' g'] : [];
  const it = {id, cat, brand: o.marka || '', model: o.model || '', name: nm, pattern: '', spec: danOlcuTxt(o), note: note || ('Takım danışmanı' + (o.fiyat_tl ? ' · ≈ ' + o.fiyat_tl + ' TL' : '')),
    sizes, stock: Object.fromEntries((sizes.length ? sizes : ['-']).map(s => [s, 'var'])), src: 'kullanici', created: new Date().toISOString()};
  if (cat === 'hook') { const p = patOf(it); if (p) it.pattern = KB.PAT[p].name; }
  if (cat === 'rod') { const r = danRodIt(o).rod; it.rod = {type: r.type || 'tekne', len: r.len || null, max: r.max || null, pe: r.pe || null}; if (r.seat) it.rod.seat = r.seat; }
  if (cat === 'reel') { const r = danReelIt(o).reel; it.reel = {type: r.type || 'spin', size: r.size || null}; }
  S.inv.items[id] = it;
  return it;
}
function danHave(res, i){
  const o = res.data.oneriler[i]; if (!o) return;
  const it = danToInv(o);
  const k = 'dan:' + slugTR(danItName(o)).slice(0, 50); if (S.shopX) delete S.shopX[k];
  persist(); indexAll(); noteRigChanges(true); renderAll(); toast(it.name + ' envantere eklendi (' + CAT_TXT[it.cat] + ')');
  if (ui.sheet === 'danisman') danRedraw();
}
function danShopHave(key){
  const x = (S.shopX || {})[key]; if (!x || !x.dan) return;
  const it = danToInv(x.dan.o); delete S.shopX[key];
  persist(); indexAll(); noteRigChanges(true); renderAll(); openMore('alisveris', true); toast(it.name + ' envantere eklendi');
}

// ---- çizim
const danFit = f => f && f.fit ? fitBadge(f) : '<span class="fitb na">Kontrol yok</span>';
function danKeyBox(p){
  const P = AI_PROV[p]; if (!P || P.manual) return '';
  const m = aiModel(p), custom = !P.models.some(x => x[0] === m);
  return '<div class="dan-key"><p class="note">' + P.help + '</p>' +
    '<label class="f wide">' + esc(P.name) + ' API anahtarı<input id="dn-key" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="' + (aiKey(p) ? '•••• kayıtlı · değiştirmek için yapıştır' : P.ph) + '"></label>' +
    '<div class="seg wrapseg">' + P.models.map(x => '<button class="btn small" type="button" data-dan="model" data-v="' + esc(x[0]) + '" aria-pressed="' + (x[0] === m) + '">' + esc(x[1]) + '</button>').join('') + '</div>' +
    '<label class="f wide">Model adı (isteğe bağlı; yeni bir model çıktıysa yaz)<input id="dn-model" autocomplete="off" autocapitalize="none" spellcheck="false" value="' + esc(custom ? m : '') + '" placeholder="' + esc(P.models[0][0]) + '"></label>' +
    '<p class="note">' + esc(P.cost) + '</p>' +
    '<div class="row"><button class="btn primary small" type="button" data-dan="savekey">Kaydet</button>' + (aiKey(p) ? '<button class="btn small" type="button" data-dan="delkey">Anahtarı sil</button>' : '') + '</div></div>';
}
function danProvBox(){
  const p = aiProv(), P = AI_PROV[p];
  const st = P.manual ? 'Anahtar gerekmez: soru kopyalanır, istediğin yapay zekâya yapıştırırsın, cevabı buraya geri yapıştırırsın.' : aiKey(p) ? 'Anahtar kayıtlı · model ' + aiModelName(p, aiModel(p)) : 'Anahtar yok: aşağıdan gir.';
  return '<section class="set"><h4>Yapay zekâ</h4><div class="seg wrapseg dan-prov">' + Object.keys(AI_PROV).map(k => '<button class="btn small" type="button" data-dan="prov" data-v="' + k + '" aria-pressed="' + (k === p) + '">' + esc(AI_PROV[k].name) + (AI_PROV[k].key && aiKey(k) ? ' ✓' : '') + '</button>').join('') + '</div>' +
    '<p class="note"><b>' + esc(P.name) + '</b> · ' + esc(P.by) + '. ' + esc(st) + '</p>' +
    (P.manual ? '' : '<details' + (aiKey(p) ? '' : ' open') + '><summary class="note">Bağlantı ayarları</summary>' + danKeyBox(p) + '</details>') + '</section>';
}
function sheetDan(){
  // Daha menüsünden doğrudan açılınca varsayılanlar
  if (!DAN.cats) DAN.cats = DAN_CATS.map(c => c[0]);
  if (!DAN.loc || !S.locations[DAN.loc]) { const L0 = loc(); DAN.loc = L0 && locKind(L0) !== 'kara' ? L0.id : (danLocs()[0] || {}).id || null; DAN.note = DAN.loc ? (S.locations[DAN.loc].mera || '') : ''; }
  if (!DAN.sp) DAN.sp = ((S.targets || [])[0] || {}).like || ((S.targets || [])[0] || {}).id || null;
  if (DAN.view) { const r = (S.advice || []).find(x => x.id === DAN.view); if (r) return danResHtml(r, true); DAN.view = null; }
  if (DAN.step === 'res' && DAN.res) return danResHtml(DAN.res, false);
  const s = spById(DAN.sp), L = S.locations[DAN.loc];
  const sps = KB.SPECIES.slice().sort((a, b) => trCmp(a.name, b.name));
  const tg = new Set((S.targets || []).map(t => t.like || t.id));
  const lays = s ? danLays(s) : [];
  const rg = DAN.step === 'busy' ? null : danRig();
  const busy = DAN.step === 'busy';
  const head = sheetBar('Takım danışmanı', (S.advice || []).length && !busy ? '<button class="btn" type="button" data-dan="hist">Geçmiş</button>' : '');
  if (busy) return head + '<div class="stack dan"><div class="dan-busy"><b>' + esc(AI_PROV[aiProv()].name) + ' internette arıyor…</b><p class="note">Türkiye’deki mağazalardan güncel modeller, ölçüler ve fiyatlar toplanıyor. Bu 30 saniye ile 3 dakika sürebilir; sayfayı kapatma.</p></div></div>';
  if (DAN.step === 'paste') return head + danPasteHtml();
  const sea = L ? danSea(L) : null;
  const seaTxt = L ? [(Object.fromEntries(KB.REGIONS)[regionOf(L)] || 'Ege') + ' Denizi', L.depth ? 'derinlik ' + L.depth + ' m' : '', sea && sea.cur != null ? 'akıntı en çok ' + f1(sea.cur) + ' kn' : '', sea && sea.sst != null ? 'su ' + tempTxt(sea.sst, true) : ''].filter(Boolean).join(' · ') : '';
  const szChips = s && s.sz ? Object.values(s.sz).map(v => '<button class="bchip" type="button" data-dan="size" data-v="' + esc(v) + '">' + esc(v) + '</button>').join('') : '';
  return head + '<div class="stack dan">' +
    '<p class="sub">Yapay zekâ internette Türkiye’de satılan güncel ürünleri arar; hedefine, noktana ve elindeki takıma göre bir öneri tablosu yapar. Uygulamanın motoru her satırı ölçüsüyle kontrol eder; beğendiğini alışveriş listesine ya da aldıysan envantere eklersin.</p>' +
    (DAN.err ? '<div class="banner bad">' + esc(DAN.err) + '</div>' : '') +
    '<section class="set"><h4>Hedef</h4><div class="fields">' +
      '<label class="f wide">Tür<select id="dn-sp" data-danchg="sp"><option value="">Seç…</option>' + sps.map(x => '<option value="' + esc(x.id) + '"' + (x.id === DAN.sp ? ' selected' : '') + '>' + esc(x.name + (tg.has(x.id) ? ' ★' : '')) + '</option>').join('') + '</select></label>' +
      '<label class="f wide">Hedef boy / ağırlık<input id="dn-size" value="' + esc(DAN.size) + '" placeholder="Ör. 30–150 kg"></label></div>' +
      (szChips ? '<div class="uq">' + szChips + '</div>' : '') + '</section>' +
    '<section class="set"><h4>Nokta</h4><div class="fields">' +
      '<label class="f wide">Nokta<select id="dn-loc" data-danchg="loc">' + danLocs().map(x => '<option value="' + esc(x.id) + '"' + (x.id === DAN.loc ? ' selected' : '') + '>' + esc(locLabel(x)) + '</option>').join('') + '</select></label>' +
      '<label class="f wide">Mera notu (yapay zekâya gider; noktaya kaydedilir)<input id="dn-note" value="' + esc(DAN.note) + '" placeholder="Ör. balık çiftliklerinin kenarı, 60–80 m, akıntılı"></label></div>' +
      (seaTxt ? '<p class="note">' + esc(seaTxt) + '</p>' : '') + '</section>' +
    (lays.length ? '<section class="set"><h4>Teknik</h4><div class="seg wrapseg"><button class="btn small" type="button" data-dan="lay" data-v="" aria-pressed="' + !DAN.lay + '">Sen öner</button>' +
      lays.map(l => '<button class="btn small" type="button" data-dan="lay" data-v="' + l + '" aria-pressed="' + (DAN.lay === l) + '">' + esc(KB.LAY[l].name) + '</button>').join('') + '</div>' +
      (rg ? '<p class="note">Motorun kuralları: ' + esc(danRules(rg).slice(0, 4).join(' · ')) + '</p>' : '') + '</section>' : '') +
    '<section class="set"><h4>Ne lazım?</h4><div class="uq">' + DAN_CATS.map(([k, t]) => '<button class="bchip" type="button" data-dan="cat" data-v="' + k + '" aria-pressed="' + DAN.cats.includes(k) + '">' + esc(t) + '</button>').join('') + '</div></section>' +
    '<section class="set"><h4>Bütçe ve kapsam</h4><div class="fields"><label class="f">Bütçe (TL)<input id="dn-budget" inputmode="numeric" value="' + esc(DAN.budget) + '" placeholder="Ör. 10000"></label></div>' +
      '<label class="row note chk"><input type="checkbox" id="dn-tr"' + (DAN.tr ? ' checked' : '') + '> Yalnız Türkiye’de satılan ürünler</label>' +
      '<label class="row note chk"><input type="checkbox" id="dn-own"' + (DAN.own ? ' checked' : '') + '> Elimdeki takımı da değerlendir (envanterdeki kamış, makine, ip ve iğneler gider)</label></section>' +
    danProvBox() +
    '<div class="row"><button class="btn primary" type="button" data-dan="go">' + (AI_PROV[aiProv()].manual ? 'Soruyu kopyala' : 'Öneri iste') + '</button></div>' +
    '<p class="note">Giden: tür ve hedef boy, nokta adı ve mera notu, derinlik, dip, akıntı ve su sıcaklığı, motorun kuralları' + (DAN.own ? ', envanterdeki takım' : '') + '. Koordinat gitmez. Öneriler genel tavsiyedir; fiyat ve stok mağazada değişebilir.</p>' +
    danHistHtml(3) + '</div>';
}
function danPasteHtml(){
  const pr = DAN.prompt || danPrompt(), full = pr.sys + '\n\n' + pr.user;
  return '<div class="stack dan">' + (DAN.err ? '<div class="banner bad">' + esc(DAN.err) + '</div>' : '') +
    '<section class="set"><h4>1 · Soruyu yapay zekâna yapıştır</h4><p class="note">Soru panoya kopyalandı. Aşağıdan birini aç, yazı kutusuna yapıştır ve gönder. Sorarsa cevapla; sonunda bir tablo ve bir JSON kod bloğu yazacak.</p>' +
      '<div class="row wrap">' + MANUAL_LINKS.map(([t, u]) => '<a class="btn small" href="' + u + '" target="_blank" rel="noopener">' + esc(t) + '</a>').join('') + '<button class="btn small" type="button" data-dan="copy">Yeniden kopyala</button></div>' +
      '<p class="note">Google AI soruyu uzun bulursa “Elimdeki takımı da değerlendir” kutusunu kapatıp yeniden kopyala.</p><details><summary class="note">Soruyu göster</summary><textarea class="dan-prompt" rows="8" readonly>' + esc(full) + '</textarea></details></section>' +
    '<section class="set"><h4>2 · Cevabı buraya yapıştır</h4><p class="note">Cevabın tamamını kopyala (Google AI Modu’nda cevabın altındaki kopyala düğmesi) ve buraya yapıştır. JSON yoksa tablolar okunur.</p>' +
      '<label class="f wide"><textarea id="dn-paste" rows="7" placeholder="Cevabı buraya yapıştır"></textarea></label>' +
      '<div class="row"><button class="btn primary" type="button" data-dan="read">Cevabı oku</button><button class="btn" type="button" data-dan="form">Geri</button></div></section></div>';
}
function danHistHtml(max){
  const H = S.advice || []; if (!H.length) return '';
  return '<section class="set"><h4>Son öneriler</h4>' + H.slice(0, max || 6).map(r => '<button class="mrow" type="button" data-dan="view" data-v="' + esc(r.id) + '"><span><b>' + esc(spName(r.sp) || 'Takım') + (r.loc && S.locations[r.loc] ? ' · ' + esc(locLabel(S.locations[r.loc])) : '') + '</b><small>' +
    esc(fmtDT(new Date(r.at)) + ' · ' + (AI_PROV[r.prov] ? AI_PROV[r.prov].name : r.prov) + (r.model ? ' · ' + r.model : '') + ' · ' + ((r.data && r.data.oneriler) || []).length + ' öneri') + '</small></span></button>').join('') + '</section>';
}
function danResHtml(res, old){
  const d = res.data || {oneriler: [], sorular: [], eldeki: [], uyarilar: [], kaynaklar: []};
  const rg = res.rid && RIGS[res.rid] ? RIGS[res.rid] : (() => { const sv = {sp: DAN.sp, lay: DAN.lay, rid: DAN.rid}; DAN.sp = res.sp; DAN.lay = res.lay; DAN.rid = null; const r = danRig(); Object.assign(DAN, sv); return r; })();
  const own = danOwn(rg), ctx = own.ctx;
  const s = spById(res.sp), L = S.locations[res.loc];
  const meta = [AI_PROV[res.prov] ? AI_PROV[res.prov].name : res.prov, res.model, res.searches ? res.searches + ' arama' : '', res.secs ? res.secs + ' sn' : '', res.cost != null ? '≈ $' + (res.cost < 0.01 ? res.cost.toFixed(3) : res.cost.toFixed(2)).replace('.', ',') : ''].filter(Boolean).join(' · ');
  const inShop = o => !!(S.shopX || {})['dan:' + slugTR(danItName(o)).slice(0, 50)];
  let h = sheetBar(old ? 'Önceki öneri' : 'Öneri tablosu', '<button class="btn" type="button" data-dan="form">Yeni soru</button>') + '<div class="stack dan">';
  h += '<p class="sub">' + esc((s ? s.name : 'Takım') + (L ? ' · ' + locLabel(L) : '') + ' · ' + fmtDT(new Date(res.at))) + '</p><p class="note">' + esc(meta) + '</p>';
  if (d.ozet || res.pre) h += '<section class="set dan-ozet">' + mdLite(d.ozet || res.pre.replace(/```[\s\S]*$/, '').slice(0, 1800)) + '</section>';
  if (!res.data) h += '<div class="banner bad">Öneri tablosu okunamadı; yapay zekânın cevabı yukarıda. Tekrar sor ya da cevabı “Kopyala–yapıştır” ile oku.</div>';
  if (d.sorular && d.sorular.length && !old) h += '<section class="set"><h4>Yapay zekânın soruları</h4><p class="note">Cevaplarsan öneri senin durumuna göre yenilenir.</p>' +
    d.sorular.map((q, i) => '<label class="f wide">' + esc(q) + '<input data-danq="q' + i + '" value="' + esc(DAN.ans['q' + i] || '') + '"></label>').join('') +
    '<div class="row"><button class="btn primary small" type="button" data-dan="again">Cevapla, yeniden öner</button></div></section>';
  // elindeki takım: motor + yapay zekâ
  if (own.rods.length || own.reels.length || (d.eldeki || []).length) {
    h += '<section class="set"><h4>Elindeki takım</h4>';
    if (rg) h += '<p class="note"><b>Motor</b> (' + esc(KB.LAY[rg.lay] ? KB.LAY[rg.lay].name : 'bu rig') + ', ' + esc(rodReqTxt(danNeed(rg))) + '):</p>' +
      own.rods.slice(0, 3).concat(own.reels.slice(0, 3)).map(f => '<div class="dan-own"><span>' + esc(f.it.name) + '</span>' + fitBadge(f) + (f.why.length || f.warn.length ? '<small>' + esc(f.why.concat(f.warn).join('; ')) + '</small>' : '') + '</div>').join('');
    if ((d.eldeki || []).length) h += '<p class="note" style="margin-top:8px"><b>' + esc(AI_PROV[res.prov] ? AI_PROV[res.prov].name : 'Yapay zekâ') + '</b>:</p>' +
      d.eldeki.map(x => '<div class="dan-own"><span>' + esc(x.ad) + '</span><span class="fitb ' + x.karar + '">' + FIT_TXT[x.karar] + '</span>' + (x.neden ? '<small>' + esc(x.neden) + '</small>' : '') + '</div>').join('');
    h += '</section>';
  }
  // öneriler kategori kategori
  const cats = DAN_CATS.map(c => c[0]).concat(['jig', 'yem', 'diger']);
  const by = {}; (d.oneriler || []).forEach((o, i) => { (by[o.kategori] = by[o.kategori] || []).push([o, i]); });
  cats.filter(c => by[c]).forEach(c => {
    h += '<section class="set"><h4>' + esc(DAN_CAT_TXT[c] || c) + '</h4>' + by[c].map(([o, i]) => {
      const f = danCheck(o, rg, ctx), olc = danOlcuTxt(o);
      return '<div class="dan-o' + (f && f.fit === 'bad' ? ' bad' : '') + '"><div class="h"><b>' + esc(danItName(o)) + '</b>' + (o.seviye ? '<span class="chip">' + esc(o.seviye) + '</span>' : '') + (f ? danFit(f) : '') + '</div>' +
        (olc ? '<div class="olc mono">' + esc(olc) + '</div>' : '') + (o.neden ? '<p>' + esc(o.neden) + '</p>' : '') +
        (f && f.why.length ? '<p class="mot"><b>Motor:</b> ' + esc(f.why.join('; ')) + '</p>' : '') +
        '<div class="meta">' + [o.fiyat_tl ? '≈ ' + esc(o.fiyat_tl) + (/tl/i.test(o.fiyat_tl) ? '' : ' TL') : ''].filter(Boolean).join(' · ') + '</div>' + storeLinks(o.nerede, danItName(o), o.url) +
        '<div class="row">' + (inShop(o) ? '<span class="chip A">listede</span>' : '<button class="btn small" type="button" data-dan="shop" data-i="' + i + '" data-r="' + esc(res.id) + '">Alışveriş listesine ekle</button>') +
        '<button class="btn small" type="button" data-dan="have" data-i="' + i + '" data-r="' + esc(res.id) + '">Aldım, envantere ekle</button></div></div>';
    }).join('') + '</section>';
  });
  if ((d.uyarilar || []).length) h += '<section class="set"><h4>Uyarılar</h4><ul class="dan-ul">' + d.uyarilar.map(u => '<li>' + esc(u) + '</li>').join('') + '</ul></section>';
  const src = (res.src || []).concat((d.kaynaklar || []).filter(k => !(res.src || []).some(x => x.u === k.u))).slice(0, 16);
  if (src.length) h += '<section class="set"><h4>Kaynaklar</h4><ul class="dan-ul">' + src.map(x => '<li><a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(String(x.t).slice(0, 90)) + '</a></li>').join('') + '</ul></section>';
  if (res.entry) h += '<section class="set"><h4>Google Arama önerileri</h4><iframe class="dan-gs" sandbox="allow-popups allow-popups-to-escape-sandbox" title="Google Arama önerileri" srcdoc="' + esc('<base target="_blank">' + res.entry) + '"></iframe></section>';
  h += '<p class="note">Motor rozetleri: <b>Uygun</b> ölçü bu rige uyuyor; <b>Sınırda</b> uyar ama zorlanır; <b>Uygun değil</b> ölçü yetmiyor ya da takım uyuşmuyor; <b>Kontrol yok</b> ölçü yazılmamış. Fiyat ve stok mağazada değişir; almadan önce ürün sayfasından ölçüyü doğrula.</p>';
  if (old) h += '<div class="row"><button class="btn small" type="button" data-dan="del" data-v="' + esc(res.id) + '" style="color:var(--D)">Bu öneriyi sil</button></div>';
  return h + '</div>';
}
const danResById = id => (DAN.res && DAN.res.id === id ? DAN.res : null) || (S.advice || []).find(x => x.id === id) || null;
function danAct(a, d){
  if (a !== 'savekey' && a !== 'delkey') danRead();
  if (a === 'go' || a === 'copy' && !DAN.prompt) { danAsk(); return; }
  if (a === 'copy') { const pr = DAN.prompt; navigator.clipboard.writeText(pr.sys + '\n\n' + pr.user).then(() => toast('Soru kopyalandı'), () => toast('Soruyu gösterip seçerek kopyala')); return; }
  if (a === 'read') { const t = ($('dn-paste') || {}).value || ''; if (t.trim().length < 20) { toast('Cevabı yapıştır'); return; } DAN.t0 = Date.now(); DAN.err = null; DAN.step = 'paste';
    danDone(t, {prov: 'elle', model: '', src: []}); danRedraw(true); return; }
  if (a === 'again') { const p = aiProv(); if (AI_PROV[p].manual) { DAN.step = 'form'; danAsk(); return; } danAsk(); return; }
  if (a === 'form') { DAN.step = 'form'; DAN.view = null; DAN.err = null; danRedraw(true); return; }
  if (a === 'hist') { DAN.step = 'form'; DAN.view = null; danRedraw(); setTimeout(() => { const el = document.querySelector('#sheet .dan .set:last-of-type'); if (el) el.scrollIntoView({block: 'start'}); }, 50); return; }
  if (a === 'view') { DAN.view = d.v; danRedraw(true); return; }
  if (a === 'del') { S.advice = (S.advice || []).filter(x => x.id !== d.v); persist(); DAN.view = null; DAN.step = 'form'; danRedraw(true); toast('Öneri silindi'); return; }
  if (a === 'lay') { DAN.lay = d.v || ''; danRedraw(); return; }
  if (a === 'size') { DAN.size = d.v; danRedraw(); return; }
  if (a === 'cat') { const i = DAN.cats.indexOf(d.v); if (i >= 0) DAN.cats.splice(i, 1); else DAN.cats.push(d.v); danRedraw(); return; }
  if (a === 'prov') { lsSet(LSD.prov, d.v); DAN.err = null; danRedraw(); return; }
  if (a === 'model') { const p = aiProv(); lsSet(AI_PROV[p].mkey, d.v); danRedraw(); return; }
  if (a === 'savekey') { const p = aiProv(), P = AI_PROV[p]; const v = (($('dn-key') || {}).value || '').trim(), m = (($('dn-model') || {}).value || '').trim();
    if (m) lsSet(P.mkey, m);
    if (v) { if (!P.rx.test(v)) { toast('Anahtar “' + P.ph.replace('…', '') + '” ile başlamalı'); return; } lsSet(P.key, v); toast(P.name + ' anahtarı bu cihaza kaydedildi'); }
    else toast(m ? 'Model kaydedildi' : aiKey(p) ? 'Anahtar aynı kaldı' : 'Anahtarı yapıştır');
    DAN.err = null; danRedraw(); return; }
  if (a === 'delkey') { const p = aiProv(); lsDel(AI_PROV[p].key); toast('Anahtar silindi'); danRedraw(); return; }
  const res = d.r ? danResById(d.r) : null;
  if (a === 'shop' && res) { danShop(res, +d.i); danRedraw(); return; }
  if (a === 'have' && res) { danHave(res, +d.i); return; }
}
function danChange(k){ danRead(); if (k === 'sp') { DAN.size = ''; DAN.ans = {}; } danRedraw(); }
