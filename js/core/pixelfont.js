/* core/pixelfont.js —— 5x7 点阵像素字体
   零资源实现：字库内置于代码，用于英文/数字/符号。完整字库见本地源码。 */
RW.pixel = (function () {
  'use strict';

  var G = {
    'A': '0E,11,11,1F,11,11,11', 'B': '1E,11,11,1E,11,11,1E', 'C': '0E,11,10,10,10,11,0E',
    'D': '1C,12,11,11,11,12,1C', 'E': '1F,10,10,1E,10,10,1F', 'F': '1F,10,10,1E,10,10,10',
    'G': '0E,11,10,17,11,11,0E', 'H': '11,11,11,1F,11,11,11', 'I': '0E,04,04,04,04,04,0E',
    'J': '07,02,02,02,02,12,0C', 'K': '11,12,14,18,14,12,11', 'L': '10,10,10,10,10,10,1F',
    'M': '11,1B,15,15,11,11,11', 'N': '11,19,15,13,11,11,11', 'O': '0E,11,11,11,11,11,0E',
    'P': '1E,11,11,1E,10,10,10', 'Q': '0E,11,11,11,15,12,0D', 'R': '1E,11,11,1E,14,12,11',
    'S': '0F,10,10,0E,01,01,1E', 'T': '1F,04,04,04,04,04,04', 'U': '11,11,11,11,11,11,0E',
    'V': '11,11,11,11,11,0A,04', 'W': '11,11,11,15,15,1B,11', 'X': '11,11,0A,04,0A,11,11',
    'Y': '11,11,0A,04,04,04,04', 'Z': '1F,01,02,04,08,10,1F',
    '0': '0E,11,13,15,19,11,0E', '1': '04,0C,04,04,04,04,0E', '2': '0E,11,01,02,04,08,1F',
    '3': '1F,02,04,02,01,11,0E', '4': '02,06,0A,12,1F,02,02', '5': '1F,10,1E,01,01,11,0E',
    '6': '06,08,10,1E,11,11,0E', '7': '1F,01,02,04,08,08,08', '8': '0E,11,11,0E,11,11,0E',
    '9': '0E,11,11,0F,01,02,0C',
    ' ': '00,00,00,00,00,00,00', '.': '00,00,00,00,00,0C,0C', ',': '00,00,00,00,0C,04,08',
    ':': '00,0C,0C,00,0C,0C,00', ';': '00,0C,0C,00,0C,04,08', '-': '00,00,00,1F,00,00,00',
    '+': '00,04,04,1F,04,04,00', '/': '01,02,02,04,08,08,10', '\\': '10,08,08,04,02,02,01',
    '!': '04,04,04,04,04,00,04', '?': '0E,11,01,02,04,00,04', '%': '11,12,02,04,08,09,11',
    '(': '02,04,08,08,08,04,02', ')': '08,04,02,02,02,04,08', '[': '0E,08,08,08,08,08,0E',
    ']': '0E,02,02,02,02,02,0E', '<': '02,04,08,10,08,04,02', '>': '08,04,02,01,02,04,08',
    '=': '00,00,1F,00,1F,00,00', '#': '0A,0A,1F,0A,1F,0A,0A', '*': '00,0A,04,1F,04,0A,00',
    "'": '04,04,00,00,00,00,00', '"': '0A,0A,00,00,00,00,00', '_': '00,00,00,00,00,00,1F',
    '~': '00,00,15,0A,00,00,00', '|': '04,04,04,04,04,04,04', '&': '0C,12,14,08,15,12,0D',
    '@': '0E,11,17,15,17,10,0E', '^': '04,0A,11,00,00,00,00'
  };

  var FONT = {};
  (function () {
    for (var k in G) {
      var rows = G[k].split(',');
      var arr = [];
      for (var i = 0; i < 7; i++) arr.push(parseInt(rows[i], 16));
      FONT[k] = arr;
    }
  })();

  var CW = 5, CH = 7, GAP = 1;

  function measure(text, scale) {
    scale = scale || 1;
    return text.length * (CW + GAP) * scale - GAP * scale;
  }
  function height(scale) { return CH * (scale || 1); }

  /* limit 控制逐字显现；blink 控制逐行显现（模板先出、文字渐写） */
  function draw(c, text, x, y, scale, color, opt) {
    opt = opt || {};
    scale = scale || 1;
    var alpha = opt.alpha === undefined ? 1 : opt.alpha;
    var limit = opt.limit === undefined ? text.length : opt.limit;
    var rowLimit = opt.blink;
    var px = x, py = y, i, ch, row, col, glyph, bits;
    c.fillStyle = color || '#33ff33';
    c.globalAlpha = alpha;
    for (i = 0; i < text.length; i++) {
      if (i >= limit) break;
      ch = text.charAt(i).toUpperCase();
      glyph = FONT[ch];
      if (!glyph) { px += (CW + GAP) * scale; continue; }
      var maxRow = CH;
      if (rowLimit !== undefined) maxRow = Math.max(0, Math.min(CH, rowLimit));
      for (row = 0; row < maxRow; row++) {
        bits = glyph[row];
        for (col = 0; col < CW; col++) {
          if (bits & (1 << (CW - 1 - col))) c.fillRect(px + col * scale, py + row * scale, scale, scale);
        }
      }
      px += (CW + GAP) * scale;
    }
    c.globalAlpha = 1;
  }

  function drawCentered(c, text, cx, y, scale, color, opt) {
    draw(c, text, cx - measure(text, scale) / 2, y, scale, color, opt);
  }

  function revealRows(rv) { return Math.ceil(CH * RW.utils.clamp(rv, 0, 1)); }

  return {
    CW: CW, CH: CH, measure: measure, height: height,
    draw: draw, drawCentered: drawCentered, revealRows: revealRows
  };
})();
