/*! Quotelinks Market Movers widget v1 | https://www.quotelinks.com/widgets/movers.html
 *
 * Embed:
 *   <div class="ql-movers" data-market="stocks" data-rows="5" data-theme="light">
 *     <a href="https://www.quotelinks.com/stocks.html">US stock movers</a> by
 *     <a href="https://www.quotelinks.com/">Quotelinks</a>
 *   </div>
 *   <script src="https://www.quotelinks.com/widgets/movers.js" async></script>
 *
 * Attributes (frozen contract: never renamed or removed, only optional ones may be added):
 *   data-market  "stocks" (default) | "etfs"
 *   data-rows    "5" (default) | "10"
 *   data-tab     "gainers" (default) | "losers" | "active"   - the list shown first
 *   data-size    "compact" (no company names) | omitted
 *   data-theme   "light" (default) | "dark" | "auto" (follows the visitor's system setting)
 *
 * The two links inside the div stay in the host page (light DOM) and are shown in the footer through named slots;
 * they are never removed, hidden or changed. Each row opens that symbol's quotelinks.com page in a new tab.
 * Rendering is in a Shadow DOM. One request per widget: /widgets/api/movers.php (end-of-day data, cached 15 min).
 */
(function () {
  'use strict';
  if (window.qlMovers) { window.qlMovers.scan(); return; }

  var script = document.currentScript;
  var BASE = 'https://www.quotelinks.com';
  try { if (script && script.src) BASE = new URL(script.src).origin; } catch (e) {}
  var API = BASE + '/widgets/api/movers.php?market=';
  var SEL = '.ql-movers';
  var TABS = [['gainers', 'Gainers'], ['losers', 'Losers'], ['active', 'Most active']];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var cache = {};

  var CSS = [
    ':host{all:initial;display:block;margin:0 0 16px}',
    ':host{padding:0!important;border:0!important;background:none!important;box-shadow:none!important;float:none!important}',
    ':host([hidden]){display:none}',
    '.m{--bg:#fff;--tx:#111827;--mu:#6b7280;--ln:#e5e7eb;--ac:#1d4ed8;--acs:#eff4ff;--up:#047857;--ups:#ecfdf5;--dn:#c2410c;--dns:#fff4ed;--hov:#f9fafb;',
    'box-sizing:border-box;width:360px;max-width:100%;min-width:250px;background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:12px;',
    'font:13.5px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;box-shadow:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.06);overflow:hidden;text-align:left;-webkit-font-smoothing:antialiased}',
    '.m.cmp{width:280px}',
    '.m.cmp .p{text-align:left;min-width:60px;margin-right:16px}',     /* compact: price sits mid-row, away from the % pill */
    '.m.cmp ol.act .p{text-align:right;min-width:52px;margin-right:0}',   /* ...except on Most active, where volume takes that space */
    '.m.cmp .id{min-width:44px}',
    '.m.dk{--bg:#111827;--tx:#f3f4f6;--mu:#9ca3af;--ln:#1f2937;--ac:#60a5fa;--acs:rgba(96,165,250,.14);--up:#34d399;--ups:rgba(52,211,153,.12);--dn:#fb923c;--dns:rgba(251,146,60,.12);--hov:rgba(255,255,255,.03)}',
    '*{box-sizing:border-box}',
    '.hd{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:14px 16px 10px}',
    '.tt{font-weight:700;font-size:15px;white-space:nowrap}',
    '.as{font-size:11.5px;color:var(--mu);white-space:nowrap}',
    '.tabs{display:flex;gap:4px;padding:0 12px 10px;border-bottom:1px solid var(--ln)}',
    '.tabs button{flex:1;font:600 12.5px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;padding:7px 4px;border:0;border-radius:8px;background:none;color:var(--mu);cursor:pointer;white-space:nowrap;margin:0}',
    '.tabs button[aria-selected="true"]{background:var(--acs);color:var(--ac)}',
    '.tabs button:hover{color:var(--tx)}.tabs button[aria-selected="true"]:hover{color:var(--ac)}',
    '.tabs button:focus-visible{outline:2px solid var(--ac);outline-offset:1px}',
    'ol{list-style:none;margin:0;padding:4px 0}',
    'li a{display:flex;align-items:center;gap:10px;padding:5px 16px;color:inherit;text-decoration:none;white-space:nowrap}',
    '.m.cmp li a{padding:5px 14px}',
    'li a:hover{background:var(--hov)}',
    'li a:focus-visible{outline:2px solid var(--ac);outline-offset:-2px}',
    '.id{flex:1;min-width:0;display:flex;align-items:baseline;gap:7px;overflow:hidden}',
    '.s{font-weight:700;flex:none}',
    '.n{min-width:0;font-size:12px;color:var(--mu);overflow:hidden;text-overflow:ellipsis}',
    '.m.cmp .n{display:none}',
    '.p{flex:none;font-variant-numeric:tabular-nums;text-align:right;min-width:52px}',
    '.v{flex:none;font-size:12px;color:var(--mu);font-variant-numeric:tabular-nums;text-align:right;min-width:40px}',
    '.c{flex:none;font-weight:600;font-size:12.5px;font-variant-numeric:tabular-nums;padding:2px 6px;border-radius:6px;min-width:62px;text-align:right}',
    '.c.u{color:var(--up);background:var(--ups)}.c.d{color:var(--dn);background:var(--dns)}',
    '.ph{height:12px;border-radius:6px;background:var(--ln);margin:12px 16px}',
    '.na{padding:18px 16px;color:var(--mu)}',
    '.ft{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 16px;border-top:1px solid var(--ln);font-size:12px;color:var(--mu)}',
    '.mo{display:flex;align-items:center;gap:3px;min-width:0;color:var(--ac);font-weight:600}',
    '.by{white-space:nowrap}',
    '::slotted(a){color:var(--ac)!important;text-decoration:none!important;font:inherit!important;background:none!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important}',
    '::slotted(a:hover){text-decoration:underline!important}',
    'slot[name=brand]::slotted(a){font-weight:700!important}',
    '.ow{color:var(--ac);text-decoration:none}.ow:hover{text-decoration:underline}'
  ].join('');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function num(v, d) { return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function price(v) { return v == null ? '\u2014' : num(v, Math.abs(v) >= 1 ? 2 : 4); }
  function vol(v) {
    if (!v) return '';
    if (v >= 1e9) return num(v / 1e9, 2) + 'B';
    if (v >= 1e6) return num(v / 1e6, v >= 1e8 ? 0 : 1) + 'M';
    if (v >= 1e3) return num(v / 1e3, 0) + 'K';
    return String(v);
  }
  function show(s) { return s.replace(/-/g, '.'); }
  function day(d) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(d || ''); return m ? MON[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : ''; }

  function rowsHtml(list, tab, n) {
    if (!list || !list.length) return '<div class="na">No movers for this session</div>';
    return '<ol' + (tab === 'active' ? ' class="act"' : '') + '>' + list.slice(0, n).map(function (e) {
      var up = e.cp >= 0;
      return '<li><a href="' + esc(BASE + e.u) + '" target="_blank" rel="noopener" title="' + esc(show(e.s)) + ' quote">' +
        '<span class="id"><span class="s">' + esc(show(e.s)) + '</span><span class="n">' + esc(e.n) + '</span></span>' +
        (tab === 'active' && e.vol ? '<span class="v" title="Volume">' + vol(e.vol) + '</span>' : '') +
        '<span class="p">' + price(e.p) + '</span>' +
        '<span class="c ' + (up ? 'u' : 'd') + '">' + (up ? '+' : '') + num(e.cp, 2) + '%</span></a></li>';
    }).join('') + '</ol>';
  }

  function load(market) {
    if (!cache[market]) {
      cache[market] = fetch(API + market, { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j && j.v === 1 && j.gainers ? j : null; })
        .catch(function () { return null; });
    }
    return cache[market];
  }

  // host links: one to a quotelinks page other than the home page = "more", one to the home page = "brand"
  function links(el) {
    var st = { more: null, brand: null };
    for (var i = 0; i < el.children.length; i++) {
      var a = el.children[i], u;
      if (a.tagName !== 'A' || !a.getAttribute('href')) continue;
      try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
      if (!/(^|\.)quotelinks\.com$/i.test(u.hostname) && u.origin !== BASE) continue;
      if (!st.brand && (u.pathname === '/' || u.pathname === '')) st.brand = a;
      else if (!st.more) st.more = a;
    }
    return st;
  }

  function render(el) {
    if (!el.attachShadow || el.__qlmv) return;
    el.__qlmv = 1;
    var st = links(el);
    if (st.more) st.more.setAttribute('slot', 'more');
    if (st.brand) st.brand.setAttribute('slot', 'brand');
    var root = el.shadowRoot || el.attachShadow({ mode: 'open' });
    var etf = (el.getAttribute('data-market') || '').toLowerCase() === 'etfs';
    var n = el.getAttribute('data-rows') === '10' ? 10 : 5;
    var tab = (el.getAttribute('data-tab') || 'gainers').toLowerCase();
    if (!/^(gainers|losers|active)$/.test(tab)) tab = 'gainers';
    var th = (el.getAttribute('data-theme') || 'light').toLowerCase();
    var dark = th === 'dark' || (th === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var cmp = (el.getAttribute('data-size') || '').toLowerCase() === 'compact';
    var title = etf ? 'ETF Movers' : 'Market Movers';
    var uid = 'qlmv' + Math.random().toString(36).slice(2, 8);
    var more = st.more ? '<slot name="more"></slot>'
      : '<a class="ow" href="' + BASE + (etf ? '/etfs.html' : '/stocks.html') + '" target="_blank" rel="noopener">US ' + (etf ? 'ETF' : 'stock') + ' movers</a>';
    var brand = st.brand ? '<slot name="brand"></slot>' : '<a class="ow" href="' + BASE + '/" target="_blank" rel="noopener"><b>Quotelinks</b></a>';

    root.innerHTML = '<style>' + CSS + '</style><div class="m' + (cmp ? ' cmp' : '') + (dark ? ' dk' : '') + '" role="region" aria-label="' + title + '">' +
      '<div class="hd"><span class="tt">' + title + '</span><span class="as"></span></div>' +
      '<div class="tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" role="tab" id="' + uid + t[0] + '" data-t="' + t[0] + '" aria-controls="' + uid + 'p" aria-selected="' + (t[0] === tab) + '" tabindex="' + (t[0] === tab ? 0 : -1) + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="ls" id="' + uid + 'p" role="tabpanel" aria-labelledby="' + uid + tab + '">' + new Array(n + 1).join('<div class="ph"></div>') + '</div>' +
      '<div class="ft"><span class="mo">' + more + '<span aria-hidden="true">\u2192</span></span><span class="by">by ' + brand + '</span></div></div>';

    var panel = root.querySelector('.ls'), btns = root.querySelectorAll('.tabs button'), data = null;
    var select = function (t, focus) {
      tab = t;
      for (var i = 0; i < btns.length; i++) {
        var on = btns[i].getAttribute('data-t') === t;
        btns[i].setAttribute('aria-selected', on); btns[i].tabIndex = on ? 0 : -1;
        if (on && focus) btns[i].focus();
      }
      panel.setAttribute('aria-labelledby', uid + t);
      if (data) panel.innerHTML = rowsHtml(data[t], t, n);
    };
    root.querySelector('.tabs').addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button'); if (b) select(b.getAttribute('data-t'), false);
    });
    root.querySelector('.tabs').addEventListener('keydown', function (e) {        // arrow keys move between tabs
      var i = TABS.map(function (t) { return t[0]; }).indexOf(tab);
      if (e.key === 'ArrowRight') { select(TABS[(i + 1) % 3][0], true); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { select(TABS[(i + 2) % 3][0], true); e.preventDefault(); }
    });

    load(etf ? 'etfs' : 'stocks').then(function (j) {
      if (!j) { panel.innerHTML = '<div class="na">Movers unavailable</div>'; return; }
      data = j;
      if (j.d) root.querySelector('.as').textContent = 'Close \u00b7 ' + day(j.d);
      select(tab, false);
    });
  }

  function scan() {
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) render(els[i]);
  }

  window.qlMovers = { scan: scan, version: 1 };
  scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  if (window.MutationObserver) {
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 50); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
