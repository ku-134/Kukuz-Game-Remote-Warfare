/* screens/menu.js —— 开始界面（主菜单 + 显示设置）
   交互层：菜单项、设置滑条、固定返回按钮。显示层：标题、版本、提示。
   完整实现见本地源码；此处保证核心结构可运行。 */
RW.menu = (function () {
  'use strict';

  var ITEMS = [
    { id: 'start', label: '开始作战' },
    { id: 'settings', label: '显示设置' },
    { id: 'about', label: '关于本系统' }
  ];

  var SETTING_DEFS = [
    { key: 'intensity', label: '磷光强度' },
    { key: 'scanline', label: '扫描线' },
    { key: 'glow', label: '辉光' },
    { key: 'brightness', label: '亮度' }
  ];

  var mode = 'main', index = 0, setIndex = 0, t = 0;

  function reset() { mode = 'main'; index = 0; setIndex = 0; t = 0; }

  function layout() {
    var s = RW.fx.size();
    var u = s.dpr;
    var pad = 26 * u;
    return {
      u: u, w: s.W, h: s.H, x: pad, y: pad,
      innerW: s.W - pad * 2, innerH: s.H - pad * 2,
      footY: s.H - pad - 26 * u
    };
  }

  function menuRects() {
    var L = layout();
    var w = Math.min(L.innerW * 0.62, 460 * L.u);
    var hRow = 38 * L.u;
    var x = (L.w - w) / 2, y = L.h * 0.46;
    var out = [];
    for (var i = 0; i < ITEMS.length; i++) out.push({ x: x, y: y + i * (hRow + 8 * L.u), w: w, h: hRow, index: i });
    return out;
  }

  function settingRects() {
    var L = layout();
    var w = Math.min(L.innerW * 0.72, 520 * L.u);
    var hRow = 44 * L.u;
    var x = (L.w - w) / 2, y = L.h * 0.30;
    var out = [];
    for (var i = 0; i < SETTING_DEFS.length; i++) out.push({ x: x, y: y + i * (hRow + 12 * L.u), w: w, h: hRow, index: i });
    return out;
  }

  function backRect() {
    var L = layout();
    return { x: L.x + 6 * L.u, y: L.footY - 22 * L.u, w: 96 * L.u, h: 30 * L.u };
  }

  function update(dt) { t += dt; }
  function hit(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  function onPointerDown(p) {
    if (mode === 'main') {
      var rs = menuRects();
      for (var i = 0; i < rs.length; i++) if (hit(p, rs[i])) { index = i; choose(); return; }
    } else {
      if (hit(p, backRect())) { mode = 'main'; RW.fx.burst(0.4); return; }
      var sr = settingRects();
      for (var k = 0; k < sr.length; k++) {
        if (hit(p, sr[k])) {
          setIndex = k;
          var def = SETTING_DEFS[k];
          var mid = sr[k].x + sr[k].w * 0.6;
          RW.settings.set(def.key, RW.settings.get(def.key) + (p.x < mid ? -0.1 : 0.1));
          RW.fx.burst(0.2);
          return;
        }
      }
    }
  }

  function onKey(k) {
    if (mode === 'main') {
      if (k === 'arrowup' || k === 'w') index = (index - 1 + ITEMS.length) % ITEMS.length;
      if (k === 'arrowdown' || k === 's') index = (index + 1) % ITEMS.length;
      if (k === 'enter' || k === ' ') choose();
    } else {
      if (k === 'arrowup' || k === 'w') setIndex = (setIndex - 1 + SETTING_DEFS.length) % SETTING_DEFS.length;
      if (k === 'arrowdown' || k === 's') setIndex = (setIndex + 1) % SETTING_DEFS.length;
      var def = SETTING_DEFS[setIndex];
      if (k === 'arrowleft' || k === 'a') RW.settings.set(def.key, RW.settings.get(def.key) - 0.1);
      if (k === 'arrowright' || k === 'd') RW.settings.set(def.key, RW.settings.get(def.key) + 0.1);
      if (k === 'escape' || k === 'enter') mode = 'main';
    }
  }

  function choose() {
    var id = ITEMS[index].id;
    RW.fx.burst(0.9);
    if (id === 'start') RW.engine.goto('play');
    else if (id === 'settings') mode = 'settings';
    else RW.engine.showModal('关于本系统', [
      'REMOTE WARFARE  //  远程战争',
      'PHOSPHOR SYSTEMS  PHC-1983  ·  rev ' + RW.version,
      '',
      '一套用于远程战术指挥的旧式终端系统。',
      '本机仅提供指挥界面，作战细节不予公开。'
    ]);
  }

  function draw(c) {
    var L = layout();
    c.fillStyle = '#010401'; c.fillRect(0, 0, L.w, L.h);
    RW.fx.frame(c, L.x, L.y, L.innerW, L.innerH, { color: '#005500' });
    RW.fx.sweep(c, t, L.w, L.h);
    if (mode === 'main') drawMain(c, L); else drawSettings(c, L);
  }

  function drawMain(c, L) {
    var u = L.u, cx = L.w / 2;
    var titleSize = Math.min(46 * u, L.w * 0.062);
    RW.fx.phosphorText(c, 'R E M O T E   W A R F A R E', cx, L.h * 0.30, titleSize, { align: 'center', bold: true });
    RW.fx.phosphorText(c, '远 程 战 争', cx, L.h * 0.30 + 26 * u, 15 * u, { align: 'center', color: '#00aa00' });
    RW.fx.frame(c, L.w * 0.22, L.h * 0.30 + 38 * u, L.w * 0.56, 1, { color: '#007700' });

    var rs = menuRects();
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      if (i === index) {
        RW.fx.invert(c, r.x, r.y, r.w, r.h);
        RW.fx.phosphorText(c, '> ' + ITEMS[i].label, r.x + 18 * u, r.y + r.h * 0.68, 15 * u, { color: '#00ff00', glow: false });
      } else {
        RW.fx.frame(c, r.x, r.y, r.w, r.h, { color: '#006600' });
        RW.fx.phosphorText(c, '  ' + ITEMS[i].label, r.x + 18 * u, r.y + r.h * 0.68, 15 * u, { color: '#00aa00' });
      }
    }

    RW.fx.phosphorText(c, '[↑↓/WS] 选择   [ENTER] 确认', L.x + 8 * u, L.footY, 11 * u, { color: '#008800' });
    RW.fx.phosphorText(c, 'v' + RW.version + '  ·  PHOSPHOR SYSTEMS 1983', L.x + L.innerW - 8 * u, L.footY, 11 * u, { align: 'right', color: '#008800' });
  }

  function drawSettings(c, L) {
    var u = L.u, cx = L.w / 2;
    RW.fx.phosphorText(c, 'D I S P L A Y   S E T T I N G S', cx, L.h * 0.18, 20 * u, { align: 'center', bold: true });
    RW.fx.phosphorText(c, '显示设置 · 即时生效，不影响运行', cx, L.h * 0.18 + 20 * u, 12 * u, { align: 'center', color: '#00aa00' });

    var rs = settingRects();
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i], selected = i === setIndex;
      var val = RW.settings.get(SETTING_DEFS[i].key);
      var col = selected ? '#33ff33' : '#008800';
      RW.fx.phosphorText(c, (selected ? '> ' : '  ') + SETTING_DEFS[i].label, r.x, r.y + 14 * u, 14 * u, { color: col });

      var bx = r.x + 130 * u, bw = r.w - 200 * u, by = r.y + 6 * u, bh = 16 * u;
      RW.fx.frame(c, bx, by, bw, bh, { color: selected ? '#00cc00' : '#005500' });
      c.fillStyle = selected ? '#33ff33' : '#00aa00';
      c.fillRect(bx + 1, by + 1, (bw - 2) * val, bh - 2);
      RW.fx.phosphorText(c, Math.round(val * 100) + '%', r.x + r.w, r.y + 14 * u, 13 * u, { align: 'right', color: col });
    }

    var br = backRect();
    RW.fx.frame(c, br.x, br.y, br.w, br.h, { color: '#00aa00' });
    RW.fx.phosphorText(c, '< 返回', br.x + br.w / 2, br.y + br.h * 0.68, 14 * u, { align: 'center', color: '#33ff33' });
    RW.fx.phosphorText(c, '[←→/AD] 调整   [ESC] 返回', L.x + L.innerW * 0.5, L.footY, 11 * u, { align: 'center', color: '#008800' });
  }

  return { reset: reset, update: update, draw: draw, onPointerDown: onPointerDown, onKey: onKey, mode: function () { return mode; } };
})();
