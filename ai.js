// SpeedPro AI Assistant — powered by Claude Sonnet
'use strict';

const _AI_KEY  = 'sp_claude_key';
let   _aiHist  = []; // conversation history

// ── Key helpers ──────────────────────────────────────────────────────────────
function _getKey() { return localStorage.getItem(_AI_KEY) || ''; }
function _setKey(k) { localStorage.setItem(_AI_KEY, k.trim()); }

// ── Build context from live dashboard data ────────────────────────────────────
function _buildCtx() {
    const accs  = window.allRawAccounts || [];
    const logs  = window.allLogsArray   || [];
    const today = new Date().toLocaleDateString('ar-SA-u-ca-islamic-umalqura');
    const PN    = { orders:'نينجا', keeta:'كيتا', hunger:'هنقر', jahez:'جاهز', chefz:'شفز' };

    let s = `📅 ${today}\n\n`;

    ['orders','keeta','hunger','jahez','chefz'].forEach(p => {
        const all    = accs.filter(a => a.platform === p);
        if (!all.length) return;
        const active = all.filter(a => a.status === 'قيد الاستخدام' || a.status === 'مصروف');
        const avail  = all.filter(a => a.status === 'متاح');
        const totO   = active.reduce((t,a) => t + (Number(a.totalOrders)||0), 0);
        const totW   = active.reduce((t,a) => t + (Number(a.wallet)||0), 0);

        s += `### ${PN[p]} | نشط:${active.length} متاح:${avail.length} إجمالي:${all.length} | طلبات:${totO} محفظة:${totW.toFixed(0)}\n`;
        active.forEach(a => {
            s += `  · ${a.actualUserName||a.ownerName||a.id}: طلبات=${a.totalOrders||0} يومي=${a.dailyOrders||0} مرفوض=${a.rejectedOrders||0} محفظة=${a.wallet||0} مشرف=${a.supervisor||'-'}`;
            if (p === 'hunger') s += ` كم_يومي=${a.kmDaily||0} كم_إجمالي=${a.kmTotal||0}`;
            if (p === 'keeta')  s += ` إلغاء=${a.cancelRate||0}% في_الوقت=${a.onTimeRate||100}%`;
            s += '\n';
        });
        if (avail.length) s += `  متاح: ${avail.map(a=>a.ownerName||a.id).join('، ')}\n`;
        s += '\n';
    });

    // Last 8 log entries
    const recent = [...logs].sort((a,b)=>new Date(b.endDate)-new Date(a.endDate)).slice(0,8);
    if (recent.length) {
        s += '### آخر السجلات التاريخية\n';
        recent.forEach(l => s += `  · ${l.driver||'-'} (${PN[l.platform]||l.platform}): ${l.startDate}→${l.endDate} | طلبات=${l.totalOrders||0} محفظة=${l.wallet||0}\n`);
    }
    return s;
}

// ── Claude API call ───────────────────────────────────────────────────────────
async function _callClaude(userMsg) {
    const key = _getKey();
    if (!key) throw new Error('NO_KEY');

    const sys = `أنت مساعد ذكي لنظام SpeedPro لإدارة مناديب التوصيل في المملكة العربية السعودية.
مهمتك مساعدة المشرفين على تحليل الأداء، رصد المشكلات، واتخاذ قرارات ذكية.
قواعد الإجابة:
- أجب دائماً بالعربية الفصيحة البسيطة
- كن موجزاً وعملياً — لا تكرر الأرقام الخام
- استخدم أيقونات emoji لتنظيم النقاط
- اقترح إجراءات قابلة للتنفيذ
- إذا لم تجد بيانات كافية، قل ذلك بوضوح

=== بيانات النظام الحالية ===
${_buildCtx()}`;

    const msgs = [..._aiHist.slice(-8), { role:'user', content:userMsg }];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:1400, system:sys, messages:msgs })
    });

    if (!resp.ok) {
        const err = await resp.json().catch(()=>({}));
        throw new Error(err.error?.message || `خطأ HTTP ${resp.status}`);
    }

    const data  = await resp.json();
    const reply = data.content[0].text;
    _aiHist.push({ role:'user',      content:userMsg });
    _aiHist.push({ role:'assistant', content:reply   });
    return reply;
}

// ── Chat UI ───────────────────────────────────────────────────────────────────
function openAIChat() {
    if (!_getKey()) { _aiAskKey(); return; }
    const p = document.getElementById('_aiPanel');
    if (!p) return;
    const opening = !p.classList.contains('open');
    p.classList.toggle('open');
    if (opening) { runSmartAlerts(); document.getElementById('_aiInput')?.focus(); }
}

function _aiAskKey() {
    Swal.fire({
        title: '🔑 مفتاح Claude API',
        html: `<input id="_keyInp" type="password" class="form-control mt-2" placeholder="sk-ant-api03-…" dir="ltr" style="font-size:.85rem;" value="${_getKey()}">
               <small class="text-muted d-block mt-2 text-end">يُحفظ في المتصفح فقط ولا يُشارك مع أي جهة</small>`,
        confirmButtonText: 'حفظ وتشغيل',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        preConfirm: () => {
            const v = document.getElementById('_keyInp')?.value.trim();
            if (!v) Swal.showValidationMessage('الرجاء إدخال مفتاح صالح');
            return v;
        }
    }).then(r => { if (r.isConfirmed && r.value) { _setKey(r.value); openAIChat(); } });
}

function aiSetKey() { _aiAskKey(); }

// ── Send message ──────────────────────────────────────────────────────────────
async function sendAIMsg() {
    const inp = document.getElementById('_aiInput');
    const msg = (inp?.value || '').trim();
    if (!msg) return;
    inp.value = '';
    _aiPush('user', msg);
    _aiPush('typing');
    try {
        const reply = await _callClaude(msg);
        _aiPopTyping();
        _aiPush('assistant', reply);
    } catch(e) {
        _aiPopTyping();
        _aiPush('assistant', e.message === 'NO_KEY'
            ? '⚠️ أدخل مفتاح API أولاً — اضغط ⚙️'
            : `❌ ${e.message}`);
    }
}

function _aiPush(role, text) {
    const box = document.getElementById('_aiMsgs');
    if (!box) return;
    const d = document.createElement('div');
    if (role === 'typing') {
        d.className = 'ai-msg ai-assistant ai-typing';
        d.innerHTML = '<span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>';
    } else {
        d.className = `ai-msg ai-${role}`;
        d.innerHTML = (text||'')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/\n/g,'<br>')
            .replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')
            .replace(/\*(.*?)\*/g,'<em>$1</em>');
    }
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
}

function _aiPopTyping() { document.querySelector('.ai-typing')?.remove(); }

function _aiQuick(q) {
    const inp = document.getElementById('_aiInput');
    if (!inp) return;
    const panel = document.getElementById('_aiPanel');
    if (panel && !panel.classList.contains('open')) openAIChat();
    inp.value = q;
    sendAIMsg();
}

// ── Daily Report ──────────────────────────────────────────────────────────────
async function generateAIReport() {
    const btn = document.getElementById('_aiRptBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>'; }

    const panel = document.getElementById('_aiPanel');
    if (panel && !panel.classList.contains('open')) openAIChat();

    _aiPush('user', '📊 اطلب تقرير يومي شامل');
    _aiPush('typing');

    try {
        const r = await _callClaude(
            'اعمل تقرير يومي شامل لأداء جميع المنصات الآن. رتّبه هكذا:\n' +
            '١) ملخص عام في سطرين\n' +
            '٢) أداء كل منصة (طلبات + مشاكل)\n' +
            '٣) أبرز المناديب (الأفضل والأسوأ)\n' +
            '٤) تنبيهات عاجلة\n' +
            '٥) توصيات للغد\n' +
            'استخدم emoji ونقاط منظمة.'
        );
        _aiPopTyping();
        _aiPush('assistant', r);
    } catch(e) {
        _aiPopTyping();
        _aiPush('assistant', `❌ ${e.message}`);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-file-earmark-bar-graph"></i>'; }
    }
}

// ── Smart Alerts ──────────────────────────────────────────────────────────────
function runSmartAlerts() {
    const accs  = window.allRawAccounts || [];
    const logs  = window.allLogsArray   || [];
    const today = new Date();
    const alerts = [];
    const active = accs.filter(a => a.status === 'قيد الاستخدام' || a.status === 'مصروف');

    // محفظة سالبة كبيرة
    active.filter(a => Number(a.wallet) < -500).forEach(a => {
        alerts.push({ t:'danger', i:'cash-coin',
            m:`محفظة ${a.actualUserName||a.ownerName} وصلت ${Number(a.wallet).toLocaleString()} ريال (${a.platform})` });
    });

    // صفر طلبات لأكثر من يومين
    active.filter(a => Number(a.totalOrders) === 0).forEach(a => {
        const days = a.dispatchDate
            ? Math.floor((today - new Date(a.dispatchDate)) / 86400000) : 0;
        if (days >= 2) alerts.push({ t:'warning', i:'person-x',
            m:`${a.actualUserName||a.ownerName}: صفر طلبات منذ ${days} أيام (${a.platform})` });
    });

    // معدل رفض مرتفع >15%
    active.filter(a => {
        const tot = Number(a.totalOrders)||0, rej = Number(a.rejectedOrders)||0;
        return tot > 10 && (rej/tot) > 0.15;
    }).forEach(a => {
        const r = Math.round(Number(a.rejectedOrders)/Number(a.totalOrders)*100);
        alerts.push({ t:'warning', i:'x-circle',
            m:`معدل رفض ${r}%: ${a.actualUserName||a.ownerName} (${a.platform})` });
    });

    // دوران مرتفع هذا الشهر (3+ سجلات)
    const mo = today.getMonth(), yr = today.getFullYear();
    const mLogs = logs.filter(l => { const d=new Date(l.endDate||''); return d.getMonth()===mo&&d.getFullYear()===yr; });
    const cnt = {};
    mLogs.forEach(l => cnt[l.id] = (cnt[l.id]||0) + 1);
    Object.entries(cnt).filter(([,c]) => c >= 3).forEach(([id,c]) => {
        const a = accs.find(x => String(x.id) === String(id));
        if (a) alerts.push({ t:'info', i:'arrow-repeat',
            m:`${a.actualUserName||a.ownerName||id}: تم تدويره ${c} مرات هذا الشهر` });
    });

    // كيتا: معدل إلغاء مرتفع
    active.filter(a => a.platform==='keeta' && Number(a.cancelRate||0) > 5).forEach(a => {
        alerts.push({ t:'danger', i:'exclamation-triangle',
            m:`إلغاء كيتا مرتفع: ${a.actualUserName||a.ownerName} — ${Number(a.cancelRate).toFixed(1)}%` });
    });

    // هنقر: محفظة لم تُسوَّ منذ فترة
    active.filter(a => a.platform==='hunger' && Number(a.wallet) > 800).forEach(a => {
        alerts.push({ t:'info', i:'piggy-bank',
            m:`رصيد هنقر مرتفع: ${a.actualUserName||a.ownerName} — ${Number(a.wallet).toLocaleString()} ريال (يحتاج تسوية)` });
    });

    // Update FAB badge
    const badge = document.getElementById('_aiBadge');
    if (badge) { badge.textContent = alerts.length; badge.style.display = alerts.length ? '' : 'none'; }

    // Render list
    const list = document.getElementById('_aiAlerts');
    if (!list) return;
    list.innerHTML = alerts.length
        ? alerts.map(a => `<div class="sp-ai-alert sp-ai-alert-${a.t}"><i class="bi bi-${a.i} me-1"></i>${a.m}</div>`).join('')
        : '<div style="text-align:center;padding:5px 0;font-size:.73rem;color:#64748b;">✅ لا توجد تنبيهات حالياً</div>';
}

// ── Auto-init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Run alerts once data is available (Firebase usually ready within 3-4s)
    setTimeout(() => { if ((window.allRawAccounts||[]).length) runSmartAlerts(); }, 4000);
});
