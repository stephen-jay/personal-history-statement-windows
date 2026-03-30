function $(id) {
  return document.getElementById(id);
}

function setError(message) {
  var el = $('login-error');
  if (el) el.textContent = message || '';
}

var MAX_FAILED_ATTEMPTS = 5;
var LOCKOUT_SECONDS = 60;
var LOGIN_ATTEMPT_KEY = 'phs.loginAttempts.v1';
var lockoutTimer = null;

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

function setLoginLoading(isLoading) {
  var submit = $('sign-in');
  if (!submit) return;
  submit.disabled = !!isLoading;
  submit.textContent = isLoading ? 'LOGGING IN...' : 'LOGIN';
}

function setLoginLocked(locked, secondsRemaining) {
  var submit = $('sign-in');
  var username = $('username');
  var password = $('password');
  if (submit) {
    submit.disabled = !!locked;
    submit.textContent = locked ? ('TRY AGAIN IN ' + String(secondsRemaining) + 's') : 'LOGIN';
  }
  if (username) username.disabled = !!locked;
  if (password) password.disabled = !!locked;
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

function mapLoginError(err) {
  var msg = String((err && err.message) || err || '').trim();
  if (!msg) return 'Login failed. Please try again.';

  var lower = msg.toLowerCase();
  if (lower.includes('invalid credentials')) {
    return 'Invalid username or password.';
  }
  if (lower.includes('missing bearer token') || lower.includes('invalid token')) {
    return 'Session error. Please try logging in again.';
  }
  if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('econnrefused')) {
    return 'Cannot reach the server. Check API status and network connection.';
  }
  if (lower.includes('auth_secret not configured')) {
    return 'Server auth is not configured. Contact your administrator.';
  }
  if (lower.includes('password authentication failed for user "apollo_app"')) {
    return 'Database connection failed on server. Verify DATABASE_URL credentials.';
  }
  if (lower.includes('permission denied for table')) {
    return 'Server database permissions are incomplete. Contact your administrator.';
  }
  if (lower.includes('invalid url')) {
    return 'Server URL configuration is invalid. Check API environment settings.';
  }
  return 'Login failed: ' + msg;
}

function isInvalidCredentialError(err) {
  var msg = String((err && err.message) || err || '').toLowerCase();
  return msg.includes('invalid credentials');
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

function togglePasswordVisibility() {
  var pwd = $('password');
  var btn = $('toggle-password');
  if (!pwd || !btn) return;
  var show = pwd.type === 'password';
  pwd.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', show ? 'true' : 'false');
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  btn.dataset.visible = show ? '1' : '0';
}

function submitLogin(event) {
  event.preventDefault();
  if (refreshLockoutUi()) return;
  var username = ($('username') && $('username').value || '').trim();
  var password = ($('password') && $('password').value || '').trim();

  if (!username || !password) {
    setError('Please enter both username and password.');
    return;
  }

  setError('');

  if (!window.authApi || typeof window.authApi.login !== 'function') {
    setError('Authentication is not available. Restart the application.');
    return;
  }

  setLoginLoading(true);
  window.authApi.login(username, password).then(function () {
    clearAttemptState();
    window.location.href = 'index.html';
  }).catch(function (err) {
    if (isInvalidCredentialError(err)) {
      registerFailedAttempt();
    }
    setError(mapLoginError(err));
  }).finally(function () {
    if (!refreshLockoutUi()) setLoginLoading(false);
  });
}

var form = $('login-form');
var toggle = $('toggle-password');
if (form) form.addEventListener('submit', submitLogin);
if (toggle) toggle.addEventListener('click', togglePasswordVisibility);
if (getLockRemainingSeconds() > 0) startLockoutCountdown();
