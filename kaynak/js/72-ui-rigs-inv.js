// ---------------------------------------------------------------- 72 · Rigler ve Envanter
function renderRigs(){
  const n = D.rigs.filter(ready).length;
  $('rigSub').textContent = n + ' rig tamam, ' + (D.rigs.length - n) + ' rig eksik kalem bekliyor. Tamamlanmayanlar soluk görünür ve öneriye girmez.';
  const segs = [['all', 'Tümü'], ['ready', 'Tamam'], ['missing', 'Tamamlanmadı']].concat(D.setups.map(s => [s.id, s.name]));
  $('rigSeg').innerHTML = segs.map(([k, t]) => '<button class="btn small" data-rseg="' + k + '" aria-pressed="' + (ui.rigSeg === k) + '">' + esc(t) + '</button>').join('');
  const q = trLower(ui.q.trim());
  const ds = days(); const dd = ds.find(d => d.key === dateKey(new Date())) || ds[0];
  const list = D.rigs.filter(rg => {
    if (ui.rigSeg === 'ready' && !ready(rg)) return false;
    if (ui.rigSeg === 'missing' && ready(rg)) return false;
    if (SETUPS[ui.rigSeg] && rg.setup !== ui.rigSeg) return false;
    if (!q) return true;
    return trLower([rg.code, rg.name, rg.target_text, rg.bait_text, ...Object.keys(POS).map(k => rg.components[k].envanter.raw)].join(' ')).includes(q);
  });
  $('rigList').innerHTML = list.length ? list.map(rg => rigCard(rg, dd, null)).join('') : '<div class="empty">Bu filtrede rig yok.</div>';
}
const INV_SEG = [['hook', 'İğneler'], ['line', 'İp ve florokarbon'], ['gear', 'Makine ve kamış'], ['jig', 'Jig ve zoka'], ['terminal', 'Terminal ve kurşun'], ['bait', 'Yem']];
const INV_CATS = {hook: ['hook'], line: ['braid', 'fc', 'mono'], gear: ['reel', 'rod'], jig: ['jig'], terminal: ['terminal', 'sinker'], bait: ['bait']};
const UNIT_LBL = {bait: 'paket', sinker: 'adet', reel: 'adet', rod: 'adet', braid: 'makara', fc: 'makara', mono: 'makara', hook: 'adet', jig: 'adet', terminal: 'adet'};
function renderInventory(){
  $('invSeg').innerHTML = INV_SEG.map(([k, t]) => '<button class="btn small" data-iseg="' + k + '" aria-pressed="' + (ui.inv === k) + '">' + t + '</button>').join('');
  const its = D.items.filter(i => INV_CATS[ui.inv].includes(i.cat));
  $('invList').innerHTML = its.map(it => {
    const u = UNIT_LBL[it.cat] || 'adet';
    const q = sizesOf(it).map(sz => {
      const k = it.id + '|' + sz; const st = stockOf(it.id, sz); const v = S.qty[k];
      return '<span class="qty"><span class="lb"><span class="dot ' + st + '"></span>' + (sz !== '-' ? esc(sz) : u) + '</span>' +
        '<button type="button" data-step="-1" data-k="' + esc(k) + '" aria-label="Azalt">−</button>' +
        '<input id="q-' + esc(k.replace(/[^a-z0-9]/gi, '_')) + '" data-qk="' + esc(k) + '" inputmode="numeric" value="' + esc(v == null ? '' : v) + '" placeholder="?" aria-label="' + esc(it.name + ' ' + (sz !== '-' ? sz : '') + ' ' + u) + '">' +
        '<button type="button" data-step="1" data-k="' + esc(k) + '" aria-label="Arttır">+</button></span>';
    }).join('');
    const used = it.used_in && it.used_in.length ? ' <span class="chip">' + it.used_in.length + ' rigde</span>' : '';
    return '<div class="item"><div><div class="nm">' + esc(it.name) + used + (it.store ? ' <span class="store">Mağaza ' + it.store + '</span>' : '') + '</div><div class="sp">' +
      esc([it.type, it.spec, it.use].filter(x => x && x !== '—').join(' · ')) + ' · birim: ' + u + '</div></div><div class="qtys">' + q + '</div></div>';
  }).join('') || '<div class="empty">Bu grupta kalem yok.</div>';
}
