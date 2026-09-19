/* core/utils.js —— 工具函数与常量 */
window.RW = window.RW || {};

RW.utils = (function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }

  /* 确定性伪随机，用于地形种子 */
  function hash2(ix, iy, seed) {
    var h = (ix * 374761393 + iy * 668265263 + seed * 974634587) | 0;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return (h >>> 0) / 4294967295;
  }

  return { clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, hash2: hash2 };
})();