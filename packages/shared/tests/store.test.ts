// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createCantinaStore, createFakeTransport, createRemoteTransport, sampleState } from '../src/index.ts'

describe('store', () => {
  it('carrega o estado e aplica o que o canal em tempo real empurra', async () => {
    const t = createFakeTransport()
    const store = createCantinaStore(t)
    const stop = store.start()
    await vi.waitFor(() => expect(store.getSnapshot().state?.rev).toBe(1))
    t.push(sampleState({ rev: 5 }))
    expect(store.getSnapshot().state?.rev).toBe(5)
    stop()
  })
  it('ignora estado mais antigo da mesma época, mas aceita outra época (servidor reiniciou)', async () => {
    const t = createFakeTransport(sampleState({ rev: 10 }))
    const store = createCantinaStore(t)
    store.start()
    await vi.waitFor(() => expect(store.getSnapshot().state?.rev).toBe(10))
    t.push(sampleState({ rev: 3 }))
    expect(store.getSnapshot().state?.rev).toBe(10)
    t.push(sampleState({ rev: 1, epoch: 'novo-boot' }))
    expect(store.getSnapshot().state?.epoch).toBe('novo-boot')
  })
})

describe('transporte remoto (REST + WebSocket)', () => {
  const realFetch = globalThis.fetch
  const RealWS = globalThis.WebSocket
  afterEach(() => { globalThis.fetch = realFetch; globalThis.WebSocket = RealWS; vi.useRealTimers() })

  it('envia o id do aluno ou o PIN no cabeçalho certo e converte erros em ApiError', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = []
    globalThis.fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string> })
      return new Response(JSON.stringify({ error: { code: 'forbidden', message: 'PIN inválido' } }), { status: 403 })
    }) as unknown as typeof fetch
    const aluno = createRemoteTransport({ role: 'student', studentId: 'aluno-123456' })
    await expect(aluno.load()).rejects.toMatchObject({ code: 'forbidden', status: 403 })
    expect(calls[0].url).toBe('/api/state'); expect(calls[0].headers['X-Student-Id']).toBe('aluno-123456')
    const painel = createRemoteTransport({ role: 'admin', pin: '4321' })
    await expect(painel.load()).rejects.toBeInstanceOf(ApiError)
    expect(calls[1].url).toBe('/api/admin/state'); expect(calls[1].headers['X-Admin-Pin']).toBe('4321')
  })

  it('cai para polling quando o WebSocket fecha e reconecta depois', async () => {
    vi.useFakeTimers()
    const sockets: FakeWS[] = []
    class FakeWS {
      static OPEN = 1
      readyState = 0
      onopen: (() => void) | null = null
      onmessage: ((e: { data: string }) => void) | null = null
      onclose: ((e: { code: number }) => void) | null = null
      onerror: (() => void) | null = null
      url: string
      constructor(url: string) { this.url = url; sockets.push(this) }
      send() {}
      close() {}
    }
    globalThis.WebSocket = FakeWS as unknown as typeof WebSocket
    let polls = 0
    globalThis.fetch = vi.fn(async () => { polls++; return new Response(JSON.stringify({ state: sampleState({ rev: 7 }) }), { status: 200 }) }) as unknown as typeof fetch
    const t = createRemoteTransport({ role: 'student', studentId: 'aluno-123456' }, { pollMs: 1000 })
    const states: number[] = []
    const statuses: string[] = []
    const stop = t.connect((s) => states.push(s.rev), (s) => statuses.push(s))
    expect(sockets[0].url).toContain('/ws?role=student&sid=aluno-123456')
    sockets[0].onopen?.(); expect(statuses.at(-1)).toBe('online')
    sockets[0].onmessage?.({ data: JSON.stringify({ type: 'state', state: sampleState({ rev: 2 }) }) })
    expect(states).toEqual([2])
    sockets[0].onclose?.({ code: 1006 }) // queda do canal
    expect(statuses.at(-1)).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(1100)
    expect(polls).toBeGreaterThan(0); expect(states).toContain(7) // polling manteve a tela atualizada
    await vi.advanceTimersByTimeAsync(1500)
    expect(sockets.length).toBeGreaterThan(1) // tentou reconectar
    stop()
  })
})
