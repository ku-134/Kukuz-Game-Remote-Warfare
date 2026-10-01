/* core/engine.js —— 状态机 / 主循环 / 渲染调度
   状态：boot -> menu -> play。
   渲染：界面画到离屏内容画布 -> FX 磷光屏后处理 -> 输出屏幕。
   完整实现（地形色阶 / 等高线 / 水面 / 网格刻度 / 雷达 / 坐标尺）见本地源码。 */
RW.engine = (function () {
  'use strict';

  var screen, content, cx;
  var W = 0, H = 0, dpr = 1;
  var tile = { size: 26, originX: 0, originY: 0 };
  var units = [], last = 0;

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
    units = [
      RW.unit.create('infantry', 6, 12),
      RW.unit.create('armored', 9, 15),
      RW.unit.create('recon', 4, 9)
    ];
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
    layoutMap();
  }

  function layoutMap() {
    var s = RW.fx.size();
    var availW = s.W - 80 * s.dpr;
    var availH = s.H - 75 * s.dpr;
    var size = Math.floor(Math.min(availW / RW.terrain.W, availH / RW.terrain.H));
    tile.size = Math.max(8, size);
    tile.originX = Math.round((s.W - tile.size * RW.terrain.W) / 2);
    tile.originY = Math.round((s.H - tile.size * RW.terrain.H) / 2);
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
    var t = screenToTile(p), picked = null;
    for (var i = 0; i < units.length; i++) if (units[i].x === t.x && units[i].y === t.y) picked = units[i];
    units.forEach(function (o) { o.selected = false; });
    if (picked) { picked.selected = true; RW.fx.burst(0.45); }
  }

  function screenToTile(p) {
    return { x: Math.floor((p.x - tile.originX) / tile.size), y: Math.floor((p.y - tile.originY) / tile.size) };
  }

  function start() { last = performance.now(); requestAnimationFrame(loop); }

  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    var t = now / 1000;
    RW.fx.update(dt);
    if (screen === 'boot') {
      RW.boot.update(dt);
      clearContent(); RW.boot.draw(cx);
      if (RW.boot.isDone()) goto('menu');
    } else if (screen === 'menu') {
      RW.menu.update(dt);
      clearContent(); RW.menu.draw(cx);
    } else {
      drawPlay(t);
    }
    RW.fx.present(content);
    requestAnimationFrame(loop);
  }

  function clearContent() {
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.fillStyle = '#000600';
    cx.fillRect(0, 0, content.width, content.height);
  }

  function mapRect() {
    return { x: tile.originX, y: tile.originY, w: tile.size * RW.terrain.W, h: tile.size * RW.terrain.H };
  }

  function drawPlay(t) {
    var s = RW.fx.size();
    clearContent();
    drawMapFrame(s);
    drawTerrainLayer();
    drawGridLayer();
    drawContourLayer();
    drawWaterLayer(t);
    for (var i = 0; i < units.length; i++) RW.unit.draw(cx, units[i], tile, RW.terrain, t);
    drawMapChrome(s, t);
  }

  function drawMapFrame(s) {
    var m = mapRect(), u = s.dpr, pad = 6 * u;
    cx.fillStyle = 'rgba(0,25,0,0.55)';
    cx.fillRect(m.x - pad, m.y - pad, m.w + pad * 2, m.h + pad * 2);
    RW.fx.frame(cx, m.x - pad, m.y - pad, m.w + pad * 2, m.h + pad * 2, { color: '#00aa00' });
    var L = Math.min(18 * u, m.w * 0.06);
    cx.strokeStyle = '#33ff33';
    cx.lineWidth = 2;
    var cs = [[m.x - pad, m.y - pad, 1, 1], [m.x + m.w + pad, m.y - pad, -1, 1], [m.x - pad, m.y + m.h + pad, 1, -1], [m.x + m.w + pad, m.y + m.h + pad, -1, -1]];
    for (var i = 0; i < cs.length; i++) {
      var c = cs[i];
      cx.beginPath();
      cx.moveTo(c[0], c[1] + c[3] * L); cx.lineTo(c[0], c[1]); cx.lineTo(c[0] + c[2] * L, c[1]);
      cx.stroke();
    }
  }

  function drawTerrainLayer() {
    for (var y = 0; y < RW.terrain.H; y++) for (var x = 0; x < RW.terrain.W; x++) {
      var h = RW.terrain.heightAt(x, y);
      var px = tile.originX + x * tile.size, py = tile.originY + y * tile.size;
      var g;
      if (h < 0.20) g = 10; else if (h < 0.30) g = 26; else if (h < 0.42) g = 44;
      else if (h < 0.55) g = 64; else if (h < 0.70) g = 88; else if (h < 0.85) g = 112; else g = 140;
      cx.fillStyle = 'rgba(0,' + g + ',0,1)';
      cx.fillRect(px, py, tile.size + 0.5, tile.size + 0.5);
    }
  }

  function drawGridLayer() {
    var tw = RW.terrain.W, th = RW.terrain.H, x, y, px, py;
    cx.strokeStyle = 'rgba(0,190,0,0.16)';
    cx.lineWidth = 1;
    for (x = 0; x <= tw; x++) { px = Math.round(tile.originX + x * tile.size) + 0.5; cx.beginPath(); cx.moveTo(px, tile.originY); cx.lineTo(px, tile.originY + th * tile.size); cx.stroke(); }
    for (y = 0; y <= th; y++) { py = Math.round(tile.originY + y * tile.size) + 0.5; cx.beginPath(); cx.moveTo(tile.originX, py); cx.lineTo(tile.originX + tw * tile.size, py); cx.stroke(); }
    cx.strokeStyle = 'rgba(51,255,51,0.30)';
    for (x = 0; x <= tw; x += 5) { px = Math.round(tile.originX + x * tile.size) + 0.5; cx.beginPath(); cx.moveTo(px, tile.originY); cx.lineTo(px, tile.originY + th * tile.size); cx.stroke(); }
    for (y = 0; y <= th; y += 5) { py = Math.round(tile.originY + y * tile.size) + 0.5; cx.beginPath(); cx.moveTo(tile.originX, py); cx.lineTo(tile.originX + tw * tile.size, py); cx.stroke(); }
  }

  function drawContourLayer() {
    var groups = RW.terrain.contours(), bx = tile.originX, by = tile.originY, sz = tile.size;
    for (var gi = 0; gi < groups.length; gi++) {
      var grp = groups[gi];
      cx.strokeStyle = 'rgba(120,255,120,' + (0.20 + gi * 0.14).toFixed(2) + ')';
      cx.lineWidth = gi >= 3 ? 1.6 : 1;
      cx.beginPath();
      for (var i = 0; i < grp.segs.length; i++) {
        var sg = grp.segs[i], px = bx + sg.x * sz, py = by + sg.y * sz;
        if (sg.vert) { cx.moveTo(px, py - sz * 0.42); cx.lineTo(px, py + sz * 0.42); }
        else { cx.moveTo(px - sz * 0.42, py); cx.lineTo(px + sz * 0.42, py); }
      }
      cx.stroke();
    }
  }

  function drawWaterLayer(t) {
    for (var y = 0; y < RW.terrain.H; y++) for (var x = 0; x < RW.terrain.W; x++) {
      if (!RW.terrain.isWater(x, y)) continue;
      var px = tile.originX + x * tile.size, py = tile.originY + y * tile.size;
      cx.fillStyle = 'rgba(0,20,40,0.92)';
      cx.fillRect(px, py, tile.size, tile.size);
      cx.fillStyle = 'rgba(0,170,255,0.16)';
      cx.fillRect(px, py, tile.size, tile.size);
      cx.strokeStyle = 'rgba(80,200,255,0.55)';
      cx.lineWidth = 1;
      for (var k = 0; k < 3; k++) {
        var ph = (t * 0.6 + k * 0.33 + (x + y) * 0.18) % 1;
        var wy = py + ph * tile.size;
        var inset = Math.abs(ph - 0.5) * tile.size * 0.5;
        cx.beginPath(); cx.moveTo(px + inset, wy); cx.lineTo(px + tile.size - inset, wy); cx.stroke();
      }
    }
  }

  function drawMapChrome(s, t) {
    var m = mapRect(), u = s.dpr, small = 9 * u;
    RW.fx.phosphorText(cx, 'TACTICAL MAP  //  SECTOR 07-ALPHA', m.x, m.y - 16 * u, small, { color: '#00cc00' });
    RW.fx.phosphorText(cx, 'GRID ' + RW.terrain.W + 'x' + RW.terrain.H + '  ·  SEED ' + RW.terrain.seed, m.x + m.w, m.y - 16 * u, small, { align: 'right', color: '#008800' });

    cx.fillStyle = 'rgba(0,255,0,0.55)';
    cx.font = Math.round(7.5 * u) + 'px "Courier New", monospace';
    cx.textAlign = 'center'; cx.textBaseline = 'top';
    for (var x = 0; x < RW.terrain.W; x += 5) cx.fillText((x + 1), m.x + (x + 0.5) * tile.size, m.y + m.h + 4 * u);
    cx.textAlign = 'left'; cx.textBaseline = 'middle';
    for (var y = 0; y < RW.terrain.H; y += 5) cx.fillText(String.fromCharCode(65 + (y % 26)), m.x - 14 * u, m.y + (y + 0.5) * tile.size);

    var rr = Math.min(46 * u, m.h * 0.22);
    var rcx = m.x + m.w + rr + 18 * u, rcy = m.y + m.h - rr;
    if (rcx + rr > s.W - 6 * u) { rcx = m.x + m.w - rr - 6 * u; rcy = m.y + m.h + rr + 16 * u; }
    drawRadar(cx, rcx, rcy, rr, t, u);

    var ly = m.y + m.h + 22 * u;
    if (ly > s.H - 10 * u) ly = m.y + m.h - 30 * u;
    RW.fx.phosphorText(cx, 'SCALE 1:' + Math.round(tile.size * 8), m.x, ly, small, { color: '#008800' });
    cx.strokeStyle = '#00aa00';
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(m.x, ly + 6 * u); cx.lineTo(m.x + tile.size * 5, ly + 6 * u);
    cx.moveTo(m.x, ly + 3 * u); cx.lineTo(m.x, ly + 9 * u);
    cx.moveTo(m.x + tile.size * 5, ly + 3 * u); cx.lineTo(m.x + tile.size * 5, ly + 9 * u);
    cx.stroke();
    RW.fx.phosphorText(cx, '[CLICK] 选择单位    [ESC] 主菜单', m.x, ly + 22 * u, small, { color: '#006600' });
  }

  function drawRadar(c, cx0, cy0, r, t, u) {
    c.save();
    c.beginPath(); c.arc(cx0, cy0, r, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,25,0,0.85)'; c.fill();
    c.strokeStyle = '#00aa00'; c.lineWidth = 1; c.stroke();
    c.strokeStyle = 'rgba(0,170,0,0.45)';
    for (var i = 1; i <= 2; i++) { c.beginPath(); c.arc(cx0, cy0, r * i / 3, 0, Math.PI * 2); c.stroke(); }
    c.beginPath();
    c.moveTo(cx0 - r, cy0); c.lineTo(cx0 + r, cy0);
    c.moveTo(cx0, cy0 - r); c.lineTo(cx0, cy0 + r);
    c.stroke();
    var ang = t * 1.4 % (Math.PI * 2);
    var grad = c.createRadialGradient(cx0, cy0, 0, cx0, cy0, r);
    grad.addColorStop(0, 'rgba(51,255,51,0.55)');
    grad.addColorStop(1, 'rgba(51,255,51,0)');
    c.beginPath(); c.moveTo(cx0, cy0); c.arc(cx0, cy0, r, ang - 0.5, ang); c.closePath();
    c.fillStyle = grad; c.fill();
    c.strokeStyle = '#33ff33'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(cx0, cy0); c.lineTo(cx0 + Math.cos(ang) * r, cy0 + Math.sin(ang) * r); c.stroke();
    c.fillStyle = '#33ff33';
    for (var k = 0; k < units.length; k++) {
      var uu = units[k];
      var dx = (uu.x / RW.terrain.W - 0.5) * 2, dy = (uu.y / RW.terrain.H - 0.5) * 2;
      var ex = cx0 + dx * r * 0.7, ey = cy0 + dy * r * 0.7;
      c.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(t * 3 + k));
      c.fillRect(ex - 1.5, ey - 1.5, 3, 3);
      c.globalAlpha = 1;
    }
    RW.fx.phosphorText(c, 'RADAR', cx0, cy0 - r - 4 * u, 7.5 * u, { align: 'center', color: '#00aa00' });
    c.restore();
  }

  return { init: init, start: start, goto: goto, showModal: showModal, screen: function () { return screen; } };
})();
