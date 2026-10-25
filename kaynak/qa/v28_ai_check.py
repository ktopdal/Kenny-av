"""Alyssa v0.3–v0.22 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
v0.28 takım danışmanı testleri (sahte Claude, Gemini ve OpenAI yanıtlarıyla)
"""
import os, sys
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import fbmock   # sahte Firebase

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_i'
SHOTS = ROOT + '/qa/v28i'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(os.environ.get('ALYSSA_DIST', ROOT + '/app/dist'), WWW + '/dist')   # ALYSSA_DIST: sabitlenmiş bir derlemeyi test etmek için
prev = open(os.environ.get('ALYSSA_PREV', ROOT + '/app/preview/alyssa_onizleme.html'), encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8798
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

# ================================================== AI) v0.28: takım danışmanı (yapay zekâ + internet araması) ve motor (orkinos ağır canlı yem)
AI_LOG = {'claude': [], 'gemini': [], 'openai': []}
JSON_ANS = {
  'ozet': 'Elindeki çıkrık bu iş için uygun; kamışın sınırda. Tetikli, 200–400 g taşıyan kısa bir kamış al.',
  'sorular': ['Canlı yem mi, parça yem mi kullanacaksın?'],
  'eldeki': [{'ad': 'Elindeki çıkrık', 'kategori': 'makine', 'karar': 'uygun', 'neden': 'İki hızlı, 80 lb ip alır'}],
  'oneriler': [
    {'kategori': 'kamis', 'marka': 'Testmarka', 'model': 'Slow 198', 'seviye': 'orta', 'olcu': {'boy_cm': 198, 'max_g': 330, 'pe': '4-5', 'yuva': 'tetiksiz'}, 'neden': 'Parabolik', 'fiyat_tl': '5.400–6.100', 'nerede': 'Test Av Market', 'url': 'https://ornek.test/kamis'},
    {'kategori': 'kamis', 'marka': 'Testmarka', 'model': 'Heavy 180', 'seviye': 'premium', 'olcu': {'boy_cm': 180, 'min_g': 200, 'max_g': 500, 'pe': '5-8', 'yuva': 'tetikli'}, 'neden': 'Ağır yük', 'fiyat_tl': '9.000', 'nerede': 'Test', 'url': ''},
    {'kategori': 'makine', 'marka': 'Testreel', 'model': 'Lever 30', 'seviye': 'premium', 'olcu': {'makine_boy': 30, 'yuva': 'tetikli'}, 'neden': 'İki hızlı çıkrık', 'fiyat_tl': '12.000', 'nerede': '', 'url': ''},
    {'kategori': 'ana_ip', 'marka': 'Testline', 'model': 'X8 80 lb', 'seviye': 'orta', 'olcu': {'pe': '5', 'lb': 80}, 'neden': '8 örgü', 'fiyat_tl': '1.200', 'nerede': '', 'url': ''},
    {'kategori': 'lider', 'marka': 'Testfluoro', 'model': 'FC 120 lb', 'seviye': 'orta', 'olcu': {'mm': 1.05, 'lb': 120}, 'neden': 'Florokarbon lider', 'fiyat_tl': '900', 'nerede': '', 'url': ''},
    {'kategori': 'igne', 'marka': 'Testhook', 'model': 'Live 4/0', 'seviye': 'kolay', 'olcu': {'igne_no': '4/0'}, 'neden': 'Küçük', 'fiyat_tl': '150', 'nerede': '', 'url': ''},
    {'kategori': 'igne', 'marka': 'Testhook', 'model': 'Gorilla 8/0', 'seviye': 'orta', 'olcu': {'igne_no': '8/0'}, 'neden': 'Kalın tel', 'fiyat_tl': '250', 'nerede': '', 'url': ''},
    {'kategori': 'kursun', 'marka': 'Testkursun', 'model': 'Torpido', 'seviye': 'kolay', 'olcu': {'agirlik_g': 300}, 'neden': '', 'fiyat_tl': '100', 'nerede': '', 'url': ''},
    {'kategori': 'aksesuar', 'marka': 'Testbelt', 'model': 'Gimbal kemer', 'seviye': 'orta', 'olcu': {}, 'neden': 'Mücadele kemeri', 'fiyat_tl': '1.500', 'nerede': '', 'url': ''}],
  'uyarilar': ['Çiftlik kafeslerine yaklaşma kurallarına uy.'],
  'kaynaklar': [{'baslik': 'Ornek kaynak', 'url': 'https://ornek.test/kaynak'}]}
def ans_text(extra=''):
    return 'Kısa özet: tetikli kamış al.' + extra + '\n\n```json\n' + json.dumps(JSON_ANS, ensure_ascii=False, indent=1) + '\n```'
HDR = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS'}
async def mock_claude_dan(route):
    req = route.request
    if req.method == 'OPTIONS': return await route.fulfill(status=204, headers=HDR)
    body = json.loads(req.post_data or '{}'); AI_LOG['claude'].append({'h': dict(req.headers), 'b': body})
    if not body.get('tools'): return await route.fallback()
    if req.headers.get('x-api-key') != 'sk-ant-dan-good':
        return await route.fulfill(status=401, headers=HDR, content_type='application/json', body=json.dumps({'type': 'error', 'error': {'type': 'authentication_error', 'message': 'invalid x-api-key'}}))
    second = 'EK BİLGİ' in body['messages'][0]['content']
    content = [{'type': 'server_tool_use', 'id': 'srvtoolu_1', 'name': 'web_search', 'input': {'query': 'orkinos kamışı'}},
        {'type': 'web_search_tool_result', 'tool_use_id': 'srvtoolu_1', 'content': [{'type': 'web_search_result', 'url': 'https://ornek.test/a', 'title': 'Ornek A', 'encrypted_content': 'x'}]},
        {'type': 'text', 'text': 'Kısa özet: ', 'citations': [{'type': 'web_search_result_location', 'url': 'https://ornek.test/a', 'title': 'Ornek A', 'cited_text': 'x'}]},
        {'type': 'text', 'text': ans_text(' (ikinci tur)' if second else '')[len('Kısa özet: '):]}]
    return await route.fulfill(status=200, headers=HDR, content_type='application/json', body=json.dumps({'id': 'msg', 'type': 'message', 'role': 'assistant', 'model': body.get('model'), 'content': content,
        'stop_reason': 'end_turn', 'usage': {'input_tokens': 30000, 'output_tokens': 3000, 'server_tool_use': {'web_search_requests': 4}}}))
async def mock_gemini(route):
    req = route.request
    if req.method == 'OPTIONS': return await route.fulfill(status=204, headers=HDR)
    AI_LOG['gemini'].append({'u': req.url, 'b': json.loads(req.post_data or '{}')})
    if '/models/gemini-3.5-flash:' in req.url:
        return await route.fulfill(status=404, headers=HDR, content_type='application/json', body=json.dumps({'error': {'code': 404, 'message': 'models/gemini-3.5-flash is not found', 'status': 'NOT_FOUND'}}))
    return await route.fulfill(status=200, headers=HDR, content_type='application/json', body=json.dumps({'candidates': [{'content': {'role': 'model', 'parts': [{'text': ans_text()}]}, 'finishReason': 'STOP',
        'groundingMetadata': {'webSearchQueries': ['orkinos kamışı', 'avet çıkrık'], 'searchEntryPoint': {'renderedContent': '<style>.c{color:#333}</style><div class="c"><a href="https://www.google.com/search?q=orkinos">orkinos kamışı</a></div>'},
          'groundingChunks': [{'web': {'uri': 'https://vertexaisearch.test/r1', 'title': 'gemikaynak.test'}}]}}]}))
async def mock_openai(route):
    req = route.request
    if req.method == 'OPTIONS': return await route.fulfill(status=204, headers=HDR)
    body = json.loads(req.post_data or '{}'); AI_LOG['openai'].append({'h': dict(req.headers), 'b': body})
    return await route.fulfill(status=200, headers=HDR, content_type='application/json', body=json.dumps({'id': 'resp', 'status': 'completed', 'output': [
        {'type': 'web_search_call', 'id': 'ws1', 'status': 'completed', 'action': {'type': 'search', 'query': 'orkinos'}},
        {'type': 'message', 'id': 'm1', 'role': 'assistant', 'content': [{'type': 'output_text', 'text': ans_text(), 'annotations': [{'type': 'url_citation', 'url': 'https://ornek.test/oa', 'title': 'OA kaynak', 'start_index': 0, 'end_index': 5}]}]}]}))
GOOGLE_MD = """Kamış Karşılaştırma Tablosu

| Kamış Modeli | Karakteristik Özelliği | Atar Kapasitesi | Desteklenen PE | Ort. TR Fiyatı |
|---|---|---|---|---|
| Testrod Alpha 180cm | Vinç yapı | 400 - 800 g | PE 5 - 6 | 3.400 TL - 3.700 TL |
| Testrod Beta 159cm | Kısa boy | 200 - 350 g | PE 5 - 6 | 4.300 TL - 4.700 TL |
| Testrod Gamma 198cm | Parabolik | Max. 330 g | PE 4 - 5 | 5.400 TL - 6.100 TL |
"""
DB_LOCS = DB['locations']
def coord_pats():
    out = []
    for l in DB_LOCS:
        for v in (l['lat'], l['lon']):
            out += ['%.4f' % v, ('%.4f' % v).replace('.', ','), '%d°%s' % (int(abs(v)), ('%06.3f' % ((abs(v) % 1) * 60)).replace('.', ','))]
    return out

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        ctx, pg, errs = await new_ctx(b)
        await ctx.route('https://api.anthropic.com/**', mock_claude_dan)
        await ctx.route('https://generativelanguage.googleapis.com/**', mock_gemini)
        await ctx.route('https://api.openai.com/**', mock_openai)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        # ---- motor: orkinos için kurşunlu ağır canlı yem
        r = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const p = Q.planFor({id: 'orkinos', name: 'Orkinos'}); const rg = p.rg; const ch = Q.rigChain(rg, null);
          return {lay: p.lay, lays: p.lays, hook: rg.slots.find(s => s.k === 'igne'), braid: rg.slots.find(s => s.k === 'braid'), lider: rg.slots.find(s => s.k === 'lider'), sinker: rg.sinker,
            rod: rg.slots.find(s => s.kind === 'rod').t, terms: rg.slots.filter(s => s.kind === 'term').map(s => s.label), steps: Q.prepSteps(rg, ch, null), nodes: ch.nodes.map(n => n.t + ':' + (n.label || n.k || '')),
            svg: Q.schemeSvg(rg, {}).svg}; }""")
        print('   motor:', r['lay'], r['hook']['t'], r['sinker'], r['terms'], r['nodes'])
        check(r['lay'] == 'canliagir' and r['lays'][0] == 'canliagir', 'AI: orkinos varsayılan düzeni kurşunlu ağır canlı yem')
        check(r['hook']['sp']['p'][0] == 'jforged' and r['hook']['sp']['lo'] == 6 and r['hook']['sp']['hi'] == 8 and r['hook']['t']['turkiye']['size'] in ('7/0', '8/0'), 'AI: iğne önerisi dövme canlı yem iğnesi 7/0–9/0 (%s %s)' % (r['hook']['t']['turkiye'].get('name'), r['hook']['t']['turkiye'].get('size')))
        check(r['sinker']['g'] == [200, 400] and abs(r['braid']['sp']['lo'] - 0.33) < 1e-6 and r['lider']['sp']['lo'] == 0.9, 'AI: 200–400 g kurşun, PE 4–6 örgü, kalın lider')
        check('Rulmanlı fırdöndü' in r['terms'] and 'Halka' in r['terms'] and 'Kurşun' in r['terms'], 'AI: terminal: rulmanlı fırdöndü, halka, kurşun')
        check(any('kopma bağı' in s for s in r['steps']) and any('FG' in s or 'fg' in s.lower() for s in r['steps']) and len(r['svg']) > 500, 'AI: hazırlama adımları ve şema')
        open(SHOTS + '/ai_scheme.svg', 'w').write(r['svg'])
        # ---- danışman: Daha menüsü, form
        await pg.click('.tabbar button[data-v="daha"]'); await pg.wait_for_timeout(300)
        check(await pg.locator('#moreMenu button[data-open="danisman"]').count() == 1 and await pg.locator('#moreMenu .mrow').count() == 20, 'AI: Daha’da Takım danışmanı (menü 20 satır)')
        await pg.click('#moreMenu button[data-open="danisman"]'); await pg.wait_for_timeout(400)
        await pg.select_option('#dn-sp', 'orkinos'); await pg.wait_for_timeout(400)
        sh = await pg.inner_text('#sheet')
        check('Ağır canlı yem (kurşunlu)' in sh and '200–400 g' in sh and 'Google AI (kopyala–yapıştır)' in sh, 'AI: form: teknik, motor kuralları, yapay zekâ seçenekleri')
        await pg.fill('#dn-note', 'Çiftlik kenarı, 60–80 m'); await pg.fill('#dn-size', '30–150 kg'); await pg.fill('#dn-budget', '10000')
        await overflow(pg, 'danışman formu 390')
        await tall(pg, 2600, SHOTS + '/ai_form_390.png', '#sheet')
        # ---- kopyala–yapıştır (Google AI Modu)
        await pg.click('#sheet button[data-dan="go"]'); await pg.wait_for_timeout(500)
        prompt = await pg.input_value('#sheet textarea.dan-prompt')
        print('   soru:', prompt[-900:].replace('\n', ' | ')[:900])
        st = await state(pg)
        rods = [it['name'] for it in st['inv']['items'].values() if it.get('cat') == 'rod'] if st['inv']['items'] else []
        allit = await pg.evaluate("() => Object.values(window.ALYSSA_QA.items()).filter(i => i.cat === 'rod' || i.cat === 'reel').map(i => i.name)")
        check('HEDEF: Orkinos' in prompt and 'Mera notu: Çiftlik kenarı, 60–80 m' in prompt and '30–150 kg' in prompt and '10000 TL' in prompt and 'ELDEKİ TAKIM' in prompt and '```json' in prompt, 'AI: soruda hedef, mera notu, boy, bütçe, şema')
        check(any(n in prompt for n in allit), 'AI: soruda envanterdeki kamış/makine')
        check('Ağır canlı yem' in prompt and 'Kurşun: 200–400 g' in prompt, 'AI: soruda motorun kuralları')
        leak = [c for c in coord_pats() if c in prompt]
        check(not leak, 'AI: soruda koordinat yok')
        check(await pg.locator('#sheet a[href^="https://www.google.com/search?udm=50"]').count() == 1, 'AI: Google AI Modu bağlantısı')
        st = await state(pg); L1 = st['locations'][st['active']]
        check(L1.get('mera') == 'Çiftlik kenarı, 60–80 m', 'AI: mera notu noktaya kaydedildi')
        await pg.fill('#dn-paste', GOOGLE_MD); await pg.click('#sheet button[data-dan="read"]'); await pg.wait_for_timeout(500)
        sh = await pg.inner_text('#sheet'); print('   tablo:', sh[:700].replace('\n', ' | '))
        n_o = await pg.locator('#sheet .dan-o').count()
        check(n_o == 3 and 'Testrod Gamma' in sh, 'AI: Google AI tablosu okundu (%d satır)' % n_o)
        fits = await pg.locator('#sheet .dan-o .fitb').all_inner_texts(); print('   rozetler:', fits)
        check(any(U(f) == U('Sınırda') for f in fits), 'AI: 330 g kamış 200–400 g rigde sınırda')
        await overflow(pg, 'danışman tablo 390')
        # ---- Claude
        await pg.click('#sheet button[data-dan="form"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-dan="prov"][data-v="claude"]'); await pg.wait_for_timeout(300)
        await pg.fill('#dn-key', 'sk-ant-dan-good'); await pg.click('#sheet button[data-dan="savekey"]'); await pg.wait_for_timeout(300)
        check(await pg.evaluate("localStorage.getItem('alyssa-ak')") == 'sk-ant-dan-good', 'AI: Claude anahtarı yalnız bu cihazda')
        await pg.click('#sheet button[data-dan="go"]'); await pg.wait_for_timeout(2500)
        lg = [x for x in AI_LOG['claude'] if x['b'].get('tools')][-1]
        tl = lg['b']['tools'][0]
        check(tl['type'] == 'web_search_20250305' and tl['user_location']['country'] == 'TR' and lg['h'].get('anthropic-dangerous-direct-browser-access') == 'true', 'AI: Claude web araması aracıyla soruldu')
        sh = await pg.inner_text('#sheet')
        check(await pg.locator('#sheet .dan-o').count() == 9 and 'Testmarka Slow 198' in sh and 'Ornek A' in sh and '$' in sh and '4 arama' in sh, 'AI: Claude öneri tablosu, kaynak, maliyet')
        bad = await pg.locator('#sheet .dan-o', has_text='Live 4/0').inner_text(); ok8 = await pg.locator('#sheet .dan-o', has_text='Gorilla 8/0').inner_text()
        check(U('Uygun değil') in U(bad) and U('küçük') in U(bad) and U('Uygun') in U(ok8) and U('Uygun değil') not in U(ok8), 'AI: motor iğne boyunu kontrol etti (4/0 uygun değil, 8/0 uygun)')
        ln = await pg.locator('#sheet .dan-o', has_text='X8 80 lb').inner_text(); ld = await pg.locator('#sheet .dan-o', has_text='FC 120 lb').inner_text()
        check(U('Uygun') in U(ln) and U('değil') not in U(ln) and U('Uygun') in U(ld), 'AI: motor ip ve lider çapını kontrol etti')
        rt = await pg.evaluate("() => { const Q = window.ALYSSA_QA, o = Q.danOwn(Q.danRig()); return o.ctx.reels.map(r => r.type); }")
        sl = await pg.locator('#sheet .dan-o', has_text='Slow 198').inner_text(); hv = await pg.locator('#sheet .dan-o', has_text='Heavy 180').inner_text()
        check(('Tetiksiz kamış' in sl) == ('spin' not in rt) and ('Tetikli kamış' in hv) == ('cikrik' not in rt), 'AI: kamış yuvası uyan makinelerine göre (%s)' % rt)
        check('Elindeki takım' in sh and 'Motor' in sh, 'AI: elindeki takım: motor ve yapay zekâ görüşü')
        lv = await pg.locator('#sheet .dan-o', has_text='Lever 30').inner_text()
        check(U('Uygun') in U(lv) and U('değil') not in U(lv) and 'küçük' not in lv, 'AI: çıkrıkta 30 sınıfı büyük makine sayıldı')
        await tall(pg, 4200, SHOTS + '/ai_claude_390.png', '#sheet')
        # sorulara cevap → ikinci tur
        await pg.fill('#sheet input[data-danq="q0"]', 'Canlı istavrit'); await pg.click('#sheet button[data-dan="again"]'); await pg.wait_for_timeout(2500)
        lg2 = [x for x in AI_LOG['claude'] if x['b'].get('tools')][-1]['b']['messages'][0]['content']
        check('EK BİLGİ' in lg2 and 'Canlı istavrit' in lg2, 'AI: soruların cevabıyla yeniden soruldu')
        # alışveriş listesi ve envanter
        await pg.locator('#sheet .dan-o', has_text='Heavy 180').locator('button[data-dan="shop"]').click(); await pg.wait_for_timeout(300)
        st = await state(pg); k = [k for k in st['shopX'] if k.startswith('dan:')]
        check(len(k) == 1 and st['shopX'][k[0]]['name'] == 'Testmarka Heavy 180', 'AI: öneri alışveriş listesine eklendi')
        await pg.locator('#sheet .dan-o', has_text='Lever 30').locator('button[data-dan="have"]').click(); await pg.wait_for_timeout(400)
        st = await state(pg); rv = [it for it in st['inv']['items'].values() if it.get('name') == 'Testreel Lever 30']
        check(len(rv) == 1 and rv[0]['cat'] == 'reel' and rv[0]['reel']['type'] == 'cikrik' and rv[0]['brand'] == 'Testreel' and rv[0]['model'] == 'Lever 30', 'AI: makine marka, model ve tipiyle envantere eklendi')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="alisveris"]'); await pg.wait_for_timeout(400)
        sh = await pg.inner_text('#sheet')
        if 'Orkinos · takım danışmanı' not in sh: print('   ALIŞVERİŞ:', sh[:900].replace('\n', ' | '))
        check(U('Orkinos · takım danışmanı') in U(sh) and 'Testmarka Heavy 180' in sh, 'AI: alışveriş listesinde danışman grubu')
        await pg.locator('#sheet button[data-danbuy]').first.click(); await pg.wait_for_timeout(500)
        st = await state(pg); rd = [it for it in st['inv']['items'].values() if it.get('name') == 'Testmarka Heavy 180']
        check(len(rd) == 1 and rd[0]['rod']['max'] == 500 and rd[0]['rod']['seat'] == 'cast' and abs(rd[0]['rod']['len'] - 1.8) < 0.01 and not [k for k in st['shopX'] if k.startswith('dan:')], 'AI: listeden “Aldım”: kamış ölçüleriyle envanterde, listeden düştü')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        # ---- Gemini (model bulunamazsa en yeni Flash'a geçer; Google Arama önerileri gösterilir)
        await pg.evaluate("window.ALYSSA_QA.openDan({sp: 'orkinos'})"); await pg.wait_for_timeout(400)
        await pg.click('#sheet button[data-dan="prov"][data-v="gemini"]'); await pg.wait_for_timeout(300)
        await pg.fill('#dn-key', 'AIzaTestKey'); await pg.click('#sheet button[data-dan="savekey"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-dan="go"]'); await pg.wait_for_timeout(2500)
        gl = AI_LOG['gemini']
        check(len(gl) == 2 and 'gemini-3.5-flash' in gl[0]['u'] and 'gemini-flash-latest' in gl[1]['u'] and 'key=AIzaTestKey' in gl[1]['u'] and gl[1]['b']['tools'] == [{'google_search': {}}], 'AI: Gemini Google Arama ile, model bulunamayınca en yeni Flash')
        sh = await pg.inner_text('#sheet')
        check(await pg.locator('#sheet iframe.dan-gs').count() == 1 and 'gemikaynak.test' in sh and await pg.locator('#sheet .dan-o').count() == 9, 'AI: Gemini tablosu, kaynak ve Google Arama önerileri')
        # ---- ChatGPT
        await pg.click('#sheet button[data-dan="form"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-dan="prov"][data-v="openai"]'); await pg.wait_for_timeout(300)
        await pg.fill('#dn-key', 'sk-test-openai'); await pg.click('#sheet button[data-dan="savekey"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-dan="go"]'); await pg.wait_for_timeout(2500)
        ol = AI_LOG['openai'][-1]
        check(ol['h'].get('authorization') == 'Bearer sk-test-openai' and ol['b']['tools'][0]['type'] == 'web_search' and ol['b']['model'] == 'gpt-5.5', 'AI: ChatGPT web araması ile soruldu')
        sh = await pg.inner_text('#sheet')
        check('OA kaynak' in sh and await pg.locator('#sheet .dan-o').count() == 9, 'AI: ChatGPT öneri tablosu')
        # ---- geçmiş
        await pg.click('#sheet button[data-dan="form"]'); await pg.wait_for_timeout(300)
        nh = await pg.locator('#sheet button[data-dan="view"]').count(); check(nh == 3, 'AI: son öneriler listesi (%d)' % nh)
        na = len((await state(pg))['advice']); check(na == 5, 'AI: 5 öneri kayıtlı (%d)' % na)
        await pg.locator('#sheet button[data-dan="view"]').first.click(); await pg.wait_for_timeout(300)
        check('Önceki öneri' in await pg.inner_text('#sheet'), 'AI: önceki öneri açıldı')
        await pg.click('#sheet button[data-dan="del"]'); await pg.wait_for_timeout(300)
        st = await state(pg); print('   advice', len(st['advice']), nh, 'alyssa-gk' in json.dumps(st), 'AIzaTestKey' in json.dumps(st), 'sk-ant-dan-good' in json.dumps(st))
        check(len(st['advice']) == na - 1 and 'alyssa-gk' not in json.dumps(st) and 'AIzaTestKey' not in json.dumps(st) and 'sk-ant-dan-good' not in json.dumps(st), 'AI: öneri silindi; anahtarlar profilde yok')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        # ---- giriş noktaları: tür sayfası, kamış/makine sayfası, kalem formu
        await pg.evaluate("() => { }")
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="turler"]'); await pg.wait_for_timeout(300)
        await pg.evaluate("() => { const b = document.createElement('button'); b.dataset.tur = 'orkinos'; b.id = 'tmpTur'; document.getElementById('sheet').appendChild(b); }"); await pg.click('#tmpTur'); await pg.wait_for_timeout(400)
        sh = await pg.inner_text('#sheet')
        check('Ağır canlı yem' in sh and await pg.locator('#sheet button[data-danopen]').count() == 1, 'AI: tür sayfasında ağır canlı yem rigi ve danışman düğmesi')
        await pg.click('#sheet button[data-danopen]'); await pg.wait_for_timeout(400)
        check(await pg.input_value('#dn-sp') == 'orkinos', 'AI: tür sayfasından danışman açıldı (orkinos)')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        check(await pg.is_visible('#sheet') and 'Orkinos' in await pg.inner_text('#sheet h3'), 'AI: Geri tür sayfasına döndü')
        await pg.locator('#sheet [data-close], #sheet .bar .btn').first.click(); await pg.wait_for_timeout(300)
        if await pg.is_visible('#sheet'): await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        rid = await pg.evaluate("() => { const r = window.ALYSSA_QA.rigs().find(x => x.gear && x.slots.some(s => s.kind === 'rod')); return r ? r.id : null; }")
        if rid:
            await pg.evaluate("id => window.ALYSSA_QA.openGear(id)", rid); await pg.wait_for_timeout(400)
            await pg.locator('#sheet details.gbuy').first.evaluate("e => e.open = true")
            await pg.locator('#sheet button[data-danopen]').first.click(); await pg.wait_for_timeout(400)
            d = await pg.evaluate("() => window.ALYSSA_QA.dan()")
            check(d['rid'] == rid and d['cats'] == ['kamis'], 'AI: kamış sayfasından danışman (rig ve kamış kategorisi)')
            await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
            check('Kamış ve makine' in await pg.inner_text('#sheet h3'), 'AI: Geri kamış ve makine sayfasına döndü')
            await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.wait_for_timeout(300)
        await pg.evaluate("() => { const b = document.createElement('button'); b.dataset.newitem = 'rod'; b.id = 'tmpNew'; document.body.appendChild(b); }"); await pg.click('#tmpNew'); await pg.wait_for_timeout(400)
        check(await pg.is_visible('#it-danw'), 'AI: kamış formunda danışman bağlantısı')
        await pg.select_option('#it-cat', 'hook'); await pg.wait_for_timeout(200)
        check(not await pg.is_visible('#it-danw'), 'AI: iğne formunda bağlantı gizli')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        for w in (390, 320):
            await pg.set_viewport_size({'width': w, 'height': 860}); await pg.wait_for_timeout(200)
            await pg.evaluate("window.ALYSSA_QA.openDan({sp: 'orkinos'})"); await pg.wait_for_timeout(400)
            await overflow(pg, 'danışman %d' % w)
            await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        print('AI errors:', errs); check(not errs, 'AI: hata yok')
        await ctx.close(); await b.close()
    srv.terminate()
    print('SONUÇ:', 'HEPSİ GEÇTİ' if not FAIL else '%d HATA' % len(FAIL))
asyncio.run(main())
