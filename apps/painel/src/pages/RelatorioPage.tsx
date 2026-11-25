import { useState } from 'react'
import { Banknote, Bell, ClipboardList, Clock, FileText, FlaskConical, Receipt, RefreshCw, TrendingUp, Workflow } from 'lucide-react'
import { LoadingScreen, brl, timeOf, useAppState, useCommands, useStats, useToast } from '@cantina/shared'
import type { Stats } from '@cantina/shared'

const ROUTINES = [
  ['Novos pedidos', 'A cantina é avisada assim que o pedido chega.', ClipboardList],
  ['Pedido pronto', 'O aluno é notificado para fazer a retirada.', Bell],
  ['Relatório de vendas', 'Resumo gerado periodicamente.', FileText],
] as const

function Chart({ series }: { series: Stats['series'] }) {
  const W = 420, H = 170, pad = 26
  const max = Math.max(1, ...series.map((p) => p.value))
  const bw = (W - pad * 2) / Math.max(series.length, 1)
  const nowH = new Date().getHours()
  const label = 'Vendas por hora, em reais. ' + series.map((p) => `${p.hour} horas: ${Math.round(p.value)} reais`).join('; ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line x1={pad} x2={W - pad} y1={H - 26} y2={H - 26} stroke="#A9B8CC" />
      {series.map((p, i) => {
        const bh = Math.round((p.value / max) * (H - 56)), x = pad + i * bw + bw * 0.15, y = H - 26 - bh, cx = x + bw * 0.35
        return (
          <g key={p.hour}>
            <rect x={x} y={y} width={bw * 0.7} height={bh} rx={6} fill={p.hour === nowH ? '#D26A00' : '#1F5FC4'} />
            <text x={cx} y={y - 5} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0B3A7A">{Math.round(p.value)}</text>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={12} fill="#485364">{p.hour}h</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function RelatorioPage() {
  const state = useAppState()
  const stats = useStats()
  const commands = useCommands()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  if (!state || !stats) return <LoadingScreen label="Carregando o relatório" />
  const rep = state.reports[0]
  const maxTop = stats.top[0]?.qty ?? 1
  const kpis: [string, string, typeof Banknote][] = [['Vendas do dia', brl(stats.revenue), Banknote], ['Pedidos pagos', String(stats.orders), Receipt], ['Ticket médio', brl(stats.avg), TrendingUp], ['Em aberto', String(stats.open), Clock]]

  async function fire() {
    if (busy) return
    setBusy(true)
    try {
      const r = await commands.fireReport()
      const { downloadReportPdf } = await import('../reportPdf.ts')
      downloadReportPdf(r, stats?.series ?? [], stats?.open ?? 0)
      toast('Relatório gerado', 'O PDF foi salvo nos downloads.', { type: 'ok', icon: FileText })
    }
    catch { toast('Não foi possível gerar o relatório', undefined, { type: 'warn' }) }
    finally { setBusy(false) }
  }
  async function reset() {
    if (!window.confirm('Reiniciar os dados da demonstração? Pedidos e cardápio voltam ao estado inicial.')) return
    await commands.reset().then(() => toast('Dados reiniciados', 'A demo voltou ao estado inicial.', { icon: RefreshCw })).catch(() => toast('Não foi possível reiniciar', undefined, { type: 'warn' }))
  }

  return (
    <div className="page">
      <div className="kpis">{kpis.map(([label, val, Icon]) => <div key={label} className="kpi"><Icon size={20} aria-hidden="true" /><small>{label}</small><b>{val}</b></div>)}</div>
      <div className="rep-grid">
        <section className="panel"><h2>Vendas por hora (R$)</h2>{stats.series.length ? <Chart series={stats.series} /> : <p className="muted">Sem vendas ainda hoje.</p>}</section>
        <section className="panel"><h2>Itens mais vendidos</h2>
          {stats.top.length ? (
            <ol className="top">{stats.top.map((t, i) => (
              <li key={t.name}><span className="rank">{i + 1}</span><div className="top-body"><div className="top-line"><b>{t.name}</b><span>{t.qty} un.</span></div><div className="bar"><i style={{ width: Math.round((t.qty / maxTop) * 100) + '%' }} /></div></div></li>
            ))}</ol>
          ) : <p className="muted">Sem itens vendidos ainda.</p>}
        </section>
      </div>
      <section className="panel activity">
        <div className="panel-head">
          <h2><Workflow size={18} aria-hidden="true" />Relatórios e notificações</h2>
          <button type="button" className="btn btn-primary" onClick={() => void fire()} disabled={busy}><FileText size={20} aria-hidden="true" />Gerar relatório</button>
        </div>
        <div className="activity-grid">
          <div className="activity-col">
            <article className="info-card">
              <header><h3>Último relatório</h3>{rep && <time>{timeOf(rep.at)}</time>}</header>
              {rep ? (
                <>
                  <dl className="figures">
                    <div><dt>Pedidos</dt><dd>{rep.orders}</dd></div>
                    <div><dt>Vendas</dt><dd>{brl(rep.revenue)}</dd></div>
                    <div><dt>Ticket médio</dt><dd>{brl(rep.avg)}</dd></div>
                  </dl>
                  {rep.top.length > 0 && <p>Destaques: {rep.top.map((t) => `${t.name} (${t.qty})`).join(', ')}.</p>}
                </>
              ) : <p>Nenhum relatório gerado ainda.</p>}
            </article>
            <article className="info-card">
              <header><h3>Rotinas ativas</h3></header>
              <ul className="wf-list">{ROUTINES.map(([title, text, Icon]) => (
                <li key={title}><Icon size={20} aria-hidden="true" /><div><b>{title}</b><small>{text}</small></div><span>Ativa</span></li>
              ))}</ul>
            </article>
          </div>
          <article className="info-card">
            <header><h3>Atividade recente</h3></header>
            {state.log.length ? (
              <ol className="log" aria-label="Atividade recente">
                {state.log.slice(0, 14).map((l) => (
                  <li key={l.id}><time>{timeOf(l.at)}</time><div><b>{l.workflow.replace(' → ', ': ')}</b><p>{l.detail || l.action}</p></div></li>
                ))}
              </ol>
            ) : <p>Sem atividade registrada.</p>}
          </article>
        </div>
      </section>
      <div className="demo-zone">
        <button type="button" className="icon-btn" onClick={() => setShowDemo((v) => !v)} aria-expanded={showDemo} aria-controls="demo-zone-panel" aria-label="Ferramentas de demonstração" title="Demonstração"><FlaskConical size={20} aria-hidden="true" /></button>
        {showDemo && (
          <div id="demo-zone-panel" className="info-card demo-panel">
            <div><h3>Demonstração</h3><p>Restaura pedidos e cardápio ao estado inicial.</p></div>
            <button type="button" className="btn btn-ghost" onClick={() => void reset()}><RefreshCw size={20} aria-hidden="true" />Restaurar dados</button>
          </div>
        )}
      </div>
    </div>
  )
}
