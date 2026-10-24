// ---------------------------------------------------------------- 60 · ortak çizim parçaları
const STAR = on => '<svg viewBox="0 0 24 24" class="' + (on ? 'on' : 'off') + '" stroke-width="1.6"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z"/></svg>';
const starsHtml = n => '<span class="stars" role="img" aria-label="' + n + ' yıldız">' + [1, 2, 3, 4, 5].map(i => STAR(i <= n)).join('') + '</span>';
const FISH = on => '<svg viewBox="0 0 24 16" class="' + (on ? 'on' : 'off') + '" stroke-width="1.4"><path d="M2 8c3-4.6 7.4-6 11.4-4.4 2.2.9 3.8 2.4 4.6 4.4-.8 2-2.4 3.5-4.6 4.4C9.4 14 5 12.6 2 8z"/><path d="M18 8l4-3.4v6.8z"/></svg>';
// 5 balık: üstte 3, altta 2; her balık %20
const fishHtml = n => '<span class="fi" role="img" aria-label="5 balıktan ' + n + '"><span>' + [1, 2, 3].map(i => FISH(i <= n)).join('') + '</span><span>' + [4, 5].map(i => FISH(i <= n)).join('') + '</span></span>';
// ok: gittiği yöne bakar (rüzgâr ve dalga "geldiği" yön verilir → +180°)
const arrowTo = deg => deg == null ? '' : '<svg class="arr" viewBox="0 0 16 16" style="transform:rotate(' + Math.round(deg) + 'deg)" aria-hidden="true"><path d="M8 1l4.5 9H9v5H7v-5H3.5z"/></svg>';
const arrowFrom = deg => deg == null ? '' : arrowTo(deg + 180);
function wxIcon(x, isNight){
  const night = isNight != null ? isNight : (x.h < 7 || x.h >= 19), c = x.cloud == null ? 50 : x.cloud, r = x.rain || 0, p = x.pop || 0;
  const sun = night ? '<path d="M15 4a6 6 0 1 0 5 9 7 7 0 0 1-5-9z" fill="var(--muted)"/>' : '<circle cx="12" cy="12" r="4.2" fill="var(--gold-fill)"/>';
  const cloud = (y, fill) => '<path d="M6 ' + (y + 6) + 'h11a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.4-1.6A3.6 3.6 0 0 0 6 ' + (y + 6) + 'z" fill="' + fill + '" stroke="var(--muted)" stroke-width=".8"/>';
  let inner = '';
  if (c < 30) inner = sun; else if (c < 70) inner = '<g transform="translate(3,-3) scale(.8)">' + sun + '</g>' + cloud(8, 'var(--surface)'); else inner = cloud(7, 'var(--line)');
  if (r >= 0.2 || p >= 60) inner += '<path d="M8 19l-1 3M12 19l-1 3M16 19l-1 3" stroke="var(--buy)" stroke-width="1.6" stroke-linecap="round"/>';
  return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' + inner + '</svg>';
}
const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3v14a6 6 0 1 1-6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="3.5" r="2" fill="currentColor"/></svg>';
// rig kartında bir yuva: envanter seviyesinde stok durumu, Türkiye seviyesinde envanterde mi / alınacak mı
function compRow(rg, sl, tier){
  tier = tier || 'envanter';
  if (tier === 'envanter') {
    const e = sl.t.envanter || {}; const it = e.item && ITEMS[e.item];
    const st = slotStock(sl);
    const u = it ? unitOf(it) : 'durum'; const q = e.item && u !== 'durum' ? qtyOf(e.item + '|' + (e.size || '-')) : null;
    const nm = it ? it.name : (e.name || (sl.t.turkiye && sl.t.turkiye.name ? '— (envanterde yok)' : '—'));
    // v0.23: satıra dokununca parça sayfası (55-part.js): envanter, yedekler, yerine alınabilecekler
    return '<button type="button" class="crow tap" data-part="' + esc(rg.id + '|' + sl.k) + '"><span class="k">' + esc(sl.label) + '</span><span class="v">' + esc(nm) + (e.size ? ' <b>' + esc(e.size) + '</b>' : '') + (sl.ov ? ' <small class="ovt">değiştirildi</small>' : '') +
      '</span><span class="s"><span class="dot ' + st + '"></span>' + ST_TXT[st] + (q != null && q > 0 ? ' · ' + q + ' ' + (u === 'paket' ? 'paket' : 'adet') : '') + '<i class="chev" aria-hidden="true">›</i></span></button>';
  }
  const t = sl.t[tier] || {};
  const nm = t.item && ITEMS[t.item] ? ITEMS[t.item].name : (t.name || '—');
  const right = tier === 'turkiye' ? (t.item ? '<span class="dot var"></span>Envanterde' : t.store ? '<span class="dot alinacak"></span>Mağaza ' + esc(t.store) : '<span class="dot alinacak"></span>Alınacak') : '';
  return '<div class="crow"><span class="k">' + esc(sl.label) + '</span><span class="v">' + esc(nm) + (t.size ? ' <b>' + esc(t.size) + '</b>' : '') + '</span><span class="s">' + right + '</span></div>';
}
function lengthsTxt(ld){
  if (!ld) return '';
  const parts = Object.keys(LEN_LBL).filter(k => ld[k] != null).map((k, i) => (i === 0 ? LEN_LBL[k].charAt(0).toUpperCase() + LEN_LBL[k].slice(1) : LEN_LBL[k]) + ' ' + ld[k] + ' cm' + (k === 'hirsiz' && ld.short ? ' (akış için %' + (ld.short === true ? 20 : ld.short) + ' kısa)' : ''));
  if (ld.kursun && ld.shore) parts.push('kurşun <b>' + ld.kursun + '</b>' + (ld.extra ? ' (+' + ld.extra + ' g ' + ld.shoreWhy.join(' ve ') + ' için, çapalı kurşun)' : '') + (ld.over ? ' · <b class="warn">atış sınırı ' + ld.max + ' g: daha korunaklı bir nokta seç</b>' : ''));
  else if (ld.kursun) parts.push('kurşun <b>' + ld.kursun + '</b>' + (ld.extra ? ' (+' + ld.extra + ' g sürüklenme' + (ld.depth ? '' : ', ' + DEPTH_REF + ' m varsayıldı') + (ld.capped ? ', üstü kamış sınırı' : '') + ')' : '') +
    (ld.over ? ' · <b class="warn">gereken ≈ ' + ld.need + ' g, kamış sınırı ' + ld.max + ' g: paraşüt çapa at, motorla karşıla ya da demirle</b>' : ''));
  return parts.join(' · ');
}
// yem satırı: rigin kendi yemleri (elinde mi), elinde başka uygun yem varsa o; hiçbiri yoksa "gitmeden al"
function baitHtml(rg, tier){
  const p = baitPick(rg, tier); const bi = p.list.filter(x => x.st || !LURE_WORDS.test(trLower(x.t)));   // çapari, egi, sahte yem: yem değil
  if (!bi.length) return p.list.length ? '<span class="note">Yem gerekmez (sahte yem / çapari)</span>' : esc(rg.baitText || '');
  const own = bi.filter(x => x.src === 'rig'); const show = own.length ? own.slice(0, 2) : bi.slice(0, 2);
  const mark = x => x.st ? ' <span class="dot ' + (x.st === 'var' ? 'var' : 'yok') + '" title="' + (x.st === 'var' ? 'elinde' : 'elinde yok') + '"></span>' : '';
  let h = show.map((x, i) => (i && own.length ? 'alt: ' : '') + esc(x.t) + mark(x)).join(' · ');
  const extraHave = p.have.filter(x => !show.includes(x));
  if (extraHave.length && !show.some(x => x.st === 'var')) h += ' · <b>elindeki uygun yem: ' + extraHave.slice(0, 2).map(x => esc(x.t)).join(', ') + '</b>';
  else if (extraHave.length) h += ' · elinde ayrıca: ' + extraHave.slice(0, 2).map(x => esc(x.t)).join(', ');
  if (!p.have.length && bi.some(x => x.st)) h += ' · <span class="warnt">elinde yok, gitmeden al</span>';
  return h;
}
// opt: {tune: bugünkü ayar satırları (52-tune.js), foot: kartın altına (Bağladım satırı)}
function rigCard(rg, dd, why, extra, tier, x, opt){
  tier = tier || 'envanter'; opt = opt || {};
  if (tier === 'dunya' && rg.sys !== 'ozel') tier = 'turkiye';   // dünya seviyesi yalnız 32'lik özel sistemde
  const ok = ready(rg), sub = !ok && opt.sub && opt.sub.complete ? opt.sub : null; const ld = leadFor(rg, dd, x);
  const chips = [];
  (rg.bottom || []).forEach(b => chips.push('<span class="chip">' + esc(BOTTOM_TXT[b] || b) + '</span>'));
  if (rg.core) chips.push('<span class="chip gold">12 ay</span>');
  if (rg.season && rg.season.length) chips.push('<span class="chip C">' + (rg.season.length > 4 ? MON3[rg.season[0] - 1] + '–' + MON3[rg.season[rg.season.length - 1] - 1] : rg.season.map(m => MON3[m - 1]).join(' ')) + '</span>');
  if (rg.current) chips.push('<span class="chip">Akıntıda</span>');
  if (rg.window) chips.push('<span class="chip">' + rg.window.join('–') + '</span>');
  if (rg.mode === 'kiyi') chips.push('<span class="chip">Kıyı</span>');
  const notes = (rg.notes || []).map(n => '<span><b>' + esc(n.k) + ':</b> ' + esc(n.t) + '</span>');
  const other = TIERS.filter(x => x !== tier && x !== 'dunya');   // Notlar ve diğer seviyeler: dünyanın en iyisi gösterilmez
  // v0.23: kamış, makine ve terminal (fırdöndü, boncuk, kurşun) burada yazılmaz: elindekidir, "en iyisi" yoktur.
  // "Türkiye'de en iyi" envanterdeki kalemi gösteriyorsa (aynı ürün) yazılmaz; envanterdeki başka uygun kalemse "Envanterinde uygun", mağaza ürünüyse "Türkiye'de bulunur".
  const nrm = v => trLower(v).replace(/[^\p{L}\p{N}\/.,:]+/gu, ' ').trim();
  const tName = t => t.item && ITEMS[t.item] ? ITEMS[t.item].name + (t.size ? ' ' + t.size : '') : (t.raw || [t.name, t.size].filter(Boolean).join(' '));
  const alt = rg.slots.filter(sl => !['rod', 'reel', 'term'].includes(sl.kind)).map(sl => {
    const mine = tName(sl.t.envanter || {});
    const parts = other.map(x => { const t = sl.t[x] || {}; const nm = tName(t); if (!nm || nrm(nm) === nrm(mine) && x !== 'envanter') return '';
      if (x === 'envanter') return 'Envanterimden: ' + esc(nm);
      return (t.item ? 'Envanterinde uygun: ' : 'Türkiye’de bulunur: ') + esc(nm) + (t.store && !t.raw ? ' · mağaza ' + esc(t.store) : ''); }).filter(Boolean);
    return parts.length ? '<span><b>' + esc(sl.label) + ':</b> ' + parts.join(' · ') + '</span>' : ''; }).join('');
  const head = (rg.code ? rg.code + ' · ' : '') + (rg.groupName || sysName(rg.sys));
  const bait = baitHtml(rg, tier);
  const succ = rg.success && rg.success[tier] ? 'başarı %' + rg.success[tier] : '';
  return '<article class="rig' + (ok || sub ? '' : ' off') + '"><div class="rig-h"><div><div class="code">' + esc(head) + '</div><h3>' + esc(rg.name) + '</h3>' +
    '<div class="tg">' + esc(rg.target || '') + (rg.baitText ? ' · ' + esc(rg.baitText) : '') + '</div></div>' +
    (ok ? '<span class="chip A">Hazır</span>' : sub ? '<span class="chip B">Yedekle hazır</span>' : '<span class="chip buy">Tamamlanmadı</span>') + '</div>' +
    (why && why.length ? '<div class="meta why">' + esc(why.join(' · ')) + '</div>' : '') + (extra || '') +
    (chips.length ? '<div class="meta chips">' + chips.join('') + '</div>' : '') +
    (tier !== 'envanter' ? '<div class="tierline">' + esc(TIER_TXT[tier]) + '</div>' : '') +
    rg.slots.map(sl => compRow(rg, sl, tier)).join('') +
    (sub ? '<div class="crow subrow"><span class="k">Yedek</span><span class="v">' + sub.list.map(c => esc(c.txt)).join('<br>') + '</span><span class="s"><span class="dot var"></span>elinde</span></div>' : '') +
    (bait ? '<div class="crow"><span class="k">Yem</span><span class="v">' + bait + '</span><span class="s">' + succ + '</span></div>' : '') +
    (ld && lengthsTxt(ld) ? '<div class="crow"><span class="k">Takım</span><span class="v">' + lengthsTxt(ld) + (rg.own ? ' (kayalık, kısa)' : '') + '</span><span class="s"></span></div>' : '') +
    (opt.tune && opt.tune.length ? '<div class="tune"><b class="tuneh">Bugünkü ayar</b>' + opt.tune.map(t => '<div class="tl' + (t.warn ? ' warn' : '') + '"><span class="k">' + esc(t.k) + '</span><span class="v">' + esc(t.t) + '</span></div>').join('') + '</div>' : '') +
    '<details><summary>Notlar ve diğer seviyeler</summary><div class="more">' + notes.join('') + alt + '</div></details>' + (opt.foot || '') + '</article>';
}
// menü satırı ve sayfa (sheet) başlığı
const sheetBar = (title, right, close) => '<div class="bar"><button class="btn" type="button" data-close>' + (close || 'Geri') + '</button><h3 id="sheetTitle">' + esc(title) + '</h3>' + (right || '<span style="width:64px"></span>') + '</div>';
const segBtns = (name, opts, cur) => '<div class="seg wrapseg">' + opts.map(([v, t]) => '<button class="btn small" type="button" data-set="' + name + '" data-val="' + esc(v) + '" aria-pressed="' + (String(cur) === String(v)) + '">' + esc(t) + '</button>').join('') + '</div>';
