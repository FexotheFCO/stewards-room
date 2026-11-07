// Tiny pure helpers for putting data into HTML. No DOM access, so they are unit-tested in Node (test/security.test.js).

/** Escape text for use inside HTML text or a quoted attribute. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);

/** Only http(s) links are allowed in href attributes; anything else (javascript:, data:, ...) becomes null. */
export const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);

// Driver photos. Two sources, both validated again here because the values end up in src:
//  - a local file img/drivers/<slug>.png (git-ignored: only on the developer's machine), or
//  - the headshot the F1 CDN serves (profile.photoUrl, from OpenF1), which the visitor's browser loads from media.formula1.com.
// The CDN URL ends in .transform/1col/image.png; the same image exists as 1col..8col (93px to 884px, square), we pick the size.
const LOCAL_PHOTO = /^\/?(img\/drivers\/[a-z0-9-]+\.png)$/;
const REMOTE_PHOTO = /^https:\/\/media\.formula1\.com\/[A-Za-z0-9_./-]+\.transform\/1col\/image\.png$/;

/** Relative path of the local headshot (the data may store it with a leading slash), or null. */
export const localPhoto = (profile) => (typeof profile?.photo === 'string' ? profile.photo.match(LOCAL_PHOTO)?.[1] ?? null : null);

/** F1 CDN headshot `cols` columns wide (1..8), or null when the profile has none or it is not on media.formula1.com. */
export const remotePhoto = (profile, cols = 2) => {
  if (typeof profile?.photoUrl !== 'string' || !REMOTE_PHOTO.test(profile.photoUrl)) return null;
  const n = Math.min(8, Math.max(1, Math.trunc(Number(cols)) || 1));
  return profile.photoUrl.replace('/1col/', `/${n}col/`);
};

/** Small headshot: the local file when there is one, else the CDN. */
export const photoSrc = (profile, cols = 2) => localPhoto(profile) ?? remotePhoto(profile, cols);

/**
 * Round driver picture ringed in the team colour. `profile` comes from the API (validated again here, because the
 * values end up in src and style): a photo is only used if it passes photoSrc, a colour only if it is 6 hex digits.
 * Without a photo it shows the acronym; without any profile it shows nothing.
 */
export const avatarHtml = (profile, big = false) => {
  if (!profile) return '';
  const colour = /^[0-9a-fA-F]{6}$/.test(profile.teamColour ?? '') ? '#' + profile.teamColour : 'var(--line)';
  const cls = 'avatar' + (big ? ' big' : '');
  const src = photoSrc(profile, 2);
  if (src) return `<img class="${cls}" src="${src}" alt="" loading="lazy" width="32" height="32" style="border-color:${colour}">`;
  const label = typeof profile.acronym === 'string' && /^[A-Z]{2,4}$/.test(profile.acronym) ? profile.acronym : '';
  return `<span class="${cls} ph" style="border-color:${colour}">${label}</span>`;
};

/** Driver cut-out photo (no ring) for the overview list. Same validation as avatarHtml; empty spacer without a photo. */
export const photoHtml = (profile) => {
  const src = photoSrc(profile, 2);
  return src ? `<img class="drv-photo" src="${src}" alt="" loading="lazy" width="44" height="44">` : '<span class="drv-photo"></span>';
};

/**
 * Large photo for the driver header and the Drivers cards. With the local large file (img/drivers-large/<slug>.webp, a
 * tall 1336x2100 cut-out that only exists on the developer's machine, signalled by profile.photo) we use that; otherwise
 * the CDN headshot at `cols` columns (square; 8 = 884px ~200KB for the header, 4 = 432px ~60KB for the small cards),
 * flagged `remote` so the CSS lays it out for a square picture. Returns { src, remote } or null.
 */
export const bigPhoto = (profile, slug, cols = 8) => {
  if (localPhoto(profile) && /^[a-z0-9-]+$/.test(slug ?? '')) return { src: `img/drivers-large/${slug}.webp`, remote: false };
  const src = remotePhoto(profile, cols);
  return src ? { src, remote: true } : null;
};

/** Text without accents ("Sergio Pérez" -> "Sergio Perez", "Hülkenberg" -> "Hulkenberg"). For the display font of the
 *  driver header, where an accent over a capital collides with the line above. */
export const stripAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** A number for display: anything that is not a finite number becomes 0 (never raw text from the API). */
export const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
