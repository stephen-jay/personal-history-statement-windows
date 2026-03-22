/**
 * Primary sidebar: Roster | Reports only. PHS form is not a tab.
 * @param {'list'|'analytics'|'none'} tabName
 */
export function setActiveNav(tabName) {
  document.querySelectorAll('.nav-item').forEach(function (t) {
    if (tabName === 'none') {
      t.classList.remove('active');
      t.removeAttribute('aria-current');
    } else {
      const isActive = t.getAttribute('data-tab') === tabName;
      t.classList.toggle('active', isActive);
      if (isActive) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    }
  });
}

export function setAppView(view) {
  document.body.dataset.appView = view;
}

export function setTopbarSection(el, text) {
  if (el) el.textContent = text;
}
