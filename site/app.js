// Shared helpers for all pages. No build step: plain ES modules.
import { t, tData, lang, locale, setLang, applyStatic } from './i18n.js';
import { esc, safeUrl, num, avatarHtml } from './safe.js';
import { teamColour, surname } from './teams.js';
import { GROUPS, groupOf } from './groups.js';
import { initDisclaimers } from './disclaimer.js';
import { handleApi } from './lib/api.js'; // not in public/: the dev server serves it at /lib and the static build copies it there
export { t, tData, lang, locale, applyStatic, esc };

/** Escape, then turn `code` spans into <code>. Used for dictionary strings only. */
const withCode = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

// There is no server-side API in the published site: the browser downloads the dataset once and runs the SAME code the
// Express server uses (lib/api.js -> lib/aggregate.js) on it. `api('/cases?session=race')` keeps its old shape.
let dataPromise;
const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
  return res.json();
};
function loadData() {
  // drivers.json (team colours, numbers, photo links) is optional: without it the site just shows no pictures.
  dataPromise ??= Promise.all([getJson('data/dataset.json'), getJson('data/drivers.json').catch(() => ({}))])
    .then(([dataset, profiles]) => ({ dataset, profiles }))
    .catch((e) => { dataPromise = undefined; throw e; }); // a failed load can be retried
  return dataPromise;
}

export async function api(path) {
  const data = await loadData();
  const url = path + (realOnly() ? (path.includes('?') ? '&' : '?') + 'real=1' : '');
  const { status, body } = handleApi(url, data);
  if (status >= 400) throw new Error(body.error || `HTTP ${status}`);
  return structuredClone(body); // pages sort and tweak what they get: never hand out objects shared with the loaded dataset
}

/** Count a number between two values instead of swapping it: 0 -> n on the first draw, old -> new after a filter click.
 *  With "reduce motion" it just shows the final number. */
export function countTo(el, to, from = 0, ms = 700) {
  if (!el) return;
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
  el.textContent = from;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms), eased = 1 - (1 - k) ** 3;
    el.textContent = Math.round(from + (to - from) * eased);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const NAV = [['index.html', 'nav.overview'], ['drivers.html', 'nav.drivers'], ['cases.html', 'nav.cases'], ['stewards.html', 'nav.stewards']];

export function layout(active) {
  // The banner is already in the HTML (empty, with its final height), so it does not push the page down when the dictionaries arrive.
  const top = document.getElementById('top') ?? document.body.insertAdjacentElement('afterbegin', document.createElement('header'));
  top.className = 'top';
  top.innerHTML = `<strong>Stewards' Room</strong><nav>${NAV.map(
      ([href, key]) => `<a href="${href}"${href === active ? ' aria-current="page"' : ''}>${esc(t(key))}</a>`,
    ).join('')}</nav>
    <label class="lang"><span class="sr">${esc(t('lang.label'))}</span>
      <select id="lang" aria-label="${esc(t('lang.label'))}"><option value="es">Español</option><option value="en">English</option></select></label>`;
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot muted"><span>${esc(t('footer.text'))}</span> <button type="button" class="linklike" id="disclaimerLink">${esc(t('footer.notice'))}</button><span class="foot-meta" id="meta"></span></footer>`);
  const sel = document.getElementById('lang');
  sel.value = lang;
  sel.addEventListener('change', () => setLang(sel.value));
  applyStatic();
  initDisclaimers(active);

  api('/meta').then((m) => {
    document.getElementById('meta').textContent = t('meta.line', {
      season: m.season,
      loaded: (m.events ?? []).filter((e) => e.outcomesProcessed > 0).length || m.gpsCovered.length,
      total: (m.events ?? []).length || m.gpsCovered.length,
      date: new Date(m.generatedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }),
    });
    if (m.synthetic) {
      document.querySelector('header.top')?.insertAdjacentHTML('afterend', `<div class="synthetic-banner" role="alert">${esc(t('banner.synthetic'))} <label class="realonly"><input type="checkbox" id="realOnly"${realOnly() ? ' checked' : ''}> ${esc(t('toggle.realOnly'))}</label></div>`);
      document.getElementById('realOnly')?.addEventListener('change', (e) => { try { localStorage.setItem('realOnly', e.target.checked ? '1' : '0'); } catch { /* private mode */ } location.reload(); });
    }
    if (m.origin === 'seed') {
      document.querySelector('main')?.insertAdjacentHTML('afterbegin', `<div class="notice">${withCode(t('notice.seed'))}</div>`);
    }
  }).catch(() => {});
}

export const outcomeBadge = (o) =>
  `<span class="badge ${o === 'penalized' ? 'pen' : o === 'reprimand' ? 'rep' : 'none'}">${esc(t('outcome.' + o))}</span>`;

export const pdfLink = (url, label = t('common.pdf')) => { const u = safeUrl(url); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '—'; };
export const driverLink = (name, slug, profile) => `${avatarHtml(profile)}<a href="driver.html?d=${encodeURIComponent(slug)}">${esc(name)}</a>`;
export { avatarHtml };
/** Red tag for fake rows (only exists while --synthetic is on). */
export const synBadge = (row) => {
  // Rows with counts (driver / type aggregates): all fake -> SYNTHETIC, mixed -> "incl. synthetic". Single records use .synthetic.
  const n = row.syntheticCases;
  if (n !== undefined) {
    if (!n) return '';
    return n >= row.cases ? ` <span class="badge syn">${esc(t('badge.synthetic'))}</span>` : ` <span class="badge syn mixed">${esc(t('badge.syntheticIncl'))}</span>`;
  }
  return row.synthetic ? ` <span class="badge syn">${esc(t('badge.synthetic'))}</span>` : '';
};

/** Synthetic mode only: "Real data only" switch (kept in localStorage); the API drops fake rows when real=1. */
export const realOnly = () => { try { return localStorage.getItem('realOnly') === '1'; } catch { return false; } };

/** Licence points of a case: "+2 (total 4)", "0" (penalty without points) or "—" (not applicable). */
export function pointsCell(c) {
  const p = c.licencePoints;
  if (p == null) return t('points.cell.na');
  if (!p.awarded) return t('points.cell.none');
  return p.total12m != null ? t('points.cell.total', { n: p.awarded, total: p.total12m }) : t('points.cell.plain', { n: p.awarded });
}

/** Selected infringement types from the address: ?types=a,b (empty = none), old ?type=a, absent = all. */
export function typesFromUrl(meta) {
  const all = meta.facets.types.map((x) => x.type);
  const p = new URLSearchParams(location.search);
  if (p.has('types')) return new Set(p.get('types').split(',').filter((x) => all.includes(x)));
  if (all.includes(p.get('type'))) return new Set([p.get('type')]);
  return new Set(all);
}

/** Query-string piece for the API: '' = all types, 'types=' = none, 'types=a,b' = only those. */
export function typesQuery(selected, meta) {
  const all = meta.facets.types.map((x) => x.type);
  if (all.every((x) => selected.has(x))) return '';
  return 'types=' + all.filter((x) => selected.has(x)).map(encodeURIComponent).join(',');
}

/** Keep the address bar in sync (no reload) so a selection can be bookmarked or shared. */
export function syncTypesUrl(selected, meta) {
  const u = new URL(location.href);
  u.searchParams.delete('type');
  u.searchParams.delete('types');
  const q = typesQuery(selected, meta);
  if (q) u.searchParams.set('types', q.slice('types='.length));
  history.replaceState(null, '', u);
}

/**
 * Slanted toggle buttons per GROUP of infringement types (see groups.js), used on every page with a type filter. The
 * `selected` set and the ?types= address always hold EXACT types, so the page can later be switched back to exact-type buttons
 * (or both) without touching the data or the address. A group is pressed when all its types are selected, "mixed" when
 * only some are (e.g. an address with ?types=pit-lane-speeding). Only groups the driver has at least one type in are shown.
 * The first button, "All", selects every type, or clears them when all are already selected. Clicking a group while
 * everything is selected leaves only that group selected; otherwise a click toggles the group. Each name carries its
 * count in brackets, from the facet counts (they do not change with the filters).
 */
export function groupButtons(el, meta, selected, onChange, label = t('overview.type')) {
  const facet = meta.facets.types;
  const present = facet.map((x) => x.type);
  const groups = GROUPS.filter((g) => present.some((ty) => groupOf(ty) === g));
  const typesIn = (g) => present.filter((ty) => groupOf(ty) === g);
  const draw = (focusGroup) => {
    const allOn = present.every((ty) => selected.has(ty));
    el.innerHTML = `<div class="tabs" role="group" aria-label="${esc(label)}"><button type="button" class="tab" data-all="1" aria-pressed="${allOn}" title="${esc(t('types.clearHint'))}"><span>${esc(t('types.all'))}</span></button>${groups.map((g) => {
      const ts = typesIn(g), on = ts.filter((ty) => selected.has(ty)).length;
      const state = on === ts.length ? 'true' : on ? 'mixed' : 'false';
      // The count of the group, in brackets: its cases (or, for a group with only deleted laps, those).
      const cases = facet.filter((x) => groupOf(x.type) === g).reduce((a, x) => a + num(x.cases), 0);
      const laps = facet.filter((x) => groupOf(x.type) === g).reduce((a, x) => a + num(x.deletedLaps), 0);
      const count = cases || !laps ? cases : t('chip.laps', { n: laps });
      return `<button type="button" class="tab" data-group="${esc(g)}" aria-pressed="${state}"><span>${esc(t('group.' + g))} (${esc(count)})</span></button>`;
    }).join('')}</div>${selected.size ? '' : `<p class="muted">${esc(t('types.none'))}</p>`}`;
    el.querySelectorAll('button.tab').forEach((b) => b.addEventListener('click', () => {
      // "All": everything on, or everything off when it already is (a second click clears the selection).
      const ts = b.dataset.all ? present : typesIn(b.dataset.group);
      if (!b.dataset.all && present.every((ty) => selected.has(ty))) {
        // Everything is selected and a group is clicked: keep ONLY that group (the usual way to focus on one).
        selected.clear(); ts.forEach((ty) => selected.add(ty));
      } else if (ts.every((ty) => selected.has(ty))) ts.forEach((ty) => selected.delete(ty)); else ts.forEach((ty) => selected.add(ty));
      draw(b.dataset.all ? 'all' : b.dataset.group);
      onChange(selected);
    }));
    if (focusGroup) el.querySelector(focusGroup === 'all' ? '.tab[data-all]' : `.tab[data-group="${focusGroup}"]`)?.focus(); // keep keyboard focus on the button just pressed
  };
  draw();
}

export const stat = (n, label) => `<div class="card"><div class="n">${num(n)}</div><div class="l">${esc(label)}</div></div>`;

/**
 * Render a table. cols: [{ key, label, num?, html?(row), sort?(row) }]. Click headers to sort.
 */
export function table(el, cols, rows, { sortKey, desc = true, footer, className = '', rowAttr, textAscFirst = false } = {}) {
  let key = sortKey, dir = desc;
  const val = (c, r) => (c.sort ? c.sort(r) : r[c.key]);
  const draw = () => {
    const col = cols.find((c) => c.key === key);
    const data = [...rows];
    if (col) {
      data.sort((a, b) => {
        const x = val(col, a), y = val(col, b);
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), lang);
        return dir ? -r : r;
      });
    }
    el.innerHTML = rows.length
      ? `<div class="tablewrap${className ? ' ' + esc(className) : ''}"><table><thead><tr>${cols.map((c) =>
          `<th data-sort="${c.key}"${c.num ? ' class="num"' : ''}>${esc(c.label)}${c.key === key ? `<span class="arrow"> ${dir ? '▼' : '▲'}</span>` : ''}</th>`).join('')}</tr></thead>
          <tbody>${data.map((r) => `<tr${rowAttr ? rowAttr(r) : ''}>${cols.map((c) =>
            `<td${c.num ? ' class="num"' : ''}>${c.html ? c.html(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody>
          ${footer ? `<tfoot><tr>${footer.map((f, i) => `<td${cols[i]?.num ? ' class="num"' : ''}>${esc(f)}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`
      : `<div class="tablewrap"><div class="empty">${esc(t('common.noResults'))}</div></div>`;
    el.querySelectorAll('th[data-sort]').forEach((th) =>
      th.addEventListener('click', () => {
        dir = th.dataset.sort === key ? !dir : !(textAscFirst && !cols.find((c) => c.key === th.dataset.sort)?.num); // text columns: A-Z first
        key = th.dataset.sort;
        draw();
      }));
  };
  draw();
}

export const showError = (err) => {
  document.querySelector('main').insertAdjacentHTML('afterbegin', `<div class="notice">${esc(t('common.error'))}: ${esc(err.message)}</div>`);
};

/** Columns shared by the cases table (cases page and driver page). */
export const caseColumns = ({ withGp = true, withDriver = false } = {}) => [
  ...(withGp ? [{ key: 'grandPrix', label: t('col.gp'), sort: (r) => tData('gp', r.grandPrix), html: (r) => esc(tData('gp', r.grandPrix)) }] : []),
  ...(withDriver ? [
    { key: 'driver', label: t('col.driver'), html: (r) => driverLink(r.driver, r.driverSlug) + synBadge(r) },
  ] : []),
  { key: 'infringementType', label: t('col.type'), sort: (r) => t('type.' + r.infringementType), html: (r) => esc(t('type.' + r.infringementType)) },
  { key: 'session', label: t('col.session'), html: (r) => esc(tData('session', r.session)) },
  { key: 'fact', label: t('col.fact'), html: (r) => `<span title="${esc(t('common.originalText'))}">${esc(r.fact)}</span>${synBadge(r)}` },
  { key: 'outcome', label: t('col.outcome'), html: (r) => outcomeBadge(r.outcome) },
  { key: 'penaltyType', label: t('col.sanction'), sort: (r) => t('penalty.' + r.penaltyType), html: (r) => esc(t('penalty.' + r.penaltyType)) },
  { key: 'licencePoints', label: t('col.points'), num: true, sort: (r) => r.licencePoints?.awarded ?? -1, html: (r) => esc(pointsCell(r)) },
  { key: 'decision', label: t('col.decision'), html: (r) => `<div class="decision" title="${esc(t('common.originalText'))}">${esc(r.decision)}</div>` },
  { key: 'stewards', label: t('col.stewards'), sort: (r) => r.stewards.length, html: (r) => esc(r.stewards.join(', ')) || '—' },
  { key: 'pdf', label: t('col.source'), html: (r) => pdfLink(r.pdf) },
];
