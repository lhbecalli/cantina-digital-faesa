export const brl = (n: number): string => 'R$ ' + Number(n).toFixed(2).replace('.', ',')
export const orderNumber = (n: number): string => '#' + String(n).padStart(4, '0')
export const timeOf = (ts: number | undefined): string =>
  ts ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
export const minutesSince = (ts: number, now = Date.now()): number => Math.floor((now - ts) / 60000)
export function ago(ts: number, now = Date.now()): string {
  const m = minutesSince(ts, now)
  if (m < 1) return 'agora'
  if (m < 60) return 'há ' + m + ' min'
  return 'há ' + Math.floor(m / 60) + ' h'
}
/** minúsculas sem acentos */
export const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
