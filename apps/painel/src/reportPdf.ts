import { jsPDF } from 'jspdf'
import { brl, timeOf } from '@cantina/shared'
import type { Report, Stats } from '@cantina/shared'

const LEFT = 18, RIGHT = 192
const BLUE: [number, number, number] = [11, 58, 122]
const INK: [number, number, number] = [27, 36, 51]
const GRAY: [number, number, number] = [72, 83, 100]

/** Monta o PDF do relatório de vendas do dia (A4, em milímetros). */
export function buildReportPdf(report: Report, series: Stats['series'], open: number): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const date = new Date(report.at).toLocaleDateString('pt-BR')
  let y = 22

  const text = (value: string, x: number, size: number, color = INK, bold = false, align: 'left' | 'right' = 'left') => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...color)
    doc.text(value, x, y, { align })
  }
  const rule = () => { doc.setDrawColor(169, 184, 204).setLineWidth(0.2).line(LEFT, y, RIGHT, y) }
  const room = (height: number) => { if (y + height > 280) { doc.addPage(); y = 22 } }

  function table(title: string, head: [string, string], rows: [string, string][], empty: string) {
    room(30)
    y += 12
    text(title, LEFT, 13, BLUE, true)
    y += 8
    if (!rows.length) { text(empty, LEFT, 10, GRAY); y += 4; return }
    text(head[0], LEFT, 9, GRAY, true); text(head[1], RIGHT, 9, GRAY, true, 'right')
    y += 3; rule()
    for (const [a, b] of rows) {
      room(8)
      y += 6
      text(a, LEFT, 10); text(b, RIGHT, 10, INK, false, 'right')
      y += 2.5; rule()
    }
  }

  text('Cantina Digital FAESA', LEFT, 18, BLUE, true)
  y += 7
  text(`Relatório de vendas de ${date}, gerado às ${timeOf(report.at)}`, LEFT, 10, GRAY)
  y += 6; rule()

  const figures: [string, string][] = [['Vendas do dia', brl(report.revenue)], ['Pedidos pagos', String(report.orders)], ['Ticket médio', brl(report.avg)], ['Em aberto', String(open)]]
  y += 10
  figures.forEach(([label], i) => text(label, LEFT + i * 44, 9, GRAY))
  y += 7
  figures.forEach(([, value], i) => text(value, LEFT + i * 44, 15, BLUE, true))

  table('Itens mais vendidos', ['Item', 'Unidades'], report.top.map((t) => [t.name, String(t.qty)]), 'Sem itens vendidos ainda.')
  table('Vendas por hora', ['Horário', 'Valor'], series.map((p) => [`${p.hour}h`, brl(p.value)]), 'Sem vendas ainda hoje.')
  return doc
}

export function downloadReportPdf(report: Report, series: Stats['series'], open: number): void {
  const day = new Date(report.at)
  const stamp = [day.getFullYear(), day.getMonth() + 1, day.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
  buildReportPdf(report, series, open).save(`relatorio-cantina-${stamp}.pdf`)
}
