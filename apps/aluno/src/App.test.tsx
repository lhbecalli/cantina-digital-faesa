import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ApiError, CantinaProvider, ToastProvider, createTestStore, sampleState } from '@cantina/shared'
import type { Commands } from '@cantina/shared'
import { AppRoutes } from './App.tsx'
import { cartStore, createCartStore } from './cart/cartStore.ts'
import { chatStore } from './chat/chatStore.ts'

function setup(path = '/cardapio', handlers: Partial<Commands> = {}, state = sampleState()) {
  cartStore.clear()
  const t = createTestStore(state, handlers)
  render(<ToastProvider><CantinaProvider store={t.store}><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></CantinaProvider></ToastProvider>)
  return t
}

describe('cardápio e carrinho', () => {
  it('lista o cardápio e marca item esgotado', async () => {
    setup()
    expect(await screen.findByText('Misto Quente')).toBeInTheDocument()
    expect(screen.getByText('Esgotado')).toBeInTheDocument()
  })

  it('filtro "Sem açúcar" mostra só os itens com a tag e tem estado ativo claro', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Sem açúcar' }))
    expect(screen.getByRole('button', { name: 'Sem açúcar' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Misto Quente')).not.toBeInTheDocument()
    expect(screen.getByText('Suco de Laranja')).toBeInTheDocument()
  })

  it('adiciona ao carrinho e mostra a barra do carrinho', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: /Adicionar Misto Quente/ }))
    expect(await screen.findByText(/Ver carrinho · 1 item/)).toBeInTheDocument()
  })

  it('confirmar pedido envia uma chave de idempotência e não duplica com clique duplo', async () => {
    const createOrder = vi.fn(async () => ({ ...sampleState().orders[0], number: 44 }))
    const t = setup('/cardapio', { createOrder })
    await userEvent.click(await screen.findByRole('button', { name: /Adicionar Misto Quente/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Abrir carrinho/ }))
    const confirm = await screen.findByRole('button', { name: /Confirmar pedido/ })
    await userEvent.dblClick(confirm)
    await waitFor(() => expect(createOrder).toHaveBeenCalled())
    expect(createOrder).toHaveBeenCalledTimes(1)
    const arg = (createOrder.mock.calls[0] as unknown[])[0] as { clientRequestId: string; lines: unknown[] }
    expect(arg.clientRequestId).toMatch(/.{8,}/); expect(arg.lines).toEqual([{ id: 'misto', qty: 1 }])
    expect(t.transport.calls.filter((c) => c.name === 'createOrder')).toHaveLength(1)
  })

  it('item que ficou esgotado sai do carrinho ao confirmar (erro 409 do servidor)', async () => {
    cartStore.clear()
    const createOrder = vi.fn(async () => { throw new ApiError('item_unavailable', 'esgotado', 409, { ids: ['misto'] }) })
    setup('/cardapio', { createOrder })
    await userEvent.click(await screen.findByRole('button', { name: /Adicionar Misto Quente/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Abrir carrinho/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Confirmar pedido/ }))
    expect(await screen.findByText(/Item esgotado/)).toBeInTheDocument()
    await waitFor(() => expect(cartStore.getSnapshot().lines).toHaveLength(0))
  })
})

describe('assistente', () => {
  it('manda a mensagem ao backend e aplica o carrinho devolvido', async () => {
    cartStore.clear(); chatStore.reset()
    const chat = vi.fn(async () => ({ text: 'Adicionei: 1x Misto Quente.', tools: [{ name: 'adicionar_ao_carrinho', args: { item_id: 'misto' }, result: 'ok' }], attach: [{ type: 'cart' as const }], cart: { lines: [{ id: 'misto', qty: 1 }], viaIA: true } }))
    setup('/assistente', { chat })
    await userEvent.type(await screen.findByLabelText(/Mensagem para a IA/), 'quero um misto{enter}')
    expect(await screen.findByText(/Adicionei: 1x Misto Quente/)).toBeInTheDocument()
    expect(chat).toHaveBeenCalledWith('quero um misto', [], false)
    expect(cartStore.getSnapshot()).toMatchObject({ lines: [{ id: 'misto', qty: 1 }], viaIA: true })
    expect(screen.getByText(/ferramentas usadas \(1\)/)).toBeInTheDocument()
  })
})

describe('ticket e carrinho local', () => {
  it('mostra o ticket com QR e a linha do tempo', async () => {
    setup('/pedidos/42')
    expect(await screen.findByLabelText('QR Code do ticket #0042')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Andamento do pedido' })).toBeInTheDocument()
  })
  it('o carrinho sobrevive a falha de storage (modo privado)', () => {
    const broken = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } } as unknown as Storage
    const c = createCartStore(broken)
    c.add('misto', 2)
    expect(c.getSnapshot().lines).toEqual([{ id: 'misto', qty: 2 }])
  })
})
