# -*- coding: utf-8 -*-
"""Alyssa by Barbossa App derleyici (v0.3+).

src3/ (shell.html, app.css, app2.css, app3.css, js/*.js)  ->
  dist/     GitHub Pages sitesi: index.html (rig verisi YOK), paket/ozel.enc.json (Kenny'nin şifreli özel paketi), manifest, sw.js, ikonlar
  preview/  Claude önizlemesi: tek dosya, özel paket gömülü, örnek hava verisiyle

Paket şifresi: secret/key.json (pass_, salt, iter). Depoya ASLA girmez.
Çalıştır: python3 /home/claude/fishapp/app/build_app3.py
"""
import base64, csv, datetime as dt, glob, hashlib, json, os, re, secrets, shutil

ROOT = '/home/claude/fishapp'
APP = os.path.join(ROOT, 'app')
SRC = os.path.join(APP, 'src3')
DB = os.path.join(ROOT, 'data/kenny_av_db.json')
SUN = os.path.join(APP, 'vendor/suncalc.js')
DIST = os.path.join(APP, 'dist')
PREV = os.path.join(APP, 'preview')
SECRET = os.path.join(ROOT, 'secret/key.json')
FISHCAL = '/home/claude/fishcal/data'
VERSION = '0.15.0'
NAME, SHORT = 'Alyssa by Barbossa App', 'Alyssa'
THEME = '#0B6B7C'


def norm_pass(p):
    p = p.strip().lower().replace('ı', 'i')
    p = re.sub(r'[\s_.,]+', '-', p)
    return re.sub(r'-+', '-', p).strip('-')


def app_data():
    db = json.load(open(DB, encoding='utf-8'))
    keep = ('meta', 'setups', 'items', 'rigs', 'species', 'locations', 'rules', 'stores', 'decisions')
    out = {k: db[k] for k in keep}
    out['seed_status'] = db.get('seed_status', [])   # bitti işaretli kalemler özel veride
    if db.get('settings'):
        out['settings'] = db['settings']   # özel ayarlar (ör. harita anahtarı): yalnızca şifreli pakette
    # sistem adı özel veride (data/…json → meta.system_name); depoda düz hâliyle yer almaz
    body = json.dumps(out, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    out['meta'] = dict(out['meta'], data_version=hashlib.sha1((body + '|v3').encode()).hexdigest()[:10], app_version=VERSION)
    return out


def encrypt(data, k):
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    salt = base64.b64decode(k['salt'])
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=k['iter']).derive(norm_pass(k['pass_']).encode())
    iv = secrets.token_bytes(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), None)
    return dict(v=1, data_version=data['meta']['data_version'], salt=k['salt'], iter=k['iter'],
                iv=base64.b64encode(iv).decode(), ct=base64.b64encode(ct).decode())


def sample():
    """Önizleme için örnek hava/deniz verisi (16 Ekim MET Norway + tide-forecast verisinden, Open-Meteo biçiminde)."""
    rows = []
    for r in csv.DictReader(open(os.path.join(FISHCAL, 'met.csv'), encoding='utf-8')):
        rows.append((dt.datetime.strptime(r['time'], '%Y-%m-%dT%H:%M:%SZ') + dt.timedelta(hours=3), r))

    def interp(t, k):
        for (t0, a), (t1, b) in zip(rows, rows[1:]):
            if t0 <= t <= t1:
                f = (t - t0).total_seconds() / max(1, (t1 - t0).total_seconds())
                return float(a[k]) + f * (float(b[k]) - float(a[k]))
        return None
    start = dt.datetime(2026, 10, 17)
    T = [start + dt.timedelta(hours=i) for i in range(16 * 24)]
    ts = [t.strftime('%Y-%m-%dT%H:%M') for t in T]
    end = rows[-1][0]

    def ser(k, every=1, until=None, rnd=1):
        out = []
        for i, t in enumerate(T):
            v = interp(t, k) if t <= end and (until is None or t < until) and i % every == 0 else None
            out.append(None if v is None else round(v, rnd))
        return out
    icon_until = start + dt.timedelta(days=5)
    fv = lambda every, until: dict(time=ts, temperature_2m=ser('temp', every, until), pressure_msl=ser('press', every, until),
                                   wind_speed_10m=ser('wind', every, until), wind_direction_10m=ser('wdir', every, until, 0),
                                   cloud_cover=ser('cloud', every, until, 0), precipitation=[0.0 if v is not None else None for v in ser('wind', every, until)])
    gust = lambda h, k: [None if v is None else round(v * k, 1) for v in h['wind_speed_10m']]
    icon = dict(hourly=fv(1, icon_until), hourly_units={'wind_speed_10m': 'm/s', 'wind_gusts_10m': 'm/s'}); icon['hourly']['wind_gusts_10m'] = gust(icon['hourly'], 1.3)
    ecm = dict(hourly=fv(3, None), hourly_units={'wind_speed_10m': 'm/s', 'wind_gusts_10m': 'm/s'}); ecm['hourly']['wind_gusts_10m'] = gust(ecm['hourly'], 1.25)
    gw = ser('wind'); gd = ser('wdir', 1, None, 0)
    gfs = dict(hourly=dict(time=ts, wind_speed_10m=[None if v is None else round(v * 1.12, 1) for v in gw], wind_direction_10m=gd,
                           wind_gusts_10m=[None if v is None else round(v * 1.35, 1) for v in gw]), hourly_units={'wind_speed_10m': 'm/s', 'wind_gusts_10m': 'm/s'})
    cl = ser('cloud', rnd=0)
    best = dict(hourly=dict(time=ts, precipitation_probability=[None if c is None else (25 if c > 85 else 10 if c > 50 else 3) for c in cl]), hourly_units={})
    tf = {}
    for r in csv.DictReader(open(os.path.join(FISHCAL, 'tf_sea.csv'), encoding='utf-8')):
        tf.setdefault(r['date'], {})[r['period']] = r
    dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    wh, wd, wp = [], [], []
    for i, t in enumerate(T):
        s = tf.get(t.date().isoformat(), {}).get('N' if t.hour < 7 else 'AM' if t.hour < 13 else 'PM')
        on = s is not None and i % 3 == 0 and t < start + dt.timedelta(days=10)
        wh.append(float(s['wave_h']) if on else None); wd.append(dirs.index(s['wave_dir']) * 22.5 if on else None); wp.append(float(s['wave_t']) if on else None)
    mf = dict(hourly=dict(time=ts, wave_height=wh, wave_direction=wd, wave_period=wp), hourly_units={})
    cv, cd, sst = [], [], []
    for i, t in enumerate(T):
        w = interp(t, 'wind') if t <= end else None
        d = interp(t, 'wdir') if t <= end else None
        cv.append(None if w is None else round(0.03 * w * 3.6, 2))          # km/h (örnek: rüzgâr sürüklenmesi)
        cd.append(None if d is None else round((d + 195) % 360))
        sst.append(round(21.27 - 0.06 * (i / 24 + 1), 1) if i % 6 == 0 and i < 10 * 24 else None)
    mbest = dict(hourly=dict(time=ts, ocean_current_velocity=cv, ocean_current_direction=cd, sea_surface_temperature=sst,
                             wave_height=[None] * len(ts), wave_direction=[None] * len(ts), wave_period=[None] * len(ts)), hourly_units={'ocean_current_velocity': 'km/h'})
    status = dict(icon='ok', ecmwf='ok', gfs='ok', best='ok', mf='ok', mbest='ok')
    return dict(raw=dict(icon=icon, ecmwf=ecm, gfs=gfs, best=best, mf=mf, mbest=mbest), status=status, sample=True)


def assemble(preview, data):
    shell = open(os.path.join(SRC, 'shell.html'), encoding='utf-8').read()
    css = '\n'.join(open(os.path.join(SRC, f), encoding='utf-8').read() for f in ('app.css', 'app2.css', 'app3.css') if os.path.exists(os.path.join(SRC, f)))
    js = '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(SRC, 'js', '*.js'))))
    js = "(function(){\n'use strict';\n" + js + "\n})();"
    js = js.replace('/*__VERSION__*/', VERSION).replace('/*__PREVIEW__*/false', 'true' if preview else 'false')
    fbc = os.path.join(APP, 'firebase.json')   # Firebase web yapılandırması (gizli değil); yoksa giriş kapalı
    js = js.replace('/*__FBCONFIG__*/null', json.dumps(json.load(open(fbc))) if (os.path.exists(fbc) and not preview) else 'null')
    sw = "" if preview else "if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(() => {}); }"
    js = js.replace('/*__SW__*/', sw)
    html = shell.replace('/*__CSS__*/', css).replace('/*__JS__*/', js)
    html = html.replace('/*__SUNCALC__*/', open(SUN, encoding='utf-8').read())
    html = html.replace('/*__DATA__*/', json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') if preview else 'null')
    html = html.replace('/*__SAMPLE__*/', json.dumps(sample(), separators=(',', ':')) if preview else 'null')
    if preview:
        return html.replace('<!--__HEAD__-->', '')
    head = ('<meta name="theme-color" content="%s"><link rel="manifest" href="manifest.webmanifest">'
            '<link rel="apple-touch-icon" href="icon-180.png"><meta name="apple-mobile-web-app-capable" content="yes">'
            '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="%s">'
            '<meta name="apple-mobile-web-app-status-bar-style" content="default"><link rel="icon" href="icon-192.png">') % (THEME, SHORT)
    html = html.replace('<!--__HEAD__-->', head)
    # başlık, meta, bağlantı ve stil <head> içine; işaretleme ve betikler <body> içine (manifest ve iOS ayarları yalnızca head'de okunur)
    cut = html.index('<style id="userTheme"></style>') + len('<style id="userTheme"></style>')
    return ('<!doctype html><html lang="tr"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>'
            + html[:cut] + '</head><body>' + html[cut:] + '</body></html>')


def icons():
    """Alyssa ikonu: deniz mavisi zemin, beyaz olta iğnesi, mercan renkli iğne gözü (uygulamadaki logoyla aynı)."""
    from PIL import Image, ImageDraw
    for size in (180, 192, 512):
        S = 4 * size
        im = Image.new('RGB', (S, S), (11, 107, 124))
        d = ImageDraw.Draw(im)
        s = S / 32.0
        w = max(2, int(2.6 * s))
        white, coral = (244, 248, 249), (255, 139, 96)
        d.line([(16 * s, 6.4 * s), (16 * s, 19 * s)], fill=white, width=w)
        d.arc([(10 * s, 13 * s), (22 * s, 25 * s)], start=0, end=200, fill=white, width=w)
        # yuvarlak uçlar
        for (x, y) in ((16 * s, 6.4 * s),):
            d.ellipse([(x - w / 2, y - w / 2), (x + w / 2, y + w / 2)], fill=white)
        import math
        a = math.radians(200); x, y = 16 * s + 6 * s * math.cos(a), 19 * s + 6 * s * math.sin(a)
        d.ellipse([(x - w / 2, y - w / 2), (x + w / 2, y + w / 2)], fill=white)
        r = 2.2 * s
        d.ellipse([(16 * s - r, 4.2 * s - r), (16 * s + r, 4.2 * s + r)], outline=coral, width=max(2, int(1.4 * s)))
        im = im.resize((size, size), Image.LANCZOS)
        im.save(os.path.join(DIST, 'icon-%d.png' % size))


def main():
    k = json.load(open(SECRET, encoding='utf-8'))
    data = app_data()
    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(os.path.join(DIST, 'paket')); os.makedirs(PREV, exist_ok=True)
    open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8').write(assemble(False, data))
    json.dump(encrypt(data, k), open(os.path.join(DIST, 'paket', 'ozel.enc.json'), 'w'), separators=(',', ':'))
    pdata = dict(data); pdata.pop('settings', None)   # önizleme Claude içinde açılır: özel anahtarlar gömülmez
    open(os.path.join(PREV, 'alyssa_onizleme.html'), 'w', encoding='utf-8').write(assemble(True, pdata))
    json.dump(dict(name=NAME, short_name=SHORT, id='./', start_url='./', scope='./', display='standalone',
                   background_color='#E6EEF0', theme_color=THEME, lang='tr',
                   icons=[dict(src='icon-192.png', sizes='192x192', type='image/png'),
                          dict(src='icon-512.png', sizes='512x512', type='image/png', purpose='any maskable')]),
              open(os.path.join(DIST, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(os.path.join(DIST, 'sw.js'), 'w', encoding='utf-8').write(
        "// Alyssa service worker: önce ağ (güncellemeler hemen gelsin), ağ yoksa son kopya\n"
        "const C='alyssa-%s';\n"
        "self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon-192.png'])).catch(()=>{}));self.skipWaiting();});\n"
        "self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});\n"
        "self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;"
        "e.respondWith(fetch(r,{cache:'no-store'}).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));}return res;}).catch(()=>caches.match(r,{ignoreSearch:true})));});\n" % VERSION)
    open(os.path.join(DIST, '.nojekyll'), 'w').write('')
    open(os.path.join(DIST, 'robots.txt'), 'w').write('User-agent: *\nDisallow: /\n')
    open(os.path.join(DIST, 'README.md'), 'w', encoding='utf-8').write(
        '# %s\n\nDeniz avı uygulaması: hava, deniz, solunar, rig sistemleri, envanter ve fotoğraflı av kaydı.\n\n'
        'Uygulama boş açılır. Kişisel rig sistemi `paket/ozel.enc.json` içinde şifrelidir (AES-GCM). '
        'Bulut yedekleri kullanıcının kendi GitHub deposunda uçtan uca şifreli tutulur. Hava ve deniz verisi Open-Meteo üzerinden gelir.\n'
        'Güneş ve ay hesapları için [SunCalc](https://github.com/mourner/suncalc) (BSD-2), harita için [Leaflet](https://leafletjs.com) (BSD-2), hesap ve bulut için [Firebase JS SDK](https://github.com/firebase/firebase-js-sdk) (Apache-2.0) kullanılır.\n'
        'Harita verileri: © OpenStreetMap katkıcıları (Nominatim, Overpass), OpenSeaMap, EMODnet Bathymetry ve Geology, Esri uydu görüntüsü.\n' % NAME)
    shutil.copy(os.path.join(APP, 'vendor/LICENSE'), os.path.join(DIST, 'LICENSE-suncalc.txt'))
    # harita kütüphanesi (Leaflet, BSD-2): harita ilk açıldığında yüklenir
    os.makedirs(os.path.join(DIST, 'vendor', 'firebase'), exist_ok=True)
    for f in ('fb.js', 'LICENSE'):
        shutil.copy(os.path.join(APP, 'vendor', 'firebase', f), os.path.join(DIST, 'vendor', 'firebase', f))
    os.makedirs(os.path.join(DIST, 'vendor', 'leaflet'), exist_ok=True)
    for f in ('leaflet.js', 'leaflet.css', 'LICENSE'):
        shutil.copy(os.path.join(APP, 'vendor', 'leaflet', f), os.path.join(DIST, 'vendor', 'leaflet', f))
    icons()
    for root, _, files in os.walk(DIST):
        for f in sorted(files):
            p = os.path.join(root, f)
            print('%-28s %8d' % (os.path.relpath(p, DIST), os.path.getsize(p)))
    print('preview', os.path.getsize(os.path.join(PREV, 'alyssa_onizleme.html')), 'data_version', data['meta']['data_version'])


if __name__ == '__main__':
    main()
