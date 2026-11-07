// The read-only "API" as a pure function: (path + query string, data) -> { status, body }.
// No Node or Express imports, so the same code runs in the Express server (src/server/routes.js)
// and in the browser (public/app.js), which is what lets the site be published as static files.
import { summarize, driverDetail, filterCases, casesByGp, stewardStats, facets, typeStats, driverSlug } from './aggregate.js';

const NOT_FOUND = { status: 404, body: { error: 'Not found' } };

/** ?real=1 hides synthetic rows (synthetic mode only). meta.synthetic stays true so the banner and switch remain. */
function view(dataset, q) {
  if (q.get('real') !== '1' || !dataset.meta.synthetic) return dataset;
  const cases = dataset.cases.filter((c) => !c.synthetic);
  const deletedLaps = dataset.deletedLaps.filter((l) => !l.synthetic);
  const gps = new Set([...cases, ...deletedLaps].map((x) => x.grandPrix));
  return { ...dataset, cases, deletedLaps, meta: { ...dataset.meta, gpsCovered: dataset.meta.gpsCovered.filter((g) => gps.has(g)) } };
}

/** ?types=a,b,c selects any combination; ?types= (empty) selects none; no param = all types; ?type=a is the old single form. */
function typesOf(q) {
  if (q.has('types')) return String(q.get('types')).slice(0, 2000).split(',').slice(0, 50).map((s) => s.trim().slice(0, 60)).filter(Boolean);
  if (q.get('type')) return [String(q.get('type'))];
  return undefined;
}

/**
 * @param {string} url      e.g. '/cases?session=race&types=a,b' (the part after /api)
 * @param {{dataset: object, profiles?: Record<string, object>}} data  dataset already stripped of hidden rows; profiles = slug -> driver profile
 * @returns {{status: number, body: object}}
 */
export function handleApi(url, { dataset, profiles = {} }) {
  const u = new URL(url, 'http://local');
  const q = u.searchParams;
  const path = u.pathname.replace(/\/+$/, '') || '/';
  const profileOf = (slug) => profiles[slug] ?? null; // team colour / photo; null when update:drivers was never run
  const d = () => view(dataset, q);
  const ok = (body) => ({ status: 200, body });

  if (path === '/meta') {
    const v = d();
    return ok({ ...v.meta, counts: { cases: v.cases.length, deletedLaps: v.deletedLaps.length }, facets: facets(v) });
  }
  if (path === '/summary') {
    const s = summarize(d(), { types: typesOf(q) });
    return ok({ ...s, drivers: s.drivers.map((x) => ({ ...x, profile: profileOf(x.slug) })) });
  }
  if (path === '/types') return ok(typeStats(d()));
  const m = path.match(/^\/drivers\/([^/]+)$/);
  if (m) {
    let slug;
    try { slug = decodeURIComponent(m[1]); } catch { return NOT_FOUND; }
    const det = driverDetail(d(), slug, { types: typesOf(q) });
    if (!det) return { status: 404, body: { error: 'Driver not found' } };
    return ok({ ...det, profile: profileOf(det.slug) });
  }
  // Same filters as /cases (the gp filter is ignored): one row per Grand Prix, in calendar order, for the chart.
  if (path === '/cases/by-gp') {
    const f = Object.fromEntries(['session', 'outcome', 'driver', 'steward', 'points'].map((k) => [k, q.get(k) ?? undefined]));
    return ok(casesByGp(d(), { ...f, types: typesOf(q) }));
  }
  if (path === '/cases') {
    const f = Object.fromEntries(['gp', 'session', 'outcome', 'driver', 'steward', 'points'].map((k) => [k, q.get(k) ?? undefined]));
    return ok(filterCases(d(), { ...f, types: typesOf(q) }).map((c) => ({ ...c, driverSlug: driverSlug(c.driver) })));
  }
  if (path === '/stewards') return ok(stewardStats(d(), { types: typesOf(q) }));
  return NOT_FOUND;
}
