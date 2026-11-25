import type { AppState } from './types.ts'

export interface Stats {
  orders: number
  revenue: number
  avg: number
  top: { name: string; qty: number }[]
  series: { hour: number; value: number }[]
  open: number
  waiting: number
}

const isToday = (ts: number): boolean => new Date(ts).toDateString() === new Date().toDateString()

/** Estatísticas do dia para o painel (pedido pago = status diferente de "aguardando"). */
export function computeStats(state: AppState): Stats {
  const paid = state.orders.filter((o) => o.status !== 'aguardando' && isToday(o.createdAt))
  const revenue = paid.reduce((a, o) => a + o.total, 0)
  const counts = new Map<string, number>()
  paid.forEach((o) => o.items.forEach((i) => counts.set(i.name, (counts.get(i.name) ?? 0) + i.qty)))
  const top = [...counts].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5)
  const byHour = new Map<number, number>()
  paid.forEach((o) => { const h = new Date(o.createdAt).getHours(); byHour.set(h, (byHour.get(h) ?? 0) + o.total) })
  const hours = [...byHour.keys()].sort((a, b) => a - b)
  const series: Stats['series'] = []
  if (hours.length) for (let h = hours[0]; h <= Math.max(hours[hours.length - 1], hours[0] + 3); h++) series.push({ hour: h, value: byHour.get(h) ?? 0 })
  return {
    orders: paid.length, revenue, avg: paid.length ? revenue / paid.length : 0, top, series,
    open: state.orders.filter((o) => o.status !== 'retirado').length,
    waiting: state.orders.filter((o) => o.status === 'aguardando').length,
  }
}
