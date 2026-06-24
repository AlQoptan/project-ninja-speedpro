// ==========================================================================
//  SpeedPro internal chat — 1-to-1 threads between the admin side and each
//  supervisor. Thread id = supervisor username. All admins share the admin
//  side of every supervisor's thread (shared management inbox).
//  Realtime via Firebase. Loaded after app.js (uses database, adminUsers, L,
//  escHtml, currentLang, window.loggedInUser).
// ==========================================================================
(function () {
  'use strict';

  let _chats = {};
  let _openThread = null;
  let _started = false;

  const _admins = () => (typeof adminUsers !== 'undefined' && adminUsers) ? adminUsers : {};
  const meUser = () => window.loggedInUser;
  const meRec  = () => _admins()[meUser()] || {};
  const meName = () => meRec().name || meUser() || '—';
  const isAdminSide = () => { const r = meRec().role; return r === 'super_admin' || r === 'admin'; };
  const tr = (ar, en) => (typeof L === 'function' ? L(ar, en) : ar);
  const isOnline = u => !!(window.presenceData && window.presenceData[u] && window.presenceData[u].online);
  const anyAdminOnline = () => { const all = _admins(); for (const u in all) { const r = all[u]; if (r && (r.role === 'super_admin' || r.role === 'admin') && isOnline(u)) return true; } return false; };

  function supervisorList() {
    const out = [];
    const all = _admins();
    for (const u in all) { if (all[u] && all[u].role === 'supervisor') out.push({ user: u, name: all[u].name || u }); }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  function threadUnread(threadId) {
    const t = _chats[threadId] || {};
    const msgs = t.messages || {};
    const lastRead = (t.read && t.read[meUser()]) || 0;
    let n = 0;
    for (const k in msgs) { const m = msgs[k]; if (m && m.ts > lastRead && m.from !== meUser()) n++; }
    return n;
  }

  function totalUnread() {
    if (isAdminSide()) { let n = 0; supervisorList().forEach(s => n += threadUnread(s.user)); return n; }
    return threadUnread(meUser());
  }

  function updateChatBadge() {
    const b = document.getElementById('chatBadge');
    if (!b) return;
    const n = totalUnread();
    b.textContent = n > 99 ? '99+' : n;
    b.style.display = n > 0 ? '' : 'none';
  }

  function _fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts), now = new Date();
    const loc = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en-US' : 'ar-EG';
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  }

  window.initChat = function () {
    if (_started || !meUser()) return;
    _started = true;
    database.ref('ninja_data/chats').on('value', snap => {
      _chats = snap.val() || {};
      updateChatBadge();
      const panel = document.getElementById('chatPanel');
      if (panel && panel.classList.contains('open')) { if (_openThread) renderChatThread(); else renderChatList(); }
    });
    // live online/offline updates (don't re-render messages → just refresh list or header)
    database.ref('ninja_data/presence').on('value', snap => {
      window.presenceData = snap.val() || {};
      const panel = document.getElementById('chatPanel');
      if (panel && panel.classList.contains('open')) { if (_openThread) _setThreadHeader(_openThread); else renderChatList(); }
    });
  };

  window.toggleChat = function () {
    const p = document.getElementById('chatPanel');
    if (!p) return;
    const np = document.getElementById('notifPanel'); if (np) np.classList.remove('open');
    const opening = !p.classList.contains('open');
    p.classList.toggle('open');
    if (opening) {
      initChat();
      if (isAdminSide()) { _openThread = null; renderChatList(); }
      else { openChatThread(meUser()); }
    }
  };

  window.chatBackToList = function () { _openThread = null; renderChatList(); };

  function renderChatList() {
    const list = document.getElementById('chatListView');
    const thread = document.getElementById('chatThreadView');
    if (!list) return;
    list.style.display = '';
    thread.style.display = 'none';
    document.getElementById('chatBack').style.display = 'none';
    document.getElementById('chatHeadAv').style.display = 'none';
    document.getElementById('chatSub').style.display = 'none';
    document.getElementById('chatTitle').textContent = tr('المحادثات', 'Messages');
    const sups = supervisorList();
    if (!sups.length) { list.innerHTML = `<div class="chat-empty">${tr('لا يوجد مشرفين', 'No supervisors')}</div>`; return; }
    list.innerHTML = sups.map(s => {
      const t = _chats[s.user] || {};
      const msgs = t.messages ? Object.values(t.messages).sort((a, b) => a.ts - b.ts) : [];
      const last = msgs.length ? msgs[msgs.length - 1] : null;
      const un = threadUnread(s.user);
      const preview = last ? escHtml((last.text || '').slice(0, 38)) : `<span class="chat-muted">${tr('لا توجد رسائل', 'No messages')}</span>`;
      const on = isOnline(s.user);
      return `<div class="chat-li" onclick="openChatThread('${s.user}')">
          <div class="chat-av-wrap"><div class="chat-li-av">${escHtml((s.name || s.user).charAt(0).toUpperCase())}</div><span class="chat-status-dot ${on ? 'on' : 'off'}"></span></div>
          <div class="chat-li-body">
            <div class="chat-li-top"><b>${escHtml(s.name)}</b><span class="chat-li-time">${last ? _fmtTime(last.ts) : ''}</span></div>
            <div class="chat-li-prev">${on ? `<span class="chat-online-txt">${tr('متصل الآن', 'Online')}</span> · ` : ''}${preview}</div>
          </div>
          ${un ? `<span class="chat-li-badge">${un}</span>` : ''}
        </div>`;
    }).join('');
  }

  function _setThreadHeader(threadId) {
    let title, sub, online, letter;
    if (isAdminSide()) {
        const r = _admins()[threadId];
        title = (r && r.name) || threadId;
        online = isOnline(threadId);
        letter = (title.charAt(0) || '?').toUpperCase();
        sub = (online ? '🟢 ' + tr('متصل الآن', 'Online') : '⚪ ' + tr('غير متصل', 'Offline')) + ' · ' + tr('مشرف', 'Supervisor');
    } else {
        title = tr('الإدارة', 'Management');
        online = anyAdminOnline();
        letter = '🛡️';
        sub = online ? '🟢 ' + tr('الإدارة متصلة الآن', 'Management is online') : tr('فريق إدارة SpeedPro', 'SpeedPro management team');
    }
    document.getElementById('chatTitle').textContent = title;
    const subEl = document.getElementById('chatSub'); subEl.textContent = sub; subEl.style.display = '';
    const avEl = document.getElementById('chatHeadAv');
    avEl.innerHTML = escHtml(letter) + `<span class="chat-status-dot ${online ? 'on' : 'off'}"></span>`;
    avEl.style.display = '';
  }

  window.openChatThread = function (threadId) {
    _openThread = threadId;
    document.getElementById('chatListView').style.display = 'none';
    document.getElementById('chatThreadView').style.display = 'flex';
    document.getElementById('chatBack').style.display = isAdminSide() ? '' : 'none';
    _setThreadHeader(threadId);
    const inp = document.getElementById('chatInput');
    if (inp) inp.placeholder = tr('اكتب رسالة...', 'Type a message...');
    renderChatThread();
    setTimeout(() => { const m = document.getElementById('chatMsgs'); if (m) m.scrollTop = m.scrollHeight; }, 60);
  };

  function renderChatThread() {
    if (!_openThread) return;
    const box = document.getElementById('chatMsgs');
    if (!box) return;
    const t = _chats[_openThread] || {};
    const msgs = t.messages ? Object.values(t.messages).sort((a, b) => a.ts - b.ts) : [];
    if (!msgs.length) {
      box.innerHTML = `<div class="chat-empty">${tr('ابدأ المحادثة 👋', 'Start the conversation 👋')}</div>`;
    } else {
      box.innerHTML = msgs.map(m => {
        const mine = m.from === meUser();
        const who = mine ? '' : `<div class="chat-from">${escHtml(m.fromName || m.from)}</div>`;
        return `<div class="chat-msg ${mine ? 'mine' : 'theirs'}">${who}<div class="chat-bubble">${escHtml(m.text)}</div><div class="chat-time">${_fmtTime(m.ts)}</div></div>`;
      }).join('');
      box.scrollTop = box.scrollHeight;
    }
    // mark this thread read for me
    database.ref('ninja_data/chats/' + _openThread + '/read/' + meUser()).set(Date.now());
  }

  window.sendChatMsg = function () {
    const inp = document.getElementById('chatInput');
    if (!inp || !_openThread) return;
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    const msg = { from: meUser(), fromName: meName(), text: text, ts: Date.now() };
    database.ref('ninja_data/chats/' + _openThread + '/messages').push(msg);
    database.ref('ninja_data/chats/' + _openThread + '/meta').set({ lastText: text, lastTs: msg.ts, lastFrom: meUser() });
    database.ref('ninja_data/chats/' + _openThread + '/read/' + meUser()).set(Date.now());
    if (typeof logAudit === 'function') logAudit('رسالة', _openThread, 'أرسل رسالة في الشات');
  };
})();
