import asyncio, json, os, shutil, subprocess, sys, time, urllib.parse
from playwright.async_api import async_playwright

ROOT = '/home/claude/fishapp'
WWW = ROOT + '/qa/www'
SHOTS = ROOT + '/qa/v2'
os.makedirs(SHOTS, exist_ok=True)
if os.path.isdir(WWW): shutil.rmtree(WWW)
shutil.copytree(ROOT + '/app/dist', WWW + '/dist')
prev = open(ROOT + '/app/preview/kenny_av_onizleme.html', encoding='utf-8').read()
open(WWW + '/preview.html', 'w', encoding='utf-8').write('<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + prev + '</body></html>')
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', WWW], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
KEY = json.load(open(ROOT + '/secret/key.json'))
# örnek veriden sahte Open-Meteo yanıtları
import re
m = re.search(r'<script id="sample" type="application/json">(.*?)</script>', prev, re.S)
SMP = json.loads(m.group(1))['raw']
FAKE_NOW = "const _D=Date;const _base=new _D('2026-10-17T09:30:00+03:00').getTime();const _s=_D.now();class FD extends _D{constructor(...a){if(a.length===0)super(_base+(_D.now()-_s));else super(...a);} static now(){return _base+(_D.now()-_s);}};window.Date=FD;"
calls = []

def mock(route):
    u = route.request.url; q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query)
    calls.append(u)
    model = (q.get('models') or [''])[0]
    if 'marine' in u:
        if model == 'meteofrance_wave':
            return route.fulfill(status=400, content_type='application/json', body=json.dumps({'error': True, 'reason': 'test'}))
        h = dict(SMP['mbest']['hourly']); h.update({k: SMP['mf']['hourly'][k] for k in ('wave_height', 'wave_direction', 'wave_period')})
        return route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps({'hourly': h, 'hourly_units': SMP['mbest']['hourly_units']}))
    src = {'icon_eu': 'icon', 'ecmwf_ifs025': 'ecmwf', 'gfs_seamless': 'gfs', '': 'best'}.get(model)
    if not src:
        return route.fulfill(status=400, body='{}')
    r = SMP[src]
    if src == 'best':
        h = dict(SMP['ecmwf']['hourly']); h['precipitation_probability'] = SMP['best']['hourly']['precipitation_probability']; h['wind_gusts_10m'] = SMP['gfs']['hourly']['wind_gusts_10m']
        r = {'hourly': h, 'hourly_units': {'wind_speed_10m': 'm/s'}}
    return route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(r))


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        # ---------------------------------------------------------- önizleme
        ctx = await b.new_context(viewport={'width': 390, 'height': 860}, timezone_id='Europe/Istanbul', device_scale_factor=2)
        await ctx.add_init_script(FAKE_NOW)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'fonts' not in m.text and 'ERR_' not in m.text else None)
        await pg.goto('http://127.0.0.1:8765/preview.html'); await pg.wait_for_timeout(1200)
        rows = await pg.locator('#hTable tr').count(); cells = await pg.locator('#hTable tr').nth(2).locator('td').count()
        print('PREVIEW hourly rows', rows, 'fish cells', cells, '| note:', await pg.inner_text('#hourlyNote'))
        print('wind row label:', (await pg.locator('#hTable tr').nth(7).locator('th').inner_text()).replace('\n', ' '), '| wave label:', (await pg.locator('#hTable tr').nth(10).locator('th').inner_text()).replace('\n', ' '))
        print('first 6 fish %:', [ (await pg.locator('#hTable tr').nth(2).locator('td').nth(i).inner_text()).replace('\n','') for i in range(6)])
        print('now grid:', (await pg.inner_text('#nowGrid')).replace('\n', ' | ')[:300])
        await pg.screenshot(path=SHOTS + '/p_bugun.png')
        await pg.locator('#hourly').screenshot(path=SHOTS + '/p_hourly.png')
        for v in ['takvim', 'avlar', 'rigler', 'envanter', 'daha']:
            await pg.click(f'.tabbar button[data-v="{v}"]'); await pg.wait_for_timeout(250)
            ov = await pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
            if ov: print('OVERFLOW', v, ov)
            await pg.screenshot(path=SHOTS + f'/p_{v}.png')
        # takvimde güne dokun -> saatlik
        await pg.click('.tabbar button[data-v="takvim"]'); await pg.click('button[data-calday="2026-10-19"]'); await pg.wait_for_timeout(300)
        print('calday -> pressed chip:', await pg.locator('#dayChips button[aria-pressed="true"]').inner_text())
        # av kaydı
        await pg.click('.tabbar button[data-v="avlar"]'); await pg.click('#addCatch'); await pg.wait_for_timeout(200)
        await pg.set_input_files('#cfGal', ROOT + '/qa/test_fish.jpg'); await pg.wait_for_timeout(1500)
        print('photo time:', await pg.input_value('#cf-t'), '| loc:', await pg.inner_text('#cfLoc'), '| note:', await pg.inner_text('#cfPhotoNote'))
        await pg.select_option('#cf-sp', 'cipura'); await pg.fill('#cf-kg', '1,35'); await pg.fill('#cf-cm', '38'); await pg.select_option('#cf-rig', 'G-P5'); await pg.select_option('#cf-bait', 'Sülünez')
        await pg.screenshot(path=SHOTS + '/p_form.png', full_page=False)
        await pg.click('#cfSave'); await pg.wait_for_timeout(800)
        print('catch list:', (await pg.inner_text('#catchList')).replace('\n', ' | '), '| stats:', (await pg.inner_text('#catchStats')).replace('\n', ' '))
        await pg.screenshot(path=SHOTS + '/p_avlar2.png')
        await pg.click('button[data-catch]'); await pg.wait_for_timeout(600)
        print('detail kv:', (await pg.inner_text('#sheet')).replace('\n', ' | ')[:500])
        await pg.screenshot(path=SHOTS + '/p_detail.png')
        # düzenle -> kaydet
        await pg.click('button[data-editcatch]'); await pg.wait_for_timeout(300); await pg.fill('#cf-kg', '1,4'); await pg.click('#cfSave'); await pg.wait_for_timeout(600)
        print('after edit:', (await pg.inner_text('#catchList')).replace('\n', ' | '))
        # reload -> kalıcılık
        await pg.reload(); await pg.wait_for_timeout(1200); await pg.click('.tabbar button[data-v="avlar"]'); await pg.wait_for_timeout(300)
        print('after reload:', (await pg.inner_text('#catchList')).replace('\n', ' | '))
        await pg.click('button[data-catch]'); await pg.wait_for_timeout(500); await pg.click('#delCatch'); await pg.click('#delCatch'); await pg.wait_for_timeout(600)
        print('after delete:', (await pg.inner_text('#catchList')).replace('\n', ' | '))
        print('PREVIEW errors:', errs)
        await ctx.close()
        # ---------------------------------------------------------- yayın sürümü (şifreli veri + sahte API)
        ctx = await b.new_context(viewport={'width': 390, 'height': 860}, timezone_id='Europe/Istanbul')
        await ctx.add_init_script(FAKE_NOW)
        await ctx.route('https://api.open-meteo.com/**', mock); await ctx.route('https://marine-api.open-meteo.com/**', mock)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'fonts' not in m.text else None)
        await pg.goto('http://127.0.0.1:8765/dist/'); await pg.wait_for_timeout(1500)
        print('DIST lock visible:', await pg.is_visible('#lock'))
        await pg.fill('#lockPass', 'yanlis-sifre-1234'); await pg.click('#lockBtn'); await pg.wait_for_timeout(4000)
        print('wrong pass err:', await pg.is_visible('#lockErr'))
        await pg.fill('#lockPass', '  ' + KEY['pass_'].upper().replace('-', ' ') + ' '); await pg.click('#lockBtn'); await pg.wait_for_timeout(5000)
        print('unlocked:', not await pg.is_visible('#lock'), '| top:', await pg.inner_text('#locName'))
        await pg.wait_for_timeout(1500)
        print('net:', await pg.inner_text('#net'), '| hourly rows:', await pg.locator('#hTable tr').count())
        print('wind label:', (await pg.locator('#hTable tr').nth(7).locator('th').inner_text()).replace('\n', ' '), '| wave label:', (await pg.locator('#hTable tr').nth(10).locator('th').inner_text()).replace('\n', ' '))
        await pg.click('.tabbar button[data-v="daha"]'); await pg.wait_for_timeout(300)
        print('sources:', (await pg.inner_text('#srcList')).replace('\n', ' | '))
        await pg.screenshot(path=SHOTS + '/d_daha.png', full_page=True)
        await pg.reload(); await pg.wait_for_timeout(2500)
        print('after reload lock visible:', await pg.is_visible('#lock'), '| sw:', await pg.evaluate('navigator.serviceWorker && navigator.serviceWorker.controller ? "controlled" : "not yet"'))
        print('api calls:', len(calls), sorted(set(urllib.parse.parse_qs(urllib.parse.urlparse(c).query).get('models', ['best'])[0] for c in calls)))
        print('DIST errors:', errs)
        await ctx.close(); await b.close()

try:
    asyncio.run(main())
finally:
    srv.terminate()
