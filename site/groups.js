// Coarser groups of infringement types, for the UI buttons. Pure data + helpers (no DOM), shared by the browser and
// by src/lib/infringementType.js (which re-exports it), so there is ONE table.
//
// The exact type (`infringementType`) stays in every case and in the API/URL (?types=pit-lane-speeding,...); a group is
// only DERIVED from it here. A group can always be split back into its exact types with `typesOfGroup`, or the table
// can be re-cut, without touching the data. Every type in src/lib/infringementType.js TYPES must appear here (tested).

export const TYPE_GROUPS = Object.freeze({
  'collision': 'contact',
  'forcing-off-track': 'contact',
  'safety-car': 'safety-car',
  'yellow-flag': 'flags',
  'blue-flag': 'flags',
  'pit-lane-speeding': 'pit-lane',
  'pit-lane-incident': 'pit-lane',
  'unsafe-release': 'pit-lane',
  'track-limits': 'track-limits',
  'start-procedure': 'start',
  'grid-procedure': 'start',
  'erratic-driving': 'erratic',
  'driving-slowly': 'erratic',
  'abnormal-direction-change': 'erratic',
  'impeding': 'impeding',
  'other': 'other',
});

/** Group of an exact type; unknown types fall into 'other'. */
export const groupOf = (type) => TYPE_GROUPS[type] ?? 'other';

/** The exact types inside a group (e.g. 'pit-lane' -> pit-lane-speeding, pit-lane-incident, unsafe-release). */
export const typesOfGroup = (group) => Object.keys(TYPE_GROUPS).filter((t) => TYPE_GROUPS[t] === group);

/** All group codes, in display order. */
export const GROUPS = Object.freeze([...new Set(Object.values(TYPE_GROUPS))]);
