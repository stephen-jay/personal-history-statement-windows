function $(id) {
  return document.getElementById(id);
}

function setError(message) {
  var el = $('login-error');
  if (el) el.textContent = message || '';
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

  window.authApi.login(username, password).then(function () {
    window.location.href = 'index.html';
  }).catch(function (err) {
    var msg = err && err.message ? err.message : String(err);
    setError('Login failed.\n\n' + msg);
  });
}

var form = $('login-form');
var toggle = $('toggle-password');
if (form) form.addEventListener('submit', submitLogin);
if (toggle) toggle.addEventListener('click', togglePasswordVisibility);
