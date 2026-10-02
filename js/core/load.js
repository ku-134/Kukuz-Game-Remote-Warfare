/* core/load.js —— 资源与模块装载登记 */
RW.load = (function () {
  'use strict';

  var list = [
    { key: 'utils',    name: 'CORE.UTILS' },
    { key: 'settings', name: 'CORE.SETTINGS' },
    { key: 'fx',       name: 'CORE.FX.DISPLAY' },
    { key: 'input',    name: 'CORE.INPUT' },
    { key: 'layout',   name: 'CORE.LAYOUT' },
    { key: 'terrain',  name: 'SYS.TERRAIN' },
    { key: 'unit',     name: 'SYS.UNIT' },
    { key: 'ui',       name: 'UI.FRAMEWORK' },
    { key: 'menu',     name: 'SCREEN.MENU' },
    { key: 'engine',   name: 'CORE.ENGINE' }
  ];

  function items() {
    return list.map(function (m) {
      return { key: m.key, name: m.name, ok: !!RW[m.key] };
    });
  }

  function allLoaded() {
    for (var i = 0; i < list.length; i++) if (!RW[list[i].key]) return false;
    return true;
  }

  return { items: items, allLoaded: allLoaded };
})();
