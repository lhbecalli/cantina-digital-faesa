import { lazy, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { ApiError, CantinaProvider, ErrorBoundary, Logo, ToastProvider, createCantinaStore, createRemoteTransport, verifyAdminPin } from '@cantina/shared'
import type { CantinaStore } from '@cantina/shared'
import { Layout } from './components/Layout.tsx'
import { readPin, savePin } from './pin.ts'

const PedidosPage = lazy(() => import('./pages/PedidosPage.tsx'))
const CardapioPage = lazy(() => import('./pages/CardapioPage.tsx'))
const RelatorioPage = lazy(() => import('./pages/RelatorioPage.tsx'))


export function PainelRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/pedidos" replace />} />
        <Route path="pedidos" element={<PedidosPage />} />
        <Route path="cardapio" element={<CardapioPage />} />
        <Route path="relatorio" element={<RelatorioPage />} />
        <Route path="*" element={<Navigate to="/pedidos" replace />} />
      </Route>
    </Routes>
  )
}

/** Acesso do painel por PIN (ADMIN_PIN do servidor). Sem login real: só impede que qualquer pessoa mexa no cardápio e nos pedidos. */
function PinGate({ onOk }: { onOk: (pin: string) => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!pin || busy) return
    setBusy(true); setError('')
    try { if (await verifyAdminPin(pin)) { savePin(pin); onOk(pin) } else setError('PIN incorreto.') }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível verificar o PIN.') }
    finally { setBusy(false) }
  }
  return (
    <main className="pin-gate">
      <form className="pin-card" onSubmit={(e) => void submit(e)}>
        <Logo height={30} />
        <h1>Painel da cantina</h1>
        <p>Digite o PIN de acesso para gerenciar pedidos e cardápio.</p>
        <label className="field">PIN
          <input className="input" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'pin-erro' : undefined} data-autofocus autoFocus />
        </label>
        {error && <p id="pin-erro" role="alert" className="pin-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={!pin || busy}><Lock size={20} aria-hidden="true" />{busy ? 'Verificando…' : 'Entrar'}</button>
      </form>
    </main>
  )
}

export function App({ store: injected }: { store?: CantinaStore }) {
  const [pin, setPin] = useState(readPin)
  const store = useMemo(() => injected ?? (pin ? createCantinaStore(createRemoteTransport({ role: 'admin', pin })) : null), [injected, pin])
  return (
    <ErrorBoundary>
      <ToastProvider>
        {store
          ? <CantinaProvider store={store}><BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}><PainelRoutes /></BrowserRouter></CantinaProvider>
          : <PinGate onOk={setPin} />}
      </ToastProvider>
    </ErrorBoundary>
  )
}
