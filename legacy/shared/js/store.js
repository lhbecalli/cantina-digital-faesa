/* Store central com pub/sub e sincronização entre abas/janelas (localStorage + evento `storage`).
   Toda mutação relê o estado salvo antes de aplicar, evitando sobrescrever mudanças da outra tela. */
(function () {
  var F = (window.FAESA = window.FAESA || {});
  var KEY = 'faesa.cantina.v1';
  var listeners = new Set();
  var state = null;
  var lastRaw = null;

  function readRaw() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function load() {
    var raw = readRaw();
    if (!raw) return null;
    try { var s = JSON.parse(raw); lastRaw = raw; return s; } catch (e) { return null; }
  }
  function save() {
    try { lastRaw = JSON.stringify(state); localStorage.setItem(KEY, lastRaw); } catch (e) { /* sem storage: segue só em memória */ }
  }
  function emit() { listeners.forEach(function (fn) { try { fn(state); } catch (e) { console.error(e); } }); }

  state = load();
  if (!state) { state = F.seed.create(); save(); }

  window.addEventListener('storage', function (e) {
    if (e.key !== KEY && e.key !== null) return;
    var s = load();
    if (s) { state = s; emit(); }
  });
  // Plano B: alguns navegadores/contextos file:// não disparam `storage` de forma confiável.
  setInterval(function () {
    var raw = readRaw();
    if (raw && raw !== lastRaw) { var s = load(); if (s) { state = s; emit(); } }
  }, 1500);

  function mutate(fn) {
    var fresh = load();
    if (fresh) state = fresh;
    var out = fn(state);
    state.rev = (state.rev || 0) + 1;
    save();
    emit();
    return out;
  }

  function logAuto(s, workflow, trigger, action, detail) {
    s.log.unshift({ id: F.uid(), at: Date.now(), workflow: workflow, trigger: trigger, action: action, detail: detail || '' });
    s.log = s.log.slice(0, 60);
  }

  function isToday(ts) { var d = new Date(ts), n = new Date(); return d.toDateString() === n.toDateString(); }

  /** Estatísticas do dia (pedidos pagos = status diferente de "aguardando"). */
  function stats(s) {
    var paid = s.orders.filter(function (o) { return o.status !== 'aguardando' && isToday(o.createdAt); });
    var revenue = paid.reduce(function (a, o) { return a + o.total; }, 0);
    var counts = {};
    paid.forEach(function (o) { o.items.forEach(function (i) { counts[i.name] = (counts[i.name] || 0) + i.qty; }); });
    var top = Object.keys(counts).map(function (n) { return { name: n, qty: counts[n] }; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);
    var byHour = {};
    paid.forEach(function (o) { var h = new Date(o.createdAt).getHours(); byHour[h] = (byHour[h] || 0) + o.total; });
    var hours = Object.keys(byHour).map(Number).sort(function (a, b) { return a - b; });
    var series = [];
    if (hours.length) { for (var h = hours[0]; h <= Math.max(hours[hours.length - 1], hours[0] + 3); h++) series.push({ hour: h, value: byHour[h] || 0 }); }
    return { orders: paid.length, revenue: revenue, avg: paid.length ? revenue / paid.length : 0, top: top, series: series,
      open: s.orders.filter(function (o) { return o.status !== 'retirado'; }).length,
      waiting: s.orders.filter(function (o) { return o.status === 'aguardando'; }).length };
  }

  var NAMES = ['Beatriz', 'Thiago', 'Isabela', 'Lucas', 'Mariana', 'Felipe', 'Aline', 'Vinícius', 'Renata', 'Caio'];

  F.store = {
    KEY: KEY,
    get: function () { return state; },
    subscribe: function (fn) { listeners.add(fn); return function () { listeners.delete(fn); }; },
    stats: function () { return stats(state); },
    item: function (id) { return state.menu.filter(function (i) { return i.id === id; })[0]; },
    order: function (number) { return state.orders.filter(function (o) { return o.number === Number(number); })[0]; },

    /** Cria pedido (status inicial: aguardando pagamento no balcão). lines: [{id, qty}] */
    createOrder: function (customer, lines, via, mine) {
      return mutate(function (s) {
        var its = [];
        lines.forEach(function (l) {
          var m = s.menu.filter(function (i) { return i.id === l.id; })[0];
          if (m && m.available && l.qty > 0) its.push({ id: m.id, name: m.name, price: m.price, qty: l.qty });
        });
        if (!its.length) return null;
        var now = Date.now();
        var o = { number: s.nextNumber++, customer: customer, mine: !!mine, items: its,
          total: its.reduce(function (a, i) { return a + i.price * i.qty; }, 0),
          status: 'aguardando', history: { aguardando: now }, createdAt: now, via: via || 'app' };
        s.orders.push(o);
        logAuto(s, 'Novo pedido → Avisar cantina', 'Webhook · pedido criado ' + F.fmt.num(o.number),
          'Exibir card em "Aguardando pagamento" + alerta no painel', customer + ' · ' + F.fmt.brl(o.total) + (via === 'ia' ? ' · via assistente' : ''));
        return o;
      });
    },

    /** Avança o status do pedido (aguardando → preparo → pronto → retirado). */
    advance: function (number) {
      return mutate(function (s) {
        var o = s.orders.filter(function (x) { return x.number === Number(number); })[0];
        if (!o) return null;
        var idx = F.STATUS_FLOW.indexOf(o.status);
        if (idx < 0 || idx >= F.STATUS_FLOW.length - 1) return o;
        o.status = F.STATUS_FLOW[idx + 1];
        o.history[o.status] = Date.now();
        var num = F.fmt.num(o.number);
        if (o.status === 'preparo') logAuto(s, 'Pagamento confirmado → Iniciar preparo', 'Status = Em preparo · ' + num, 'Atualizar ticket do aluno e enviar pedido à chapa', o.customer);
        if (o.status === 'pronto') {
          logAuto(s, 'Pedido pronto → Notificar aluno', 'Status = Pronto · ' + num, 'Enviar notificação in-app para ' + o.customer, 'Seu pedido ' + num + ' está pronto para retirada!');
          s.notifications.unshift({ id: F.uid(), to: o.customer, number: o.number, at: Date.now(), title: 'Pedido ' + num + ' pronto!', text: 'Retire no balcão da Cantina FAESA — Bloco B.' });
          s.notifications = s.notifications.slice(0, 30);
        }
        if (o.status === 'retirado') logAuto(s, 'Retirada confirmada → Encerrar ticket', 'Status = Retirado · ' + num, 'Invalidar QR do ticket e registrar venda', o.customer);
        return o;
      });
    },

    setAvailability: function (id, v) { mutate(function (s) { var m = s.menu.filter(function (i) { return i.id === id; })[0]; if (m) m.available = !!v; }); },
    setPrice: function (id, price) { mutate(function (s) { var m = s.menu.filter(function (i) { return i.id === id; })[0]; if (m && price >= 0) m.price = Math.round(price * 100) / 100; }); },
    addMenuItem: function (it) {
      return mutate(function (s) {
        var id = F.norm(it.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || F.uid();
        while (s.menu.some(function (m) { return m.id === id; })) id += '-2';
        var m = { id: id, name: it.name, cat: it.cat, price: it.price, desc: it.desc || '', tags: it.tags || [], available: true };
        s.menu.push(m); return m;
      });
    },

    /** Simula um pedido de outro aluno (gera 1–3 itens aleatórios disponíveis). */
    simulateOrder: function () {
      var avail = state.menu.filter(function (i) { return i.available; });
      var n = 1 + Math.floor(Math.random() * 3), lines = [];
      for (var k = 0; k < n; k++) { var it = avail[Math.floor(Math.random() * avail.length)]; if (!lines.some(function (l) { return l.id === it.id; })) lines.push({ id: it.id, qty: 1 + (Math.random() < .25 ? 1 : 0) }); }
      return F.store.createOrder(NAMES[Math.floor(Math.random() * NAMES.length)], lines, 'sim', false);
    },

    /** Dispara o relatório de vendas (simula o workflow do n8n). */
    fireReport: function (trigger) {
      return mutate(function (s) {
        var st = stats(s);
        var rep = { id: F.uid(), at: Date.now(), orders: st.orders, revenue: st.revenue, avg: st.avg, top: st.top.slice(0, 3), trigger: trigger || 'manual' };
        s.reports.unshift(rep); s.reports = s.reports.slice(0, 10);
        logAuto(s, 'Relatório de vendas (' + (trigger === 'cron' ? 'agendado' : 'manual') + ')',
          trigger === 'cron' ? 'Cron · a cada 2 h (demo: 2 min)' : 'Botão "Disparar relatório agora"',
          'Consolidar vendas do dia e publicar na aba Relatório', st.orders + ' pedidos · ' + F.fmt.brl(st.revenue) + ' · ticket médio ' + F.fmt.brl(st.avg));
        return rep;
      });
    },

    reset: function () { state = F.seed.create(); state.rev = (state.rev || 0) + 1; save(); emit(); }
  };
})();
