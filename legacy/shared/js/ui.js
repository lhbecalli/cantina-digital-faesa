/* UI compartilhada: toasts, bottom sheet (portal), roteador por hash. */
(function () {
  var F = (window.FAESA = window.FAESA || {});
  var h = F.h;

  /* ---------- Toasts ---------- */
  var stack;
  F.toast = function (title, text, opts) {
    opts = opts || {};
    if (!stack) { stack = h('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(stack); }
    var el = h('div', { class: 'toast ' + (opts.type || 'info') }, F.icon(opts.icon || 'bell', { size: 22 }),
      h('div', null, h('b', null, title), text ? h('span', null, text) : null));
    stack.appendChild(el);
    var gone = false;
    function close() { if (gone) return; gone = true; el.classList.add('leaving'); setTimeout(function () { el.remove(); }, 220); }
    el.addEventListener('click', close);
    setTimeout(close, opts.ms || 4500);
  };

  /* ---------- Bottom sheet ---------- */
  F.sheet = function (title, build, opts) {
    opts = opts || {};
    var prevFocus = document.activeElement;
    var closed = false;
    var body = h('div', { class: 'sheet-body' });
    var closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Fechar', style: { color: 'var(--blue-900)' } }, F.icon('x'));
    var sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-grip' }),
      h('div', { class: 'sheet-head' }, h('h2', null, title), closeBtn), body);
    var backdrop = h('div', { class: 'sheet-backdrop' });
    var root = h('div', { class: 'sheet-root' }, backdrop, sheet);
    var api = {
      body: body, root: root,
      close: function () {
        if (closed) return; closed = true;
        root.classList.remove('open');
        document.removeEventListener('keydown', onKey);
        setTimeout(function () { root.remove(); }, 340);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* noop */ }
        if (opts.onClose) opts.onClose();
      }
    };
    function onKey(e) {
      if (e.key === 'Escape') api.close();
      if (e.key === 'Tab') { // foco preso dentro do sheet
        var f = sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    closeBtn.addEventListener('click', api.close);
    backdrop.addEventListener('click', api.close);
    document.addEventListener('keydown', onKey);
    build(body, api);
    document.body.appendChild(root);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('open'); closeBtn.focus(); }); });
    return api;
  };

  /* ---------- Roteador por hash ---------- */
  // routes: [{ path:'/pedidos/:num', view:function(ctx){ return Node }, title:'..', tab:'pedidos' }]
  F.router = function (cfg) {
    var current = null, cleanups = [], prevPath = '';
    function match(path) {
      for (var i = 0; i < cfg.routes.length; i++) {
        var r = cfg.routes[i], rp = r.path.split('/'), pp = path.split('/');
        if (rp.length !== pp.length) continue;
        var params = {}, ok = true;
        for (var k = 0; k < rp.length; k++) {
          if (rp[k][0] === ':') params[rp[k].slice(1)] = decodeURIComponent(pp[k]);
          else if (rp[k] !== pp[k]) { ok = false; break; }
        }
        if (ok) return { route: r, params: params };
      }
      return null;
    }
    function render() {
      var path = (location.hash.replace(/^#/, '') || cfg.fallback).replace(/\/$/, '') || cfg.fallback;
      var m = match(path) || match(cfg.fallback);
      cleanups.forEach(function (fn) { fn(); }); cleanups = [];
      var ctx = {
        params: m.params, path: path,
        onState: function (fn) { cleanups.push(F.store.subscribe(fn)); },
        onTick: function (fn, ms) { var t = setInterval(fn, ms); cleanups.push(function () { clearInterval(t); }); },
        onCleanup: function (fn) { cleanups.push(fn); },
        go: function (p) { location.hash = '#' + p; }
      };
      var depth = path.split('/').length, prevDepth = prevPath ? prevPath.split('/').length : depth;
      var node = m.route.view(ctx);
      node.classList.add('view-enter');
      if (prevPath && depth > prevDepth) node.classList.add('v-fwd'); else if (prevPath && depth < prevDepth) node.classList.add('v-back');
      cfg.outlet.replaceChildren(node);
      cfg.outlet.scrollTop = 0; window.scrollTo(0, 0);
      document.title = (m.route.title ? m.route.title + ' · ' : '') + cfg.appName;
      prevPath = path; current = m;
      if (cfg.onChange) cfg.onChange(m.route, m.params, path);
    }
    window.addEventListener('hashchange', render);
    return { start: render, refresh: render, current: function () { return current; } };
  };
})();

/* Foto do item: proporção 4:3 fixa, recorte cover, fundo neutro enquanto carrega, lazy.
   size: 'xs' | 'sm' | 'md'. Sem foto (item novo) ou erro de carga: ícone da categoria. */
(function () {
  var F = window.FAESA, h = F.h;
  F.photo = function (item, size) {
    var wrap = h('span', { class: 'ph ph-' + (size || 'md') });
    var cat = F.CATEGORIES.filter(function (c) { return c.id === item.cat; })[0];
    function fallback() { wrap.classList.add('noimg'); wrap.appendChild(F.icon(cat ? cat.icon : 'utensils', { size: size === 'xs' ? 16 : size === 'lg' ? 32 : 22 })); }
    var file = F.PHOTOS && F.PHOTOS[item.id];
    if (!file) { fallback(); return wrap; }
    var img = h('img', { src: F.IMG_BASE + file + '.jpg', alt: '', loading: 'lazy', decoding: 'async', width: '480', height: '480' });
    img.addEventListener('load', function () { wrap.classList.add('loaded'); });
    img.addEventListener('error', function () { img.remove(); fallback(); });
    wrap.appendChild(img);
    if (img.complete && img.naturalWidth) wrap.classList.add('loaded');
    return wrap;
  };
})();
