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
function compRow(rg, k){
  const c = rg.components[k].envanter; const it = c.item && ITEMS[c.item];
  const st = c.item ? stockOf(c.item, c.size) : 'yok';
  const q = c.item ? S.qty[c.item + '|' + (c.size || '-')] : undefined;
  const lbl = {var: 'Var', az: 'Az', bitti: 'Bitti', alinacak: 'Alınacak', yok: 'Yok'}[st];
  return '<div class="crow"><span class="k">' + POS[k] + '</span><span class="v">' + esc(it ? it.name : c.name) + (c.size ? ' <b>' + esc(c.size) + '</b>' : '') +
    '</span><span class="s"><span class="dot ' + st + '"></span>' + lbl + (q !== undefined && q !== '' ? ' · ' + esc(q) + ' adet' : '') + '</span></div>';
}
function rigCard(rg, dd, why, extra){
  const ok = ready(rg); const ld = leadFor(rg, dd);
  const chips = [];
  rg.bottom.forEach(b => chips.push('<span class="chip">' + esc(BOTTOM_TXT[b] || b) + '</span>'));
  if (rg.must_prepare) chips.push('<span class="chip gold">12 ay</span>');
  if (rg.season_months) chips.push('<span class="chip C">' + MON3[rg.season_months[0] - 1] + '–' + MON3[rg.season_months[rg.season_months.length - 1] - 1] + '</span>');
  if (rg.when_current) chips.push('<span class="chip">Akıntıda</span>');
  if (rg.window) chips.push('<span class="chip">' + rg.window.join('–') + '</span>');
  const notes = [];
  if (rg.v2_change) notes.push('<span><b>v2:</b> ' + esc(rg.v2_change) + '</span>');
  rg.warnings.forEach(w => { if (!/mevsimi/.test(w)) notes.push('<span><b>Not:</b> ' + esc(w) + '</span>'); });
  rg.v1_notes.forEach(w => notes.push('<span><b>v1:</b> ' + esc(w) + '</span>'));
  const alt = Object.keys(POS).map(k => '<span><b>' + POS[k] + ':</b> ' + esc(rg.components[k].dunya.raw) + ' · mağaza: ' + esc(rg.components[k].magaza.raw) + '</span>').join('');
  return '<article class="rig' + (ok ? '' : ' off') + '"><div class="rig-h"><div><div class="code">' + rg.code + ' · ' + esc(SETUPS[rg.setup].name) + '</div><h3>' + esc(rg.name) + '</h3>' +
    '<div class="tg">' + esc(rg.target_text) + ' · ' + esc(rg.bait_text) + '</div></div>' +
    (ok ? '<span class="chip A">Hazır</span>' : '<span class="chip buy">Tamamlanmadı</span>') + '</div>' +
    (why && why.length ? '<div class="meta why">' + esc(why.join(' · ')) + '</div>' : '') + (extra || '') +
    '<div class="meta chips">' + chips.join('') + '</div>' +
    Object.keys(POS).map(k => compRow(rg, k)).join('') +
    '<div class="crow"><span class="k">Yem</span><span class="v">' + esc(rg.baits.ana.envanter.replace(/✓/g, '').trim()) + ' · alt: ' + esc(rg.baits.alternatif.envanter.replace(/✓/g, '').trim()) + '</span><span class="s">başarı %' + rg.success.envanter + '</span></div>' +
    (ld ? '<div class="crow"><span class="k">Takım</span><span class="v">Köstek üst ' + ld.ust + ' cm · orta ' + ld.orta + ' cm · hırsız ' + ld.hirsiz + ' cm' + (ld.own ? ' (kayalık, kısa)' : '') +
      ' · köstek arası ' + ld.ara + ' cm · kurşun <b>' + ld.kursun + '</b></span><span class="s"></span></div>' : '') +
    '<details><summary>Notlar ve alternatifler</summary><div class="more">' + notes.join('') + alt + '</div></details></article>';
}
