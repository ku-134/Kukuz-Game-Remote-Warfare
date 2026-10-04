/* main.js —— 入口 */
(function () {
  'use strict';

  RW.version = '0.5.0';

  function updateOrientation() {
    document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
  }
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', updateOrientation);
  updateOrientation();

  var clock = document.getElementById('rt-clock');
  if (clock) {
    var tick = function () {
      var d = new Date();
      var p = function (n) { return n < 10 ? '0' + n : '' + n; };
      clock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    };
    tick();
    setInterval(tick, 1000);
  }

  RW.engine.init();
  RW.engine.start();
})();
