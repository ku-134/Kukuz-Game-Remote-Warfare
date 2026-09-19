/* ui/ui.js —— UI 框架：按钮 / 弹窗 / 显示层，遵循 UI 规范 */
RW.ui = (function () {
  'use strict';

  var root;

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

  return { init: init, el: el, button: button, modal: modal, hud: hud, show: show, clear: clear };
})();
