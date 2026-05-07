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

  // ── Changelog Modal ────────────────────────────────────────────────
  const changelogModal = document.getElementById('changelog-modal');
  const changelogBackdrop = document.getElementById('changelog-backdrop');
  const changelogCloseBtn = document.getElementById('changelog-close-btn');
  const changelogCloseXBtn = document.getElementById('changelog-close');
  const changelogContent = document.getElementById('changelog-content');
  const releaseNotesLink = settingsViewEl.querySelector('#settings-release-notes-link');

  function openChangelogModal() {
    if (changelogModal) {
      changelogModal.setAttribute('aria-hidden', 'false');
      changelogModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeChangelogModal() {
    if (changelogModal) {
      changelogModal.setAttribute('aria-hidden', 'true');
      changelogModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  async function fetchLatestRelease() {
    try {
      const response = await fetch('https://api.github.com/repos/stephen-jay/personal-history-statement-windows/releases/latest');
      if (!response.ok) throw new Error('Failed to fetch release');
      const release = await response.json();
      return release;
    } catch (err) {
      console.error('Failed to fetch latest release:', err);
      return null;
    }
  }

  function formatReleaseMarkdown(markdown) {
    // Simple markdown to HTML conversion
    let html = markdown
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return html;
  }

  if (releaseNotesLink) {
    releaseNotesLink.addEventListener('click', async function (e) {
      e.preventDefault();
      openChangelogModal();
      
      // Show loading state
      if (changelogContent) {
        changelogContent.innerHTML = '<div style="text-align: center; padding: 40px;"><p>Loading release notes...</p></div>';
      }

      const release = await fetchLatestRelease();
      if (!release || !changelogContent) {
        if (changelogContent) {
          changelogContent.innerHTML = '<div style="text-align: center; padding: 40px; color: #ef4444;"><p>Failed to load release notes. Please try again.</p></div>';
        }
        return;
      }

      // Format the release notes HTML
      let html = '';
      html += '<div class="changelog-item">';
      html += '<div class="changelog-header-version">';
      html += '<h3>' + (release.name || release.tag_name || 'Release') + '</h3>';
      html += '<p class="changelog-date">' + new Date(release.published_at).toLocaleDateString() + '</p>';
      html += '</div>';
      
      if (release.body) {
        html += '<div class="changelog-body">';
        html += formatReleaseMarkdown(release.body);
        html += '</div>';
      } else {
        html += '<p style="color: #94a3b8;">No release notes provided.</p>';
      }
      
      html += '</div>';
      if (changelogContent) {
        changelogContent.innerHTML = html;
      }
    });
  }

  if (changelogCloseBtn) {
    changelogCloseBtn.addEventListener('click', closeChangelogModal);
  }

  if (changelogCloseXBtn) {
    changelogCloseXBtn.addEventListener('click', closeChangelogModal);
  }

  if (changelogBackdrop) {
    changelogBackdrop.addEventListener('click', closeChangelogModal);
  }

  showTab('system');
  refreshVersion();

  return { showTab, refreshVersion };
}
