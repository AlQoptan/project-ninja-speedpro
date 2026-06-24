import json, re

seed   = json.load(open('_seed.json',   encoding='utf-8'))   # ar -> en (from existing L() + translations)
manual = json.load(open('_manual.json', encoding='utf-8'))   # ar -> en (new, index.html + JS)
drv    = json.load(open('_manual_driver.json', encoding='utf-8'))  # ar -> en (driver portal)
dyn    = json.load(open('_manual_dynamic.json', encoding='utf-8')) # ar -> en (dynamic JS/template content)
manual = dict(manual); manual.update(drv); manual.update(dyn)
final  = json.load(open('_final.json',  encoding='utf-8')) + json.load(open('_keep.json', encoding='utf-8'))  # required keys

# ---- coverage check ----
missing = [k for k in final if k not in manual]
open('_missing.txt','w',encoding='utf-8').write('\n'.join(missing))
print("MISSING from manual: %d (see _missing.txt)" % len(missing))

# ---- merge: seed first (app's own approved EN), manual fills the rest ----
AR = re.compile(r'[؀-ۿ]')
def junk(s):
    if re.search(r'===|!==|=>|logAudit|\$\{', s): return True
    if not s.strip(): return True
    if s.strip() in ('و','،','؟'): return True
    if s[0] in ':)]': return True
    return False

merged = {}
for src in (seed, manual):
    for ar, en in src.items():
        ar2 = ar.strip()
        if not ar2 or junk(ar2): continue
        if not AR.search(ar2): continue
        merged.setdefault(ar2, en.strip())

# manual should win over seed only where it adds; keep seed where both exist already handled by setdefault order (seed first)
# but ensure manual entries present even if seed missing
for ar, en in manual.items():
    ar2 = ar.strip()
    if junk(ar2) or not AR.search(ar2): continue
    merged.setdefault(ar2, en.strip())

print("MERGED dict entries: %d" % len(merged))

dict_json = json.dumps(merged, ensure_ascii=False, indent=0, sort_keys=True)

js = '''// ==========================================================================
//  SpeedPro — Automatic Arabic <-> English UI translation layer
//  Generated dictionary + runtime walker. Works alongside data-i18n / L().
//  Safe: only EXACT dictionary matches are translated; user data stays as-is.
// ==========================================================================
(function () {
  'use strict';

  var DICT_AR_EN = __DICT__;

  // reverse map (en -> ar), first key wins on collisions
  var DICT_EN_AR = {};
  for (var k in DICT_AR_EN) {
    if (Object.prototype.hasOwnProperty.call(DICT_AR_EN, k)) {
      var v = DICT_AR_EN[k];
      if (!(v in DICT_EN_AR)) DICT_EN_AR[v] = k;
    }
  }
  window.__I18N_DICT_AR_EN = DICT_AR_EN;
  window.__I18N_DICT_EN_AR = DICT_EN_AR;

  function curLang() {
    if (typeof currentLang !== 'undefined' && currentLang) return currentLang;
    return localStorage.getItem('app_lang') || 'ar';
  }

  function lookup(s, lang) {
    return (lang === 'en') ? DICT_AR_EN[s] : DICT_EN_AR[s];
  }

  var SKIP_TAGS = { SCRIPT:1, STYLE:1, TEXTAREA:1, CODE:1, PRE:1, NOSCRIPT:1 };

  // should we translate this text node?
  function nodeAllowed(node, root) {
    var p = node.parentNode;
    if (!p) return false;
    if (SKIP_TAGS[p.nodeName]) return false;
    // <option> with no explicit value: its value === its text -> do NOT translate
    if (p.nodeName === 'OPTION' && !p.hasAttribute('value')) return false;
    var el = p;
    while (el && el !== root) {
      if (el.nodeType === 1 && el.hasAttribute) {
        if (el.hasAttribute('data-i18n'))    return false;
        if (el.hasAttribute('data-no-i18n')) return false;
      }
      el = el.parentNode;
    }
    return true;
  }

  function translateTextNodes(root, lang) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var batch = [], n;
    while ((n = walker.nextNode())) batch.push(n);
    for (var i = 0; i < batch.length; i++) {
      var node = batch[i];
      var raw = node.nodeValue;
      if (!raw) continue;
      var t = raw.trim();
      if (!t) continue;
      if (!nodeAllowed(node, root)) continue;
      var rep = lookup(t, lang);
      if (rep !== undefined && rep !== t) {
        node.nodeValue = raw.replace(t, rep);
      }
    }
  }

  var ATTRS = ['placeholder', 'title', 'aria-label'];
  function translateAttrs(root, lang) {
    var els;
    if (root.nodeType === 1 && root.matches && root.matches('[placeholder],[title],[aria-label]')) {
      els = [root];
    } else {
      els = [];
    }
    if (root.querySelectorAll) {
      var found = root.querySelectorAll('[placeholder],[title],[aria-label]');
      for (var j = 0; j < found.length; j++) els.push(found[j]);
    }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.closest && el.closest('[data-no-i18n]')) continue;
      for (var a = 0; a < ATTRS.length; a++) {
        var attr = ATTRS[a];
        if (!el.hasAttribute(attr)) continue;
        if (attr === 'placeholder' && el.hasAttribute('data-i18n-ph')) continue;
        var cur = el.getAttribute(attr);
        var t = cur ? cur.trim() : '';
        if (!t) continue;
        var rep = lookup(t, lang);
        if (rep !== undefined && rep !== t) {
          el.setAttribute(attr, cur.replace(t, rep));
        }
      }
    }
  }

  var _busy = false;

  function translateTree(root, lang) {
    if (!root) return;
    if (root.nodeType === 1) translateTextNodes(root, lang);
    else if (root.nodeType === 11) translateTextNodes(root, lang); // fragment
    if (root.nodeType === 1) translateAttrs(root, lang);
    else if (root.nodeType === 3) {
      var t = root.nodeValue ? root.nodeValue.trim() : '';
      if (t) {
        var rep = lookup(t, lang);
        if (rep !== undefined && rep !== t) root.nodeValue = root.nodeValue.replace(t, rep);
      }
    }
  }

  function autoTranslatePage(lang) {
    lang = lang || curLang();
    _busy = true;
    try { translateTree(document.body, lang); }
    finally { _busy = false; }
  }
  window.autoTranslatePage = autoTranslatePage;

  // Observe dynamically-added content and translate it while in English.
  var observer = new MutationObserver(function (mutations) {
    if (_busy) return;
    var lang = curLang();
    if (lang !== 'en') return; // base language is Arabic; nothing to do
    _busy = true;
    try {
      for (var m = 0; m < mutations.length; m++) {
        var added = mutations[m].addedNodes;
        for (var i = 0; i < added.length; i++) {
          var node = added[i];
          if (node.nodeType === 1) translateTree(node, lang);
          else if (node.nodeType === 3) {
            var tt = node.nodeValue ? node.nodeValue.trim() : '';
            if (tt) {
              var rep = DICT_AR_EN[tt];
              if (rep !== undefined && rep !== tt) node.nodeValue = node.nodeValue.replace(tt, rep);
            }
          }
        }
      }
    } finally { _busy = false; }
  });

  document.addEventListener('DOMContentLoaded', function () {
    if (curLang() === 'en') autoTranslatePage('en');
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  });
})();
'''

js = js.replace('__DICT__', dict_json)
open('i18n_auto.js', 'w', encoding='utf-8').write(js)
print('WROTE i18n_auto.js (%d bytes)' % len(js))
