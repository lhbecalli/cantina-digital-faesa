/* Carrinho do aluno (local ao app; persiste em localStorage para sobreviver a recarregar a página). */
(function () {
  var F = (window.FAESA = window.FAESA || {});
  var KEY = 'faesa.cart.v1';
  var subs = new Set();
  var data = { lines: [], viaIA: false };
  try { var raw = localStorage.getItem(KEY); if (raw) data = JSON.parse(raw); } catch (e) { /* ok */ }

  function commit() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ok */ } subs.forEach(function (f) { f(); }); }
  function line(id) { return data.lines.filter(function (l) { return l.id === id; })[0]; }

  F.cart = {
    subscribe: function (fn) { subs.add(fn); return function () { subs.delete(fn); }; },
    add: function (id, qty, viaIA) {
      var l = line(id); qty = qty || 1;
      if (l) l.qty = Math.min(20, l.qty + qty); else data.lines.push({ id: id, qty: qty });
      if (viaIA) data.viaIA = true;
      commit();
    },
    setQty: function (id, qty) {
      if (qty <= 0) data.lines = data.lines.filter(function (l) { return l.id !== id; });
      else { var l = line(id); if (l) l.qty = Math.min(20, qty); }
      if (!data.lines.length) data.viaIA = false;
      commit();
    },
    remove: function (id) { F.cart.setQty(id, 0); },
    clear: function () { data = { lines: [], viaIA: false }; commit(); },
    qty: function (id) { var l = line(id); return l ? l.qty : 0; },
    /** linhas com dados do cardápio atual (descarta itens removidos/indisponíveis) */
    lines: function () {
      return data.lines.map(function (l) { var m = F.store.item(l.id); return m ? { id: l.id, qty: l.qty, item: m } : null; }).filter(Boolean);
    },
    count: function () { return F.cart.lines().reduce(function (a, l) { return a + l.qty; }, 0); },
    total: function () { return F.cart.lines().reduce(function (a, l) { return a + l.qty * l.item.price; }, 0); },
    viaIA: function () { return data.viaIA; }
  };
})();
