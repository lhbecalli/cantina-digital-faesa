/* Views do painel da cantina: Pedidos (kanban), Cardápio (gestão), Relatório (vendas + automações n8n simuladas). */
(function () {
  var F = (window.FAESA = window.FAESA || {});
  var h = F.h, icon = F.icon, fmt = F.fmt;
  var V = (F.kviews = {});

  /* ---------------- Pedidos ---------------- */
  var COLS = [
    { id: 'aguardando', title: 'Aguardando pagamento', icon: 'credit-card', btn: 'Confirmar pagamento', cls: 'btn-ok', limit: 10 },
    { id: 'preparo', title: 'Em preparo', icon: 'chef-hat', btn: 'Marcar como pronto', cls: 'btn-primary', limit: 12 },
    { id: 'pronto', title: 'Pronto', icon: 'package-check', btn: 'Confirmar retirada', cls: 'btn-ok', limit: 6 }
  ];
  var activeCol = 'aguardando';
  var VIA = { app: 'App', ia: 'IA', sim: 'Aluno' };

  V.pedidos = function (ctx) {
    var root = h('div', { class: 'page' });
    var counter = h('p', { class: 'counter', 'aria-live': 'polite' });
    var board = h('div', { class: 'board' });
    var seg = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Colunas do kanban' });

    function card(o, col) {
      var since = o.history[o.status] || o.createdAt, mins = fmt.mins(since), late = mins >= col.limit;
      return h('li', { class: 'kcard' + (late ? ' late' : ''), 'data-flip': String(o.number) },
        h('div', { class: 'k-top' }, h('b', { class: 'k-num' }, fmt.num(o.number)), h('span', { class: 'k-time' + (late ? ' late-text' : '') }, icon('clock', { size: 14 }), fmt.ago(since) + (late ? ' · atrasado' : ''))),
        h('p', { class: 'k-who' }, o.customer, h('span', { class: 'k-via' }, ' · ' + (VIA[o.via] || 'App'))),
        h('ul', { class: 'k-items k-sec' }, o.items.map(function (i) { return h('li', null, F.photo(F.store.item(i.id) || { id: i.id, cat: 'lanches' }, 'xs'), h('span', { class: 'k-qty' }, i.qty + 'x'), h('span', { class: 'k-name' }, i.name)); })),
        h('div', { class: 'k-sec k-foot' }, h('span', { class: 'k-total-l' }, 'Total'), h('b', { class: 'k-total' }, fmt.brl(o.total))),
        h('button', { class: 'btn btn-block ' + col.cls, type: 'button', onclick: function () {
          F.store.advance(o.number);
          if (col.id === 'aguardando') F.toast('Pagamento confirmado', fmt.num(o.number) + ' foi para o preparo.', { type: 'ok', icon: 'circle-check' });
        } }, icon(col.id === 'aguardando' ? 'banknote' : col.id === 'preparo' ? 'package-check' : 'circle-check', { size: 18 }), col.btn));
    }

    function draw() {
      var s = F.store.get(), st = F.store.stats();
      var inprog = s.orders.filter(function (o) { return o.status !== 'retirado'; });
      var waiting = inprog.filter(function (o) { return o.status === 'aguardando'; }).length;
      counter.textContent = inprog.length + ' em andamento · ' + waiting + ' aguardando';
      var done = s.orders.filter(function (o) { return o.status === 'retirado' && new Date(o.createdAt).toDateString() === new Date().toDateString(); }).length;
      seg.replaceChildren.apply(seg, COLS.map(function (c) {
        var n = inprog.filter(function (o) { return o.status === c.id; }).length;
        return h('button', { type: 'button', role: 'tab', class: 'seg-btn', 'aria-selected': String(activeCol === c.id), onclick: function () { activeCol = c.id; draw(); } }, c.title.replace('Aguardando pagamento', 'Aguardando'), h('span', { class: 'count' }, String(n)));
      }));
      F.flip(board, function () {
        board.replaceChildren.apply(board, COLS.map(function (c) {
          var list = inprog.filter(function (o) { return o.status === c.id; }).sort(function (a, b) { return a.createdAt - b.createdAt; });
          return h('section', { class: 'col' + (activeCol === c.id ? ' active' : ''), 'aria-label': c.title },
            h('header', null, icon(c.icon, { size: 18 }), h('h2', null, c.title), h('span', { class: 'count' }, String(list.length))),
            list.length ? h('ul', { class: 'k-list' }, list.map(function (o) { return card(o, c); })) : h('div', { class: 'k-empty' }, 'Nenhum pedido aqui.'));
        }).concat([h('p', { class: 'done-line' }, icon('circle-check', { size: 14 }), 'Retirados hoje: ' + done)]));
      });
    }

    root.append(h('div', { class: 'toolbar' }, counter,
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: function () {
        var o = F.store.simulateOrder(); if (o) F.toast('Novo pedido ' + fmt.num(o.number), o.customer + ' · ' + fmt.brl(o.total), { type: 'info', icon: 'receipt' });
      } }, icon('users'), 'Receber pedido de aluno')), seg, board);
    draw(); ctx.onState(draw); ctx.onTick(draw, 30000);
    return root;
  };

  /* ---------------- Cardápio ---------------- */
  function openItemForm() {
    F.sheet('Adicionar item', function (body, api) {
      var name = h('input', { class: 'input', required: true, maxlength: '40', id: 'f-name', autocomplete: 'off' });
      var cat = h('select', { class: 'input', id: 'f-cat' }, F.CATEGORIES.map(function (c) { return h('option', { value: c.id }, c.name); }));
      var price = h('input', { class: 'input', type: 'number', min: '0', step: '0.5', required: true, id: 'f-price', inputmode: 'decimal' });
      var desc = h('input', { class: 'input', maxlength: '90', id: 'f-desc' });
      var sem = h('input', { type: 'checkbox', id: 'f-sem' }), veg = h('input', { type: 'checkbox', id: 'f-veg' });
      body.appendChild(h('form', { class: 'form', onsubmit: function (e) {
        e.preventDefault();
        var p = parseFloat(String(price.value).replace(',', '.'));
        if (!name.value.trim() || isNaN(p) || p < 0) return;
        var tags = []; if (sem.checked) tags.push('sem-acucar'); if (veg.checked) tags.push('vegetariano');
        F.store.addMenuItem({ name: name.value.trim(), cat: cat.value, price: p, desc: desc.value.trim(), tags: tags });
        api.close(); F.toast('Item adicionado', name.value.trim() + ' já está no cardápio dos alunos.', { type: 'ok', icon: 'check' });
      } },
        h('label', { class: 'field', for: 'f-name' }, 'Nome', name), h('label', { class: 'field', for: 'f-cat' }, 'Categoria', cat),
        h('label', { class: 'field', for: 'f-price' }, 'Preço (R$)', price), h('label', { class: 'field', for: 'f-desc' }, 'Descrição', desc),
        h('label', { class: 'check' }, sem, 'Sem açúcar'), h('label', { class: 'check' }, veg, 'Vegetariano'),
        h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, icon('plus'), 'Adicionar ao cardápio')));
      setTimeout(function () { name.focus(); }, 380);
    });
  }

  V.cardapio = function (ctx) {
    var root = h('div', { class: 'page' }), listEl = h('div', { class: 'mgr' });
    function draw() {
      var menu = F.store.get().menu;
      listEl.replaceChildren.apply(listEl, F.CATEGORIES.map(function (c) {
        var items = menu.filter(function (i) { return i.cat === c.id; });
        if (!items.length) return null;
        return h('section', { class: 'mgr-cat' }, h('h2', null, icon(c.icon, { size: 18 }), c.name),
          h('ul', null, items.map(function (i) {
            var pr = h('input', { class: 'input price', type: 'number', min: '0', step: '0.5', value: i.price.toFixed(2), 'aria-label': 'Preço de ' + i.name + ' em reais', inputmode: 'decimal',
              onchange: function (e) { var v = parseFloat(e.target.value); if (isNaN(v) || v < 0) { e.target.value = i.price.toFixed(2); return; } F.store.setPrice(i.id, v); F.toast('Preço atualizado', i.name + ' agora custa ' + fmt.brl(v), { type: 'ok', icon: 'pencil', ms: 2500 }); } });
            return h('li', { class: 'mgr-row' + (i.available ? '' : ' off') }, F.photo(i, 'sm'),
              h('div', { class: 'mgr-name' }, h('b', null, i.name), h('small', null, i.available ? 'Disponível' : 'Indisponível para os alunos')),
              pr, h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(i.available), 'aria-label': 'Disponibilidade de ' + i.name,
                onclick: function () { F.store.setAvailability(i.id, !i.available); } }));
          })));
      }));
    }
    root.append(h('div', { class: 'toolbar' }, h('p', { class: 'counter' }, 'Gerencie o que os alunos veem agora.'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: openItemForm }, icon('plus'), 'Adicionar item')), listEl);
    draw();
    ctx.onState(function () { var a = document.activeElement; if (a && a.tagName === 'INPUT' && listEl.contains(a)) return; draw(); });
    return root;
  };

  /* ---------------- Relatório ---------------- */
  function chart(series) {
    var W = 420, H = 170, pad = 26, max = Math.max.apply(null, series.map(function (p) { return p.value; }).concat([1]));
    var bw = (W - pad * 2) / Math.max(series.length, 1), nowH = new Date().getHours();
    var bars = series.map(function (p, i) {
      var bh = Math.round((p.value / max) * (H - 56)), x = pad + i * bw + bw * 0.15, y = H - 26 - bh;
      return '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + (bw * 0.7).toFixed(1) + '" height="' + bh + '" rx="6" fill="' + (p.hour === nowH ? '#D26A00' : '#1F5FC4') + '"/>' +
        '<text x="' + (x + bw * 0.35).toFixed(1) + '" y="' + (y - 5) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#0B3A7A">' + Math.round(p.value) + '</text>' +
        '<text x="' + (x + bw * 0.35).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="#485364">' + p.hour + 'h</text>';
    }).join('');
    var t = document.createElement('template');
    t.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Vendas por hora, em reais. ' + series.map(function (p) { return p.hour + ' horas: ' + Math.round(p.value) + ' reais'; }).join('; ') + '">' +
      '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + (H - 26) + '" y2="' + (H - 26) + '" stroke="#B8C5D6"/>' + bars + '</svg>';
    return t.content.firstChild;
  }

  V.nextReportAt = Date.now() + 120000;

  V.relatorio = function (ctx) {
    var root = h('div', { class: 'page' }), countdown = h('small', { class: 'countdown' });
    function tick() { var s = Math.max(0, Math.round((V.nextReportAt - Date.now()) / 1000)); countdown.textContent = 'Próximo relatório automático em ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function draw() {
      var s = F.store.get(), st = F.store.stats(), maxTop = st.top.length ? st.top[0].qty : 1, rep = s.reports[0];
      function kpi(label, val, ic) { return h('div', { class: 'kpi' }, icon(ic, { size: 20 }), h('small', null, label), h('b', null, val)); }
      root.replaceChildren(
        h('div', { class: 'kpis' }, kpi('Vendas do dia', fmt.brl(st.revenue), 'banknote'), kpi('Pedidos pagos', String(st.orders), 'receipt'), kpi('Ticket médio', fmt.brl(st.avg), 'trending-up'), kpi('Em aberto', String(st.open), 'clock')),
        h('div', { class: 'rep-grid' },
          h('section', { class: 'panel' }, h('h2', null, 'Vendas por hora (R$)'), st.series.length ? chart(st.series) : h('p', { class: 'muted' }, 'Sem vendas ainda hoje.')),
          h('section', { class: 'panel' }, h('h2', null, 'Itens mais vendidos'),
            st.top.length ? h('ul', { class: 'top' }, st.top.map(function (t, i) {
              return h('li', null, h('span', { class: 'rank' }, String(i + 1)), h('div', { class: 'top-body' }, h('div', { class: 'top-line' }, h('b', null, t.name), h('span', null, t.qty + ' un.')),
                h('div', { class: 'bar' }, h('i', { style: { width: Math.round(t.qty / maxTop * 100) + '%' } }))));
            })) : h('p', { class: 'muted' }, 'Sem itens vendidos ainda.'))),
        h('section', { class: 'panel' },
          h('div', { class: 'panel-head' }, h('div', null, h('h2', null, icon('workflow', { size: 18 }), 'Automações'), countdown),
            h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { var r = F.store.fireReport('manual'); V.nextReportAt = Date.now() + 120000; F.toast('Relatório disparado', r.orders + ' pedidos · ' + fmt.brl(r.revenue), { type: 'ok', icon: 'zap' }); } }, icon('zap'), 'Disparar relatório agora')),
          rep ? h('div', { class: 'last-report' }, h('b', null, 'Último relatório · ' + fmt.time(rep.at)), h('p', null, rep.orders + ' pedidos, ' + fmt.brl(rep.revenue) + ' em vendas, ticket médio ' + fmt.brl(rep.avg) + '. Destaques: ' + (rep.top.map(function (t) { return t.name + ' (' + t.qty + ')'; }).join(', ') || '—') + '.')) : '',
          h('h3', null, 'Fluxos ativos'), h('ul', { class: 'wf-list' }, [['Novo pedido → Avisar cantina', 'Webhook'], ['Pedido pronto → Notificar aluno', 'Mudança de status'], ['Relatório de vendas', 'Cron']].map(function (w) {
            return h('li', null, h('b', null, w[0]), h('small', null, 'ativo · ' + w[1]));
          })),
          h('h3', null, 'Histórico'), h('ol', { class: 'log', 'aria-label': 'Log de automações' }, s.log.slice(0, 14).map(function (l) {
            return h('li', null, h('time', null, fmt.time(l.at)), h('div', null, h('b', null, l.workflow), h('p', null, h('span', null, 'Gatilho: '), l.trigger), h('p', null, h('span', null, 'Ação: '), l.action), l.detail ? h('small', null, l.detail) : null));
          }))));
      tick();
    }
    draw(); ctx.onState(draw); ctx.onTick(tick, 1000);
    return root;
  };
})();
