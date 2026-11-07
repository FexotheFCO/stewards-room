// Disclaimers (DESIGN.md §9): first-visit modal (once), stewards page modal (every entry) + permanent banner.
// No inline scripts or handlers (CSP): everything is built here and wired with addEventListener.
import { t } from './i18n.js';
import { esc } from './safe.js';

export const SEEN_KEY = 'disclaimerSeen:v1'; // bump the version to force everyone to see a changed text again

/** Seen flag: sessionStorage only. It lasts while browsing between pages, and is gone when the tab is closed,
 *  so every new visit to the site shows the notice again. If storage is blocked it shows on each page load. */
export function wasSeen() {
  try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}

function markSeen() {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* blocked: it will show again on the next page */ }
}

/** Open the modal. `stewards` adds the stronger paragraph. Resolves when the user presses the accept button. */
export function showDisclaimer({ stewards = false } = {}) {
  if (document.getElementById('disclaimer')) return;
  const dlg = document.createElement('dialog');
  dlg.id = 'disclaimer';
  dlg.className = 'disclaimer';
  dlg.setAttribute('aria-labelledby', 'disclaimerTitle');
  dlg.innerHTML = `<h2 id="disclaimerTitle">${esc(t(stewards ? 'disclaimer.stewards.title' : 'disclaimer.title'))}</h2>
    <p>${esc(t('disclaimer.body'))}</p>
    ${stewards ? `<p class="strong">${esc(t('disclaimer.stewards'))}</p>` : ''}
    <button type="button" class="accept" autofocus>${esc(t('disclaimer.accept'))}</button>`;
  // Escape must not dismiss it: the owner wants an explicit "I understand".
  dlg.addEventListener('cancel', (e) => e.preventDefault());
  const btn = dlg.querySelector('button');
  btn.addEventListener('click', () => { markSeen(); dlg.close(); dlg.remove(); });
  document.body.append(dlg);
  dlg.showModal();
  btn.focus();
}

/** Permanent highlighted banner for the stewards page. */
function stewardsBanner() {
  const el = document.createElement('div');
  el.className = 'stewards-banner';
  el.setAttribute('role', 'note');
  el.textContent = t('disclaimer.stewards');
  document.querySelector('main')?.prepend(el);
}

/** Called from layout() on every page. `page` is the nav href of the current page. */
export function initDisclaimers(page) {
  const onStewards = page === 'stewards.html';
  if (onStewards) stewardsBanner();
  if (onStewards || !wasSeen()) showDisclaimer({ stewards: onStewards });
  // Footer link to read it again at any time (never as the stewards version: that one is tied to the page).
  document.getElementById('disclaimerLink')?.addEventListener('click', () => showDisclaimer({ stewards: onStewards }));
}
