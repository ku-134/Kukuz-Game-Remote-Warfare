/* screens/boot.js —— 启动序列（完整实现见本地源码）
   缓存：以「版本号 + 模块清单」为键，命中则走短流程（一次过渡直达开始界面）
   文本：终端区裁剪 + 字号自适应，不再溢出
   跳过：真正跳过（立即完成） */
RW.boot = (function () {
  'use strict';

  var PHASE = { SELF: 0, LOAD: 1, RUN: 2, POWER: 3, DONE: 4 };
  var CACHE_KEY = 'rw_boot_cache';

  var phase = PHASE.SELF, pt = 0, total = 0;
  var lines = [], lineQueue = [], nextLine = 0, modules = [], done = false;
  var quick = false;

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

  var QUICK_LINES = [
    'SESSION RESTORED',
    'ALL MODULES CACHED ......... OK',
    ''
  ];

  function cacheKey() {
    var keys = [];
    var items = RW.load ? RW.load.items() : [];
    for (var i = 0; i < items.length; i++) keys.push(items[i].key);
    return RW.version + '|' + keys.join(',');
  }

  function hasCache() {
    try { return localStorage.getItem(CACHE_KEY) === cacheKey(); } catch (e) { return false; }
  }

  function writeCache() {
    try { localStorage.setItem(CACHE_KEY, cacheKey()); } catch (e) {}
  }

  function reset() {
    quick = hasCache();
    phase = PHASE.SELF; pt = 0; total = 0;
    lines = [];
    lineQueue = quick ? QUICK_LINES.slice() : SELF_LINES.slice();
    nextLine = 0; done = false;
    modules = RW.load ? RW.load.items() : [];
  }

  function pumpLines(dt) {
    if (nextLine >= lineQueue.length) return;
    pt += dt;
    if (pt >= (quick ? 0.16 : 0.11)) {
      pt = 0;
      lines.push(lineQueue[nextLine]);
      nextLine++;
      if (lines.length > 8) lines.shift();
      RW.fx.burst(0.12);
    }
  }

  function update(dt) {
    if (done) return;
    total += dt;
    var selfDone = quick ? 0.9 : 1.9;
    var loadDone = quick ? 1.5 : 3.4;
    var runDone = quick ? 2.1 : 5.0;

    if (phase === PHASE.SELF) {
      pumpLines(dt);
      if (nextLine >= lineQueue.length && total > selfDone) {
        phase = PHASE.LOAD; pt = 0; nextLine = 0; RW.fx.burst(0.6);
      }
    } else if (phase === PHASE.LOAD) {
      pt += dt;
      if (pt > 0.3 && modules.length) { pt = 0; RW.fx.burst(0.4); }
      if (modules.every(function (m) { return m.ok; }) && total > loadDone) {
        writeCache();
        phase = PHASE.RUN; pt = 0;
        lineQueue = quick
          ? ['LINK RE-ESTABLISHED ....... OK', '> RESUME REMOTE WARFARE', '']
          : ['ALL MODULES LOADED', 'ESTABLISHING LINK .......... SECURE', '', '> EXEC REMOTE WARFARE', ''];
        nextLine = 0;
        RW.fx.burst(0.8);
      }
    } else if (phase === PHASE.RUN) {
      pumpLines(dt);
      if (nextLine >= lineQueue.length && total > runDone) {
        phase = PHASE.POWER; pt = 0; RW.fx.burst(1.2);
      }
    } else if (phase === PHASE.POWER) {
      pt += dt;
      if (pt > (quick ? 0.7 : 1.1)) { phase = PHASE.DONE; done = true; }
    }
  }

  function skip() {
    if (done) return;
    for (var i = 0; i < modules.length; i++) modules[i].ok = true;
    writeCache();
    phase = PHASE.DONE;
    done = true;
  }

  function draw(c) {
    var s = RW.fx.size();
    var w = s.W, h = s.H, u = s.dpr;
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    if (phase === PHASE.POWER) { RW.fx.crtPowerOn(c, w, h, Math.min(1, pt / (quick ? 0.7 : 1.1))); return; }

    var pad = 22 * u;
    var boxX = pad, boxY = pad, boxW = w - pad * 2, boxH = h - pad * 2;

    RW.fx.frame(c, boxX, boxY, boxW, boxH, { color: '#007700' });
    var psc = Math.max(1, Math.round(1.7 * u));
    RW.pixel.draw(c, 'PHOSPHOR SYSTEMS  PHC-1983', boxX + 10 * u, boxY + 10 * u, psc, '#00cc00');
    var st = quick ? 'SESSION CACHE HIT' : 'SELF-TEST';
    RW.pixel.draw(c, st, boxX + boxW - 10 * u - RW.pixel.measure(st, psc), boxY + 10 * u, psc, '#00cc00');

    var cX = boxX + 12 * u, cY = boxY + 34 * u;
    var cW = boxW - 24 * u, cH = boxH - 34 * u - 26 * u;

    c.save();
    c.beginPath(); c.rect(cX, cY, cW, cH); c.clip();

    var longest = 0, i;
    for (i = 0; i < lines.length; i++) longest = Math.max(longest, lines[i].length);
    for (i = 0; i < lineQueue.length; i++) longest = Math.max(longest, lineQueue[i].length);
    longest = Math.max(longest, 34);
    var fs = Math.min(12 * u, cW / (longest * 0.62));
    fs = Math.max(7 * u, fs);
    var lineH = fs * 1.5;

    var y = cY + fs;
    var maxLines = Math.floor((cH - 20 * u) / lineH);
    var showFrom = Math.max(0, lines.length - maxLines);
    for (i = showFrom; i < lines.length; i++) {
      var a = 1 - (lines.length - 1 - i) * 0.04;
      RW.fx.phosphorText(c, lines[i], cX, y, fs, { alpha: Math.max(0.35, a), glow: false });
      y += lineH;
    }

    if (phase >= PHASE.LOAD) {
      y += fs * 0.8;
      if (y < cY + cH - fs) {
        RW.pixel.draw(c, quick ? 'VERIFY CACHE' : 'LOADING TACTICAL MODULES', cX, y - fs * 0.9,
          Math.max(1, Math.round(fs / 7)), '#00cc00');
        y += lineH;
      }
      for (var m = 0; m < modules.length; m++) {
        if (y > cY + cH - fs * 0.4) break;
        var mod = modules[m];
        var name = padStr(mod.name, 16);
        var nameW = fs * 0.62 * name.length;
        var statW = fs * 0.62 * 4;
        var barW = Math.max(20 * u, cW - nameW - statW - 16 * u);
        var barH = Math.max(6, Math.round(fs * 0.7));

        RW.fx.phosphorText(c, name, cX, y, fs, { color: mod.ok ? '#33ff33' : '#007700', glow: false });
        var bx = cX + nameW + 6 * u;
        var by = y - barH + 2 * u;
        RW.fx.frame(c, bx, by, barW, barH, { color: '#005500' });
        var fill = mod.ok ? 1 : Math.min(1, (total - (quick ? 0.9 : 1.9)) / 1.5);
        c.fillStyle = mod.ok ? '#33ff33' : '#00aa00';
        c.fillRect(bx + 1, by + 1, Math.max(0, (barW - 2) * fill), barH - 2);
        RW.fx.phosphorText(c, mod.ok ? 'OK' : '..', bx + barW + 6 * u, y, fs,
          { color: mod.ok ? '#33ff33' : '#008800', glow: false });
        y += lineH;
      }
    }
    c.restore();

    if (Math.floor(total * 2) % 2 === 0) {
      var tip = 'PRESS ANY KEY / TAP TO SKIP';
      var tsc = Math.max(1, Math.round(1.7 * u));
      RW.pixel.draw(c, tip, w / 2 - RW.pixel.measure(tip, tsc) / 2, boxY + boxH - 16 * u, tsc, '#00aa00');
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
    phase: function () { return phase; },
    isQuick: function () { return quick; }
  };
})();
