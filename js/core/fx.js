/* core/fx.js —— 磷光屏美术引擎
   零美术资源：所有视觉程序生成。
   提供：曲面 CRT 畸变 / 扫描线 / 光晕 / 信号故障 / 噪点 / 暗角 / 闪烁 / 色散 / 余晖 / 开机动画。
   完整实现见本地源码。 */
RW.fx = (function () {
  'use strict';

  var canvas, ctx, buf, bctx;
  var W = 0, H = 0, dpr = 1;
  var glitch = 0, glitchTimer = 1.2, flicker = 0, rollY = 0;
  var persA, persCtx, noiseTile, noiseCtx;
  var PHOSPHOR = [51, 255, 51];

  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    buf = document.createElement('canvas');
    bctx = buf.getContext('2d');
    persA = document.createElement('canvas');
    persCtx = persA.getContext('2d');
    noiseTile = document.createElement('canvas');
    noiseTile.width = noiseTile.height = 128;
    noiseCtx = noiseTile.getContext('2d');
    var img = noiseCtx.createImageData(128, 128);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random() * 255;
      img.data[i] = v * 0.35; img.data[i + 1] = v; img.data[i + 2] = v * 0.4;
      img.data[i + 3] = Math.random() < 0.5 ? 255 : 0;
    }
    noiseCtx.putImageData(img, 0, 0);
  }

  function resize(w, h, ratio) {
    dpr = ratio || 1;
    W = canvas.width = Math.max(2, Math.floor(w * dpr));
    H = canvas.height = Math.max(2, Math.floor(h * dpr));
    buf.width = W; buf.height = H;
    persA.width = W; persA.height = H;
    persCtx.clearRect(0, 0, W, H);
  }

  function size() { return { W: W, H: H, dpr: dpr }; }

  function updateGlitch(dt) {
    var eff = RW.settings.get('intensity');
    glitchTimer -= dt * (0.55 + eff * 1.6);
    if (glitchTimer <= 0) {
      glitch = (0.45 + Math.random() * 1.15) * eff;
      glitchTimer = 1.8 + Math.random() * 4.5;
    }
    glitch *= Math.pow(0.015, dt);
    if (glitch < 0.002) glitch = 0;
    flicker += dt;
    rollY += dt * 0.09;
  }

  function burst(v) { glitch = Math.max(glitch, v || 0.9); }

  /* 磷光余晖：单缓冲衰减 + 叠加新帧 */
  function compose(source) {
    var trail = RW.settings.get('trail');
    if (trail === undefined) trail = 0.4;
    if (trail <= 0.01) return source;
    persCtx.globalCompositeOperation = 'source-over';
    persCtx.globalAlpha = 1;
    persCtx.fillStyle = 'rgba(0,0,0,' + (0.55 + 0.4 * (1 - trail)).toFixed(3) + ')';
    persCtx.fillRect(0, 0, W, H);
    persCtx.globalAlpha = 1;
    persCtx.drawImage(source, 0, 0, W, H);
    return persA;
  }

  function present(source) {
    var eff = RW.settings.get('intensity');
    var scan = RW.settings.get('scanline');
    var glow = RW.settings.get('glow');
    var bright = RW.settings.get('brightness');
    var layer = compose(source);

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    bctx.fillStyle = '#000';
    bctx.fillRect(0, 0, W, H);

    /* 曲面：分带横向微缩放，模拟 CRT 玻璃鼓形 */
    var bands = 26, bh = Math.ceil(H / bands);
    for (var b = 0; b < bands; b++) {
      var sy = b * bh;
      var v = (b + 0.5) / bands - 0.5;
      var bulge = 1 + 0.055 * (1 - 4 * v * v);
      var dw = W * bulge, dx = (W - dw) / 2;
      bctx.drawImage(layer, 0, sy, W, bh, dx, sy, dw, bh);
    }

    if (eff > 0.05) {
      var off = 1.6 * eff * dpr;
      bctx.globalCompositeOperation = 'screen';
      bctx.globalAlpha = 0.18 * eff;
      bctx.drawImage(layer, -off, 0, W, H);
      bctx.drawImage(layer, off, 0, W, H);
      bctx.globalAlpha = 1;
    }

    bctx.globalCompositeOperation = 'multiply';
    var lineStep = Math.max(2, Math.round(3 * dpr));
    bctx.globalAlpha = 0.42 * (0.35 + 0.65 * scan) * eff;
    bctx.fillStyle = '#002200';
    for (var y = 0; y < H; y += lineStep) bctx.fillRect(0, y, W, Math.max(1, Math.round(dpr)));

    if (glow > 0.01 && eff > 0.01) {
      bctx.globalCompositeOperation = 'screen';
      bctx.globalAlpha = 0.16 * glow * eff;
      bctx.drawImage(layer, -dpr, -dpr, W, H);
      bctx.drawImage(layer, dpr, dpr, W, H);
    }

    if (glitch > 0.01) {
      bctx.globalCompositeOperation = 'source-over';
      bctx.globalAlpha = 1;
      var slices = 4 + Math.floor(glitch * 7);
      for (var k = 0; k < slices; k++) {
        var gy = Math.random() * H;
        var gh = Math.max(2, Math.random() * 30 * dpr);
        var gx = (Math.random() - 0.5) * 52 * glitch * dpr;
        bctx.drawImage(layer, 0, gy * (layer.height / H), layer.width, gh * (layer.height / H), gx, gy, W, gh);
      }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.70 + 0.30 * bright;
    ctx.drawImage(buf, 0, 0);
    ctx.globalAlpha = 1;

    if (eff > 0.02) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.12 * eff;
      var pat = ctx.createPattern(noiseTile, 'repeat');
      ctx.save();
      ctx.translate(-(Math.random() * 128 | 0), -(Math.random() * 128 | 0));
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W + 128, H + 128);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'source-over';
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30, W / 2, H / 2, Math.max(W, H) * 0.70);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.80)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (eff > 0.05) {
      var ry = (rollY % 1.2) * H;
      var rg = ctx.createLinearGradient(0, ry - H * 0.08, 0, ry + H * 0.08);
      rg.addColorStop(0, 'rgba(120,255,120,0)');
      rg.addColorStop(0.5, 'rgba(120,255,120,' + (0.05 * eff).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(120,255,120,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, ry - H * 0.08, W, H * 0.16);
    }

    var fl = 1 - 0.06 * eff + 0.06 * eff * Math.sin(flicker * 118);
    ctx.globalAlpha = (1 - fl) * 0.7;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  function phosphorText(c, text, x, y, size, opt) {
    opt = opt || {};
    c.font = (opt.bold ? 'bold ' : '') + size + 'px "Courier New", ui-monospace, monospace';
    c.textAlign = opt.align || 'left';
    c.textBaseline = opt.baseline || 'alphabetic';
    var a = opt.alpha === undefined ? 1 : opt.alpha;
    if (opt.glow !== false) { c.globalAlpha = a * 0.30; c.fillStyle = '#33ff33'; c.fillText(text, x + 1, y + 1); }
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
    var g = c.createLinearGradient(0, y - 60, 0, y + 60);
    g.addColorStop(0, 'rgba(51,255,51,0)');
    g.addColorStop(0.5, 'rgba(51,255,51,0.09)');
    g.addColorStop(1, 'rgba(51,255,51,0)');
    c.fillStyle = g;
    c.fillRect(0, y - 60, w, 120);
  }

  function crtPowerOn(c, w, h, p) {
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    if (p < 0.35) {
      c.fillStyle = '#33ff33';
      c.fillRect(0, h / 2, w, 2);
    } else {
      var k = (p - 0.35) / 0.65;
      var e = k * k * (3 - 2 * k);
      var hh = h * e;
      c.fillStyle = '#031803';
      c.fillRect(0, (h - hh) / 2, w, hh);
      c.fillStyle = '#33ff33';
      c.fillRect(0, (h - hh) / 2, w, 1);
      c.fillRect(0, (h + hh) / 2, w, 1);
      c.fillStyle = 'rgba(51,255,51,' + (0.25 * (1 - e)).toFixed(3) + ')';
      c.fillRect(0, (h - hh) / 2, w, hh);
    }
  }

  return {
    init: init, resize: resize, size: size,
    update: updateGlitch, present: present, burst: burst,
    phosphorText: phosphorText, frame: frame, invert: invert, sweep: sweep, crtPowerOn: crtPowerOn,
    PHOSPHOR: PHOSPHOR
  };
})();
