import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Bell } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type ToastType = 'info' | 'ok' | 'warn'
interface ToastItem { id: number; title: string; text?: string; type: ToastType; icon: LucideIcon; leaving: boolean }
export interface ToastOptions { type?: ToastType; icon?: LucideIcon; ms?: number }
type ToastFn = (title: string, text?: string, opts?: ToastOptions) => void

const Ctx = createContext<ToastFn>(() => {})
export const useToast = (): ToastFn => useContext(Ctx)

/** Toasts anunciados por leitores de tela (role=status, aria-live=polite). Clique fecha. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const close = useCallback((id: number) => {
    setItems((l) => l.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 220)
  }, [])
  const toast = useCallback<ToastFn>((title, text, opts = {}) => {
    const id = ++seq.current
    setItems((l) => [...l.slice(-3), { id, title, text, type: opts.type ?? 'info', icon: opts.icon ?? Bell, leaving: false }])
    setTimeout(() => close(id), opts.ms ?? 4500)
  }, [close])
  const value = useMemo(() => toast, [toast])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <button key={t.id} type="button" className={`toast ${t.type}${t.leaving ? ' leaving' : ''}`} onClick={() => close(t.id)}>
            <t.icon size={22} aria-hidden="true" />
            <span className="toast-body"><b>{t.title}</b>{t.text ? <span>{t.text}</span> : null}</span>
          </button>
        ))}
      </div>
    </Ctx.Provider>
  )
}
