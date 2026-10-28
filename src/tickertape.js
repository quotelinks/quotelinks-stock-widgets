/*! Quotelinks Ticker Tape widget v1 | https://www.quotelinks.com/widgets/tickertape.html
 *
 * Embed:
 *   <div class="ql-tickertape" data-symbols="AAPL,MSFT,NVDA,AMZN,SPY,QQQ" data-theme="light">
 *     Stock quotes by <a href="https://www.quotelinks.com/">Quotelinks</a>
 *   </div>
 *   <script src="https://www.quotelinks.com/widgets/tickertape.js" async></script>
 *
 * Attributes (frozen contract: never renamed or removed, only optional ones may be added):
 *   data-symbols  comma-separated tickers, up to 20 (BRK.B or BRK-B); missing = the largest US stocks + SPY, QQQ
 *   data-size     "regular" (default: symbol, price, change) | "compact" (symbol, change)
 *   data-theme    "light" (default) | "dark" | "auto" (follows the visitor's system setting)
 *   data-style    "boxed" (rounded border, for use inside a page) | omitted (full-width strip)
 *   data-speed    "slow" | "normal" (default) | "fast" | "still" (no scrolling; swipe to see more)
 *
 * The Quotelinks link inside the div stays in the host page (light DOM) and is shown at the right end of the strip
 * through a named slot; it is never removed, hidden or changed. Each symbol opens its quotelinks.com page in a new tab.
 * Rendering is in a Shadow DOM. One request per tape: /widgets/api/tickertape.php (end-of-day data, cached 15 min).
 * Scrolling pauses on hover / keyboard focus and when the strip is off screen; "reduce motion" visitors get a still strip.
 */
(function () {
  'use strict';
  if (window.qlTickertape) { window.qlTickertape.scan(); return; }

  var script = document.currentScript;
  var BASE = 'https://www.quotelinks.com';
  try { if (script && script.src) BASE = new URL(script.src).origin; } catch (e) {}
  var API = BASE + '/widgets/api/tickertape.php';
  var SEL = '.ql-tickertape';
  var SPEED = { slow: 30, normal: 50, fast: 80 };     // pixels per second
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var cache = {};

  var CSS = [
    ':host{all:initial;display:block;margin:0}',
    ':host{padding:0!important;border:0!important;background:none!important;box-shadow:none!important;float:none!important}',
    ':host([hidden]){display:none}',
    '.w{container-type:inline-size}',
    '.t{--bg:#fff;--tx:#111827;--mu:#6b7280;--ln:#e5e7eb;--ac:#1d4ed8;--up:#047857;--dn:#c2410c;',
    'position:relative;display:flex;align-items:stretch;height:40px;background:var(--bg);color:var(--tx);border-bottom:1px solid var(--ln);box-sizing:border-box;',
    'font:13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;overflow:hidden;-webkit-font-smoothing:antialiased;text-align:left}',
    '.t.bx{border:1px solid var(--ln);border-radius:10px}',
    '.t.dk{--bg:#111827;--tx:#f3f4f6;--mu:#9ca3af;--ln:#1f2937;--ac:#60a5fa;--up:#34d399;--dn:#fb923c}',
    '.t.cmp{height:32px;font-size:12px}',
    '*{box-sizing:border-box}',
    '.vp{flex:1;min-width:0;overflow:hidden;position:relative}',
    '.t.run .vp{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 24px,#000 calc(100% - 24px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 24px,#000 calc(100% - 24px),transparent 100%)}',
    '.t.still .vp{overflow-x:auto;scrollbar-width:none}.t.still .vp::-webkit-scrollbar{display:none}',
    '.tr{display:flex;width:max-content;height:100%}',
    '.t.run .tr{animation:qltt var(--dur,60s) linear infinite}',
    '.t.run:hover .tr,.t.run:focus-within .tr,.t.off .tr{animation-play-state:paused}',
    '@keyframes qltt{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
    '.it{display:flex;align-items:center;gap:7px;padding:0 16px;height:100%;white-space:nowrap;color:inherit;text-decoration:none;border-right:1px solid var(--ln)}',
    '.t.cmp .it{padding:0 12px;gap:6px}',
    'a.it:hover{background:rgba(127,127,127,.08)}',
    'a.it:focus-visible{outline:2px solid var(--ac);outline-offset:-2px}',
    '.s{font-weight:700}',
    '.p{font-variant-numeric:tabular-nums}.t.cmp .p{display:none}',
    '.c{font-weight:600;font-variant-numeric:tabular-nums}',
    '.c.u{color:var(--up)}.c.d{color:var(--dn)}.c.f{color:var(--mu)}',
    '.c.u::before{content:"\\25B2\\00A0";font-size:9px}.c.d::before{content:"\\25BC\\00A0";font-size:9px}',
    '.ph{color:var(--mu)}',
    '.na{display:flex;align-items:center;padding:0 16px;color:var(--mu);height:100%}',
    '.by{flex:none;display:flex;align-items:center;gap:4px;padding:0 14px;font-size:11.5px;color:var(--mu);border-left:1px solid var(--ln);background:var(--bg);white-space:nowrap}',
    '.as{font-size:10.5px;margin-right:6px}',
    '@container (max-width:560px){.as{display:none}}',
    '@container (max-width:420px){.q{display:none}.by{padding:0 10px}}',
    '::slotted(a){color:var(--ac)!important;font-weight:700!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;background:none!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important}',
    '::slotted(a:hover){text-decoration:underline!important}',
    '.ow{color:var(--ac);font-weight:700;text-decoration:none}.ow:hover{text-decoration:underline}'
  ].join('');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function num(v, d) { return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function show(s) { return s.replace(/-/g, '.'); }
  function day(d) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(d || ''); return m ? MON[+m[2] - 1] + ' ' + (+m[3]) : ''; }
  function norm(list) {
    var out = [];
    (list || '').split(/[\s,;]+/).forEach(function (s) {
      s = s.toUpperCase().replace(/\./g, '-');
      if (/^[A-Z][A-Z0-9\-]{0,9}$/.test(s) && out.indexOf(s) < 0 && out.length < 20) out.push(s);
    });
    return out;
  }

  function item(e, clone) {
    var h = '<span class="s">' + esc(show(e.s)) + '</span>';
    if (e.p == null) h += '<span class="p ph">\u2014</span>';
    else {
      var d = e.cp > 0 ? 'u' : e.cp < 0 ? 'd' : 'f', sg = e.cp > 0 ? '+' : '';
      h += '<span class="p">' + num(e.p, Math.abs(e.p) >= 1 ? 2 : 4) + '</span>' +
        (e.cp != null ? '<span class="c ' + d + '">' + sg + num(e.cp, 2) + '%</span>' : '');
    }
    if (!e.u) return '<span class="it">' + h + '</span>';
    return '<a class="it" href="' + esc(BASE + e.u) + '" target="_blank" rel="noopener" title="' + esc(show(e.s)) + ' quote"' +
      (clone ? ' tabindex="-1" aria-hidden="true"' : '') + '>' + h + '</a>';
  }

  function load(syms) {
    var key = syms.join(',');
    if (!cache[key]) {
      cache[key] = fetch(API + (key ? '?symbols=' + encodeURIComponent(key) : ''), { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j && j.v === 1 && j.q ? j : null; })
        .catch(function () { return null; });
    }
    return cache[key];
  }

  function brandLink(el) {
    for (var i = 0; i < el.children.length; i++) {
      var a = el.children[i], u;
      if (a.tagName !== 'A' || !a.getAttribute('href')) continue;
      try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
      if ((/(^|\.)quotelinks\.com$/i.test(u.hostname) || u.origin === BASE)) return a;
    }
    return null;
  }

  function render(el) {
    if (!el.attachShadow || el.__qltt) return;
    el.__qltt = 1;
    var brand = brandLink(el);
    if (brand) brand.setAttribute('slot', 'brand');
    var root = el.shadowRoot || el.attachShadow({ mode: 'open' });
    var syms = norm(el.getAttribute('data-symbols'));
    var size = (el.getAttribute('data-size') || '').toLowerCase() === 'compact' ? ' cmp' : '';
    var th = (el.getAttribute('data-theme') || 'light').toLowerCase();
    var dark = th === 'dark' || (th === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var boxed = (el.getAttribute('data-style') || '').toLowerCase() === 'boxed';
    var sp = (el.getAttribute('data-speed') || 'normal').toLowerCase();
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pxps = sp === 'still' || reduce ? 0 : (SPEED[sp] || SPEED.normal);
    var cls = 't still' + size + (dark ? ' dk' : '') + (boxed ? ' bx' : '');
    var by = brand ? '<slot name="brand"></slot>' : '<a class="ow" href="' + BASE + '/" target="_blank" rel="noopener">Quotelinks</a>';

    var paint = function (inner, asof) {
      root.innerHTML = '<style>' + CSS + '</style><div class="w"><div class="' + cls + '" role="region" aria-label="Stock quotes">' +
        '<div class="vp"><div class="tr">' + inner + '</div></div>' +
        '<div class="by">' + (asof ? '<span class="as">Close ' + esc(asof) + '</span>' : '') + '<span class="q">Quotes by</span> ' + by + '</div></div></div>';
    };
    paint(syms.length ? syms.map(function (s) { return item({ s: s }); }).join('') : '<span class="na">Loading quotes\u2026</span>', '');

    load(syms).then(function (j) {
      if (!j || !j.q.length) { paint('<span class="na">Quotes unavailable</span>', ''); return; }
      var html = j.q.map(function (e) { return item(e, false); }).join('');
      paint(html, day(j.d));
      var t = root.querySelector('.t'), tr = root.querySelector('.tr'), vp = root.querySelector('.vp');
      var running = false;
      var fit = function () {
        var need = pxps > 0 && tr.scrollWidth / (running ? 2 : 1) > vp.clientWidth + 1;
        if (need === running) return;
        running = need;
        if (need) {
          var w = tr.scrollWidth;
          tr.innerHTML = html + j.q.map(function (e) { return item(e, true); }).join('');
          tr.style.setProperty('--dur', Math.max(8, w / pxps).toFixed(1) + 's');
          t.className = t.className.replace(' still', '') + ' run';
        } else {
          tr.innerHTML = html;
          t.className = t.className.replace(' run', '') + ' still';
        }
      };
      fit();
      if (window.ResizeObserver) { var rt = 0; new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(fit, 150); }).observe(el); }
      if (window.IntersectionObserver) {
        new IntersectionObserver(function (es) { es.forEach(function (x) { t.classList.toggle('off', !x.isIntersecting); }); }).observe(el);
      }
    });
  }

  function scan() {
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) render(els[i]);
  }

  window.qlTickertape = { scan: scan, version: 1 };
  scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  if (window.MutationObserver) {
    var mt = 0;
    new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(scan, 50); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
