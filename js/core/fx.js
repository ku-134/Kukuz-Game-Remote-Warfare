/* core/fx.js —— 磷光屏美术引擎
   零资源：曲面畸变 / 扫描线 / 光晕 / 色散 / 噪点 / 暗角 / 滚动亮带 / 闪烁 / 余晖 / 信号干扰 / 开机动画。
   全部强度接入设置项。完整实现见本地源码。 */
RW.fx = (function () {
  'use strict';

  var canvas, ctx, buf, bctx;
  var W = 0, H = 0, dpr = 1;
  var glitch = 0, flicker = 0, rollY = 0, jamLevel = 0;
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

  /* 信号干扰：按需表演效果，不自动随机触发 */
  function updateGlitch(dt) {
    glitch += (jamLevel - glitch) * Math.min(1, dt * 8);
    flicker += dt;
    rollY += dt * 0.09;
  }

  function jam(level) { jamLevel = RW.utils.clamp(level || 0, 0, 1); }
  function burst(v) { glitch = Math.max(glitch, v || 0.9); }

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
    var s = RW.settings;
    var eff = s.get('intensity');
    var scan = s.get('scanline');
    var glow = s.get('glow');
    var bright = s.get('brightness');
    var layer = compose(source);

    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    bctx.fillStyle = '#000';
    bctx.fillRect(0, 0, W, H);

    /* 曲面鼓形（曲率设置） */
    var curv = s.get('curvature');
    var bands = 26, bh = Math.ceil(H / bands);
    for (var b = 0; b < bands; b++) {
      var sy = b * bh;
      var v = (b + 0.5) / bands - 0.5;
      var bulge = 1 + 0.075 * curv * (1 - 4 * v * v);
      var dw = W * bulge, dx = (W - dw) / 2;
      bctx.drawImage(layer, 0, sy, W, bh, dx, sy, dw, bh);
    }

    /* 色散（色彩偏移设置） */
    var chromaAmt = s.get('chroma');
    if (chromaAmt > 0.05) {
      var off = 1.6 * chromaAmt * eff * dpr;
      bctx.globalCompositeOperation = 'screen';
      bctx.globalAlpha = 0.18 * eff * (0.3 + 0.7 * chromaAmt);
      bctx.drawImage(layer, -off, 0, W, H);
      bctx.drawImage(layer, off, 0, W, H);
      bctx.globalAlpha = 1;
    }

    /* 扫描线 */
    bctx.globalCompositeOperation = 'multiply';
    var lineStep = Math.max(2, Math.round(3 * dpr));
    bctx.globalAlpha = 0.42 * (0.35 + 0.65 * scan) * eff;
    bctx.fillStyle = '#002200';
    for (var y = 0; y < H; y += lineStep) bctx.fillRect(0, y, W, Math.max(1, Math.round(dpr)));

    /* 光晕 */
    if (glow > 0.01 && eff > 0.01) {
      bctx.globalCompositeOperation = 'screen';
      bctx.globalAlpha = 0.16 * glow * eff;
      bctx.drawImage(layer, -dpr, -dpr, W, H);
      bctx.drawImage(layer, dpr, dpr, W, H);
      bctx.globalAlpha = 0.10 * glow * eff;
      bctx.drawImage(layer, -3 * dpr, 0, W, H);
    }

    /* 信号干扰：横向撕裂 + 竖向偏移 + 暗场 */
    if (glitch > 0.01) {
      bctx.globalCompositeOperation = 'source-over';
      bctx.globalAlpha = 1;
      var slices = 6 + Math.floor(glitch * 12);
      for (var k = 0; k < slices; k++) {
        var gy = Math.random() * H;
        var gh = Math.max(2, Math.random() * 40 * dpr);
        var gx = (Math.random() - 0.5) * 70 * glitch * dpr;
        bctx.drawImage(layer, 0, gy * (layer.height / H), layer.width, gh * (layer.height / H), gx, gy, W, gh);
      }
      var vbars = Math.floor(glitch * 4);
      for (var vb = 0; vb < vbars; vb++) {
        var vx = Math.random() * W, vw = Math.max(2, Math.random() * 16 * dpr);
        var vy = (Math.random() - 0.5) * 30 * glitch * dpr;
        bctx.drawImage(layer, vx * (layer.width / W), 0, vw * (layer.width / W), layer.height, vx, vy, vw, H);
      }
      bctx.globalAlpha = 0.30 * glitch;
      bctx.fillStyle = '#000';
      bctx.fillRect(0, 0, W, H);
      bctx.globalAlpha = 1;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.70 + 0.30 * bright;
    ctx.drawImage(buf, 0, 0);
    ctx.globalAlpha = 1;

    /* 噪点（噪点设置，干扰时增强） */
    var noiseAmt = s.get('noise');
    if (noiseAmt > 0.02 || glitch > 0.05) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.16 * eff * noiseAmt + 0.30 * glitch;
      var pat = ctx.createPattern(noiseTile, 'repeat');
      ctx.save();
      ctx.translate(-(Math.random() * 128 | 0), -(Math.random() * 128 | 0));
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W + 128, H + 128);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    /* 暗角（暗角设置） */
    ctx.globalCompositeOperation = 'source-over';
    var vig = s.get('vignette');
    var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30, W / 2, H / 2, Math.max(W, H) * 0.70);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + (0.92 * vig).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* 滚动亮带（滚动设置） */
    var rollAmt = s.get('roll');
    if (rollAmt > 0.03) {
      var ry = (rollY % 1.2) * H;
      var rg = ctx.createLinearGradient(0, ry - H * 0.08, 0, ry + H * 0.08);
      rg.addColorStop(0, 'rgba(120,255,120,0)');
      rg.addColorStop(0.5, 'rgba(120,255,120,' + (0.07 * eff * rollAmt).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(120,255,120,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, ry - H * 0.08, W, H * 0.16);
    }

    /* 亮度闪烁（闪烁设置） */
    var flk = s.get('flicker');
    var fl = 1 - 0.07 * flk + 0.07 * flk * Math.sin(flicker * 118);
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
    update: updateGlitch, present: present, burst: burst, jam: jam,
    phosphorText: phosphorText, frame: frame, invert: invert, sweep: sweep, crtPowerOn: crtPowerOn,
    PHOSPHOR: PHOSPHOR
  };
})();
