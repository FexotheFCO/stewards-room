// Classic (blocking) script, first thing in <body> of driver.html: paints the team colour before the first frame, so moving
// between drivers does not flash the dark page background while the data loads. The colours are remembered by driver.js and
// drivers.js (rememberTeams in teams.js). Without a remembered colour nothing happens and driver.js does it as before.
(function () {
  try {
    var slug = new URLSearchParams(location.search).get('d') || '';
    var map = JSON.parse(localStorage.getItem('teamColours') || '{}');
    var c = map[slug];
    if (typeof c === 'string' && /^[0-9A-F]{6}$/.test(c)) {
      document.body.classList.add('team-page');
      document.body.style.setProperty('--team', '#' + c);
    }
  } catch (e) { /* private mode or bad JSON: no early colour */ }
})();
