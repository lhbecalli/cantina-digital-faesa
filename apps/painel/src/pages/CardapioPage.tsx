import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Pencil, Plus } from 'lucide-react'
import { ApiError, CATEGORIES, CATEGORY_ICON, LoadingScreen, Photo, Sheet, brl, useAppState, useCommands, useToast } from '@cantina/shared'
import type { CategoryId, MenuItem, Tag } from '@cantina/shared'

function PriceField({ item }: { item: MenuItem }) {
  const commands = useCommands()
  const toast = useToast()
  const [value, setValue] = useState<string | null>(null) // null = mostra o valor do servidor
  async function commit() {
    if (value === null) return
    const v = parseFloat(value.replace(',', '.'))
    setValue(null)
    if (Number.isNaN(v) || v < 0 || v === item.price) return
    try { await commands.setPrice(item.id, v); toast('Preço atualizado', item.name + ' agora custa ' + brl(v), { type: 'ok', icon: Pencil, ms: 2500 }) }
    catch (e) { toast('Preço não salvo', e instanceof ApiError ? e.message : 'Tente novamente.', { type: 'warn' }) }
  }
  return (
    <input className="input price" type="number" min="0" step="0.5" inputMode="decimal" aria-label={'Preço de ' + item.name + ' em reais'}
      value={value ?? item.price.toFixed(2)} onChange={(e) => setValue(e.target.value)} onBlur={() => void commit()} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

function NewItemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const commands = useCommands()
  const toast = useToast()
  const [name, setName] = useState('')
  const [cat, setCat] = useState<CategoryId>('lanches')
  const [price, setPrice] = useState('')
  const [desc, setDesc] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [busy, setBusy] = useState(false)
  const toggle = (t: Tag) => setTags((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]))
  async function submit(e: FormEvent) {
    e.preventDefault()
    const p = parseFloat(price.replace(',', '.'))
    if (!name.trim() || Number.isNaN(p) || p < 0 || busy) return
    setBusy(true)
    try {
      await commands.addMenuItem({ name: name.trim(), cat, price: p, desc: desc.trim(), tags })
      toast('Item adicionado', name.trim() + ' já está no cardápio dos alunos.', { type: 'ok', icon: Check })
      setName(''); setPrice(''); setDesc(''); setTags([]); onClose()
    } catch (err) { toast('Não foi possível adicionar', err instanceof ApiError ? err.message : 'Tente novamente.', { type: 'warn' }) }
    finally { setBusy(false) }
  }
  return (
    <Sheet open={open} title="Adicionar item" onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <label className="field">Nome<input className="input" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} data-autofocus autoComplete="off" /></label>
        <label className="field">Categoria<select className="input" value={cat} onChange={(e) => setCat(e.target.value as CategoryId)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field">Preço (R$)<input className="input" type="number" min="0" step="0.5" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        <label className="field">Descrição<input className="input" maxLength={90} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={tags.includes('sem-acucar')} onChange={() => toggle('sem-acucar')} />Sem açúcar</label>
        <label className="check"><input type="checkbox" checked={tags.includes('vegetariano')} onChange={() => toggle('vegetariano')} />Vegetariano</label>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}><Plus size={20} aria-hidden="true" />Adicionar ao cardápio</button>
      </form>
    </Sheet>
  )
}

export default function CardapioPage() {
  const state = useAppState()
  const commands = useCommands()
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  if (!state) return <LoadingScreen label="Carregando o cardápio" />
  return (
    <div className="page">
      <div className="toolbar">
        <p className="counter">Gerencie o que os alunos veem agora.</p>
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={20} aria-hidden="true" />Adicionar item</button>
      </div>
      <div className="mgr">
        {CATEGORIES.map((c) => {
          const items = state.menu.filter((i) => i.cat === c.id)
          if (!items.length) return null
          const Icon = CATEGORY_ICON[c.id]
          return (
            <section key={c.id} className="mgr-cat">
              <h2><Icon size={18} aria-hidden="true" />{c.name}</h2>
              <ul>
                {items.map((i) => (
                  <li key={i.id} className={'mgr-row' + (i.available ? '' : ' off')}>
                    <Photo item={i} size="sm" />
                    <div className="mgr-name"><b>{i.name}</b><small>{i.available ? 'Disponível' : 'Indisponível para os alunos'}</small></div>
                    <PriceField item={i} />
                    <button type="button" className="switch" role="switch" aria-checked={i.available} aria-label={'Disponibilidade de ' + i.name}
                      onClick={() => void commands.setAvailability(i.id, !i.available).catch(() => toast('Não foi possível alterar', undefined, { type: 'warn' }))} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <NewItemSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
