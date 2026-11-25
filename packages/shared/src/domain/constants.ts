import type { CategoryId, OrderStatus } from './types.ts'

export const CATEGORIES: { id: CategoryId; name: string }[] = [
  { id: 'lanches', name: 'Lanches' },
  { id: 'salgados', name: 'Salgados' },
  { id: 'sucos', name: 'Sucos' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'doces', name: 'Doces' },
]

export const STATUS_FLOW: OrderStatus[] = ['aguardando', 'preparo', 'pronto', 'retirado']

export const STATUS_INFO: Record<OrderStatus, { label: string; color: string }> = {
  aguardando: { label: 'Aguardando pagamento', color: '#9A4A06' },
  preparo: { label: 'Em preparo', color: '#1F5FC4' },
  pronto: { label: 'Pronto', color: '#1B7F40' },
  retirado: { label: 'Retirado', color: '#485364' },
}

/** conta de demonstração (pedidos de exemplo do seed) */
export const DEMO_STUDENT_ID = 'seed-luiz'
