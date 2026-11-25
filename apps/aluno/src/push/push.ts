/* Web Push no app do aluno. A permissão só é pedida por gesto do usuário (clique em "Ativar").
   iOS: só funciona com o app instalado na tela inicial (iOS 16.4+). Exige HTTPS (ou localhost). */
import { useCallback, useEffect, useState } from 'react'
import { useCommands } from '@cantina/shared'
import type { Commands } from '@cantina/shared'

export type PushState = 'unsupported' | 'needs-install' | 'insecure' | 'unavailable' | 'denied' | 'default' | 'enabled' | 'busy'

const SW_URL = import.meta.env.BASE_URL + 'sw.js'

export const isIos = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = (): boolean => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

/** Registra o service worker (escopo = base do app, ex.: /aluno/). Falha em silêncio se não houver suporte. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try { return await navigator.serviceWorker.register(SW_URL, { scope: import.meta.env.BASE_URL }) } catch (e) { console.warn('Service worker não registrado', e); return null }
}

export function pushSupport(): PushState | null {
  if (!window.isSecureContext) return 'insecure'
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return null
}

const urlB64ToBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function enablePush(commands: Commands): Promise<PushState> {
  const blocked = pushSupport()
  if (blocked) return blocked
  const cfg = await commands.pushConfig()
  if (!cfg.enabled || !cfg.publicKey) return 'unavailable'
  const perm = await Notification.requestPermission() // chamado a partir de um clique
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'default'
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready)
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(cfg.publicKey) })
  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } }
  if (!json.keys) throw new Error('Assinatura sem chaves.')
  await commands.pushSubscribe({ endpoint: json.endpoint, keys: json.keys })
  return 'enabled'
}

export async function disablePush(commands: Commands): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await commands.pushUnsubscribe(sub.endpoint).catch(() => undefined)
  await sub.unsubscribe()
}

/** Estado atual do push neste aparelho, com ações para ativar/desativar. */
export function usePush() {
  const commands = useCommands()
  const [state, setState] = useState<PushState>('default')
  const refresh = useCallback(async () => {
    const blocked = pushSupport()
    if (blocked) return setState(blocked)
    if (Notification.permission === 'denied') return setState('denied')
    if (Notification.permission === 'granted' && (await currentSubscription())) return setState('enabled')
    setState('default')
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  const enable = useCallback(async () => {
    setState('busy')
    try { setState(await enablePush(commands)) } catch (e) { console.warn(e); setState('default') }
  }, [commands])
  const disable = useCallback(async () => { setState('busy'); await disablePush(commands); await refresh() }, [commands, refresh])
  return { state, enable, disable }
}
