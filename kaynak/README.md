# Kaynak kod · Alyssa by Barbossa App

Yayındaki `index.html` bu dosyalardan derlenir.

- `src/` · `shell.html`, `app.css`, `app2.css`, `app3.css` ve `js/*.js` (dosyalar sıra numarasıyla tek betikte birleşir)
- `vendor/` · SunCalc (BSD-2), güneş ve ay hesapları; Leaflet 1.9.4 (BSD-2), harita
- `build_app3.py` · derleyici: site (`index.html`, `paket/ozel.enc.json`, manifest, service worker, ikonlar) ve Claude önizlemesi
- `qa/v11_check.py` · uçtan uca testler (Playwright; sahte Open-Meteo ve sahte GitHub API ile; Rig Atölyesi, öneri motoru, sürüklenme, öğrenme, görünüm ayarları, harita, kıyı modu, paylaşım, takvim uyarısı, ortak av haritası ve envanter düzeni/hazır listeler/yemler dahil)

Kişisel rig sistemi ve envanter düz hâliyle bu depoda **yoktur**; yalnızca `paket/ozel.enc.json` içinde AES-GCM ile şifreli durur.
Bulut yedekleri kullanıcının kendi (özel) GitHub deposunda, kullanıcının şifresiyle uçtan uca şifrelenmiş olarak tutulur.
