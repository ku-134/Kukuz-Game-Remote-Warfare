/* main.js —— 入口 */
(function () {
  'use strict';

  RW.version = '0.1.0';  /* 与 VERSION 保持一致 */

  RW.settings.apply();
  RW.input.bind();

  /* 横屏 / 竖屏检测，切换提示层 */
  function updateOrientation() {
    document.body.classList.toggle('portrait', window.innerHeight > window.innerWidth);
  }
  window.addEventListener('resize', updateOrientation);
  window.addEventListener('orientationchange', updateOrientation);
  updateOrientation();

  RW.engine.init();
  RW.engine.start();
})();
