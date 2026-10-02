/* core/engine.js —— 状态机 / 主循环 / 渲染调度
   游玩界面按 core/layout.js 的三区布局绘制：
   地图显示 / 地图操作 / 单位下令区 / 详情展示。
   含统一 panel() 面板原语与信号干扰覆盖层。完整实现见本地源码。 */
RW.engine = (function () {
  'use strict';

  var screen, content, cx;
  var W = 0, H = 0, dpr = 1;
  var units = [], last = 0;
  var hover = { x: -1, y: -1 };
  var focusedUnit = null;
  var jammed = false;

  var C = {
    hi: '#33ff33', mid: '#00cc00', mid2: '#00aa00',
    dim: '#008800', dark: '#006600', dimmest: '#004400'
  };

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
    RW.layout.compute(s);
  }

  function goto(name) {
    screen = name;
    if (name === 'menu') { RW.menu.reset(); RW.ui.clear(); }
    if (name === 'play') { RW.ui.clear(); RW.fx.burst(0.8); }
  }

  function showModal(title, lines) {
    RW.ui.clear();
    var body = document.createElement('div');
    lines.forEach(function (l) {
      body.appendChild(document.createTextNode(l));
      body.appendChild(document.createElement('br'));
    });
    RW.ui.show(RW.ui.modal(title, body, [
      { label: '关闭', onClick: function () { RW.ui.clear(); } }
    ]));
  }

  function handleInput(name, p) {
    if (screen === 'boot') { if (name === 'down' || name === 'key') RW.boot.skip(); return; }
    if (screen === 'menu') {
      if (name === 'down') RW.menu.onPointerDown(p);
      if (name === 'key') RW.menu.onKey(p.key);
      return;
    }
    if (screen === 'play') {
      if (name === 'key') {
        if (p.key === 'escape' || p.key === 'q') goto('menu');
        return;
      }
      if (jammed) return;   /* 信号干扰期间锁定操作 */
      var L = RW.layout.get();
      if (name === 'move') { handleHover(p, L); return; }
      if (name === 'down') { handleTap(p, L); return; }
    }
  }

  function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
  function tileAt(p, L) { return { x: Math.floor((p.x - L.tile.originX) / L.tile.size), y: Math.floor((p.y - L.tile.originY) / L.tile.size) }; }

  function handleHover(p, L) {
    if (inRect(p, L.mapInner)) {
      var t = tileAt(p, L);
      if (t.x >= 0 && t.y >= 0 && t.x < RW.terrain.W && t.y < RW.terrain.H) { hover.x = t.x; hover.y = t.y; }
      else { hover.x = -1; hover.y = -1; }
    } else { hover.x = -1; hover.y = -1; }
  }

  function handleTap(p, L) {
    if (inRect(p, L.mapInner)) {
      var t = tileAt(p, L), picked = null;
      for (var i = 0; i < units.length; i++) if (units[i].x === t.x && units[i].y === t.y) picked = units[i];
      units.forEach(function (o) { o.selected = false; });
      if (picked) { picked.selected = true; focusedUnit = picked; RW.fx.burst(0.4); }
      else { focusedUnit = null; }
      return;
    }
    if (inRect(p, L.tools) || inRect(p, L.orders)) { RW.fx.burst(0.25); return; }
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

  /* 统一面板：标题条 + 四角角标 + 边框。全界面复用。 */
  function panel(rect, title, opt) {
    opt = opt || {};
    var u = RW.layout.get().u || 1;
    var hh = 20 * u;
    cx.fillStyle = opt.fill || 'rgba(0,14,0,0.75)';
    cx.fillRect(rect.x, rect.y, rect.w, rect.h);
    cx.fillStyle = 'rgba(0,60,0,0.85)';
    cx.fillRect(rect.x, rect.y, rect.w, hh);
    RW.fx.phosphorText(cx, title, rect.x + 7 * u, rect.y + hh * 0.72, 9.5 * u, { color: C.mid });
    RW.fx.frame(cx, rect.x, rect.y, rect.w, rect.h, { color: opt.color || C.dark });
    cx.strokeStyle = opt.color || C.dark; cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(rect.x + 0.5, rect.y + hh + 0.5); cx.lineTo(rect.x + rect.w - 0.5, rect.y + hh + 0.5);
    cx.stroke();
    var L = Math.min(9 * u, rect.w * 0.06);
    cx.strokeStyle = C.hi; cx.lineWidth = 1.6;
    var cs = [[rect.x, rect.y, 1, 1], [rect.x + rect.w, rect.y, -1, 1], [rect.x, rect.y + rect.h, 1, -1], [rect.x + rect.w, rect.y + rect.h, -1, -1]];
    for (var i = 0; i < cs.length; i++) {
      var q = cs[i];
      cx.beginPath();
      cx.moveTo(q[0], q[1] + q[3] * L); cx.lineTo(q[0], q[1]); cx.lineTo(q[0] + q[2] * L, q[1]);
      cx.stroke();
    }
    return { x: rect.x, y: rect.y + hh, w: rect.w, h: rect.h - hh, hh: hh, u: u };
  }

  function drawPlay(t) {
    var L = RW.layout.get();
    clearContent();
    drawMapPanel(L, t);
    drawToolsPanel(L);
    drawOrdersPanel(L);
    drawSidePanel(L, t);
    drawFooter(L);
    if (jammed) drawJamOverlay(L, t);
  }

  function drawMapPanel(L, t) {
    var inner = panel(L.map, '地图显示  //  TACTICAL MAP');
    clipAndDraw(inner, function () {
      drawTerrainLayer(L); drawGridLayer(L); drawContourLayer(L);
      drawWaterLayer(L, t); drawHoverTile(L);
      for (var i = 0; i < units.length; i++) RW.unit.draw(cx, units[i], L.tile, RW.terrain, t);
      drawMapInstruments(L, t);
    });
  }

  function clipAndDraw(inner, fn) {
    cx.save();
    cx.beginPath(); cx.rect(inner.x, inner.y, inner.w, inner.h); cx.clip();
    fn();
    cx.restore();
  }

  function drawTerrainLayer(L) {
    var tl = L.tile;
    for (var y = 0; y < RW.terrain.H; y++) for (var x = 0; x < RW.terrain.W; x++) {
      var h = RW.terrain.heightAt(x, y);
      var px = tl.originX + x * tl.size, py = tl.originY + y * tl.size;
      var g;
      if (h < 0.20) g = 10; else if (h < 0.30) g = 30; else if (h < 0.42) g = 52;
      else if (h < 0.55) g = 76; else if (h < 0.70) g = 104; else if (h < 0.85) g = 134; else g = 166;
      cx.fillStyle = 'rgb(0,' + g + ',0)';
      cx.fillRect(px, py, tl.size + 0.6, tl.size + 0.6);
    }
  }

  function drawGridLayer(L) {
    var tl = L.tile, tw = RW.terrain.W, th = RW.terrain.H, x, y, px, py;
    cx.strokeStyle = 'rgba(0,190,0,0.14)'; cx.lineWidth = 1;
    for (x = 0; x <= tw; x++) { px = Math.round(tl.originX + x * tl.size) + 0.5; cx.beginPath(); cx.moveTo(px, tl.originY); cx.lineTo(px, tl.originY + th * tl.size); cx.stroke(); }
    for (y = 0; y <= th; y++) { py = Math.round(tl.originY + y * tl.size) + 0.5; cx.beginPath(); cx.moveTo(tl.originX, py); cx.lineTo(tl.originX + tw * tl.size, py); cx.stroke(); }
    cx.strokeStyle = 'rgba(51,255,51,0.28)';
    for (x = 0; x <= tw; x += 5) { px = Math.round(tl.originX + x * tl.size) + 0.5; cx.beginPath(); cx.moveTo(px, tl.originY); cx.lineTo(px, tl.originY + th * tl.size); cx.stroke(); }
    for (y = 0; y <= th; y += 5) { py = Math.round(tl.originY + y * tl.size) + 0.5; cx.beginPath(); cx.moveTo(tl.originX, py); cx.lineTo(tl.originX + tw * tl.size, py); cx.stroke(); }
  }

  function drawContourLayer(L) {
    var groups = RW.terrain.contours();
    var bx = L.tile.originX, by = L.tile.originY, sz = L.tile.size;
    for (var gi = 0; gi < groups.length; gi++) {
      var grp = groups[gi];
      cx.strokeStyle = 'rgba(140,255,140,' + (0.22 + gi * 0.14).toFixed(2) + ')';
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

  function drawWaterLayer(L, t) {
    var tl = L.tile;
    for (var y = 0; y < RW.terrain.H; y++) for (var x = 0; x < RW.terrain.W; x++) {
      if (!RW.terrain.isWater(x, y)) continue;
      var px = tl.originX + x * tl.size, py = tl.originY + y * tl.size;
      cx.fillStyle = 'rgb(0,22,40)'; cx.fillRect(px, py, tl.size, tl.size);
      cx.fillStyle = 'rgba(0,170,255,0.14)'; cx.fillRect(px, py, tl.size, tl.size);
      cx.strokeStyle = 'rgba(90,205,255,0.5)'; cx.lineWidth = 1;
      for (var k = 0; k < 3; k++) {
        var ph = (t * 0.6 + k * 0.33 + (x + y) * 0.18) % 1;
        var wy = py + ph * tl.size;
        var inset = Math.abs(ph - 0.5) * tl.size * 0.5;
        cx.beginPath(); cx.moveTo(px + inset, wy); cx.lineTo(px + tl.size - inset, wy); cx.stroke();
      }
    }
  }

  function drawHoverTile(L) {
    if (hover.x < 0 || hover.y < 0) return;
    var tl = L.tile;
    var px = tl.originX + hover.x * tl.size, py = tl.originY + hover.y * tl.size;
    cx.strokeStyle = 'rgba(51,255,51,0.85)'; cx.lineWidth = 1.4;
    cx.strokeRect(px + 0.5, py + 0.5, tl.size, tl.size);
    var m = Math.max(3, tl.size * 0.22);
    cx.beginPath();
    cx.moveTo(px, py + m); cx.lineTo(px, py); cx.lineTo(px + m, py);
    cx.moveTo(px + tl.size - m, py); cx.lineTo(px + tl.size, py); cx.lineTo(px + tl.size, py + m);
    cx.moveTo(px + tl.size, py + tl.size - m); cx.lineTo(px + tl.size, py + tl.size); cx.lineTo(px + tl.size - m, py + tl.size);
    cx.moveTo(px + m, py + tl.size); cx.lineTo(px, py + tl.size); cx.lineTo(px, py + tl.size - m);
    cx.stroke();
  }

  function drawMapInstruments(L, t) {
    var inner = L.mapInner, tl = L.tile, u = L.u;
    cx.fillStyle = 'rgba(0,255,0,0.45)';
    cx.font = Math.round(7 * u) + 'px "Courier New", monospace';
    cx.textAlign = 'center'; cx.textBaseline = 'top';
    for (var x = 0; x < RW.terrain.W; x += 5) cx.fillText((x + 1), tl.originX + (x + 0.5) * tl.size, inner.y + 2 * u);
    cx.textAlign = 'left'; cx.textBaseline = 'middle';
    for (var y = 0; y < RW.terrain.H; y += 5) cx.fillText(String.fromCharCode(65 + (y % 26)), inner.x + 2 * u, tl.originY + (y + 0.5) * tl.size);

    var nx = inner.x + inner.w - 20 * u, ny = inner.y + 22 * u;
    cx.strokeStyle = C.mid; cx.lineWidth = 1;
    cx.beginPath(); cx.arc(nx, ny, 11 * u, 0, Math.PI * 2); cx.stroke();
    cx.beginPath();
    cx.moveTo(nx, ny - 9 * u); cx.lineTo(nx - 3.5 * u, ny + 3 * u); cx.lineTo(nx, ny + 0.5 * u); cx.lineTo(nx + 3.5 * u, ny + 3 * u);
    cx.closePath(); cx.fillStyle = C.hi; cx.fill();
    RW.fx.phosphorText(cx, 'N', nx, ny - 14 * u, 8 * u, { align: 'center', color: C.mid2 });

    var sx = inner.x + 8 * u, sy = inner.y + inner.h - 9 * u;
    RW.fx.phosphorText(cx, '1:' + Math.round(tl.size * 8), sx, sy - 6 * u, 7.5 * u, { color: C.dim });
    cx.strokeStyle = C.mid2; cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(sx, sy); cx.lineTo(sx + tl.size * 4, sy);
    cx.moveTo(sx, sy - 3 * u); cx.lineTo(sx, sy + 3 * u);
    cx.moveTo(sx + tl.size * 4, sy - 3 * u); cx.lineTo(sx + tl.size * 4, sy + 3 * u);
    cx.stroke();
  }

  function drawToolsPanel(L) {
    var inner = panel(L.tools, '地图操作');
    var u = L.u, items = ['移动地图', '缩放', '网格', '标记'];
    var y = inner.y + 6 * u, rowH = (inner.h - 12 * u) / items.length;
    for (var i = 0; i < items.length; i++) {
      var r = { x: inner.x + 5 * u, y: y + i * rowH, w: inner.w - 10 * u, h: rowH - 3 * u };
      RW.fx.frame(cx, r.x, r.y, r.w, r.h, { color: C.dimmest });
      RW.fx.phosphorText(cx, items[i], r.x + 6 * u, r.y + r.h * 0.68, 8.5 * u, { color: C.dim });
    }
  }

  function drawOrdersPanel(L) {
    var inner = panel(L.orders, '单位下令区');
    var u = L.u;
    if (!focusedUnit) {
      RW.fx.phosphorText(cx, '未选中单位', inner.x + inner.w / 2, inner.y + inner.h * 0.42, 9.5 * u, { align: 'center', color: C.dimmest });
      RW.fx.phosphorText(cx, '在地图中点击我方单位以下达指令', inner.x + inner.w / 2, inner.y + inner.h * 0.62, 8 * u, { align: 'center', color: C.dimmest });
      return;
    }
    var cmds = ['移动', '攻击', '待命', '侦察', '补给'];
    var bw = (inner.w - 5 * 6 * u) / 5, by = inner.y + 8 * u, bh = inner.h - 16 * u;
    for (var i = 0; i < cmds.length; i++) {
      var bx = inner.x + 6 * u + i * (bw + 6 * u);
      RW.fx.frame(cx, bx, by, bw, bh, { color: C.dark, fill: 'rgba(0,40,0,0.6)' });
      RW.fx.phosphorText(cx, cmds[i], bx + bw / 2, by + bh * 0.62, 9 * u, { align: 'center', color: C.mid });
    }
  }

  function drawSidePanel(L, t) {
    var inner = panel(L.side, '详情展示  //  DETAIL');
    var u = L.u;
    var x = inner.x + 8 * u, w = inner.w - 16 * u, y = inner.y + 10 * u;
    RW.fx.frame(cx, x, y, w, 1, { color: C.dimmest });
    y += 10 * u;

    if (focusedUnit) {
      var un = RW.unit.TYPES[focusedUnit.type] || {};
      RW.fx.phosphorText(cx, focusedUnit.name, x, y, 12 * u, { color: C.hi, bold: true });
      y += 16 * u;
      RW.fx.phosphorText(cx, '代号 ' + focusedUnit.id.toUpperCase().slice(0, 8), x, y, 8 * u, { color: C.dim });
      y += 16 * u;
      y = drawStatBar('剩余人数', focusedUnit.strength, y, x, w, u, C.hi);
      y = drawStatBar('剩余物资', focusedUnit.supply, y, x, w, u, C.mid);
      y += 4 * u;
      RW.fx.phosphorText(cx, '战力上限  ' + (un.combat || 0), x, y, 8.5 * u, { color: C.mid2 }); y += 13 * u;
      RW.fx.phosphorText(cx, '机动范围  ' + (un.move || 0), x, y, 8.5 * u, { color: C.mid2 }); y += 16 * u;
      RW.fx.phosphorText(cx, '状态', x, y, 9 * u, { color: C.mid }); y += 13 * u;
      if (focusedUnit.buffs.length === 0) { RW.fx.phosphorText(cx, '  正常', x, y, 8.5 * u, { color: C.dim }); y += 13 * u; }
      else { focusedUnit.buffs.forEach(function (b) { RW.fx.phosphorText(cx, '  ' + b, x, y, 8.5 * u, { color: C.hi }); y += 13 * u; }); }
      y += 6 * u;
      RW.fx.frame(cx, x, y, w, 1, { color: C.dimmest }); y += 12 * u;
      var cx2 = focusedUnit.x, cy2 = focusedUnit.y;
      RW.fx.phosphorText(cx, '所在格  ' + String.fromCharCode(65 + (cy2 % 26)) + '-' + (cx2 + 1), x, y, 8.5 * u, { color: C.mid2 }); y += 13 * u;
      RW.fx.phosphorText(cx, '海拔    ' + Math.round(RW.terrain.heightAt(cx2, cy2) * 100) + ' m', x, y, 8.5 * u, { color: C.mid2 }); y += 13 * u;
      RW.fx.phosphorText(cx, '地貌    ' + (RW.terrain.isWater(cx2, cy2) ? '水域' : '陆地'), x, y, 8.5 * u, { color: C.mid2 });
    } else if (hover.x >= 0) {
      RW.fx.phosphorText(cx, '地块情报', x, y, 11 * u, { color: C.hi, bold: true }); y += 18 * u;
      RW.fx.phosphorText(cx, '坐标  ' + String.fromCharCode(65 + (hover.y % 26)) + '-' + (hover.x + 1), x, y, 9 * u, { color: C.mid2 }); y += 15 * u;
      RW.fx.phosphorText(cx, '海拔  ' + Math.round(RW.terrain.heightAt(hover.x, hover.y) * 100) + ' m', x, y, 9 * u, { color: C.mid2 }); y += 15 * u;
      RW.fx.phosphorText(cx, '地貌  ' + (RW.terrain.isWater(hover.x, hover.y) ? '水域' : '陆地'), x, y, 9 * u, { color: C.mid2 }); y += 15 * u;
      RW.fx.phosphorText(cx, '通行  ' + (RW.terrain.isWater(hover.x, hover.y) ? '受限' : '正常'), x, y, 9 * u, { color: C.mid2 });
    } else {
      RW.fx.phosphorText(cx, '待选目标', inner.x + inner.w / 2, inner.y + inner.h * 0.30, 10 * u, { align: 'center', color: C.dimmest });
      RW.fx.phosphorText(cx, '点击地图单位或', inner.x + inner.w / 2, inner.y + inner.h * 0.46, 8 * u, { align: 'center', color: C.dimmest });
      RW.fx.phosphorText(cx, '将指针移至地块', inner.x + inner.w / 2, inner.y + inner.h * 0.56, 8 * u, { align: 'center', color: C.dimmest });
    }
  }

  function drawStatBar(label, val, y, x, w, u, color) {
    RW.fx.phosphorText(cx, label, x, y, 8.5 * u, { color: C.mid2 });
    RW.fx.phosphorText(cx, Math.round(val) + '%', x + w, y, 8.5 * u, { align: 'right', color: color });
    y += 5 * u;
    var bh = 7 * u;
    cx.fillStyle = 'rgba(0,40,0,0.9)'; cx.fillRect(x, y, w, bh);
    cx.fillStyle = color; cx.fillRect(x + 1, y + 1, (w - 2) * (val / 100), bh - 2);
    RW.fx.frame(cx, x, y, w, bh, { color: C.dark });
    return y + bh + 11 * u;
  }

  function drawFooter(L) {
    var f = L.footer, u = L.u;
    RW.fx.frame(cx, f.x, f.y, f.w, f.h, { color: C.dimmest });
    var ty = f.y + f.h * 0.68;
    RW.fx.phosphorText(cx, 'REMOTE WARFARE  v' + RW.version, f.x + 8 * u, ty, 8 * u, { color: C.dim });
    RW.fx.phosphorText(cx, 'LEVEL 01 · 教学    TURN 00', f.x + f.w * 0.5, ty, 8 * u, { align: 'center', color: C.mid });
    RW.fx.phosphorText(cx, '[ESC] 主菜单', f.x + f.w - 8 * u, ty, 8 * u, { align: 'right', color: C.dim });
  }

  /* 信号干扰覆盖层：锁定操作时的表演效果 */
  function drawJamOverlay(L, t) {
    var u = L.u;
    cx.fillStyle = 'rgba(0,0,0,0.55)';
    cx.fillRect(0, 0, L.W, L.H);
    cx.save();
    cx.globalAlpha = 0.12;
    cx.strokeStyle = C.hi;
    cx.lineWidth = 8 * u;
    for (var i = -L.H; i < L.W; i += 26 * u) { cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i + L.H, L.H); cx.stroke(); }
    cx.restore();
    var bw = Math.min(L.W * 0.56, 460 * u), bh = 92 * u;
    var bx = (L.W - bw) / 2, by = (L.H - bh) / 2;
    RW.fx.frame(cx, bx, by, bw, bh, { color: C.hi, width: 2, fill: 'rgba(0,20,0,0.9)' });
    RW.fx.phosphorText(cx, 'SIGNAL LOST', L.W / 2, by + 30 * u, 22 * u, { align: 'center', color: C.hi, bold: true });
    RW.fx.phosphorText(cx, '战场信号被屏蔽', L.W / 2, by + 52 * u, 11 * u, { align: 'center', color: C.mid2 });
    if (Math.floor(t * 2) % 2 === 0) RW.fx.phosphorText(cx, '正在重新建立链路 . . .', L.W / 2, by + 74 * u, 10 * u, { align: 'center', color: C.mid });
  }

  return {
    init: init, start: start, goto: goto, showModal: showModal,
    screen: function () { return screen; },
    setJam: function (on) { jammed = !!on; RW.fx.jam(jammed ? 0.85 : 0); },
    isJammed: function () { return jammed; }
  };
})();
