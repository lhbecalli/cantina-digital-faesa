import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { AppState, MenuItem, Order } from '../domain/types.ts'
import { computeStats } from '../domain/stats.ts'
import type { Stats } from '../domain/stats.ts'
import type { CantinaStore, StoreSnapshot } from './cantinaStore.ts'

const Ctx = createContext<CantinaStore | null>(null)

/** Liga o store ao ciclo de vida da SPA: abre o canal em tempo real ao montar e fecha ao desmontar. */
export function CantinaProvider({ store, children }: { store: CantinaStore; children: ReactNode }) {
  useEffect(() => store.start(), [store])
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): CantinaStore {
  const s = useContext(Ctx)
  if (!s) throw new Error('CantinaProvider ausente')
  return s
}

export function useSnapshot(): StoreSnapshot {
  const store = useStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/** Estado completo da cantina (null enquanto carrega). */
export function useAppState(): AppState | null { return useSnapshot().state }
export function useCommands() { return useStore().commands }
export function useConnection() { const s = useSnapshot(); return { status: s.status, error: s.error } }

export function useMenu(): MenuItem[] { return useAppState()?.menu ?? EMPTY_MENU }
export function useOrders(): Order[] { return useAppState()?.orders ?? EMPTY_ORDERS }
export function useStats(): Stats | null {
  const state = useAppState()
  return useMemo(() => (state ? computeStats(state) : null), [state])
}
const EMPTY_MENU: MenuItem[] = []
const EMPTY_ORDERS: Order[] = []
