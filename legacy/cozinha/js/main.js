/* Bootstrap do painel da cantina. */
(function () {
  var F = window.FAESA, h = F.h, icon = F.icon, V = F.kviews;

  var TABS = [
    { id: 'pedidos', label: 'Pedidos', icon: 'columns', href: '#/pedidos' },
    { id: 'cardapio', label: 'Cardápio', icon: 'utensils', href: '#/cardapio' },
    { id: 'relatorio', label: 'Relatório', icon: 'chart-column', href: '#/relatorio' }
  ];
  var tabsEl = h('nav', { class: 'tabs', 'aria-label': 'Seções do painel' }, TABS.map(function (t) {
    var badge = h('span', { class: 'count', 'data-badge': t.id, hidden: true });
    return h('a', { href: t.href, 'data-tab': t.id }, icon(t.icon, { size: 18 }), h('span', null, t.label), t.id === 'pedidos' ? badge : null);
  }));
  var live = h('span', { class: 'live', title: 'Sincronizado em tempo real com o app do aluno' }, 'Tempo real');
  var header = h('header', { class: 'topbar' }, h('div', { class: 'brand' }, F.logo({ height: 22, plate: true }),
    h('div', null, h('b', null, 'Cantina FAESA', h('span', { class: 'bl' }, ' — Bloco B')), h('small', null, h('span', { class: 'bl2' }, 'Bloco B · '), 'Painel da cantina'))), live,
    h('a', { class: 'btn btn-sm top-link', href: '../app/index.html', target: '_blank', rel: 'noopener' }, icon('smartphone', { size: 18 }), h('span', null, 'App do aluno')));
  var outlet = h('main', { id: 'main', tabindex: '-1' });
  document.getElementById('root').append(header, tabsEl, outlet);

  var router = F.router({
    appName: 'Cantina FAESA — Bloco B', outlet: outlet, fallback: '/pedidos',
    routes: [
      { path: '/pedidos', view: V.pedidos, title: 'Pedidos', tab: 'pedidos' },
      { path: '/cardapio', view: V.cardapio, title: 'Cardápio', tab: 'cardapio' },
      { path: '/relatorio', view: V.relatorio, title: 'Relatório', tab: 'relatorio' }
    ],
    onChange: function (r) {
      tabsEl.querySelectorAll('a').forEach(function (a) { var on = a.dataset.tab === r.tab; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    }
  });

  function badge(s) {
    var n = s.orders.filter(function (o) { return o.status === 'aguardando'; }).length;
    var b = tabsEl.querySelector('[data-badge]'); b.hidden = !n; b.textContent = n;
  }
  var known = new Set(F.store.get().orders.map(function (o) { return o.number; }));
  F.store.subscribe(function (s) {
    s.orders.forEach(function (o) {
      if (known.has(o.number)) return; known.add(o.number);
      if (o.via !== 'sim') F.toast('Novo pedido ' + F.fmt.num(o.number), o.customer + ' · ' + F.fmt.brl(o.total) + (o.via === 'ia' ? ' · feito pelo assistente' : ''), { type: 'info', icon: 'receipt', ms: 6000 });
    });
    badge(s);
  });
  badge(F.store.get());

  // Relatório periódico simulado (n8n "Cron"): demo a cada 2 min enquanto o painel estiver aberto
  setInterval(function () {
    if (Date.now() >= V.nextReportAt) { F.store.fireReport('cron'); V.nextReportAt = Date.now() + 120000; F.toast('Relatório automático', 'Resumo de vendas publicado na aba Relatório.', { type: 'info', icon: 'workflow' }); }
  }, 1000);

  router.start();
})();
