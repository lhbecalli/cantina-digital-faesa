/* Views e componentes do app do aluno. Cada view é uma função (ctx) => Node. */
(function () {
  var F = (window.FAESA = window.FAESA || {});
  var h = F.h, icon = F.icon, fmt = F.fmt, cart = F.cart;
  var ME = 'Luiz';
  var V = (F.views = {});

  /* ================= Componentes ================= */
  function catIcon(cat) { var c = F.CATEGORIES.filter(function (x) { return x.id === cat; })[0]; return c ? c.icon : 'utensils'; }

  function tagsRow(item) {
    var out = [];
    if (item.tags.indexOf('sem-acucar') >= 0) out.push(h('span', { class: 'tag' }, icon('ban'), 'Sem açúcar'));
    if (item.tags.indexOf('vegetariano') >= 0) out.push(h('span', { class: 'tag' }, icon('leaf'), 'Vegetariano'));
    return h('div', { class: 'mi-tags' }, out);
  }

  function stepper(item) {
    var q = cart.qty(item.id);
    return h('div', { class: 'stepper', role: 'group', 'aria-label': 'Quantidade de ' + item.name },
      h('button', { type: 'button', 'aria-label': 'Diminuir ' + item.name, onclick: function () { cart.setQty(item.id, q - 1); } }, icon('minus')),
      h('output', { 'aria-live': 'polite' }, String(q)),
      h('button', { type: 'button', 'aria-label': 'Aumentar ' + item.name, onclick: function () { cart.add(item.id, 1); } }, icon('plus')));
  }

  function menuRow(item, compact) {
    var ctl;
    if (!item.available) ctl = h('span', { class: 'pill pill-gray' }, 'Esgotado');
    else ctl = h('button', { type: 'button', class: 'add-btn', 'aria-label': 'Adicionar ' + item.name + ' ao carrinho', onclick: function () { cart.add(item.id, 1); } }, icon('plus'));
    return h('li', { class: 'mi' + (item.available ? '' : ' off') + (compact ? ' compact' : '') },
      F.photo(item, compact ? 'sm' : 'lg'),
      h('div', { class: 'mi-body' }, h('h3', null, item.name), compact ? null : h('p', { class: 'mi-desc' }, item.desc), tagsRow(item), h('div', { class: 'mi-price' }, fmt.brl(item.price)), cart.qty(item.id) > 0 ? h('small', { class: 'in-cart' }, cart.qty(item.id) + ' no carrinho') : null),
      h('div', { class: 'mi-ctl' }, ctl));
  }

  function statusText(status) {
    var s = F.STATUS[status];
    return h('span', { class: 'status-text', style: { color: s.color } }, icon(s.icon, { size: 16 }), s.label);
  }

  function timeline(o) {
    var idx = F.STATUS_FLOW.indexOf(o.status);
    return h('ol', { class: 'timeline', 'aria-label': 'Andamento do pedido' }, F.STATUS_FLOW.map(function (st, i) {
      var s = F.STATUS[st], state = i < idx ? 'done' : i === idx ? 'now' : 'todo';
      return h('li', { class: 'tl ' + state, 'aria-current': state === 'now' ? 'step' : null },
        h('span', { class: 'tl-dot' }, state === 'done' ? icon('check', { size: 14 }) : icon(s.icon, { size: 14 })),
        h('div', null, h('b', null, s.label), h('small', null, o.history[st] ? fmt.time(o.history[st]) : 'Pendente')));
    }));
  }

  function thumbsOf(ids) { return h('div', { class: 'thumbs' }, ids.map(function (id) { var it = F.store.item(id); return it ? F.photo(it, 'xs') : null; })); }
  function thumbs(o) { return thumbsOf(o.items.slice(0, 4).map(function (i) { return i.id; })); }
  function itemsSummary(o) { return o.items.map(function (i) { return i.qty + 'x ' + i.name; }).join(' · '); }

  V.openCart = function () {
    var unsub;
    F.sheet('Seu carrinho', function (body, api) {
      function draw() {
        var lines = cart.lines();
        if (!lines.length) {
          body.replaceChildren(h('div', { class: 'empty' }, icon('shopping-cart', { size: 40 }), h('p', null, 'Seu carrinho está vazio.'),
            h('a', { class: 'btn btn-primary', href: '#/cardapio', onclick: api.close }, 'Ver cardápio')));
          return;
        }
        body.replaceChildren.apply(body, [
          cart.viaIA() ? h('p', { class: 'ai-note' }, icon('bot', { size: 16 }), 'Itens adicionados pelo assistente. Confira antes de confirmar.') : null,
          h('ul', { class: 'cart-lines' }, lines.map(function (l) {
            return h('li', null, F.photo(l.item, 'sm'), h('div', { class: 'cl-name' }, h('b', null, l.item.name), l.item.available ? h('small', null, fmt.brl(l.item.price) + ' cada') : h('small', { class: 'oos' }, 'Esgotado: sai do pedido ao confirmar')),
              h('b', { class: 'line-total' }, fmt.brl(l.qty * l.item.price)), stepper(l.item));
          })),
          h('div', { class: 'total-row' }, h('span', null, 'Total'), h('b', null, fmt.brl(cart.total()))),
          h('div', { class: 'pay-note' }, icon('credit-card', { size: 20 }), h('p', null, h('b', null, 'Pagamento na maquininha, no balcão. '), 'O ticket com QR é gerado ao confirmar.')),
          h('button', { class: 'btn btn-cta btn-block', type: 'button', onclick: function () { V.checkout(api); } }, icon('receipt'), 'Confirmar pedido'),
          h('button', { class: 'btn btn-ghost btn-block', type: 'button', style: { marginTop: '8px' }, onclick: function () { cart.clear(); } }, icon('trash-2'), 'Esvaziar carrinho')
        ].filter(Boolean));
      }
      draw();
      unsub = cart.subscribe(draw);
    }, { onClose: function () { if (unsub) unsub(); } });
  };

  V.checkout = function (api) {
    var all = cart.lines();
    if (!all.length) { F.toast('Carrinho vazio', 'Adicione itens antes de confirmar.', { type: 'warn', icon: 'shopping-cart' }); return; }
    var out = all.filter(function (l) { return !l.item.available; });
    if (out.length) { // item ficou esgotado depois de entrar no carrinho: tira e pede nova confirmação
      out.forEach(function (l) { cart.remove(l.id); });
      F.toast('Item esgotado', out.map(function (l) { return l.item.name; }).join(', ') + ' saiu do carrinho. Revise e confirme de novo.', { type: 'warn', icon: 'circle-alert', ms: 6500 });
      return;
    }
    var o = F.store.createOrder(ME, all.map(function (l) { return { id: l.id, qty: l.qty }; }), cart.viaIA() ? 'ia' : 'app', true);
    if (!o) { F.toast('Não foi possível criar o pedido', 'Tente novamente.', { type: 'warn', icon: 'circle-alert' }); return; }
    cart.clear(); api.close();
    F.toast('Pedido ' + fmt.num(o.number) + ' criado', 'Vá ao balcão e pague na maquininha.', { type: 'ok', icon: 'receipt' });
    location.hash = '#/pedidos/' + o.number;
  };

  V.openNotifs = function () {
    F.sheet('Notificações', function (body) {
      var list = F.store.get().notifications.filter(function (n) { return n.to === ME; });
      body.appendChild(list.length ? h('ul', { class: 'notif-list' }, list.map(function (n) {
        return h('li', null, icon('package-check', { size: 22 }), h('div', null, h('b', null, n.title), h('p', null, n.text), h('small', null, fmt.time(n.at) + ' · aviso automático')));
      })) : h('div', { class: 'empty' }, icon('bell', { size: 36 }), h('p', null, 'Sem notificações. Avisamos quando o pedido ficar pronto.')));
    });
    try { localStorage.setItem('faesa.notifSeen', String(Date.now())); } catch (e) { /* ok */ }
    if (V.onNotifSeen) V.onNotifSeen();
  };

  /* ================= Cardápio ================= */
  var filters = { q: '', cat: 'todos', sem: false, veg: false };

  V.cardapio = function (ctx) {
    var root = h('div', { class: 'page' });
    var listEl = h('div', { class: 'menu-list' });
    var bannerEl = h('div');

    var search = h('input', { class: 'input search', type: 'search', placeholder: 'Buscar no cardápio', 'aria-label': 'Buscar no cardápio', value: filters.q,
      oninput: function (e) { filters.q = e.target.value; drawList(); } });
    var catBar = h('div', { class: 'cat-tabs', role: 'tablist', 'aria-label': 'Categorias' });
    var flagBar = h('div', { class: 'flags', role: 'group', 'aria-label': 'Filtros' });

    function drawBar() {
      var cats = [{ id: 'todos', name: 'Todos' }].concat(F.CATEGORIES);
      catBar.replaceChildren.apply(catBar, cats.map(function (c) {
        return h('button', { class: 'cat-tab', type: 'button', role: 'tab', 'aria-selected': String(filters.cat === c.id), onclick: function () { filters.cat = c.id; drawBar(); drawList(); } }, c.name);
      }));
      flagBar.replaceChildren(h('span', { class: 'flags-label' }, 'Filtrar:'),
        h('button', { class: 'flag', type: 'button', 'aria-pressed': String(filters.sem), onclick: function () { filters.sem = !filters.sem; drawBar(); drawList(); } }, icon(filters.sem ? 'check' : 'ban', { size: 16 }), 'Sem açúcar'),
        h('button', { class: 'flag', type: 'button', 'aria-pressed': String(filters.veg), onclick: function () { filters.veg = !filters.veg; drawBar(); drawList(); } }, icon(filters.veg ? 'check' : 'leaf', { size: 16 }), 'Vegetariano'));
    }
    function drawBanner() {
      var o = F.store.get().orders.filter(function (x) { return x.mine && x.status !== 'retirado'; }).sort(function (a, b) { return b.createdAt - a.createdAt; })[0];
      bannerEl.replaceChildren(o ? h('a', { class: 'order-banner', href: '#/pedidos/' + o.number },
        icon(F.STATUS[o.status].icon, { size: 22 }), h('div', null, h('b', null, 'Pedido ' + fmt.num(o.number)), h('small', null, F.STATUS[o.status].label)), icon('chevron-right')) : '');
    }
    function drawList() {
      var q = F.norm(filters.q.trim());
      var items = F.store.get().menu.filter(function (i) {
        return (filters.cat === 'todos' || i.cat === filters.cat) && (!filters.sem || i.tags.indexOf('sem-acucar') >= 0) && (!filters.veg || i.tags.indexOf('vegetariano') >= 0) &&
          (!q || F.norm(i.name + ' ' + i.desc).indexOf(q) >= 0);
      });
      items.sort(function (a, b) { return (b.available ? 1 : 0) - (a.available ? 1 : 0); });
      listEl.replaceChildren(items.length ? h('ul', null, items.map(function (i) { return menuRow(i); })) :
        h('div', { class: 'empty' }, icon('search', { size: 36 }), h('p', null, 'Nenhum item encontrado com esses filtros.')));
    }
    var today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    root.append(h('div', { class: 'hello' }, h('h1', null, 'Cardápio'), h('p', null, 'Olá, ' + ME + ' · ' + today)),
      bannerEl, h('div', { class: 'search-wrap' }, icon('search', { size: 18 }), search), catBar, flagBar, listEl);
    drawBar(); drawBanner(); drawList();
    ctx.onState(function () { drawBanner(); drawList(); });
    ctx.onCleanup(cart.subscribe(drawList));
    return root;
  };

  /* ================= Pedidos ================= */
  V.pedidos = function (ctx) {
    var root = h('div', { class: 'page' });
    function draw() {
      var mine = F.store.get().orders.filter(function (o) { return o.mine; }).sort(function (a, b) { return b.createdAt - a.createdAt; });
      var act = mine.filter(function (o) { return o.status !== 'retirado'; }), old = mine.filter(function (o) { return o.status === 'retirado'; });
      function card(o) {
        return h('a', { class: 'order-card', href: '#/pedidos/' + o.number },
          h('div', { class: 'oc-top' }, h('b', null, fmt.num(o.number)), statusText(o.status)),
          thumbs(o), h('p', null, itemsSummary(o)), h('div', { class: 'oc-bot' }, h('small', null, fmt.time(o.createdAt)), h('b', null, fmt.brl(o.total))));
      }
      root.replaceChildren(h('h1', { class: 'page-title' }, 'Meus pedidos'),
        h('h2', { class: 'sec' }, 'Em andamento'),
        act.length ? h('div', { class: 'stack' }, act.map(card)) : h('div', { class: 'empty' }, icon('inbox', { size: 36 }), h('p', null, 'Nenhum pedido em andamento.')),
        old.length ? h('h2', { class: 'sec' }, 'Anteriores') : '', old.length ? h('div', { class: 'stack' }, old.map(card)) : '');
    }
    draw(); ctx.onState(draw);
    return root;
  };

  V.ticket = function (ctx) {
    var num = Number(ctx.params.num), root = h('div', { class: 'page' });
    function draw() {
      var o = F.store.order(num);
      if (!o) { root.replaceChildren(h('div', { class: 'empty' }, icon('circle-alert', { size: 36 }), h('p', null, 'Pedido não encontrado.'), h('a', { class: 'btn btn-primary', href: '#/pedidos' }, 'Meus pedidos'))); return; }
      var active = o.status !== 'retirado';
      var payload = 'FAESA-CANTINA|' + fmt.num(o.number) + '|' + o.customer.toUpperCase() + '|' + o.total.toFixed(2);
      root.replaceChildren(
        h('a', { class: 'back', href: '#/pedidos' }, icon('arrow-left', { size: 18 }), 'Meus pedidos'),
        h('div', { class: 'ticket' },
          h('div', { class: 'ticket-head' }, h('span', { class: 'eyebrow' }, 'Ticket'), h('div', { class: 'ticket-num', 'aria-label': 'Pedido número ' + o.number }, fmt.num(o.number)), statusText(o.status)),
          h('div', { class: 'qr-box' + (active ? '' : ' dim') }, F.qr(payload, { size: 168, label: 'QR Code do ticket ' + fmt.num(o.number) })),
          o.status === 'aguardando' ? h('div', { class: 'pay-note' }, icon('credit-card', { size: 20 }), h('p', null, h('b', null, 'Pague na maquininha, no balcão. '), 'Mostre este QR ou o número ' + fmt.num(o.number) + ' ao atendente. O preparo começa após o pagamento.')) : null,
          o.status === 'preparo' ? h('div', { class: 'pay-note ok' }, icon('chef-hat', { size: 20 }), h('p', null, h('b', null, 'Pagamento confirmado. '), 'Seu pedido está sendo preparado.')) : null,
          o.status === 'pronto' ? h('div', { class: 'pay-note ready' }, icon('package-check', { size: 20 }), h('p', null, h('b', null, 'Pronto para retirada. '), 'Apresente este ticket no balcão.')) : null,
          o.status === 'retirado' ? h('div', { class: 'pay-note' }, icon('circle-check', { size: 20 }), h('p', null, 'Ticket encerrado.')) : null),
        h('h2', { class: 'sec' }, 'Acompanhe em tempo real'), h('div', { class: 'card' }, timeline(o)),
        h('h2', { class: 'sec' }, 'Itens'),
        h('div', { class: 'card' }, h('ul', { class: 'sum' }, o.items.map(function (i) { return h('li', null, h('span', { class: 'sum-name' }, F.photo(F.store.item(i.id) || { id: i.id, cat: 'lanches' }, 'xs'), i.qty + 'x ' + i.name), h('b', null, fmt.brl(i.qty * i.price))); })),
          h('div', { class: 'total-row' }, h('span', null, 'Total'), h('b', null, fmt.brl(o.total)))));
    }
    draw(); ctx.onState(draw);
    return root;
  };

  /* ================= Assistente (chat IA simulado) ================= */
  var chat = [{ role: 'bot', text: 'Olá, Luiz. Posso mostrar o cardápio, montar seu pedido, ver o status e sugerir combos.', tools: [], attach: [] }];

  function botAttachments(m) {
    var out = [];
    (m.attach || []).forEach(function (a) {
      if (a.type === 'items') out.push(h('ul', { class: 'chat-items' }, a.ids.map(function (id) { var it = F.store.item(id); return it ? menuRow(it, true) : null; })));
      if (a.type === 'cart') {
        var lines = cart.lines();
        if (!lines.length) return; // carrinho já confirmado/esvaziado: mensagens antigas não mostram bloco vazio
        out.push(h('div', { class: 'chat-cart' },
          lines.length ? h('ul', null, lines.map(function (l) { return h('li', null, h('span', { class: 'sum-name' }, F.photo(l.item, 'xs'), l.qty + 'x ' + l.item.name), h('b', null, fmt.brl(l.qty * l.item.price))); })) : h('p', null, 'Carrinho vazio.'),
          h('div', { class: 'total-row' }, h('span', null, 'Total'), h('b', null, fmt.brl(cart.total()))),
          lines.length ? h('button', { class: 'btn btn-cta btn-block', type: 'button', onclick: V.openCart }, icon('shopping-cart'), 'Ir para o carrinho') : null));
      }
      if (a.type === 'status') {
        var o = F.store.order(a.number);
        if (o) out.push(h('div', { class: 'chat-status' }, h('div', { class: 'oc-top' }, h('b', null, fmt.num(o.number)), statusText(o.status)), timeline(o), h('a', { class: 'btn btn-ghost btn-sm', href: '#/pedidos/' + o.number }, 'Abrir ticket')));
      }
      if (a.type === 'combos') a.combos.forEach(function (c) {
        out.push(h('div', { class: 'combo' }, h('div', null, thumbsOf(c.ids), h('span', { class: 'eyebrow' }, c.label), h('b', null, c.ids.map(function (id) { return F.store.item(id).name; }).join(' + ')), h('small', null, c.note + ' · ' + fmt.brl(c.price))),
          h('button', { class: 'btn btn-cta btn-sm', type: 'button', 'aria-label': 'Adicionar combo ao carrinho', onclick: function () {
            c.ids.forEach(function (id) { cart.add(id, 1, true); });
            pushBot({ text: 'Combo adicionado ao carrinho.', tools: [{ name: 'adicionar_ao_carrinho', args: { itens: c.ids }, result: 'ok' }], attach: [{ type: 'cart' }] });
          } }, icon('plus'), 'Adicionar')));
      });
    });
    return out;
  }
  var pushBot, redrawChat;

  V.assistente = function (ctx) {
    var list = h('div', { class: 'chat-list', 'aria-live': 'polite', 'aria-label': 'Conversa com a IA da cantina' });
    var chips = h('div', { class: 'chips chat-chips' });
    var input = h('input', { class: 'input', type: 'text', placeholder: 'Ex.: quero um misto e um suco', 'aria-label': 'Mensagem para a IA da cantina', autocomplete: 'off', enterkeyhint: 'send' });
    var typing = false;
    var cartLine = h('button', { class: 'cart-inline', type: 'button', hidden: true, onclick: V.openCart });
    function drawCartLine() {
      var n = cart.count(); cartLine.hidden = !n;
      if (n) cartLine.replaceChildren(icon('shopping-cart', { size: 20 }), h('span', null, 'Ver carrinho · ' + n + (n === 1 ? ' item' : ' itens')), h('b', null, fmt.brl(cart.total())));
    }

    function bubble(m) {
      if (m.role === 'user') return h('div', { class: 'msg user' }, h('p', null, m.text));
      var tools = m.tools && m.tools.length ? h('details', { class: 'tools' }, h('summary', null, icon('zap', { size: 13 }), 'ferramentas usadas (' + m.tools.length + ')'),
        h('ul', null, m.tools.map(function (t) { return h('li', null, h('code', null, t.name + '(' + JSON.stringify(t.args) + ')'), h('span', null, ' → ' + t.result)); }))) : null;
      return h('div', { class: 'msg bot' }, h('span', { class: 'avatar' }, icon('bot', { size: 18 })), h('div', { class: 'bot-body' }, h('p', null, m.text), botAttachments(m), tools));
    }
    function draw(keep) {
      list.replaceChildren.apply(list, chat.map(bubble).concat(typing ? [h('div', { class: 'msg bot' }, h('span', { class: 'avatar' }, icon('bot', { size: 18 })), h('div', { class: 'bot-body typing', 'aria-label': 'IA digitando' }, h('i'), h('i'), h('i')))] : []));
      if (keep !== true) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
    redrawChat = draw;
    pushBot = function (m) { m.role = 'bot'; chat.push(m); draw(); };
    function send(text) {
      text = (text || '').trim(); if (!text || typing) return;
      chat.push({ role: 'user', text: text }); input.value = ''; typing = true; draw();
      var reply = F.agent.respond(text);
      setTimeout(function () { typing = false; reply.role = 'bot'; chat.push(reply); draw(); }, 650);
    }
    chips.replaceChildren.apply(chips, F.agent.suggestions.map(function (s) { return h('button', { class: 'suggest', type: 'button', onclick: function () { send(s); } }, s); }));
    var form = h('form', { class: 'composer', onsubmit: function (e) { e.preventDefault(); send(input.value); } }, input,
      h('button', { class: 'btn btn-primary send', type: 'submit', 'aria-label': 'Enviar mensagem' }, icon('send')));

    var root = h('div', { class: 'page chat' },
      h('div', { class: 'ai-head' }, h('span', { class: 'avatar big' }, icon('bot', { size: 24 })), h('div', null, h('h1', null, 'Assistente da cantina'), h('small', null, 'IA da cantina'))),
      list, h('div', { class: 'composer-wrap' }, cartLine, chips, form));
    draw(); drawCartLine(); window.scrollTo(0, 0);
    ctx.onCleanup(function () { redrawChat = null; });
    ctx.onCleanup(cart.subscribe(drawCartLine)); ctx.onState(drawCartLine);
    // atualiza anexos (carrinho/status) quando algo muda
    ctx.onState(function () { if (!typing) draw(true); });
    ctx.onCleanup(cart.subscribe(function () { if (!typing) draw(true); }));
    return root;
  };

  /* ================= Perfil ================= */
  V.perfil = function (ctx) {
    var root = h('div', { class: 'page' });
    function draw() {
      var s = F.store.get(), mine = s.orders.filter(function (o) { return o.mine; }), done = mine.filter(function (o) { return o.status === 'retirado'; });
      var spent = mine.filter(function (o) { return o.status !== 'aguardando'; }).reduce(function (a, o) { return a + o.total; }, 0);
      root.replaceChildren(
        h('div', { class: 'profile-head' }, h('span', { class: 'avatar xl' }, 'L'), h('div', null, h('h1', null, ME), h('p', null, 'Sistemas de Informação · 4º período'), h('small', null, 'Matrícula 2024.0042'))),
        h('div', { class: 'stats' }, h('div', { class: 'card' }, h('b', null, String(mine.length)), h('small', null, 'pedidos')), h('div', { class: 'card' }, h('b', null, fmt.brl(spent)), h('small', null, 'gasto'))),
        h('h2', { class: 'sec' }, 'Histórico'),
        done.length ? h('div', { class: 'stack' }, done.sort(function (a, b) { return b.createdAt - a.createdAt; }).map(function (o) {
          return h('a', { class: 'order-card', href: '#/pedidos/' + o.number }, h('div', { class: 'oc-top' }, h('b', null, fmt.num(o.number)), h('small', null, new Date(o.createdAt).toLocaleDateString('pt-BR'))), thumbs(o), h('p', null, itemsSummary(o)), h('div', { class: 'oc-bot' }, h('small', null, ''), h('b', null, fmt.brl(o.total))));
        })) : h('div', { class: 'empty' }, h('p', null, 'Sem pedidos retirados ainda.')),
        h('h2', { class: 'sec' }, 'Demonstração'),
        h('div', { class: 'stack' },
          h('a', { class: 'btn btn-ghost btn-block', href: '../cozinha/index.html', target: '_blank', rel: 'noopener' }, icon('store'), 'Abrir painel da cantina'),
          h('button', { class: 'btn btn-ghost btn-block', type: 'button', onclick: function () { cart.clear(); F.store.reset(); F.toast('Dados reiniciados', 'A demo voltou ao estado inicial.', { icon: 'refresh-cw' }); } }, icon('refresh-cw'), 'Reiniciar dados da demo')));
    }
    draw(); ctx.onState(draw);
    return root;
  };
})();
