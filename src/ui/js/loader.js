/**
 * Simple global loader utility
 */
function getLoaderEl() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('global-loader');
}

function setMessage(msg) {
  const loader = getLoaderEl();
  if (!loader) return;
  const m = loader.querySelector('.global-loader__message');
  if (m) m.textContent = String(msg || 'Fetching data…');
}

function show(msg) {
  let loader = getLoaderEl();
  if (!loader) {
    // Create loader markup dynamically as a fallback
    try {
      loader = document.createElement('div');
      loader.id = 'global-loader';
      loader.className = 'global-loader';
      loader.setAttribute('aria-hidden', 'true');
      loader.setAttribute('role', 'status');
      loader.innerHTML = '<div class="global-loader__backdrop" aria-hidden="true"></div>' +
                         '<div class="global-loader__panel"><div class="global-loader__spinner" aria-hidden="true"></div>' +
                         '<div class="global-loader__message">Fetching data…</div></div>';
      document.body.appendChild(loader);
    } catch (e) {
      try { console.warn('Failed creating global loader element:', e && e.message); } catch (_) {}
      return;
    }
  }
  setMessage(msg);
  loader.setAttribute('aria-hidden', 'false');
  try {
    // Ensure visibility even if CSS hasn't loaded or is overridden
    loader.style.display = 'flex';
    loader.style.alignItems = 'center';
    loader.style.justifyContent = 'center';
    loader.style.position = 'fixed';
    loader.style.inset = '0';
    loader.style.zIndex = '12000';
  } catch (_) {}
}

function hide() {
  const loader = getLoaderEl();
  if (!loader) return;
  loader.setAttribute('aria-hidden', 'true');
  try {
    loader.style.display = 'none';
  } catch (_) {}
}

export { show, hide, setMessage };
