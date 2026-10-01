/* main.js —— 入口 */
(function () {
  'use strict';

  RW.version = '0.2.0';  /* 与 VERSION 保持一致 */

  /* 横屏检测 */
  function updateOrientation() {
    document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
  }
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', updateOrientation);
  updateOrientation();

  RW.engine.init();
  RW.engine.start();
})();
