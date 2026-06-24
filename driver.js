const firebaseConfig = {
    apiKey: "AIzaSyA17lFPoegXWF7BJKLq3vQVtyU-CI0reqs",
    databaseURL: "https://ninja-system-30301-default-rtdb.firebaseio.com",
    projectId: "ninja-system-30301",
    storageBucket: "ninja-system-30301.appspot.com"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// [SECURITY] sign in anonymously so DB access carries a Firebase token
// (lets the database rules require authentication).
function ensureAuth() {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return auth.signInAnonymously().then(c => c.user).catch(e => { console.warn('anon auth failed', e); return null; });
}
ensureAuth();

const PLATFORM_NAMES = { ninja:'🥷 نينجا', keeta:'🚴 كيتا', hunger:'📦 هنقرستيشن', jahez:'🛒 جاهز', chefz:'👨‍🍳 ذا شفز' };
const DOC_TYPES = [
    { key:'iqama',         label:'الإقامة',          icon:'card-text',              color:'#4361ee' },
    { key:'light_license', label:'رخصة نقل خفيف',    icon:'truck',                  color:'#0891b2' },
    { key:'moto_license',  label:'رخصة دراجة آلية',  icon:'bicycle',                color:'#16a34a' },
    { key:'driver_card',   label:'كرت السائق',        icon:'person-badge-fill',      color:'#7c3aed' },
    { key:'health_cert',   label:'الشهادة الصحية',    icon:'heart-pulse-fill',       color:'#dc2626' },
    { key:'contract',      label:'عقد التشاركي',      icon:'file-earmark-text-fill', color:'#d97706' }
];

let _currentAcc = null, _currentDriverId = null, _currentDriverName = null, _currentDriverPlatform = null;
let _perfChart = null;

function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function normPhone(p) {
    let d = String(p||'').replace(/\D/g,'');
    if (d.startsWith('966')) d = '0' + d.slice(3);
    if (d.length === 9) d = '0' + d;
    return d;
}

/* ── Login ── */
function loginDriver() {
    let phone = document.getElementById('inputPhone').value.trim();
    let iqama = document.getElementById('inputIqama').value.trim();
    let errEl = document.getElementById('loginError');
    errEl.style.display = 'none';
    if (!phone || !iqama) { errEl.textContent='يرجى ملء جميع الحقول'; errEl.style.display=''; return; }
    let phoneNorm = normPhone(phone);
    ensureAuth().then(() => db.ref('ninja_data/accounts').once('value')).then(snap => {
        let found = null;
        snap.forEach(c => {
            let acc = c.val(); if (!acc) return;
            let pm = normPhone(acc.phone) === phoneNorm;
            let im = acc.ownerIqama===iqama || acc.actualIqama===iqama || String(acc.id)===iqama;
            if (pm && im) found = acc;
        });
        if (!found) { errEl.innerHTML='❌ البيانات غير صحيحة، تحقق من رقم الجوال والهوية'; errEl.style.display=''; return; }
        if (found.portalAccess !== true) {
            errEl.innerHTML='🔒 البوابة غير مفعّلة<br><small style="font-weight:400;opacity:.8;">تواصل مع المشرف لتفعيل الوصول</small>';
            errEl.style.display='';
            db.ref('ninja_data/portal_activity').push({ driverId:found.id, driverName:found.actualUserName||found.ownerName, platform:found.platform||'ninja', ts:Date.now(), type:'fail' });
            return;
        }
        db.ref('ninja_data/portal_settings').once('value').then(ss => {
            let settings = ss.val() || {};
            if (settings.emergencyLock === true) { errEl.innerHTML='🚨 البوابة متوقفة مؤقتاً<br><small style="font-weight:400;opacity:.8;">تواصل مع المشرف</small>'; errEl.style.display=''; return; }
            db.ref('ninja_data/portal_activity').push({ driverId:found.id, driverName:found.actualUserName||found.ownerName, platform:found.platform||'ninja', ts:Date.now(), type:'login' });
            if (document.getElementById('rememberMe').checked) {
                localStorage.setItem('sp_portal_phone', phone);
                localStorage.setItem('sp_portal_iqama', iqama);
            }
            showDashboard(found, settings);
        });
    }).catch(() => { errEl.textContent='❌ خطأ في الاتصال، حاول مرة أخرى'; errEl.style.display=''; });
}

/* ── Show Dashboard ── */
function showDashboard(acc, settings) {
    settings = settings || {};
    let sf = settings.showFields || {};
    _currentAcc = acc; _currentDriverId = acc.id;
    _currentDriverName = acc.actualUserName || acc.ownerName;
    _currentDriverPlatform = acc.platform || 'ninja';

    document.getElementById('loginView').style.display = 'none';
    document.getElementById('driverDashboard').style.display = 'block';
    document.body.classList.add('portal-ready');
    if (localStorage.getItem('sp_dark') === '1') document.body.classList.add('driver-dark');
    updateDarkBtn();

    if (sf.wallet===false)      { let el=document.getElementById('kpiWallet');  if(el&&el.closest('.col-6')) el.closest('.col-6').style.display='none'; }
    if (sf.dailyOrders===false) { let el=document.getElementById('kpiDaily');   if(el&&el.closest('.col-6')) el.closest('.col-6').style.display='none'; }
    if (sf.totalOrders===false) { let el=document.getElementById('kpiTotal');   if(el&&el.closest('.col-6')) el.closest('.col-6').style.display='none'; }
    if (sf.hours===false)       { let el=document.getElementById('kpiHours');   if(el&&el.closest('.col-6')) el.closest('.col-6').style.display='none'; }
    if (sf.notes===false)       { let n=document.getElementById('notesCard');   if(n) n.style.display='none'; }
    if (sf.supervisor===false)  { let s=document.getElementById('infoSuperRow');if(s) s.style.display='none'; }

    if (settings.welcomeMessage) {
        let wm = document.getElementById('welcomeMsg');
        if (wm) { wm.textContent=settings.welcomeMessage; wm.style.display=''; }
    }

    let statusMap = { 'متاح':'status-avail','قيد الاستخدام':'status-used','مصروف':'status-used','موقوف':'status-stop' };
    document.getElementById('driverName').textContent     = acc.actualUserName||acc.ownerName||'—';
    document.getElementById('driverPlatform').textContent = PLATFORM_NAMES[acc.platform]||acc.platform||'—';
    document.getElementById('driverEmpNum').textContent   = acc.employeeNumber||'—';
    document.getElementById('driverStatusBadge').textContent  = acc.status||'متاح';
    document.getElementById('driverStatusBadge').className    = 'status-pill '+(statusMap[acc.status]||'status-avail');

    let wallet = Number(acc.wallet)||0;
    document.getElementById('kpiDaily').textContent = acc.dailyOrders||0;
    document.getElementById('kpiTotal').textContent = acc.totalOrders||0;
    document.getElementById('kpiHours').textContent = acc.hours||0;
    let wEl = document.getElementById('kpiWallet');
    wEl.textContent = wallet; wEl.className = 'kpi-val '+(wallet<0?'wallet-neg':'wallet-pos');

    document.getElementById('infoOwner').textContent      = acc.ownerName||'—';
    document.getElementById('infoSupervisor').textContent = acc.supervisor||'—';
    document.getElementById('infoDate').textContent       = acc.dispatchDate||'—';
    document.getElementById('infoPlatform').textContent   = PLATFORM_NAMES[acc.platform]||acc.platform||'—';
    if (acc.notes && acc.notes.trim()) {
        document.getElementById('infoNotes').textContent = acc.notes;
        document.getElementById('notesCard').style.display = '';
    }

    renderRating(acc);
    renderPerfChart(acc);
    loadAnnouncements(acc);
    switchDriverTab('home');
}

/* ── Rating ── */
function renderRating(acc) {
    let total = Number(acc.totalOrders)||0;
    let rating, color, nextLabel, progress;
    if (total >= 150) { rating='A+'; color='linear-gradient(135deg,#f59e0b,#d97706)'; progress=100; nextLabel='أعلى مستوى 🏆'; }
    else if (total >= 100) { rating='A';  color='linear-gradient(135deg,#4361ee,#3a0ca3)'; progress=Math.round((total-100)/50*100); nextLabel=`${150-total} طلب للـ A+`; }
    else if (total >= 50)  { rating='B';  color='linear-gradient(135deg,#16a34a,#15803d)'; progress=Math.round((total-50)/50*100);  nextLabel=`${100-total} طلب للـ A`; }
    else                   { rating='C';  color='linear-gradient(135deg,#64748b,#475569)'; progress=Math.round(total/50*100);        nextLabel=`${50-total} طلب للـ B`; }
    let el = document.getElementById('ratingCard'); if (!el) return;
    el.style.background = color;
    el.innerHTML = `<div class="d-flex justify-content-between align-items-center mb-2">
        <div><div class="small opacity-75 mb-1">تصنيفك الحالي</div><div class="rating-badge-big">${rating}</div></div>
        <div class="text-end"><div class="small opacity-75">${total} طلب تراكمي</div><div class="small opacity-90 mt-1">${nextLabel}</div></div>
    </div><div class="rating-bar"><div class="rating-bar-fill" style="width:${Math.min(progress,100)}%"></div></div>`;
}

/* ── Performance Chart ── */
function renderPerfChart(acc) {
    let daily = Number(acc.dailyOrders)||0, target = 15, remaining = Math.max(0,target-daily);
    let ctx = document.getElementById('perfChart'); if (!ctx) return;
    if (_perfChart) { _perfChart.destroy(); _perfChart=null; }
    let isDark = document.body.classList.contains('driver-dark');
    _perfChart = new Chart(ctx, {
        type: 'doughnut',
        data: { datasets:[{ data:[daily,remaining], backgroundColor:[daily>=target?'#16a34a':'#4361ee', isDark?'#334155':'#e2e8f0'], borderWidth:0, borderRadius:4 }] },
        options: { cutout:'72%', plugins:{legend:{display:false},tooltip:{enabled:false}}, animation:{duration:700} },
        plugins: [{ id:'center', afterDraw(ch){
            let {ctx:c,width:w,height:h}=ch; c.save(); c.textAlign='center'; c.textBaseline='middle';
            let cx=w/2,cy=h/2; c.font='bold 24px Cairo'; c.fillStyle=isDark?'#e2e8f0':'#1e293b';
            c.fillText(daily,cx,cy-6); c.font='11px Cairo'; c.fillStyle=isDark?'#94a3b8':'#64748b';
            c.fillText('طلب اليوم',cx,cy+13); c.restore();
        }}]
    });
    let pct = Math.min(Math.round(daily/target*100),100);
    let lg = document.getElementById('chartLegend');
    if (lg) lg.innerHTML=`<div class="mb-2"><span class="fw-bold fs-5 ${daily>=target?'text-success':'text-primary'}">${daily}</span> <small class="text-muted">/ ${target} هدف اليوم</small></div>
        <div class="mb-3" style="height:8px;background:${isDark?'#334155':'#e2e8f0'};border-radius:4px;">
            <div style="width:${pct}%;height:8px;background:${daily>=target?'#16a34a':'#4361ee'};border-radius:4px;transition:width .6s;"></div>
        </div>
        <div class="d-flex gap-2 flex-wrap">
            <span class="badge bg-primary-subtle text-primary border">${Number(acc.totalOrders)||0} تراكمي</span>
            <span class="badge bg-success-subtle text-success border">${Number(acc.hours)||0} ساعة</span>
        </div>`;
}

/* ── Tabs ── */
function switchDriverTab(tab) {
    ['home','docs','car','requests','salary','help'].forEach(t => {
        let p=document.getElementById('dtab_'+t), b=document.getElementById('dtabBtn_'+t);
        if(p) p.style.display = t===tab?'':'none';
        if(b) b.classList.toggle('active', t===tab);
    });
    if (tab==='docs')     loadMyDocs();
    if (tab==='car')      loadMyCar();
    if (tab==='requests') loadMyRequests();
    if (tab==='salary')   loadMySalary();
}

/* ── Advance Fields Toggle ── */
function toggleAdvanceFields() {
    let type = document.getElementById('reqType').value;
    let af = document.getElementById('advanceFields');
    let lbl = document.getElementById('reqMsgLabel');
    let ta  = document.getElementById('reqMsg');
    if (type==='سلفة') {
        af.style.display='';
        lbl.textContent='ملاحظات إضافية (اختياري)';
        ta.placeholder='أي تفاصيل إضافية تود إضافتها...';
    } else {
        af.style.display='none';
        lbl.textContent='تفاصيل الطلب';
        ta.placeholder='اكتب تفاصيل طلبك هنا...';
    }
}

/* ── Docs ── */
function loadMyDocs() {
    if (!_currentDriverId) return;
    let grid = document.getElementById('docsGrid'); if (!grid) return;
    grid.innerHTML='<div class="col-12 text-center text-muted py-3"><div class="spinner-border spinner-border-sm me-2"></div>جاري التحميل...</div>';
    db.ref('ninja_data/driver_docs/'+_currentDriverId).once('value').then(snap => {
        let docs = snap.val()||{};
        let today = new Date(); today.setHours(0,0,0,0);
        let urgentList = [];
        let html = DOC_TYPES.map(dt => {
            let d = docs[dt.key]||{};
            let expiry = d.expiry||'';
            let status='missing', statusLabel='غير مرفوعة', cls='doc-card missing', badgeCls='dsb dsb-missing';
            if (expiry) {
                let expDate = new Date(expiry); expDate.setHours(0,0,0,0);
                let daysLeft = Math.round((expDate-today)/86400000);
                if (daysLeft < 0)       { status='expired';  statusLabel=`منتهية منذ ${Math.abs(daysLeft)} يوم`; cls='doc-card expired'; badgeCls='dsb dsb-expired'; urgentList.push({label:dt.label,days:daysLeft}); }
                else if (daysLeft <= 30){ status='expiring'; statusLabel=`تنتهي خلال ${daysLeft} يوم`;          cls='doc-card expiring'; badgeCls='dsb dsb-expiring'; urgentList.push({label:dt.label,days:daysLeft}); }
                else                   { status='valid';    statusLabel=`سارية — ${daysLeft} يوم متبقي`;       cls='doc-card valid';   badgeCls='dsb dsb-valid'; }
            } else if (d.fileUrl) { statusLabel='مرفوعة'; cls='doc-card valid'; badgeCls='dsb dsb-valid'; }
            return `<div class="col-12 col-sm-6"><div class="${cls}">
                <div class="d-flex align-items-center gap-2 mb-2"><i class="bi bi-${dt.icon} fs-5" style="color:${dt.color}"></i><span class="fw-bold">${dt.label}</span></div>
                <div class="d-flex justify-content-between align-items-center">
                    <small class="text-muted">${expiry ? new Date(expiry).toLocaleDateString('ar-SA') : '—'}</small>
                    <span class="${badgeCls}">${statusLabel}</span>
                </div>
            </div></div>`;
        }).join('');
        grid.innerHTML = html;
        let alertEl = document.getElementById('docsExpiryAlert');
        if (alertEl && urgentList.length) {
            alertEl.style.cssText='display:block; background:#fff7f0; border:1px solid #fca5a5; border-radius:14px; padding:1rem; margin-bottom:.85rem;';
            alertEl.innerHTML=`<div class="d-flex align-items-start gap-2"><i class="bi bi-exclamation-triangle-fill text-danger fs-5 mt-1 flex-shrink-0"></i>
            <div><div class="fw-bold text-danger mb-1">⚠️ ${urgentList.length} وثيقة تحتاج تجديداً</div>
            ${urgentList.map(u=>`<small class="text-muted d-block">• ${u.label}: ${u.days<0?'منتهية منذ '+Math.abs(u.days)+' يوم':'تنتهي خلال '+u.days+' يوم'}</small>`).join('')}
            <small class="text-primary d-block mt-2 fw-bold">تواصل مع مشرفك لتجديدها في أقرب وقت</small></div></div>`;
        } else if (alertEl) alertEl.style.display='none';
    }).catch(()=>{if(grid)grid.innerHTML='<div class="col-12 text-center text-danger py-3">حدث خطأ في التحميل</div>';});
}

/* ── Car ── */
function loadMyCar() {
    if (!_currentDriverId||!_currentAcc) return;
    let el = document.getElementById('carContent'); if (!el) return;
    el.innerHTML='<div class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm me-2"></div>جاري البحث...</div>';
    db.ref('ninja_data/car_handovers').once('value').then(snap => {
        let handovers = snap.val() ? Object.values(snap.val()).filter(h=>h) : [];
        let myHandover = handovers.find(h =>
            String(h.driverId)===String(_currentDriverId)||
            (h.driverName&&h.driverName===_currentDriverName)
        );
        if (!myHandover) {
            el.innerHTML=`<div class="info-card text-center py-5"><i class="bi bi-car-front fs-1 d-block mb-2 opacity-25"></i>
                <div class="fw-bold text-muted">لا توجد سيارة مخصصة لك حالياً</div>
                <small class="text-muted">تواصل مع مشرفك إذا كنت تعتقد أن هذا خطأ</small></div>`; return;
        }
        db.ref('ninja_data/cars').once('value').then(carsSnap => {
            let allCars = carsSnap.val() ? Object.values(carsSnap.val()).filter(c=>c) : [];
            let car = allCars.find(c=>c.id===myHandover.carId||c.plate===myHandover.plate)||{};
            el.innerHTML=`<div class="info-card text-center mb-3" style="background:linear-gradient(135deg,#1e293b,#334155);color:#fff;">
                <div class="small opacity-60 mb-1">السيارة المخصصة لك</div>
                <div class="car-plate my-2">${escHtml(myHandover.plate||car.plate||'—')}</div>
                <div class="small opacity-75">${escHtml([car.make,car.model,car.year].filter(Boolean).join(' ')||'—')}</div>
            </div>
            <div class="info-card">
                <h6 class="fw-bold text-primary mb-2"><i class="bi bi-car-front me-2"></i>تفاصيل السيارة</h6>
                <div class="info-row"><span class="text-muted">رقم اللوحة</span><b dir="ltr">${escHtml(myHandover.plate||car.plate||'—')}</b></div>
                <div class="info-row"><span class="text-muted">نوع المركبة</span><b>${car.vehicleType||myHandover.vehicleType||'—'}</b></div>
                <div class="info-row"><span class="text-muted">الماركة / الموديل</span><b>${escHtml([car.make,car.model,car.year].filter(Boolean).join(' ')||'—')}</b></div>
                <div class="info-row"><span class="text-muted">تاريخ الاستلام</span><b>${myHandover.receiveDate||myHandover.handoverReceiveDate||'—'}</b></div>
                <div class="info-row"><span class="text-muted">تاريخ التسليم المتوقع</span><b>${myHandover.returnDate||myHandover.handoverReturnDate||'—'}</b></div>
            </div>`;
        });
    }).catch(()=>{if(el)el.innerHTML='<div class="text-center text-danger py-3">حدث خطأ في التحميل</div>';});
}

/* ── Requests ── */
function submitRequest() {
    if (!_currentDriverId) return;
    let type    = document.getElementById('reqType').value;
    let msg     = (document.getElementById('reqMsg').value||'').trim();
    let isAdv   = type==='سلفة';
    let amount='', advDate='', reason='';
    if (isAdv) {
        amount  = (document.getElementById('advanceAmount').value||'').trim();
        advDate = (document.getElementById('advanceDate').value||'').trim();
        reason  = (document.getElementById('advanceReason').value||'').trim();
        if (!amount||!advDate||!reason) { showToast('⚠️ يرجى ملء المبلغ والتاريخ والسبب','warning'); return; }
    } else {
        if (!msg) { showToast('⚠️ يرجى كتابة تفاصيل الطلب','warning'); return; }
    }
    let btn = document.getElementById('submitReqBtn');
    if (btn) { btn.disabled=true; btn.innerHTML='<div class="spinner-border spinner-border-sm me-2"></div>جاري الإرسال...'; }

    let fullMsg = isAdv
        ? `طلب سلفة بمبلغ ${amount} ريال — مطلوب بتاريخ ${advDate}\nالسبب: ${reason}${msg?'\nملاحظات إضافية: '+msg:''}`
        : msg;
    let req = {
        driverId:String(_currentDriverId), driverName:_currentDriverName, platform:_currentDriverPlatform,
        type, message:fullMsg, status:'pending', ts:Date.now(), createdAt:new Date().toLocaleString('ar-SA')
    };
    if (isAdv) { req.advanceAmount=amount; req.advanceDate=advDate; req.advanceReason=reason; }

    db.ref('ninja_data/portal_requests').push(req).then(()=>{
        document.getElementById('reqMsg').value='';
        if (isAdv) {
            document.getElementById('advanceAmount').value='';
            document.getElementById('advanceDate').value='';
            document.getElementById('advanceReason').value='';
        }
        document.getElementById('reqType').value='إجازة';
        toggleAdvanceFields();
        if (btn) { btn.disabled=false; btn.innerHTML='<i class="bi bi-send-fill me-2"></i>إرسال الطلب'; }
        loadMyRequests();
        showToast('✅ تم إرسال طلبك بنجاح، سيتواصل معك المشرف قريباً');
    }).catch(()=>{
        if (btn) { btn.disabled=false; btn.innerHTML='<i class="bi bi-send-fill me-2"></i>إرسال الطلب'; }
        showToast('❌ حدث خطأ في الإرسال','danger');
    });
}

function loadMyRequests() {
    if (!_currentDriverId) return;
    let el = document.getElementById('myRequestsList'); if (!el) return;
    el.innerHTML='<div class="text-center text-muted py-2"><div class="spinner-border spinner-border-sm"></div></div>';
    db.ref('ninja_data/portal_requests').orderByChild('driverId').equalTo(String(_currentDriverId)).once('value').then(snap=>{
        let reqs = snap.val() ? Object.entries(snap.val()).map(([k,v])=>({...v,__key:k})).sort((a,b)=>b.ts-a.ts) : [];
        if (!reqs.length) { el.innerHTML='<div class="text-center text-muted py-3">لا توجد طلبات سابقة</div>'; return; }
        const sMap={
            pending:              ['⏳ بانتظار المشرف',       'rsb-pending'],
            supervisor_approved:  ['🔄 بانتظار الأدمن',      'rsb-pending'],
            supervisor_rejected:  ['❌ مرفوضة من المشرف',    'rsb-rejected'],
            admin_approved:       ['✅ موافق عليها نهائياً',  'rsb-approved'],
            admin_rejected:       ['❌ مرفوضة من الأدمن',    'rsb-rejected'],
            open:                 ['📬 مفتوح',                'rsb-open'],
            closed:               ['✔️ مُغلق',                'rsb-closed'],
            // legacy
            advance_approved:     ['✅ موافق عليها',          'rsb-approved'],
            advance_rejected:     ['❌ مرفوضة',               'rsb-rejected'],
        };
        el.innerHTML = reqs.map(r=>{
            let [slabel,scls]=sMap[r.status]||['—','rsb-pending'];
            let isAdv = r.type==='سلفة';

            let extraInfo = isAdv && r.advanceAmount
                ? `<div class="d-flex gap-2 mt-1 flex-wrap">
                       <span class="badge bg-warning-subtle text-warning border">💰 ${r.advanceAmount} ريال</span>
                       ${r.advanceDate?`<span class="badge bg-secondary-subtle text-secondary border">📅 ${r.advanceDate}</span>`:''}
                   </div>`
                : '';

            let adminHtml = '';
            if (r.status === 'supervisor_approved') {
                adminHtml = `<div class="mt-2 p-2 rounded-2" style="background:#e0f2fe;border:1px solid #7dd3fc;">
                    <small class="fw-bold d-block mb-1" style="color:#0284c7;"><i class="bi bi-person-check-fill me-1"></i>وافق عليك المشرف — بانتظار الأدمن</small>
                    ${r.supervisorPerformance ? `<small class="text-muted">تقييمك: <b>${escHtml(r.supervisorPerformance)}</b></small>` : ''}
                </div>`;
            } else if (r.status === 'supervisor_rejected') {
                adminHtml = `<div class="mt-2 p-2 rounded-2" style="background:#fef2f2;border:1px solid #fca5a5;">
                    <small class="fw-bold text-danger d-block mb-1"><i class="bi bi-person-x-fill me-1"></i>تم رفض طلبك من المشرف</small>
                    ${r.supervisorRejectionReason ? `<small class="text-muted">السبب: ${escHtml(r.supervisorRejectionReason)}</small>` : ''}
                </div>`;
            } else if (r.status === 'admin_approved' || r.status === 'advance_approved') {
                adminHtml = `<div class="mt-2 p-2 rounded-2" style="background:#f0fdf4;border:1px solid #86efac;">
                    <small class="fw-bold text-success d-block mb-1"><i class="bi bi-check-circle-fill me-1"></i>تمت الموافقة على طلبك ✅</small>
                    ${r.approvalNote ? `<small class="text-muted">${escHtml(r.approvalNote)}</small>` : ''}
                </div>`;
            } else if (r.status === 'admin_rejected' || r.status === 'advance_rejected') {
                adminHtml = `<div class="mt-2 p-2 rounded-2" style="background:#fef2f2;border:1px solid #fca5a5;">
                    <small class="fw-bold text-danger d-block mb-1"><i class="bi bi-x-circle-fill me-1"></i>تم رفض طلبك</small>
                    ${r.rejectionReason ? `<small class="text-muted">السبب: ${escHtml(r.rejectionReason)}</small>` : ''}
                </div>`;
            } else if (r.adminReply) {
                adminHtml = `<div class="mt-2 p-2 rounded-2" style="background:#f0fdf4;border:1px solid #bbf7d0;">
                    <small class="fw-bold text-success d-block mb-1"><i class="bi bi-reply me-1"></i>رد المشرف:</small>
                    <small>${escHtml(r.adminReply)}</small>
                </div>`;
            }

            let borderColor = (r.status==='admin_approved'||r.status==='advance_approved') ? '#16a34a'
                            : (r.status==='admin_rejected'||r.status==='advance_rejected'||r.status==='supervisor_rejected') ? '#dc2626'
                            : r.status==='supervisor_approved' ? '#0284c7' : '#4361ee';

            return `<div class="req-card ${isAdv?'advance-type':''}" style="border-right-color:${borderColor};">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="fw-bold small">${r.type}</span>
                    <span class="dsb ${scls}">${slabel}</span>
                </div>
                <p class="mb-1 text-muted small">${r.message||'—'}</p>
                ${extraInfo}
                <small class="text-muted opacity-70">${r.createdAt||''}</small>
                ${adminHtml}
            </div>`;
        }).join('');
    }).catch(()=>{if(el)el.innerHTML='<div class="text-center text-danger py-2">حدث خطأ</div>';});
}

/* ── Salary ── */
function loadMySalary() {
    if (!_currentDriverId) return;
    let el = document.getElementById('salaryList'); if (!el) return;
    el.innerHTML='<div class="text-center text-muted py-3"><div class="spinner-border spinner-border-sm me-2"></div>جاري التحميل...</div>';
    db.ref('ninja_data/salary_records/'+_currentDriverId).once('value').then(snap=>{
        let records = snap.val() ? Object.values(snap.val()).filter(r=>r).sort((a,b)=>(b.ts||0)-(a.ts||0)) : [];
        let totalEl = document.getElementById('salaryTotal');
        let total = records.filter(r=>r.type!=='خصم'&&r.type!=='سلفة').reduce((s,r)=>s+Number(r.netAmount||r.amount||0),0);
        if (totalEl) totalEl.textContent = total.toLocaleString('ar-SA') + ' ريال';
        if (!records.length) {
            el.innerHTML='<div class="text-center text-muted py-4"><i class="bi bi-cash-stack fs-2 d-block mb-2 opacity-25"></i>لا يوجد سجل رواتب بعد<br><small>تواصل مع مشرفك لمعرفة مستحقاتك</small></div>'; return;
        }
        const typeColors={ راتب:'#16a34a', سلفة:'#f59e0b', خصم:'#dc2626', مكافأة:'#4361ee', أخرى:'#64748b' };
        el.innerHTML = records.map(r=>{
            let amt   = Number(r.netAmount||r.amount||0);
            let color = typeColors[r.type]||'#64748b';
            let isNeg = r.type==='خصم'||r.type==='سلفة';
            return `<div class="sal-card" style="border-right-color:${color};">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="fw-bold mb-1">${r.month||r.date||'—'}</div>
                        <span class="sal-badge" style="background:${color}22;color:${color};">${r.type||'راتب'}</span>
                        ${r.orders?`<small class="text-muted ms-2">${r.orders} طلب</small>`:''}
                        ${r.notes?`<div class="small text-muted mt-1">${escHtml(r.notes)}</div>`:''}
                    </div>
                    <div class="sal-amount ${isNeg?'neg':''}">${isNeg?'−':'+'}${Math.abs(amt).toLocaleString()} ﷼</div>
                </div>
            </div>`;
        }).join('');
    }).catch(()=>{if(el)el.innerHTML='<div class="text-center text-danger py-3">حدث خطأ في التحميل</div>';});
}

/* ── Announcements ── */
function loadAnnouncements(acc) {
    db.ref('ninja_data/portal_announcements').orderByChild('ts').limitToLast(10).once('value').then(snap=>{
        if (!snap.val()) return;
        let anns = Object.values(snap.val()).filter(a=>a&&a.active!==false);
        let relevant = anns.filter(a=>!a.target||a.target==='all'||a.target===(acc.platform||'ninja')||String(a.target)===String(acc.id)).sort((a,b)=>b.ts-a.ts);
        if (!relevant.length) return;
        let latest = relevant[0];
        const S={ info:'background:#dbeafe;color:#1d4ed8;border-bottom:2px solid #93c5fd;', warning:'background:#fef3c7;color:#92400e;border-bottom:2px solid #fcd34d;', success:'background:#dcfce7;color:#14532d;border-bottom:2px solid #86efac;', danger:'background:#fee2e2;color:#7f1d1d;border-bottom:2px solid #fca5a5;' };
        let banner = document.getElementById('announceBanner');
        if (banner) {
            banner.style.cssText=(S[latest.type]||S.info)+'display:block;padding:.65rem 1rem;font-weight:700;font-size:.9rem;';
            banner.innerHTML=`<i class="bi bi-megaphone-fill me-2"></i>${escHtml(latest.message)} <button onclick="this.closest('#announceBanner').style.display='none'" class="btn-close btn-close-sm float-start mt-1" style="font-size:.6rem;"></button>`;
        }
    });
}

/* ── Dark Mode ── */
function toggleDarkMode() {
    let isDark = document.body.classList.toggle('driver-dark');
    localStorage.setItem('sp_dark', isDark?'1':'0');
    updateDarkBtn();
    if (_perfChart && _currentAcc) renderPerfChart(_currentAcc);
}
function updateDarkBtn() {
    let btn = document.getElementById('darkModeBtn');
    if (btn) btn.innerHTML = document.body.classList.contains('driver-dark') ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars"></i>';
}

/* ── Share & Print ── */
function shareMyData() {
    if (!_currentAcc) return;
    let acc = _currentAcc;
    let text = `📊 بيانات المندوب — SpeedPro\n👤 ${acc.actualUserName||acc.ownerName}\n🚀 طلبات اليوم: ${acc.dailyOrders||0}\n📈 التراكمي: ${acc.totalOrders||0}\n⏱️ ساعات العمل: ${acc.hours||0}\n💰 المحفظة: ${acc.wallet||0} ريال\n📅 ${new Date().toLocaleDateString('ar-SA')}`;
    if (navigator.share) navigator.share({title:'بياناتي — SpeedPro',text}).catch(()=>{});
    else navigator.clipboard.writeText(text).then(()=>showToast('✅ تم نسخ البيانات للحافظة'));
}

function printMyData() {
    if (!_currentAcc) return;
    let acc = _currentAcc;
    let rows = [
        ['الاسم', acc.actualUserName||acc.ownerName||'—'],
        ['المنصة', PLATFORM_NAMES[acc.platform]||acc.platform||'—'],
        ['رقم الموظف', acc.employeeNumber||'—'],
        ['طلبات اليوم', acc.dailyOrders||0],
        ['التراكمي الكلي', acc.totalOrders||0],
        ['ساعات العمل', acc.hours||0],
        ['رصيد المحفظة', (acc.wallet||0) + ' ريال']
    ].map(([k,v])=>`<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('');
    let html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>بياناتي</title>'
        + '<style>body{font-family:Arial,sans-serif;padding:20px;direction:rtl;}'
        + 'table{width:100%;border-collapse:collapse;}'
        + 'td{padding:8px 10px;border:1px solid #e2e8f0;}'
        + 'tr:nth-child(even){background:#f8fafc;}'
        + '.hdr{text-align:center;margin-bottom:20px;}'
        + '.logo{font-size:22px;font-weight:900;color:#4361ee;}'
        + '.dt{color:#888;font-size:13px;}'
        + '</style></head><body>'
        + '<div class="hdr"><div class="logo">SpeedPro — بوابة المندوب</div>'
        + '<div class="dt">' + new Date().toLocaleDateString('ar-SA',{year:'numeric',month:'long',day:'numeric'}) + '</div></div>'
        + '<table>' + rows + '</table>'
        + '<p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px;">وثيقة إلكترونية من نظام SpeedPro</p>'
        + '</body></html>';
    let w = window.open('','_blank','width=700,height=600');
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(()=>{ try { w.print(); } catch(e){} }, 300);
}

/* ── Toast ── */
function showToast(msg, type='success') {
    let t = document.createElement('div');
    let bg = type==='danger'?'#dc2626':type==='warning'?'#f59e0b':'#16a34a';
    t.style.cssText='position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:'+bg+';color:#fff;padding:.6rem 1.5rem;border-radius:12px;font-weight:700;z-index:9999;font-size:.9rem;box-shadow:0 8px 24px rgba(0,0,0,.2);white-space:nowrap;';
    t.textContent=msg; document.body.appendChild(t);
    setTimeout(()=>t.remove(), 3000);
}

/* ── Logout ── */
function logoutDriver() {
    if (_currentDriverId) db.ref('ninja_data/portal_activity').push({ driverId:_currentDriverId, driverName:_currentDriverName, platform:_currentDriverPlatform, ts:Date.now(), type:'logout' });
    localStorage.removeItem('sp_portal_phone'); localStorage.removeItem('sp_portal_iqama');
    _currentAcc=null; _currentDriverId=null;
    if (_perfChart) { _perfChart.destroy(); _perfChart=null; }
    document.getElementById('announceBanner').style.display='none';
    document.getElementById('loginView').style.display='';
    document.getElementById('driverDashboard').style.display='none';
    document.body.classList.remove('portal-ready');
    document.getElementById('inputPhone').value='';
    document.getElementById('inputIqama').value='';
    let wm=document.getElementById('welcomeMsg'); if(wm) wm.style.display='none';
}

/* ── Auto-login ── */
(function tryAutoLogin() {
    if (localStorage.getItem('sp_dark')==='1') document.body.classList.add('driver-dark');
    let savedPhone=localStorage.getItem('sp_portal_phone'), savedIqama=localStorage.getItem('sp_portal_iqama');
    if (!savedPhone||!savedIqama) return;
    let phoneNorm = normPhone(savedPhone);
    ensureAuth().then(() => db.ref('ninja_data/accounts').once('value')).then(snap=>{
        let found=null;
        snap.forEach(c=>{ let acc=c.val(); if(!acc)return; if(normPhone(acc.phone)===phoneNorm&&(acc.ownerIqama===savedIqama||acc.actualIqama===savedIqama||String(acc.id)===savedIqama)) found=acc; });
        if (!found||found.portalAccess!==true) { localStorage.removeItem('sp_portal_phone'); localStorage.removeItem('sp_portal_iqama'); return; }
        db.ref('ninja_data/portal_settings').once('value').then(ss=>{ let s=ss.val()||{}; if(s.emergencyLock===true){localStorage.removeItem('sp_portal_phone');localStorage.removeItem('sp_portal_iqama');return;} showDashboard(found,s); });
    }).catch(()=>{});
})();

document.addEventListener('keydown', e=>{ if(e.key==='Enter'&&document.getElementById('loginView').style.display!=='none') loginDriver(); });
