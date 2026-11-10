/*! Quotelinks Stock Chart widget v1 | https://www.quotelinks.com/widgets/stockchart.html
 *
 * Embed:
 *   <div class="ql-stockchart" data-symbol="AAPL" data-type="candles" data-range="1y" data-size="full" data-theme="light">
 *     <a href="https://www.quotelinks.com/stocks/aapl.html">AAPL stock chart</a> by
 *     <a href="https://www.quotelinks.com/">Quotelinks</a>
 *   </div>
 *   <script src="https://www.quotelinks.com/widgets/stockchart.js" async></script>
 *
 * Attributes (frozen contract: never renamed or removed, only optional ones may be added):
 *   data-symbol  ticker (BRK.B or BRK-B); if missing, taken from the first link (/stocks/{sym}.html or /etfs/{sym}.html)
 *   data-range   1m | 3m | 6m | ytd | 1y | 5y | max - first range shown (default 1y; compact has no ytd); visitors can switch
 *   data-size    full (default, up to 720 px wide) | compact (up to 320 px)
 *   data-theme   light (default) | dark | auto (follows the visitor's system setting)
 *   data-type    candles (default, since 2026-11-04) | line - first chart type shown; visitors can switch with the Line / Candles buttons.
 *                Candles: daily up to the width limit, then weekly or monthly candles, with volume bars.
 *
 * The two links inside the div stay in the host page (light DOM) and are shown in the footer through named slots;
 * they are never removed, hidden or changed. Rendering is in a Shadow DOM. One request per symbol:
 * /widgets/api/stockchart.php (daily closes; &ohlc=1 adds open/high/low/volume for candles), once per page load (no polling).
 * 2026-11-10: during US market hours the last bar is today's delayed intraday price (refreshed on the server every
 * 5 min); the line under the price reads "Delayed \u00b7 as of 11:42 AM ET", otherwise "Close \u00b7 Nov 10, 2026".
 * Charts added later (page builders) are picked up automatically; window.qlStockchart.scan() also works.
 */
(function () {
  'use strict';
  if (window.qlStockchart) { window.qlStockchart.scan(); return; }

  var script = document.currentScript;
  var BASE = 'https://www.quotelinks.com';
  try { if (script && script.src && /^https?:/.test(script.src)) BASE = new URL(script.src).origin; } catch (e) {}
  var API = BASE + '/widgets/api/stockchart.php?symbol=';
  var SEL = '.ql-stockchart';
  var cache = {};
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // id, months (0 = special), label
  var RANGES = [['1m', 1, '1M'], ['3m', 3, '3M'], ['6m', 6, '6M'], ['ytd', -1, 'YTD'], ['1y', 12, '1Y'], ['5y', 60, '5Y'], ['max', 0, 'Max']];
  var CMP_RANGES = { '1m': 1, '3m': 1, '6m': 1, '1y': 1, '5y': 1, 'max': 1 };
  var MINUS = '\u2212';

  var CSS = [
    ':host{all:initial;display:block;margin:0 0 16px}',
    ':host{padding:0!important;border:0!important;background:none!important;box-shadow:none!important;float:none!important}',
    ':host([hidden]){display:none}',
    '.c{--bg:#fff;--tx:#111827;--mu:#6b7280;--ln:#e5e7eb;--gr:#f3f4f6;--ac:#1d4ed8;--up:#047857;--ups:#ecfdf5;--dn:#c2410c;--dns:#fff4ed;--fl:#f3f4f6;--chip:#eff4ff;--chipb:#c7d7fe;',
    'box-sizing:border-box;width:100%;max-width:720px;min-width:240px;background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:12px;',
    'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;box-shadow:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.06);overflow:hidden;text-align:left;-webkit-font-smoothing:antialiased}',
    '.c.cmp{max-width:320px}',
    '.c.dk{--bg:#111827;--tx:#f3f4f6;--mu:#9ca3af;--ln:#1f2937;--gr:#1f2937;--ac:#60a5fa;--up:#34d399;--ups:rgba(52,211,153,.12);--dn:#fb923c;--dns:rgba(251,146,60,.12);--fl:rgba(156,163,175,.12);--chip:rgba(96,165,250,.12);--chipb:rgba(96,165,250,.35)}',
    '*{box-sizing:border-box}',
    '.hd{display:flex;justify-content:space-between;align-items:center;gap:8px 12px;padding:14px 16px 0;flex-wrap:wrap}',
    '.idw{display:flex;gap:10px;align-items:center;min-width:0;flex:1 1 180px}',
    '.lg{width:36px;height:36px;flex:none;border-radius:9px;background:var(--chip);border:1px solid var(--chipb);color:var(--ac);display:grid;place-items:center;font-weight:700;font-size:12px;letter-spacing:-.02em}',
    '.lg.im{background:#fff;border-color:var(--ln);padding:4px}',
    '.lg img{display:block;width:100%;height:100%;object-fit:contain}',
    '.id{min-width:0;flex:1}',
    '.sy{font-weight:700;font-size:15px}',
    '.ex{font-size:11px;color:var(--mu);font-weight:500;margin-left:5px}',
    '.nm{font-size:12.5px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.rg{display:flex;gap:2px;background:var(--fl);border-radius:8px;padding:2px;flex:none}',
    '.rg button{font:600 12px/1 inherit;font-family:inherit;border:0;background:none;color:var(--mu);padding:6px 9px;border-radius:6px;cursor:pointer}',
    '.rg button[aria-pressed="true"]{background:var(--bg);color:var(--ac);box-shadow:0 1px 2px rgba(16,24,40,.08)}',
    '.rg button:hover{color:var(--tx)}',
    '.rg button:focus-visible,.cw:focus-visible{outline:2px solid var(--ac);outline-offset:1px}',
    '.tg{display:flex;gap:6px;align-items:center;flex-wrap:wrap}',
    '.ty{display:flex;gap:2px;background:var(--fl);border-radius:8px;padding:2px;flex:none}',
    '.ty button{border:0;background:none;color:var(--mu);padding:4px 6px;border-radius:6px;cursor:pointer;display:grid;place-items:center}',
    '.ty button svg{width:18px;height:18px;display:block}',
    '.ty button[aria-pressed="true"]{background:var(--bg);color:var(--ac);box-shadow:0 1px 2px rgba(16,24,40,.08)}',
    '.ty button:hover{color:var(--tx)}.ty button:disabled{opacity:.35;cursor:default}',
    '.ty button:focus-visible{outline:2px solid var(--ac);outline-offset:1px}',
    '.vl{display:flex;align-items:baseline;gap:6px 10px;flex-wrap:wrap;padding:10px 16px 0}',
    '.big{font-size:28px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}',
    '.ch{font-size:13px;font-weight:600;padding:2px 8px;border-radius:999px;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.ch.u{color:var(--up);background:var(--ups)}.ch.d{color:var(--dn);background:var(--dns)}.ch.f{color:var(--mu);background:var(--fl)}',
    '.as{font-size:11.5px;color:var(--mu);padding:2px 16px 0}',
    '.cw{position:relative;margin:8px 0 0;outline:none;touch-action:pan-y}',
    'svg{display:block;width:100%;overflow:visible}',
    'svg text{fill:var(--mu);font-size:11px;font-variant-numeric:tabular-nums}',
    '.tip{position:absolute;top:2px;pointer-events:none;background:var(--bg);border:1px solid var(--ln);border-radius:8px;padding:5px 8px;font-size:12px;white-space:nowrap;box-shadow:0 4px 12px rgba(16,24,40,.10);display:none}',
    '.tip b{font-variant-numeric:tabular-nums}',
    '.ft{display:flex;justify-content:space-between;align-items:center;gap:4px 8px;flex-wrap:wrap;padding:9px 16px;margin-top:6px;border-top:1px solid var(--ln);font-size:12px;color:var(--mu)}',
    '.ft .mo{display:flex;align-items:center;gap:3px;min-width:0;color:var(--ac);font-weight:600}',
    '.ft .by{white-space:nowrap}',
    '::slotted(a){color:var(--ac)!important;text-decoration:none!important;font:inherit!important;background:none!important;border:0!important;padding:0!important;margin:0!important;box-shadow:none!important}',
    '::slotted(a:hover){text-decoration:underline!important}',
    'slot[name=brand]::slotted(a){font-weight:700!important}',
    '.ow{color:var(--ac);text-decoration:none}.ow:hover{text-decoration:underline}',
    '.cmp .hd{padding:12px 14px 0}.cmp .vl,.cmp .as{padding-left:14px;padding-right:14px}.cmp .big{font-size:24px}.cmp .ft{padding:8px 14px}',
    '.cmp .tg{width:100%;flex-wrap:nowrap}.cmp .rg{flex:1;min-width:0}.cmp .rg button{flex:1;padding:6px 3px}',
    '.na{padding:18px 16px 12px;color:var(--mu);font-size:13px}',
    '.ph{height:12px;border-radius:6px;background:var(--fl);margin:12px 16px 0;width:45%}.ph.w{width:70%;height:26px}'
  ].join('');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function num(v, n) { return Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: n, maximumFractionDigits: n }); }
  function pdp(v) { var a = Math.abs(v); return a >= 1 ? 2 : a >= 0.01 ? 4 : 6; }
  function price(v) { return (v < 0 ? MINUS : '') + '$' + num(v, pdp(v)); }
  function show(sym) { return sym.replace(/-/g, '.'); }
  function mono(s) { return esc(s.replace(/[^A-Z0-9]/g, '').slice(0, 2)); }
  // day number (days since 1970-01-01, UTC) <-> parts
  function dayOf(s) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5) : NaN; }
  function parts(dn) { var d = new Date(dn * 864e5); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCDay()]; }
  function fullDate(dn) { var p = parts(dn); return MON[p[1]] + ' ' + p[2] + ', ' + p[0]; }
  function monthsBack(dn, k) {
    var p = parts(dn), y = p[0], m = p[1] - k;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Math.round(Date.UTC(y, m, Math.min(p[2], dim)) / 864e5);
  }
  // "11:42 AM" in New York for a unix time, '' if the browser can't format it
  function nyTime(t) {
    try { return new Date(t * 1000).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function step(span, n) {
    var raw = span / n, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }

  // ohlc: also open/high/low/volume (candles). A reply with OHLC also serves line charts.
  function load(sym, ohlc) {
    var pre = window.qlStockchartData && window.qlStockchartData[sym];   // preview / test hook
    if (pre && (pre.o || !ohlc)) return Promise.resolve(pre);
    var key = sym + (ohlc ? '|o' : '');
    if (!ohlc && cache[sym + '|o']) return cache[sym + '|o'];
    if (!cache[key]) {
      cache[key] = fetch(API + encodeURIComponent(sym) + (ohlc ? '&ohlc=1' : ''), { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j && j.v === 1 && !j.error && j.c && j.c.length > 1 ? j : null; })
        .catch(function () { return null; });
    }
    return cache[key];
  }

  // the host's links: one to a quotelinks quote page = "more", one to the home page = "brand"
  function links(el) {
    var st = { more: null, brand: null };
    var as = el.querySelectorAll('a[href]');
    for (var i = 0; i < as.length; i++) {
      var a = as[i], u;
      if (a.parentNode !== el) continue;
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

  function header(sym, q, rb) {
    var logo = q && q.lg ? '<div class="lg im" aria-hidden="true"><img src="' + esc(BASE + q.lg) + '" alt="" width="28" height="28" decoding="async"></div>'
                         : '<div class="lg" aria-hidden="true">' + mono(sym) + '</div>';
    return '<div class="hd"><div class="idw">' + logo + '<div class="id"><div class="sy">' + esc(show(sym)) +
      (q && q.ex ? '<span class="ex">' + esc(q.ex) + '</span>' : '') + '</div>' +
      (q && q.n ? '<div class="nm" title="' + esc(q.n) + '">' + esc(q.n) + '</div>' : '') + '</div></div>' + (rb || '') + '</div>';
  }
  function footer(st) {
    var more = st.more ? '<slot name="more"></slot>' : '<a class="ow" href="' + esc(st.moreHref) + '">' + esc(st.moreText) + '</a>';
    var brand = st.brand ? '<slot name="brand"></slot>' : '<a class="ow" href="' + BASE + '/"><b>Quotelinks</b></a>';
    return '<div class="ft"><span class="mo">' + more + '<span aria-hidden="true">\u2192</span></span><span class="by">by ' + brand + '</span></div>';
  }

  function mount(el) {
    if (!el.attachShadow || el.__qlsch) return;
    el.__qlsch = 1;
    var st = links(el);
    var sym = symbolOf(el, st);
    if (st.more) st.more.setAttribute('slot', 'more');
    if (st.brand) st.brand.setAttribute('slot', 'brand');
    var cmp = (el.getAttribute('data-size') || '').toLowerCase() === 'compact';
    var themeAttr = (el.getAttribute('data-theme') || 'light').toLowerCase();
    var range = (el.getAttribute('data-range') || '').toLowerCase();
    if (!RANGES.some(function (r) { return r[0] === range; }) || (cmp && !CMP_RANGES[range])) range = '1y';
    var type = (el.getAttribute('data-type') || '').toLowerCase() === 'line' ? 'line' : 'candles';
    st.moreHref = BASE + '/stocks/' + sym.toLowerCase() + '.html';
    st.moreText = show(sym) + ' stock chart';

    var root = el.shadowRoot || el.attachShadow({ mode: 'open' });
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function dark() { return themeAttr === 'dark' || (themeAttr === 'auto' && mq && mq.matches); }
    var H = cmp ? 150 : 220;
    root.innerHTML = '<style>' + CSS + '</style><div class="c' + (cmp ? ' cmp' : '') + (dark() ? ' dk' : '') + '" role="group" aria-label="' + esc(show(sym || '?')) + ' stock chart">' +
      header(sym || '?', null) + '<div class="ph w"></div><div class="ph"></div><div class="cw" style="height:' + H + 'px"></div>' + footer(st) + '</div>';
    var box = root.querySelector('.c');
    if (mq && themeAttr === 'auto') {
      var upd = function () { box.classList.toggle('dk', dark()); };
      mq.addEventListener ? mq.addEventListener('change', upd) : mq.addListener(upd);
    }
    function fail() {
      box.innerHTML = header(sym || '?', null) + '<div class="na">Chart unavailable</div>' + footer(st);
    }
    if (!sym) { fail(); return; }
    load(sym, type === 'candles').then(function (q) {
      if (!q) { fail(); return; }
      if (q.u && !st.more) { st.moreHref = BASE + q.u; st.moreText = show(sym) + (q.k === 'etf' ? ' ETF chart' : ' stock chart'); }
      render(q);
    });

    function render(q) {
      var C, N, D, O, Hh, L, V, last, i, cur = -1, hasOhlc = false;
      function setData(qq) {
        q = qq; C = q.c; N = C.length; D = new Array(N); last = N - 1;
        D[0] = dayOf(q.ds);
        for (i = 1; i < N; i++) D[i] = D[i - 1] + (q.g[i - 1] || 1);
        O = q.o || null; Hh = q.h || null; L = q.l || null; V = q.vo || null;
        hasOhlc = false;
        if (O) for (i = 0; i < N; i++) if (O[i] != null) { hasOhlc = true; break; }
      }
      setData(q);
      if (type === 'candles' && !hasOhlc) type = 'line';            // no OHLC for this symbol: line only
      var spanDays = D[last] - D[0];
      // ranges the history can fill (a range is offered if the data covers at least ~85% of it); Max always
      var avail = RANGES.filter(function (r) {
        if (cmp && !CMP_RANGES[r[0]]) return false;
        if (r[1] <= 0) return r[0] === 'max' || spanDays > 7;
        return D[last] - monthsBack(D[last], r[1]) <= spanDays / 0.85;
      });
      if (!avail.some(function (r) { return r[0] === range; })) range = avail.some(function (r) { return r[0] === '1y'; }) ? '1y' : 'max';
      var ICON_LINE = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M2 14l5-5 3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var ICON_CANDLE = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 2v3M6 13v4M14 4v3M14 12v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="3.5" y="5" width="5" height="8" rx="1" fill="currentColor"/><rect x="11.5" y="7" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
      var tb = '<div class="ty" role="group" aria-label="Chart type">' +
        '<button type="button" data-t="line" aria-pressed="' + (type === 'line') + '" title="Line chart" aria-label="Line chart">' + ICON_LINE + '</button>' +
        '<button type="button" data-t="candles" aria-pressed="' + (type === 'candles') + '" title="Candlestick chart" aria-label="Candlestick chart">' + ICON_CANDLE + '</button></div>';
      var rb = '<div class="rg" role="group" aria-label="Time range">' + avail.map(function (r) {
        return '<button type="button" data-r="' + r[0] + '" aria-pressed="' + (r[0] === range) + '">' + r[2] + '</button>';
      }).join('') + '</div>';
      var kind = q.k === 'etf' ? 'ETF' : 'stock';
      var lt = q.t ? nyTime(q.t) : '';                               // last bar = delayed intraday price (q.t), not a close
      var asOf = lt ? 'Delayed \u00b7 as of ' + lt + ' ET' : 'Close \u00b7 ' + fullDate(D[last]);
      box.setAttribute('aria-label', show(sym) + ' ' + kind + ' chart. ' + (lt ? 'Delayed price ' + price(q.p) + ' as of ' + lt + ' ET, ' + fullDate(D[last])
        : 'Close ' + price(q.p) + ' on ' + fullDate(D[last])));
      box.innerHTML = header(sym, q, '<div class="tg">' + tb + rb + '</div>') + '<div class="vl"><span class="big">' + price(q.p) + '</span><span class="chw"></span></div>' +
        '<div class="as">' + asOf + '</div><div class="cw"></div>' + footer(st);
      var img = box.querySelector('.lg img');
      if (img) img.addEventListener('error', function () { var t = img.parentNode; t.className = 'lg'; t.textContent = sym.replace(/[^A-Z0-9]/g, '').slice(0, 2); });
      var wrap = box.querySelector('.cw'), chw = box.querySelector('.chw');
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'img');
      wrap.setAttribute('aria-label', 'Price chart; use the left and right arrow keys to read values');
      var tip = document.createElement('div'); tip.className = 'tip';

      var W = 0, PL = 6, PR = 44, PT = 10, PB = 22, i0 = 0, xs, ys, svgEl, dir = 'f', rlab = '', P = [], agg = 'd';
      function startIndex() {
        if (range === 'max') return 0;
        var r = RANGES.filter(function (x) { return x[0] === range; })[0];
        var from = r[1] < 0 ? Math.round(Date.UTC(parts(D[last])[0], 0, 1) / 864e5) - 1 : monthsBack(D[last], r[1]);
        // base = last close on or before the start date (so 1Y compares with the close one year ago)
        var lo = 0, hi = last;
        while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (D[mid] <= from) lo = mid; else hi = mid - 1; }
        return Math.min(lo, last - 1);
      }
      function pill() {
        var b = C[i0], dv = q.p - b, pc = b ? dv / b * 100 : 0;
        dir = Math.abs(pc) < 0.005 ? 'f' : dv > 0 ? 'u' : 'd';
        rlab = range === 'max' ? 'since ' + MON[parts(D[0])[1]] + ' ' + parts(D[0])[0] : range === 'ytd' ? 'YTD' : 'in ' + RANGES.filter(function (x) { return x[0] === range; })[0][2];
        var sg = dir === 'u' ? '+' : dir === 'd' ? MINUS : '';
        chw.innerHTML = '<span class="ch ' + dir + '">' + (dir === 'u' ? '\u25b2 ' : dir === 'd' ? '\u25bc ' : '') + sg + '$' + num(dv, pdp(q.p)) +
          ' (' + sg + num(pc, 2) + '%) ' + rlab + '</span>';
      }
      // points to draw: line = one per day from the range base; candles = days, weeks or months after the base
      function points(plotW) {
        var out = [], k;
        if (type === 'line') {
          for (k = i0; k <= last; k++) out.push({ a: k, b: k, c: C[k] });
          agg = 'd';
          return out;
        }
        var a0 = Math.min(i0 + 1, last), n = last - a0 + 1;
        agg = plotW / n >= 3.2 ? 'd' : plotW / (n / 5) >= 3.2 ? 'w' : 'm';
        function key(k) { return agg === 'd' ? k : agg === 'w' ? Math.floor((D[k] + 3) / 7) : parts(D[k])[0] * 12 + parts(D[k])[1]; }
        var pk = null, p = null;
        for (k = a0; k <= last; k++) {
          var kk = key(k), o = O[k], h = Hh[k], l = L[k], c = C[k], co = o == null;
          if (co) { o = c; h = c; l = c; }
          if (kk !== pk || !p) {
            p = { a: k, b: k, o: o, h: h, l: l, c: c, v: (V && V[k]) || 0, co: co };
            out.push(p); pk = kk;
          } else {
            p.b = k; if (h > p.h) p.h = h; if (l < p.l) p.l = l; p.c = c; p.v += (V && V[k]) || 0;
            if (p.co && !co) { p.co = false; p.o = o; }               // open of the first day that has OHLC
            else if (!co) p.co = false;
          }
        }
        return out;
      }
      function draw() {
        W = Math.max(220, Math.round(wrap.clientWidth || 300));
        i0 = startIndex();
        pill();
        PR = 44;
        P = points(W - PL - PR);
        var cnd = type === 'candles', lo = Infinity, hi = -Infinity, k, vmax = 0;
        P.forEach(function (p) {
          var a = cnd ? p.l : p.c, b = cnd ? p.h : p.c;
          if (a < lo) lo = a; if (b > hi) hi = b;
          if (cnd && p.v > vmax) vmax = p.v;
        });
        if (hi === lo) { hi *= 1.01; lo *= 0.99; if (hi === lo) { hi = 1; lo = 0; } }
        var VH = cnd && vmax > 0 ? Math.round((H - PT - PB) * 0.2) : 0;     // volume band at the bottom
        var stp = step(hi - lo, cmp ? 3 : 4), y0 = Math.floor(lo / stp) * stp, y1 = Math.ceil(hi / stp) * stp;
        if (y0 < 0 && lo >= 0) y0 = 0;
        var gLo = y0;                                                  // grid lines / labels only over the price area
        if (VH) { var ext = (y1 - y0) * VH / (H - PT - PB - VH); y0 = Math.max(0, y0 - ext); }   // room for volume
        var nd = stp >= 1 ? 0 : stp >= 0.1 ? 1 : stp >= 0.01 ? 2 : 4, g, maxL = 0;
        function fmtAxis(v) { return '$' + num(v, nd); }
        var g0 = Math.ceil(gLo / stp - 1e-9) * stp;
        for (g = g0; g <= y1 + stp / 2; g += stp) maxL = Math.max(maxL, fmtAxis(g).length);
        PR = Math.max(30, Math.round(maxL * 6.4 + 10));
        var n = P.length, plotW = W - PL - PR, bw = cnd ? plotW / n : 0;
        xs = cnd ? function (j) { return PL + (j + 0.5) * bw; }
                 : function (j) { return PL + (n > 1 ? j / (n - 1) : 0.5) * plotW; };
        ys = function (v) { return PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB); };
        var col = dir === 'u' ? 'var(--up)' : dir === 'd' ? 'var(--dn)' : 'var(--ac)';
        var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" aria-hidden="true" focusable="false">', gid = '';
        if (!cnd) {
          gid = 'qlsg' + Math.random().toString(36).slice(2, 8);
          s += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".18"/>' +
            '<stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>';
        }
        for (g = g0; g <= y1 + stp / 2; g += stp) {
          var yy = ys(g).toFixed(1);
          s += '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + yy + '" y2="' + yy + '" stroke="var(--gr)"/>';
          s += '<text x="' + (W - PR + 6) + '" y="' + (+yy + 4) + '">' + fmtAxis(g) + '</text>';
        }
        // x labels: days (<= ~2.5 months), months, or years
        var dA = P[0].a, span = D[last] - D[dA], maxLab = Math.max(2, Math.floor(plotW / 64)), lastX = -99, prev = parts(D[dA]);
        var mStep = span <= 75 ? 0 : [1, 2, 3, 6, 12, 24, 60].filter(function (m) { return span / 30.4 / m <= maxLab; })[0] || 120;
        var dStep = [7, 14, 21, 28].filter(function (d) { return span / d <= maxLab; })[0] || 28;
        var lastDay = D[dA] + 3 - dStep;
        for (k = 1; k < n; k++) {
          var dk = D[P[k].a], p = parts(dk), t = null;
          if (!mStep) { if (dk - lastDay >= dStep) { t = MON[p[1]] + ' ' + p[2]; lastDay = dk; } }
          else if (p[1] !== prev[1]) {
            var mi = p[0] * 12 + p[1];
            if (mi % mStep === 0) t = p[1] === 0 || mStep >= 12 ? String(p[0]) : MON[p[1]];
          }
          prev = parts(D[P[k].b]);
          var x = xs(k);
          if (t && x - lastX > 40 && x > 14 && x < W - PR - 14) { s += '<text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + t + '</text>'; lastX = x; }
        }
        if (cnd) {
          var cw = Math.max(1, Math.min(14, bw * 0.68)), vb = H - PB, up = '', dn = '', wu = '', wd = '', co = '', vu = '', vd = '';
          P.forEach(function (p, j) {
            var x = xs(j), xl = (x - cw / 2).toFixed(1);
            if (VH && p.v > 0) {
              var vh = Math.max(0.5, p.v / vmax * VH), r = 'M' + xl + ' ' + (vb - vh).toFixed(1) + 'h' + cw.toFixed(2) + 'v' + vh.toFixed(1) + 'h' + (-cw).toFixed(2) + 'Z';
              if (p.c >= p.o) vu += r; else vd += r;
            }
            if (p.co) { co += 'M' + xl + ' ' + ys(p.c).toFixed(1) + 'h' + cw.toFixed(2); return; }
            var yo = ys(p.o), yc = ys(p.c), top = Math.min(yo, yc), bh = Math.max(1, Math.abs(yc - yo));
            var wick = 'M' + x.toFixed(1) + ' ' + ys(p.h).toFixed(1) + 'V' + ys(p.l).toFixed(1);
            var body = 'M' + xl + ' ' + top.toFixed(1) + 'h' + cw.toFixed(2) + 'v' + bh.toFixed(1) + 'h' + (-cw).toFixed(2) + 'Z';
            if (p.c >= p.o) { up += body; wu += wick; } else { dn += body; wd += wick; }
          });
          if (VH) s += '<path d="' + vu + '" fill="var(--up)" opacity=".28"/><path d="' + vd + '" fill="var(--dn)" opacity=".28"/>';
          s += '<path d="' + wu + '" stroke="var(--up)" stroke-width="1" fill="none"/><path d="' + wd + '" stroke="var(--dn)" stroke-width="1" fill="none"/>';
          s += '<path d="' + up + '" fill="var(--up)"/><path d="' + dn + '" fill="var(--dn)"/>';
          if (co) s += '<path d="' + co + '" stroke="var(--mu)" stroke-width="1.5" fill="none"/>';
          s += '<g class="cur" style="display:none"><line y1="' + PT + '" y2="' + (H - PB) + '" stroke="var(--mu)" stroke-dasharray="2 3"/></g>';
        } else {
          var path = '';
          for (k = 0; k < n; k++) path += (k ? 'L' : 'M') + xs(k).toFixed(1) + ' ' + ys(P[k].c).toFixed(1);
          var base = (H - PB).toFixed(1);
          s += '<path d="' + path + 'L' + xs(n - 1).toFixed(1) + ' ' + base + 'L' + xs(0).toFixed(1) + ' ' + base + 'Z" fill="url(#' + gid + ')"/>';
          s += '<path d="' + path + '" fill="none" stroke="' + col + '" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>';
          s += '<circle cx="' + xs(n - 1).toFixed(1) + '" cy="' + ys(C[last]).toFixed(1) + '" r="3.5" fill="' + col + '" stroke="var(--bg)" stroke-width="1.5"/>';
          s += '<g class="cur" style="display:none"><line y1="' + PT + '" y2="' + (H - PB) + '" stroke="var(--mu)" stroke-dasharray="2 3"/><circle r="4" fill="var(--bg)" stroke="' + col + '" stroke-width="2"/></g>';
        }
        s += '</svg>';
        wrap.innerHTML = s;
        wrap.appendChild(tip);
        svgEl = wrap.firstChild;
        if (cur >= 0) showAt(Math.min(cur, n - 1));
      }
      function pdate(p) {
        if (agg === 'w') return 'Week of ' + fullDate(D[p.a]);
        if (agg === 'm') { var x = parts(D[p.a]); return MON[x[1]] + ' ' + x[0]; }
        return fullDate(D[p.a]);
      }
      function showAt(j) {
        var n = P.length;
        if (j < 0) j = 0; if (j > n - 1) j = n - 1;
        cur = j;
        var p = P[j], g = svgEl.querySelector('.cur'), x = xs(j);
        g.style.display = '';
        g.firstChild.setAttribute('x1', x); g.firstChild.setAttribute('x2', x);
        if (g.lastChild !== g.firstChild) { g.lastChild.setAttribute('cx', x); g.lastChild.setAttribute('cy', ys(p.c)); }
        var b = C[i0], pc = b ? (p.c - b) / b * 100 : 0, chg = p.b > i0 ? ' \u00b7 ' + (pc > 0 ? '+' : pc < 0 ? MINUS : '') + num(pc, 2) + '%' : '';
        var dl = lt && p.b === last ? ' \u00b7 delayed ' + lt + ' ET' : '';   // bar (or week / month) ending with the live price
        if (type === 'candles') {
          tip.innerHTML = pdate(p) + dl + ' \u00b7 ' + (p.co ? (dl ? 'Last <b>' + price(p.c) + '</b>' : 'Close <b>' + price(p.c) + '</b> (close only)')
            : 'O <b>' + price(p.o) + '</b> H <b>' + price(p.h) + '</b> L <b>' + price(p.l) + '</b> ' + (dl ? 'Last' : 'C') + ' <b>' + price(p.c) + '</b>') + chg;
        } else tip.innerHTML = fullDate(D[p.a]) + dl + ' \u00b7 <b>' + price(p.c) + '</b>' + chg;
        tip.style.display = 'block';
        var tw = tip.offsetWidth, px = x * wrap.clientWidth / W;
        tip.style.left = Math.max(0, Math.min(wrap.clientWidth - tw, px - tw / 2)) + 'px';
      }
      function hide() { cur = -1; tip.style.display = 'none'; var g = svgEl && svgEl.querySelector('.cur'); if (g) g.style.display = 'none'; }
      function idxAt(clientX) {
        var r = wrap.getBoundingClientRect(), x = (clientX - r.left) * W / r.width, n = P.length, plotW = W - PL - PR;
        return type === 'candles' ? Math.floor((x - PL) / (plotW / n)) : Math.round((x - PL) / plotW * (n - 1));
      }
      wrap.addEventListener('pointermove', function (e) { showAt(idxAt(e.clientX)); });
      wrap.addEventListener('pointerdown', function (e) { showAt(idxAt(e.clientX)); });
      wrap.addEventListener('pointerleave', hide);
      wrap.addEventListener('blur', hide);
      wrap.addEventListener('keydown', function (e) {
        var k = e.key, j = cur < 0 ? P.length - 1 : cur;
        if (k === 'ArrowLeft') j--; else if (k === 'ArrowRight') j++;
        else if (k === 'PageUp') j -= 20; else if (k === 'PageDown') j += 20;
        else if (k === 'Home') j = 0; else if (k === 'End') j = P.length - 1; else if (k === 'Escape') { hide(); return; } else return;
        e.preventDefault(); showAt(j);
      });
      box.querySelector('.rg').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        range = b.getAttribute('data-r'); hide();
        Array.prototype.forEach.call(this.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        draw();
      });
      var tyEl = box.querySelector('.ty');
      function setType(t) {
        type = t; hide();
        Array.prototype.forEach.call(tyEl.children, function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-t') === t ? 'true' : 'false'); });
        draw();
      }
      tyEl.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b || b.disabled) return;
        var t = b.getAttribute('data-t'); if (t === type) return;
        if (t === 'candles' && !O) {                                   // first switch: fetch the OHLC reply once
          b.disabled = true;
          load(sym, true).then(function (q2) {
            b.disabled = false;
            if (q2 && q2.o) { setData(q2); }
            if (!hasOhlc) { b.disabled = true; b.title = 'No open/high/low data for this symbol'; return; }
            setType('candles');
          });
          return;
        }
        setType(t);
      });
      if (O && !hasOhlc) { var cb = tyEl.querySelector('[data-t="candles"]'); cb.disabled = true; cb.title = 'No open/high/low data for this symbol'; }
      draw();
      var lastW = W, raf = 0;
      if (window.ResizeObserver) new ResizeObserver(function (en) {
        var w = Math.round(en[0].contentRect.width);
        if (Math.abs(w - lastW) < 8) return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { lastW = w; draw(); });
      }).observe(wrap);
    }
  }

  function scan() { Array.prototype.forEach.call(document.querySelectorAll(SEL), mount); }
  window.qlStockchart = { scan: scan, version: 1 };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  if (window.MutationObserver) {
    var t = 0;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 50); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
})();
