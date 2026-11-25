/* Ícones Lucide (https://lucide.dev, licença ISC) embutidos inline — sem CDN.
   Cada entrada é o conteúdo interno do <svg viewBox="0 0 24 24">. */
(function () {
  var F = (window.FAESA = window.FAESA || {});
  var C = function (cx, cy, r) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>'; };
  var P = function (d) { return '<path d="' + d + '"/>'; };
  var R = function (a) { return '<rect ' + a + '/>'; };
  var L = function (x1, y1, x2, y2) { return '<line x1="' + x1 + '" x2="' + x2 + '" y1="' + y1 + '" y2="' + y2 + '"/>'; };

  var ICONS = {
    'shopping-cart': C(8, 21, 1) + C(19, 21, 1) + P('M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'),
    'shopping-bag': P('M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z') + P('M3 6h18') + P('M16 10a4 4 0 0 1-8 0'),
    'search': C(11, 11, 8) + P('m21 21-4.3-4.3'),
    'plus': P('M5 12h14') + P('M12 5v14'),
    'minus': P('M5 12h14'),
    'x': P('M18 6 6 18') + P('m6 6 12 12'),
    'check': P('M20 6 9 17l-5-5'),
    'chevron-right': P('m9 18 6-6-6-6'),
    'chevron-left': P('m15 18-6-6 6-6'),
    'chevron-down': P('m6 9 6 6 6-6'),
    'arrow-left': P('m12 19-7-7 7-7') + P('M19 12H5'),
    'arrow-right': P('M5 12h14') + P('m12 5 7 7-7 7'),
    'utensils': P('M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2') + P('M7 2v20') + P('M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'),
    'clipboard-list': R('width="8" height="4" x="8" y="2" rx="1" ry="1"') + P('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2') + P('M12 11h4') + P('M12 16h4') + P('M8 11h.01') + P('M8 16h.01'),
    'bot': P('M12 8V4H8') + R('width="16" height="12" x="4" y="8" rx="2"') + P('M2 14h2') + P('M20 14h2') + P('M15 13v2') + P('M9 13v2'),
    'user': P('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2') + C(12, 7, 4),
    'bell': P('M10.268 21a2 2 0 0 0 3.464 0') + P('M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'),
    'send': P('M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z') + P('m21.854 2.147-10.94 10.939'),
    'clock': C(12, 12, 10) + P('M12 6v6l4 2'),
    'chef-hat': P('M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z') + P('M6 17h12'),
    'package-check': P('m16 16 2 2 4-4') + P('M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14') + P('M16.5 9.4 7.55 4.24') + P('M3.29 7 12 12l8.71-5') + P('M12 22V12'),
    'circle-check': C(12, 12, 10) + P('m9 12 2 2 4-4'),
    'circle-alert': C(12, 12, 10) + P('M12 8v4') + P('M12 16h.01'),
    'credit-card': R('width="20" height="14" x="2" y="5" rx="2"') + L(2, 10, 22, 10),
    'banknote': R('width="20" height="12" x="2" y="6" rx="2"') + C(12, 12, 2) + P('M6 12h.01M18 12h.01'),
    'sparkles': P('M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z') + P('M20 3v4') + P('M22 5h-4') + P('M4 17v2') + P('M5 18H3'),
    'leaf': P('M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z') + P('M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'),
    'ban': C(12, 12, 10) + P('m4.9 4.9 14.2 14.2'),
    'coffee': P('M10 2v2') + P('M14 2v2') + P('M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1') + P('M6 2v2'),
    'glass-water': P('M15.2 22H8.8a2 2 0 0 1-2-1.79L5 3h14l-1.81 17.21A2 2 0 0 1 15.2 22Z') + P('M6 12a5 5 0 0 1 6 0 5 5 0 0 1 6 0'),
    'cookie': P('M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5') + P('M8.5 8.5v.01') + P('M16 15.5v.01') + P('M12 12v.01') + P('M11 17v.01') + P('M7 14v.01'),
    'trending-up': P('M16 7h6v6') + P('m22 7-8.5 8.5-5-5L2 17'),
    'receipt': P('M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z') + P('M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8') + P('M12 17.5v-11'),
    'chart-column': P('M3 3v16a2 2 0 0 0 2 2h16') + P('M18 17V9') + P('M13 17V5') + P('M8 17v-3'),
    'zap': P('M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'),
    'workflow': R('width="8" height="8" x="3" y="3" rx="2"') + P('M7 11v4a2 2 0 0 0 2 2h4') + R('width="8" height="8" x="13" y="13" rx="2"'),
    'refresh-cw': P('M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8') + P('M21 3v5h-5') + P('M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16') + P('M8 16H3v5'),
    'history': P('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8') + P('M3 3v5h5') + P('M12 7v5l4 2'),
    'trash-2': P('M3 6h18') + P('M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6') + P('M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2') + L(10, 11, 10, 17) + L(14, 11, 14, 17),
    'pencil': P('M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z') + P('m15 5 4 4'),
    'qr-code': R('width="5" height="5" x="3" y="3" rx="1"') + R('width="5" height="5" x="16" y="3" rx="1"') + R('width="5" height="5" x="3" y="16" rx="1"') + P('M21 16h-3a2 2 0 0 0-2 2v3') + P('M21 21v.01') + P('M12 7v3a2 2 0 0 1-2 2H7') + P('M3 12h.01') + P('M12 3h.01') + P('M12 16v.01') + P('M16 12h1') + P('M21 12v.01') + P('M12 21v-1'),
    'store': P('m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7') + P('M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8') + P('M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4') + P('M2 7h20') + P('M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7'),
    'smartphone': R('width="14" height="20" x="5" y="2" rx="2" ry="2"') + P('M12 18h.01'),
    'inbox': P('M22 12h-6l-2 3h-4l-2-3H2') + P('M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'),
    'play': P('M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z'),
    'users': P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2') + C(9, 7, 4) + P('M22 21v-2a4 4 0 0 0-3-3.87') + P('M16 3.13a4 4 0 0 1 0 7.75'),
    'columns': R('width="18" height="18" x="3" y="3" rx="2"') + P('M12 3v18'),
    'external-link': P('M15 3h6v6') + P('M10 14 21 3') + P('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'),
    'log-out': P('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4') + P('m16 17 5-5-5-5') + P('M21 12H9')
  };

  F.icons = ICONS;
  /** Cria um elemento <svg> Lucide. opts: {size, cls, label} */
  F.icon = function (name, opts) {
    opts = opts || {};
    var body = ICONS[name];
    if (!body) { body = ICONS['circle-alert']; }
    var t = document.createElement('template');
    t.innerHTML = '<svg class="ic ' + (opts.cls || '') + '" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"' +
      (opts.size ? ' width="' + opts.size + '" height="' + opts.size + '" style="width:' + opts.size + 'px;height:' + opts.size + 'px"' : '') +
      (opts.label ? ' role="img" aria-label="' + opts.label + '"' : ' aria-hidden="true" focusable="false"') + '>' + body + '</svg>';
    return t.content.firstChild;
  };

  /** Wordmark provisório "FAESA" (não temos o arquivo do logo oficial). */
  F.wordmark = function (opts) {
    opts = opts || {};
    var light = !!opts.light;
    var a = light ? '#FFFFFF' : '#0B3A7A';
    var t = document.createElement('template');
    t.innerHTML = '<svg viewBox="0 0 120 32" height="' + (opts.height || 26) + '" role="img" aria-label="FAESA" xmlns="http://www.w3.org/2000/svg">' +
      '<polygon points="14,2 26,14 14,26 2,14" fill="' + (light ? '#7FB0FF' : '#1F5FC4') + '"/>' +
      '<polygon points="22,8 30,16 22,24 14,16" fill="' + (light ? '#0B2347' : '#111827') + '" opacity=".92"/>' +
      '<text x="36" y="23" font-family="Segoe UI, Noto Sans, Arial, sans-serif" font-size="21" font-weight="800" letter-spacing="1.5" fill="' + a + '">FAESA</text></svg>';
    return t.content.firstChild;
  };
})();
