// ---------------------------------------------------------------- 07 · iPhone: alttaki sekme çubuğu yerinde kalsın (v0.29.3)
// iOS'ta (özellikle ana ekrana eklenmiş uygulamada) klavye kapandıktan sonra görüntü alanının ölçüsü eski (küçük ya da kayık) kalabiliyor
// (WebKit hatası; iOS 17–18'de ana ekran uygulamasında, iOS 26–27'de visualViewport'ta bildirildi). O zaman alttaki sabit çubuk klavyenin
// üst kenarında, ekranın ortasında kalır ve sayfayı sürükleyince onunla kayar.
// Önlem: klavye (ya da seçim çarkı) açıkken çubuk gizlenir; kapanınca ölçü bozuksa sayfa bir an gizlenip gösterilerek tarayıcıya
// yeniden ölçtürülür (kaydırma yeri korunur). Ekran parmakla yakınlaştırılmışsa dokunulmaz. Her klavye açılışında en çok iki deneme.
const VP = {max: 0, w: 0, fix: 0, tries: 0, last: 0, t: 0};
const vpEdit = el => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
  (el.tagName === 'INPUT' && !/^(button|checkbox|radio|range|file|submit|reset|color|image|hidden)$/i.test(el.type || '')));
const vpTyping = () => vpEdit(document.activeElement);
// en büyük ölçü (klavye kapalıyken); yön değişince sıfırlanır
function vpNote(){
  const w = window.innerWidth; if (Math.abs(w - VP.w) > 40) { VP.w = w; VP.max = 0; }
  if (!vpTyping()) VP.max = Math.max(VP.max, window.innerHeight);
}
// klavye kapalıyken görüntü alanı en büyük ölçüden belirgin küçük ya da kayıksa bozuk
function vpBad(){
  const vv = window.visualViewport, h = window.innerHeight;
  if (vv && Math.abs((vv.scale || 1) - 1) > 0.01) return false;   // yakınlaştırılmış: kullanıcının işi
  if (VP.max && h < VP.max - 40) return true;
  return !!vv && (h - vv.height > 40 || vv.offsetTop > 40);
}
function vpFix(){
  if (vpTyping() || !document.body) return;
  vpNote();
  if (!vpBad() || VP.tries >= 2) return;
  const now = Date.now(); if (now - VP.last < 700) return;
  VP.last = now; VP.tries++;
  const y = window.scrollY, sh = $('sheet'), st = sh ? sh.scrollTop : 0, b = document.body;
  b.style.display = 'none'; void b.offsetHeight; b.style.display = '';   // tam boy öğeyi bir an gizle: WebKit görüntü alanını yeniden ölçer
  window.scrollTo(0, y > 0 ? y - 1 : y + 1); window.scrollTo(0, y);   // bir piksel kaydırıp geri: görünür alan (visualViewport) yeniden eşlenir
  if (sh && !sh.hidden) sh.scrollTop = st;
  VP.fix++;
  setTimeout(vpNote, 60);
}
function vpInit(){
  vpNote();
  const after = () => { clearTimeout(VP.t); VP.t = setTimeout(() => { if (vpTyping()) return; document.body.classList.remove('kb'); vpFix(); setTimeout(vpFix, 450); }, 120); };
  document.addEventListener('focusin', e => { if (!vpEdit(e.target)) return; clearTimeout(VP.t); VP.tries = 0; document.body.classList.add('kb'); });
  document.addEventListener('focusout', after);
  window.addEventListener('resize', vpNote);
  if (window.visualViewport) {
    let raf = 0;
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (!vpTyping() && vpBad()) vpFix(); }); };
    window.visualViewport.addEventListener('resize', on); window.visualViewport.addEventListener('scroll', on);
  }
  const back = () => { VP.tries = 0; setTimeout(vpFix, 300); };
  window.addEventListener('pageshow', back);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) back(); });
}
