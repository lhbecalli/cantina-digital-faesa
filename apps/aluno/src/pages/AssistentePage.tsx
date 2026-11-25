import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, Plus, Send, ShoppingCart, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Photo, StatusText, brl, orderNumber, useAppState, useCommands } from '@cantina/shared'
import type { Attachment } from '@cantina/shared'
import { chatStore, useChat } from '../chat/chatStore.ts'
import type { ChatMessage } from '../chat/chatStore.ts'
import { cartStore } from '../cart/cartStore.ts'
import { useCartLines } from '../cart/useCartLines.ts'
import { MenuRow, Timeline } from '../components/parts.tsx'
import { useUi } from '../components/Layout.tsx'

function Attachments({ attach }: { attach: Attachment[] }) {
  const state = useAppState()
  const { lines, total } = useCartLines()
  const { openCart } = useUi()
  if (!state) return null
  return (
    <>
      {attach.map((a, i) => {
        if (a.type === 'items') {
          return <ul key={i} className="chat-items">{a.ids.flatMap((id) => { const it = state.menu.find((m) => m.id === id); return it ? [<li key={id}><MenuRow item={it} compact viaIA /></li>] : [] })}</ul>
        }
        if (a.type === 'cart') {
          if (!lines.length) return null // carrinho já confirmado/esvaziado: mensagens antigas não mostram bloco vazio
          return (
            <div key={i} className="chat-cart">
              <ul>{lines.map((l) => <li key={l.id}><span className="sum-name"><Photo item={l.item} size="xs" />{l.qty}x {l.item.name}</span><b>{brl(l.qty * l.item.price)}</b></li>)}</ul>
              <div className="total-row"><span>Total</span><b>{brl(total)}</b></div>
              <button type="button" className="btn btn-cta btn-block" onClick={openCart}><ShoppingCart size={20} aria-hidden="true" />Ir para o carrinho</button>
            </div>
          )
        }
        if (a.type === 'status') {
          const o = state.orders.find((x) => x.number === a.number)
          if (!o) return null
          return (
            <div key={i} className="chat-status">
              <div className="oc-top"><b>{orderNumber(o.number)}</b><StatusText status={o.status} /></div>
              <Timeline order={o} />
              <Link className="btn btn-ghost btn-sm" to={'/pedidos/' + o.number}>Abrir ticket</Link>
            </div>
          )
        }
        return a.combos.map((c) => (
          <div key={i + c.label} className="combo">
            <div>
              <div className="thumbs">{c.ids.flatMap((id) => { const it = state.menu.find((m) => m.id === id); return it ? [<Photo key={id} item={it} size="xs" />] : [] })}</div>
              <span className="eyebrow">{c.label}</span>
              <b>{c.ids.map((id) => state.menu.find((m) => m.id === id)?.name).join(' + ')}</b>
              <small>{c.note} · {brl(c.price)}</small>
            </div>
            <button type="button" className="btn btn-cta btn-sm" aria-label={'Adicionar combo ' + c.label + ' ao carrinho'}
              onClick={() => { c.ids.forEach((id) => cartStore.add(id, 1, true)); chatStore.push({ role: 'bot', text: 'Combo adicionado ao carrinho.', reply: { text: '', tools: c.ids.map((id) => ({ name: 'adicionar_ao_carrinho', args: { item_id: id, quantidade: 1 }, result: 'ok' })), attach: [{ type: 'cart' }] } }) }}>
              <Plus size={20} aria-hidden="true" />Adicionar
            </button>
          </div>
        ))
      })}
    </>
  )
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === 'user') return <div className="msg user"><p>{m.text}</p></div>
  const tools = m.reply?.tools ?? []
  return (
    <div className="msg bot">
      <span className="avatar" aria-hidden="true"><Bot size={18} /></span>
      <div className="bot-body">
        {m.text && <p>{m.text}</p>}
        {m.reply && <Attachments attach={m.reply.attach} />}
        {tools.length > 0 && (
          <details className="tools">
            <summary><Zap size={13} aria-hidden="true" />ferramentas usadas ({tools.length})</summary>
            <ul>{tools.map((t, i) => <li key={i}><code>{t.name}({JSON.stringify(t.args)})</code><span> → {t.result}</span></li>)}</ul>
          </details>
        )}
      </div>
    </div>
  )
}

const SUGGESTIONS = ['O que tem sem açúcar hoje?', 'Quero um misto e um suco', 'Status do meu pedido', 'Sugira um combo', 'Tem opção vegetariana?']

export default function AssistentePage() {
  const commands = useCommands()
  const { messages, typing } = useChat()
  const { count, total } = useCartLines()
  const { openCart } = useUi()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' }) }, [messages.length, typing])

  async function send(raw: string) {
    const t = raw.trim()
    if (!t || chatStore.getSnapshot().typing) return
    chatStore.push({ role: 'user', text: t })
    setText('')
    chatStore.setTyping(true)
    try {
      const snap = cartStore.getSnapshot()
      const reply = await commands.chat(t, snap.lines, snap.viaIA) // o agente roda no backend (FastAPI)
      if (reply.cart) cartStore.replace(reply.cart.lines, reply.cart.viaIA)
      chatStore.push({ role: 'bot', text: reply.text, reply })
    } catch (e) {
      chatStore.push({ role: 'bot', text: e instanceof Error ? e.message : 'Não consegui falar com a cantina agora. Tente de novo.' })
    } finally { chatStore.setTyping(false) }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); void send(text) }

  return (
    <div className="page chat">
      <div className="ai-head"><span className="avatar big" aria-hidden="true"><Bot size={24} /></span><div><h1>Assistente da cantina</h1><small>IA da cantina</small></div></div>
      <div className="chat-list" role="log" aria-live="polite" aria-label="Conversa com a IA da cantina">
        {messages.map((m) => <Bubble key={m.id} m={m} />)}
        {typing && <div className="msg bot"><span className="avatar" aria-hidden="true"><Bot size={18} /></span><div className="bot-body typing" role="status" aria-label="IA digitando"><i /><i /><i /></div></div>}
        <div ref={endRef} />
      </div>
      <div className="composer-wrap">
        {count > 0 && <button type="button" className="cart-inline" onClick={openCart}><ShoppingCart size={20} aria-hidden="true" /><span>Ver carrinho · {count} {count === 1 ? 'item' : 'itens'}</span><b>{brl(total)}</b></button>}
        <div className="chips chat-chips">{SUGGESTIONS.map((s) => <button key={s} type="button" className="suggest" onClick={() => void send(s)}>{s}</button>)}</div>
        <form className="composer" onSubmit={submit}>
          <input className="input" type="text" placeholder="Ex.: quero um misto e um suco" aria-label="Mensagem para a IA da cantina" autoComplete="off" enterKeyHint="send" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="btn btn-primary send" aria-label="Enviar mensagem"><Send size={20} aria-hidden="true" /></button>
        </form>
      </div>
    </div>
  )
}
