"""Sahte Firebase (Identity Toolkit + Secure Token + Firestore REST) — Playwright route işleyicileri."""
import base64, json, re, time, urllib.parse
FB = {'users': {}, 'docs': {}, 'log': []}   # users: email -> {uid, pass}; docs: path -> {fields, t}
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'}
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
def tok(uid, email):
    now = int(time.time())
    return b64({'alg': 'RS256', 'typ': 'JWT'}) + '.' + b64({'iss': 'https://securetoken.google.com/alyssa-test', 'aud': 'alyssa-test', 'auth_time': now, 'user_id': uid, 'sub': uid, 'iat': now, 'exp': now + 3600, 'email': email, 'email_verified': False, 'firebase': {'identities': {'email': [email]}, 'sign_in_provider': 'password'}}) + '.c2ln'
def uid_of(t):
    try: return json.loads(base64.urlsafe_b64decode(t.split('.')[1] + '==='))['user_id']
    except Exception: return None
async def ok(route, o, status=200): await route.fulfill(status=status, content_type='application/json', headers=CORS, body=json.dumps(o))
async def auth(route):
    req = route.request
    if req.method == 'OPTIONS': return await route.fulfill(status=204, headers=CORS)
    u = req.url; body = json.loads(req.post_data or '{}'); FB['log'].append(('auth', u.split('?')[0].split('/')[-1]))
    def err(msg): return ok(route, {'error': {'code': 400, 'message': msg, 'errors': [{'message': msg}]}}, 400)
    if 'accounts:signUp' in u:
        e = body.get('email', '').lower()
        if e in FB['users']: return await err('EMAIL_EXISTS')
        if len(body.get('password', '')) < 6: return await err('WEAK_PASSWORD : Password should be at least 6 characters')
        uid = 'u%03d' % (len(FB['users']) + 1); FB['users'][e] = {'uid': uid, 'pass': body['password']}
        return await ok(route, {'kind': 'identitytoolkit#SignupNewUserResponse', 'idToken': tok(uid, e), 'email': e, 'refreshToken': 'r-' + uid, 'expiresIn': '3600', 'localId': uid})
    if 'accounts:signInWithPassword' in u:
        e = body.get('email', '').lower(); x = FB['users'].get(e)
        if not x or x['pass'] != body.get('password'): return await err('INVALID_LOGIN_CREDENTIALS')
        return await ok(route, {'kind': 'identitytoolkit#VerifyPasswordResponse', 'localId': x['uid'], 'email': e, 'displayName': '', 'idToken': tok(x['uid'], e), 'registered': True, 'refreshToken': 'r-' + x['uid'], 'expiresIn': '3600'})
    if 'accounts:lookup' in u:
        uid = uid_of(body.get('idToken', '')); e = next((k for k, v in FB['users'].items() if v['uid'] == uid), '')
        return await ok(route, {'kind': 'identitytoolkit#GetAccountInfoResponse', 'users': [{'localId': uid, 'email': e, 'emailVerified': False, 'providerUserInfo': [{'providerId': 'password', 'email': e, 'federatedId': e, 'rawId': e}], 'lastLoginAt': str(int(time.time() * 1000)), 'createdAt': '1700000000000'}]})
    if 'accounts:sendOobCode' in u: return await ok(route, {'email': body.get('email')})
    return await err('UNKNOWN')
async def securetoken(route):
    if route.request.method == 'OPTIONS': return await route.fulfill(status=204, headers=CORS)
    q = urllib.parse.parse_qs(route.request.post_data or ''); rt = (q.get('refresh_token') or [''])[0]; uid = rt[2:]
    e = next((k for k, v in FB['users'].items() if v['uid'] == uid), '')
    t = tok(uid, e); return await ok(route, {'access_token': t, 'expires_in': '3600', 'token_type': 'Bearer', 'refresh_token': rt, 'id_token': t, 'user_id': uid, 'project_id': 'alyssa-test'})
def path_ok(req, name):
    a = req.headers.get('authorization', ''); uid = uid_of(a[7:]) if a.startswith('Bearer ') else None
    m = re.search(r'/documents/users/([^/]+)', name); return uid and m and m.group(1) == uid
async def firestore(route):
    req = route.request
    if req.method == 'OPTIONS': return await route.fulfill(status=204, headers=CORS)
    u = urllib.parse.unquote(req.url); body = json.loads(req.post_data or '{}') if req.post_data else {}
    FB['log'].append(('fs', req.method, u.split('/documents')[-1][:60]))
    if u.split('?')[0].endswith(':batchGet'):
        out = []
        for name in body.get('documents', []):
            if not path_ok(req, name): return await ok(route, [{'error': {'code': 403, 'message': 'PERMISSION_DENIED', 'status': 'PERMISSION_DENIED'}}], 403)
            k = name.split('/documents/')[1]; d = FB['docs'].get(k)
            out.append({'found': {'name': name, 'fields': d['fields'], 'createTime': d['t'], 'updateTime': d['t']}, 'readTime': d['t']} if d else {'missing': name, 'readTime': '2026-10-22T00:00:00Z'})
        return await ok(route, out)
    if u.split('?')[0].endswith(':commit'):
        res = []
        for w in body.get('writes', []):
            name = w['update']['name']
            if not path_ok(req, name): return await ok(route, {'error': {'code': 403, 'message': 'PERMISSION_DENIED', 'status': 'PERMISSION_DENIED'}}, 403)
            t = time.strftime('%Y-%m-%dT%H:%M:%S.000000Z', time.gmtime()); FB['docs'][name.split('/documents/')[1]] = {'fields': w['update'].get('fields', {}), 't': t}; res.append({'updateTime': t})
        return await ok(route, {'writeResults': res, 'commitTime': res[0]['updateTime'] if res else ''})
    return await ok(route, {'error': {'code': 404, 'message': 'unknown ' + u}}, 404)
def doc_json(uid, field='s'):
    d = FB['docs'].get('users/' + uid); 
    if not d: return None
    v = d['fields'].get(field, {}); return json.loads(v.get('stringValue', 'null'))
async def install(ctx):
    await ctx.route('https://identitytoolkit.googleapis.com/**', auth)
    await ctx.route('https://securetoken.googleapis.com/**', securetoken)
    await ctx.route('https://firestore.googleapis.com/**', firestore)
