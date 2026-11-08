import { api, layout, table, countTo, showError, t, synBadge, groupButtons, typesFromUrl, typesQuery, syncTypesUrl } from '../app.js';
import { esc, num, photoHtml } from '../safe.js';
import { teamRowAttr, teamLogoHtml } from '../teams.js';
layout('index.html');
document.title = `Stewards' Room · ${t('nav.overview')}`;

const teamOf = (r) => r.profile?.team ?? r.team;
// Team cell: just the logo (alt/title = team name). The column is sortable, so the list can be grouped by team.
const teamCell = (r) => teamLogoHtml(teamOf(r));

// Driver cell: photo, name (link to the driver page) and car number.
const driverCell = (r) => {
  const p = r.profile;
  const number = p?.number != null && Number.isFinite(Number(p.number)) ? `<span class="drv-num">#${num(p.number)}</span>` : '';
  return `<div class="drv-cell">${photoHtml(p)}`
    + `<span class="drv-name"><a href="driver.html?d=${encodeURIComponent(r.slug)}">${esc(r.driver)}</a>${synBadge(r)}</span>${number}</div>`;
};

const cols = [
  { key: 'team', label: t('col.team'), html: teamCell, sort: teamOf },
  { key: 'driver', label: t('col.driver'), html: driverCell },
  { key: 'cases', label: t('col.cases'), num: true },
  { key: 'penalized', label: t('col.penalized'), num: true },
  { key: 'reprimands', label: t('col.reprimand'), num: true },
  { key: 'noSanction', label: t('col.none'), num: true },
  { key: 'pointsAwarded', label: t('col.licencePoints'), num: true },
  { key: 'points12m', label: t('col.points12m'), num: true, html: (r) => (r.points12m == null ? '—' : r.points12m) },
];

try {
  const meta = await api('/meta');
  const selected = typesFromUrl(meta);
  let summary = null;
  let seq = 0;
  let prevCards = []; // last totals, so a filter click counts from the old number to the new one

  function drawDrivers() {
    const rows = summary.drivers;
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    table(document.getElementById('drivers'), cols, rows, {
      sortKey: 'cases', className: 'list compact', textAscFirst: true, rowAttr: (r) => `${teamRowAttr(r.profile)} data-href="driver.html?d=${encodeURIComponent(r.slug)}"`,
      footer: ['', t('common.total'), ...cols.slice(2).map((c) => (c.key === 'points12m' ? '' : sum(c.key)))],
    });
  }

  document.getElementById('season').textContent = t('overview.season', { season: meta.season });

  async function render() {
    const mine = ++seq;
    const q = typesQuery(selected, meta);
    const s = await api('/summary' + (q ? '?' + q : ''));
    if (mine !== seq) return; // a newer click already asked for fresher data
    summary = s;
    const tot = s.totals;
    // Same order as the design: cases and points on the first row, then penalized / not penalized / reprimands.
    const item = ([n, l]) => `<div><dt>${esc(l)}</dt><dd>${num(n)}</dd></div>`;
    const row = (items) => `<div class="ov-row">${items.map(item).join('')}</div>`;
    document.getElementById('cards').innerHTML =
      row([[tot.cases, t('overview.cardCases')], [tot.pointsAwarded, t('overview.cardPoints')]])
      + row([[tot.penalized, t('overview.cardPenalized')], [tot.notPenalized, t('overview.cardNotPenalized')], [tot.reprimands, t('overview.cardReprimands')]]);
    // Numbers count up on the first draw and between old and new values after a filter click.
    const vals = [tot.cases, tot.pointsAwarded, tot.penalized, tot.notPenalized, tot.reprimands].map(num);
    document.querySelectorAll('#cards dd').forEach((dd, k) => countTo(dd, vals[k], prevCards[k] ?? 0));
    prevCards = vals;
    // The rows rise in once, on the first draw only (sorting redraws the table and must not replay it).
    const list = document.getElementById('drivers');
    if (!list.dataset.entered) { list.dataset.entered = '1'; list.classList.add('is-entering'); setTimeout(() => list.classList.remove('is-entering'), 1800); }
    drawDrivers();
  }

  // The whole row opens the driver (the name is still a normal link for keyboard and middle-click). One listener on the
  // container: the list is redrawn on every sort.
  document.getElementById('drivers').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-href]');
    if (!tr || e.target.closest('a') || e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey) window.open(tr.dataset.href, '_blank', 'noopener');
    else location.href = tr.dataset.href;
  });

  groupButtons(document.getElementById('typeBox'), meta, selected, () => { syncTypesUrl(selected, meta); render().catch(showError); });
  await render();
} catch (e) { showError(e); }
