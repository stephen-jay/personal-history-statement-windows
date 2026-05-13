let postSaveModalState = null;

function escapePostSaveHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizePostSaveText(value) {
  return String(value == null ? '' : value).trim();
}

function stripPostSaveDiacritics(value) {
  const input = normalizePostSaveText(value);
  if (!input) return '';
  try {
    return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (_) {
    return input;
  }
}

function getPostSaveFullName(savedRecord) {
  const record = savedRecord && typeof savedRecord === 'object' ? savedRecord : {};
  const directName = normalizePostSaveText(record.fullName || record.full_name || record.name);
  if (directName) return directName;

  const first = normalizePostSaveText(record.nameFirst || record.firstName || record.firstname);
  const middle = normalizePostSaveText(record.nameMiddle || record.middleName || record.middlename);
  const last = normalizePostSaveText(record.nameLast || record.lastName || record.lastname || record.surname);
  const given = [first, middle].filter(Boolean).join(' ');
  if (last && given) return last + ', ' + given;
  return given || last || 'Personnel';
}

function getPostSavePosition(savedRecord) {
  const record = savedRecord && typeof savedRecord === 'object' ? savedRecord : {};
  return normalizePostSaveText(record.position || record.presentJob || record.positionTitle || record.jobTitle || 'Position unavailable');
}

function getPostSaveOrganization(savedRecord) {
  const record = savedRecord && typeof savedRecord === 'object' ? savedRecord : {};
  return normalizePostSaveText(record.organization || record.office || record.department || record.agency || 'Organization unavailable');
}

function getPostSavePhotoUrl(savedRecord) {
  const record = savedRecord && typeof savedRecord === 'object' ? savedRecord : {};
  // Try multiple common fields and nested user/photo variants
  const candidates = [
    'photoDataUrl', 'photo_data_url', 'photoUrl', 'photo_url', 'photo', 'avatar'
  ];
  for (const key of candidates) {
    const val = record[key];
    if (val) return normalizePostSaveText(val);
  }
  // Check nested user object
  if (record.user && (record.user.photoDataUrl || record.user.photo_url || record.user.photo || record.user.avatar)) {
    return normalizePostSaveText(record.user.photoDataUrl || record.user.photo_url || record.user.photo || record.user.avatar);
  }
  return '';
}

function getPostSaveRoleLabel(role) {
  const normalized = normalizePostSaveText(role);
  if (!normalized) return 'Viewer';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function buildPostSaveUsername(savedRecord) {
  const record = savedRecord && typeof savedRecord === 'object' ? savedRecord : {};
  const existing = normalizePostSaveText(record.username || record.userName);
  if (existing) return existing;

  const first = normalizePostSaveText(record.nameFirst || record.firstName || record.firstname);
  const middle = normalizePostSaveText(record.nameMiddle || record.middleName || record.middlename);
  const last = normalizePostSaveText(record.nameLast || record.lastName || record.lastname || record.surname);
  if (first && last) {
    return stripPostSaveDiacritics(first.charAt(0) + last + (middle ? middle.replace(/\s+/g, '') : ''))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  const fullName = getPostSaveFullName(record);
  const commaParts = fullName.split(',').map(part => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const surname = stripPostSaveDiacritics(commaParts[0]).replace(/\s+/g, '');
    const given = stripPostSaveDiacritics(commaParts.slice(1).join(' ')).replace(/\s+/g, '');
    if (surname && given) {
      return (given.charAt(0) + surname).toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  }

  const spaceParts = stripPostSaveDiacritics(fullName).split(/\s+/).filter(Boolean);
  if (spaceParts.length >= 2) {
    const firstToken = spaceParts[0];
    const rest = spaceParts.slice(1).join('');
    return (firstToken.charAt(0) + rest).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  return 'personnel' + (record.id ? String(record.id).toLowerCase().replace(/[^a-z0-9]/g, '') : '');
}

function formatPostSaveDate(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return normalizePostSaveText(value);
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  } catch (_) {
    return date.toLocaleDateString();
  }
}

function getCardTypeLabel(card) {
  const record = card && typeof card === 'object' ? card : {};
  return normalizePostSaveText(record.card_type || record.cardType || record.type || 'Card');
}

function getCardUid(card) {
  const record = card && typeof card === 'object' ? card : {};
  return normalizePostSaveText(record.card_uid || record.cardUid || record.uid || record.id);
}

function createPostSaveModalShell() {
  if (postSaveModalState && (!postSaveModalState.modalEl || !document.body.contains(postSaveModalState.modalEl))) {
    postSaveModalState = null;
  }

  const existingModals = Array.from(document.querySelectorAll('.post-save-modal'));
  if (existingModals.length > 1) {
    existingModals.forEach((el) => {
      if (!postSaveModalState || el !== postSaveModalState.modalEl) {
        el.remove();
      }
    });
  }

  if (postSaveModalState && postSaveModalState.modalEl && document.body.contains(postSaveModalState.modalEl)) {
    return postSaveModalState;
  }

  const modalEl = document.createElement('div');
  modalEl.id = 'post-save-modal';
  modalEl.className = 'post-save-modal';
  modalEl.setAttribute('aria-hidden', 'true');
  modalEl.innerHTML = `
    <div class="post-save-modal__backdrop"></div>
    <div class="post-save-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="post-save-title" aria-describedby="post-save-subtitle">
      <div class="post-save-modal__header">
        <div class="post-save-modal__header-main">
          <div class="post-save-modal__eyebrow" id="post-save-eyebrow">STEP 1 OF 4 — Account Setup</div>
          <h2 class="post-save-modal__title" id="post-save-title">Create Username</h2>
          <p class="post-save-modal__subtitle" id="post-save-subtitle">Follow the steps to create a secure personal account.</p>
        </div>
        <button type="button" class="post-save-modal__close" data-post-save-close aria-label="Close">✕</button>
      </div>

      <div class="post-save-modal__stepper" aria-hidden="true">
        <div class="post-save-stepper__track"></div>
        <div class="post-save-stepper__step post-save-stepper__step--active" data-step-dot="1">
          <span class="post-save-stepper__circle">1</span>
          <span class="post-save-stepper__label">Account Setup</span>
        </div>
        <div class="post-save-stepper__step" data-step-dot="2">
          <span class="post-save-stepper__circle">2</span>
          <span class="post-save-stepper__label">Assign RFID Card</span>
        </div>
        <div class="post-save-stepper__step" data-step-dot="3">
          <span class="post-save-stepper__circle">3</span>
          <span class="post-save-stepper__label">Setup Authenticator</span>
        </div>
        <div class="post-save-stepper__step" data-step-dot="4">
          <span class="post-save-stepper__circle">✓</span>
          <span class="post-save-stepper__label">Complete</span>
        </div>
      </div>

      <div class="post-save-modal__body">

        <!-- STEP 1: Create Username -->
        <section class="post-save-panel psm-step1-layout" data-step-panel="1">
          <!-- LEFT: Personnel card -->
          <div class="psm-s1-left">
            <div class="psm-s1-avatar">
              <img class="psm-s1-avatar-img" alt="Profile photo" hidden />
              <svg class="psm-s1-avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="44" height="44"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/></svg>
            </div>
            <div class="psm-s1-name" id="psm-s1-name">—</div>
            <div class="psm-s1-position" id="psm-s1-position">—</div>
            <div class="psm-s1-dept" id="psm-s1-dept">—</div>
            <div class="psm-s1-divider"></div>
            <div class="psm-s1-info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16" class="psm-s1-info-icon"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke-linecap="round"/></svg>
              <div><div class="psm-s1-info-label">Organization</div><div class="psm-s1-info-value" id="psm-s1-org">—</div></div>
            </div>
            <div class="psm-s1-info-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16" class="psm-s1-info-icon"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div><div class="psm-s1-info-label">Role / Access Level</div><span class="psm-s1-role-badge" id="psm-s1-role-badge">To be assigned</span></div>
            </div>
          </div>
          <!-- RIGHT: Form -->
          <div class="psm-s1-right">
            <div class="post-save-field">
              <label for="post-save-username">Username</label>
              <div class="psm-input-wrap">
                <span class="psm-input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/></svg></span>
                <input id="post-save-username" type="text" autocomplete="username" spellcheck="false" class="psm-has-icon" />
                <span class="psm-avail-badge" id="post-save-username-status"></span>
              </div>
            </div>
            <div class="post-save-field-row">
              <div class="post-save-field">
                <label for="post-save-password">Password</label>
                <div class="psm-input-wrap">
                  <span class="psm-input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke-linecap="round"/></svg></span>
                  <input id="post-save-password" type="password" autocomplete="new-password" class="psm-has-icon psm-has-eye" />
                  <button type="button" class="psm-eye-btn" id="psm-pw-eye" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                </div>
              </div>
              <div class="post-save-field">
                <label for="post-save-confirm-password">Confirm Password</label>
                <div class="psm-input-wrap">
                  <span class="psm-input-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke-linecap="round"/></svg></span>
                  <input id="post-save-confirm-password" type="password" autocomplete="new-password" class="psm-has-icon psm-has-eye" />
                  <button type="button" class="psm-eye-btn" id="psm-cpw-eye" tabindex="-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                </div>
              </div>
            </div>
            <div class="psm-strength-row">
              <div class="psm-strength-segs">
                <div class="psm-strength-seg" id="psm-seg-1"></div>
                <div class="psm-strength-seg" id="psm-seg-2"></div>
                <div class="psm-strength-seg" id="psm-seg-3"></div>
                <div class="psm-strength-seg" id="psm-seg-4"></div>
              </div>
              <span class="psm-strength-text" id="post-save-strength-label"></span>
            </div>

            <div class="post-save-field">
              <label>Role / Access Level</label>
              <div class="psm-role-cards" role="radiogroup" aria-label="Role">
                <button type="button" class="psm-role-card" data-role-pill="Viewer">
                  <div class="psm-role-card__check"><svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="8" fill="#2563eb"/><path d="m5 8 2 2 4-4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                  <div class="psm-role-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="22" height="22"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke-linecap="round"/><circle cx="12" cy="12" r="3"/></svg></div>
                  <div class="psm-role-card__title">Viewer</div>
                  <div class="psm-role-card__desc">Can view records</div>
                </button>
                <button type="button" class="psm-role-card" data-role-pill="Encoder">
                  <div class="psm-role-card__check"><svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="8" fill="#2563eb"/><path d="m5 8 2 2 4-4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                  <div class="psm-role-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="22" height="22"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                  <div class="psm-role-card__title">Encoder</div>
                  <div class="psm-role-card__desc">Can encode records</div>
                </button>
                <button type="button" class="psm-role-card" data-role-pill="Admin">
                  <div class="psm-role-card__check"><svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="8" fill="#2563eb"/><path d="m5 8 2 2 4-4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                  <div class="psm-role-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="22" height="22"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                  <div class="psm-role-card__title">Admin</div>
                  <div class="psm-role-card__desc">Full system access</div>
                </button>
              </div>
            </div>
            <div class="post-save-error" data-step-error="1" aria-live="polite"></div>
          </div>
        </section>

        <!-- STEP 2: Assign RFID Card -->
        <section class="post-save-panel psm-step2-layout" data-step-panel="2" hidden>

          <!-- Personnel summary bar -->
          <div class="psm-s2-pers-bar">
            <div class="psm-s2-pers-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/></svg>
            </div>
            <div class="psm-s2-pers-main">
              <div class="psm-s2-pers-title">
                <span class="psm-s2-pers-username" id="psm-s2-username">—</span>
                <span class="psm-s2-pers-sep">·</span>
                <span class="psm-s2-pers-role" id="psm-s2-role-label">—</span>
              </div>
              <div class="psm-s2-pers-sub" id="psm-s2-fullname-org">—</div>
            </div>
            <div class="psm-s2-pers-divider"></div>
            <div class="psm-s2-pers-info-col">
              <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.8" width="15" height="15"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke-linecap="round"/></svg>
              <div><div class="psm-s2-pers-info-label">Organization</div><div class="psm-s2-pers-info-val" id="psm-s2-org">—</div></div>
            </div>
            <div class="psm-s2-pers-divider"></div>
            <div class="psm-s2-pers-info-col">
              <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.8" width="15" height="15"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div><div class="psm-s2-pers-info-label">Role / Access Level</div><span class="psm-s2-pers-role-badge" id="psm-s2-role-badge">—</span></div>
            </div>
          </div>

          <!-- Two-column body -->
          <div class="psm-s2-body">

            <!-- LEFT: Scan panel -->
            <div class="psm-s2-left">
              <div class="psm-s2-scan-header">
                <span class="psm-s2-scan-title">Scan RFID Card</span>
                <div class="psm-s2-reader-info-header">
                  <span class="psm-reader-dot psm-reader-dot--connected" id="psm-s2-reader-dot"></span>
                  <span class="psm-s2-reader-status-text" id="psm-s2-reader-label">Reader Status</span>
                  <span class="psm-s2-reader-connected" id="psm-s2-reader-connected">Connected</span>
                </div>
                <div class="psm-s2-reader-model" id="psm-s2-reader-model">ACR1252U-A1</div>
              </div>

              <!-- Scan zone (circle with card) -->
              <div class="psm-s2-scan-zone" id="post-save-scan-zone">
                <div class="psm-s2-scan-help">
                  <button type="button" class="psm-s2-scan-help-btn" id="psm-s2-open-tips-tooltip" aria-label="Scanning tips" title="Scanning tips">
                    <svg viewBox="0 0 20 20" fill="none" width="18" height="18"><circle cx="10" cy="10" r="9" fill="#2563eb"/><path d="M10 7v4m0 3h.01" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>
                  </button>
                  <div class="psm-s2-scan-help-tooltip" id="psm-s2-scan-help-tooltip" role="tooltip">
                    <div class="psm-s2-scan-help-tooltip__title">Scanning Tips</div>
                    <ul class="psm-s2-tips-list">
                      <li>Place the card flat on the reader</li>
                      <li>Hold the card steady until the system detects it</li>
                      <li>Do not remove the card while scanning</li>
                      <li>Make sure the card is new and not yet registered</li>
                    </ul>
                  </div>
                </div>
                <div class="psm-s2-scan-ring psm-s2-scan-ring--3"></div>
                <div class="psm-s2-scan-ring psm-s2-scan-ring--2"></div>
                <div class="psm-s2-scan-ring psm-s2-scan-ring--1"></div>
                <div class="psm-s2-card-graphic">
                  <div class="psm-s2-card-body">
                    <span class="psm-s2-card-label">RFID</span>
                    <div class="psm-s2-card-waves">
                      <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
                        <path d="M10 20a12 12 0 0 1 12-12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                        <path d="M10 20a7 7 0 0 1 7-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                        <path d="M10 20a2.5 2.5 0 0 1 2.5-2.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                        <circle cx="10" cy="20" r="2" fill="currentColor"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div class="psm-s2-scan-label">
                <div class="psm-s2-scan-title-text" id="post-save-scan-status-title">Ready to Scan</div>
                <div class="psm-s2-scan-sub-text" id="post-save-scan-status-sub">Tap an RFID/NFC card on the reader.<br>Make sure the card is new and not yet registered.</div>
              </div>

              <!-- Info table -->
              <table class="psm-s2-info-table">
                <tr><td>Scan Status</td><td id="psm-reader-scan-status"><span class="psm-s2-wait-dot"></span> Waiting for card...</td></tr>
                <tr><td>Last Scanned</td><td id="psm-reader-last-scanned">—</td></tr>
                <tr><td>Card Type</td><td id="psm-reader-card-type">—</td></tr>
                <tr><td>UID</td><td id="psm-reader-uid" class="psm-reader-uid">—</td></tr>
              </table>

            </div>

            <!-- RIGHT: Card picker -->
            <div class="psm-s2-right">
              <div class="psm-s2-cards-hd">Registered RFID Cards</div>

              <div class="psm-s2-search-row">
                <div class="psm-s2-search-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" width="15" height="15"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35" stroke-linecap="round"/></svg>
                  <input id="psm-rfid-search" type="text" placeholder="Search by UID..." autocomplete="off" spellcheck="false" />
                </div>
                <button class="psm-s2-filter-icon-btn" id="psm-rfid-filter-btn" title="Filter">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M3 6h18M7 12h10M11 18h2" stroke-linecap="round"/></svg>
                </button>
              </div>

              <div class="psm-s2-filter-tabs" role="tablist">
                <button class="psm-s2-filter-tab is-active" data-rfid-filter="all">All</button>
                <button class="psm-s2-filter-tab" data-rfid-filter="available">Available</button>
                <button class="psm-s2-filter-tab" data-rfid-filter="assigned">Assigned</button>
                <button class="psm-s2-filter-tab" data-rfid-filter="disabled">Disabled</button>
              </div>

              <div class="psm-s2-card-list" id="psm-rfid-card-list">
                <div class="psm-s2-cards-loading">Loading cards…</div>
              </div>

              <div class="psm-s2-pagination">
                <span class="psm-s2-page-info" id="psm-rfid-page-info">—</span>
                <div class="psm-s2-page-btns">
                  <button class="psm-s2-page-btn" id="psm-rfid-prev" disabled>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                  <button class="psm-s2-page-btn" id="psm-rfid-next" disabled>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                </div>
              </div>
            </div>

          </div><!-- /psm-s2-body -->

          <div class="post-save-error" data-step-error="2" aria-live="polite"></div>
        </section>


        <!-- STEP 3: Setup Authenticator -->
        <section class="post-save-panel" data-step-panel="3" hidden>
          <div class="post-save-totp-phases">
            <!-- Phase A -->
            <div class="post-save-totp-phase" id="psm-totp-phase-a">
              <div class="post-save-totp-phase-label">PHASE A — Link Authenticator</div>
              <div class="post-save-totp-body">
                <div class="post-save-totp-qr-wrap">
                  <div class="post-save-totp-qr-loading" id="psm-totp-qr-loading">Loading QR…</div>
                  <img id="psm-totp-qr-img" class="post-save-totp-qr" src="" alt="Authenticator QR code" hidden />
                </div>
                <div class="post-save-totp-steps">
                  <p class="post-save-totp-step-text">1. Scan this QR code</p>
                  <p class="post-save-totp-step-hint">Open Google Authenticator, Microsoft Authenticator, or similar app. Tap <strong>+</strong> and scan the code.</p>
                  <p class="post-save-totp-step-text" style="margin-top:10px">2. Or enter the setup key</p>
                  <div class="post-save-totp-key-wrap">
                    <code class="post-save-totp-key" id="psm-totp-key">—</code>
                    <button type="button" class="post-save-totp-copy" id="psm-totp-copy-btn" title="Copy key">Copy</button>
                  </div>
                  <p class="post-save-totp-step-text" style="margin-top:10px">3. Enter the 6-digit code</p>
                  <p class="post-save-totp-step-hint">Once linked, tap <strong>Verify &amp; Continue</strong> below.</p>
                </div>
              </div>
            </div>
            <!-- Phase B -->
            <div class="post-save-totp-phase" id="psm-totp-phase-b">
              <div class="post-save-totp-phase-label">PHASE B — Verify Code</div>
              <p class="post-save-totp-verify-hint">Enter the 6-digit verification code currently shown in your authenticator app.</p>
              <div class="post-save-otp-row" id="psm-otp-row">
                <input type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" class="post-save-otp-box" data-otp-index="0" />
                <input type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" class="post-save-otp-box" data-otp-index="1" />
                <input type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" class="post-save-otp-box" data-otp-index="2" />
                <input type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" class="post-save-otp-box" data-otp-index="3" />
                <input type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" class="post-save-otp-box" data-otp-index="4" />
                <input type="text" inputmode="numeric" pattern="[0-9]" maxlength="1" class="post-save-otp-box" data-otp-index="5" />
              </div>
              <div class="post-save-totp-timer" id="psm-totp-timer">Code expires in <span id="psm-totp-countdown">30</span>s</div>
              <div class="post-save-totp-verify-status">
                <div class="psm-verify-chip" id="psm-verify-qr"><span class="psm-chip-icon">○</span> QR Code / Secret Key</div>
                <div class="psm-verify-chip" id="psm-verify-linked"><span class="psm-chip-icon">○</span> Authenticator Linked</div>
                <div class="psm-verify-chip" id="psm-verify-code"><span class="psm-chip-icon">○</span> Code Verification</div>
              </div>
            </div>
          </div>
          <div class="post-save-error" data-step-error="3" aria-live="polite"></div>
        </section>

        <!-- STEP 4: Complete -->
        <section class="post-save-panel" data-step-panel="4" hidden>
          <div class="post-save-complete">
            <div class="post-save-complete__icon">✓</div>
            <h3 class="post-save-complete__title">Provisioning Complete!</h3>
            <p class="post-save-complete__sub" id="psm-complete-sub">The account has been successfully provisioned with all required credentials.</p>
            <div class="psm-complete-personnel" id="psm-complete-personnel"></div>
            <table class="psm-complete-table" id="psm-complete-table">
              <tr><td>Username</td><td id="psm-cr-username">—</td><td id="psm-cr-username-status" class="psm-cr-status"></td></tr>
              <tr><td>RFID Card</td><td id="psm-cr-card">—</td><td id="psm-cr-card-status" class="psm-cr-status"></td></tr>
              <tr><td>Authenticator App</td><td id="psm-cr-totp">—</td><td id="psm-cr-totp-status" class="psm-cr-status"></td></tr>
            </table>
            <p class="psm-complete-note">This personnel can now log in using their username, password, RFID card, and authenticator code.</p>
          </div>
        </section>

      </div>

      <div class="post-save-modal__footer">
        <div class="post-save-footer__left">
          <button type="button" class="btn secondary post-save-back-btn" id="post-save-back-btn" hidden>← Back</button>
        </div>
        <div class="post-save-footer__right">
          <span class="post-save-step-counter" id="post-save-step-counter">Step 1 of 4</span>
          <button type="button" class="btn secondary" data-post-save-close id="post-save-cancel-btn">Cancel</button>
          <button type="button" class="btn primary post-save-next-btn" id="post-save-next-btn">Next →</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  const modal = {
    modalEl,
    dialogEl: modalEl.querySelector('.post-save-modal__dialog'),
    titleEl: modalEl.querySelector('#post-save-title'),
    subtitleEl: modalEl.querySelector('#post-save-subtitle'),
    eyebrowEl: modalEl.querySelector('#post-save-eyebrow'),
    stepCounterEl: modalEl.querySelector('#post-save-step-counter'),
    backBtn: modalEl.querySelector('#post-save-back-btn'),
    nextBtn: modalEl.querySelector('#post-save-next-btn'),
    cancelBtn: modalEl.querySelector('#post-save-cancel-btn'),
    usernameEl: modalEl.querySelector('#post-save-username'),
    passwordEl: modalEl.querySelector('#post-save-password'),
    confirmPasswordEl: modalEl.querySelector('#post-save-confirm-password'),
    // Step 1 left panel
    s1Name: modalEl.querySelector('#psm-s1-name'),
    s1Avatar: modalEl.querySelector('.psm-s1-avatar'),
    s1Position: modalEl.querySelector('#psm-s1-position'),
    s1Dept: modalEl.querySelector('#psm-s1-dept'),
    s1Org: modalEl.querySelector('#psm-s1-org'),
    s1RoleBadge: modalEl.querySelector('#psm-s1-role-badge'),
    // Step 1 strength & requirements
    strengthSegs: [1,2,3,4].map(i => modalEl.querySelector('#psm-seg-' + i)),
    strengthLabel: modalEl.querySelector('#post-save-strength-label'),
    reqLength:  modalEl.querySelector('#psm-req-length'),
    reqUpper:   modalEl.querySelector('#psm-req-upper'),
    reqNumber:  modalEl.querySelector('#psm-req-number'),
    reqSpecial: modalEl.querySelector('#psm-req-special'),
    pwEyeBtn:   modalEl.querySelector('#psm-pw-eye'),
    cpwEyeBtn:  modalEl.querySelector('#psm-cpw-eye'),
    usernameStatusEl: modalEl.querySelector('#post-save-username-status'),
    roleButtons: Array.from(modalEl.querySelectorAll('[data-role-pill]')),
    // Step 2 — personnel bar
    s2Username:     modalEl.querySelector('#psm-s2-username'),
    s2RoleLabel:    modalEl.querySelector('#psm-s2-role-label'),
    s2FullnameOrg:  modalEl.querySelector('#psm-s2-fullname-org'),
    s2Org:          modalEl.querySelector('#psm-s2-org'),
    s2RoleBadge:    modalEl.querySelector('#psm-s2-role-badge'),
    // Step 2 — scan zone
    scanStatusTitle: modalEl.querySelector('#post-save-scan-status-title'),
    scanStatusSub:   modalEl.querySelector('#post-save-scan-status-sub'),
    readerScanStatus:  modalEl.querySelector('#psm-reader-scan-status'),
    readerLastScanned: modalEl.querySelector('#psm-reader-last-scanned'),
    readerCardType:    modalEl.querySelector('#psm-reader-card-type'),
    readerUid:         modalEl.querySelector('#psm-reader-uid'),
    // Step 2 — card picker
    rfidSearch:    modalEl.querySelector('#psm-rfid-search'),
    rfidCardList:  modalEl.querySelector('#psm-rfid-card-list'),
    rfidPageInfo:  modalEl.querySelector('#psm-rfid-page-info'),
    rfidPrevBtn:   modalEl.querySelector('#psm-rfid-prev'),
    rfidNextBtn:   modalEl.querySelector('#psm-rfid-next'),
    rfidFilterTabs: Array.from(modalEl.querySelectorAll('[data-rfid-filter]')),
    skipLink: modalEl.querySelector('#post-save-skip-link'),
    // Step 3 TOTP
    totpQrLoading: modalEl.querySelector('#psm-totp-qr-loading'),
    totpQrImg: modalEl.querySelector('#psm-totp-qr-img'),
    totpKey: modalEl.querySelector('#psm-totp-key'),
    totpCopyBtn: modalEl.querySelector('#psm-totp-copy-btn'),
    totpCountdown: modalEl.querySelector('#psm-totp-countdown'),
    otpBoxes: Array.from(modalEl.querySelectorAll('.post-save-otp-box')),
    verifyChipQr: modalEl.querySelector('#psm-verify-qr'),
    verifyChipLinked: modalEl.querySelector('#psm-verify-linked'),
    verifyChipCode: modalEl.querySelector('#psm-verify-code'),
    // Step 4 Complete
    completePersonnel: modalEl.querySelector('#psm-complete-personnel'),
    crUsername: modalEl.querySelector('#psm-cr-username'),
    crUsernameStatus: modalEl.querySelector('#psm-cr-username-status'),
    crCard: modalEl.querySelector('#psm-cr-card'),
    crCardStatus: modalEl.querySelector('#psm-cr-card-status'),
    crTotp: modalEl.querySelector('#psm-cr-totp'),
    crTotpStatus: modalEl.querySelector('#psm-cr-totp-status'),
    stepPanels: Array.from(modalEl.querySelectorAll('[data-step-panel]')),
    stepDots: Array.from(modalEl.querySelectorAll('[data-step-dot]')),
    errorEls: {
      1: modalEl.querySelector('[data-step-error="1"]'),
      2: modalEl.querySelector('[data-step-error="2"]'),
      3: modalEl.querySelector('[data-step-error="3"]'),
    },
  };

  modal.state = {
    step: 1,
    savedRecord: null,
    selectedRole: 'Viewer',
    scannedCardUid: '',
    selectedCardUid: '',
    createdUsername: '',
    createdUser: null,
    totpSecret: '',
    totpVerified: false,
    cardAssigned: false,
    cardSkipped: false,
    submitting: false,
    open: false,
    finalized: false,
    resolveCompletion: null,
    _scanListenerAttached: false,
    _totpTimerInterval: null,
    // Step 2 card list state
    s2Cards: [], s2Filter: 'all', s2Search: '', s2Page: 0, s2PageSize: 5,
  };

  modal.renderRoleButtons = renderRoleButtons;
  modal.renderPersonnelChips = renderPersonnelChips;
  modal.clearErrors = clearErrors;
  modal.updateHeader = updateHeader;
  modal.updateNextButtonState = updateNextButtonState;
  // Expose inner helpers needed by openPostSaveModal (outside this closure)
  modal.stopTotpCountdown = () => stopTotpCountdown();
  modal.clearOtpBoxes = () => clearOtpBoxes();
  modal.updatePasswordStrength = (pw) => updatePasswordStrength(pw);
  modal.switchRfidTab = (tab) => switchRfidTab(tab);
  modal.attachBeforeUnloadGuard = () => window.addEventListener('beforeunload', _beforeUnloadGuard);


  function setStepError(step, message) {
    const el = modal.errorEls[step];
    if (!el) return;
    el.textContent = normalizePostSaveText(message);
    el.style.display = message ? 'block' : 'none';
  }

  function clearErrors() {
    setStepError(1, ''); setStepError(2, ''); setStepError(3, '');
  }

  const WIZARD_TOTP_IN_LOGIN_ONLY = true;
  const WIZARD_TOTAL_STEPS = WIZARD_TOTP_IN_LOGIN_ONLY ? 3 : 4;
  const STEP_META = WIZARD_TOTP_IN_LOGIN_ONLY
    ? {
      1: { eyebrow: 'STEP 1 OF 3 — Account Setup', title: 'Create Username', subtitle: 'Follow the steps to create a secure personal account.', next: 'Next →', cancel: true },
      2: { eyebrow: 'STEP 2 OF 3 — Assign RFID Card', title: 'Assign RFID Card', subtitle: 'Link an RFID/NFC card to this personnel account.', next: 'Complete →', cancel: true },
      4: { eyebrow: 'STEP 3 OF 3 — Complete', title: 'Account Created Successfully', subtitle: 'This personnel account is now ready to use.', next: 'Add Another Personnel', cancel: false },
    }
    : {
      1: { eyebrow: 'STEP 1 OF 4 — Account Setup', title: 'Create Username', subtitle: 'Follow the steps to create a secure personal account.', next: 'Next →', cancel: true },
      2: { eyebrow: 'STEP 2 OF 4 — Assign RFID Card', title: 'Assign RFID Card', subtitle: 'Link an RFID/NFC card to this personnel account.', next: 'Next →', cancel: true },
      3: { eyebrow: 'STEP 3 OF 4 — Setup Authenticator', title: 'Setup Authenticator', subtitle: 'Link an authenticator app to this account.', next: 'Verify & Continue →', cancel: true },
      4: { eyebrow: 'STEP 4 OF 4 — Complete', title: 'Account Created Successfully', subtitle: 'This personnel account is now ready to use.', next: 'Add Another Personnel', cancel: false },
    };

  function configureStepperForTotpPolicy() {
    if (!WIZARD_TOTP_IN_LOGIN_ONLY) return;
    const dot3 = modal.modalEl.querySelector('[data-step-dot="3"]');
    const dot4 = modal.modalEl.querySelector('[data-step-dot="4"]');
    if (dot3) dot3.style.display = 'none';
    if (dot4) {
      const circle = dot4.querySelector('.post-save-stepper__circle');
      if (circle) circle.textContent = '3';
    }
  }

  function updateHeader(step) {
    const displayStep = WIZARD_TOTP_IN_LOGIN_ONLY && step === 4 ? 3 : step;
    const meta = STEP_META[step] || STEP_META[1];
    modal.titleEl.textContent = meta.title;
    modal.subtitleEl.textContent = meta.subtitle;
    modal.eyebrowEl.textContent = meta.eyebrow;
    modal.stepCounterEl.textContent = 'Step ' + displayStep + ' of ' + WIZARD_TOTAL_STEPS;
    modal.backBtn.hidden = step === 1 || step === 4;
    modal.nextBtn.textContent = meta.next;
    if (modal.cancelBtn) modal.cancelBtn.hidden = !meta.cancel;
    modal.stepPanels.forEach((panel) => {
      panel.hidden = String(panel.getAttribute('data-step-panel')) !== String(step);
    });
    modal.stepDots.forEach((dot) => {
      const dotStep = Number(dot.getAttribute('data-step-dot'));
      dot.classList.toggle('is-active', dotStep === step);
      dot.classList.toggle('is-complete', dotStep < step);
    });
    modal.modalEl.setAttribute('data-step', String(step));
  }

  function renderPersonnelChips() {
    const record = modal.state.savedRecord || {};
    const fullName = escapePostSaveHtml(getPostSaveFullName(record));
    const position = escapePostSaveHtml(getPostSavePosition(record));
    const org = escapePostSaveHtml(getPostSaveOrganization(record));
    const photoUrl = getPostSavePhotoUrl(record);
    const username = escapePostSaveHtml(modal.state.createdUsername || modal.usernameEl.value || buildPostSaveUsername(record));
    const role = escapePostSaveHtml(getPostSaveRoleLabel(modal.state.selectedRole));
    // Left panel of step 1
    if (modal.s1Avatar) {
      if (photoUrl) {
        modal.s1Avatar.innerHTML = '<img class="psm-s1-avatar-img" alt="Profile photo" src="' + escapePostSaveHtml(photoUrl) + '" />';
      } else {
        modal.s1Avatar.innerHTML = '<svg class="psm-s1-avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="44" height="44"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-linecap="round"/></svg>';
      }
    }
    if (modal.s1Name)     modal.s1Name.textContent     = fullName || '—';
    if (modal.s1Position) modal.s1Position.textContent = position || '—';
    if (modal.s1Dept)     modal.s1Dept.textContent     = record.department || record.dept || '';
    if (modal.s1Org)      modal.s1Org.textContent      = org || '—';
    // Step 2 chip
    const step2Html = `<div class="post-save-personnel-chip__name">${username} · ${role}</div><div class="post-save-personnel-chip__meta">${fullName} · ${org}</div>`;
    if (modal.personnelChipStep2) modal.personnelChipStep2.innerHTML = step2Html;
    renderS2PersonnelBar();
  }

  function renderRoleButtons() {
    modal.roleButtons.forEach((btn) => {
      const role = btn.getAttribute('data-role-pill');
      const isActive = role === modal.state.selectedRole;
      btn.classList.toggle('is-active', isActive);
      const checkEl = btn.querySelector('.psm-role-card__check');
      if (checkEl) checkEl.style.display = isActive ? 'flex' : 'none';
    });
    // Update left panel role badge
    if (modal.s1RoleBadge) {
      modal.s1RoleBadge.textContent = modal.state.selectedRole || 'To be assigned';
      modal.s1RoleBadge.classList.toggle('psm-s1-role-badge--assigned', !!modal.state.selectedRole);
    }
  }

  // --- Password strength (4 segments + requirement chips) ---
  function getPasswordStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
  }
  function updatePasswordStrength(pw) {
    const met = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
    const colors = ['#e2e8f0', '#ef4444', '#f97316', '#eab308', '#22c55e'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const col = pw ? colors[met] : colors[0];
    modal.strengthSegs && modal.strengthSegs.forEach((seg, i) => {
      if (!seg) return;
      seg.style.background = (pw && i < met) ? col : '#e2e8f0';
    });
    if (modal.strengthLabel) {
      modal.strengthLabel.textContent = pw ? (labels[met] || '') : '';
      modal.strengthLabel.style.color = col;
    }
  }

  // --- Step 2 helpers ---

  function renderS2PersonnelBar() {
    const record = modal.state.savedRecord || {};
    const username = modal.state.createdUsername || modal.usernameEl.value || buildPostSaveUsername(record);
    const role     = getPostSaveRoleLabel(modal.state.selectedRole);
    const fullName = getPostSaveFullName(record);
    const org      = getPostSaveOrganization(record);
    if (modal.s2Username)    modal.s2Username.textContent    = username || '—';
    if (modal.s2RoleLabel)   modal.s2RoleLabel.textContent   = role || '—';
    if (modal.s2FullnameOrg) modal.s2FullnameOrg.textContent = [fullName, org].filter(Boolean).join(' · ') || '—';
    if (modal.s2Org)         modal.s2Org.textContent         = org || '—';
    if (modal.s2RoleBadge)   modal.s2RoleBadge.textContent   = role || '—';
  }

  function getFilteredS2Cards() {
    const { s2Cards, s2Filter, s2Search } = modal.state;
    return s2Cards.filter(c => {
      const matchFilter = s2Filter === 'all' || (c.status || '').toLowerCase() === s2Filter;
      const matchSearch = !s2Search || String(c.card_uid || c.uid || '').toLowerCase().includes(s2Search.toLowerCase());
      return matchFilter && matchSearch;
    });
  }

  function renderS2CardList() {
    const el = modal.rfidCardList;
    if (!el) return;
    const filtered = getFilteredS2Cards();
    const { s2Page, s2PageSize } = modal.state;
    const total   = filtered.length;
    const pages   = Math.ceil(total / s2PageSize) || 1;
    const safePage = Math.min(s2Page, pages - 1);
    modal.state.s2Page = safePage;
    const slice  = filtered.slice(safePage * s2PageSize, safePage * s2PageSize + s2PageSize);
    const from   = total ? safePage * s2PageSize + 1 : 0;
    const to     = Math.min(safePage * s2PageSize + s2PageSize, total);
    if (modal.rfidPageInfo) modal.rfidPageInfo.textContent = total ? `${from}–${to} of ${total}` : 'No cards found';
    if (modal.rfidPrevBtn) modal.rfidPrevBtn.disabled = safePage === 0;
    if (modal.rfidNextBtn) modal.rfidNextBtn.disabled = safePage >= pages - 1;
    if (!slice.length) {
      el.innerHTML = '<div class="psm-s2-empty">No cards found.</div>';
      return;
    }
    el.innerHTML = slice.map(c => {
      const uid    = escapePostSaveHtml(String(c.card_uid || c.uid || ''));
      const status = String(c.status || 'available').toLowerCase();
      const date   = c.registered_at ? new Date(c.registered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      const checked = (modal.state.selectedCardUid === uid || modal.state.scannedCardUid === uid) ? 'checked' : '';
      const selected = checked ? 'is-selected' : '';
      return `
        <label class="psm-s2-card-item ${selected}" data-uid="${uid}">
          <div class="psm-s2-card-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="20" height="20"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20" stroke-linecap="round"/></svg>
          </div>
          <div class="psm-s2-card-item__info">
            <div class="psm-s2-card-item__uid">${uid}</div>
            ${date ? `<div class="psm-s2-card-item__date">Registered ${date}</div>` : ''}
          </div>
          <div class="psm-s2-card-item__status">
            <span class="psm-s2-card-status psm-s2-card-status--${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
          <input type="radio" name="psm-card-select" value="${uid}" class="psm-s2-card-radio" ${checked} />
        </label>`;
    }).join('');
    // Wire click on each item
    el.querySelectorAll('.psm-s2-card-item').forEach(item => {
      item.addEventListener('click', () => {
        const uid = item.getAttribute('data-uid');
        modal.state.selectedCardUid = uid;
        renderS2CardList();
      });
    });
  }

  async function loadRfidCards() {
    const el = modal.rfidCardList;
    if (el) el.innerHTML = '<div class="psm-s2-cards-loading">Loading cards…</div>';
    try {
      const res = await window.cardManagementApi.listCards();
      console.log('[CARDS] loadRfidCards raw response:', res);
      const cards = Array.isArray(res) ? res : (res && (res.cards || res.data) ? (res.cards || res.data) : []);
      console.log('[CARDS] parsed cards count:', Array.isArray(cards) ? cards.length : 0);
      modal.state.s2Cards = cards;
      modal.state.s2Page  = 0;
      if (!cards || cards.length === 0) {
        console.warn('[CARDS] loadRfidCards: no cards returned from cardManagementApi.listCards(). If you expect cards, check that the main process DATABASE_URL/config is set and the IPC handler is reachable.');
      }
      renderS2CardList();
    } catch (e) {
      if (el) el.innerHTML = '<div class="psm-s2-empty">Could not load cards.</div>';
    }
  }

  function switchRfidTab(tab) {
    modal.state.rfidTab = tab || 'scan';
    if (modal.state.step === 2 && modal.state.open) {
      loadRfidCards();
    }
  }


  function startRfidScanListener() {
    if (modal.state._scanListenerAttached) return;
    if (!window.cardApi || typeof window.cardApi.onCardDetected !== 'function') return;
    modal.state._scanListenerAttached = true;
    window.cardApi.onCardDetected((payload) => {
      if (modal.state.step !== 2 || !modal.state.open) return;
      const raw = payload && typeof payload === 'object'
        ? String(payload.card_id || payload.cardUID || payload.cardUid || payload.uid || '')
        : String(payload || '');
      const uid = raw.trim();
      const cardType = payload && typeof payload === 'object' ? String(payload.card_type || payload.cardType || 'NFC') : 'NFC';
      if (!uid) return;
      const now = new Date().toLocaleTimeString();
      modal.state.scannedCardUid = uid;
      if (modal.scanStatusTitle) modal.scanStatusTitle.textContent = 'Card Detected!';
      if (modal.scanStatusSub)   modal.scanStatusSub.textContent   = 'Card is ready to be assigned.';
      if (modal.readerScanStatus)  modal.readerScanStatus.innerHTML = '<span style="color:#22c55e;font-weight:600">✓ Card Detected</span>';
      if (modal.readerLastScanned) modal.readerLastScanned.textContent = new Date().toLocaleTimeString();
      if (modal.readerCardType)    modal.readerCardType.textContent    = cardType;
      if (modal.readerUid)         modal.readerUid.textContent         = uid;
      modal.modalEl.querySelector('#post-save-scan-zone') && modal.modalEl.querySelector('#post-save-scan-zone').classList.add('has-card');
      // Auto-select scanned card in the list if present
      const match = modal.state.s2Cards.find(c => String(c.card_uid || c.uid || '').toLowerCase() === uid.toLowerCase());
      if (match) { modal.state.selectedCardUid = uid; }
      renderS2CardList();
    });
    // Listen for reader connection/status updates (if main emits them)
    if (window.cardApi && typeof window.cardApi.onCardStatus === 'function') {
      window.cardApi.onCardStatus((statusPayload) => {
        try {
          // Support multiple payload shapes: { connected: true }, { kind: 'status', message: 'Connected — ACR1252U-A1' }
          let connected = false;
          let model = '';
          if (typeof statusPayload === 'object') {
            if (statusPayload.connected != null) connected = !!statusPayload.connected;
            if (statusPayload.isConnected != null) connected = connected || !!statusPayload.isConnected;
            if (statusPayload.model) model = String(statusPayload.model || '');
            if (statusPayload.readerModel) model = model || String(statusPayload.readerModel || '');
            if (statusPayload.device) model = model || String(statusPayload.device || '');
            if (statusPayload.message && typeof statusPayload.message === 'string') {
              const msg = statusPayload.message.toLowerCase();
              if (msg.includes('connected')) connected = true;
              if (msg.includes('disconnected') || msg.includes('not connected') || msg.includes('no reader')) connected = false;
              // try to extract a model token (common ACR prefix)
              const m = statusPayload.message.match(/(ACR\w+[-_\w]*)/i);
              if (m && m[1]) model = model || m[1];
            }
          }

          const dot = modal.modalEl.querySelector('#psm-s2-reader-dot');
          const label = modal.modalEl.querySelector('#psm-s2-reader-label');
          const connectedText = modal.modalEl.querySelector('#psm-s2-reader-connected');
          if (dot) {
            dot.classList.toggle('psm-reader-dot--connected', connected);
            dot.classList.toggle('psm-reader-dot--disconnected', !connected);
          }
          if (label) label.textContent = 'Reader Status';
          if (connectedText) connectedText.textContent = connected ? (model ? ('Connected — ' + model) : 'Connected') : 'Disconnected';
        } catch (_) {}
      });
    }
  }

  // --- TOTP helpers ---
  function startTotpCountdown() {
    if (modal.state._totpTimerInterval) clearInterval(modal.state._totpTimerInterval);
    function tick() {
      const secs = 30 - (Math.floor(Date.now() / 1000) % 30);
      if (modal.totpCountdown) modal.totpCountdown.textContent = secs;
    }
    tick();
    modal.state._totpTimerInterval = setInterval(tick, 1000);
  }
  function stopTotpCountdown() {
    if (modal.state._totpTimerInterval) { clearInterval(modal.state._totpTimerInterval); modal.state._totpTimerInterval = null; }
  }

  function setVerifyChip(el, state) { // state: 'pending'|'done'|'inprogress'
    if (!el) return;
    const icon = el.querySelector('.psm-chip-icon');
    el.className = 'psm-verify-chip psm-verify-chip--' + state;
    if (icon) icon.textContent = state === 'done' ? '\u2713' : state === 'inprogress' ? '\u25cf' : '\u25cb';
  }
  async function loadTotpQr() {
    const userId = modal.state.createdUser && modal.state.createdUser.id;
    if (!userId) { setStepError(3, 'User ID not found. Please go back and try again.'); return; }
    if (modal.totpQrLoading) modal.totpQrLoading.hidden = false;
    if (modal.totpQrImg)     modal.totpQrImg.hidden     = true;
    if (modal.totpKey)       modal.totpKey.textContent  = '\u2026';
    try {
      const res = await window.authApi.enrollTotpForUser(userId);
      modal.state.totpSecret = res.secret || '';
      if (modal.totpQrImg)     { modal.totpQrImg.src = res.qrCodeDataUrl; modal.totpQrImg.hidden = false; }
      if (modal.totpQrLoading) modal.totpQrLoading.hidden = true;
      if (modal.totpKey)       modal.totpKey.textContent = res.secret || '';
      setVerifyChip(modal.verifyChipQr, 'done');
      setVerifyChip(modal.verifyChipLinked, 'inprogress');
      setVerifyChip(modal.verifyChipCode, 'pending');
      startTotpCountdown();
    } catch (err) {
      setStepError(3, 'Could not load QR code: ' + (err && err.message ? err.message : String(err)));
      if (modal.totpQrLoading) modal.totpQrLoading.textContent = 'Failed to load QR code.';
    }
  }

  // --- OTP boxes ---
  function getOtpValue() {
    return modal.otpBoxes.map(b => b.value.trim()).join('');
  }
  function clearOtpBoxes() {
    modal.otpBoxes.forEach(b => { b.value = ''; b.classList.remove('post-save-otp-box--error'); });
  }

  // --- updateNextButtonState ---
  function updateNextButtonState() {
    modal.nextBtn.disabled = modal.state.submitting;
    modal.backBtn.disabled = modal.state.submitting;
    modal.roleButtons.forEach(b => { b.disabled = modal.state.submitting; });
    modal.usernameEl.disabled = modal.state.submitting;
    modal.passwordEl.disabled = modal.state.submitting;
    modal.confirmPasswordEl.disabled = modal.state.submitting;
  }

  // --- Completion screen ---
  function renderCompletionScreen() {
    const record = modal.state.savedRecord || {};
    const fullName = escapePostSaveHtml(getPostSaveFullName(record));
    const position = escapePostSaveHtml(getPostSavePosition(record));
    if (modal.completePersonnel) {
      modal.completePersonnel.innerHTML = `<div class="post-save-personnel-chip__name">${fullName}</div><div class="post-save-personnel-chip__meta">${position}</div>`;
    }
    const uid = modal.state.scannedCardUid || (modal.manualUidEl && modal.manualUidEl.value.trim()) || '';
    if (modal.crUsername)       modal.crUsername.textContent       = modal.state.createdUsername || '\u2014';
    if (modal.crUsernameStatus) modal.crUsernameStatus.innerHTML   = '<span class="psm-cr-badge psm-cr-badge--ok">Completed</span>';
    if (modal.crCard)           modal.crCard.textContent           = uid || (modal.state.cardSkipped ? 'Skipped' : '\u2014');
    if (modal.crCardStatus)     modal.crCardStatus.innerHTML       = uid ? '<span class="psm-cr-badge psm-cr-badge--ok">Completed</span>' : '<span class="psm-cr-badge psm-cr-badge--skip">Pending</span>';
    if (modal.crTotp)           modal.crTotp.textContent           = WIZARD_TOTP_IN_LOGIN_ONLY ? 'Setup on first login' : (modal.state.totpVerified ? 'Linked' : 'Skipped');
    if (modal.crTotpStatus)     modal.crTotpStatus.innerHTML       = WIZARD_TOTP_IN_LOGIN_ONLY ? '<span class="psm-cr-badge psm-cr-badge--skip">Deferred</span>' : (modal.state.totpVerified ? '<span class="psm-cr-badge psm-cr-badge--ok">Completed</span>' : '<span class="psm-cr-badge psm-cr-badge--skip">Pending</span>');
  }

  function _beforeUnloadGuard(event) {
    if (modal.state.open && !modal.state.finalized && modal.state.step < 4) {
      event.preventDefault();
      event.returnValue = 'Provisioning is not complete. If you leave, credentials will not be set up for this personnel.';
      return event.returnValue;
    }
  }

  function closeModal() {
    modal.state.open = false;
    window.removeEventListener('beforeunload', _beforeUnloadGuard);
    modal.modalEl.classList.remove('is-open');
    modal.modalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('post-save-modal-open');

    if (document.activeElement && modal.modalEl.contains(document.activeElement)) {
      try { document.activeElement.blur(); } catch (_) {}
    }
  }

  function resolveCompletion(result) {
    if (typeof modal.state.resolveCompletion !== 'function') return;
    const resolver = modal.state.resolveCompletion;
    modal.state.resolveCompletion = null;
    resolver(result || { ok: false });
  }

  async function finalizeModal(result) {
    if (modal.state.finalized) return;
    modal.state.finalized = true;
    closeModal();
    resolveCompletion(result || { ok: true });
  }

  async function handleNext() {
    clearErrors();

    // --- Step 1: Create user account ---
    if (modal.state.step === 1) {
      if (modal.state.createdUser) { goToStep(2); return; }
      const username = normalizePostSaveText(modal.usernameEl.value);
      const password = String(modal.passwordEl.value || '');
      const confirmPassword = String(modal.confirmPasswordEl.value || '');
      const role = normalizePostSaveText(modal.state.selectedRole);
      if (!username || !password || !confirmPassword || !role) {
        setStepError(1, 'Please fill in all fields and choose a role.'); return;
      }
      if (password.length < 8) { setStepError(1, 'Password must be at least 8 characters.'); return; }
      if (password !== confirmPassword) { setStepError(1, 'Passwords do not match.'); return; }
      try {
        modal.state.submitting = true; updateNextButtonState();
        if (!window.authApi || typeof window.authApi.createUser !== 'function') throw new Error('User creation API not available');
        const response = await window.authApi.createUser({
          username, password,
          personnelId: modal.state.savedRecord && modal.state.savedRecord.id ? modal.state.savedRecord.id : undefined,
          role: role.toLowerCase(),
        });
        modal.state.createdUsername = normalizePostSaveText(response && response.user && response.user.username ? response.user.username : username);
        modal.state.createdUser = response && response.user ? response.user : null;
        goToStep(2);
      } catch (err) { setStepError(1, err && err.message ? err.message : String(err)); }
      finally { modal.state.submitting = false; updateNextButtonState(); }
      return;
    }

    // --- Step 2: Assign RFID Card (or skip) ---
    if (modal.state.step === 2) {
      const uid = modal.state.rfidTab === 'scan'
        ? modal.state.scannedCardUid
        : (modal.manualUidEl && normalizePostSaveText(modal.manualUidEl.value));
      if (uid) {
        try {
          modal.state.submitting = true; updateNextButtonState();
          // Auto-register if card not already in system
          try {
            if (window.cardManagementApi && typeof window.cardManagementApi.registerCard === 'function') {
              await window.cardManagementApi.registerCard({ card_uid: uid });
            }
          } catch (_) { /* might already be registered, that's fine */ }
          if (window.cardManagementApi && typeof window.cardManagementApi.assignCard === 'function') {
            await window.cardManagementApi.assignCard({
              card_uid: uid,
              personnel_id: modal.state.savedRecord && modal.state.savedRecord.id ? modal.state.savedRecord.id : undefined,
              username: modal.state.createdUsername,
            });
          }
          modal.state.cardAssigned = true;
          modal.state.cardSkipped = false;
        } catch (err) { setStepError(2, err && err.message ? err.message : String(err)); return; }
        finally { modal.state.submitting = false; updateNextButtonState(); }
      } else {
        modal.state.cardSkipped = true;
        modal.state.cardAssigned = false;
      }
      goToStep(WIZARD_TOTP_IN_LOGIN_ONLY ? 4 : 3);
      return;
    }

    // --- Step 3: Verify TOTP ---
    if (modal.state.step === 3) {
      if (WIZARD_TOTP_IN_LOGIN_ONLY) { goToStep(4); return; }
      const otp = getOtpValue();
      if (otp.length < 6) { setStepError(3, 'Please enter all 6 digits of your authenticator code.'); return; }
      const userId = modal.state.createdUser && modal.state.createdUser.id;
      if (!userId) { setStepError(3, 'User session lost. Please restart.'); return; }
      try {
        modal.state.submitting = true; updateNextButtonState();
        setVerifyChip(modal.verifyChipCode, 'inprogress');
        await window.authApi.verifyTotpForUser(userId, otp);
        modal.state.totpVerified = true;
        setVerifyChip(modal.verifyChipLinked, 'done');
        setVerifyChip(modal.verifyChipCode, 'done');
        stopTotpCountdown();
        goToStep(4);
      } catch (err) {
        setVerifyChip(modal.verifyChipCode, 'pending');
        modal.otpBoxes.forEach(b => b.classList.add('post-save-otp-box--error'));
        setStepError(3, 'Invalid code. Please check your authenticator and try again.');
      } finally { modal.state.submitting = false; updateNextButtonState(); }
      return;
    }

    // --- Step 4: Add Another Personnel (finalize) ---
    if (modal.state.step === 4) {
      stopTotpCountdown();
      await finalizeModal({ ok: true, addAnother: true, createdUsername: modal.state.createdUsername, role: modal.state.selectedRole });
    }
  }

  async function goToStep(step) {
    if (WIZARD_TOTP_IN_LOGIN_ONLY && step === 3) step = 4;
    modal.state.step = step;
    updateHeader(step);
    renderPersonnelChips();
    updateNextButtonState();
    if (step === 2) {
      startRfidScanListener();
      switchRfidTab(modal.state.rfidTab);
      // Query main process for watcher status to reflect initial connection state
      try {
        if (window.cardApi && typeof window.cardApi.getStatus === 'function') {
          const st = await window.cardApi.getStatus();
          const connected = !!(st && st.watcherRunning);
          const dot = modal.modalEl.querySelector('#psm-s2-reader-dot');
          const connectedText = modal.modalEl.querySelector('#psm-s2-reader-connected');
          if (dot) { dot.classList.toggle('psm-reader-dot--connected', connected); dot.classList.toggle('psm-reader-dot--disconnected', !connected); }
          if (connectedText) connectedText.textContent = connected ? 'Connected' : 'Disconnected';
        }
      } catch (_) {}
      // Query DB reachability for diagnostics (will log to DevTools)
      try {
        if (window.cardManagementApi && typeof window.cardManagementApi.dbStatus === 'function') {
          const db = await window.cardManagementApi.dbStatus();
          console.log('[DB STATUS]', db);
        }
      } catch (e) { console.warn('[DB STATUS] check failed', e); }
    }
    if (step === 3 && !WIZARD_TOTP_IN_LOGIN_ONLY) { clearOtpBoxes(); await loadTotpQr(); }
    if (step === 4) { renderCompletionScreen(); }
  }

  async function handleSkip(event) {
    if (event) event.preventDefault();
    if (modal.state.step === 2) {
      modal.state.cardSkipped = true; modal.state.cardAssigned = false;
      goToStep(WIZARD_TOTP_IN_LOGIN_ONLY ? 4 : 3);
    }
  }

  modal.backBtn.addEventListener('click', () => {
    if (modal.state.submitting) return;
    clearErrors();
    const prev = (WIZARD_TOTP_IN_LOGIN_ONLY && modal.state.step === 4) ? 2 : (modal.state.step - 1);
    if (prev === 2) { stopTotpCountdown(); }
    modal.state.step = prev;
    updateHeader(prev);
    renderPersonnelChips();
    updateNextButtonState();
    if (prev === 1) modal.usernameEl.focus();
  });

  modal.nextBtn.addEventListener('click', handleNext);
  modal.skipLink && modal.skipLink.addEventListener('click', handleSkip);

  // Step 2 search
  if (modal.rfidSearch) {
    modal.rfidSearch.addEventListener('input', () => {
      modal.state.s2Search = modal.rfidSearch.value;
      modal.state.s2Page   = 0;
      renderS2CardList();
    });
  }
  // Step 2 filter tabs
  modal.rfidFilterTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.rfidFilterTabs.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      modal.state.s2Filter = btn.getAttribute('data-rfid-filter') || 'all';
      modal.state.s2Page   = 0;
      renderS2CardList();
    });
  });
  // Step 2 pagination
  if (modal.rfidPrevBtn) modal.rfidPrevBtn.addEventListener('click', () => { modal.state.s2Page--; renderS2CardList(); });
  if (modal.rfidNextBtn) modal.rfidNextBtn.addEventListener('click', () => { modal.state.s2Page++; renderS2CardList(); });
  const tipsHelp = modal.modalEl.querySelector('.psm-s2-scan-help');
  const tipsButton = modal.modalEl.querySelector('#psm-s2-open-tips-tooltip');
  const tipsTooltip = modal.modalEl.querySelector('#psm-s2-scan-help-tooltip');
  if (tipsButton) {
    tipsButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (tipsHelp) tipsHelp.classList.toggle('is-open');
    });
  }
  if (tipsHelp) {
    tipsHelp.addEventListener('mouseenter', () => tipsHelp.classList.add('is-open'));
    tipsHelp.addEventListener('mouseleave', () => tipsHelp.classList.remove('is-open'));
    tipsHelp.addEventListener('focusin', () => tipsHelp.classList.add('is-open'));
    tipsHelp.addEventListener('focusout', () => tipsHelp.classList.remove('is-open'));
  }
  if (tipsTooltip) {
    tipsTooltip.addEventListener('click', (event) => event.stopPropagation());
  }

  // Role pills
  modal.roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (modal.state.submitting) return;
      modal.state.selectedRole = button.getAttribute('data-role-pill') || 'Viewer';
      renderRoleButtons();
      renderPersonnelChips();
    });
  });

  // Eye toggles
  function wireEyeToggle(eyeBtn, inputEl) {
    if (!eyeBtn || !inputEl) return;
    eyeBtn.addEventListener('click', () => {
      const show = inputEl.type === 'password';
      inputEl.type = show ? 'text' : 'password';
      const svg = eyeBtn.querySelector('svg');
      if (svg) {
        svg.innerHTML = show
          ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/>';
      }
    });
  }
  wireEyeToggle(modal.pwEyeBtn, modal.passwordEl);
  wireEyeToggle(modal.cpwEyeBtn, modal.confirmPasswordEl);

  // Username availability check (debounced)
  let _availTimer = null;
  function checkUsernameAvailability(username) {
    const el = modal.usernameStatusEl;
    if (!el) return;
    if (!username) { el.innerHTML = ''; return; }
    el.innerHTML = '<span style="color:#94a3b8;font-size:12px">Checking…</span>';
    clearTimeout(_availTimer);
    _availTimer = setTimeout(async () => {
      try {
        if (!window.adminApi || typeof window.adminApi.listUsers !== 'function') { el.innerHTML = ''; return; }
        const res = await window.adminApi.listUsers();
        const users = Array.isArray(res) ? res : (res && res.users ? res.users : []);
        const taken = users.some(u => String(u.username || '').toLowerCase() === username.toLowerCase());
        el.innerHTML = taken
          ? '<span style="color:#ef4444;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px"><svg viewBox="0 0 16 16" fill="none" width="14" height="14"><circle cx="8" cy="8" r="7" stroke="#ef4444" stroke-width="1.5"/><path d="M5 5l6 6M11 5l-6 6" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/></svg> Taken</span>'
          : '<span style="color:#22c55e;font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px"><svg viewBox="0 0 16 16" fill="none" width="14" height="14"><circle cx="8" cy="8" r="7" stroke="#22c55e" stroke-width="1.5"/><path d="m5 8 2 2 4-4" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Available</span>';
      } catch (_) { el.innerHTML = ''; }
    }, 500);
  }

  modal.usernameEl.addEventListener('input', () => {
    clearErrors();
    renderPersonnelChips();
    checkUsernameAvailability(modal.usernameEl.value.trim());
  });
  modal.passwordEl.addEventListener('input', () => { clearErrors(); updatePasswordStrength(modal.passwordEl.value); });
  modal.confirmPasswordEl.addEventListener('input', () => clearErrors());


  // TOTP copy key
  if (modal.totpCopyBtn) {
    modal.totpCopyBtn.addEventListener('click', () => {
      if (modal.state.totpSecret) {
        navigator.clipboard && navigator.clipboard.writeText(modal.state.totpSecret).catch(() => {});
        modal.totpCopyBtn.textContent = 'Copied!';
        setTimeout(() => { modal.totpCopyBtn.textContent = 'Copy'; }, 1800);
      }
    });
  }

  // OTP box auto-advance + backspace
  modal.otpBoxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      box.classList.remove('post-save-otp-box--error');
      const v = box.value.replace(/[^0-9]/g, '');
      box.value = v ? v[v.length - 1] : '';
      if (box.value && i < modal.otpBoxes.length - 1) modal.otpBoxes[i + 1].focus();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && i > 0) modal.otpBoxes[i - 1].focus();
    });
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6);
      digits.split('').forEach((d, j) => { if (modal.otpBoxes[i + j]) modal.otpBoxes[i + j].value = d; });
    });
  });

  modal.modalEl.addEventListener('click', (event) => {
    const closeTarget = event.target.closest('[data-post-save-close]');
    if (!closeTarget) return;
    if (modal.state.step === 4) { stopTotpCountdown(); finalizeModal({ ok: true, cancelled: false, createdUsername: modal.state.createdUsername }); return; }
    if (modal.state.submitting) return;
    stopTotpCountdown();
    closeModal();
    resolveCompletion({ ok: false, cancelled: true });
  });

  document.addEventListener('keydown', (event) => {
    if (!modal.state.open) return;
    if (event.key === 'Escape' && tipsHelp && tipsHelp.classList.contains('is-open')) {
      event.preventDefault();
      tipsHelp.classList.remove('is-open');
      return;
    }
    if (event.key === 'Escape' && modal.state.step !== 4) {
      event.preventDefault();
      if (!modal.state.submitting) { stopTotpCountdown(); closeModal(); resolveCompletion({ ok: false, cancelled: true }); }
    }
  });

  postSaveModalState = modal;
  configureStepperForTotpPolicy();
  return modal;
}

export function openPostSaveModal(savedRecord) {
  return new Promise((resolve) => {
    const allModals = Array.from(document.querySelectorAll('.post-save-modal'));
    if (allModals.length > 1) {
      allModals.slice(1).forEach((el) => el.remove());
    }

    const modal = createPostSaveModalShell();
    if (typeof modal.state.resolveCompletion === 'function') {
      modal.state.resolveCompletion({ ok: false, cancelled: true });
    }

    modal.state.savedRecord = savedRecord && typeof savedRecord === 'object' ? savedRecord : {};
    modal.state.step = 1;
    modal.state.selectedRole = 'Viewer';
    modal.state.scannedCardUid = '';
    modal.state.rfidTab = 'scan';
    modal.state.createdUsername = normalizePostSaveText(buildPostSaveUsername(modal.state.savedRecord));
    modal.state.createdUser = null;
    modal.state.totpSecret = '';
    modal.state.totpVerified = false;
    modal.state.cardAssigned = false;
    modal.state.cardSkipped = false;
    modal.state.submitting = false;
    modal.state.open = true;
    modal.state.finalized = false;
    modal.state.resolveCompletion = resolve;
    modal.state._scanListenerAttached = false;
    modal.stopTotpCountdown();

    modal.usernameEl.value = modal.state.createdUsername;
    modal.passwordEl.value = '';
    modal.confirmPasswordEl.value = '';
    if (modal.manualUidEl) modal.manualUidEl.value = '';
    modal.clearOtpBoxes();
    modal.updatePasswordStrength('');
    if (modal.scanStatusTitle) modal.scanStatusTitle.textContent = 'Ready to Scan';
    if (modal.scanStatusSub)   modal.scanStatusSub.textContent   = 'Tap an RFID/NFC card on the reader.';
    if (modal.readerScanStatus)  modal.readerScanStatus.textContent  = '\u2014';
    if (modal.readerLastScanned) modal.readerLastScanned.textContent = '\u2014';
    if (modal.readerCardType)    modal.readerCardType.textContent    = '\u2014';
    if (modal.readerUid)         modal.readerUid.textContent         = '\u2014';
    if (modal.readerStatus)      modal.readerStatus.textContent      = '\u2014';
    modal.switchRfidTab('scan');


    modal.renderRoleButtons();
    modal.renderPersonnelChips();
    modal.clearErrors();
    modal.updateHeader(1);
    modal.updateNextButtonState();

    modal.modalEl.classList.add('is-open');
    modal.modalEl.setAttribute('aria-hidden', 'false');
    modal.modalEl.style.pointerEvents = 'auto';
    if (modal.dialogEl) modal.dialogEl.style.pointerEvents = 'auto';
    document.body.classList.add('post-save-modal-open');
    modal.attachBeforeUnloadGuard();

    window.requestAnimationFrame(() => {
      if (modal.usernameEl) {
        modal.usernameEl.focus();
        modal.usernameEl.select();
      }
    });
  });
}

export function createCardManagementController() {
  const view = document.getElementById('card-management-view');
  const tableBody = document.getElementById('cards-table-body');
  const statusMessage = document.getElementById('card-management-status');
  
  // KPI elements
  const kpiTotal = document.getElementById('kpi-total-cards');
  const kpiAvailable = document.getElementById('kpi-available-cards');
  const kpiAssigned = document.getElementById('kpi-assigned-cards');
  
  // Tab buttons
  const tabButtons = document.querySelectorAll('.card-tab-btn');
  
  // Register modal elements
  const registerBtn = document.getElementById('btn-register-card');
  const registerModal = document.getElementById('register-card-modal');
  const closeRegisterBtn = document.getElementById('btn-close-register-modal');
  const cancelRegisterBtn = document.getElementById('btn-cancel-register');
  const confirmRegisterBtn = document.getElementById('btn-confirm-register');
  const registerTapZone = document.getElementById('register-tap-zone');
  const registerTapLabel = document.getElementById('register-tap-label');
  const registerTapSub = document.getElementById('register-tap-sub');
  const registerStatusMsg = document.getElementById('register-status-message');

  // Personnel assign modal elements
  const assignModal = document.getElementById('assign-personnel-modal');
  const assignModalTitle = document.getElementById('assign-personnel-title');
  const assignModalSubtitle = document.getElementById('assign-personnel-subtitle');
  const assignModalSearch = document.getElementById('assign-personnel-search');
  const assignModalList = document.getElementById('assign-personnel-list');
  const assignModalCloseBtn = document.getElementById('btn-close-assign-modal');
  const assignModalCancelBtn = document.getElementById('btn-cancel-assign-modal');
  
  let currentFilter = 'all';
  let registeredCardUid = null;
  let allCards = [];
  let allPersonnel = [];
  let currentAssignCardUid = null;

  if (assignModalList) {
    assignModalList.addEventListener('click', (event) => {
      const button = event.target.closest('.assign-personnel-item');
      if (!button || !assignModalList.contains(button)) return;
      event.preventDefault();
      const personnelId = String(button.dataset.personnelId || '').trim();
      if (personnelId) handleAssignPersonnel(currentAssignCardUid, personnelId);
    });
  }

  function setStatus(msg, type = 'info') {
    if (statusMessage) {
      statusMessage.textContent = msg;
      statusMessage.className = `status-message ${type}`;
      statusMessage.style.display = msg ? 'block' : 'none';
      if (msg) {
        setTimeout(() => {
          if (statusMessage && statusMessage.textContent === msg) {
            statusMessage.style.display = 'none';
          }
        }, 5000);
      }
    }
  }

  function updateKPIs() {
    const total = allCards.length;
    const available = allCards.filter(c => c.status === 'available').length;
    const assigned = allCards.filter(c => c.status === 'assigned').length;
    
    if (kpiTotal) kpiTotal.textContent = total;
    if (kpiAvailable) kpiAvailable.textContent = available;
    if (kpiAssigned) kpiAssigned.textContent = assigned;
  }

  function filterCards() {
    const filtered = currentFilter === 'all'
      ? allCards
      : allCards.filter(c => c.status === currentFilter);
    return filtered;
  }

  function findCardByUid(cardUid) {
    const normalizedUid = String(cardUid || '').trim();
    if (!normalizedUid) return null;
    return allCards.find(card => String(card.card_uid || card.uid || '').trim() === normalizedUid) || null;
  }

  function normalizeDetectedCard(payload) {
    if (payload && typeof payload === 'object') {
      return {
        cardUid: String(payload.card_id || payload.cardUID || payload.cardUid || '').trim(),
        cardType: String(payload.card_type || payload.cardType || '').trim(),
        readerName: String(payload.reader_name || payload.readerName || '').trim(),
      };
    }

    return {
      cardUid: String(payload || '').trim(),
      cardType: '',
      readerName: '',
    };
  }

  function isSupportedCardType(cardType) {
    const normalizedType = String(cardType || '').trim().toUpperCase();
    return normalizedType === 'NFC_UID' || normalizedType === 'SMART_CARD_ATR';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getPersonnelDisplayName(person) {
    const fullName = String(person && (person.fullName || person.full_name || person.name) || '').trim();
    const id = String(person && person.id || '').trim();
    return fullName ? `${fullName} (${id})` : id || 'Unknown personnel';
  }

  function getPersonnelSearchText(person) {
    return [person && person.id, person && person.fullName, person && person.full_name, person && person.name, person && person.username]
      .filter(Boolean)
      .map(item => String(item).toLowerCase())
      .join(' ');
  }

  function renderPersonnelList() {
    if (!assignModalList) return;
    const query = String(assignModalSearch && assignModalSearch.value || '').trim().toLowerCase();
    const filtered = (allPersonnel || []).filter(person => {
      if (!query) return true;
      return getPersonnelSearchText(person).includes(query);
    });

    if (!filtered.length) {
      assignModalList.innerHTML = '<div class="assign-personnel-empty">No personnel found.</div>';
      return;
    }

    assignModalList.innerHTML = filtered.map(person => {
      const id = escapeHtml(person && person.id ? person.id : '');
      const name = escapeHtml(getPersonnelDisplayName(person));
      const meta = escapeHtml(person && (person.presentJob || person.organization || person.role || 'Personnel'));
      return `
        <button type="button" class="assign-personnel-item" data-personnel-id="${id}">
          <div class="assign-personnel-item__main">
            <div class="assign-personnel-item__name">${name}</div>
            <div class="assign-personnel-item__meta">${meta}</div>
          </div>
          <span class="assign-personnel-item__action">Assign</span>
        </button>
      `;
    }).join('');

  }

  async function loadPersonnelList() {
    if (!window.personnelApi || typeof window.personnelApi.getAll !== 'function') {
      throw new Error('Personnel API not available');
    }
    const result = await window.personnelApi.getAll();
    allPersonnel = Array.isArray(result) ? result : [];
    renderPersonnelList();
  }

  function openAssignModal(cardUid) {
    currentAssignCardUid = String(cardUid || '').trim();
    if (!currentAssignCardUid) return;
    if (assignModalTitle) assignModalTitle.textContent = 'Assign Card to Personnel';
    if (assignModalSubtitle) assignModalSubtitle.textContent = `Card UID: ${currentAssignCardUid}`;
    if (assignModalSearch) assignModalSearch.value = '';
    if (assignModalList) assignModalList.innerHTML = '<div class="assign-personnel-empty">Loading personnel...</div>';
    if (assignModal) assignModal.style.display = 'block';
    loadPersonnelList().catch(err => {
      if (assignModalList) assignModalList.innerHTML = '<div class="assign-personnel-empty">Unable to load personnel list.</div>';
      setStatus(`Error loading personnel: ${err && err.message ? err.message : err}`, 'error');
    });
  }

  function closeAssignModal() {
    currentAssignCardUid = null;
    if (assignModal) assignModal.style.display = 'none';
  }

  async function handleAssignPersonnel(cardUid, personnelId) {
    if (!cardUid || !personnelId) return;
    try {
      if (!window.cardManagementApi || typeof window.cardManagementApi.assignCard !== 'function') {
        setStatus('Card Management API not available', 'error');
        return;
      }
      await window.cardManagementApi.assignCard({ card_uid: cardUid, personnel_id: personnelId });
      setStatus('Card assigned to selected personnel', 'success');
      closeAssignModal();
      await loadCards();
    } catch (e) {
      setStatus(`Error assigning card: ${e && e.message ? e.message : e}`, 'error');
      console.error('Error assigning card:', e);
    }
  }

  function renderTable() {
    const filtered = filterCards();
    if (!filtered || filtered.length === 0) {
      tableBody.innerHTML = '<tr style="text-align: center; color: #999;"><td colspan="5">No cards found.</td></tr>';
      return;
    }

    tableBody.innerHTML = filtered.map(card => {
      const cardUid = String(card && (card.card_uid || card.uid) || '').trim();
      const cardType = cardUid.length > 20 ? 'Smart Card' : 'NFC Type A';
      
      // Better 'Assigned To' label logic
      let assignedTo = 'Unassigned';
      if (card.status === 'assigned') {
        assignedTo = card.personnel_name || card.assigned_user_full_name || (card.personnel_id ? `ID: ${card.personnel_id}` : 'Unknown');
      }

      const statusBadge = card.status === 'available'
        ? '<span class="badge badge-available">Available</span>'
        : `<span class="badge badge-assigned">Assigned</span>`;

      return `
        <tr data-card-uid="${cardUid}">
          <td class="card-uid">${cardUid || 'N/A'}</td>
          <td>${cardType}</td>
          <td>${statusBadge}</td>
          <td>${assignedTo}</td>
          <td class="actions">
            ${card.status === 'available'
                  ? `<button class="btn-action assign-card" data-card-uid="${cardUid}">Assign</button>`
              : `<button class="btn-action unassign-card" data-card-uid="${cardUid}">Unassign</button>`
            }
          </td>
        </tr>
      `;
    }).join('');

    // Wire up action buttons
    tableBody.querySelectorAll('.assign-card').forEach(btn => {
      btn.addEventListener('click', () => handleAssignCard(btn.dataset.cardUid));
    });
    tableBody.querySelectorAll('.unassign-card').forEach(btn => {
      btn.addEventListener('click', () => handleUnassignCard(btn.dataset.cardUid));
    });
  }

  async function loadCards() {
    try {
      if (!window.cardManagementApi || typeof window.cardManagementApi.listCards !== 'function') {
        setStatus('Card Management API not available', 'error');
        return;
      }
      const result = await window.cardManagementApi.listCards();
      const cards = result && result.cards ? result.cards : [];
      allCards = Array.isArray(cards) ? cards.filter(c => c && (c.card_uid || c.uid)) : [];
      updateKPIs();
      renderTable();
    } catch (e) {
      setStatus(`Error loading cards: ${e && e.message ? e.message : e}`, 'error');
      console.error('Error loading cards:', e);
    }
  }

  function openRegisterModal() {
    registeredCardUid = null;
    registerModal.style.display = 'block';
    registerTapLabel.textContent = 'Tap your card';
    registerTapSub.textContent = 'Tap a physical RFID/NFC card once to analyze it';
    registerStatusMsg.style.display = 'none';
    confirmRegisterBtn.disabled = true;
    startListeningForCard();
  }

  function closeRegisterModal() {
    registerModal.style.display = 'none';
    stopListeningForCard();
    registeredCardUid = null;
  }

  let cardListenerActive = false;

  function startListeningForCard() {
    if (cardListenerActive) return; // Prevent duplicate listeners
    cardListenerActive = true;

    if (!window.cardApi || typeof window.cardApi.onCardDetected !== 'function') {
      registerStatusMsg.textContent = 'Card reader not available';
      registerStatusMsg.className = 'register-status error';
      registerStatusMsg.style.display = 'block';
      cardListenerActive = false;
      return;
    }

    window.cardApi.onCardDetected((payload) => {
      if (!cardListenerActive) return; // Ignore if listener was stopped

      const detected = normalizeDetectedCard(payload);
      const uid = detected.cardUid;
      const cardType = detected.cardType;
      if (!uid) return;

      const existingCard = findCardByUid(uid);
      if (existingCard) {
        registeredCardUid = null;
        registerTapLabel.textContent = 'Card already registered';
        registerTapSub.textContent = `UID: ${uid}`;
        registerStatusMsg.textContent = existingCard.status === 'assigned'
          ? `This card is already registered and assigned to ${existingCard.personnel_name || 'someone'}.`
          : 'This card is already registered. Tap a different card.';
        registerStatusMsg.className = 'register-status error';
        registerStatusMsg.style.display = 'block';
        confirmRegisterBtn.disabled = true;
        return;
      }

      if (!isSupportedCardType(cardType)) {
        registeredCardUid = null;
        registerTapLabel.textContent = 'Unsupported device';
        registerTapSub.textContent = cardType ? `Type: ${cardType}` : `UID: ${uid}`;
        registerStatusMsg.textContent = 'This tap does not look like a supported physical RFID/NFC card. Use a card, not a phone.';
        registerStatusMsg.className = 'register-status error';
        registerStatusMsg.style.display = 'block';
        confirmRegisterBtn.disabled = true;
        return;
      }

      registeredCardUid = uid;
      registerTapLabel.textContent = 'Supported card detected!';
      registerTapSub.textContent = cardType ? `Type: ${cardType} | UID: ${uid}` : `UID: ${uid}`;
      registerStatusMsg.textContent = 'Supported physical card detected. You can register it now.';
      registerStatusMsg.className = 'register-status success';
      registerStatusMsg.style.display = 'block';
      confirmRegisterBtn.disabled = false;
    });
  }

  function stopListeningForCard() {
    cardListenerActive = false;
  }

  async function handleRegisterCard() {
    if (!registeredCardUid) {
      setStatus('No card detected', 'error');
      return;
    }

    try {
      if (!window.cardManagementApi || typeof window.cardManagementApi.registerCard !== 'function') {
        setStatus('Card Management API not available', 'error');
        return;
      }
      confirmRegisterBtn.disabled = true;
      confirmRegisterBtn.textContent = 'Registering...';
      
      await window.cardManagementApi.registerCard({ card_uid: registeredCardUid });
      
      setStatus(`Card ${registeredCardUid} registered successfully`, 'success');
      closeRegisterModal();
      await loadCards();
    } catch (e) {
      let errorMsg = '';
      if (e && e.message) {
        errorMsg = e.message;
      } else if (typeof e === 'string') {
        errorMsg = e;
      } else {
        errorMsg = String(e);
      }

      if (errorMsg.toLowerCase().includes('already registered') || errorMsg.toLowerCase().includes('unique')) {
        if (registerStatusMsg) {
          registerStatusMsg.textContent = 'This card is already registered. Tap a different card.';
          registerStatusMsg.className = 'register-status error';
          registerStatusMsg.style.display = 'block';
        }
        registeredCardUid = null;
        confirmRegisterBtn.disabled = true;
        registerTapLabel.textContent = 'Tap your card';
        registerTapSub.textContent = 'Tap a physical RFID/NFC card once to analyze it';
      } else {
        setStatus(`Error registering card: ${errorMsg}`, 'error');
      }
      confirmRegisterBtn.textContent = 'Register';
    } finally {
      confirmRegisterBtn.disabled = registeredCardUid ? false : true;
    }
  }

  async function handleAssignCard(cardUid) {
    openAssignModal(cardUid);
  }

  async function handleUnassignCard(cardUid) {
    if (!confirm('Unassign this card? It will return to the available pool.')) return;

    try {
      if (!window.cardManagementApi || typeof window.cardManagementApi.unassignCard !== 'function') {
        setStatus('Card Management API not available', 'error');
        return;
      }
      await window.cardManagementApi.unassignCard({ card_uid: cardUid });
      setStatus('Card unassigned', 'success');
      await loadCards();
    } catch (e) {
      setStatus(`Error unassigning card: ${e && e.message ? e.message : e}`, 'error');
      console.error('Error unassigning card:', e);
    }
  }

  // Event listeners
  if (registerBtn) registerBtn.addEventListener('click', openRegisterModal);
  if (closeRegisterBtn) closeRegisterBtn.addEventListener('click', closeRegisterModal);
  if (cancelRegisterBtn) cancelRegisterBtn.addEventListener('click', closeRegisterModal);
  if (confirmRegisterBtn) confirmRegisterBtn.addEventListener('click', handleRegisterCard);
  if (assignModalCloseBtn) assignModalCloseBtn.addEventListener('click', closeAssignModal);
  if (assignModalCancelBtn) assignModalCancelBtn.addEventListener('click', closeAssignModal);
  if (assignModalSearch) assignModalSearch.addEventListener('input', renderPersonnelList);
  if (assignModal) {
    assignModal.querySelectorAll('[data-assign-modal-close]').forEach(el => {
      el.addEventListener('click', closeAssignModal);
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderTable();
    });
  });

  // Public API
  return {
    show: async function() {
      if (view) view.style.display = 'block';
      await loadCards();
    },
    hide: function() {
      if (view) view.style.display = 'none';
      closeRegisterModal();
    }
  };
}
