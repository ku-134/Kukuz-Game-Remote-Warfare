/* ui/ui.js —— UI 框架
   1) DOM 层：弹窗等显示层
   2) Canvas 层：点击闪烁（交互反馈） */
RW.ui = (function () {
  'use strict';

  var root;
  var flashes = [];

  function init() { root = document.getElementById('ui-root'); }

  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text !== undefined) d.textContent = text;
    return d;
  }

  function button(text, onClick) {
    var b = el('button', 'btn', text);
    b.addEventListener('click', onClick);
    return b;
  }

  function modal(title, body, actions) {
    var m = el('div', 'modal');
    if (title) m.appendChild(el('div', 'modal-title', title));
    var b = el('div', 'modal-body');
    if (typeof body === 'string') b.textContent = body;
    else b.appendChild(body);
    m.appendChild(b);
    var foot = el('div', 'modal-foot');
    (actions || []).forEach(function (a) { foot.appendChild(button(a.label, a.onClick)); });
    m.appendChild(foot);
    return m;
  }

  function hud(left, center, right) {
    var h = el('div', 'hud');
    h.appendChild(el('span', '', left || ''));
    h.appendChild(el('span', '', center || ''));
    h.appendChild(el('span', '', right || ''));
    return h;
  }

  function show(node) { root.appendChild(node); return node; }
  function clear() { root.innerHTML = ''; }

  /* ---------- 点击闪烁：被点击元素先闪三下 */
  var FLASH_DUR = 0.34;

  function flash(x, y, w, h) {
    flashes.push({ x: x, y: y, w: w, h: h, t: FLASH_DUR });
  }

  function updateFlashes(dt) {
    for (var i = flashes.length - 1; i >= 0; i--) {
      flashes[i].t -= dt;
      if (flashes[i].t <= 0) flashes.splice(i, 1);
    }
  }

  function drawFlashes(c) {
    for (var i = 0; i < flashes.length; i++) {
      var f = flashes[i];
      var p = 1 - f.t / FLASH_DUR;
      var on = Math.floor(p * 3) % 2 === 0;
      if (on) RW.fx.invert(c, f.x, f.y, f.w, f.h);
      c.globalAlpha = (1 - p) * 0.9;
      c.strokeStyle = '#33ff33';
      c.lineWidth = 2;
      c.strokeRect(Math.round(f.x) - 1, Math.round(f.y) - 1, Math.round(f.w) + 2, Math.round(f.h) + 2);
      c.globalAlpha = 1;
    }
  }

  function clearFlashes() { flashes.length = 0; }

  return {
    init: init, el: el, button: button, modal: modal, hud: hud,
    show: show, clear: clear,
    flash: flash, updateFlashes: updateFlashes, drawFlashes: drawFlashes, clearFlashes: clearFlashes
  };
})();
