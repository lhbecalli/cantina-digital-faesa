import { Ban, Check, ChevronRight, Leaf, Minus, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { STATUS_FLOW, STATUS_INFO, Photo, STATUS_ICON, StatusText, brl, orderNumber, timeOf } from '@cantina/shared'
import type { MenuItem, Order } from '@cantina/shared'
import { cartStore, useCart } from '../cart/cartStore.ts'

export function Tags({ item }: { item: MenuItem }) {
  return (
    <div className="mi-tags">
      {item.tags.includes('sem-acucar') && <span className="tag"><Ban size={15} aria-hidden="true" />Sem açúcar</span>}
      {item.tags.includes('vegetariano') && <span className="tag"><Leaf size={15} aria-hidden="true" />Vegetariano</span>}
    </div>
  )
}

export function Stepper({ item, qty }: { item: Pick<MenuItem, 'id' | 'name'>; qty: number }) {
  return (
    <div className="stepper" role="group" aria-label={'Quantidade de ' + item.name}>
      <button type="button" aria-label={'Diminuir ' + item.name} onClick={() => cartStore.setQty(item.id, qty - 1)}><Minus size={20} aria-hidden="true" /></button>
      <output aria-live="polite">{qty}</output>
      <button type="button" aria-label={'Aumentar ' + item.name} onClick={() => cartStore.add(item.id, 1)}><Plus size={20} aria-hidden="true" /></button>
    </div>
  )
}

/** Linha do cardápio no padrão do Bola: foto 112 px, nome, descrição (2 linhas), preço e botão "+" de 44 px. */
export function MenuRow({ item, compact = false, viaIA = false }: { item: MenuItem; compact?: boolean; viaIA?: boolean }) {
  const cart = useCart()
  const qty = cart.lines.find((l) => l.id === item.id)?.qty ?? 0
  return (
    <div className={'mi' + (item.available ? '' : ' off') + (compact ? ' compact' : '')}>
      <Photo item={item} size={compact ? 'sm' : 'lg'} />
      <div className="mi-body">
        <h3>{item.name}</h3>
        {!compact && <p className="mi-desc">{item.desc}</p>}
        <Tags item={item} />
        <div className="mi-price">{brl(item.price)}</div>
        {qty > 0 && <small className="in-cart">{qty} no carrinho</small>}
      </div>
      <div className="mi-ctl">
        {item.available
          ? <button type="button" className="add-btn" aria-label={'Adicionar ' + item.name + ' ao carrinho'} onClick={() => cartStore.add(item.id, 1, viaIA)}><Plus size={20} aria-hidden="true" /></button>
          : <span className="pill">Esgotado</span>}
      </div>
    </div>
  )
}

export function Timeline({ order }: { order: Order }) {
  const idx = STATUS_FLOW.indexOf(order.status)
  return (
    <ol className="timeline" aria-label="Andamento do pedido">
      {STATUS_FLOW.map((st, i) => {
        const state = i < idx ? 'done' : i === idx ? 'now' : 'todo'
        const Icon = state === 'done' ? Check : STATUS_ICON[st]
        return (
          <li key={st} className={'tl ' + state} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="tl-dot"><Icon size={18} aria-hidden="true" /></span>
            <div><b>{STATUS_INFO[st].label}</b><small>{order.history[st] ? timeOf(order.history[st]) : 'Pendente'}</small></div>
          </li>
        )
      })}
    </ol>
  )
}

export function Thumbs({ items, byId }: { items: { id: string }[]; byId: (id: string) => MenuItem | undefined }) {
  const list = items.slice(0, 4).flatMap((i) => { const m = byId(i.id); return m ? [m] : [] })
  if (!list.length) return null
  return <div className="thumbs">{list.map((m) => <Photo key={m.id} item={m} size="xs" />)}</div>
}

export const summary = (o: Order): string => o.items.map((i) => i.qty + 'x ' + i.name).join(' · ')

export function OrderBanner({ order }: { order: Order }) {
  const Icon = STATUS_ICON[order.status]
  return (
    <Link className="order-banner" to={'/pedidos/' + order.number}>
      <Icon size={22} aria-hidden="true" />
      <div><b>Pedido {orderNumber(order.number)}</b><small>{STATUS_INFO[order.status].label}</small></div>
      <ChevronRight size={20} aria-hidden="true" />
    </Link>
  )
}

export function OrderCard({ order, byId, withStatus = true }: { order: Order; byId: (id: string) => MenuItem | undefined; withStatus?: boolean }) {
  return (
    <Link className="order-card" to={'/pedidos/' + order.number}>
      <div className="oc-top"><b>{orderNumber(order.number)}</b>{withStatus ? <StatusText status={order.status} /> : <small>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</small>}</div>
      <Thumbs items={order.items} byId={byId} />
      <p>{summary(order)}</p>
      <div className="oc-bot"><small>{timeOf(order.createdAt)}</small><b>{brl(order.total)}</b></div>
    </Link>
  )
}
