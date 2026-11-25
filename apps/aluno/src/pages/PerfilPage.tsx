import { useState } from 'react'
import type { FormEvent } from 'react'
import { FlaskConical, Pencil, Store, UserRound } from 'lucide-react'
import { LoadingScreen, brl, setStudentName, switchToDemoAccount, useAppState, useCommands, useStudent, useToast } from '@cantina/shared'
import { OrderCard } from '../components/parts.tsx'
import { PushSettings } from '../push/PushControls.tsx'

const PAINEL_URL = (import.meta.env.VITE_PAINEL_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:5174' : '/painel/')

export default function PerfilPage() {
  const state = useAppState()
  const me = useStudent()
  const commands = useCommands()
  const toast = useToast()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  if (!state) return <LoadingScreen label="Carregando o perfil" />
  const byId = (id: string) => state.menu.find((m) => m.id === id)
  const done = state.orders.filter((o) => o.status === 'retirado').sort((a, b) => b.createdAt - a.createdAt)
  const spent = state.orders.filter((o) => o.status !== 'aguardando').reduce((a, o) => a + o.total, 0)

  const unnamed = me.name === 'Aluno'

  function edit() {
    setName(me.name)
    setEditing(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    try { const p = await commands.rename(n); setStudentName(p.name); setEditing(false); toast('Nome atualizado', 'Os próximos pedidos saem em nome de ' + p.name + '.', { type: 'ok' }) }
    catch (err) { toast('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.', { type: 'warn' }) }
  }

  return (
    <div className="page">
      <div className="profile-head">
        <span className="avatar xl" aria-hidden="true">{me.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <div className="profile-name">
            <h1>{me.name}</h1>
            {!unnamed && !editing && <button type="button" className="icon-btn" onClick={edit} aria-label="Editar nome"><Pencil size={18} aria-hidden="true" /></button>}
          </div>
          <p>Sistemas de Informação · 4º período</p><small>Matrícula 2024.0042</small>
        </div>
      </div>
      {(editing || unnamed) && (
        <form className="name-form" onSubmit={(e) => void save(e)} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }}>
          <label className="field">Seu nome no pedido
            <input className="input" value={name} maxLength={30} autoFocus={editing} onChange={(e) => setName(e.target.value)} placeholder="Como o balcão deve chamar você" autoComplete="given-name" />
          </label>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Salvar</button>
        </form>
      )}
      <div className="stats">
        <div className="card"><b>{state.orders.length}</b><small>pedidos</small></div>
        <div className="card"><b>{brl(spent)}</b><small>gasto</small></div>
      </div>
      <h2 className="sec">Avisos de pedido pronto</h2>
      <PushSettings />
      <h2 className="sec">Histórico</h2>
      {done.length
        ? <div className="stack">{done.map((o) => <OrderCard key={o.id} order={o} byId={byId} withStatus={false} />)}</div>
        : <div className="empty"><p>Sem pedidos retirados ainda.</p></div>}
      <div className="demo-tools">
        <button type="button" className="icon-btn" onClick={() => setShowDemo((v) => !v)} aria-expanded={showDemo} aria-controls="demo-tools-panel" aria-label="Ferramentas de demonstração" title="Demonstração"><FlaskConical size={20} aria-hidden="true" /></button>
        {showDemo && (
          <div id="demo-tools-panel" className="stack">
            <h2 className="sec">Demonstração</h2>
            <a className="btn btn-ghost btn-block" href={PAINEL_URL} target="_blank" rel="noopener"><Store size={20} aria-hidden="true" />Abrir painel da cantina</a>
            <button type="button" className="btn btn-ghost btn-block" onClick={switchToDemoAccount}><UserRound size={20} aria-hidden="true" />Usar a conta de demonstração (Luiz)</button>
          </div>
        )}
      </div>
    </div>
  )
}
