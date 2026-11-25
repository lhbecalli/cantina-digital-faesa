import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CantinaProvider, ToastProvider, createTestStore, sampleState } from '@cantina/shared'
import type { Commands } from '@cantina/shared'
import { PainelRoutes } from './App.tsx'
import { downloadReportPdf } from './reportPdf.ts'

vi.mock('./reportPdf.ts', () => ({ downloadReportPdf: vi.fn() }))

function setup(path = '/pedidos', handlers: Partial<Commands> = {}) {
  const t = createTestStore(sampleState(), handlers)
  render(<ToastProvider><CantinaProvider store={t.store}><MemoryRouter initialEntries={[path]}><PainelRoutes /></MemoryRouter></CantinaProvider></ToastProvider>)
  return t
}

describe('painel', () => {
  it('mostra o kanban com o contador de pedidos', async () => {
    setup()
    expect(await screen.findByText('1 em andamento · 1 aguardando')).toBeInTheDocument()
    expect(screen.getAllByText('#0042').length).toBeGreaterThan(0)
  })

  it('confirmar pagamento chama a API uma vez, mesmo com clique duplo', async () => {
    const confirmPayment = vi.fn(async () => sampleState().orders[0])
    setup('/pedidos', { confirmPayment })
    await userEvent.dblClick(await screen.findByRole('button', { name: /Confirmar pagamento/ }))
    await waitFor(() => expect(confirmPayment).toHaveBeenCalledWith(42))
    expect(confirmPayment).toHaveBeenCalledTimes(1)
  })

  it('gestão do cardápio: alterna disponibilidade pela API', async () => {
    const setAvailability = vi.fn(async () => sampleState().menu[0])
    setup('/cardapio', { setAvailability })
    await userEvent.click(await screen.findByRole('switch', { name: /Disponibilidade de Misto Quente/ }))
    expect(setAvailability).toHaveBeenCalledWith('misto', false)
  })

  it('relatório mostra os indicadores e o botão de gerar', async () => {
    const fireReport = vi.fn(async () => ({ id: 'r', at: Date.now(), orders: 0, revenue: 0, avg: 0, top: [], trigger: 'manual' as const }))
    setup('/relatorio', { fireReport })
    await userEvent.click(await screen.findByRole('button', { name: /Gerar relatório/ }))
    expect(fireReport).toHaveBeenCalled()
    await waitFor(() => expect(downloadReportPdf).toHaveBeenCalled())
    expect(screen.getByText('Vendas do dia')).toBeInTheDocument()
  })
})
