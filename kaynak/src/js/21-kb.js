// ---------------------------------------------------------------- 21 · bilgi tabanı: türler, teknikler, takım düzenleri, ürünler
// Rig Atölyesi bu tabloları kullanarak, kullanıcının cevaplarına göre kuralla (yapay zekâsız) rig sistemi kurar.
// Genel bilgidir; bölgeye ve yıla göre değişir. Ürün adları örnek seriler; boy ve çap aralıkları asıl ölçüdür.
const KB = (() => {
  // iğne desenleri: sc = boy ölçeği (jp: No:1…; w: #8 … 1 … 1/0 …)
  const PAT = {
    chinu: {name: 'Chinu', sc: 'jp'}, maruseigo: {name: 'Maruseigo', sc: 'jp'}, iseama: {name: 'Iseama', sc: 'jp'},
    octopus: {name: 'Octopus / beak', sc: 'w'}, circle: {name: 'Mutsu / circle', sc: 'w'}, jforged: {name: 'J (dövme, güçlü)', sc: 'w'},
    baitholder: {name: 'Baitholder (palalı)', sc: 'w'}, aberdeen: {name: 'Aberdeen / uzun pala', sc: 'w'}, livebait: {name: 'Canlı yem', sc: 'w'},
    assist: {name: 'Assist (jig)', sc: 'w'}, treble: {name: 'Üçlü (treble)', sc: 'w'}, jighead: {name: 'Jighead', sc: 'w'}, sabiki: {name: 'Çapari', sc: 'w'},
  };
  // envanterden ikame için uyumlu desen grupları
  const COMPAT = [['chinu', 'maruseigo', 'iseama'], ['chinu', 'iseama', 'octopus', 'baitholder'], ['octopus', 'circle', 'jforged', 'livebait'], ['aberdeen', 'baitholder'], ['assist'], ['jighead'], ['sabiki'], ['treble']];
  // ürünler: seviye başına örnek seri (dunya: dünyanın en iyisi, turkiye: Türkiye'de bulunan en iyi)
  const HOOK = {
    chinu: {dunya: 'Gamakatsu Hyper Chinu', turkiye: 'Owner Cut Super Chinu'},
    maruseigo: {dunya: 'Gamakatsu Maruseigo', turkiye: 'BKK Maruseigo-R'},
    iseama: {dunya: 'Gamakatsu Iseama', turkiye: 'Sasame / BKK Iseama'},
    octopus: {dunya: 'Owner SSW Cutting Point', turkiye: 'BKK Octopus Beak'},
    circle: {dunya: 'Owner Mutu Light Circle', turkiye: 'BKK Mutsu Circle Light-SS'},
    bigcircle: {dunya: 'Owner Super Mutu Circle', turkiye: 'Mustad Demon Perfect Circle'},
    jforged: {dunya: 'Owner Gorilla', turkiye: 'Owner Ringed Gorilla (5105R)'},
    baitholder: {dunya: 'Gamakatsu Baitholder', turkiye: 'BKK Beak Baitholder-R'},
    aberdeen: {dunya: 'Kamasan B940 Aberdeen', turkiye: 'Mustad Aberdeen'},
    livebait: {dunya: 'Gamakatsu Live Bait', turkiye: 'Mustad Hoodlum'},
    assist: {dunya: 'Owner assist (çift)', turkiye: 'BKK Lone Fighter Assist'},
    jighead: {dunya: 'Owner Cultiva jighead', turkiye: 'Decoy / Owner jighead'},
    sabiki: {dunya: 'Hayabusa çapari', turkiye: 'Hayabusa / Sasame çapari'},
    treble: {dunya: 'Owner ST-36 üçlü', turkiye: 'BKK / VMC üçlü'},
  };
  const LINE = {
    braid: {dunya: 'YGK X-Braid Upgrade X8', turkiye: 'Daiwa J-Braid x8'},
    fc: {dunya: 'Seaguar Grandmax FX', turkiye: 'Seaguar Grandmax FC'},
    fcbig: {dunya: 'Seaguar Big Game FC', turkiye: 'Kalın florokarbon lider (Seaguar, Momoi)'},
    mono: {dunya: 'Momoi Diamond', turkiye: 'Berkley Trilene Big Game'},
    shock: {dunya: 'Seaguar Grandmax FX (şok lider)', turkiye: 'Berkley Trilene Big Game (şok lider)'},
    steel: {dunya: 'AFW Surflon kaplamalı çelik tel', turkiye: 'Kaplamalı çelik tel'},
  };
  const LURE = {
    egi: {dunya: 'Yamashita Egi-Oh K', turkiye: 'DTD / Yo-Zuri Aurie-Q egi', kw: ['egi', 'kalamar', 'zoka']},
    ahtapot: {dunya: 'Ahtapot egisi (Japon yapımı)', turkiye: 'Ahtapot zokası (yengeç tipi)', kw: ['ahtapot', 'egi', 'zoka']},
    slowjig: {dunya: 'Shimano Ocea Stingray slow jig', turkiye: 'Hart / Savage Gear slow jig', kw: ['slow', 'jig']},
    tairubber: {dunya: 'Daiwa Kohga Bayrubber', turkiye: 'Tai rubber zoka', kw: ['tai', 'rubber']},
    inchiku: {dunya: 'Savage Gear SwimSquid Inchiku', turkiye: 'Savage Gear SwimSquid Inchiku', kw: ['inchiku']},
    sabiki: {dunya: 'Hayabusa çapari takımı', turkiye: 'Hayabusa / Sasame çapari takımı', kw: ['çapari', 'capari', 'sabiki']},
    minnow: {dunya: 'Duo Tide Minnow', turkiye: 'Rapala X-Rap', kw: ['minnow', 'rapala', 'maket']},
    metal: {dunya: 'Shimano Coltsniper metal jig', turkiye: 'Savage Gear / Fujin metal jig', kw: ['metal', 'cast', 'jig']},
    soft: {dunya: 'Ecogear Grass Minnow silikon', turkiye: 'Savage Gear / Delalande silikon', kw: ['silikon', 'soft', 'shad']},
    trolling: {dunya: 'Yo-Zuri Crystal Minnow', turkiye: 'Rapala CD Magnum', kw: ['magnum', 'trolling', 'sırtı', 'kaşık']},
    bigtroll: {dunya: 'Rapala X-Rap Magnum', turkiye: 'Halco Laser Pro', kw: ['magnum', 'laser', 'trolling']},
    popper: {dunya: 'Shimano Ocea Bubble Dip', turkiye: 'Savage Gear popper / stickbait', kw: ['popper', 'stick']},
    bigjig: {dunya: 'Shimano Ocea Stingray (ağır)', turkiye: 'Hart / Savage Gear ağır jig', kw: ['jig']},
    samandira: {dunya: 'Kaliteli kaydırmalı şamandıra', turkiye: 'Kaydırmalı şamandıra', kw: ['şamandıra', 'samandira']},
  };
  // türler. fam: takım ailesi; hab: dipler; m: iyi aylar (null = yıl boyu); t: saatler; b: yemler (g gündüz, n gece); bol: bölgeler; sz: boylar
  const S = (id, name, latin, fam, hab, depth, m, t, b, bol, sz, note) => ({id, name, latin, fam, hab, depth, m, t, b, bol, sz, note: note || ''});
  const ALL = ['ege', 'akdeniz', 'marmara', 'karadeniz'], AEG = ['ege', 'akdeniz', 'marmara'];
  const SPECIES = [
    S('karagoz', 'Karagöz', 'Diplodus vulgaris', 'sk', ['kum', 'kum-kayalik', 'kayalik'], [5, 60], null, ['gunduz', 'gece', 'safak'], {g: ['Sülünez ince şerit', 'Karides'], n: ['Mamun', 'Sülünez']}, AEG, {porsiyon: '100–400 g', trofe: '0,5–1 kg'}),
    S('isparoz', 'İsparoz', 'Diplodus annularis', 'sk', ['kum-kayalik', 'kum'], [2, 40], null, ['gunduz'], {g: ['Çimçim', 'Mamun parçası'], n: ['Mamun parçası']}, AEG, {porsiyon: '50–200 g'}),
    S('izmarit', 'İzmarit', 'Spicara smaris', 'sk', ['kum', 'camur', 'karma'], [10, 80], null, ['gunduz'], {g: ['Karides', 'Mamun parçası']}, AEG, {porsiyon: '50–150 g'}),
    S('kupes', 'Kupes', 'Boops boops', 'sk', ['karma', 'orta-su'], [0, 60], null, ['gunduz'], {g: ['Karides', 'Ekmek']}, AEG, {porsiyon: '50–200 g'}),
    S('melanurya', 'Melanurya', 'Oblada melanura', 'sk', ['kayalik'], [0, 20], null, ['gunduz', 'safak'], {g: ['Karides', 'Ekmek']}, ['ege', 'akdeniz'], {porsiyon: '100–400 g'}),
    S('mirmir', 'Mırmır', 'Lithognathus mormyrus', 'sk', ['kum'], [0, 30], null, ['gece', 'safak'], {g: ['Mamun', 'Boru kurdu'], n: ['Mamun', 'Boru kurdu']}, AEG, {porsiyon: '150–500 g'}),
    S('sargoz', 'Sargoz', 'Diplodus sargus', 'so', ['kayalik', 'saf-kayalik'], [0, 50], null, ['gece', 'safak'], {g: ['Midye', 'Karides'], n: ['Mamun', 'Yengeç']}, AEG, {porsiyon: '200–800 g', trofe: '1–2,5 kg'}),
    S('mercan', 'Mercan', 'Pagellus erythrinus', 'so', ['karma', 'kum-kayalik', 'camur'], [20, 120], null, ['gunduz', 'safak'], {g: ['Sülünez', 'Karides'], n: ['Mamun']}, AEG, {porsiyon: '150–600 g', trofe: '0,8–2 kg'}),
    S('cipura', 'Çipura', 'Sparus aurata', 'so', ['kum-kayalik', 'kum', 'karma'], [2, 50], null, ['safak', 'gece'], {g: ['Çimçim', 'Karides', 'Midye'], n: ['Mamun', 'Yengeç']}, AEG, {porsiyon: '300 g–1,5 kg', trofe: '2–5 kg'}),
    S('minakop', 'Minakop', 'Umbrina cirrosa', 'so', ['kum'], [0, 40], null, ['gece'], {n: ['Mamun', 'Karides']}, AEG, {porsiyon: '0,5–2 kg', trofe: '3–6 kg'}),
    S('fangri', 'Fangri', 'Pagrus pagrus', 'sg', ['karma', 'kayalik', 'kum-kayalik'], [20, 150], null, ['gunduz', 'gece'], {g: ['Kalamar şerit', 'Sardalya'], n: ['Mamun salkım', 'Kalamar']}, ['ege', 'akdeniz'], {porsiyon: '0,5–2 kg', trofe: '3–8 kg'}),
    S('sinarit', 'Sinarit', 'Dentex dentex', 'sg', ['kayalik', 'kum-kayalik'], [15, 120], null, ['safak', 'gece'], {g: ['Canlı kalamar', 'Canlı istavrit', 'Sülünez buketi'], n: ['Mamun mega salkım', 'Canlı kalamar']}, ['ege', 'akdeniz'], {porsiyon: '1–4 kg', trofe: '5–12 kg'}),
    S('sinagrit', 'Sinagrit', 'Dentex gibbosus', 'sg', ['kayalik', 'karma'], [30, 150], null, ['gunduz', 'safak'], {g: ['Kalamar', 'Canlı istavrit']}, ['ege', 'akdeniz'], {porsiyon: '1–3 kg', trofe: '4–10 kg'}),
    S('tranca', 'Trança', 'Pagrus auriga', 'sg', ['saf-kayalik', 'kayalik'], [20, 100], null, ['gece'], {n: ['Yengeç', 'Mamun mega salkım', 'Kalamar']}, ['ege', 'akdeniz'], {porsiyon: '2–5 kg', trofe: '5–15 kg'}),
    S('eskina', 'Eşkina', 'Sciaena umbra', 'kaya', ['kayalik', 'kum-kayalik'], [2, 50], null, ['gece'], {n: ['Mamun', 'Karides', 'Yengeç']}, AEG, {porsiyon: '0,5–1,5 kg', trofe: '2–4 kg'}),
    S('iskorpit', 'İskorpit', 'Scorpaena porcus', 'kaya', ['kayalik'], [2, 60], null, ['gece', 'gunduz'], {g: ['Kalamar', 'Sardalya'], n: ['Kalamar']}, ALL, {porsiyon: '100–400 g'}, 'Dikenleri zehirli; eldivenle tut.'),
    S('lipsoz', 'Lipsoz', 'Scorpaena scrofa', 'kaya', ['kayalik', 'karma'], [20, 150], null, ['gunduz'], {g: ['Kalamar', 'Sardalya']}, ['ege', 'akdeniz'], {porsiyon: '0,5–1,5 kg', trofe: '2–3 kg'}, 'Dikenleri zehirli; eldivenle tut.'),
    S('akya', 'Akya', 'Lichia amia', 'yirtici', ['kum-kayalik', 'orta-su'], [0, 40], [6, 7, 8, 9, 10], ['safak', 'gece'], {g: ['Canlı kefal', 'Canlı istavrit'], n: ['Canlı istavrit']}, AEG, {porsiyon: '2–6 kg', trofe: '8–20 kg'}),
    S('levrek', 'Levrek', 'Dicentrarchus labrax', 'yirtici', ['kayalik', 'kum'], [0, 20], [10, 11, 12, 1, 2, 3, 4], ['gece', 'safak'], {g: ['Canlı karides', 'Sahte yem'], n: ['Mamun', 'Canlı karides']}, ALL, {porsiyon: '0,5–2 kg', trofe: '3–8 kg'}),
    S('lufer', 'Lüfer', 'Pomatomus saltatrix', 'yirtici', ['orta-su'], [0, 40], [9, 10, 11, 12, 1], ['safak', 'gece'], {g: ['Canlı istavrit', 'Sahte yem'], n: ['Canlı istavrit']}, ['marmara', 'karadeniz', 'ege'], {porsiyon: '0,3–1 kg', trofe: '2–5 kg'}, 'Dişlidir: çelik tel ya da kalın florokarbon lider kullan.'),
    S('palamut', 'Palamut', 'Sarda sarda', 'pelajikb', ['orta-su'], [0, 60], [8, 9, 10, 11, 12], ['safak', 'gunduz'], {g: ['Sahte yem', 'Kaşık']}, ['karadeniz', 'marmara', 'ege'], {porsiyon: '1–3 kg'}),
    S('lambuka', 'Lambuka', 'Coryphaena hippurus', 'pelajikb', ['orta-su'], [0, 20], [8, 9, 10, 11], ['gunduz'], {g: ['Sahte yem', 'Canlı balık']}, ['ege', 'akdeniz'], {porsiyon: '1–5 kg', trofe: '8–15 kg'}),
    S('orkinos', 'Orkinos (mavi yüzgeçli)', 'Thunnus thynnus', 'buyuk', ['orta-su'], [0, 200], [6, 7, 8, 9, 10], ['gunduz', 'safak'], {g: ['Sardalya parçası (chunk)', 'Canlı istavrit']}, AEG, {trofe: '50–300 kg'},
      'Uluslararası kotaya (ICCAT) tabidir. Amatör avın izinli olup olmadığını, etiket ve yakala-bırak kurallarını güncel tebliğden kontrol et.'),
    S('zargana', 'Zargana', 'Belone belone', 'pelajikk', ['orta-su'], [0, 10], [9, 10, 11, 3, 4, 5], ['gunduz'], {g: ['Balık şeridi']}, ALL, {porsiyon: '100–300 g'}),
    S('istavrit', 'İstavrit', 'Trachurus spp.', 'pelajikk', ['orta-su', 'karma'], [5, 100], null, ['gunduz', 'safak'], {g: ['Çapari']}, ALL, {porsiyon: '50–300 g'}),
    S('kolyoz', 'Kolyoz', 'Scomber colias', 'pelajikk', ['orta-su'], [5, 100], [8, 9, 10, 11], ['gunduz'], {g: ['Çapari']}, AEG, {porsiyon: '150–400 g'}),
    S('uskumru', 'Uskumru', 'Scomber scombrus', 'pelajikk', ['orta-su'], [5, 100], [10, 11, 12, 1, 2, 3], ['gunduz'], {g: ['Çapari']}, ['karadeniz', 'marmara', 'ege'], {porsiyon: '150–400 g'}),
    S('kefal', 'Kefal', 'Mugilidae', 'kefal', ['kum', 'camur'], [0, 10], null, ['gunduz'], {g: ['Ekmek hamuru', 'Karides']}, ALL, {porsiyon: '0,3–2 kg'}),
    S('barbunya', 'Barbunya', 'Mullus barbatus', 'kum', ['camur', 'kum'], [10, 100], null, ['gunduz'], {g: ['Mamun parçası', 'Karides']}, ALL, {porsiyon: '50–200 g'}),
    S('tekir', 'Tekir', 'Mullus surmuletus', 'kum', ['kum-kayalik', 'kum'], [5, 60], null, ['gunduz'], {g: ['Mamun parçası', 'Karides']}, ALL, {porsiyon: '100–300 g'}),
    S('kirlangic', 'Kırlangıç', 'Chelidonichthys lucerna', 'kum', ['kum', 'camur'], [20, 150], null, ['gunduz'], {g: ['Kalamar', 'Karides', 'Sardalya']}, ALL, {porsiyon: '0,3–1 kg', trofe: '1,5–3 kg'}),
    S('mezgit', 'Mezgit', 'Merlangius merlangus', 'kum', ['camur', 'kum'], [20, 120], [11, 12, 1, 2, 3], ['gunduz'], {g: ['Hamsi', 'Karides', 'Kalamar']}, ['karadeniz', 'marmara'], {porsiyon: '100–400 g'}),
    S('dil', 'Dil', 'Solea solea', 'kum', ['kum', 'camur'], [2, 60], null, ['gece'], {n: ['Kurt (boru kurdu)', 'Mamun']}, ALL, {porsiyon: '200–600 g'}),
    S('kalkan', 'Kalkan', 'Scophthalmus maximus', 'buyukdip', ['kum', 'camur'], [20, 80], null, ['gunduz', 'gece'], {g: ['Canlı istavrit', 'Canlı mezgit'], n: ['Canlı istavrit']}, ['karadeniz', 'marmara'], {porsiyon: '1–3 kg', trofe: '4–10 kg'}, 'Av yasağı dönemi ve boy sınırı vardır; güncel tebliği kontrol et.'),
    S('lahos', 'Lahos', 'Epinephelus costae', 'buyukdip', ['kayalik'], [10, 80], null, ['gunduz'], {g: ['Canlı kalamar', 'Kalamar']}, ['ege', 'akdeniz'], {porsiyon: '1–3 kg', trofe: '4–8 kg'}, 'Boy ve av kuralları olabilir; güncel tebliği kontrol et.'),
    S('orfoz', 'Orfoz', 'Epinephelus marginatus', 'buyukdip', ['kayalik', 'saf-kayalik'], [10, 100], null, ['gunduz'], {g: ['Canlı kalamar', 'Kalamar']}, ['ege', 'akdeniz'], {porsiyon: '2–6 kg', trofe: '8–20 kg'}, 'Koruma ya da ciddi kısıtlama altında olabilir; avlamadan önce güncel tebliği kontrol et.'),
    S('kalamar', 'Kalamar', 'Loligo vulgaris', 'kafadan', ['kayalik', 'karma', 'orta-su'], [2, 60], [10, 11, 12, 1, 2, 3], ['gece', 'safak'], {g: ['Egi'], n: ['Egi', 'Kalamar çaparisi']}, ALL, {porsiyon: '100–500 g', trofe: '1–2 kg'}),
    S('murekkep', 'Mürekkep balığı', 'Sepia officinalis', 'kafadan', ['kum', 'karma'], [2, 40], [2, 3, 4, 5], ['gunduz', 'safak'], {g: ['Egi']}, AEG, {porsiyon: '0,3–1,5 kg'}),
    S('ahtapot', 'Ahtapot', 'Octopus vulgaris', 'kafadan', ['kayalik', 'karma'], [2, 60], null, ['gunduz'], {g: ['Ahtapot zokası', 'Yengeç']}, AEG, {porsiyon: '0,5–2 kg', trofe: '3–8 kg'}, 'Boy ve dönem sınırı olabilir; güncel tebliği kontrol et.'),
  ];
  // takım aileleri: iğne deseni ve boy aralığı (jp: No, w: # ve /0), köstek/beden/ana ip çapı (mm)
  const FAM = {
    sk: {name: 'Küçük ağızlılar', hook: {porsiyon: {p: ['chinu', 'maruseigo', 'iseama', 'baitholder'], jp: [1, 3], w: ['8', '4']}, trofe: {p: ['chinu', 'iseama', 'octopus'], jp: [3, 5], w: ['4', '1']}},
      kostek: {porsiyon: [0.20, 0.26], trofe: [0.26, 0.30]}, beden: {porsiyon: [0.26, 0.33], trofe: [0.33, 0.40]}, ana: {porsiyon: [0.14, 0.18], trofe: [0.16, 0.20]}},
    so: {name: 'Orta boy sparitler', hook: {porsiyon: {p: ['chinu', 'iseama', 'octopus', 'baitholder'], jp: [2, 4], w: ['4', '1']}, trofe: {p: ['octopus', 'jforged', 'circle'], jp: [4, 6], w: ['1/0', '3/0']}},
      kostek: {porsiyon: [0.24, 0.30], trofe: [0.33, 0.40]}, beden: {porsiyon: [0.30, 0.36], trofe: [0.40, 0.57]}, ana: {porsiyon: [0.16, 0.20], trofe: [0.20, 0.28]}},
    sg: {name: 'Güçlü sparitler ve sinarit', hook: {porsiyon: {p: ['octopus', 'circle', 'jforged'], w: ['1/0', '3/0']}, trofe: {p: ['jforged', 'circle', 'octopus', 'livebait'], w: ['3/0', '5/0']}},
      kostek: {porsiyon: [0.35, 0.45], trofe: [0.40, 0.57]}, beden: {porsiyon: [0.45, 0.57], trofe: [0.57, 0.70]}, ana: {porsiyon: [0.20, 0.28], trofe: [0.28, 0.40]}},
    kaya: {name: 'Kaya balıkları', hook: {porsiyon: {p: ['octopus', 'baitholder', 'chinu'], jp: [4, 6], w: ['2', '1/0']}, trofe: {p: ['octopus', 'jforged'], w: ['1/0', '3/0']}},
      kostek: {porsiyon: [0.28, 0.35], trofe: [0.40, 0.50]}, beden: {porsiyon: [0.35, 0.45], trofe: [0.50, 0.60]}, ana: {porsiyon: [0.18, 0.23], trofe: [0.23, 0.33]}},
    yirtici: {name: 'Yırtıcılar', hook: {porsiyon: {p: ['livebait', 'octopus', 'circle'], w: ['1', '2/0']}, trofe: {p: ['livebait', 'circle', 'jforged'], w: ['3/0', '6/0']}},
      kostek: {porsiyon: [0.35, 0.45], trofe: [0.50, 0.70]}, beden: {porsiyon: [0.45, 0.57], trofe: [0.60, 0.80]}, ana: {porsiyon: [0.20, 0.28], trofe: [0.28, 0.40]}},
    kum: {name: 'Kum ve çamur balıkları', hook: {porsiyon: {p: ['aberdeen', 'baitholder', 'chinu', 'maruseigo'], jp: [1, 3], w: ['8', '4']}, trofe: {p: ['baitholder', 'aberdeen', 'octopus'], w: ['4', '1']}},
      kostek: {porsiyon: [0.18, 0.24], trofe: [0.24, 0.30]}, beden: {porsiyon: [0.26, 0.30], trofe: [0.30, 0.35]}, ana: {porsiyon: [0.12, 0.16], trofe: [0.14, 0.18]}},
    buyukdip: {name: 'Büyük dip balıkları', hook: {porsiyon: {p: ['livebait', 'circle', 'jforged'], w: ['3/0', '5/0']}, trofe: {p: ['livebait', 'circle', 'jforged'], w: ['5/0', '8/0']}},
      kostek: {porsiyon: [0.50, 0.60], trofe: [0.60, 0.80]}, beden: {porsiyon: [0.60, 0.80], trofe: [0.80, 1.00]}, ana: {porsiyon: [0.28, 0.37], trofe: [0.33, 0.47]}},
    kefal: {name: 'Kefal', hook: {porsiyon: {p: ['chinu', 'maruseigo', 'aberdeen'], jp: [1, 3], w: ['12', '8']}}, kostek: {porsiyon: [0.16, 0.22]}, beden: {porsiyon: [0.22, 0.26]}, ana: {porsiyon: [0.20, 0.26]}},
    pelajikk: {name: 'Küçük sürü balıkları', hook: {porsiyon: {p: ['sabiki'], w: ['12', '8']}}, kostek: {porsiyon: [0.18, 0.25]}, beden: {porsiyon: [0.30, 0.40]}, ana: {porsiyon: [0.14, 0.20]}},
    pelajikb: {name: 'Büyük sürü balıkları', hook: {porsiyon: {p: ['treble', 'livebait'], w: ['2', '2/0']}, trofe: {p: ['livebait', 'circle'], w: ['2/0', '5/0']}}, kostek: {porsiyon: [0.40, 0.50], trofe: [0.50, 0.70]}, beden: {porsiyon: [0.50, 0.60]}, ana: {porsiyon: [0.20, 0.28], trofe: [0.28, 0.37]}},
    buyuk: {name: 'Orkinos ve büyük av', hook: {trofe: {p: ['circle', 'livebait'], w: ['7/0', '10/0'], big: true}}, kostek: {trofe: [1.20, 1.60]}, beden: {trofe: [1.20, 1.60]}, ana: {trofe: [0.40, 0.52]}},
    kafadan: {name: 'Kafadanbacaklılar'},
  };
  // teknikler ve takım düzenleri
  const TECH = {
    dip: {name: 'Dip avı (yemli)', modes: ['tekne', 'kiyi'], fams: ['sk', 'so', 'sg', 'kaya', 'kum', 'yirtici', 'buyukdip'], lay: ['hirsizli', 'iki', 'tek', 'kaydirmali'], code: 'D', desc: 'Kurşunla dipte, doğal yemle: hırsızlı, 2 iğneli, tek iğneli ya da kaydırmalı takım.'},
    canli: {name: 'Canlı yemle büyük av', modes: ['tekne'], fams: ['sg', 'yirtici', 'buyukdip'], lay: ['canli'], code: 'C', desc: 'Canlı kalamar, istavrit ya da kefalle sinarit, akya, lahos, kalkan.'},
    jig: {name: 'Jig (slow jig, tai rubber, inchiku)', modes: ['tekne'], fams: ['so', 'sg', 'kaya', 'yirtici', 'buyukdip'], lay: ['slowjig', 'tairubber', 'inchiku'], code: 'J', desc: 'Dikey sahte yemlerle dip ve orta su; çipura, fangri, sinarit, lahos.'},
    capari: {name: 'Çapari', modes: ['tekne', 'kiyi'], fams: ['pelajikk', 'sk'], lay: ['capari'], code: 'Ç', desc: 'İstavrit, kolyoz, uskumru, izmarit için çok iğneli takım.'},
    eging: {name: 'Kalamar, mürekkep ve ahtapot', modes: ['tekne', 'kiyi'], fams: ['kafadan'], lay: ['egi', 'ahtapot'], code: 'E', desc: 'Egi (kalamar zokası) ve ahtapot zokası; kalamar için gece ışıkta.'},
    sirti: {name: 'Sırtı (trolling)', modes: ['tekne'], fams: ['pelajikb', 'yirtici'], lay: ['sirti'], code: 'S', desc: 'Seyir hâlinde sahte yem çekme: palamut, lüfer, lambuka, akya.'},
    orkinos: {name: 'Orkinos (büyük oyun)', modes: ['tekne'], fams: ['buyuk'], lay: ['chunking', 'popping', 'agirjig', 'agirsirti'], code: 'O', desc: 'Chunking, popping, ağır jig ve ağır sırtı. Ağır takım ve tecrübe ister.'},
    surf: {name: 'Surf (kıyıdan dibe atma)', modes: ['kiyi'], fams: ['sk', 'so', 'kum', 'yirtici'], lay: ['paternoster', 'kaydirmali'], code: 'K', desc: 'Uzun kamışla dibe atma: çipura, mırmır, sargoz, levrek, minakop.'},
    lrf: {name: 'LRF (hafif kıyı)', modes: ['kiyi'], fams: ['sk', 'kaya', 'pelajikk', 'yirtici'], lay: ['lrf'], code: 'L', desc: '1–7 g jighead ve silikonla istavrit, iskorpit, isparoz, küçük levrek.'},
    spin: {name: 'Spin (sahte yem atıp sarma)', modes: ['kiyi', 'tekne'], fams: ['yirtici', 'pelajikb'], lay: ['spin'], code: 'P', desc: 'Maket balık ve metal jigle levrek, lüfer, palamut, akya.'},
    samandira: {name: 'Şamandıralı', modes: ['kiyi', 'tekne'], fams: ['sk', 'kefal', 'pelajikk', 'yirtici'], lay: ['samandira'], code: 'Ş', desc: 'Kefal, melanurya, zargana, izmarit; canlı karidesle levrek.'},
  };
  // dip standartları (cm, g): porsiyon/trofe × gündüz/gece; kayalıkta kısa köstek
  const STD = {porsiyon: {gunduz: {ust: 25, orta: 30, hirsiz: 80, ara: 50}, gece: {ust: 25, orta: 30, hirsiz: 70, ara: 50}, g: [100, 120], max: 150},
    trofe: {gunduz: {ust: 35, orta: 40, hirsiz: 100, ara: 70}, gece: {ust: 30, orta: 35, hirsiz: 90, ara: 70}, g: [150, 180], max: 180}};
  // düzenler: yuvalar [anahtar, etiket, tür, rol]; rol: hook (aile iğnesi), hook+ (bir boy büyük), braid/beden/kostek/sok/mono (aile çapları), lure:<tip>
  const LAY = {
    hirsizli: {name: 'Hırsızlı (3 iğne)', slots: [['ust', 'Üst', 'hook'], ['orta', 'Orta', 'hook'], ['hirsiz', 'Hırsız', 'hook+'], ['braid', 'Ana ip', 'braid'], ['beden', 'Beden', 'beden'], ['kostek', 'Köstek', 'kostek']]},
    iki: {name: '2 iğneli', slots: [['ust', 'Üst', 'hook'], ['hirsiz', 'Alt (hırsız)', 'hook+'], ['braid', 'Ana ip', 'braid'], ['beden', 'Beden', 'beden'], ['kostek', 'Köstek', 'kostek']]},
    tek: {name: 'Tek iğne (uzun köstek)', slots: [['igne', 'İğne', 'hook+'], ['braid', 'Ana ip', 'braid'], ['beden', 'Beden', 'beden'], ['kostek', 'Köstek', 'kostek']]},
    kaydirmali: {name: 'Kaydırmalı kurşun (tek iğne)', slots: [['igne', 'İğne', 'hook'], ['braid', 'Ana ip', 'braid'], ['kostek', 'Köstek', 'kostek']]},
    canli: {name: 'Canlı yem takımı', slots: [['igne', 'İğne', 'hook'], ['braid', 'Ana ip', 'braid'], ['beden', 'Beden', 'beden'], ['kostek', 'Köstek', 'kostek']]},
    slowjig: {name: 'Slow jig', slots: [['yem', 'Jig', 'lure:slowjig'], ['igne', 'Assist', 'assist'], ['braid', 'Ana ip', 'braid'], ['lider', 'Lider', 'kostek']]},
    tairubber: {name: 'Tai rubber', slots: [['yem', 'Tai rubber', 'lure:tairubber'], ['braid', 'Ana ip', 'braid'], ['lider', 'Lider', 'kostek']]},
    inchiku: {name: 'Inchiku', slots: [['yem', 'Inchiku', 'lure:inchiku'], ['braid', 'Ana ip', 'braid'], ['lider', 'Lider', 'kostek']]},
    capari: {name: 'Çapari', slots: [['yem', 'Çapari', 'lure:sabiki'], ['braid', 'Ana ip', 'braid']]},
    egi: {name: 'Egi (kalamar zokası)', slots: [['yem', 'Egi', 'lure:egi'], ['braid', 'Ana ip', 'braid'], ['lider', 'Lider', 'kostek']]},
    ahtapot: {name: 'Ahtapot zokası', slots: [['yem', 'Ahtapot zokası', 'lure:ahtapot'], ['braid', 'Ana ip', 'braid'], ['lider', 'Lider', 'kostek']]},
    sirti: {name: 'Sırtı', slots: [['yem', 'Sırtı yemi', 'lure:trolling'], ['ana', 'Ana ip', 'mono'], ['lider', 'Lider', 'kostek']]},
    chunking: {name: 'Chunking (parça yem)', slots: [['igne', 'Circle iğne', 'hook'], ['ana', 'Ana ip', 'mono'], ['lider', 'Lider', 'kostek']]},
    popping: {name: 'Popping / stickbait', slots: [['yem', 'Popper / stickbait', 'lure:popper'], ['braid', 'Ana ip', 'braid'], ['lider', 'Lider', 'kostek']]},
    agirjig: {name: 'Ağır jig', slots: [['yem', 'Jig', 'lure:bigjig'], ['igne', 'Assist', 'assist'], ['braid', 'Ana ip', 'braid'], ['lider', 'Lider', 'kostek']]},
    agirsirti: {name: 'Ağır sırtı', slots: [['yem', 'Sırtı yemi', 'lure:bigtroll'], ['ana', 'Ana ip', 'mono'], ['lider', 'Lider', 'kostek']]},
    paternoster: {name: '2 iğneli paternoster (surf)', slots: [['ust', 'Üst iğne', 'hook'], ['alt', 'Alt iğne', 'hook'], ['ana', 'Ana ip', 'mono'], ['sok', 'Şok lider', 'sok'], ['kostek', 'Köstek', 'kostek']]},
    lrf: {name: 'LRF jighead', slots: [['igne', 'Jighead', 'jighead'], ['yem', 'Silikon', 'lure:soft'], ['braid', 'Ana ip', 'braid'], ['lider', 'Lider', 'kostek']]},
    spin: {name: 'Spin', slots: [['yem', 'Sahte yem', 'lure:minnow'], ['braid', 'Ana ip', 'braid'], ['lider', 'Lider', 'kostek']]},
    samandira: {name: 'Şamandıralı', slots: [['igne', 'İğne', 'hook'], ['yem', 'Şamandıra', 'lure:samandira'], ['ana', 'Ana ip', 'mono'], ['kostek', 'Köstek', 'kostek']]},
  };
  // teknik başına sabit ölçüler (ailelerden bağımsız): ana ip ve lider çapları, kurşun/yem ağırlığı, boylar
  const FIX = {
    slowjig: {braid: [0.20, 0.285], kostek: [0.40, 0.57], g: [100, 250], assist: ['1/0', '3/0'], len: {lider: 400}},
    tairubber: {braid: [0.148, 0.205], kostek: [0.30, 0.40], g: [60, 150], len: {lider: 400}},
    inchiku: {braid: [0.165, 0.235], kostek: [0.35, 0.45], g: [80, 200], len: {lider: 400}},
    capari: {braid: [0.165, 0.235], g: [30, 80], sabiki: ['12', '6']},
    egi: {braid: [0.128, 0.165], kostek: [0.20, 0.28], egi: '2,5–3,5', len: {lider: 200}},
    ahtapot: {braid: [0.235, 0.285], kostek: [0.50, 0.70], len: {lider: 100}},
    sirti: {mono: [0.40, 0.60], kostek: [0.50, 0.70], len: {lider: 300}},
    chunking: {mono: [0.70, 0.90], kostek: [0.90, 1.20], hook: {p: ['circle'], w: ['7/0', '10/0'], big: true}, len: {lider: 400}},
    popping: {braid: [0.405, 0.52], kostek: [1.20, 1.60], g: [100, 200], len: {lider: 250}},
    agirjig: {braid: [0.37, 0.47], kostek: [1.00, 1.40], g: [200, 400], assist: ['7/0', '10/0'], len: {lider: 300}},
    agirsirti: {mono: [0.80, 1.00], kostek: [1.50, 2.00], len: {lider: 400}},
    paternoster: {mono: [0.30, 0.35], sok: [0.50, 0.60], g: [80, 150], len: {kostek: 35, ara: 60}},
    lrf: {braid: [0.104, 0.128], kostek: [0.18, 0.25], jighead: ['8', '4'], g: [1, 7], len: {lider: 100}},
    spin: {braid: [0.148, 0.205], kostek: [0.30, 0.45], g: [10, 40], len: {lider: 100}},
    samandira: {mono: [0.20, 0.26], kostek: [0.16, 0.22], g: [2, 8], hook: {p: ['aberdeen', 'chinu', 'maruseigo'], jp: [1, 3], w: ['12', '6']}, len: {kostek: 50}},
  };
  const REGIONS = [['ege', 'Ege'], ['marmara', 'Marmara'], ['karadeniz', 'Karadeniz'], ['akdeniz', 'Akdeniz']];
  return {PAT, COMPAT, HOOK, LINE, LURE, SPECIES, FAM, TECH, STD, LAY, FIX, REGIONS};
})();
// konumdan kaba bölge tahmini (kullanıcı değiştirebilir)
function regionOf(L){
  if (!L) return 'ege';
  if (L.lat > 40.9 && L.lon > 27.6) return 'karadeniz';
  if (L.lat > 40.25 && L.lat < 41.15 && L.lon > 26.6 && L.lon < 29.95) return 'marmara';
  if (L.lat < 36.95 && L.lon > 28.2) return 'akdeniz';
  return 'ege';
}
