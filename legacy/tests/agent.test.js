/* Teste do motor do agente da cantina (roda em Node, sem navegador): node tests/agent.test.js
   Carrega os mesmos scripts do app com stubs mínimos de window/localStorage. */
const path = require('path');
const root = path.join(__dirname, '..');
const mem = {};
global.window = global;
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
global.addEventListener = () => {};
global.setInterval = () => 0;
['shared/js/utils.js', 'shared/js/seed.js', 'shared/js/store.js', 'app/js/cart.js', 'app/js/agent.js'].forEach(f => require(path.join(root, f)));
const F = global.FAESA;

let pass = 0, fail = 0;
function reset() { F.store.reset(); F.cart.clear(); }
function say(t) { return F.agent.respond(t); }
const qty = id => F.cart.qty(id);
const toolNames = r => r.tools.map(t => t.name);
const att = (r, type) => r.attach.filter(a => a.type === type)[0];
function test(name, fn) {
  reset();
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function ok(c, msg) { if (!c) throw new Error(msg || 'asserção falhou'); }
const has = (txt, re) => ok(re.test(txt), 'texto "' + txt + '" não casa ' + re);

console.log('Cardápio: dúvidas');
test('sem açúcar hoje', () => { const r = say('O que tem sem açúcar hoje?'); ok(toolNames(r).includes('buscar_cardapio')); const ids = att(r, 'items').ids; ok(ids.includes('natural') && ids.includes('suco-laranja') && !ids.includes('misto')); ok(ids.every(i => F.store.item(i).tags.includes('sem-acucar'))); });
test('vegetariano', () => { const r = say('tem opção vegetariana?'); const ids = att(r, 'items').ids; ok(ids.includes('empada') && !ids.includes('coxinha')); });
test('sem açúcar e vegetariano', () => { const ids = att(say('quero ver os itens sem açúcar e vegetarianos'), 'items').ids; ok(ids.length && ids.every(i => { const t = F.store.item(i).tags; return t.includes('sem-acucar') && t.includes('vegetariano'); }) && !ids.includes('natural')); });
test('preço do x-burguer', () => has(say('quanto custa o x-burguer?').text, /R\$ 18,00/));
test('preço do café (sem acento/maiúsculas)', () => has(say('QUAL O PRECO DO CAFE').text, /R\$ 4,00/));
test('o que tem hoje', () => { const ids = att(say('o que tem hoje?'), 'items').ids; ok(ids.length >= 10 && !ids.includes('cookie')); });
test('disponibilidade: item esgotado', () => has(say('tem cookie?').text, /esgotado/));
test('lista de esgotados', () => has(say('o que está esgotado?').text, /Cookie/));
test('só sucos', () => { const ids = att(say('quais sucos vocês tem?'), 'items').ids; ok(ids.length === 3 && ids.every(i => i.startsWith('suco'))); });
test('até N reais', () => { const ids = att(say('algo até 6 reais?'), 'items').ids; ok(ids.length && ids.every(i => F.store.item(i).price <= 6)); });
test('mais barato', () => { const ids = att(say('quais os mais baratos?'), 'items').ids; ok(F.store.item(ids[0]).price === 3); });

console.log('Montar pedido');
test('misto + suco', () => { const r = say('quero um misto e um suco'); ok(qty('misto') === 1 && qty('suco-laranja') === 1 && F.cart.total() === 17); ok(att(r, 'cart')); ok(toolNames(r).includes('adicionar_ao_carrinho')); });
test('quantidades: 2 sucos e um misto', () => { say('2 sucos de laranja e um misto'); ok(qty('suco-laranja') === 2 && qty('misto') === 1 && F.cart.total() === 23); });
test('quantidades por extenso', () => { say('quero dois pães de queijo e uma coxinha'); ok(qty('pao-queijo') === 2 && qty('coxinha') === 1); });
test('quantidade numérica com plural', () => { say('quero 3 coxinhas'); ok(qty('coxinha') === 3); });
test('maiúsculas e nome completo', () => { say('QUERO UM MISTO QUENTE COM SUCO DE LARANJA'); ok(F.cart.total() === 17); });
test('erro de digitação', () => { say('quero um misot e uma cuxinha'); ok(qty('misto') === 1 && qty('coxinha') === 1); });
test('sem verbo (só o item)', () => { say('x burguer'); ok(qty('xburguer') === 1); });
test('"suco" genérico assume laranja e avisa', () => { const r = say('quero um suco'); ok(qty('suco-laranja') === 1); has(r.text, /maracujá/); });
test('acumula: mais um suco', () => { say('quero um suco'); say('adiciona mais um suco'); ok(qty('suco-laranja') === 2); });
test('item indisponível', () => { const r = say('quero um cookie'); ok(F.cart.count() === 0); has(r.text, /esgotado/); });
test('item desativado pela cantina', () => { F.store.setAvailability('misto', false); const r = say('quero um misto'); ok(qty('misto') === 0); has(r.text, /esgotado/); });
test('item inexistente', () => { const r = say('quero uma pizza'); ok(F.cart.count() === 0); has(r.text, /N[ãa]o encontrei "pizza"/); });
test('parte existe, parte não', () => { const r = say('quero um misto e uma pizza'); ok(qty('misto') === 1); has(r.text, /pizza/); });
test('pedido genérico: lanche', () => { const r = say('quero um lanche'); ok(F.cart.count() === 0); const ids = att(r, 'items').ids; ok(ids.includes('misto')); });

console.log('Editar carrinho');
test('tirar item', () => { say('quero um misto e um suco'); say('tira o suco'); ok(qty('suco-laranja') === 0 && qty('misto') === 1); });
test('tirar uma unidade', () => { say('quero 2 sucos'); say('tira um suco'); ok(qty('suco-laranja') === 1); });
test('tirar o que não está no carrinho', () => { say('quero um misto'); has(say('tira o café').text, /não está/); ok(qty('misto') === 1); });
test('trocar item por outro', () => { say('quero um misto e um suco'); say('troca o suco por café'); ok(qty('suco-laranja') === 0 && qty('cafe') === 1 && qty('misto') === 1); });
test('trocar sem dizer o que sai', () => { say('quero um misto e um suco'); say('troca por cappuccino'); ok(qty('suco-laranja') === 0 && qty('cappuccino') === 1); });
test('trocar por item esgotado', () => { say('quero um misto'); has(say('troca o misto por cookie').text, /esgotado/); ok(qty('misto') === 1); });
test('trocar só uma unidade', () => { say('quero 2 sucos'); say('troca um suco por café'); ok(qty('suco-laranja') === 1 && qty('cafe') === 1); });
test('limpar carrinho', () => { say('quero um misto'); say('limpa o carrinho'); ok(F.cart.count() === 0); });

console.log('Status, combos, carrinho');
test('status do pedido', () => { const r = say('status do meu pedido'); has(r.text, /#0042/); ok(toolNames(r).includes('consultar_status_pedido') && att(r, 'status').number === 42); });
test('status com acento e pontuação', () => has(say('cadê meu pedido?').text, /#0042/));
test('status de pedido que não é meu', () => has(say('pedido 41').text, /Não encontrei/));
test('status reflete a cozinha', () => { F.store.advance(42); F.store.advance(42); has(say('meu pedido já ficou pronto?').text, /pronto/); });
test('combo pelo histórico', () => { const r = say('sugira um combo'); ok(toolNames(r).includes('sugerir_combo')); const c = att(r, 'combos').combos; ok(c[0].ids.join() === 'misto,suco-laranja' && c[0].price === 17); });
test('ir ao carrinho', () => { say('quero um misto'); const r = say('quero ir para o carrinho'); ok(att(r, 'cart')); });
test('carrinho vazio', () => has(say('ver carrinho').text, /vazio/));
test('quanto deu', () => { say('quero um misto e um suco'); ok(att(say('quanto deu?'), 'cart')); });
test('finalizar', () => { say('quero um misto'); has(say('pode finalizar').text, /Confirmar pedido/); });

console.log('Conversa geral');
test('pagamento', () => has(say('como pago?').text, /maquininha/));
test('saudação', () => has(say('oi').text, /Olá/));
test('agradecimento', () => has(say('obrigado').text, /nada/));
test('ajuda', () => has(say('o que você faz?').text, /cardápio/));
test('entrada sem sentido', () => has(say('asdfgh').text, /Não entendi/));
test('entrada vazia', () => has(say('   ').text, /escrever/));

console.log('\n' + pass + ' ok, ' + fail + ' falhas (' + (pass + fail) + ' casos)');
process.exit(fail ? 1 : 0);
