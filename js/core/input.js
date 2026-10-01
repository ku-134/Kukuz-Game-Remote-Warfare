/* core/input.js —— 键盘 + 触屏统一输入（带画布坐标换算） */
RW.input = (function () {
  'use strict';

  var keys = {};
  var handlers = [];
  var canvas;

  function onKey(e) {
    var k = e.key.toLowerCase();
    keys[k] = (e.type === 'keydown');
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    if (e.type === 'keydown') emit('key', { key: k });
  }

  /* 屏幕像素 -> 内部画布像素（含 DPR） */
  function pointerPos(e) {
    var r = canvas.getBoundingClientRect();
    var s = RW.fx.size();
    return {
      x: (e.clientX - r.left) / r.width * s.W,
      y: (e.clientY - r.top) / r.height * s.H
    };
  }

  function emit(name, p) {
    for (var i = 0; i < handlers.length; i++) handlers[i](name, p);
  }

  function bind() {
    canvas = document.getElementById('stage');
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); emit('down', pointerPos(e)); }, { passive: false });
    canvas.addEventListener('pointermove', function (e) { emit('move', pointerPos(e)); }, { passive: false });
    canvas.addEventListener('pointerup', function (e) { emit('up', pointerPos(e)); });
  }

  return {
    bind: bind,
    down: function (k) { return !!keys[k]; },
    on: function (fn) { handlers.push(fn); }
  };
})();
