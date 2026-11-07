// Aggregates derived at request time from dataset.json (nothing here is stored).
import { OUTCOMES } from './outcome.js';
import { slugify } from './names.js';

const bump = (o, c) => {
  o.cases++;
  if (c.outcome === OUTCOMES.PENALIZED) o.penalized++;
  else if (c.outcome === OUTCOMES.REPRIMAND) o.reprimands++;
  else o.noSanction++;
  o.notPenalized = o.reprimands + o.noSanction;
  const p = c.licencePoints?.awarded ?? 0;
  o.pointsAwarded += p;
  if (p > 0) o.withPoints++;
};
const blank = () => ({ cases: 0, penalized: 0, reprimands: 0, noSanction: 0, notPenalized: 0, pointsAwarded: 0, withPoints: 0 });

export const driverSlug = (name) => slugify(name);

/** 'awarded' (points given) | 'none' (penalty without points) | 'na' (reprimand / no sanction). */
export const pointsState = (c) => (c.licencePoints == null ? 'na' : c.licencePoints.awarded > 0 ? 'awarded' : 'none');

const byDateThenDoc = (a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')) || (a.doc ?? 0) - (b.doc ?? 0);

/**
 * Chronological order of Grands Prix. Preferred source: the weekend dates printed in the PDF headers (meta.calendar).
 * Fallback: the earliest case date of that GP. GPs with neither go last, alphabetically.
 */
export function gpOrder(ds) {
  const start = new Map((ds.meta.calendar ?? []).map((e) => [e.grandPrix, e.start]));
  for (const c of ds.cases) if (c.date && (!start.has(c.grandPrix) || (!ds.meta.calendar?.some((e) => e.grandPrix === c.grandPrix) && c.date < start.get(c.grandPrix)))) start.set(c.grandPrix, c.date);
  return (a, b) => (start.get(a) ?? '9999').localeCompare(start.get(b) ?? '9999') || a.localeCompare(b);
}

/**
 * Types selected by a query: { types: ['a','b'] } (any combination; [] means none) or the older single { type: 'a' }.
 * Returns a Set, or null when no type filter was given (= all types).
 */
export function typeSet(q = {}) {
  if (Array.isArray(q.types)) return new Set(q.types);
  if (q.type) return new Set([q.type]);
  return null;
}

/** Keep only cases and deleted laps whose infringement type is selected. */
function scoped(ds, q = {}) {
  const s = typeSet(q);
  if (!s) return ds;
  return { ...ds, cases: ds.cases.filter((c) => s.has(c.infringementType)), deletedLaps: ds.deletedLaps.filter((l) => s.has(l.infringementType)) };
}

/** Per-GP rows (every FIA event, zeros included) with how much of each event is loaded. Chronological. */
function gpRows(full, cases, deletedLaps) {
  const rows = new Map();
  const row = (name) => {
    if (!rows.has(name)) rows.set(name, { grandPrix: name, ...blank(), deletedLaps: 0 });
    return rows.get(name);
  };
  for (const e of full.meta.events ?? []) row(e.grandPrix);
  for (const c of cases) bump(row(c.grandPrix), c);
  for (const l of deletedLaps) row(l.grandPrix).deletedLaps++;
  const order = gpOrder(full);
  return [...rows.values()]
    .map((g) => {
      const e = full.meta.events?.find((x) => x.grandPrix === g.grandPrix);
      return { ...g, outcomesListed: e?.outcomesListed ?? null, outcomesProcessed: e?.outcomesProcessed ?? null, loaded: e ? e.outcomesProcessed > 0 : g.cases + g.deletedLaps > 0 };
    })
    .sort((x, y) => order(x.grandPrix, y.grandPrix));
}

export function summarize(full, q = {}) {
  const ds = scoped(full, q);
  const totals = { ...blank(), deletedLaps: ds.deletedLaps.length };
  const drivers = new Map();
  const get = (name, team) => {
    if (!drivers.has(name)) drivers.set(name, { driver: name, slug: driverSlug(name), team: team ?? null, ...blank(), deletedLaps: 0, points12m: null, syntheticCases: 0, _last: '' });
    const d = drivers.get(name);
    d.team ??= team ?? null;
    return d;
  };
  const byGp = new Map();
  const gp = (name) => {
    if (!byGp.has(name)) byGp.set(name, { grandPrix: name, ...blank(), deletedLaps: 0 });
    return byGp.get(name);
  };
  // Every FIA event gets a row (zeros included) so GPs without loaded data are visible, flagged by their coverage.
  for (const e of full.meta.events ?? []) gp(e.grandPrix);
  for (const c of ds.cases) {
    bump(totals, c);
    const d = get(c.driver, c.team);
    if (c.synthetic) d.syntheticCases++;
    bump(d, c);
    bump(gp(c.grandPrix), c);
    // Latest "total of N for the 12 month period" printed by the FIA for this driver.
    if (c.licencePoints?.total12m != null && String(c.date ?? '') >= d._last) { d.points12m = c.licencePoints.total12m; d._last = String(c.date ?? ''); }
  }
  for (const l of ds.deletedLaps) {
    get(l.driver, l.team).deletedLaps++;
    gp(l.grandPrix).deletedLaps++;
  }
  const order = gpOrder(full);
  return {
    totals,
    drivers: [...drivers.values()]
      .map(({ _last, ...d }) => d)
      .sort((a, b) => b.cases - a.cases || b.deletedLaps - a.deletedLaps || a.driver.localeCompare(b.driver)),
    byGrandPrix: [...byGp.values()]
      .map((g) => {
        const e = full.meta.events?.find((x) => x.grandPrix === g.grandPrix);
        return { ...g, outcomesListed: e?.outcomesListed ?? null, outcomesProcessed: e?.outcomesProcessed ?? null, loaded: e ? e.outcomesProcessed > 0 : g.cases + g.deletedLaps > 0 };
      })
      .sort((x, y) => order(x.grandPrix, y.grandPrix)),
  };
}

/**
 * One driver's profile. `types` (array, [] = none) limits cases, deleted laps, stats, per-GP rows and points timeline
 * to those infringement types. The returned `types` list is NOT limited: it is every type this driver has, with
 * counts, so the buttons can always show the full set to choose from.
 */
export function driverDetail(ds, slug, q = {}) {
  const allCases = ds.cases.filter((c) => driverSlug(c.driver) === slug).sort(byDateThenDoc);
  const allLaps = ds.deletedLaps.filter((l) => driverSlug(l.driver) === slug);
  const name = allCases[0]?.driver ?? allLaps[0]?.driver;
  if (!name) return null;
  const typeMap = new Map();
  const bucket = (type) => {
    if (!typeMap.has(type)) typeMap.set(type, { type, cases: 0, deletedLaps: 0 });
    return typeMap.get(type);
  };
  for (const c of allCases) bucket(c.infringementType).cases++;
  for (const l of allLaps) bucket(l.infringementType).deletedLaps++;
  const types = [...typeMap.values()].sort((x, y) => y.cases - x.cases || y.deletedLaps - x.deletedLaps || x.type.localeCompare(y.type));
  const sel = typeSet(q);
  const cases = sel ? allCases.filter((c) => sel.has(c.infringementType)) : allCases;
  const deletedLaps = sel ? allLaps.filter((l) => sel.has(l.infringementType)) : allLaps;
  const stats = { ...blank(), deletedLaps: deletedLaps.length };
  for (const c of cases) bump(stats, c);
  // Licence points timeline: one entry per case that awarded points, with the total printed by the FIA.
  const pointsTimeline = cases
    .filter((c) => c.licencePoints?.awarded > 0)
    .map((c) => ({ date: c.date, grandPrix: c.grandPrix, infringementType: c.infringementType, awarded: c.licencePoints.awarded, total12m: c.licencePoints.total12m, synthetic: !!c.synthetic }));
  // The driver's cases, points and deleted laps per Grand Prix, in calendar order (all events, so gaps are visible).
  const byGrandPrix = gpRows(ds, cases, deletedLaps);
  return { driver: name, slug, team: allCases[0]?.team ?? allLaps[0]?.team ?? null, types, stats, byGrandPrix, pointsTimeline, cases, deletedLaps };
}

/** Filters: gp, session, outcome, driver (name or slug), steward, types (array) or type, points ('awarded'|'none'|'na'). */
export function filterCases(ds, q = {}) {
  const types = typeSet(q);
  const eq = (a, b) => String(a ?? '').toLowerCase() === String(b).toLowerCase();
  return ds.cases.filter(
    (c) =>
      (!q.gp || eq(c.grandPrix, q.gp)) &&
      (!q.session || eq(c.session, q.session)) &&
      (!q.outcome || eq(c.outcome, q.outcome)) &&
      (!types || types.has(c.infringementType)) &&
      (!q.points || pointsState(c) === q.points) &&
      (!q.driver || eq(c.driver, q.driver) || driverSlug(c.driver) === q.driver) &&
      (!q.steward || c.stewards.some((s) => eq(s, q.steward))),
  );
}

/** Per infringement type: cases, outcomes, how often licence points were awarded, deleted laps. */
/**
 * Per-GP rows (the same shape as summary.byGrandPrix) for the cases that match the Cases page filters. The `gp`
 * filter is ignored on purpose: the chart always shows the whole season so a GP can be compared with the others.
 */
export function casesByGp(ds, q = {}) {
  const { gp: _ignored, ...rest } = q;
  const cases = filterCases(ds, rest);
  const types = typeSet(q);
  const lower = (s) => String(s ?? '').toLowerCase();
  const laps = ds.deletedLaps.filter((l) => (!types || types.has(l.infringementType)) && (!q.driver || lower(l.driver) === lower(q.driver) || driverSlug(l.driver) === q.driver));
  return gpRows(ds, cases, laps);
}

export function typeStats(ds) {
  const m = new Map();
  const get = (type) => {
    if (!m.has(type)) m.set(type, { type, ...blank(), deletedLaps: 0, syntheticCases: 0 });
    return m.get(type);
  };
  for (const c of ds.cases) { bump(get(c.infringementType), c); if (c.synthetic) get(c.infringementType).syntheticCases++; }
  for (const l of ds.deletedLaps) get(l.infringementType).deletedLaps++;
  return [...m.values()].sort((a, b) => b.cases - a.cases || b.deletedLaps - a.deletedLaps || a.type.localeCompare(b.type));
}

export function stewardStats(ds, q = {}) {
  const stewards = new Map();
  const pairs = new Map(); // driver -> steward -> counts
  for (const c of scoped(ds, q).cases) {
    for (const s of c.stewards) {
      if (!stewards.has(s)) stewards.set(s, { steward: s, ...blank() });
      bump(stewards.get(s), c);
      if (!pairs.has(c.driver)) pairs.set(c.driver, new Map());
      const m = pairs.get(c.driver);
      if (!m.has(s)) m.set(s, { steward: s, ...blank() });
      bump(m.get(s), c);
    }
  }
  const byCount = (a, b) => b.cases - a.cases || (a.steward ?? '').localeCompare(b.steward ?? '');
  return {
    stewards: [...stewards.values()].sort(byCount),
    byDriver: [...pairs.entries()]
      .map(([driver, m]) => ({ driver, slug: driverSlug(driver), stewards: [...m.values()].sort(byCount) }))
      .sort((a, b) => a.driver.localeCompare(b.driver)),
    casesWithoutStewards: scoped(ds, q).cases.filter((c) => !c.stewards.length).length,
  };
}

export function facets(ds) {
  const uniq = (xs) => [...new Set(xs.filter(Boolean))].sort();
  return {
    grandsPrix: [...ds.meta.gpsCovered].sort(gpOrder(ds)),
    sessions: uniq(ds.cases.map((c) => c.session)),
    outcomes: Object.values(OUTCOMES),
    types: typeStats(ds).map((t) => ({ type: t.type, cases: t.cases, deletedLaps: t.deletedLaps })),
    points: ['awarded', 'none', 'na'],
    drivers: uniq(ds.cases.map((c) => c.driver)),
    stewards: uniq(ds.cases.flatMap((c) => c.stewards)),
  };
}
