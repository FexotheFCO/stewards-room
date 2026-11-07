// Classification of a stewards' decision text. Values are language-neutral codes; the UI translates them.
export const OUTCOMES = Object.freeze({
  PENALIZED: 'penalized',
  REPRIMAND: 'reprimand',
  NONE: 'none',
});

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// The stewards write numbers as digits ("5 grid positions") or as words ("A drop of one grid position", "One penalty point").
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const NUM = `\\d+|${Object.keys(WORDS).join('|')}`;
const toNumber = (s) => (/^\d+$/.test(s) ? Number(s) : WORDS[String(s).toLowerCase()]);

/** Decision text -> 'penalized' | 'reprimand' | 'none'. */
export function classifyOutcome(decision) {
  const d = clean(decision);
  if (/no further action/i.test(d)) return OUTCOMES.NONE;
  if (/no penalty (?:is )?applied/i.test(d)) return OUTCOMES.NONE;
  // A warning is not a sanction in the sense of time or grid places: it counts with the reprimands.
  // Printed as "Driver: Reprimand (Driving)", "Driver: Warning." or "Reprimanded for failure to start ...".
  if (/^(?:driver:\s*)?(?:reprimand|(?:formal\s+)?warning)/i.test(d)) return OUTCOMES.REPRIMAND;
  return OUTCOMES.PENALIZED;
}

/** Kind of sanction as a neutral code (translated in the UI). */
export function penaltyType(decision) {
  const d = clean(decision);
  if (/no further action/i.test(d)) return 'no-further-action';
  if (/no penalty (?:is )?applied/i.test(d)) return 'no-penalty';
  if (/^(?:driver:\s*)?reprimand/i.test(d)) return 'reprimand';
  if (/^(?:driver:\s*)?(?:formal\s+)?warning/i.test(d)) return 'warning';
  if (/drive[\s-]*through/i.test(d)) return 'drive-through';
  if (/stop[\s-]*and[\s-]*go/i.test(d)) return 'stop-and-go';
  if (/grid position/i.test(d)) return 'grid-drop';
  if (/time penalty/i.test(d)) return 'time-penalty';
  if (/penalty\s+laps?\b/i.test(d)) return 'penalty-lap';
  if (/disqualif/i.test(d)) return 'disqualification';
  // "The lap time of 1.30.988 of Car 23 recorded in SQ1 is hereby deleted. All lap times of Car 23 in SQ2 are deleted."
  if (/lap\s+times?\b[^.]*\b(?:is|are)\s+(?:hereby\s+)?deleted/i.test(d)) return 'lap-times-deleted';
  if (/\bfined?\b/i.test(d)) return 'fine';
  return 'other';
}

/** "The Competitor (Team) is fined EUR 5.000.": a sanction on the team, not on the driver. The site covers drivers only. */
/** A sanction aimed at the team: a fine on "The Competitor", or "Competitor: Reprimand". The site covers drivers only. */
export const isTeamSanction = (decision) => isTeamFine(decision) || /^competitor:/i.test(clean(decision));

export const isTeamFine =(decision) => /^the competitor\b.*\bis fined\b/i.test(clean(decision));

/**
 * Licence (penalty) points written in the decision, e.g. "2 penalty points (total of 4 for the 12 month period)".
 * Returns { awarded, total12m } or null when the text does not mention points.
 */
export function parseLicencePoints(decision) {
  const d = clean(decision);
  // "2 penalty points (total of 4 for the 12 month period)" and "One penalty point is imposed, making a total of 4 for ...".
  const m = d.match(new RegExp(`(${NUM})\\s+penalty\\s+points?`, 'i'));
  if (!m) return null;
  const total = d.match(new RegExp(`total\\s+of\\s+(${NUM})\\b`, 'i'));
  return { awarded: toNumber(m[1]), total12m: total ? toNumber(total[1]) : null };
}

/**
 * Licence points with three states:
 *   { awarded: N>0, ... }  points were awarded
 *   { awarded: 0, total12m: null }  a penalty was applied but no points are mentioned
 *   null  not applicable (reprimand / no sanction)
 */
export function licencePoints(decision) {
  if (classifyOutcome(decision) !== OUTCOMES.PENALIZED) return null;
  return parseLicencePoints(decision) ?? { awarded: 0, total12m: null };
}

/** Numeric details of the penalty (null when absent). */
export function penaltyDetails(decision) {
  const d = clean(decision);
  const sec = d.match(new RegExp(`(${NUM})[\\s-]+second`, 'i'));
  const grid = d.match(new RegExp(`(${NUM})\\s+grid\\s+positions?`, 'i'));
  return { penaltySeconds: sec ? toNumber(sec[1]) : null, gridPositions: grid ? toNumber(grid[1]) : null };
}

/** Everything derived from a decision text, in the shape stored on a case. */
export function decisionFacts(decision) {
  return {
    outcome: classifyOutcome(decision),
    penaltyType: penaltyType(decision),
    ...penaltyDetails(decision),
    licencePoints: licencePoints(decision),
  };
}
