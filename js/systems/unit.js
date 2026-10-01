/* systems/unit.js —— 单位：人数 / 物资 / Buff 三类变量 + 棋子式渲染（完整实现见本地源码） */
RW.unit = (function () {
  'use strict';

  var TYPES = {
    infantry: { name: '步兵团', abbr: 'INF', move: 3, combat: 2, size: 0.30 },
    armored:  { name: '装甲团', abbr: 'ARM', move: 2, combat: 5, size: 0.34 },
    recon:    { name: '侦察连', abbr: 'RCN', move: 5, combat: 1, size: 0.24 }
  };

  function create(type, x, y) {
    var t = TYPES[type] || TYPES.infantry;
    return {
      id: 'u' + (Math.random() * 1e6 | 0),
      type: type, name: t.name, abbr: t.abbr,
      x: x, y: y,
      strength: 100, supply: 100, buffs: [],
      selected: false,
      stats: { move: t.move, combat: t.combat }
    };
  }

  function moveCost(u, from, to, terrain) {
    var dist = Math.hypot(to.x - from.x, to.y - from.y);
    var dh = Math.abs(terrain.heightAt(to.x, to.y) - terrain.heightAt(from.x, from.y));
    var fatigue = dist > u.stats.move * 1.8 ? 1.4 : 1.0;
    return { cost: Math.round((dist * 2 + dh * 6) * fatigue), fatigued: fatigue > 1 };
  }

  /* 棋子：六边形底盘 + 兵种缩写 + 双向状态条；选中带旋转方框与十字准星 */
  function draw(ctx, u, tile, terrain, t) {
    var cx = tile.originX + (u.x + 0.5) * tile.size;
    var cy = tile.originY + (u.y + 0.5) * tile.size;
    var r = tile.size * 0.40;
    var sel = u.selected;

    if (sel) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = '#33ff33';
      ctx.lineWidth = 1.6;
      ctx.rotate((t || 0) * 1.6);
      ctx.strokeRect(-r * 1.35, -r * 1.35, r * 2.7, r * 2.7);
      ctx.restore();
      ctx.strokeStyle = '#33ff33';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - r * 2, cy); ctx.lineTo(cx - r * 1.4, cy);
      ctx.moveTo(cx + r * 1.4, cy); ctx.lineTo(cx + r * 2, cy);
      ctx.moveTo(cx, cy - r * 2); ctx.lineTo(cx, cy - r * 1.4);
      ctx.moveTo(cx, cy + r * 1.4); ctx.lineTo(cx, cy + r * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var ang = Math.PI / 6 + i * Math.PI / 3;
      var px = cx + Math.cos(ang) * r, py = cy + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = sel ? 'rgba(51,255,51,0.55)' : 'rgba(0,60,0,0.85)';
    ctx.fill();
    ctx.strokeStyle = sel ? '#ffffff' : '#33ff33';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.font = 'bold ' + Math.round(tile.size * 0.30) + 'px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = sel ? '#001100' : '#33ff33';
    ctx.fillText(u.abbr, cx, cy + 0.5);
    ctx.restore();

    var bw = r * 1.7, bh = Math.max(2, tile.size * 0.07);
    ctx.fillStyle = 'rgba(0,40,0,0.9)';
    ctx.fillRect(cx - bw / 2, cy + r * 1.15, bw, bh);
    ctx.fillStyle = '#33ff33';
    ctx.fillRect(cx - bw / 2, cy + r * 1.15, bw * (u.strength / 100), bh);
    ctx.fillStyle = 'rgba(0,40,0,0.9)';
    ctx.fillRect(cx - bw / 2, cy - r * 1.15 - bh, bw, bh);
    ctx.fillStyle = '#00aa00';
    ctx.fillRect(cx - bw / 2, cy - r * 1.15 - bh, bw * (u.supply / 100), bh);
  }

  return { TYPES: TYPES, create: create, moveCost: moveCost, draw: draw };
})();
