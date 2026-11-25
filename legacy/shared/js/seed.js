/* Dados fictícios iniciais (seed). Preços coerentes com os slides:
   Misto Quente (11) + Suco de Laranja (6) = R$ 17,00 | Sanduíche Natural (14) + Suco (6) = R$ 20,00 | X-Burguer R$ 18,00 */
(function () {
  var F = (window.FAESA = window.FAESA || {});

  F.CATEGORIES = [
    { id: 'lanches', name: 'Lanches', icon: 'utensils' },
    { id: 'salgados', name: 'Salgados', icon: 'cookie' },
    { id: 'sucos', name: 'Sucos', icon: 'glass-water' },
    { id: 'bebidas', name: 'Bebidas', icon: 'coffee' },
    { id: 'doces', name: 'Doces', icon: 'cookie' }
  ];

  F.STATUS = {
    aguardando: { label: 'Aguardando pagamento', short: 'Aguardando', icon: 'credit-card', color: '#9A4A06' },
    preparo: { label: 'Em preparo', short: 'Em preparo', icon: 'chef-hat', color: '#1F5FC4' },
    pronto: { label: 'Pronto', short: 'Pronto', icon: 'package-check', color: '#1B7F40' },
    retirado: { label: 'Retirado', short: 'Retirado', icon: 'circle-check', color: '#485364' }
  };
  F.STATUS_FLOW = ['aguardando', 'preparo', 'pronto', 'retirado'];

  var MENU = [
    ['misto', 'Misto Quente', 'lanches', 11, 'Pão na chapa, queijo e presunto.', [], 1],
    ['natural', 'Sanduíche Natural', 'lanches', 14, 'Pão integral, peito de peru, ricota e cenoura. Sem açúcar adicionado.', ['sem-acucar'], 1],
    ['xburguer', 'X-Burguer', 'lanches', 18, 'Hambúrguer artesanal, queijo, alface e tomate.', [], 1],
    ['natural-veg', 'Natural Vegetariano', 'lanches', 13, 'Pão integral, ricota, cenoura e folhas. Sem açúcar adicionado.', ['sem-acucar', 'vegetariano'], 1],
    ['pao-queijo', 'Pão de Queijo', 'salgados', 5, 'Quentinho, saindo do forno.', ['vegetariano'], 1],
    ['coxinha', 'Coxinha de Frango', 'salgados', 7, 'Massa crocante e recheio cremoso.', [], 1],
    ['empada', 'Empada de Palmito', 'salgados', 7, 'Massa amanteigada com palmito.', ['vegetariano'], 1],
    ['suco-laranja', 'Suco de Laranja', 'sucos', 6, 'Natural, 300 ml, sem açúcar.', ['sem-acucar', 'vegetariano'], 1],
    ['suco-maracuja', 'Suco de Maracujá', 'sucos', 6, 'Polpa da fruta, adoçado, 300 ml.', ['vegetariano'], 1],
    ['suco-verde', 'Suco Verde', 'sucos', 7, 'Couve, limão e maçã. Sem açúcar.', ['sem-acucar', 'vegetariano'], 1],
    ['cafe', 'Café Expresso', 'bebidas', 4, 'Servido sem açúcar (adoçante à parte).', ['sem-acucar', 'vegetariano'], 1],
    ['cappuccino', 'Cappuccino', 'bebidas', 6, 'Cremoso, com chocolate em pó.', ['vegetariano'], 1],
    ['agua', 'Água Mineral', 'bebidas', 3, '500 ml.', ['sem-acucar', 'vegetariano'], 1],
    ['refri', 'Refrigerante Lata', 'bebidas', 6, '350 ml.', [], 1],
    ['salada-frutas', 'Salada de Frutas', 'doces', 7, 'Frutas da estação, sem açúcar adicionado.', ['sem-acucar', 'vegetariano'], 1],
    ['brownie', 'Brownie', 'doces', 8, 'Chocolate meio amargo.', ['vegetariano'], 1],
    ['cookie', 'Cookie de Aveia', 'doces', 6, 'Esgotado hoje.', ['vegetariano'], 0]
  ];

  function menu() {
    return MENU.map(function (m) {
      return { id: m[0], name: m[1], cat: m[2], price: m[3], desc: m[4], tags: m[5], available: !!m[6] };
    });
  }

  F.seed = {
    create: function () {
      var now = Date.now();
      var m = menu();
      var byId = {}; m.forEach(function (i) { byId[i.id] = i; });
      var dayStart = new Date(); dayStart.setHours(0, 0, 0, 0); dayStart = dayStart.getTime();
      function items(list) { return list.map(function (p) { var i = byId[p[0]]; return { id: i.id, name: i.name, price: i.price, qty: p[1] }; }); }
      function total(its) { return its.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }
      function mk(n, customer, list, status, minsAgo, via, mine) {
        var its = items(list);
        var created = Math.max(now - minsAgo * 60000, dayStart + 60000 * (n % 50 + 1));
        if (minsAgo > 600) created = now - minsAgo * 60000; // histórico de dias anteriores
        var hist = {}; var flow = F.STATUS_FLOW; var idx = flow.indexOf(status);
        for (var k = 0; k <= idx; k++) hist[flow[k]] = created + k * 3 * 60000;
        if (idx >= 1 && hist[status] > now) hist[status] = now;
        return { number: n, customer: customer, mine: !!mine, items: its, total: total(its), status: status, history: hist, createdAt: created, via: via || 'app' };
      }
      var orders = [
        // histórico do Luiz (dias anteriores) — base do "sugerir_combo"
        mk(25, 'Luiz', [['misto', 1], ['suco-laranja', 1]], 'retirado', 1620, 'app', true),
        mk(28, 'Luiz', [['natural', 1], ['suco-laranja', 1]], 'retirado', 1500, 'app', true),
        mk(34, 'Luiz', [['misto', 1], ['suco-laranja', 1]], 'retirado', 1450, 'app', true),
        // movimento de hoje (já retirados) — alimenta o relatório
        mk(30, 'Marina', [['xburguer', 1], ['refri', 1]], 'retirado', 280, 'app'),
        mk(31, 'Pedro', [['coxinha', 2], ['suco-maracuja', 1]], 'retirado', 250, 'app'),
        mk(32, 'Júlia', [['natural-veg', 1], ['suco-verde', 1]], 'retirado', 205, 'app'),
        mk(33, 'Rafael', [['misto', 1], ['cafe', 1]], 'retirado', 170, 'app'),
        mk(35, 'Camila', [['pao-queijo', 3], ['cappuccino', 1]], 'retirado', 140, 'app'),
        mk(36, 'Bruno', [['xburguer', 1], ['suco-laranja', 1]], 'retirado', 100, 'app'),
        mk(37, 'Larissa', [['natural', 1], ['suco-laranja', 1]], 'retirado', 70, 'app'),
        mk(38, 'Diego', [['misto', 2], ['refri', 2]], 'retirado', 45, 'app'),
        mk(39, 'Fernanda', [['empada', 1], ['cafe', 1]], 'retirado', 30, 'app'),
        mk(40, 'Gabriel', [['brownie', 1], ['cappuccino', 1]], 'retirado', 22, 'app'),
        // pedidos do enunciado (slides)
        mk(41, 'Ana', [['misto', 1], ['suco-laranja', 1]], 'preparo', 9, 'app'),
        mk(42, 'Luiz', [['misto', 1], ['suco-laranja', 1]], 'aguardando', 3, 'app', true),
        mk(43, 'Carlos', [['xburguer', 1]], 'pronto', 14, 'app')
      ];
      return {
        v: 1, rev: 1, nextNumber: 44, menu: m, orders: orders,
        notifications: [], reports: [],
        log: [
          { id: 'seed1', at: now - 40 * 60000, workflow: 'Relatório de vendas (agendado)', trigger: 'Cron · a cada 2 h', action: 'Gerar resumo e publicar na aba Relatório', detail: '9 pedidos · R$ 128,00' }
        ]
      };
    }
  };
})();

/* Foto de cada item do cardápio (assets/img/<arquivo>.jpg). Itens novos, sem foto, usam o ícone da categoria. Créditos: assets/CREDITS.md */
window.FAESA.PHOTOS = {
  'misto': 'misto', 'natural': 'natural', 'xburguer': 'xburguer', 'natural-veg': 'natural-veg', 'pao-queijo': 'pao-queijo',
  'coxinha': 'coxinha', 'empada': 'empada', 'suco-laranja': 'suco-laranja', 'suco-maracuja': 'suco-maracuja', 'suco-verde': 'suco-verde',
  'cafe': 'cafe', 'cappuccino': 'cappuccino', 'agua': 'agua', 'refri': 'refri', 'salada-frutas': 'salada-frutas', 'brownie': 'brownie', 'cookie': 'cookie'
};
