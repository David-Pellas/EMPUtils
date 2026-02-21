const RPT_CIRCUMFERENCE = 2 * Math.PI * 50;

const RPT_PENALTIES = {
  tracker:   { per: 25, cap: 70 }, // pure profiling
  ads:       { per: 20, cap: 55 }, // real-time bidding
  analytics: { per: 10, cap: 30 }, // session recording
  social:    { per:  5, cap: 15 }, // social pixels
  other:     { per:  2, cap: 10 }, // third parties
};

const RPT_SCORE_OVERRIDES = new Map([
  ['facebook.com',  'tracker'],
  ['facebook.net',  'tracker'],
  ['fbcdn.net',     'tracker'],
  ['instagram.com', 'tracker'],
  ['tiktok.com',    'tracker'],
  ['ttwstatic.com', 'tracker'],
  ['twitter.com',   'tracker'],
  ['t.co',          'tracker'],
  ['twimg.com',     'tracker'],
  ['linkedin.com',  'tracker'],
  ['licdn.com',     'tracker'],
  ['hotjar.com',    'tracker'],
  ['fullstory.com', 'tracker'],
  ['mouseflow.com', 'tracker'],
  ['logrocket.com', 'tracker'],
  ['inspectlet.com','tracker'],
  ['sessioncam.com','tracker'],
]);

const RPT_GRADES = [
  { min: 80, label: 'Excellent', sub: 'Minimal surveillance infrastructure detected' },
  { min: 60, label: 'Good',      sub: 'Some third-party activity — limited data exposure' },
  { min: 40, label: 'Fair',      sub: 'Notable tracking present — your data is being profiled' },
  { min: 20, label: 'Poor',      sub: 'Aggressive surveillance — significant data exposure' },
  { min: 0,  label: 'Critical',  sub: 'Severe privacy violation — multiple harvesters active' },
];

function rptScoreClass(score) {
  if (score >= 70) return 'score-high';
  if (score >= 40) return 'score-medium';
  return 'score-low';
}

function getScoringCategory(domain) {
  const parts = domain.toLowerCase().split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const cat = RPT_SCORE_OVERRIDES.get(parts.slice(i).join('.'));
    if (cat) return cat;
  }
  return categorizeDomain(domain);
}

function computeReport(domains) {
  const catCounts  = { tracker: 0, ads: 0, analytics: 0, social: 0, other: 0 };
  const catDomains = { tracker: [], ads: [], analytics: [], social: [], other: [] };

  for (const domain of Object.keys(domains)) {
    const cat = getScoringCategory(domain);
    catCounts[cat]++;
    if (catDomains[cat].length < 2) catDomains[cat].push(domain);
  }

  let deduction = 0;
  for (const [cat, { per, cap }] of Object.entries(RPT_PENALTIES)) {
    deduction += Math.min(catCounts[cat] * per, cap);
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - deduction)));

  const impacts = Object.entries(catCounts)
    .filter(([, n]) => n > 0)
    .map(([cat, count]) => ({
      cat,
      count,
      impact:   Math.min(count * RPT_PENALTIES[cat].per, RPT_PENALTIES[cat].cap),
      examples: catDomains[cat],
    }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  const reasons = impacts.map(({ cat, count, examples }) => buildReason(cat, count, examples));
  return { score, reasons };
}

function hasOverrideDomains(examples) {
  return examples.some(d => {
    const parts = d.toLowerCase().split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      if (RPT_SCORE_OVERRIDES.has(parts.slice(i).join('.'))) return true;
    }
    return false;
  });
}

function buildReason(cat, count, examples) {
  const ex = examples.length ? ` — e.g. ${examples.join(', ')}` : '';
  const pl = count > 1;
  const hasSurveillancePlatforms = cat === 'tracker' && hasOverrideDomains(examples);

  const trackerDetail = hasSurveillancePlatforms
    ? `Includes surveillance-tier platforms with documented cross-site data harvesting${ex}`
    : `Active user profiling across websites${ex}`;

  const DEFS = {
    tracker:   {
      sev:    'high',
      title:  `${count} high-risk tracker${pl ? 's' : ''} detected`,
      detail: trackerDetail,
    },
    ads:       {
      sev:    'high',
      title:  `${count} advertising network${pl ? 's' : ''} present`,
      detail: `Real-time bidding on your browsing data${ex}`,
    },
    analytics: {
      sev:    'medium',
      title:  `${count} analytics service${pl ? 's' : ''} active`,
      detail: `Session and interaction data being recorded${ex}`,
    },
    social:    {
      sev:    'low',
      title:  `${count} social media pixel${pl ? 's' : ''} loaded`,
      detail: `Off-platform activity reported to social networks${ex}`,
    },
    other:     {
      sev:    'low',
      title:  `${count} external domain${pl ? 's' : ''} contacted`,
      detail: `Third-party resources with undisclosed data practices${ex}`,
    },
  };

  return DEFS[cat];
}


const WEB_NODE_COLORS = {
  tracker:   '#f87171',
  ads:       '#fb923c',
  analytics: '#fbbf24',
  social:    '#60a5fa',
  other:     '#94a3b8',
};

// SVG viewBox coords
const WEB_W = 220;
const WEB_H = 150;
const WEB_CX = WEB_W / 2;
const WEB_CY = WEB_H / 2;
const WEB_NODE_R = 5.5;
const WEB_CENTER_R = 15;
const WEB_RX = WEB_CX - WEB_NODE_R - 10;
const WEB_RY = WEB_CY - WEB_NODE_R - 8;
const WEB_MAX_NODES = 20;

function _svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function renderWebGraph(domains) {
  const svg     = document.getElementById('rptWebSvg');
  const tooltip = document.getElementById('rptWebTooltip');
  svg.innerHTML = '';

  const catWeight = { tracker: 0, ads: 1, analytics: 2, social: 3, other: 4 };
  const nodes = Object.keys(domains)
    .map(d => ({ domain: d, cat: getScoringCategory(d) }))
    .filter(n => n.cat !== 'other')
    .sort((a, b) => catWeight[a.cat] - catWeight[b.cat])
    .slice(0, WEB_MAX_NODES);

  const gridG = _svgEl('g', { opacity: '0.04' });
  for (let i = 1; i < 4; i++) {
    gridG.appendChild(_svgEl('ellipse', {
      cx: WEB_CX, cy: WEB_CY,
      rx: (WEB_RX * i) / 3.5,
      ry: (WEB_RY * i) / 3.5,
      fill: 'none', stroke: 'white', 'stroke-width': '1',
    }));
  }
  svg.appendChild(gridG);

  if (nodes.length === 0) {
    svg.appendChild(_svgEl('circle', {
      cx: WEB_CX, cy: WEB_CY, r: WEB_CENTER_R,
      fill: '#1e293b', stroke: '#334155', 'stroke-width': '1.5',
    }));
    const t = _svgEl('text', {
      x: WEB_CX, y: WEB_CY, 'text-anchor': 'middle',
      'dominant-baseline': 'middle', fill: '#94a3b8',
      'font-size': '7', 'font-weight': '700',
    });
    t.textContent = 'YOU';
    svg.appendChild(t);

    const msg = _svgEl('text', {
      x: WEB_CX, y: WEB_CY + WEB_CENTER_R + 10,
      'text-anchor': 'middle', fill: '#475569',
      'font-size': '8.5',
    });
    msg.textContent = 'No trackers detected';
    svg.appendChild(msg);
    return;
  }

  const linesG = _svgEl('g', {});
  const nodesG = _svgEl('g', {});

  nodes.forEach(({ domain, cat }, i) => {
    const angle  = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const nx     = WEB_CX + WEB_RX * Math.cos(angle);
    const ny     = WEB_CY + WEB_RY * Math.sin(angle);
    const color  = WEB_NODE_COLORS[cat] || WEB_NODE_COLORS.other;

    const line = _svgEl('line', {
      x1: WEB_CX, y1: WEB_CY, x2: nx, y2: ny,
      stroke: color, 'stroke-opacity': '0.2', 'stroke-width': '1',
      'stroke-dasharray': '3 3',
    });
    linesG.appendChild(line);

    const glow = _svgEl('circle', {
      cx: nx, cy: ny, r: WEB_NODE_R + 4,
      fill: color, 'fill-opacity': '0.12',
    });
    nodesG.appendChild(glow);

    const circle = _svgEl('circle', {
      cx: nx, cy: ny, r: WEB_NODE_R,
      fill: color, 'fill-opacity': '0.9',
      stroke: color, 'stroke-width': '1.5',
    });
    circle.style.cursor = 'pointer';

    circle.addEventListener('mouseenter', () => {
      circle.setAttribute('r', WEB_NODE_R + 3);
      circle.setAttribute('fill-opacity', '1');
      line.setAttribute('stroke-opacity', '0.65');
      line.setAttribute('stroke-dasharray', 'none');
      glow.setAttribute('fill-opacity', '0.25');

      tooltip.textContent = domain;
      tooltip.style.display = 'block';

      const wrap    = svg.closest('.rpt-web-wrap');
      const svgRect = svg.getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const scaleX  = svgRect.width  / WEB_W;
      const scaleY  = svgRect.height / WEB_H;

      let tx = nx * scaleX + (svgRect.left - wrapRect.left) + 10;
      let ty = ny * scaleY + (svgRect.top  - wrapRect.top)  - 24;
      tx = Math.min(tx, wrapRect.width - tooltip.offsetWidth - 4);
      ty = Math.max(ty, 2);

      tooltip.style.left = tx + 'px';
      tooltip.style.top  = ty + 'px';
    });

    circle.addEventListener('mouseleave', () => {
      circle.setAttribute('r', WEB_NODE_R);
      circle.setAttribute('fill-opacity', '0.9');
      line.setAttribute('stroke-opacity', '0.2');
      line.setAttribute('stroke-dasharray', '3 3');
      glow.setAttribute('fill-opacity', '0.12');
      tooltip.style.display = 'none';
    });

    nodesG.appendChild(circle);
  });

  svg.appendChild(linesG);
  svg.appendChild(nodesG);

  const ping = _svgEl('circle', {
    cx: WEB_CX, cy: WEB_CY, r: WEB_CENTER_R + 5,
    fill: '#60a5fa', 'fill-opacity': '0.35',
    stroke: 'none',
  });
  ping.classList.add('rpt-web-ping');
  svg.appendChild(ping);

  svg.appendChild(_svgEl('circle', {
    cx: WEB_CX, cy: WEB_CY, r: WEB_CENTER_R,
    fill: '#1e293b', stroke: '#60a5fa', 'stroke-width': '2',
  }));

  const youLabel = _svgEl('text', {
    x: WEB_CX, y: WEB_CY, 'text-anchor': 'middle',
    'dominant-baseline': 'middle', fill: '#93c5fd',
    'font-size': '7', 'font-weight': '700', 'letter-spacing': '0.5',
  });
  youLabel.textContent = 'YOU';
  svg.appendChild(youLabel);
}

function renderReport({ score, reasons }) {
  const ringFill   = document.getElementById('rptRingFill');
  const numberEl   = document.getElementById('rptNumber');
  const gradeEl    = document.getElementById('rptGrade');
  const gradeSubEl = document.getElementById('rptGradeSub');
  const reasonsEl  = document.getElementById('rptReasons');

  const cls    = rptScoreClass(score);
  const offset = RPT_CIRCUMFERENCE * (1 - score / 100);

  ringFill.style.transition = 'none';
  ringFill.style.strokeDashoffset = '0';
  ringFill.setAttribute('class', 'rpt-fill score-high');

  void ringFill.getBoundingClientRect();

  requestAnimationFrame(() => {
    ringFill.style.transition =
      'stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1), stroke 0.9s cubic-bezier(.4,0,.2,1), filter 0.9s ease';
    requestAnimationFrame(() => {
      ringFill.style.strokeDashoffset = String(offset);
      ringFill.setAttribute('class', `rpt-fill ${cls}`);
    });
  });

  numberEl.textContent = score;
  numberEl.className   = `rpt-number ${cls}`;

  const grade = RPT_GRADES.find(g => score >= g.min) || RPT_GRADES[RPT_GRADES.length - 1];
  gradeEl.textContent    = grade.label;
  gradeEl.className      = `rpt-grade-label ${cls}`;
  gradeSubEl.textContent = grade.sub;

  if (reasons.length === 0) {
    reasonsEl.innerHTML = '<div class="rpt-empty">No significant tracking activity detected on this page.</div>';
    return;
  }

  reasonsEl.innerHTML = reasons.map(r => `
    <div class="rpt-reason-card rpt-sev-${r.sev}">
      <div class="rpt-reason-dot"></div>
      <div class="rpt-reason-body">
        <div class="rpt-reason-title">${r.title}</div>
        <div class="rpt-reason-detail">${r.detail}</div>
      </div>
    </div>
  `).join('');
}

function initReportTab() {
  const domains =
    allDomains &&
    typeof allDomains === 'object' &&
    !Array.isArray(allDomains) &&
    Object.keys(allDomains).length > 0
      ? allDomains
      : null;

  const ringFill   = document.getElementById('rptRingFill');
  const numberEl   = document.getElementById('rptNumber');
  const gradeEl    = document.getElementById('rptGrade');
  const gradeSubEl = document.getElementById('rptGradeSub');
  const reasonsEl  = document.getElementById('rptReasons');

  if (!domains) {
    ringFill.style.strokeDashoffset = RPT_CIRCUMFERENCE;
    ringFill.setAttribute('class', 'rpt-fill');
    numberEl.textContent    = '—';
    numberEl.className      = 'rpt-number';
    gradeEl.textContent     = '—';
    gradeEl.className       = 'rpt-grade-label';
    gradeSubEl.textContent  = 'Analyze a page first';
    reasonsEl.innerHTML     =
      '<div class="rpt-empty">Switch to the Trackers tab and analyze a page to generate your privacy report.</div>';
    renderWebGraph({});
    return;
  }

  renderWebGraph(domains);
  renderReport(computeReport(domains));
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('navReport').addEventListener('click', initReportTab);
  // Show the empty-state ring
  initReportTab();
});
