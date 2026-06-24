// ==========================================
// إعدادات أساسية و Firebase
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyA17lFPoegXWF7BJKLq3vQVtyU-CI0reqs",
    databaseURL: "https://ninja-system-30301-default-rtdb.firebaseio.com",
    projectId: "ninja-system-30301",
    storageBucket: "ninja-system-30301.appspot.com"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storage = firebase.storage();
const auth = firebase.auth();

// [SECURITY] Make every database connection carry a Firebase token (anonymous),
// so we can lock the database rules to authenticated access only. This keeps the
// existing username/password login exactly as-is.
function ensureAuth() {
    if (auth.currentUser) return Promise.resolve(auth.currentUser);
    return auth.signInAnonymously()
        .then(c => c.user)
        .catch(e => { console.warn('Anonymous auth failed:', e); return null; });
}
const authReady = ensureAuth();
window.ensureAuth = ensureAuth;

// [SECURITY] Password hashing (SHA-256 + per-user salt). Stored as "sha256$<hex>".
// Passwords are never stored in plaintext (DB or browser) once migrated.
async function hashPassword(user, pass) {
    const enc = new TextEncoder().encode('speedpro$' + String(user || '').toLowerCase() + '$' + String(pass || ''));
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return 'sha256$' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
// One-time upgrade of any remaining plaintext passwords to hashes (runs after super-admin login).
async function _migratePasswordsToHash() {
    try {
        for (const u in adminUsers) {
            const r = adminUsers[u];
            if (r && typeof r.password === 'string' && r.password && r.password.indexOf('sha256$') !== 0) {
                const h = await hashPassword(u, r.password);
                await database.ref('ninja_data/admins/' + u + '/password').set(h);
                r.password = h;
            }
        }
    } catch (e) { console.warn('password migration failed', e); }
}

// [SECURITY] Central list of permission-gated sections (default-deny for supervisors).
// Add any NEW section here and it is automatically hidden unless the role grants it.
const SECTION_PERMS = { home:'home', finance:'finance', cars:'cars', hr:'hr', housing:'housing', portal:'portal', reports:'reports' };
const _tabElId = name => 'tab' + name.charAt(0).toUpperCase() + name.slice(1);

// أنواع وثائق المناديب
const DOC_TYPES = [
    { key: 'iqama',         label: 'صورة الإقامة',        icon: 'card-text',         color: '#4361ee' },
    { key: 'light_license', label: 'رخصة نقل خفيف',       icon: 'truck',             color: '#0891b2' },
    { key: 'moto_license',  label: 'رخصة دراجة آلية',     icon: 'bicycle',           color: '#16a34a' },
    { key: 'driver_card',   label: 'كرت السائق',           icon: 'person-badge-fill', color: '#7c3aed' },
    { key: 'health_cert',   label: 'الشهادة الصحية',       icon: 'heart-pulse-fill',  color: '#dc2626' },
    { key: 'contract',      label: 'عقد التشاركي',         icon: 'file-earmark-text-fill', color: '#d97706' }
];

// [SECURITY] Removed the auto-created field-supervisor account that used a fixed
// password (mutlaq / 123456). Auto-seeding a known password is a backdoor: anyone
// who knows it could log in. Create supervisor accounts manually from the Admin
// Center with a strong password instead.

window.allRawAccounts = []; window.viewingSupervisor = "ALL_SUPERVISORS"; window.allLogsArray = []; window.allAuditLogs = []; window.allDailyRecords = {};
window.allHrData = {}; window.allCars = []; window.allDriverDocs = {}; window.allFuelChips = {}; window.allAccidents = {}; window.allCarMaintenance = {}; window.allHandovers = {}; window.pendingHandoverPhotos = [];
window.carsActiveFilter = 'all'; window.carsSearchVal = ''; window.carsTypeFilter = 'all';
window.allTransactions = {}; window.allFinanceInvoices = {}; window.allFinanceArchive = {};
window.allReportRequests = {};
// ── SweetAlert2 global overrides ──────────────────────────────────────────
window.alert = function(msg) {
    let s = (typeof translateUserMessage === 'function') ? translateUserMessage(String(msg)) : String(msg);
    let icon = 'info';
    if (s.includes('❌') || s.includes('خطأ') || s.includes('Error') || s.includes('غير صحيح') || s.includes('غير مصرح') || s.includes('حدث خطأ')) icon = 'error';
    else if (s.includes('✅') || s.includes('🎉') || s.includes('بنجاح') || s.includes('تم ') || s.includes('نجاح') || s.includes('successfully') || s.includes('Success')) icon = 'success';
    else if (s.includes('⚠️') || s.includes('تحذير') || s.includes('انتبه') || s.includes('🔒')) icon = 'warning';
    Swal.fire({
        html: s,
        icon,
        confirmButtonColor: '#4361ee',
        confirmButtonText: (typeof L === 'function') ? L('حسناً', 'OK') : 'حسناً',
        customClass: { popup: 'rounded-4' },
        timer: icon === 'success' ? 2500 : undefined,
        timerProgressBar: icon === 'success',
    });
};

function _checkExpiryNotifications(cars) {
    if (!cars || !cars.length) return;
    let today = new Date(); today.setHours(0,0,0,0);
    let notified = JSON.parse(sessionStorage.getItem('_expNotified') || '{}');
    cars.forEach(c => {
        ['regExpiry','insExpiry','inspExpiry','authEnd'].forEach(field => {
            if (!c[field]) return;
            let exp = new Date(c[field]); exp.setHours(0,0,0,0);
            let days = Math.round((exp - today) / 86400000);
            let key = c.id + '_' + field;
            if (days <= 7 && days >= 0 && !notified[key]) {
                let labels = { regExpiry:'الاستمارة', insExpiry:'التأمين', inspExpiry:'الفحص الدوري', authEnd:'التفويض' };
                triggerPushNotification(
                    `⚠️ وثيقة قاربت على الانتهاء`,
                    `${c.plate || c.id} — ${labels[field]} ينتهي خلال ${days} يوم`,
                    { tag: key, sticky: true }
                );
                notified[key] = true;
            }
        });
    });
    sessionStorage.setItem('_expNotified', JSON.stringify(notified));
}
function _requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') Notification.requestPermission();
}
function triggerPushNotification(title, body, opts) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    opts = opts || {};
    try {
        new Notification(title, {
            body: body,
            icon: opts.icon || 'images/logo.png',
            badge: opts.icon || 'images/logo.png',
            tag: opts.tag || Date.now().toString(),
            requireInteraction: !!opts.sticky,
        });
    } catch(e) {}
}
function swalConfirm(msg, opts) {
    opts = opts || {};
    return Swal.fire({
        html: String(msg),
        icon: opts.icon || 'warning',
        showCancelButton: true,
        confirmButtonColor: opts.confirmColor || '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: opts.confirmText || 'نعم، تأكيد',
        cancelButtonText: opts.cancelText || 'إلغاء',
        customClass: { popup: 'rounded-4' },
    }).then(function(r) { return r.isConfirmed; });
}
// ─────────────────────────────────────────────────────────────────────────────
window.loggedInUser = ""; let adminUsers = {};
let currentPlatformTab = 'orders'; 
let filters = { ninja: 'all', keeta: 'all', hunger: 'all', jahez: 'all', chefz: 'all' };
let contractFilters = { ninja: 'all', keeta: 'all', hunger: 'all' };
let vehicleFilters  = { ninja: 'all', keeta: 'all', hunger: 'all' };

let sectionPasswords = { ninja: '', keeta: '', hunger: '', jahez: '', chefz: '' };
let unlockedSections = new Set();
let currentArchiveData = null;

// ==========================================
// نظام التراجع (Undo System) - حتى 10 مستويات
// ==========================================
window.undoStack = [];
let _undoCountdown = null;
const MAX_UNDO = 10;

function pushUndoState(description, restoreUpdates) {
    if (!restoreUpdates || Object.keys(restoreUpdates).length === 0) return;
    window.undoStack.push({ description, restoreUpdates });
    if (window.undoStack.length > MAX_UNDO) window.undoStack.shift();
    _showUndoToast(description);
}

// حذف آمن: ينقل البيانات إلى _trash قبل الحذف ويتيح التراجع
function trashAndDelete(section, id, originalPath, label) {
    return database.ref(originalPath).once('value').then(snap => {
        let data = snap.val();
        if (!data) return;
        let safeId = String(id).replace(/[.#$\/\[\]]/g, '_');
        let trashKey = Date.now() + '_' + safeId;
        let trashPath = 'ninja_data/_trash/' + section + '/' + trashKey;
        let trashData = Object.assign({}, data, {
            _deletedAt: new Date().toLocaleString('ar-EG'),
            _deletedBy: window.loggedInUser || 'admin',
            _originalPath: originalPath,
            _label: label || String(id)
        });
        let updates = {};
        updates[trashPath] = trashData;
        updates[originalPath] = null;
        pushUndoState(L('حذف: ' + (label || id), 'Delete: ' + (label || id)), { [originalPath]: data, [trashPath]: null });
        return database.ref().update(updates).then(() => {
            logAudit('حذف ' + section, String(id), label || String(id));
        });
    });
}

function _showUndoToast(description) {
    const toast = document.getElementById('undoToast');
    if (!toast) return;
    document.getElementById('undoActionText').innerText = (typeof translateUserMessage === 'function') ? translateUserMessage(description) : description;
    document.getElementById('undoStackCount').innerText = window.undoStack.length;
    toast.style.display = 'block';
    if (_undoCountdown) clearInterval(_undoCountdown);
    let t = 12;
    _undoCountdown = setInterval(() => {
        t--;
        if (t <= 0) { clearInterval(_undoCountdown); toast.style.display = 'none'; }
    }, 1000);
}

function dismissUndoToast() {
    const toast = document.getElementById('undoToast');
    if (toast) toast.style.display = 'none';
    if (_undoCountdown) clearInterval(_undoCountdown);
}

async function undoLastAction() {
    if (window.undoStack.length === 0) return alert('لا يوجد إجراء يمكن التراجع عنه حالياً.');
    const last = window.undoStack.pop();
    dismissUndoToast();
    try {
        await database.ref().update(last.restoreUpdates);
        logAudit('تراجع', 'Undo', `تم التراجع عن: ${last.description}`);
        Swal.fire({ icon: 'success', title: L('↩ تم التراجع', '↩ Undone'), text: last.description, timer: 2500, showConfirmButton: false });
        if (window.undoStack.length > 0) _showUndoToast(window.undoStack[window.undoStack.length - 1].description);
    } catch(err) {
        console.error('Undo error:', err);
        alert('حدث خطأ أثناء التراجع ❌');
    }
}

// ==========================================
// 1. نظام الحماية البنكية للجلسات (Auto Timeout)
// ==========================================
let idleTime = 0;
let idlePaused = false;
function resetIdleTimer() { idleTime = 0; }
document.addEventListener('mousemove', resetIdleTimer);
document.addEventListener('keypress', resetIdleTimer);
document.addEventListener('click', resetIdleTimer);
document.addEventListener('scroll', resetIdleTimer);
document.addEventListener('touchstart', resetIdleTimer);
document.addEventListener('touchend', resetIdleTimer);
// لما الصفحة تتخبى (كاميرا / تطبيق ثاني) وقف العداد وبعد ما ترجع ابدأ من الصفر
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { idlePaused = true; }
    else { idlePaused = false; idleTime = 0; }
});

setInterval(() => {
    if(window.loggedInUser && !idlePaused) {
        idleTime++;
        if (idleTime >= 15) {
            logout();
            alert("تم إقفال الجلسة آلياً لعدم النشاط (15 دقيقة) لحماية البيانات 🔒. يرجى تسجيل الدخول مجدداً.");
        }
    }
}, 60000); 

function formatLocalDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function updateMonthBadges() {
    let loc = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en-GB' : 'ar-EG';
    let txt = new Date().toLocaleString(loc, { month: 'long', year: 'numeric' });
    document.querySelectorAll('.currentMonthBadge').forEach(el => el.innerText = txt);
}
function getTodayStr() { return formatLocalDate(new Date()); }

let autoSendIntervalId = null;

function loadAutoSendSettings() {
    const storedEnabled = localStorage.getItem('autoSendEnabled');
    const enabled = storedEnabled === null ? true : localStorage.getItem('autoSendEnabled') === 'true';
    const time = localStorage.getItem('autoSendTime') || '12:00';
    if (document.getElementById('autoSendEnabled')) document.getElementById('autoSendEnabled').checked = enabled;
    if (document.getElementById('autoSendTime')) document.getElementById('autoSendTime').value = time;
    if (storedEnabled === null) {
        localStorage.setItem('autoSendEnabled', true);
        localStorage.setItem('autoSendTime', time);
    }
    if (enabled) scheduleAutoSend();
}

function saveAutoSendSettings() {
    const enabled = !!document.getElementById('autoSendEnabled')?.checked;
    const time = document.getElementById('autoSendTime')?.value || '12:00';
    localStorage.setItem('autoSendEnabled', enabled);
    localStorage.setItem('autoSendTime', time);
    alert(`تم حفظ ضبط الإرسال التلقائي ${enabled ? 'ليعمل عند ' + time : 'وتم إيقافه'}.`);
    if (enabled) scheduleAutoSend(); else cancelAutoSend();
}

function scheduleAutoSend() {
    cancelAutoSend();
    const enabled = localStorage.getItem('autoSendEnabled') === 'true';
    const time = localStorage.getItem('autoSendTime') || '12:00';
    if (!enabled) return;
    autoSendIntervalId = setInterval(() => checkAutoSend(time), 30000);
    checkAutoSend(time);
}

function cancelAutoSend() {
    if (autoSendIntervalId) {
        clearInterval(autoSendIntervalId);
        autoSendIntervalId = null;
    }
}

let autoSendConfirmationOpen = false;

function getDeferredUntil() {
    const value = localStorage.getItem('autoSendDeferredUntil');
    return value ? Number(value) : null;
}

function setDeferredUntil(timestamp) {
    if (timestamp === null) {
        localStorage.removeItem('autoSendDeferredUntil');
        return;
    }
    localStorage.setItem('autoSendDeferredUntil', String(timestamp));
}

function checkAutoSend(targetTime) {
    if (!window.loggedInUser) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const today = formatLocalDate(now);
    const lastSent = localStorage.getItem('autoSendLastDate');
    if (lastSent === today) return;

    const deferredUntil = getDeferredUntil();
    if (deferredUntil && now.getTime() < deferredUntil) return;
    if (deferredUntil && now.getTime() >= deferredUntil) {
        promptAutoSendConfirmation(now);
        return;
    }

    if (hhmm !== targetTime) return;
    promptAutoSendConfirmation(now);
}

function promptAutoSendConfirmation(now) {
    if (autoSendConfirmationOpen) return;
    autoSendConfirmationOpen = true;
    const today = formatLocalDate(now);
    Swal.fire({
        title: L('تأكيد إرسال تلقائي', 'Auto-Send Confirmation'),
        html: L(`الآن الساعة ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}. هل تريد إرسال إنذارات المقصرين الآن؟`,
                 `It's ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}. Do you want to send underperformer alerts now?`),
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: L('📤 أرسل الآن', '📤 Send Now'),
        denyButtonText: L('⏱ انتظار 30 دقيقة', '⏱ Wait 30 Minutes'),
        cancelButtonText: L('✖ إلغاء', '✖ Cancel'),
        confirmButtonColor: '#4f46e5',
        denyButtonColor: '#f59e0b',
        cancelButtonColor: '#6b7280',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didClose: () => { autoSendConfirmationOpen = false; }
    }).then(async result => {
        autoSendConfirmationOpen = false;
        if (result.isConfirmed) {
            setDeferredUntil(null);
            const success = await sendBulkWhatsAppToDefaulters(true);
            if (success) {
                localStorage.setItem('autoSendLastDate', today);
            }
        } else if (result.isDenied) {
            const deferTime = now.getTime() + 30 * 60 * 1000;
            setDeferredUntil(deferTime);
            Swal.fire({
                icon: 'info',
                title: L('تم التأجيل', 'Snoozed'),
                text: L('سيتم عرض التأكيد مرة أخرى بعد 30 دقيقة.', 'Confirmation will appear again in 30 minutes.'),
                timer: 3000,
                showConfirmButton: false
            });
        }
    });
}

window.onload = function() {
    let annBar = document.getElementById('adminAnnBarAddon');
    if(annBar) annBar.style.display = 'none';

    updateMonthBadges();
    let isDark = localStorage.getItem('dark_mode') === 'true'; 
    if(isDark) { document.body.classList.add('dark-mode'); if(document.getElementById('themeToggle')) document.getElementById('themeToggle').checked = true; }
    
    // فحص الجلسات المحفوظة
    const savedUser = sessionStorage.getItem('ninja_user') || localStorage.getItem('ninja_user');
    const savedHash = sessionStorage.getItem('ninja_phash') || localStorage.getItem('ninja_phash');
    const savedPass = sessionStorage.getItem('ninja_pass') || localStorage.getItem('ninja_pass'); // legacy

    if(savedUser && (savedHash || savedPass)) {
        document.getElementById('username').value = savedUser;
        if (savedPass) document.getElementById('password').value = savedPass; // legacy only; hash users read from storage
        // لا نظهر شاشة الدخول أبداً، وندخل النظام مباشرة صامتاً
        checkLogin(true);
    } else {
        // هنا السر: نظهر شاشة الدخول فقط إذا لم تكن هناك بيانات مسجلة
        document.getElementById('loginPage').style.display = 'flex';
    }
    loadAutoSendSettings();
};

// ==========================================
// سجل التدقيق الأمني (Advanced Audit Trail)
// ==========================================
function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function logAudit(action, targetId, details) {
    let entry = {
        timestamp: new Date().toLocaleString('en-GB'),
        admin: window.loggedInUser || 'System',
        action: action,
        targetId: targetId,
        details: details
    };
    database.ref('ninja_data/audit_logs').push(entry);
}

function exportAuditTrail() {
    if(!hasPerm('view_logs')) return alert('غير مصرح لك ❌ — تواصل مع الأدمن لمنح صلاحية عرض السجل');
    database.ref('ninja_data/audit_logs').once('value').then(snap => {
        let data = snap.val(); if(!data) return alert('لا يوجد سجلات أمنية بعد.');
        let arr = Object.values(data).reverse();
        const ws = XLSX.utils.json_to_sheet(arr); const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Security_Logs");
        XLSX.writeFile(wb, `SECURITY_AUDIT_${getTodayStr()}.xlsx`);
    });
}

function checkLogin(isAutoLogin = false) {
    const user = document.getElementById('username').value.trim().toLowerCase();
    const pass = document.getElementById('password').value.trim();

    // [SECURITY] ensure the anonymous Firebase token is ready before any DB read
    ensureAuth().then(() => database.ref('ninja_data/admins').once('value')).then(async snap => {
        adminUsers = snap.val() || {}; // [SECURITY] removed hardcoded default admin/123 fallback
        const rec = adminUsers[user];

        // [SECURITY] resolve the entered credential as a hash (supports auto-login by stored hash)
        let enteredHash = null, legacyPlain = null;
        if (isAutoLogin) {
            const sh = sessionStorage.getItem('ninja_phash') || localStorage.getItem('ninja_phash');
            const lp = sessionStorage.getItem('ninja_pass')  || localStorage.getItem('ninja_pass');
            if (sh) { enteredHash = sh; }
            else if (lp) { legacyPlain = lp; enteredHash = await hashPassword(user, lp); }
            else { document.getElementById('loginPage').style.display = 'flex'; return; }
        } else {
            legacyPlain = pass;
            enteredHash = await hashPassword(user, pass);
        }

        // [SECURITY] verify against the hashed password (or a legacy plaintext record)
        let _ok = false, _needUpgrade = false;
        if (rec && typeof rec.password === 'string') {
            if (rec.password.indexOf('sha256$') === 0) { _ok = (rec.password === enteredHash); }
            else if (legacyPlain != null) { _ok = (rec.password === legacyPlain); if (_ok) _needUpgrade = true; }
        }

        if (_ok) {
            if (_needUpgrade) { database.ref('ninja_data/admins/' + user + '/password').set(enteredHash); rec.password = enteredHash; }

            // [SECURITY] store the password HASH only — never the plaintext
            if (!isAutoLogin) {
                if(document.getElementById('rememberMe').checked) {
                    localStorage.setItem('ninja_user', user);
                    localStorage.setItem('ninja_phash', enteredHash);
                } else {
                    localStorage.removeItem('ninja_user');
                    localStorage.removeItem('ninja_phash');
                }
                localStorage.removeItem('ninja_pass');
            }
            sessionStorage.setItem('ninja_user', user);
            sessionStorage.setItem('ninja_phash', enteredHash);
            sessionStorage.removeItem('ninja_pass');

            window.loggedInUser = user;
            unlockedSections.clear();
            database.ref('ninja_data/admins/' + user + '/lastLogin').set(Date.now());
            setupPresence(user); // تفعيل نظام حالة الاتصال
            
            // استرجاع الصفحة التي كان عليها قبل الريفريش
            let savedTab = sessionStorage.getItem('currentPlatformTab');
            let mainTab = savedTab || 'home';

            let _loginRole = adminUsers[user].role;
            if (_loginRole === 'super_admin' || _loginRole === 'admin') {
                document.querySelectorAll('.btnManageAdmins, .btnSettings, .supervisorSelector, .btnAdminBulk').forEach(el => el.style.display = 'inline-block');
                if (_loginRole === 'super_admin' || (_loginRole === 'admin' && hasPerm('manage_admins'))) populateSupervisorDropdown();
                unlockedSections.add('orders'); unlockedSections.add('keeta'); unlockedSections.add('hunger'); unlockedSections.add('jahez'); unlockedSections.add('chefz'); unlockedSections.add('finance');
            } else {
                document.querySelectorAll('.btnManageAdmins, .btnSettings, .supervisorSelector, .btnAdminBulk').forEach(el => el.style.display = 'none');
                window.viewingSupervisor = user;
                
                let plats = adminUsers[user].platforms || [adminUsers[user].platform] || ['ninja'];
                
                plats.forEach(p => {
                    let tabName = p === 'ninja' ? 'orders' : p;
                    unlockedSections.add(tabName);
                });

                // لو لا توجد صفحة محفوظة أو المحفوظة هي الرئيسية وليس لديه صلاحية، افتح أول قسم متاح
                let _canHome = adminUsers[user] && adminUsers[user].permissions && adminUsers[user].permissions.home;
                let _perms   = (adminUsers[user] && adminUsers[user].permissions) || {};
                if (!savedTab || (savedTab === 'home' && !_canHome)) {
                    if (plats.length > 0) {
                        mainTab = plats[0] === 'ninja' ? 'orders' : plats[0];
                    } else if (_perms.cars) {
                        mainTab = 'cars';
                    } else if (_perms.housing) {
                        mainTab = 'housing';
                    } else if (_perms.hr) {
                        mainTab = 'hr';
                    } else if (_perms.finance) {
                        mainTab = 'finance';
                    }
                }
            }
            
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('mainNav').style.display = 'flex';
            document.body.classList.add('sp-logged-in'); // [UI] reveal AI assistant only after login
            if (typeof initChat  === 'function') initChat();   // [MODULES] start realtime chat badge
            if (typeof initNotif === 'function') initNotif();  // [MODULES] start notification bell (admins)

            // تطبيق اللغة المفضلة للمستخدم (افتراضياً عند الدخول — يظل بإمكانه التبديل يدوياً)
            let _userLang = adminUsers[user].lang || 'ar';
            if (typeof setLanguage === 'function' && _userLang !== currentLang) setLanguage(_userLang);

            loadData();
            switchTab(mainTab);
            applyLocksUI();
            if(!isAutoLogin) logAudit('تسجيل دخول', 'System', 'تم دخول النظام بنجاح');
            _requestNotificationPermission();
            if (_loginRole === 'super_admin') _migratePasswordsToHash(); // [SECURITY] hash any legacy plaintext passwords

        } else {
            alert("بيانات الدخول غير صحيحة ❌");
            document.getElementById('loginPage').style.display = 'flex'; // إعادة إظهار اللوجين عند الخطأ
        }
    }).catch(err => {
        // [SECURITY] never hang on login: surface DB/auth errors clearly
        console.error('Login error:', err);
        document.getElementById('loginPage').style.display = 'flex';
        let btn = document.getElementById('loginSubmitBtn'); if (btn) btn.disabled = false;
        alert('❌ تعذّر الاتصال بقاعدة البيانات. حدّث الصفحة بالكامل (Ctrl+Shift+R) وحاول تاني.');
    });
}

// ==========================================
// نظام الصلاحيات المركزي
// ==========================================
function hasPerm(key) {
    let u = adminUsers[window.loggedInUser];
    if (!u) return false;
    if (u.role === 'super_admin' || u.role === 'admin') return true;
    let p = u.permissions || {};
    return !!p[key];
}

function isAdminOrSuper() {
    let u = adminUsers[window.loggedInUser];
    return u && (u.role === 'super_admin' || u.role === 'admin');
}

function applyLocksUI() {
    let currentUser = adminUsers[window.loggedInUser];
    if(!currentUser) return;

    let isSuper = currentUser.role === 'super_admin';
    let plats = currentUser.platforms || [currentUser.platform] || ['ninja'];
    const show = (id, visible) => { let el = document.getElementById(id); if(el) el.style.display = visible ? '' : 'none'; };

    // --- تبويبات المنصات (داخل القائمة المنسدلة) ---
    let anyPlatformVisible = false;
    ['orders','keeta','hunger','jahez','chefz'].forEach(tab => {
        let platKey = tab === 'orders' ? 'ninja' : tab;
        let capTab  = tab.charAt(0).toUpperCase() + tab.slice(1);
        let btn = document.getElementById('tab' + capTab);
        let li  = document.getElementById('li_tab' + capTab);
        if (!btn) return;
        let visible = isSuper || plats.includes(platKey);
        btn.style.display = visible ? '' : 'none';
        if (li) li.style.display = visible ? '' : 'none';
        if (visible) anyPlatformVisible = true;
        let lockIcon = btn.querySelector('.lock-icon');
        if (lockIcon) lockIcon.style.display = 'none';
        btn.classList.remove('locked-tab');
    });
    // إخفاء زر المنصات كلياً إذا لم تكن هناك منصات مرئية
    let pdWrap = document.getElementById('platformsDropdownWrap');
    if (pdWrap) pdWrap.style.display = anyPlatformVisible ? '' : 'none';

    // --- تحديث معلومات المستخدم في شريط التنقل ---
    let navName   = document.getElementById('navUserName');
    let navAvatar = document.getElementById('navUserAvatar');
    let displayName = currentUser.name || window.loggedInUser || '—';
    if (navName)   navName.textContent   = displayName;
    if (navAvatar) navAvatar.textContent = displayName.charAt(0).toUpperCase();

    // [SECURITY] default-deny: every section tab is hidden unless the role grants its permission
    Object.keys(SECTION_PERMS).forEach(name => show(_tabElId(name), isSuper || hasPerm(SECTION_PERMS[name])));
    // --- صلاحيات قسم المالية (إضافة / حذف) ---
    let canFinAdd = isSuper || hasPerm('finance_add');
    let canFinDel = isSuper || hasPerm('finance_delete');
    let btnAddTxn = document.getElementById('btnAddTransaction');
    let btnSaveArch = document.getElementById('btnSaveArchive');
    if (btnAddTxn) btnAddTxn.style.display = canFinAdd ? '' : 'none';
    if (btnSaveArch) btnSaveArch.style.display = canFinAdd ? '' : 'none';

    // --- أزرار الشريط الجانبي ---
    let btnArchive = document.querySelector('[onclick="openArchiveModal()"]');
    if(btnArchive) btnArchive.style.display = window.loggedInUser ? '' : 'none';
    let btnFuel = document.querySelector('[onclick="openFuelModal()"]');
    if(btnFuel) btnFuel.style.display = isSuper || hasPerm('fuel') ? '' : 'none';
    let btnTrash = document.querySelector('[onclick="openTrashModal()"]');
    if(btnTrash) btnTrash.style.display = isSuper || hasPerm('trash') ? '' : 'none';
    let btnImportFuel = document.querySelector('[onclick="document.getElementById(\'fuelImport\').click()"]');
    if(btnImportFuel) btnImportFuel.style.display = isSuper || hasPerm('fuel') ? '' : 'none';
    let btnBackup = document.querySelector('[onclick="saveDirectToDrive()"]');
    if(btnBackup) btnBackup.style.display = isSuper || hasPerm('export') ? '' : 'none';
    let btnReset = document.querySelector('[onclick="openResetModal()"]');
    if(btnReset) btnReset.style.display = isSuper || hasPerm('reset') ? '' : 'none';
    document.querySelectorAll('[onclick^="sendAllDefaulters"]').forEach(b => b.style.display = isSuper || hasPerm('send_alerts') ? '' : 'none');
    // زر "إرسال للجميع" داخل نافذة المقصرين
    let btnBulkWa = document.getElementById('btnBulkWhatsappModal');
    if(btnBulkWa) btnBulkWa.style.display = isSuper || hasPerm('send_alerts') ? '' : 'none';
    // --- صلاحيات جديدة ---
    // إدارة المشرفين
    document.querySelectorAll('.btnManageAdmins, .btnSettings').forEach(b => b.style.display = isSuper || hasPerm('manage_admins') ? '' : 'none');
    // رفع تقرير الأداء
    // الوصول: للجميع داخل النافذة (00:00-11:59) أو لمن لديه import_perf أو super/admin
    let _perfHour = new Date().getHours();
    let _withinWindow = _perfHour < 12; // نافذة الرفع: 12 بليل → 12 ظهر
    let btnImportPerf = document.querySelector('[onclick="triggerPerfImport()"]');
    if(btnImportPerf) btnImportPerf.style.display = (isSuper || _withinWindow || hasPerm('import_perf')) ? '' : 'none';
    // تقرير يومي متأخر: يظهر بعد إغلاق النافذة للجميع، أو في أي وقت للسوبر/من لديه صلاحية
    let btnLateRep = document.getElementById('btnLateReport');
    if(btnLateRep) btnLateRep.style.display = (isSuper || hasPerm('import_perf') || !_withinWindow) ? '' : 'none';
    // استيراد المناديب — متاح دائماً لكل المشرفين بدون صلاحيات
    let btnImportDrivers = document.querySelector('[onclick="document.getElementById(\'driverImport\').click()"]');
    if(btnImportDrivers) btnImportDrivers.style.display = '';
    // سجل النشاط / التدقيق
    let btnAudit = document.querySelector('[onclick="exportAuditTrail()"]');
    if(btnAudit) btnAudit.style.display = isSuper || hasPerm('view_logs') ? '' : 'none';
    // تحديث حالة زر الرفع (عداد + كشف مزدوج)
    updatePerfButtonUI();
}

function loadData() {
    // [SECURITY] load UltraMsg credentials from the locked DB (not from source code)
    database.ref('ninja_data/settings/ultramsg').on('value', snap => {
        let c = snap.val() || {};
        ULTRAMSG_INSTANCE = c.instance || '';
        ULTRAMSG_TOKEN = c.token || '';
        let iEl = document.getElementById('ultraInstance'); if (iEl) iEl.value = ULTRAMSG_INSTANCE;
        let tEl = document.getElementById('ultraToken');    if (tEl) tEl.value = ULTRAMSG_TOKEN;
    });
    database.ref('ninja_data/settings/passwords').on('value', snap => { sectionPasswords = snap.val() || { ninja: '', keeta: '', hunger: '', jahez: '', chefz: '' }; document.getElementById('passNinja').value = sectionPasswords.ninja || ''; document.getElementById('passKeeta').value = sectionPasswords.keeta || ''; document.getElementById('passHunger').value = sectionPasswords.hunger || ''; document.getElementById('passJahez').value = sectionPasswords.jahez || ''; if(document.getElementById('passChefz')) document.getElementById('passChefz').value = sectionPasswords.chefz || ''; });
    database.ref('ninja_data/logs').on('value', snap => { const v = snap.val(); window.allLogsArray = v ? Object.entries(v).map(([k,val]) => (Object.assign({ __key: k }, val))) : []; });
    database.ref('ninja_data/audit_logs').orderByKey().limitToLast(100).on('value', snap => { const v = snap.val(); window.allAuditLogs = v ? Object.entries(v).map(([k,val]) => Object.assign({ __key: k }, val)) : []; if (currentPlatformTab === 'home') renderHomeActivity(); });
    // بيانات الأقسام الجديدة: السيارات، الموظفين، حالة الاتصال
    database.ref('ninja_data/cars').on('value', snap => { window.allCars = snap.val() ? Object.values(snap.val()).filter(c => c) : []; if(currentPlatformTab === 'cars') renderCarsTable(); if(currentPlatformTab === 'home') renderHome(); _checkExpiryNotifications(window.allCars); });
    database.ref('ninja_data/fuel_chips').on('value', snap => { window.allFuelChips = snap.val() || {}; if(currentPlatformTab === 'cars') { renderFuelChipsKpis(); renderFuelChipsTable(); } });
    database.ref('ninja_data/accidents').on('value', snap => { window.allAccidents = snap.val() || {}; if(currentPlatformTab === 'cars') { renderAccidentsKpis(); renderAccidentsTable(); } if(currentPlatformTab === 'home') renderHomeAlerts(); });
    database.ref('ninja_data/car_maintenance').on('value', snap => { window.allCarMaintenance = snap.val() || {}; if(currentPlatformTab === 'cars') { renderCarMaintenanceKpis(); renderCarMaintenanceTable(); } if(currentPlatformTab === 'home') renderHomeAlerts(); });
    database.ref('ninja_data/car_handovers').on('value', snap => { window.allHandovers = snap.val() || {}; if(currentPlatformTab === 'cars') { renderHandoverKpis(); renderHandoverTable(); } });
    database.ref('ninja_data/car_rentals').on('value', snap => { window.allCarRentals = snap.val() || {}; if(currentPlatformTab === 'cars') { renderRentalKpis(); renderRentalsTable(); } if(currentPlatformTab === 'home') renderHomeAlerts(); });
    database.ref('ninja_data/advances').on('value', snap => { window.allAdvances = snap.val() || {}; if(currentPlatformTab === 'finance' && typeof renderAdvances === 'function') renderAdvances(); });
    _loadHousingData();
    database.ref('ninja_data/hr_data').on('value', snap => { window.allHrData = snap.val() || {}; if(currentPlatformTab === 'hr') renderHrTable(); if(currentPlatformTab === 'home') renderHome(); });
    database.ref('ninja_data/presence').on('value', snap => { window.presenceData = snap.val() || {}; if(currentPlatformTab === 'home') renderSupervisorsStatus(); });
    database.ref('ninja_data/daily_records').on('value', snap => { window.allDailyRecords = snap.val() || {}; if(currentPlatformTab === 'home') renderHome(); });
    loadDriverDocs();
    loadFinanceData();
    database.ref('ninja_data/portal_activity').orderByChild('ts').limitToLast(200).on('value', snap => {
        window.allPortalActivity = snap.val() ? Object.values(snap.val()).filter(e => e) : [];
        if (currentPlatformTab === 'portal') renderPortalSection();
    });
    database.ref('ninja_data/portal_settings').on('value', snap => {
        window.portalSettings = snap.val() || { emergencyLock: false, welcomeMessage: '', showFields: {} };
        let badge = document.getElementById('portalEmergencyBadge');
        if (badge) badge.style.setProperty('display', window.portalSettings.emergencyLock ? 'inline-block' : 'none', 'important');
    });
    database.ref('ninja_data/portal_requests').orderByChild('ts').limitToLast(200).on('value', snap => {
        window.allPortalRequests = snap.val() ? Object.values(snap.val()).filter(r => r) : [];
        let pending = window.allPortalRequests.filter(r => r.status === 'pending').length;
        let badge = document.getElementById('reqBadgeCount');
        if (badge) { badge.textContent = pending > 0 ? pending : ''; badge.classList.toggle('d-none', pending === 0); }
        let tabBtn = document.getElementById('portalTabBtn_requests');
        if (tabBtn) tabBtn.dataset.badge = pending > 0 ? pending : '';
        if (currentPlatformTab === 'portal' && portalSubTab === 'requests') renderPortalRequests();
    });
    database.ref('ninja_data/accounts').on('value', snap => { 
        let accs = snap.val() ? Object.values(snap.val()).filter(a => a) : [];
        // إضافة حساب اختبار إذا كانت البيانات فارغة
        if (accs.length === 0) {
            accs.push({
                id: 'TEST_WARN_001',
                ownerName: 'اختبار إنذار',
                actualUserName: 'مندوب مقصر',
                phone: '0501234567',
                status: 'قيد الاستخدام',
                platform: 'ninja',
                totalOrders: 10,
                hours: 5,
                dailyOrders: 2,
                rejectedOrders: 0,
                employeeNumber: 'TEST',
                fuelCost: 0,
                notes: 'حساب اختبار - يجب أن يظهر زر الإنذار',
                supervisor: 'admin',
                dispatchDate: getTodayStr()
            });
        }
            window.allRawAccounts = accs.map(acc => {
                acc.vehicleType = acc.vehicleType || 'سيارة';
                acc.kmTotal = acc.kmTotal || 0;
                acc.ignoreDaily = acc.ignoreDaily || 0;
                acc.ignoreMonthly = acc.ignoreMonthly || 0;
                acc.rejectedDaily = acc.rejectedDaily || acc.rejectedOrders || 0;
                acc.rejectedTotal = acc.rejectedTotal || acc.rejectedOrders || 0;
                acc.rejectedOrders = acc.rejectedOrders || acc.rejectedTotal || 0; // keep backward compatibility
                return acc;
            });
        applyDataView();
        if(currentPlatformTab === 'home' && typeof renderHome === 'function') renderHome();
    });
    if(adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin') { renderAdminsTable(); }

    // نظام تحكم رفع التقارير
    let _isSupAdmin = isAdminOrSuper() || hasPerm('report_approve');
    let _today = getTodayStr();
    if (_isSupAdmin) {
        database.ref(`ninja_data/report_requests/${_today}`).on('value', snap => {
            window.allReportRequests = snap.val() || {};
            updateReportRequestBadge();
            if (currentPlatformTab === 'home') renderHomeAlerts();
        });
    } else {
        database.ref(`ninja_data/report_requests/${_today}/${window.loggedInUser}`).on('value', snap => {
            let req = snap.val();
            if (!req) return;
            if (req.status === 'approved' && !window._reportApprovalNotified) {
                window._reportApprovalNotified = true;
                if (req.type === 'reimport') {
                    // موافقة إعادة رفع
                    Swal.fire({
                        icon: 'success', title: L('✅ تمت الموافقة على إعادة الرفع', '✅ Re-upload Approved'),
                        html: L(`<p>وافق الأدمن على إعادة رفع تقرير <b>${platformDisplayName(req.platform||currentPlatformTab)}</b>.<br><b style="color:#16a34a;">يمكنك الآن رفع الملف الجديد.</b></p>`,
                                 `<p>Admin approved re-upload for <b>${platformDisplayName(req.platform||currentPlatformTab)}</b>.<br><b style="color:#16a34a;">You can now upload the new file.</b></p>`),
                        confirmButtonText: L('📤 رفع التقرير الآن', '📤 Upload now'), showCancelButton: true, cancelButtonText: L('لاحقاً', 'Later')
                    }).then(r => { if (r.isConfirmed) { document.getElementById('perfImport').click(); } });
                } else {
                    // موافقة تقرير متأخر عادي
                    Swal.fire({
                        icon: 'success', title: L('✅ تمت الموافقة على طلبك', '✅ Your request was approved'),
                        html: L(`<p>وافق المشرف العام على رفع التقرير المتأخر.<br><b style="color:#ef4444;">لديك 30 دقيقة لرفع الملف قبل انتهاء المهلة.</b></p>`, `<p>The super admin approved your late report upload.<br><b style="color:#ef4444;">You have 30 minutes to upload the file before the window expires.</b></p>`),
                        confirmButtonText: L('📤 رفع التقرير الآن', '📤 Upload report now'), showCancelButton: true, cancelButtonText: L('لاحقاً', 'Later')
                    }).then(r => { if (r.isConfirmed) document.getElementById('perfImport').click(); });
                }
            } else if (req.status === 'rejected' && !window._reportRejectionNotified) {
                window._reportRejectionNotified = true;
                Swal.fire({ icon: 'error', title: L('❌ تم رفض الطلب', '❌ Request rejected'), text: req.adminNote ? L(`ملاحظة المشرف: ${req.adminNote}`, `Admin note: ${req.adminNote}`) : L('تم رفض طلب رفع التقرير المتأخر.', 'Your late report upload request was rejected.'), confirmButtonText: L('حسناً', 'OK') });
            }
        });
    }
    // بدء مراقبة الوقت لإشعارات التذكير
    startReportReminderWatcher();
}

function requestTabSwitch(tab) {
    // [SECURITY] default-deny for every permission-gated section (home/finance/cars/hr/housing/portal/reports)
    if (SECTION_PERMS[tab]) {
        if (!hasPerm(SECTION_PERMS[tab])) {
            if (tab !== 'home') alert('❌ ليس لديك صلاحية الدخول لهذا القسم. تواصل مع الأدمن.');
            return;
        }
        switchTab(tab); return;
    }
    if(adminUsers[window.loggedInUser].role === 'super_admin' || unlockedSections.has(tab)) { switchTab(tab); return; }
    let platformKey = tab === 'orders' ? 'ninja' : tab; let expectedPass = sectionPasswords[platformKey];
    if (!expectedPass || expectedPass.trim() === "") return alert("🔒 هذا القسم مغلق ولم تقم الإدارة بتعيين كلمة مرور له بعد.");
    let pass = prompt("هذا القسم محمي بقفل 🔒. برجاء إدخال كلمة المرور:");
    if (pass !== null && pass === expectedPass) { unlockedSections.add(tab); applyLocksUI(); switchTab(tab); alert("تم فتح القسم بنجاح 🎉"); logAudit('فتح قسم مغلق', tab, 'تم إدخال الباسوورد وفتح القسم'); } 
    else if (pass !== null) { alert("كلمة المرور غير صحيحة ❌"); }
}

function switchTab(tab) {
    currentPlatformTab = tab === 'orders' ? 'ninja' : tab;
    sessionStorage.setItem('currentPlatformTab', tab); // حفظ اسم الصفحة في الذاكرة المؤقتة

    const setDisp = (id, show) => { let el = document.getElementById(id); if(el) el.style.display = show ? 'block' : 'none'; };
    setDisp('homeSection', tab === 'home');
    setDisp('ordersSection', tab === 'orders');
    setDisp('keetaSection', tab === 'keeta');
    setDisp('hungerSection', tab === 'hunger');
    setDisp('jahezSection', tab === 'jahez');
    setDisp('chefzSection', tab === 'chefz');
    setDisp('financeSection', tab === 'finance');
    setDisp('carsSection', tab === 'cars');
    setDisp('hrSection', tab === 'hr');
    setDisp('housingSection', tab === 'housing');
    setDisp('portalSection',  tab === 'portal');
    setDisp('reportsSection', tab === 'reports');

    const setActive = (id, on) => { let el = document.getElementById(id); if(el) el.classList.toggle('active', on); };
    setActive('tabHome', tab === 'home');
    setActive('tabOrders', tab === 'orders');
    setActive('tabKeeta', tab === 'keeta');
    setActive('tabHunger', tab === 'hunger');
    setActive('tabJahez', tab === 'jahez');
    setActive('tabChefz', tab === 'chefz');
    setActive('tabFinance', tab === 'finance');
    setActive('tabCars', tab === 'cars');
    setActive('tabHr', tab === 'hr');
    setActive('tabHousing', tab === 'housing');
    setActive('tabPortal',  tab === 'portal');
    setActive('tabReports', tab === 'reports');

    // Sync platforms dropdown button label + active state
    const platformTabs = ['orders','keeta','hunger','jahez','chefz'];
    const platformShortNames = {
        orders: L('نينجا 🥷', 'Ninja 🥷'),
        keeta:  L('كيتا 🚴',  'Keeta 🚴'),
        hunger: L('هنقر 📦',  'Hunger 📦'),
        jahez:  L('جاهز 🛍️', 'Jahez 🛍️'),
        chefz:  L('شفز 🍔',  'Chefz 🍔')
    };
    let pdBtn   = document.getElementById('platformsNavBtn');
    let pdLabel = document.getElementById('platformsNavLabel');
    let isOnPlatform = platformTabs.includes(tab);
    if (pdBtn)   pdBtn.classList.toggle('active', isOnPlatform);
    if (pdLabel) pdLabel.textContent = isOnPlatform ? platformShortNames[tab] : L('المنصات', 'Platforms');

    // تشغيل عرض الأقسام الجديدة عند فتحها
    if(['ninja','orders','keeta','hunger','jahez','chefz'].includes(tab)) { checkReportReminder(); updatePerfButtonUI(); }
    else hideReportReminder();
    if(tab === 'home' && typeof renderHome === 'function') renderHome();
    if(tab === 'cars') { if(typeof switchCarTab === 'function') switchCarTab('fleet'); else if(typeof renderCarsTable === 'function') renderCarsTable(); }
    if(tab === 'hr' && typeof renderHrTable === 'function') { renderHrTable(); updateHrExportCounts(); }
    if(tab === 'finance' && typeof switchFinanceTab === 'function') switchFinanceTab('invoices');
    if(tab === 'housing' && typeof switchHousingTab === 'function') switchHousingTab('units');
    if(tab === 'portal')  { renderPortalSection(); switchPortalTab('access'); }
    if(tab === 'reports') { switchReportTab('docs'); }

    clearBulk();
}

function populateSupervisorDropdown() {
    const selects = document.querySelectorAll('.supervisorSelector');
    let html = `<option value="ALL_SUPERVISORS">${(typeof t === 'function') ? t('all_supervisors') : '🌐 كل المشرفين'}</option><option value="${window.loggedInUser}">👁️ عرض حساباتي</option>`;
    for (let u in adminUsers) { if (u !== window.loggedInUser) html += `<option value="${u}">👤 ${adminUsers[u].name}</option>`; }
    selects.forEach(sel => sel.innerHTML = html);
}
function changeSupervisorView(val) { window.viewingSupervisor = val; document.querySelectorAll('.supervisorSelector').forEach(s => s.value = val); applyDataView(); }

// ==========================================
// 2. الترتيب الديناميكي والفلاتر
// ==========================================
let currentSort = { col: 'dailyOrders', dir: 'desc' };
function sortTable(col) {
    if(currentSort.col === col) { currentSort.dir = currentSort.dir === 'desc' ? 'asc' : 'desc'; } 
    else { currentSort.col = col; currentSort.dir = 'desc'; }
    applyDataView();
}

function setFilter(status, btn, platform) {
    filters[platform] = status;
    // Support both old button-group style and new select style
    if (btn && btn.tagName !== 'SELECT') {
        let btnGroup = btn.parentElement;
        btnGroup.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    applyDataView();
}

function setContractFilter(val, platform) {
    contractFilters[platform] = val;
    applyDataView();
}

function setVehicleFilter(val, platform) {
    vehicleFilters[platform] = val;
    applyDataView();
}

function filterAccounts(platform) {
    let inputId = platform === 'ninja' ? 'searchInputNinja' : (platform === 'keeta' ? 'searchInputKeeta' : (platform === 'hunger' ? 'searchInputHunger' : (platform === 'jahez' ? 'searchInputJahez' : 'searchInputChefz')));
    let searchEl = document.getElementById(inputId);
    if (!searchEl) return;
    let val = searchEl.value.toLowerCase();
    let tbodyId = platform === 'ninja' ? 'ninjaTableBody' : (platform === 'keeta' ? 'keetaTableBody' : (platform === 'hunger' ? 'hungerTableBody' : (platform === 'jahez' ? 'jahezTableBody' : 'chefzTableBody')));
    let tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(row => {
        let haystack = (row.innerText + ' ' + (row.dataset.search || '')).toLowerCase();
        row.style.display = haystack.includes(val) ? '' : 'none';
    });
}

function getVisibleAccounts(accounts) {
    if (window.viewingSupervisor === "ALL_SUPERVISORS") return accounts;
    const currentUser = adminUsers[window.viewingSupervisor] || adminUsers[window.loggedInUser];
    const allowedPlatforms = (currentUser && currentUser.platforms) ? currentUser.platforms : [(currentUser && currentUser.platform) || 'ninja'];
    return accounts.filter(acc => {
        let platform = (acc.platform || 'ninja');
        if (allowedPlatforms.includes(platform)) return true;
        return (acc.supervisor || 'admin') === window.viewingSupervisor;
    });
}

function applyDataView() {
    let accounts = getVisibleAccounts(window.allRawAccounts);
    
    accounts = accounts.filter(acc => {
        let isUsed = acc.status === 'قيد الاستخدام' || acc.status === 'مصروف';
        let p = acc.platform || 'ninja';
        if (filters[p] === 'متاح' && isUsed) return false;
        if (filters[p] === 'قيد الاستخدام' && !isUsed) return false;
        // Contract type filter (ninja, keeta, hunger)
        let cf = contractFilters[p] || 'all';
        if (cf !== 'all' && (acc.contractType || '') !== cf) return false;
        // Vehicle type filter (ninja, keeta, hunger)
        let vf = vehicleFilters[p] || 'all';
        if (vf !== 'all' && (acc.vehicleType || 'سيارة') !== vf) return false;
        return true;
    });

    accounts.sort((a, b) => {
        let valA = a[currentSort.col]; let valB = b[currentSort.col];
        let numA = Number(valA); let numB = Number(valB);
        if(!isNaN(numA) && !isNaN(numB)) { valA = numA; valB = numB; } 
        else { valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase(); }
        
        if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    refreshUI(accounts); generateAIInsights(accounts);
}

// ==========================================
// 3. الإجراءات الجماعية (Bulk Actions UI & Logic)
// ==========================================
function toggleAll(source) {
    document.querySelectorAll(`#${currentPlatformTab}TableBody .row-cb`).forEach(cb => cb.checked = source.checked);
    updateBulkActionUI();
}

function clearBulk() {
    document.querySelectorAll('.row-cb').forEach(cb => cb.checked = false);
    document.querySelectorAll('th input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateBulkActionUI();
}

function getSelectedIds() { return Array.from(document.querySelectorAll('.row-cb:checked')).map(cb => cb.value); }

function updateBulkActionUI() {
    let checked = getSelectedIds().length;
    let floatingBtn = document.getElementById('floatingBulkBtn');
    let isSuperAdmin = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin';

    if(checked > 0) {
        if(!floatingBtn) {
            floatingBtn = document.createElement('div');
            floatingBtn.id = 'floatingBulkBtn';
            floatingBtn.className = 'position-fixed bottom-0 start-50 translate-middle-x mb-4 z-3 animate-fade-up';
            document.body.appendChild(floatingBtn);
        }
        
        // زرار نقل العهدة هيظهر فقط لمدير النظام
        let transferBtnHTML = isSuperAdmin ? `<button class="btn btn-sm btn-info text-dark rounded-pill fw-bold px-3" onclick="openBulkTransferModal()"><i class="bi bi-people-fill"></i> ${t('bulk_transfer')}</button>` : '';
        let deleteBtnHTML = isSuperAdmin ? `<button class="btn btn-sm btn-danger rounded-pill fw-bold px-3" onclick="bulkDeleteSelected()"><i class="bi bi-trash"></i> ${t('bulk_delete')}</button>` : '';

        floatingBtn.innerHTML = `
            <div class="bg-dark rounded-pill shadow-lg p-2 d-flex align-items-center gap-2 border border-secondary" style="backdrop-filter: blur(10px); background: rgba(15, 23, 42, 0.9) !important;">
                <span class="badge bg-primary fs-6 ms-2 px-3 py-2 rounded-pill" id="bulkCount">${checked} ${t('bulk_selected')}</span>
                <button class="btn btn-sm btn-success rounded-pill fw-bold px-3" onclick="bulkWhatsApp()"><i class="bi bi-whatsapp"></i> ${t('bulk_copy')}</button>
                <button class="btn btn-sm btn-danger rounded-pill fw-bold px-3" onclick="bulkSuspend()"><i class="bi bi-pause-circle"></i> ${t('bulk_suspend')}</button>
                ${transferBtnHTML}
                ${deleteBtnHTML}
                <button class="btn btn-sm btn-light rounded-pill fw-bold px-3 text-dark" onclick="clearBulk()"><i class="bi bi-x-circle"></i> ${t('bulk_deselect')}</button>
            </div>
        `;
        floatingBtn.style.display = 'block';
    } else {
        if(floatingBtn) floatingBtn.style.display = 'none';
    }
}

async function bulkSuspend() {
    let ids = getSelectedIds();
    if (ids.length === 0) return;
    let _ok = await swalConfirm(`هل تريد إيقاف ${ids.length} حساب فوراً؟`, { confirmText: 'نعم، أوقف' }); if (!_ok) return;
    let updates = {}; let _undoSuspend = {};
    ids.forEach(id => {
        let acc = window.allRawAccounts.find(a => String(a.id) === String(id));
        if (acc) { _undoSuspend[`ninja_data/accounts/${id}/status`] = acc.status || 'متاح'; }
        updates[`ninja_data/accounts/${id}/status`] = 'موقوف';
    });
    pushUndoState(`إيقاف فوري (${ids.length} حساب)`, _undoSuspend);
    database.ref().update(updates).then(() => {
        logAudit('إيقاف جماعي', currentPlatformTab, `تم إيقاف ${ids.length} حساب`);
        alert(`تم إيقاف ${ids.length} حساب بنجاح ✅`);
        clearBulk();
    });
}

function bulkWhatsApp() {
    let ids = getSelectedIds();
    let accounts = window.allRawAccounts.filter(a => ids.includes(a.id));
    let phones = accounts.map(a => a.phone).filter(p => p && p !== '-' && p.length > 8).join('\n');
    if(!phones) return alert("لم يتم العثور على أرقام جوالات صالحة للحسابات المحددة ❌");
    navigator.clipboard.writeText(phones);
    alert(`تم نسخ أرقام (${ids.length}) مندوب بنجاح! يمكنك لصقها في أداة الإرسال الجماعي 🎉`);
    clearBulk();
}

function openBulkTransferModal() {
    // حماية إضافية: رفض التنفيذ لو اللي بيحاول يفتحها مش مدير نظام
    if (!adminUsers[window.loggedInUser] || adminUsers[window.loggedInUser].role !== 'super_admin') {
        return alert("❌ عذراً، خاصية نقل العهدة متاحة للإدارة فقط.");
    }

    let ids = getSelectedIds();
    if(ids.length === 0) return;

    // تجميع أسماء المشرفين للقائمة
    let supOptions = `<option value="">-- اختر المشرف --</option>`;
    for (let u in adminUsers) {
        if(u !== 'admin') {
            supOptions += `<option value="${u}">${escHtml(adminUsers[u].name)} (${u})</option>`;
        }
    }

    // خيارات المنصات
    let platOptions = `
        <option value="">-- اختر المنصة --</option>
        <option value="ninja">🥷 نينجا</option>
        <option value="keeta">🚴 كيتا</option>
        <option value="hunger">📦 هنقرستيشن</option>
        <option value="jahez">🛒 جاهز</option>
        <option value="chefz">👨‍🍳 ذا شفز</option>
    `;

    let isDark = document.body.classList.contains('dark-mode');
    
    // إظهار نافذة ذكية مخصصة (Custom HTML) لاختيار المشرف والمنصة معاً
    Swal.fire({
        title: L('نقل العهدة والمنصة 👑', 'Transfer Custody & Platform 👑'),
        html: L(`
            <p class="mb-3 text-muted fw-bold">سيتم نقل عهدة (${ids.length}) مندوب.</p>
            <div class="mb-3 text-start">
                <label class="fw-bold small mb-1 text-primary">1. المشرف المستلم:</label>
                <select id="swal-sup" class="form-select form-select-lg shadow-sm border-0 bg-light">${supOptions}</select>
            </div>
            <div class="mb-3 text-start">
                <label class="fw-bold small mb-1 text-danger">2. المنصة التشغيلية:</label>
                <select id="swal-plat" class="form-select form-select-lg shadow-sm border-0 bg-light">${platOptions}</select>
            </div>
        `, `
            <p class="mb-3 text-muted fw-bold">Transferring (${ids.length}) rider(s).</p>
            <div class="mb-3 text-start">
                <label class="fw-bold small mb-1 text-primary">1. Receiving Supervisor:</label>
                <select id="swal-sup" class="form-select form-select-lg shadow-sm border-0 bg-light">${supOptions}</select>
            </div>
            <div class="mb-3 text-start">
                <label class="fw-bold small mb-1 text-danger">2. Platform:</label>
                <select id="swal-plat" class="form-select form-select-lg shadow-sm border-0 bg-light">${platOptions}</select>
            </div>
        `),
        showCancelButton: true,
        confirmButtonText: L('تنفيذ النقل ✅', 'Transfer ✅'),
        cancelButtonText: L('إلغاء', 'Cancel'),
        background: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f8fafc' : '#334155',
        preConfirm: () => {
            // التحقق من اختيار المشرف والمنصة قبل الإرسال
            const sup = document.getElementById('swal-sup').value;
            const plat = document.getElementById('swal-plat').value;
            if (!sup || !plat) {
                Swal.showValidationMessage('يجب اختيار المشرف والمنصة معاً لإتمام النقل ❌');
                return false;
            }
            return { supervisor: sup, platform: plat };
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            bulkTransfer(ids, result.value.supervisor, result.value.platform);
        }
    });
}

function bulkTransfer(ids, targetSupervisor, targetPlatform) {
    let updates = {}; let _undoTransfer = {};
    ids.forEach(id => {
        let acc = window.allRawAccounts.find(a => String(a.id) === String(id));
        if (acc) { _undoTransfer[`ninja_data/accounts/${id}/supervisor`] = acc.supervisor || null; _undoTransfer[`ninja_data/accounts/${id}/platform`] = acc.platform || 'ninja'; }
        updates[`ninja_data/accounts/${id}/supervisor`] = targetSupervisor;
        updates[`ninja_data/accounts/${id}/platform`] = targetPlatform;
        logAudit('نقل عهدة ومنصة جماعي', id, `نقل إلى: ${targetSupervisor} - منصة: ${targetPlatform}`);
    });
    pushUndoState(`نقل عهدة (${ids.length} حساب) إلى ${targetSupervisor} - ${targetPlatform}`, _undoTransfer);
    database.ref().update(updates).then(() => {
        alert(`تم نقل (${ids.length}) حساب للمشرف الجديد على منصة (${targetPlatform}) بنجاح! 🎉`);
        clearBulk();
    });
}

async function bulkDeleteSelected() {
    if (!adminUsers[window.loggedInUser] || adminUsers[window.loggedInUser].role !== 'super_admin') {
        return alert("❌ عذراً، خاصية حذف الكل متاحة فقط لمدير النظام.");
    }
    let ids = getSelectedIds();
    if (ids.length === 0) return alert("الرجاء اختيار حساب واحد على الأقل لحذفها.");
    let _ok = await swalConfirm(`هل أنت متأكد من حذف ${ids.length} حساباً ونقله إلى سلة المحذوفات؟`, { confirmText: 'نعم، احذف' }); if (!_ok) return;

    let updates = {};
    ids.forEach(id => {
        let acc = window.allRawAccounts.find(a => String(a.id) === String(id));
        if (acc) {
            updates[`ninja_data/deleted_accounts/${id}`] = { ...acc, deletedAt: new Date().toLocaleString('en-GB'), deletedBy: window.loggedInUser };
        }
        updates[`ninja_data/accounts/${id}`] = null;
        logAudit('حذف جماعي', id, 'تم حذف الحساب من قائمة المناديب المحددة');
    });

    let _undoBulkDel = {};
    ids.forEach(id => {
        let acc = window.allRawAccounts.find(a => String(a.id) === String(id));
        if (acc) { _undoBulkDel[`ninja_data/accounts/${id}`] = { ...acc }; _undoBulkDel[`ninja_data/deleted_accounts/${id}`] = null; }
    });
    pushUndoState(`حذف جماعي (${ids.length} حساب)`, _undoBulkDel);
    database.ref().update(updates).then(() => {
        alert(`تم حذف ${ids.length} حساب ونقلها إلى سلة المحذوفات بنجاح ✅`);
        clearBulk();
    }).catch(err => {
        console.warn('bulkDeleteSelected error', err);
        alert('حدث خطأ أثناء الحذف الجماعي، حاول مرة أخرى.');
    });
}
// ==========================================
// 4. بناء الجداول ورؤوسها برمجياً
// ==========================================
function refreshUI(accounts) {
    const headersHTML = {
        ninja: `<tr><th style="width:40px;"><input type="checkbox" class="form-check-input shadow-sm" onchange="toggleAll(this)"></th><th style="cursor:pointer;" onclick="sortTable('id')">${t('th_ninja_data')} ↕️</th><th style="cursor:pointer;" onclick="sortTable('status')">${t('th_ninja_status')} ↕️</th><th>${t('th_ninja_contact')}</th><th style="cursor:pointer;" class="text-primary" onclick="sortTable('dailyOrders')">${t('th_ninja_daily')} ↕️</th><th style="cursor:pointer;" onclick="sortTable('hours')">${t('th_ninja_hours')} ↕️</th><th style="cursor:pointer;" class="text-danger" onclick="sortTable('totalOrders')">${t('th_ninja_total')} ↕️</th><th>${t('th_ninja_notes')}</th><th>${t('th_ninja_ctrl')}</th></tr>`,
        keeta: `<tr><th style="width:40px;"><input type="checkbox" class="form-check-input shadow-sm" onchange="toggleAll(this)"></th><th style="cursor:pointer;" onclick="sortTable('id')">${t('th_data')} ↕️</th><th>${t('th_status_contact')}</th><th style="cursor:pointer;" onclick="sortTable('wallet')">${t('th_wallet')} ↕️</th><th>${t('th_orders')}</th><th style="cursor:pointer;" onclick="sortTable('cancelRate')">${t('th_cancel')} ↕️</th><th style="cursor:pointer;" onclick="sortTable('onTimeRate')">${t('th_ontime')} ↕️</th><th style="cursor:pointer;" onclick="sortTable('delayRate')">${t('th_delay')} ↕️</th><th>${t('th_ctrl')}</th></tr>`,
        hunger: `<tr><th style="width:40px;"><input type="checkbox" class="form-check-input shadow-sm" onchange="toggleAll(this)"></th><th style="cursor:pointer;" onclick="sortTable('id')">${t('th_data')} ↕️</th><th>${t('th_status_contact')}</th><th style="cursor:pointer;" onclick="sortTable('wallet')">${t('th_wallet')} ↕️</th><th>${t('th_orders')}</th><th>KM</th><th>${L('الساعات المخطط لها','Planned Hrs')}</th><th style="cursor:pointer;" onclick="sortTable('hours')">${L('الساعات الفعلية','Actual Hrs')} ↕️</th><th>${t('th_notes')}</th><th>${t('th_ctrl')}</th></tr>`,
        jahez: `<tr><th style="width:40px;"><input type="checkbox" class="form-check-input shadow-sm" onchange="toggleAll(this)"></th><th style="cursor:pointer;" onclick="sortTable('id')">${t('th_data')} ↕️</th><th>${t('th_status_contact')}</th><th style="cursor:pointer;" onclick="sortTable('wallet')">${t('th_wallet')} ↕️</th><th>${t('th_orders')}</th><th>${t('th_notes')}</th><th>${t('th_ctrl')}</th></tr>`,
        chefz: `<tr><th style="width:40px;"><input type="checkbox" class="form-check-input shadow-sm" onchange="toggleAll(this)"></th><th style="cursor:pointer;" onclick="sortTable('id')">${t('th_data')} ↕️</th><th>${t('th_status_contact')}</th><th style="cursor:pointer;" onclick="sortTable('wallet')">${t('th_wallet')} ↕️</th><th>${t('th_orders')}</th><th style="cursor:pointer;" onclick="sortTable('hours')">${t('th_hours_total')} ↕️</th><th>${t('th_notes')}</th><th>${t('th_ctrl')}</th></tr>`
    };

    // حماية الأكواد من الانهيار إذا لم يكن الجدول موجوداً
    let tH_ninja = document.querySelector('#ninjaTableBody') ? document.querySelector('#ninjaTableBody').previousElementSibling : null; if(tH_ninja) tH_ninja.innerHTML = headersHTML.ninja;
    let tH_keeta = document.querySelector('#keetaTableBody') ? document.querySelector('#keetaTableBody').previousElementSibling : null; if(tH_keeta) tH_keeta.innerHTML = headersHTML.keeta;
    let tH_hunger = document.querySelector('#hungerTableBody') ? document.querySelector('#hungerTableBody').previousElementSibling : null; if(tH_hunger) tH_hunger.innerHTML = headersHTML.hunger;
    let tH_jahez = document.querySelector('#jahezTableBody') ? document.querySelector('#jahezTableBody').previousElementSibling : null; if(tH_jahez) tH_jahez.innerHTML = headersHTML.jahez;
    let tH_chefz = document.querySelector('#chefzTableBody') ? document.querySelector('#chefzTableBody').previousElementSibling : null; if(tH_chefz) tH_chefz.innerHTML = headersHTML.chefz;

    let tbodyNinja = document.getElementById('ninjaTableBody'); let tbodyKeeta = document.getElementById('keetaTableBody'); let tbodyHunger = document.getElementById('hungerTableBody'); let tbodyJahez = document.getElementById('jahezTableBody'); let tbodyChefz = document.getElementById('chefzTableBody');
    let htmlNinja = '', htmlKeeta = '', htmlHunger = '', htmlJahez = '', htmlChefz = '';
    let stats = { ninja: { total:0, avail:0, used:0, orders:0, kafala:0, freelance:0 }, keeta: { total:0, avail:0, used:0, orders:0, kafala:0, freelance:0 }, hunger: { total:0, avail:0, used:0, orders:0, kafala:0, freelance:0 }, jahez: { total:0, avail:0, used:0, orders:0, kafala:0, freelance:0 }, chefz: { total:0, avail:0, used:0, orders:0, kafala:0, freelance:0 } };

    getVisibleAccounts(window.allRawAccounts).forEach(acc => {
        let p = acc.platform || 'ninja'; let isUsed = acc.status === 'قيد الاستخدام' || acc.status === 'مصروف';
        if(stats[p]){ stats[p].total++; if(acc.status === 'متاح') stats[p].avail++; if(isUsed) stats[p].used++; stats[p].orders += (Number(acc.totalOrders) || 0); if(acc.contractType === 'كفالة') stats[p].kafala++; if(acc.contractType === 'فري لانسر') stats[p].freelance++; }
    });

    accounts.forEach(acc => {
        let p = acc.platform || 'ninja'; let isUsed = acc.status === 'قيد الاستخدام' || acc.status === 'مصروف'; let isSuspended = acc.status === 'موقوف';
        let statusStr = isSuspended ? t('status_suspended') : (isUsed ? t('status_in_use') : t('status_available')); let statusClass = isSuspended ? 'bg-danger' : (isUsed ? 'bg-in-use' : 'bg-available');
        
        // عرض كلمة (غياب) بجوار الصفر بشكل نظيف
        let dOrders = String(acc.dailyOrders).includes("غياب") ? acc.dailyOrders : (Number(acc.dailyOrders) || 0);
        let totalOrders = Number(acc.totalOrders) || 0;
        let rejectedDaily = Number(acc.rejectedDaily) || 0;
        let rejectedTotal = Number(acc.rejectedTotal) || Number(acc.rejectedOrders) || 0;
        let rejected = rejectedTotal;
        let wallet = Number(acc.wallet) || 0;
        let walletStr = wallet < 0 ? `<b class="text-danger fs-5" dir="ltr">${wallet}</b>` : `<b class="text-success fs-5" dir="ltr">${wallet}</b>`;
        // wallet alert flag (either recorded or computed): show visual badge and avoid duplicate DB alerts
        // trigger if balance exceeds +150 or debt exceeds -150
        let walletAlertActive = !!acc.walletAlertSentAt || ((p === 'hunger') && ((wallet > 150) || (wallet < 0 && Math.abs(wallet) >= 150)));
        let walletDisplay = `${walletStr}${walletAlertActive ? ` <span class="badge bg-danger ms-1">${t('lbl_wallet_alert')}</span>` : ''}`;
        let wAppBtn = `<button onclick="sendWhatsAppMessage('${acc.phone}', ${parseInt(dOrders)||0})" class="btn btn-sm btn-success shadow-sm ms-2 whatsapp-action" title="${t('lbl_wa_title')} ${acc.phone}"><i class="bi bi-whatsapp"></i><span dir="ltr">${acc.phone}</span></button>`;
        let checkboxHTML = `<input type="checkbox" class="form-check-input row-cb shadow-sm" style="transform: scale(1.2);" value="${acc.id}" onchange="updateBulkActionUI()">`;
        let ratingBadge = ratingBadgeHTML(acc);
        let profileBtn = `<button onclick="openRiderProfile('${acc.id}')" class="btn btn-outline-info btn-sm" title="${L('ملف المندوب 360°','Rider 360° profile')}"><i class="bi bi-person-vcard"></i></button>`;
        let portalEnabled = acc.portalAccess === true;
        let portalBtn  = `<button onclick="togglePortalAccess('${acc.id}')" class="btn btn-sm ${portalEnabled ? 'btn-success' : 'btn-outline-secondary'}" title="${L(portalEnabled ? 'بوابة المندوب مفعّلة — اضغط للتعطيل' : 'تفعيل بوابة المندوب', portalEnabled ? 'Portal enabled — click to disable' : 'Enable driver portal')}"><i class="bi bi-${portalEnabled ? 'key-fill' : 'key'}"></i></button>`;
        let ctBadge = acc.contractType === 'كفالة'
            ? '<span class="badge ms-1" style="background:#0369a1;color:#fff;font-size:0.68em;vertical-align:middle;">🔗 كفالة</span>'
            : acc.contractType === 'فري لانسر'
            ? '<span class="badge ms-1" style="background:#7c3aed;color:#fff;font-size:0.68em;vertical-align:middle;">🆓 فري</span>'
            : '';
        let salaryBtn  = `<button onclick="openSalaryModal('${acc.id}','${(acc.actualUserName||acc.ownerName||'').replace(/'/g,'')}')" class="btn btn-sm btn-outline-success" title="${L('إدارة الراتب','Manage Salary')}"><i class="bi bi-cash-coin"></i></button>`;
        let warnBtn    = `<button onclick="openWarningsModal('${acc.id}','${(acc.actualUserName||acc.ownerName||'').replace(/'/g,'')}')" class="btn btn-sm btn-outline-warning" title="${L('الإنذارات','Warnings')}"><i class="bi bi-exclamation-triangle"></i></button>`;

        if (p === 'ninja') {
            let alertBtn = '';
            let accTotalOrders = Number(acc.totalOrders) || 0;
            // عرض الإنذار للمندوبين: أقل من 15 طلب
            if (accTotalOrders < 15 && acc.actualUserName && acc.actualUserName !== '-') {
                alertBtn = `<button onclick="warnDefaulter('${acc.id}', '${acc.actualUserName}')" class="btn btn-sm btn-danger shadow-sm fw-bold mb-1" title="${t('lbl_warn_title')}"><i class="bi bi-exclamation-triangle-fill"></i> ${t('lbl_alert_btn')}</button> `;
            }
            
            let ninjaExtra = accTotalOrders < 15 && acc.actualUserName && acc.actualUserName !== '-'
                ? `<li><button class="dropdown-item py-2 text-danger fw-bold" onclick="warnDefaulter('${acc.id}','${acc.actualUserName}')"><i class="bi bi-exclamation-triangle-fill me-2"></i>${t('lbl_alert_btn')}</button></li>`
                : '';
            htmlNinja += `<tr>
                <td class="align-middle">${checkboxHTML}</td>
                <td>${makeJahezProfileCell(acc, ratingBadge)}</td>
                <td><span class="status-badge ${statusClass}">${statusStr}</span></td>
                <td>${wAppBtn}<br><button onclick="viewHistory('${acc.id}')" class="btn btn-sm btn-primary shadow-sm mt-1 fw-bold history-action"><i class="bi bi-clock-history"></i> ${t('lbl_history')}</button></td>
                <td><b class="text-danger fs-4">${dOrders}</b></td>
                <td><b class="fs-4">${acc.hours || 0}</b></td>
                <td><b class="text-primary fs-4">${totalOrders}</b></td>
                <td><span class="note-text" title="${escHtml(acc.notes || '')}">${escHtml(acc.notes || '---')}</span></td>
                <td class="text-center">${makeActionDropdown(acc, ninjaExtra)}</td>
            </tr>`;
        }
        else if (p === 'keeta') {
            let cancel = Number(acc.cancelRate) || 0; let cancelHTML = cancel > 5 ? `<b class="text-white bg-danger px-2 py-1 rounded shadow-sm" dir="ltr">${cancel.toFixed(2)}% 🚨</b>` : `<b class="${cancel > 0 ? 'text-danger' : 'text-success'}" dir="ltr">${cancel.toFixed(2)}%</b>`;
            let onTime = Number(acc.onTimeRate) || 100; let onTimeHTML = onTime < 85 ? `<b class="text-white bg-danger px-2 py-1 rounded shadow-sm" dir="ltr">${onTime.toFixed(2)}% 🚨</b>` : `<b class="${onTime < 100 ? 'text-warning' : 'text-success'}" dir="ltr">${onTime.toFixed(2)}%</b>`;
            let delay = Number(acc.delayRate) || 0; let delayHTML = delay > 10 ? `<b class="text-white bg-danger px-2 py-1 rounded shadow-sm" dir="ltr">${delay.toFixed(2)}% 🚨</b>` : `<b class="${delay > 0 ? 'text-danger' : 'text-success'}" dir="ltr">${delay.toFixed(2)}%</b>`;

            htmlKeeta += `<tr data-search="${(acc.ownerName||'').replace(/"/g,'')+ ' ' +(acc.actualUserName||'').replace(/"/g,'')+' '+acc.id+' '+(acc.phone||'')+' '+(acc.employeeNumber||'')}">
                <td class="align-middle">${checkboxHTML}</td>
                <td>${makeJahezProfileCell(acc, ratingBadge)}</td>
                <td><span class="status-badge ${statusClass} mb-1">${statusStr}</span><br>${wAppBtn}<br><button onclick="viewHistory('${acc.id}')" class="btn btn-sm btn-primary mt-1 fw-bold history-action"><i class="bi bi-clock-history"></i> ${t('lbl_history')}</button></td>
                <td>${walletDisplay}</td>
                <td><span class="badge bg-success fs-6 mb-1 d-block">${dOrders} ${t('lbl_daily')}</span><span class="badge bg-primary fs-6 mb-1 d-block">${totalOrders} ${t('lbl_total')}</span><span class="badge bg-danger fs-6 d-block">${rejectedDaily} ${t('lbl_rejected_daily')}</span><span class="badge bg-danger fs-6 d-block">${rejectedTotal} ${t('lbl_rejected')}</span></td>
                <td>${cancelHTML}</td><td>${onTimeHTML}</td><td>${delayHTML}</td>
                <td class="text-center">${makeActionDropdown(acc)}</td>
            </tr>`;
        }
        else if (p === 'hunger') {
            // show km daily as badge and cumulative km in details
            let kmDaily = Number(acc.kmDaily || 0);
            let kmTotal = Number(acc.kmTotal || 0);
            let ignoreDaily = Number(acc.ignoreDaily || 0);
            let ignoreMonthly = Number(acc.ignoreMonthly || 0);

            let hungerExtra = `<li><button class="dropdown-item py-2" onclick="sendWalletWarning('${acc.id}')"><i class="bi bi-whatsapp me-2 text-success"></i>${t('lbl_alert_btn')}</button></li>`;
            htmlHunger += `<tr data-search="${(acc.ownerName||'').replace(/"/g,'')+ ' ' +(acc.actualUserName||'').replace(/"/g,'')+' '+acc.id+' '+(acc.phone||'')+' '+(acc.employeeNumber||'')}">
                <td class="align-middle">${checkboxHTML}</td>
                <td>${makeJahezProfileCell(acc, ratingBadge)}</td>
                <td><span class="status-badge ${statusClass} mb-1">${statusStr}</span><br>${wAppBtn}<br><button onclick="viewHistory('${acc.id}')" class="btn btn-sm btn-primary mt-1 fw-bold history-action"><i class="bi bi-clock-history"></i> ${t('lbl_history')}</button></td>
                <td>${walletDisplay}</td>
                <td><span class="badge bg-success fs-6 mb-1 d-block">${dOrders} ${t('lbl_daily')}</span><span class="badge bg-primary fs-6 mb-1 d-block">${totalOrders} ${t('lbl_total')}</span><span class="badge bg-danger fs-6 d-block">${rejected} ${t('lbl_rejected')}</span></td>
                <td><span class="badge bg-info fs-6 mb-1 d-block">${kmDaily} ${t('lbl_km_daily')}</span><span class="badge bg-secondary fs-6 mb-1 d-block">${kmTotal} ${t('lbl_km_total')}</span><span class="badge bg-secondary fs-6 d-block">${t('lbl_ignore_daily')} ${ignoreDaily}</span><span class="badge bg-secondary fs-6 d-block">${t('lbl_ignore_monthly')} ${ignoreMonthly}</span></td>
                <td><b class="fs-4 text-secondary">${acc.plannedHours || 0}</b></td>
                <td><b class="fs-4 text-primary">${acc.hours || 0}</b></td>
                <td><span class="note-text" title="${escHtml(acc.notes || '')}">${escHtml(acc.notes || '---')}</span></td>
                <td class="text-center">${makeActionDropdown(acc, hungerExtra)}</td>
            </tr>`;
        }
        else if (p === 'jahez') {
            htmlJahez += `<tr data-search="${(acc.ownerName||'').replace(/"/g,'')+ ' ' +(acc.actualUserName||'').replace(/"/g,'')+' '+acc.id+' '+(acc.phone||'')+' '+(acc.employeeNumber||'')}">
                <td class="align-middle">${checkboxHTML}</td>
                <td>${makeJahezProfileCell(acc, ratingBadge)}</td>
                <td><span class="status-badge ${statusClass} mb-1">${statusStr}</span><br>${wAppBtn}<br><button onclick="viewHistory('${acc.id}')" class="btn btn-sm btn-danger mt-1 fw-bold history-action"><i class="bi bi-clock-history"></i> ${t('lbl_history')}</button></td>
                <td><div class="jz-wallet-cell">${walletDisplay}
                    <div class="jz-saned">
                        <div class="jz-saned-row sp-in" title="${L('المندوب دفع لساند','Driver Paid Saned')}"><span>${L('دفع لساند','Driver→Saned')}</span><b dir="ltr">${Number(acc.driverPaidSaned||0).toLocaleString()}</b></div>
                        <div class="jz-saned-row sp-out" title="${L('ساند دفع للمندوب','Saned Paid Driver')}"><span>${L('ساند دفع','Saned→Driver')}</span><b dir="ltr">${Number(acc.sanedPaidDriver||0).toLocaleString()}</b></div>
                    </div>
                </div></td>
                <td><span class="badge bg-success fs-6 mb-1 d-block">${dOrders} ${t('lbl_daily')}</span><span class="badge bg-primary fs-6 mb-1 d-block">${totalOrders} ${t('lbl_total')}</span><span class="badge bg-danger fs-6 d-block">${rejected} ${t('lbl_rejected')}</span></td>
                <td><span class="note-text" title="${escHtml(acc.notes || '')}">${escHtml(acc.notes || '---')}</span></td>
                <td class="text-center">${makeActionDropdown(acc)}</td>
            </tr>`;
        }
        else if (p === 'chefz') {
            htmlChefz += `<tr data-search="${(acc.ownerName||'').replace(/"/g,'')+ ' ' +(acc.actualUserName||'').replace(/"/g,'')+' '+acc.id+' '+(acc.phone||'')+' '+(acc.employeeNumber||'')}">
                <td class="align-middle">${checkboxHTML}</td>
                <td>${makeJahezProfileCell(acc, ratingBadge)}</td>
                <td><span class="status-badge ${statusClass} mb-1">${statusStr}</span><br>${wAppBtn}<br><button onclick="viewHistory('${acc.id}')" class="btn btn-sm btn-primary mt-1 fw-bold history-action"><i class="bi bi-clock-history"></i> ${t('lbl_history')}</button></td>
                <td>${walletDisplay}</td>
                <td><span class="badge bg-success fs-6 mb-1 d-block">${dOrders} ${t('lbl_daily')}</span><span class="badge bg-primary fs-6 mb-1 d-block">${totalOrders} ${t('lbl_total')}</span><span class="badge bg-danger fs-6 d-block">${rejected} ${t('lbl_rejected')}</span></td>
                <td><b class="fs-4" style="color:#6366f1;">${acc.hours || 0}</b></td>
                <td><span class="note-text" title="${escHtml(acc.notes || '')}">${escHtml(acc.notes || '---')}</span></td>
                <td class="text-center">${makeActionDropdown(acc)}</td>
            </tr>`;
        }
    });

    // حماية الحقن
    if(tbodyNinja) tbodyNinja.innerHTML = htmlNinja;
    if(tbodyKeeta) tbodyKeeta.innerHTML = htmlKeeta;
    if(tbodyHunger) tbodyHunger.innerHTML = htmlHunger;
    if(tbodyJahez) tbodyJahez.innerHTML = htmlJahez;
    if(tbodyChefz) tbodyChefz.innerHTML = htmlChefz;

    // تهيئة tooltips اسم المالك
    document.querySelectorAll('.driver-name-actual[data-bs-toggle="tooltip"]').forEach(el => {
        let old = bootstrap.Tooltip.getInstance(el);
        if (old) old.dispose();
        new bootstrap.Tooltip(el, { trigger: 'hover', html: false });
    });

    ['Ninja', 'Keeta', 'Hunger', 'Jahez', 'Chefz'].forEach(p => {
        let low = p.toLowerCase();
        if(document.getElementById(`statTotal${p}`)) document.getElementById(`statTotal${p}`).innerText = stats[low].total;
        if(document.getElementById(`statAvailable${p}`)) document.getElementById(`statAvailable${p}`).innerText = stats[low].avail;
        if(document.getElementById(`statUsed${p}`)) document.getElementById(`statUsed${p}`).innerText = stats[low].used;
        if(document.getElementById(`allOrders${p}`)) document.getElementById(`allOrders${p}`).innerText = stats[low].orders;
        // إحصاءات نوع التعاقد (كفالة / فري لانسر)
        let kafalaBadge = document.getElementById(`ctStatsKafala${p}`);
        let freelanceBadge = document.getElementById(`ctStatsFreelance${p}`);
        if (kafalaBadge) kafalaBadge.textContent = stats[low].kafala || 0;
        if (freelanceBadge) freelanceBadge.textContent = stats[low].freelance || 0;
    });
}

function deleteAccount(id) {
    if(!hasPerm('delete')) return alert('❌ ليس لديك صلاحية الحذف. تواصل مع الأدمن.');
    swalConfirm("هل أنت متأكد من حذف هذا المندوب؟ سيتم نقله لسلة المحذوفات 🗑️", { confirmText: 'نعم، احذف' }).then(function(_ok) { if (_ok) {
        database.ref('ninja_data/accounts/' + id).once('value').then(snap => {
            let accToTrash = snap.val();
            if(accToTrash) {
                let _origAcc = { ...accToTrash };
                accToTrash.deletedAt = new Date().toLocaleString('en-GB'); accToTrash.deletedBy = window.loggedInUser || 'admin';
                let updates = {}; updates['ninja_data/deleted_accounts/' + id] = accToTrash; updates['ninja_data/accounts/' + id] = null;
                pushUndoState(`حذف "${_origAcc.actualUserName || _origAcc.ownerName}" #${id}`, { ['ninja_data/accounts/' + id]: _origAcc, ['ninja_data/deleted_accounts/' + id]: null });
                database.ref().update(updates).then(() => { logAudit('حذف حساب', id, 'تم نقل المندوب إلى سلة المحذوفات'); alert("تم نقل المندوب لسلة المحذوفات بنجاح! ✅"); });
            }
        });
    } });
}

function togglePortalAccess(id) {
    if (!hasPerm('add_edit')) return alert('❌ ليس لديك صلاحية تعديل الوصول. تواصل مع الأدمن.');
    const acc = window.allRawAccounts.find(a => a && a.id == id);
    if (!acc) return;
    const nowEnabled = acc.portalAccess === true;
    const newVal = !nowEnabled;
    const name = acc.actualUserName || acc.ownerName || id;
    const msg = newVal
        ? `تفعيل بوابة المندوب لـ <b>${escHtml(name)}</b>؟<br><small class="text-muted">سيتمكن من تسجيل الدخول عبر رابط البوابة</small>`
        : `تعطيل بوابة المندوب لـ <b>${escHtml(name)}</b>؟<br><small class="text-muted">لن يتمكن من الدخول حتى تُفعّلها مجدداً</small>`;
    swalConfirm(msg, { confirmText: newVal ? 'تفعيل' : 'تعطيل' }).then(ok => {
        if (!ok) return;
        database.ref('ninja_data/accounts/' + id + '/portalAccess').set(newVal).then(() => {
            logAudit(newVal ? 'تفعيل بوابة المندوب' : 'تعطيل بوابة المندوب', id, `${name}`);
            alert(newVal ? `✅ تم تفعيل بوابة المندوب لـ ${name}` : `✅ تم تعطيل بوابة المندوب لـ ${name}`);
        });
    });
}

// ==========================================
// قسم بوابة المندوب — Portal Management
// ==========================================
let portalSubTab = 'access';

function switchPortalTab(tab) {
    portalSubTab = tab;
    ['access','activity','qr','settings','announcements','requests'].forEach(t => {
        let pane = document.getElementById('portalPane_' + t);
        let btn = document.getElementById('portalTabBtn_' + t);
        if (pane) pane.style.display = t === tab ? '' : 'none';
        if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'access')        renderPortalAccessTable();
    if (tab === 'activity')      renderPortalActivity();
    if (tab === 'qr')            renderPortalQR();
    if (tab === 'settings')      renderPortalSettingsUI();
    if (tab === 'announcements') renderPortalAnnouncements();
    if (tab === 'requests')      renderPortalRequests();
}

function renderPortalSection() {
    let accounts = (window.allRawAccounts || []).filter(a => a);
    let enabled = accounts.filter(a => a.portalAccess === true).length;
    let disabled = accounts.length - enabled;
    let oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let acts = window.allPortalActivity || [];
    let weekLogins = acts.filter(e => e.type === 'login' && e.ts > oneWeekAgo).length;
    let lastAct = acts.slice().sort((a, b) => b.ts - a.ts)[0];
    let lastStr = lastAct ? new Date(lastAct.ts).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' }) : '—';

    let set = (id, v) => { let el = document.getElementById(id); if (el) el.textContent = v; };
    set('pkpi_enabled', enabled);
    set('pkpi_disabled', disabled);
    set('pkpi_week', weekLogins);
    set('pkpi_last', lastStr);

    let badge = document.getElementById('portalEmergencyBadge');
    if (badge) badge.style.setProperty('display', (window.portalSettings || {}).emergencyLock ? 'inline-block' : 'none', 'important');

    if (portalSubTab === 'access') renderPortalAccessTable();
    if (portalSubTab === 'activity') renderPortalActivity();
}

function renderPortalAccessTable() {
    let search = ((document.getElementById('portalSearch') || {}).value || '').toLowerCase();
    let pf = (document.getElementById('portalPlatformFilter') || {}).value || 'all';
    let af = (document.getElementById('portalAccessFilter') || {}).value || 'all';

    let accounts = (window.allRawAccounts || []).filter(a => {
        if (!a) return false;
        if (pf !== 'all' && (a.platform || 'ninja') !== pf) return false;
        if (af === 'enabled' && a.portalAccess !== true) return false;
        if (af === 'disabled' && a.portalAccess === true) return false;
        if (search) {
            let hay = `${a.ownerName || ''} ${a.actualUserName || ''} ${a.phone || ''} ${a.employeeNumber || ''}`.toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    const pEmoji = { ninja: '🥷', keeta: '🚴', hunger: '📦', jahez: '🛒', chefz: '👨‍🍳' };
    const pName = { ninja: 'نينجا', keeta: 'كيتا', hunger: 'هنقر', jahez: 'جاهز', chefz: 'شفز' };
    let acts = window.allPortalActivity || [];

    let tbody = document.getElementById('portalAccessTableBody');
    if (!tbody) return;

    if (!accounts.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-5"><i class="bi bi-inbox fs-2 d-block mb-2 opacity-25"></i>لا توجد نتائج</td></tr>`;
    } else {
        tbody.innerHTML = accounts.map(acc => {
            let enabled = acc.portalAccess === true;
            let p = acc.platform || 'ninja';
            let lastLogin = acts.filter(e => String(e.driverId) === String(acc.id) && e.type === 'login').sort((a, b) => b.ts - a.ts)[0];
            let lastStr = lastLogin ? new Date(lastLogin.ts).toLocaleString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
            let nameSafe = (acc.actualUserName || acc.ownerName || '').replace(/'/g, "\\'");
            return `<tr>
                <td><span class="fw-bold">${pEmoji[p] || '🥷'} ${pName[p] || p}</span></td>
                <td>
                    <div class="fw-bold">${escHtml(acc.actualUserName || '-')}</div>
                    <small class="text-muted">${escHtml(acc.ownerName || '-')}</small>
                </td>
                <td><small dir="ltr" class="text-muted">${acc.phone || '-'}</small></td>
                <td>${enabled
                    ? '<span class="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill fw-bold">🔑 مفعّل</span>'
                    : '<span class="badge bg-secondary-subtle text-secondary border px-3 py-1 rounded-pill fw-bold">🔒 محظور</span>'}
                </td>
                <td><small class="text-muted">${lastStr}</small></td>
                <td class="text-center">
                    <div class="d-flex gap-1 justify-content-center">
                        <button onclick="togglePortalAccess('${acc.id}')" class="btn btn-sm ${enabled ? 'btn-outline-danger' : 'btn-outline-success'} fw-bold">
                            <i class="bi bi-${enabled ? 'toggle-on' : 'toggle-off'}"></i> ${enabled ? 'تعطيل' : 'تفعيل'}
                        </button>
                        <button onclick="sendPortalLinkWA('${acc.phone}','${nameSafe}','${acc.id}')" class="btn btn-sm btn-success" title="إرسال رابط البوابة عبر واتساب"><i class="bi bi-whatsapp"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    let countEl = document.getElementById('portalAccessCount');
    if (countEl) countEl.textContent = `${accounts.length} مندوب`;
}

function renderPortalActivity() {
    let tbody = document.getElementById('portalActivityTableBody');
    if (!tbody) return;
    let acts = (window.allPortalActivity || []).slice().sort((a, b) => b.ts - a.ts).slice(0, 150);
    if (!acts.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-5"><i class="bi bi-clock-history fs-2 d-block mb-2 opacity-25"></i>لا يوجد نشاط مسجّل</td></tr>`;
        return;
    }
    const pEmoji = { ninja: '🥷', keeta: '🚴', hunger: '📦', jahez: '🛒', chefz: '👨‍🍳' };
    const typeMap = {
        login: ['🔓 دخول ناجح', 'bg-success-subtle text-success border-success-subtle'],
        fail: ['❌ محاولة فاشلة', 'bg-danger-subtle text-danger border-danger-subtle'],
        logout: ['🔒 خروج', 'bg-secondary-subtle text-secondary']
    };
    tbody.innerHTML = acts.map(e => {
        let [label, cls] = typeMap[e.type] || [e.type || '—', 'bg-light text-dark'];
        return `<tr>
            <td><span class="badge ${cls} border px-2 py-1 rounded-pill">${label}</span></td>
            <td><b>${escHtml(e.driverName || '—')}</b></td>
            <td>${pEmoji[e.platform] || '—'} <small class="text-muted">${e.platform || '—'}</small></td>
            <td><small class="text-muted">${new Date(e.ts).toLocaleString('ar-SA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></td>
        </tr>`;
    }).join('');
}

function renderPortalQR() {
    let linkInput = document.getElementById('portalLinkInput');
    let qrDiv = document.getElementById('portalQrDiv');
    if (!linkInput || !qrDiv) return;
    let portalUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/') + 'driver.html';
    linkInput.value = portalUrl;
    qrDiv.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
        new QRCode(qrDiv, { text: portalUrl, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
    } else {
        qrDiv.innerHTML = `<div class="text-muted text-center p-4 border rounded-3"><i class="bi bi-qr-code fs-1 d-block mb-2 opacity-30"></i>مكتبة QR غير محملة</div>`;
    }
}

function downloadPortalQR() {
    let canvas = document.querySelector('#portalQrDiv canvas');
    if (!canvas) return alert('⚠️ لا يوجد رمز QR لتنزيله، افتح تبويب QR أولاً');
    let a = document.createElement('a');
    a.download = 'speedpro-portal-qr.png';
    a.href = canvas.toDataURL();
    a.click();
}

function copyPortalLink() {
    let input = document.getElementById('portalLinkInput');
    if (!input) return;
    navigator.clipboard.writeText(input.value).then(() => alert('✅ تم نسخ رابط البوابة'));
}

function sharePortalWhatsApp() {
    let input = document.getElementById('portalLinkInput');
    if (!input) return;
    let msg = `🚀 بوابة المندوب — SpeedPro\nيمكنك الاطلاع على بياناتك الآن عبر:\n${input.value}\n\n📱 سجّل الدخول برقم جوالك ورقم هويتك / إقامتك`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function sendPortalLinkWA(phone, name, id) {
    if (!phone || phone === '-') return alert('❌ لا يوجد رقم جوال لهذا المندوب');
    let acc = (window.allRawAccounts || []).find(a => a && String(a.id) === String(id));
    if (!acc || acc.portalAccess !== true) return alert('⚠️ يجب تفعيل وصول المندوب أولاً قبل إرسال الرابط');
    let portalUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/') + 'driver.html';
    let msg = `أهلاً ${name} 👋\nيمكنك الآن الاطلاع على بياناتك عبر بوابة المندوب:\n${portalUrl}\n\n🔑 سجّل الدخول بـ:\n📱 رقم جوالك\n🪪 رقم هويتك أو إقامتك\n\nSpeedPro — سرعة المعالجة للخدمات اللوجستية`;
    let num = (typeof normalizeSaudiPhone === 'function') ? normalizeSaudiPhone(phone) : phone.replace(/\D/g, '');
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
}

function renderPortalSettingsUI() {
    let settings = window.portalSettings || {};
    let fields = settings.showFields || {};
    const fieldDefs = [
        { key: 'wallet',      label: '💰 رصيد المحفظة' },
        { key: 'dailyOrders', label: '📅 طلبات اليوم' },
        { key: 'totalOrders', label: '📈 التراكمي الكلي' },
        { key: 'hours',       label: '⏱️ ساعات العمل' },
        { key: 'notes',       label: '📝 ملاحظات المشرف' },
        { key: 'supervisor',  label: '👷 المشرف الميداني' },
    ];
    let togglesEl = document.getElementById('portalFieldToggles');
    if (togglesEl) {
        togglesEl.innerHTML = fieldDefs.map(f => `
            <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
                <label class="fw-bold mb-0" for="pf_${f.key}">${f.label}</label>
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" id="pf_${f.key}" ${fields[f.key] !== false ? 'checked' : ''} style="transform:scale(1.3); cursor:pointer;">
                </div>
            </div>`).join('');
    }
    let welcomeEl = document.getElementById('portalWelcomeMsg');
    if (welcomeEl) welcomeEl.value = settings.welcomeMessage || '';
    let lockEl = document.getElementById('portalEmergencyLock');
    if (lockEl) lockEl.checked = settings.emergencyLock === true;
}

function savePortalSettings() {
    const fieldKeys = ['wallet', 'dailyOrders', 'totalOrders', 'hours', 'notes', 'supervisor'];
    let showFields = {};
    fieldKeys.forEach(k => { let el = document.getElementById('pf_' + k); showFields[k] = el ? el.checked : true; });
    let welcomeMessage = (document.getElementById('portalWelcomeMsg') || {}).value || '';
    let emergencyLock = ((document.getElementById('portalEmergencyLock') || {}).checked) === true;
    let settings = { showFields, welcomeMessage, emergencyLock };
    database.ref('ninja_data/portal_settings').set(settings).then(() => {
        window.portalSettings = settings;
        logAudit('تعديل إعدادات البوابة', 'portal', emergencyLock ? 'القفل الطارئ مفعّل' : 'إعدادات عادية');
        alert('✅ تم حفظ إعدادات البوابة بنجاح');
    });
}

function bulkPortalAccess(enable) {
    if (!hasPerm('add_edit')) return alert('❌ ليس لديك صلاحية لهذا الإجراء.');
    let pf = (document.getElementById('portalPlatformFilter') || {}).value || 'all';
    let targets = (window.allRawAccounts || []).filter(a => {
        if (!a) return false;
        if (pf !== 'all' && (a.platform || 'ninja') !== pf) return false;
        return true;
    });
    if (!targets.length) return alert('⚠️ لا يوجد مناديب مطابقون للفلتر الحالي');
    let count = targets.length;
    let msg = enable
        ? `تفعيل بوابة المندوب لـ <b>${count} مندوب</b>؟${pf !== 'all' ? `<br><small class="text-muted">منصة ${pf} فقط</small>` : ''}`
        : `تعطيل بوابة المندوب لـ <b>${count} مندوب</b>؟${pf !== 'all' ? `<br><small class="text-muted">منصة ${pf} فقط</small>` : ''}`;
    swalConfirm(msg, { confirmText: enable ? 'تفعيل الكل' : 'تعطيل الكل' }).then(ok => {
        if (!ok) return;
        let updates = {};
        targets.forEach(a => { updates[`ninja_data/accounts/${a.id}/portalAccess`] = enable; });
        database.ref().update(updates).then(() => {
            logAudit(enable ? 'تفعيل جماعي للبوابة' : 'تعطيل جماعي للبوابة', 'portal', `${count} مندوب`);
            alert(`✅ تم ${enable ? 'تفعيل' : 'تعطيل'} بوابة المندوب لـ ${count} مندوب`);
        });
    });
}

function clearPortalActivity() {
    if (!hasPerm('delete')) return alert('❌ ليس لديك صلاحية مسح السجل.');
    swalConfirm('مسح جميع سجلات نشاط البوابة؟ لا يمكن التراجع.', { confirmText: 'مسح السجل' }).then(ok => {
        if (!ok) return;
        database.ref('ninja_data/portal_activity').remove().then(() => {
            window.allPortalActivity = [];
            renderPortalActivity();
            renderPortalSection();
            logAudit('مسح سجل البوابة', 'portal', 'تم مسح سجل النشاط كلياً');
            alert('✅ تم مسح سجل النشاط');
        });
    });
}

// ==========================================
// بوابة المندوب — الإعلانات
// ==========================================
function renderPortalAnnouncements() {
    let el = document.getElementById('announcementsList');
    if (!el) return;
    el.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
    database.ref('ninja_data/portal_announcements').orderByChild('ts').limitToLast(50).once('value').then(snap => {
        let anns = snap.val() ? Object.entries(snap.val()).map(([k,v]) => ({...v, __key:k})).sort((a,b)=>b.ts-a.ts) : [];
        if (!anns.length) { el.innerHTML = '<div class="text-center text-muted py-4"><i class="bi bi-megaphone fs-2 d-block mb-2 opacity-30"></i>لا توجد إعلانات</div>'; return; }
        const typeStyles = {
            info:    { bg:'#dbeafe', color:'#1d4ed8', icon:'info-circle-fill' },
            warning: { bg:'#fef3c7', color:'#92400e', icon:'exclamation-triangle-fill' },
            success: { bg:'#dcfce7', color:'#14532d', icon:'check-circle-fill' },
            danger:  { bg:'#fee2e2', color:'#7f1d1d', icon:'exclamation-octagon-fill' },
        };
        const targetLabels = { all:'الكل', ninja:'نينجا', keeta:'كيتا', hunger:'هنقر', jahez:'جاهز', chefz:'شفز' };
        el.innerHTML = anns.map(a => {
            let s = typeStyles[a.type] || typeStyles.info;
            let date = new Date(a.ts).toLocaleDateString('ar-SA', { day:'numeric', month:'short', year:'numeric' });
            return `<div class="p-3 mb-2 rounded-3 d-flex align-items-start gap-2" style="background:${s.bg}; border:1px solid ${s.color}44;">
                <i class="bi bi-${s.icon} mt-1 flex-shrink-0" style="color:${s.color}"></i>
                <div class="flex-grow-1">
                    <div class="fw-bold mb-1" style="color:${s.color}">${a.message}</div>
                    <div class="d-flex gap-2 flex-wrap">
                        <small class="text-muted">${date}</small>
                        <span class="badge rounded-pill" style="background:${s.color}22;color:${s.color}; font-size:.7rem;">${targetLabels[a.target]||a.target}</span>
                    </div>
                </div>
                <button onclick="deleteAnnouncement('${a.__key}')" class="btn btn-sm btn-outline-danger ms-auto flex-shrink-0" style="padding:.15rem .45rem;" title="حذف"><i class="bi bi-trash3 fs-7"></i></button>
            </div>`;
        }).join('');
    });
}

function createAnnouncement() {
    if (!hasPerm('edit')) return alert('❌ ليس لديك صلاحية النشر.');
    let msg    = (document.getElementById('annMessage').value || '').trim();
    let type   = document.getElementById('annType').value;
    let target = document.getElementById('annTarget').value;
    if (!msg) { alert('⚠️ يرجى كتابة نص الإعلان'); return; }
    let ann = { message: msg, type, target, ts: Date.now(), active: true };
    database.ref('ninja_data/portal_announcements').push(ann).then(() => {
        document.getElementById('annMessage').value = '';
        renderPortalAnnouncements();
        logAudit('نشر إعلان', 'portal', `الإعلان: "${msg.slice(0,40)}..."`);
        alert('✅ تم نشر الإعلان للمناديب');
    }).catch(() => alert('❌ حدث خطأ أثناء النشر'));
}

function deleteAnnouncement(key) {
    if (!hasPerm('delete')) return alert('❌ ليس لديك صلاحية الحذف.');
    swalConfirm('حذف هذا الإعلان؟', { confirmText:'حذف', confirmColor:'#dc2626' }).then(ok => {
        if (!ok) return;
        database.ref('ninja_data/portal_announcements/' + key).remove().then(() => {
            renderPortalAnnouncements();
            logAudit('حذف إعلان', 'portal', 'تم حذف إعلان من البوابة');
        });
    });
}

// ==========================================
// بوابة المندوب — طلبات المناديب
// ==========================================
function renderPortalRequests() {
    let tbody = document.getElementById('portalRequestsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

    let statusFilter = (document.getElementById('reqStatusFilter') || {}).value || 'all';
    let u = adminUsers[window.loggedInUser] || {};
    let isSuper = u.role === 'super_admin' || u.role === 'admin';
    let userPlatforms = u.platforms || (u.platform ? [u.platform] : null);

    database.ref('ninja_data/portal_requests').orderByChild('ts').limitToLast(300).once('value').then(snap => {
        let all = snap.val() ? Object.entries(snap.val()).map(([k,v]) => ({...v, __key:k})).sort((a,b)=>b.ts-a.ts) : [];

        let filtered;
        if      (statusFilter === 'all')                filtered = all;
        else if (statusFilter === 'advance_pending')    filtered = all.filter(r => r.type === 'سلفة' && r.status === 'pending');
        else if (statusFilter === 'supervisor_approved') filtered = all.filter(r => r.type === 'سلفة' && r.status === 'supervisor_approved');
        else                                            filtered = all.filter(r => r.status === statusFilter);

        // Badge: count advances needing action (pending = needs supervisor, supervisor_approved = needs admin)
        let actionablePending = all.filter(r => r.type === 'سلفة' && (r.status === 'pending' || r.status === 'supervisor_approved')).length
                              + all.filter(r => r.type !== 'سلفة' && r.status === 'pending').length;
        let badge = document.getElementById('reqBadgeCount');
        if (badge) {
            badge.textContent = actionablePending > 0 ? actionablePending : '';
            badge.classList.toggle('d-none', actionablePending === 0);
        }

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5"><i class="bi bi-inbox fs-2 d-block mb-2 opacity-30"></i>لا توجد طلبات</td></tr>';
            return;
        }
        const platformNames = { ninja:'🥷 نينجا', keeta:'🚴 كيتا', hunger:'📦 هنقر', jahez:'🛒 جاهز', chefz:'👨‍🍳 شفز' };
        const statusMap = {
            pending:              '<span class="badge bg-warning text-dark"><i class="bi bi-hourglass-split me-1"></i>⏳ بانتظار المشرف</span>',
            supervisor_approved:  '<span class="badge text-white" style="background:#0284c7;"><i class="bi bi-person-check me-1"></i>🔄 بانتظار الأدمن</span>',
            supervisor_rejected:  '<span class="badge bg-danger"><i class="bi bi-person-x me-1"></i>❌ رفض المشرف</span>',
            admin_approved:       '<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>✅ موافق نهائياً</span>',
            admin_rejected:       '<span class="badge bg-danger"><i class="bi bi-x-circle-fill me-1"></i>❌ رفض الأدمن</span>',
            open:                 '<span class="badge bg-primary">📬 مفتوح</span>',
            closed:               '<span class="badge bg-success">✔️ مُغلق</span>',
            // legacy statuses
            advance_approved:     '<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>✅ موافق عليها</span>',
            advance_rejected:     '<span class="badge bg-danger"><i class="bi bi-x-circle-fill me-1"></i>❌ مرفوضة</span>',
        };

        tbody.innerHTML = filtered.map(r => {
            let isAdv = r.type === 'سلفة';

            // Stage 1: supervisor can approve pending advances for their platform
            let canSupervisorApprove = isAdv && r.status === 'pending' && (isSuper || (userPlatforms && userPlatforms.includes(r.platform)));
            // Stage 2: admin (super or has approveAdvance perm) can give final approval
            let canAdminApprove = isAdv && r.status === 'supervisor_approved' && (isSuper || hasPerm('approveAdvance'));
            // Legacy: direct approve (for old pending non-two-stage flow)
            let canLegacyApprove = isAdv && r.status === 'pending' && !canSupervisorApprove && (isSuper || hasPerm('approveAdvance'));

            // Message cell — all user-controlled fields escaped
            let msgHtml = `<div style="max-width:240px;word-wrap:break-word;">${escHtml(r.message||'—')}`;
            if (isAdv && r.advanceAmount) {
                msgHtml += `<div class="mt-1 d-flex gap-1 flex-wrap">
                    <span class="badge bg-warning-subtle text-warning border">💰 ${escHtml(String(r.advanceAmount))} ريال</span>
                    ${r.advanceDate ? `<span class="badge bg-secondary-subtle text-secondary border">📅 ${escHtml(r.advanceDate)}</span>` : ''}
                </div>`;
            }
            if (r.adminReply) msgHtml += `<div class="text-primary small mt-1"><i class="bi bi-reply me-1"></i>${escHtml(r.adminReply)}</div>`;
            // Supervisor trail
            if (r.supervisorApprovedBy) {
                msgHtml += `<div class="mt-1 px-2 py-1 rounded" style="background:#e0f2fe;border-right:3px solid #0284c7;">
                    <small class="fw-bold d-block" style="color:#0369a1;"><i class="bi bi-person-check-fill me-1"></i>موافقة المشرف: ${escHtml(r.supervisorApprovedBy)}</small>
                    ${r.supervisorPerformance ? `<small class="text-muted">الأداء: <b>${escHtml(r.supervisorPerformance)}</b></small>` : ''}
                    ${r.supervisorNote ? `<small class="text-muted d-block">${escHtml(r.supervisorNote)}</small>` : ''}
                </div>`;
            }
            if (r.supervisorRejectedBy) {
                msgHtml += `<div class="mt-1 px-2 py-1 rounded" style="background:#fee2e2;border-right:3px solid #dc2626;">
                    <small class="fw-bold text-danger d-block"><i class="bi bi-person-x-fill me-1"></i>رفض المشرف: ${escHtml(r.supervisorRejectedBy)}</small>
                    ${r.supervisorRejectionReason ? `<small class="text-muted">${escHtml(r.supervisorRejectionReason)}</small>` : ''}
                </div>`;
            }
            // Admin trail
            if (r.status === 'admin_approved') msgHtml += `<div class="text-success small mt-1 fw-bold"><i class="bi bi-check-circle-fill me-1"></i>الأدمن: ${escHtml(r.approvedBy||'—')}${r.approvalNote ? ' — '+escHtml(r.approvalNote) : ''}</div>`;
            if (r.status === 'admin_rejected') msgHtml += `<div class="text-danger small mt-1 fw-bold"><i class="bi bi-x-circle-fill me-1"></i>رفض الأدمن: ${escHtml(r.rejectedBy||'—')}${r.rejectionReason ? '<br><span class="fw-normal">السبب: '+escHtml(r.rejectionReason)+'</span>' : ''}</div>`;
            // Legacy trail
            if (r.status === 'advance_approved') msgHtml += `<div class="text-success small mt-1 fw-bold"><i class="bi bi-person-check me-1"></i>وافق: ${escHtml(r.approvedBy||'—')}${r.approvalNote ? ' — '+escHtml(r.approvalNote) : ''}</div>`;
            if (r.status === 'advance_rejected') msgHtml += `<div class="text-danger small mt-1 fw-bold"><i class="bi bi-person-x me-1"></i>رفض: ${escHtml(r.rejectedBy||'—')}${r.rejectionReason ? '<br><span class="fw-normal">السبب: '+escHtml(r.rejectionReason)+'</span>' : ''}</div>`;
            msgHtml += '</div>';

            let typeBadge = isAdv
                ? '<span class="badge bg-warning-subtle text-warning border fw-bold">💵 سلفة</span>'
                : `<span class="badge bg-secondary-subtle text-secondary border">${escHtml(r.type||'—')}</span>`;

            let rowClass = (isAdv && r.status === 'pending') ? 'table-warning'
                         : (isAdv && r.status === 'supervisor_approved') ? 'table-info'
                         : '';

            let finalStatuses = ['advance_approved','advance_rejected','admin_approved','admin_rejected','supervisor_rejected'];
            let isFinal = finalStatuses.includes(r.status);

            let btns = '<div class="d-flex gap-1 justify-content-center flex-wrap">';
            // Stage 1 buttons (supervisor review)
            if (canSupervisorApprove) {
                btns += `<button onclick="supervisorApproveAdvance(this)" data-key="${escHtml(r.__key)}" data-name="${escHtml(r.driverName||'')}" data-driverid="${escHtml(String(r.driverId||''))}" data-amount="${escHtml(String(r.advanceAmount||0))}" class="btn btn-sm text-white fw-bold" style="background:#0284c7;" title="موافقة المشرف"><i class="bi bi-person-check me-1"></i>موافق</button>`;
                btns += `<button onclick="supervisorRejectAdvance(this)" data-key="${escHtml(r.__key)}" data-name="${escHtml(r.driverName||'')}" class="btn btn-sm btn-outline-danger fw-bold" title="رفض المشرف"><i class="bi bi-person-x me-1"></i>رفض</button>`;
            }
            // Stage 2 buttons (admin final approval)
            if (canAdminApprove) {
                btns += `<button onclick="adminApproveAdvance(this)" data-key="${escHtml(r.__key)}" data-name="${escHtml(r.driverName||'')}" data-amount="${escHtml(String(r.advanceAmount||0))}" data-driverid="${escHtml(String(r.driverId||''))}" class="btn btn-sm btn-success fw-bold" title="موافقة نهائية"><i class="bi bi-check-lg me-1"></i>موافقة الأدمن</button>`;
                btns += `<button onclick="adminRejectAdvance(this)" data-key="${escHtml(r.__key)}" data-name="${escHtml(r.driverName||'')}" class="btn btn-sm btn-danger fw-bold" title="رفض نهائي"><i class="bi bi-x-lg me-1"></i>رفض</button>`;
            }
            // Legacy direct approve (shouldn't happen in new flow but kept for safety)
            if (canLegacyApprove) {
                btns += `<button onclick="approveAdvance(this)" data-key="${escHtml(r.__key)}" data-name="${escHtml(r.driverName||'')}" data-amount="${escHtml(String(r.advanceAmount||0))}" class="btn btn-sm btn-success fw-bold" title="موافقة"><i class="bi bi-check-lg me-1"></i>موافقة</button>`;
                btns += `<button onclick="rejectAdvance(this)" data-key="${escHtml(r.__key)}" data-name="${escHtml(r.driverName||'')}" class="btn btn-sm btn-danger fw-bold" title="رفض"><i class="bi bi-x-lg me-1"></i>رفض</button>`;
            }
            if (!isFinal) {
                btns += `<button onclick="replyToRequest(this)" data-key="${escHtml(r.__key)}" data-name="${escHtml(r.driverName||'')}" class="btn btn-sm btn-outline-primary" title="رد"><i class="bi bi-reply"></i></button>`;
                if (!isAdv) btns += `<button onclick="closeRequest('${escHtml(r.__key)}')" class="btn btn-sm btn-outline-success" title="إغلاق"><i class="bi bi-check2"></i></button>`;
            }
            btns += `<button onclick="deleteRequest('${escHtml(r.__key)}')" class="btn btn-sm btn-outline-danger" title="حذف"><i class="bi bi-trash3"></i></button>`;
            btns += '</div>';

            return `<tr class="${rowClass}">
                <td>${typeBadge}</td>
                <td class="fw-bold">${escHtml(r.driverName||'—')}</td>
                <td>${escHtml(platformNames[r.platform]||r.platform||'—')}</td>
                <td>${msgHtml}</td>
                <td>${statusMap[r.status] || `<span class="badge bg-secondary">${escHtml(r.status)}</span>`}</td>
                <td class="text-muted small">${escHtml(r.createdAt||new Date(r.ts).toLocaleDateString('ar-SA'))}</td>
                <td class="text-center">${btns}</td>
            </tr>`;
        }).join('');
    });
}

async function approveAdvance(btn) {
    if (!isAdminOrSuper() && !hasPerm('edit')) return alert('❌ ليس لديك صلاحية الموافقة على السلف.');
    let key = btn.dataset.key, driverName = btn.dataset.name, amount = btn.dataset.amount;
    let { isConfirmed, value: note } = await Swal.fire({
        title: `✅ الموافقة على طلب السلفة`,
        html: `<div class="text-center mb-3">
                   <div class="fw-bold mb-1">${escHtml(driverName)}</div>
                   <span class="badge bg-warning-subtle text-warning border fs-6 px-4 py-2">💰 ${escHtml(amount)} ريال</span>
               </div>
               <textarea id="approvalNote" class="form-control text-end" rows="3" placeholder="ملاحظة للمندوب (اختياري)..."></textarea>`,
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        confirmButtonText: '✅ تأكيد الموافقة',
        confirmButtonColor: '#16a34a',
        preConfirm: () => document.getElementById('approvalNote').value.trim()
    });
    if (!isConfirmed) return;
    database.ref('ninja_data/portal_requests/' + key).update({
        status: 'advance_approved',
        approvedBy: window.loggedInUser,
        approvedAt: Date.now(),
        approvalNote: note || ''
    }).then(() => {
        renderPortalRequests();
        logAudit('موافقة سلفة', driverName, `تمت الموافقة على سلفة ${amount} ريال للمندوب ${driverName}`);
        Swal.fire({ icon: 'success', title: 'تمت الموافقة ✅', text: `تمت الموافقة على سلفة ${driverName} بمبلغ ${amount} ريال`, timer: 2500, showConfirmButton: false });
    });
}

async function rejectAdvance(btn) {
    if (!isAdminOrSuper() && !hasPerm('edit')) return alert('❌ ليس لديك صلاحية رفض السلف.');
    let key = btn.dataset.key, driverName = btn.dataset.name;
    let { isConfirmed, value: reason } = await Swal.fire({
        title: `❌ رفض طلب السلفة`,
        html: `<div class="text-muted mb-3">طلب سلفة من: <b class="text-dark">${escHtml(driverName)}</b></div>
               <textarea id="rejectReason" class="form-control text-end" rows="3" placeholder="سبب الرفض (مطلوب)..."></textarea>`,
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        confirmButtonText: '❌ رفض الطلب',
        confirmButtonColor: '#dc2626',
        preConfirm: () => {
            let r = document.getElementById('rejectReason').value.trim();
            if (!r) { Swal.showValidationMessage('⚠️ يرجى كتابة سبب الرفض'); return false; }
            return r;
        }
    });
    if (!isConfirmed) return;
    database.ref('ninja_data/portal_requests/' + key).update({
        status: 'advance_rejected',
        rejectedBy: window.loggedInUser,
        rejectedAt: Date.now(),
        rejectionReason: reason
    }).then(() => {
        renderPortalRequests();
        logAudit('رفض سلفة', driverName, `تم رفض طلب سلفة من ${driverName} — السبب: ${reason}`);
        Swal.fire({ icon: 'info', title: 'تم الرفض', timer: 1800, showConfirmButton: false });
    });
}

// ==========================================
// سلفة — مرحلة 1: موافقة المشرف
// ==========================================
async function supervisorApproveAdvance(btn) {
    if (!isAdminOrSuper() && !hasPerm('edit')) return alert('❌ ليس لديك صلاحية الموافقة على السلف.');
    let key = btn.dataset.key, driverName = btn.dataset.name, amount = btn.dataset.amount, driverId = btn.dataset.driverid;
    let driverAcc = (window.allRawAccounts || []).find(a => a && String(a.id) === String(driverId));
    let ordersInfo = driverAcc ? `<div class="mt-2 d-flex gap-2 justify-content-center flex-wrap">
        <span class="badge bg-primary-subtle text-primary border">📦 إجمالي الطلبات: <b>${driverAcc.totalOrders||0}</b></span>
        <span class="badge bg-success-subtle text-success border">📅 اليوم: <b>${driverAcc.dailyOrders||0}</b></span>
    </div>` : '';
    let { isConfirmed, value: formValues } = await Swal.fire({
        title: '🔍 مراجعة طلب السلفة',
        html: `<div class="text-center mb-3">
                   <div class="fw-bold fs-5 mb-1">${escHtml(driverName)}</div>
                   <span class="badge bg-warning-subtle text-warning border fs-6 px-4 py-2">💰 ${escHtml(amount)} ريال</span>
                   ${ordersInfo}
               </div>
               <label class="fw-bold small text-muted mb-1 d-block text-end">تقييم أداء المندوب</label>
               <select id="perfSelect" class="form-select mb-3 text-end fw-bold">
                   <option value="ممتاز">⭐⭐⭐⭐⭐ ممتاز</option>
                   <option value="جيد جداً">⭐⭐⭐⭐ جيد جداً</option>
                   <option value="جيد" selected>⭐⭐⭐ جيد</option>
                   <option value="مقبول">⭐⭐ مقبول</option>
                   <option value="ضعيف">⭐ ضعيف</option>
               </select>
               <textarea id="supNote" class="form-control text-end" rows="2" placeholder="ملاحظة للأدمن (اختياري)..."></textarea>`,
        showCancelButton: true,
        confirmButtonText: '✅ موافقة المشرف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#0284c7',
        preConfirm: () => ({
            performance: document.getElementById('perfSelect').value,
            note: document.getElementById('supNote').value.trim()
        }),
        allowOutsideClick: false
    });
    if (!isConfirmed) return;
    await database.ref('ninja_data/portal_requests/' + key).update({
        status: 'supervisor_approved',
        supervisorApprovedBy: window.loggedInUser,
        supervisorApprovedAt: Date.now(),
        supervisorPerformance: formValues.performance,
        supervisorNote: formValues.note,
        driverOrderCount: driverAcc ? (Number(driverAcc.totalOrders) || 0) : 0
    });
    logAudit('موافقة مشرف على سلفة', driverName, `المبلغ: ${amount} ريال — الأداء: ${formValues.performance}`);
    renderPortalRequests();
    Swal.fire({ icon: 'success', title: '✅ تمت موافقة المشرف', text: 'انتقل الطلب لموافقة الأدمن', timer: 2200, showConfirmButton: false });
}

async function supervisorRejectAdvance(btn) {
    if (!isAdminOrSuper() && !hasPerm('edit')) return alert('❌ ليس لديك صلاحية رفض السلف.');
    let key = btn.dataset.key, driverName = btn.dataset.name;
    let { isConfirmed, value: reason } = await Swal.fire({
        title: '❌ رفض طلب السلفة (المشرف)',
        html: `<div class="text-muted mb-3">طلب سلفة من: <b class="text-dark">${escHtml(driverName)}</b></div>
               <textarea id="rejectReason" class="form-control text-end" rows="3" placeholder="سبب الرفض (مطلوب)..."></textarea>`,
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        confirmButtonText: '❌ رفض الطلب',
        confirmButtonColor: '#dc2626',
        preConfirm: () => {
            let r = document.getElementById('rejectReason').value.trim();
            if (!r) { Swal.showValidationMessage('⚠️ يرجى كتابة سبب الرفض'); return false; }
            return r;
        }
    });
    if (!isConfirmed) return;
    await database.ref('ninja_data/portal_requests/' + key).update({
        status: 'supervisor_rejected',
        supervisorRejectedBy: window.loggedInUser,
        supervisorRejectedAt: Date.now(),
        supervisorRejectionReason: reason
    });
    logAudit('رفض مشرف لسلفة', driverName, `السبب: ${reason}`);
    renderPortalRequests();
    Swal.fire({ icon: 'info', title: 'تم الرفض من المشرف', timer: 1800, showConfirmButton: false });
}

// ==========================================
// سلفة — مرحلة 2: موافقة الأدمن النهائية
// ==========================================
async function adminApproveAdvance(btn) {
    if (!isAdminOrSuper() && !hasPerm('approveAdvance')) return alert('❌ ليس لديك صلاحية الموافقة النهائية على السلف.');
    let key = btn.dataset.key, driverName = btn.dataset.name, amount = btn.dataset.amount, driverId = btn.dataset.driverid;
    let driverAcc = (window.allRawAccounts || []).find(a => a && String(a.id) === String(driverId));
    let snap = await database.ref('ninja_data/portal_requests/' + key).once('value');
    let req = snap.val() || {};
    let supervisorInfo = req.supervisorApprovedBy
        ? `<div class="mt-2 text-start p-2 rounded" style="background:#e0f2fe;border-right:3px solid #0284c7;">
               <small class="fw-bold d-block" style="color:#0369a1;">موافقة المشرف: ${escHtml(req.supervisorApprovedBy)}</small>
               ${req.supervisorPerformance ? `<small class="text-muted">الأداء: <b>${escHtml(req.supervisorPerformance)}</b></small>` : ''}
               ${req.supervisorNote ? `<small class="text-muted d-block">${escHtml(req.supervisorNote)}</small>` : ''}
           </div>` : '';
    let { isConfirmed, value: note } = await Swal.fire({
        title: '✅ الموافقة النهائية على السلفة',
        html: `<div class="text-center mb-3">
                   <div class="fw-bold fs-5 mb-1">${escHtml(driverName)}</div>
                   <span class="badge bg-warning-subtle text-warning border fs-6 px-4 py-2">💰 ${escHtml(amount)} ريال</span>
               </div>
               ${supervisorInfo}
               <textarea id="approvalNote" class="form-control text-end mt-3" rows="2" placeholder="ملاحظة للمندوب (اختياري)..."></textarea>`,
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        confirmButtonText: '✅ تأكيد الموافقة',
        confirmButtonColor: '#16a34a',
        preConfirm: () => document.getElementById('approvalNote').value.trim()
    });
    if (!isConfirmed) return;
    await database.ref('ninja_data/portal_requests/' + key).update({
        status: 'admin_approved',
        approvedBy: window.loggedInUser,
        approvedAt: Date.now(),
        approvalNote: note || ''
    });
    logAudit('موافقة أدمن على سلفة', driverName, `المبلغ: ${amount} ريال`);
    renderPortalRequests();
    Swal.fire({ icon: 'success', title: '✅ تمت الموافقة النهائية', text: `تمت الموافقة على سلفة ${escHtml(driverName)} بمبلغ ${escHtml(amount)} ريال`, timer: 2500, showConfirmButton: false });
}

async function adminRejectAdvance(btn) {
    if (!isAdminOrSuper() && !hasPerm('approveAdvance')) return alert('❌ ليس لديك صلاحية الرفض النهائي للسلف.');
    let key = btn.dataset.key, driverName = btn.dataset.name;
    let { isConfirmed, value: reason } = await Swal.fire({
        title: '❌ رفض السلفة (الأدمن)',
        html: `<div class="text-muted mb-3">طلب سلفة من: <b class="text-dark">${escHtml(driverName)}</b></div>
               <textarea id="rejectReason" class="form-control text-end" rows="3" placeholder="سبب الرفض (مطلوب)..."></textarea>`,
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        confirmButtonText: '❌ رفض الطلب',
        confirmButtonColor: '#dc2626',
        preConfirm: () => {
            let r = document.getElementById('rejectReason').value.trim();
            if (!r) { Swal.showValidationMessage('⚠️ يرجى كتابة سبب الرفض'); return false; }
            return r;
        }
    });
    if (!isConfirmed) return;
    await database.ref('ninja_data/portal_requests/' + key).update({
        status: 'admin_rejected',
        rejectedBy: window.loggedInUser,
        rejectedAt: Date.now(),
        rejectionReason: reason
    });
    logAudit('رفض أدمن لسلفة', driverName, `السبب: ${reason}`);
    renderPortalRequests();
    Swal.fire({ icon: 'info', title: 'تم الرفض من الأدمن', timer: 1800, showConfirmButton: false });
}

async function replyToRequest(btnOrKey, driverName) {
    let key = (btnOrKey && btnOrKey.dataset) ? btnOrKey.dataset.key : btnOrKey;
    driverName = (btnOrKey && btnOrKey.dataset) ? btnOrKey.dataset.name : driverName;
    if (!hasPerm('edit')) return alert('❌ ليس لديك صلاحية الرد.');
    let { value: reply } = await Swal.fire({
        title: `الرد على طلب ${driverName}`,
        input: 'textarea', inputPlaceholder: 'اكتب ردك هنا...',
        showCancelButton: true, cancelButtonText: 'إلغاء', confirmButtonText: 'إرسال الرد',
        confirmButtonColor: '#4361ee',
    });
    if (!reply || !reply.trim()) return;
    database.ref('ninja_data/portal_requests/' + key).update({ adminReply: reply.trim(), status: 'closed', repliedAt: Date.now() }).then(() => {
        renderPortalRequests();
        logAudit('رد على طلب', 'portal', `الرد على طلب ${driverName}`);
        alert('✅ تم إرسال الرد وتحديث حالة الطلب');
    });
}

function closeRequest(key) {
    database.ref('ninja_data/portal_requests/' + key).update({ status: 'closed' }).then(() => renderPortalRequests());
}

function deleteRequest(key) {
    if (!hasPerm('delete')) return alert('❌ ليس لديك صلاحية الحذف.');
    swalConfirm('حذف هذا الطلب؟', { confirmText:'حذف', confirmColor:'#dc2626' }).then(ok => {
        if (!ok) return;
        database.ref('ninja_data/portal_requests/' + key).remove().then(() => renderPortalRequests());
    });
}

// ==========================================
// قسم التقارير
// ==========================================
let _repSubTab = 'docs';
let _compareChartDrivers = null, _compareChartOrders = null;

function switchReportTab(tab) {
    _repSubTab = tab;
    ['docs','compare','salary','warnings','export'].forEach(t => {
        let p = document.getElementById('repPane_' + t);
        let b = document.getElementById('repTabBtn_' + t);
        if (p) p.style.display = t === tab ? '' : 'none';
        if (b) b.classList.toggle('active', t === tab);
    });
    if (tab === 'docs')     renderDocsExpiryReport();
    if (tab === 'compare')  renderPlatformCompare();
    if (tab === 'salary')   renderSalaryReport();
    if (tab === 'warnings') renderWarningsReport();
}

/* ── تقرير الوثائق المنتهية ── */
function renderDocsExpiryReport() {
    let tbody = document.getElementById('docExpTableBody'); if (!tbody) return;
    let platFilter = (document.getElementById('docExpPlatform')||{}).value || 'all';
    let daysFilter = Number((document.getElementById('docExpDays')||{}).value ?? 30);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3"><div class="spinner-border spinner-border-sm text-danger"></div></td></tr>';

    let today = new Date(); today.setHours(0,0,0,0);
    let cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + daysFilter);

    const DOC_LABELS = { iqama:'الإقامة', light_license:'رخصة نقل خفيف', moto_license:'رخصة دراجة', driver_card:'كرت السائق', health_cert:'الشهادة الصحية', contract:'عقد التشاركي' };
    const PNAMES = { ninja:'🥷 نينجا', keeta:'🚴 كيتا', hunger:'📦 هنقر', jahez:'🛒 جاهز', chefz:'👨‍🍳 شفز' };

    let accounts = (window.allRawAccounts||[]).filter(a => a && (platFilter==='all'||a.platform===platFilter));

    database.ref('ninja_data/driver_docs').once('value').then(snap => {
        let allDocs = snap.val() || {};
        let rows = [];
        accounts.forEach(acc => {
            let docs = allDocs[acc.id] || {};
            Object.entries(DOC_LABELS).forEach(([key, label]) => {
                let d = docs[key] || {};
                if (!d.expiry) return;
                let expDate = new Date(d.expiry); expDate.setHours(0,0,0,0);
                let daysLeft = Math.round((expDate - today) / 86400000);
                if (daysFilter === 0 && daysLeft >= 0) return;
                if (daysFilter > 0 && daysLeft > daysFilter) return;
                rows.push({ acc, label, expDate, daysLeft });
            });
        });
        rows.sort((a,b) => a.daysLeft - b.daysLeft);
        let badge = document.getElementById('docExpCount');
        if (badge) badge.textContent = rows.length + ' حالة';
        if (!rows.length) { tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted py-5"><i class="bi bi-check-circle text-success fs-2 d-block mb-2"></i>لا توجد وثائق منتهية في الفترة المحددة</td></tr>'; return; }
        tbody.innerHTML = rows.map(({acc, label, expDate, daysLeft}) => {
            let statusBadge = daysLeft < 0
                ? `<span class="badge bg-danger">منتهية منذ ${Math.abs(daysLeft)} يوم</span>`
                : `<span class="badge bg-warning text-dark">تنتهي خلال ${daysLeft} يوم</span>`;
            let phone = (acc.phone||'').replace(/\D/g,'');
            let waLink = phone ? `<a href="https://wa.me/${phone.startsWith('0')?'966'+phone.slice(1):phone}?text=${encodeURIComponent('السلام عليكم '+( acc.actualUserName||acc.ownerName)+' — وثيقة ('+label+') تحتاج تجديد')}" target="_blank" class="btn btn-sm btn-outline-success"><i class="bi bi-whatsapp"></i></a>` : '—';
            return `<tr>
                <td class="fw-bold">${escHtml(acc.actualUserName||acc.ownerName||'—')}</td>
                <td>${PNAMES[acc.platform]||acc.platform||'—'}</td>
                <td>${label}</td>
                <td>${expDate.toLocaleDateString('ar-SA')}</td>
                <td>${statusBadge}</td>
                <td class="text-center">${waLink}</td>
            </tr>`;
        }).join('');
    });
}

/* ── مقارنة المنصات ── */
function renderPlatformCompare() {
    let accounts = window.allRawAccounts || [];
    const platforms = ['ninja','keeta','hunger','jahez','chefz'];
    const PNAMES = { ninja:'نينجا', keeta:'كيتا', hunger:'هنقر', jahez:'جاهز', chefz:'شفز' };
    const PCOLORS = ['#4361ee','#f59e0b','#dc2626','#16a34a','#7c3aed'];

    let stats = platforms.map(p => {
        let pAccs = accounts.filter(a => a && a.platform === p);
        let totalOrders = pAccs.reduce((s,a)=>s+Number(a.dailyOrders||0),0);
        let totalCum    = pAccs.reduce((s,a)=>s+Number(a.totalOrders||0),0);
        let wallet      = pAccs.reduce((s,a)=>s+Number(a.wallet||0),0);
        return { p, name:PNAMES[p], count:pAccs.length, totalOrders, totalCum, wallet };
    });

    let summaryEl = document.getElementById('compareSummaryCards');
    if (summaryEl) summaryEl.innerHTML = stats.map((s,i)=>`
        <div class="col-6 col-md-4 col-lg-${Math.floor(12/platforms.length)}">
            <div class="card border-0 shadow-sm rounded-4 p-3 text-center h-100">
                <div class="fw-bold fs-5 mb-1" style="color:${PCOLORS[i]}">${escHtml(s.name)}</div>
                <div class="fs-4 fw-bold">${s.count}</div><div class="text-muted small">مندوب</div>
                <hr class="my-2">
                <div class="fw-bold text-primary">${s.totalOrders}</div><div class="text-muted small">طلبات اليوم</div>
            </div>
        </div>`).join('');

    // Charts
    ['_compareChartDrivers','_compareChartOrders'].forEach(k=>{ if(window[k]){ window[k].destroy(); window[k]=null; } });
    let c1 = document.getElementById('compareChartDrivers');
    let c2 = document.getElementById('compareChartOrders');
    if (c1) {
        window._compareChartDrivers = new Chart(c1, {
            type:'bar',
            data:{ labels:stats.map(s=>s.name), datasets:[{ label:'عدد المناديب', data:stats.map(s=>s.count), backgroundColor:PCOLORS, borderRadius:8, borderWidth:0 }] },
            options:{ plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, ticks:{precision:0}} }, responsive:true, maintainAspectRatio:false }
        });
    }
    if (c2) {
        window._compareChartOrders = new Chart(c2, {
            type:'bar',
            data:{ labels:stats.map(s=>s.name), datasets:[{ label:'طلبات اليوم', data:stats.map(s=>s.totalOrders), backgroundColor:PCOLORS, borderRadius:8, borderWidth:0 }] },
            options:{ plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true, ticks:{precision:0}} }, responsive:true, maintainAspectRatio:false }
        });
    }
}

/* ── كشف الرواتب ── */
function renderSalaryReport() {
    let tbody = document.getElementById('salaryTableBody'); if (!tbody) return;
    let platFilter = (document.getElementById('salPlatformFilter')||{}).value || 'all';
    let search     = ((document.getElementById('salSearch')||{}).value||'').trim().toLowerCase();
    const PNAMES   = { ninja:'🥷 نينجا', keeta:'🚴 كيتا', hunger:'📦 هنقر', jahez:'🛒 جاهز', chefz:'👨‍🍳 شفز' };

    let accounts = (window.allRawAccounts||[]).filter(a => a &&
        (platFilter==='all'||a.platform===platFilter) &&
        (!search||(a.actualUserName||a.ownerName||'').toLowerCase().includes(search)||(a.phone||'').includes(search))
    );

    if (!accounts.length) { tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted py-4">لا توجد نتائج</td></tr>'; return; }

    database.ref('ninja_data/salary_records').once('value').then(snap => {
        let allSalary = snap.val() || {};
        tbody.innerHTML = accounts.map(acc => {
            let records = allSalary[acc.id] ? Object.values(allSalary[acc.id]).filter(r=>r) : [];
            let lastRecord = records.sort((a,b)=>(b.ts||0)-(a.ts||0))[0];
            let totalPaid = records.filter(r=>r.type!=='خصم'&&r.type!=='سلفة').reduce((s,r)=>s+Number(r.netAmount||r.amount||0),0);
            let pendingAdv = records.filter(r=>r.type==='سلفة'&&!r.settled).reduce((s,r)=>s+Number(r.amount||0),0);
            return `<tr>
                <td class="fw-bold">${escHtml(acc.actualUserName||acc.ownerName||'—')}</td>
                <td>${PNAMES[acc.platform]||acc.platform||'—'}</td>
                <td>${lastRecord ? (lastRecord.amount||0)+' ريال — '+(lastRecord.month||lastRecord.date||'') : '—'}</td>
                <td class="text-success fw-bold">${totalPaid.toLocaleString()} ريال</td>
                <td class="${pendingAdv>0?'text-warning fw-bold':''}">${pendingAdv>0?pendingAdv.toLocaleString()+' ريال':'—'}</td>
                <td class="text-center">
                    <button onclick="openSalaryModal('${acc.id}','${(acc.actualUserName||acc.ownerName||'').replace(/'/g,'')}')" class="btn btn-sm btn-outline-success fw-bold"><i class="bi bi-cash-coin me-1"></i>إدارة</button>
                </td>
            </tr>`;
        }).join('');
    });
}

function openSalaryModal(driverId, driverName) {
    document.getElementById('salaryModalDriverId').value = driverId;
    document.getElementById('salaryModalDriverName').textContent = '👤 ' + driverName;
    let today = new Date(); document.getElementById('salMonth').value = today.toISOString().slice(0,7);
    loadSalaryModalRecords(driverId);
    new bootstrap.Modal(document.getElementById('salaryModal')).show();
}

function loadSalaryModalRecords(driverId) {
    let el = document.getElementById('salaryModalList'); if (!el) return;
    el.innerHTML='<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-success"></div></div>';
    database.ref('ninja_data/salary_records/'+driverId).once('value').then(snap=>{
        let records = snap.val() ? Object.entries(snap.val()).map(([k,v])=>({...v,__key:k})).sort((a,b)=>(b.ts||0)-(a.ts||0)) : [];
        if (!records.length) { el.innerHTML='<div class="text-center text-muted py-4">لا يوجد سجل رواتب بعد</div>'; return; }
        const typeColors={ راتب:'#16a34a', سلفة:'#f59e0b', خصم:'#dc2626', مكافأة:'#4361ee', أخرى:'#64748b' };
        el.innerHTML = records.map(r=>{
            let c = typeColors[r.type]||'#64748b';
            let isNeg = r.type==='خصم'||r.type==='سلفة';
            return `<div class="d-flex align-items-center gap-2 p-2 mb-1 rounded-3" style="background:#f8fafc; border-right:3px solid ${c};">
                <div class="flex-grow-1">
                    <span class="fw-bold">${r.month||r.date||'—'}</span>
                    <span class="badge ms-2" style="background:${c}22;color:${c};">${r.type||'راتب'}</span>
                    ${r.notes?`<small class="text-muted ms-2">${escHtml(r.notes)}</small>`:''}
                </div>
                <div class="fw-bold ${isNeg?'text-danger':'text-success'}">${isNeg?'−':'+'} ${Number(r.amount||r.netAmount||0).toLocaleString()} ﷼</div>
                <button onclick="deleteSalaryRecord('${driverId}','${r.__key}')" class="btn btn-sm btn-outline-danger" style="padding:.1rem .4rem;"><i class="bi bi-trash3"></i></button>
            </div>`;
        }).join('');
    });
}

function addSalaryRecord() {
    let driverId = document.getElementById('salaryModalDriverId').value;
    let month  = document.getElementById('salMonth').value;
    let type   = document.getElementById('salType').value;
    let amount = Number(document.getElementById('salAmount').value);
    let notes  = document.getElementById('salNotes').value.trim();
    if (!month || !amount) { alert('⚠️ يرجى ملء الشهر والمبلغ'); return; }
    let rec = { month, type, amount, notes, ts:Date.now(), addedBy:window.loggedInUser||'admin' };
    database.ref('ninja_data/salary_records/'+driverId).push(rec).then(()=>{
        document.getElementById('salAmount').value=''; document.getElementById('salNotes').value='';
        loadSalaryModalRecords(driverId);
        if (_repSubTab==='salary') renderSalaryReport();
        logAudit('إضافة راتب', 'salary', `${type}: ${amount} ريال — ${month}`);
        alert('✅ تمت إضافة السجل');
    });
}

function deleteSalaryRecord(driverId, key) {
    swalConfirm('حذف هذا السجل؟',{confirmText:'حذف',confirmColor:'#dc2626'}).then(ok=>{
        if(!ok)return;
        database.ref('ninja_data/salary_records/'+driverId+'/'+key).remove().then(()=>{
            loadSalaryModalRecords(driverId);
            if (_repSubTab==='salary') renderSalaryReport();
        });
    });
}

/* ── الإنذارات ── */
function renderWarningsReport() {
    let tbody = document.getElementById('warningsTableBody'); if (!tbody) return;
    let platFilter = (document.getElementById('warnPlatformFilter')||{}).value||'all';
    const PNAMES = { ninja:'🥷 نينجا', keeta:'🚴 كيتا', hunger:'📦 هنقر', jahez:'🛒 جاهز', chefz:'👨‍🍳 شفز' };
    let accounts = (window.allRawAccounts||[]).filter(a=>a&&(platFilter==='all'||a.platform===platFilter));
    tbody.innerHTML='<tr><td colspan="6" class="text-center py-3"><div class="spinner-border spinner-border-sm text-warning"></div></td></tr>';
    database.ref('ninja_data/warnings').once('value').then(snap=>{
        let allW = snap.val()||{};
        let rows = accounts.map(acc=>{
            let warns = allW[acc.id] ? Object.values(allW[acc.id]).filter(w=>w) : [];
            return { acc, warns };
        }).filter(r=>r.warns.length>0).sort((a,b)=>b.warns.length-a.warns.length);
        if (!rows.length) { tbody.innerHTML='<tr><td colspan="6" class="text-center text-muted py-5"><i class="bi bi-check-circle text-success fs-2 d-block mb-2"></i>لا توجد إنذارات مسجّلة</td></tr>'; return; }
        tbody.innerHTML = rows.map(({acc,warns})=>{
            let sorted = warns.sort((a,b)=>(b.ts||0)-(a.ts||0));
            let last = sorted[0];
            let countBadge = warns.length >= 3 ? `<span class="badge bg-danger">${warns.length}</span>` : warns.length >= 2 ? `<span class="badge bg-warning text-dark">${warns.length}</span>` : `<span class="badge bg-secondary">${warns.length}</span>`;
            return `<tr>
                <td class="fw-bold">${escHtml(acc.actualUserName||acc.ownerName||'—')}</td>
                <td>${PNAMES[acc.platform]||'—'}</td>
                <td>${countBadge}</td>
                <td>${last.date||new Date(last.ts||0).toLocaleDateString('ar-SA')}</td>
                <td class="text-muted small">${escHtml(last.reason||'—')}</td>
                <td class="text-center">
                    <button onclick="openWarningsModal('${acc.id}','${(acc.actualUserName||acc.ownerName||'').replace(/'/g,'')}')" class="btn btn-sm btn-outline-warning fw-bold"><i class="bi bi-exclamation-triangle me-1"></i>إدارة</button>
                </td>
            </tr>`;
        }).join('');
    });
}

function openWarningsModal(driverId, driverName) {
    document.getElementById('warnModalDriverId').value = driverId;
    document.getElementById('warnModalDriverName').textContent = '👤 ' + driverName;
    document.getElementById('warnReason').value = '';
    loadWarningsModalList(driverId);
    new bootstrap.Modal(document.getElementById('warningsModal')).show();
}

function openWarningsModalForDriver(id, name) { openWarningsModal(id, name); }

function loadWarningsModalList(driverId) {
    let el = document.getElementById('warningsModalList'); if (!el) return;
    el.innerHTML='<div class="text-center py-2"><div class="spinner-border spinner-border-sm text-warning"></div></div>';
    database.ref('ninja_data/warnings/'+driverId).once('value').then(snap=>{
        let warns = snap.val() ? Object.entries(snap.val()).map(([k,v])=>({...v,__key:k})).sort((a,b)=>(b.ts||0)-(a.ts||0)) : [];
        if (!warns.length) { el.innerHTML='<div class="text-center text-muted py-3">لا توجد إنذارات مسجّلة</div>'; return; }
        el.innerHTML = warns.map(w=>`<div class="d-flex align-items-center gap-2 p-2 mb-1 rounded-3" style="background:#fffbeb;border-right:3px solid #f59e0b;">
            <div class="flex-grow-1">
                <div class="fw-bold small">${escHtml(w.reason||'—')}</div>
                <small class="text-muted">${w.date||new Date(w.ts||0).toLocaleDateString('ar-SA')}</small>
            </div>
            <button onclick="deleteWarningRecord('${driverId}','${w.__key}')" class="btn btn-sm btn-outline-danger" style="padding:.1rem .4rem;"><i class="bi bi-trash3"></i></button>
        </div>`).join('');
    });
}

function addWarning() {
    let driverId = document.getElementById('warnModalDriverId').value;
    let reason   = document.getElementById('warnReason').value.trim();
    if (!reason) { alert('⚠️ يرجى كتابة سبب الإنذار'); return; }
    let w = { reason, date:new Date().toLocaleDateString('ar-SA'), ts:Date.now(), addedBy:window.loggedInUser||'admin' };
    database.ref('ninja_data/warnings/'+driverId).push(w).then(()=>{
        document.getElementById('warnReason').value='';
        loadWarningsModalList(driverId);
        if (_repSubTab==='warnings') renderWarningsReport();
        logAudit('إضافة إنذار', 'warnings', `سبب: ${reason}`);
        alert('✅ تم تسجيل الإنذار');
    });
}

function deleteWarningRecord(driverId, key) {
    swalConfirm('حذف هذا الإنذار؟',{confirmText:'حذف',confirmColor:'#dc2626'}).then(ok=>{
        if(!ok)return;
        database.ref('ninja_data/warnings/'+driverId+'/'+key).remove().then(()=>{
            loadWarningsModalList(driverId);
            if (_repSubTab==='warnings') renderWarningsReport();
        });
    });
}

/* ── تصدير متقدم ── */
function runAdvancedExport() {
    let platFilter   = (document.getElementById('expPlatform')||{}).value||'all';
    let statusFilter = (document.getElementById('expStatus')||{}).value||'all';
    let flds = {
        name:       document.getElementById('expFldName')?.checked,
        phone:      document.getElementById('expFldPhone')?.checked,
        daily:      document.getElementById('expFldDaily')?.checked,
        total:      document.getElementById('expFldTotal')?.checked,
        wallet:     document.getElementById('expFldWallet')?.checked,
        hours:      document.getElementById('expFldHours')?.checked,
        status:     document.getElementById('expFldStatus')?.checked,
        supervisor: document.getElementById('expFldSupervisor')?.checked,
    };
    const PNAMES = { ninja:'نينجا', keeta:'كيتا', hunger:'هنقر', jahez:'جاهز', chefz:'شفز' };
    let accounts = (window.allRawAccounts||[]).filter(a => a &&
        (platFilter==='all'||a.platform===platFilter) &&
        (statusFilter==='all'||a.status===statusFilter)
    );

    // Preview
    let prevEl = document.getElementById('exportPreview');
    if (prevEl) {
        prevEl.innerHTML = `<div class="table-responsive" style="max-height:300px;overflow-y:auto;"><table class="table table-sm table-bordered align-middle mb-0 fs-7">
            <thead class="table-light sticky-top"><tr>
                <th>#</th>
                ${flds.name?'<th>الاسم</th>':''}<th>المنصة</th>
                ${flds.phone?'<th>الجوال</th>':''}
                ${flds.daily?'<th>اليومي</th>':''}
                ${flds.total?'<th>التراكمي</th>':''}
                ${flds.wallet?'<th>المحفظة</th>':''}
                ${flds.hours?'<th>الساعات</th>':''}
                ${flds.status?'<th>الحالة</th>':''}
                ${flds.supervisor?'<th>المشرف</th>':''}
            </tr></thead>
            <tbody>
                ${accounts.slice(0,20).map((a,i)=>`<tr>
                    <td>${i+1}</td>
                    ${flds.name?`<td>${escHtml(a.actualUserName||a.ownerName||'—')}</td>`:''}<td>${PNAMES[a.platform]||a.platform||'—'}</td>
                    ${flds.phone?`<td dir="ltr">${a.phone||'—'}</td>`:''}
                    ${flds.daily?`<td>${a.dailyOrders||0}</td>`:''}
                    ${flds.total?`<td>${a.totalOrders||0}</td>`:''}
                    ${flds.wallet?`<td class="${Number(a.wallet)<0?'text-danger':''}">${a.wallet||0}</td>`:''}
                    ${flds.hours?`<td>${a.hours||0}</td>`:''}
                    ${flds.status?`<td>${a.status||'—'}</td>`:''}
                    ${flds.supervisor?`<td>${a.supervisor||'—'}</td>`:''}
                </tr>`).join('')}
            </tbody>
        </table></div>
        <div class="mt-2 text-muted small">${accounts.length} صف إجمالاً${accounts.length>20?' (معاينة أول 20)':''}</div>`;
    }

    // Build CSV
    let header = ['#','المنصة'];
    if (flds.name) header.push('الاسم');
    if (flds.phone) header.push('الجوال');
    if (flds.daily) header.push('طلبات اليوم');
    if (flds.total) header.push('التراكمي');
    if (flds.wallet) header.push('المحفظة');
    if (flds.hours) header.push('الساعات');
    if (flds.status) header.push('الحالة');
    if (flds.supervisor) header.push('المشرف');

    let rows = accounts.map((a,i) => {
        let row = [i+1, PNAMES[a.platform]||a.platform||''];
        if (flds.name) row.push(a.actualUserName||a.ownerName||'');
        if (flds.phone) row.push(a.phone||'');
        if (flds.daily) row.push(a.dailyOrders||0);
        if (flds.total) row.push(a.totalOrders||0);
        if (flds.wallet) row.push(a.wallet||0);
        if (flds.hours) row.push(a.hours||0);
        if (flds.status) row.push(a.status||'');
        if (flds.supervisor) row.push(a.supervisor||'');
        return row;
    });

    let csvContent = '﻿' + [header, ...rows].map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    let blob = new Blob([csvContent], {type:'text/csv;charset=utf-8;'});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href=url; a.download=`speedpro_export_${new Date().toLocaleDateString('ar-SA').replace(/\//g,'-')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    logAudit('تصدير متقدم','export',`${accounts.length} سجل — ${platFilter} — ${statusFilter}`);
}

// ==========================================
// تصنيف المندوب (A/B/C) + بطاقة المندوب 360°
// ==========================================
function getRiderRating(acc) {
    if (!acc) return { grade: '-', score: 0, color: 'secondary', reasons: [] };
    let total = Number(acc.totalOrders) || 0;
    let wallet = Number(acc.wallet) || 0;
    let p = acc.platform || 'ninja';
    let reasons = [];

    if (acc.status === 'موقوف') return { grade: 'C', score: 0, color: 'danger', reasons: [L('موقوف', 'Suspended')] };

    let score = 0;
    // حجم الطلبات (حتى 60 نقطة) — 300 طلب تراكمي = ممتاز
    score += Math.min(60, (total / 300) * 60);

    if (p === 'keeta') {
        let onTime = Number(acc.onTimeRate) || 100;
        let cancel = Number(acc.cancelRate) || 0;
        score += Math.max(0, Math.min(20, ((onTime - 80) / 20) * 20));   // الالتزام بالوقت حتى 20
        score += Math.max(0, Math.min(10, ((10 - cancel) / 10) * 10));   // قلة الإلغاء حتى 10
        if (onTime < 85) reasons.push(L('التزام بالوقت منخفض', 'Low on-time rate'));
        if (cancel > 5) reasons.push(L('نسبة إلغاء مرتفعة', 'High cancel rate'));
    } else {
        score += 25; // رصيد جودة أساسي للمنصات بدون مقاييس تفصيلية
    }

    if (wallet < 0) { score -= Math.min(20, Math.abs(wallet) / 10); reasons.push(L('محفظة سالبة', 'Negative wallet')); }
    if (total < 15)  reasons.push(L('أقل من 15 طلب', 'Under 15 orders'));

    score = Math.max(0, Math.min(100, Math.round(score)));
    let grade = score >= 75 ? 'A' : score >= 45 ? 'B' : 'C';
    let color = grade === 'A' ? 'success' : grade === 'B' ? 'warning' : 'danger';
    return { grade, score, color, reasons };
}

function ratingBadgeHTML(acc) {
    let r = getRiderRating(acc);
    if (r.grade === '-') return '';
    let txt = r.color === 'warning' ? `text-dark` : `text-white`;
    return `<span class="badge bg-${r.color} ${txt} ms-1" title="${L('تصنيف الأداء', 'Performance rating')}: ${r.score}/100">${r.grade}</span>`;
}

// ===== رصد ضعف الأداء المتكرر (نينجا/كيتا/هنقر) =====
const WEAK_PLATFORMS = ['ninja', 'keeta', 'hunger'];
// إعدادات قابلة للتعديل (تُحمّل من Firebase) مع قيم افتراضية
window.weakPerfConfig = window.weakPerfConfig || { threshold: 12, minStreak: 3, autoWarnStreak: 5, autoWarn: false };
function wpCfg() {
    let c = window.weakPerfConfig || {};
    return {
        threshold:      Number(c.threshold) > 0 ? Number(c.threshold) : 12,
        minStreak:      Number(c.minStreak) > 0 ? Number(c.minStreak) : 3,
        autoWarnStreak: Number(c.autoWarnStreak) > 0 ? Number(c.autoWarnStreak) : 5,
        autoWarn:       !!c.autoWarn
    };
}

// يبني قائمة تواريخ التقارير لكل منصة (تنازلياً) من السجل اليومي
function buildPlatformReportDates() {
    let records = window.allDailyRecords || {};
    let idToPlat = {};
    (window.allRawAccounts || []).forEach(a => { if (a) idToPlat[a.id] = a.platform || 'ninja'; });
    let map = { ninja: [], keeta: [], hunger: [] };
    Object.keys(records).sort().forEach(date => {       // تصاعدي
        let seen = {};
        for (let id in records[date]) {
            let pl = idToPlat[id];
            if (map[pl] && !seen[pl]) { map[pl].push(date); seen[pl] = true; }
        }
    });
    Object.keys(map).forEach(k => map[k].reverse());     // تنازلي (الأحدث أولاً)
    return map;
}

// يحسب: streak = أيام ضعف متتالية | totalWeak = إجمالي أيام الضعف (آخر 30) | absentDays/lowDays = سبب الضعف
function getWeakPerf(acc, platformDates) {
    let res = { streak: 0, totalWeak: 0, absentDays: 0, lowDays: 0, dates: [] };
    let p = acc.platform || 'ninja';
    if (!WEAK_PLATFORMS.includes(p)) return res;
    let cfg = wpCfg();
    let records = window.allDailyRecords || {};
    let dates = ((platformDates || buildPlatformReportDates())[p] || []).slice(0, 30);
    let broke = false;
    dates.forEach(date => {
        let rec = (records[date] || {})[acc.id];
        let present = rec !== undefined;                              // وجود سجل = حضر | غيابه = غياب
        let orders = present ? (Number(rec.orders) || 0) : 0;
        let weak = orders < cfg.threshold;
        if (weak) res.totalWeak++;
        if (!broke) {
            if (weak) {
                res.streak++;
                if (present) res.lowDays++; else res.absentDays++;
                res.dates.push({ date, orders, absent: !present });
            } else broke = true;
        }
    });
    return res;
}

function openRiderProfile(id) {
    let acc = (window.allRawAccounts || []).find(a => String(a.id) === String(id));
    if (!acc) return alert(L('لم يتم العثور على المندوب ❌', 'Rider not found ❌'));

    let r = getRiderRating(acc);
    let wp = getWeakPerf(acc);
    let p = acc.platform || 'ninja';
    let pEmoji = p === 'keeta' ? '🚴' : (p === 'hunger' ? '📦' : (p === 'jahez' ? '🛒' : (p === 'chefz' ? '👨‍🍳' : '🥷')));
    let wallet = Number(acc.wallet) || 0;
    let isUsed = acc.status === 'قيد الاستخدام' || acc.status === 'مصروف';
    let statusStr = acc.status === 'موقوف' ? t('status_suspended') : (isUsed ? t('status_in_use') : t('status_available'));
    let statusColor = acc.status === 'موقوف' ? 'danger' : (isUsed ? 'primary' : 'success');

    // وثائق HR المرتبطة
    let hr = (window.allHrData || {})[acc.id] || {};
    let docRow = (label, val) => {
        if (!val) return '';
        let d = daysUntil(val);
        let cls = d === null ? 'secondary' : (d < 0 ? 'danger' : (d <= 30 ? 'warning' : 'success'));
        let note = d === null ? '' : (d < 0 ? L('منتهية', 'Expired') : `${d} ${L('يوم', 'days')}`);
        return `<div class="d-flex justify-content-between border-bottom py-1"><span class="text-muted small">${label}</span><span><b dir="ltr">${val}</b> <span class="badge bg-${cls} ms-1">${escHtml(note)}</span></span></div>`;
    };

    // السكن المرتبط
    let resident = Object.values(window.allHousingResidents || {}).find(rr => rr && String(rr.accountId) === String(acc.id));
    let housingHTML = L('غير مسجّل بالسكن', 'Not in housing');
    if (resident) {
        let unit = (window.allHousingUnits || {})[resident.unitId];
        housingHTML = `${unit ? unit.complexName + ' — ' + unit.unitNumber : resident.unitId} <span class="badge bg-info text-dark ms-1">${resident.status || ''}</span>`;
    }

    // سجل التنقلات
    let logs = (window.allLogsArray || []).filter(lg => lg.id == acc.id).sort((a, b) => new Date(b.endDate) - new Date(a.endDate)).slice(0, 5);
    let logsHTML = logs.length ? logs.map(lg => `<div class="d-flex justify-content-between border-bottom py-1 small"><span><i class="bi bi-arrow-left-right me-1 text-muted"></i>${lg.driver || '-'}</span><span class="text-muted">${lg.startDate} → ${lg.endDate}</span><span><b class="text-success">${lg.totalOrders || 0}</b></span></div>`).join('') : `<div class="text-muted small py-2">${L('لا يوجد سجل سابق', 'No previous history')}</div>`;

    // مقاييس المنصة
    let metricsHTML = '';
    if (p === 'keeta') {
        metricsHTML = `
            <div class="col-4"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${t('th_ontime')}</div><b dir="ltr">${(Number(acc.onTimeRate)||0).toFixed(1)}%</b></div></div>
            <div class="col-4"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${t('th_cancel')}</div><b dir="ltr">${(Number(acc.cancelRate)||0).toFixed(1)}%</b></div></div>
            <div class="col-4"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${t('th_delay')}</div><b dir="ltr">${(Number(acc.delayRate)||0).toFixed(1)}%</b></div></div>`;
    } else if (p === 'hunger') {
        metricsHTML = `
            <div class="col-6"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${t('lbl_km_daily')}</div><b>${Number(acc.kmDaily)||0}</b></div></div>
            <div class="col-6"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${t('lbl_km_total')}</div><b>${Number(acc.kmTotal)||0}</b></div></div>`;
    }

    let body = `
    <div class="row g-3">
        <div class="col-md-5">
            <div class="card-custom p-3 h-100 text-center">
                <div class="mx-auto mb-2 d-flex align-items-center justify-content-center rounded-circle bg-${r.color} ${r.color==='warning'?'text-dark':'text-white'}" style="width:84px;height:84px;font-size:2.2rem;font-weight:800;">${r.grade}</div>
                <h4 class="fw-bold mb-0">${escHtml(acc.actualUserName || acc.ownerName || '-')}</h4>
                <div class="text-muted">${escHtml(acc.ownerName || '')}</div>
                <div class="my-2"><span class="badge bg-dark">${pEmoji} ${t('pname_' + p)}</span> <span class="badge bg-${statusColor}">${statusStr}</span></div>
                <div class="small text-muted">${t('lbl_emp_num')} ${acc.employeeNumber || '-'} · #${acc.id}</div>
                ${(acc.actualIqama || acc.ownerIqama) ? `<div class="small text-muted" dir="ltr">${acc.actualIqama ? `🪪 ${t('form_actual_iqama')}: <b>${acc.actualIqama}</b>` : ''}${acc.actualIqama && acc.ownerIqama ? ' · ' : ''}${acc.ownerIqama ? `🪪 ${t('form_owner_iqama')}: <b>${acc.ownerIqama}</b>` : ''}</div>` : ''}
                <div class="mt-1"><a href="https://wa.me/${(acc.phone||'').replace(/[^0-9]/g,'')}" target="_blank" class="btn btn-sm btn-success"><i class="bi bi-whatsapp"></i> <span dir="ltr">${acc.phone || '-'}</span></a></div>
                <div class="mt-3 p-2 rounded-3 bg-light">
                    <div class="d-flex justify-content-between"><span class="text-muted small">${L('درجة التصنيف', 'Rating score')}</span><b>${r.score}/100</b></div>
                    <div class="progress mt-1" style="height:8px;"><div class="progress-bar bg-${r.color}" style="width:${r.score}%"></div></div>
                    ${r.reasons.length ? `<div class="mt-2 d-flex flex-wrap gap-1 justify-content-center">${r.reasons.map(x=>`<span class="badge bg-danger-subtle text-danger border border-danger">${x}</span>`).join('')}</div>` : `<div class="mt-2"><span class="badge bg-success">${L('لا توجد ملاحظات','No flags')}</span></div>`}
                </div>
                ${WEAK_PLATFORMS.includes(acc.platform||'ninja') && (wp.streak>0 || wp.totalWeak>0) ? `
                <div class="mt-2 p-2 rounded-3 ${wp.streak>=wpCfg().minStreak?'bg-danger text-white':'bg-warning-subtle text-dark border border-warning'}">
                    <div class="fw-bold small"><i class="bi bi-graph-down-arrow me-1"></i>${L('ضعف الأداء','Weak performance')} (< ${wpCfg().threshold})</div>
                    <div class="small">${L('أيام متتالية','Consecutive days')}: <b>${wp.streak}</b> · ${L('تكرار خلال 30','Repeats in 30')}: <b>${wp.totalWeak}</b></div>
                    <div class="small">${L('السبب','Reason')}: ${L('غياب','Absent')} <b>${wp.absentDays}</b> · ${L('أداء ضعيف','Low')} <b>${wp.lowDays}</b></div>
                    ${wp.dates && wp.dates.length ? `<div class="small mt-1">${wp.dates.map(d=>`<span class="badge ${d.absent?'bg-secondary':'bg-light text-dark'} me-1" title="${d.date}">${d.absent?L('غياب','Abs'):d.orders}</span>`).join('')}</div>` : ''}
                    ${wp.streak>=wpCfg().minStreak?`<div class="small mt-1">⚠️ ${L('بلغ حد التنبيه','Reached alert threshold')}</div>`:''}
                </div>` : ''}
            </div>
        </div>
        <div class="col-md-7">
            <div class="row g-2 mb-2">
                <div class="col-4"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${L('طلبات اليوم','Today')}</div><b class="fs-5 text-danger">${String(acc.dailyOrders).includes('غياب')?acc.dailyOrders:(Number(acc.dailyOrders)||0)}</b></div></div>
                <div class="col-4"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${L('التراكمي','Total')}</div><b class="fs-5 text-primary">${Number(acc.totalOrders)||0}</b></div></div>
                <div class="col-4"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${L('الساعات','Hours')}</div><b class="fs-5">${acc.hours||0}</b></div></div>
            </div>
            <div class="row g-2 mb-2">
                <div class="col-6"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${L('المحفظة','Wallet')}</div><b class="fs-5 ${wallet<0?'text-danger':'text-success'}" dir="ltr">${wallet}</b></div></div>
                <div class="col-6"><div class="border rounded-3 p-2 text-center"><div class="text-muted small">${L('وقود شهري','Monthly fuel')}</div><b class="fs-5">${Number(acc.fuelCost||0).toFixed(0)} ${t('currency_sar')}</b></div></div>
            </div>
            ${metricsHTML ? `<div class="row g-2 mb-3">${metricsHTML}</div>` : ''}
            <h6 class="fw-bold mt-2"><i class="bi bi-file-earmark-text me-1"></i>${L('الوثائق','Documents')}</h6>
            <div class="mb-2">${docRow(t('hr_iqama_exp'), hr.iqamaExpiry) || ''}${docRow(t('hr_license_exp'), hr.licenseExpiry) || ''}${docRow(t('hr_contract_exp'), hr.contractExpiry) || ''}${(!hr.iqamaExpiry&&!hr.licenseExpiry&&!hr.contractExpiry)?`<div class="text-muted small py-1">${L('لا توجد وثائق مسجلة','No documents on file')}</div>`:''}</div>
            <h6 class="fw-bold"><i class="bi bi-house-door me-1"></i>${L('السكن','Housing')}</h6>
            <div class="mb-2 small">${housingHTML}</div>
            <h6 class="fw-bold"><i class="bi bi-clock-history me-1"></i>${L('آخر التنقلات','Recent assignments')}</h6>
            <div>${logsHTML}</div>
        </div>
    </div>`;

    document.getElementById('riderProfileBody').innerHTML = body;
    document.getElementById('riderProfileName').innerText = acc.actualUserName || acc.ownerName || '-';
    new bootstrap.Modal(document.getElementById('riderProfileModal')).show();
}

function generateAIInsights(accounts) {
    ['ninja', 'keeta', 'hunger', 'jahez', 'chefz'].forEach(p => {
        let platformAccs = accounts.filter(a => (a.platform || 'ninja') === p);
        if (platformAccs.length === 0) return;
        let availableCount = platformAccs.filter(a => a.status === 'متاح').length; 
        let topDriver = { name: "-", orders: 0 };
        platformAccs.filter(a => a.status === 'قيد الاستخدام' || a.status === 'مصروف').forEach(a => { let dOrders = Number(a.dailyOrders) || 0; if (dOrders > topDriver.orders) { topDriver.name = a.actualUserName; topDriver.orders = dOrders; } });
        let msg = (topDriver.orders > 0 ? `${t('ai_hero_prefix')} <b>${escHtml(topDriver.name)}</b> (${topDriver.orders}) ${t('ai_orders_word')}. ` : '') + (availableCount > 0 ? `<br>${t('ai_available_prefix')} ${availableCount} ${t('ai_available_suffix')}` : t('ai_excellent'));
        let elementId = p === 'ninja' ? 'aiTextNinja' : (p === 'keeta' ? 'aiTextKeeta' : (p === 'hunger' ? 'aiTextHunger' : (p === 'jahez' ? 'aiTextJahez' : 'aiTextChefz')));
        if(document.getElementById(elementId)) document.getElementById(elementId).innerHTML = msg;
    });
}

function toHijri(gregorianDateStr) {
    if (!gregorianDateStr) return '';
    try {
        let d = new Date(gregorianDateStr + 'T12:00:00');
        return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    } catch(e) { return ''; }
}
function syncHijri(gregInputId, hijriInputId) {
    let el = document.getElementById(hijriInputId);
    if (el) el.value = toHijri((document.getElementById(gregInputId) || {}).value || '');
}

// === Hijri Calendar Picker ===
const _HM = ['محرم','صفر','ربيع الأول','ربيع الثاني','جمادى الأولى','جمادى الثانية','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
const _HD = ['أح','إث','ثل','أر','خم','جم','سب'];

function _fromHijri(h) {
    let s = String(h).replace(/[٠-٩]/g, c => c.charCodeAt(0) - 0x0660);
    let m = s.match(/(\d{3,4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (!m) return '';
    let iy = +m[1], im = +m[2], id = +m[3];
    if (iy < 1300 || iy > 1600 || im < 1 || im > 12 || id < 1 || id > 30) return '';
    // Jean Meeus formula: JDN = floor((11Y+3)/30) + 354Y + 30M - floor((M-1)/2) + D + 1948440 - 385
    let jdn = Math.floor((11*iy + 3)/30) + 354*iy + 30*im - Math.floor((im-1)/2) + id + 1948440 - 385;
    let l = jdn + 68569, n = Math.floor(4*l/146097);
    l = l - Math.floor((146097*n+3)/4);
    let i = Math.floor(4000*(l+1)/1461001);
    l = l - Math.floor(1461*i/4) + 31;
    let j = Math.floor(80*l/2447);
    let day = l - Math.floor(2447*j/80);
    let l2 = Math.floor(j/11);
    let month = j + 2 - 12*l2;
    let year = 100*(n-49) + i + l2;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function _toHijriNum(gregStr) {
    if (!gregStr) return '';
    try {
        let d = new Date(gregStr + 'T12:00:00');
        let parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
            year:'numeric', month:'numeric', day:'numeric', numberingSystem:'latn'
        }).formatToParts(d);
        let p = {};
        parts.forEach(x => p[x.type] = x.value);
        return `${p.year}/${String(p.month).padStart(2,'0')}/${String(p.day).padStart(2,'0')}`;
    } catch(e) { return ''; }
}

function _hMonthDays(iy, im) {
    if (im % 2 === 1) return 30;
    if (im === 12) return [2,5,7,10,13,16,18,21,24,26,29].includes(iy % 30) ? 30 : 29;
    return 29;
}

function _openHijriPicker(inp, triggerEl, onCloseCb) {
    document.getElementById('_hPicker')?.remove();
    let nowG  = new Date().toISOString().slice(0, 10);
    let nowH  = _toHijriNum(nowG);
    let curH  = _toHijriNum(inp.value) || nowH;
    let [iy, im] = curH.split('/').map(Number);
    let selH = _toHijriNum(inp.value);

    const popup = document.createElement('div');
    popup.id = '_hPicker';
    popup.style.cssText = 'position:fixed;z-index:999999;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:14px;box-shadow:0 14px 36px rgba(0,0,0,.18);padding:10px 12px 8px;width:256px;font-family:"Cairo",sans-serif;direction:rtl;user-select:none;';
    document.body.appendChild(popup);

    function pos() {
        let r = (triggerEl || inp).getBoundingClientRect();
        let top = r.bottom + 6, left = r.right - 256;
        if (left < 4) left = 4;
        if (top + 275 > window.innerHeight - 4) top = r.top - 275 - 6;
        popup.style.top = top + 'px';
        popup.style.left = Math.max(4, left) + 'px';
    }

    function render() {
        let mDays  = _hMonthDays(iy, im);
        let gFirst = _fromHijri(`${iy}/${String(im).padStart(2,'0')}/01`);
        let wd0    = gFirst ? new Date(gFirst + 'T12:00:00').getDay() : 0;
        let [ny, nm, nd] = nowH.split('/').map(Number);

        let cells = '';
        for (let i = 0; i < wd0; i++) cells += `<div style="width:32px;height:32px;"></div>`;
        for (let d = 1; d <= mDays; d++) {
            let dH  = `${iy}/${String(im).padStart(2,'0')}/${String(d).padStart(2,'0')}`;
            let sel = dH === selH;
            let tod = (iy===ny && im===nm && d===nd);
            let bg  = sel ? 'background:#4361ee;color:#fff;' : tod ? 'color:#4361ee;box-shadow:inset 0 0 0 1.5px #4361ee;' : 'color:#374151;';
            cells += `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;font-size:0.85rem;font-weight:${sel||tod?'800':'500'};${bg}transition:background .1s;" class="_hpc" data-d="${dH}">${d}</div>`;
        }

        popup.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <button type="button" id="_hpPr" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:#4361ee;width:30px;height:30px;border-radius:6px;line-height:1;display:flex;align-items:center;justify-content:center;">›</button>
            <span style="font-weight:800;font-size:0.92rem;color:#1e293b;">${_HM[im-1]} ${iy}</span>
            <button type="button" id="_hpNx" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:#4361ee;width:30px;height:30px;border-radius:6px;line-height:1;display:flex;align-items:center;justify-content:center;">‹</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,32px);justify-content:space-between;gap:2px 0;">
            ${_HD.map(d=>`<div style="width:32px;height:22px;display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:700;color:#94a3b8;">${d}</div>`).join('')}
            ${cells}
        </div>
        <div style="border-top:1px solid #f1f5f9;margin-top:8px;padding-top:5px;text-align:center;">
            <button type="button" id="_hpTd" style="background:none;border:none;color:#4361ee;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:'Cairo',sans-serif;">اليوم</button>
        </div>`;

        pos();

        popup.querySelectorAll('._hpc').forEach(c => {
            c.onmouseenter = () => { if (c.dataset.d !== selH) c.style.background = '#eef0fd'; };
            c.onmouseleave = () => { if (c.dataset.d !== selH) c.style.background = ''; };
            c.onclick = e => {
                e.stopPropagation();
                selH = c.dataset.d;
                let g = _fromHijri(selH);
                if (g) { inp.value = g; inp.dispatchEvent(new Event('change',{bubbles:true})); }
                popup.remove();
                if (onCloseCb) onCloseCb(selH);
            };
        });

        // RTL: › on RIGHT = prev month, ‹ on LEFT = next month
        document.getElementById('_hpPr').onclick = e => { e.stopPropagation(); if(--im<1){im=12;iy--;} render(); };
        document.getElementById('_hpNx').onclick = e => { e.stopPropagation(); if(++im>12){im=1;iy++;} render(); };
        document.getElementById('_hpTd').onclick = e => {
            e.stopPropagation();
            inp.value = nowG; inp.dispatchEvent(new Event('change',{bubbles:true}));
            selH = nowH; [iy, im] = nowH.split('/').map(Number);
            render();
            setTimeout(() => { popup.remove(); if(onCloseCb) onCloseCb(selH); }, 250);
        };
    }

    render();

    setTimeout(() => {
        function _ch(ev) {
            if (!popup.contains(ev.target)) {
                popup.remove();
                if (onCloseCb) onCloseCb(null);
                document.removeEventListener('click', _ch);
            }
        }
        document.addEventListener('click', _ch);
    }, 0);
}

function initHijriToggles(root) {
    (root || document).querySelectorAll('input[type="date"]:not([data-hi])').forEach(inp => {
        inp.dataset.hi = '1';
        let wrap = document.createElement('div');
        wrap.className = 'hijri-date-group';
        inp.parentNode.insertBefore(wrap, inp);
        wrap.appendChild(inp);

        let btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hijri-cal-btn';
        btn.textContent = 'ه';
        btn.title = 'التقويم الهجري';
        wrap.appendChild(btn);

        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (document.getElementById('_hPicker')) {
                document.getElementById('_hPicker').remove();
                btn.classList.remove('on');
                return;
            }
            btn.classList.add('on');
            _openHijriPicker(inp, btn, () => btn.classList.remove('on'));
        });
    });
}

document.addEventListener('shown.bs.modal', e => initHijriToggles(e.target));
document.addEventListener('DOMContentLoaded', () => initHijriToggles());

window._actMenuRegistry = {};

function makeActionDropdown(acc, extraItems = '') {
    let id = String(acc.id);
    window._actMenuRegistry[id] = {
        portalEnabled: acc.portalAccess === true,
        safeName: (acc.actualUserName || acc.ownerName || '').replace(/'/g,'').replace(/"/g,''),
        extraItems: extraItems || ''
    };
    return `<button class="btn btn-sm btn-light border shadow-sm rounded-circle"
                style="width:34px;height:34px;padding:0;line-height:32px;"
                data-actid="${id}" type="button" title="الإجراءات">
            <i class="bi bi-three-dots-vertical" style="font-size:0.85rem;"></i>
        </button>`;
}

function closeActMenu() {
    let m = document.getElementById('_globalActMenu');
    if (m) m.remove();
}

// إغلاق عند الضغط خارج القايمة
document.addEventListener('click', function(e) {
    if (e.target.closest('#_globalActMenu')) return;
    let btn = e.target.closest('[data-actid]');
    if (btn) {
        let id = btn.dataset.actid;
        let existing = document.getElementById('_globalActMenu');
        if (existing && existing.dataset.actid === id) { closeActMenu(); return; }
        closeActMenu();
        let d = window._actMenuRegistry[id];
        if (!d) return;
        let extraHtml = d.extraItems ? d.extraItems + '<hr style="border:0;border-top:1px solid #e5e7eb;margin:4px 0;">' : '';
        let portalIcon = d.portalEnabled ? 'key-fill' : 'key';
        let portalColor = d.portalEnabled ? 'text-success' : 'text-secondary';
        let portalLabel = d.portalEnabled ? 'تعطيل البوابة' : 'تفعيل البوابة';
        let ul = document.createElement('ul');
        ul.id = '_globalActMenu';
        ul.className = 'act-ctx-menu';
        ul.style.cssText = 'position:fixed;z-index:99999;min-width:210px;background:#fff;border:1px solid rgba(0,0,0,.12);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.14);padding:4px 0;list-style:none;margin:0;';
        ul.innerHTML = `${extraHtml}
            <li><button class="act-item" onclick="openRiderProfile('${id}');closeActMenu()"><i class="bi bi-person-vcard me-2 text-info"></i>ملف المندوب 360°</button></li>
            <li><button class="act-item" onclick="togglePortalAccess('${id}');closeActMenu()"><i class="bi bi-${portalIcon} me-2 ${portalColor}"></i>${portalLabel}</button></li>
            <li><button class="act-item" onclick="openSalaryModal('${id}','${d.safeName}');closeActMenu()"><i class="bi bi-cash-coin me-2 text-success"></i>إدارة الراتب</button></li>
            <li><button class="act-item" onclick="openWarningsModal('${id}','${d.safeName}');closeActMenu()"><i class="bi bi-exclamation-triangle me-2 text-warning"></i>الإنذارات</button></li>
            <li><hr style="border:0;border-top:1px solid #e5e7eb;margin:4px 0;"></li>
            <li><button class="act-item" onclick="openEditModal('${id}');closeActMenu()"><i class="bi bi-pencil-fill me-2 text-warning"></i>تعديل البيانات</button></li>
            <li><button class="act-item text-danger" onclick="deleteAccount('${id}');closeActMenu()"><i class="bi bi-trash3 me-2"></i>حذف المندوب</button></li>`;
        ul.dataset.actid = id;
        document.body.appendChild(ul);
        let rect = btn.getBoundingClientRect();
        let menuW = 215;
        let left = rect.right - menuW;
        if (left < 6) left = 6;
        if (left + menuW > window.innerWidth - 6) left = window.innerWidth - menuW - 6;
        let top = rect.bottom + 4;
        if (top + 260 > window.innerHeight) top = rect.top - ul.offsetHeight - 4;
        ul.style.top  = top + 'px';
        ul.style.left = left + 'px';
        return;
    }
    closeActMenu();
});

// [PLATFORMS] عدد أيام تشغيل الحساب مع المندوب من يوم الاستلام (dispatchDate)
function daysActive(acc) {
    if (!acc || !acc.dispatchDate) return null;
    const isUsed = acc.status === 'قيد الاستخدام' || acc.status === 'مصروف';
    if (!isUsed) return null;
    const d = new Date(acc.dispatchDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today - d) / 86400000));
}
function daysActiveBadge(acc) {
    const n = daysActive(acc);
    if (n === null) return '';
    const cls = n >= 90 ? 'bg-success' : n >= 30 ? 'bg-info text-dark' : 'bg-light text-dark border';
    return `<span class="badge ${cls} mt-1" title="${L('عدد أيام التشغيل منذ استلام المندوب للحساب','Days active since the rider received the account')}"><i class="bi bi-calendar-check me-1"></i>${n} ${L('يوم','d')}</span>`;
}

function makeNameCell(acc, ratingBadge) {
    let actual  = acc.actualUserName || '-';
    let owner   = acc.ownerName || '-';
    let empNum  = acc.employeeNumber || '';
    let initial = actual.trim()[0] ? actual.trim()[0].toUpperCase() : '?';
    let ownerSafe = owner.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    let metaParts = [];
    if (empNum) metaParts.push(`<span class="driver-id-badge"><i class="bi bi-person-badge"></i> ${empNum}</span>`);
    metaParts.push(`<span class="driver-id-badge">#${acc.id}</span>`);
    if (acc.plate) metaParts.push(`<span class="driver-id-badge" dir="ltr"><i class="bi bi-car-front-fill"></i> ${escHtml(acc.plate)}</span>`);
    { const _da = daysActive(acc); if (_da !== null) metaParts.push(`<span class="driver-id-badge" title="${L('أيام التشغيل منذ الاستلام','Days since handover')}"><i class="bi bi-calendar-check"></i> ${_da} ${L('يوم','d')}</span>`); }
    return `<div class="driver-name-card">
        <div class="driver-avatar">${initial}</div>
        <div class="driver-name-block">
            <span class="driver-name-actual" dir="auto" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-title="👤 ${ownerSafe}">${actual}</span>${ratingBadge}${acc.contractType === 'كفالة' ? '<span class="badge ms-1" style="background:#0369a1;color:#fff;font-size:0.65em;">🔗 كفالة</span>' : acc.contractType === 'فري لانسر' ? '<span class="badge ms-1" style="background:#7c3aed;color:#fff;font-size:0.65em;">🆓 فري</span>' : ''}
            <span class="driver-name-owner" dir="auto">${escHtml(owner)}</span>
            <div class="driver-name-meta">${metaParts.join('')}</div>
        </div>
    </div>`;
}
// يفصل الاسم المختلط لجزء إنجليزي وجزء عربي
function _splitName(str) {
    str = String(str || '').trim();
    const en = (str.match(/[A-Za-z][A-Za-z.'\- ]*/g) || []).join(' ').replace(/\s+/g, ' ').trim();
    const ar = (str.match(/[؀-ۿ][؀-ۿ ]*/g) || []).join(' ').replace(/\s+/g, ' ').trim();
    return { en, ar };
}

// [JAHEZ] بطاقة ملف أنيقة لخلية بيانات الحساب
function makeJahezProfileCell(acc, ratingBadge) {
    const actual  = acc.actualUserName || '-';
    const owner   = acc.ownerName || '-';
    const aN = _splitName(actual), oN = _splitName(owner);
    const nameLines = (aN.en || aN.ar)
        ? `${aN.en ? `<span class="jz-name-text jz-line-en">${escHtml(aN.en)}</span>` : ''}${aN.ar ? `<span class="jz-name-text jz-line-ar">${escHtml(aN.ar)}</span>` : ''}`
        : `<span class="jz-name-text jz-line-en">${escHtml(actual)}</span>`;
    const subLines = (oN.en || oN.ar)
        ? `${oN.en ? `<span class="jz-line-en">${escHtml(oN.en)}</span>` : ''}${oN.ar ? `<span class="jz-line-ar">${escHtml(oN.ar)}</span>` : ''}`
        : `<span class="jz-line-en">${escHtml(owner)}</span>`;
    const initial = (actual.trim()[0] || '?').toUpperCase();
    const empNum  = acc.employeeNumber || '—';
    const da      = daysActive(acc);
    const joined  = da !== null ? `${da} ${L('يوم','d')}` : '—';
    const contractChip = acc.contractType === 'كفالة'
        ? `<span class="jz-chip" style="background:#0369a1;">🔗 ${L('كفالة','Sponsored')}</span>`
        : acc.contractType === 'فري لانسر'
        ? `<span class="jz-chip" style="background:#7c3aed;">🆓 ${L('فري لانسر','Freelancer')}</span>`
        : '';
    const vType    = acc.vehicleType || 'سيارة';
    const vehicleChip = vType === 'دباب'
        ? `<span class="jz-chip" style="background:#0f766e;">🏍️ ${L('دباب','Bike')}</span>`
        : `<span class="jz-chip" style="background:#0f766e;">🚗 ${L('سيارة','Car')}</span>`;
    const plate    = acc.plate ? escHtml(acc.plate) : '';
    const _showFuel= (acc.platform === 'ninja' || acc.platform === 'keeta' || acc.platform === 'hunger');
    const fuel     = (_showFuel && Number(acc.fuelCost)) ? Number(acc.fuelCost).toFixed(0) : '';
    return `<div class="jz-profile">
        <div class="jz-profile-head">
            <div class="jz-avatar">${escHtml(initial)}</div>
            <div class="jz-profile-names">
                <div class="jz-profile-tag">${L('ملف المندوب','DRIVER PROFILE')}</div>
                <div class="jz-profile-name" title="👤 ${escHtml(owner)}">${nameLines}${ratingBadge ? `<span class="jz-name-badge">${ratingBadge}</span>` : ''}</div>
                <div class="jz-profile-sub">${subLines}</div>
                <div class="jz-chips">${vehicleChip}${contractChip}</div>
            </div>
        </div>
        <div class="jz-profile-meta">
            <div class="jz-meta-item"><i class="bi bi-person-vcard"></i><div><span>${L('الرقم الوظيفي','Staff ID')}</span><b title="${escHtml(empNum)}">${escHtml(empNum)}</b></div></div>
            <div class="jz-meta-item"><i class="bi bi-hash"></i><div><span>${L('رقم الحساب','Unique ID')}</span><b dir="ltr" title="#${escHtml(String(acc.id))}">#${escHtml(String(acc.id))}</b></div></div>
            <div class="jz-meta-item"><i class="bi bi-calendar-check"></i><div><span>${L('مدة التشغيل','Joined')}</span><b title="${joined}">${joined}</b></div></div>
            ${plate ? `<div class="jz-meta-item"><i class="bi bi-car-front-fill"></i><div><span>${L('اللوحة','Plate')}</span><b dir="ltr" title="${plate}">${plate}</b></div></div>` : ''}
            ${fuel ? `<div class="jz-meta-item"><i class="bi bi-fuel-pump"></i><div><span>${L('بنزين/شهر','Fuel/mo')}</span><b title="${fuel}">${fuel} ${L('ر.س','SAR')}</b></div></div>` : ''}
        </div>
    </div>`;
}

function togglePlatformFields() {
    let p = document.getElementById('fieldPlatform').value;
    document.getElementById('keetaMetrics').style.display = p === 'keeta' ? 'flex' : 'none';
    let jahezSaned = document.getElementById('jahezSanedFields');
    if (jahezSaned) jahezSaned.style.display = p === 'jahez' ? 'flex' : 'none'; // [JAHEZ] حركة ساند
    let fuelWrap = document.getElementById('fieldFuelCost') ? document.getElementById('fieldFuelCost').closest('.col-md-4') : null;
    if (fuelWrap) fuelWrap.style.display = (p === 'chefz' || p === 'jahez') ? 'none' : '';
}

// ==========================================
// 5. محرك الوقت الذكي والعمليات الإضافية
// ==========================================
const parseTimeStr = (str) => {
    if (!str) return 0; if (typeof str === 'number') return Number(str.toFixed(2));
    let s = String(str).trim(); if (!isNaN(s)) return Number(parseFloat(s).toFixed(2));
    let total = 0;
    let dMatch = s.match(/(\d+)\s*(يوم|أيام|ايام|day|days)/i); if (dMatch) total += parseInt(dMatch[1]) * 24;
    let hMatch = s.match(/(\d+)\s*(ساعه|ساعة|ساعات|hour|hours)/i); if (hMatch) total += parseInt(hMatch[1]);
    let mMatch = s.match(/(\d+)\s*(دقيقه|دقيقة|دقائق|min|mins)/i); if (mMatch) total += parseInt(mMatch[1]) / 60;
    return Number(total.toFixed(2));
};

function readPerformanceExcel(e) {
    if (!e.target.files[0]) return;
    const file = e.target.files[0];
    e.target.value = '';
    Swal.fire({
        title: L('تاريخ التقرير', 'Report Date'),
        input: 'date',
        inputValue: getTodayStr(),
        showCancelButton: true,
        confirmButtonText: L('استيراد', 'Import'),
        cancelButtonText: L('إلغاء', 'Cancel'),
        confirmButtonColor: '#4f46e5',
        inputAttributes: { required: true }
    }).then(res => {
        if (!res.isConfirmed || !res.value) return;
        let reportDate = res.value;
        const reader = new FileReader();
        reader.onload = (ev) => {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' }); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }); let count = 0; let updates = {};
        
        let uploadedIds = []; // مصفوفة غياب المناديب

        rows.forEach(row => {
            let rowId = ""; let d = 0; let h = 0; let rej = 0; let cancel = 0; let ontime = 100; let delay = 0;
            let dps = 0; let spd = 0; // [JAHEZ] DriverPaidSaned / SanedPaidDriver
            let ph = 0; let phFound = false; // [HUNGER] الساعات المخطط لها
            for(let k in row) {
                let key = String(k).toLowerCase(); let val = row[k]; let nkey = key.replace(/\s+/g, '');
                if(key.includes('يوزر') || key === 'id') rowId = String(val).trim();
                else if(nkey.includes('driverpaidsaned') || (key.includes('المندوب') && key.includes('ساند'))) dps = Number(val) || 0;
                else if(nkey.includes('sanedpaiddriver') || (key.includes('ساند') && key.includes('للمندوب'))) spd = Number(val) || 0;
                else if(nkey.includes('plannedhours') || nkey.includes('scheduledhours') || key.includes('مخطط')) { ph = parseTimeStr(val); phFound = true; }
                else if(key.includes('أداء') || key.includes('daily') || (key.includes('مكتمل') && !key.includes('غير'))) d = Number(val) || 0;
                else if(key.includes('ساع') || key.includes('hours') || key.includes('وقت')) h = parseTimeStr(val);
                else if(key.includes('مرفوض') || key.includes('rejected')) rej = Number(val) || 0;
                else if(key.includes('الغاء') || key.includes('إلغاء') || key.includes('cancel')) cancel = Number(val) || 0;
                else if(key.includes('بالوقت') || key.includes('ontime') || key.includes('التوصيل')) ontime = Number(val) || 100;
                else if(key.includes('تاخير') || key.includes('تأخير') || key.includes('delay')) delay = Number(val) || 0;
            }
            if (rowId) { 
                const a = window.allRawAccounts.find(a => String(a.id) === rowId); 
                if (a && (a.platform||'ninja') === currentPlatformTab) { 
                    uploadedIds.push(String(a.id)); 
                    updates[`ninja_data/accounts/${a.id}/totalOrders`] = (Number(a.totalOrders)||0) + d; updates[`ninja_data/accounts/${a.id}/dailyOrders`] = d; updates[`ninja_data/accounts/${a.id}/hours`] = h; 
                    updates[`ninja_data/daily_records/${reportDate}/${a.id}`] = { orders: d, hours: h };
                    if (currentPlatformTab === 'keeta' || currentPlatformTab === 'hunger' || currentPlatformTab === 'jahez' || currentPlatformTab === 'chefz') { updates[`ninja_data/accounts/${a.id}/rejectedOrders`] = rej; }
                    if (currentPlatformTab === 'keeta') { updates[`ninja_data/accounts/${a.id}/cancelRate`] = cancel; updates[`ninja_data/accounts/${a.id}/onTimeRate`] = ontime; updates[`ninja_data/accounts/${a.id}/delayRate`] = delay; }
                    if (currentPlatformTab === 'jahez') { updates[`ninja_data/accounts/${a.id}/driverPaidSaned`] = dps; updates[`ninja_data/accounts/${a.id}/sanedPaidDriver`] = spd; }
                    if (currentPlatformTab === 'hunger' && phFound) { updates[`ninja_data/accounts/${a.id}/plannedHours`] = ph; }
                    count++; 
                } 
            }
        });

        // تسجيل غياب المناديب الذين لم يتم العثور عليهم في ملف الإكسيل كـ "0 (غياب)" 
        window.allRawAccounts.forEach(a => {
            if (a && (a.platform || 'ninja') === currentPlatformTab && (a.status === 'قيد الاستخدام' || a.status === 'مصروف')) {
                if (!uploadedIds.includes(String(a.id))) {
                    updates[`ninja_data/accounts/${a.id}/dailyOrders`] = "0 (غياب)";
                    updates[`ninja_data/accounts/${a.id}/hours`] = 0;
                    if (currentPlatformTab === 'keeta' || currentPlatformTab === 'hunger' || currentPlatformTab === 'jahez' || currentPlatformTab === 'chefz') { 
                        updates[`ninja_data/accounts/${a.id}/rejectedOrders`] = 0; 
                    }
                }
            }
        });

        database.ref().update(updates).then(() => {
            // تسجيل سجل الرفع اليومي لمنع التكرار
            database.ref(`ninja_data/daily_imports/${reportDate}/${currentPlatformTab}`).set({
                uploadedBy:     window.loggedInUser,
                uploadedByName: (adminUsers[window.loggedInUser] || {}).name || window.loggedInUser,
                uploadedAt:     Date.now(),
                count:          count
            });
            // إزالة موافقة إعادة الرفع إن وُجدت (تم استخدامها)
            database.ref(`ninja_data/report_requests/${reportDate}/${window.loggedInUser}`).once('value').then(s => {
                let rq = s.val();
                if (rq && rq.type === 'reimport') database.ref(`ninja_data/report_requests/${reportDate}/${window.loggedInUser}`).remove();
            });
            logAudit('استيراد أداء', 'Excel', `تم استيراد أداء ${count} مندوب لـ ${reportDate}`);
            alert(`تم تحليل وتحديث أداء ${count} حساب بنجاح! 🎉`);
            location.reload();
        });
        }; reader.readAsArrayBuffer(file);
    });
}

function importDriversOnly(e) {
    if (!e.target.files[0]) return; const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' }); let updates = {}; let count = 0; let isSuperAdmin = (adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin');
            XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }).forEach(row => {
                let id="", ownerName="", actualUserName="", phone="", status="متاح", daily=0, hours=0, total=0, notes="", supervisor=window.loggedInUser, accFuelCost=0, ownerIqama="", actualIqama="", employeeNumber="";
                for(let k in row) {
                    let key = String(k).toLowerCase().trim(); let val = String(row[k]).trim(); if(!val || val === '-') continue;
                    if(key.includes('يوزر') || key === 'id') id = val;
                    else if(key.includes('iqama') && (key.includes('actual') || key.includes('no actual'))) actualIqama = val;
                    else if(key.includes('iqama')) ownerIqama = val;
                    else if(key.includes('employee') || key.includes('موظف')) employeeNumber = val;
                    else if(key.includes('المالك') || key.includes('owner')) ownerName = val;
                    else if(key.includes('فعلي') || key.includes('driver') || key.includes('مستخدم')) actualUserName = val;
                    else if(key.includes('تواصل') || key.includes('phone') || key.includes('جوال')) phone = val;
                    else if(key.includes('حالة') || key === 'status') status = val;
                    else if(key.includes('أداء') || key.includes('daily')) daily = Number(val) || 0;
                    else if(key.includes('hours') || key.includes('ساعات')) hours = parseTimeStr(val);
                    else if(key.includes('تراكمي') || key.includes('total')) total = Number(val) || 0;
                    else if(key.includes('fuel') || key.includes('بنزين')) accFuelCost = Number(val) || 0;
                    else if(key.includes('notes') || key.includes('ملاحظات')) notes = val;
                    else if((key.includes('supervisor') || key.includes('مشرف')) && isSuperAdmin) supervisor = val;
                }
                if (!id && currentPlatformTab === 'chefz' && ownerIqama) id = ownerIqama;
                if (id && id !== "undefined" && id !== "") {
                    let existingAcc = window.allRawAccounts.find(a => String(a.id) === String(id)); let safePlatform = (existingAcc && existingAcc.platform) ? existingAcc.platform : currentPlatformTab;
                    let finalOwner = ownerName || (existingAcc ? existingAcc.ownerName || '' : '');
                    let finalActual = actualUserName || (existingAcc ? existingAcc.actualUserName || '' : '');
                    updates[`ninja_data/accounts/${id}`] = { id: id, ownerName: finalOwner || '-', actualUserName: finalActual || '-', ownerIqama: ownerIqama || (existingAcc ? existingAcc.ownerIqama || '' : ''), actualIqama: actualIqama || (existingAcc ? existingAcc.actualIqama || '' : ''), employeeNumber: employeeNumber || (existingAcc ? existingAcc.employeeNumber || '' : ''), fuelCost: accFuelCost, phone: phone || '-', status: status || 'متاح', dailyOrders: daily, hours: hours, totalOrders: total, notes: notes || '', platform: safePlatform, dispatchDate: existingAcc && existingAcc.dispatchDate ? existingAcc.dispatchDate : ((status === 'قيد الاستخدام' || status === 'مصروف') ? getTodayStr() : ''), supervisor: supervisor }; count++;
                }
            });
            database.ref().update(updates).then(() => { logAudit('استيراد مستخدمين', 'Excel', `تم استيراد بيانات ${count} مستخدم`); alert("تم استيراد قائمة المستخدمين بنجاح! 🎉"); location.reload(); });
        } catch(err) { alert("حدث خطأ أثناء قراءة الملف ❌"); }
    }; reader.readAsArrayBuffer(e.target.files[0]); e.target.value = ''; 
}

// ==========================================
// الأرشيف والتقارير والنوافذ
// ==========================================
function openArchiveModal() {
    if(!window.loggedInUser) return;
    const select = document.getElementById('archiveMonthSelect'); select.innerHTML = `<option value="">${t('arch_loading')}</option>`;
    document.getElementById('archiveDailyDateInput').value = getTodayStr();
    let today = new Date(); let firstOfMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`;
    document.getElementById('archiveRangeFrom').value = firstOfMonth;
    document.getElementById('archiveRangeTo').value = getTodayStr();
    document.getElementById('archivePlatformTitle').innerText = t('tab_' + currentPlatformTab);
    let targetPath = window.viewingSupervisor === 'ALL_SUPERVISORS' ? 'GLOBAL_ARCHIVE' : window.viewingSupervisor;
    database.ref(`ninja_data/archives/${currentPlatformTab}/${targetPath}`).once('value').then(snap => {
        const archives = snap.val(); window.allUserArchives = archives || {}; select.innerHTML = `<option value="">${t('arch_select_month')}</option>`;
        if(archives) { Object.keys(archives).forEach(month => { select.innerHTML += `<option value="${month}">${month}</option>`; }); }
        document.getElementById('archiveTableHead').innerHTML = `<tr><td class="text-muted py-5 fs-5 fw-bold">${t('arch_select_prompt')}</td></tr>`; document.getElementById('archiveTableBody').innerHTML = '';
        new bootstrap.Modal(document.getElementById('archiveModal')).show();
    });
}

function platformDisplayName(platform) {
    return platform === 'keeta' ? 'كيتا' : (platform === 'hunger' ? 'هنقرستيشن' : (platform === 'jahez' ? 'جاهز' : (platform === 'chefz' ? 'ذا شفز' : 'نينجا')));
}

function openFuelModal() {
    const platformName = platformDisplayName(currentPlatformTab);
    const fuelAccounts = getVisibleAccounts(window.allRawAccounts).filter(a => a && (a.platform || 'ninja') === currentPlatformTab);
    let html = ''; let totalFuel = 0;
    fuelAccounts.forEach(acc => {
        let cost = Number(acc.fuelCost || 0);
        totalFuel += cost;
        html += `<tr><td>${platformDisplayName(acc.platform)}</td><td>#${acc.id}</td><td>${escHtml(acc.actualUserName || '-')}</td><td>${acc.employeeNumber || '-'}</td><td>${acc.supervisor || '-'}</td><td dir="ltr">${cost.toFixed(2)}</td></tr>`;
    });
    document.getElementById('fuelModalPlatform').innerText = platformName;
    document.getElementById('fuelTotalAmount').innerText = `${totalFuel.toFixed(2)} ر.س`;
    document.getElementById('fuelTableBody').innerHTML = html || `<tr><td colspan="6" class="text-muted py-4">${t('lbl_fuel_no_data')}</td></tr>`;
    new bootstrap.Modal(document.getElementById('fuelModal')).show();
}

function exportFuelReport() {
    const fuelAccounts = getVisibleAccounts(window.allRawAccounts).filter(a => a && (a.platform || 'ninja') === currentPlatformTab);
    if (fuelAccounts.length === 0) return alert('لا توجد بيانات بنزين لتصديرها لهذا القسم.');
    const data = fuelAccounts.map(acc => ({
        "المنصة": platformDisplayName(acc.platform),
        "رقم اليوزر": acc.id,
        "المندوب الفعلي": acc.actualUserName || '-',
        "رقم الموظف": acc.employeeNumber || '-',
        "المشرف": acc.supervisor || '-',
        "بنزين الشهري (ر.س)": Number(acc.fuelCost || 0).toFixed(2)
    }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Fuel_Report");
    XLSX.writeFile(wb, `FUEL_REPORT_${currentPlatformTab.toUpperCase()}_${getTodayStr()}.xlsx`);
    logAudit('تصدير تقرير البنزين', currentPlatformTab, 'تم تصدير تقرير استهلاك البنزين الشهري');
    alert('تم تصدير تقرير البنزين بنجاح!');
}

function exportPeriodArchiveReport() {
    let from = document.getElementById('archiveRangeFrom').value; let to = document.getElementById('archiveRangeTo').value;
    if (!from || !to) return alert('الرجاء اختيار تاريخ البداية والنهاية!');
    if (from > to) return alert('يجب أن يكون تاريخ البداية قبل تاريخ النهاية!');

    let allRecords = window.allDailyRecords || {};
    let reportData = [];
    Object.keys(allRecords).sort().forEach(date => {
        if (date < from || date > to) return;
        let dayRecords = allRecords[date];
        Object.entries(dayRecords).forEach(([id, rec]) => {
            let acc = window.allRawAccounts.find(a => a && String(a.id) === String(id));
            if (!acc || (acc.platform || 'ninja') !== currentPlatformTab) return;
            reportData.push({
                "التاريخ": date,
                "المنصة": platformDisplayName(currentPlatformTab),
                "رقم اليوزر": id,
                "المندوب الفعلي": acc.actualUserName || '-',
                "رقم الموظف": acc.employeeNumber || '-',
                "بنزين الشهري": Number(acc.fuelCost || 0).toFixed(2),
                "طلبات اليوم": rec.orders || 0,
                "ساعات": rec.hours || 0,
                "الحالة": acc.status || '-',
                "المشرف": acc.supervisor || '-'
            });
        });
    });

    if (reportData.length === 0) return alert('لا توجد سجلات في الفترة المحددة لهذا القسم.');
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportData), "Archive_Period");
    XLSX.writeFile(wb, `${currentPlatformTab.toUpperCase()}_ARCHIVE_${from}_TO_${to}.xlsx`);
    logAudit('تصدير تقرير فترة أرشيف', `${from} إلى ${to}`, `تم تصدير تقرير الفترة للقسم ${currentPlatformTab}`);
    alert('تم استخراج تقرير الفترة بنجاح!');
}

function createMonthlyArchive() {
    let platformAccounts = window.allRawAccounts.filter(a => a && (a.platform || 'ninja') === currentPlatformTab);
    if(platformAccounts.length === 0) return alert('لا توجد بيانات للقسم الحالي لتقفيلها!');
    let monthName = prompt("أدخل اسم الشهر للتقفيل والأرشفة (مثال: مايو 2026):", new Date().toLocaleString('ar-EG', { month: 'long', year: 'numeric' })); if (!monthName) return;
    let targetPath = window.viewingSupervisor === 'ALL_SUPERVISORS' ? 'GLOBAL_ARCHIVE' : window.viewingSupervisor;
    
    database.ref(`ninja_data/archives/${currentPlatformTab}/${targetPath}/${monthName}`).set(platformAccounts).then(() => {
        let updates = {}; 
        platformAccounts.forEach(a => { 
            updates[`ninja_data/accounts/${a.id}/dailyOrders`] = 0; updates[`ninja_data/accounts/${a.id}/totalOrders`] = 0; updates[`ninja_data/accounts/${a.id}/hours`] = 0; updates[`ninja_data/accounts/${a.id}/rejectedOrders`] = 0; 
            if(currentPlatformTab === 'keeta') { updates[`ninja_data/accounts/${a.id}/cancelRate`] = 0; updates[`ninja_data/accounts/${a.id}/onTimeRate`] = 100; updates[`ninja_data/accounts/${a.id}/delayRate`] = 0; }
        });
        database.ref().update(updates).then(() => { logAudit('أرشفة شهرية', monthName, `تم تقفيل شهر ${monthName} للقسم ${currentPlatformTab}`); alert("تم التقفيل وأرشفة بيانات القسم بنجاح وتصفير العدادات! 🎉"); location.reload(); });
    });
}

function exportDailyPlatformReport() {
    const chosenDate = document.getElementById('archiveDailyDateInput').value; if (!chosenDate) return alert("برجاء اختيار التاريخ المراد سحب التقرير له!");
    let dayRecords = window.allDailyRecords[chosenDate] || {}; let reportData = [];
    // Only include active/working accounts in the daily report - exclude 'متاح' and 'موقوف'
    let platformAccounts = window.allRawAccounts.filter(a => a && (a.platform || 'ninja') === currentPlatformTab && (a.status === 'قيد الاستخدام' || a.status === 'مصروف'));
    if (platformAccounts.length === 0) return alert("لا توجد حسابات مسجلة في هذا القسم!");

    platformAccounts.forEach(acc => {
        let dayPerformance = dayRecords[acc.id] || { orders: 0, hours: 0 };
        if (chosenDate === getTodayStr()) { dayPerformance.orders = dayPerformance.orders || acc.dailyOrders || 0; dayPerformance.hours = dayPerformance.hours || acc.hours || 0; }
        let rowData = { "التاريخ": chosenDate, "رقم اليوزر (ID)": acc.id, "المندوب الفعلي": acc.actualUserName || '-', "المالك الأساسي": acc.ownerName || '-', "رقم الجوال": acc.phone || '-', "الحالة الحالية": acc.status || 'متاح', "طلبات اليوم": dayPerformance.orders, "إجمالي الساعات": dayPerformance.hours };
        if (currentPlatformTab === 'keeta' || currentPlatformTab === 'hunger' || currentPlatformTab === 'jahez' || currentPlatformTab === 'chefz') { rowData["الطلبات المرفوضة"] = acc.rejectedOrders || 0; }
        if (currentPlatformTab === 'hunger') { rowData["نوع المركبة"] = acc.vehicleType || 'سيارة'; }
        if (currentPlatformTab === 'keeta') { rowData["نسبة الإلغاء %"] = acc.cancelRate || 0; rowData["التوصيل في الوقت %"] = acc.onTimeRate || 100; rowData["نسبة التأخير %"] = acc.delayRate || 0; }
        rowData["المشرف المسؤول"] = acc.supervisor || 'الإدارة'; rowData["ملاحظات الحساب"] = acc.notes || ''; reportData.push(rowData);
    });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportData), "Daily_Report"); XLSX.writeFile(wb, `${currentPlatformTab.toUpperCase()}_DAILY_TRACKING_${chosenDate}.xlsx`);
    logAudit('تحميل تقرير يومي', chosenDate, `تم تحميل التقرير اليومي للقسم ${currentPlatformTab}`); alert(`تم استخراج شيت التتبع اليومي لقسم ${currentPlatformTab} بنجاح! 🎉`);
}

function viewSelectedArchive() {
    const month = document.getElementById('archiveMonthSelect').value;
    if(!month || !window.allUserArchives[month]) { document.getElementById('archiveTableHead').innerHTML = `<tr><td class="text-muted py-5 fs-5 fw-bold">${t('arch_select_view')}</td></tr>`; document.getElementById('archiveTableBody').innerHTML = ''; currentArchiveData = null; return; }
    currentArchiveData = Object.values(window.allUserArchives[month]).filter(a => a); renderArchiveArchiveTable();
}

function renderArchiveArchiveTable() {
    if (!currentArchiveData) return;
    const thead = document.getElementById('archiveTableHead'); const tbody = document.getElementById('archiveTableBody'); let headHtml = ''; let rowsHtml = '';
    if (currentPlatformTab === 'ninja') {
        headHtml = `<tr><th>${t('arch_th_id')}</th><th>${t('arch_th_user')}</th><th>${t('arch_th_hours')}</th><th>${t('arch_th_orders')}</th><th>${t('arch_th_rating')}</th></tr>`;
        currentArchiveData.forEach(acc => { if (!acc || acc.actualUserName === '-' || acc.status === 'متاح') return; let ordersCount = Number(acc.totalOrders) || 0; let hoursCount = Number(acc.hours) || 0; let ratingStatus = hoursCount >= 200 ? `<span class="badge bg-success">${t('lbl_rating_excellent')}</span>` : `<span class="badge bg-warning text-dark">${t('lbl_rating_low')}</span>`; rowsHtml += `<tr><td><b>#${acc.id}</b></td><td><b class="text-primary">${escHtml(acc.actualUserName)}</b></td><td><b>${hoursCount.toFixed(2)} ${t('lbl_hour')}</b></td><td><b class="text-danger fs-5">${ordersCount} ${t('lbl_order')}</b></td><td>${ratingStatus}</td></tr>`; });
    } else if (currentPlatformTab === 'keeta') {
        headHtml = `<tr><th>${t('arch_th_id')}</th><th>${t('arch_th_user')}</th><th>${t('arch_th_wallet')}</th><th>${t('arch_th_orders_total')}</th><th>${t('arch_th_cancel')}</th><th>${t('arch_th_ontime')}</th><th>${t('arch_th_delay')}</th></tr>`;
        currentArchiveData.forEach(acc => { if (!acc) return; let totalOrders = Number(acc.totalOrders) || 0; let rejected = Number(acc.rejectedOrders) || 0; let wallet = Number(acc.wallet) || 0; let cancel = Number(acc.cancelRate) || 0; let onTime = Number(acc.onTimeRate) || 100; let delay = Number(acc.delayRate) || 0; rowsHtml += `<tr><td><b>#${acc.id}</b></td><td><b class="text-primary">${escHtml(acc.actualUserName)}</b></td><td><b class="${wallet < 0 ? 'text-danger' : 'text-success'}" dir="ltr">${wallet} ريال</b></td><td><span class="badge bg-success">${totalOrders} ${t('lbl_completed')}</span><br><span class="badge bg-danger mt-1">${rejected} ${t('lbl_rejected')}</span></td><td><b class="${cancel > 0 ? 'text-danger' : 'text-success'}">${cancel.toFixed(2)}%</b></td><td><b class="${onTime < 100 ? 'text-danger' : 'text-success'}">${onTime.toFixed(2)}%</b></td><td><b>${delay.toFixed(2)}%</b></td></tr>`; });
    } else if (currentPlatformTab === 'hunger' || currentPlatformTab === 'jahez' || currentPlatformTab === 'chefz') {
        headHtml = `<tr><th>${t('arch_th_id')}</th><th>${t('arch_th_user')}</th><th>${t('arch_th_wallet')}</th><th>${t('arch_th_orders_done')}</th><th>${t('arch_th_rejected')}</th><th>${t('arch_th_hours')}</th></tr>`;
        currentArchiveData.forEach(acc => { if (!acc) return; let totalOrders = Number(acc.totalOrders) || 0; let rejected = Number(acc.rejectedOrders) || 0; let wallet = Number(acc.wallet) || 0; let hoursCount = Number(acc.hours) || 0; rowsHtml += `<tr><td><b>#${acc.id}</b></td><td><b class="text-primary">${escHtml(acc.actualUserName)}</b></td><td><b class="${wallet < 0 ? 'text-danger' : 'text-success'}" dir="ltr">${wallet} ريال</b></td><td><b class="text-success fs-5">${totalOrders}</b></td><td><b class="text-danger fs-5">${rejected}</b></td><td><b>${hoursCount} ${t('lbl_hour')}</b></td></tr>`; });
    }
    thead.innerHTML = headHtml; tbody.innerHTML = rowsHtml || `<tr><td colspan="10" class="text-muted py-4">${t('lbl_no_archive')}</td></tr>`;
}

function filterArchiveAccounts() { let val = document.getElementById('archiveSearchInput').value.toLowerCase(); document.querySelectorAll('#archiveTableBody tr').forEach(r => { if (!r.classList.contains('table-dark')) r.style.display = r.innerText.toLowerCase().includes(val) ? '' : 'none'; }); }
function exportSelectedArchive() { const month = document.getElementById('archiveMonthSelect').value; if(!month || !currentArchiveData) return alert("برجاء اختيار شهر مؤرشف أولاً لتصديره!"); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(currentArchiveData), `Archive_${month}`); XLSX.writeFile(wb, `ARCHIVE_${currentPlatformTab.toUpperCase()}_${month}.xlsx`); logAudit('تصدير أرشيف شهري', month, 'تم تحميل الأرشيف الشهري المكتمل');}

// ==========================================
// [CARS] ربط لوحة السيارة بحسابات التوصيل — كل لوحة بحد أقصى 3 حسابات
// ==========================================
const PLATE_MAX_ACCOUNTS = 3;

// عدد الحسابات المرتبطة بنفس اللوحة (مع استثناء الحساب الحالي قيد التعديل)
function _plateUsageCount(plate, excludeId) {
    if (!plate) return 0;
    return (window.allRawAccounts || []).filter(a => a && a.plate && a.plate === plate && String(a.id) !== String(excludeId)).length;
}

// تعبئة قائمة لوحات السيارات من قسم السيارات داخل نموذج الحساب
function populateAccountPlateDropdown(selectedPlate) {
    const sel = document.getElementById('fieldPlate'); if (!sel) return;
    const excludeId = document.getElementById('formId') ? document.getElementById('formId').value : '';
    const cars = (window.allCars || []).filter(c => c && c.plate);
    const seen = {};
    let opts = `<option value="">${L('— بدون سيارة —', '— No car —')}</option>`;
    cars.forEach(c => {
        if (seen[c.plate]) return; seen[c.plate] = true;
        const used = _plateUsageCount(c.plate, excludeId);
        const remain = PLATE_MAX_ACCOUNTS - used;
        const isSel = c.plate === selectedPlate;
        const full = remain <= 0 && !isSel; // اللوحة المختارة حالياً تظل متاحة
        const label = c.plate + (c.type ? ' — ' + c.type : '') + ` (${Math.max(0, remain)}/${PLATE_MAX_ACCOUNTS})` + (full ? L(' — مكتملة', ' — full') : '');
        opts += `<option value="${escHtml(c.plate)}"${isSel ? ' selected' : ''}${full ? ' disabled' : ''}>${escHtml(label)}</option>`;
    });
    // لوحة قديمة غير موجودة في قسم السيارات — نضيفها حتى لا تُفقد
    if (selectedPlate && !seen[selectedPlate]) {
        opts += `<option value="${escHtml(selectedPlate)}" selected>${escHtml(selectedPlate)}</option>`;
    }
    sel.innerHTML = opts;
    onAccountPlateChange();
}

// تحديث رسالة "متبقي X من 3" عند اختيار لوحة
function onAccountPlateChange() {
    const sel = document.getElementById('fieldPlate'); const out = document.getElementById('platePalRemain');
    if (!sel || !out) return;
    const plate = sel.value;
    if (!plate) { out.innerHTML = ''; return; }
    const excludeId = document.getElementById('formId') ? document.getElementById('formId').value : '';
    const remain = PLATE_MAX_ACCOUNTS - _plateUsageCount(plate, excludeId);
    if (remain <= 0) {
        out.innerHTML = `<span class="text-danger">⚠️ ${L(`هذه السيارة مرتبطة بـ ${PLATE_MAX_ACCOUNTS} حسابات بالفعل`, `This car is already linked to ${PLATE_MAX_ACCOUNTS} accounts`)}</span>`;
    } else {
        out.innerHTML = `<span class="text-success">✅ ${L(`متبقي ${remain} من ${PLATE_MAX_ACCOUNTS} حسابات لهذه السيارة`, `${remain} of ${PLATE_MAX_ACCOUNTS} account slots left for this car`)}</span>`;
    }
}

function openAddModal(platform) {
    if(!hasPerm('add_edit')) return alert('❌ ليس لديك صلاحية إضافة حسابات. تواصل مع الأدمن.');
    document.getElementById('formId').value = ""; document.getElementById('fieldId').value = ""; document.getElementById('fieldId').readOnly = false;
    ['fieldName','fieldActual','fieldOwnerIqama','fieldActualIqama','fieldEmployeeNumber','fieldFuelCost','fieldPhone','fieldDate','fieldNotes','fieldWallet','fieldRejected','fieldCancelRate','fieldDelay'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = id==='fieldWallet'||id==='fieldRejected'||id==='fieldFuelCost'||id==='fieldCancelRate'||id==='fieldDelay'?"0":""; });
    document.getElementById('fieldActual').value = "-"; document.getElementById('fieldStatus').value = "متاح";
    document.getElementById('fieldDaily').value = 0; document.getElementById('fieldHours').value = 0; document.getElementById('fieldTotal').value = 0; document.getElementById('fieldOnTime').value = "100.00";
    if(document.getElementById('fieldKmTotal')) document.getElementById('fieldKmTotal').value = 0;
    if(document.getElementById('fieldPlannedHours')) document.getElementById('fieldPlannedHours').value = 0;
    if(document.getElementById('fieldIgnoreDaily')) document.getElementById('fieldIgnoreDaily').value = 0;
    if(document.getElementById('fieldIgnoreMonthly')) document.getElementById('fieldIgnoreMonthly').value = 0;
    if(document.getElementById('fieldRejectedDaily')) document.getElementById('fieldRejectedDaily').value = 0;
    let isAddSuper = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin';
    let platSelAdd = document.getElementById('fieldPlatform');
    platSelAdd.value = platform || 'ninja';
    platSelAdd.disabled = !isAddSuper;
    platSelAdd.title = isAddSuper ? '' : '🔒 تغيير المنصة متاح للأدمن فقط';
    if(document.getElementById('fieldVehicleType')) document.getElementById('fieldVehicleType').value = 'سيارة';
    if(document.getElementById('fieldContractType')) document.getElementById('fieldContractType').value = '';
    if(document.getElementById('fieldDriverPaidSaned')) document.getElementById('fieldDriverPaidSaned').value = 0;
    if(document.getElementById('fieldSanedPaidDriver')) document.getElementById('fieldSanedPaidDriver').value = 0;
    if(isAddSuper) { document.getElementById('supervisorTransferDiv').style.display = 'block'; let sel = document.getElementById('fieldSupervisor'); sel.innerHTML = `<option value="${window.loggedInUser}">${window.loggedInUser} (${t('lbl_current_custody')})</option>`; for(let u in adminUsers) { if(u !== window.loggedInUser) sel.innerHTML += `<option value="${u}">${u}</option>`; } sel.value = window.loggedInUser; } else { document.getElementById('supervisorTransferDiv').style.display = 'none'; }
    populateAccountPlateDropdown(''); // [CARS] لوحات السيارات المتاحة
    togglePlatformFields();
    new bootstrap.Modal(document.getElementById('formModal')).show();
}

function openEditModal(id) {
    const acc = window.allRawAccounts.find(a => a && a.id == id); if(!acc) return;
    document.getElementById('formId').value = acc.id; document.getElementById('fieldId').value = acc.id; document.getElementById('fieldId').readOnly = true;
    document.getElementById('fieldName').value = acc.ownerName || ''; document.getElementById('fieldActual').value = acc.actualUserName || ''; if(document.getElementById('fieldOwnerIqama')) document.getElementById('fieldOwnerIqama').value = acc.ownerIqama || ''; if(document.getElementById('fieldActualIqama')) document.getElementById('fieldActualIqama').value = acc.actualIqama || ''; document.getElementById('fieldEmployeeNumber').value = acc.employeeNumber || ''; document.getElementById('fieldFuelCost').value = acc.fuelCost || 0; document.getElementById('fieldPhone').value = acc.phone || ''; document.getElementById('fieldStatus').value = acc.status || 'متاح'; document.getElementById('fieldPlatform').value = acc.platform || 'ninja'; document.getElementById('fieldWallet').value = acc.wallet || 0; document.getElementById('fieldRejected').value = acc.rejectedOrders || 0; document.getElementById('fieldCancelRate').value = acc.cancelRate || "0.00"; document.getElementById('fieldOnTime').value = acc.onTimeRate || "100.00"; document.getElementById('fieldDelay').value = acc.delayRate || "0.00"; document.getElementById('fieldDaily').value = acc.dailyOrders || 0; document.getElementById('fieldHours').value = acc.hours || 0; document.getElementById('fieldTotal').value = acc.totalOrders || 0; document.getElementById('fieldNotes').value = acc.notes || '';
    let isEditSuper = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin';
    if(isEditSuper) { document.getElementById('supervisorTransferDiv').style.display = 'block'; let sel = document.getElementById('fieldSupervisor'); sel.innerHTML = `<option value="${window.loggedInUser}">${window.loggedInUser} (${t('lbl_current_custody')})</option>`; for(let u in adminUsers) { if(u !== window.loggedInUser) sel.innerHTML += `<option value="${u}">${u}</option>`; } sel.value = acc.supervisor || window.loggedInUser; } else { document.getElementById('supervisorTransferDiv').style.display = 'none'; }
    // قفل تغيير المنصة للمشرفين العاديين
    let platSel = document.getElementById('fieldPlatform');
    platSel.disabled = !isEditSuper;
    platSel.title = isEditSuper ? '' : '🔒 تغيير المنصة متاح للأدمن فقط';
    document.getElementById('fieldDate').value = acc.dispatchDate || '';
    if(document.getElementById('fieldVehicleType')) document.getElementById('fieldVehicleType').value = acc.vehicleType || 'سيارة';
    if(document.getElementById('fieldContractType')) document.getElementById('fieldContractType').value = acc.contractType || '';
    if(document.getElementById('fieldDriverPaidSaned')) document.getElementById('fieldDriverPaidSaned').value = acc.driverPaidSaned || 0;
    if(document.getElementById('fieldSanedPaidDriver')) document.getElementById('fieldSanedPaidDriver').value = acc.sanedPaidDriver || 0;
    if(document.getElementById('fieldKmTotal')) document.getElementById('fieldKmTotal').value = acc.kmTotal || 0;
    if(document.getElementById('fieldPlannedHours')) document.getElementById('fieldPlannedHours').value = acc.plannedHours || 0;
    if(document.getElementById('fieldIgnoreDaily')) document.getElementById('fieldIgnoreDaily').value = acc.ignoreDaily || 0;
    if(document.getElementById('fieldIgnoreMonthly')) document.getElementById('fieldIgnoreMonthly').value = acc.ignoreMonthly || 0;
    if(document.getElementById('fieldRejectedDaily')) document.getElementById('fieldRejectedDaily').value = acc.rejectedDaily || 0;
    if(document.getElementById('fieldRejected')) document.getElementById('fieldRejected').value = acc.rejectedTotal || acc.rejectedOrders || 0;
    populateAccountPlateDropdown(acc.plate || ''); // [CARS] اللوحة المرتبطة بالحساب
    togglePlatformFields(); new bootstrap.Modal(document.getElementById('formModal')).show();
}

function saveFormData() {
    const newId = document.getElementById('fieldId').value; if(!newId) return alert("الرجاء إدخال رقم اليوزر!");
    let existing = document.getElementById('formId').value ? window.allRawAccounts.find(a => a && a.id == document.getElementById('formId').value) : null;
    const newStatus = document.getElementById('fieldStatus').value; let newActualUser = document.getElementById('fieldActual').value || '-';
    let isSaveSuper = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin';
    // منع تغيير المنصة للمشرفين العاديين — يظل الحساب على منصته الأصلية
    let p = isSaveSuper ? document.getElementById('fieldPlatform').value : (existing ? existing.platform : currentPlatformTab);
    let assignTo = window.loggedInUser;
    if(isSaveSuper && document.getElementById('supervisorTransferDiv').style.display === 'block') { assignTo = document.getElementById('fieldSupervisor').value; } else if (existing) { assignTo = existing.supervisor || window.loggedInUser; }

    let accData = { id: newId, ownerName: document.getElementById('fieldName').value || '', actualUserName: newActualUser, ownerIqama: (document.getElementById('fieldOwnerIqama') ? document.getElementById('fieldOwnerIqama').value.trim() : '') || '', actualIqama: (document.getElementById('fieldActualIqama') ? document.getElementById('fieldActualIqama').value.trim() : '') || '', employeeNumber: document.getElementById('fieldEmployeeNumber').value.trim() || '', fuelCost: Number(document.getElementById('fieldFuelCost').value) || 0, phone: document.getElementById('fieldPhone').value || '-', status: newStatus, dailyOrders: (existing ? existing.dailyOrders : 0), hours: Number(document.getElementById('fieldHours').value) || 0, totalOrders: Number(document.getElementById('fieldTotal').value) || 0, notes: document.getElementById('fieldNotes').value || '', platform: p, wallet: Number(document.getElementById('fieldWallet').value) || 0, rejectedOrders: Number(document.getElementById('fieldRejected').value) || 0, cancelRate: Number(document.getElementById('fieldCancelRate').value) || 0, onTimeRate: Number(document.getElementById('fieldOnTime').value) || 100, delayRate: Number(document.getElementById('fieldDelay').value) || 0, dispatchDate: newStatus === 'قيد الاستخدام' ? (document.getElementById('fieldDate').value || (existing && existing.dispatchDate ? existing.dispatchDate : getTodayStr())) : '', supervisor: assignTo };

    // extra fields: vehicle type, km total, ignore counts, rejected daily/total
    accData.vehicleType = document.getElementById('fieldVehicleType') ? document.getElementById('fieldVehicleType').value : (existing ? existing.vehicleType : 'سيارة');
    accData.contractType = document.getElementById('fieldContractType') ? document.getElementById('fieldContractType').value : (existing ? existing.contractType || '' : '');
    accData.plannedHours = Number(document.getElementById('fieldPlannedHours') ? document.getElementById('fieldPlannedHours').value : (existing ? existing.plannedHours : 0)) || 0;
    accData.kmTotal = Number(document.getElementById('fieldKmTotal') ? document.getElementById('fieldKmTotal').value : (existing ? existing.kmTotal : 0)) || 0;
    accData.ignoreDaily = Number(document.getElementById('fieldIgnoreDaily') ? document.getElementById('fieldIgnoreDaily').value : (existing ? existing.ignoreDaily : 0)) || 0;
    accData.ignoreMonthly = Number(document.getElementById('fieldIgnoreMonthly') ? document.getElementById('fieldIgnoreMonthly').value : (existing ? existing.ignoreMonthly : 0)) || 0;
    accData.rejectedDaily = Number(document.getElementById('fieldRejectedDaily') ? document.getElementById('fieldRejectedDaily').value : (existing ? existing.rejectedDaily : 0)) || 0;
    accData.rejectedTotal = Number(document.getElementById('fieldRejected') ? document.getElementById('fieldRejected').value : (existing ? existing.rejectedTotal : 0)) || 0;
    accData.rejectedOrders = accData.rejectedTotal; // legacy compatibility

    // [CARS] لوحة السيارة المرتبطة بالحساب
    accData.plate = document.getElementById('fieldPlate') ? document.getElementById('fieldPlate').value.trim() : (existing ? existing.plate || '' : '');

    // [JAHEZ] حركة ساند — تُخزَّن لجاهز فقط، وتُحفَظ القيم القديمة لباقي المنصات
    if (p === 'jahez') {
        accData.driverPaidSaned = Number((document.getElementById('fieldDriverPaidSaned') || {}).value) || 0;
        accData.sanedPaidDriver = Number((document.getElementById('fieldSanedPaidDriver') || {}).value) || 0;
    } else if (existing) {
        if (existing.driverPaidSaned != null) accData.driverPaidSaned = existing.driverPaidSaned;
        if (existing.sanedPaidDriver != null) accData.sanedPaidDriver = existing.sanedPaidDriver;
    }

    // [DEDUP] منع تكرار الرقم الوظيفي / رقم الجوال / الاسم داخل نفس المنصة
    {
        const dupAcc = (window.allRawAccounts || []).find(a => {
            if (!a || String(a.id) === String(newId)) return false;
            if ((a.platform || 'ninja') !== p) return false;
            const sameEmp   = accData.employeeNumber && a.employeeNumber && String(a.employeeNumber).trim() === String(accData.employeeNumber).trim();
            const samePhone = accData.phone && accData.phone !== '-' && String(a.phone).trim() === String(accData.phone).trim();
            const sameName  = accData.actualUserName && accData.actualUserName !== '-' && String(a.actualUserName).trim() === String(accData.actualUserName).trim();
            return sameEmp || samePhone || sameName;
        });
        if (dupAcc) {
            let field = '';
            if (accData.employeeNumber && String(dupAcc.employeeNumber).trim() === String(accData.employeeNumber).trim()) field = 'الرقم الوظيفي';
            else if (accData.phone !== '-' && String(dupAcc.phone).trim() === String(accData.phone).trim()) field = 'رقم الجوال';
            else field = 'الاسم';
            return alert(`❌ ${field} مكرر داخل منصة "${platformDisplayName(p)}" (الحساب #${dupAcc.id} — ${dupAcc.actualUserName || dupAcc.ownerName || ''}). لا يمكن تكرار نفس البيانات في نفس المنصة.`);
        }
    }

    // [CARS] منع ربط أكثر من 3 حسابات بنفس السيارة
    if (accData.plate) {
        const used = _plateUsageCount(accData.plate, newId);
        if (used >= PLATE_MAX_ACCOUNTS) {
            return alert(`❌ السيارة (${accData.plate}) مرتبطة بـ ${PLATE_MAX_ACCOUNTS} حسابات بالفعل. اختر سيارة أخرى.`);
        }
    }

    // hunger wallet threshold alert (debt beyond 150) with deduplication
    let hungerAlertKey = null; let hungerAlertObj = null; let setWalletAlertStamp = false;
    if (p === 'hunger') {
        const walletVal = Number(accData.wallet) || 0;
        // trigger if balance above +150 or debt beyond -150
        const thresholdExceeded = (walletVal > 150) || (walletVal < 0 && Math.abs(walletVal) >= 150);
        // check existing alert timestamp to avoid spamming alerts (7 days)
        const alertAlreadySent = existing && existing.walletAlertSentAt;
        let alreadyRecent = false;
        if (alertAlreadySent) {
            try { alreadyRecent = (Date.now() - new Date(alertAlreadySent).getTime()) < (7 * 24 * 60 * 60 * 1000); } catch(e) { alreadyRecent = true; }
        }
        if (thresholdExceeded && !alreadyRecent) {
            hungerAlertKey = Date.now() + '_' + newId;
            hungerAlertObj = { id: hungerAlertKey, accountId: newId, accountName: accData.ownerName, phone: accData.phone, wallet: accData.wallet, createdAt: new Date().toISOString(), type: 'wallet_overflow', message: `رصيد المحفظة لديك ${accData.wallet} ر.س؛ تجاوز الحد المسموح 150 ر.س. الرجاء الشحن لتجنب الإيقاف.` };
            // mark account with a sent timestamp so next edits don't recreate immediately
            accData.walletAlertSentAt = new Date().toISOString();
            setWalletAlertStamp = true;
        }
    }

    let updates = {}; let isClosing = existing && (existing.status === 'قيد الاستخدام' || existing.status === 'مصروف') && newStatus === 'متاح';
    if (isClosing || (existing && existing.actualUserName !== '-' && existing.actualUserName !== newActualUser)) {
        let _plat = existing.platform || 'ninja';
        let logEntry = { id: newId, driver: existing.actualUserName, startDate: existing.dispatchDate || '-', endDate: getTodayStr(), totalOrders: existing.totalOrders || 0, rejected: existing.rejectedOrders || 0, wallet: existing.wallet || 0, supervisor: existing.supervisor || window.loggedInUser, platform: _plat };
        if (_plat === 'hunger' || _plat === 'keeta') logEntry.km = Number(existing.kmTotal || 0);
        updates['ninja_data/logs/' + Date.now() + '_' + newId] = logEntry; if(isClosing) { accData.actualUserName = '-'; accData.dispatchDate = ''; accData.dailyOrders = 0; accData.rejectedOrders = 0; }
    }
    updates['ninja_data/accounts/' + newId] = accData;
    if (hungerAlertObj) updates['ninja_data/alerts/' + hungerAlertKey] = hungerAlertObj;
    // حفظ حالة التراجع قبل الكتابة
    let _undoSave = {}; _undoSave['ninja_data/accounts/' + newId] = existing ? { ...existing } : null;
    pushUndoState((existing ? 'تعديل' : 'إضافة') + ` حساب "${accData.ownerName || newId}" #${newId}`, _undoSave);
    database.ref().update(updates).then(() => {
        logAudit(existing ? 'تعديل بيانات' : 'إنشاء حساب جديد', newId, `تم حفظ بيانات المندوب (${newActualUser})`);
        let modalInst = bootstrap.Modal.getInstance(document.getElementById('formModal')); if(modalInst) modalInst.hide(); alert("تم حفظ البيانات بنجاح ✅"); 
        // send WhatsApp warning if hunger alert created
        if (hungerAlertObj && hungerAlertObj.phone && hungerAlertObj.phone !== '-') {
            const phoneNorm = normalizeSaudiPhone(hungerAlertObj.phone);
            const msg = `أهلاً ${hungerAlertObj.accountName}، رصيد محفظتك ${hungerAlertObj.wallet} ر.س وتجاوز الحد المسموح (150 ر.س). يرجى شحن المحفظة فوراً لتجنب إيقاف الحساب.`;
            const waNumber = phoneNorm ? phoneNorm.replace(/^966/, '') : hungerAlertObj.phone.replace(/\D/g,'');
            window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank');
        }
    });
}

function viewHistory(id) { 
    const modalBody = document.getElementById('historyTableBody'); let relatedLogs = window.allLogsArray.filter(log => log.id == id);
    // show/hide delete buttons depending on admin
    const isAdmin = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin';
    document.getElementById('deleteSelectedHistoryBtn').style.display = isAdmin ? 'inline-block' : 'none';
    document.getElementById('deleteAllHistoryBtn').style.display = isAdmin ? 'inline-block' : 'none';
    if(relatedLogs.length === 0) { modalBody.innerHTML = `<tr><td colspan="9" class="text-muted py-5 fs-5">${t('lbl_no_history')}</td></tr>`; }
    else {
        relatedLogs.sort((a,b) => new Date(b.endDate) - new Date(a.endDate)); let html = '';
        relatedLogs.forEach(log => {
            let w = Number(log.wallet) || 0; let wStr = w < 0 ? `<b class="text-danger" dir="ltr">${w}</b>` : `<b class="text-success" dir="ltr">${w}</b>`;
            let pEmoji = log.platform === 'keeta' ? '🚴' : (log.platform === 'hunger' ? '📦' : (log.platform === 'jahez' ? '🛒' : (log.platform === 'chefz' ? '👨‍🍳' : '🥷')));
            let pIcon = `${pEmoji} ${t('pname_' + (log.platform || 'ninja'))}`;
            let key = log.__key || '';
            let hasKm = (log.platform === 'hunger' || log.platform === 'keeta');
            let kmCell = hasKm ? `<span class="badge bg-info fs-6"><i class="bi bi-speedometer2 me-1"></i>${Number(log.km || 0).toLocaleString()} كم</span>` : `<span class="text-muted">—</span>`;
            html += `<tr>
                <td><input type="checkbox" class="form-check-input history-cb" data-key="${key}" onchange="updateHistorySelectionUI()"></td>
                <td><span class="badge bg-dark">${pIcon}</span></td>
                <td><b class="text-primary fs-5">${log.driver || '-'}</b></td>
                <td><span class="badge bg-secondary fs-6">${log.startDate}</span></td>
                <td><span class="badge bg-danger fs-6">${log.endDate}</span></td>
                <td>${wStr}</td>
                <td><b class="text-success">${log.totalOrders || 0}</b> / <b class="text-danger">${log.rejected || 0}</b></td>
                <td>${kmCell}</td>
                <td><span class="badge bg-dark text-warning"><i class="bi bi-person"></i> ${log.supervisor || '-'}</span></td>
            </tr>`;
        });
        modalBody.innerHTML = html;
    }
    document.getElementById('historySelectAll').checked = false;
    updateHistorySelectionUI();
    new bootstrap.Modal(document.getElementById('historyModal')).show(); 
}

function toggleHistorySelectAll(el) {
    document.querySelectorAll('.history-cb').forEach(cb => { cb.checked = el.checked; });
    updateHistorySelectionUI();
}

function updateHistorySelectionUI() {
    const anyChecked = Array.from(document.querySelectorAll('.history-cb')).some(c => c.checked);
    const btn = document.getElementById('deleteSelectedHistoryBtn');
    const isAdmin = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin';
    if(btn) btn.style.display = (anyChecked && isAdmin) ? 'inline-block' : 'none';
}

function deleteSelectedHistory() {
    if (!(adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin')) return Swal.fire({ icon: 'error', title: L('غير مسموح', 'Not Allowed'), text: L('هذه الخاصية للمشرف فقط.', 'This feature is for super admin only.') });
    const keys = Array.from(document.querySelectorAll('.history-cb')).filter(c => c.checked).map(c => c.getAttribute('data-key')).filter(k => k);
    if (keys.length === 0) return Swal.fire({ icon: 'info', title: L('لم يتم الاختيار', 'Nothing Selected'), text: L('الرجاء اختيار سجل واحد على الأقل للحذف.', 'Please select at least one record to delete.') });
    Swal.fire({
        title: L(`هل أنت متأكد من حذف ${keys.length} سجل؟`, `Delete ${keys.length} record(s)?`),
        text: L('هذا سيحذف السجلات نهائياً ولا يمكن التراجع عنه.', 'This will permanently delete the records and cannot be undone.'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: L('نعم، احذف', 'Yes, Delete'),
        cancelButtonText: L('إلغاء', 'Cancel')
    }).then(res => {
        if (!res.isConfirmed) return;
        let updates = {};
        keys.forEach(k => { updates[`ninja_data/logs/${k}`] = null; logAudit('حذف سجل', k, `تم حذف سجل لليوزر بواسطة ${window.loggedInUser}`); });
        database.ref().update(updates).then(() => { Swal.fire({ icon: 'success', title: L('تم', 'Done'), text: L('تم حذف السجلات المحددة بنجاح.', 'Selected records deleted successfully.') }); bootstrap.Modal.getInstance(document.getElementById('historyModal')).hide(); }).catch(err => { console.error('deleteSelectedHistory error', err); Swal.fire({ icon: 'error', title: L('خطأ', 'Error'), text: L('حدث خطأ أثناء الحذف', 'An error occurred while deleting') }); });
    });
}

function deleteAllHistory() {
    if (!(adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin')) return Swal.fire({ icon: 'error', title: L('غير مسموح', 'Not Allowed'), text: L('هذه الخاصية للمشرف فقط.', 'This feature is for super admin only.') });
    const keys = Array.from(document.querySelectorAll('.history-cb')).map(c => c.getAttribute('data-key')).filter(k => k);
    if (keys.length === 0) return Swal.fire({ icon: 'info', title: L('لا سجلات', 'No Records'), text: L('لا توجد سجلات لحذفها.', 'There are no records to delete.') });
    Swal.fire({
        title: L(`هل أنت متأكد من حذف كل السجلات المعروضة (${keys.length})؟`, `Delete all displayed records (${keys.length})?`),
        text: L('هذا سيحذفهم نهائياً ولا يمكن التراجع عنه.', 'This will permanently delete them and cannot be undone.'),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: L('نعم، احذف الكل', 'Yes, Delete All'),
        cancelButtonText: L('إلغاء', 'Cancel')
    }).then(res => {
        if (!res.isConfirmed) return;
        let updates = {}; keys.forEach(k => { updates[`ninja_data/logs/${k}`] = null; logAudit('حذف كل السجلات', k, `تم حذف سجل بواسطة ${window.loggedInUser}`); });
        database.ref().update(updates).then(() => { Swal.fire({ icon: 'success', title: L('تم', 'Done'), text: L('تم حذف كل السجلات المعروضة بنجاح.', 'All displayed records deleted successfully.') }); bootstrap.Modal.getInstance(document.getElementById('historyModal')).hide(); }).catch(err => { console.error('deleteAllHistory error', err); Swal.fire({ icon: 'error', title: L('خطأ', 'Error'), text: L('حدث خطأ أثناء الحذف', 'An error occurred while deleting') }); });
    });
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

function sendWhatsAppMessage(phone, orders) {
    if(!phone || phone === '-' || phone.length < 9) return alert("رقم الجوال غير صحيح ❌");
    let text = orders === 0
        ? `أهلاً بك كابتن،\nمعك إدارة التشغيل (نينجا). لم يتم رصد أي طلبات لك أمس على السيستم (غياب). نرجو الإفادة فوراً وتوضيح السبب.`
        : `أهلاً بك كابتن، تم تسجيل أداء أمس لك وهو (${orders}) طلب في النظام.`;
    window.open(`https://wa.me/${phone.replace(/\D/g,'').replace(/^05/,'9665')}?text=${encodeURIComponent(text)}`, '_blank');
}

function getAbsenceMessage(firstName, platformName) {
    return `أهلاً بك كابتن ${firstName}،\nمعك إدارة التشغيل (${platformName}). لم يتم رصد أي طلبات لك أمس على السيستم (غياب). نرجو الإفادة فوراً وتوضيح السبب.`;
}

function normalizeSaudiPhone(phone) {
    if (!phone) return null;
    let sanitized = String(phone).replace(/\D/g, '');
    if (sanitized.startsWith('00966')) sanitized = sanitized.slice(2);
    if (sanitized.startsWith('05') && sanitized.length === 10) sanitized = '966' + sanitized.slice(1);
    if (sanitized.startsWith('5') && sanitized.length === 9) sanitized = '966' + sanitized;
    if (sanitized.startsWith('966') && sanitized.length === 12) return sanitized;
    return null;
}

async function sendBulkWhatsAppToDefaulters(isAuto = false) {
    if (!hasPerm('send_alerts')) return alert('❌ ليس لديك صلاحية إرسال الإنذارات. تواصل مع الأدمن.');
    const btn = document.getElementById('btnBulkWhatsappModal');
    const originalText = btn ? btn.innerHTML : null;
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> ${t('lbl_sending')}`; }

    try {
        if (!ULTRAMSG_INSTANCE || !ULTRAMSG_TOKEN || ULTRAMSG_INSTANCE.includes("put_your")) {
            alert('❌ لم يتم تفعيل الـ API بعد. يرجى وضع مفاتيح UltraMsg في ملف app.js');
            return false;
        }

        let defaulters = window.allRawAccounts.filter(acc => {
            if (!acc || (acc.platform || 'ninja') !== currentPlatformTab) return false;
            if (!acc.actualUserName || acc.actualUserName === '-') return false;
            let dailyOrders = String(acc.dailyOrders).includes('غياب') ? 0 : (Number(acc.dailyOrders) || 0);
            return dailyOrders < 15;
        });

        if (defaulters.length === 0) {
            alert('لا يوجد مندوبين مقصرين لإرسال الرسالة لهم حالياً.');
            return false;
        }

        let validDefaulters = [];
        let invalidPhones = [];
        defaulters.forEach(acc => {
            let normalized = normalizeSaudiPhone(acc.phone);
            if (normalized) validDefaulters.push({ ...acc, normalizedPhone: normalized });
            else invalidPhones.push({ name: acc.actualUserName, phone: acc.phone });
        });

        if (validDefaulters.length === 0) {
            alert(`لا يوجد أرقام جوال سعودية صالحة للمقصرين.\nعدد المقصرين: ${defaulters.length}، الأرقام الصالحة: 0`);
            return false;
        }

        let successCount = 0;
        let failCount = 0;
        let failedNames = [];

        if (invalidPhones.length > 0) {
            console.warn('Invalid bulk send phones:', invalidPhones);
        }

        for (let acc of validDefaulters) {
            let dOrders = String(acc.dailyOrders).includes('غياب') ? 0 : (Number(acc.dailyOrders) || 0);
            let firstName = acc.actualUserName !== '-' ? acc.actualUserName.split(' ')[0] : 'كابتن';
            let platformName = currentPlatformTab === 'keeta' ? 'كيتا' : (currentPlatformTab === 'hunger' ? 'هنقرستيشن' : (currentPlatformTab === 'jahez' ? 'جاهز' : (currentPlatformTab === 'chefz' ? 'ذا شفز' : 'نينجا')));

            let messageText = dOrders === 0
                ? getAbsenceMessage(firstName, platformName)
                : `🚨 *تنبيه آلي من نظام SpeedPro* 🚨\n\nأهلاً بك كابتن ${firstName}،\nمعك إدارة التشغيل (${platformName}).\nلاحظنا أن أداءك أمس (${dOrders}) طلب فقط وهو أقل من الحد الأدنى المسموح به.\nنرجو رفع الأداء فوراً لتجنب الإجراءات الإدارية.`;

            let sent = await sendUltraMsg(acc.normalizedPhone, messageText);
            if (sent) {
                successCount++;
            } else {
                failCount++;
                failedNames.push(firstName);
            }

            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        let summary = `تم محاولة إرسال رسائل إلى ${validDefaulters.length} رقم صالح من أصل ${defaulters.length} مقصرين.`;
        summary += `\nنجح إرسال ${successCount} رسالة.`;
        if (failCount > 0) summary += `\nفشل إرسال ${failCount} رسالة${failedNames.length > 0 ? `:\n${failedNames.join(', ')}` : ''}`;
        if (invalidPhones.length > 0) {
            summary += `\n${invalidPhones.length} رقم غير صالح تم تجاهله.`;
            summary += `\nالأرقام غير الصالحة:\n${invalidPhones.map(p => `${p.name} (${p.phone || 'بدون رقم'})`).join('\n')}`;
        }
        alert(summary);
        return successCount > 0;
    } catch (err) {
        console.error('sendBulkWhatsAppToDefaulters error', err);
        alert('حدث خطأ أثناء الإرسال الجماعي. الرجاء المحاولة مرة أخرى.');
        return false;
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

function warnDefaulter(id, driverName) {
    const acc = window.allRawAccounts.find(a => a && a.id === id);
    if (!acc) return alert("لم يتم العثور على المندوب ❌");
    
    const totalOrders = Number(acc.totalOrders) || 0;
    const hours = Number(acc.hours) || 0;
    
    let isDark = document.body.classList.contains('dark-mode');
    
    Swal.fire({
        title: '⚠️ إنذار المقصرين',
        html: `
            <div class="text-start">
                <p class="fw-bold mb-3">المندوب: <span class="text-primary fs-5">${escHtml(driverName)}</span></p>
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-circle-fill me-2"></i>
                    <strong>تنبيه:</strong> أداء منخفض جداً
                </div>
                <div class="row g-2">
                    <div class="col-6">
                        <div class="card border-danger">
                            <div class="card-body text-center">
                                <h6 class="text-muted">إجمالي الطلبات</h6>
                                <h3 class="text-danger fw-bold">${totalOrders}</h3>
                                <small class="text-muted">من 18 فما فوق مقبول</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="card border-danger">
                            <div class="card-body text-center">
                                <h6 class="text-muted">الساعات</h6>
                                <h3 class="text-danger fw-bold">${hours}</h3>
                                <small class="text-muted">من 11 ساعة فأكثر مقبول</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        icon: 'warning',
        confirmButtonText: 'تم الإشعار',
        confirmButtonColor: '#ef4444',
        background: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f8fafc' : '#334155',
    }).then(() => {
        logAudit('إنذار المقصرين', id, `تم تنبيه المندوب ${driverName} - الطلبات: ${totalOrders}, الساعات: ${hours}`);
    });
}

function saveUltraMsgConfig() {
    const me = adminUsers[window.loggedInUser];
    if (!me || me.role !== 'super_admin') return alert('❌ هذا الإجراء متاح للسوبر أدمن فقط');
    let instance = document.getElementById('ultraInstance').value.trim();
    let token    = document.getElementById('ultraToken').value.trim();
    database.ref('ninja_data/settings/ultramsg').set({ instance, token }).then(() => {
        ULTRAMSG_INSTANCE = instance; ULTRAMSG_TOKEN = token;
        logAudit('تعديل بيانات', 'System', 'تم تحديث إعدادات واتساب (UltraMsg)');
        alert('✅ تم حفظ إعدادات واتساب بنجاح');
    }).catch(() => alert('❌ حدث خطأ أثناء الحفظ'));
}

function saveSectionPasswords() { let updates = { ninja: document.getElementById('passNinja').value, keeta: document.getElementById('passKeeta').value, hunger: document.getElementById('passHunger').value, jahez: document.getElementById('passJahez').value, chefz: document.getElementById('passChefz') ? document.getElementById('passChefz').value : '' }; database.ref('ninja_data/settings/passwords').set(updates).then(() => { logAudit('تحديث الأقفال', 'System', 'تم تغيير كلمات مرور الأقسام'); alert("تم حفظ وتأمين كلمات المرور بنجاح! 🔒"); bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide(); }); }

async function addNewAdmin() {
    const u = document.getElementById('newAdminUser').value.trim().toLowerCase();
    let p = document.getElementById('newAdminPass').value.trim();
    const n = document.getElementById('newAdminName').value.trim();

    // [SECURITY] Passwords are controlled by the super admin only, and stored hashed.
    const iAmSuper = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin';
    const existing = adminUsers[u];
    const isEditingExisting = !!existing;
    if (!iAmSuper) {
        if (!isEditingExisting) {
            // creating a new account means creating a credential → super admin only
            return alert('❌ إنشاء حساب جديد متاح للسوبر أدمن فقط');
        }
        // editing an existing account: keep the original password untouched
        p = existing.password;
    } else {
        if (p) { p = await hashPassword(u, p); }              // new/changed password → hash it
        else if (isEditingExisting) { p = existing.password; } // left blank on edit → keep existing
    }

    // التأكد إنك كاتب بيانات المشرف الجديد
    if(!u || !p || !n) return alert("الرجاء تعبئة بيانات الدخول والاسم!");

    // تجميع المنصات اللي إنت علمت عليها للمشرف الجديد
    let allowedPlatforms = [];
    if(document.getElementById('chkNinja').checked) allowedPlatforms.push('ninja');
    if(document.getElementById('chkKeeta').checked) allowedPlatforms.push('keeta');
    if(document.getElementById('chkHunger').checked) allowedPlatforms.push('hunger');
    if(document.getElementById('chkJahez').checked) allowedPlatforms.push('jahez');
    if(document.getElementById('chkChefz').checked) allowedPlatforms.push('chefz');

    // يُسمح بعدم تحديد منصات لو المشرف مخصص لقسم آخر (سيارات / سكن / HR / مالية)
    const getChk = id => { let el = document.getElementById(id); return el && el.checked; };
    let hasSectionAccess = getChk('chkCars') || getChk('chkHousing') || getChk('chkHr') || getChk('chkFinance');
    if(allowedPlatforms.length === 0 && !hasSectionAccess) return alert("يجب السماح للمشرف بدخول منصة واحدة على الأقل، أو تفعيل صلاحية أحد الأقسام (سيارات / سكن / HR / مالية)!");

    // الدور المختار
    let selectedRole = document.querySelector('input[name="adminRole"]:checked');
    let role = selectedRole ? selectedRole.value : 'supervisor';

    // اللغة المفضلة
    let selectedLang = document.querySelector('input[name="adminLang"]:checked');
    let lang = selectedLang ? selectedLang.value : 'ar';

    // تجميع الصلاحيات المفصلة (تُحفظ دائماً لكن يُعمل بها فقط لدور supervisor)
    let perms = {
        // المنصات والحسابات
        add_edit:        document.getElementById('chkAddEdit').checked,
        delete:          document.getElementById('chkDelete').checked,
        send_alerts:     document.getElementById('chkSendAlerts').checked,
        reset:           document.getElementById('chkReset').checked,
        import_perf:     document.getElementById('chkImportPerf').checked,
        import_drivers:  document.getElementById('chkImportDrivers').checked,
        report_approve:  document.getElementById('chkReportApprove').checked,
        // التقارير والبيانات
        export:          document.getElementById('chkExport').checked,
        archive:         document.getElementById('chkArchive').checked,
        trash:           document.getElementById('chkTrash').checked,
        fuel:            document.getElementById('chkFuel').checked,
        view_logs:       document.getElementById('chkViewLogs').checked,
        // المالية
        finance:         document.getElementById('chkFinance').checked,
        finance_invoices:document.getElementById('chkFinanceInvoices').checked,
        finance_pnl:     document.getElementById('chkFinancePnl').checked,
        finance_debts:   document.getElementById('chkFinanceDebts').checked,
        finance_add:     document.getElementById('chkFinanceAdd').checked,
        finance_delete:  document.getElementById('chkFinanceDel').checked,
        advance_approve: (document.getElementById('chkAdvanceApprove') || {}).checked || false,
        ninja_invoice:   document.getElementById('chkNinjaInvoice').checked,
        // السيارات
        cars:            document.getElementById('chkCars').checked,
        cars_add:        document.getElementById('chkCarsAdd').checked,
        cars_delete:     document.getElementById('chkCarsDelete').checked,
        cars_accidents:  document.getElementById('chkCarsAccidents').checked,
        cars_maintenance:document.getElementById('chkCarsMaintenance').checked,
        cars_handover:   document.getElementById('chkCarsHandover').checked,
        // السكن
        housing:         document.getElementById('chkHousing').checked,
        housing_add:     document.getElementById('chkHousingAdd').checked,
        housing_delete:  document.getElementById('chkHousingDelete').checked,
        housing_payments:document.getElementById('chkHousingPayments').checked,
        housing_warehouse:document.getElementById('chkHousingWarehouse').checked,
        // الموارد البشرية
        hr:              document.getElementById('chkHr').checked,
        hr_add:          document.getElementById('chkHrAdd').checked,
        hr_delete:       document.getElementById('chkHrDelete').checked,
        // الصفحات
        home:            document.getElementById('chkHome').checked,
        reports:         document.getElementById('chkReports') ? document.getElementById('chkReports').checked : false,
        // النظام
        manage_admins:   document.getElementById('chkManageAdmins').checked,
        // بوابة المندوب
        portal:          document.getElementById('chkPortal') ? document.getElementById('chkPortal').checked : false,
        approveAdvance:  document.getElementById('chkApproveAdvance') ? document.getElementById('chkApproveAdvance').checked : false,
    };

    // حفظ المشرف الجديد في الداتابيز
    adminUsers[u] = {
        password: p,
        name: n,
        role: role,
        lang: lang,
        platforms: allowedPlatforms,
        permissions: perms
    };
    
    database.ref('ninja_data/admins').set(adminUsers).then(() => { 
        logAudit('إدارة المشرفين', u, 'تم إنشاء حساب مشرف جديد'); 
        alert("تم إضافة المشرف الجديد بنجاح! ✅"); 
        
        // تفريغ الخانات فوراً عشان لو حبيت تضيف مشرف غيره (زي النظام القديم)
        document.getElementById('newAdminUser').value = '';
        document.getElementById('newAdminPass').value = '';
        document.getElementById('newAdminName').value = '';
        
        renderAdminsTable(); 
    });
}

function renderAdminsTable() { 
    const tbody = document.getElementById('adminsTableBody'); 
    tbody.innerHTML = ''; 
    for (let u in adminUsers) { 
        if(u === 'admin') continue; 
        let admin = adminUsers[u];
        let isSuper = admin.role === 'super_admin';
        
        // عرض المنصات
        let platsHTML = '';
        if(isSuper) {
            platsHTML = '<span class="badge bg-primary me-1">جميع المنصات</span>';
        } else {
            let plats = admin.platforms || [admin.platform] || ['ninja']; // لدعم الكود القديم
            plats.forEach(p => {
                let color = p==='ninja'?'bg-primary':p==='keeta'?'bg-warning text-dark':p==='hunger'?'bg-dark':p==='jahez'?'bg-danger':p==='chefz'?'bg-info text-dark':'bg-secondary';
                let name = p==='ninja'?'نينجا':p==='keeta'?'كيتا':p==='hunger'?'هنقر':p==='jahez'?'جاهز':p==='chefz'?'ذا شفز':p;
                platsHTML += `<span class="badge ${color} me-1">${escHtml(name)}</span>`;
            });
        }

        // عرض الدور
        let roleLabel = '';
        if (admin.role === 'super_admin') roleLabel = '<span class="badge bg-danger fs-6 me-1">👑 سوبر أدمن</span>';
        else if (admin.role === 'admin')  roleLabel = '<span class="badge me-1 fs-6" style="background:#b91c1c; color:#fff;">🔑 مدير مساعد</span>';
        else                              roleLabel = '<span class="badge bg-secondary me-1">👤 مشرف</span>';

        // شارة اللغة المفضلة
        if ((admin.lang || 'ar') === 'en') roleLabel += '<span class="badge bg-success me-1" title="لغة الواجهة الافتراضية">🇬🇧 EN</span>';

        // عرض الصلاحيات
        let permsHTML = '';
        if (admin.role === 'super_admin' || admin.role === 'admin') {
            permsHTML = admin.role === 'super_admin'
                ? '<span class="badge bg-success">✅ صلاحيات كاملة — غير قابل للتعديل</span>'
                : '<span class="badge" style="background:#b91c1c; color:#fff;">✅ صلاحيات كاملة — قابل للتعديل</span>';
        } else {
            let p = admin.permissions || {};
            const permGroups = [
                { header:'📱 الحسابات', items:[
                    { k:'add_edit',       label:'إضافة/تعديل',    cls:'bg-success' },
                    { k:'delete',         label:'حذف',             cls:'bg-danger' },
                    { k:'send_alerts',    label:'إنذارات',         cls:'bg-warning text-dark' },
                    { k:'reset',          label:'تصفير',           cls:'bg-secondary' },
                    { k:'import_perf',    label:'رفع تقرير',       cls:'bg-info text-dark' },
                    { k:'import_drivers', label:'استيراد مناديب', cls:'bg-info text-dark' },
                    { k:'report_approve', label:'موافقة تقارير',  cls:'bg-purple text-white' },
                ]},
                { header:'📊 بيانات', items:[
                    { k:'export',    label:'تصدير',    cls:'bg-info text-dark' },
                    { k:'archive',   label:'أرشيف',    cls:'bg-primary' },
                    { k:'trash',     label:'محذوفات',  cls:'bg-dark' },
                    { k:'fuel',      label:'بنزين',    cls:'bg-warning text-dark' },
                    { k:'view_logs', label:'سجل النشاط', cls:'bg-secondary' },
                ]},
                { header:'💰 المالية', items:[
                    { k:'finance',          label:'دخول',        cls:'bg-warning text-dark' },
                    { k:'finance_invoices', label:'فواتير',      cls:'bg-primary' },
                    { k:'finance_pnl',      label:'أرباح/خسائر', cls:'bg-success' },
                    { k:'finance_debts',    label:'ديون',        cls:'bg-danger' },
                    { k:'finance_add',      label:'إضافة',       cls:'bg-success' },
                    { k:'finance_delete',   label:'حذف مالية',   cls:'bg-danger' },
                    { k:'advance_approve',  label:'موافقة سلف',  cls:'bg-success' },
                    { k:'ninja_invoice',    label:'إدراج فواتير', cls:'bg-dark' },
                ]},
                { header:'🚗 السيارات', items:[
                    { k:'cars',             label:'دخول',    cls:'bg-teal text-white', st:'background:#0f766e;' },
                    { k:'cars_add',         label:'إضافة',   cls:'bg-success' },
                    { k:'cars_delete',      label:'حذف',     cls:'bg-danger' },
                    { k:'cars_accidents',   label:'حوادث',   cls:'bg-danger' },
                    { k:'cars_maintenance', label:'صيانة',   cls:'bg-warning text-dark' },
                    { k:'cars_handover',    label:'تسليم',   cls:'bg-primary' },
                ]},
                { header:'🏠 السكن', items:[
                    { k:'housing',          label:'دخول',    cls:'', st:'background:#b45309; color:#fff;' },
                    { k:'housing_add',      label:'إضافة',   cls:'bg-success' },
                    { k:'housing_delete',   label:'حذف',     cls:'bg-danger' },
                    { k:'housing_payments', label:'دفعات',   cls:'bg-primary' },
                    { k:'housing_warehouse',label:'مستودع',  cls:'bg-info text-dark' },
                ]},
                { header:'👥 HR', items:[
                    { k:'hr',        label:'دخول',  cls:'bg-purple text-white', st:'background:#7c3aed;' },
                    { k:'hr_add',    label:'إضافة', cls:'bg-success' },
                    { k:'hr_delete', label:'حذف',   cls:'bg-danger' },
                ]},
                { header:'🖥️ صفحات', items:[
                    { k:'home', label:'الصفحة الرئيسية', cls:'bg-warning text-dark' },
                    { k:'reports', label:'التقارير', cls:'bg-primary' },
                ]},
                { header:'⚙️ نظام', items:[
                    { k:'manage_admins', label:'إدارة المشرفين', cls:'bg-danger' },
                ]},
                { header:'💵 بوابة', items:[
                    { k:'portal', label:'دخول البوابة', cls:'bg-warning text-dark' },
                    { k:'approveAdvance', label:'موافقة السلف', cls:'bg-warning text-dark' },
                ]},
            ];
            let groupsHtml = permGroups.map(g => {
                let badges = g.items.filter(i => p[i.k]).map(i => `<span class="badge ${i.cls||''} me-1" ${i.st?`style="${i.st}"`:''} style="font-size:0.68rem;">${i.label}</span>`).join('');
                if (!badges) return '';
                return `<div class="mb-1"><small class="text-muted">${g.header}: </small>${badges}</div>`;
            }).join('');
            permsHTML = groupsHtml || '<span class="badge bg-secondary">عرض فقط</span>';
        }

        let canEdit = !isSuper || (adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin');
        let ctrlBtns = isSuper ? '-' : `
            <button class="btn btn-sm btn-warning text-dark me-1" onclick="editAdmin('${u}')" title="تعديل"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteAdmin('${u}')" title="حذف"><i class="bi bi-trash"></i></button>
        `;
        let lastLoginStr = '—';
        if (admin.lastLogin) {
            let d = new Date(admin.lastLogin);
            let diff = Date.now() - admin.lastLogin;
            let diffMin = Math.floor(diff / 60000);
            let ago = diffMin < 1 ? 'الآن' : diffMin < 60 ? `منذ ${diffMin} د` : diffMin < 1440 ? `منذ ${Math.floor(diffMin/60)} س` : `منذ ${Math.floor(diffMin/1440)} ي`;
            lastLoginStr = `<div class="small">${d.toLocaleDateString('ar-SA',{day:'numeric',month:'short',year:'numeric'})}</div>
                <div class="small">${d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}</div>
                <div class="small text-muted opacity-75">${ago}</div>`;
        }
        tbody.innerHTML += `<tr>
            <td><b class="text-primary">${u}</b><br>${roleLabel}</td>
            <td><b>${escHtml(admin.name)}</b><br><small class="text-muted" title="آخر تسجيل دخول"><i class="bi bi-clock-history me-1 text-primary opacity-75"></i>${lastLoginStr === '—' ? '<span class="text-muted">لم يسجل دخولاً بعد</span>' : lastLoginStr}</small></td>
            <td>${platsHTML}</td>
            <td style="text-align:start; max-width:380px;">${permsHTML}</td>
            <td>${ctrlBtns}</td>
        </tr>`; 
    } 
}

function editAdmin(u) {
    let admin = adminUsers[u];
    if(!admin) return;
    document.getElementById('newAdminUser').value = u;
    document.getElementById('newAdminName').value = admin.name;

    // [SECURITY] only the super admin may see/change passwords
    const iAmSuper = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin';
    let passField = document.getElementById('newAdminPass');
    if (iAmSuper) {
        passField.value = '';
        passField.disabled = false;
        passField.placeholder = L('اتركه فارغاً للإبقاء على كلمة المرور الحالية', 'Leave blank to keep the current password');
    } else {
        passField.value = '';
        passField.disabled = true;
        passField.placeholder = L('🔒 محمي — للسوبر أدمن فقط', '🔒 Protected — super admin only');
    }
    
    let plats = admin.platforms || [admin.platform] || ['ninja'];
    document.getElementById('chkNinja').checked = plats.includes('ninja');
    document.getElementById('chkKeeta').checked = plats.includes('keeta');
    document.getElementById('chkHunger').checked = plats.includes('hunger');
    document.getElementById('chkJahez').checked = plats.includes('jahez');
    if(document.getElementById('chkChefz')) document.getElementById('chkChefz').checked = plats.includes('chefz');

    // الدور
    let role = admin.role || 'supervisor';
    let roleRadio = document.querySelector(`input[name="adminRole"][value="${role}"]`);
    if (roleRadio) { roleRadio.checked = true; onRoleChange(); }

    // اللغة المفضلة
    let lang = admin.lang || 'ar';
    let langRadio = document.querySelector(`input[name="adminLang"][value="${lang}"]`);
    if (langRadio) langRadio.checked = true;

    let p = admin.permissions || {};
    // المنصات والحسابات
    document.getElementById('chkAddEdit').checked       = !!p.add_edit;
    document.getElementById('chkDelete').checked        = !!p.delete;
    document.getElementById('chkSendAlerts').checked    = !!p.send_alerts;
    document.getElementById('chkReset').checked         = !!p.reset;
    document.getElementById('chkImportPerf').checked    = !!p.import_perf;
    document.getElementById('chkImportDrivers').checked = !!p.import_drivers;
    document.getElementById('chkReportApprove').checked = !!p.report_approve;
    // التقارير والبيانات
    document.getElementById('chkExport').checked        = !!p.export;
    document.getElementById('chkArchive').checked       = !!p.archive;
    document.getElementById('chkTrash').checked         = !!p.trash;
    document.getElementById('chkFuel').checked          = !!p.fuel;
    document.getElementById('chkViewLogs').checked      = !!p.view_logs;
    // المالية
    document.getElementById('chkFinance').checked          = !!p.finance;
    document.getElementById('chkFinanceInvoices').checked  = !!p.finance_invoices;
    document.getElementById('chkFinancePnl').checked       = !!p.finance_pnl;
    document.getElementById('chkFinanceDebts').checked     = !!p.finance_debts;
    document.getElementById('chkFinanceAdd').checked       = !!p.finance_add;
    document.getElementById('chkFinanceDel').checked       = !!p.finance_delete;
    if (document.getElementById('chkAdvanceApprove')) document.getElementById('chkAdvanceApprove').checked = !!p.advance_approve;
    document.getElementById('chkNinjaInvoice').checked     = !!p.ninja_invoice;
    // السيارات
    document.getElementById('chkCars').checked             = !!p.cars;
    document.getElementById('chkCarsAdd').checked          = !!p.cars_add;
    document.getElementById('chkCarsDelete').checked       = !!p.cars_delete;
    document.getElementById('chkCarsAccidents').checked    = !!p.cars_accidents;
    document.getElementById('chkCarsMaintenance').checked  = !!p.cars_maintenance;
    document.getElementById('chkCarsHandover').checked     = !!p.cars_handover;
    // السكن
    document.getElementById('chkHousing').checked          = !!p.housing;
    document.getElementById('chkHousingAdd').checked       = !!p.housing_add;
    document.getElementById('chkHousingDelete').checked    = !!p.housing_delete;
    document.getElementById('chkHousingPayments').checked  = !!p.housing_payments;
    document.getElementById('chkHousingWarehouse').checked = !!p.housing_warehouse;
    // الموارد البشرية
    document.getElementById('chkHr').checked               = !!p.hr;
    document.getElementById('chkHrAdd').checked            = !!p.hr_add;
    document.getElementById('chkHrDelete').checked         = !!p.hr_delete;
    // الصفحات
    document.getElementById('chkHome').checked             = !!p.home;
    if(document.getElementById('chkReports')) document.getElementById('chkReports').checked = !!p.reports;
    // النظام
    document.getElementById('chkManageAdmins').checked     = !!p.manage_admins;
    // بوابة المندوب
    if(document.getElementById('chkPortal')) document.getElementById('chkPortal').checked = !!p.portal;
    if(document.getElementById('chkApproveAdvance')) document.getElementById('chkApproveAdvance').checked = !!p.approveAdvance;
}

function onRoleChange() {
    let selected = document.querySelector('input[name="adminRole"]:checked');
    let isAdminRole = selected && selected.value === 'admin';
    let note = document.getElementById('adminRoleNote');
    let permsSection = document.getElementById('permissionsSection');
    if (note) note.style.display = isAdminRole ? '' : 'none';
    if (permsSection) {
        permsSection.style.opacity = isAdminRole ? '0.4' : '1';
        permsSection.style.pointerEvents = isAdminRole ? 'none' : '';
    }
}

function deleteAdmin(u) {
    swalConfirm(`هل أنت متأكد من حذف المشرف (${u}) نهائياً؟`, { confirmText: 'نعم، احذف' }).then(function(_ok) { if (_ok) {
        database.ref('ninja_data/admins/' + u).remove().then(() => {
            logAudit('حذف مشرف', u, 'تم مسح حساب المشرف من النظام');
            alert("تم الحذف بنجاح!");
            renderAdminsTable();
        });
    } });
}

function downloadDriverTemplate() {
    const isChefz = currentPlatformTab === 'chefz';
    const noFuel = currentPlatformTab === 'jahez' || isChefz;
    const headers = isChefz
        ? ["iqama no", "Owner Name", "Employee Number", "iqama actual no", "actual Driver name", "Phone", "Supervisor"]
        : noFuel
            ? ["ID", "iqama no", "Owner Name", "Employee Number", "iqama actual no", "actual Driver name", "Phone", "Supervisor"]
            : ["ID", "iqama no", "Owner Name", "Employee Number", "iqama actual no", "actual Driver name", "Fuel Cost", "Phone", "Supervisor"];
    const data = [headers];
    window.allRawAccounts.filter(a => (a.platform||'ninja') === currentPlatformTab).forEach(a => {
        if(!a) return;
        const row = isChefz
            ? [a.ownerIqama || '', a.ownerName || '', a.employeeNumber || '', a.actualIqama || '', a.actualUserName || '', a.phone || '', a.supervisor || '']
            : noFuel
                ? [a.id, a.ownerIqama || '', a.ownerName || '', a.employeeNumber || '', a.actualIqama || '', a.actualUserName || '', a.phone || '', a.supervisor || '']
                : [a.id, a.ownerIqama || '', a.ownerName || '', a.employeeNumber || '', a.actualIqama || '', a.actualUserName || '', a.fuelCost || 0, a.phone || '', a.supervisor || ''];
        data.push(row);
    });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Users"); XLSX.writeFile(wb, `USERS_TEMPLATE_${currentPlatformTab.toUpperCase()}.xlsx`);
}
function downloadPerfTemplate() { let headers = []; if (currentPlatformTab === 'ninja') { headers = ["ID", "Daily Orders", "Hours"]; } else if (currentPlatformTab === 'keeta') { headers = ["ID", "Daily Orders", "Rejected Orders", "Hours", "Cancel Rate", "On Time Rate", "Delay Rate"]; } else if (currentPlatformTab === 'hunger' || currentPlatformTab === 'jahez' || currentPlatformTab === 'chefz') { headers = ["ID", "Daily Orders", "Rejected Orders", "Hours"]; } const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers]), "Perf"); XLSX.writeFile(wb, `PERF_TEMPLATE_${currentPlatformTab.toUpperCase()}.xlsx`); }
function saveDirectToDrive() { let exportAccounts = window.allRawAccounts.filter(a => (a.platform||'ninja') === currentPlatformTab); if (exportAccounts.length === 0) return alert("لا توجد بيانات للقسم الحالي لتصديرها!"); const dataToExport = exportAccounts.map(acc => ({ "ID": acc.id, "Owner": acc.ownerName, "Driver": acc.actualUserName, "Employee Number": acc.employeeNumber, "Fuel Cost": acc.fuelCost || 0, "Phone": acc.phone, "Status": acc.status, "Daily Orders": acc.dailyOrders, "Hours": acc.hours, "Total Orders": acc.totalOrders, "Notes": acc.notes, "Supervisor": acc.supervisor, "Wallet": acc.wallet, "Rejected": acc.rejectedOrders })); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dataToExport), "Data"); let supName = window.viewingSupervisor === "ALL_SUPERVISORS" ? "ALL" : window.viewingSupervisor; XLSX.writeFile(wb, `BACKUP_${currentPlatformTab.toUpperCase()}_${supName}_${getTodayStr()}.xlsx`); logAudit('أخذ نسخة احتياطية', currentPlatformTab, 'تم تصدير شيت إكسيل لبيانات القسم');}

function openSmartPaste() { new bootstrap.Modal(document.getElementById('smartPasteModal')).show(); }
function processSmartPaste() {
    const text = document.getElementById('rawPastedData').value; if (!text.trim()) return; const lines = text.split('\n').map(l => l.trim()).filter(l => l); let count = 0; let updates = {};
    for (let i = 0; i < lines.length; i++) {
        if (/^\d{4,8}$/.test(lines[i]) && i + 1 < lines.length) {
            const id = lines[i]; const nextLine = lines[i + 1]; const iqamaMatch = nextLine.match(/\b\d{10}\b/);
            if (iqamaMatch) { let iqamaNumber = iqamaMatch[0]; let name = nextLine.split(iqamaNumber)[0].trim().replace(/(Khobar|Dammam|Al Qatif|Jubail)$/i, '').trim(); updates[`ninja_data/accounts/${id}`] = { id: id, ownerName: name || 'غير محدد', actualUserName: '-', phone: '-', status: 'متاح', dailyOrders: 0, totalOrders: 0, notes: 'نشط', dispatchDate: '', supervisor: window.loggedInUser, platform: currentPlatformTab }; count++; i++; }
        }
    }
    database.ref().update(updates).then(() => { logAudit('لصق ذكي', 'Excel', `تم إضافة ${count} حساب عبر اللصق الذكي`); bootstrap.Modal.getInstance(document.getElementById('smartPasteModal')).hide(); alert(`تم تحليل وإدراج ${count} بيانات بنجاح ⚡`); });
}

function openResetModal() {
    if(!hasPerm('reset')) return alert('❌ ليس لديك صلاحية التصفير. تواصل مع الأدمن.');
    new bootstrap.Modal(document.getElementById('resetModal')).show();
}
function executeCustomReset() {
    if(!hasPerm('reset')) return alert('❌ ليس لديك صلاحية التصفير. تواصل مع الأدمن.');
    const rd = document.getElementById('resetDailyCheck').checked, rt = document.getElementById('resetTotalCheck').checked, rh = document.getElementById('resetHoursCheck').checked;
    swalConfirm("تأكيد التصفير المخصص للقسم المفتوح حالياً؟", { confirmText: 'نعم، صفّر' }).then(function(_ok) { if (_ok) {
        let updates = {}; let _undoReset = {};
        window.allRawAccounts.forEach(a => {
            if(!a || (a.platform||'ninja') !== currentPlatformTab) return;
            if(rd) { updates[`ninja_data/accounts/${a.id}/dailyOrders`] = 0; updates[`ninja_data/accounts/${a.id}/rejectedOrders`] = 0; _undoReset[`ninja_data/accounts/${a.id}/dailyOrders`] = a.dailyOrders !== undefined ? a.dailyOrders : 0; _undoReset[`ninja_data/accounts/${a.id}/rejectedOrders`] = a.rejectedOrders || 0; }
            if(rt) { updates[`ninja_data/accounts/${a.id}/totalOrders`] = 0; _undoReset[`ninja_data/accounts/${a.id}/totalOrders`] = a.totalOrders || 0; }
            if(rh) { updates[`ninja_data/accounts/${a.id}/hours`] = 0; _undoReset[`ninja_data/accounts/${a.id}/hours`] = a.hours || 0; }
        });
        pushUndoState(`تصفير مخصص (${currentPlatformTab})`, _undoReset);
        database.ref().update(updates).then(() => { logAudit('تصفير مخصص', currentPlatformTab, 'قام المشرف بتصفير عدادات الحسابات في القسم'); bootstrap.Modal.getInstance(document.getElementById('resetModal')).hide(); alert("تم تنفيذ التصفير المخصص للقسم بنجاح ✅"); });
    } });
}

function importFuelCosts(e) {
    if (!e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
            let updates = {}; let count = 0; let errorCount = 0;
            XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }).forEach(row => {
                let id = ""; let fuelCost = 0;
                for(let k in row) {
                    let key = String(k).toLowerCase().trim(); let val = String(row[k]).trim();
                    if(!val || val === '-') continue;
                    if(key.includes('يوزر') || key === 'id') id = val;
                    else if(key.includes('fuel') || key.includes('بنزين')) fuelCost = Number(val) || 0;
                }
                if (id && id !== "undefined" && id !== "") {
                    let acc = window.allRawAccounts.find(a => String(a.id) === String(id));
                    if (acc && (acc.platform || 'ninja') === currentPlatformTab) {
                        updates[`ninja_data/accounts/${id}/fuelCost`] = fuelCost;
                        count++;
                    } else {
                        errorCount++;
                    }
                }
            });
            if (count === 0) return alert('لم يتم العثور على أي بيانات بنزين صحيحة في الملف!');
            database.ref().update(updates).then(() => {
                logAudit('استيراد تكاليف بنزين', currentPlatformTab, `تم استيراد بيانات بنزين ${count} مندوب`);
                alert(`✅ تم تحديث تكاليف البنزين لـ (${count}) حساب بنجاح!${errorCount > 0 ? `\n⚠️ ${errorCount} سجل لم يتم تطابقه مع الحسابات الحالية.` : ''}`);
                location.reload();
            }).catch(err => {
                console.error('Fuel import error:', err);
                alert('❌ حدث خطأ أثناء حفظ البيانات في قاعدة البيانات');
            });
        } catch(err) {
            console.error('Fuel import parse error:', err);
            alert('❌ حدث خطأ أثناء قراءة الملف، تأكد من أنه ملف Excel صحيح');
        }
    };
    reader.readAsArrayBuffer(e.target.files[0]);
    e.target.value = '';
}

function updateAllDatesToToday() {
    swalConfirm("تأكيد ترحيل التواريخ للقسم المفتوح؟ (تصفير طلبات اليوم وتحديث تاريخ الاستلام)", { confirmText: 'نعم، تأكيد' }).then(function(_ok) { if (!_ok) return; let updates = {}; let today = getTodayStr();
    window.allRawAccounts.forEach(a => { if(a && (a.platform||'ninja') === currentPlatformTab && (a.status === 'قيد الاستخدام' || a.status === 'مصروف')) { updates['ninja_data/accounts/' + a.id + '/dispatchDate'] = today; updates['ninja_data/accounts/' + a.id + '/dailyOrders'] = 0; } });
    database.ref().update(updates).then(() => { logAudit('ترحيل تواريخ', currentPlatformTab, 'تم ترحيل تواريخ المباشرة وتصفير طلبات اليوم للقسم'); alert("تم ترحيل التواريخ وتصفير الطلبات اليومية بنجاح 📆"); }); });
}

function updateAllDatesToFirstOfMonth(allPlatforms = false) {
    const isAdmin = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role === 'super_admin';
    // If requesting all platforms, require super_admin
    if (allPlatforms && !isAdmin) {
        return Swal.fire({ icon: 'error', title: L('غير مسموح', 'Not Allowed'), text: L('يجب أن تكون مدير النظام لتشغيل هذه العملية على جميع الأقسام.', 'You must be a super admin to run this operation on all sections.') });
    }
    const targetLabel = allPlatforms ? L('جميع الأقسام','All Sections') : `${L('القسم الحالي','Current Section')} (${currentPlatformTab})`;
    Swal.fire({
        title: L('تعيين تاريخ الاستلام للقسم الحالي', 'Set Dispatch Date for Current Section'),
        text: L('اختر وضع التحديث:', 'Choose update mode:'),
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: L('أوتوماتيكي (أول الشهر)', 'Auto (1st of Month)'),
        denyButtonText: L('تحديد تاريخ بنفسي', 'Choose Date Manually'),
        cancelButtonText: L('إلغاء', 'Cancel')
    }).then(result => {
        if (result.isDismissed) return;
        const applyDate = (dateStr) => {
            let updates = {};
            let accountCount = 0;
            window.allRawAccounts.forEach(a => {
                if (!a) return;
                const plat = (a.platform || 'ninja');
                if (!allPlatforms && plat !== currentPlatformTab) return;
                if (a.status === 'قيد الاستخدام' || a.status === 'مصروف') {
                    const oldDate = a.dispatchDate || '-';
                    accountCount++;
                    updates[`ninja_data/accounts/${a.id}/dispatchDate`] = dateStr;
                    let _lp = a.platform || 'ninja';
                    let _le = { id: a.id, driver: a.actualUserName || '-', startDate: oldDate, endDate: dateStr, totalOrders: a.totalOrders || 0, rejected: a.rejectedOrders || 0, wallet: a.wallet || 0, supervisor: a.supervisor || window.loggedInUser, platform: _lp };
                    if (_lp === 'hunger' || _lp === 'keeta') _le.km = Number(a.kmTotal || 0);
                    updates[`ninja_data/logs/${Date.now()}_${a.id}`] = _le;
                }
            });
            if (accountCount === 0) return Swal.fire({ icon: 'info', title: L('لا توجد تحديثات', 'No Updates'), text: L('لم يتم العثور على حسابات نشطة لتحديثها.', 'No active accounts found to update.') });
            database.ref().update(updates).then(() => {
                logAudit('تحديث تاريخ الاستلام إلى أول الشهر', allPlatforms ? 'all' : currentPlatformTab, `تم تحديث ${accountCount} حساب`);
                Swal.fire({ icon: 'success', title: L('تم', 'Done'), text: L(`تم تحديث ${accountCount} حساب لتاريخ الاستلام ${dateStr}`, `Updated ${accountCount} account(s) with dispatch date ${dateStr}`) }).then(()=> location.reload());
            }).catch(err => { console.error('updateAllDatesToFirstOfMonth error', err); Swal.fire({ icon: 'error', title: L('خطأ', 'Error'), text: L('حدث خطأ أثناء تحديث التواريخ', 'An error occurred while updating dates') }); });
        };

        if (result.isConfirmed) {
            let first = new Date(); first.setDate(1); applyDate(formatLocalDate(first));
            return;
        }

        Swal.fire({
            title: L('حدد تاريخ الاستلام', 'Set Dispatch Date'),
            html: `<input type="date" id="swal-custom-date" class="swal2-input" value="${formatLocalDate(new Date())}">`,
            confirmButtonText: L('تطبيق التاريخ', 'Apply Date'),
            cancelButtonText: L('إلغاء', 'Cancel'),
            showCancelButton: true,
            preConfirm: () => {
                const dateInput = document.getElementById('swal-custom-date');
                if (!dateInput || !dateInput.value) {
                    Swal.showValidationMessage(L('الرجاء اختيار تاريخ صالح', 'Please choose a valid date'));
                    return false;
                }
                return dateInput.value;
            }
        }).then(dateResult => {
            if (dateResult.isConfirmed && dateResult.value) {
                applyDate(dateResult.value);
            }
        });
    });
}

// [ADMIN] تعيين نوع التعاقد لكل حسابات المنصة دفعة واحدة (فري لانسر / كفالة)
async function bulkSetContract(platform, type) {
    if (!isAdminOrSuper()) return alert('❌ هذه العملية للأدمن فقط.');
    const accs = (window.allRawAccounts || []).filter(a => a && (a.platform || 'ninja') === platform);
    if (!accs.length) return alert(L('لا توجد حسابات في هذه المنصة', 'No accounts in this platform'));
    const typeLabel = type === 'كفالة' ? L('كفالة', 'Sponsored') : L('فري لانسر', 'Freelancer');
    const msg = L(`تعيين نوع التعاقد لـ ${accs.length} حساب في ${platformDisplayName(platform)} إلى "${typeLabel}"؟`,
                  `Set contract type for ${accs.length} accounts in ${platformDisplayName(platform)} to "${typeLabel}"?`);
    const ok = (typeof swalConfirm === 'function') ? await swalConfirm(msg, { confirmText: L('نعم، طبّق', 'Yes, apply') }) : confirm(msg);
    if (!ok) return;
    const updates = {};
    accs.forEach(a => { updates[`ninja_data/accounts/${a.id}/contractType`] = type; });
    database.ref().update(updates).then(() => {
        if (typeof logAudit === 'function') logAudit('تعديل جماعي', platform, `تعيين نوع التعاقد (${type}) لـ ${accs.length} حساب`);
        alert(L(`تم تعيين "${typeLabel}" لـ ${accs.length} حساب ✅`, `Set "${typeLabel}" for ${accs.length} accounts ✅`));
    });
}

function bulkUpdateAllToInUse(platform) {
    // تصحيح platform إذا كانت 'ninja' للتوافق مع التصفية
    const validPlatform = platform === 'ninja' ? 'ninja' : (platform === 'orders' ? 'ninja' : platform);
    const platformNameAr = validPlatform === 'ninja' ? 'نينجا' : (validPlatform === 'keeta' ? 'كيتا' : (validPlatform === 'hunger' ? 'هنقرستيشن' : (validPlatform === 'jahez' ? 'جاهز' : 'ذا شفز')));
    const platformNameEn = validPlatform === 'ninja' ? 'Ninja' : (validPlatform === 'keeta' ? 'Keeta' : (validPlatform === 'hunger' ? 'HungerStation' : (validPlatform === 'jahez' ? 'Jahez' : 'TheChefz')));
    const platformName = L(platformNameAr, platformNameEn);
    const availableCount = window.allRawAccounts.filter(a => a && (a.platform || 'ninja') === validPlatform && a.status === 'متاح').length;
    
    if (availableCount === 0) {
        return alert(`لا توجد حسابات متاحة في ${platformName} لتفعيلها.`);
    }

    Swal.fire({
        title: L('تفعيل جميع الحسابات المتاحة', 'Activate All Available Accounts'),
        html: L(`
            <div class="text-start">
                <p class="fw-bold mb-3"><i class="bi bi-lightning-charge text-warning me-2"></i> هل تريد تحويل <span class="text-danger">${availableCount}</span> حساب متاح إلى <span class="text-danger">قيد الاستخدام</span>؟</p>
                <p class="text-muted small">المنصة: <strong>${platformName}</strong></p>
            </div>
        `, `
            <div class="text-start">
                <p class="fw-bold mb-3"><i class="bi bi-lightning-charge text-warning me-2"></i> Activate <span class="text-danger">${availableCount}</span> available account(s) to <span class="text-danger">In Use</span>?</p>
                <p class="text-muted small">Platform: <strong>${platformName}</strong></p>
            </div>
        `),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: L('تفعيل الكل ⚡', 'Activate All ⚡'),
        cancelButtonText: L('إلغاء', 'Cancel'),
        confirmButtonColor: '#10b9ab'
    }).then(result => {
        if (!result.isConfirmed) return;

        let updates = {};
        let updatedCount = 0;
        const today = getTodayStr();

        window.allRawAccounts.forEach(a => {
            if (a && (a.platform || 'ninja') === validPlatform && a.status === 'متاح') {
                updates[`ninja_data/accounts/${a.id}/status`] = 'قيد الاستخدام';
                // تحديث تاريخ المباشرة إلى اليوم إذا كان فارغاً
                if (!a.dispatchDate || a.dispatchDate === '') {
                    updates[`ninja_data/accounts/${a.id}/dispatchDate`] = today;
                }
                updatedCount++;
            }
        });

        if (updatedCount === 0) {
            return alert('لم يتم تحديث أي حساب.');
        }

        let _undoActivate = {};
        window.allRawAccounts.forEach(a => {
            if (a && (a.platform || 'ninja') === validPlatform && a.status === 'متاح') {
                _undoActivate[`ninja_data/accounts/${a.id}/status`] = 'متاح';
                if (!a.dispatchDate || a.dispatchDate === '') _undoActivate[`ninja_data/accounts/${a.id}/dispatchDate`] = '';
            }
        });
        pushUndoState(`تفعيل جميع حسابات ${platformName} (${updatedCount})`, _undoActivate);
        database.ref().update(updates).then(() => {
            logAudit('تفعيل جماعي', validPlatform, `تم تفعيل ${updatedCount} حساب من المتاح إلى قيد الاستخدام`);
            Swal.fire({
                icon: 'success',
                title: L('تم بنجاح! ✅', 'Done! ✅'),
                html: L(`<p>تم تفعيل <strong class="text-danger">${updatedCount}</strong> حساب في ${platformName}</p>`,
                         `<p>Activated <strong class="text-danger">${updatedCount}</strong> account(s) in ${platformName}</p>`),
                timer: 3000,
                showConfirmButton: false
            });
        }).catch(err => {
            console.error('bulkUpdateAllToInUse error', err);
            Swal.fire({
                icon: 'error',
                title: L('خطأ', 'Error'),
                text: L('حدث خطأ أثناء تفعيل الحسابات. الرجاء المحاولة مرة أخرى.', 'An error occurred while activating accounts. Please try again.')
            });
        });
    });
}

function openDefaultersModal() {
    // 1. إغلاق القائمة الجانبية (أدوات النظام) أولاً لمنع تجميد الشاشة
    let sidebar = document.getElementById('actionSidebar');
    let bsOffcanvas = bootstrap.Offcanvas.getInstance(sidebar);
    if (bsOffcanvas) bsOffcanvas.hide();

    // 2. جلب بيانات المقصرين
    const tbody = document.getElementById('defaultersTableBody'); 
    let platformAccs = window.allRawAccounts.filter(a => {
        if (!a || (a.platform||'ninja') !== currentPlatformTab) return false;
        if (!(a.status === 'قيد الاستخدام' || a.status === 'مصروف')) return false;
        let orders = Number(a.dailyOrders) || 0;
        return orders < 15;
    });
    
    if (platformAccs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-success py-4 fs-5 fw-bold">${t('defaulters_no_today')} (${t('pname_' + currentPlatformTab)})! 💪</td></tr>`;
    }
    else {
        let html = '';
        platformAccs.sort((a, b) => (Number(a.dailyOrders) || 0) - (Number(b.dailyOrders) || 0)).forEach(acc => {
            let dOrders = Number(acc.dailyOrders) || 0;
            let name = acc.actualUserName !== '-' ? acc.actualUserName : acc.ownerName;
            html += `<tr><td><b>${escHtml(name)}</b></td><td><b class="text-danger">${dOrders} ${t('lbl_order')}</b></td><td dir="ltr" class="text-muted fw-bold">${acc.phone}</td><td><button onclick="sendDefaulterMessage('${acc.id}', this)" class="btn btn-sm btn-success fw-bold shadow-sm"><i class="bi bi-whatsapp"></i> ${t('defaulters_alert_btn')}</button></td></tr>`;
        });
        tbody.innerHTML = html;
    }

    // 3. فتح النافذة بالطريقة الآمنة (getOrCreateInstance) لمنع تعليق الشاشة
    let modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('defaultersModal'));
    modal.show();
}

function sendDefaulterMessage(id, btn) {
    const acc = window.allRawAccounts.find(a => a.id == id); if(!acc || !acc.phone || acc.phone === '-' || acc.phone.length < 9) return alert("رقم الجوال غير مسجل ❌"); let dOrders = Number(acc.dailyOrders) || 0; let firstName = acc.actualUserName !== '-' ? acc.actualUserName.split(' ')[0] : 'كابتن'; let platformName = currentPlatformTab === 'keeta' ? 'كيتا' : (currentPlatformTab === 'hunger' ? 'هنقرستيشن' : (currentPlatformTab === 'jahez' ? 'جاهز' : (currentPlatformTab === 'chefz' ? 'ذا شفز' : 'نينجا')));
    let messageText = dOrders > 0 ? `أهلاً بك كابتن ${firstName}،\nمعك إدارة التشغيل (${platformName}). تم تسجيل أداء أمس لك وهو (${dOrders}) طلب فقط وهو أقل من الحد الأدنى المسموح به. نرجو رفع الأداء فوراً لتجنب الإجراءات.` : getAbsenceMessage(firstName, platformName);
    window.open(`https://wa.me/${acc.phone.replace(/\D/g,'').replace(/^05/,'9665')}?text=${encodeURIComponent(messageText)}`, '_blank'); btn.classList.replace('btn-success', 'btn-secondary'); btn.innerHTML = 'تم الإنذار'; btn.disabled = true;
}

function fixDuplicates() { database.ref('ninja_data/accounts').once('value').then(snap => { let accs = snap.val(); if(!accs) return; let clean = {}; Object.keys(accs).forEach(k => { if(accs[k] && accs[k].id) clean[accs[k].id] = accs[k]; }); database.ref('ninja_data/accounts').set(clean).then(() => { logAudit('صيانة النظام', 'System', 'تم تنظيف الحسابات المكررة'); location.reload(); }); }); }

function openAdminsFromSettings() {
    const s = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
    if (s) s.hide();
    setTimeout(() => { if (typeof openAdminsModal === 'function') openAdminsModal(); }, 300);
}

function openSettingsModalAddon() {
    // [SECURITY] section locks + WhatsApp tokens are admin-only; hide them for non-admins
    const isAdm = isAdminOrSuper();
    const adminBox = document.getElementById('settingsAdminOnly');
    if (adminBox) adminBox.style.display = isAdm ? '' : 'none';
    const note = document.getElementById('settingsNonAdminNote');
    if (note) note.style.display = isAdm ? 'none' : '';
    new bootstrap.Modal(document.getElementById('settingsModal')).show();
}
function openAdminsModal() { new bootstrap.Modal(document.getElementById('adminsModal')).show(); }

function openTrashModal() {
    if(!hasPerm('trash')) return alert('❌ ليس لديك صلاحية الوصول لسلة المحذوفات. تواصل مع الأدمن.');
    const tbody = document.getElementById('trashTableBody'); tbody.innerHTML = `<tr><td colspan="5" class="text-muted py-5 fs-5">${t('trash_loading')}</td></tr>`;
    database.ref('ninja_data/deleted_accounts').once('value').then(snap => {
        const deletedData = snap.val(); if (!deletedData) { tbody.innerHTML = `<tr><td colspan="5" class="text-success py-5 fs-5 fw-bold">${t('trash_empty')}</td></tr>`; return; }
        let html = ''; Object.values(deletedData).forEach(acc => { if(!acc) return; let pEmoji = acc.platform === 'keeta' ? '🚴' : (acc.platform === 'hunger' ? '📦' : (acc.platform === 'jahez' ? '🛒' : (acc.platform === 'chefz' ? '👨‍🍳' : '🥷'))); let pIcon = `${pEmoji} ${t('pname_' + (acc.platform || 'ninja'))}`; let dAt = acc.deletedAt || '-'; let dBy = acc.deletedBy || 'admin'; let name = (acc.actualUserName && acc.actualUserName !== '-') ? acc.actualUserName : acc.ownerName; html += `<tr><td><span class="badge bg-dark">${pIcon}</span></td><td><b class="text-danger fs-5">#${acc.id}</b></td><td><b class="fs-5">${escHtml(name)}</b></td><td><span class="badge bg-secondary fs-6" dir="ltr">${dAt}</span><br><span class="badge bg-dark text-warning fs-6"><i class="bi bi-person"></i> ${dBy}</span></td><td><button onclick="restoreFromTrash('${acc.id}')" class="btn btn-success fw-bold shadow-sm"><i class="bi bi-arrow-counterclockwise"></i> ${t('btn_restore_account')}</button></td></tr>`; }); tbody.innerHTML = html;
    });
    new bootstrap.Modal(document.getElementById('trashModal')).show();
}

function restoreFromTrash(id) {
    swalConfirm("هل تريد إعادة الحساب للوحة النشطة؟ ♻️", { confirmText: 'نعم، استعد', icon: 'question' }).then(function(_ok) { if (_ok) {
        database.ref('ninja_data/deleted_accounts/' + id).once('value').then(snap => {
            let acc = snap.val(); if(acc) { delete acc.deletedAt; delete acc.deletedBy; let updates = {}; updates['ninja_data/accounts/' + id] = acc; updates['ninja_data/deleted_accounts/' + id] = null; database.ref().update(updates).then(() => { logAudit('استرجاع حساب', id, 'تم إعادة الحساب من سلة المحذوفات'); alert("تم استرجاع الحساب بنجاح!"); location.reload(); }); }
        });
    } });
}

function toggleDarkModeSetting() { document.body.classList.toggle('dark-mode', document.getElementById('themeToggle').checked); localStorage.setItem('dark_mode', document.body.classList.contains('dark-mode')); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); let isDark = document.body.classList.contains('dark-mode'); localStorage.setItem('dark_mode', isDark); if(document.getElementById('themeToggle')) document.getElementById('themeToggle').checked = isDark; }
// ── My Account / change own password ──────────────────────────────────────
function openMyAccount() {
    const u = window.loggedInUser;
    if (!u || !adminUsers[u]) { alert('❌ يجب تسجيل الدخول أولاً'); return; }
    const me = adminUsers[u];
    document.getElementById('myAccUsername').value   = u;
    document.getElementById('myAccName').value       = me.name || '';
    document.getElementById('myAccCurrentPass').value = '';
    document.getElementById('myAccNewPass').value     = '';
    document.getElementById('myAccConfirmPass').value = '';
    // [SECURITY] changing own password is restricted to super_admin only
    let pwSection = document.getElementById('myAccPasswordSection');
    if (pwSection) pwSection.style.display = (me.role === 'super_admin') ? '' : 'none';
    if (typeof _refreshBioUI === 'function') _refreshBioUI(); // [MODULES] show biometric enable/disable controls
    new bootstrap.Modal(document.getElementById('myAccountModal')).show();
}

async function saveMyAccount() {
    const u = window.loggedInUser;
    if (!u || !adminUsers[u]) { alert('❌ يجب تسجيل الدخول أولاً'); return; }
    const me = adminUsers[u];
    const newName = document.getElementById('myAccName').value.trim();
    const cur = document.getElementById('myAccCurrentPass').value;
    const np  = document.getElementById('myAccNewPass').value;
    const cp  = document.getElementById('myAccConfirmPass').value;

    if (!newName) return alert('❌ الاسم مطلوب');

    let updates = { name: newName };

    // password change requested only if any password field is filled
    if (cur || np || cp) {
        // [SECURITY] only super_admin may change a password (even their own)
        if (me.role !== 'super_admin') return alert('❌ تغيير كلمة المرور متاح للسوبر أدمن فقط');
        // verify current password against the stored hash (or a legacy plaintext record)
        const curOk = (typeof me.password === 'string' && me.password.indexOf('sha256$') === 0)
            ? (me.password === await hashPassword(u, cur))
            : (me.password === cur);
        if (!curOk) return alert('❌ كلمة المرور الحالية غير صحيحة');
        if ((np || '').length < 6) return alert('⚠️ كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
        if (np !== cp) return alert('❌ تأكيد كلمة المرور لا يطابق');
        updates.password = await hashPassword(u, np);
    }

    database.ref('ninja_data/admins/' + u).update(updates).then(() => {
        adminUsers[u].name = newName;
        if (updates.password) {
            adminUsers[u].password = updates.password;
            // keep the saved session / auto-login in sync with the new password hash
            sessionStorage.setItem('ninja_phash', updates.password);
            sessionStorage.removeItem('ninja_pass');
            if (localStorage.getItem('ninja_user') === u) { localStorage.setItem('ninja_phash', updates.password); localStorage.removeItem('ninja_pass'); }
        }
        logAudit('تعديل بيانات', u, updates.password ? 'غيّر اسمه وكلمة مروره' : 'غيّر اسمه');
        let navName = document.getElementById('navUserName');
        let navAvatar = document.getElementById('navUserAvatar');
        if (navName) navName.textContent = newName;
        if (navAvatar) navAvatar.textContent = (newName || u).charAt(0).toUpperCase();
        let m = bootstrap.Modal.getInstance(document.getElementById('myAccountModal')); if (m) m.hide();
        alert('✅ تم حفظ بيانات حسابك بنجاح');
    }).catch(() => alert('❌ حدث خطأ أثناء الحفظ'));
}

async function confirmLogout() {
    const ok = await swalConfirm(
        L('هل تريد تسجيل الخروج من النظام؟', 'Do you want to log out of the system?'),
        { icon: 'question',
          confirmText: L('نعم، خروج', 'Yes, log out'),
          cancelText:  L('إلغاء', 'Cancel') }
    );
    if (ok) logout();
}

function logout() {
    logAudit('تسجيل خروج', 'System', 'تم الخروج من النظام');
    localStorage.removeItem('ninja_user');
    localStorage.removeItem('ninja_pass');
    localStorage.removeItem('ninja_phash');
    sessionStorage.removeItem('ninja_user');
    sessionStorage.removeItem('ninja_pass');
    sessionStorage.removeItem('ninja_phash');
    sessionStorage.removeItem('currentPlatformTab');
    location.reload();
}

// =====================================
// المالية (تحليل الفواتير)
// =====================================
function readNinjaInvoice(e) {
    if(!hasPerm('ninja_invoice')) return alert('❌ ليس لديك صلاحية إدراج فاتورة نينجا. تواصل مع الأدمن.');
    const file = e.target.files[0]; if (!file) return;
    // الانتقال لقسم المالية لعرض النتائج
    requestTabSwitch('finance');
    document.getElementById('ninjaFinanceHead').innerHTML = `<tr><td class="text-primary py-5 fs-5 fw-bold"><i class="bi bi-hourglass-split"></i> ${t('finance_loading')}</td></tr>`; document.getElementById('ninjaFinanceBody').innerHTML = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = new Uint8Array(ev.target.result); const workbook = XLSX.read(data, { type: 'array' }); const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
            if(jsonData.length === 0) return alert("الملف فارغ."); 
            let aggregatedData = {};
            jsonData.forEach(row => {
                let keys = Object.keys(row); let getVal = (str) => { let k = keys.find(key => key.toLowerCase().trim().includes(str)); return k ? row[k] : null; };
                let captainId = getVal('captain_id') || getVal('يوزر') || getVal('رقم المندوب') || getVal('مندوب');
                if (!captainId) { for(let k in row) { let key = String(k).toLowerCase().trim(); if ((key.includes('مندوب') || key.includes('يوزر') || key.includes('user') || key.includes('كابتن') || key === 'id' || key.includes('رقم')) && !key.includes('شفت') && !key.includes('shift')) { captainId = row[k]; break; } } }
                if (!captainId || String(captainId).trim() === "") return; captainId = String(captainId).trim();

                let acc = window.allRawAccounts.find(a => String(a.id) === String(captainId)); let platform = acc && acc.platform ? acc.platform : 'ninja'; 
                let amount = parseFloat(getVal('amount') || getVal('مبلغ') || getVal('إجمالي') || getVal('اجمالي') || 0); let ordersVal = getVal('total_delivered_orders') || getVal('طلبات');
                if (ordersVal === null) { for(let k in row) { let key = String(k).toLowerCase().trim(); if (key.includes('طلب') || key.includes('order')) { ordersVal = row[k]; break; } } }
                let orders = parseInt(ordersVal) || 0; let fines = 0; let fineVal = getVal('غرام') || getVal('تسوي') || getVal('خصم');
                if (fineVal !== null) { fines += Math.abs(parseFloat(fineVal) || 0); } if(amount < 0) { fines += Math.abs(amount); amount = 0; }

                if(!aggregatedData[captainId]) { aggregatedData[captainId] = { id: captainId, actualName: acc ? acc.actualUserName : '---', ownerName: acc ? acc.ownerName : '---', platform: platform, totalOrders: 0, validDays: 0, invalidDays: 0, validAmount: 0, invalidAmount: 0, fines: 0 }; }
                let driver = aggregatedData[captainId]; driver.totalOrders += orders; driver.fines += fines; if (amount === 0 && orders === 0 && fines === 0) return;
                let isValid = amount >= 230.76; if (isValid) { driver.validDays += 1; driver.validAmount += amount; } else { if(amount > 0 || orders > 0) { driver.invalidDays += 1; driver.invalidAmount += amount; } }
            });

            const thead = document.getElementById('ninjaFinanceHead'); const tbody = document.getElementById('ninjaFinanceBody');
            thead.innerHTML = `<tr><th class="bg-dark text-white">رقم المندوب (ID)</th><th class="bg-dark text-white">مالك الحساب</th><th class="bg-dark text-white">المستخدم الفعلي</th><th class="bg-dark text-white">إجمالي الطلبات</th><th class="bg-dark text-success">الأيام الصالحة</th><th class="bg-dark text-danger">الأيام الغير صالحة</th><th class="bg-dark text-success">مبالغ الأيام الصالحة</th><th class="bg-dark text-danger">مبالغ الغير صالحة</th><th class="bg-dark text-warning">الغرامات</th><th class="bg-dark text-info">الإجمالي الكلي (SAR)</th></tr>`;
            let rowsHtml = ''; let tV = 0, tI = 0, tF = 0;
            Object.values(aggregatedData).forEach(driver => {
                let totalAmount = driver.validAmount + driver.invalidAmount - driver.fines; tV += driver.validDays; tI += driver.invalidDays; tF += driver.fines;
                rowsHtml += `<tr><td><b class="text-primary fs-5">${driver.id}</b></td><td><b class="fs-6">${escHtml(driver.ownerName)}</b></td><td><b class="fs-6 text-primary">${driver.actualName}</b></td><td><b class="fs-5">${driver.totalOrders}</b></td><td><b class="text-success fs-5">${driver.validDays}</b></td><td><b class="text-danger fs-5">${driver.invalidDays}</b></td><td><b class="text-success fs-5" dir="ltr">${driver.validAmount.toFixed(2)}</b></td><td><b class="text-danger fs-5" dir="ltr">${driver.invalidAmount.toFixed(2)}</b></td><td><b class="text-warning text-dark fs-5" dir="ltr">${driver.fines.toFixed(2)}</b></td><td><b class="text-info fs-4" dir="ltr">${totalAmount.toFixed(2)}</b></td></tr>`;
            });
            tbody.innerHTML = rowsHtml; document.getElementById('financeSummaryCards').style.display = 'flex'; document.getElementById('finTotalDrivers').innerText = Object.keys(aggregatedData).length; document.getElementById('finTotalValid').innerText = tV; document.getElementById('finTotalInvalid').innerText = tI; document.getElementById('finTotalFines').innerText = tF.toFixed(2);
            logAudit('تحليل مالي', 'فاتورة اكسيل', 'تم استيراد وتحليل فاتورة مالية'); alert("تم تجميع وتحليل فاتورة النظام بنجاح! 📊");
        } catch (err) { alert("حدث خطأ أثناء قراءة الملف ❌"); }
    }; reader.readAsArrayBuffer(file); e.target.value = ''; 
}
function exportFinanceData() { const wb = XLSX.utils.table_to_book(document.getElementById('ninjaFinanceTable')); XLSX.writeFile(wb, `Finance_Report.xlsx`); logAudit('تصدير مالي', 'Excel', 'تم تحميل التقرير المالي الشامل');}
// =====================================
// محرك الواتساب الآلي (WhatsApp API Bot)
// =====================================

// [SECURITY] No secrets in source. Loaded at runtime from the (locked) DB:
// ninja_data/settings/ultramsg  → { instance, token }.  Set them from Settings.
let ULTRAMSG_INSTANCE = "";
let ULTRAMSG_TOKEN = "";

// دالة إرسال الرسالة عبر السيرفر
async function sendUltraMsg(phone, message) {
    if (!ULTRAMSG_INSTANCE || !ULTRAMSG_TOKEN || ULTRAMSG_INSTANCE.includes("put_your")) {
        console.error("لم يتم إعداد بيانات UltraMsg بعد.");
        return false;
    }
    
    let formattedPhone = normalizeSaudiPhone(phone);
    if (!formattedPhone) {
        console.error('Invalid phone number for UltraMsg:', phone);
        return false;
    }
    const url = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE}/messages/chat`;
    
    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                token: ULTRAMSG_TOKEN,
                to: formattedPhone,
                body: message
            })
        });
        let result = await response.json();
        let sent = result && (result.sent === "true" || result.sent === true || result.id);
        if (!sent) {
            console.error('UltraMsg response failure', formattedPhone, result);
        }
        return sent;
    } catch (error) {
        console.error("خطأ في الاتصال بسيرفر الواتساب:", error);
        return false;
    }
}

// دالة إرسال الإنذارات الجماعية بضغطة زر
async function sendBulkAutomatedWarnings() {
    if (!ULTRAMSG_INSTANCE || ULTRAMSG_INSTANCE.includes("put_your")) {
        return alert("❌ لم يتم تفعيل الـ API بعد. يرجى وضع مفاتيح UltraMsg في ملف app.js");
    }

    let _ok = await swalConfirm("هل أنت متأكد من إرسال إنذارات آلية في الخلفية لجميع المقصرين في هذا القسم؟"); if (!_ok) return;

    // جلب قائمة المقصرين في القسم المفتوح حالياً
    let platformAccs = window.allRawAccounts.filter(a => {
        if (!a || (a.platform||'ninja') !== currentPlatformTab) return false;
        if (!(a.status === 'قيد الاستخدام' || a.status === 'مصروف')) return false;
        let orders = Number(a.dailyOrders) || 0;
        return orders < 15;
    });
    
    if (platformAccs.length === 0) return alert("لا يوجد مقصرين لإرسال إنذارات لهم اليوم! 🎉");

    let successCount = 0;
    let btn = document.getElementById('btnBulkWhatsapp');
    if(btn) { btn.disabled = true; btn.innerHTML = `<i class="bi bi-hourglass-split"></i> ${t('lbl_sending_msgs')} ${platformAccs.length} ${t('lbl_message')}`; }

    // المرور على المناديب وإرسال الرسائل
    for (let acc of platformAccs) {
        if(!acc.phone || acc.phone === '-' || acc.phone.length < 9) continue;
        
        let dOrders = Number(acc.dailyOrders) || 0; 
        let firstName = acc.actualUserName !== '-' ? acc.actualUserName.split(' ')[0] : 'كابتن'; 
        let platformName = currentPlatformTab === 'keeta' ? 'كيتا' : (currentPlatformTab === 'hunger' ? 'هنقرستيشن' : (currentPlatformTab === 'jahez' ? 'جاهز' : (currentPlatformTab === 'chefz' ? 'ذا شفز' : 'نينجا')));
        
        // رسالة احترافية تتغير حسب إن كان أداؤه ضعيف أو غياب تام
        let messageText = dOrders > 0 
            ? `🚨 *تنبيه آلي من نظام SpeedPro* 🚨\n\nأهلاً بك كابتن ${firstName}،\nمعك إدارة التشغيل (${platformName}).\nلاحظنا أن أداءك اليوم (${dOrders}) طلب فقط وهو أقل من الحد الأدنى المسموح به.\nنرجو رفع الأداء فوراً لتجنب الإجراءات الإدارية.` 
            : getAbsenceMessage(firstName, platformName);

        let isSent = await sendUltraMsg(acc.phone, messageText);
        if(isSent) successCount++;
        
        // سر المهنة: تأخير ثانية ونصف بين كل رسالة لتجنب حظر الواتساب لرقمك
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // إعادة الزر لشكله الطبيعي
    if(btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-robot"></i> ${t('btn_auto_send_all')}`; }
    alert(`✅ تمت العملية! تم إرسال (${successCount}) رسالة بنجاح.`);
    logAudit('إنذار آلي جماعي', currentPlatformTab, `تم إرسال ${successCount} رسالة واتساب للمقصرين عبر الـ API`);
}

function sendRechargeWhatsApp(phone, name, wallet) {
    if (!phone || phone === '-') return alert('رقم الجوال غير متوفر');
    const phoneNorm = normalizeSaudiPhone(phone);
    const waNumber = phoneNorm ? phoneNorm.replace(/^966/, '') : phone.replace(/\D/g,'');
    const msg = `🚨 رصد إليك من نظام SpeedPro / SpeedPro System Alert 🚨\n\n` +
        `أهلاً ${name || ''},\n` +
        `رصيد محفظتك ${wallet} ر.س وتجاوز الحد المسموح (150 ر.س).\n` +
        `يرجى شحن المحفظة فوراً لتجنب إيقاف الحساب وعدم توقيع غرامة عليك.\n\n` +
        `Hello ${name || ''},\n` +
        `Your wallet balance is ${wallet} SAR and exceeded the allowed limit (150 SAR).\n` +
        `Please recharge your wallet immediately to avoid account suspension and to avoid any fines.\n\n` +
        `SpeedPro System Notice`;
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function resolveWalletAlert(id) {
    let _ok = await swalConfirm('هل تريد إزالة إنذار المحفظة لهذا الحساب وحل الحالة؟'); if (!_ok) return;
    const updates = {};
    updates[`ninja_data/accounts/${id}/walletAlertSentAt`] = null;
    // أيضًا مسح أي إنذارات في مسار التنبيهات لنفس الحساب
    database.ref('ninja_data/alerts').orderByChild('accountId').equalTo(id).once('value').then(snap => {
        snap.forEach(child => { updates[`ninja_data/alerts/${child.key}`] = null; });
        database.ref().update(updates).then(() => {
            alert('تم حل إنذار المحفظة بنجاح');
            logAudit('حل إنذار المحفظة', id, `تم حل إنذار المحفظة يدوياً`);
        }).catch(err => { console.error('resolveWalletAlert error', err); alert('حدث خطأ أثناء الحل'); });
    }).catch(err => { console.error('resolveWalletAlert lookup error', err); alert('حدث خطأ أثناء البحث عن الإنذارات'); });
}

function sendWalletWarning(id) {
    const acc = window.allRawAccounts.find(a => a && a.id == id);
    if (!acc) return alert('لم يتم العثور على الحساب المطلوب');
    if (!acc.phone || acc.phone === '-') return alert('رقم الجوال غير موجود');
    // فتح واتساب بنفس الصيغة
    sendRechargeWhatsApp(acc.phone, acc.actualUserName || acc.ownerName, acc.wallet);

    // سجل الإنذار في قاعدة البيانات وعلامة ختم زمني
    const key = Date.now() + '_' + id;
    const alertObj = { id: key, accountId: id, accountName: acc.ownerName || acc.actualUserName || '-', phone: acc.phone, wallet: acc.wallet, createdAt: new Date().toISOString(), type: 'wallet_manual_warning', message: `يرجى شحن المحفظة لتجنب إيقاف الحساب. الرصيد الحالي: ${acc.wallet}` };
    const updates = {};
    updates['ninja_data/alerts/' + key] = alertObj;
    updates['ninja_data/accounts/' + id + '/walletAlertSentAt'] = new Date().toISOString();
    database.ref().update(updates).then(() => { logAudit('إرسال إنذار محفظة يدوي', id, `تم إرسال إنذار محفظة إلى ${acc.phone}`); alert('تم إرسال رسالة الإنذار عبر واتساب وتسجيلها في النظام.'); }).catch(err => { console.error('sendWalletWarning error', err); alert('حدث خطأ أثناء تسجيل الإنذار'); });
}

// ==================================================================
// 🏠 الصفحة الرئيسية + حالة الاتصال + قسم السيارات + الموارد البشرية
// ==================================================================

// --- أدوات مساعدة ---
const HOME_PLATFORMS = ['ninja', 'keeta', 'hunger', 'jahez', 'chefz'];
function _isUsed(acc) { return acc.status === 'قيد الاستخدام' || acc.status === 'مصروف'; }
function daysUntil(dateStr) {
    if (!dateStr) return null;
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    let today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.ceil((d - today) / (1000 * 60 * 60 * 24));
}
function expiryCell(dateStr) {
    if (!dateStr) return `<span class="text-muted">-</span>`;
    let d = daysUntil(dateStr);
    let cls = d < 0 ? 'bg-danger' : (d <= 30 ? 'bg-warning text-dark' : 'bg-success');
    let note = d < 0 ? t('alert_expired') : `${d} ${t('alert_days')}`;
    return `<span class="badge ${cls}" dir="ltr">${dateStr}</span><br><small class="${d < 0 ? 'text-danger' : (d <= 30 ? 'text-warning' : 'text-muted')} fw-bold">${escHtml(note)}</small>`;
}
function miniExpiry(dateStr) {
    if (!dateStr) return `<small class="text-muted">-</small>`;
    let d = daysUntil(dateStr);
    let cls = d < 0 ? 'text-danger' : (d <= 30 ? 'text-warning' : 'text-success');
    return `<small class="${cls} fw-bold" dir="ltr">${dateStr}</small>`;
}
function filterSimpleTable(tbodyId, val) {
    let tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    val = (val || '').toLowerCase();
    tbody.querySelectorAll('tr').forEach(row => { row.style.display = row.innerText.toLowerCase().includes(val) ? '' : 'none'; });
}

// --- نظام حالة الاتصال (Firebase Presence) ---
function setupPresence(user) {
    try {
        let userRef = database.ref('ninja_data/presence/' + user);
        let connectedRef = database.ref('.info/connected');
        connectedRef.on('value', snap => {
            if (snap.val() === true) {
                userRef.onDisconnect().remove();
                userRef.set({ online: true, name: (adminUsers[user] && adminUsers[user].name) || user, last: Date.now() });
            }
        });
    } catch (e) { console.error('presence error', e); }
}

// --- الصفحة الرئيسية ---
function platformStats() {
    let stats = {};
    HOME_PLATFORMS.forEach(p => stats[p] = { total: 0, avail: 0, used: 0, daily: 0, orders: 0 });
    (window.allRawAccounts || []).forEach(a => {
        if (!a) return;
        let p = a.platform || 'ninja';
        if (!stats[p]) return;
        stats[p].total++;
        if (_isUsed(a)) stats[p].used++; else stats[p].avail++;
        stats[p].daily += String(a.dailyOrders).includes('غياب') ? 0 : (Number(a.dailyOrders) || 0);
        stats[p].orders += Number(a.totalOrders || 0);
    });
    return stats;
}

function renderHome() {
    renderHomeKpis();
    renderHomeSectionCards();
    renderHomeCharts();
    renderSupervisorsStatus();
    renderHomeAlerts();
    renderHomeFinance();
    renderHomeActivity();
}

// [HOME] تحريك الأرقام تصاعدياً (count-up) — تأثير حيّ عند فتح الرئيسية/تحديث البيانات
function _animateCount(el, to, dur, from) {
    from = Number(from) || 0; to = Number(to) || 0; dur = dur || 700;
    if (from === to || !window.requestAnimationFrame) { el.textContent = to.toLocaleString(); return; }
    const t0 = performance.now();
    (function step(now) {
        let p = Math.min(1, (now - t0) / dur);
        p = 1 - Math.pow(1 - p, 3); // easeOutCubic
        el.textContent = Math.round(from + (to - from) * p).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
    })(t0);
}

function renderHomeKpis() {
    let row = document.getElementById('homeKpiRow');
    if (!row) return;
    const _prev = Array.from(row.querySelectorAll('.kpi-num')).map(el => Number(String(el.textContent).replace(/[^\d.-]/g, '')) || 0);
    let accs = (window.allRawAccounts || []).filter(a => a);
    let total = accs.length;
    let avail = accs.filter(a => !_isUsed(a)).length;
    let used = accs.filter(a => _isUsed(a)).length;
    let daily = accs.reduce((x, a) => x + (String(a.dailyOrders).includes('غياب') ? 0 : (Number(a.dailyOrders) || 0)), 0);
    let cars = (window.allCars || []).length;
    let emps = (window.allRawAccounts || []).length;
    let cards = [
        { label: t('home_kpi_accounts'), val: total, color: 'var(--primary)', icon: 'people-fill' },
        { label: t('status_available'), val: avail, color: 'var(--success)', icon: 'check-circle-fill' },
        { label: t('home_inuse'), val: used, color: 'var(--danger)', icon: 'person-dash-fill' },
        { label: t('home_today_orders'), val: daily, color: '#0891b2', icon: 'graph-up-arrow' },
        { label: t('home_kpi_cars'), val: cars, color: '#0f766e', icon: 'car-front-fill' },
        { label: t('home_kpi_emps'), val: emps, color: '#7c3aed', icon: 'person-badge-fill' }
    ];
    row.innerHTML = cards.map(c => `
        <div class="col-6 col-md-4 col-lg-2">
            <div class="stat-card glass-kpi" style="--accent:${c.color};">
                <div class="kpi-ic"><i class="bi bi-${c.icon}"></i></div>
                <h2 class="kpi-num" data-target="${c.val}" style="color:var(--accent); font-variant-numeric:tabular-nums;">${c.val}</h2>
                <h5>${c.label}</h5>
            </div>
        </div>`).join('');
    // animate from the previous value (or 0 on first render) to the new value
    Array.from(row.querySelectorAll('.kpi-num')).forEach((el, i) => _animateCount(el, Number(el.dataset.target) || 0, 850, _prev[i] != null ? _prev[i] : 0));
}

function renderHomeSectionCards() {
    let container = document.getElementById('homeSectionCards');
    if (!container) return;

    let totalCars = (window.allCars || []).length;
    let openAccidents = Object.values(window.allAccidents || {}).filter(a => a && a.status !== 'تم الحل' && a.status !== 'مغلقة').length;
    let pendingMaint = Object.values(window.allCarMaintenance || {}).filter(m => m && m.status !== 'منجزة').length;

    let totalUnits = Object.values(window.allHousingUnits || {}).length;
    let occupiedUnits = Object.values(window.allHousingResidents || {}).filter(r => r && r.status === 'ساكن').length;
    let urgentMaint = Object.values(window.allHousingMaintenance || {}).filter(m => m && m.priority === 'عاجل' && m.status !== 'تم الإصلاح').length;

    let debtors = (window.allRawAccounts || []).filter(a => a && Number(a.wallet||0) < 0);
    let totalDebt = debtors.reduce((x, a) => x + Math.abs(Number(a.wallet||0)), 0);
    let todayMonth = new Date().toISOString().slice(0,7);
    let monthlyTx = Object.values(window.allTransactions || {}).filter(t => t && t.date && String(t.date).startsWith(todayMonth)).length;

    let totalAccounts = (window.allRawAccounts || []).filter(a => a).length;
    let activeToday = (window.allRawAccounts || []).filter(a => a && !String(a.dailyOrders||'').includes('غياب') && Number(a.dailyOrders||0) > 0).length;
    let suspendedCount = (window.allRawAccounts || []).filter(a => a && a.status === 'موقوف').length;

    let cards = [
        {
            icon: 'car-front-fill', color: '#0f766e', title: 'المركبات',
            kpis: [
                { label: 'إجمالي السيارات', val: totalCars, color: '#0f766e' },
                { label: 'حوادث مفتوحة', val: openAccidents, color: openAccidents > 0 ? '#ef4444' : '#10b981' },
                { label: 'صيانة معلقة', val: pendingMaint, color: pendingMaint > 0 ? '#f59e0b' : '#10b981' }
            ],
            tab: 'cars', btn: 'عرض المركبات'
        },
        {
            icon: 'house-fill', color: '#0891b2', title: 'السكن',
            kpis: [
                { label: 'إجمالي الوحدات', val: totalUnits, color: '#0891b2' },
                { label: 'ساكن حالياً', val: occupiedUnits, color: '#10b981' },
                { label: 'صيانة عاجلة', val: urgentMaint, color: urgentMaint > 0 ? '#ef4444' : '#10b981' }
            ],
            tab: 'housing', btn: 'عرض السكن'
        },
        {
            icon: 'cash-stack', color: '#1e40af', title: 'المالية',
            kpis: [
                { label: 'عدد المديونين', val: debtors.length, color: debtors.length > 0 ? '#ef4444' : '#10b981' },
                { label: 'إجمالي الديون', val: totalDebt.toLocaleString() + ' ر.س', color: debtors.length > 0 ? '#ef4444' : '#10b981' },
                { label: 'معاملات الشهر', val: monthlyTx, color: '#1e40af' }
            ],
            tab: 'finance', btn: 'عرض المالية'
        },
        {
            icon: 'people-fill', color: '#7c3aed', title: 'الحسابات',
            kpis: [
                { label: 'إجمالي الحسابات', val: totalAccounts, color: '#7c3aed' },
                { label: 'نشط اليوم', val: activeToday, color: '#10b981' },
                { label: 'موقوفة', val: suspendedCount, color: suspendedCount > 0 ? '#f59e0b' : '#10b981' }
            ],
            tab: 'ninja', btn: 'عرض الحسابات'
        }
    ];

    container.innerHTML = cards.map(card => `
        <div class="col-6 col-lg-3">
            <div class="card-custom p-3 h-100 d-flex flex-column" style="border-top:4px solid ${card.color};">
                <div class="d-flex align-items-center gap-2 mb-3">
                    <i class="bi bi-${card.icon} fs-4" style="color:${card.color};"></i>
                    <span class="fw-bold">${escHtml(card.title)}</span>
                </div>
                <div class="flex-grow-1">
                    ${card.kpis.map(k => `
                        <div class="d-flex justify-content-between align-items-center mb-2 py-1 border-bottom border-opacity-10">
                            <small class="text-muted">${k.label}</small>
                            <b style="color:${k.color}; font-size:0.95rem;">${k.val}</b>
                        </div>`).join('')}
                </div>
                <button onclick="requestTabSwitch('${card.tab}')" class="btn btn-sm fw-bold mt-3 text-white w-100" style="background:${card.color}; border-radius:10px;">
                    ${card.btn} <i class="bi bi-arrow-left-circle-fill ms-1"></i>
                </button>
            </div>
        </div>`).join('');
}

function makeChart(id, config) {
    let canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    if (!window.homeCharts) window.homeCharts = {};
    if (window.homeCharts[id]) { try { window.homeCharts[id].destroy(); } catch (e) {} }
    window.homeCharts[id] = new Chart(canvas, config);
}

function renderHomeCharts() {
    if (typeof Chart === 'undefined') return;
    let s = platformStats();
    let labels = HOME_PLATFORMS.map(p => t('pname_' + p));
    let daily = HOME_PLATFORMS.map(p => s[p].daily);
    let orders = HOME_PLATFORMS.map(p => s[p].orders);
    let counts = HOME_PLATFORMS.map(p => s[p].total);
    let colors = ['#048ba3', '#ea580c', '#ca8a04', '#16a34a', '#7c3aed'];

    makeChart('chartOrders', {
        type: 'bar',
        data: {
            labels, datasets: [
                { label: t('home_today_orders'), data: daily, backgroundColor: '#4361ee', borderRadius: 8 },
                { label: t('home_total_orders'), data: orders, backgroundColor: '#10b981', borderRadius: 8 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
    });

    let totalAvail = HOME_PLATFORMS.reduce((x, p) => x + s[p].avail, 0);
    let totalUsed = HOME_PLATFORMS.reduce((x, p) => x + s[p].used, 0);
    makeChart('chartStatus', {
        type: 'doughnut',
        data: { labels: [t('status_available'), t('home_inuse')], datasets: [{ data: [totalAvail, totalUsed], backgroundColor: ['#10b981', '#ef4444'], borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    makeChart('chartAccounts', {
        type: 'bar',
        data: { labels, datasets: [{ label: t('home_accounts_count'), data: counts, backgroundColor: colors, borderRadius: 8 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
    });

    // Fleet status doughnut
    let accidentPlates = new Set(Object.values(window.allAccidents||{}).filter(a => a && a.status !== 'تم الحل' && a.status !== 'مغلقة').map(a => a.plate).filter(Boolean));
    let maintPlates    = new Set(Object.values(window.allCarMaintenance||{}).filter(m => m && m.status !== 'منجزة').map(m => m.plate).filter(Boolean));
    let fleetGood = 0, fleetMaint = 0, fleetIssue = 0;
    (window.allCars||[]).forEach(c => {
        if (accidentPlates.has(c.plate))   fleetIssue++;
        else if (maintPlates.has(c.plate)) fleetMaint++;
        else                                fleetGood++;
    });
    makeChart('chartFleetStatus', {
        type: 'doughnut',
        data: { labels: ['سليمة ✅', 'صيانة معلقة 🔧', 'حوادث مفتوحة ⚠️'], datasets: [{ data: [fleetGood, fleetMaint, fleetIssue], backgroundColor: ['#10b981','#f59e0b','#ef4444'], borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // Financial trend line (last 6 months)
    let txByMonth = {};
    Object.values(window.allTransactions||{}).forEach(tx => {
        if (!tx || !tx.date) return;
        let m = String(tx.date).slice(0,7);
        txByMonth[m] = (txByMonth[m]||0) + Math.abs(Number(tx.amount||0));
    });
    let trendMonths = [];
    let now = new Date();
    for (let i = 5; i >= 0; i--) {
        let dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
        trendMonths.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
    }
    makeChart('chartFinanceTrend', {
        type: 'line',
        data: {
            labels: trendMonths,
            datasets: [{ label: 'إجمالي المعاملات (ر.س)', data: trendMonths.map(m => txByMonth[m]||0), borderColor: '#1e40af', backgroundColor: 'rgba(30,64,175,0.1)', fill: true, tension: 0.4, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#1e40af' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v.toLocaleString() } } } }
    });
}

function renderSupervisorsStatus() {
    let container = document.getElementById('homeSupervisorsList');
    if (!container) return;
    let presence = window.presenceData || {};
    let users = Object.keys(adminUsers || {});
    if (users.length === 0) { container.innerHTML = `<p class="text-muted">${t('home_no_supervisors')}</p>`; return; }
    container.innerHTML = users.map(u => {
        let info = adminUsers[u] || {};
        let online = presence[u] && presence[u].online;
        let dot = online ? '#10b981' : '#cbd5e1';
        let statusText = online ? t('home_online') : t('home_offline');
        let roleText = info.role === 'super_admin' ? t('role_super') : t('role_supervisor');
        return `<div class="d-flex align-items-center justify-content-between p-2 mb-2 rounded-3" style="background:rgba(0,0,0,0.03);">
            <div class="d-flex align-items-center gap-2">
                <span style="width:13px;height:13px;border-radius:50%;background:${dot};display:inline-block;${online ? 'box-shadow:0 0 0 4px rgba(16,185,129,0.25);' : ''}"></span>
                <div><b>${escHtml(info.name || u)}</b><br><small class="text-muted">${roleText}</small></div>
            </div>
            <span class="badge ${online ? 'bg-success' : 'bg-secondary'}">${statusText}</span>
        </div>`;
    }).join('');
}

function renderHomeAlerts() {
    let container = document.getElementById('homeAlertsList');
    if (!container) return;
    let alerts = [];
    const ALERT_DAYS = 30;
    const TODAY_MONTH = new Date().toISOString().slice(0,7);

    // طلبات رفع التقارير المتأخرة — للأدمن أو من لديه صلاحية report_approve
    let _isSA = isAdminOrSuper() || hasPerm('report_approve');
    if (_isSA) {
        Object.values(window.allReportRequests || {}).forEach(req => {
            if (!req || req.status !== 'pending') return;
            let typeLabel = req.type === 'manual_late' ? '📋 تقرير متأخر يدوي' : req.type === 'reimport' ? '🔄 إعادة رفع تقرير' : '⏰ تجاوز وقت الرفع';
            let reportDateLabel = req.reportDate && req.reportDate !== req.date ? ` | تاريخ التقرير: ${req.reportDate}` : '';
            alerts.push({
                icon: 'clock-history', priority: 'critical',
                text: `${typeLabel} — ${req.supervisorName || req.supervisorId}`,
                sub: `المنصة: ${req.platform || '—'}${reportDateLabel} | الوقت: ${req.requestTime ? new Date(req.requestTime).toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit'}) : '—'} | ${req.reason}`,
                section: null,
                _reqId: req.supervisorId, _isReportReq: true
            });
        });
    }

    // ضعف الأداء المتكرر — نينجا/كيتا/هنقر (حسب الإعدادات)
    let _wpc = wpCfg();
    let _platDates = buildPlatformReportDates();
    (window.allRawAccounts || []).forEach(acc => {
        if (!acc) return;
        let isUsed = acc.status === 'قيد الاستخدام' || acc.status === 'مصروف';
        if (!isUsed) return;
        let wp = getWeakPerf(acc, _platDates);
        if (wp.streak >= _wpc.minStreak) {
            let p = acc.platform || 'ninja';
            let pEmoji = p === 'keeta' ? '🚴' : (p === 'hunger' ? '📦' : '🥷');
            let name = acc.actualUserName || acc.ownerName || ('#' + acc.id);
            let reason = wp.absentDays && wp.lowDays
                ? L(`غياب ${wp.absentDays} + أداء ضعيف ${wp.lowDays}`, `${wp.absentDays} absent + ${wp.lowDays} low`)
                : (wp.absentDays ? L(`غياب متكرر`, `repeated absence`) : L(`أداء ضعيف`, `low output`));
            let escalated = wp.streak >= _wpc.autoWarnStreak;
            alerts.push({
                icon: 'graph-down-arrow',
                priority: escalated ? 'critical' : 'warning',
                text: L(`ضعف أداء متكرر — ${name}`, `Repeated weak performance — ${name}`) + (escalated ? L(' ⚡ مُصعّد', ' ⚡ Escalated') : ''),
                sub: L(`${pEmoji} ${t('pname_'+p)} | أقل من ${_wpc.threshold} طلب لـ ${wp.streak} أيام متتالية (${reason}) — تكرار الضعف ${wp.totalWeak} يوم خلال آخر 30`,
                       `${pEmoji} ${t('pname_'+p)} | under ${_wpc.threshold} orders for ${wp.streak} consecutive days (${reason}) — ${wp.totalWeak} weak of last 30`),
                section: p === 'ninja' ? 'orders' : p,
                _weakId: acc.id
            });
        }
    });

    // Cars — document expiry
    (window.allCars || []).forEach(c => {
        [{ f: 'regExpiry', label: t('cars_th_reg') }, { f: 'insExpiry', label: t('cars_th_insurance') }, { f: 'inspExpiry', label: t('cars_th_inspection') }].forEach(doc => {
            let d = daysUntil(c[doc.f]);
            if (d !== null && d <= ALERT_DAYS) alerts.push({ icon: 'car-front-fill', priority: d < 0 ? 'critical' : 'warning', text: `${doc.label} — ${c.plate || c.type || ''}`, sub: d < 0 ? t('alert_expired') : `${t('alert_in')} ${d} ${t('alert_days')}`, section: 'cars' });
        });
    });

    // HR — document expiry
    let hrData = window.allHrData || {};
    (window.allRawAccounts || []).forEach(acc => {
        let e = hrData[acc.id] || {};
        [{ f: 'iqamaExpiry', label: t('hr_iqama_exp') }, { f: 'licenseExpiry', label: t('hr_license_exp') }, { f: 'contractExpiry', label: t('hr_contract_exp') }].forEach(doc => {
            let d = daysUntil(e[doc.f]);
            if (d !== null && d <= ALERT_DAYS) alerts.push({ icon: 'person-badge-fill', priority: d < 0 ? 'critical' : 'warning', text: `${doc.label} — ${e.name || acc.ownerName || ''}`, sub: d < 0 ? t('alert_expired') : `${t('alert_in')} ${d} ${t('alert_days')}`, section: 'hr' });
        });
    });

    // Housing — contract expiry
    Object.values(window.allHousingUnits || {}).forEach(u => {
        let d = daysUntil(u.contractEnd);
        if (d !== null && d <= ALERT_DAYS) alerts.push({ icon: 'house-fill', priority: d < 0 ? 'critical' : 'warning', text: L(`عقد سكن — ${u.complexName} ${u.unitNumber||''}`, `Housing Contract — ${u.complexName} ${u.unitNumber||''}`), sub: d < 0 ? L(`منتهي منذ ${Math.abs(d)} يوم`, `Expired ${Math.abs(d)} day(s) ago`) : L(`ينتهي خلال ${d} يوم`, `Expires in ${d} day(s)`), section: 'housing' });
    });

    // Housing — urgent maintenance
    Object.values(window.allHousingMaintenance || {}).forEach(m => {
        if (m && m.priority === 'عاجل' && m.status !== 'تم الإصلاح') {
            let unit = (window.allHousingUnits || {})[m.unitId];
            let unitName = unit ? `${unit.complexName} — ${unit.unitNumber}` : '';
            alerts.push({ icon: 'tools', priority: 'critical', text: L(`صيانة عاجلة — ${m.category}${unitName ? ' / ' + unitName : ''}`, `Urgent Maintenance — ${m.category}${unitName ? ' / ' + unitName : ''}`), sub: (m.description || '').slice(0,50) || m.status, section: 'housing' });
        }
    });

    // Housing — residents without payment this month
    let paidThisMonth = new Set();
    Object.values(window.allHousingPayments || {}).forEach(p => {
        if (!p) return;
        let month = p.month || (p.date ? String(p.date).slice(0,7) : '');
        if (month.startsWith(TODAY_MONTH)) {
            let rid = p.residentId || p.resident || p.accountId;
            if (rid) paidThisMonth.add(String(rid));
        }
    });
    Object.values(window.allHousingResidents || {}).forEach(r => {
        if (!r || r.status !== 'ساكن' || !Number(r.monthlyDeduction||0)) return;
        let rid = String(r.id || r.__key || '');
        if (rid && !paidThisMonth.has(rid)) {
            let acc = (window.allRawAccounts||[]).find(a => a && String(a.id) === String(r.accountId));
            let unit = (window.allHousingUnits||{})[r.unitId];
            alerts.push({ icon: 'credit-card-fill', priority: 'info', text: L(`إيجار غير مسجل — ${acc ? acc.ownerName : (r.accountId||'')}`, `Unregistered Rent — ${acc ? acc.ownerName : (r.accountId||'')}`), sub: L(`${unit ? unit.complexName+' '+unit.unitNumber : r.unitId} | الشهر الحالي`, `${unit ? unit.complexName+' '+unit.unitNumber : r.unitId} | Current Month`), section: 'housing' });
        }
    });

    // Cars — open accidents (> 7 days)
    Object.values(window.allAccidents || {}).forEach(a => {
        if (!a || a.status === 'تم الحل' || a.status === 'مغلقة') return;
        let d = daysUntil(a.date);
        if (d !== null && d < -7) alerts.push({ icon: 'exclamation-triangle-fill', priority: 'critical', text: L(`حادثة مفتوحة — ${a.type || ''} — ${a.plate || ''}`, `Open Accident — ${a.type || ''} — ${a.plate || ''}`), sub: L(`مفتوحة منذ ${Math.abs(d)} يوم — الحالة: ${a.status}`, `Open for ${Math.abs(d)} day(s) — Status: ${a.status}`), section: 'cars' });
    });

    // Cars — overdue / soon maintenance
    Object.values(window.allCarMaintenance || {}).forEach(m => {
        if (!m || m.status === 'منجزة') return;
        let byDate = daysUntil(m.nextDate);
        let car    = (window.allCars || []).find(c => c.id === m.carId);
        let curKm  = Number((car || {}).kmTotal || 0);
        let nextKm = Number(m.nextKm || 0);
        let kmOver = nextKm > 0 && curKm >= nextKm;
        let dateOver = byDate !== null && byDate < 0;
        let dateSoon = byDate !== null && byDate >= 0 && byDate <= 7;
        if (dateOver || kmOver) {
            alerts.push({ icon: 'wrench-adjustable-circle-fill', priority: 'critical', text: L(`صيانة متأخرة — ${m.type} — ${m.plate || ''}`, `Overdue Maintenance — ${m.type} — ${m.plate || ''}`), sub: dateOver ? L(`موعدها ${m.nextDate} (متأخر ${Math.abs(byDate)} يوم)`, `Due ${m.nextDate} (${Math.abs(byDate)} day(s) overdue)`) : L(`تجاوز ${curKm.toLocaleString()} / ${nextKm.toLocaleString()} كم`, `${curKm.toLocaleString()} / ${nextKm.toLocaleString()} km exceeded`), section: 'cars' });
        } else if (dateSoon) {
            alerts.push({ icon: 'wrench-adjustable-circle-fill', priority: 'warning', text: L(`صيانة قريبة — ${m.type} — ${m.plate || ''}`, `Upcoming Maintenance — ${m.type} — ${m.plate || ''}`), sub: L(`موعدها ${m.nextDate} (بعد ${byDate} يوم)`, `Due ${m.nextDate} (in ${byDate} day(s))`), section: 'cars' });
        }
    });

    // Finance — drivers with negative wallet
    let debtors = (window.allRawAccounts || []).filter(a => a && Number(a.wallet||0) < 0);
    if (debtors.length > 0) {
        let totalDebt = debtors.reduce((x,a) => x + Math.abs(Number(a.wallet||0)), 0);
        alerts.push({ icon: 'cash-coin', priority: 'warning', text: L(`ديون مناديب — ${debtors.length} مندوب بمحفظة سالبة`, `Rider Debts — ${debtors.length} rider(s) with negative wallet`), sub: L(`إجمالي الديون: ${totalDebt.toLocaleString()} ر.س`, `Total debt: ${totalDebt.toLocaleString()} SAR`), section: 'finance' });
    }

    // Suspended accounts
    let suspended = (window.allRawAccounts || []).filter(a => a && a.status === 'موقوف').length;
    if (suspended > 0) alerts.push({ icon: 'pause-circle-fill', priority: 'info', text: t('alert_suspended_accounts'), sub: L(`${suspended} حساب`, `${suspended} account(s)`), section: 'ninja' });

    // Update badge count
    let badge = document.getElementById('homeAlertsCount');
    if (badge) { badge.textContent = alerts.length || ''; badge.style.display = alerts.length ? '' : 'none'; }

    if (alerts.length === 0) { container.innerHTML = `<div class="text-center text-success py-4 fw-bold"><i class="bi bi-check-circle-fill fs-1 d-block mb-2"></i>${t('home_no_alerts')}</div>`; return; }

    const priorityOrder = { critical: 0, warning: 1, info: 2 };
    const priorityCfg = {
        critical: { color: 'danger'  },
        warning:  { color: 'warning' },
        info:     { color: 'primary' }
    };
    alerts.sort((a, b) => (priorityOrder[a.priority]||2) - (priorityOrder[b.priority]||2));

    // [HOME] أبسط: نعرض أهم 6 تنبيهات فقط مع زر "عرض الكل"
    const HOME_ALERT_LIMIT = 6;
    const _alertsExpanded = !!window._homeAlertsExpanded;
    const _shownAlerts = _alertsExpanded ? alerts : alerts.slice(0, HOME_ALERT_LIMIT);
    container.innerHTML = _shownAlerts.map(a => {
        let pc = priorityCfg[a.priority] || priorityCfg.info;
        let actionBtns = '';
        if (a._isReportReq && a._reqId) {
            actionBtns = `
            <div class="d-flex gap-1 flex-shrink-0">
                <button onclick="approveReportRequest('${a._reqId}')" class="btn btn-success btn-sm py-0 px-2 fw-bold" style="font-size:0.72rem;">✅ ${L('موافقة','OK')}</button>
                <button onclick="rejectReportRequest('${a._reqId}')" class="btn btn-danger btn-sm py-0 px-2 fw-bold" style="font-size:0.72rem;">❌ ${L('رفض','No')}</button>
            </div>`;
        } else if (a._weakId) {
            actionBtns = `<button onclick="openRiderProfile('${a._weakId}')" class="btn btn-outline-${pc.color} btn-sm py-0 px-2 fw-bold flex-shrink-0" style="font-size:0.72rem;"><i class="bi bi-person-vcard"></i> ${L('الملف','Profile')}</button>`;
        } else if (a.section) {
            actionBtns = `<button onclick="requestTabSwitch('${a.section}')" class="btn btn-outline-${pc.color} btn-sm py-0 px-2 fw-bold flex-shrink-0" style="font-size:0.72rem;"><i class="bi bi-arrow-left-short"></i>${L('انتقل','Go')}</button>`;
        }
        return `
        <div class="home-alert-row border-start border-4 border-${pc.color}">
            <i class="bi bi-${a.icon} fs-6 text-${pc.color} flex-shrink-0"></i>
            <div class="flex-grow-1 min-w-0">
                <b class="small d-block text-truncate">${a.text}</b>
                <small class="text-muted">${a.sub}</small>
            </div>
            ${actionBtns}
        </div>`;
    }).join('');
    if (alerts.length > HOME_ALERT_LIMIT) {
        container.innerHTML += `<button onclick="window._homeAlertsExpanded=${!_alertsExpanded}; renderHomeAlerts();" class="btn btn-sm btn-light w-100 fw-bold text-secondary mt-1">${_alertsExpanded ? ('▲ ' + L('عرض أقل','Show less')) : ('▼ ' + L('عرض كل التنبيهات','Show all alerts') + ` (${alerts.length})`)}</button>`;
    }
}

function renderHomeFinance() {
    let container = document.getElementById('homeFinanceSummary');
    if (!container) return;
    let accFuel = (window.allRawAccounts || []).reduce((x, a) => x + Number((a && a.fuelCost) || 0), 0);
    let carFuel = (window.allCars || []).reduce((x, c) => x + Number(c.fuelCost || 0), 0);
    let violations = (window.allCars || []).reduce((x, c) => x + Number(c.violationsCost || 0), 0);
    let _hrD = window.allHrData || {};
    let salaries = (window.allRawAccounts || []).reduce((x, a) => x + Number((_hrD[a.id] && _hrD[a.id].net) || 0), 0);
    let totalCost = accFuel + carFuel + violations + salaries;
    let rows = [
        { label: t('fin_fuel_accounts'), val: accFuel, color: 'warning', icon: 'fuel-pump-fill' },
        { label: t('fin_fuel_cars'), val: carFuel, color: 'info', icon: 'car-front-fill' },
        { label: t('fin_violations'), val: violations, color: 'danger', icon: 'exclamation-triangle-fill' },
        { label: t('fin_salaries'), val: salaries, color: 'primary', icon: 'cash-stack' }
    ];
    container.innerHTML = rows.map(r => `
        <div class="d-flex justify-content-between align-items-center p-2 mb-2 rounded-3" style="background:rgba(0,0,0,0.03);">
            <span><i class="bi bi-${r.icon} text-${r.color} me-2"></i>${r.label}</span>
            <b class="text-${r.color}">${r.val.toLocaleString()} ${t('currency_sar')}</b>
        </div>`).join('') + `
        <div class="alert alert-dark fw-bold fs-5 mb-0 mt-2 d-flex justify-content-between">
            <span>${t('fin_total_monthly')}</span><span>${totalCost.toLocaleString()} ${t('currency_sar')}</span>
        </div>`;
}

function renderHomeActivity() {
    let container = document.getElementById('homeActivityFeed');
    if (!container) return;

    let allLogs = (window.allAuditLogs || []).slice().sort((a, b) => {
        return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
    });

    function parseTs(ts) {
        if (!ts) return new Date(NaN);
        let d = new Date(ts);
        if (!isNaN(d.getTime())) return d;
        let m = String(ts).match(/(\d{2})\/(\d{2})\/(\d{4})[, ]+(\d{2}):(\d{2}):(\d{2})/);
        if (m) return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5], +m[6]);
        return new Date(NaN);
    }

    function getRelTime(ts) {
        let d = parseTs(ts);
        if (isNaN(d.getTime())) return String(ts || '');
        let diff = Date.now() - d.getTime();
        let mins = Math.floor(diff / 60000);
        let hrs  = Math.floor(mins / 60);
        let days = Math.floor(hrs / 24);
        if (days > 30) return `منذ ${Math.floor(days/30)} شهر`;
        return days > 0 ? `منذ ${days} يوم` : hrs > 0 ? `منذ ${hrs} ساعة` : mins > 0 ? `منذ ${mins} دقيقة` : 'الآن';
    }

    function getAbsTime(ts) {
        let d = parseTs(ts);
        if (isNaN(d.getTime())) return String(ts || '');
        return d.toLocaleString('ar-EG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function getCategory(action) {
        let a = String(action || '');
        if (/حساب|مشرف|إيقاف|تفعيل|نقل عهدة|تعديل بيانات|إنشاء حساب|حذف حساب|حذف جماعي|إيقاف جماعي|نقل.*جماعي|إنذار|تنبيه|واتساب/.test(a)) return 'accounts';
        if (/استيراد|تصدير|لصق ذكي|تحليل مالي/.test(a)) return 'imports';
        if (/سيارة|أسطول|شريحة|حادث|صيانة/.test(a)) return 'cars';
        return 'system';
    }

    function getStyle(action) {
        let a = String(action || '');
        if (/إنشاء|إضافة|تفعيل|استرجاع|موافقة/.test(a)) return { icon: 'plus-circle-fill',       color: '#16a34a', bg: '#f0fdf4', border: '#86efac' };
        if (/حذف|إيقاف|رفض/.test(a))                    return { icon: 'trash3-fill',              color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' };
        if (/تعديل|تحديث|تصفير|ترحيل|تراجع/.test(a))    return { icon: 'pencil-fill',              color: '#d97706', bg: '#fffbeb', border: '#fcd34d' };
        if (/استيراد|لصق/.test(a))                       return { icon: 'cloud-upload-fill',        color: '#0891b2', bg: '#ecfeff', border: '#67e8f9' };
        if (/تصدير|تحميل/.test(a))                       return { icon: 'download',                 color: '#7c3aed', bg: '#faf5ff', border: '#c4b5fd' };
        if (/تسجيل دخول/.test(a))                        return { icon: 'box-arrow-in-right',       color: '#0284c7', bg: '#f0f9ff', border: '#7dd3fc' };
        if (/تسجيل خروج/.test(a))                        return { icon: 'box-arrow-right',          color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' };
        if (/نقل/.test(a))                               return { icon: 'arrow-left-right',         color: '#7c3aed', bg: '#faf5ff', border: '#c4b5fd' };
        if (/إنذار|تنبيه/.test(a))                       return { icon: 'exclamation-triangle-fill',color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
        if (/مالي|بنزين/.test(a))                        return { icon: 'cash-stack',               color: '#0284c7', bg: '#f0f9ff', border: '#7dd3fc' };
        if (/سيارة|أسطول/.test(a))                       return { icon: 'car-front-fill',           color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' };
        return { icon: 'activity', color: '#4f46e5', bg: '#eef2ff', border: '#a5b4fc' };
    }

    function getRoleBadge(admin) {
        let user = adminUsers && adminUsers[admin];
        if (!user) return '';
        if (user.role === 'super_admin') return `<span class="badge ms-1" style="background:#7c3aed;font-size:0.55rem;padding:1px 4px;">سوبر</span>`;
        if (user.role === 'admin')       return `<span class="badge bg-primary ms-1" style="font-size:0.55rem;padding:1px 4px;">أدمن</span>`;
        return `<span class="badge bg-secondary ms-1" style="font-size:0.55rem;padding:1px 4px;">مشرف</span>`;
    }

    // Filter chips
    let activeFilter = window.activityFilter || 'all';
    let categories = [
        { key: 'all',      label: 'الكل',           icon: 'grid-fill' },
        { key: 'accounts', label: 'حسابات',          icon: 'person-fill' },
        { key: 'imports',  label: 'استيراد / تصدير', icon: 'cloud-upload-fill' },
        { key: 'cars',     label: 'سيارات',          icon: 'car-front-fill' },
        { key: 'system',   label: 'نظام',            icon: 'gear-fill' },
    ];
    let chipContainer = document.getElementById('activityFilterChips');
    if (chipContainer) {
        chipContainer.innerHTML = categories.map(c => {
            let cnt = c.key === 'all' ? allLogs.length : allLogs.filter(l => getCategory(l.action) === c.key).length;
            let isActive = activeFilter === c.key;
            return `<button onclick="window.activityFilter='${c.key}'; renderHomeActivity();" class="btn btn-sm fw-semibold" style="font-size:0.68rem; padding:2px 9px; border-radius:20px; ${isActive ? 'background:#4f46e5;color:#fff;border:1px solid #4f46e5;' : 'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;'}">
                <i class="bi bi-${c.icon} me-1"></i>${c.label} <span class="opacity-60">${cnt}</span>
            </button>`;
        }).join('');
    }

    // Apply filter + limit (أبسط: 9 افتراضياً مع زر "عرض المزيد"، وأقصى 30)
    const ACT_LIMIT = 9;
    let _actExpanded = !!window._activityExpanded;
    let filtered = activeFilter === 'all' ? allLogs : allLogs.filter(l => getCategory(l.action) === activeFilter);
    let logs = filtered.slice(0, _actExpanded ? 30 : ACT_LIMIT);
    let countEl = document.getElementById('activityCountBadge');
    if (countEl) countEl.textContent = `${logs.length} / ${filtered.length}`;

    if (!logs.length) {
        container.innerHTML = `<div class="col-12 text-center text-muted py-4 fw-bold"><i class="bi bi-clock-history d-block mb-2 fs-3 opacity-50"></i>لا توجد سجلات نشاط</div>`;
        return;
    }

    container.innerHTML = logs.map(log => {
        let st = getStyle(log.action);
        let relTime = getRelTime(log.timestamp);
        let absTime = getAbsTime(log.timestamp);
        let adminName = log.admin || '—';
        let roleBadge = getRoleBadge(log.admin);
        let target = log.targetId && log.targetId !== 'System' && log.targetId !== 'Excel' && log.targetId !== 'Undo'
            ? `<span class="badge bg-light text-secondary border" style="font-size:0.6rem; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; vertical-align:middle;" title="${log.targetId}"># ${log.targetId}</span>` : '';
        let details = log.details ? `<div style="font-size:0.7rem; color:#6b7280; margin-top:2px; line-height:1.3;">${log.details}</div>` : '';
        return `
        <div class="col-12 col-md-6 col-xl-4">
            <div class="d-flex align-items-start gap-2 p-2 rounded-3" style="background:${st.bg}; border-right:3px solid ${st.border}; min-height:64px;">
                <div class="flex-shrink-0 mt-1 d-flex align-items-center justify-content-center rounded-2" style="width:26px; height:26px; background:${st.color}20;">
                    <i class="bi bi-${st.icon}" style="color:${st.color}; font-size:0.82rem;"></i>
                </div>
                <div class="min-w-0 flex-grow-1">
                    <div class="d-flex align-items-center gap-1 flex-wrap" style="line-height:1.2;">
                        <b style="font-size:0.78rem; color:${st.color};">${log.action || 'نشاط'}</b>
                        ${target}
                    </div>
                    <div class="d-flex align-items-center gap-1 mt-1">
                        <span style="font-size:0.7rem; color:#374151; font-weight:600;">👤 ${adminName}</span>${roleBadge}
                    </div>
                    ${details}
                    <div style="font-size:0.64rem; color:#9ca3af; margin-top:2px;" title="${absTime}">🕐 ${relTime}</div>
                </div>
            </div>
        </div>`;
    }).join('');
    if (filtered.length > ACT_LIMIT) {
        container.innerHTML += `<div class="col-12"><button onclick="window._activityExpanded=${!_actExpanded}; renderHomeActivity();" class="btn btn-sm btn-light w-100 fw-bold text-secondary">${_actExpanded ? ('▲ ' + L('عرض أقل','Show less')) : ('▼ ' + L('عرض المزيد','Show more') + ` (${Math.min(30, filtered.length)})`)}</button></div>`;
    }
}

// ====== نظام تحكم رفع التقارير اليومية ======

const REPORT_REMINDER_WINDOWS = [
    { startH: 11, startM: 0,  endH: 11, endM: 20 },
    { startH: 11, startM: 20, endH: 11, endM: 40 },
    { startH: 11, startM: 40, endH: 12, endM: 0  }
];

function _reportReminderKey(idx) {
    return `reportReminder_${idx}_${getTodayStr()}`;
}

function _currentReminderIndex() {
    let now = new Date();
    let h = now.getHours(), m = now.getMinutes();
    for (let i = 0; i < REPORT_REMINDER_WINDOWS.length; i++) {
        let w = REPORT_REMINDER_WINDOWS[i];
        let afterStart = h > w.startH || (h === w.startH && m >= w.startM);
        let beforeEnd  = h < w.endH  || (h === w.endH  && m <  w.endM);
        if (afterStart && beforeEnd) return i;
    }
    return -1;
}

function getRemainingToNoon() {
    let now  = new Date();
    let noon = new Date(); noon.setHours(12, 0, 0, 0);
    let diff = noon - now;
    if (diff <= 0) return L('0 دقيقة', '0 min');
    let mins = Math.floor(diff / 60000);
    let hrs  = Math.floor(mins / 60); mins = mins % 60;
    if (typeof currentLang !== 'undefined' && currentLang === 'en') {
        return hrs > 0 ? `${hrs} hr${mins > 0 ? ' ' + mins + ' min' : ''}` : `${mins} min`;
    }
    return hrs > 0 ? `${hrs} ساعة${mins > 0 ? ' و' + mins + ' دقيقة' : ''}` : `${mins} دقيقة`;
}

function checkReportReminder() {
    let role = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role;
    if (role === 'super_admin') { hideReportReminder(); return; }

    let now = new Date();
    let h = now.getHours();
    if (h < 11 || h >= 12) { hideReportReminder(); return; }

    let idx = _currentReminderIndex();
    if (idx < 0) { hideReportReminder(); return; }
    if (sessionStorage.getItem(_reportReminderKey(idx))) { hideReportReminder(); return; }

    showReportReminder(idx);
}

function showReportReminder(idx) {
    let strip = document.getElementById('reportReminderStrip');
    if (!strip) return;
    let remaining = getRemainingToNoon();
    let colors = ['#f59e0b', '#ef4444', '#dc2626'];
    let bg = colors[idx] || '#ef4444';
    strip.innerHTML = `
    <div class="d-flex align-items-center gap-3 px-4 py-2 fw-bold" style="background:${bg}; color:#fff;">
        <i class="bi bi-alarm-fill fs-4 flex-shrink-0"></i>
        <div class="flex-grow-1">
            <span>${L(`⏰ تذكير ${idx + 1} من 3 — نافذة رفع التقرير من 12:00 بليل حتى 12:00 ظهراً | تبقى على الإغلاق`, `⏰ Reminder ${idx + 1} of 3 — report upload window is from 12:00 AM to 12:00 PM | time left`)}</span>
            <span class="badge bg-white fw-bold ms-2" style="color:${bg};">${remaining}</span>
        </div>
        <button onclick="dismissReportReminder(${idx})" class="btn btn-sm btn-light fw-bold" style="color:${bg}; white-space:nowrap;">${L('تم الفهم ✓', 'Got it ✓')}</button>
    </div>`;
    strip.style.display = '';
}

function dismissReportReminder(idx) {
    sessionStorage.setItem(_reportReminderKey(idx), '1');
    hideReportReminder();
}

function hideReportReminder() {
    let strip = document.getElementById('reportReminderStrip');
    if (strip) strip.style.display = 'none';
}

function startReportReminderWatcher() {
    // فحص كل دقيقتين: التذكيرات + تحديث أزرار نافذة الرفع
    setInterval(() => {
        let platformTabs = ['ninja', 'keeta', 'hunger', 'jahez', 'chefz'];
        if (platformTabs.includes(currentPlatformTab)) checkReportReminder();
        // تحديث ظهور أزرار الرفع عند تغير الساعة (مثلاً عند تجاوز الـ 12 ظهراً)
        if (window.loggedInUser) applyLocksUI();
    }, 120000);
}

function triggerPerfImport() {
    let btn  = document.getElementById('btnImportPerf');
    let role = adminUsers[window.loggedInUser] && adminUsers[window.loggedInUser].role;
    let now  = new Date();
    let hour = now.getHours();

    // ── فحص الرفع المزدوج أولاً ──
    if (btn && btn._uploadedToday) {
        closeActionSidebar();
        let today = getTodayStr(), uid = window.loggedInUser;
        database.ref(`ninja_data/daily_imports/${today}/${currentPlatformTab}`).once('value').then(snap => {
            let rec = snap.val() || {};
            let uploadedName = rec.uploadedByName || rec.uploadedBy || '—';
            let uploadedTime = rec.uploadedAt ? new Date(rec.uploadedAt).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}) : '—';
            // هل هناك موافقة إعادة رفع لم تُستخدم بعد؟
            database.ref(`ninja_data/report_requests/${today}/${uid}`).once('value').then(rqSnap => {
                let rq = rqSnap.val();
                if (rq && rq.type === 'reimport' && rq.status === 'approved' && rq.platform === currentPlatformTab) {
                    // موافقة موجودة → اسمح بالرفع مباشرة
                    document.getElementById('perfImport').click();
                    return;
                }
                // لا موافقة → أعرض رسالة التأكيد
                Swal.fire({
                    icon: 'warning',
                    title: L('⚠️ تم رفع التقرير اليوم', '⚠️ Report Already Uploaded'),
                    html: L(
                        `<p>تم رفع تقرير <b>${platformDisplayName(currentPlatformTab)}</b> اليوم الساعة <b>${uploadedTime}</b> بواسطة <b>${uploadedName}</b>.</p><p class="text-muted small mt-1">إعادة الرفع تتطلب موافقة الأدمن.</p>`,
                        `<p>The <b>${platformDisplayName(currentPlatformTab)}</b> report was already uploaded today at <b>${uploadedTime}</b> by <b>${uploadedName}</b>.</p><p class="text-muted small mt-1">Re-uploading requires admin approval.</p>`
                    ),
                    showCancelButton: true,
                    confirmButtonText: L('📨 طلب إعادة رفع', '📨 Request Re-upload'),
                    cancelButtonText:  L('إلغاء', 'Cancel'),
                    confirmButtonColor: '#f59e0b',
                }).then(res => { if (res.isConfirmed) requestReimport(); });
            });
        });
        return;
    }

    // النافذة المسموحة: من 12:00 بليل (00:00) حتى 12:00 ظهراً
    // صلاحية import_perf = تجاوز قيد الوقت (رفع في أي وقت بدون موافقة)
    if (hour < 12 || role === 'super_admin' || role === 'admin' || hasPerm('import_perf')) {
        document.getElementById('perfImport').click();
        return;
    }

    // خارج النافذة (بعد 12:00 ظهراً): تحقق من وجود طلب موافق عليه
    closeActionSidebar();
    let today = getTodayStr();
    let uid   = window.loggedInUser;
    database.ref(`ninja_data/report_requests/${today}/${uid}`).once('value').then(snap => {
        let req = snap.val();
        if (req && req.status === 'approved') {
            let approvedAt = new Date(req.approvedAt);
            let windowEnd  = new Date(approvedAt.getTime() + 30 * 60000);
            if (new Date() <= windowEnd) {
                document.getElementById('perfImport').click();
            } else {
                Swal.fire({
                    icon: 'error', title: L('⏳ انتهت مهلة الرفع', '⏳ Upload window expired'),
                    text: L('انتهت الـ 30 دقيقة المتاحة. يمكنك إرسال طلب جديد.', 'The 30-minute window has ended. You can submit a new request.'),
                    confirmButtonText: L('إرسال طلب جديد', 'Submit new request'), showCancelButton: true, cancelButtonText: L('إلغاء', 'Cancel')
                }).then(r => {
                    if (r.isConfirmed) {
                        database.ref(`ninja_data/report_requests/${today}/${uid}`).remove().then(() => {
                            window._reportApprovalNotified = false;
                            showLateReportRequestModal();
                        });
                    }
                });
            }
        } else if (req && req.status === 'pending') {
            Swal.fire({ icon: 'info', title: L('⏳ طلبك قيد المراجعة', '⏳ Your request is under review'), text: L('تم إرسال طلبك للمشرف العام. ستصلك إشعار فور البت فيه.', 'Your request was sent to the super admin. You will be notified once decided.'), confirmButtonText: L('حسناً', 'OK') });
        } else {
            showLateReportRequestModal();
        }
    });
}

function closeActionSidebar() {
    // إغلاق الشريط الجانبي حتى لا يحبس Bootstrap التركيز ويمنع الكتابة داخل نوافذ SweetAlert
    let el = document.getElementById('actionSidebar');
    if (!el || !window.bootstrap) return;
    let inst = bootstrap.Offcanvas.getInstance(el);
    if (inst) inst.hide();
}

// ======= عداد نافذة الرفع + كشف الرفع المزدوج =======
function updatePerfButtonUI() {
    let btn = document.getElementById('btnImportPerf');
    if (!btn || !window.loggedInUser) return;

    // — عداد تنازلي: يظهر فقط من 11:30 حتى 11:59 —
    let now = new Date(), h = now.getHours(), m = now.getMinutes();
    let cntEl = document.getElementById('perfImportCountdown');
    if (cntEl) {
        if (h === 11 && m >= 30) {
            let remaining = 60 - m;
            cntEl.textContent = L(`تغلق بعد ${remaining} د`, `closes in ${remaining}m`);
            cntEl.classList.remove('d-none');
        } else {
            cntEl.classList.add('d-none');
        }
    }

    // — كشف الرفع المزدوج: اقرأ Firebase للمنصة الحالية لليوم —
    let today = getTodayStr();
    database.ref(`ninja_data/daily_imports/${today}/${currentPlatformTab}`).once('value').then(snap => {
        let rec = snap.val();
        let iconEl = document.getElementById('perfImportIcon');
        let textEl = btn.querySelector('[data-i18n="btn_import_perf"]');
        if (rec) {
            btn.classList.remove('btn-secondary'); btn.classList.add('btn-success');
            if (iconEl) iconEl.className = 'bi bi-check-circle-fill fs-5';
            if (textEl) textEl.textContent = L('تم الرفع ✓', 'Uploaded ✓');
            btn._uploadedToday = true;
        } else {
            btn.classList.remove('btn-success'); btn.classList.add('btn-secondary');
            if (iconEl) iconEl.className = 'bi bi-graph-up fs-5';
            if (textEl) { textEl.setAttribute('data-i18n','btn_import_perf'); textEl.textContent = L('استيراد أداء', 'Import Performance'); }
            btn._uploadedToday = false;
        }
    });
}

function requestReimport() {
    Swal.fire({
        title: L('📨 طلب إعادة رفع التقرير', '📨 Request Report Re-upload'),
        html: `<div dir="${typeof currentLang!=='undefined'&&currentLang==='en'?'ltr':'rtl'}">
            <p class="text-muted small mb-2">${L('المنصة:','Platform:')} <b>${platformDisplayName(currentPlatformTab)}</b></p>
            <label class="fw-bold small mb-1 d-block">${L('سبب إعادة الرفع:','Reason for re-upload:')}</label>
            <textarea id="reimportReasonTxt" class="form-control" rows="3" placeholder="${L('مثال: تم إرسال ملف خاطئ...','e.g. Wrong file was uploaded by mistake...')}"></textarea>
        </div>`,
        showCancelButton: true,
        confirmButtonText: L('إرسال الطلب', 'Send Request'),
        cancelButtonText:  L('إلغاء', 'Cancel'),
        stopKeydownPropagation: false, focusConfirm: false,
        preConfirm: () => {
            let reason = document.getElementById('reimportReasonTxt')?.value?.trim();
            if (!reason) { Swal.showValidationMessage(L('أدخل سبب الإعادة', 'Enter re-upload reason')); return false; }
            return reason;
        }
    }).then(r => {
        if (!r.isConfirmed) return;
        let today = getTodayStr(), uid = window.loggedInUser;
        database.ref(`ninja_data/report_requests/${today}/${uid}`).set({
            supervisorId:    uid,
            supervisorName:  (adminUsers[uid] || {}).name || uid,
            platform:        currentPlatformTab,
            reason:          r.value,
            type:            'reimport',
            status:          'pending',
            requestTime:     new Date().toISOString(),
            date:            today,
            adminNote:       '',
            approvedAt:      null,
            approvedBy:      null
        }).then(() => {
            Swal.fire({ icon: 'success', title: L('✅ تم إرسال الطلب', '✅ Request Sent'),
                text: L('سيتم إشعارك فور موافقة الأدمن على طلب إعادة الرفع.', 'You will be notified once the admin approves your re-upload request.'),
                confirmButtonText: L('حسناً', 'OK') });
        });
    });
}
// ======= نهاية عداد نافذة الرفع + كشف الرفع المزدوج =======

function triggerManualLateReport() {
    closeActionSidebar();
    // التقرير المتأخر متاح للجميع — المشرف يرسل طلب إذن والموافقة بيد الأدمن/السوبر
    let today = getTodayStr();
    let yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    let defaultDate = yesterday.toISOString().split('T')[0];

    // تحقق من وجود طلب معلق بالفعل اليوم
    let uid = window.loggedInUser;
    database.ref(`ninja_data/report_requests/${today}/${uid}`).once('value').then(snap => {
        let existing = snap.val();
        if (existing && existing.status === 'pending') {
            Swal.fire({ icon: 'info', title: L('⏳ طلبك قيد المراجعة', '⏳ Your request is under review'), text: L('لديك طلب معلق بانتظار موافقة المشرف العام.', 'You have a pending request awaiting the super admin approval.'), confirmButtonText: L('حسناً', 'OK') });
            return;
        }
        if (existing && existing.status === 'approved') {
            let approvedAt = new Date(existing.approvedAt);
            let windowEnd  = new Date(approvedAt.getTime() + 30 * 60000);
            if (new Date() <= windowEnd) {
                let _minsLeft = Math.ceil((windowEnd - new Date()) / 60000);
                Swal.fire({
                    icon: 'success', title: L('✅ تم الموافقة على طلبك', '✅ Your request was approved'),
                    html: L(`<p>يمكنك رفع التقرير الآن.<br><b style="color:#ef4444;">المهلة تنتهي خلال ${_minsLeft} دقيقة.</b></p>`, `<p>You can upload the report now.<br><b style="color:#ef4444;">The window ends in ${_minsLeft} minutes.</b></p>`),
                    confirmButtonText: L('📤 رفع التقرير الآن', '📤 Upload report now'), showCancelButton: true, cancelButtonText: L('لاحقاً', 'Later')
                }).then(r => { if (r.isConfirmed) document.getElementById('perfImport').click(); });
                return;
            }
        }

        Swal.fire({
            title: L('📋 طلب رفع تقرير يومي متأخر', '📋 Late daily report request'),
            html: L(`<div class="text-end" dir="rtl">
                <div class="alert alert-warning py-2 mb-3 text-end" style="font-size:0.85rem;">
                    <i class="bi bi-info-circle-fill me-1"></i> هذا الطلب يتطلب موافقة المشرف العام — ستُخطَر فور البت فيه
                </div>
                <label class="fw-bold small mb-1 d-block">تاريخ التقرير المراد رفعه <span class="text-danger">*</span></label>
                <input type="date" id="lateReportDateInput" class="form-control mb-3" value="${defaultDate}" max="${today}">
                <label class="fw-bold small mb-1 d-block">سبب التأخير <span class="text-danger">*</span></label>
                <textarea id="lateReasonInput" class="form-control" rows="3" placeholder="اكتب سبب التأخير..."></textarea>
            </div>`, `<div class="text-start" dir="ltr">
                <div class="alert alert-warning py-2 mb-3 text-start" style="font-size:0.85rem;">
                    <i class="bi bi-info-circle-fill me-1"></i> This request requires super admin approval — you will be notified once decided
                </div>
                <label class="fw-bold small mb-1 d-block">Report date to upload <span class="text-danger">*</span></label>
                <input type="date" id="lateReportDateInput" class="form-control mb-3" value="${defaultDate}" max="${today}">
                <label class="fw-bold small mb-1 d-block">Reason for delay <span class="text-danger">*</span></label>
                <textarea id="lateReasonInput" class="form-control" rows="3" placeholder="Write the reason for the delay..."></textarea>
            </div>`),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: L('📨 إرسال طلب الإذن', '📨 Send permission request'),
            cancelButtonText: L('إلغاء', 'Cancel'),
            confirmButtonColor: '#f59e0b',
            stopKeydownPropagation: false,
            focusConfirm: false,
            preConfirm: () => {
                let date   = (document.getElementById('lateReportDateInput') || {}).value;
                let reason = (document.getElementById('lateReasonInput') || {}).value;
                if (!date)               { Swal.showValidationMessage(L('يرجى تحديد تاريخ التقرير', 'Please specify the report date')); return false; }
                if (!reason || !reason.trim()) { Swal.showValidationMessage(L('يرجى كتابة سبب التأخير', 'Please write the reason for the delay')); return false; }
                return { date, reason: reason.trim() };
            }
        }).then(result => {
            if (result.isConfirmed) {
                submitLateReportRequest(result.value.reason, result.value.date, 'manual_late');
            }
        });
    });
}

function showLateReportRequestModal() {
    Swal.fire({
        title: L('⚠️ تجاوز وقت رفع التقرير', '⚠️ Report upload time exceeded'),
        html: L(`<div class="text-end" dir="rtl">
            <p class="fw-bold mb-1" style="color:#ef4444;">⏰ نافذة الرفع المسموحة: من 12:00 بليل حتى 12:00 ظهراً</p>
            <p class="text-muted mb-3">الساعة تجاوزت 12:00 ظهراً — لرفع التقرير الآن يجب الحصول على موافقة المشرف العام</p>
            <label class="fw-bold small mb-1 d-block">سبب التأخير <span class="text-danger">*</span></label>
            <textarea id="lateReasonInput" class="form-control" rows="3" placeholder="اكتب سبب التأخير..."></textarea>
        </div>`, `<div class="text-start" dir="ltr">
            <p class="fw-bold mb-1" style="color:#ef4444;">⏰ Allowed upload window: from 12:00 AM to 12:00 PM</p>
            <p class="text-muted mb-3">It is past 12:00 PM — to upload the report now you must get the super admin approval</p>
            <label class="fw-bold small mb-1 d-block">Reason for delay <span class="text-danger">*</span></label>
            <textarea id="lateReasonInput" class="form-control" rows="3" placeholder="Write the reason for the delay..."></textarea>
        </div>`),
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: L('📨 إرسال طلب الإذن', '📨 Send permission request'),
        cancelButtonText: L('إلغاء', 'Cancel'),
        confirmButtonColor: '#f59e0b',
        stopKeydownPropagation: false,
        focusConfirm: false,
        preConfirm: () => {
            let reason = (document.getElementById('lateReasonInput') || {}).value;
            if (!reason || !reason.trim()) { Swal.showValidationMessage(L('يرجى كتابة سبب التأخير', 'Please write the reason for the delay')); return false; }
            return reason.trim();
        }
    }).then(result => {
        if (result.isConfirmed) submitLateReportRequest(result.value);
    });
}

function submitLateReportRequest(reason, reportDate, type) {
    let today    = getTodayStr();
    let uid      = window.loggedInUser;
    let userInfo = adminUsers[uid] || {};
    let reqData  = {
        supervisorId:   uid,
        supervisorName: userInfo.name || uid,
        platform:       currentPlatformTab,
        reason:         reason,
        reportDate:     reportDate || today,
        type:           type || 'auto_late',
        requestTime:    new Date().toISOString(),
        date:           today,
        status:         'pending',
        adminNote:      '',
        approvedAt:     null,
        approvedBy:     null
    };
    database.ref(`ninja_data/report_requests/${today}/${uid}`).set(reqData)
        .then(() => {
            Swal.fire({ icon: 'success', title: L('✅ تم إرسال الطلب', '✅ Request sent'), text: L('سيتم إشعارك فور موافقة المشرف العام على طلبك.', 'You will be notified once the super admin approves your request.'), confirmButtonText: L('حسناً', 'OK') });
        })
        .catch(() => {
            Swal.fire({ icon: 'error', title: L('خطأ في الإرسال', 'Send error'), text: L('تعذر إرسال الطلب. تحقق من الاتصال وحاول مرة أخرى.', 'Could not send the request. Check your connection and try again.'), confirmButtonText: L('حسناً', 'OK') });
        });
}

function approveReportRequest(supervisorId) {
    let today = getTodayStr();
    database.ref(`ninja_data/report_requests/${today}/${supervisorId}`).update({
        status:     'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: window.loggedInUser
    }).then(() => {
        Swal.fire({ icon: 'success', title: L('تمت الموافقة', 'Approved'), text: L('تم إخطار المشرف. لديه 30 دقيقة لرفع التقرير.', 'Supervisor notified. They have 30 minutes to upload the report.'), confirmButtonText: L('حسناً', 'OK'), timer: 2500, timerProgressBar: true });
    });
}

function rejectReportRequest(supervisorId) {
    Swal.fire({
        title: L('❌ رفض الطلب', '❌ Reject Request'),
        html: L(`<div dir="rtl"><label class="fw-bold small mb-1 d-block">ملاحظة للمشرف (اختياري)</label>
        <input id="rejectNoteInput" class="form-control" placeholder="سبب الرفض..."></div>`,
        `<div dir="ltr"><label class="fw-bold small mb-1 d-block">Note to supervisor (optional)</label>
        <input id="rejectNoteInput" class="form-control" placeholder="Reason for rejection..."></div>`),
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: L('تأكيد الرفض', 'Confirm Rejection'),
        cancelButtonText: L('إلغاء', 'Cancel'),
        confirmButtonColor: '#ef4444'
    }).then(result => {
        if (!result.isConfirmed) return;
        let note = (document.getElementById('rejectNoteInput') || {}).value || '';
        let today = getTodayStr();
        database.ref(`ninja_data/report_requests/${today}/${supervisorId}`).update({
            status:    'rejected',
            adminNote: note,
            rejectedBy: window.loggedInUser
        }).then(() => {
            Swal.fire({ icon: 'info', title: L('تم الرفض', 'Rejected'), confirmButtonText: L('حسناً', 'OK'), timer: 2000, timerProgressBar: true });
        });
    });
}

function updateReportRequestBadge() {
    let pending = Object.values(window.allReportRequests || {}).filter(r => r && r.status === 'pending').length;
    let badge = document.getElementById('homeTabReportBadge');
    if (!badge) {
        let homeTab = document.getElementById('tabHome');
        if (homeTab && pending > 0) {
            let b = document.createElement('span');
            b.id = 'homeTabReportBadge';
            b.className = 'badge bg-danger rounded-pill ms-1';
            b.style.fontSize = '0.65rem';
            b.textContent = pending;
            homeTab.appendChild(b);
        }
    } else {
        if (pending > 0) { badge.textContent = pending; badge.style.display = ''; }
        else badge.style.display = 'none';
    }
}

// ====== نهاية نظام تحكم رفع التقارير ======

// --- قسم السيارات (Cars CRUD) ---
function toggleVehicleTypeFields() {
    let type = (document.getElementById('carVehicleType') || {}).value || 'سيارة';
    let isMoto = type === 'دراجة نارية';
    let ccRow   = document.getElementById('carEngineCCRow');
    let brandRow = document.getElementById('carBrandRow');
    if (ccRow)   ccRow.style.display   = isMoto ? '' : 'none';
    if (brandRow) brandRow.style.display = isMoto ? '' : 'none';
    let titleEl = document.getElementById('carModalTitle');
    if (titleEl) titleEl.innerHTML = isMoto
        ? '<i class="bi bi-bicycle me-2"></i>بيانات الدراجة النارية'
        : '<i class="bi bi-car-front-fill me-2"></i>بيانات السيارة';
}

function openCarModal(id) {
    document.getElementById('carId').value = id || '';
    let c = id ? (window.allCars || []).find(x => String(x.id) === String(id)) : null;
    const g = (f, d = '') => c ? (c[f] !== undefined ? c[f] : d) : d;
    document.getElementById('carVehicleType').value = g('vehicleType', 'سيارة');
    document.getElementById('carPlate').value = g('plate');
    document.getElementById('carType').value = g('type');
    document.getElementById('carModelYear').value = g('modelYear');
    document.getElementById('carDriver').value = g('driver');
    document.getElementById('carStatus').value = g('status', 'تعمل');
    document.getElementById('carRegExpiry').value  = g('regExpiry');
    document.getElementById('carInsExpiry').value  = g('insExpiry');
    document.getElementById('carInspExpiry').value = g('inspExpiry');
    document.getElementById('carAuthStart').value  = g('authStart');
    document.getElementById('carAuthEnd').value    = g('authEnd');
    document.getElementById('carOdometer').value   = g('odometer', 0);
    document.getElementById('carLastOil').value    = g('lastOil', 0);
    document.getElementById('carNextMaint').value  = g('nextMaint');
    document.getElementById('carViolations').value = g('violations', 0);
    document.getElementById('carViolationsCost').value = g('violationsCost', 0);
    document.getElementById('carNotes').value = g('notes');
    document.getElementById('carEngineCC').value = g('engineCC', '');
    document.getElementById('carBrand').value = g('brand', '');
    toggleVehicleTypeFields();
    new bootstrap.Modal(document.getElementById('carModal')).show();
}

function saveCar() {
    if(!hasPerm('cars')) return alert('❌ ليس لديك صلاحية تعديل السيارات. تواصل مع الأدمن.');
    let id = document.getElementById('carId').value || ('CAR_' + Date.now());
    let plate = document.getElementById('carPlate').value.trim();
    if (!plate) return alert(t('cars_plate_required'));
    let vehicleType = document.getElementById('carVehicleType').value || 'سيارة';
    let car = {
        id, plate, vehicleType,
        type: document.getElementById('carType').value.trim(),
        modelYear: document.getElementById('carModelYear').value.trim(),
        driver: document.getElementById('carDriver').value.trim(),
        status: document.getElementById('carStatus').value,
        regExpiry:  document.getElementById('carRegExpiry').value,
        insExpiry:  document.getElementById('carInsExpiry').value,
        inspExpiry: document.getElementById('carInspExpiry').value,
        authStart:  document.getElementById('carAuthStart').value,
        authEnd:    document.getElementById('carAuthEnd').value,
        odometer: Number(document.getElementById('carOdometer').value) || 0,
        lastOil:  Number(document.getElementById('carLastOil').value) || 0,
        nextMaint: document.getElementById('carNextMaint').value,
        violations: Number(document.getElementById('carViolations').value) || 0,
        violationsCost: Number(document.getElementById('carViolationsCost').value) || 0,
        notes: document.getElementById('carNotes').value.trim(),
        engineCC: vehicleType === 'دراجة نارية' ? (Number(document.getElementById('carEngineCC').value) || 0) : 0,
        brand:    vehicleType === 'دراجة نارية' ? (document.getElementById('carBrand').value || '') : '',
    };
    database.ref('ninja_data/cars/' + id).set(car).then(() => {
        let m = bootstrap.Modal.getInstance(document.getElementById('carModal')); if (m) m.hide();
        logAudit('حفظ سيارة', id, `تم حفظ بيانات السيارة ${plate}`);
        alert(t('saved_success'));
    }).catch(err => { console.error('saveCar', err); alert('خطأ في الحفظ'); });
}

async function deleteCar(id) {
    if(!hasPerm('cars')) return alert('❌ ليس لديك صلاحية حذف السيارات. تواصل مع الأدمن.');
    let _ok = await swalConfirm(t('confirm_delete_car'), { confirmText: 'نعم، احذف' }); if (!_ok) return;
    let car = (window.allCars || []).find(c => c && String(c.id || c.plateNumber) === String(id)) || {};
    trashAndDelete('cars', id, 'ninja_data/cars/' + id, 'سيارة: ' + (car.plateNumber || id));
}

function renderCarsKpis() {
    let row = document.getElementById('carsKpiRow');
    if (!row) return;
    let cars = window.allCars || [];
    let total   = cars.length;
    let carCount = cars.filter(c => (c.vehicleType || 'سيارة') === 'سيارة').length;
    let motoCount = cars.filter(c => c.vehicleType === 'دراجة نارية').length;
    let active  = cars.filter(c => c.status === 'تعمل').length;
    let maint   = cars.filter(c => c.status === 'صيانة').length;
    let expiring = 0;
    cars.forEach(c => { ['regExpiry', 'insExpiry', 'inspExpiry'].forEach(f => { let d = daysUntil(c[f]); if (d !== null && d <= 30) expiring++; }); });
    let cards = [
        { label: 'إجمالي المركبات',   val: total,    color: '#0f766e', icon: 'grid-fill'        },
        { label: '🚗 سيارات',         val: carCount,  color: '#1d4ed8', icon: 'car-front-fill'   },
        { label: '🏍️ دراجات نارية',  val: motoCount, color: '#7c3aed', icon: 'bicycle'          },
        { label: t('cars_kpi_active'), val: active,   color: 'var(--success)', icon: 'check-circle-fill' },
        { label: t('cars_kpi_maint'),  val: maint,    color: 'var(--warning)', icon: 'tools'     },
        { label: t('cars_kpi_expiring'),val: expiring, color: 'var(--danger)', icon: 'calendar-x-fill' }
    ];
    row.innerHTML = cards.map(c => `<div class="col-6 col-md-2"><div class="stat-card" style="border-bottom:4px solid ${c.color};"><h5><i class="bi bi-${c.icon} me-1"></i>${c.label}</h5><h2 style="color:${c.color}">${c.val}</h2></div></div>`).join('');
}

function _carHasExpiredDoc(c)  { return ['regExpiry','insExpiry','inspExpiry'].some(f => { let d = daysUntil(c[f]); return d !== null && d < 0; }); }
function _carExpiringDoc(c)   { return ['regExpiry','insExpiry','inspExpiry'].some(f => { let d = daysUntil(c[f]); return d !== null && d >= 0 && d <= 30; }); }

function setCarsTypeFilter(type) {
    window.carsTypeFilter = type;
    window.carsActiveFilter = 'all';
    window.carsSearchVal = '';
    let inp = document.getElementById('searchInputCars');
    if (inp) inp.value = '';
    renderCarsTable();
}

function setCarsFilter(filter) {
    window.carsActiveFilter = filter;
    window.carsSearchVal = '';
    let inp = document.getElementById('searchInputCars');
    if (inp) inp.value = '';
    renderCarsTable();
}

function applyCarsSearch(val) {
    window.carsSearchVal = val.toLowerCase();
    window.carsActiveFilter = 'all';
    renderCarsTable();
}

function renderCarsFilterBar() {
    let menu    = document.getElementById('carsFilterMenu');
    let label   = document.getElementById('carsFilterLabel');
    let iconEl  = document.getElementById('carsFilterIcon');
    if (!menu) return;

    let cars = window.allCars || [];
    let curType   = window.carsTypeFilter  || 'all';
    let curStatus = window.carsActiveFilter || 'all';

    // ── حساب الأعداد ──
    let tc = {
        all:  cars.length,
        car:  cars.filter(c => (c.vehicleType||'سيارة') === 'سيارة').length,
        moto: cars.filter(c => c.vehicleType === 'دراجة نارية').length,
    };
    let baseCars = cars.filter(c => {
        if (curType === 'car')  return (c.vehicleType||'سيارة') === 'سيارة';
        if (curType === 'moto') return c.vehicleType === 'دراجة نارية';
        return true;
    });
    let sc = {
        all:      baseCars.length,
        active:   baseCars.filter(c => c.status === 'تعمل').length,
        maint:    baseCars.filter(c => c.status === 'صيانة').length,
        stopped:  baseCars.filter(c => c.status !== 'تعمل' && c.status !== 'صيانة').length,
        expiring: baseCars.filter(c => _carExpiringDoc(c) && !_carHasExpiredDoc(c)).length,
        expired:  baseCars.filter(c => _carHasExpiredDoc(c)).length,
    };

    // ── تعريف الفلاتر ──
    const typeFilters = [
        { key:'all',  icon:'🚘', label:L('الكل — جميع المركبات','All — All Vehicles'),    color:'#1e293b', count:tc.all  },
        { key:'car',  icon:'🚗', label:L('سيارات فقط','Cars Only'),                        color:'#1d4ed8', count:tc.car  },
        { key:'moto', icon:'🏍️', label:L('دراجات نارية فقط','Motorcycles Only'),          color:'#7c3aed', count:tc.moto },
    ];
    const statusFilters = [
        { key:'all',      icon:'📋', label:L('الكل — جميع الحالات','All — All Statuses'), color:'#1e40af', count:sc.all      },
        { key:'active',   icon:'✅', label:L('تعمل بشكل طبيعي','Operating Normally'),     color:'#10b981', count:sc.active   },
        { key:'maint',    icon:'🔧', label:L('في الصيانة','Under Maintenance'),            color:'#f59e0b', count:sc.maint    },
        { key:'stopped',  icon:'⛔', label:L('موقوفة','Stopped'),                          color:'#6b7280', count:sc.stopped  },
        { key:'expiring', icon:'⚠️', label:L('وثائق تنتهي قريباً (30 يوم)','Docs Expiring Soon (30d)'), color:'#fb923c', count:sc.expiring },
        { key:'expired',  icon:'🔴', label:L('منتهية الصلاحية','Expired Documents'),      color:'#ef4444', count:sc.expired  },
    ];

    // ── بناء قائمة الدروبداون ──
    const rowHtml = (f, isActive, onclick) => `
        <li>
            <a class="dropdown-item d-flex align-items-center gap-2 py-2 px-3 cars-flt-item${isActive?' active-flt':''}"
               onclick="${onclick}" role="button">
                <span style="width:22px;text-align:center;font-size:1rem;">${f.icon}</span>
                <span class="flex-grow-1 fw-semibold" style="font-size:0.875rem;${isActive?'color:'+f.color+';':''}">${f.label}</span>
                <span class="badge rounded-pill" style="background:${isActive?f.color:'#e5e7eb'};color:${isActive?'#fff':'#374151'};min-width:24px;">${f.count}</span>
                ${isActive ? `<i class="bi bi-check2 fw-bold" style="color:${f.color};"></i>` : '<span style="width:16px;"></span>'}
            </a>
        </li>`;

    let html = `
        <li><div class="px-3 py-2 text-muted border-bottom" style="font-size:0.75rem;font-weight:700;letter-spacing:.04em;">${L('نوع المركبة','VEHICLE TYPE')}</div></li>
        ${typeFilters.map(f => rowHtml(f, curType===f.key, `setCarsTypeFilter('${f.key}')`)).join('')}
        <li><hr class="dropdown-divider my-1"></li>
        <li><div class="px-3 py-2 text-muted border-bottom" style="font-size:0.75rem;font-weight:700;letter-spacing:.04em;">${L('الحالة','STATUS')}</div></li>
        ${statusFilters.map(f => rowHtml(f, curStatus===f.key, `setCarsFilter('${f.key}')`)).join('')}`;

    // زر إعادة التعيين إذا كان هناك فلتر نشط
    if (curType !== 'all' || curStatus !== 'all') {
        html += `<li><hr class="dropdown-divider my-1"></li>
        <li><a class="dropdown-item d-flex align-items-center gap-2 py-2 px-3 text-danger fw-bold" onclick="resetCarsFilters()" role="button">
            <i class="bi bi-x-circle-fill" style="width:22px;text-align:center;"></i>
            <span>${L('إلغاء جميع الفلاتر','Clear All Filters')}</span>
        </a></li>`;
    }
    menu.innerHTML = html;

    // ── تحديث نص الزر ──
    let typeF   = typeFilters.find(f => f.key === curType);
    let statusF = statusFilters.find(f => f.key === curStatus);
    let isFiltered = curType !== 'all' || curStatus !== 'all';
    if (label) {
        if (!isFiltered) {
            label.textContent = L('الكل', 'All');
        } else if (curType !== 'all' && curStatus !== 'all') {
            label.textContent = `${typeF.icon} ${typeF.key==='car'?L('سيارات','Cars'):L('دراجات','Motos')} · ${statusF.icon} ${statusF.key==='active'?L('تعمل','Active'):statusF.key==='expired'?L('منتهية','Expired'):statusF.key==='expiring'?L('تنتهي','Expiring'):statusF.key==='maint'?L('صيانة','Maint'):L('موقوفة','Stopped')}`;
        } else if (curType !== 'all') {
            label.textContent = `${typeF.icon} ${curType==='car'?L('سيارات','Cars'):L('دراجات نارية','Motorcycles')}`;
        } else {
            label.textContent = `${statusF.icon} ${statusF.key==='active'?L('تعمل','Active'):statusF.key==='expired'?L('منتهية الصلاحية','Expired'):statusF.key==='expiring'?L('تنتهي قريباً','Expiring'):statusF.key==='maint'?L('صيانة','Maintenance'):L('موقوفة','Stopped')}`;
        }
    }
    if (iconEl) iconEl.style.color = isFiltered ? (curStatus!=='all'?statusF.color:typeF.color) : '#0f766e';
}

function resetCarsFilters() {
    window.carsTypeFilter  = 'all';
    window.carsActiveFilter = 'all';
    window.carsSearchVal   = '';
    let inp = document.getElementById('searchInputCars');
    if (inp) inp.value = '';
    renderCarsTable();
}

function renderCarsTable() {
    let tbody = document.getElementById('carsTableBody');
    if (!tbody) return;
    renderCarsKpis();
    renderCarsFilterBar();
    let cars = window.allCars || [];
    // تطبيق فلتر نوع المركبة
    let tf = window.carsTypeFilter || 'all';
    if      (tf === 'car')  cars = cars.filter(c => (c.vehicleType || 'سيارة') === 'سيارة');
    else if (tf === 'moto') cars = cars.filter(c => c.vehicleType === 'دراجة نارية');
    // تطبيق الفلتر السريع
    let f = window.carsActiveFilter || 'all';
    if      (f === 'active')   cars = cars.filter(c => c.status === 'تعمل');
    else if (f === 'maint')    cars = cars.filter(c => c.status === 'صيانة');
    else if (f === 'stopped')  cars = cars.filter(c => c.status !== 'تعمل' && c.status !== 'صيانة');
    else if (f === 'expiring') cars = cars.filter(c => _carExpiringDoc(c) && !_carHasExpiredDoc(c));
    else if (f === 'expired')  cars = cars.filter(c => _carHasExpiredDoc(c));
    // تطبيق البحث النصي
    let q = (window.carsSearchVal || '').toLowerCase();
    if (q) cars = cars.filter(c =>
        (c.plate      || '').toLowerCase().includes(q) ||
        (c.type       || '').toLowerCase().includes(q) ||
        (c.driver     || '').toLowerCase().includes(q) ||
        (c.brand      || '').toLowerCase().includes(q) ||
        (c.modelYear  || '').toString().includes(q)
    );
    if (cars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-muted py-5 fs-5 fw-bold text-center">لا توجد مركبات تطابق هذا الفلتر.</td></tr>`;
        return;
    }
    const vehicleIcon = c => c.vehicleType === 'دراجة نارية' ? '🏍️' : '🚗';
    tbody.innerHTML = cars.map(c => {
        let statusBadge = c.status === 'تعمل' ? `<span class="badge bg-success">${t('car_status_active')}</span>`
            : c.status === 'صيانة' ? `<span class="badge bg-warning text-dark">${t('car_status_maint')}</span>`
                : `<span class="badge bg-secondary">${t('car_status_stopped')}</span>`;
        let rowClass = _carHasExpiredDoc(c) ? 'table-danger' : (_carExpiringDoc(c) ? 'table-warning' : '');
        let motoExtra = c.vehicleType === 'دراجة نارية' && (c.brand || c.engineCC)
            ? `<small class="text-purple fw-bold">${escHtml(c.brand || '')}${c.engineCC ? ' • ' + c.engineCC + 'cc' : ''}</small><br>` : '';
        return `<tr class="${rowClass}">
            <td><span class="fs-4">${vehicleIcon(c)}</span> <b class="fs-5">${escHtml(c.plate || '-')}</b><br>${motoExtra}<small class="text-primary fw-bold">${c.type || ''} ${c.modelYear || ''}</small></td>
            <td>${c.driver || '-'}</td>
            <td>${statusBadge}</td>
            <td>${expiryCell(c.regExpiry)}</td>
            <td>${expiryCell(c.insExpiry)}</td>
            <td>${expiryCell(c.inspExpiry)}</td>
            <td><span class="badge bg-info">${Number(c.odometer || 0).toLocaleString()} ${t('unit_km')}</span><br><small class="text-muted">${t('car_last_oil')}: ${Number(c.lastOil || 0).toLocaleString()}</small></td>
            <td><span class="badge bg-danger">${c.violations || 0} ${t('cars_violations_short')}</span><br><small class="text-muted">${Number(c.fuelCost || 0)} ${t('currency_sar')}</small></td>
            <td><div class="d-flex justify-content-center gap-1">
                <button onclick="openCarAccidentHistory('${c.id}','${(c.plate||'').replace(/'/g,'')}')" class="btn btn-outline-danger btn-sm" title="سجل الحوادث"><i class="bi bi-clipboard2-pulse-fill"></i></button>
                <button onclick="openCarModal('${c.id}')" class="btn btn-warning btn-sm text-dark"><i class="bi bi-pencil-fill"></i></button>
                <button onclick="deleteCar('${c.id}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

function openCarAccidentHistory(carId, plate) {
    let all = Object.values(window.allAccidents || {});
    let list = all.filter(a => a && (String(a.carId) === String(carId) || (plate && a.plate === plate)));
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let totalCost = list.reduce((s, a) => s + (Number(a.repairCost) || 0), 0);
    let faults = list.map(a => Number(a.faultPct) || 0).filter(f => f > 0);
    let avgFault = faults.length ? Math.round(faults.reduce((s, f) => s + f, 0) / faults.length) : 0;
    let open = list.filter(a => a.status !== 'تم الحل' && a.status !== 'مغلقة').length;

    let kpiHtml = `
        <div class="row g-3 mb-4">
            <div class="col-4"><div class="p-3 rounded-3 text-center" style="background:#fef2f2;">
                <div class="fw-bold fs-2 text-danger">${list.length}</div><div class="small text-muted">إجمالي الحوادث</div>
            </div></div>
            <div class="col-4"><div class="p-3 rounded-3 text-center" style="background:#fffbeb;">
                <div class="fw-bold fs-2 text-warning">${open}</div><div class="small text-muted">حوادث مفتوحة</div>
            </div></div>
            <div class="col-4"><div class="p-3 rounded-3 text-center" style="background:#f0fdf4;">
                <div class="fw-bold fs-5 text-success">${totalCost.toLocaleString()} ر.س</div><div class="small text-muted">إجمالي تكاليف الإصلاح</div>
            </div></div>
        </div>
        <div class="mb-3 d-flex gap-3 align-items-center">
            <span class="badge bg-secondary fs-6">متوسط نسبة الخطأ: ${avgFault}%</span>
        </div>`;

    let rows = list.length ? list.map(a => {
        let faultColor = a.faultPct == 100 ? 'danger' : a.faultPct >= 75 ? 'warning' : a.faultPct >= 50 ? 'info' : 'success';
        let statusBadge = (a.status === 'تم الحل' || a.status === 'مغلقة')
            ? `<span class="badge bg-success">مغلقة</span>` : `<span class="badge bg-danger">مفتوحة</span>`;
        return `<tr>
            <td><b>${a.date || '—'}</b></td>
            <td>${a.type || '—'}</td>
            <td>${statusBadge}</td>
            <td><span class="badge bg-${faultColor}">${a.faultPct ? a.faultPct + '%' : '—'}</span></td>
            <td class="text-danger fw-bold">${Number(a.repairCost || 0).toLocaleString()} ر.س</td>
            <td><small class="text-muted">${escHtml((a.notes || '').slice(0, 50) || '—')}</small></td>
        </tr>`;
    }).join('') : `<tr><td colspan="6" class="text-muted text-center py-4">لا توجد حوادث مسجلة لهذه السيارة</td></tr>`;

    Swal.fire({
        title: `📋 سجل حوادث — ${plate || carId}`,
        html: `${kpiHtml}
            <div class="table-responsive" style="max-height:320px; overflow-y:auto;">
            <table class="table table-sm table-hover align-middle text-center mb-0">
                <thead class="table-dark sticky-top"><tr>
                    <th>التاريخ</th><th>النوع</th><th>الحالة</th><th>نسبة الخطأ</th><th>تكلفة الإصلاح</th><th>ملاحظات</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table></div>`,
        width: '750px',
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#4361ee',
        customClass: { popup: 'rounded-4', htmlContainer: 'text-start' },
    });
}

function exportCars() {
    let cars = window.allCars || [];
    if (cars.length === 0) return alert(t('no_data_export'));
    let data = cars.map(c => ({
        [t('car_plate')]: c.plate, [t('car_type')]: c.type, [t('car_model')]: c.modelYear,
        [t('car_driver')]: c.driver, [t('car_status')]: c.status,
        [t('car_reg_exp')]: c.regExpiry, [t('car_ins_exp')]: c.insExpiry, [t('car_insp_exp')]: c.inspExpiry,
        [t('car_odometer')]: c.odometer, [t('car_fuel')]: c.fuelCost,
        [t('car_violations')]: c.violations, [t('car_violations_cost')]: c.violationsCost
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cars"); XLSX.writeFile(wb, `CARS_${getTodayStr()}.xlsx`);
    logAudit('تصدير السيارات', 'cars', 'تم تصدير بيانات الأسطول');
}

// ─── شرائح البنزين (Fuel Chips) ───────────────────────────────────────────

function switchCarTab(tab) {
    const btnMap = { fleet: 'Fleet', chips: 'Chips', accidents: 'Accidents', maintenance: 'Maintenance', handover: 'Handover', rental: 'Rental' };
    ['fleet', 'chips', 'accidents', 'maintenance', 'handover', 'rental'].forEach(t => {
        let view = document.getElementById('carsView_' + t);
        let btn  = document.getElementById('carSubTab' + btnMap[t]);
        if (view) view.style.display = t === tab ? '' : 'none';
        if (btn)  btn.classList.toggle('active-car-tab', t === tab);
    });
    ['fleet','chips','accidents','maintenance','handover','rental'].forEach(t => {
        let act = document.getElementById('cars' + t.charAt(0).toUpperCase() + t.slice(1) + 'Actions');
        if (act) act.style.display = t === tab ? '' : 'none';
    });
    if (tab === 'fleet')       { window.carsActiveFilter = 'all'; window.carsSearchVal = ''; window.carsTypeFilter = 'all'; renderCarsKpis(); renderCarsTable(); }
    if (tab === 'chips')       { renderFuelChipsKpis(); renderFuelChipsTable(); }
    if (tab === 'accidents')   { renderAccidentsKpis(); renderAccidentsTable(); }
    if (tab === 'maintenance') { renderCarMaintenanceKpis(); renderCarMaintenanceTable(); }
    if (tab === 'handover')    { renderHandoverKpis(); renderHandoverTable(); }
    if (tab === 'rental')      { renderRentalKpis(); renderRentalsTable(); }
    updateCarsExportMenu(tab);
}

function updateCarsExportMenu(activeTab) {
    let fleetCount   = (window.allCars || []).length;
    let chipsCount   = Object.values(window.allFuelChips || {}).length;
    let accCount     = Object.values(window.allAccidents || {}).length;
    let maintCount   = Object.values(window.allCarMaintenance || {}).length;
    let handCount    = Object.values(window.allHandovers || {}).length;
    let rentCount    = Object.values(window.allCarRentals || {}).length;

    const setCount = (id, n, unitAr, unitEn) => {
        let el = document.getElementById(id); if (!el) return;
        el.textContent = L(`${n} ${unitAr}`, `${n} ${unitEn}`);
    };
    setCount('exportFleetCount',    fleetCount,  'مركبة مسجلة',       'vehicles');
    setCount('exportChipsCount',    chipsCount,  'شريحة بنزين',        'fuel cards');
    setCount('exportAccidentsCount', accCount,   'حادثة مسجلة',        'accidents');
    setCount('exportMaintCount',    maintCount,  'سجل صيانة',          'service records');
    setCount('exportHandoverCount', handCount,   'عملية استلام/تسليم', 'handover records');
    setCount('exportRentalCount',   rentCount,   'عقد إيجار',          'rental contract(s)');

    const tabToItem = { fleet: 'exportItemFleet', chips: 'exportItemChips', accidents: 'exportItemAccidents', maintenance: 'exportItemMaint', handover: 'exportItemHandover', rental: 'exportItemRental' };
    Object.entries(tabToItem).forEach(([t, itemId]) => {
        let el = document.getElementById(itemId);
        if (el) el.classList.toggle('active-export', t === activeTab);
    });
}

function exportAllFleet() {
    let cars  = window.allCars || [];
    let chips = Object.values(window.allFuelChips || {});
    let accs  = Object.values(window.allAccidents || {});
    let maints = Object.values(window.allCarMaintenance || {});
    let hands  = Object.values(window.allHandovers || {});
    if (!cars.length && !chips.length && !accs.length && !maints.length && !hands.length)
        return alert(L('لا توجد بيانات للتصدير في أي قسم.', 'No data to export in any section.'));
    const wb = XLSX.utils.book_new();
    // Sheet 1: السيارات
    if (cars.length) {
        let data = cars.map(c => ({
            [L('رقم اللوحة','Plate')]: c.plate, [L('النوع','Type')]: c.type,
            [L('سنة الصنع','Year')]: c.modelYear, [L('السائق','Driver')]: c.driver,
            [L('الحالة','Status')]: c.status, [L('انتهاء الاستمارة','Reg Exp.')]: c.regExpiry,
            [L('انتهاء التأمين','Ins. Exp.')]: c.insExpiry, [L('انتهاء الفحص','Insp. Exp.')]: c.inspExpiry,
            [L('العداد (كم)','Odometer')]: c.odometer, [L('المخالفات','Violations')]: c.violations
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), L('السيارات','Vehicles'));
    }
    // Sheet 2: شرائح البنزين
    if (chips.length) {
        let data = chips.map(c => ({ [L('رقم الشريحة','Card #')]: c.chipNumber, [L('المركبة','Vehicle')]: c.plate, [L('الحالة','Status')]: c.status, [L('الرصيد','Balance')]: c.balance }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), L('شرائح البنزين','Fuel Cards'));
    }
    // Sheet 3: الحوادث
    if (accs.length) {
        let data = accs.map(a => ({ [L('التاريخ','Date')]: a.date, [L('المركبة','Vehicle')]: a.plate, [L('النوع','Type')]: a.type, [L('الوصف','Desc.')]: a.description, [L('التكلفة','Cost')]: a.cost }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), L('الحوادث','Accidents'));
    }
    // Sheet 4: الصيانة
    if (maints.length) {
        let data = maints.map(m => ({ [L('التاريخ','Date')]: m.date, [L('المركبة','Vehicle')]: m.plate, [L('نوع الصيانة','Type')]: m.type, [L('التكلفة','Cost')]: m.cost, [L('الكيلومترات','KM')]: m.odometer }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), L('الصيانة','Maintenance'));
    }
    // Sheet 5: الاستلام والتسليم
    if (hands.length) {
        let data = hands.map(h => ({ [L('التاريخ','Date')]: h.date, [L('المركبة','Vehicle')]: h.plate, [L('السائق','Driver')]: h.driver, [L('النوع','Type')]: h.type, [L('ملاحظات','Notes')]: h.notes }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), L('الاستلام','Handover'));
    }
    // Sheet 6: الإيجار
    let rents = Object.values(window.allCarRentals || {});
    if (rents.length) {
        let data = rents.map(r => ({
            [L('المستأجر','Renter')]: r.renterName, [L('الهوية','ID')]: r.renterId, [L('الجوال','Phone')]: r.phone,
            [L('السيارة','Vehicle')]: r.carPlate, [L('البداية','Start')]: r.startDate, [L('النهاية','End')]: r.endDate,
            [L('اليومي','Daily Rate')]: r.dailyRate, [L('الإجمالي','Total')]: r.totalAmount,
            [L('المدفوع','Paid')]: r.paidAmount, [L('الوديعة','Deposit')]: r.deposit, [L('الحالة','Status')]: r.status
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), L('الإيجار','Rentals'));
    }
    XLSX.writeFile(wb, `FLEET_FULL_${getTodayStr()}.xlsx`);
    logAudit('تصدير الأسطول الكامل', 'Excel', L('تم تصدير جميع بيانات الأسطول في ملف واحد','Exported all fleet data to one file'));
}

function renderFuelChipsKpis() {
    let row = document.getElementById('chipsKpiRow'); if (!row) return;
    let chips = Object.values(window.allFuelChips || {});
    let active   = chips.filter(c => c.status === 'نشطة').length;
    let paused   = chips.filter(c => c.status === 'موقفة مؤقت').length;
    let stopped  = chips.filter(c => c.status === 'موقفة نهائي').length;
    let totalLimit = chips.reduce((s, c) => s + Number(c.monthlyLimit || 0), 0);
    let kpis = [
        { label: 'شرائح نشطة',       value: active,                         icon: '✅', color: '#10b981' },
        { label: 'موقفة مؤقت',        value: paused,                         icon: '⏸️', color: '#f59e0b' },
        { label: 'موقفة نهائي',       value: stopped,                        icon: '🚫', color: '#ef4444' },
        { label: 'إجمالي الحدود الشهرية', value: totalLimit.toLocaleString() + ' ر.س', icon: '💰', color: '#3b82f6' },
    ];
    row.innerHTML = kpis.map(k => `
        <div class="col-6 col-md-3">
            <div class="card-custom p-4 text-center" style="border-top:4px solid ${k.color};">
                <div class="fs-2 mb-1">${k.icon}</div>
                <div class="fw-bold fs-4" style="color:${k.color};">${k.value}</div>
                <div class="text-muted fw-bold small">${k.label}</div>
            </div>
        </div>`).join('');
}

function renderFuelChipsTable() {
    let tbody = document.getElementById('chipsTableBody'); if (!tbody) return;
    let chips  = Object.values(window.allFuelChips || {});
    let filter = (document.getElementById('chipStatusFilter') || {}).value || '';
    if (filter) chips = chips.filter(c => c.status === filter);
    if (!chips.length) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-muted py-5 fw-bold">لا توجد شرائح بنزين مسجلة. اضغط "إضافة شريحة" للبدء.</td></tr>`;
        return;
    }
    let statusBadge = s => {
        if (s === 'نشطة')        return `<span class="badge bg-success px-3 py-2 fs-7">✅ نشطة</span>`;
        if (s === 'موقفة مؤقت')  return `<span class="badge bg-warning text-dark px-3 py-2 fs-7">⏸️ موقفة مؤقت</span>`;
        return `<span class="badge bg-danger px-3 py-2 fs-7">🚫 موقفة نهائي</span>`;
    };
    tbody.innerHTML = chips.map(c => {
        let linkedAcc = c.linkedAccountId ? (window.allRawAccounts || []).find(a => a && String(a.id) === String(c.linkedAccountId)) : null;
        let linkedName = linkedAcc ? (linkedAcc.ownerName || c.linkedAccountId) : '<span class="text-muted">—</span>';
        return `<tr>
            <td class="fw-bold">${escHtml(c.holderName || '—')}</td>
            <td>${linkedName}</td>
            <td>${c.company || '—'}</td>
            <td dir="ltr" class="fw-bold">${c.licensePlate || '—'}</td>
            <td><b class="text-primary">${Number(c.monthlyLimit || 0).toLocaleString()}</b> ر.س</td>
            <td dir="ltr">${c.iqamaNumber || '—'}</td>
            <td dir="ltr">${c.phone || '—'}</td>
            <td>${statusBadge(c.status)}</td>
            <td dir="ltr" class="text-muted">${c.openDate || '—'}</td>
            <td dir="ltr" class="text-muted">${c.closeDate || '—'}</td>
            <td>
                <button onclick="openFuelChipModal('${c.chipId}')" class="btn btn-warning btn-sm text-dark me-1"><i class="bi bi-pencil-fill"></i></button>
                <button onclick="deleteFuelChip('${c.chipId}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function openFuelChipModal(id) {
    let chip = id ? (window.allFuelChips[id] || {}) : {};
    document.getElementById('chipId').value = id || '';
    document.getElementById('chipHolderName').value  = chip.holderName  || '';
    document.getElementById('chipCompany').value      = chip.company     || '';
    document.getElementById('chipLicensePlate').value = chip.licensePlate|| '';
    document.getElementById('chipMonthlyLimit').value = chip.monthlyLimit|| '';
    document.getElementById('chipIqama').value        = chip.iqamaNumber || '';
    document.getElementById('chipPhone').value        = chip.phone       || '';
    document.getElementById('chipStatus').value       = chip.status      || 'نشطة';
    document.getElementById('chipOpenDate').value     = chip.openDate    || getTodayStr();
    document.getElementById('chipCloseDate').value    = chip.closeDate   || '';
    document.getElementById('chipNotes').value        = chip.notes       || '';
    // تعبئة قائمة المناديب
    let sel = document.getElementById('chipLinkedAccount');
    sel.innerHTML = '<option value="">— بدون ربط —</option>';
    (window.allRawAccounts || []).forEach(acc => {
        if (!acc) return;
        let opt = document.createElement('option');
        opt.value = acc.id; opt.textContent = `${acc.ownerName || acc.id} (${acc.platform || ''})`;
        if (String(acc.id) === String(chip.linkedAccountId || '')) opt.selected = true;
        sel.appendChild(opt);
    });
    new bootstrap.Modal(document.getElementById('fuelChipModal')).show();
}

function saveFuelChip() {
    if (!hasPerm('cars')) return alert('❌ ليس لديك صلاحية إدارة السيارات. تواصل مع الأدمن.');
    let id = document.getElementById('chipId').value || ('CHIP_' + Date.now());
    let data = {
        chipId:          id,
        holderName:      document.getElementById('chipHolderName').value.trim(),
        linkedAccountId: document.getElementById('chipLinkedAccount').value,
        company:         document.getElementById('chipCompany').value.trim(),
        licensePlate:    document.getElementById('chipLicensePlate').value.trim(),
        monthlyLimit:    Number(document.getElementById('chipMonthlyLimit').value) || 0,
        iqamaNumber:     document.getElementById('chipIqama').value.trim(),
        phone:           document.getElementById('chipPhone').value.trim(),
        status:          document.getElementById('chipStatus').value,
        openDate:        document.getElementById('chipOpenDate').value,
        closeDate:       document.getElementById('chipCloseDate').value,
        notes:           document.getElementById('chipNotes').value.trim(),
    };
    if (!data.holderName) return alert('الرجاء إدخال اسم حامل الشريحة');
    database.ref('ninja_data/fuel_chips/' + id).set(data).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('fuelChipModal')).hide();
        logAudit('شريحة بنزين', id, `${data.holderName} — ${data.status}`);
        alert('✅ تم حفظ الشريحة بنجاح');
    });
}

async function deleteFuelChip(id) {
    if (!hasPerm('cars')) return alert('❌ ليس لديك صلاحية. تواصل مع الأدمن.');
    let chip = window.allFuelChips[id];
    let _ok = await swalConfirm(`حذف شريحة "${chip ? chip.holderName : id}"؟`, { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('fuel_chips', id, 'ninja_data/fuel_chips/' + id, 'شريحة بنزين: ' + (chip ? chip.holderName : id));
}

function exportFuelChips() {
    let chips = Object.values(window.allFuelChips || {});
    if (!chips.length) return alert('لا توجد بيانات للتصدير');
    let data = chips.map(c => ({
        'اسم الحامل': c.holderName, 'شركة الوقود': c.company,
        'لوحة السيارة': c.licensePlate, 'الحد الشهري': c.monthlyLimit,
        'رقم الإقامة': c.iqamaNumber, 'رقم الجوال': c.phone,
        'الحالة': c.status, 'تاريخ الإنشاء': c.openDate,
        'تاريخ الإغلاق': c.closeDate, 'ملاحظات': c.notes
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FuelChips');
    XLSX.writeFile(wb, `FUEL_CHIPS_${getTodayStr()}.xlsx`);
}

// ─── قسم الحوادث (Accidents) ──────────────────────────────────────────────────

function renderAccidentsKpis() {
    let row = document.getElementById('accidentsKpiRow'); if (!row) return;
    let list = Object.values(window.allAccidents || {});
    let pending  = list.filter(a => a.status === 'قيد الإجراء').length;
    let insured  = list.filter(a => a.status === 'مرفوعة للتأمين').length;
    let resolved = list.filter(a => a.status === 'تم الحل').length;
    let total    = list.length;
    let totalCost = list.reduce((s, a) => s + Number(a.companyCost || 0), 0);
    let thisMonth = getTodayStr().slice(0, 7);
    let monthCount = list.filter(a => (a.date || '').slice(0, 7) === thisMonth).length;
    let kpis = [
        { label: 'قيد الإجراء',         value: pending,                              icon: '🔴', color: '#ef4444' },
        { label: 'مرفوعة للتأمين',       value: insured,                              icon: '📋', color: '#f59e0b' },
        { label: 'تم الحل',             value: resolved,                             icon: '✅', color: '#10b981' },
        { label: 'إجمالي الحوادث',       value: total,                                icon: '🚨', color: '#6366f1' },
        { label: 'تكلفة الشركة (ر.س)',  value: totalCost.toLocaleString(),           icon: '💰', color: '#0891b2' },
        { label: 'حوادث هذا الشهر',      value: monthCount,                           icon: '📅', color: '#7c3aed' },
    ];
    row.innerHTML = kpis.map(k => `
        <div class="col-6 col-md-2">
            <div class="card-custom p-4 text-center" style="border-top:4px solid ${k.color};">
                <div class="fs-2 mb-1">${k.icon}</div>
                <div class="fw-bold fs-4" style="color:${k.color};">${k.value}</div>
                <div class="text-muted fw-bold small">${k.label}</div>
            </div>
        </div>`).join('');
}

function renderAccidentsTable() {
    let tbody = document.getElementById('accidentsTableBody'); if (!tbody) return;
    let list = Object.values(window.allAccidents || {});
    let statusF = (document.getElementById('accidentStatusFilter') || {}).value || '';
    let typeF   = (document.getElementById('accidentTypeFilter')   || {}).value || '';
    let search  = ((document.getElementById('searchInputAccidents') || {}).value || '').toLowerCase();
    if (statusF) list = list.filter(a => a.status === statusF);
    if (typeF)   list = list.filter(a => a.type === typeF);
    if (search)  list = list.filter(a => [a.plate, a.driver, a.location, a.type, a.reportNo, a.description, a.otherParty].some(f => String(f||'').toLowerCase().includes(search)));
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-muted py-5 fw-bold">لا توجد حوادث مسجلة. اضغط "تسجيل حادثة" للبدء.</td></tr>`;
        return;
    }
    const statusBadge = s => {
        if (s === 'قيد الإجراء')      return `<span class="badge bg-danger px-3 py-2">🔴 قيد الإجراء</span>`;
        if (s === 'مرفوعة للتأمين')   return `<span class="badge bg-warning text-dark px-3 py-2">📋 مرفوعة للتأمين</span>`;
        if (s === 'تم الحل')          return `<span class="badge bg-success px-3 py-2">✅ تم الحل</span>`;
        if (s === 'مغلقة')            return `<span class="badge bg-secondary px-3 py-2">🔒 مغلقة</span>`;
        return `<span class="badge bg-secondary px-3 py-2">${s}</span>`;
    };
    const typeBadge = t => {
        const map = { 'تصادم':'danger','جنح':'warning','دهس':'dark','انقلاب':'secondary','أخرى':'info' };
        return `<span class="badge bg-${map[t]||'secondary'} text-white px-2 py-1">${t}</span>`;
    };
    const isOpenOld = a => {
        if (a.status === 'تم الحل' || a.status === 'مغلقة') return false;
        let d = daysUntil(a.date);
        return d !== null && d < -7;
    };
    const faultBadge = pct => {
        if (!pct) return '<span class="badge bg-secondary">—</span>';
        const cfg = { '25': ['bg-success','25%'], '50': ['bg-warning text-dark','50%'], '75': ['','75%'], '100': ['bg-danger','100%'] };
        let [cls, label] = cfg[String(pct)] || ['bg-secondary', pct + '%'];
        let style = pct === '75' ? 'background:#f97316;color:#fff;' : '';
        return `<span class="badge px-2 py-1 ${cls}" style="${style}">${label}</span>`;
    };
    tbody.innerHTML = list.map(a => `
        <tr class="${isOpenOld(a) ? 'table-danger' : ''}">
            <td><b>${a.date || '—'}</b>${a.time ? '<br><small class="text-muted">' + a.time + '</small>' : ''}</td>
            <td><b class="text-primary">${escHtml(a.plate || '—')}</b><br><small class="text-muted">${a.carLabel || ''}</small></td>
            <td>${a.driver || '—'}</td>
            <td>${typeBadge(a.type || '—')}</td>
            <td><small>${escHtml(a.location || '—')}</small></td>
            <td>${a.injuries === 'نعم' ? `<span class="badge bg-danger">نعم</span>${a.injuryDesc ? '<br><small>' + a.injuryDesc + '</small>' : ''}` : '<span class="badge bg-success">لا</span>'}</td>
            <td><small dir="ltr">${a.reportNo || '—'}</small></td>
            <td>${faultBadge(a.faultPct)}</td>
            <td>${a.najmReportUrl
                ? `<a href="${a.najmReportUrl}" target="_blank" class="btn btn-sm btn-outline-danger fw-bold"><i class="bi bi-file-earmark-pdf-fill me-1"></i>نجم</a>`
                : '<span class="text-muted small">—</span>'}</td>
            <td><b class="text-danger">${Number(a.repairCost || 0).toLocaleString()} ر.س</b></td>
            <td><small>${a.insurance || '—'}</small></td>
            <td><b class="text-primary">${Number(a.companyCost || 0).toLocaleString()} ر.س</b></td>
            <td>${statusBadge(a.status)}</td>
            <td>
                <button onclick="openAccidentModal('${a.id}')" class="btn btn-sm btn-outline-primary rounded-pill me-1"><i class="bi bi-pencil-fill"></i></button>
                <button onclick="deleteAccident('${a.id}')" class="btn btn-sm btn-outline-danger rounded-pill"><i class="bi bi-trash-fill"></i></button>
            </td>
        </tr>`).join('');
}

function fillAccidentPlate() {
    let carId = (document.getElementById('accidentCarId') || {}).value || '';
    let car = (window.allCars || []).find(c => String(c.id) === carId);
    let plateEl = document.getElementById('accidentPlate');
    if (plateEl) plateEl.value = car ? (car.plate || '') : '';
}

function toggleInjuryDesc() {
    let val = (document.getElementById('accidentInjuries') || {}).value;
    let row = document.getElementById('injuryDescRow');
    if (row) row.style.display = val === 'نعم' ? '' : 'none';
}

function calcCompanyCost() {
    let repair    = Number((document.getElementById('accidentRepairCost') || {}).value) || 0;
    let insAmt    = Number((document.getElementById('accidentInsuranceAmount') || {}).value) || 0;
    let insType   = (document.getElementById('accidentInsurance') || {}).value || '';
    let company   = insType === 'مغطى كليًا' ? 0 : Math.max(0, repair - insAmt);
    let el = document.getElementById('accidentCompanyCost');
    if (el) el.value = company;
}

function openAccidentModal(id) {
    let a = id ? (window.allAccidents[id] || {}) : {};
    // populate car dropdown
    let carSel = document.getElementById('accidentCarId');
    if (carSel) {
        carSel.innerHTML = '<option value="">— اختر السيارة —</option>' +
            (window.allCars || []).map(c => `<option value="${c.id}" ${a.carId === c.id ? 'selected' : ''}>${escHtml(c.plate || '')} — ${c.type || ''}</option>`).join('');
    }
    // populate driver dropdown
    let drvSel = document.getElementById('accidentDriver');
    if (drvSel) {
        let drivers = (window.allRawAccounts || []).filter(ac => ac && ac.actualUserName && ac.actualUserName !== '-');
        drvSel.innerHTML = '<option value="">— اختر المندوب —</option>' +
            drivers.map(ac => `<option value="${escHtml(ac.actualUserName)}" ${a.driver === ac.actualUserName ? 'selected' : ''}>${escHtml(ac.actualUserName)}</option>`).join('');
    }
    document.getElementById('accidentId').value          = id || '';
    document.getElementById('accidentDate').value        = a.date || getTodayStr();
    document.getElementById('accidentTime').value        = a.time || '';
    document.getElementById('accidentType').value        = a.type || 'تصادم';
    document.getElementById('accidentPlate').value       = a.plate || '';
    document.getElementById('accidentLocation').value    = a.location || '';
    document.getElementById('accidentOtherParty').value  = a.otherParty || '';
    document.getElementById('accidentReportNo').value    = a.reportNo || '';
    document.getElementById('accidentInjuries').value    = a.injuries || 'لا';
    document.getElementById('accidentInjuryDesc').value  = a.injuryDesc || '';
    document.getElementById('accidentDescription').value = a.description || '';
    document.getElementById('accidentRepairCost').value  = a.repairCost || 0;
    document.getElementById('accidentInsurance').value   = a.insurance || 'غير مغطى';
    document.getElementById('accidentInsuranceAmount').value = a.insuranceAmount || 0;
    document.getElementById('accidentCompanyCost').value = a.companyCost || 0;
    document.getElementById('accidentStatus').value      = a.status || 'قيد الإجراء';
    document.getElementById('accidentFaultPct').value    = a.faultPct || '';
    document.getElementById('accidentNotes').value       = a.notes || '';
    // تقرير نجم
    let url = a.najmReportUrl || '';
    document.getElementById('najmReportUrl').value = url;
    document.getElementById('najmPdfInput').value  = '';
    _updateNajmUI(url);
    toggleInjuryDesc();
    new bootstrap.Modal(document.getElementById('accidentModal')).show();
}

function saveAccident() {
    let id    = document.getElementById('accidentId').value || ('ACC_' + Date.now());
    let carId = document.getElementById('accidentCarId').value;
    let car   = (window.allCars || []).find(c => String(c.id) === carId);
    let data  = {
        id,
        carId,
        carLabel:         car ? (car.type || '') : '',
        plate:            document.getElementById('accidentPlate').value.trim()      || (car ? car.plate : ''),
        driver:           document.getElementById('accidentDriver').value.trim(),
        date:             document.getElementById('accidentDate').value,
        time:             document.getElementById('accidentTime').value,
        type:             document.getElementById('accidentType').value,
        location:         document.getElementById('accidentLocation').value.trim(),
        otherParty:       document.getElementById('accidentOtherParty').value.trim(),
        reportNo:         document.getElementById('accidentReportNo').value.trim(),
        injuries:         document.getElementById('accidentInjuries').value,
        injuryDesc:       document.getElementById('accidentInjuryDesc').value.trim(),
        description:      document.getElementById('accidentDescription').value.trim(),
        repairCost:       Number(document.getElementById('accidentRepairCost').value) || 0,
        insurance:        document.getElementById('accidentInsurance').value,
        insuranceAmount:  Number(document.getElementById('accidentInsuranceAmount').value) || 0,
        companyCost:      Number(document.getElementById('accidentCompanyCost').value) || 0,
        status:           document.getElementById('accidentStatus').value,
        faultPct:         document.getElementById('accidentFaultPct').value,
        najmReportUrl:    document.getElementById('najmReportUrl').value || '',
        notes:            document.getElementById('accidentNotes').value.trim(),
        updatedBy:        window.loggedInUser,
        updatedAt:        getTodayStr(),
    };
    database.ref('ninja_data/accidents/' + id).set(data).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('accidentModal')).hide();
        logAudit('حادثة', id, `تم تسجيل/تعديل حادثة — ${data.plate} — ${data.type}`);
        triggerPushNotification('🚨 حادثة جديدة', `${data.plate} — ${data.type}`, { tag: 'accident-' + id, sticky: true });
    });
}

function _updateNajmUI(url) {
    let linkDiv  = document.getElementById('najmReportLink');
    let uploadBtn = document.getElementById('najmUploadBtn');
    let viewLink  = document.getElementById('najmViewLink');
    if (!linkDiv) return;
    if (url) {
        linkDiv.style.display  = '';
        if (uploadBtn) uploadBtn.style.display = 'none';
        if (viewLink)  viewLink.href = url;
    } else {
        linkDiv.style.display  = 'none';
        if (uploadBtn) uploadBtn.style.display = '';
    }
}

function uploadNajmReport(event) {
    let file = event.target.files[0];
    if (!file) return;
    // استخدم معرف الحادثة الحالي أو أنشئ واحداً جديداً
    let accId = document.getElementById('accidentId').value;
    if (!accId) { accId = 'ACC_' + Date.now(); document.getElementById('accidentId').value = accId; }
    let progress = document.getElementById('najmUploadProgress');
    let uploadBtn = document.getElementById('najmUploadBtn');
    if (progress)  { progress.style.display = ''; }
    if (uploadBtn) { uploadBtn.style.display = 'none'; }
    let storageRef = storage.ref(`accident_najm/${accId}/najm_${Date.now()}.pdf`);
    storageRef.put(file).then(snap => snap.ref.getDownloadURL()).then(url => {
        document.getElementById('najmReportUrl').value = url;
        if (progress) progress.style.display = 'none';
        _updateNajmUI(url);
    }).catch(err => {
        if (progress) progress.style.display = 'none';
        if (uploadBtn) uploadBtn.style.display = '';
        alert('❌ فشل رفع الملف: ' + err.message);
    });
}

async function deleteAccident(id) {
    let _ok = await swalConfirm('هل تريد حذف هذه الحادثة؟', { confirmText: 'نعم، احذف' }); if (!_ok) return;
    let acc = (window.allAccidents || {})[id] || {};
    trashAndDelete('accidents', id, 'ninja_data/accidents/' + id, 'حادثة: ' + (acc.driverName || acc.plateNumber || id));
}

function exportAccidents() {
    let list = Object.values(window.allAccidents || {});
    if (!list.length) return alert('لا توجد بيانات للتصدير');
    let data = list.map(a => ({
        'التاريخ': a.date, 'الوقت': a.time,
        'لوحة السيارة': a.plate, 'نوع السيارة': a.carLabel,
        'السائق': a.driver, 'نوع الحادث': a.type,
        'المكان': a.location, 'الطرف الثاني': a.otherParty,
        'إصابات': a.injuries, 'تفاصيل الإصابات': a.injuryDesc,
        'وصف الحادث': a.description, 'رقم البلاغ': a.reportNo,
        'تكلفة الإصلاح': a.repairCost, 'تغطية التأمين': a.insurance,
        'مبلغ التأمين': a.insuranceAmount, 'مدفوع من الشركة': a.companyCost,
        'نسبة الخطأ %': a.faultPct || '—', 'تقرير نجم': a.najmReportUrl ? 'مرفق' : '—',
        'الحالة': a.status, 'ملاحظات': a.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Accidents');
    XLSX.writeFile(wb, `ACCIDENTS_${getTodayStr()}.xlsx`);
}

// ─── الصيانة الدورية للسيارات (Car Maintenance) ───────────────────────────────

function _isCarMaintOverdue(m) {
    if (m.status === 'منجزة') return false;
    let byDate = daysUntil(m.nextDate);
    if (byDate !== null && byDate < 0) return true;
    let curKm = Number(((window.allCars || []).find(c => c.id === m.carId) || {}).kmTotal || 0);
    let nextKm = Number(m.nextKm || 0);
    return nextKm > 0 && curKm >= nextKm;
}

function renderCarMaintenanceKpis() {
    let row = document.getElementById('carMaintenanceKpiRow'); if (!row) return;
    let list = Object.values(window.allCarMaintenance || {});
    let thisMonth = getTodayStr().slice(0, 7);
    let doneMonth  = list.filter(m => m.status === 'منجزة' && (m.date || '').slice(0, 7) === thisMonth).length;
    let scheduled  = list.filter(m => m.status === 'مجدولة').length;
    let overdue    = list.filter(m => m.status === 'متأخرة' || _isCarMaintOverdue(m)).length;
    let total      = list.length;
    let totalCost  = list.reduce((s, m) => s + Number(m.cost || 0), 0);
    let kpis = [
        { label: 'منجزة هذا الشهر',  value: doneMonth,                      icon: '✅', color: '#10b981' },
        { label: 'مجدولة',           value: scheduled,                      icon: '📅', color: '#3b82f6' },
        { label: 'متأخرة',           value: overdue,                        icon: '🔴', color: '#ef4444' },
        { label: 'إجمالي الصيانات',  value: total,                          icon: '🔧', color: '#6366f1' },
        { label: 'إجمالي التكلفة',   value: totalCost.toLocaleString() + ' ر.س', icon: '💰', color: '#0891b2' },
    ];
    row.innerHTML = kpis.map(k => `
        <div class="col-6 col-md-2" style="flex:1 1 18%;">
            <div class="card-custom p-4 text-center" style="border-top:4px solid ${k.color};">
                <div class="fs-2 mb-1">${k.icon}</div>
                <div class="fw-bold fs-4" style="color:${k.color};">${k.value}</div>
                <div class="text-muted fw-bold small">${k.label}</div>
            </div>
        </div>`).join('');
}

function renderCarMaintenanceTable() {
    let tbody = document.getElementById('carMaintenanceTableBody'); if (!tbody) return;
    let list = Object.values(window.allCarMaintenance || {});
    let statusF = (document.getElementById('maintCarStatusFilter') || {}).value || '';
    let typeF   = (document.getElementById('maintCarTypeFilter')   || {}).value || '';
    let search  = ((document.getElementById('searchInputMaintenance') || {}).value || '').toLowerCase();
    if (statusF) list = list.filter(m => m.status === statusF || (statusF === 'متأخرة' && _isCarMaintOverdue(m)));
    if (typeF)   list = list.filter(m => m.type === typeF);
    if (search)  list = list.filter(m => [m.plate, m.carLabel, m.type, m.workshop, m.notes].some(f => String(f||'').toLowerCase().includes(search)));
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-muted py-5 fw-bold">لا توجد سجلات صيانة. اضغط "إضافة صيانة" للبدء.</td></tr>`;
        return;
    }
    const statusBadge = m => {
        let overdue = _isCarMaintOverdue(m);
        if (m.status === 'منجزة')   return `<span class="badge bg-success px-3 py-2">✅ منجزة</span>`;
        if (m.status === 'متأخرة' || overdue) return `<span class="badge bg-danger px-3 py-2">🔴 متأخرة</span>`;
        return `<span class="badge bg-primary px-3 py-2">📅 مجدولة</span>`;
    };
    tbody.innerHTML = list.map(m => {
        let overdue = _isCarMaintOverdue(m);
        let nextDateD = daysUntil(m.nextDate);
        let nextDateCell = m.nextDate
            ? `${m.nextDate}<br><small class="${nextDateD !== null && nextDateD < 0 ? 'text-danger' : nextDateD !== null && nextDateD <= 7 ? 'text-warning' : 'text-muted'} fw-bold">${nextDateD !== null ? (nextDateD < 0 ? `متأخر ${Math.abs(nextDateD)} يوم` : `بعد ${nextDateD} يوم`) : ''}</small>`
            : '—';
        return `<tr class="${overdue && m.status !== 'منجزة' ? 'table-warning' : ''}">
            <td><b class="text-primary">${escHtml(m.plate || '—')}</b><br><small class="text-muted">${m.carLabel || ''}</small></td>
            <td><b>${m.type || '—'}</b></td>
            <td>${m.date || '—'}</td>
            <td dir="ltr"><b>${Number(m.km || 0).toLocaleString()} كم</b></td>
            <td><small>${m.workshop || '—'}</small></td>
            <td><b class="text-success">${Number(m.cost || 0).toLocaleString()} ر.س</b></td>
            <td>${nextDateCell}</td>
            <td dir="ltr"><small>${m.nextKm ? Number(m.nextKm).toLocaleString() + ' كم' : '—'}</small></td>
            <td>${statusBadge(m)}</td>
            <td><small class="text-muted">${escHtml(m.notes || '—')}</small></td>
            <td>
                <button onclick="openCarMaintenanceModal('${m.id}')" class="btn btn-sm btn-outline-primary rounded-pill me-1"><i class="bi bi-pencil-fill"></i></button>
                <button onclick="deleteCarMaintenance('${m.id}')" class="btn btn-sm btn-outline-danger rounded-pill"><i class="bi bi-trash-fill"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function fillMaintPlate() {
    let carId = (document.getElementById('carMaintCarId') || {}).value || '';
    let car = (window.allCars || []).find(c => String(c.id) === carId);
    let el = document.getElementById('carMaintPlate');
    if (el) el.value = car ? (car.plate || '') : '';
}

function openCarMaintenanceModal(id) {
    let m = id ? (window.allCarMaintenance[id] || {}) : {};
    let carSel = document.getElementById('carMaintCarId');
    if (carSel) {
        carSel.innerHTML = '<option value="">— اختر السيارة —</option>' +
            (window.allCars || []).map(c => `<option value="${c.id}" ${m.carId === c.id ? 'selected' : ''}>${escHtml(c.plate || '')} — ${c.type || ''}</option>`).join('');
    }
    document.getElementById('carMaintId').value       = id || '';
    document.getElementById('carMaintPlate').value    = m.plate || '';
    document.getElementById('carMaintType').value     = m.type || 'تغيير زيت';
    document.getElementById('carMaintStatus').value   = m.status || 'منجزة';
    document.getElementById('carMaintDate').value     = m.date || getTodayStr();
    document.getElementById('carMaintKm').value       = m.km || '';
    document.getElementById('carMaintWorkshop').value = m.workshop || '';
    document.getElementById('carMaintCost').value     = m.cost || 0;
    document.getElementById('carMaintNextDate').value = m.nextDate || '';
    document.getElementById('carMaintNextKm').value   = m.nextKm || '';
    document.getElementById('carMaintNotes').value    = m.notes || '';
    new bootstrap.Modal(document.getElementById('carMaintenanceModal')).show();
}

function saveCarMaintenance() {
    let id    = document.getElementById('carMaintId').value || ('MAINT_' + Date.now());
    let carId = document.getElementById('carMaintCarId').value;
    let car   = (window.allCars || []).find(c => String(c.id) === carId);
    let data  = {
        id,
        carId,
        carLabel:  car ? (car.type || '') : '',
        plate:     document.getElementById('carMaintPlate').value.trim() || (car ? car.plate : ''),
        type:      document.getElementById('carMaintType').value,
        status:    document.getElementById('carMaintStatus').value,
        date:      document.getElementById('carMaintDate').value,
        km:        Number(document.getElementById('carMaintKm').value) || 0,
        workshop:  document.getElementById('carMaintWorkshop').value.trim(),
        cost:      Number(document.getElementById('carMaintCost').value) || 0,
        nextDate:  document.getElementById('carMaintNextDate').value,
        nextKm:    Number(document.getElementById('carMaintNextKm').value) || 0,
        notes:     document.getElementById('carMaintNotes').value.trim(),
        updatedBy: window.loggedInUser,
        updatedAt: getTodayStr(),
    };
    database.ref('ninja_data/car_maintenance/' + id).set(data).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('carMaintenanceModal')).hide();
        logAudit('صيانة دورية', id, `تم حفظ صيانة — ${data.plate} — ${data.type}`);
    });
}

async function deleteCarMaintenance(id) {
    let _ok = await swalConfirm('هل تريد حذف سجل الصيانة هذا؟', { confirmText: 'نعم، احذف' }); if (!_ok) return;
    let m = (window.allCarMaintenance || {})[id] || {};
    trashAndDelete('car_maintenance', id, 'ninja_data/car_maintenance/' + id, 'صيانة: ' + (m.plateNumber || id));
}

function exportCarMaintenance() {
    let list = Object.values(window.allCarMaintenance || {});
    if (!list.length) return alert('لا توجد بيانات للتصدير');
    let data = list.map(m => ({
        'السيارة':                  m.carLabel, 'لوحة السيارة': m.plate,
        'نوع الصيانة':              m.type,     'الحالة': m.status,
        'تاريخ الصيانة':            m.date,     'الكيلومترات': m.km,
        'الورشة':                   m.workshop, 'التكلفة': m.cost,
        'موعد الصيانة القادمة':     m.nextDate, 'كم الصيانة القادمة': m.nextKm,
        'ملاحظات':                  m.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CarMaintenance');
    XLSX.writeFile(wb, `CAR_MAINTENANCE_${getTodayStr()}.xlsx`);
}

// ─── الاستلام والتصوير (Car Handover) ─────────────────────────────────────────

function renderHandoverKpis() {
    let row = document.getElementById('handoverKpiRow'); if (!row) return;
    let list = Object.values(window.allHandovers || {});
    let thisMonth = getTodayStr().slice(0, 7);
    let received  = list.filter(h => h.type === 'استلام').length;
    let delivered = list.filter(h => h.type === 'تسليم').length;
    let monthOps  = list.filter(h => (h.date || '').slice(0, 7) === thisMonth).length;
    let totalPhotos = list.reduce((s, h) => s + ((h.photos || []).length), 0);
    let kpis = [
        { label: 'إجمالي العمليات',        value: list.length,   icon: '📋', color: '#6366f1' },
        { label: 'استلامات',               value: received,      icon: '🟢', color: '#10b981' },
        { label: 'تسليمات',                value: delivered,     icon: '🔴', color: '#ef4444' },
        { label: 'عمليات هذا الشهر',       value: monthOps,      icon: '📅', color: '#0891b2' },
        { label: 'إجمالي الصور المرفوعة',  value: totalPhotos,   icon: '📸', color: '#7c3aed' },
    ];
    row.innerHTML = kpis.map(k => `
        <div class="col-6 col-md-2" style="flex:1 1 18%;">
            <div class="card-custom p-4 text-center" style="border-top:4px solid ${k.color};">
                <div class="fs-2 mb-1">${k.icon}</div>
                <div class="fw-bold fs-4" style="color:${k.color};">${k.value}</div>
                <div class="text-muted fw-bold small">${k.label}</div>
            </div>
        </div>`).join('');
}

function renderHandoverTable() {
    let tbody = document.getElementById('handoverTableBody'); if (!tbody) return;
    let list = Object.values(window.allHandovers || {});
    let typeF      = (document.getElementById('handoverTypeFilter')      || {}).value || '';
    let conditionF = (document.getElementById('handoverConditionFilter') || {}).value || '';
    let search     = ((document.getElementById('searchInputHandover')    || {}).value || '').toLowerCase();
    if (typeF)      list = list.filter(h => h.type === typeF);
    if (conditionF) list = list.filter(h => h.condition === conditionF);
    if (search)     list = list.filter(h => [h.plate, h.personName, h.supervisor, h.carLabel, h.notes].some(f => String(f||'').toLowerCase().includes(search)));
    list.sort((a, b) => ((b.date || '') + (b.time || '')).localeCompare((a.date || '') + (a.time || '')));
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-muted py-5 fw-bold">لا توجد عمليات مسجلة. اضغط "تسجيل استلام / تسليم" للبدء.</td></tr>`;
        return;
    }
    const typeBadge = t => t === 'استلام'
        ? `<span class="badge bg-success fs-7 px-3 py-2">🟢 استلام</span>`
        : `<span class="badge bg-danger fs-7 px-3 py-2">🔴 تسليم</span>`;
    const condBadge = c => {
        const m = { 'ممتازة': 'success', 'جيدة': 'primary', 'متوسطة': 'warning', 'تحتاج صيانة': 'warning', 'تالفة': 'danger' };
        return `<span class="badge bg-${m[c]||'secondary'} px-2 py-1">${c}</span>`;
    };
    const fuelBar = f => {
        const lvl = { 'ممتلئ': 100, 'ثلاثة أرباع': 75, 'نصف': 50, 'ربع': 25, 'فارغ تقريبًا': 5 };
        let pct = lvl[f] || 0;
        let color = pct > 50 ? 'success' : pct > 20 ? 'warning' : 'danger';
        return `<div style="min-width:80px;"><small class="fw-bold">${f}</small><div class="progress mt-1" style="height:5px;"><div class="progress-bar bg-${color}" style="width:${pct}%"></div></div></div>`;
    };
    const photoThumb = h => {
        if (!h.photos || !h.photos.length) return '<span class="text-muted small">—</span>';
        return `<div class="d-flex gap-1 flex-wrap justify-content-center">
            <img src="${h.photos[0]}" onclick="viewHandoverPhoto('${h.photos[0]}')" style="width:48px;height:48px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid #e2e8f0;" title="اضغط للتكبير">
            ${h.photos.length > 1 ? `<span class="badge bg-dark align-self-end" style="font-size:10px;">+${h.photos.length - 1}</span>` : ''}
        </div>`;
    };
    tbody.innerHTML = list.map(h => `
        <tr>
            <td>
                <b>${h.date || '—'}</b>${h.time ? '<br><small class="text-muted">' + h.time + '</small>' : ''}
                ${h.receiveDate ? `<div class="mt-1"><span class="badge bg-success-subtle text-success border border-success-subtle" style="font-size:0.68rem;">🟢 استلام</span><br><small>${h.receiveDate}</small><br><small class="text-muted" dir="rtl">${h.receiveDateHijri||toHijri(h.receiveDate)}</small></div>` : ''}
                ${h.returnDate  ? `<div class="mt-1"><span class="badge bg-danger-subtle text-danger border border-danger-subtle" style="font-size:0.68rem;">🔴 تسليم</span><br><small>${h.returnDate}</small><br><small class="text-muted" dir="rtl">${h.returnDateHijri||toHijri(h.returnDate)}</small></div>` : ''}
            </td>
            <td>${typeBadge(h.type)}</td>
            <td><b class="text-primary">${escHtml(h.plate || '—')}</b><br><small class="text-muted">${h.carLabel || ''}</small></td>
            <td><b>${h.personName || '—'}</b></td>
            <td><small class="text-info fw-bold">${h.supervisor || '—'}</small></td>
            <td dir="ltr"><b>${Number(h.km || 0).toLocaleString()} كم</b></td>
            <td>${fuelBar(h.fuel || '—')}</td>
            <td>${condBadge(h.condition || '—')}</td>
            <td>${photoThumb(h)}</td>
            <td><small class="text-muted">${escHtml((h.notes || '').slice(0, 40) || '—')}</small></td>
            <td>
                <button onclick="openHandoverModal('${h.id}')" class="btn btn-sm btn-outline-primary rounded-pill me-1"><i class="bi bi-pencil-fill"></i></button>
                <button onclick="viewAllHandoverPhotos('${h.id}')" class="btn btn-sm btn-outline-dark rounded-pill me-1" title="عرض كل الصور"><i class="bi bi-images"></i></button>
                <button onclick="deleteHandover('${h.id}')" class="btn btn-sm btn-outline-danger rounded-pill"><i class="bi bi-trash-fill"></i></button>
            </td>
        </tr>`).join('');
}

/* ─── Photo helpers ─── */
function triggerHandoverCamera()  { document.getElementById('handoverCameraInput').click(); }
function triggerHandoverUpload()  { document.getElementById('handoverGalleryInput').click(); }

function addHandoverPhotos(input) {
    Array.from(input.files).forEach(file => {
        window.pendingHandoverPhotos.push({ file, localUrl: URL.createObjectURL(file), existing: false });
    });
    renderHandoverPhotoPreview();
    input.value = '';
}

function renderHandoverPhotoPreview() {
    let container = document.getElementById('handoverPhotoPreview'); if (!container) return;
    let count = window.pendingHandoverPhotos.length;
    let countEl = document.getElementById('handoverPhotoCount');
    if (countEl) countEl.textContent = count ? `${count} صورة` : '';
    container.innerHTML = window.pendingHandoverPhotos.map((p, i) => `
        <div class="position-relative" style="width:90px;height:90px;">
            <img src="${p.localUrl || p.url}" onclick="viewHandoverPhoto('${p.localUrl || p.url}')"
                style="width:100%;height:100%;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid ${p.existing ? '#10b981' : '#f59e0b'};">
            <button type="button" onclick="removeHandoverPhoto(${i})"
                class="btn btn-danger position-absolute d-flex align-items-center justify-content-center"
                style="top:-6px;right:-6px;width:20px;height:20px;padding:0;font-size:10px;border-radius:50%;">✕</button>
            <span class="badge position-absolute" style="bottom:3px;left:3px;font-size:9px;background:${p.existing ? '#10b981' : '#f59e0b'};color:${p.existing ? '#fff' : '#000'};">
                ${p.existing ? '✓' : 'جديدة'}
            </span>
        </div>`).join('');
}

function removeHandoverPhoto(index) {
    window.pendingHandoverPhotos.splice(index, 1);
    renderHandoverPhotoPreview();
}

function viewHandoverPhoto(url) {
    let w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;">
        <img src="${url}" style="max-width:100%;max-height:100vh;object-fit:contain;"></body></html>`);
}

function viewAllHandoverPhotos(id) {
    let h = window.allHandovers[id]; if (!h || !h.photos || !h.photos.length) return alert('لا توجد صور لهذه العملية.');
    let w = window.open('', '_blank', 'width=900,height=700');
    let imgs = h.photos.map(url => `<img src="${url}" style="max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px;margin:8px;">`).join('');
    w.document.write(`<html><body style="margin:0;background:#111;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:16px;">${imgs}</body></html>`);
}

/* ─── Open modal ─── */
function openHandoverModal(id) {
    let h = id ? (window.allHandovers[id] || {}) : {};
    let carSel = document.getElementById('handoverCarId');
    if (carSel) {
        carSel.innerHTML = '<option value="">— اختر السيارة —</option>' +
            (window.allCars || []).map(c => `<option value="${c.id}" ${h.carId === c.id ? 'selected' : ''}>${escHtml(c.plate || '')} — ${c.type || ''}</option>`).join('');
    }
    document.getElementById('handoverId').value          = id || '';
    document.getElementById('handoverType').value        = h.type || 'استلام';
    document.getElementById('handoverDate').value        = h.date || getTodayStr();
    document.getElementById('handoverTime').value        = h.time || new Date().toTimeString().slice(0,5);
    document.getElementById('handoverPlate').value       = h.plate || '';
    document.getElementById('handoverPersonName').value  = h.personName || '';
    document.getElementById('handoverSupervisor').value  = h.supervisor || (window.loggedInUser || '');
    document.getElementById('handoverKm').value          = h.km || '';
    document.getElementById('handoverFuel').value        = h.fuel || 'ممتلئ';
    document.getElementById('handoverCondition').value   = h.condition || 'جيدة';
    document.getElementById('handoverNotes').value       = h.notes || '';
    // تواريخ الاستلام والتسليم
    document.getElementById('handoverReceiveDate').value     = h.receiveDate || '';
    document.getElementById('handoverReceiveDateHijri').value = h.receiveDate ? toHijri(h.receiveDate) : '';
    document.getElementById('handoverReturnDate').value      = h.returnDate || '';
    document.getElementById('handoverReturnDateHijri').value  = h.returnDate ? toHijri(h.returnDate) : '';
    // load existing photos
    window.pendingHandoverPhotos = (h.photos || []).map(url => ({ url, localUrl: url, existing: true }));
    renderHandoverPhotoPreview();
    new bootstrap.Modal(document.getElementById('handoverModal')).show();
}

function fillHandoverPlate() {
    let carId = (document.getElementById('handoverCarId') || {}).value || '';
    let car = (window.allCars || []).find(c => String(c.id) === carId);
    let el = document.getElementById('handoverPlate');
    if (el) el.value = car ? (car.plate || '') : '';
}

/* ─── Save with photo upload ─── */
async function saveHandover() {
    let saveBtn = document.getElementById('handoverSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>جاري الحفظ...'; }

    let id    = document.getElementById('handoverId').value || ('HO_' + Date.now());
    let carId = document.getElementById('handoverCarId').value;
    let car   = (window.allCars || []).find(c => String(c.id) === carId);

    // Separate existing URLs from new files
    let existingUrls = window.pendingHandoverPhotos.filter(p => p.existing).map(p => p.url);
    let newPhotos    = window.pendingHandoverPhotos.filter(p => !p.existing);

    // Upload new photos with progress UI
    let progressDiv = document.getElementById('handoverUploadProgress');
    let progressBar = document.getElementById('handoverUploadBar');
    let progressPct = document.getElementById('handoverUploadPct');
    let newUrls = [];

    if (newPhotos.length > 0) {
        if (progressDiv) progressDiv.style.display = '';
        let done = 0;
        for (let p of newPhotos) {
            let ext = p.file.name.split('.').pop() || 'jpg';
            let ref = storage.ref(`vehicle_handovers/${id}/${Date.now()}_${done}.${ext}`);
            await new Promise((resolve, reject) => {
                let task = ref.put(p.file);
                task.on('state_changed',
                    snap => {
                        let overall = Math.round(((done + snap.bytesTransferred / snap.totalBytes) / newPhotos.length) * 100);
                        if (progressBar) progressBar.style.width = overall + '%';
                        if (progressPct) progressPct.textContent = overall + '%';
                    },
                    reject,
                    () => task.snapshot.ref.getDownloadURL().then(url => { newUrls.push(url); done++; resolve(); })
                );
            });
        }
        if (progressDiv) progressDiv.style.display = 'none';
    }

    let allPhotos = [...existingUrls, ...newUrls];
    let data = {
        id,
        type:       document.getElementById('handoverType').value,
        date:       document.getElementById('handoverDate').value,
        time:       document.getElementById('handoverTime').value,
        carId,
        carLabel:   car ? (car.type || '') : '',
        plate:      document.getElementById('handoverPlate').value.trim() || (car ? car.plate : ''),
        personName: document.getElementById('handoverPersonName').value.trim(),
        supervisor: document.getElementById('handoverSupervisor').value.trim(),
        km:         Number(document.getElementById('handoverKm').value) || 0,
        fuel:       document.getElementById('handoverFuel').value,
        condition:  document.getElementById('handoverCondition').value,
        notes:      document.getElementById('handoverNotes').value.trim(),
        receiveDate:      document.getElementById('handoverReceiveDate').value || '',
        receiveDateHijri: toHijri(document.getElementById('handoverReceiveDate').value || ''),
        returnDate:       document.getElementById('handoverReturnDate').value || '',
        returnDateHijri:  toHijri(document.getElementById('handoverReturnDate').value || ''),
        photos:     allPhotos,
        updatedBy:  window.loggedInUser,
        updatedAt:  getTodayStr(),
    };

    database.ref('ninja_data/car_handovers/' + id).set(data).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('handoverModal')).hide();
        logAudit('استلام/تسليم', id, `${data.type} — ${data.plate} — ${allPhotos.length} صورة`);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>حفظ العملية'; }
    }).catch(err => {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>حفظ العملية'; }
        alert('حدث خطأ أثناء الحفظ: ' + err.message);
    });
}

async function deleteHandover(id) {
    let h = window.allHandovers[id] || {};
    let _ok = await swalConfirm('هل تريد حذف هذه العملية؟ (يمكن التراجع واسترجاعها لاحقاً)', { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('car_handovers', id, 'ninja_data/car_handovers/' + id, 'استلام/تسليم: ' + (h.driverName || h.plateNumber || id));
}

// ─── إيجار السيارات (Car Rentals) ────────────────────────────────────────────

function renderRentalKpis() {
    let row = document.getElementById('rentalKpiRow'); if (!row) return;
    let rents = Object.values(window.allCarRentals || {});
    let active    = rents.filter(r => r.status === 'نشط').length;
    let ended     = rents.filter(r => r.status === 'منتهي').length;
    let cancelled = rents.filter(r => r.status === 'ملغي').length;
    let today     = getTodayStr();
    let expiringSoon = rents.filter(r => r.status === 'نشط' && r.endDate && r.endDate >= today && daysUntil(r.endDate) <= 7).length;
    let monthlyRevenue = rents.filter(r => r.status === 'نشط' || r.status === 'منتهي')
        .reduce((s, r) => s + Number(r.paidAmount || 0), 0);
    let outstanding = rents.reduce((s, r) => s + Math.max(0, Number(r.totalAmount || 0) - Number(r.paidAmount || 0)), 0);

    let kpis = [
        { label: L('عقود نشطة','Active'), value: active, icon: '🟢', color: '#10b981' },
        { label: L('تنتهي خلال 7 أيام','Expiring Soon'), value: expiringSoon, icon: '⚠️', color: '#f59e0b' },
        { label: L('إجمالي المحصّل','Total Collected'), value: monthlyRevenue.toLocaleString() + ' ' + L('ر.س','SAR'), icon: '💰', color: '#3b82f6' },
        { label: L('متأخرات','Outstanding'), value: outstanding.toLocaleString() + ' ' + L('ر.س','SAR'), icon: '⏳', color: outstanding > 0 ? '#ef4444' : '#6b7280' },
        { label: L('منتهية','Ended'), value: ended, icon: '⚫', color: '#6b7280' },
        { label: L('ملغاة','Cancelled'), value: cancelled, icon: '🔴', color: '#ef4444' }
    ];
    row.innerHTML = kpis.map(k => `<div class="col-6 col-md-4 col-lg-2">
        <div class="card-custom p-3 text-center" style="border-top:4px solid ${k.color};">
            <div class="fs-3">${k.icon}</div>
            <div class="fw-bold fs-5" style="color:${k.color};">${k.value}</div>
            <div class="text-muted fw-bold small">${k.label}</div>
        </div>
    </div>`).join('');

    // تنبيه العقود المنتهية قريباً
    let banner = document.getElementById('rentalAlertBanner');
    if (banner) {
        let expList = rents.filter(r => r.status === 'نشط' && r.endDate && r.endDate >= today && daysUntil(r.endDate) <= 7);
        if (expList.length > 0) {
            banner.style.display = '';
            banner.innerHTML = `<div class="alert alert-warning fw-bold mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-exclamation-triangle-fill fs-4"></i>
                <span>${L('تنبيه:','Warning:')} ${expList.length} ${L('عقد إيجار ينتهي خلال 7 أيام','rental contract(s) expiring within 7 days')} — ${expList.map(r => r.renterName + ' (' + r.endDate + ')').join('، ')}</span>
            </div>`;
        } else { banner.style.display = 'none'; }
    }
}

function renderRentalsTable() {
    let tbody = document.getElementById('rentalTableBody'); if (!tbody) return;
    let rents = Object.values(window.allCarRentals || {});
    let q     = (document.getElementById('searchInputRental') || {}).value || '';
    let sf    = (document.getElementById('rentalStatusFilter') || {}).value || '';
    if (q)  rents = rents.filter(r => [r.renterName, r.renterId, r.carPlate, r.phone].join(' ').toLowerCase().includes(q.toLowerCase()));
    if (sf) rents = rents.filter(r => r.status === sf);
    rents.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

    if (!rents.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-muted py-5 text-center fw-bold">${L('لا توجد عقود إيجار مسجلة.','No rental contracts found.')}</td></tr>`;
        return;
    }
    let today = getTodayStr();
    tbody.innerHTML = rents.map(r => {
        let statusBadge = r.status === 'نشط'
            ? `<span class="badge bg-success">🟢 ${L('نشط','Active')}</span>`
            : r.status === 'ملغي'
                ? `<span class="badge bg-danger">🔴 ${L('ملغي','Cancelled')}</span>`
                : `<span class="badge bg-secondary">⚫ ${L('منتهي','Ended')}</span>`;
        let days = r.startDate && r.endDate ? Math.max(0, Math.ceil((new Date(r.endDate) - new Date(r.startDate)) / 86400000)) : '—';
        let remaining = (r.status === 'نشط' && r.endDate) ? Math.max(0, daysUntil(r.endDate)) : null;
        let remainingBadge = remaining !== null
            ? `<br><span class="badge ${remaining <= 3 ? 'bg-danger' : remaining <= 7 ? 'bg-warning text-dark' : 'bg-info text-dark'} mt-1">${remaining} ${L('يوم متبقي','days left')}</span>`
            : '';
        let paid    = Number(r.paidAmount || 0);
        let total   = Number(r.totalAmount || 0);
        let balance = total - paid;
        return `<tr>
            <td class="fw-bold text-start">
                <div>${escHtml(r.renterName || '—')}</div>
                <div class="text-muted small" dir="ltr">${r.renterId || ''}</div>
                <div class="text-muted small">${r.phone || ''}</div>
            </td>
            <td><span class="fw-bold" dir="ltr">${r.carPlate || '—'}</span><br>${r.source === 'office' ? `<span class="badge bg-warning text-dark mt-1">🔑 ${L('مكتب إيجار','Rental office')}${r.rentalOffice ? ' — ' + escHtml(r.rentalOffice) : ''}</span>` : `<span class="badge bg-info text-dark mt-1">🏢 ${L('سيارة الشركة','Company car')}</span>`}</td>
            <td>
                <div dir="ltr" class="small fw-bold">${r.startDate || '—'} → ${r.endDate || '—'}</div>
                <div class="text-muted small">${days} ${L('يوم','day(s)')}${remainingBadge}</div>
            </td>
            <td class="fw-bold">${Number(r.dailyRate || 0).toLocaleString()} ${L('ر.س','SAR')}</td>
            <td class="fw-bold text-primary">${total.toLocaleString()} ${L('ر.س','SAR')}</td>
            <td>
                <div class="text-success fw-bold">${paid.toLocaleString()} ${L('ر.س','SAR')}</div>
                ${balance > 0 ? `<div class="text-danger small">${L('متبقي:','Bal:')} ${balance.toLocaleString()}</div>` : ''}
            </td>
            <td>
                <div>${Number(r.deposit || 0).toLocaleString()} ${L('ر.س','SAR')}</div>
                ${r.depositReturned ? `<span class="badge bg-success small">${L('مُستردة','Returned')}</span>` : `<span class="badge bg-secondary small">${L('محتجزة','Held')}</span>`}
            </td>
            <td>${statusBadge}</td>
            <td>
                <div class="d-flex justify-content-center gap-1">
                    <button onclick="openRentalModal('${r.rentalId}')" class="btn btn-warning btn-sm text-dark"><i class="bi bi-pencil-fill"></i></button>
                    <button onclick="deleteRental('${r.rentalId}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function openRentalModal(id) {
    let r = id ? (window.allCarRentals[id] || {}) : {};
    document.getElementById('rentalId').value          = id || '';
    document.getElementById('rentalRenterName').value  = r.renterName || '';
    document.getElementById('rentalRenterId').value    = r.renterId || '';
    document.getElementById('rentalPhone').value       = r.phone || '';
    document.getElementById('rentalStartDate').value   = r.startDate || getTodayStr();
    document.getElementById('rentalEndDate').value     = r.endDate || '';
    document.getElementById('rentalDailyRate').value   = r.dailyRate || '';
    document.getElementById('rentalDeposit').value     = r.deposit || '';
    document.getElementById('rentalTotalAmount').value = r.totalAmount || '';
    document.getElementById('rentalPaidAmount').value  = r.paidAmount || '';
    document.getElementById('rentalStatus').value      = r.status || 'نشط';
    document.getElementById('rentalDepositReturned').checked = r.depositReturned || false;
    document.getElementById('rentalNotes').value       = r.notes || '';
    document.getElementById('rentalCarPlate').value    = r.carPlate || '';
    document.getElementById('rentalSource').value      = r.source || 'company';
    document.getElementById('rentalOffice').value      = r.rentalOffice || '';

    // تعبئة قائمة السيارات
    let carSel = document.getElementById('rentalCarId');
    carSel.innerHTML = '<option value="">— اختر السيارة —</option>';
    (window.allCars || []).forEach(c => {
        let opt = document.createElement('option');
        opt.value = c.id || c.plateNumber;
        opt.textContent = `${c.plate || c.plateNumber} — ${c.type || ''} ${c.modelYear || ''}`.trim();
        opt.dataset.plate = c.plate || c.plateNumber || '';
        if ((c.id || c.plateNumber) === r.carId) opt.selected = true;
        carSel.appendChild(opt);
    });
    onRentalSourceChange(); // [RENTAL] إظهار/إخفاء حقول المصدر حسب النوع
    new bootstrap.Modal(document.getElementById('rentalModal')).show();
}

// [RENTAL] التبديل بين سيارة الشركة (من الأسطول) وسيارة مكتب الإيجار (لوحة يدوية)
function onRentalSourceChange() {
    const isOffice = document.getElementById('rentalSource').value === 'office';
    document.getElementById('rentalOfficeWrap').style.display     = isOffice ? '' : 'none';
    document.getElementById('rentalCompanyCarWrap').style.display = isOffice ? 'none' : '';
    const plate = document.getElementById('rentalCarPlate');
    plate.readOnly = !isOffice;
    plate.style.background = isOffice ? '#fff' : '#f8fafc';
    plate.placeholder = isOffice ? L('أدخل لوحة السيارة', 'Enter plate number') : L('تُملأ تلقائياً', 'Auto-filled');
    if (isOffice) { const cs = document.getElementById('rentalCarId'); if (cs) cs.value = ''; }
    else { fillRentalCarPlate(); }
}

function fillRentalCarPlate() {
    let sel = document.getElementById('rentalCarId');
    let opt = sel.selectedOptions[0];
    document.getElementById('rentalCarPlate').value = opt ? (opt.dataset.plate || '') : '';
    calcRentalTotal();
}

function calcRentalTotal() {
    let start = document.getElementById('rentalStartDate').value;
    let end   = document.getElementById('rentalEndDate').value;
    let daily = parseFloat(document.getElementById('rentalDailyRate').value) || 0;
    if (start && end && daily > 0) {
        let days = Math.max(0, Math.ceil((new Date(end) - new Date(start)) / 86400000));
        document.getElementById('rentalTotalAmount').value = (days * daily).toFixed(0);
    }
}

function saveRental() {
    if (!hasPerm('cars')) return alert('❌ ليس لديك صلاحية. تواصل مع الأدمن.');
    let id = document.getElementById('rentalId').value || ('RENT_' + Date.now());
    let carSel  = document.getElementById('rentalCarId');
    let carOpt  = carSel.selectedOptions[0];
    let source  = document.getElementById('rentalSource').value;
    let isOffice = source === 'office';
    let officeName = document.getElementById('rentalOffice').value.trim();
    let manualPlate = document.getElementById('rentalCarPlate').value.trim();
    let renterName = document.getElementById('rentalRenterName').value.trim();
    let startDate  = document.getElementById('rentalStartDate').value;
    let endDate    = document.getElementById('rentalEndDate').value;
    if (!renterName) return alert(L('الرجاء إدخال اسم المستأجر', 'Please enter renter name'));
    if (isOffice) {
        if (!manualPlate) return alert(L('الرجاء إدخال لوحة سيارة مكتب الإيجار', 'Please enter the rental-office car plate'));
        if (!officeName)  return alert(L('الرجاء إدخال اسم مكتب الإيجار', 'Please enter the rental office name'));
    } else if (!carSel.value) {
        return alert(L('الرجاء اختيار السيارة', 'Please select a vehicle'));
    }
    if (!startDate || !endDate) return alert(L('الرجاء تحديد تاريخ البداية والنهاية', 'Please set start and end dates'));
    if (endDate <= startDate) return alert(L('تاريخ النهاية يجب أن يكون بعد البداية', 'End date must be after start date'));

    let data = {
        rentalId: id,
        source:   source,
        rentalOffice: isOffice ? officeName : '',
        carId:    isOffice ? '' : carSel.value,
        carPlate: isOffice ? manualPlate : (carOpt ? (carOpt.dataset.plate || carOpt.textContent.split(' — ')[0]) : ''),
        renterName,
        renterId:  document.getElementById('rentalRenterId').value.trim(),
        phone:     document.getElementById('rentalPhone').value.trim(),
        startDate,
        endDate,
        dailyRate:       parseFloat(document.getElementById('rentalDailyRate').value) || 0,
        deposit:         parseFloat(document.getElementById('rentalDeposit').value) || 0,
        totalAmount:     parseFloat(document.getElementById('rentalTotalAmount').value) || 0,
        paidAmount:      parseFloat(document.getElementById('rentalPaidAmount').value) || 0,
        status:          document.getElementById('rentalStatus').value,
        depositReturned: document.getElementById('rentalDepositReturned').checked,
        notes:           document.getElementById('rentalNotes').value.trim(),
        updatedAt:       new Date().toISOString(),
        updatedBy:       window.loggedInUser || 'admin'
    };
    database.ref('ninja_data/car_rentals/' + id).set(data).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('rentalModal')).hide();
        logAudit('عقد إيجار', id, `${renterName} — ${data.carPlate} — ${startDate} إلى ${endDate}`);
    });
}

async function deleteRental(id) {
    if (!hasPerm('cars')) return alert('❌ ليس لديك صلاحية. تواصل مع الأدمن.');
    let r = window.allCarRentals[id] || {};
    let _ok = await swalConfirm(L(`حذف عقد إيجار "${r.renterName || id}"؟`, `Delete rental contract for "${r.renterName || id}"?`), { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('car_rentals', id, 'ninja_data/car_rentals/' + id, 'إيجار: ' + (r.renterName || id) + ' — ' + (r.carPlate || ''));
}

function exportRentals() {
    let rents = Object.values(window.allCarRentals || {});
    if (!rents.length) return alert(L('لا توجد عقود إيجار للتصدير.', 'No rental contracts to export.'));
    let data = rents.map(r => ({
        [L('المستأجر','Renter')]: r.renterName, [L('الهوية','ID')]: r.renterId, [L('الجوال','Phone')]: r.phone,
        [L('السيارة','Vehicle')]: r.carPlate, [L('المصدر','Source')]: r.source === 'office' ? L('مكتب إيجار','Rental office') : L('سيارة الشركة','Company car'), [L('مكتب الإيجار','Rental Office')]: r.rentalOffice || '', [L('البداية','Start')]: r.startDate, [L('النهاية','End')]: r.endDate,
        [L('اليومي (ر.س)','Daily Rate')]: r.dailyRate, [L('الإجمالي (ر.س)','Total')]: r.totalAmount,
        [L('المدفوع (ر.س)','Paid')]: r.paidAmount, [L('المتبقي (ر.س)','Balance')]: Math.max(0, Number(r.totalAmount||0) - Number(r.paidAmount||0)),
        [L('الوديعة (ر.س)','Deposit')]: r.deposit, [L('الوديعة مُستردة','Deposit Returned')]: r.depositReturned ? L('نعم','Yes') : L('لا','No'),
        [L('الحالة','Status')]: r.status, [L('ملاحظات','Notes')]: r.notes
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, L('الإيجار','Rentals'));
    XLSX.writeFile(wb, `CAR_RENTALS_${getTodayStr()}.xlsx`);
    logAudit('تصدير عقود الإيجار', 'Excel', `تم تصدير ${rents.length} عقد`);
}

function exportHandovers() {
    let list = Object.values(window.allHandovers || {});
    if (!list.length) return alert('لا توجد بيانات للتصدير');
    let data = list.map(h => ({
        'النوع': h.type, 'التاريخ': h.date, 'الوقت': h.time,
        'لوحة السيارة': h.plate, 'نوع السيارة': h.carLabel,
        'المستلم/المسلّم': h.personName, 'المشرف الميداني': h.supervisor,
        'الكيلومترات': h.km, 'مستوى الوقود': h.fuel,
        'حالة السيارة': h.condition, 'ملاحظات': h.notes,
        'عدد الصور': (h.photos || []).length,
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Handovers');
    XLSX.writeFile(wb, `CAR_HANDOVERS_${getTodayStr()}.xlsx`);
}

// ─── قسم السكن (Housing) ─────────────────────────────────────────────────────

window.allHousingUnits       = {};
window.allHousingResidents   = {};
window.allHousingPayments    = {};
window.allWarehouseItems     = {};
window.allCarRentals         = {};
window.allWarehouseTx        = {};
window.allHousingMaintenance = {};

function _loadHousingData() {
    database.ref('ninja_data/housing_units').on('value', snap => {
        window.allHousingUnits = snap.val() || {};
        if (currentPlatformTab === 'housing') { renderHousingUnitsKpis(); renderHousingUnitsTable(); }
    });
    database.ref('ninja_data/housing_residents').on('value', snap => {
        window.allHousingResidents = snap.val() || {};
        if (currentPlatformTab === 'housing') renderHousingResidents();
        if (currentPlatformTab === 'home') { renderHomeSectionCards(); renderHomeAlerts(); }
    });
    database.ref('ninja_data/housing_payments').on('value', snap => {
        window.allHousingPayments = snap.val() || {};
        if (currentPlatformTab === 'housing') renderHousingPayments();
        if (currentPlatformTab === 'home') renderHomeAlerts();
    });
    database.ref('ninja_data/warehouse').on('value', snap => {
        window.allWarehouseItems = snap.val() || {};
        if (currentPlatformTab === 'housing') renderWarehouse();
    });
    database.ref('ninja_data/warehouse_transactions').on('value', snap => {
        window.allWarehouseTx = snap.val() || {};
        if (currentPlatformTab === 'housing') renderWarehouse();
    });
    database.ref('ninja_data/housing_maintenance').on('value', snap => {
        window.allHousingMaintenance = snap.val() || {};
        if (currentPlatformTab === 'housing') renderMaintenanceTable();
        if (currentPlatformTab === 'home') renderHomeAlerts();
    });
}

// ── التنقل بين التابات ────────────────────────────────────────────────────────
function switchHousingTab(tab) {
    let tabs = ['units','residents','payments','alerts','warehouse','maintenance'];
    tabs.forEach(t => {
        let view = document.getElementById('housingView_' + t);
        let btn  = document.getElementById('housingTab_' + t);
        let act  = document.getElementById('housingActions_' + t);
        if (view) view.style.display = t === tab ? '' : 'none';
        if (btn)  btn.classList.toggle('active-housing-tab', t === tab);
        if (act)  {
            if (t === tab) act.style.removeProperty('display');
            else act.style.display = 'none';
        }
    });
    // الإجراء الافتراضي لكل تاب
    if (tab === 'units')       { renderHousingUnitsKpis(); renderHousingUnitsTable(); }
    if (tab === 'residents')   renderHousingResidents();
    if (tab === 'payments')    renderHousingPayments();
    if (tab === 'alerts')      renderHousingAlerts();
    if (tab === 'warehouse')   { renderWarehouse(); updateWarehouseExportCounts(); }
    if (tab === 'maintenance') { renderMaintenanceKpis(); renderMaintenanceTable(); }
    updateHousingExportMenu(tab);
}

function updateHousingExportMenu(activeTab) {
    function setCount(id, count, suffix) {
        let el = document.getElementById(id);
        if (el) el.textContent = count > 0 ? `${count} ${suffix}` : 'لا يوجد بيانات';
    }
    setCount('exportUnitsCount',       Object.values(window.allHousingUnits       || {}).length, 'وحدة مسجلة');
    setCount('exportResidentsCount',   Object.values(window.allHousingResidents   || {}).length, 'ساكن مسجل');
    setCount('exportPaymentsCount',    Object.values(window.allHousingPayments    || {}).length, 'دفعة مسجلة');
    setCount('exportWarehouseCount',   Object.values(window.allWarehouseItems     || {}).length, 'صنف مسجل');
    setCount('exportMaintenanceCount', Object.values(window.allHousingMaintenance || {}).length, 'طلب صيانة');

    let tabToItem = { units:'exportItemUnits', residents:'exportItemResidents', payments:'exportItemPayments', warehouse:'exportItemWarehouse', maintenance:'exportItemMaintenance' };
    Object.entries(tabToItem).forEach(([t, itemId]) => {
        let el = document.getElementById(itemId);
        if (el) el.classList.toggle('active-export', t === activeTab);
    });

    let wrap = document.getElementById('housingExportDropdownWrap');
    if (wrap) wrap.style.display = activeTab === 'alerts' ? 'none' : '';
}

function exportAllHousing() {
    const wb = XLSX.utils.book_new();
    const units       = Object.values(window.allHousingUnits       || {});
    const residents   = Object.values(window.allHousingResidents   || {});
    const payments    = Object.values(window.allHousingPayments    || {});
    const warehouse   = Object.values(window.allWarehouseItems     || {});
    const maintenance = Object.values(window.allHousingMaintenance || {});
    if (units.length)       XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(units),       'الوحدات');
    if (residents.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(residents),   'الساكنين');
    if (payments.length)    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payments),    'الإيجارات');
    if (warehouse.length)   XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(warehouse),   'المستودع');
    if (maintenance.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(maintenance), 'الصيانة');
    if (!wb.SheetNames.length) return alert('لا توجد بيانات للتصدير');
    XLSX.writeFile(wb, `HOUSING_FULL_${getTodayStr()}.xlsx`);
    logAudit('تصدير السكن الكامل', 'Excel', 'تم تصدير جميع بيانات قسم السكن في ملف واحد');
}

// ── KPIs الوحدات ─────────────────────────────────────────────────────────────
function renderHousingUnitsKpis() {
    let row = document.getElementById('housingKpiRow'); if (!row) return;
    let units = Object.values(window.allHousingUnits);
    let occupied = units.filter(u => u.status === 'مشغولة').length;
    let vacant   = units.filter(u => u.status === 'شاغرة').length;
    let maint    = units.filter(u => u.status === 'صيانة').length;
    let totalRent = units.reduce((s, u) => s + Number(u.monthlyRent || 0), 0);
    let residents = Object.values(window.allHousingResidents).filter(r => r.status === 'مقيم').length;
    let kpis = [
        { label:'إجمالي الوحدات',   value: units.length,                          icon:'🏠', color:'#b45309' },
        { label:'مشغولة',           value: occupied,                               icon:'🟢', color:'#10b981' },
        { label:'شاغرة',            value: vacant,                                 icon:'⚪', color:'#6b7280' },
        { label:'صيانة',            value: maint,                                  icon:'🟡', color:'#f59e0b' },
        { label:'الساكنين الحاليين',value: residents,                              icon:'👥', color:'#3b82f6' },
        { label:'إجمالي الإيجار',   value: totalRent.toLocaleString() + ' ر.س',   icon:'💰', color:'#7c3aed' },
    ];
    row.innerHTML = kpis.map(k => `
        <div class="col-6 col-md-2">
            <div class="card-custom p-3 text-center" style="border-top:4px solid ${k.color};">
                <div class="fs-3 mb-1">${k.icon}</div>
                <div class="fw-bold fs-5" style="color:${k.color};">${k.value}</div>
                <div class="text-muted fw-bold small">${k.label}</div>
            </div>
        </div>`).join('');
}

// ── جدول الوحدات ─────────────────────────────────────────────────────────────
function renderHousingUnitsTable() {
    let tbody = document.getElementById('housingUnitsBody'); if (!tbody) return;
    let units = Object.values(window.allHousingUnits);
    let sf = (document.getElementById('housingStatusFilter') || {}).value || '';
    if (sf) units = units.filter(u => u.status === sf);
    if (!units.length) { tbody.innerHTML = `<tr><td colspan="10" class="text-muted py-5 text-center fw-bold">لا توجد وحدات. اضغط "إضافة وحدة".</td></tr>`; return; }
    let statusBadge = s => s === 'مشغولة' ? `<span class="badge bg-success">🟢 مشغولة</span>` : s === 'شاغرة' ? `<span class="badge bg-secondary">⚪ شاغرة</span>` : `<span class="badge bg-warning text-dark">🟡 صيانة</span>`;
    let expCell = d => { if(!d) return '<span class="text-muted">—</span>'; let days=daysUntil(d); let cls=days<0?'text-danger fw-bold':days<=30?'text-warning fw-bold':'text-muted'; return `<span class="${cls}" dir="ltr">${d}${days<=30?`<br><small>(${days<0?'منتهي':days+' يوم'})</small>`:''}</span>`; };
    tbody.innerHTML = units.map(u => {
        let res = Object.values(window.allHousingResidents).filter(r => r.unitId === u.unitId && r.status === 'مقيم');
        let resNames = res.map(r => { let acc = (window.allRawAccounts||[]).find(a=>a&&String(a.id)===String(r.accountId)); return acc ? acc.ownerName : r.accountId; }).join('، ') || '—';
        let rowCls = u.contractEnd && daysUntil(u.contractEnd) < 0 ? 'table-danger' : (u.contractEnd && daysUntil(u.contractEnd) <= 30 ? 'table-warning' : '');
        return `<tr class="${rowCls}">
            <td><b class="fs-6">${u.complexName||'—'}</b><br><small class="text-muted">${u.unitNumber||''}</small></td>
            <td>${u.district||'—'}</td>
            <td><span class="badge bg-info">${u.rooms||0} غرف</span><br><small class="text-muted">سعة: ${u.capacity||0}</small></td>
            <td><b class="text-success">${Number(u.monthlyRent||0).toLocaleString()}</b> ر.س</td>
            <td dir="ltr" class="text-muted small">${u.contractStart||'—'}</td>
            <td>${expCell(u.contractEnd)}</td>
            <td>${escHtml(u.ownerName||'—')}<br><small dir="ltr" class="text-muted">${u.ownerPhone||''}</small></td>
            <td>${statusBadge(u.status)}</td>
            <td class="small">${resNames}</td>
            <td><button onclick="openHousingUnitModal('${u.unitId}')" class="btn btn-warning btn-sm text-dark me-1"><i class="bi bi-pencil-fill"></i></button><button onclick="deleteHousingUnit('${u.unitId}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button></td>
        </tr>`;
    }).join('');
}

// ── CRUD الوحدات ─────────────────────────────────────────────────────────────
function openHousingUnitModal(id) {
    let u = id ? (window.allHousingUnits[id] || {}) : {};
    document.getElementById('huUnitId').value       = id || '';
    document.getElementById('huComplex').value       = u.complexName   || '';
    document.getElementById('huUnitNum').value       = u.unitNumber    || '';
    document.getElementById('huDistrict').value      = u.district      || '';
    document.getElementById('huRooms').value         = u.rooms         || 1;
    document.getElementById('huCapacity').value      = u.capacity      || 4;
    document.getElementById('huRent').value          = u.monthlyRent   || '';
    document.getElementById('huContractStart').value = u.contractStart || '';
    document.getElementById('huContractEnd').value   = u.contractEnd   || '';
    document.getElementById('huOwnerName').value     = u.ownerName     || '';
    document.getElementById('huOwnerPhone').value    = u.ownerPhone    || '';
    document.getElementById('huStatus').value        = u.status        || 'شاغرة';
    document.getElementById('huNotes').value         = u.notes         || '';
    new bootstrap.Modal(document.getElementById('housingUnitModal')).show();
}

function saveHousingUnit() {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية. تواصل مع الأدمن.');
    let id = document.getElementById('huUnitId').value || ('UNIT_' + Date.now());
    let data = {
        unitId: id,
        complexName:   document.getElementById('huComplex').value.trim(),
        unitNumber:    document.getElementById('huUnitNum').value.trim(),
        district:      document.getElementById('huDistrict').value.trim(),
        rooms:         Number(document.getElementById('huRooms').value) || 1,
        capacity:      Number(document.getElementById('huCapacity').value) || 4,
        monthlyRent:   Number(document.getElementById('huRent').value) || 0,
        contractStart: document.getElementById('huContractStart').value,
        contractEnd:   document.getElementById('huContractEnd').value,
        ownerName:     document.getElementById('huOwnerName').value.trim(),
        ownerPhone:    document.getElementById('huOwnerPhone').value.trim(),
        status:        document.getElementById('huStatus').value,
        notes:         document.getElementById('huNotes').value.trim(),
    };
    if (!data.complexName) return alert('الرجاء إدخال اسم المجمع');
    database.ref('ninja_data/housing_units/' + id).set(data).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('housingUnitModal')).hide();
        logAudit('وحدة سكنية', id, `${data.complexName} ${data.unitNumber}`);
        alert('✅ تم حفظ الوحدة بنجاح');
    });
}

async function deleteHousingUnit(id) {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية.');
    let u = window.allHousingUnits[id];
    let _ok = await swalConfirm(`حذف وحدة "${u ? u.complexName + ' ' + u.unitNumber : id}"؟`, { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('housing_units', id, 'ninja_data/housing_units/' + id, 'وحدة: ' + (u ? u.complexName + ' ' + u.unitNumber : id));
}

function exportHousingUnits() {
    let units = Object.values(window.allHousingUnits);
    if (!units.length) return alert('لا توجد بيانات للتصدير');
    let data = units.map(u => ({ 'المجمع': u.complexName, 'الوحدة': u.unitNumber, 'الحي': u.district, 'الغرف': u.rooms, 'الطاقة': u.capacity, 'الإيجار': u.monthlyRent, 'بداية العقد': u.contractStart, 'انتهاء العقد': u.contractEnd, 'المالك': u.ownerName, 'جوال المالك': u.ownerPhone, 'الحالة': u.status, 'ملاحظات': u.notes }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HousingUnits'); XLSX.writeFile(wb, `HOUSING_${getTodayStr()}.xlsx`);
}

function exportHousingResidents() {
    let res = Object.values(window.allHousingResidents);
    if (!res.length) return alert('لا توجد بيانات للتصدير');
    let data = res.map(r => {
        let acc = (window.allRawAccounts||[]).find(a=>a&&String(a.id)===String(r.accountId));
        let unit = window.allHousingUnits[r.unitId];
        return { 'المندوب': acc?acc.ownerName:r.accountId, 'الوحدة': unit?unit.complexName+' — '+unit.unitNumber:r.unitId, 'تاريخ الدخول': r.moveInDate||'', 'تاريخ الخروج': r.moveOutDate||'', 'الخصم الشهري': r.monthlyDeduction||0, 'الحالة': r.status||'' };
    });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Residents'); XLSX.writeFile(wb, `RESIDENTS_${getTodayStr()}.xlsx`);
}

// ── CRUD الساكنين ─────────────────────────────────────────────────────────────
function renderHousingResidents() {
    let tbody = document.getElementById('housingResidentsBody'); if (!tbody) return;
    let res = Object.values(window.allHousingResidents);
    let sf = (document.getElementById('residentStatusFilter') || {}).value || '';
    if (sf) res = res.filter(r => r.status === sf);
    if (!res.length) { tbody.innerHTML = `<tr><td colspan="7" class="text-muted py-5 text-center fw-bold">لا يوجد ساكنين مسجلين.</td></tr>`; return; }
    tbody.innerHTML = res.map(r => {
        let acc = (window.allRawAccounts||[]).find(a=>a&&String(a.id)===String(r.accountId));
        let unit = window.allHousingUnits[r.unitId];
        let statusBadge = r.status === 'مقيم' ? `<span class="badge bg-success">🟢 مقيم</span>` : `<span class="badge bg-danger">🔴 غادر</span>`;
        return `<tr>
            <td class="fw-bold">${escHtml(acc ? acc.ownerName : r.accountId)}</td>
            <td>${unit ? unit.complexName + ' — ' + unit.unitNumber : r.unitId}</td>
            <td dir="ltr">${r.moveInDate||'—'}</td>
            <td dir="ltr">${r.moveOutDate||'—'}</td>
            <td><b class="text-primary">${Number(r.monthlyDeduction||0).toLocaleString()}</b> ر.س</td>
            <td>${statusBadge}</td>
            <td><button onclick="openHousingResidentModal('${r.residentId}')" class="btn btn-warning btn-sm text-dark me-1"><i class="bi bi-pencil-fill"></i></button><button onclick="deleteHousingResident('${r.residentId}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button></td>
        </tr>`;
    }).join('');
}

function openHousingResidentModal(id) {
    let r = id ? (window.allHousingResidents[id] || {}) : {};
    document.getElementById('hrResidentId').value     = id || '';
    document.getElementById('hrMoveIn').value          = r.moveInDate    || getTodayStr();
    document.getElementById('hrMoveOut').value         = r.moveOutDate   || '';
    document.getElementById('hrDeduction').value       = r.monthlyDeduction || 0;
    document.getElementById('hrResidentStatus').value  = r.status        || 'مقيم';
    // تعبئة قوائم الحسابات والوحدات
    let accSel = document.getElementById('hrResidentAccount');
    accSel.innerHTML = '<option value="">— اختر مندوب —</option>';
    (window.allRawAccounts||[]).forEach(acc => { if(!acc) return; let o = document.createElement('option'); o.value=acc.id; o.textContent=`${acc.ownerName||acc.id} (${acc.platform||''})`; if(String(acc.id)===String(r.accountId||'')) o.selected=true; accSel.appendChild(o); });
    let unitSel = document.getElementById('hrResidentUnit');
    unitSel.innerHTML = '<option value="">— اختر وحدة —</option>';
    Object.values(window.allHousingUnits).forEach(u => { let o = document.createElement('option'); o.value=u.unitId; o.textContent=`${u.complexName} — ${u.unitNumber}`; if(u.unitId===r.unitId) o.selected=true; unitSel.appendChild(o); });
    new bootstrap.Modal(document.getElementById('housingResidentModal')).show();
}

function saveHousingResident() {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية.');
    let id = document.getElementById('hrResidentId').value || ('RES_' + Date.now());
    let data = { residentId: id, accountId: document.getElementById('hrResidentAccount').value, unitId: document.getElementById('hrResidentUnit').value, moveInDate: document.getElementById('hrMoveIn').value, moveOutDate: document.getElementById('hrMoveOut').value, monthlyDeduction: Number(document.getElementById('hrDeduction').value)||0, status: document.getElementById('hrResidentStatus').value };
    if (!data.accountId) return alert('الرجاء اختيار مندوب');
    if (!data.unitId)    return alert('الرجاء اختيار وحدة');
    database.ref('ninja_data/housing_residents/' + id).set(data).then(() => { bootstrap.Modal.getInstance(document.getElementById('housingResidentModal')).hide(); alert('✅ تم حفظ الساكن'); });
}

async function deleteHousingResident(id) {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية.');
    let r = (window.allHousingResidents || {})[id] || {};
    let _ok = await swalConfirm('حذف هذا الساكن؟', { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('housing_residents', id, 'ninja_data/housing_residents/' + id, 'ساكن: ' + (r.accountId || id));
}

// ── CRUD الإيجارات ────────────────────────────────────────────────────────────
function renderHousingPayments() {
    let tbody = document.getElementById('paymentsBody'); if (!tbody) return;
    let pays = Object.values(window.allHousingPayments);
    let sf = (document.getElementById('paymentStatusFilter') || {}).value || '';
    if (sf) pays = pays.filter(p => p.status === sf);
    pays.sort((a,b)=>(b.month||'').localeCompare(a.month||''));
    // KPIs
    let kpiRow = document.getElementById('paymentsKpiRow');
    if (kpiRow) {
        let all = Object.values(window.allHousingPayments);
        let done = all.filter(p=>p.status==='تم').length, late = all.filter(p=>p.status==='متأخر').length, pend = all.filter(p=>p.status==='لم يتم').length;
        let totalPaid = all.filter(p=>p.status==='تم').reduce((s,p)=>s+Number(p.amount||0),0);
        kpiRow.innerHTML = [
            {label:'تم الدفع',value:done,icon:'✅',color:'#10b981'},{label:'متأخر',value:late,icon:'⚠️',color:'#f59e0b'},{label:'لم يتم',value:pend,icon:'❌',color:'#ef4444'},{label:'إجمالي المحصّل',value:totalPaid.toLocaleString()+' ر.س',icon:'💰',color:'#3b82f6'}
        ].map(k=>`<div class="col-6 col-md-3"><div class="card-custom p-3 text-center" style="border-top:4px solid ${k.color};"><div class="fs-3">${k.icon}</div><div class="fw-bold fs-5" style="color:${k.color};">${k.value}</div><div class="text-muted fw-bold small">${k.label}</div></div></div>`).join('');
    }
    if (!pays.length) { tbody.innerHTML = `<tr><td colspan="7" class="text-muted py-5 text-center fw-bold">لا توجد دفعات مسجلة.</td></tr>`; return; }
    let sb = s => s==='تم'?`<span class="badge bg-success">✅ تم</span>`:s==='متأخر'?`<span class="badge bg-warning text-dark">⚠️ متأخر</span>`:`<span class="badge bg-danger">❌ لم يتم</span>`;
    tbody.innerHTML = pays.map(p => {
        let unit = window.allHousingUnits[p.unitId];
        return `<tr>
            <td>${unit ? unit.complexName+' — '+unit.unitNumber : p.unitId}</td>
            <td dir="ltr" class="fw-bold">${p.month||'—'}</td>
            <td><b class="text-success">${Number(p.amount||0).toLocaleString()}</b> ر.س</td>
            <td dir="ltr">${p.paymentDate||'—'}</td>
            <td>${sb(p.status)}</td>
            <td class="text-muted small">${escHtml(p.notes||'—')}</td>
            <td><button onclick="openHousingPaymentModal('${p.paymentId}')" class="btn btn-warning btn-sm text-dark me-1"><i class="bi bi-pencil-fill"></i></button><button onclick="deleteHousingPayment('${p.paymentId}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button></td>
        </tr>`;
    }).join('');
}

function openHousingPaymentModal(id) {
    let p = id ? (window.allHousingPayments[id] || {}) : {};
    document.getElementById('hpPaymentId').value = id || '';
    document.getElementById('hpMonth').value      = p.month       || '';
    document.getElementById('hpAmount').value     = p.amount      || '';
    document.getElementById('hpDate').value       = p.paymentDate || getTodayStr();
    document.getElementById('hpStatus').value     = p.status      || 'تم';
    document.getElementById('hpNotes').value      = p.notes       || '';
    let sel = document.getElementById('hpUnit');
    sel.innerHTML = '<option value="">— اختر وحدة —</option>';
    Object.values(window.allHousingUnits).forEach(u => { let o = document.createElement('option'); o.value=u.unitId; o.textContent=`${u.complexName} — ${u.unitNumber}`; if(u.unitId===p.unitId) o.selected=true; sel.appendChild(o); });
    new bootstrap.Modal(document.getElementById('housingPaymentModal')).show();
}

function saveHousingPayment() {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية.');
    let id = document.getElementById('hpPaymentId').value || ('PAY_' + Date.now());
    let data = { paymentId: id, unitId: document.getElementById('hpUnit').value, month: document.getElementById('hpMonth').value, amount: Number(document.getElementById('hpAmount').value)||0, paymentDate: document.getElementById('hpDate').value, status: document.getElementById('hpStatus').value, notes: document.getElementById('hpNotes').value.trim() };
    if (!data.unitId) return alert('الرجاء اختيار وحدة');
    if (!data.month)  return alert('الرجاء تحديد الشهر');
    database.ref('ninja_data/housing_payments/' + id).set(data).then(() => { bootstrap.Modal.getInstance(document.getElementById('housingPaymentModal')).hide(); alert('✅ تم تسجيل الدفعة'); });
}

async function deleteHousingPayment(id) {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية.');
    let p = (window.allHousingPayments || {})[id] || {};
    let _ok = await swalConfirm('حذف هذه الدفعة؟', { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('housing_payments', id, 'ninja_data/housing_payments/' + id, 'دفعة: ' + (p.month || '') + ' — ' + (p.amount ? p.amount + ' ر.س' : id));
}

function exportHousingPayments() {
    let pays = Object.values(window.allHousingPayments);
    if (!pays.length) return alert('لا توجد بيانات');
    let data = pays.map(p => { let u = window.allHousingUnits[p.unitId]; return { 'الوحدة': u ? u.complexName+' '+u.unitNumber : p.unitId, 'الشهر': p.month, 'المبلغ': p.amount, 'تاريخ الدفع': p.paymentDate, 'الحالة': p.status, 'ملاحظات': p.notes }; });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payments'); XLSX.writeFile(wb, `HOUSING_PAYMENTS_${getTodayStr()}.xlsx`);
}

// ── التنبيهات ─────────────────────────────────────────────────────────────────
function renderHousingAlerts() {
    let container = document.getElementById('housingAlertsContainer'); if (!container) return;
    let units = Object.values(window.allHousingUnits);
    let expiring = units.filter(u => u.contractEnd && daysUntil(u.contractEnd) !== null && daysUntil(u.contractEnd) <= 30);
    if (!expiring.length) { container.innerHTML = `<div class="text-center py-5 fs-5 fw-bold text-muted">✅ لا توجد عقود تنتهي قريباً</div>`; return; }
    expiring.sort((a,b) => daysUntil(a.contractEnd) - daysUntil(b.contractEnd));
    container.innerHTML = `<div class="row g-3">` + expiring.map(u => {
        let days = daysUntil(u.contractEnd);
        let color = days < 0 ? '#ef4444' : days <= 7 ? '#f97316' : '#f59e0b';
        let msg   = days < 0 ? `منتهي منذ ${Math.abs(days)} يوم` : days === 0 ? 'ينتهي اليوم!' : `ينتهي خلال ${days} يوم`;
        return `<div class="col-md-6 col-lg-4">
            <div class="card-custom p-4" style="border-right:5px solid ${color};">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div><h6 class="fw-bold mb-0">${u.complexName} — ${u.unitNumber}</h6><small class="text-muted">${u.district||''}</small></div>
                    <span class="badge fw-bold fs-7" style="background:${color};">${msg}</span>
                </div>
                <div class="d-flex justify-content-between text-muted small">
                    <span>📅 انتهاء العقد: <b dir="ltr">${u.contractEnd}</b></span>
                    <span>💰 ${Number(u.monthlyRent||0).toLocaleString()} ر.س/شهر</span>
                </div>
                <div class="mt-2 text-muted small">👤 المالك: <b>${escHtml(u.ownerName||'—')}</b> ${u.ownerPhone ? `<a href="tel:${u.ownerPhone}" class="ms-1 text-success"><i class="bi bi-telephone-fill"></i></a>` : ''}</div>
                <button onclick="openHousingUnitModal('${u.unitId}')" class="btn btn-sm fw-bold mt-3 w-100" style="background:${color};color:#fff;border-radius:10px;"><i class="bi bi-pencil-fill me-1"></i>تجديد العقد</button>
            </div>
        </div>`;
    }).join('') + `</div>`;
}

// ── الصيانة ──────────────────────────────────────────────────────────────────
const MAINT_CATEGORIES = { 'تكييف':'❄️','تبريد':'🧊','سباكة':'🚿','كهرباء':'⚡','أجهزة منزلية':'🖥️','أثاث':'🛋️','أبواب ونوافذ':'🚪','دهانات':'🖌️','أخرى':'🔩' };

function renderMaintenanceKpis() {
    let row = document.getElementById('maintKpiRow'); if (!row) return;
    let items = Object.values(window.allHousingMaintenance);
    let counts = {
        'جديد':        items.filter(m => m.status === 'جديد').length,
        'قيد الإصلاح': items.filter(m => m.status === 'قيد الإصلاح').length,
        'تم الإصلاح':  items.filter(m => m.status === 'تم الإصلاح').length,
        'مؤجل':        items.filter(m => m.status === 'مؤجل').length,
    };
    let totalCost = items.filter(m => m.status === 'تم الإصلاح').reduce((s, m) => s + Number(m.cost || 0), 0);
    let urgentOpen = items.filter(m => m.priority === 'عاجل' && m.status !== 'تم الإصلاح').length;
    let kpis = [
        { label:'جديد',          value: counts['جديد'],                         icon:'🆕', color:'#3b82f6' },
        { label:'قيد الإصلاح',   value: counts['قيد الإصلاح'],                  icon:'🔧', color:'#f59e0b' },
        { label:'تم الإصلاح',    value: counts['تم الإصلاح'],                   icon:'✅', color:'#10b981' },
        { label:'مؤجل',          value: counts['مؤجل'],                         icon:'⏸️', color:'#6b7280' },
        { label:'عاجل ومفتوح',   value: urgentOpen,                             icon:'🔴', color:'#ef4444' },
        { label:'إجمالي التكلفة',value: totalCost.toLocaleString() + ' ر.س',    icon:'💰', color:'#7c3aed' },
    ];
    row.innerHTML = kpis.map(k => `
        <div class="col-6 col-md-2">
            <div class="card-custom p-3 text-center" style="border-top:4px solid ${k.color};">
                <div class="fs-3 mb-1">${k.icon}</div>
                <div class="fw-bold fs-5" style="color:${k.color};">${k.value}</div>
                <div class="text-muted fw-bold small">${k.label}</div>
            </div>
        </div>`).join('');
}

function renderMaintenanceTable() {
    let tbody = document.getElementById('maintTableBody'); if (!tbody) return;
    renderMaintenanceKpis();
    let items = Object.values(window.allHousingMaintenance);
    let sf = (document.getElementById('maintStatusFilter')   || {}).value || '';
    let pf = (document.getElementById('maintPriorityFilter') || {}).value || '';
    if (sf) items = items.filter(m => m.status   === sf);
    if (pf) items = items.filter(m => m.priority === pf);
    items.sort((a, b) => {
        let pOrder = { 'عاجل': 0, 'متوسط': 1, 'عادي': 2 };
        return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3) || (b.reportDate || '').localeCompare(a.reportDate || '');
    });
    if (!items.length) { tbody.innerHTML = `<tr><td colspan="12" class="text-muted py-5 text-center fw-bold">لا توجد طلبات صيانة. اضغط "إضافة طلب صيانة".</td></tr>`; return; }

    let priorityBadge = p => p === 'عاجل'  ? `<span class="badge bg-danger">🔴 عاجل</span>`
                           : p === 'متوسط' ? `<span class="badge bg-warning text-dark">🟡 متوسط</span>`
                           :                  `<span class="badge bg-success">🟢 عادي</span>`;
    let statusBadge   = s => s === 'جديد'         ? `<span class="badge bg-primary">🆕 جديد</span>`
                           : s === 'قيد الإصلاح'  ? `<span class="badge bg-warning text-dark">🔧 قيد الإصلاح</span>`
                           : s === 'تم الإصلاح'   ? `<span class="badge bg-success">✅ تم</span>`
                           :                         `<span class="badge bg-secondary">⏸️ مؤجل</span>`;

    let counter = 0;
    tbody.innerHTML = items.map(m => {
        counter++;
        let unit = window.allHousingUnits[m.unitId];
        let unitName = unit ? `${unit.complexName} — ${unit.unitNumber}` : (m.unitId || '—');
        let catIcon  = MAINT_CATEGORIES[m.category] || '🔩';
        let rowCls   = (m.priority === 'عاجل' && m.status !== 'تم الإصلاح') ? 'table-danger' : '';
        return `<tr class="${rowCls}">
            <td class="fw-bold text-muted">${counter}</td>
            <td class="fw-bold small">${unitName}</td>
            <td><span class="fw-bold">${catIcon} ${m.category || '—'}</span></td>
            <td class="text-start" style="max-width:180px;"><span class="text-truncate d-block" title="${escHtml(m.description||'')}">${escHtml(m.description || '—')}</span></td>
            <td>${priorityBadge(m.priority)}</td>
            <td>${statusBadge(m.status)}</td>
            <td dir="ltr" class="text-muted small">${m.reportDate || '—'}</td>
            <td dir="ltr" class="text-muted small">${m.startDate || '—'}</td>
            <td dir="ltr" class="text-muted small">${m.completionDate || '—'}</td>
            <td class="small">${m.technician || '—'}</td>
            <td><b class="${m.cost > 0 ? 'text-danger' : 'text-muted'}">${Number(m.cost || 0).toLocaleString()}</b>${m.cost > 0 ? ' ر.س' : ''}</td>
            <td>
                <button onclick="openMaintenanceModal('${m.maintId}')" class="btn btn-warning btn-sm text-dark me-1"><i class="bi bi-pencil-fill"></i></button>
                <button onclick="deleteMaintenanceRequest('${m.maintId}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function openMaintenanceModal(id) {
    let m = id ? (window.allHousingMaintenance[id] || {}) : {};
    document.getElementById('mtId').value             = id || '';
    document.getElementById('mtCategory').value       = m.category     || 'تكييف';
    document.getElementById('mtPriority').value       = m.priority     || 'متوسط';
    document.getElementById('mtStatus').value         = m.status       || 'جديد';
    document.getElementById('mtDescription').value    = m.description  || '';
    document.getElementById('mtReportDate').value     = m.reportDate   || getTodayStr();
    document.getElementById('mtStartDate').value      = m.startDate    || '';
    document.getElementById('mtCompletionDate').value = m.completionDate || '';
    document.getElementById('mtTechnician').value     = m.technician   || '';
    document.getElementById('mtCost').value           = m.cost         || 0;
    document.getElementById('mtNotes').value          = m.notes        || '';
    let sel = document.getElementById('mtUnit');
    sel.innerHTML = '<option value="">— اختر الوحدة —</option>';
    Object.values(window.allHousingUnits).forEach(u => {
        let o = document.createElement('option');
        o.value = u.unitId; o.textContent = `${u.complexName} — ${u.unitNumber}`;
        if (u.unitId === m.unitId) o.selected = true;
        sel.appendChild(o);
    });
    new bootstrap.Modal(document.getElementById('maintenanceModal')).show();
}

function saveMaintenanceRequest() {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية. تواصل مع الأدمن.');
    let id = document.getElementById('mtId').value || ('MAINT_' + Date.now());
    let data = {
        maintId:        id,
        unitId:         document.getElementById('mtUnit').value,
        category:       document.getElementById('mtCategory').value,
        priority:       document.getElementById('mtPriority').value,
        status:         document.getElementById('mtStatus').value,
        description:    document.getElementById('mtDescription').value.trim(),
        reportDate:     document.getElementById('mtReportDate').value,
        startDate:      document.getElementById('mtStartDate').value,
        completionDate: document.getElementById('mtCompletionDate').value,
        technician:     document.getElementById('mtTechnician').value.trim(),
        cost:           Number(document.getElementById('mtCost').value) || 0,
        notes:          document.getElementById('mtNotes').value.trim(),
    };
    if (!data.unitId)      return alert('الرجاء اختيار الوحدة السكنية');
    if (!data.description) return alert('الرجاء كتابة وصف العطل');
    database.ref('ninja_data/housing_maintenance/' + id).set(data).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('maintenanceModal')).hide();
        logAudit('صيانة سكن', id, `${data.category} — ${data.status}`);
        alert('✅ تم حفظ طلب الصيانة');
    });
}

async function deleteMaintenanceRequest(id) {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية.');
    let m = (window.allHousingMaintenance || {})[id] || {};
    let _ok = await swalConfirm(`حذف طلب صيانة "${m.category ? m.category + ': ' + (m.description || '').slice(0, 30) : id}"؟`, { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('housing_maintenance', id, 'ninja_data/housing_maintenance/' + id, 'صيانة مساكن: ' + (m.category || id));
}

function exportMaintenance() {
    let items = Object.values(window.allHousingMaintenance);
    if (!items.length) return alert('لا توجد بيانات للتصدير');
    let data = items.map(m => {
        let unit = window.allHousingUnits[m.unitId];
        return { 'الوحدة': unit ? unit.complexName + ' ' + unit.unitNumber : m.unitId, 'التصنيف': m.category, 'الوصف': m.description, 'الأولوية': m.priority, 'الحالة': m.status, 'تاريخ الإبلاغ': m.reportDate, 'تاريخ البدء': m.startDate, 'تاريخ الإنجاز': m.completionDate, 'الفني': m.technician, 'التكلفة': m.cost, 'ملاحظات': m.notes };
    });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Maintenance'); XLSX.writeFile(wb, `MAINTENANCE_${getTodayStr()}.xlsx`);
}

// ── المستودع ─────────────────────────────────────────────────────────────────
function renderWarehouseKpis(items) {
    let row = document.getElementById('warehouseKpiRow'); if (!row) return;
    let total  = items.length;
    let empty  = items.filter(i => Number(i.quantity || 0) === 0).length;
    let low    = items.filter(i => Number(i.quantity||0) > 0 && Number(i.minStock||0) > 0 && Number(i.quantity||0) <= Number(i.minStock||0)).length;
    let issued = items.reduce((s, i) => s + Number(i.issued || 0), 0);
    let kpis = [
        { label: 'إجمالي الأصناف',    val: total,  icon: 'bi-box-seam-fill',        color: '#b45309', bg: '#fff7ed' },
        { label: 'نفد المخزون',        val: empty,  icon: 'bi-exclamation-circle-fill', color: '#dc2626', bg: '#fef2f2' },
        { label: 'تحت الحد الأدنى',   val: low,    icon: 'bi-exclamation-triangle-fill', color: '#d97706', bg: '#fffbeb' },
        { label: 'إجمالي المصروف',    val: issued, icon: 'bi-box-arrow-up',          color: '#7c3aed', bg: '#faf5ff' },
    ];
    row.innerHTML = kpis.map(k => `
        <div class="col-6 col-md-3">
            <div class="card-custom p-3 text-center" style="background:${k.bg}; border:1px solid ${k.color}22;">
                <i class="bi ${k.icon} fs-3 mb-1" style="color:${k.color};"></i>
                <div class="fw-bold fs-3" style="color:${k.color};">${k.val}</div>
                <div class="text-muted small fw-semibold">${k.label}</div>
            </div>
        </div>`).join('');
}

function renderWarehouse() {
    let tbody = document.getElementById('warehouseBody'); if (!tbody) return;
    let items = Object.values(window.allWarehouseItems);
    let cf = (document.getElementById('warehouseCatFilter')||{}).value || '';
    if (cf) items = items.filter(i => i.category === cf);
    renderWarehouseKpis(Object.values(window.allWarehouseItems));
    if (!items.length) { tbody.innerHTML = `<tr><td colspan="9" class="text-muted py-5 text-center fw-bold">لا يوجد أصناف في المستودع.</td></tr>`; return; }
    let catIcon = c => ({'أجهزة':'🖥️','أدوات':'🔧','مستلزمات':'🧴','أخرى':'📌'}[c]||'📦');
    tbody.innerHTML = items.map(i => {
        let qty      = Number(i.quantity || 0);
        let stock    = Number(i.stock    || qty);
        let issued   = Number(i.issued   || 0);
        let minStock = Number(i.minStock || 0);
        let isEmpty  = qty === 0;
        let isLow    = !isEmpty && minStock > 0 && qty <= minStock;
        let qtyColor = isEmpty ? 'danger' : isLow ? 'warning' : 'success';
        let qtyLabel = isEmpty ? '🔴 نفد' : isLow ? '⚠️ منخفض' : '';
        return `<tr class="${isEmpty ? 'table-danger bg-opacity-10' : isLow ? 'table-warning bg-opacity-10' : ''}">
            <td class="fw-bold text-start">${escHtml(i.name||'—')}</td>
            <td>${catIcon(i.category)} ${i.category||'—'}</td>
            <td><b class="text-primary">${stock}</b></td>
            <td><b class="text-danger">${issued}</b></td>
            <td>
                <span class="badge bg-${qtyColor} px-3 py-1 fs-6">${qty}</span>
                ${qtyLabel ? `<div class="small fw-bold text-${qtyColor} mt-1">${qtyLabel}</div>` : ''}
            </td>
            <td class="text-muted small">${minStock || '—'}</td>
            <td class="text-muted">${i.unit||'—'}</td>
            <td class="text-muted small">${escHtml(i.location||'—')}</td>
            <td>
                <div class="d-flex gap-1 flex-wrap justify-content-center">
                    <button onclick="openWarehouseTxModal('${i.itemId}','issue')" class="btn btn-danger btn-sm fw-bold" title="صرف من المخزون" ${isEmpty ? 'disabled' : ''}><i class="bi bi-box-arrow-up me-1"></i>صرف</button>
                    <button onclick="openWarehouseTxModal('${i.itemId}','add')" class="btn btn-success btn-sm fw-bold" title="إضافة للمخزون"><i class="bi bi-box-arrow-in-down me-1"></i>إضافة</button>
                    <button onclick="viewWarehouseTxHistory('${i.itemId}')" class="btn btn-outline-secondary btn-sm" title="سجل الحركات"><i class="bi bi-clock-history"></i></button>
                    <button onclick="openWarehouseItemModal('${i.itemId}')" class="btn btn-warning btn-sm text-dark"><i class="bi bi-pencil-fill"></i></button>
                    <button onclick="deleteWarehouseItem('${i.itemId}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function openWarehouseItemModal(id) {
    let i = id ? (window.allWarehouseItems[id]||{}) : {};
    let isEdit = !!id;
    document.getElementById('wiItemId').value   = id || '';
    document.getElementById('wiName').value     = i.name     || '';
    document.getElementById('wiCategory').value = i.category || 'أجهزة';
    document.getElementById('wiUnit').value     = i.unit     || 'قطعة';
    document.getElementById('wiMinStock').value = i.minStock || '';
    document.getElementById('wiLocation').value = i.location || '';
    document.getElementById('wiNotes').value    = i.notes    || '';

    let initRow  = document.getElementById('wiInitialStockRow');
    let statsRow = document.getElementById('wiStatsRow');
    if (initRow)  initRow.style.display  = isEdit ? 'none' : '';
    if (statsRow) statsRow.style.display = isEdit ? '' : 'none';
    document.getElementById('wiInitialStock').value = isEdit ? '' : 1;
    if (isEdit) {
        document.getElementById('wiStatStock').textContent  = i.stock   || 0;
        document.getElementById('wiStatIssued').textContent = i.issued  || 0;
        document.getElementById('wiStatRemain').textContent = i.quantity || 0;
    }
    new bootstrap.Modal(document.getElementById('warehouseItemModal')).show();
}

function saveWarehouseItem() {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية.');
    let id = document.getElementById('wiItemId').value || ('WI_' + Date.now());
    let existing = window.allWarehouseItems[id];
    let initStock = Number(document.getElementById('wiInitialStock').value) || 0;
    let data = {
        itemId:   id,
        name:     document.getElementById('wiName').value.trim(),
        category: document.getElementById('wiCategory').value,
        unit:     document.getElementById('wiUnit').value.trim(),
        minStock: Number(document.getElementById('wiMinStock').value) || 0,
        location: document.getElementById('wiLocation').value.trim(),
        notes:    document.getElementById('wiNotes').value.trim(),
        stock:    existing ? (existing.stock    || 0) : initStock,
        issued:   existing ? (existing.issued   || 0) : 0,
        quantity: existing ? (existing.quantity || 0) : initStock,
    };
    if (!data.name) return alert('الرجاء إدخال اسم الصنف');
    database.ref('ninja_data/warehouse/' + id).set(data).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('warehouseItemModal')).hide();
        logAudit(existing ? 'تعديل صنف مستودع' : 'إضافة صنف مستودع', data.name, `الفئة: ${data.category} — المخزون: ${data.quantity}`);
        Swal.fire({ icon:'success', title:L('تم','Done'), text:L('تم حفظ الصنف بنجاح','Item saved successfully'), timer:1800, showConfirmButton:false });
    });
}

function openWarehouseTxModal(itemId, type) {
    let item = window.allWarehouseItems[itemId]; if (!item) return;
    document.getElementById('wtxItemId').value = itemId;
    document.getElementById('wtxType').value   = type;
    document.getElementById('wtxQty').value    = 1;
    document.getElementById('wtxNote').value   = '';
    let isIssue = type === 'issue';
    let qty = Number(item.quantity || 0);
    document.getElementById('wtxModalTitle').textContent = isIssue ? L(`📤 صرف من المخزون — ${item.name}`, `📤 Issue from Stock — ${item.name}`) : L(`📥 إضافة للمخزون — ${item.name}`, `📥 Add to Stock — ${item.name}`);
    document.getElementById('wtxCurrentQty').textContent = qty;
    document.getElementById('wtxCurrentQty').style.color = qty === 0 ? '#dc2626' : qty <= Number(item.minStock||0) ? '#d97706' : '#16a34a';
    if (isIssue) document.getElementById('wtxQty').max = qty;
    let hdr = document.getElementById('warehouseTxModalHeader');
    if (hdr) hdr.style.background = isIssue ? 'linear-gradient(135deg,#7f1d1d,#dc2626)' : 'linear-gradient(135deg,#14532d,#16a34a)';
    let btn = document.getElementById('wtxSaveBtn');
    btn.style.background = isIssue ? '#dc2626' : '#16a34a';
    btn.innerHTML = `<i class="bi bi-${isIssue ? 'box-arrow-up' : 'box-arrow-in-down'} me-1"></i>${isIssue ? L('تأكيد الصرف','Confirm Issue') : L('تأكيد الإضافة','Confirm Add')}`;
    new bootstrap.Modal(document.getElementById('warehouseTxModal')).show();
}

function saveWarehouseTx() {
    let itemId = document.getElementById('wtxItemId').value;
    let type   = document.getElementById('wtxType').value;
    let qty    = Number(document.getElementById('wtxQty').value) || 0;
    let note   = document.getElementById('wtxNote').value.trim();
    if (!qty || qty <= 0) return alert('الرجاء إدخال كمية صحيحة');
    let item = window.allWarehouseItems[itemId]; if (!item) return;
    if (type === 'issue' && qty > Number(item.quantity || 0))
        return Swal.fire({ icon:'error', title:L('خطأ','Error'), text:L(`لا يمكن صرف ${qty} — المتبقي فقط ${item.quantity || 0}`, `Cannot issue ${qty} — only ${item.quantity || 0} remaining`) });
    let newQty    = type === 'issue' ? Number(item.quantity||0) - qty : Number(item.quantity||0) + qty;
    let newStock  = type === 'add'   ? Number(item.stock||item.quantity||0) + qty : Number(item.stock||item.quantity||0);
    let newIssued = type === 'issue' ? Number(item.issued||0) + qty : Number(item.issued||0);
    let txKey = database.ref('ninja_data/warehouse_transactions/' + itemId).push().key;
    let tx = { type, qty, note, by: window.loggedInUser, byName: (adminUsers[window.loggedInUser]||{}).name || window.loggedInUser, at: Date.now() };
    let updates = {};
    updates[`ninja_data/warehouse/${itemId}/quantity`] = newQty;
    updates[`ninja_data/warehouse/${itemId}/stock`]    = newStock;
    updates[`ninja_data/warehouse/${itemId}/issued`]   = newIssued;
    updates[`ninja_data/warehouse_transactions/${itemId}/${txKey}`] = tx;
    database.ref().update(updates).then(() => {
        bootstrap.Modal.getInstance(document.getElementById('warehouseTxModal')).hide();
        logAudit(type === 'issue' ? 'صرف من المستودع' : 'إضافة للمستودع', item.name, `${type === 'issue' ? 'صرف' : 'أُضيف'} ${qty} ${item.unit||''} — المتبقي: ${newQty}${note ? ' — ' + note : ''}`);
        Swal.fire({ icon:'success', title:L('تم','Done'), text:L(`${type === 'issue' ? '📤 تم الصرف' : '📥 تم الإضافة'} — المتبقي الآن: ${newQty} ${item.unit||''}`, `${type === 'issue' ? '📤 Issued' : '📥 Added'} — Remaining: ${newQty} ${item.unit||''}`), timer:2000, showConfirmButton:false });
    });
}

function viewWarehouseTxHistory(itemId) {
    let item = window.allWarehouseItems[itemId]; if (!item) return;
    let txs  = window.allWarehouseTx[itemId] || {};
    let list = Object.values(txs).sort((a, b) => (b.at||0) - (a.at||0));
    document.getElementById('wtxHistoryTitle').innerHTML = `<i class="bi bi-clock-history me-2"></i>${L('سجل حركات','Transaction History')} — ${item.name} <span class="badge bg-light text-secondary ms-2 small">${list.length} ${L('حركة','records')}</span>`;
    let tbody = document.getElementById('wtxHistoryBody');
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4 fw-bold">لا توجد حركات مسجلة لهذا الصنف</td></tr>`;
    } else {
        tbody.innerHTML = list.map(tx => {
            let isIssue = tx.type === 'issue';
            let d = tx.at ? new Date(tx.at).toLocaleString('ar-EG', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '—';
            return `<tr>
                <td class="text-muted small">${d}</td>
                <td><span class="badge ${isIssue ? 'bg-danger' : 'bg-success'}">${isIssue ? '📤 صرف' : '📥 إضافة'}</span></td>
                <td><b class="${isIssue ? 'text-danger' : 'text-success'} fs-5">${isIssue ? '-' : '+'}${tx.qty}</b></td>
                <td class="fw-bold small">${tx.byName || tx.by || '—'}</td>
                <td class="text-muted small">${escHtml(tx.note || '—')}</td>
            </tr>`;
        }).join('');
    }
    new bootstrap.Modal(document.getElementById('warehouseTxHistoryModal')).show();
}

async function deleteWarehouseItem(id) {
    if (!hasPerm('housing')) return alert('❌ ليس لديك صلاحية.');
    let item = (window.allWarehouseItems || {})[id] || {};
    let _ok = await swalConfirm('حذف هذا الصنف من المستودع؟', { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('warehouse', id, 'ninja_data/warehouse/' + id, 'مستودع: ' + (item.name || id));
}

function exportWarehouseItems() {
    let items = Object.values(window.allWarehouseItems);
    if (!items.length) return alert('لا توجد بيانات للتصدير');
    let data = items.map(i => ({ 'اسم الصنف': i.name, 'الفئة': i.category, 'المخزون الكلي': i.stock||i.quantity||0, 'المصروف': i.issued||0, 'المتبقي': i.quantity||0, 'حد التنبيه': i.minStock||0, 'الوحدة': i.unit, 'الموقع': i.location, 'ملاحظات': i.notes }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأصناف'); XLSX.writeFile(wb, `WAREHOUSE_ITEMS_${getTodayStr()}.xlsx`);
    logAudit('تصدير أصناف المستودع', 'Excel', `تم تصدير ${items.length} صنف`);
}

function exportWarehouseTx() {
    let allTx = window.allWarehouseTx || {};
    let items = window.allWarehouseItems || {};
    let rows = [];
    Object.entries(allTx).forEach(([itemId, txMap]) => {
        let itemName = (items[itemId] || {}).name || itemId;
        let unit     = (items[itemId] || {}).unit || '';
        Object.values(txMap).forEach(tx => {
            rows.push({
                'اسم الصنف':   itemName,
                'النوع':       tx.type === 'issue' ? 'صرف' : 'إضافة',
                'الكمية':      tx.qty,
                'الوحدة':      unit,
                'بواسطة':      tx.byName || tx.by || '—',
                'التاريخ':     tx.at ? new Date(tx.at).toLocaleString('ar-EG') : '—',
                'ملاحظة':      tx.note || '—'
            });
        });
    });
    rows.sort((a, b) => String(b['التاريخ']).localeCompare(String(a['التاريخ'])));
    if (!rows.length) return alert('لا توجد حركات مسجلة للتصدير');
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل الحركات'); XLSX.writeFile(wb, `WAREHOUSE_TRANSACTIONS_${getTodayStr()}.xlsx`);
    logAudit('تصدير سجل حركات المستودع', 'Excel', `تم تصدير ${rows.length} حركة`);
}

function exportAllWarehouseData() {
    let items = Object.values(window.allWarehouseItems);
    let allTx = window.allWarehouseTx || {};
    let warehouseItems = window.allWarehouseItems || {};
    let rows = [];
    Object.entries(allTx).forEach(([itemId, txMap]) => {
        let itemName = (warehouseItems[itemId] || {}).name || itemId;
        let unit     = (warehouseItems[itemId] || {}).unit || '';
        Object.values(txMap).forEach(tx => {
            rows.push({ 'اسم الصنف': itemName, 'النوع': tx.type === 'issue' ? 'صرف' : 'إضافة', 'الكمية': tx.qty, 'الوحدة': unit, 'بواسطة': tx.byName || tx.by || '—', 'التاريخ': tx.at ? new Date(tx.at).toLocaleString('ar-EG') : '—', 'ملاحظة': tx.note || '—' });
        });
    });
    if (!items.length && !rows.length) return alert('لا توجد بيانات للتصدير');
    const wb = XLSX.utils.book_new();
    if (items.length) {
        let data = items.map(i => ({ 'اسم الصنف': i.name, 'الفئة': i.category, 'المخزون الكلي': i.stock||i.quantity||0, 'المصروف': i.issued||0, 'المتبقي': i.quantity||0, 'حد التنبيه': i.minStock||0, 'الوحدة': i.unit, 'الموقع': i.location }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'الأصناف');
    }
    if (rows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'سجل الحركات');
    XLSX.writeFile(wb, `WAREHOUSE_FULL_${getTodayStr()}.xlsx`);
    logAudit('تصدير المستودع الكامل', 'Excel', 'تم تصدير الأصناف وسجل الحركات في ملف واحد');
}

function updateWarehouseExportCounts() {
    let itemCount = Object.values(window.allWarehouseItems || {}).length;
    let txCount   = Object.values(window.allWarehouseTx || {}).reduce((s, txMap) => s + Object.values(txMap||{}).length, 0);
    let el1 = document.getElementById('whExportItemCount');
    let el2 = document.getElementById('whExportTxCount');
    if (el1) el1.textContent = itemCount > 0 ? `${itemCount} صنف مسجل` : 'لا يوجد أصناف';
    if (el2) el2.textContent = txCount > 0 ? `${txCount} حركة مسجلة` : 'لا توجد حركات';
}

// --- قسم الموارد البشرية (HR CRUD) ---
function calcNetSalary() {
    let basic = Number(document.getElementById('empBasic').value) || 0;
    let allow = Number(document.getElementById('empAllowance').value) || 0;
    let deduct = Number(document.getElementById('empDeduction').value) || 0;
    document.getElementById('empNetDisplay').innerText = (basic + allow - deduct).toLocaleString();
}

function openHrModal(id) {
    let acc = (window.allRawAccounts || []).find(a => a && String(a.id) === String(id));
    if (!acc) return;
    let e = (window.allHrData || {})[String(id)] || {};
    const g = (f, d = '') => e[f] !== undefined ? e[f] : d;
    let pNames = { ninja:'🥷 نينجا', keeta:'🚴 كيتا', hunger:'📦 هنقرستيشن', jahez:'🛒 جاهز', chefz:'👨‍🍳 ذا شفز' };
    let plat = acc.platform || 'ninja';

    document.getElementById('empId').value = id;
    document.getElementById('empNameDisplay').textContent = acc.ownerName || id;
    document.getElementById('empPlatformDisplay').innerHTML =
        `<span class="badge fw-bold fs-6" style="background:#7c3aed;">${pNames[plat] || plat}</span>
         <span class="text-muted ms-2 small">${acc.phone && acc.phone !== '-' ? acc.phone : ''}</span>`;

    document.getElementById('empNumber').value = g('empNumber');
    document.getElementById('empJob').value = g('job');
    document.getElementById('empNationalId').value = g('nationalId');
    document.getElementById('empPhone').value = g('phone', acc.phone || '');
    document.getElementById('empHireDate').value = g('hireDate');
    document.getElementById('empSupervisor').value = g('supervisor', acc.supervisor || '');
    document.getElementById('empStatus').value = g('status', 'نشط');
    document.getElementById('empBasic').value = g('basic', 0);
    document.getElementById('empAllowance').value = g('allowance', 0);
    document.getElementById('empDeduction').value = g('deduction', 0);
    document.getElementById('empLeaveBalance').value = g('leaveBalance', 0);
    document.getElementById('empAbsence').value = g('absence', 0);
    document.getElementById('empIqamaExpiry').value = g('iqamaExpiry');
    document.getElementById('empLicenseExpiry').value = g('licenseExpiry');
    document.getElementById('empContractExpiry').value = g('contractExpiry');
    document.getElementById('empNotes').value = g('notes');
    calcNetSalary();
    new bootstrap.Modal(document.getElementById('hrModal')).show();
}

function saveEmployee() {
    if(!hasPerm('hr')) return alert('❌ ليس لديك صلاحية تعديل قسم منصات. تواصل مع الأدمن.');
    let id = document.getElementById('empId').value;
    if (!id) return;
    let basic = Number(document.getElementById('empBasic').value) || 0;
    let allow = Number(document.getElementById('empAllowance').value) || 0;
    let deduct = Number(document.getElementById('empDeduction').value) || 0;
    let hrData = {
        empNumber: document.getElementById('empNumber').value.trim(),
        job: document.getElementById('empJob').value.trim(),
        nationalId: document.getElementById('empNationalId').value.trim(),
        phone: document.getElementById('empPhone').value.trim(),
        hireDate: document.getElementById('empHireDate').value,
        supervisor: document.getElementById('empSupervisor').value.trim(),
        status: document.getElementById('empStatus').value,
        basic, allowance: allow, deduction: deduct, net: basic + allow - deduct,
        leaveBalance: Number(document.getElementById('empLeaveBalance').value) || 0,
        absence: Number(document.getElementById('empAbsence').value) || 0,
        iqamaExpiry: document.getElementById('empIqamaExpiry').value,
        licenseExpiry: document.getElementById('empLicenseExpiry').value,
        contractExpiry: document.getElementById('empContractExpiry').value,
        notes: document.getElementById('empNotes').value.trim(),
        updatedAt: new Date().toISOString()
    };
    let acc = (window.allRawAccounts || []).find(a => a && String(a.id) === String(id));
    let name = acc ? (acc.ownerName || acc.actualUserName) : id;
    database.ref('ninja_data/hr_data/' + id).set(hrData).then(() => {
        let m = bootstrap.Modal.getInstance(document.getElementById('hrModal')); if (m) m.hide();
        logAudit('حفظ بيانات HR', id, `تم حفظ بيانات ${name}`);
        alert(t('saved_success'));
    }).catch(err => { console.error('saveEmployee', err); alert('خطأ في الحفظ'); });
}

async function deleteEmployee(id) {
    if(!hasPerm('hr')) return alert('❌ ليس لديك صلاحية تعديل قسم منصات. تواصل مع الأدمن.');
    let acc = (window.allRawAccounts || []).find(a => a && String(a.id) === String(id));
    let name = acc ? (acc.ownerName || id) : id;
    let _ok = await swalConfirm(`هل تريد مسح بيانات العمل والراتب لـ "${name}"؟`, { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('hr_data', id, 'ninja_data/hr_data/' + id, 'بيانات HR: ' + name);
}

function renderHrKpis() {
    let row = document.getElementById('hrKpiRow');
    if (!row) return;
    let accs = window.allRawAccounts || [];
    let hrData = window.allHrData || {};
    let total = accs.length;
    let active = accs.filter(a => !hrData[a.id] || hrData[a.id].status === 'نشط').length;
    let onLeave = accs.filter(a => hrData[a.id] && hrData[a.id].status === 'إجازة').length;
    let salaries = accs.reduce((x, a) => x + Number((hrData[a.id] && hrData[a.id].net) || 0), 0);
    let cards = [
        { label: t('hr_kpi_total'), val: total, color: '#7c3aed', icon: 'people-fill' },
        { label: t('hr_kpi_active'), val: active, color: 'var(--success)', icon: 'person-check-fill' },
        { label: t('hr_kpi_leave'), val: onLeave, color: 'var(--warning)', icon: 'airplane-fill' },
        { label: t('hr_kpi_salaries'), val: salaries.toLocaleString() + ' ' + t('currency_sar'), color: 'var(--primary)', icon: 'cash-stack' }
    ];
    row.innerHTML = cards.map(c => `<div class="col-6 col-md-3"><div class="stat-card" style="border-bottom:4px solid ${c.color};"><h5><i class="bi bi-${c.icon} me-1"></i>${c.label}</h5><h2 style="color:${c.color};font-size:1.5rem;">${c.val}</h2></div></div>`).join('');
}

function renderHrTable() {
    let tbody = document.getElementById('hrTableBody');
    if (!tbody) return;
    renderHrKpis();
    let accs = window.allRawAccounts || [];
    let hrData = window.allHrData || {};
    let pNames = { ninja:'🥷 نينجا', keeta:'🚴 كيتا', hunger:'📦 هنقر', jahez:'🛒 جاهز', chefz:'👨‍🍳 شفز' };
    if (accs.length === 0) { tbody.innerHTML = `<tr><td colspan="7" class="text-muted py-5 fs-5 fw-bold">${t('hr_empty')}</td></tr>`; return; }
    tbody.innerHTML = accs.map(acc => {
        let e = hrData[acc.id] || {};
        let statusVal = e.status || 'نشط';
        let statusBadge = statusVal === 'نشط' ? `<span class="badge bg-success">${t('hr_status_active')}</span>`
            : statusVal === 'إجازة' ? `<span class="badge bg-info text-dark">${t('hr_status_leave')}</span>`
                : `<span class="badge bg-secondary">${t('hr_status_suspended')}</span>`;
        let plat = acc.platform || 'ninja';
        return `<tr>
            <td style="text-align:start;">
                <b class="fs-5">${escHtml(acc.ownerName || '-')}</b><br>
                <span class="badge bg-light text-dark border me-1">${pNames[plat]||plat}</span>${statusBadge}
                ${e.job ? `<br><small class="text-muted">${escHtml(e.job)}</small>` : ''}
            </td>
            <td><span dir="ltr">${e.nationalId || '-'}</span></td>
            <td><span dir="ltr">${e.phone || acc.phone || '-'}</span><br><small class="text-muted">${e.supervisor || acc.supervisor || '-'}</small></td>
            <td><b class="text-success fs-5">${Number(e.net || 0).toLocaleString()}</b> ${t('currency_sar')}<br><small class="text-muted">${t('hr_basic')}: ${Number(e.basic || 0).toLocaleString()}</small></td>
            <td><span class="badge bg-primary">${t('hr_leave_short')}: ${e.leaveBalance || 0}</span><br><span class="badge bg-warning text-dark mt-1">${t('hr_absence_short')}: ${e.absence || 0}</span></td>
            <td style="text-align:start;">
                <div>${t('hr_iqama_short')}: ${miniExpiry(e.iqamaExpiry)}</div>
                <div>${t('hr_license_short')}: ${miniExpiry(e.licenseExpiry)}</div>
                <div>${t('hr_contract_short')}: ${miniExpiry(e.contractExpiry)}</div>
            </td>
            <td><div class="d-flex justify-content-center gap-1">
                <button onclick="openHrModal('${acc.id}')" class="btn btn-warning btn-sm text-dark" title="${t('hr_edit_data')}"><i class="bi bi-pencil-fill"></i></button>
                <button onclick="deleteEmployee('${acc.id}')" class="btn btn-outline-danger btn-sm" title="${t('hr_clear_data')}"><i class="bi bi-eraser-fill"></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

function exportEmployees() {
    let accs = window.allRawAccounts || [];
    if (accs.length === 0) return alert(t('no_data_export'));
    let hrData = window.allHrData || {};
    let pNames = { ninja:'نينجا', keeta:'كيتا', hunger:'هنقرستيشن', jahez:'جاهز', chefz:'ذا شفز' };
    let data = accs.map(acc => {
        let e = hrData[acc.id] || {};
        return {
            [t('hr_name')]: acc.ownerName || '-',
            'المنصة': pNames[acc.platform||'ninja'] || acc.platform,
            [t('hr_emp_num')]: e.empNumber || '-',
            [t('hr_job')]: e.job || '-',
            [t('hr_national_id')]: e.nationalId || '-',
            [t('hr_phone')]: e.phone || acc.phone || '-',
            [t('hr_supervisor')]: e.supervisor || acc.supervisor || '-',
            [t('hr_basic')]: e.basic || 0,
            [t('hr_allowance')]: e.allowance || 0,
            [t('hr_deduction')]: e.deduction || 0,
            [t('hr_net')]: e.net || 0,
            [t('hr_iqama_exp')]: e.iqamaExpiry || '-',
            [t('hr_license_exp')]: e.licenseExpiry || '-',
            [t('hr_contract_exp')]: e.contractExpiry || '-'
        };
    });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HR_Data"); XLSX.writeFile(wb, `HR_DATA_${getTodayStr()}.xlsx`);
    logAudit('تصدير HR', 'hr', 'تم تصدير بيانات الموارد البشرية');
}

// ==================================================================
// 📄 نظام وثائق المناديب — Driver Documents System
// ==================================================================
// 💰 قسم المالية الشامل — Finance Section
// ==================================================================
window.allTransactions = {};   // { id: { type, category, amount, date, platform, description } }
window.allFinanceInvoices = {}; // { platform: { YYYY-MM: amount } }
window.allFinanceArchive = {};  // { YYYY-MM: { income, expenses, net } }
window.currentPlatInv = 'keeta';

function loadFinanceData() {
    database.ref('ninja_data/finance_transactions').on('value', snap => {
        window.allTransactions = snap.val() || {};
        if (currentPlatformTab === 'finance') {
            let v = document.getElementById('finView_transactions');
            if (v && v.style.display !== 'none') renderTransactions();
        }
    });
    database.ref('ninja_data/finance_invoices').on('value', snap => {
        window.allFinanceInvoices = snap.val() || {};
    });
    database.ref('ninja_data/finance_archive').on('value', snap => {
        window.allFinanceArchive = snap.val() || {};
        if (currentPlatformTab === 'finance') {
            let v = document.getElementById('finView_archive');
            if (v && v.style.display !== 'none') renderFinanceArchive();
        }
    });
}

function switchFinanceTab(tab) {
    ['invoices','transactions','pnl','debts','archive','advances'].forEach(t => {
        let view = document.getElementById('finView_' + t);
        let btn  = document.getElementById('finTab_' + t);
        if (view) view.style.display = (t === tab) ? '' : 'none';
        if (btn)  btn.classList.toggle('active-fin-tab', t === tab);
    });
    let platRow = document.getElementById('finBannerPlatRow');
    if (platRow) {
        if (tab === 'invoices') platRow.style.removeProperty('display');
        else platRow.style.display = 'none';
    }
    if (tab === 'invoices')     { switchPlatInvTab(window.currentPlatInv || 'ninja', null); }
    if (tab === 'transactions') renderTransactions();
    if (tab === 'pnl')          renderPnL();
    if (tab === 'debts')        renderDriverDebts();
    if (tab === 'archive')      renderFinanceArchive();
    if (tab === 'advances')     renderAdvances();
}

// ==========================================
// [FINANCE] سجل السلف — مبلغ / مسدّد / متبقي
// ==========================================
function _advKpi(label, val, color) {
    return `<div class="col-md-3 col-6"><div class="card-custom p-3 text-center h-100"><div class="fw-bold" style="font-size:1.45rem;color:${color}">${val}</div><div class="small text-muted fw-bold mt-1">${label}</div></div></div>`;
}

// من يقدر يوافق على السلف: السوبر أدمن/الأدمن أو من عنده صلاحية advance_approve (تتمنح لأكثر من شخص)
function canApproveAdvance() { return isAdminOrSuper() || hasPerm('advance_approve'); }

function renderAdvances() {
    const tbody = document.getElementById('advancesTableBody');
    const kpi   = document.getElementById('advancesKpiRow');
    if (!tbody) return;
    let list = Object.entries(window.allAdvances || {}).map(([k, v]) => Object.assign({ _k: k }, v)).filter(a => a && a.name);
    list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    const approved    = list.filter(a => a.status === 'approved');
    const totalAmt    = approved.reduce((s, a) => s + Number(a.amount || 0), 0);   // المعتمد فقط = فلوس فعلاً خرجت
    const totalRepaid = approved.reduce((s, a) => s + Number(a.repaid || 0), 0);
    const outstanding = totalAmt - totalRepaid;
    const pendingCount = list.filter(a => (a.status || 'pending') === 'pending').length;
    const canApprove = canApproveAdvance();
    if (kpi) kpi.innerHTML =
        _advKpi(L('إجمالي السلف (معتمدة)','Approved total'), totalAmt.toLocaleString() + ' ' + L('ر.س','SAR'), '#1e40af') +
        _advKpi(L('المسدّد','Repaid'),                       totalRepaid.toLocaleString() + ' ' + L('ر.س','SAR'), '#16a34a') +
        _advKpi(L('المتبقي','Outstanding'),                  outstanding.toLocaleString() + ' ' + L('ر.س','SAR'), '#dc2626') +
        _advKpi(L('بانتظار الموافقة','Pending approval'),    pendingCount, '#d97706');

    if (!list.length) { tbody.innerHTML = `<tr><td colspan="8" class="text-muted py-5 fw-bold">${L('لا توجد سلف مسجّلة بعد','No advances recorded yet')}</td></tr>`; return; }
    tbody.innerHTML = list.map(a => {
        const amt = Number(a.amount || 0), rep = Number(a.repaid || 0), bal = amt - rep;
        const paid = bal <= 0.001;
        const st = a.status || 'pending';
        let statusBadge;
        if (st === 'rejected') statusBadge = `<span class="badge bg-danger">${L('مرفوضة','Rejected')}</span>`;
        else if (st === 'pending') statusBadge = `<span class="badge bg-warning text-dark">⏳ ${L('بانتظار الموافقة','Pending')}</span>`;
        else { // approved
            const pay = paid ? `<span class="badge bg-success">${L('مسددة','Paid')}</span>` : rep > 0 ? `<span class="badge bg-info text-dark">${L('سداد جزئي','Partial')}</span>` : `<span class="badge bg-secondary">${L('غير مسددة','Unpaid')}</span>`;
            statusBadge = `<span class="badge bg-success" title="${L('اعتمدها','Approved by')}: ${escHtml(a.approvedBy || '')}">✓ ${L('معتمدة','Approved')}</span><br>${pay}`;
        }
        let actions = '';
        if (st === 'pending') {
            actions = canApprove
                ? `<button onclick="approveAdvance('${a._k}')" class="btn btn-success btn-sm fw-bold" title="${L('موافقة','Approve')}"><i class="bi bi-check-lg"></i></button>
                   <button onclick="rejectAdvance('${a._k}')" class="btn btn-danger btn-sm fw-bold" title="${L('رفض','Reject')}"><i class="bi bi-x-lg"></i></button>`
                : `<span class="badge bg-light text-muted border">${L('بانتظار معتمِد','Awaiting approver')}</span>`;
        } else if (st === 'approved' && !paid) {
            actions = `<button onclick="repayAdvance('${a._k}')" class="btn btn-success btn-sm" title="${L('تسديد','Repay')}"><i class="bi bi-cash-coin"></i></button>`;
        }
        return `<tr>
            <td class="fw-bold text-start">${escHtml(a.name || '-')}${a.platform ? ` <span class="badge bg-light text-secondary border">${platformDisplayName(a.platform)}</span>` : ''}</td>
            <td class="fw-bold" dir="ltr">${amt.toLocaleString()}</td>
            <td dir="ltr">${a.date || '-'}</td>
            <td><small class="text-muted">${escHtml(a.reason || '')}</small></td>
            <td class="text-success" dir="ltr">${rep.toLocaleString()}</td>
            <td class="fw-bold ${bal > 0 ? 'text-danger' : 'text-success'}" dir="ltr">${bal.toLocaleString()}</td>
            <td>${statusBadge}</td>
            <td><div class="d-flex justify-content-center gap-1 flex-wrap">
                ${actions}
                <button onclick="openAdvanceModal('${a._k}')" class="btn btn-warning btn-sm text-dark" title="${L('تعديل','Edit')}"><i class="bi bi-pencil-fill"></i></button>
                <button onclick="deleteAdvance('${a._k}')" class="btn btn-outline-danger btn-sm" title="${L('حذف','Delete')}"><i class="bi bi-trash-fill"></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

function approveAdvance(id) {
    if (!canApproveAdvance()) return alert('❌ ليس لديك صلاحية الموافقة على السلف.');
    const a = window.allAdvances[id]; if (!a) return;
    database.ref('ninja_data/advances/' + id).update({ status: 'approved', approvedBy: window.loggedInUser, approvedAt: new Date().toISOString() })
        .then(() => { if (typeof logAudit === 'function') logAudit('موافقة سلفة', id, `${a.name} — ${Number(a.amount || 0)} ر.س`); });
}

function rejectAdvance(id) {
    if (!canApproveAdvance()) return alert('❌ ليس لديك صلاحية الموافقة على السلف.');
    const a = window.allAdvances[id]; if (!a) return;
    database.ref('ninja_data/advances/' + id).update({ status: 'rejected', approvedBy: window.loggedInUser, approvedAt: new Date().toISOString() })
        .then(() => { if (typeof logAudit === 'function') logAudit('رفض سلفة', id, `${a.name}`); });
}

function openAdvanceModal(id) {
    if (!hasPerm('finance_add') && !isAdminOrSuper()) return alert('❌ ليس لديك صلاحية. تواصل مع الأدمن.');
    const a = id ? (window.allAdvances[id] || {}) : {};
    document.getElementById('advId').value       = id || '';
    document.getElementById('advName').value     = a.name || '';
    document.getElementById('advAmount').value   = a.amount || '';
    document.getElementById('advDate').value     = a.date || getTodayStr();
    document.getElementById('advRepaid').value   = a.repaid || 0;
    document.getElementById('advPlatform').value = a.platform || '';
    document.getElementById('advReason').value   = a.reason || '';
    const dl = document.getElementById('advNamesList');
    if (dl) { const names = [...new Set((window.allRawAccounts || []).map(x => x.actualUserName).filter(n => n && n !== '-'))]; dl.innerHTML = names.map(n => `<option value="${escHtml(n)}">`).join(''); }
    new bootstrap.Modal(document.getElementById('advanceModal')).show();
}

function saveAdvance() {
    if (!hasPerm('finance_add') && !isAdminOrSuper()) return alert('❌ ليس لديك صلاحية. تواصل مع الأدمن.');
    const id = document.getElementById('advId').value || ('ADV_' + Date.now());
    const name = document.getElementById('advName').value.trim();
    const amount = Number(document.getElementById('advAmount').value) || 0;
    if (!name) return alert(L('الرجاء إدخال الاسم','Please enter a name'));
    if (amount <= 0) return alert(L('الرجاء إدخال مبلغ صحيح','Please enter a valid amount'));
    let repaid = Number(document.getElementById('advRepaid').value) || 0;
    if (repaid > amount) repaid = amount;
    const existing = (window.allAdvances && window.allAdvances[id]) || null;
    const data = {
        id, name, amount, repaid,
        date:     document.getElementById('advDate').value || getTodayStr(),
        platform: document.getElementById('advPlatform').value || '',
        reason:   document.getElementById('advReason').value.trim(),
        // كل سلفة جديدة تبدأ "بانتظار الموافقة"؛ التعديل يحافظ على الحالة الحالية
        status:      existing ? (existing.status || 'pending') : 'pending',
        requestedBy: existing ? (existing.requestedBy || window.loggedInUser) : window.loggedInUser,
        approvedBy:  existing ? (existing.approvedBy || '') : '',
        approvedAt:  existing ? (existing.approvedAt || '') : '',
        updatedAt: new Date().toISOString(), updatedBy: window.loggedInUser || 'admin'
    };
    database.ref('ninja_data/advances/' + id).set(data).then(() => {
        const m = bootstrap.Modal.getInstance(document.getElementById('advanceModal')); if (m) m.hide();
        if (typeof logAudit === 'function') logAudit(existing ? 'تعديل سلفة' : 'طلب سلفة', id, `${name} — ${amount} ر.س`);
    });
}

function repayAdvance(id) {
    const a = window.allAdvances[id]; if (!a) return;
    const bal = Number(a.amount || 0) - Number(a.repaid || 0);
    const v = prompt(L(`المبلغ المراد تسديده (المتبقي ${bal.toLocaleString()} ر.س):`, `Amount to repay (remaining ${bal.toLocaleString()} SAR):`), bal);
    if (v === null) return;
    const pay = Number(v) || 0; if (pay <= 0) return;
    const newRepaid = Math.min(Number(a.amount || 0), Number(a.repaid || 0) + pay);
    database.ref('ninja_data/advances/' + id + '/repaid').set(newRepaid).then(() => {
        if (typeof logAudit === 'function') logAudit('تسديد سلفة', id, `${a.name} — ${pay} ر.س`);
    });
}

async function deleteAdvance(id) {
    if (!hasPerm('finance_add') && !isAdminOrSuper()) return alert('❌ ليس لديك صلاحية. تواصل مع الأدمن.');
    const a = window.allAdvances[id] || {};
    const ok = (typeof swalConfirm === 'function')
        ? await swalConfirm(L(`حذف سلفة "${a.name || id}"؟`, `Delete advance for "${a.name || id}"?`), { confirmText: L('نعم، احذف','Yes, delete') })
        : confirm(L(`حذف سلفة "${a.name || id}"؟`, `Delete advance for "${a.name || id}"?`));
    if (!ok) return;
    database.ref('ninja_data/advances/' + id).remove().then(() => {
        if (typeof logAudit === 'function') logAudit('حذف سلفة', id, a.name || '');
    });
}

function exportAdvances() {
    const list = Object.values(window.allAdvances || {}).filter(a => a && a.name);
    if (!list.length) return alert(L('لا توجد سلف للتصدير.','No advances to export.'));
    const data = list.map(a => ({
        [L('الاسم','Name')]: a.name, [L('المبلغ','Amount')]: a.amount, [L('التاريخ','Date')]: a.date,
        [L('السبب','Reason')]: a.reason, [L('المسدّد','Repaid')]: a.repaid,
        [L('المتبقي','Balance')]: Number(a.amount || 0) - Number(a.repaid || 0), [L('المنصة','Platform')]: a.platform || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, L('السلف','Advances'));
    XLSX.writeFile(wb, `ADVANCES_${getTodayStr()}.xlsx`);
}

// ─── فواتير المنصات الأخرى ────────────────────────────────────────
const PLAT_NAMES = { ninja:'🥷 نينجا', keeta:'🚴 كيتا', hunger:'📦 هنقر', jahez:'🛒 جاهز', chefz:'👨‍🍳 شفز' };

function triggerInvoiceUpload() {
    let plat = window.currentPlatInv || 'ninja';
    if (plat === 'ninja') {
        document.getElementById('ninjaInvoiceImport').click();
    } else {
        document.getElementById('platInvoiceImport').click();
    }
}

function readPlatInvoice(e) {
    if (!hasPerm('finance_add') && !(window.adminUsers[window.loggedInUser] && window.adminUsers[window.loggedInUser].role === 'super_admin'))
        return alert('❌ ليس لديك صلاحية إدراج الفاتورة.');
    const file = e.target.files[0]; if (!file) return;
    const platform = window.currentPlatInv;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const wb = XLSX.read(ev.target.result, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            // ابحث عن أكبر قيمة رقمية — غالباً هي الإجمالي في فواتير المنصات
            let maxVal = 0;
            data.forEach(row => row.forEach(cell => {
                let n = parseFloat(String(cell).replace(/,/g, ''));
                if (!isNaN(n) && n > maxVal) maxVal = n;
            }));
            // محاولة استخراج الشهر من اسم الملف
            let monthMatch = file.name.match(/(\d{4})[-_](\d{2})/);
            let month = monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : '';
            let totalInput = document.getElementById(`platInvTotal_${platform}`);
            let monthInput = document.getElementById(`platInvMonth_${platform}`);
            if (totalInput) totalInput.value = maxVal > 0 ? maxVal.toFixed(2) : '';
            if (monthInput && month) monthInput.value = month;
            if (maxVal > 0) Swal.fire({ icon:'success', title:'تم قراءة الفاتورة', text:`الإجمالي المقترح: ${maxVal.toLocaleString()} ر.س — راجع القيمة وادفع حفظ`, confirmButtonText:'حسناً' });
            else alert('⚠️ لم يتم العثور على قيمة رقمية في الملف — أدخل الإجمالي يدوياً');
        } catch(err) { alert('❌ خطأ في قراءة الملف'); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
}

function switchPlatInvTab(platform, btn) {
    window.currentPlatInv = platform;
    document.querySelectorAll('.fin-plat-tab').forEach(b => b.classList.remove('active-fin-plat'));
    let target = btn || document.querySelector(`.fin-plat-tab[data-plat="${platform}"]`);
    if (target) target.classList.add('active-fin-plat');
    // ninja view vs platform content
    let ninjaView = document.getElementById('ninjaInvView');
    let platContent = document.getElementById('platInvContent');
    if (platform === 'ninja') {
        if (ninjaView)   ninjaView.style.display = '';
        if (platContent) platContent.style.display = 'none';
    } else {
        if (ninjaView)   ninjaView.style.display = 'none';
        if (platContent) platContent.style.display = '';
        renderPlatInvView(platform);
    }
}

function renderPlatInvView(platform) {
    let container = document.getElementById('platInvContent');
    if (!container) return;
    let invoices = window.allFinanceInvoices[platform] || {};
    let canAdd = (window.adminUsers && window.adminUsers[window.loggedInUser] && window.adminUsers[window.loggedInUser].role==='super_admin') || hasPerm('finance_add');
    let canDel = (window.adminUsers && window.adminUsers[window.loggedInUser] && window.adminUsers[window.loggedInUser].role==='super_admin') || hasPerm('finance_delete');
    let rows = Object.entries(invoices).sort((a,b) => b[0].localeCompare(a[0])).map(([month, amount]) =>
        `<tr><td dir="ltr" class="fw-bold">${month}</td>
              <td><b class="text-success fs-5">${Number(amount).toLocaleString()}</b> ر.س</td>
              <td>${canDel ? `<button onclick="deletePlatInvoice('${platform}','${month}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button>` : '-'}</td>
         </tr>`
    ).join('') || `<tr><td colspan="3" class="text-muted py-4">لا توجد فواتير محفوظة</td></tr>`;

    container.innerHTML = `
        <h5 class="fw-bold text-primary mb-3">${PLAT_NAMES[platform] || platform} — الفواتير المحفوظة</h5>
        ${canAdd ? `<div class="card-custom p-4 mb-3" style="border-right:4px solid #1e40af;">
            <h6 class="fw-bold mb-3"><i class="bi bi-cloud-upload me-2"></i>حفظ إجمالي فاتورة الشهر</h6>
            <div class="d-flex gap-3 align-items-center flex-wrap">
                <div>
                    <label class="fw-bold small text-muted mb-1">الشهر</label>
                    <input type="month" id="platInvMonth_${platform}" class="form-control shadow-sm fw-bold" style="max-width:180px;" dir="ltr">
                </div>
                <div>
                    <label class="fw-bold small text-muted mb-1">إجمالي الفاتورة (ر.س)</label>
                    <input type="number" id="platInvTotal_${platform}" class="form-control fw-bold shadow-sm" style="max-width:200px;" placeholder="0.00" min="0" step="0.01">
                </div>
                <div style="margin-top:22px;">
                    <button onclick="saveInvoiceTotal('${platform}')" class="btn fw-bold text-white px-4" style="background:#1e40af;border-radius:12px;">
                        <i class="bi bi-check-circle-fill me-1"></i>حفظ
                    </button>
                </div>
            </div>
        </div>` : ''}

        <div class="card-custom p-0 overflow-hidden">
            <table class="table table-hover align-middle text-center mb-0 fs-6">
                <thead class="table-light"><tr><th>الشهر</th><th>الإجمالي</th><th>إجراءات</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function saveInvoiceTotal(platform) {
    if (!hasPerm('finance_add')) return alert('❌ ليس لديك صلاحية حفظ الفواتير. تواصل مع الأدمن.');
    let monthEl = document.getElementById((platform === 'ninja' ? 'ninjaInvMonth' : `platInvMonth_${platform}`));
    let totalEl = document.getElementById((platform === 'ninja' ? 'ninjaInvTotal' : `platInvTotal_${platform}`));
    if (!monthEl || !totalEl) return;
    let month = monthEl.value;
    let total = parseFloat(totalEl.value) || 0;
    if (!month) return alert('الرجاء تحديد الشهر');
    if (total <= 0) return alert('الرجاء إدخال مبلغ صحيح');
    database.ref(`ninja_data/finance_invoices/${platform}/${month}`).set(total).then(() => {
        if (!window.allFinanceInvoices[platform]) window.allFinanceInvoices[platform] = {};
        window.allFinanceInvoices[platform][month] = total;
        totalEl.value = '';
        if (platform !== 'ninja') renderPlatInvView(platform);
        logAudit('حفظ فاتورة', platform, `${month}: ${total} ر.س`);
        alert(t('saved_success'));
    });
}

async function deletePlatInvoice(platform, month) {
    if (!hasPerm('finance_delete')) return alert('❌ ليس لديك صلاحية حذف الفواتير. تواصل مع الأدمن.');
    let _ok = await swalConfirm(`حذف فاتورة ${month} من ${PLAT_NAMES[platform]}؟`, { confirmText: 'نعم، احذف' }); if (!_ok) return;
    let originalPath = `ninja_data/finance_invoices/${platform}/${month}`;
    let label = `فاتورة ${PLAT_NAMES[platform]} — ${month}`;
    trashAndDelete('finance_invoices', platform + '_' + month, originalPath, label).then(() => {
        if (window.allFinanceInvoices && window.allFinanceInvoices[platform]) delete window.allFinanceInvoices[platform][month];
        renderPlatInvView(platform);
    });
}

// ─── سجل المعاملات ───────────────────────────────────────────────
const TXN_CATEGORIES = {
    income:  ['عمولة منصة','إيراد آخر','مستحقات'],
    expense: ['وقود','رواتب','مخالفات','صيانة','مصروف إداري','مصروف آخر']
};

function updateTxnCategories() {
    let type = document.getElementById('txnType').value;
    let sel = document.getElementById('txnCategory');
    sel.innerHTML = (TXN_CATEGORIES[type] || []).map(c => `<option value="${c}">${c}</option>`).join('');
}

function openTransactionModal(id) {
    let txn = id ? (window.allTransactions[id] || {}) : {};
    document.getElementById('txnId').value = id || '';
    document.getElementById('txnType').value = txn.type || 'expense';
    updateTxnCategories();
    document.getElementById('txnCategory').value = txn.category || '';
    document.getElementById('txnAmount').value = txn.amount || '';
    document.getElementById('txnDate').value = txn.date || getTodayStr();
    document.getElementById('txnPlatform').value = txn.platform || 'all';
    document.getElementById('txnDescription').value = txn.description || '';
    new bootstrap.Modal(document.getElementById('transactionModal')).show();
}

function saveTransaction() {
    if (!hasPerm('finance_add')) return alert('❌ ليس لديك صلاحية إضافة معاملات. تواصل مع الأدمن.');
    let id = document.getElementById('txnId').value || ('TXN_' + Date.now());
    let amount = parseFloat(document.getElementById('txnAmount').value) || 0;
    if (amount <= 0) return alert('الرجاء إدخال مبلغ صحيح');
    let txn = {
        id,
        type:        document.getElementById('txnType').value,
        category:    document.getElementById('txnCategory').value,
        amount,
        date:        document.getElementById('txnDate').value,
        platform:    document.getElementById('txnPlatform').value,
        description: document.getElementById('txnDescription').value.trim(),
        createdAt:   new Date().toISOString()
    };
    database.ref('ninja_data/finance_transactions/' + id).set(txn).then(() => {
        let m = bootstrap.Modal.getInstance(document.getElementById('transactionModal')); if(m) m.hide();
        logAudit('معاملة مالية', id, `${txn.type} — ${txn.amount} ر.س — ${txn.category}`);
    });
}

async function deleteTransaction(id) {
    if (!hasPerm('finance_delete')) return alert('❌ ليس لديك صلاحية حذف المعاملات. تواصل مع الأدمن.');
    let _ok = await swalConfirm('حذف هذه المعاملة؟', { confirmText: 'نعم، احذف' }); if (!_ok) return;
    let txn = (window.allTransactions || {})[id] || {};
    trashAndDelete('finance_transactions', id, 'ninja_data/finance_transactions/' + id, 'معاملة: ' + (txn.category || '') + ' ' + (txn.amount ? txn.amount + ' ر.س' : id));
}

function renderTxnKpis() {
    let row = document.getElementById('txnKpiRow'); if (!row) return;
    let txns = Object.values(window.allTransactions);
    let income   = txns.filter(t => t.type === 'income').reduce((x,t) => x + Number(t.amount||0), 0);
    let expenses = txns.filter(t => t.type === 'expense').reduce((x,t) => x + Number(t.amount||0), 0);
    row.innerHTML = [
        { label:'إجمالي الإيرادات المسجلة', val: income.toLocaleString() + ' ر.س',   color:'var(--success)', icon:'arrow-up-circle-fill' },
        { label:'إجمالي المصروفات المسجلة', val: expenses.toLocaleString() + ' ر.س',  color:'var(--danger)',  icon:'arrow-down-circle-fill' },
        { label:'عدد المعاملات',             val: txns.length,                          color:'var(--primary)', icon:'list-ul' }
    ].map(c => `<div class="col-md-4"><div class="stat-card" style="border-bottom:4px solid ${c.color};">
        <h5><i class="bi bi-${c.icon} me-1"></i>${c.label}</h5><h2 style="color:${c.color};font-size:1.4rem;">${c.val}</h2>
    </div></div>`).join('');
}

function renderTransactions() {
    renderTxnKpis();
    let tbody = document.getElementById('txnTableBody'); if (!tbody) return;
    let txns = Object.values(window.allTransactions).sort((a,b) => (b.date||'').localeCompare(a.date||''));
    if (!txns.length) { tbody.innerHTML = `<tr><td colspan="7" class="text-muted py-5 fw-bold">لا توجد معاملات مسجلة. اضغط "إضافة معاملة" للبدء.</td></tr>`; return; }
    tbody.innerHTML = txns.map(tx => {
        let typeBadge = tx.type === 'income'
            ? `<span class="badge bg-success">💚 إيراد</span>`
            : `<span class="badge bg-danger">🔴 مصروف</span>`;
        return `<tr>
            <td dir="ltr" class="fw-bold">${tx.date||'-'}</td>
            <td>${typeBadge}</td>
            <td><span class="badge bg-light text-dark border">${tx.category||'-'}</span></td>
            <td><b class="${tx.type==='income'?'text-success':'text-danger'} fs-6">${Number(tx.amount||0).toLocaleString()}</b> ر.س</td>
            <td>${PLAT_NAMES[tx.platform]||tx.platform||'-'}</td>
            <td class="text-muted">${escHtml(tx.description||'-')}</td>
            <td>
                ${(window.adminUsers && window.adminUsers[window.loggedInUser] && window.adminUsers[window.loggedInUser].role==='super_admin') || hasPerm('finance_add') ? `<button onclick="openTransactionModal('${tx.id}')" class="btn btn-warning btn-sm text-dark me-1"><i class="bi bi-pencil-fill"></i></button>` : ''}
                ${(window.adminUsers && window.adminUsers[window.loggedInUser] && window.adminUsers[window.loggedInUser].role==='super_admin') || hasPerm('finance_delete') ? `<button onclick="deleteTransaction('${tx.id}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button>` : ''}
            </td>
        </tr>`;
    }).join('');
}

function exportTransactions() {
    let txns = Object.values(window.allTransactions);
    if (!txns.length) return alert(t('no_data_export'));
    let data = txns.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(tx => ({
        'التاريخ': tx.date, 'النوع': tx.type==='income'?'إيراد':'مصروف',
        'التصنيف': tx.category, 'المبلغ': tx.amount, 'المنصة': PLAT_NAMES[tx.platform]||tx.platform, 'الوصف': tx.description
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions'); XLSX.writeFile(wb, `TRANSACTIONS_${getTodayStr()}.xlsx`);
}

// ─── تقرير الأرباح والخسائر ──────────────────────────────────────
function renderPnL() {
    let monthEl = document.getElementById('pnlMonth');
    if (!monthEl.value) monthEl.value = new Date().toISOString().slice(0,7);
    let month = monthEl.value;

    // الإيرادات من الفواتير المحفوعة لهذا الشهر
    let income = 0;
    let incomeRows = [];
    Object.entries(window.allFinanceInvoices || {}).forEach(([plat, months]) => {
        if (months[month]) {
            income += Number(months[month]);
            incomeRows.push({ plat, amount: Number(months[month]) });
        }
    });

    // المصروفات من سجل المعاملات لهذا الشهر
    let expenses = 0;
    let expGroups = {};
    Object.values(window.allTransactions || {}).forEach(tx => {
        if (tx.type === 'expense' && tx.date && tx.date.startsWith(month)) {
            expenses += Number(tx.amount || 0);
            let cat = tx.category || 'آخر';
            expGroups[cat] = (expGroups[cat] || 0) + Number(tx.amount || 0);
        }
    });

    let net = income - expenses;
    let netColor = net >= 0 ? 'var(--success)' : 'var(--danger)';

    // KPI Cards
    let pnlKpi = document.getElementById('pnlKpiRow');
    if (pnlKpi) pnlKpi.innerHTML = [
        { label:'الإيرادات',         val: income.toLocaleString()   + ' ر.س', color:'var(--success)', icon:'arrow-up-circle-fill' },
        { label:'المصروفات',         val: expenses.toLocaleString() + ' ر.س', color:'var(--danger)',  icon:'arrow-down-circle-fill' },
        { label:'صافي الربح/الخسارة', val: (net>=0?'+':'')+net.toLocaleString()+' ر.س', color:netColor, icon:'bar-chart-fill' }
    ].map(c => `<div class="col-md-4"><div class="stat-card" style="border-bottom:4px solid ${c.color};">
        <h5><i class="bi bi-${c.icon} me-1"></i>${c.label}</h5><h2 style="color:${c.color};font-size:1.4rem;">${c.val}</h2>
    </div></div>`).join('');

    // Income breakdown
    let incDiv = document.getElementById('pnlIncomeDetails');
    if (incDiv) incDiv.innerHTML = incomeRows.length
        ? incomeRows.map(r => `<div class="d-flex justify-content-between align-items-center p-3 mb-2 rounded-3" style="background:rgba(16,185,129,0.08);">
            <span class="fw-bold">${PLAT_NAMES[r.plat]||r.plat}</span>
            <span class="fw-bold text-success fs-5">${r.amount.toLocaleString()} ر.س</span>
          </div>`).join('') + `<div class="border-top pt-2 mt-2 text-end fw-bold text-success fs-5">الإجمالي: ${income.toLocaleString()} ر.س</div>`
        : `<div class="text-muted text-center py-4">لا توجد فواتير محفوظة لهذا الشهر</div>`;

    // Expense breakdown
    let expDiv = document.getElementById('pnlExpenseDetails');
    if (expDiv) expDiv.innerHTML = Object.keys(expGroups).length
        ? Object.entries(expGroups).map(([cat,amt]) => `<div class="d-flex justify-content-between align-items-center p-3 mb-2 rounded-3" style="background:rgba(239,68,68,0.08);">
            <span class="fw-bold">${cat}</span>
            <span class="fw-bold text-danger fs-5">${amt.toLocaleString()} ر.س</span>
          </div>`).join('') + `<div class="border-top pt-2 mt-2 text-end fw-bold text-danger fs-5">الإجمالي: ${expenses.toLocaleString()} ر.س</div>`
        : `<div class="text-muted text-center py-4">لا توجد مصروفات مسجلة لهذا الشهر</div>`;
}

// ─── ديون المناديب ────────────────────────────────────────────────
function renderDriverDebts() {
    let kpiRow = document.getElementById('debtsKpiRow');
    let tbody  = document.getElementById('debtsTableBody');
    let debtors = (window.allRawAccounts || []).filter(a => a && Number(a.wallet||0) < 0);

    let total = debtors.reduce((x,a) => x + Math.abs(Number(a.wallet||0)), 0);
    if (kpiRow) kpiRow.innerHTML = [
        { label:'عدد المديونين',     val: debtors.length,                      color:'var(--danger)',  icon:'people-fill' },
        { label:'إجمالي الديون',     val: total.toLocaleString() + ' ر.س',     color:'var(--warning)', icon:'cash-stack' }
    ].map(c => `<div class="col-md-6"><div class="stat-card" style="border-bottom:4px solid ${c.color};">
        <h5><i class="bi bi-${c.icon} me-1"></i>${c.label}</h5><h2 style="color:${c.color};font-size:1.4rem;">${c.val}</h2>
    </div></div>`).join('');

    if (!tbody) return;
    if (!debtors.length) { tbody.innerHTML = `<tr><td colspan="5" class="text-muted py-5 fw-bold">لا يوجد مناديب بمحافظ سالبة ✅</td></tr>`; return; }
    tbody.innerHTML = debtors.sort((a,b) => Number(a.wallet||0) - Number(b.wallet||0)).map(acc => `<tr>
        <td style="text-align:start;"><b class="fs-6">${escHtml(acc.ownerName||'-')}</b></td>
        <td><span class="badge bg-light text-dark border">${PLAT_NAMES[acc.platform||'ninja']||acc.platform}</span></td>
        <td><b class="text-danger fs-5">${Number(acc.wallet||0).toLocaleString()}</b> ر.س</td>
        <td dir="ltr">${acc.phone||'-'}</td>
        <td>
            ${acc.phone && acc.phone !== '-' ? `<a href="https://wa.me/${acc.phone.replace(/\D/g,'').replace(/^05/,'9665')}?text=${encodeURIComponent('عزيزي الكابتن '+acc.ownerName+' لديك رصيد سالب في محفظتك. الرجاء التواصل مع الإدارة.')}" target="_blank" class="btn btn-success btn-sm text-white"><i class="bi bi-whatsapp"></i></a>` : '-'}
        </td>
    </tr>`).join('');
}

function exportDriverDebts() {
    let debtors = (window.allRawAccounts || []).filter(a => a && Number(a.wallet||0) < 0);
    if (!debtors.length) return alert(t('no_data_export'));
    let data = debtors.map(acc => ({ 'المندوب': acc.ownerName, 'المنصة': acc.platform, 'رصيد المحفظة': acc.wallet, 'الجوال': acc.phone }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Debts'); XLSX.writeFile(wb, `DEBTS_${getTodayStr()}.xlsx`);
}

// ─── الأرشيف الشهري ──────────────────────────────────────────────
function saveMonthlyArchive() {
    if (!hasPerm('finance_add')) return alert('❌ ليس لديك صلاحية حفظ الأرشيف. تواصل مع الأدمن.');
    let month = new Date().toISOString().slice(0,7);
    let invoices = window.allFinanceInvoices || {};
    let income = 0;
    Object.values(invoices).forEach(months => { if (months[month]) income += Number(months[month]); });
    let expenses = Object.values(window.allTransactions||{})
        .filter(tx => tx.type==='expense' && tx.date && tx.date.startsWith(month))
        .reduce((x,tx) => x + Number(tx.amount||0), 0);
    let entry = { month, income, expenses, net: income - expenses, savedAt: new Date().toISOString() };
    database.ref('ninja_data/finance_archive/' + month.replace('-','_')).set(entry).then(() => {
        alert(`✅ تم حفظ ملخص ${month}\nإيرادات: ${income.toLocaleString()} | مصروفات: ${expenses.toLocaleString()} | صافي: ${(income-expenses).toLocaleString()} ر.س`);
        logAudit('أرشيف مالي', month, `صافي: ${income-expenses} ر.س`);
    });
}

function renderFinanceArchive() {
    let container = document.getElementById('archiveContainer'); if (!container) return;
    let entries = Object.values(window.allFinanceArchive || {}).sort((a,b) => (b.month||'').localeCompare(a.month||''));
    if (!entries.length) { container.innerHTML = `<div class="text-muted text-center py-5 fs-5 fw-bold">لا يوجد أرشيف محفوظ بعد. اضغط "حفظ الشهر الحالي".</div>`; return; }
    container.innerHTML = `<div class="row g-4">` + entries.map(e => {
        let netColor = e.net >= 0 ? 'var(--success)' : 'var(--danger)';
        return `<div class="col-md-6 col-lg-4">
            <div class="card-custom p-4" style="border-top:4px solid ${netColor};">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="fw-bold mb-0" dir="ltr">${e.month}</h5>
                    ${(window.adminUsers && window.adminUsers[window.loggedInUser] && window.adminUsers[window.loggedInUser].role==='super_admin') || hasPerm('finance_delete') ? `<button onclick="deleteArchiveEntry('${e.month.replace('-','_')}')" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash-fill"></i></button>` : ''}
                </div>
                <div class="d-flex justify-content-between mb-2"><span class="text-muted fw-bold">الإيرادات</span><span class="fw-bold text-success">${Number(e.income||0).toLocaleString()} ر.س</span></div>
                <div class="d-flex justify-content-between mb-2"><span class="text-muted fw-bold">المصروفات</span><span class="fw-bold text-danger">${Number(e.expenses||0).toLocaleString()} ر.س</span></div>
                <div class="border-top pt-2 mt-2 d-flex justify-content-between">
                    <span class="fw-bold fs-5">صافي الربح</span>
                    <span class="fw-bold fs-5" style="color:${netColor}">${(e.net>=0?'+':'') + Number(e.net||0).toLocaleString()} ر.س</span>
                </div>
            </div>
        </div>`;
    }).join('') + `</div>`;
}

async function deleteArchiveEntry(key) {
    if (!hasPerm('finance_delete')) return alert('❌ ليس لديك صلاحية حذف الأرشيف. تواصل مع الأدمن.');
    let _ok = await swalConfirm('حذف هذا الشهر من الأرشيف؟', { confirmText: 'نعم، احذف' }); if (!_ok) return;
    trashAndDelete('finance_archive', key, 'ninja_data/finance_archive/' + key, 'أرشيف مالي: ' + key).then(() => renderFinanceArchive());
}

// ==================================================================
window.currentDocFilter = 'all';

function switchHrTab(tab) {
    let empView = document.getElementById('hrEmployeesView');
    let docView = document.getElementById('hrDocsView');
    let tabEmp = document.getElementById('hrSubTabEmployees');
    let tabDoc = document.getElementById('hrSubTabDocs');

    if (tab === 'employees') {
        if (empView) empView.style.display = '';
        if (docView) docView.style.display = 'none';
        if (tabEmp) tabEmp.classList.add('active-hr-tab');
        if (tabDoc) tabDoc.classList.remove('active-hr-tab');
    } else {
        if (empView) empView.style.display = 'none';
        if (docView) docView.style.display = '';
        if (tabEmp) tabEmp.classList.remove('active-hr-tab');
        if (tabDoc) tabDoc.classList.add('active-hr-tab');
        renderDriverDocsTable();
    }
    updateHrExportCounts();
}

function updateHrExportCounts() {
    let empCount = Object.keys(window.allHrData || {}).length;
    let docsCount = Object.keys(window.allDriverDocs || {}).length;
    let el1 = document.getElementById('hrExportEmpCount');
    let el2 = document.getElementById('hrExportDocsCount');
    if (el1) el1.textContent = empCount > 0 ? `${empCount} ${L('موظف مسجل', 'employee(s)')}` : L('لا يوجد موظفون', 'No employees');
    if (el2) el2.textContent = docsCount > 0 ? `${docsCount} ${L('مندوب مسجل', 'driver(s)')}` : L('لا توجد وثائق', 'No documents');
}

// --- تحميل وثائق المناديب من Firebase ---
function loadDriverDocs() {
    database.ref('ninja_data/driver_docs').on('value', snap => {
        window.allDriverDocs = snap.val() || {};
        let docsView = document.getElementById('hrDocsView');
        if (docsView && docsView.style.display !== 'none') renderDriverDocsTable();
    });
}

// --- حساب حالة وثيقة واحدة ---
function getDocStatus(docData) {
    if (!docData) return 'missing';
    if (!docData.expiryDate) return docData.url ? 'no_expiry' : 'missing';
    let d = daysUntil(docData.expiryDate);
    if (d === null) return docData.url ? 'no_expiry' : 'missing';
    if (d < 0) return 'expired';
    if (d <= 30) return 'expiring';
    return 'valid';
}

function docStatusBadge(docData) {
    let status = getDocStatus(docData);
    let hasFile = docData && docData.url;
    let exp = docData && docData.expiryDate;
    let d = exp ? daysUntil(exp) : null;

    if (status === 'missing') return `<span class="badge bg-secondary" title="${t('docs_not_uploaded')}">📤 ${t('docs_not_uploaded')}</span>`;
    if (status === 'no_expiry') return `<span class="badge bg-primary" title="${t('docs_uploaded_no_date')}">📎 ${t('docs_uploaded_no_date')}</span>`;
    if (status === 'expired') return `<span class="badge bg-danger">⛔ ${t('alert_expired')}<br><small>${exp}</small></span>`;
    if (status === 'expiring') return `<span class="badge bg-warning text-dark">⚠️ ${d} ${t('alert_days')}<br><small>${exp}</small></span>`;
    return `<span class="badge bg-success">✅ ${t('docs_valid')}<br><small>${exp}</small></span>`;
}

// --- KPIs لوثائق المناديب ---
function renderDocsKpis() {
    let row = document.getElementById('docsKpiRow');
    if (!row) return;
    let accounts = (window.allRawAccounts || []).filter(a => a);
    let total = accounts.length;
    let expired = 0, expiring = 0, missing = 0, valid = 0;
    accounts.forEach(acc => {
        let docs = window.allDriverDocs[acc.id] || {};
        DOC_TYPES.forEach(dt => {
            let s = getDocStatus(docs[dt.key]);
            if (s === 'expired') expired++;
            else if (s === 'expiring') expiring++;
            else if (s === 'missing') missing++;
            else valid++;
        });
    });
    row.innerHTML = [
        { label: t('docs_kpi_total_drivers'), val: total, color: '#7c3aed', icon: 'people-fill' },
        { label: t('docs_kpi_expired'), val: expired, color: 'var(--danger)', icon: 'x-circle-fill' },
        { label: t('docs_kpi_expiring'), val: expiring, color: 'var(--warning)', icon: 'exclamation-triangle-fill' },
        { label: t('docs_kpi_missing'), val: missing, color: '#64748b', icon: 'cloud-upload-fill' },
        { label: t('docs_kpi_valid'), val: valid, color: 'var(--success)', icon: 'check-circle-fill' }
    ].map(c => `<div class="col-6 col-md col-lg"><div class="stat-card" style="border-bottom:4px solid ${c.color};">
        <h5><i class="bi bi-${c.icon} me-1"></i>${c.label}</h5><h2 style="color:${c.color}">${c.val}</h2>
    </div></div>`).join('');
}

// --- جدول المناديب مع حالة كل وثيقة ---
function renderDriverDocsTable() {
    renderDocsKpis();
    let tbody = document.getElementById('docsTableBody');
    if (!tbody) return;
    let accounts = (window.allRawAccounts || []).filter(a => a);
    if (accounts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-muted py-5 fs-5 fw-bold">${t('docs_no_drivers')}</td></tr>`;
        return;
    }

    let pName = { ninja:'نينجا 🥷', keeta:'كيتا 🚴', hunger:'هنقر 📦', jahez:'جاهز 🛒', chefz:'ذا شفز 👨‍🍳' };
    let filter = window.currentDocFilter || 'all';

    let rows = accounts.map(acc => {
        let docs = window.allDriverDocs[acc.id] || {};
        // تحقق من الفلتر
        if (filter !== 'all') {
            let statuses = DOC_TYPES.map(dt => getDocStatus(docs[dt.key]));
            if (filter === 'expired' && !statuses.includes('expired')) return '';
            if (filter === 'expiring' && !statuses.includes('expiring')) return '';
            if (filter === 'valid' && !statuses.some(s => s === 'valid' || s === 'no_expiry')) return '';
            if (filter === 'missing' && !statuses.includes('missing')) return '';
        }
        let cells = DOC_TYPES.map(dt => `<td>${docStatusBadge(docs[dt.key])}</td>`).join('');
        return `<tr>
            <td><input type="checkbox" class="doc-row-check form-check-input fs-5" value="${acc.id}" style="cursor:pointer;" onchange="syncSelectAllDocHeader()"></td>
            <td style="text-align:start;">
                <b class="fs-6">${escHtml(acc.ownerName || '-')}</b>
            </td>
            ${cells}
            <td>
                <div class="d-flex flex-column gap-2">
                    <button onclick="openDriverDocsModal('${acc.id}')" class="btn fw-bold text-white btn-sm px-3 py-2" style="background:#7c3aed; border-radius:10px;">
                        <i class="bi bi-folder2-open me-1"></i>${t('docs_manage')}
                    </button>
                    <button onclick="downloadAllDocs('${acc.id}')" class="btn fw-bold text-white btn-sm px-3 py-2" style="background:#10b981; border-radius:10px;" title="${t('docs_download_all')}">
                        <i class="bi bi-download me-1"></i>${t('docs_download_zip')}
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
    tbody.innerHTML = rows || `<tr><td colspan="8" class="text-muted py-5">${t('docs_no_match_filter')}</td></tr>`;
}

function filterDocsByStatus(status, btn) {
    window.currentDocFilter = status;
    document.querySelectorAll('.filter-doc-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderDriverDocsTable();
}

function getSelectedDocIds() {
    return [...document.querySelectorAll('.doc-row-check:checked')].map(c => c.value);
}

function toggleSelectAllDocs(state) {
    let checks = document.querySelectorAll('.doc-row-check');
    let headerCheck = document.getElementById('checkAllDocs');
    // لو استدعي من الزر (بدون حالة) يعكس الحالة الحالية
    let newState = (state !== undefined) ? state : !(headerCheck && headerCheck.checked);
    checks.forEach(c => c.checked = newState);
    if (headerCheck) headerCheck.checked = newState;
}

function syncSelectAllDocHeader() {
    let all = document.querySelectorAll('.doc-row-check');
    let checked = document.querySelectorAll('.doc-row-check:checked');
    let header = document.getElementById('checkAllDocs');
    if (header) header.checked = all.length > 0 && all.length === checked.length;
}

async function deleteSelectedDocs() {
    let ids = getSelectedDocIds();
    if (ids.length === 0) return alert(t('docs_none_selected'));
    let names = ids.map(id => {
        let acc = (window.allRawAccounts || []).find(a => a && String(a.id) === String(id));
        return acc ? acc.ownerName : id;
    });
    let _ok = await swalConfirm(`${t('docs_confirm_delete_selected')} (${ids.length}):\n${names.join('\n')}`, { confirmText: 'نعم، احذف' }); if (!_ok) return;
    let timestamp = Date.now();
    let allUpdates = {};
    let undoUpdates = {};
    ids.forEach((id, i) => {
        let docs = (window.allDriverDocs || {})[id];
        let originalPath = 'ninja_data/driver_docs/' + id;
        let safeId = String(id).replace(/[.#$\/\[\]]/g, '_');
        let trashKey = (timestamp + i) + '_' + safeId;
        let trashPath = 'ninja_data/_trash/driver_docs/' + trashKey;
        if (docs) {
            allUpdates[trashPath] = Object.assign({}, docs, {
                _deletedAt: new Date().toLocaleString('ar-EG'),
                _deletedBy: window.loggedInUser || 'admin',
                _originalPath: originalPath,
                _label: 'وثائق: ' + (names[i] || id)
            });
            undoUpdates[originalPath] = docs;
            undoUpdates[trashPath] = null;
        }
        allUpdates[originalPath] = null;
    });
    database.ref().update(allUpdates).then(() => {
        ids.forEach(id => { if (window.allDriverDocs) delete window.allDriverDocs[id]; });
        renderDriverDocsTable();
        logAudit('حذف وثائق', 'hr', `تم حذف وثائق ${ids.length} مندوب`);
        pushUndoState(L(`حذف وثائق ${ids.length} مندوب`, `Delete docs for ${ids.length} driver(s)`), undoUpdates);
    });
}

// --- فتح نافذة وثائق مندوب ---
function openDriverDocsModal(driverId) {
    let acc = (window.allRawAccounts || []).find(a => a && String(a.id) === String(driverId));
    if (!acc) return;
    document.getElementById('currentDocDriverId').value = driverId;
    document.getElementById('driverDocsTitle').textContent = acc.ownerName || acc.actualUserName || driverId;
    let pName = { ninja:'نينجا 🥷', keeta:'كيتا 🚴', hunger:'هنقر 📦', jahez:'جاهز 🛒', chefz:'ذا شفز 👨‍🍳' };
    document.getElementById('driverDocsPlatform').textContent = pName[acc.platform||'ninja'] + ' — ' + (acc.actualUserName || '-');
    renderDocCards(driverId, window.allDriverDocs[driverId] || {});
    new bootstrap.Modal(document.getElementById('driverDocsModal')).show();
}

// --- رسم بطاقات الوثائق ---
function renderDocCards(driverId, docsData) {
    let container = document.getElementById('driverDocCards');
    if (!container) return;
    container.innerHTML = DOC_TYPES.map(dt => {
        let doc = docsData[dt.key] || {};
        let status = getDocStatus(doc);
        let borderColor = status === 'expired' ? '#ef4444' : status === 'expiring' ? '#f59e0b' : status === 'valid' || status === 'no_expiry' ? '#10b981' : '#cbd5e1';
        let statusBadge = status === 'missing' ? `<span class="badge bg-secondary">📤 ${t('docs_not_uploaded')}</span>`
            : status === 'no_expiry' ? `<span class="badge bg-primary">📎 ${t('docs_uploaded_no_date')}</span>`
            : status === 'expired' ? `<span class="badge bg-danger">⛔ ${t('alert_expired')}</span>`
            : status === 'expiring' ? `<span class="badge bg-warning text-dark">⚠️ ${daysUntil(doc.expiryDate)} ${t('alert_days')}</span>`
            : `<span class="badge bg-success">✅ ${t('docs_valid')}</span>`;

        let fileInfo = doc.fileName
            ? `<div class="d-flex align-items-center gap-2 mt-2">
                <i class="bi bi-paperclip text-muted"></i>
                <small class="text-truncate text-muted" style="max-width:120px;" title="${doc.fileName}">${doc.fileName}</small>
                <button onclick="viewDoc('${doc.url}', '${doc.fileName}')" class="btn btn-link btn-sm p-0" title="${t('docs_view')}">
                    <i class="bi bi-eye-fill text-primary fs-5"></i>
                </button>
                <button onclick="downloadDoc('${doc.url}', '${doc.fileName}')" class="btn btn-link btn-sm p-0" title="${t('docs_download')}">
                    <i class="bi bi-download text-success fs-5"></i>
                </button>
               </div>`
            : `<div class="mt-2 text-muted small">${t('docs_no_file_yet')}</div>`;

        return `<div class="col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm" style="border-right: 5px solid ${borderColor}; border-radius:16px;">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="d-flex align-items-center gap-2">
                            <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;background:${dt.color}20;">
                                <i class="bi bi-${dt.icon} fs-5" style="color:${dt.color};"></i>
                            </div>
                            <b class="fw-bold" style="color:${dt.color};">${dt.label}</b>
                        </div>
                        ${statusBadge}
                    </div>
                    ${fileInfo}
                    <hr class="my-2">
                    <div class="mb-2">
                        <label class="fw-bold small text-muted mb-1"><i class="bi bi-calendar3 me-1"></i>${t('docs_expiry_date')}</label>
                        <div class="d-flex gap-2">
                            <input type="date" id="expiry_${dt.key}" value="${doc.expiryDate||''}" dir="ltr"
                                class="form-control form-control-sm border shadow-sm" style="border-radius:10px;">
                            <button onclick="saveDocExpiry('${driverId}','${dt.key}')" class="btn btn-sm btn-outline-success fw-bold px-3" title="${t('docs_save_date')}">
                                <i class="bi bi-check2"></i>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label class="fw-bold small text-muted mb-1"><i class="bi bi-cloud-upload me-1"></i>${t('docs_upload_file')}</label>
                        <div class="d-flex gap-2">
                            <input type="file" id="file_${dt.key}" accept="application/pdf,image/*" style="display:none;"
                                onchange="uploadDriverDoc('${driverId}','${dt.key}',this)">
                            <button onclick="document.getElementById('file_${dt.key}').click()"
                                class="btn btn-sm fw-bold w-100 text-white" style="background:${dt.color}; border-radius:10px;">
                                <i class="bi bi-upload me-1"></i>${doc.url ? t('docs_replace_file') : t('docs_upload_btn')}
                            </button>
                        </div>
                        ${doc.uploadedAt ? `<small class="text-muted mt-1 d-block">${t('docs_last_upload')}: ${new Date(doc.uploadedAt).toLocaleDateString('ar-SA')}</small>` : ''}
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// --- رفع ملف إلى Firebase Storage ---
function uploadDriverDoc(driverId, docType, inputEl) {
    let file = inputEl.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert(t('docs_file_too_large'));

    let progressArea = document.getElementById('uploadProgressArea');
    let progressBar = document.getElementById('uploadProgressBar');
    let progressPct = document.getElementById('uploadProgressPct');
    let progressLabel = document.getElementById('uploadProgressLabel');
    if (progressArea) progressArea.style.display = '';

    let ext = file.name.split('.').pop();
    let fileName = `${docType}_${driverId}_${Date.now()}.${ext}`;
    let storageRef = storage.ref(`driver_docs/${driverId}/${docType}/${fileName}`);
    let uploadTask = storageRef.put(file);

    uploadTask.on('state_changed',
        snap => {
            let pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            if (progressBar) progressBar.style.width = pct + '%';
            if (progressPct) progressPct.textContent = pct + '%';
        },
        err => {
            if (progressArea) progressArea.style.display = 'none';
            console.error('upload error', err);
            alert(t('docs_upload_error') + ': ' + err.message);
        },
        () => {
            uploadTask.snapshot.ref.getDownloadURL().then(url => {
                let existing = (window.allDriverDocs[driverId] && window.allDriverDocs[driverId][docType]) || {};
                let docData = {
                    url,
                    fileName: file.name,
                    uploadedAt: new Date().toISOString(),
                    expiryDate: existing.expiryDate || ''
                };
                database.ref(`ninja_data/driver_docs/${driverId}/${docType}`).set(docData).then(() => {
                    if (progressArea) progressArea.style.display = 'none';
                    if (!window.allDriverDocs[driverId]) window.allDriverDocs[driverId] = {};
                    window.allDriverDocs[driverId][docType] = docData;
                    renderDocCards(driverId, window.allDriverDocs[driverId]);
                    logAudit('رفع وثيقة', driverId, `${docType} — ${file.name}`);
                });
            });
        }
    );
    inputEl.value = '';
}

// --- حفظ تاريخ الانتهاء فقط ---
function saveDocExpiry(driverId, docType) {
    let dateVal = document.getElementById('expiry_' + docType);
    if (!dateVal) return;
    let date = dateVal.value;
    let existing = (window.allDriverDocs[driverId] && window.allDriverDocs[driverId][docType]) || {};
    let docData = Object.assign({}, existing, { expiryDate: date });
    database.ref(`ninja_data/driver_docs/${driverId}/${docType}`).set(docData).then(() => {
        if (!window.allDriverDocs[driverId]) window.allDriverDocs[driverId] = {};
        window.allDriverDocs[driverId][docType] = docData;
        renderDocCards(driverId, window.allDriverDocs[driverId]);
        logAudit('تحديث تاريخ وثيقة', driverId, `${docType} — ${date}`);
    });
}

// --- معاينة الملف ---
function viewDoc(url, fileName) {
    if (!url) return;
    let frame = document.getElementById('docViewerFrame');
    let title = document.getElementById('docViewerTitle');
    if (frame) frame.src = url;
    if (title) title.innerHTML = `<i class="bi bi-eye-fill me-2"></i>${fileName || ''}`;
    new bootstrap.Modal(document.getElementById('docViewerModal')).show();
}

// --- تحميل ملف واحد ---
async function downloadDoc(url, fileName) {
    if (!url) return;
    try {
        let response = await fetch(url);
        let blob = await response.blob();
        let blobUrl = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    } catch(e) {
        window.open(url, '_blank');
    }
}

// --- تحميل كل وثائق مندوب واحد (ZIP) ---
async function downloadAllDocs(driverId) {
    if (!driverId) return;
    let docs = window.allDriverDocs[driverId] || {};
    let acc = (window.allRawAccounts || []).find(a => a && String(a.id) === String(driverId));
    let driverName = acc ? (acc.ownerName || acc.actualUserName || driverId) : driverId;

    let available = DOC_TYPES.filter(dt => docs[dt.key] && docs[dt.key].url);
    if (available.length === 0) return alert(t('docs_no_files_to_download'));

    let btn = document.querySelector('#driverDocsModal .modal-footer button:first-child');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${t('docs_downloading')}`; }

    try {
        let zip = new JSZip();
        let folder = zip.folder(driverName);
        await Promise.all(available.map(async dt => {
            let doc = docs[dt.key];
            try {
                let res = await fetch(doc.url);
                let blob = await res.blob();
                let ext = doc.fileName ? doc.fileName.split('.').pop() : (blob.type.includes('pdf') ? 'pdf' : 'jpg');
                folder.file(`${dt.label}.${ext}`, blob);
            } catch(e) {
                console.warn('skip doc', dt.key, e);
            }
        }));
        let content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        saveAs(content, `${driverName}_وثائق.zip`);
        logAudit('تحميل ZIP', driverId, `تم تحميل ${available.length} وثيقة`);
    } catch(e) {
        alert(t('docs_download_error') + ': ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-download me-2"></i>${t('docs_download_all')}`; }
    }
}

// --- تصدير حالة الوثائق إلى Excel ---
function exportDriverDocs() {
    let accounts = window.allRawAccounts || [];
    if (accounts.length === 0) return alert(t('no_data_export'));
    let data = accounts.map(acc => {
        let docs = window.allDriverDocs[acc.id] || {};
        let row = { [t('docs_th_driver')]: acc.ownerName, [t('hr_th_contact')]: acc.actualUserName, 'المنصة': acc.platform || 'ninja' };
        DOC_TYPES.forEach(dt => {
            let doc = docs[dt.key] || {};
            row[dt.label + ' - تاريخ الانتهاء'] = doc.expiryDate || '—';
            row[dt.label + ' - الحالة'] = {missing:'غير مرفوعة', expired:'منتهية', expiring:'قرب الانتهاء', valid:'سارية', no_expiry:'مرفوعة'}[getDocStatus(doc)] || '—';
        });
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Driver_Docs"); XLSX.writeFile(wb, `DRIVER_DOCS_${getTodayStr()}.xlsx`);
    logAudit('تصدير وثائق المناديب', 'hr', 'تم تصدير تقرير وثائق المناديب');
}