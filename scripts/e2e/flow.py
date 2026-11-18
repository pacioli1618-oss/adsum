# Browser test of the whole loop, with the ad_* RPCs faked in memory (fake_db.py).
# Run `npm run build && PORT=3100 npm start`, then `python3 scripts/e2e/flow.py`.
# Needs Playwright for Python and Chrome (set CHROME to its path). Screenshots go to /tmp/adsum-shots.
import os
import re, sys
from playwright.sync_api import sync_playwright
import fake_db

BASE = 'http://localhost:3100'
errors = []
os.makedirs('/tmp/adsum-shots', exist_ok=True)

def watch(page, who):
    page.on('pageerror', lambda e: errors.append(f'{who} pageerror: {e}'))
    page.on('console', lambda m: m.type == 'error' and errors.append(f'{who} console: {m.text}'))
    page.on('dialog', lambda d: d.accept())

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROME', '/usr/bin/google-chrome'), args=['--no-sandbox'])
    vp = {'width': 390, 'height': 844}
    client = browser.new_context(viewport=vp, locale='pt-BR', permissions=['clipboard-read', 'clipboard-write'])
    provider = browser.new_context(viewport=vp, locale='pt-BR')
    fake_db.install(client); fake_db.install(provider)
    c = client.new_page(); watch(c, 'client')
    v = provider.new_page(); watch(v, 'provider')

    # 1. Client creates a workplace
    c.goto(BASE + '/')
    c.screenshot(path='/tmp/adsum-shots/01-home.png', full_page=True)
    c.get_by_role('button', name='Contrato um serviço').click()
    c.get_by_label('Nome do local ou do serviço').fill('Teste E2E Casa Aurora')
    c.get_by_label('Valor combinado').fill('150')
    c.get_by_text('Pedir aviso de chegada e saída').click()
    c.get_by_role('button', name='Criar local').click()
    c.wait_for_timeout(300)
    # terms not accepted yet → error
    assert c.get_by_text('Para continuar, aceite os termos de uso.').is_visible(), 'terms error missing'
    c.get_by_role('checkbox', name=re.compile('Li e aceito')).check()
    c.get_by_role('button', name='Criar local').click()
    c.wait_for_url(re.compile(r'/w/[a-z0-9]+$'), timeout=15000)
    slug = c.url.rsplit('/', 1)[1]
    c.wait_for_selector('text=Pessoas')
    c.screenshot(path='/tmp/adsum-shots/02-panel-empty.png', full_page=True)

    # 2. Invite
    c.get_by_label('Nome de quem presta o serviço').fill('Ana')
    c.get_by_role('button', name='Criar convite').click()
    c.wait_for_selector('text=Ainda não respondeu')
    href = c.get_by_role('link', name='Enviar convite pelo WhatsApp').get_attribute('href')
    from urllib.parse import unquote
    invite_url = re.search(r'(http://localhost:3100/w/\S+/invite#\S+)', unquote(href)).group(1)
    c.screenshot(path='/tmp/adsum-shots/03-panel-invited.png', full_page=True)

    # 3. Provider opens invite and accepts with daily notice
    v.goto(invite_url)
    v.wait_for_selector('text=O que é compartilhado')
    v.screenshot(path='/tmp/adsum-shots/04-invite.png', full_page=True)
    v.get_by_text('Avisar quando eu chegar e sair').click()
    v.get_by_role('button', name='Aceitar e abrir meu caderno').click()
    v.wait_for_url(re.compile(r'/notebook/[0-9a-f-]+$'), timeout=15000)
    assert '#' not in v.url
    v.wait_for_selector('text=Compartilhamento')
    v.screenshot(path='/tmp/adsum-shots/05-client-month.png', full_page=True)

    # 4. Notebook: arrive
    v.goto(BASE + '/notebook')
    v.get_by_role('button', name=re.compile('^Cheguei')).click()
    v.wait_for_selector('text=Aviso enviado para Teste E2E Casa Aurora', timeout=15000)
    v.screenshot(path='/tmp/adsum-shots/06-notebook-arrived.png', full_page=True)

    # client sees today
    c.reload(); c.wait_for_selector('text=no local', timeout=15000)
    c.screenshot(path='/tmp/adsum-shots/07-panel-today.png', full_page=True)

    # 5. Provider writes a past day (late) in previous month and sends that month
    v.goto(BASE + '/notebook')
    v.get_by_role('link', name='Ver mês').click()
    v.get_by_role('button', name='Mês anterior').click()
    v.get_by_role('button', name=re.compile(r'^seg')).first.click()
    v.get_by_label('Chegada').fill('08:00')
    v.get_by_label('Saída').fill('17:30')
    v.get_by_label('Relato do dia').fill('Limpeza da cozinha')
    v.get_by_role('button', name='Salvar').click()
    v.wait_for_selector('text=Salvo')
    v.screenshot(path='/tmp/adsum-shots/08-day-editor.png', full_page=True)
    v.get_by_role('link', name='Enviar resumo do mês').click()
    v.wait_for_selector('text=O que vai no resumo')
    v.get_by_text('Relatos dos dias').click()
    v.screenshot(path='/tmp/adsum-shots/09-send.png', full_page=True)
    v.get_by_role('button', name='Enviar para Teste E2E Casa Aurora').click()
    v.wait_for_selector('text=Resumo enviado', timeout=15000)

    # 6. Client reviews
    c.reload(); c.wait_for_selector('text=a conferir', timeout=15000)
    c.get_by_role('button', name='Ver os dias').click()
    assert c.get_by_text('Limpeza da cozinha').is_visible()
    c.get_by_role('button', name='Não confere').click()
    c.get_by_label('O que não confere?').fill('Nesse dia saiu às 16h')
    c.get_by_role('button', name='Enviar', exact=True).click()
    c.wait_for_selector('text=não confere', timeout=15000)
    with c.expect_download() as dl:
        c.get_by_role('button', name='Baixar planilha do mês').click()
    path = dl.value.path(); csv = open(path, encoding='utf-8-sig').read()
    print('CSV:', csv[:300].replace('\r\n', ' | '))
    c.screenshot(path='/tmp/adsum-shots/10-panel-summary.png', full_page=True)

    # provider sees review
    v.goto(v.url.rsplit('/send', 1)[0])
    v.wait_for_selector('text=Nesse dia saiu às 16h', timeout=15000)
    v.screenshot(path='/tmp/adsum-shots/11-provider-review.png', full_page=True)

    # 7. Dark mode + English screenshot of notebook
    v.emulate_media(color_scheme='dark')
    v.goto(BASE + '/notebook'); v.wait_for_selector('text=Meu caderno')
    v.screenshot(path='/tmp/adsum-shots/12-notebook-dark.png', full_page=True)

    # 8. Provider stops sharing; client deletes workplace (cleanup)
    v.goto(BASE + '/notebook'); v.get_by_role('link', name=re.compile('Teste E2E Casa Aurora')).last.click()
    v.get_by_role('button', name='Parar de compartilhar').click()
    v.wait_for_selector('text=Voltar a compartilhar', timeout=15000)
    c.reload(); c.wait_for_selector('text=parou de compartilhar', timeout=15000)
    c.get_by_role('button', name='Opções do local').click()
    c.get_by_role('menuitem', name='Excluir local').click()
    c.wait_for_url(BASE + '/', timeout=15000)
    print('slug', slug, 'deleted')
    browser.close()

print('ERRORS:' if errors else 'no browser errors')
for e in errors: print(' ', e)
