import { api, layout, table, showError, esc, t, groupButtons, typesFromUrl, typesQuery, syncTypesUrl } from '../app.js';
layout('stewards.html');
document.title = `Stewards' Room · ${t('nav.stewards')}`;
const code = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const cols = () => [
  { key: 'steward', label: t('col.steward'), html: (r) => `<a href="cases.html?steward=${encodeURIComponent(r.steward)}">${esc(r.steward)}</a>` },
  { key: 'cases', label: t('col.cases'), num: true },
  { key: 'penalized', label: t('col.penalized'), num: true },
  { key: 'reprimands', label: t('col.reprimand'), num: true },
  { key: 'noSanction', label: t('col.none'), num: true },
];
try {
  const meta = await api('/meta');
  const selected = typesFromUrl(meta);
  const pick = document.getElementById('pick');
  let seq = 0;

  async function render() {
    const mine = ++seq;
    const q = typesQuery(selected, meta);
    const s = await api('/stewards' + (q ? '?' + q : ''));
    if (mine !== seq) return;
    const driverPart = document.getElementById('driverPart');
    document.getElementById('missing').textContent = s.casesWithoutStewards ? t('stewards.missing', { n: s.casesWithoutStewards }) : '';
    if (!s.stewards.length) {
      // Nothing selected -> the buttons already say so; otherwise this dataset has no steward names.
      document.getElementById('stewards').innerHTML = selected.size ? `<div class="notice">${code(t('stewards.empty'))}</div>` : '';
      driverPart.hidden = true;
      return;
    }
    driverPart.hidden = false;
    table(document.getElementById('stewards'), cols(), s.stewards, { sortKey: 'cases', className: 'list' });
    const keep = pick.value;
    pick.innerHTML = s.byDriver.map((d) => `<option value="${esc(d.slug)}">${esc(d.driver)}</option>`).join('');
    if (s.byDriver.some((d) => d.slug === keep)) pick.value = keep;
    const draw = () => {
      const d = s.byDriver.find((x) => x.slug === pick.value) ?? s.byDriver[0];
      table(document.getElementById('byDriver'), cols(), d.stewards, { sortKey: 'cases', className: 'list' });
    };
    pick.onchange = draw;
    draw();
  }

  groupButtons(document.getElementById('typeBox'), meta, selected, () => { syncTypesUrl(selected, meta); render().catch(showError); });
  await render();
} catch (e) { showError(e); }
