# In-memory stand-in for the ad_* RPCs, for browser tests when Supabase is unreachable.
# Mirrors the JSON shapes of supabase/migrations/20261118000100_adsum_schema.sql.
import json, secrets, uuid, datetime as dt

W = {}  # slug -> workplace dict

def now(): return dt.datetime.now(dt.timezone.utc).isoformat()
def err(code, details=None): return 400, {'code': 'P0001', 'message': code, 'details': details, 'hint': None}

def wjson(w): return {k: w[k] for k in ('slug','name','rate_amount','rate_unit','currency','wants_daily_notice','locale')}

def summary_json(s, name):
    items = []
    for i in s['items']:
        o = {'date': i['date'], 'is_late': bool(i.get('is_late'))}
        if s['include_hours']:
            if 'check_in' in i: o['check_in'] = i['check_in']
            if 'check_out' in i: o['check_out'] = i['check_out']
        if s['include_notes'] and 'note' in i: o['note'] = i['note']
        items.append(o)
    return {**{k: s[k] for k in ('id','provider_id','month','days','amount','late_days','include_hours','include_notes','sent_at','review','review_note','reviewed_at','expires_at')},
            'provider_name': name, 'hours': s['hours'] if s['include_hours'] else None, 'items': items}

def client_w(a):
    w = W.get(a['p_slug'])
    if not w or w['client_token'] != a['p_client_token']: raise KeyError('not_authorized')
    return w

def prov(a):
    w = W.get(a['p_slug'])
    if w:
        for p in w['providers']:
            if p['token'] == a['p_invite_token']: return w, p
    raise KeyError('invite_not_found')

def handle(fn, a):
    try:
        if fn == 'ad_create_workplace':
            if not a.get('p_terms_version'): return err('terms_not_accepted')
            slug = secrets.token_hex(4); tok = secrets.token_urlsafe(16)
            W[slug] = dict(slug=slug, name=a['p_name'], rate_amount=a.get('p_rate_amount'), rate_unit=a.get('p_rate_unit','day'), currency='BRL',
                           wants_daily_notice=a.get('p_wants_daily_notice', False), locale=a.get('p_locale','pt-BR'), client_token=tok, providers=[], summaries=[])
            return 200, {'slug': slug, 'client_token': tok}
        if fn == 'ad_get_workplace_as_client':
            w = client_w(a)
            provs = [{'id': p['id'], 'name': p['name'], 'status': p['status'], 'shares_daily_notice': p['shares'] and p['status']=='active',
                      'invite_token': p['token'] if p['status']=='invited' else None, 'accepted_at': p['accepted_at'], 'stopped_at': p['stopped_at'],
                      'today_notices': [{'kind': n[0], 'occurred_at': n[1]} for n in p['notices']] if p['status']=='active' and p['shares'] else None} for p in w['providers']]
            names = {p['id']: p['name'] for p in w['providers']}
            return 200, {**wjson(w), 'providers': provs, 'summaries': [summary_json(s, names[s['provider_id']]) for s in w['summaries']]}
        if fn == 'ad_update_workplace':
            w = client_w(a); w.update(name=a['p_name'], rate_amount=a.get('p_rate_amount'), rate_unit=a.get('p_rate_unit'), wants_daily_notice=a.get('p_wants_daily_notice')); return 200, None
        if fn == 'ad_add_invite':
            w = client_w(a); name = (a.get('p_name') or '').strip()
            if not name: return err('provider_name_required')
            if any(p['name'].lower()==name.lower() for p in w['providers']): return err('provider_name_taken', name)
            p = dict(id=str(uuid.uuid4()), name=name, status='invited', shares=False, token=secrets.token_urlsafe(16), accepted_at=None, stopped_at=None, notices=[])
            w['providers'].append(p); return 200, {'id': p['id'], 'name': name, 'invite_token': p['token']}
        if fn == 'ad_remove_provider':
            w = client_w(a); w['providers'] = [p for p in w['providers'] if p['id'] != a['p_provider_id']]
            w['summaries'] = [s for s in w['summaries'] if s['provider_id'] != a['p_provider_id']]; return 200, None
        if fn == 'ad_review_summary':
            w = client_w(a)
            for s in w['summaries']:
                if s['id'] == a['p_summary_id']:
                    s.update(review=a['p_review'], review_note=a.get('p_review_note'), reviewed_at=now()); return 200, None
            return err('summary_not_found')
        if fn == 'ad_delete_workplace':
            client_w(a); del W[a['p_slug']]; return 200, None
        if fn == 'ad_get_invite':
            w, p = prov(a)
            return 200, {'workplace': wjson(w), 'provider_name': p['name'], 'status': p['status'], 'shares_daily_notice': p['shares'],
                         'summaries': [{k: s[k] for k in ('month','days','amount','sent_at','review','review_note','reviewed_at')} for s in w['summaries'] if s['provider_id']==p['id']]}
        if fn == 'ad_accept_invite':
            w, p = prov(a); p.update(status='active', shares=bool(a.get('p_shares_daily_notice')) and w['wants_daily_notice'], accepted_at=p['accepted_at'] or now(), stopped_at=None); return 200, None
        if fn == 'ad_decline_invite':
            w, p = prov(a); p.update(status='declined', shares=False); return 200, None
        if fn == 'ad_set_sharing':
            w, p = prov(a)
            if p['status'] == 'invited': return err('invite_not_answered')
            if a['p_is_active']: p.update(status='active', stopped_at=None, shares=bool(a.get('p_shares_daily_notice')) and w['wants_daily_notice'])
            else: p.update(status='stopped', stopped_at=now(), shares=False); p['notices'] = []
            if not a.get('p_shares_daily_notice'): p['notices'] = []
            return 200, None
        if fn == 'ad_add_notice':
            w, p = prov(a)
            if p['status'] != 'active': return err('sharing_not_active')
            if not p['shares']: return err('daily_notice_off')
            p['notices'].append((a['p_kind'], a.get('p_occurred_at') or now())); return 200, None
        if fn == 'ad_send_summary':
            w, p = prov(a)
            if p['status'] != 'active': return err('sharing_not_active')
            month = a['p_month'][:7] + '-01'
            w['summaries'] = [s for s in w['summaries'] if not (s['provider_id']==p['id'] and s['month']==month)]
            s = dict(id=str(uuid.uuid4()), provider_id=p['id'], month=month, days=a['p_days'], hours=a.get('p_hours'), amount=a.get('p_amount'), late_days=a.get('p_late_days',0),
                     items=a['p_items'], include_hours=a.get('p_include_hours', True), include_notes=a.get('p_include_notes', False), sent_at=now(),
                     review=None, review_note=None, reviewed_at=None, expires_at=now())
            w['summaries'].append(s); return 200, {'id': s['id'], 'month': month}
        return 404, {'message': 'unknown_function'}
    except KeyError as e:
        return err(e.args[0])

def install(context):
    def route(r):
        fn = r.request.url.split('/rpc/')[1].split('?')[0]
        status, body = handle(fn, json.loads(r.request.post_data or '{}'))
        r.fulfill(status=status, content_type='application/json', body=json.dumps(body))
    context.route('**/rest/v1/rpc/**', route)
