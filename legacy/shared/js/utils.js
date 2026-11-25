/* Utilitários: formatação, normalização de texto e construtor de DOM (h). */
(function () {
  var F = (window.FAESA = window.FAESA || {});

  F.fmt = {
    brl: function (n) { return 'R$ ' + Number(n).toFixed(2).replace('.', ','); },
    num: function (n) { return '#' + String(n).padStart(4, '0'); },
    time: function (ts) { return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); },
    ago: function (ts) {
      var m = Math.floor((Date.now() - ts) / 60000);
      if (m < 1) return 'agora';
      if (m < 60) return 'há ' + m + ' min';
      var h = Math.floor(m / 60);
      return 'há ' + h + ' h';
    },
    mins: function (ts) { return Math.floor((Date.now() - ts) / 60000); }
  };

  /** minúsculas sem acentos */
  F.norm = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };

  /** Construtor de DOM. h('div', {class:'x', onclick:fn, aria:{label:'..'}}, filhos...) */
  F.h = function (tag, props) {
    var el = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'data') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (k === 'aria') Object.keys(v).forEach(function (a) { el.setAttribute('aria-' + a, v[a]); });
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(children);
    return el;
  };

  F.uid = function () { return Math.random().toString(36).slice(2, 9); };

  /** FLIP: anima elementos [data-flip] que mudaram de lugar após uma renderização. */
  F.flip = function (container, renderFn) {
    var before = {};
    container.querySelectorAll('[data-flip]').forEach(function (n) { before[n.dataset.flip] = n.getBoundingClientRect(); });
    renderFn();
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    container.querySelectorAll('[data-flip]').forEach(function (n) {
      var b = before[n.dataset.flip];
      var a = n.getBoundingClientRect();
      if (!b) { n.classList.add('pop-in'); return; }
      var dx = b.left - a.left, dy = b.top - a.top;
      if (!dx && !dy) return;
      n.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
        { duration: 300, easing: 'cubic-bezier(.23,1,.32,1)' });
    });
  };
})();

/* Logo oficial (PNG transparente em assets/logo-faesa.png). Se o arquivo faltar, cai no wordmark provisório.
   opts: { height, plate: true para fundo branco arredondado (uso sobre o azul), src } */
(function () {
  var F = window.FAESA;
  F.IMG_BASE = '../assets/img/';
  F.logo = function (opts) {
    opts = opts || {};
    var h = opts.height || 26;
    var img = F.h('img', { src: opts.src || '../assets/logo-faesa.png', alt: 'FAESA', height: String(h), class: 'logo-img', style: { height: h + 'px', width: 'auto' } });
    img.addEventListener('error', function () { if (img.parentNode) img.replaceWith(F.wordmark({ height: h })); });
    if (!opts.plate) return img;
    return F.h('span', { class: 'logo-plate' }, img);
  };
})();

/* Proteção global: replaceChildren/append/prepend ignoram null/undefined/false (evita o texto "null" na tela). */
(function () {
  if (typeof Element === 'undefined') return;
  ['replaceChildren', 'append', 'prepend'].forEach(function (m) {
    var orig = Element.prototype[m];
    Element.prototype[m] = function () {
      var args = Array.prototype.filter.call(arguments, function (a) { return a != null && a !== false; });
      return orig.apply(this, args);
    };
  });
})();
