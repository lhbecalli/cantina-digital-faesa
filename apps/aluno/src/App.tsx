import { lazy, useMemo } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CantinaProvider, ErrorBoundary, ToastProvider, createCantinaStore, createRemoteTransport, getStudentId } from '@cantina/shared'
import type { CantinaStore } from '@cantina/shared'
import { Layout } from './components/Layout.tsx'

// Code splitting: cada tela é carregada sob demanda
const CardapioPage = lazy(() => import('./pages/CardapioPage.tsx'))
const PedidosPage = lazy(() => import('./pages/PedidosPage.tsx'))
const TicketPage = lazy(() => import('./pages/TicketPage.tsx'))
const AssistentePage = lazy(() => import('./pages/AssistentePage.tsx'))
const PerfilPage = lazy(() => import('./pages/PerfilPage.tsx'))

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/cardapio" replace />} />
        <Route path="cardapio" element={<CardapioPage />} />
        <Route path="pedidos" element={<PedidosPage />} />
        <Route path="pedidos/:num" element={<TicketPage />} />
        <Route path="assistente" element={<AssistentePage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="*" element={<Navigate to="/cardapio" replace />} />
      </Route>
    </Routes>
  )
}

export function App({ store: injected }: { store?: CantinaStore }) {
  const store = useMemo(() => injected ?? createCantinaStore(createRemoteTransport({ role: 'student', studentId: getStudentId() })), [injected])
  return (
    <ErrorBoundary>
      <ToastProvider>
        <CantinaProvider store={store}>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppRoutes /></BrowserRouter>
        </CantinaProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
