/* core/engine.js —— 状态机 / 主循环 / 渲染调度（完整实现见本地源码）
   boot -> menu -> brief（关卡简报）-> play
   切屏规则：先播完点击闪烁 -> 扫描擦除过渡 -> 新界面文字逐行写入。
   游玩界面：地图视口（缩放/平移）+ 地图操作 + 操作区 + 详情展示，铺满全屏。 */
RW.engine = (function () {
  'use strict';

  var screen;
  var content, cx;
  var W = 0, H = 0, dpr = 1;
  var units = [], last = 0;

  var hover = { x: -1, y: -1 };
  var focusedUnit = null;
  var selectedTile = null;
  var marks = [];
  var cam = { x: 0, y: 0, zoom: 1 };
  var baseTile = 36;
  var jammed = false;
  var pendingScreen = null;

  var LEVELS = [
    {
      code: 'LEVEL 01', en: 'TRAINING GROUND', cn: '训练场',
      goal: '熟悉指挥终端的基本操作',
      brief: [
        '拖动地图操作区浏览战场',
        '点击地块查看情报，可标记位置',
        '选中我方单位后下达指令'
      ]
    }
  ];
  var levelIndex = 0;
  var briefTime = 0;

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
    baseTile = Math.round(18 * s.dpr);
    clampCam();
  }

  function goto(name) {
    screen = name;
    RW.ui.clearFlashes();
    if (name === 'menu') { RW.menu.reset(); RW.ui.clear(); }
    else if (name === 'brief') { briefTime = 0; RW.ui.clear(); }
    else if (name === 'play') { RW.ui.clear(); clampCam(); }
  }

  /* 请求切屏：等点击闪烁播完再开始过渡 */
  function requestScreen(name) {
    if (name === screen) return;
    pendingScreen = name;
  }

  function processPending() {
    if (!pendingScreen) return;
    if (RW.ui.hasFlashes()) return;
    if (RW.trans.isActive()) return;
    var n = pendingScreen;
    pendingScreen = null;
    RW.trans.go(function () { goto(n); }, 0.42);
  }

  function showModal(title, lines) {
    RW.ui.clear();
    var body = document.createElement('div');
    lines.forEach(function (l) {
      body.appendChild(document.createTextNode(l));
      body.appendChild(document.createElement('br'));
    });
    RW.ui.show(RW.ui.modal(title, body, [{ label: '关闭', onClick: function () { RW.ui.clear(); } }]));
  }

  function handleInput(name, p) {
    if (screen === 'boot') {
      if (name === 'down' || name === 'key') RW.boot.skip();
      return;
    }
    if (screen === 'menu') {
      if (RW.trans.isActive() || pendingScreen) return;
      if (name === 'down') RW.menu.onPointerDown(p);
      if (name === 'key') RW.menu.onKey(p.key);
      return;
    }
    if (screen === 'brief') {
      if (name === 'key' && (p.key === 'escape')) { requestScreen('menu'); return; }
      if (name === 'down' || name === 'key') {
        if (briefTime > 1.2) requestScreen('play');
      }
      return;
    }
    if (screen === 'play') {
      if (name === 'key') {
        if (p.key === 'escape' || p.key === 'q') requestScreen('menu');
        return;
      }
      if (jammed || RW.trans.isActive()) return;
      var L = RW.layout.get();
      if (name === 'move') { handleHover(p, L); return; }
      if (name === 'down') { handleTap(p, L); return; }
    }
  }

  function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  function tileSize() { return baseTile * cam.zoom; }

  function mapOrigin() {
    var L = RW.layout.get();
    var ts = tileSize();
    return { x: L.mapInner.x - cam.x * ts, y: L.mapInner.y - cam.y * ts, ts: ts };
  }

  function clampCam() {
    var L = RW.layout.get();
    if (!L.mapInner) return;
    var ts = tileSize();
    cam.x = RW.utils.clamp(cam.x, 0, Math.max(0, RW.terrain.W - L.mapInner.w / ts));
    cam.y = RW.utils.clamp(cam.y, 0, Math.max(0, RW.terrain.H - L.mapInner.h / ts));
  }

  function centerCam() {
    var L = RW.layout.get();
    var ts = tileSize();
    cam.x = Math.max(0, (RW.terrain.W - L.mapInner.w / ts) / 2);
    cam.y = Math.max(0, (RW.terrain.H - L.mapInner.h / ts) / 2);
  }

  function tileAt(p) {
    var o = mapOrigin();
    return { x: Math.floor((p.x - o.x) / o.ts), y: Math.floor((p.y - o.y) / o.ts) };
  }

  function handleHover(p, L) {
    if (inRect(p, L.mapInner)) {
      var t = tileAt(p);
      if (t.x >= 0 && t.y >= 0 && t.x < RW.terrain.W && t.y < RW.terrain.H) {
        hover.x = t.x; hover.y = t.y;
      } else { hover.x = -1; hover.y = -1; }
    } else { hover.x = -1; hover.y = -1; }
  }

  function handleTap(p, L) {
    if (inRect(p, L.mapInner)) {
      var t = tileAt(p);
      if (t.x < 0 || t.y < 0 || t.x >= RW.terrain.W || t.y >= RW.terrain.H) return;
      var picked = null;
      for (var i = 0; i < units.length; i++) {
        if (units[i].x === t.x && units[i].y === t.y) picked = units[i];
      }
      units.forEach(function (o) { o.selected = false; });
      focusedUnit = picked || null;
      selectedTile = { x: t.x, y: t.y };
      if (picked) picked.selected = true;
      var o = mapOrigin();
      RW.ui.flash(o.x + t.x * o.ts, o.y + t.y * o.ts, o.ts, o.ts);
      return;
    }
    var tool = hitTool(p, L);
    if (tool) { doTool(tool); return; }
    var act = hitAction(p, L);
    if (act) { doAction(act); return; }
  }

  function toolRects() {
    var L = RW.layout.get();
    var u = L.u;
    var inner = L.toolsInner;
    var pad = 4 * u;
    var cw = (inner.w - pad * 3) / 2;
    var rh = (inner.h - pad * 4) / 3;
    var out = [];
    var labels = ['放大', '缩小', '上移', '下移', '左移', '右移'];
    var acts = ['zoomIn', 'zoomOut', 'panUp', 'panDown', 'panLeft', 'panRight'];
    for (var i = 0; i < 6; i++) {
      var c = i % 2, r = Math.floor(i / 2);
      out.push({
        id: acts[i], label: labels[i],
        x: inner.x + pad + c * (cw + pad),
        y: inner.y + pad + r * (rh + pad),
        w: cw, h: rh
      });
    }
    return out;
  }

  function hitTool(p, L) {
    if (!inRect(p, L.toolsInner)) return null;
    var rs = toolRects();
    for (var i = 0; i < rs.length; i++) if (inRect(p, rs[i])) return { rect: rs[i] };
    return null;
  }

  function doTool(t) {
    var r = t.rect;
    RW.ui.flash(r.x, r.y, r.w, r.h);
    var step = 1.6;
    if (r.id === 'zoomIn') cam.zoom = RW.utils.clamp(cam.zoom * 1.25, 0.5, 2.4);
    else if (r.id === 'zoomOut') cam.zoom = RW.utils.clamp(cam.zoom / 1.25, 0.5, 2.4);
    else if (r.id === 'panUp') cam.y -= step;
    else if (r.id === 'panDown') cam.y += step;
    else if (r.id === 'panLeft') cam.x -= step;
    else if (r.id === 'panRight') cam.x += step;
    clampCam();
  }

  function actionRects() {
    var L = RW.layout.get();
    var u = L.u;
    var inner = L.ordersInner;
    var pad = 8 * u;

    if (focusedUnit) {
      var cmds = ['移动', '攻击', '待命', '侦察', '补给'];
      var bw = (inner.w - pad * 2 - (cmds.length - 1) * 6 * u) / cmds.length;
      var out = [];
      var bh = inner.h - pad * 2;
      for (var i = 0; i < cmds.length; i++) {
        out.push({
          id: 'cmd:' + cmds[i], label: cmds[i], kind: 'cmd',
          x: inner.x + pad + i * (bw + 6 * u),
          y: inner.y + pad, w: bw, h: bh
        });
      }
      return out;
    }

    if (selectedTile) {
      var bw2 = Math.min(inner.w * 0.4, 180 * u);
      var bh2 = inner.h - pad * 2;
      return [{
        id: 'mark', label: '标记位置', kind: 'mark',
        x: inner.x + pad, y: inner.y + pad, w: bw2, h: bh2
      }];
    }
    return [];
  }

  function hitAction(p, L) {
    if (!inRect(p, L.ordersInner)) return null;
    var rs = actionRects();
    for (var i = 0; i < rs.length; i++) if (inRect(p, rs[i])) return { rect: rs[i] };
    return null;
  }

  function doAction(a) {
    var r = a.rect;
    RW.ui.flash(r.x, r.y, r.w, r.h);
    if (r.id === 'mark' && selectedTile) {
      var found = false;
      for (var i = 0; i < marks.length; i++) {
        if (marks[i].x === selectedTile.x && marks[i].y === selectedTile.y) { marks.splice(i, 1); found = true; break; }
      }
      if (!found) marks.push({ x: selectedTile.x, y: selectedTile.y });
    }
  }

  function start() { last = performance.now(); requestAnimationFrame(loop); }

  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    var t = now / 1000;

    RW.fx.update(dt);
    RW.trans.update(dt);
    RW.ui.updateFlashes(dt);
    processPending();

    if (screen === 'boot') {
      RW.boot.update(dt);
      clearContent(); RW.boot.draw(cx);
      if (RW.boot.isDone()) requestScreen('menu');
    } else if (screen === 'menu') {
      RW.menu.update(dt);
      clearContent(); RW.menu.draw(cx);
    } else if (screen === 'brief') {
      briefTime += dt;
      clearContent(); drawBrief(cx, t);
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

  function drawBrief(c, t) {
    var s = RW.fx.size();
    var u = s.dpr, w = s.W, h = s.H;
    var L = LEVELS[levelIndex];
    var rv = RW.trans.reveal();
    var sc = Math.max(2, Math.round(3 * u / 2));

    RW.fx.frame(c, 26 * u, 26 * u, w - 52 * u, h - 52 * u, { color: '#005500' });
    RW.pixel.drawCentered(c, 'MISSION BRIEFING', w / 2, h * 0.16, sc * 1.5, '#33ff33', { limit: Math.ceil(16 * rv) });

    RW.pixel.drawCentered(c, L.code, w / 2, h * 0.30, sc * 2.2, '#33ff33', { limit: Math.ceil(8 * briefTime * 2) });
    RW.fx.phosphorText(c, L.en + '  ·  ' + L.cn, w / 2, h * 0.30 + sc * 2.2 * 7 + 40 * u, 13 * u,
      { align: 'center', color: C.mid2, alpha: RW.utils.clamp(briefTime - 0.5, 0, 1) });

    var baseY = h * 0.52, lineH = 26 * u;
    var a1 = RW.utils.clamp(briefTime - 0.9, 0, 1);
    if (a1 > 0) {
      RW.fx.phosphorText(c, '任务目标', w / 2, baseY, 12 * u, { align: 'center', color: C.mid, alpha: a1 });
      RW.fx.phosphorText(c, L.goal, w / 2, baseY + lineH, 14 * u, { align: 'center', color: C.hi, alpha: a1 });
    }
    for (var i = 0; i < L.brief.length; i++) {
      var a = RW.utils.clamp(briefTime - 1.6 - i * 0.35, 0, 1);
      if (a <= 0) continue;
      RW.fx.phosphorText(c, '· ' + L.brief[i], w / 2, baseY + lineH * (2.6 + i), 12 * u,
        { align: 'center', color: C.mid2, alpha: a });
    }

    var ready = briefTime > 1.2 + L.brief.length * 0.35 + 0.9;
    if (ready && Math.floor(t * 2) % 2 === 0) {
      var tip = 'PRESS ANY KEY TO DEPLOY';
      var tsc = Math.max(1, Math.round(1.8 * u));
      RW.pixel.draw(c, tip, w / 2 - RW.pixel.measure(tip, tsc) / 2, h - 60 * u, tsc, '#00aa00');
    }

    RW.ui.drawFlashes(c);
    RW.trans.drawOverlay(c, w, h, u);
  }

  function panel(rect, en, cn, opt) {
    opt = opt || {};
    var u = RW.layout.get().u || 1;
    var hh = 20 * u;
    cx.fillStyle = opt.fill || 'rgba(0,14,0,0.75)';
    cx.fillRect(rect.x, rect.y, rect.w, rect.h);
    cx.fillStyle = 'rgba(0,60,0,0.85)';
    cx.fillRect(rect.x, rect.y, rect.w, hh);
    var psc = Math.max(2, Math.round(2 * u));
    RW.pixel.draw(cx, en, rect.x + 7 * u, rect.y + (hh - RW.pixel.height(psc)) / 2, psc, C.hi);
    if (cn) RW.fx.phosphorText(cx, cn, rect.x + rect.w - 7 * u, rect.y + hh * 0.72, 9 * u, { align: 'right', color: C.dim, glow: false });
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

  function plainPanel(rect, opt) {
    opt = opt || {};
    cx.fillStyle = opt.fill || 'rgba(0,12,0,0.8)';
    cx.fillRect(rect.x, rect.y, rect.w, rect.h);
    RW.fx.frame(cx, rect.x, rect.y, rect.w, rect.h, { color: opt.color || C.dark });
    var u = RW.layout.get().u || 1;
    var L = Math.min(7 * u, rect.w * 0.05);
    cx.strokeStyle = C.hi; cx.lineWidth = 1.4;
    var cs = [[rect.x, rect.y, 1, 1], [rect.x + rect.w, rect.y, -1, 1], [rect.x, rect.y + rect.h, 1, -1], [rect.x + rect.w, rect.y + rect.h, -1, -1]];
    for (var i = 0; i < cs.length; i++) {
      var q = cs[i];
      cx.beginPath();
      cx.moveTo(q[0], q[1] + q[3] * L); cx.lineTo(q[0], q[1]); cx.lineTo(q[0] + q[2] * L, q[1]);
      cx.stroke();
    }
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h, u: u };
  }

  function drawPlay(t) {
    var L = RW.layout.get();
    clearContent();
    drawMapPanel(L, t);
    drawToolsPanel(L);
    drawOrdersPanel(L);
    drawSidePanel(L, t);
    if (jammed) drawJamOverlay(L, t);
    RW.trans.drawOverlay(cx, L.W, L.H, L.u);
    RW.ui.drawFlashes(cx);
  }

  function drawMapPanel(L, t) {
    var inner = panel(L.map, 'TACTICAL MAP', '地图显示');
    clipAndDraw(inner, function () {
      var o = mapOrigin();
      drawTerrainLayer(o);
      drawGridLayer(o);
      drawContourLayer(o);
      drawWaterLayer(o, t);
      drawMarks(o);
      drawHoverTile(o);
      for (var i = 0; i < units.length; i++) {
        RW.unit.draw(cx, units[i], { size: o.ts, originX: o.x, originY: o.y }, RW.terrain, t);
      }
      drawMapInstruments(inner, o);
    });
  }

  function clipAndDraw(inner, fn) {
    cx.save();
    cx.beginPath(); cx.rect(inner.x, inner.y, inner.w, inner.h); cx.clip();
    fn();
    cx.restore();
  }

  function drawTerrainLayer(o) {
    for (var y = 0; y < RW.terrain.H; y++) for (var x = 0; x < RW.terrain.W; x++) {
      var h = RW.terrain.heightAt(x, y);
      var px = o.x + x * o.ts, py = o.y + y * o.ts;
      var g;
      if (h < 0.20) g = 10; else if (h < 0.30) g = 30; else if (h < 0.42) g = 52;
      else if (h < 0.55) g = 76; else if (h < 0.70) g = 104; else if (h < 0.85) g = 134; else g = 166;
      cx.fillStyle = 'rgb(0,' + g + ',0)';
      cx.fillRect(px, py, o.ts + 0.6, o.ts + 0.6);
    }
  }

  function drawGridLayer(o) {
    var tw = RW.terrain.W, th = RW.terrain.H, x, y, px, py;
    cx.strokeStyle = 'rgba(0,190,0,0.14)'; cx.lineWidth = 1;
    for (x = 0; x <= tw; x++) { px = Math.round(o.x + x * o.ts) + 0.5; cx.beginPath(); cx.moveTo(px, o.y); cx.lineTo(px, o.y + th * o.ts); cx.stroke(); }
    for (y = 0; y <= th; y++) { py = Math.round(o.y + y * o.ts) + 0.5; cx.beginPath(); cx.moveTo(o.x, py); cx.lineTo(o.x + tw * o.ts, py); cx.stroke(); }
    cx.strokeStyle = 'rgba(51,255,51,0.28)';
    for (x = 0; x <= tw; x += 5) { px = Math.round(o.x + x * o.ts) + 0.5; cx.beginPath(); cx.moveTo(px, o.y); cx.lineTo(px, o.y + th * o.ts); cx.stroke(); }
    for (y = 0; y <= th; y += 5) { py = Math.round(o.y + y * o.ts) + 0.5; cx.beginPath(); cx.moveTo(o.x, py); cx.lineTo(o.x + tw * o.ts, py); cx.stroke(); }
  }

  function drawContourLayer(o) {
    var groups = RW.terrain.contours();
    for (var gi = 0; gi < groups.length; gi++) {
      var grp = groups[gi];
      cx.strokeStyle = 'rgba(140,255,140,' + (0.22 + gi * 0.14).toFixed(2) + ')';
      cx.lineWidth = gi >= 3 ? 1.6 : 1;
      cx.beginPath();
      for (var i = 0; i < grp.segs.length; i++) {
        var sg = grp.segs[i], px = o.x + sg.x * o.ts, py = o.y + sg.y * o.ts;
        if (sg.vert) { cx.moveTo(px, py - o.ts * 0.42); cx.lineTo(px, py + o.ts * 0.42); }
        else { cx.moveTo(px - o.ts * 0.42, py); cx.lineTo(px + o.ts * 0.42, py); }
      }
      cx.stroke();
    }
  }

  function drawWaterLayer(o, t) {
    for (var y = 0; y < RW.terrain.H; y++) for (var x = 0; x < RW.terrain.W; x++) {
      if (!RW.terrain.isWater(x, y)) continue;
      var px = o.x + x * o.ts, py = o.y + y * o.ts;
      cx.fillStyle = 'rgb(0,22,40)'; cx.fillRect(px, py, o.ts, o.ts);
      cx.fillStyle = 'rgba(0,170,255,0.14)'; cx.fillRect(px, py, o.ts, o.ts);
      cx.strokeStyle = 'rgba(90,205,255,0.5)'; cx.lineWidth = 1;
      for (var k = 0; k < 3; k++) {
        var ph = (t * 0.6 + k * 0.33 + (x + y) * 0.18) % 1;
        var wy = py + ph * o.ts;
        var inset = Math.abs(ph - 0.5) * o.ts * 0.5;
        cx.beginPath(); cx.moveTo(px + inset, wy); cx.lineTo(px + o.ts - inset, wy); cx.stroke();
      }
    }
  }

  function drawMarks(o) {
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      var px = o.x + (m.x + 0.5) * o.ts, py = o.y + (m.y + 0.5) * o.ts;
      var r = o.ts * 0.28;
      cx.strokeStyle = '#33ff33'; cx.lineWidth = 1.6;
      cx.beginPath(); cx.arc(px, py, r, 0, Math.PI * 2); cx.stroke();
      cx.beginPath();
      cx.moveTo(px - r * 1.5, py); cx.lineTo(px - r * 0.6, py);
      cx.moveTo(px + r * 0.6, py); cx.lineTo(px + r * 1.5, py);
      cx.moveTo(px, py - r * 1.5); cx.lineTo(px, py - r * 0.6);
      cx.moveTo(px, py + r * 0.6); cx.lineTo(px, py + r * 1.5);
      cx.stroke();
    }
  }

  function drawHoverTile(o) {
    if (hover.x < 0 || hover.y < 0) return;
    var px = o.x + hover.x * o.ts, py = o.y + hover.y * o.ts;
    cx.strokeStyle = 'rgba(51,255,51,0.85)'; cx.lineWidth = 1.4;
    cx.strokeRect(px + 0.5, py + 0.5, o.ts, o.ts);
    var m = Math.max(3, o.ts * 0.22);
    cx.beginPath();
    cx.moveTo(px, py + m); cx.lineTo(px, py); cx.lineTo(px + m, py);
    cx.moveTo(px + o.ts - m, py); cx.lineTo(px + o.ts, py); cx.lineTo(px + o.ts, py + m);
    cx.moveTo(px + o.ts, py + o.ts - m); cx.lineTo(px + o.ts, py + o.ts); cx.lineTo(px + o.ts - m, py + o.ts);
    cx.moveTo(px + m, py + o.ts); cx.lineTo(px, py + o.ts); cx.lineTo(px, py + o.ts - m);
    cx.stroke();
  }

  function drawMapInstruments(inner, o) {
    var u = RW.layout.get().u;
    var x0 = Math.max(0, Math.floor(cam.x));
    var y0 = Math.max(0, Math.floor(cam.y));
    var x1 = Math.min(RW.terrain.W - 1, Math.floor(cam.x + inner.w / o.ts));
    var y1 = Math.min(RW.terrain.H - 1, Math.floor(cam.y + inner.h / o.ts));

    RW.fx.phosphorText(cx, 'VIEW  ' + String.fromCharCode(65 + (y0 % 26)) + '-' + (x0 + 1) + ' ~ ' +
      String.fromCharCode(65 + (y1 % 26)) + '-' + (x1 + 1),
      inner.x + 8 * u, inner.y + 14 * u, 8 * u, { color: C.dim });

    RW.fx.phosphorText(cx, 'ZOOM  x' + cam.zoom.toFixed(1),
      inner.x + inner.w - 8 * u, inner.y + 14 * u, 8 * u, { align: 'right', color: C.dim });

    var sx = inner.x + 8 * u, sy = inner.y + inner.h - 9 * u;
    cx.strokeStyle = C.mid2; cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(sx, sy); cx.lineTo(sx + o.ts * 3, sy);
    cx.moveTo(sx, sy - 3 * u); cx.lineTo(sx, sy + 3 * u);
    cx.moveTo(sx + o.ts * 3, sy - 3 * u); cx.lineTo(sx + o.ts * 3, sy + 3 * u);
    cx.stroke();
    RW.fx.phosphorText(cx, '3 GRID', sx + o.ts * 3 + 6 * u, sy + 3 * u, 7.5 * u, { color: C.dim });
  }

  function drawToolsPanel(L) {
    var inner = plainPanel(L.tools);
    var rs = toolRects();
    var u = L.u;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      RW.fx.frame(cx, r.x, r.y, r.w, r.h, { color: C.dark, fill: 'rgba(0,40,0,0.55)' });
      RW.fx.phosphorText(cx, r.label, r.x + r.w / 2, r.y + r.h * 0.62, 9 * u, { align: 'center', color: C.mid });
    }
  }

  function drawOrdersPanel(L) {
    var inner = plainPanel(L.orders);
    var u = L.u;
    var rs = actionRects();

    if (rs.length === 0) {
      RW.fx.phosphorText(cx, '点击地块或单位', inner.x + inner.w / 2, inner.y + inner.h * 0.44,
        10 * u, { align: 'center', color: C.dimmest });
      RW.fx.phosphorText(cx, '选中后此处显示可执行操作', inner.x + inner.w / 2, inner.y + inner.h * 0.62,
        8 * u, { align: 'center', color: C.dimmest });
      return;
    }

    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      var isMark = r.kind === 'mark';
      var marked = false;
      if (isMark && selectedTile) {
        for (var k = 0; k < marks.length; k++) {
          if (marks[k].x === selectedTile.x && marks[k].y === selectedTile.y) { marked = true; break; }
        }
      }
      var col = isMark ? (marked ? C.hi : C.mid) : C.mid;
      RW.fx.frame(cx, r.x, r.y, r.w, r.h, { color: isMark ? C.hi : C.dark, fill: 'rgba(0,40,0,0.6)' });
      RW.fx.phosphorText(cx, marked ? '取消标记' : r.label, r.x + r.w / 2, r.y + r.h * 0.60, 10 * u,
        { align: 'center', color: col });
    }

    RW.fx.phosphorText(cx, focusedUnit ? '单位指令' : '地块操作',
      inner.x + inner.w - 8 * u, inner.y + inner.h - 6 * u, 8 * u,
      { align: 'right', color: C.dimmest });
  }

  function drawSidePanel(L, t) {
    var inner = panel(L.side, 'DETAIL', '详情展示');
    var u = L.u;
    var x = inner.x + 10 * u, w = inner.w - 20 * u, y = inner.y + 12 * u;

    if (focusedUnit) {
      var un = RW.unit.TYPES[focusedUnit.type] || {};
      RW.fx.phosphorText(cx, focusedUnit.name, x, y, 13 * u, { color: C.hi, bold: true });
      y += 18 * u;
      RW.fx.phosphorText(cx, '代号 ' + focusedUnit.id.toUpperCase().slice(0, 8), x, y, 9 * u, { color: C.dim });
      y += 20 * u;
      y = drawStatBar('剩余人数', focusedUnit.strength, y, x, w, u, C.hi);
      y = drawStatBar('剩余物资', focusedUnit.supply, y, x, w, u, C.mid);
      y += 6 * u;
      RW.fx.phosphorText(cx, '战力上限  ' + (un.combat || 0), x, y, 9.5 * u, { color: C.mid2 }); y += 16 * u;
      RW.fx.phosphorText(cx, '机动范围  ' + (un.move || 0), x, y, 9.5 * u, { color: C.mid2 }); y += 20 * u;
      RW.fx.phosphorText(cx, '状态', x, y, 10 * u, { color: C.mid }); y += 15 * u;
      if (focusedUnit.buffs.length === 0) {
        RW.fx.phosphorText(cx, '  正常', x, y, 9.5 * u, { color: C.dim }); y += 15 * u;
      } else {
        focusedUnit.buffs.forEach(function (b) {
          RW.fx.phosphorText(cx, '  ' + b, x, y, 9.5 * u, { color: C.hi }); y += 15 * u;
        });
      }
      y += 8 * u;
      RW.fx.frame(cx, x, y, w, 1, { color: C.dimmest }); y += 14 * u;
      RW.fx.phosphorText(cx, '所在格  ' + tileName(focusedUnit.x, focusedUnit.y), x, y, 9.5 * u, { color: C.mid2 }); y += 15 * u;
      RW.fx.phosphorText(cx, '海拔    ' + Math.round(RW.terrain.heightAt(focusedUnit.x, focusedUnit.y) * 100) + ' m', x, y, 9.5 * u, { color: C.mid2 }); y += 15 * u;
      RW.fx.phosphorText(cx, '地貌    ' + (RW.terrain.isWater(focusedUnit.x, focusedUnit.y) ? '水域' : '陆地'), x, y, 9.5 * u, { color: C.mid2 });
    } else if (selectedTile) {
      RW.fx.phosphorText(cx, '地块情报', x, y, 13 * u, { color: C.hi, bold: true }); y += 20 * u;
      RW.fx.phosphorText(cx, '坐标  ' + tileName(selectedTile.x, selectedTile.y), x, y, 10 * u, { color: C.mid2 }); y += 17 * u;
      RW.fx.phosphorText(cx, '海拔  ' + Math.round(RW.terrain.heightAt(selectedTile.x, selectedTile.y) * 100) + ' m', x, y, 10 * u, { color: C.mid2 }); y += 17 * u;
      RW.fx.phosphorText(cx, '地貌  ' + (RW.terrain.isWater(selectedTile.x, selectedTile.y) ? '水域' : '陆地'), x, y, 10 * u, { color: C.mid2 }); y += 17 * u;
      RW.fx.phosphorText(cx, '通行  ' + (RW.terrain.isWater(selectedTile.x, selectedTile.y) ? '受限' : '正常'), x, y, 10 * u, { color: C.mid2 }); y += 22 * u;
      var isMarked = false;
      for (var k = 0; k < marks.length; k++) {
        if (marks[k].x === selectedTile.x && marks[k].y === selectedTile.y) { isMarked = true; break; }
      }
      if (isMarked) RW.fx.phosphorText(cx, '已标记', x, y, 10 * u, { color: C.hi });
    } else if (hover.x >= 0) {
      RW.fx.phosphorText(cx, '指针指向', x, y, 11 * u, { color: C.mid }); y += 18 * u;
      RW.fx.phosphorText(cx, '坐标  ' + tileName(hover.x, hover.y), x, y, 9.5 * u, { color: C.dim }); y += 16 * u;
      RW.fx.phosphorText(cx, '海拔  ' + Math.round(RW.terrain.heightAt(hover.x, hover.y) * 100) + ' m', x, y, 9.5 * u, { color: C.dim });
    } else {
      RW.fx.phosphorText(cx, '待选目标', inner.x + inner.w / 2, inner.y + inner.h * 0.34, 11 * u,
        { align: 'center', color: C.dimmest });
      RW.fx.phosphorText(cx, '点击地块查看情报', inner.x + inner.w / 2, inner.y + inner.h * 0.48, 9 * u,
        { align: 'center', color: C.dimmest });
      RW.fx.phosphorText(cx, '点击单位查看状态', inner.x + inner.w / 2, inner.y + inner.h * 0.56, 9 * u,
        { align: 'center', color: C.dimmest });
    }

    RW.fx.phosphorText(cx, '[ESC] 返回主菜单', inner.x + inner.w / 2, inner.y + inner.h - 8 * u, 8.5 * u,
      { align: 'center', color: C.dimmest });
  }

  function tileName(x, y) { return String.fromCharCode(65 + (y % 26)) + '-' + (x + 1); }

  function drawStatBar(label, val, y, x, w, u, color) {
    RW.fx.phosphorText(cx, label, x, y, 9.5 * u, { color: C.mid2 });
    RW.fx.phosphorText(cx, Math.round(val) + '%', x + w, y, 9.5 * u, { align: 'right', color: color });
    y += 6 * u;
    var bh = 9 * u;
    cx.fillStyle = 'rgba(0,40,0,0.9)'; cx.fillRect(x, y, w, bh);
    cx.fillStyle = color; cx.fillRect(x + 1, y + 1, (w - 2) * (val / 100), bh - 2);
    RW.fx.frame(cx, x, y, w, bh, { color: C.dark });
    return y + bh + 12 * u;
  }

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
    RW.pixel.drawCentered(cx, 'SIGNAL LOST', L.W / 2, by + 18 * u, Math.max(2, Math.round(3 * u)), C.hi);
    RW.fx.phosphorText(cx, '战场信号被屏蔽', L.W / 2, by + 58 * u, 11 * u, { align: 'center', color: C.mid2 });
    if (Math.floor(t * 2) % 2 === 0) RW.fx.phosphorText(cx, '正在重新建立链路 . . .', L.W / 2, by + 78 * u, 10 * u, { align: 'center', color: C.mid });
  }

  return {
    init: init, start: start, goto: goto, requestScreen: requestScreen, showModal: showModal,
    screen: function () { return screen; },
    level: function () { return LEVELS[levelIndex]; },
    setJam: function (on) { jammed = !!on; RW.fx.jam(jammed ? 0.85 : 0); },
    isJammed: function () { return jammed; },
    centerCam: centerCam
  };
})();
