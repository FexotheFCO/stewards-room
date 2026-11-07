// Team look for the overview list: row colour and logo. Pure helpers, no DOM access (unit-tested).
import { esc } from './safe.js';

// Team names come in several spellings ("Cadillac" in the driver profile, "Cadillac Formula 1 Team" in the dataset).
// First match wins. The slug is the file name under /img/teams/ (<slug>.svg colour logo, <slug>-white.svg white logo).
const TEAMS = [
  [/ferrari/i, 'ferrari'],
  [/mercedes/i, 'mercedes'],
  [/red\s*bull/i, 'redbullracing'],
  [/mclaren/i, 'mclaren'],
  [/aston/i, 'astonmartin'],
  [/alpine/i, 'alpine'],
  [/williams/i, 'williams'],
  [/racing\s*bulls|^rb\b|visa/i, 'racingbulls'],
  [/audi|sauber/i, 'audi'],
  [/haas/i, 'haasf1team'],
  [/cadillac/i, 'cadillac'],
];

export const teamSlug = (name) => (typeof name === 'string' ? TEAMS.find(([re]) => re.test(name))?.[1] ?? null : null);

const HEX6 = /^[0-9a-fA-F]{6}$/;
const NEUTRAL = '8A8A93'; // driver without a profile (update:drivers never ran): grey outline

/** Row colour: the OpenF1 team colour (6 hex digits, no #), or grey for a driver without a profile. Never raw API text. */
export const teamColour = (profile) => (HEX6.test(profile?.teamColour ?? '') ? profile.teamColour.toUpperCase() : NEUTRAL);

/** Attributes for the <tr>: the colour goes in a CSS variable. */
export const teamRowAttr = (profile) => ` class="drv" style="--team:#${teamColour(profile)}"`;

/** Team logo: the white version, which is what the design uses on the dark rows. Empty spacer if there is no logo file. */
export function teamLogoHtml(teamName) {
  const slug = teamSlug(teamName);
  if (!slug) return '<span class="drv-logo"></span>';
  return `<img class="drv-logo" src="img/teams/${slug}-white.svg" alt="${esc(teamName)}" title="${esc(teamName)}" width="36" height="36" loading="lazy">`;
}

/** Short label for a driver: everything after the first word ("Franco Colapinto" -> "Colapinto"). */
export const surname = (name) => { const s = String(name ?? '').trim(); const i = s.indexOf(' '); return i < 0 ? s : s.slice(i + 1); };

/** Drivers in car-number order (1, 3, 5, ...); a driver without a number goes last, ties by name. Returns a new array. */
export const byCarNumber = (drivers) => {
  const n = (d) => (Number.isFinite(Number(d.profile?.number)) ? Number(d.profile.number) : Infinity);
  return [...drivers].sort((a, b) => n(a) - n(b) || String(a.driver).localeCompare(String(b.driver)));
};

/** The driver before and after `slug` in `list`, going round (the last one's next is the first). Both null when the driver
 *  is not in the list or is the only one: there is nobody to move to. */
export const neighbours = (list, slug) => {
  const i = list.findIndex((d) => d.slug === slug);
  if (i < 0 || list.length < 2) return { prev: null, next: null };
  return { prev: list[(i - 1 + list.length) % list.length], next: list[(i + 1) % list.length] };
};

/** Remember each driver's team colour (slug -> 6 hex digits) so the driver page can paint it before its data arrives
 *  (see js/early-team.js). Best effort: storage may be unavailable. */
export function rememberTeams(drivers) {
  try {
    const map = JSON.parse(localStorage.getItem('teamColours') || '{}');
    for (const d of drivers) if (/^[a-z0-9-]+$/.test(d?.slug ?? '')) map[d.slug] = teamColour(d.profile);
    localStorage.setItem('teamColours', JSON.stringify(map));
  } catch { /* private mode */ }
}
