/* screens/boot.js —— 启动序列（像素字体）
   阶段：SELF 自检 -> LOAD 模块装载 -> RUN 运行校验 -> POWER CRT 点亮。 */
RW.boot = (function () {
  'use strict';

  var PHASE = { SELF: 0, LOAD: 1, RUN: 2, POWER: 3, DONE: 4 };
  var phase = PHASE.SELF, pt = 0, total = 0;
  var lines = [], lineQueue = [], nextLine = 0, modules = [], done = false;

  var SELF_LINES = [
    'REMOTE WARFARE // TACTICAL COMMAND TERMINAL',
    'FIRMWARE   PHOS-CORE rev 4.11   (c) PHOSPHOR SYSTEMS 1983',
    '',
    'MEMORY TEST ................ 640K OK',
    'TACTICAL BUS ............... OK',
    'CARTRIDGE SLOT A ........... REMOTE WARFARE',
    'CARTRIDGE SLOT B ........... EMPTY',
    'CRYPTO MODULE .............. ONLINE',
    ''
  ];

  function reset() {
    phase = PHASE.SELF; pt = 0; total = 0;
    lines = []; lineQueue = SELF_LINES.slice();
    nextLine = 0; done = false;
    modules = RW.load ? RW.load.items() : [];
  }

  function pumpLines(dt) {
    if (nextLine >= lineQueue.length) return;
    pt += dt;
    if (pt >= 0.11) {
      pt = 0;
      lines.push(lineQueue[nextLine]);
      nextLine++;
      if (lines.length > 9) lines.shift();
      RW.fx.burst(0.15);
    }
  }

  function update(dt) {
    if (done) return;
    total += dt;
    if (phase === PHASE.SELF) {
      pumpLines(dt);
      if (nextLine >= lineQueue.length && total > 1.9) { phase = PHASE.LOAD; pt = 0; nextLine = 0; RW.fx.burst(0.8); }
    } else if (phase === PHASE.LOAD) {
      pt += dt;
      if (pt > 0.34 && modules.length) { pt = 0; RW.fx.burst(0.5); }
      if (modules.every(function (m) { return m.ok; }) && total > 3.4) {
        phase = PHASE.RUN; pt = 0;
        lineQueue = ['ALL MODULES LOADED', 'ESTABLISHING LINK .......... SECURE', '', '> EXEC REMOTE WARFARE', ''];
        nextLine = 0; RW.fx.burst(1.0);
      }
    } else if (phase === PHASE.RUN) {
      pumpLines(dt);
      if (nextLine >= lineQueue.length && total > 5.0) { phase = PHASE.POWER; pt = 0; RW.fx.burst(1.4); }
    } else if (phase === PHASE.POWER) {
      pt += dt;
      if (pt > 1.1) { phase = PHASE.DONE; done = true; }
    }
  }

  /* 跳过：不触发故障特效 */
  function skip() {
    if (done) return;
    if (phase < PHASE.POWER) {
      for (var i = 0; i < modules.length; i++) modules[i].ok = true;
      phase = PHASE.POWER; pt = 0; total = Math.max(total, 5.0);
    }
  }

  function draw(c) {
    var s = RW.fx.size();
    var w = s.W, h = s.H, u = s.dpr;
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    if (phase === PHASE.POWER) { RW.fx.crtPowerOn(c, w, h, Math.min(1, pt / 1.1)); return; }

    var pad = 22 * u, fs = 12 * u;
    RW.fx.frame(c, pad, pad, w - pad * 2, h - pad * 2, { color: '#007700' });

    var psc = Math.max(1, Math.round(1.7 * u));
    RW.pixel.draw(c, 'PHOSPHOR SYSTEMS  PHC-1983', pad + 10 * u, pad + 11 * u, psc, '#00cc00');
    RW.pixel.draw(c, 'SELF-TEST', w - pad - 10 * u - RW.pixel.measure('SELF-TEST', psc), pad + 11 * u, psc, '#00cc00');

    var y = pad + 44 * u;
    for (var i = 0; i < lines.length; i++) {
      var a = 1 - (lines.length - 1 - i) * 0.04;
      RW.fx.phosphorText(c, lines[i], pad + 12 * u, y, fs, { alpha: Math.max(0.35, a) });
      y += 17 * u;
    }

    if (phase >= PHASE.LOAD) {
      y += 8 * u;
      RW.pixel.draw(c, 'LOADING TACTICAL MODULES', pad + 12 * u, y - 8 * u, Math.max(1, Math.round(1.6 * u)), '#00cc00');
      y += 18 * u;
      for (var m = 0; m < modules.length; m++) {
        var mod = modules[m];
        var barW = (w - pad * 2) * 0.36;
        RW.fx.phosphorText(c, padStr(mod.name, 16), pad + 12 * u, y, fs, { color: mod.ok ? '#33ff33' : '#007700' });
        var bx = pad + 12 * u + 150 * u;
        RW.fx.frame(c, bx, y - 10 * u, barW, 10 * u, { color: '#005500' });
        var fill = mod.ok ? 1 : Math.min(1, (total - 1.9) / 3.4);
        c.fillStyle = mod.ok ? '#33ff33' : '#00aa00';
        c.fillRect(bx + 1, y - 9 * u, Math.max(0, (barW - 2) * fill), 8 * u);
        RW.fx.phosphorText(c, mod.ok ? 'OK' : '..', bx + barW + 12 * u, y, fs, { color: mod.ok ? '#33ff33' : '#008800' });
        y += 17 * u;
      }
    }

    if (phase !== PHASE.POWER && Math.floor(total * 2) % 2 === 0) {
      var tip = 'PRESS ANY KEY / TAP TO SKIP';
      var tsc = Math.max(1, Math.round(1.7 * u));
      RW.pixel.draw(c, tip, w / 2 - RW.pixel.measure(tip, tsc) / 2, h - pad - 16 * u, tsc, '#00aa00');
    }
  }

  function padStr(s, n) {
    s = String(s);
    while (s.length < n) s += '.';
    return s;
  }

  return {
    PHASE: PHASE, reset: reset, update: update, draw: draw, skip: skip,
    isDone: function () { return done; },
    phase: function () { return phase; }
  };
})();
