// ==========================================================================
//  SpeedPro analytics panel (admins) — KPIs, 7-day orders trend, top drivers,
//  and platform comparison. Computed live from existing data; CSS-bar visuals.
// ==========================================================================
(function () {
  'use strict';
  const tr = (a, e) => (typeof L === 'function' ? L(a, e) : a);
  const PNAME = () => ({ ninja: tr('نينجا', 'Ninja'), keeta: tr('كيتا', 'Keeta'), hunger: tr('هنقر', 'Hunger'), jahez: tr('جاهز', 'Jahez'), chefz: tr('شفز', 'Chefz') });
  const num = v => Number(v) || 0;
  const esc = s => (typeof escHtml === 'function' ? escHtml(s) : String(s == null ? '' : s));

  function kpiCard(label, value, color) {
    return `<div class="an-kpi"><div class="an-kpi-val" style="color:${color}">${value}</div><div class="an-kpi-lbl">${label}</div></div>`;
  }
  function barRow(label, value, max, color) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return `<div class="an-bar-row"><div class="an-bar-lbl">${esc(label)}</div><div class="an-bar-track"><div class="an-bar-fill" style="width:${pct}%;background:${color}"></div></div><div class="an-bar-val">${value}</div></div>`;
  }

  window.openAnalytics = function () {
    const me = (typeof adminUsers !== 'undefined' && adminUsers[window.loggedInUser]) || {};
    if (me.role !== 'super_admin' && me.role !== 'admin') return alert(tr('❌ التحليلات متاحة للإدارة فقط', '❌ Analytics is available to management only'));
    const box = document.getElementById('analyticsBody');
    if (!box) return;

    const accs = (window.allRawAccounts || []).filter(Boolean);
    const active = accs.filter(a => a.status === 'قيد الاستخدام' || a.status === 'مصروف');
    const todayOrders = accs.reduce((s, a) => s + num(a.dailyOrders), 0);
    const cumulative = accs.reduce((s, a) => s + num(a.totalOrders), 0);
    const totalWallet = accs.reduce((s, a) => s + num(a.wallet), 0);
    const negWallets = accs.filter(a => num(a.wallet) < 0).length;
    const avgPerDriver = active.length ? Math.round(cumulative / active.length) : 0;

    // KPIs
    let html = `<div class="an-kpis">
      ${kpiCard(tr('إجمالي الحسابات', 'Total accounts'), accs.length, '#4361ee')}
      ${kpiCard(tr('قيد الاستخدام', 'In use'), active.length, '#10b981')}
      ${kpiCard(tr('طلبات اليوم', "Today's orders"), todayOrders, '#0891b2')}
      ${kpiCard(tr('التراكمي', 'Cumulative'), cumulative, '#7c3aed')}
      ${kpiCard(tr('متوسط/مندوب', 'Avg/driver'), avgPerDriver, '#f59e0b')}
      ${kpiCard(tr('محافظ سالبة', 'Negative wallets'), negWallets, '#ef4444')}
    </div>`;

    // 7-day orders trend
    const rec = window.allDailyRecords || {};
    const days = Object.keys(rec).sort().slice(-7);
    const dayTotals = days.map(d => Object.values(rec[d] || {}).reduce((s, r) => s + num(r && r.orders), 0));
    const maxDay = Math.max(1, ...dayTotals);
    html += `<div class="an-sec">📈 ${tr('اتجاه الطلبات — آخر 7 أيام', 'Orders trend — last 7 days')}</div>`;
    if (days.length) {
      html += `<div class="an-trend">` + days.map((d, i) => {
        const h = Math.round((dayTotals[i] / maxDay) * 100);
        const lbl = String(d).slice(-5);
        return `<div class="an-trend-col"><div class="an-trend-v">${dayTotals[i]}</div><div class="an-trend-bar" style="height:${Math.max(4, h)}%"></div><div class="an-trend-d">${esc(lbl)}</div></div>`;
      }).join('') + `</div>`;
    } else { html += `<div class="an-empty">${tr('لا توجد بيانات يومية بعد', 'No daily data yet')}</div>`; }

    // Platform comparison (cumulative orders)
    const platOrders = {};
    accs.forEach(a => { const p = (a.platform || 'ninja'); platOrders[p] = (platOrders[p] || 0) + num(a.totalOrders); });
    const pn = PNAME();
    const platMax = Math.max(1, ...Object.values(platOrders));
    html += `<div class="an-sec">📊 ${tr('مقارنة المنصات (تراكمي)', 'Platform comparison (cumulative)')}</div><div class="an-bars">`;
    const colors = { ninja: '#4361ee', keeta: '#f59e0b', hunger: '#1e293b', jahez: '#ef4444', chefz: '#0891b2' };
    Object.keys(platOrders).sort((a, b) => platOrders[b] - platOrders[a]).forEach(p => {
      html += barRow(pn[p] || p, platOrders[p], platMax, colors[p] || '#64748b');
    });
    html += `</div>`;

    // Top 5 drivers
    const top = accs.slice().sort((a, b) => num(b.totalOrders) - num(a.totalOrders)).slice(0, 5);
    html += `<div class="an-sec">🏆 ${tr('أفضل 5 مناديب (تراكمي)', 'Top 5 drivers (cumulative)')}</div><div class="an-list">`;
    if (top.length) {
      const tmax = Math.max(1, num(top[0].totalOrders));
      top.forEach((a, i) => {
        html += `<div class="an-li"><span class="an-rank">${i + 1}</span><span class="an-name">${esc(a.actualUserName || a.ownerName || ('#' + a.id))}</span><span class="an-badge">${(pn[a.platform] || a.platform || '')}</span><b class="an-orders">${num(a.totalOrders)}</b></div>`;
      });
    } else { html += `<div class="an-empty">${tr('لا يوجد', 'None')}</div>`; }
    html += `</div>`;

    box.innerHTML = html;
    new bootstrap.Modal(document.getElementById('analyticsModal')).show();
  };
})();
