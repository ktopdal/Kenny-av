// ---------------------------------------------------------------- 08 · ikonlar (v0.29.4)
// Sade çizgi ikonlar (24×24, kalem rengiyle) pastel zeminli yuvarlak rozette. Ton rengi CSS'te (açık ve koyu tema): sea, sand, rock,
// mud, weed, sun, moon, coral, mint. ic('hook') → rozet; ic('hook', 'coral', 'sm') → küçük; icRaw('hook') → yalnız svg.
const ICP = {
  hook: '<circle cx="15" cy="3.6" r="1.4"/><path d="M15 5v8a5 5 0 0 1-10 0v-2.6"/><path d="M5 10.4l2.3 2.2"/>',
  rod: '<path d="M3.5 20.5L20 4"/><path d="M20 4c.9 3.4.9 6.6 0 9.6"/><circle cx="7.2" cy="16.8" r="2.1"/><path d="M12 12l1.4 1.4M15.5 8.5l1.2 1.2"/>',
  reel: '<circle cx="11" cy="11.5" r="5.6"/><circle cx="11" cy="11.5" r="1.7"/><path d="M16.6 11.5H20v3.2"/><path d="M8 19.5h6M11 17.1v2.4"/>',
  line: '<ellipse cx="12" cy="5.5" rx="6" ry="2.2"/><path d="M6 5.5v13M18 5.5v13"/><ellipse cx="12" cy="18.5" rx="6" ry="2.2"/><path d="M8.5 10h7M8.5 13.5h7"/>',
  leader: '<path d="M4 20.5c3.5-1.5 5.5-5 7.5-9s4-6.6 8.5-7"/><circle cx="11.5" cy="11.5" r="1.6"/><path d="M18.5 3.5l1.6 1-1 1.6"/>',
  lure: '<path d="M2.8 12c3-4.2 7.8-5.2 12-3.1L19 6v12l-4.2-2.9C10.6 17.2 5.8 16.2 2.8 12z"/><circle cx="7" cy="11.2" r="1"/><path d="M9 15.5l-.6 3.2 2-1.4"/>',
  sinker: '<circle cx="12" cy="4.4" r="1.6"/><path d="M12 6C8.2 9.8 6.3 13.4 6.3 16a5.7 5.7 0 0 0 11.4 0c0-2.6-1.9-6.2-5.7-10z"/>',
  swivel: '<circle cx="12" cy="4.4" r="2"/><path d="M12 6.4v2"/><rect x="9.8" y="8.4" width="4.4" height="7.2" rx="2.2"/><path d="M12 15.6v2"/><circle cx="12" cy="19.6" r="2"/>',
  bead: '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v4.8M12 16.2V21"/>',
  float: '<path d="M12 2.8v3.4"/><path d="M12 6.2c3.2 2.1 4.3 5 4.3 7.6a4.3 4.3 0 0 1-8.6 0c0-2.6 1.1-5.5 4.3-7.6z"/><path d="M7.9 13.6h8.2"/><path d="M12 18.1v3.1"/>',
  bait: '<path d="M3.5 15.5c2-3.2 4-3.2 6 0s4 3.2 6 0 3.2-3.4 5-1.2"/><path d="M3.5 15.5c-.4.9-.2 1.8.6 2.1"/><circle cx="19.6" cy="13.4" r=".7"/>',
  egi: '<path d="M12 2.8c3.2 3 4.2 7.4 3.2 12.2L12 18l-3.2-3c-1-4.8 0-9.2 3.2-12.2z"/><path d="M9.6 17.8L8 21M12 18.2v3.3M14.4 17.8L16 21"/><path d="M10.2 8.2l3.6 1.6"/>',
  squid: '<path d="M12 2.8c3.1 2.2 4.1 6 3.6 10.2H8.4C7.9 8.8 8.9 5 12 2.8z"/><path d="M9.2 13l-1.3 7.2M11.1 13l-.5 8M12.9 13l.5 8M14.8 13l1.3 7.2"/><circle cx="10.4" cy="9" r=".7"/><circle cx="13.6" cy="9" r=".7"/>',
  jig: '<path d="M8.5 5.5l4.8-2.7 3 3.1-2.4 12.4-2.9 2.4-2.3-2.3z"/><path d="M11 21.2l1.5 1.5"/><circle cx="12.8" cy="6.4" r=".9"/>',
  sabiki: '<path d="M12 2.8v17"/><path d="M12 6.5l4.2 1.4M12 10.5l4.2 1.4M12 14.5l4.2 1.4"/><path d="M16.2 7.9v1.3M16.2 11.9v1.3M16.2 15.9v1.3"/><circle cx="12" cy="20.6" r="1.3"/>',
  boat: '<path d="M3 14.5h18l-3 4.2H6z"/><path d="M12 14.5V3.8l6.2 8H12"/><path d="M2.5 21.5c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 3-1"/>',
  shore: '<path d="M2.5 20.5h19"/><path d="M5.5 20.5l3.2-8.6 3 1"/><path d="M11.7 12.9l7.3-9.4"/><path d="M19 3.5c1.2 3.6 1.2 7.2 0 10.6"/><circle cx="19" cy="15.3" r=".9"/>',
  dip: '<path d="M3 6.5h12l-2.2 3H5.2z"/><path d="M11 9.5v8.3"/><path d="M11 17.6c-1.5 1.6-1.5 3 0 3.7 1.5-.7 1.5-2.1 0-3.7z"/><path d="M11 13.5h4.5v1.6"/><path d="M2.5 21.5h19"/>',
  surf: '<path d="M2.5 20.5h19"/><path d="M5 20.5l3.6-9.5"/><path d="M8.6 11C12 4.6 17 3.8 20.6 7.6"/><circle cx="20.6" cy="9" r="1"/><path d="M15 20.5c1.2-1.6 2.4-1.6 3.6 0"/>',
  troll: '<path d="M2.5 10.5h9.5l-2.1 3H4.6z"/><path d="M12 11c4 1.6 6.3 4.6 9 7.8"/><path d="M19.4 17.6l1.6.8.4-1.8"/><path d="M2.5 17.5c1.6 0 1.6-.8 3.2-.8s1.6.8 3.2.8"/>',
  live: '<path d="M2.8 12c2.6-3.4 6.4-4.2 9.8-2.6l3.4-2.4v10l-3.4-2.4C9.2 16.2 5.4 15.4 2.8 12z"/><circle cx="6.4" cy="11.3" r=".8"/><path d="M19.6 4v7.4a2.4 2.4 0 0 1-4.8 0"/>',
  tuna: '<path d="M2 12c4-5 10.2-6 15-3l4-4v14l-4-4c-4.8 3-11 2-15-3z"/><circle cx="6" cy="11.3" r=".9"/><path d="M11 8.4l1.6-2.6M11 15.6l1.6 2.6"/>',
  lrf: '<circle cx="8.5" cy="8.5" r="3.2"/><path d="M10.8 10.8l6.2 6.2c1 1 2.9.2 2.9-1.6"/><path d="M14.6 20.2l2.1-3.1"/>',
  fish: '<path d="M2.8 12c3-4 7.4-5 11.2-3 1.6.8 2.9 1.8 3.7 3-.8 1.2-2.1 2.2-3.7 3-3.8 2-8.2 1-11.2-3z"/><path d="M17.7 12L21.2 9v6z"/><circle cx="7" cy="11.2" r=".9"/>',
  fishbig: '<path d="M2.2 13.5c3.4-4.6 8.4-5.7 12.8-3.4 1.8.9 3.2 2 4.1 3.4-.9 1.4-2.3 2.5-4.1 3.4-4.4 2.3-9.4 1.2-12.8-3.4z"/><path d="M19.1 13.5L22 10.6v5.8z"/><circle cx="6.6" cy="12.7" r=".9"/><path d="M8.5 3.2l1.6 2.4 1.9-2.6 1.9 2.6 1.6-2.4v3.6H8.5z"/>',
  fishes: '<path d="M2.5 9.5c2-2.7 5-3.4 7.6-2 1 .5 1.9 1.2 2.5 2-.6.8-1.5 1.5-2.5 2-2.6 1.4-5.6.7-7.6-2z"/><path d="M12.6 9.5l2.2-1.9v3.8z"/><path d="M8 16c2.6-3.4 6.4-4.2 9.6-2.6 1.3.7 2.4 1.5 3.1 2.6-.7 1.1-1.8 1.9-3.1 2.6-3.2 1.6-7 .8-9.6-2.6z"/><circle cx="11.4" cy="15.3" r=".8"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  moon: '<path d="M19.6 14.6A8.2 8.2 0 1 1 9.4 4.4a6.6 6.6 0 0 0 10.2 10.2z"/><path d="M16.5 4.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/>',
  sunmoon: '<circle cx="8.6" cy="12" r="3.2"/><path d="M8.6 4.4v1.8M8.6 17.8v1.8M2.4 12h1.8M4.2 7.6l1.2 1.2M4.2 16.4l1.2-1.2"/><path d="M21 15.4a5.4 5.4 0 1 1-4.6-9.1 4.3 4.3 0 0 0 4.6 9.1z"/>',
  sand: '<path d="M2.5 16.5c3.2-2.2 6.3-2.2 9.5 0s6.3 2.2 9.5 0"/><path d="M2.5 20.5h19"/><circle cx="6.5" cy="11.5" r=".9"/><circle cx="12" cy="9.2" r=".9"/><circle cx="17.5" cy="11.5" r=".9"/><circle cx="9.3" cy="13" r=".6"/><circle cx="14.8" cy="13" r=".6"/>',
  sandrock: '<path d="M2.5 20.5h19"/><path d="M4.2 20.5l3.1-7 4 1.1 2.1 5.9"/><path d="M7.3 13.5l1.3-2.6 2.2 1.2"/><path d="M14.5 20.5c2.2-2.4 4.4-2.4 7 0"/><circle cx="17.5" cy="15.5" r=".7"/><circle cx="20" cy="13.8" r=".6"/>',
  rock: '<path d="M2.6 20.5l3-7.6 4.2-3.4 4.1 2.3 3.2-1.3 4.3 10z"/><path d="M9.8 9.5l1 5.2 3.1-2.8M16.5 10.5l.4 4"/>',
  mud: '<path d="M2.5 14.5c2.2-1.6 4.3-1.6 6.5 0s4.3 1.6 6.5 0 4.3-1.6 6 0"/><path d="M2.5 19c2.2-1.6 4.3-1.6 6.5 0s4.3 1.6 6.5 0 4.3-1.6 6 0"/><circle cx="8" cy="9.4" r="1.1"/><circle cx="15.2" cy="8.4" r="1.5"/>',
  karma: '<path d="M2.5 20.5h19"/><path d="M3.8 20.5l2.6-5.3 3.2.9 1.6 4.4"/><path d="M16.4 20.5c0-4.2 1-7.4 3.2-9.6"/><path d="M14.2 20.5c0-3.2-1-5.4-2.6-7"/><circle cx="12.8" cy="18" r=".8"/><circle cx="20.4" cy="17.2" r=".6"/>',
  pin: '<path d="M12 21.2s-6.6-6.3-6.6-11.2a6.6 6.6 0 0 1 13.2 0c0 4.9-6.6 11.2-6.6 11.2z"/><circle cx="12" cy="10" r="2.5"/>',
  depth: '<path d="M12 3v13.5"/><path d="M8 12.7l4 4 4-4"/><path d="M3.5 21h17"/><path d="M5.5 6h3M5.5 9.4h2"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4.4h6V7"/><path d="M6.4 7l1 13.2h9.2l1-13.2"/><path d="M10 11v6M14 11v6"/>',
  merge: '<path d="M6 3v4.5c0 3.4 6 4.4 6 8.4V21"/><path d="M18 3v4.5c0 3.4-6 4.4-6 8.4"/><path d="M8.8 18.4L12 21.4l3.2-3"/>',
  check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
  spark: '<path d="M12 3l1.9 5.3L19 10.2l-5.1 1.9L12 17.4l-1.9-5.3L5 10.2l5.1-1.9z"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  rig: '<path d="M12 2.6v15.6"/><path d="M12 6.8h4.6M12 12h4.6"/><path d="M16.6 6.8c0 1.8 1.6 2 1.6 2.9M16.6 12c0 1.8 1.6 2 1.6 2.9"/><path d="M12 18.2c-1.5 1.5-1.5 2.8 0 3.4 1.5-.6 1.5-1.9 0-3.4z"/>',
  wave: '<path d="M2.5 9c2.4-2 4.8-2 7.1 0s4.8 2 7.1 0 3.4-2 4.8-.9"/><path d="M2.5 15c2.4-2 4.8-2 7.1 0s4.8 2 7.1 0 3.4-2 4.8-.9"/>',
  pencil: '<path d="M4 20l1-4.3L15.8 4.9a2 2 0 0 1 2.9 0l.4.4a2 2 0 0 1 0 2.9L8.3 19z"/><path d="M14 6.7l3.3 3.3"/>',
  one: '<rect x="6" y="5" width="12" height="14" rx="3"/><path d="M12 9v6"/>',
  three: '<rect x="3" y="7" width="5.4" height="10" rx="1.6"/><rect x="9.3" y="7" width="5.4" height="10" rx="1.6"/><rect x="15.6" y="7" width="5.4" height="10" rx="1.6"/>',
  many: '<rect x="3" y="4" width="7.5" height="7" rx="1.6"/><rect x="13.5" y="4" width="7.5" height="7" rx="1.6"/><rect x="3" y="13" width="7.5" height="7" rx="1.6"/><rect x="13.5" y="13" width="7.5" height="7" rx="1.6"/>',
  compass: '<circle cx="12" cy="12" r="8.6"/><path d="M15.4 8.6l-2.2 4.6-4.6 2.2 2.2-4.6z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.4"/><path d="M3.5 9.6h17M8 3v4M16 3v4"/>',
  cart: '<path d="M3 4h2.4l2.4 11.2h10.4L20.6 8H7"/><circle cx="9.4" cy="19.2" r="1.4"/><circle cx="16.6" cy="19.2" r="1.4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>',
  photo: '<rect x="3" y="6" width="18" height="13.5" rx="2.4"/><circle cx="12" cy="12.8" r="3.4"/><path d="M8.4 6l1.3-2.2h4.6L15.6 6"/>',
  book: '<path d="M4 5.2c2.6-1.2 5.4-1.2 8 .6v14.4c-2.6-1.8-5.4-1.8-8-.6z"/><path d="M20 5.2c-2.6-1.2-5.4-1.2-8 .6v14.4c2.6-1.8 5.4-1.8 8-.6z"/>',
  group: '<circle cx="9" cy="8.6" r="3"/><circle cx="16.6" cy="9.6" r="2.4"/><path d="M3.4 19.6c.8-3.4 3-5 5.6-5s4.8 1.6 5.6 5"/><path d="M14.6 14.8c2.8-.4 5 1 6 4.4"/>',
  shield: '<path d="M12 2.8l7.4 3v5.8c0 4.6-3.2 8.2-7.4 9.6-4.2-1.4-7.4-5-7.4-9.6V5.8z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.2"/>',
  chat: '<path d="M4 5.5h16v10.2H10l-4.4 3.6v-3.6H4z"/><path d="M8 10.6h8"/>',
  map: '<path d="M3 6.2l5.6-2.4 6.8 2.4L21 3.8v14l-5.6 2.4-6.8-2.4L3 20.2z"/><path d="M8.6 3.8v14M15.4 6.2v14"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.2l3.4 2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.8a2.2 2.2 0 0 0 4 0"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.6M12 7.6v.2"/>',
  cloud: '<path d="M7 18.5h10.4a4 4 0 0 0 .6-8 5.6 5.6 0 0 0-10.8 1.6A3.3 3.3 0 0 0 7 18.5z"/>',
  key: '<circle cx="8" cy="15.8" r="3.6"/><path d="M10.6 13.2L20 3.8M16.6 7.2l2.4 2.4M14.4 9.4l1.8 1.8"/>',
  box: '<path d="M3.6 7.6L12 3.4l8.4 4.2v8.8L12 20.6l-8.4-4.2z"/><path d="M3.6 7.6L12 11.8l8.4-4.2M12 11.8v8.8"/>',
};
// ses (ton) varsayılanları: ikonun anlamına göre
const ICT = {hook: 'coral', rod: 'mud', reel: 'rock', line: 'sea', leader: 'sea', lure: 'coral', sinker: 'rock', swivel: 'rock', bead: 'coral', float: 'weed',
  bait: 'weed', egi: 'coral', squid: 'moon', jig: 'coral', sabiki: 'mint', boat: 'sea', shore: 'sand', dip: 'sea', surf: 'sand', troll: 'sea', live: 'mint',
  tuna: 'sea', lrf: 'coral', fish: 'mint', fishbig: 'moon', fishes: 'mint', sun: 'sun', moon: 'moon', sunmoon: 'sun', sand: 'sand', sandrock: 'sand',
  rock: 'rock', mud: 'mud', karma: 'weed', pin: 'coral', depth: 'sea', trash: 'coral', merge: 'mint', check: 'mint', spark: 'sun', rig: 'sea', wave: 'sea',
  pencil: 'sand', one: 'mint', three: 'sea', many: 'moon', compass: 'sea', calendar: 'sun', cart: 'sand', gear: 'rock', photo: 'coral', book: 'moon',
  group: 'mint', shield: 'weed', chat: 'sea', map: 'weed', clock: 'moon', bell: 'sun', info: 'sea', cloud: 'sea', key: 'sun', box: 'sand'};
const icRaw = n => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICP[n] || ICP.info) + '</svg>';
const ic = (n, tone, size) => '<span class="ic t-' + (tone || ICT[n] || 'sea') + (size ? ' ' + size : '') + '" data-i="' + n + '" aria-hidden="true">' + icRaw(n) + '</span>';
// tekniğin ikonu (sihirbaz ve rig kartı)
const TECH_IC = {dip: 'dip', canli: 'live', jig: 'jig', capari: 'sabiki', eging: 'squid', sirti: 'troll', orkinos: 'tuna', surf: 'surf', lrf: 'lrf', spin: 'lure', samandira: 'float', 'dip-hirsizli': 'dip'};
// rig satırının ikonu: yuva türü ve etiketinden
function slotIc(sl){
  const k = sl.kind, lb = trLower(sl.label || '');
  if (k === 'rod') return 'rod'; if (k === 'reel') return 'reel';
  if (k === 'hook' || k === 'hook+' || k === 'assist' || k === 'jighead' || /iğne|hırsız|köstek iğ/.test(lb) && k !== 'line') return 'hook';
  if (k === 'lure') { const lt = sl.sp && sl.sp.lt; return lt === 'egi' || lt === 'ahtapot' ? 'egi' : lt === 'sabiki' ? 'sabiki' : lt === 'samandira' ? 'float' : /jig|rubber|inchiku/.test(lt || '') ? 'jig' : 'lure'; }
  if (k === 'term') return /kurşun/.test(lb) ? 'sinker' : /boncuk/.test(lb) ? 'bead' : 'swivel';
  if (k === 'braid' || k === 'mono' || /ana ip/.test(lb)) return 'line';
  return 'leader';
}
