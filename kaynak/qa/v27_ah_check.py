"""Alyssa v0.3–v0.22 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
Çalıştır: python3 /home/claude/fishapp/qa/v22_check.py
"""
import os, sys
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import fbmock   # sahte Firebase

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_h'
SHOTS = ROOT + '/qa/v27h'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(os.environ.get('ALYSSA_DIST', ROOT + '/app/dist'), WWW + '/dist')   # ALYSSA_DIST: sabitlenmiş bir derlemeyi test etmek için
prev = open(os.environ.get('ALYSSA_PREV', ROOT + '/app/preview/alyssa_onizleme.html'), encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8795
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

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        # ================================================== AH) v0.27: takvim sayfası
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(800)
        # telefonda varsayılan: yatay kartlar
        nr = await pg.locator('#dayList .t-drow').count()
        check(nr >= 10 and await pg.locator('#dayList .t-day').count() == 0, 'AH: telefonda yatay gün kartları (%d)' % nr)
        r0 = await pg.locator('#dayList .t-drow').first.inner_text(); print('   yatay:', r0.replace('\n', ' | ')[:200])
        check(await pg.locator('#dayList .t-drow').first.locator('svg.t-wx').count() == 1 and await pg.locator('#dayList .t-drow').first.locator('use[href="#ak-wind"]').count() == 1 and
              await pg.locator('#dayList .t-drow').first.locator('use[href="#ak-wave"]').count() == 1 and await pg.locator('#dayList .t-drow').first.locator('.t-dwin').count() == 1 and 'BUGÜN' in U(r0), 'AH: yatay kartta hava simgesi, ikonlar, balık penceresi, bugün')
        check(bool(re.search(r'\d+\s*/\s*\d+\s*Bft', r0.replace('\n', ' '))), 'AH: yatay kartta hamle gündüz/gece')
        await overflow(pg, 'yatay kartlar 390')
        await tall(pg, 2600, SHOTS + '/ah_yatay_390.png', '#t-gunler')
        await pg.click('#atk button[data-atkview="kart"]'); await pg.wait_for_timeout(500)
        t = await pg.inner_text('#atk')
        check(await pg.locator('#atk .t-day').count() >= 10, 'AH: dikey gün kartları (%d)' % await pg.locator('#atk .t-day').count())
        for sec in ['ozet', 'gunler', 'grafik', 'tablo', 'solunar', 'pencere', 'balik', 'yontem']:
            check(await pg.locator('#t-' + sec).count() == 1, 'AH: bölüm ' + sec)
        check('Dolunay 26 Ekim 07:11' in t or 'Dolunay 26 Ekim 07:12' in t, 'AH: dolunay saati doğru (Meeus): ' + (re.search(r'Dolunay 26 Ekim \d\d:\d\d', t) or [''])[0])
        check('İlk dördün 18 Ekim 19:12' in t or 'İlk dördün 18 Ekim 19:13' in t, 'AH: ilk dördün saati doğru')
        check(await pg.locator('#atk .t-plot').count() == 1 and LDDM in t, 'AH: konum çizelgesi ve plotter koordinatı')
        check(await pg.locator('#t-grafik svg.ch polyline.line-wind').count() >= 1 and await pg.locator('#t-grafik .line-gust').count() >= 1 and await pg.locator('#t-grafik rect.bar-lo').count() >= 5, 'AH: meteogram rüzgâr, hamle ve dalga')
        check(await pg.locator('#t-solunar rect.sl-major').count() >= 10 and await pg.locator('#t-solunar rect.sl-win').count() >= 5, 'AH: solunar şeritleri ve pencereler')
        nw = await pg.locator('#t-pencere article.t-win').count(); nr = await pg.locator('#t-pencere .t-rigs button[data-rigopen]').count()
        check(nw == 6 and nr >= 6, 'AH: en iyi 6 pencere ve rig önerileri (%d pencere, %d rig)' % (nw, nr))
        check(await pg.locator('#t-tablo table.t-data tbody tr').count() >= 10, 'AH: ayrıntılı tablo')
        c0 = await pg.locator('#dayList .t-day').first.inner_text()
        check('Rüzgâr' in c0 and 'Hamle' in c0 and 'Dalga' in c0 and 'Su' in c0 and 'Basınç' in c0 and 'gündüz' in c0 and 'BUGÜN' in U(c0), 'AH: gün kartında satırlar ve bugün işareti')
        check(bool(re.search(r'Hamle\s*\d+\s*/\s*\d+\s*Bft', c0.replace('\n', ' '))), 'AH: dikey kartta hamle gündüz/gece')
        check(await pg.locator('#dayList .t-day.best').count() == 3, 'AH: üç öne çıkan gün')
        check(await pg.locator('#dayList .t-day svg use[href="#ak-wind"]').count() >= 10 and await pg.locator('#dayList svg.t-wx').count() >= 10, 'AH: ikonlar (rüzgâr, hava simgesi)')
        # balıklar: tür kartları ve çizimler
        nsp = await pg.locator('#t-balik article.t-sp').count(); nart = await pg.locator('#t-balik article.t-sp svg.t-art').count()
        check(nsp >= 10 and nart == nsp, 'AH: tür kartları ve çizimleri (%d kart, %d çizim)' % (nsp, nart))
        bt = await pg.inner_text('#t-balik'); print('   BALIK:', bt[:500].replace('\n', ' | '))
        check('Sistemindeki türler' in bt and 'Çipura' in bt and 'Karagöz' in bt and re.search(r'(Çok iyi|İyi|Orta|Zayıf) · \d/5', bt) and 'DERİNLİK' in U(bt).replace('I', 'İ') or 'DERINLIK' in U(bt), 'AH: tür kartında uyum, derinlik, yem')
        check(await pg.locator('#t-balik .t-sp .t-rigs button[data-rigopen]').count() >= 10, 'AH: tür kartlarında rig kodları')
        await tall(pg, 3400, SHOTS + '/ah_balik_390.png', '#t-balik')
        await pg.locator('#t-balik .t-sp-art').first.click(); await pg.wait_for_timeout(500)
        sh = await pg.inner_text('#sheet'); check(await pg.locator('#sheet .tur-art svg.t-art').count() == 1 and 'çizim temsilîdir' in sh, 'AH: resme dokununca tür sayfası, çizimiyle')
        await pg.locator('#sheet .tur-art').screenshot(path=SHOTS + '/ah_tur_art.png')
        await pg.locator('#sheet .bar button[data-open="turler"]').click(); await pg.wait_for_timeout(300)
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(400)
        check(not await pg.is_visible('#sheet'), 'AH: tür sayfası kapandı')
        # bölüm çubuğu
        await pg.click('#atk .t-nav button[data-atkgo="solunar"]'); await pg.wait_for_timeout(900)
        y = await pg.evaluate("document.getElementById('t-solunar').getBoundingClientRect().top")
        check(0 < y < 200, 'AH: bölüm çubuğu Solunar’a kaydırdı (%d)' % y)
        await overflow(pg, 'takvim 390')
        await tall(pg, 9000, SHOTS + '/ah_takvim_390.png')
        # pencere rigine dokun: rig sayfası
        await pg.locator('#t-pencere .t-rigs button[data-rigopen]').first.click(); await pg.wait_for_timeout(500)
        check(await pg.is_visible('#sheet') and len(await pg.inner_text('#sheet')) > 50, 'AH: pencere rigi rig sayfasını açtı')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        # satır görünümü
        await pg.click('#atk button[data-atkview="liste"]'); await pg.wait_for_timeout(500)
        check(await pg.locator('#dayList .t-drow').count() >= 10 and await pg.locator('#dayList .t-day').count() == 0 and await pg.locator('#t-grafik').count() == 1, 'AH: Yatay: yatay kartlar, diğer bölümler duruyor')
        check(await pg.evaluate("localStorage.getItem('alyssa-cv')") == 'liste', 'AH: görünüm bu cihaza kaydedildi')
        await pg.click('#atk button[data-atkview="kart"]'); await pg.wait_for_timeout(500)
        check(await pg.locator('#dayList .t-day').count() >= 10, 'AH: Kartlar’a geri döndü')
        # karta dokun: saatlik tablo o gün
        k = await pg.locator('#dayList .t-day').nth(2).get_attribute('data-calday')
        await pg.locator('#dayList .t-day').nth(2).click(); await pg.wait_for_timeout(700)
        check(await pg.is_visible('#v-bugun') and await pg.get_attribute('#dayChips button[aria-pressed="true"]', 'data-hday') == k, 'AH: karta dokununca o günün saatlik tablosu')
        check(await pg.locator('#nowGrid .metric .m-ic').count() == 6, 'AH: Bugün ölçülerinde 6 ikon')
        await pg.locator('#nowGrid').screenshot(path=SHOTS + '/ah_bugun_ikon.png')
        check(not await pg.evaluate("document.getElementById('main').classList.contains('wide')"), 'AH: Bugün’de sayfa dar')
        # genişlikler
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(500)
        check(await pg.evaluate("document.getElementById('main').classList.contains('wide')"), 'AH: Takvim’de sayfa geniş')
        await pg.set_viewport_size({'width': 320, 'height': 860}); await pg.wait_for_timeout(300); await overflow(pg, 'takvim 320')
        await pg.set_viewport_size({'width': 820, 'height': 1100}); await pg.wait_for_timeout(300); await overflow(pg, 'takvim 820')
        cols = await pg.evaluate("getComputedStyle(document.querySelector('#atk .t-days')).gridTemplateColumns.split(' ').length")
        check(cols == 3, 'AH: tablette (820) 3 sütun (%d)' % cols)
        # tablette seçim yoksa dikey kart açılır
        await pg.evaluate("localStorage.removeItem('alyssa-cv')"); await pg.click('.tabbar button[data-v="bugun"]'); await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(300)
        await pg.reload(); await pg.wait_for_timeout(2500); await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(600)
        check(await pg.locator('#dayList .t-day').count() >= 10 and await pg.locator('#dayList .t-drow').count() == 0, 'AH: tablette varsayılan dikey kartlar')
        await pg.set_viewport_size({'width': 1180, 'height': 900}); await pg.wait_for_timeout(300); await overflow(pg, 'takvim 1180')
        cols = await pg.evaluate("getComputedStyle(document.querySelector('#atk .t-days')).gridTemplateColumns.split(' ').length")
        check(cols == 5, 'AH: geniş ekranda 5 sütun (%d)' % cols)
        await pg.screenshot(path=SHOTS + '/ah_takvim_1180.png', full_page=True)
        await pg.set_viewport_size({'width': 390, 'height': 860}); await pg.wait_for_timeout(200)
        # 3 nokta: sekmeler ve karşılaştırma kartları
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(250)
        await pg.fill('#nl-name', 'Sığacık açığı'); await pg.fill('#nl-lat', '38.20'); await pg.fill('#nl-lon', '26.75'); await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.fill('#nl-name', 'Ev'); await pg.fill('#nl-lat', '38.3648'); await pg.fill('#nl-lon', '26.8732'); await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-use="1"]'); await pg.wait_for_timeout(300); await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(4000)
        st = await state(pg); ids = {l['name']: l['id'] for l in st['locations'].values()}
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(300)
        await pg.click('#calPick button[data-calloc="%s"]' % ids['Sığacık açığı']); await pg.wait_for_timeout(300)
        await pg.click('#calPick button[data-calloc="%s"]' % ids['Ev']); await pg.wait_for_timeout(3500)
        tabs = await pg.locator('#atk .t-tabs button[data-atktab]').all_inner_texts(); print('   sekmeler:', tabs)
        check(len(tabs) == 4 and 'Karşılaştır' in tabs[-1] and await pg.get_attribute('#atk .t-tabs button[data-atktab="cmp"]', 'aria-pressed') == 'true', 'AH: 3 nokta sekmesi ve Karşılaştır açık')
        n3r = await pg.locator('#dayList .t-cday').first.locator('.t-drow').count()
        check(n3r == 3, 'AH: karşılaştırmada telefonda her gün 3 yatay kart (%d)' % n3r)
        await tall(pg, 2400, SHOTS + '/ah_cmp_yatay_390.png', '#t-gunler')
        await pg.click('#atk button[data-atkview="kart"]'); await pg.wait_for_timeout(500)
        cd = await pg.locator('#dayList .t-cday').count(); n3 = await pg.locator('#dayList .t-cday').first.locator('.t-day').count()
        check(cd >= 9 and n3 == 3, 'AH: karşılaştırmada her gün 3 dikey kart (%d gün, %d kart)' % (cd, n3))
        c1 = await pg.locator('#dayList .t-cday').first.inner_text(); print('   ilk gün:', c1.replace('\n', ' | ')[:300])
        check('Konum 1' in c1 and 'Sığacık' in c1 and 'Ev' in c1 and 'Kara' in c1, 'AH: kartlarda nokta adları, kara noktası yalnız hava')
        check(await pg.locator('#dayList .t-cday .t-day.best').count() >= 5, 'AH: en iyi nokta işaretli')
        check(await pg.locator('#t-ozet .t-strip .gl').count() == 3, 'AH: özet şeridinde 3 nokta')
        await pg.screenshot(path=SHOTS + '/ah_cmp_390.png', full_page=True)
        await pg.set_viewport_size({'width': 320, 'height': 860}); await pg.wait_for_timeout(300); await overflow(pg, 'karşılaştırma 320')
        await pg.set_viewport_size({'width': 1180, 'height': 900}); await pg.wait_for_timeout(300); await overflow(pg, 'karşılaştırma 1180')
        await pg.screenshot(path=SHOTS + '/ah_cmp_1180.png', full_page=True)
        await pg.set_viewport_size({'width': 390, 'height': 860}); await pg.wait_for_timeout(200)
        # karşılaştırma kartı: o nokta ve gün
        k2 = await pg.locator('#dayList .t-cday').nth(1).locator('.t-day', has_text='Sığacık').get_attribute('data-calpick')
        await pg.locator('#dayList .t-cday').nth(1).locator('.t-day', has_text='Sığacık').click(); await pg.wait_for_timeout(1500)
        st = await state(pg)
        check(st['active'] == ids['Sığacık açığı'] and await pg.get_attribute('#dayChips button[aria-pressed="true"]', 'data-hday') == k2.split('|')[1], 'AH: karşılaştırma kartı o noktayı ve günü açtı')
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(500)
        # başka noktanın sekmesi (aktif olmayan): Konum 1
        await pg.click('#atk .t-tabs button[data-atktab="1"]'); await pg.wait_for_timeout(1500)
        t1 = await pg.inner_text('#atk')
        check('Konum 1' in t1 and await pg.locator('#atk .t-day').count() >= 9 and await pg.locator('#t-solunar').count() == 1, 'AH: aktif olmayan noktanın sayfası (Konum 1)')
        st = await state(pg); check(st['active'] == ids['Sığacık açığı'], 'AH: sekme aktif noktayı değiştirmedi')
        # kara noktası
        await pg.click('#atk .t-tabs button[data-atktab="%s"]' % ids['Ev']); await pg.wait_for_timeout(1500)
        te = await pg.inner_text('#atk'); print('   KARA:', te[:600].replace('\n', ' | ')); print('   CNT:', await pg.locator('#t-solunar').count(), await pg.locator('#t-pencere').count()); print('   DL:', (await pg.inner_text('#dayList'))[:400].replace('\n', ' | '))
        check('Hava takvimi' in te and await pg.locator('#t-solunar').count() == 0 and await pg.locator('#t-pencere').count() == 0 and 'Dalga' not in ''.join(await pg.locator('#dayList .t-day').all_inner_texts()), 'AH: kara noktası: hava takvimi, solunar/pencere/dalga yok')
        await overflow(pg, 'kara 390')
        # koordinat gizle
        await pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('alyssa-v1')); return 1; }")
        print('\n'.join(errs[:10]))
        check(not errs, 'AH: hata yok')
        await ctx.close(); await b.close()
    srv.terminate()
    print('\nSONUÇ:', 'HEPSİ GEÇTİ' if not FAIL else '%d HATA' % len(FAIL))
asyncio.run(main())
