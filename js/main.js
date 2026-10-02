/* main.js —— 入口 */
(function () {
  'use strict';

  RW.version = '0.3.0';

  /* 横屏检测 */
  function updateOrientation() {
    document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
  }
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', updateOrientation);
  updateOrientation();

  /* 横屏提示页的实时时钟 */
  var clock = document.getElementById('rt-clock');
  if (clock) {
    setInterval(function () {
      var d = new Date();
      var p = function (n) { return n < 10 ? '0' + n : '' + n; };
      clock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }, 1000);
  }

  RW.engine.init();
  RW.engine.start();
})();
