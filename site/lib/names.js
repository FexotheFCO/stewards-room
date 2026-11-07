// Driver / GP name normalization and slugs.
const FIXES = [
  [/\bHulkenberg\b/g, 'Hülkenberg'],
  [/\bPerez\b/g, 'Pérez'],
];

export function normalizeDriver(name) {
  let n = String(name ?? '').replace(/\s+/g, ' ').trim();
  for (const [re, to] of FIXES) n = n.replace(re, to);
  return n;
}

export function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "Mexico City Grand Prix" -> "mexico-city" */
export function gpSlug(gp) {
  return slugify(String(gp).replace(/\s+Grand Prix$/i, ''));
}
