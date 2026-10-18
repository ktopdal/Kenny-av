"""Alyssa v0.3–v0.4 uçtan uca testleri (Playwright, sahte Open-Meteo ve sahte GitHub API ile).
Çalıştır: python3 /home/claude/fishapp/qa/v3_check.py
"""
import asyncio, base64, hashlib, json, os, re, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www_t'
SHOTS = ROOT + '/qa/v4'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(ROOT + '/app/dist', WWW + '/dist')
prev = open(ROOT + '/app/preview/alyssa_onizleme.html', encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
PORT = 8767
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
        if not f: return await route.fulfill(status=404, headers=hdr, content_type='application/json', body='{"message":"Not Found"}')
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

async def new_ctx(b, storage=None, w=390):
    ctx = await b.new_context(viewport={'width': w, 'height': 860}, timezone_id='Europe/Istanbul', device_scale_factor=2, permissions=['geolocation'], geolocation={'latitude': 38.45, 'longitude': 27.20})
    await ctx.add_init_script(FAKE_NOW)
    if storage:
        await ctx.add_init_script('if(!sessionStorage.getItem("seeded")){' + ''.join('localStorage.setItem(%s,%s);' % (json.dumps(k), json.dumps(v)) for k, v in storage.items()) + 'sessionStorage.setItem("seeded","1");}')
    await ctx.route('https://api.open-meteo.com/**', mock_meteo); await ctx.route('https://marine-api.open-meteo.com/**', mock_meteo)
    await ctx.route('https://api.github.com/**', mock_gh)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'fonts' not in m.text and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
    return ctx, pg, errs

async def overflow(pg, tag):
    ov = await pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
    check(ov <= 0, 'yatay taşma yok: ' + tag + (' (' + str(ov) + ' px)' if ov > 0 else ''))

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
        cell = pg.locator('#hTable tr').nth(7).locator('td').nth(3)
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
        check(await pg.locator('#moreMenu .mrow').count() == 9, 'Daha menüsü 9 satır')
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
        await pg.click('#locBtn'); await pg.wait_for_timeout(200)
        await pg.fill('#nl-name', 'Kara noktası'); await pg.fill('#nl-lat', '38.45'); await pg.fill('#nl-lon', '27.20')
        await pg.click('#locForm button[type="submit"]'); await pg.wait_for_timeout(300)
        await pg.click('#sheet [data-close]'); await pg.wait_for_timeout(4000)
        await pg.click('.tabbar button[data-v="bugun"]'); await pg.wait_for_timeout(300)
        sea = await pg.inner_text('#seaNote') if await pg.is_visible('#seaNote') else ''
        check('km' in sea, 'karadaki nokta: ' + sea)
        wave = (await pg.locator('#hTable tr').nth(10).locator('td').nth(2).inner_text()).strip()
        check(wave not in ('–', ''), 'karadaki noktada dalga değeri geldi: ' + wave)
        st = await state(pg); L = st['locations'][st['active']]
        check(L.get('sea') and abs(L['sea']['lat'] - 38.513) < 0.01, 'deniz noktası kaydedildi: ' + json.dumps(L.get('sea')))
        net = await pg.inner_text('#net'); check(net.startswith('Güncel'), 'durum karadaki noktada da Güncel: ' + net)
        await pg.screenshot(path=SHOTS + '/a_kara_nokta.png')
        # Konum 1'e dön ve av ekle (fotoğraf + dip)
        await pg.click('#locBtn'); await pg.wait_for_timeout(200)
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
        ready_n = await pg.locator('#rigList article.rig:not(.off)').count()
        check(ready_n >= 2, 'F: envanter eklenince porsiyon dip rigleri hazır (%d)' % ready_n)
        await pg.screenshot(path=SHOTS + '/f_rigler_hazir.png')
        # alışveriş: orkinos için eksikler, "Aldım, envantere ekle"
        await pg.click('.tabbar button[data-v="daha"]'); await pg.click('button[data-open="alisveris"]'); await pg.wait_for_timeout(300)
        nb = await pg.locator('#sheet button[data-buyadd]').count(); check(nb >= 3, 'F: envanterde olmayan ürünler listede (%d)' % nb)
        await pg.screenshot(path=SHOTS + '/f_alisveris.png')
        while await pg.locator('#sheet button[data-buyadd]').count():
            await pg.click('#sheet button[data-buyadd] >> nth=0'); await pg.wait_for_timeout(200)
        check('Eksik kalem yok' in await pg.inner_text('#sheet'), 'F: tüm eksikler envantere eklenince liste boşaldı')
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
        for _ in range(4): await pg.click('button[data-wz="next"]'); await pg.wait_for_timeout(120)
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
