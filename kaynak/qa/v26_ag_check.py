"""Alyssa v0.3–v0.22 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
Çalıştır: python3 /home/claude/fishapp/qa/v22_check.py
"""
import os, sys
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import fbmock   # sahte Firebase

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_g'
SHOTS = ROOT + '/qa/v26g'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(os.environ.get('ALYSSA_DIST', ROOT + '/app/dist'), WWW + '/dist')   # ALYSSA_DIST: sabitlenmiş bir derlemeyi test etmek için
prev = open(os.environ.get('ALYSSA_PREV', ROOT + '/app/preview/alyssa_onizleme.html'), encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8794
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
        # ================================================== AG) v0.26: rig editörü, rig hazırladım, rig fotoğrafı
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(400)
        rid = await pg.locator('#rigList button.crow.takim').first.get_attribute('data-prep')
        orig = await pg.evaluate("(rid) => { const r = window.ALYSSA_QA.rigs().find(x => x.id === rid); return JSON.stringify({s: r.slots.map(s => [s.k, s.t.envanter.item, s.t.envanter.size]), l: r.lengths}); }", rid)
        await pg.locator('#rigList button.crow.takim').first.click(); await pg.wait_for_timeout(500)
        sh = await pg.inner_text('#sheet')
        check('Rig hazırladım' in sh and 'Kopyasını düzenle' in sh and 'Fotoğraflar' in sh, 'AG: hazırlama sayfasında Rig hazırladım, Kopyasını düzenle, Fotoğraflar')
        # ---- B4 editör
        await pg.click('#sheet button[data-redit]'); await pg.wait_for_timeout(500)
        sh = await pg.inner_text('#sheet')
        check('Rigimi yap' in sh and await pg.locator('#sheet .edleg').count() == 3 and await pg.locator('#sheet svg.rigsvg').count() == 1 and 'asıl rig ve envanterin değişmez' in sh, 'AG: editör açıldı: 3 köstek, canlı şema, asıl rig değişmez notu')
        await tall(pg, 2600, SHOTS + '/ag_editor.png')
        for _ in range(5): await pg.click('#sheet button[data-ed="cm:0|+"]'); await pg.wait_for_timeout(120)
        w = await pg.inner_text('#sheet .edwarn') if await pg.locator('#sheet .edwarn').count() else ''
        check('köstek arasından' in w and 'dolaşır' in w, 'AG: üst köstek köstek arası kadar olunca “dolaşır” uyarısı: ' + w[:120])
        for _ in range(5): await pg.click('#sheet button[data-ed="cm:0|-"]'); await pg.wait_for_timeout(100)
        await pg.click('#sheet button[data-ed="add|"]'); await pg.wait_for_timeout(250)
        labs = await pg.locator('#sheet .edleg .edlh b').all_inner_texts(); print('   köstekler:', labs)
        check(len(labs) == 4 and 'Hırsız' in labs[-1] and await pg.locator('#sheet svg.rigsvg g[data-knot="snell"]').count() >= 4, 'AG: köstek eklendi (4), hırsız en altta, şema güncellendi')
        await pg.click('#sheet button[data-ed="del|2"]'); await pg.wait_for_timeout(250)
        check(await pg.locator('#sheet .edleg').count() == 3, 'AG: köstek çıkarıldı')
        opts = await pg.evaluate("() => [...document.querySelectorAll('#sheet select[data-edsel=\"hook:0\"] option')].map(o => o.value).filter(Boolean)")
        await pg.select_option('#sheet select[data-edsel="hook:0"]', opts[-1]); await pg.wait_for_timeout(300)
        hk = await pg.evaluate("() => window.ALYSSA_QA.red().legs[0].hook")
        check(hk and hk['item'] == opts[-1].split('|')[0], 'AG: iğne değiştirildi')
        await pg.click('#sheet button[data-ed="ara|-"]'); await pg.wait_for_timeout(200)
        await pg.fill('#ed-name', 'Deneme rigim'); await pg.click('#sheet button[data-ed="save|"]'); await pg.wait_for_timeout(700)
        st = await state(pg); sy = st['systems'].get('atolye')
        check(sy and len(sy['rigs']) == 1 and sy['rigs'][0]['code'] == 'A-1' and sy['rigs'][0]['name'] == 'Deneme rigim' and sy['rigs'][0]['lengths']['ara'] == 45, 'AG: kendi rigim kaydedildi (A-1, köstek arası 45)')
        nid = sy['rigs'][0]['id']
        check('Hazırlama' in await pg.inner_text('#sheet') and 'Deneme rigim' in await pg.inner_text('#sheet'), 'AG: kaydedince yeni rigin hazırlama sayfası açıldı')
        after = await pg.evaluate("(rid) => { const r = window.ALYSSA_QA.rigs().find(x => x.id === rid); return JSON.stringify({s: r.slots.map(s => [s.k, s.t.envanter.item, s.t.envanter.size]), l: r.lengths}); }", rid)
        check(after == orig, 'AG: asıl rig değişmedi')
        nr = await pg.evaluate("(id) => { const Q = window.ALYSSA_QA; const r = Q.rigs().find(x => x.id === id); return r ? {rod: (r.slots.find(s => s.kind === 'rod') || {t: {envanter: {}}}).t.envanter.item, legs: r.legs.length, inRec: Q.recommend(Q.days()[0], false, null).some(x => x.rg.id === id) || Q.recommend(Q.days()[0], true, null).some(x => x.rg.id === id)} : null; }", nid)
        print('   yeni rig:', nr)
        check(nr and nr['rod'] and nr['legs'] == 3 and nr['inRec'], 'AG: kendi rigim rig listesinde, kamışı atanmış, öneri motoruna giriyor')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(300)
        check('Rig Atölyem' in await pg.inner_text('#sysBar'), 'AG: Rigler’de “Rig Atölyem” sistemi')
        # ---- B5 rig hazırladım: iğneleri adetle say
        hooks = await pg.evaluate("""(rid) => { const Q = window.ALYSSA_QA, S = Q.state(); const u = Q.prepUse(rid); const out = [];
          u.hooks.forEach((h, i) => { S.inv.unit[h.it.id] = i === 0 ? 'adet' : 'paket'; S.inv.qty[h.k] = i === 0 ? 5 : 2; S.inv.status[h.k] = 'var'; out.push([h.k, h.n]); });
          Q.invChanged(); return out; }""", rid)
        print('   iğneler:', hooks)
        await rigs_all(pg)
        await pg.click('#rigList button.crow.takim[data-prep="%s"]' % rid); await pg.wait_for_timeout(400)
        await pg.click('#sheet button[data-done]'); await pg.wait_for_timeout(400)
        sh = await pg.inner_text('#sheet')
        check('Rig hazırladım' in sh and 'Sonra' in sh and 'kalır' in sh and 'Envanterden düş' in sh, 'AG: düşmeden önce ne kalacağı yazıyor')
        await tall(pg, 1800, SHOTS + '/ag_done.png')
        await pg.click('#sheet button[data-prepdone]'); await pg.wait_for_timeout(500)
        st = await state(pg)
        q0 = st['inv']['qty'].get(hooks[0][0]); check(q0 == 5 - hooks[0][1], 'AG: adetle sayılan iğne düştü (%s → %s)' % (5, q0))
        if len(hooks) > 1:
            q1 = st['inv']['qty'].get(hooks[1][0]); lo = st['inv'].get('loose', {}).get(hooks[1][0])
            check(q1 == 1 and lo == 10 - hooks[1][1], 'AG: paketle sayılan iğne: 1 paket açıldı, açık pakette %s kaldı' % lo)
        check(len(st.get('prepLog', [])) == 1 and st['inv'].get('used'), 'AG: hazırlık kaydı ve kullanılan ip metresi')
        check('Geri al' in await pg.inner_text('#sheet'), 'AG: “Geri al”')
        await pg.click('#sheet button[data-undoprep]'); await pg.wait_for_timeout(400)
        st = await state(pg); check(st['inv']['qty'].get(hooks[0][0]) == 5 and not st.get('prepLog'), 'AG: geri alındı')
        # az kalan iğne: envanter kartında etkilenen rigler
        await pg.evaluate("(k) => { const S = window.ALYSSA_QA.state(); S.inv.qty[k] = 1; window.ALYSSA_QA.invChanged(); }", hooks[0][0])
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        if await pg.is_visible('#sheet'): await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.click('button[data-iseg="hook"]'); await pg.wait_for_timeout(300)
        inv = await pg.inner_text('#invList'); check('Az kaldı' in inv and 'rig eksik kalır' in inv, 'AG: envanterde “Az kaldı: bitince N rig eksik kalır”')
        # ---- B6 fotoğraf
        await rigs_all(pg)
        await pg.click('#rigList button.crow.takim[data-prep="%s"]' % rid); await pg.wait_for_timeout(400)
        await pg.set_input_files('#sheet input[data-rpfile]', ROOT + '/qa/v25f/af_resim.png'); await pg.wait_for_timeout(2500)
        st = await state(pg); ph = st.get('rigPhotos', {}).get(rid, [])
        check(len(ph) == 1, 'AG: rige fotoğraf eklendi')
        src = await pg.get_attribute('#sheet img[data-rph]', 'src') if await pg.locator('#sheet img[data-rph]').count() else ''
        check(src and src.startswith('blob:'), 'AG: hazırlama sayfasında fotoğraf görünüyor')
        ids = await pg.evaluate("() => window.ALYSSA_QA.allPhotoIds()"); check(ph[0] in ids, 'AG: fotoğraf yedek listesine giriyor')
        img = await pg.evaluate("(rid) => window.ALYSSA_QA.prepImageSvg(rid, 'data:image/png;base64,iVBORw0KGgo=').svg.indexOf('<image') >= 0", rid)
        check(img, 'AG: hazırlama resmine fotoğraf girdi')
        await pg.click('#sheet button[data-rphoto]'); await pg.wait_for_timeout(500)
        check(await pg.locator('#sheet img.rphbig').count() == 1, 'AG: fotoğraf büyük açıldı')
        await pg.click('#sheet button[data-rphdel]'); await pg.click('#sheet button[data-rphdel]'); await pg.wait_for_timeout(500)
        st = await state(pg); check(not st.get('rigPhotos', {}).get(rid), 'AG: fotoğraf silindi')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        # kendi rigimi sil
        await rigs_all(pg)
        await pg.click('#rigList button.crow.takim[data-prep="%s"]' % nid); await pg.wait_for_timeout(400)
        await pg.click('#sheet button[data-redit]'); await pg.wait_for_timeout(400)
        check('Rigi düzenle' in await pg.inner_text('#sheet'), 'AG: kendi rigim düzenleniyor')
        await pg.click('#sheet button[data-ed="remove|"]'); await pg.click('#sheet button[data-ed="remove|"]'); await pg.wait_for_timeout(500)
        st = await state(pg); check('atolye' not in st['systems'], 'AG: kendi rigim silindi')
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 800}); await pg.wait_for_timeout(150)
            await rigs_all(pg)
            await pg.click('#rigList button.crow.takim[data-prep="%s"]' % rid); await pg.wait_for_timeout(300)
            await pg.click('#sheet button[data-redit]'); await pg.wait_for_timeout(300); await overflow(pg, 'AG %d px editör' % w)
            await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
            await pg.click('#sheet button[data-done]'); await pg.wait_for_timeout(300); await overflow(pg, 'AG %d px rig hazırladım' % w)
            await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
            if await pg.is_visible('#sheet'): await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        print('AG errors:', errs); check(not errs, 'AG: sayfa hatası yok')
        await ctx.close(); await b.close()
    print('SONUÇ:', 'HEPSİ GEÇTİ' if not FAIL else '%d HATA: %s' % (len(FAIL), FAIL))

try:
    asyncio.run(main())
finally:
    srv.terminate()
