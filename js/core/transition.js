/* core/transition.js —— 界面过渡与揭示控制
   切换流程：out（旧界面文字先退）-> 切屏 -> in（新界面模板先出、文字逐行写入）
   界面通过 reveal() 获取 0~1 的揭示进度，自行决定画多少文字。完整实现见本地源码。 */
RW.trans = (function () {
  'use strict';

  var active = false;
  var phase = 'idle';       /* idle | out | in */
  var t = 0, dur = 0.42;
  var pending = null;
  var rv = 1;
  var scanPos = 0;

  function go(fn, seconds) {
    if (active) return false;
    active = true;
    phase = 'out';
    t = 0;
    dur = seconds || 0.42;
    pending = fn;
    return true;
  }

  function update(dt) {
    if (!active) { rv += (1 - rv) * Math.min(1, dt * 6); return; }
    t += dt;
    var p = RW.utils.clamp(t / dur, 0, 1);
    if (phase === 'out') {
      rv = 1 - p;
      scanPos = p;
      if (p >= 1) {
        if (pending) { pending(); pending = null; }
        phase = 'in'; t = 0; rv = 0;
      }
    } else {
      rv = p;
      scanPos = 1 - p;
      if (p >= 1) { active = false; phase = 'idle'; rv = 1; scanPos = 0; }
    }
  }

  function reveal() {
    if (!active && phase === 'idle') return 1;
    return RW.utils.clamp(rv, 0, 1);
  }

  function lines(total) { return Math.floor(reveal() * total + 0.0001); }

  function stagger(i, count, spread) {
    spread = spread === undefined ? 0.5 : spread;
    var r = reveal();
    var start = (i / Math.max(1, count)) * spread;
    return RW.utils.clamp((r - start) / (1 - spread + 0.0001), 0, 1);
  }

  function isActive() { return active; }
  function phaseName() { return phase; }

  function drawOverlay(c, w, h, u) {
    if (!active) return;
    var p = scanPos;
    var dark = phase === 'out' ? p : 1 - p;
    c.fillStyle = 'rgba(0,0,0,' + (0.85 * dark).toFixed(3) + ')';
    c.fillRect(0, 0, w, h);
    var y = Math.floor(p * h);
    var g = c.createLinearGradient(0, y - 26 * u, 0, y + 26 * u);
    g.addColorStop(0, 'rgba(51,255,51,0)');
    g.addColorStop(0.5, 'rgba(51,255,51,0.85)');
    g.addColorStop(1, 'rgba(51,255,51,0)');
    c.fillStyle = g;
    c.fillRect(0, y - 26 * u, w, 52 * u);
    c.fillStyle = '#33ff33';
    c.fillRect(0, y - 1, w, 2);
    var bw = w * 0.3, bx = (w - bw) / 2;
    c.strokeStyle = 'rgba(0,204,0,0.8)';
    c.lineWidth = 1;
    c.strokeRect(Math.round(bx) + 0.5, 12 * u + 0.5, Math.round(bw), 6 * u);
    c.fillStyle = '#33ff33';
    c.fillRect(Math.round(bx) + 1, 12 * u + 1, (bw - 2) * reveal(), 6 * u - 2);
  }

  return {
    go: go, update: update, reveal: reveal, lines: lines, stagger: stagger,
    isActive: isActive, phase: phaseName, drawOverlay: drawOverlay
  };
})();
