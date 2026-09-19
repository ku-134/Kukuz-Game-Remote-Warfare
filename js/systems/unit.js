/* systems/unit.js —— 单位：人数 / 物资 / Buff 三类变量 + 渲染 */
RW.unit = (function () {
  'use strict';

  /* 兵种类型（占位，后续 data/unitTypes.js 扩展） */
  var TYPES = {
    infantry: { name: '步兵团', move: 3, combat: 2 },
    armored:  { name: '装甲团', move: 2, combat: 5 },
    recon:    { name: '侦察连', move: 5, combat: 1 }
  };

  function create(type, x, y) {
    var t = TYPES[type] || TYPES.infantry;
    return {
      id: 'u' + (Math.random() * 1e6 | 0),
      type: type, name: t.name,
      x: x, y: y,
      strength: 100,   /* 剩余人数（血量/完整度） */
      supply: 100,     /* 剩余物资 */
      buffs: [],       /* Buff 状态 */
      selected: false,
      stats: { move: t.move, combat: t.combat }
    };
  }

  /* 移动消耗：距离 + 高度差 + 长距离额外惩罚（人心俱疲） */
  function moveCost(u, from, to, terrain) {
    var dist = Math.hypot(to.x - from.x, to.y - from.y);
    var dh = Math.abs(terrain.heightAt(to.x, to.y) - terrain.heightAt(from.x, from.y));
    var fatigue = dist > u.stats.move * 1.8 ? 1.4 : 1.0;
    return { cost: Math.round((dist * 2 + dh * 6) * fatigue), fatigued: fatigue > 1 };
  }

  function draw(ctx, u, tile, terrain) {
    var px = tile.originX + (u.x + 0.5) * tile.size;
    var py = tile.originY + (u.y + 0.5) * tile.size;
    var r = tile.size * 0.35;
    ctx.fillStyle = u.selected ? '#ffffff' : '#33ff33';
    ctx.strokeStyle = '#003300';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    /* 人数/物资占位指示条 */
    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(px - r * 0.5, py - 1, r, 2);
  }

  return { TYPES: TYPES, create: create, moveCost: moveCost, draw: draw };
})();
