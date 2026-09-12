/* assets/track.js — YesMyIP first-party analytics beacon.
 *
 * One pageview per page load and one event per affiliate-link click, sent to
 * /api/track (same origin, no cookies, no third-party script). The session id
 * lives in sessionStorage, so "unique visitors" on /admin means distinct
 * browser tabs/sessions, not people. GA4 stays in place alongside this.
 */
(function () {
  'use strict';
  if (location.pathname.indexOf('/admin') === 0) return;
  if (navigator.webdriver) return;

  var sid;
  try {
    sid = sessionStorage.getItem('ymip_sid');
    if (!sid) {
      sid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem('ymip_sid', sid);
    }
  } catch (e) { sid = null; }

  function send(payload) {
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        if (navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))) return;
      }
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    } catch (e) { /* never break the page */ }
  }

  send({
    type: 'pageview',
    path: location.pathname,
    referrer: document.referrer || null,
    locale: document.documentElement.lang || null,
    session_id: sid
  });

  // Affiliate clicks: any link whose host contains a partner name. Capture
  // phase so a handler that navigates away cannot swallow it first.
  var PARTNERS = ['nordvpn', 'surfshark', 'expressvpn', 'cyberghost'];
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var host;
    try { host = new URL(a.href, location.href).hostname.toLowerCase(); } catch (err) { return; }
    for (var i = 0; i < PARTNERS.length; i++) {
      if (host.indexOf(PARTNERS[i]) !== -1) {
        send({ type: 'click', source: PARTNERS[i], destination: a.href, path: location.pathname, session_id: sid });
        return;
      }
    }
  }, true);
})();
