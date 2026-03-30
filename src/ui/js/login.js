function $(id) {
  return document.getElementById(id);
}

function setError(message) {
  var el = $('login-error');
  if (el) el.textContent = message || '';
}

function setLoginLoading(isLoading) {
  var submit = $('sign-in');
  if (!submit) return;
  submit.disabled = !!isLoading;
  submit.textContent = isLoading ? 'LOGGING IN...' : 'LOGIN';
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
    window.location.href = 'index.html';
  }).catch(function (err) {
    setError(mapLoginError(err));
  }).finally(function () {
    setLoginLoading(false);
  });
}

var form = $('login-form');
var toggle = $('toggle-password');
if (form) form.addEventListener('submit', submitLogin);
if (toggle) toggle.addEventListener('click', togglePasswordVisibility);
