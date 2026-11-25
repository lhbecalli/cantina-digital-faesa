import { useSyncExternalStore } from 'react'

export interface CartData { lines: { id: string; qty: number }[]; viaIA: boolean; key: string }
const KEY = 'faesa.cart.v2'
const newKey = (): string => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2))
const empty = (): CartData => ({ lines: [], viaIA: false, key: newKey() })

export interface CartStore {
  getSnapshot(): CartData
  subscribe(l: () => void): () => void
  add(id: string, qty?: number, viaIA?: boolean): void
  setQty(id: string, qty: number): void
  remove(id: string): void
  clear(): void
  replace(lines: { id: string; qty: number }[], viaIA: boolean): void
}

function read(storage: Storage | null): CartData {
  try {
    const raw = storage?.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as CartData
      if (Array.isArray(d.lines) && typeof d.key === 'string') return { lines: d.lines.filter((l) => l && typeof l.id === 'string' && l.qty > 0), viaIA: !!d.viaIA, key: d.key }
    }
  } catch { /* storage indisponível ou corrompido: começa vazio */ }
  return empty()
}

/** Carrinho do aluno. Persiste em localStorage (com tolerância a falhas) e sincroniza entre abas via evento `storage`. */
export function createCartStore(storage: Storage | null = typeof localStorage === 'undefined' ? null : safeStorage()): CartStore {
  let data = read(storage)
  const listeners = new Set<() => void>()
  const commit = (next: CartData) => {
    data = next
    try { storage?.setItem(KEY, JSON.stringify(next)) } catch { /* sem espaço/privado: segue só em memória */ }
    listeners.forEach((l) => l())
  }
  if (typeof window !== 'undefined' && storage) {
    window.addEventListener('storage', (e) => { if (e.key === KEY) { data = read(storage); listeners.forEach((l) => l()) } })
  }
  return {
    getSnapshot: () => data,
    subscribe(l) { listeners.add(l); return () => { listeners.delete(l) } },
    add(id, qty = 1, viaIA = false) {
      const has = data.lines.find((l) => l.id === id)
      const lines = has ? data.lines.map((l) => (l.id === id ? { ...l, qty: Math.min(20, l.qty + qty) } : l)) : [...data.lines, { id, qty: Math.min(20, qty) }]
      commit({ ...data, lines, viaIA: data.viaIA || viaIA })
    },
    setQty(id, qty) {
      const lines = qty <= 0 ? data.lines.filter((l) => l.id !== id) : data.lines.map((l) => (l.id === id ? { ...l, qty: Math.min(20, qty) } : l))
      commit({ ...data, lines, viaIA: lines.length ? data.viaIA : false })
    },
    remove(id) { this.setQty(id, 0) },
    clear() { commit(empty()) },
    replace(lines, viaIA) { commit({ ...data, lines: lines.filter((l) => l.qty > 0), viaIA: lines.length ? viaIA : false, key: lines.length ? data.key : newKey() }) },
  }
}

function safeStorage(): Storage | null { try { return localStorage } catch { return null } }

export const cartStore = createCartStore()

export function useCart(store: CartStore = cartStore): CartData {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
