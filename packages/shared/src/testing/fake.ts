import type { AppState, AgentReply } from '../domain/types.ts'
import type { Commands, Transport } from '../api/transport.ts'
import { createCantinaStore } from '../store/cantinaStore.ts'
import type { CantinaStore } from '../store/cantinaStore.ts'

/** Estado de exemplo para testes de componentes (sem rede). */
export function sampleState(over: Partial<AppState> = {}): AppState {
  const now = Date.now()
  return {
    epoch: 't', rev: 1, nextNumber: 44,
    menu: [
      { id: 'misto', name: 'Misto Quente', cat: 'lanches', price: 11, desc: 'Pão na chapa.', tags: [], available: true },
      { id: 'suco-laranja', name: 'Suco de Laranja', cat: 'sucos', price: 6, desc: 'Natural.', tags: ['sem-acucar', 'vegetariano'], available: true },
      { id: 'cookie', name: 'Cookie de Aveia', cat: 'doces', price: 6, desc: 'Esgotado.', tags: ['vegetariano'], available: false },
    ],
    orders: [{ id: 'o1', number: 42, customer: 'Luiz', items: [{ id: 'misto', name: 'Misto Quente', price: 11, qty: 1 }], total: 11, status: 'aguardando', history: { aguardando: now }, createdAt: now, via: 'app' }],
    notifications: [], reports: [], log: [], ...over,
  }
}

export interface FakeTransport extends Transport { push(s: AppState): void; calls: { name: string; args: unknown[] }[] }

/** Transporte falso: guarda as chamadas e deixa o teste empurrar estados (como o WebSocket faria). */
export function createFakeTransport(initial: AppState = sampleState(), handlers: Partial<Commands> = {}): FakeTransport {
  let listener: ((s: AppState) => void) | null = null
  const calls: FakeTransport['calls'] = []
  const record = (name: string) => (...args: unknown[]) => { calls.push({ name, args }); const h = (handlers as Record<string, (...a: unknown[]) => unknown>)[name]; return Promise.resolve(h ? h(...args) : undefined) }
  const names = ['createOrder', 'rename', 'chat', 'pushConfig', 'pushSubscribe', 'pushUnsubscribe', 'confirmPayment', 'updateStatus', 'setAvailability', 'setPrice', 'addMenuItem', 'fireReport', 'receiveStudentOrder', 'reset']
  return {
    calls,
    load: async () => initial,
    connect(onState, onStatus) { listener = onState; onStatus('online'); return () => { listener = null } },
    commands: () => Object.fromEntries(names.map((n) => [n, record(n)])) as unknown as Commands,
    push(s) { listener?.(s) },
  }
}

export function createTestStore(initial?: AppState, handlers?: Partial<Commands>): { store: CantinaStore; transport: FakeTransport } {
  const transport = createFakeTransport(initial, handlers)
  return { store: createCantinaStore(transport), transport }
}

export type { AgentReply }
