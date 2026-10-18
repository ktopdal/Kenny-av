// ---------------------------------------------------------------- 60 · ortak çizim parçaları
const STAR = on => '<svg viewBox="0 0 24 24" class="' + (on ? 'on' : 'off') + '" stroke-width="1.6"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z"/></svg>';
const starsHtml = n => '<span class="stars" role="img" aria-label="' + n + ' yıldız">' + [1, 2, 3, 4, 5].map(i => STAR(i <= n)).join('') + '</span>';
const FISH = on => '<svg viewBox="0 0 24 16" class="' + (on ? 'on' : 'off') + '" stroke-width="1.4"><path d="M2 8c3-4.6 7.4-6 11.4-4.4 2.2.9 3.8 2.4 4.6 4.4-.8 2-2.4 3.5-4.6 4.4C9.4 14 5 12.6 2 8z"/><path d="M18 8l4-3.4v6.8z"/></svg>';
const fishHtml = n => '<span class="fi" role="img" aria-label="' + n + ' balık">' + [1, 2, 3].map(i => FISH(i <= n)).join('') + '</span>';
// ok: gittiği yöne bakar (rüzgâr ve dalga "geldiği" yön verilir → +180°)
const arrowTo = deg => deg == null ? '' : '<svg class="arr" viewBox="0 0 16 16" style="transform:rotate(' + Math.round(deg) + 'deg)" aria-hidden="true"><path d="M8 1l4.5 9H9v5H7v-5H3.5z"/></svg>';
const arrowFrom = deg => deg == null ? '' : arrowTo(deg + 180);
function wxIcon(x){
  const night = x.h < 7 || x.h >= 19, c = x.cloud == null ? 50 : x.cloud, r = x.rain || 0, p = x.pop || 0;
  const sun = night ? '<path d="M15 4a6 6 0 1 0 5 9 7 7 0 0 1-5-9z" fill="var(--muted)"/>' : '<circle cx="12" cy="12" r="4.2" fill="var(--gold-fill)"/>';
  const cloud = (y, fill) => '<path d="M6 ' + (y + 6) + 'h11a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.4-1.6A3.6 3.6 0 0 0 6 ' + (y + 6) + 'z" fill="' + fill + '" stroke="var(--muted)" stroke-width=".8"/>';
  let inner = '';
  if (c < 30) inner = sun; else if (c < 70) inner = '<g transform="translate(3,-3) scale(.8)">' + sun + '</g>' + cloud(8, 'var(--surface)'); else inner = cloud(7, 'var(--line)');
  if (r >= 0.2 || p >= 60) inner += '<path d="M8 19l-1 3M12 19l-1 3M16 19l-1 3" stroke="var(--buy)" stroke-width="1.6" stroke-linecap="round"/>';
  return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' + inner + '</svg>';
}
const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3v14a6 6 0 1 1-6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="3.5" r="2" fill="currentColor"/></svg>';
// rig kartında bir yuva (envanter seviyesi: stok durumu ile)
function compRow(rg, sl){
  const e = sl.t.envanter || {}; const it = e.item && ITEMS[e.item];
  const st = slotStock(sl);
  const q = e.item ? S.inv.qty[e.item + '|' + (e.size || '-')] : undefined;
  return '<div class="crow"><span class="k">' + esc(sl.label) + '</span><span class="v">' + esc(it ? it.name : (e.name || '—')) + (e.size ? ' <b>' + esc(e.size) + '</b>' : '') +
    '</span><span class="s"><span class="dot ' + st + '"></span>' + ST_TXT[st] + (q !== undefined && q !== '' ? ' · ' + esc(q) + ' adet' : '') + '</span></div>';
}
function lengthsTxt(ld){
  if (!ld) return '';
  const parts = Object.keys(LEN_LBL).filter(k => ld[k] != null).map((k, i) => (i === 0 ? LEN_LBL[k].charAt(0).toUpperCase() + LEN_LBL[k].slice(1) : LEN_LBL[k]) + ' ' + ld[k] + ' cm');
  if (ld.kursun) parts.push('kurşun <b>' + ld.kursun + '</b>');
  return parts.join(' · ');
}
function rigCard(rg, dd, why, extra){
  const ok = ready(rg); const ld = leadFor(rg, dd);
  const chips = [];
  (rg.bottom || []).forEach(b => chips.push('<span class="chip">' + esc(BOTTOM_TXT[b] || b) + '</span>'));
  if (rg.core) chips.push('<span class="chip gold">12 ay</span>');
  if (rg.season && rg.season.length) chips.push('<span class="chip C">' + MON3[rg.season[0] - 1] + '–' + MON3[rg.season[rg.season.length - 1] - 1] + '</span>');
  if (rg.current) chips.push('<span class="chip">Akıntıda</span>');
  if (rg.window) chips.push('<span class="chip">' + rg.window.join('–') + '</span>');
  const notes = (rg.notes || []).map(n => '<span><b>' + esc(n.k) + ':</b> ' + esc(n.t) + '</span>');
  const alt = rg.slots.map(sl => '<span><b>' + esc(sl.label) + ':</b> ' + esc((sl.t.dunya && (sl.t.dunya.raw || [sl.t.dunya.name, sl.t.dunya.size].filter(Boolean).join(' '))) || '—') +
    ' · Türkiye: ' + esc((sl.t.turkiye && (sl.t.turkiye.raw || [sl.t.turkiye.name, sl.t.turkiye.size].filter(Boolean).join(' '))) || '—') + '</span>').join('');
  const head = (rg.code ? rg.code + ' · ' : '') + (rg.groupName || sysName(rg.sys));
  const bait = rg.baits ? esc(rg.baits.ana.envanter || rg.baits.ana.turkiye || '') + (rg.baits.alt && (rg.baits.alt.envanter || rg.baits.alt.turkiye) ? ' · alt: ' + esc(rg.baits.alt.envanter || rg.baits.alt.turkiye) : '') : esc(rg.baitText || '');
  return '<article class="rig' + (ok ? '' : ' off') + '"><div class="rig-h"><div><div class="code">' + esc(head) + '</div><h3>' + esc(rg.name) + '</h3>' +
    '<div class="tg">' + esc(rg.target || '') + (rg.baitText ? ' · ' + esc(rg.baitText) : '') + '</div></div>' +
    (ok ? '<span class="chip A">Hazır</span>' : '<span class="chip buy">Tamamlanmadı</span>') + '</div>' +
    (why && why.length ? '<div class="meta why">' + esc(why.join(' · ')) + '</div>' : '') + (extra || '') +
    (chips.length ? '<div class="meta chips">' + chips.join('') + '</div>' : '') +
    rg.slots.map(sl => compRow(rg, sl)).join('') +
    (bait ? '<div class="crow"><span class="k">Yem</span><span class="v">' + bait + '</span><span class="s">' + (rg.success && rg.success.envanter ? 'başarı %' + rg.success.envanter : '') + '</span></div>' : '') +
    (ld && lengthsTxt(ld) ? '<div class="crow"><span class="k">Takım</span><span class="v">' + lengthsTxt(ld) + (rg.own ? ' (kayalık, kısa)' : '') + '</span><span class="s"></span></div>' : '') +
    '<details><summary>Notlar ve alternatifler</summary><div class="more">' + notes.join('') + alt + '</div></details></article>';
}
// menü satırı ve sayfa (sheet) başlığı
const sheetBar = (title, right) => '<div class="bar"><button class="btn" type="button" data-close>Geri</button><h3 id="sheetTitle">' + esc(title) + '</h3>' + (right || '<span style="width:64px"></span>') + '</div>';
const segBtns = (name, opts, cur) => '<div class="seg wrapseg">' + opts.map(([v, t]) => '<button class="btn small" type="button" data-set="' + name + '" data-val="' + esc(v) + '" aria-pressed="' + (String(cur) === String(v)) + '">' + esc(t) + '</button>').join('') + '</div>';
