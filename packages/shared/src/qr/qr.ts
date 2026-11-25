/* Gerador de QR Code em TS puro: modo byte, correção L, versões 1–6 (até 134 bytes), máscara 0 fixa.
   Implementação simplificada do padrão ISO 18004 para o protótipo. Devolve uma matriz booleana. */

const EXP: number[] = new Array(512)
const LOG: number[] = new Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}
const mul = (a: number, b: number): number => (a && b ? EXP[LOG[a] + LOG[b]] : 0)

function gen(n: number): number[] {
  let g = [1]
  for (let k = 0; k < n; k++) {
    const ng = new Array<number>(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[k]) }
    g = ng
  }
  return g
}
function rem(data: number[], n: number): number[] {
  const g = gen(n)
  const r = new Array<number>(n).fill(0)
  for (const b of data) {
    const f = b ^ (r.shift() as number)
    r.push(0)
    for (let k = 0; k < n; k++) r[k] ^= mul(g[k + 1], f)
  }
  return r
}

// versão: [codewords totais, ecc por bloco, nº de blocos]
const VER: ([number, number, number] | null)[] = [null, [26, 7, 1], [44, 10, 1], [70, 15, 1], [100, 20, 1], [134, 26, 1], [172, 18, 2]]
const ALIGN: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]]
const dataCw = (v: number): number => VER[v]![0] - VER[v]![1] * VER[v]![2]

function encode(text: string): { v: number; cw: number[] } {
  const bytes = Array.from(new TextEncoder().encode(text))
  let v = 1
  while (v <= 6 && bytes.length > dataCw(v) - 2) v++
  if (v > 6) throw new Error('Texto longo demais para o QR do protótipo')
  const cap = dataCw(v) * 8
  const bits: number[] = []
  const push = (val: number, len: number) => { for (let k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1) }
  push(4, 4); push(bytes.length, 8); bytes.forEach((b) => push(b, 8))
  push(0, Math.min(4, cap - bits.length))
  while (bits.length % 8) bits.push(0)
  const cw: number[] = []
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let pad = 0xec; cw.length < dataCw(v); pad ^= 0xec ^ 0x11) cw.push(pad)
  const nb = VER[v]![2]
  const per = cw.length / nb
  const blocks: number[][] = []
  const eccs: number[][] = []
  for (let i = 0; i < nb; i++) { const b = cw.slice(i * per, (i + 1) * per); blocks.push(b); eccs.push(rem(b, VER[v]![1])) }
  const out: number[] = []
  for (let i = 0; i < per; i++) blocks.forEach((b) => out.push(b[i]))
  for (let i = 0; i < VER[v]![1]; i++) eccs.forEach((e) => out.push(e[i]))
  return { v, cw: out }
}

export function qrMatrix(text: string): boolean[][] {
  const enc = encode(text)
  const v = enc.v
  const size = 17 + 4 * v
  const m: boolean[][] = []
  const fn: boolean[][] = []
  for (let y = 0; y < size; y++) { m.push(new Array<boolean>(size).fill(false)); fn.push(new Array<boolean>(size).fill(false)) }
  const set = (px: number, py: number, dark: boolean) => { if (px >= 0 && py >= 0 && px < size && py < size) { m[py][px] = dark; fn[py][px] = true } }
  for (let i = 0; i < size; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0) }
  for (const [ox, oy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
      const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6
      const dark = inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4))
      set(ox + dx, oy + dy, dark)
    }
  }
  const al = ALIGN[v]
  for (const cy of al) for (const cx of al) {
    const last = al[al.length - 1]
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === last) || (cy === 6 && cx === last)) continue
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }
  // informação de formato: nível L (01) + máscara 0 (000), BCH(15,5)
  const data5 = (1 << 3) | 0
  let r = data5
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
  const fmt = ((data5 << 10) | r) ^ 0x5412
  const fb = (k: number): boolean => ((fmt >>> k) & 1) === 1
  for (let i = 0; i <= 5; i++) set(8, i, fb(i))
  set(8, 7, fb(6)); set(8, 8, fb(7)); set(7, 8, fb(8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, fb(i))
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, fb(i))
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, fb(i))
  set(8, size - 8, true)
  // posicionamento zigue-zague dos dados
  let k = 0
  const total = enc.cw.length * 8
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const px = right - j
      const upward = ((right + 1) & 2) === 0
      const py = upward ? size - 1 - vert : vert
      if (!fn[py][px] && k < total) { m[py][px] = ((enc.cw[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++ }
      if (!fn[py][px] && (px + py) % 2 === 0) m[py][px] = !m[py][px] // máscara 0
    }
  }
  return m
}

/** Caminho SVG (módulos escuros) com zona de silêncio de 4 módulos. */
export function qrPath(matrix: boolean[][]): { d: string; size: number } {
  const n = matrix.length
  let d = ''
  for (let y = 0; y < n; y++) {
    let x0 = -1
    for (let x = 0; x <= n; x++) {
      const on = x < n && matrix[y][x]
      if (on && x0 < 0) x0 = x
      if (!on && x0 >= 0) { d += 'M' + (x0 + 4) + ' ' + (y + 4) + 'h' + (x - x0) + 'v1h-' + (x - x0) + 'z'; x0 = -1 }
    }
  }
  return { d, size: n + 8 }
}
