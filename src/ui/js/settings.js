export function initSettingsView(options) {
  const opts = options || {};
  const settingsViewEl = opts.settingsViewEl;
  if (!settingsViewEl) {
    return { showTab: function () {}, refreshVersion: async function () {} };
  }

  const toast = opts.toast || null;
  const updateApi = opts.updateApi || null;
  const appApi = opts.appApi || null;
  const authApi = opts.authApi || null;

  const tabButtons = Array.from(settingsViewEl.querySelectorAll('[data-settings-tab]'));
  const panels = Array.from(settingsViewEl.querySelectorAll('[data-settings-panel]'));

  function showTab(name) {
    tabButtons.forEach(function (btn) {
      const active = btn.getAttribute('data-settings-tab') === name;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      const active = panel.getAttribute('data-settings-panel') === name;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      showTab(btn.getAttribute('data-settings-tab'));
    });
  });

  const versionChip = settingsViewEl.querySelector('#settings-version-chip');
  const currentVersionEl = settingsViewEl.querySelector('#settings-current-version');
  const infoVersionEl = settingsViewEl.querySelector('#settings-info-version');
  const releaseNotesLabelEl = settingsViewEl.querySelector('#settings-release-notes-label');
  const statusEl = settingsViewEl.querySelector('#settings-version-status');

  async function refreshVersion() {
    let version = null;
    try {
      if (appApi && typeof appApi.getVersion === 'function') {
        version = await appApi.getVersion();
      }
    } catch (_) {
      version = null;
    }

    const label = version ? ('v' + version) : 'v-';
    if (versionChip) versionChip.textContent = label;
    if (currentVersionEl) currentVersionEl.textContent = label;
    if (infoVersionEl) infoVersionEl.textContent = label;
    if (releaseNotesLabelEl) releaseNotesLabelEl.textContent = version ? ('See what changed in v' + version) : 'See what changed';
  }

  const checkBtn = settingsViewEl.querySelector('#settings-check-updates-btn');
  function setStatus(text, ok) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = ok ? '#0d9488' : '#b91c1c';
  }

  if (checkBtn) {
    checkBtn.addEventListener('click', async function () {
      if (!updateApi || typeof updateApi.checkForUpdates !== 'function') {
        setStatus('Updater unavailable', false);
        if (toast && toast.info) toast.info('Updater is available only in installed builds.');
        return;
      }
      checkBtn.disabled = true;
      const prior = checkBtn.textContent;
      checkBtn.textContent = 'Checking...';
      try {
        const res = await updateApi.checkForUpdates();
        if (res && res.ok) {
          setStatus('Checking...', true);
        } else {
          setStatus('Check failed', false);
          if (toast && toast.error) toast.error('Update check failed: ' + (res && res.error ? res.error : 'unknown error'));
        }
      } catch (e) {
        setStatus('Check failed', false);
        if (toast && toast.error) toast.error('Update check failed.');
      } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = prior;
      }
    });
  }

  try {
    if (updateApi) {
      if (typeof updateApi.onUpdateAvailable === 'function') {
        updateApi.onUpdateAvailable(function (info) {
          setStatus('Update available', true);
          if (info && info.version && currentVersionEl) {
            currentVersionEl.textContent = 'v' + info.version;
          }
        });
      }
      if (typeof updateApi.onUpdateNotAvailable === 'function') {
        updateApi.onUpdateNotAvailable(function () {
          setStatus('Up to date', true);
        });
      }
      if (typeof updateApi.onUpdateError === 'function') {
        updateApi.onUpdateError(function (payload) {
          setStatus('Update error', false);
          if (toast && toast.error) {
            const message = payload && payload.message ? payload.message : 'Unknown updater error';
            toast.error('Updater error: ' + message);
          }
        });
      }
    }
  } catch (_) {}

  const securityForm = settingsViewEl.querySelector('#settings-security-form');
  const currentPasswordInput = settingsViewEl.querySelector('#settings-current-password');
  const newPasswordInput = settingsViewEl.querySelector('#settings-new-password');
  const confirmPasswordInput = settingsViewEl.querySelector('#settings-confirm-password');
  const securityCancelBtn = settingsViewEl.querySelector('#settings-security-cancel');
  const securitySaveBtn = settingsViewEl.querySelector('#settings-security-save');

  function clearSecurityForm() {
    if (currentPasswordInput) currentPasswordInput.value = '';
    if (newPasswordInput) newPasswordInput.value = '';
    if (confirmPasswordInput) confirmPasswordInput.value = '';
  }

  if (securityCancelBtn) {
    securityCancelBtn.addEventListener('click', function () {
      clearSecurityForm();
    });
  }

  if (securityForm) {
    securityForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const currentPassword = currentPasswordInput ? String(currentPasswordInput.value || '') : '';
      const newPassword = newPasswordInput ? String(newPasswordInput.value || '') : '';
      const confirmPassword = confirmPasswordInput ? String(confirmPasswordInput.value || '') : '';

      if (!currentPassword || !newPassword || !confirmPassword) {
        if (toast && toast.warning) toast.warning('Please complete all password fields.');
        return;
      }
      if (newPassword.length < 8) {
        if (toast && toast.warning) toast.warning('New password must be at least 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        if (toast && toast.warning) toast.warning('New password and confirmation do not match.');
        return;
      }
      if (!authApi || typeof authApi.changePassword !== 'function') {
        if (toast && toast.error) toast.error('Password change is unavailable in this build.');
        return;
      }

      if (securitySaveBtn) securitySaveBtn.disabled = true;
      try {
        const res = await authApi.changePassword(currentPassword, newPassword);
        if (res && res.ok) {
          clearSecurityForm();
          if (toast && toast.success) toast.success('Password updated successfully.');
          return;
        }
        if (toast && toast.error) toast.error('Could not update password. Please try again.');
      } catch (e) {
        const message = e && e.message ? e.message : 'Password update failed.';
        if (toast && toast.error) toast.error(message);
      } finally {
        if (securitySaveBtn) securitySaveBtn.disabled = false;
      }
    });
  }

  showTab('system');
  refreshVersion();

  return { showTab, refreshVersion };
}
