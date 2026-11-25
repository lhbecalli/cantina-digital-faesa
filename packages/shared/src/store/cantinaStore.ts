import type { AppState } from '../domain/types.ts'
import type { Commands, ConnectionStatus, Transport } from '../api/transport.ts'

export interface StoreSnapshot {
  state: AppState | null
  status: ConnectionStatus
  error: string | null
}

export interface CantinaStore {
  getSnapshot(): StoreSnapshot
  subscribe(listener: () => void): () => void
  commands: Commands
  start(): () => void
  reload(): Promise<void>
}

/** Store externa (compatível com useSyncExternalStore). Ignora estados mais antigos que o atual (rev). */
export function createCantinaStore(transport: Transport): CantinaStore {
  let snap: StoreSnapshot = { state: null, status: 'loading', error: null }
  const listeners = new Set<() => void>()
  const set = (patch: Partial<StoreSnapshot>) => {
    snap = { ...snap, ...patch }
    listeners.forEach((l) => l())
  }
  const apply = (s: AppState) => {
    if (snap.state && s.epoch === snap.state.epoch && s.rev < snap.state.rev) return
    set({ state: s, error: null })
  }
  const reload = async () => {
    try { apply(await transport.load()); if (snap.status === 'loading' || snap.status === 'offline') set({ status: 'online' }) }
    catch { set({ status: snap.state ? 'reconnecting' : 'offline', error: 'Não foi possível carregar os dados.' }) }
  }
  return {
    getSnapshot: () => snap,
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l) } },
    commands: transport.commands(apply),
    reload,
    start() {
      void reload()
      let last: ConnectionStatus = 'loading'
      const close = transport.connect(apply, (st) => {
        const back = st === 'online' && last !== 'online'
        last = st
        set({ status: st })
        if (back) void reload() // reconexão: ressincroniza o que foi perdido
      })
      return close
    },
  }
}
