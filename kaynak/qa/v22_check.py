"""Alyssa v0.3–v0.22 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
Çalıştır: python3 /home/claude/fishapp/qa/v22_check.py
"""
import os, sys
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import fbmock   # sahte Firebase

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_t'
SHOTS = ROOT + '/qa/v22'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(ROOT + '/app/dist', WWW + '/dist')
prev = open(ROOT + '/app/preview/alyssa_onizleme.html', encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8789
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
KIYI = lambda lat, lon: 38.60 < lat < 38.62 and 26.90 < lon < 26.92   # karada ama kıyı çizgisine 150 m (kıyıdan av)
LAND2 = lambda lat, lon: 38.36 < lat < 38.37 and 26.87 < lon < 26.88  # Kenny'nin ekran görüntüsü: karada, Overpass yanıt vermiyor, EMODnet 13 m diyor
TRAP = lambda lat, lon: 38.30 < lat < 38.32 and 26.70 < lon < 26.72   # denizde ama Nominatim yakın bir adres veriyor, derinlik servisi hata veriyor (eski sürüm "Kara" derdi)
HANG = {'gfs': False}
CORS = {'Access-Control-Allow-Origin': '*'}

async def mock_meteo(route):
    u = route.request.url; q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
    calls.append(u)
    lat, lon = float(q['latitude'][0]), float(q['longitude'][0])
    model = (q.get('models') or [''])[0]
    if '/v1/elevation' in u:   # Copernicus 90 m yükselti: denizde 0
        el = 45 if LAND(lat, lon) else 38 if LAND2(lat, lon) else 4 if KIYI(lat, lon) else 0
        return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'elevation': [el]}))
    if 'marine' in u:
        hv = q.get('hourly', [''])[0].split(',')
        if LAND(lat, lon) or KIYI(lat, lon) or LAND2(lat, lon):
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
        if TRAP(lat, lon):
            return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'lat': str(lat + 0.001), 'lon': str(lon), 'name': '', 'address': {'suburb': 'Tuzak Mahallesi', 'province': 'İzmir'}}))
        if KIYI(lat, lon):
            return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'lat': str(lat), 'lon': str(lon), 'name': '', 'address': {'village': 'Kıyıköy', 'province': 'İzmir'}}))
        if LAND2(lat, lon):
            return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'lat': str(lat + 0.0003), 'lon': str(lon), 'name': '', 'address': {'suburb': 'Çelebi', 'province': 'İzmir'}}))
        return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'error': 'Unable to geocode'}))
    if 'overpass' in u:
        body = urllib.parse.unquote_plus(route.request.post_data or '')
        mm = re.search(r'around:6000,([-\d.]+),([-\d.]+)', body); lat, lon = float(mm.group(1)), float(mm.group(2))
        if TRAP(lat, lon): await asyncio.sleep(2.5)   # yavaş Overpass: ad ve diğer bilgiler önce gelmeli
        if LAND2(lat, lon): return await route.fulfill(status=504, headers=CORS, body='{}')   # Overpass yanıt vermedi
        cy = lat - 0.02 if LAND(lat, lon) else lat - 0.00135 if KIYI(lat, lon) else lat + 0.02   # OSM kıyı çizgisi batıdan doğuya: kara solda (kuzey), deniz sağda (güney)
        els = [{'type': 'way', 'id': 1, 'tags': {'natural': 'coastline'}, 'geometry': [{'lat': cy, 'lon': lon - 0.05}, {'lat': cy, 'lon': lon + 0.05}]},
               {'type': 'node', 'id': 2, 'lat': lat + 0.03, 'lon': lon, 'tags': {'place': 'village', 'name': 'Deneme'}},
               {'type': 'node', 'id': 3, 'lat': lat + 0.09, 'lon': lon, 'tags': {'place': 'town', 'name': 'Uzakkasaba'}}]
        return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'elements': els}))
    if 'emodnet-bathymetry.eu/depth_sample' in u:
        g = urllib.parse.unquote(urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['geom'][0]); mm = re.search(r'POINT\(([-\d.]+) ([-\d.]+)\)', g)
        lon, lat = float(mm.group(1)), float(mm.group(2))
        if LAND(lat, lon): return await route.fulfill(status=404, headers=CORS, body='{}')
        if TRAP(lat, lon): return await route.fulfill(status=503, headers=CORS, body='{}')
        if KIYI(lat, lon): return await route.fulfill(status=404, headers=CORS, body='{}')
        if LAND2(lat, lon): return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'min': 12.1, 'max': 14.0, 'avg': 13.1, 'smoothed': 13.0}))   # karada yanlış derinlik
        return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'min': 53.1, 'max': 55.2, 'avg': 54.3, 'smoothed': 54.0}))
    return await route.fulfill(status=404, headers=CORS, body='{}')

# ---- sahte EUSeaMap (EMODnet Seabed Habitats WMS): GetFeatureInfo noktaya göre, diğerleri resim
HAB_LOG = []
HAB_FAIL = lambda lat, lon: 38.27 < lat < 38.28 and 26.62 < lon < 26.63   # servis yanıt vermiyor (CORS/bağlantı)
async def mock_hab(route):
    u = route.request.url; HAB_LOG.append(u)
    if 'GetFeatureInfo' not in u:
        return await route.fulfill(status=200, content_type='image/png', body=PNG1, headers=CORS)
    q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
    x0, y0, x1, y1 = [float(v) for v in q['bbox'][0].split(',')]; lat, lon = (y0 + y1) / 2, (x0 + x1) / 2
    if HAB_FAIL(lat, lon): return await route.abort()
    feats = []
    if LAND(lat, lon) or LAND2(lat, lon) or KIYI(lat, lon): feats = []
    elif 38.24 < lat < 38.26 and 26.64 < lon < 26.66:
        feats = [{'type': 'Feature', 'properties': {'eunis2019c': 'MB252', 'eunis2019d': 'Posidonia oceanica meadows', 'biozone': 'Infralittoral', 'substrate': 'Seabed'}}]
    elif 38.21 < lat < 38.22 and 26.60 < lon < 26.62:
        feats = [{'type': 'Feature', 'properties': {'eunis2019c': 'MC15', 'eunis2019d': 'Circalittoral rock', 'biozone': 'Circalittoral', 'substrate': 'Rock or other hard substrata'}}]
    else:
        feats = [{'type': 'Feature', 'properties': {'eunis2019c': 'MB52', 'eunis2019d': 'Mediterranean infralittoral sand', 'biozone': 'Infralittoral', 'substrate': 'Sand', 'energy': 'Low energy'}}]
    return await route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({'type': 'FeatureCollection', 'features': feats}))

# ---- sahte Claude API (Usta'ya sor)
CLAUDE_LOG = []
async def mock_claude(route):
    req = route.request
    hdr = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-api-key,authorization,anthropic-version,anthropic-dangerous-direct-browser-access,anthropic-workspace-id', 'Access-Control-Allow-Methods': 'POST,OPTIONS'}
    if req.method == 'OPTIONS': return await route.fulfill(status=204, headers=hdr)
    body = json.loads(req.post_data or '{}'); CLAUDE_LOG.append({'h': dict(req.headers), 'b': body})
    key = req.headers.get('x-api-key')
    if key == 'sk-ant-test-nocredit':
        return await route.fulfill(status=400, headers=hdr, content_type='application/json', body=json.dumps({'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'}}))
    if key == 'sk-ant-test-noeffort' and 'output_config' in body:
        return await route.fulfill(status=400, headers=hdr, content_type='application/json', body=json.dumps({'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'output_config: Extra inputs are not permitted'}}))
    if key not in ('sk-ant-test-good', 'sk-ant-test-noeffort'):
        return await route.fulfill(status=401, headers=hdr, content_type='application/json', body=json.dumps({'type': 'error', 'error': {'type': 'authentication_error', 'message': 'invalid x-api-key'}}))
    n = len([m for m in body.get('messages', []) if m['role'] == 'user'])
    txt = '**Önce en üstteki rigi bağla.**\n- Kurşun: kartta yazan kadar\n- Köstek: 0,40 mm\nGüvenlik: deniz D ise çıkma.' if n == 1 else 'İkinci cevap: akşam penceresini bekle.'
    return await route.fulfill(status=200, headers=hdr, content_type='application/json', body=json.dumps({'id': 'msg_test', 'type': 'message', 'role': 'assistant', 'model': body.get('model'),
        'content': [{'type': 'thinking', 'thinking': 'GİZLİ DÜŞÜNCE', 'signature': 'x'}, {'type': 'text', 'text': txt}], 'stop_reason': 'end_turn', 'usage': {'input_tokens': 3200, 'output_tokens': 420}}))

async def new_ctx(b, storage=None, w=390):
    ctx = await b.new_context(viewport={'width': w, 'height': 860}, timezone_id='Europe/Istanbul', device_scale_factor=2, permissions=['geolocation'], geolocation={'latitude': 38.30, 'longitude': 26.80})
    await ctx.add_init_script(FAKE_NOW)
    if storage:
        await ctx.add_init_script('if(!sessionStorage.getItem("seeded")){' + ''.join('localStorage.setItem(%s,%s);' % (json.dumps(k), json.dumps(v)) for k, v in storage.items()) + 'sessionStorage.setItem("seeded","1");}')
    await ctx.route('https://api.open-meteo.com/**', mock_meteo); await ctx.route('https://marine-api.open-meteo.com/**', mock_meteo)
    await ctx.route('https://api.github.com/**', mock_gh)
    await fbmock.install(ctx)
    for pat in ['https://tile.openstreetmap.org/**', 'https://server.arcgisonline.com/**', 'https://tiles.openseamap.org/**', 'https://ows.emodnet-bathymetry.eu/**', 'https://drive.emodnet-geology.eu/**']:
        await ctx.route(pat, mock_tiles)
    for pat in ['https://nominatim.openstreetmap.org/**', 'https://overpass-api.de/**', 'https://overpass.kumi.systems/**', 'https://rest.emodnet-bathymetry.eu/**']:
        await ctx.route(pat, mock_geo)
    await ctx.route('https://wa.me/**', lambda route: route.fulfill(status=200, content_type='text/html', body='<p>wa</p>'))
    await ctx.route('https://ows.emodnet-seabedhabitats.eu/**', mock_hab); await ctx.route('https://api.anthropic.com/**', mock_claude)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'fonts' not in m.text and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
    return ctx, pg, errs

def fake_now(iso):
    return FAKE_NOW.replace("2026-10-17T09:30:00+03:00", iso)

async def new_ctx_at(b, iso, w=390):
    ctx = await b.new_context(viewport={'width': w, 'height': 860}, timezone_id='Europe/Istanbul', device_scale_factor=2, permissions=['geolocation'], geolocation={'latitude': 38.30, 'longitude': 26.80})
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
        cell = pg.locator('#hTable tr').nth(await row_idx(pg, 'Rüzgâr · Karma')).locator('td').nth(3)
        bg = await cell.evaluate('e => getComputedStyle(e).backgroundColor'); txt = (await cell.inner_text()).split('\n')[0]
        pal = ['#86D9A6', '#2DB46C', '#93C83E', '#E8D61E', '#F6B40C', '#F18A1B', '#E5531D', '#D0231F', '#9E1530', '#681E74', '#1F4EB4', '#173A87', '#0D2256']
        exp = pal[int(re.match(r'\d+', txt).group(0))]; r, g, bb = int(exp[1:3], 16), int(exp[3:5], 16), int(exp[5:7], 16)
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
        check(await pg.locator('#moreMenu .mrow').count() == 18, 'Daha menüsü 18 satır (Hesap ve Tür takvimi dahil)')
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
        # konum: kıyıdaki nokta (kara, kıyıya 150 m) → en yakın deniz noktasının verisi, kıyı modu
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(200)
        await pg.fill('#nl-name', 'Kıyı noktası'); await pg.fill('#nl-lat', '38.61'); await pg.fill('#nl-lon', '26.91')
        await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(4000)
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(300)
        sea = await pg.inner_text('#seaNote') if await pg.is_visible('#seaNote') else ''
        check('km' in sea, 'kıyıdaki nokta: ' + sea)
        wave = (await pg.locator('#hTable tr').nth(await row_idx(pg, 'Dalga')).locator('td').nth(2).inner_text()).strip()
        check(wave not in ('–', ''), 'kıyıdaki noktada dalga değeri geldi: ' + wave)
        st = await state(pg); L = st['locations'][st['active']]
        check(L.get('sea') and abs(L['sea']['lat'] - 38.628) < 0.01, 'deniz noktası kaydedildi: ' + json.dumps(L.get('sea')))
        check(L.get('kind') == 'kiyi' and L.get('facing') == '180' and 'Kıyı' in await pg.evaluate("document.getElementById('modeBtn').textContent"), 'kıyı türü bulundu, kıyının bakışı G, kıyı modu: ' + json.dumps({k: L.get(k) for k in ('kind', 'kindBy', 'coastKm', 'facing')}))
        net = await pg.inner_text('#net'); check(net.startswith('Güncel'), 'durum kıyıdaki noktada da Güncel: ' + net)
        await pg.screenshot(path=SHOTS + '/a_kiyi_nokta.png')
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
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
        labels = await pg.evaluate("""() => [...document.querySelectorAll('#solWins .win .t small')].map(e => e.textContent)""")
        check(labels and all(l in ('Sabah', 'Gündüz', 'Akşam', 'Gece') for l in labels), 'G: Bugün pencereleri adlı: ' + str(labels))
        recw = await pg.locator('#recList .meta.why').all_inner_texts()
        check(any('En iyi pencere' in x for x in recw), 'G: önerilerde en iyi pencere yazıyor')
        # sürüklenme paneli ve demirli seçimi
        dtxt = await pg.inner_text('#driftPanel')
        check('sürüklenir' in dtxt and 'tarafından başla' in dtxt and 'kurşun' in dtxt and len(re.findall(r'\d\d:\d\d–\d\d:\d\d', dtxt)) >= 3, 'G: sürüklenme paneli (3 saatlik dilimler): ' + dtxt.replace('\n', ' ')[:200])
        await pg.locator('#driftPanel').screenshot(path=SHOTS + '/g_surukle.png')
        lbls = await pg.locator('#hTable th.lbl b').all_text_contents(); check('Sürüklenme' in lbls, 'G: tabloda sürüklenme satırı')
        await pg.click('#driftPanel button[data-set="anchor"][data-val="demir"]'); await pg.wait_for_timeout(300)
        st = await state(pg); check(st['settings']['anchor'] == 'demir', 'G: demirli seçimi kaydedildi')
        lbls = await pg.locator('#hTable th.lbl b').all_text_contents(); dtxt2 = await pg.inner_text('#driftPanel')
        check('İpe akış' in lbls and 'Demirli' in dtxt2 and 'tarafından başla' not in dtxt2, 'G: demirliyken ipe akış, başlangıç önerisi yok')
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
        await pg.wait_for_timeout(200); await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(300); await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(200)
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
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
        check(await pg.get_attribute('#fParts button[data-fpart="gece"]', 'aria-pressed') == 'true' and 'Gece' in await pg.inner_text('#recHead'), 'H: akşam Fishing geceyi açıyor: ' + await pg.inner_text('#recHead'))
        sw = await pg.inner_text('#solWins'); print('   pencereler 21:40:', sw.replace('\n', ' ')[:200])
        check(sw.strip() != '', 'H: gece penceresi paneli boş değil')
        await pg.click('#fParts button[data-fpart="gun"]'); await pg.wait_for_timeout(300)
        check('Bugünün gündüzü bitti' in await pg.inner_text('#fSum'), 'H: geçmiş gündüz uyarısı')
        await pg.click('#fSum button[data-fday]'); await pg.wait_for_timeout(300)
        check(await pg.get_attribute('#fDays .dchip:nth-child(2)', 'aria-pressed') == 'true' and 'Gündüz' in await pg.inner_text('#recHead'), 'H: “Yarın sabah” ile yarının gündüzü')
        await pg.screenshot(path=SHOTS + '/h_aksam.png', full_page=True)
        print('H errors:', errs); check(not errs, 'H: sayfa hatası yok')
        await ctx.close()

        # ================================================== I) v0.6: Windy düzeni, model seçici, birimler, yerel rüzgâr adları, kişiselleştirme
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        lbl = lambda: pg.evaluate("""() => [...document.querySelectorAll('#hTable th.lbl')].map(th => th.querySelector('b').textContent + '|' + (th.querySelector('small') ? th.querySelector('small').textContent : ''))""")
        L0 = await lbl(); print('   satırlar:', [x.split('|')[0] for x in L0])
        check(any(x.startswith('Güneş · Ay') for x in L0) and any(x.startswith('Balık eğrisi') for x in L0) and not any(x.startswith('Model uyumu') for x in L0), 'I: satırlar (güneş/ay, balık eğrisi; model uyumu varsayılan kapalı)')
        check(not any(x.startswith('Rüzgâr|') for x in L0) and any(x.startswith('Hamle|') and 'GFS' in x for x in L0), 'I: varsayılan: model karşılaştırma satırları kapalı, Hamle (GFS) açık')
        check('☀↑' in await pg.inner_text('#hTable'), 'I: gün doğumu tabloda')
        check(await pg.locator('#hTable td.agree .dot').count() == 0, 'I: model uyumu varsayılan kapalı')
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
        check(st['settings']['model'] == 'gfs' and any(x.startswith('Rüzgâr · Seçili|') and 'GFS' in x and 'ICON' not in x for x in L1[:12]), 'I: GFS modeli seçildi: ' + str([x for x in L1 if x.startswith('Rüzgâr')][:1]))
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
        await pg.click('#sheet button[data-rowmv="hrows|dalga|-1"]'); await pg.wait_for_timeout(250)   # önce kapalı "Model uyumu"nun, sonra "Rüzgâr Yönü"nün üstüne
        L3 = await lbl(); check(idx(L3, 'Dalga|') == d0 - 1, 'I: dalga satırı bir üste taşındı')
        await pg.click('#sheet button[data-set="windUnit"][data-val="kn"]'); await pg.wait_for_timeout(250)
        wcell = await pg.evaluate("""() => { const r = [...document.querySelectorAll('#hTable tr')].find(tr => tr.querySelector('th b').textContent.startsWith('Rüzgâr')); return r.querySelectorAll('td')[9].innerText; }""")
        check('Bft' in wcell and 'kn' in wcell.split('\n')[0] and int(re.match(r'\d+', wcell).group(0)) > 12, 'I: rüzgâr kn biriminde: ' + wcell.replace('\n', ' '))
        await pg.click('#sheet button[data-set="pressUnit"][data-val="mmhg"]'); await pg.wait_for_timeout(250)
        pv = await pg.evaluate("""() => { const r = [...document.querySelectorAll('#hTable tr')].find(tr => tr.querySelector('th b').textContent === 'Basınç' && tr.querySelectorAll('td').length > 2); return r.querySelectorAll('td')[9].innerText.split('\\n')[0]; }""")
        check(740 < int(pv) < 780, 'I: basınç mmHg: ' + pv)
        await pg.click('#sheet button[data-set="windNames"][data-val="harf"]'); await pg.wait_for_timeout(250)
        names2 = await pg.evaluate("""() => [...document.querySelectorAll('#hTable td.wd small')].map(e => e.textContent)""")
        check(names2 and all(n in ('K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB') for n in names2), 'I: harfle yön adları')
        await pg.click('#sheet input[data-rowtog="cards|anlik"]'); await pg.wait_for_timeout(200)
        await pg.click('#sheet button[data-rowmv="cards|anlik|-1"]'); await pg.wait_for_timeout(250)
        await pg.click('#sheet input[data-rowtog="calrows|guven"]'); await pg.wait_for_timeout(200)
        st = await state(pg); print('   ayarlar:', json.dumps({k: st['settings'][k] for k in ('windUnit', 'pressUnit', 'windNames', 'cards')}, ensure_ascii=False))
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(250)
        order = await pg.evaluate("""() => [...document.querySelectorAll('#todayCards > .tcard')].map(e => e.dataset.card + (e.hidden ? '-' : ''))""")
        check(order == ['anlik-', 'saatlik'], 'I: Bugün kartları sırası ve gizleme: ' + str(order))
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
        st = await state(pg); lbls = await pg.locator('#hTable th.lbl b').all_text_contents()
        check(st['mode'] == 'kiyi' and await pg.inner_text('#todayTitle') == 'Bugün kıyıda' and 'Kıyı' in await pg.evaluate("document.getElementById('modeBtn').textContent"), 'K: kıyı moduna geçildi')
        check('Kıyıya göre' in lbls and 'Sürüklenme' not in lbls, 'K: tabloda kıyıya göre satırı, sürüklenme yok')
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
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
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(400)
        recs = await pg.locator('#recList article.rig').all_inner_texts(); print('   kıyı önerileri:', [r.split('\n')[0:2] for r in recs])
        check(recs and all('surf' in r.lower() and r.startswith('K') for r in recs), 'K: Bugün bağla kıyı riglerini öneriyor (%d)' % len(recs))
        check(any('kurşun' in r for r in recs), 'K: kıyı rig kartında kurşun')
        await pg.screenshot(path=SHOTS + '/k_kiyi_oneri.png', full_page=True)
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(200)
            for v in ['bugun', 'takvim']:
                await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(150); await overflow(pg, 'K %d px %s' % (w, v))
        await pg.click('#modeBtn'); await pg.wait_for_timeout(400)
        lbls = await pg.locator('#hTable th.lbl b').all_text_contents(); st = await state(pg)
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
        nmatch = await pg.locator('#sheet .item.aslot').count(); check(nmatch >= 2, 'L: kurala uyan pencereler (%d)' % nmatch)
        await pg.screenshot(path=SHOTS + '/l_uyari.png')
        async with pg.expect_download() as dl_info:
            await pg.click('#sheet button[data-act="icsAll"]')
        dl = await dl_info.value; ics = open(await dl.path(), encoding='utf-8', newline='').read()
        check(dl.suggested_filename.endswith('.ics') and ics.count('UID:av-') == nmatch and 'BEGIN:VALARM' in ics and 'TRIGGER:-PT120M' in ics and ics.startswith('BEGIN:VCALENDAR'), 'L: takvim dosyası (%d pencere, alarm 2 sa önce)' % ics.count('UID:av-'))
        check(all(len(l.encode()) <= 75 for l in ics.split('\r\n')), 'L: .ics satırları 75 baytı aşmıyor')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # çıkış listesi
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.click('.rechead button[data-open="liste"]'); await pg.wait_for_timeout(300)
        ck = await pg.inner_text('#sheet'); check('Bugün · Gündüz rigleri' in ck and 'Can yelekleri' in ck and 'Kurşun' in ck, 'L: çıkış listesi seçili gün ve bölümün rigleri, kurşun ve güvenlik')
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
        check(await pg.locator('button[data-tier="dunya"]').count() == 0, 'F: Rig Atölyesi sisteminde “Dünyanın en iyisi” seviyesi yok')
        await pg.click('button[data-tier="turkiye"]'); await pg.wait_for_timeout(200)
        t1 = await pg.locator('#rigList article.rig').first.inner_text(); check(any(b in t1 for b in ('BKK', 'Owner', 'Mustad', 'Seaguar', 'Daiwa')), 'F: Türkiye seviyesinde ürün önerisi')
        allt = await pg.evaluate("document.getElementById('rigList').textContent")
        check('Dünyanın en iyisi' not in allt, 'F: notlarda dünyanın en iyisi yok')
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
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.click('#sysTools button[data-systool="edit"]'); await pg.wait_for_timeout(300)
        for _ in range(5): await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(120)
        await pg.click('button[data-wzz="sade"]'); await pg.wait_for_timeout(150)
        await pg.click('button[data-wz="done"]'); await pg.wait_for_timeout(500)
        st = await state(pg); sy = [v for v in st['systems'].values() if v['source'] == 'sihirbaz']
        check(len(sy) == 1 and len(sy[0]['rigs']) == 3, 'F: sade sistemde rig sayısı %d' % len(sy[0]['rigs']))
        await pg.click('#sysTools button[data-systool="toggle"]'); await pg.wait_for_timeout(200)
        check(await pg.locator('#rigList article.rig').count() == 0, 'F: kapatılan sistem listeden çıktı')
        await pg.click('#sysTools button[data-systool="toggle"]'); await pg.wait_for_timeout(200)
        await pg.click('#sysTools button[data-systool="del"]'); await pg.click('#sysTools button[data-systool="del"]'); await pg.wait_for_timeout(200)
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
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.click('.rechead button[data-open="liste"]'); await pg.wait_for_timeout(300)
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

        # ================================================== R) v0.13: hesap (e-posta), buluta taşıma, deneme hesabı, yeni cihaz, çakışma
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        check('Hesabımla giriş yap' in await pg.inner_text('#welcome'), 'R: karşılamada hesapla giriş')
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.wait_for_timeout(200)
        check('Giriş yapılmadı' in await pg.inner_text('#moreMenu'), 'R: Daha menüsünde Hesap: giriş yapılmadı')
        await pg.click('#moreMenu button[data-open="hesap"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SHOTS + '/r_giris.png')
        await pg.fill('#ac-mail', 'kenny@test.com'); await pg.fill('#ac-pass', 'gizli1'); await pg.click('button[data-acc="login"]'); await pg.wait_for_timeout(1500)
        check('E-posta ya da şifre hatalı' in await pg.inner_text('#acErr'), 'R: kayıtsız e-postayla giriş hatası Türkçe')
        await pg.fill('#ac-pass', 'gizli'); await pg.click('button[data-acc="signup"]'); await pg.wait_for_timeout(1500)
        check('en az 6' in await pg.inner_text('#acErr'), 'R: kısa şifre uyarısı')
        await pg.fill('#ac-pass', 'gizli123'); await pg.click('button[data-acc="signup"]'); await pg.wait_for_timeout(3500)
        u1 = fbmock.FB['users']['kenny@test.com']['uid']; d1 = fbmock.doc_json(u1)
        check(d1 and d1['systems'].get('ozel') and d1['pkg']['unlocked'] and not d1.get('wx'), 'R: ilk girişte telefondaki veri hesaba yüklendi (özel sistem dahil)')
        allfs = json.dumps(fbmock.FB['docs'])
        check(KEY['pass_'] not in allfs and 'alyssa-pk' not in allfs and '"rigs":[{"code"' not in allfs, 'R: buluta paket şifresi, anahtarı ve paket rigleri gitmedi')
        check(await pg.evaluate('localStorage.getItem("alyssa-cu")') == u1 and 'kenny@test.com' in await pg.inner_text('#sheet'), 'R: hesap sayfasında e-posta, veri hesaba bağlı')
        await pg.screenshot(path=SHOTS + '/r_hesap.png')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # değişiklik 3 sn içinde buluta
        await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(200)
        await pg.fill('#nl-name', 'Bulut noktası'); await pg.fill('#nl-lat', '38.20'); await pg.fill('#nl-lon', '26.70'); await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(4500)
        d1 = fbmock.doc_json(u1); check(any(l['name'] == 'Bulut noktası' for l in d1['locations'].values()), 'R: yeni konum otomatik buluta yazıldı')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # deneme hesabı: kopyayla başla
        await pg.click('#moreMenu button[data-open="hesap"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-acc="logout"]'); await pg.click('button[data-acc="logout"]'); await pg.wait_for_timeout(1200)
        check(await pg.is_visible('#ac-mail'), 'R: çıkış yapıldı')
        nloc = len((await state(pg))['locations']); check(nloc >= 2, 'R: çıkıştan sonra veri telefonda duruyor')
        await pg.fill('#ac-mail', 'kenny+deneme@test.com'); await pg.fill('#ac-pass', 'deneme123'); await pg.click('button[data-acc="signup"]'); await pg.wait_for_timeout(2500)
        sh = await pg.inner_text('#sheet'); check('Yeni hesap' in sh and 'kopyasıyla' in sh, 'R: yeni hesap için kopya ya da boş sorusu')
        await pg.screenshot(path=SHOTS + '/r_yeni_hesap.png')
        await pg.click('button[data-acc="copy"]'); await pg.wait_for_timeout(2500)
        u2 = fbmock.FB['users']['kenny+deneme@test.com']['uid']; d2 = fbmock.doc_json(u2)
        check(d2 and d2['systems'].get('ozel') and len(d2['locations']) == nloc, 'R: deneme hesabı verinin kopyasıyla başladı')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig').count() == 32, 'R: deneme hesabında 32 rig')
        # denemede dağıt: konumları sil, envanteri değiştir
        await pg.evaluate("() => { const S = ALYSSA_QA.state(); S.locations = {}; S.active = null; S.inv.status['std:t:tfirdondu|-'] = 'var'; }")
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="ayarlar"]'); await pg.click('button[data-set="scheme"][data-val="dark"]'); await pg.wait_for_timeout(4500)
        d2 = fbmock.doc_json(u2); check(d2 and not d2['locations'], 'R: denemedeki silme deneme hesabına yazıldı')
        check(len(fbmock.doc_json(u1)['locations']) == nloc, 'R: asıl hesap denemeden etkilenmedi')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        # asıl hesaba dön
        await pg.click('#moreMenu button[data-open="hesap"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-acc="logout"]'); await pg.click('button[data-acc="logout"]'); await pg.wait_for_timeout(1200)
        await pg.fill('#ac-mail', 'kenny@test.com'); await pg.fill('#ac-pass', 'gizli123'); await pg.click('button[data-acc="login"]'); await pg.wait_for_timeout(3000)
        st = await state(pg); check(len(st['locations']) == nloc and st['inv']['status'].get('std:t:tfirdondu|-') != 'var', 'R: asıl hesaba dönünce kendi verisi geri geldi')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig').count() == 32, 'R: asıl hesapta 32 rig')
        print('R1 errors:', errs); check(not errs, 'R: sayfa hatası yok (hesaplar)')
        await ctx.close()
        # yeni cihaz: hesapla gir → veri gelir, paket şifresi bir kez sorulur
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="hesap"]'); await pg.wait_for_timeout(300)
        await pg.fill('#ac-mail', 'kenny@test.com'); await pg.fill('#ac-pass', 'gizli123'); await pg.click('button[data-acc="login"]'); await pg.wait_for_timeout(3500)
        st = await state(pg); check(len(st['locations']) == nloc and st['systems'].get('ozel'), 'R: yeni cihazda konumlar ve sistem geldi')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(300)
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(300)
        check('şifre' in (await pg.inner_text('#banners')).lower(), 'R: yeni cihazda paket şifresi isteniyor')
        await pg.click('#banners button[data-open="paket"]'); await pg.wait_for_timeout(300)
        await pg.fill('#pk-pass', KEY['pass_']); await pg.click('#pkBtn'); await pg.wait_for_timeout(5000)
        await pg.click('#sheet [data-close]') if await pg.is_visible('#sheet') else None
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#rigList article.rig').count() == 32, 'R: şifreyle yeni cihazda 32 rig')
        # çakışma: bulutta başka cihazdan değişiklik + burada değişiklik
        await pg.evaluate("() => { const C = ALYSSA_QA.cloud(); C.user && (C.dirty = false); }")
        d = fbmock.FB['docs']['users/' + u1]; o = json.loads(d['fields']['s']['stringValue']); o['profile']['name'] = 'Diğer cihaz'
        d['fields']['s']['stringValue'] = json.dumps(o); d['fields']['at'] = {'integerValue': str(int(time.time() * 1000) + 60000)}
        await pg.evaluate("() => { const S = ALYSSA_QA.state(); S.modAt = Date.now() + 30000; localStorage.setItem('alyssa-v1', JSON.stringify(S)); }")
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="hesap"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-acc="sync"]'); await pg.wait_for_timeout(2000)
        sh = await pg.inner_text('#sheet'); st = await state(pg)
        check('Hangi veri kalsın' not in sh and st['profile']['name'] == 'Diğer cihaz', 'R: burada yalnız tarih değişti → soru sorulmadan hesaptaki değişiklik geldi')
        print('   hesap sayfası:', sh.replace('\n', ' | ')[:400], '· önceki hâl:', await pg.evaluate('!!localStorage.getItem("alyssa-cprev")'))
        check('Önceki hâline dön' in sh and 'Bu cihaz' in sh, 'R: Hesap sayfasında cihaz adı ve “Önceki hâline dön”')
        await pg.screenshot(path=SHOTS + '/r_esitleme.png')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150); await overflow(pg, 'R %d px hesap' % w)
        print('R2 errors:', errs); check(not errs, 'R: sayfa hatası yok (yeni cihaz)')
        await ctx.close()

        # ================================================== S) v0.14: küçülen satır adları, kapalı sistem uyarısı
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        cls = await pg.get_attribute('#hScroll', 'class'); w0 = await pg.evaluate('document.querySelector("#hTable th.lbl").getBoundingClientRect().width')
        check('compact' in cls and w0 < 60, 'S: satır adları dar sütunda (%d px)' % w0)
        sh = await pg.evaluate('[...document.querySelectorAll("#hTable th.lbl .sh")].map(e => e.textContent)')
        check('Rüz.BFT KRM' in sh and 'Hml.BFT GFS' in sh and 'Dlg.m' in sh and 'Per.sn' in sh and 'Akın.kn' in sh and 'Sürk.kn' in sh and 'Yön' in sh and 'SaatSaat' not in sh, 'S: kısa adlar: ' + ', '.join(sh))
        hts0 = await pg.evaluate('[...document.querySelectorAll("#hTable tr")].map(r => Math.round(r.getBoundingClientRect().height))')
        await pg.screenshot(path=SHOTS + '/s_kisa.png')
        await pg.click('#hTable tr:nth-child(5) th.lbl'); await pg.wait_for_timeout(200)
        w1 = await pg.evaluate('document.querySelector("#hTable th.lbl").getBoundingClientRect().width')
        check('compact' not in await pg.get_attribute('#hScroll', 'class') and w1 > 90, 'S: ada dokununca tam açıldı (%d px)' % w1)
        await pg.screenshot(path=SHOTS + '/s_tam.png')
        hts1 = await pg.evaluate('[...document.querySelectorAll("#hTable tr")].map(r => Math.round(r.getBoundingClientRect().height))')
        check(hts0 == hts1, 'S: bilgi alanı açılınca satır yükseklikleri değişmedi (zıplama yok)' + ('' if hts0 == hts1 else ' %s → %s' % (hts0, hts1)))
        await pg.wait_for_timeout(500); await pg.evaluate('document.getElementById("hScroll").scrollLeft += 200'); await pg.wait_for_timeout(1500)
        check('compact' not in await pg.get_attribute('#hScroll', 'class'), 'S: kaydırma ve bekleme bilgi alanını kapatmadı')
        await pg.click('#hBar button[data-val="ecmwf"]'); await pg.wait_for_timeout(400)
        check('compact' not in await pg.get_attribute('#hScroll', 'class'), 'S: model seçimi bilgi alanını kapatmadı')
        await pg.click('#hBar button[data-val="karma"]'); await pg.wait_for_timeout(400)
        await pg.click('#hTable tr:nth-child(3) th.lbl'); await pg.wait_for_timeout(200)
        check('compact' in await pg.get_attribute('#hScroll', 'class'), 'S: dokununca yeniden kapandı')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150); await overflow(pg, 'S %d px bugün' % w)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        # kapalı sistem uyarısı
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.click('#sysTools button[data-systool="toggle"]'); await pg.wait_for_timeout(300)
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
        rl = await pg.inner_text('#recList'); check('kapalı' in rl and 'Açık rig sistemin yok' in rl, 'S: Fishing ekranında kapalı sistem uyarısı')
        await pg.click('#recList button[data-systool="toggle"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#recList article.rig').count() >= 1, 'S: “Aç” ile öneriler geri geldi')
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.click('#sysTools button[data-systool="toggle"]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="paket"]'); await pg.wait_for_timeout(300)
        check('Sistem kapalı' in await pg.inner_text('#sheet'), 'S: Özel paket sayfasında kapalı uyarısı')
        await pg.click('#sheet button[data-systool="toggle"]'); await pg.wait_for_timeout(300)
        check('Sistem kapalı' not in await pg.inner_text('#sheet') and len([1 for _ in range(1)]) and await pg.evaluate('ALYSSA_QA.rigs().length') == 32, 'S: “Sistemi aç” ile 32 rig')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        allt = await pg.evaluate("document.getElementById('rigList').textContent")
        check(await pg.locator('#sysTools button[data-tier="dunya"]').count() == 1 and 'Dünyanın en iyisi' not in allt, 'S: 32’lik sistemde dünya seçicide var, notlarda yok')
        await pg.click('#sysTools button[data-tier="dunya"]'); await pg.wait_for_timeout(200)
        check('Dünyanın en iyisi' in await pg.evaluate("document.getElementById('rigList').textContent"), 'S: 32’lik sistemde dünya seviyesi görülebiliyor')
        await pg.click('#sysTools button[data-tier="envanter"]'); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
        check('Dünyanın en iyisi' not in await pg.evaluate("document.getElementById('recList').textContent"), 'S: Fishing kartlarında dünyanın en iyisi yok')
        print('S errors:', errs); check(not errs, 'S: sayfa hatası yok')
        await ctx.close()

        # ================================================== T) v0.15: model satırları, birimler, °C/°F, Karma yedeksiz, kartlar
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        LB = """() => [...document.querySelectorAll('#hTable th.lbl')].map(th => th.querySelector('b').textContent + '|' + (th.querySelector('small') ? th.querySelector('small').textContent : ''))"""
        await pg.click('#hEdit'); await pg.wait_for_timeout(300)
        for rid in ['r_icon', 'r_ecmwf', 'r_gfs', 'h_icon', 'h_ecmwf', 'h_gfs', 'hamle']:
            await pg.click('#sheet input[data-rowtog="hrows|%s"]' % rid); await pg.wait_for_timeout(120)
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        L = await pg.evaluate(LB); W = [x for x in L if (x.startswith('Rüzgâr') and not x.startswith('Rüzgâr Yönü')) or x.startswith('Hamle')]
        print('   rüzgâr satırları:', W)
        check(W == ['Rüzgâr · Karma|Bft ICON-EU', 'Rüzgâr|Bft ICON-EU', 'Rüzgâr|Bft ECMWF', 'Rüzgâr|Bft GFS', 'Hamle|Bft ICON-EU', 'Hamle|Bft ECMWF', 'Hamle|Bft GFS'], 'T: 7 rüzgâr/hamle satırı doğru sırada')
        check('Saat|' in L and 'Güneş · Ay|Doğuş · Batış' in L and 'Hava sıcaklığı|°C' in L and 'Su sıcaklığı|°C' in L, 'T: Saat, Güneş · Ay, sıcaklık alt yazıları')
        check('Rüzgâr Yönü|' in L and 'Akıntı|kn · ok' in L and 'Periyot|sn · ok' in L and 'Sürüklenme|kn' in L and 'Basınç|hPa · 3 sa' in L and any(x.startswith('Basınç|gün içi ') and len(x) <= len('Basınç|gün içi ↓') for x in L), 'T: kısa alt yazılar')
        mbs = await pg.evaluate("[...document.querySelectorAll('#hTable .mb, #nowGrid .mb')].map(e => e.textContent)")
        check('ICON' not in mbs and 'ICON-EU' in mbs, 'T: model adı her yerde ICON-EU')
        cells = await pg.evaluate("[...document.querySelectorAll('#hTable td.bf')].map(td => [td.querySelector('u.wu') ? td.querySelector('u.wu').textContent : '', td.querySelector('small') ? td.querySelector('small').textContent : ''])")
        check(len(cells) > 100 and all(c[0] == 'Bft' and c[1].endswith(' kn') for c in cells), 'T: her rüzgâr/hamle hücresinde birim ve ikinci satır (%d hücre)' % len(cells))
        degs = await pg.evaluate("[...document.querySelectorAll('#hTable td.tc')].map(td => td.querySelector('sup.dg') ? 1 : 0)")
        check(len(degs) > 20 and all(degs), 'T: sıcaklık değerlerinde ° işareti')
        bas = await pg.evaluate("[...document.querySelectorAll('#hTable tr')].find(tr => tr.querySelector('th b').textContent === 'Basınç' && tr.querySelectorAll('td').length > 2).querySelectorAll('td')[8].innerText")
        check(re.search(r'[↑↓→]', bas) is not None, 'T: basınç hücresinde eğilim oku: ' + bas.replace('\n', ' '))
        # Bugün kartları
        ks = await pg.evaluate("[...document.querySelectorAll('#nowGrid .metric')].map(m => m.querySelector('.k').textContent + '|' + m.querySelector('.s').textContent)")
        print('   kartlar:', ks)
        check(len(ks) == 6 and ks[0].startswith('Rüzgâr ICON-EU|') and ' kn ' in ks[0] and ks[1].startswith('Hamle GFS|') and ' kn ' in ks[1] and 'hamle' not in ks[0], 'T: Rüzgâr (ICON-EU) ve Hamle (GFS) ayrı kartlar')
        await pg.screenshot(path=SHOTS + '/t_bugun.png')
        # Karma yedeksiz: ICON'un bittiği gün Karma satırı boş, ECMWF dolu, gün özeti ECMWF ile sürer
        chips = await pg.locator('#dayChips .dchip').count(); found = False
        for i in range(chips):
            await pg.locator('#dayChips .dchip').nth(i).click(); await pg.wait_for_timeout(150)
            r = await pg.evaluate("""() => { const rows = [...document.querySelectorAll('#hTable tr')]; const g = n => rows.find(tr => tr.querySelector('th b').textContent === n && (tr.querySelector('th small') || {}).textContent.includes(arguments[0] || '')); 
              const k = rows.find(tr => tr.querySelector('th b').textContent === 'Rüzgâr · Karma'); const e = rows.find(tr => tr.querySelector('th b').textContent === 'Rüzgâr' && tr.querySelector('th small').textContent.includes('ECMWF'));
              return [[...k.querySelectorAll('td')].filter(td => td.textContent !== '–').length, [...e.querySelectorAll('td')].filter(td => td.textContent !== '–').length]; }""")
            if r[0] == 0 and r[1] > 0: found = True; break
        check(found, 'T: ICON bitince Karma satırı – (ECMWF\'ye geçmiyor), ECMWF satırı dolu (gün %d)' % i)
        if found:
            await pg.locator('#hourly').screenshot(path=SHOTS + '/t_karma_bos.png')
            dl = await pg.inner_text('#dayList'); check('ECMWF' in dl, 'T: gün özetleri ICON sonrası ECMWF ile sürüyor')
        await pg.locator('#dayChips .dchip').first.click(); await pg.wait_for_timeout(150)
        # birimler: ikinci satır ve °F
        await pg.click('#hEdit'); await pg.wait_for_timeout(300)
        sh = await pg.inner_text('#sheet'); check('hücrenin alt satırı' in sh and '°F' in sh, 'T: Birimler: alt satır ve °C/°F seçimi')
        check(await pg.locator('#sheet button[data-set="windUnit2"][data-val="bft"]').count() == 0, 'T: alt satır seçiminde ana birim yok')
        await pg.click('#sheet button[data-set="windUnit2"][data-val="ms"]'); await pg.wait_for_timeout(250)
        await pg.click('#sheet button[data-set="tempUnit"][data-val="f"]'); await pg.wait_for_timeout(250)
        st = await state(pg); check(st['settings']['windUnit2'] == 'ms' and st['settings']['tempUnit'] == 'f', 'T: birim ayarları kaydedildi')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        sm = await pg.evaluate("[...document.querySelectorAll('#hTable td.bf small')].map(e => e.textContent)")
        check(sm and all(x.endswith(' m/s') for x in sm), 'T: ikinci satır m/s')
        L = await pg.evaluate(LB); tv = await pg.evaluate("[...document.querySelectorAll('#hTable tr')].find(tr => tr.querySelector('th b').textContent === 'Hava sıcaklığı').querySelectorAll('td')[10].innerText")
        check('Hava sıcaklığı|°F' in L and 'Su sıcaklığı|°F' in L and 45 < int(re.match(r'\d+', tv).group(0)) < 100, 'T: °F: ' + tv)
        nk = await pg.inner_text('#nowGrid'); check('°F' in nk and '°C' not in nk, 'T: Bugün kartlarında °F')
        # geri al
        await pg.click('#hEdit'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-set="windUnit2"][data-val="kn"]'); await pg.click('#sheet button[data-set="tempUnit"][data-val="c"]'); await pg.wait_for_timeout(250)
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        st = await state(pg)
        # eski satır düzeninden göç: r_icon kapalı, hamle açık → yeni düzen
        st['settings']['hrows'] = [['saat', True], ['sicaklik', True], ['ruzgar', True], ['r_icon', False], ['r_ecmwf', True], ['uyum', True], ['yon', True], ['hamle', True], ['dalga', True]]
        st['settings'].pop('hrv', None)
        await pg.evaluate('(s) => localStorage.setItem("alyssa-v1", JSON.stringify(s))', st)
        await pg.reload(); await pg.wait_for_timeout(2500)
        L = await pg.evaluate(LB); W = [x.split('|')[0] + ' ' + x.split('|')[1].split(' ')[-1] for x in L if (x.startswith('Rüzgâr') and not x.startswith('Rüzgâr Yönü')) or x.startswith('Hamle')]
        check(W == ['Rüzgâr · Karma ICON-EU', 'Hamle GFS'], 'T: eski düzenden göç, v0.16 varsayılanı: ' + str(W))
        await pg.click('#hBar button[data-val="karma"]'); await pg.wait_for_timeout(300)
        st = await state(pg); check(st['settings'].get('hrv') == 16 and not st['settings'].get('hrows'), 'T: göç kaydedildi (hrv 16)')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150); await overflow(pg, 'T %d px' % w)
            await pg.screenshot(path=SHOTS + '/t_%d.png' % w)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        print('T errors:', errs); check(not errs, 'T: sayfa hatası yok')
        await ctx.close()

        # ================================================== U) v0.16: Fishing sekmesi, sade tablo, harita adı (yanlış "Kara" yok), Google, Düzenim
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        LB = """() => [...document.querySelectorAll('#hTable th.lbl')].map(th => th.querySelector('b').textContent + '|' + [...th.querySelectorAll('small')].map(e => e.textContent).join(' / '))"""
        L = await pg.evaluate(LB); print('   satırlar:', L)
        check('Hava|bulut % · yağış' in L and 'Yağış %|' in L and 'Yağış mm|' in L and 'Rüzgâr Yönü|' in L and 'Balık|aktivite % / Solunar M · m · ☀' in L, 'U: satır adları (Hava bulut %, Yağış %/mm, Rüzgâr Yönü, Balık + solunar)')
        check(not any(x.startswith('Bulut|') or x.startswith('Solunar|') for x in L), 'U: Bulut ve Solunar satırları kalktı')
        W = [x for x in L if x.startswith('Rüzgâr ·') or x.startswith('Rüzgâr|') or x.startswith('Hamle')]
        check(W == ['Rüzgâr · Karma|Bft ICON-EU', 'Hamle|Bft GFS'], 'U: varsayılan rüzgâr satırları: ' + str(W))
        order = [x.split('|')[0] for x in L]
        check(order[:9] == ['Saat', 'Güneş · Ay', 'Hava sıcaklığı', 'Su sıcaklığı', 'Hava', 'Yağış %', 'Yağış mm', 'Balık', 'Balık eğrisi'], 'U: varsayılan sıra Kenny’nin düzeni: ' + str(order[:9]))
        cl = await pg.evaluate("[...document.querySelectorAll('#hTable td.wxc')].map(td => td.querySelector('small') ? td.querySelector('small').textContent : '')")
        check(len(cl) > 10 and any(x.startswith('%') for x in cl) and '%0' not in cl, 'U: Hava hücresinde bulut %, %0 yazılmıyor')
        pops = await pg.evaluate("[...document.querySelectorAll('#hTable tr')].find(tr => tr.querySelector('th b').textContent === 'Yağış %').querySelectorAll('td')[3].textContent")
        check(pops.startswith('%'), 'U: yağış olasılığı %17 biçiminde: ' + pops)
        hts = await pg.evaluate("""() => { const h = n => { const r = [...document.querySelectorAll('#hTable tr')].find(tr => tr.querySelector('th b').textContent === n); return Math.round(r.getBoundingClientRect().height); }; return [h('Yağış %'), h('Yağış mm'), h('Balık'), h('Dalga')]; }""")
        check(hts[0] <= 30 and hts[1] <= 30 and hts[2] >= 64 and hts[3] >= 32, 'U: yağış satırları alçak, balık satırı yüksek: ' + str(hts))
        sol = await pg.evaluate("[...document.querySelectorAll('#hTable td.fish em.sol')].map(e => e.textContent).filter(Boolean)")
        check(sol and all(re.fullmatch(r'(M|m|☀↑|☀↓)( (M|m|☀↑|☀↓))*', x) for x in sol), 'U: solunar olayları Balık hücresinde: ' + str(sol[:6]))
        # sekmeler: 7, Fishing ortada; Bugün'de solunar/öneri/sürüklenme yok
        tabs = await pg.evaluate("[...document.querySelectorAll('.tabbar button')].map(b => b.dataset.v)")
        check(tabs == ['bugun', 'takvim', 'avlar', 'fishing', 'rigler', 'envanter', 'daha'], 'U: Fishing sekmesi ortada: ' + str(tabs))
        check(await pg.locator('#v-bugun #recList, #v-bugun #solPanel, #v-bugun #driftPanel').count() == 0 and await pg.locator('#v-fishing #recList').count() == 1, 'U: solunar, öneri ve sürüklenme Bugün’den Fishing’e taşındı')
        await pg.click('#v-bugun .fcta'); await pg.wait_for_timeout(300)
        check(await pg.is_visible('#v-fishing') and not await pg.is_visible('#v-bugun'), 'U: Bugün’deki Fishing kısayolu')
        check(await pg.locator('#fDays .dchip').count() >= 5 and await pg.locator('#fParts .fpart').count() == 2, 'U: gün ve gündüz/gece seçici')
        check(await pg.get_attribute('#fParts button[data-fpart="gun"]', 'aria-pressed') == 'true' and await pg.inner_text('#recHead') == 'Bunu bağla · Gündüz', 'U: sabah gündüz seçili')
        fs = await pg.inner_text('#fSum'); check(re.search(r'\d\d:\d\d – \d\d:\d\d', fs) and 'rüzgâr' in fs, 'U: bölüm özeti: ' + fs.replace('\n', ' ')[:120])
        nr = await pg.locator('#recList article.rig').count(); check(1 <= nr <= 3 and await pg.locator('#recList .rank').count() == nr, 'U: en çok 3 rig, sıralı (%d)' % nr)
        check((await pg.inner_text('#solWins')).strip() != '', 'U: solunar pencereleri')
        dp = await pg.inner_text('#driftPanel'); nb = await pg.locator('#driftPanel .fblock').count()
        check(nb >= 3 and 'İpe binen akış' in dp and 'Gündüz boyunca' in dp, 'U: sürüklenme 3 saatlik dilimlerle (%d dilim)' % nb)
        pos = await pg.evaluate("""() => { const v = document.getElementById('v-fishing'); const y = id => document.getElementById(id).getBoundingClientRect().top; return [y('fPick'), y('solPanel'), y('recList'), y('driftPanel')]; }""")
        check(pos == sorted(pos), 'U: sıra: gün/bölüm → solunar → bunu bağla → sürüklenme (en altta)')
        await pg.screenshot(path=SHOTS + '/u_fishing_gunduz.png', full_page=True)
        await pg.click('#fParts button[data-fpart="gece"]'); await pg.wait_for_timeout(300)
        dp2 = await pg.inner_text('#driftPanel')
        check(await pg.inner_text('#recHead') == 'Bunu bağla · Gece' and 'Gece boyunca' in dp2 and await pg.locator('#recList article.rig').count() <= 3, 'U: gece seçildi, gece rigleri ve gece dilimleri')
        await pg.screenshot(path=SHOTS + '/u_fishing_gece.png', full_page=True)
        await pg.locator('#fDays .dchip').nth(2).click(); await pg.wait_for_timeout(300)
        check(await pg.get_attribute('#fDays .dchip:nth-child(3)', 'aria-pressed') == 'true' and await pg.get_attribute('#fParts button[data-fpart="gece"]', 'aria-pressed') == 'true', 'U: başka gün seçilince bölüm (gece) korunuyor')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(200); await overflow(pg, 'U %d px fishing' % w)
            tb = await pg.evaluate("[...document.querySelectorAll('.tabbar button')].every(b => b.scrollWidth <= b.clientWidth + 1)")
            check(tb, 'U %d px: sekme adları sığıyor' % w)
        await pg.locator('.tabbar').screenshot(path=SHOTS + '/u_tabbar_320.png')
        await pg.set_viewport_size({'width': 390, 'height': 860})
        # Düzenim: kodu al, ayarı değiştir, kodu uygula → eski hali
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.click('#hEdit'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-act="duzenCopy"]'); await pg.wait_for_timeout(300)
        code = await pg.input_value('#duzenOut'); check(code.startswith('ALYSSA-DUZEN:') and len(code) > 40, 'U: Düzen kodu üretildi (%d karakter)' % len(code))
        await pg.click('#sheet button[data-set="tempUnit"][data-val="f"]'); await pg.wait_for_timeout(250)
        await pg.click('#sheet input[data-rowtog="hrows|dalga"]'); await pg.wait_for_timeout(250)
        st = await state(pg); check(st['settings']['tempUnit'] == 'f', 'U: ayar değişti (°F)')
        await pg.fill('#duzenIn', code); await pg.click('#sheet button[data-act="duzenApply"]'); await pg.wait_for_timeout(400)
        st = await state(pg); L2 = await pg.evaluate(LB)
        check(st['settings']['tempUnit'] == 'c' and any(x.startswith('Dalga|') for x in L2) and 'uygulandı' in await pg.inner_text('#toast'), 'U: Düzen kodu uygulandı, ayarlar geri geldi')
        await pg.fill('#duzenIn', 'çöp'); await pg.click('#sheet button[data-act="duzenApply"]'); await pg.wait_for_timeout(300)
        check('Uygulanamadı' in await pg.inner_text('#toast'), 'U: geçersiz kod reddedildi')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        # harita: denizde, Nominatim yakın adres verip derinlik servisi hata verse de "Deniz"; ad ve bilgiler geldikçe yazılır
        await pg.click('#locBtn'); await pg.wait_for_selector('#map.leaflet-container', timeout=10000); await pg.wait_for_timeout(500)
        await pg.evaluate('() => { window.ALYSSA_QA.pickPoint(38.31, 26.71); }'); await pg.wait_for_timeout(1300)   # beklemeden: kart yanıtlar geldikçe dolmalı
        c1 = await pg.inner_text('#mapCard'); print('   ara kart:', c1.replace('\n', ' | ')[:200])
        check('Tuzak Mahallesi' in c1 and 'aranıyor' in c1, 'U: yer adı Overpass beklenmeden göründü')
        await pg.wait_for_timeout(3500)
        c2 = await pg.inner_text('#mapCard'); print('   son kart:', c2.replace('\n', ' | ')[:220])
        check('Deniz' in c2 and 'Kara' not in c2 and 'açıkları' in c2 and 'aranıyor' not in c2, 'U: deniz noktası “Kara” denmeden bulundu')
        await pg.evaluate('window.ALYSSA_QA.pickPoint(38.45, 27.20)'); await pg.wait_for_timeout(2000)
        c3 = await pg.inner_text('#mapCard'); check('Kara' in c3 and 'Test Köyü' in c3, 'U: kara noktası yine Kara: ' + c3.replace('\n', ' | ')[:100])
        await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(200)
        check(await pg.locator('#mapLayers button[data-mapbase="g"]').count() == 1 and await pg.locator('#mapLayers button[data-mapbase="gsat"]').count() == 1, 'U: anahtar varken Google altlıkları listede')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
        print('U errors:', errs); check(not errs, 'U: sayfa hatası yok')
        await ctx.close()

        # ================================================== V) v0.16: Google (sahte Maps JavaScript API): çalışan anahtar ve site kısıtına takılan anahtar
        GFAKE = """(function(){ var mode = window.__GM_MODE || 'ok';
          function Map(el, o){ this.el = el; el.setAttribute('data-gmap', o.mapTypeId); window.__gmMoves = 0; }
          Map.prototype.moveCamera = function(c){ window.__gmMoves++; this.c = c; }; Map.prototype.setMapTypeId = function(t){ this.el.setAttribute('data-gmap', t); };
          function Geocoder(){}
          Geocoder.prototype.geocode = function(){ if (mode !== 'ok') { var e = new Error('Geocoding Service: This IP, site or mobile application is not authorized to use this API key. Request received from IP address 1.2.3.4, with referer: https://ktopdal.github.io/'); e.code = 'REQUEST_DENIED'; return Promise.reject(e); }
            return Promise.resolve({results: [{address_components: [{long_name: 'Gümüldür', types: ['administrative_area_level_4']}, {long_name: 'İzmir', types: ['administrative_area_level_1']}]}]}); };
          window.google = {maps: {Map: Map, Geocoder: Geocoder}};
          if (mode === 'referer') { console.error('Google Maps JavaScript API error: RefererNotAllowedMapError\\nhttps://developers.google.com/maps/documentation/javascript/error-messages#referer-not-allowed-map-error\\nYour site URL to be authorized: ' + location.href); setTimeout(function(){ window.gm_authFailure && window.gm_authFailure(); }, 20); }
          var cb = new URL(document.currentScript.src).searchParams.get('callback'); setTimeout(function(){ window[cb] && window[cb](); }, 5); })();"""
        GLOG = []
        async def mock_gmaps(route):
            GLOG.append(route.request.url)
            return await route.fulfill(status=200, content_type='application/javascript', body=GFAKE, headers=CORS)
        for mode in ['ok', 'referer']:
            ctx, pg, errs = await new_ctx(b)
            await ctx.add_init_script('window.__GM_MODE = %s;' % json.dumps(mode))
            await ctx.route('https://maps.googleapis.com/**', mock_gmaps)
            await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
            await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
            await pg.click('#locBtn'); await pg.wait_for_selector('#map.leaflet-container', timeout=10000); await pg.wait_for_timeout(500)
            await pg.evaluate('window.ALYSSA_QA.pickPoint(38.20, 26.75)'); await pg.wait_for_timeout(2200)
            card = await pg.inner_text('#mapCard'); print('   %s kart:' % mode, card.replace('\n', ' | ')[:220])
            if mode == 'ok':
                check('Gümüldür açıkları' in card and 'Google kullanılamadı' not in card, 'V: Google yer adı (deniz: “… açıkları”)')
                await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(200)
                await pg.click('#mapLayers button[data-mapbase="g"]'); await pg.wait_for_timeout(600)
                check(await pg.locator('#map.hasg .gbase[data-gmap="roadmap"]').count() == 1 and await pg.locator('#map img[src*="tile.openstreetmap.org"]').count() == 0, 'V: Google haritası altlık oldu (OSM karoları kalktı)')
                m0 = await pg.evaluate('window.__gmMoves'); await pg.evaluate('window.ALYSSA_QA.map().panBy([120, 60], {animate: false})'); await pg.wait_for_timeout(200)
                check(await pg.evaluate('window.__gmMoves') > m0, 'V: Google haritası Leaflet’le birlikte kayıyor')
                await pg.click('#mapLayers button[data-mapbase="gsat"]'); await pg.wait_for_timeout(400)
                check(await pg.get_attribute('#map .gbase', 'data-gmap') == 'hybrid', 'V: Google uydu')
                await pg.screenshot(path=SHOTS + '/v_google.png')
                await pg.click('#mapLayers button[data-mapbase="osm"]'); await pg.wait_for_timeout(500)
                check(await pg.locator('#map.hasg').count() == 0 and await pg.locator('#map img[src*="tile.openstreetmap.org"]').count() > 0, 'V: OSM’ye dönüldü')
                await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
                await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="ayarlar"]'); await pg.wait_for_timeout(300)
                await pg.click('#sheet button[data-act="gtest"]'); await pg.wait_for_timeout(800)
                check('Google çalışıyor' in await pg.inner_text('#gTestNote'), 'V: Ayarlar → Google’ı dene: çalışıyor')
            else:
                check('Google kullanılamadı' in card and 'Website restrictions' in card and 'Kara' not in card, 'V: site kısıtı hatası kartta açıklandı')
                await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(200)
                await pg.click('#mapLayers button[data-mapbase="g"]'); await pg.wait_for_timeout(800)
                check(await pg.locator('#map img[src*="tile.openstreetmap.org"]').count() > 0 and 'Google haritası açılamadı' in await pg.inner_text('#toast'), 'V: Google reddedince OSM’ye düşüldü ve sebep yazıldı')
                await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(200)
                await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="ayarlar"]'); await pg.wait_for_timeout(300)
                await pg.click('#sheet button[data-act="gtest"]'); await pg.wait_for_timeout(800)
                gt = await pg.inner_text('#gTestNote'); print('   Google’ı dene:', gt)
                check('Website restrictions' in gt and 'ktopdal.github.io/*' in gt, 'V: Google’ı dene: site kısıtı ve doğru tarif')
            errs[:] = [e for e in errs if 'Google Maps JavaScript API' not in e]
            print('V %s errors:' % mode, errs); check(not errs, 'V %s: sayfa hatası yok' % mode)
            await ctx.close()
        check(len(GLOG) >= 2, 'V: Google betiği istendi (%d)' % len(GLOG))

        # ================================================== W) v0.17: kara / kıyı / deniz — karada yalnız hava durumu
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        st = await state(pg); check(not st['locations']['1'].get('kind') and await pg.evaluate('ALYSSA_QA.modeNow()') == 'tekne', 'W: özel paketin Konum 1’i deniz (türü sorulmadı)')
        # Kenny'nin ekranı: karada nokta, Overpass yanıt vermiyor, EMODnet 13 m diyor → yine Kara, adında "açıkları" yok
        await pg.click('#locBtn'); await pg.wait_for_selector('#map.leaflet-container', timeout=10000); await pg.wait_for_timeout(400)
        await pg.evaluate('window.ALYSSA_QA.pickPoint(38.36476, 26.87316)'); await pg.wait_for_timeout(400)
        card = await pg.inner_text('#mapCard'); print('   kara kartı:', card.replace('\n', ' | ')[:240])
        check('Kara' in card and 'Deniz' not in card and 'açıkları' not in card and 'derinlik' not in card and 'yükselti ≈ 38 m' in card and 'Çelebi, İzmir' in card, 'W: kara noktası Kara, adı “açıkları”sız, derinlik yok, yükselti var')
        check('Bu noktanın hava durumu' in card and 'yalnız hava durumu' in card, 'W: kara kartında “hava durumu” düğmesi ve notu')
        await pg.screenshot(path=SHOTS + '/w_kara_kart.png')
        n0 = len(calls)
        await pg.click('#mapCard button[data-mapact="forecast"]'); await pg.wait_for_timeout(2500)
        st = await state(pg); L = st['locations'][st['active']]; lid = L['id']
        check(L.get('kind') == 'kara' and L['name'] == 'Çelebi, İzmir' and L.get('kindBy') == 'yükselti', 'W: kaydedilen konum Kara: ' + json.dumps({k: L.get(k) for k in ('name', 'kind', 'kindBy', 'elev')}, ensure_ascii=False))
        mar = [c for c in calls[n0:] if 'marine' in c]
        check(not mar, 'W: kara noktası için deniz verisi istenmedi (%d istek)' % len(mar))
        check(await pg.inner_text('#todayTitle') == 'Hava durumu' and not await pg.is_visible('#modeBtn'), 'W: Bugün “Hava durumu”, Tekne/Kıyı düğmesi yok')
        lb = await pg.locator('#hTable th.lbl b').all_text_contents()
        check(not any(x in lb for x in ('Balık', 'Balık eğrisi', 'Su sıcaklığı', 'Dalga', 'Periyot', 'Akıntı', 'Sürüklenme', 'Kıyıya göre')) and all(x in lb for x in ('Hava sıcaklığı', 'Rüzgâr · Karma', 'Yağış %', 'Basınç')), 'W: tabloda yalnız hava satırları: ' + str(lb))
        ks = await pg.evaluate("[...document.querySelectorAll('#nowGrid .metric .k')].map(e => e.textContent)")
        check(ks and not any(k.startswith(('Su', 'Dalga', 'Akıntı')) for k in ks) and any(k.startswith('Yağış') for k in ks) and any(k.startswith('Bulut') for k in ks), 'W: anlık kartlar hava durumu: ' + str(ks))
        check(await pg.inner_text('#classRow') == '' and await pg.is_visible('#landNote') and not await pg.is_visible('#fcta') and not await pg.is_visible('#fishExplain'), 'W: deniz sınıfı, Fishing kısayolu ve balık açıklaması yok; kara notu var')
        check('dalga' not in (await pg.inner_text('#hLegend')).lower(), 'W: dalga renk açıklaması yok')
        await pg.screenshot(path=SHOTS + '/w_kara_bugun.png', full_page=True)
        await pg.click('#compass'); await pg.wait_for_timeout(200); ct = await pg.inner_text('#toast')
        check('dalga' not in ct and 'akıntı' not in ct and 'Rüzgâr' in ct, 'W: pusula özeti yalnız rüzgâr: ' + ct)
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
        check('Kara noktası' in await pg.inner_text('#fNoLoc') and not await pg.is_visible('#fPick') and not await pg.is_visible('#recList') and not await pg.is_visible('#driftPanel') and not await pg.is_visible('#solPanel'), 'W: Fishing’de balık, rig ve sürüklenme yok; deniz noktası seçtiriyor')
        check(await pg.locator('#fNoLoc button[data-use="1"]').count() == 1, 'W: kayıtlı deniz noktasına tek dokunuşla geçiş')
        await pg.screenshot(path=SHOTS + '/w_kara_fishing.png')
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(300)
        dl = await pg.inner_text('#dayList')
        check(await pg.inner_text('#calTitle') == 'Hava takvimi' and 'pencere' not in dl and 'dalga' not in dl and not re.search(r'Gündüz [ABCD]', dl) and not await pg.is_visible('#calAlertRow'), 'W: takvim yalnız hava (sınıf, balık penceresi, dalga ve uyarı yok)')
        await pg.click('.tabbar button[data-v="daha"]'); await pg.wait_for_timeout(200)
        check(await pg.locator('#moreMenu button[data-open="uyari"], #moreMenu button[data-open="liste"]').count() == 0, 'W: Daha’da takvim uyarısı ve çıkış listesi yok')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150)
            for v in ['bugun', 'fishing', 'takvim']:
                await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(150); await overflow(pg, 'W %d px %s (kara)' % (w, v))
        await pg.set_viewport_size({'width': 390, 'height': 860})
        # türü elle Deniz yap → balık ve deniz verisi geri gelir; sonra yine Kara
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(300)
        check('otomatik bulundu (yükselti)' in await pg.inner_text('#sheet'), 'W: Konumlar’da tür ve nasıl bulunduğu yazıyor')
        n1 = len(calls)
        await pg.click('#sheet button[data-lkind="%s|deniz"]' % lid); await pg.wait_for_timeout(3000)
        st = await state(pg); L = st['locations'][lid]; lb = await pg.locator('#hTable th.lbl b').all_text_contents()
        check(L.get('kind') == 'deniz' and L.get('kindAuto') is False and 'Balık' in lb and any('marine' in c for c in calls[n1:]), 'W: elle Deniz: balık satırları ve deniz verisi geldi')
        await pg.click('#sheet button[data-lkind="%s|kara"]' % lid); await pg.wait_for_timeout(1500)
        lb = await pg.locator('#hTable th.lbl b').all_text_contents(); check('Balık' not in lb and 'Dalga' not in lb, 'W: elle Kara: yine yalnız hava')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        # eski sürümde haritadan kaydedilmiş kara noktası "Güzelbahçe açıkları": açılışta Kara bulunur, adı düzeltilir; elle seçilen türe dokunulmaz
        await pg.evaluate("""async () => { const Q = window.ALYSSA_QA, S = Q.state();
          S.locations['77'] = {id: '77', name: 'Güzelbahçe açıkları', lat: 38.3649, lon: 26.8735, bottom: '', depth: '13'};
          S.locations['78'] = {id: '78', name: 'Elle deniz', lat: 38.3651, lon: 26.8739, bottom: '', depth: '', kind: 'deniz', kindAuto: false};
          await Q.ensureKinds(); }""")
        st = await state(pg); L77 = st['locations']['77']; L78 = st['locations']['78']
        check(L77.get('kind') == 'kara' and L77['name'] == 'Güzelbahçe', 'W: eski “Güzelbahçe açıkları” → Kara, adı “Güzelbahçe”: ' + json.dumps({k: L77.get(k) for k in ('name', 'kind')}, ensure_ascii=False))
        check(L78.get('kind') == 'deniz' and L78['name'] == 'Elle deniz', 'W: elle seçilmiş türe dokunulmadı')
        # haritadan kıyı noktası: kıyı türü, kıyı modu sabit, Fishing'de kıyı ve kurşun
        await pg.click('#locBtn'); await pg.wait_for_selector('#map.leaflet-container', timeout=10000); await pg.wait_for_timeout(400)
        await pg.evaluate('window.ALYSSA_QA.pickPoint(38.61, 26.91)'); await pg.wait_for_timeout(400)
        card = await pg.inner_text('#mapCard'); print('   kıyı kartı:', card.replace('\n', ' | ')[:200])
        check('Kıyı' in card and 'kıyıya' in card and 'açıkları' not in card and 'Kıyı noktası: kıyıdan av' in card, 'W: kıyı noktası kartı')
        await pg.click('#mapCard button[data-mapact="forecast"]'); await pg.wait_for_timeout(3500)
        st = await state(pg); L = st['locations'][st['active']]
        check(L.get('kind') == 'kiyi' and await pg.evaluate('ALYSSA_QA.modeNow()') == 'kiyi' and st['mode'] != 'kiyi', 'W: kıyı türü, kıyı modu (kullanıcının Tekne/Kıyı seçimi değişmeden)')
        await pg.click('#modeBtn'); await pg.wait_for_timeout(200)
        check('Bu konum kıyıda' in await pg.inner_text('#toast') and (await state(pg))['mode'] == st['mode'], 'W: kıyı noktasında mod düğmesi değiştirmiyor, nedenini söylüyor')
        lb = await pg.locator('#hTable th.lbl b').all_text_contents(); check('Kıyıya göre' in lb and 'Balık' in lb, 'W: kıyıda balık ve kıyıya göre satırları')
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
        check('Kıyı ve kurşun' in await pg.inner_text('#driftPanel'), 'W: Fishing’de kıyı ve kurşun')
        await pg.screenshot(path=SHOTS + '/w_kiyi_fishing.png', full_page=True)
        # Konum 1'e dönünce her şey deniz gibi
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-use="1"]'); await pg.wait_for_timeout(1500); await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(300)
        lb = await pg.locator('#hTable th.lbl b').all_text_contents()
        check(await pg.inner_text('#todayTitle') == 'Bugün denizde' and 'Balık' in lb and await pg.is_visible('#modeBtn') and await pg.is_visible('#fcta'), 'W: Konum 1’e dönünce deniz ekranı')
        print('W errors:', errs); check(not errs, 'W: sayfa hatası yok')
        await ctx.close()

        # ================================================== X) v0.18: iki cihaz (tablet ve telefon) aynı hesapla: canlı eşitleme ve birleştirme
        async def dev_ctx():
            c = await b.new_context(viewport={'width': 390, 'height': 860}, timezone_id='Europe/Istanbul', device_scale_factor=2)
            await c.add_init_script(FAKE_NOW)
            await c.route('https://api.open-meteo.com/**', mock_meteo); await c.route('https://marine-api.open-meteo.com/**', mock_meteo)
            await fbmock.install(c)
            for pat in ['https://nominatim.openstreetmap.org/**', 'https://overpass-api.de/**', 'https://overpass.kumi.systems/**', 'https://rest.emodnet-bathymetry.eu/**']: await c.route(pat, mock_geo)
            await c.route('https://ows.emodnet-seabedhabitats.eu/**', mock_hab); await c.route('https://api.anthropic.com/**', mock_claude)
            p = await c.new_page(); e = []
            p.on('pageerror', lambda x: e.append('pageerror: ' + str(x)))
            p.on('console', lambda m: e.append('console: ' + m.text) if m.type == 'error' and 'fonts' not in m.text and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
            return c, p, e
        cA, A, eA = await dev_ctx()   # "tablet": özel paketli, ilk giriş
        await A.goto(BASE + '/dist/?qa=1'); await A.wait_for_timeout(1000)
        await A.click('button[data-wel="paket"]'); await A.fill('#wel-pass', KEY['pass_']); await A.click('#welBtn'); await A.wait_for_timeout(6000)
        await A.click('.tabbar button[data-v="daha"]'); await A.click('#moreMenu button[data-open="hesap"]'); await A.wait_for_timeout(1500)
        await A.fill('#ac-mail', 'sync@test.com'); await A.fill('#ac-pass', 'esitle123'); await A.click('button[data-acc="signup"]'); await A.wait_for_timeout(3500)
        ux = fbmock.FB['users']['sync@test.com']['uid']; dA = fbmock.FB['docs'].get('users/' + ux)
        check(dA and dA['fields'].get('dev', {}).get('stringValue', '').startswith('d'), 'X: tablet ilk girişte hesaba yazdı (cihaz kimliğiyle)')
        await A.locator('#sheet [data-close]').first.click(); await A.wait_for_timeout(200)
        cB, B, eB = await dev_ctx()   # "telefon": boş açılır, aynı hesapla girer
        await B.goto(BASE + '/dist/?qa=1'); await B.wait_for_timeout(1000)
        await B.click('button[data-wel="hesap"]'); await B.wait_for_timeout(300)
        await B.fill('#ac-mail', 'sync@test.com'); await B.fill('#ac-pass', 'esitle123'); await B.click('button[data-acc="login"]'); await B.wait_for_timeout(3500)
        sB = await B.evaluate('JSON.parse(localStorage.getItem("alyssa-v1"))')
        check(sB['systems'].get('ozel') and len(sB['locations']) >= 1, 'X: telefon girişte tabletin verisini aldı')
        await B.locator('#sheet [data-close]').first.click(); await B.wait_for_timeout(200)
        # 1) tablette değişiklik (yeni rig sistemi gibi; burada konum türü ve bir ayar) → açık duran telefona birkaç saniyede gelir
        await A.click('.tabbar button[data-v="daha"]'); await A.click('#moreMenu button[data-open="gorunum"]'); await A.wait_for_timeout(250)
        await A.click('#sheet button[data-set="tempUnit"][data-val="f"]'); await A.wait_for_timeout(300)
        await A.locator('#sheet [data-close]').first.click(); await A.wait_for_timeout(200)
        ok = False
        for _ in range(16):
            await B.wait_for_timeout(700)
            sB = await B.evaluate('JSON.parse(localStorage.getItem("alyssa-v1"))')
            if sB['settings'].get('tempUnit') == 'f': ok = True; break
        check(ok, 'X: tabletteki değişiklik açık telefona kendiliğinden geldi')
        tB = await B.inner_text('#toast') if await B.is_visible('#toast') else ''
        print('   telefon bildirimi:', tB)
        # 2) aynı anda iki cihazda farklı değişiklik: tablette yeni konum, telefonda profil adı → ikisi de kalır
        await A.click('.tabbar button[data-v="daha"]'); await A.click('#moreMenu button[data-open="konumlar"]'); await A.wait_for_timeout(250)
        await A.fill('#nl-name', 'Tablet noktası'); await A.fill('#nl-lat', '38.21'); await A.fill('#nl-lon', '26.61'); await A.click('#locForm button[type="submit"]'); await A.wait_for_timeout(150)
        await B.click('.tabbar button[data-v="daha"]'); await B.click('#moreMenu button[data-open="ayarlar"]'); await B.wait_for_timeout(250)
        await B.fill('#pf-name', 'Telefon'); await B.locator('#pf-name').dispatch_event('change'); await B.wait_for_timeout(150)
        await A.wait_for_timeout(12000)
        sA = await A.evaluate('JSON.parse(localStorage.getItem("alyssa-v1"))'); sB = await B.evaluate('JSON.parse(localStorage.getItem("alyssa-v1"))')
        doc = fbmock.doc_json(ux)
        has = lambda st_: any(l['name'] == 'Tablet noktası' for l in st_['locations'].values()) and st_['profile']['name'] == 'Telefon'
        print('   A:', [l['name'] for l in sA['locations'].values()], sA['profile']['name'], '· B:', [l['name'] for l in sB['locations'].values()], sB['profile']['name'])
        check(has(doc), 'X: hesapta iki değişiklik birlikte (yeni konum + profil adı)')
        check(has(sA) and has(sB), 'X: iki cihazda da iki değişiklik var (birleştirildi, kayıp yok)')
        # 3) aynı alan iki yerde: son değiştiren kazanır
        await A.locator('#sheet [data-close]').first.click(); await B.locator('#sheet [data-close]').first.click()
        await A.click('.tabbar button[data-v="daha"]'); await A.click('#moreMenu button[data-open="ayarlar"]'); await A.wait_for_timeout(200)
        await A.fill('#pf-name', 'Önce tablet'); await A.locator('#pf-name').dispatch_event('change'); await A.wait_for_timeout(1200)
        await B.click('.tabbar button[data-v="daha"]'); await B.click('#moreMenu button[data-open="ayarlar"]'); await B.wait_for_timeout(200)
        await B.fill('#pf-name', 'Sonra telefon'); await B.locator('#pf-name').dispatch_event('change'); await B.wait_for_timeout(12000)
        sA = await A.evaluate('JSON.parse(localStorage.getItem("alyssa-v1"))'); sB = await B.evaluate('JSON.parse(localStorage.getItem("alyssa-v1"))')
        check(sA['profile']['name'] == 'Sonra telefon' and sB['profile']['name'] == 'Sonra telefon' and fbmock.doc_json(ux)['profile']['name'] == 'Sonra telefon', 'X: aynı alan iki yerde değişince son değiştiren kaldı: %s / %s' % (sA['profile']['name'], sB['profile']['name']))
        # 4) cihaza özgü ayarlar eşitlenmez (yazı boyutu)
        await A.locator('#sheet [data-close]').first.click(); await A.wait_for_timeout(200)
        await A.click('.tabbar button[data-v="daha"]'); await A.click('#moreMenu button[data-open="ayarlar"]'); await A.wait_for_timeout(200)
        await A.click('#sheet button[data-set="zoom"][data-val="2"]'); await A.wait_for_timeout(8000)
        sB = await B.evaluate('JSON.parse(localStorage.getItem("alyssa-v1"))')
        check(sB['settings'].get('zoom', 0) == 0, 'X: tabletteki yazı boyutu telefona geçmedi (cihaza özgü)')
        await A.click('#sheet button[data-set="zoom"][data-val="0"]'); await A.wait_for_timeout(300)
        # 5) Hesap sayfası: cihaz adı, son gelen, önceki hâl
        await B.locator('#sheet [data-close]').first.click(); await B.wait_for_timeout(200)
        await B.click('.tabbar button[data-v="daha"]'); await B.click('#moreMenu button[data-open="hesap"]'); await B.wait_for_timeout(500)
        hb = await B.inner_text('#sheet'); print('   telefon hesap:', hb.replace('\n', ' | ')[:300])
        check('Bu cihaz' in hb and 'Cihazlar arası eşitleme' in hb and 'Önceki hâline dön' in hb, 'X: Hesap sayfasında cihaz, eşitleme açıklaması ve önceki hâl')
        await B.screenshot(path=SHOTS + '/x_hesap.png', full_page=True)
        for w in [390, 320]:
            await B.set_viewport_size({'width': w, 'height': 760}); await B.wait_for_timeout(150); await overflow(B, 'X %d px hesap' % w)
        print('X errors:', eA, eB); check(not eA and not eB, 'X: sayfa hatası yok (iki cihaz)')
        await cA.close(); await cB.close()

        # ================================================== Y) v0.18: takvimde en çok 3 nokta yan yana
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(250)
        await pg.fill('#nl-name', 'Sığacık açığı'); await pg.fill('#nl-lat', '38.20'); await pg.fill('#nl-lon', '26.75'); await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.fill('#nl-name', 'Ev'); await pg.fill('#nl-lat', '38.3648'); await pg.fill('#nl-lon', '26.8732'); await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-use="1"]'); await pg.wait_for_timeout(300); await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(4000)
        st = await state(pg); ids = {l['name']: l['id'] for l in st['locations'].values()}
        check(st['locations'][ids['Ev']].get('kind') == 'kara', 'Y: “Ev” noktası Kara bulundu')
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#calPick button[data-calloc]').count() == 3, 'Y: takvimde nokta seçici (3 nokta)')
        await pg.click('#calPick button[data-calloc="%s"]' % ids['Sığacık açığı']); await pg.wait_for_timeout(300)
        await pg.click('#calPick button[data-calloc="%s"]' % ids['Ev']); await pg.wait_for_timeout(3500)
        rows = await pg.locator('#dayList .day.cmp').first.locator('.crow2').count()
        check(rows == 3, 'Y: her gün 3 nokta alt alta (%d)' % rows)
        d1 = await pg.locator('#dayList .day.cmp').first.inner_text(); print('   ilk gün:', d1.replace('\n', ' | ')[:300])
        check('Konum 1' in d1 and 'Sığacık' in d1 and 'Ev' in d1 and 'hava' in d1, 'Y: deniz noktalarında sınıf ve balık, kara noktasında hava')
        nb = await pg.locator('#dayList .crow2.best').count(); check(nb >= 5, 'Y: günlerin çoğunda en iyi nokta işaretli (%d)' % nb)
        kara_row = await pg.locator('#dayList .day.cmp').first.locator('.crow2', has_text='Ev').inner_text()
        check('Gündüz' not in kara_row and 'En iyi' not in kara_row, 'Y: kara noktası sınıfsız ve “en iyi” olamaz')
        check(await pg.locator('#calPick button[aria-pressed="true"]').count() == 3, 'Y: 3 nokta seçili')
        st = await state(pg); check(len(st['settings'].get('calLocs') or []) == 3, 'Y: seçim kaydedildi')
        await pg.screenshot(path=SHOTS + '/y_takvim_3.png', full_page=True)
        # dördüncü nokta eklenemez
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(250)
        await pg.fill('#nl-name', 'Dördüncü'); await pg.fill('#nl-lat', '38.25'); await pg.fill('#nl-lon', '26.65'); await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-use="1"]'); await pg.wait_for_timeout(300); await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(1500)
        st = await state(pg); i4 = [l['id'] for l in st['locations'].values() if l['name'] == 'Dördüncü'][0]
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(300)
        await pg.click('#calPick button[data-calloc="%s"]' % i4); await pg.wait_for_timeout(300)
        check('En çok 3' in await pg.inner_text('#toast') and await pg.locator('#calPick button[aria-pressed="true"]').count() == 3, 'Y: dördüncü nokta eklenmedi, uyarı verildi')
        # satıra dokun: o nokta seçilir, o günün saatlik tablosu açılır
        k2 = await pg.locator('#dayList .day.cmp').nth(1).locator('.crow2', has_text='Sığacık').get_attribute('data-calpick')
        await pg.locator('#dayList .day.cmp').nth(1).locator('.crow2', has_text='Sığacık').click(); await pg.wait_for_timeout(1500)
        st = await state(pg)
        check(st['active'] == ids['Sığacık açığı'] and await pg.is_visible('#v-bugun') and await pg.get_attribute('#dayChips button[aria-pressed="true"]', 'data-hday') == k2.split('|')[1], 'Y: satıra dokununca o nokta ve o gün açıldı')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150)
            await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(200); await overflow(pg, 'Y %d px karşılaştırma' % w)
        await pg.screenshot(path=SHOTS + '/y_takvim_320.png', full_page=True)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        # tek noktaya dönünce eski takvim
        await pg.click('#calPick button[data-calloc="%s"]' % ids['Ev']); await pg.click('#calPick button[data-calloc="1"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#dayList .day.cmp').count() == 0 and await pg.locator('#dayList button.day').count() >= 5, 'Y: tek nokta kalınca eski takvim düzeni')
        print('Y errors:', errs); check(not errs, 'Y: sayfa hatası yok')
        await ctx.close()

        # ================================================== Z) v0.19: tür takvimi + su, bugünkü ayar, hedef boy, bağladım → tuttu/tutmadı
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        # 1) motorun parçaları (birim)
        u = await pg.evaluate("""() => { const Q = window.ALYSSA_QA, K = Q.kb();
          const lf = Q.spNow('lufer', 12, 19), ls = Q.spNow('lufer', 7, 26), cold = Q.spNow('cipura', 9, 12);
          const s1 = Q.rigSeason({species: ['lufer']}, 12, 19), s2 = Q.rigSeason({species: ['lufer']}, 7, 26), s3 = Q.rigSeason({species: ['akya']}, 1, 15);
          return {tf: [Q.tempFit(20, [13, 16, 23, 27]), Q.tempFit(14.5, [13, 16, 23, 27]), Q.tempFit(30, [13, 16, 23, 27]), Q.tempFit(null, [1, 2, 3, 4])],
            lf, ls, cold, s1, s2, s3, runs: [Q.monthRuns(new Set([9, 10, 11, 0])), Q.monthRuns(new Set([3])), Q.monthRuns(new Set([0,1,2,3,4,5,6,7,8,9,10,11]))],
            ncal: Object.keys(K.CAL).length, nsp: K.SPECIES.length, miss: K.SPECIES.filter(x => !K.CAL[x.id]).map(x => x.id),
            bad: Object.entries(K.CAL).filter(([k, v]) => !/^[0-3]{12}$/.test(v[0]) || !(v[1][0] < v[1][1] && v[1][1] <= v[1][2] && v[1][2] < v[1][3])).map(x => x[0])}; }""")
        print('   birim:', json.dumps(u, ensure_ascii=False)[:600])
        check(u['tf'][0] == 1 and abs(u['tf'][1] - 0.5) < 1e-9 and u['tf'][2] == 0 and u['tf'][3] is None, 'Z: su uyumu (ideal 1, yarı yolda 0,5, sınır dışı 0, veri yoksa yok)')
        check(u['lf']['m'] == 3 and u['lf']['v'] == 1 and u['ls']['m'] == 1 and u['ls']['v'] < 0.3, 'Z: lüfer Aralık 19°C en iyi; Temmuz 26°C az')
        check(u['cold']['tf'] == 0 and u['cold']['v'] < 0.3, 'Z: çipura için 12°C çok soğuk')
        check(u['s1']['d'] > 1 and 'Aralık: Lüfer en iyi ayında, su 19° ideal' in u['s1']['why'][0], 'Z: rig puanı: mevsiminde ve suda ideal → artı, nedeni yazılı')
        check(u['s2']['d'] < 0 and u['s3']['d'] <= -2.5 and 'mevsimi değil' in u['s3']['why'][0], 'Z: mevsim dışı ve sıcak su → eksi; akya Ocak “mevsimi değil”')
        check(u['runs'] == ['Eki–Oca', 'Nis', 'yıl boyu'], 'Z: ay aralıkları yıl dönümünü kapsıyor: %s' % u['runs'])
        check(not u['miss'] and not u['bad'], 'Z: her türün takvimi ve su aralığı var, biçim doğru (%d tür)' % u['nsp'])
        t = await pg.evaluate("""() => { const Q = window.ALYSSA_QA, S = Q.state(); const ds = Q.days(); const dd = ds.find(d => d.key === '2026-10-17') || ds[0];
          const K = (mm) => ({k: 'kostek', label: 'Köstek', kind: 'kostek', t: {envanter: {name: 'Seaguar FXR', size: mm}}});
          const H = {k: 'ust', label: 'Üst', kind: 'hook', t: {envanter: {name: 'Chinu', size: 'No:2'}}};
          const sunny = {t: new Date('2026-10-17T11:00:00+03:00'), cloud: 10, wave: 0.2, rain: 0, wind: 0.5, wdir: 0, cur: 0.05, curDir: 0};
          const night = Object.assign({}, sunny, {t: new Date('2026-10-17T23:00:00+03:00'), cloud: 80});
          const a = Q.tuneRig({id: 't1', slots: [H, K('0,26 mm')], species: ['karagoz'], klass: 'porsiyon', lengths: {hirsiz: 80}, tech: 'dip'}, dd, sunny, null, false, 10);
          const b = Q.tuneRig({id: 't2', slots: [K('0,40 mm')], species: ['lufer'], klass: 'porsiyon', tech: 'spin'}, dd, sunny, null, false, 12);
          const c = Q.tuneRig({id: 't3', slots: [H, K('0,40 mm')], species: ['sargoz'], klass: 'trofe', tech: 'dip'}, dd, night, null, true, 10);
          const old = S.settings.ftarget; S.settings.ftarget = 'trofe';
          const d = Q.tuneRig({id: 't4', slots: [H, K('0,26 mm')], species: ['karagoz'], klass: 'porsiyon', tech: 'dip'}, dd, sunny, null, false, 10);
          S.settings.ftarget = old;
          return {a, b, c, d, la: Q.lightAt(sunny, dd, null, false), ln: Q.lightAt(night, dd, null, true), lw: Q.lightAt(sunny, dd, {kinds: ['Şafak']}, false)}; }""")
        print('   ayar:', json.dumps(t, ensure_ascii=False)[:700])
        txt = lambda arr: ' | '.join(x['k'] + ': ' + x['t'] for x in arr)
        check(t['la']['lv'] == 3 and t['ln']['lv'] == 0 and t['lw']['lv'] == 1, 'Z: ışık: güneşli-sakin 3, karanlık gece 0, şafak 1')
        check('0,26 → 0,235 mm' in txt(t['a']) and 'tam boy' in txt(t['a']), 'Z: güneşli ve sakin: köstek bir boy ince; akış yok: köstekler tam boy (%s)' % txt(t['a'])[:120])
        check(any(x.get('warn') and 'çelik tel' in x['t'] for x in t['b']) and 'ince köstek' not in txt(t['b']).replace('ince köstek keser', ''), 'Z: lüfer mevsiminde çelik tel uyarısı (ince köstek önerilmez)')
        check('0,40 → 0,45 mm' in txt(t['c']), 'Z: karanlık gece, trofe: köstek bir boy kalın olabilir')
        check('Hedef trofe, bu rig porsiyon' in txt(t['d']), 'Z: hedef trofe, porsiyon rig: iğne bir boy büyük')
        # 2) Fishing: mevsiminde satırı, su sıcaklığı, hedef boy, bugünkü ayar, Bağladım
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(500)
        await pg.click('#fParts button[data-fpart="gun"]'); await pg.wait_for_timeout(300)
        fs = await pg.inner_text('#fSum'); print('   özet:', fs.replace('\n', ' | ')[:300])
        check('Mevsiminde' in fs.title() or 'MEVSİMİNDE' in fs or 'Mevsiminde' in fs, 'Z: Fishing özetinde “Mevsiminde”')
        check(await pg.locator('#fSum .fseason .sz').count() >= 2 and ' su ' in ' ' + fs.lower(), 'Z: Fishing özetinde su sıcaklığı ve en az 2 tür')
        why = ' '.join(await pg.locator('#recList .rig .meta.why').all_text_contents())
        check('Ekim:' in why, 'Z: önerinin nedeninde ay ve tür (Ekim: …)')
        check(await pg.locator('#fTarget button[data-set="ftarget"]').count() == 3, 'Z: hedef boy seçici (Hepsi / Porsiyon / Trofe)')
        tune = await pg.locator('#recList .rig .tune').count()
        print('   bugünkü ayar kartları:', tune, (await pg.locator('#recList .rig .tune').first.inner_text()).replace('\n', ' | ')[:300] if tune else '')
        check(tune >= 1 and 'BUGÜNKÜ AYAR' in (await pg.locator('#recList .rig .tune').first.inner_text()).upper(), 'Z: önerilen rigde “Bugünkü ayar”')
        nr = await pg.locator('#recList article.rig').count()
        check(nr >= 1 and await pg.locator('#recList button[data-fb="bagla"]').count() == nr, 'Z: her önerilen rigde “Bağladım” (%d)' % nr)
        await pg.screenshot(path=SHOTS + '/z_fishing.png', full_page=True)
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 800}); await pg.wait_for_timeout(150); await overflow(pg, 'Z %d px Fishing' % w)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        # hedef trofe
        await pg.click('#fTarget button[data-set="ftarget"][data-val="trofe"]'); await pg.wait_for_timeout(400)
        st = await state(pg); txt = await pg.inner_text('#recList')
        check(st['settings']['ftarget'] == 'trofe' and ('hedef trofe' in txt or 'Hedef trofe' in txt), 'Z: hedef trofe seçildi ve önerilere yansıdı')
        await pg.click('#fTarget button[data-set="ftarget"][data-val=""]'); await pg.wait_for_timeout(400)
        check((await state(pg))['settings']['ftarget'] == '', 'Z: hedef boy “Hepsi”ye döndü')
        # 3) Bağladım → Tutmadı → Geri al → Tuttu → Avı kaydet
        rid = await pg.get_attribute('#recList button[data-fb="bagla"]', 'data-rig')
        await pg.click('#recList button[data-fb="bagla"][data-rig="%s"]' % rid); await pg.wait_for_timeout(300)
        st = await state(pg); fbs = list(st['fb'].values())
        check(len(fbs) == 1 and fbs[0]['rig'] == rid and fbs[0]['res'] is None and fbs[0]['loc'] and not fbs[0]['night'], 'Z: “Bağladım” kaydedildi (rig, konum, gündüz)')
        card = pg.locator('#recList article.rig', has=pg.locator('button[data-fid]'))
        check('Bağlı' in await card.inner_text() and await card.locator('button[data-fb="tuttu"]').count() == 1, 'Z: kartta “Bağlı · saat” ve Tuttu / Tutmadı')
        await card.locator('button[data-fb="tutmadi"]').click(); await pg.wait_for_timeout(300)
        st = await state(pg); f0_ = list(st['fb'].values())[0]
        check(f0_['res'] == 'tutmadi' and 'Tutmadı' in await pg.inner_text('#recList'), 'Z: Tutmadı işlendi')
        await pg.locator('#recList button[data-fb="geri"]').first.click(); await pg.wait_for_timeout(300)
        check(list((await state(pg))['fb'].values())[0]['res'] is None, 'Z: Geri al → yeniden cevap bekliyor')
        await pg.locator('#recList button[data-fb="tuttu"]').first.click(); await pg.wait_for_timeout(300)
        check(list((await state(pg))['fb'].values())[0]['res'] == 'tuttu' and await pg.locator('#recList button[data-fb="av"]').count() == 1, 'Z: Tuttu → “Avı kaydet”')
        await pg.click('#recList button[data-fb="av"]'); await pg.wait_for_timeout(400)
        check(await pg.is_visible('#cf-rig') and await pg.input_value('#cf-rig') == rid, 'Z: av formu bağlanan rigle açıldı')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        # 4) öğrenme: aynı rig benzer koşulda 3 kez tutmadıysa puanı düşer
        sc = await pg.evaluate("""(rid) => { const Q = window.ALYSSA_QA; const ds = Q.days(); const dd = ds.find(d => d.key === '2026-10-17') || ds[0];
          const R0 = Q.recommend(dd, false, null); const before = R0.find(x => x.rg.id === rid);
          const rg = Q.rigs().find(r => r.id === rid);
          for (let i = 0; i < 3; i++) { const f = Q.fbAdd(rg, dd, 'gun', R0.x); Q.fbSet(f.id, 'tutmadi'); }
          const after = Q.recommend(dd, false, null).find(x => x.rg.id === rid);
          return {b: before.sc, a: after.sc, why: after.why}; }""", rid)
        print('   öğrenme:', json.dumps(sc, ensure_ascii=False)[:400])
        check(sc['a'] < sc['b'] - 1.5 and any('tutmadı' in w for w in sc['why']), 'Z: 3 kez tutmayan rig benzer koşulda geri plana düştü (%.1f → %.1f)' % (sc['b'], sc['a']))
        # 5) cevaplanmamış soru Fishing'in üstünde
        await pg.evaluate("""() => { const Q = window.ALYSSA_QA, S = Q.state(); const rg = Q.rigs()[0]; const dd = Q.days()[0];
          const f = Q.fbAdd(rg, dd, 'gece', null); f.t = new Date(Date.now() - 3 * 3600000).toISOString(); localStorage.setItem('alyssa-v1', JSON.stringify(S)); }""")
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.click('.tabbar button[data-v="fishing"]'); await pg.click('#fParts button[data-fpart="gece"]'); await pg.wait_for_timeout(400)
        check(await pg.is_visible('#fAsk') and 'tuttu mu' in (await pg.inner_text('#fAsk')).lower(), 'Z: cevaplanmamış “Bağladığın rig tuttu mu?” sorusu')
        await pg.screenshot(path=SHOTS + '/z_soru.png')
        await pg.click('#fAsk button[data-fb="tutmadi"]'); await pg.wait_for_timeout(300)
        check(not await pg.is_visible('#fAsk'), 'Z: cevaplayınca soru kalktı')
        # Avlar: bildirim özeti
        await pg.click('.tabbar button[data-v="avlar"]'); await pg.wait_for_timeout(300)
        lb = await pg.inner_text('#learnBox') if await pg.is_visible('#learnBox') else ''
        check('Bağladım bildirimleri' in lb and 'tutmadı' in lb, 'Z: Avlar’da bağladım bildirimleri özeti')
        # 6) Tür takvimi sayfası
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
        await pg.click('#fSum button[data-open="turtakvim"]'); await pg.wait_for_timeout(400)
        n1 = await pg.locator('#sheet button.tcal-r').count()
        check(await pg.inner_text('#sheetTitle') == 'Tür takvimi' and n1 >= 5, 'Z: Tür takvimi açıldı (%d tür)' % n1)
        check(await pg.inner_text('#sheet .tcal-h .mo.now') == 'E' and await pg.locator('#sheet .tcal .c.now').count() == n1, 'Z: bu ay (Ekim) işaretli')
        await pg.click('#sheet button[data-tcal="all"]'); await pg.wait_for_timeout(300)
        n2 = await pg.locator('#sheet button.tcal-r').count()
        check(n2 > n1 and n2 >= 35, 'Z: bölgenin türleri (%d)' % n2)
        await pg.screenshot(path=SHOTS + '/z_turtakvimi.png', full_page=True)
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150); await overflow(pg, 'Z %d px tür takvimi' % w)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        await pg.click('#sheet button.tcal-r[data-tur="lufer"]'); await pg.wait_for_timeout(400)
        sh = await pg.inner_text('#sheet')
        check(await pg.inner_text('#sheetTitle') == 'Lüfer' and re.search(r'en iyi (Eki|Kas)–Ara', sh) and 'ideal' in sh, 'Z: türe dokununca takım planı: ne zaman ve su')
        await pg.locator('#sheet .bar .btn').first.click(); await pg.wait_for_timeout(200)
        print('Z errors:', errs); check(not errs, 'Z: sayfa hatası yok')
        await ctx.close()

        # ================================================== AA) v0.20: deniz tabanı (EUSeaMap) ve Usta'ya sor (Claude)
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        # 1) taban sınıflandırma (birim)
        hc = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; return ['Mediterranean infralittoral sand', 'Posidonia oceanica meadows', 'Circalittoral rock and biogenic reef', 'Infralittoral coarse sediment',
          'Circalittoral mud', 'Offshore circalittoral muddy sand', 'Infralittoral mixed sediment', '', 'Seabed', 'MC15', 'MB55 | x', 'MB252'].map(t => Q.habitatClass(t)); }""")
        print('   taban:', json.dumps(hc, ensure_ascii=False)[:500])
        check(hc[0]['bottom'] == 'kum' and 'infralitoral' in hc[0]['zone'] and hc[1]['bottom'] == 'karma' and 'Posidonia' in hc[1]['label'] and hc[2]['bottom'] == 'kayalik' and hc[3]['bottom'] == 'kum-kayalik', 'AA: taban sınıfı: kum, çayır, kaya, iri taneli')
        check(hc[4]['bottom'] == 'camur' and hc[5]['bottom'] == 'kum' and 'açık sirkalitoral' in hc[5]['zone'] and hc[6]['bottom'] == 'karma' and hc[7] is None and hc[8] is None, 'AA: çamur, çamurlu kum = kum, karışık; boş ve "Seabed" → bilinmiyor')
        check(hc[9]['bottom'] == 'kayalik' and 'sirkalitoral' in hc[9]['zone'] and hc[10]['bottom'] == 'kum' and 'infralitoral' in hc[10]['zone'] and hc[11]['bottom'] == 'karma' and 'Biyojenik' in hc[11]['label'], 'AA: yalnız EUNIS kodu gelirse koddan (MC15 kaya, MB55 kum, MB252 biyojenik)')
        # 2) harita: katman, noktaya dokununca taban, kaydedince tahmini dip
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="harita"]'); await pg.wait_for_timeout(1500)
        await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(200)
        lay = await pg.inner_text('#mapLayers')
        check('Deniz tabanı (EUSeaMap' in lay and await pg.locator('#mapLayers input[data-maplayer="habitat"]').count() == 1, 'AA: Katmanlar’da “Deniz tabanı (EUSeaMap)”')
        n0 = len([u for u in HAB_LOG if 'GetMap' in u])
        await pg.click('#mapLayers input[data-maplayer="habitat"]'); await pg.wait_for_timeout(1200)
        tiles = [u for u in HAB_LOG if 'GetMap' in u]
        check(len(tiles) > n0 and all('eusm_eunis2019_group' in u for u in tiles[n0:]), 'AA: taban katmanı açılınca EUSeaMap karoları istendi (%d)' % (len(tiles) - n0))
        check(await pg.locator('#mapLayers .hableg img').count() == 1, 'AA: lejant (sunucunun lejant resmi)')
        st = await state(pg); check(st['settings']['map']['habitat'] is True, 'AA: katman seçimi kaydedildi')
        await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(200)
        await pg.evaluate('() => { window.ALYSSA_QA.pickPoint(38.20, 26.75); }'); await pg.wait_for_timeout(3500)
        card = await pg.inner_text('#mapCard'); print('   kart:', card.replace('\n', ' | ')[:300])
        check('taban ≈ Kum (EUSeaMap)' in card, 'AA: nokta kartında taban tahmini')
        await pg.click('#mapCard button[data-mapact="save"]'); await pg.wait_for_timeout(600)
        st = await state(pg); NL = [l for l in st['locations'].values() if abs(l['lat'] - 38.20) < 1e-6 and abs(l['lon'] - 26.75) < 1e-6][0]
        check(NL.get('bottomEst') == 'kum' and not NL.get('bottom') and 'infralitoral' in (NL.get('bottomEstTxt') or ''), 'AA: kaydedilen konumda dip boş, taban tahmini kum')
        lc = await pg.inner_text('#mapCard')
        check('taban tahmini: Kum' in lc and await pg.locator('#mapCard button[data-mapact="setbed"]').count() == 1, 'AA: konum kartında “dip olarak yaz”')
        # öneride yarım ağırlık ve neden
        rr = await pg.evaluate("""(id) => { const Q = window.ALYSSA_QA, S = Q.state(); const old = S.active; S.active = id;
          const ds = Q.days(); const dd = ds[0]; const R = Q.recommend(dd, false, null); S.active = old;
          return R.slice(0, 12).map(x => x.why.join(' | ')); }""", NL['id'])
        check(any('taban tahmini: Kum (EUSeaMap)' in w for w in rr), 'AA: önerilerde “taban tahmini: Kum (EUSeaMap)”')
        await pg.click('#mapCard button[data-mapact="setbed"]'); await pg.wait_for_timeout(400)
        st = await state(pg); check(st['locations'][NL['id']]['bottom'] == 'kum', 'AA: “dip olarak yaz” → konumun dibi kum')
        # çayır ve kaya noktaları; karada taban yok; servis yanıt vermezse sessiz
        await pg.evaluate('() => { window.ALYSSA_QA.pickPoint(38.25, 26.65); }'); await pg.wait_for_timeout(3000)
        check('Posidonia' in await pg.inner_text('#mapCard'), 'AA: Posidonia çayırı noktası')
        await pg.evaluate('() => { window.ALYSSA_QA.pickPoint(38.215, 26.61); }'); await pg.wait_for_timeout(3000)
        check('taban ≈ Kaya' in await pg.inner_text('#mapCard'), 'AA: kaya noktası')
        await pg.evaluate('() => { window.ALYSSA_QA.pickPoint(38.45, 27.20); }'); await pg.wait_for_timeout(4000)
        check('taban' not in await pg.inner_text('#mapCard'), 'AA: karada taban yazılmaz')
        await pg.evaluate('() => { window.ALYSSA_QA.pickPoint(38.275, 26.625); }'); await pg.wait_for_timeout(3500)
        c5 = await pg.inner_text('#mapCard'); check('taban' not in c5 and 'Kaydet' in c5, 'AA: taban servisi yanıt vermezse kart yine çalışır')
        await pg.screenshot(path=SHOTS + '/aa_harita.png')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        # 3) Usta'ya sor: anahtar yok → kurulum
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(400)
        check(await pg.is_visible('#ustaBtn'), 'AA: Fishing’de “Usta’ya sor”')
        await pg.click('#ustaBtn'); await pg.wait_for_timeout(300)
        sh = await pg.inner_text('#sheet')
        check(await pg.inner_text('#sheetTitle') == 'Usta’ya sor' and 'platform.claude.com' in sh and 'Create key' in sh and await pg.is_visible('#ak-key'), 'AA: anahtar yokken kurulum (Console → API keys → Create key)')
        await pg.fill('#ak-key', 'yanlis-anahtar'); await pg.click('#sheet button[data-usta="savekey"]'); await pg.wait_for_timeout(200)
        check('sk-ant-' in await pg.inner_text('#toast') and not await pg.evaluate('localStorage.getItem("alyssa-ak")'), 'AA: biçimi yanlış anahtar kaydedilmez')
        await pg.fill('#ak-key', 'sk-ant-test-bad'); await pg.click('#sheet button[data-usta="savekey"]'); await pg.wait_for_timeout(300)
        check(await pg.evaluate('localStorage.getItem("alyssa-ak")') == 'sk-ant-test-bad', 'AA: anahtar cihaza kaydedildi')
        await pg.click('#sheet button[data-usta="q"]'); await pg.wait_for_timeout(1200)
        check('API anahtarı geçersiz' in await pg.inner_text('#sheet'), 'AA: geçersiz anahtar → açık hata')
        # doğru anahtar
        await pg.click('#sheet details summary'); await pg.fill('#ak-key', 'sk-ant-test-good'); await pg.click('#sheet button[data-usta="savekey"]'); await pg.wait_for_timeout(300)
        nlog = len(CLAUDE_LOG)
        await pg.click('#sheet button[data-usta="q"][data-q="Bugün hangi rigi bağlayayım?"]'); await pg.wait_for_timeout(1500)
        sh = await pg.inner_text('#sheet'); html = await pg.inner_html('#sheet')
        check('Önce en üstteki rigi bağla.' in sh and '<b>Önce en üstteki rigi bağla.</b>' in html and '<li>' in html and 'GİZLİ DÜŞÜNCE' not in sh, 'AA: cevap geldi (kalın, maddeler; düşünce bloğu gösterilmez)')
        check('Sonnet 5.5 · ≈ $0,' in sh, 'AA: cevabın altında model ve yaklaşık maliyet')
        req = CLAUDE_LOG[-1]; h = req['h']; bd = req['b']; ctxt = bd['system'][1]['text']
        print('   bağlam:', ctxt[:700].replace('\n', ' ¶ '))
        check(h.get('anthropic-dangerous-direct-browser-access') == 'true' and h.get('x-api-key') == 'sk-ant-test-good' and h.get('anthropic-version'), 'AA: istek başlıkları (tarayıcıdan doğrudan, anahtar, sürüm)')
        check(bd['model'] == 'claude-sonnet-5-5' and bd['output_config']['effort'] == 'low' and bd['messages'][-1]['content'] == 'Bugün hangi rigi bağlayayım?', 'AA: model Sonnet 5.5, effort low, soru')
        top = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const dd = Q.days()[0]; const R = Q.recommend(dd, false, null).filter(x => x.ok); return R[0] ? (R[0].rg.code || R[0].rg.name) : ''; }""")
        check('BAĞLAM' in ctxt and 'Konum:' in ctxt and 'Uygulamanın önerdiği rigler' in ctxt and top in ctxt and 'Pencere' in ctxt and 'Mevsiminde' in ctxt, 'AA: bağlamda konum, pencere, mevsim ve önerilen rigler (%s)' % top)
        st = await state(pg); coords = []
        for l in st['locations'].values(): coords += ['%.4f' % l['lat'], '%.4f' % l['lon'], '%.3f' % l['lat'], '%.3f' % l['lon']]
        raw = json.dumps(bd, ensure_ascii=False)
        check(not any(c in raw for c in coords) and 'sk-ant-test-good' not in raw, 'AA: istekte koordinat ve anahtar yok')
        # ikinci soru: geçmiş gider
        await pg.fill('#ustaQ', 'Akşam hangi saatte başlayayım?'); await pg.click('#sheet button[data-usta="ask"]'); await pg.wait_for_timeout(1500)
        bd2 = CLAUDE_LOG[-1]['b']
        check([m['role'] for m in bd2['messages']] == ['user', 'assistant', 'user'] and 'İkinci cevap' in await pg.inner_text('#sheet'), 'AA: ikinci soruda önceki konuşma gider')
        # model Haiku
        await pg.click('#sheet details summary'); await pg.click('#sheet button[data-ustam="claude-haiku-5-5"]'); await pg.wait_for_timeout(200)
        await pg.click('#sheet button[data-usta="q"][data-q="Bu hava çıkmaya uygun mu?"]'); await pg.wait_for_timeout(1500)
        check(CLAUDE_LOG[-1]['b']['model'] == 'claude-haiku-5-5' and await pg.evaluate('localStorage.getItem("alyssa-am")') == 'claude-haiku-5-5', 'AA: Haiku 5.5 seçilince onunla soruldu')
        await pg.screenshot(path=SHOTS + '/aa_usta.png')
        await pg.evaluate("document.querySelector('#sheet').scrollTop = 99999"); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOTS + '/aa_usta2.png')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150); await overflow(pg, 'AA %d px Usta' % w)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        # anahtar profile, buluta, yedeğe girmez
        check('sk-ant' not in await pg.evaluate('localStorage.getItem("alyssa-v1")') and 'sk-ant' not in await pg.evaluate('JSON.stringify(window.ALYSSA_QA.state())'), 'AA: anahtar profilde (eşitleme, yedek) yok')
        await pg.click('#sheet button[data-usta="clear"]'); await pg.wait_for_timeout(200)
        check(await pg.locator('#sheet .umsg').count() == 0, 'AA: Temizle')
        # kredi yoksa
        await pg.evaluate('localStorage.setItem("alyssa-ak", "sk-ant-test-nocredit")'); await pg.click('#sheet button[data-usta="q"]'); await pg.wait_for_timeout(1200)
        check('Billing' in await pg.inner_text('#sheet'), 'AA: kredi yoksa Billing’e yönlendirir')
        await pg.evaluate('localStorage.setItem("alyssa-ak", "sk-ant-test-noeffort")'); n1 = len(CLAUDE_LOG); await pg.click('#sheet button[data-usta="q"]'); await pg.wait_for_timeout(1500)
        check(len(CLAUDE_LOG) == n1 + 2 and 'output_config' not in CLAUDE_LOG[-1]['b'] and 'Önce en üstteki rigi bağla.' in await pg.inner_text('#sheet'), 'AA: effort tanınmazsa effort’suz yeniden soruldu')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        # Ayarlar'da durum
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="ayarlar"]'); await pg.wait_for_timeout(300)
        check('Usta’ya sor (Claude)' in await pg.inner_text('#sheet') and 'Anahtar bu cihazda kayıtlı' in await pg.inner_text('#sheet'), 'AA: Ayarlar’da Usta’ya sor durumu')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        print('AA errors:', errs); check(not errs, 'AA: sayfa hatası yok')
        await ctx.close()

        # ================================================== AB) v0.21: takvim uyarısı — çoklu nokta, genişletilmiş kural, hazırlık, akşam özeti, bağlantı, bozulan pencere, alarmlar
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(250)
        await pg.fill('#nl-name', 'Sığacık açığı'); await pg.fill('#nl-lat', '38.20'); await pg.fill('#nl-lon', '26.75'); await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.fill('#nl-name', 'Ev'); await pg.fill('#nl-lat', '38.3648'); await pg.fill('#nl-lon', '26.8732'); await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-use="1"]'); await pg.wait_for_timeout(300); await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(4000)
        st = await state(pg); ids = {l['name']: l['id'] for l in st['locations'].values()}; sig = ids['Sığacık açığı']; ev = ids['Ev']
        # 1) noktalar ve kural
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="uyari"]'); await pg.wait_for_timeout(400)
        check(await pg.locator('#sheet button[data-alloc]').count() == 3, 'AB: uyarıda nokta seçici (3 nokta)')
        await pg.click('#sheet button[data-alloc="%s"]' % sig); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-alloc="%s"]' % ev); await pg.wait_for_timeout(3000)
        for k, v in [('bft', '6'), ('wave', '1.5'), ('fish', '3')]:
            await pg.select_option('#sheet select[data-alert="%s"]' % k, v); await pg.wait_for_timeout(300)
        await pg.wait_for_timeout(1500)
        sh = await pg.inner_text('#sheet'); st = await state(pg)
        print('   uyarı:', sh.replace('\n', ' | ')[:500])
        check(sorted(st['settings']['alert']['locs']) == sorted(['1', sig, ev]) and 'Kara noktasında av penceresi yok: Ev' in sh, 'AB: 3 nokta seçili; kara noktası (Ev) için not')
        nsl = await pg.locator('#sheet .item.aslot').count(); nbest = await pg.locator('#sheet .item.aslot .besttag').count()
        check(nsl >= 2 and nbest >= 1, 'AB: pencereler (%d), aynı saatte iki noktada olanlarda “En iyi” (%d)' % (nsl, nbest))
        prep = await pg.locator('#sheet .item.aslot details .sp').first.text_content()
        check('Rigler:' in prep and ('Kurşun:' in prep or 'Hazır rig yok' in prep), 'AB: pencerede hazırlık (rigler, kurşun): ' + prep.replace('\n', ' / ')[:120])
        check('Akşam özeti' in sh and 'Yarın' in sh, 'AB: akşam özeti önizlemesi')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 760}); await pg.wait_for_timeout(150); await overflow(pg, 'AB %d px uyarı' % w)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        await pg.screenshot(path=SHOTS + '/ab_uyari.png')
        await pg.evaluate("document.querySelector('#sheet .item.aslot').scrollIntoView()"); await pg.wait_for_timeout(150); await pg.screenshot(path=SHOTS + '/ab_uyari2.png')
        await pg.evaluate("document.querySelector('#sheet').scrollTop = 1e6"); await pg.wait_for_timeout(150); await pg.screenshot(path=SHOTS + '/ab_uyari3.png')
        # 2) kural birimleri: tür, yıldız, akıntı, su
        rf = await pg.evaluate("""() => { const Q = window.ALYSSA_QA, dd = Q.days()[0]; const base = {bft: 6, wave: 1.5, fish: 1, sp: '', suMin: '', suMax: '', star: '', curMin: '', curMax: ''};
          const w = {fish: 4}, st = {bft: 3, wave: 0.4, cur: 0.5, sst: 21};
          const f = o => Q.ruleFail(Object.assign({}, base, o), dd, w, st);
          return {ok: f({}), star: f({star: 5}), cmin: f({curMin: 0.6}), cmax: f({curMax: 0.4}), cfine: f({curMin: 0.4, curMax: 0.6}), su1: f({suMin: 22}), su2: f({suMax: 20}), sufine: f({suMin: 16, suMax: 22}),
            akya: f({sp: 'akya'}), lufer: f({sp: 'lufer'}), nocur: Q.ruleFail(Object.assign({}, base, {curMin: 0.2}), dd, w, {bft: 3, wave: 0.4, cur: null, sst: 21}), stars: dd.sol.stars}; }""")
        print('   kural:', json.dumps(rf, ensure_ascii=False)[:500])
        check(rf['ok'] == [] and rf['cfine'] == [] and rf['sufine'] == [] and rf['lufer'] == [], 'AB: kurala uyan koşullar boş döner (akıntı 0,4–0,6, su 16–22, lüfer)')
        check((rf['star'] != []) == (rf['stars'] < 5) and rf['cmin'] and rf['cmax'] and rf['su1'] and rf['su2'], 'AB: yıldız, akıntı ve su sınırları')
        check(rf['akya'] and 'mevsimi değil' in rf['akya'][0] and rf['nocur'] == ['akıntı verisi yok'], 'AB: akya Ekim’de mevsimi değil; akıntı verisi yoksa “akıntı en az” sağlanmaz')
        await pg.select_option('#sheet select[data-alert="sp"]', 'akya'); await pg.wait_for_timeout(800)
        check(await pg.locator('#sheet .item.aslot').count() == 0 and 'ek koşulları kaldır' in await pg.inner_text('#sheet'), 'AB: hedef tür akya (mevsimi değil) → pencere yok')
        await pg.select_option('#sheet select[data-alert="sp"]', 'lufer'); await pg.wait_for_timeout(800)
        n_l = await pg.locator('#sheet .item.aslot').count()
        check(n_l >= 1 and 'Lüfer' in await pg.inner_text('#sheet'), 'AB: hedef tür lüfer (mevsiminde) → pencereler (%d)' % n_l)
        await pg.select_option('#sheet select[data-alert="sp"]', ''); await pg.wait_for_timeout(500)
        st = await state(pg); check(st['settings']['alert']['sp'] == '' and st['settings']['alert']['curMin'] == '' and st['settings']['alert']['prep'] == 18, 'AB: boş seçimler boş kalır (0 olmaz)')
        # 3) takvim dosyası: pencereler, özetler, alarmlar, bağlantı
        nsl = await pg.locator('#sheet .item.aslot').count()
        async with pg.expect_download() as dl_info:
            await pg.click('#sheet button[data-act="icsAll"]')
        dl = await dl_info.value; ics = open(await dl.path(), encoding='utf-8', newline='').read()
        un = lambda t: re.sub(r'\r\n ', '', t)   # katlanmış satırları aç
        icu = un(ics)
        print('   ics:', ics.count('BEGIN:VEVENT'), 'etkinlik ·', icu.count('UID:av-'), 'pencere ·', icu.count('UID:ozet-'), 'özet')
        check(icu.count('UID:av-') == nsl and icu.count('UID:ozet-') >= 3, 'AB: .ics: her pencere bir etkinlik, akşam özetleri ayrı')
        check('TRIGGER:-PT120M' in icu and 'TRIGGER;VALUE=DATE-TIME:' in icu and 'Hazırlık · ' in icu and 'Son hava kontrolü' in icu, 'AB: alarmlar: son hava kontrolü ve bir gün önce hazırlık')
        check(re.search(r'UID:ozet-\d{8}-[^\r\n]+\r\n[^\r]*\r\nSEQUENCE:1\r\nDTSTART:\d{8}T170000Z', icu) is not None and 'TRIGGER:PT0M' in icu, 'AB: akşam özeti 20:00’da (UTC 17:00), açılınca alarm')
        check('URL:http://127.0.0.1:%d/dist/#av=' % PORT in icu and 'Uygulamada aç:' in icu and 'Rigler:' in icu, 'AB: etkinlikte uygulama bağlantısı ve hazırlık notu')
        check(all(len(l.encode()) <= 75 for l in ics.split('\r\n')), 'AB: .ics satırları 75 baytı aşmıyor')
        als = await pg.evaluate('JSON.parse(localStorage.getItem("alyssa-als"))')
        check(als and len(als['ids']) == nsl and all(e['set'] for e in als['ids'].values()), 'AB: eklenen pencereler bu cihazda saklandı (%d)' % len(als['ids']))
        check('Takvim uyarısı değişti' not in await pg.inner_text('#banners'), 'AB: ekledikten sonra “değişti” bildirimi yok')
        # 4) bozulan pencere: takvimde olup artık kurala uymayan (rüzgârlı gündüz) bir pencere
        await pg.evaluate("""() => { const a = JSON.parse(localStorage.getItem('alyssa-als')); const e = Object.values(a.ids)[0];
          a.ids['av-20261017-ogle-x@alyssa'] = {a: new Date('2026-10-17T10:00:00+03:00').getTime(), b: new Date('2026-10-17T11:30:00+03:00').getTime(), title: 'Gündüz av penceresi · Konum 1', loc: '1', date: '2026-10-17', part: 'gun', set: e.set};
          const k = Object.keys(a.ids)[0]; a.ids[k].a -= 3 * 3600000; a.ids[k].b -= 3 * 3600000;   // bir pencere kaymış olsun
          localStorage.setItem('alyssa-als', JSON.stringify(a)); }""")
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        await pg.evaluate('() => { window.ALYSSA_QA.state().settings.zoom = 0; }')
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="ayarlar"]'); await pg.wait_for_timeout(200)
        await pg.click('#sheet button[data-set="zoom"][data-val="0"]'); await pg.wait_for_timeout(500)   # yeniden çizim
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        bn = await pg.inner_text('#banners'); print('   bildirim:', bn.replace('\n', ' | ')[:300])
        check('Takvim uyarısı değişti' in bn and re.search(r'bozuldu \((balık|rüzgâr|dalga|solunar|akıntı|su)', bn) and 'kaydı' in bn, 'AB: üstte “Takvim uyarısı değişti: bozuldu (neden), kaydı”')
        await pg.click('#banners button[data-open="uyari"]'); await pg.wait_for_timeout(600)
        sh = await pg.inner_text('#sheet')
        check('İPTAL' in sh and 'Değişti' in sh and 'Takvimi güncelle (' in sh, 'AB: uyarı sayfasında İPTAL ve Değişti satırları, “Takvimi güncelle”')
        async with pg.expect_download() as dl_info:
            await pg.click('#sheet button[data-act="icsAll"]')
        dl = await dl_info.value; ics2 = un(open(await dl.path(), encoding='utf-8', newline='').read())
        check('UID:av-20261017-ogle-x@alyssa' in ics2 and 'STATUS:CANCELLED' in ics2 and 'SUMMARY:İPTAL · ' in ics2 and 'SEQUENCE:2' in ics2, 'AB: güncelleme dosyasında iptal ve aynı kimlikle yeni sürüm (SEQUENCE 2)')
        als = await pg.evaluate('JSON.parse(localStorage.getItem("alyssa-als"))')
        check('av-20261017-ogle-x@alyssa' not in als['ids'] and 'Takvim uyarısı değişti' not in await pg.inner_text('#banners'), 'AB: iptal bir kez gönderildi; bildirim kalktı')
        # 5) bağlantı: Fishing o gün, bölüm ve noktayla açılır
        await pg.click('#sheet .item.aslot button[data-avgo]'); await pg.wait_for_timeout(800)
        check(await pg.is_visible('#v-fishing') and await pg.locator('#sheet').is_hidden(), 'AB: “Fishing’de aç” → Fishing')
        await pg.goto(BASE + '/dist/?qa=1#av=2026-10-18.gece.' + sig); await pg.wait_for_timeout(2500)
        st = await state(pg)
        check(await pg.is_visible('#v-fishing') and st['active'] == sig and await pg.get_attribute('#fDays button[aria-pressed="true"]', 'data-fday') == '2026-10-18' and await pg.get_attribute('#fParts button[aria-pressed="true"]', 'data-fpart') == 'gece', 'AB: #av= bağlantısıyla açılış: nokta, gün ve gece seçili')
        check(await pg.evaluate('location.hash') == '#fishing', 'AB: bağlantı adresten temizlendi')
        await pg.evaluate("location.hash = '#av=2026-10-19.gun.1'"); await pg.wait_for_timeout(1500)
        st = await state(pg)
        check(st['active'] == '1' and await pg.get_attribute('#fDays button[aria-pressed="true"]', 'data-fday') == '2026-10-19' and await pg.get_attribute('#fParts button[aria-pressed="true"]', 'data-fpart') == 'gun', 'AB: açıkken gelen bağlantı da çalışır')
        # 6) yalnız kara noktası
        await pg.evaluate("(ev) => { const S = window.ALYSSA_QA.state(); S.settings.alert.locs = [ev]; }", ev)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="uyari"]'); await pg.wait_for_timeout(500)
        check('Seçili noktalar karada' in await pg.inner_text('#sheet'), 'AB: yalnız kara noktası → av penceresi hesaplanmaz')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        print('AB errors:', errs); check(not errs, 'AB: sayfa hatası yok')
        await ctx.close()

        # ================================================== AC) v0.22: nokta hafızası, saat saat plan, envanterden yedek, sürüklenme haritada, yem planı, mevsime göre derinlik
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        # 1) R6 mevsime göre derinlik (birim)
        dp = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const rg = {species: ['sargoz'], tech: 'dip'};
          return {sp7: Q.spDepth('sargoz', 7), sp1: Q.spDepth('sargoz', 1), deep: Q.rigDepth(rg, 7, 54), fit: Q.rigDepth(rg, 7, 25), shallow: Q.rigDepth(rg, 7, 5), spin: Q.rigDepth({species: ['levrek'], tech: 'spin'}, 7, 5), none: Q.rigDepth(rg, 7, null)}; }""")
        print('   derinlik:', json.dumps(dp, ensure_ascii=False)[:500])
        check(dp['sp7'] == [10, 40] and dp['sp1'] == [3, 30], 'AC: sargoz yazın 10–40 m, kışın 3–30 m')
        check(not dp['deep']['fit'] and 'daha sığ' in dp['deep']['why'] and dp['deep']['d'] < 0 and dp['fit']['fit'] and dp['fit']['d'] > 0 and 'daha derin' in dp['shallow']['why'], 'AC: 54 m → daha sığ; 25 m → uygun; 5 m → daha derin')
        check(dp['spin'] is None and dp['none'] is None, 'AC: spin (orta su) ve derinliği bilinmeyen noktada derinlik payı yok')
        # Konum 1'e derinlik yaz → öneride ve bugünkü ayarda derinlik
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(250)
        await pg.fill('#sheet input[data-lk="1"][data-f="depth"]', '54'); await pg.locator('#sheet input[data-lk="1"][data-f="depth"]').dispatch_event('change'); await pg.wait_for_timeout(300)
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.click('#fParts button[data-fpart="gun"]'); await pg.wait_for_timeout(500)
        why = ' '.join(await pg.locator('#recList .rig .meta.why').all_text_contents()); tn = ' '.join(await pg.locator('#recList .rig .tune').all_text_contents())
        check(('derinlik uygun' in why or 'dene' in why) and 'Burası 54 m' in tn, 'AC: öneride ve bugünkü ayarda mevsime göre derinlik')
        # 2) R1 nokta hafızası: bu noktada iki av kaydı (aynı rig) → o rig öne çıkar
        R0 = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const dd = Q.days()[0]; const R = Q.recommend(dd, false, null); return R.filter(x => x.ok).map(x => ({id: x.rg.id, sc: x.sc})); }""")
        rid = R0[3]['id'] if len(R0) > 3 else R0[-1]['id']; sc0 = [r['sc'] for r in R0 if r['id'] == rid][0]
        for _ in range(2):
            await pg.click('.tabbar button[data-v="avlar"]'); await pg.click('#addCatch'); await pg.wait_for_timeout(250)
            await pg.select_option('#cf-sp', 'sargoz'); await pg.fill('#cf-n', '3'); await pg.select_option('#cf-rig', rid); await pg.click('#cfSave'); await pg.wait_for_timeout(800)
        sm = await pg.evaluate("""(rid) => { const Q = window.ALYSSA_QA; const L = Q.loc(); const m = Q.spotMemory(L); const dd = Q.days()[0]; const R = Q.recommend(dd, false, null); const x = R.find(r => r.rg.id === rid);
          return {n: m.n, fish: m.fish, top: m.top.map(r => r.id), sp: m.sp, sc: x.sc, why: x.why}; }""", rid)
        print('   hafıza:', json.dumps(sm, ensure_ascii=False)[:400])
        check(sm['n'] == 2 and sm['fish'] == 6 and sm['top'][0] == rid and sm['sp'][0] == ['sargoz', 6], 'AC: nokta hafızası: 2 av, 6 balık, en iyi rig ve tür')
        check(sm['sc'] > sc0 + 1 and any('bu noktada 1.' in w for w in sm['why']), 'AC: bu noktanın en iyi rigi öneride öne geçti (%.1f → %.1f)' % (sc0, sm['sc']))
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(400)
        spl = await pg.inner_text('#fSpot') if await pg.is_visible('#fSpot') else ''
        check('Bu noktada 2 av kaydı, 6 balık' in spl and 'Sargoz 6' in spl, 'AC: Fishing’de “Bu noktada …” satırı: ' + spl[:120])
        # 3) R2 saat saat plan
        tl = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const ds = Q.days(); return {g: Q.rigTimeline(ds[0], 'gun').map(e => e.kind + '|' + e.txt), n: Q.rigTimeline(ds[0], 'gece').map(e => e.kind + '|' + e.txt)}; }""")
        print('   plan:', json.dumps(tl, ensure_ascii=False)[:600])
        check(tl['g'] and tl['g'][0].startswith('start|') and any(e.startswith('switch|Alacakaranlık') for e in tl['g']) and any(e.startswith('win|') for e in tl['g']), 'AC: gündüz planı: başlangıç, pencere, alacakaranlıkta gece rigine geçiş')
        check(any(e.startswith('switch|Şafak') for e in tl['n']), 'AC: gece planı: şafakta gündüz rigine geçiş')
        check(await pg.is_visible('#fPlan') and await pg.locator('#fPlan .tlr').count() >= 3, 'AC: Fishing’de “Saat saat plan”')
        # 4) R5 yem planı
        check(await pg.is_visible('#fBait') and 'Yem planı' in await pg.inner_text('#fBait'), 'AC: Fishing’de “Yem planı”')
        b2 = await pg.inner_text('#fBait'); q2 = [int(x) for x in re.findall(r'· (\d+) ', b2)]
        await pg.click('#fBait button[data-set="rods"][data-val="4"]'); await pg.wait_for_timeout(400)
        b4 = await pg.inner_text('#fBait'); q4 = [int(x) for x in re.findall(r'· (\d+) ', b4)]
        print('   yem:', b2.replace('\n', ' | ')[:200], '→', q4)
        check(q2 and q4 and sum(q4) > sum(q2) and '4 kamış' in b4, 'AC: kamış 2 → 4: yem miktarı arttı (%s → %s)' % (q2, q4))
        await pg.click('#fBait button[data-act="baitShop"]'); await pg.wait_for_timeout(400)
        st = await state(pg); ys = [x for x in (st.get('shopX') or {}).values() if x['k'].startswith('yem:')]
        check(ys and all(x['until'] == '2026-10-17' and x['kind'] == 'bait' for x in ys), 'AC: yemler alışveriş listesine (çıkış gününe kadar)')
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="alisveris"]'); await pg.wait_for_timeout(400)
        sh = await pg.text_content('#sheet')
        check('Yem · 17 Eki gündüz çıkışı' in sh and await pg.locator('#sheet button[data-shopdel]').count() == len(ys), 'AC: alışveriş listesinde “Yem · 17 Eki gündüz çıkışı” ve Aldım')
        k0 = await pg.get_attribute('#sheet button[data-shopdel]', 'data-shopdel')
        await pg.click('#sheet button[data-shopdel="%s"]' % k0); await pg.wait_for_timeout(400)
        st = await state(pg)
        check(k0 not in st['shopX'] and await pg.locator('#sheet button[data-shopdel]').count() == len(ys) - 1, 'AC: Aldım → yem listeden düştü')
        await pg.evaluate("() => { const S = window.ALYSSA_QA.state(); Object.values(S.shopX).forEach(x => { if (x.k.indexOf('yem:') === 0) x.until = '2026-10-16'; }); }")
        sl = await pg.evaluate("() => window.ALYSSA_QA.shoppingList().filter(n => n.kind === 'bait').length")
        check(sl == 0, 'AC: çıkış günü geçen yem planı listeden düşer')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        # 5) R3 envanterden yedek (birim + motor)
        sb = await pg.evaluate("""() => { const Q = window.ALYSSA_QA, I = Q.items2(), S = Q.state();
          // elde olan bir iğne: komşu boyu ölçü olarak ver → yedek o olmalı
          let hk = null; Object.values(I).some(it => it.cat === 'hook' && Q.patOf(it) && Q.sizesOf(it).some(sz => { const h = Q.hookIdx(sz); if (h && Q.usable(Q.stockOf(it.id, sz))) { hk = {it, sz, h}; return true; } return false; }));
          let hs = null;
          if (hk) { const nb = hk.h.sc === 'jp' ? 'No:' + (hk.h.v + 1) : (hk.h.v + 1 >= 0 ? (hk.h.v + 2) + '/0' : '#' + (-(hk.h.v + 1)));
            const r = Q.subSlot({k: 'ust', label: 'Üst', kind: 'hook', t: {envanter: {item: 'x-yok', name: 'Olmayan', size: nb}}, sp: {kind: 'hook', p: [Q.patOf(hk.it)], sc: hk.h.sc, lo: hk.h.v + 1, hi: hk.h.v + 1}});
            hs = {want: nb, got: r && r.to, txt: r && r.txt, have: hk.it.id + '|' + hk.sz}; }
          let ln = null; Object.values(I).some(it => (it.cat === 'fc' || it.cat === 'mono') && Q.lineMm(it) && Q.usable(Q.stockOf(it.id, '-')) && (ln = it));
          let ls = null; if (ln) { const mm = Q.lineMm(ln); const r = Q.subSlot({k: 'kostek', label: 'Köstek', kind: 'line', t: {envanter: {item: null, name: '', size: (mm * 1.05).toFixed(3) + ' mm'}}}); ls = {mm, got: r && r.to, txt: r && r.txt}; }
          return {hs, ls}; }""")
        print('   yedek:', json.dumps(sb, ensure_ascii=False)[:500])
        check(sb['hs'] and sb['hs']['got'] and abs(sb['hs']['got']['dv']) <= 1, 'AC: eksik iğneye elde olan uyumlu iğne (en çok bir boy fark) yedek bulundu: ' + str((sb['hs'] or {}).get('txt')))
        check(sb['ls'] and sb['ls']['got'] and abs(sb['ls']['got']['d']) <= 0.12, 'AC: eksik köstek ipine elde olan yakın çaplı ip (±%12) yedek bulundu: ' + str((sb['ls'] or {}).get('txt')))
        ms = await pg.evaluate("""() => { const Q = window.ALYSSA_QA, S = Q.state(); const dd = Q.days()[0];
          for (const rg of Q.rigs()) { if (!Q.ready(rg)) continue;
            for (const sl of rg.slots) { const e = sl.t.envanter || {}; if (sl.kind !== 'hook' || !e.item) continue; const k = e.item + '|' + (e.size || '-'); const old = S.inv.status[k], oq = S.inv.qty[k];
              Q.setStatus(k, 'yok'); Q.invChanged(); const sub = Q.subFor(Q.rigs().find(r => r.id === rg.id));
              if (sub && sub.complete) { const x = Q.recommend(dd, rg.time === 'gece', null).find(r => r.rg.id === rg.id); return {id: rg.id, ok: x ? x.ok : null, sub: sub.list.map(c => c.txt), why: x ? x.why : [], ready: Q.ready(Q.rigs().find(r => r.id === rg.id))}; }
              if (old == null) delete S.inv.status[k]; else S.inv.status[k] = old; if (oq != null) S.inv.qty[k] = oq; Q.invChanged(); } }
          return null; }""")
        print('   motor yedek:', json.dumps(ms, ensure_ascii=False)[:400])
        check(ms and ms['ready'] is False and ms['ok'] is True and any('yedekle hazır' in w for w in ms['why']), 'AC: iğnesi biten rig yedekle önerilere girdi (Yedekle hazır)')
        # 6) R4 sürüklenme haritada
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
        dn = await pg.evaluate("() => { const z = window.ALYSSA_QA.driftNow(); return z ? {m: z.off && z.off.m, from: z.off && z.off.from, sog: z.dr.sog} : null; }")
        print('   sürüklenme:', dn)
        check(dn and dn['m'] and dn['m'] > 0, 'AC: sürüklenme: başlama mesafesi ve yönü hesaplandı')
        await pg.click('#driftPanel button[data-act="driftmap"]'); await pg.wait_for_timeout(2500)
        check(await pg.locator('.mdstart').count() == 1 and await pg.locator('.mdarrow').count() == 1 and await pg.locator('path.leaflet-interactive, #map svg path').count() >= 1, 'AC: haritada “Başla” işareti, ok ve çizgi')
        z = await pg.evaluate('() => window.ALYSSA_QA.map().getZoom()'); check(z == 14, 'AC: harita noktaya yakınlaştı (zoom %s)' % z)
        g = await pg.evaluate("""() => { const Q = window.ALYSSA_QA, L = Q.loc(), z = Q.driftNow(); const s = Q.geoDest(L.lat, L.lon, z.off.from, z.off.m);
          const R = 6371000, toR = Math.PI / 180, dlat = (s[0] - L.lat) * toR, dlon = (s[1] - L.lon) * toR; const a = Math.sin(dlat / 2) ** 2 + Math.cos(L.lat * toR) * Math.cos(s[0] * toR) * Math.sin(dlon / 2) ** 2;
          return {d: 2 * R * Math.asin(Math.sqrt(a)), m: z.off.m}; }""")
        check(abs(g['d'] - g['m']) < 2, 'AC: başlama noktası doğru uzaklıkta (%.0f m / %s m)' % (g['d'], g['m']))
        await pg.screenshot(path=SHOTS + '/ac_harita.png')
        await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(200)
        check('Sürüklenme çizgisi' in await pg.inner_text('#mapLayers'), 'AC: Katmanlar’da “Sürüklenme çizgisi”')
        await pg.click('#mapLayers input[data-maplayer="drift"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('.mdstart').count() == 0, 'AC: katman kapanınca çizgi kalktı')
        await pg.click('#mapLayers input[data-maplayer="drift"]'); await pg.wait_for_timeout(300)
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        # 7) görünüm ve taşma
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SHOTS + '/ac_fishing.png', full_page=True)
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 800}); await pg.wait_for_timeout(150); await overflow(pg, 'AC %d px Fishing' % w)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        print('AC errors:', errs); check(not errs, 'AC: sayfa hatası yok')
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
        await pg.click('.tabbar button[data-v="daha"]'); await pg.wait_for_timeout(200)
        check(await pg.locator('#moreMenu button[data-open="hesap"]').count() == 0, 'önizleme: Hesap satırı yok (giriş yalnızca yayında)')
        await pg.screenshot(path=SHOTS + '/e_preview.png')
        print('E errors:', errs); check(not errs, 'E: sayfa hatası yok')
        await ctx.close(); await b.close()
    print('\nGitHub istekleri:', len(GH_LOG), '· Open-Meteo istekleri:', len(calls))
    print('SONUÇ:', 'HEPSİ GEÇTİ' if not FAIL else '%d HATA: %s' % (len(FAIL), FAIL))

try:
    asyncio.run(main())
finally:
    srv.terminate()
