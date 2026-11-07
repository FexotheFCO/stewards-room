// Tiny i18n: dictionaries in /i18n/{es,en}.json, language from ?lang= > localStorage > browser.
const SUPPORTED = ['es', 'en'];
const LOCALES = { es: 'es-AR', en: 'en-GB' };

function detect() {
  const q = new URLSearchParams(location.search).get('lang');
  if (SUPPORTED.includes(q)) { try { localStorage.setItem('lang', q); } catch { /* private mode */ } return q; }
  let saved = null;
  try { saved = localStorage.getItem('lang'); } catch { /* private mode */ }
  if (SUPPORTED.includes(saved)) return saved;
  return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const lang = detect();
export const locale = LOCALES[lang];
document.documentElement.lang = lang;

const [dict, fallback] = await Promise.all(
  [lang, 'en'].map((l) => fetch(`i18n/${l}.json`).then((r) => r.json())),
);

/** Translate a key; {name} placeholders are replaced from vars. Missing keys fall back to English, then to the key. */
export function t(key, vars = {}) {
  const s = dict[key] ?? fallback[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

/** Translate a data value (GP name, session) when the dictionary knows it; otherwise show it as printed. */
export const tData = (prefix, value) => dict[`${prefix}.${value}`] ?? fallback[`${prefix}.${value}`] ?? value;

export function setLang(l) {
  try { localStorage.setItem('lang', l); } catch { /* private mode */ }
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.href = u.toString();
}

/** Fill static markup: data-i18n -> textContent, data-i18n-placeholder -> placeholder. */
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
}
