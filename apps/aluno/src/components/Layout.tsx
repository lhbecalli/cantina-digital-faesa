import { Suspense, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Bot, ChefHat, ClipboardList, PackageCheck, ShoppingCart, User, Utensils } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ConnectionBanner, ErrorBoundary, LoadingScreen, Logo, brl, orderNumber, useAppState, useToast } from '@cantina/shared'
import { useCartLines } from '../cart/useCartLines.ts'
import { CartSheet, NotificationsSheet } from './sheets.tsx'

interface UiApi { openCart(): void; openNotifs(): void }
const UiCtx = createContext<UiApi>({ openCart() {}, openNotifs() {} })
export const useUi = (): UiApi => useContext(UiCtx)

const TABS = [
  { to: '/cardapio', label: 'Cardápio', Icon: Utensils },
  { to: '/pedidos', label: 'Pedidos', Icon: ClipboardList },
  { to: '/assistente', label: 'Assistente', Icon: Bot },
  { to: '/perfil', label: 'Perfil', Icon: User },
]
const TITLES: Record<string, string> = { cardapio: 'Cardápio', pedidos: 'Pedidos', assistente: 'Assistente', perfil: 'Perfil' }
const SEEN = 'faesa.notifSeen'
const readSeen = (): number => { try { return Number(localStorage.getItem(SEEN) ?? 0) } catch { return 0 } }

/** Avisa (toast + vibração) quando chega notificação ao aluno ou o pagamento é confirmado. */
function useStudentAlerts() {
  const state = useAppState()
  const toast = useToast()
  const known = useRef<Set<string> | null>(null)
  const statuses = useRef<Map<string, string> | null>(null)
  useEffect(() => {
    if (!state) return
    if (!known.current || !statuses.current) { // primeira carga: só memoriza, não avisa o que já existia
      known.current = new Set(state.notifications.map((n) => n.id))
      statuses.current = new Map(state.orders.map((o) => [o.id, o.status]))
      return
    }
    for (const n of state.notifications) {
      if (known.current.has(n.id)) continue
      known.current.add(n.id)
      toast(n.title + '!', n.text, { type: 'ok', icon: PackageCheck, ms: 7000 })
      try { if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate([120, 60, 120]) } catch { /* sem vibração */ }
    }
    for (const o of state.orders) {
      const before = statuses.current.get(o.id)
      if (before && before !== o.status && o.status === 'preparo') toast('Pagamento confirmado', 'Pedido ' + orderNumber(o.number) + ' em preparo.', { icon: ChefHat })
      statuses.current.set(o.id, o.status)
    }
  }, [state, toast])
}

export function Layout() {
  const { pathname } = useLocation()
  const { count, total } = useCartLines()
  const state = useAppState()
  const [sheet, setSheet] = useState<'cart' | 'notifs' | null>(null)
  const [seen, setSeen] = useState(readSeen)
  const prevPath = useRef(pathname)
  const [dir, setDir] = useState('')
  useStudentAlerts()

  const tab = pathname.split('/')[1] || 'cardapio'
  const isTicket = /^\/pedidos\/\d+/.test(pathname)
  const showBar = count > 0 && tab !== 'perfil' && tab !== 'assistente'
  const unread = (state?.notifications ?? []).filter((n) => n.at > seen).length

  useEffect(() => {
    const d = pathname.split('/').length - prevPath.current.split('/').length
    setDir(d > 0 ? 'v-fwd' : d < 0 ? 'v-back' : '')
    prevPath.current = pathname
    document.title = (TITLES[tab] ? TITLES[tab] + ' · ' : '') + 'Cantina Digital FAESA'
    window.scrollTo(0, 0)
  }, [pathname, tab])
  useEffect(() => {
    if (showBar) document.body.setAttribute('data-cartbar', ''); else document.body.removeAttribute('data-cartbar')
  }, [showBar])

  const ui = useMemo<UiApi>(() => ({
    openCart: () => setSheet('cart'),
    openNotifs: () => { setSheet('notifs'); const now = Date.now(); setSeen(now); try { localStorage.setItem(SEEN, String(now)) } catch { /* ok */ } },
  }), [])

  return (
    <UiCtx.Provider value={ui}>
      <div className="shell">
        <a className="skip" href="#main">Ir para o conteúdo</a>
        <header className="appbar">
          <Link className="brand" to="/cardapio" aria-label="Cantina Digital FAESA"><Logo plate height={22} /><span>Cantina Digital</span></Link>
          <div className="bar-actions">
            <button type="button" className="icon-btn" aria-label={unread ? `Notificações (${unread} novas)` : 'Notificações'} onClick={ui.openNotifs}>
              <Bell size={22} aria-hidden="true" />{unread > 0 && <span className="badge">{unread}</span>}
            </button>
            <button type="button" className="icon-btn" aria-label={count ? `Abrir carrinho (${count} itens)` : 'Abrir carrinho'} onClick={ui.openCart}>
              <ShoppingCart size={24} aria-hidden="true" />{count > 0 && <span className="badge">{count}</span>}
            </button>
          </div>
        </header>
        <ConnectionBanner />
        <main id="main" tabIndex={-1}>
          <ErrorBoundary resetKey={pathname}>
            <Suspense fallback={<LoadingScreen />}>
              <div key={pathname} className={'view-enter ' + dir}><Outlet /></div>
            </Suspense>
          </ErrorBoundary>
        </main>
        {showBar && (
          <button type="button" className="cart-bar" onClick={ui.openCart}>
            <ShoppingCart size={20} aria-hidden="true" />
            <span>{(isTicket ? 'Novo pedido' : 'Ver carrinho') + ' · ' + count + (count === 1 ? ' item' : ' itens')}</span>
            <b>{brl(total)}</b>
          </button>
        )}
        <nav className="tabbar" aria-label="Navegação principal">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive || (to === '/pedidos' && pathname.startsWith('/pedidos')) ? 'on' : '')}>
              <Icon size={22} aria-hidden="true" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <CartSheet open={sheet === 'cart'} onClose={() => setSheet(null)} />
        <NotificationsSheet open={sheet === 'notifs'} onClose={() => setSheet(null)} />
      </div>
    </UiCtx.Provider>
  )
}
