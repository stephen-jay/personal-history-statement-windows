function $(id) {
  return document.getElementById(id);
}

function setError(message) {
  var el = $('login-error');
  if (el) el.textContent = message || '';
}

function setCardMessage(message) {
  var el = $('card-login-message');
  if (el) el.textContent = message || '';
}

var MAX_FAILED_ATTEMPTS = 5;
var LOCKOUT_SECONDS = 60;
var LOGIN_ATTEMPT_KEY = 'phs.loginAttempts.v1';
var lockoutTimer = null;

// Feature flag for progressive rollout
var USE_PASSWORDLESS_FLOW = true;

// State Machine Variables
var currentChallengeId = null;
var cardTapListenerActive = false;

function readAttemptState() {
  try {
    var raw = localStorage.getItem(LOGIN_ATTEMPT_KEY);
    if (!raw) return { failed: 0, lockUntil: 0 };
    var parsed = JSON.parse(raw);
    return {
      failed: Number(parsed && parsed.failed) || 0,
      lockUntil: Number(parsed && parsed.lockUntil) || 0,
    };
  } catch (_) {
    return { failed: 0, lockUntil: 0 };
  }
}

function writeAttemptState(state) {
  try {
    localStorage.setItem(LOGIN_ATTEMPT_KEY, JSON.stringify({
      failed: Number(state && state.failed) || 0,
      lockUntil: Number(state && state.lockUntil) || 0,
    }));
  } catch (_) {}
}

function clearAttemptState() {
  writeAttemptState({ failed: 0, lockUntil: 0 });
}

function getLockRemainingSeconds() {
  var state = readAttemptState();
  var now = Date.now();
  if (!state.lockUntil || state.lockUntil <= now) return 0;
  return Math.ceil((state.lockUntil - now) / 1000);
}

function setLoginLocked(locked, secondsRemaining) {
  var submit = $('btn-verify-totp');
  var nextBtn = $('btn-next-username');
  var username = $('username-input');
  
  if (submit) {
    submit.disabled = !!locked;
    submit.innerHTML = locked ? ('TRY AGAIN IN ' + String(secondsRemaining) + 's') : 'Login <span>&rarr;</span>';
  }
  if (nextBtn) {
    nextBtn.disabled = !!locked;
    nextBtn.innerHTML = locked ? ('TRY AGAIN IN ' + String(secondsRemaining) + 's') : 'Next <span>&rarr;</span>';
  }
  if (username) username.disabled = !!locked;
}

function refreshLockoutUi() {
  var remaining = getLockRemainingSeconds();
  if (remaining > 0) {
    setLoginLocked(true, remaining);
    setError('Too many failed attempts. Please wait ' + String(remaining) + 's.');
    return true;
  }
  setLoginLocked(false, 0);
  return false;
}

function startLockoutCountdown() {
  if (lockoutTimer) {
    clearInterval(lockoutTimer);
    lockoutTimer = null;
  }
  refreshLockoutUi();
  lockoutTimer = setInterval(function () {
    var locked = refreshLockoutUi();
    if (!locked && lockoutTimer) {
      clearInterval(lockoutTimer);
      lockoutTimer = null;
      setError('');
      clearAttemptState();
    }
  }, 1000);
}

function registerFailedAttempt() {
  var state = readAttemptState();
  var nextFailed = (Number(state.failed) || 0) + 1;
  if (nextFailed >= MAX_FAILED_ATTEMPTS) {
    var until = Date.now() + LOCKOUT_SECONDS * 1000;
    writeAttemptState({ failed: 0, lockUntil: until });
    startLockoutCountdown();
    return;
  }
  writeAttemptState({ failed: nextFailed, lockUntil: 0 });
}

function mapLoginError(err) {
  var msg = String((err && err.message) || err || '').trim();
  if (!msg) return 'Login failed. Please try again.';

  var lower = msg.toLowerCase();
  if (lower.includes('invalid credentials')) return 'Invalid username or password.';
  if (lower.includes('user not found')) return 'User not found.';
  if (lower.includes('user account is disabled')) return 'User account is disabled.';
  if (lower.includes('card not recognized') || lower.includes('not assigned to this user')) return 'Card not recognized or not assigned to this user.';
  if (lower.includes('invalid or expired otp')) return 'Invalid or expired OTP code.';
  if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('econnrefused')) return 'Cannot reach the server. Check API status and network connection.';
  
  return 'Error: ' + msg;
}

// --- UI View Management ---

function updateStepper(stepNumber) {
  var steps = document.querySelectorAll('.stepper .step');
  var lines = document.querySelectorAll('.stepper .step-line');
  
  steps.forEach(function(s, idx) {
    var sNum = idx + 1;
    s.classList.remove('active', 'completed', 'pending');
    if (sNum < stepNumber) {
      s.classList.add('completed');
      var circle = s.querySelector('.step-circle');
      if (circle) circle.textContent = '✓';
    } else if (sNum === stepNumber) {
      s.classList.add('active');
      var circle = s.querySelector('.step-circle');
      if (circle) circle.textContent = String(sNum);
    } else {
      s.classList.add('pending');
      var circle = s.querySelector('.step-circle');
      if (circle) circle.textContent = String(sNum);
    }
  });

  lines.forEach(function(l, idx) {
    if (idx + 1 < stepNumber) {
      l.classList.add('filled');
    } else {
      l.classList.remove('filled');
    }
  });
}

function hideAllSteps() {
  var contents = document.querySelectorAll('.step-content');
  contents.forEach(function(el) {
    el.hidden = true;
    el.classList.remove('visible');
  });
  setError('');
  setCardMessage('');
}

function showStep(stepId) {
  hideAllSteps();
  var el = $(stepId);
  if (el) {
    el.hidden = false;
    // Trigger animation reflow
    void el.offsetWidth;
    el.classList.add('visible');
  }

  // Update Stepper
  if (stepId === 'step-username') updateStepper(1);
  else if (stepId === 'step-card') updateStepper(2);
  else if (stepId === 'step-verify' || stepId === 'step-enroll') updateStepper(3);
}

function resetToStart() {
  currentChallengeId = null;
  stopCardTapListening();
  
  var qrImg = $('totp-qr');
  var secretTxt = $('totp-secret-text');
  var enrollOtp = $('enroll-otp');
  var verifyOtp = $('verify-otp');
  
  if (qrImg) qrImg.src = '';
  if (secretTxt) secretTxt.textContent = '';
  if (enrollOtp) enrollOtp.value = '';
  if (verifyOtp) verifyOtp.value = '';
  
  // Clear OTP boxes
  document.querySelectorAll('.otp-box, .otp-box-enroll').forEach(function(box) {
    box.value = '';
  });

  currentChallengeId = null;
  showStep('step-username');
  var un = $('username-input');
  if (un) { un.value = ''; un.focus(); }
}

function stopCardTapListening() {
  cardTapListenerActive = false;
  if (window.cardApi && typeof window.cardApi.offCardDetected === 'function') {
    try { window.cardApi.offCardDetected(); } catch (_) {}
  }
}

// --- OTP Box Logic ---

function setupOtpBoxes(rowId, hiddenInputId) {
  // Selector fixed to ONLY pick up visual boxes, NOT the hidden input field
  var boxes = document.querySelectorAll('#' + rowId + ' .otp-box, #' + rowId + ' .otp-box-enroll');
  var hiddenInput = $(hiddenInputId);

  boxes.forEach(function(box, idx) {
    box.addEventListener('input', function(e) {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
      var val = e.target.value;
      if (val && val.length > 0) {
        // Only allow one digit
        if (val.length > 1) {
          e.target.value = val.slice(-1);
        }
        // Move to next box
        if (idx < boxes.length - 1) {
          boxes[idx + 1].focus();
        }
      }
      updateHiddenOtp();
      
      // Auto-submit when all 6 digits are filled
      var combined = '';
      boxes.forEach(function(b) { combined += b.value; });
      if (combined.length === 6) {
        setTimeout(function() {
          var form = $('login-form');
          if (form) form.dispatchEvent(new Event('submit'));
        }, 100);
      }
    });

    box.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        boxes[idx - 1].focus();
      }
    });

    box.addEventListener('paste', function(e) {
      e.preventDefault();
      var data = e.clipboardData.getData('text').trim();
      if (/^\d{6}$/.test(data)) {
        for (var i = 0; i < boxes.length; i++) {
          if (boxes[i]) boxes[i].value = data[i];
        }
        updateHiddenOtp();
        if (boxes[boxes.length - 1]) boxes[boxes.length - 1].focus();
        
        // Auto-submit after paste of 6-digit code
        setTimeout(function() {
          var form = $('login-form');
          if (form) form.dispatchEvent(new Event('submit'));
        }, 100);
      }
    });
  });

  function updateHiddenOtp() {
    var combined = '';
    boxes.forEach(function(b) { combined += b.value; });
    hiddenInput.value = combined;
  }
}

// --- Action Handlers ---

async function handleNextUsername() {
  if (refreshLockoutUi()) return;
  var usernameInput = $('username-input');
  var username = (usernameInput && usernameInput.value || '').trim();
  if (!username) {
    setError('Please enter a username.');
    return;
  }

  var btn = $('btn-next-username');
  btn.disabled = true;
  btn.innerHTML = 'Checking...';
  setError('');

  try {
    var res = await window.authApi.beginLogin(username);
    if (!res || !res.challengeId) throw new Error('Failed to start login challenge.');
    currentChallengeId = res.challengeId;
    
    showStep('step-card');
    startCardTapListening();
  } catch (err) {
    if (String((err && err.message) || '').toLowerCase().includes('user not found')) {
        registerFailedAttempt();
    }
    setError(mapLoginError(err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Next <span>&rarr;</span>';
  }
}

async function handleCardTap(payload) {
  if (!currentChallengeId) return;
  
  var uid = '';
  if (payload && typeof payload === 'object') {
    uid = String(payload.card_id || payload.cardUID || payload.cardUid || '').trim();
  } else {
    uid = String(payload || '').trim();
  }
  if (!uid) return;

  setCardMessage('Verifying card...');

  try {
    var res = await window.authApi.verifyCardStep(currentChallengeId, uid);
    if (!res) throw new Error('No response from card verification.');

    if (res.status === 'pending_totp') {
      showStep('step-verify');
      var firstBox = document.querySelector('.otp-box');
      if (firstBox) firstBox.focus();
    } else if (res.status === 'pending_enrollment') {
      setCardMessage('Loading enrollment...');
      var enrollRes = await window.authApi.enrollTotp(currentChallengeId);
      if (!enrollRes || !enrollRes.secret) throw new Error('Failed to generate TOTP secret.');
      
      var qrImg = $('totp-qr');
      var secretTxt = $('totp-secret-text');
      if (qrImg) qrImg.src = enrollRes.qrCodeDataUrl;
      if (secretTxt) secretTxt.textContent = enrollRes.secret;
      
      showStep('step-enroll');
      var firstEnrollBox = document.querySelector('.otp-box-enroll');
      if (firstEnrollBox) firstEnrollBox.focus();
    } else {
      throw new Error('Unexpected authentication state.');
    }
  } catch (err) {
    registerFailedAttempt();
    setCardMessage(mapLoginError(err));
  }
}

async function handleVerifyTotp(inputId, btnId) {
  if (refreshLockoutUi()) return;
  if (!currentChallengeId) {
    resetToStart();
    return;
  }
  
  var otp = ($(inputId) && $(inputId).value || '').trim();
  if (!otp || otp.length < 6) {
    setError('Please enter a valid 6-digit code.');
    return;
  }

  var btn = $(btnId);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Verifying...';
  }
  setError('');

  try {
    var session = await window.authApi.verifyTotp(currentChallengeId, otp);
    if (!session) throw new Error('Session not created.');
    
    clearAttemptState();
    window.location.href = 'index.html';
  } catch (err) {
    registerFailedAttempt();
    setError(mapLoginError(err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = (inputId === 'enroll-otp' ? 'Verify & Login' : 'Login') + ' <span>&rarr;</span>';
    }
  }
}

function startCardTapListening() {
  if (cardTapListenerActive) return;
  if (!window.cardApi || typeof window.cardApi.onCardDetected !== 'function') return;
  cardTapListenerActive = true;
  window.cardApi.onCardDetected(function (payload) {
    if (!cardTapListenerActive || !currentChallengeId) return;
    handleCardTap(payload);
  });
}

// --- Initialization ---

function copySecretToClipboard() {
  var secretEl = $('totp-secret-text');
  if (!secretEl) return;
  var text = secretEl.textContent || '';
  if (!text) return;
  try {
    navigator.clipboard.writeText(text);
    setCardMessage('TOTP secret copied to clipboard.');
    setTimeout(function () { setCardMessage(''); }, 2500);
  } catch (e) {
    setCardMessage('Unable to copy secret.');
    setTimeout(function () { setCardMessage(''); }, 2500);
  }
}

function initListeners() {
  var loginForm = $('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var unDiv = $('step-username');
      var enrollDiv = $('step-enroll');
      var verifyDiv = $('step-verify');
      
      if (unDiv && !unDiv.hidden) {
        handleNextUsername();
      } else if (enrollDiv && !enrollDiv.hidden) {
        handleVerifyTotp('enroll-otp', 'btn-verify-enroll');
      } else if (verifyDiv && !verifyDiv.hidden) {
        handleVerifyTotp('verify-otp', 'btn-verify-totp');
      }
    });
  }
  
  if ($('btn-next-username')) $('btn-next-username').addEventListener('click', handleNextUsername);
  if ($('btn-cancel-card')) $('btn-cancel-card').addEventListener('click', resetToStart);
  if ($('btn-cancel-enroll')) $('btn-cancel-enroll').addEventListener('click', resetToStart);
  if ($('btn-cancel-totp')) $('btn-cancel-totp').addEventListener('click', resetToStart);
  
  if ($('btn-verify-totp')) $('btn-verify-totp').addEventListener('click', function() {
    handleVerifyTotp('verify-otp', 'btn-verify-totp');
  });
  if ($('btn-verify-enroll')) $('btn-verify-enroll').addEventListener('click', function() {
    handleVerifyTotp('enroll-otp', 'btn-verify-enroll');
  });
  
  // OTP Box setups
  setupOtpBoxes('step-verify', 'verify-otp');
  setupOtpBoxes('step-enroll', 'enroll-otp');

  if (getLockRemainingSeconds() > 0) startLockoutCountdown();

  if ($('btn-copy-secret')) {
    $('btn-copy-secret').addEventListener('click', copySecretToClipboard);
  }

  resetToStart();
}

initListeners();
