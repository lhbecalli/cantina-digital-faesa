import { Inbox } from 'lucide-react'
import { LoadingScreen, useAppState } from '@cantina/shared'
import { OrderCard } from '../components/parts.tsx'

export default function PedidosPage() {
  const state = useAppState()
  if (!state) return <LoadingScreen label="Carregando pedidos" />
  const byId = (id: string) => state.menu.find((m) => m.id === id)
  const mine = [...state.orders].sort((a, b) => b.createdAt - a.createdAt)
  const active = mine.filter((o) => o.status !== 'retirado')
  const old = mine.filter((o) => o.status === 'retirado')
  return (
    <div className="page">
      <h1 className="page-title">Meus pedidos</h1>
      <h2 className="sec">Em andamento</h2>
      {active.length
        ? <div className="stack">{active.map((o) => <OrderCard key={o.id} order={o} byId={byId} />)}</div>
        : <div className="empty"><Inbox size={36} aria-hidden="true" /><p>Nenhum pedido em andamento.</p></div>}
      {old.length > 0 && <h2 className="sec">Anteriores</h2>}
      {old.length > 0 && <div className="stack">{old.map((o) => <OrderCard key={o.id} order={o} byId={byId} />)}</div>}
    </div>
  )
}
