import { api, layout, table, countTo, caseColumns, showError, esc, t, tData, synBadge, groupButtons, typesFromUrl, typesQuery, syncTypesUrl } from '../app.js';
import { gpChart } from '../charts.js';
import { num, stripAccents, photoSrc } from '../safe.js';
import { teamColour, byCarNumber, neighbours, rememberTeams, bigPhoto } from '../teams.js';
import { flagHtml, driverCountry } from '../flags.js';
layout('drivers.html');

const LICENCE_LIMIT = 12; // licence points that trigger a race ban (FIA)

/** Left / right arrows to the driver before and after this one, in car-number order, going round (Figma node 33:2037).
 *  The arrow keys do the same. If the list cannot be loaded, or this driver is not in it, there are simply no arrows. */
async function buildPager(currentSlug) {
  const box = document.getElementById('pager');
  try {
    const { drivers } = await api('/summary');
    rememberTeams(drivers);
    const { prev, next } = neighbours(byCarNumber(drivers.filter((d) => /^[a-z0-9-]+$/.test(d.slug ?? ''))), currentSlug);
    if (!prev || !next) return;
    const href = (d) => 'driver.html?d=' + encodeURIComponent(d.slug);
    box.innerHTML = `<a class="pg pg-prev" href="${href(prev)}" rel="prev" aria-label="${esc(t('driver.prev', { name: prev.driver }))}" title="${esc(prev.driver)}"><i class="chev"></i></a>
      <a class="pg pg-next" href="${href(next)}" rel="next" aria-label="${esc(t('driver.next', { name: next.driver }))}" title="${esc(next.driver)}"><i class="chev"></i></a>`;
    // Warm the cache with the photos of the two neighbours, so the arrows show the next photo straight away.
    for (const d of [prev, next]) { const big = bigPhoto(d.profile, d.slug); if (big) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = big.src; } }
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
      if (e.key === 'ArrowLeft') location.href = href(prev);
      else if (e.key === 'ArrowRight') location.href = href(next);
    });
  } catch { box.innerHTML = ''; }
}

/** Team-colour header: large photo, name + number, team, licence points (real 12-month standing, never filtered) and the
 *  case counts (filled by paint(), they follow the infringement-type filter). */
function buildHero(first) {
  const hero = document.getElementById('hero');
  const p = first.profile;
  // The whole page takes the team colour (background + glows), not just the header: see body.team-page in styles.css.
  document.body.classList.add('team-page');
  document.body.style.setProperty('--team', '#' + teamColour(p));
  const photo = bigPhoto(p, first.slug);
  const last = [...first.pointsTimeline].sort((a, b) => String(a.date).localeCompare(String(b.date))).at(-1);
  const points = last ? last.total12m : 0; // null = the document did not state the running total
  const number = p?.number != null && Number.isFinite(Number(p.number)) ? `<span class="hero-num">${num(p.number)}</span>` : '';
  hero.innerHTML = `${photo ? `<img class="hero-photo${photo.remote ? ' remote' : ''}" src="${photo.src}" alt="" ${photo.remote ? 'width="884" height="884"' : 'width="1336" height="2100"'} referrerpolicy="no-referrer">` : ''}
    <div class="hero-info">
      <div class="hero-head"><h1 class="hero-name">${esc(stripAccents(first.driver))}${synBadge({ syntheticCases: first.cases.filter((c) => c.synthetic).length, cases: first.cases.length })}</h1>${number}</div>
      <div class="hero-team">${flagHtml(driverCountry(first.driver), 'hero-flag')}<span>${esc(p?.team ?? first.team ?? '')}</span></div>
      <div class="hero-licence"><span>${esc(t('col.licencePoints'))}</span><b>${points == null ? '—' : num(points)}/${LICENCE_LIMIT}</b></div>
      <dl class="hero-stats" id="heroStats"></dl>
    </div>`;
  // The large local photo only exists on the developer's machine: fall back to the small headshot, or drop it, if it is missing.
  const img = hero.querySelector('.hero-photo');
  if (img) { const show = () => img.classList.add('loaded'); if (img.complete) show(); else { img.addEventListener('load', show, { once: true }); img.addEventListener('error', show, { once: true }); } }
  img?.addEventListener('error', () => {
    const small = photoSrc(p, 4);
    if (small && !img.dataset.fallback && img.getAttribute('src') !== small) { img.dataset.fallback = '1'; img.classList.add('remote'); img.src = small; }
    else img.remove();
  });
}

try {
  const slug = new URLSearchParams(location.search).get('d') ?? '';
  const url = (q) => '/drivers/' + encodeURIComponent(slug) + (q ? '?' + q : '');
  // First request is unscoped: it gives the title and the list of types THIS driver has (for the buttons).
  const first = await api(url(''));
  document.title = `Stewards' Room · ${first.driver}`;
  buildHero(first);
  buildPager(first.slug);

  const pseudoMeta = { facets: { types: first.types } }; // same shape groupButtons expects, limited to this driver's types
  const selected = typesFromUrl(pseudoMeta);
  let seq = 0;
  let prevStats = []; // last header numbers, to count from them after a filter click
  let last = null; // the profile being shown (follows the type filter)
  let gpSel = null; // Grand Prix picked in the chart: one (FIA event name) or null = all, never a combination

  function paint(d) {
    last = d;
    const s = d.stats;
    // The header shows cases / penalized / reprimand / no sanction.
    document.getElementById('heroStats').innerHTML = [
      [s.cases, t('col.cases')], [s.penalized, t('col.penalized')], [s.reprimands, t('col.reprimand')], [s.noSanction, t('col.none')],
    ].map(([n, l]) => `<div><dt>${esc(l)}</dt><dd>${num(n)}</dd></div>`).join('');
    const nums = [s.cases, s.penalized, s.reprimands, s.noSanction].map(num);
    document.querySelectorAll('#heroStats dd').forEach((dd, k) => countTo(dd, nums[k], prevStats[k] ?? 0));
    prevStats = nums;
    drawGp();
  }

  /** The chart and the two lists: they follow the Grand Prix picked in the chart (the header numbers and cards do not). */
  function drawGp() {
    const d = last;
    const row = d.byGrandPrix.find((r) => r.grandPrix === gpSel);
    if (!row || !row.cases) gpSel = null; // e.g. the type filter left that Grand Prix empty
    const inGp = (x) => !gpSel || x.grandPrix === gpSel;
    // The bars grow in on the first draw only (a click or a filter redraws the chart and must not replay it).
    const chartBox = document.getElementById('gpChart');
    if (!chartBox.dataset.entered) { chartBox.dataset.entered = '1'; chartBox.classList.add('is-entering'); setTimeout(() => chartBox.classList.remove('is-entering'), 2200); }
    gpChart(chartBox, d.byGrandPrix, { selected: gpSel, onSelect: (gp) => { gpSel = gp === gpSel ? null : gp; drawGp(); } });

    const tl = d.pointsTimeline.filter(inGp);
    if (!tl.length) document.getElementById('points').innerHTML = `<div class="tablewrap"><div class="empty">${esc(t('driver.pointsNone'))}</div></div>`;
    else {
      table(document.getElementById('points'), [
        { key: 'grandPrix', label: t('col.gp'), sort: (r) => tData('gp', r.grandPrix), html: (r) => esc(tData('gp', r.grandPrix)) },
        { key: 'infringementType', label: t('col.type'), sort: (r) => t('type.' + r.infringementType), html: (r) => esc(t('type.' + r.infringementType)) },
        { key: 'awarded', label: t('col.awarded'), num: true, html: (r) => '+' + r.awarded },
        { key: 'total12m', label: t('col.points12m'), num: true, html: (r) => (r.total12m == null ? '—' : r.total12m) },
      // Oldest first, as the list in the design has no date column to sort by (the other columns can still be clicked).
      ], [...tl].sort((a, b) => String(a.date).localeCompare(String(b.date))), { className: 'list' });
    }
    table(document.getElementById('cases'), caseColumns(), d.cases.filter(inGp), { sortKey: 'grandPrix', desc: false, className: 'list dense' });
  }

  async function render() {
    const mine = ++seq;
    const q = typesQuery(selected, pseudoMeta);
    const d = q ? await api(url(q)) : first; // all types selected = the unscoped profile we already have
    if (mine !== seq) return; // a newer click already asked for fresher data
    paint(d);
  }

  groupButtons(document.getElementById('typeBox'), pseudoMeta, selected, () => { syncTypesUrl(selected, pseudoMeta); render().catch(showError); });
  paint(first.types.length && typesQuery(selected, pseudoMeta) === '' ? first : await api(url(typesQuery(selected, pseudoMeta))));
} catch (e) { showError(e); }
