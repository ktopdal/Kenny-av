"""Alyssa v0.3–v0.22 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
v0.29.4 ikonlar, harita ad kartı, konum kartı, sihirbaz takım/kur, rig sil/birleştir testleri
"""
import os, sys
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import fbmock   # sahte Firebase

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_n'
SHOTS = ROOT + '/qa/v29n'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(os.environ.get('ALYSSA_DIST', ROOT + '/app/dist'), WWW + '/dist')   # ALYSSA_DIST: sabitlenmiş bir derlemeyi test etmek için
shutil.copytree(os.environ.get('ALYSSA_PUB', ROOT + '/app/dist_pub'), WWW + '/pub')   # genel yayın
prev = open(os.environ.get('ALYSSA_PREV', ROOT + '/app/preview/alyssa_onizleme.html'), encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8805
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

# ================================================== AN) v0.29.4: Rig Atölyesinde konum kartı, takım ve kur adımları, ikonlar, hırsızlı surf, rig sil ve birleştir, harita ad kartı, Google bekleme
async def add_loc(pg, name, lat, lon):
    await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(200)
    await pg.fill('#nl-name', name); await pg.fill('#nl-lat', lat); await pg.fill('#nl-lon', lon)
    await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
    await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(2500)

async def close_all(pg):
    for _ in range(4):
        if await pg.is_visible('#modal'): await pg.click('#modal .mtop [data-mclose]'); await pg.wait_for_timeout(200)
        if await pg.is_visible('#sheet'): await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(250)

async def toast_txt(pg):
    return await pg.evaluate("(() => { const t = document.querySelector('.toast'); return t ? t.textContent : ''; })()")

async def wz_open(pg):
    await close_all(pg)
    await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
    await pg.click('#v-rigler button[data-act="wizard"]'); await pg.wait_for_timeout(300)

async def nxt(pg):
    await pg.click('#sheet button[data-wz="next"]'); await pg.wait_for_timeout(250)

async def LOC(pg, i):
    return await pg.evaluate("(id) => JSON.parse(JSON.stringify(window.ALYSSA_QA.state().locations[id]))", i)

QRIGS = "() => window.ALYSSA_QA.rigs().map(r => ({id: r.id, sys: r.sys, code: r.code, name: r.name, tech: r.tech, lay: r.lay, time: r.time, klass: r.klass, species: r.species, group: r.group}))"
TILE = "(sel) => [...document.querySelectorAll(sel)].map(b => ({v: b.dataset.val || b.dataset.wzb || b.dataset.wzl || b.dataset.wzz || b.dataset.avk || b.dataset.mlbot || '', on: b.getAttribute('aria-pressed') === 'true', off: b.getAttribute('aria-disabled') === 'true', i: (b.querySelector('.ic') || {dataset: {}}).dataset.i || '', cnt: (b.querySelector('.cnt') || {}).textContent || '', t: b.innerText.replace(/\\n/g, ' ')}))"
PAIR = """([sid, mode]) => { const Q = window.ALYSSA_QA, R = Q.rigs().filter(r => r.sys === sid);
  for (const a of R) for (const b of R) { if (a === b) continue; const w = Q.mergeWhy(a, b);
    if (mode === 'ok' && a.time === 'gunduz' && b.time === 'gece' && a.klass === b.klass && !w) return [a.id, b.id];
    if (mode === 'bad' && /Farklı av/.test(w)) return [a.id, b.id]; }
  return null; }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        ctx, pg, errs = await new_ctx(b)
        async def slow_depth(route):   # derinlik servisi yavaş: konum kartında ve haritada "Bekleyiniz" görünsün
            await asyncio.sleep(1.2); return await mock_geo(route)
        await ctx.route('https://rest.emodnet-bathymetry.eu/**', slow_depth)
        await pg.goto(BASE + '/pub/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="bos"]'); await pg.wait_for_timeout(500)
        # ---- Daha menüsü: her satırda ikon
        await pg.click('.tabbar button[data-v="daha"]'); await pg.wait_for_timeout(250)
        r = await pg.evaluate("() => { const bs = [...document.querySelectorAll('#moreMenu button.mrow')]; return {n: bs.length, names: bs.map(b => (b.querySelector('.ic[data-i] svg') || {}).parentNode ? b.querySelector('.ic').dataset.i : '')}; }")
        print('   Daha ikonları:', r['names'])
        check(r['n'] >= 6 and all(r['names']) and len(set(r['names'])) >= 6, 'AN: Daha menüsünde her satırda ikon (%d satır)' % r['n'])
        await pg.locator('#moreMenu').screenshot(path=SHOTS + '/an_daha.png')
        await add_loc(pg, 'Mordoğan Açıkları', '38.20', '26.75')
        await add_loc(pg, 'Şehitlik İskelesi kıyı', '38.61', '26.91')
        st = await pg.evaluate('JSON.parse(localStorage.getItem("awf-v1"))')
        ids = {v['name']: k for k, v in st['locations'].items()}; D, K = ids['Mordoğan Açıkları'], ids['Şehitlik İskelesi kıyı']
        await pg.evaluate("(id) => { const L = window.ALYSSA_QA.state().locations[id]; L.depth = ''; L.bottom = ''; ['depthAuto', 'bottomAuto', 'bottomEst', 'bottomEstTxt'].forEach(k => delete L[k]); }", D)
        inv0 = await pg.evaluate("JSON.stringify(window.ALYSSA_QA.state().inv)")
        # ---- diğer sayfalarda da ikonlar: Envanter kategorileri, Konumlar listesi
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.wait_for_timeout(250)
        ii = await pg.eval_on_selector_all('#invSeg button[data-iseg]', 'els => els.map(e => (e.querySelector(".ic") || {dataset: {}}).dataset.i || "")')
        check(len(ii) == 7 and all(ii), 'AN: Envanter kategorilerinde ikon (%s)' % ii)
        await pg.locator('#invSeg').screenshot(path=SHOTS + '/an_envanter_seg.png')
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(250)
        ki = await pg.eval_on_selector_all('#sheet .item > .row > .ic', 'els => els.map(e => e.dataset.i)')
        check(sorted(ki) == ['boat', 'shore'], 'AN: Konumlar listesinde tekne / kıyı ikonu (%s)' % ki)
        await pg.locator('#sheet').screenshot(path=SHOTS + '/an_konumlar.png')
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(250)
        # ---- Kenny'nin durumu: seçili deniz noktası, üstte kıyı modu açık; dibi bulunamayan nokta
        await add_loc(pg, 'Dipsiz açık', '38.275', '26.625')   # EUSeaMap yanıt vermiyor
        st = await pg.evaluate('JSON.parse(localStorage.getItem("awf-v1"))'); X = [k for k, v in st['locations'].items() if v['name'] == 'Dipsiz açık'][0]
        await pg.evaluate("(id) => { const S = window.ALYSSA_QA.state(); S.active = id; S.mode = 'kiyi'; }", X)
        await wz_open(pg)
        sh0 = await pg.inner_text('#sheet')
        await pg.click('#sheet button.wzloccard'); await pg.wait_for_timeout(2200)
        check('Kıyı modu: karadan av' in sh0, 'AN: kıyı modundaki deniz noktası: sihirbaz kıyı diyor')
        kp = await pg.eval_on_selector_all('#modal button[data-mlkind][aria-pressed="true"]', 'els => els.map(e => e.dataset.mlkind)')
        check(kp == ['kiyi'], 'AN: kartta da Karadan av seçili (%s)' % kp)
        await pg.click('#modal button[data-mlkind="deniz"]'); await pg.wait_for_timeout(250)
        await pg.click('#modal .mtop button.x'); await pg.wait_for_timeout(300)
        sh1 = await pg.inner_text('#sheet'); st1 = await pg.evaluate("(id) => [window.ALYSSA_QA.state().mode, window.ALYSSA_QA.state().locations[id].kind]", X)
        check('Deniz noktası: denizden av (tekne)' in sh1 and st1 == ['tekne', 'deniz'], 'AN: kartta “Denizden av” seçilince sihirbaz da tekneye döndü (%s)' % st1)
        tX = await pg.inner_text('#sheet button.wzloccard')
        check('dip ekle' not in tX and 'bilmiyorum' in tX, 'AN: dibi bulunamayan noktada “dip ekle” denmiyor: ' + tX.replace('\n', ' | '))
        await close_all(pg)
        await pg.evaluate("([id, k]) => { const S = window.ALYSSA_QA.state(); delete S.locations[id]; S.active = k; S.mode = 'tekne'; }", [X, K])
        # ---- Rig Atölyesi 1. adım: seçili noktanın kartı açılır (X ile kapanır, sihirbaza döner)
        await wz_open(pg)
        await pg.click('#sheet button[data-wzloc="%s"]' % D); await pg.wait_for_timeout(250)
        t0 = await pg.inner_text('#sheet button.wzloccard')
        check('derinlik yazılmamış' in t0 and 'dip bilinmiyor' in t0 and 'Dokun' in t0, 'AN: seçili noktanın eksikleri yazıyor, dokun diyor: ' + t0.replace('\n', ' | '))
        await pg.click('#sheet button.wzloccard')
        m0 = await pg.evaluate("document.querySelector('#modal').innerText")
        check(await pg.is_visible('#modal .mcard') and await pg.locator('#modal .mtop button.x[data-mclose]').count() == 1 and 'Geri' not in m0, 'AN: noktanın kartı açıldı, üstte X (Geri yok)')
        check('Bekleyiniz' in m0 and await pg.locator('#modal .waitline .spin').count() >= 1, 'AN: derinlik aranırken bekleyiniz ve dönen işaret')
        await pg.wait_for_timeout(2000)
        L = await LOC(pg, D); m1 = await pg.inner_text('#modal')
        check(L.get('depth') == '54' and L.get('depthAuto') and L.get('bottom') == 'kum' and L.get('bottomAuto'), 'AN: derinlik ve dip sormadan yazıldı (%s m, %s)' % (L.get('depth'), L.get('bottom')))
        check(await pg.input_value('#modal input[data-f="depth"]') == '54' and 'EMODnet, tahmini' in m1 and 'EUSeaMap' in m1 and 'Bekleyiniz' not in m1, 'AN: kartta tahmini işaretleri; bekleme bitti')
        bots = await pg.evaluate(TILE, '#modal button[data-mlbot]')
        check([x['v'].split('|')[1] for x in bots if x['on']] == ['kum'] and bots[-2]['v'].endswith('|karma') and bots[-1]['t'] == 'Bilmiyorum' and all(x['i'] for x in bots),
              'AN: dip kutuları ikonlu, Kum seçili, Karma sonda: %s' % [x['v'].split('|')[1] + ':' + x['i'] for x in bots])
        kinds = await pg.evaluate(TILE, '#modal button[data-mlkind]')
        print('   avlanma:', [(x['t'], x['on'], x['off']) for x in kinds])
        check([x['off'] for x in kinds] == [False, True] and 'Denizden av' in kinds[0]['t'] and 'tekne' in kinds[0]['t'] and 'Karadan av' in kinds[1]['t'] and kinds[0]['on'],
              'AN: “Denizden av / Karadan av”; kıyıdan uzak noktada Karadan kapalı')
        await pg.click('#modal button[data-mlkind="kiyi"]', force=True); await pg.wait_for_timeout(250)
        t = await toast_txt(pg)
        check('karadan avlanılmaz' in t and (await LOC(pg, D))['kind'] == 'deniz', 'AN: kapalı seçimin nedeni acemi diliyle: ' + t)
        await pg.click('#modal button[data-mlbot="%s|kayalik"]' % D); await pg.wait_for_timeout(250)
        L = await LOC(pg, D)
        check(L['bottom'] == 'kayalik' and not L.get('bottomAuto'), 'AN: dip elle Kayalık; tahmini işareti kalktı')
        await pg.fill('#modal input[data-f="depth"]', '35'); await pg.press('#modal input[data-f="depth"]', 'Tab'); await pg.wait_for_timeout(300)
        L = await LOC(pg, D)
        check(L['depth'] == '35' and not L.get('depthAuto'), 'AN: derinlik elle 35 m; tahmini işareti kalktı')
        await pg.locator('#modal .mcard').screenshot(path=SHOTS + '/an_konumkarti.png')
        await pg.click('#modal .mtop button.x'); await pg.wait_for_timeout(300)
        t1 = await pg.inner_text('#sheet button.wzloccard')
        check(await pg.is_hidden('#modal') and await pg.inner_text('#sheetTitle') == 'Rig Atölyesi' and 'derinlik 35 m' in t1 and 'kayalık' in t1 and 'Dokun' in t1,
              'AN: X ile kapandı, sihirbazın 1. adımında yeni bilgiler: ' + t1.replace('\n', ' | '))
        await pg.click('#sheet button.wzloccard'); await pg.wait_for_timeout(200)
        await pg.evaluate("document.getElementById('modal').click()"); await pg.wait_for_timeout(200)
        check(await pg.is_hidden('#modal') and await pg.is_visible('#sheet button.wzloccard'), 'AN: kartın dışına dokununca da kapanır, sihirbaz yerinde')
        # "Bilmiyorum" denen dip yeniden kendiliğinden yazılmaz; sihirbazda Karma kalır
        await pg.click('#sheet button.wzloccard'); await pg.wait_for_timeout(200)
        await pg.click('#modal button[data-mlbot="%s|"]' % D); await pg.wait_for_timeout(250)
        await pg.click('#modal .mtop button.x'); await pg.wait_for_timeout(250)
        bz = await pg.evaluate('window.ALYSSA_QA.wz().ans.bottoms')
        await pg.click('#sheet button.wzloccard'); await pg.wait_for_timeout(1800)
        L = await LOC(pg, D)
        check(L['bottom'] == '' and L.get('bottomNo') and not L.get('bottomAuto') and bz == ['karma'], 'AN: “Bilmiyorum” denen dip yeniden yazılmıyor, sihirbazda Karma (%s)' % bz)
        await pg.click('#modal button[data-mlbot="%s|kayalik"]' % D); await pg.wait_for_timeout(200)
        await pg.click('#modal .mtop button.x'); await pg.wait_for_timeout(250)
        L = await LOC(pg, D)
        check(L['bottom'] == 'kayalik' and not L.get('bottomNo') and await pg.evaluate('window.ALYSSA_QA.wz().ans.bottoms') == ['kayalik'], 'AN: dip yeniden Kayalık')
        # geri tuşu (Android): önce açılır kart kapanır, sihirbaz kalır; ikinci geri sihirbazı kapatır
        await pg.click('#sheet button.wzloccard'); await pg.wait_for_timeout(250)
        await pg.go_back(); await pg.wait_for_timeout(350)
        check(await pg.is_hidden('#modal') and await pg.is_visible('#sheet button.wzloccard'), 'AN: geri tuşu önce noktanın kartını kapattı, sihirbaz yerinde')
        # ---- 2–4. adımlar: ikonlu teknik ve tür seçenekleri
        await nxt(pg)
        await pg.click('#sheet button[data-wzt="dip"]'); await pg.wait_for_timeout(150)
        tic = await pg.evaluate(TILE, '#sheet button[data-wzt]')
        check(tic and all(x['i'] for x in tic), 'AN: teknik seçeneklerinde ikon (%s)' % [x['i'] for x in tic])
        await nxt(pg)
        fams = await pg.evaluate("() => [...document.querySelectorAll('#sheet .famgrp')].map(g => ({fam: g.querySelector('[data-wzall]').dataset.wzall, ic: !!g.querySelector('.famh .ic[data-i]'), sp: [...g.querySelectorAll('button[data-wzs]')].map(b => b.dataset.wzs)}))")
        print('   tür grupları:', [(f['fam'], len(f['sp'])) for f in fams])
        sks = [s for f in fams if f['fam'] in ('sk', 'so') for s in f['sp']]
        other = [f for f in fams if f['fam'] not in ('sk', 'so') and f['sp']]
        pick = sks[:2] + ([other[0]['sp'][0]] if other else [])
        for s in pick: await pg.click('#sheet button[data-wzs="%s"]' % s); await pg.wait_for_timeout(80)
        check(len(pick) == 3 and all(f['ic'] for f in fams), 'AN: tür gruplarının başında ikon; iki küçük ağızlı ve başka aileden bir tür seçildi (%s)' % pick)
        await nxt(pg); await nxt(pg)
        # ---- 5. adım (Takım): rig sayıları, güneş/ay, Karma sonda, keşif sorusu
        sh = await pg.inner_text('#sheet')
        lays = await pg.evaluate(TILE, '#sheet button[data-wzl]')
        print('   takım düzenleri:', [(x['v'], x['on'], x['cnt'], x['i']) for x in lays])
        check(lays and all(x['i'] and x['cnt'] for x in lays) and any(x['on'] for x in lays), 'AN: her takım düzeninde ikon ve rig sayısı')
        check(all(re.match(r'^\+\d+ rig$', x['cnt']) for x in lays if not x['on']) and all(re.match(r'^\d+ rig$', x['cnt']) for x in lays if x['on']), 'AN: seçilende kaç rig, seçilmeyende kaç rig ekleneceği yazıyor')
        ti = await pg.evaluate(TILE, '#sheet button[data-wzset="time"]')
        check([(x['v'], x['i']) for x in ti] == [('gunduz', 'sun'), ('gece', 'moon'), ('ikisi', 'sunmoon')] and all(x['cnt'].endswith(' rig') for x in ti), 'AN: Gündüz güneş, Gece ay, İkisi de güneş/ay; her birinde rig sayısı (%s)' % [x['cnt'] for x in ti])
        kl = await pg.evaluate(TILE, '#sheet button[data-wzset="klass"]')
        check(len(kl) == 3 and all(x['i'] and x['cnt'].endswith(' rig') for x in kl), 'AN: balık boyunda ikon ve rig sayısı (%s)' % [x['cnt'] for x in kl])
        bo = await pg.evaluate(TILE, '#sheet button[data-wzb]')
        check([x['v'] for x in bo] == ['kum', 'kum-kayalik', 'kayalik', 'camur', 'karma'] and [x['v'] for x in bo if x['on']] == ['kayalik'] and all(x['i'] for x in bo),
              'AN: dipler ikonlu, Karma sonda; noktanın dibi (Kayalık) seçili')
        check('Keşif rigi kurmak ister misin?' in sh and 'keşif rigleri de kurulur' not in sh, 'AN: keşif rigi soruluyor')
        kz = await pg.evaluate(TILE, '#sheet button[data-wzset="kesif"]')
        check([(x['v'], x['on']) for x in kz] == [('1', False), ('0', True)] and all(x['cnt'] for x in kz), 'AN: keşif varsayılanı Hayır; iki seçenekte de rig sayısı (%s)' % [x['cnt'] for x in kz])
        n_no = int(re.search(r'(\d+) rig kurulacak', sh).group(1))
        await pg.click('#sheet button[data-wzset="kesif"][data-val="1"]'); await pg.wait_for_timeout(250)
        n_yes = int(re.search(r'(\d+) rig kurulacak', await pg.inner_text('#sheet')).group(1))
        check(n_yes > n_no, 'AN: keşif istenince rig sayısı arttı (%d → %d)' % (n_no, n_yes))
        await tall(pg, 2600, SHOTS + '/an_takim.png', '#sheet')
        await pg.set_viewport_size({'width': 320, 'height': 860}); await pg.wait_for_timeout(200); await overflow(pg, 'AN takım 320'); await pg.set_viewport_size({'width': 390, 'height': 860})
        await pg.click('#sheet button[data-wzset="kesif"][data-val="0"]'); await pg.wait_for_timeout(200)
        # ---- 6. adım (Kur): kamış ağırlığı sorulmaz; ad en altta renkli kartta; ad yazılmadan kurulmaz
        await nxt(pg)
        sh = await pg.inner_text('#sheet')
        check(await pg.locator('#wz-rod').count() == 0 and 'atış ağırlığı kaç' not in sh and 'Kamışın sınırı' not in sh, 'AN: kamışın atış ağırlığı sorulmuyor')
        r = await pg.evaluate("() => { const w = document.querySelector('#sheet .wz'); const kids = [...w.children].filter(e => !e.hidden); const nc = w.querySelector('.namecard'); return {last: kids[kids.length - 1] === nc, bg: getComputedStyle(nc).backgroundImage, ic: !!nc.querySelector('.ic[data-i]')}; }")
        check(r['last'] and 'gradient' in r['bg'] and r['ic'], 'AN: sistemin adı en altta, renkli (pastel) kartta')
        check(await pg.is_disabled('#sheet button[data-wz="done"]'), 'AN: ad yazılmadan “Sistemi kur” kapalı')
        await pg.fill('#wz-name', '   '); await pg.wait_for_timeout(100)
        check(await pg.is_disabled('#sheet button[data-wz="done"]'), 'AN: yalnız boşlukla da kapalı')
        await pg.fill('#wz-name', 'Dip sistemim'); await pg.wait_for_timeout(150)
        check(not await pg.is_disabled('#sheet button[data-wz="done"]'), 'AN: ad yazılınca açıldı')
        sz = await pg.evaluate(TILE, '#sheet button[data-wzz]')
        check(len(sz) == 3 and all(x['i'] and x['cnt'].endswith(' rig') for x in sz), 'AN: Sade/Dengeli/Tam ikonlu, rig sayılı (%s)' % [x['cnt'] for x in sz])
        await tall(pg, 1500, SHOTS + '/an_kur.png', '#sheet')
        await pg.click('#sheet button[data-wz="done"]'); await pg.wait_for_timeout(800)
        st = await pg.evaluate("window.ALYSSA_QA.state()")
        sysd = [s for s in st['systems'].values() if s.get('name') == 'Dip sistemim']
        check(len(sysd) == 1 and len(sysd[0]['rigs']) == n_no and not any('Keşif' in x['name'] for x in sysd[0]['rigs']), 'AN: sistem kuruldu; keşif istenmedi, keşif rigi yok (%d rig)' % (len(sysd[0]['rigs']) if sysd else -1))
        SID = sysd[0]['id']
        # ---- Rigler: kart görünümü, ikonlar, sil, seç ve birleştir
        await close_all(pg); await rigs_all(pg)
        cards = await pg.evaluate("""() => { const a = [...document.querySelectorAll('#rigList article.rig')]; const r0 = a[0].getBoundingClientRect(), r1 = a[1].getBoundingClientRect();
          return {n: a.length, sh: getComputedStyle(a[0]).boxShadow, gap: Math.round(r1.top - r0.bottom), rad: getComputedStyle(a[0]).borderTopLeftRadius,
            head: a.every(x => x.querySelector('.rig-h .ic[data-i]')), del: a.filter(x => x.querySelector('button.rigdel[aria-label="Bu rigi sil"]')).length,
            rows: [...new Set([...document.querySelectorAll('#rigList .crow .k .ic')].map(i => i.dataset.i))]}; }""")
        print('   rig kartları:', cards)
        check(cards['sh'] != 'none' and cards['gap'] >= 12 and cards['rad'] == '16px', 'AN: rig kartları ayrı duruyor: gölge, %d px ara, yuvarlak köşe' % cards['gap'])
        check(cards['head'] and cards['del'] == cards['n'], 'AN: her kartın başında tekniğin ikonu ve “Bu rigi sil” düğmesi')
        check(all(x in cards['rows'] for x in ('hook', 'line', 'rod', 'reel')), 'AN: satırlarda iğne, ip, kamış, makine ikonları (%s)' % cards['rows'])
        await pg.locator('#rigList article.rig').first.screenshot(path=SHOTS + '/an_rigkarti.png')
        rg = await pg.evaluate(QRIGS); n0 = len(rg)
        bad = await pg.evaluate(PAIR, [SID, 'bad']); okp = await pg.evaluate(PAIR, [SID, 'ok'])
        check(bad and okp, 'AN: birleşir (gündüz+gece) ve birleşmez (farklı av) rig çiftleri var')
        victim = [x for x in rg if x['sys'] == SID and x['id'] not in (bad or []) + (okp or [])][-1]
        btn = pg.locator('#rigList button.rigdel[data-rigdel="%s"]' % victim['id'])
        await btn.click(); await pg.wait_for_timeout(150)
        check((await btn.inner_text()).strip() == 'Sil?' and len(await pg.evaluate(QRIGS)) == n0, 'AN: sil düğmesi önce “Sil?” diye soruyor')
        await btn.click(); await pg.wait_for_timeout(400)
        rg2 = await pg.evaluate(QRIGS); t = await toast_txt(pg)
        check(len(rg2) == n0 - 1 and not any(x['id'] == victim['id'] for x in rg2) and 'silindi' in t, 'AN: rig silindi (%s)' % t)
        await pg.click('#sysTools button[data-act="rigSelect"]'); await pg.wait_for_timeout(250)
        check(await pg.locator('#rigList button.rigpick').count() == len(rg2) and await pg.locator('#rigList button.rigdel').count() == 0, 'AN: seç kipinde her kartta seçim kutusu (sil düğmesi gizli)')
        check(await pg.is_disabled('#rigList .selbar button[data-rigact="merge"]') and await pg.is_disabled('#rigList .selbar button[data-rigact="del"]'), 'AN: seçim yokken Birleştir ve Sil kapalı')
        for i in bad: await pg.click('#rigList button.rigpick[data-rigpick="%s"]' % i); await pg.wait_for_timeout(150)
        check('2 rig seçildi' in await pg.inner_text('#rigList .selbar') and not await pg.is_disabled('#rigList .selbar button[data-rigact="merge"]'), 'AN: 2 rig seçildi, Birleştir açık')
        await pg.click('#rigList .selbar button[data-rigact="merge"]'); await pg.wait_for_timeout(300)
        mt = await pg.inner_text('#modal')
        check(await pg.is_visible('#modal') and 'Bu rigler birleşemez' in mt and 'Farklı av' in mt and len(await pg.evaluate(QRIGS)) == len(rg2), 'AN: farklı av rigleri birleşemez, rigler yerinde: ' + mt.replace('\n', ' | ')[:180])
        await pg.locator('#modal .mcard').screenshot(path=SHOTS + '/an_birlesemez.png')
        await pg.click('#modal .mtop button.x'); await pg.wait_for_timeout(200)
        for i in bad: await pg.click('#rigList button.rigpick[data-rigpick="%s"]' % i); await pg.wait_for_timeout(120)
        for i in okp: await pg.click('#rigList button.rigpick[data-rigpick="%s"]' % i); await pg.wait_for_timeout(120)
        await pg.screenshot(path=SHOTS + '/an_sec.png')
        await pg.set_viewport_size({'width': 320, 'height': 860}); await pg.wait_for_timeout(200); await overflow(pg, 'AN seç 320'); await pg.set_viewport_size({'width': 390, 'height': 860})
        await pg.click('#rigList .selbar button[data-rigact="merge"]'); await pg.wait_for_timeout(500)
        t = await toast_txt(pg); rg3 = await pg.evaluate(QRIGS)
        mg = await pg.evaluate("(id) => { const r = window.ALYSSA_QA.rigsById()[id]; return r ? {time: r.time, group: r.group, code: r.code, notes: (r.notes || []).map(n => n.k), name: r.name, sp: r.species.length} : null; }", okp[0])
        print('   birleşen:', mg)
        check(len(rg3) == len(rg2) - 1 and mg and mg['time'] == 'her' and mg['group'].endswith('H') and mg['code'].startswith('H-') and 'Birleştirildi' in mg['notes'] and not any(x['id'] == okp[1] for x in rg3) and 'Birleştirildi' in t,
              'AN: gündüz ve gece rigi tek rige birleşti (%s)' % t)
        check(await pg.locator('#rigList button.rigpick').count() == 0 and await pg.locator('#rigList .selbar').count() == 0, 'AN: birleştirince seç kipi kapandı')
        await pg.click('#sysTools button[data-act="rigSelect"]'); await pg.wait_for_timeout(200)
        two = [x['id'] for x in rg3 if x['sys'] == SID][:2]
        for i in two: await pg.click('#rigList button.rigpick[data-rigpick="%s"]' % i); await pg.wait_for_timeout(120)
        await pg.click('#rigList .selbar button[data-rigact="del"]'); await pg.wait_for_timeout(150)
        check(len(await pg.evaluate(QRIGS)) == len(rg3), 'AN: toplu silmede önce onay isteniyor')
        await pg.click('#rigList .selbar button[data-rigact="del"]'); await pg.wait_for_timeout(400)
        check(len(await pg.evaluate(QRIGS)) == len(rg3) - 2 and '2 rig silindi' in await toast_txt(pg), 'AN: seçilen 2 rig silindi')
        check(await pg.evaluate("JSON.stringify(window.ALYSSA_QA.state().inv)") == inv0, 'AN: sil ve birleştir envantere dokunmadı')
        # ---- hırsızlı surf takımı (kıyı noktası, dibi bilinmiyor → Karma seçili)
        await wz_open(pg)
        await pg.click('#sheet button[data-wzloc="%s"]' % K); await pg.wait_for_timeout(250)
        await nxt(pg); await pg.click('#sheet button[data-wzt="surf"]'); await pg.wait_for_timeout(120); await nxt(pg)
        await pg.click('#sheet button[data-wzsx]'); await pg.wait_for_timeout(150); await nxt(pg); await nxt(pg)
        lays = await pg.evaluate(TILE, '#sheet button[data-wzl^="surf|"]')
        print('   surf düzenleri:', [(x['v'], x['on'], x['cnt']) for x in lays])
        sh_ = [x for x in lays if x['v'] == 'surf|surfhirsiz']
        check(sh_ and 'Hırsızlı surf takımı' in sh_[0]['t'] and re.match(r'^\+\d+ rig$', sh_[0]['cnt']), 'AN: surf için hırsızlı takım seçeneği, eklenecek rig sayısıyla')
        bo = await pg.evaluate(TILE, '#sheet button[data-wzb]')
        check(bo[-1]['v'] == 'karma' and [x['v'] for x in bo if x['on']] == ['karma'], 'AN: dibi bilinmeyen noktada Karma sonda ve seçili')
        check('Keşif' not in await pg.inner_text('#sheet'), 'AN: dip tekniği yokken keşif sorusu yok')
        await pg.click('#sheet button[data-wzl="surf|surfhirsiz"]'); await pg.wait_for_timeout(250)
        await nxt(pg); await pg.fill('#wz-name', 'Surf sistemim'); await pg.click('#sheet button[data-wz="done"]'); await pg.wait_for_timeout(800)
        rs = [x for x in await pg.evaluate(QRIGS) if x['lay'] == 'surfhirsiz']
        check(len(rs) >= 1, 'AN: hırsızlı surf rigleri kuruldu (%d)' % len(rs))
        await close_all(pg)
        await pg.evaluate("(id) => window.ALYSSA_QA.openPrep(id)", rs[0]['id']); await pg.wait_for_timeout(600)
        pt = await pg.inner_text('#sheet')
        check('Hırsız' in pt and 'şok lider' in pt.lower() and await pg.locator('#sheet svg').count() >= 1, 'AN: hırsızlı surf rigi: şema ve hazırlık adımları')
        await tall(pg, 1800, SHOTS + '/an_surfhirsiz.png', '#sheet')
        # ---- harita: katmanların hepsi açık; bekleyiniz; ad kartında "Denizden av / Karadan av"
        await close_all(pg)
        await pg.click('#locBtn'); await pg.click('#sheet .mapbanner'); await pg.wait_for_selector('#map.leaflet-container', timeout=10000); await pg.wait_for_timeout(500)
        await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(200)
        lay = await pg.eval_on_selector_all('#mapLayers input[data-maplayer]', 'els => els.map(e => e.dataset.maplayer + (e.checked ? "*" : ""))')
        check(len(lay) >= 6 and all(x.endswith('*') for x in lay), 'AN: harita katmanlarının hepsi açık (%s)' % lay)
        await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(150)
        await pg.evaluate('() => { window.ALYSSA_QA.pickPoint(38.31, 26.71); }'); await pg.wait_for_timeout(150)   # beklemeden (sonucu beklenmez)
        check(await pg.locator('#mapCard .waitline .spin').count() == 1 and 'Bekleyiniz' in await pg.inner_text('#mapCard'), 'AN: nokta incelenirken “Bekleyiniz” ve dönen işaret')
        await pg.screenshot(path=SHOTS + '/an_harita_bekle.png')
        await pg.wait_for_timeout(3800)
        check(await pg.locator('#mapCard .waitline').count() == 0, 'AN: bilgiler gelince bekleme yazısı kalktı')
        await pg.click('#mapCard button[data-mapact="save"]'); await pg.wait_for_timeout(250)
        av = await pg.evaluate(TILE, '#mpAvk button[data-avk]'); nt = await pg.inner_text('#mapCard')
        print('   ad kartı:', [(x['v'], x['on'], x['off'], x['t']) for x in av])
        check([(x['v'], x['on'], x['off']) for x in av] == [('deniz', True, False), ('kiyi', False, True)] and 'Denizden av' in av[0]['t'] and 'tekne' in av[0]['t'] and 'Karadan av' in av[1]['t'],
              'AN: ad kartında Denizden av (tekne) seçili; kıyıdan uzak noktada Karadan av kapalı')
        check('kıyı mı' not in nt.lower() and 'deniz mi' not in nt.lower() and 'Nereden avlanacaksın?' in nt, 'AN: acemiye “kıyı mı deniz mi” diye sorulmuyor')
        await pg.click('#mpAvk button[data-avk="kiyi"]', force=True); await pg.wait_for_timeout(200)
        check('karadan avlanılmaz' in await toast_txt(pg), 'AN: kapalı seçimin nedeni yazıyor')
        await pg.screenshot(path=SHOTS + '/an_adkarti.png')
        await pg.fill('#mpName', 'Açık nokta'); await pg.click('#mapCard button[data-named]'); await pg.wait_for_timeout(600)
        st = await pg.evaluate("window.ALYSSA_QA.state()"); L = [v for v in st['locations'].values() if v['name'] == 'Açık nokta']
        check(L and L[0].get('kind') == 'deniz' and L[0].get('bottom') == 'kum' and L[0].get('bottomAuto'), 'AN: deniz noktası kaydedildi, dip sormadan yazıldı (%s)' % (L and {k: L[0].get(k) for k in ('kind', 'bottom', 'bottomAuto', 'depth')}))
        await pg.evaluate('window.ALYSSA_QA.pickPoint(38.705, 26.955)'); await pg.wait_for_timeout(2800)
        await pg.click('#mapCard button[data-mapact="save"]'); await pg.wait_for_timeout(250)
        av = await pg.evaluate(TILE, '#mpAvk button[data-avk]')
        check([(x['v'], x['on'], x['off']) for x in av] == [('deniz', True, False), ('kiyi', False, False)], 'AN: kıyıya yakın deniz noktasında ikisi de seçilebilir (%s)' % [(x['v'], x['on'], x['off']) for x in av])
        await pg.click('#mpAvk button[data-avk="kiyi"]'); await pg.wait_for_timeout(150)
        check(await pg.get_attribute('#mpAvk button[data-avk="kiyi"]', 'aria-pressed') == 'true' and await pg.input_value('#mpName') is not None, 'AN: Karadan av seçildi (ad kutusu yerinde)')
        await pg.fill('#mpName', 'Mendirek ucu'); await pg.click('#mapCard button[data-named]'); await pg.wait_for_timeout(600)
        st = await pg.evaluate("window.ALYSSA_QA.state()"); L = [v for v in st['locations'].values() if v['name'] == 'Mendirek ucu']
        check(L and L[0].get('kind') == 'kiyi' and L[0].get('kindAuto') is False, 'AN: “Karadan av” seçilen nokta kıyı noktası olarak kaydedildi')
        await pg.evaluate('window.ALYSSA_QA.pickPoint(38.605, 26.905)'); await pg.wait_for_timeout(2800)
        await pg.click('#mapCard button[data-mapact="save"]'); await pg.wait_for_timeout(250)
        av = await pg.evaluate(TILE, '#mpAvk button[data-avk]')
        check([(x['v'], x['on'], x['off']) for x in av] == [('deniz', False, True), ('kiyi', True, False), ('kara', False, False)] and 'Yalnız hava' in av[2]['t'],
              'AN: kıyı noktasında Denizden av kapalı, Karadan av seçili, Yalnız hava da var')
        await pg.click('#mpAvk button[data-avk="deniz"]', force=True); await pg.wait_for_timeout(200)
        check('tekneyle (denizden) avlanılmaz' in await toast_txt(pg), 'AN: kıyı noktasında tekneyle avlanılmaz diyor')
        await pg.click('#mapCard button[data-mapact="namecancel"]'); await pg.wait_for_timeout(300)
        # ---- karanlık tema: ikonlar, kart ve ad kartı
        await close_all(pg)
        await pg.emulate_media(color_scheme='dark'); await pg.wait_for_timeout(200)
        await rigs_all(pg); await pg.locator('#rigList article.rig').first.screenshot(path=SHOTS + '/an_rigkarti_koyu.png')
        await wz_open(pg); await pg.click('#sheet button[data-wzloc="%s"]' % D); await pg.wait_for_timeout(200)
        await pg.click('#sheet button.wzloccard'); await pg.wait_for_timeout(400); await pg.screenshot(path=SHOTS + '/an_konumkarti_koyu.png')
        await pg.click('#modal .mtop button.x'); await pg.wait_for_timeout(200)
        await nxt(pg); await pg.click('#sheet button[data-wzt="dip"]'); await pg.wait_for_timeout(120); await nxt(pg)
        await pg.click('#sheet button[data-wzsx]'); await pg.wait_for_timeout(150); await nxt(pg); await nxt(pg)
        await tall(pg, 2400, SHOTS + '/an_takim_koyu.png', '#sheet')
        await pg.emulate_media(color_scheme='light')
        print('AN errors:', errs); check(not errs, 'AN: hata yok (genel)')
        await ctx.close()
        # ---- Google: yüklenirken bekleyiniz; Geocoding API kapalıysa kartta ne yapılacağı
        GFAKE = """(function(){ function Map(el, o){ this.el = el; el.setAttribute('data-gmap', o.mapTypeId); }
          Map.prototype.moveCamera = function(c){ this.c = c; }; Map.prototype.setMapTypeId = function(t){ this.el.setAttribute('data-gmap', t); };
          function Geocoder(){}
          Geocoder.prototype.geocode = function(){ var e = new Error('Geocoding Service: The webpage is not allowed to use the geocoder.'); e.code = 'REQUEST_DENIED'; return Promise.reject(e); };
          window.google = {maps: {Map: Map, Geocoder: Geocoder}};
          var cb = new URL(document.currentScript.src).searchParams.get('callback'); setTimeout(function(){ window[cb] && window[cb](); }, 5); })();"""
        async def slow_gmaps(route):
            await asyncio.sleep(1.5)
            return await route.fulfill(status=200, content_type='application/javascript', body=GFAKE, headers=CORS)
        ctx, pg, errs = await new_ctx(b)
        await ctx.route('https://maps.googleapis.com/**', slow_gmaps)
        await pg.goto(BASE + '/pub/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="bos"]'); await pg.wait_for_timeout(500)
        await add_loc(pg, 'Mordoğan Açıkları', '38.20', '26.75')
        await pg.evaluate("() => { window.ALYSSA_QA.state().settings.gkey = 'AIza-test-anahtar'; }")   # konum eklendikten sonra: Google ilk kez haritada yüklensin
        await pg.click('#locBtn'); await pg.click('#sheet .mapbanner'); await pg.wait_for_selector('#map.leaflet-container', timeout=10000); await pg.wait_for_timeout(400)
        await pg.click('button[data-mapact="layers"]'); await pg.wait_for_timeout(200)
        await pg.click('#mapLayers button[data-mapbase="g"]'); await pg.wait_for_timeout(300)
        mm = await pg.inner_text('#mapMsg')
        check('bekleyiniz' in mm and await pg.locator('#mapMsg .spin').count() == 1, 'AN: Google haritası yüklenirken bekleyiniz ve dönen işaret: ' + mm)
        await pg.screenshot(path=SHOTS + '/an_google_bekle.png')
        await pg.wait_for_timeout(2200)
        check(await pg.is_hidden('#mapMsg') and await pg.locator('#map.hasg').count() == 1, 'AN: Google yüklendi, bekleme yazısı kalktı')
        await pg.evaluate('window.ALYSSA_QA.pickPoint(38.25, 26.80)'); await pg.wait_for_timeout(2600)
        card = await pg.inner_text('#mapCard'); cardT = await pg.evaluate('document.querySelector("#mapCard").textContent')
        print('   Google kartı:', cardT[:300])
        check('Google’dan yer adı alınamadı' in card and 'Geocoding API' in cardT and 'Enable' in cardT and 'REQUEST_DENIED' not in card, 'AN: Geocoding API kapalı: kısa not, “Neden?”de ne yapılacağı')
        rs = await pg.evaluate("[window.ALYSSA_QA.gReason('REQUEST_DENIED The webpage is not allowed to use the geocoder.'), window.ALYSSA_QA.gReason('This API project is not authorized to use this API.'), window.ALYSSA_QA.gReason('ApiTargetBlockedMapError')]")
        check('Geocoding API' in rs[0] and 'Enable' in rs[0] and 'API restrictions' in rs[0] and 'Library' in rs[1] and 'API restrictions' in rs[2], 'AN: Google hata açıklamaları (%s)' % rs)
        print('AN Google errors:', errs); check(not [e for e in errs if 'Geocoding' not in e], 'AN: hata yok (Google)')
        await ctx.close()
        # ---- özel sürüm (önizleme): paket rigi silinmez, gizlenir ve geri gelir; birleşen paket rigleri Rig Atölyem'e kopya olur
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/preview.html?qa=1'); await pg.wait_for_timeout(1500)
        await rigs_all(pg)
        inv0 = await pg.evaluate("JSON.stringify(window.ALYSSA_QA.state().inv)")
        rg = await pg.evaluate(QRIGS); pk = [x for x in rg if x['sys'] == 'ozel']; n0 = len(rg)
        check(len(pk) >= 4, 'AN özel: paket rigleri listede (%d)' % len(pk))
        btn = pg.locator('#rigList button.rigdel[data-rigdel="%s"]' % pk[0]['id'])
        await btn.click(); await pg.wait_for_timeout(120); await btn.click(); await pg.wait_for_timeout(400)
        rg2 = await pg.evaluate(QRIGS); t = await toast_txt(pg)
        hid = await pg.inner_text('#rigList .hidnote') if await pg.locator('#rigList .hidnote').count() else ''
        check(len(rg2) == n0 - 1 and '1 paket rigi gizli' in hid and 'gizlendi' in t, 'AN özel: paket rigi paketten silinmedi, gizlendi (%s)' % t)
        await pg.click('#rigList .hidnote button[data-act="rigUnhide"]'); await pg.wait_for_timeout(400)
        check(len(await pg.evaluate(QRIGS)) == n0 and await pg.locator('#rigList .hidnote').count() == 0, 'AN özel: gizlenen rig geri geldi')
        okp = await pg.evaluate(PAIR, ['ozel', 'ok'])
        check(okp, 'AN özel: gündüz ve gece paket rig çifti var')
        if okp:
            await pg.click('#sysTools button[data-act="rigSelect"]'); await pg.wait_for_timeout(200)
            for i in okp: await pg.click('#rigList button.rigpick[data-rigpick="%s"]' % i); await pg.wait_for_timeout(120)
            await pg.click('#rigList .selbar button[data-rigact="merge"]'); await pg.wait_for_timeout(600)
            st = await pg.evaluate("window.ALYSSA_QA.state()"); rg3 = await pg.evaluate(QRIGS)
            at = (st['systems'].get('atolye') or {}).get('rigs') or []
            check(len(at) == 1 and at[0]['code'] == 'A-1' and at[0]['time'] == 'her' and all(st['rigHide'].get(i) for i in okp) and len(rg3) == n0 - 1, 'AN özel: paket rigleri Rig Atölyem’de tek rige birleşti; asılları gizlendi')
            check(await pg.evaluate("JSON.stringify(window.ALYSSA_QA.state().inv)") == inv0, 'AN özel: envanter aynı')
            await pg.locator('#rigList article.rig').filter(has_text='A-1').first.screenshot(path=SHOTS + '/an_ozel_birlesik.png')
        print('AN özel errors:', errs); check(not errs, 'AN özel: hata yok')
        await ctx.close(); await b.close()
    srv.terminate()
    print('SONUÇ:', 'HEPSİ GEÇTİ' if not FAIL else '%d HATA' % len(FAIL))
asyncio.run(main())
