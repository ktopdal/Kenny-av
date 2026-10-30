"""Alyssa v0.3–v0.22 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
v0.29.3 sekme çubuğu, sihirbaz 4 tür, rig parçası değiştirme ve konum türü kuralı testleri
"""
import os, sys
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import fbmock   # sahte Firebase

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_m'
SHOTS = ROOT + '/qa/v29m'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(os.environ.get('ALYSSA_DIST', ROOT + '/app/dist'), WWW + '/dist')   # ALYSSA_DIST: sabitlenmiş bir derlemeyi test etmek için
shutil.copytree(os.environ.get('ALYSSA_PUB', ROOT + '/app/dist_pub'), WWW + '/pub')   # genel yayın
prev = open(os.environ.get('ALYSSA_PREV', ROOT + '/app/preview/alyssa_onizleme.html'), encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8803
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
NEAR = lambda lat, lon: 38.70 < lat < 38.71 and 26.95 < lon < 26.96   # denizde, kıyıya ≈ 450 m (mendirek/iskele payı)
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
        cy = lat - 0.02 if LAND(lat, lon) else lat - 0.00135 if KIYI(lat, lon) else lat + 0.004 if NEAR(lat, lon) else lat + 0.02   # OSM kıyı çizgisi batıdan doğuya: kara solda (kuzey), deniz sağda (güney)
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

# Kenny'nin kurulumu ve kalem adları özel veriden okunur; depoda düz yazılmaz
DB = json.load(open(ROOT + '/data/kenny_av_db.json', encoding='utf-8'))
_L1 = [l for l in DB['locations'] if l['id'] == '1'][0]
LDDM = ('%d°%s′ K' % (int(_L1['lat']), ('%06.3f' % ((_L1['lat'] % 1) * 60)).replace('.', ',')))   # plotter biçimi, özel dosyadan
SU = {s['id']: s for s in DB['setups']}; IT = {i['id']: i for i in DB['items']}
def imax(i): m = re.search(r'max\s*(\d+)\s*g', IT[i].get('spec', '')); return int(m.group(1)) if m else None
CAST = [i for i in IT if IT[i]['cat'] == 'rod' and 'tetikli' in IT[i].get('spec', '')]
PG_ROD, PG_REEL = SU['PG']['rods'][0], SU['PG']['reel']; TG_ROD, TG_REEL = SU['TG']['rods'][0], SU['TG']['reel']; NP_ROD = SU['NP']['rods'][0]
NM = lambda i: IT[i]['name']
OTHER_RODS = [i for i in IT if IT[i]['cat'] == 'rod' and i != PG_ROD]; OTHER_REELS = [i for i in IT if IT[i]['cat'] == 'reel' and i != PG_REEL]

async def tall(pg, h, path, sel=None):
    await pg.set_viewport_size({'width': 390, 'height': h}); await pg.wait_for_timeout(300)
    if sel: await pg.locator(sel).first.screenshot(path=path)
    else: await pg.screenshot(path=path)
    await pg.set_viewport_size({'width': 390, 'height': 860}); await pg.wait_for_timeout(150)

async def rigs_all(pg):
    await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(250)
    if await pg.locator('#sysBar button[data-sys="all"]').count(): await pg.click('#sysBar button[data-sys="all"]'); await pg.wait_for_timeout(250)

# ================================================== AM) v0.29.3: konum türü kuralı, "Bilmiyorum, sen seç" en çok 4 tür, rig parçası değiştirme, iPhone alt çubuk
async def add_loc(pg, name, lat, lon):
    await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(200)
    await pg.fill('#nl-name', name); await pg.fill('#nl-lat', lat); await pg.fill('#nl-lon', lon)
    await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
    await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(2500)

async def close_all(pg):
    for _ in range(4):
        if await pg.is_visible('#sheet'): await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(250)

async def toast_txt(pg):
    return await pg.evaluate("(() => { const t = document.querySelector('.toast'); return t ? t.textContent : ''; })()")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/pub/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="bos"]'); await pg.wait_for_timeout(500)
        await add_loc(pg, 'Mordoğan Açıkları', '38.20', '26.75')
        await add_loc(pg, 'Şehitlik İskelesi kıyı', '38.61', '26.91')
        await add_loc(pg, 'Test köyü', '38.45', '27.20')
        await add_loc(pg, 'Mendirek önü', '38.705', '26.955')
        LS = lambda: pg.evaluate('JSON.parse(localStorage.getItem("awf-v1"))')
        st = await LS(); ids = {v['name']: k for k, v in st['locations'].items()}
        kinds = {v['name']: (v.get('kind'), v.get('kindDet'), v.get('kindDetStrong')) for v in st['locations'].values()}
        print('   konumlar:', kinds)
        D, K, A, N = ids['Mordoğan Açıkları'], ids['Şehitlik İskelesi kıyı'], ids['Test köyü'], ids['Mendirek önü']
        check(kinds['Mordoğan Açıkları'][0] == 'deniz' and kinds['Şehitlik İskelesi kıyı'][0] == 'kiyi' and kinds['Test köyü'][0] == 'kara', 'AM: türler bulundu (deniz, kıyı, kara)')
        # ---- konum türü kuralı
        await pg.click('#locBtn'); await pg.wait_for_timeout(300)
        dis = await pg.evaluate("() => [...document.querySelectorAll('#sheet button[data-lkind][aria-disabled=\"true\"]')].map(b => b.dataset.lkind)")
        print('   kapalı düğmeler:', dis)
        check(set(dis) == {K + '|deniz', D + '|kara', D + '|kiyi', A + '|deniz', A + '|kiyi', N + '|kara'}, 'AM: kıyı→Deniz, deniz→Kara, kara→Deniz kapalı; kıyıdan uzak deniz/kara noktası kıyı da olamaz; kıyıya yakın deniz noktası kıyı olabilir')
        await pg.click('#sheet button[data-lkind="%s|deniz"]' % K, force=True); await pg.wait_for_timeout(300)
        t = await toast_txt(pg); st = await LS()
        check(st['locations'][K]['kind'] == 'kiyi' and 'deniz yapılamaz' in t, 'AM: kıyı noktası deniz yapılamadı (%s)' % t)
        await pg.click('#sheet button[data-lkind="%s|kara"]' % K); await pg.wait_for_timeout(300)
        st = await LS(); check(st['locations'][K]['kind'] == 'kara', 'AM: kıyı noktası kara yapılabildi')
        await pg.click('#sheet button[data-lkind="%s|deniz"]' % K, force=True); await pg.wait_for_timeout(300)
        st = await LS(); check(st['locations'][K]['kind'] == 'kara', 'AM: kara yapılmış kıyı noktası da deniz olamıyor')
        await pg.click('#sheet button[data-lkind="%s|kiyi"]' % K); await pg.wait_for_timeout(300)
        st = await LS(); check(st['locations'][K]['kind'] == 'kiyi' and st['locations'][K].get('kindDet') == 'kiyi', 'AM: kıyıya geri dönüldü (temel tür saklı)')
        await pg.click('#sheet button[data-lkind="%s|kara"]' % D, force=True); await pg.wait_for_timeout(300)
        t = await toast_txt(pg); st = await LS()
        check(st['locations'][D]['kind'] == 'deniz' and 'kara yapılamaz' in t, 'AM: deniz noktası kara yapılamadı')
        await pg.click('#sheet button[data-lkind="%s|kiyi"]' % D, force=True); await pg.wait_for_timeout(300)
        t = await toast_txt(pg); st = await LS(); check(st['locations'][D]['kind'] == 'deniz' and 'kıyıdan uzak' in t, 'AM: kıyıdan 2 km uzak deniz noktası kıyı yapılamadı (%s)' % t)
        await pg.click('#sheet button[data-lkind="%s|kiyi"]' % N); await pg.wait_for_timeout(300)
        st = await LS(); check(st['locations'][N]['kind'] == 'kiyi', 'AM: kıyıya yakın deniz noktası kıyı yapılabildi (mendirek)')
        await pg.click('#sheet button[data-lkind="%s|deniz"]' % N); await pg.wait_for_timeout(300)
        st = await LS(); check(st['locations'][N]['kind'] == 'deniz', 'AM: kıyı yapılan deniz noktası yeniden deniz')
        await pg.click('#sheet button[data-lkind="%s|deniz"]' % A, force=True); await pg.wait_for_timeout(300)
        st = await LS(); check(st['locations'][A]['kind'] == 'kara', 'AM: kara noktası deniz yapılamadı')
        note = await pg.inner_text('#sheet')
        check('nokta kıyıda: deniz yapılamaz' in note and 'nokta denizde: kara yapılamaz' in note and 'nokta denizde ve kıyıdan uzak: kıyı ve kara yapılamaz' in note, 'AM: kural notu listede yazıyor')
        await pg.locator('#sheet').screenshot(path=SHOTS + '/am_konumlar.png')
        # eski kayıt: elle kurala aykırı seçilmiş tür açılışta düzelir (kıyıda bulunmuş, elle deniz yapılmış)
        await pg.evaluate("""(k) => { const s = JSON.parse(localStorage.getItem('awf-v1')); const L = s.locations[k]; L.kind = 'deniz'; L.kindAuto = false; L.kindBy = ''; localStorage.setItem('awf-v1', JSON.stringify(s)); }""", K)
        await pg.reload(); await pg.wait_for_timeout(1500)
        st = await LS(); check(st['locations'][K]['kind'] == 'kiyi', 'AM: kurala aykırı eski seçim açılışta kıyıya döndü')
        # ---- sihirbaz: deniz noktası, "Bilmiyorum, sen seç" teknik ve tür
        await close_all(pg)
        await pg.click('#locBtn'); await pg.wait_for_timeout(200); await pg.click('#sheet button[data-use="%s"]' % D); await pg.wait_for_timeout(300); await close_all(pg)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        await pg.click('#v-rigler button[data-act="wizard"]'); await pg.wait_for_timeout(300)
        await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-wztx]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(200)
        sx = await pg.inner_text('button[data-wzsx]')
        print('   sen seç:', sx.replace('\n', ' | '))
        check('Bilmiyorum, sen seç' in sx and 'bu ay başlıca' in sx, 'AM: tür adımında “Bilmiyorum, sen seç” ve başlıca türler yazıyor')
        await pg.click('button[data-wzsx]'); await pg.wait_for_timeout(200)
        on = await pg.eval_on_selector_all('button[data-wzs][aria-pressed="true"]', 'els => els.map(e => e.dataset.wzs)')
        allsp = await pg.eval_on_selector_all('button[data-wzs]', 'els => els.length')
        print('   seçilen:', on, 'listede', allsp)
        check(0 < len(on) <= 4 and allsp > 4, 'AM: sen seç en çok 4 tür seçti (%d / %d)' % (len(on), allsp))
        fams = await pg.evaluate("(ids) => ids.map(id => window.ALYSSA_QA.kb().SPECIES.find(s => s.id === id).fam)", on)
        check('pelajikk' in fams and any(f in ('sk', 'so', 'kum', 'kaya') for f in fams), 'AM: iki teknikten de tür var (çapari + dip: %s)' % fams)
        await pg.locator('#sheet').screenshot(path=SHOTS + '/am_turler.png')
        # ekleyebilir: bir tür daha
        extra = await pg.evaluate("(on) => [...document.querySelectorAll('button[data-wzs]')].map(e => e.dataset.wzs).find(x => !on.includes(x))", on)
        await pg.click('button[data-wzs="%s"]' % extra); await pg.wait_for_timeout(150)
        on2 = await pg.eval_on_selector_all('button[data-wzs][aria-pressed="true"]', 'els => els.length')
        check(on2 == len(on) + 1, 'AM: istediği türü ekleyebiliyor (%d)' % on2)
        # hiç seçmeden ilerle: en çok 4
        await pg.click('button[data-wzsx]'); await pg.wait_for_timeout(150)   # aç (yeniden 4)
        await pg.click('button[data-wzsx]'); await pg.wait_for_timeout(150)   # kapat (boş)
        n0 = await pg.eval_on_selector_all('button[data-wzs][aria-pressed="true"]', 'els => els.length')
        await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(200)
        t = await toast_txt(pg); sp = await pg.evaluate("window.ALYSSA_QA.wz().ans.species")
        print('   boş geçti:', n0, sp, t)
        check(n0 == 0 and 0 < len(sp) <= 4 and 'için kuruluyor' in t and 'hepsi' not in t, 'AM: tür seçmeden geçince en çok 4 tür (%d)' % len(sp))
        for _ in range(2): await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(200)
        cnt = await pg.inner_text('#wzCount'); n = int(re.search(r'(\d+)', cnt).group(1))
        check(1 <= n <= 8, 'AM: sade sistem az rig (%s)' % cnt)
        await pg.fill('#wz-name', 'Dip sistemim'); await pg.click('button[data-wz="done"]'); await pg.wait_for_timeout(600)
        nr = await pg.locator('#rigList article.rig').count()
        check(nr == n, 'AM: %d rig kuruldu' % nr)
        # ---- rig parçası: iğne satırı → başka iğne seç
        row = pg.locator('#rigList article.rig button.crow.tap[data-part]').filter(has_text=re.compile('Üst|İğne|Hırsız|Alt'))
        check(await row.count() > 0, 'AM: rig kartında iğne satırı dokunulur')
        dp = await row.first.get_attribute('data-part'); rid, sk = dp.split('|')
        await row.first.click(); await pg.wait_for_timeout(300)
        sh = await pg.inner_text('#sheet')
        nopt = await pg.locator('#partPick option').count()
        check('Başka iğne seç' in sh and nopt > 3, 'AM: parça sayfasında “Başka iğne seç” listesi var (%d seçenek)' % nopt)
        cur = await pg.evaluate("([r, k]) => { const s = window.ALYSSA_QA.rigs().find(x => x.id === r).slots.find(x => x.k === k).t.envanter; return (s.item || '') + '|' + (s.size || '-'); }", [rid, sk])
        vals = await pg.eval_on_selector_all('#partPick option', 'els => els.map(e => e.value).filter(Boolean)')
        check(cur not in vals, 'AM: listede şimdiki iğne yok, ötekiler var')
        pick = vals[-1]
        await pg.select_option('#partPick', pick); await pg.click('#sheet button[data-partpick^="use|"]'); await pg.wait_for_timeout(400)
        st = await LS(); ov = st.get('rigOv', {}).get(rid + '|' + sk)
        print('   seçim:', pick, ov)
        check(ov and ov['item'] + '|' + ov['size'] == pick, 'AM: seçilen iğne bu rige yazıldı')
        sh = await pg.inner_text('#sheet')
        check('Bu rig için değiştirdin' in sh, 'AM: parça sayfası değişikliği ve asıl parçayı gösteriyor')
        await pg.locator('#sheet').screenshot(path=SHOTS + '/am_parca.png')
        # envantere yeni iğne ekle → geri dön, seçili
        await pg.click('#sheet button[data-partnew]'); await pg.wait_for_timeout(300)
        check(await pg.inner_text('#sheetTitle') == 'Yeni kalem' and await pg.eval_on_selector('#it-cat', 'e => e.value') == 'hook', 'AM: yeni kalem formu iğne kategorisinde açıldı')
        await pg.fill('#it-brand', 'Deneme'); await pg.fill('#it-model', 'Yeni Chinu'); await pg.fill('#it-sizes', '5, 6')
        await pg.click('#itSave'); await pg.wait_for_timeout(500)
        sel = await pg.eval_on_selector('#partPick', 'e => e.value'); title = await pg.inner_text('#sheetTitle')
        print('   yeni kalem sonrası:', title, sel)
        check(await pg.locator('#partPick').count() == 1 and sel.endswith('|5') and 'deneme-yeni-chinu' in sel, 'AM: kaydedince parça sayfasına döndü, yeni iğne seçili')
        await pg.click('#sheet button[data-partpick^="use|"]'); await pg.wait_for_timeout(400)
        st = await LS(); ov = st['rigOv'][rid + '|' + sk]
        check(ov['item'] == sel.split('|')[0] and ov['size'] == '5', 'AM: yeni iğne bu rigde')
        await pg.click('#sheet button[data-partorig]'); await pg.wait_for_timeout(400)
        st = await LS(); check(rid + '|' + sk not in st.get('rigOv', {}), 'AM: “Asıl parçaya dön” geri aldı')
        await close_all(pg)
        # ---- hazırlama: malzemede "Değiştir", şemada iğne
        await rigs_all(pg)
        await pg.click('#rigList article.rig button[data-prep="%s"]' % rid); await pg.wait_for_timeout(400)
        chg = pg.locator('#sheet .mats button.mchg')
        check(await chg.count() >= 2, 'AM: malzemede iğne ve ip için “Değiştir” (%d)' % await chg.count())
        hk = await pg.locator('#sheet .schemewrap g.hk[data-part]').count()
        check(hk >= 1, 'AM: şemada iğne dokunulur (%d)' % hk)
        await pg.locator('#sheet').screenshot(path=SHOTS + '/am_hazirlama.png')
        await pg.locator('#sheet .mats button.mchg[aria-label^="İğne"]').first.click(); await pg.wait_for_timeout(300)
        print('   değiştir →', await pg.inner_text('#sheetTitle'))
        check(await pg.locator('#partPick').count() == 1, 'AM: “Değiştir” parça sayfasını açtı')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(300)
        check('Hazırlama' in await pg.inner_text('#sheetTitle'), 'AM: Geri hazırlamaya döndü')
        await pg.locator('#sheet .schemewrap g.hk[data-part]').first.dispatch_event('click'); await pg.wait_for_timeout(300)
        check(await pg.locator('#partPick').count() == 1, 'AM: şemadaki iğneye dokununca parça sayfası')
        await close_all(pg)
        # ---- mağaza seviyesinde satırlar da dokunulur
        await rigs_all(pg)
        if await pg.locator('#v-rigler button[data-tier="turkiye"]').count():
            await pg.click('#v-rigler button[data-tier="turkiye"]'); await pg.wait_for_timeout(300)
            tr = pg.locator('#rigList article.rig button.crow.tap[data-part]')
            check(await tr.count() > 0, 'AM: mağaza seviyesinde parça satırları dokunulur')
            await tr.first.click(); await pg.wait_for_timeout(300)
            check(await pg.locator('#sheet section.set').count() > 0, 'AM: mağaza seviyesinden parça sayfası açıldı')
            await close_all(pg)
            await pg.click('#v-rigler button[data-tier="envanter"]'); await pg.wait_for_timeout(200)
        # ---- iPhone alt çubuk: yazarken gizli, sonra yerinde; görüntü alanı küçük kalırsa düzeltilir
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(200)
        await pg.focus('#nl-name'); await pg.wait_for_timeout(150)
        kb = await pg.evaluate("document.body.classList.contains('kb') && getComputedStyle(document.querySelector('.tabbar')).visibility")
        check(kb == 'hidden', 'AM: yazı alanı odaktayken alt çubuk gizli')
        await pg.evaluate("document.activeElement.blur()"); await pg.wait_for_timeout(400)
        kb2 = await pg.evaluate("document.body.classList.contains('kb')")
        check(not kb2, 'AM: klavye kapanınca alt çubuk geri geldi')
        await close_all(pg)
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.wait_for_timeout(200)
        await pg.evaluate("window.scrollTo(0, 300)")
        f0 = await pg.evaluate("window.ALYSSA_QA.vp().fix")
        await pg.set_viewport_size({'width': 390, 'height': 520}); await pg.wait_for_timeout(200)   # "klavye kapandı ama ölçü küçük kaldı"
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(200)
        await pg.focus('#nl-name'); await pg.wait_for_timeout(100); await pg.evaluate("document.activeElement.blur()"); await pg.wait_for_timeout(900)
        f1 = await pg.evaluate("window.ALYSSA_QA.vp()")
        print('   görüntü alanı:', f1)
        check(f1['fix'] > f0 and f1['tries'] <= 2, 'AM: küçük kalan görüntü alanında yeniden ölçtürme denendi (en çok 2 kez)')
        await close_all(pg)
        await pg.set_viewport_size({'width': 390, 'height': 860}); await pg.wait_for_timeout(300)
        tb = await pg.evaluate("(() => { const r = document.querySelector('.tabbar').getBoundingClientRect(); return [Math.round(r.bottom), window.innerHeight]; })()")
        check(abs(tb[0] - tb[1]) <= 1, 'AM: alt çubuk ekranın altında (%s)' % tb)
        for w in (390, 320):
            await pg.set_viewport_size({'width': w, 'height': 860}); await pg.wait_for_timeout(200); await overflow(pg, 'AM %d' % w)
        print('AM errors:', errs); check(not errs, 'AM: hata yok')
        await ctx.close()
        # ---- özel sürüm (önizleme): Kenny'nin paket rigi, iğne değiştirme paket ve envanteri değiştirmez
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/preview.html?qa=1'); await pg.wait_for_timeout(1500)
        await rigs_all(pg)
        row = pg.locator('#rigList article.rig button.crow.tap[data-part]').filter(has_text=re.compile('Üst|Orta|Hırsız'))
        n = await row.count(); check(n > 0, 'AM özel: paket rigde iğne satırları dokunulur (%d)' % n)
        inv0 = await pg.evaluate("JSON.stringify(window.ALYSSA_QA.state().inv)")
        dp = await row.first.get_attribute('data-part'); rid, sk = dp.split('|')
        await row.first.click(); await pg.wait_for_timeout(300)
        vals = await pg.eval_on_selector_all('#partPick option', 'els => els.map(e => e.value).filter(Boolean)')
        check(len(vals) > 3, 'AM özel: envanterdeki iğneler listede (%d)' % len(vals))
        await pg.select_option('#partPick', vals[0]); await pg.click('#sheet button[data-partpick^="use|"]'); await pg.wait_for_timeout(400)
        st = await pg.evaluate("window.ALYSSA_QA.state()")
        inv1 = json.dumps(st['inv'], separators=(',', ':'), ensure_ascii=False)
        check(st['rigOv'].get(dp) and await pg.evaluate("JSON.stringify(window.ALYSSA_QA.state().inv)") == inv0, 'AM özel: seçim yalnız bu rige yazıldı; envanter aynı')
        await pg.click('#sheet button[data-partorig]'); await pg.wait_for_timeout(300)
        print('AM özel errors:', errs); check(not errs, 'AM özel: hata yok')
        await ctx.close(); await b.close()
    srv.terminate()
    print('SONUÇ:', 'HEPSİ GEÇTİ' if not FAIL else '%d HATA' % len(FAIL))
asyncio.run(main())
