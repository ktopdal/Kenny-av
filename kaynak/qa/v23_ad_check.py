"""Alyssa v0.3–v0.22 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
Çalıştır: python3 /home/claude/fishapp/qa/v22_check.py
"""
import os, sys
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import fbmock   # sahte Firebase

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_d'
SHOTS = ROOT + '/qa/v23d'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(os.environ.get('ALYSSA_DIST', ROOT + '/app/dist'), WWW + '/dist')   # ALYSSA_DIST: sabitlenmiş bir derlemeyi test etmek için
prev = open(os.environ.get('ALYSSA_PREV', ROOT + '/app/preview/alyssa_onizleme.html'), encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8791
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
        # ================================================== AD) v0.23: hamle gündüz/gece, takvim açıklaması, saat seçimi, rig parçası, notlar, rig güncelle
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        # 1) takvim tek nokta: hamle iki değer + açıklama
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(400)
        v = await pg.locator('#dayList [data-calday]').first.inner_text()
        hm = re.search(r'(\d+)\s*/\s*(\d+)\s*Bft', v.replace('\n', ' '))
        print('   gün:', v.replace('\n', ' ')[:200])
        check(bool(hm), 'AD: takvimde hamle gündüz/gece iki değer')
        dd = await pg.evaluate('() => { const d = window.ALYSSA_QA.days()[0]; return {gD: d.gD, gN: d.gN, g: d.gust}; }')
        check(dd['gD'] is not None and dd['gN'] is not None and max(dd['gD'], dd['gN']) <= dd['g'] + 1e-9, 'AD: gündüz/gece hamle günün hamlesini aşmaz')
        lg = await pg.inner_text('#dayList .callegend')   # v0.27: yeni takvim düzeninde de
        check('gündüz (07–18)' in lg and 'en yüksek' in lg and 'ortalaması' in lg, 'AD: takvim altında değerlerin açıklaması')
        # 2) iki nokta: hamle iki değer
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="konumlar"]'); await pg.wait_for_timeout(250)
        await pg.fill('#nl-name', 'Sığacık açığı'); await pg.fill('#nl-lat', '38.20'); await pg.fill('#nl-lon', '26.75'); await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet button[data-use="1"]'); await pg.wait_for_timeout(300); await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(2500)
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.wait_for_timeout(300)
        st = await state(pg); ids = {l['name']: l['id'] for l in st['locations'].values()}
        await pg.click('#calPick button[data-calloc="%s"]' % ids['Sığacık açığı']); await pg.wait_for_timeout(3500)
        cr = await pg.locator('#dayList .t-cday').first.locator('[data-calpick]').all_inner_texts()
        print('   karşılaştırma:', [c.replace('\n', ' ')[:110] for c in cr])
        check(len(cr) == 2 and all(re.search(r'\d+\s*/\s*\d+\s*Bft', c.replace('\n', ' ')) for c in cr), 'AD: 2 nokta seçiliyken her noktada hamle iki değer')
        check(await pg.locator('#dayList .callegend').count() == 1, 'AD: karşılaştırmada da açıklama')
        await pg.click('#calPick button[data-calloc="%s"]' % ids['Sığacık açığı']); await pg.wait_for_timeout(300)
        # 3) saatlik tablo: sütuna dokun → mavi
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(400)
        hi = await row_idx(pg, 'Saat'); ri = await row_idx(pg, 'Dalga')
        cell = pg.locator('#hTable tr').nth(ri).locator('td').nth(8)
        await cell.click(); await pg.wait_for_timeout(200)
        hc = pg.locator('#hTable tr').nth(hi).locator('td').nth(8)
        cls = await hc.get_attribute('class'); bg = await hc.evaluate('e => getComputedStyle(e).backgroundColor'); col = await hc.evaluate('e => getComputedStyle(e).color')
        nsel = await pg.locator('#hTable td.selh').count()
        check('selh' in cls and bg == 'rgb(47, 107, 216)' and col == 'rgb(255, 255, 255)', 'AD: seçilen saat mavi kutu, beyaz yazı (%s / %s)' % (bg, col))
        check(nsel >= 8, 'AD: seçili saatin bütün sütunu işaretli (%d hücre)' % nsel)
        check(await pg.locator('#hTable tr.hours td.curh').count() == 1, 'AD: şu anki saat kırmızı kalır')
        await pg.screenshot(path=SHOTS + '/ad_hourly.png')
        await cell.click(); await pg.wait_for_timeout(200)
        check(await pg.locator('#hTable td.selh').count() == 0, 'AD: tekrar dokununca seçim kalkar')
        # 4) rig kartı: notlarda envanter "Türkiye'de en iyi" diye yazılmaz, kamış/makine/fırdöndü/kurşun yok
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(400)
        more = ' '.join(await pg.locator('#rigList .rig .more').all_text_contents())
        check(not re.search(r'(Kamış|Makine|Fırdöndü|Kurşun):', more), 'AD: notlarda kamış, makine, fırdöndü, kurşun yok')
        dup = await pg.evaluate("""() => { let n = 0; document.querySelectorAll('#rigList .rig').forEach(a => { const rows = {}; a.querySelectorAll('.crow.tap').forEach(r => { rows[r.querySelector('.k').textContent.trim().toLowerCase()] = r.querySelector('.v').textContent.replace(/değiştirildi/, '').trim(); });
          a.querySelectorAll('.more span').forEach(s => { const b = s.querySelector('b'); if (!b) return; const k = b.textContent.replace(':', '').trim().toLowerCase(); const t = s.textContent; if (rows[k] && t.indexOf("Türkiye’de bulunur: " + rows[k]) >= 0) { n++; (window.__dup = window.__dup || []).push(rows[k] + ' || ' + t); } if (/Türkiye'de en iyi/.test(t)) n += 100; }); }); return n; }""")
        print('   dup örnek:', await pg.evaluate('() => [...document.querySelectorAll("#rigList .rig .more span")].map(s => s.textContent).filter(t => /bulunur/.test(t)).slice(0, 6)'))
        print('   dup:', await pg.evaluate('() => (window.__dup || []).slice(0, 5)'))
        check(dup == 0, 'AD: envanterdeki parça “Türkiye’de bulunur/en iyi” diye tekrar yazılmıyor (%d)' % dup)
        # 5) parça sayfası
        ntap = await pg.locator('#rigList .rig button.crow.tap').count()
        check(ntap >= 32 * 4, 'AD: rig satırları tıklanabilir (%d)' % ntap)
        info = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const R = Q.rigs(); for (const rg of R) for (const sl of rg.slots) { if (sl.kind !== 'hook') continue; const c = Q.subCands(sl, 6); if (c.length) return {rid: rg.id, k: sl.k, c: c.map(x => x.txt), item: sl.t.envanter.item, size: sl.t.envanter.size}; } return null; }""")
        print('   parça:', json.dumps(info, ensure_ascii=False)[:300])
        check(info is not None, 'AD: elinde yedeği olan bir iğne yuvası var')
        await pg.locator('#rigList button.crow.tap[data-part="%s|%s"]' % (info['rid'], info['k'])).click(); await pg.wait_for_timeout(400)
        sh = await pg.inner_text('#sheet')
        check('Elindeki yedekler' in sh and 'Envanterde' in sh and 'rigde' in sh, 'AD: parça sayfası: envanter, kaç rigde, yedekler')
        await pg.screenshot(path=SHOTS + '/ad_part.png', full_page=True)
        b0 = await pg.locator('#sheet button[data-partuse]').first.get_attribute('data-partuse')
        await pg.locator('#sheet button[data-partuse]').first.click(); await pg.wait_for_timeout(500)
        st = await state(pg); ov = st.get('rigOv', {})
        new_item = b0.split('|')[2]
        check(ov.get(info['rid'] + '|' + info['k'], {}).get('item') == new_item, 'AD: “Bu rigde kullan” → rigde parça değişti (S.rigOv)')
        e2 = await pg.evaluate("(a) => { const rg = window.ALYSSA_QA.rigs().find(r => r.id === a[0]); const sl = rg.slots.find(s => s.k === a[1]); return {item: sl.t.envanter.item, ov: !!sl.ov}; }", [info['rid'], info['k']])
        check(e2['item'] == new_item and e2['ov'], 'AD: rig yeni parçayla çözülüyor')
        check('Asıl parçaya dön' in await pg.inner_text('#sheet'), 'AD: “Asıl parçaya dön” görünüyor')
        await pg.click('#sheet button[data-partorig]'); await pg.wait_for_timeout(400)
        st = await state(pg); check((info['rid'] + '|' + info['k']) not in st.get('rigOv', {}), 'AD: asıl parçaya dönüldü')
        # bütün riglerde
        if await pg.locator('#sheet button[data-partall]').count():
            users = await pg.evaluate("(a) => window.ALYSSA_QA.partUsers(a[0], a[1]).length", [info['item'], info['size']])
            await pg.locator('#sheet button[data-partall]').first.click(); await pg.wait_for_timeout(500)
            st = await state(pg); check(len(st.get('rigOv', {})) >= users, 'AD: “N rigde kullan” → %d rigde değişti' % len(st.get('rigOv', {})))
            await pg.evaluate("() => { window.ALYSSA_QA.state().rigOv = {}; window.ALYSSA_QA.invChanged(); }"); await pg.wait_for_timeout(300)
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        # 6) envanter değişince: rig değişiklik paneli; "Rigleri envantere göre güncelle"
        tgt = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const rg = Q.rigs().find(r => Q.ready(r)); const sl = rg.slots.find(s => s.kind === 'hook'); return {rid: rg.id, code: rg.code, k: sl.k, key: sl.t.envanter.item + '|' + (sl.t.envanter.size || '-')}; }""")
        await pg.evaluate("(k) => { window.ALYSSA_QA.setStatus(k, 'yok'); window.ALYSSA_QA.invChanged(); }", tgt['key']); await pg.wait_for_timeout(400)
        ch = await pg.inner_text('#sysTools .rigch') if await pg.locator('#sysTools .rigch').count() else ''
        print('   değişiklik:', ch.replace('\n', ' ')[:200])
        check('Rigler envantere göre güncellendi' in ch and tgt['code'] in ch, 'AD: envanter değişince değişen rigler gösterildi')
        await pg.click('#sysTools button[data-act="rigChClose"]'); await pg.wait_for_timeout(200)
        check(await pg.locator('#sysTools .rigch').count() == 0, 'AD: panel kapandı')
        await pg.evaluate("(k) => { window.ALYSSA_QA.setStatus(k, 'var'); window.ALYSSA_QA.persist && 0; }", tgt['key'])
        await pg.click('#sysTools button[data-act="rigRefresh"]'); await pg.wait_for_timeout(400)
        t = await pg.inner_text('#toast')
        check(re.search(r'\d+ rig: \d+ hazır', t) and 'hazır oldu' in t, 'AD: “Rigleri envantere göre güncelle” özet verdi: ' + t)
        # 7) parça sayfası: eksik parça → yerine alınabilecekler → listeye ekle
        miss = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; for (const rg of Q.rigs()) for (const sl of Q.missingOf(rg)) { if (sl.kind === 'hook' && Q.partBuyAlts(sl).length) return {rid: rg.id, k: sl.k}; } return null; }""")
        check(miss is not None, 'AD: eksik iğne için yerine alınabilecekler var')
        if miss:
            await pg.locator('#rigList button.crow.tap[data-part="%s|%s"]' % (miss['rid'], miss['k'])).click(); await pg.wait_for_timeout(400)
            check('Bulamazsan yerine alınabilecekler' in await pg.inner_text('#sheet'), 'AD: “Bulamazsan yerine alınabilecekler” bölümü')
            await pg.locator('#sheet button[data-partbuy]').first.click(); await pg.wait_for_timeout(300)
            st = await state(pg); alts = [x for x in st['shopX'].values() if x['k'].startswith('alt:')]
            check(len(alts) == 1 and alts[0]['sp']['kind'] == 'hook', 'AD: yerine alınacak iğne alışveriş listesine eklendi')
            await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 800}); await pg.wait_for_timeout(150); await overflow(pg, 'AD %d px Rigler' % w)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        await pg.screenshot(path=SHOTS + '/ad_rigs.png')
        print('AD errors:', errs); check(not errs, 'AD: sayfa hatası yok')
        await ctx.close(); await b.close()
    print('SONUÇ:', 'HEPSİ GEÇTİ' if not FAIL else '%d HATA: %s' % (len(FAIL), FAIL))

try:
    asyncio.run(main())
finally:
    srv.terminate()
