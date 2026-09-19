/* systems/terrain.js —— 地形：高度场 + 等高线 + 河流湖泊 */
RW.terrain = (function () {
  'use strict';

  var W = 32, H = 20;      /* 格子数 */
  var seed = 7;
  var waterLevel = 0.38;   /* 水位阈值 */
  var heights = [];        /* 每格高度 0..1 */
  var rivers = [];         /* 河流格子 {x,y} */

  function generate() {
    heights = [];
    for (var y = 0; y < H; y++) {
      var row = [];
      for (var x = 0; x < W; x++) {
        var n = RW.utils.hash2(x, y, seed);
        /* 中心高、四周低，叠加噪声 */
        var dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
        var d = Math.sqrt(dx * dx + dy * dy);
        var base = 0.75 - d * 0.9;
        row.push(RW.utils.clamp(base + (n - 0.5) * 0.35, 0, 1));
      }
      heights.push(row);
    }
    /* 河流：自高向低蜿蜒 */
    rivers = [];
    var cx = Math.floor(W / 2) + RW.utils.randInt(-2, 2);
    for (var y2 = 0; y2 < H; y2++) {
      cx = RW.utils.clamp(cx + RW.utils.randInt(-1, 1), 0, W - 1);
      rivers.push({ x: cx, y: y2 });
    }
  }

  function heightAt(x, y) { return heights[y] ? heights[y][x] : 0; }

  function isWater(x, y) {
    if (heightAt(x, y) < waterLevel) return true;
    for (var i = 0; i < rivers.length; i++) if (rivers[i].x === x && rivers[i].y === y) return true;
    return false;
  }

  return {
    W: W, H: H, seed: seed, waterLevel: waterLevel,
    generate: generate, heightAt: heightAt, isWater: isWater
  };
})();
