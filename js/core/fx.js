/* core/fx.js —— 磷光屏美术引擎（零美术资源方案，细节见源码注释） */
RW.fx = (function () {
  'use strict';

  var canvas, ctx, buf, bctx;
  var W = 0, H = 0, dpr = 1;
  var glitch = 0, glitchTimer = 1.5, flickerPhase = 0;
  var PHOSPHOR = [51, 255, 51];

  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    buf = document.createElement('canvas');
    bctx = buf.getContext('2d');
  }

  function resize(w, h, ratio) {
    dpr = ratio || 1;
    W = canvas.width = Math.max(2, Math.floor(w * dpr));
    H = canvas.height = Math.max(2, Math.floor(h * dpr));
    buf.width = W; buf.height = H;
  }

  function size() { return { W: W, H: H, dpr: dpr }; }

  function updateGlitch(dt) {
    var s = RW.settings;
    var eff = s.get('intensity');
    var g = s.get('scanline') * 0.5 + eff * 0.5;
    glitchTimer -= dt * (0.5 + g * 1.8);
    if (glitchTimer <= 0) {
      glitch = (0.4 + Math.random() * 1.1) * eff;
      glitchTimer = 1.6 + Math.random() * 4.0;
    }
    glitch *= Math.pow(0.02, dt);
    if (glitch < 0.002) glitch = 0;
    flickerPhase += dt;
  }

  function burst(v) { glitch = Math.max(glitch, v || 0.9); }

  function present(source) {
    var s = RW.settings;
    var eff = s.get('intensity');
    var scan = s.get('scanline');
    var glow = s.get('glow');
    var bright = s.get('brightness');

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.clearRect(0, 0, W, H);
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    bctx.drawImage(source, 0, 0, W, H);

    var lineStep = Math.max(2, Math.round(3 * dpr));
    bctx.globalCompositeOperation = 'multiply';
    bctx.globalAlpha = 0.35 * scan * eff;
    bctx.fillStyle = '#001400';
    for (var y = 0; y < H; y += lineStep) bctx.fillRect(0, y, W, Math.max(1, Math.round(dpr)));

    if (glow > 0.01 && eff > 0.01) {
      bctx.globalCompositeOperation = 'screen';
      bctx.globalAlpha = 0.20 * glow * eff;
      for (var i = 1; i <= 3; i++) bctx.drawImage(source, -i * dpr, -i * dpr, W, H);
    }

    if (glitch > 0.01) {
      bctx.globalCompositeOperation = 'source-over';
      bctx.globalAlpha = 1;
      var slices = 3 + Math.floor(glitch * 5);
      for (var k = 0; k < slices; k++) {
        var sy = Math.random() * H;
        var sh = Math.max(2, Math.random() * 24 * dpr);
        var dx = (Math.random() - 0.5) * 40 * glitch * dpr;
        bctx.drawImage(source, 0, sy * (source.height / H), source.width, sh * (source.height / H), dx, sy, W, sh);
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.72 + 0.28 * bright;
    ctx.drawImage(buf, 0, 0);

    ctx.globalAlpha = 0.05 * eff;
    ctx.globalCompositeOperation = 'screen';
    drawNoise();

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawVignette();

    var fl = 1 - 0.05 * eff + 0.05 * eff * Math.sin(flickerPhase * 118);
    ctx.globalAlpha = (1 - fl) * 0.6;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawNoise() {
    var n = Math.floor((W * H) / 26000);
    ctx.fillStyle = '#33ff33';
    for (var i = 0; i < n; i++) ctx.fillRect(Math.random() * W, Math.random() * H, dpr, dpr);
  }

  function drawVignette() {
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function phosphorText(c, text, x, y, size, opt) {
    opt = opt || {};
    c.font = (opt.bold ? 'bold ' : '') + size + 'px "Courier New", ui-monospace, monospace';
    c.textAlign = opt.align || 'left';
    c.textBaseline = opt.baseline || 'alphabetic';
    var a = opt.alpha === undefined ? 1 : opt.alpha;
    if (opt.glow !== false) { c.globalAlpha = a * 0.35; c.fillStyle = '#33ff33'; c.fillText(text, x, y); }
    c.globalAlpha = a;
    c.fillStyle = opt.color || '#33ff33';
    c.fillText(text, x, y);
    c.globalAlpha = 1;
  }

  function frame(c, x, y, w, h, opt) {
    opt = opt || {};
    c.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha;
    c.strokeStyle = opt.color || '#00cc00';
    c.lineWidth = opt.width || 1;
    c.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
    if (opt.fill) { c.fillStyle = opt.fill; c.fillRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 1, Math.round(h) - 1); }
    c.globalAlpha = 1;
  }

  function invert(c, x, y, w, h) {
    c.fillStyle = '#33ff33';
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    c.globalCompositeOperation = 'difference';
    c.fillStyle = '#33ff33';
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    c.globalCompositeOperation = 'source-over';
  }

  function sweep(c, t, w, h) {
    var y = (t * 0.28 % 1) * h;
    var g = c.createLinearGradient(0, y - 40, 0, y + 40);
    g.addColorStop(0, 'rgba(51,255,51,0)');
    g.addColorStop(0.5, 'rgba(51,255,51,0.10)');
    g.addColorStop(1, 'rgba(51,255,51,0)');
    c.fillStyle = g;
    c.fillRect(0, y - 40, w, 80);
  }

  function crtPowerOn(c, w, h, p) {
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    if (p < 0.45) {
      c.fillStyle = '#33ff33';
      c.fillRect(0, h / 2, w, 2);
    } else {
      var k = (p - 0.45) / 0.55;
      var hh = h * k;
      c.fillStyle = '#031803';
      c.fillRect(0, (h - hh) / 2, w, hh);
      c.fillStyle = '#33ff33';
      c.fillRect(0, (h - hh) / 2, w, 1);
      c.fillRect(0, (h + hh) / 2, w, 1);
    }
  }

  return {
    init: init, resize: resize, size: size,
    update: updateGlitch, present: present, burst: burst,
    phosphorText: phosphorText, frame: frame, invert: invert, sweep: sweep, crtPowerOn: crtPowerOn,
    PHOSPHOR: PHOSPHOR
  };
})();
