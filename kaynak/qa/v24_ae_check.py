"""Alyssa v0.3–v0.22 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
Çalıştır: python3 /home/claude/fishapp/qa/v22_check.py
"""
import os, sys
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import fbmock   # sahte Firebase

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_e'
SHOTS = ROOT + '/qa/v24e'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(os.environ.get('ALYSSA_DIST', ROOT + '/app/dist'), WWW + '/dist')   # ALYSSA_DIST: sabitlenmiş bir derlemeyi test etmek için
prev = open(os.environ.get('ALYSSA_PREV', ROOT + '/app/preview/alyssa_onizleme.html'), encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8792
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

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        # ================================================== AE) v0.24: kamış + makine, Fishing listeleri, yağış 0, Rig Atölyesi konumu
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="paket"]'); await pg.fill('#wel-pass', KEY['pass_']); await pg.click('#welBtn'); await pg.wait_for_timeout(6000)
        g = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const out = {};
          Q.rigs().filter(r => r.sys === 'ozel').forEach(r => { const R = r.slots.find(s => s.kind === 'rod'), M = r.slots.find(s => s.kind === 'reel');
            out[r.code] = {g: r.group, rod: R && R.t.envanter.item, rf: R && R.fit, reel: M && M.t.envanter.item, mf: M && M.fit, why: (R && R.fitWhy || []).concat(M && M.fitWhy || []), ready: Q.ready(r)}; });
          return out; }""")
        print('   özel takımlar:', len(g), 'rig')
        check(len(g) == 32 and all(v['rod'] and v['reel'] for v in g.values()), 'AE: 32 rigin hepsinde kamış ve makine')
        pg_ = [v for v in g.values() if v['g'] == 'PG']; tg = [v for v in g.values() if v['g'] in ('TG', 'NT')]
        check(pg_ and all(v['rod'] == PG_ROD and v['reel'] == PG_REEL for v in pg_), 'AE: porsiyonluk gündüz: kurulumdaki kamış ve makine')
        check(tg and all(v['rod'] == TG_ROD and v['reel'] == TG_REEL for v in tg), 'AE: trofe: kurulumdaki kamış ve makine')
        check(all(v['rf'] == 'ok' and v['mf'] == 'ok' for v in g.values()), 'AE: kurulumdaki takımlar uygun: ' + str([(k, v['why']) for k, v in g.items() if v['rf'] != 'ok' or v['mf'] != 'ok'][:3]))
        np_ = [v for v in g.values() if v['g'] == 'NP']
        check(np_ and all(v['rod'] == NP_ROD for v in np_), 'AE: porsiyonluk gece: kurulumdaki tek kamış')
        # 2) rig kartında kamış ve makine satırları
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(400)
        c1 = await pg.locator('#rigList article.rig').first.inner_text()
        check(U('Kamış') in U(c1) and NM(PG_ROD) in c1 and ' m · en fazla %d g' % imax(PG_ROD) in c1 and U('Makine') in U(c1) and NM(PG_REEL) in c1, 'AE: kartta Kamış ve Makine satırı, ölçüleriyle')
        nG = await pg.locator('#rigList button.crow.gear').count(); check(nG == 64, 'AE: 32 rigde kamış ve makine satırı dokunulabilir (%d)' % nG)
        await pg.set_viewport_size({'width': 390, 'height': 2400}); await pg.wait_for_timeout(200)
        await pg.locator('#rigList article.rig').first.screenshot(path=SHOTS + '/ae_kart.png')
        await pg.set_viewport_size({'width': 390, 'height': 860})
        # 3) Kamış ve makine sayfası
        rid = await pg.locator('#rigList button.crow.gear').first.get_attribute('data-gear')
        await pg.locator('#rigList button.crow.gear').first.click(); await pg.wait_for_timeout(400)
        sh = await pg.inner_text('#sheet')
        check('Kamış ve makine' in sh and 'Bu rigin istediği' in sh and 'Kurulumun' in sh and 'Elindeki diğer kamışlar' in sh and all(NM(i) in sh for i in OTHER_RODS), 'AE: Kamış ve makine sayfası: istenen, kurulum, diğer kamışlar')
        check('Elindeki diğer makineler' in sh and all(NM(i) in sh for i in OTHER_REELS), 'AE: diğer makineler listesi')
        await pg.set_viewport_size({'width': 390, 'height': 3200}); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SHOTS + '/ae_takim.png')
        await pg.set_viewport_size({'width': 390, 'height': 860})
        # 4) tetikli kamış seç → makine kendiliğinden çıkrık
        await pg.click('#sheet button[data-gearuse="%s|kamis|%s"]' % (rid, TG_ROD)); await pg.wait_for_timeout(500)
        e = await pg.evaluate("(rid) => { const r = window.ALYSSA_QA.rigs().find(x => x.id === rid); const R = r.slots.find(s => s.kind === 'rod'), M = r.slots.find(s => s.kind === 'reel'); return {rod: R.t.envanter.item, user: R.user, reel: M.t.envanter.item, rf: R.fit, mf: M.fit}; }", rid)
        check(TG_ROD in CAST and e['rod'] == TG_ROD and e['user'] and e['reel'] == TG_REEL and e['rf'] == 'ok' and e['mf'] == 'ok', 'AE: tetikli kamış seçilince makine çıkrık oldu')
        check('Otomatik seçime dön' in await pg.inner_text('#sheet'), 'AE: “Otomatik seçime dön”')
        # 5) bilerek uymayan makine: tetikli kamışa spinning → uyarı, rig yine hazır (senin seçimin)
        await pg.click('#sheet button[data-gearuse="%s|makine|%s"]' % (rid, PG_REEL)); await pg.wait_for_timeout(500)
        e = await pg.evaluate("(rid) => { const Q = window.ALYSSA_QA; const r = Q.rigs().find(x => x.id === rid); const M = r.slots.find(s => s.kind === 'reel'); return {reel: M.t.envanter.item, mf: M.fit, why: M.fitWhy, user: M.user, gearMiss: Q.missingOf(r).filter(s => s.kind === 'rod' || s.kind === 'reel').length, gi: Q.gearIssues(r).map(g => g.txt)}; }", rid)
        check(e['reel'] == PG_REEL and e['mf'] == 'bad' and any('spinning makine takılmaz' in w for w in e['why']) and e['user'] and e['gearMiss'] == 0, 'AE: tetikli kamışa spinning: uygun değil, senin seçimin, eksik sayılmaz: ' + json.dumps(e, ensure_ascii=False))
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        card = await pg.locator('#rigList article.rig').first.inner_text()
        check('Makine uygun değil' in card and 'Senin seçimin, uygun değil' in card, 'AE: kartta “Makine uygun değil” ve nedeni')
        await pg.set_viewport_size({'width': 390, 'height': 2400}); await pg.wait_for_timeout(200)
        await pg.locator('#rigList article.rig').first.screenshot(path=SHOTS + '/ae_uygunsuz.png')
        await pg.set_viewport_size({'width': 390, 'height': 860})
        await pg.locator('#rigList button.crow.gear').first.click(); await pg.wait_for_timeout(400)
        await pg.click('#sheet button[data-gearauto="%s|makine"]' % rid); await pg.wait_for_timeout(400)
        await pg.click('#sheet button[data-gearauto="%s|kamis"]' % rid); await pg.wait_for_timeout(400)
        e = await pg.evaluate("(rid) => { const r = window.ALYSSA_QA.rigs().find(x => x.id === rid); return [r.slots.find(s => s.kind === 'rod').t.envanter.item, r.slots.find(s => s.kind === 'reel').t.envanter.item]; }", rid)
        check(e == [PG_ROD, PG_REEL], 'AE: otomatiğe dönünce kurulum takımı')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        # 6) tür planı (canlı yem lüfer): 150–300 g → en çok taşıyan kamış seçilir, sınırda; kurşun kamışla sınırlı
        lf = await pg.evaluate("""() => { const Q = window.ALYSSA_QA; const p = Q.planFor({id: 'lufer', name: 'Lüfer'}); const r = p.rg; const R = r.slots.find(s => s.kind === 'rod'), M = r.slots.find(s => s.kind === 'reel');
          const ld = Q.leadFor(r, Q.days()[0]); return {tech: p.tech, lay: r.lay, g: r.sinker && r.sinker.g, rod: R && R.t.envanter.item, rf: R && R.fit, why: R && R.fitWhy, reel: M && M.t.envanter.item, mf: M && M.fit, max: ld && ld.max, cap: ld && ld.rodCap, k: ld && ld.kursun}; }""")
        print('   lüfer:', lf['tech'], lf['lay'], lf['rf'], lf['mf'], lf['max'])
        if lf['lay'] == 'canli':
            rmax = imax(lf['rod']) if lf['rod'] in IT else None; strongest = max(imax(i) or 0 for i in IT if IT[i]['cat'] == 'rod')
            check(rmax and rmax >= 180 and lf['rf'] == 'warn' and any(str(rmax) + ' g' in w for w in lf['why']) and lf['mf'] == 'ok' and (lf['rod'] not in CAST or IT[lf['reel']]['spec'].lower().find('spinning') < 0), 'AE: canlı yem 150–300 g: güçlü kamış seçildi (%s g), sınırda; makine kamışın yuvasına uygun' % rmax)
            check(lf['max'] == rmax and lf['cap'], 'AE: kurşun kamışın taşıdığıyla sınırlı (%s g)' % rmax)
        else:
            check(lf['rod'] and lf['reel'], 'AE: lüfer planında kamış ve makine: ' + str(lf['lay']))
        # 7) Fishing: diğer uygun ve eksik bekleyen rigler tıklanabilir
        await pg.click('.tabbar button[data-v="fishing"]'); await pg.wait_for_timeout(600)
        nm = await pg.locator('#recMore button.rec.tap').count(); nb = await pg.locator('#recBlocked button.rec.tap').count()
        print('   diğer uygun:', nm, '· eksik bekleyen:', nb)
        check(nm + nb >= 1, 'AE: Fishing alt listelerinde dokunulabilir rig satırları (%d + %d)' % (nm, nb))
        btn = pg.locator('#recMore button.rec.tap').first if nm else pg.locator('#recBlocked button.rec.tap').first
        if nm: await pg.click('#recMoreW summary') if await pg.locator('#recMoreW summary').count() else None
        rid2 = await btn.get_attribute('data-rigopen'); await btn.click(); await pg.wait_for_timeout(500)
        check(await pg.locator('#sheet article.rig').count() == 1 and rid2.split(':')[-1] in await pg.inner_text('#sheet'), 'AE: satıra dokununca rigin tam kartı açıldı')
        await pg.locator('#sheet button.crow.tap[data-part]').first.click(); await pg.wait_for_timeout(400)
        check('Elindeki yedekler' in await pg.inner_text('#sheet'), 'AE: rig sayfasından parça sayfası')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(400)
        check(await pg.locator('#sheet article.rig').count() == 1, 'AE: parça sayfasında Geri → rig sayfasına döndü')
        await pg.locator('#sheet button.crow.gear').first.click(); await pg.wait_for_timeout(400)
        check('Kamış ve makine' in await pg.inner_text('#sheet'), 'AE: rig sayfasından kamış ve makine sayfası')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(400)
        check(await pg.locator('#sheet article.rig').count() == 1, 'AE: kamış sayfasında Geri → rig sayfası')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(400)
        check(await pg.is_hidden('#sheet'), 'AE: rig sayfasında Geri → kapandı')
        # 8) saatlik tablo: yağış 0 iken boş
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(400)
        # örnek veride yağışsız saat yok: ilk günün 4 saatini sıfırla, tabloyu yeniden çiz
        zk = await pg.evaluate("() => { const d = window.ALYSSA_QA.days()[0]; d.hs.slice(2, 6).forEach(h => { h.pop = 0; h.rain = 0; }); return d.key; }")
        await pg.click('#dayChips button[data-hday="%s"]' % zk); await pg.wait_for_timeout(300)
        yi = await row_idx(pg, 'Yağış %'); mi = await row_idx(pg, 'Yağış mm')
        yt = await pg.locator('#hTable tr').nth(yi).locator('td').all_inner_texts() if yi >= 0 else []
        hs = await pg.evaluate("() => { const d = window.ALYSSA_QA.days().find(x => x.key === document.querySelector('#dayChips button[aria-pressed=true]').dataset.hday); return d.hs.map(x => [x.pop, x.rain]); }")
        zero = [i for i, (pp, rr) in enumerate(hs) if pp is not None and round(pp) == 0]
        print('   yağış hücreleri:', yt[:8], '· sıfır saat:', len(zero))
        check(yi >= 0 and zero and not any(t.strip() == '%0' for t in yt) and all(yt[i].strip() == '' for i in zero if i < len(yt)), 'AE: Yağış %% 0 iken boş (%d saat)' % len(zero))
        if mi >= 0:
            mt = await pg.locator('#hTable tr').nth(mi).locator('td').all_inner_texts()
            check(not any(t.strip() == '0' for t in mt), 'AE: Yağış mm 0 iken boş')
        # 9) Rig Atölyesi: deniz yerine nokta
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.click('#sysBar button[data-act="wizard"]'); await pg.wait_for_timeout(300)
        sh = await pg.inner_text('#sheet')
        check('Hangi noktada avlanıyorsun?' in sh and 'Hangi denizde' not in sh and await pg.locator('#sheet button[data-wzr]').count() == 0, 'AE: Rig Atölyesi “Hangi denizde” yerine nokta soruyor')
        check(await pg.get_attribute('#sheet button[data-wzloc="1"]', 'aria-pressed') == 'true' and 'Ege' in await pg.inner_text('#sheet .wzreg'), 'AE: seçili konum (Konum 1) önceden seçili, bölge Ege')
        await pg.set_viewport_size({'width': 390, 'height': 1600}); await pg.wait_for_timeout(200)
        await pg.screenshot(path=SHOTS + '/ae_wz_nokta.png')
        await pg.set_viewport_size({'width': 390, 'height': 860})
        await pg.click('#sheet details.wzmore summary'); await pg.fill('#wz-lat', '41,25'); await pg.fill('#wz-lon', '29,10'); await pg.click('#sheet button[data-wzcoord]'); await pg.wait_for_timeout(400)
        st = await state(pg); kd = [l for l in st['locations'].values() if l['name'].startswith('Rig noktası')]
        check(len(kd) == 1 and 'Karadeniz' in await pg.inner_text('#sheet .wzreg'), 'AE: koordinatla nokta eklendi, bölge Karadeniz')
        await pg.click('button[data-wzm="tekne"]'); await pg.click('button[data-wz="next"]'); await pg.click('button[data-wzt="dip"]'); await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(250)
        check('(Karadeniz)' in await pg.inner_text('#sheet'), 'AE: türler noktanın bölgesine göre (Karadeniz)')
        await pg.click('button[data-wz="back"]'); await pg.click('button[data-wz="back"]'); await pg.wait_for_timeout(200)
        # haritadan nokta: Rig Atölyesinde kullan
        await pg.click('#sheet button[data-wzmap]'); await pg.wait_for_timeout(1500)
        check(await pg.is_visible('#map'), 'AE: Rig Atölyesinden harita açıldı')
        await pg.evaluate("() => window.ALYSSA_QA.pickPoint(38.20, 26.75)"); await pg.wait_for_timeout(2500)
        check(await pg.locator('#mapCard button[data-mapact="wzuse"]').count() == 1, 'AE: harita kartında “Rig Atölyesinde kullan”')
        await pg.click('#mapCard button[data-mapact="wzuse"]'); await pg.wait_for_timeout(500)
        sh = await pg.inner_text('#sheet'); st = await state(pg)
        new_id = [l['id'] for l in st['locations'].values() if abs(l['lat'] - 38.20) < 1e-4 and abs(l['lon'] - 26.75) < 1e-4]
        check(new_id and 'Hangi noktada' in sh and await pg.get_attribute('#sheet button[data-wzloc="%s"]' % new_id[0], 'aria-pressed') == 'true', 'AE: haritadaki nokta kaydedildi ve sihirbazda seçildi')
        await pg.click('#sheet button[data-wzmap]'); await pg.wait_for_timeout(1200)
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(400)
        check('Hangi noktada' in await pg.inner_text('#sheet'), 'AE: haritada Geri → Rig Atölyesine döndü')
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(300)
        for w in [390, 320]:
            await pg.set_viewport_size({'width': w, 'height': 800}); await pg.wait_for_timeout(150); await overflow(pg, 'AE %d px Rigler' % w)
        await pg.set_viewport_size({'width': 390, 'height': 860})
        print('AE1 errors:', errs); check(not errs, 'AE: sayfa hatası yok (Kenny)')
        await ctx.close()
        # ================================================== yeni kullanıcı: yalnız LRF kamışı → canlı/dip için uygun değil
        ctx, pg, errs = await new_ctx(b)
        await pg.goto(BASE + '/dist/?qa=1'); await pg.wait_for_timeout(1000)
        await pg.click('button[data-wel="bos"]'); await pg.wait_for_timeout(300)
        await pg.click('.tabbar button[data-v="envanter"]'); await pg.click('button[data-iseg="gear"]'); await pg.wait_for_timeout(150)
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.fill('#it-brand', 'Major Craft'); await pg.fill('#it-model', 'LRF 7'); await pg.select_option('#it-rodt', 'lrf'); await pg.fill('#it-rodl', '2,1'); await pg.fill('#it-rodm', '7'); await pg.select_option('#it-rods', 'spin'); await pg.click('#itSave'); await pg.wait_for_timeout(250)
        await pg.click('#addItem'); await pg.wait_for_timeout(200); await pg.select_option('#it-cat', 'reel'); await pg.fill('#it-brand', 'Shimano'); await pg.fill('#it-model', 'Sahara 2000'); await pg.fill('#it-reels', '2000'); await pg.click('#itSave'); await pg.wait_for_timeout(250)
        st = await state(pg); rod = [i for i in st['inv']['items'].values() if i['cat'] == 'rod'][0]
        check(rod['rod'].get('seat') == 'spin', 'AE: kamış formunda makara yuvası kaydedildi')
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('#moreMenu button[data-open="turler"]'); await pg.wait_for_timeout(300)
        await pg.fill('#tr-q', 'karagöz'); await pg.wait_for_timeout(200); await pg.click('#trRes button[data-tradd="karagoz"]'); await pg.wait_for_timeout(400)
        await pg.click('#sheet button[data-trrig="karagoz"]'); await pg.wait_for_timeout(400)
        await pg.click('#sheet button[data-open="turler"]'); await pg.wait_for_timeout(250); await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        await pg.click('.tabbar button[data-v="rigler"]'); await pg.wait_for_timeout(400)
        card = await pg.locator('#rigList article.rig').first.inner_text()
        print('   kart:', card.replace('\n', ' | ')[:400])
        check('Major Craft LRF 7' in card and 'Envanterden girildi ama uygun değil' in card and 'Uygun değil' in card, 'AE: elindeki tek kamış (LRF) rige uymuyor: girildi ama uygun değil')
        check('Gereken:' in card, 'AE: kartta gereken kamış ölçüsü')
        mk = await pg.evaluate("() => { const Q = window.ALYSSA_QA; const r = Q.rigs()[0]; return {miss: Q.missingOf(r).map(s => s.label), sl: Q.shoppingList().filter(n => n.kind === 'rod').map(n => [n.item, n.name])}; }")
        check('Kamış' in mk['miss'] and mk['sl'] and all(x[0] is None for x in mk['sl']), 'AE: rig tamamlanmadı; alışveriş listesinde LRF değil gereken kamış: ' + json.dumps(mk, ensure_ascii=False)[:200])
        await pg.locator('#rigList button.crow.gear').first.click(); await pg.wait_for_timeout(400)
        sh = await pg.inner_text('#sheet')
        check('Uygun kamış al' in sh and 'Aranacak ölçü' in sh and 'Örnek seriler' in sh, 'AE: kamış sayfasında aranacak ölçü ve örnek seriler')
        await pg.set_viewport_size({'width': 390, 'height': 2600}); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SHOTS + '/ae_lrf.png')
        await pg.set_viewport_size({'width': 390, 'height': 860})
        await pg.click('#sheet button[data-gearbuy$="|rod"]'); await pg.wait_for_timeout(300)
        st = await state(pg); gk = [x for x in st['shopX'].values() if x['k'].startswith('gear:rod')]
        check(gk and gk[0]['sp'].get('minG'), 'AE: “Alışveriş listesine ekle” → gereken kamış listede (en az %s g)' % (gk[0]['sp'].get('minG') if gk else '-'))
        # bilerek seçilen uygunsuz kamış: rig hazır sayılır (makine ve terminal hariç kalanı tamsa)
        await pg.locator('#sheet [data-close]').first.click(); await pg.wait_for_timeout(200)
        print('AE2 errors:', errs); check(not errs, 'AE: sayfa hatası yok (yeni kullanıcı)')
        await ctx.close(); await b.close()
    print('SONUÇ:', 'HEPSİ GEÇTİ' if not FAIL else '%d HATA: %s' % (len(FAIL), FAIL))

try:
    asyncio.run(main())
finally:
    srv.terminate()
