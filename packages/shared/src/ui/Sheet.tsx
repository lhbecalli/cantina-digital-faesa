import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Bottom sheet / modal em portal. Foco vai para o diálogo ao abrir, fica preso nele (Tab),
 * Esc e clique no fundo fecham, e o foco volta ao elemento que abriu.
 */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const [shown, setShown] = useState(false) // mantém montado durante a animação de saída
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const prev = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      prev.current = document.activeElement as HTMLElement | null
      setShown(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(r)
    }
    setVisible(false)
    const t = setTimeout(() => setShown(false), 300)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!visible) return
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus() ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [visible, onClose])

  useEffect(() => {
    if (!open && !shown && prev.current) { prev.current.focus?.(); prev.current = null }
  }, [open, shown])

  if (!shown) return null
  return createPortal(
    <div className={`sheet-root${visible ? ' open' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose} style={{ color: 'var(--blue-900)' }}><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
