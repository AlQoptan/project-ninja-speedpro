// ==========================================================================
//  SpeedPro notification center (admins) — realtime driver requests + negative
//  wallets, with a bell badge and an optional browser notification on new
//  requests. Loaded after app.js. Chat keeps its own separate badge.
// ==========================================================================
(function () {
  'use strict';

  let _reqs = {};
  let _started = false;
  let _lastPending = -1;

  const tr = (a, e) => (typeof L === 'function' ? L(a, e) : a);
  const role = () => { const u = (typeof adminUsers !== 'undefined' && adminUsers[window.loggedInUser]) || {}; return u.role; };
  const isAdmin = () => role() === 'super_admin' || role() === 'admin';

  function pendingRequests() {
    return Object.entries(_reqs).map(([k, v]) => Object.assign({ __k: k }, v))
      .filter(r => r && r.status === 'pending')
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  function negWallets() {
    return (window.allRawAccounts || []).filter(a => a && Number(a.wallet) < 0)
      .sort((a, b) => Number(a.wallet) - Number(b.wallet));
  }
  function reqLabel(r) {
    const m = { advance: tr('سلفة', 'Advance'), leave: tr('إجازة', 'Leave'), complaint: tr('شكوى', 'Complaint'), issue: tr('بلاغ مشكلة', 'Problem report'), help: tr('مساعدة', 'Help'), inquiry: tr('استفسار', 'Inquiry') };
    return m[r.type] || tr('طلب', 'Request');
  }
  function _fmt(ts) {
    if (!ts) return '';
    const d = new Date(ts), now = new Date();
    const loc = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en-US' : 'ar-EG';
    return d.toDateString() === now.toDateString() ? d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  }

  function updateBadge() {
    const b = document.getElementById('notifBadge'); if (!b) return;
    const n = isAdmin() ? pendingRequests().length : 0;
    b.textContent = n > 99 ? '99+' : n;
    b.style.display = n > 0 ? '' : 'none';
  }

  // [NOTIF] segmented filter (all / requests / wallets)
  let _filter = 'all';
  window.notifSetFilter = function (f) { _filter = f; render(); };

  // [NOTIF] short beep for a new driver request (no audio asset needed)
  function _beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      o.start(); o.stop(ctx.currentTime + 0.36);
      o.onended = () => { try { ctx.close(); } catch (e) {} };
    } catch (e) {}
  }

  function _segBar(reqN, walN) {
    const seg = (k, lbl, n) => `<button class="notif-seg ${_filter === k ? 'active' : ''}" onclick="notifSetFilter('${k}')">${lbl}${n != null ? ` <span class="notif-seg-n">${n}</span>` : ''}</button>`;
    return `<div class="notif-segbar">${seg('all', tr('الكل', 'All'))}${seg('requests', tr('طلبات', 'Requests'), reqN)}${seg('wallets', tr('محافظ', 'Wallets'), walN)}</div>`;
  }

  function render() {
    const box = document.getElementById('notifBody'); if (!box) return;
    const reqs = pendingRequests();
    const wallets = negWallets();
    let html = _segBar(reqs.length, wallets.length);
    if (_filter === 'all' || _filter === 'requests') {
      html += `<div class="notif-sec">📩 ${tr('طلبات المناديب الجديدة', 'New driver requests')} <span class="notif-cnt">${reqs.length}</span></div>`;
      html += reqs.length
        ? reqs.slice(0, 40).map(r => `<div class="notif-item" onclick="notifGoRequests()">
            <div class="notif-ic" style="background:#fef3c7;color:#92400e;">📩</div>
            <div class="notif-tx"><b>${reqLabel(r)}</b> — ${escHtml(r.driverName || '')}<div class="notif-sub">${escHtml((r.message || '').slice(0, 55))}</div></div>
            <div class="notif-time">${_fmt(r.ts)}</div></div>`).join('')
        : `<div class="notif-empty">${tr('لا توجد طلبات جديدة', 'No new requests')} ✅</div>`;
    }
    if (_filter === 'all' || _filter === 'wallets') {
      html += `<div class="notif-sec">💰 ${tr('محافظ سالبة', 'Negative wallets')} <span class="notif-cnt">${wallets.length}</span></div>`;
      html += wallets.length
        ? wallets.slice(0, 40).map(a => `<div class="notif-item" onclick="notifGoPlatform('${escHtml(a.platform || 'ninja')}')">
            <div class="notif-ic" style="background:#fee2e2;color:#991b1b;">💰</div>
            <div class="notif-tx"><b>${escHtml(a.actualUserName || a.ownerName || ('#' + a.id))}</b><div class="notif-sub" dir="ltr">${Number(a.wallet)} ${tr('ريال', 'SAR')}</div></div></div>`).join('')
        : `<div class="notif-empty">${tr('لا يوجد', 'None')} ✅</div>`;
    }
    box.innerHTML = html;
  }

  window.toggleNotif = function () {
    const p = document.getElementById('notifPanel'); if (!p) return;
    const cp = document.getElementById('chatPanel'); if (cp) cp.classList.remove('open');
    const opening = !p.classList.contains('open');
    p.classList.toggle('open');
    if (opening) render();
  };
  window.notifGoRequests = function () {
    const p = document.getElementById('notifPanel'); if (p) p.classList.remove('open');
    if (typeof requestTabSwitch === 'function') requestTabSwitch('portal');
    if (typeof switchPortalTab === 'function') setTimeout(() => switchPortalTab('requests'), 120);
  };
  window.notifGoPlatform = function (plat) {
    const p = document.getElementById('notifPanel'); if (p) p.classList.remove('open');
    const tab = plat === 'ninja' ? 'orders' : plat;
    if (typeof requestTabSwitch === 'function') requestTabSwitch(tab);
  };

  window.initNotif = function () {
    const bell = document.getElementById('notifBell');
    if (bell) bell.style.display = ''; // visible to everyone; CSS reveals it after login
    if (!isAdmin() || _started) return; // but the realtime request listener stays admin-only
    _started = true;
    database.ref('ninja_data/portal_requests').on('value', snap => {
      _reqs = snap.val() || {};
      const n = pendingRequests().length;
      if (_lastPending >= 0 && n > _lastPending) {
        _beep(); // audible cue for a new request
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification('SpeedPro', { body: tr('📩 طلب جديد من مندوب', '📩 New driver request') }); } catch (e) {}
        }
      }
      _lastPending = n;
      updateBadge();
      const p = document.getElementById('notifPanel');
      if (p && p.classList.contains('open')) render();
    });
  };
})();
