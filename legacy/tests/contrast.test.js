/* Auditoria de contraste (WCAG 2.x). Uso: node tests/contrast.test.js
   Lê os tokens de shared/css/tokens.css e confere os pares de cor principais (texto >= 4,5:1; borda/ícone de UI >= 3:1). */
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'shared', 'css', 'tokens.css'), 'utf8');
const tok = {};
css.replace(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g, (_, k, v) => { tok[k] = v; });

function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

// [descrição, cor do primeiro plano, fundo, mínimo, valor antigo (opcional)]
const T = k => tok[k];
const pairs = [
  ['texto principal / branco', T('ink'), '#FFFFFF', 4.5],
  ['texto secundário (cinza) / branco', T('gray'), '#FFFFFF', 4.5, '#5B6676'],
  ['texto secundário / card #F2F6FB', T('gray'), T('card'), 4.5, '#5B6676'],
  ['texto secundário / coluna do kanban', T('gray'), T('col'), 4.5, '#5B6676'],
  ['placeholder / branco', T('placeholder'), '#FFFFFF', 4.5, '#757575'],
  ['borda de input, chip e botão / branco', T('line-strong'), '#FFFFFF', 3, '#DFE6F0'],
  ['trilho do switch desligado / branco', T('toggle-off'), '#FFFFFF', 3, '#B8C1CF'],
  ['ícone cinza (timeline pendente) / branco', T('icon-muted'), '#FFFFFF', 3, '#A3ADBB'],
  ['ícone "+" do card (laranja-vermelho) / branco', T('cta-ink'), '#FFFFFF', 3, '#E5471B'],
  ['botão CTA: branco / fundo', '#FFFFFF', T('cta'), 4.5, '#E5471B'],
  ['rótulo laranja pequeno / branco', T('orange-ink'), '#FFFFFF', 4.5, '#B35A00'],
  ['contador laranja / coluna do kanban', T('orange-ink'), T('col'), 4.5, '#B35A00'],
  ['barra de destaque do gráfico / branco', T('orange-deep'), '#FFFFFF', 3, '#F5921E'],
  ['botão primário: branco / azul', '#FFFFFF', T('blue-600'), 4.5],
  ['botão confirmar: branco / verde', '#FFFFFF', T('green'), 4.5],
  ['status "aguardando" / branco', T('status-wait'), '#FFFFFF', 4.5, '#B45309'],
  ['tag sem açúcar (verde-azulado) / branco', T('teal'), '#FFFFFF', 4.5],
  ['atraso (vermelho) / branco', T('red'), '#FFFFFF', 4.5],
  ['título azul-escuro / branco', T('blue-900'), '#FFFFFF', 4.5],
  ['texto do header: branco / azul header', '#FFFFFF', T('blue-900'), 4.5],
  ['legenda do header / azul header', T('on-dark-muted'), T('blue-900'), 4.5, '#B3C0D3 (opacidade .8)'],
  ['fundo da página vs header (separação)', T('bg-page'), T('blue-900'), 1.2],
  ['divisor e borda de cartão / branco', T('line'), '#FFFFFF', 2, '#DFE6F0'],
  ['filtro ativo: texto azul-escuro / fundo do toggle', T('blue-900'), T('toggle-on'), 4.5],
  ['filtro ativo: borda azul / fundo do toggle', T('blue-600'), T('toggle-on'), 3],
  ['filtro ativo: borda azul / branco', T('blue-600'), '#FFFFFF', 3],
  ['atalho do chat: texto azul / branco', T('blue-600'), '#FFFFFF', 4.5],
  ['botão "+" (ícone e contorno azul) / branco', T('blue-600'), '#FFFFFF', 3],
  ['aba de categoria inativa / branco', T('gray'), '#FFFFFF', 4.5],
  ['aba de categoria ativa / branco', T('blue-900'), '#FFFFFF', 4.5],
  ['sublinhado da aba ativa / branco', T('blue-600'), '#FFFFFF', 3],
  ['botão desabilitado: texto / fundo', T('disabled-ink'), T('disabled-bg'), 4.5],
  ['item esgotado: nome em cinza / branco', T('gray'), '#FFFFFF', 4.5],
  ['badge do carrinho: branco / CTA', '#FFFFFF', T('cta'), 4.5],
  ['texto pequeno (13px) "Pendente" / card', T('gray'), T('card'), 4.5],
  ['"ferramentas usadas" / branco', T('gray'), '#FFFFFF', 4.5],
];
let fail = 0;
console.log('par'.padEnd(52) + 'antes'.padEnd(10) + 'depois'.padEnd(8) + 'mín');
pairs.forEach(([name, fg, bg, min, old]) => {
  if (!fg || !bg) { console.log('FALTA TOKEN em: ' + name); fail++; return; }
  const r = ratio(fg, bg);
  let b = '';
  if (old && /^#[0-9a-f]{6}$/i.test(old)) b = (name.startsWith('botão CTA') ? ratio('#FFFFFF', old) : ratio(old, bg)).toFixed(2);
  const ok = r >= min;
  if (!ok) fail++;
  console.log(name.padEnd(52) + (b || '-').padEnd(10) + r.toFixed(2).padEnd(8) + min + (ok ? '' : '   <-- ABAIXO'));
});
console.log(fail ? '\n' + fail + ' pares abaixo do mínimo' : '\nTodos os pares atendem o mínimo');
process.exit(fail ? 1 : 0);
