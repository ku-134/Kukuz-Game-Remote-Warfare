/* core/layout.js —— 游玩界面布局（依据概念图）
   ┌──────────────────┬──────────┐
   │    地图显示       │  详情    │
   ├──────────────────┤  展示    │
   │ 地图操作 │ 单位下令区 │          │
   └──────────────────┴──────────┘
   完整实现见本地源码。 */
RW.layout = (function () {
  'use strict';

  var S = {};

  function compute(s) {
    var u = s.dpr;
    var margin = 10 * u, gap = 8 * u;
    var headerH = 20 * u, footerH = 16 * u;

    var totalW = s.W - margin * 2;
    var totalH = s.H - margin * 2 - footerH;

    var sideW = RW.utils.clamp(totalW * 0.22, 150 * u, 260 * u);
    var leftW = totalW - sideW - gap;

    var opH = RW.utils.clamp(totalH * 0.20, 62 * u, 108 * u);
    var mapH = totalH - opH - gap;
    var toolW = Math.round(leftW * 0.22);

    S.u = u; S.W = s.W; S.H = s.H;
    S.footer = { x: margin, y: margin + totalH + gap, w: totalW, h: footerH };
    S.map = { x: margin, y: margin, w: leftW, h: mapH };
    S.op = { x: margin, y: margin + mapH + gap, w: leftW, h: opH };
    S.tools = { x: S.op.x, y: S.op.y, w: toolW, h: opH };
    S.orders = { x: S.op.x + toolW + gap, y: S.op.y, w: leftW - toolW - gap, h: opH };
    S.side = { x: margin + leftW + gap, y: margin, w: sideW, h: totalH };
    S.mapInner = { x: S.map.x, y: S.map.y + headerH, w: S.map.w, h: S.map.h - headerH };
    S.sideInner = { x: S.side.x, y: S.side.y + headerH, w: S.side.w, h: S.side.h - headerH };

    var tw = RW.terrain.W, th = RW.terrain.H;
    var size = Math.floor(Math.min(S.mapInner.w / tw, S.mapInner.h / th));
    S.tile = {
      size: Math.max(6, size),
      originX: Math.round(S.mapInner.x + (S.mapInner.w - size * tw) / 2),
      originY: Math.round(S.mapInner.y + (S.mapInner.h - size * th) / 2)
    };
    return S;
  }

  return { compute: compute, get: function () { return S; } };
})();
