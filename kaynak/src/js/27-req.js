// ---------------------------------------------------------------- 27 · takım gereksinimi: kamış, makine ve terminal
// Rig Atölyesi ve tür planı rigleri, iğne ve ipin yanında kamış, makine ve terminale de bakar: uygun kamış/makine, fırdöndü, boncuk
// ve kurşun elde yoksa rig "tamamlanmadı" kalır, eksikler alışveriş listesine düşer. Hayaldeki kamışı "alınacak" girersen o tekniğin
// rigleri kurulur ama kamışı alana kadar eksik kalır. Özel paketteki rigler bu kontrole girmez (kendi düzenleri vardır). Yem hiçbir rigde
// hazır olmayı etkilemez.
// kamış sınıfı: en fazla atış/kurşun gramından; makine sınıfı: boy numarasından
const ROD_CLS = [['UL', 12], ['L', 35], ['M', 100], ['H', 250], ['XH', Infinity]];
const rodCls = g => g == null ? null : ROD_CLS.find(x => g <= x[1])[0];
const REEL_CLS = [['S', 2500], ['M', 5000], ['L', 10000], ['XL', Infinity]];
const reelCls = n => n == null ? null : REEL_CLS.find(x => n <= x[1])[0];
const CLS_REP = {rod: {UL: 7, L: 30, M: 80, H: 200, XH: 400}, reel: {S: 2500, M: 4000, L: 6000, XL: 14000}};
// düzen → kamış ve makine (tip listesi, sınıflar, en kısa boy, ad, ölçü)
const DIP_GEAR = {rod: {types: ['tekne', 'slowjig', 'jig'], cls: ['H', 'XH'], name: 'Tekne dip kamışı', spec: '1,8–2,4 m · 120–250 g'},
  reel: {types: ['spin', 'cikrik'], cls: ['M', 'L', 'XL'], name: 'Makine', spec: 'spinning 4000–8000 ya da çıkrık'}};
const GEAR = {
  hirsizli: DIP_GEAR, iki: DIP_GEAR, tek: DIP_GEAR, kaydirmali: DIP_GEAR,
  kaydirmaliKiyi: {rod: {types: ['surf', 'spin', 'samandira'], cls: ['M', 'H'], name: 'Kıyı kamışı', spec: '3–4,2 m · 50–150 g'}, reel: {types: ['spin'], cls: ['M', 'L'], name: 'Makine', spec: 'spinning 4000–6000'}},
  canli: {rod: {types: ['tekne', 'jig', 'buyuk', 'slowjig'], cls: ['H', 'XH'], name: 'Güçlü tekne kamışı', spec: '1,8–2,4 m · 150–400 g'}, reel: {types: ['cikrik', 'spin'], cls: ['L', 'XL'], name: 'Makine', spec: 'çıkrık ya da spinning 6000–10000'}},
  slowjig: {rod: {types: ['slowjig'], cls: ['M', 'H', 'XH'], name: 'Slow jig kamışı', spec: '1,9–2,1 m · 100–250 g · PE 1,5–3'}, reel: {types: ['cikrik', 'spin'], cls: ['M', 'L'], name: 'Makine', spec: 'çıkrık (tercih) ya da spinning 4000–6000'}},
  tairubber: {rod: {types: ['slowjig', 'jig', 'tekne', 'spin'], cls: ['M', 'H'], name: 'Tai rubber / hafif jig kamışı', spec: '1,9–2,2 m · 60–150 g'}, reel: {types: ['cikrik', 'spin'], cls: ['S', 'M'], name: 'Makine', spec: 'küçük çıkrık ya da spinning 3000–4000'}},
  inchiku: {rod: {types: ['slowjig', 'jig', 'tekne'], cls: ['H'], name: 'Jig kamışı', spec: '1,9–2,2 m · 80–200 g'}, reel: {types: ['cikrik', 'spin'], cls: ['M', 'L'], name: 'Makine', spec: 'çıkrık ya da spinning 4000–6000'}},
  capari: {rod: {types: ['tekne', 'spin', 'surf', 'jig', 'slowjig', 'samandira'], cls: ['M', 'H'], name: 'Çapari kamışı', spec: '2,1–3,0 m · 30–100 g'}, reel: {types: ['spin', 'cikrik'], cls: ['M', 'L'], name: 'Makine', spec: 'spinning 3000–5000'}},
  egi: {rod: {types: ['egi', 'spin'], cls: ['L', 'M'], name: 'Egi kamışı', spec: '2,4–2,7 m · egi 2,5–3,5'}, reel: {types: ['spin'], cls: ['S', 'M'], name: 'Makine', spec: 'spinning 2500–3000'}},
  ahtapot: {rod: {types: ['tekne', 'spin', 'jig'], cls: ['M', 'H'], name: 'Ahtapot kamışı', spec: '1,8–2,4 m · 50–150 g'}, reel: {types: ['spin', 'cikrik'], cls: ['M', 'L'], name: 'Makine', spec: 'spinning 4000–6000'}},
  sirti: {rod: {types: ['sirti', 'tekne', 'buyuk'], cls: ['H', 'XH'], name: 'Sırtı kamışı', spec: '1,8–2,1 m · 20–30 lb'}, reel: {types: ['cikrik', 'spin'], cls: ['L', 'XL'], name: 'Sırtı makinesi', spec: 'çıkrık'}},
  chunking: {rod: {types: ['buyuk'], cls: ['XH'], name: 'Büyük oyun (stand-up) kamışı', spec: '30–80 lb'}, reel: {types: ['cikrik'], cls: ['XL', 'L'], name: 'Lever drag çıkrık', spec: '30–80 sınıfı'}},
  agirsirti: {rod: {types: ['buyuk', 'sirti'], cls: ['XH'], name: 'Büyük oyun (stand-up) kamışı', spec: '50–80 lb'}, reel: {types: ['cikrik'], cls: ['XL', 'L'], name: 'Lever drag çıkrık', spec: '50–80 sınıfı'}},
  popping: {rod: {types: ['buyuk', 'jig'], cls: ['XH'], name: 'Popping kamışı', spec: 'PE 5–8'}, reel: {types: ['spin'], cls: ['XL'], name: 'Makine', spec: 'spinning 14000–20000'}},
  agirjig: {rod: {types: ['jig', 'buyuk'], cls: ['XH'], name: 'Ağır jig kamışı', spec: '200–400 g · PE 4–6'}, reel: {types: ['spin', 'cikrik'], cls: ['XL', 'L'], name: 'Makine', spec: 'spinning 10000–14000 ya da çıkrık'}},
  paternoster: {rod: {types: ['surf'], cls: ['M', 'H'], minLen: 3.6, name: 'Surf kamışı', spec: '3,9–4,5 m · 100–200 g'}, reel: {types: ['spin'], cls: ['L', 'M'], name: 'Surf makinesi', spec: 'spinning 5000–8000'}},
  lrf: {rod: {types: ['lrf'], cls: ['UL'], name: 'LRF kamışı', spec: '1,8–2,3 m · 1–7 g'}, reel: {types: ['spin'], cls: ['S'], name: 'Makine', spec: 'spinning 1000–2500'}},
  spin: {rod: {types: ['spin', 'lrf', 'egi'], cls: ['L', 'M'], name: 'Spin kamışı', spec: '2,4–3,0 m · 10–40 g'}, reel: {types: ['spin'], cls: ['M', 'S'], name: 'Makine', spec: 'spinning 3000–4000'}},
  samandira: {rod: {types: ['samandira', 'spin'], cls: ['L', 'M', 'UL'], minLen: 3, name: 'Bolonez / şamandıra kamışı', spec: '4–6 m · 5–25 g'}, reel: {types: ['spin'], cls: ['S', 'M'], name: 'Makine', spec: 'spinning 2500–4000'}},
};
// düzen → terminal: [etiket, kabul edilen terminal tipleri, kurşun gramı gerekir mi]
const SW = ['firdondu', 'klipsfirdondu', 'rulmanli'];
const TERM = {
  hirsizli: [['T-fırdöndü', ['tfirdondu', 'tfirdondub']], ['Fırdöndü', SW], ['Stop boncuk', ['stop']], ['Kurşun', ['k-armut', 'k-damla'], 1]],
  iki: [['T-fırdöndü', ['tfirdondu', 'tfirdondub']], ['Fırdöndü', SW], ['Stop boncuk', ['stop']], ['Kurşun', ['k-armut', 'k-damla'], 1]],
  tek: [['Fırdöndü', SW], ['Kurşun', ['k-armut', 'k-damla'], 1]],
  kaydirmali: [['Gezer kurşun', ['k-zeytin'], 1], ['Stop boncuk', ['stop', 'boncuk']], ['Fırdöndü', SW]],
  kaydirmaliKiyi: [['Gezer kurşun', ['k-zeytin'], 1], ['Stop boncuk', ['stop', 'boncuk']], ['Fırdöndü', SW]],
  canli: [['Fırdöndü', ['rulmanli', 'firdondu', 'klipsfirdondu']], ['Kurşun', ['k-armut', 'k-damla', 'k-zeytin'], 1]],
  slowjig: [['Halka', ['splitring', 'solidring']]], agirjig: [['Halka', ['splitring', 'solidring']]],
  capari: [['Klipsli fırdöndü', ['klipsfirdondu', 'klips', 'firdondu']], ['Kurşun', ['k-armut', 'k-damla'], 1]],
  egi: [['Hızlı klips', ['klips', 'klipsfirdondu']]], ahtapot: [['Klipsli fırdöndü', ['klipsfirdondu', 'klips', 'firdondu']]],
  sirti: [['Rulmanlı fırdöndü', ['rulmanli']], ['Hızlı klips', ['klips', 'klipsfirdondu']]],
  chunking: [['Rulmanlı fırdöndü', ['rulmanli']], ['Sıkıştırma burcu', ['burc']], ['Burç pensesi', ['burcpense']]],
  agirsirti: [['Rulmanlı fırdöndü', ['rulmanli']], ['Sıkıştırma burcu', ['burc']], ['Burç pensesi', ['burcpense']]],
  popping: [['Halka', ['splitring', 'solidring']], ['Rulmanlı fırdöndü', ['rulmanli']]],
  paternoster: [['T-fırdöndü ya da boom', ['tfirdondu', 'tfirdondub', 'boom']], ['Fırdöndü', ['firdondu', 'klipsfirdondu']], ['Boncuk', ['boncuk', 'stop']], ['Kurşun', ['k-piramit', 'k-capali'], 1]],
  spin: [['Hızlı klips', ['klips', 'klipsfirdondu']]], samandira: [['Stop', ['stop']], ['Saçma kurşun', ['k-sacma']], ['Fırdöndü', ['firdondu']]],
};
const gearKey = (lay, mode) => lay === 'kaydirmali' && mode === 'kiyi' ? 'kaydirmaliKiyi' : lay;
// kamış ve makine bilgisi: formda girildiyse oradan, yoksa adından ve özelliğinden çıkarılır
function rodInfo(it){
  if (it.rod) return it.rod;
  const t = trLower([it.name, it.model, it.spec, it.type].join(' ')).replace(/(\d),(\d)/g, '$1.$2');
  const mx = t.match(/max\.?\s*(\d+)\s*g/) || t.match(/(\d+)\s*[–-]\s*(\d+)\s*g/);
  const ln = t.match(/(\d+(?:\.\d+)?)\s*m\b/);
  const type = /slow/.test(t) ? 'slowjig' : /lrf|ultra ?light/.test(t) ? 'lrf' : /surf/.test(t) ? 'surf' : /\begi|eging/.test(t) ? 'egi' : /bolo|şamandıra|samandira/.test(t) ? 'samandira' :
    /troll|sırtı/.test(t) ? 'sirti' : /stand.?up|big game|büyük oyun/.test(t) ? 'buyuk' : /boat|tekne|quiver|dip/.test(t) ? 'tekne' : /\bjig/.test(t) ? 'jig' : /spin/.test(t) ? 'spin' : null;
  return {type, max: mx ? Number(mx[2] || mx[1]) : null, len: ln ? Number(ln[1]) : null, pe: null};
}
function reelInfo(it){
  if (it.reel) return it.reel;
  const t = trLower([it.name, it.model, it.spec, it.type].join(' '));
  const type = /çıkrık|cikrik|lever|baitcast|casting|conventional|multiplier|avet|tiagra|talica|torium|trinidad/.test(t) ? 'cikrik' : /spin/.test(t) ? 'spin' : null;
  const sz = t.match(/(?:^|\D)(\d{4,5})(?:\D|$)/);
  return {type, size: sz ? Number(sz[1]) : null};
}
// "50–200 g" gibi gram aralığı (boy listesi olmayan kurşun kalemi için)
function gRange(it){ const m = [it.name, it.model, it.spec].join(' ').match(/(\d+)\s*[–-]\s*(\d+)\s*g\b/i); return m ? [Number(m[1]), Number(m[2])] : null; }
// rigin kamış, makine ve terminal yuvaları (Rig Atölyesi ve tür planı riglerinde; özel pakette yok)
function reqSlots(rg){
  if (!rg.lay || rg.sys === 'ozel') return [];
  const key = gearKey(rg.lay, rg.mode); const G = GEAR[key]; if (!G) return [];
  const tier = (o, size) => ({dunya: {name: o.name, size}, turkiye: {name: o.name, size}});
  const out = [
    {k: 'kamis', label: 'Kamış', kind: 'rod', sp: {kind: 'rod', types: G.rod.types, cls: G.rod.cls, minLen: G.rod.minLen || null}, t: tier(G.rod, G.rod.spec)},
    {k: 'makine', label: 'Makine', kind: 'reel', sp: {kind: 'reel', types: G.reel.types, cls: G.reel.cls}, t: tier(G.reel, G.reel.spec)}];
  (TERM[key] || []).forEach(([lbl, tts, needG], i) => {
    const g = needG && rg.sinker && rg.sinker.g ? rg.sinker.g.slice() : null;
    out.push({k: 'term' + i, label: lbl, kind: 'term', sp: {kind: 'term', tts, g, lbl}, t: tier({name: lbl}, g ? g[0] + '–' + g[1] + ' g' : null)});
  });
  return out;
}
// kamış/makine/terminal yuvası için envanterdeki en uygun kalem (resolveSlot'tan çağrılır)
function resolveGear(sp, it, take){
  if (sp.kind === 'rod' || sp.kind === 'reel') {
    if (it.cat !== sp.kind) return;
    const inf = sp.kind === 'rod' ? rodInfo(it) : reelInfo(it);
    const typeOk = inf.type && inf.type !== 'diger' ? sp.types.includes(inf.type) : null;
    const cls = sp.kind === 'rod' ? rodCls(inf.max) : reelCls(inf.size);
    const clsOk = cls ? sp.cls.includes(cls) : null;
    if (clsOk === false) return;                          // gücü bu işe uymuyor
    if (typeOk === false) return;                         // tipi başka iş için (tipini "Diğer" seçersen yalnızca gücüne bakılır)
    if (sp.minLen && inf.len && inf.len < sp.minLen - 0.2) return;
    const ok = usable(stockOf(it.id, '-'));
    // aynı uygunlukta: tekniğin asıl kamış tipi (listede önce gelen) ve işe en yakın güç öne
    const ti = typeOk ? sp.types.indexOf(inf.type) * 0.1 : 1;
    const ideal = CLS_REP[sp.kind][sp.cls[0]]; const pw = sp.kind === 'rod' ? inf.max : inf.size;
    const near = pw && ideal ? Math.min(0.5, Math.abs(pw - ideal) / ideal * 0.3) : 0.2;
    take({item: it.id, name: it.name, size: null, ok, score: ti + near + (clsOk ? 0 : 1) + (ok ? 0 : 20)}, ok);
    return;
  }
  if (sp.kind === 'term') {
    if (it.cat !== 'terminal' && it.cat !== 'sinker') return;
    const tts = termTypes(it); const pref = sp.tts.findIndex(t => tts.includes(t)); if (pref < 0) return;
    const mid = sp.g ? (sp.g[0] + sp.g[1]) / 2 : null;
    sizesOf(it).forEach(sz => {
      let inR = true, dist = 0;
      if (sp.g) {
        const g = sz !== '-' ? lureG({name: sz}) : null;
        if (g != null) { inR = g >= sp.g[0] * 0.75 && g <= sp.g[1] * 1.35; if (!inR && (g < sp.g[0] * 0.5 || g > sp.g[1] * 2)) return; dist = Math.abs(g - mid) / mid; }
        else { const rr = gRange(it); if (rr) inR = rr[1] >= sp.g[0] * 0.75 && rr[0] <= sp.g[1] * 1.35; }
      }
      const ok = usable(stockOf(it.id, sz));
      take({item: it.id, name: it.name, size: sz !== '-' ? sz : null, ok, score: pref + dist + (inR ? 0 : 3) + (ok ? 0 : 20) + (it.std ? 0.3 : 0)}, ok && inR);
    });
  }
}
// eldeki kamış bu düzene uyuyor mu (tür planında tekniği öne almak için)
function gearReady(lay, mode){
  const G = GEAR[gearKey(lay, mode)]; if (!G) return false;
  const r = resolveSlot({kind: 'rod', types: G.rod.types, cls: G.rod.cls, minLen: G.rod.minLen || null}), m = resolveSlot({kind: 'reel', types: G.reel.types, cls: G.reel.cls});
  return !!(r.strict && m.strict);
}
