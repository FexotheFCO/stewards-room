// Reusable charts. Used by the driver page and the cases page (cases per Grand Prix).
//
//   import { gpChart } from './charts.js';
//   gpChart(document.getElementById('chart'), rows, { selected, onSelect });
//
// Needs, on the page: the colour key (outcome.* strings) and the .gpchart styles from styles.css. `rows` is a `byGrandPrix` array (from /api/summary or /api/drivers/:slug): one row per FIA event in calendar order, with
import { esc, t, tData } from './app.js';
import { gpInfo, flagHtml } from './flags.js';

/**
 * Cases per Grand Prix (Figma node 31:1455): one column per Grand Prix in calendar order, a bar whose top edge slopes up to the
 * right, and the country flag + 3-letter label under it. The bar is stacked by outcome from the bottom: no sanction
 * (green), reprimand (grey), penalized (red), as in the design. Plain HTML/CSS (styles.css, .gpchart), no SVG axes.
 * Events whose documents are not processed yet show a dimmed flag and no bar. `rows` is a `byGrandPrix` array.
 *
 * Every Grand Prix with something to show is a button: `onSelect(grandPrix)` is called when one is clicked, and `selected`
 * (a FIA event name, or null for all) is the one kept lit while the others are dimmed. Only ONE or ALL can be lit; deciding
 * what a click means (select / back to all) is the caller's job, this function only draws and reports clicks.
 */
export function gpChart(el, rows, { selected = null, onSelect = () => {} } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.cases));
  // Horizontal reference lines behind the bars, one per case count (0, 1, 2, ...); with many cases, every 2nd / 5th / 10th.
  const step = [1, 2, 5, 10, 20, 50].find((s) => max / s <= 6) ?? 100;
  const lines = []; for (let v = 0; v <= max; v += step) lines.push(v);
  const grid = `<div class="gpgrid" aria-hidden="true">${lines.map((v) => `<i class="gpline" style="bottom:${(v / max * 100).toFixed(2)}%"><b>${v}</b></i>`).join('')}</div>`;
  el.innerHTML = `<div class="gpchart" role="group" aria-label="${esc(t('chart.aria'))}"><div class="gpplot${selected ? ' sel' : ''}">${grid}${rows.map((r) => {
    const gp = tData('gp', r.grandPrix);
    const { cc, code } = gpInfo(r.grandPrix);
    const has = r.loaded && r.cases > 0;
    // Cumulative heights, tallest first: each shorter layer is painted over the previous one, so the slanted top of every
    // layer shows as the border between two outcomes, exactly like the stacked shapes in the design.
    let acc = 0;
    const layers = [['noSanction', 'none', 'none'], ['reprimands', 'rep', 'reprimand'], ['penalized', 'pen', 'penalized']]
      .filter(([k]) => r[k]).map(([k, cls, outcome]) => ({ cls, outcome, n: r[k], h: (acc += r[k]) / max * 100 })).reverse();
    const tip = r.loaded
      ? (r.cases || r.deletedLaps || r.pointsAwarded ? `${gp}: ${t('chart.summary', { cases: r.cases, penalized: r.penalized, points: r.pointsAwarded, laps: r.deletedLaps })}` : gp)
      : `${gp}: ${r.outcomesListed ? t('chart.notLoaded', { n: r.outcomesListed }) : t('chart.noneListed')}`;
    const clickable = !!r.cases;
    return `<button type="button" class="gpcol${r.loaded ? '' : ' off'}" data-gp="${esc(r.grandPrix)}" aria-pressed="${r.grandPrix === selected}"${clickable ? '' : ' disabled'} aria-label="${esc(gp)}" title="${esc(tip)}">
      <div class="gpbar">${has ? layers.map((l) => `<i class="seg ${l.cls}" style="--h:${l.h.toFixed(2)}%" title="${esc(gp)} · ${esc(t('outcome.' + l.outcome))}: ${l.n}"></i>`).join('') : ''}</div>
      ${flagHtml(cc, 'gpflag')}<span class="gpcode">${esc(code)}</span></button>`;
  }).join('')}</div></div>`;
  el.querySelectorAll('button.gpcol').forEach((b) => b.addEventListener('click', () => {
    const gp = b.dataset.gp;
    onSelect(gp);
    [...el.querySelectorAll('button.gpcol')].find((x) => x.dataset.gp === gp)?.focus(); // the caller redrew us: keep keyboard focus
  }));
}
