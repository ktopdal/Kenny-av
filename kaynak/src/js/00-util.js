// ---------------------------------------------------------------- 00 · yardımcılar
const APP_NAME = 'Alyssa by Barbossa App', APP_SHORT = 'Alyssa';
const APP_VERSION = '/*__VERSION__*/';
const PREVIEW = /*__PREVIEW__*/false;
const CHANGELOG = [
  {v: '0.21.0', notes: [
    'Takvim uyarısı en çok 3 noktaya bakar; aynı saatte birden çok noktada pencere varsa en iyisini yazar',
    'Kurala hedef tür (mevsiminde ve suyu uygun), su sıcaklığı aralığı, solunar yıldızı ve akıntı aralığı eklendi',
    'Takvim etkinliğinin notunda hazırlık: 3 rig, kurşun, yem ve eksikler; bağlantıya dokununca uygulama o gün ve bölümle Fishing’de açılır',
    'Her akşam ertesi günün özeti tek bir takvim notu olarak (saat seçilebilir)',
    'Alarmlar: çıkıştan önce son hava kontrolü ve bir gün önce hazırlık (yem, eksikler)',
    'Takvime eklenen pencere bozulursa (rüzgâr arttı…) uygulama açılınca üstte söyler; güncelleyince bozulan “İPTAL” olur, kayan pencere yeni saatine taşınır']},
  {v: '0.20.0', notes: [
    'Usta’ya sor: Fishing’den Claude’a sor; bugünkü hava, deniz, solunar ve önerilen riglerin bağlam olarak gider (kendi Claude API anahtarınla; anahtar yalnız bu cihazda, koordinat gitmez)',
    'Deniz tabanı haritası: Harita → Katmanlar → Deniz tabanı (EUSeaMap, bütün Akdeniz; kaya, kum, çamur, çayır). Noktaya dokununca tabanın sınıfı kartta',
    'Dibi bilinmeyen konumda taban tahmini önerilerde yarım ağırlıkla sayılır; Konumlar ve konum kartından “dip olarak yaz”']},
  {v: '0.19.0', notes: [
    'Tür takvimi (Ege): her türün ay ay oltaya gelmesi ve sevdiği su sıcaklığı; öneriler bu ayı ve bugünkü suyu hesaba katar (Daha → Tür takvimi)',
    'Fishing: “Mevsiminde” satırı (bu ay ve bu suda en uygun türler) ve hedef boy seçimi (Hepsi / Porsiyon / Trofe)',
    'Bugünkü ayar: önerilen her rigde koşula göre köstek kalınlığı (ışık ve dip), köstek boyu (akış), kurşun, hedef boya göre iğne; lüfer mevsiminde çelik tel uyarısı',
    'Bağladım → Tuttu / Tutmadı: tek dokunuşla bildir; tutmayan rig benzer koşulda geri planda kalır, tutan öne çıkar. Cevaplanmayan soru Fishing’in üstünde sorulur',
    'Akış 0,7 kn üstünde hırsız köstek %30 kısalır']},
  {v: '0.18.0', notes: [
    'Tablet ve telefon aynı hesapla: bir cihazdaki değişiklik diğerine kendiliğinden geçer (açıksa en geç 30 sn, kapalıysa açılınca)',
    'İki cihazda aynı anda değişiklik olursa birleştirilir (rig sistemleri, konumlar, envanter, ayarlar, avlar ayrı ayrı); aynı şey iki yerde değiştiyse son değiştiren kalır',
    'Hesap: bu cihazın adı, son gelen değişiklik ve “Önceki hâline dön”; yazı boyutu, harita görünümü ve bilgi alanı her cihazda ayrı',
    'Takvim: en çok 3 noktayı yan yana karşılaştır; her gün en iyi nokta işaretli, kara noktası hava satırıyla; satıra dokununca o nokta ve o gün açılır',
  ]},
  {v: '0.17.0', notes: [
    'Konum türü: Deniz, Kıyı (kıyıya 300 m’den yakın kara, kıyıdan av) ya da Kara; kendiliğinden bulunur, Konumlar’dan değiştirilebilir',
    'Karada yalnız hava durumu: balık tahmini, rig önerisi, su sıcaklığı, dalga, akıntı, sürüklenme ve Tekne/Kıyı düğmesi yok; takvim “Hava takvimi” olur, deniz verisi hiç istenmez',
    'Daha sağlam deniz/kara kararı: kıyı çizgisinin hangi tarafı, yükselti (Copernicus 90 m) ve adres; derinlik servisi artık tek başına “deniz” demez',
    'Karadaki noktaya “… açıkları” adı verilmez; eski sürümde yanlış adlanan kara noktaları bir kez düzeltilir',
    'Kıyı noktasında kıyının bakışı kıyı çizgisinden bulunur, kıyı modu kendiliğinden açılır',
  ]},
  {v: '0.16.1', notes: [
    '“Dünyanın en iyisi” seviyesi yalnız 32’lik özel sistemde ve yalnız Rigler ekranındaki seçicide; Rig Atölyesi ve Türlerim rigleri yalnız Envanterimden / Türkiye’de en iyi',
    '“Notlar ve diğer seviyeler” kısmında dünyanın en iyisi artık yok',
  ]},
  {v: '0.16.0', notes: [
    'Yeni Fishing sekmesi (crimson): gün ve gündüz/gece seç → o bölümün solunar pencereleri → yalnızca en uygun 3 rig → en altta 3 saatlik dilimlerle sürüklenme ve kurşun',
    'Solunar, Bunu bağla ve Sürüklenme ve kurşun Bugün ekranından Fishing’e taşındı',
    'Saatlik tablo: bulut % Hava hücresinde, solunar olayları Balık hücresinde (Bulut ve Solunar satırları kalktı); Yağış % ve mm satırları alçak, Balık satırı yüksek; Rüzgâr Yönü',
    'Kapalı bilgi alanında birimler: Uyum kn, Dlg. m, Per. sn, Akın. kn, Sürk. kn',
    'Varsayılan satır düzeni yenilendi (model karşılaştırma satırları kapalı; Görünüm’den açılır)',
    'Harita: yer adı, kıyı ve derinlik geldikçe karta yazılır; deniz/kara kıyı çizgisinin yönünden bulunur (yanlış “Kara” yok); Overpass iki sunucudan sorulur',
    'Harita: Google ve Google uydu altlığı (anahtar varsa); Google bir isteği reddederse sebebi yazılır; Ayarlar → Harita → Google’ı dene',
    'Görünüm → Düzenim: satır, kart, birim ve renk ayarlarını kodla kopyala, diğer cihazda uygula',
  ]},
  {v: '0.15.0', notes: [
    'Saatlik tablo, rüzgâr: “Rüzgâr · Karma” satırı üstteki model seçimini izler; Karma\'da ICON-EU, ICON bitince ECMWF\'ye geçmez, – gösterir',
    'Rüzgâr ve hamle her model için ayrı satır: ICON-EU, ECMWF, GFS (rüzgâr) ve ICON-EU, ECMWF, GFS (hamle); adlar her yerde ICON-EU',
    'Her rüzgâr/hamle hücresinde ana değerin yanında birimi, altında ikinci birim (Görünüm → Birimler\'den seçilir; varsayılan Bft üstte, kn altta)',
    'Sıcaklık birimi °C / °F (Görünüm → Birimler); hava ve su sıcaklığı ayrı satır, değerlerin sağ üstünde ° işareti',
    'Bilgi alanı (satır adları) yalnız dokununca açılır/kapanır; kaydırma ya da model seçimi kapatmaz. Açılınca satırlar uzamaz, tablo zıplamaz',
    'Kısa alt yazılar (Saat, Güneş · Ay: Doğuş · Batış, Yön/Akıntı/Periyot: ok, Sürüklenme: kn, Basınç: hPa · 3 sa ve ↑↓ ok)',
    'Bugün ekranı: Rüzgâr (ICON-EU) ve Hamle (GFS) ayrı kartlarda, altlarında kn ve yön; Su sıcaklığı ve Hava ayrı kart',
    'Veri kaynakları: her modelin bu nokta için kullandığı ızgara noktası ve yüksekliği görünür',
  ]},
  {v: '0.14.0', notes: [
    'Saatlik tablo: satır adları dar sütuna küçülür (Windy gibi), tablo neredeyse tüm ekranı kullanır; ada dokununca tam açılır, kaydırınca yine küçülür',
    'Kapalı rig sistemi artık gözden kaçmaz: Bugün ekranında ve Özel paket sayfasında “kapalı · Aç” uyarısı',
  ]},
  {v: '0.13.0', notes: [
    'Hesap: Google ya da e-postayla giriş (isteğe bağlı). Rigler, envanter, konumlar, ayarlar ve avlar hesabına yazılır; başka telefonda aynı hesapla girince gelir',
    'İlk girişte telefondaki verin hesaba taşınır, hiçbir şey silinmez. Fotoğraflar telefonda kalır; özel paketin şifresi buluta gitmez',
    'Deneme hesabı: ikinci bir e-postayla kayıt ol, “kopyasıyla başla”; denemede yaptıkların asıl hesabına dokunmaz',
    'İki cihazda birden değişiklik olursa hangisinin kalacağını sorar',
  ]},
  {v: '0.12.0', notes: [
    'Türlerim: hedeflediğin türü ekle (yerel adlar da: çinekop, torik, çupra…); ne zaman, kaç metrede, hangi dipte ve yemle tutulduğu yazar',
    'Tür planı: tekne ya da kıyı moduna ve elindeki kamışa göre önerilen takım; neyin elinde olduğu, neyi alman gerektiği',
    '“Alışveriş listesine aktar”: eksikler “İstavrit için” başlığıyla listeye düşer; “Rigi sistemime ekle”: rig Tür planlarım sisteminde, tamamlanınca önerilere girer',
    'Rig Atölyesi rigleri artık kamış, makine ve terminale (fırdöndü, boncuk, kurşun gramı) de bakar; hayalindeki kamışı “alınacak” girersen rig eksik kalır',
    'Rig Atölyesi’nde tür arama: listede olmayan türü seçince uygun teknik de eklenir. Yeni türler: kırma mercan, hani, kaya balığı, gelincik, trakonya, sarıkuyruk',
  ]},
  {v: '0.11.0', notes: [
    'Envanter yeni düzen: makine, kamış, ip, terminal, kurşun ve yemde adet yok; yalnızca var, alınacak ya da yok',
    'İğnede adet ya da paket (Ayarlar → Envanter ya da kalemin üstünden); sayı 0 olunca “bitti · al” olur ve alışveriş listesine düşer. Sayısız işaretlemede boya dokun: var → bitti → yok',
    'Hazır listeler: iğne markaları ve boyları, jig ve zokalar, fırdöndü, boncuk, burç, klips, kurşun gramajları, ölü ve canlı yemler; elindekine dokun, “var” olsun',
    'Yemler adetsiz ve varsayılanı “yok”: avdan önce aldığın yemi işaretle; rig kartı elindeki uygun yemi yazar, yoksa “gitmeden al” der. Rigler yemden bağımsız',
    'Rig Atölyesi’ne Yem adımı: hangi yemlerle avlandığını seç, rigler ona göre sıralansın',
    'Kamış ve makine için tip, boy, en fazla gram, PE; hayalindeki takımı “alınacak” olarak girebilirsin',
    'Alışveriş listesi: mağazaya göre, “bitti ya da alınacak” ve “rigleri tamamlamak için” ayrı; “Aldım” ile envantere işlenir',
  ]},
  {v: '0.10.0', notes: [
    'Ortak av haritası: kapalı grup (sen, Ogün, arkadaşların); grup senin GitHub deponda, grubun anahtarıyla şifreli',
    'Grubu Daha → Ortak av haritası’ndan kur, davet bağlantısını WhatsApp’tan gönder; bağlantıya dokunan gruba katılır',
    'Her av baştan gizli; avın sayfasından “Grupla paylaş”: yer 1 ya da 2 km’lik kareye yuvarlanır, istersen 1–2 gün gecikmeli görünür, fotoğraf gitmez',
    'Haritada “Grup avları” katmanı: kim, hangi tür, kaç kilo, hangi rig ve yem',
  ]},
  {v: '0.9.0', notes: [
    'Paylaş: envanterini ya da Rig Atölyesi sistemini bağlantıyla gönder; açan kişi kendi profiline kopyalar, senin verine dokunamaz',
    'Takvim uyarısı: rüzgâr, dalga ve balık kuralına uyan pencereler alarmıyla telefon takvimine eklenir (.ics) ya da Google Takvim’e',
    'Çıkış listesi: bugünün rigleri için iğne, misina, kurşun ve yem; tekne güvenliği ya da kıyı ekipmanı; işaretler gün boyu saklanır',
    'Güvenlik mesajı: yer (derece-dakika ve harita bağlantısı), dönüş saati ve hava WhatsApp’tan tek dokunuşla',
    'Yedek hatırlatma: bulut yedek kapalıysa ya da 14 günden eskiyse; Daha menüsünde geri bildirim',
  ]},
  {v: '0.8.0', notes: [
    'Kıyı modu: üstteki tekne/kıyı düğmesiyle tek dokunuşta geçilir',
    'Kıyının bakışı: telefonu denize tutup “Pusulayla al”, yönü elle seç ya da haritada kıyıya dokun (kıyı çizgisinden kendiliğinden bulunur)',
    'Rüzgâr kıyıya göre: kıyıya vuran (denizden), kıyıdan esen (karadan) ya da yandan; saatlik tabloda ayrı satır ve kısa yorum',
    'Kıyı deniz sınıfı: kıyıya vuran rüzgâr ve kıyıdaki dalgaya göre; takvim, pencere ve öneriler buna göre',
    'Kıyı rigleri: surf, LRF, spin, şamandıra; kurşun kamışın atış ağırlığına göre, dalga ve akıntıda çapalı kurşun',
  ]},
  {v: '0.7.0', notes: [
    'Harita: üstteki konum adına dokun; haritada bir noktaya dokununca yer adı, derece-dakika koordinat (kopyalanır), kıyıya uzaklık ve EMODnet derinliği gelir',
    'Denizde seçilen noktaya en yakın yerin adıyla ad verilir (ör. “Sığacık açıkları”); koy içindeyse koyun adı',
    '“Bu noktanın tahmini” ve “Kaydet”: nokta derinliğiyle konumlarına eklenir; derinlik kurşun hesabına girer',
    'Katmanlar: harita ya da uydu; deniz işaretleri (OpenSeaMap), derinlik renkleri ve eğrileri (EMODnet), dip türü (AB suları), konumların ve avların',
    'Kayıtlı konumun derinliği boşsa haritadan tek dokunuşla yazılır; Google yer adları için Ayarlar’a anahtar eklenebilir',
  ]},
  {v: '0.6.0', notes: [
    'Saatlik tablo Windy düzeninde: güneş ve ay satırı (ay evresiyle), gece saatleri gri, balık çubukları ve günün eğrisi, basınç grafiği; sıcaklık, yağış, su ve basınç renkli',
    'Hava modeli seçici (Karma, ICON-EU, ECMWF, GFS), ECMWF karşılaştırma satırı ve model uyumu satırı',
    'Yerel rüzgâr adları: Yıldız, Poyraz, Gündoğusu, Keşişleme, Kıble, Lodos, Batı, Karayel; ok rüzgârın gittiği yöne bakar',
    'Gün seçicide her günün rüzgâr şeridi; konum başlığında rüzgâr, dalga ve akıntı pusulası',
    'Görünüm sayfası: tablo satırlarını, Bugün kartlarını ve takvim satırlarını aç, kapat, sırala; rüzgâr birimi (Bft, kn, m/s, km/sa) ve basınç birimi (hPa, mmHg)',
  ]},
  {v: '0.5.0', notes: [
    'Balık tahmini 5 balıkla: üstte 3, altta 2; her balık %20. Ölçek yenilendi: sakin saatte 1–2, iyi pencerede 4–5 balık',
    'Takvim, Bugün ve öneriler aynı hesaptan: en iyi pencere, tepe değeri ve nedeni (major, minor, şafak, alacakaranlık) birbirini tutar; deniz sınıfı da tartılır',
    'Sürüklenme: rüzgâr ve akıntıdan teknenin gidişi; noktanın ne kadar yukarısından başlayacağın; kurşun gramı sürüklenme ve derinliğe göre',
    'Demirli / sürüklenerek seçimi ve teknenin rüzgârdan etkilenme ayarı',
    'Avlarından öğrenme: 5 av kaydından sonra öneriler senin sonuçlarına göre ayarlanır',
    'Teknik kuralları: jig, kalamar, şamandıra, orkinos ve sırtı için koşul uyumu',
  ]},
  {v: '0.4.0', notes: [
    'Rig Atölyesi: nasıl avlandığını, hedef türleri ve takım düzenini sorup sıfırdan rig sistemi kurar (dip, jig, canlı yem, çapari, kalamar, sırtı, orkinos, surf, LRF, spin, şamandıra)',
    'Her rigde üç malzeme seviyesi: dünyanın en iyisi, envanterimden, Türkiye\'de en iyi (envanterde uygunu varsa o); envanter değiştikçe rigler kendiliğinden güncellenir',
    'Rigler ekranında seviye seçici ve sistem araçları (cevapları düzenle, kapat/aç, sil)',
    'Envantere kalem eklerken katalogda arama',
    '40 türlük bilgi tabanı: boy, mevsim, dip, yem ve korunan türler için uyarılar',
  ]},
  {v: '0.3.0', notes: [
    'Yeni ad: Alyssa by Barbossa App',
    'Uygulama şifresiz ve boş açılır; senin rig sistemin şifreli özel paket olarak yeni şifreyle açılır',
    'Bulut yedek: profilin, avların ve fotoğrafların şifrelenip senin GitHub deponda saklanır',
    'Rüzgâr renkleri: 1 Bft yeşil → sarı → kırmızı → 10 Bft mavi (Ayarlar\'dan değiştirilebilir)',
    'Ayarlar: açık/koyu tema, renk paleti, özel renkler, yazı boyutu, koordinat biçimi ve gizleme',
    'Karadaki noktalarda dalga ve akıntı en yakın deniz noktasından gelir; takılan "Yükleniyor" giderildi',
    'Alışveriş listesinde aynı rig iki kez yazılmaz; av formunda yeni noktada dip "Bilinmiyor" gelir',
  ]},
  {v: '0.2.0', notes: [
    'Bugün ekranında saatlik tablo: yağış %, rüzgâr ve hamle (Bft), dalga (m), akıntı (kn), su sıcaklığı, basınç',
    'Her saat için balık simgeli tahmini balık aktivitesi (%)',
    'Rüzgâr ICON-EU 7 km ve ECMWF, hamle GFS, dalga MFWAM modellerinden',
    'Avlar sekmesi: fotoğraf çek ya da galeriden seç; saat, konum ve deniz koşulları kendiliğinden kaydedilir',
    'Tüm tablolarda birimler (cm, g, m, kn, Bft, °C, hPa, %)',
  ]},
  {v: '0.1.0', notes: ['İlk sürüm: Bugün, 15 günlük takvim, rigler, adetli envanter, alışveriş, konumlar, yedek']},
];
document.documentElement.lang = 'tr';
const verGt = (a, b) => { const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); } return false; };
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
const dateKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const trLower = s => String(s).replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr');
const trCmp = (a, b) => String(a).localeCompare(String(b), 'tr');
const KN = 1.943844;
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MON3 = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DIR8 = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
const dir8 = deg => deg == null ? '' : DIR8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const f1 = v => v == null || isNaN(v) ? '–' : v.toFixed(1).replace('.', ',');
const f0 = v => v == null || isNaN(v) ? '–' : String(Math.round(v));
const kn = ms => ms == null ? '–' : String(Math.round(ms * KN));
const num = s => { const n = parseFloat(String(s == null ? '' : s).replace(',', '.')); return isFinite(n) ? n : null; };
const fmtNum = (v, d) => v == null ? '' : String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).replace('.', ',');
const fmtDT = d => d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + hm(d);
const uid = p => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const slugTR = s => trLower(s || '').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// koordinat: ondalık ya da derece-dakika (plotter biçimi)
function ddm(v, pos, neg){ const s = v < 0 ? neg : pos; v = Math.abs(v); let d = Math.floor(v), m = (v - d) * 60; if (m >= 59.9995) { d += 1; m = 0; } return d + '°' + (m < 10 ? '0' : '') + m.toFixed(3).replace('.', ',') + '′ ' + s; }
function fmtCoord(lat, lon, force){
  if (lat == null || lon == null) return '';
  if (!force && S && S.settings.hideCoords) return '•••';
  if (S && S.settings.coord === 'ddm') return ddm(lat, 'K', 'G') + '  ' + ddm(lon, 'D', 'B');
  return lat.toFixed(4) + '°, ' + lon.toFixed(4) + '°';
}

// Beaufort (m/s eşikleri) ve tekne sınıfı: Bft 0–3 = A, 4 = B, 5 = C, 6+ = D
function bft(ms){ if (ms == null) return null; const L = [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7]; for (let i = 0; i < L.length; i++) if (ms < L[i]) return i; return 12; }
function seaClass(ms){ return ms == null ? null : ms <= 5.4 ? 'A' : ms <= 7.9 ? 'B' : ms <= 10.7 ? 'C' : 'D'; }
function waveClass(m){ return m == null ? null : m < 0.5 ? 'A' : m < 1.0 ? 'B' : m < 1.5 ? 'C' : 'D'; }
function bump(c, wave){ if (!c || wave == null) return c; if (wave >= 1.5) return 'D'; if (wave >= 1.0) return c === 'D' ? 'D' : String.fromCharCode(c.charCodeAt(0) + 1); return c; }
const CLS_TXT = {A: 'Çok uygun', B: 'Uygun', C: 'Dikkat', D: 'Uygun değil'};

// renk yardımcıları
const isHex = s => /^#[0-9a-f]{6}$/i.test(String(s || ''));
function hexRgb(h){ h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgbHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function mix(a, b, t){ const x = hexRgb(a), y = hexRgb(b); return rgbHex(...x.map((v, i) => v + (y[i] - v) * t)); }
function relLum(h){ const c = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a, b){ const la = relLum(a), lb = relLum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
const textOn = bg => contrast(bg, '#FFFFFF') >= contrast(bg, '#0A2431') ? '#FFFFFF' : '#0A2431';

function toast(msg){ const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600); }
function distKm(a, b){
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
// bir noktadan belli yön (°) ve uzaklıkta (km) yeni nokta
function offsetPt(p, bearing, km){
  const R = 6371, r = Math.PI / 180, d = km / R, b = bearing * r, la = p.lat * r, lo = p.lon * r;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return {lat: la2 / r, lon: ((lo2 / r + 540) % 360) - 180};
}
// zaman aşımlı fetch: iOS'ta takılan istekler "Yükleniyor"da bekletmesin
async function fetchT(url, opt, ms){
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ac ? setTimeout(() => ac.abort(), ms || 15000) : null;
  try { return await fetch(url, Object.assign({}, opt || {}, ac ? {signal: ac.signal} : {})); }
  finally { if (t) clearTimeout(t); }
}
