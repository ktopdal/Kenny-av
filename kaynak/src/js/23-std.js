// ---------------------------------------------------------------- 23 · standart listeler ve yem katmanı
// Herkesin envanterinde hazır duran kalemler, varsayılanı "yok": iğne markaları ve boyları, jig ve zokalar, terminal, kurşun gramajları,
// ölü ve canlı yemler. Kullanıcı elindekini işaretler; aynı kalem kendi envanterinde ya da özel pakette varsa standart olan gizlenir.
// Boylar ve gramajlar genel bilgidir; marka kataloğuna göre değişebilir.
const STD_SZ = {
  jp6: ['No:1', 'No:2', 'No:3', 'No:4', 'No:5', 'No:6'],
  oct: ['#8', '#6', '#4', '#2', '1', '1/0', '2/0', '3/0', '4/0', '5/0'],
  circ: ['#4', '#2', '1', '1/0', '2/0', '3/0', '4/0', '5/0'],
  bigc: ['3/0', '4/0', '5/0', '6/0', '7/0', '8/0', '10/0'],
  jf: ['#2', '1', '1/0', '2/0', '3/0', '4/0', '5/0', '6/0'],
  bh: ['#10', '#8', '#6', '#4', '#2', '1', '1/0', '2/0'],
  ab: ['#12', '#10', '#8', '#6', '#4', '#2', '1', '1/0'],
  lb: ['#4', '#2', '1', '1/0', '2/0', '3/0', '4/0', '5/0'],
  as: ['1/0', '2/0', '3/0', '4/0', '5/0', '7/0'],
  jh: ['#8', '#6', '#4', '#2', '1'],
  tr: ['#10', '#8', '#6', '#4', '#2', '1', '1/0'],
  euro: ['#10', '#8', '#6', '#4', '#2', '1'],
  sb: ['#14', '#12', '#10', '#8', '#6', '#4'],
  egi: ['1,8', '2,0', '2,5', '3,0', '3,5'],
  gsj: ['80 g', '100 g', '120 g', '150 g', '180 g', '200 g', '250 g'],
  gtr: ['60 g', '80 g', '100 g', '120 g', '150 g'],
  gin: ['80 g', '100 g', '120 g', '150 g', '200 g'],
  gmj: ['10 g', '20 g', '30 g', '40 g', '60 g'],
  gbj: ['200 g', '250 g', '300 g', '400 g'],
  g1: ['20 g', '30 g', '50 g', '80 g', '100 g', '120 g', '150 g', '180 g', '200 g', '250 g'],
  gz: ['10 g', '20 g', '30 g', '50 g', '80 g', '100 g', '150 g'],
  gp: ['60 g', '80 g', '100 g', '120 g', '150 g'],
  gc: ['80 g', '100 g', '120 g', '150 g', '180 g'],
};
// yem grupları ve sahte yem tipleri (rig yuvası sahte yemi bu tiple eşleştirir)
const BAIT_GRP = {kurt: 'Kurt ve kabuklu', balik: 'Kalamar ve balık', canli: 'Canlı yem', diger: 'Diğer'};
const LURE_OK = {egi: ['egi', 'kalamarcapari'], ahtapot: ['ahtapot', 'egi'], slowjig: ['slowjig', 'jig'], tairubber: ['tairubber'], inchiku: ['inchiku'], sabiki: ['sabiki'],
  minnow: ['minnow'], metal: ['metal'], soft: ['soft'], trolling: ['trolling'], bigtroll: ['trolling'], popper: ['popper'], bigjig: ['bigjig', 'jig', 'slowjig'], samandira: ['samandira']};
const STD = (() => {
  const out = [];
  const add = o => out.push(Object.assign({std: true, src: 'std', brand: '', model: '', spec: '', note: '', pattern: '', sizes: []}, o));
  // iğneler: marka, model, desen, boylar
  [['Gamakatsu', 'Hyper Chinu', 'chinu', 'jp6'], ['Gamakatsu', 'Chinu', 'chinu', 'jp6'], ['Owner', 'Cut Super Chinu', 'chinu', 'jp6'], ['Owner', 'Cutting Point Chinu', 'chinu', 'jp6'],
    ['BKK', 'Chinu-R', 'chinu', 'jp6'], ['Sasame', 'Chinu', 'chinu', 'jp6'], ['Hayabusa', 'Chinu', 'chinu', 'jp6'], ['Fudo', 'Chinu', 'chinu', 'jp6'],
    ['Gamakatsu', 'Iseama', 'iseama', 'jp6'], ['Owner', 'Iseama', 'iseama', 'jp6'], ['Sasame', 'Iseama', 'iseama', 'jp6'],
    ['BKK', 'Maruseigo-R', 'maruseigo', 'euro'],
    ['Owner', 'SSW Cutting Point', 'octopus', 'oct'], ['BKK', 'Octopus Beak', 'octopus', 'oct'], ['Gamakatsu', 'Octopus', 'octopus', 'oct'], ['Sasame', 'Beak', 'octopus', 'oct'],
    ['Mustad', 'Ultrapoint Beak', 'octopus', 'oct'], ['VMC', 'Octopus', 'octopus', 'oct'],
    ['Owner', 'Mutu Light Circle', 'circle', 'circ'], ['BKK', 'Mutsu Circle Light-SS', 'circle', 'circ'], ['Gamakatsu', 'Octopus Circle', 'circle', 'circ'], ['Hayabusa', 'Mutsu Circle', 'circle', 'circ'],
    ['Owner', 'Super Mutu Circle', 'circle', 'bigc'], ['Mustad', 'Demon Perfect Circle', 'circle', 'bigc'],
    ['Owner', 'Gorilla', 'jforged', 'jf'], ['Owner', 'Ringed Gorilla (5105R)', 'jforged', 'jf'], ['Owner', 'Jobu', 'jforged', 'jf'],
    ['Gamakatsu', 'Baitholder', 'baitholder', 'bh'], ['BKK', 'Beak Baitholder-R', 'baitholder', 'bh'], ['Mustad', 'Baitholder', 'baitholder', 'bh'],
    ['Kamasan', 'B940 Aberdeen', 'aberdeen', 'ab'], ['Mustad', 'Aberdeen', 'aberdeen', 'ab'],
    ['Gamakatsu', 'Live Bait', 'livebait', 'lb'], ['Owner', 'Mosquito', 'livebait', 'lb'], ['Mustad', 'Hoodlum', 'livebait', 'lb'],
    ['BKK', 'Lone Fighter Assist', 'assist', 'as'], ['Owner', 'Jigging Assist (çift)', 'assist', 'as'], ['Decoy', 'Assist', 'assist', 'as'],
    ['Owner', 'Cultiva Jighead', 'jighead', 'jh'], ['Decoy', 'Jighead', 'jighead', 'jh'],
    ['Owner', 'ST-36 üçlü', 'treble', 'tr'], ['BKK', 'Üçlü (treble)', 'treble', 'tr'], ['VMC', 'Üçlü (treble)', 'treble', 'tr'],
  ].forEach(([brand, model, pat, sz]) => {
    const name = brand + ' ' + model; const kb = KB.HOOK[pat] || {};
    add({id: 'std:h:' + slugTR(name), cat: 'hook', brand, model, name, pattern: KB.PAT[pat].name, pat, sizes: STD_SZ[sz], grp: KB.PAT[pat].name,
      rank: kb.turkiye && trLower(kb.turkiye).indexOf(trLower(name)) >= 0 ? 0 : kb.dunya === name ? 1 : 2});
  });
  // jig, zoka ve sahte yem
  [['jig', 'Çapari takımı', 'sabiki', 'sb', 'İstavrit, kolyoz, uskumru'], ['jig', 'Kalamar çaparisi', 'kalamarcapari', null, 'Gece ışıkta kalamar'],
    ['jig', 'Egi (kalamar zokası)', 'egi', 'egi', 'Boy numarası'], ['jig', 'Ahtapot zokası', 'ahtapot', null, ''],
    ['jig', 'Slow jig', 'slowjig', 'gsj', ''], ['jig', 'Tai rubber', 'tairubber', 'gtr', ''], ['jig', 'Inchiku', 'inchiku', 'gin', ''],
    ['jig', 'Metal jig (atma)', 'metal', 'gmj', 'Spin, kıyıdan atma'], ['jig', 'Ağır jig', 'bigjig', 'gbj', 'Orkinos ve büyük av'],
    ['lure', 'Maket balık (minnow)', 'minnow', null, 'Levrek, lüfer, akya'], ['lure', 'Silikon yem (LRF / shad)', 'soft', null, ''],
    ['lure', 'Popper / stickbait', 'popper', null, ''], ['lure', 'Sırtı yemi (trolling)', 'trolling', null, 'Rapala, kaşık, tüylü çapari'],
  ].forEach(([cat, name, lt, sz, note]) => add({id: 'std:j:' + slugTR(name), cat, name, model: name, lt, sizes: sz ? STD_SZ[sz] : [], grp: cat === 'jig' ? 'Jig ve zoka' : 'Sahte yem', note}));
  // terminal (tt = terminal tipi)
  [['tfirdondu', 'T-fırdöndü (3 yollu)', 'Fırdöndü ve klips'], ['tfirdondub', 'Boncuklu T-fırdöndü', 'Fırdöndü ve klips'], ['firdondu', 'Fırdöndü (düz)', 'Fırdöndü ve klips'],
    ['rulmanli', 'Rulmanlı fırdöndü', 'Fırdöndü ve klips'], ['klipsfirdondu', 'Klipsli fırdöndü', 'Fırdöndü ve klips'], ['klips', 'Hızlı klips (snap)', 'Fırdöndü ve klips'],
    ['splitring', 'Halka (split ring)', 'Fırdöndü ve klips'], ['solidring', 'Kaynaklı halka (solid ring)', 'Fırdöndü ve klips'],
    ['stop', 'Stop boncuk / lastik stoper', 'Boncuk, burç, makaron'], ['boncuk', 'Boncuk (düz / fosforlu)', 'Boncuk, burç, makaron'], ['burc', 'Sıkıştırma burcu (kovan)', 'Boncuk, burç, makaron'],
    ['makaron', 'Makaron (silikon boru)', 'Boncuk, burç, makaron'], ['kursunklips', 'Kurşun klipsi / askısı', 'Boncuk, burç, makaron'], ['boom', 'Kaydırma tüpü (boom)', 'Boncuk, burç, makaron'],
    ['burcpense', 'Burç pensesi', 'Aksesuar'], ['samandira', 'Kaydırmalı şamandıra', 'Aksesuar'], ['starlight', 'Işık çubuğu (starlight)', 'Aksesuar'], ['zil', 'Kamış zili', 'Aksesuar'],
  ].forEach(([tt, name, grp]) => add({id: 'std:t:' + tt, cat: 'terminal', name, model: name, tt, grp}));
  // kurşun, gram boylarıyla
  [['k-armut', 'Armut kurşun', 'g1'], ['k-damla', 'Damla kurşun', 'g1'], ['k-zeytin', 'Zeytin (gezer) kurşun', 'gz'], ['k-piramit', 'Piramit kurşun', 'gp'],
    ['k-capali', 'Çapalı (grip) kurşun', 'gc'], ['k-sacma', 'Saçma kurşun (şamandıra)', null]].forEach(([tt, name, sz]) => add({id: 'std:t:' + tt, cat: 'sinker', name, model: name, tt, sizes: sz ? STD_SZ[sz] : [], grp: 'Kurşun'}));
  // yemler: key, ad, grup, rig/tür metinlerinde aranan sözcükler, canlı mı
  [['mamun', 'Mamun', 'kurt', ['mamun']], ['sulunez', 'Sülünez', 'kurt', ['sülünez']], ['cimcim', 'Çimçim', 'kurt', ['çimçim']],
    ['boru-kurdu', 'Boru kurdu', 'kurt', ['boru kurdu']], ['bibi', 'Bibi (çüçün)', 'kurt', ['bibi', 'çüçün']], ['cin-kurdu', 'Çin kurdu (lugworm)', 'kurt', ['çin kurdu', 'lugworm']],
    ['karides', 'Karides', 'kurt', ['karides']], ['midye', 'Midye', 'kurt', ['midye']], ['yengec', 'Yengeç (pavurya)', 'kurt', ['yengeç', 'pavurya']],
    ['kalamar', 'Kalamar', 'balik', ['kalamar']], ['subye', 'Sübye (mürekkep balığı)', 'balik', ['sübye', 'mürekkep']], ['ahtapot', 'Ahtapot (parça)', 'balik', ['ahtapot']],
    ['sardalya', 'Sardalya', 'balik', ['sardalya']], ['hamsi', 'Hamsi', 'balik', ['hamsi']], ['istavrit', 'İstavrit (parça)', 'balik', ['istavrit']],
    ['gumus', 'Gümüş', 'balik', ['gümüş']], ['uskumru', 'Uskumru / kolyoz (parça)', 'balik', ['uskumru', 'kolyoz']], ['balik-serit', 'Balık şeridi / fileto', 'balik', ['balık şeridi', 'fileto', 'balık parçası']],
    ['canli-istavrit', 'Canlı istavrit', 'canli', ['istavrit'], 1], ['canli-kalamar', 'Canlı kalamar', 'canli', ['kalamar'], 1], ['teke', 'Teke (canlı karides)', 'canli', ['teke', 'karides'], 1],
    ['canli-kefal', 'Canlı kefal', 'canli', ['kefal'], 1], ['canli-zargana', 'Canlı zargana', 'canli', ['zargana'], 1], ['canli-sardalya', 'Canlı sardalya', 'canli', ['sardalya'], 1],
    ['canli-kolyoz', 'Canlı kolyoz / uskumru', 'canli', ['kolyoz', 'uskumru'], 1], ['canli-kupes', 'Canlı kupes / izmarit', 'canli', ['kupes', 'izmarit'], 1],
    ['canli-gumus', 'Canlı gümüş', 'canli', ['gümüş'], 1], ['canli-mezgit', 'Canlı mezgit', 'canli', ['mezgit'], 1],
    ['ekmek', 'Ekmek / hamur', 'diger', ['ekmek', 'hamur']], ['tavuk', 'Tavuk göğsü', 'diger', ['tavuk']],
  ].forEach(([key, name, grp, kw, live]) => add({id: 'std:y:' + key, cat: 'bait', name, model: name, key, grp, kw, live: !!live}));
  return out;
})();
const STD_BAITS = STD.filter(s => s.cat === 'bait');
const STD_BY = Object.fromEntries(STD.map(s => [s.id, s]));
// tür ailelerine uygun yemler (sihirbazda tercih edilen yem bu listedeyse rige alternatif olarak eklenir)
const FAM_BAITS = {sk: ['mamun', 'sulunez', 'cimcim', 'karides', 'midye', 'boru-kurdu'], so: ['mamun', 'sulunez', 'cimcim', 'karides', 'midye', 'yengec', 'boru-kurdu', 'kalamar'],
  sg: ['kalamar', 'sardalya', 'subye', 'canli-kalamar', 'canli-istavrit', 'canli-kupes', 'mamun', 'sulunez'], kaya: ['kalamar', 'sardalya', 'karides', 'mamun', 'yengec', 'balik-serit'],
  yirtici: ['canli-istavrit', 'canli-kefal', 'canli-zargana', 'teke', 'canli-gumus', 'canli-sardalya', 'sardalya', 'kalamar', 'mamun'],
  kum: ['mamun', 'boru-kurdu', 'karides', 'cimcim', 'cin-kurdu', 'kalamar', 'sardalya'], buyukdip: ['canli-istavrit', 'canli-kalamar', 'canli-mezgit', 'kalamar', 'sardalya'],
  kefal: ['ekmek', 'karides', 'mamun'], pelajikk: ['tavuk', 'balik-serit'], pelajikb: ['canli-istavrit', 'canli-sardalya', 'sardalya'], buyuk: ['sardalya', 'canli-istavrit', 'canli-kolyoz', 'kalamar'], kafadan: []};

// ---- terminal ve sahte yem tipleri (kullanıcı ya da paket kalemi için addan çıkarılır)
function termTypes(it){
  if (it.tt) return [it.tt];
  const t = trLower([it.name, it.model, it.spec, it.type].join(' '));
  if (it.cat === 'sinker' || /kurşun/.test(t) && !/klips|askı/.test(t)) {
    const out = [];
    if (/armut/.test(t)) out.push('k-armut'); if (/damla/.test(t)) out.push('k-damla'); if (/zeytin|gezer/.test(t)) out.push('k-zeytin');
    if (/piramit/.test(t)) out.push('k-piramit'); if (/çapalı|grip/.test(t)) out.push('k-capali'); if (/saçma/.test(t)) out.push('k-sacma');
    return out.length ? out : ['k-armut', 'k-damla'];
  }
  if (/boncuklu/.test(t) && /fırdöndü/.test(t)) return ['tfirdondub', 'tfirdondu'];
  if (/t-? ?fırdöndü|üç yollu|3 yollu|cross/.test(t)) return ['tfirdondu'];
  if (/rulmanl/.test(t)) return ['rulmanli'];
  if (/klipsli|fırdöndü ?\+ ?klips|snap swivel/.test(t)) return ['klipsfirdondu'];
  if (/fırdöndü|swivel/.test(t)) return ['firdondu'];
  if (/burç pense|crimp pense/.test(t)) return ['burcpense'];
  if (/burç|crimp|kovan/.test(t)) return ['burc'];
  if (/stop|stoper/.test(t)) return ['stop'];
  if (/boncuk/.test(t)) return ['boncuk'];
  if (/split|halka/.test(t)) return [/kaynaklı|solid/.test(t) ? 'solidring' : 'splitring'];
  if (/klips|snap|fast link/.test(t)) return ['klips'];
  if (/makaron|silikon boru/.test(t)) return ['makaron'];
  if (/boom|kaydırma tüp/.test(t)) return ['boom'];
  if (/şamandıra|samandira/.test(t)) return ['samandira'];
  if (/starlight|ışık çubu|fosfor çubu/.test(t)) return ['starlight'];
  if (/zil/.test(t)) return ['zil'];
  return [];
}
function lureTypeOf(it){
  if (it.lt) return it.lt;
  const t = trLower([it.type, it.model, it.name, it.spec].join(' '));
  if (/çapari|capari|sabiki/.test(t)) return /kalamar/.test(t) ? 'kalamarcapari' : 'sabiki';
  if (/inchiku/.test(t)) return 'inchiku';
  if (/tai ?rubber|bayrubber|kohga/.test(t)) return 'tairubber';
  if (/ahtapot/.test(t)) return 'ahtapot';
  if (/\begi\b|kalamar zoka|egi-oh|aurie/.test(t)) return 'egi';
  if (/slow/.test(t)) return 'slowjig';
  if (/jig ?head/.test(t)) return 'jighead';
  if (/metal|cast|coltsniper|fujin/.test(t)) return 'metal';
  if (/popper|stick/.test(t)) return 'popper';
  if (/magnum|laser|troll|sırtı|kaşık/.test(t)) return 'trolling';
  if (/minnow|rapala|maket|x-rap/.test(t)) return 'minnow';
  if (/silikon|soft|shad|grass/.test(t)) return 'soft';
  if (/şamandıra|samandira/.test(t)) return 'samandira';
  if (/jig/.test(t)) { const g = lureG(it); return g != null && g >= 200 ? 'bigjig' : 'jig'; }
  return null;
}
// eski kayıtlı sistemlerin sahte yem yuvasında tip yok: anahtar sözcüklerden bulunur
const lureTypeFromKw = kw => Object.keys(KB.LURE).find(k => JSON.stringify(KB.LURE[k].kw) === JSON.stringify(kw)) || null;

// ---- standart kalemin görünürlüğü: aynısı paket ya da kullanıcı envanterinde varsa gizlenir
const normNm = s => slugTR(s || '');
function stdHidden(s, own){
  if (s.cat === 'hook') { const n = normNm(s.name); return own.some(i => i.cat === 'hook' && normNm(i.name).indexOf(n) >= 0); }
  if (s.cat === 'bait') return own.some(i => i.cat === 'bait' && baitKey(i.name) === s.key && !!s.live === /canlı/.test(trLower(i.name)));
  if (s.cat === 'terminal' || s.cat === 'sinker') return own.some(i => (i.cat === 'terminal' || i.cat === 'sinker') && termTypes(i).includes(s.tt));
  return false;
}

// ---- yem katmanı: rigler yemden bağımsızdır; yem yalnızca öneridir ve elindeki uygun yem öne çıkar
const LURE_WORDS = /çapari|capari|zoka|\begi\b|sahte|kaşık|rapala|silikon|jig/;
// yem metni → standart yem anahtarı ('*canli' = herhangi bir canlı balık yemi)
function baitKey(text){
  const t = trLower(text || ''); if (!t || LURE_WORDS.test(t)) return null;
  const live = /canlı|teke/.test(t);
  if (live && /canlı balık|canlı yem$/.test(t)) return '*canli';
  const hit = STD_BAITS.find(b => !!b.live === live && b.kw.some(k => t.indexOf(k) >= 0));
  return hit ? hit.key : null;
}
function baitIds(text){
  const t = trLower(text || ''); if (!t || LURE_WORDS.test(t)) return [];
  const key = baitKey(text);
  return Object.values(ITEMS).filter(i => {
    if (i.cat !== 'bait') return false;
    if (i.std) return key === '*canli' ? i.live && i.key !== 'teke' : i.key === key;
    const nm = trLower(i.name); if (t.indexOf(nm) >= 0 || nm.indexOf(t) >= 0) return true;
    const k2 = baitKey(i.name); return !!key && k2 === key;
  }).map(i => i.id);
}
const baitHave = ids => ids.some(i => usable(stockOf(i, '-')));
// rigin yemleri: önce rigin kendi yemleri (ana, alt), sonra hedef türlerin yemleri ve tercih ettiğin uygun yemler
function baitInfo(rg, tier){
  tier = tier || 'envanter';
  const own = [];
  const b = rg.baits;
  if (b) ['ana', 'alt'].forEach(x => { const o = b[x]; const v = o && (o[tier] || o.envanter || o.turkiye || o.dunya); if (v) own.push(v); });
  if (!own.length && rg.baitText) String(rg.baitText).split('·').map(s => s.trim()).filter(Boolean).forEach(s => own.push(s));
  const sp = [];
  (rg.species || []).forEach(id => { const s = SPECIES[id] || KB.SPECIES.find(x => x.id === id); if (!s || !s.b) return;
    const arr = rg.time === 'gece' ? (s.b.n || s.b.g) : rg.time === 'gunduz' ? (s.b.g || s.b.n) : (s.b.g || []).concat(s.b.n || []); (arr || []).forEach(t => sp.push(t)); });
  const fams = new Set((rg.species || []).map(id => (KB.SPECIES.find(x => x.id === id) || {}).fam).filter(Boolean)); if (rg.fam) fams.add(rg.fam);
  const pref = (S.profile.baits || []).filter(k => [...fams].some(f => (FAM_BAITS[f] || []).includes(k))).map(k => (STD_BAITS.find(x => x.key === k) || {}).name).filter(Boolean);
  const seen = new Set(); const list = [];
  const push = (t, src) => { const ids = baitIds(t); const key = ids.length ? ids.slice().sort().join(',') : (baitKey(t) || 'x:' + trLower(t)); if (seen.has(key)) return; seen.add(key);
    list.push({t, ids, st: ids.length ? (baitHave(ids) ? 'var' : 'yok') : null, src, pref: (S.profile.baits || []).includes(baitKey(t))}); };
  own.forEach(t => push(t, 'rig')); sp.forEach(t => push(t, 'tur')); pref.forEach(t => push(t, 'tercih'));
  return list;
}
// karta ve listeye yazılacak yem: elindeki uygun yem öne, yoksa rigin ana yemi
function baitPick(rg, tier){
  const bi = baitInfo(rg, tier);
  const have = bi.filter(x => x.st === 'var');
  return {list: bi, use: have[0] || bi.find(x => x.src === 'rig') || bi[0] || null, have};
}
