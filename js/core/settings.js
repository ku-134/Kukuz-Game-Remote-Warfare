/* core/settings.js —— 显示设置（12 项，可调、持久化、实时生效） */
RW.settings = (function () {
  'use strict';

  var DEFS = [
    { key: 'intensity',  label: '磷光强度',  desc: '整体荧光亮度与冲击感' },
    { key: 'scanline',   label: '扫描线',    desc: 'CRT 水平扫描线密度' },
    { key: 'glow',       label: '辉光',      desc: '亮部光晕扩散范围' },
    { key: 'trail',      label: '磷光余晖',  desc: '运动残影拖尾长度' },
    { key: 'brightness', label: '亮度',      desc: '屏幕整体明暗' },
    { key: 'curvature',  label: '屏幕曲率',  desc: 'CRT 玻璃鼓形畸变' },
    { key: 'chroma',     label: '色彩偏移',  desc: 'RGB 三色错位程度' },
    { key: 'noise',      label: '噪点',      desc: '信号底噪颗粒量' },
    { key: 'flicker',    label: '荧光闪烁',  desc: '屏幕亮度抖动频率' },
    { key: 'roll',       label: '滚动亮带',  desc: '垂直滚动的亮带速度' },
    { key: 'vignette',   label: '暗角',      desc: '四角压暗程度' },
    { key: 'scanSpeed',  label: '刷新速度',  desc: '画面整体刷新节奏' }
  ];

  var DEFAULTS = {
    intensity: 0.80, scanline: 0.50, glow: 0.60, trail: 0.40,
    brightness: 0.55, curvature: 0.60, chroma: 0.55, noise: 0.45,
    flicker: 0.45, roll: 0.50, vignette: 0.65, scanSpeed: 0.50
  };

  var KEY = 'rw_display_settings_v2';
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
  function reset() { cur = Object.assign({}, DEFAULTS); apply(); save(); }
  function apply() {
    var root = document.documentElement;
    root.style.setProperty('--scan-opacity', (0.1 + 0.9 * cur.scanline).toFixed(3));
    root.style.setProperty('--glow', cur.glow.toFixed(3));
  }

  return {
    DEFS: DEFS, DEFAULTS: DEFAULTS,
    get: get, set: set, apply: apply, reset: reset,
    all: function () { return cur; }
  };
})();
