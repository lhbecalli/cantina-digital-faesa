import { ArrowLeft, ChefHat, CircleAlert, CircleCheck, CreditCard, PackageCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { LoadingScreen, Photo, QrCode, StatusText, brl, orderNumber, useAppState } from '@cantina/shared'
import { Timeline } from '../components/parts.tsx'
import { PushPrompt } from '../push/PushControls.tsx'

export default function TicketPage() {
  const { num } = useParams()
  const state = useAppState()
  if (!state) return <LoadingScreen label="Carregando o ticket" />
  const o = state.orders.find((x) => x.number === Number(num))
  if (!o) {
    return (
      <div className="page"><div className="empty"><CircleAlert size={36} aria-hidden="true" /><p>Pedido não encontrado.</p><Link className="btn btn-primary" to="/pedidos">Meus pedidos</Link></div></div>
    )
  }
  const active = o.status !== 'retirado'
  const payload = 'FAESA-CANTINA|' + orderNumber(o.number) + '|' + o.customer.toUpperCase() + '|' + o.total.toFixed(2)
  return (
    <div className="page">
      <Link className="back" to="/pedidos"><ArrowLeft size={18} aria-hidden="true" />Meus pedidos</Link>
      <section className="ticket" aria-label={'Ticket do pedido ' + o.number}>
        <div className="ticket-head"><span className="eyebrow">Ticket</span><div className="ticket-num" aria-label={'Pedido número ' + o.number}>{orderNumber(o.number)}</div><StatusText status={o.status} /></div>
        <div className={'qr-box' + (active ? '' : ' dim')}><QrCode text={payload} label={'QR Code do ticket ' + orderNumber(o.number)} /></div>
        {o.status === 'aguardando' && <div className="pay-note"><CreditCard size={20} aria-hidden="true" /><p><b>Pague na maquininha, no balcão. </b>Mostre este QR ou o número {orderNumber(o.number)} ao atendente. O preparo começa após o pagamento.</p></div>}
        {o.status === 'preparo' && <div className="pay-note ok"><ChefHat size={20} aria-hidden="true" /><p><b>Pagamento confirmado. </b>Seu pedido está sendo preparado.</p></div>}
        {o.status === 'pronto' && <div className="pay-note ready"><PackageCheck size={20} aria-hidden="true" /><p><b>Pronto para retirada. </b>Apresente este ticket no balcão.</p></div>}
        {o.status === 'retirado' && <div className="pay-note"><CircleCheck size={20} aria-hidden="true" /><p>Ticket encerrado.</p></div>}
      </section>
      {o.status !== 'retirado' && <PushPrompt />}
      <h2 className="sec">Acompanhe em tempo real</h2>
      <div className="card"><Timeline order={o} /></div>
      <h2 className="sec">Itens</h2>
      <div className="card">
        <ul className="sum">
          {o.items.map((i) => (
            <li key={i.id}>
              <span className="sum-name"><Photo item={state.menu.find((m) => m.id === i.id) ?? { id: i.id, cat: 'lanches' }} size="xs" />{i.qty}x {i.name}</span>
              <b>{brl(i.qty * i.price)}</b>
            </li>
          ))}
        </ul>
        <div className="total-row"><span>Total</span><b>{brl(o.total)}</b></div>
      </div>
    </div>
  )
}
