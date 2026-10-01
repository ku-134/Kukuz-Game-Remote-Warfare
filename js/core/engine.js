/* core/engine.js —— 状态机 / 主循环 / 渲染调度（完整实现见本地源码） */
RW.engine = (function () {
  'use strict';

  var screen;
  var content, cx;
  var W = 0, H = 0, dpr = 1;
  var tile = { size: 28, originX: 40, originY: 48 };
  var units = [];
  var last = 0;

  function init() {
    var canvas = document.getElementById('stage');
    RW.fx.init(canvas);
    content = document.createElement('canvas');
    cx = content.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    RW.ui.init();
    RW.settings.apply();
    RW.terrain.generate();
    units = [RW.unit.create('infantry', 5, 5), RW.unit.create('armored', 8, 8)];

    RW.input.bind();
    RW.input.on(handleInput);

    RW.boot.reset();
    goto('boot');
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    RW.fx.resize(W, H, dpr);
    var s = RW.fx.size();
    content.width = s.W; content.height = s.H;
  }

  function goto(name) {
    screen = name;
    if (name === 'menu') { RW.menu.reset(); buildHUD(false); }
    if (name === 'play') { buildHUD(true); RW.fx.burst(1.0); }
  }

  function buildHUD(show) {
    RW.ui.clear();
    if (!show) return;
    RW.ui.show(RW.ui.hud('REMOTE WARFARE v' + RW.version, 'LEVEL 01 · 教学', 'TURN 00'));
  }

  function showModal(title, lines) {
    RW.ui.clear();
    RW.ui.show(RW.ui.hud('REMOTE WARFARE v' + RW.version, '', ''));
    var body = document.createElement('div');
    lines.forEach(function (l) { body.appendChild(document.createTextNode(l)); body.appendChild(document.createElement('br')); });
    RW.ui.show(RW.ui.modal(title, body, [{ label: '关闭', onClick: function () { buildHUD(screen === 'play'); } }]));
  }

  function handleInput(name, p) {
    if (screen === 'boot') { if (name === 'down' || name === 'key') RW.boot.skip(); return; }
    if (screen === 'menu') {
      if (name === 'down') RW.menu.onPointerDown(p);
      if (name === 'key') RW.menu.onKey(p.key);
      return;
    }
    if (screen === 'play') {
      if (name === 'key' && (p.key === 'escape' || p.key === 'q')) goto('menu');
      if (name === 'down') handlePlayTap(p);
    }
  }

  function handlePlayTap(p) {
    var t = screenToTile(p);
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var sel = (u.x === t.x && u.y === t.y);
      units.forEach(function (o) { o.selected = false; });
      if (sel) { u.selected = true; RW.fx.burst(0.5); }
    }
  }

  function screenToTile(p) {
    var s = RW.fx.size();
    var scale = Math.min(s.W / W, s.H / H);
    var ox = (s.W - W * scale) / 2, oy = (s.H - H * scale) / 2;
    return {
      x: Math.floor((p.x - ox - tile.originX) / tile.size),
      y: Math.floor((p.y - oy - tile.originY) / tile.size)
    };
  }

  function start() { last = performance.now(); requestAnimationFrame(loop); }

  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    var t = now / 1000;
    RW.fx.update(dt);

    if (screen === 'boot') {
      RW.boot.update(dt);
      drawBoot();
      if (RW.boot.isDone()) goto('menu');
    } else if (screen === 'menu') {
      RW.menu.update(dt);
      drawToContent(function (c) { RW.menu.draw(c); });
    } else {
      drawPlay(t);
    }

    RW.fx.present(content);
    requestAnimationFrame(loop);
  }

  function clearContent() {
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.fillStyle = '#010401';
    cx.fillRect(0, 0, content.width, content.height);
  }

  function drawToContent(fn) { clearContent(); fn(cx); }
  function drawBoot() { clearContent(); RW.boot.draw(cx); }

  function drawPlay(t) {
    var s = RW.fx.size();
    clearContent();
    var scale = Math.min(s.W / W, s.H / H);
    var ox = (s.W - W * scale) / 2, oy = (s.H - H * scale) / 2;
    cx.save(); cx.translate(ox, oy); cx.scale(scale, scale);
    drawGrid();
    drawTerrain();
    for (var i = 0; i < units.length; i++) RW.unit.draw(cx, units[i], tile, RW.terrain);
    RW.fx.phosphorText(cx, '点击方格选择单位   [ESC] 返回主菜单', 12, H - 12, 11, { color: '#008800' });
    cx.restore();
  }

  function drawGrid() {
    cx.strokeStyle = 'rgba(0,170,0,0.22)';
    cx.lineWidth = 1;
    var tw = RW.terrain.W, th = RW.terrain.H, px, py;
    for (var x = 0; x <= tw; x++) { px = tile.originX + x * tile.size; cx.beginPath(); cx.moveTo(px, tile.originY); cx.lineTo(px, tile.originY + th * tile.size); cx.stroke(); }
    for (var y = 0; y <= th; y++) { py = tile.originY + y * tile.size; cx.beginPath(); cx.moveTo(tile.originX, py); cx.lineTo(tile.originX + tw * tile.size, py); cx.stroke(); }
  }

  function drawTerrain() {
    var tw = RW.terrain.W, th = RW.terrain.H;
    for (var y = 0; y < th; y++) {
      for (var x = 0; x < tw; x++) {
        var h = RW.terrain.heightAt(x, y);
        var px = tile.originX + x * tile.size, py = tile.originY + y * tile.size;
        var g = Math.round(20 + h * 70);
        cx.fillStyle = 'rgba(0,' + g + ',0,0.55)';
        cx.fillRect(px, py, tile.size, tile.size);
        if (RW.terrain.isWater(x, y)) { cx.fillStyle = 'rgba(0,120,180,0.45)'; cx.fillRect(px, py, tile.size, tile.size); }
      }
    }
    for (var lvl = 1; lvl < 4; lvl++) {
      var th2 = lvl / 4;
      for (var y2 = 0; y2 < th; y2++) for (var x2 = 0; x2 < tw; x2++) {
        if (Math.abs(RW.terrain.heightAt(x2, y2) - th2) < 0.02) {
          RW.fx.frame(cx, tile.originX + x2 * tile.size + 3, tile.originY + y2 * tile.size + 3, tile.size - 6, tile.size - 6, { color: '#33ff33', alpha: 0.5 });
        }
      }
    }
  }

  return { init: init, start: start, goto: goto, showModal: showModal, screen: function () { return screen; } };
})();
