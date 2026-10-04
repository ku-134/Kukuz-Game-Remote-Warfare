/* core/layout.js —— 游玩界面布局（v2）
   左侧 2/3：上 地图显示（局部视口）、下 地图操作 + 操作区（对齐地图宽度）
   右侧 1/3：详情展示（放大）
   无底部栏，界面铺满全屏。 */
RW.layout = (function () {
  'use strict';

  var S = {};

  function compute(s) {
    var u = s.dpr;
    var margin = 10 * u;
    var gap = 8 * u;
    var headerH = 20 * u;

    var totalW = s.W - margin * 2;
    var totalH = s.H - margin * 2;

    var sideW = Math.round(totalW / 3);
    var leftW = totalW - sideW - gap;

    var opH = RW.utils.clamp(totalH * 0.23, 68 * u, 120 * u);
    var mapH = totalH - opH - gap;
    var toolW = Math.round(leftW * 0.26);

    S.u = u; S.W = s.W; S.H = s.H;

    S.map = { x: margin, y: margin, w: leftW, h: mapH };
    S.tools = { x: margin, y: margin + mapH + gap, w: toolW, h: opH };
    S.orders = { x: margin + toolW + gap, y: margin + mapH + gap, w: leftW - toolW - gap, h: opH };
    S.side = { x: margin + leftW + gap, y: margin, w: sideW, h: totalH };

    S.mapInner = { x: S.map.x, y: S.map.y + headerH, w: S.map.w, h: S.map.h - headerH };
    S.sideInner = { x: S.side.x, y: S.side.y + headerH, w: S.side.w, h: S.side.h - headerH };
    S.toolsInner = { x: S.tools.x, y: S.tools.y, w: S.tools.w, h: S.tools.h };
    S.ordersInner = { x: S.orders.x, y: S.orders.y, w: S.orders.w, h: S.orders.h };

    return S;
  }

  function headerH() { return 20 * (S.u || 1); }

  return { compute: compute, get: function () { return S; }, headerH: headerH };
})();
