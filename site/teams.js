// Team look for the overview list: row colour and logo. Pure helpers, no DOM access (unit-tested).
import { esc, localPhoto, remotePhoto, SILHOUETTE } from './safe.js';

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

// The tall, full-body portrait F1 uses on its own driver pages. Its URL is built from the season, the team folder (the same
// slugs as our team logos) and the driver code (e.g. lannor01), which we already have inside the validated headshot link.
// The 2026 is the season folder on F1's CDN: change it when the season changes.
const PORTRAIT_SEASON = 2026;

/** Full-body portrait `width` px wide from the F1 CDN, or null if the profile has no valid headshot link or a known team. */
export function tallPhoto(profile, width = 640) {
  const code = remotePhoto(profile, 1)?.match(/\/([a-z]{6}\d{2})\.png\.transform\//i)?.[1]?.toLowerCase();
  const team = teamSlug(profile?.team);
  const w = Math.min(1336, Math.max(100, Math.trunc(Number(width)) || 640));
  if (!code || !team) return null;
  return `https://media.formula1.com/image/upload/c_lfill,w_${w}/v1740000000/common/f1/${PORTRAIT_SEASON}/${team}/${code}/${PORTRAIT_SEASON}${team}${code}right.webp`;
}

/**
 * Large photo for the driver header and the Drivers cards, best first. Every one but the last is the same tall cut-out
 * (so the CSS crops them all alike: waist up, no legs):
 *  1. the local file img/drivers-large/<slug>.webp (git-ignored, only on the developer's machine),
 *  2. F1's full-body portrait from its CDN (what the published site uses),
 *  3. the square headshot from the CDN, flagged `remote` so the CSS lays it out for a square picture.
 * 4. Without any photo (a new or reserve driver with no profile) our tall silhouette, in the same layout as 1 and 2.
 *    (F1's own default bust is only head and shoulders: it is used for the small list picture, see photoHtml.)
 * `width` is for 2 (320 for small cards, 640 for the header); `cols` (1..8) for 3. Always returns { src, remote }.
 */
export function bigPhoto(profile, slug, { width = 640, cols = 8 } = {}) {
  if (localPhoto(profile) && /^[a-z0-9-]+$/.test(slug ?? '')) return { src: `img/drivers-large/${slug}.webp`, remote: false };
  const tall = tallPhoto(profile, width);
  if (tall) return { src: tall, remote: false };
  const square = remotePhoto(profile, cols);
  return square ? { src: square, remote: true } : { src: SILHOUETTE, remote: false };
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
