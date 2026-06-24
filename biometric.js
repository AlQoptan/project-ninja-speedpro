// ==========================================================================
//  SpeedPro biometric login (WebAuthn platform authenticator).
//  Device-local convenience unlock: after a normal login the user enables
//  biometrics; the device credential then gates restoring the saved login
//  (username + password hash) and signing in. Requires HTTPS.
//  Loaded after app.js (uses checkLogin, window.loggedInUser, L).
// ==========================================================================
(function () {
  'use strict';

  const BIO_KEY = 'sp_bio';
  const tr = (ar, en) => (typeof L === 'function' ? L(ar, en) : ar);

  function _b64uEnc(buf) {
    const b = new Uint8Array(buf); let s = '';
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function _b64uDec(str) {
    str = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const s = atob(str); const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b.buffer;
  }
  function _rand(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; }
  function _getBio() { try { return JSON.parse(localStorage.getItem(BIO_KEY) || 'null'); } catch (e) { return null; } }

  async function bioSupported() {
    if (!window.PublicKeyCredential || !navigator.credentials) return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
    catch (e) { return false; }
  }
  window.bioSupported = bioSupported;

  // Enable biometric on this device for the currently logged-in user
  window.enableBiometric = async function () {
    const user = window.loggedInUser;
    const phash = sessionStorage.getItem('ninja_phash') || localStorage.getItem('ninja_phash');
    if (!user || !phash) { alert(tr('سجّل الدخول أولاً ثم فعّل البصمة', 'Log in first, then enable biometrics')); return; }
    if (!(await bioSupported())) { alert(tr('❌ هذا الجهاز لا يدعم البصمة', '❌ This device does not support biometrics')); return; }
    try {
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: _rand(32),
          rp: { id: location.hostname, name: 'SpeedPro' },
          user: { id: new TextEncoder().encode(user), name: user, displayName: user },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
          timeout: 60000, attestation: 'none'
        }
      });
      if (!cred) return;
      localStorage.setItem(BIO_KEY, JSON.stringify({ user: user, phash: phash, credId: _b64uEnc(cred.rawId) }));
      if (typeof logAudit === 'function') logAudit('تعديل بيانات', user, 'فعّل الدخول بالبصمة');
      alert(tr('✅ تم تفعيل الدخول بالبصمة على هذا الجهاز', '✅ Biometric login enabled on this device'));
      _refreshBioUI();
    } catch (e) {
      console.warn('biometric enroll failed', e);
      if (e && e.name === 'NotAllowedError') return; // user cancelled / timed out
      let msg = tr('❌ تعذّر تفعيل البصمة', '❌ Could not enable biometrics');
      if (e && e.name === 'SecurityError') {
        msg = tr('❌ البصمة تحتاج فتح الموقع عبر https أو localhost — مش عنوان IP زي 127.0.0.1',
                 '❌ Biometrics require opening the site via https or localhost — not an IP like 127.0.0.1');
      }
      alert(msg + (e && e.name ? ' [' + e.name + ']' : ''));
    }
  };

  window.disableBiometric = function () {
    localStorage.removeItem(BIO_KEY);
    if (typeof logAudit === 'function' && window.loggedInUser) logAudit('تعديل بيانات', window.loggedInUser, 'ألغى الدخول بالبصمة');
    alert(tr('تم إلغاء بصمة هذا الجهاز', 'Biometric removed from this device'));
    _refreshBioUI();
  };

  // Login using the stored biometric credential
  window.loginWithBiometric = async function () {
    const bio = _getBio();
    if (!bio) return;
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: _rand(32),
          allowCredentials: [{ id: _b64uDec(bio.credId), type: 'public-key' }],
          userVerification: 'required', timeout: 60000
        }
      });
      if (!assertion) return;
      // biometric verified on this device → restore saved login and sign in
      const uf = document.getElementById('username'); if (uf) uf.value = bio.user;
      sessionStorage.setItem('ninja_user', bio.user);
      sessionStorage.setItem('ninja_phash', bio.phash);
      checkLogin(true);
    } catch (e) {
      console.warn('biometric login failed', e);
      if (e && e.name !== 'NotAllowedError') alert(tr('❌ فشل الدخول بالبصمة، استخدم كلمة المرور', '❌ Biometric login failed, use your password'));
    }
  };

  // Show/hide the enable/disable buttons inside the My Account modal
  window._refreshBioUI = async function () {
    const sec = document.getElementById('myAccBioSection');
    if (!sec) return;
    if (!(await bioSupported())) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    const bio = _getBio();
    const enabledForMe = bio && bio.user === window.loggedInUser;
    const en = document.getElementById('bioEnableBtn'); if (en) en.style.display = enabledForMe ? 'none' : '';
    const di = document.getElementById('bioDisableBtn'); if (di) di.style.display = enabledForMe ? '' : 'none';
  };

  // On the login screen, reveal the biometric button if a credential exists here
  document.addEventListener('DOMContentLoaded', async () => {
    const btn = document.getElementById('bioLoginBtn');
    if (btn && _getBio() && await bioSupported()) btn.style.display = '';
  });
})();
