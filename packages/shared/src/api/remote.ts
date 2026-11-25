import { ApiError } from '../domain/types.ts'
import type { AgentReply, AppState, StudentProfile } from '../domain/types.ts'
import type { Commands, Transport } from './transport.ts'

export type Role = { role: 'student'; studentId: string } | { role: 'admin'; pin: string }

/** Base da API: VITE_API_URL (backend em outro domínio) ou a própria origem (produção e proxy do Vite). */
const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '')

function wsUrl(path: string): string {
  const base = API_URL || location.origin
  return base.replace(/^http/, 'ws') + path
}

interface Envelope<T> { result?: T; state?: AppState; error?: { code: string; message: string; details?: unknown } }

export function createRemoteTransport(who: Role, opts: { pollMs?: number } = {}): Transport {
  const headers = (json: boolean): Record<string, string> => ({
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(who.role === 'student' ? { 'X-Student-Id': who.studentId } : { 'X-Admin-Pin': who.pin }),
  })

  async function request<T>(method: string, path: string, body?: unknown): Promise<Envelope<T>> {
    let res: Response
    try {
      res = await fetch(API_URL + path, { method, headers: headers(body !== undefined), body: body !== undefined ? JSON.stringify(body) : undefined })
    } catch {
      throw new ApiError('network', 'Sem conexão com a cantina. Tente de novo em instantes.', 0)
    }
    let json: Envelope<T> = {}
    try { json = (await res.json()) as Envelope<T> } catch { /* corpo vazio */ }
    if (!res.ok) throw new ApiError(json.error?.code ?? 'http_' + res.status, json.error?.message ?? 'Falha na requisição.', res.status, json.error?.details)
    return json
  }

  const statePath = who.role === 'admin' ? '/api/admin/state' : '/api/state'
  const admin = (p: string) => '/api/admin' + p

  return {
    async load() {
      const r = await request<unknown>('GET', statePath)
      if (!r.state) throw new ApiError('bad_response', 'Resposta inesperada do servidor.', 502)
      return r.state
    },

    connect(onState, onStatus) {
      let ws: WebSocket | null = null
      let closed = false
      let attempts = 0
      let retry: ReturnType<typeof setTimeout> | undefined
      let poll: ReturnType<typeof setInterval> | undefined
      let hb: ReturnType<typeof setInterval> | undefined
      const query = who.role === 'admin' ? '?role=admin' : `?role=student&sid=${encodeURIComponent(who.studentId)}`

      const startPolling = () => {
        if (poll || closed) return
        poll = setInterval(() => {
          request<unknown>('GET', statePath).then((r) => { if (r.state) { onState(r.state); onStatus('reconnecting') } }).catch(() => onStatus('offline'))
        }, opts.pollMs ?? 4000)
      }
      const stopPolling = () => { if (poll) { clearInterval(poll); poll = undefined } }

      const open = () => {
        if (closed) return
        try { ws = new WebSocket(wsUrl('/ws' + query)) } catch { schedule(); return }
        ws.onopen = () => {
          if (who.role === 'admin') ws?.send(JSON.stringify({ type: 'auth', pin: who.pin })) // o PIN nunca vai na URL
          attempts = 0; stopPolling(); onStatus('online')
        }
        ws.onmessage = (e) => {
          try {
            const m = JSON.parse(String(e.data)) as { type: string; state?: AppState }
            if (m.type === 'state' && m.state) { onState(m.state); onStatus('online') }
          } catch { /* mensagem malformada */ }
        }
        ws.onclose = (e) => { stopHb(); if (!closed && e.code !== 4403 && e.code !== 4400) { onStatus('reconnecting'); startPolling(); schedule() } }
        ws.onerror = () => { /* onclose cuida da reconexão */ }
        hb = setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send('ping') }, 20000)
      }
      const stopHb = () => { if (hb) { clearInterval(hb); hb = undefined } }
      const schedule = () => {
        attempts += 1
        if (attempts > 4) onStatus('offline')
        retry = setTimeout(open, Math.min(10000, 500 * 2 ** attempts))
      }
      open()
      return () => { closed = true; clearTimeout(retry); stopPolling(); stopHb(); ws?.close() }
    },

    commands: (apply): Commands => {
      const run = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
        const r = await request<T>(method, path, body)
        if (r.state) apply(r.state)
        return r.result as T
      }
      return {
        createOrder: (input) => run('POST', '/api/orders', { lines: input.lines, via: input.via, clientRequestId: input.clientRequestId }),
        rename: (name) => run<StudentProfile>('PUT', '/api/student', { name }),
        chat: (message, cart, viaIA) => request<unknown>('POST', '/api/agent/chat', { message, cart, viaIA }) as unknown as Promise<AgentReply>,
        pushConfig: async () => {
          const r = await fetch(API_URL + '/api/push/config')
          return (await r.json()) as { enabled: boolean; publicKey: string | null }
        },
        pushSubscribe: async (sub) => { await request('POST', '/api/push/subscribe', sub) },
        pushUnsubscribe: async (endpoint) => { await request('DELETE', '/api/push/subscribe', { endpoint }) },
        confirmPayment: (n) => run('POST', admin('/orders/' + n + '/payment')),
        updateStatus: (n, to) => run('PATCH', admin('/orders/' + n + '/status'), { status: to }),
        setAvailability: (id, available) => run('PATCH', admin('/menu/' + encodeURIComponent(id)), { available }),
        setPrice: (id, price) => run('PATCH', admin('/menu/' + encodeURIComponent(id)), { price }),
        addMenuItem: (item) => run('POST', admin('/menu'), item),
        fireReport: () => run('POST', admin('/reports')),
        receiveStudentOrder: () => run('POST', admin('/dev/student-order')),
        reset: async () => { await run('POST', admin('/reset')) },
      }
    },
  }
}

/** Confere o PIN de administrador (usado pela tela de acesso do painel). */
export async function verifyAdminPin(pin: string): Promise<boolean> {
  try {
    const r = await fetch(API_URL + '/api/admin/auth', { method: 'POST', headers: { 'X-Admin-Pin': pin } })
    if (r.status === 429) throw new ApiError('rate_limited', 'Muitas tentativas. Aguarde um minuto.', 429)
    return r.ok
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError('network', 'Sem conexão com a cantina.', 0)
  }
}
