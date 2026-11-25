/* Bootstrap do app do aluno: shell (barra superior, navegação inferior, barra do carrinho), roteador e notificações. */
(function () {
  var F = window.FAESA, h = F.h, icon = F.icon, V = F.views, cart = F.cart;
  var ME = 'Luiz';

  var TABS = [
    { id: 'cardapio', label: 'Cardápio', icon: 'utensils', href: '#/cardapio' },
    { id: 'pedidos', label: 'Pedidos', icon: 'clipboard-list', href: '#/pedidos' },
    { id: 'assistente', label: 'Assistente', icon: 'bot', href: '#/assistente' },
    { id: 'perfil', label: 'Perfil', icon: 'user', href: '#/perfil' }
  ];

  var cartBadge = h('span', { class: 'badge', hidden: true });
  var bellBadge = h('span', { class: 'badge', hidden: true });
  var cartBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Abrir carrinho', onclick: V.openCart }, icon('shopping-cart', { size: 24 }), cartBadge);
  var bellBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Notificações', onclick: V.openNotifs }, icon('bell', { size: 22 }), bellBadge);
  var bar = h('header', { class: 'appbar' }, h('a', { href: '#/cardapio', class: 'brand', 'aria-label': 'Cantina Digital FAESA' }, F.logo({ height: 22, plate: true }), h('span', null, 'Cantina Digital')),
    h('div', { class: 'bar-actions' }, bellBtn, cartBtn));
  var outlet = h('main', { id: 'main', tabindex: '-1' });
  var cartBar = h('button', { class: 'cart-bar', type: 'button', hidden: true, onclick: V.openCart });
  var nav = h('nav', { class: 'tabbar', 'aria-label': 'Navegação principal' }, TABS.map(function (t) {
    return h('a', { href: t.href, 'data-tab': t.id }, icon(t.icon, { size: 22 }), h('span', null, t.label));
  }));
  document.getElementById('root').append(h('a', { class: 'skip', href: '#main' }, 'Ir para o conteúdo'), bar, outlet, cartBar, nav);

  function seenTs() { try { return Number(localStorage.getItem('faesa.notifSeen') || 0); } catch (e) { return 0; } }
  function updateBadges() {
    var n = cart.count();
    cartBadge.hidden = !n; cartBadge.textContent = n;
    var unread = F.store.get().notifications.filter(function (x) { return x.to === ME && x.at > seenTs(); }).length;
    bellBadge.hidden = !unread; bellBadge.textContent = unread;
    var cur = router.current(), tab = cur && cur.route.tab, isTicket = cur && cur.route.path === '/pedidos/:num';
    var show = n && tab !== 'perfil' && tab !== 'assistente'; // no assistente a barra fica dentro da área do chat
    if (show) {
      cartBar.hidden = false;
      var label = (isTicket ? 'Novo pedido' : 'Ver carrinho') + ' · ' + n + (n === 1 ? ' item' : ' itens');
      cartBar.replaceChildren(icon('shopping-cart', { size: 20 }), h('span', null, label), h('b', null, F.fmt.brl(cart.total())));
    } else cartBar.hidden = true;
    if (show) document.body.setAttribute('data-cartbar', ''); else document.body.removeAttribute('data-cartbar');
  }
  V.onNotifSeen = function () { setTimeout(updateBadges, 0); };

  var router = F.router({
    appName: 'Cantina Digital FAESA', outlet: outlet, fallback: '/cardapio',
    routes: [
      { path: '/cardapio', view: V.cardapio, title: 'Cardápio', tab: 'cardapio' },
      { path: '/pedidos', view: V.pedidos, title: 'Pedidos', tab: 'pedidos' },
      { path: '/pedidos/:num', view: V.ticket, title: 'Ticket', tab: 'pedidos' },
      { path: '/assistente', view: V.assistente, title: 'Assistente', tab: 'assistente' },
      { path: '/perfil', view: V.perfil, title: 'Perfil', tab: 'perfil' }
    ],
    onChange: function (route) {
      nav.querySelectorAll('a').forEach(function (a) { var on = a.dataset.tab === route.tab; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      document.body.dataset.route = route.tab;
      updateBadges();
    }
  });

  // Notificações: um toast para cada notificação nova destinada ao aluno (simula o push do n8n)
  var known = new Set(F.store.get().notifications.map(function (n) { return n.id; }));
  var lastStatus = {};
  F.store.get().orders.forEach(function (o) { lastStatus[o.number] = o.status; });
  F.store.subscribe(function (s) {
    s.notifications.forEach(function (n) {
      if (known.has(n.id)) return; known.add(n.id);
      if (n.to === ME) {
        F.toast(n.title, n.text, { type: 'ok', icon: 'package-check', ms: 7000 });
        if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) try { navigator.vibrate([120, 60, 120]); } catch (e) { /* ok */ }
      }
    });
    s.orders.forEach(function (o) {
      if (o.mine && lastStatus[o.number] && lastStatus[o.number] !== o.status && o.status === 'preparo')
        F.toast('Pagamento confirmado', 'Pedido ' + F.fmt.num(o.number) + ' em preparo.', { type: 'info', icon: 'chef-hat' });
      lastStatus[o.number] = o.status;
    });
    updateBadges();
  });
  cart.subscribe(updateBadges);
  router.start();
})();
