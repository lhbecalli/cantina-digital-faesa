/* Agente de IA da cantina (SIMULADO: sem API, sem LLM — regras + palavras-chave).
   Simula "function calling": cada resposta traz as tools chamadas e seus argumentos.
   Tolerante a acentos, maiúsculas, plural e erros simples de digitação (distância de edição). */
(function () {
  var F = (window.FAESA = window.FAESA || {});
  var N = F.norm;
  var USER = 'Luiz';

  var NUMW = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 };
  var ALIAS = {
    'misto': ['misto', 'misto quente', 'queijo quente'],
    'natural': ['natural', 'sanduiche natural', 'natural de peru'],
    'natural-veg': ['natural vegetariano', 'natural vegetariana', 'sanduiche natural vegetariano', 'natural vegano'],
    'xburguer': ['x burguer', 'xburguer', 'x burger', 'xburger', 'x-burguer', 'x-burger', 'hamburguer', 'burguer', 'burger'],
    'pao-queijo': ['pao de queijo', 'paes de queijo', 'pao queijo'],
    'coxinha': ['coxinha'],
    'empada': ['empada', 'empada de palmito'],
    'suco-laranja': ['suco de laranja', 'suco laranja', 'laranja', 'suco'],
    'suco-maracuja': ['suco de maracuja', 'suco maracuja', 'maracuja'],
    'suco-verde': ['suco verde'],
    'cafe': ['cafe', 'cafezinho', 'expresso', 'espresso'],
    'cappuccino': ['cappuccino', 'capuccino', 'capuchino', 'cappucino'],
    'agua': ['agua', 'agua mineral'],
    'refri': ['refrigerante', 'refri', 'coca', 'guarana', 'coca cola'],
    'salada-frutas': ['salada de frutas', 'salada de fruta'],
    'brownie': ['brownie'],
    'cookie': ['cookie', 'cookie de aveia', 'biscoito']
  };
  // palavra de categoria -> id (usada em perguntas e em pedidos genéricos)
  var CAT_WORDS = [
    ['sucos', /\bsucos?\b/], ['salgados', /\bsalgad(o|os|inho|inhos)\b/], ['doces', /\bdoces?\b|\bsobremesas?\b/],
    ['lanches', /\blanches?\b|\bsanduiches?\b/], ['bebidas', /\bbebidas?\b/]
  ];
  var CAT_NAME = { sucos: 'sucos', salgados: 'salgados', doces: 'doces', lanches: 'lanches', bebidas: 'bebidas' };
  var ORDER_VERB = /\b(quero|queria|quer|vou querer|vou levar|me ve|me da|me traz|manda|mande|pede|pedir|peco|adiciona|adicione|adicionar|coloca|coloque|bota|gostaria|separa|reserva|poe|ponha|levo|leva)\b/;
  var QUESTION = /\?|\b(tem|tem algum|qual|quais|o que|que tipo|existe|sobrou|ainda tem|opcao|opcoes|quanto custa|preco|valor|vale quanto)\b/;
  var STOP = /^(hoje|tudo|pedido|pedir|quero|queria|mais|para|esse|essa|isso|algo|quais|qual|como|preco|doce|doces|lanche|lanches|combo|menu|carrinho|total|itens|item|limpar|tirar|trocar|sabor|sabores|fruta|frutas|status|ajuda|valor|custa|barato|sobremesa|bebida|bebidas|salgado|salgados|sucos|cardapio|opcoes|disponivel|esgotado|mesmo|outro|outra|vegetariano|vegetariana|acucar|nada|pode|obrigado|obrigada)$/;

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function keysFor(item) { var k = (ALIAS[item.id] || []).slice(); k.push(N(item.name)); return k; }
  function lev(a, b) {
    var m = a.length, n = b.length, i, j, d = [];
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); }
    return d[m][n];
  }

  /** melhor item citado no trecho: 1) chave exata (a mais longa vence); 2) tolerância a erro de digitação */
  function findItem(seg, menu) {
    var best = null, score = 0;
    menu.forEach(function (it) {
      keysFor(it).forEach(function (k) {
        if (new RegExp('(^|[\\s,.!?])' + esc(k) + '(s|es)?(?=$|[\\s,.!?])').test(seg) && k.length > score) { best = it; score = k.length; }
      });
    });
    if (best) return best;
    var words = seg.split(/[\s,.!?;+]+/).filter(function (w) { return w.length >= 4 && !STOP.test(w) && !/^\d+$/.test(w); });
    var grams = [];
    words.forEach(function (w, i) { grams.push(w); if (words[i + 1]) grams.push(w + ' ' + words[i + 1]); });
    var bestD = 99, bestLen = 0;
    menu.forEach(function (it) {
      keysFor(it).forEach(function (k) {
        if (k.length < 4) return;
        var tol = k.length <= 9 ? 1 : 2;
        grams.forEach(function (g) {
          var cands = [g]; if (/s$/.test(g)) cands.push(g.slice(0, -1));
          cands.forEach(function (c) {
            if (Math.abs(c.length - k.length) > tol) return;
            var d = lev(c, k);
            if (d <= tol && (d < bestD || (d === bestD && k.length > bestLen))) { best = it; bestD = d; bestLen = k.length; }
          });
        });
      });
    });
    return best;
  }
  function findQty(seg) {
    var m = seg.match(/(?:^|\s)(\d+)\s*x?\s|(?:^|\s)(um|uma|dois|duas|tres|quatro|cinco|seis)(?:\s|$)/);
    if (!m) return 1;
    return m[1] ? Math.min(20, Math.max(1, parseInt(m[1], 10))) : NUMW[m[2]];
  }
  function hasQty(seg) { return /(?:^|\s)\d+\s*x?\s|(?:^|\s)(um|uma|dois|duas|tres|quatro|cinco|seis)(?:\s|$)/.test(seg); }
  function call(tools, name, args, result) { tools.push({ name: name, args: args, result: result }); }
  function availIds(ids) { return ids.every(function (id) { var m = F.store.item(id); return m && m.available; }); }

  function statusReply(o) {
    var num = F.fmt.num(o.number);
    if (o.status === 'aguardando') return 'Seu pedido ' + num + ' está aguardando pagamento. Pague na maquininha do balcão e mostre o QR do ticket.';
    if (o.status === 'preparo') return 'Seu pedido ' + num + ' está em preparo desde as ' + F.fmt.time(o.history.preparo) + '. Avisamos quando ficar pronto.';
    if (o.status === 'pronto') return 'Seu pedido ' + num + ' está pronto. Retire no balcão.';
    return 'Seu pedido ' + num + ' já foi retirado.';
  }

  function favoriteCombo(orders) {
    var pairs = {};
    orders.forEach(function (o) {
      var ids = o.items.map(function (i) { return i.id; }).sort();
      for (var a = 0; a < ids.length; a++) for (var b = a + 1; b < ids.length; b++) { var k = ids[a] + '|' + ids[b]; pairs[k] = (pairs[k] || 0) + 1; }
    });
    var best = Object.keys(pairs).sort(function (x, y) { return pairs[y] - pairs[x]; })[0];
    return best ? { ids: best.split('|'), times: pairs[best] } : null;
  }

  function splitSegments(text) {
    return text.split(/\s*(?:,|\+|;|\be\b|\bmais\b|\btambem\b|\bcom\b|\balem de\b)\s*/).filter(Boolean);
  }
  /** o que sobrou de um trecho de pedido sem item reconhecido (para dizer "não encontrei X") */
  function leftover(seg) {
    return seg.replace(ORDER_VERB, ' ').replace(/\b(um|uma|dois|duas|tres|quatro|cinco|seis|\d+x?|o|a|os|as|de|do|da|por favor|pf|favor|tambem|mais|so|ai|ja|me|pra|para|eu|queria|quero|vou|levar|pode|ser|que|ver|gostaria)\b/g, ' ').replace(/[?!.]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  F.agent = {
    USER: USER,
    suggestions: ['O que tem sem açúcar hoje?', 'Quero um misto e um suco', 'Status do meu pedido', 'Sugira um combo', 'Tem opção vegetariana?'],

    /** Retorna { text, tools:[{name,args,result}], attach:[...] } */
    respond: function (raw) {
      var s = F.store.get(), cart = F.cart, text = N(raw).trim(), tools = [], attach = [];
      var avail = s.menu.filter(function (i) { return i.available; });
      var mine = s.orders.filter(function (o) { return o.mine; });
      var reply = function (t) { return { text: t, tools: tools, attach: attach }; };
      var cartMenu = function () { return cart.lines().map(function (l) { return l.item; }); };

      if (!text) return reply('Pode escrever o que você quer pedir ou perguntar.');

      // 0) ajuda / saudação / agradecimento
      if (/\b(ajuda|ajudar|o que (voce|vc) faz|como (funciona|usar)|o que posso)\b/.test(text)) return reply('Posso mostrar o cardápio e filtrar por sem açúcar ou vegetariano, montar seu pedido, trocar ou tirar itens, informar o status e sugerir combos.');
      if (/^(oi|ola|opa|e ai|bom dia|boa tarde|boa noite|hey|hello)\b/.test(text) && text.split(' ').length <= 4) return reply('Olá, Luiz. Posso mostrar o cardápio, montar seu pedido, ver o status ou sugerir um combo.');
      if (/\b(obrigad\w*|valeu|brigad\w*|vlw)\b/.test(text) && !ORDER_VERB.test(text)) return reply('De nada.');

      // 1) status do pedido
      if (/\b(status|cade|onde esta|ja (ta|esta|ficou|saiu)|ficou pronto|meu pedido|andamento|quanto tempo|quanto falta|demora|ja pode retirar)\b|\bpedido\s*(numero|n)?\s*#?\s*\d/.test(text) && !ORDER_VERB.test(text)) {
        var numM = text.match(/#\s*0*(\d{1,4})\b|pedido\s*(?:numero|n)?\s*0*(\d{1,4})\b/), o = null;
        if (numM) { var nn = Number(numM[1] || numM[2]); o = s.orders.filter(function (x) { return x.number === nn && x.mine; })[0]; if (!o) { call(tools, 'consultar_status_pedido', { aluno: USER, numero: nn }, 'não encontrado'); return reply('Não encontrei o pedido ' + F.fmt.num(nn) + ' na sua conta.'); } }
        if (!o) o = mine.filter(function (x) { return x.status !== 'retirado'; }).sort(function (a, b) { return b.createdAt - a.createdAt; })[0];
        call(tools, 'consultar_status_pedido', { aluno: USER, numero: o ? o.number : null }, o ? F.fmt.num(o.number) + ' · ' + o.status : 'nenhum pedido ativo');
        if (!o) return reply('Você não tem pedidos em andamento. Quer ver o cardápio ou montar um pedido?');
        attach.push({ type: 'status', number: o.number });
        return reply(statusReply(o));
      }

      // 2) combos
      if (/\b(combo|combos|sugest\w*|sugira|recomend\w*|indica\w*|o que pedir|me ajuda a escolher|o de sempre)\b/.test(text)) {
        var hist = mine.filter(function (o) { return o.status === 'retirado'; });
        var fav = favoriteCombo(hist);
        call(tools, 'consultar_historico', { aluno: USER, limite: 10 }, hist.length + ' pedidos anteriores');
        var combos = [];
        if (fav && availIds(fav.ids)) combos.push({ ids: fav.ids, label: 'Seu pedido de sempre', note: 'Você já pediu ' + fav.times + 'x' });
        var light = ['natural', 'suco-laranja'];
        if (availIds(light) && !combos.some(function (c) { return c.ids.join() === light.join(); })) combos.push({ ids: light, label: 'Combo leve', note: 'Sem açúcar adicionado' });
        combos.forEach(function (c) { c.price = c.ids.reduce(function (a, id) { return a + F.store.item(id).price; }, 0); });
        call(tools, 'sugerir_combo', { aluno: USER, base: 'historico_pedidos' }, combos.length + ' combos');
        if (!combos.length) return reply('Hoje não consegui montar um combo com itens disponíveis. Quer ver o cardápio?');
        attach.push({ type: 'combos', combos: combos });
        return reply('Com base nos seus pedidos anteriores:');
      }

      // 3) limpar carrinho
      if (/\b(limp\w*|esvazi\w*|zer\w*)\b.*\bcarrinho\b|\bcancel\w*\b.*\b(carrinho|tudo|pedido)\b|\bcomecar de novo\b|\bapaga\w* tudo\b/.test(text)) {
        cart.clear(); call(tools, 'limpar_carrinho', {}, 'ok');
        return reply('Carrinho esvaziado.');
      }

      // 4) trocar item: "troca o suco por café", "troca por cafe"
      if (/\b(troca\w*|substitu\w*|muda\w*)\b/.test(text)) {
        var parts = text.split(/\bpor\b|\bpelo\b|\bpela\b/);
        var right = parts[1] ? findItem(parts[1], s.menu) : null;
        var left = parts[1] ? findItem(parts[0], cartMenu().length ? cartMenu() : s.menu) : null;
        var lines = cart.lines();
        if (!right) return reply('Troco por qual item? Por exemplo: "troca o suco por café".');
        if (!right.available) { call(tools, 'buscar_cardapio', { busca: right.name }, 'esgotado'); return reply(right.name + ' está esgotado hoje. Quer outra opção?'); }
        if (!left && lines.length) left = lines[lines.length - 1].item;
        var lline = left ? lines.filter(function (l) { return l.id === left.id; })[0] : null;
        if (!lline) return reply('Seu carrinho não tem o que trocar. Diga o que você quer pedir.');
        var q = parts[1] && hasQty(parts[0]) ? Math.min(findQty(parts[0]), lline.qty) : lline.qty;
        cart.setQty(left.id, lline.qty - q); cart.add(right.id, q, true);
        call(tools, 'remover_do_carrinho', { item_id: left.id, quantidade: q }, 'ok'); call(tools, 'adicionar_ao_carrinho', { item_id: right.id, quantidade: q }, 'ok');
        attach.push({ type: 'cart' });
        return reply('Troquei ' + q + 'x ' + left.name + ' por ' + right.name + '.');
      }

      // 5) remover item do carrinho
      if (/\b(tira|tire|tirar|remove|remova|remover|retira|retire|retirar|exclui|exclua)\b/.test(text) && !/\bsem acucar\b/.test(text)) {
        var inCart = cartMenu();
        var rm = findItem(text, inCart);
        if (!rm) { // "tira o suco": categoria genérica
          CAT_WORDS.forEach(function (c) { if (!rm && c[1].test(text)) rm = inCart.filter(function (i) { return i.cat === c[0]; })[0] || null; });
        }
        if (!rm) {
          var any = findItem(text, s.menu);
          if (any) return reply(any.name + ' não está no seu carrinho.');
          return reply(inCart.length ? 'Qual item devo tirar? Está no carrinho: ' + inCart.map(function (i) { return i.name; }).join(', ') + '.' : 'Seu carrinho está vazio.');
        }
        var cur = cart.qty(rm.id), take = hasQty(text) ? findQty(text) : cur;
        cart.setQty(rm.id, cur - take);
        call(tools, 'remover_do_carrinho', { item_id: rm.id, quantidade: Math.min(take, cur) }, 'ok');
        attach.push({ type: 'cart' });
        return reply('Tirei ' + Math.min(take, cur) + 'x ' + rm.name + ' do carrinho.');
      }

      // 6) ver carrinho / ir ao carrinho / finalizar
      if (/\b(carrinho|quanto (deu|ficou|to devendo)|meu total|qual (e )?o total|resumo)\b/.test(text) && (!ORDER_VERB.test(text) || /\b(ir|vai|abrir|abre|ver|mostr\w*)\b.*\bcarrinho\b/.test(text))) {
        call(tools, 'ver_carrinho', {}, cart.count() + ' itens');
        if (!cart.count()) return reply('Seu carrinho está vazio. Quer começar por um misto e um suco?');
        attach.push({ type: 'cart' });
        return reply(/\b(ir|abrir|abre|ver|mostra\w*|vai)\b/.test(text) ? 'Toque em "Ir para o carrinho" para revisar e confirmar.' : 'Seu carrinho:');
      }
      if (/\b(finalizar|fechar|fecha|confirmar|confirma|concluir|terminar|e so isso|so isso|pagar)\b/.test(text) && !ORDER_VERB.test(text)) {
        if (!cart.count()) return reply('Seu carrinho está vazio. Diga o que você quer pedir.');
        call(tools, 'ver_carrinho', {}, cart.count() + ' itens'); attach.push({ type: 'cart' });
        return reply('Revise o carrinho e toque em "Confirmar pedido". O pagamento é na maquininha, no balcão.');
      }

      // 7) montar pedido (itens + quantidades)
      var segs = splitSegments(text);
      var found = [], missing = [];
      segs.forEach(function (sg) {
        var it = findItem(sg, s.menu);
        if (it) found.push({ item: it, qty: findQty(sg), seg: sg });
        else if (ORDER_VERB.test(text)) { var lo = leftover(sg); if (lo) missing.push({ text: lo, seg: sg }); }
      });
      var isQuestion = QUESTION.test(raw.toLowerCase()) || QUESTION.test(text);
      var wantsPrice = /\b(quanto custa|quanto (e|sai|fica|esta)|preco|valor|vale quanto|custa)\b/.test(text);
      if (found.length && !wantsPrice && (ORDER_VERB.test(text) || !isQuestion)) {
        var added = [], blocked = [], notes = [];
        found.forEach(function (f) {
          if (!f.item.available) { blocked.push(f.item); return; }
          cart.add(f.item.id, f.qty, true);
          call(tools, 'adicionar_ao_carrinho', { item_id: f.item.id, quantidade: f.qty }, 'ok');
          added.push(f);
          if (f.item.id === 'suco-laranja' && !/laranja/.test(f.seg)) {
            var others = avail.filter(function (i) { return i.cat === 'sucos' && i.id !== 'suco-laranja'; }).map(function (i) { return i.name.replace('Suco de ', '').replace('Suco ', '').toLowerCase(); });
            notes.push('Considerei suco de laranja' + (others.length ? '; também temos ' + others.join(' e ') + '.' : '.'));
          }
          if (f.item.id === 'natural' && !/vegetarian|vegan/.test(f.seg) && availIds(['natural-veg'])) notes.push('Temos também o Natural Vegetariano.');
        });
        var t = '';
        if (added.length) t += 'Adicionei: ' + added.map(function (a) { return a.qty + 'x ' + a.item.name; }).join(', ') + '.';
        if (blocked.length) {
          var alt = avail.filter(function (i) { return i.cat === blocked[0].cat; })[0];
          t += (t ? ' ' : '') + blocked.map(function (b) { return b.name; }).join(', ') + ' está esgotado hoje' + (alt ? '. Que tal ' + alt.name + '?' : '.');
        }
        if (missing.length) t += ' Não encontrei "' + missing.map(function (m) { return m.text; }).join('", "') + '" no cardápio.';
        if (notes.length) t += ' ' + notes[0];
        var hasMain = added.some(function (a) { return a.item.cat === 'lanches' || a.item.cat === 'salgados'; });
        var drinkInCart = cart.lines().some(function (l) { return l.item.cat === 'sucos' || l.item.cat === 'bebidas'; });
        if (added.length) { call(tools, 'ver_carrinho', {}, cart.count() + ' itens · ' + F.fmt.brl(cart.total())); attach.push({ type: 'cart' }); }
        if (added.length && hasMain && !drinkInCart) t += ' Quer acompanhar com um suco ou café?';
        return reply(t || 'Não consegui adicionar esses itens.');
      }

      // 8) pedido sem item reconhecido: categoria genérica ou item inexistente
      var viewIntent = /\b(ver|mostr\w*|list\w*|exib\w*)\b/.test(text) || /acucar|vegetarian|vegan|barat\w*|\bate \d+/.test(text);
      if (ORDER_VERB.test(text) && !found.length && !viewIntent) {
        var catHit = null; CAT_WORDS.forEach(function (c) { if (c[1].test(text)) catHit = c[0]; });
        if (catHit) {
          var opts = avail.filter(function (i) { return i.cat === catHit; });
          call(tools, 'buscar_cardapio', { categoria: catHit, apenas_disponiveis: true }, opts.length + ' itens');
          if (opts.length) { attach.push({ type: 'items', ids: opts.map(function (i) { return i.id; }) }); return reply('Qual dos ' + CAT_NAME[catHit] + ' você quer?'); }
        }
        var lo = leftover(text);
        call(tools, 'buscar_cardapio', { busca: lo || text }, '0 itens');
        return reply((lo ? 'Não encontrei "' + lo + '" no cardápio de hoje.' : 'Não entendi o que você quer pedir.') + ' Posso mostrar os lanches, salgados, sucos ou doces.');
      }

      // 9) consultas ao cardápio (tags, categoria, preço, disponibilidade)
      var filtro = {}, tags = [];
      if (/acucar|diet|\bzero\b|saudavel|\blight\b/.test(text)) tags.push('sem-acucar');
      if (/vegetarian|vegano|vegana|sem carne/.test(text)) tags.push('vegetariano');
      if (tags.length) filtro.tags = tags;
      CAT_WORDS.forEach(function (c) { if (c[1].test(text)) filtro.categoria = c[0]; });
      var maxM = text.match(/\b(?:ate|menos de|abaixo de|no maximo)\s*(?:r\$\s*)?(\d+)/);
      if (maxM) filtro.preco_max = Number(maxM[1]);
      var cheap = /\b(barat\w*|economic\w*)\b/.test(text);
      var soldOut = /\b(esgotad\w*|acabou|indisponiv\w*|em falta|nao tem mais)\b/.test(text);
      // "suco" sozinho resolve para laranja só ao pedir; em consultas significa a categoria inteira
      if (found.length && found[0].item.id === 'suco-laranja' && !/laranja/.test(text)) { found = []; filtro.categoria = filtro.categoria || 'sucos'; }
      if (found.length) filtro.busca = found[0].item.name;
      var generic = /\b(cardapio|menu|o que tem|que tem|opcoes|hoje|disponivel|disponiveis|tem o que|o que voces tem)\b/.test(text);
      if (filtro.tags || filtro.categoria || filtro.busca || filtro.preco_max || cheap || soldOut || wantsPrice || generic) {
        if (soldOut && !found.length) {
          var out = s.menu.filter(function (i) { return !i.available; });
          call(tools, 'buscar_cardapio', { apenas_indisponiveis: true }, out.length + ' itens');
          return reply(out.length ? 'Esgotado hoje: ' + out.map(function (i) { return i.name; }).join(', ') + '.' : 'Tudo disponível hoje.');
        }
        var list = avail.filter(function (i) {
          return (!filtro.tags || filtro.tags.every(function (t) { return i.tags.indexOf(t) >= 0; })) && (!filtro.categoria || i.cat === filtro.categoria) &&
            (!filtro.busca || i.name === filtro.busca) && (!filtro.preco_max || i.price <= filtro.preco_max);
        });
        if (cheap) { list = list.slice().sort(function (a, b) { return a.price - b.price; }).slice(0, 4); filtro.ordenar = 'preco'; }
        filtro.apenas_disponiveis = true;
        call(tools, 'buscar_cardapio', filtro, list.length + ' itens');
        if (found.length && !found[0].item.available) return reply(found[0].item.name + ' está esgotado hoje. Quer ver outras opções?');
        if (!list.length) return reply('Não encontrei itens disponíveis com esse filtro hoje.');
        attach.push({ type: 'items', ids: list.map(function (i) { return i.id; }) });
        if (wantsPrice && found.length) return reply(found[0].item.name + ' custa ' + F.fmt.brl(found[0].item.price) + '.');
        var lead = filtro.tags && filtro.tags.length === 2 ? 'Sem açúcar e vegetarianos hoje:' : filtro.tags && filtro.tags[0] === 'sem-acucar' ? 'Sem açúcar hoje:' : filtro.tags ? 'Vegetarianos hoje:' :
          filtro.preco_max ? 'Até ' + F.fmt.brl(filtro.preco_max) + ':' : cheap ? 'Os mais baratos de hoje:' : filtro.busca ? 'Temos:' : filtro.categoria ? 'Disponíveis em ' + CAT_NAME[filtro.categoria] + ':' : 'Disponível hoje:';
        return reply(lead);
      }

      // 10) conversa geral
      if (/\b(pag\w*|maquininha|pix|cartao|dinheiro)\b/.test(text)) return reply('O pagamento é na maquininha, no balcão. Gere o ticket no app e mostre o QR ao atendente.');
      if (/\b(horario|abre|fecha|funciona|aberto)\b/.test(text)) return reply('A Cantina FAESA do Bloco B funciona das 7h às 21h, de segunda a sábado.');
      return reply('Não entendi. Tente, por exemplo, "quero um misto e um suco", "o que tem sem açúcar?", "status do meu pedido" ou "sugira um combo".');
    }
  };
})();
