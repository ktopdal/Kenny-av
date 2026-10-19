"""Alyssa v0.3–v0.12 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
Çalıştır: python3 /home/claude/fishapp/qa/v12_check.py
"""
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_t'
SHOTS = ROOT + '/qa/v12'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(ROOT + '/app/dist', WWW + '/dist')
prev = open(ROOT + '/app/preview/alyssa_onizleme.html', encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8777
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', WWW], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = 'http://127.0.0.1:%d' % PORT
KEY = json.load(open(ROOT + '/secret/key.json'))
m = re.search(r'<script id="sample" type="application/json">(.*?)</script>', prev, re.S)
SMP = json.loads(m.group(1))['raw']
FAKE_NOW = "const _D=Date;const _base=new _D('2026-10-17T09:30:00+03:00').getTime();const _s=_D.now();class FD extends _D{constructor(...a){if(a.length===0)super(_base+(_D.now()-_s));else super(...a);} static now(){return _base+(_D.now()-_s);}};window.Date=FD;"
calls = []
FAIL = []
def check(cond, msg):
    print(('OK   ' if cond else 'FAIL ') + msg)
    if not cond: FAIL.append(msg)

LAND = lambda lat, lon: 38.40 < lat < 38.50 and 27.15 < lon < 27.25   # sahte kara kutusu (test noktası 38.45, 27.20)
HANG = {'gfs': False}
CORS = {'Access-Control-Allow-Origin': '*'}

async def mock_meteo(route):
    u = route.request.url; q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
    calls.append(u)
    lat, lon = float(q['latitude'][0]), float(q['longitude'][0])
    model = (q.get('models') or [''])[0]
    if 'marine' in u:
        hv = q.get('hourly', [''])[0].split(',')
        if LAND(lat, lon):
            if model:
                return await route.fulfill(status=400, content_type='application/json', headers=CORS, body=json.dumps({'error': True, 'reason': 'No data is available for this location'}))
            h = {'time': SMP['mbest']['hourly']['time']}
            for k in hv: h[k] = [None] * len(h['time'])
            return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'hourly': h, 'hourly_units': {}}))
        if model == 'meteofrance_wave':
            return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps(SMP['mf']))
        h = dict(SMP['mbest']['hourly']); h.update({k: SMP['mf']['hourly'][k] for k in ('wave_height', 'wave_direction', 'wave_period')})
        h = {k: v for k, v in h.items() if k == 'time' or k in hv}
        return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'hourly': h, 'hourly_units': SMP['mbest']['hourly_units']}))
    src = {'icon_eu': 'icon', 'ecmwf_ifs025': 'ecmwf', 'gfs_seamless': 'gfs', 'gfs_global': 'gfs', '': 'best'}.get(model)
    if src == 'gfs' and HANG['gfs']:
        return   # hiç yanıt verme: zaman aşımı testi
    if not src:
        return await route.fulfill(status=400, headers=CORS, body='{}')
    r = SMP[src]
    if src == 'gfs':   # örnek veride GFS yalnızca hamle: rüzgârı ECMWF'den %15 fazlasıyla türet (karşılaştırma satırları için)
        e = SMP['ecmwf']['hourly']; n = len(e['time']); gg = SMP['gfs']['hourly']['wind_gusts_10m']
        h = {k: (list(v) if k == 'time' else [None if x is None else (x * 1.15 if k == 'wind_speed_10m' else x) for x in v]) for k, v in e.items()}
        h['wind_gusts_10m'] = (gg + [None] * n)[:n]
        r = {'hourly': h, 'hourly_units': {'wind_speed_10m': 'm/s', 'wind_gusts_10m': (SMP['gfs'].get('hourly_units') or {}).get('wind_gusts_10m', 'm/s')}}
    if src == 'best':
        h = dict(SMP['ecmwf']['hourly']); h['precipitation_probability'] = SMP['best']['hourly']['precipitation_probability']; h['wind_gusts_10m'] = SMP['gfs']['hourly']['wind_gusts_10m']
        r = {'hourly': h, 'hourly_units': {'wind_speed_10m': 'm/s'}}
    return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps(r))

# ---- sahte GitHub Contents API (bellekte)
GH = {}   # path -> {'bytes': b, 'sha': s}
GH_LOG = []
GOOD_TOKEN = 'test-anahtar-gecerli'
async def mock_gh(route):
    req = route.request
    hdr = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,accept,content-type,x-github-api-version', 'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS'}
    if req.method == 'OPTIONS':
        return await route.fulfill(status=204, headers=hdr)
    p = urllib.parse.urlparse(req.url).path
    mm = re.match(r'/repos/([^/]+/[^/]+)/contents/(.+)$', p)
    GH_LOG.append((req.method, p))
    if not mm: return await route.fulfill(status=404, headers=hdr, body='{}')
    repo, path = mm.group(1), urllib.parse.unquote(mm.group(2))
    if req.headers.get('authorization') != 'Bearer ' + GOOD_TOKEN:
        return await route.fulfill(status=401, headers=hdr, content_type='application/json', body='{"message":"Bad credentials"}')
    if repo != 'kenny/alyssa-yedek':
        return await route.fulfill(status=404, headers=hdr, content_type='application/json', body='{"message":"Not Found"}')
    if req.method == 'GET':
        f = GH.get(path)
        if not f:
            kids = [k for k in GH if k.startswith(path + '/') and '/' not in k[len(path) + 1:]]
            if kids:
                return await route.fulfill(status=200, headers=hdr, content_type='application/json', body=json.dumps([{'name': k.split('/')[-1], 'path': k, 'sha': GH[k]['sha'], 'size': len(GH[k]['bytes']), 'type': 'file'} for k in sorted(kids)]))
            return await route.fulfill(status=404, headers=hdr, content_type='application/json', body='{"message":"Not Found"}')
        if 'raw' in (req.headers.get('accept') or ''):
            return await route.fulfill(status=200, headers=hdr, body=f['bytes'], content_type='application/octet-stream')
        return await route.fulfill(status=200, headers=hdr, content_type='application/json', body=json.dumps({'sha': f['sha'], 'path': path, 'size': len(f['bytes']), 'content': base64.b64encode(f['bytes']).decode(), 'encoding': 'base64'}))
    if req.method == 'PUT':
        body = json.loads(req.post_data)
        cur = GH.get(path)
        if cur and body.get('sha') != cur['sha']:
            return await route.fulfill(status=409, headers=hdr, content_type='application/json', body='{"message":"sha mismatch"}')
        if not cur and body.get('sha'):
            return await route.fulfill(status=422, headers=hdr, content_type='application/json', body='{"message":"sha given but file missing"}')
        b = base64.b64decode(body['content'])
        sha = hashlib.sha1(b).hexdigest()
        GH[path] = {'bytes': b, 'sha': sha}
        return await route.fulfill(status=201 if not cur else 200, headers=hdr, content_type='application/json', body=json.dumps({'content': {'sha': sha, 'path': path}}))
    return await route.fulfill(status=405, headers=hdr, body='{}')

PNG1 = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=')
MAP_LOG = []
async def mock_tiles(route):
    MAP_LOG.append(route.request.url)
    return await route.fulfill(status=200, content_type='image/png', body=PNG1, headers=CORS)

async def mock_geo(route):
    u = route.request.url; MAP_LOG.append(u)
    if 'nominatim' in u:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query); lat, lon = float(q['lat'][0]), float(q['lon'][0])
        if LAND(lat, lon):
            return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'lat': str(lat), 'lon': str(lon), 'name': '', 'address': {'village': 'Test Köyü', 'province': 'İzmir'}}))
        return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'error': 'Unable to geocode'}))
    if 'overpass' in u:
        body = urllib.parse.unquote_plus(route.request.post_data or '')
        mm = re.search(r'around:6000,([-\d.]+),([-\d.]+)', body); lat, lon = float(mm.group(1)), float(mm.group(2))
        els = [{'type': 'way', 'id': 1, 'tags': {'natural': 'coastline'}, 'geometry': [{'lat': lat + 0.02, 'lon': lon - 0.05}, {'lat': lat + 0.02, 'lon': lon + 0.05}]},
               {'type': 'node', 'id': 2, 'lat': lat + 0.03, 'lon': lon, 'tags': {'place': 'village', 'name': 'Deneme'}},
               {'type': 'node', 'id': 3, 'lat': lat + 0.09, 'lon': lon, 'tags': {'place': 'town', 'name': 'Uzakkasaba'}}]
        return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'elements': els}))
    if 'emodnet-bathymetry.eu/depth_sample' in u:
        g = urllib.parse.unquote(urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['geom'][0]); mm = re.search(r'POINT\(([-\d.]+) ([-\d.]+)\)', g)
        lon, lat = float(mm.group(1)), float(mm.group(2))
        if LAND(lat, lon): return await route.fulfill(status=404, headers=CORS, body='{}')
        return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'min': 53.1, 'max': 55.2, 'avg': 54.3, 'smoothed': 54.0}))
    return await route.fulfill(status=404, headers=CORS, body='{}')

async def new_ctx(b, storage=None, w=390):
    ctx = await b.new_context(viewport={'width': w, 'height': 860}, timezone_id='Europe/Istanbul', device_scale_factor=2, permissions=['geolocation'], geolocation={'latitude': 38.45, 'longitude': 27.20})
    await ctx.add_init_script(FAKE_NOW)
    if storage:
        await ctx.add_init_script('if(!sessionStorage.getItem("seeded")){' + ''.join('localStorage.setItem(%s,%s);' % (json.dumps(k), json.dumps(v)) for k, v in storage.items()) + 'sessionStorage.setItem("seeded","1");}')
    await ctx.route('https://api.open-meteo.com/**', mock_meteo); await ctx.route('https://marine-api.open-meteo.com/**', mock_meteo)
    await ctx.route('https://api.github.com/**', mock_gh)
    for pat in ['https://tile.openstreetmap.org/**', 'https://server.arcgisonline.com/**', 'https://tiles.openseamap.org/**', 'https://ows.emodnet-bathymetry.eu/**', 'https://drive.emodnet-geology.eu/**']:
        await ctx.route(pat, mock_tiles)
    for pat in ['https://nominatim.openstreetmap.org/**', 'https://overpass-api.de/**', 'https://rest.emodnet-bathymetry.eu/**']:
        await ctx.route(pat, mock_geo)
    await ctx.route('https://wa.me/**', lambda route: route.fulfill(status=200, content_type='text/html', body='<p>wa</p>'))
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'fonts' not in m.text and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
    return ctx, pg, errs

def fake_now(iso):
    return FAKE_NOW.replace("2026-10-17T09:30:00+03:00", iso)

async def new_ctx_at(b, iso, w=390):
    ctx = await b.new_context(viewport={'width': w, 'height': 860}, timezone_id='Europe/Istanbul', device_scale_factor=2, permissions=['geolocation'], geolocation={'latitude': 38.45, 'longitude': 27.20})
    await ctx.add_init_script(fake_now(iso))
    await ctx.route('https://api.open-meteo.com/**', mock_meteo); await ctx.route('https://marine-api.open-meteo.com/**', mock_meteo)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    return ctx, pg, errs

async def overflow(pg, tag):
    ov = await pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
    check(ov <= 0, 'yatay taşma yok: ' + tag + (' (' + str(ov) + ' px)' if ov > 0 else ''))

async def row_idx(pg, name):
    return await pg.evaluate('(n) => [...document.querySelectorAll("#hTable tr")].findIndex(tr => { const b = tr.querySelector("th b"); return b && b.textContent === n && tr.querySelectorAll("td").length > 2; })', name)

def U(t): return t.upper().replace('İ', 'I')

async def state(pg):
    return await pg.evaluate('JSON.parse(localStorage.getItem("alyssa-v1"))')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        # ================================================== A) temiz kurulum → özel paket → ayarlar → konum → yedek
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/'); await pg.wait_for_timeout(1200)
        check(await pg.is_visible('#welcome'), 'karşılama ekranı görünüyor')
        check('Alyssa by Barbossa App' in await pg.inner_text('#welcome'), 'uygulama adı karşılamada')
        await pg.screenshot(path=SHOTS + '/a_welcome.png')
        await pg.click('button[data-wel="kur"]'); await pg.wait_for_timeout(200)
        check(await pg.is_visible('#sheet') and 'Rig Atölyesi' in await pg.inner_text('#sheet'), 'karşılamadan Rig Atölyesi açıldı')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(250)
        check(await pg.is_visible('#welcome'), 'sihirbaz kapatılınca karşılamaya dönüldü')
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', 'yanlis-1234'); await pg.click('#welBtn'); await pg.wait_for_timeout(3500)
        check(await pg.is_visible('#welErr'), 'yanlış şifre uyarısı')
        await pg.fill('#wel-pass', '  ' + KEY['pass_'].upper() + ' '); await pg.click('#welBtn'); await pg.wait_for_timeout(5000)
        check(not await pg.is_visible('#welcome'), 'özel paket açıldı, karşılama kapandı')
        top = await pg.inner_text('#locName'); check('Konum 1' in top, 'üstte Konum 1: ' + top)
        await pg.wait_for_timeout(1500)
        net = await pg.inner_text('#net'); check(net.startswith('Güncel'), 'durum: ' + net)
        rows = await pg.locator('#hTable tr').count(); check(rows >= 15, 'saatlik tablo satırları ' + str(rows))
        # Bft rengi
        cell = pg.locator('#hTable tr').nth(await row_idx(pg, 'Rüzgâr')).locator('td').nth(3)
        bg = await cell.evaluate('e => getComputedStyle(e).backgroundColor'); txt = (await cell.inner_text()).split('\n')[0]
        pal = ['#86D9A6', '#2DB46C', '#93C83E', '#E8D61E', '#F6B40C', '#F18A1B', '#E5531D', '#D0231F', '#9E1530', '#681E74', '#1F4EB4', '#173A87', '#0D2256']
        exp = pal[int(txt)]; r, g, bb = int(exp[1:3], 16), int(exp[3:5], 16), int(exp[5:7], 16)
        check(bg == 'rgb(%d, %d, %d)' % (r, g, bb), 'rüzgâr hücresi Bft %s rengi %s (beklenen %s)' % (txt, bg, exp))
        check(await pg.locator('.bftscale span').count() == 13, 'Bft renk ölçeği 13 kutu')
        recs = await pg.locator('#recList article.rig').count(); check(recs >= 1, 'Bugün bağla önerisi ' + str(recs))
        await pg.screenshot(path=SHOTS + '/a_bugun.png', full_page=True)
        await overflow(pg, 'bugün')
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        nr = await pg.locator('#rigList article.rig').count(); check(nr == 32, 'rigler listesi 32: ' + str(nr))
        await pg.screenshot(path=SHOTS + '/a_rigler.png')
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#invList .item').count() > 5, 'envanter iğneler listesi dolu')
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#dayList .bftb').count() > 10, 'takvimde Bft rozetleri')
        await pg.screenshot(path=SHOTS + '/a_takvim.png')
        for v in ['takvim', 'avlar', 'rigler', 'envanter', 'daha']:
            await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(200); await overflow(pg, v)
        await pg.screenshot(path=SHOTS + '/a_daha.png')
        check(await pg.locator('#moreMenu .mrow').count() == 16, 'Daha menüsü 16 satır')
        # alışveriş: aynı rig iki kez yok
        await pg.click('button[data-open="alisveris"]'); await pg.wait_for_timeout(300)
        lines = await pg.locator('#sheet .item .sp').all_inner_texts()
        dup = [l for l in lines if len(set(x.strip() for x in l.split('·')[0].split(','))) != len(l.split('·')[0].split(','))]
        check(lines and not dup, 'alışveriş listesinde tekrar eden rig yok (%d satır)' % len(lines))
        await pg.screenshot(path=SHOTS + '/a_alisveris.png'); await overflow(pg, 'alışveriş')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # ayarlar
        await pg.click('button[data-open="ayarlar"]'); await pg.wait_for_timeout(300)
        await pg.click('button[data-set="preset"][data-val="lacivert"]'); await pg.wait_for_timeout(150)
        brand = await pg.evaluate('getComputedStyle(document.documentElement).getPropertyValue("--brand").trim()')
        check(brand.lower() == '#1e3f8a', 'renk paleti uygulandı: ' + brand)
        await pg.click('button[data-set="scheme"][data-val="dark"]'); await pg.wait_for_timeout(150)
        check(await pg.evaluate('document.documentElement.dataset.theme') == 'dark', 'koyu tema')
        await pg.screenshot(path=SHOTS + '/a_ayarlar_koyu.png')
        await pg.click('button[data-set="zoom"][data-val="2"]'); await pg.wait_for_timeout(150)
        z = await pg.evaluate('getComputedStyle(document.getElementById("main")).zoom'); check(str(z) in ('1.25',), 'yazı boyutu çok büyük: zoom ' + str(z))
        await overflow(pg, 'ayarlar (çok büyük yazı)')
        await pg.evaluate('(() => { const i = document.querySelector("input[data-bft=\\"2\\"]"); i.value = "#ff00ff"; i.dispatchEvent(new Event("change", {bubbles: true})); })()'); await pg.wait_for_timeout(200)
        st = await state(pg); check(st['settings']['bft'][2].lower() == '#ff00ff', 'Bft 2 rengi değişti ve kaydedildi')
        await pg.click('button[data-set="coord"][data-val="ddm"]'); await pg.wait_for_timeout(150)
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        sub = await pg.inner_text('#locSub'); check('′' in sub and 'K' in sub, 'derece-dakika koordinat: ' + sub)
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(200)
        await pg.screenshot(path=SHOTS + '/a_bugun_koyu_buyuk.png')
        for v in ['bugun', 'takvim', 'avlar', 'rigler', 'envanter', 'daha']:
            await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(150); await overflow(pg, v + ' (çok büyük yazı)')
        # ayarları normale çek
        await pg.click('button[data-open="ayarlar"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-set="zoom"][data-val="0"]'); await pg.click('button[data-set="scheme"][data-val="auto"]'); await pg.click('button[data-act="resetBft"]'); await pg.wait_for_timeout(150)
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(150)
        # konum: karadaki nokta → en yakın deniz noktası
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(200)
        await pg.fill('#nl-name', 'Kara noktası'); await pg.fill('#nl-lat', '38.45'); await pg.fill('#nl-lon', '27.20')
        await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(4000)
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(300)
        sea = await pg.inner_text('#seaNote') if await pg.is_visible('#seaNote') else ''
        check('km' in sea, 'karadaki nokta: ' + sea)
        wave = (await pg.locator('#hTable tr').nth(await row_idx(pg, 'Dalga')).locator('td').nth(2).inner_text()).strip()
        check(wave not in ('–', ''), 'karadaki noktada dalga değeri geldi: ' + wave)
        st = await state(pg); L = st['locations'][st['active']]
        check(L.get('sea') and abs(L['sea']['lat'] - 38.513) < 0.01, 'deniz noktası kaydedildi: ' + json.dumps(L.get('sea')))
        net = await pg.inner_text('#net'); check(net.startswith('Güncel'), 'durum karadaki noktada da Güncel: ' + net)
        await pg.screenshot(path=SHOTS + '/a_kara_nokta.png')
        # Konum 1'e dön ve av ekle (fotoğraf + dip)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(200)
        await pg.click('#sheet button[data-use="1"]'); await pg.wait_for_timeout(300); await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(1500)
        await pg.click('.tabbar button[data-v="avlar"]'); await pg.click('#addCatch'); await pg.wait_for_timeout(250)
        check(await pg.input_value('#cf-bot') == 'kum', 'av formu: seçili konumun dibi (kum)')
        check(re.search(r'\d+ \w+ 2026, \d\d:\d\d', await pg.inner_text('#cf-tlbl')) is not None, 'Türkçe tarih etiketi: ' + await pg.inner_text('#cf-tlbl'))
        await pg.set_input_files('#cfGal', ROOT + '/qa/test_fish.jpg'); await pg.wait_for_timeout(1500)
        await pg.select_option('#cf-sp', 'cipura'); await pg.fill('#cf-kg', '1,35'); await pg.select_option('#cf-rig', 'ozel:G-P5')
        await pg.screenshot(path=SHOTS + '/a_form.png')
        await pg.click('#cfSave'); await pg.wait_for_timeout(800)
        check('Çipura' in await pg.inner_text('#catchList'), 'av kaydedildi')
        # catch form far point: dip should default empty
        await ctx.set_geolocation({'latitude': 38.70, 'longitude': 26.30})
        await pg.click('#addCatch'); await pg.wait_for_timeout(250)
        await pg.click('#cfGps'); await pg.wait_for_timeout(600)
        check(await pg.input_value('#cf-bot') == '', 'kayıtlı konumlardan uzak noktada dip varsayılanı "Bilmiyorum"')
        check(await pg.is_visible('#cfAddLocW'), 'uzak noktada "konumlarıma ekle" seçeneği')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # bulut yedek
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('button[data-open="yedek"]'); await pg.wait_for_timeout(250)
        await pg.fill('#bk-repo', 'kenny/alyssa-yedek'); await pg.fill('#bk-name', 'Kenny'); await pg.fill('#bk-tok', 'yanlis-token'); await pg.fill('#bk-pass', 'yedek-sifre-1')
        await pg.click('#bkForm button[type="submit"]'); await pg.wait_for_timeout(1500)
        e1 = await pg.inner_text('#bkErr') if await pg.is_visible('#bkErr') else ''
        check('geçersiz' in e1, 'yanlış GitHub anahtarı uyarısı: ' + e1)
        await pg.fill('#bk-tok', GOOD_TOKEN); await pg.fill('#bk-pass', 'yedek-sifre-1')
        await pg.click('#bkForm button[type="submit"]'); await pg.wait_for_timeout(5000)
        st = await state(pg)
        check(st['backup']['lastAt'] and not st['backup']['err'], 'yedek alındı: ' + str(st['backup'].get('err')))
        prof = GH.get('kullanicilar/kenny/profil.json'); fotos = [k for k in GH if k.startswith('kullanicilar/kenny/foto/')]
        check(prof is not None and len(fotos) == 1, 'depoda profil ve 1 fotoğraf: ' + str(list(GH)))
        raw = prof['bytes'].decode() if prof else ''
        check(all(w not in raw for w in ('Fangri', 'Karagöz', 'cipura', 'G-P1')), 'yedek dosyası düz metin içermiyor (şifreli)')
        check(json.loads(raw)['app'] == 'alyssa-yedek', 'yedek dosya başlığı')
        await pg.screenshot(path=SHOTS + '/a_yedek.png'); await overflow(pg, 'bulut yedek')
        # değişiklik → otomatik yedek planlanır (persist → markDirty)
        print('A errors:', errs); check(not errs, 'A: sayfa hatası yok')
        await ctx.close()

        # ================================================== B) yeni telefon: buluttan geri yükleme
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="bulut"]'); await pg.wait_for_timeout(300)
        await pg.fill('#bk-repo', 'kenny/alyssa-yedek'); await pg.fill('#bk-name', 'kenny'); await pg.fill('#bk-tok', GOOD_TOKEN); await pg.fill('#bk-pass', 'yanlis-sifre')
        await pg.click('#bkForm button[data-act="bkRestoreAsk"]'); await pg.wait_for_timeout(4000)
        e2 = await pg.inner_text('#bkErr') if await pg.is_visible('#bkErr') else ''
        check('tutmadı' in e2, 'yanlış yedek şifresi: ' + e2)
        await pg.fill('#bk-pass', 'yedek-sifre-1'); await pg.click('#bkForm button[data-act="bkRestoreAsk"]'); await pg.wait_for_timeout(7000)
        st = await state(pg)
        check(st['pkg']['unlocked'] and 'ozel' in st['systems'], 'geri yüklemede özel paket de açıldı')
        await pg.click('.tabbar button[data-v="avlar"]'); await pg.wait_for_timeout(400)
        check('Çipura' in await pg.inner_text('#catchList'), 'av geri geldi')
        src = await pg.locator('#catchList img').first.get_attribute('src')
        check(bool(src) and src.startswith('blob:'), 'fotoğraf buluttan indi')
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig').count() == 32, 'geri yüklemeden sonra 32 rig')
        await pg.screenshot(path=SHOTS + '/b_restore.png')
        print('B errors:', errs); check(not errs, 'B: sayfa hatası yok')
        await ctx.close()

        # ================================================== C) v0.2'den geçiş (eski şifreli veri, eski anahtar)
        sys.path.insert(0, ROOT + '/app'); import build_app3
        od = build_app3.app_data(); od['meta']['data_version'] = 'eski0v0200'
        old_state = {'v': 1, 'qty': {'owner-ssw5111|3/0': 7}, 'status': {}, 'locations': {'1': {'id': '1', 'name': 'Eski konum', 'lat': 38.1234, 'lon': 26.5678, 'bottom': 'kum', 'depth': ''}},
                     'active': '1', 'prefs': {'qty_mode': 'adet'}, 'wx': None, 'seenVersion': '0.2.0'}
        ctx, pg, errs = await new_ctx(b, {'kenny-av-v1': json.dumps(old_state), 'kenny-av-data': json.dumps(od), 'kenny-av-k': 'AAAA'})
        await pg.goto(BASE + '/dist/'); await pg.wait_for_timeout(3000)
        check(not await pg.is_visible('#welcome'), 'geçiş: karşılama gösterilmedi')
        check('güncellendi' in await pg.inner_text('#banners'), 'geçiş: yeni sürüm ve paket bandı')
        st = await state(pg)
        check(st['inv']['qty'].get('owner-ssw5111|3/0') == 7, 'geçiş: envanter adedi korundu')
        check(st['pkg']['need'] is True, 'geçiş: yeni şifre isteniyor')
        await pg.screenshot(path=SHOTS + '/c_gecis.png')
        await pg.click('#banners button[data-open="paket"]'); await pg.wait_for_timeout(300)
        await pg.fill('#pk-pass', KEY['pass_']); await pg.click('#pkBtn'); await pg.wait_for_timeout(5000)
        st = await state(pg)
        check(st['pkg']['need'] is False and st['pkg']['version'] != 'eski0v0200', 'geçiş: yeni şifreyle paket güncellendi')
        check('Rig sistemin güncellendi' not in await pg.inner_text('#banners'), 'geçiş: paket bandı kalktı')
        check(await pg.evaluate('localStorage.getItem("kenny-av-k")') is None, 'geçiş: eski anahtar silindi')
        print('C errors:', errs); check(not errs, 'C: sayfa hatası yok')
        await ctx.close()

        # ================================================== D) takılan istek: zaman aşımı ve "Yükleniyor" bitmeli
        HANG['gfs'] = True
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/'); await pg.wait_for_timeout(800)
        await pg.click('button[data-wel="bos"]'); await pg.wait_for_timeout(300)
        check(await pg.is_visible('#noLoc'), 'boş başla: konum ekle kartı')
        await pg.screenshot(path=SHOTS + '/d_bos.png')
        await pg.click('#noLoc button[data-act="gpsloc"]'); await pg.wait_for_timeout(2000)
        n1 = await pg.inner_text('#net')
        await pg.wait_for_timeout(32000)
        n2 = await pg.inner_text('#net')
        check(n1 == 'Yükleniyor' and n2.startswith('Güncel'), 'zaman aşımından sonra durum: %s → %s' % (n1, n2))
        st = await state(pg); check(st['wx']['status']['gfs'] == 'zaman aşımı', 'GFS zaman aşımı olarak işaretlendi: ' + str(st['wx']['status'].get('gfs')))
        check(await pg.locator('#recList .panel').count() == 1, 'rig sistemi yok kartı')
        print('D errors:', errs); check(not errs, 'D: sayfa hatası yok')
        await ctx.close()
        HANG['gfs'] = False

        # ================================================== G) öneri motoru v3: 5 balık, tek hesaplı pencere, sürüklenme, öğrenme
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        cells = await pg.evaluate("""() => [...document.querySelectorAll('#hTable td.fish')].map(td => ({n: td.querySelectorAll('svg').length, on: td.querySelectorAll('svg.on').length, rows: td.querySelectorAll('.fi > span').length, pct: +td.querySelector('small').textContent.replace('%','')}))""")
        check(len(cells) == 24 and all(c['n'] == 5 and c['rows'] == 2 for c in cells), 'G: her saatte 5 balık, üstte 3 altta 2 (%d hücre)' % len(cells))
        bad = [c for c in cells if c['on'] != min(5, -(-c['pct'] // 20))]
        check(not bad, 'G: dolu balık sayısı %20 dilimlerine uyuyor ' + str(bad[:3]))
        pcts = [c['pct'] for c in cells]; print('   bugün %:', pcts)
        check(min(pcts) >= 15 and 61 <= max(pcts) <= 100, 'G: yeni ölçek: sakin saat en az %d, tepe %d' % (min(pcts), max(pcts)))
        await pg.locator('#hourly').screenshot(path=SHOTS + '/g_saatlik.png')
        # takvimdeki pencere yüzdesi = o günün tablosunda pencere saatlerinin en yükseği
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SHOTS + '/g_takvim.png')
        ndays = min(4, await pg.locator('#dayList .day').count()); okc = 0
        for i in range(ndays):
            t = await pg.locator('#dayList .day').nth(i).inner_text()
            mm = re.search(r'%(\d+) en iyi pencere (\d\d):(\d\d)–(\d\d):(\d\d)', t.replace('\n', ' '))
            if not mm: check(False, 'G: takvim günü %d pencere metni: %s' % (i, t[:160])); continue
            pct, a, bb = int(mm.group(1)), int(mm.group(2)) * 60 + int(mm.group(3)), int(mm.group(4)) * 60 + int(mm.group(5))
            if bb == 0: bb = 24 * 60
            await pg.locator('#dayList .day').nth(i).click(); await pg.wait_for_timeout(300)
            hrs = await pg.evaluate("""() => { const rows = [...document.querySelectorAll('#hTable tr')]; const h = [...rows[0].querySelectorAll('td')].map(td => +td.textContent); const fr = rows.find(tr => tr.querySelector('th b').textContent === 'Balık'); const f = [...fr.querySelectorAll('td')].map(td => +td.querySelector('small').textContent.replace('%','')); return h.map((x, i) => [x, f[i]]); }""")
            inwin = [p for h, p in hrs if h * 60 <= bb + 20 and h * 60 > a - 30]
            same = bool(inwin) and max(inwin) == pct
            okc += same
            if not same: print('   pencere/tablo farkı', t.replace('\n', ' ')[:200], inwin)
            await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(250)
        check(okc == ndays, 'G: takvimdeki pencere yüzdesi saatlik tabloyla aynı (%d/%d gün)' % (okc, ndays))
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(300)
        labels = await pg.evaluate("""() => [...document.querySelectorAll('#solWins .win .t small')].map(e => e.textContent)""")
        check(labels and all(l in ('Sabah', 'Gündüz', 'Akşam', 'Gece') for l in labels), 'G: Bugün pencereleri adlı: ' + str(labels))
        recw = await pg.locator('#recList .meta.why').all_inner_texts()
        check(any('En iyi pencere' in x for x in recw), 'G: önerilerde en iyi pencere yazıyor')
        # sürüklenme paneli ve demirli seçimi
        dtxt = await pg.inner_text('#driftPanel')
        check('sürüklenir' in dtxt and 'Noktanın üstünden' in dtxt and 'kurşun' in dtxt, 'G: sürüklenme paneli: ' + dtxt.replace('\n', ' ')[:160])
        await pg.locator('#driftPanel').screenshot(path=SHOTS + '/g_surukle.png')
        lbls = await pg.locator('#hTable th.lbl b').all_inner_texts(); check('Sürüklenme' in lbls, 'G: tabloda sürüklenme satırı')
        await pg.click('#driftPanel button[data-set="anchor"][data-val="demir"]'); await pg.wait_for_timeout(300)
        st = await state(pg); check(st['settings']['anchor'] == 'demir', 'G: demirli seçimi kaydedildi')
        lbls = await pg.locator('#hTable th.lbl b').all_inner_texts(); dtxt2 = await pg.inner_text('#driftPanel')
        check('İpe akış' in lbls and 'Demirli' in dtxt2 and 'Noktanın üstünden' not in dtxt2, 'G: demirliyken ipe akış, başlangıç önerisi yok')
        await pg.click('#driftPanel button[data-set="anchor"][data-val="surukle"]'); await pg.wait_for_timeout(300)
        sogs = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const S = Q.state(); const x = Q.days()[0].hs[9]; const r = {}; for (const k of ['az', 'orta', 'cok']) { S.settings.leeway = k; r[k] = Q.driftAt(x).sog; } S.settings.leeway = 'orta'; return r; }""")
        check(sogs['az'] < sogs['orta'] < sogs['cok'], 'G: rüzgâr payı ayarı sürüklenmeyi değiştiriyor ' + json.dumps({k: round(v, 2) for k, v in sogs.items()}))
        lead = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const dd = Q.days()[0]; const rg = Q.rigs().find(r => r.sinker && r.sinker.g); const xs = dd.hs.map(x => [x, Q.driftAt(x).line]).sort((p, q) => p[1] - q[1]);
          const lo = Q.leadFor(rg, dd, xs[0][0]), hi = Q.leadFor(rg, dd, xs[xs.length - 1][0]); return {code: rg.code, g: rg.sinker.g, max: rg.sinker.max, lo: [xs[0][1], lo.extra, lo.kursun], hi: [xs[xs.length - 1][1], hi.extra, hi.kursun, hi.over, hi.need]}; }""")
        print('   kurşun:', json.dumps(lead, ensure_ascii=False))
        check(lead['hi'][1] > lead['lo'][1], 'G: akış arttıkça kurşun artıyor')
        # derinlik: Konumlar'dan 25 m girilince artış yarıya iner ve panel derinliği yazar
        x50 = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const x = Q.days()[0].hs[9]; return Q.leadExtra(Q.driftAt(x), 50); }""")
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(250)
        await pg.evaluate("""() => { const i = document.querySelector('#sheet input[data-f="depth"]'); i.value = '25'; i.dispatchEvent(new Event('input', {bubbles: true})); i.dispatchEvent(new Event('change', {bubbles: true})); }""")
        await pg.wait_for_timeout(200); await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(300); await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(200)
        x25 = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const x = Q.days()[0].hs[9]; return Q.leadExtra(Q.driftAt(x), Q.loc().depth ? +Q.loc().depth : null); }""")
        check(abs(x25 - x50 / 2) <= 10 and 'Derinlik 25 m' in await pg.inner_text('#driftPanel'), 'G: derinlik kurşuna giriyor (50 m: +%d g, 25 m: +%d g)' % (x50, x25))
        # av kaydı o saatin koşullarını yeni ölçek ve sürüklenmeyle saklar
        await pg.click('.tabbar button[data-v="avlar"]'); await pg.click('#addCatch'); await pg.wait_for_timeout(250)
        await pg.select_option('#cf-sp', 'mercan'); await pg.click('#cfSave'); await pg.wait_for_timeout(800)
        rec = await pg.evaluate('''() => new Promise(res => { const r = indexedDB.open('kenny-av', 1); r.onsuccess = () => { const q = r.result.transaction('catches').objectStore('catches').getAll(); q.onsuccess = () => res(q.result); }; })''')
        cd = (rec[0] or {}).get('cond') or {}
        check(cd.get('v') == 5 and cd.get('drift_kn') is not None and cd.get('line_kn') is not None, 'G: av kaydında sürüklenme ve yeni ölçek: ' + json.dumps({k: cd.get(k) for k in ('v', 'drift_kn', 'drift_dir', 'line_kn', 'act')}))
        await pg.locator('#catchList .catch').first.click(); await pg.wait_for_timeout(300)
        check('sürüklenme' in (await pg.inner_text('#sheet')).lower(), 'G: av ayrıntısında sürüklenme')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(200)
        # öğrenme: 6 av kaydı (aynı rig, gece, bu nokta) → o rig gece önerisinde öne çıkar
        before = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const r = Q.recommend(Q.days()[0], true).find(r => r.rg.id === 'ozel:N-P5'); return r ? r.sc : null; }""")
        await pg.evaluate("""() => new Promise((res, rej) => { const L = window.ALYSSA_QA.loc(); const r = indexedDB.open('kenny-av', 1); r.onsuccess = () => { const t = r.result.transaction('catches', 'readwrite'); const st = t.objectStore('catches');
          for (let i = 0; i < 6; i++) st.put({id: 'qa' + i, t: new Date(2026, 9, 8 + i, 21, 30).toISOString(), species: 'mercan', count: 2, rig: 'ozel:N-P5', loc: {lat: L.lat, lon: L.lon, name: L.name}, cond: {cur_kn: 0.5, illum: 40}, photos: []});
          t.oncomplete = () => res(true); t.onerror = () => rej(t.error); }; r.onerror = () => rej(r.error); })""")
        await pg.evaluate('location.reload()'); await pg.wait_for_timeout(2500)
        after = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const r = Q.recommend(Q.days()[0], true).find(r => r.rg.id === 'ozel:N-P5'); return r ? {sc: r.sc, why: r.why} : null; }""")
        print('   öğrenme:', before, json.dumps(after, ensure_ascii=False))
        check(before is not None and after and after['sc'] >= before + 2 and any('seninle 12 balık' in w for w in after['why']), 'G: avlardan öğrenme N-P5 puanını artırdı')
        await pg.click('.tabbar button[data-v="avlar"]'); await pg.wait_for_timeout(300)
        lt = await pg.inner_text('#learnBox'); check('En verimli rigler' in lt and 'N-P5' in lt, 'G: Avlar ekranında öğrenme özeti: ' + lt.replace('\n', ' ')[:160])
        await pg.screenshot(path=SHOTS + '/g_avlar.png')
        for v in ['bugun', 'takvim', 'avlar']:
            await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(150); await overflow(pg, 'G ' + v)
        await pg.set_viewport_size({'width': 320, 'height': 700}); await pg.wait_for_timeout(200)
        for v in ['bugun', 'takvim']:
            await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(150); await overflow(pg, 'G 320 px ' + v)
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(150)
        await pg.screenshot(path=SHOTS + '/g_bugun_320.png', full_page=True)
        print('G errors:', errs); check(not errs, 'G: sayfa hatası yok')
        await ctx.close()

        # ================================================== H) akşam: gündüz önerileri yarına geçer, bugünün pencereleri geçtiyse yarın gösterilir
        ctx, pg, errs = await new_ctx_at(b, '2026-10-17T21:40:00+03:00')
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        eb = await pg.locator('#recList .eyebrow').all_inner_texts()
        check(any('YARIN' in e.upper() for e in eb), 'H: akşam gündüz önerileri yarının: ' + str(eb))
        sw = await pg.inner_text('#solWins'); print('   pencereler 21:40:', sw.replace('\n', ' ')[:200])
        check(sw.strip() != '', 'H: Bugün penceresi paneli boş değil')
        await pg.screenshot(path=SHOTS + '/h_aksam.png', full_page=True)
        print('H errors:', errs); check(not errs, 'H: sayfa hatası yok')
        await ctx.close()

        # ================================================== I) v0.6: Windy düzeni, model seçici, birimler, yerel rüzgâr adları, kişiselleştirme
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        lbl = lambda: pg.evaluate("""() => [...document.querySelectorAll('#hTable th.lbl')].map(th => th.querySelector('b').textContent + '|' + th.querySelector('small').textContent)""")
        L0 = await lbl(); print('   satırlar:', [x.split('|')[0] for x in L0])
        check(any(x.startswith('Güneş · Ay') for x in L0) and any(x.startswith('Balık eğrisi') for x in L0) and any(x.startswith('Model uyumu') for x in L0), 'I: yeni satırlar (güneş/ay, balık eğrisi, model uyumu)')
        check(any(x.startswith('Rüzgâr|') and 'ECMWF' in x for x in L0), 'I: ECMWF karşılaştırma satırı')
        check('☀↑' in await pg.inner_text('#hTable'), 'I: gün doğumu tabloda')
        check(await pg.locator('#hTable td.agree .dot').count() >= 10, 'I: model uyumu noktaları')
        check(await pg.locator('#hTable svg.spark').count() == 2, 'I: balık ve basınç grafikleri')
        check(await pg.locator('#dayChips .dstrip').count() >= 5 and await pg.locator('#dayChips .dstrip').first.locator('i').count() == 8, 'I: gün şeridi (8 dilim)')
        names = await pg.evaluate("""() => [...document.querySelectorAll('#hTable td.wd small')].map(e => e.textContent)""")
        check(names and all(n in ('Yıldız', 'Poyraz', 'Gündoğusu', 'Keşişleme', 'Kıble', 'Lodos', 'Batı', 'Karayel') for n in names), 'I: yerel rüzgâr adları: ' + str(sorted(set(names))))
        check(await pg.locator('#compass svg').count() == 1, 'I: konum başlığında pusula')
        await pg.click('#compass'); await pg.wait_for_timeout(200); check('Rüzgâr' in await pg.inner_text('#toast'), 'I: pusula dokununca özet: ' + await pg.inner_text('#toast'))
        await pg.locator('#hourly').screenshot(path=SHOTS + '/i_saatlik.png')
        # model seçici
        await pg.click('#hBar button[data-set="model"][data-val="gfs"]'); await pg.wait_for_timeout(400)
        st = await state(pg); L1 = await lbl()
        check(st['settings']['model'] == 'gfs' and any(x.startswith('Rüzgâr|') and 'GFS' in x and 'ICON' not in x for x in L1[:12]), 'I: GFS modeli seçildi: ' + str([x for x in L1 if x.startswith('Rüzgâr')][:1]))
        await pg.click('#hBar button[data-set="model"][data-val="karma"]'); await pg.wait_for_timeout(400)
        # görünüm: satır kapat, taşı, birimler, adlar, kartlar, takvim
        await pg.click('#hEdit'); await pg.wait_for_timeout(300)
        check('Görünüm' in await pg.inner_text('#sheet'), 'I: Görünüm sayfası açıldı')
        await pg.screenshot(path=SHOTS + '/i_gorunum.png')
        await pg.click('#sheet input[data-rowtog="hrows|balikgrafik"]'); await pg.wait_for_timeout(250)
        L2 = await lbl(); check(not any(x.startswith('Balık eğrisi') for x in L2), 'I: balık eğrisi satırı kapatıldı')
        idx = lambda L, name: next((i for i, x in enumerate(L) if x.startswith(name)), -1)
        d0 = idx(L2, 'Dalga|')
        await pg.click('#sheet button[data-rowmv="hrows|dalga|-1"]'); await pg.wait_for_timeout(250)
        L3 = await lbl(); check(idx(L3, 'Dalga|') == d0 - 1, 'I: dalga satırı bir üste taşındı')
        await pg.click('#sheet button[data-set="windUnit"][data-val="kn"]'); await pg.wait_for_timeout(250)
        wcell = await pg.evaluate("""() => { const r = [...document.querySelectorAll('#hTable tr')].find(tr => tr.querySelector('th b').textContent === 'Rüzgâr'); return r.querySelectorAll('td')[9].innerText; }""")
        check('Bft' in wcell and int(wcell.split()[0]) > 12, 'I: rüzgâr kn biriminde: ' + wcell.replace('\n', ' '))
        await pg.click('#sheet button[data-set="pressUnit"][data-val="mmhg"]'); await pg.wait_for_timeout(250)
        pv = await pg.evaluate("""() => { const r = [...document.querySelectorAll('#hTable tr')].find(tr => tr.querySelector('th b').textContent === 'Basınç' && tr.querySelectorAll('td').length > 2); return r.querySelectorAll('td')[9].innerText.split('\\n')[0]; }""")
        check(740 < int(pv) < 780, 'I: basınç mmHg: ' + pv)
        await pg.click('#sheet button[data-set="windNames"][data-val="harf"]'); await pg.wait_for_timeout(250)
        names2 = await pg.evaluate("""() => [...document.querySelectorAll('#hTable td.wd small')].map(e => e.textContent)""")
        check(names2 and all(n in ('K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB') for n in names2), 'I: harfle yön adları')
        await pg.click('#sheet input[data-rowtog="cards|surukle"]'); await pg.wait_for_timeout(200)
        await pg.click('#sheet button[data-rowmv="cards|oneri|-1"]'); await pg.click('#sheet button[data-rowmv="cards|oneri|-1"]'); await pg.click('#sheet button[data-rowmv="cards|oneri|-1"]'); await pg.click('#sheet button[data-rowmv="cards|oneri|-1"]'); await pg.wait_for_timeout(250)
        await pg.click('#sheet input[data-rowtog="calrows|guven"]'); await pg.wait_for_timeout(200)
        st = await state(pg); print('   ayarlar:', json.dumps({k: st['settings'][k] for k in ('windUnit', 'pressUnit', 'windNames', 'cards')}, ensure_ascii=False))
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(250)
        order = await pg.evaluate("""() => [...document.querySelectorAll('#todayCards > .tcard')].map(e => e.dataset.card + (e.hidden ? '-' : ''))""")
        check(order[0] == 'oneri' and 'surukle-' in order, 'I: Bugün kartları sırası ve gizleme: ' + str(order))
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(250)
        check('güven' not in (await pg.inner_text('#dayList')).lower(), 'I: takvimde güven satırı kapalı')
        await pg.reload(); await pg.wait_for_timeout(2000)
        st = await state(pg); check(st['settings']['windUnit'] == 'kn' and st['settings']['hrows'] and st['settings']['cards'], 'I: görünüm ayarları kalıcı')
        # varsayılana dön
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="gorunum"]'); await pg.wait_for_timeout(300)
        for l in ['hrows', 'cards', 'calrows']: await pg.click('#sheet button[data-rowreset="%s"]' % l); await pg.wait_for_timeout(150)
        await pg.click('#sheet button[data-set="windUnit"][data-val="bft"]'); await pg.click('#sheet button[data-set="pressUnit"][data-val="hpa"]'); await pg.click('#sheet button[data-set="windNames"][data-val="yerel"]'); await pg.wait_for_timeout(200)
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        st = await state(pg); check(st['settings']['hrows'] is None and st['settings']['cards'] is None, 'I: varsayılana dönüldü')
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(200)
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(200)
            for v in ['bugun', 'takvim', 'daha']:
                await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(150); await overflow(pg, 'I %d px %s' % (w, v))
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="gorunum"]'); await pg.wait_for_timeout(300); await overflow(pg, 'I 320 px görünüm')
        await pg.screenshot(path=SHOTS + '/i_gorunum_320.png', full_page=True)
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        print('I errors:', errs); check(not errs, 'I: sayfa hatası yok')
        await ctx.close()

        # ================================================== J) v0.7: harita
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        n0 = len((await state(pg))['locations'])
        await pg.click('#locBtn'); await pg.wait_for_selector('#map.leaflet-container', timeout=10000); await pg.wait_for_timeout(600)
        check(await pg.is_visible('#map') and await pg.locator('.mpin').count() >= 1, 'J: harita açıldı, konum işaretleri var (%d)' % await pg.locator('.mpin').count())
        check(any('tile.openstreetmap.org' in u for u in MAP_LOG) and any('openseamap' in u for u in MAP_LOG) and any('contours' in u for u in MAP_LOG), 'J: OSM, deniz işaretleri ve derinlik eğrisi katmanları istendi')
        bb = await pg.locator('#map').bounding_box()
        await pg.mouse.click(bb['x'] + bb['width'] * 0.3, bb['y'] + bb['height'] * 0.35); await pg.wait_for_timeout(1800)
        card = await pg.inner_text('#mapCard'); print('   kart:', card.replace('\n', ' | ')[:220])
        check('Deneme açıkları' in card and 'derinlik ≈ 54 m' in card and 'kıyıya 2,2 km' in card and '′ K' in card and '′ D' in card, 'J: deniz noktası kartı (ad, kıyı, derinlik, derece-dakika)')
        await pg.screenshot(path=SHOTS + '/j_harita.png')
        await pg.click('#mapCard button[data-mapact="copy"]'); await pg.wait_for_timeout(200)
        check('°' in await pg.inner_text('#toast'), 'J: koordinat kopyalandı: ' + await pg.inner_text('#toast'))
        await pg.click('#mapCard button[data-mapact="save"]'); await pg.wait_for_timeout(400)
        st = await state(pg); newl = [v for v in st['locations'].values() if v['name'] == 'Deneme açıkları']
        check(len(st['locations']) == n0 + 1 and newl and newl[0]['depth'] == '54' and st['active'] != newl[0]['id'], 'J: nokta derinliğiyle kaydedildi, seçili konum değişmedi')
        check(await pg.locator('.mpin').count() >= 2, 'J: kaydedilen nokta haritada')
        # kara noktası
        await pg.evaluate('window.ALYSSA_QA.pickPoint(38.45, 27.20)'); await pg.wait_for_timeout(1800)
        card2 = await pg.inner_text('#mapCard'); check('Test Köyü, İzmir' in card2 and 'Kara' in card2, 'J: kara noktası adı: ' + card2.replace('\n', ' | ')[:120])
        # katmanlar
        await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(200)
        await pg.click('#mapLayers input[data-maplayer="depth"]'); await pg.wait_for_timeout(500)
        await pg.click('#mapLayers button[data-mapbase="uydu"]'); await pg.wait_for_timeout(500)
        st = await state(pg); check(st['settings']['map']['depth'] and st['settings']['map']['base'] == 'uydu', 'J: katman ayarları kaydedildi')
        check(any('mean_multicolour' in u for u in MAP_LOG) and any('arcgisonline' in u for u in MAP_LOG), 'J: derinlik renkleri ve uydu istendi')
        await pg.screenshot(path=SHOTS + '/j_katmanlar.png')
        await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(150)
        # kayıtlı noktaya dokun → seç ve tahmin
        await pg.locator('.mpin', has_text='Deneme açıkları').click(); await pg.wait_for_timeout(500)
        card3 = await pg.inner_text('#mapCard'); check('Seç ve tahmin' in card3, 'J: kayıtlı nokta kartı')
        await pg.click('#mapCard button[data-mapact="use"]'); await pg.wait_for_timeout(1500)
        st = await state(pg); check(st['active'] == newl[0]['id'] and not await pg.is_visible('#sheet') and 'Deneme' in await pg.inner_text('#locName'), 'J: harita noktası seçildi, Bugün ekranına dönüldü')
        await pg.set_viewport_size({'width': 320, 'height': 700}); await pg.wait_for_timeout(200)
        await pg.click('#locBtn'); await pg.wait_for_selector('#map.leaflet-container', timeout=10000); await pg.wait_for_timeout(500)
        await overflow(pg, 'J 320 px harita')
        bb = await pg.locator('#map').bounding_box(); await pg.mouse.click(bb['x'] + bb['width'] * 0.6, bb['y'] + bb['height'] * 0.3); await pg.wait_for_timeout(1800)
        await pg.screenshot(path=SHOTS + '/j_harita_320.png'); await overflow(pg, 'J 320 px kart')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(300)
        check(not await pg.is_visible('#sheet'), 'J: harita kapandı')
        print('J errors:', errs); check(not errs, 'J: sayfa hatası yok')
        await ctx.close()

        # ================================================== K) v0.8: kıyı modu
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        check('Tekne' in await pg.evaluate("document.getElementById('modeBtn').textContent"), 'K: üst çubukta mod düğmesi (Tekne)')
        await pg.click('#modeBtn'); await pg.wait_for_timeout(500)
        st = await state(pg); lbls = await pg.locator('#hTable th.lbl b').all_inner_texts()
        check(st['mode'] == 'kiyi' and await pg.inner_text('#todayTitle') == 'Bugün kıyıda' and 'Kıyı' in await pg.evaluate("document.getElementById('modeBtn').textContent"), 'K: kıyı moduna geçildi')
        check('Kıyıya göre' in lbls and 'Sürüklenme' not in lbls, 'K: tabloda kıyıya göre satırı, sürüklenme yok')
        check('Kıyı rigin yok' in await pg.inner_text('#recList'), 'K: kıyı rigi yokken kurulum önerisi')
        dp = await pg.inner_text('#driftPanel'); check('bilinmiyor' in dp, 'K: kıyının bakışı soruluyor')
        await pg.select_option('#driftPanel select[data-f="facing"]', '180'); await pg.wait_for_timeout(400)
        dp = await pg.inner_text('#driftPanel'); print('   kıyı:', dp.replace('\n', ' ')[:220])
        check('G yönüne bakıyor' in dp and ('kıyıya vuran' in dp or 'kıyıdan esen' in dp or 'kıyıya yandan' in dp), 'K: kıyıya göre rüzgâr yorumu')
        rels = await pg.evaluate("""() => { const r = [...document.querySelectorAll('#hTable tr')].find(tr => tr.querySelector('th b').textContent === 'Kıyıya göre'); return [...r.querySelectorAll('td')].map(td => td.textContent); }""")
        check(rels and all(x in ('vuran', 'esen', 'yandan') for x in rels), 'K: saat saat vuran/esen/yandan: ' + str(sorted(set(rels))))
        # Yıldız (kuzeyden) rüzgâr, güneye bakan kıyı → kıyıdan esen
        check(rels.count('esen') >= 12, 'K: kuzey rüzgârı güneye bakan kıyıda "esen"')
        await pg.screenshot(path=SHOTS + '/k_kiyi.png', full_page=True)
        # pusulayla bakış
        await pg.click('#driftPanel button[data-act="heading"]')
        await pg.evaluate("""async () => { for (let i = 0; i < 6; i++) { window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', {alpha: 90, beta: 80, gamma: 0, absolute: true})); await new Promise(r => setTimeout(r, 60)); } }""")
        await pg.wait_for_timeout(500)
        st = await state(pg); check(st['locations'][st['active']].get('facing') == '270', 'K: pusulayla kıyının bakışı alındı: ' + str(st['locations'][st['active']].get('facing')))
        # kıyı sistemi kur: surf
        await pg.click('#recList button[data-act="wizard"]'); await pg.wait_for_timeout(300)
        check(await pg.get_attribute('button[data-wzm="kiyi"]', 'aria-pressed') == 'true', 'K: sihirbaz kıyı modunda açıldı')
        await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(150)
        await pg.click('button[data-wzt="surf"]'); await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(150)
        first = await pg.locator('button[data-wzs]').first.get_attribute('data-wzs'); check(first in ('levrek', 'cipura', 'sargoz', 'mirmir', 'karagoz', 'istavrit', 'zargana'), 'K: kıyıda öne çıkan türler önce: ' + str(first))
        for sp in ['cipura', 'mirmir', 'levrek']: await pg.click(f'button[data-wzs="{sp}"]')
        await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(150)
        check('Hangi yemlerle' in await pg.inner_text('#sheet'), 'K: yem adımı')
        await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(150); await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(200)
        check('atış ağırlığı' in await pg.evaluate("document.getElementById('sheet').textContent"), 'K: kıyı için atış ağırlığı sorusu')
        await pg.fill('#wz-rod', '120'); await pg.click('button[data-wz="done"]'); await pg.wait_for_timeout(600)
        st = await state(pg); sy = [v for v in st['systems'].values() if v['source'] == 'sihirbaz']
        check(sy and all(r['mode'] == 'kiyi' for r in sy[0]['rigs']), 'K: kıyı sistemi kuruldu (%d rig)' % (len(sy[0]['rigs']) if sy else 0))
        # rigleri hazır etmek için alışverişteki her şeyi "aldım" yap
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="alisveris"]'); await pg.wait_for_timeout(300)
        while await pg.locator('#sheet button[data-buyadd], #sheet button[data-bought]').count():
            await pg.click('#sheet button[data-buyadd], #sheet button[data-bought] >> nth=0'); await pg.wait_for_timeout(150)
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(400)
        recs = await pg.locator('#recList article.rig').all_inner_texts(); print('   kıyı önerileri:', [r.split('\n')[0:2] for r in recs])
        check(recs and all('surf' in r.lower() and r.startswith('K') for r in recs), 'K: Bugün bağla kıyı riglerini öneriyor (%d)' % len(recs))
        check(any('kurşun' in r for r in recs), 'K: kıyı rig kartında kurşun')
        await pg.screenshot(path=SHOTS + '/k_kiyi_oneri.png', full_page=True)
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(200)
            for v in ['bugun', 'takvim']:
                await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(150); await overflow(pg, 'K %d px %s' % (w, v))
        await pg.click('#modeBtn'); await pg.wait_for_timeout(400)
        lbls = await pg.locator('#hTable th.lbl b').all_inner_texts(); st = await state(pg)
        check(st['mode'] == 'tekne' and 'Sürüklenme' in lbls and 'Kıyıya göre' not in lbls, 'K: tekne moduna dönüldü')
        print('K errors:', errs); check(not errs, 'K: sayfa hatası yok')
        await ctx.close()

        # ================================================== L) v0.9: paylaşım, takvim uyarısı, çıkış listesi, güvenlik mesajı, yedek hatırlatma
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="ayarlar"]'); await pg.wait_for_timeout(200)
        await pg.fill('#pf-name', 'Kenny'); await pg.dispatch_event('#pf-name', 'change'); await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        await pg.click('#moreMenu button[data-open="paylas"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-share="envanter"]'); await pg.wait_for_timeout(800)
        href = await pg.get_attribute('#shareOut a.btn', 'href'); txt = urllib.parse.unquote(href.split('text=', 1)[1])
        link = txt[txt.index('http'):]; frag = link.split('#', 1)[1]
        check(frag.startswith('al=z') and len(link) < 20000, 'L: envanter bağlantısı (sıkıştırılmış, %d karakter)' % len(link))
        await pg.screenshot(path=SHOTS + '/l_paylas.png')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # takvim uyarısı ve .ics
        await pg.click('#moreMenu button[data-open="uyari"]'); await pg.wait_for_timeout(300)
        await pg.select_option('#sheet select[data-alert="bft"]', '6'); await pg.wait_for_timeout(200)
        await pg.select_option('#sheet select[data-alert="wave"]', '1.5'); await pg.wait_for_timeout(200)
        await pg.select_option('#sheet select[data-alert="fish"]', '3'); await pg.wait_for_timeout(300)
        nmatch = await pg.locator('#sheet .item').count(); check(nmatch >= 2, 'L: kurala uyan pencereler (%d)' % nmatch)
        await pg.screenshot(path=SHOTS + '/l_uyari.png')
        async with pg.expect_download() as dl_info:
            await pg.click('#sheet button[data-act="icsAll"]')
        dl = await dl_info.value; ics = open(await dl.path(), encoding='utf-8', newline='').read()
        check(dl.suggested_filename.endswith('.ics') and ics.count('BEGIN:VEVENT') == nmatch and 'BEGIN:VALARM' in ics and 'TRIGGER:-PT120M' in ics and ics.startswith('BEGIN:VCALENDAR'), 'L: takvim dosyası (%d etkinlik, alarm 2 sa önce)' % ics.count('BEGIN:VEVENT'))
        check(all(len(l.encode()) <= 75 for l in ics.split('\r\n')), 'L: .ics satırları 75 baytı aşmıyor')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # çıkış listesi
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.click('.rechead button[data-open="liste"]'); await pg.wait_for_timeout(300)
        ck = await pg.inner_text('#sheet'); check('Bugünün rigleri' in ck and 'Can yelekleri' in ck and 'Kurşun' in ck, 'L: çıkış listesi rigler, kurşun ve güvenlik')
        await pg.click('#sheet input[data-ck^="k:Can"]'); await pg.wait_for_timeout(200)
        await pg.fill('#sf-ret', '14:00'); await pg.dispatch_event('#sf-ret', 'change'); await pg.fill('#sf-not', 'Alya 8, 2 kişi'); await pg.dispatch_event('#sf-not', 'change')
        async with ctx.expect_page() as pinfo:
            await pg.click('#sheet button[data-act="safety"]')
        wp = await pinfo.value; wurl = urllib.parse.unquote(wp.url)
        check(wurl.startswith('https://wa.me/') and 'Dönüş: 14:00' in wurl and 'Alya 8, 2 kişi' in wurl and '′ K' in wurl, 'L: WhatsApp güvenlik mesajı: ' + wurl[:140])
        await wp.close()
        await pg.screenshot(path=SHOTS + '/l_liste.png', full_page=True)
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        await pg.click('.rechead button[data-open="liste"]'); await pg.wait_for_timeout(300)
        check(await pg.is_checked('#sheet input[data-ck^="k:Can"]'), 'L: işaret bugün için saklandı')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        print('L1 errors:', errs); check(not errs, 'L: sayfa hatası yok (Kenny)')
        await ctx.close()
        # Ogün: bağlantıyla açar, kendi envanterine kopyalar
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/#' + frag); await pg.wait_for_timeout(1500)
        sh = await pg.inner_text('#sheet') if await pg.is_visible('#sheet') else ''
        check('Kenny' in sh and 'envanter' in sh.lower() and not await pg.is_visible('#welcome'), 'L: bağlantı açılınca kopyalama sorusu: ' + sh.replace('\n', ' ')[:120])
        await pg.click('#sheet button[data-share="al"]'); await pg.wait_for_timeout(600)
        st = await state(pg)
        check(len(st['inv']['items']) >= 50 and not st['pkg']['unlocked'] and not st['systems'], 'L: %d kalem Ogün’ün envanterine kopyalandı, özel paket yok' % len(st['inv']['items']))
        check('#al=' not in pg.url, 'L: bağlantı adresten silindi')
        check(await pg.locator('#invList .item').count() > 3, 'L: envanter ekranı dolu')
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(300)
        bn = await pg.inner_text('#banners'); check('Bulut yedeğin kapalı' in bn, 'L: yedek hatırlatma bandı')
        await pg.click('#banners button[data-act="bkSnooze"]'); await pg.wait_for_timeout(200)
        check('Bulut yedeğin kapalı' not in await pg.inner_text('#banners'), 'L: hatırlatma 7 gün ertelendi')
        # aynı bağlantı ikinci kez: tekrar eklemez
        await pg.evaluate('(f) => { location.hash = f; }', frag); await pg.wait_for_timeout(1500)
        await pg.click('#sheet button[data-share="al"]'); await pg.wait_for_timeout(500)
        st2 = await state(pg); check(len(st2['inv']['items']) == len(st['inv']['items']), 'L: aynı kalemler ikinci kez eklenmedi')
        print('L2 errors:', errs); check(not errs, 'L: sayfa hatası yok (Ogün)')
        await ctx.close()
        # rig sistemi bağlantısı (sıkıştırmasız biçim)
        ans = {'mode': 'tekne', 'region': 'ege', 'techs': ['dip'], 'species': ['karagoz', 'mercan'], 'lay': {'dip': ['hirsizli']}, 'klass': 'porsiyon', 'time': 'gunduz', 'bottoms': ['kum'], 'size': 'dengeli', 'rodMax': '', 'name': 'Ege dip'}
        raw = 'j' + base64.urlsafe_b64encode(json.dumps({'t': 'sistem', 'v': 1, 'from': 'Kenny', 'systems': [{'name': 'Ege dip', 'answers': ans}]}).encode()).decode().rstrip('=')
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/#al=' + raw); await pg.wait_for_timeout(1200)
        await pg.click('#sheet button[data-share="al"]'); await pg.wait_for_timeout(600)
        st = await state(pg); sy = list(st['systems'].values())
        check(len(sy) == 1 and sy[0]['name'] == 'Ege dip (Kenny)' and len(sy[0]['rigs']) >= 2, 'L: paylaşılan rig sistemi kuruldu (%d rig)' % (len(sy[0]['rigs']) if sy else 0))
        check(await pg.locator('#rigList article.rig').count() == len(sy[0]['rigs']), 'L: Rigler ekranında')
        print('L3 errors:', errs); check(not errs, 'L: sayfa hatası yok (sistem)')
        await ctx.close()

        # ================================================== M) v0.10: ortak av haritası (kapalı grup)
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        await pg.click('.tabbar button[data-v="avlar"]'); await pg.click('#addCatch'); await pg.wait_for_timeout(250)
        await pg.select_option('#cf-sp', 'mercan'); await pg.select_option('#cf-rig', 'ozel:G-P5'); await pg.fill('#cf-kg', '0,85'); await pg.click('#cfSave'); await pg.wait_for_timeout(800)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="grup"]'); await pg.wait_for_timeout(300)
        await pg.fill('#gp-repo', 'kenny/alyssa-yedek'); await pg.fill('#gp-tok', GOOD_TOKEN); await pg.fill('#gp-name', 'Seferihisar avcıları'); await pg.fill('#gp-me', 'Kenny')
        await pg.click('#grpForm button[type="submit"]'); await pg.wait_for_timeout(2000)
        gfiles = [k for k in GH if k.startswith('grup/')]
        check('grup/README.md' in gfiles and any(k.startswith('grup/kenny-') for k in gfiles), 'M: grup kuruldu, dosyalar: ' + str(gfiles))
        href = await pg.get_attribute('#grpInvite a.btn', 'href'); txt = urllib.parse.unquote(href.split('text=', 1)[1]); inv = txt[txt.index('http'):].split('#', 1)[1]
        check(inv.startswith('grup='), 'M: davet bağlantısı hazır')
        await pg.screenshot(path=SHOTS + '/m_grup.png')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # avı paylaş
        await pg.click('.tabbar button[data-v="avlar"]'); await pg.locator('#catchList .catch').first.click(); await pg.wait_for_timeout(400)
        check('Grupla paylaş' in await pg.inner_text('#sheet'), 'M: av sayfasında grupla paylaş')
        await pg.click('#sheet input[data-grpshare]'); await pg.wait_for_timeout(1200)
        kf = [k for k in GH if k.startswith('grup/kenny-')][0]; raw = GH[kf]['bytes'].decode()
        check('alyssa-grup' in raw and 'Mercan' not in raw and 'mercan' not in raw and 'G-P5' not in raw, 'M: grup dosyası şifreli')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        print('M1 errors:', errs); check(not errs, 'M: sayfa hatası yok (Kenny)')
        # Ogün davetle katılır ve haritada görür
        ctx2, pg2, errs2 = await new_ctx(b)
        await pg2.goto(BASE + '/dist/?qa=1#' + inv); await pg2.wait_for_timeout(1500)
        check('davet' in (await pg2.inner_text('#sheet')).lower() and not await pg2.is_visible('#welcome'), 'M: davet sayfası açıldı')
        await pg2.fill('#gj-name', 'Ogün'); await pg2.click('#sheet button[data-grp="join"]'); await pg2.wait_for_timeout(2000)
        check(any(k.startswith('grup/ogun-') for k in GH), 'M: Ogün gruba katıldı')
        mem = await pg2.inner_text('#sheet'); check('Kenny' in mem and '1 paylaşılan av' in mem, 'M: üyeler listesi: ' + mem.replace('\n', ' ')[:160])
        await pg2.click('#sheet button[data-grp="map"]'); await pg2.wait_for_selector('#map.leaflet-container', timeout=10000); await pg2.wait_for_timeout(1500)
        check(await pg2.locator('path.mgrp').count() == 1, 'M: haritada Kenny’nin avı')
        gc = await pg2.evaluate('window.ALYSSA_QA.grpCatches()')
        check(gc and gc[0]['member'] == 'Kenny' and gc[0]['spName'] == 'Mercan' and gc[0]['km'] == 1, 'M: grup avı ayrıntısı (tür, üye, 1 km kare)')
        await pg2.locator('path.mgrp').first.click(); await pg2.wait_for_timeout(300)
        check('Kenny' in await pg2.inner_text('.leaflet-popup-content'), 'M: işaret açıklaması')
        await pg2.screenshot(path=SHOTS + '/m_harita.png')
        await pg2.click('#sheet [data-close]'); await pg2.wait_for_timeout(200)
        # Kenny gecikme ekler: avı 1 gün sonra görünsün
        await pg.locator('#catchList .catch').first.click(); await pg.wait_for_timeout(400)
        await pg.select_option('#sheet select[data-grpopt="delay"]', '1'); await pg.wait_for_timeout(1200)
        n = await pg2.evaluate('window.ALYSSA_QA.grpFetch(true).then(() => window.ALYSSA_QA.grpCatches().length)')
        check(n == 0, 'M: gecikmeli av henüz görünmüyor')
        print('M2 errors:', errs2); check(not errs2, 'M: sayfa hatası yok (Ogün)')
        await ctx2.close(); await ctx.close()

        # ================================================== F) Rig Atölyesi: sıfırdan sistem, envanter, alışveriş
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="kur"]'); await pg.wait_for_timeout(300)
        check('Rig Atölyesi' in await pg.inner_text('#sheet'), 'F: sihirbaz açıldı')
        await pg.click('button[data-wzm="tekne"]'); await pg.click('button[data-wzr="ege"]'); await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(150)
        check(await pg.is_disabled('button[data-wz="next"]'), 'F: teknik seçmeden ilerlenemez')
        await pg.click('button[data-wzt="dip"]'); await pg.click('button[data-wzt="orkinos"]'); await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(150)
        for sp in ['karagoz', 'mercan', 'orkinos']: await pg.click(f'button[data-wzs="{sp}"]')
        await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(150)
        yem = await pg.locator('#sheet .bchips button[data-wzy]').all_inner_texts()
        check('Hangi yemlerle' in await pg.inner_text('#sheet') and any('Mamun' in y for y in yem) and any('Sardalya' in y for y in yem), 'F: yem adımı, türlere uygun yemler (%d)' % len(yem))
        await pg.click('button[data-wzy="mamun"]'); await pg.click('button[data-wzy="midye"]'); await pg.wait_for_timeout(100)
        check(await pg.get_attribute('button[data-wzy="mamun"]', 'aria-pressed') == 'true', 'F: yem seçildi')
        await pg.screenshot(path=SHOTS + '/f_yem.png')
        await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(150)
        await pg.click('button[data-wzl="dip|iki"]')            # hırsızlı + 2 iğneli
        await pg.click('button[data-wzset="klass"][data-val="porsiyon"]'); await pg.click('button[data-wzset="time"][data-val="gunduz"]')
        await pg.click('button[data-wzb="kum"]')
        await pg.screenshot(path=SHOTS + '/f_takim.png')
        await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(250)
        cnt = await pg.inner_text('#wzCount'); check(cnt.startswith('5 rig'), 'F: rig sayısı ' + cnt)
        await pg.fill('#wz-name', 'Ege dip sistemim'); await pg.fill('#wz-rod', '140')
        await pg.screenshot(path=SHOTS + '/f_kur.png')
        await pg.click('button[data-wz="done"]'); await pg.wait_for_timeout(600)
        st = await state(pg); sy = [v for v in st['systems'].values() if v['source'] == 'sihirbaz']
        check(len(sy) == 1 and len(sy[0]['rigs']) == 5, 'F: sistem kaydedildi (%d rig)' % (len(sy[0]['rigs']) if sy else 0))
        check(sy[0]['answers'].get('baits') == ['mamun', 'midye'] and st['profile'].get('baits') == ['mamun', 'midye'], 'F: yem tercihi kaydedildi')
        kg = [r for r in sy[0]['rigs'] if 'karagoz' in r['species']][0]
        check(kg['baits'] and 'Mamun' in (kg['baits']['ana']['envanter'] + kg['baits']['alt']['envanter']), 'F: tercih edilen yem rige girdi: ' + json.dumps(kg['baits'], ensure_ascii=False)[:120])
        r0 = sy[0]['rigs'][0]
        check(r0['sinker']['max'] == 140, 'F: kamış sınırı kurşuna işlendi')
        check(any(sl['k'] == 'hirsiz' for sl in r0['slots']), 'F: hırsızlı yuvaları')
        names = [r['name'] for r in sy[0]['rigs']]; print('   rigler:', names)
        check(any('2 iğneli' in n for n in names) and any('Chunking' in n for n in names), 'F: 2 iğneli ve orkinos rigleri var')
        check(await pg.locator('#rigList article.rig.off').count() == 5, 'F: envanter boşken hepsi tamamlanmadı')
        await pg.screenshot(path=SHOTS + '/f_rigler_bos.png')
        # dünya / Türkiye seviyeleri
        await pg.click('button[data-tier="dunya"]'); await pg.wait_for_timeout(200)
        t1 = await pg.locator('#rigList article.rig').first.inner_text(); check('Gamakatsu' in t1 or 'Owner' in t1, 'F: dünya seviyesinde ürün önerisi')
        await pg.click('button[data-tier="envanter"]'); await pg.wait_for_timeout(150)
        # katalogdan iğne + florokarbon + örgü ip ekle
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.click('#addItem'); await pg.wait_for_timeout(250)
        await pg.fill('#it-search', 'chinu'); await pg.wait_for_timeout(150)
        check(await pg.locator('#itCat .catpick').count() >= 3, 'F: katalog araması sonuç veriyor')
        await pg.click('#itCat .catpick >> nth=0'); await pg.wait_for_timeout(100)
        check(await pg.input_value('#it-brand') == 'Gamakatsu' and await pg.input_value('#it-pat') == 'Chinu', 'F: katalog formu doldurdu')
        await pg.fill('#it-sizes', 'No:1, No:2, No:3'); await pg.click('#itSave'); await pg.wait_for_timeout(300)
        for nm, cat, spec in [('Seaguar Grandmax FC', 'fc', '0,26 mm'), ('Seaguar Grandmax FC', 'fc', '0,30 mm'), ('Daiwa J-Braid x8', 'braid', '0,16 mm')]:
            await pg.click('#addItem'); await pg.wait_for_timeout(200)
            await pg.select_option('#it-cat', cat); await pg.fill('#it-brand', nm.split(' ')[0]); await pg.fill('#it-model', ' '.join(nm.split(' ')[1:])); await pg.fill('#it-spec', spec)
            await pg.click('#itSave'); await pg.wait_for_timeout(250)
        await pg.screenshot(path=SHOTS + '/f_envanter.png')
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig:not(.off)').count() == 0, 'F: iğne ve ip var ama kamış, makine ve terminal yokken rig hazır değil')
        t1 = await pg.locator('#rigList article.rig').first.inner_text(); check(U('Kamış') in U(t1) and U('Makine') in U(t1) and U('T-fırdöndü') in U(t1), 'F: rig kartında kamış, makine ve terminal satırları')
        # kamış, makine ve terminal
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.click('button[data-iseg="gear"]'); await pg.wait_for_timeout(150)
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.fill('#it-brand', 'Shimano'); await pg.fill('#it-model', 'Alivio Boat'); await pg.select_option('#it-rodt', 'tekne'); await pg.fill('#it-rodm', '200'); await pg.click('#itSave'); await pg.wait_for_timeout(250)
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.select_option('#it-cat', 'reel'); await pg.fill('#it-brand', 'Shimano'); await pg.fill('#it-model', 'Socorro 5000'); await pg.fill('#it-reels', '5000'); await pg.click('#itSave'); await pg.wait_for_timeout(250)
        await pg.click('button[data-iseg="terminal"]'); await pg.wait_for_timeout(150)
        for k in ['std:t:tfirdondu|-', 'std:t:firdondu|-', 'std:t:stop|-']:
            await pg.click(f'#invList button[data-stk="{k}"][data-st="var"]'); await pg.wait_for_timeout(150)
        await pg.click('#invList button[data-cyc="std:t:k-armut|120 g"]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        ready_n = await pg.locator('#rigList article.rig:not(.off)').count()
        check(ready_n >= 2, 'F: kamış, makine ve terminal eklenince porsiyon dip rigleri hazır (%d)' % ready_n)
        await pg.screenshot(path=SHOTS + '/f_rigler_hazir.png')
        # alışveriş: orkinos için eksikler, "Aldım, envantere ekle"
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('button[data-open="alisveris"]'); await pg.wait_for_timeout(300)
        nb = await pg.locator('#sheet button[data-buyadd], #sheet button[data-bought]').count(); check(nb >= 3, 'F: envanterde olmayan ürünler listede (%d)' % nb)
        sh = await pg.inner_text('#sheet'); check('Super Mutu' in sh or 'Demon' in sh, 'F: eksik iğne hazır listeden ürün adıyla öneriliyor')
        await pg.screenshot(path=SHOTS + '/f_alisveris.png')
        while await pg.locator('#sheet button[data-buyadd], #sheet button[data-bought]').count():
            await pg.click('#sheet button[data-buyadd], #sheet button[data-bought] >> nth=0'); await pg.wait_for_timeout(200)
        check('Alınacak bir şey yok' in await pg.inner_text('#sheet'), 'F: tüm eksikler envantere eklenince liste boşaldı')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig.off').count() == 0, 'F: bütün rigler hazır')
        # Bugün önerisi sihirbaz riglerinden
        await pg.click('#noLoc button[data-act="gpsloc"]') if await pg.is_visible('#noLoc') else None
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.click('#noLoc button[data-act="gpsloc"]'); await pg.wait_for_timeout(3500)
        check(await pg.locator('#recList article.rig').count() >= 1, 'F: Bugün bağla sihirbaz rigini öneriyor')
        await pg.screenshot(path=SHOTS + '/f_bugun.png')
        # sistemi düzenle: sade → daha az rig
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.click('button[data-systool="edit"]'); await pg.wait_for_timeout(300)
        for _ in range(5): await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(120)
        await pg.click('button[data-wzz="sade"]'); await pg.wait_for_timeout(150)
        await pg.click('button[data-wz="done"]'); await pg.wait_for_timeout(500)
        st = await state(pg); sy = [v for v in st['systems'].values() if v['source'] == 'sihirbaz']
        check(len(sy) == 1 and len(sy[0]['rigs']) == 3, 'F: sade sistemde rig sayısı %d' % len(sy[0]['rigs']))
        await pg.click('button[data-systool="toggle"]'); await pg.wait_for_timeout(200)
        check(await pg.locator('#rigList article.rig').count() == 0, 'F: kapatılan sistem listeden çıktı')
        await pg.click('button[data-systool="toggle"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-systool="del"]'); await pg.click('button[data-systool="del"]'); await pg.wait_for_timeout(200)
        st = await state(pg); check(not [v for v in st['systems'].values() if v['source'] == 'sihirbaz'], 'F: sistem silindi')
        for v in ['bugun', 'takvim', 'avlar', 'rigler', 'envanter', 'daha']:
            await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(120); await overflow(pg, 'F ' + v)
        print('F errors:', errs); check(not errs, 'F: sayfa hatası yok')
        await ctx.close()

        # ================================================== N) v0.11: envanter düzeni, hazır listeler, yemler, alışveriş, göç, harita anahtarı
        GKEY = json.load(open(ROOT + '/data/kenny_av_db.json', encoding='utf-8')).get('settings', {}).get('gkey', '')
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="bos"]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#invList details.stdl').count() == 1, 'N: iğnelerde hazır liste')
        nstd = await pg.locator('#invList details.stdl .srow').count(); check(nstd >= 35, 'N: hazır iğne listesi %d model' % nstd)
        await pg.screenshot(path=SHOTS + '/n_igne_bos.png')
        # boy çipi: yok → var → bitti → yok
        k = 'std:h:gamakatsu-hyper-chinu|No:2'
        await pg.click(f'#invList button[data-cyc="{k}"]'); await pg.wait_for_timeout(200)
        st = await state(pg); check(st['inv']['status'].get(k) == 'var', 'N: boya dokununca var')
        check(await pg.locator('#invList > .item').count() == 1 and U('Var (1)') in U(await pg.inner_text('#invList')), 'N: işaretlenen kalem “Var” bölümüne çıktı')
        check(await pg.evaluate('document.querySelector("#invList details.stdl").open') is True, 'N: hazır liste açık kaldı')
        await pg.click(f'#invList .item button[data-cyc="{k}"]'); await pg.wait_for_timeout(200)
        st = await state(pg); check(st['inv']['status'].get(k) == 'bitti', 'N: ikinci dokunuş bitti (alınacak)')
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="alisveris"]'); await pg.wait_for_timeout(300)
        sh = await pg.inner_text('#sheet'); check('Gamakatsu Hyper Chinu' in sh and U('Bitti ya da alınacak') in U(sh), 'N: bitti iğne alışveriş listesinde')
        await pg.click(f'#sheet button[data-bought="{k}"]'); await pg.wait_for_timeout(300)
        st = await state(pg); check(st['inv']['status'].get(k) == 'var', 'N: “Aldım” ile yeniden var')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # paket birimi
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.wait_for_timeout(200)
        await pg.click('#invList .item button[data-unit="std:h:gamakatsu-hyper-chinu"][data-u="paket"]'); await pg.wait_for_timeout(250)
        st = await state(pg); check(st['inv']['unit'].get('std:h:gamakatsu-hyper-chinu') == 'paket', 'N: kalem paketle sayılıyor')
        qsel = '#invList input[data-qk="%s"]' % k
        await pg.fill(qsel, '2'); await pg.dispatch_event(qsel, 'change'); await pg.wait_for_timeout(250)
        st = await state(pg); check(st['inv']['qty'].get(k) == 2 and await pg.evaluate('(k) => ALYSSA_QA.stockOf(k.split("|")[0], k.split("|")[1])', k) == 'var', 'N: 2 paket var')
        txt = await pg.inner_text('#invList'); check('paket' in txt, 'N: paket birimi yazıyor')
        check(await pg.locator('#invList .item .qrow').count() == 1, 'N: yalnızca işaretli boy satır, diğerleri çip')
        k3 = 'std:h:gamakatsu-hyper-chinu|No:3'
        await pg.click(f'#invList button[data-qadd="{k3}"]'); await pg.wait_for_timeout(250)
        st = await state(pg); check(st['inv']['qty'].get(k3) == 1 and await pg.locator('#invList .item .qrow').count() == 2, 'N: diğer boy çipi 1 paketle eklendi')
        await pg.click(f'#invList button[data-step="-1"][data-k="{k}"]'); await pg.wait_for_timeout(150); await pg.click(f'#invList button[data-step="-1"][data-k="{k}"]'); await pg.wait_for_timeout(250)
        check(await pg.evaluate('(k) => ALYSSA_QA.stockOf(k.split("|")[0], k.split("|")[1])', k) == 'bitti', 'N: 0 paket → bitti')
        sl = await pg.evaluate('ALYSSA_QA.shoppingList().map(n => n.k)'); check(k in sl, 'N: 0 paket alışveriş listesinde')
        await pg.screenshot(path=SHOTS + '/n_igne_paket.png')
        await pg.click(f'#invList button[data-alk="{k}"]'); await pg.wait_for_timeout(250)
        check(await pg.evaluate('(k) => ALYSSA_QA.stockOf(k.split("|")[0], k.split("|")[1])', k) == 'yok' and k not in await pg.evaluate('ALYSSA_QA.shoppingList().map(n => n.k)'), 'N: “Alınacak” kaldırılınca listeden çıktı')
        # ayarlardan iğne birimi
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="ayarlar"]'); await pg.wait_for_timeout(250)
        await pg.click('button[data-set="hookUnit"][data-val="paket"]'); await pg.wait_for_timeout(200)
        st = await state(pg); check(st['settings']['hookUnit'] == 'paket', 'N: ayar: iğne paketle')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # terminal ve kurşun
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.click('button[data-iseg="terminal"]'); await pg.wait_for_timeout(250)
        check(await pg.locator('#invList details.stdl .srow, #invList details.stdl .bchip').count() >= 20, 'N: hazır terminal ve kurşun listesi')
        await pg.click('#invList button[data-stk="std:t:tfirdondu|-"]'); await pg.wait_for_timeout(200)
        await pg.click('#invList button[data-cyc="std:t:k-armut|120 g"]'); await pg.wait_for_timeout(200)
        st = await state(pg); check(st['inv']['status'].get('std:t:tfirdondu|-') == 'var' and st['inv']['status'].get('std:t:k-armut|120 g') == 'var', 'N: T-fırdöndü ve 120 g armut kurşun var')
        check(not any(k2.startswith('std:t:') for k2 in st['inv']['qty']), 'N: terminalde adet tutulmuyor')
        await pg.click('#invList .item button[data-stk="std:t:tfirdondu|-"][data-st="alinacak"]'); await pg.wait_for_timeout(200)
        check('std:t:tfirdondu|-' in await pg.evaluate('ALYSSA_QA.shoppingList().map(n => n.k)'), 'N: terminal alınacak → alışveriş listesinde')
        await pg.screenshot(path=SHOTS + '/n_terminal.png')
        # yemler
        await pg.click('button[data-iseg="bait"]'); await pg.wait_for_timeout(250)
        nb = await pg.locator('#invList button[data-bait]').count(); check(nb >= 30, 'N: hazır yem listesi %d' % nb)
        txt = await pg.inner_text('#invList'); check('Canlı istavrit' in txt and 'Teke (canlı karides)' in txt and U('Canlı yem') in U(txt), 'N: canlı yemler listede')
        check(await pg.locator('#invList button.bchip.on').count() == 0, 'N: yemler varsayılan yok')
        await pg.click('#invList button[data-bait="std:y:mamun"]'); await pg.click('#invList button[data-bait="std:y:canli-istavrit"]'); await pg.wait_for_timeout(250)
        check(await pg.locator('#invList button.bchip.on').count() == 2, 'N: iki yem var')
        await pg.screenshot(path=SHOTS + '/n_yem.png')
        st = await state(pg); check(not any(k2.startswith('std:y:') for k2 in st['inv']['qty']), 'N: yemde adet yok')
        await pg.click('#invList button[data-act="baitReset"]'); await pg.wait_for_timeout(250)
        check(await pg.locator('#invList button.bchip.on').count() == 0, 'N: avdan dönünce hepsi yok')
        # kamış ve makine: hayalindeki kamış "alınacak"
        await pg.click('button[data-iseg="gear"]'); await pg.click('#addItem'); await pg.wait_for_timeout(250)
        check(await pg.input_value('#it-cat') == 'rod' and await pg.is_visible('#it-rodw'), 'N: kamış formu')
        await pg.fill('#it-brand', 'Major Craft'); await pg.fill('#it-model', 'Giant Killing Slow'); await pg.select_option('#it-rodt', 'slowjig')
        await pg.fill('#it-rodl', '1,98'); await pg.fill('#it-rodm', '220'); await pg.fill('#it-rodp', '3')
        await pg.click('#it-st button[data-itst="alinacak"]'); await pg.click('#itSave'); await pg.wait_for_timeout(300)
        st = await state(pg); rod = [i for i in st['inv']['items'].values() if i['cat'] == 'rod'][0]
        check(rod['rod'] == {'type': 'slowjig', 'len': 1.98, 'max': 220, 'pe': 3} and rod['stock'] == {'-': 'alinacak'}, 'N: kamış bilgileri ve alınacak: ' + json.dumps(rod['rod']))
        txt = await pg.inner_text('#invList'); check('Slow jig · 1,98 m · max 220 g · PE 3' in txt and U('Alınacak / bitti') in U(txt), 'N: kamış alınacak bölümünde')
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.select_option('#it-cat', 'reel'); await pg.wait_for_timeout(100)
        check(await pg.is_visible('#it-reelw') and not await pg.is_visible('#it-rodw') and not await pg.is_visible('#it-sizew'), 'N: makine formu')
        await pg.fill('#it-brand', 'Shimano'); await pg.fill('#it-model', 'Stradic 4000'); await pg.fill('#it-reels', '4000'); await pg.click('#itSave'); await pg.wait_for_timeout(300)
        txt = await pg.inner_text('#invList'); check('Spinning (açık makara) · boy 4000' in txt, 'N: makine var bölümünde')
        await pg.screenshot(path=SHOTS + '/n_kamis.png')
        sl = await pg.evaluate('ALYSSA_QA.shoppingList().map(n => n.k)'); check(any(x.startswith(rod['id']) for x in sl), 'N: hayaldeki kamış alışveriş listesinde')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150)
            for seg in ['hook', 'line', 'gear', 'jig', 'terminal', 'bait']:
                await pg.click(f'button[data-iseg="{seg}"]'); await pg.wait_for_timeout(120)
                await pg.evaluate('document.querySelectorAll("#invList details").forEach(d => d.open = true)'); await pg.wait_for_timeout(60); await overflow(pg, 'N %d px envanter %s' % (w, seg))
        await pg.click('button[data-iseg="hook"]'); await pg.wait_for_timeout(100); await pg.screenshot(path=SHOTS + '/n_igne_320.png')
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="alisveris"]'); await pg.wait_for_timeout(250); await overflow(pg, 'N 320 px alışveriş')
        await pg.screenshot(path=SHOTS + '/n_alisveris_320.png'); await pg.click('#sheet [data-close]')
        await pg.set_viewport_size({'width': 390, 'height': 860})
        # yem katmanı: rig yemden bağımsız; kart elindeki uygun yemi yazar
        ans = {'mode': 'tekne', 'region': 'ege', 'techs': ['dip', 'capari'], 'species': ['karagoz', 'istavrit'], 'baits': [], 'lay': {'dip': ['hirsizli']}, 'klass': 'porsiyon', 'time': 'gunduz', 'bottoms': ['kum'], 'size': 'sade', 'rodMax': '', 'name': 'T'}
        rigs = await pg.evaluate('(a) => ALYSSA_QA.genSystem(a)', ans)
        kg = [r for r in rigs if 'karagoz' in r['species']][0]
        bp = await pg.evaluate('(r) => { const p = ALYSSA_QA.baitPick(r); return {use: p.use && p.use.t, st: p.use && p.use.st, n: p.list.length}; }', kg)
        check(bp['st'] == 'yok' and bp['n'] >= 2, 'N: yem yokken öneri “al”: ' + json.dumps(bp, ensure_ascii=False))
        await pg.evaluate('() => { const S = ALYSSA_QA.state(); S.inv.status["std:y:karides|-"] = "var"; }')
        bp = await pg.evaluate('(r) => { const p = ALYSSA_QA.baitPick(r); return {use: p.use && p.use.t, st: p.use && p.use.st}; }', kg)
        check(bp['st'] == 'var' and 'Karides' in bp['use'], 'N: elindeki uygun yem öne çıktı: ' + json.dumps(bp, ensure_ascii=False))
        cp = [r for r in rigs if r['tech'] == 'capari'][0]
        sp = [sl for sl in cp['slots'] if sl['k'] == 'yem'][0]['sp']
        r1 = await pg.evaluate('(sp) => ALYSSA_QA.resolveSlot(sp)', sp)
        check(r1['loose'] and r1['loose']['item'] == 'std:j:capari-takimi' and not r1['loose']['ok'], 'N: çapari yuvası hazır listedeki çapari takımına bağlandı (yok)')
        await pg.evaluate('() => { ALYSSA_QA.state().inv.status["std:j:capari-takimi|#10"] = "var"; }')
        r1 = await pg.evaluate('(sp) => ALYSSA_QA.resolveSlot(sp)', sp)
        check(r1['strict'] and r1['strict']['size'] == '#10', 'N: #10 çapari var → yuva tamam')
        sj = {'kind': 'lure', 'lt': 'slowjig', 'kw': ['slow', 'jig'], 'g': [100, 250]}
        await pg.evaluate('() => { ALYSSA_QA.state().inv.status["std:j:metal-jig-atma|30 g"] = "var"; }')
        r2 = await pg.evaluate('(sp) => ALYSSA_QA.resolveSlot(sp)', sj)
        check(not r2['strict'] and (not r2['loose'] or not r2['loose']['ok']), 'N: 30 g metal jig slow jig yuvasını doldurmuyor')
        tt = await pg.evaluate('() => [ALYSSA_QA.termTypes({cat: "terminal", name: "T-fırdöndü (boncuklu)"}), ALYSSA_QA.termTypes({cat: "sinker", name: "Kurşunlar 50–200 g", spec: "Armut/damla (dip) + gezer zeytin"}), ALYSSA_QA.baitKey("Canlı karides"), ALYSSA_QA.baitKey("Sülünez ince şerit"), ALYSSA_QA.baitKey("Kalamar çaparisi"), ALYSSA_QA.baitKey("Canlı balık")]')
        check(tt == [['tfirdondub', 'tfirdondu'], ['k-armut', 'k-damla', 'k-zeytin'], 'teke', 'sulunez', None, '*canli'], 'N: terminal tipi ve yem eşleme: ' + json.dumps(tt, ensure_ascii=False))
        print('N1 errors:', errs); check(not errs, 'N: sayfa hatası yok (yeni kullanıcı)')
        await ctx.close()
        # Kenny: özel paket — yemler varsayılan yok, rig kartı “gitmeden al”, harita anahtarı paketle geldi, standart kalem paket kalemiyle çakışmıyor
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        st = await state(pg); check(GKEY and st['settings'].get('gkey') == GKEY, 'N: harita anahtarı özel paketle geldi')
        it = await pg.evaluate('() => { const I = ALYSSA_QA.items(); return {mamunStd: !!I["std:y:mamun"], chinuStd: !!I["std:h:gamakatsu-chinu"], hyper: !!I["std:h:gamakatsu-hyper-chinu"], stopStd: !!I["std:t:stop"], tStd: !!I["std:t:tfirdondu"], kursun: !!I["std:t:k-armut"], boncuk: !!I["std:t:boncuk"]}; }')
        check(it == {'mamunStd': False, 'chinuStd': False, 'hyper': True, 'stopStd': False, 'tStd': False, 'kursun': False, 'boncuk': True}, 'N: paketteki kalemlerin hazır liste karşılığı gizli: ' + json.dumps(it))
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig').count() == 32, 'N: 32 rig yerinde')
        t0 = await pg.locator('#rigList article.rig').first.inner_text(); check('gitmeden al' in t0, 'N: yem yokken rig kartı “gitmeden al”')
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.click('button[data-iseg="bait"]'); await pg.wait_for_timeout(250)
        bid = await pg.evaluate('() => Object.values(ALYSSA_QA.items()).find(i => i.cat === "bait" && /Sülünez/.test(i.name)).id')
        await pg.click(f'#invList button[data-bait="{bid}"]'); await pg.wait_for_timeout(250)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        t0 = await pg.locator('#rigList article.rig').first.inner_text(); check('gitmeden al' not in t0 and 'Sülünez' in t0, 'N: Sülünez var → kart elindeki yemi yazıyor')
        await pg.screenshot(path=SHOTS + '/n_kenny_rig.png')
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.click('.rechead button[data-open="liste"]'); await pg.wait_for_timeout(300)
        ck = await pg.inner_text('#sheet'); check('Yem:' in ck and ('(elinde)' in ck or '(gitmeden al)' in ck), 'N: çıkış listesinde yem durumu')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        print('N2 errors:', errs); check(not errs, 'N: sayfa hatası yok (Kenny)')
        await ctx.close()
        # v0.10 profilinden göç: ip ve terminal adetleri duruma döner, iğne adedi "adet" birimiyle kalır
        old = {'v': 2, 'created': '2026-10-01T00:00:00Z', 'seenVersion': '0.10.0', 'onboarded': True, 'mode': 'tekne', 'profile': {'name': ''}, 'settings': {},
               'inv': {'items': {'u-fc': {'id': 'u-fc', 'cat': 'fc', 'brand': 'Seaguar', 'model': 'FC 0,30 mm', 'name': 'Seaguar FC 0,30 mm', 'spec': '0,30 mm', 'sizes': [], 'stock': {'-': 'var'}, 'src': 'kullanici'},
                                  'u-hk': {'id': 'u-hk', 'cat': 'hook', 'brand': 'Owner', 'model': 'Test Chinu', 'name': 'Owner Test Chinu', 'pattern': 'Chinu', 'sizes': ['No:1'], 'stock': {'No:1': 'var'}, 'src': 'kullanici'},
                                  'u-tr': {'id': 'u-tr', 'cat': 'terminal', 'brand': '', 'model': 'Fırdöndü', 'name': 'Fırdöndü', 'sizes': [], 'stock': {'-': 'var'}, 'src': 'kullanici'}},
                       'qty': {'u-fc|-': 3, 'u-hk|No:1': 12, 'u-tr|-': 0}, 'status': {}},
               'systems': {}, 'locations': {}, 'active': None, 'wx': None, 'pkg': {'unlocked': False, 'version': None, 'need': False, 'locs': []}, 'backup': {}}
        ctx, pg, errs = await new_ctx(b, {'alyssa-v1': json.dumps(old)})
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1500)
        st = await state(pg); inv = st['inv']
        check(inv.get('v') == 2 and inv['qty'] == {'u-hk|No:1': 12} and inv['unit'].get('u-hk') == 'adet' and inv['status'].get('u-fc|-') == 'var' and inv['status'].get('u-tr|-') == 'bitti', 'N: göç: ' + json.dumps({k: inv.get(k) for k in ('qty', 'unit', 'status')}))
        check(await pg.evaluate('ALYSSA_QA.stockOf("u-hk", "No:1")') == 'var', 'N: göç sonrası iğne 12 adet var')
        print('N3 errors:', errs); check(not errs, 'N: sayfa hatası yok (göç)')
        await ctx.close()
        check(GKEY and GKEY not in open(ROOT + '/app/preview/alyssa_onizleme.html', encoding='utf-8').read(), 'N: önizlemede harita anahtarı yok')
        check(GKEY and GKEY not in open(ROOT + '/app/dist/index.html', encoding='utf-8').read() and GKEY not in open(ROOT + '/app/dist/paket/ozel.enc.json', encoding='utf-8').read(), 'N: yayın dosyalarında anahtar düz yazılı değil')

        # ================================================== P) v0.12: Türlerim, tür planı, kamış/makine/terminal gereksinimi
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="bos"]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="turler"]'); await pg.wait_for_timeout(300)
        check('Türlerim' in await pg.inner_text('#sheet') and await pg.is_visible('#tr-q'), 'P: Türlerim ekranı')
        await pg.fill('#tr-q', 'çinekop'); await pg.wait_for_timeout(200)
        res = await pg.inner_text('#trRes'); check('Lüfer' in res and 'listede yok' not in res, 'P: yerel ad (çinekop → Lüfer): ' + res.replace('\n', ' ')[:80])
        await pg.fill('#tr-q', 'istavrit'); await pg.wait_for_timeout(200)
        await pg.click('#trRes button[data-tradd="istavrit"]'); await pg.wait_for_timeout(400)
        sh = await pg.inner_text('#sheet')
        check('Trachurus' in sh and 'Önerilen takım' in sh and 'Alman gerekenler' in sh, 'P: istavrit planı açıldı')
        pl = await pg.evaluate('() => { const p = ALYSSA_QA.planFor({id: "istavrit", name: "İstavrit"}); return {techs: p.techs, tech: p.tech, kinds: p.rg.slots.map(s => s.kind), miss: ALYSSA_QA.missingOf(p.rg).map(s => s.label)}; }')
        check(pl['tech'] == 'capari' and 'rod' in pl['kinds'] and 'reel' in pl['kinds'] and 'term' in pl['kinds'], 'P: tekneden istavrit → çapari; kamış, makine, terminal yuvaları: ' + json.dumps(pl, ensure_ascii=False)[:160])
        check(len(pl['miss']) >= 5 and 'Kamış' in pl['miss'] and 'Makine' in pl['miss'], 'P: boş envanterde alınacaklar %d' % len(pl['miss']))
        await pg.screenshot(path=SHOTS + '/p_istavrit.png', full_page=True)
        await pg.click('#sheet button[data-trshop="istavrit"]'); await pg.wait_for_timeout(300)
        st = await state(pg); check(len(st['shopX']) == len(pl['miss']) and all('İstavrit' in x['for'] for x in st['shopX'].values()), 'P: eksikler alışveriş listesine aktarıldı (%d)' % len(st['shopX']))
        await pg.click('#sheet button[data-trrig="istavrit"]'); await pg.wait_for_timeout(300)
        st = await state(pg); tr = st['systems'].get('tur')
        check(tr and len(tr['rigs']) == 1 and tr['rigs'][0]['code'] == 'T-Ç1', 'P: rig Tür planlarım sistemine eklendi')
        check('Sistemimden çıkar' in await pg.inner_text('#sheet'), 'P: eklenince “Sistemimden çıkar” görünüyor')
        await pg.click('#sheet button[data-open="turler"]'); await pg.wait_for_timeout(250)
        check('İstavrit' in await pg.inner_text('#sheet') and 'Eksik' in await pg.inner_text('#sheet'), 'P: hedef türlerim listesinde istavrit (eksik)')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        await pg.click('#moreMenu button[data-open="alisveris"]'); await pg.wait_for_timeout(300)
        sh = await pg.inner_text('#sheet'); check(U('İstavrit için') in U(sh) and 'Çapari takımı' in sh, 'P: alışveriş listesinde “İstavrit için” grubu')
        await pg.screenshot(path=SHOTS + '/p_alisveris.png', full_page=True); await pg.click('#sheet [data-close]')
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check('Tür planlarım' in await pg.inner_text('#sysBar') and await pg.locator('#rigList article.rig.off').count() == 1, 'P: Rigler’de Tür planlarım, rig tamamlanmadı')
        # envanteri tamamla: kamış, makine, çapari, klipsli fırdöndü, kurşun, örgü ip
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.click('button[data-iseg="gear"]'); await pg.wait_for_timeout(150)
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.fill('#it-brand', 'Okuma'); await pg.fill('#it-model', 'Tekne 270'); await pg.select_option('#it-rodt', 'tekne'); await pg.fill('#it-rodl', '2,70'); await pg.fill('#it-rodm', '100'); await pg.click('#itSave'); await pg.wait_for_timeout(250)
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.select_option('#it-cat', 'reel'); await pg.fill('#it-brand', 'Daiwa'); await pg.fill('#it-model', 'BG 4000'); await pg.fill('#it-reels', '4000'); await pg.click('#itSave'); await pg.wait_for_timeout(250)
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.select_option('#it-cat', 'braid'); await pg.fill('#it-brand', 'Daiwa'); await pg.fill('#it-model', 'J-Braid x8'); await pg.fill('#it-spec', '0,20 mm'); await pg.click('#itSave'); await pg.wait_for_timeout(250)
        await pg.click('button[data-iseg="jig"]'); await pg.wait_for_timeout(150); await pg.click('#invList button[data-cyc="std:j:capari-takimi|#10"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-iseg="terminal"]'); await pg.wait_for_timeout(150)
        await pg.click('#invList button[data-stk="std:t:klipsfirdondu|-"][data-st="var"]'); await pg.wait_for_timeout(150); await pg.click('#invList button[data-cyc="std:t:k-armut|50 g"]'); await pg.wait_for_timeout(250)
        rd = await pg.evaluate('() => { const p = ALYSSA_QA.planFor({id: "istavrit", name: "İstavrit"}); return {miss: ALYSSA_QA.missingOf(p.rg).map(s => s.label), ready: ALYSSA_QA.ready(p.rg)}; }')
        check(rd['ready'] and not rd['miss'], 'P: envanter tamamlanınca istavrit takımı tam: ' + json.dumps(rd, ensure_ascii=False))
        sl = await pg.evaluate('ALYSSA_QA.shoppingList().filter(n => n.why.some(w => w.indexOf("tur:") === 0)).length'); check(sl == 0, 'P: “İstavrit için” kalemleri alınınca listeden düştü')
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig.off').count() == 0, 'P: tür planı rigi hazır')
        # 2,70 m 100 g kamış: çapariye uyar, dip hırsızlıya (H) uymaz
        gr = await pg.evaluate('() => { const P = ALYSSA_QA.planFor; const a = P({id: "karagoz", name: "Karagöz"}); return ALYSSA_QA.missingOf(a.rg).map(s => s.label); }')
        check('Kamış' in gr, 'P: 100 g kamış dip rigine yetmiyor (karagöz planında kamış eksik)')
        # listede olmayan tür: benzerini seç
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="turler"]'); await pg.wait_for_timeout(250)
        await pg.fill('#tr-q', 'Gümüşbalığı'); await pg.wait_for_timeout(200)
        await pg.click('#trRes button[data-trcustom]'); await pg.wait_for_timeout(250)
        check('hangi türe benziyor' in await pg.inner_text('#sheet'), 'P: listede olmayan tür için benzer tür sorusu')
        await pg.click('#sheet button[data-trlike="istavrit"]'); await pg.wait_for_timeout(350)
        st = await state(pg); cu = [t for t in st['targets'] if t['id'].startswith('c:')]
        check(cu and cu[0]['like'] == 'istavrit' and cu[0]['name'] == 'Gümüşbalığı' and 'Gümüşbalığı' in await pg.inner_text('#sheetTitle'), 'P: özel tür benzerinin kurallarıyla eklendi')
        await pg.screenshot(path=SHOTS + '/p_ozel_tur.png')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150); await overflow(pg, 'P %d px tür planı' % w)
            await pg.click('#sheet button[data-open="turler"]'); await pg.wait_for_timeout(200); await overflow(pg, 'P %d px Türlerim' % w)
            await pg.click('#sheet button[data-tur="istavrit"]'); await pg.wait_for_timeout(250)
        await pg.screenshot(path=SHOTS + '/p_plan_320.png'); await pg.set_viewport_size({'width': 390, 'height': 860})
        # kıyı modu ve LRF takımı: elindeki takıma uyan teknik öne çıkar
        await pg.click('#sheet button[data-open="turler"]'); await pg.wait_for_timeout(200); await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(150)
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.click('button[data-iseg="gear"]'); await pg.wait_for_timeout(200)
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.fill('#it-brand', 'Major Craft'); await pg.fill('#it-model', 'LRF 7'); await pg.select_option('#it-rodt', 'lrf'); await pg.fill('#it-rodm', '7'); await pg.click('#itSave'); await pg.wait_for_timeout(250)
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.select_option('#it-cat', 'reel'); await pg.fill('#it-brand', 'Shimano'); await pg.fill('#it-model', 'Sahara 2000'); await pg.fill('#it-reels', '2000'); await pg.click('#itSave'); await pg.wait_for_timeout(250)
        await pg.evaluate("() => { ALYSSA_QA.state().mode = 'kiyi'; }")
        tf = await pg.evaluate('() => ALYSSA_QA.techsFor(ALYSSA_QA.planFor({id: "istavrit", name: "İstavrit"}).s)')
        check(tf[:2] == ['capari', 'lrf'], 'P: kıyıda çapari ve LRF takımı varken sıra türün tercihine göre: ' + json.dumps(tf))
        tf = await pg.evaluate('() => { const S = ALYSSA_QA.state(); const ok = Object.values(ALYSSA_QA.items()).find(i => i.name === "Okuma Tekne 270"); S.inv.status[ok.id + "|-"] = "yok"; const r = ALYSSA_QA.techsFor(ALYSSA_QA.planFor({id: "istavrit", name: "İstavrit"}).s); S.inv.status[ok.id + "|-"] = "var"; return r; }')
        check(tf[0] == 'lrf', 'P: çapari kamışı yokken elindeki LRF takımı öne çıktı: ' + json.dumps(tf))
        await pg.evaluate("() => { ALYSSA_QA.state().mode = 'tekne'; }")
        # hayaldeki slow jig kamışı: sistem kurulur ama rig eksik kalır
        await pg.click('#addItem'); await pg.wait_for_timeout(200)
        await pg.fill('#it-brand', 'Shimano'); await pg.fill('#it-model', 'Ocea Jigger Slow'); await pg.select_option('#it-rodt', 'slowjig'); await pg.fill('#it-rodm', '250'); await pg.click('#it-st button[data-itst="alinacak"]'); await pg.click('#itSave'); await pg.wait_for_timeout(300)
        ans = {'mode': 'tekne', 'region': 'ege', 'techs': ['jig'], 'species': ['fangri'], 'baits': [], 'lay': {'jig': ['slowjig']}, 'klass': 'porsiyon', 'time': 'gunduz', 'bottoms': [], 'size': 'sade', 'rodMax': '', 'name': 'Hayal'}
        dr = await pg.evaluate('(a) => { const r = ALYSSA_QA.resolveRig(Object.assign({sys: "x"}, ALYSSA_QA.genSystem(a)[0])); const k = r.slots.find(s => s.kind === "rod"); return {item: k.t.envanter.item && ALYSSA_QA.items()[k.t.envanter.item].name, st: k.t.envanter.item && ALYSSA_QA.stockOf(k.t.envanter.item, "-"), ready: ALYSSA_QA.ready(r)}; }', ans)
        check(dr['item'] == 'Shimano Ocea Jigger Slow' and dr['st'] == 'alinacak' and not dr['ready'], 'P: hayaldeki slow jig kamışı rige bağlandı, rig eksik: ' + json.dumps(dr, ensure_ascii=False))
        check(any('Ocea Jigger' in (ALN or '') for ALN in await pg.evaluate('ALYSSA_QA.shoppingList().map(n => n.item ? ALYSSA_QA.items()[n.item].name : n.name)')), 'P: hayaldeki kamış alışveriş listesinde')
        # Rig Atölyesi: tür arama tekniği de ekler
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.click('#sysBar button[data-act="wizard"]'); await pg.wait_for_timeout(250)
        await pg.click('button[data-wzm="tekne"]'); await pg.click('button[data-wz="next"]'); await pg.click('button[data-wzt="dip"]'); await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(200)
        await pg.fill('#wz-spq', 'istavrit'); await pg.wait_for_timeout(200); await pg.click('#wzSpRes button[data-wzsadd="istavrit"]'); await pg.wait_for_timeout(250)
        st = await pg.evaluate('() => null')
        wz = await pg.evaluate("() => { const t = [...document.querySelectorAll('#sheet button[data-wzs]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.wzs); return t; }")
        check('istavrit' in wz, 'P: sihirbazda aramadan istavrit seçildi')
        await pg.click('button[data-wz="back"]'); await pg.wait_for_timeout(150)
        check(await pg.get_attribute('button[data-wzt="capari"]', 'aria-pressed') == 'true', 'P: istavrit için çapari tekniği eklendi')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        print('P1 errors:', errs); check(not errs, 'P: sayfa hatası yok (yeni kullanıcı)')
        await ctx.close()
        # Kenny: paketteki kamış ve makine tür planında kullanılıyor; sistemindeki türler listede
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig').count() == 32, 'P: Kenny 32 rig (özel paket gereksinim kontrolüne girmiyor)')
        n_ready = await pg.locator('#rigList article.rig:not(.off)').count(); check(n_ready >= 1, 'P: paket riglerinin hazır olanları değişmedi (%d)' % n_ready)
        await pg.click('#sysBar button[data-open="turler"]'); await pg.wait_for_timeout(300)
        sh = await pg.inner_text('#sheet'); check('Karagöz' in sh and 'Mercan' in sh, 'P: rig sistemindeki türler listede')
        await pg.click('#sheet button[data-tur="karagoz"]'); await pg.wait_for_timeout(350)
        RIG_KG = [r['name'] for r in json.load(open(ROOT + '/data/kenny_av_db.json', encoding='utf-8'))['rigs'] if 'karagoz' in (r.get('species') or [])][:1]   # özel veriden okunur, depoda düz yazılmaz
        sh = await pg.inner_text('#sheet'); check('Sistemindeki takım' in sh and RIG_KG and RIG_KG[0] in sh, 'P: karagöz planında Kenny’nin rigleri')
        kp = await pg.evaluate('() => { const p = ALYSSA_QA.planFor({id: "istavrit", name: "İstavrit"}); const g = k => { const s = p.rg.slots.find(x => x.kind === k); const it = s.t.envanter.item && ALYSSA_QA.items()[s.t.envanter.item]; return it ? [it.name, ALYSSA_QA.stockOf(it.id, "-")] : null; }; return {tech: p.tech, rod: g("rod"), reel: g("reel"), info: ALYSSA_QA.rodInfo(ALYSSA_QA.items()["%s"] || {name: ""})}; }' % 'x')
        check(kp['tech'] == 'capari' and kp['rod'] and kp['rod'][1] == 'var' and kp['reel'] and kp['reel'][1] == 'var', 'P: Kenny’nin kamış ve makinesi istavrit planında: ' + json.dumps(kp, ensure_ascii=False)[:200])
        await pg.screenshot(path=SHOTS + '/p_kenny_karagoz.png', full_page=True)
        print('P2 errors:', errs); check(not errs, 'P: sayfa hatası yok (Kenny)')
        await ctx.close()

        # ================================================== E) önizleme
        ctx = await b.new_context(viewport={'width': 390, 'height': 860}, timezone_id='Europe/Istanbul', device_scale_factor=2)
        await ctx.add_init_script(FAKE_NOW)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        await pg.goto(BASE + '/preview.html'); await pg.wait_for_timeout(1500)
        check(not await pg.is_visible('#welcome'), 'önizleme: karşılama yok')
        check(await pg.locator('#hTable tr').count() >= 15, 'önizleme: saatlik tablo')
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig').count() == 32, 'önizleme: 32 rig')
        await pg.screenshot(path=SHOTS + '/e_preview.png')
        print('E errors:', errs); check(not errs, 'E: sayfa hatası yok')
        await ctx.close(); await b.close()
    print('\nGitHub istekleri:', len(GH_LOG), '· Open-Meteo istekleri:', len(calls))
    print('SONUÇ:', 'HEPSİ GEÇTİ' if not FAIL else '%d HATA: %s' % (len(FAIL), FAIL))

try:
    asyncio.run(main())
finally:
    srv.terminate()
