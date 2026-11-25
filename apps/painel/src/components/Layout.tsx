import { Suspense, useEffect, useRef } from 'react'
import { BarChart3, Columns2, LogOut, Receipt, Smartphone, Utensils } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ConnectionBanner, ErrorBoundary, LoadingScreen, Logo, brl, orderNumber, useAppState, useConnection, useToast } from '@cantina/shared'
import { signOut } from '../pin.ts'

const ALUNO_URL = (import.meta.env.VITE_ALUNO_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:5173' : '/aluno/')
const TITLES: Record<string, string> = { pedidos: 'Pedidos', cardapio: 'Cardápio', relatorio: 'Relatório' }

/** Avisa quando chega pedido novo de aluno (não de "Receber pedido de aluno"). */
function useNewOrderAlerts() {
  const state = useAppState()
  const toast = useToast()
  const known = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!state) return
    if (!known.current) { known.current = new Set(state.orders.map((o) => o.id)); return }
    for (const o of state.orders) {
      if (known.current.has(o.id)) continue
      known.current.add(o.id)
      if (o.via !== 'sim') toast('Novo pedido ' + orderNumber(o.number), o.customer + ' · ' + brl(o.total) + (o.via === 'ia' ? ' · feito pelo assistente' : ''), { icon: Receipt, ms: 6000 })
    }
  }, [state, toast])
}

export function Layout() {
  const { pathname } = useLocation()
  const state = useAppState()
  const { status } = useConnection()
  useNewOrderAlerts()
  const tab = pathname.split('/')[1] || 'pedidos'
  useEffect(() => { document.title = (TITLES[tab] ? TITLES[tab] + ' · ' : '') + 'Cantina FAESA — Bloco B' }, [tab])
  const waiting = state?.orders.filter((o) => o.status === 'aguardando').length ?? 0
  const live = status === 'online' ? 'Tempo real' : status === 'offline' ? 'Sem conexão' : status === 'loading' ? 'Conectando…' : 'Reconectando…'
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <Logo plate height={22} />
          <div><b>Cantina FAESA<span className="bl"> — Bloco B</span></b><small><span className="bl2">Bloco B · </span>Painel da cantina</small></div>
        </div>
        <span className="live" role="status">{live}</span>
        <a className="btn btn-sm top-link" href={ALUNO_URL} target="_blank" rel="noopener"><Smartphone size={18} aria-hidden="true" /><span>App do aluno</span></a>
        <button type="button" className="btn btn-sm top-link" onClick={signOut} aria-label="Sair do painel"><LogOut size={18} aria-hidden="true" /><span>Sair</span></button>
      </header>
      <ConnectionBanner />
      <nav className="tabs" aria-label="Seções do painel">
        <NavLink to="/pedidos" className={({ isActive }) => (isActive ? 'on' : '')}><Columns2 size={18} aria-hidden="true" /><span>Pedidos</span>{waiting > 0 && <span className="count" aria-label={waiting + ' aguardando'}>{waiting}</span>}</NavLink>
        <NavLink to="/cardapio" className={({ isActive }) => (isActive ? 'on' : '')}><Utensils size={18} aria-hidden="true" /><span>Cardápio</span></NavLink>
        <NavLink to="/relatorio" className={({ isActive }) => (isActive ? 'on' : '')}><BarChart3 size={18} aria-hidden="true" /><span>Relatório</span></NavLink>
      </nav>
      <main id="main" tabIndex={-1}>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<LoadingScreen />}><div key={pathname} className="view-enter"><Outlet /></div></Suspense>
        </ErrorBoundary>
      </main>
    </>
  )
}
