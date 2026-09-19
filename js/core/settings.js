/* core/settings.js —— 显示设置（磷光屏参数），可调且不影响运行 */
RW.settings = (function () {
  'use strict';

  var DEFAULTS = {
    intensity: 0.8,   /* 磷光强度 */
    scanline: 0.5,    /* 扫描线 */
    glow: 0.5,        /* 辉光 */
    curvature: 0.0,   /* 弯曲/畸变（预留） */
    brightness: 0.5   /* 亮度（预留） */
  };
  var KEY = 'rw_display_settings';
  var cur = load();

  function load() {
    var o = Object.assign({}, DEFAULTS);
    try {
      var s = localStorage.getItem(KEY);
      if (s) { var p = JSON.parse(s); for (var k in p) if (k in o) o[k] = p[k]; }
    } catch (e) {}
    return o;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
  }
  function get(k) { return cur[k]; }
  function set(k, v) { cur[k] = RW.utils.clamp(v, 0, 1); apply(); save(); }
  function apply() {
    var root = document.documentElement;
    root.style.setProperty('--scan-opacity', (0.1 + 0.9 * cur.scanline).toFixed(3));
    root.style.setProperty('--glow', cur.glow.toFixed(3));
  }

  return { DEFAULTS: DEFAULTS, get: get, set: set, apply: apply, all: function () { return cur; } };
})();
