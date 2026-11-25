/* Auditoria de contraste (WCAG 2.x) lendo os tokens de src/styles/tokens.css.
   Texto >= 4,5:1; borda/ícone de UI >= 3:1; divisores >= 2:1. */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'tokens.css'), 'utf8')
const tok: Record<string, string> = {}
for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) tok[m[1]] = m[2]

const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a: string, b: string): number => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
const W = '#FFFFFF'
const T = (k: string): string => { if (!tok[k]) throw new Error('token ausente: ' + k); return tok[k] }

const pairs: [string, () => string, () => string, number][] = [
  ['texto principal / branco', () => T('ink'), () => W, 4.5],
  ['texto secundário / branco', () => T('gray'), () => W, 4.5],
  ['texto secundário / card', () => T('gray'), () => T('card'), 4.5],
  ['texto secundário / coluna do kanban', () => T('gray'), () => T('col'), 4.5],
  ['placeholder / branco', () => T('placeholder'), () => W, 4.5],
  ['borda de input, chip e botão / branco', () => T('line-strong'), () => W, 3],
  ['trilho do switch desligado / branco', () => T('toggle-off'), () => W, 3],
  ['ícone cinza (timeline pendente) / branco', () => T('icon-muted'), () => W, 3],
  ['botão CTA: branco / fundo', () => W, () => T('cta'), 4.5],
  ['rótulo laranja pequeno / branco', () => T('orange-ink'), () => W, 4.5],
  ['contador laranja / coluna do kanban', () => T('orange-ink'), () => T('col'), 4.5],
  ['barra de destaque do gráfico / branco', () => T('orange-deep'), () => W, 3],
  ['botão primário: branco / azul', () => W, () => T('blue-600'), 4.5],
  ['botão confirmar: branco / verde', () => W, () => T('green'), 4.5],
  ['status "aguardando" / branco', () => T('status-wait'), () => W, 4.5],
  ['tag sem açúcar / branco', () => T('teal'), () => W, 4.5],
  ['atraso (vermelho) / branco', () => T('red'), () => W, 4.5],
  ['título azul-escuro / branco', () => T('blue-900'), () => W, 4.5],
  ['header: branco / azul', () => W, () => T('blue-900'), 4.5],
  ['legenda do header / azul', () => T('on-dark-muted'), () => T('blue-900'), 4.5],
  ['divisor e borda de cartão / branco', () => T('line'), () => W, 2],
  ['filtro ativo: texto / fundo do toggle', () => T('blue-900'), () => T('toggle-on'), 4.5],
  ['filtro ativo: borda azul / fundo do toggle', () => T('blue-600'), () => T('toggle-on'), 3],
  ['atalho do chat: texto azul / branco', () => T('blue-600'), () => W, 4.5],
  ['botão "+" (ícone e contorno azul) / branco', () => T('blue-600'), () => W, 3],
  ['aba inativa / branco', () => T('gray'), () => W, 4.5],
  ['botão desabilitado: texto / fundo', () => T('disabled-ink'), () => T('disabled-bg'), 4.5],
  ['badge do carrinho: branco / CTA', () => W, () => T('cta'), 4.5],
]

describe('contraste WCAG AA', () => {
  it.each(pairs)('%s', (_name, fg, bg, min) => { expect(ratio(fg(), bg())).toBeGreaterThanOrEqual(min) })
  it('fundo da página se separa do header', () => { expect(ratio(T('bg-page'), T('blue-900'))).toBeGreaterThanOrEqual(1.2) })
})
