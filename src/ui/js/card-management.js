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
    <div class="post-save-modal__backdrop" data-post-save-close></div>
    <div class="post-save-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="post-save-title" aria-describedby="post-save-subtitle">
      <div class="post-save-modal__header">
        <div class="post-save-modal__header-main">
          <div class="post-save-modal__eyebrow" id="post-save-eyebrow">Personnel setup</div>
          <h2 class="post-save-modal__title" id="post-save-title">Create Username</h2>
          <p class="post-save-modal__subtitle" id="post-save-subtitle">Set login credentials for the saved personnel record.</p>
        </div>
        <button type="button" class="post-save-modal__close" data-post-save-close aria-label="Close">✕</button>
      </div>

      <div class="post-save-modal__stepper" aria-hidden="true">
        <div class="post-save-stepper__track"></div>
        <div class="post-save-stepper__step post-save-stepper__step--active" data-step-dot="1">
          <span class="post-save-stepper__circle">1</span>
          <span class="post-save-stepper__label">Create Username</span>
        </div>
        <div class="post-save-stepper__step" data-step-dot="2">
          <span class="post-save-stepper__circle">2</span>
          <span class="post-save-stepper__label">Assign Card</span>
        </div>
      </div>

      <div class="post-save-modal__body">
        <section class="post-save-panel" data-step-panel="1">
          <div class="post-save-personnel-chip" id="post-save-personnel-chip-step1"></div>
          <div class="post-save-field">
            <label for="post-save-username">Username</label>
            <input id="post-save-username" type="text" autocomplete="username" spellcheck="false" />
          </div>
          <div class="post-save-field-row">
            <div class="post-save-field">
              <label for="post-save-password">Password</label>
              <input id="post-save-password" type="password" autocomplete="new-password" />
            </div>
            <div class="post-save-field">
              <label for="post-save-confirm-password">Confirm Password</label>
              <input id="post-save-confirm-password" type="password" autocomplete="new-password" />
            </div>
          </div>
          <div class="post-save-field">
            <label>Role</label>
            <div class="post-save-role-group" role="radiogroup" aria-label="Role">
              <button type="button" class="post-save-role-pill is-active" data-role-pill="Viewer">Viewer</button>
              <button type="button" class="post-save-role-pill" data-role-pill="Encoder">Encoder</button>
              <button type="button" class="post-save-role-pill" data-role-pill="Admin">Admin</button>
            </div>
          </div>
          <div class="post-save-error" data-step-error="1" aria-live="polite"></div>
        </section>

        <section class="post-save-panel" data-step-panel="2" hidden>
          <div class="post-save-personnel-chip" id="post-save-personnel-chip-step2"></div>
          <div class="post-save-panel__summary" id="post-save-card-summary">Choose an available card to assign, or skip this step for now.</div>
          <div class="post-save-card-list" id="post-save-card-list" role="list"></div>
          <div class="post-save-empty" id="post-save-card-empty" hidden>No available cards were found.</div>
          <a href="#" class="post-save-skip-link" id="post-save-skip-link">Skip for now — assign card later</a>
          <div class="post-save-error" data-step-error="2" aria-live="polite"></div>
        </section>
      </div>

      <div class="post-save-modal__footer">
        <div class="post-save-footer__left">
          <button type="button" class="btn secondary post-save-back-btn" id="post-save-back-btn" hidden>← Back</button>
        </div>
        <div class="post-save-footer__right">
          <span class="post-save-step-counter" id="post-save-step-counter">Step 1 of 2</span>
          <button type="button" class="btn secondary" data-post-save-close>Cancel</button>
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
    usernameEl: modalEl.querySelector('#post-save-username'),
    passwordEl: modalEl.querySelector('#post-save-password'),
    confirmPasswordEl: modalEl.querySelector('#post-save-confirm-password'),
    roleButtons: Array.from(modalEl.querySelectorAll('[data-role-pill]')),
    personnelChipStep1: modalEl.querySelector('#post-save-personnel-chip-step1'),
    personnelChipStep2: modalEl.querySelector('#post-save-personnel-chip-step2'),
    cardListEl: modalEl.querySelector('#post-save-card-list'),
    cardEmptyEl: modalEl.querySelector('#post-save-card-empty'),
    cardSummaryEl: modalEl.querySelector('#post-save-card-summary'),
    skipLink: modalEl.querySelector('#post-save-skip-link'),
    stepPanels: Array.from(modalEl.querySelectorAll('[data-step-panel]')),
    stepDots: Array.from(modalEl.querySelectorAll('[data-step-dot]')),
    errorEls: {
      1: modalEl.querySelector('[data-step-error="1"]'),
      2: modalEl.querySelector('[data-step-error="2"]'),
    },
  };

  modal.state = {
    step: 1,
    savedRecord: null,
    selectedRole: 'Viewer',
    selectedCardUid: '',
    availableCards: [],
    createdUsername: '',
    createdUser: null,
    loadingCards: false,
    submitting: false,
    open: false,
    finalized: false,
    resolveCompletion: null,
  };
  modal.renderRoleButtons = renderRoleButtons;
  modal.renderPersonnelChips = renderPersonnelChips;
  modal.clearErrors = clearErrors;
  modal.updateHeader = updateHeader;
  modal.updateNextButtonState = updateNextButtonState;

  function setStepError(step, message) {
    const el = modal.errorEls[step];
    if (!el) return;
    el.textContent = normalizePostSaveText(message);
    el.style.display = message ? 'block' : 'none';
  }

  function clearErrors() {
    setStepError(1, '');
    setStepError(2, '');
  }

  function updateHeader(step) {
    const isStep2 = step === 2;
    modal.titleEl.textContent = isStep2 ? 'Assign Card' : 'Create Username';
    modal.subtitleEl.textContent = isStep2
      ? 'Pick an available card now, or skip this step and finish later.'
      : 'Set login credentials for the saved personnel record.';
    modal.eyebrowEl.textContent = isStep2 ? 'Step 2 of 2' : 'Step 1 of 2';
    modal.stepCounterEl.textContent = 'Step ' + step + ' of 2';
    modal.backBtn.hidden = step === 1;
    modal.nextBtn.textContent = isStep2 ? 'Finish ✓' : 'Next →';
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
    const organization = escapePostSaveHtml(getPostSaveOrganization(record));
    const username = escapePostSaveHtml(modal.state.createdUsername || modal.usernameEl.value || buildPostSaveUsername(record));
    const role = escapePostSaveHtml(getPostSaveRoleLabel(modal.state.selectedRole));

    const step1Html = `<div class="post-save-personnel-chip__name">${fullName}</div><div class="post-save-personnel-chip__meta">${position}</div><div class="post-save-personnel-chip__meta">${organization}</div>`;
    const step2Html = `<div class="post-save-personnel-chip__name">${username} · ${role}</div><div class="post-save-personnel-chip__meta">${fullName}</div>`;
    if (modal.personnelChipStep1) modal.personnelChipStep1.innerHTML = step1Html;
    if (modal.personnelChipStep2) modal.personnelChipStep2.innerHTML = step2Html;
  }

  function renderRoleButtons() {
    modal.roleButtons.forEach((button) => {
      const role = button.getAttribute('data-role-pill');
      button.classList.toggle('is-active', role === modal.state.selectedRole);
    });
  }

  function renderCardList() {
    const cards = Array.isArray(modal.state.availableCards) ? modal.state.availableCards : [];
    const selectedUid = modal.state.selectedCardUid;
    if (!cards.length) {
      modal.cardListEl.innerHTML = '';
      modal.cardEmptyEl.hidden = false;
      return;
    }

    modal.cardEmptyEl.hidden = true;
    modal.cardListEl.innerHTML = cards.map((card) => {
      const uid = getCardUid(card);
      const isSelected = uid && uid === selectedUid;
      const type = escapePostSaveHtml(getCardTypeLabel(card));
      const registeredAt = escapePostSaveHtml(formatPostSaveDate(card.registered_at || card.created_at || card.createdAt || card.registeredDate));
      return `
        <button type="button" class="post-save-card-row${isSelected ? ' is-selected' : ''}" data-card-uid="${escapePostSaveHtml(uid)}" role="listitem">
          <div class="post-save-card-row__main">
            <div class="post-save-card-row__uid">${escapePostSaveHtml(uid)}</div>
            <div class="post-save-card-row__meta">${type} · Registered ${registeredAt}</div>
          </div>
          <div class="post-save-card-row__check" aria-hidden="true">${isSelected ? '✓' : ''}</div>
        </button>
      `;
    }).join('');
  }

  async function loadAvailableCards() {
    if (modal.state.loadingCards) return;
    modal.state.loadingCards = true;
    modal.cardSummaryEl.textContent = 'Loading available cards…';
    modal.cardEmptyEl.hidden = true;
    modal.cardListEl.innerHTML = '';

    try {
      if (!window.cardManagementApi) {
        throw new Error('Card Management API not available');
      }
      const getCards = window.cardManagementApi.getCards || window.cardManagementApi.listCards;
      if (typeof getCards !== 'function') {
        throw new Error('Card list API not available');
      }
      const response = await getCards();
      const cards = Array.isArray(response)
        ? response
        : Array.isArray(response && response.cards)
          ? response.cards
          : [];
      modal.state.availableCards = cards.filter((card) => normalizePostSaveText(card && card.status) === 'available');
      modal.cardSummaryEl.textContent = modal.state.availableCards.length
        ? 'Select one available card to assign to this username.'
        : 'No available cards were found.';
      renderCardList();
    } catch (err) {
      modal.state.availableCards = [];
      modal.cardSummaryEl.textContent = 'Could not load cards. You can skip this step and finish later.';
      modal.cardListEl.innerHTML = '';
      modal.cardEmptyEl.hidden = false;
      modal.cardEmptyEl.textContent = 'Unable to load available cards.';
      setStepError(2, err && err.message ? err.message : String(err));
    } finally {
      modal.state.loadingCards = false;
    }
  }

  function updateNextButtonState() {
    modal.nextBtn.disabled = modal.state.submitting || modal.state.loadingCards;
    modal.backBtn.disabled = modal.state.submitting;
    modal.roleButtons.forEach((button) => {
      button.disabled = modal.state.submitting;
    });
    modal.usernameEl.disabled = modal.state.submitting;
    modal.passwordEl.disabled = modal.state.submitting;
    modal.confirmPasswordEl.disabled = modal.state.submitting;
  }

  function closeModal() {
    modal.state.open = false;
    modal.modalEl.classList.remove('is-open');
    modal.modalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('post-save-modal-open');

    if (document.activeElement && modal.modalEl.contains(document.activeElement)) {
      try {
        document.activeElement.blur();
      } catch (_) {}
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

    if (modal.state.step === 1) {
      if (modal.state.createdUser) {
        modal.state.step = 2;
        updateHeader(2);
        renderPersonnelChips();
        updateNextButtonState();
        await loadAvailableCards();
        return;
      }

      const username = normalizePostSaveText(modal.usernameEl.value);
      const password = String(modal.passwordEl.value || '');
      const confirmPassword = String(modal.confirmPasswordEl.value || '');
      const role = normalizePostSaveText(modal.state.selectedRole);

      if (!username || !password || !confirmPassword || !role) {
        setStepError(1, 'Please enter a username, password, confirm the password, and choose a role.');
        return;
      }
      if (password !== confirmPassword) {
        setStepError(1, 'Passwords do not match.');
        return;
      }

      try {
        modal.state.submitting = true;
        updateNextButtonState();

        if (!window.authApi || typeof window.authApi.createUser !== 'function') {
          throw new Error('User creation API not available');
        }

        const response = await window.authApi.createUser({
          username: username,
          password: password,
          personnelId: modal.state.savedRecord && modal.state.savedRecord.id ? modal.state.savedRecord.id : undefined,
          role: role.toLowerCase(),
        });

        modal.state.createdUsername = normalizePostSaveText(
          response && response.user && response.user.username ? response.user.username : username
        );
        modal.state.createdUser = response && response.user ? response.user : null;
        modal.state.step = 2;
        updateHeader(2);
        renderPersonnelChips();
        updateNextButtonState();
        await loadAvailableCards();
        modal.usernameEl.focus();
      } catch (err) {
        setStepError(1, err && err.message ? err.message : String(err));
      } finally {
        modal.state.submitting = false;
        updateNextButtonState();
      }
      return;
    }

    try {
      modal.state.submitting = true;
      updateNextButtonState();

      const selectedCard = modal.state.availableCards.find((card) => getCardUid(card) === modal.state.selectedCardUid) || null;
      if (selectedCard) {
        if (!window.cardManagementApi || typeof window.cardManagementApi.assignCard !== 'function') {
          throw new Error('Card assignment API not available');
        }
        await window.cardManagementApi.assignCard({
          card_uid: getCardUid(selectedCard),
          personnel_id: modal.state.savedRecord && modal.state.savedRecord.id ? modal.state.savedRecord.id : undefined,
          username: modal.state.createdUsername,
        });
      }
      await finalizeModal({
        ok: true,
        createdUsername: modal.state.createdUsername,
        role: modal.state.selectedRole,
        skipped: !selectedCard,
        selectedCardUid: selectedCard ? getCardUid(selectedCard) : null,
      });
    } catch (err) {
      setStepError(2, err && err.message ? err.message : String(err));
    } finally {
      modal.state.submitting = false;
      updateNextButtonState();
    }
  }

  async function handleSkip(event) {
    if (event) event.preventDefault();
    await finalizeModal({
      ok: true,
      createdUsername: modal.state.createdUsername,
      role: modal.state.selectedRole,
      skipped: true,
      selectedCardUid: null,
    });
  }

  modal.backBtn.addEventListener('click', () => {
    if (modal.state.submitting) return;
    clearErrors();
    modal.state.step = 1;
    updateHeader(1);
    renderPersonnelChips();
    updateNextButtonState();
    modal.usernameEl.focus();
  });

  modal.nextBtn.addEventListener('click', handleNext);
  modal.skipLink.addEventListener('click', handleSkip);

  modal.roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (modal.state.submitting) return;
      modal.state.selectedRole = button.getAttribute('data-role-pill') || 'Viewer';
      renderRoleButtons();
      renderPersonnelChips();
    });
  });

  modal.usernameEl.addEventListener('input', () => {
    clearErrors();
    renderPersonnelChips();
  });
  modal.passwordEl.addEventListener('input', () => clearErrors());
  modal.confirmPasswordEl.addEventListener('input', () => clearErrors());

  modal.cardListEl.addEventListener('click', (event) => {
    const button = event.target.closest('.post-save-card-row');
    if (!button || !modal.cardListEl.contains(button)) return;
    const uid = normalizePostSaveText(button.getAttribute('data-card-uid'));
    if (!uid) return;
    modal.state.selectedCardUid = uid;
    renderCardList();
  });

  modal.modalEl.addEventListener('click', (event) => {
    const closeTarget = event.target.closest('[data-post-save-close]');
    if (!closeTarget) return;
    if (modal.state.submitting) return;
    closeModal();
    resolveCompletion({ ok: false, cancelled: true });
  });

  document.addEventListener('keydown', (event) => {
    if (!modal.state.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!modal.state.submitting) {
        closeModal();
        resolveCompletion({ ok: false, cancelled: true });
      }
    }
  });

  postSaveModalState = modal;
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
    modal.state.selectedCardUid = '';
    modal.state.availableCards = [];
    modal.state.createdUsername = normalizePostSaveText(buildPostSaveUsername(modal.state.savedRecord));
    modal.state.createdUser = null;
    modal.state.loadingCards = false;
    modal.state.submitting = false;
    modal.state.open = true;
    modal.state.finalized = false;
    modal.state.resolveCompletion = resolve;

    modal.usernameEl.value = modal.state.createdUsername;
    modal.passwordEl.value = '';
    modal.confirmPasswordEl.value = '';
    modal.cardListEl.innerHTML = '';
    modal.cardEmptyEl.hidden = true;
    modal.cardEmptyEl.textContent = 'No available cards were found.';
    modal.cardSummaryEl.textContent = 'Choose an available card to assign, or skip this step for now.';

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
    return allCards.find(card => String(card.card_uid || '').trim() === normalizedUid) || null;
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
      const cardType = card.card_uid.length > 20 ? 'Smart Card' : 'NFC Type A';
      
      // Better 'Assigned To' label logic
      let assignedTo = 'Unassigned';
      if (card.status === 'assigned') {
        assignedTo = card.personnel_name || card.assigned_user_full_name || (card.personnel_id ? `ID: ${card.personnel_id}` : 'Unknown');
      }

      const statusBadge = card.status === 'available'
        ? '<span class="badge badge-available">Available</span>'
        : `<span class="badge badge-assigned">Assigned</span>`;

      return `
        <tr data-card-uid="${card.card_uid}">
          <td class="card-uid">${card.card_uid}</td>
          <td>${cardType}</td>
          <td>${statusBadge}</td>
          <td>${assignedTo}</td>
          <td class="actions">
            ${card.status === 'available'
                  ? `<button class="btn-action assign-card" data-card-uid="${card.card_uid}">Assign</button>`
              : `<button class="btn-action unassign-card" data-card-uid="${card.card_uid}">Unassign</button>`
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
      allCards = result && result.cards ? result.cards : [];
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
