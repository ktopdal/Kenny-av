# Kaynak kod · Alyssa by Barbossa App

Yayındaki `index.html` bu dosyalardan derlenir.

- `src/` · `shell.html`, `app.css`, `app2.css`, `app3.css` ve `js/*.js` (dosyalar sıra numarasıyla tek betikte birleşir)
- `vendor/` · SunCalc (BSD-2), güneş ve ay hesapları; Leaflet 1.9.4 (BSD-2), harita
- `build_app3.py` · derleyici: site (`index.html`, `paket/ozel.enc.json`, manifest, service worker, ikonlar) ve Claude önizlemesi
- `qa/v28_check.py`, `qa/v23_ad_check.py`, `qa/v24_ae_check.py`, `qa/v25_af_check.py`, `qa/v26_ag_check.py`, `qa/v27_ah_check.py`, `qa/v28_ai_check.py` (+ `qa/fbmock.py` sahte Firebase, `qa/firebase.test.json`) · uçtan uca testler (Playwright; sahte Open-Meteo, GitHub API, EUSeaMap ve Claude API ile; Rig Atölyesi, öneri motoru, tür takvimi ve su sıcaklığı, bugünkü ayar, bağladım bildirimleri, sürüklenme, öğrenme, görünüm ayarları, harita ve deniz tabanı, kıyı modu, paylaşım, takvim uyarısı, ortak av haritası, envanter, Türlerim, hesap/bulut eşitleme, Usta’ya sor, takvim uyarısı, nokta hafızası, saat saat plan, yem planı, rig parçası, kamış–makine eşleştirmesi, rig şeması, düğümler, hazırlama kartı, rig editörü, rig hazırladım, rig fotoğrafı, yeni takvim sayfası, yatay/dikey gün kartları, tür çizimleri, takım danışmanı (sahte Claude, Gemini ve OpenAI yanıtlarıyla) ve orkinos ağır canlı yem düzeni dahil)

Kişisel rig sistemi ve envanter düz hâliyle bu depoda **yoktur**; yalnızca `paket/ozel.enc.json` içinde AES-GCM ile şifreli durur.
Bulut yedekleri kullanıcının kendi (özel) GitHub deposunda, kullanıcının şifresiyle uçtan uca şifrelenmiş olarak tutulur.

- `firebase.json` · Firebase web yapılandırması (gizli değil; giriş ve bulut için). `vendor/firebase/` · Firebase JS SDK 13.1.0 (Apache-2.0), `entry.js`'den esbuild ile tek dosya.
