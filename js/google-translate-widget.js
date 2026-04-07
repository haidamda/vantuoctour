/**
 * Google Translate Widget SDK v2.0
 * Fully configurable language switcher dropdown.
 * Free, no API key required.
 */
(function(window, document) {
  'use strict';

  var GTWidget = {};
  var _config = {};
  var _langMap = {};
  var _initialized = false;

  // ======================== DEFAULTS ========================
  var DEFAULTS = {
    selector:         '#gt-widget',
    pageLanguage:     'vi',
    languages:        [
      { code: 'vi', label: 'Tiếng Việt', flag: 'vn' },
      { code: 'en', label: 'English',     flag: 'gb' }
    ],
    display:          'flag-text',
    showArrow:        true,
    size:             'md',
    flagStyle:        'rect',
    dropdownPosition: 'right',
    theme:            'default',
    cssVars:          {},
    onChange:          null
  };

  // ======================== CLEANUP URL ========================
  // Xóa cache-buster _gt khỏi address bar ngay khi page load (chạy 1 lần).
  (function _stripGtFromUrl() {
    try {
      if (location.search.indexOf('_gt=') === -1) return;
      var params = new URLSearchParams(location.search);
      if (!params.has('_gt')) return;
      params.delete('_gt');
      var qs = params.toString();
      var newUrl = location.pathname + (qs ? '?' + qs : '') + location.hash;
      history.replaceState(null, '', newUrl);
    } catch (e) {}
  })();

  // ======================== INIT ========================
  GTWidget.init = function(opts) {
    opts = opts || {};
    _config = {};
    for (var key in DEFAULTS) {
      _config[key] = opts[key] !== undefined ? opts[key] : DEFAULTS[key];
    }

    _langMap = {};
    _config.languages.forEach(function(l) { _langMap[l.code] = l; });

    _renderWidget();
    _restoreFromCookie();
    if (!_initialized) {
      _initGoogleTranslate();
      _observeGoogleDOM();
      _bindOutsideClick();
      _initialized = true;
    }
  };

  // ======================== RENDER ========================
  function _renderWidget() {
    var container = document.querySelector(_config.selector);
    if (!container) return;

    var gtEl = document.getElementById('google_translate_element');
    if (!gtEl) {
      gtEl = document.createElement('div');
      gtEl.id = 'google_translate_element';
      document.body.appendChild(gtEl);
    }

    var classes = ['gt-widget'];
    if (_config.size === 'sm') classes.push('gt-sm');
    if (_config.size === 'lg') classes.push('gt-lg');
    if (_config.display !== 'flag-text') classes.push('gt-' + _config.display);
    if (_config.flagStyle === 'circle')  classes.push('gt-flag-circle');
    if (_config.flagStyle === 'rounded') classes.push('gt-flag-rounded');
    if (_config.dropdownPosition === 'left')   classes.push('gt-drop-left');
    if (_config.dropdownPosition === 'center') classes.push('gt-drop-center');
    if (_config.theme !== 'default') classes.push('gt-' + _config.theme);
    if (!_config.showArrow) classes.push('gt-no-arrow');

    container.className = classes.join(' ');

    if (_config.cssVars) {
      for (var varName in _config.cssVars) {
        container.style.setProperty(varName, _config.cssVars[varName]);
      }
    }

    var defaultLang = _config.languages[0];
    var isCodeMode = (_config.display === 'code-only' || _config.display === 'flag-code');
    var defaultLabel = isCodeMode ? defaultLang.code.toUpperCase().split('-')[0] : defaultLang.label;

    var html = '';
    html += '<div class="gt-widget-selected" data-gt-toggle>';
    html += '<img class="gt-flag" src="https://flagcdn.com/w40/' + defaultLang.flag + '.png" alt="flag"/>';
    html += '<span class="gt-label">' + _escHtml(defaultLabel) + '</span>';
    if (_config.showArrow) {
      html += '<span class="gt-arrow">&#9660;</span>';
    }
    html += '</div>';

    html += '<div class="gt-widget-dropdown">';
    _config.languages.forEach(function(lang) {
      var activeClass = lang.code === defaultLang.code ? ' active' : '';
      var optLabel = isCodeMode ? lang.code.toUpperCase().split('-')[0] : lang.label;
      html += '<div class="gt-widget-option' + activeClass + '" data-lang="' + lang.code + '" data-flag="' + lang.flag + '">';
      html += '<img src="https://flagcdn.com/w40/' + lang.flag + '.png" alt="' + lang.code + '"/>';
      html += '<span class="gt-opt-label">' + _escHtml(optLabel) + '</span>';
      html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;

    container.querySelector('[data-gt-toggle]').addEventListener('click', function(e) {
      e.stopPropagation();
      container.classList.toggle('open');
    });

    container.querySelectorAll('.gt-widget-option').forEach(function(opt) {
      opt.addEventListener('click', function() {
        _selectLang(this.getAttribute('data-lang'));
      });
    });
  }

  // ======================== RESTORE FROM COOKIE ========================
  function _restoreFromCookie() {
    var match = document.cookie.match(/googtrans=\/[^/]+\/(\S+?)(?:;|$)/);
    var currentLang = match ? match[1] : _config.pageLanguage;
    _updateUI(currentLang);
  }

  // ======================== UPDATE UI ========================
  function _updateUI(langCode) {
    var info = _langMap[langCode];
    if (!info) return;

    var container = document.querySelector(_config.selector);
    if (!container) return;

    var isCodeMode = (_config.display === 'code-only' || _config.display === 'flag-code');
    var label = isCodeMode ? langCode.toUpperCase().split('-')[0] : info.label;

    var flagEl = container.querySelector('.gt-flag');
    var labelEl = container.querySelector('.gt-label');
    if (flagEl) flagEl.src = 'https://flagcdn.com/w40/' + info.flag + '.png';
    if (labelEl) labelEl.textContent = label;

    container.querySelectorAll('.gt-widget-option').forEach(function(o) {
      o.classList.toggle('active', o.getAttribute('data-lang') === langCode);
    });
    container.classList.remove('open');
  }

  // ======================== SELECT LANGUAGE ========================
  // Tất cả domain scope mà Google Translate có thể đã set cookie
  function _cookieDomains() {
    var host = location.hostname;
    var list = ['', host, '.' + host];
    var parts = host.split('.');
    // Thêm tất cả parent domain: a.b.c → .a.b.c, .b.c
    for (var i = 1; i < parts.length - 1; i++) {
      list.push('.' + parts.slice(i).join('.'));
    }
    return list;
  }

  function _cookiePaths() {
    var paths = ['/'];
    if (location.pathname && location.pathname !== '/') {
      // Thêm pathname hiện tại + thư mục cha
      paths.push(location.pathname);
      var parent = location.pathname.replace(/\/[^\/]*$/, '/');
      if (parent !== '/' && parent !== location.pathname) paths.push(parent);
    }
    return paths;
  }

  // Xóa TẤT CẢ cookie googtrans* (enumerate cookies hiện có để lấy đúng tên)
  function _nukeAllGoogtransCookies() {
    var domains = _cookieDomains();
    var paths = _cookiePaths();
    var expired = '; expires=Thu, 01 Jan 1970 00:00:00 UTC';

    // Lấy danh sách cookie name bắt đầu bằng 'googtrans'
    var names = ['googtrans'];
    document.cookie.split(';').forEach(function(c) {
      var n = c.split('=')[0].trim();
      if (n.indexOf('googtrans') === 0 && names.indexOf(n) === -1) {
        names.push(n);
      }
    });

    // Xóa từng tên cookie ở mọi tổ hợp domain × path
    names.forEach(function(name) {
      domains.forEach(function(d) {
        paths.forEach(function(p) {
          var domainAttr = d ? '; domain=' + d : '';
          document.cookie = name + '=' + expired + '; path=' + p + domainAttr;
        });
      });
    });
  }

  function _setGoogtransCookie(value) {
    _cookieDomains().forEach(function(d) {
      _cookiePaths().forEach(function(p) {
        var domainAttr = d ? '; domain=' + d : '';
        document.cookie = 'googtrans=' + value + '; path=' + p + domainAttr;
      });
    });
  }

  function _hardNavigate() {
    // Navigate (không phải reload) để bypass mọi cache, không thêm history entry.
    // Strip _gt cũ trước khi set mới → URL không bị phình ra qua mỗi click.
    var params = new URLSearchParams(location.search);
    params.delete('_gt');
    params.set('_gt', Date.now());
    var qs = params.toString();
    location.replace(location.pathname + (qs ? '?' + qs : ''));
  }

  function _selectLang(lang) {
    var info = _langMap[lang];
    _updateUI(lang);

    if (typeof _config.onChange === 'function') {
      _config.onChange(lang, info);
    }

    if (lang === _config.pageLanguage) {
      // Switch về ngôn ngữ gốc: nuke toàn bộ cookie googtrans* rồi navigate
      _nukeAllGoogtransCookies();
      _hardNavigate();
    } else {
      // Switch sang ngôn ngữ khác: nuke trước (xóa cookie cũ nếu có), set mới, navigate
      _nukeAllGoogtransCookies();
      _setGoogtransCookie('/' + _config.pageLanguage + '/' + lang);
      _hardNavigate();
    }
  }

  // ======================== GOOGLE TRANSLATE ========================
  function _initGoogleTranslate() {
    var codes = _config.languages.map(function(l) { return l.code; }).join(',');

    window.googleTranslateElementInit = function() {
      new google.translate.TranslateElement({
        pageLanguage: _config.pageLanguage,
        includedLanguages: codes,
        autoDisplay: false
      }, 'google_translate_element');
    };

    var script = document.createElement('script');
    script.src = '//translate.googleapis.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(script);
  }

  // ======================== HIDE GOOGLE BANNER ========================
  function _observeGoogleDOM() {
    new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType === 1 && node.classList && node.classList.contains('skiptranslate')) {
            node.style.display = 'none';
            node.style.height = '0';
            node.style.overflow = 'hidden';
          }
        });
      });
      document.body.style.top = '0px';
    }).observe(document.body, { childList: true });
  }

  // ======================== OUTSIDE CLICK ========================
  function _bindOutsideClick() {
    document.addEventListener('click', function(e) {
      var container = document.querySelector(_config.selector);
      if (container && !container.contains(e.target)) {
        container.classList.remove('open');
      }
    });
  }

  // ======================== HELPERS ========================
  function _escHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ======================== PUBLIC API ========================
  GTWidget.setLanguage = function(langCode) {
    _selectLang(langCode);
  };

  GTWidget.getCurrentLanguage = function() {
    var match = document.cookie.match(/googtrans=\/[^/]+\/(\S+?)(?:;|$)/);
    return match ? match[1] : _config.pageLanguage;
  };

  GTWidget.getConfig = function() {
    return JSON.parse(JSON.stringify(_config));
  };

  GTWidget.destroy = function() {
    var container = document.querySelector(_config.selector);
    if (container) {
      container.innerHTML = '';
      container.className = '';
      container.removeAttribute('style');
    }
    _config = {};
    _langMap = {};
    _initialized = false;
  };

  window.GoogleTranslateWidget = GTWidget;

  // ======================== AUTO-INIT (DATA ATTRIBUTES) ========================
  function _autoInit() {
    var el = document.querySelector('[data-gt-widget]');
    if (!el) return;

    var langsStr = el.getAttribute('data-gt-languages') || '';
    if (!langsStr) return;

    var languages = langsStr.split(',').map(function(item) {
      var parts = item.trim().split(':');
      return { code: parts[0], label: parts[1] || parts[0], flag: parts[2] || parts[0] };
    }).filter(function(l) { return l.code; });

    if (languages.length === 0) return;

    var selector;
    if (el.id) {
      selector = '#' + el.id;
    } else {
      el.id = 'gt-widget-auto';
      selector = '#gt-widget-auto';
    }

    var opts = {
      selector:         selector,
      pageLanguage:     el.getAttribute('data-gt-page-language') || 'vi',
      languages:        languages,
      display:          el.getAttribute('data-gt-display') || 'flag-text',
      size:             el.getAttribute('data-gt-size') || 'md',
      flagStyle:        el.getAttribute('data-gt-flag-style') || 'rect',
      dropdownPosition: el.getAttribute('data-gt-dropdown-position') || 'right',
      theme:            el.getAttribute('data-gt-theme') || 'default',
      showArrow:        el.getAttribute('data-gt-show-arrow') !== 'false'
    };

    GTWidget.init(opts);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})(window, document);
