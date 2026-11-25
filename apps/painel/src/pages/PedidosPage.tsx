import { useEffect, useRef, useState } from 'react'
import { Banknote, ChefHat, CircleCheck, Clock, CreditCard, PackageCheck, Receipt, Users } from 'lucide-react'
import { ApiError, LoadingScreen, Photo, ago, brl, minutesSince, orderNumber, useAppState, useCommands, useFlip, useToast } from '@cantina/shared'
import type { Order, OrderStatus } from '@cantina/shared'

interface Col { id: Exclude<OrderStatus, 'retirado'>; title: string; short: string; Icon: typeof Clock; btn: string; cls: string; BtnIcon: typeof Clock; limit: number }
const COLS: Col[] = [
  { id: 'aguardando', title: 'Aguardando pagamento', short: 'Aguardando', Icon: CreditCard, btn: 'Confirmar pagamento', cls: 'btn-ok', BtnIcon: Banknote, limit: 10 },
  { id: 'preparo', title: 'Em preparo', short: 'Em preparo', Icon: ChefHat, btn: 'Marcar como pronto', cls: 'btn-primary', BtnIcon: PackageCheck, limit: 12 },
  { id: 'pronto', title: 'Pronto', short: 'Pronto', Icon: PackageCheck, btn: 'Confirmar retirada', cls: 'btn-ok', BtnIcon: CircleCheck, limit: 6 },
]
const VIA: Record<string, string> = { app: 'App', ia: 'IA', sim: 'Aluno' }

function OrderCardK({ o, col, now, menu }: { o: Order; col: Col; now: number; menu: { id: string; cat: never }[] }) {
  const commands = useCommands()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false) // guarda síncrona: o 2º clique chega antes do re-render
  const since = o.history[o.status] ?? o.createdAt
  const late = minutesSince(since, now) >= col.limit
  async function advance() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      if (col.id === 'aguardando') { await commands.confirmPayment(o.number); toast('Pagamento confirmado', orderNumber(o.number) + ' foi para o preparo.', { type: 'ok', icon: CircleCheck }) }
      else await commands.updateStatus(o.number, col.id === 'preparo' ? 'pronto' : 'retirado')
    } catch (e) { toast('Não foi possível atualizar', e instanceof ApiError ? e.message : 'Tente novamente.', { type: 'warn' }) }
    finally { setTimeout(() => { lock.current = false; setBusy(false) }, 600) } // pequena trava depois da resposta: o card só sai da coluna quando o estado novo chega
  }
  return (
    <li className={'kcard' + (late ? ' late' : '')} data-flip={o.id}>
      <div className="k-top"><b className="k-num">{orderNumber(o.number)}</b><span className={'k-time' + (late ? ' late-text' : '')}><Clock size={14} aria-hidden="true" />{ago(since, now) + (late ? ' · atrasado' : '')}</span></div>
      <p className="k-who">{o.customer}<span className="k-via"> · {VIA[o.via] ?? 'App'}</span></p>
      <ul className="k-items k-sec">
        {o.items.map((i) => <li key={i.id}><Photo item={menu.find((m) => m.id === i.id) ?? { id: i.id, cat: 'lanches' }} size="xs" /><span className="k-qty">{i.qty}x</span><span className="k-name">{i.name}</span></li>)}
      </ul>
      <div className="k-sec k-foot"><span className="k-total-l">Total</span><b className="k-total">{brl(o.total)}</b></div>
      <button type="button" className={'btn btn-block ' + col.cls} onClick={() => void advance()} disabled={busy}><col.BtnIcon size={18} aria-hidden="true" />{col.btn}</button>
    </li>
  )
}

export default function PedidosPage() {
  const state = useAppState()
  const commands = useCommands()
  const toast = useToast()
  const [active, setActive] = useState<Col['id']>('aguardando')
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])
  const boardRef = useFlip<HTMLDivElement>(state?.orders.map((o) => o.id + o.status).join())
  if (!state) return <LoadingScreen label="Carregando pedidos" />
  const inprog = state.orders.filter((o) => o.status !== 'retirado')
  const waiting = inprog.filter((o) => o.status === 'aguardando').length
  const doneToday = state.orders.filter((o) => o.status === 'retirado' && new Date(o.createdAt).toDateString() === new Date(now).toDateString()).length
  const menu = state.menu as unknown as { id: string; cat: never }[]

  return (
    <div className="page">
      <div className="toolbar">
        <p className="counter" aria-live="polite">{inprog.length} em andamento · {waiting} aguardando</p>
        <button type="button" className="btn btn-ghost" onClick={() => void commands.receiveStudentOrder().then((o) => toast('Novo pedido ' + orderNumber(o.number), o.customer + ' · ' + brl(o.total), { icon: Receipt })).catch(() => toast('Não foi possível criar o pedido', undefined, { type: 'warn' }))}><Users size={20} aria-hidden="true" />Receber pedido de aluno</button>
      </div>
      <div className="seg" role="tablist" aria-label="Colunas do kanban">
        {COLS.map((c) => (
          <button key={c.id} type="button" role="tab" className="seg-btn" aria-selected={active === c.id} onClick={() => setActive(c.id)}>{c.short}<span className="count">{inprog.filter((o) => o.status === c.id).length}</span></button>
        ))}
      </div>
      <div className="board" ref={boardRef}>
        {COLS.map((c) => {
          const list = inprog.filter((o) => o.status === c.id).sort((a, b) => a.createdAt - b.createdAt)
          return (
            <section key={c.id} className={'col' + (active === c.id ? ' active' : '')} aria-label={c.title}>
              <header><c.Icon size={18} aria-hidden="true" /><h2>{c.title}</h2><span className="count">{list.length}</span></header>
              {list.length ? <ul className="k-list">{list.map((o) => <OrderCardK key={o.id} o={o} col={c} now={now} menu={menu} />)}</ul> : <div className="k-empty">Nenhum pedido aqui.</div>}
            </section>
          )
        })}
        <p className="done-line"><CircleCheck size={14} aria-hidden="true" />Retirados hoje: {doneToday}</p>
      </div>
    </div>
  )
}
