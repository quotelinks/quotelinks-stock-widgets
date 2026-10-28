/*! Quotelinks Stock Card widget v1 | https://www.quotelinks.com/widgets/stockcard.html
 *
 * Embed:
 *   <div class="ql-stockcard" data-symbol="AAPL" data-size="full" data-theme="light">
 *     <a href="https://www.quotelinks.com/stocks/aapl.html">AAPL stock quote</a> by
 *     <a href="https://www.quotelinks.com/">Quotelinks</a>
 *   </div>
 *   <script src="https://www.quotelinks.com/widgets/stockcard.js" async></script>
 *
 * Attributes (frozen contract: never renamed or removed, only optional ones may be added):
 *   data-symbol  ticker (BRK.B or BRK-B); if missing, taken from the first link (/stocks/{sym}.html or /etfs/{sym}.html)
 *   data-size    "full" (default) | "compact"
 *   data-theme   "light" (default) | "dark" | "auto" (follows the visitor's system setting)
 *
 * The two links inside the div stay in the host page (light DOM) and are shown in the card footer through
 * named slots; they are never removed, hidden or changed. Company logo when quotelinks has one, else a monogram. Rendering is in a Shadow DOM, so host CSS and card
 * CSS don't mix. One request per symbol: /widgets/api/stockcard.php (end-of-day data, cached 15 minutes).
 * Cards added later (e.g. by a page builder) are picked up automatically; window.qlStockcard.scan() also works.
 */
(function () {
  'use strict';
  if (window.qlStockcard) { window.qlStockcard.scan(); return; }

  var script = document.currentScript;
  var BASE = 'https://www.quotelinks.com';
  try { if (script && script.src) BASE = new URL(script.src).origin; } catch (e) {}
  var API = BASE + '/widgets/api/stockcard.php?symbol=';
  var SEL = '.ql-stockcard';
  var cache = {};       // symbol -> Promise<data|null>

  var CSS = [
    ':host{all:initial;display:block;margin:0 0 16px}',
    /* host-page rules such as div{padding;border} must not frame the card (!important in the shadow tree wins) */
    ':host{padding:0!important;border:0!important;background:none!important;box-shadow:none!important;float:none!important}',
    ':host([hidden]){display:none}',
    '.c{--bg:#fff;--tx:#111827;--mu:#6b7280;--ln:#e5e7eb;--ac:#1d4ed8;--up:#047857;--ups:#ecfdf5;--dn:#c2410c;--dns:#fff4ed;--fl:#f3f4f6;--chip:#eff4ff;--chipb:#c7d7fe;',
    'box-sizing:border-box;container-type:inline-size;width:340px;max-width:100%;min-width:240px;background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:12px;',
    'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;box-shadow:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.06);overflow:hidden;text-align:left;-webkit-font-smoothing:antialiased}',
    '.c.cmp{width:300px}',
    '.c.dk{--bg:#111827;--tx:#f3f4f6;--mu:#9ca3af;--ln:#1f2937;--ac:#60a5fa;--up:#34d399;--ups:rgba(52,211,153,.12);--dn:#fb923c;--dns:rgba(251,146,60,.12);--fl:rgba(156,163,175,.12);--chip:rgba(96,165,250,.12);--chipb:rgba(96,165,250,.35)}',
    '*{box-sizing:border-box}',
    '.hd{display:flex;gap:10px;align-items:center;padding:14px 16px 0}',
    '.lg{width:36px;height:36px;flex:none;border-radius:9px;background:var(--chip);border:1px solid var(--chipb);color:var(--ac);display:grid;place-items:center;font-weight:700;font-size:12px;letter-spacing:-.02em}',
    '.lg.im{background:#fff;border-color:var(--ln);padding:4px}',
    '.lg img{display:block;width:100%;height:100%;object-fit:contain}',
    '.id{min-width:0;flex:1}',
    '.sy{font-weight:700;font-size:15px}',
    '.ex{font-size:11px;color:var(--mu);font-weight:500;margin-left:5px}',
    '.nm{font-size:12.5px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.px{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:10px 16px 0}',
    '.pr{font-size:28px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
    '.ch{font-size:13px;font-weight:600;padding:2px 8px;border-radius:999px;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.ch.u{color:var(--up);background:var(--ups)}.ch.d{color:var(--dn);background:var(--dns)}.ch.f{color:var(--mu);background:var(--fl)}',
    '.as{font-size:11.5px;color:var(--mu);padding:2px 16px 0}',
    '.sk{display:block;width:100%;height:56px;margin-top:8px}',
    '.rg{padding:8px 16px 2px;font-size:11.5px;color:var(--mu)}',
    '.rg .lh{display:flex;justify-content:space-between;font-variant-numeric:tabular-nums}',
    '.br{position:relative;height:4px;border-radius:2px;background:var(--ln);margin:5px 0}',
    '.br i{position:absolute;top:-3px;width:10px;height:10px;border-radius:50%;background:var(--ac);transform:translateX(-50%)}',
    '.st{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:0 10px;margin:8px 16px 0;border-top:1px solid var(--ln)}',
    '.st div{padding:7px 0 0;min-width:0}',
    '.st span{display:block;color:var(--mu);font-size:11px;white-space:nowrap}',
    '.st b{display:block;font-weight:600;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '@container (max-width:329px){.st{grid-template-columns:1fr 1fr}}',
    '.na{padding:14px 16px 2px;color:var(--mu);font-size:13px}',
    '.ph{height:12px;border-radius:6px;background:var(--ln);margin:12px 16px 0;width:55%}.ph.w{width:80%;height:26px}',
    '.ft{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 16px;margin-top:10px;border-top:1px solid var(--ln);font-size:12px;color:var(--mu)}',
    '.c.cmp .ft{margin-top:12px}',
    '.ft .mo{display:flex;align-items:center;gap:3px;min-width:0;color:var(--ac);font-weight:600}',
    '.ft .by{white-space:nowrap}',
    /* the host's own links, projected into the footer; !important in the shadow tree beats host styles */
    '::slotted(a){color:var(--ac)!important;text-decoration:none!important;font:inherit!important;background:none!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important}',
    '::slotted(a:hover){text-decoration:underline!important}',
    'slot[name=brand]::slotted(a){font-weight:700!important}',
    '.ow{color:var(--ac);text-decoration:none}.ow:hover{text-decoration:underline}'
  ].join('');

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function num(v, d) { return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function price(v) { return v == null ? '\u2014' : num(v, Math.abs(v) >= 1 ? 2 : 4); }
  function show(sym) { return sym.replace(/-/g, '.'); }      // BRK-B -> BRK.B
  function big(v, money) {
    if (v == null) return '\u2014';
    var a = Math.abs(v), s = money ? '$' : '', u = '', x = v;    // 3 significant digits: 5.02T, 827B, 42.7M
    if (a >= 1e12) { x = v / 1e12; u = 'T'; } else if (a >= 1e9) { x = v / 1e9; u = 'B'; } else if (a >= 1e6) { x = v / 1e6; u = 'M'; } else if (a >= 1e3) { x = v / 1e3; u = 'K'; }
    if (!u) return s + num(v, 0);
    var ax = Math.abs(x);
    return s + num(x, ax >= 100 ? 0 : ax >= 10 ? 1 : 2) + u;
  }
  function day(d) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(d || '');
    return m ? MON[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : '';
  }
  function mono(s) { return esc(s.replace(/[^A-Z0-9]/g, '').slice(0, 2)); }

  function spark(sp, dir) {
    var w = 300, h = 56, p = 3, mn = Math.min.apply(null, sp), mx = Math.max.apply(null, sp), rg = (mx - mn) || 1;
    var line = sp.map(function (v, i) {
      return (i ? 'L' : 'M') + (i / (sp.length - 1) * w).toFixed(1) + ' ' + (p + (1 - (v - mn) / rg) * (h - 2 * p)).toFixed(1);
    }).join(' ');
    var gid = 'qlg' + Math.random().toString(36).slice(2, 8);
    var c = dir === 'u' ? 'var(--up)' : dir === 'd' ? 'var(--dn)' : 'var(--mu)';
    return '<svg class="sk" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c + '" stop-opacity=".18"/>' +
      '<stop offset="1" stop-color="' + c + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + line + ' L' + w + ' ' + h + ' L0 ' + h + 'Z" fill="url(#' + gid + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + c + '" stroke-width="1.75" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
  }

  function header(sym, q) {
    var logo = q && q.lg ? '<div class="lg im" aria-hidden="true"><img src="' + esc(BASE + q.lg) + '" alt="" width="28" height="28" decoding="async"></div>'
                         : '<div class="lg" aria-hidden="true">' + mono(sym) + '</div>';
    return '<div class="hd">' + logo + '<div class="id"><div class="sy">' + esc(show(sym)) +
      (q && q.ex ? '<span class="ex">' + esc(q.ex) + '</span>' : '') + '</div>' +
      (q && q.n ? '<div class="nm" title="' + esc(q.n) + '">' + esc(q.n) + '</div>' : '') + '</div></div>';
  }

  function footer(st) {
    var more = st.more ? '<slot name="more"></slot>' : '<a class="ow" href="' + esc(st.moreHref) + '">' + esc(st.moreText) + '</a>';
    var brand = st.brand ? '<slot name="brand"></slot>' : '<a class="ow" href="' + BASE + '/"><b>Quotelinks</b></a>';
    return '<div class="ft"><span class="mo">' + more + '<span aria-hidden="true">\u2192</span></span><span class="by">by ' + brand + '</span></div>';
  }

  function body(sym, q, full) {
    if (!q) return header(sym, null) + '<div class="na">Quote unavailable</div>';
    if (q.p == null) return header(sym, q) + '<div class="na">No recent quote</div>';
    var dir = q.ch > 0 ? 'u' : q.ch < 0 ? 'd' : 'f', sg = q.ch > 0 ? '+' : '';
    var h = header(sym, q) + '<div class="px"><span class="pr">$' + price(q.p) + '</span>' +
      (q.ch != null ? '<span class="ch ' + dir + '">' + sg + num(q.ch, Math.abs(q.p) >= 1 ? 2 : 4) + (q.cp != null ? ' (' + sg + num(q.cp, 2) + '%)' : '') + '</span>' : '') +
      '</div>' + (q.d ? '<div class="as">Close \u00b7 ' + day(q.d) + '</div>' : '');
    if (!full) return h;
    if (q.sp && q.sp.length > 4) h += spark(q.sp, dir);
    if (q.h52 != null && q.l52 != null && q.h52 > q.l52) {
      var pos = Math.max(0, Math.min(100, (q.p - q.l52) / (q.h52 - q.l52) * 100));
      h += '<div class="rg"><div class="lh"><span>52-wk low ' + price(q.l52) + '</span><span>' + price(q.h52) + ' high</span></div>' +
        '<div class="br"><i style="left:' + pos.toFixed(1) + '%"></i></div></div>';
    }
    var rng = '\u2014';
    if (q.l != null && q.h != null) {
      var d0 = q.h >= 1000 ? 0 : null;
      rng = (d0 === 0 ? num(q.l, 0) : price(q.l)) + '\u2013' + (d0 === 0 ? num(q.h, 0) : price(q.h));
    }
    var cells = [['Open', price(q.o)], ['Prev close', price(q.pc)], ['Day range', rng], ['Volume', big(q.vol, false)]];
    if (q.k === 'etf') cells.push(['Net assets', big(q.aum, true)], ['Expense ratio', q.er != null ? num(q.er, 2) + '%' : '\u2014']);
    else cells.push(['Market cap', big(q.mc, true)], ['P/E', q.pe != null ? num(q.pe, 1) : '\u2014']);
    h += '<div class="st">' + cells.map(function (c) { return '<div><span>' + c[0] + '</span><b>' + c[1] + '</b></div>'; }).join('') + '</div>';
    return h;
  }

  function load(sym) {
    if (!cache[sym]) {
      cache[sym] = fetch(API + encodeURIComponent(sym), { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j && j.v === 1 && !j.error ? j : null; })
        .catch(function () { return null; });
    }
    return cache[sym];
  }

  // the host's links: first one pointing to a quotelinks quote page = "more", one pointing to the home page = "brand"
  function links(el) {
    var st = { more: null, brand: null };
    var as = el.querySelectorAll('a[href]');
    for (var i = 0; i < as.length; i++) {
      var a = as[i], u;
      if (a.parentNode !== el) continue;                           // slots only take direct children
      try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { continue; }
      if (!/(^|\.)quotelinks\.com$/i.test(u.hostname) && u.origin !== BASE) continue;
      if (!st.brand && (u.pathname === '/' || u.pathname === '')) st.brand = a;
      else if (!st.more && /^\/(stocks|etfs)\/[^\/]+\.html$/i.test(u.pathname)) st.more = a;
    }
    return st;
  }

  function symbolOf(el, st) {
    var s = (el.getAttribute('data-symbol') || '').trim();
    if (!s && st.more) { var m = /\/(?:stocks|etfs)\/([^\/]+)\.html$/i.exec(st.more.getAttribute('href')); if (m) s = m[1]; }
    s = s.toUpperCase().replace(/\./g, '-');
    return /^[A-Z][A-Z0-9\-]{0,9}$/.test(s) ? s : '';
  }

  function theme(el) {
    var t = (el.getAttribute('data-theme') || 'light').toLowerCase();
    if (t === 'auto') return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return t === 'dark';
  }

  function render(el) {
    if (!el.attachShadow || el.__qlsc) return;
    el.__qlsc = 1;
    var st = links(el);
    var sym = symbolOf(el, st);
    if (st.more) st.more.setAttribute('slot', 'more');
    if (st.brand) st.brand.setAttribute('slot', 'brand');
    var root = el.shadowRoot || el.attachShadow({ mode: 'open' });
    var full = (el.getAttribute('data-size') || 'full').toLowerCase() !== 'compact';
    st.moreHref = BASE + '/stocks/' + sym.toLowerCase() + '.html';
    st.moreText = show(sym) + ' stock quote';
    var cls = 'c' + (full ? '' : ' cmp') + (theme(el) ? ' dk' : '');
    var paint = function (inner, label) {
      root.innerHTML = '<style>' + CSS + '</style><div class="' + cls + '" role="group" aria-label="' + esc(label) + '">' + inner + footer(st) + '</div>';
    };
    if (!sym) { paint(header('?', null) + '<div class="na">Quote unavailable</div>', 'Stock quote'); return; }
    paint(header(sym, null) + '<div class="ph w"></div><div class="ph"></div>', show(sym) + ' stock quote');
    load(sym).then(function (q) {
      if (q && q.u && !st.more) { st.moreHref = BASE + q.u; st.moreText = show(sym) + (q.k === 'etf' ? ' ETF quote' : ' stock quote'); }
      paint(body(sym, q, full), show(sym) + (q && q.k === 'etf' ? ' ETF' : ' stock') + ' quote');
      var img = root.querySelector('.lg img');                     // logo missing or blocked -> monogram
      if (img) img.addEventListener('error', function () { var t = img.parentNode; t.className = 'lg'; t.textContent = sym.replace(/[^A-Z0-9]/g, '').slice(0, 2); });
    });
  }

  function scan() {
    var els = document.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) render(els[i]);
  }

  window.qlStockcard = { scan: scan, version: 1 };
  scan();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  if (window.MutationObserver) {
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 50); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
