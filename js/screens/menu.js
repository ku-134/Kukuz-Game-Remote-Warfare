/* screens/menu.js —— 开始界面与设置
   层级：主菜单 -> 设置 -> 显示设置（子界面）
   像素字体为主；文字按 RW.trans.reveal() 逐步写出；点击有闪烁反馈。
   完整实现见本地源码。 */
RW.menu = (function () {
  'use strict';

  var MAIN = [
    { id: 'start',    en: 'START MISSION', cn: '开始作战' },
    { id: 'settings', en: 'SETTINGS',      cn: '设置' },
    { id: 'about',    en: 'ABOUT SYSTEM',  cn: '关于本系统' }
  ];

  var SECTIONS = [
    { id: 'display', en: 'DISPLAY',  cn: '显示设置', ready: true },
    { id: 'audio',   en: 'AUDIO',    cn: '音频',     ready: false },
    { id: 'input',   en: 'CONTROLS', cn: '操作',     ready: false },
    { id: 'back',    en: 'BACK',     cn: '返回',     ready: true }
  ];

  var mode = 'main', index = 0, setIndex = 0, t = 0;
  var hint = '', hintT = 0, scroll = 0;
  var COLS = 2, ROWS = 6, PER_PAGE = COLS * ROWS;

  function reset() { mode = 'main'; index = 0; setIndex = 0; t = 0; hint = ''; hintT = 0; scroll = 0; }

  function layout() {
    var s = RW.fx.size();
    var u = s.dpr, pad = 26 * u;
    return {
      u: u, w: s.W, h: s.H, x: pad, y: pad,
      innerW: s.W - pad * 2, innerH: s.H - pad * 2,
      footY: s.H - pad - 26 * u
    };
  }

  function mainRects() {
    var L = layout();
    var w = Math.min(L.innerW * 0.52, 520 * L.u);
    var hRow = 46 * L.u;
    var x = (L.w - w) / 2, y = L.h * 0.44;
    var out = [];
    for (var i = 0; i < MAIN.length; i++) out.push({ x: x, y: y + i * (hRow + 10 * L.u), w: w, h: hRow });
    return out;
  }

  function sectionRects() {
    var L = layout();
    var w = Math.min(L.innerW * 0.52, 520 * L.u);
    var hRow = 44 * L.u;
    var x = (L.w - w) / 2, y = L.h * 0.34;
    var out = [];
    for (var i = 0; i < SECTIONS.length; i++) out.push({ x: x, y: y + i * (hRow + 10 * L.u), w: w, h: hRow });
    return out;
  }

  function defs() { return RW.settings.DEFS; }
  function totalPages() { return Math.ceil(defs().length / PER_PAGE); }

  function sliderRects() {
    var L = layout();
    var u = L.u;
    var top = L.h * 0.20;
    var bottom = L.footY - 24 * u;
    var rowH = (bottom - top) / ROWS;
    var colW = (L.innerW - 30 * u) / COLS;
    var out = [];
    var start = scroll * PER_PAGE;
    for (var i = 0; i < PER_PAGE; i++) {
      var gi = start + i;
      if (gi >= defs().length) break;
      var c = i % COLS, r = Math.floor(i / COLS);
      out.push({ gi: gi, i: i, x: L.x + c * (colW + 30 * u), y: top + r * rowH, w: colW, h: rowH - 6 * u });
    }
    return out;
  }

  function backRect() {
    var L = layout();
    return { x: L.x + 6 * L.u, y: L.footY - 20 * L.u, w: 110 * L.u, h: 30 * L.u };
  }

  function resetRect() {
    var L = layout();
    return { x: L.x + L.innerW - 6 * L.u - 130 * L.u, y: L.footY - 20 * L.u, w: 130 * L.u, h: 30 * L.u };
  }

  function update(dt) { t += dt; if (hintT > 0) hintT -= dt; }
  function flashHint(msg) { hint = msg; hintT = 1.4; }
  function hit(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  function onPointerDown(p) {
    if (mode === 'main') {
      var rs = mainRects();
      for (var i = 0; i < rs.length; i++) {
        if (hit(p, rs[i])) { index = i; RW.ui.flash(rs[i].x, rs[i].y, rs[i].w, rs[i].h); chooseMain(); return; }
      }
    } else if (mode === 'settings') {
      var sr = sectionRects();
      for (var k = 0; k < sr.length; k++) {
        if (hit(p, sr[k])) { index = k; RW.ui.flash(sr[k].x, sr[k].y, sr[k].w, sr[k].h); chooseSection(); return; }
      }
    } else {
      if (hit(p, backRect())) { RW.ui.flash(backRect().x, backRect().y, backRect().w, backRect().h); mode = 'settings'; index = 0; return; }
      if (hit(p, resetRect())) { RW.ui.flash(resetRect().x, resetRect().y, resetRect().w, resetRect().h); RW.settings.reset(); flashHint('已恢复默认'); return; }
      var sl = sliderRects();
      for (var m = 0; m < sl.length; m++) {
        if (hit(p, sl[m])) {
          setIndex = sl[m].i;
          var def = defs()[sl[m].gi];
          var mid = sl[m].x + sl[m].w * 0.58;
          RW.settings.set(def.key, RW.settings.get(def.key) + (p.x < mid ? -0.08 : 0.08));
          RW.ui.flash(sl[m].x, sl[m].y, sl[m].w, sl[m].h);
          return;
        }
      }
    }
  }

  function onKey(k) {
    if (mode === 'main') {
      if (k === 'arrowup' || k === 'w') index = (index - 1 + MAIN.length) % MAIN.length;
      if (k === 'arrowdown' || k === 's') index = (index + 1) % MAIN.length;
      if (k === 'enter' || k === ' ') {
        var r = mainRects()[index];
        if (r) RW.ui.flash(r.x, r.y, r.w, r.h);
        chooseMain();
      }
    } else if (mode === 'settings') {
      if (k === 'arrowup' || k === 'w') index = (index - 1 + SECTIONS.length) % SECTIONS.length;
      if (k === 'arrowdown' || k === 's') index = (index + 1) % SECTIONS.length;
      if (k === 'enter' || k === ' ') {
        var sr = sectionRects()[index];
        if (sr) RW.ui.flash(sr.x, sr.y, sr.w, sr.h);
        chooseSection();
      }
      if (k === 'escape') mode = 'main';
    } else {
      var n = defs().length;
      if (k === 'arrowup' || k === 'w') setIndex = (setIndex - 1 + n) % n;
      if (k === 'arrowdown' || k === 's') setIndex = (setIndex + 1) % n;
      if (k === 'arrowleft' || k === 'a') RW.settings.set(defs()[setIndex].key, RW.settings.get(defs()[setIndex].key) - 0.06);
      if (k === 'arrowright' || k === 'd') RW.settings.set(defs()[setIndex].key, RW.settings.get(defs()[setIndex].key) + 0.06);
      if (k === 'escape') mode = 'settings';
      if (k === 'pageup') scroll = (scroll - 1 + totalPages()) % totalPages();
      if (k === 'pagedown') scroll = (scroll + 1) % totalPages();
    }
  }

  function chooseMain() {
    var id = MAIN[index].id;
    if (id === 'start') RW.engine.requestScreen('play');
    else if (id === 'settings') { mode = 'settings'; index = 0; }
    else showAbout();
  }

  function chooseSection() {
    var s = SECTIONS[index];
    if (s.id === 'display') { mode = 'display'; setIndex = 0; scroll = 0; }
    else if (s.id === 'back') mode = 'main';
    else flashHint('该模块尚未接入');
  }

  function showAbout() {
    RW.engine.showModal('关于本系统', [
      'REMOTE WARFARE  //  远程战争',
      'PHOSPHOR SYSTEMS  PHC-1983  ·  rev ' + RW.version,
      '',
      '一套用于远程战术指挥的旧式终端系统。',
      '本机仅提供指挥界面，作战细节不予公开。'
    ]);
  }

  function draw(c) {
    var L = layout();
    c.fillStyle = '#010401';
    c.fillRect(0, 0, L.w, L.h);
    drawFrame(c, L);
    var rv = RW.trans.reveal();
    if (mode === 'main') drawMain(c, L, rv);
    else if (mode === 'settings') drawSettings(c, L, rv);
    else drawDisplay(c, L, rv);
    RW.ui.drawFlashes(c);
    if (hintT > 0) RW.fx.phosphorText(c, hint, L.w / 2, L.footY + 4 * L.u, 11 * L.u, { align: 'center', color: '#33ff33', alpha: Math.min(1, hintT * 2) });
  }

  function drawFrame(c, L) {
    RW.fx.frame(c, L.x, L.y, L.innerW, L.innerH, { color: '#005500' });
    RW.fx.sweep(c, t, L.w, L.h);
    var L2 = Math.min(16 * L.u, L.innerW * 0.05);
    c.strokeStyle = '#00aa00'; c.lineWidth = 2;
    var cs = [[L.x, L.y, 1, 1], [L.x + L.innerW, L.y, -1, 1], [L.x, L.y + L.innerH, 1, -1], [L.x + L.innerW, L.y + L.innerH, -1, -1]];
    for (var i = 0; i < cs.length; i++) {
      var q = cs[i];
      c.beginPath(); c.moveTo(q[0], q[1] + q[3] * L2); c.lineTo(q[0], q[1]); c.lineTo(q[0] + q[2] * L2, q[1]); c.stroke();
    }
  }

  function drawItem(c, L, r, en, cn, selected, reveal) {
    var u = L.u;
    if (reveal <= 0) return;
    var a = reveal;
    if (selected) RW.fx.invert(c, r.x, r.y, r.w, r.h);
    else RW.fx.frame(c, r.x, r.y, r.w, r.h, { color: '#006600', alpha: a });
    var sc = Math.max(2, Math.round(3 * u / 2));
    var rowLimit = RW.pixel.revealRows(reveal);
    var tx = r.x + 16 * u;
    var ty = r.y + r.h * 0.5 - RW.pixel.height(sc) * 0.5 - 4 * u;
    RW.pixel.draw(c, en, tx, ty, sc, selected ? '#001100' : '#33ff33',
      { alpha: a, limit: Math.ceil(en.length * reveal), blink: rowLimit });
    RW.fx.phosphorText(c, cn, r.x + r.w - 14 * u, r.y + r.h - 10 * u, 10 * u,
      { align: 'right', color: selected ? '#003300' : '#00aa00', alpha: a, glow: false });
  }

  function drawMain(c, L, rv) {
    var u = L.u, cx = L.w / 2;
    var titleSc = Math.max(4, Math.round(Math.min(L.w / 260, 11 * u / 7)));
    var titleW = RW.pixel.measure('REMOTE WARFARE', titleSc);
    if (titleW > L.w * 0.86) {
      titleSc = Math.floor(L.w * 0.86 / RW.pixel.measure('REMOTE WARFARE', 1));
      titleW = RW.pixel.measure('REMOTE WARFARE', titleSc);
    }
    var ty = L.h * 0.17;
    RW.pixel.draw(c, 'REMOTE WARFARE', cx - titleW / 2, ty, titleSc, '#33ff33', { limit: Math.ceil(14 * rv) });
    RW.fx.phosphorText(c, '远 程 战 争', cx, ty + RW.pixel.height(titleSc) + 22 * u, 13 * u, { align: 'center', color: '#00aa00', alpha: RW.utils.clamp(rv * 1.6 - 0.4, 0, 1) });
    RW.fx.frame(c, L.w * 0.24, ty + RW.pixel.height(titleSc) + 34 * u, L.w * 0.52, 1, { color: '#007700', alpha: RW.utils.clamp(rv * 1.4 - 0.2, 0, 1) });
    var rs = mainRects();
    for (var i = 0; i < rs.length; i++) {
      var d = RW.trans.stagger(i, rs.length + 1, 0.55);
      drawItem(c, L, rs[i], MAIN[i].en, MAIN[i].cn, i === index, d);
    }
    RW.fx.phosphorText(c, '[↑↓/WS] 选择   [ENTER] 确认', L.x + 8 * u, L.footY, 11 * u, { color: '#008800', alpha: RW.utils.clamp(rv * 1.5 - 0.5, 0, 1) });
    RW.fx.phosphorText(c, 'v' + RW.version + '  ·  PHOSPHOR SYSTEMS 1983', L.x + L.innerW - 8 * u, L.footY, 11 * u, { align: 'right', color: '#008800', alpha: RW.utils.clamp(rv * 1.5 - 0.5, 0, 1) });
  }

  function drawSettings(c, L, rv) {
    var u = L.u, cx = L.w / 2;
    var sc = Math.max(2, Math.round(3 * u / 2));
    RW.pixel.drawCentered(c, 'SETTINGS', cx, L.h * 0.14, sc * 1.6, '#33ff33', { limit: Math.ceil(8 * rv) });
    RW.fx.phosphorText(c, '系统设置', cx, L.h * 0.14 + RW.pixel.height(sc * 1.6) + 20 * u, 12 * u, { align: 'center', color: '#00aa00', alpha: RW.utils.clamp(rv * 1.6 - 0.4, 0, 1) });
    var rs = sectionRects();
    for (var i = 0; i < rs.length; i++) {
      var d = RW.trans.stagger(i, rs.length + 1, 0.55);
      drawItem(c, L, rs[i], SECTIONS[i].en, SECTIONS[i].cn, i === index, d);
    }
    RW.fx.phosphorText(c, '[ESC] 返回主菜单', L.x + 8 * u, L.footY, 11 * u, { color: '#008800', alpha: RW.utils.clamp(rv * 1.5 - 0.5, 0, 1) });
  }

  function drawDisplay(c, L, rv) {
    var u = L.u, cx = L.w / 2;
    var sc = Math.max(2, Math.round(3 * u / 2));
    RW.pixel.drawCentered(c, 'DISPLAY', cx, L.h * 0.08, sc * 1.4, '#33ff33', { limit: Math.ceil(7 * rv) });
    RW.fx.phosphorText(c, '显示设置 · 即时生效 · 自动保存', cx, L.h * 0.08 + RW.pixel.height(sc * 1.4) + 18 * u, 11 * u, { align: 'center', color: '#00aa00', alpha: RW.utils.clamp(rv * 1.6 - 0.45, 0, 1) });
    var sl = sliderRects();
    var D = defs();
    for (var i = 0; i < sl.length; i++) {
      var r = sl[i];
      var def = D[r.gi];
      var val = RW.settings.get(def.key);
      var selected = (r.i === setIndex);
      var a = RW.utils.clamp(RW.trans.stagger(r.i, sl.length, 0.6), 0, 1);
      if (a <= 0.01) continue;
      if (selected) {
        c.globalAlpha = 0.18 * a;
        c.fillStyle = '#33ff33';
        c.fillRect(r.x, r.y, r.w, r.h);
        c.globalAlpha = 1;
        RW.fx.frame(c, r.x, r.y, r.w, r.h, { color: '#33ff33', alpha: a });
      }
      RW.fx.phosphorText(c, def.label, r.x + 8 * u, r.y + 16 * u, 11 * u, { color: selected ? '#33ff33' : '#00aa00', alpha: a });
      var bx = r.x + 8 * u, bw = r.w - 16 * u, by = r.y + r.h - 18 * u, bh = 12 * u;
      RW.fx.frame(c, bx, by, bw, bh, { color: selected ? '#00cc00' : '#005500', alpha: a });
      c.globalAlpha = a;
      c.fillStyle = selected ? '#33ff33' : '#009900';
      c.fillRect(bx + 1, by + 1, (bw - 2) * val, bh - 2);
      c.fillStyle = 'rgba(0,40,0,0.9)';
      for (var k = 1; k < 10; k++) c.fillRect(bx + (bw * k / 10), by + 1, 1, bh - 2);
      c.globalAlpha = 1;
      RW.fx.phosphorText(c, Math.round(val * 100) + '%', r.x + r.w - 8 * u, r.y + 16 * u, 11 * u, { align: 'right', color: selected ? '#33ff33' : '#008800', alpha: a });
    }
    if (totalPages() > 1) {
      RW.fx.phosphorText(c, 'PAGE ' + (scroll + 1) + '/' + totalPages(), L.x + L.innerW * 0.5, L.footY, 11 * u, { align: 'center', color: '#008800', alpha: RW.utils.clamp(rv * 1.5 - 0.4, 0, 1) });
    }
    var br = backRect();
    RW.fx.frame(c, br.x, br.y, br.w, br.h, { color: '#00aa00' });
    RW.fx.phosphorText(c, '< 返回', br.x + br.w / 2, br.y + br.h * 0.68, 12 * u, { align: 'center', color: '#33ff33' });
    var rr = resetRect();
    RW.fx.frame(c, rr.x, rr.y, rr.w, rr.h, { color: '#00aa00' });
    RW.fx.phosphorText(c, '恢复默认', rr.x + rr.w / 2, rr.y + rr.h * 0.68, 12 * u, { align: 'center', color: '#33ff33' });
    RW.fx.phosphorText(c, '[←→] 调整   [ESC] 返回', L.x + 8 * u, L.footY, 11 * u, { color: '#008800', alpha: RW.utils.clamp(rv * 1.5 - 0.5, 0, 1) });
  }

  return {
    reset: reset, update: update, draw: draw,
    onPointerDown: onPointerDown, onKey: onKey,
    mode: function () { return mode; }
  };
})();
