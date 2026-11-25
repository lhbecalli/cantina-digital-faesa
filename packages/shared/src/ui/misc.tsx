import { Component, useLayoutEffect, useRef } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Banknote, ChefHat, CircleCheck, CreditCard, PackageCheck, WifiOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OrderStatus } from '../domain/types.ts'
import { STATUS_INFO } from '../domain/constants.ts'
import { qrMatrix, qrPath } from '../qr/qr.ts'
import { useConnection, useStore } from '../store/react.tsx'

export const STATUS_ICON: Record<OrderStatus, LucideIcon> = { aguardando: CreditCard, preparo: ChefHat, pronto: PackageCheck, retirado: CircleCheck }
export const PAY_ICON = Banknote

export function StatusText({ status }: { status: OrderStatus }) {
  const Icon = STATUS_ICON[status]
  return <span className="status-text" style={{ color: STATUS_INFO[status].color }}><Icon size={16} aria-hidden="true" />{STATUS_INFO[status].label}</span>
}

/** QR Code gerado em TS puro (qr.ts). */
export function QrCode({ text, size = 168, label }: { text: string; size?: number; label: string }) {
  const { d, size: s } = qrPath(qrMatrix(text))
  return (
    <svg viewBox={`0 0 ${s} ${s}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={s} height={s} fill="#fff" />
      <path d={d} fill="#0B1B33" />
    </svg>
  )
}

/** Faixa de aviso quando o canal em tempo real cai (e some quando volta). */
export function ConnectionBanner() {
  const { status } = useConnection()
  const store = useStore()
  if (status === 'online' || status === 'loading') return null
  return (
    <div className="conn-banner" role="alert">
      <WifiOff size={16} aria-hidden="true" />
      <span>{status === 'offline' ? 'Sem conexão com a cantina.' : 'Reconectando…'}</span>
      <button type="button" onClick={() => void store.reload()}>Tentar agora</button>
    </div>
  )
}

export function LoadingScreen({ label = 'Carregando' }: { label?: string }) {
  return (
    <div className="page" role="status" aria-label={label} aria-busy="true">
      <div className="skeleton" style={{ height: 28, width: '45%' }} />
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 120 }} />
    </div>
  )
}

export function ErrorFallback({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="page" role="alert">
      <div className="empty">
        <p><b>Algo deu errado.</b></p>
        <p>{error.message || 'Erro inesperado.'}</p>
        <button type="button" className="btn btn-primary" onClick={onRetry ?? (() => location.reload())}>Tentar de novo</button>
      </div>
    </div>
  )
}

/** Error boundary: impede que um erro de tela derrube a SPA inteira. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[ErrorBoundary]', error, info.componentStack) }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }) }
  render() { return this.state.error ? <ErrorFallback error={this.state.error} onRetry={() => this.setState({ error: null })} /> : this.props.children }
}

/** FLIP: anima elementos [data-flip] que mudaram de lugar depois de uma renderização. */
export function useFlip<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null)
  const rects = useRef(new Map<string, DOMRect>())
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, DOMRect>()
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const key = el.dataset.flip as string
      const now = el.getBoundingClientRect()
      next.set(key, now)
      const before = rects.current.get(key)
      if (reduce || typeof el.animate !== 'function') return
      if (!before) { if (rects.current.size) el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.23,1,.32,1)' }); return }
      const dx = before.left - now.left
      const dy = before.top - now.top
      if (dx || dy) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.23,1,.32,1)' })
    })
    rects.current = next
  }, [dep])
  return ref
}
