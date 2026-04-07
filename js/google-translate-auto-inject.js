/**
 * GTranslate Auto-Inject
 * Tự động tìm language switcher cũ trong DOM và thay thế bằng widget GTranslate.
 * Không cần sửa file switcher của từng theme.
 *
 * Yêu cầu: window.GTranslateAutoInject phải được set trước (do PHP inject)
 *   {
 *     pageLanguage: 'vi',
 *     languages: 'vi:Tiếng Việt:vn,en:English:gb',
 *     display: 'flag-text',
 *     size: 'md',
 *     flagStyle: 'rect',
 *     theme: 'default',
 *     showArrow: true,
 *     selectors: ['.language-dropdown', '...']  // optional
 *   }
 */
(function() {
  'use strict';

  if (!window.GTranslateAutoInject) return;
  var cfg = window.GTranslateAutoInject;

  // Selector mặc định bao quát các theme phổ biến trong project
  var DEFAULT_SELECTORS = [
    '.gt-widget.select-language-pc',
    'li.dropdown.language-dropdown',
    '#header .menu li.dropdown:has(.flag-icon)',
    'header li.dropdown:has([class*="flag-icon-"])',
    '.header-language',
    '.lang-switcher'
  ];

  var selectors = (cfg.selectors && cfg.selectors.length) ? cfg.selectors : DEFAULT_SELECTORS;

  function findTarget() {
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) return el;
      } catch (e) {
        // :has() có thể không support trên trình duyệt cũ
      }
    }
    return null;
  }

  function parseLanguages(str) {
    return (str || '').split(',').map(function(s) {
      var p = s.trim().split(':');
      return { code: p[0], label: p[1] || p[0], flag: p[2] || p[0] };
    }).filter(function(l) { return l.code; });
  }

  function inject() {
    var target = findTarget();
    if (!target) {
      if (window.console) console.warn('[GTranslate] Không tìm thấy language switcher để thay thế. Selectors:', selectors);
      return;
    }

    // Tạo element thay thế (giữ nguyên tag để không phá layout: li → li, div → div)
    var tag = (target.tagName || 'div').toLowerCase();
    var container = document.createElement(tag);
    container.id = 'gtranslate-auto-injected';
    // Giữ class gốc để CSS theme vẫn áp dụng (margin, padding của <li> trong nav)
    if (target.className) container.className = target.className;

    target.parentNode.replaceChild(container, target);

    // Init SDK trên element mới (poll cho tới khi SDK load xong)
    var attempts = 0;
    function tryInit() {
      if (!window.GoogleTranslateWidget) {
        if (++attempts > 100) return; // ~3s
        setTimeout(tryInit, 30);
        return;
      }

      window.GoogleTranslateWidget.init({
        selector:     '#gtranslate-auto-injected',
        pageLanguage: cfg.pageLanguage || 'vi',
        languages:    parseLanguages(cfg.languages),
        display:      cfg.display     || 'flag-text',
        size:         cfg.size        || 'md',
        flagStyle:    cfg.flagStyle   || 'rect',
        theme:        cfg.theme       || 'default',
        showArrow:    cfg.showArrow !== false && cfg.showArrow !== 'false'
      });
    }
    tryInit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
