import { api, layout, showError, esc, t, synBadge } from '../app.js';
import { num, bigPhoto, photoSrc } from '../safe.js';
import { teamColour, surname, byCarNumber, rememberTeams } from '../teams.js';
import { flagHtml, driverCountry } from '../flags.js';
layout('drivers.html');
document.title = `Stewards' Room · ${t('nav.drivers')}`;

/** One small card per driver, in car-number order: team-colour background, the photo cut at the waist, number and name.
 *  The photo is the large local one (git-ignored), falling back to the small headshot, or none (see the error handler). */
const card = (d) => {
  const p = d.profile;
  const photo = bigPhoto(p, d.slug, 4); // cards are small: the 432px CDN image is plenty (the header uses the 884px one)
  const sur = surname(d.driver), first = d.driver.slice(0, d.driver.length - sur.length).trim();
  const number = p?.number != null && Number.isFinite(Number(p.number)) ? `<span class="dcard-num">${num(p.number)}</span>` : '';
  return `<a class="dcard" href="driver.html?d=${encodeURIComponent(d.slug)}" style="--team:#${teamColour(p)}" aria-label="${esc(d.driver)}">
    ${photo ? `<img class="dcard-photo${photo.remote ? ' remote' : ''}" src="${photo.src}" alt="" ${photo.remote ? 'width="432" height="432"' : 'width="1336" height="2100"'} loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ''}
    ${number}
    <span class="dcard-name"><span class="dcard-first">${esc(first)}</span><span class="dcard-last">${flagHtml(driverCountry(d.driver), 'dcard-flag')}${esc(sur)}${synBadge(d)}</span></span></a>`;
};

try {
  const { drivers } = await api('/summary');
  rememberTeams(drivers);
  const box = document.getElementById('dcards');
  box.innerHTML = byCarNumber(drivers).map(card).join('');
  // The large local photos only exist on the developer's machine: if one is missing, use the small headshot (local or
  // CDN), or just show the coloured card. A CDN photo that fails to load is simply dropped.
  box.querySelectorAll('.dcard').forEach((a, i) => {
    const img = a.querySelector('.dcard-photo');
    const p = byCarNumber(drivers)[i].profile;
    img?.addEventListener('error', () => {
      const small = photoSrc(p, 4);
      if (small && !img.dataset.fallback && img.getAttribute('src') !== small) { img.dataset.fallback = '1'; img.classList.add('remote'); img.src = small; }
      else img.remove();
    });
  });
} catch (e) { showError(e); }
