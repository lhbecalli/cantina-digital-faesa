import { useRef, useState } from 'react'
import { Bell, Bot, CreditCard, PackageCheck, Receipt, ShoppingCart, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ApiError, Photo, Sheet, brl, orderNumber, timeOf, useAppState, useCommands, useToast } from '@cantina/shared'
import { cartStore } from '../cart/cartStore.ts'
import { useCartLines } from '../cart/useCartLines.ts'
import { Stepper } from './parts.tsx'

export function CartSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, total, viaIA, key } = useCartLines()
  const commands = useCommands()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  async function confirm() {
    if (lock.current) return // evita duplo clique; a chave de idempotência cobre o reenvio
    if (!lines.length) { toast('Carrinho vazio', 'Adicione itens antes de confirmar.', { type: 'warn', icon: ShoppingCart }); return }
    const out = lines.filter((l) => !l.item.available)
    if (out.length) { // ficou esgotado depois de entrar no carrinho: tira e pede nova confirmação
      out.forEach((l) => cartStore.remove(l.id))
      toast('Item esgotado', out.map((l) => l.item.name).join(', ') + ' saiu do carrinho. Revise e confirme de novo.', { type: 'warn', ms: 6500 })
      return
    }
    lock.current = true
    setBusy(true)
    try {
      const order = await commands.createOrder({ lines: lines.map((l) => ({ id: l.id, qty: l.qty })), via: viaIA ? 'ia' : 'app', clientRequestId: key })
      cartStore.clear(); onClose()
      toast('Pedido ' + orderNumber(order.number) + ' criado', 'Vá ao balcão e pague na maquininha.', { type: 'ok', icon: Receipt })
      navigate('/pedidos/' + order.number)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'item_unavailable') {
        const ids = ((e.details as { ids?: string[] } | undefined)?.ids ?? [])
        ids.forEach((id) => cartStore.remove(id))
        toast('Item esgotado', 'Alguns itens saíram do carrinho. Revise e confirme de novo.', { type: 'warn', ms: 6500 })
      } else toast('Não foi possível criar o pedido', e instanceof Error ? e.message : 'Tente novamente.', { type: 'warn' })
    } finally { lock.current = false; setBusy(false) }
  }

  return (
    <Sheet open={open} title="Seu carrinho" onClose={onClose}>
      {!lines.length ? (
        <div className="empty"><ShoppingCart size={40} aria-hidden="true" /><p>Seu carrinho está vazio.</p>
          <button type="button" className="btn btn-primary" onClick={() => { onClose(); navigate('/cardapio') }}>Ver cardápio</button></div>
      ) : (
        <>
          {viaIA && <p className="ai-note"><Bot size={16} aria-hidden="true" />Itens adicionados pelo assistente. Confira antes de confirmar.</p>}
          <ul className="cart-lines">
            {lines.map((l) => (
              <li key={l.id}>
                <Photo item={l.item} size="sm" />
                <div className="cl-name"><b>{l.item.name}</b>{l.item.available ? <small>{brl(l.item.price)} cada</small> : <small className="oos">Esgotado: sai do pedido ao confirmar</small>}</div>
                <b className="line-total">{brl(l.qty * l.item.price)}</b>
                <Stepper item={l.item} qty={l.qty} />
              </li>
            ))}
          </ul>
          <div className="total-row"><span>Total</span><b>{brl(total)}</b></div>
          <div className="pay-note"><CreditCard size={20} aria-hidden="true" /><p><b>Pagamento na maquininha, no balcão. </b>O ticket com QR é gerado ao confirmar.</p></div>
          <button type="button" className="btn btn-cta btn-block" onClick={() => void confirm()} disabled={busy} data-autofocus><Receipt size={20} aria-hidden="true" />{busy ? 'Enviando…' : 'Confirmar pedido'}</button>
          <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => cartStore.clear()}><Trash2 size={20} aria-hidden="true" />Esvaziar carrinho</button>
        </>
      )}
    </Sheet>
  )
}

export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useAppState()
  const list = state?.notifications ?? []
  return (
    <Sheet open={open} title="Notificações" onClose={onClose}>
      {list.length ? (
        <ul className="notif-list">
          {list.map((n) => (
            <li key={n.id}><PackageCheck size={22} aria-hidden="true" /><div><b>{n.title}</b><p>{n.text}</p><small>{timeOf(n.at)} · aviso automático</small></div></li>
          ))}
        </ul>
      ) : <div className="empty"><Bell size={36} aria-hidden="true" /><p>Sem notificações. Avisamos quando o pedido ficar pronto.</p></div>}
    </Sheet>
  )
}
