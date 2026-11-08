// Flags for the driver page: which flag belongs to a Grand Prix and to a driver. Pure helpers, no DOM access
// (unit-tested in test/flags.test.js). The SVG files are flag-icons v7.5.0 (MIT), see public/img/flags/SOURCE.txt.
//
// Country codes are the ISO 3166-1 alpha-2 file names under /img/flags/4x3/. A code that has no file renders nothing.

/** Every country we ship a flag for (a test checks each one has its file). */
export const FLAG_CODES = Object.freeze(['ae', 'ar', 'at', 'au', 'az', 'be', 'bh', 'br', 'ca', 'cn', 'de', 'es', 'fi', 'fr', 'gb',
  'hu', 'it', 'jp', 'mc', 'mx', 'nl', 'nz', 'qa', 'sa', 'sg', 'th', 'us']);
const KNOWN = new Set(FLAG_CODES);

/** <img> for a flag, or '' for an unknown code. `cls` is a fixed class name chosen by the caller, never user data. */
export const flagHtml = (cc, cls = 'flag') =>
  KNOWN.has(cc) ? `<img class="${cls}" src="img/flags/4x3/${cc}.svg" alt="" loading="lazy">` : '';

/**
 * Grand Prix -> flag country and the 3-letter label under the bar in the chart. The label is the country for most
 * events, but Belgium shows "SPA" (the circuit, as in the design), and the two Spanish events and the three US events
 * need different labels so the columns can be told apart. Keys are the English FIA names used in dataset.json.
 */
export const GP_INFO = Object.freeze({
  'Australian Grand Prix': { cc: 'au', code: 'AUS' },
  'Chinese Grand Prix': { cc: 'cn', code: 'CHN' },
  'Japanese Grand Prix': { cc: 'jp', code: 'JPN' },
  'Bahrain Grand Prix': { cc: 'bh', code: 'BHR' },
  'Miami Grand Prix': { cc: 'us', code: 'MIA' },
  'Canadian Grand Prix': { cc: 'ca', code: 'CAN' },
  'Monaco Grand Prix': { cc: 'mc', code: 'MON' },
  'Barcelona-Catalunya Grand Prix': { cc: 'es', code: 'BCN' },
  'Austrian Grand Prix': { cc: 'at', code: 'AUT' },
  'British Grand Prix': { cc: 'gb', code: 'GBR' },
  'Belgian Grand Prix': { cc: 'be', code: 'SPA' },
  'Hungarian Grand Prix': { cc: 'hu', code: 'HUN' },
  'Dutch Grand Prix': { cc: 'nl', code: 'NED' },
  'Italian Grand Prix': { cc: 'it', code: 'ITA' },
  'Spanish Grand Prix': { cc: 'es', code: 'ESP' },
  'Azerbaijan Grand Prix': { cc: 'az', code: 'AZE' },
  'Singapore Grand Prix': { cc: 'sg', code: 'SGP' },
  'United States Grand Prix': { cc: 'us', code: 'USA' },
  'Mexico City Grand Prix': { cc: 'mx', code: 'MEX' },
  'São Paulo Grand Prix': { cc: 'br', code: 'BRA' }, // the FIA's spelling (with the tilde)
  'Las Vegas Grand Prix': { cc: 'us', code: 'LVS' },
  'Qatar Grand Prix': { cc: 'qa', code: 'QAT' },
  'Abu Dhabi Grand Prix': { cc: 'ae', code: 'ABU' },
});

/** { cc, code } for a Grand Prix; a made-up label (first 3 letters) and no flag for one we do not know. */
export const gpInfo = (name) => GP_INFO[name] ?? { cc: null, code: String(name ?? '').slice(0, 3).toUpperCase() };

/**
 * Driver -> the flag we show: the nationality the driver races under (the one on the FIA licence). Dual nationality is
 * NOT shown yet; when it is, it goes here as a second code. Written from memory, not from a data source: check it.
 */
export const DRIVER_COUNTRY = Object.freeze({
  'Alexander Albon': 'th',
  'Arvid Lindblad': 'gb',
  'Carlos Sainz': 'es',
  'Charles Leclerc': 'mc',
  'Esteban Ocon': 'fr',
  'Fernando Alonso': 'es',
  'Franco Colapinto': 'ar',
  'Gabriel Bortoleto': 'br',
  'George Russell': 'gb',
  'Isack Hadjar': 'fr',
  'Kimi Antonelli': 'it',
  'Lance Stroll': 'ca',
  'Lando Norris': 'gb',
  'Lewis Hamilton': 'gb',
  'Liam Lawson': 'nz',
  'Max Verstappen': 'nl',
  'Nico Hülkenberg': 'de',
  'Oliver Bearman': 'gb',
  'Oscar Piastri': 'au',
  'Pierre Gasly': 'fr',
  'Rafael Camara': 'br',
  'Sergio Pérez': 'mx',
  'Valtteri Bottas': 'fi',
  'Yuki Tsunoda': 'jp',
});

export const driverCountry = (name) => DRIVER_COUNTRY[name] ?? null;
