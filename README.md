# Alyssa by Barbossa App

Deniz avı uygulaması: hava, deniz, solunar, rig sistemleri, envanter ve fotoğraflı av kaydı.

Uygulama boş açılır. Kişisel rig sistemi `paket/ozel.enc.json` içinde şifrelidir (AES-GCM). Bulut yedekleri kullanıcının kendi GitHub deposunda uçtan uca şifreli tutulur. Hava ve deniz verisi Open-Meteo üzerinden gelir.
Güneş ve ay hesapları için [SunCalc](https://github.com/mourner/suncalc) (BSD-2), harita için [Leaflet](https://leafletjs.com) (BSD-2) kullanılır.
Harita verileri: © OpenStreetMap katkıcıları (Nominatim, Overpass), OpenSeaMap, EMODnet Bathymetry ve Geology, Esri uydu görüntüsü.
