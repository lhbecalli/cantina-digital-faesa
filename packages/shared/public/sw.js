/* Service worker do app do aluno (escopo = pasta onde está servido, ex.: /aluno/).
   Recebe Web Push e mostra a notificação, mesmo com a tela bloqueada ou o app em segundo plano. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { title: 'Cantina FAESA', body: event.data ? event.data.text() : '' } }
  const scope = self.registration.scope
  const title = data.title || 'Cantina FAESA'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: new URL('icon-192.png', scope).href,
    badge: new URL('badge.png', scope).href,
    tag: data.tag || 'cantina', // uma notificação por pedido: não duplica
    renotify: false,
    data: { url: data.url || '/', number: data.number },
    lang: 'pt-BR',
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rel = String((event.notification.data && event.notification.data.url) || '/').replace(/^\//, '')
  const target = new URL(rel, self.registration.scope).href
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus()
        if ('navigate' in w) { try { await w.navigate(target) } catch (e) { /* ok */ } }
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
