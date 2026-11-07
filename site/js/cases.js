import { api, layout, table, caseColumns, showError, esc, t, tData, synBadge, groupButtons, typesFromUrl, typesQuery } from '../app.js';
import { gpChart } from '../charts.js';
layout('cases.html');
document.title = `Stewards' Room · ${t('nav.cases')}`;

// [query param, label key, facet name, label for each value]. The infringement type is handled by the buttons above.
const FILTERS = [
  ['gp', 'cases.filter.gp', 'grandsPrix', (v) => tData('gp', v)],
  ['session', 'cases.filter.session', 'sessions', (v) => tData('session', v)],
  ['outcome', 'cases.filter.outcome', 'outcomes', (v) => t('outcome.' + v)],
  ['points', 'cases.filter.points', 'points', (v) => t('points.' + v)],
  ['driver', 'cases.filter.driver', 'drivers', (v) => v],
  ['steward', 'cases.filter.steward', 'stewards', (v) => v],
];
try {
  const meta = await api('/meta');
  const params = new URLSearchParams(location.search);
  const selected = typesFromUrl(meta);
  const box = document.getElementById('filters');
  box.innerHTML = FILTERS.map(([k, labelKey, facet, label]) =>
    `<label>${esc(t(labelKey))}<select data-k="${k}"><option value="">${esc(t('common.all'))}</option>${meta.facets[facet].map((v) =>
      `<option value="${esc(v)}"${params.get(k) === v ? ' selected' : ''}>${esc(label(v))}</option>`).join('')}</select></label>`).join('');

  let seq = 0;
  const load = async () => {
    const mine = ++seq;
    const q = new URLSearchParams();
    box.querySelectorAll('select').forEach((s) => s.value && q.set(s.dataset.k, s.value));
    const tq = typesQuery(selected, meta);
    if (tq) q.set('types', tq.slice('types='.length));
    history.replaceState(null, '', q.size ? '?' + q : location.pathname);
    const apiQ = new URLSearchParams(q);
    if (selected.size === 0) apiQ.set('types', '');
    // The chart follows every filter except the Grand Prix one, so the whole season stays visible.
    const chartQ = new URLSearchParams(apiQ);
    chartQ.delete('gp');
    const [rows, byGp] = await Promise.all([api('/cases?' + apiQ), api('/cases/by-gp?' + chartQ)]);
    if (mine !== seq) return;
    // Clicking a Grand Prix in the chart sets the Grand Prix filter above (clicking it again clears it): one or all.
    const gpSelect = box.querySelector('select[data-k="gp"]');
    gpChart(document.getElementById('gpChart'), byGp, { selected: gpSelect.value || null, onSelect: (gp) => { gpSelect.value = gpSelect.value === gp ? '' : gp; load().catch(showError); } });
    document.getElementById('count').textContent = t('common.casesCount', { n: rows.length });
    table(document.getElementById('cases'), caseColumns({ withDriver: true }), rows, { sortKey: 'grandPrix', desc: false, className: 'list dense' });
  };
  groupButtons(document.getElementById('typeBox'), meta, selected, () => load().catch(showError));
  box.addEventListener('change', () => load().catch(showError));
  await load();
} catch (e) { showError(e); }

/** Summary per infringement type (it used to be its own page). A type opens the cases of that type. */
try {
  const rows = (await api('/types')).map((r) => ({ ...r, pct: r.cases ? Math.round((100 * r.withPoints) / r.cases) : 0 }));
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  table(document.getElementById('types'), [
    { key: 'type', label: t('col.type'), sort: (r) => t('type.' + r.type), html: (r) => `<a href="cases.html?types=${encodeURIComponent(r.type)}">${esc(t('type.' + r.type))}</a>${synBadge(r)}` },
    { key: 'cases', label: t('col.cases'), num: true },
    { key: 'penalized', label: t('col.penalized'), num: true },
    { key: 'reprimands', label: t('col.reprimand'), num: true },
    { key: 'noSanction', label: t('col.none'), num: true },
    { key: 'withPoints', label: t('col.withPoints'), num: true },
    { key: 'pct', label: t('col.pctWithPoints'), num: true, html: (r) => `${r.pct}% <span class="bar" style="width:${Math.max(r.pct * 0.6, 1)}px"></span>` },
    { key: 'pointsAwarded', label: t('col.pointsAwarded'), num: true },
    { key: 'deletedLaps', label: t('col.deletedLaps'), num: true },
  ], rows, { sortKey: 'cases', className: 'list dense', footer: [t('common.total'), sum('cases'), sum('penalized'), sum('reprimands'), sum('noSanction'), sum('withPoints'), '', sum('pointsAwarded'), sum('deletedLaps')] });
} catch (e) { showError(e); }
