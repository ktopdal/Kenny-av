// ---------------------------------------------------------------- 85 · karşılama (ilk açılış) ve rig sistemi kurulumu girişi
const hasProfileData = () => Object.keys(S.systems).length > 0 || Object.keys(S.inv.items).length > 0 || Object.keys(S.locations).length > 0 || CATCHES.length > 0;
function showWelcome(){
  const w = $('welcome');
  w.innerHTML = '<div class="box">' +
    '<span class="wlogo">' + LOGO + '</span>' +
    '<h2>' + esc(APP_NAME) + '</h2>' +
    '<p class="sub">Hava, deniz, solunar, rig sistemin, envanterin ve avların tek yerde. Nasıl başlamak istersin?</p>' +
    (cloudOn() ? '<button class="btn primary bigbtn" type="button" data-wel="hesap">Hesabımla giriş yap</button>' : '') +
    '<button class="btn ' + (cloudOn() ? '' : 'primary ') + 'bigbtn" type="button" data-wel="kur">Rig sistemimi kur</button>' +
    '<p class="note" id="welKurNote" hidden>Rig Atölyesi bir sonraki sürümde geliyor: nasıl avlandığını, hangi türü hedeflediğini ve takım tercihini sorup sana özel sistemi kuracak. Şimdilik boş başlayabilir, konum ve envanter ekleyebilirsin.</p>' +
    /*@ozel*/(pkgDoor() ? '<button class="btn bigbtn" type="button" data-wel="paket">Özel paketimi aç</button>' : '')/*@end*//*@genel*/''/*@end*/ +
    /*@ozel*/'<form id="welPkg" class="stack" hidden novalidate><label class="f">Paket şifresi<input id="wel-pass" type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
    '<p class="err" id="welErr" hidden></p><button class="btn primary" type="submit" id="welBtn">Aç</button></form>' +
    /*@end*/
    '<button class="btn bigbtn" type="button" data-wel="bulut">Buluttan geri yükle</button>' +
    '<button class="btn linkish" type="button" data-wel="bos">Boş başla</button>' +
    '</div>';
  w.hidden = false;
}
function hideWelcome(keep){ $('welcome').hidden = true; $('welcome').innerHTML = ''; if (!keep && !S.onboarded) { S.onboarded = true; persist(); } }
async function welcomeAction(a){
  if (a === 'kur') { if (typeof startWizard === 'function') { hideWelcome(true); startWizard(); WZ.fromWel = true; } else $('welKurNote').hidden = false; return; }
  if (a === 'paket') { $('welPkg').hidden = false; setTimeout(() => { try { $('wel-pass').focus(); } catch (e) {} }, 50); return; }
  if (a === 'bulut') { hideWelcome(); openMore('yedek'); return; }
  if (a === 'hesap') { hideWelcome(true); openMore('hesap'); return; }
  if (a === 'bos') { hideWelcome(); renderAll(); return; }
}
/*@ozel*/async function welcomePkg(){
  const btn = $('welBtn'); btn.disabled = true; btn.textContent = 'Açılıyor…'; $('welErr').hidden = true;
  const r = await pkgUnlock($('wel-pass').value);
  btn.disabled = false; btn.textContent = 'Aç';
  if (!r.ok) { $('welErr').textContent = r.err; $('welErr').hidden = false; return; }
  importPackage(D); indexAll(); hideWelcome(); renderAll(); loadWeather(); toast('Özel paket açıldı: ' + D.rigs.length + ' rig');
}
/*@end*//*@genel*/async function welcomePkg(){}
/*@end*/// bulunduğun yeri konum olarak ekle (Bugün ekranındaki düğme)
function gpsToLocation(){
  if (!navigator.geolocation) { toast('Konum servisi yok'); return; }
  toast('Konum alınıyor…');
  navigator.geolocation.getCurrentPosition(p => {
    addLocation('Bulunduğum yer', +p.coords.latitude.toFixed(6), +p.coords.longitude.toFixed(6), '', '');
    renderAll(); loadWeather(); toast('Konum eklendi; adını Daha → Konumlar\'dan değiştirebilirsin');
  }, () => toast('Konum izni verilmedi'), {enableHighAccuracy: true, timeout: 15000});
}
