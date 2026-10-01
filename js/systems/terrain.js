/* systems/terrain.js —— 地形：多层高度场 + 等高线 + 河流湖泊
   高度场用「多个高斯丘陵叠加 + 确定性噪声」生成，保证可见的地形起伏。
   等高线按高度阈值提取等值线段，供渲染层绘制。完整实现见本地源码。 */
RW.terrain = (function () {
  'use strict';

  var W = 34, H = 22;
  var seed = 1337;
  var waterLevel = 0.26;
  var heights = [];
  var rivers = [];
  var ridgeCache = [];

  function blob(cx, cy, r, amp, x, y) {
    var dx = (x - cx) / r, dy = (y - cy) / r;
    return amp * Math.exp(-(dx * dx + dy * dy));
  }

  function generate() {
    var peaks = [
      { x: W * 0.30, y: H * 0.30, r: H * 0.42, amp: 0.72 },
      { x: W * 0.52, y: H * 0.52, r: H * 0.36, amp: 0.60 },
      { x: W * 0.74, y: H * 0.70, r: H * 0.40, amp: 0.66 },
      { x: W * 0.82, y: H * 0.24, r: H * 0.30, amp: 0.48 },
      { x: W * 0.16, y: H * 0.74, r: H * 0.30, amp: 0.44 }
    ];
    heights = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) {
        var v = 0.06;
        for (var p = 0; p < peaks.length; p++) v += blob(peaks[p].x, peaks[p].y, peaks[p].r, peaks[p].amp, x, y);
        v += (RW.utils.hash2(x, y, seed) - 0.5) * 0.13;
        v += (RW.utils.hash2(x * 2, y * 2, seed + 7) - 0.5) * 0.06;
        row.push(RW.utils.clamp(v, 0, 1));
      }
      heights.push(row);
    }

    /* 河流：从高处沿最陡下降方向流向边缘 */
    rivers = [];
    var cx = Math.round(W * 0.30), cy = Math.round(H * 0.30);
    for (var step = 0; step < W * H; step++) {
      rivers.push({ x: cx, y: cy });
      var best = null, bestH = heightAt(cx, cy);
      for (var d = 0; d < 4; d++) {
        var nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        var hh = heightAt(nx, ny);
        if (hh < bestH) { bestH = hh; best = { x: nx, y: ny }; }
      }
      if (!best) break;
      cx = best.x; cy = best.y;
    }
    buildContours();
  }

  function buildContours() {
    ridgeCache = [];
    var levels = [0.30, 0.45, 0.60, 0.75, 0.88];
    for (var li = 0; li < levels.length; li++) {
      var lv = levels[li], segs = [];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var h0 = heightAt(x, y);
        if (x + 1 < W) {
          var h1 = heightAt(x + 1, y);
          if ((h0 - lv) * (h1 - lv) < 0) segs.push({ x: x + (lv - h0) / (h1 - h0), y: y + 0.15, vert: true });
        }
        if (y + 1 < H) {
          var h2 = heightAt(x, y + 1);
          if ((h0 - lv) * (h2 - lv) < 0) segs.push({ x: x + 0.15, y: y + (lv - h0) / (h2 - h0), vert: false });
        }
      }
      ridgeCache.push({ level: lv, segs: segs });
    }
  }

  function heightAt(x, y) {
    if (y < 0 || y >= H || x < 0 || x >= W) return 0;
    return heights[y][x];
  }

  function isWater(x, y) {
    if (heightAt(x, y) < waterLevel) return true;
    for (var i = 0; i < rivers.length; i++) if (rivers[i].x === x && rivers[i].y === y) return true;
    return false;
  }

  return {
    W: W, H: H, seed: seed, waterLevel: waterLevel,
    generate: generate, heightAt: heightAt, isWater: isWater,
    contours: function () { return ridgeCache; },
    rivers: function () { return rivers; }
  };
})();
