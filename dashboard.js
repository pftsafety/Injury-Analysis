// ============================================================
// SHE INJURY INTELLIGENCE — dashboard.js
// Set your Apps Script URL below
// ============================================================

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxzV_PzGZ05yf54N7x-sTWP0HgXRk8yRhjkrFwwZy9t4TKvWxZSxQjuo79Ad_-BA6QNzQ/exec";

Chart.defaults.color = "#475569";
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.plugins.legend.display = false;

// Global tooltip theme — fixes white-on-white text bug.
// Individual chart tooltip configs only need backgroundColor/borderColor;
// title/body text color now inherits from these defaults automatically.
Chart.defaults.plugins.tooltip.backgroundColor = "#ffffff";
Chart.defaults.plugins.tooltip.titleColor = "#0f172a";
Chart.defaults.plugins.tooltip.bodyColor = "#334155";
Chart.defaults.plugins.tooltip.borderColor = "#e2e8f0";
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.titleFont = { weight: 600, size: 12 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 11 };
Chart.defaults.plugins.tooltip.boxPadding = 4;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.displayColors = true;
// Subtle shadow so the white tooltip still reads as elevated above white cards
Chart.defaults.plugins.tooltip.footerColor = "#64748b";

const COLORS = ["#2563eb","#7c3aed","#059669","#d97706","#dc2626","#0ea5e9","#db2777","#65a30d","#ea580c","#0d9488"];
const GRID = "rgba(15,23,42,0.06)";
const BORDER = "rgba(15,23,42,0.12)";

let charts = {};
let appData = {};

// ── Nav ──────────────────────────────────────────────────────
function showView(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  const titles = { overview:'Dashboard', trends:'Trends', departments:'Departments', sections:'Sections', injuries:'Injury Types', timeanalysis:'Time Analysis', scorecard:'Safety Scorecard', records:'Records', prediction:'AI Prediction' };
  document.getElementById('viewTitle').textContent = titles[id] || id;
}

// ── API ──────────────────────────────────────────────────────
async function api(action, params) {
  let url = `${APPS_SCRIPT_URL}?action=${action}`;
  if (params) url += '&' + params;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Animated counter ─────────────────────────────────────────
function animateCounter(el, target, duration = 900) {
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Load all ─────────────────────────────────────────────────
async function loadAll() {
  const loader = document.getElementById('pageLoader');
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.classList.add('spinning');

  if (APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
    document.getElementById('configBanner').classList.add('show');
    loadDemoData();
    finishLoad(loader, refreshBtn);
    return;
  }

  try {
    const [stats, monthly, injury, raw] = await Promise.all([
      api('stats'), api('monthly'), api('injury'), api('raw', 'limit=100000')
    ]);
    appData = { stats, monthly, injury, raw };
    renderAll();
    document.getElementById('lastSync').textContent = new Date().toLocaleTimeString();
    loadPrediction();
  } catch (e) {
    console.error(e);
    document.getElementById('configBanner').classList.add('show');
    loadDemoData();
  } finally {
    finishLoad(loader, refreshBtn);
  }
}

function finishLoad(loader, refreshBtn) {
  setTimeout(() => {
    loader.classList.add('done');
    refreshBtn.classList.remove('spinning');
  }, 300);
}

// ── Demo data ────────────────────────────────────────────────
function loadDemoData() {
  const depts = ['Primary Production','Packing','Engineering','ETD','Administration','Kitchen','Quality','Maintenance'];
  const injTypes = ['Abrasion','Pain','Trauma','Foreign Body','Pain & Swelling','Burn','Laceration'];
  const natures = ['Contact with hard object','Hit with hard object','Contact with sharp object','Fall of hard object','Slip and fall','Chemical spill','Enter of Dust'];
  const bodyParts = ['Right Hand','Left Hand','Right Foot','Left Foot','Right Eye','Left Eye','Both Eyes','Head','Leg','Knee','Finger','Thumb','Elbow','Shoulder'];

  const monthly = [];
  for (let y = 2015; y <= 2024; y++) {
    for (let m = 1; m <= 12; m++) {
      const base = 18 + Math.sin(m * 0.5) * 4;
      const trend = (y - 2015) * 0.3;
      monthly.push({ month: `${y}-${String(m).padStart(2,'0')}`, count: Math.round(base + trend + Math.random() * 6) });
    }
  }
  for (let m = 1; m <= 9; m++) monthly.push({ month: `2025-${String(m).padStart(2,'0')}`, count: Math.round(22 + Math.random() * 8) });

  const total = monthly.reduce((s, m) => s + m.count, 0);
  const byYear = {};
  monthly.forEach(m => { const y = m.month.split('-')[0]; byYear[y] = (byYear[y]||0)+m.count; });

  const byDept = {};
  depts.forEach((d,i) => byDept[d] = Math.round(total * [0.24,0.20,0.16,0.12,0.10,0.08,0.06,0.04][i]));

  const byBodyPart = {};
  bodyParts.forEach((b,i) => byBodyPart[b] = Math.round(total * (0.12 - i*0.008)));

  appData = {
    stats: { total, byGender:{ Male: Math.round(total*0.72), Female: Math.round(total*0.28) }, byYear, byDepartment: byDept, byBodyPart },
    monthly: { monthly },
    injury: {
      injuryTypes: Object.fromEntries(injTypes.map((t,i) => [t, Math.round(total*(0.35-i*0.04))])),
      natures: Object.fromEntries(natures.map((n,i) => [n, Math.round(total*(0.25-i*0.03))]))
    },
    raw: { data: [], total }
  };
  renderAll();
  document.getElementById('lastSync').textContent = 'Demo mode';
}

// ── Render everything ────────────────────────────────────────
function renderAll() {
  renderKPIs();
  populateYearFilter();
  renderTrendChart();
  renderDeptBars();
  renderInjuryDonut();
  renderYearChart();
  renderGenderChart();
  renderHeatmap();
  renderNatureChart();
  renderBodyChart();
  renderAllDeptBars();
  renderDeptAllChart();
  renderInjTypeBars();
  renderNatureBars();
  renderBodyBars();
  renderSectionBars();
  renderSectionAllChart();
  renderTimeAnalysis();
  renderScorecard();
  renderInsightStrip();
  renderRecentActivity();
  renderGlanceStats();
  renderAlertBell();
  initRecordsTable();
}

// ── KPIs ─────────────────────────────────────────────────────
function renderKPIs() {
  const { stats, monthly } = appData;
  animateCounter(document.getElementById('kpi-total'), stats.total);

  const years = Object.keys(stats.byYear || {}).sort();
  const currentYear = years[years.length - 1] || new Date().getFullYear().toString();
  const prevYear = years[years.length - 2];
  const thisYearVal = stats.byYear?.[currentYear] || 0;
  const prevYearVal = stats.byYear?.[prevYear] || 0;

  animateCounter(document.getElementById('kpi-year'), thisYearVal);
  document.getElementById('kpi-year-label').textContent = `Year ${currentYear}`;

  const avg = monthly.monthly.length ? Math.round(stats.total / monthly.monthly.length) : 0;
  animateCounter(document.getElementById('kpi-avg'), avg);

  const m = stats.byGender?.Male || 0, f = stats.byGender?.Female || 0;
  const pct = m+f ? Math.round(m/(m+f)*100) : 0;
  document.getElementById('kpi-gender').textContent = `${pct}% M`;
  document.getElementById('kpi-gender-sub').textContent = `${m} male, ${f} female`;

  const topDept = Object.entries(stats.byDepartment||{}).sort((a,b)=>b[1]-a[1])[0];
  if (topDept) {
    document.getElementById('kpi-dept').textContent = topDept[0].length > 16 ? topDept[0].slice(0,14)+'…' : topDept[0];
    document.getElementById('kpi-dept-sub').textContent = `${topDept[1]} incidents recorded`;
  }

  // Trend insight chip on the monthly trend chart
  if (monthly.monthly.length >= 2) {
    const last = monthly.monthly[monthly.monthly.length-1].count;
    const prev = monthly.monthly[monthly.monthly.length-2].count;
    const diff = last - prev;
    const chip = document.getElementById('trendInsightChip');
    const text = document.getElementById('trendInsightText');
    if (diff !== 0) {
      chip.style.display = 'inline-flex';
      text.textContent = diff > 0
        ? `+${diff} vs last month`
        : `${diff} vs last month`;
      chip.style.background = diff > 0 ? 'rgba(220,38,38,0.10)' : 'rgba(5,150,105,0.10)';
      chip.style.color = diff > 0 ? '#dc2626' : '#059669';
    }
  }
}

// ── Insight strip (auto-generated highlights) ──────────────────
function renderInsightStrip() {
  const container = document.getElementById('insightStrip');
  const { stats, monthly } = appData;
  const cards = [];

  // 1. Trend direction insight
  const last6 = monthly.monthly.slice(-6);
  const prior6 = monthly.monthly.slice(-12, -6);
  if (last6.length && prior6.length) {
    const avgLast = last6.reduce((s,m)=>s+m.count,0) / last6.length;
    const avgPrior = prior6.reduce((s,m)=>s+m.count,0) / prior6.length;
    const pctChange = avgPrior ? ((avgLast - avgPrior) / avgPrior * 100) : 0;
    const isWorse = pctChange > 5;
    const isBetter = pctChange < -5;
    cards.push({
      type: isWorse ? 'danger' : isBetter ? 'good' : 'warn',
      icon: isWorse
        ? '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'
        : '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
      title: isWorse ? 'Rising incident trend' : isBetter ? 'Improving trend' : 'Stable trend',
      desc: `Last 6 months averaged ${avgLast.toFixed(1)}/mo, ${Math.abs(pctChange).toFixed(0)}% ${pctChange>=0?'higher':'lower'} than the prior 6 months.`
    });
  }

  // 2. Top department concentration
  const deptEntries = Object.entries(stats.byDepartment || {}).sort((a,b)=>b[1]-a[1]);
  if (deptEntries.length) {
    const [topDept, topVal] = deptEntries[0];
    const share = (topVal / stats.total * 100).toFixed(0);
    cards.push({
      type: share > 35 ? 'danger' : share > 20 ? 'warn' : 'good',
      icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      title: `${topDept} leads incidents`,
      desc: `Accounts for ${share}% of all recorded incidents (${topVal} total) — the highest of any department.`
    });
  }

  // 3. Gender skew insight
  const m = stats.byGender?.Male || 0, f = stats.byGender?.Female || 0;
  if (m + f > 0) {
    const malePct = (m/(m+f)*100).toFixed(0);
    cards.push({
      type: 'warn',
      icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
      title: `${malePct}% of incidents involve male workers`,
      desc: `${m} male vs ${f} female incidents recorded across the full dataset.`
    });
  }

  if (!cards.length) { container.innerHTML = ''; return; }

  const iconWrap = svgInner => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${svgInner}</svg>`;

  container.innerHTML = cards.map(c => `
    <div class="insight-card ${c.type}">
      <div class="insight-card-icon">${iconWrap(c.icon)}</div>
      <div>
        <div class="insight-card-title">${c.title}</div>
        <div class="insight-card-desc">${c.desc}</div>
      </div>
    </div>
  `).join('');
}

// ── Recent activity feed ────────────────────────────────────────
function renderRecentActivity() {
  const container = document.getElementById('recentActivity');
  const rows = appData.raw?.data || [];
  if (!rows.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:10px 0">Connect live data to see recent incidents</div>`;
    return;
  }
  const sorted = [...rows].filter(r => r['Date']).sort((a,b) => new Date(b['Date']) - new Date(a['Date'])).slice(0, 6);
  container.innerHTML = sorted.map(r => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div>
        <div class="activity-text">${r['Description of Incident'] || 'Incident recorded'}</div>
        <div class="activity-meta">
          <span>${new Date(r['Date']).toLocaleDateString('en-GB')}</span>
          <span>·</span>
          <span>${r['Dept'] || 'Unknown'}</span>
          <span>·</span>
          <span>${r['Section'] || ''}</span>
        </div>
      </div>
    </div>
  `).join('');
}

// ── At-a-glance benchmarks ──────────────────────────────────────
function renderGlanceStats() {
  const container = document.getElementById('glanceStats');
  const { stats, monthly } = appData;
  const years = Object.keys(stats.byYear || {}).sort();
  const recentYear = years[years.length - 1];
  const prevYear = years[years.length - 2];

  const peakMonth = [...monthly.monthly].sort((a,b)=>b.count-a.count)[0];
  const lowMonth = [...monthly.monthly].sort((a,b)=>a.count-b.count)[0];
  const deptCount = Object.keys(stats.byDepartment || {}).length;
  const bodyPartCount = Object.keys(stats.byBodyPart || {}).length;

  const items = [
    { label: 'Departments tracked', value: deptCount },
    { label: 'Distinct body parts injured', value: bodyPartCount },
    { label: 'Highest incident month', value: peakMonth ? `${peakMonth.month} (${peakMonth.count})` : '—' },
    { label: 'Lowest incident month', value: lowMonth ? `${lowMonth.month} (${lowMonth.count})` : '—' },
    { label: `${recentYear || ''} vs ${prevYear || ''}`, value: (stats.byYear?.[recentYear] && stats.byYear?.[prevYear])
        ? `${stats.byYear[recentYear]} vs ${stats.byYear[prevYear]}` : '—' }
  ];

  container.innerHTML = items.map(i => `
    <div class="glance-item">
      <div class="glance-label">${i.label}</div>
      <div class="glance-value">${i.value}</div>
    </div>
  `).join('');
}

// ── Alert bell (high-risk department count + dropdown panel) ────
let highRiskDeptsCache = [];

function renderAlertBell() {
  const countEl = document.getElementById('alertCount');
  const bodyEl = document.getElementById('alertPanelBody');
  const deptEntries = Object.entries(appData.stats.byDepartment || {}).sort((a,b)=>b[1]-a[1]);
  const total = appData.stats.total || 1;
  // "High risk" = departments individually accounting for >15% of total incidents
  const highRisk = deptEntries.filter(([,v]) => (v/total) > 0.15);
  highRiskDeptsCache = highRisk;

  if (highRisk.length > 0) {
    countEl.style.display = 'flex';
    countEl.textContent = highRisk.length;
  } else {
    countEl.style.display = 'none';
  }

  if (!highRisk.length) {
    bodyEl.innerHTML = `<div class="alert-panel-empty">No departments currently exceed the 15% risk threshold.</div>`;
    return;
  }

  bodyEl.innerHTML = highRisk.map(([dept, val]) => {
    const pct = (val/total*100).toFixed(0);
    return `
      <div class="alert-panel-item">
        <div>
          <div class="alert-panel-dept">${dept}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:1px">${val} incidents recorded</div>
        </div>
        <div class="alert-panel-pct">${pct}%</div>
      </div>
    `;
  }).join('');
}

function toggleAlertPanel(e) {
  e.stopPropagation();
  const panel = document.getElementById('alertPanel');
  const bell = document.getElementById('alertBell');
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    bell.classList.remove('panel-open');
  } else {
    panel.classList.add('open');
    bell.classList.add('panel-open');
  }
}

// Close panel when clicking outside of it
document.addEventListener('click', (e) => {
  const panel = document.getElementById('alertPanel');
  const wrap = document.querySelector('.alert-bell-wrap');
  if (panel && panel.classList.contains('open') && wrap && !wrap.contains(e.target)) {
    panel.classList.remove('open');
    document.getElementById('alertBell').classList.remove('panel-open');
  }
});

// ── Mini animated bar list (used in multiple panels) ──────────
function renderBarList(containerId, entries, colorFn, maxItems) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const sliced = maxItems ? entries.slice(0, maxItems) : entries;
  const max = Math.max(...sliced.map(([,v]) => v), 1);

  container.innerHTML = sliced.map(([label, value], i) => `
    <div class="stat-row">
      <div class="stat-name" style="flex:0 0 140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${label}">${label}</div>
      <div class="stat-bar-wrap">
        <div class="stat-bar-track">
          <div class="stat-bar-fill" data-w="${(value/max*100).toFixed(1)}" style="background:${colorFn(i)}"></div>
        </div>
      </div>
      <div class="stat-num">${value}</div>
    </div>
  `).join('');

  // Trigger animation after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      container.querySelectorAll('.stat-bar-fill').forEach(el => {
        el.style.width = el.dataset.w + '%';
      });
    });
  });
}

function renderDeptBars() {
  const sorted = Object.entries(appData.stats.byDepartment||{}).sort((a,b)=>b[1]-a[1]).slice(0,6);
  renderBarList('deptBars', sorted, i => COLORS[i % COLORS.length]);
}
function renderAllDeptBars() {
  const sorted = Object.entries(appData.stats.byDepartment||{}).sort((a,b)=>b[1]-a[1]);
  renderBarList('allDeptBars', sorted, i => COLORS[i % COLORS.length]);
}
function renderInjTypeBars() {
  const sorted = Object.entries(appData.injury.injuryTypes||{}).sort((a,b)=>b[1]-a[1]);
  renderBarList('injTypeBars', sorted, i => COLORS[i % COLORS.length]);
}
function renderNatureBars() {
  const sorted = Object.entries(appData.injury.natures||{}).sort((a,b)=>b[1]-a[1]);
  renderBarList('natureBars', sorted, () => '#d97706');
}
function renderBodyBars() {
  const sorted = Object.entries(appData.stats.byBodyPart||{}).sort((a,b)=>b[1]-a[1]);
  renderBarList('bodyBars', sorted, () => '#7c3aed');
}

// ── Year filter state ────────────────────────────────────────
let currentYearFilter = 'all';

function populateYearFilter() {
  const sel = document.getElementById('yearFilter');
  const years = [...new Set(appData.monthly.monthly.map(m => m.month.split('-')[0]))].sort();
  const mostRecent = years[years.length - 1];
  currentYearFilter = currentYearFilter === 'all' ? 'all' : currentYearFilter;

  sel.innerHTML = `<option value="all">Compare all years</option>` +
    years.map(y => `<option value="${y}">${y}${y === mostRecent ? ' (latest)' : ''}</option>`).join('');
  sel.value = currentYearFilter;
}

function onYearFilterChange() {
  currentYearFilter = document.getElementById('yearFilter').value;
  renderTrendChart();
}

// ── Trend chart (year-aware) ──────────────────────────────────
function renderTrendChart() {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (charts.trend) charts.trend.destroy();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const data = appData.monthly.monthly;

  if (currentYearFilter === 'all') {
    // Group by year, one line per year, x-axis = month name (overlay comparison)
    const byYear = {};
    data.forEach(({ month, count }) => {
      const [y, m] = month.split('-');
      if (!byYear[y]) byYear[y] = new Array(12).fill(null);
      byYear[y][parseInt(m) - 1] = count;
    });
    const years = Object.keys(byYear).sort();
    const recentYears = years.slice(-5); // show last 5 years max to avoid clutter

    document.getElementById('trendSub').textContent = `Comparing ${recentYears.join(', ')} side by side`;

    const datasets = recentYears.map((y, i) => {
      const isLatest = i === recentYears.length - 1;
      return {
        label: y,
        data: byYear[y],
        borderColor: COLORS[i % COLORS.length],
        backgroundColor: 'transparent',
        borderWidth: isLatest ? 3 : 1.5,
        borderDash: isLatest ? [] : [4, 3],
        tension: 0.35,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 5,
        spanGaps: true
      };
    });

    charts.trend = new Chart(ctx, {
      type: 'line',
      data: { labels: monthNames, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 18, boxHeight: 2, padding: 12, font: { size: 11 }, color: '#475569' } },
          tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1, padding: 10, titleColor: '#0f172a', bodyColor: '#475569', displayColors: true }
        },
        scales: {
          x: { grid: { color: GRID }, border: { color: BORDER } },
          y: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true }
        }
      }
    });

  } else {
    // Single year — show all 12 months for that year
    const yearData = data.filter(m => m.month.startsWith(currentYearFilter));
    const monthMap = new Array(12).fill(0);
    yearData.forEach(({ month, count }) => { monthMap[parseInt(month.split('-')[1]) - 1] = count; });

    document.getElementById('trendSub').textContent = `${currentYearFilter} — month by month`;

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(37,99,235,0.16)');
    gradient.addColorStop(1, 'rgba(37,99,235,0)');

    charts.trend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthNames,
        datasets: [{
          label: currentYearFilter,
          data: monthMap,
          borderColor: '#2563eb',
          backgroundColor: gradient,
          borderWidth: 2.5, tension: 0.4, fill: true,
          pointRadius: 3, pointBackgroundColor: '#2563eb', pointBorderColor: '#ffffff', pointBorderWidth: 2,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1, padding: 10, titleColor: '#0f172a', bodyColor: '#475569', displayColors: false }
        },
        scales: {
          x: { grid: { color: GRID }, border: { color: BORDER } },
          y: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true }
        }
      }
    });
  }
}

// ── Injury Donut ─────────────────────────────────────────────
function renderInjuryDonut() {
  const ctx = document.getElementById('injuryDonut').getContext('2d');
  if (charts.donut) charts.donut.destroy();
  const sorted = Object.entries(appData.injury.injuryTypes||{}).sort((a,b)=>b[1]-a[1]).slice(0,7);
  charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: COLORS.slice(0,7), borderWidth: 0, hoverOffset: 6, borderRadius: 3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '64%',
      animation: { animateRotate: true, duration: 900 },
      plugins: {
        legend: { display: true, position: 'right', labels: { boxWidth: 8, padding: 8, font: { size: 10 }, color: '#475569' } },
        tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1, padding: 10 }
      }
    }
  });
}

// ── Year Chart ───────────────────────────────────────────────
function renderYearChart() {
  const ctx = document.getElementById('yearChart').getContext('2d');
  if (charts.year) charts.year.destroy();
  const sorted = Object.entries(appData.stats.byYear||{}).sort((a,b)=>a[0]-b[0]);
  charts.year = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#2563eb', borderRadius: 6, maxBarThickness: 36 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER } },
        y: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true }
      }
    }
  });
}

// ── Gender Chart ─────────────────────────────────────────────
function renderGenderChart() {
  const ctx = document.getElementById('genderChart').getContext('2d');
  if (charts.gender) charts.gender.destroy();
  const m = appData.stats.byGender?.Male || 0;
  const f = appData.stats.byGender?.Female || 0;
  charts.gender = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Male', 'Female'],
      datasets: [{ data: [m, f], backgroundColor: ['#2563eb', '#db2777'], borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '70%',
      animation: { animateRotate: true, duration: 900 },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 8, padding: 14, color: '#475569' } },
        tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 }
      }
    }
  });
}

// ── Heatmap ──────────────────────────────────────────────────
function renderHeatmap() {
  const container = document.getElementById('heatmapGrid');
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const totals = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  appData.monthly.monthly.forEach(({ month, count }) => {
    const m = parseInt(month.split('-')[1]) - 1;
    totals[m] += count; counts[m]++;
  });
  const avgs = totals.map((t,i) => counts[i] ? Math.round(t/counts[i]) : 0);
  const maxAvg = Math.max(...avgs, 1);

  container.innerHTML = avgs.map((v, i) => {
    const intensity = v / maxAvg;
    const r = Math.round(37 + (220-37)*intensity);
    const g = Math.round(99 + (38-99)*intensity);
    const b = Math.round(235 + (38-235)*intensity);
    return `
      <div class="heat-cell" style="background:rgba(${r},${g},${b},${0.18 + intensity*0.55})" title="${monthNames[i]}: avg ${v} incidents">
        ${v}
        <span class="heat-month">${monthNames[i]}</span>
      </div>
    `;
  }).join('');
}

// ── Nature Chart ─────────────────────────────────────────────
function renderNatureChart() {
  const ctx = document.getElementById('natureChart').getContext('2d');
  if (charts.nature) charts.nature.destroy();
  const sorted = Object.entries(appData.injury.natures||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  charts.nature = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: { labels: sorted.map(([k])=>k.length>20?k.slice(0,18)+'…':k), datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#059669', borderRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER } }
      }
    }
  });
}

// ── Body Chart ───────────────────────────────────────────────
function renderBodyChart() {
  const ctx = document.getElementById('bodyChart').getContext('2d');
  if (charts.body) charts.body.destroy();
  const sorted = Object.entries(appData.stats.byBodyPart||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  charts.body = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: { labels: sorted.map(([k])=>k), datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: '#7c3aed', borderRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER } }
      }
    }
  });
}

// ── Dept All Chart (horizontal) ───────────────────────────────
function renderDeptAllChart() {
  const ctx = document.getElementById('deptAllChart').getContext('2d');
  if (charts.deptAll) charts.deptAll.destroy();
  const sorted = Object.entries(appData.stats.byDepartment||{}).sort((a,b)=>b[1]-a[1]).slice(0,8);
  charts.deptAll = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: { labels: sorted.map(([k])=>k), datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: COLORS.slice(0,sorted.length), borderRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER } }
      }
    }
  });
}

// ── Section bars (like dept) ───────────────────────────────────
function renderSectionBars() {
  const rows = appData.raw?.data || [];
  const map = {};
  rows.forEach(r => {
    const s = (r['Section'] || 'Unknown').toString().trim();
    map[s] = (map[s] || 0) + 1;
  });
  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  if (!sorted.length) {
    document.getElementById('sectionBars').innerHTML = `<div class="empty-state" style="padding:30px 0"><div>No section data available</div></div>`;
    return;
  }
  renderBarList('sectionBars', sorted, i => COLORS[i % COLORS.length]);
}

function renderSectionAllChart() {
  const ctx = document.getElementById('sectionAllChart').getContext('2d');
  if (charts.sectionAll) charts.sectionAll.destroy();
  const rows = appData.raw?.data || [];
  const map = {};
  rows.forEach(r => {
    const s = (r['Section'] || 'Unknown').toString().trim();
    map[s] = (map[s] || 0) + 1;
  });
  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10);
  charts.sectionAll = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: { labels: sorted.map(([k])=>k), datasets: [{ data: sorted.map(([,v])=>v), backgroundColor: COLORS.slice(0,sorted.length||1), borderRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true },
        y: { grid: { display: false }, border: { color: BORDER } }
      }
    }
  });
}

// ── Time Analysis ────────────────────────────────────────────
function parseHour(timeVal) {
  if (!timeVal) return null;
  if (timeVal instanceof Date) return timeVal.getHours();
  const str = timeVal.toString();
  const m = str.match(/(\d{1,2}):(\d{2})/);
  if (m) return parseInt(m[1]);
  return null;
}

function renderTimeAnalysis() {
  const rows = appData.raw?.data || [];
  const emptyState = document.getElementById('timeEmptyState');

  if (!rows.length) {
    emptyState.style.display = 'block';
    ['hourChart','shiftChart','dowChart'].forEach(id => {
      const c = charts[id]; if (c) c.destroy();
    });
    return;
  }
  emptyState.style.display = 'none';

  // Hour distribution
  const hourCounts = new Array(24).fill(0);
  const dowCounts = new Array(7).fill(0);
  const shiftCounts = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };

  rows.forEach(r => {
    const hour = parseHour(r['Time']);
    if (hour !== null) {
      hourCounts[hour]++;
      if (hour >= 6 && hour < 12) shiftCounts.Morning++;
      else if (hour >= 12 && hour < 17) shiftCounts.Afternoon++;
      else if (hour >= 17 && hour < 21) shiftCounts.Evening++;
      else shiftCounts.Night++;
    }
    if (r['Date']) {
      const d = new Date(r['Date']);
      if (!isNaN(d)) dowCounts[d.getDay()]++;
    }
  });

  // Hour chart
  const hctx = document.getElementById('hourChart').getContext('2d');
  if (charts.hour) charts.hour.destroy();
  charts.hour = new Chart(hctx, {
    type: 'bar',
    data: {
      labels: hourCounts.map((_,i) => `${i}:00`),
      datasets: [{ data: hourCounts, backgroundColor: '#2563eb', borderRadius: 4, maxBarThickness: 16 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER }, ticks: { maxTicksLimit: 12 } },
        y: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true }
      }
    }
  });

  // Shift chart
  const sctx = document.getElementById('shiftChart').getContext('2d');
  if (charts.shift) charts.shift.destroy();
  charts.shift = new Chart(sctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(shiftCounts),
      datasets: [{ data: Object.values(shiftCounts), backgroundColor: ['#d97706','#2563eb','#7c3aed','#1e293b'], borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      animation: { animateRotate: true, duration: 900 },
      plugins: { legend: { display: true, position: 'right', labels: { boxWidth: 8, padding: 10, color: '#475569' } }, tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 } }
    }
  });

  // Day of week chart
  const dctx = document.getElementById('dowChart').getContext('2d');
  if (charts.dow) charts.dow.destroy();
  const dowLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  charts.dow = new Chart(dctx, {
    type: 'bar',
    data: { labels: dowLabels, datasets: [{ data: dowCounts, backgroundColor: '#059669', borderRadius: 6, maxBarThickness: 50 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1 } },
      scales: {
        x: { grid: { color: GRID }, border: { color: BORDER } },
        y: { grid: { color: GRID }, border: { color: BORDER }, beginAtZero: true }
      }
    }
  });
}

// ── Safety Scorecard ─────────────────────────────────────────
function renderScorecard() {
  const { stats, monthly } = appData;
  const monthsArr = monthly.monthly;
  if (!monthsArr.length) return;

  // Trend factor: compare last 6mo avg vs prior 6mo avg
  const last6 = monthsArr.slice(-6);
  const prior6 = monthsArr.slice(-12, -6);
  const avgLast6 = last6.reduce((s,m)=>s+m.count,0) / (last6.length || 1);
  const avgPrior6 = prior6.length ? prior6.reduce((s,m)=>s+m.count,0) / prior6.length : avgLast6;
  const trendChange = avgPrior6 ? ((avgLast6 - avgPrior6) / avgPrior6) * 100 : 0;
  const trendScore = Math.max(0, Math.min(100, 70 - trendChange * 1.5));

  // Concentration factor: how concentrated incidents are in top dept (lower spread = worse)
  const deptVals = Object.values(stats.byDepartment || {});
  const totalDept = deptVals.reduce((a,b)=>a+b,0) || 1;
  const topDeptShare = deptVals.length ? Math.max(...deptVals) / totalDept : 0;
  const concentrationScore = Math.max(0, 100 - topDeptShare * 100);

  // Severity factor: proxy via "Trauma"/"Burn"/"Fracture" share in injury types
  const injTypes = appData.injury.injuryTypes || {};
  const totalInj = Object.values(injTypes).reduce((a,b)=>a+b,0) || 1;
  const severeKeywords = ['trauma','burn','fracture','amputation'];
  const severeCount = Object.entries(injTypes).reduce((sum,[k,v]) => severeKeywords.some(kw => k.toLowerCase().includes(kw)) ? sum+v : sum, 0);
  const severityScore = Math.max(0, 100 - (severeCount/totalInj)*200);

  const overall = Math.round(trendScore*0.4 + concentrationScore*0.3 + severityScore*0.3);
  const clamped = Math.max(0, Math.min(100, overall));

  // Ring
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (clamped/100)*circumference;
  const ring = document.getElementById('scoreRingFill');
  const ringText = document.getElementById('scoreRingText');
  ring.setAttribute('stroke-dasharray', circumference.toFixed(0));
  setTimeout(() => { ring.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)'; ring.setAttribute('stroke-dashoffset', offset.toFixed(0)); }, 100);

  let label, color, desc;
  if (clamped >= 75) { label = 'Good standing'; color = '#059669'; desc = 'Incident trend is stable or improving, and risk is reasonably distributed across departments.'; }
  else if (clamped >= 50) { label = 'Needs attention'; color = '#d97706'; desc = 'Some departments or trends show elevated risk concentration. Targeted intervention recommended.'; }
  else { label = 'Critical — action required'; color = '#dc2626'; desc = 'Multiple risk factors are elevated. Incident rate, severity, or department concentration require immediate review.'; }

  ring.setAttribute('stroke', color);
  ringText.textContent = clamped;
  ringText.setAttribute('fill', color);
  document.getElementById('scoreLabel').textContent = label;
  document.getElementById('scoreLabel').style.color = color;
  document.getElementById('scoreDesc').textContent = desc;

  // Score factors breakdown
  const factorsEl = document.getElementById('scoreFactors');
  const factors = [
    { name: 'Trend (40%)', val: Math.round(trendScore), color: trendScore >= 60 ? '#059669' : trendScore >= 40 ? '#d97706' : '#dc2626' },
    { name: 'Dept. concentration (30%)', val: Math.round(concentrationScore), color: concentrationScore >= 60 ? '#059669' : concentrationScore >= 40 ? '#d97706' : '#dc2626' },
    { name: 'Severity mix (30%)', val: Math.round(severityScore), color: severityScore >= 60 ? '#059669' : severityScore >= 40 ? '#d97706' : '#dc2626' }
  ];
  factorsEl.innerHTML = factors.map(f => `
    <div class="prog-bar-wrap">
      <div class="prog-meta"><span class="prog-label">${f.name}</span><span class="prog-val">${f.val}/100</span></div>
      <div class="prog-track"><div class="prog-fill" data-w="${f.val}" style="background:${f.color}"></div></div>
    </div>
  `).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    factorsEl.querySelectorAll('.prog-fill').forEach(el => el.style.width = el.dataset.w + '%');
  }));

  // YoY change
  const years = Object.keys(stats.byYear || {}).sort();
  const yoyEl = document.getElementById('yoyChange');
  if (years.length >= 2) {
    const rows = [];
    for (let i = 1; i < years.length; i++) {
      const prev = stats.byYear[years[i-1]], curr = stats.byYear[years[i]];
      const pct = prev ? ((curr - prev) / prev * 100) : 0;
      rows.push({ year: years[i], curr, pct });
    }
    yoyEl.innerHTML = rows.slice(-5).map(r => `
      <div class="stat-row">
        <div class="stat-name" style="flex:0 0 60px">${r.year}</div>
        <div class="stat-bar-wrap"><div class="stat-bar-track"><div class="stat-bar-fill" data-w="${Math.min(100, r.curr/Math.max(...rows.map(x=>x.curr))*100)}" style="background:#2563eb"></div></div></div>
        <div class="stat-num" style="color:${r.pct > 0 ? '#dc2626' : '#059669'}">${r.pct > 0 ? '+' : ''}${r.pct.toFixed(0)}%</div>
      </div>
    `).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      yoyEl.querySelectorAll('.stat-bar-fill').forEach(el => el.style.width = el.dataset.w + '%');
    }));
  } else {
    yoyEl.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:10px 0">Not enough years of data for comparison</div>`;
  }

  // Improving / worsening departments (recent 6mo vs prior 6mo, using raw data if available)
  const rows = appData.raw?.data || [];
  const improvingEl = document.getElementById('improvingDepts');
  const worseningEl = document.getElementById('worseningDepts');
  if (rows.length) {
    const now = new Date();
    const cutoffRecent = new Date(now); cutoffRecent.setMonth(cutoffRecent.getMonth() - 6);
    const cutoffPrior = new Date(now); cutoffPrior.setMonth(cutoffPrior.getMonth() - 12);

    const deptTrend = {};
    rows.forEach(r => {
      const d = new Date(r['Date']);
      if (isNaN(d)) return;
      const dept = (r['Dept'] || 'Unknown').toString().trim();
      if (!deptTrend[dept]) deptTrend[dept] = { recent: 0, prior: 0 };
      if (d >= cutoffRecent) deptTrend[dept].recent++;
      else if (d >= cutoffPrior) deptTrend[dept].prior++;
    });

    const diffs = Object.entries(deptTrend).map(([dept, v]) => ({ dept, diff: v.recent - v.prior, recent: v.recent, prior: v.prior }))
      .filter(d => d.prior > 0 || d.recent > 0);

    const improving = diffs.filter(d => d.diff < 0).sort((a,b)=>a.diff-b.diff).slice(0,5);
    const worsening = diffs.filter(d => d.diff > 0).sort((a,b)=>b.diff-a.diff).slice(0,5);

    improvingEl.innerHTML = improving.length ? improving.map(d => `
      <div class="stat-row"><div class="stat-name" style="flex:1">${d.dept}</div><div class="stat-num" style="color:#059669">${d.diff}</div></div>
    `).join('') : `<div style="color:var(--muted);font-size:12px;padding:8px 0">No clear improvement detected</div>`;

    worseningEl.innerHTML = worsening.length ? worsening.map(d => `
      <div class="stat-row"><div class="stat-name" style="flex:1">${d.dept}</div><div class="stat-num" style="color:#dc2626">+${d.diff}</div></div>
    `).join('') : `<div style="color:var(--muted);font-size:12px;padding:8px 0">No clear worsening detected</div>`;
  } else {
    improvingEl.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:8px 0">Connect live data to see department trends</div>`;
    worseningEl.innerHTML = '';
  }
}

// ── Records: search + filter + pagination ─────────────────────
let recordsState = { page: 1, pageSize: 50, search: '', dept: '' };

function initRecordsTable() {
  const rows = appData.raw?.data || [];
  // Populate dept filter dropdown
  const deptSel = document.getElementById('deptFilter');
  const depts = [...new Set(rows.map(r => (r['Dept']||'Unknown').toString().trim()))].sort();
  deptSel.innerHTML = `<option value="">All departments</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join('');

  recordsState = { page: 1, pageSize: 50, search: '', dept: '' };
  renderRecordsTable();
}

function onRecordSearch() {
  recordsState.search = document.getElementById('recordSearch').value.toLowerCase();
  recordsState.dept = document.getElementById('deptFilter').value;
  recordsState.page = 1;
  renderRecordsTable();
}

function getFilteredRecords() {
  const rows = appData.raw?.data || [];
  return rows.filter(r => {
    if (recordsState.dept && (r['Dept']||'').toString().trim() !== recordsState.dept) return false;
    if (recordsState.search) {
      const haystack = [r['Name'], r['Dept'], r['Section'], r['Description of Incident'], r['Nature of Incident'], r['Type of Injury']].join(' ').toLowerCase();
      if (!haystack.includes(recordsState.search)) return false;
    }
    return true;
  });
}

function renderRecordsTable() {
  const tbody = document.getElementById('recordsTbody');
  const all = appData.raw?.data || [];
  const filtered = getFilteredRecords();
  const totalPages = Math.max(1, Math.ceil(filtered.length / recordsState.pageSize));
  recordsState.page = Math.min(recordsState.page, totalPages);

  const start = (recordsState.page - 1) * recordsState.pageSize;
  const pageRows = filtered.slice(start, start + recordsState.pageSize);

  document.getElementById('recordCount').textContent = all.length
    ? `Showing ${start+1}–${Math.min(start+pageRows.length, filtered.length)} of ${filtered.length} (${all.length} total)`
    : 'No data available — connect your Apps Script URL';

  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:40px">${all.length ? 'No matching records' : 'No records — connect your Apps Script URL to see live data'}</td></tr>`;
    document.getElementById('paginationWrap').innerHTML = '';
    return;
  }

  const genderBadge = g => g === 'Male' ? 'badge-cyan' : g === 'Female' ? 'badge-purple' : 'badge-muted';

  tbody.innerHTML = pageRows.map(r => `
    <tr>
      <td style="white-space:nowrap;font-family:var(--font-mono);font-size:11px">${r['Date'] ? new Date(r['Date']).toLocaleDateString('en-GB') : '—'}</td>
      <td style="max-width:240px">${r['Description of Incident']||'—'}</td>
      <td>${r['Nature of Incident']||'—'}</td>
      <td><span class="badge badge-amber">${r['Type of Injury']||'—'}</span></td>
      <td>${r['Affected part']||'—'}</td>
      <td><span class="badge ${genderBadge(r['Gender'])}">${r['Gender']||'—'}</span></td>
      <td>${r['Name']||'—'}</td>
      <td>${r['Section']||'—'}</td>
      <td>${r['Dept']||'—'}</td>
    </tr>
  `).join('');

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const wrap = document.getElementById('paginationWrap');
  if (totalPages <= 1) { wrap.innerHTML = ''; return; }
  const p = recordsState.page;

  let pageBtns = '';
  const pageList = new Set([1, totalPages, p, p-1, p+1].filter(n => n >= 1 && n <= totalPages));
  const sortedPages = [...pageList].sort((a,b)=>a-b);
  let lastShown = 0;
  sortedPages.forEach(n => {
    if (n - lastShown > 1) pageBtns += `<span style="color:var(--muted);padding:0 4px">…</span>`;
    pageBtns += `<button class="page-btn ${n===p?'active':''}" onclick="goToPage(${n})">${n}</button>`;
    lastShown = n;
  });

  wrap.innerHTML = `
    <div class="page-info">Page ${p} of ${totalPages}</div>
    <div class="page-controls">
      <button class="page-btn" onclick="goToPage(${p-1})" ${p<=1?'disabled':''}>‹ Prev</button>
      ${pageBtns}
      <button class="page-btn" onclick="goToPage(${p+1})" ${p>=totalPages?'disabled':''}>Next ›</button>
    </div>
  `;
}

function goToPage(n) {
  recordsState.page = n;
  renderRecordsTable();
}

// ── AI Prediction ────────────────────────────────────────────
async function loadPrediction() {
  if (APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) return;
  try {
    const result = await api('prediction');
    if (result.prediction) {
      renderPrediction(result.prediction, result.cachedAt);
      document.getElementById('predBadge').style.display = 'inline-flex';
    }
  } catch (e) { console.warn('Prediction load failed', e); }
}

const AI_STEPS = [
  'Reading incident register…',
  'Computing department risk scores…',
  'Cross-referencing seasonal patterns…',
  'Generating prevention strategy…'
];

async function triggerPrediction() {
  const btn = document.getElementById('genBtn');
  const loading = document.getElementById('aiLoading');
  const output = document.getElementById('predOutput');
  const empty = document.getElementById('predEmpty');
  const stepsEl = document.getElementById('aiSteps');

  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Generating…`;
  loading.style.display = 'flex';
  output.style.display = 'none';
  empty.style.display = 'none';

  stepsEl.innerHTML = '';
  AI_STEPS.forEach((step, i) => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'ai-step';
      el.style.animationDelay = '0s';
      el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> ${step}`;
      stepsEl.appendChild(el);
    }, i * 700);
  });

  const resetBtn = () => {
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate Now`;
  };

  if (APPS_SCRIPT_URL.includes('YOUR_SCRIPT_ID')) {
    await new Promise(r => setTimeout(r, 3200));
    renderPrediction(DEMO_PREDICTION, new Date().toISOString());
    loading.style.display = 'none';
    resetBtn();
    return;
  }

  try {
    const result = await api('trigger_prediction');
    if (result.prediction) {
      renderPrediction(result.prediction, result.cachedAt);
    } else {
      empty.style.display = 'block';
      empty.querySelector('div').textContent = result.error || 'Generation failed';
    }
  } catch (e) {
    empty.style.display = 'block';
    empty.querySelector('div').textContent = 'Error: ' + e.message;
  } finally {
    loading.style.display = 'none';
    resetBtn();
  }
}

function renderPrediction(p, cachedAt) {
  const output = document.getElementById('predOutput');
  document.getElementById('predEmpty').style.display = 'none';

  const riskColor = { Low:'#059669', Medium:'#d97706', High:'#dc2626', Critical:'#dc2626' }[p.riskLevel] || '#2563eb';
  const riskDim = { Low:'var(--green-dim)', Medium:'var(--amber-dim)', High:'var(--red-dim)', Critical:'var(--red-dim)' }[p.riskLevel] || 'var(--cyan-dim)';

  output.innerHTML = `
    <div class="pred-hero">
      <div class="pred-month">Prediction for ${p.generatedFor || '—'}</div>
      <div class="pred-summary">${p.summary || ''}</div>
      ${cachedAt ? `<div class="pred-meta">Generated ${new Date(cachedAt).toLocaleString()}</div>` : ''}
    </div>

    <div class="pred-stats">
      <div class="kpi-card" style="border-top:1px solid ${riskColor}55">
        <div class="kpi-label">Risk Level</div>
        <div class="kpi-value" style="font-size:22px;color:${riskColor}">${p.riskLevel||'—'}</div>
      </div>
      <div class="kpi-card c-cyan">
        <div class="kpi-label">Predicted Incidents</div>
        <div class="kpi-value">${p.predictedIncidents ?? '—'}</div>
        <div class="kpi-sub">This month estimate</div>
      </div>
      <div class="kpi-card c-green">
        <div class="kpi-label">Confidence</div>
        <div class="kpi-value">${p.confidencePercent ?? '—'}%</div>
        <div class="kpi-sub">Model confidence</div>
      </div>
    </div>

    ${p.trendInsight || p.seasonalFactors ? `
    <div class="pred-factors">
      ${p.trendInsight ? `<div><span class="factor-label trend">Trend</span>${p.trendInsight}</div>` : ''}
      ${p.seasonalFactors ? `<div style="margin-top:6px"><span class="factor-label season">Seasonal</span>${p.seasonalFactors}</div>` : ''}
    </div>` : ''}

    ${(p.highRiskDepartments||[]).length ? `
    <div class="section-header"><div class="section-title">High-risk departments</div></div>
    <div class="dept-tags">${p.highRiskDepartments.map(d=>`<span class="dept-tag">${d}</span>`).join('')}</div>
    ` : ''}

    <div class="section-header"><div class="section-title">Top risk factors</div></div>
    <div class="risk-cards">
      ${(p.topRisks||[]).map(r => {
        const likeColor = r.likelihood === 'High' ? 'badge-red' : r.likelihood === 'Medium' ? 'badge-amber' : 'badge-green';
        return `
        <div class="risk-card">
          <div>
            <div class="risk-name">${r.risk}</div>
            <div class="risk-detail">${r.detail}</div>
            <div class="risk-badges">
              <span class="badge ${likeColor}">Likelihood: ${r.likelihood}</span>
              <span class="badge badge-muted">Impact: ${r.impact}</span>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="section-header" style="margin-top:18px"><div class="section-title">Prevention actions</div></div>
    <div class="action-cards">
      ${(p.preventionActions||[]).map((a,i) => {
        const numStyle = a.priority === 'Urgent' ? 'background:var(--red-dim);color:var(--red)' : a.priority === 'High' ? 'background:var(--amber-dim);color:var(--amber)' : 'background:var(--cyan-dim);color:var(--cyan)';
        const badgeClass = a.priority === 'Urgent' ? 'badge-red' : a.priority === 'High' ? 'badge-amber' : 'badge-muted';
        return `
        <div class="action-card">
          <div class="action-num" style="${numStyle}">${i+1}</div>
          <div>
            <div class="action-title">${a.action} <span class="badge ${badgeClass}" style="margin-left:6px">${a.priority}</span></div>
            <div class="action-desc">${a.description}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  output.style.display = 'block';
}

// ── Demo Prediction ──────────────────────────────────────────
const DEMO_PREDICTION = {
  generatedFor: "July 2026",
  riskLevel: "High",
  predictedIncidents: 26,
  confidencePercent: 74,
  summary: "Based on historical patterns from 2015–2026, July typically shows elevated incident rates due to increased production load and monsoon-related hazards. Primary Production and Packing departments account for over 50% of incidents and warrant heightened monitoring this month.",
  topRisks: [
    { risk: "Hand/Finger contact injuries", likelihood: "High", impact: "High", detail: "Abrasion and cut injuries to hands consistently peak in production-heavy months." },
    { risk: "Eye foreign body exposure", likelihood: "High", impact: "Medium", detail: "CED and mechanical sections show recurring chemical and dust-related eye incidents." },
    { risk: "Slip and fall — wet floors", likelihood: "Medium", impact: "Medium", detail: "Canteen and admin areas see seasonal slip incidents during the monsoon period." },
    { risk: "Chemical spill (spring-setting)", likelihood: "Medium", impact: "High", detail: "Spring-setting section historically has 2–3 chemical incidents per quarter." }
  ],
  highRiskDepartments: ["Primary Production", "Packing", "Engineering"],
  preventionActions: [
    { action: "Hand protection audit", priority: "Urgent", description: "Conduct glove compliance check across all production lines before shift start daily." },
    { action: "Eye wash station inspection", priority: "High", description: "Verify all eye-wash stations in CED and Mechanical sections are operational." },
    { action: "Wet floor signage", priority: "High", description: "Deploy additional slip-warning signage in kitchen, canteen, and admin corridors." },
    { action: "Chemical handling refresher", priority: "Medium", description: "Schedule a 30-minute toolbox talk on chemical spill SOP for spring-setting operators." }
  ],
  seasonalFactors: "July marks the monsoon onset in Kerala — wet floors and humidity increase slip and chemical handling risks.",
  trendInsight: "Incident counts show a gradual upward trend of ~5% year-on-year since 2020, suggesting need for systemic intervention."
};

// ── Init ──────────────────────────────────────────────────────
loadAll();
