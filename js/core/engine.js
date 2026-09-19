/* core/engine.js —— 游戏循环 / 状态机 / 渲染调度 */
RW.engine = (function () {
  'use strict';

  var canvas, ctx, W, H;
  var tile = { size: 28, originX: 40, originY: 48 };
  var units = [];

  function init() {
    canvas = document.getElementById('stage');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    RW.terrain.generate();
    units = [
      RW.unit.create('infantry', 5, 5),
      RW.unit.create('armored', 8, 8)
    ];
    RW.ui.init();
    buildHUD();
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function buildHUD() {
    RW.ui.clear();
    RW.ui.show(RW.ui.hud('REMOTE WARFARE v' + (RW.version || ''), 'LEVEL 01 · 教学', 'TURN 00'));
  }

  function start() { requestAnimationFrame(loop); }

  function loop(now) {
    update();
    render(now / 1000);
    requestAnimationFrame(loop);
  }

  function update() {
    /* 初版占位：无实时逻辑 */
  }

  function render(t) {
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawTerrain();
    for (var i = 0; i < units.length; i++) {
      RW.unit.draw(ctx, units[i], tile, RW.terrain);
    }
  }

  function drawGrid() {
    ctx.strokeStyle = 'rgba(0,170,0,0.22)';
    ctx.lineWidth = 1;
    var tw = RW.terrain.W, th = RW.terrain.H;
    for (var x = 0; x <= tw; x++) {
      var px = tile.originX + x * tile.size;
      ctx.beginPath();
      ctx.moveTo(px, tile.originY);
      ctx.lineTo(px, tile.originY + th * tile.size);
      ctx.stroke();
    }
    for (var y = 0; y <= th; y++) {
      var py = tile.originY + y * tile.size;
      ctx.beginPath();
      ctx.moveTo(tile.originX, py);
      ctx.lineTo(tile.originX + tw * tile.size, py);
      ctx.stroke();
    }
  }

  function drawTerrain() {
    var tw = RW.terrain.W, th = RW.terrain.H;
    for (var y = 0; y < th; y++) {
      for (var x = 0; x < tw; x++) {
        var h = RW.terrain.heightAt(x, y);
        var px = tile.originX + x * tile.size;
        var py = tile.originY + y * tile.size;
        var g = Math.round(20 + h * 70);
        ctx.fillStyle = 'rgba(0,' + g + ',0,0.55)';
        ctx.fillRect(px, py, tile.size, tile.size);
        if (RW.terrain.isWater(x, y)) {
          ctx.fillStyle = 'rgba(0,140,200,0.5)';
          ctx.fillRect(px, py, tile.size, tile.size);
        }
      }
    }
    /* 等高线（按高度阈值标注） */
    for (var lvl = 1; lvl < 4; lvl++) {
      var th2 = lvl / 4;
      for (var y2 = 0; y2 < th; y2++) {
        for (var x2 = 0; x2 < tw; x2++) {
          if (Math.abs(RW.terrain.heightAt(x2, y2) - th2) < 0.02) {
            var px2 = tile.originX + x2 * tile.size;
            var py2 = tile.originY + y2 * tile.size;
            ctx.fillStyle = 'rgba(51,255,51,0.55)';
            ctx.fillRect(px2 + 3, py2 + 3, tile.size - 6, tile.size - 6);
          }
        }
      }
    }
  }

  return { init: init, start: start };
})();
