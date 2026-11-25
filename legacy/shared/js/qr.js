/* Gerador de QR Code em JS puro: modo byte, correção L, versões 1–6 (até 134 bytes), máscara 0 fixa.
   Implementação do padrão ISO 18004 simplificada para o protótipo. Retorna uma matriz booleana. */
(function () {
  var F = (window.FAESA = window.FAESA || {});
  var EXP = new Array(512), LOG = new Array(256), x = 1, i;
  for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function gen(n) {
    var g = [1];
    for (var k = 0; k < n; k++) { var ng = new Array(g.length + 1).fill(0); for (var j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[k]); } g = ng; }
    return g;
  }
  function rem(data, n) {
    var g = gen(n), r = new Array(n).fill(0);
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); for (var k = 0; k < n; k++) r[k] ^= mul(g[k + 1], f); });
    return r;
  }
  // versão: [codewords totais, ecc por bloco, nº de blocos]
  var VER = [null, [26, 7, 1], [44, 10, 1], [70, 15, 1], [100, 20, 1], [134, 26, 1], [172, 18, 2]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
  function dataCw(v) { return VER[v][0] - VER[v][1] * VER[v][2]; }

  function encode(text) {
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(text));
    var v = 1;
    while (v <= 6 && bytes.length > dataCw(v) - 2) v++;
    if (v > 6) throw new Error('Texto longo demais para o QR do protótipo');
    var cap = dataCw(v) * 8, bits = [];
    function push(val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
    push(4, 4); push(bytes.length, 8); bytes.forEach(function (b) { push(b, 8); });
    push(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (var pad = 0xEC; cw.length < dataCw(v); pad ^= 0xEC ^ 0x11) cw.push(pad);
    var nb = VER[v][2], per = cw.length / nb, blocks = [], eccs = [];
    for (i = 0; i < nb; i++) { var b = cw.slice(i * per, (i + 1) * per); blocks.push(b); eccs.push(rem(b, VER[v][1])); }
    var out = [];
    for (i = 0; i < per; i++) blocks.forEach(function (b) { out.push(b[i]); });
    for (i = 0; i < VER[v][1]; i++) eccs.forEach(function (e) { out.push(e[i]); });
    return { v: v, cw: out };
  }

  function build(text) {
    var enc = encode(text), v = enc.v, size = 17 + 4 * v;
    var m = [], fn = [];
    for (var y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function set(px, py, dark) { if (px >= 0 && py >= 0 && px < size && py < size) { m[py][px] = dark; fn[py][px] = true; } }
    for (i = 0; i < size; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
    [[0, 0], [size - 7, 0], [0, size - 7]].forEach(function (o) {
      for (var dy = -1; dy <= 7; dy++) for (var dx = -1; dx <= 7; dx++) {
        var inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        var dark = inside && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        set(o[0] + dx, o[1] + dy, dark);
      }
    });
    var al = ALIGN[v];
    al.forEach(function (cy) { al.forEach(function (cx) {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === al[al.length - 1]) || (cy === 6 && cx === al[al.length - 1])) return;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }); });
    // informação de formato: nível L (01) + máscara 0 (000), BCH(15,5)
    var data5 = (1 << 3) | 0, r = data5;
    for (i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    var fmt = ((data5 << 10) | r) ^ 0x5412;
    function fb(k) { return ((fmt >>> k) & 1) === 1; }
    for (i = 0; i <= 5; i++) set(8, i, fb(i));
    set(8, 7, fb(6)); set(8, 8, fb(7)); set(7, 8, fb(8));
    for (i = 9; i < 15; i++) set(14 - i, 8, fb(i));
    for (i = 0; i < 8; i++) set(size - 1 - i, 8, fb(i));
    for (i = 8; i < 15; i++) set(8, size - 15 + i, fb(i));
    set(8, size - 8, true);
    // posicionamento zigue-zague dos dados
    var k = 0, total = enc.cw.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var px = right - j, upward = ((right + 1) & 2) === 0, py = upward ? size - 1 - vert : vert;
        if (!fn[py][px] && k < total) { m[py][px] = ((enc.cw[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; }
        if (!fn[py][px]) { if ((px + py) % 2 === 0) m[py][px] = !m[py][px]; } // máscara 0
      }
    }
    return { size: size, m: m };
  }

  /** Retorna um elemento SVG com o QR (zona de silêncio de 4 módulos). */
  F.qr = function (text, opts) {
    opts = opts || {};
    var q = build(text), s = q.size + 8, d = '';
    for (var y = 0; y < q.size; y++) { var x0 = -1;
      for (var xx = 0; xx <= q.size; xx++) {
        var on = xx < q.size && q.m[y][xx];
        if (on && x0 < 0) x0 = xx;
        if (!on && x0 >= 0) { d += 'M' + (x0 + 4) + ' ' + (y + 4) + 'h' + (xx - x0) + 'v1h-' + (xx - x0) + 'z'; x0 = -1; }
      } }
    var t = document.createElement('template');
    t.innerHTML = '<svg viewBox="0 0 ' + s + ' ' + s + '" width="' + (opts.size || 180) + '" height="' + (opts.size || 180) + '" role="img" aria-label="' + (opts.label || 'QR Code do ticket') + '" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="' + s + '" height="' + s + '" fill="#fff"/><path d="' + d + '" fill="#0B1B33"/></svg>';
    return t.content.firstChild;
  };
})();
