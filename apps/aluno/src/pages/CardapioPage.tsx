import { useMemo, useState } from 'react'
import { Ban, Check, Leaf, Search } from 'lucide-react'
import { CATEGORIES, LoadingScreen, norm, useAppState, useStudent } from '@cantina/shared'
import type { CategoryId } from '@cantina/shared'
import { MenuRow, OrderBanner } from '../components/parts.tsx'

interface Filters { q: string; cat: 'todos' | CategoryId; sem: boolean; veg: boolean }

export default function CardapioPage() {
  const state = useAppState()
  const me = useStudent()
  const [f, setF] = useState<Filters>({ q: '', cat: 'todos', sem: false, veg: false })
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const items = useMemo(() => {
    const q = norm(f.q.trim())
    return (state?.menu ?? [])
      .filter((i) => (f.cat === 'todos' || i.cat === f.cat) && (!f.sem || i.tags.includes('sem-acucar')) && (!f.veg || i.tags.includes('vegetariano')) && (!q || norm(i.name + ' ' + i.desc).includes(q)))
      .sort((a, b) => Number(b.available) - Number(a.available))
  }, [state?.menu, f])

  if (!state) return <LoadingScreen label="Carregando o cardápio" />
  const active = state.orders.filter((o) => o.status !== 'retirado').sort((a, b) => b.createdAt - a.createdAt)[0]
  const cats = [{ id: 'todos' as const, name: 'Todos' }, ...CATEGORIES]

  return (
    <div className="page">
      <div className="hello"><h1>Cardápio</h1><p>Olá, {me.name} · {today}</p></div>
      {active && <OrderBanner order={active} />}
      <div className="search-wrap">
        <Search size={18} aria-hidden="true" />
        <input className="input search" type="search" placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      </div>
      <div className="cat-tabs" role="tablist" aria-label="Categorias">
        {cats.map((c) => <button key={c.id} type="button" role="tab" className="cat-tab" aria-selected={f.cat === c.id} onClick={() => setF({ ...f, cat: c.id })}>{c.name}</button>)}
      </div>
      <div className="flags" role="group" aria-label="Filtros">
        <span className="flags-label">Filtrar:</span>
        <button type="button" className="flag" aria-pressed={f.sem} onClick={() => setF({ ...f, sem: !f.sem })}>{f.sem ? <Check size={16} aria-hidden="true" /> : <Ban size={16} aria-hidden="true" />}Sem açúcar</button>
        <button type="button" className="flag" aria-pressed={f.veg} onClick={() => setF({ ...f, veg: !f.veg })}>{f.veg ? <Check size={16} aria-hidden="true" /> : <Leaf size={16} aria-hidden="true" />}Vegetariano</button>
      </div>
      <div className="menu-list">
        {items.length
          ? <ul>{items.map((i) => <li key={i.id}><MenuRow item={i} /></li>)}</ul>
          : <div className="empty"><Search size={36} aria-hidden="true" /><p>Nenhum item encontrado com esses filtros.</p></div>}
      </div>
    </div>
  )
}
