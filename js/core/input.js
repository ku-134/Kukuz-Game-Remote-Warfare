/* core/input.js —— 键盘 + 触屏统一输入 */
RW.input = (function () {
  'use strict';

  var keys = {};
  var handlers = [];

  function onKey(e) {
    var k = e.key.toLowerCase();
    keys[k] = (e.type === 'keydown');
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
  }

  function pointerPos(e) {
    var c = document.getElementById('stage');
    var r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function emit(name, p) {
    for (var i = 0; i < handlers.length; i++) handlers[i](name, p);
  }

  function bind() {
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    var stage = document.getElementById('stage');
    stage.addEventListener('pointerdown', function (e) { e.preventDefault(); emit('down', pointerPos(e)); }, { passive: false });
    stage.addEventListener('pointermove', function (e) { emit('move', pointerPos(e)); }, { passive: false });
    stage.addEventListener('pointerup', function (e) { emit('up', pointerPos(e)); });
  }

  return {
    bind: bind,
    down: function (k) { return !!keys[k]; },
    on: function (fn) { handlers.push(fn); }
  };
})();
