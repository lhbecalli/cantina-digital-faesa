/* E2E headless real com DOIS contextos de navegador isolados (storage separado):
   "celular" (375px) no app do aluno e "computador" no painel, falando com o FastAPI de verdade.
   Uso: npm run e2e [-- --shots=<pasta>]  (precisa do build: npm run build, e do venv: npm run setup:backend) */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const win = process.platform === 'win32'
const py = join(root, 'backend', '.venv', win ? 'Scripts/python.exe' : 'bin/python')
const shotsArg = process.argv.find((a) => a.startsWith('--shots='))
const SHOTS = shotsArg ? shotsArg.slice(8) : join(tmpdir(), 'cantina-e2e-shots')
mkdirSync(SHOTS, { recursive: true })
const PORT = 8010, PIN = '4321'
const BASE = `http://localhost:${PORT}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)

const BROWSERS = [process.env.CHROME_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
const browserPath = BROWSERS.find((p) => existsSync(p))
if (!browserPath) { console.error('Nenhum Chrome/Edge encontrado (defina CHROME_PATH).'); process.exit(2) }

// ---- servidor
const tmp = mkdtempSync(join(tmpdir(), 'cantina-e2e-'))
const vapid = Object.fromEntries(spawnSync(py, ['-m', 'app.push', 'generate'], { cwd: join(root, 'backend') }).stdout.toString().split('\n').filter((l) => /^VAPID_(PUBLIC|PRIVATE)_KEY=/.test(l)).map((l) => l.split('=')))
const server = spawn(py, ['-m', 'uvicorn', 'app.asgi:app', '--port', String(PORT)], {
  cwd: join(root, 'backend'), stdio: 'ignore',
  env: { ...process.env, ADMIN_PIN: PIN, DATABASE_URL: 'sqlite:///' + join(tmp, 'e2e.db').replace(/\\/g, '/'), REPORT_INTERVAL_SECONDS: '3600', ...vapid },
})
for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/healthz')).ok) break } catch { /* aguardando */ } await sleep(250) }

// ---- navegador
const edge = spawn(browserPath, ['--headless=new', '--remote-debugging-port=9444', '--user-data-dir=' + join(tmp, 'prof'), '--no-first-run', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' })
let ver
for (let i = 0; i < 60; i++) { try { ver = await (await fetch('http://127.0.0.1:9444/json/version')).json(); break } catch { await sleep(250) } }
const ws = new WebSocket(ver.webSocketDebuggerUrl)
await new Promise((r) => { ws.onopen = r })
let seq = 0
const pend = new Map()
const errors = []
// esperados: o 403 do PIN errado (de propósito) e o aviso do Chrome de que o Push API não existe em contexto anônimo (os contextos isolados do teste)
const EXPECTED = ['/api/admin/auth', 'Push API in incognito']
const events = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
  events.push(m)
  if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text))
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CON ' + m.params.args.map((a) => a.value ?? a.description).join(' '))
  else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !EXPECTED.some((x) => (m.params.entry.text + (m.params.entry.url ?? '')).includes(x))) errors.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url ?? ''))
}
const send = (method, params = {}, sessionId) => new Promise((resolve) => {
  const id = ++seq
  pend.set(id, resolve)
  ws.send(JSON.stringify({ id, method, params, sessionId }))
  setTimeout(() => { if (pend.has(id)) { pend.delete(id); resolve({ error: { message: 'timeout ' + method } }) } }, 20000)
})

async function openPage(url, w, h, mobile) {
  const { result: { browserContextId } } = await send('Target.createBrowserContext', { disposeOnDetach: true })
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true })
  for (const d of ['Runtime', 'Log', 'Page']) await send(d + '.enable', {}, sessionId)
  const p = { sessionId, browserContextId }
  p.size = (w2, h2, m2) => send('Emulation.setDeviceMetricsOverride', { width: w2, height: h2, deviceScaleFactor: 1, mobile: !!m2 }, sessionId)
  await p.size(w, h, mobile)
  await send('Page.navigate', { url }, sessionId)
  p.ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId)
    if (r.error || r.result?.exceptionDetails) return 'ERR:' + JSON.stringify(r.result?.exceptionDetails?.exception?.description ?? r.error?.message)
    return r.result.result.value
  }
  p.waitFor = async (expr, label, ms = 15000) => {
    const t = Date.now()
    while (Date.now() - t < ms) { if (await p.ev(expr) === true) return true; await sleep(150) }
    throw new Error('Tempo esgotado: ' + label)
  }
  p.shot = async (name) => { await send('Page.bringToFront', {}, sessionId); await sleep(350); const r = await send('Page.captureScreenshot', { format: 'png' }, sessionId); if (r.result) writeFileSync(join(SHOTS, name + '.png'), Buffer.from(r.result.data, 'base64')) }
  p.click = (sel, text) => p.ev(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e=>!${JSON.stringify(text ?? '')}||e.textContent.includes(${JSON.stringify(text ?? '')}));if(!els[0])return false;els[0].click();return true})()`)
  return p
}

const results = []
const step = async (name, fn) => { try { await fn(); results.push(['ok', name]); log('  ok  ', name) } catch (e) { results.push(['FALHA', name + ' → ' + e.message]); log('  FALHA', name, '→', e.message) } }

let phone, desk
try {
  phone = await openPage(BASE + '/aluno/', 375, 812, true)
  desk = await openPage(BASE + '/painel/', 1280, 900, false)
  await phone.waitFor("document.querySelectorAll('.mi').length > 5", 'cardápio carregado no celular')
  await send('Browser.grantPermissions', { origin: BASE, permissions: ['notifications'], browserContextId: phone.browserContextId })

  await step('painel pede PIN e recusa PIN errado', async () => {
    await desk.waitFor("!!document.querySelector('.pin-card')", 'tela de PIN')
    const typeIn = (v) => desk.ev(`(()=>{const i=document.querySelector('.pin-card input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,${JSON.stringify(v)});i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
    await typeIn('0000'); await desk.click('.pin-card button[type=submit]')
    await desk.waitFor("!!document.querySelector('.pin-error')", 'mensagem de PIN incorreto')
    await typeIn(PIN); await desk.click('.pin-card button[type=submit]')
    await desk.waitFor("!!document.querySelector('.kcard')", 'kanban após PIN correto')
  })

  await step('service worker registrado com escopo /aluno/', async () => {
    await phone.waitFor("navigator.serviceWorker.getRegistration('/aluno/').then(r=>!!(r&&r.active))", 'service worker ativo', 20000)
    const scope = await phone.ev("navigator.serviceWorker.getRegistration('/aluno/').then(r=>r.scope)")
    if (!String(scope).endsWith('/aluno/')) throw new Error('escopo: ' + scope)
    const m = await phone.ev("fetch('/aluno/manifest.webmanifest').then(r=>r.json()).then(j=>j.display+'|'+j.theme_color)")
    if (m !== 'standalone|#0B3A7A') throw new Error('manifest: ' + m)
  })

  await step('pedido pela IA no celular', async () => {
    await phone.ev("location.href='/aluno/assistente'"); await sleep(1200)
    await phone.waitFor("!!document.querySelector('.composer input')", 'chat')
    await phone.ev(`(()=>{const i=document.querySelector('.composer input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'quero um misto e um suco');i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.composer').requestSubmit();return true})()`)
    await phone.waitFor("!!document.querySelector('.chat-cart')", 'resposta do agente (backend) com carrinho')
    await phone.shot('01-celular-assistente')
    await phone.click('.chat-cart .btn-cta')
    await phone.waitFor("!!document.querySelector('.sheet .btn-cta')", 'carrinho aberto')
    await phone.shot('02-celular-carrinho')
    await phone.click('.sheet .btn-cta', 'Confirmar')
    await phone.waitFor("location.pathname.startsWith('/aluno/pedidos/')", 'ticket do pedido')
  })
  const number = Number((await phone.ev('location.pathname')).split('/').pop())
  const label = '#' + String(number).padStart(4, '0')

  await step('pedido aparece no painel em tempo real', async () => {
    await desk.waitFor(`[...document.querySelectorAll('.kcard .k-num')].some(e=>e.textContent==='${label}')`, 'card no painel', 8000)
    await desk.shot('03-painel-novo-pedido')
  })
  await step('aluno ativa o aviso de pedido pronto (assinatura push)', async () => {
    await phone.waitFor("!!document.querySelector('.push-prompt')", 'convite para ativar avisos')
    await phone.shot('04-celular-ticket-convite-push')
    await phone.click('.push-prompt .btn-primary')
    // Edge/Chrome headless pode não conseguir assinar no serviço de push do fabricante: registramos o que acontecer
    await sleep(4000)
  })
  const pushSub = await phone.ev("navigator.serviceWorker.getRegistration('/aluno/').then(r=>r.pushManager.getSubscription()).then(s=>!!s)")
  log('  info  assinatura push criada no navegador headless:', pushSub)

  await step('painel confirma pagamento → aluno vê "Em preparo"', async () => {
    await desk.click(`.kcard`, '')
    await desk.ev(`(()=>{const c=[...document.querySelectorAll('.kcard')].find(c=>c.querySelector('.k-num').textContent==='${label}');c.querySelector('button').click();return true})()`)
    await phone.waitFor("document.querySelector('.ticket .status-text')?.textContent.includes('Em preparo')", 'status Em preparo no celular', 8000)
  })
  await step('painel marca pronto → aluno é notificado (toast e sino)', async () => {
    await desk.ev(`(()=>{const c=[...document.querySelectorAll('.kcard')].find(c=>c.querySelector('.k-num').textContent==='${label}');c.querySelector('button').click();return true})()`)
    await phone.waitFor("document.querySelector('.ticket .status-text')?.textContent.includes('Pronto')", 'status Pronto no celular', 8000)
    await phone.waitFor("[...document.querySelectorAll('.toast')].some(t=>t.textContent.includes('pronto'))", 'toast de pedido pronto', 8000)
    await phone.waitFor("!!document.querySelector('.bar-actions .badge')", 'badge no sino')
    await phone.shot('05-celular-pronto')
    await desk.shot('06-painel-pronto')
  })
  await step('automação "Notificar aluno" aparece no log do painel', async () => {
    await desk.ev("location.href='/painel/relatorio'"); await sleep(1200)
    await desk.waitFor("[...document.querySelectorAll('.log li')].some(l=>l.textContent.includes('Web Push'))", 'log de push', 8000)
    await desk.shot('07-painel-relatorio')
  })
  await step('push entregue ao service worker exibe a notificação (CDP)', async () => {
    const registrationId = await (async () => {
      await send('ServiceWorker.enable', {}, phone.sessionId)
      await sleep(500)
      const reg = events.filter((e) => e.method === 'ServiceWorker.workerRegistrationUpdated').flatMap((e) => e.params.registrations).find((r) => r.scopeURL.endsWith('/aluno/'))
      return reg?.registrationId
    })()
    if (!registrationId) throw new Error('registro do SW não encontrado via CDP')
    const payload = JSON.stringify({ title: 'Pedido ' + label + ' pronto', body: 'Retire no balcão da Cantina FAESA.', tag: 'pedido-' + number, url: '/pedidos/' + number, number })
    const r = await send('ServiceWorker.deliverPushMessage', { origin: BASE, registrationId, data: payload }, phone.sessionId)
    if (r.error) throw new Error(r.error.message)
    await phone.waitFor(`navigator.serviceWorker.getRegistration('/aluno/').then(r=>r.getNotifications()).then(l=>l.some(n=>n.tag==='pedido-${number}'&&n.title.includes('pronto')))`, 'notificação criada pelo SW', 8000)
    const tagCount = await phone.ev(`navigator.serviceWorker.getRegistration('/aluno/').then(r=>r.getNotifications()).then(l=>l.filter(n=>n.tag==='pedido-${number}').length)`)
    if (tagCount !== 1) throw new Error('notificações duplicadas: ' + tagCount)
  })
  await step('painel confirma retirada → aluno vê "Retirado"', async () => {
    await desk.ev("location.href='/painel/pedidos'"); await sleep(1200)
    await desk.waitFor(`[...document.querySelectorAll('.kcard .k-num')].some(e=>e.textContent==='${label}')`, 'card pronto no painel')
    await desk.ev(`(()=>{const c=[...document.querySelectorAll('.kcard')].find(c=>c.querySelector('.k-num').textContent==='${label}');c.querySelector('button').click();return true})()`)
    await phone.waitFor("document.querySelector('.ticket .status-text')?.textContent.includes('Retirado')", 'status Retirado', 8000)
  })
  await step('outro aluno (novo contexto) não vê o pedido', async () => {
    const other = await openPage(BASE + '/aluno/pedidos', 375, 812, true)
    await other.waitFor("document.querySelectorAll('.empty').length >= 1 || document.querySelector('.page-title')", 'tela de pedidos do outro aluno')
    await sleep(800)
    const has = await other.ev(`document.body.innerText.includes('${label}')`)
    if (has) throw new Error('vazamento: outro aluno vê o pedido')
  })

  // screenshots de todas as telas (375 / 768 / 1280)
  for (const [w, h] of [[375, 812], [768, 900], [1280, 900]]) {
    await phone.size(w, h, w < 600); await desk.size(w, h, w < 600)
    for (const r of ['cardapio', 'pedidos', 'perfil']) { await phone.ev(`location.href='/aluno/${r}'`); await sleep(900); await phone.shot(`app-${w}-${r}`); if (r === 'cardapio') { await phone.ev('window.scrollTo(0, document.body.scrollHeight)'); await sleep(400); await phone.shot(`app-${w}-cardapio-fim-cookie-esgotado`); await phone.ev('window.scrollTo(0,0)') } log('  ovf', w, 'aluno', r, await phone.ev("document.documentElement.scrollWidth+'/'+document.documentElement.clientWidth")) }
    await phone.ev(`location.href='/aluno/pedidos/${number}'`); await sleep(900); await phone.shot(`app-${w}-ticket`)
    for (const r of ['pedidos', 'cardapio', 'relatorio']) { await desk.ev(`location.href='/painel/${r}'`); await sleep(900); await desk.shot(`painel-${w}-${r}`); log('  ovf', w, 'painel', r, await desk.ev("document.documentElement.scrollWidth+'/'+document.documentElement.clientWidth")) }
    if (w < 800) { await desk.ev("location.href='/painel/pedidos'"); await sleep(900); await desk.click('.seg-btn', 'Pronto'); await sleep(300); await desk.shot(`painel-${w}-pedidos-pronto`) }
  }
} catch (e) {
  results.push(['FALHA', 'erro geral → ' + e.message])
  log('Erro geral:', e.message)
}

log('\nErros de console:', errors.length ? '\n' + errors.join('\n') : 'nenhum')
const failed = results.filter((r) => r[0] !== 'ok')
log(`\n${results.length - failed.length}/${results.length} etapas ok; screenshots em ${SHOTS}`)
try { ws.close() } catch { /* ok */ }
edge.kill(); server.kill()
process.exit(failed.length || errors.length ? 1 : 0)
